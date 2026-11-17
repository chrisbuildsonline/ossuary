// The mapped FoodKeeper foods, typed. JSON imports widen `afterOpening: true` to boolean.
import type { Food } from './foodkeeper';
import data from './foods.json';

export const foods = data as readonly Food[];
