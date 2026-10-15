const locale = ['tr', 'en', 'es'].includes(document.documentElement.lang) ? document.documentElement.lang : 'tr';
const uiMessages = {
  "Open menu": {
    "tr": "Menüyü aç",
    "en": "Open menu",
    "es": "Abrir menú"
  },
  "Close menu": {
    "tr": "Menüyü kapat",
    "en": "Close menu",
    "es": "Cerrar menú"
  },
  "Expand all": {
    "tr": "Tümünü aç",
    "en": "Expand all",
    "es": "Abrir todo"
  },
  "Collapse all": {
    "tr": "Tümünü kapat",
    "en": "Collapse all",
    "es": "Cerrar todo"
  },
  "Please enter a valid email address.": {
    "tr": "Lütfen geçerli bir e-posta adresi girin.",
    "en": "Please enter a valid email address.",
    "es": "Introduce un correo electrónico válido."
  },
  "Please complete this field.": {
    "tr": "Lütfen bu alanı doldurun.",
    "en": "Please complete this field.",
    "es": "Completa este campo."
  },
  "Demo complete — your request was not sent or stored. Backend connection will be added after frontend approval.": {
    "tr": "Demo tamamlandı — talebiniz gönderilmedi veya saklanmadı. Backend bağlantısı frontend onayından sonra eklenecek.",
    "en": "Demo complete — your request was not sent or stored. Backend connection will be added after frontend approval.",
    "es": "Demostración completada: tu solicitud no se ha enviado ni guardado. La conexión se añadirá después de aprobar la web."
  },
  "Please select a destination.": {
    "tr": "Lütfen bir destinasyon seçin.",
    "en": "Please select a destination.",
    "es": "Selecciona un destino."
  },
  "Previous recommended journey": {
    "tr": "Önceki önerilen yolculuk",
    "en": "Previous recommended journey",
    "es": "Viaje recomendado anterior"
  },
  "Next recommended journey": {
    "tr": "Sonraki önerilen yolculuk",
    "en": "Next recommended journey",
    "es": "Viaje recomendado siguiente"
  },
  "recommended journeys carousel": {
    "tr": "önerilen yolculuklar kaydırıcısı",
    "en": "recommended journeys carousel",
    "es": "carrusel de viajes recomendados"
  },
  "Recommended journeys from Kuşadası": {
    "tr": "Kuşadası çıkışlı önerilen yolculuklar",
    "en": "Recommended journeys from Kuşadası",
    "es": "Viajes recomendados desde Kuşadası"
  }
};
const ui = (key) => uiMessages[key]?.[locale] ?? key;
const menuButton = document.querySelector('[data-menu-toggle]');
const navLinks = document.querySelector('[data-nav-links]');

if (menuButton && navLinks) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? (ui('Open menu')) : (ui('Close menu')));
    navLinks.classList.toggle('is-open', !isOpen);
    document.body.classList.toggle('menu-open', !isOpen);
  });
  navLinks.addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', ui('Open menu'));
    navLinks.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  });
}


document.querySelectorAll('[data-route-trigger]').forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });
});

const expandAll = document.querySelector('[data-expand-all]');
if (expandAll) {
  expandAll.addEventListener('click', () => {
    const triggers = [...document.querySelectorAll('[data-route-trigger]')];
    const allExpanded = triggers.every((trigger) => trigger.getAttribute('aria-expanded') === 'true');
    triggers.forEach((trigger) => {
      trigger.setAttribute('aria-expanded', String(!allExpanded));
      document.getElementById(trigger.getAttribute('aria-controls')).hidden = allExpanded;
    });
    expandAll.textContent = allExpanded ? (ui('Expand all')) : (ui('Collapse all'));
  });
}

document.querySelectorAll('[data-demo-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    let firstInvalid = null;
    form.querySelectorAll('[required]').forEach((field) => {
      let error = form.querySelector('[data-error-for="' + field.id + '"]');
      if (!error) {
        error = document.createElement('p');
        error.className = 'field-error';
        error.dataset.errorFor = field.id;
        field.closest('.field')?.append(error);
      }
      const invalid = !field.checkValidity();
      field.setAttribute('aria-invalid', String(invalid));
      if (error) error.textContent = invalid ? (field.validity.typeMismatch ? (ui('Please enter a valid email address.')) : (ui('Please complete this field.'))) : '';
      if (invalid && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }
    const status = form.querySelector('[data-form-status]');
    if (status) {
      status.hidden = false;
      status.textContent = ui('Demo complete — your request was not sent or stored. Backend connection will be added after frontend approval.');
      status.focus();
    }
  });
});

