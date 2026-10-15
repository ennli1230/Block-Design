import grapesjs, { type Editor, type Component } from 'grapesjs';
import type { BlockDefinitionVersion, BlockInstance, DesignSystemAssetManifest, EditorDocument, EditorMode, FieldDefinition, JsonValue, SharedRegionDefinition, VersionRef } from '@blockdesign/contracts';
import { AUTHORING_HINT_CSS, SECTION_VARIANT_CSS, COMPOSABLE_CSS, allowedStyleOverrides, applyTemplateData, cloneBlockInstance, isSafeUrl, makeId, makeInstance, safeStyleValue } from '@blockdesign/core';
import { builtInDefinitions } from '@blockdesign/core/sample';
import { sliderDefinition } from '@blockdesign/core/catalog';
import { mountInteractive } from '@blockdesign/core';
import { validateCommonCss } from './html-import';
import { stopEditingInteractions } from './preview.ts';
import { canvasCssForDesignSystem } from './canvas-css';
export { canvasCssForDesignSystem } from './canvas-css';
export { analyzeHtmlImport, scopeImportedCss, validateCommonCss } from './html-import';
export type { HtmlImportAnalysis, HtmlImportCandidate, ImportReport } from './html-import';

export const BASE_CANVAS_CSS = `${COMPOSABLE_CSS}
${SECTION_VARIANT_CSS}
${AUTHORING_HINT_CSS}

  * { box-sizing: border-box; }
  html, body { min-height: 100%; margin: 0; background: #fff; color: #22261f; font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif; }
  body { padding: 48px; }
  img { max-width: 100%; }
  .bd-faq-grid, .bd-banner-grid { max-width: 1024px; margin: 0 auto; display: grid; grid-template-columns: 0.84fr 1.16fr; gap: clamp(48px, 8vw, 112px); align-items: start; padding: 64px 40px; }
  .bd-eyebrow { color: #508270; font-size: 11px; font-weight: 720; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 17px; }
  .bd-title { color: #20261f; font-size: clamp(34px, 4vw, 48px); line-height: 1.06; letter-spacing: -0.045em; margin: 0 0 16px; font-weight: 650; }
  .bd-copy { max-width: 34ch; color: #777d73; font-size: 15px; line-height: 1.8; margin: 0; }
  .bd-items { border-top: 1px solid #dfe5dd; }
  .bd-item { border-bottom: 1px solid #dfe5dd; padding: 2px 0; }
  .bd-question { list-style: none; display: flex; justify-content: space-between; gap: 20px; align-items: center; padding: 19px 0; color: #272c25; cursor: pointer; font-size: 14px; font-weight: 610; line-height: 1.55; }
  .bd-question::-webkit-details-marker { display: none; }
  .bd-question::after { content: "+"; flex: 0 0 auto; color: #527e6c; font-size: 20px; font-weight: 380; }
  .bd-item[open] .bd-question::after { content: "−"; }
  .bd-answer { padding: 0 28px 19px 0; color: #777d73; font-size: 13px; line-height: 1.8; margin: 0; }
  .bd-banner-grid { grid-template-columns: 1fr 0.8fr; align-items: center; border-radius: 10px; background: #f4f1e8; }
  .bd-banner-img { min-height: 228px; width: 100%; object-fit: cover; border-radius: 7px; background: #e1e5db; }
  .bd-button { display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; padding: 12px 17px; margin-top: 23px; background: #345b4c; color: #fff; text-decoration: none; font-weight: 600; font-size: 12px; }
  .bd-placeholder { display: grid; min-height: 176px; place-items: center; border: 1px dashed #c8d2c9; color: #758077; background: #f8faf7; font-size: 13px; }
  .bd-block { position: relative; }
  .bd-block:focus { outline: 2px solid #5e8a76; outline-offset: 5px; }
  .bd-structure { min-height: 50px; padding: 18px; border: 1px dashed #aab8ac; }
  .bd-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; max-width: 1040px; margin: 0 auto; padding: 16px; }
  .bd-column { min-height: 96px; border: 1px dashed #ccd3cc; padding: 14px; }
  .bd-block .bd-column { border-color: transparent; }
  .bd-block .bd-structure { border-color: transparent; }
  .bd-image-placeholder { display: grid; min-height: 170px; place-items: center; background: #edf0eb; color: #747b71; }
  .bd-custom-accordion { max-width: 920px; margin: 0 auto; border-top: 1px solid #dfe5dd; }
  .bd-custom-accordion-item { border-bottom: 1px solid #dfe5dd; }
  .bd-custom-accordion-item > summary { list-style: none; display: flex; justify-content: space-between; gap: 20px; align-items: center; padding: 18px 0; color: #272c25; cursor: pointer; font-size: 14px; font-weight: 610; line-height: 1.55; }
  .bd-custom-accordion-item > summary::-webkit-details-marker { display: none; }
  .bd-custom-accordion-item > summary::after { content: "+"; color: #527e6c; font-size: 20px; font-weight: 380; }
  .bd-custom-accordion-item[open] > summary::after { content: "−"; }
  .bd-custom-accordion-answer { padding: 0 28px 18px 0; color: #777d73; font-size: 13px; line-height: 1.8; margin: 0; }
  .bd-site-header { display: flex; max-width: 1120px; margin: 0 auto; align-items: center; justify-content: space-between; padding: 24px 32px; border-bottom: 1px solid #edf0ed; }
  .bd-site-header nav { display: flex; gap: 24px; }
  .bd-site-header a { color: #5e675d; text-decoration: none; font-size: 12px; }
  .bd-site-logo { color: #345b4c !important; font-size: 18px !important; font-weight: 700; letter-spacing: -.04em; }
  .bd-site-footer { max-width: 1120px; margin: 54px auto 0; padding: 22px 32px; border-top: 1px solid #edf0ed; color: #8a9189; font-size: 11px; }
  [data-bd-template-slot="content-main"] { min-height: 420px; max-width: 1120px; margin: 0 auto; padding: 24px 32px; }
  .bd-slider { max-width: 960px; margin: 0 auto; overflow: hidden; border-radius: 10px; background: #f1f3ed; }
  .bd-slider-track { display: flex; transition: transform 280ms ease; }
  .bd-slide { flex: 0 0 100%; display: grid; min-height: 320px; grid-template-columns: 1.1fr 0.9fr; align-items: center; gap: 32px; padding: 28px; }
  .bd-slide img { width: 100%; height: 264px; object-fit: cover; border-radius: 7px; background: #dfe5dc; }
  .bd-slide h3 { color: #20261f; font-size: 30px; letter-spacing: -.035em; margin: 0 0 12px; }
  .bd-slide p { color: #777d73; line-height: 1.7; }
  .bd-slider-controls { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 0 28px 22px; color: #72796f; font-size: 12px; }
  .bd-slider-controls button { width: 32px; height: 32px; border: 1px solid #d8ded6; border-radius: 50%; background: white; color: #345b4c; cursor: pointer; }
  @media (max-width: 760px) { .bd-slide { grid-template-columns: 1fr; gap: 16px; padding: 18px; } .bd-slide img { height: 210px; } .bd-slide h3 { font-size: 24px; } .bd-slider-controls { padding: 0 18px 18px; } }
  @media (max-width: 760px) { body { padding: 16px; } .bd-faq-grid,.bd-banner-grid { grid-template-columns: 1fr; gap: 34px; padding: 34px 10px; } .bd-title { font-size: 36px; } }
  @media (max-width: 560px) { .bd-columns { grid-template-columns: 1fr; } }
`;

export interface PreviewBehaviorPlugin {
  /** Render managed widgets in the editing canvas without performing actions. */
  runInEditor?: boolean;
  settings?: FieldDefinition[];
  rootAttributes?: Record<string,string>;
  roles?: Array<{attribute:string;label:string}>;
  /** Stable identifier for runtime cleanup and diagnostics. */
  id: string;
  /** CSS selector for the supported root HTML structure. */
  selector: string;
  /** Trusted CSS dependency; injected into the canvas and static export. */
  css?: string;
  /** Trusted standalone runtime dependency; included in static HTML exports. */
  exportJs?: string;
  mount(root: HTMLElement, context?: { mode: 'editor' | 'preview' }): void | (() => void);
  update?(root: HTMLElement, context?: { mode: 'editor' | 'preview' }): void;
  destroy?(root: HTMLElement): void;
}

