"""Useful local checks without external packages or changing the delivered DB."""
import json
import sqlite3
import sys
import tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import scripts.init_db as init
from scripts import migrate
from server import get_content, validate, Invalid, sniff_image_ext

with tempfile.TemporaryDirectory() as tmp:
    previous=init.DB
    init.DB=Path(tmp)/'test.sqlite3'
    init.initialize()
    migrate.run(init.DB)
    with sqlite3.connect(init.DB) as db:
        before=db.execute('SELECT count(*) FROM athletes').fetchone()[0]
        db.execute("UPDATE athletes SET name='Preserved edit' WHERE id=1")
    init.initialize()
    migrate.run(init.DB)
    with sqlite3.connect(init.DB) as db:
        assert db.execute('SELECT count(*) FROM athletes').fetchone()[0]==before==8
        assert db.execute('SELECT name FROM athletes WHERE id=1').fetchone()[0]=='Preserved edit'
        assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
        assert db.execute('PRAGMA user_version').fetchone()[0]==4
        assert db.execute("SELECT count(*) FROM sqlite_master WHERE name IN('gallery_items','sessions')").fetchone()[0]==2
        assert db.execute('SELECT count(*) FROM gallery_items').fetchone()[0]==8
        assert 'cartoon_url' in [r[1] for r in db.execute('PRAGMA table_info(athletes)')]
    init.DB=previous

content=get_content()
assert len(content['athletes'])>=8 and len(content['events'])>=3 and len(content['stories'])==5
assert {'name','nick','division','country','record','cartoon_url'} <= content['athletes'][0].keys()
assert {'title','sub','status'} <= content['events'][0].keys()
assert len(content['gallery_items'])==8
assert {'platform','kind','title','url'} <= content['gallery_items'][0].keys()
assert {'instagram_url','youtube_url','gallery_enabled','news_enabled'} <= content['settings'].keys()
static_content=json.loads((ROOT/'public/data/content.json').read_text())
assert {'athletes','events','stories','settings'} <= static_content.keys()
assert len(static_content['athletes'])>=8 and len(static_content['events'])>=3
# Live content can change through the portal; exact export parity is an explicit check.
if '--check-static-export' in sys.argv:
    assert static_content==content, 'Static export is stale; run scripts/export_content.py deliberately before static deployment'

# Validation guards: reject a javascript: URL and a bad enum before any write reaches SQL.
try:
    validate('gallery_items',{'platform':'instagram','kind':'reel','title':'x','url':'javascript:alert(1)'})
    raise AssertionError('javascript: URL should have been rejected')
except Invalid: pass
try:
    validate('gallery_items',{'platform':'tiktok','kind':'reel','title':'x','url':'https://example.com'})
    raise AssertionError('bad platform enum should have been rejected')
except Invalid: pass
# Upload image sniffing: accept PNG magic, reject arbitrary/script bytes.
assert sniff_image_ext(b'\x89PNG\r\n\x1a\n'+b'\x00'*16)=='png'
assert sniff_image_ext(b'<script>alert(1)</script>') is None

required=['public/index.html','public/style.css','public/app.js','public/admin.html','public/admin.js',
          'public/assets/arena.webp','public/assets/rfc-brand.png','CLAUDE.md','docs/INSTAGRAM.md',
          'scripts/migrate.py','scripts/migrations/002_gallery.sql','scripts/migrations/003_athlete_cartoon.sql',
          'scripts/set_admin_password.py']
for f in required:
    assert (ROOT/f).is_file(),f
assert not (ROOT/'public/admin_config.json').exists(),'admin_config.json must never live under public/'

print('PASS: integrity, foreign keys, migration to v4, seed idempotence/edit preservation, '
      'athlete cartoon column, gallery content, feature flags, API contract, URL/enum/image validation, '
      'static fallback structure and required files.')
