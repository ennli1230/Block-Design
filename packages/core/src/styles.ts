import type { JsonValue } from "@blockdesign/contracts";

export const EDITABLE_STYLE_PROPERTIES = [
  "background-color",
  "background-image",
  "color",
  "padding",
  "margin",
  "gap",
  "width",
  "max-width",
  "min-height",
  "font-size",
  "font-weight",
  "text-align",
  "border",
  "border-radius",
  "display",
  "justify-content",
  "align-items",
] as const;
export function safeStyleValue(property: string, value: string): boolean {
  if (
    !EDITABLE_STYLE_PROPERTIES.includes(
      property as (typeof EDITABLE_STYLE_PROPERTIES)[number],
    )
  )
    return false;
  if (
    value.length > 1000 ||
    /[{};<>]|expression\s*\(|javascript\s*:|@import/i.test(value)
  )
    return false;
  if (/url\s*\(/i.test(value)) {
    if (property !== "background-image") return false;
    const match = /^url\(["']?([^"')]+)["']?\)$/.exec(value);
    if (!match || /^(?:javascript|file|data):|^\/\//i.test(match[1]!))
      return false;
  }
  return true;
}
export function allowedStyleOverrides(
  input: Record<string, JsonValue>,
  allowed: string[],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) =>
        allowed.includes(key) &&
        typeof value === "string" &&
        safeStyleValue(key, value),
    ),
  ) as Record<string, string>;
}
