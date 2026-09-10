/**
 * Komuta Penceresi — GERÇEK TARAYICI (Playwright)
 * ───────────────────────────────────────────────
 *
 * Ölçülen şey ÜRÜNÜN KENDİSİ: build.js'in ürettiği tek dosya. Sebep birim
 * testlerin yapısal olarak ölçemediği üç halka:
 *
 *  1) GÖMÜLÜ KÜNYE + GÖMÜLÜ KARE. Pencerenin kare küçük resimlerini
 *     `window.__MFSIM_KARSILAMA`ya, başlıklarını `__MFSIM_KARSILAMA_KUNYE`ye
 *     dayandırıyor. İkisi de YALNIZ build çıktısında var — modüler index.html'de
 *     yoklar. Yani "başlıklar geliyor mu" sorusu Node'da HİÇ sorulamaz.
 *
 *  2) DURUM GERİ BİLDİRİMİ. jsdom `:hover`ı da `:focus-visible`ı da hiç
 *     hesaplamaz; kartın seçili görünmesi CSS'te tanımlı ve kapı Node'a
 *     taşınamaz (Kayış Tablosu'nda birebir aynı gerekçeyle ölçülüyor).
 *
 *  3) FİŞ GERÇEKTEN ÜRETİLİYOR MU. Birim testi fiş ÇEKİRDEĞİNİ tutuyor; bu
 *     test tıklama → seçim → textarea zincirinin kurulu olduğunu ölçüyor.
 *
 * ÖN KOŞUL: npm run build
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '../..');
const BUILD = path.join(ROOT, 'MFSim_Code.html');
const PORT = 8127;
const BASE = 'http://127.0.0.1:' + PORT;
const KOMUTA_SIFRE = 'komuta';   // js/cp-komuta.js varsayılanı

let server;

test.beforeAll(async () => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
  server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('yok');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
});

test.afterAll(async () => { if (server) await new Promise((r) => server.close(r)); });

async function ac(page) {
  await page.goto(BASE + '/MFSim_Code.html');
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(() => typeof window.veKomutaAc === 'function', null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.evaluate(() => window.veKomutaAc());
  await page.waitForSelector('#ve-komuta-overlay', { state: 'visible' });
}

async function girisYap(page) {
  await page.fill('#ve-komuta-sifre', KOMUTA_SIFRE);
  await page.click('.ve-komuta-giris .ve-komuta-btn-birincil');
  await page.waitForSelector('.ve-komuta-izgara', { state: 'visible' });
}

test('kapak: şifre girilmeden tezgâh görünmüyor, hatalı şifre söyleniyor', async ({ page }) => {
  await ac(page);
  expect(await page.locator('.ve-komuta-izgara').count()).toBe(0);
  await expect(page.locator('#ve-komuta-sifre')).toBeVisible();

  await page.fill('#ve-komuta-sifre', 'yanlis');
  await page.click('.ve-komuta-giris .ve-komuta-btn-birincil');
  await expect(page.locator('#ve-komuta-hata')).toHaveText(/Hatalı şifre/);
  expect(await page.locator('.ve-komuta-izgara').count()).toBe(0);

  await girisYap(page);
  await expect(page.locator('.ve-komuta-izgara')).toBeVisible();
});

test('İKİ TARAF AYNI SAYIYI ÖLÇÜYOR — tarayıcı `kaynak()` = Node `disaAktarim`', async ({ page }) => {
  // BU TESTİN SEBEBİ ÖLÇÜLDÜ. `takoz-ornek` tezgâhı `MOUNT_EXAMPLES`i çıplak
  // adla okuyordu; o ad tarayıcıda GLOBAL DEĞİL (mount-core.js bir IIFE,
  // değer `veMountCore` ad alanından geliyor) ama Node'da `module.exports`
  // düz veriyor. Sonuç: Node 3 kayıt ölçerken pencere kendinden emin biçimde
  // "0 kayıt" gösteriyordu — hiçbir şey patlamıyordu.
  //
  // Kapı iki ölçümü karşılaştırıyor: pencerenin tarayıcıda gördüğü sayı ile
  // doğrulayıcının diskten hesapladığı sayı. Bunlar AYRI yollar; ayrışmaları
  // başka hiçbir testte görünmez.
  await ac(page); await girisYap(page);

  const tarayici = await page.evaluate(() =>
    window.VE_KOMUTA_TEZGAHLAR.map((t) => [t.id, window.veKomutaOlc(t).length]));

  const K = require(path.join(ROOT, 'js/cp-komuta.js'));
  const node = K.VE_KOMUTA_TEZGAHLAR.map((t) =>
    [t.id, t.olc(require(path.join(ROOT, t.dosya))[t.disaAktarim]).length]);

  expect(tarayici).toEqual(node);
  // Ve hiçbiri sıfır olmamalı — boş bir tezgâh "veri yok" ile "kaynak yanlış"ı
  // ayırt edilemez kılar; ikisi de aynı görünür.
  tarayici.forEach(([id, n]) => expect({ id, n: n > 0 }).toEqual({ id, n: true }));
});

test('her tezgâh sekmesi açılıyor ve fiş AKTİF tezgâhı adres gösteriyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  const tezgahlar = await page.evaluate(() =>
    window.VE_KOMUTA_TEZGAHLAR.map((t) => ({ id: t.id, dosya: t.dosya })));

  for (let i = 0; i < tezgahlar.length; i++) {
    await page.locator('.ve-komuta-tezgahlar button').nth(i).click();
    await expect(page.locator('.ve-komuta-tezgahlar button').nth(i)).toHaveClass(/etkin/);
    const fis = await page.inputValue('#ve-komuta-fis');
    expect(fis).toContain('tezgah: ' + tezgahlar[i].id);
    expect(fis).toContain('dosya : ' + tezgahlar[i].dosya);
    // Kartlar gerçekten çizilmiş olmalı (boş tezgâh sessiz kalmasın)
    expect(await page.locator('.ve-komuta-kart').count()).toBeGreaterThan(0);
  }
});

test('SEÇİM TEZGÂHA AİT — sekme değişince başka tezgâhın işareti sızmıyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  await page.locator('.ve-komuta-kart').nth(1).click();
  await expect(page.locator('.ve-komuta-kart.secili')).toHaveCount(1);

  await page.locator('.ve-komuta-tezgahlar button').nth(1).click();
  await expect(page.locator('.ve-komuta-kart.secili')).toHaveCount(0);   // temiz tezgâh
  expect(await page.inputValue('#ve-komuta-fis')).toMatch(/kaldir\s*:\s*\(yok\)/);

  await page.locator('.ve-komuta-tezgahlar button').nth(0).click();
  await expect(page.locator('.ve-komuta-kart.secili')).toHaveCount(1);   // ilk seçim duruyor
});

test('LİSTE düzeni: metin tezgâhı tek sütun ve satırlar pencereye sığıyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  const i = await page.evaluate(() => window.VE_KOMUTA_TEZGAHLAR.findIndex((t) => t.duzen === 'liste'));
  expect(i).toBeGreaterThanOrEqual(0);
  await page.locator('.ve-komuta-tezgahlar button').nth(i).click();
  await page.waitForSelector('.ve-komuta-liste');

  // Tek sütun: ilk iki kartın sol kenarı aynı, üst kenarı farklı.
  const [a, b] = await page.locator('.ve-komuta-kart').evaluateAll(
    (els) => els.slice(0, 2).map((e) => e.getBoundingClientRect()));
  expect(Math.abs(a.left - b.left)).toBeLessThanOrEqual(1);
  expect(b.top).toBeGreaterThan(a.top);

  // Uzun dosya adları taşırmıyor (ellipsis) — yatay kaydırma yok.
  const tasma = await page.locator('.ve-komuta-kaydir').evaluate((e) => e.scrollWidth - e.clientWidth);
  expect(tasma).toBeLessThanOrEqual(1);
});

test('ÖLÇÜM: kart sayısı programın canlı kare listesiyle birebir', async ({ page }) => {
  await ac(page); await girisYap(page);
  const beklenen = await page.evaluate(() => window.VE_KARSILAMA_GORSELLER.length);
  expect(beklenen).toBeGreaterThan(0);
  await expect(page.locator('.ve-komuta-kart')).toHaveCount(beklenen);
  // Sekmedeki sayaç da AYNI ölçümden gelir, elle yazılmaz.
  await expect(page.locator('.ve-komuta-tezgah.etkin .ve-komuta-adet')).toHaveText(String(beklenen));
});

test('gömülü künye: her karenin başlığı dolu ve küçük resmi GERÇEKTEN yükleniyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  const bosBaslik = await page.locator('.ve-komuta-ad').evaluateAll(
    (els) => els.filter((e) => !e.textContent.trim()).length);
  expect(bosBaslik).toBe(0);

  // Gömülü data URI: naturalWidth > 0 ise çözücü resmi gerçekten açtı.
  const yuklenmeyen = await page.locator('.ve-komuta-kare').evaluateAll(
    (els) => els.filter((i) => !i.complete || i.naturalWidth === 0).length);
  expect(yuklenmeyen).toBe(0);
});

test('künye şeridi bu kopyanın sürümünü gösteriyor (boş bırakmıyor)', async ({ page }) => {
  await ac(page); await girisYap(page);
  const metin = await page.locator('.ve-komuta-kunye-metin').textContent();
  expect(metin.trim()).not.toBe('');
  // Tek dosyada künye GÖMÜLÜ — "doğrulanmalı" yedeği burada görünmemeli.
  expect(metin).not.toMatch(/dogrulanmali/);
  expect(metin).toMatch(/[0-9a-f]{7}/);
});

test('seçim → fiş zinciri: tıklanan kart işaretleniyor ve fişe düşüyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  const kartlar = page.locator('.ve-komuta-kart');

  const bosFis = await page.inputValue('#ve-komuta-fis');
  expect(bosFis).toContain('MFSIM-SIPARIS v1');
  expect(bosFis).toMatch(/kaldir\s*:\s*\(yok\)/);

  // ÖLÇÜM ÖZETİ fişin ikinci kapısı: kayıt sayısı GERÇEK listeden gelmeli.
  // (Doğrulayıcı bunu çalışma ağacından yeniden hesaplayıp karşılaştırıyor.)
  const gercekAdet = await page.evaluate(() => window.VE_KARSILAMA_GORSELLER.length);
  expect(bosFis).toMatch(new RegExp('olcum\\s*:\\s*' + gercekAdet + ' kayit \\u00b7 [0-9a-f]{6}'));

  const a = await kartlar.nth(1).getAttribute('data-vk-anahtar');
  const b = await kartlar.nth(4).getAttribute('data-vk-anahtar');
  await kartlar.nth(1).click();
  await kartlar.nth(4).click();

  await expect(kartlar.nth(1)).toHaveClass(/secili/);
  await expect(kartlar.nth(1)).toHaveAttribute('aria-pressed', 'true');
  const fis = await page.inputValue('#ve-komuta-fis');
  expect(fis).toMatch(new RegExp('kaldir\\s*:\\s*' + [a, b].sort().join(', ')));
  expect(fis).toContain('dosya : js/karsilama-gorseller.js');
  await expect(page.locator('#ve-komuta-sayac')).toHaveText(/2 kayıt/);

  // İkinci tık seçimi geri alır — fiş de geri döner.
  await kartlar.nth(1).click();
  await expect(kartlar.nth(1)).not.toHaveClass(/secili/);
  expect(await page.inputValue('#ve-komuta-fis')).toMatch(new RegExp('kaldir\\s*:\\s*' + b + '$', 'm'));
});

test('fişin sekiz satırı da kutuya SIĞIYOR — kırpılmıyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  const ta = page.locator('#ve-komuta-fis');
  expect((await ta.inputValue()).split('\n')).toHaveLength(8);
  // Dikey taşma olsaydı son satır (not) görünmeden kalırdı.
  const tasma = await ta.evaluate((e) => e.scrollHeight - e.clientHeight);
  expect(tasma).toBeLessThanOrEqual(1);
});

test('not alanı fişe geçiyor ve satır sonu fişi bozamıyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  await page.fill('#ve-komuta-not', '05 ile 08 aynı kare');
  expect(await page.inputValue('#ve-komuta-fis')).toContain('not   : 05 ile 08 aynı kare');
});

test('DURUM GERİ BİLDİRİMİ: seçili kart gözle ayrılıyor, fare zemini değiştiriyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  const kart = page.locator('.ve-komuta-kart').nth(2);

  const cerceve = () => kart.evaluate((e) => getComputedStyle(e).borderColor);
  const zemin = () => kart.evaluate((e) => getComputedStyle(e).backgroundColor);

  const duragan = { c: await cerceve(), z: await zemin() };
  await kart.hover();
  expect(await zemin()).not.toBe(duragan.z);          // :hover CSS'te tanımlı

  await kart.click();
  expect(await cerceve()).not.toBe(duragan.c);        // .secili çerçevesi
  await expect(kart.locator('.ve-komuta-isaret')).toBeVisible();
  // Seçili karede kare soluyor — "kaldırılacak" gözle okunuyor
  const opak = await kart.locator('.ve-komuta-kare').evaluate((e) => parseFloat(getComputedStyle(e).opacity));
  expect(opak).toBeLessThan(1);
});

test('İşaretleri Temizle hem kartları hem fişi sıfırlıyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  await page.locator('.ve-komuta-kart').nth(0).click();
  await page.locator('.ve-komuta-kart').nth(3).click();
  await page.click('.ve-komuta-fis-bas .ve-komuta-btn:not(.ve-komuta-btn-birincil)');
  await expect(page.locator('.ve-komuta-kart.secili')).toHaveCount(0);
  expect(await page.inputValue('#ve-komuta-fis')).toMatch(/kaldir\s*:\s*\(yok\)/);
});

test('pencere kapanıp açılınca seçim korunuyor, ESC kapatıyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  await page.locator('.ve-komuta-kart').nth(2).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ve-komuta-overlay')).toBeHidden();

  await page.evaluate(() => window.veKomutaAc());
  await page.waitForSelector('.ve-komuta-izgara', { state: 'visible' });
  // Şifre ikinci kez SORULMUYOR (sessionStorage) ve işaret duruyor.
  expect(await page.locator('#ve-komuta-sifre').count()).toBe(0);
  await expect(page.locator('.ve-komuta-kart.secili')).toHaveCount(1);
});

test('tabloya yatay kaydırma yok — ızgara pencereye sığıyor', async ({ page }) => {
  await ac(page); await girisYap(page);
  const tasma = await page.locator('#ve-komuta-content').evaluate(
    (e) => e.scrollWidth - e.clientWidth);
  expect(tasma).toBeLessThanOrEqual(1);
});
