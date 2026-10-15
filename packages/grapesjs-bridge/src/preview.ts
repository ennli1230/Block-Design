export function stopEditingInteractions(event: Event, preview: boolean): void {
  // Canvas events originate in a separate iframe realm, so `instanceof
  // Element` against the host window fails for valid iframe elements.
  const target = event.target as Element | null;
  if (!target || target.nodeType !== 1 || typeof target.closest !== "function")
    return;

  if (preview) {
    if (event.type === "mousedown" && target.closest("summary"))
      event.stopPropagation();
    if (event.type === "click") {
      const disclosure = target
        .closest("summary")
        ?.closest("details") as HTMLDetailsElement | null;
      if (disclosure) {
        // GrapesJS suppresses native canvas defaults in preview. Keep the
        // native <details> markup, but apply its disclosure state explicitly.
        event.preventDefault();
        event.stopImmediatePropagation();
        disclosure.open = !disclosure.open;
      }
    }
    return;
  }

  if (target.closest("a, summary")) event.preventDefault();
}
