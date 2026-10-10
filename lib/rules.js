'use strict';
// TfL service delay refund rules, as published on tfl.gov.uk (checked October 2026).
// Shared by the bank (to guide the user) and the mock TfL API (to decide claims).

const { toMinutes } = require('./dates');

const CLAIM_WINDOW_DAYS = 28;

const MODES = {
  tube: { label: 'Tube', thresholdMinutes: 15 },
  dlr: { label: 'DLR', thresholdMinutes: 15 },
  overground: { label: 'London Overground', thresholdMinutes: 30 },
  'elizabeth-line': { label: 'Elizabeth line', thresholdMinutes: 30 },
};

// Line ids match the TfL Unified API.
const LINES = {
  bakerloo: { name: 'Bakerloo', mode: 'tube' },
  central: { name: 'Central', mode: 'tube' },
  circle: { name: 'Circle', mode: 'tube' },
  district: { name: 'District', mode: 'tube' },
  'hammersmith-city': { name: 'Hammersmith & City', mode: 'tube' },
  jubilee: { name: 'Jubilee', mode: 'tube' },
  metropolitan: { name: 'Metropolitan', mode: 'tube' },
  northern: { name: 'Northern', mode: 'tube' },
  piccadilly: { name: 'Piccadilly', mode: 'tube' },
  victoria: { name: 'Victoria', mode: 'tube' },
  'waterloo-city': { name: 'Waterloo & City', mode: 'tube' },
  dlr: { name: 'DLR', mode: 'dlr' },
  elizabeth: { name: 'Elizabeth line', mode: 'elizabeth-line' },
  liberty: { name: 'Liberty', mode: 'overground' },
  lioness: { name: 'Lioness', mode: 'overground' },
  mildmay: { name: 'Mildmay', mode: 'overground' },
  suffragette: { name: 'Suffragette', mode: 'overground' },
  weaver: { name: 'Weaver', mode: 'overground' },
  windrush: { name: 'Windrush', mode: 'overground' },
};

function lineLabel(id) {
  const line = LINES[id];
  if (!line) return id;
  if (line.mode === 'tube' || line.mode === 'overground') return `${line.name} line`;
  return line.name;
}

// TfL doesn't refund delays outside its control. It publishes these examples.
const OUTSIDE_CONTROL = [
  { cause: 'strike', label: 'Strike action', re: /\b(strikes?|strike action|industrial action)\b/i },
  { cause: 'security-alert', label: 'A security alert', re: /\bsecurity alert\b/i },
  { cause: 'weather', label: 'Bad weather', re: /\b(weather|flooding|snow|storm|high winds?)\b/i },
  { cause: 'customer-incident', label: 'A customer incident', re: /\b(customer incident|customer taken ill|passenger (?:taken )?ill|person taken ill)\b/i },
  { cause: 'engineering-works', label: 'Engineering works', re: /\b(engineering works?|planned closure)\b/i },
];

/** Best-effort guess from TfL's free-text reason. TfL's own records are what count. */
function classifyCause(reason = '') {
  for (const rule of OUTSIDE_CONTROL) {
    if (rule.re.test(reason)) return { withinControl: false, cause: rule.cause, label: rule.label };
  }
  return { withinControl: true, cause: 'operational', label: 'An operational problem' };
}

/**
 * Find the disruption that affected a journey starting at plannedStart.
 * A disruption counts if the journey started from 30 minutes before it began until it ended.
 * Disruptions within TfL's control are preferred, because any one of them makes the claim valid.
 */
function findDisruption(disruptions, plannedStart) {
  const t = toMinutes(plannedStart);
  const matches = disruptions.filter((d) => t >= toMinutes(d.from) - 30 && t <= toMinutes(d.to));
  matches.sort((a, b) => Number(classifyCause(b.reason).withinControl) - Number(classifyCause(a.reason).withinControl));
  return matches[0] || null;
}

module.exports = { CLAIM_WINDOW_DAYS, MODES, LINES, lineLabel, classifyCause, findDisruption };
