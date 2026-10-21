"""Application, finance and event-entry integration tests; no real payment requests."""
import base64
import csv
import hashlib
import hmac
import io
import json
import sqlite3
import time
import unittest
from unittest.mock import patch
import test_portal as fixtures
from portal import Error
from portal_features import payments

class ApplicationFinanceTests(unittest.TestCase):
    setUp=fixtures.PortalTests.setUp
    tearDown=fixtures.PortalTests.tearDown
    call=fixtures.PortalTests.call

    def applicant(self,name='New applicant',division='Lightweight'):
        data={'role':'fighter','name':name,'email':'applicant@test.test','password':'Application2026!','division':division,'country':'Ireland'}
        self.assertEqual(self.call('register','POST',data)[0],200)
        status,_,headers=self.call('login','POST',{'email':data['email'],'password':data['password']})
        self.assertEqual(status,200);self.cookies['applicant']=headers['Set-Cookie'].split(';')[0]
        self.aid=self.call('state',role='applicant')[1]['profile'][0]['athlete_id']
        return self.aid

    def pay(self,role='applicant',aid=None):
        aid=aid or self.aid
        status,checkout,_=self.call(f'applications/{aid}/checkout','POST',{},role)
        self.assertEqual(status,200,checkout)
        pid=checkout['payment_id']
        self.assertEqual(self.call(f'payments/{pid}/demo-confirm','POST',{'confirm':True},role)[0],200)
        return pid

    def approve(self,aid=None):
        self.assertEqual(self.call(f'fighters/{aid or self.aid}/review','PUT',{'decision':'approved'},'admin')[0],200)

    def test_private_application_requires_payment_and_approval(self):
        aid=self.applicant()
        self.assertNotIn(aid,[f['id'] for f in self.call('state')[1]['fighters']])
        self.assertEqual(self.call(f'fighters/{aid}/review','PUT',{'decision':'approved'},'admin')[0],409)
        self.assertEqual(self.call(f'fighters/{aid}/review','PUT',{'decision':'approved'},'fighter')[0],403)
        self.assertEqual(self.call('rankings','PUT',{'athlete_id':aid,'position':1},'admin')[0],409)
        self.assertEqual(self.call(f'events/{self.event}/register','POST',{'athlete_id':aid,'acknowledged':True},'applicant')[0],409)
        self.pay()
        self.assertEqual(self.call('state',role='applicant')[1]['profile'][0]['approval_status'],'pending_approval')
        self.assertNotIn(aid,[f['id'] for f in self.call('state')[1]['fighters']])
        self.approve()
        self.assertIn(aid,[f['id'] for f in self.call('state')[1]['fighters']])
        status,entry,_=self.call(f'events/{self.event}/register','POST',{'athlete_id':aid,'acknowledged':True},'applicant')
        self.assertEqual(status,200);self.assertTrue(entry['registration_ref'].startswith('WUCO-E'))
        self.assertEqual(self.call(f'events/{self.event}/register','POST',{'athlete_id':aid,'acknowledged':True},'applicant')[0],409)

    def test_fixed_fee_idempotent_receipt_and_finance_authorization(self):
        aid=self.applicant()
        status,first,_=self.call(f'applications/{aid}/checkout','POST',{'amount_cents':1},'applicant')
        self.assertEqual(status,200)
        self.assertEqual(self.call(f'applications/{aid}/checkout','POST',{},'applicant')[1]['payment_id'],first['payment_id'])
        pid=first['payment_id']
        self.assertEqual(self.call(f'payments/{pid}/demo-confirm','POST',{'confirm':False},'applicant')[0],400)
        for _ in range(2):self.assertEqual(self.call(f'payments/{pid}/demo-confirm','POST',{'confirm':True},'applicant')[0],200)
        status,pdf,headers=self.call(f'payments/{pid}/receipt',role='applicant')
        self.assertEqual(status,200);self.assertTrue(pdf.startswith(b'%PDF-'));self.assertEqual(headers['Content-Type'],'application/pdf')
        self.assertIn('TEST-WUCO',headers['Content-Disposition'])
        self.assertEqual(self.call(f'payments/{pid}/receipt',role='fighter')[0],403)
        self.assertEqual(self.call('finance/report','POST',{},'applicant')[0],403)
        self.assertEqual(self.call('finance/export','POST',{},'fighter')[0],403)
        result=self.call('finance/report','POST',{},'admin')[1]
        self.assertEqual(result['live']['gross_cents'],0);self.assertEqual(result['test']['gross_cents'],1000)
        self.assertEqual(result['test']['paid_count'],1)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM payment_audit WHERE action='payment_confirmed'").fetchone()[0],1)
            self.assertEqual(db.execute('SELECT amount_cents FROM payments').fetchone()[0],1000)

    def test_cancel_retry_and_demo_disabled_outside_demo(self):
        aid=self.applicant()
        pid=self.call(f'applications/{aid}/checkout','POST',{},'applicant')[1]['payment_id']
        with patch.dict('os.environ',{'WUCO_DEMO_MODE':'0','WUCO_PAYMENT_MODE':'demo'}):
            self.assertEqual(self.call(f'payments/{pid}/demo-confirm','POST',{'confirm':True},'applicant')[0],403)
            self.assertEqual(self.call(f'applications/{aid}/checkout','POST',{},'applicant')[0],503)
        self.assertEqual(self.call(f'payments/{pid}/cancel','POST',{},'applicant')[0],200)
        self.assertEqual(self.call(f'payments/{pid}/receipt',role='applicant')[0],409)
        self.assertEqual(self.call(f'payments/{pid}/demo-confirm','POST',{'confirm':True},'applicant')[0],409)
        new=self.call(f'applications/{aid}/checkout','POST',{},'applicant')[1]['payment_id']
        self.assertNotEqual(pid,new)
        self.assertEqual(self.call('finance/report','POST',{},'admin')[1]['test']['gross_cents'],0)

    def stripe_checkout(self):
        self.applicant()
        environment=patch.dict('os.environ',{'WUCO_PAYMENT_MODE':'stripe','STRIPE_SECRET_KEY':'sk_test_fixture','STRIPE_WEBHOOK_SECRET':'fixture-webhook-secret','WUCO_PUBLIC_URL':'https://wuco.example'})
        environment.start();self.addCleanup(environment.stop)
        with patch.object(payments,'stripe_request',return_value={'id':'cs_test_fixture','url':'https://checkout.stripe.com/c/pay/test_fixture'}) as provider:
            status,checkout,_=self.call(f'applications/{self.aid}/checkout','POST',{},'applicant')
            self.assertEqual(status,200,checkout)
            self.assertEqual(provider.call_args.args[2]['line_items[0][price_data][unit_amount]'],1000)
        pid=checkout['payment_id']
        session={'id':'cs_test_fixture','amount_total':1000,'currency':'eur','livemode':False,'payment_status':'paid','payment_intent':'pi_fixture','metadata':{'payment_id':str(pid),'athlete_id':str(self.aid)}}
        return pid,session

    def test_stripe_sync_verifies_provider_not_client(self):
        pid,session=self.stripe_checkout()
        with patch.object(payments,'stripe_request',return_value=dict(session,payment_status='unpaid')):
            self.assertTrue(self.call('payments/sync','POST',{'session_id':'cs_test_fixture','paid':True},'applicant')[1]['pending'])
        self.assertEqual(self.call('state',role='applicant')[1]['profile'][0]['approval_status'],'awaiting_payment')
        with patch.object(payments,'stripe_request',return_value=dict(session,amount_total=1)):
            self.assertEqual(self.call('payments/sync','POST',{'session_id':'cs_test_fixture'},'applicant')[0],400)
        with patch.object(payments,'stripe_request',return_value=session):
            self.assertEqual(self.call('payments/sync','POST',{'session_id':'cs_test_fixture'},'applicant')[0],200)
        self.assertEqual(self.call(f'payments/{pid}/demo-confirm','POST',{'confirm':True},'applicant')[0],403)

    def signed_event(self,event):
        raw=json.dumps(event,separators=(',',':')).encode();stamp=str(int(time.time()))
        digest=hmac.new(b'fixture-webhook-secret',stamp.encode()+b'.'+raw,hashlib.sha256).hexdigest()
        return raw,'t='+stamp+',v1='+digest

    def test_signed_webhook_deduplicates_and_refunds_report_correctly(self):
        pid,session=self.stripe_checkout()
        event={'id':'evt_paid','type':'checkout.session.completed','data':{'object':session}}
        raw,signature=self.signed_event(event)
        with self.assertRaises(Error):payments.webhook(self.path,raw,signature+'bad')
        self.assertTrue(payments.webhook(self.path,raw,signature)['ok'])
        self.assertTrue(payments.webhook(self.path,raw,signature)['duplicate'])
        self.approve()
        for amount in (500,1000):
            event={'id':'evt_refund_'+str(amount),'type':'charge.refunded','data':{'object':{'payment_intent':'pi_fixture','amount_refunded':amount,'currency':'eur','livemode':False}}}
            raw,signature=self.signed_event(event);self.assertTrue(payments.webhook(self.path,raw,signature)['ok'])
            report=self.call('finance/report','POST',{},'admin')[1]
            self.assertEqual(report['test']['gross_cents'],1000);self.assertEqual(report['test']['refund_cents'],amount)
        self.assertEqual(self.call('state',role='applicant')[1]['profile'][0]['approval_status'],'suspended')
        self.assertEqual(self.call('finance/report','POST',{},'admin')[1]['test']['net_cents'],0)
        self.assertEqual(self.call(f'payments/{pid}/receipt',role='applicant')[0],200)

    def test_refund_before_checkout_completion_is_not_lost(self):
        pid,session=self.stripe_checkout()
        refund={'id':'evt_early_refund','type':'charge.refunded','data':{'object':{'payment_intent':'pi_fixture','amount_refunded':1000,'currency':'eur','livemode':False}}}
        raw,signature=self.signed_event(refund);payments.webhook(self.path,raw,signature)
        completed={'id':'evt_later_completed','type':'checkout.session.completed','data':{'object':session}}
        raw,signature=self.signed_event(completed);payments.webhook(self.path,raw,signature)
        result=self.call('finance/report','POST',{},'admin')[1]
        self.assertEqual(result['test']['gross_cents'],1000);self.assertEqual(result['test']['refund_cents'],1000)
        self.assertEqual(self.call('state',role='applicant')[1]['profile'][0]['approval_status'],'suspended')

    def test_live_checkout_is_blocked_on_temporary_finance_storage(self):
        self.applicant()
        with patch.dict('os.environ',{'WUCO_PAYMENT_MODE':'stripe','STRIPE_SECRET_KEY':'sk_live_fixture','STRIPE_WEBHOOK_SECRET':'fixture','WUCO_PUBLIC_URL':'https://wuco.example','WUCO_FINANCE_DURABLE':'1'}),patch.object(payments,'stripe_request') as provider:
            self.assertEqual(self.call(f'applications/{self.aid}/checkout','POST',{},'applicant')[0],503)
            provider.assert_not_called()

    def test_finance_filters_csv_and_decline_management(self):
        self.applicant('=2+2');self.pay()
        self.assertEqual(self.call('finance/report','POST',{'from':'2999-01-01'},'admin')[1]['test']['paid_count'],0)
        with sqlite3.connect(self.path) as db:
            db.execute("UPDATE payments SET created_at='2000-01-01 00:00:00'")
            today=db.execute("SELECT date('now')").fetchone()[0]
        self.assertEqual(self.call('finance/report','POST',{'from':today,'to':today},'admin')[1]['test']['paid_count'],1)
        self.assertEqual(self.call('finance/report','POST',{'from':'bad-date'},'admin')[0],400)
        self.assertEqual(self.call('finance/report','POST',{'from':'2027-01-01','to':'2026-01-01'},'admin')[0],400)
        status,raw,_=self.call('finance/export','POST',{},'admin');self.assertEqual(status,200)
        exported=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))));self.assertEqual(exported[0]['fighter_name'],"'=2+2")
        self.assertEqual(self.call(f'fighters/{self.aid}/review','PUT',{'decision':'rejected'},'admin')[0],400)
        self.assertEqual(self.call(f'fighters/{self.aid}/review','PUT',{'decision':'rejected','note':'Please check your details.'},'admin')[0],200)
        self.assertEqual(self.call(f'fighters/{self.aid}/profile','PUT',{'name':'Corrected fighter','division':'Lightweight','country':'Ireland'},'admin')[0],200)
        self.assertEqual(self.call(f'fighters/{self.aid}/profile','PUT',{'name':'Not allowed'},'fighter')[0],403)
        self.approve()

    def event_data(self,**changes):
        return dict({'title':'QA entry event','subtitle':'Test only','timezone':'Europe/Dublin','registration_open':1,'capacity':1,'categories':['Lightweight'],'starts_at':'2099-01-01T12:00'},**changes)

    def test_event_capacity_deadline_withdrawal_and_confirmation(self):
        self.applicant();self.pay();self.approve()
        event=self.call('events','POST',self.event_data(),'promoter')[1]['id']
        data={'athlete_id':self.aid,'acknowledged':True}
        self.assertEqual(self.call(f'events/{event}/register','POST',{'athlete_id':self.aid},'applicant')[0],400)
        status,entry,_=self.call(f'events/{event}/register','POST',data,'applicant');self.assertEqual(status,200)
        alex=self.bout['red_athlete_id']
        self.assertEqual(self.call(f'events/{event}/register','POST',{'athlete_id':alex,'acknowledged':True},'fighter')[0],409)
        self.assertEqual(self.call(f'events/{event}/withdraw','POST',{'athlete_id':self.aid},'fighter')[0],403)
        self.assertEqual(self.call(f'events/{event}/withdraw','POST',{'athlete_id':self.aid},'applicant')[0],200)
        self.assertEqual(self.call(f'events/{event}/register','POST',data,'applicant')[1]['registration_ref'],entry['registration_ref'])
        self.assertEqual(self.call(f'events/{event}/withdraw','POST',{'athlete_id':self.aid},'applicant')[0],200)
        for changes in ({'registration_open':0},{'registration_closes_at':'2000-01-01T12:00'},{'categories':['Featherweight']},{'starts_at':'2000-01-01T12:00'}):
            self.assertEqual(self.call(f'events/{event}','PUT',self.event_data(**changes),'promoter')[0],200)
            self.assertEqual(self.call(f'events/{event}/register','POST',data,'applicant')[0],409)

    def test_concurrent_event_entries_cannot_overfill(self):
        from concurrent.futures import ThreadPoolExecutor
        self.applicant();self.pay();self.approve()
        event=self.call('events','POST',self.event_data(),'promoter')[1]['id']
        attempts=[('applicant',self.aid),('fighter',self.bout['red_athlete_id'])]
        def enter(item):return self.call(f'events/{event}/register','POST',{'athlete_id':item[1],'acknowledged':True},item[0])[0]
        with ThreadPoolExecutor(max_workers=2) as pool:statuses=list(pool.map(enter,attempts))
        self.assertEqual(sorted(statuses),[200,409])
        current=next(e for e in self.call('state')[1]['events'] if e['id']==event)
        self.assertEqual(current['registered_count'],1)

    def test_guest_application_must_also_be_paid_and_approved(self):
        status,result,_=self.call(f'events/{self.event}/register','POST',{'outside':True,'name':'New guest','division':'Lightweight','country':'Ireland'},'promoter')
        self.assertEqual(status,200);self.assertTrue(result['application_pending'])
        aid=result['athlete_id'];data={'athlete_id':aid,'acknowledged':True}
        self.assertEqual(self.call(f'events/{self.event}/register','POST',data,'promoter')[0],409)
        self.pay('promoter',aid);self.approve(aid)
        self.assertEqual(self.call(f'events/{self.event}/register','POST',data,'promoter')[0],200)

if __name__=='__main__':unittest.main()