export function mountSlider(slider:HTMLElement):()=>void {
  const track=slider.querySelector<HTMLElement>('[data-bd-slider-track]');const slides=[...slider.querySelectorAll<HTMLElement>('[data-bd-slide]')];
  const status=slider.querySelector<HTMLElement>('[data-bd-slider-status]'),previous=slider.querySelector<HTMLButtonElement>('[data-bd-slider-prev]'),next=slider.querySelector<HTMLButtonElement>('[data-bd-slider-next]');
  if(!track||!slides.length)return ()=>{};
  let settings:Record<string,unknown>={};try{settings=JSON.parse(slider.getAttribute('data-bd-behavior-settings') ?? '{}');}catch{}
  const loop=settings.loop!==false;const interval=Math.max(1000,Math.min(60000,Number(settings.interval)||5000));let index=0;
  const update=()=>{index=loop?(index+slides.length)%slides.length:Math.max(0,Math.min(slides.length-1,index));track.style.transform=`translateX(-${index*100}%)`;if(status)status.textContent=`${index+1} / ${slides.length}`;if(previous)previous.disabled=!loop&&index===0;if(next)next.disabled=!loop&&index===slides.length-1;};
  const prev=()=>{index--;update();},advance=()=>{index++;update();};
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='ArrowLeft'){event.preventDefault();prev();}if(event.key==='ArrowRight'){event.preventDefault();advance();}};
  previous?.addEventListener('click',prev);next?.addEventListener('click',advance);slider.addEventListener('keydown',keyboard);update();
  const timer=settings.autoplay===true && slides.length>1 && !slider.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ? setInterval(advance,interval) : null;
  return ()=>{if(timer!==null)clearInterval(timer);previous?.removeEventListener('click',prev);next?.removeEventListener('click',advance);slider.removeEventListener('keydown',keyboard);track.style.transform='';};
}
const sliderCleanup=new WeakMap<HTMLElement,()=>void>();
const STATIC_BEHAVIOR_JS=`(()=>{const mount=${mountSlider.toString()};const states=new WeakMap();const init=(root=document)=>root.querySelectorAll('[data-bd-behavior="slider"]').forEach(el=>{states.get(el)?.();states.set(el,mount(el));});const destroy=(root=document)=>root.querySelectorAll('[data-bd-behavior="slider"]').forEach(el=>{states.get(el)?.();states.delete(el);});window.BlockDesignRuntime={init,destroy};init();})();`;
const sliderBehavior:PreviewBehaviorPlugin={
  settings:sliderDefinition.behavior!.settings,
  id:'blockdesign.slider',selector:'[data-bd-behavior="slider"]',exportJs:STATIC_BEHAVIOR_JS,
  rootAttributes:{'data-bd-behavior':'slider'},
  roles:[{attribute:'data-bd-slider-track',label:'Slayt kapsayıcısı'},{attribute:'data-bd-slide',label:'Tek slayt / örnek öğe'},{attribute:'data-bd-slider-prev',label:'Önceki düğmesi'},{attribute:'data-bd-slider-next',label:'Sonraki düğmesi'},{attribute:'data-bd-slider-status',label:'Slayt sayacı'}],
  mount(element){sliderCleanup.set(element,mountSlider(element));return ()=>{sliderCleanup.get(element)?.();sliderCleanup.delete(element);};},
  update(element){sliderCleanup.get(element)?.();sliderCleanup.set(element,mountSlider(element));},
};

function mountDisclosure(root:HTMLElement):()=>void {
  const button=root.querySelector<HTMLElement>('[data-bd-toggle]'),panel=root.querySelector<HTMLElement>('[data-bd-panel]');if(!button||!panel)return ()=>{};
  const original=panel.hidden,expanded=button.getAttribute('aria-expanded');let config:Record<string,unknown>={};try{config=JSON.parse(root.getAttribute('data-bd-behavior-settings') ?? '{}');}catch{}
  const show=(open:boolean)=>{panel.hidden=!open;button.setAttribute('aria-expanded',String(open));};
  const toggle=(event:Event)=>{event.preventDefault();show(Boolean(panel.hidden));};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape' && config.closeOnEscape!==false){show(false);button.focus();}};
  show(config.open===true);button.addEventListener('click',toggle);root.addEventListener('keydown',escape);
  return ()=>{button.removeEventListener('click',toggle);root.removeEventListener('keydown',escape);panel.hidden=original;if(expanded===null)button.removeAttribute('aria-expanded');else button.setAttribute('aria-expanded',expanded);};
}
const disclosureCleanup=new WeakMap<HTMLElement,()=>void>();
const disclosureBehavior:PreviewBehaviorPlugin={id:'blockdesign.disclosure',selector:'[data-bd-behavior="disclosure"]',rootAttributes:{'data-bd-behavior':'disclosure'},roles:[{attribute:'data-bd-toggle',label:'Aç / kapat düğmesi'},{attribute:'data-bd-panel',label:'Açılan menü / panel'}],settings:[{fieldId:'disclosure.open',key:'open',label:'Başlangıçta açık',type:'boolean',required:false,defaultValue:false,mappingTarget:{nodeId:'root',operation:'attribute'}},{fieldId:'disclosure.escape',key:'closeOnEscape',label:'Escape ile kapat',type:'boolean',required:false,defaultValue:true,mappingTarget:{nodeId:'root',operation:'attribute'}}],exportJs:`(()=>{const mount=${mountDisclosure.toString()};document.querySelectorAll('[data-bd-behavior="disclosure"]').forEach(el=>mount(el));})();`,mount(el){disclosureCleanup.set(el,mountDisclosure(el));return ()=>{disclosureCleanup.get(el)?.();disclosureCleanup.delete(el);};},update(el){disclosureCleanup.get(el)?.();disclosureCleanup.set(el,mountDisclosure(el));}};

const interactiveCss='[data-bd-behavior="tabs"] [hidden]{display:none!important}.bd-interactive-widget{padding:24px}.bd-interactive-widget button{font:inherit;min-height:44px;padding:10px 16px;cursor:pointer}.bd-interactive-widget [role="tab"][aria-selected="true"]{text-decoration:underline;text-underline-offset:6px}.bd-interactive-widget [data-bd-tabpanel]{padding-block:20px}.bd-widget-dialog{max-width:min(90vw,800px);max-height:90vh;overflow:auto;padding:24px;border:1px solid #89988d;background:#fff;color:#27362e}.bd-widget-dialog::backdrop{background:rgb(0 0 0 / .55)}.bd-widget-dialog img{display:block;max-width:100%;max-height:65vh;object-fit:contain}.bd-interactive-widget [data-bd-node="gallery-items"]{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:16px}.bd-interactive-widget img{max-width:100%}.bd-interactive-widget :focus-visible,.bd-widget-dialog :focus-visible{outline:2px solid currentColor;outline-offset:3px}';
const interactiveBehaviors:PreviewBehaviorPlugin[]=['tabs','modal','gallery'].map(kind=>{
  const active=new WeakMap<HTMLElement,()=>void>();
  return {id:'blockdesign.'+kind,selector:`[data-bd-behavior="${kind}"]`,rootAttributes:{'data-bd-behavior':kind},css:interactiveCss,roles:kind==='tabs'?[{attribute:'data-bd-tablist',label:'Sekme düğmeleri'},{attribute:'data-bd-tab',label:'Sekme düğmesi'},{attribute:'data-bd-tabpanel',label:'Sekme paneli'}]:kind==='modal'?[{attribute:'data-bd-modal-open',label:'Açma düğmesi'},{attribute:'data-bd-dialog',label:'Dialog penceresi'},{attribute:'data-bd-modal-close',label:'Kapatma düğmesi'}]:[{attribute:'data-bd-gallery-item',label:'Görsel bağlantısı'}],exportJs:`(()=>{const mount=${mountInteractive.toString()};const states=new WeakMap();const init=(root=document)=>{for(const el of [...(root.matches?.('[data-bd-behavior="${kind}"]')?[root]:[]),...root.querySelectorAll('[data-bd-behavior="${kind}"]')]){states.get(el)?.();states.set(el,mount(el));}};const destroy=(root=document)=>{for(const el of [...(root.matches?.('[data-bd-behavior="${kind}"]')?[root]:[]),...root.querySelectorAll('[data-bd-behavior="${kind}"]')]){states.get(el)?.();states.delete(el);}};window.BlockDesignWidgets??={};window.BlockDesignWidgets['${kind}']={init,destroy};init();})();`,mount(el){const stop=mountInteractive(el);active.set(el,stop);return()=>{active.get(el)?.();active.delete(el);};},update(el){active.get(el)?.();active.set(el,mountInteractive(el));}};
});
export const DEFAULT_PREVIEW_BEHAVIORS: PreviewBehaviorPlugin[] = [sliderBehavior,disclosureBehavior,...interactiveBehaviors];

export function behaviorExportDependencies(plugins: PreviewBehaviorPlugin[] = [], markup?: string): { css: string; js: string } {
  const behaviors = [...DEFAULT_PREVIEW_BEHAVIORS, ...plugins];
  const ids = new Set<string>();
  for (const behavior of behaviors) {
    if (!behavior.id.trim() || !behavior.selector.trim() || ids.has(behavior.id)) throw new Error(`Davranış eklentisi kimliği geçersiz veya yineleniyor: “${behavior.id}”.`);
    ids.add(behavior.id);
  }
  const used = markup === undefined ? behaviors : (() => {
    const template = document.createElement('template');
    template.innerHTML = markup;
    return behaviors.filter((behavior) => template.content.querySelector(behavior.selector));
  })();
  return {
    css: [...new Set(used.map((behavior) => behavior.css?.trim()).filter((value): value is string => Boolean(value)))].join('\n'),
    js: used.map((behavior) => behavior.exportJs?.trim()).filter((value): value is string => Boolean(value)).join('\n'),
  };
}

const behaviorCleanups = new WeakMap<HTMLElement, Map<string, () => void>>();
const activeBehaviorsByRoot = new WeakMap<ParentNode, Map<string, Set<HTMLElement>>>();
function behaviorElements(root: ParentNode, selector: string): HTMLElement[] {
  const rootElement = (root as Node).nodeType === 1 ? root as HTMLElement : null;
  return [...(rootElement?.matches(selector) ? [rootElement] : []), ...root.querySelectorAll<HTMLElement>(selector)];
}
function initializeBehaviors(root: ParentNode, plugins: PreviewBehaviorPlugin[], mode: 'editor' | 'preview' = 'preview'): void {
  let activeByPlugin = activeBehaviorsByRoot.get(root);
  activeByPlugin ??= new Map();
  activeBehaviorsByRoot.set(root, activeByPlugin);
  for (const plugin of plugins) {
    const seen = new Set(mode === 'editor' && !plugin.runInEditor ? [] : behaviorElements(root, plugin.selector));
    const activeElements = activeByPlugin.get(plugin.id) ?? new Set<HTMLElement>();
    for (const element of seen) {
      let active = behaviorCleanups.get(element);
      const cleanup = active?.get(plugin.id);
      if (cleanup) { plugin.update?.(element,{mode}); continue; }
      const stop = plugin.mount(element,{mode});
      if (typeof stop !== 'function' && !plugin.destroy) continue;
      active ??= new Map();
      active.set(plugin.id, () => { if (typeof stop === 'function') stop(); plugin.destroy?.(element); active?.delete(plugin.id); });
      behaviorCleanups.set(element, active);
      activeElements.add(element);
    }
    for (const element of activeElements) {
      if (seen.has(element)) continue;
      behaviorCleanups.get(element)?.get(plugin.id)?.();
      activeElements.delete(element);
    }
    activeByPlugin.set(plugin.id, activeElements);
  }
}
function cleanupBehaviors(root: ParentNode, plugins: PreviewBehaviorPlugin[]): void {
  const activeByPlugin = activeBehaviorsByRoot.get(root);
  if (!activeByPlugin) return;
  for (const plugin of plugins) {
    const activeElements = activeByPlugin.get(plugin.id);
    if (!activeElements) continue;
    for (const element of activeElements) behaviorCleanups.get(element)?.get(plugin.id)?.();
    activeElements.clear();
    activeByPlugin.delete(plugin.id);
  }
  if (!activeByPlugin.size) activeBehaviorsByRoot.delete(root);
}

