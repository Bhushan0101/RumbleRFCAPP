"""Gym onboarding: public enquiry, admin invitation, token-gated onboarding form."""
import re
import secrets
import time

from portal import Error, text, require, rows, one, number
import wuco_mail

ONBOARDING_WINDOW_SECONDS = 14 * 24 * 3600  # 14 days
ADMIN_INBOX = 'ops@wuco.ie'


def _slugify(value):
    slug = re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
    return slug[:60] or 'gym'


def submit_enquiry(db, data):
    """Public: a prospective gym submits an enquiry. No auth."""
    gym_name = text(data, 'gym_name', 120)
    contact_name = text(data, 'contact_name', 120)
    contact_email = text(data, 'contact_email', 254).lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', contact_email):
        raise Error('Enter a valid email address')
    phone = text(data, 'phone', 60, required=False)
    city = text(data, 'city', 120, required=False)
    message = text(data, 'message', 2000, required=False)
    enquiry_id = db.execute(
        '''INSERT INTO gym_enquiries(gym_name,contact_name,contact_email,phone,city,message)
           VALUES(?,?,?,?,?,?)''',
        (gym_name, contact_name, contact_email, phone, city, message),
    ).lastrowid
    wuco_mail.send(
        db,
        ADMIN_INBOX,
        f'New gym enquiry: {gym_name}',
        f'{contact_name} <{contact_email}> submitted an enquiry for {gym_name} '
        f'({city or "no city"}, {phone or "no phone"}).\n\nMessage:\n{message or "—"}',
        'gym_enquiry',
    )
    return {'ok': True, 'id': enquiry_id}


def list_enquiries(db, user):
    require(user, 'admin')
    return {'enquiries': rows(db, 'SELECT * FROM gym_enquiries ORDER BY created_at DESC')}


def invite(db, user, enquiry_id):
    """Admin: send the gym a signed one-time URL to complete the onboarding form."""
    require(user, 'admin')
    enquiry = one(db, 'SELECT * FROM gym_enquiries WHERE id=?', (enquiry_id,))
    if enquiry['status'] in ('approved', 'rejected'):
        raise Error('This enquiry has already been reviewed', 409)
    token = secrets.token_urlsafe(32)
    expires = int(time.time()) + ONBOARDING_WINDOW_SECONDS
    db.execute(
        'INSERT INTO gym_onboarding_tokens(token,enquiry_id,expires_at) VALUES(?,?,?)',
        (token, enquiry_id, expires),
    )
    db.execute(
        'UPDATE gym_enquiries SET status=?,invited_by=?,invited_at=CURRENT_TIMESTAMP WHERE id=?',
        ('invited', user['id'], enquiry_id),
    )
    link = f'/gyms/onboarding.html?token={token}'
    wuco_mail.send(
        db,
        enquiry['contact_email'],
        'W.U.C.O gym onboarding link',
        f'Hi {enquiry["contact_name"]},\n\nThanks for your interest in bringing '
        f'{enquiry["gym_name"]} into W.U.C.O. Please complete the onboarding form '
        f'using the link below (valid for 14 days):\n\n{link}\n\nW.U.C.O Ireland',
        'gym_onboarding',
    )
    return {'ok': True, 'onboarding_url': link}


def read_token(db, token):
    """Public: resolve a one-time token into the enquiry record (no auth)."""
    if not isinstance(token, str) or len(token) < 20 or len(token) > 200:
        raise Error('Invalid onboarding link', 404)
    row = db.execute(
        '''SELECT t.*, e.gym_name, e.contact_name, e.contact_email, e.city, e.phone
           FROM gym_onboarding_tokens t JOIN gym_enquiries e ON e.id=t.enquiry_id
           WHERE t.token=?''',
        (token,),
    ).fetchone()
    if not row:
        raise Error('Onboarding link not found', 404)
    row = dict(row)
    if row['used_at']:
        raise Error('This onboarding link has already been used', 409)
    if int(row['expires_at']) < int(time.time()):
        raise Error('This onboarding link has expired', 410)
    return {
        'gym_name': row['gym_name'],
        'contact_name': row['contact_name'],
        'contact_email': row['contact_email'],
        'city': row['city'],
    }


def submit_onboarding(db, data):
    """Public (token-gated): the gym submits logo/timetable/classes/pricing."""
    token = text(data, 'token', 200)
    enquiry = _consume_token(db, token)
    gym_name = text(data, 'name', 120)
    city = text(data, 'city', 120, required=False) or enquiry['city']
    about = text(data, 'about', 2000, required=False)
    revolut = text(data, 'revolut_handle', 60, required=False)
    slug_base = _slugify(gym_name)
    slug = slug_base
    attempt = 1
    while db.execute('SELECT 1 FROM gyms WHERE slug=?', (slug,)).fetchone():
        attempt += 1
        slug = f'{slug_base}-{attempt}'
    gym_id = db.execute(
        '''INSERT INTO gyms(owner_id,name,city,join_code,about,revolut_handle,slug,status,contact_email)
           VALUES(NULL,?,?,?,?,?,?,?,?)''',
        (gym_name, city, secrets.token_hex(4).upper(), about, revolut, slug,
         'pending_review', enquiry['contact_email']),
    ).lastrowid
    _attach_products(db, gym_id, data.get('products') or [])
    _attach_classes(db, gym_id, data.get('classes') or [])
    db.execute(
        '''UPDATE gym_enquiries SET status='submitted' WHERE id=
           (SELECT enquiry_id FROM gym_onboarding_tokens WHERE token=?)''',
        (token,),
    )
    wuco_mail.send(
        db,
        ADMIN_INBOX,
        f'Gym onboarding submitted: {gym_name}',
        f'{enquiry["contact_name"]} <{enquiry["contact_email"]}> submitted the '
        f'onboarding form for {gym_name}. Review it in the admin portal.',
        'gym_submitted',
    )
    return {'ok': True, 'gym_id': gym_id, 'slug': slug}