document.querySelectorAll('[data-scroll-form]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector('#booking')?.scrollIntoView({ behavior: 'smooth' }));
});




document.querySelectorAll('[data-language-select]').forEach((select) => {
  select.addEventListener('change', () => { if (select.value) window.location.assign(select.value); });
});



document.querySelectorAll('[data-tour-search]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const destination = form.elements.destination;
    const message = form.querySelector('[data-finder-message]');
    if (!destination.value) {
      (form.querySelector('.finder-select-trigger') || destination).focus();
      if (message) {
        message.hidden = false;
        message.textContent = ui('Please select a destination.');
      }
      return;
    }
    if (message) message.hidden = true;
    window.location.assign(destination.value);
  });
});

document.querySelectorAll('[data-hero-slider]').forEach((slider) => {
  const slides = [...slider.querySelectorAll('[data-hero-slide]')];
  const dots = [...slider.querySelectorAll('[data-hero-dot]')];
  const status = slider.querySelector('[data-hero-status]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0;
  let timer;

  const show = (index, announce = true) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });
    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    if (status && announce) status.textContent = `${current + 1} / ${slides.length}`;
  };
  const stop = () => window.clearInterval(timer);
  const start = () => {
    stop();
    if (!reduceMotion) timer = window.setInterval(() => show(current + 1, false), 6500);
  };

  slider.querySelector('[data-hero-prev]')?.addEventListener('click', () => { show(current - 1); start(); });
  slider.querySelector('[data-hero-next]')?.addEventListener('click', () => { show(current + 1); start(); });
  dots.forEach((dot) => dot.addEventListener('click', () => { show(Number(dot.dataset.heroDot)); start(); }));
  slider.addEventListener('mouseenter', stop);
  slider.addEventListener('mouseleave', start);
  slider.addEventListener('focusin', stop);
  slider.addEventListener('focusout', start);
  slider.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
  show(0, false);
  start();
});


document.querySelectorAll('.finder-control--select').forEach((control, pickerIndex) => {
  const select = control.querySelector('select');
  if (!select) return;
  select.hidden = true;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'finder-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const listId = `finder-options-${pickerIndex}`;
  trigger.setAttribute('aria-controls', listId);

  const menu = document.createElement('div');
  menu.className = 'finder-options';
  menu.id = listId;
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  const sync = () => {
    const selected = select.options[select.selectedIndex];
    trigger.textContent = selected?.textContent || '';
    trigger.classList.toggle('has-value', Boolean(select.value));
    [...menu.children].forEach((option) => option.setAttribute('aria-selected', String(option.dataset.value === select.value)));
  };
  const close = () => {
    menu.hidden = true;
    control.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    document.querySelectorAll('.finder-control.is-open').forEach((item) => {
      if (item !== control) {
        item.classList.remove('is-open');
        const otherMenu = item.querySelector('.finder-options');
        const otherTrigger = item.querySelector('.finder-select-trigger');
        if (otherMenu) otherMenu.hidden = true;
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
      }
    });
    menu.hidden = false;
    control.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.querySelector('[aria-selected=true]')?.focus();
  };

  [...select.options].forEach((sourceOption) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'finder-option';
    option.dataset.value = sourceOption.value;
    option.setAttribute('role', 'option');
    option.textContent = sourceOption.textContent;
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      select.value = sourceOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
      close();
      trigger.focus();
    });
    menu.append(option);
  });

  select.parentElement.append(trigger);
  control.append(menu);
  sync();
  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.hidden ? open() : close();
  });
  trigger.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key) && menu.hidden) {
      event.preventDefault();
      open();
    }
    if (event.key === 'Escape') close();
  });
  control.addEventListener('click', (event) => {
    if (event.target.closest('.finder-option')) return;
    if (!event.target.closest('.finder-select-trigger')) trigger.click();
  });
  document.addEventListener('click', (event) => {
    if (!control.contains(event.target)) close();
  });
});

document.querySelectorAll('.finder-control--date').forEach((control) => {
  const field = control.querySelector('input[type=date]');
  if (!field) return;
  control.addEventListener('click', (event) => {
    if (event.target === field) return;
    event.preventDefault();
    try {
      if (typeof field.showPicker === 'function') field.showPicker();
      else field.focus();
    } catch {
      field.focus();
    }
  });
});


