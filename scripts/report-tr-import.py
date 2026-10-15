"""Read-only acceptance report for the completed Turkish source import."""
import json
import sqlite3
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
db = sqlite3.connect(f'file:{(root / "server/blockdesign.db").as_posix()}?mode=ro', uri=True)
def records(table):
    return [json.loads(row[0]) for row in db.execute(f'SELECT payload FROM {table}')]
system = 'system.scalanova-tr'
pages = [p for p in records('documents') if p['designSystemRef']['id'] == system and p.get('editorState', {}).get('workspaceImportedFrom')]
blocks = [b for b in records('block_definitions') if b['designSystemRef']['id'] == system and not b.get('archived')]
templates = [t for t in records('page_templates') if t['designSystemRef']['id'] == system and not t.get('archived')]
regions = [r for r in records('shared_regions') if r['designSystemRef']['id'] == system and not r.get('archived')]
manifest_path = root / 'imports/tr/manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
expected = {'/html/' + p['source'] for p in manifest['pages']}
assert {p['editorState']['workspaceImportedFrom'] for p in pages} == expected
assert len(pages) == len(expected) == 32
assert len(templates) == 6 and len(regions) == 2
assert all(p.get('localization', {}).get('locale') == 'tr' for p in pages)
assert all(p['editorState']['workspaceImportedVersion'] == 7 for p in pages)
assert [b['name'] for b in blocks if b['category'] == 'Formlar'] == ['CMS Formu']
assert all(b.get('formBinding', {}).get('providerId') == 'demo-cms' for p in pages for b in p['blocks'] if b['definitionRef']['id'] == 'blockdesign.cms-form')
for name in ('Açıklama', 'Başlık', 'Üst başlık'):
    matches = [b for b in blocks if b['name'] == name]
    assert len(matches) == 1 and len(matches[0]['fields']) == 1 and not matches[0]['repeaters']
description = next(b for b in blocks if b['name'] == 'Açıklama')
assert description['defaultData']['text'].startswith('Lorem ipsum')
assert description['componentTemplate']['components'][0]['content'] == description['defaultData']['text']
assert not any(b['name'] in ('Buton', 'Metin') for b in blocks)
assert {b['category'] for b in blocks} == {'Metin', 'Medya', 'Kartlar ve listeler', 'Formlar', 'Gezinme ve eylemler', 'Etkileşim'}
assert all(b['designSystemRef']['id'] == system for b in records('block_definitions'))
refs = {(b['ref']['id'], b['ref']['version']) for b in blocks}
assert all((b['definitionRef']['id'], b['definitionRef']['version']) in refs for p in pages for b in p['blocks'])
assert all((b['definitionRef']['id'], b['definitionRef']['version']) in refs for t in templates for b in t['blocks'])
faq = [b for b in blocks if b['name'] == 'Akordeon']
assert len(faq) == 1 and not faq[0]['fields'] and len(faq[0]['repeaters']) == 1
manifest['status'] = 'imported'
manifest['importedDesignSystem'] = {'id': system, 'version': '1.0.0'}
manifest['importedCounts'] = {'pages': len(pages), 'blocks': len(blocks), 'templates': len(templates), 'sharedRegions': len(regions)}
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
lines = ['# TR aktarım raporu', '', '14 Ekim 2026 · `system.scalanova-tr@1.0.0` · aktarım sürümü 7', '',
         f'Eski çalışma alanı yedeklenip sıfırlandı. {len(pages)} Türkçe sayfa, {len(blocks)} blok, {len(templates)} şablon ve {len(regions)} ortak bölge yeniden kaydedildi. Studio Neutral ve eski deneme kayıtları etkin katalogdan çıkarıldı.', '',
         'Tek bir Açıklama bloğu vardır: tek alan ve Lorem ipsum örnek değeri. Başlık ve üst başlık da birer ortak tanım kullanır. Sayfalardaki özgün Türkçe içerik bağımsız örnek verisi olarak korunur; her metin için yeni katalog bloğu oluşturulmaz. Section, p, başlık etiketleri ve CSS sınıfları sayfa yerleşiminde kalır. Paragraf içindeki bağlantılar ve vurgular korunur.', '',
         'Kategoriler: Metin; Medya; Kartlar ve listeler; Formlar; Gezinme ve eylemler; Etkileşim. Tek seferlik butonlar ve rastgele yaprak metinler katalog bloğuna dönüşmez. Formlar amaçlarına, listeler içerik yapılarına göre adlandırılır. Farklı kart ve liste HTML yapıları ayrı tasarım varyantları olarak korunur.', '',
         'Her sayfa kaydında kendi içerikleri, şablon sürümü, header/footer alanları ve SEO bilgileri bulunur. Aktarım açık bir yönetim işlemiyle başlatılır. Tekrar çalıştırıldığında kaynak yoluna göre mevcut belgeler bulunur ve kullanıcı düzenlemelerinin üstüne yazılmaz.', '',
         'İlk kayıttan önce tüm belgeler sözleşme doğrulamasından geçer ve 32 sayfanın form dışındaki ana içerik metni kaynak HTML ile karşılaştırılır (boşluklar hariç). Form alanları CMS tanımından üretildiği için kaynak HTML form metniyle karşılaştırılmaz. Tam bölüm örnekleri imports/tr/pages içinde referans olarak tutulur; tam bölümler blok kataloğuna dönüşmez.', '',
         'Katalogda tek CMS Formu bileşeni vardır. Önceki bağımsız form tanımları ve eski şablonlar arşivdedir; güncel şablonlar 1.3.0 sürümünü kullanır. Yedi örnek form, /cms-forms/ altındaki 1.1.0 JSON tanımlarından HTTP ile yüklenir. Form örnekleri ekranında form seçilebilir, JSON görülebilir ve ilgili sayfaya geçilebilir. Önizlemede gerçek başvuru gönderilmez. Gerçek gönderim için host form adapter’ı gerekir. HTML içindeki rastgele JavaScript yürütülmez.', '',
         'Header/footer 1.1.0 sürümleri CMS menü kayıtlarına bağlıdır: ID 1 header ve hamburger; ID 2 footer hizmetler; ID 3 footer kurumsal; ID 4 footer yasal bağlantılar. Yerel referansta menüler SQLite cms_menus tablosundan çözülür. Runtime kodu menü öğesi veya B2B bağlantısı eklemez; alt menüler kaydın children listesinden oluşur.', '',
         '## Bileşen türleri', '', '| Tür | Tasarım varyantı |', '|---|---:|']
for name, count in sorted(Counter(b['name'] for b in blocks).items()):
    lines.append(f'| {name} | {count} |')
lines += ['', '## Kaydedilmiş sayfalar', '', '| Kaynak | Belge kimliği |', '|---|---|']
for p in sorted(pages, key=lambda p:p['editorState']['workspaceImportedFrom']):
    lines.append(f'| {p["editorState"]["workspaceImportedFrom"]} | `{p["documentId"]}` |')
(root / 'imports/tr/AKTARIM-RAPORU.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(json.dumps(manifest['importedCounts']))
