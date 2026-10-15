import type {
  ContentProviderAdapter,
  RequestContext,
} from "@blockdesign/contracts";
import {
  loadCollectionPage,
  mountCollection,
  contextualQuery,
  type CollectionRuntimeConfig,
} from "@blockdesign/core";
import type { PreviewBehaviorPlugin } from "@blockdesign/grapesjs-bridge";
export const COLLECTION_CSS =
  ".bd-collection-filters,.bd-collection-controls{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin-block:16px}.bd-collection-filters label{display:grid;gap:6px;min-width:0}.bd-collection-filters input,.bd-collection-filters button,.bd-collection-controls button{font:inherit;min-height:44px;padding:10px 14px;max-width:100%}.bd-collection-controls button:disabled{opacity:.55}.bd-collection-filters :focus-visible,.bd-collection-controls :focus-visible{outline:2px solid currentColor;outline-offset:3px}";
export function createCollectionBehavior(
  providers: ContentProviderAdapter[],
  getContext: () => RequestContext,
): PreviewBehaviorPlugin {
  const active = new WeakMap<
    HTMLElement,
    { signature: string; stop: () => void }
  >();
  const mount = (root: HTMLElement) => {
    const encoded = root.getAttribute("data-bd-collection") ?? "[]";
    const context = getContext();
    const signature = JSON.stringify([encoded, context.page, context.contentLocale]);
    if (active.get(root)?.signature === signature) return;
    active.get(root)?.stop();
    active.delete(root);
    const configs = JSON.parse(encoded) as CollectionRuntimeConfig[];
    const stops: Array<() => void> = [];
    try {
      for (const config of configs)
        stops.push(
          mountCollection(root, config, {
            syncUrl: false,
            load: (values, cursor, signal) =>
              loadCollectionPage(providers, config.binding, values, cursor, {
                ...getContext(),
                signal,
              }),
          }),
        );
    } catch (error) {
      stops.forEach((stop) => stop());
      throw error;
    }
    active.set(root, {
      signature,
      stop: () => stops.forEach((stop) => stop()),
    });
  };
  return {
    id: "blockdesign.collection",
    selector: "[data-bd-collection]",
    css: COLLECTION_CSS,
    mount(root) {
      mount(root);
      return () => {
        active.get(root)?.stop();
        active.delete(root);
      };
    },
    update: mount,
  };
}
/** Public endpoint is configured by the CMS host, never entered in the document. */
export function collectionExport(
  markup: string,
  publication?: { baseUrl: string; context?: RequestContext },
): { js: string; issues: Array<{ code: string; message: string }> } {
  if (!markup.includes("data-bd-collection=")) return { js: "", issues: [] };
  const encoded = JSON.stringify(publication ?? null).replace(/</g, "\\u003c");
  return {
    issues: publication
      ? []
      : [
          {
            code: "COLLECTION_PUBLICATION_UNCONFIGURED",
            message: "Canlı liste için CMS yayın bağlantısı gerekli.",
          },
        ],
    js: `(()=>{const mount=${mountCollection.toString()};const contextualQuery=${contextualQuery.toString()};const loadCollectionPage=${loadCollectionPage.toString()};const publication=${encoded};const states=new WeakMap();const init=(root=document)=>{for(const el of [...(root.matches?.('[data-bd-collection]')?[root]:[]),...root.querySelectorAll('[data-bd-collection]')]){states.get(el)?.();const configs=JSON.parse(el.getAttribute('data-bd-collection'));const stops=configs.map(config=>mount(el,config,{load:async(values,cursor,signal)=>{if(!publication)throw new Error('CMS liste yayın bağlantısı yapılandırılmadı.');const base=new URL(publication.baseUrl,document.baseURI);if(!['http:','https:'].includes(base.protocol))throw new Error('CMS liste yayın adresi geçersiz.');const endpoint=(context)=>{const url=new URL(base.href.replace(/\\/$/,'')+'/content/collections/'+encodeURIComponent(config.binding.collectionId));url.searchParams.set('providerId',config.binding.providerId);if(context?.contentLocale){url.searchParams.set('locale',context.contentLocale.locale);if(context.contentLocale.fallback.mode==='locale')url.searchParams.set('fallbackLocale',context.contentLocale.fallback.locale);}return url;};const read=async(url,input)=>{const response=await fetch(url,input);if(!response.ok)throw new Error('Liste yüklenemedi ('+response.status+'). Yeniden dene.');return response.json();};const provider={providerId:config.binding.providerId,capabilities:{supported:['queryPage']},getSchema:(_id,context)=>read(endpoint(context),{signal}),queryPage:(_id,query,cursor,context)=>{const url=endpoint(context);url.pathname+='/query';return read(url,{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({...query,cursor,providerId:config.binding.providerId,schemaVersion:config.binding.schemaVersion,page:context?.page,contentLocale:context?.contentLocale})});}};return loadCollectionPage([provider],config.binding,values,cursor,publication.context,contextualQuery);}}));states.set(el,()=>stops.forEach(stop=>stop()));}};const destroy=(root=document)=>{for(const el of [...(root.matches?.('[data-bd-collection]')?[root]:[]),...root.querySelectorAll('[data-bd-collection]')]){states.get(el)?.();states.delete(el);}};window.BlockDesignCollections={init,destroy};init();})();`,
  };
}
