"""Fixed EUR 10 application payments. Demo settlement is isolated from Stripe settlement."""
import hashlib
import hmac
import io
import json
import os
import secrets
import sqlite3
import time
from datetime import datetime,timezone
from urllib.parse import urlencode,urlsplit,quote
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from portal import Error,one,require,number,rows
from .applications import owns_application,has_payment

FEE_CENTS=1000

def demo_enabled():return os.environ.get('WUCO_DEMO_MODE',os.environ.get('RFC_DEMO_MODE'))=='1'
def mode():
    value=os.environ.get('WUCO_PAYMENT_MODE','demo' if demo_enabled() else 'disabled')
    if value=='demo' and not demo_enabled():return 'disabled'
    return value if value in ('demo','stripe') else 'disabled'
def config():return {'mode':mode(),'fee_cents':FEE_CENTS,'currency':'EUR','ready':mode()=='demo' or (mode()=='stripe' and bool(os.environ.get('STRIPE_SECRET_KEY') and os.environ.get('STRIPE_WEBHOOK_SECRET') and os.environ.get('WUCO_PUBLIC_URL')))}

def stripe_request(method,path,values=None,idempotency=None):
    key=os.environ.get('STRIPE_SECRET_KEY','')
    if not key:raise Error('The payment provider is not configured. Contact the administrator.',503)
    headers={'Authorization':'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'}
    if idempotency:headers['Idempotency-Key']=idempotency
    request=Request('https://api.stripe.com/v1/'+path,data=urlencode(values).encode() if values is not None else None,method=method,headers=headers)
    try:
        with urlopen(request,timeout=20) as response:return json.load(response)
    except (HTTPError,URLError,TimeoutError,ValueError):raise Error('The payment provider could not be reached. No payment has been confirmed. Please retry.',502)

def payment(db,user,pid):
    row=one(db,'SELECT * FROM payments WHERE id=?',(pid,))
    app=one(db,'SELECT user_id,created_by FROM fighter_profiles WHERE athlete_id=?',(row['athlete_id'],))
    require(user,'fighter','admin','promoter')
    if user['role']!='admin' and user['id'] not in (row['payer_id'],app['user_id'],app['created_by']):raise Error('This payment belongs to another account',403)
    return row

def checkout(db,user,aid):
    app=owns_application(db,user,aid)
    if app['legacy_member']:raise Error('This existing profile does not require a new application fee',409)
    if app['approval_status'] in ('rejected','suspended'):raise Error('Contact the administrator about this application before paying',409)
    existing=db.execute("SELECT id FROM payments WHERE athlete_id=? AND status='paid' AND refunded_cents<amount_cents",(aid,)).fetchone()
    if existing:return {'payment_id':existing['id'],'already_paid':True}
    settings=config()
    if not settings['ready']:raise Error('Checkout is not configured. Your application is saved; contact the administrator.',503)
    provider=settings['mode']
    is_test=1 if provider=='demo' or os.environ.get('STRIPE_SECRET_KEY','').startswith('sk_test_') else 0
    if provider=='stripe' and not is_test:
        # Never take live money on the ephemeral stakeholder database.
        from pathlib import Path
        database=Path(db.execute('PRAGMA database_list').fetchone()[2]).resolve()
        temporary=any(database.is_relative_to(Path(root)) for root in ('/tmp','/var/tmp','/dev/shm'))
        if os.environ.get('WUCO_FINANCE_DURABLE')!='1' or temporary:raise Error('Live payments require configured durable finance storage outside temporary directories.',503)
    previous=db.execute("SELECT * FROM payments WHERE athlete_id=? AND status='pending' AND provider=? ORDER BY id DESC LIMIT 1",(aid,provider)).fetchone()
    if previous and previous['is_test']==is_test:
        pid=previous['id'];token=previous['checkout_token']
    else:
        token=secrets.token_urlsafe(24)
        pid=db.execute('''INSERT INTO payments(athlete_id,payer_id,amount_cents,provider,is_test,checkout_token,payer_name,payer_email,fighter_name)
            VALUES(?,?,?,?,?,?,?,?,?)''',(aid,user['id'],FEE_CENTS,provider,is_test,token,user['name'],user['email'],app['name'])).lastrowid
        db.execute('INSERT INTO payment_audit(payment_id,actor_id,action) VALUES(?,?,?)',(pid,user['id'],'checkout_created'))
    if provider=='demo':return {'payment_id':pid,'checkout_route':'checkout-'+str(pid),'mode':'demo'}
    public=os.environ.get('WUCO_PUBLIC_URL','').rstrip('/')
    parsed=urlsplit(public)
    if parsed.scheme!='https' or not parsed.netloc or parsed.query or parsed.fragment:raise Error('Configure WUCO_PUBLIC_URL as the HTTPS site URL',503)
    # The provider's idempotency key prevents duplicate hosted sessions after retries.
    session=stripe_request('POST','checkout/sessions',{
        'mode':'payment','customer_email':user['email'],'client_reference_id':str(pid),
        'line_items[0][price_data][currency]':'eur','line_items[0][price_data][unit_amount]':FEE_CENTS,
        'line_items[0][price_data][product_data][name]':'W.U.C.O fighter application','line_items[0][quantity]':1,
        'metadata[payment_id]':pid,'metadata[athlete_id]':aid,
        'payment_intent_data[metadata][payment_id]':pid,'payment_intent_data[metadata][athlete_id]':aid,
        'success_url':public+'/portal.html?session_id={CHECKOUT_SESSION_ID}#payments',
        'cancel_url':public+'/portal.html?payment_cancelled=1#payments'},'wuco-checkout-'+token)
    if not str(session.get('url','')).startswith('https://checkout.stripe.com/') or not session.get('id'):raise Error('The provider returned an invalid checkout session',502)
    db.execute('UPDATE payments SET provider_session=? WHERE id=?',(session['id'],pid))
    return {'payment_id':pid,'url':session['url'],'mode':'stripe'}

