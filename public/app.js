'use strict';
// Banking app front end. Talks only to the bank backend (/api/...), never to TfL directly.

const state = { me: null, txns: [], draft: null, journey: null, assessment: null, checkTimer: null, pollTimer: null };

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);

/** Build DOM safely (no innerHTML, so API text can't inject markup). */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'value') node.value = value;
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const fmtDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const initials = (s) => s.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Request failed (${res.status})`);
    err.code = data.error?.code;
    err.details = data.error?.details;
    throw err;
  }
  return data;
}

// ---------- sheet ----------
function openSheet(content) {
  $('#backdrop').hidden = false;
  $('#sheet').hidden = false;
  setSheet(content);
}
function setSheet(content) {
  $('#sheet-body').replaceChildren(content);
}
function closeSheet() {
  stopTimers();
  $('#backdrop').hidden = true;
  $('#sheet').hidden = true;
}
function stopTimers() {
  clearTimeout(state.pollTimer);
  clearTimeout(state.checkTimer);
}
const loadingView = (text) => el('div', { class: 'loading' }, el('div', { class: 'spinner' }), text);
const errorBanner = (err) => el('div', { class: 'banner', role: 'alert' },
  err.message,
  err.details?.length ? el('ul', {}, err.details.map((d) => el('li', {}, `${d.field.replace('journey.', '')} ${d.message}`))) : null);

// ---------- transactions ----------
async function loadTransactions() {
  state.txns = await api('/api/transactions');
  renderTransactions();
}

function renderTransactions() {
  const box = $('#txns');
  box.replaceChildren();
  let lastDate = null;
  for (const t of state.txns) {
    if (t.postedDate !== lastDate) {
      box.append(el('div', { class: 'day' }, fmtDay(t.postedDate)));
      lastDate = t.postedDate;
    }
    const wrap = el('div', { class: 'txn-wrap' },
      el('div', { class: 'txn' },
        el('div', { class: `avatar ${t.isTflContactless ? 'tfl' : ''}`, 'aria-hidden': 'true' }, t.isTflContactless ? 'TfL' : initials(t.merchant)),
        el('div', { class: 'txn-main' },
          el('div', { class: 'merchant' }, t.isTflContactless ? 'TfL Travel Charge' : t.merchant),
          el('div', { class: 'meta' }, t.isTflContactless ? `Journeys on ${fmtDay(t.travelDate)}` : t.category)),
        el('div', { class: `amount ${t.amount > 0 ? 'in' : ''}` }, (t.amount > 0 ? '+' : '') + gbp.format(t.amount))));

    if (t.isTflContactless) {
      const actions = el('div', { class: 'txn-actions' });
      if (t.claimIds.length) {
        actions.append(el('button', { class: 'pill-btn', onclick: () => openTracker(t.claimIds.at(-1)) }, 'View refund claim'));
      }
      actions.append(el('button', { class: 'link-btn', onclick: () => openClaim(t) },
        t.claimIds.length ? 'Claim another journey' : 'Delayed? Claim a refund'));
      wrap.append(actions);
    }
    box.append(wrap);
  }
}

// ---------- claim form ----------
async function openClaim(txn) {
  stopTimers();
  openSheet(loadingView('Checking TfL service status for that day…'));
  try {
    const draft = await api('/api/tfl-claims/draft', { method: 'POST', body: { transactionId: txn.id } });
    state.draft = draft;
    state.journey = { ...draft.prefill.journey };
    state.assessment = draft.assessment;
    renderForm();
  } catch (err) {
    setSheet(errorBanner(err));
  }
}

function candidateTag(c) {
  if (!c.disruption) return el('span', { class: 'tag none' }, 'No disruption reported');
  return c.disruption.withinControl
    ? el('span', { class: 'tag pass' }, `${c.disruption.severityDescription} · likely refundable`)
    : el('span', { class: 'tag warn' }, `${c.disruption.severityDescription} · outside TfL's control`);
}

