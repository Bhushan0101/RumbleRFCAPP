"""Seed the Monarch Fight Academy sample gym with timetable + pricing + classes.

Idempotent — safe to re-run; it skips if a Monarch gym already exists. Keeps the
Monarch logo/timetable reference image available under public/assets/logos/.
"""
import sqlite3
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_DEFAULT = ROOT / 'database' / 'rfc.sqlite3'

# Day-of-week: 0=Mon..6=Sun. Extracted from the organiser's Monarch timetable image.
CLASSES = [
    # Mornings
    ('Kickboxing (K-1)', 'K-1', 1, '07:45', 60, 25, '#f3b4ff'),
    ('Kickboxing (K-1)', 'K-1', 3, '07:45', 60, 25, '#f3b4ff'),
    ('Kids Kickboxing (K-1)', 'K-1', 5, '11:00', 60, 25, '#ffd166'),
    ('Kickboxing (K-1)', 'K-1', 5, '12:00', 60, 25, '#f3b4ff'),
    ('Open Mat (GI & No GI)', 'Brazilian Jiu Jitsu', 6, '15:00', 90, 30, '#cccccc'),
    # 17:00 kids block
    ('Kids Brazilian Jiu Jitsu (GI)', 'Brazilian Jiu Jitsu', 0, '17:00', 60, 25, '#ffd166'),
    ('Kids Kickboxing (K-1)', 'K-1', 1, '17:00', 60, 25, '#ff8a65'),
    ('Kids Brazilian Jiu Jitsu (GI)', 'Brazilian Jiu Jitsu', 2, '17:00', 60, 25, '#ffd166'),
    ('Kids Kickboxing (K-1)', 'K-1', 3, '17:00', 60, 25, '#ff8a65'),
    ('Kids Brazilian Jiu Jitsu (GI)', 'Brazilian Jiu Jitsu', 4, '17:00', 60, 25, '#ffd166'),
    # 18:00 adults
    ('Kickboxing (K-1)', 'K-1', 0, '18:00', 60, 30, '#f3b4ff'),
    ('No Gi Jiu Jitsu', 'Brazilian Jiu Jitsu', 1, '18:00', 60, 30, '#8bc34a'),
    ('Women-only Kickboxing (K-1)', 'K-1', 2, '18:00', 60, 25, '#f3b4ff'),
    ('Kickboxing (K-1)', 'K-1', 3, '18:00', 60, 30, '#f3b4ff'),
    ('Open Mat (GI & No GI)', 'Brazilian Jiu Jitsu', 4, '18:00', 90, 30, '#cccccc'),
    # 19:30 evening
    ('Brazilian Jiu Jitsu (GI)', 'Brazilian Jiu Jitsu', 0, '19:30', 60, 30, '#8ec5ff'),
    ('Kickboxing (K-1)', 'K-1', 1, '19:30', 60, 30, '#f3b4ff'),
    ('Brazilian Jiu Jitsu (GI)', 'Brazilian Jiu Jitsu', 2, '19:30', 60, 30, '#8ec5ff'),
    ('No Gi Jiu Jitsu', 'Brazilian Jiu Jitsu', 3, '19:30', 60, 30, '#8bc34a'),
]

PRODUCTS = [
    ('day_pass', 'Single day pass', 1500, 'https://revolut.me/monarchfight/15'),
    ('weekly_pass', 'Weekly pass', 4000, 'https://revolut.me/monarchfight/40'),
    ('monthly_pass', 'Monthly pass', 12000, 'https://revolut.me/monarchfight/120'),
    ('per_class', 'Per-class drop-in', 1500, 'https://revolut.me/monarchfight/15'),
]


def seed(db_path=DB_DEFAULT):
    db_path = Path(db_path)
    with sqlite3.connect(db_path) as db:
        db.execute('PRAGMA foreign_keys=ON')
        existing = db.execute("SELECT id FROM gyms WHERE slug='monarch-fight-academy'").fetchone()
        if existing:
            print(f'Monarch already seeded (gym id={existing[0]}).')
            return existing[0]
        gym_id = db.execute(
            '''INSERT INTO gyms(owner_id,name,city,join_code,about,revolut_handle,
                   timetable_image_url,slug,status,contact_email)
               VALUES(NULL,?,?,?,?,?,?,?,?,?)''',
            (
                'Monarch Fight Academy',
                'Dublin',
                secrets.token_hex(4).upper(),
                'Monarch Fight Academy is a modern Irish combat-sports gym offering K-1, '
                'Brazilian Jiu Jitsu, Kids classes and women-only sessions. Sample '
                'timetable supplied by the organiser.',
                'revolut.me/monarchfight',
                '/assets/logos/monarch-timetable-reference.png',
                'monarch-fight-academy',
                'active',
                'coach@monarchfight.ie',
            ),
        ).lastrowid
        for kind, title, cents, url in PRODUCTS:
            db.execute(
                'INSERT INTO gym_products(gym_id,kind,title,price_cents,revolut_url) VALUES(?,?,?,?,?)',
                (gym_id, kind, title, cents, url),
            )
        for title, discipline, day, start, duration, cap, colour in CLASSES:
            db.execute(
                '''INSERT INTO gym_classes(gym_id,title,discipline,day_of_week,start_time,
                       duration_minutes,capacity,per_class_price_cents,revolut_url,colour)
                   VALUES(?,?,?,?,?,?,?,?,?,?)''',
                (gym_id, title, discipline, day, start, duration, cap, 1500,
                 'https://revolut.me/monarchfight/15', colour),
            )
        db.commit()
        print(f'Seeded Monarch Fight Academy (gym id={gym_id}, {len(CLASSES)} classes).')
        return gym_id


if __name__ == '__main__':
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DB_DEFAULT
    seed(path)
