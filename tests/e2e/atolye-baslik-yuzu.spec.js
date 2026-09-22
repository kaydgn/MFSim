/**
 * atolye-baslik-yuzu.spec.js — BAŞLIK YÜZÜ GERÇEKTEN ÇİZİLİYOR MU?
 * ─────────────────────────────────────────────────────────────────
 *
 * Bu halkalar Node'da HİÇ KOŞAMAZ. jsdom font yüklemez, `document.fonts`
 * yoktur, `getComputedStyle().fontFamily` yalnız BİLDİRİLEN dizeyi döndürür —
 * yani birim testi "yüz bağlandı" der, ekranda Georgia görünür, ikisi de yeşil.
 *
 * ÖLÇÜM `measureText` İLE, `document.fonts.check` İLE DEĞİL. Bu spec'in ilk
 * yazımı `check()` kullanıyordu ve KAPI BOŞTU: ölçüldü (2026-09-22) —
 *
 *     document.fonts.check('600 16px "Zzz Yok Boyle Bir Aile"')  →  true
 *
 * Spec'e göre `check()` "bu metni çizmek için YÜKLENMESİ GEREKEN bir yüz
 * kaldı mı" sorusunu cevaplıyor; hiç eşleşen yüz yoksa cevap "hayır, kalmadı"
 * yani `true`. Yedek yüze düşen bir harf de aynı şekilde `true` döner.
 * Kanıtlandı: `fonts-display.css`'ten latin-ext yüzü TAMAMEN SİLİNDİ, dört
 * test de yeşil kaldı.
 *
 * Gerçek ölçüt GENİŞLİK: aynı harf `"Source Serif 4", monospace` ile ve
 * çıplak `monospace` ile çizilir. Harf yüzde VARSA genişlikler ayrışır; yoksa
 * ikisi de monospace'e düşer ve BİREBİR aynı çıkar.
 *
 * ÜRÜNÜN KENDİSİ açılır (MFSim_Code.html): yüz base64 gömülü ve gömme yolu
 * build.js'ten geçiyor.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '../..');
const BUILD = path.join(ROOT, 'MFSim_Code.html');
const AILE = 'Source Serif 4';

test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});

async function ac(page) {
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
}

// Harf harf ölçer: eksik olan HANGİSİ olduğu görünsün.
async function yuzdeOlmayanHarfler(page, aile, harfler) {
  return page.evaluate(([a, hs]) => {
    const c = document.createElement('canvas').getContext('2d');
    const w = (f, t) => { c.font = f; return c.measureText(t).width; };
    return [...hs].filter((h) => {
      const yuz = w('600 100px "' + a + '", monospace', h);
      const yedek = w('600 100px monospace', h);
      return Math.abs(yuz - yedek) < 0.5;   // ayrışmadıysa yedeğe düşmüş
    });
  }, [aile, harfler]);
}

test('başlık yüzü GERÇEKTEN yüklendi — latin alt kümesi çiziliyor', async ({ page }) => {
  await ac(page);
  expect(await yuzdeOlmayanHarfler(page, AILE, 'AaZz0189')).toEqual([]);
});

test('TÜRKÇE alfabe başlık yüzünde — iki alt küme de geldi', async ({ page }) => {
  await ac(page);
  // ı (U+0131) `latin` alt kümesinde, ğşİĞŞ (U+0100-02BA) `latin-ext`te.
  // Biri eksikse "Çözücü" başlığı ekranda İKİ AYRI yazı tipiyle yazılır.
  expect(await yuzdeOlmayanHarfler(page, AILE, 'çğıöşüÇĞİÖŞÜ')).toEqual([]);
});

// Ölçümün kendisinin boş olmadığının kanıtı: var olmayan bir aile ile AYNI
// çağrı bütün harfleri "eksik" saymalı. Bu halka düşerse yukarıdaki iki
// testin yeşilliği hiçbir şey ifade etmez.
test('ölçüm boş değil — var olmayan aile bütün harfleri eksik sayıyor', async ({ page }) => {
  await ac(page);
  const harfler = 'AaÇğış';
  expect(await yuzdeOlmayanHarfler(page, 'Zzz Yok Boyle Bir Aile', harfler))
    .toEqual([...harfler]);
});

test('gerçek bir başlık serifle çiziliyor, gövde sans kalıyor', async ({ page }) => {
  await ac(page);
  const olcum = await page.evaluate(() => {
    const yap = (etiket) => {
      const el = document.createElement(etiket);
      el.textContent = 'Çözücü Ayarları ğışİĞŞ';
      document.body.appendChild(el);
      const r = getComputedStyle(el).fontFamily;
      el.remove();
      return r;
    };
    return { baslik: yap('h3'), govde: yap('div') };
  });
  expect(olcum.baslik).toContain(AILE);
  expect(olcum.govde).toContain('Inter');
  expect(olcum.govde).not.toContain(AILE);
});

test('yüz GÖMÜLÜ — tek dosya açılırken ağ isteği yok', async ({ page }) => {
  const dis = [];
  page.on('request', (r) => { if (!r.url().startsWith('file://')) dis.push(r.url()); });
  await ac(page);
  expect(dis).toEqual([]);
});
