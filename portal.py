"""Shared member portal API for the local HTTP and WSGI servers. Standard library only."""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from datetime import datetime
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

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

def owned_event(db, user, event_id):
    require(user, 'promoter', 'admin')
    event = one(db, 'SELECT e.*, p.owner_id FROM events e LEFT JOIN promotions p ON p.id=e.promotion_id WHERE e.id=?', (event_id,))
    if user['role'] != 'admin' and event['owner_id'] != user['id']:
        raise Error('This event belongs to another promoter', 403)
    return event

def linked_id(db, data, key, table):
    value = data.get(key)
    if value in (None, ''):
        return None
    value = number(value)
    one(db, f'SELECT id FROM {table} WHERE id=?', (value,))
    return value

def create_user(db, data, allow_admin=False):
    name, email = text(data, 'name'), text(data, 'email', 254).lower()
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
    coach = linked_id(db, data, 'coach_id', 'coaches') if role == 'fighter' else None
    if gym and coach:
        linked_gym = one(db, 'SELECT * FROM coaches WHERE id=?', (coach,))['gym_id']
        if linked_gym and linked_gym != gym:
            raise Error('The selected coach belongs to another gym')
    if role == 'gym':
        db.execute('INSERT INTO gyms(owner_id,name,city) VALUES(?,?,?)', (uid,text(data,'organization'),text(data,'city',120,False)))
    elif role == 'coach':
        db.execute('INSERT INTO coaches(user_id,gym_id,name) VALUES(?,?,?)', (uid,gym,name))
    elif role == 'promoter':
        db.execute('INSERT INTO promotions(owner_id,name) VALUES(?,?)', (uid,text(data,'organization')))
    elif role == 'fighter':
        aid = create_athlete(db, data)
        db.execute('INSERT INTO fighter_profiles(athlete_id,user_id,gym_id,coach_id) VALUES(?,?,?,?)', (aid,uid,gym,coach))
    return uid

def create_athlete(db, data):
    division, country = text(data,'division',60), text(data,'country',60)
    return db.execute('INSERT INTO athletes(name,division,country,wins,losses,draws,is_sample) VALUES(?,?,?,0,0,0,1)', (text(data,'name',120),division,country)).lastrowid

def snapshot(db, user):
    # Only the signed-in user (and app admin) sees account email; directories are public profiles.
    result = {'user':user, 'demo_mode':os.environ.get('RFC_DEMO_MODE')=='1',
        'gyms': rows(db,'SELECT id,name,city FROM gyms'),
        'coaches': rows(db,'SELECT id,name,gym_id FROM coaches'),
        'promotions': rows(db,'SELECT id,name FROM promotions'),
        'fighters': rows(db,'''SELECT a.id,a.name,a.division,a.country,a.wins,a.losses,a.draws,
            f.gym_id,f.coach_id,CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END AS has_account
            FROM athletes a LEFT JOIN fighter_profiles f ON f.athlete_id=a.id ORDER BY a.name'''),
        'events': rows(db,'''SELECT e.*,p.name AS promotion_name,
            (SELECT count(*) FROM event_registrations r WHERE r.event_id=e.id) AS registered_count
            FROM events e LEFT JOIN promotions p ON p.id=e.promotion_id ORDER BY e.id DESC'''),
        'registrations': rows(db,'SELECT event_id,athlete_id FROM event_registrations'),
        'bouts': rows(db,'SELECT b.*,r.outcome FROM bouts b LEFT JOIN bout_results r ON r.bout_id=b.id ORDER BY b.event_id,b.bout_order,b.id'),
        'rankings': rows(db,'SELECT * FROM rankings ORDER BY division,position')}
    if user:
        result['organization'] = rows(db,'SELECT id,name,city FROM gyms WHERE owner_id=?',(user['id'],)) if user['role']=='gym' else rows(db,'SELECT id,name FROM promotions WHERE owner_id=?',(user['id'],)) if user['role']=='promoter' else rows(db,'SELECT id,name,gym_id FROM coaches WHERE user_id=?',(user['id'],)) if user['role']=='coach' else []
        result['profile'] = rows(db,'SELECT * FROM fighter_profiles WHERE user_id=?',(user['id'],))
        result['managed_events'] = [e['id'] for e in result['events'] if user['role']=='admin' or db.execute('SELECT 1 FROM promotions WHERE id=? AND owner_id=?',(e['promotion_id'],user['id'])).fetchone()]
        result['team'] = [r['athlete_id'] for r in rows(db,'''SELECT f.athlete_id FROM fighter_profiles f
            LEFT JOIN gyms g ON g.id=f.gym_id LEFT JOIN coaches c ON c.id=f.coach_id
            WHERE f.user_id=? OR g.owner_id=? OR c.user_id=?''',(user['id'],)*3)]
        if user['role']=='admin':
            result['users'] = rows(db,'SELECT id,name,email,role FROM portal_users ORDER BY id')
    return result

