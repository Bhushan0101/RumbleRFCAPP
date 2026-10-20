"""RFC local development server. Python 3.10+, standard library only.

Serves public/ statically plus a read-only JSON content API and an OPTIONAL,
authentication-gated admin write API under /api/admin/*. The admin API stays disabled
(returns 503) until a local admin password is configured via scripts/set_admin_password.py
(or the RFC_ADMIN_PASSWORD_HASH / RFC_ADMIN_SALT environment variables).

LOCAL DEVELOPMENT ONLY. The server binds to 127.0.0.1. Do not expose it publicly.
"""
import argparse
import csv
import hashlib
import hmac
import io
import json
import os
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from scripts.init_db import DB, initialize
from scripts import migrate
ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
ADMIN_CONFIG = ROOT / 'admin_config.json'
SESSION_HOURS = 8
UPLOAD_DIR = PUBLIC / 'assets' / 'athletes'
MAX_UPLOAD = 6 * 1024 * 1024  # 6 MB. PNG keeps transparency for cut-out portraits.

# ---------------------------------------------------------------------------
# Content reads (unchanged contract: read-only connection)
# ---------------------------------------------------------------------------
def get_content():
    with sqlite3.connect(f'{DB.as_uri()}?mode=ro',uri=True) as db:
        db.row_factory=sqlite3.Row
        result={}
        result['athletes']=[]
        for row in db.execute('SELECT * FROM athletes ORDER BY display_order,id'):
            a=dict(row)
            a.update(nick=a['nickname'],record=f"{a['wins']}–{a['losses']}–{a['draws']}")
            result['athletes'].append(a)
        result['events']=[]
        for row in db.execute('SELECT * FROM events ORDER BY display_order,id'):
            e=dict(row);e['sub']=e['subtitle'];result['events'].append(e)
        result['stories']=[dict(row) for row in db.execute('SELECT * FROM stories ORDER BY display_order,id')]
        result['gallery_items']=[dict(row) for row in db.execute('SELECT * FROM gallery_items ORDER BY display_order,id')]
        for name in ['rankings','bouts','achievements','media_items','sponsors']:
            result[name]=[dict(row) for row in db.execute(f'SELECT * FROM {name} ORDER BY id')]
        result['settings']={row['key']:row['value'] for row in db.execute('SELECT * FROM site_settings')}
        return result

def schema_version():
    with sqlite3.connect(f'{DB.as_uri()}?mode=ro',uri=True) as db:
        return db.execute('PRAGMA user_version').fetchone()[0]

def rw_conn():
    c=sqlite3.connect(DB)
    c.row_factory=sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c

# ---------------------------------------------------------------------------
# Admin auth (optional, disabled until a password is configured)
# ---------------------------------------------------------------------------
def admin_credentials():
    """Return (salt_bytes, hash_bytes, iterations) or None if admin is not configured."""
    env_hash=os.environ.get('RFC_ADMIN_PASSWORD_HASH')
    env_salt=os.environ.get('RFC_ADMIN_SALT')
    if env_hash and env_salt:
        return bytes.fromhex(env_salt),bytes.fromhex(env_hash),int(os.environ.get('RFC_ADMIN_ITERATIONS','200000'))
    if ADMIN_CONFIG.is_file():
        cfg=json.loads(ADMIN_CONFIG.read_text())
        return bytes.fromhex(cfg['salt']),bytes.fromhex(cfg['hash']),int(cfg['iterations'])
    return None

def verify_password(password):
    creds=admin_credentials()
    if not creds:
        return None  # admin not configured
    salt,expected,iterations=creds
    got=hashlib.pbkdf2_hmac('sha256',password.encode(),salt,iterations)
    return hmac.compare_digest(got,expected)

def _now(): return datetime.now(timezone.utc)
def _iso(dt): return dt.isoformat()