def settle(db,row,actor=None,provider_intent=None):
    if row['status']=='paid':return {'ok':True,'payment_id':row['id'],'already_paid':True}
    duplicate=has_payment(db,row['athlete_id'])
    if duplicate and row['provider']=='demo':raise Error('The application already has a completed payment',409)
    receipt=('TEST-' if row['is_test'] else '')+'WUCO-'+datetime.now(timezone.utc).strftime('%Y%m%d')+'-'+secrets.token_hex(4).upper()
    refund=db.execute('SELECT * FROM provider_refunds WHERE payment_intent=?',(provider_intent,)).fetchone() if provider_intent else None
    if refund and (refund['is_test']!=row['is_test'] or refund['currency']!='eur' or refund['refunded_cents']>row['amount_cents']):raise Error('Refund verification does not match the payment',400)
    db.execute("UPDATE payments SET status='paid',receipt_number=?,paid_at=CURRENT_TIMESTAMP,provider_intent=?,duplicate_application_payment=? WHERE id=?",(receipt,provider_intent,int(duplicate),row['id']))
    db.execute("UPDATE fighter_profiles SET approval_status='pending_approval' WHERE athlete_id=? AND approval_status='awaiting_payment'",(row['athlete_id'],))
    if refund:
        db.execute('UPDATE payments SET refunded_cents=? WHERE id=?',(refund['refunded_cents'],row['id']))
        if refund['refunded_cents']==row['amount_cents']:
            db.execute("UPDATE fighter_profiles SET approval_status='suspended',review_note='Application payment refunded; administrator review required.' WHERE athlete_id=? AND legacy_member=0",(row['athlete_id'],))
    db.execute('INSERT INTO payment_audit(payment_id,actor_id,action) VALUES(?,?,?)',(row['id'],actor,'payment_confirmed'))
    db.execute('INSERT INTO application_audit(athlete_id,actor_id,action) VALUES(?,?,?)',(row['athlete_id'],actor,'payment_received'))
    return {'ok':True,'payment_id':row['id'],'receipt_number':receipt,'duplicate_payment':duplicate}

def settle_session(db,session):
    row=one(db,'SELECT * FROM payments WHERE provider_session=?',(session.get('id',''),))
    metadata=session.get('metadata') or {}
    if row['provider']!='stripe' or session.get('amount_total')!=FEE_CENTS or session.get('currency')!='eur' or str(metadata.get('payment_id'))!=str(row['id']) or str(metadata.get('athlete_id'))!=str(row['athlete_id']) or bool(session.get('livemode'))==bool(row['is_test']):
        raise Error('Payment verification did not match the application',400)
    if session.get('payment_status')!='paid':return {'ok':True,'pending':True}
    return settle(db,row,provider_intent=session.get('payment_intent'))

