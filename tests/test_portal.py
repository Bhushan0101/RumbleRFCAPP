"""Behavioral integration checks on isolated SQLite copies; no shipped data is modified."""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
import portal
from scripts import init_db,migrate
from scripts.seed_portal_demo import seed

class PortalTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.path=Path(self.tmp.name)/'test.sqlite3'
        previous=init_db.DB
        init_db.DB=self.path
        try:init_db.initialize();migrate.run(self.path)
        finally:init_db.DB=previous
        seed(self.path)
        self.cookies={}
        for role in ('admin','promoter','fighter','gym','coach'):
            status,_,headers=self.call('login','POST',{'email':role+'@demo.rfc.test','password':'RfcDemo2026!'})
            self.assertEqual(status,200)
            self.cookies[role]=headers['Set-Cookie'].split(';')[0]
        self.state=self.call('state',role='promoter')[1]
        self.event=self.state['events'][0]['id']
        self.bout=self.state['bouts'][0]

    def tearDown(self):self.tmp.cleanup()
    def call(self,path,method='GET',data=None,role=None,headers=None):
        return portal.handle(self.path,method,path,data,self.cookies.get(role,'') if hasattr(self,'cookies') else '',headers if headers is not None else {'X-Requested-With':'fetch'},'localhost')
    def test_connected_roles_and_private_accounts(self):
        public=self.call('state')[1]
        self.assertIsNone(public['user']);self.assertNotIn('users',public)
        f=next(f for f in public['fighters'] if f['name']=='Demo Alex Fighter')
        self.assertTrue(f['gym_id']);self.assertTrue(f['coach_id'])
        for role in ('fighter','gym','coach'):
            self.assertIn(f['id'],self.call('state',role=role)[1]['team'])
        self.assertEqual(len(self.call('state',role='admin')[1]['users']),5)
    def test_permissions_and_csrf(self):
        self.assertEqual(self.call('events','POST',{},'fighter')[0],403)
        self.assertEqual(self.call('rankings','PUT',{},'promoter')[0],403)
        self.assertEqual(self.call('events','POST',{},None)[0],401)
        self.assertEqual(self.call('login','POST',{},headers={})[0],403)
        self.assertEqual(self.call('login','POST',{},headers={'X-Requested-With':'fetch','Origin':'https://evil.test'})[0],403)
        self.assertEqual(self.call('register','POST',{'role':'admin'})[0],400)
        self.call('register','POST',{'role':'promoter','name':'Other','organization':'Other promotion','email':'other@test.test','password':'LongPassword123'})
        status,_,h=self.call('login','POST',{'email':'other@test.test','password':'LongPassword123'})
        self.cookies['other']=h['Set-Cookie'].split(';')[0]
        self.assertEqual(self.call(f'events/{self.event}','PUT',{},'other')[0],403)
        self.assertEqual(self.call(f'bouts/{self.bout["id"]}/result','PUT',{},'other')[0],403)
    def test_result_retries_corrections_and_audit(self):
        red,blue=self.bout['red_athlete_id'],self.bout['blue_athlete_id']
        def record(aid):
            f=next(f for f in self.call('state')[1]['fighters'] if f['id']==aid)
            return f['wins'],f['losses'],f['draws']
        initial=record(red),record(blue)
        payload={'outcome':'red','method':'Decision','round':3,'time':'05:00'}
        for _ in range(2):self.assertEqual(self.call(f'bouts/{self.bout["id"]}/result','PUT',payload,'promoter')[0],200)
        self.assertEqual(record(red),(initial[0][0]+1,initial[0][1],initial[0][2]))
        self.assertEqual(record(blue),(initial[1][0],initial[1][1]+1,initial[1][2]))
        for outcome in ('blue','draw','no_contest'):
            payload['outcome']=outcome
            self.assertEqual(self.call(f'bouts/{self.bout["id"]}/result','PUT',payload,'promoter')[0],200)
        self.assertEqual((record(red),record(blue)),initial)
        with sqlite3.connect(self.path) as db:self.assertEqual(db.execute('SELECT count(*) FROM result_audit').fetchone()[0],5)
        payload['time']='99:99'
        self.assertEqual(self.call(f'bouts/{self.bout["id"]}/result','PUT',payload,'promoter')[0],400)
        self.assertEqual((record(red),record(blue)),initial)
    def test_registration_card_and_rollback(self):
        aid=self.bout['red_athlete_id']
        self.assertEqual(self.call(f'events/{self.event}/register','POST',{'athlete_id':aid},'fighter')[0],409)
        unrelated=self.state['fighters'][0]['id']
        self.assertEqual(self.call(f'events/{self.event}/register','POST',{'athlete_id':unrelated},'fighter')[0],403)
        before=len(self.call('state')[1]['fighters'])
        self.assertEqual(self.call(f'events/{self.event}/register','POST',{'outside':True,'name':'Guest','division':'Lightweight','country':'Ireland'},'promoter')[0],200)
        self.assertEqual(len(self.call('state')[1]['fighters']),before+1)
        self.assertEqual(self.call(f'events/{self.event}/bouts','POST',{'red_athlete_id':aid,'blue_athlete_id':aid},'promoter')[0],400)
        event=dict(self.state['events'][0]);event['registration_open']=0
        self.assertEqual(self.call(f'events/{self.event}','PUT',event,'promoter')[0],200)
        self.assertEqual(self.call(f'events/{self.event}/register','POST',{'outside':True,'name':'Closed','division':'Lightweight','country':'Ireland'},'promoter')[0],409)
        self.assertEqual(len(self.call('state')[1]['fighters']),before+1)
    def test_independent_registration_and_rankings(self):
        payload={'role':'fighter','name':'Independent','email':'solo@test.test','password':'LongPassword123','country':'Ireland','division':'Lightweight'}
        self.assertEqual(self.call('register','POST',payload)[0],200)
        aid=next(f['id'] for f in self.call('state')[1]['fighters'] if f['name']=='Independent')
        self.assertEqual(self.call('rankings','PUT',{'athlete_id':aid,'position':1},'admin')[0],200)
        rankings=[r for r in self.call('state')[1]['rankings'] if r['division']=='Lightweight']
        self.assertEqual(rankings[0]['athlete_id'],aid)
        self.assertEqual([r['position'] for r in rankings],list(range(1,len(rankings)+1)))
        self.assertEqual(self.call('register','POST',payload)[0],409)
        self.assertEqual(self.call('login','POST',{'email':payload['email'],'password':'wrong password'})[0],401)
    def test_affiliation_edit_and_reconnect(self):
        self.assertEqual(self.call('profile','PUT',{'gym_id':'','coach_id':''},'fighter')[0],200)
        fighter=next(f for f in self.call('state')[1]['fighters'] if f['name']=='Demo Alex Fighter')
        self.assertIsNone(fighter['gym_id']);self.assertIsNone(fighter['coach_id'])
        self.assertNotIn(fighter['id'],self.call('state',role='gym')[1]['team'])
        state=self.call('state')[1]
        self.assertEqual(self.call('profile','PUT',{'gym_id':state['gyms'][0]['id'],'coach_id':state['coaches'][0]['id']},'fighter')[0],200)
        self.assertIn(fighter['id'],self.call('state',role='gym')[1]['team'])
        self.assertEqual(self.call('profile','PUT',{'organization':'Renamed demo gym','city':'Cork'},'gym')[0],200)
        self.assertEqual(self.call('state')[1]['gyms'][0]['city'],'Cork')

    def test_legacy_editor_preserves_result_accounting(self):
        import server
        payload={'outcome':'red','method':'Decision','round':3,'time':'05:00'}
        self.assertEqual(self.call(f'bouts/{self.bout["id"]}/result','PUT',payload,'promoter')[0],200)
        previous=server.DB;server.DB=self.path
        try:
            with self.assertRaises(server.Conflict):server.op_delete('bouts',self.bout['id'])
            with self.assertRaises(server.Conflict):server.op_update('bouts',self.bout['id'],{'division':'Lightweight'})
            with self.assertRaises(server.Conflict):server.op_update('athletes',self.bout['red_athlete_id'],{'name':'Demo Alex Fighter','division':'Lightweight','country':'Ireland','wins':99})
            with self.assertRaises(server.Conflict):server.op_delete('events',self.event)
        finally:server.DB=previous

    def test_seed_repeatability(self):
        before=self.call('state')[1]
        seed(self.path)
        after=self.call('state')[1]
        for key in ('fighters','events','bouts','registrations','gyms','coaches','promotions'):
            self.assertEqual(before[key],after[key])


