// One constructable stylesheet per css text, shared by every element. Tokens flow in from the document and oss-shell.
import tokens from './tokens.css?raw';

const cache = new Map<string, CSSStyleSheet>();

export function sheet(css: string): CSSStyleSheet {
  let s = cache.get(css);
  if (!s) {
    s = new CSSStyleSheet();
    s.replaceSync(css);
    cache.set(css, s);
  }
  return s;
}

/** Rules every element shares: box model, focus ring, tabular numbers and a screen-reader-only helper. */
export const baseCss = `
:host { box-sizing: border-box; font: var(--t-body); color: var(--text); -webkit-font-smoothing: antialiased; }
*, *::before, *::after { box-sizing: inherit; }
[hidden] { display: none !important; }
:focus-visible { outline: var(--focus); outline-offset: 2px; }
button, input, select, textarea { font: inherit; color: inherit; }
.num { font-family: var(--font-num); font-variant-numeric: tabular-nums; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
svg { flex: none; display: block; }
`;

export const tokensCss = tokens;

/** Gives a shadow root the tokens, the shared base rules and its own rules. */
export function adopt(root: ShadowRoot, css: string): void {
  root.adoptedStyleSheets = [sheet(tokens), sheet(baseCss), sheet(css)];
}

/** Adds the tokens to the page once, so `:root` defaults and theme-derived tokens apply. */
export function ensureDocumentTokens(doc: Document = document): void {
  const s = sheet(tokens);
  if (!doc.adoptedStyleSheets.includes(s)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, s];
}