def issue_session():
    token=secrets.token_urlsafe(32)
    with rw_conn() as db:
        db.execute('DELETE FROM sessions WHERE expires_at < ?',(_iso(_now()),))
        db.execute('INSERT INTO sessions(token,created_at,expires_at) VALUES(?,?,?)',
                   (token,_iso(_now()),_iso(_now()+timedelta(hours=SESSION_HOURS))))
    return token

def session_valid(token):
    if not token:
        return False
    with rw_conn() as db:
        db.execute('DELETE FROM sessions WHERE expires_at < ?',(_iso(_now()),))
        row=db.execute('SELECT token FROM sessions WHERE token=? AND expires_at > ?',
                       (token,_iso(_now()))).fetchone()
    return bool(row)

def revoke_session(token):
    if token:
        with rw_conn() as db:
            db.execute('DELETE FROM sessions WHERE token=?',(token,))

# ---------------------------------------------------------------------------
# Write validation
# ---------------------------------------------------------------------------
class Invalid(Exception): pass

def v_text(required=False,maxlen=4000):
    def f(val):
        if val is None: val=''
        if not isinstance(val,str): raise Invalid('expected text')
        val=val.strip()
        if required and not val: raise Invalid('required')
        if len(val)>maxlen: raise Invalid(f'too long (max {maxlen})')
        return val
    return f

def v_int(minv=None,maxv=None):
    def f(val):
        try: n=int(val)
        except (TypeError,ValueError): raise Invalid('expected integer')
        if minv is not None and n<minv: raise Invalid(f'must be >= {minv}')
        if maxv is not None and n>maxv: raise Invalid(f'must be <= {maxv}')
        return n
    return f

def v_enum(*choices):
    def f(val):
        if val not in choices: raise Invalid(f'must be one of {", ".join(map(str,choices))}')
        return val
    return f

def v_url(required=False):
    def f(val):
        if val in (None,''):
            if required: raise Invalid('url required')
            return None
        if not isinstance(val,str): raise Invalid('expected url string')
        u=urlsplit(val.strip())
        if u.scheme.lower() not in ('http','https') or not u.netloc:
            raise Invalid('url must be http/https')
        return urlunsplit(u)
    return f

def v_nullable_iso(val):
    if val in (None,''): return None
    if not isinstance(val,str) or len(val)>40: raise Invalid('expected ISO date string')
    return val.strip()

def v_color(val):
    val=(val or '').strip()
    if not (len(val)==7 and val[0]=='#' and all(c in '0123456789abcdefABCDEF' for c in val[1:])):
        raise Invalid('expected #RRGGBB')
    return val

