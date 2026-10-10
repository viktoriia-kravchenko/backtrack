'use strict';
// Fake banking data for one demo customer. In a real bank this comes from your core
// banking system. Dates are relative to today so the demo keeps working.

const { daysAgo } = require('../lib/dates');

function tflCharge(id, travelDaysAgo, amount) {
  // TfL adds up a day's contactless journeys and usually takes the payment the next day,
  // so the statement date is the travel date + 1.
  return {
    id,
    postedDate: daysAgo(travelDaysAgo - 1),
    merchant: 'TFL TRAVEL CH',
    amount,
    cardId: 'card_main',
    category: 'Transport',
    isTflContactless: true,
  };
}

function other(id, postedDaysAgo, merchant, amount, category) {
  return { id, postedDate: daysAgo(postedDaysAgo), merchant, amount, cardId: 'card_main', category, isTflContactless: false };
}

function createStore() {
  const transactions = [
    other('txn_1001', 0, 'Corner Coffee', -3.85, 'Eating out'),
    tflCharge('txn_tfl_01', 1, -5.8),
    tflCharge('txn_tfl_02', 2, -5.8),
    other('txn_1002', 3, 'Grocer & Co', -23.4, 'Groceries'),
    tflCharge('txn_tfl_05', 5, -8.6),
    other('txn_1003', 7, 'Northside Gym', -39.0, 'Health'),
    tflCharge('txn_tfl_09', 9, -5.8),
    other('txn_1004', 9, 'Salary · Acme Ltd', 2850.0, 'Income'),
    tflCharge('txn_tfl_12', 12, -9.1),
    tflCharge('txn_tfl_40', 40, -5.8),
  ];
  for (const t of transactions) t.claimIds = [];
  transactions.sort((a, b) => b.postedDate.localeCompare(a.postedDate));

  return {
    profile: { id: 'cus_001', name: 'Lena Oxton', email: 'lena.oxton@example.com' },
    // The bank stores a token from its card processor. The card number never leaves the bank.
    cards: [{ id: 'card_main', label: 'Visa Debit', last4: '4821', token: 'tok_card_7f3a9c21e4' }],
    // Journeys the customer saved (or the app learned from their location history, with consent).
    savedJourneys: [
      { id: 'commute', label: 'Morning commute', line: 'victoria', from: 'Highbury & Islington', to: 'Oxford Circus', usualStart: '08:10' },
      { id: 'client', label: 'Client visits', line: 'elizabeth', from: 'Paddington', to: 'Farringdon', usualStart: '17:45' },
      { id: 'gym', label: 'Evening gym', line: 'northern', from: 'Old Street', to: 'Camden Town', usualStart: '18:30' },
    ],
    transactions,
    drafts: new Map(),
    claims: new Map(),
  };
}

module.exports = { createStore };