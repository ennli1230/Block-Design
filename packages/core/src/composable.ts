import type {
  BlockDefinitionVersion,
  FieldDefinition,
  JsonValue,
  RepeaterDefinition,
} from "@blockdesign/contracts";
import { interactiveWidgets } from './interactive-widgets.ts';
const DESIGN_SYSTEM = { id: "system.studio-neutral", version: "1.0.0" };

const node = (
  tagName: string,
  id: string,
  components: JsonValue[] = [],
  attrs: Record<string, JsonValue> = {},
): JsonValue => ({
  type: "default",
  tagName,
  attributes: { "data-bd-node": id, ...attrs },
  components,
});
const field = (
  key: string,
  label: string,
  id: string,
  type: FieldDefinition["type"] = "text",
  property?: string,
): FieldDefinition => ({
  fieldId: `${id}.${key}`,
  key,
  label,
  type,
  required: false,
  defaultValue: "",
  mappingTarget: {
    nodeId: id,
    operation: property ? "attribute" : "text",
    ...(property ? { property } : {}),
  },
});
const widget = (
  id: string,
  name: string,
  description: string,
  template: JsonValue,
  repeaters: RepeaterDefinition[],
  data: Record<string, JsonValue>,
  fields: FieldDefinition[] = [],
): BlockDefinitionVersion => ({
  ref: { id: `blockdesign.${id}`, version: "1.0.0" },
  designSystemRef: DESIGN_SYSTEM,
  name,
  description,
  category: "Bileşenler",
  preview: "custom",
  componentTemplate: template,
  fields,
  repeaters,
  defaultData: data,
  stylePolicy: {
    allowedProperties: [
      "color",
      "background-color",
      "background-image",
      "font-size",
      "font-weight",
      "text-align",
      "padding",
      "margin",
      "border-radius",
      "border",
      "width",
      "max-width",
      "min-height",
      "gap",
    ],
    structuralEdits: false,
  },
  sourceCapabilities: {
    modes: ["manual", "selection", "query"],
    target: ["block", "field", "repeater"],
  },
  archived: false,
});

export const accordionWidget = widget(
  "accordion",
  "Akordiyon",
  "Yalnızca soru ve yanıt listesi; başlık ve bölümünü ayrı kur.",
  node(
    "div",
    "accordion-root",
    [
      node(
        "details",
        "accordion-item",
        [
          node("summary", "accordion-question", ["Yeni soru"]),
          node("div", "accordion-answer", ["Yanıtınızı yazın."]),
        ],
        { class: "bd-custom-accordion-item" },
      ),
    ],
    { class: "bd-custom-accordion" },
  ),
  [
    {
      repeaterId: "accordion.items",
      key: "items",
      label: "Sorular",
      minItems: 0,
      maxItems: 100,
      nesting: "none",
      mappingTarget: {
        containerNodeId: "accordion-root",
        itemNodeId: "accordion-item",
      },
      itemFields: [
        field("question", "Soru", "accordion-question"),
        field("answer", "Yanıt", "accordion-answer", "textarea"),
      ],
    },
  ],
  {
    items: [
      {
        __id: "accordion-seed",
        question: "Yeni soru",
        answer: "Yanıtınızı yazın.",
      },
    ],
  },
);

const submenu: RepeaterDefinition = {
  repeaterId: "menu.children",
  key: "children",
  label: "Alt menü",
  minItems: 0,
  maxItems: 100,
  nesting: "none",
  mappingTarget: { containerNodeId: "menu-children", itemNodeId: "menu-child" },
  itemFields: [
    field("label", "Menü adı", "menu-child-link"),
    field("url", "Bağlantı", "menu-child-link", "url", "href"),
  ],
};
const menuLayout = field(
  "layout",
  "Menü görünümü",
  "menu-root",
  "select",
  "data-bd-layout",
);
menuLayout.defaultValue = "horizontal";
menuLayout.options = [
  { label: "Yatay menü", value: "horizontal" },
  { label: "Açılır menü", value: "dropdown" },
  { label: "Hamburger menü", value: "drawer" },
];
export const menuWidget = widget(
  "menu",
  "Menü",
  "Ana ve alt menü öğelerini ayrı tasarımlara ve kaynaklara bağla.",
  node(
    "nav",
    "menu-root",
    [
      node(
        "details",
        "menu-shell",
        [
          node("summary", "menu-label", ["Menü"]),
          node("ul", "menu-list", [
            node("li", "menu-item", [
              node("a", "menu-link", ["Menü öğesi"], { href: "/" }),
              node("details", "menu-submenu", [
                node("summary", "menu-toggle", ["Alt menü"], {
                  "aria-label": "Alt menüyü aç",
                }),
                node("ul", "menu-children", [
                  node("li", "menu-child", [
                    node("a", "menu-child-link", ["Alt sayfa"], { href: "/" }),
                  ]),
                ]),
              ]),
            ]),
          ]),
        ],
        { open: true },
      ),
    ],
    {
      class: "bd-managed-menu",
      "data-bd-layout": "horizontal",
      "aria-label": "Gezinme",
    },
  ),
  [
    {
      repeaterId: "menu.items",
      key: "items",
      label: "Menü öğeleri",
      minItems: 0,
      maxItems: 100,
      nesting: "children",
      mappingTarget: { containerNodeId: "menu-list", itemNodeId: "menu-item" },
      itemFields: [
        field("label", "Menü adı", "menu-link"),
        field("url", "Bağlantı", "menu-link", "url", "href"),
      ],
      childRepeaters: [submenu],
    },
  ],
  {
    layout: "horizontal",
    items: [
      { __id: "menu-seed", label: "Ana sayfa", url: "/", children: [] },
      {
        __id: "menu-seed-2",
        label: "Hakkımızda",
        url: "/hakkimizda",
        children: [
          { __id: "menu-child-seed", label: "Ekibimiz", url: "/ekibimiz" },
        ],
      },
    ],
  },
  [menuLayout],
);

