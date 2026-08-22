/**
 * MFSim — YAYINLANAN ÜRÜNÜN açılış kapısı (Playwright)
 * ────────────────────────────────────────────────────
 *
 * NEDEN VAR: 2026-08'de program açılışta kırıldı — ekrana ham JavaScript
 * döküldü ve ana ekranda hiçbir yere tıklanamadı. Kök neden js/results.js'e
 * giren üç ham "</script>" dizisiydi: index.html'de modüller HARİCİ dosya
 * olduğu için orada zararsız, ama MFSim_Code.html'de aynı içerik bir <script>
 * etiketinin İÇİNE gömüldüğü için ayrıştırıcı bloğu erken kapatıyordu.
 *
 * Bu hatanın merge'den önce yakalanmamasının tek sebebi vardı: TÜM E2E
 * testleri index.html'i açıyordu. "MFSim_Code" dizesi tests/ altında hiç
 * geçmiyordu. Yani index.html yeşil → commit → merge → deploy, ve bozukluk
 * ilk kez KULLANICIDA görülüyordu. Görüntüleyici tarafında karşılığı zaten
 * vardı (viewer.spec.js ürünün kendisini açıyor); MFSim için hiç yazılmamıştı.
 *
 * Burada test edilen şey ÜRÜNÜN KENDİSİDİR: build.js'in ürettiği tek dosya.
 * Sorular şunlar ve cevapları ancak çıktıda görünür:
 *   • Ekrana ham kaynak dökülüyor mu?
 *   • Ana ekran GERÇEKTEN tıklanabilir mi (kaplama yutuyor mu)?
 *   • Bir modül sessizce atlandı mı?
 *   • Gömülmemiş bir kaynak 404 veriyor mu?
 *
 * ÖN KOŞUL: npm run build (dosya yoksa testler açıkça o sebeple düşer).
 *
 * Kendi HTTP sunucusunu kurar; playwright.config.js'teki `serve -s` KULLANILMAZ,
 * çünkü -s (SPA kipi) bilinmeyen yolları index.html'e yönlendirip 200 döndürür
 * ve eksik bir kaynağın 404'ünü GİZLERDİ — tam da ölçmek istediğimiz şeyi.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '../..');
const BUILD = path.join(ROOT, 'MFSim_Code.html');
const PORT = 8123;
const BASE = 'http://127.0.0.1:' + PORT;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

let server;

test.beforeAll(async () => {
  if (!fs.existsSync(BUILD)) {
    throw new Error('MFSim_Code.html yok. Önce: npm run build');
  }
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, rel);
    // Gerçek 404: eksik kaynak GİZLENMEZ (bkz. başlıktaki -s açıklaması).
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('yok');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
});

test.afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
});

// Açılış: gerçek parola akışı + modüllerin yüklenmesi. Toplanan konsol
// hataları ve başarısız istekler döner — assertion'lar testlerde.
async function bootPublished(page) {
  const konsolHatalari = [];
  const basarisizIstekler = [];
  page.on('console', (m) => { if (m.type() === 'error') konsolHatalari.push(m.text()); });
  page.on('pageerror', (e) => konsolHatalari.push('PAGEERROR: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) basarisizIstekler.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', (r) => basarisizIstekler.push('FAIL ' + r.url()));

  await page.goto(BASE + '/MFSim_Code.html');
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(
    () => typeof window.veSaveTopology === 'function' &&
          typeof window.createNode === 'function' &&
          Array.isArray(window.nodes),
    null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  return { konsolHatalari, basarisizIstekler };
}

// Sayfada GÖRÜNÜR metin olarak duran ham kaynak. <script>/<style> gövdeleri
// de metin düğümüdür ama görünmez — onlar elenir.
async function sizanKaynak(page) {
  return page.evaluate(() => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        for (let p = n.parentNode; p; p = p.parentNode) {
          if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n, toplam = 0; const ornekler = [];
    while ((n = w.nextNode())) {
      const t = n.nodeValue;
      if (/(\bfunction\s*\(|\bvar\s+\w+\s*=|'\s*\+\s*'|innerHTML)/.test(t) && t.trim().length > 8) {
        toplam += t.length;
        if (ornekler.length < 5) ornekler.push(t.trim().replace(/\s+/g, ' ').slice(0, 80));
      }
    }
    return { toplam, ornekler };
  });
}

// ── ÇEVRİMDIŞI: STEP OKUYUCUSU ÜRÜNÜN İÇİNDE ───────────────────────────────
// Kullanıcı isteği (2026-08-22): "Bunu offline olarak kullanamam o zaman.
// Ona da ihtiyacım olacak."
//
// Bir ara sürümde .wasm çalışma anında `vendor/` yolundan indiriliyordu; yanında
// vendor/ olmayan bir kurulumda — yani ürünün NORMAL kullanım biçiminde, tek
// dosyayı indirip açmakta — STEP hiç açılmıyordu. Artık gömülü
// (js/structural-occt-wasm.js, gzip+base64) ve bu dosyaya inline ediliyor.
//
// KAPI BURADA, structural-geometry.spec.js'te DEĞİL: orası index.html'i açıyor
// ve modüler kurulumda varlık AYRI bir dosyadır. Çevrimdışı garantisi
// DAĞITILAN TEK DOSYANIN özelliğidir — bu spec'in var oluş sebebi de zaten
// "index.html yeşil ama ürün bozuk" asimetrisi.
test.describe('Yayınlanan tek dosya — çevrimdışı STEP', () => {
  test.setTimeout(180000);

  test('AĞ KESİKKEN STEP içe aktarılıyor — okuyucu ürünün içinde', async ({ page }) => {
    await bootPublished(page);

    const istekler = [];
    page.on('request', (r) => istekler.push(r.url()));
    // Bu noktadan sonra HİÇBİR istek çıkamaz.
    await page.route('**', (route) => route.abort());
    const n0 = istekler.length;

    // STEP baytları Node'dan geçiriliyor — gerçek kullanımda da dosya
    // KULLANICIDAN gelir, ağdan değil.
    const b64 = fs.readFileSync(path.join(ROOT, 'tests/fixtures/step/rounded-cube.step')).toString('base64');
    const r = await page.evaluate(async (s) => {
      const bin = atob(s); const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const asamalar = [];
      const g = await veStrImportStep(u, { fileName: 'rounded-cube.step', fileSize: u.length },
        { onProgress: (st) => { if (asamalar[asamalar.length - 1] !== st) asamalar.push(st); } });
      return { ok: g.ok, err: g.error, wasm: g.wasmUrl, worker: g.worker,
               tri: g.stats && g.stats.triCount, faces: g.stats && g.stats.faceCount,
               asamalar: asamalar };
    }, b64);

    expect(r.err).toBeUndefined();
    expect(r.ok).toBe(true);                 // ← ağ yokken de açılıyor
    expect(r.wasm).toBe('(gömülü)');         // okuyucu dosyanın içinden geldi
    expect(r.worker).toBe(true);
    expect(r.tri).toBe(64);
    expect(r.faces).toBe(7);
    // "indiriliyor" aşaması HİÇ görülmemeli — indirilecek bir şey yok.
    expect(r.asamalar).not.toContain('download');

    // blob: worker URL'i ağ değildir; onun dışında hiçbir şey çıkmamalı.
    expect(istekler.slice(n0).filter((u) => !/^blob:/.test(u))).toEqual([]);
  });
});

test.describe('Yayınlanan tek dosya — açılış', () => {
  test('ekrana ham kaynak DÖKÜLMÜYOR', async ({ page }) => {
    await bootPublished(page);
    const s = await sizanKaynak(page);
    // Hata mesajı doğrudan sızan metni gösterir — teşhis için yeter.
    expect({ karakter: s.toplam, ornekler: s.ornekler })
      .toEqual({ karakter: 0, ornekler: [] });
  });

  test('ana ekran GERÇEKTEN tıklanabilir — kaplama yutmuyor', async ({ page }) => {
    await bootPublished(page);
    const kart = page.locator('.ve-module-card').first();
    await kart.waitFor({ state: 'visible', timeout: 15000 });
    // Gerçek fare tıklaması: önünde bir eleman varsa Playwright BURADA düşer.
    // Olayda ekranı <div class="ve-trace-empty"> kaplıyordu.
    await kart.click({ timeout: 15000 });
    await expect(page.locator('#ve-module-overlay')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('#sayfa2')).toBeVisible();
  });

  test('açılışta konsol hatası ve 404 YOK', async ({ page }) => {
    const { konsolHatalari, basarisizIstekler } = await bootPublished(page);
    // version.json yalnız deploy'da üretilir; yerel kopyada yokluğu beklenen
    // ve zararsız tek eksiktir (js/deploy-status.js onu zaten yutuyor).
    const beklenmeyen404 = basarisizIstekler.filter((u) => !/version\.json/.test(u));
    const beklenmeyenHata = konsolHatalari.filter((t) => !/version\.json|Failed to load resource/.test(t));
    expect({ istekler: beklenmeyen404, hatalar: beklenmeyenHata })
      .toEqual({ istekler: [], hatalar: [] });
  });

  test('her modül yüklendi — sessizce atlanan yok', async ({ page }) => {
    // Yükleyicinin atladığı bir modül splash'i yine %100'e çıkarır (loader.js
    // askıda kalan bir kaynağı zaman aşımıyla ATLAR ve devam eder); eksikliği
    // ancak modülün kurduğu global üzerinden anlaşılır.
    //
    // Beklenti listesi ELLE YAZILMAZ, kaynaktan TÜRETİLİR: her js/ dosyasının
    // ilk üst-seviye fonksiyon bildirimi alınır. Elle yazılan bir liste hem
    // eskir hem de yanlış ad yazınca sessizce zayıflar — ilk denemede tam
    // olarak bu oldu, uydurulmuş on iki addan hiçbiri gerçek değildi.
    const beklenen = fs.readdirSync(path.join(ROOT, 'js'))
      .filter((f) => f.endsWith('.js')).sort()
      .map((f) => {
        const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
        const m = /^function\s+([A-Za-z_$][\w$]*)\s*\(/m.exec(src);
        return m ? { modul: f, fn: m[1] } : null;
      })
      .filter(Boolean);

    // Hiç üst-seviye fonksiyon bildirmeyen (tamamen IIFE) modüller doğal
    // olarak elenir; kalanın anlamlı bir sayı olduğunu doğrula ki liste
    // sessizce boşalmasın.
    expect(beklenen.length).toBeGreaterThan(40);

    await bootPublished(page);
    const eksik = await page.evaluate((liste) => liste
      .filter((x) => typeof window[x.fn] !== 'function')
      .map((x) => x.modul + ' → ' + x.fn), beklenen);
    expect(eksik).toEqual([]);
  });

  test('rapor varlıkları İLK çağrıda yükleniyor', async ({ page }) => {
    await bootPublished(page);
    // Sayaç döngü içinde artırıldığında ilk çağrı false dönüyordu: Takoz
    // raporu "varlıklar yüklenemedi" ile düşüyor, Araç Performans raporu ise
    // SESSİZCE fontsuz ve ham LaTeX'li iniyordu. Hata yalnız tek dosyada
    // görülüyordu — yer tutucular orada inline ve SENKRON çalışıyor.
    const r = await page.evaluate(() => new Promise((resolve) => {
      window._mntReportEnsureAssets((ok) => {
        resolve({ ok, katexJs: (window.MNT_REPORT_ASSETS || {}).katexJs ? true : false });
      });
    }));
    expect(r).toEqual({ ok: true, katexJs: true });
  });
});
