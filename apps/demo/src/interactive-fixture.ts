import type { BlockDefinitionVersion } from "@blockdesign/contracts";
export const definition: BlockDefinitionVersion = {
  ref: { id: "fixture.live-cards", version: "1.0.0" },
  designSystemRef: { id: "system.studio-neutral", version: "1.0.0" },
  name: "Canlı kartlar",
  description: "CMS liste örneği",
  category: "İçerik",
  preview: "custom",
  componentTemplate: {
    tagName: "section",
    attributes: { "data-bd-node": "root" },
    components: [
      {
        tagName: "div",
        attributes: { "data-bd-node": "items" },
        components: [
          {
            tagName: "article",
            attributes: { "data-bd-node": "item" },
            components: [
              {
                tagName: "h3",
                attributes: { "data-bd-node": "title" },
                components: ["Başlık"],
              },
              {
                tagName: "p",
                attributes: { "data-bd-node": "body" },
                components: ["Özet"],
              },
              {
                tagName: "a",
                attributes: { "data-bd-node": "url", href: "/" },
                components: ["İncele"],
              },
            ],
          },
        ],
      },
    ],
  },
  fields: [],
  repeaters: [
    {
      repeaterId: "cards.items",
      key: "items",
      label: "Kartlar",
      minItems: 0,
      maxItems: 50,
      nesting: "none",
      mappingTarget: {
        containerNodeId: "items",
        itemNodeId: "item",
        replaceChildren: true,
      },
      itemFields: [
        {
          fieldId: "title",
          key: "title",
          label: "Başlık",
          type: "text",
          required: true,
          defaultValue: "Başlık",
          mappingTarget: { nodeId: "title", operation: "text" },
        },
        {
          fieldId: "body",
          key: "body",
          label: "Özet",
          type: "textarea",
          required: false,
          defaultValue: "Özet",
          mappingTarget: { nodeId: "body", operation: "text" },
        },
        {
          fieldId: "url",
          key: "url",
          label: "Bağlantı",
          type: "url",
          required: false,
          defaultValue: "/",
          mappingTarget: {
            nodeId: "url",
            operation: "attribute",
            property: "href",
          },
        },
      ],
    },
  ],
  defaultData: { items: [] },
  stylePolicy: { allowedProperties: [], structuralEdits: false },
  sourceCapabilities: { modes: ["manual", "query"], target: ["repeater"] },
  archived: false,
};
