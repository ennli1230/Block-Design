# BlockDesign

BlockDesign is an embeddable visual editor for building reusable, editable page blocks from HTML/CSS. It is an independent project: the editor does not depend on a CMS, a Go backend, or a particular database. The reference Go server demonstrates document storage, revision checks, versioned blocks, page templates and shared regions, reference-checked block deletion, and read-only demo content.

The original product request is preserved in [docs/ISTEK.md](docs/ISTEK.md); the architecture, contracts, phase plan, and honest implementation status are in [docs/PLAN.md](docs/PLAN.md) and [docs/SOZLESMELER.md](docs/SOZLESMELER.md).

## Run the demo

Requirements: Node.js `>=20.19`, npm, and Go `1.27.2`.

```sh
npm install
npm run api
```

In another terminal, run `npm run dev`. The editor opens at `http://127.0.0.1:4173`; the reference API listens on `http://127.0.0.1:8080`. Use `?new=1` to open a fresh document or `?sample=faq` to load the FAQ example. Vite proxies `/api` to the local server. Demo storage/library adapters can retain browser-local drafts when the API is unavailable. The active CMS content provider reports source errors without silently switching menu data to demo records. The SQLite database is created at `server/blockdesign.db`; `BLOCKDESIGN_DB` and `BLOCKDESIGN_ADDR` are documented in [.env.example](.env.example). The Go process does not load `.env` automatically; set variables in the terminal before `npm run api` when you need non-default values. For example, in PowerShell set `$env:BLOCKDESIGN_DB = 'blockdesign.db'` and `$env:BLOCKDESIGN_ADDR = '127.0.0.1:8080'`.

Useful checks:

```sh
npm run typecheck
npm test
npm run build:all
npm run measure:bundle
npm run test:all
```

`npm run test:all` runs the TypeScript suites and Go repository/API tests. Go `1.27.2` is pinned in `server/go.mod`; the reference server and SQLite tests have been built and run with that toolchain. The browser acceptance flow also saves a document through the Go API and reloads it at revision 1.

## Embed without Vue

`npm run build:vanilla` creates a self-contained IIFE editor runtime and stylesheet. A host page can use the classic `<script>` and `<link>` tags in [examples/vanilla/index.html](examples/vanilla/index.html); it does not need to adopt Vue.

`npm run build:esm` creates a split ESM editor entry/runtime and stylesheet for bundler-based integrations. [examples/esm/index.html](examples/esm/index.html) shows a direct browser integration, and [examples/esm/lifecycle.html](examples/esm/lifecycle.html) verifies independent mounts and cleanup. `npm run build:all` creates the demo, ESM, and IIFE outputs. `npm run measure:bundle` reports raw and gzip sizes and enforces total and per-chunk budgets for the demo and ESM runtimes, plus budgets for the ESM entry, vanilla runtime, and stylesheets.

```js
const editor = BlockDesign.mountEditor(document.querySelector('#editor'), {
  initialDocument,
  storageAdapter,
  blockLibraryAdapter,
  contentProviders: [provider],
  assetAdapter,
  localization: {
    uiLocale: 'tr',
    defaultLocale: 'tr',
    locales: [{ code: 'tr', label: 'Türkçe', direction: 'ltr' }],
    fallback: { mode: 'none' },
  },
  mode: 'content',
  onChange: ({ document, reason }) => console.debug(reason, document),
  onSave: (result) => console.info('Saved', result.revision),
  onError: (error) => console.error(error),
});

await editor.ready;
await editor.destroy(); // when the host page is disposed
```

Integrators may pass trusted `behaviorPlugins` for their own interactive HTML structures. Each plugin declares a stable id and selector, mounts per matching canvas element, updates when preview is re-entered, cleans up on preview exit/destroy, and can supply CSS plus a standalone JS dependency for static export. The built-in slider uses the same hook contract. Imported author scripts are still removed and never executed.

The TypeScript contracts and capability rules are described in [docs/SOZLESMELER.md](docs/SOZLESMELER.md). HTTP adapters accept a base URL, injected `fetch`, and per-request headers so an integrating app can provide its own authentication. Credentials are not written into an editor document. Custom adapters do not have to use the reference API's routes.

Multilingual pages use the separate `localization` option and `EditorDocument.localization` metadata. The host keeps ownership of translation records, page URLs, publication, and locale-specific identifiers; reusable REST, translations-object, and locale-ID adapters are exported from `@blockdesign/editor`. See the [multilingual integration guide](docs/COKLU-DIL-ENTEGRASYONU.md), [vanilla example](examples/vanilla/multilingual.html), and [Laravel example](examples/laravel/editor.ts).

## Architecture

