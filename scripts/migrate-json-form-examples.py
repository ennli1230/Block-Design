"""Rebind current pages and version templates to the public JSON form examples.

Dry run by default. An apply first creates and verifies a SQLite backup.
Only form references and the corresponding template references are changed.
"""
import argparse
import copy
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
base = root / 'apps/demo/public/cms-forms'
catalog = json.loads((base / 'catalog.json').read_text(encoding='utf-8'))
refs = {item['ref']['id']: item['ref'] for item in catalog['items']}
for ref in refs.values():
    schema = json.loads((base / ref['id'] / (ref['version'] + '.json')).read_text(encoding='utf-8'))
    assert schema['ref'] == ref

db = sqlite3.connect(root / 'server/blockdesign.db')
def update_bindings(blocks):
    count = 0
    for block in blocks:
        binding = block.get('formBinding')
        if not binding or binding['providerId'] != 'demo-cms': continue
        ref = refs.get(binding['formRef']['id'])
        if ref and ref != binding['formRef']:
            binding['formRef'] = copy.deepcopy(ref)
            count += 1
    return count

templates = []
for identifier, version, payload in db.execute('SELECT id,version,payload FROM page_templates WHERE archived=0'):
    original = json.loads(payload)
    if original['designSystemRef']['id'] != 'system.scalanova-tr' or version != '1.1.0': continue
    updated = copy.deepcopy(original)
    count = update_bindings(updated.get('blocks', []))
    updated['ref']['version'] = '1.2.0'
    templates.append((original, updated, count))
versions = {original['ref']['id']: updated['ref'] for original, updated, _ in templates}

documents = []
for identifier, revision, payload in db.execute('SELECT id,revision,payload FROM documents'):
    document = json.loads(payload)
    count = update_bindings(document.get('blocks', []))
    ref = document.get('templateRef')
    template_changed = bool(ref and ref['id'] in versions and ref['version'] == '1.1.0')
    if template_changed: document['templateRef'] = versions[ref['id']]
    if count or template_changed:
        document['revision'] = str(revision + 1)
        documents.append((identifier, revision, document, count))

report = {'pages': len(documents), 'formInstances': sum(row[3] for row in documents), 'newTemplates': len(templates), 'applied': args.apply}
if args.apply and (documents or templates):
    backup = root / '.tools/backups' / ('before-json-form-examples-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite')
    backup.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(backup) as snapshot:
        db.backup(snapshot)
        assert snapshot.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    report['backup'] = str(backup)
    encode = lambda value: json.dumps(value, ensure_ascii=False).encode('utf-8')
    with db:
        for original, updated, _ in templates:
            ref = updated['ref']
            system = updated['designSystemRef']
            db.execute('INSERT INTO page_templates(id,version,design_system_id,design_system_version,archived,payload) VALUES (?,?,?,?,0,?)', (ref['id'], ref['version'], system['id'], system['version'], encode(updated)))
            original['archived'] = True
            db.execute('UPDATE page_templates SET archived=1,payload=? WHERE id=? AND version=?', (encode(original), original['ref']['id'], original['ref']['version']))
        for identifier, revision, document, _ in documents:
            result = db.execute('UPDATE documents SET revision=?,payload=?,updated_at=? WHERE id=? AND revision=?', (revision+1, encode(document), datetime.now(timezone.utc).isoformat(), identifier, revision))
            if result.rowcount != 1: raise RuntimeError('Page changed while updating form references')
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    (root / '.tools/json-form-example-migration.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
db.close()
print(json.dumps(report, indent=2))
