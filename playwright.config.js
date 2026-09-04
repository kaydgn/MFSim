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
    // `npx` DEĞİL, YEREL İKİLİ. Ölçüldü (CI koşusu 789): `serve` bir bağımlılık
    // olmadığı için npx onu her temiz runner'da indiriyordu ve indirme tek
    // başına ~10 sn sürüyordu; bütçe sunucunun açılmasına değil paketin ağdan
    // gelmesine harcanıyor, kapı test gövdesi HİÇ KOŞMADAN düşüyordu.
    // Artık sabitlenmiş bir devDependency (serve@14.2.6) ve `npm ci` ile
    // önbellekten geliyor — indirme yok, dolayısıyla 10 sn'lik özgün bütçe de
    // yeterli. Süreyi büyütmek sebebi değil belirtiyi tedavi ederdi.
    command: 'node node_modules/serve/build/main.js -l 8080 -s .',
    port: 8080,
    reuseExistingServer: true,
    timeout: 15000
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
