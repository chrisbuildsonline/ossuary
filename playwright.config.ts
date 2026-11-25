import { defineConfig, devices } from '@playwright/test';

const apps = [
  { name: 'pantry-reaper', script: 'dev:pantry', port: 5173 },
  { name: 'warranty-wraith', script: 'dev:wraith', port: 5174 },
];
const gallery = { testDir: 'packages/ossuary-core/e2e', baseURL: 'http://localhost:5180' };
// The offline run needs the built app and its service worker, so it uses the preview server.
const pantryOffline = { script: 'bun run build:pantry && bun run preview:pantry', baseURL: 'http://localhost:4173' };
const wraithOffline = { script: 'bun run build:wraith && bun run preview:wraith', baseURL: 'http://localhost:4174' };
// The launcher runs from the one static build, with both apps under their sub-paths.
const launcher = { testDir: 'apps/launcher/e2e', script: 'bun run build && bun run preview', baseURL: 'http://localhost:4180' };

// Every origin starts as a returning visit, so no test meets the first-visit samples unless it asks for a fresh
// storage state (the crypt specs do).
const visited = {
  cookies: [],
  origins: [5173, 5174, 4173, 4174, 4180, 5180].map((port) => ({
    origin: `http://localhost:${port}`,
    localStorage: ['pantry-reaper', 'warranty-wraith'].map((id) => ({ name: `ossuary:${id}:visited`, value: '1' })),
  })),
};

export default defineConfig({
  use: { storageState: visited },
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
    {
      name: 'warranty-wraith-offline',
      testDir: 'apps/warranty-wraith/e2e',
      testMatch: '**/offline.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: wraithOffline.baseURL },
    },
    { name: 'gallery-desktop', ...gallery, use: { ...devices['Desktop Chrome'], baseURL: gallery.baseURL, viewport: { width: 1280, height: 800 } } },
    {
      name: 'gallery-phone',
      ...gallery,
      use: { ...devices['Desktop Chrome'], baseURL: gallery.baseURL, viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    { name: 'launcher-desktop', testDir: launcher.testDir, use: { ...devices['Desktop Chrome'], baseURL: launcher.baseURL, viewport: { width: 1280, height: 800 } } },
    {
      name: 'launcher-phone',
      testDir: launcher.testDir,
      use: { ...devices['Desktop Chrome'], baseURL: launcher.baseURL, viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: [
    ...apps.map((app) => ({ command: `bun run ${app.script}`, url: `http://localhost:${app.port}`, reuseExistingServer: false })),
    { command: 'bun run dev:gallery', url: gallery.baseURL, reuseExistingServer: false },
    { command: pantryOffline.script, url: pantryOffline.baseURL, reuseExistingServer: false, timeout: 120_000 },
    { command: wraithOffline.script, url: wraithOffline.baseURL, reuseExistingServer: false, timeout: 120_000 },
    { command: launcher.script, url: launcher.baseURL, reuseExistingServer: false, timeout: 180_000 },
  ],
});
