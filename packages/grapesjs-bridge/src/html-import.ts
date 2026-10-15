import postcss, { type Rule } from 'postcss';
import { makeId } from '@blockdesign/core';

export interface ImportReport {
  preserved: string[];
  removed: string[];
  missing: string[];
  unsupported: string[];
}

export interface HtmlImportCandidate {
  id: string;
  label: string;
  tagName: string;
  html: string;
  css: string;
  scopeId: string;
  report: ImportReport;
}

export interface HtmlImportAnalysis {
  candidates: HtmlImportCandidate[];
  report: ImportReport;
}

/** Parse shared CSS with PostCSS and reject browser-specific script execution hooks. */
export function validateCommonCss(input: string): string {
  const root = postcss.parse(input);
  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() === 'import') throw new Error('Ortak CSS içine @import yazma; font ve stil dosyalarını varlık listesine ekle.');
  });
  root.walkDecls((decl) => {
    if (/expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding\s*:|(?:^|\s)behavior\s*:/i.test(decl.value)) {
      throw new Error(`Riskli CSS bildirimi reddedildi: ${decl.prop}.`);
    }
  });
  return root.toString();
}

export function analyzeHtmlImport(html: string, css: string, baseUrl = ''): HtmlImportAnalysis {
  if (baseUrl.trim()) {
    const base = new URL(baseUrl);
    if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Kaynak taban adresi http veya https ile başlamalı.');
  }
  const report = emptyReport();
  const source = new DOMParser().parseFromString(html, 'text/html');
  const embeddedCss = [...source.querySelectorAll('style')].map((style) => style.textContent ?? '');
  for (const stylesheet of source.querySelectorAll('link[rel~="stylesheet"]')) {
    const href = stylesheet.getAttribute('href');
    report.missing.push(href ? `Dış stil sayfası içe aktarılamadı: ${resolveAssetUrl(href, baseUrl, report, false)}` : 'Adresi eksik dış stil sayfası');
  }
  const allCss = [css, ...embeddedCss].filter(Boolean).join('\n');
  source.querySelectorAll('style').forEach((style) => style.remove());
  const disallowed = ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'form', 'portal', 'fencedframe', 'foreignobject', 'animate', 'animatemotion', 'animatetransform', 'set'];
  for (const tag of disallowed) {
    const elements = [...source.querySelectorAll('*')].filter((element) => element.localName.toLowerCase() === tag);
    if (elements.length) report.removed.push(`${elements.length} adet <${tag}> öğesi güvenlik ve etkileşim sınırı nedeniyle çıkarıldı.`);
    elements.forEach((element) => element.remove());
  }
  for (const element of source.body.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || name === 'srcset') {
        element.removeAttribute(attribute.name);
        report.removed.push(`${name} niteliği çıkarıldı.`);
        if (name.startsWith('on')) report.unsupported.push('Olay işleyicileri kaldırıldı; JavaScript etkileşimleri içe aktarılmaz.');
        else if (name === 'srcset') report.unsupported.push('srcset adayları seçilmedi; görsel için tek bir src adresi kullan.');
        continue;
      }
      if (name === 'autoplay') { element.removeAttribute(attribute.name); report.unsupported.push('Otomatik medya oynatma kaldırıldı.'); continue; }
      if (name === 'style') {
        const sanitized = sanitizeInlineStyle(attribute.value, baseUrl, report);
        if (sanitized) element.setAttribute('style', sanitized);
        else element.removeAttribute('style');
        continue;
      }
      if (isUrlAttribute(name)) {
        const resolved = sanitizeHtmlUrl(element.tagName.toLowerCase(), name, attribute.value, baseUrl, report);
        if (resolved === null) element.removeAttribute(attribute.name);
        else element.setAttribute(attribute.name, resolved);
      }
    }
  }

  let roots = [...source.body.querySelectorAll('header, footer, section, article, [role="region"]')];
  if (!roots.length) {
    const wrapper = source.createElement('section');
    wrapper.append(...[...source.body.childNodes].map((node) => node.cloneNode(true)));
    roots = [wrapper];
  }

  const candidates = roots.map((root, index): HtmlImportCandidate => {
    const candidateReport = cloneReport(report);
    const scopeId = makeId('import');
    assignStableNodesAndUniqueIds(root, scopeId);
    root.setAttribute('data-bd-node', `node-${makeId('importroot')}`);
    root.setAttribute('data-bd-container', 'true');
    root.setAttribute('data-bd-import', scopeId);
    const scoped = scopeImportedCss(allCss, scopeId, baseUrl);
    mergeReport(candidateReport, scoped.report);
    const title = root.querySelector('h1,h2,h3,h4,[aria-label]')?.textContent?.trim().replace(/\s+/g, ' ');
    const shortTitle = title && title.length <= 42 ? title : title ? `${title.slice(0, 39)}…` : '';
    return {
      id: scopeId,
      label: `${root.tagName.toLowerCase()}${shortTitle ? ` · ${shortTitle}` : ` · Bölüm ${index + 1}`}`,
      tagName: root.tagName.toLowerCase(),
      html: root.outerHTML,
      css: scoped.css,
      scopeId,
      report: candidateReport,
    };
  });
  if (!candidates.length) report.unsupported.push('Blok adayı bulunamadı. HTML içinde section veya article ekleyebilirsin.');
  for (const candidate of candidates) mergeReport(report, candidate.report);
  return { candidates, report: uniqueReport(report) };
}

