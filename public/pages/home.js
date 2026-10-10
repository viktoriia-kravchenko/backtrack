// Home page. Built from `homeData`.
// The data is hard-coded for now. Later it comes from GET /summary, /status and /journeys.

const homeData = {
  firstName: 'Alex',
  reclaimed: { year: 46.2, month: 8.4, count: 14, onItsWay: 2.8 },
  lines: [
    { name: 'Central', letter: 'C', status: 'Severe delays', ok: false },
    { name: 'Elizabeth', letter: 'E', status: 'Good service', ok: true },
  ],
  journeys: [
    { id: 'j1', route: 'Bank → Stratford', meta: 'Central · 41 min, usually 17', status: 'eligible', amount: 2.8 },
    { id: 'j2', route: 'Liverpool St → Farringdon', meta: 'Elizabeth · 38 min, usually 4', status: 'paid', amount: 2.8 },
    { id: 'j3', route: "King's Cross, no tap out", meta: 'Incomplete journey · max fare charged', status: 'paid', amount: 5.2 },
    { id: 'j4', route: 'Canning Town → Bank', meta: "DLR · strike is outside TfL's control", status: 'none' },
  ],
  pot: { name: 'Treat Yourself', goal: 'Weekend in Brighton', saved: 36.96, target: 150 },
};

// Each status has a word (never colour alone) and a line colour for the card's top strip.
const STATUS = {
  eligible: { label: 'Eligible', line: '--bt-yellow' },
  claimed: { label: 'Claimed', line: '--bt-orange' },
  paid: { label: 'Paid', line: '--bt-green' },
  none: { label: 'Not eligible', line: '--bt-red' },
};

// ---------- helpers ----------

const money = (n) => `£${n.toFixed(2)}`;

// Makes text safe to put inside HTML. Matters once data comes from the server.
const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

// ---------- sections ----------

function reclaimedHtml({ reclaimed }) {
  return `<section class="reclaimed" aria-labelledby="reclaimed-label">
    <p id="reclaimed-label" class="bt-kicker">Reclaimed this year</p>
    <p class="bt-board">${money(reclaimed.year)}</p>
    <p class="reclaimed-sub">${money(reclaimed.month)} this month · ${reclaimed.count} refunds</p>
    <p class="reclaimed-coming">${money(reclaimed.onItsWay)} on its way</p>
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
function journeysHtml({ journeys }) {
  const cards = journeys.map((j) => `<li>
      <a class="bt-sign journey" href="#/journey/${esc(j.id)}" style="--line: var(${STATUS[j.status].line})">
        <span class="journey-main">
          <span class="journey-route">${esc(j.route)}</span>
          <span class="journey-meta">${esc(j.meta)}</span>
        </span>
        ${pillHtml(j)}
      </a>
    </li>`).join('');

  return `<section aria-labelledby="journeys-heading">
    <div class="section-head">
      <h2 id="journeys-heading">Recent journeys</h2>
      <a class="text-link" href="#/journeys">All refunds</a>
    </div>
    <ul class="journey-list">${cards}</ul>
  </section>`;
}

function potHtml({ pot }) {
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
        <h1 class="greeting">${greeting()}, ${esc(homeData.firstName)}</h1>
        ${reclaimedHtml(homeData)}
        <hr class="bt-rule">
        ${linesHtml(homeData)}
        ${journeysHtml(homeData)}
        ${potHtml(homeData)}
      </main>`;
  },
};