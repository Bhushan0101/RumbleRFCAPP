"""Promotion-owned events, participant entries, published cards and result accounting."""
import json
import re
from datetime import datetime,timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from portal import Error,one,require,number,text,create_athlete,snapshot
from .categories import category

def owned_event(db, user, event_id):
    require(user, 'promoter', 'admin')
    event = one(db, 'SELECT e.*, p.owner_id FROM events e LEFT JOIN promotions p ON p.id=e.promotion_id WHERE e.id=?', (event_id,))
    if user['role'] != 'admin' and event['owner_id'] != user['id']:
        raise Error('This event belongs to another promoter', 403)
    return event

def event_data(data):
    clean={'title':text(data,'title'),'subtitle':text(data,'subtitle'),'venue':text(data,'venue',160,False),
        'city':text(data,'city',120,False),'description':text(data,'description',4000,False)}
    clean['status']=data.get('status','Upcoming')
    if clean['status'] not in ('Upcoming','Past'):raise Error('Invalid event status')
    clean['timezone']=text(data,'timezone',60)
    try:ZoneInfo(clean['timezone'])
    except ZoneInfoNotFoundError:raise Error('Choose a valid IANA timezone')
    for key in ('starts_at','registration_closes_at'):
        value=text(data,key,40,False)
        if value:
            try:datetime.fromisoformat(value)
            except ValueError:raise Error('Enter a valid date and time')
        clean[key]=value or None
    if data.get('registration_open',0) not in (0,1):raise Error('Invalid registration setting')
    clean['registration_open']=int(data.get('registration_open',0))
    capacity=data.get('capacity')
    clean['capacity']=number(capacity) if capacity not in ('',None) else None
    if clean['capacity'] and clean['capacity']>10000:raise Error('Capacity must be at most 10,000 fighters')
    categories=data.get('categories',list(('Featherweight','Lightweight')))
    if isinstance(categories,str):
        try:categories=json.loads(categories)
        except ValueError:raise Error('Choose valid event categories')
    if not isinstance(categories,list) or not categories or any(c not in ('Featherweight','Lightweight') for c in categories):raise Error('Choose at least one supported event category')
    clean['categories']=json.dumps(list(dict.fromkeys(categories)))
    return clean

def event_instant(value,zone):
    moment=datetime.fromisoformat(value)
    if moment.tzinfo is None:moment=moment.replace(tzinfo=ZoneInfo(zone))
    return moment.astimezone(timezone.utc)

def availability(db,event):
    count=db.execute("SELECT count(*) FROM event_registrations WHERE event_id=? AND status='confirmed'",(event['id'],)).fetchone()[0]
    reason=''
    if event['status']!='Upcoming':reason='This event has finished.'
    elif not event['registration_open']:reason='Registration is closed.'
    elif event.get('starts_at') and event_instant(event['starts_at'],event['timezone'])<=datetime.now(timezone.utc):reason='This event has already started.'
    elif event.get('registration_closes_at') and event_instant(event['registration_closes_at'],event['timezone'])<=datetime.now(timezone.utc):reason='The registration deadline has passed.'
    elif event.get('capacity') and count>=event['capacity']:reason='This event is full.'
    return {'open':not bool(reason),'reason':reason,'remaining':max(0,event['capacity']-count) if event.get('capacity') else None,'registered_count':count}

def entry_authorized(db,user,eid,aid):
    require(user,'admin','promoter','fighter','gym','coach')
    if user['role'] in ('promoter','admin'):owned_event(db,user,eid)
    elif aid not in snapshot(db,user)['team']:raise Error('Only register yourself or your affiliated fighters',403)

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

