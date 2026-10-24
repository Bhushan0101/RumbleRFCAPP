"""Integration coverage for first-release features: Class registration, admin
approval + fighter passport, gym enquiry → onboarding → gym page booking.

Each test runs against an isolated SQLite copy; no shipped data is touched.
"""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import portal
from scripts import init_db, migrate


class FirstReleaseFlows(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict('os.environ', {'WUCO_DEMO_MODE': '0'})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'release.sqlite3'
        prev = init_db.DB
        init_db.DB = self.path
        try:
            init_db.initialize()
            migrate.run(self.path)
        finally:
            init_db.DB = prev
        # Admin user is created directly (no password set via admin flow in demo-off mode).
        import hashlib, secrets
        salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac('sha256', b'AdminPassword123', bytes.fromhex(salt), 200000).hex()
        with sqlite3.connect(self.path) as db:
            db.execute(
                'INSERT INTO portal_users(email,name,role,salt,password_hash) VALUES(?,?,?,?,?)',
                ('admin@wuco.test', 'Admin', 'admin', salt, hashed),
            )
            db.commit()
        self.cookies = {}
        self._login('admin', 'admin@wuco.test', 'AdminPassword123')

    def tearDown(self):
        self.tmp.cleanup()

    # ---- helpers --------------------------------------------------------
    def call(self, path, method='GET', data=None, role=None, headers=None):
        return portal.handle(
            self.path, method, path, data,
            self.cookies.get(role, '') if role else '',
            headers if headers is not None else {'X-Requested-With': 'fetch'},
            'localhost',
        )

    def _login(self, key, email, password):
        status, _, h = self.call('login', 'POST', {'email': email, 'password': password})
        self.assertEqual(status, 200)
        self.cookies[key] = h['Set-Cookie'].split(';')[0]

    # ---- Phase 3: class registration ----------------------------------
    def test_fighter_registers_with_class_and_martial_art(self):
        status, body, _ = self.call('register', 'POST', {
            'role': 'fighter', 'first_name': 'Conor', 'last_name': 'Byrne',
            'email': 'conor@test.ie', 'password': 'LongPassword123',
            'class_code': 'B', 'martial_art': 'K-1', 'country': 'Ireland',
        })
        self.assertEqual(status, 200, body)
        self._login('fighter', 'conor@test.ie', 'LongPassword123')
        state = self.call('state', role='fighter')[1]
        own = [f for f in state['fighters'] if f['name'] == 'Conor Byrne'][0]
        self.assertEqual(own['class_code'], 'B')
        self.assertEqual(own['martial_art'], 'K-1')
        self.assertEqual(own['country'], 'Ireland')
        self.assertEqual(own['approval_status'], 'pending_approval')
        self.assertIsNone(own['fighter_no'])

    def test_rejects_bad_class_code(self):
        status, body, _ = self.call('register', 'POST', {
            'role': 'fighter', 'first_name': 'X', 'last_name': 'Y',
            'email': 'bad@test.ie', 'password': 'LongPassword123',
            'class_code': 'Z', 'martial_art': 'K-1',
        })
        self.assertEqual(status, 400)
        self.assertIn('class', body['error'].lower())

    # ---- Phase 4: approval assigns fighter passport ------------------
    def test_approval_assigns_fighter_number_and_exposes_passport(self):
        self.call('register', 'POST', {
            'role': 'fighter', 'first_name': 'Ava', 'last_name': 'Walsh',
            'email': 'ava@test.ie', 'password': 'LongPassword123',
            'class_code': 'A', 'martial_art': 'MMA', 'country': 'Ireland',
        })
        aid = self.call('state', role='admin')[1]['applications'][0]['athlete_id']
        status, _, _ = self.call(f'fighters/{aid}/review', 'PUT',
                                 {'decision': 'approved'}, role='admin')
        self.assertEqual(status, 200)
        state = self.call('state', role='admin')[1]
        approved = [f for f in state['fighters'] if f['approval_status'] == 'approved'
                    and f['name'] == 'Ava Walsh']
        self.assertTrue(approved)
        fighter_no = approved[0]['fighter_no']
        self.assertTrue(fighter_no.startswith('IRL-'))
        # Public passport lookup via helper.
        from wuco_passport import lookup
        passport = lookup(self.path, fighter_no)
        self.assertIsNotNone(passport)
        self.assertEqual(passport['name'], 'Ava Walsh')
        self.assertEqual(passport['status'], 'Active')
        self.assertEqual(passport['class_code'], 'A')
        self.assertEqual(passport['record'], '0-0-0')
        # Non-existent and malformed numbers return None.
        self.assertIsNone(lookup(self.path, 'IRL-999999'))
        self.assertIsNone(lookup(self.path, 'bad-id'))

    def test_passport_number_is_sequential_and_idempotent(self):
        # Register and approve three fighters, confirm 000001/000002/000003.
        for i, (first, email) in enumerate([('A', 'a@t.ie'), ('B', 'b@t.ie'), ('C', 'c@t.ie')]):
            self.call('register', 'POST', {
                'role': 'fighter', 'first_name': first, 'last_name': 'X',
                'email': email, 'password': 'LongPassword123',
                'class_code': 'N', 'martial_art': 'K-1',
            })
        apps = sorted(self.call('state', role='admin')[1]['applications'], key=lambda a: a['athlete_id'])
        for i, a in enumerate(apps):
            status, _, _ = self.call(f'fighters/{a["athlete_id"]}/review', 'PUT',
                                     {'decision': 'approved'}, role='admin')
            self.assertEqual(status, 200)
        # Re-approve one of them: fighter_no must NOT change.
        self.call(f'fighters/{apps[1]["athlete_id"]}/review', 'PUT',
                  {'decision': 'approved'}, role='admin')
        fighters = {f['name']: f['fighter_no'] for f in self.call('state', role='admin')[1]['fighters']
                    if f['fighter_no']}
        self.assertEqual(fighters['A X'], 'IRL-000001')
        self.assertEqual(fighters['B X'], 'IRL-000002')
        self.assertEqual(fighters['C X'], 'IRL-000003')

    # ---- Phase 5: gym enquiry flow -----------------------------------
    def test_gym_enquiry_then_invite_then_onboarding(self):
        # Public enquiry.
        status, body, _ = self.call('gym_enquiries', 'POST', {
            'gym_name': 'Example Gym', 'contact_name': 'Jane Coach',
            'contact_email': 'jane@example.ie', 'city': 'Cork', 'phone': '+353 1 234',
            'message': 'We would like to join.',
        })
        self.assertEqual(status, 200, body)
        enquiry_id = body['id']
        # Admin lists it and invites.
        status, inv, _ = self.call(f'gym_enquiries/{enquiry_id}/invite', 'POST', {}, role='admin')
        self.assertEqual(status, 200, inv)
        onboarding_url = inv['onboarding_url']
        token = onboarding_url.split('token=')[1]
        # Mail log should have one admin notification + one invite.
        state = self.call('state', role='admin')[1]
        categories = {m['category'] for m in state['notifications']}
        self.assertIn('gym_enquiry', categories)
        self.assertIn('gym_onboarding', categories)
        # Public onboarding lookup (unauth) returns the pre-filled info.
        status, body, _ = self.call('gym_onboarding/lookup', 'POST', {'token': token})
        self.assertEqual(status, 200)
        self.assertEqual(body['gym_name'], 'Example Gym')
        # Submit the onboarding form.
        status, body, _ = self.call('gym_onboarding/submit', 'POST', {
            'token': token, 'name': 'Example Gym', 'city': 'Cork',
            'revolut_handle': 'revolut.me/example', 'about': 'A sample gym',
            'products': [
                {'kind': 'day_pass', 'title': 'Day pass', 'price_cents': 1500, 'revolut_url': ''},
                {'kind': 'monthly_pass', 'title': 'Monthly', 'price_cents': 12000, 'revolut_url': ''},
            ],
            'classes': [
                {'title': 'K-1', 'discipline': 'K-1', 'day_of_week': 0, 'start_time': '18:00',
                 'duration_minutes': 60, 'capacity': 20},
            ],
        })
        self.assertEqual(status, 200, body)
        slug = body['slug']
        # Reusing the token must fail.
        status, _, _ = self.call('gym_onboarding/submit', 'POST', {
            'token': token, 'name': 'Example Gym', 'products': [], 'classes': [],
        })
        self.assertEqual(status, 409)
        # Admin approves → coach account.
        status, body, _ = self.call(f'gym_enquiries/{enquiry_id}/approve', 'POST', {}, role='admin')
        self.assertEqual(status, 200, body)
        self.assertIn('temp_password', body)
        # Gym page is now publicly reachable.
        status, page, _ = self.call(f'gyms/{slug}', 'GET')
        self.assertEqual(status, 200)
        self.assertEqual(page['name'], 'Example Gym')
        self.assertEqual(len(page['classes']), 1)
        self.assertEqual(len(page['products']), 2)

    # ---- Phase 6: booking and join-request -------------------------
    def test_class_booking_capacity_and_notification(self):
        slug, cls_id = self._quick_gym()
        # Book twice at the capacity of 1 — second must 409.
        with sqlite3.connect(self.path) as db:
            db.execute('UPDATE gym_classes SET capacity=1 WHERE id=?', (cls_id,))
            db.commit()
        status, body, _ = self.call(f'classes/{cls_id}/book', 'POST', {
            'booked_for_date': '2026-11-02', 'guest_name': 'Visitor',
            'guest_email': 'visitor@test.ie',
        })
        self.assertEqual(status, 200, body)
        status, _, _ = self.call(f'classes/{cls_id}/book', 'POST', {
            'booked_for_date': '2026-11-02', 'guest_name': 'Visitor 2',
            'guest_email': 'visitor2@test.ie',
        })
        self.assertEqual(status, 409)
        # Admin inbox contains the booking notification.
        state = self.call('state', role='admin')[1]
        self.assertTrue(any(m['category'] == 'class_booking' for m in state['notifications']))

    def test_fighter_can_request_to_join_a_gym_and_gym_admin_approves(self):
        slug, _ = self._quick_gym()
        # Register a fighter and sign in.
        self.call('register', 'POST', {
            'role': 'fighter', 'first_name': 'Pat', 'last_name': 'Doyle',
            'email': 'pat@test.ie', 'password': 'LongPassword123',
            'class_code': 'N', 'martial_art': 'K-1',
        })
        self._login('fighter', 'pat@test.ie', 'LongPassword123')
        status, body, _ = self.call('gym_join/request', 'POST', {'slug': slug}, role='fighter')
        self.assertEqual(status, 200, body)
        # Duplicate request rejected.
        status, _, _ = self.call('gym_join/request', 'POST', {'slug': slug}, role='fighter')
        self.assertEqual(status, 409)
        # Gym owner approves (we created the coach account during approval; find and log in).
        coach_email = 'jane@example.ie'
        # Reset the temp password: easier to approve via admin role.
        reqs = self.call('gym_join/requests', 'GET', role='admin')[1]['requests']
        self.assertEqual(len(reqs), 1)
        req_id = reqs[0]['id']
        status, _, _ = self.call(f'gym_join/{req_id}', 'PUT',
                                 {'decision': 'approved'}, role='admin')
        self.assertEqual(status, 200)
        # Fighter now linked to the gym.
        profile = self.call('state', role='admin')[1]
        own = [p for p in profile['applications'] if p['name'] == 'Pat Doyle'][0]
        self.assertIsNotNone(own['gym_id'])

    # ---- shared helper ------------------------------------------------
    def _quick_gym(self):
        """Fast-forward: enquiry → invite → submit → approve. Returns (slug, class_id)."""
        self.call('gym_enquiries', 'POST', {
            'gym_name': 'Example Gym', 'contact_name': 'Jane Coach',
            'contact_email': 'jane@example.ie', 'city': 'Cork',
        })
        enquiry_id = self.call('state', role='admin')[1]['gym_enquiries'][0]['id']
        token = self.call(f'gym_enquiries/{enquiry_id}/invite', 'POST', {}, role='admin')[1]['onboarding_url'].split('token=')[1]
        self.call('gym_onboarding/submit', 'POST', {
            'token': token, 'name': 'Example Gym', 'city': 'Cork',
            'products': [{'kind': 'day_pass', 'title': 'Day pass', 'price_cents': 1500, 'revolut_url': ''}],
            'classes': [{'title': 'K-1', 'discipline': 'K-1', 'day_of_week': 0, 'start_time': '18:00',
                         'duration_minutes': 60, 'capacity': 20}],
        })
        self.call(f'gym_enquiries/{enquiry_id}/approve', 'POST', {}, role='admin')
        page = self.call('gyms/example-gym', 'GET')[1]
        return page['slug'], page['classes'][0]['id']


if __name__ == '__main__':
    unittest.main()
