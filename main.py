"""WSGI entrypoint for cloud hosting (e.g. Render's default `gunicorn main:app`).

Serves the public/ static site, the read-only JSON content API, AND the authenticated admin
write API (the same validated/escaped logic as server.py, reused via shared op_* functions).

Admin is DISABLED until a password is configured. On a cloud host set the env vars
RFC_ADMIN_PASSWORD_HASH and RFC_ADMIN_SALT (see scripts/set_admin_password.py for the format).
NOTE: on an ephemeral filesystem (Render free tier) admin edits and uploads reset on restart —
the deployed admin is for demonstration; use a persistent disk / external DB for durable edits.

The member portal /api/portal/ routes are shared with the local server; RFC_DEMO_MODE=1
explicitly provisions stakeholder test accounts. RFC_DB_PATH selects runtime storage.

Locally, prefer `python server.py` (zero dependencies). This file + gunicorn is for hosting.
"""
import json
import mimetypes
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlsplit
import server as S
from scripts.init_db import DB, initialize
from scripts import migrate

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'

# Ensure the database exists and is migrated before the first request (safe + idempotent).
initialize()
migrate.run(DB)
from scripts.seed_portal_demo import seed_if_enabled
seed_if_enabled(DB)


def _jb(payload):
    return json.dumps(payload, ensure_ascii=False).encode('utf-8')


def _respond(start_response, status, body, ctype='application/json; charset=utf-8', extra=None):
    headers = [('Content-Type', ctype), ('Cache-Control', 'no-store'),
               ('Content-Length', str(len(body)))]
    if extra:
        headers.extend(extra)
    start_response(status, headers)
    return [body]


# ---- read API ----
def _api(path):
    if path == '/api/health':
        return '200 OK', _jb({'status': 'ok', 'database': 'connected',
                              'schema_version': S.schema_version()})
    content = S.get_content()
    if path == '/api/content':
        return '200 OK', _jb(content)
    key = path[len('/api/'):]
    if key in content:
        return '200 OK', _jb(content[key])
    return '404 Not Found', _jb({'error': 'API route not found'})


# ---- admin helpers (reuse server.py's hardened logic) ----
def _cookie_token(environ):
    c = SimpleCookie(environ.get('HTTP_COOKIE', ''))
    return c['rfc_session'].value if 'rfc_session' in c else None


def _body(environ):
    try:
        length = int(environ.get('CONTENT_LENGTH', 0) or 0)
    except ValueError:
        length = 0
    if length <= 0 or length > 2_000_000:
        raise S.Invalid('missing or oversized body')
    return environ['wsgi.input'].read(length)


def _csrf_ok(environ):
    if environ.get('HTTP_X_REQUESTED_WITH') != 'fetch':
        return False
    for h in ('HTTP_ORIGIN', 'HTTP_REFERER'):
        val = environ.get(h)
        if val and urlsplit(val).hostname not in (
                environ.get('HTTP_HOST', '').split(':')[0], 'localhost', '127.0.0.1'):
            return False
    return True