# collection -> (table, {field: validator}, defaults)
COMMON={'is_sample':v_enum(0,1),'display_order':v_int(minv=0)}
COLLECTIONS={
 'athletes':('athletes',{'name':v_text(required=True,maxlen=120),'nickname':v_text(maxlen=120),
   'division':v_text(required=True,maxlen=60),'country':v_text(required=True,maxlen=60),
   'wins':v_int(minv=0),'losses':v_int(minv=0),'draws':v_int(minv=0),
   'biography':v_text(maxlen=8000),'portrait_url':v_url(),'cartoon_url':v_url(),**COMMON}),
 'events':('events',{'title':v_text(required=True,maxlen=160),'subtitle':v_text(required=True,maxlen=160),
   'status':v_enum('Upcoming','Past'),'starts_at':v_nullable_iso,'timezone':v_text(maxlen=60),
   'venue':v_text(maxlen=160),'city':v_text(maxlen=120),'ticket_url':v_url(),'poster_url':v_url(),
   'description':v_text(maxlen=8000),**COMMON}),
 'stories':('stories',{'title':v_text(required=True,maxlen=200),
   'type':v_enum('News','Interviews','Videos','Galleries'),'body':v_text(required=True,maxlen=20000),
   'image_url':v_url(),'video_url':v_url(),'published_at':v_nullable_iso,**COMMON}),
 'gallery_items':('gallery_items',{'platform':v_enum('instagram','youtube','rumble'),
   'kind':v_enum('reel','video'),'title':v_text(required=True,maxlen=200),'url':v_url(required=True),
   'thumbnail_url':v_url(),'description':v_text(maxlen=4000),**COMMON}),
 'bouts':('bouts',{'event_id':v_int(minv=1),'red_athlete_id':v_int(minv=1),'blue_athlete_id':v_int(minv=1),
   'division':v_text(required=True,maxlen=60),'card_section':v_enum('Main card','Preliminary card'),
   'bout_order':v_int(minv=0),'winner_id':v_int(minv=1),'result_method':v_text(maxlen=60),
   'result_round':v_int(minv=0),'result_time':v_text(maxlen=20)}),
 'rankings':('rankings',{'division':v_text(required=True,maxlen=60),'athlete_id':v_int(minv=1),
   'position':v_int(minv=0),'movement':v_int(),'updated_at':v_nullable_iso,'is_sample':v_enum(0,1)}),
 'achievements':('achievements',{'athlete_id':v_int(minv=1),'title':v_text(required=True,maxlen=200),
   'description':v_text(maxlen=4000),'achieved_on':v_nullable_iso,'display_order':v_int(minv=0)}),
 'sponsors':('sponsors',{'name':v_text(required=True,maxlen=160),'logo_url':v_url(),
   'website_url':v_url(),'display_order':v_int(minv=0)}),
}
SETTING_KEYS={'brand_name':v_text(required=True,maxlen=160),'primary_color':v_color,
 'accent_color':v_color,'content_mode':v_text(maxlen=40),'instagram_url':v_url(required=True),
 'youtube_url':v_url(required=True),'gallery_enabled':v_enum('0','1'),'news_enabled':v_enum('0','1')}

def validate(collection,payload):
    """Validate a create/update payload against the collection's field validators.
    Only fields present in the payload are written, but required fields must be present
    and valid. Returns a dict of cleaned column -> value."""
    if not isinstance(payload,dict): raise Invalid('body must be a JSON object')
    fields=COLLECTIONS[collection][1]
    clean={}
    for field,validator in fields.items():
        if field in payload:
            try: clean[field]=validator(payload[field])
            except Invalid as e: raise Invalid(f'{field}: {e}')
        else:
            # Field omitted: run the validator on None to surface a "required" error.
            try: validator(None)
            except Invalid as e:
                if 'required' in str(e): raise Invalid(f'{field}: required')
    return clean

# ---------------------------------------------------------------------------
# Image upload + CSV import (admin only)
# ---------------------------------------------------------------------------
ATHLETE_CSV_FIELDS=['name','nickname','division','country','wins','losses','draws','biography']

def sniff_image_ext(data):
    """Return a safe extension for recognised image bytes, else None."""
    if data[:8]==b'\x89PNG\r\n\x1a\n': return 'png'
    if data[:3]==b'\xff\xd8\xff': return 'jpg'
    if data[:4]==b'RIFF' and data[8:12]==b'WEBP': return 'webp'
    return None

def parse_multipart_file(body, content_type):
    """Minimal multipart/form-data parser for a single file field. Returns (filename, bytes).
    stdlib `cgi` was removed in 3.13, so we parse the boundary ourselves. Bounded by MAX_UPLOAD."""
    if 'boundary=' not in content_type: raise Invalid('missing multipart boundary')
    boundary=('--'+content_type.split('boundary=',1)[1].strip()).encode()
    parts=body.split(boundary)
    for part in parts:
        if b'Content-Disposition' not in part or b'filename=' not in part: continue
        header,_,payload=part.partition(b'\r\n\r\n')
        if not payload: continue
        payload=payload.rstrip(b'\r\n')
        fname=''
        for token in header.split(b';'):
            if token.strip().startswith(b'filename='):
                fname=token.split(b'=',1)[1].strip().strip(b'"').decode('utf-8','replace')
        return fname, payload
    raise Invalid('no file field found')

