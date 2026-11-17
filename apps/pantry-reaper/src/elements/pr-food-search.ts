// <pr-food-search>: a search field with a keyboard listbox over the bundled foods. Emits pr-pick { food }.
import type { Food, StorageMethod } from '../data/foodkeeper';
import { searchFoods } from '../data/search';

const methods: { key: StorageMethod; label: string }[] = [
  { key: 'pantry', label: 'Pantry' },
  { key: 'fridge', label: 'Fridge' },
  { key: 'freezer', label: 'Freezer' },
];

const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
/** Whole days as the FoodKeeper unit they most likely came from. */
export function keepsFor(d: number): string {
  if (d >= 365 && d % 365 === 0) return unit(d / 365, 'year');
  if (d >= 30 && d % 30 === 0) return unit(d / 30, 'month');
  if (d >= 14 && d % 7 === 0) return unit(d / 7, 'week');
  return unit(d, 'day');
}

/** "Fridge 7 days · Freezer 1 month". */
export const keepsLine = (food: Food): string =>
  methods
    .flatMap(({ key, label }) => {
      const d = food.days[key];
      if (d === undefined) return [];
      return [`${label} ${keepsFor(d)}${key === 'fridge' && food.afterOpening ? ' after opening' : ''}`];
    })
    .join(' · ');

const css = `
:host { display: block; position: relative; z-index: 5; }
* { box-sizing: border-box; }
.field {
  display: flex; align-items: center; gap: var(--s-3); height: 56px; padding: 0 var(--s-5);
  background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-1); color: var(--text-2);
  transition: box-shadow var(--dur-2) var(--ease-out);
}
.field:hover { box-shadow: var(--shadow-2); }
.field:focus-within { box-shadow: var(--shadow-2); }
.field:has(input:focus-visible) { outline: var(--focus); outline-offset: 2px; }
svg { flex: none; }
input {
  flex: 1; min-width: 0; height: 100%; border: 0; padding: 0; background: none; outline: none;
  font: var(--t-body); font-size: 17px; color: var(--text);
}
input::placeholder { color: var(--text-3); }
input::-webkit-search-cancel-button { display: none; }
.panel {
  position: absolute; left: 0; right: 0; top: calc(100% + var(--s-2)); padding: var(--s-2);
  background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-3);
  max-height: min(440px, 60dvh); overflow: auto; animation: in var(--dur-2) var(--ease-out);
}
.panel[hidden] { display: none; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
li {
  display: grid; grid-template-columns: 1fr auto; align-items: center; column-gap: var(--s-3);
  min-height: 60px; padding: var(--s-2) var(--s-3); border-radius: var(--r-sm); cursor: pointer;
}
li:hover { background: var(--surface-sunken); }
li[aria-selected="true"] { background: var(--accent-tint); }
.title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--t-body); color: var(--text-2); }
.name { font: var(--t-heading); color: var(--text); }
.keeps { grid-column: 1; font: var(--t-caption); color: var(--text-3); font-variant-numeric: tabular-nums; }
.go { grid-row: 1 / span 2; grid-column: 2; font: var(--t-caption); font-weight: 600; color: var(--accent-ink); visibility: hidden; }
li[aria-selected="true"] .go { visibility: visible; }
li[aria-selected="true"] .keeps { color: var(--text-2); }
.none { margin: 0; padding: var(--s-4) var(--s-3); font: var(--t-body); color: var(--text-2); }
.foot { margin: var(--s-1) 0 0; padding: var(--s-2) var(--s-3) var(--s-1); border-top: 1px solid var(--line); font: var(--t-caption); color: var(--text-3); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes in { from { opacity: 0; transform: translateY(-4px); } }
@media (max-width: 899px) { .foot { display: none; } }
`;

const searchIcon =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';

let styles: CSSStyleSheet | undefined;

