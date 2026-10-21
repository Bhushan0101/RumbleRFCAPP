"""Private applications, paid review queue and administrator-managed fighter profiles."""
from portal import Error, one, require, rows, number, text
from .categories import category

STATUSES=('awaiting_payment','pending_approval','approved','rejected','suspended')

def application(db,aid):
    return one(db,'''SELECT f.*,a.name,a.nickname,a.division,a.country,a.biography,a.portrait_url,
        u.email,creator.name AS submitted_by FROM fighter_profiles f JOIN athletes a ON a.id=f.athlete_id
        LEFT JOIN portal_users u ON u.id=f.user_id LEFT JOIN portal_users creator ON creator.id=f.created_by
        WHERE f.athlete_id=?''',(aid,))

def owns_application(db,user,aid):
    require(user,'fighter','admin','promoter')
    app=application(db,aid)
    if user['role']!='admin' and user['id'] not in (app['user_id'],app['created_by']):
        raise Error('This application belongs to another account',403)
    return app

def has_payment(db,aid):
    import os
    live=os.environ.get('WUCO_PAYMENT_MODE')=='stripe' and os.environ.get('STRIPE_SECRET_KEY','').startswith('sk_live_')
    return bool(db.execute("SELECT 1 FROM payments WHERE athlete_id=? AND status='paid' AND refunded_cents<amount_cents AND (?=0 OR is_test=0)",(aid,int(live))).fetchone())

def approved(db,aid):
    row=db.execute('SELECT approval_status,legacy_member FROM fighter_profiles WHERE athlete_id=?',(aid,)).fetchone()
    # Historical seeded athletes without accounts were already part of the roster.
    return row is None or (row['approval_status']=='approved' and (row['legacy_member'] or has_payment(db,aid)))

def require_approved(db,aid):
    if not approved(db,aid):raise Error('This fighter must pay the application fee and receive administrator approval before entering events or rankings.',409)

def overview(db,user):
    require(user,'admin')
    return rows(db,'''SELECT f.*,a.name,a.division,a.country,a.portrait_url,u.email,
        (SELECT receipt_number FROM payments p WHERE p.athlete_id=f.athlete_id AND p.status='paid' AND p.refunded_cents<p.amount_cents LIMIT 1) AS receipt_number,
        (SELECT id FROM payments p WHERE p.athlete_id=f.athlete_id AND p.status='paid' AND p.refunded_cents<p.amount_cents LIMIT 1) AS payment_id,
        (SELECT is_test FROM payments p WHERE p.athlete_id=f.athlete_id AND p.status='paid' AND p.refunded_cents<p.amount_cents LIMIT 1) AS payment_is_test
        FROM fighter_profiles f JOIN athletes a ON a.id=f.athlete_id LEFT JOIN portal_users u ON u.id=f.user_id
        ORDER BY CASE f.approval_status WHEN 'pending_approval' THEN 0 WHEN 'awaiting_payment' THEN 1 ELSE 2 END,a.name''')

def dispatch(db,user,method,path,data):
    require(user,'admin')
    parts=path.split('/')
    if method=='GET' and path=='fighters':return {'fighters':overview(db,user)}
    if len(parts)!=3 or parts[0]!='fighters':raise Error('Fighter route not found',404)
    aid=number(parts[1]);app=application(db,aid)
    if method=='PUT' and parts[2]=='review':
        decision=data.get('decision')
        if decision not in ('approved','rejected','suspended'):raise Error('Choose approve, reject or suspend')
        note=text(data,'note',2000,decision!='approved')
        if decision=='approved' and not app['legacy_member'] and not has_payment(db,aid):
            raise Error('The EUR 10 application fee has not been paid. Approval is blocked.',409)
        if decision=='approved' and app['approval_status'] not in ('pending_approval','suspended','approved','rejected'):
            raise Error('Only a paid pending application or suspended member can be approved',409)
        db.execute('UPDATE fighter_profiles SET approval_status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE athlete_id=?',(decision,user['id'],note,aid))
        db.execute('INSERT INTO application_audit(athlete_id,actor_id,action,note) VALUES(?,?,?,?)',(aid,user['id'],decision,note))
        return {'ok':True,'status':decision}
    if method=='PUT' and parts[2]=='profile':
        clean={}
        for key,limit in [('name',120),('nickname',120),('country',60),('biography',2000)]:
            if key in data:clean[key]=text(data,key,limit,key in ('name','country'))
        if 'division' in data:
            clean['division']=category(data['division'])
            old=one(db,'SELECT division FROM athletes WHERE id=?',(aid,))['division']
            if clean['division']!=old and db.execute('SELECT 1 FROM rankings WHERE athlete_id=?',(aid,)).fetchone():
                raise Error('Remove this fighter from their old ranking before changing category.',409)
        if not clean:raise Error('No profile fields supplied')
        db.execute(f'UPDATE athletes SET {",".join(k+"=?" for k in clean)} WHERE id=?',(*clean.values(),aid))
        if 'name' in clean and app['user_id']:db.execute('UPDATE portal_users SET name=? WHERE id=?',(clean['name'],app['user_id']))
        db.execute('INSERT INTO application_audit(athlete_id,actor_id,action,note) VALUES(?,?,?,?)',(aid,user['id'],'profile_updated',','.join(clean)))
        return {'ok':True}
    raise Error('Fighter route not found',404)
