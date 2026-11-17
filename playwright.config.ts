import { defineConfig, devices } from '@playwright/test';

const apps = [
  { name: 'pantry-reaper', script: 'dev:pantry', port: 5173 },
  { name: 'warranty-wraith', script: 'dev:wraith', port: 5174 },
];
const gallery = { testDir: 'packages/ossuary-core/e2e', baseURL: 'http://localhost:5180' };
// The offline run needs the built app and its service worker, so it uses the preview server.
const pantryOffline = { script: 'bun run build:pantry && bun run preview:pantry', baseURL: 'http://localhost:4173' };

export default defineConfig({
  forbidOnly: true,
  reporter: 'list',
  projects: [
    ...apps.map((app) => ({
      name: app.name,
      testDir: `apps/${app.name}/e2e`,
      testIgnore: '**/offline.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${app.port}` },
    })),
    {
      name: 'pantry-reaper-offline',
      testDir: 'apps/pantry-reaper/e2e',
      testMatch: '**/offline.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: pantryOffline.baseURL },
    },
    { name: 'gallery-desktop', ...gallery, use: { ...devices['Desktop Chrome'], baseURL: gallery.baseURL, viewport: { width: 1280, height: 800 } } },
    {
      name: 'gallery-phone',
      ...gallery,
      use: { ...devices['Desktop Chrome'], baseURL: gallery.baseURL, viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: [
    ...apps.map((app) => ({ command: `bun run ${app.script}`, url: `http://localhost:${app.port}`, reuseExistingServer: false })),
    { command: 'bun run dev:gallery', url: gallery.baseURL, reuseExistingServer: false },
    { command: pantryOffline.script, url: pantryOffline.baseURL, reuseExistingServer: false, timeout: 120_000 },
  ],
});
