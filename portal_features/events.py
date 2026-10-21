"""Promotion-owned events, participant entries, published cards and result accounting."""
import json
import re
from datetime import datetime
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
        division=category(data.get('division'))
        section=data.get('card_section','Main card')
        if section not in ('Main card','Preliminary card'): raise Error('Invalid card section')
        order=db.execute('SELECT coalesce(max(bout_order),0)+1 FROM bouts WHERE event_id=?',(eid,)).fetchone()[0]
        bid=db.execute('INSERT INTO bouts(event_id,red_athlete_id,blue_athlete_id,division,card_section,bout_order) VALUES(?,?,?,?,?,?)',(eid,red,blue,division,section,order)).lastrowid
        return {'id':bid}
    if method=='PUT' and len(parts)==3 and parts[0]=='bouts' and parts[2]=='result':
        return record_result(db,user,number(parts[1]),data)
    raise Error('Event route not found',404)
