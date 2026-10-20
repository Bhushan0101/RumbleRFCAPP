"""Numbered migration runner. Advances a live database past the schema.sql v1 baseline.

Each migration lives in scripts/migrations/NNN_name.sql and is applied once, in order,
when PRAGMA user_version < NNN. Migrations use IF NOT EXISTS / INSERT OR IGNORE so the
whole run is idempotent and preserves existing data. This is not a general down-migrator.
"""
import re
import sqlite3
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = Path(__file__).resolve().parent / 'migrations'

def _discover():
    found = []
    for path in sorted(MIGRATIONS.glob('*.sql')):
        m = re.match(r'(\d+)_', path.name)
        if m:
            found.append((int(m.group(1)), path))
    return sorted(found)

def run(db_path):
    """Apply any pending migrations to db_path. Returns the resulting user_version."""
    with sqlite3.connect(db_path) as db:
        db.execute('PRAGMA foreign_keys=ON')
        current = db.execute('PRAGMA user_version').fetchone()[0]
        for version, path in _discover():
            if version > current:
                db.executescript(path.read_text())
                db.execute(f'PRAGMA user_version = {version}')
                current = version
                print(f'Applied migration {path.name} -> user_version {version}')
        return current

if __name__ == '__main__':
    import sys
    sys.path.insert(0, str(ROOT))
    import scripts.init_db as init
    version = run(init.DB)
    print(f'Database at schema version {version}: {init.DB}')