def event_data(data):
    clean = {'title':text(data,'title'), 'subtitle':text(data,'subtitle'), 'venue':text(data,'venue',160,False),
             'city':text(data,'city',120,False), 'description':text(data,'description',4000,False)}
    clean['status'] = data.get('status','Upcoming')
    if clean['status'] not in ('Upcoming','Past'):
        raise Error('Invalid event status')
    clean['timezone'] = text(data,'timezone',60)
    try:
        ZoneInfo(clean['timezone'])
    except ZoneInfoNotFoundError:
        raise Error('Choose a valid IANA timezone')
    starts = text(data,'starts_at',40,False)
    if starts:
        try:
            datetime.fromisoformat(starts)
        except ValueError:
            raise Error('Enter a valid event date/time')
    clean['starts_at'] = starts or None
    if data.get('registration_open',0) not in (0,1):
        raise Error('Invalid registration setting')
    clean['registration_open'] = int(data.get('registration_open',0))
    return clean

def record_result(db, user, bout_id, data):
    bout = one(db,'SELECT * FROM bouts WHERE id=?',(bout_id,))
    owned_event(db,user,bout['event_id'])
    outcome = data.get('outcome')
    if outcome not in ('red','blue','draw','no_contest'):
        raise Error('Choose red, blue, draw or no contest')
    method = text(data,'method',60)
    round_no = number(data.get('round'))
    if round_no > 12:
        raise Error('Round must be 1–12')
    clock = text(data,'time',5)
    if not re.fullmatch(r'[0-5][0-9]:[0-5][0-9]',clock):
        raise Error('Time must be MM:SS')
    prior = db.execute('SELECT outcome FROM bout_results WHERE bout_id=?',(bout_id,)).fetchone()
    if not prior and (bout['winner_id'] is not None or bout['result_method']):
        raise Error('Legacy result needs admin reconciliation before editing',409)
    def apply(result, direction):
        for corner, aid in [('red',bout['red_athlete_id']),('blue',bout['blue_athlete_id'])]:
            column = 'draws' if result=='draw' else 'wins' if result==corner else 'losses'
            if result != 'no_contest':
                db.execute(f'UPDATE athletes SET {column}={column}+? WHERE id=?',(direction,aid))
    if prior:
        apply(prior['outcome'],-1)
    apply(outcome,1)
    winner = bout['red_athlete_id'] if outcome=='red' else bout['blue_athlete_id'] if outcome=='blue' else None
    db.execute('UPDATE bouts SET winner_id=?,result_method=?,result_round=?,result_time=? WHERE id=?',(winner,method,round_no,clock,bout_id))
    db.execute('INSERT INTO bout_results(bout_id,outcome,updated_by) VALUES(?,?,?) ON CONFLICT(bout_id) DO UPDATE SET outcome=excluded.outcome,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP',(bout_id,outcome,user['id']))
    db.execute('INSERT INTO result_audit(bout_id,user_id,previous_result,new_result) VALUES(?,?,?,?)',(bout_id,user['id'], json.dumps(dict(bout, outcome=prior['outcome'] if prior else None)),json.dumps(data)))
    return {'ok':True}

