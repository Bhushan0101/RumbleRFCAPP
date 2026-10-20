"""WSGI entrypoint for production hosting (e.g. Render's default `gunicorn main:app`).

Serves the public/ static site plus the read-only JSON content API. This is the public,
read-only surface — the admin write API lives in server.py and is intended for local use only
(Render's filesystem is ephemeral, so writes would not persist anyway).

Locally, keep using `python server.py`. This file exists so the default cloud start command
`gunicorn main:app` works without extra configuration.
"""
import json
import mimetypes
from pathlib import Path
from server import get_content, schema_version
from scripts.init_db import DB, initialize
from scripts import migrate

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'

# Ensure the database exists and is migrated before the first request (safe + idempotent).
# The committed DB is already seeded; this just guarantees a fresh checkout also works.
initialize()
migrate.run(DB)


def _json_bytes(payload):
    return json.dumps(payload, ensure_ascii=False).encode('utf-8')


def _api(path):
    """Return (status, body_bytes) for a /api/* path, or None if not an API route."""
    if path == '/api/health':
        return '200 OK', _json_bytes({'status': 'ok', 'database': 'connected',
                                      'schema_version': schema_version()})
    content = get_content()
    if path == '/api/content':
        return '200 OK', _json_bytes(content)
    key = path[len('/api/'):]
    if key in content:
        return '200 OK', _json_bytes(content[key])
    return '404 Not Found', _json_bytes({'error': 'API route not found'})


def _static(path):
    """Resolve a static file under public/, preventing path traversal."""
    rel = path.lstrip('/') or 'index.html'
    target = (PUBLIC / rel).resolve()
    if not str(target).startswith(str(PUBLIC.resolve())):
        return None  # traversal attempt
    if target.is_dir():
        target = target / 'index.html'
    if not target.is_file():
        return None
    return target


def app(environ, start_response):
    path = environ.get('PATH_INFO', '/')
    method = environ.get('REQUEST_METHOD', 'GET')

    if method not in ('GET', 'HEAD'):
        start_response('405 Method Not Allowed', [('Content-Type', 'text/plain')])
        return [b'Method not allowed. The public deployment is read-only.']

    if path.startswith('/api/'):
        status, body = _api(path)
        headers = [('Content-Type', 'application/json; charset=utf-8'),
                   ('Cache-Control', 'no-store'),
                   ('Content-Length', str(len(body)))]
        start_response(status, headers)
        return [b'' if method == 'HEAD' else body]

    target = _static(path)
    if target is None:
        body = b'Not found.'
        start_response('404 Not Found', [('Content-Type', 'text/plain'),
                                         ('Content-Length', str(len(body)))])
        return [body]

    ctype = mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
    data = target.read_bytes()
    headers = [('Content-Type', ctype), ('Cache-Control', 'no-store'),
               ('Content-Length', str(len(data)))]
    start_response('200 OK', headers)
    return [b'' if method == 'HEAD' else data]
