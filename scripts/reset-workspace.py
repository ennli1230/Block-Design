"""Explicit local workspace reset. Keep source HTML and a verified SQLite backup."""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
database = root / 'server' / 'blockdesign.db'
tables = ('documents', 'block_definitions', 'page_templates', 'shared_regions', 'design_system_assets', 'assets')
backup = root / '.tools' / 'backups' / ('workspace-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite')
backup.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(database) as db:
    counts = {table: db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] for table in tables}
    with sqlite3.connect(backup) as copy:
        db.backup(copy)
        assert copy.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    with db:
        for table in tables:
            db.execute(f'DELETE FROM {table}')
    assert all(db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] == 0 for table in tables)
report = {'backup': str(backup), 'removed': counts, 'remaining': {table: 0 for table in tables}}
(root / '.tools' / 'workspace-reset-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
