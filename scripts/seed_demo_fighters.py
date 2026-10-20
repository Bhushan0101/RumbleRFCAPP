"""Add demo fighters (with generated portrait + cartoon images) and rankings.

Pure standard library. Generates a unique SVG portrait and a matching cartoon avatar for each
fighter into public/assets/athletes/, inserts the athletes, and seeds ranking rows for the two
focus divisions. Idempotent on the demo set: re-running does not duplicate (keyed on name).

Run:  python scripts/seed_demo_fighters.py
"""
import hashlib
import sqlite3
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts import migrate
from scripts.init_db import DB
ASSETS = ROOT / 'public' / 'assets' / 'athletes'

# 10 demo fighters across two focus divisions (Lightweight, Featherweight).
FIGHTERS = [
    # name, nickname, division, country, wins, losses, draws
    ('Darius Kane',    'The Blade',    'Lightweight',  'Ireland',        13, 1, 0),
    ('Marcus Vale',    'Nightfall',    'Lightweight',  'United Kingdom', 11, 2, 0),
    ('Tomas Reyes',    'El Rayo',      'Lightweight',  'Brazil',         10, 2, 1),
    ('Idris Bah',      'The Panther',  'Lightweight',  'Italy',           9, 3, 0),
    ('Owen Frost',     'Iceman',       'Lightweight',  'Ireland',         8, 3, 0),
    ('Mateo Cruz',     'The Storm',    'Lightweight',  'Brazil',          8, 4, 0),
    ('Kenji Arai',     'The Comet',    'Featherweight','Brazil',         14, 0, 0),
    ('Luca Barone',    'Thunder',      'Featherweight','Italy',          10, 1, 1),
    ('Sam Okafor',     'The Hammer',   'Featherweight','United Kingdom',  9, 2, 0),
    ('Ravi Deol',      'The Cobra',    'Featherweight','Ireland',         8, 2, 1),
    ('Felix Moreau',   'Le Loup',      'Featherweight','Brazil',          7, 3, 0),
    ('Diego Santos',   'Relampago',    'Welterweight', 'Brazil',         12, 1, 0),
    ('Harvey Blake',   'The Wall',     'Welterweight', 'United Kingdom', 10, 2, 0),
    ('Niall Doyle',    'The Bull',     'Welterweight', 'Ireland',         9, 2, 1),
    ('Enzo Ricci',     'Il Diavolo',   'Welterweight', 'Italy',           8, 3, 0),
    ('Caleb Moore',    'Freight',      'Welterweight', 'United Kingdom',  7, 4, 0),
]

def palette(seed):
    """Deterministic, distinct colours from the fighter's name."""
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    hue = h % 360
    accent = (hue + 40) % 360
    return hue, accent

def belt_svg(hue):
    """A championship belt band drawn across the lower chest (champions only)."""
    return (f'<rect x="90" y="378" width="220" height="40" fill="#111613"/>'
            f'<rect x="90" y="382" width="220" height="32" fill="hsl(45,70%,55%)"/>'
            f'<circle cx="200" cy="398" r="26" fill="hsl(45,80%,62%)" stroke="#111613" stroke-width="4"/>'
            f'<text x="200" y="405" font-family="Arial,sans-serif" font-size="18" font-weight="900" '
            f'fill="#111613" text-anchor="middle">RFC</text>')

def portrait_svg(name, nick, champion=False):
    """Dark fight-card style headshot (matches the reference card). Champions wear a belt."""
    hue, accent = palette(name)
    initials = ''.join(w[0] for w in name.split()[:2]).upper()
    belt = belt_svg(hue) if champion else ''
    champ_tag = ('<rect x="0" y="0" width="400" height="34" fill="hsl(45,75%,55%)"/>'
                 '<text x="200" y="24" font-family="Arial,sans-serif" font-size="16" font-weight="900" '
                 'fill="#111613" text-anchor="middle" letter-spacing="2">CHAMPION</text>') if champion else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
