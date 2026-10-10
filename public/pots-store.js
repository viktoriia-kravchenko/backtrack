// Pots data shared by Home and Pots. Pots the user creates are saved in this browser (localStorage).
// Later this comes from the server. Only the functions below need to change.
//
// A pot: { id, name, description, line, letter, createdAt, refunds: [{ journeyId, route, meta, date, amount }] }
// A refund links the pot to a journey (by id). Only refunds paid after the pot was created go into it.
import { JOURNEYS } from './journeys.js';

const STORAGE_KEY = 'bt-pots';
const LINES = ['--bt-pink', '--bt-green', '--bt-blue', '--bt-orange', '--bt-yellow'];

let pots = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // A pot saved without createdAt gets "now", so journeys from before this load can't qualify.
    return Array.isArray(saved) ? saved.map((p) => ({ createdAt: Date.now(), ...p })) : [];
  } catch {
    return []; // storage blocked or corrupted: start empty
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pots));
  } catch {
    // Storage unavailable: pots still work until the page is reloaded.
  }
}

export function getPots() {
  claimRefunds();
  return pots;
}

// Puts each paid journey into the earliest pot that already existed when it was paid.
// Safe to call any number of times: a journey already in a pot is skipped.
function claimRefunds() {
  let changed = false;
  for (const journey of JOURNEYS) {
    if (journey.status !== 'paid' || holder(journey.id)) continue;
    const pot = pots.find((p) => p.createdAt < journey.paidAt);
    if (!pot) continue;
    pot.refunds.push({
      journeyId: journey.id,
      route: journey.route,
      meta: journey.meta,
      date: new Date(journey.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      amount: journey.amount,
    });
    changed = true;
  }
  if (changed) save();
}

const holder = (journeyId) => pots.find((p) => p.refunds.some((r) => r.journeyId === journeyId));

// The pot a journey was refunded into, or undefined.
export function potForJourney(journeyId) {
  claimRefunds();
  return holder(journeyId);
}

// Colour the next pot will get (also used by the live preview in the create form).
export const nextLine = () => LINES[pots.length % LINES.length];

export function addPot({ name, description }) {
  const cleanName = name.trim();
  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pot';
  const pot = {
    id: `${slug}-${Date.now().toString(36)}`, // suffix keeps two pots with the same name apart
    name: cleanName,
    description: description.trim(),
    line: nextLine(),
    letter: cleanName.charAt(0).toUpperCase(),
    createdAt: Date.now(),
    refunds: [],
  };
  pots = [...pots, pot];
  save();
  return pot;
}

export const total = (pot) => pot.refunds.reduce((sum, r) => sum + r.amount, 0);
export const grandTotal = (list) => list.reduce((sum, p) => sum + total(p), 0);

// Demo set with refunds, shown at #/pots/demo. Never saved.
export const DEMO_POTS = [
  {
    id: 'treat-yourself', name: 'Treat Yourself', description: 'Weekend in Brighton', line: '--bt-pink', letter: 'T',
    refunds: [
      { route: 'Liverpool St → Farringdon', meta: 'Elizabeth · 38 min, usually 4', date: '12 Sep', amount: 2.8 },
      { route: 'Bank → Stratford', meta: 'Central · 41 min, usually 17', date: '3 Sep', amount: 2.8 },
      { route: "King's Cross, no tap out", meta: 'Incomplete journey · max fare charged', date: '28 Aug', amount: 5.2 },
      { route: 'Waterloo → Canary Wharf', meta: 'Jubilee · 33 min, usually 12', date: '19 Aug', amount: 2.8 },
    ],
  },
  {
    id: 'savings', name: 'Savings', description: 'Rainy-day fund', line: '--bt-green', letter: 'S',
    refunds: [
      { route: 'Victoria → Brixton', meta: 'Victoria · 29 min, usually 9', date: '8 Sep', amount: 2.8 },
      { route: 'Paddington → Whitechapel', meta: 'Elizabeth · 36 min, usually 14', date: '1 Sep', amount: 3.1 },
      { route: 'Oxford Circus, no tap out', meta: 'Incomplete journey · max fare charged', date: '22 Aug', amount: 5.2 },
    ],
  },
  {
    id: 'travel', name: 'Travel', description: 'Summer trip', line: '--bt-blue', letter: 'V',
    refunds: [
      { route: 'Stratford → Camden Town', meta: 'Northern · 44 min, usually 21', date: '14 Sep', amount: 3.5 },
      { route: 'Angel → London Bridge', meta: 'Northern · 31 min, usually 11', date: '5 Sep', amount: 2.8 },
      { route: 'Euston → Moorgate', meta: 'Northern · 35 min, usually 13', date: '25 Aug', amount: 2.8 },
    ],
  },
];
