import { ossuaryPwa } from '@ossuary/core/pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [ossuaryPwa({ prefix: 'warranty-wraith-' })],
});
