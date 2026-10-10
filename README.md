# TfL delay refunds from a banking app (hackathon prototype)

A customer taps **"Delayed? Claim a refund"** on a TfL contactless charge in their banking app.
The bank prefills the claim from what it already knows, checks it against TfL's rules and line
status, and sends it to TfL with the customer's consent. The app then tracks the claim to a decision.

> **TfL has no public API for refund claims.** The refund API here is a mock of what a
> bank-TfL partnership could look like. Nothing is sent to the real TfL.

## Run it

Needs Node 18+. No dependencies to install.

```bash
npm start   # banking app on http://localhost:3000, mock TfL on http://localhost:4001
npm test    # 12 end-to-end tests
```

Demo data is relative to today, so it always works:

| TfL charge for travel… | What happens |
|---|---|
| 2 days ago (Victoria line, signal failure) | Approved |
| 12 days ago (Elizabeth line, faulty train) | Approved if 30+ minutes late |
| 5 days ago (Northern line, customer incident) | Warned up front, then rejected |
| 9 days ago (Victoria line, strike) | Warned up front, then rejected |
| 1 day ago (no disruption) | Warned up front, then rejected |
| 40 days ago | Blocked: outside the 28-day window |

`DECISION_DELAY_MS` controls how long the mock takes to decide (default 8 seconds).

## How it fits together

```
Browser (public/)          Bank backend (bank/)                 Mock TfL (mock-tfl/)
-----------------          --------------------                 --------------------
tap "Claim a refund" ──►  POST /api/tfl-claims/draft
                           · profile, card, charge date   ──►  GET /Line/{id}/Status/{from}/to/{to}
                           · ranks saved journeys by           (same shape as the real Unified API)
                             reported disruptions
edit journey, delay   ──►  POST /api/tfl-claims/check   (eligibility pre-check)
consent + send        ──►  POST /api/tfl-claims         ──►  POST /v1/service-delay-refunds
                           · adds card token server-side      (partner key + Idempotency-Key)
status tracker        ──►  GET  /api/tfl-claims/:id     ──►  GET  /v1/service-delay-refunds/:id
```

The browser never talks to TfL and never sees the card token.

## What the bank can and can't prefill

| Field | Source |
|---|---|
| Name, email | Bank profile |
| Payment card | Card token + last 4 digits (never the card number) |
| Travel date | Statement date minus 1 day. TfL adds up a day's contactless journeys and usually charges the next day. The customer can change it. |
| Line, stations, start time | **Not on the statement.** Suggested from the customer's saved journeys, ranked by which one TfL reported as disrupted that day. |
| Minutes late | Only the customer knows. They must enter it. |

## Mock TfL refund API

`POST /v1/service-delay-refunds`

Headers: `Authorization: Bearer <partner key>`, `Idempotency-Key: <unique per claim>`

```json
{
  "partnerReference": "drf_…",
  "customer": { "name": "Alex Morgan", "email": "alex.morgan@example.com" },
  "payment": { "method": "contactless", "cardToken": "tok_…", "last4": "4821" },
  "journey": {
    "travelDate": "2026-10-08", "line": "victoria",
    "from": "Highbury & Islington", "to": "Oxford Circus",
    "plannedStart": "08:10", "delayMinutes": 25
  },
  "consent": { "accepted": true, "givenAt": "2026-10-10T12:00:00Z", "statement": "…" }
}
```

Returns `201` with `status: "received"`. `GET /v1/service-delay-refunds/:id` then moves through
`received` → `under_review` → `approved` (with `refund`) or `rejected` (with `reasonCode`).

| Error | When |
|---|---|
| `400 INVALID_REQUEST` | Missing or bad fields (`details` lists them) |
| `401 UNAUTHORIZED` | Wrong partner key |
| `409 DUPLICATE_CLAIM` | Same card, date, line and start time already claimed |
| `422 CLAIM_WINDOW_EXPIRED` | More than 28 days ago |
| `422 DELAY_BELOW_THRESHOLD` | Under 15 min (Tube, DLR) or 30 min (Overground, Elizabeth line) |
| `422 IDEMPOTENCY_KEY_REUSED` | Same key, different claim |

Rejection `reasonCode`s: `OUTSIDE_TFL_CONTROL`, `NO_DISRUPTION_RECORDED`.

Refund amounts in the mock are placeholders, not real fares.

## Using real TfL data

Line status uses the same URL and response shape as the real Unified API. To try live data:

```bash
TFL_UNIFIED_API_BASE=https://api.tfl.gov.uk TFL_APP_KEY=your-key npm start
```

The real API may not return disruptions for past days, which is why the demo defaults to the mock.
Its `reason` text is free text, so `lib/rules.js` guesses the cause (strike, customer incident and so on)
with keyword matching. TfL's own records always decide.

## Before this could be real

- TfL would need to offer a partner API, or agree to receive claims from the bank.
- Journey data: TfL holds the customer's journey history. A real integration would probably let
  the customer link their TfL account (for example with OAuth) instead of the bank guessing.
- Consent and data protection: the claim shares personal data with a third party, so it needs
  explicit, recorded consent and a lawful basis. The prototype records a consent statement and timestamp.
- Mainline trains run by other operators use their own Delay Repay schemes, not TfL's.

## Files

```
start.js              starts both servers
lib/                  shared rules (28 days, thresholds, causes), validation, dates, HTTP helpers
mock-tfl/             mock TfL refund API + fake service records
bank/                 bank backend, fake customer data, TfL clients
public/               banking app UI (plain HTML/CSS/JS)
test/flow.test.js     end-to-end tests
```