export const languageWidget = widget(
  "languages",
  "Dil seçici",
  "Dil adlarını, ikonlarını ve sayfa adreslerini yönet.",
  node(
    "nav",
    "language-root",
    [
      node("details", "language-shell", [
        node("summary", "language-title", ["Dil"]),
        node("ul", "language-list", [
          node("li", "language-item", [
            node(
              "a",
              "language-link",
              [
                node("img", "language-icon", [], { src: "", alt: "" }),
                node("span", "language-name", ["Türkçe"]),
              ],
              { href: "/" },
            ),
          ]),
        ]),
      ]),
    ],
    { class: "bd-language-picker", "aria-label": "Dil seçimi" },
  ),
  [
    {
      repeaterId: "languages.items",
      key: "items",
      label: "Diller",
      minItems: 1,
      maxItems: 50,
      nesting: "none",
      mappingTarget: {
        containerNodeId: "language-list",
        itemNodeId: "language-item",
      },
      itemFields: [
        field("label", "Dil adı", "language-name"),
        field("url", "Dil sayfası", "language-link", "url", "href"),
        field("icon", "Dil ikonu", "language-icon", "image", "src"),
        field("alt", "İkon açıklaması", "language-icon", "text", "alt"),
      ],
    },
  ],
  {
    items: [
      { __id: "language-tr", label: "Türkçe", url: "/", icon: "", alt: "" },
      { __id: "language-en", label: "English", url: "/en", icon: "", alt: "" },
    ],
  },
);

export const composableDefinitions = [
  ...interactiveWidgets,
  accordionWidget,
  menuWidget,
  languageWidget,
];

export const COMPOSABLE_CSS = `
.bd-custom-accordion { width:100%; }
.bd-custom-accordion-item { border-bottom:1px solid #dfe5dd; padding:12px 0; }
.bd-custom-accordion-item summary { cursor:pointer; font-weight:600; }
.bd-custom-accordion-item > div { padding:12px 0; }
.bd-managed-menu ul,.bd-language-picker ul { list-style:none; padding:0; margin:0; }
.bd-managed-menu a,.bd-language-picker a { color:inherit; text-decoration:none; display:inline-flex; gap:8px; align-items:center; padding:8px; }
.bd-managed-menu summary,.bd-language-picker summary { cursor:pointer; padding:8px; }
.bd-managed-menu[data-bd-layout="horizontal"] > details { display:contents; }
.bd-managed-menu[data-bd-layout="horizontal"] > details > summary { display:none; }
.bd-managed-menu[data-bd-layout="horizontal"] > details > ul { display:flex; gap:16px; }
.bd-managed-menu li > details:not(:has(li)) { display:none; }
.bd-managed-menu li > details { margin-left:8px; }
.bd-managed-menu[data-bd-layout="drawer"] > details[open] > ul { padding:16px; background:#f5f7f4; }
.bd-language-picker img { width:20px; height:16px; object-fit:contain; }
.bd-language-picker img[src=""] { display:none; }
.bd-language-picker > details[open] > ul { padding:8px; border:1px solid #dfe5dd; }
`;

export const SECTION_VARIANT_CSS =
  ".bd-section-surface{background:#f3f5f2;padding:32px}.bd-section-contrast{background:#243a30;color:#fff;padding:32px}.bd-section-contrast :is(h1,h2,h3,p){color:inherit}";

export const AUTHORING_HINT_CSS =
  'html[data-bd-mode=designer] [data-bd-container=true]:empty{min-height:70px;border:1px dashed #ced9ce}html[data-bd-mode=designer] [data-bd-container=true]:empty::after{content:"Buraya öğe ekle";display:block;padding:20px;color:#647365;font-size:12px;pointer-events:none}';
