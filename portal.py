"""Shared member portal API for the local HTTP and WSGI servers. Standard library only."""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from portal_features.categories import CATEGORIES, category

class Error(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def text(data, key, maximum=160, required=True):
    value = data.get(key, '')
    if value is None and not required:
        value = ''
    if not isinstance(value, str) or len(value.strip()) > maximum or (required and not value.strip()):
        raise Error(f'{key}: enter valid text (maximum {maximum} characters)')
    return value.strip()

def number(value):
    if isinstance(value, bool) or len(str(value)) > 12 or not str(value).isdigit() or int(value) < 1:
        raise Error('Choose a valid ID')
    return int(value)

def rows(db, sql, args=()):
    return [dict(r) for r in db.execute(sql, args)]

def one(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    if not row:
        raise Error('Not found', 404)
    return dict(row)

def require(user, *roles):
    if not user:
        raise Error('Sign in first', 401)
    if user['role'] not in roles:
        raise Error('You do not have permission for this action', 403)

def linked_id(db, data, key, table):
    value = data.get(key)
    if value in (None, ''):
        return None
    value = number(value)
    one(db, f'SELECT id FROM {table} WHERE id=?', (value,))
    return value

CLASS_CODES = ('J','N','L','C','B','A')

def fighter_class(value):
    if value in (None, ''):
        return None
    if value not in CLASS_CODES:
        raise Error('Choose a fighter class: J, N, L, C, B or A')
    return value

def create_user(db, data, allow_admin=False):
    first = (data.get('first_name') or '').strip()
    last = (data.get('last_name') or '').strip()
    if first or last:
        data = {**data, 'name': (first + ' ' + last).strip()}
    name, email = text(data, 'name'), text(data, 'email', 254).lower()
    if email in {r+'@demo.rfc.test' for r in ('admin','fighter','promoter','gym','coach')}:email=email.replace('@demo.rfc.test','@demo.wuco.test')
    role = data.get('role')
    if role not in (('admin',) if allow_admin else ()) + ('fighter','gym','coach','promoter'):
        raise Error('Choose fighter, gym, coach or promoter')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise Error('Enter a valid email')
    password = data.get('password', '')
    if not isinstance(password, str) or not 10 <= len(password) <= 128:
        raise Error('Use a password of 10–128 characters')
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 200000).hex()
    uid = db.execute('INSERT INTO portal_users(email,name,role,salt,password_hash) VALUES(?,?,?,?,?)', (email,name,role,salt,hashed)).lastrowid
    gym = linked_id(db, data, 'gym_id', 'gyms') if role in ('fighter','coach') else None
    if role in ('fighter','coach') and data.get('gym_code'):
        from portal_features.fighters import lookup_gym
        gym=lookup_gym(db,{'code':data['gym_code']})['gym']['id']
    coach = linked_id(db, data, 'coach_id', 'coaches') if role == 'fighter' else None
    if role=='fighter':
        from portal_features.fighters import resolve_links
        gym,coach=resolve_links(db,{'gym_id':gym,'coach_id':coach})
    if gym and coach:
        linked_gym = one(db, 'SELECT * FROM coaches WHERE id=?', (coach,))['gym_id']
        if linked_gym and linked_gym != gym:
            raise Error('The selected coach belongs to another gym')
    if role == 'gym':
        db.execute('INSERT INTO gyms(owner_id,name,city,join_code) VALUES(?,?,?,?)', (uid,text(data,'organization'),text(data,'city',120,False),secrets.token_hex(4).upper()))
    elif role == 'coach':
        db.execute('INSERT INTO coaches(user_id,gym_id,name) VALUES(?,?,?)', (uid,gym,name))
    elif role == 'promoter':
        db.execute('INSERT INTO promotions(owner_id,name) VALUES(?,?)', (uid,text(data,'organization')))
    elif role == 'fighter':
        aid = create_athlete(db, data)
        db.execute('INSERT INTO fighter_profiles(athlete_id,user_id,gym_id,coach_id,approval_status,legacy_member,created_by) VALUES(?,?,?,?,?,?,?)', (aid,uid,gym,coach,'pending_approval',0,uid))
    return uid

def create_athlete(db, data):
    # Division is optional at registration — admin assigns a weight division on approval
    # if the fighter does not pick one. Falls back to the first supported category.
    raw_div = data.get('division')
    division = category(raw_div) if raw_div else CATEGORIES[0]
    country = text(data,'country',60,required=False) or ''
    class_code = fighter_class(data.get('class_code'))
    martial_art = text(data,'martial_art',120,required=False) or ''
    return db.execute('INSERT INTO athletes(name,division,country,wins,losses,draws,is_sample,class_code,martial_art) VALUES(?,?,?,0,0,0,1,?,?)', (text(data,'name',120),division,country,class_code,martial_art)).lastrowid

def snapshot(db, user):
    # Only the signed-in user (and app admin) sees account email; directories are public profiles.
    result = {'user':user, 'categories':list(CATEGORIES), 'demo_mode':os.environ.get('WUCO_DEMO_MODE',os.environ.get('RFC_DEMO_MODE'))=='1',
        'gyms': rows(db,'SELECT id,name,city FROM gyms'),
        'coaches': rows(db,'SELECT id,name,gym_id FROM coaches'),
        'promotions': rows(db,'SELECT id,name FROM promotions'),
        'fighters': rows(db,'''SELECT a.id,a.name,a.nickname,a.biography,a.portrait_url,a.division,a.country,a.wins,a.losses,a.draws,a.class_code,a.martial_art,
            f.gym_id,f.coach_id,coalesce(f.approval_status,'approved') AS approval_status,CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END AS has_account,
            p.fighter_no
            FROM athletes a LEFT JOIN fighter_profiles f ON f.athlete_id=a.id LEFT JOIN fighter_passports p ON p.athlete_id=a.id ORDER BY a.name'''),
        'events': rows(db,'''SELECT e.*,p.name AS promotion_name,
            (SELECT count(*) FROM event_registrations r WHERE r.event_id=e.id AND r.status='confirmed') AS registered_count
            FROM events e LEFT JOIN promotions p ON p.id=e.promotion_id ORDER BY e.id DESC'''),
        'registrations': rows(db,"SELECT id,event_id,athlete_id,status,registration_ref FROM event_registrations WHERE status='confirmed'"),
        'bouts': rows(db,'SELECT b.*,r.outcome FROM bouts b LEFT JOIN bout_results r ON r.bout_id=b.id ORDER BY b.event_id,b.bout_order,b.id'),
        'rankings': rows(db,'SELECT * FROM rankings WHERE division IN (?,?) ORDER BY division,position',CATEGORIES)}
    if user:
        result['organization'] = rows(db,'SELECT id,name,city,join_code FROM gyms WHERE owner_id=?',(user['id'],)) if user['role']=='gym' else rows(db,'SELECT id,name FROM promotions WHERE owner_id=?',(user['id'],)) if user['role']=='promoter' else rows(db,'SELECT id,name,gym_id FROM coaches WHERE user_id=?',(user['id'],)) if user['role']=='coach' else []
        result['profile'] = rows(db,'SELECT * FROM fighter_profiles WHERE user_id=?',(user['id'],))
        result['managed_events'] = [e['id'] for e in result['events'] if user['role']=='admin' or db.execute('SELECT 1 FROM promotions WHERE id=? AND owner_id=?',(e['promotion_id'],user['id'])).fetchone()]
        result['team'] = [r['athlete_id'] for r in rows(db,'''SELECT f.athlete_id FROM fighter_profiles f
            LEFT JOIN gyms g ON g.id=f.gym_id LEFT JOIN coaches c ON c.id=f.coach_id
            WHERE f.user_id=? OR g.owner_id=? OR c.user_id=?''',(user['id'],)*3)]
        if user['role']=='admin':
            result['users'] = rows(db,'SELECT id,name,email,role FROM portal_users ORDER BY id')
    # Gym membership is private to the member's own gym. No public gym/coach directory.
    if not user:
        result['gyms']=[];result['coaches']=[]
    elif user['role']=='fighter':
        profile=result['profile'][0] if result['profile'] else {}
        gym_id=profile.get('gym_id');coach_id=profile.get('coach_id')
        result['gyms']=[g for g in result['gyms'] if g['id']==gym_id]
        result['coaches']=[c for c in result['coaches'] if c['id']==coach_id or (gym_id and c['gym_id']==gym_id)]
    elif user['role'] in ('gym','coach'):
        own=result['organization'][0] if result['organization'] else {}
        gym_id=own.get('id') if user['role']=='gym' else own.get('gym_id')
        result['gyms']=[g for g in result['gyms'] if g['id']==gym_id]
        result['coaches']=[c for c in result['coaches'] if (gym_id and c['gym_id']==gym_id) or (user['role']=='coach' and c['id']==own.get('id'))]
    from portal_features.events import availability
    for event in result['events']:event['availability']=availability(db,event)
    if user:
        result['my_entries']=rows(db,'''SELECT r.* FROM event_registrations r JOIN fighter_profiles f ON f.athlete_id=r.athlete_id WHERE f.user_id=? OR f.created_by=? ORDER BY r.id DESC''',(user['id'],user['id']))
        result['my_applications']=rows(db,'''SELECT f.*,a.name,a.division FROM fighter_profiles f JOIN athletes a ON a.id=f.athlete_id
            WHERE f.user_id=? OR f.created_by=?''',(user['id'],user['id']))
        if user['role']=='admin':
            from portal_features.applications import overview
            result['applications']=overview(db,user)
            result['pending_approval_count']=sum(a['approval_status']=='pending_approval' for a in result['applications'])
            result['gym_enquiries']=rows(db,'SELECT * FROM gym_enquiries ORDER BY created_at DESC')
            result['notifications']=rows(db,'SELECT * FROM outbound_mail ORDER BY created_at DESC LIMIT 200')
    visible_ids={f['id'] for f in result['fighters'] if f['approval_status']=='approved'}
    visible_ids.update(r['athlete_id'] for r in result['registrations'])
    if user:
        visible_ids.update(result.get('team',[]))
        visible_ids.update(a['athlete_id'] for a in result.get('my_applications',[]))
    if user and user['role']=='admin':visible_ids={f['id'] for f in result['fighters']}
    result['fighters']=[f for f in result['fighters'] if f['id'] in visible_ids]
    result['rankings']=[r for r in result['rankings'] if any(f['id']==r['athlete_id'] and f['approval_status']=='approved' for f in result['fighters'])]
    own_athlete_ids=set(result.get('team',[]))
    for fighter in result['fighters']:
        if (not user or user['role']=='fighter') and fighter['id'] not in own_athlete_ids:
            fighter['gym_id']=None;fighter['coach_id']=None
    return result

def dispatch(db, user, method, path, data):
    if method=='GET' and path=='state':
        return snapshot(db,user)
    parts=path.split('/')
    if method=='POST' and path=='register':
        return {'id':create_user(db,data), 'message':'Account created. Sign in to continue.'}
    if parts[0]=='fighters':
        from portal_features.applications import dispatch as applications_dispatch
        return applications_dispatch(db,user,method,path,data)
    if method=='GET' and parts[0]=='gyms' and len(parts)==2:
        from portal_features.gym_public import public_page
        page = public_page(db, parts[1])
        if page is None:
            raise Error('Gym not found', 404)
        return page
    if method=='POST' and parts[0]=='classes' and len(parts)==3 and parts[2]=='book':
        from portal_features.gym_public import book_class
        return book_class(db, user, number(parts[1]), data)
    if method=='POST' and path=='gym_join/request':
        from portal_features.gym_public import request_join
        return request_join(db, user, data)
    if method=='GET' and path=='gym_join/requests':
        from portal_features.gym_public import list_join_requests
        return list_join_requests(db, user)
    if method=='PUT' and parts[0]=='gym_join' and len(parts)==2:
        from portal_features.gym_public import review_join
        return review_join(db, user, number(parts[1]), data)
    if method=='POST' and path=='gym_enquiries':
        from portal_features.gym_onboarding import submit_enquiry
        return submit_enquiry(db,data)
    if method=='GET' and path=='gym_enquiries':
        from portal_features.gym_onboarding import list_enquiries
        return list_enquiries(db,user)
    if method=='POST' and parts[0]=='gym_enquiries' and len(parts)==3 and parts[2]=='invite':
        from portal_features.gym_onboarding import invite
        return invite(db,user,number(parts[1]))
    if method=='POST' and parts[0]=='gym_enquiries' and len(parts)==3 and parts[2]=='approve':
        from portal_features.gym_onboarding import approve_gym
        return approve_gym(db,user,number(parts[1]),data)
    if method=='POST' and parts[0]=='gym_enquiries' and len(parts)==3 and parts[2]=='reject':
        from portal_features.gym_onboarding import reject_enquiry
        return reject_enquiry(db,user,number(parts[1]),data)
    if method=='POST' and path=='gym_onboarding/lookup':
        from portal_features.gym_onboarding import read_token
        return read_token(db,data.get('token',''))
    if method=='POST' and path=='gym_onboarding/submit':
        from portal_features.gym_onboarding import submit_onboarding
        return submit_onboarding(db,data)
    if method=='POST' and path=='gym/lookup':
        from portal_features.fighters import lookup_gym
        return lookup_gym(db,data)
    if method=='PUT' and path=='profile/photo':
        from portal_features.media import update_photo
        return update_photo(db,user,data)
    if method=='PUT' and path=='profile':
        require(user,'fighter','gym','coach','promoter')
        if user['role']=='fighter':
            from portal_features.fighters import update_profile
            return update_profile(db,user,data)
        from portal_features.organizations import update_profile
        return update_profile(db,user,data)
    if parts[0] in ('events','bouts'):
        from portal_features.events import dispatch_event
        return dispatch_event(db,user,method,path,data)
    if method=='POST' and path=='rankings/import':
        from ranking_excel import import_rankings
        return import_rankings(db,user,data)
    if method=='PUT' and path=='rankings':
        from portal_features.rankings import update_position
        return update_position(db,user,data)
    raise Error('Portal route not found',404)

def handle(db_path, method, path, data=None, cookie='', headers=None, host='localhost'):
    """Return status, JSON payload, response headers; serialize all writes atomically."""
    headers=headers or {}
    extra={}
    try:
        if method not in ('GET','POST','PUT'):
            raise Error('Method not allowed',405)
        if method!='GET':
            if headers.get('X-Requested-With')!='fetch': raise Error('Invalid request origin',403)
            origin=headers.get('Origin')
            if origin and urlsplit(origin).netloc!=host:
                raise Error('Invalid request origin',403)
        if data is None: data={}
        if not isinstance(data,dict): raise Error('Body must be a JSON object')
        with sqlite3.connect(db_path,timeout=15) as db:
            db.row_factory=sqlite3.Row
            db.execute('PRAGMA foreign_keys=ON')
            if method!='GET': db.execute('BEGIN IMMEDIATE')
            cookies=SimpleCookie(cookie)
            token=cookies['wuco_member'].value if 'wuco_member' in cookies else ''
            digest=hashlib.sha256(token.encode()).hexdigest()
            user_row=db.execute('SELECT u.id,u.name,u.email,u.role FROM portal_sessions s JOIN portal_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',(digest,int(time.time()))).fetchone()
            user=dict(user_row) if user_row else None
            if method=='POST' and path=='login':
                email=text(data,'email',254).lower()
                if email in {r+'@demo.rfc.test' for r in ('admin','fighter','promoter','gym','coach')}:email=email.replace('@demo.rfc.test','@demo.wuco.test')
                password=data.get('password','')
                if not isinstance(password,str) or len(password)>128:
                    raise Error('Invalid email or password',401)
                account=db.execute('SELECT * FROM portal_users WHERE email=?',(email,)).fetchone()
                salt=bytes.fromhex(account['salt']) if account else b'0'*16
                hashed=hashlib.pbkdf2_hmac('sha256',password.encode(),salt,200000).hex()
                if not account or not hmac.compare_digest(hashed,account['password_hash']):
                    raise Error('Invalid email or password',401)
                token=secrets.token_urlsafe(32)
                db.execute('DELETE FROM portal_sessions WHERE expires_at<=?',(int(time.time()),))
                db.execute('INSERT INTO portal_sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),account['id'],int(time.time())+28800))
                extra['Set-Cookie']=f'wuco_member={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+ ('; Secure' if headers.get('X-Forwarded-Proto')=='https' else '')
                result={'ok':True}
            elif method=='POST' and path=='logout':
                db.execute('DELETE FROM portal_sessions WHERE token_hash=?',(digest,))
                extra['Set-Cookie']='wuco_member=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
                result={'ok':True}
            elif method=='GET' and path=='rankings/template':
                from ranking_excel import template
                result=template(db,user)
                extra={'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename=WUCO-rankings-template.xlsx'}
            else:
                result=dispatch(db,user,method,path,data)
        return 200,result,extra
    except Error as e:
        return e.status,{'error':str(e)},{}
    except sqlite3.OperationalError as exc:
        if 'locked' in str(exc).lower():return 503,{'error':'The workspace is busy. Please retry in a moment.'},{}
        raise
    except sqlite3.IntegrityError:
        return 409,{'error':'This account, registration or ranking already exists, or a linked record is invalid.'},{}
