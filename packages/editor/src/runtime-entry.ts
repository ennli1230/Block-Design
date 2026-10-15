/** Optional interactive frontend APIs; keep the editor bootstrap small. */
export {
  mountCollection,
  loadCollectionPage,
  contextualQuery,
  mountInteractive,
  tabsWidget,
  modalWidget,
  galleryWidget,
} from "@blockdesign/core";
export {
  createCollectionBehavior,
  collectionExport,
  COLLECTION_CSS,
} from "./collections";
export type {
  CollectionRuntimeConfig,
  CollectionRuntimeServices,
} from "@blockdesign/core";
export { assessPublication, assertPublishable } from "./publication";
export { createPageHead } from "./page-metadata";
export type { PageMetadata } from "./page-metadata";
export type { EditorExtension, FieldEditorPlugin } from "./extensions";
