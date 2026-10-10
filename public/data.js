// Shared demo data, used by the Journeys list and the refund page.
// Hard-coded for now. Later this comes from GET /journeys.
// Today in the demo is Sat 10 Oct.

// e.g. dayLabel(2) → "Thu 8 Oct" (2 days ago). Keeps the live journey in step with the server's dates.
function dayLabel(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

export const journeys = [
  // ---- This week ----
  { id: 'j1', group: 'This week', date: dayLabel(2), route: 'Highbury & Islington → Oxford Circus', line: 'Victoria',
    tapIn: '08:10', tapOut: '08:51', mins: 41, usual: 16, threshold: 15,
    status: 'eligible', amount: 2.9, pot: null,
    cause: "Signal failure at Oxford Circus, within TfL's control",
    note: 'Ready to claim. Choose a pot and send it.',
    // Live claim: these match the bank server's demo data, so "Send claim" uses the real API.
    live: true, txnId: 'txn_tfl_02', apiLine: 'victoria', from: 'Highbury & Islington', to: 'Oxford Circus' },
  { id: 'j6', group: 'This week', date: 'Wed 7 Oct', route: 'Oxford Circus → Brixton', line: 'Victoria',
    tapIn: '18:02', tapOut: '18:40', mins: 38, usual: 16, threshold: 15,
    status: 'claimed', amount: 2.8, pot: 'Treat Yourself', claimDate: 'Fri 9 Oct',
    cause: "Train fault, within TfL's control",
    note: "Claim sent to TfL on Fri 9 Oct. We'll tell you when it lands." },
  { id: 'j5', group: 'This week', date: 'Tue 6 Oct', route: 'Highbury & Islington → Oxford Circus', line: 'Victoria',
    tapIn: '08:10', tapOut: '08:26', mins: 16, usual: 16, threshold: 15,
    status: 'ontime' },
  { id: 'j2', group: 'This week', date: 'Mon 5 Oct', route: 'Liverpool St → Farringdon', line: 'Elizabeth',
    tapIn: '17:45', tapOut: '18:23', mins: 38, usual: 4, threshold: 30,
    status: 'paid', amount: 2.8, pot: 'Treat Yourself', claimDate: 'Wed 7 Oct', paidDate: 'Fri 9 Oct',
    cause: "Train fault, within TfL's control",
    note: '£2.80 back. Moved to Treat Yourself.' },

  // ---- Last week ----
  { id: 'j3', group: 'Last week', date: 'Fri 2 Oct', route: "King's Cross, no tap out", line: 'Northern',
    tapIn: '19:31', tapOut: null, mins: null, usual: null,
    status: 'paid', amount: 5.2, pot: 'Treat Yourself', claimDate: 'Sun 4 Oct', paidDate: 'Wed 7 Oct',
    cause: 'Gate fault at the exit, so your tap out was missed',
    note: 'Maximum fare refunded. Moved to Treat Yourself.' },
  { id: 'j4', group: 'Last week', date: 'Thu 1 Oct', route: 'Canning Town → Bank', line: 'DLR',
    tapIn: '08:40', tapOut: '09:32', mins: 52, usual: 14, threshold: 15,
    status: 'none', cause: 'Strike action',
    note: "Strike action is outside TfL's control, so no refund this time." },
  { id: 'j7', group: 'Last week', date: 'Wed 30 Sep', route: 'Old Street → Camden Town', line: 'Northern',
    tapIn: '18:30', tapOut: '18:51', mins: 21, usual: 9, threshold: 15,
    status: 'none', cause: "Minor delays, within TfL's control",
    note: '12 min late. Tube refunds start at 15 min.' },
  { id: 'j8', group: 'Last week', date: 'Tue 29 Sep', route: 'Bank → Stratford', line: 'Central',
    tapIn: '08:15', tapOut: '08:32', mins: 17, usual: 17, threshold: 15,
    status: 'ontime' },

  // ---- Earlier ----
  { id: 'j9', group: 'Earlier', date: 'Thu 24 Sep', route: 'Oxford Circus → Brixton', line: 'Victoria',
    tapIn: '17:58', tapOut: '18:42', mins: 44, usual: 16, threshold: 15,
    status: 'paid', amount: 2.8, pot: 'Treat Yourself', claimDate: 'Sat 26 Sep', paidDate: 'Thu 1 Oct',
    cause: "Signal failure, within TfL's control",
    note: '£2.80 back. Moved to Treat Yourself.' },
  { id: 'j10', group: 'Earlier', date: 'Mon 21 Sep', route: 'Paddington → Farringdon', line: 'Elizabeth',
    tapIn: '17:44', tapOut: '18:09', mins: 25, usual: 10, threshold: 30,
    status: 'none', cause: "Train fault, within TfL's control",
    note: '15 min late. Elizabeth line refunds start at 30 min.' },
  { id: 'j11', group: 'Earlier', date: 'Fri 18 Sep', route: 'Whitechapel → Liverpool St', line: 'Elizabeth',
    tapIn: '09:05', tapOut: '09:45', mins: 40, usual: 3, threshold: 30,
    status: 'none', cause: 'Planned engineering works',
    note: "Planned engineering works aren't covered by TfL refunds." },
];

// Each status: the word on the pill, and the colour of the card's top strip.
// The word is always shown, so status never relies on colour alone.
export const STATUS = {
  eligible: { label: 'Eligible', line: '--bt-yellow' },
  claimed: { label: 'Claimed', line: '--bt-orange' },
  paid: { label: 'Paid', line: '--bt-green' },
  none: { label: 'Not eligible', line: '--bt-red' },
  ontime: { label: 'On time', line: '--bt-edge' },
};

// Pots the refund page can send money to. Keep these in step with the Pot page.
export const pots = [
  { id: 'treat', name: 'Treat Yourself', letter: 'T', colour: '--bt-pink', goal: 'Weekend in Brighton', saved: 36.96, target: 150 },
  { id: 'holiday', name: 'Holiday', letter: 'H', colour: '--bt-blue', goal: 'Lisbon in May', saved: 88, target: 400 },
  { id: 'savings', name: 'Savings', letter: 'S', colour: '--bt-green', goal: 'Rainy-day fund', saved: 212.4, target: null },
  { id: 'charity', name: 'Charity', letter: 'C', colour: '--bt-orange', goal: 'Goes to Shelter', saved: 9.24, target: null },
];

export const findPot = (id) => pots.find((p) => p.id === id);
export const findJourney = (id) => journeys.find((j) => j.id === id);

// Small helpers used by several pages
export const money = (n) => `£${n.toFixed(2)}`;
export const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));