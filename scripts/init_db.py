"""Create and seed the local database without replacing existing content."""
import json
import sqlite3
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'database' / 'rfc.sqlite3'
def initialize():
    with sqlite3.connect(DB) as db:
        db.execute('PRAGMA foreign_keys=ON')
        prior = db.execute('PRAGMA user_version').fetchone()[0]
        db.executescript((ROOT / 'database' / 'schema.sql').read_text())
        # schema.sql ends with PRAGMA user_version=1 (the v1 baseline). On an already-migrated
        # database, keep the higher version so scripts/migrate.py does not re-run migrations.
        if prior > 1:
            db.execute(f'PRAGMA user_version = {prior}')
        data = json.loads((ROOT / 'database' / 'seed.json').read_text())
        for i, a in enumerate(data['athletes']):
            record = [int(v) for v in a['record'].split('–')]
            db.execute('INSERT OR IGNORE INTO athletes(id,name,nickname,division,country,wins,losses,draws,display_order) VALUES(?,?,?,?,?,?,?,?,?)', (i+1,a['name'],a['nick'],a['division'],a['country'],*record,i))
        for i, e in enumerate(data['events']):
            db.execute('INSERT OR IGNORE INTO events(id,title,subtitle,status,poster_url,display_order) VALUES(?,?,?,?,?,?)',(i+1,e['title'],e['sub'],e['status'],'assets/arena.webp',i))
        for i, s in enumerate(data['stories']):
            db.execute('INSERT OR IGNORE INTO stories(id,title,type,body,image_url,display_order) VALUES(?,?,?,?,?,?)',(i+1,s['title'],s['type'],s['body'],'assets/arena.webp',i))
        for division in ['Featherweight','Lightweight','Welterweight']:
            rows=db.execute('SELECT id FROM athletes WHERE division=? ORDER BY display_order,id',(division,)).fetchall()
            for rank,(athlete_id,) in enumerate(rows,1):
                db.execute('INSERT OR IGNORE INTO rankings(division,athlete_id,position) VALUES(?,?,?)',(division,athlete_id,rank))
        for key,value in {'brand_name':'RFC — Rumble Fighting Championship','primary_color':'#123c2b','accent_color':'#c7a461','content_mode':'sample','schema_version':'1'}.items():
            db.execute('INSERT OR IGNORE INTO site_settings(key,value) VALUES(?,?)',(key,value))
    print(f'Database ready: {DB}')
if __name__=='__main__':
    if len(sys.argv)>1:
        raise SystemExit('No reset option. Back up the database before making manual changes.')
    initialize()
