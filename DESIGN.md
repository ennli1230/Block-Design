# BlockDesign visual system

## Surface and purpose

The editor is an Operate surface. It should help a designer compose a block or let a content editor update fields without losing the page context. The user chose a three-panel studio workbench with the page canvas in the center.

## Composition

- A compact top bar carries the document, undo/redo, design/content mode, preview, and save state.
- The left panel switches between the block library and page layers.
- The center panel is the working page inside a GrapesJS canvas iframe, with device width controls and an export action.
- The right inspector shows fields and repeater controls for the current selection.
- In preview, the canvas presents the page without editing overlays and native accordion controls work.

## Visual language

- Quiet, warm-white page surface against a light neutral workbench; thin gray-green dividers separate tools.
- Forest green is reserved for primary actions, selected states, focus, and successful save feedback.
- The product UI uses compact Segoe UI/system sans typography. The canvas content can use its own design-system typography.
- Controls use modest radii and restrained borders. Keep action buttons and input affordances consistent across panels.
- Canvas CSS is scoped to the iframe; editor UI styles stay under `.blockdesign-root`.

Current tokens live in `packages/editor/src/style.css`; initial canvas styles live in `packages/grapesjs-bridge/src/index.ts`. This document records the implemented prototype, not a claim that responsive and accessibility review is complete.

## Content and interaction

- The FAQ example uses a two-column editorial composition, an eyebrow, title, description, and native `details`/`summary` rows.
- Editing clicks select components and populate the inspector. Preview clicks reach native page interactions without selecting editor components.
- Block content uses the document's canonical data; the GrapesJS canvas is its visual representation.
- Save feedback reflects adapter status. Without the reference API, the demo identifies its browser-local draft mode.

## Block and region authoring

The authoring inspector uses four task tabs: Alanlar, Listeler, Tasarım, Ayarlar. The canvas picker remains above the tabs, and save/cancel remain below the scrolling content. Tabs support arrow keys, Home, and End; switching tabs preserves unfinished forms.

Field name and type are the main controls. Images, links, and videos suggest their corresponding types; data keys and HTML attributes sit under advanced settings. Repeater creation has a separate tab, with nesting shown only when lists exist and limits behind advanced settings. Catalog metadata and source connections live in Ayarlar. Style permissions and interactions are advanced options; the style editor groups surface, layout, and text controls into disclosures.

Selecting a card or a field inside it offers a repeater shortcut. It finds the enclosing collection, previews the item and field counts, and preserves all existing matching cards as separate data rows. Unmapped leaf text, image, alt, and link fields are included automatically; section headings stay outside the list. Containers with mixed structures are rejected before changing the schema.

Saved blocks expose their name in Ayarlar and through the inspector's edit icon. Saving settings creates a new catalog version; in the block workspace it also captures the manual defaults and source bindings for later insertion into pages. Provider-backed content is resolved into a temporary canvas projection after record, mapping, or query changes. The inspector shows the same resolved values, while the canonical manual draft remains intact. Delayed responses are discarded when a newer selection supersedes them; source failures display their error and retain manual content.

This flow was checked in the in-app browser at the default desktop width and 375px: field mapping, moving a field into a new repeater, tab state, keyboard navigation, and the fixed save area. The browser test draft was discarded.

## Current constraints

The three-panel workbench is the approved initial composition. The only viewport inspected interactively so far is the Codex in-app browser. Mobile layout, full keyboard coverage, contrast measurements, import styling, and persistent Go-backed operation still need their planned verification.

## CMS form examples

The `?view=forms` screen extends the existing Operate workspace with Manrope typography, forest-green actions, neutral surfaces, and a bordered white preview. A labeled selector loads seven public JSON form schemas at version `1.1.0`; source version and field count sit above the preview, alongside a public JSON link. A native disclosure below the form exposes its JSON definition. The preview renders native form controls and explicitly states that entered values are neither sent nor saved. **Sayfada düzenle** opens the existing page matching the selected example; a missing page produces an import instruction.

Two-column form definitions use two columns on desktop and one at widths of 600px or less; the selector and edit action stack at 640px or less. Text inputs, selects, and primary actions have a minimum height of 44px. Zero-minimum grid tracks and shrinkable fields keep the form within the narrow mobile content area. The preview uses restrained borders and modest radii consistent with the workspace.

Review disposition: **ship, with no material fixes** after inspecting the desktop and mobile top/bottom screenshots in `.impeccable/review/forms-desktop.png`, `forms-desktop-bottom.png`, `forms-mobile.png`, and `forms-mobile-bottom.png`. This evidence covers the visible transfer example layout, controls, preview notice, and JSON disclosure; it does not establish a complete accessibility review.

## CMS navigation source selection

Header and footer source selection stays within the existing region authoring inspector: Ayarlar → Veri kaynağı → field/list → collection → record group. The selected menu ID is visible alongside its CMS label; no API address input is introduced. Header and hamburger use the same menu records at different responsive widths. Nested links are rendered from the CMS child list, with behavior code managing expanded state, ARIA controls and Escape. The inspector evidence is `exports/cms-menu-id4-inspector.png`; browser acceptance covers the independent HTML output with a 390px frame. This records functional checks, not a complete visual or accessibility certification.