def dispatch(db,user,method,path,data):
    parts=path.split('/')
    if method=='POST' and len(parts)==3 and parts[0]=='applications' and parts[2]=='checkout':return checkout(db,user,number(parts[1]))
    require(user,'fighter','admin','promoter')
    if method=='GET' and path=='payments':
        return {'payments':rows(db,'''SELECT p.* FROM payments p JOIN fighter_profiles f ON f.athlete_id=p.athlete_id
            WHERE ?='admin' OR p.payer_id=? OR f.user_id=? OR f.created_by=? ORDER BY p.id DESC''',(user['role'],user['id'],user['id'],user['id'])),'settings':config()}
    if method=='POST' and path=='payments/sync':
        sid=data.get('session_id','')
        if not isinstance(sid,str) or not sid.startswith('cs_') or len(sid)>255:raise Error('Invalid checkout session')
        record=one(db,'SELECT id FROM payments WHERE provider_session=?',(sid,));row=payment(db,user,record['id'])
        return settle_session(db,stripe_request('GET','checkout/sessions/'+quote(sid,safe='')))
    if len(parts)!=3 or parts[0]!='payments':raise Error('Payment route not found',404)
    row=payment(db,user,number(parts[1]))
    if method=='GET' and parts[2]=='details':return {'payment':row,'settings':config()}
    if method=='POST' and parts[2]=='demo-confirm':
        if mode()!='demo' or not demo_enabled() or row['provider']!='demo' or not row['is_test']:raise Error('Test payment confirmation is disabled',403)
        if data.get('confirm') is not True:raise Error('Confirm this is a simulated test payment')
        if row['status'] not in ('pending','paid'):raise Error('Start a new checkout for this application',409)
        return settle(db,row,user['id'])
    if method=='POST' and parts[2]=='cancel':
        if row['status']!='pending':raise Error('Only an unfinished checkout can be cancelled',409)
        if row['provider']!='demo':raise Error('Cancel hosted checkout at the payment provider',409)
        db.execute("UPDATE payments SET status='cancelled' WHERE id=?",(row['id'],))
        db.execute('INSERT INTO payment_audit(payment_id,actor_id,action) VALUES(?,?,?)',(row['id'],user['id'],'checkout_cancelled'))
        return {'ok':True}
    raise Error('Payment route not found',404)

def webhook(db_path,raw,signature):
    secret=os.environ.get('STRIPE_WEBHOOK_SECRET','')
    if not secret:raise Error('Payment webhook is not configured',503)
    try:
        fields={}
        for item in signature.split(','):
            key,value=item.split('=',1);fields.setdefault(key,[]).append(value)
        stamp=fields['t'][0]
        if abs(time.time()-int(stamp))>300:raise ValueError()
        expected=hmac.new(secret.encode(),stamp.encode()+b'.'+raw,hashlib.sha256).hexdigest()
        if not any(hmac.compare_digest(expected,value) for value in fields.get('v1',[])):raise ValueError()
        event=json.loads(raw)
        if not isinstance(event,dict) or not isinstance(event.get('id'),str) or not isinstance(event.get('data'),dict) or not isinstance(event['data'].get('object'),dict):raise ValueError()
    except (ValueError,KeyError,TypeError):raise Error('Invalid payment webhook signature',400)
    with sqlite3.connect(db_path,timeout=15) as db:
        db.row_factory=sqlite3.Row;db.execute('PRAGMA foreign_keys=ON');db.execute('BEGIN IMMEDIATE')
        if db.execute('SELECT 1 FROM payment_webhook_events WHERE event_id=?',(event['id'],)).fetchone():return {'ok':True,'duplicate':True}
        kind=event.get('type','');obj=event.get('data',{}).get('object',{})
        if kind in ('checkout.session.completed','checkout.session.async_payment_succeeded'):settle_session(db,obj)
        elif kind in ('checkout.session.expired','checkout.session.async_payment_failed'):
            db.execute("UPDATE payments SET status=? WHERE provider_session=? AND status='pending'",('cancelled' if kind.endswith('expired') else 'failed',obj.get('id','')))
        elif kind=='charge.refunded':
            intent=obj.get('payment_intent','');amount=obj.get('amount_refunded')
            if not isinstance(intent,str) or not intent.startswith('pi_') or not isinstance(amount,int) or isinstance(amount,bool) or amount<0 or not isinstance(obj.get('livemode'),bool):raise Error('Invalid refund event',400)
            row=db.execute('SELECT * FROM payments WHERE provider_intent=?',(intent,)).fetchone()
            if row and (amount>row['amount_cents'] or obj.get('currency')!='eur' or row['provider']!='stripe' or bool(obj['livemode'])==bool(row['is_test'])):raise Error('Invalid refund amount or payment mode',400)
            if obj.get('currency')=='eur':
                db.execute('INSERT INTO provider_refunds(payment_intent,refunded_cents,currency,is_test) VALUES(?,?,?,?) ON CONFLICT(payment_intent) DO UPDATE SET refunded_cents=max(refunded_cents,excluded.refunded_cents)',(intent,amount,'eur',int(not obj['livemode'])))
            if row:
                db.execute('UPDATE payments SET refunded_cents=max(refunded_cents,?) WHERE id=?',(amount,row['id']))
                db.execute('INSERT INTO payment_audit(payment_id,action) VALUES(?,?)',(row['id'],'provider_refund_recorded'))
                if amount==row['amount_cents']:
                    db.execute("UPDATE fighter_profiles SET approval_status='suspended',review_note='Application payment refunded; administrator review required.' WHERE athlete_id=? AND legacy_member=0",(row['athlete_id'],))
        db.execute('INSERT INTO payment_webhook_events(event_id,event_type) VALUES(?,?)',(event['id'],kind))
    return {'ok':True}
