# Architecture: BlockDesign

## Technology Stack

| Category | Details |
|---|---|
| Languages | TypeScript, Vue SFC, Go 1.27.2, SQL; Python maintenance scripts; PHP integration examples |
| Frameworks | Vue 3, Vite 8, GrapesJS open source core; Go net/http |
| Databases | SQLite via modernc.org/sqlite in the reference application; host CMS owns production records |
| Auth mechanism | Host-supplied adapters and per-request headers; Laravel example supplies session/CSRF. Local reference API has no user authentication and defaults to loopback. |
| Infrastructure | Local Vite proxy /api → Go on 127.0.0.1:8080; ESM and IIFE SDK builds |
| External services | None required. Demo image records reference Unsplash; imported site assets are local. |

## Architecture Overview

Contracts define documents, versioned blocks/regions/templates, content providers and form providers/actions. Core resolves record selections, menu groups, queries and field mappings into temporary copies. The bridge renders these copies into a GrapesJS iframe. The Vue shell manages editing and static export. Storage and content adapters belong to the host. The Go server is a reference host backed by SQLite; it is not an authentication boundary for a deployed CMS.

## Data Flow

1. Host loads a document and its pinned block, region and template versions through adapters.
2. Saved bindings identify a registered provider, collection and record/group IDs. They do not contain arbitrary data endpoint URLs or credentials.
3. A ContentProviderAdapter resolves CMS-owned database records. The local reference uses an HTTP bridge inside the same application; a host can inject its own implementation and retain direct database access on its backend.
4. Resolved content is applied to an ephemeral document. Manual drafts remain stored separately. Publication resolves the same sources before exporting.
5. CMS form definitions control fields and rules. Visitor values live in the form runtime; preview does not submit. Production actions use the host action adapter.

The reference host's `cms_menus` table stores menu IDs, locale, labels and serialized record arrays. `MenuRepository` supplies these to the content provider's group selection contract. Header/footer region versions store only the group IDs and field mappings; runtime behavior supplies interaction without injecting menu records. Current form definitions and blog content remain explicitly local examples, separate from these database menus.

## Entry Points

| Entry Point | Type | Auth Required | Description |
|---|---|---|---|
| mountEditor / renderPageDocument | SDK | Host-owned | Trusted host configuration, providers and behavior plugins |
| /api/v1/documents, /blocks, /templates, /shared-regions | HTTP | None in local reference | Revision-checked documents and versioned design records |
| /api/v1/content/collections/* | HTTP | None in local reference | Host content adapter transport, groups, selections and queries |
| /api/v1/assets | HTTP | None in local reference | Image search, upload and content |
| Imported HTML/CSS | Editor input | Host-controlled feature | Sanitized author markup; imported scripts are not executed |
| Form publication endpoints | Host HTTP | Host-owned | Not implemented as a production service by the reference Go application |

## Trust Boundaries

- Host CMS session/tenant/permissions → adapters: host authorizes all database reads and writes; client capabilities only control UI.
- Stored HTML and provider values → rendered HTML: field types, URL checks, schema validation and HTML import sanitation apply.
- Trusted registered behavior plugins → iframe/export: plugins execute code, unlike imported author scripts.
- Editor draft → visitor input: form values must not enter document snapshots or browser draft persistence.
- Browser → reference HTTP → repository: local-only development transport, not a replacement for CMS authorization.

## Sensitive Data Inventory

| Data Type | Where Stored | How Accessed | Protection |
|---|---|---|---|
| Page drafts and design records | Host storage / demo SQLite / explicit demo browser cache | Storage/catalog adapters | Revision checks; production authorization belongs to host |
| CMS record and menu identifiers | Bindings in documents/regions | Registered content provider | Fixed provider/collection/group identifiers |
| Host authentication headers | Host callbacks | Per-request adapter code | Not serialized into documents or exports |
| Visitor form data | Runtime closure and controls; host action on real submission | Form action adapter | Preview isolation; production validation/retention belongs to host |
