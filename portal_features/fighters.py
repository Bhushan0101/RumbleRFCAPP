"""Fighter-owned profile editing and invitation-based gym connections."""
from portal import Error, linked_id, one, require, rows, text
from .categories import category


def lookup_gym(db, data):
    code=text(data,'code',16).upper()
    gym=db.execute('SELECT id,name,city FROM gyms WHERE join_code=?',(code,)).fetchone()
    if not gym:raise Error('Gym code not found. Ask your gym for its invitation code.',404)
    return {'gym':dict(gym),'coaches':rows(db,'SELECT id,name,gym_id FROM coaches WHERE gym_id=? ORDER BY name',(gym['id'],))}


def resolve_links(db, data, current=None):
    """Only a known invitation can connect a fighter to a different gym."""
    current=current or {}
    if 'gym_code' in data:
        code=text(data,'gym_code',16,False)
        gym=lookup_gym(db,{'code':code})['gym']['id'] if code else None
    elif 'gym_id' in data:
        gym=linked_id(db,data,'gym_id','gyms')
        if current and gym is not None and gym!=current.get('gym_id'):
            raise Error('Use the gym invitation code to change your gym')
    else:
        gym=current.get('gym_id')
    coach=linked_id(db,data,'coach_id','coaches') if 'coach_id' in data else current.get('coach_id')
    if coach:
        linked=one(db,'SELECT gym_id FROM coaches WHERE id=?',(coach,))['gym_id']
        if linked and linked!=gym:
            raise Error('Choose a coach from your selected gym, or leave the coach blank')
    return gym,coach


def update_profile(db,user,data):
    require(user,'fighter')
    profile=one(db,'SELECT * FROM fighter_profiles WHERE user_id=?',(user['id'],))
    gym,coach=resolve_links(db,data,profile)
    athlete=one(db,'SELECT * FROM athletes WHERE id=?',(profile['athlete_id'],))
    clean={}
    for key,maximum in [('name',120),('nickname',120),('country',60),('biography',2000)]:
        if key in data:clean[key]=text(data,key,maximum,key in ('name','country'))
    if 'division' in data:
        clean['division']=category(data['division'])
        if clean['division']!=athlete['division'] and db.execute('SELECT 1 FROM rankings WHERE athlete_id=?',(athlete['id'],)).fetchone():
            raise Error('Ask the app administrator to move a ranked fighter to another category.',409)
    if clean:
        db.execute(f'UPDATE athletes SET {",".join(k+"=?" for k in clean)} WHERE id=?',(*clean.values(),athlete['id']))
        if 'name' in clean:db.execute('UPDATE portal_users SET name=? WHERE id=?',(clean['name'],user['id']))
    db.execute('UPDATE fighter_profiles SET gym_id=?,coach_id=? WHERE user_id=?',(gym,coach,user['id']))
    return {'ok':True}