def _consume_token(db, token):
    row = db.execute(
        '''SELECT t.token, t.used_at, t.expires_at,
                  e.id AS enquiry_id, e.gym_name, e.contact_name, e.contact_email, e.city
           FROM gym_onboarding_tokens t JOIN gym_enquiries e ON e.id=t.enquiry_id
           WHERE t.token=?''',
        (token,),
    ).fetchone()
    if not row:
        raise Error('Onboarding link not found', 404)
    row = dict(row)
    if row['used_at']:
        raise Error('This onboarding link has already been used', 409)
    if int(row['expires_at']) < int(time.time()):
        raise Error('This onboarding link has expired', 410)
    db.execute('UPDATE gym_onboarding_tokens SET used_at=CURRENT_TIMESTAMP WHERE token=?',
               (row['token'],))
    return row


def _attach_products(db, gym_id, products):
    allowed = {'day_pass', 'weekly_pass', 'monthly_pass', 'per_class'}
    for p in products or []:
        if not isinstance(p, dict):
            continue
        kind = p.get('kind')
        if kind not in allowed:
            continue
        title = text(p, 'title', 120)
        price = p.get('price_cents')
        if not isinstance(price, int) or price < 0 or price > 1_000_000:
            raise Error('Each pass price must be between 0 and 10,000 EUR')
        revolut_url = text(p, 'revolut_url', 300, required=False)
        db.execute(
            'INSERT INTO gym_products(gym_id,kind,title,price_cents,revolut_url) VALUES(?,?,?,?,?)',
            (gym_id, kind, title, price, revolut_url),
        )


def _attach_classes(db, gym_id, classes):
    for c in classes or []:
        if not isinstance(c, dict):
            continue
        title = text(c, 'title', 120)
        discipline = text(c, 'discipline', 120, required=False)
        day = c.get('day_of_week')
        if not isinstance(day, int) or not 0 <= day <= 6:
            raise Error('Day of week must be 0 (Monday) through 6 (Sunday)')
        start = text(c, 'start_time', 10)
        if not re.fullmatch(r'[0-2][0-9]:[0-5][0-9]', start):
            raise Error('Start time must be HH:MM')
        duration = c.get('duration_minutes', 60)
        if not isinstance(duration, int) or not 10 <= duration <= 300:
            raise Error('Duration must be 10-300 minutes')
        capacity = c.get('capacity', 20)
        if not isinstance(capacity, int) or not 1 <= capacity <= 500:
            raise Error('Capacity must be 1-500')
        colour = text(c, 'colour', 20, required=False)
        price_cents = c.get('per_class_price_cents')
        if price_cents is not None and (not isinstance(price_cents, int) or price_cents < 0):
            raise Error('Per-class price must be >= 0')
        db.execute(
            '''INSERT INTO gym_classes(gym_id,title,discipline,day_of_week,start_time,
                 duration_minutes,capacity,per_class_price_cents,colour)
               VALUES(?,?,?,?,?,?,?,?,?)''',
            (gym_id, title, discipline, day, start, duration, capacity, price_cents, colour),
        )


def approve_gym(db, user, enquiry_id, data):
    """Admin: approve a submitted onboarding → create a coach account."""
    require(user, 'admin')
    enquiry = one(db, 'SELECT * FROM gym_enquiries WHERE id=?', (enquiry_id,))
    if enquiry['status'] != 'submitted':
        raise Error('Only submitted onboardings can be approved', 409)
    gym = db.execute('SELECT * FROM gyms WHERE contact_email=? ORDER BY id DESC LIMIT 1',
                     (enquiry['contact_email'],)).fetchone()
    if not gym:
        raise Error('No matching gym onboarding found', 404)
    gym = dict(gym)
    import hashlib
    password = secrets.token_urlsafe(10)
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 200000).hex()
    uid = db.execute(
        'INSERT INTO portal_users(email,name,role,salt,password_hash) VALUES(?,?,?,?,?)',
        (enquiry['contact_email'], enquiry['contact_name'], 'gym', salt, hashed),
    ).lastrowid
    db.execute('UPDATE gyms SET owner_id=?, status=? WHERE id=?', (uid, 'active', gym['id']))
    db.execute('INSERT INTO coaches(user_id,gym_id,name) VALUES(?,?,?)',
               (uid, gym['id'], enquiry['contact_name']))
    db.execute(
        'UPDATE gym_enquiries SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE id=?',
        ('approved', user['id'], (data or {}).get('note', '')[:1000], enquiry_id),
    )
    wuco_mail.send(
        db,
        enquiry['contact_email'],
        'Your W.U.C.O gym page is live',
        f'Hi {enquiry["contact_name"]},\n\n{gym["name"]} is now approved on W.U.C.O. '
        f'Your coach account has been created. Sign in with:\n\n'
        f'  Email: {enquiry["contact_email"]}\n  Temporary password: {password}\n\n'
        f'Please change the password after your first sign in.',
        'gym_approved',
    )
    return {'ok': True, 'gym_id': gym['id'], 'temp_password': password}


def reject_enquiry(db, user, enquiry_id, data):
    require(user, 'admin')
    note = (data or {}).get('note', '')[:1000]
    db.execute(
        'UPDATE gym_enquiries SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE id=?',
        ('rejected', user['id'], note, number(enquiry_id)),
    )
    return {'ok': True}
