// Home page. Built from `homeData` plus the shared journeys and pots in data.js.
// The data is hard-coded for now. Later it comes from GET /summary, /status and /journeys.
import { journeys, pots, STATUS, money, esc } from '../data.js';
import { potForJourney } from '../pots-store.js';

const homeData = {
  firstName: 'Lena',
  reclaimed: { year: 46.2, month: 8.4, count: 14, onItsWay: 2.8 },
  lines: [
    { name: 'Central', letter: 'C', status: 'Severe delays', ok: false },
    { name: 'Elizabeth', letter: 'E', status: 'Good service', ok: true },
  ],
};

// ---------- helpers ----------

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// e.g. "Saturday 10 October"
function today() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---------- sections ----------

// Overview card: greeting, a one-line "do I need to do anything?", the total, then 3 small stats.
function overviewHtml({ firstName, reclaimed }) {
  const status = reclaimed.onItsWay > 0
    ? `${money(reclaimed.onItsWay)} is on its way to you. Nothing for you to do.`
    : 'Nothing for you to do today.';

  return `<section class="overview" aria-labelledby="overview-greeting">
    <div class="overview-top">
      <span class="overview-avatar" aria-hidden="true">${esc(firstName[0])}</span>
      <div>
        <h1 id="overview-greeting" class="overview-greeting">${greeting()}, ${esc(firstName)}</h1>
        <p class="overview-date">${today()}</p>
      </div>
    </div>

    <p class="overview-status">
      <span class="overview-status-icon" aria-hidden="true">✓</span>
      ${status}
    </p>

    <div class="overview-total">
      <p class="overview-label">Reclaimed this year</p>
      <p class="overview-amount">${money(reclaimed.year)}</p>
    </div>

    <dl class="overview-stats">
      <div><dt>This month</dt><dd>${money(reclaimed.month)}</dd></div>
      <div><dt>Refunds</dt><dd>${reclaimed.count}</dd></div>
      <div><dt>On its way</dt><dd>${money(reclaimed.onItsWay)}</dd></div>
    </dl>
  </section>`;
}

// Line bullet + name + status word. Status uses an icon AND words, not colour alone.
function linesHtml({ lines }) {
  const rows = lines.map((line) => `<li class="line-row">
      <span class="bt-bullet" aria-hidden="true">${esc(line.letter)}</span>
      <span class="line-name">${esc(line.name)}</span>
      <span class="line-state ${line.ok ? 'is-ok' : 'is-bad'}"><span aria-hidden="true">${line.ok ? '✓' : '!'}</span> ${esc(line.status)}</span>
    </li>`).join('');

  return `<section aria-labelledby="lines-heading">
    <h2 id="lines-heading" class="bt-kicker section-kicker">Your lines now</h2>
    <ul class="line-status">${rows}</ul>
  </section>`;
}

function pillHtml(journey) {
  const s = STATUS[journey.status];
  const amount = journey.amount ? ` ${money(journey.amount)}` : '';
  return `<span class="bt-pill" data-status="${journey.status}">${s.label}${amount}</span>`;
}

// One station-sign card per journey. The top strip colour matches its status.
// A journey refunded into a pot takes the pot's look instead: its colour, name and description.
function journeyCardHtml(j) {
  const pot = potForJourney(j.id);
  if (!pot) {
    return `<li>
      <a class="bt-sign journey" href="#/journey/${esc(j.id)}" style="--line: var(${STATUS[j.status].line})">
        <span class="journey-main">
          <span class="journey-route">${esc(j.route)}</span>
          <span class="journey-meta">${esc(j.mins == null ? 'Incomplete journey · max fare charged' : `${j.line} · ${j.mins} min, usually ${j.usual}`)}</span>
        </span>
        ${pillHtml(j)}
      </a>
    </li>`;
  }
  return `<li>
      <a class="bt-sign journey journey--pot" href="#/pots/${esc(pot.id)}" style="--line: var(${pot.line})">
        <span class="bt-bullet" aria-hidden="true" style="--line: var(${pot.line})">${esc(pot.letter)}</span>
        <span class="journey-main">
          <span class="pot-name">${esc(pot.name)}</span>
          ${pot.description ? `<span class="journey-meta">${esc(pot.description)}</span>` : ''}
          <span class="journey-meta journey-via">${esc(j.route)}</span>
        </span>
        ${pillHtml(j)}
      </a>
    </li>`;
}

function journeysHtml() {
  // The 4 most recent journeys that had a delay (on-time trips are on the Journeys page)
  const recent = journeys.filter((j) => j.status !== 'ontime').slice(0, 4);
  const cards = recent.map(journeyCardHtml).join('');

  return `<section aria-labelledby="journeys-heading">
    <div class="section-head">
      <h2 id="journeys-heading">Recent journeys</h2>
      <a class="text-link" href="#/journeys">All refunds</a>
    </div>
    <ul class="journey-list">${cards}</ul>
  </section>`;
}

function potHtml() {
  const pot = pots[0];
  const percent = Math.round((pot.saved / pot.target) * 100);
  return `<section aria-labelledby="pot-heading">
    <a class="bt-sign pot-card" href="#/pot" style="--line: var(--bt-pink)">
      <span class="pot-top">
        <span class="bt-bullet" aria-hidden="true" style="--line: var(--bt-pink)">T</span>
        <span class="pot-names">
          <span id="pot-heading" class="pot-name">${esc(pot.name)}</span>
          <span class="journey-meta">${esc(pot.goal)}</span>
        </span>
      </span>
      <span class="pot-amount">${money(pot.saved)} <span class="pot-target">of ${money(pot.target)}</span></span>
      <span class="pot-bar" role="progressbar" aria-label="Progress to goal" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
        <span class="pot-fill" style="width: ${percent}%"></span>
      </span>
    </a>
  </section>`;
}

// ---------- page ----------

export default {
  title: 'Home',
  tab: 'home',

  render() {
    return `<main>
        ${overviewHtml(homeData)}
        ${linesHtml(homeData)}
        ${journeysHtml()}
        ${potHtml()}
      </main>`;
  },
};