export function scopeImportedCss(css: string, scopeId: string, baseUrl = ''): { css: string; report: ImportReport } {
  const report = emptyReport();
  if (!css.trim()) return { css: '', report };
  const root = postcss.parse(css, { from: undefined });
  const keyframes = new Map<string, string>();
  root.walkAtRules((rule) => {
    if (!rule.name.toLowerCase().endsWith('keyframes')) return;
    const name = rule.params.trim();
    if (name && isSafeKeyframeName(name)) keyframes.set(name, `bd-${scopeId}-${name}`);
  });

  root.walkAtRules((rule) => {
    const name = rule.name.toLowerCase();
    if (name === 'import') {
      report.unsupported.push(`@import desteklenmiyor: ${rule.params}`);
      rule.remove();
    } else if (['charset', 'namespace', 'page', 'layer', 'property', 'counter-style', 'font-feature-values', 'font-palette-values', 'document', '-moz-document'].includes(name)) {
      report.unsupported.push(`@${name} sayfa genelidir ve bu blokta güvenle kapsamlanamadı.`);
      rule.remove();
    } else if (name === 'font-face') {
      report.preserved.push('@font-face bağımlılığı korundu; font adları tasarım sistemi genelinde paylaşılır.');
    } else if (name.endsWith('keyframes')) {
      const next = keyframes.get(rule.params.trim());
      if (next) rule.params = next;
      else {
        report.unsupported.push(`Kapsamlanamayan keyframe adı çıkarıldı: ${rule.params}`);
        rule.remove();
      }
    } else if (!['media', 'supports', 'container', 'starting-style'].includes(name)) {
      report.unsupported.push(`@${name} kuralı desteklenmedi ve çıkarıldı.`);
      rule.remove();
    }
  });

  const scope = `[data-bd-import="${scopeId}"]`;
  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    const selectors = splitSelectorList(rule.selector);
    const scopedSelectors: string[] = [];
    for (const selector of selectors) {
      const trimmed = selector.trim();
      if (!trimmed) continue;
      if (trimmed.includes('&')) {
        report.unsupported.push(`CSS nesting içeren selector desteklenmedi: ${trimmed}`);
        continue;
      }
      const rooted = replaceRootSelector(trimmed, scope);
      if (rooted === null) {
        report.unsupported.push(`Belge köküne bağımlı selector desteklenmedi: ${trimmed}`);
        continue;
      }
      if (rooted) scopedSelectors.push(rooted);
      else scopedSelectors.push(`${scope}${trimmed}`, `${scope} ${trimmed}`);
    }
    if (!scopedSelectors.length) rule.remove();
    else rule.selector = scopedSelectors.join(', ');
  });

  root.walkDecls((declaration) => {
    const property = declaration.prop.toLowerCase();
    if (property === 'behavior' || property === '-moz-binding' || containsDangerousCss(declaration.value)) {
      report.removed.push(`Güvensiz CSS bildirimi çıkarıldı: ${declaration.prop}.`);
      declaration.remove();
      return;
    }
    const withUrls = rewriteCssUrls(declaration.value, baseUrl, report);
    if (withUrls === null) {
      report.removed.push(`Çözümlenemeyen veya çalıştırılabilir URL içeren CSS bildirimi çıkarıldı: ${declaration.prop}.`);
      declaration.remove();
      return;
    }
    declaration.value = rewriteAnimationNames(withUrls, keyframes);
  });
  root.walk((node) => {
    if ((node.type === 'rule' || node.type === 'atrule') && !node.nodes?.length && node.parent) node.remove();
  });
  return { css: root.toString(), report: uniqueReport(report) };
}