class TransportTests(unittest.TestCase):
    setUp=PortalTests.setUp
    tearDown=PortalTests.tearDown
    call=PortalTests.call

    def test_wsgi_login_state_and_permissions(self):
        import importlib,io,sys
        import server
        old_init,old_server=init_db.DB,server.DB
        init_db.DB=server.DB=self.path
        try:
            main=importlib.import_module('main')
            def request(path,method='GET',payload=None,cookie=''):
                body=json.dumps(payload).encode() if payload is not None else b''
                environ={'PATH_INFO':'/api/portal/'+path,'REQUEST_METHOD':method,'CONTENT_LENGTH':str(len(body)),'wsgi.input':io.BytesIO(body),'HTTP_X_REQUESTED_WITH':'fetch','HTTP_HOST':'localhost','HTTP_COOKIE':cookie}
                response={}
                def start(status,headers):response.update(status=status,headers=dict(headers))
                result=json.loads(b''.join(main.app(environ,start)))
                return response,result
            response,data=request('login','POST',{'email':'promoter@demo.rfc.test','password':'RfcDemo2026!'})
            self.assertEqual(response['status'],'200 OK')
            cookie=response['headers']['Set-Cookie'].split(';')[0]
            response,data=request('state',cookie=cookie)
            self.assertEqual(data['user']['role'],'promoter')
            self.assertIn(self.event,data['managed_events'])
            response,_=request('rankings','PUT',{},cookie)
            self.assertEqual(response['status'],'403 Forbidden')
            response,_=request('login','POST',[])
            self.assertEqual(response['status'],'400 Bad Request')
        finally:init_db.DB,server.DB=old_init,old_server

    def test_http_login_and_public_routes(self):
        import http.cookiejar,threading,urllib.request
        from http.server import ThreadingHTTPServer
        import server
        previous=server.DB;server.DB=self.path
        httpd=ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        thread=threading.Thread(target=httpd.serve_forever,daemon=True);thread.start()
        try:
            base=f'http://127.0.0.1:{httpd.server_port}'
            opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
            request=urllib.request.Request(base+'/api/portal/login',data=json.dumps({'email':'fighter@demo.rfc.test','password':'RfcDemo2026!'}).encode(),headers={'Content-Type':'application/json','X-Requested-With':'fetch'})
            with opener.open(request) as response:self.assertEqual(response.status,200)
            with opener.open(base+'/api/portal/state') as response:
                self.assertEqual(json.load(response)['user']['role'],'fighter')
            for path in ('/portal.html','/portal.js','/portal.css','/api/content','/api/health'):
                with opener.open(base+path) as response:self.assertEqual(response.status,200)
        finally:
            httpd.shutdown();httpd.server_close();thread.join();server.DB=previous