<defs><radialGradient id="bg" cx="50%" cy="38%" r="70%">
<stop offset="0" stop-color="hsl({hue},40%,26%)"/><stop offset="1" stop-color="#0b100c"/></radialGradient></defs>
<rect width="400" height="500" fill="url(#bg)"/>
<circle cx="200" cy="180" r="94" fill="hsl({hue},22%,78%)"/>
<path d="M200 268c-80 0-136 48-154 120 0 0 0 112 0 112h308s0-112 0-112c-18-72-74-120-154-120z" fill="hsl({hue},28%,30%)"/>
<path d="M150 300h100l-16 70h-68z" fill="hsl({accent},55%,45%)"/>
{belt}
{champ_tag}
<text x="200" y="486" font-family="Arial,sans-serif" font-size="30" font-weight="800" fill="#fff" text-anchor="middle" opacity="0.9">{initials}</text>
</svg>'''

def cartoon_svg(name, nick, champion=False):
    """Stylised flat cartoon avatar (flip-card back) in the same colour family. Champions wear a belt."""
    hue, accent = palette(name)
    belt = belt_svg(hue) if champion else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
<rect width="400" height="500" fill="hsl({accent},70%,55%)"/>
<circle cx="200" cy="200" r="130" fill="hsl({hue},35%,88%)" stroke="#111613" stroke-width="6"/>
<circle cx="160" cy="185" r="14" fill="#111613"/><circle cx="240" cy="185" r="14" fill="#111613"/>
<path d="M150 235q50 45 100 0" stroke="#111613" stroke-width="8" fill="none" stroke-linecap="round"/>
<path d="M90 150q110 -90 220 0 l0 -40 q-110 -70 -220 0 z" fill="hsl({hue},50%,25%)"/>
<rect x="120" y="330" width="160" height="150" rx="18" fill="hsl({hue},55%,30%)" stroke="#111613" stroke-width="6"/>
{belt}
<text x="200" y="470" font-family="Arial,sans-serif" font-size="22" font-weight="800" fill="#fff" text-anchor="middle">"{nick}"</text>
</svg>'''

def write_asset(filename, content):
    ASSETS.mkdir(parents=True, exist_ok=True)
    (ASSETS / filename).write_text(content, encoding='utf-8')
    return f'assets/athletes/{filename}'

def main():
    migrate.run(DB)
    added = 0
    divisions = ('Lightweight', 'Featherweight', 'Welterweight')
    with sqlite3.connect(DB) as db:
        db.execute('PRAGMA foreign_keys=ON')
        base_order = db.execute('SELECT COALESCE(MAX(display_order),-1)+1 FROM athletes').fetchone()[0]
        # 1. Insert demo fighters (idempotent on name). Images are generated in step 3.
        for i, (name, nick, division, country, w, l, d) in enumerate(FIGHTERS):
            if db.execute('SELECT 1 FROM athletes WHERE name=?', (name,)).fetchone():
                continue
            db.execute('INSERT INTO athletes(name,nickname,division,country,wins,losses,draws,'
                       'is_sample,display_order) VALUES(?,?,?,?,?,?,?,1,?)',
                       (name, nick, division, country, w, l, d, base_order + i))
            added += 1
        # 2. Rebuild rankings per division from current standings (best record first).
        champions = set()
        for division in divisions:
            db.execute('DELETE FROM rankings WHERE division=?', (division,))
            rows = db.execute('SELECT id FROM athletes WHERE division=? ORDER BY wins DESC, losses ASC, id',
                              (division,)).fetchall()
            for pos, (aid,) in enumerate(rows, 1):
                db.execute('INSERT OR IGNORE INTO rankings(division,athlete_id,position,movement,is_sample) '
                           'VALUES(?,?,?,0,1)', (division, aid, pos))
                if pos == 1:
                    champions.add(aid)  # #1 of each division is the champion (wears the belt)
        # 3. Generate a portrait + cartoon for EVERY athlete so the card style/belts are consistent.
        generated = 0
        for aid, name, nick in db.execute('SELECT id,name,nickname FROM athletes').fetchall():
            slug = name.lower().replace(' ', '-')
            champ = aid in champions
            portrait = write_asset(f'{slug}.svg', portrait_svg(name, nick or name, champ))
            cartoon = write_asset(f'{slug}-cartoon.svg', cartoon_svg(name, nick or name, champ))
            db.execute('UPDATE athletes SET portrait_url=?, cartoon_url=? WHERE id=?',
                       (portrait, cartoon, aid))
            generated += 1
    print(f'Added {added} demo fighters; generated images for {generated} athlete(s) '
          f'({len(champions)} champions with belts); rankings rebuilt across {len(divisions)} divisions.')

if __name__ == '__main__':
    main()

if __name__ == '__main__':
    main()
