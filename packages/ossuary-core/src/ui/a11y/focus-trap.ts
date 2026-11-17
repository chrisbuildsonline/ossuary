// Keeps Tab and Shift+Tab inside a sheet or dialog, across shadow roots, and gives focus back on release.

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/** The focused element, looking through open shadow roots. */
export function deepActiveElement(doc: Document = document): Element | null {
  let el: Element | null = doc.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

function hidden(el: Element): boolean {
  for (let node: Node | null = el; node; node = node instanceof ShadowRoot ? node.host : node.parentNode) {
    if (!(node instanceof Element)) continue;
    if (node.hasAttribute('hidden') || node.hasAttribute('inert')) return true;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
  }
  return false;
}

function walk(node: Node, out: HTMLElement[]): void {
  const kids: Node[] =
    node instanceof HTMLSlotElement
      ? node.assignedElements({ flatten: true })
      : node instanceof Element && node.shadowRoot
        ? Array.from(node.shadowRoot.childNodes)
        : Array.from(node.childNodes);
  if (node instanceof HTMLElement && node.matches(focusable) && node.getAttribute('tabindex') !== '-1') out.push(node);
  for (const kid of kids) walk(kid, out);
}

/** Elements that Tab can reach inside `root`, in order, including those inside shadow roots and slots. */
export function tabbables(root: Node): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const kid of Array.from(root instanceof Element && root.shadowRoot ? root.shadowRoot.childNodes : root.childNodes)) walk(kid, out);
  return out.filter((el) => !hidden(el));
}

export interface TrapOptions {
  /** Where focus goes first. Defaults to the first tabbable element. */
  initial?: HTMLElement | null;
  onEscape?: () => void;
}

/** Traps focus in `container` until the returned release function is called, which restores focus to the opener. */
export function trapFocus(container: HTMLElement, opts: TrapOptions = {}): () => void {
  const opener = deepActiveElement(container.ownerDocument);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && opts.onEscape) {
      e.preventDefault();
      opts.onEscape();
      return;
    }
    if (e.key !== 'Tab') return;
    const list = tabbables(container);
    const first = list[0];
    const last = list[list.length - 1];
    if (!first || !last) {
      e.preventDefault();
      return;
    }
    const active = deepActiveElement(container.ownerDocument);
    if (e.shiftKey && (active === first || !list.includes(active as HTMLElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !list.includes(active as HTMLElement))) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKey);
  (opts.initial ?? tabbables(container)[0])?.focus();
  return () => {
    container.removeEventListener('keydown', onKey);
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };
}
