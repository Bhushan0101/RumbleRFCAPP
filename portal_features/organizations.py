"""Gym, coach and promotion account settings; independent from fighter profiles."""
from portal import linked_id,require,text

def update_profile(db,user,data):
    require(user,'gym','coach','promoter')
    if user['role']=='coach':
        if data.get('gym_code'):
            from .fighters import lookup_gym
            gym=lookup_gym(db,{'code':data['gym_code']})['gym']['id']
        else: gym=linked_id(db,data,'gym_id','gyms')
        db.execute('UPDATE coaches SET gym_id=? WHERE user_id=?',(gym,user['id']))
    elif user['role']=='gym':
        db.execute('UPDATE gyms SET name=?,city=? WHERE owner_id=?',(text(data,'organization'),text(data,'city',120,False),user['id']))
    else:
        db.execute('UPDATE promotions SET name=? WHERE owner_id=?',(text(data,'organization'),user['id']))
    return {'ok':True}
