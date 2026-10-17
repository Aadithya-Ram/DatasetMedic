import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:8765', trace:'retain-on-failure' },
  projects: [{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}}],
  webServer: {
    command: `${process.env.DATASETMEDIC_PYTHON || '../.venv/Scripts/python'} -m datasetmedic.cli --port 8765 --no-browser`,
    url:'http://127.0.0.1:8765/api/health', reuseExistingServer:!process.env.CI,
  },
});
