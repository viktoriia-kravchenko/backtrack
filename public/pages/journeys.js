// Journeys page: every journey, newest first, with its refund status.
// Filter chips at the top narrow the list (All, Paid, In progress, Not eligible, On time).
// Tapping a journey opens its refund page (pages/refund.js).
import { journeys, STATUS, money, esc } from '../data.js';

// The filter chips, and which statuses each one shows.
const FILTERS = [
  { id: 'all', label: 'All', statuses: ['eligible', 'claimed', 'paid', 'none', 'ontime'] },
  { id: 'paid', label: 'Paid', statuses: ['paid'] },
  { id: 'progress', label: 'In progress', statuses: ['eligible', 'claimed'] },
  { id: 'none', label: 'Not eligible', statuses: ['none'] },
  { id: 'ontime', label: 'On time', statuses: ['ontime'] },
];

let currentFilter = 'all'; // remembered while you move between pages

const sum = (list) => list.reduce((total, j) => total + (j.amount || 0), 0);

function countFor(filter) {
  return journeys.filter((j) => filter.statuses.includes(j.status)).length;
}

// ---------- sections ----------

// Totals at the top: what's been paid back, and what's still on the way.
function summaryHtml() {
  const paid = sum(journeys.filter((j) => j.status === 'paid'));
  const pending = sum(journeys.filter((j) => j.status === 'eligible' || j.status === 'claimed'));
  return `<dl class="journeys-summary">
    <div><dt>Reclaimed</dt><dd>${money(paid)}</dd></div>
    <div><dt>On the way</dt><dd>${money(pending)}</dd></div>
    <div><dt>Journeys</dt><dd>${journeys.length}</dd></div>
  </dl>`;
}

function chipsHtml() {
  const chips = FILTERS.map((f) => `<button type="button" class="bt-chip" data-filter="${f.id}" aria-pressed="${f.id === currentFilter}">
      ${f.label} <span class="bt-chip-count">${countFor(f)}</span>
    </button>`).join('');
  return `<div class="bt-chips" role="group" aria-label="Filter journeys">${chips}</div>`;
}

function journeyCardHtml(j) {
  const s = STATUS[j.status];
  const time = j.mins == null ? 'No tap out' : `${j.mins} min (usually ${j.usual})`;
  const amount = j.amount && j.status !== 'none' ? ` ${money(j.amount)}` : '';
  return `<li>
    <a class="bt-sign journey-card" href="#/journey/${esc(j.id)}" style="--line: var(${s.line})">
      <span class="journey-card-top">
        <span class="journey-route">${esc(j.route)}</span>
        <span class="bt-pill" data-status="${j.status}">${s.label}${amount}</span>
      </span>
      <span class="journey-meta">${esc(j.line)} · ${esc(j.date)} · ${time}</span>
      ${j.note ? `<span class="journey-note">${esc(j.note)}</span>` : ''}
    </a>
  </li>`;
}

// The list, split into "This week", "Last week", "Earlier".
function resultsHtml() {
  const filter = FILTERS.find((f) => f.id === currentFilter);
  const shown = journeys.filter((j) => filter.statuses.includes(j.status));

  if (shown.length === 0) {
    return '<p class="journeys-empty">No journeys here. Nothing owed, nothing to do.</p>';
  }

  const groups = [...new Set(shown.map((j) => j.group))];
  return groups.map((group) => {
    const id = `group-${group.replace(/\s/g, '')}`;
    return `<section aria-labelledby="${id}">
      <h2 id="${id}" class="bt-kicker section-kicker">${group}</h2>
      <ul class="journey-list">${shown.filter((j) => j.group === group).map(journeyCardHtml).join('')}</ul>
    </section>`;
  }).join('');
}

// ---------- page ----------

export default {
  title: 'Journeys',
  tab: 'journeys',

  render() {
    return `<main>
        <header class="page-head">
          <h1 class="greeting">Journeys</h1>
          <p class="page-intro">Every tap from the last 4 weeks, and what happened to it.</p>
        </header>
        ${summaryHtml()}
        ${chipsHtml()}
        <p class="visually-hidden" id="journeys-live" role="status"></p>
        <div class="journeys-results" id="journeys-results">${resultsHtml()}</div>
      </main>`;
  },

  // Runs after the page is on screen: makes the filter chips work.
  afterRender(root) {
    const results = root.querySelector('#journeys-results');
    const live = root.querySelector('#journeys-live');

    for (const chip of root.querySelectorAll('.bt-chip')) {
      chip.addEventListener('click', () => {
        currentFilter = chip.dataset.filter;
        for (const other of root.querySelectorAll('.bt-chip')) {
          other.setAttribute('aria-pressed', String(other === chip));
        }
        results.innerHTML = resultsHtml();
        // Tell screen reader users how many journeys are now showing
        const count = countFor(FILTERS.find((f) => f.id === currentFilter));
        live.textContent = `Showing ${count} ${count === 1 ? 'journey' : 'journeys'}`;
      });
    }
  },
};