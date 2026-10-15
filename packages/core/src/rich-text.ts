import type { JsonValue } from "../../contracts/src/index.ts";
import { isSafeUrl } from "./field-values.ts";
/** Small, allowlisted HTML subset represented as canonical nodes, never raw executable HTML. */
export function parseRichText(input: string): JsonValue[] {
  const decode = (text: string) =>
    text.replace(
      /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
      (match, key: string) => {
        const named: Record<string, string> = {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
          nbsp: "\u00a0",
        };
        if (named[key.toLowerCase()]) return named[key.toLowerCase()]!;
        const code = key.toLowerCase().startsWith("#x")
          ? parseInt(key.slice(2), 16)
          : Number(key.slice(1));
        return Number.isInteger(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      },
    );
  const allowed = new Set([
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
  ]);
  const root: { components: JsonValue[] } = { components: [] };
  const stack: Array<{ tagName?: string; components: JsonValue[] }> = [root];
  for (const token of input.slice(0, 200000).match(/<[^>]*>|[^<]+|</g) ?? []) {
    const tag = /^<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>/i.exec(token);
    if (!tag) {
      stack
        .at(-1)!
        .components.push({ type: "textnode", content: decode(token) });
      continue;
    }
    const name = tag[2]!.toLowerCase();
    if (!allowed.has(name)) continue;
    if (tag[1]) {
      const index = stack.map((node) => node.tagName).lastIndexOf(name);
      if (index > 0) stack.length = index;
      continue;
    }
    const attributes: Record<string, JsonValue> = {};
    if (name === "a") {
      const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
        tag[3]!,
      );
      const value = decode(href?.[1] ?? href?.[2] ?? href?.[3] ?? "");
      if (value && isSafeUrl(value)) attributes.href = value;
    }
    const node = { tagName: name, attributes, components: [] as JsonValue[] };
    stack.at(-1)!.components.push(node);
    if (name !== "br" && stack.length < 24) stack.push(node);
  }
  return root.components;
}
