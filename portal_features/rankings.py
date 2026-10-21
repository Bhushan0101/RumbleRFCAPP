"""Manual ranked-position publication. Workbook imports remain in ranking_excel.py."""
from portal import require,number,one,rows,Error
from .categories import category

def update_position(db,user,data):
    require(user,'admin')
    aid,position=number(data.get('athlete_id')),number(data.get('position'))
    athlete=one(db,'SELECT * FROM athletes WHERE id=?',(aid,))
    from .applications import require_approved
    require_approved(db,aid)
    division=category(athlete['division'])
    current=rows(db,'SELECT * FROM rankings WHERE division=? ORDER BY position',(division,))
    ordered=[r['athlete_id'] for r in current if r['athlete_id']!=aid]
    if position>len(ordered)+1: raise Error('Choose a position within the division ranking')
    ordered.insert(position-1,aid)
    prior={r['athlete_id']:r['position'] for r in current}
    db.execute('DELETE FROM rankings WHERE division=?',(division,))
    for rank,fid in enumerate(ordered,1):
        db.execute('INSERT INTO rankings(division,athlete_id,position,movement,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)',(division,fid,rank,prior.get(fid,rank)-rank))
    return {'ok':True}
