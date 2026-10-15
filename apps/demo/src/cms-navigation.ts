import type {
  JsonValue,
  SharedRegionDefinition,
  SourceBinding,
} from "@blockdesign/contracts";
import { findTemplateNode } from "@blockdesign/core";

/** Bind authored HTML to CMS database menu IDs. No endpoint URLs or menu labels in runtime code. */
export function connectCmsMenuRegion(
  input: SharedRegionDefinition,
): SharedRegionDefinition {
  const region = structuredClone(input);
  region.ref.version = "1.1.0";
  region.sourceBindings = [];
  for (const [index, repeater] of (region.repeaters ?? []).entries()) {
    if (region.region === "header" && index !== 0) {
      // Only published Turkish content exists in this import. The CMS can add other languages later.
      const rows = region.defaultData?.[repeater.key];
      if (Array.isArray(rows))
        region.defaultData![repeater.key] = rows.slice(0, 1).map((row) => {
          if (!row || typeof row !== "object" || Array.isArray(row)) return row;
          for (const field of repeater.itemFields)
            if (field.mappingTarget.property === "value")
              row[field.key] = "/scalanova-tour/tr/";
          return row;
        });
      continue;
    }
    const groupId = region.region === "header" ? "1" : String(index + 2);
    const label =
      region.region === "header"
        ? "Ana menü ve mobil menü"
        : [
            "Footer · Hizmetler",
            "Footer · Kurumsal",
            "Footer · Yasal bağlantılar",
          ][index]!;
    repeater.label = label;
    const mappings = repeater.itemFields.flatMap((field) =>
      field.mappingTarget.property === "href"
        ? [{ from: "url", to: field.key }]
        : field.mappingTarget.operation === "text"
          ? [{ from: "label", to: field.key }]
          : [],
    );
    if (region.region === "header" && repeater.mappingTarget) {
      const original = repeater.mappingTarget.itemNodeId;
      const container = findTemplateNode(
        region.componentTemplate,
        repeater.mappingTarget.containerNodeId,
      )!;
      const children = container.components as JsonValue[];
      const position = children.findIndex(
        (value) =>
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          (value.attributes as Record<string, JsonValue> | undefined)?.[
            "data-bd-node"
          ] === original,
      );
      const anchor = children[position]!;
      const node = (
        tagName: string,
        id: string,
        components: JsonValue[] = [],
        attributes: Record<string, JsonValue> = {},
      ): JsonValue => ({
        type: "default",
        tagName,
        attributes: { "data-bd-node": id, ...attributes },
        components,
      });
      children[position] = node(
        "div",
        original + ":group",
        [
          anchor,
          node(
            "button",
            original + ":toggle",
            [
              node(
                "svg",
                original + ":icon",
                [node("path", original + ":path", [], { d: "m6 9 6 6 6-6" })],
                {
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  "stroke-width": "1.8",
                  "aria-hidden": "true",
                },
              ),
            ],
            {
              type: "button",
              class: "nav-tour-toggle",
              "data-nav-subtoggle": "true",
              "aria-expanded": "false",
              "aria-label": "Alt menüyü aç",
            },
          ),
          node(
            "div",
            original + ":submenu",
            [
              node(
                "a",
                original + ":child",
                [{ type: "textnode", content: "Alt menü" }],
                { href: "#" },
              ),
            ],
            {
              class: "nav-tour-menu",
              "data-nav-submenu": "true",
              hidden: true,
            },
          ),
        ],
        { class: "nav-tour-group", "data-nav-group": "true" },
      );
      repeater.mappingTarget.itemNodeId = original + ":group";
      repeater.nesting = "children";
      repeater.childRepeaters = [
        {
          repeaterId: repeater.repeaterId + ".children",
          key: "children",
          label: "Alt menüler",
          minItems: 0,
          maxItems: 50,
          nesting: "none",
          mappingTarget: {
            containerNodeId: original + ":submenu",
            itemNodeId: original + ":child",
            replaceChildren: true,
          },
          itemFields: [
            {
              fieldId: "menu.child.label",
              key: "label",
              label: "Menü metni",
              type: "text",
              required: true,
              defaultValue: "",
              mappingTarget: { nodeId: original + ":child", operation: "text" },
            },
            {
              fieldId: "menu.child.url",
              key: "url",
              label: "Bağlantı",
              type: "url",
              required: true,
              defaultValue: "",
              mappingTarget: {
                nodeId: original + ":child",
                operation: "attribute",
                property: "href",
              },
            },
          ],
        },
      ];
      mappings.push({ from: "children", to: "children" });
    }
    const binding: SourceBinding = {
      bindingId: "cms.menu." + groupId,
      target: { scope: "repeater", id: repeater.repeaterId },
      mode: "selection",
      providerId: "blockdesign.demo-content",
      collectionId: "cms-menus",
      schemaVersion: "1",
      recordRefs: [],
      groupRef: groupId,
      query: null,
      fieldMappings: mappings,
    };
    region.sourceBindings.push(binding);
  }
  return region;
}
