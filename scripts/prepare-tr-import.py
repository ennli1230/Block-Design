"""Stage original Turkish HTML fragments; optionally reset the retired Go import.
No packages required. This script never publishes or creates backend catalog records.
"""
import argparse
import hashlib
import json
import re
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
LEGACY = re.compile(r'block\.scalanova-tr-|region\.scalanova-tour-|template\.scalanova-tour-|base-view\.scalanova-tour-|/scalanova-tour/')


class Node:
    def __init__(self, tag, attrs, start, opening_end, parent=None):
        self.tag, self.attrs, self.start, self.opening_end = tag, dict(attrs), start, opening_end
        self.parent, self.children, self.end, self.text = parent, [], opening_end, []

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()


class SourceParser(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source, self.stack, self.roots = source, [], []
        self.lines = [0]
        for match in re.finditer('\n', source):
            self.lines.append(match.end())
        self.feed(source)
        self.close()
        if self.stack:
            raise ValueError('Unclosed HTML tags: ' + ', '.join(node.tag for node in self.stack))

    def position(self):
        line, column = self.getpos()
        return self.lines[line - 1] + column

    def handle_starttag(self, tag, attrs):
        start = self.position()
        node = Node(tag, attrs, start, start + len(self.get_starttag_text()), self.stack[-1] if self.stack else None)
        (node.parent.children if node.parent else self.roots).append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1].tag != tag:
            raise ValueError('Mismatched HTML closing tag: ' + tag)
        self.stack.pop().end = self.source.index('>', self.position()) + 1

    def handle_data(self, text):
        for node in self.stack:
            node.text.append(text)

    def nodes(self):
        return [node for root in self.roots for node in root.walk()]


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def component_kind(node):
    classes = set((node.attrs.get('class') or '').split())
    if node.tag == 'img' and 'brand-logo' in classes: return 'logo'
    if 'data-nav-links' in node.attrs: return 'navigation'
    if 'data-language-select' in node.attrs: return 'language-selector'
    if 'data-menu-toggle' in node.attrs: return 'mobile-menu-toggle'
    if 'hero-slide' in classes: return 'slider-item'
    if 'faq-list' in classes: return 'accordion-list'
    if node.tag == 'details' and node.parent and 'faq-list' in (node.parent.attrs.get('class') or ''): return 'accordion-item'
    if 'section-heading' in classes or 'faq-heading' in classes: return 'section-heading'
    for name in ['journal-card', 'service-card', 'activity-row', 'place-item']:
        if name in classes: return name
    if node.tag == 'form': return 'form'
    if 'route-trigger' in classes: return 'route-toggle'
    if node.tag == 'nav' and 'breadcrumb' in (node.attrs.get('class') or ''): return 'breadcrumb'
    return None


def skeleton(node):
    # Text, URLs, selected locale and active flags are content, not new designs.
    classes = sorted(set((node.attrs.get('class') or '').split()) - {'is-active'})
    return [node.tag, classes, [skeleton(child) for child in node.children]]