def dispatch(db, user, method, path, data):
    if method=='GET' and path=='state':
        return snapshot(db,user)
    parts=path.split('/')
    if method=='POST' and path=='register':
        return {'id':create_user(db,data), 'message':'Account created. Sign in to continue.'}
    if method=='PUT' and path=='profile':
        require(user,'fighter','gym','coach','promoter')
        if user['role'] in ('fighter','coach'):
            gym=linked_id(db,data,'gym_id','gyms')
            if user['role']=='fighter':
                coach=linked_id(db,data,'coach_id','coaches')
                if gym and coach:
                    affiliation=one(db,'SELECT gym_id FROM coaches WHERE id=?',(coach,))['gym_id']
                    if affiliation and affiliation!=gym: raise Error('The selected coach belongs to another gym')
                db.execute('UPDATE fighter_profiles SET gym_id=?,coach_id=? WHERE user_id=?',(gym,coach,user['id']))
            else:
                db.execute('UPDATE coaches SET gym_id=? WHERE user_id=?',(gym,user['id']))
        elif user['role']=='gym':
            db.execute('UPDATE gyms SET name=?,city=? WHERE owner_id=?',(text(data,'organization'),text(data,'city',120,False),user['id']))
        else:
            db.execute('UPDATE promotions SET name=? WHERE owner_id=?',(text(data,'organization'),user['id']))
        return {'ok':True}
    if method=='POST' and path=='events':
        require(user,'promoter','admin')
        clean=event_data(data)
        if user['role']=='promoter':
            promotion=one(db,'SELECT id FROM promotions WHERE owner_id=?',(user['id'],))['id']
        else:
            promotion=number(data.get('promotion_id'))
            one(db,'SELECT id FROM promotions WHERE id=?',(promotion,))
        keys=list(clean)+['promotion_id']
        eid=db.execute(f'INSERT INTO events({",".join(keys)}) VALUES({",".join("?" for _ in keys)})',(*clean.values(),promotion)).lastrowid
        return {'id':eid}
    if method=='PUT' and len(parts)==2 and parts[0]=='events':
        eid=number(parts[1]); owned_event(db,user,eid)
        clean=event_data(data)
        db.execute(f'UPDATE events SET {",".join(k+"=?" for k in clean)} WHERE id=?',(*clean.values(),eid))
        return {'ok':True}
    if method=='POST' and len(parts)==3 and parts[0]=='events' and parts[2]=='register':
        eid=number(parts[1])
        event=one(db,'SELECT * FROM events WHERE id=?',(eid,))
        require(user,'admin','promoter','fighter','gym','coach')
        if not event['registration_open'] or event['status']!='Upcoming':
            raise Error('Registration is closed',409)
        if user['role'] in ('promoter','admin'):
            owned_event(db,user,eid)
            if data.get('outside') is True:
                aid=create_athlete(db,data)
                db.execute('INSERT INTO fighter_profiles(athlete_id) VALUES(?)',(aid,))
            else:
                aid=number(data.get('athlete_id'))
        else:
            aid=number(data.get('athlete_id'))
            if aid not in snapshot(db,user)['team']:
                raise Error('Only register yourself or your affiliated fighters',403)
        one(db,'SELECT id FROM athletes WHERE id=?',(aid,))
        db.execute('INSERT INTO event_registrations(event_id,athlete_id,added_by) VALUES(?,?,?)',(eid,aid,user['id']))
        return {'athlete_id':aid}
    if method=='POST' and len(parts)==3 and parts[0]=='events' and parts[2]=='bouts':
        eid=number(parts[1]); owned_event(db,user,eid)
        red,blue=number(data.get('red_athlete_id')),number(data.get('blue_athlete_id'))
        if red==blue: raise Error('Choose two different fighters')
        for aid in (red,blue):
            if not db.execute('SELECT 1 FROM event_registrations WHERE event_id=? AND athlete_id=?',(eid,aid)).fetchone():
                raise Error('Both fighters must be registered for this event')
            if db.execute('SELECT 1 FROM bouts WHERE event_id=? AND (red_athlete_id=? OR blue_athlete_id=?)',(eid,aid,aid)).fetchone():
                raise Error('A fighter is already on this event card',409)
        division=text(data,'division',60)
        section=data.get('card_section','Main card')
        if section not in ('Main card','Preliminary card'): raise Error('Invalid card section')
        order=db.execute('SELECT coalesce(max(bout_order),0)+1 FROM bouts WHERE event_id=?',(eid,)).fetchone()[0]
        bid=db.execute('INSERT INTO bouts(event_id,red_athlete_id,blue_athlete_id,division,card_section,bout_order) VALUES(?,?,?,?,?,?)',(eid,red,blue,division,section,order)).lastrowid
        return {'id':bid}
    if method=='PUT' and len(parts)==3 and parts[0]=='bouts' and parts[2]=='result':
        return record_result(db,user,number(parts[1]),data)
    if method=='POST' and path=='rankings/import':
        from ranking_excel import import_rankings
        return import_rankings(db,user,data)
    if method=='PUT' and path=='rankings':
        require(user,'admin')
        aid,position=number(data.get('athlete_id')),number(data.get('position'))
        athlete=one(db,'SELECT * FROM athletes WHERE id=?',(aid,))
        division=athlete['division']
        current=rows(db,'SELECT * FROM rankings WHERE division=? ORDER BY position',(division,))
        ordered=[r['athlete_id'] for r in current if r['athlete_id']!=aid]
        if position>len(ordered)+1: raise Error('Choose a position within the division ranking')
        ordered.insert(position-1,aid)
        prior={r['athlete_id']:r['position'] for r in current}
        db.execute('DELETE FROM rankings WHERE division=?',(division,))
        for rank,fid in enumerate(ordered,1):
            db.execute('INSERT INTO rankings(division,athlete_id,position,movement,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)',(division,fid,rank,prior.get(fid,rank)-rank))
        return {'ok':True}
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
            token=cookies['rfc_member'].value if 'rfc_member' in cookies else ''
            digest=hashlib.sha256(token.encode()).hexdigest()
            user_row=db.execute('SELECT u.id,u.name,u.email,u.role FROM portal_sessions s JOIN portal_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',(digest,int(time.time()))).fetchone()
            user=dict(user_row) if user_row else None
            if method=='POST' and path=='login':
                email=text(data,'email',254).lower()
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
                extra['Set-Cookie']=f'rfc_member={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+ ('; Secure' if headers.get('X-Forwarded-Proto')=='https' else '')
                result={'ok':True}
            elif method=='POST' and path=='logout':
                db.execute('DELETE FROM portal_sessions WHERE token_hash=?',(digest,))
                extra['Set-Cookie']='rfc_member=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
                result={'ok':True}
            elif method=='GET' and path=='rankings/template':
                from ranking_excel import template
                result=template(db,user)
                extra={'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename=RFC-rankings-template.xlsx'}
            else:
                result=dispatch(db,user,method,path,data)
        return 200,result,extra
    except Error as e:
        return e.status,{'error':str(e)},{}
    except sqlite3.IntegrityError:
        return 409,{'error':'This account, registration or ranking already exists, or a linked record is invalid.'},{}
