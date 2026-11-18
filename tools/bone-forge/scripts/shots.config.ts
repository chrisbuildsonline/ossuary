// Screenshots of a scaffolded sample app: bun run shots:forge. Not part of bun run e2e.
import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:5190';

export default defineConfig({
  testDir: '.',
  testMatch: 'shots.spec.ts',
  outputDir: '../../../.backups/shots-results',
  forbidOnly: true,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL },
  webServer: { command: 'bun preview.ts', url: baseURL, reuseExistingServer: false, timeout: 60_000 },
});
