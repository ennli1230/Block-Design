export type ExportAssetIssue = { code: string; message: string };
export type ExportAssetInput = { html: string; css: string; stylesheets: string[]; baseUrl?: string };
export type ExportAssetResult = { html: string; css: string; stylesheets: string[]; issues: ExportAssetIssue[] };

const maxResourceBytes = 8 * 1024 * 1024;
const maxBundleBytes = 32 * 1024 * 1024;
const maxResources = 100;
const bundledMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'font/woff', 'font/woff2', 'font/ttf', 'font/otf', 'application/x-font-ttf', 'application/x-font-opentype', 'application/font-woff', 'application/vnd.ms-fontobject',
]);

/** Inline same-origin and CORS-readable image/font dependencies in a single-file export. */
export async function packageExportAssets(input: ExportAssetInput, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<ExportAssetResult> {
  const baseUrl = input.baseUrl ?? (typeof location === 'undefined' ? 'http://localhost/' : location.href);
  const issues: ExportAssetIssue[] = [];
  const seenIssues = new Set<string>();
  const resourceCache = new Map<string, Promise<string>>();
  let bundledBytes = 0;
  let resourceCount = 0;
  const issue = (code: string, url: string, reason: string): void => {
    const key = `${code}:${url}`;
    if (seenIssues.has(key)) return;
    seenIssues.add(key);
    issues.push({ code, message: `${url}: ${reason}` });
  };
  const fetchDataUrl = (url: string, parent: string): Promise<string> => {
    let resolved: URL;
    try { resolved = new URL(url, parent); }
    catch { return Promise.reject(new Error('geçerli bir HTTP adresi değil')); }
    if (!['http:', 'https:'].includes(resolved.protocol)) return Promise.reject(new Error('yalnızca HTTP(S) varlıkları paketlenebilir'));
    const key = resolved.href;
    const cached = resourceCache.get(key);
    if (cached) return cached;
    const task = (async () => {
      resourceCount += 1;
      if (resourceCount > maxResources) throw new Error('tek export için 100 varlık sınırı aşıldı');
      const response = await fetcher(key, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const mimeType = (response.headers.get('content-type') ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? '';
      if (!bundledMimeTypes.has(mimeType)) throw new Error(`desteklenmeyen MIME türü ${mimeType || 'belirsiz'}`);
      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (declaredLength > maxResourceBytes) throw new Error('8 MB varlık sınırı aşıldı');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maxResourceBytes || bundledBytes + bytes.byteLength > maxBundleBytes) throw new Error('paket boyutu sınırı aşıldı');
      bundledBytes += bytes.byteLength;
      const binaryParts: string[] = [];
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binaryParts.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
      return `data:${mimeType};base64,${btoa(binaryParts.join(''))}`;
    })();
    resourceCache.set(key, task);
    return task;
  };

  let html = input.html;
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)];
  for (const match of imageTags.reverse()) {
    const tag = match[0];
    const src = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2]?.trim();
    const alt = /\balt\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2];
    const decorative = /\brole\s*=\s*(["'])presentation\1/i.test(tag) || /\baria-hidden\s*=\s*(["'])true\1/i.test(tag);
    if (alt === undefined || (!alt.trim() && !decorative)) issue('IMAGE_ALT_MISSING', src || '(adres yok)', 'görsel için açıklayıcı alt metin ekleyin.');
    if (!src || /^(?:data:|#)/i.test(src)) continue;
    try {
      const dataUrl = await fetchDataUrl(src, baseUrl);
      const nextTag = tag.replace(/(\bsrc\s*=\s*)(["'])(.*?)\2/i, (_whole, start, quote) => `${start}${quote}${dataUrl}${quote}`);
      html = html.slice(0, match.index) + nextTag + html.slice(match.index + tag.length);
    } catch (error) {
      issue('ASSET_UNPACKAGED', src, error instanceof Error ? error.message : 'varlık indirilemedi');
    }
  }

  const packageCssUrls = async (source: string, parent: string): Promise<string> => {
    const references = [...source.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi)];
    let result = source;
    for (const match of references.reverse()) {
      const url = (match[2] ?? match[3] ?? '').trim();
      if (!url || /^(?:data:|#|var\()/i.test(url)) continue;
      try {
        const dataUrl = await fetchDataUrl(url, parent);
        const offset = match.index ?? 0;
        result = result.slice(0, offset) + `url("${dataUrl}")` + result.slice(offset + match[0].length);
      } catch (error) {
        issue('CSS_ASSET_UNPACKAGED', url, error instanceof Error ? error.message : 'CSS varlığı indirilemedi');
      }
    }
    if (/@import\s/i.test(result)) issue('CSS_IMPORT_UNPACKAGED', parent, 'CSS içindeki @import bağımlılığı harici bırakıldı.');
    return result;
  };

  const authoredCss = await packageCssUrls(input.css, baseUrl);
  let css = '';
  const remainingStylesheets: string[] = [];
  for (const stylesheet of input.stylesheets) {
    try {
      const url = new URL(stylesheet, baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('yalnızca HTTP(S) stil dosyaları paketlenebilir');
      const response = await fetcher(url.href, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? '';
      if (contentType && contentType !== 'text/css' && !url.pathname.toLowerCase().endsWith('.css')) throw new Error(`desteklenmeyen MIME türü ${contentType}`);
      const stylesheetCss = await response.text();
      if (stylesheetCss.length > maxResourceBytes || bundledBytes + stylesheetCss.length > maxBundleBytes) throw new Error('paket boyutu sınırı aşıldı');
      bundledBytes += stylesheetCss.length;
      css += `\n/* Bundled stylesheet: ${url.href.replace(/[\r\n*]/g, '')} */\n${await packageCssUrls(stylesheetCss, url.href)}`;
    } catch (error) {
      remainingStylesheets.push(stylesheet);
      issue('STYLESHEET_UNPACKAGED', stylesheet, error instanceof Error ? error.message : 'stil dosyası indirilemedi');
    }
  }
  // Source stylesheets establish the design; common CSS and authored overrides
  // have the final say, just as they do when editing a page.
  return { html, css: `${css}\n${authoredCss}`, stylesheets: remainingStylesheets, issues };
}