document.querySelectorAll('[data-journey-carousel]').forEach((carousel) => {
  const track = carousel.querySelector('[data-journey-track]');
  const cards = [...track?.querySelectorAll('.recommended-card') || []];
  if (!track || !cards.length) return;

  const mobileQuery = window.matchMedia('(max-width: 820px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const controls = document.createElement('div');
  controls.className = 'journey-carousel-controls';
  controls.innerHTML = `
    <button type="button" data-journey-prev aria-label="${ui('Previous recommended journey')}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>
    </button>
    <output class="journey-carousel-status" data-journey-status aria-live="polite">1 / ${cards.length}</output>
    <button type="button" data-journey-next aria-label="${ui('Next recommended journey')}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>
    </button>`;
  carousel.append(controls);
  carousel.tabIndex = 0;
  carousel.setAttribute('role', 'region');
  carousel.setAttribute('aria-roledescription', ui('recommended journeys carousel'));
  carousel.setAttribute('aria-label', ui('Recommended journeys from Kuşadası'));

  const previous = controls.querySelector('[data-journey-prev]');
  const next = controls.querySelector('[data-journey-next]');
  const status = controls.querySelector('[data-journey-status]');
  let current = 0;
  let pageCount = cards.length;
  let frame;

  const metrics = () => {
    const style = getComputedStyle(track);
    const gap = Number.parseFloat(style.columnGap || style.gap) || 0;
    const cardWidth = cards[0].getBoundingClientRect().width || 1;
    const visible = Math.max(1, Math.floor((track.clientWidth + gap + 1) / (cardWidth + gap)));
    pageCount = Math.max(1, cards.length - visible + 1);
    return { visible };
  };
  const update = () => {
    if (!carousel.classList.contains('is-active')) return;
    metrics();
    const left = track.scrollLeft;
    current = cards.reduce((best, card, index) => {
      const target = card.offsetLeft - track.offsetLeft;
      return Math.abs(target - left) < Math.abs((cards[best].offsetLeft - track.offsetLeft) - left) ? index : best;
    }, 0);
    current = Math.min(current, pageCount - 1);
    status.textContent = `${current + 1} / ${pageCount}`;
    previous.disabled = current === 0;
    next.disabled = current >= pageCount - 1;
  };
  const goTo = (index) => {
    metrics();
    const target = Math.max(0, Math.min(index, pageCount - 1));
    track.scrollTo({ left: cards[target].offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    current = target;
    status.textContent = `${current + 1} / ${pageCount}`;
    previous.disabled = current === 0;
    next.disabled = current >= pageCount - 1;
  };
  const syncMode = () => {
    const active = mobileQuery.matches || cards.length > 3;
    carousel.classList.toggle('is-active', active);
    if (!active) {
      track.scrollLeft = 0;
      current = 0;
      return;
    }
    requestAnimationFrame(() => goTo(Math.min(current, pageCount - 1)));
  };

  previous.addEventListener('click', () => goTo(current - 1));
  next.addEventListener('click', () => goTo(current + 1));
  carousel.addEventListener('keydown', (event) => {
    if (!carousel.classList.contains('is-active')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current + 1); }
  });
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive: true });
  mobileQuery.addEventListener?.('change', syncMode);
  new ResizeObserver(() => { syncMode(); update(); }).observe(track);
  syncMode();
});

// Progressive enhancement: all articles remain visible without JavaScript.
document.querySelectorAll('[data-guide-index]').forEach((index) => {
  const controls = index.querySelector('[data-guide-filters]');
  const search = index.querySelector('[data-guide-search]');
  const cards = [...index.querySelectorAll('[data-guide-card]')];
  const buttons = [...index.querySelectorAll('[data-guide-filter]')];
  const empty = index.querySelector('[data-guide-empty]');
  const count = index.querySelector('[data-guide-count]');
  const normalize = (value) => value.toLocaleLowerCase(locale).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  let category = 'all';
  controls.hidden = false;
  const render = () => {
    const query = normalize(search.value.trim());
    let found = 0;
    cards.forEach((card) => {
      const matches = (category === 'all' || card.dataset.category === category) && normalize(card.textContent).includes(query);
      card.hidden = !matches;
      if (matches) found++;
    });
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.guideFilter === category)));
    empty.hidden = found !== 0;
    count.hidden = false;
    count.textContent = `${found} ${count.dataset.resultLabel}`;
  };
  buttons.forEach((button) => button.addEventListener('click', () => { category = button.dataset.guideFilter; render(); }));
  search.addEventListener('input', render);
  index.querySelector('[data-guide-reset]').addEventListener('click', () => { category = 'all'; search.value = ''; render(); search.focus(); });
});

