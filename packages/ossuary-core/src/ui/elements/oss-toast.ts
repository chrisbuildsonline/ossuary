// <oss-toast>: a polite status pill at the bottom centre. Auto-dismisses at 5s, pauses on hover and focus.
import { OssElement, define, h } from './base';

export interface ToastOptions {
  undoLabel?: string;
  duration?: number;
}

export class OssToast extends OssElement {
  static override styles = `
:host { position: fixed; left: 0; right: 0; bottom: var(--s-6); z-index: 20; display: flex; justify-content: center; pointer-events: none; }
.region { display: contents; }
.toast {
  pointer-events: auto; display: inline-flex; align-items: center; gap: var(--s-3); min-height: 48px; max-width: calc(100vw - 32px);
  padding: 0 var(--s-2) 0 var(--s-5); border-radius: var(--r-pill); background: var(--ink); color: var(--on-ink);
  font: var(--t-label); box-shadow: var(--shadow-3); animation: toast-in var(--dur-2) var(--ease-out);
}
.toast:not(:has(button)) { padding-right: var(--s-5); }
button {
  min-height: 44px; min-width: 44px; padding: 0 var(--s-3); border: 0; border-radius: var(--r-pill); background: none;
  color: var(--on-ink); font: var(--t-label); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
}
button:focus-visible { outline: 3px solid var(--on-ink); outline-offset: -3px; }
@keyframes toast-in { from { opacity: 0; transform: translateY(12px); } }
@media (max-width: 899px) { :host { bottom: calc(72px + var(--s-6) + env(safe-area-inset-bottom)); } }
`;

  #timer: ReturnType<typeof setTimeout> | undefined;
  #left = 0;
  #started = 0;
  #paused = false;

  protected render(): void {
    if (this.root.querySelector('.region')) return;
    const region = h('div', { class: 'region', role: 'status', 'aria-live': 'polite' });
    const pause = () => this.#pause();
    const resume = () => this.#resume();
    region.addEventListener('mouseenter', pause);
    region.addEventListener('focusin', pause);
    region.addEventListener('mouseleave', resume);
    region.addEventListener('focusout', resume);
    this.root.replaceChildren(region);
  }

  /** Shows a message, replacing any current one. */
  show(message: string, opts: ToastOptions = {}): void {
    if (!this.root.querySelector('.region')) this.render();
    const region = this.root.querySelector('.region') as HTMLElement;
    const undo = opts.undoLabel ? h('button', { type: 'button' }, opts.undoLabel) : null;
    undo?.addEventListener('click', () => {
      this.emit('oss-undo');
      this.hide();
    });
    region.replaceChildren(h('div', { class: 'toast' }, h('span', {}, message), undo));
    this.#left = opts.duration ?? 5000;
    this.#paused = false;
    this.#arm();
  }

  hide(): void {
    clearTimeout(this.#timer);
    this.root.querySelector('.region')?.replaceChildren();
  }

  #arm(): void {
    clearTimeout(this.#timer);
    this.#started = performance.now();
    this.#timer = setTimeout(() => this.hide(), this.#left);
  }

  #pause(): void {
    if (this.#paused) return;
    this.#paused = true;
    clearTimeout(this.#timer);
    this.#left = Math.max(0, this.#left - (performance.now() - this.#started));
  }

  #resume(): void {
    if (!this.#paused) return;
    this.#paused = false;
    if (this.root.querySelector('.toast')) this.#arm();
  }
}

define('oss-toast', OssToast);

declare global {
  interface HTMLElementTagNameMap {
    'oss-toast': OssToast;
  }
}