function renderForm() {
  const { draft, journey } = state;
  const { customer, payment } = draft.prefill;
  const txn = draft.transaction;

  const field = (label, input, { full = false, highlight = false } = {}) =>
    el('label', { class: `field ${full ? 'full' : ''} ${highlight ? 'highlight' : ''}` }, label, input);
  const bind = (key, transform = (v) => v) => (e) => {
    state.journey[key] = transform(e.target.value);
    scheduleCheck();
  };

  const lineSelect = el('select', { name: 'line', onchange: bind('line') },
    draft.lines.map((l) => el('option', { value: l.id, selected: l.id === journey.line }, l.label)));

  const view = el('div', {},
    el('h3', {}, 'Claim a delay refund'),
    el('p', { class: 'intro' }, "We've filled in what we know. Check the journey and tell us how late you were."),

    el('div', { class: 'group' }, 'From your Kite account'),
    el('div', { class: 'facts' },
      el('div', { class: 'fact' }, el('span', {}, 'Name'), el('span', {}, customer.name)),
      el('div', { class: 'fact' }, el('span', {}, 'Email'), el('span', {}, customer.email)),
      el('div', { class: 'fact' }, el('span', {}, 'Paid with'), el('span', {}, `Contactless · ${payment.card}`)),
      el('div', { class: 'fact' }, el('span', {}, 'TfL charge'), el('span', {}, `${gbp.format(Math.abs(txn.amount))} for ${fmtDay(txn.travelDate)}`))),

    el('div', { class: 'group' }, 'Which journey was delayed?'),
    el('div', { class: 'candidates', id: 'candidates' },
      draft.candidates.map((c) => el('button', {
        type: 'button',
        class: 'candidate',
        'aria-pressed': String(c.line === journey.line && c.from === journey.from && c.to === journey.to),
        onclick: () => pickCandidate(c),
      },
      el('div', { class: 'c-title' }, `${c.label} · ${c.lineLabel}`),
      el('div', { class: 'c-sub' }, `${c.from} → ${c.to}, usually ${c.usualStart}`),
      candidateTag(c)))),

    el('div', { class: 'group' }, 'Journey details'),
    el('div', { class: 'fields' },
      field('Date', el('input', { type: 'date', name: 'travelDate', value: journey.travelDate, onchange: bind('travelDate') })),
      field('Line', lineSelect),
      field('From', el('input', { name: 'from', value: journey.from, autocomplete: 'off', oninput: bind('from') })),
      field('To', el('input', { name: 'to', value: journey.to, autocomplete: 'off', oninput: bind('to') })),
      field('Started at', el('input', { type: 'time', name: 'plannedStart', value: journey.plannedStart, onchange: bind('plannedStart') })),
      field('Minutes late', el('input', {
        type: 'number', name: 'delayMinutes', min: '1', max: '600', inputmode: 'numeric', placeholder: 'e.g. 25',
        value: journey.delayMinutes ?? '', oninput: bind('delayMinutes', (v) => (v === '' ? null : Number(v))),
      }), { highlight: true })),

    el('div', { class: 'group' }, 'Before you send'),
    el('ul', { class: 'checks', id: 'checks', 'aria-live': 'polite' }),

    el('label', { class: 'consent' },
      el('input', { type: 'checkbox', id: 'consent', onchange: updateSubmit }),
      el('span', {}, draft.consentStatement)),
    el('div', { id: 'form-error' }),
    el('button', { class: 'primary', id: 'submit', disabled: true, onclick: submitClaim }, 'Send claim to TfL'),
    el('p', { class: 'fineprint' }, 'TfL decides every claim using its own records.'));

  setSheet(view);
  renderChecks();
}

function pickCandidate(c) {
  Object.assign(state.journey, { line: c.line, from: c.from, to: c.to, plannedStart: c.usualStart });
  const form = $('#sheet-body');
  form.querySelector('[name=line]').value = c.line;
  form.querySelector('[name=from]').value = c.from;
  form.querySelector('[name=to]').value = c.to;
  form.querySelector('[name=plannedStart]').value = c.usualStart;
  for (const btn of form.querySelectorAll('.candidate')) btn.setAttribute('aria-pressed', 'false');
  form.querySelectorAll('.candidate')[state.draft.candidates.indexOf(c)].setAttribute('aria-pressed', 'true');
  scheduleCheck(0);
  form.querySelector('[name=delayMinutes]').focus();
}

const ICONS = { pass: '✓', warn: '!', fail: '✕', todo: '?' };
function renderChecks() {
  const list = $('#checks');
  if (!list) return;
  list.replaceChildren(...state.assessment.checks.map((c) =>
    el('li', { class: `check ${c.status}` }, el('span', { class: 'icon', 'aria-hidden': 'true' }, ICONS[c.status]), el('span', {}, c.message))));
  updateSubmit();
}

function updateSubmit() {
  const btn = $('#submit');
  if (btn) btn.disabled = !($('#consent')?.checked && state.assessment?.canSubmit);
}

