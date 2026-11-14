import { defineConfig, devices } from '@playwright/test';

const apps = [
  { name: 'pantry-reaper', script: 'dev:pantry', port: 5173 },
  { name: 'warranty-wraith', script: 'dev:wraith', port: 5174 },
];

export default defineConfig({
  forbidOnly: true,
  reporter: 'list',
  projects: apps.map((app) => ({
    name: app.name,
    testDir: `apps/${app.name}/e2e`,
    use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${app.port}` },
  })),
  webServer: apps.map((app) => ({
    command: `bun run ${app.script}`,
    url: `http://localhost:${app.port}`,
    reuseExistingServer: false,
  })),
});
