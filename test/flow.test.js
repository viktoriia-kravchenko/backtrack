'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockTflServer } = require('../mock-tfl/server');
const { createBankServer } = require('../bank/server');
const { daysAgo } = require('../lib/dates');

const DECISION_MS = 150;
let tfl;
let bank;
let bankUrl;
let tflUrl;

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(base, method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
const bankCall = (method, path, body) => call(bankUrl, method, path, body);

async function draftForTravelDay(n) {
  const { body: txns } = await bankCall('GET', '/api/transactions');
  const txn = txns.find((t) => t.isTflContactless && t.travelDate === daysAgo(n));
  assert.ok(txn, `no TfL charge for travel ${n} days ago`);
  const { status, body } = await bankCall('POST', '/api/tfl-claims/draft', { transactionId: txn.id });
  assert.equal(status, 201);
  return body;
}

async function submit(draft, delayMinutes, overrides = {}) {
  return bankCall('POST', '/api/tfl-claims', {
    draftId: draft.draftId,
    journey: { ...draft.prefill.journey, delayMinutes, ...overrides },
    consent: { accepted: true },
  });
}

test.before(async () => {
  tfl = createMockTflServer({ decisionDelayMs: DECISION_MS });
  await listen(tfl);
  tflUrl = `http://127.0.0.1:${tfl.address().port}`;
  bank = createBankServer({ tflBaseUrl: tflUrl });
  await listen(bank);
  bankUrl = `http://127.0.0.1:${bank.address().port}`;
});

test.after(() => {
  tfl.close();
  bank.close();
});

test('serves the banking app and every script, stylesheet and page it loads', async () => {
  const home = await fetch(`${bankUrl}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<title>Backtrack<\/title>/);

  const assets = [
    '/main.js', '/backtrack.css', '/logo.svg', '/api.js', '/data.js', '/journeys.js', '/pots-store.js',
    '/components/navbar.js', '/components/menu.js',
    '/pages/loading.js', '/pages/home.js', '/pages/journeys.js', '/pages/refund.js', '/pages/pots.js', '/pages/lines.js',
  ];
  for (const path of assets) {
    const res = await fetch(bankUrl + path);
    assert.equal(res.status, 200, `${path} should be served`);
  }
});

test('profile exposes name, email and cards without card tokens', async () => {
  const { status, body } = await bankCall('GET', '/api/me');
  assert.equal(status, 200);
  assert.equal(body.name, 'Lena Oxton');
  assert.equal(body.cards[0].last4, '4821');
  assert.equal(JSON.stringify(body).includes('tok_'), false);
});

test('transactions mark TfL charges with a travel date one day before posting', async () => {
  const { body: txns } = await bankCall('GET', '/api/transactions');
  const tfl = txns.filter((t) => t.isTflContactless);
  assert.ok(tfl.length >= 6, 'demo data has TfL charges');
  for (const t of tfl) {
    assert.ok(t.travelDate, 'TfL charge has a travel date');
    assert.deepEqual(t.claimIds, t.claimIds.filter(Boolean));
  }
  assert.ok(txns.some((t) => !t.isTflContactless && t.travelDate === undefined));
});

test('only TfL charges can start a claim, and unknown ones are 404', async () => {
  const { body: txns } = await bankCall('GET', '/api/transactions');
  const other = txns.find((t) => !t.isTflContactless);
  const notTfl = await bankCall('POST', '/api/tfl-claims/draft', { transactionId: other.id });
  assert.equal(notTfl.status, 422);
  assert.equal(notTfl.body.error.code, 'NOT_A_TFL_CHARGE');

  const missing = await bankCall('POST', '/api/tfl-claims/draft', { transactionId: 'nope' });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'TRANSACTION_NOT_FOUND');
});

test('draft ranks saved journeys with the in-control disruption first', async () => {
  const draft = await draftForTravelDay(2);
  assert.ok(draft.candidates.length > 1);
  assert.equal(draft.candidates[0].line, 'victoria');
  assert.equal(draft.candidates[0].disruption.withinControl, true);
  assert.equal(draft.candidates[0].line, draft.prefill.journey.line);
  assert.ok(draft.lines.some((l) => l.id === 'victoria'));
  assert.match(draft.consentStatement, /TfL/);
});

test('unknown drafts and claims are 404', async () => {
  const check = await bankCall('POST', '/api/tfl-claims/check', { draftId: 'drf_nope', journey: {} });
  assert.equal(check.status, 404);
  assert.equal(check.body.error.code, 'DRAFT_NOT_FOUND');

  const submitted = await bankCall('POST', '/api/tfl-claims', { draftId: 'drf_nope', consent: { accepted: true }, journey: {} });
  assert.equal(submitted.status, 404);

  const claim = await bankCall('GET', '/api/tfl-claims/clm_nope');
  assert.equal(claim.status, 404);
  assert.equal(claim.body.error.code, 'CLAIM_NOT_FOUND');
});

test('draft is prefilled from bank data and picks the disrupted journey', async () => {
  const draft = await draftForTravelDay(2);
  assert.equal(draft.prefill.customer.name, 'Lena Oxton');
  assert.equal(draft.prefill.payment.card, 'Visa Debit •••• 4821');
  assert.equal(JSON.stringify(draft).includes('tok_'), false, 'card token must not reach the browser');
  assert.equal(draft.prefill.journey.travelDate, daysAgo(2));
  assert.equal(draft.prefill.journey.line, 'victoria');
  assert.equal(draft.prefill.journey.delayMinutes, null);
  const byId = Object.fromEntries(draft.assessment.checks.map((c) => [c.id, c.status]));
  assert.deepEqual(byId, { window: 'pass', delay: 'todo', cause: 'pass' });
  assert.equal(draft.assessment.canSubmit, false);
});

test('eligible Victoria line claim is approved, and resubmitting is idempotent', async () => {
  const draft = await draftForTravelDay(2);
  const first = await submit(draft, 25);
  assert.equal(first.status, 201);
  assert.equal(first.body.status, 'received');

  const again = await submit(draft, 25);
  assert.equal(again.status, 200);
  assert.equal(again.body.id, first.body.id);

  await sleep(DECISION_MS + 50);
  const { body: claim } = await bankCall('GET', `/api/tfl-claims/${first.body.id}`);
  assert.equal(claim.status, 'approved');
  assert.equal(claim.decision.refund.last4, '4821');
  assert.deepEqual(claim.timeline.map((t) => t.status), ['received', 'under_review', 'approved']);

  const { body: txns } = await bankCall('GET', '/api/transactions');
  assert.ok(txns.find((t) => t.travelDate === daysAgo(2)).claimIds.includes(first.body.id));

  const dupDraft = await draftForTravelDay(2);
  const dup = await submit(dupDraft, 25);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'DUPLICATE_CLAIM');
});

test('Elizabeth line needs 30 minutes; 31 minutes is approved', async () => {
  const draft = await draftForTravelDay(12);
  assert.equal(draft.prefill.journey.line, 'elizabeth');
  const short = await submit(draft, 20);
  assert.equal(short.status, 422);
  assert.equal(short.body.error.code, 'DELAY_BELOW_THRESHOLD');
  const ok = await submit(draft, 31);
  assert.equal(ok.status, 201);
  await sleep(DECISION_MS + 50);
  assert.equal((await bankCall('GET', `/api/tfl-claims/${ok.body.id}`)).body.status, 'approved');
});

test('customer incident is flagged up front and rejected by TfL', async () => {
  const draft = await draftForTravelDay(5);
  assert.equal(draft.prefill.journey.line, 'northern');
  assert.equal(draft.assessment.checks.find((c) => c.id === 'cause').status, 'warn');
  const res = await submit(draft, 20);
  assert.equal(res.status, 201);
  await sleep(DECISION_MS + 50);
  const { body } = await bankCall('GET', `/api/tfl-claims/${res.body.id}`);
  assert.equal(body.status, 'rejected');
  assert.equal(body.decision.reasonCode, 'OUTSIDE_TFL_CONTROL');
});

test('strike day is rejected as outside TfL control', async () => {
  const draft = await draftForTravelDay(9);
  const res = await submit(draft, 40);
  await sleep(DECISION_MS + 50);
  const { body } = await bankCall('GET', `/api/tfl-claims/${res.body.id}`);
  assert.equal(body.decision.reasonCode, 'OUTSIDE_TFL_CONTROL');
});

test('no reported disruption leads to a rejection', async () => {
  const draft = await draftForTravelDay(1);
  assert.equal(draft.assessment.checks.find((c) => c.id === 'cause').status, 'warn');
  const res = await submit(draft, 20);
  await sleep(DECISION_MS + 50);
  const { body } = await bankCall('GET', `/api/tfl-claims/${res.body.id}`);
  assert.equal(body.decision.reasonCode, 'NO_DISRUPTION_RECORDED');
});

test('journeys older than 28 days are blocked', async () => {
  const draft = await draftForTravelDay(40);
  assert.equal(draft.assessment.checks.find((c) => c.id === 'window').status, 'fail');
  const res = await submit(draft, 25);
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'CLAIM_WINDOW_EXPIRED');
});

test('check endpoint re-assesses edited journeys', async () => {
  const draft = await draftForTravelDay(2);
  const { body } = await bankCall('POST', '/api/tfl-claims/check', {
    draftId: draft.draftId,
    journey: { ...draft.prefill.journey, plannedStart: '14:00', delayMinutes: 10 },
  });
  const byId = Object.fromEntries(body.checks.map((c) => [c.id, c.status]));
  assert.deepEqual(byId, { window: 'pass', delay: 'fail', cause: 'warn' });
  assert.equal(body.canSubmit, false);
});

test('consent and valid input are required', async () => {
  const draft = await draftForTravelDay(2);
  const noConsent = await bankCall('POST', '/api/tfl-claims', { draftId: draft.draftId, journey: { ...draft.prefill.journey, delayMinutes: 25 } });
  assert.equal(noConsent.status, 400);
  assert.equal(noConsent.body.error.code, 'CONSENT_REQUIRED');

  const bad = await submit(draft, 25, { line: 'not-a-line', plannedStart: '25:99' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'INVALID_JOURNEY');
  assert.deepEqual(bad.body.error.details.map((d) => d.field).sort(), ['journey.line', 'journey.plannedStart']);
});

test('mock TfL API rejects calls without the partner key', async () => {
  const res = await call(tflUrl, 'POST', '/v1/service-delay-refunds', {}, { 'Idempotency-Key': 'x' });
  assert.equal(res.status, 401);
});

test('mock line status matches the Unified API shape', async () => {
  const d = daysAgo(2);
  const { body } = await call(tflUrl, 'GET', `/Line/victoria,jubilee/Status/${d}T00:00:00/to/${d}T23:59:59`);
  assert.equal(body.length, 2);
  assert.equal(body[0].lineStatuses[0].statusSeverityDescription, 'Severe Delays');
  assert.equal(body[1].lineStatuses[0].statusSeverity, 10);
});