function sanitizeInlineStyle(css: string, baseUrl: string, report: ImportReport): string {
  const root = postcss.parse(`.inline { ${css} }`, { from: undefined });
  const rule = root.nodes[0];
  if (!rule || rule.type !== 'rule') return '';
  rule.walkDecls((declaration) => {
    if (declaration.prop.toLowerCase() === 'behavior' || declaration.prop.toLowerCase() === '-moz-binding' || containsDangerousCss(declaration.value)) {
      report.removed.push(`Güvensiz satır içi CSS çıkarıldı: ${declaration.prop}.`);
      declaration.remove();
      return;
    }
    const value = rewriteCssUrls(declaration.value, baseUrl, report);
    if (value === null) declaration.remove();
    else declaration.value = value;
  });
  return rule.nodes?.length ? rule.nodes.map((node) => node.toString()).join('; ') : '';
}

function rewriteCssUrls(value: string, baseUrl: string, report: ImportReport): string | null {
  let output = '';
  let index = 0;
  while (index < value.length) {
    if (value.startsWith('/*', index)) {
      const end = value.indexOf('*/', index + 2);
      if (end < 0) return null;
      output += value.slice(index, end + 2);
      index = end + 2;
      continue;
    }
    const quote = value[index];
    if (quote === '"' || quote === "'") {
      const end = scanString(value, index, quote);
      if (end < 0) return null;
      output += value.slice(index, end);
      index = end;
      continue;
    }
    if (!isCssIdentifierStart(value[index]!)) {
      output += value[index++];
      continue;
    }
    const start = index;
    while (index < value.length && isCssIdentifier(value[index]!)) index += 1;
    const identifier = value.slice(start, index);
    let open = index;
    while (open < value.length && isWhitespace(value[open]!)) open += 1;
    if (identifier.toLowerCase() !== 'url' || value[open] !== '(') {
      output += value.slice(start, index);
      continue;
    }
    const end = scanFunction(value, open);
    if (end < 0) return null;
    const inner = value.slice(open + 1, end - 1).trim();
    const raw = unquoteCss(inner);
    if (!raw || isFragment(raw)) {
      output += value.slice(start, end);
    } else {
      const resolved = resolveAssetUrl(raw, baseUrl, report);
      if (resolved.startsWith('javascript:') || resolved.startsWith('vbscript:') || resolved.startsWith('data:text/html')) return null;
      output += `url("${escapeCssString(resolved)}")`;
    }
    index = end;
  }
  return output;
}

