import type { PreviewBehaviorPlugin } from "@blockdesign/grapesjs-bridge";

/** Reviewed behavior for source HTML. This is host-registered code, not imported scripts. */
function mountSite(header: HTMLElement): () => void {
  const doc = header.ownerDocument,
    win = doc.defaultView!;
  const cleanups: (() => void)[] = [];
  const on = (node: EventTarget | null, type: string, fn: EventListener) => {
    if (!node) return;
    node.addEventListener(type, fn);
    cleanups.push(() => node.removeEventListener(type, fn));
  };
  const toggle = header.querySelector<HTMLElement>("[data-menu-toggle]"),
    nav = header.querySelector<HTMLElement>("[data-nav-links]");
  const menu = (open: boolean) => {
    toggle?.setAttribute("aria-expanded", String(open));
    toggle?.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
    nav?.classList.toggle("is-open", open);
    doc.body.classList.toggle("menu-open", open);
  };
  on(toggle, "click", () =>
    menu(toggle?.getAttribute("aria-expanded") !== "true"),
  );
  on(header, "keydown", (event) => {
    if (
      (event as KeyboardEvent).key === "Escape" &&
      toggle?.getAttribute("aria-expanded") === "true"
    ) {
      event.preventDefault();
      menu(false);
      toggle.focus();
    }
  });
  on(nav, "click", (event) => {
    if ((event.target as Element)?.closest("a")) menu(false);
  });
  const language = header.querySelector<HTMLSelectElement>(
    "[data-language-select]",
  );
  on(language, "change", () => {
    if (language?.value) win.location.assign(language.value);
  });
  // Match the reviewed source's progressive enhancements. Generated controls
  // belong to preview/runtime only; cleanup returns the editable source DOM.
  const closers: (() => void)[] = [];
  for (const [index, control] of [
    ...doc.querySelectorAll<HTMLElement>(".finder-control--select"),
  ].entries()) {
    const select = control.querySelector<HTMLSelectElement>("select");
    if (!select || control.querySelector(".finder-select-trigger")) continue;
    const wasHidden = select.hidden;
    select.hidden = true;
    const trigger = doc.createElement("button");
    trigger.type = "button";
    trigger.className = "finder-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const list = doc.createElement("div");
    list.className = "finder-options";
    list.id = `finder-options-${index}`;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    trigger.setAttribute("aria-controls", list.id);
    const sync = () => {
      trigger.textContent = select.selectedOptions[0]?.textContent ?? "";
      trigger.classList.toggle("has-value", Boolean(select.value));
      for (const option of list.querySelectorAll<HTMLElement>("[role=option]"))
        option.setAttribute(
          "aria-selected",
          String(option.dataset.value === select.value),
        );
    };
    const close = () => {
      list.hidden = true;
      control.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    };
    closers.push(close);
    const open = () => {
      closers.forEach((fn) => fn());
      list.hidden = false;
      control.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      list.querySelector<HTMLElement>("[aria-selected=true]")?.focus();
    };
    for (const source of [...select.options]) {
      const option = doc.createElement("button");
      option.type = "button";
      option.className = "finder-option";
      option.dataset.value = source.value;
      option.setAttribute("role", "option");
      option.textContent = source.textContent;
      on(option, "click", (event) => {
        event.stopPropagation();
        select.value = source.value;
        select.dispatchEvent(new win.Event("change", { bubbles: true }));
        sync();
        close();
        trigger.focus();
      });
      list.append(option);
    }
    select.parentElement?.append(trigger);
    control.append(list);
    sync();
    on(select, "change", sync);
    on(trigger, "click", (event) => {
      event.stopPropagation();
      list.hidden ? open() : close();
    });
    on(control, "keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Escape") {
        close();
        trigger.focus();
      }
      if (["ArrowDown", "ArrowUp"].includes(key)) {
        event.preventDefault();
        if (list.hidden) open();
        else {
          const options = [
            ...list.querySelectorAll<HTMLElement>("[role=option]"),
          ];
          const current = options.indexOf(doc.activeElement as HTMLElement);
          options[
            (current + (key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length
          ]?.focus();
        }
      }
    });
    on(control, "click", (event) => {
      if (
        !(event.target as Element).closest(
          ".finder-select-trigger,.finder-option",
        )
      )
        list.hidden ? open() : close();
    });
    on(doc, "click", (event) => {
      if (!control.contains(event.target as Node)) close();
    });
    cleanups.push(() => {
      trigger.remove();
      list.remove();
      select.hidden = wasHidden;
      control.classList.remove("is-open");
    });
  }
  for (const [index, group] of [
    ...header.querySelectorAll<HTMLElement>("[data-nav-group]"),
  ].entries()) {
    const button = group.querySelector<HTMLButtonElement>(
      "[data-nav-subtoggle]",
    );
    const sub = group.querySelector<HTMLElement>("[data-nav-submenu]");
    if (!button || !sub) continue;
    const previous = {
      hidden: button.hidden,
      id: sub.id,
      controls: button.getAttribute("aria-controls"),
      label: button.getAttribute("aria-label"),
    };
    button.hidden = !sub.querySelector("a");
    sub.id = `cms-nav-submenu-${index}`;
    button.setAttribute("aria-controls", sub.id);
    const label = group.querySelector("a")?.textContent?.trim() ?? "Alt menü";
    const setOpen = (open: boolean) => {
      sub.hidden = !open;
      group.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute(
        "aria-label",
        label + (open ? " alt menüsünü kapat" : " alt menüsünü aç"),
      );
    };
    setOpen(false);
    on(button, "click", () => setOpen(sub.hidden !== false));
    on(group, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        button.focus();
      }
    });
    on(doc, "click", (event) => {
      if (!group.contains(event.target as Node)) setOpen(false);
    });
    cleanups.push(() => {
      setOpen(false);
      button.hidden = previous.hidden;
      sub.id = previous.id;
      for (const [name, value] of [
        ["aria-controls", previous.controls],
        ["aria-label", previous.label],
      ]) {
        if (value === null) button.removeAttribute(name!);
        else button.setAttribute(name!, value!);
      }
    });
  }
  for (const button of doc.querySelectorAll<HTMLElement>(
    "[data-route-trigger]",
  ))
    on(button, "click", () => {
      const id = button.getAttribute("aria-controls"),
        panel = id ? doc.getElementById(id) : null;
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      if (panel) panel.hidden = !open;
    });
  for (const button of doc.querySelectorAll<HTMLElement>("[data-expand-all]"))
    on(button, "click", () => {
      const triggers = [
        ...doc.querySelectorAll<HTMLElement>("[data-route-trigger]"),
      ];
      const open = !triggers.every(
        (t) => t.getAttribute("aria-expanded") === "true",
      );
      for (const trigger of triggers) {
        trigger.setAttribute("aria-expanded", String(open));
        const panel = doc.getElementById(
          trigger.getAttribute("aria-controls") ?? "",
        );
        if (panel) panel.hidden = !open;
      }
      button.textContent = open ? "Tümünü kapat" : "Tümünü aç";
    });
  for (const button of doc.querySelectorAll("[data-scroll-form]"))
    on(button, "click", () =>
      doc.querySelector("#booking")?.scrollIntoView({ behavior: "smooth" }),
    );
  for (const form of doc.querySelectorAll<HTMLFormElement>("[data-demo-form]"))
    on(form, "submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const status = form.querySelector<HTMLElement>("[data-form-status]");
      if (status) {
        status.hidden = false;
        status.textContent =
          "Bu form önizlemedir. Talep gönderilmedi; gerçek gönderim için CMS form bağlantısı gerekir.";
        status.focus();
      }
    });
  for (const form of doc.querySelectorAll<HTMLFormElement>(
    "[data-tour-search]",
  ))
    on(form, "submit", (event) => {
      event.preventDefault();
      const destination =
        form.querySelector<HTMLSelectElement>("[name=destination]");
      if (destination?.value) win.location.assign(destination.value);
    });
  return () => {
    cleanups.forEach((fn) => fn());
    menu(false);
  };
}

