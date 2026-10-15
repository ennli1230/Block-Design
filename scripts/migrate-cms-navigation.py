"""Pin current pages/templates to CMS-backed navigation, preserving previous versions."""
import argparse, copy, json, sqlite3
from datetime import datetime, timezone
from pathlib import Path

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
manifest=json.loads((root/'.tools/cms-navigation.json').read_text(encoding='utf-8'))
regions=manifest['regions'];refs={r['ref']['id']:r for r in regions}
db=sqlite3.connect(root/'server/blockdesign.db')
def update(value):
    if isinstance(value,list):
        for child in value:update(child)
    elif isinstance(value,dict):
        attrs=value.get('attributes',{})
        pin=attrs.get('data-bd-region-ref')
        if pin:
            identifier,_,version=pin.rpartition('@')
            if identifier in refs and version=='1.0.0':attrs['data-bd-region-ref']=identifier+'@1.1.0'
        for child in value.values():update(child)

templates=[]
for identifier,version,payload in db.execute('SELECT id,version,payload FROM page_templates WHERE archived=0'):
    original=json.loads(payload)
    if original['designSystemRef']['id']!='system.scalanova-tr' or version!='1.2.0':continue
    template=copy.deepcopy(original);template['ref']['version']='1.3.0'
    for ref in template.get('sharedRegionRefs',[]):
        if ref['id'] in refs:ref['version']='1.1.0'
    update(template.get('layout',{}));templates.append((original,template))
versions={original['ref']['id']:updated['ref'] for original,updated in templates}
documents=[]
for identifier,revision,payload in db.execute('SELECT id,revision,payload FROM documents'):
    document=json.loads(payload);changed=False
    for ref in document.get('sharedRegionRefs',[]):
        if ref['id'] not in refs:continue
        if ref['version']=='1.1.0':
            values=document.get('sharedRegionData',{}).get(ref['id']+'@1.1.0',{})
            for repeater in refs[ref['id']].get('repeaters',[]):
                for row in values.get(repeater['key'],[]):
                    for child in repeater.get('childRepeaters',[]):
                        if child['key'] not in row:row[child['key']]=[];changed=True
            continue
        if ref['version']!='1.0.0':continue
        changed=True;old=ref['id']+'@1.0.0';ref['version']='1.1.0';new=ref['id']+'@1.1.0'
        values=copy.deepcopy(document.get('sharedRegionData',{}).get(old,refs[ref['id']]['defaultData']))
        if refs[ref['id']]['region']=='header':
            for repeater in refs[ref['id']]['repeaters'][1:]:values[repeater['key']]=copy.deepcopy(refs[ref['id']]['defaultData'][repeater['key']])
        for repeater in refs[ref['id']].get('repeaters',[]):
            for row in values.get(repeater['key'],[]):
                for child in repeater.get('childRepeaters',[]):row.setdefault(child['key'],[])
        document.setdefault('sharedRegionData',{})[new]=values
    if not changed:continue
    update(document['projectData'])
    template=document.get('templateRef')
    if template and template['id'] in versions and template['version']=='1.2.0':document['templateRef']=versions[template['id']]
    document['revision']=str(revision+1);documents.append((identifier,revision,document))
report={'pages':len(documents),'templates':len(templates),'regions':len(regions),'databaseMenus':len(manifest['groups']),'applied':args.apply}
if args.apply and (documents or templates):
    backup=root/'.tools/backups'/('before-cms-navigation-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.sqlite');backup.parent.mkdir(parents=True,exist_ok=True)
    with sqlite3.connect(backup) as snapshot:
        db.backup(snapshot);assert snapshot.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    report['backup']=str(backup)
    encode=lambda value:json.dumps(value,ensure_ascii=False).encode('utf-8')
    with db:
        for region in regions:
            ref=region['ref'];system=region['designSystemRef']
            existing=db.execute('SELECT payload FROM shared_regions WHERE id=? AND version=?',(ref['id'],ref['version'])).fetchone()
            if existing and json.loads(existing[0])!=region:raise RuntimeError('Existing region version differs from migration manifest')
            if not existing:db.execute('INSERT INTO shared_regions(id,version,design_system_id,design_system_version,archived,payload) VALUES (?,?,?,?,0,?)',(ref['id'],ref['version'],system['id'],system['version'],encode(region)))
            previous=json.loads(db.execute('SELECT payload FROM shared_regions WHERE id=? AND version=?',(ref['id'],'1.0.0')).fetchone()[0]);previous['archived']=True
            db.execute('UPDATE shared_regions SET archived=1,payload=? WHERE id=? AND version=?',(encode(previous),ref['id'],'1.0.0'))
        for previous,template in templates:
            ref=template['ref'];system=template['designSystemRef']
            db.execute('INSERT INTO page_templates(id,version,design_system_id,design_system_version,archived,payload) VALUES (?,?,?,?,0,?)',(ref['id'],ref['version'],system['id'],system['version'],encode(template)))
            previous['archived']=True;db.execute('UPDATE page_templates SET archived=1,payload=? WHERE id=? AND version=?',(encode(previous),previous['ref']['id'],previous['ref']['version']))
        for identifier,revision,document in documents:
            result=db.execute('UPDATE documents SET revision=?,payload=?,updated_at=? WHERE id=? AND revision=?',(revision+1,encode(document),datetime.now(timezone.utc).isoformat(),identifier,revision))
            if result.rowcount!=1:raise RuntimeError('Page changed during migration')
    (root/'.tools/cms-navigation-migration.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
db.close();print(json.dumps(report,indent=2))