function resolveAssetUrl(value: string, baseUrl: string, report: ImportReport, keepDependency = true): string {
  const trimmed = value.trim();
  if (!trimmed || isFragment(trimmed) || trimmed.startsWith('data:image/')) return trimmed;
  try {
    const base = baseUrl ? new URL(baseUrl) : null;
    if (base && !['http:', 'https:'].includes(base.protocol)) throw new Error('Unsupported source URL protocol');
    const resolved = new URL(trimmed, base ?? undefined);
    if (!['http:', 'https:'].includes(resolved.protocol)) {
      report.missing.push(`Desteklenmeyen varlık adresi: ${trimmed}`);
      return '';
    }
    if (!base && !hasUrlScheme(trimmed) && !trimmed.startsWith('//')) report.missing.push(`Bağıl varlık için kaynak taban adresi gerekli: ${trimmed}`);
    else if (keepDependency) report.preserved.push(`Varlık adresi çözüldü: ${resolved.href}`);
    return resolved.href;
  } catch {
    report.missing.push(`Varlık adresi çözümlenemedi: ${trimmed}`);
    return '';
  }
}

function sanitizeHtmlUrl(tag: string, name: string, value: string, baseUrl: string, report: ImportReport): string | null {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text/html') || trimmed.startsWith('//')) {
    report.removed.push(`${name} niteliğindeki çalıştırılabilir veya protokol-bağıl adres çıkarıldı.`);
    return null;
  }
  if (lower.startsWith('data:')) {
    if (name === 'src' && ['img', 'source'].includes(tag) && lower.startsWith('data:image/')) return trimmed;
    report.removed.push(`${name} niteliğindeki gömülü içerik bu öğede desteklenmiyor.`);
    return null;
  }
  if (tag === 'a' && name === 'href' && (trimmed.startsWith('#') || lower.startsWith('mailto:') || lower.startsWith('tel:'))) return trimmed;
  if (name === 'href' && tag !== 'link' && !hasUrlScheme(trimmed) && (trimmed.startsWith('#') || trimmed.startsWith('/'))) return trimmed;
  if (name === 'src' || name === 'poster' || name === 'cite' || name === 'background' || name === 'xlink:href' || (name === 'href' && tag !== 'a')) {
    const resolved = resolveAssetUrl(trimmed, baseUrl, report);
    return resolved || null;
  }
  return trimmed;
}

function assignStableNodesAndUniqueIds(root: Element, scopeId: string): void {
  const elements = [root, ...root.querySelectorAll('*')];
  const idMap = new Map<string, string>();
  for (const [index, element] of elements.entries()) {
    element.removeAttribute('data-bd-container');
    element.setAttribute('data-bd-node', `node-${scopeId}-${index + 1}`);
    const id = element.getAttribute('id');
    if (id) {
      const next = `${scopeId}-${id}`;
      if (!idMap.has(id)) idMap.set(id, next);
      element.setAttribute('id', next);
    }
  }
  const idReferences = ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns'];
  for (const element of elements) {
    for (const name of idReferences) {
      const value = element.getAttribute(name);
      if (value) element.setAttribute(name, value.trim().split(/\s+/).map((part) => idMap.get(part) ?? part).join(' '));
    }
    const href = element.getAttribute('href');
    if (href?.startsWith('#')) element.setAttribute('href', `#${idMap.get(href.slice(1)) ?? href.slice(1)}`);
  }
}

function splitSelectorList(selector: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index]!;
    if (!quote && selector.startsWith('/*', index)) {
      const end = selector.indexOf('*/', index + 2);
      if (end < 0) break;
      index = end + 1;
      continue;
    }
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) { result.push(selector.slice(start, index)); start = index + 1; }
  }
  result.push(selector.slice(start));
  return result;
}

function replaceRootSelector(selector: string, scope: string): string | null | undefined {
  if (selector === ':root' || selector === 'html' || selector === 'body') return scope;
  for (const root of [':root', 'html', 'body']) {
    if (!selector.startsWith(root)) continue;
    const next = selector[root.length];
    if (next === ' ' || next === '>' || next === '+' || next === '~') return `${scope}${selector.slice(root.length)}`;
    if (next === ':') return `${scope}${selector.slice(root.length)}`;
    if (next && next !== '.' && next !== '#' && next !== '[' && next !== ':') return null;
    if (next) return null;
  }
  return undefined;
}

