const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    baseURL: 'http://localhost:8080',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Bazı ortamlarda (CI konteyneri, kurumsal makine) Chromium zaten kurulu
    // ve "npx playwright install" ya engelli ya da gereksiz indirme yapıyor.
    // MFSIM_CHROMIUM verilirse o çalıştırılabilir kullanılır; verilmezse
    // Playwright kendi indirdiği tarayıcıya düşer (varsayılan davranış).
    launchOptions: process.env.MFSIM_CHROMIUM
      ? { executablePath: process.env.MFSIM_CHROMIUM }
      : {}
  },
  webServer: {
    command: 'npx serve -l 8080 -s .',
    port: 8080,
    reuseExistingServer: true,
    timeout: 10000
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