function scheduleCheck(delay = 350) {
  clearTimeout(state.checkTimer);
  const btn = $('#submit');
  if (btn) btn.disabled = true;
  state.checkTimer = setTimeout(async () => {
    $('#form-error')?.replaceChildren();
    try {
      state.assessment = await api('/api/tfl-claims/check', { method: 'POST', body: { draftId: state.draft.draftId, journey: state.journey } });
      renderChecks();
    } catch (err) {
      state.assessment = { ...state.assessment, canSubmit: false };
      $('#form-error')?.replaceChildren(errorBanner(err));
      updateSubmit();
    }
  }, delay);
}

async function submitClaim(e) {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Sending to TfL…';
  $('#form-error').replaceChildren();
  try {
    const claim = await api('/api/tfl-claims', {
      method: 'POST',
      body: { draftId: state.draft.draftId, journey: state.journey, consent: { accepted: true } },
    });
    await loadTransactions();
    openTracker(claim.id, claim);
  } catch (err) {
    $('#form-error').replaceChildren(errorBanner(err));
    btn.textContent = 'Send claim to TfL';
    updateSubmit();
  }
}

// ---------- claim tracker ----------
function openTracker(claimId, initial) {
  stopTimers();
  if ($('#sheet').hidden) openSheet(loadingView('Loading claim…'));
  if (initial) setSheet(trackerView(initial));
  poll(claimId, initial ? 1500 : 0);
}

function poll(claimId, delay) {
  state.pollTimer = setTimeout(async () => {
    try {
      const claim = await api(`/api/tfl-claims/${encodeURIComponent(claimId)}`);
      setSheet(trackerView(claim));
      if (claim.status === 'approved' || claim.status === 'rejected') return;
      poll(claimId, 1500);
    } catch (err) {
      setSheet(errorBanner(err));
    }
  }, delay);
}

function trackerView(claim) {
  const decided = claim.status === 'approved' || claim.status === 'rejected';
  const reached = new Set(claim.timeline.map((t) => t.status));
  const at = (s) => {
    const entry = claim.timeline.find((t) => t.status === s);
    return entry ? new Date(entry.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  };
  const step = (key, title, sub, done) => el('li', { class: `step ${done ? 'done' : ''} ${!done && !decided ? 'current' : ''}` },
    el('span', { class: 'dot', 'aria-hidden': 'true' }, done ? '✓' : ''),
    el('div', {}, el('div', { class: 's-title' }, title), el('div', { class: 's-sub' }, done && at(key) ? `${sub} · ${at(key)}` : sub)));

  const j = claim.journey;
  return el('div', {},
    el('h3', {}, 'Refund claim sent'),
    el('p', { class: 'intro' }, `Reference ${claim.id} · ${j.from} → ${j.to}, ${fmtDay(j.travelDate)} at ${j.plannedStart}`),
    el('ol', { class: 'steps' },
      step('received', 'Received by TfL', 'Claim submitted', reached.has('received')),
      step('under_review', 'Under review', 'TfL is checking its service records', reached.has('under_review')),
      step(claim.status, 'Decision', decided ? 'TfL has decided' : 'Usually up to 10 working days (seconds in this demo)', decided)),
    decided ? resultCard(claim) : null);
}

function resultCard(claim) {
  const d = claim.decision;
  if (claim.status === 'approved') {
    return el('div', { class: 'result approved' },
      el('p', {}, 'Refund approved'),
      el('div', { class: 'big' }, gbp.format(d.refund.amount)),
      el('p', {}, `Back to your card ending ${d.refund.last4} by ${fmtDay(d.refund.expectedBy)}.`));
  }
  return el('div', { class: 'result rejected' },
    el('p', {}, el('strong', {}, 'Claim not accepted')),
    el('p', {}, d.message),
    el('p', {}, 'If you think this is wrong, you can appeal to TfL by phone on 0343 222 1234 or through its Help & Contacts page.'));
}

// ---------- start ----------
$('#backdrop').addEventListener('click', closeSheet);
$('#close').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

(async function init() {
  try {
    state.me = await api('/api/me');
    $('#greeting').textContent = `Hello, ${state.me.name.split(' ')[0]}`;
    const card = state.me.cards[0];
    $('#card-label').textContent = `${card.label} •••• ${card.last4}`;
    await loadTransactions();
  } catch (err) {
    $('#txns').replaceChildren(errorBanner(err));
  }
})();
