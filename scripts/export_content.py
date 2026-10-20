"""Refresh the standalone static site's JSON from SQLite."""
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from server import get_content
from scripts.init_db import initialize, DB
from scripts import migrate
initialize()
migrate.run(DB)
p=ROOT/'public'/'data'/'content.json'
p.parent.mkdir(exist_ok=True)
p.write_text(json.dumps(get_content(),ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Exported {p}')
