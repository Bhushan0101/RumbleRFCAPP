"""Decode and re-encode fighter photos; never serve user-supplied SVG or original metadata."""
import base64
import binascii
import io
from pathlib import Path
import secrets
import warnings
from portal import Error, one, require

MAX_PHOTO_BYTES=2*1024*1024
UPLOAD_DIR=Path(__file__).resolve().parents[1]/'public'/'assets'/'uploads'/'fighters'


def update_photo(db,user,data):
    require(user,'fighter')
    profile=one(db,'SELECT athlete_id FROM fighter_profiles WHERE user_id=?',(user['id'],))
    encoded=data.get('file')
    if encoded is None:
        db.execute('UPDATE athletes SET portrait_url=NULL WHERE id=?',(profile['athlete_id'],))
        return {'ok':True,'url':None}
    if not isinstance(encoded,str) or len(encoded)>MAX_PHOTO_BYTES*4//3+8:
        raise Error('Choose a JPEG, PNG or WebP photo up to 2 MB')
    try:raw=base64.b64decode(encoded,validate=True)
    except (ValueError,binascii.Error):raise Error('Invalid photo data')
    if not raw or len(raw)>MAX_PHOTO_BYTES:raise Error('Photo must be smaller than 2 MB after resizing')
    try:
        from PIL import Image,ImageOps,UnidentifiedImageError
    except ImportError:raise Error('Photo uploads need the packages in requirements.txt. Restart after installing them.',503)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as source:
                if source.format not in ('JPEG','PNG','WEBP'):raise Error('Use a JPEG, PNG or WebP photo')
                if source.width*source.height>20_000_000:raise Error('Photo dimensions are too large')
                source.load()
                image=ImageOps.exif_transpose(source).convert('RGB')
                image.thumbnail((1024,1024))
                output=io.BytesIO();image.save(output,'JPEG',quality=88,optimize=True)
    except Error:raise
    except Exception:raise Error('This photo could not be opened. Choose a valid JPEG, PNG or WebP image.')
    UPLOAD_DIR.mkdir(parents=True,exist_ok=True)
    filename=secrets.token_hex(16)+'.jpg'
    target=UPLOAD_DIR/filename
    url='assets/uploads/fighters/'+filename
    try:
        target.write_bytes(output.getvalue())
        db.execute('UPDATE athletes SET portrait_url=? WHERE id=?',(url,profile['athlete_id']))
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return {'ok':True,'url':url}
