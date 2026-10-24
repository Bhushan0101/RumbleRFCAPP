"""Log + DB-backed outbound mail (no SMTP). See docs/EMAIL.md.

Every send() call writes a JSON line to logs/outbound_mail.log AND inserts a row
in the outbound_mail table so the admin inbox can surface it. If SMTP env vars
are set in the future, swap the deliver() body for a real sender; the audit
trail stays in place.
"""
import json
import os
import sqlite3
import time
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parent / 'logs' / 'outbound_mail.log'


def _log_to_file(entry):
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open('a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    except OSError:
        pass


def send(db, to_address, subject, body, category):
    """Record an outbound mail. db is a live sqlite3.Connection in a transaction.

    The caller's transaction commits (or rolls back) with us — do not open a
    new connection here. The file-log write is best-effort and never raises.
    """
    ts = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    entry = {'ts': ts, 'to': to_address, 'subject': subject, 'body': body, 'category': category}
    _log_to_file(entry)
    db.execute(
        'INSERT INTO outbound_mail(to_address,subject,body,category) VALUES(?,?,?,?)',
        (to_address, subject, body, category),
    )
