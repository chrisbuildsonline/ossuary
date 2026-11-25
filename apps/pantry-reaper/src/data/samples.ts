// The first-visit kitchen: real FoodKeeper foods bought on days relative to today, so the list opens with
// something fresh, something to use soon, something to eat today and something already spoiled.
import { type IsoDay, type Item, fromDayNumber, toDayNumber } from '@ossuary/core';

const kitchen: { name: string; food_id: string; storage: 'fridge' | 'freezer' | 'pantry'; daysAgo: number }[] = [
  { name: 'Chicken thighs', food_id: '118', storage: 'fridge', daysAgo: 1 },
  { name: 'Baby spinach', food_id: '291', storage: 'fridge', daysAgo: 2 },
  { name: 'Avocados', food_id: '250', storage: 'fridge', daysAgo: 1 },
  { name: 'Cheese slices', food_id: '6', storage: 'fridge', daysAgo: 15 },
  { name: 'Eggs', food_id: '21', storage: 'fridge', daysAgo: 4 },
  { name: 'Smoked salmon', food_id: '167', storage: 'freezer', daysAgo: 20 },
  { name: 'Hummus', food_id: '183', storage: 'fridge', daysAgo: 9 },
  { name: 'Brie', food_id: '7', storage: 'fridge', daysAgo: 12 },
];

export function samples(today: IsoDay): Item[] {
  return kitchen.map(({ daysAgo, ...values }) => ({ ...values, bought: fromDayNumber(toDayNumber(today) - daysAgo) }));
}