def save_athlete_image(data):
    """Validate image bytes and write a safe, server-generated filename. Returns the public URL."""
    if len(data)>MAX_UPLOAD: raise Invalid('file too large (max 6 MB)')
    ext=sniff_image_ext(data)
    if not ext: raise Invalid('unsupported image type (use PNG, JPG or WEBP)')
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name=f'{secrets.token_hex(8)}.{ext}'  # never trust the client filename -> no path traversal
    (UPLOAD_DIR/name).write_bytes(data)
    return f'assets/athletes/{name}'

def import_athletes_csv(text):
    """Validate every row with the athletes validators, then insert. Returns (added, errors)."""
    reader=csv.DictReader(io.StringIO(text))
    added=0; errors=[]
    with rw_conn() as db:
        order=db.execute('SELECT COALESCE(MAX(display_order),-1)+1 FROM athletes').fetchone()[0]
        for i,row in enumerate(reader,2):  # header is line 1
            payload={k:(row.get(k) or '').strip() for k in ATHLETE_CSV_FIELDS if k in row}
            for num in ('wins','losses','draws'):
                payload.setdefault(num,'0')
            try:
                clean=validate('athletes',payload)
                clean['is_sample']=1; clean['display_order']=order; order+=1
                cols=','.join(clean); marks=','.join('?'*len(clean))
                db.execute(f'INSERT INTO athletes({cols}) VALUES({marks})',list(clean.values()))
                added+=1
            except (Invalid,sqlite3.IntegrityError) as e:
                errors.append(f'row {i}: {e}')
    return added, errors

# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(PUBLIC),**kwargs)

    def log_message(self,fmt,*args):  # quieter console
        pass

    def end_headers(self):
        # Local dev: never cache static assets, so edits to app.js/css/images show on reload
        # without a hard refresh. API responses already set their own Cache-Control.
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control','no-store')
        super().end_headers()

    # -- helpers -----------------------------------------------------------
    def _json(self,payload,status=200,extra_headers=None):
        raw=json.dumps(payload,ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(raw)))
        for k,v in (extra_headers or {}).items():
            self.send_header(k,v)
        self.end_headers();self.wfile.write(raw)

    def _cookie_token(self):
        c=SimpleCookie(self.headers.get('Cookie',''))
        return c['rfc_session'].value if 'rfc_session' in c else None

    def _read_json(self):
        length=int(self.headers.get('Content-Length',0) or 0)
        if length<=0 or length>1_000_000:
            raise Invalid('missing or oversized body')
        try: return json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError,UnicodeDecodeError): raise Invalid('body must be valid JSON')

    def _csrf_ok(self):
        # Require a custom header (not settable cross-origin without CORS) and a same-origin
        # Origin/Referer when present. Combined with 127.0.0.1 bind and SameSite=Strict cookie.
        if self.headers.get('X-Requested-With')!='fetch':
            return False
        for h in ('Origin','Referer'):
            val=self.headers.get(h)
            if val:
                host=urlsplit(val).hostname
                if host not in ('localhost','127.0.0.1'):
                    return False
        return True

    def _require_admin(self):
        if admin_credentials() is None:
            self._json({'error':'admin not configured. Run scripts/set_admin_password.py.'},503)
            return False
        if not session_valid(self._cookie_token()):
            self._json({'error':'authentication required'},401)
            return False
        return True

    # -- GET ---------------------------------------------------------------
    def do_GET(self):
        path=urlsplit(self.path).path
        if path.startswith('/api/admin/'):
            self._admin_get(path);return
        if path.startswith('/api/'):
            if path=='/api/health':
                self._json({'status':'ok','database':'connected','schema_version':schema_version()});return
            content=get_content()
            if path=='/api/content': self._json(content);return
            key=path.removeprefix('/api/')
            if key in content: self._json(content[key]);return
            self.send_error(404,'API route not found');return
        super().do_GET()

    def _admin_get(self,path):
        rest=path.removeprefix('/api/admin/')
        if rest=='session':
            self._json({'authenticated':admin_credentials() is not None and session_valid(self._cookie_token()),
                        'configured':admin_credentials() is not None});return
        if not self._require_admin(): return
        if rest in COLLECTIONS:
            table=COLLECTIONS[rest][0]
            with rw_conn() as db:
                rows=[dict(r) for r in db.execute(f'SELECT * FROM {table} ORDER BY id')]
            self._json(rows);return
        if rest=='settings':
            with rw_conn() as db:
                self._json({r['key']:r['value'] for r in db.execute('SELECT * FROM site_settings')});return
        if rest=='template/athletes.csv':
            sample=['Jane Doe','The Example','Lightweight','Ireland','0','0','0','Sample biography text.']
            buf=io.StringIO(); w=csv.writer(buf)
            w.writerow(ATHLETE_CSV_FIELDS); w.writerow(sample)
            raw=buf.getvalue().encode()
            self.send_response(200)
            self.send_header('Content-Type','text/csv; charset=utf-8')
            self.send_header('Content-Disposition','attachment; filename="rfc_athletes_template.csv"')
            self.send_header('Content-Length',str(len(raw)))
            self.end_headers(); self.wfile.write(raw); return
        self.send_error(404,'Admin route not found')

    # -- POST --------------------------------------------------------------
    def do_POST(self):
        path=urlsplit(self.path).path
        if not path.startswith('/api/admin/'):
            self.send_error(404,'Not found');return
        rest=path.removeprefix('/api/admin/')
        try:
            if rest=='login': return self._login()
            if rest=='logout': return self._logout()
            if not self._csrf_ok(): return self._json({'error':'bad request'},400)
            if not self._require_admin(): return
            if rest=='upload': return self._upload()
            if rest=='import/athletes': return self._import_athletes()
            if rest in COLLECTIONS: return self._create(rest)
            self.send_error(404,'Admin route not found')
        except Invalid as e:
            self._json({'error':str(e)},400)

    def _upload(self):
        length=int(self.headers.get('Content-Length',0) or 0)
        if length<=0 or length>MAX_UPLOAD+8192: raise Invalid('missing or oversized upload')
        body=self.rfile.read(length)
        fname,data=parse_multipart_file(body,self.headers.get('Content-Type',''))
        url=save_athlete_image(data)
        self._json({'url':url},201)

    def _import_athletes(self):
        length=int(self.headers.get('Content-Length',0) or 0)
        if length<=0 or length>2_000_000: raise Invalid('missing or oversized CSV')
        text=self.rfile.read(length).decode('utf-8','replace')
        added,errors=import_athletes_csv(text)
        self._json({'added':added,'errors':errors},200)

    def _login(self):
        if not self._csrf_ok(): return self._json({'error':'bad request'},400)
        data=self._read_json()
        result=verify_password(str(data.get('password','')))
        if result is None:
            return self._json({'error':'admin not configured. Run scripts/set_admin_password.py.'},503)
        time.sleep(0.4)  # blunt brute force
        if not result:
            return self._json({'error':'invalid password'},401)
        token=issue_session()
        cookie=f'rfc_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_HOURS*3600}'
        self._json({'ok':True},200,{'Set-Cookie':cookie})

    def _logout(self):
        revoke_session(self._cookie_token())
        self._json({'ok':True},200,{'Set-Cookie':'rfc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})

    def _create(self,collection):
        table=COLLECTIONS[collection][0]
        clean=validate(collection,self._read_json())
        if not clean: raise Invalid('no fields supplied')
        cols=','.join(clean); marks=','.join('?'*len(clean))
        try:
            with rw_conn() as db:
                cur=db.execute(f'INSERT INTO {table}({cols}) VALUES({marks})',list(clean.values()))
                row=dict(db.execute(f'SELECT * FROM {table} WHERE id=?',(cur.lastrowid,)).fetchone())
        except sqlite3.IntegrityError as e:
            return self._json({'error':f'constraint failed: {e}'},409)
        self._json(row,201)

    # -- PUT ---------------------------------------------------------------
    def do_PUT(self):
        path=urlsplit(self.path).path
        if not path.startswith('/api/admin/'):
            self.send_error(404,'Not found');return
        rest=path.removeprefix('/api/admin/')
        try:
            if not self._csrf_ok(): return self._json({'error':'bad request'},400)
            if not self._require_admin(): return
            parts=rest.split('/')
            if parts[0]=='settings' and len(parts)==2:
                return self._put_setting(parts[1])
            if len(parts)==2 and parts[0] in COLLECTIONS:
                return self._update(parts[0],parts[1])
            self.send_error(404,'Admin route not found')
        except Invalid as e:
            self._json({'error':str(e)},400)

    def _update(self,collection,rid):
        table=COLLECTIONS[collection][0]
        try: rid=int(rid)
        except ValueError: raise Invalid('invalid id')
        clean=validate(collection,self._read_json())
        if not clean: raise Invalid('no fields supplied')
        assigns=','.join(f'{c}=?' for c in clean)
        try:
            with rw_conn() as db:
                cur=db.execute(f'UPDATE {table} SET {assigns} WHERE id=?',[*clean.values(),rid])
                if cur.rowcount==0: return self._json({'error':'not found'},404)
                row=dict(db.execute(f'SELECT * FROM {table} WHERE id=?',(rid,)).fetchone())
        except sqlite3.IntegrityError as e:
            return self._json({'error':f'constraint failed: {e}'},409)
        self._json(row,200)

    def _put_setting(self,key):
        if key not in SETTING_KEYS: raise Invalid('unknown or protected setting')
        data=self._read_json()
        try: value=SETTING_KEYS[key](data.get('value'))
        except Invalid as e: raise Invalid(f'{key}: {e}')
        with rw_conn() as db:
            db.execute('INSERT INTO site_settings(key,value) VALUES(?,?) '
                       'ON CONFLICT(key) DO UPDATE SET value=excluded.value',(key,str(value)))
        self._json({'key':key,'value':str(value)},200)

    # -- DELETE ------------------------------------------------------------
    def do_DELETE(self):
        path=urlsplit(self.path).path
        if not path.startswith('/api/admin/'):
            self.send_error(404,'Not found');return
        rest=path.removeprefix('/api/admin/')
        try:
            if not self._csrf_ok(): return self._json({'error':'bad request'},400)
            if not self._require_admin(): return
            parts=rest.split('/')
            if len(parts)==2 and parts[0] in COLLECTIONS:
                table=COLLECTIONS[parts[0]][0]
                try: rid=int(parts[1])
                except ValueError: raise Invalid('invalid id')
                with rw_conn() as db:
                    cur=db.execute(f'DELETE FROM {table} WHERE id=?',(rid,))
                return self._json({'ok':True} if cur.rowcount else {'error':'not found'},
                                  200 if cur.rowcount else 404)
            self.send_error(404,'Admin route not found')
        except Invalid as e:
            self._json({'error':str(e)},400)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    # Defaults are local-only. Deploy platforms (e.g. Render) set the PORT env var and need
    # binding to 0.0.0.0 — pass --host 0.0.0.0 or set HOST=0.0.0.0 there. Keep 127.0.0.1 locally.
    parser.add_argument('--port',type=int,default=int(os.environ.get('PORT',8000)))
    parser.add_argument('--host',default=os.environ.get('HOST','127.0.0.1'))
    args=parser.parse_args()
    initialize()
    migrate.run(DB)
    admin_state='ENABLED' if admin_credentials() else 'disabled (run scripts/set_admin_password.py)'
    public=args.host not in ('127.0.0.1','localhost')
    print(f'RFC server: http://{args.host}:{args.port}  (Ctrl+C to stop)')
    print(f'Admin panel: /admin.html — admin {admin_state}')
    if public:
        print('WARNING: bound to a public interface. Set an admin password and serve behind HTTPS; '
              'this stdlib server has no rate limiting. Prefer the static export for public hosting.')
    else:
        print('LOCAL DEVELOPMENT — bound to 127.0.0.1. Do not expose this server publicly.')
    try: ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
    except KeyboardInterrupt: print('\nStopped.')
