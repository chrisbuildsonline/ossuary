import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{packages,apps,tools}/*/src/**/*.test.ts', 'tools/bone-forge/template/src/**/*.test.ts', 'scripts/*.test.ts'],
    // Process CSS so `?raw` imports (the shared token sheet) carry their real text in tests.
    css: { include: [/\.css(\?|$)/] },
  },
});
