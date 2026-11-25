// The first-visit drawer: purchases bought on days relative to today, so the list opens with a return window about
// to close, one closing soon, a warranty still covered, one long lapsed and one recall match.
import { type IsoDay, type Item, fromDayNumber, toDayNumber } from '@ossuary/core';

const drawer: (Omit<Item, 'bought'> & { daysAgo: number })[] = [
  { name: 'Noise-cancelling headphones', retailer: 'Electronics shop', daysAgo: 29, return_days: 30, warranty_months: 12, price: 249, model: 'NC-700' },
  { name: 'Air fryer', retailer: 'Kitchen store', daysAgo: 9, return_days: 14, warranty_months: 24, price: 89 },
  { name: 'Harkla sensory swing', retailer: 'Online marketplace', daysAgo: 45, return_days: 30, warranty_months: 12, price: 129 },
  { name: 'Standing desk', retailer: 'Office supply', daysAgo: 120, return_days: 30, warranty_months: 60, price: 420 },
  { name: 'Winter boots', retailer: 'Shoe shop', daysAgo: 3, return_days: 60, warranty_months: 6, price: 130 },
  { name: 'Espresso grinder', retailer: 'Kitchen store', daysAgo: 420, return_days: 30, warranty_months: 12, price: 199 },
];

export function samples(today: IsoDay): Item[] {
  return drawer.map(({ daysAgo, ...values }) => ({ ...values, bought: fromDayNumber(toDayNumber(today) - daysAgo) }));
}
