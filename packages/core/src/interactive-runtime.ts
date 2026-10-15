/** Native semantics, instance-scoped controls, keyboard support and reversible lifecycle. */
export function mountInteractive(root: HTMLElement): () => void {
  const doc = root.ownerDocument,
    win = doc.defaultView!,
    kind = root.getAttribute("data-bd-behavior");
  const snapshots = [root, ...root.querySelectorAll<HTMLElement>("*")].map(
    (el) => ({
      el,
      attrs: [...el.attributes].map((a) => [a.name, a.value] as const),
    }),
  );
  const off: Array<() => void> = [];
  const listen = (el: EventTarget, name: string, handler: EventListener) => {
    el.addEventListener(name, handler);
    off.push(() => el.removeEventListener(name, handler));
  };
  const uid =
    "bd-widget-" +
    (win.crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
  let dialog: HTMLDialogElement | null = null,
    invoker: HTMLElement | null = null,
    created = false;
  const close = () => {
    if (dialog?.open) dialog.close();
    invoker?.focus();
  };
  if (kind === "tabs") {
    const list = root.querySelector<HTMLElement>("[data-bd-tablist]"),
      tabs = [...root.querySelectorAll<HTMLElement>("[data-bd-tab]")],
      panels = [...root.querySelectorAll<HTMLElement>("[data-bd-tabpanel]")];
    if (!list || !tabs.length || tabs.length !== panels.length)
      throw new Error("Sekmeler için eşit sayıda sekme ve panel bağla.");
    list.setAttribute("role", "tablist");
    if (!list.hasAttribute("aria-label"))
      list.setAttribute("aria-label", "İçerik sekmeleri");
    const activate = (index: number, focus = false) => {
      tabs.forEach((tab, i) => {
        tab.setAttribute("role", "tab");
        tab.id = uid + "-tab-" + i;
        tab.setAttribute("aria-controls", uid + "-panel-" + i);
        tab.setAttribute("aria-selected", String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        const panel = panels[i]!;
        panel.id = uid + "-panel-" + i;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tab.id);
        panel.tabIndex = 0;
        panel.hidden = i !== index;
      });
      if (focus) tabs[index]?.focus();
    };
    tabs.forEach((tab, index) => {
      listen(tab, "click", ((event: Event) => {
        event.preventDefault();
        activate(index);
      }) as EventListener);
      listen(tab, "keydown", ((event: KeyboardEvent) => {
        let next = index;
        const vertical = list.getAttribute("aria-orientation") === "vertical";
        if (event.key === (vertical ? "ArrowDown" : "ArrowRight"))
          next = (index + 1) % tabs.length;
        else if (event.key === (vertical ? "ArrowUp" : "ArrowLeft"))
          next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(next, true);
      }) as EventListener);
    });
    activate(0);
  } else if (kind === "modal" || kind === "gallery") {
    let items = [
        ...root.querySelectorAll<HTMLElement>("[data-bd-gallery-item]"),
      ],
      activeIndex = 0;
    if (kind === "gallery") {
      dialog = doc.createElement("dialog");
      dialog.className = "bd-widget-dialog";
      dialog.setAttribute("aria-label", "Görsel galerisi");
      root.append(dialog);
      created = true;
      const image = doc.createElement("img"),
        caption = doc.createElement("p"),
        previous = doc.createElement("button"),
        next = doc.createElement("button"),
        exit = doc.createElement("button");
      previous.type = next.type = exit.type = "button";
      previous.textContent = "Önceki görsel";
      next.textContent = "Sonraki görsel";
      exit.textContent = "Kapat";
      dialog.append(image, caption, previous, next, exit);
      const show = (index: number) => {
        const item = items[index],
          source = item?.querySelector("img");
        const href = item?.getAttribute("href");
        const raw =
          (href && href !== "#" ? href : source?.getAttribute("src")) ?? "";
        const url = new URL(raw, doc.baseURI);
        if (!["http:", "https:"].includes(url.protocol))
          throw new Error("Galeri görsel adresi geçersiz.");
        activeIndex = index;
        image.src = url.href;
        image.alt = source?.alt ?? "";
        caption.textContent = `${index + 1} / ${items.length}`;
        previous.disabled = index === 0;
        next.disabled = index === items.length - 1;
      };
      items.forEach((item, index) =>
        listen(item, "click", ((event: Event) => {
          event.preventDefault();
          show(index);
          invoker = item;
          dialog!.showModal();
          exit.focus();
        }) as EventListener),
      );
      listen(previous, "click", (() =>
        show(Math.max(0, activeIndex - 1))) as EventListener);
      listen(next, "click", (() =>
        show(Math.min(items.length - 1, activeIndex + 1))) as EventListener);
      listen(exit, "click", close);
      listen(dialog, "keydown", ((event: KeyboardEvent) => {
        if (event.key === "ArrowRight" && activeIndex < items.length - 1) {
          event.preventDefault();
          show(activeIndex + 1);
        }
        if (event.key === "ArrowLeft" && activeIndex > 0) {
          event.preventDefault();
          show(activeIndex - 1);
        }
      }) as EventListener);
    } else {
      dialog = root.querySelector<HTMLDialogElement>("dialog[data-bd-dialog]");
      if (!dialog) throw new Error("Modal için dialog öğesi bağla.");
      dialog.classList.add("bd-widget-dialog");
      if (
        !dialog.hasAttribute("aria-label") &&
        !dialog.hasAttribute("aria-labelledby")
      )
        dialog.setAttribute("aria-label", "Bilgi");
      for (const trigger of root.querySelectorAll<HTMLElement>(
        "[data-bd-modal-open]",
      ))
        listen(trigger, "click", ((event: Event) => {
          event.preventDefault();
          invoker = trigger;
          if (!dialog!.open) dialog!.showModal();
        }) as EventListener);
      for (const trigger of dialog.querySelectorAll("[data-bd-modal-close]"))
        listen(trigger, "click", close);
    }
    listen(dialog!, "cancel", ((event: Event) => {
      event.preventDefault();
      close();
    }) as EventListener);
    listen(dialog!, "close", (() => invoker?.focus()) as EventListener);
    listen(dialog!, "click", ((event: MouseEvent) => {
      if (event.target !== dialog) return;
      const box = dialog!.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        close();
    }) as EventListener);
  }
  return () => {
    off.forEach((stop) => stop());
    if (dialog?.open) dialog.close();
    if (created) dialog?.remove();
    for (const { el, attrs } of snapshots) {
      for (const a of [...el.attributes]) el.removeAttribute(a.name);
      for (const [name, value] of attrs) el.setAttribute(name, value);
    }
  };
}
