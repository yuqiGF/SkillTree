from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3

data_file = Path('/opt/skilltree/data/skilltree.db')
backup_dir = Path('/opt/skilltree/backups')
if not data_file.is_file():
    raise SystemExit('SkillTree database does not exist yet')

backup_dir.mkdir(parents=True, exist_ok=True)
destination = backup_dir / f"skilltree-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.sqlite3"
with sqlite3.connect(data_file) as source, sqlite3.connect(destination) as target:
    source.backup(target)
destination.chmod(0o600)

cutoff = datetime.now(timezone.utc) - timedelta(days=14)
for old_file in backup_dir.glob('skilltree-*.sqlite3'):
    if datetime.fromtimestamp(old_file.stat().st_mtime, timezone.utc) < cutoff:
        old_file.unlink()
print(f'Created {destination}')
