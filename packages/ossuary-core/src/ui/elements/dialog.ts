// Native <dialog> as a modal: scrim, top layer and Escape from the platform, plus the focus trap and focus return.
import { deepActiveElement, trapFocus } from '../a11y/focus-trap';

/** Opens `dialog` modally. The returned function closes it and gives focus back to the opener. */
export function openModal(dialog: HTMLDialogElement, onEscape: () => void, initial?: HTMLElement | null): () => void {
  const opener = deepActiveElement(dialog.ownerDocument);
  if (!dialog.open) {
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
  }
  const onCancel = (e: Event) => {
    e.preventDefault();
    onEscape();
  };
  dialog.addEventListener('cancel', onCancel);
  const release = trapFocus(dialog, { initial, onEscape, opener });
  return () => {
    dialog.removeEventListener('cancel', onCancel);
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    dialog.removeAttribute('open');
    release();
  };
}

/** Side sheet on desktop, bottom sheet on phone, centred dialog for `.center`. */
export const dialogCss = `
dialog {
  border: 0; padding: 0; color: var(--text); background: var(--surface); box-shadow: var(--shadow-3);
  display: none; flex-direction: column; overflow: hidden; max-width: none; max-height: none;
}
dialog[open] { display: flex; }
dialog::backdrop { background: var(--scrim); }
.side {
  margin: var(--s-4) var(--s-4) var(--s-4) auto; width: 480px; height: calc(100dvh - 2 * var(--s-4));
  border-radius: var(--r-xl); animation: side-in var(--dur-3) var(--ease-out);
}
.center { margin: auto; width: min(720px, calc(100vw - 2 * var(--s-8))); max-height: calc(100dvh - 2 * var(--s-8)); border-radius: var(--r-xl); animation: fade-in var(--dur-3) var(--ease-out); }
.grabber { display: none; width: 36px; height: 4px; border-radius: var(--r-pill); background: var(--grabber); margin: var(--s-2) auto 0; flex: none; }
.head { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); padding: var(--s-4) var(--s-4) var(--s-2) var(--s-6); flex: none; }
.head h2 { margin: 0; font: var(--t-title); letter-spacing: -0.01em; }
.scroll { flex: 1; overflow: auto; padding: var(--s-2) var(--s-6) var(--s-6); }
.foot { flex: none; display: flex; justify-content: flex-end; gap: var(--s-3); padding: var(--s-4) var(--s-6); background: var(--surface); box-shadow: 0 -1px 0 var(--line); }
@keyframes side-in { from { opacity: 0; transform: translateX(24px); } }
@keyframes up-in { from { transform: translateY(100%); } }
@keyframes fade-in { from { opacity: 0; transform: translateY(8px); } }
@media (max-width: 899px) {
  .side, .bottom {
    margin: auto 0 0; width: 100%; height: auto; max-height: 92dvh; border-radius: var(--r-xl) var(--r-xl) 0 0; animation: up-in var(--dur-3) var(--ease-out);
  }
  .center { margin: 0; width: 100%; height: 100dvh; max-height: 100dvh; border-radius: 0; }
  .grabber { display: block; }
  .head { padding: var(--s-2) var(--s-2) var(--s-2) var(--s-4); }
  .scroll { padding: var(--s-2) var(--s-4) var(--s-4); }
  .foot { padding: var(--s-3) var(--s-4) calc(var(--s-3) + env(safe-area-inset-bottom)); }
  .foot oss-button[variant="primary"] { flex: 1; }
}
`;