export class PrFoodSearch extends HTMLElement {
  foods: readonly Food[] = [];
  readonly #input: HTMLInputElement;
  readonly #panel: HTMLElement;
  readonly #list: HTMLUListElement;
  readonly #status: HTMLElement;
  #results: Food[] = [];
  #active = -1;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open', delegatesFocus: true });
    if (!styles) {
      styles = new CSSStyleSheet();
      styles.replaceSync(css);
    }
    root.adoptedStyleSheets = [styles];
    root.innerHTML = `<div class="field">${searchIcon}<input type="search" role="combobox" aria-label="Search foods" aria-autocomplete="list" aria-expanded="false" aria-controls="results" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="Search foods, like yogurt or spinach"></div><div class="panel" hidden><ul id="results" role="listbox" aria-label="Foods"></ul><p class="foot">Use ↑ ↓ to choose and Enter to add</p></div><p class="sr-only" role="status"></p>`;
    this.#input = root.querySelector('input') as HTMLInputElement;
    this.#panel = root.querySelector('.panel') as HTMLElement;
    this.#list = root.querySelector('ul') as HTMLUListElement;
    this.#status = root.querySelector('[role="status"]') as HTMLElement;
    this.#input.addEventListener('input', () => this.#search());
    this.#input.addEventListener('focus', () => this.#search());
    this.#input.addEventListener('blur', () => this.#close());
    this.#input.addEventListener('keydown', (e) => this.#key(e));
    // Keep focus in the input while an option is clicked.
    this.#list.addEventListener('mousedown', (e) => e.preventDefault());
  }

  override focus(options?: FocusOptions): void {
    this.#input.focus(options);
  }

  #search(): void {
    const query = this.#input.value;
    this.#results = searchFoods(this.foods, query);
    this.#active = -1;
    if (!query.trim()) return this.#close();
    this.#list.replaceChildren(...this.#results.map((food, i) => this.#option(food, i)));
    const none = this.#panel.querySelector('.none');
    if (this.#results.length === 0) {
      const p = none ?? document.createElement('p');
      p.className = 'none';
      p.textContent = `No food matches “${query.trim()}”. Try one word, like “milk”.`;
      if (!none) this.#list.after(p);
    } else none?.remove();
    this.#status.textContent = this.#results.length ? `${this.#results.length} foods found` : 'No food found';
    this.#panel.hidden = false;
    this.#input.setAttribute('aria-expanded', 'true');
    this.#input.removeAttribute('aria-activedescendant');
  }

  #option(food: Food, i: number): HTMLLIElement {
    const li = document.createElement('li');
    li.id = `food-${i}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    const cut = food.name.indexOf(', ');
    const title = document.createElement('span');
    title.className = 'title';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = cut < 0 ? food.name : food.name.slice(0, cut);
    title.append(name, cut < 0 ? '' : `, ${food.name.slice(cut + 2)}`);
    const keeps = document.createElement('span');
    keeps.className = 'keeps';
    keeps.textContent = keepsLine(food);
    const go = document.createElement('span');
    go.className = 'go';
    go.setAttribute('aria-hidden', 'true');
    go.textContent = 'Add ↵';
    li.append(title, go, keeps);
    li.addEventListener('click', () => this.#pick(i));
    return li;
  }

  #key(e: KeyboardEvent): void {
    const n = this.#results.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.#panel.hidden) this.#search();
      if (n === 0) return;
      this.#move(e.key === 'ArrowDown' ? (this.#active + 1) % n : (this.#active - 1 + n) % n);
    } else if (e.key === 'Enter') {
      if (n === 0 || this.#panel.hidden) return;
      e.preventDefault();
      this.#pick(Math.max(this.#active, 0));
    } else if (e.key === 'Escape') {
      if (this.#panel.hidden) this.#input.value = '';
      this.#close();
    }
  }

  #move(i: number): void {
    this.#active = i;
    for (const [j, li] of Array.from(this.#list.children).entries()) li.setAttribute('aria-selected', String(i === j));
    const li = this.#list.children[i] as HTMLElement | undefined;
    if (!li) return;
    this.#input.setAttribute('aria-activedescendant', li.id);
    li.scrollIntoView?.({ block: 'nearest' });
  }

  #pick(i: number): void {
    const food = this.#results[i];
    if (!food) return;
    this.#input.value = '';
    this.#close();
    this.dispatchEvent(new CustomEvent('pr-pick', { detail: { food }, bubbles: true, composed: true }));
  }

  #close(): void {
    this.#panel.hidden = true;
    this.#active = -1;
    this.#input.setAttribute('aria-expanded', 'false');
    this.#input.removeAttribute('aria-activedescendant');
  }
}

if (!customElements.get('pr-food-search')) customElements.define('pr-food-search', PrFoodSearch);

declare global {
  interface HTMLElementTagNameMap {
    'pr-food-search': PrFoodSearch;
  }
}
