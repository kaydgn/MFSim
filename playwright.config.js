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
    // BÜTÇE 10 sn DEĞİL 60 sn — ÖLÇÜLDÜ (CI koşusu 789, e2e-urun):
    //   [WebServer] npm warn exec The following package was not found and
    //                            will be installed: serve@14.2.6
    //   Error: Timed out waiting 10000ms from config.webServer.
    // `serve` bir bağımlılık DEĞİL; `npx` onu her temiz runner'da İNDİRİYOR ve
    // indirme tek başına ~10 sn sürüyor. Yani bütçe, sunucunun açılmasına değil
    // paketin ağdan gelmesine harcanıyordu ve kapı test gövdesi HİÇ KOŞMADAN
    // düşüyordu — sonucu rastgele, sebebi ürünle ilgisiz.
    //
    // Bağımlılığa eklemek de bir seçenekti (indirme tamamen kalkardı); bu
    // turda kapsam dışı bırakıldı, çünkü ölçülen sorun süre bütçesi.
    timeout: 60000
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
