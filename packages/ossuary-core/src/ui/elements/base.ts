// Shared plumbing for the oss-* elements: shadow root with the shared sheets, safe DOM building, events.
import { adopt } from '../styles';

type Attr = string | number | boolean | null | undefined;
export type Child = Node | string | null | undefined | false;

/** Builds an element. Strings become text nodes, so user text is never parsed as markup. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, Attr>,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/** Parses SVG built in code from numbers and constants (glyphs, motifs). Never pass user text here. */
export function svg(markup: string): Element {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstElementChild ?? document.createElement('span');
}

let uid = 0;
/** A per-page unique id for aria wiring inside a shadow root. */
export const nextId = (prefix: string): string => `${prefix}-${++uid}`;

export abstract class OssElement extends HTMLElement {
  static styles = '';
  readonly root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    adopt(this.root, (this.constructor as typeof OssElement).styles);
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.update();
  }

  /** Re-renders now if connected. */
  protected update(): void {
    if (this.isConnected) this.render();
  }

  protected abstract render(): void;

  /** Dispatches a bubbling, composed event. */
  protected emit<T>(type: string, detail?: T): boolean {
    return this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: true }));
  }
}

export function define(name: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(name)) customElements.define(name, ctor);
}

/** True at the desktop breakpoint (900px). Defaults to desktop where matchMedia is missing. */
export function isDesktop(): boolean {
  return typeof matchMedia === 'function' ? matchMedia('(min-width: 900px)').matches : true;
}
