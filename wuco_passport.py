"""Public, read-only lookup for the digital fighter passport.

Returns only the fields printed on the passport card (name, club, division,
discipline, record, status, nationality + fighter number). No account data,
no email, no gym internals — the endpoint is unauthenticated and shareable
via QR code.
"""
import re
import sqlite3

FIGHTER_NO_RE = re.compile(r'^[A-Z]{3}-[0-9]{3,8}$')


def lookup(db_path, fighter_no):
    """Return the public passport payload or None if not found."""
    if not isinstance(fighter_no, str) or not FIGHTER_NO_RE.fullmatch(fighter_no):
        return None
    with sqlite3.connect(db_path, timeout=5) as db:
        db.row_factory = sqlite3.Row
        row = db.execute(
            '''SELECT p.fighter_no, p.issued_at,
                      a.name, a.division, a.country, a.wins, a.losses, a.draws,
                      a.class_code, a.martial_art, a.portrait_url,
                      g.name AS club_name,
                      coalesce(f.approval_status, 'approved') AS approval_status
               FROM fighter_passports p
               JOIN athletes a ON a.id = p.athlete_id
               LEFT JOIN fighter_profiles f ON f.athlete_id = p.athlete_id
               LEFT JOIN gyms g ON g.id = f.gym_id
               WHERE p.fighter_no = ?''',
            (fighter_no,),
        ).fetchone()
    if not row:
        return None
    data = dict(row)
    # Status is public: approved → Active, suspended → Suspended; anything else hides the card.
    if data['approval_status'] not in ('approved', 'suspended'):
        return None
    data['status'] = 'Active' if data['approval_status'] == 'approved' else 'Suspended'
    data['record'] = f"{data['wins']}-{data['losses']}-{data['draws']}"
    data['nationality'] = data['country'] or 'Ireland'
    data['club'] = data['club_name'] or 'Independent'
    # Drop internal fields.
    for key in ('approval_status', 'club_name', 'wins', 'losses', 'draws', 'country'):
        data.pop(key, None)
    return data
