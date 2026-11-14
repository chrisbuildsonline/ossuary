import { coreName } from '@ossuary/core';

const el = document.querySelector('[data-testid="core"]');
if (el) el.textContent = coreName;