"""Explicit, idempotent LOCAL demo provisioning. Never run against a production database."""
import sqlite3
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import portal
from scripts import init_db, migrate
PASSWORD='WucoDemo2026!'

def seed(path):
    with sqlite3.connect(path) as db:
        db.row_factory=sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        # Existing demo users/data are preserved; rerunning never resets passwords or results.
        for role,name in [('admin','Demo App Admin'),('gym','Demo Emerald Gym'),('coach','Demo Casey Coach'),('promoter','Demo Pat Promoter'),('fighter','Demo Alex Fighter')]:
            email=role+'@demo.wuco.test'
            existing_user=db.execute('SELECT * FROM portal_users WHERE email=?',(email,)).fetchone()
            if existing_user:
                import hashlib,hmac,secrets
                legacy=hashlib.pbkdf2_hmac('sha256',b'RfcDemo2026!',bytes.fromhex(existing_user['salt']),200000).hex()
                if hmac.compare_digest(legacy,existing_user['password_hash']):
                    salt=secrets.token_bytes(16)
                    hashed=hashlib.pbkdf2_hmac('sha256',PASSWORD.encode(),salt,200000).hex()
                    db.execute('UPDATE portal_users SET salt=?,password_hash=? WHERE id=?',(salt.hex(),hashed,existing_user['id']))
                continue
            data={'email':email,'name':name,'password':PASSWORD,'role':role,'organization':'Demo Emerald Gym' if role=='gym' else 'Demo W.U.C.O Promotions','city':'Dublin','division':'Lightweight','country':'Ireland'}
            if role in ('coach','fighter'):
                data['gym_id']=db.execute("SELECT g.id FROM gyms g JOIN portal_users u ON u.id=g.owner_id WHERE u.email='gym@demo.wuco.test'").fetchone()[0]
            if role=='fighter':
                data['coach_id']=db.execute("SELECT c.id FROM coaches c JOIN portal_users u ON u.id=c.user_id WHERE u.email='coach@demo.wuco.test'").fetchone()[0]
            uid=portal.create_user(db,data,allow_admin=True)
            if role=='fighter':db.execute("UPDATE fighter_profiles SET approval_status='approved',legacy_member=1 WHERE user_id=?",(uid,))
        promoter=dict(db.execute("SELECT id,name,email,role FROM portal_users WHERE email='promoter@demo.wuco.test'").fetchone())
        promotion=db.execute('SELECT id FROM promotions WHERE owner_id=?',(promoter['id'],)).fetchone()[0]
        existing=db.execute("SELECT id FROM events WHERE title='W.U.C.O Demo · First Bell' AND promotion_id=?",(promotion,)).fetchone()
        if not existing:
            event=portal.dispatch(db,promoter,'POST','events',{'title':'W.U.C.O Demo · First Bell','subtitle':'Connected portal showcase','timezone':'Europe/Dublin','venue':'Sample Arena','city':'Dublin','description':'Dummy event: connected fighter, gym and coach versus a guest competitor. No real event is announced.','registration_open':1})['id']
            fighter=db.execute("SELECT f.athlete_id FROM fighter_profiles f JOIN portal_users u ON u.id=f.user_id WHERE u.email='fighter@demo.wuco.test'").fetchone()[0]
            portal.dispatch(db,promoter,'POST',f'events/{event}/register',{'athlete_id':fighter,'acknowledged':True})
            guest=portal.create_athlete(db,{'name':'Demo Jordan Guest','division':'Lightweight','country':'United Kingdom'})
            db.execute("INSERT INTO fighter_profiles(athlete_id,created_by,approval_status,legacy_member) VALUES(?,?,'approved',1)",(guest,promoter['id']))
            portal.dispatch(db,promoter,'POST',f'events/{event}/register',{'athlete_id':guest,'acknowledged':True})
            portal.dispatch(db,promoter,'POST',f'events/{event}/bouts',{'red_athlete_id':fighter,'blue_athlete_id':guest,'division':'Lightweight'})
    print('Demo portal seeded; existing accounts and results preserved.')
    print('Accounts: admin / promoter / fighter / gym / coach @demo.wuco.test')
    print('Public LOCAL demo password: '+PASSWORD)

def seed_if_enabled(path):
    import os
    if os.environ.get('WUCO_DEMO_MODE',os.environ.get('RFC_DEMO_MODE'))=='1':
        seed(path)

if __name__=='__main__':
    if '--local-demo' not in sys.argv:
        raise SystemExit('Explicit opt-in required: python scripts/seed_portal_demo.py --local-demo (never on production)')
    if not init_db.DB.exists():
        raise SystemExit('Initialize a local database first. Set RFC_DB_PATH to an isolated development copy.')
    migrate.run(init_db.DB)
    seed(init_db.DB)
