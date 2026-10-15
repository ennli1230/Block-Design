import type { FieldDefinition, JsonValue } from "@blockdesign/contracts";
import { findTemplateNode, makeId } from "@blockdesign/core";

type Node = Record<string, JsonValue>;
const object = (value: JsonValue | undefined): value is Node =>
  !!value && typeof value === "object" && !Array.isArray(value);
const attrs = (node: Node): Node =>
  object(node.attributes) ? node.attributes : {};
const id = (node: Node): string => String(attrs(node)["data-bd-node"] ?? "");
const elements = (node: Node): Node[] =>
  Array.isArray(node.components)
    ? node.components.filter(
        (child): child is Node => object(child) && child.type !== "textnode",
      )
    : [];
const shape = (node: Node): string =>
  JSON.stringify([
    node.tagName ?? "div",
    String(attrs(node).class ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .sort(),
    elements(node).map(shape),
  ]);
const plainText = (value: JsonValue | undefined): string =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map(plainText).join("")
      : object(value)
        ? plainText(value.content ?? value.components)
        : "";

export function repeaterItems(
  template: JsonValue,
  containerId: string,
  sampleId: string,
): Node[] {
  const container = findTemplateNode(template, containerId);
  const items = container ? elements(container) : [];
  const sample = items.find((node) => id(node) === sampleId);
  if (!sample)
    throw new Error(
      "Kartları saran kapsayıcıyı ve içindeki bir örnek kartı seç.",
    );
  const hasText =
    Array.isArray(container!.components) &&
    container!.components.some(
      (child) =>
        (typeof child === "string" ||
          (object(child) && child.type === "textnode")) &&
        plainText(child).trim(),
    );
  if (hasText || items.some((node) => shape(node) !== shape(sample)))
    throw new Error(
      "Bu kapsayıcıda farklı öğeler var. Yalnızca aynı yapıdaki kartları saran öğeyi seç.",
    );
  return items;
}

/** Find the repeated card even when a title or image inside it is selected. */
export function inferRepeaterSelection(
  template: JsonValue,
  selectedId: string,
): { containerNodeId: string; itemNodeId: string; count: number } | null {
  const parents = new Map<string, Node>();
  function visit(value: JsonValue) {
    if (!object(value)) return;
    for (const child of elements(value)) {
      if (id(child)) parents.set(id(child), value);
      visit(child);
    }
  }
  visit(template);
  const selected = findTemplateNode(template, selectedId);
  if (!selected) return null;
  function candidate(container: Node, sample: Node) {
    if (!id(container) || !id(sample)) return null;
    try {
      const items = repeaterItems(template, id(container), id(sample));
      return {
        containerNodeId: id(container),
        itemNodeId: id(sample),
        count: items.length,
      };
    } catch {
      return null;
    }
  }
  const children = elements(selected);
  const contained = children[0] ? candidate(selected, children[0]) : null;
  if (contained && contained.count > 1) return contained;
  let node: Node | undefined = selected;
  let fallback = contained;
  while (node) {
    const parent = parents.get(id(node));
    if (!parent) break;
    const match = candidate(parent, node);
    if (match && match.count > 1) return match;
    if (!fallback && match) fallback = match;
    node = parent;
  }
  return fallback;
}

function readNodeValue(node: Node | null, field: FieldDefinition): JsonValue {
  if (!node) return structuredClone(field.defaultValue);
  const mapping = field.mappingTarget;
  let value: JsonValue;
  if (mapping.operation === "attribute")
    value = attrs(node)[mapping.property!] ?? node[mapping.property!] ?? "";
  else if (mapping.operation === "style")
    value = object(node.style) ? (node.style[mapping.property!] ?? "") : "";
  else if (mapping.operation === "booleanVisibility")
    value = Boolean(attrs(node).hidden);
  else if (
    mapping.operation === "textSegment" &&
    Array.isArray(node.components)
  )
    value = plainText(node.components[Number(mapping.property)]);
  else value = plainText(node.components ?? node.content).trim();
  return field.type === "number" ? Number(value) || 0 : value;
}
export function readTemplateFieldValue(
  template: JsonValue,
  field: FieldDefinition,
): JsonValue {
  return readNodeValue(
    findTemplateNode(template, field.mappingTarget.nodeId),
    field,
  );
}

/** Include unmapped leaf content so converting existing cards preserves their content. */
export function completeRepeaterFields(
  template: JsonValue,
  sampleId: string,
  existing: FieldDefinition[],
): FieldDefinition[] {
  const fields = structuredClone(existing);
  const sample = findTemplateNode(template, sampleId);
  if (!sample) return fields;
  function add(
    node: Node,
    label: string,
    key: string,
    type: FieldDefinition["type"],
    operation: FieldDefinition["mappingTarget"]["operation"],
    property?: string,
  ) {
    if (
      !id(node) ||
      fields.some(
        (field) =>
          field.mappingTarget.nodeId === id(node) &&
          (operation === "text"
            ? ["text", "safeRichText", "textSegment"].includes(
                field.mappingTarget.operation,
              )
            : field.mappingTarget.operation === operation &&
              field.mappingTarget.property === property),
      )
    )
      return;
    let uniqueKey = key,
      suffix = 2;
    while (fields.some((field) => field.key === uniqueKey))
      uniqueKey = `${key}-${suffix++}`;
    const field: FieldDefinition = {
      fieldId: makeId("field"),
      key: uniqueKey,
      label,
      type,
      required: false,
      defaultValue: "",
      mappingTarget: {
        nodeId: id(node),
        operation,
        ...(property ? { property } : {}),
      },
    };
    field.defaultValue = readNodeValue(node, field);
    fields.push(field);
  }
  function walk(node: Node) {
    const tag = String(node.tagName ?? "div");
    if (tag === "img") {
      add(node, "Görsel", "gorsel", "image", "attribute", "src");
      if (typeof attrs(node).alt === "string")
        add(
          node,
          "Görsel açıklaması",
          "gorsel-aciklamasi",
          "text",
          "attribute",
          "alt",
        );
    }
    if (tag === "a" && typeof attrs(node).href === "string")
      add(node, "Bağlantı", "baglanti", "url", "attribute", "href");
    if (
      !elements(node).length &&
      !["img", "video", "script", "style", "input", "button"].includes(tag) &&
      plainText(node.components ?? node.content).trim()
    ) {
      const heading = /^h[1-6]$/.test(tag);
      add(
        node,
        heading ? "Başlık" : tag === "a" ? "Bağlantı metni" : "Açıklama",
        heading ? "baslik" : tag === "a" ? "baglanti-metni" : "aciklama",
        tag === "p" ? "textarea" : "text",
        "text",
      );
    }
    elements(node).forEach(walk);
  }
  walk(sample);
  return fields;
}

export function seedRepeaterRows(
  template: JsonValue,
  containerId: string,
  sampleId: string,
  fields: FieldDefinition[],
  currentValues: Record<string, JsonValue> = {},
): Record<string, JsonValue>[] {
  const items = repeaterItems(template, containerId, sampleId);
  const sample = items.find((node) => id(node) === sampleId)!;
  function pathTo(
    node: Node,
    targetId: string,
    path: number[] = [],
  ): number[] | null {
    if (id(node) === targetId) return path;
    for (const [index, child] of elements(node).entries()) {
      const match = pathTo(child, targetId, [...path, index]);
      if (match) return match;
    }
    return null;
  }
  const paths = fields.map((field) =>
    pathTo(sample, field.mappingTarget.nodeId),
  );
  if (paths.some((path) => !path))
    throw new Error("Liste alanları örnek kartın içinde olmalı.");
  return items.map((item) => {
    const row: Record<string, JsonValue> = { __id: makeId("item") };
    fields.forEach((field, index) => {
      const node = paths[index]!.reduce(
        (node, childIndex) => elements(node)[childIndex]!,
        item,
      );
      row[field.key] = structuredClone(
        id(item) === sampleId && currentValues[field.key] !== undefined
          ? currentValues[field.key]!
          : readNodeValue(node, field),
      );
    });
    return row;
  });
}