export interface CanvasSelection {
  blockId: string | null;
  definitionRef: VersionRef | null;
  nodeId: string | null;
  itemId: string | null;
  repeaterId: string | null;
  regionRef?: VersionRef | null;
  label: string;
}

export interface CanvasBridgeOptions {
  element: HTMLElement;
  blockManagerRoot: HTMLElement;
  document: EditorDocument;
  /** Stylesheets loaded inside the isolated GrapesJS canvas iframe. */
  stylesheets?: string[];
  definitions?: BlockDefinitionVersion[];
  behaviorPlugins?: PreviewBehaviorPlugin[];
  mode: EditorMode;
  onSelection(selection: CanvasSelection): void;
  onDocumentChange(projectData: Record<string, JsonValue>): void;
  onBlockDrop(instance: BlockInstance): void;
  onBlockRemove(instanceId: string): void;
}

export interface CanvasBridge {
  editor: Editor;
  setMode(mode: EditorMode): void;
  setRegionEditing(ref: VersionRef | null): void;
  setDesignSystemAssets(manifest: DesignSystemAssetManifest): void;
  setPreview(active: boolean): void;
  syncSharedRegion(region: SharedRegionDefinition, values: Record<string, JsonValue>): void;
  syncBlockData(block: BlockInstance, definition: BlockDefinitionVersion): void;
  syncDocument(document: EditorDocument): void;
  insertBlock(block: BlockInstance, definition: BlockDefinitionVersion): void;
  importHtmlCandidate(candidate: { html: string; css: string }): void;
  registerDefinition(definition: BlockDefinitionVersion): void;
  convertSelectionToBlock(block: BlockInstance, definition: BlockDefinitionVersion, rootNodeId: string): void;
  insertStructure(kind: 'section' | 'columns' | 'heading' | 'text' | 'image' | 'button' | 'accordion'): void;
  captureProjectData(): Record<string, JsonValue>;
  resize(): void;
  destroy(): void;
}

