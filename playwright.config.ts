import { defineConfig, devices } from '@playwright/test';

const apps = [
  { name: 'pantry-reaper', script: 'dev:pantry', port: 5173 },
  { name: 'warranty-wraith', script: 'dev:wraith', port: 5174 },
];
const gallery = { testDir: 'packages/ossuary-core/e2e', baseURL: 'http://localhost:5180' };

export default defineConfig({
  forbidOnly: true,
  reporter: 'list',
  projects: [
    ...apps.map((app) => ({
      name: app.name,
      testDir: `apps/${app.name}/e2e`,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${app.port}` },
    })),
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
  ],
});
