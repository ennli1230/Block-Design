import {
  makeInstance,
  mountCollection,
  loadCollectionPage,
  tabsWidget,
  modalWidget,
  galleryWidget,
  mountInteractive,
} from "@blockdesign/core";
import {
  renderBlockMarkup,
  behaviorExportDependencies,
} from "@blockdesign/grapesjs-bridge";
import { COLLECTION_CSS } from "@blockdesign/editor/runtime";
import type { SourceBinding } from "@blockdesign/contracts";
import { ScalanovaTourContentProvider } from "./scalanova-tour-content-provider";
import { definition } from "./interactive-fixture";
const provider = new ScalanovaTourContentProvider();
const binding: SourceBinding = {
  bindingId: "blog-examples",
  mode: "query",
  target: { scope: "repeater", id: "cards.items" },
  providerId: provider.providerId,
  collectionId: "scalanova-blog-posts",
  schemaVersion: "1",
  recordRefs: [],
  groupRef: null,
  query: {
    filters: [],
    sort: { fieldId: "title", direction: "asc" },
    limit: 1,
  },
  fieldMappings: [
    { from: "title", to: "title" },
    { from: "body", to: "body" },
    { from: "url", to: "url" },
  ],
  live: {
    filters: [{ fieldId: "category", label: "Kategori", operator: "eq" }],
    syncUrl: true,
  },
};
const block = makeInstance(definition);
block.sourceBindings = [binding];
const listing = document.querySelector<HTMLElement>("#listing")!;
listing.innerHTML = renderBlockMarkup(block, definition);
const root = listing.firstElementChild as HTMLElement;
const config = JSON.parse(root.getAttribute("data-bd-collection")!)[0];
const stops = [
  mountCollection(root, config, {
    load: (values, cursor, signal) =>
      loadCollectionPage([provider], binding, values, cursor, {
        signal,
        page: { route: { section: "blog" }, preview: true },
        contentLocale: { locale: "tr", fallback: { mode: "none" } },
      }),
  }),
];
const widgets = document.querySelector<HTMLElement>("#widgets")!;
for (const definition of [tabsWidget, modalWidget, galleryWidget]) {
  const block = makeInstance(definition);
  if (definition === galleryWidget)
    block.manualData.items = [
      {
        __id: "priene",
        image: "/scalanova-tour/assets/images/priene.jpg",
        alt: "Priene antik kenti",
      },
      {
        __id: "kusadasi",
        image: "/scalanova-tour/assets/images/kusadasi-coast.jpg",
        alt: "Kuşadası kıyısı",
      },
    ];
  const host = document.createElement("div");
  host.innerHTML = renderBlockMarkup(block, definition);
  widgets.append(host);
  stops.push(mountInteractive(host.firstElementChild as HTMLElement));
}
const style = document.createElement("style");
style.textContent =
  COLLECTION_CSS + "\n" + behaviorExportDependencies([], widgets.innerHTML).css;
document.head.append(style);
window.addEventListener("pagehide", () => stops.forEach((stop) => stop()), {
  once: true,
});
