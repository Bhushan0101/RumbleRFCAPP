"""Private applications and administrator-managed fighter profiles."""
from portal import Error, one, require, rows, number, text
from .categories import category

STATUSES=('pending_approval','approved','rejected','suspended')

def _assign_passport(db, aid):
    """Issue IRL-000NNN on first approval; idempotent on re-approval."""
    existing = db.execute('SELECT fighter_no FROM fighter_passports WHERE athlete_id=?',(aid,)).fetchone()
    if existing:
        return existing['fighter_no']
    nxt = db.execute("SELECT coalesce(max(cast(substr(fighter_no,5) AS INTEGER)),0)+1 AS n FROM fighter_passports WHERE fighter_no LIKE 'IRL-%'").fetchone()['n']
    fighter_no = f'IRL-{nxt:06d}'
    db.execute('INSERT INTO fighter_passports(athlete_id,fighter_no) VALUES(?,?)',(aid,fighter_no))
    return fighter_no

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

def approved(db,aid):
    row=db.execute('SELECT approval_status FROM fighter_profiles WHERE athlete_id=?',(aid,)).fetchone()
    # Historical seeded athletes without a profile row are considered part of the roster.
    return row is None or row['approval_status']=='approved'

def require_approved(db,aid):
    if not approved(db,aid):raise Error('This fighter must be approved by an administrator before entering events or rankings.',409)

def overview(db,user):
    require(user,'admin')
    return rows(db,'''SELECT f.*,a.name,a.division,a.country,a.portrait_url,a.class_code,a.martial_art,u.email
        FROM fighter_profiles f JOIN athletes a ON a.id=f.athlete_id LEFT JOIN portal_users u ON u.id=f.user_id
        ORDER BY CASE f.approval_status WHEN 'pending_approval' THEN 0 ELSE 1 END,a.name''')

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
        if decision=='approved' and app['approval_status'] not in ('pending_approval','suspended','approved','rejected'):
            raise Error('Only a pending application or suspended member can be approved',409)
        db.execute('UPDATE fighter_profiles SET approval_status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE athlete_id=?',(decision,user['id'],note,aid))
        db.execute('INSERT INTO application_audit(athlete_id,actor_id,action,note) VALUES(?,?,?,?)',(aid,user['id'],decision,note))
        if decision=='approved':
            _assign_passport(db, aid)
        return {'ok':True,'status':decision}
    if method=='PUT' and parts[2]=='profile':
        from portal import fighter_class
        clean={}
        for key,limit in [('name',120),('nickname',120),('country',60),('biography',2000),('martial_art',120)]:
            if key in data:clean[key]=text(data,key,limit,key in ('name','country'))
        if 'class_code' in data:
            clean['class_code']=fighter_class(data['class_code'])
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
