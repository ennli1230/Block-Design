import type {
  AdapterError,
  FieldDefinition,
  JsonValue,
  RepeaterDefinition,
} from "@blockdesign/contracts";
import {parseRichText} from './rich-text.ts';

export const MAX_LIST_DEPTH = 8;
const identity = () => `item_${globalThis.crypto.randomUUID()}`;
const object = (
  value: JsonValue | undefined,
): value is Record<string, JsonValue> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export function assertRepeaterSchema(
  schema: RepeaterDefinition,
  depth = 0,
): void {
  if (depth >= MAX_LIST_DEPTH)
    throw new Error(`Listeler en fazla ${MAX_LIST_DEPTH} düzey olabilir.`);
  if (
    !Number.isInteger(schema.minItems) ||
    !Number.isInteger(schema.maxItems) ||
    schema.minItems < 0 ||
    schema.maxItems < schema.minItems ||
    schema.maxItems > 500
  )
    throw new Error("Liste sınırları 0–500 aralığında olmalı.");
  const keys = [
    ...schema.itemFields.map((field) => field.key),
    ...(schema.childRepeaters ?? []).map((child) => child.key),
  ];
  if (new Set(keys).size !== keys.length)
    throw new Error(
      "Aynı listede alan ve alt liste anahtarları benzersiz olmalı.",
    );
  for (const child of schema.childRepeaters ?? [])
    assertRepeaterSchema(child, depth + 1);
}

export function normalizeRepeaterRows(
  value: JsonValue | undefined,
  schema: RepeaterDefinition,
  fresh = false,
  depth = 0,
): Record<string, JsonValue>[] {
  if (depth === 0) assertRepeaterSchema(schema);
  if (depth >= MAX_LIST_DEPTH)
    throw new Error(`Listeler en fazla ${MAX_LIST_DEPTH} düzey olabilir.`);
  if (!Array.isArray(value)) return [];
  return value.filter(object).map((input) => {
    const row = structuredClone(input);
    row.__id =
      fresh || typeof row.__id !== "string" || !row.__id
        ? identity()
        : row.__id;
    for (const field of schema.itemFields)
      row[field.key] ??= structuredClone(field.defaultValue);
    for (const child of schema.childRepeaters ?? [])
      row[child.key] = normalizeRepeaterRows(
        row[child.key],
        child,
        fresh,
        depth + 1,
      );
    return row;
  });
}

export function validateRepeaterRows(
  value: JsonValue | undefined,
  schema: RepeaterDefinition,
  validateField: (
    field: FieldDefinition,
    value: JsonValue | undefined,
    path: string,
  ) => AdapterError[],
  path: string,
  depth = 0,
  ids = new Set<string>(),
): AdapterError[] {
  const issue = (code: string, message: string, at = path): AdapterError => ({
    code,
    message,
    path: at,
    recoverable: true,
  });
  if (depth === 0) {
    try {
      assertRepeaterSchema(schema);
    } catch (error) {
      return [
        issue(
          "REPEATER_SCHEMA_INVALID",
          error instanceof Error ? error.message : "Liste şeması geçersiz.",
        ),
      ];
    }
  }
  if (depth >= MAX_LIST_DEPTH)
    return [
      issue(
        "REPEATER_DEPTH",
        `Listeler en fazla ${MAX_LIST_DEPTH} düzey olabilir.`,
      ),
    ];
  if (!Array.isArray(value))
    return [issue("REPEATER_INVALID", `“${schema.label}” listesi okunamadı.`)];
  const issues: AdapterError[] = [];
  if (value.length < schema.minItems || value.length > schema.maxItems)
    issues.push(
      issue(
        "REPEATER_LIMIT",
        `“${schema.label}” listesi ${schema.minItems} ile ${schema.maxItems} öğe arasında olmalı.`,
      ),
    );
  value.forEach((row, index) => {
    const rowPath = `${path}.${index}`;
    if (!object(row)) {
      issues.push(
        issue("REPEATER_ITEM_INVALID", "Liste öğesi geçersiz.", rowPath),
      );
      return;
    }
    if (typeof row.__id !== "string" || !row.__id || ids.has(row.__id))
      issues.push(
        issue(
          "REPEATER_ITEM_ID_INVALID",
          "Liste öğesinin kimliği eksik veya yineleniyor.",
          `${rowPath}.__id`,
        ),
      );
    if (typeof row.__id === "string") ids.add(row.__id);
    for (const field of schema.itemFields)
      issues.push(
        ...validateField(field, row[field.key], `${rowPath}.${field.key}`),
      );
    for (const child of schema.childRepeaters ?? [])
      issues.push(
        ...validateRepeaterRows(
          row[child.key],
          child,
          validateField,
          `${rowPath}.${child.key}`,
          depth + 1,
          ids,
        ),
      );
  });
  return issues;
}

