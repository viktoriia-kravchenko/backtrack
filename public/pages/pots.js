// Pots page. Each pot collects the refunds TfL has paid back.
//   #/pots        → first pot (or the "create your first pot" screen when there are none)
//   #/pots/<id>   → that pot
//   #/pots/demo   → demo pots with refunds (never saved)
//   #/pots/empty  → the 0-pots screen, even if you have pots (nothing is deleted)
// Pots are created here with the "New pot" form. This is the only place to create one.
import { getPots, addPot, nextLine, total, grandTotal, DEMO_POTS } from '../pots-store.js';

// ---------- helpers ----------

const money = (n) => `£${n.toFixed(2)}`;

// Makes text safe to put inside HTML. Matters once data comes from the server.
const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Coin with a £ sign. `extra` adds the small "+" badge.
const coin = (size, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="13" r="8"/><path d="M13.5 10a2.5 2.5 0 0 0-4.5 1.5V17M7.5 17h7M7.5 13.5h4.5"/>${extra}</svg>`;
const coinPlus = (size) => coin(size, '<path d="M19 3v6M16 6h6"/>');

// The pots on screen. Set on every render so the click handlers see the same list.
let list = [];
let demo = false;
const findPot = (id) => list.find((p) => p.id === id) || list[0];

// ---------- sections ----------

function totalHtml() {
  return `<section class="pots-total" aria-labelledby="pots-total-label">
    <p id="pots-total-label" class="bt-kicker">Total secured</p>
    <p class="bt-board">${money(grandTotal(list))}</p>
    <p class="pots-total-note">Money TfL has paid back to you across all your pots</p>
  </section>`;
}

// Shown when there are no pots yet.
function emptyHtml() {
  return `<section class="pots-empty" aria-labelledby="pots-empty-title">
    <span class="pots-empty-icon">${coinPlus(96)}</span>
    <h2 id="pots-empty-title">Save your refunds for something big</h2>
    <p>Make a pot for a trip, a treat or a rainy day. Every time TfL pays you back, it can land here.</p>
    <button type="button" class="bt-btn bt-btn--green pots-create" data-new-pot>${coinPlus(24)}<span>Create your first pot</span></button>
  </section>`;
}

function tabHtml(pot, selected, single) {
  const active = pot.id === selected.id;
  return `<li${single ? ' class="is-single"' : ''}>
      <button type="button" class="bt-sign pot-tab${active ? ' is-active' : ''}" role="tab" id="tab-${esc(pot.id)}"
        data-pot="${esc(pot.id)}" aria-selected="${active}" aria-controls="pot-panel" tabindex="${active ? 0 : -1}"
        style="--line: var(${pot.line})">
        <span class="bt-bullet" aria-hidden="true" style="--line: var(${pot.line})">${esc(pot.letter)}</span>
        <span>
          <span class="pot-name">${esc(pot.name)}</span>
          <span class="pot-tab-total">${money(total(pot))} refunded</span>
        </span>
      </button>
    </li>`;
}

// Last item in the carousel: opens the same form as the empty-state button.
function newTabHtml() {
  return `<li>
      <button type="button" class="pot-tab pot-tab--new" data-new-pot>
        <span aria-hidden="true" class="pot-new-plus">+</span>
        <span>New pot</span>
      </button>
    </li>`;
}

function panelHtml(pot) {
  const head = `<div class="pot-panel-head" style="--line: var(${pot.line})">
      <p class="bt-kicker">${esc(pot.description || pot.name)}</p>
      <p class="bt-board">${money(total(pot))}</p>`;

  if (pot.refunds.length === 0) {
    return `${head}
      <p class="journey-meta" style="color: var(--bt-soft)">No refunds yet</p>
    </div>
    <div class="pot-empty-card">
      ${coin(40)}
      <p class="pot-empty-title">Nothing here yet</p>
      <p>When TfL refunds a delayed journey, it will show up in this pot.</p>
    </div>`;
  }

  const rows = pot.refunds.map((r) => `<li>
      <div class="bt-sign journey" style="--line: var(--bt-green)">
        <span class="journey-main">
          <span class="journey-route">${esc(r.route)}</span>
          <span class="journey-meta">${esc(r.meta)} · ${esc(r.date)}</span>
        </span>
        <span class="bt-pill" data-status="paid">Refunded ${money(r.amount)}</span>
      </div>
    </li>`).join('');

  return `${head}
      <p class="journey-meta" style="color: var(--bt-soft)">${pot.refunds.length} delay refunds from TfL</p>
    </div>
    <ul class="journey-list">${rows}</ul>`;
}

// The "New pot" form, in a native <dialog> (Escape closes it, focus stays inside it).
function dialogHtml() {
  return `<dialog class="bt-dialog" id="new-pot-dialog" aria-labelledby="new-pot-title">
    <form class="bt-dialog-form" novalidate>
      <h2 id="new-pot-title">New pot</h2>
      <p class="bt-dialog-sub">Give it a name so you know what you're saving for.</p>

      <div class="bt-sign pot-tab is-active pot-preview" aria-hidden="true">
        <span class="bt-bullet" data-preview-letter>+</span>
        <span>
          <span class="pot-name" data-preview-name>Your pot</span>
          <span class="pot-tab-total">£0.00 refunded</span>
        </span>
      </div>

      <div class="bt-field">
        <label for="pot-name">Name</label>
        <input id="pot-name" name="name" type="text" maxlength="24" autocomplete="off" placeholder="e.g. Summer trip" required aria-describedby="pot-name-error">
        <p class="bt-field-error" id="pot-name-error" role="alert"></p>
      </div>
      <div class="bt-field">
        <label for="pot-description">What are you saving for? <span class="bt-optional">(optional)</span></label>
        <input id="pot-description" name="description" type="text" maxlength="60" autocomplete="off" placeholder="e.g. Weekend in Brighton">
      </div>

      <div class="bt-dialog-actions">
        <button type="submit" class="bt-btn bt-btn--green">Create pot</button>
        <button type="button" class="bt-btn bt-btn--ghost" data-cancel>Cancel</button>
      </div>
    </form>
  </dialog>`;
}

// ---------- page ----------

export default {
  title: 'Pots',
  tab: 'pots',

  render(id) {
    demo = id === 'demo';
    list = demo ? DEMO_POTS : id === 'empty' ? [] : getPots();
    const selected = findPot(id);

    let body = emptyHtml();
    if (list.length > 0) {
      const single = list.length === 1;
      body = `<ul class="pot-carousel" role="tablist" aria-label="Pots">${list.map((p) => tabHtml(p, selected, single)).join('')}${demo ? '' : newTabHtml()}</ul>
        <section class="pot-panel" id="pot-panel" role="tabpanel" aria-labelledby="tab-${esc(selected.id)}">
          ${panelHtml(selected)}
        </section>`;
    }

    return `<main>
        <h1 class="greeting">Pots</h1>
        ${totalHtml()}
        ${body}
      </main>
      ${demo ? '' : dialogHtml()}`;
  },

  afterRender(app) {
    wireDialog(app);

    const carousel = app.querySelector('.pot-carousel');
    if (!carousel) return;
    const tabs = [...carousel.querySelectorAll('[role="tab"]')];
    const panel = app.querySelector('#pot-panel');

    // Switch pots in place (no full re-render), so the carousel keeps its scroll and animates.
    function select(tab, { focus = false } = {}) {
      const pot = findPot(tab.dataset.pot);
      for (const t of tabs) {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
      }
      panel.setAttribute('aria-labelledby', tab.id);
      panel.innerHTML = panelHtml(pot);
      panel.classList.remove('is-entering');
      void panel.offsetWidth; // restarts the animation
      panel.classList.add('is-entering');
      if (!demo) history.replaceState(null, '', `#/pots/${pot.id}`); // deep link, without triggering a re-render
      tab.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      if (focus) tab.focus({ preventScroll: true });
    }

    carousel.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab && !tab.classList.contains('is-active')) select(tab);
    });

    carousel.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      const index = tabs.indexOf(document.activeElement);
      if (!step || index < 0) return;
      const next = tabs[index + step];
      if (next) {
        e.preventDefault();
        select(next, { focus: true });
      }
    });
  },
};

