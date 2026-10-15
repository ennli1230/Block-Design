import { cardsDefinition } from "@blockdesign/core/catalog";
export const definition = {
  ...structuredClone(cardsDefinition),
  ref: { id: "fixture.weekend-cards", version: "1.0.0" },
  name: "Hafta sonu rotaları",
  defaultData: {
    items: [
      {
        __id: "manual-1",
        title: "Kapadokya",
        body: "Manuel Kapadokya açıklaması",
        image: "",
        url: "/kapadokya",
      },
      {
        __id: "manual-2",
        title: "Kaçkarlar",
        body: "Manuel Kaçkarlar açıklaması",
        image: "",
        url: "/kackarlar",
      },
    ],
  },
};
const node = (tagName, id, components = [], attributes = {}) => ({
  tagName,
  attributes: { "data-bd-node": id, ...attributes },
  components,
});
definition.preview = "custom";
definition.componentTemplate = node(
  "section",
  "fixture-root",
  [
    node("h2", "fixture-heading", ["Hafta sonu rotaları"]),
    node(
      "div",
      "fixture-grid",
      [
        node(
          "article",
          "fixture-card",
          [
            node("h3", "card-title", ["Başlık"]),
            node("p", "card-body", ["Açıklama"]),
            node("img", "card-image", [], { src: "" }),
            node("a", "card-link", ["Rotayı incele"], { href: "/" }),
          ],
          { class: "fixture-card" },
        ),
      ],
      { class: "fixture-grid" },
    ),
  ],
  { class: "fixture-root" },
);
definition.repeaters[0].mappingTarget = {
  containerNodeId: "fixture-grid",
  itemNodeId: "fixture-card",
  replaceChildren: true,
};
definition.repeaters[0].itemFields.find(
  (field) => field.key === "image",
).mappingTarget.property = "src";
definition.repeaters[0].itemFields.find(
  (field) => field.key === "url",
).mappingTarget.property = "href";
definition.css =
  ".fixture-root{padding:24px}.fixture-grid{display:grid;gap:16px;grid-template-columns:repeat(2,minmax(0,1fr))}.fixture-card{padding:16px;background:#f4f5ef;border-radius:8px}.fixture-card h3{font-size:18px}.fixture-card p{font-size:14px}.fixture-card img{display:none}.fixture-card a{color:#426a57;font-size:14px}";
export const records = [
  {
    recordId: "blog-1",
    collectionId: "blog",
    values: {
      title: "Kuşadası’nda bir gün",
      body: "Kaynak açıklaması 1",
      cover: "",
      url: "/blog/kusadasi",
    },
  },
  {
    recordId: "blog-2",
    collectionId: "blog",
    values: {
      title: "Efes gezisine hazırlık",
      body: "Kaynak açıklaması 2",
      cover: "",
      url: "/blog/efes",
    },
  },
  {
    recordId: "blog-3",
    collectionId: "blog",
    values: {
      title: "Kruvaziyerle Kuşadası",
      body: "Kaynak açıklaması 3",
      cover: "",
      url: "/blog/kruvaziyer",
    },
  },
];
const schema = {
  collectionId: "blog",
  label: "Blog yazıları",
  schemaVersion: "1",
  fields: [
    {
      fieldId: "title",
      label: "Başlık",
      valueType: "text",
      required: true,
      nullable: false,
    },
    {
      fieldId: "body",
      label: "Açıklama",
      valueType: "textarea",
      required: false,
      nullable: false,
    },
    {
      fieldId: "cover",
      label: "Kapak görseli",
      valueType: "image",
      required: false,
      nullable: true,
    },
    {
      fieldId: "url",
      label: "Bağlantı",
      valueType: "url",
      required: false,
      nullable: true,
    },
  ],
  capabilities: {
    search: true,
    recordSelection: true,
    recordGroups: false,
    query: { filterFields: [], sortFields: ["title"], maxLimit: 30 },
  },
};
export const provider = {
  providerId: "fixture.blog",
  capabilities: {
    supported: ["collections", "schema", "search", "resolveRecords", "query"],
  },
  listCollections: async () => [structuredClone(schema)],
  getSchema: async () => structuredClone(schema),
  search: async () => ({ items: structuredClone(records), nextCursor: null }),
  resolveRecords: async (_, ids) =>
    ids.map((recordId) => ({
      recordId,
      record: structuredClone(
        records.find((record) => record.recordId === recordId) ?? null,
      ),
    })),
  query: async (_, query) => ({
    items: structuredClone(records.slice(0, query.limit)),
    nextCursor: null,
  }),
};
export function sourceBinding(scope = "repeater") {
  return {
    bindingId: "fixture-binding",
    target: {
      scope,
      id: scope === "block" ? "old-authoring-root-id" : "cards.items",
    },
    mode: "selection",
    providerId: provider.providerId,
    collectionId: "blog",
    schemaVersion: "1",
    recordRefs: records.map((record) => record.recordId),
    groupRef: null,
    query: null,
    fieldMappings: [
      { from: "title", to: scope === "block" ? "items.title" : "title" },
      { from: "body", to: scope === "block" ? "items.body" : "body" },
      { from: "cover", to: scope === "block" ? "items.image" : "image" },
      { from: "url", to: scope === "block" ? "items.url" : "url" },
    ],
  };
}
