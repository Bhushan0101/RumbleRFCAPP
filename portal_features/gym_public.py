"""Public gym page, class booking, fighter-gym join requests."""
import re
import time

from portal import Error, text, require, rows, one, number
import wuco_mail

DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


def public_page(db, slug):
    """Unauthenticated: return the gym's public page payload."""
    if not isinstance(slug, str) or not re.fullmatch(r'[a-z0-9-]{1,60}', slug):
        return None
    gym = db.execute(
        '''SELECT id,name,city,slug,about,logo_url,hero_url,timetable_image_url,revolut_handle,status
           FROM gyms WHERE slug=? AND status='active' ''',
        (slug,),
    ).fetchone()
    if not gym:
        return None
    gym = dict(gym)
    gym['products'] = [dict(r) for r in db.execute(
        'SELECT * FROM gym_products WHERE gym_id=? AND active=1 ORDER BY kind,id', (gym['id'],))]
    classes = [dict(r) for r in db.execute(
        'SELECT * FROM gym_classes WHERE gym_id=? ORDER BY day_of_week,start_time', (gym['id'],))]
    for c in classes:
        c['day_name'] = DAY_NAMES[c['day_of_week']]
    gym['classes'] = classes
    return gym


def book_class(db, user, class_id, data):
    """Fighter or guest books a class. Status starts as pending_payment; the gym admin
    confirms it after the Revolut transfer lands."""
    cls = one(db, 'SELECT c.*,g.name AS gym_name,g.id AS gym_id,g.contact_email AS gym_email FROM gym_classes c JOIN gyms g ON g.id=c.gym_id WHERE c.id=?', (class_id,))
    booked_for = text(data, 'booked_for_date', 10)
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', booked_for):
        raise Error('Choose a valid date (YYYY-MM-DD)')
    guest_name = ''
    guest_email = ''
    user_id = None
    if user:
        user_id = user['id']
    else:
        guest_name = text(data, 'guest_name', 120)
        guest_email = text(data, 'guest_email', 254).lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', guest_email):
            raise Error('Enter a valid email address')
    # Capacity check for the specific date.
    taken = db.execute(
        "SELECT count(*) FROM class_bookings WHERE class_id=? AND booked_for_date=? AND status!='cancelled'",
        (class_id, booked_for),
    ).fetchone()[0]
    if taken >= cls['capacity']:
        raise Error('This class is full for that date', 409)
    db.execute(
        '''INSERT INTO class_bookings(class_id,user_id,guest_name,guest_email,booked_for_date)
           VALUES(?,?,?,?,?)''',
        (class_id, user_id, guest_name, guest_email, booked_for),
    )
    if cls['gym_email']:
        wuco_mail.send(
            db,
            cls['gym_email'],
            f'New class booking: {cls["title"]}',
            f'A new booking has been placed for {cls["title"]} on {booked_for} at {cls["gym_name"]}.',
            'class_booking',
        )
    return {
        'ok': True,
        'revolut_url': cls['revolut_url'] or None,
        'per_class_price_cents': cls['per_class_price_cents'],
    }


def request_join(db, user, data):
    """A signed-in fighter asks to join a gym (slug or join_code)."""
    require(user, 'fighter')
    slug = (data.get('slug') or '').strip()
    code = (data.get('code') or '').strip().upper()
    row = None
    if slug:
        row = db.execute('SELECT * FROM gyms WHERE slug=? AND status=?', (slug, 'active')).fetchone()
    elif code:
        row = db.execute('SELECT * FROM gyms WHERE join_code=? AND status=?', (code, 'active')).fetchone()
    if not row:
        raise Error('Gym not found', 404)
    row = dict(row)
    existing = db.execute(
        'SELECT status FROM gym_join_requests WHERE gym_id=? AND user_id=?',
        (row['id'], user['id']),
    ).fetchone()
    if existing and existing['status'] == 'pending':
        raise Error('A join request is already pending for this gym', 409)
    if existing and existing['status'] == 'approved':
        raise Error('You are already a member of this gym', 409)
    db.execute(
        '''INSERT INTO gym_join_requests(gym_id,user_id) VALUES(?,?)
           ON CONFLICT(gym_id,user_id) DO UPDATE SET status='pending',created_at=CURRENT_TIMESTAMP,review_note='' ''',
        (row['id'], user['id']),
    )
    if row['owner_id']:
        owner = db.execute('SELECT email FROM portal_users WHERE id=?', (row['owner_id'],)).fetchone()
        if owner:
            wuco_mail.send(
                db,
                owner['email'],
                f'New join request for {row["name"]}',
                f'{user["name"]} <{user["email"]}> has requested to join {row["name"]}.',
                'gym_join_request',
            )
    return {'ok': True}


def list_join_requests(db, user):
    """A gym owner sees pending join requests for their gym."""
    require(user, 'gym', 'coach', 'admin')
    if user['role'] == 'admin':
        return {'requests': rows(db, 'SELECT r.*,u.name,u.email,g.name AS gym_name FROM gym_join_requests r JOIN portal_users u ON u.id=r.user_id JOIN gyms g ON g.id=r.gym_id ORDER BY r.created_at DESC')}
    if user['role'] == 'gym':
        return {'requests': rows(db, '''SELECT r.*,u.name,u.email,g.name AS gym_name
            FROM gym_join_requests r JOIN portal_users u ON u.id=r.user_id JOIN gyms g ON g.id=r.gym_id
            WHERE g.owner_id=? ORDER BY r.created_at DESC''', (user['id'],))}
    return {'requests': rows(db, '''SELECT r.*,u.name,u.email,g.name AS gym_name
        FROM gym_join_requests r JOIN portal_users u ON u.id=r.user_id JOIN gyms g ON g.id=r.gym_id
        WHERE g.id IN (SELECT gym_id FROM coaches WHERE user_id=?) ORDER BY r.created_at DESC''', (user['id'],))}


def review_join(db, user, request_id, data):
    require(user, 'gym', 'coach', 'admin')
    req = one(db, '''SELECT r.*,g.owner_id FROM gym_join_requests r JOIN gyms g ON g.id=r.gym_id WHERE r.id=?''', (request_id,))
    if user['role'] != 'admin' and req['owner_id'] != user['id'] and not db.execute('SELECT 1 FROM coaches WHERE user_id=? AND gym_id=?', (user['id'], req['gym_id'])).fetchone():
        raise Error('This join request is not for your gym', 403)
    decision = (data or {}).get('decision')
    if decision not in ('approved', 'rejected'):
        raise Error('Choose approve or reject')
    note = (data or {}).get('note', '')[:1000]
    db.execute('UPDATE gym_join_requests SET status=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE id=?',
               (decision, note, request_id))
    if decision == 'approved':
        # Link the fighter's profile to this gym.
        db.execute('UPDATE fighter_profiles SET gym_id=? WHERE user_id=?', (req['gym_id'], req['user_id']))
    return {'ok': True}
