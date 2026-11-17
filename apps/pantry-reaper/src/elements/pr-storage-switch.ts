// <pr-storage-switch>: the core storage field, offering only the methods this food has. Emits pr-storage { value }.
import type { BoneSpec } from '@ossuary/core';
import type { OssField } from '@ossuary/core/ui';

export class PrStorageSwitch extends HTMLElement {
  #field?: OssField;

  /** Renders the `storage` field of a food spec with the current value. */
  show(spec: BoneSpec, value: string): void {
    const field = document.createElement('oss-field');
    Object.assign(field, { field: spec.entity.fields.find((f) => f.key === 'storage'), value });
    field.addEventListener('oss-change', (e) => {
      e.stopPropagation();
      const next = (e as CustomEvent<{ value?: unknown }>).detail.value;
      if (typeof next === 'string' && next !== value) this.dispatchEvent(new CustomEvent('pr-storage', { detail: { value: next }, bubbles: true }));
    });
    this.#field = field;
    this.replaceChildren(field);
  }

  override focus(options?: FocusOptions): void {
    this.#field?.focus(options);
  }
}

if (!customElements.get('pr-storage-switch')) customElements.define('pr-storage-switch', PrStorageSwitch);

declare global {
  interface HTMLElementTagNameMap {
    'pr-storage-switch': PrStorageSwitch;
  }
}
