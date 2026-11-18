// Fixed, generic bone specs for the tool tests.

const stages = [
  { id: 'fresh', label: 'Fresh', tone: 'fresh' },
  { id: 'steady', label: 'Steady', tone: 'steady', enterAtDays: 14 },
  { id: 'soon', label: 'Soon', tone: 'soon', enterAtDays: 3 },
  { id: 'last_day', label: 'Last day', tone: 'urgent', enterAtDays: 0 },
  { id: 'gone', label: 'Gone', tone: 'dead' },
];

/** One lifespan: 30 days from the start day. */
export const oneSpec = {
  id: 'test-bone',
  name: 'Test Bone',
  version: 1,
  entity: {
    titleField: 'name',
    summaryFields: ['place'],
    fields: [
      { key: 'name', kind: 'text', label: 'Name', required: true },
      { key: 'place', kind: 'text', label: 'Place' },
      { key: 'started', kind: 'date', label: 'Started on', required: true },
    ],
  },
  lifespans: [
    {
      id: 'cover',
      label: 'Cover',
      startField: 'started',
      base: { type: 'duration', amount: 30, unit: 'day', label: 'Cover period' },
      stages,
    },
  ],
};

/** Two lifespans: the 30 day cover and a 12 month service period. */
export const twoSpec = {
  ...oneSpec,
  id: 'test-two',
  name: 'Test Two',
  lifespans: [
    ...oneSpec.lifespans,
    {
      id: 'service',
      label: 'Service',
      startField: 'started',
      base: { type: 'duration', amount: 12, unit: 'month', label: 'Service period' },
      stages: [
        { id: 'fresh', label: 'Fresh', tone: 'fresh' },
        { id: 'steady', label: 'Steady', tone: 'steady', enterAtDays: 90 },
        { id: 'soon', label: 'Soon', tone: 'soon', enterAtDays: 30 },
        { id: 'last_days', label: 'Last days', tone: 'urgent', enterAtDays: 7 },
        { id: 'gone', label: 'Gone', tone: 'dead' },
      ],
    },
  ],
};

export const item = { name: 'Sample', started: '2026-11-01' };