def stage():
    output = ROOT / 'imports' / 'tr'
    pages, families, components = [], Counter(), {}
    for path in sorted((ROOT / 'html' / 'tr').rglob('*.html')):
        source = path.read_text(encoding='utf-8')
        tree = SourceParser(source)
        nodes = tree.nodes()
        for node in nodes:
            kind = component_kind(node)
            if not kind: continue
            signature = digest(json.dumps(skeleton(node)))[:12]
            key = f'{kind}-{signature}'
            if key not in components:
                folder = output / 'components' / kind
                folder.mkdir(parents=True, exist_ok=True)
                component_path = folder / f'{signature}.html'
                component_path.write_text(source[node.start:node.end], encoding='utf-8')
                components[key] = {'kind': kind, 'status': 'source-extracted-unmapped', 'file': component_path.relative_to(output).as_posix(), 'exampleSource': path.relative_to(ROOT / 'html').as_posix(), 'uses': 0}
            components[key]['uses'] += 1
        main = next(node for node in nodes if node.tag == 'main')
        relative = path.relative_to(ROOT / 'html').as_posix()
        destination = output / 'pages' / path.relative_to(ROOT / 'html' / 'tr').parent
        destination.mkdir(parents=True, exist_ok=True)
        fragments = []
        for role in ['head', 'header', 'footer']:
            candidates = [node for node in nodes if node.tag == role and (role == 'head' or node.parent and node.parent.tag == 'body')]
            if len(candidates) != 1:
                raise ValueError(f'{relative}: expected exactly one site {role}, got {len(candidates)}')
            fragment = source[candidates[0].start:candidates[0].end]
            (destination / f'{role}.html').write_text(fragment, encoding='utf-8')
        for index, node in enumerate(main.children, 1):
            classes = node.attrs.get('class', '') or ''
            heading = next((child for child in node.walk() if child.tag in {'h1', 'h2', 'h3'}), None)
            family = classes or node.tag
            families[family] += 1
            filename = f'{index:02d}-{re.sub(r"[^a-z0-9-]+", "-", family.lower()).strip("-")}.html'
            fragment = source[node.start:node.end]
            (destination / filename).write_text(fragment, encoding='utf-8')
            fragments.append({'order': index, 'tag': node.tag, 'classes': classes, 'family': family,
                              'heading': ' '.join(''.join(heading.text).split()) if heading else '',
                              'file': (destination / filename).relative_to(output).as_posix(),
                              'sha256': digest(fragment),
                              'repeaterCandidates': [{'tag': child.tag, 'class': child.attrs.get('class', ''), 'count': len(child.children)} for child in node.walk() if child.tag in {'ul', 'ol'} or 'faq-list' in (child.attrs.get('class', '') or '')],
                              'behaviors': sorted({key for child in node.walk() for key in child.attrs if key.startswith('data-')})})
        # Keep the complete main as an exact assembly reference, including whitespace.
        (destination / 'main-reference.html').write_text(source[main.start:main.end], encoding='utf-8')
        title = next(node for node in nodes if node.tag == 'title')
        pages.append({'source': relative, 'sourceSha256': digest(source), 'title': ''.join(title.text),
                      'partsDirectory': destination.relative_to(output).as_posix(), 'fragments': fragments})
    manifest = {'status': 'staged-not-imported', 'sourceRoot': 'html/tr', 'pages': pages,
                'families': dict(sorted(families.items())), 'components': list(components.values()),
                'assets': {'css': 'html/assets/css/styles.css', 'jsAudit': 'html/assets/js/app.js', 'fonts': 'html/assets/fonts', 'images': 'html/assets/images'}}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    summary = f'{len(pages)} sayfa, {sum(families.values())} ana içerik parçası, {len(families)} yapı ailesi, {len(components)} bileşen tasarım örneği'
    rows = ['# Türkçe HTML parça envanteri', '', summary, '', 'Dosyalar kaynak HTML dilimleridir; backend kataloğuna aktarılmamıştır.', '', '| Sayfa | Sıralı ana parçalar |', '|---|---|']
    for page in pages:
        rows.append('| ' + page['source'] + ' | ' + ' → '.join(f"{part['order']}. {part['family']}" for part in page['fragments']) + ' |')
    rows += ['', '## Yapı aileleri', '', '| Aile | Kullanım |', '|---|---|']
    rows += [f'| {family} | {count} |' for family, count in sorted(families.items())]
    (output / 'ENVANTER.md').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    print(summary)


def reset_backend():
    path = ROOT / 'server' / 'blockdesign.db'
    db = sqlite3.connect(path)
    tables = ['documents', 'block_definitions', 'page_templates', 'shared_regions', 'design_system_assets']
    selected = {}
    for table in tables:
        selected[table] = []
        for rowid, identifier, payload in db.execute(f'SELECT rowid,id,payload FROM {table}'):
            if isinstance(payload, bytes):
                payload = payload.decode('utf-8')
            if LEGACY.search(identifier + ' ' + payload):
                json.loads(payload)  # Refuse unreadable evidence before deleting anything.
                selected[table].append(rowid)
    backup_dir = ROOT / '.tools' / 'backups'
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / ('before-tr-reset-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite')
    with sqlite3.connect(backup_path) as backup:
        db.backup(backup)
        if backup.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Backup integrity check failed')
    with db:
        for table, rowids in selected.items():
            db.executemany(f'DELETE FROM {table} WHERE rowid=?', [(rowid,) for rowid in rowids])
    report = {'backup': str(backup_path), 'removed': {table: len(rows) for table, rows in selected.items()},
              'remaining': {table: db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] for table in tables}}
    (ROOT / '.tools' / 'tr-reset-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    db.close()
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--reset-backend', action='store_true', help='Backup SQLite, then delete only the retired Scala Nova import and its stored dependents.')
    args = parser.parse_args()
    stage()
    if args.reset_backend:
        reset_backend()