def dispatch_event(db,user,method,path,data):
    parts=path.split('/')
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
        from .applications import require_approved
        eid=number(parts[1]);event=one(db,'SELECT * FROM events WHERE id=?',(eid,))
        require(user,'admin','promoter','fighter','gym','coach')
        available=availability(db,event)
        if not available['open']:raise Error(available['reason'],409)
        if data.get('outside') is True:
            owned_event(db,user,eid)
            aid=create_athlete(db,data)
            db.execute("INSERT INTO fighter_profiles(athlete_id,approval_status,legacy_member,created_by) VALUES(?,'pending_approval',0,?)",(aid,user['id']))
            db.execute("INSERT INTO application_audit(athlete_id,actor_id,action) VALUES(?,?,'guest_application_created')",(aid,user['id']))
            return {'athlete_id':aid,'application_pending':True,'message':'Guest application created. Obtain administrator approval before adding the entry.'}
        aid=number(data.get('athlete_id'));entry_authorized(db,user,eid,aid)
        require_approved(db,aid)
        athlete=one(db,'SELECT division FROM athletes WHERE id=?',(aid,))
        if athlete['division'] not in json.loads(event['categories']):raise Error('This event does not accept the fighter category',409)
        if data.get('acknowledged') is not True:raise Error('Confirm the event registration details first')
        existing=db.execute('SELECT * FROM event_registrations WHERE event_id=? AND athlete_id=?',(eid,aid)).fetchone()
        if existing and existing['status']=='confirmed':raise Error('This fighter is already registered',409)
        if existing:
            rid=existing['id'];reference=existing['registration_ref']
            db.execute("UPDATE event_registrations SET status='confirmed',added_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",(user['id'],rid))
        else:
            import secrets
            reference='WUCO-E'+str(eid)+'-'+secrets.token_hex(4).upper()
            rid=db.execute('INSERT INTO event_registrations(event_id,athlete_id,added_by,registration_ref) VALUES(?,?,?,?)',(eid,aid,user['id'],reference)).lastrowid
        db.execute("INSERT INTO event_entry_audit(registration_id,actor_id,action) VALUES(?,?,'confirmed')",(rid,user['id']))
        return {'athlete_id':aid,'registration_ref':reference,'status':'confirmed'}
    if method=='POST' and len(parts)==3 and parts[0]=='events' and parts[2]=='withdraw':
        eid=number(parts[1]);aid=number(data.get('athlete_id'));entry_authorized(db,user,eid,aid)
        event=one(db,'SELECT * FROM events WHERE id=?',(eid,))
        if event['status']!='Upcoming':raise Error('A past event entry cannot be withdrawn',409)
        if db.execute('SELECT 1 FROM bouts WHERE event_id=? AND (red_athlete_id=? OR blue_athlete_id=?)',(eid,aid,aid)).fetchone():raise Error('Contact the promoter to withdraw a fighter already assigned to a bout',409)
        entry=one(db,'SELECT * FROM event_registrations WHERE event_id=? AND athlete_id=?',(eid,aid))
        if entry['status']!='confirmed':raise Error('This entry is not currently confirmed',409)
        db.execute("UPDATE event_registrations SET status='withdrawn',updated_at=CURRENT_TIMESTAMP WHERE id=?",(entry['id'],))
        db.execute("INSERT INTO event_entry_audit(registration_id,actor_id,action) VALUES(?,?,'withdrawn')",(entry['id'],user['id']))
        return {'ok':True,'status':'withdrawn'}
    if method=='POST' and len(parts)==3 and parts[0]=='events' and parts[2]=='bouts':
        eid=number(parts[1]); owned_event(db,user,eid)
        red,blue=number(data.get('red_athlete_id')),number(data.get('blue_athlete_id'))
        if red==blue: raise Error('Choose two different fighters')
        for aid in (red,blue):
            from .applications import require_approved
            require_approved(db,aid)
            if not db.execute("SELECT 1 FROM event_registrations WHERE event_id=? AND athlete_id=? AND status='confirmed'",(eid,aid)).fetchone():
                raise Error('Both fighters must be registered for this event')
            if db.execute('SELECT 1 FROM bouts WHERE event_id=? AND (red_athlete_id=? OR blue_athlete_id=?)',(eid,aid,aid)).fetchone():
                raise Error('A fighter is already on this event card',409)
        division=category(data.get('division'))
        if any(one(db,'SELECT division FROM athletes WHERE id=?',(aid,))['division']!=division for aid in (red,blue)):raise Error('Both fighters must match the bout category')
        section=data.get('card_section','Main card')
        if section not in ('Main card','Preliminary card'): raise Error('Invalid card section')
        order=db.execute('SELECT coalesce(max(bout_order),0)+1 FROM bouts WHERE event_id=?',(eid,)).fetchone()[0]
        bid=db.execute('INSERT INTO bouts(event_id,red_athlete_id,blue_athlete_id,division,card_section,bout_order) VALUES(?,?,?,?,?,?)',(eid,red,blue,division,section,order)).lastrowid
        return {'id':bid}
    if method=='PUT' and len(parts)==3 and parts[0]=='bouts' and parts[2]=='result':
        return record_result(db,user,number(parts[1]),data)
    raise Error('Event route not found',404)