export function findTemplateNode(
  value: JsonValue,
  nodeId: string,
): Record<string, JsonValue> | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const node = findTemplateNode(child, nodeId);
      if (node) return node;
    }
    return null;
  }
  if (!object(value)) return null;
  if (object(value.attributes) && value.attributes["data-bd-node"] === nodeId)
    return value;
  return Array.isArray(value.components)
    ? findTemplateNode(value.components, nodeId)
    : null;
}

/** Apply the same authored schema to custom widgets and shared regions. */
export function applyTemplateData(
  template: JsonValue,
  fields: FieldDefinition[],
  repeaters: RepeaterDefinition[],
  data: Record<string, JsonValue>,
  depth = 0,
): JsonValue {
  if (depth > MAX_LIST_DEPTH)
    throw new Error("Liste tasarımının derinlik sınırı aşıldı.");
  const root = structuredClone(template);
  for (const field of fields) {
    const node = findTemplateNode(root, field.mappingTarget.nodeId);
    if (!node) continue;
    const value = data[field.key] ?? field.defaultValue;
    const attrs = object(node.attributes) ? node.attributes : {};
    node.attributes = attrs;
    const operation = field.mappingTarget.operation;
    if(operation==='safeRichText'){
      node.components=parseRichText(String(value??''));delete node.content;
    } else if (operation === "text") {
      node.components = [{ type: "textnode", content: String(value ?? "") }];
      delete node.content;
    } else if (operation === 'textSegment' && Array.isArray(node.components) && /^\d+$/.test(field.mappingTarget.property ?? '')) {
      const index=Number(field.mappingTarget.property);const current=node.components[index];
      if(typeof current==='string'||object(current)&&current.type==='textnode')node.components[index]={type:'textnode',content:String(value??'')};
    } else if (operation === "attribute" && field.mappingTarget.property) {
      if (value === false && ['selected', 'checked', 'disabled', 'required', 'multiple', 'open', 'inert', 'hidden', 'controls', 'loop', 'muted', 'novalidate'].includes(field.mappingTarget.property)) delete attrs[field.mappingTarget.property];
      else attrs[field.mappingTarget.property] = value;
    }
    else if (operation === "style" && field.mappingTarget.property) {
      const styles = object(node.style) ? node.style : {};
      styles[field.mappingTarget.property] = value;
      node.style = styles;
    } else if (operation === "booleanVisibility") {
      if (value === true) attrs.hidden = true;
      else delete attrs.hidden;
    }
  }
  for (const repeater of repeaters) {
    if (!repeater.mappingTarget) continue;
    const container = findTemplateNode(
      root,
      repeater.mappingTarget.containerNodeId,
    );
    if (!container || !Array.isArray(container.components)) continue;
    const children = container.components;
    const index = children.findIndex(
      (item) =>
        object(item) &&
        object(item.attributes) &&
        item.attributes["data-bd-node"] === repeater.mappingTarget!.itemNodeId,
    );
    if (index < 0) continue;
    const sample = children[index]!;
    const rows = normalizeRepeaterRows(data[repeater.key], repeater);
    const items = rows.map((row) => {
      const item = applyTemplateData(
        sample,
        repeater.itemFields,
        repeater.childRepeaters ?? [],
        row,
        depth + 1,
      );
      if (object(item)) {
        const attrs = object(item.attributes) ? item.attributes : {};
        attrs["data-bd-item"] = row.__id!;
        attrs["data-bd-repeater"] = repeater.repeaterId;
        item.attributes = attrs;
      }
      return item;
    });
    container.components = repeater.mappingTarget.replaceChildren
      ? items
      : [...children.slice(0, index), ...items, ...children.slice(index + 1)];
  }
  return root;
}