function isInsideKeyframes(rule: Rule): boolean {
  let parent: unknown = rule.parent;
  while (parent && typeof parent === 'object') {
    const ancestor = parent as { type?: string; name?: string; parent?: unknown };
    if (ancestor.type === 'atrule' && ancestor.name?.toLowerCase().endsWith('keyframes')) return true;
    parent = ancestor.parent;
  }
  return false;
}

function rewriteAnimationNames(value: string, names: Map<string, string>): string {
  if (!names.size) return value;
  let output = '';
  let index = 0;
  while (index < value.length) {
    const char = value[index]!;
    if (char === '"' || char === "'") {
      const end = scanString(value, index, char);
      if (end < 0) return value;
      output += value.slice(index, end);
      index = end;
      continue;
    }
    if (!isCssIdentifierStart(char)) { output += char; index += 1; continue; }
    const start = index;
    while (index < value.length && isCssIdentifier(value[index]!)) index += 1;
    const token = value.slice(start, index);
    output += names.get(token) ?? token;
  }
  return output;
}

function containsDangerousCss(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('javascript:') || normalized.includes('vbscript:') || normalized.includes('expression(') || normalized.includes('-moz-binding');
}

function isUrlAttribute(name: string): boolean {
  return ['href', 'src', 'poster', 'cite', 'background', 'xlink:href', 'action', 'formaction'].includes(name);
}
function emptyReport(): ImportReport { return { preserved: [], removed: [], missing: [], unsupported: [] }; }
function cloneReport(report: ImportReport): ImportReport { return { preserved: [...report.preserved], removed: [...report.removed], missing: [...report.missing], unsupported: [...report.unsupported] }; }
function mergeReport(target: ImportReport, source: ImportReport): void {
  target.preserved.push(...source.preserved); target.removed.push(...source.removed);
  target.missing.push(...source.missing); target.unsupported.push(...source.unsupported);
}
function uniqueReport(report: ImportReport): ImportReport {
  return { preserved: [...new Set(report.preserved)], removed: [...new Set(report.removed)], missing: [...new Set(report.missing)], unsupported: [...new Set(report.unsupported)] };
}
function isFragment(value: string): boolean { return value.startsWith('#'); }
function hasUrlScheme(value: string): boolean { const colon = value.indexOf(':'); const slash = value.indexOf('/'); return colon > 0 && (slash < 0 || colon < slash); }
function isWhitespace(char: string): boolean { return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f'; }
function isCssIdentifierStart(char: string): boolean { const code = char.charCodeAt(0); return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || char === '_' || char === '-' || char === '\\'; }
function isCssIdentifier(char: string): boolean { const code = char.charCodeAt(0); return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || char === '_' || char === '-' || char === '\\'; }
function isSafeKeyframeName(value: string): boolean {
  if (!value || !isCssIdentifierStart(value[0]!) || (value[0]! >= '0' && value[0]! <= '9')) return false;
  return [...value].every((char) => isCssIdentifier(char));
}
function scanString(value: string, start: number, quote: string): number {
  let escaped = false;
  for (let index = start + 1; index < value.length; index += 1) {
    if (escaped) { escaped = false; continue; }
    if (value[index] === '\\') { escaped = true; continue; }
    if (value[index] === quote) return index + 1;
  }
  return -1;
}
function scanFunction(value: string, open: number): number {
  let depth = 1;
  let quote = '';
  let escaped = false;
  for (let index = open + 1; index < value.length; index += 1) {
    const char = value[index]!;
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') depth += 1;
    else if (char === ')' && --depth === 0) return index + 1;
  }
  return -1;
}
function unquoteCss(value: string): string { const first = value[0]; return (first === '"' || first === "'") && value[value.length - 1] === first ? value.slice(1, -1) : value; }
function escapeCssString(value: string): string { return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\a '); }