function mountHero(root: HTMLElement): () => void {
  const win = root.ownerDocument.defaultView!,
    slides = [...root.querySelectorAll<HTMLElement>("[data-hero-slide]")],
    dots = [...root.querySelectorAll<HTMLElement>("[data-hero-dot]")],
    status = root.querySelector<HTMLElement>("[data-hero-status]");
  const snapshots = slides.map((slide) => ({
    classes: slide.className,
    hidden: slide.getAttribute("aria-hidden"),
    inert: slide.inert,
  }));
  let settings: { autoplay?: boolean; interval?: number; loop?: boolean } = {};
  try {
    settings = JSON.parse(
      root.getAttribute("data-bd-behavior-settings") ?? "{}",
    );
  } catch {}
  let current = 0,
    timer: number | undefined;
  const cleanup: (() => void)[] = [];
  const on = (node: EventTarget | null, type: string, fn: EventListener) => {
    if (node) {
      node.addEventListener(type, fn);
      cleanup.push(() => node.removeEventListener(type, fn));
    }
  };
  const show = (index: number) => {
    current =
      settings.loop === false
        ? Math.max(0, Math.min(slides.length - 1, index))
        : (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === current);
      slide.setAttribute("aria-hidden", String(i !== current));
      slide.inert = i !== current;
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === current);
      dot.setAttribute("aria-current", String(i === current));
    });
    if (status) status.textContent = `${current + 1} / ${slides.length}`;
  };
  const stop = () => {
    if (timer !== undefined) win.clearInterval(timer);
    timer = undefined;
  };
  const start = () => {
    stop();
    if (
      settings.autoplay !== false &&
      !win.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      timer = win.setInterval(
        () => show(current + 1),
        Math.max(1000, Math.min(60000, Number(settings.interval) || 6500)),
      );
  };
  on(root.querySelector("[data-hero-prev]"), "click", () => {
    show(current - 1);
    start();
  });
  on(root.querySelector("[data-hero-next]"), "click", () => {
    show(current + 1);
    start();
  });
  dots.forEach((dot, index) =>
    on(dot, "click", () => {
      show(index);
      start();
    }),
  );
  on(root, "mouseenter", stop);
  on(root, "mouseleave", start);
  on(root, "focusin", stop);
  on(root, "focusout", start);
  on(root, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "ArrowLeft") show(current - 1);
    if ((event as KeyboardEvent).key === "ArrowRight") show(current + 1);
  });
  if (slides.length) {
    show(0);
    start();
  }
  return () => {
    stop();
    cleanup.forEach((fn) => fn());
    slides.forEach((slide, index) => {
      slide.className = snapshots[index]!.classes;
      const hidden = snapshots[index]!.hidden;
      if (hidden === null) slide.removeAttribute("aria-hidden");
      else slide.setAttribute("aria-hidden", hidden);
      slide.inert = snapshots[index]!.inert;
    });
  };
}
export const scalanovaBehaviors: PreviewBehaviorPlugin[] = [
  {
    id: "scalanova.site",
    selector: "[data-sn-runtime]",
    css: "[data-nav-subtoggle][hidden]{display:none!important}.nav-tour-toggle{min-width:44px;min-height:44px}",
    exportJs: `(()=>{const mount=${mountSite.toString()};document.querySelectorAll('[data-sn-runtime]').forEach(el=>mount(el));})();`,
    mount: mountSite,
  },
  {
    id: "scalanova.hero",
    selector: "[data-sn-slider]",
    exportJs: `(()=>{const mount=${mountHero.toString()};document.querySelectorAll('[data-sn-slider]').forEach(el=>mount(el));})();`,
    mount: mountHero,
    settings: [
      {
        fieldId: "hero.autoplay",
        key: "autoplay",
        label: "Otomatik oynat",
        type: "boolean",
        required: false,
        defaultValue: true,
        mappingTarget: { nodeId: "root", operation: "attribute" },
      },
      {
        fieldId: "hero.interval",
        key: "interval",
        label: "Slayt süresi (ms)",
        type: "number",
        required: false,
        defaultValue: 6500,
        min: 1000,
        max: 60000,
        mappingTarget: { nodeId: "root", operation: "attribute" },
      },
      {
        fieldId: "hero.loop",
        key: "loop",
        label: "Döngü",
        type: "boolean",
        required: false,
        defaultValue: true,
        mappingTarget: { nodeId: "root", operation: "attribute" },
      },
    ],
  },
];