class ExcelRankingTests(unittest.TestCase):
    setUp=PortalTests.setUp
    tearDown=PortalTests.tearDown
    call=PortalTests.call

    def encoded(self,workbook):
        import base64,io
        stream=io.BytesIO();workbook.save(stream)
        return base64.b64encode(stream.getvalue()).decode()

    def workbook(self):
        import io,openpyxl
        status,raw,headers=self.call('rankings/template',role='admin')
        self.assertEqual(status,200)
        self.assertIn('.xlsx',headers['Content-Disposition'])
        return openpyxl.load_workbook(io.BytesIO(raw))

    def test_template_permissions_and_round_trip(self):
        self.assertEqual(self.call('rankings/template')[0],401)
        self.assertEqual(self.call('rankings/template',role='promoter')[0],403)
        before=self.call('state')[1]['rankings']
        book=self.workbook();self.assertIn('Instructions',book.sheetnames)
        encoded=self.encoded(book)
        status,preview,_=self.call('rankings/import','POST',{'file':encoded,'preview':True},'admin')
        self.assertEqual(status,200);self.assertTrue(preview['rows'])
        self.assertEqual(self.call('state')[1]['rankings'],before)
        status,result,_=self.call('rankings/import','POST',{'file':encoded,'preview':False,'revision':preview['revision']},'admin')
        self.assertEqual(status,200);self.assertEqual(result['imported'],len(before))
        self.assertEqual(self.call('rankings/import','POST',{'file':encoded},'fighter')[0],403)

    def test_excel_reorder_and_stale_preview(self):
        book=self.workbook();sheet=book['Rankings']
        sheet['D2'],sheet['D3']=sheet['D3'].value,sheet['D2'].value
        encoded=self.encoded(book)
        status,preview,_=self.call('rankings/import','POST',{'file':encoded},'admin');self.assertEqual(status,200)
        status,result,_=self.call('rankings/import','POST',{'file':encoded,'preview':False,'revision':preview['revision']},'admin');self.assertEqual(status,200)
        division=sheet['C2'].value
        ranks=[r for r in self.call('state')[1]['rankings'] if r['division']==division]
        self.assertEqual(ranks[0]['athlete_id'],sheet['A3'].value)
        self.assertEqual(self.call('rankings/import','POST',{'file':encoded,'preview':False,'revision':preview['revision']},'admin')[0],409)

    def test_invalid_workbooks_leave_rankings_unchanged(self):
        before=self.call('state')[1]['rankings']
        for change in ('formula','duplicate','wrong_name','wrong_division','gap','bad_header'):
            book=self.workbook();sheet=book['Rankings']
            if change=='formula':sheet['D2']='=1+1'
            elif change=='duplicate':sheet['D3']=sheet['D2'].value
            elif change=='wrong_name':sheet['B2']='Wrong fighter'
            elif change=='wrong_division':sheet['C2']='Unknown division'
            elif change=='gap':sheet['D2']=100
            else:sheet['A1']='wrong_header'
            self.assertEqual(self.call('rankings/import','POST',{'file':self.encoded(book)},'admin')[0],400,change)
            self.assertEqual(self.call('state')[1]['rankings'],before)
        for file in ('bad base64!', 'e30='):
            self.assertEqual(self.call('rankings/import','POST',{'file':file},'admin')[0],400)

    def test_preview_removals_and_unrelated_divisions(self):
        book=self.workbook();sheet=book['Rankings'];division=sheet['C2'].value
        # Keep only the first ranked fighter from one division.
        sheet.delete_rows(3,sheet.max_row)
        encoded=self.encoded(book)
        before=self.call('state')[1]['rankings']
        _,preview,_=self.call('rankings/import','POST',{'file':encoded},'admin')
        self.assertTrue(preview['removed'])
        status,_,_=self.call('rankings/import','POST',{'file':encoded,'preview':False,'revision':preview['revision']},'admin')
        self.assertEqual(status,200)
        after=self.call('state')[1]['rankings']
        self.assertEqual([r for r in before if r['division']!=division],[r for r in after if r['division']!=division])
        self.assertEqual(len([r for r in after if r['division']==division]),1)
        previous=init_db.DB;init_db.DB=self.path
        try:init_db.initialize()
        finally:init_db.DB=previous
        self.assertEqual(self.call('state')[1]['rankings'],after, 'Startup must not restore removed ranking seeds')

if __name__=='__main__':unittest.main()
