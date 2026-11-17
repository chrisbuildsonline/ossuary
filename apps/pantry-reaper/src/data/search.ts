// Food search over foods.json: case and accent insensitive, prefix matches first, then alphabetical.
import type { Food } from './foodkeeper';

export const SEARCH_LIMIT = 8;

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function searchFoods(foods: readonly Food[], query: string): Food[] {
  const q = fold(query.trim());
  if (!q) return [];
  return foods
    .map((food) => ({ food, name: fold(food.name) }))
    .filter((m) => m.name.includes(q))
    .sort((a, b) => Number(!a.name.startsWith(q)) - Number(!b.name.startsWith(q)) || a.name.localeCompare(b.name, 'en'))
    .slice(0, SEARCH_LIMIT)
    .map((m) => m.food);
}