- `packages/contracts`: framework- and backend-independent TypeScript interfaces.
- `packages/core`: document envelopes, validation, canonical block data, repeaters, history, templates, and source resolution.
- `packages/grapesjs-bridge`: open-source GrapesJS core integration, canvas iframe, safe HTML/CSS import, component rendering, and registered preview behaviors.
- `packages/editor`: Vue 3 workbench and public `mountEditor` entry point.
- `packages/adapters`: reference HTTP adapters, browser-local adapters, and deterministic demo content.
- `server/internal/httpapi`: reference Go HTTP handlers.
- `server/internal/application`: document and demo-provider use cases.
- `server/internal/repository`: repository interface, SQLite implementation, and migrations.
- `examples/vanilla`: classic HTML integration sample.
- `docs/openapi.yaml`: reference API contract.

## Working flows

CMS-driven visitor forms use a single reusable form block with versioned schema bindings. Providers own fields, required rules and options; the runtime handles dependent options, validation and submission state without storing visitor input in editor documents. See the [CMS forms guide](docs/CMS-FORM-ENTEGRASYONU.md) and the [Laravel/Filament example](examples/laravel/forms/README.md). The local demo fetches seven versioned Turkish JSON fixtures and simulates preview submissions.

Header and footer menus bind to CMS record IDs through the existing content provider contract. The reference host reads four menus from SQLite; the browser does not configure external menu API URLs. Header and hamburger share one menu, and submenus come from its child records. See the [menu integration guide](docs/CMS-MENU-ENTEGRASYONU.md) and [local readiness report](docs/audits/CMS-HAZIRLIK-KONTROLU.md).

The current browser implementation supports the three-panel editor, designer/content modes, FAQ/banner/cards/slider blocks, repeater and field mapping, block-level and more-specific source bindings, block archive/upgrade and reference-checked deletion, page-template selection with editable allowed/mandatory policies, versioned header/footer editing and archive, and schema-diff/migration preview. HTML/CSS import uses a PostCSS-based report. Demo providers cover FAQ, cards, and slider records and groups. The reference Go API includes revision-checked document/template/region/design-system manifest storage and image search/upload/resolve. Static HTML export packages same-origin or CORS-readable supported images, fonts, and stylesheet references into data URLs within size limits, and reports missing alt text, unsupported imports, and resources that cannot be packaged. FAQ uses native `details`/`summary`; registered behaviors mount per instance and export only when their selector appears in the page. Preview and export resolve provider-backed data through the same core resolver while preserving manual data in the saved document.

Scalar block fields can also bind to one provider record or a one-result query; provider data stays ephemeral while the manual field value remains saved. The [custom backend adapter example](examples/custom-backend/adapter.ts) maps different `/v2/editor/...` routes and obtains an optional bearer token for each request through a callback.

`npm run typecheck`, `npm test`, `npm run build:all`, `npm run measure:bundle`, and `npm run test:all` are the verification commands. The suites exercise repeater identity and ordering, source resolution and manual-data preservation, adapter fallback, template/archive behavior, CSS scoping/import safety, assets, Go transactions, API routes, and migrations.

## Supported boundaries

Explicit nested repeater schemas support up to eight levels, with child lists mapped separately to HTML containers and source array fields. Atomic menu, language and accordion widgets compose with independent sections and headings. Imported author JavaScript is never run; custom runtime behavior must come from a trusted registered plugin. Asset packaging requires a supported MIME type and a same-origin or CORS-readable response; CORS failures and CSS `@import` are reported, while external URLs may remain linked for a partial export. The responsive demo supports widths from 320 CSS pixels; only the Codex In-app Browser has been verified so far. The project uses the `@blockdesign/*` workspace namespace and targets `@blockdesign/editor` for a future public package; the root workspace remains private. See [docs/PLAN.md](docs/PLAN.md) for scope and acceptance evidence.

## License and third-party software

The project is distributed under the MIT License; see [LICENSE](LICENSE). GrapesJS core is used; GrapesJS Studio SDK is not used. Direct and installed npm notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The pinned Go SQLite driver license and its complete upstream transitive notice are included under [server/licenses/modernc-sqlite](server/licenses/modernc-sqlite/).

## Interactive CMS frontend

Live cursor lists, visitor filters and host page/route context share the provider contract. Tabs, native dialogs and galleries use the trusted behavior registry in preview and static HTML. See [live lists and widgets](docs/CANLI-LISTE-VE-BILESENLER.md), [permission contract](docs/CMS-YETKI-SOZLESMESI.md) and the local [interactive examples](http://127.0.0.1:4173/interactive-examples.html). Autosave/recovery, optional revision history, metadata, publication checks and extension field editors are host-configurable. Actual CMS connection and role-package installation are deliberately deferred.