export async function createGrapesCanvas(options: CanvasBridgeOptions): Promise<CanvasBridge> {
  const customBehaviors = options.behaviorPlugins ?? [];
  const behaviorDependencies = behaviorExportDependencies(customBehaviors);
  const behaviorPlugins = [...DEFAULT_PREVIEW_BEHAVIORS, ...customBehaviors];
  const studioDefaults = options.document.designSystemRef.id === 'system.studio-neutral';
  const canvasCss = `${canvasCssForDesignSystem(BASE_CANVAS_CSS, studioDefaults)}\n${behaviorDependencies.css}`;
  const definitions = options.definitions ?? builtInDefinitions();
  const definitionMap = new Map(definitions.map((definition) => [`${definition.ref.id}@${definition.ref.version}`, definition]));
  const pendingDrops = new Map<string, BlockInstance>();
  const registeredInstanceIds = new Set(options.document.blocks.map((block) => block.instanceId));
  const blockInstances = new Map(options.document.blocks.map((block) => [block.instanceId, structuredClone(block)]));
  const skeleton = ensureBlockPlaceholders(clone(options.document.projectData), options.document.blocks);
  const expanded = expandPlaceholders(skeleton, options.document.blocks, definitionMap);
  let internalChanges = true;
  let destroyed = false;
  let previewMode = false;
  let activeMode = options.mode;
  let componentSelectionWasActive = false;
  let editableRegionKey: string | null = null;
  let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
  const editor = grapesjs.init({
    container: options.element,
    height: '100%',
    width: '100%',
    fromElement: false,
    noticeOnUnload: false,
    storageManager: { autoload: false, autosave: false, type: 'none' },
    blockManager: { appendTo: options.blockManagerRoot, blocks: [] },
    panels: { defaults: [] },
    canvas: { styles: [...new Set(options.stylesheets ?? [])] },
    projectData: expanded,
    showOffsets: false,
    showDevices: false,
  });
  const canvasBodyReady = new Promise<void>((resolve) => editor.once('canvas:frame:load:body', () => resolve()));
  await Promise.all([canvasBodyReady, new Promise<void>((resolve) => editor.onReady(resolve))]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  resizeCanvas();
  editor.Css.setRule(':root', { 'color-scheme': 'light' });
  // Preserve authored and saved CSS. setStyle clears the project's existing rules.
  const savedCss = editor.getCss() ?? '';
  editor.setStyle(`${canvasCss}\n${canvasCssForDesignSystem(savedCss, studioDefaults)}`);
  internalChanges = false;

  for (const definition of definitions.filter((item) => !item.archived)) {
    registerBlockTool(definition);
    registerDefinitionCss(definition);
  }

  const structureTools = [
    {
      id: 'bd-section', kind: 'section', label: 'Bölüm', description: 'Yeni bir içerik alanı ekle.',
      icon: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
      content: '<section class="bd-structure"><div data-bd-node="section-content" class="bd-structure"></div></section>',
    },
    {
      id: 'bd-columns', kind: 'columns', label: 'İki sütun', description: 'İçeriği yan yana iki alana böl.',
      icon: '<rect x="3.5" y="4" width="7.5" height="16" rx="1.5"/><rect x="13" y="4" width="7.5" height="16" rx="1.5"/>',
      content: '<div class="bd-columns"><div class="bd-column"></div><div class="bd-column"></div></div>',
    },
    {
      id: 'bd-heading', kind: 'heading', label: 'Başlık', description: 'Sayfaya başlık metni ekle.',
      icon: '<path d="M5 5.5h14M12 5.5v13m-4 0h8"/>',
      content: '<h2 class="bd-title">Yeni başlık</h2>',
    },
    {
      id: 'bd-paragraph', kind: 'text', label: 'Metin', description: 'Açıklama paragrafı ekle.',
      icon: '<path d="M5 5.5h14M5 9.5h14M5 13.5h10M5 17.5h8"/>',
      content: '<p class="bd-copy">Açıklama metnin burada yer alır.</p>',
    },
    {
      id: 'bd-image', kind: 'image', label: 'Görsel', description: 'Sayfaya görsel alanı ekle.',
      icon: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.5"/><path d="m5 17 5-5 3 3 2-2 4 4"/>',
      content: '<div class="bd-image-placeholder" role="img" aria-label="Görsel alanı">Görsel seç</div>',
    },
    {
      id: 'bd-link', kind: 'button', label: 'Buton', description: 'Bağlantı veren bir buton ekle.',
      icon: '<rect x="3.5" y="6.5" width="17" height="11" rx="3"/><path d="M7 12h10m-4-4 4 4-4 4"/>',
      content: '<a class="bd-button" href="/">Daha fazla bilgi</a>',
    },
    {
      id: 'bd-accordion', kind: 'accordion', label: 'Akordiyon listesi', description: 'Açılıp kapanan soru listesi ekle.',
      icon: '<path d="M4.5 5.5h9m-9 6h9m-9 6h9m3.5-8 2.5 2.5-2.5 2.5"/>',
      content: '<div class="bd-custom-accordion"><details class="bd-custom-accordion-item"><summary>Yeni soru</summary><p class="bd-custom-accordion-answer">Yanıt metni</p></details></div>',
    },
  ];
  for (const tool of structureTools) {
    editor.Blocks.add(tool.id, {
      label: `<span class="bd-block-name">${tool.label}</span><span class="bd-block-description">${tool.description}</span>`,
      category: { id: 'Yapı', label: 'Yapı', open: false },
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tool.icon}</svg>`,
      content: tool.content,
      attributes: {
        'data-bd-structure-kind': tool.kind,
        title: `${tool.label} · ${tool.description}`,
        'aria-label': `${tool.label}. ${tool.description}`,
      },
    });
  }

  editor.on('component:selected', (component: Component) => {
    if (previewMode) {
      editor.select(undefined);
      return;
    }
    const selection = selectionFor(component);
    options.onSelection(selection);
  });

  editor.on('component:add', (component: Component) => {
    if (internalChanges || destroyed) return;
    const attributes = component.getAttributes();
    const dropKey = attributes['data-bd-definition'];
    if (typeof dropKey === 'string') {
      const instanceId = attributes['data-bd-block-id'];
      if (typeof instanceId === 'string' && !registeredInstanceIds.has(instanceId)) {
        const sample = pendingDrops.get(instanceId);
        if (sample) {
          registeredInstanceIds.add(instanceId);
          blockInstances.set(sample.instanceId, structuredClone(sample));
          options.onBlockDrop(structuredClone(sample));
          pendingDrops.delete(instanceId);
        }
      } else if (typeof instanceId === 'string') {
        const source = blockInstances.get(instanceId);
        const definition = definitionMap.get(dropKey);
        if (source && definition) {
          const copy = cloneBlockInstance(source, definition);
          const nextAttributes = { ...attributes, 'data-bd-block-id': copy.instanceId };
          const wasInternal = internalChanges;
          internalChanges = true;
          try {
            component.setAttributes(nextAttributes);
            const itemIdMap = repeaterItemIdMap(source, copy, definition);
            for (const item of component.find('[data-bd-item]')) {
              const itemAttributes = item.getAttributes();
              const oldId = itemAttributes['data-bd-item'];
              if (typeof oldId !== 'string') continue;
              const nextId = itemIdMap.get(oldId);
              if (nextId) item.setAttributes({ ...itemAttributes, 'data-bd-item': nextId });
            }
          } finally {
            internalChanges = wasInternal;
          }
          registeredInstanceIds.add(copy.instanceId);
          blockInstances.set(copy.instanceId, structuredClone(copy));
          options.onBlockDrop(copy);
        }
      }
    }
    scheduleSnapshot();
  });

  editor.on('component:remove', (component: Component) => {
    if (internalChanges || destroyed) return;
    const instanceId = component.getAttributes()['data-bd-block-id'];
    if (typeof instanceId === 'string' && registeredInstanceIds.delete(instanceId)) {
      blockInstances.delete(instanceId);
      options.onBlockRemove(instanceId);
    }
    scheduleSnapshot();
  });

  editor.on('component:update component:styleUpdate component:drag:end', scheduleSnapshot);
  const interactionGuard = (event: Event) => stopEditingInteractions(event, previewMode);
  let guardedFrameWindow: Window | null = null;
  const bindInteractionGuard = () => {
    const current = editor.Canvas.getWindow() ?? null;
    if (current === guardedFrameWindow) return;
    guardedFrameWindow?.removeEventListener('click', interactionGuard, true);
    guardedFrameWindow?.removeEventListener('mousedown', interactionGuard, true);
    guardedFrameWindow = current;
    guardedFrameWindow?.addEventListener('click', interactionGuard, true);
    guardedFrameWindow?.addEventListener('mousedown', interactionGuard, true);
  };
  bindInteractionGuard();
  const managedFrame = editor.Canvas.getDocument();
  if (managedFrame) initializeBehaviors(managedFrame,behaviorPlugins,'editor');
  setMode(options.mode);
  editor.select();

  return {
    editor,
    setMode,
    setRegionEditing(ref) {
      editableRegionKey = activeMode === 'designer' && ref ? key(ref) : null;
      setMode(activeMode);
      if (editableRegionKey) {
        const region = findByAttribute(editor, 'data-bd-region-ref', editableRegionKey);
        if (region) editor.select(region);
      }
    },
    setDesignSystemAssets(manifest) {
      const frameDocument = editor.Canvas.getDocument();
      if (!frameDocument) return;
      frameDocument.head.querySelectorAll('[data-bd-design-system-asset]').forEach((element) => element.remove());
      const css = validateCommonCss(manifest.commonCss);
      if (css.trim()) {
        const style = frameDocument.createElement('style');
        style.dataset['bdDesignSystemAsset'] = 'common-css';
        style.textContent = css;
        frameDocument.head.append(style);
      }
      for (const [index, href] of manifest.stylesheets.entries()) {
        const url = safeStylesheetUrl(href, frameDocument.baseURI);
        if (!url) continue;
        const link = frameDocument.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.dataset['bdDesignSystemAsset'] = `stylesheet-${index}`;
        frameDocument.head.append(link);
      }
    },
    setPreview(active) {
      previewMode = active;
      // syncDocument can recreate the canvas iframe, so bind against its live
      // Window after the resolved document has been loaded.
      bindInteractionGuard();
      if (active) {
        componentSelectionWasActive = editor.Commands.isActive('core:component-select');
        if (componentSelectionWasActive) editor.stopCommand('core:component-select');
        if (!editor.Commands.isActive('core:preview')) editor.runCommand('core:preview');
      } else {
        if (editor.Commands.isActive('core:preview')) editor.stopCommand('core:preview');
        if (componentSelectionWasActive) editor.runCommand('core:component-select');
        componentSelectionWasActive = false;
      }
      const frameDocument = editor.Canvas.getDocument();
      if (frameDocument) frameDocument.documentElement.dataset['bdPreview'] = active ? 'true' : 'false';
      if (active) editor.select(undefined);
      if (frameDocument) {
        cleanupBehaviors(frameDocument, behaviorPlugins);
        initializeBehaviors(frameDocument, behaviorPlugins, active ? 'preview' : 'editor');
      }
    },
    syncSharedRegion(region, values) {
      if (destroyed) return;
      const regionRef = key(region.ref);
      const wrapper = editor.getWrapper();
      if (!wrapper) return;
      const previous = selectionModel();
      const previousAttrs = previous?.getAttributes() ?? {};
      internalChanges = true;
      const root = findByAttribute(editor, 'data-bd-region-ref', regionRef);
      const rendered = applyTemplateData(region.componentTemplate,region.fields,region.repeaters ?? [],{...region.defaultData,...values});
      if (root && rendered && typeof rendered === 'object' && !Array.isArray(rendered)) {
        root.components().reset((rendered['components'] ?? []) as never);
        if (rendered['style'] && typeof rendered['style'] === 'object') root.setStyle(rendered['style'] as Record<string,string>);
      }
      queueMicrotask(() => {
        if (destroyed) return;
        internalChanges = false;
        const previousNode = previousAttrs['data-bd-node'];
        if (typeof previousNode === 'string') {
          const selected = findByAttribute(editor, 'data-bd-node', previousNode);
          if (selected) editor.select(selected);
        }
        editor.refresh({ tools: false });
      });
    },
    syncBlockData,
    registerDefinition(definition) {
      definitionMap.set(key(definition.ref), structuredClone(definition));
      registerBlockTool(definition);
      registerDefinitionCss(definition);
    },
    convertSelectionToBlock(block, definition, rootNodeId) {
      const selected = editor.getWrapper()?.find(`[data-bd-node="${cssEscape(rootNodeId)}"]`).find((component) => component.getAttributes()['data-bd-node'] === rootNodeId);
      if (!selected || selected.getAttributes()['data-bd-container'] !== 'true') throw new Error('Blok taslağının bölüm veya sütun kapsayıcısı tuvalde bulunamadı.');
      let current: Component | undefined = selected;
      while (current) {
        if (typeof current.getAttributes()['data-bd-block-id'] === 'string') throw new Error('Mevcut bir bloğun içinden yeni blok kaydedilemez.');
        current = current.parent() ?? undefined;
      }
      const markup = renderBlockMarkup(block, definition);
      const replacement = markupToComponent(markup);
      internalChanges = true;
      try {
        const [root] = selected.replaceWith(replacement as never);
        if (!root) throw new Error('Seçili bölüm bloka dönüştürülemedi.');
        registeredInstanceIds.add(block.instanceId);
        blockInstances.set(block.instanceId, structuredClone(block));
        editor.select(root);
        setMode(activeMode);
      } finally {
        queueMicrotask(() => {
          if (destroyed) return;
          internalChanges = false;
          editor.refresh({ tools: false });
        });
      }
    },
    syncDocument(document) {
      if (destroyed) return;
      blockInstances.clear();
      for (const block of document.blocks) blockInstances.set(block.instanceId, structuredClone(block));
      internalChanges = true;
      const projectData = expandPlaceholders(clone(document.projectData), document.blocks, definitionMap);
      editor.loadProjectData(projectData as never);
      const useStudioDefaults = document.designSystemRef.id === 'system.studio-neutral';
      editor.setStyle(`${canvasCssForDesignSystem(BASE_CANVAS_CSS, useStudioDefaults)}\n${canvasCssForDesignSystem(editor.getCss() ?? '', useStudioDefaults)}`);
      if (behaviorDependencies.css) editor.addStyle(behaviorDependencies.css);
      for (const block of document.blocks) {
        const root = findByAttribute(editor, 'data-bd-block-id', block.instanceId);
        if (!root) {
          const definition = definitionMap.get(key(block.definitionRef));
          if (definition) {
            registerDefinitionCss(definition);
            editor.addComponents(markupToComponent(renderBlockMarkup(block, definition)) as never);
          }
        }
      }
      for (const block of document.blocks) registeredInstanceIds.add(block.instanceId);
      queueMicrotask(() => {
        if (!destroyed) {
          internalChanges = false;
          editor.refresh({ tools: false });
          const frameDocument = editor.Canvas.getDocument();
          if (frameDocument) initializeBehaviors(frameDocument, behaviorPlugins, previewMode ? 'preview' : 'editor');
        }
      });
    },
    insertBlock(block, definition) {
      if (destroyed) return;
      internalChanges = true;
      const selected = editor.getSelected();
      let target=selected;
      while(target && target!==editor.getWrapper() && target.getAttributes()['data-bd-container']!=='true') target=target.parent() ?? undefined;
      const slot=activeMode==='content' ? findByAttribute(editor,'data-bd-template-slot','content-main') : undefined;
      const parent=slot ?? target ?? editor.getWrapper();if(!parent)return;
      const inserted=parent.components().add(markupToComponent(renderBlockMarkup(block,definition)) as never);
      if(inserted)editor.select(inserted);
      registeredInstanceIds.add(block.instanceId);
      blockInstances.set(block.instanceId, structuredClone(block));
      queueMicrotask(() => {
        if (destroyed) return;
        internalChanges = false;
        scheduleSnapshot();
      });
    },
    importHtmlCandidate(candidate) {
      if (destroyed) return;
      const component = markupToComponent(candidate.html);
      internalChanges = true;
      try {
        const [root] = editor.addComponents(component as never);
        if (!root) throw new Error('Seçilen HTML bölümü tuvale eklenemedi.');
        if (candidate.css.trim()) editor.addStyle(candidate.css);
        editor.select(root);
      } finally {
        queueMicrotask(() => {
          if (destroyed) return;
          internalChanges = false;
          scheduleSnapshot();
          editor.refresh({ tools: false });
        });
      }
    },
    insertStructure(kind) {
      if (destroyed) return;
      const node = () => `node-${makeId('structure')}`;
      const map = {
        section: `<section class="bd-structure" data-bd-node="${node()}" data-bd-container="true"><div class="bd-structure" data-bd-node="${node()}" data-bd-container="true"></div></section>`,
        columns: `<div class="bd-columns" data-bd-node="${node()}" data-bd-container="true"><div class="bd-column" data-bd-node="${node()}" data-bd-container="true"></div><div class="bd-column" data-bd-node="${node()}" data-bd-container="true"></div></div>`,
        heading: `<h2 class="bd-title" data-bd-node="${node()}">Yeni başlık</h2>`,
        text: `<p class="bd-copy" data-bd-node="${node()}">Açıklama metnin burada yer alır.</p>`,
        image: `<div class="bd-image-placeholder" data-bd-node="${node()}" role="img" aria-label="Görsel alanı">Görsel seç</div>`,
        button: `<a class="bd-button" data-bd-node="${node()}" href="/">Daha fazla bilgi</a>`,
        accordion: `<div class="bd-custom-accordion" data-bd-node="${node()}" data-bd-container="true"><details class="bd-custom-accordion-item" data-bd-node="${node()}"><summary class="bd-custom-accordion-question" data-bd-node="${node()}">Yeni soru</summary><p class="bd-custom-accordion-answer" data-bd-node="${node()}">Yanıt metni</p></details></div>`,
      };
      const selected = editor.getSelected();
      let target = selected;
      while (target && target !== editor.getWrapper() && target.getAttributes()['data-bd-container'] !== 'true') {
        target = target.parent() ?? undefined;
      }
      internalChanges = true;
      try {
        const added=(target ?? editor.getWrapper())?.components().add(markupToComponent(map[kind]) as never);
        if(added){added.set('name',({section:'Bölüm',columns:'İki sütun',heading:'Başlık',text:'Metin',image:'Görsel',button:'Buton',accordion:'Akordiyon'})[kind]);editor.select(added);}
      } finally {
        queueMicrotask(() => {
          if (destroyed) return;
          internalChanges = false;
          scheduleSnapshot();
        });
      }
    },
    captureProjectData() {
      return transformPlaceholders(clone(editor.getProjectData()) as Record<string, JsonValue>) as Record<string, JsonValue>;
    },
    resize: resizeCanvas,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (snapshotTimer) clearTimeout(snapshotTimer);
      if (editor.Commands.isActive('core:preview')) editor.stopCommand('core:preview');
      guardedFrameWindow?.removeEventListener('click', interactionGuard, true);
      guardedFrameWindow?.removeEventListener('mousedown', interactionGuard, true);
      const frameDocument = editor.Canvas.getDocument();
      if (frameDocument) cleanupBehaviors(frameDocument, behaviorPlugins);
      editor.destroy();
      options.element.replaceChildren();
      options.blockManagerRoot.replaceChildren();
    },
  };

  function setMode(mode: EditorMode): void {
    activeMode = mode;
    if (mode !== 'designer') editableRegionKey = null;
    const frameDocument = editor.Canvas.getDocument();
    if (frameDocument) frameDocument.documentElement.dataset['bdMode'] = mode;
    const wrapper = editor.getWrapper();
    if (!wrapper) return;
    const wasInternal = internalChanges;
    internalChanges = true;
    try {
      wrapper.set('droppable', true);
      wrapper.set('editable', false);
      options.blockManagerRoot.dataset['bdMode'] = mode;
      wrapper.find('[data-bd-block-id]').forEach((block) => {
        const ref = parseRef(String(block.getAttributes()['data-bd-definition'] ?? ''));
        const definition = ref ? definitionMap.get(key(ref)) : undefined;
        const readonly = mode === 'content' || definition?.stylePolicy.structuralEdits === false;
        block.set('droppable', !readonly);
        block.set('draggable', !readonly);
        block.find('*').forEach((child) => {
          child.set('droppable', !readonly);
          child.set('draggable', !readonly);
          child.set('editable', false);
        });
      });
      wrapper.find('[data-bd-locked="true"]').forEach((region) => {
        region.set('droppable', false); region.set('draggable', false); region.set('editable', false); region.set('removable', false); region.set('copyable', false);
        region.find('*').forEach((child) => { child.set('draggable', false); child.set('editable', false); child.set('removable', false); child.set('copyable', false); });
      });
      if (editableRegionKey && mode === 'designer') {
        const region = findByAttribute(editor, 'data-bd-region-ref', editableRegionKey);
        if (region) {
          region.set('droppable', true); region.set('draggable', false); region.set('editable', false); region.set('removable', false); region.set('copyable', false);
          region.find('*').forEach((child) => {
            child.set('droppable', true); child.set('draggable', true); child.set('editable', true); child.set('removable', true); child.set('copyable', true);
          });
        }
      }
    } finally {
      internalChanges = wasInternal;
    }
  }

  function resizeCanvas(): void {
    if (destroyed) return;
    const bounds = options.element.getBoundingClientRect();
    const frame = editor.Canvas.getFrameEl();
    frame.style.width = `${Math.max(1, Math.round(bounds.width))}px`;
    frame.style.height = `${Math.max(520, Math.round(bounds.height))}px`;
    editor.refresh({ tools: false });
  }

  function selectionModel(): Component | undefined {
    return editor.getSelected() ?? undefined;
  }

  function syncBlockData(block: BlockInstance, definition: BlockDefinitionVersion): void {
    if (destroyed) return;
    blockInstances.set(block.instanceId, structuredClone(block));
    const root = findByAttribute(editor, 'data-bd-block-id', block.instanceId);
    if (!root) return;
    const previous = selectionModel();
    const previousAttrs = previous?.getAttributes() ?? {};
    const next = markupToComponent(renderBlockMarkup(block, definition)) as Record<string, JsonValue>;
    internalChanges = true;
    const rootAttributes = (next['attributes'] && typeof next['attributes'] === 'object' && !Array.isArray(next['attributes']) ? next['attributes'] : root.getAttributes()) as Record<string,any>;
    rootAttributes['data-bd-block-id'] = block.instanceId;
    rootAttributes['data-bd-definition'] = key(definition.ref);
    root.setAttributes(rootAttributes);
    if (next['style'] && typeof next['style'] === 'object' && !Array.isArray(next['style'])) root.setStyle(next['style'] as Record<string,string>);
    const nextComponents = Array.isArray(next['components']) ? next['components'] : [];
    root.components().reset(nextComponents as never);
    queueMicrotask(() => {
      if (destroyed) return;
      internalChanges = false;
      const previousNode = previousAttrs['data-bd-node'];
      const previousItem = previousAttrs['data-bd-item'];
      const previousRepeater = previousAttrs['data-bd-repeater'];
      if (typeof previousNode === 'string') {
        const wrapper = editor.getWrapper();
        const selected = wrapper?.find(`[data-bd-node="${cssEscape(previousNode)}"]`).find((item) => item.getAttributes()['data-bd-block-id'] === block.instanceId && item.getAttributes()['data-bd-node'] === previousNode && (typeof previousItem !== 'string' || item.getAttributes()['data-bd-item'] === previousItem) && (typeof previousRepeater !== 'string' || item.getAttributes()['data-bd-repeater'] === previousRepeater));
        if (selected) editor.select(selected);
      }
      editor.refresh({ tools: false });
      const frameDocument = editor.Canvas.getDocument();
      if (frameDocument) initializeBehaviors(frameDocument, behaviorPlugins, previewMode ? 'preview' : 'editor');
    });
  }

  function scheduleSnapshot(): void {
    if (internalChanges || destroyed) return;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => {
      if (!destroyed) options.onDocumentChange(transformPlaceholders(clone(editor.getProjectData()) as Record<string, JsonValue>) as Record<string, JsonValue>);
    }, 180);
  }

  function selectionFor(component: Component): CanvasSelection {
    let current: Component | undefined = component;
    let nodeId: string | null = null;
    let itemId: string | null = null;
    let repeaterId: string | null = null;
    let blockId: string | null = null;
    let regionRef: VersionRef | null = null;
    let definitionRef: VersionRef | null = null;
    let label = component.getName() || component.get('tagName') || 'Bileşen';
    while (current) {
      const attributes = current.getAttributes();
      if (!nodeId && typeof attributes['data-bd-node'] === 'string') nodeId = attributes['data-bd-node'];
      if (!itemId && typeof attributes['data-bd-item'] === 'string') itemId = attributes['data-bd-item'];
      if (!repeaterId && typeof attributes['data-bd-repeater'] === 'string') repeaterId = attributes['data-bd-repeater'];
      if (!blockId && typeof attributes['data-bd-block-id'] === 'string') {
        blockId = attributes['data-bd-block-id'];
        const rawRef = attributes['data-bd-definition'];
        if (typeof rawRef === 'string') definitionRef = parseRef(rawRef);
        label = definitionMap.get(key(definitionRef))?.name ?? label;
      }
      if (!regionRef && typeof attributes['data-bd-region-ref'] === 'string') regionRef = parseRef(attributes['data-bd-region-ref']);
      current = current.parent();
    }
    return { blockId, definitionRef, nodeId, itemId, repeaterId, regionRef, label: String(label) };
  }

  function registerBlockTool(definition: BlockDefinitionVersion): void {
    if (definition.archived || ['blockdesign.faq','blockdesign.banner'].includes(definition.ref.id)) return;
    const sample = makeInstance(definition);
    const content = renderBlockMarkup(sample, definition);
    const description = blockToolDescription(definition);
    editor.Blocks.add(`bd-drop-${definition.ref.id}-${definition.ref.version}`, {
      label: `<span class="bd-block-name">${escapeHtml(definition.name)}</span><span class="bd-block-description">${escapeHtml(description)}</span>`,
      category: { id: definition.category, label: definition.category, open: true },
      media: blockToolIcon(definition),
      content,
      activate: false,
      select: true,
      resetId: true,
      attributes: {
        'data-bd-drop-definition': key(definition.ref),
        title: `${definition.name} · ${definition.description}`,
        'aria-label': `${definition.name}. ${description}. Tuvale ekle.`,
      },
    });
    pendingDrops.set(sample.instanceId, sample);
  }

  function blockToolDescription(definition: BlockDefinitionVersion): string {
    const fields = [...new Set(definition.fields
      .map((field) => field.label.trim())
      .filter((label) => label && !/^(?:üst başlık|metin|bölüm bağlantı kimliği)$/i.test(label)))];
    const repeaters = definition.repeaters.filter((repeater) => repeater.label.trim());
    const fieldSummary = fields.length
      ? `${fields.slice(0, 2).join(', ')}${fields.length > 2 ? ` +${fields.length - 2} alan` : ''}`
      : '';
    const repeaterSummary = repeaters
      .slice(0, 1)
      .map((repeater) => `${repeater.label} listesi${repeater.itemFields.length ? ` · ${repeater.itemFields.length} alan` : ''}`)[0] ?? '';
    const summary = [fieldSummary, repeaterSummary].filter(Boolean).join(' · ');
    if (summary) return summary;
    if (/^Scala Nova Türkçe sayfasından içe aktarıldı\./i.test(definition.description)) {
      const counts = [
        definition.fields.length ? `${definition.fields.length} alan` : '',
        repeaters.length ? `${repeaters.length} liste` : '',
      ].filter(Boolean);
      return counts.length ? `Düzenlenebilir: ${counts.join(' · ')}` : 'Düzenlenebilir bölüm';
    }
    return definition.description;
  }

  function blockToolIcon(definition: BlockDefinitionVersion): string {
    const search = [
      definition.ref.id,
      definition.name,
      definition.category,
      ...definition.fields.map((field) => field.label),
      ...definition.repeaters.map((repeater) => repeater.label),
    ]
      .join(' ')
      .toLocaleLowerCase('tr-TR');
    const icon = /dil seçici|languages/.test(search) ? '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c5 5 5 12 0 17m0-17c-5 5-5 12 0 17"/>' : /menü|\bmenu\b/.test(search) ? '<path d="M4 6h16M4 12h11M4 18h11m3-8 3 2-3 2"/>' : definition.preview === 'faq' || /sık sorulan|\bsoru\b|akordiyon|\bfaq\b/.test(search)
      ? '<path d="M4.5 5.5h9m-9 6h9m-9 6h9m3.5-8 2.5 2.5-2.5 2.5"/>'
      : definition.preview === 'cards' || /kart|card/.test(search)
        ? '<rect x="3.5" y="4.5" width="7.5" height="15" rx="1.5"/><rect x="13" y="4.5" width="7.5" height="15" rx="1.5"/><path d="M5.5 8h3.5m-3.5 3h3.5m6 0h3.5m-3.5 3h3.5"/>'
        : definition.preview === 'slider' || /slider|slayt|kaydır/.test(search)
          ? '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="m9 14 2.5-2.5L16 16m-8-7h.01M3 9l-1.5 3L3 15m18-6 1.5 3-1.5 3"/>'
          : definition.preview === 'banner' || /banner|tanıtım|anasayfa|ana sayfa|kampanya/.test(search)
            ? '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M5.5 15 10 10.5l3 3 2-2L19 15m-9-6h.01"/>'
            : /form|başvuru|rezervasyon|talep/.test(search)
              ? '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7m-7 4h7m-7 4h4"/>'
              : /iletişim|contact|e-posta|eposta/.test(search)
                ? '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m5 7 7 5.5L19 7"/>'
                : /yasal|hukuk|gizlilik|çerez|politika|koşul/.test(search)
                  ? '<path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 4v4h4M9 12h6m-6 3h6"/>'
                  : /destinasyon|rota|lokasyon|harita|şehir|ülke/.test(search)
                    ? '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>'
                    : /aktivite|deneyim|etkinlik|macera/.test(search)
                        ? '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/>'
                        : /buton|bağlantı|çağrı|cta/.test(search)
                            ? '<rect x="3.5" y="6.5" width="17" height="11" rx="3"/><path d="M7 12h10m-4-4 4 4-4 4"/>'
                            : /tur|hizmet|gezi|seyahat|rehber/.test(search)
                              ? '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>'
                              : /görsel|fotoğraf|galeri|image|medya/.test(search)
                                ? '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.5"/><path d="m5 17 5-5 3 3 2-2 4 4"/>'
                                : /metin|içerik|bilgi|yazı/.test(search)
                              ? '<path d="M5 5.5h14M5 9.5h14M5 13.5h9M5 17.5h7"/>'
                              : '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
  }

  function registerDefinitionCss(definition: BlockDefinitionVersion): void {
    const css = definition.css?.trim();
    if (!css) return;
    const rootAttributes = templateAttributes(definition.componentTemplate);
    const scopeId = rootAttributes?.['data-bd-import'];
    if (typeof scopeId === 'string' && (editor.getCss() ?? '').includes(`[data-bd-import="${scopeId}"]`)) return;
    editor.addStyle(css);
  }
}

export function renderBlockMarkup(block: BlockInstance, definition: BlockDefinitionVersion): string {
  let html = renderBlockMarkupBase(block, definition);
  const live = block.sourceBindings.filter(b=>b.live&&b.mode==='query'&&b.target.scope==='repeater').map(binding=>{
    const schema=definition.repeaters.find(r=>r.repeaterId===binding.target.id||r.key===binding.target.id);
    if(!schema?.mappingTarget)throw new Error('Canlı liste için HTML kapsayıcı ve öğe eşlemesi gerekli.');
    const templates:Record<string,string>={};const collect=(repeater:import('@blockdesign/contracts').RepeaterDefinition)=>{const item=repeater.mappingTarget?findTemplateNode(definition.componentTemplate,repeater.mappingTarget.itemNodeId):null;if(!item)throw new Error('Canlı liste öğesi şablonu bulunamadı.');templates[repeater.repeaterId]=componentToHtml(item);for(const child of repeater.childRepeaters??[])collect(child);};collect(schema);
    return {binding,schema,templates};
  });
  if(live.length)html=html.replace(/^(<[a-z][^>]*)(>)/i,(_,start,end)=>start+' data-bd-collection="'+escapeAttribute(JSON.stringify(live))+'"'+end);
  if(definition.behavior) {
    const values=Object.fromEntries(definition.behavior.settings.map(field=>[field.key,block.behaviorSettings?.[field.key] ?? field.defaultValue]));
    html=html.replace(/^(<[a-z][^>]*)(>)/i,(_,start,end)=>start.replace(/\sdata-bd-(?:plugin|behavior-settings)="[^"]*"/g,'')+' data-bd-plugin="'+escapeAttribute(definition.behavior!.pluginId)+'" data-bd-behavior-settings="'+escapeAttribute(JSON.stringify(values))+'"'+end);
  }
  const styles = allowedStyleOverrides(block.styleOverrides, definition.stylePolicy.allowedProperties);
  if (!Object.keys(styles).length && !Object.keys(block.nodeStyleOverrides ?? {}).length) return html;
  const component = markupToComponent(html);
  if (component && !Array.isArray(component) && typeof component === 'object') {
    const existing = component['style'];
    component['style'] = { ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}), ...styles };
    const walk = (value: JsonValue): void => {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== 'object') return;
      const attrs = value['attributes'];
      const node = attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? attrs['data-bd-node'] : null;
      const overrides = typeof node === 'string' ? block.nodeStyleOverrides?.[node] : null;
      if (overrides) { const current = value['style']; value['style'] = { ...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}), ...allowedStyleOverrides(overrides,definition.stylePolicy.allowedProperties) }; }
      if (Array.isArray(value['components'])) value['components'].forEach(walk);
    };
    walk(component);
  }
  return componentToHtml(component);
}
function renderBlockMarkupBase(block: BlockInstance, definition: BlockDefinitionVersion): string {
  const data = block.manualData;
  const attr = `data-bd-block-id="${escapeAttribute(block.instanceId)}" data-bd-definition="${escapeAttribute(key(definition.ref))}"`;
  if (definition.preview === 'faq') {
    const rows = Array.isArray(data['items']) ? data['items'] : [];
    const content = rows.map((row) => {
      const values = row as Record<string, JsonValue>;
      const itemId = String(values['__id'] ?? '');
      return `<details class="bd-item" data-bd-node="faq-item" data-bd-item="${escapeAttribute(itemId)}"><summary class="bd-question" data-bd-node="faq-question" data-bd-item="${escapeAttribute(itemId)}">${escapeHtml(String(values['question'] ?? ''))}</summary><p class="bd-answer" data-bd-node="faq-answer" data-bd-item="${escapeAttribute(itemId)}">${escapeHtml(String(values['answer'] ?? ''))}</p></details>`;
    }).join('');
    return `<section class="bd-faq-grid bd-block" ${attr}><header><p class="bd-eyebrow" data-bd-node="faq-eyebrow">${escapeHtml(String(data['eyebrow'] ?? ''))}</p><h2 class="bd-title" data-bd-node="faq-title">${escapeHtml(String(data['title'] ?? ''))}</h2><p class="bd-copy" data-bd-node="faq-description">${escapeHtml(String(data['description'] ?? ''))}</p></header><div class="bd-items">${content || '<p class="bd-placeholder">Bu listede henüz soru yok.</p>'}</div></section>`;
  }
  if (definition.preview === 'banner') {
    const image = String(data['image'] ?? '');
    const imagePart = image
      ? `<img class="bd-banner-img" data-bd-node="banner-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(String(data['alt'] ?? ''))}">`
      : '<div class="bd-banner-img bd-placeholder" role="img" aria-label="Henüz görsel seçilmedi">Görsel seç</div>';
    const href = String(data['url'] ?? '');
    const buttonPart = String(data['buttonText'] ?? '')
      ? `<a class="bd-button" data-bd-node="banner-button" href="${escapeAttribute(href || '#')}">${escapeHtml(String(data['buttonText']))}</a>`
      : '';
    return `<section class="bd-banner-grid bd-block" ${attr}><header><p class="bd-eyebrow" data-bd-node="banner-eyebrow">${escapeHtml(String(data['eyebrow'] ?? ''))}</p><h2 class="bd-title" data-bd-node="banner-title">${escapeHtml(String(data['title'] ?? ''))}</h2><p class="bd-copy" data-bd-node="banner-description">${escapeHtml(String(data['description'] ?? ''))}</p>${buttonPart}</header>${imagePart}</section>`;
  }
  if (definition.preview === 'slider') {
    const rows = Array.isArray(data['slides']) ? data['slides'] : [];
    const slides = rows.map((item, index) => {
      if (!item || Array.isArray(item) || typeof item !== 'object') return '';
      const row = item as Record<string, JsonValue>;
      const id = String(row['__id'] ?? `slide-${index + 1}`);
      const image = String(row['image'] ?? '');
      const href = String(row['url'] ?? '#');
      const title = escapeHtml(String(row['title'] ?? ''));
      const description = escapeHtml(String(row['description'] ?? ''));
      const visual = image ? `<img data-bd-node="slider-image" data-bd-item="${escapeAttribute(id)}" src="${escapeAttribute(image)}" alt="${escapeAttribute(String(row['alt'] ?? ''))}">` : '<div class="bd-placeholder" role="img">Görsel ekle</div>';
      const link = href && isSafeUrl(href) ? `<a class="bd-button" data-bd-node="slider-link" data-bd-item="${escapeAttribute(id)}" href="${escapeAttribute(href)}">İncele</a>` : '';
      return `<article class="bd-slide" data-bd-slide data-bd-item="${escapeAttribute(id)}">${visual}<div><h3 data-bd-node="slider-title" data-bd-item="${escapeAttribute(id)}">${title}</h3><p data-bd-node="slider-description" data-bd-item="${escapeAttribute(id)}">${description}</p>${link}</div></article>`;
    }).join('');
    const count = Math.max(rows.length, 1);
    return `<section class="bd-slider bd-block" ${attr} data-bd-behavior="slider"><div class="bd-slider-track" data-bd-slider-track>${slides || '<article class="bd-slide" data-bd-slide><div class="bd-placeholder">Slayt ekle</div></article>'}</div><div class="bd-slider-controls"><span data-bd-slider-status>1 / ${count}</span><button type="button" data-bd-slider-prev aria-label="Önceki slayt">‹</button><button type="button" data-bd-slider-next aria-label="Sonraki slayt">›</button></div></section>`;
  }
  if (definition.preview === 'custom') return renderCustomBlockMarkup(block, definition);
  return `<section class="bd-placeholder bd-block" ${attr}>${escapeHtml(definition.name)}</section>`;
}

function repeaterItemIdMap(source: BlockInstance, copy: BlockInstance, definition: BlockDefinitionVersion): Map<string, string> {
  const ids = new Map<string, string>();
  const collect=(sourceRows:JsonValue|undefined,copyRows:JsonValue|undefined,schema:import('@blockdesign/contracts').RepeaterDefinition):void=>{
    if(!Array.isArray(sourceRows)||!Array.isArray(copyRows))return;
    sourceRows.forEach((sourceRow,index)=>{const copyRow=copyRows[index];if(!sourceRow||Array.isArray(sourceRow)||typeof sourceRow!=='object'||!copyRow||Array.isArray(copyRow)||typeof copyRow!=='object')return;
      if(typeof sourceRow.__id==='string'&&typeof copyRow.__id==='string')ids.set(sourceRow.__id,copyRow.__id);
      for(const child of schema.childRepeaters??[])collect(sourceRow[child.key],copyRow[child.key],child);
    });
  };
  for(const schema of definition.repeaters)collect(source.manualData[schema.key],copy.manualData[schema.key],schema);
  return ids;
}

function renderCustomBlockMarkup(block: BlockInstance, definition: BlockDefinitionVersion): string {
  const root = applyTemplateData(definition.componentTemplate, definition.fields, definition.repeaters, block.manualData);
  if (!root || Array.isArray(root) || typeof root !== 'object') return '';
  const component = root as Record<string, JsonValue>;
  if (definition.ref.id === 'blockdesign.menu') {
    const shell = findTemplateNode(root, 'menu-shell');
    if (shell) shell.attributes = { ...(shell.attributes as Record<string,JsonValue> ?? {}), open: block.manualData.layout === 'horizontal' };
  }
  const rawAttributes = component['attributes'];
  const attributes = rawAttributes && !Array.isArray(rawAttributes) && typeof rawAttributes === 'object' ? rawAttributes as Record<string, JsonValue> : {};
  attributes['data-bd-block-id'] = block.instanceId;
  attributes['data-bd-definition'] = key(definition.ref);
  delete attributes['data-bd-container'];
  delete attributes['data-bd-structure-kind'];
  const classes = typeof attributes['class'] === 'string' ? attributes['class'].split(/\s+/).filter((name) => name && name !== 'bd-structure') : [];
  if (!classes.includes('bd-block')) classes.push('bd-block');
  attributes['class'] = classes.join(' ');
  component['attributes'] = attributes;
  if (definition.ref.id === 'blockdesign.cms-form') {
    attributes['data-bd-cms-form'] = 'true';
    if (block.formBinding) attributes['data-bd-form-binding'] = JSON.stringify(block.formBinding);
    component.components = [{ type:'textnode',content:'CMS formu yükleniyor…' }];
  }
  // Imported page sections can link to anchors in sibling blocks. Keep their
  // source IDs intact; the original page does not share a DOM with other pages.
  if (attributes['data-bd-import'] !== 'scalanova-tour-tr') rewriteComponentIds(root, block.instanceId);
  return componentToHtml(root);
}

function applyMappedFields(root: JsonValue, fields: FieldDefinition[], data: Record<string, JsonValue>): void {
  const fieldMap = new Map<string, FieldDefinition[]>();
  for (const field of fields) {
    const nodeFields = fieldMap.get(field.mappingTarget.nodeId) ?? [];
    nodeFields.push(field);
    fieldMap.set(field.mappingTarget.nodeId, nodeFields);
  }
  const apply = (value: JsonValue): void => {
    if (Array.isArray(value)) { value.forEach(apply); return; }
    if (!value || typeof value !== 'object') return;
    const component = value as Record<string, JsonValue>;
    const attributes = templateAttributes(component);
    if (attributes && typeof attributes['data-bd-node'] === 'string') {
      const nodeFields = fieldMap.get(attributes['data-bd-node']);
      for (const field of nodeFields ?? []) {
        const fieldValue = data[field.key] ?? field.defaultValue;
        if (field.mappingTarget.operation === 'text' || field.mappingTarget.operation === 'safeRichText') {
          component['components'] = [{ type: 'textnode', content: String(fieldValue ?? '') }];
          delete component['content'];
        } else if (field.mappingTarget.operation === 'attribute' && field.mappingTarget.property) {
          attributes[field.mappingTarget.property] = fieldValue;
        } else if (field.mappingTarget.operation === 'style' && field.mappingTarget.property) {
          const style = component['style'];
          const styles = style && !Array.isArray(style) && typeof style === 'object' ? style as Record<string, JsonValue> : {};
          styles[field.mappingTarget.property] = fieldValue;
          component['style'] = styles;
        } else if (field.mappingTarget.operation === 'booleanVisibility') {
          if (fieldValue === true) attributes['hidden'] = true;
          else delete attributes['hidden'];
        }
      }
    }
    const children = component['components'];
    if (Array.isArray(children)) children.forEach(apply);
  };
  apply(root);
}

function templateAttributes(value: JsonValue): Record<string, JsonValue> | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const raw = (value as Record<string, JsonValue>)['attributes'];
  return raw && !Array.isArray(raw) && typeof raw === 'object' ? raw as Record<string, JsonValue> : null;
}

function templateNodeId(value: JsonValue): string | null {
  const id = templateAttributes(value)?.['data-bd-node'];
  return typeof id === 'string' ? id : null;
}

function findTemplateNode(root: JsonValue, nodeId: string): Record<string, JsonValue> | null {
  if (Array.isArray(root)) {
    for (const child of root) { const found = findTemplateNode(child, nodeId); if (found) return found; }
    return null;
  }
  if (!root || typeof root !== 'object') return null;
  const component = root as Record<string, JsonValue>;
  if (templateNodeId(root) === nodeId) return component;
  const children = component['components'];
  return Array.isArray(children) ? findTemplateNode(children, nodeId) : null;
}

function rewriteComponentIds(value: JsonValue, prefix: string): void {
  const refs = ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns'];
  const processScope = (root: JsonValue, scopePrefix: string): void => {
    const scopedNodes: Record<string, JsonValue>[] = [];
    const nestedItems: Array<{ node: JsonValue; itemId: string }> = [];
    const collect = (item: JsonValue, isScopeRoot = false): void => {
      if (Array.isArray(item)) { item.forEach((child) => collect(child)); return; }
      if (!item || typeof item !== 'object') return;
      const component = item as Record<string, JsonValue>;
      const attrs = templateAttributes(item);
      if (!isScopeRoot && typeof attrs?.['data-bd-item'] === 'string') {
        nestedItems.push({ node: item, itemId: attrs['data-bd-item'] });
        return;
      }
      scopedNodes.push(component);
      if (Array.isArray(component['components'])) component['components'].forEach((child) => collect(child));
    };
    collect(root, true);

    const idMap = new Map<string, string>();
    const idCounts = new Map<string, number>();
    for (const component of scopedNodes) {
      const attrs = templateAttributes(component as JsonValue);
      if (typeof attrs?.['id'] !== 'string') continue;
      const original = attrs['id'];
      const count = idCounts.get(original) ?? 0;
      idCounts.set(original, count + 1);
      const replacement = `${scopePrefix}-${original}${count ? `-${count + 1}` : ''}`;
      idMap.set(original, replacement);
      attrs['id'] = replacement;
    }
    for (const component of scopedNodes) {
      const attrs = templateAttributes(component as JsonValue);
      if (!attrs) continue;
      for (const name of refs) {
        const raw = attrs[name];
        if (typeof raw === 'string') attrs[name] = raw.split(/\s+/).map((token) => idMap.get(token) ?? token).join(' ');
      }
      if (typeof attrs['href'] === 'string' && attrs['href'].startsWith('#')) attrs['href'] = `#${idMap.get(attrs['href'].slice(1)) ?? attrs['href'].slice(1)}`;
    }
    for (const item of nestedItems) processScope(item.node, `${scopePrefix}-${item.itemId}`);
  };
  processScope(value, prefix);
}

function componentToHtml(value: JsonValue): string {
  const node = (input: JsonValue): Node | null => {
    if (Array.isArray(input)) {
      const fragment = document.createDocumentFragment();
      input.forEach((item) => { const child = node(item); if (child) fragment.append(child); });
      return fragment;
    }
    if (typeof input === 'string' || typeof input === 'number') return document.createTextNode(String(input));
    if (!input || typeof input !== 'object') return null;
    const component = input as Record<string, JsonValue>;
    // GrapesJS uses `type: "text"` for editable HTML elements such as <p>.
    // Only textnode models should be emitted as bare text; otherwise the
    // element tag and any mapped child text disappear from custom blocks.
    if (component['type'] === 'textnode') return document.createTextNode(String(component['content'] ?? ''));
    const tagName = typeof component['tagName'] === 'string' ? component['tagName'].toLowerCase() : 'div';
    if (!/^[a-z][a-z0-9-]*$/.test(tagName) || ['script', 'style', 'iframe', 'object', 'embed'].includes(tagName)) return null;
    const element = document.createElement(tagName);
    const attributes = component['attributes'];
    if (attributes && !Array.isArray(attributes) && typeof attributes === 'object') {
      for (const [name, raw] of Object.entries(attributes)) {
        const normalized = name.toLowerCase();
        if (!/^[a-z_:][a-z0-9:._-]*$/i.test(name) || normalized.startsWith('on') || normalized === 'style' || normalized === 'contenteditable') continue;
        const content = String(raw ?? '');
        if (['href', 'src', 'poster', 'xlink:href'].includes(normalized) && content && !isSafeUrl(content)) continue;
        if (['hidden', 'disabled', 'required', 'open', 'autoplay', 'controls', 'loop', 'muted'].includes(normalized)) {
          if (raw === true || raw === '') element.setAttribute(name, '');
          continue;
        }
        element.setAttribute(name, content);
      }
    }
    if(tagName === 'img' && !element.getAttribute('src')) return null;
    const style = component['style'];
    if (style && !Array.isArray(style) && typeof style === 'object') {
      const styleElement = document.createElement('span').style;
      for (const [property, raw] of Object.entries(style)) {
        if (!/^(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)$/i.test(property) || typeof raw !== 'string' || /expression\s*\(/i.test(raw) || (/url\s*\(/i.test(raw) && !safeStyleValue(property,raw))) continue;
        styleElement.setProperty(property, raw);
      }
      if (styleElement.cssText) element.setAttribute('style', styleElement.cssText);
    }
    const children = component['components'];
    if (Array.isArray(children)) children.forEach((child) => { const rendered = node(child); if (rendered) element.append(rendered); });
    else if (typeof children === 'string') element.textContent = children;
    else if (typeof component['content'] === 'string') element.textContent = component['content'];
    return element;
  };
  const rendered = node(value);
  return rendered instanceof Element ? rendered.outerHTML : '';
}

function transformPlaceholders(projectData: Record<string, JsonValue>): Record<string, JsonValue> {
  const process = (value: JsonValue): JsonValue => {
    if (Array.isArray(value)) return value.map(process);
    if (!value || typeof value !== 'object') return value;
    const attributes = value['attributes'];
    if (attributes && !Array.isArray(attributes) && typeof attributes === 'object') {
      const id = attributes['data-bd-block-id'];
      const definition = attributes['data-bd-definition'];
      if (typeof id === 'string' && typeof definition === 'string') {
        return { type: 'default', tagName: 'div', attributes: { 'data-bd-placeholder-id': id, 'data-bd-placeholder-definition': definition }, components: [] };
      }
    }
    return Object.fromEntries(Object.entries(value).map(([name, child]) => [name, process(child)])) as JsonValue;
  };
  return process(projectData) as Record<string, JsonValue>;
}

function ensureBlockPlaceholders(projectData: Record<string, JsonValue>, blocks: BlockInstance[]): Record<string, JsonValue> {
  const pages = projectData['pages'];
  if (!Array.isArray(pages) || !pages.length || !pages[0] || Array.isArray(pages[0]) || typeof pages[0] !== 'object') return projectData;
  const page = pages[0] as Record<string, JsonValue>;
  const component = page['component'];
  if (!component || Array.isArray(component) || typeof component !== 'object') return projectData;
  const wrapper = component as Record<string, JsonValue>;
  const slot = findJsonComponent(wrapper, 'data-bd-template-slot', 'content-main');
  const container = slot ?? wrapper;
  const children = Array.isArray(container['components']) ? [...container['components']] : [];
  const contains = (value: JsonValue, id: string): boolean => {
    if (Array.isArray(value)) return value.some((child) => contains(child, id));
    if (!value || typeof value !== 'object') return false;
    const attributes = value['attributes'];
    if (attributes && !Array.isArray(attributes) && typeof attributes === 'object') {
      if (attributes['data-bd-block-id'] === id || attributes['data-bd-placeholder-id'] === id) return true;
    }
    return Object.values(value).some((child) => contains(child, id));
  };
  for (const block of blocks) {
    if (contains(children, block.instanceId)) continue;
    children.push({ type: 'default', tagName: 'div', attributes: { 'data-bd-placeholder-id': block.instanceId, 'data-bd-placeholder-definition': key(block.definitionRef) }, components: [] });
  }
  container['components'] = children;
  return projectData;
}

function findJsonComponent(value: JsonValue, attribute: string, expected: string): Record<string, JsonValue> | null {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findJsonComponent(item, attribute, expected); if (found) return found; }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const attributes = value['attributes'];
  if (attributes && !Array.isArray(attributes) && typeof attributes === 'object' && attributes[attribute] === expected) return value as Record<string, JsonValue>;
  for (const child of Object.values(value)) { const found = findJsonComponent(child, attribute, expected); if (found) return found; }
  return null;
}

function expandPlaceholders(projectData: Record<string, JsonValue>, blocks: BlockInstance[], definitions: Map<string, BlockDefinitionVersion>): Record<string, JsonValue> {
  const blockMap = new Map(blocks.map((block) => [block.instanceId, block]));
  const expand = (value: JsonValue): JsonValue | JsonValue[] => {
    if (Array.isArray(value)) return value.flatMap((item) => {
      const result = expand(item);
      return Array.isArray(result) ? result : [result];
    });
    if (!value || typeof value !== 'object') return value;
    const attributes = value['attributes'];
    if (attributes && !Array.isArray(attributes) && typeof attributes === 'object') {
      const id = attributes['data-bd-placeholder-id'];
      if (typeof id === 'string') {
        const block = blockMap.get(id);
        if (block) {
          const definition = definitions.get(key(block.definitionRef));
          if (definition) return markupToComponent(renderBlockMarkup(block, definition));
        }
        return { type: 'default', tagName: 'section', attributes: { class: 'bd-placeholder', 'data-bd-missing-block': id }, components: [{ type: 'textnode', content: 'Blok sürümü bulunamadı.' }] };
      }
    }
    const entries: Array<[string, JsonValue]> = [];
    for (const [name, child] of Object.entries(value)) {
      const result = expand(child);
      entries.push([name, (Array.isArray(result) ? result : result) as JsonValue]);
    }
    return Object.fromEntries(entries) as JsonValue;
  };
  const result=expand(projectData) as Record<string,JsonValue>;restoreSvgTypes(result);return result;
}

function markupToComponent(markup: string): JsonValue {
  const template = document.createElement('template');
  template.innerHTML = markup;
  const toComponent = (element: Element): JsonValue => ({
    type: element.namespaceURI === 'http://www.w3.org/2000/svg' ? element.localName === 'svg' ? 'svg' : 'svg-in' : 'default',
    tagName: element.tagName.toLowerCase(),
    attributes: Object.fromEntries([...element.attributes].map((attribute) => [attribute.name, attribute.value])),
    components: [...element.childNodes].flatMap((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return [{ type: 'textnode', content: node.textContent } as JsonValue];
      if (node instanceof Element) return [toComponent(node)];
      return [];
    }),
  });
  return toComponent(template.content.firstElementChild ?? document.createElement('section'));
}

/** GrapesJS needs its SVG view to create nodes in the SVG namespace. */
function restoreSvgTypes(value:JsonValue,inSvg=false):void{
  if(Array.isArray(value)){value.forEach(child=>restoreSvgTypes(child,inSvg));return;}if(!value||typeof value!=='object')return;
  const svg=value.tagName==='svg';if(typeof value.tagName==='string'&&(svg||inSvg))value.type=svg?'svg':'svg-in';
  for(const [key,child]of Object.entries(value))restoreSvgTypes(child,key==='components'?(svg||inSvg):false);
}

function findByAttribute(editor: Editor, name: string, value: string): Component | undefined {
  return editor.getWrapper()?.find(`[${name}="${cssEscape(value)}"]`).find((component) => component.getAttributes()[name] === value);
}

function safeStylesheetUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

function parseRef(value: string): VersionRef | null {
  const separator = value.lastIndexOf('@');
  return separator < 1 ? null : { id: value.slice(0, separator), version: value.slice(separator + 1) };
}

function key(ref: VersionRef | null): string {
  return ref ? `${ref.id}@${ref.version}` : '';
}

function clone<T extends JsonValue>(value: T): T {
  return structuredClone(value);
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