// Opens the form from any [data-new-pot] button, checks the name, creates the pot.
function wireDialog(app) {
  const dialog = app.querySelector('#new-pot-dialog');
  if (!dialog) return;
  const form = dialog.querySelector('form');
  const name = form.elements.name;
  const error = dialog.querySelector('#pot-name-error');
  const preview = dialog.querySelector('.pot-preview');
  let opener = null;

  const updatePreview = () => {
    const text = name.value.trim();
    preview.style.setProperty('--line', `var(${nextLine()})`);
    preview.querySelector('.bt-bullet').style.setProperty('--line', `var(${nextLine()})`);
    preview.querySelector('[data-preview-letter]').textContent = text ? text.charAt(0).toUpperCase() : '+';
    preview.querySelector('[data-preview-name]').textContent = text || 'Your pot';
  };

  const showError = (message) => {
    error.textContent = message;
    name.toggleAttribute('aria-invalid', Boolean(message));
  };

  for (const button of app.querySelectorAll('[data-new-pot]')) {
    button.addEventListener('click', () => {
      opener = button;
      form.reset();
      showError('');
      updatePreview();
      dialog.showModal();
    });
  }

  dialog.addEventListener('close', () => opener?.focus());
  dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // dimmed area
  name.addEventListener('input', () => { showError(''); updatePreview(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!name.value.trim()) {
      showError('Add a name for your pot');
      name.focus();
      return;
    }
    const pot = addPot({ name: name.value, description: form.elements.description.value });
    opener = null; // the page is about to re-render, so there's nothing to give focus back to
    dialog.close();
    location.hash = `#/pots/${pot.id}`; // main.js re-renders with the new pot selected
    window.Backtrack.toast?.('Pot created');
  });
}