/* Tours submenu and the sitewide partnership and credential links. */
(() => {
  const labels = {
    tr: { tours: 'Özel turlar', activities: 'Aktiviteler', open: 'Tur seçeneklerini aç', close: 'Tur seçeneklerini kapat', b2b: 'B2B iş ortaklığı', credential: 'TÜRSAB belge alanı', pending: 'Belge numarası doğrulama bekliyor', details: 'Acente belgelerini incele', activityPath: 'aktiviteler', agencyPath: 'acente-ve-belgeler' },
    en: { tours: 'Private tours', activities: 'Activities', open: 'Open tour options', close: 'Close tour options', b2b: 'B2B partnerships', credential: 'TÜRSAB credentials', pending: 'Certificate number pending verification', details: 'View agency credentials', activityPath: 'activities', agencyPath: 'agency-credentials' },
    es: { tours: 'Tours privados', activities: 'Actividades', open: 'Abrir opciones de tours', close: 'Cerrar opciones de tours', b2b: 'Colaboración B2B', credential: 'Documentación TÜRSAB', pending: 'Número de certificado pendiente de verificación', details: 'Ver documentos de la agencia', activityPath: 'actividades', agencyPath: 'agencia-y-documentos' }
  };
  const copy = labels[locale];
  const nav = document.querySelector('[data-nav-links]');
  if (nav) {
    const toursLink = [...nav.querySelectorAll(':scope > a')].find(a => new URL(a.href).pathname.replace(/\/$/, '').endsWith(locale === 'tr' ? '/turlar' : '/tours'));
    if (toursLink) {
      const group = document.createElement('div');
      group.className = 'nav-tour-group';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'nav-tour-toggle';
      toggle.setAttribute('aria-label', copy.open);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      const submenu = document.createElement('div');
      submenu.className = 'nav-tour-menu';
      submenu.hidden = true;
      const links = [[copy.tours, '/' + locale + '/' + (locale === 'tr' ? 'turlar' : 'tours') + '/'], [copy.activities, '/' + locale + '/' + copy.activityPath + '/']];
      links.forEach(([label, href]) => {
        const a = document.createElement('a');
        a.textContent = label;
        a.href = href;
        submenu.append(a);
      });
      const setOpen = (open) => {
        group.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? copy.close : copy.open);
        submenu.hidden = !open;
      };
      toursLink.before(group);
      group.append(toursLink, toggle, submenu);
      toggle.addEventListener('click', () => setOpen(submenu.hidden));
      group.addEventListener('keydown', event => { if (event.key === 'Escape') { setOpen(false); toggle.focus(); } });
      document.addEventListener('click', event => { if (!group.contains(event.target)) setOpen(false); });
    }
  }
  const footer = document.querySelector('.site-footer');
  if (footer) {
    const company = footer.querySelectorAll('.footer-grid > .footer-col')[1];
    if (company && !company.querySelector('[data-b2b-link]')) {
      const link = document.createElement('a');
      link.href = '/' + locale + '/b2b/';
      link.textContent = copy.b2b;
      link.dataset.b2bLink = '';
      company.append(link);
    }
    const journal = footer.querySelector('.footer-journal');
    if (journal && !footer.querySelector('.footer-credential')) {
      const area = document.createElement('div');
      area.className = 'footer-credential';
      const body = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = copy.credential;
      const pending = document.createElement('span');
      pending.textContent = copy.pending;
      body.append(title, pending);
      const link = document.createElement('a');
      link.href = '/' + locale + '/' + copy.agencyPath + '/';
      link.textContent = copy.details;
      area.append(body, link);
      journal.after(area);
    }
  }
})();



/* Carry an activity choice into the existing journey preview form. */
(() => {
  const activity = new URLSearchParams(window.location.search).get('activity');
  const phrases = {
    tr: { boat: 'Tekne gezisiyle ilgileniyorum.', paragliding: 'Yamaç paraşütüyle ilgileniyorum.', balloon: 'Sıcak hava balonu turuyla ilgileniyorum.', 'food-wine': 'Yeme içme ve şarap mahzeni deneyimiyle ilgileniyorum.' },
    en: { boat: 'I am interested in a boat trip.', paragliding: 'I am interested in paragliding.', balloon: 'I am interested in a hot air balloon tour.', 'food-wine': 'I am interested in food, wine and a wine cellar visit.' },
    es: { boat: 'Me interesa un paseo en barco.', paragliding: 'Me interesa el parapente.', balloon: 'Me interesa un vuelo en globo.', 'food-wine': 'Me interesan la gastronomía, el vino y una visita a una bodega.' }
  };
  const note = phrases[locale]?.[activity];
  if (!note) return;
  const form = document.querySelector('[data-demo-form]');
  const story = form?.querySelector('textarea');
  if (story && !story.value.trim()) story.value = note;
  if (activity === 'food-wine') {
    const choice = [...(form?.querySelectorAll('.choice') || [])].find(label => /wine|şarap|vino/i.test(label.textContent));
    if (choice) choice.querySelector('input').checked = true;
  }
})();

