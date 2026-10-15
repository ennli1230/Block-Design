import type {
  BlockDefinitionVersion,
  JsonValue,
} from "../../contracts/src/index.ts";
const node = (
  tagName: string,
  id: string,
  components: JsonValue[] = [],
  attributes: Record<string, JsonValue> = {},
): JsonValue => ({
  tagName,
  attributes: { "data-bd-node": id, ...attributes },
  components,
});
const make = (
  id: string,
  name: string,
  template: JsonValue,
  fields: BlockDefinitionVersion["fields"],
  defaultData: BlockDefinitionVersion["defaultData"],
): BlockDefinitionVersion => ({
  ref: { id: "blockdesign." + id, version: "1.0.0" },
  designSystemRef: { id: "system.studio-neutral", version: "1.0.0" },
  name,
  description: name,
  category: "Bileşenler",
  preview: "custom",
  componentTemplate: template,
  fields,
  repeaters: [],
  defaultData,
  stylePolicy: {
    allowedProperties: ["color", "background-color", "padding", "gap"],
    structuralEdits: false,
  },
  sourceCapabilities: {
    modes: ["manual", "selection", "query"],
    target: ["field"],
  },
  archived: false,
});
const text = (
  key: string,
  label: string,
  nodeId: string,
): BlockDefinitionVersion["fields"][number] => ({
  fieldId: nodeId + "." + key,
  key,
  label,
  type: "textarea",
  required: false,
  defaultValue: "",
  mappingTarget: { nodeId, operation: "text" },
});
export const tabsWidget = make(
  "tabs",
  "Sekmeler",
  node(
    "section",
    "tabs-root",
    [
      node(
        "div",
        "tabs-list",
        [
          node("button", "tab-a", ["Genel bilgiler"], {
            type: "button",
            "data-bd-tab": "",
          }),
          node("button", "tab-b", ["Ayrıntılar"], {
            type: "button",
            "data-bd-tab": "",
          }),
        ],
        { "data-bd-tablist": "" },
      ),
      node("div", "panel-a", ["Lorem ipsum dolor sit amet."], {
        "data-bd-tabpanel": "",
      }),
      node("div", "panel-b", ["İkinci sekmenin içeriği."], {
        "data-bd-tabpanel": "",
      }),
    ],
    { "data-bd-behavior": "tabs", class: "bd-interactive-widget" },
  ),
  [
    text("firstLabel", "İlk sekme", "tab-a"),
    text("secondLabel", "İkinci sekme", "tab-b"),
    text("firstText", "İlk içerik", "panel-a"),
    text("secondText", "İkinci içerik", "panel-b"),
  ],
  {
    firstLabel: "Genel bilgiler",
    secondLabel: "Ayrıntılar",
    firstText: "Lorem ipsum dolor sit amet.",
    secondText: "İkinci sekmenin içeriği.",
  },
);
export const modalWidget = make(
  "modal",
  "Modal pencere",
  node(
    "section",
    "modal-root",
    [
      node("button", "modal-trigger", ["Bilgiyi aç"], {
        type: "button",
        "data-bd-modal-open": "",
      }),
      node(
        "dialog",
        "modal-dialog",
        [
          node("h2", "modal-title", ["Bilgi"]),
          node("p", "modal-copy", ["Lorem ipsum dolor sit amet."]),
          node("button", "modal-close", ["Kapat"], {
            type: "button",
            "data-bd-modal-close": "",
          }),
        ],
        { "data-bd-dialog": "", "aria-label": "Bilgi" },
      ),
    ],
    { "data-bd-behavior": "modal", class: "bd-interactive-widget" },
  ),
  [
    text("button", "Düğme metni", "modal-trigger"),
    text("title", "Başlık", "modal-title"),
    text("description", "Açıklama", "modal-copy"),
  ],
  {
    button: "Bilgiyi aç",
    title: "Bilgi",
    description: "Lorem ipsum dolor sit amet.",
  },
);
export const galleryWidget: BlockDefinitionVersion = {
  ...make(
    "gallery",
    "Görsel galerisi",
    node(
      "section",
      "gallery-root",
      [
        node("div", "gallery-items", [
          node(
            "a",
            "gallery-item",
            [node("img", "gallery-image", [], { src: "", alt: "" })],
            { "data-bd-gallery-item": "", href: "#" },
          ),
        ]),
      ],
      { "data-bd-behavior": "gallery", class: "bd-interactive-widget" },
    ),
    [],
    { items: [] },
  ),
  repeaters: [
    {
      repeaterId: "gallery.items",
      key: "items",
      label: "Görseller",
      minItems: 0,
      maxItems: 100,
      nesting: "none",
      mappingTarget: {
        containerNodeId: "gallery-items",
        itemNodeId: "gallery-item",
        replaceChildren: true,
      },
      itemFields: [
        {
          ...text("image", "Görsel", "gallery-image"),
          type: "image",
          mappingTarget: {
            nodeId: "gallery-image",
            operation: "attribute",
            property: "src",
          },
        },
        {
          ...text("fullImage", "Büyük görsel", "gallery-item"),
          type: "image",
          mappingTarget: {
            nodeId: "gallery-item",
            operation: "attribute",
            property: "href",
          },
        },
        {
          ...text("alt", "Alternatif metin", "gallery-image"),
          mappingTarget: {
            nodeId: "gallery-image",
            operation: "attribute",
            property: "alt",
          },
        },
      ],
    },
  ],
  sourceCapabilities: {
    modes: ["manual", "selection", "query"],
    target: ["repeater"],
  },
};
export const interactiveWidgets = [tabsWidget, modalWidget, galleryWidget];
