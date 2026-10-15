import type { JsonValue } from "@blockdesign/contracts";
export interface PageMetadata {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  structuredData?: JsonValue;
}
export function createPageHead(metadata: PageMetadata = {}): string {
  const escape = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const safe = (text: string) => {
    const url = new URL(text, "https://local.invalid");
    if (!["https:", "http:"].includes(url.protocol))
      throw new Error("Sayfa metadata bağlantısı HTTP(S) olmalı.");
    return text;
  };
  if(metadata.canonical)safe(metadata.canonical);
  let head =
    "<title>" + escape(metadata.title ?? "BlockDesign sayfası") + "</title>";
  for (const [name, value] of [
    ["description", metadata.description],
    ["robots", metadata.robots],
  ])
    if (value) head += `<meta name="${name}" content="${escape(value)}">`;
  for (const [property, value] of [
    ["og:title", metadata.ogTitle ?? metadata.title],
    ["og:description", metadata.ogDescription ?? metadata.description],
    ["og:image", metadata.ogImage],
  ])
    if (value)
      head += `<meta property="${property}" content="${escape(property === "og:image" ? safe(value) : value)}">`;
  if (metadata.structuredData) {
    if (typeof metadata.structuredData !== "object")
      throw new Error(
        "Yapılandırılmış veri bir JSON nesnesi veya liste olmalı.",
      );
    head +=
      '<script type="application/ld+json">' +
      JSON.stringify(metadata.structuredData).replace(/</g, "\\u003c") +
      "</" +
      "script>";
  }
  return head;
}
