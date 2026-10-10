// Recent journeys, shared by Home and the pots store (a pot is linked to a journey by its id).
// Hard-coded for now. Later this comes from GET /journeys.
//
// `paidAt` is when TfL paid the refund. A pot only receives refunds paid after the pot was created.

export const JOURNEYS = [
  // Stands in for a refund that arrives after the user made a pot: it is "paid" when the app loads,
  // so a pot made earlier receives it (after a reload) and a pot made just now does not.
  { id: 'j5', route: 'Stratford → Liverpool St', meta: 'Central · 36 min, usually 15', status: 'paid', amount: 2.8, paidAt: Date.now() },
  { id: 'j1', route: 'Bank → Stratford', meta: 'Central · 41 min, usually 17', status: 'eligible', amount: 2.8 },
  { id: 'j2', route: 'Liverpool St → Farringdon', meta: 'Elizabeth · 38 min, usually 4', status: 'paid', amount: 2.8, paidAt: Date.parse('2026-09-12') },
  { id: 'j3', route: "King's Cross, no tap out", meta: 'Incomplete journey · max fare charged', status: 'paid', amount: 5.2, paidAt: Date.parse('2026-08-28') },
  { id: 'j4', route: 'Canning Town → Bank', meta: "DLR · strike is outside TfL's control", status: 'none' },
];
