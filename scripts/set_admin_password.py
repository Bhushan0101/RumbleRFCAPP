"""Set the local admin password for the RFC content backend.

Writes a gitignored admin_config.json at the repo root (outside public/, never served).
Stores only a PBKDF2-HMAC-SHA256 hash and salt -- never the plaintext password.
Run this once locally before using /admin.html. Re-run to change the password.

The admin API stays disabled (writes return 503) until this file -- or the environment
variables RFC_ADMIN_PASSWORD_HASH and RFC_ADMIN_SALT -- is present.
"""
import getpass
import hashlib
import json
import secrets
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'admin_config.json'
ITERATIONS = 200_000

def main():
    print('RFC local admin password setup')
    print('This configures a LOCAL admin only. Do not expose the server publicly.\n')
    pw = getpass.getpass('New admin password: ')
    if len(pw) < 8:
        raise SystemExit('Password must be at least 8 characters.')
    if pw != getpass.getpass('Confirm password: '):
        raise SystemExit('Passwords did not match.')
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', pw.encode(), salt, ITERATIONS)
    CONFIG.write_text(json.dumps({
        'algo': 'pbkdf2_sha256',
        'iterations': ITERATIONS,
        'salt': salt.hex(),
        'hash': digest.hex(),
    }, indent=2))
    print(f'\nSaved {CONFIG.name}. The admin panel is now enabled at /admin.html.')

if __name__ == '__main__':
    main()
