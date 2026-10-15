"""Migrate local imported forms with a verified backup and versioned templates."""
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
manifest = json.loads((root / '.tools/cms-forms.json').read_text(encoding='utf-8'))
new_block = manifest['block']
new_ref = new_block['ref']
system = new_block['designSystemRef']
db = sqlite3.connect(root / 'server/blockdesign.db')
old = {}
for identifier, version, payload in db.execute('SELECT id,version,payload FROM block_definitions'):
    block = json.loads(payload)
    if block['designSystemRef'] == system and block['category'] == 'Formlar' and block['componentTemplate'].get('tagName') == 'form':
        old[(identifier, version)] = block

def form_id(name):
    if name == 'Tur arama formu': return 'search'
    if 'Acente' in name: return 'partner'
    if 'İletişim' in name: return 'contact'
    if 'Kişiye' in name: return 'travel'
    if 'Liman' in name: return 'shore'
    if 'Transfer' in name: return 'transfer'
    return 'booking'

def convert(blocks, tree):
    replaced = {}
    for block in blocks:
        source = old.get((block['definitionRef']['id'], block['definitionRef']['version']))
        if not source: continue
        replaced[block['instanceId']] = source
        block['definitionRef'] = copy.deepcopy(new_ref)
        block['manualData'] = {}
        block['sourceBindings'] = []
        block['formBinding'] = {'providerId': 'demo-cms', 'formRef': {'id': form_id(source['name']), 'version': '1.0.0'}, 'appearance': 'inline-search' if source['name'] == 'Tur arama formu' else 'stacked', 'contextBindings': []}
    def walk(value):
        if isinstance(value, list): return [walk(child) for child in value]
        if not isinstance(value, dict): return value
        attrs = value.get('attributes', {})
        identifier = attrs.get('data-bd-placeholder-id') or attrs.get('data-bd-block-id')
        if identifier in replaced:
            source_attrs = replaced[identifier]['componentTemplate'].get('attributes', {})
            shell_attrs = {key: source_attrs[key] for key in ('id', 'class') if key in source_attrs}
            return {'type': 'default', 'tagName': 'div', 'attributes': shell_attrs, 'style': {'display': 'block'}, 'components': [{'type': 'default', 'tagName': 'div', 'attributes': {'data-bd-placeholder-id': identifier, 'data-bd-placeholder-definition': new_ref['id'] + '@' + new_ref['version']}, 'components': []}]}
        return {key: walk(child) for key, child in value.items()}
    return walk(tree), len(replaced)

templates = []
for identifier, version, payload in db.execute('SELECT id,version,payload FROM page_templates WHERE archived=0'):
    template = json.loads(payload)
    if template['designSystemRef'] != system or version != '1.0.0': continue
    updated = copy.deepcopy(template)
    updated['ref']['version'] = '1.1.0'
    updated['layout'], count = convert(updated.get('blocks', []), updated['layout'])
    updated['mandatoryBlockIds'] = list(dict.fromkeys(new_ref['id'] if any(ref[0] == key for ref in old) else key for key in updated.get('mandatoryBlockIds', [])))
    templates.append((template, updated, count))
versions = {original['ref']['id']: updated['ref'] for original, updated, _ in templates}
documents = []
for identifier, revision, payload in db.execute('SELECT id,revision,payload FROM documents'):
    document = json.loads(payload)
    if document['designSystemRef'] != system or document.get('editorState', {}).get('cmsFormMigration') == 1: continue
    document['projectData'], count = convert(document['blocks'], document['projectData'])
    ref = document.get('templateRef')
    if ref and ref['id'] in versions and ref['version'] == '1.0.0': document['templateRef'] = versions[ref['id']]
    document.setdefault('editorState', {})['cmsFormMigration'] = 1
    if document['editorState'].get('workspaceImportedFrom'): document['editorState']['workspaceImportedVersion'] = 7
    document['revision'] = str(revision + 1)
    documents.append((identifier, revision, document, count))

report = {'pages': len(documents), 'forms': sum(row[3] for row in documents), 'newTemplates': len(templates), 'archivedFormDefinitions': len(old), 'applied': args.apply}
if args.apply:
    backup = root / '.tools/backups' / ('before-cms-forms-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite')
    backup.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(backup) as snapshot:
        db.backup(snapshot)
        assert snapshot.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    report['backup'] = str(backup)
    encode = lambda payload: json.dumps(payload, ensure_ascii=False).encode('utf-8')
    with db:
        existing = db.execute('SELECT payload FROM block_definitions WHERE id=? AND version=?', (new_ref['id'], new_ref['version'])).fetchone()
        if existing and json.loads(existing[0]) != new_block: raise RuntimeError('CMS form block version already exists with different content')
        if not existing: db.execute('INSERT INTO block_definitions(id,version,design_system_id,design_system_version,archived,payload) VALUES (?,?,?,?,0,?)', (new_ref['id'], new_ref['version'], system['id'], system['version'], encode(new_block)))
        for original, updated, _ in templates:
            ref = updated['ref']
            db.execute('INSERT INTO page_templates(id,version,design_system_id,design_system_version,archived,payload) VALUES (?,?,?,?,0,?)', (ref['id'], ref['version'], system['id'], system['version'], encode(updated)))
            original['archived'] = True
            db.execute('UPDATE page_templates SET archived=1,payload=? WHERE id=? AND version=?', (encode(original), original['ref']['id'], original['ref']['version']))
        for identifier, revision, document, _ in documents:
            updated = db.execute('UPDATE documents SET revision=?,payload=?,updated_at=? WHERE id=? AND revision=?', (revision+1, encode(document), datetime.now(timezone.utc).isoformat(), identifier, revision))
            if updated.rowcount != 1: raise RuntimeError('Document changed during migration')
        for ref, definition in old.items():
            definition['archived'] = True
            db.execute('UPDATE block_definitions SET archived=1,payload=? WHERE id=? AND version=?', (encode(definition), *ref))
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    (root / '.tools/cms-form-migration.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
db.close()
print(json.dumps(report, indent=2))
