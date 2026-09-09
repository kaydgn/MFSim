/**
 * Program Arşivi — YOKLAMA yalnız gerçek tarayıcıda ölçülebilir (Playwright)
 * ────────────────────────────────────────────────────────────────────────
 *
 * Pencere iki durumu ayırmak zorunda: arşiv klasörü bu kopyanın YANINDA mı,
 * değil mi. Katalog her kopyada gömülü (51 satır her hâlde çiziliyor), dosyalar
 * değil — arşiv gzip'li 17,40 MB ve gömülseydi gönderilen tek dosya 30 MiB
 * teslim sınırını aşardı (CLAUDE.md).
 *
 * AYRIM SADECE TARAYICIDA YAPILABİLİYOR ve bu ölçülmüş bir kısıt: `file://`
 * üzerinde `fetch` dosya olsa da olmasa da TypeError atıyor, yani var/yok
 * ayrımı YAPMIYOR. `<script>` etiketi yapıyor (`onload` / `onerror`) — pencere
 * bu yüzden `programlar/arsiv-var.js`'i script etiketiyle yokluyor. jsdom'da
 * script etiketi ağa hiç çıkmaz; bu halka Node'da HİÇ koşmuyor.
 *
 * Yanlış giderse hata SESSİZ: arşiv yanındayken "yok" denip 51 satırın hepsi
 * pasif çizilir (özellik ölür), ya da yokken "var" denip her tıklama
 * tarayıcının "dosya bulunamadı" sayfasına düşer.
 *
 * ÖN KOŞUL: npm run build.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '../..');
const BUILD = path.join(ROOT, 'MFSim_Code.html');
const PORT = 8124;
const BASE = 'http://127.0.0.1:' + PORT;

// Tek sunucu, iki kök: /var/... her şeyi servis eder, /yok/... programlar/'ı
// 404'ler. Böylece "indirilmiş tek dosya, yanında klasör yok" durumu gerçekten
// ölçülüyor — taklit edilmiyor.
let server;

test.beforeAll(async () => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
  server = http.createServer((req, res) => {
    const yol = decodeURIComponent(req.url.split('?')[0]);
    const m = yol.match(/^\/(var|yok)\/(.*)$/);
    if (!m) { res.writeHead(404); return res.end('yok'); }
    const [, kip, rel] = m;
    if (kip === 'yok' && rel.indexOf('programlar/') === 0) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('yok');
    }
    const dosya = path.join(ROOT, rel);
    if (!dosya.startsWith(ROOT) || !fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('yok');
    }
    const uzanti = path.extname(dosya);
    res.writeHead(200, {
      'Content-Type': uzanti === '.js' ? 'text/javascript; charset=utf-8'
        : uzanti === '.json' ? 'application/json; charset=utf-8'
        : 'text/html; charset=utf-8'
    });
    fs.createReadStream(dosya).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
});

test.afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
});

async function arsiviAc(page, kip) {
  await page.goto(BASE + '/' + kip + '/MFSim_Code.html');
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.evaluate(() => veProgramArsiviOpen());
  await page.waitForSelector('#ve-programlar-body button', { timeout: 15000 });
  // Yoklama asenkron: cevabı bekle, zaman aşımına (4 sn) kadar pay bırak.
  await page.waitForTimeout(5000);
}

function sayim(page) {
  return page.evaluate(() => {
    const b = document.getElementById('ve-programlar-body');
    const btn = [...b.querySelectorAll('button')];
    return { metin: b.textContent, satir: btn.length, etkin: btn.filter((x) => !x.disabled).length };
  });
}

test.describe('Program Arşivi penceresi', () => {
  test.setTimeout(150000);

  test('arşiv yanında DEĞİLKEN: liste çizilir, satırlar pasif, sebebi yazılı', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', (e) => hatalar.push(String(e)));
    await arsiviAc(page, 'yok');
    const s = await sayim(page);

    // Katalog gömülü olduğu için liste YİNE çiziliyor: kapının kapalı olması
    // içeridekini de silmez.
    expect(s.satir).toBeGreaterThan(40);
    expect(s.etkin).toBe(0);
    expect(s.metin).toContain('yanında değil');
    expect(hatalar).toEqual([]);
  });

  test('arşiv YANINDAYKEN: satırlar etkin ve tıklanan program gerçekten açılıyor', async ({ page, context }) => {
    const hatalar = [];
    page.on('pageerror', (e) => hatalar.push(String(e)));
    await arsiviAc(page, 'var');
    const s = await sayim(page);

    expect(s.satir).toBeGreaterThan(40);
    expect(s.etkin).toBe(s.satir);
    expect(s.metin).toContain('Arşiv yanınızda');

    // Asıl teslim: satır AÇIYOR mu? Katalogdaki ilk artifact ile ölçülür.
    const i = await page.evaluate(() => veProgramlarListe().findIndex((x) => x.kume === 'artifact'));
    const beklenen = await page.evaluate((n) => veProgramlarListe()[n].dosya, i);
    const [yeni] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate((n) => veProgramArsiviAc(n), i)
    ]);
    await yeni.waitForLoadState('domcontentloaded');
    expect(decodeURIComponent(yeni.url())).toContain('programlar/' + beklenen);
    expect((await yeni.evaluate(() => document.body.innerText.trim())).length).toBeGreaterThan(200);
    expect(hatalar).toEqual([]);
  });
});