def _admin(environ, method, path):
    rest = path[len('/api/admin/'):]
    configured = S.admin_credentials() is not None

    # Session check (GET, no auth required)
    if method == 'GET' and rest == 'session':
        return '200 OK', _jb({'authenticated': configured and S.session_valid(_cookie_token(environ)),
                              'configured': configured}), None

    # Login / logout
    if method == 'POST' and rest == 'login':
        if not _csrf_ok(environ):
            return '400 Bad Request', _jb({'error': 'bad request'}), None
        data = json.loads(_body(environ).decode('utf-8'))
        result = S.verify_password(str(data.get('password', '')))
        if result is None:
            return '503 Service Unavailable', _jb({'error': 'admin not configured'}), None
        if not result:
            return '401 Unauthorized', _jb({'error': 'invalid password'}), None
        token = S.issue_session()
        cookie = f'rfc_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={S.SESSION_HOURS*3600}'
        return '200 OK', _jb({'ok': True}), [('Set-Cookie', cookie)]
    if method == 'POST' and rest == 'logout':
        S.revoke_session(_cookie_token(environ))
        clear = 'rfc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
        return '200 OK', _jb({'ok': True}), [('Set-Cookie', clear)]

    # Everything below requires auth + CSRF
    if not configured:
        return '503 Service Unavailable', _jb({'error': 'admin not configured'}), None
    if method != 'GET' and not _csrf_ok(environ):
        return '400 Bad Request', _jb({'error': 'bad request'}), None
    if not S.session_valid(_cookie_token(environ)):
        return '401 Unauthorized', _jb({'error': 'authentication required'}), None

    parts = rest.split('/')
    if method == 'GET' and rest in S.COLLECTIONS:
        return '200 OK', _jb(S.op_list(rest)), None
    if method == 'GET' and rest == 'settings':
        return '200 OK', _jb(S.op_settings()), None
    if method == 'POST' and rest in S.COLLECTIONS:
        return '201 Created', _jb(S.op_create(rest, json.loads(_body(environ).decode('utf-8')))), None
    if method == 'POST' and rest == 'import/athletes':
        added, errors = S.import_athletes_csv(_body(environ).decode('utf-8', 'replace'))
        return '200 OK', _jb({'added': added, 'errors': errors}), None
    if method == 'POST' and rest == 'upload':
        fname, data = S.parse_multipart_file(_body(environ), environ.get('CONTENT_TYPE', ''))
        return '201 Created', _jb({'url': S.save_athlete_image(data)}), None
    if method == 'PUT' and parts[0] == 'settings' and len(parts) == 2:
        return '200 OK', _jb(S.op_put_setting(parts[1], json.loads(_body(environ).decode('utf-8')).get('value'))), None
    if method == 'PUT' and len(parts) == 2 and parts[0] in S.COLLECTIONS:
        return '200 OK', _jb(S.op_update(parts[0], parts[1], json.loads(_body(environ).decode('utf-8')))), None
    if method == 'DELETE' and len(parts) == 2 and parts[0] in S.COLLECTIONS:
        return '200 OK', _jb(S.op_delete(parts[0], parts[1])), None
    return '404 Not Found', _jb({'error': 'admin route not found'}), None


# ---- static ----
def _static(path):
    rel = path.lstrip('/') or 'index.html'
    target = (PUBLIC / rel).resolve()
    if not str(target).startswith(str(PUBLIC.resolve())):
        return None
    if target.is_dir():
        target = target / 'index.html'
    return target if target.is_file() else None


def app(environ, start_response):
    path = environ.get('PATH_INFO', '/')
    method = environ.get('REQUEST_METHOD', 'GET')

    if path.startswith('/api/portal/'):
        import portal
        from http import HTTPStatus
        try:
            data = json.loads(_body(environ).decode('utf-8')) if method in ('POST','PUT') else {}
        except (S.Invalid, ValueError, UnicodeDecodeError):
            return _respond(start_response, '400 Bad Request', _jb({'error':'Invalid JSON body'}))
        headers = {'X-Requested-With':environ.get('HTTP_X_REQUESTED_WITH',''),
                   'Origin':environ.get('HTTP_ORIGIN',''),
                   'X-Forwarded-Proto':environ.get('HTTP_X_FORWARDED_PROTO','')}
        status, payload, extra = portal.handle(S.DB,method,path[len('/api/portal/'):],data,
            environ.get('HTTP_COOKIE',''),headers,environ.get('HTTP_HOST','localhost'))
        return _respond(start_response, f'{status} {HTTPStatus(status).phrase}', payload if isinstance(payload,bytes) else _jb(payload), ctype=extra.pop('Content-Type','application/json; charset=utf-8'), extra=list(extra.items()))

    if path.startswith('/api/admin/'):
        try:
            status, body, extra = _admin(environ, method, path)
        except S.Invalid as e:
            status, body, extra = '400 Bad Request', _jb({'error': str(e)}), None
        except S.NotFound as e:
            status, body, extra = '404 Not Found', _jb({'error': str(e)}), None
        except S.Conflict as e:
            status, body, extra = '409 Conflict', _jb({'error': str(e)}), None
        except (ValueError, KeyError):
            status, body, extra = '400 Bad Request', _jb({'error': 'bad request'}), None
        return _respond(start_response, status, body, extra=extra)

    if path.startswith('/api/'):
        if method not in ('GET', 'HEAD'):
            return _respond(start_response, '405 Method Not Allowed', b'{"error":"method not allowed"}')
        status, body = _api(path)
        return _respond(start_response, status, b'' if method == 'HEAD' else body)

    # static files (GET/HEAD only)
    if method not in ('GET', 'HEAD'):
        return _respond(start_response, '405 Method Not Allowed', b'Method not allowed.', 'text/plain')
    target = _static(path)
    if target is None:
        return _respond(start_response, '404 Not Found', b'Not found.', 'text/plain')
    ctype = mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
    data = target.read_bytes()
    return _respond(start_response, '200 OK', b'' if method == 'HEAD' else data, ctype)
