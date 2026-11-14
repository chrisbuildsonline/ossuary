// Neutral test fixtures. Core stays domain-free, so these use "widget" and "gizmo" vocabulary.

const stages = (first: string, tone: 'fresh' | 'steady') => [
  { id: 'ok', label: first, tone },
  { id: 'soon', label: 'Soon', tone: 'soon', enterAtDays: 7 },
  { id: 'urgent', label: 'Urgent', tone: 'urgent', enterAtDays: 2 },
  { id: 'gone', label: 'Gone', tone: 'dead' },
];

/** One lifespan whose length is set by a lookup on where the widget is kept. */
export const widgetSpec = {
  id: 'widget-tracker',
  name: 'Widget Tracker',
  version: 1,
  entity: {
    titleField: 'name',
    summaryFields: ['place', 'opened'],
    fields: [
      { key: 'name', kind: 'text', label: 'Name', required: true },
      {
        key: 'place',
        kind: 'enum',
        label: 'Kept in',
        required: true,
        options: [
          { value: 'cold', label: 'Cold' },
          { value: 'deep_cold', label: 'Deep cold' },
          { value: 'shelf', label: 'Shelf' },
        ],
      },
      { key: 'made', kind: 'date', label: 'Made', required: true },
      { key: 'opened', kind: 'enum', label: 'Opened', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
      { key: 'count', kind: 'number', label: 'Count', min: 0, step: 1 },
    ],
  },
  lifespans: [
    {
      id: 'main',
      label: 'Use by',
      startField: 'made',
      base: { type: 'duration', amount: 14, unit: 'day', label: 'Base', sourceId: 'ref1' },
      rules: [
        {
          id: 'by_place',
          kind: 'lookup',
          field: 'place',
          label: 'Kept in',
          table: { cold: { amount: 14, unit: 'day' }, deep_cold: { amount: 6, unit: 'month' }, shelf: { amount: 1, unit: 'year' } },
          sourceId: 'ref1',
        },
        { id: 'opened', kind: 'shorten', label: 'Opened', when: { field: 'opened', equals: 'yes' }, by: { amount: 7, unit: 'day' } },
        { id: 'limit', kind: 'clamp', label: 'Limit', max: { amount: 2, unit: 'year' } },
      ],
      stages: stages('Fresh', 'fresh'),
    },
  ],
  theme: {
    accent: '#b8460e',
    accentInk: '#9a3a0b',
    accentTint: '#fbe9dc',
    canvas: '#f2efea',
    display: 'fraunces',
    motif: 'candle',
    emptyArt: 'candle-jar-moon',
    wordmark: 'Widget Tracker',
  },
  copy: { emptyTitle: 'Nothing here yet.', emptyBody: 'Add a widget to start the clock.', addLabel: 'Add widget' },
  sources: [
    { id: 'ref1', name: 'Example reference', url: 'https://example.org/data', license: 'CC0-1.0', retrievedOn: '2026-10-01' },
  ],
};

/** Two lifespans over one start day: a short window in days and a long cover in months. */
export const gizmoSpec = {
  id: 'gizmo-keeper',
  name: 'Gizmo Keeper',
  version: 1,
  entity: {
    titleField: 'name',
    summaryFields: ['maker'],
    fields: [
      { key: 'name', kind: 'text', label: 'Name', required: true },
      { key: 'maker', kind: 'text', label: 'Maker' },
      { key: 'bought', kind: 'date', label: 'Bought on', required: true },
      { key: 'price', kind: 'number', label: 'Price', min: 0 },
      { key: 'plan', kind: 'enum', label: 'Plan', options: [{ value: 'basic', label: 'Basic' }, { value: 'plus', label: 'Plus' }] },
    ],
  },
  lifespans: [
    {
      id: 'return_window',
      label: 'Return window',
      startField: 'bought',
      base: { type: 'duration', amount: 30, unit: 'day', label: 'Return window' },
      rules: [{ id: 'plus_days', kind: 'extend', label: 'Plus plan', when: { field: 'plan', equals: 'plus' }, by: { amount: 14, unit: 'day' } }],
      stages: [
        { id: 'open', label: 'Open', tone: 'fresh' },
        { id: 'last', label: 'Last days', tone: 'urgent', enterAtDays: 3 },
        { id: 'closed', label: 'Closed', tone: 'dead' },
      ],
    },
    {
      id: 'cover',
      label: 'Cover',
      startField: 'bought',
      base: { type: 'duration', amount: 24, unit: 'month', label: 'Cover' },
      rules: [{ id: 'plus_cover', kind: 'extend', label: 'Plus plan', when: { field: 'plan', equals: 'plus' }, by: { amount: 12, unit: 'month' } }],
      stages: [
        { id: 'covered', label: 'Covered', tone: 'steady' },
        { id: 'ending', label: 'Ending', tone: 'soon', enterAtDays: 30 },
        { id: 'ended', label: 'Ended', tone: 'dead' },
      ],
    },
  ],
  theme: {
    accent: '#5a4bd1',
    accentInk: '#5a4bd1',
    accentTint: '#ebe9fb',
    canvas: '#edeff6',
    display: 'space-grotesk',
    motif: 'ghost',
    emptyArt: 'ghost-parcel',
    wordmark: 'Gizmo Keeper',
  },
};

/** A deep copy that tests can change freely. */
export const copyOf = <T>(value: T): T => structuredClone(value);
