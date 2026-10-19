/**
 * mount-step-okuma.spec.js — TAKOZ STEP OKUMASI ARAYÜZÜ KİLİTLEMEZ (gerçek tarayıcı)
 *
 * Takoz'un STEP'i bütün güç grubu (~400 MB). Eski okuyucu dosyayı tek görevde
 * okuyordu; ölçüldü (420 MB'lık deneme montajı, tools/step-olcum.js): arayüz
 * 34 sn donuyor, 576 MiB'lık dosya "Invalid string length" ile açılmıyordu.
 * Okuma dilimli (js/step-p21.js → veStepP21AgacDilimli), kart okunurken
 * ilerlemeyi ve Vazgeç'i taşır, sıkıştırılmış dosya tarayıcının akış
 * açıcısıyla parça parça açılır, büyük montajın ağacı dal dal çizilir.
 *
 * Node'da HİÇ koşmayan halkalar: gerçek dosya seçicisinden gelen baytlar,
 * MessageChannel'la dönen dilimler arasında gerçekten kare çizilmesi
 * (longtask), DecompressionStream, çubuğun kartta yerinde tazelenmesi.
 * Birim tarafı: tests/unit/step-p21.test.js · mount-wizard.test.js.
 *
 * Deneme montajı programın kendi üreteciyle (tools/step-deneme.js, 30 MB):
 * eski okuyucuda bu dosya arayüzü tek görevde ~2,5 sn tutuyordu.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const STEP = require('../helpers/step-takoz.js');
test.setTimeout(240000);

const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-step-'));
const BUYUK = path.join(DIZIN, 'deneme-30.stp');
test.beforeAll(() => {
  execFileSync(process.execPath, [path.join(__dirname, '../../tools/step-deneme.js'), '--mb', '30', '--cikti', BUYUK]);
});
test.afterAll(() => { fs.rmSync(DIZIN, { recursive: true, force: true }); });

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntOpenEditor === 'function' &&
    typeof window.veMntWizStpDosya === 'function' && typeof window.veStepP21AgacDilimli === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
}
// STEP kapısı: dosya seçici aynı tıklamada açılır
async function secici(page) {
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="step"]'),
  ]);
  return fc;
}
const hazir = (page) => page.waitForFunction(() => { const s = veMntWizStp(); return s && (s.durum === 'hazir' || s.durum === 'hata'); },
  null, { timeout: 120000 });

test('OKUMA DONMAZ: 30 MB okunurken 150 ms\'yi aşan görev yok, çubuk yerinde ilerler, ağaç dal dal', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  // Ölçülen yalnız okuma: 3B görüntüleyicinin kurulumu ayrı bir iş (3. adım)
  await page.evaluate(() => { window.veMntWiz3bAc = () => false; });
  const fc = await secici(page);
  await page.evaluate(() => {
    const o = window.__olc = { uzun: [], cubuk: [], son: null, kutu: null };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => o.uzun.push([e.startTime, e.duration])))
      .observe({ type: 'longtask' });
    const kur = window._mwStpKur;                    // okumanın sonu: kart kurulmadan
    window._mwStpKur = function () { o.son = performance.now(); return kur.apply(this, arguments); };
    (function kare() {
      const s = veMntWizStp();
      const c = document.querySelector('#ve-mw-body .ve-fw-stp .ve-fp-ilerleme');
      if (c) {
        o.cubuk.push(+c.getAttribute('aria-valuenow'));
        if (!o.kutu) {
          const r = (el) => el.getBoundingClientRect();
          const kart = r(document.querySelector('#ve-mw-body .ve-fw-stp')), b = r(c), v = r(document.getElementById('ve-mw-stp-vazgec'));
          o.kutu = { cubukEn: b.width, icinde: b.left >= kart.left && v.right <= kart.right + 0.5, dugmeYan: v.left >= b.right };
        }
      }
      if (!s || s.durum === 'okunuyor') requestAnimationFrame(kare);
    })();
  });
  await fc.setFiles(BUYUK);
  await hazir(page);
  const o = await page.evaluate(() => window.__olc);
  expect(await page.evaluate(() => veMntWizStp().durum)).toBe('hazir');
  const okuma = o.uzun.filter((e) => e[0] < o.son);
  expect(Math.max(0, ...okuma.map((e) => e[1]))).toBeLessThan(150);
  // çubuk kartın içinde, Vazgeç yanında; değer geri gitmez ve en az beş kez değişti
  expect(o.kutu).toEqual({ cubukEn: expect.any(Number), icinde: true, dugmeYan: true });
  expect(o.kutu.cubukEn).toBeGreaterThan(100);
  expect(o.cubuk.every((v, i) => i === 0 || v >= o.cubuk[i - 1])).toBe(true);
  expect(new Set(o.cubuk).size).toBeGreaterThanOrEqual(5);
  // ağaç: üst düzeyler; sayfası sığmayan dal kapalı, açılınca ilk sayfa + "daha"
  const satir = () => page.locator('#ve-mw-body table.ve-mw-tbl-stp tbody tr');
  const n0 = await satir().count();
  expect(n0).toBeLessThanOrEqual(await page.evaluate(() => VE_MW_STP_SATIR));
  const motor = page.locator('#ve-mw-body tr.ve-fw-stp-r td:first-child', { hasText: /^Motor$/ }).locator('.ve-mw-stp-ac');
  await expect(motor).toHaveAttribute('aria-expanded', 'false');
  await motor.click();
  await expect(page.locator('#ve-mw-body .ve-mw-stp-dahabtn').first()).toBeVisible();
  expect(await satir().count()).toBe(n0 + (await page.evaluate(() => VE_MW_STP_SAYFA)) + 1);
  expect(hatalar).toEqual([]);
});

test('VAZGEÇ: okuma bırakılır, kart boşalır ve sonradan dolmaz', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await page.evaluate(() => { window.veMntWiz3bAc = () => false; });
  const fc = await secici(page);
  await fc.setFiles(BUYUK);
  await page.waitForFunction(() => { const s = veMntWizStp(); return s && s.durum === 'okunuyor' && s.ilerleme.oran > 0.05; },
    null, { timeout: 60000 });
  await page.click('#ve-mw-stp-vazgec');
  expect(await page.evaluate(() => veMntWizStp())).toBeNull();
  await expect(page.locator('#ve-mw-body .ve-fw-stp .ve-fw-stp-sec')).toContainText('STEP dosyası seç');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => veMntWizStp())).toBeNull();
});

// gzip BAŞLIK ALANLARIYLA ve sıfır kuyrukla (CATIA'nın .stpZ'si gibi) · zip
function gzipBaslikli(veri) {
  const ek = Buffer.from([0x41, 0x42, 2, 0, 0x01, 0x02]);
  const xlen = Buffer.alloc(2); xlen.writeUInt16LE(ek.length, 0);
  return Buffer.concat([Buffer.from([0x1f, 0x8b, 8, 4 | 8 | 16 | 2, 0, 0, 0, 0, 0, 3]), xlen, ek,
    Buffer.from('X.stp\0', 'latin1'), Buffer.from('CATIA\0', 'latin1'), Buffer.from([0, 0]), zlib.deflateRawSync(veri), Buffer.alloc(8)]);
}
function zipYap(ad, veri) {
  const adB = Buffer.from(ad, 'utf8'), g = zlib.deflateRawSync(veri);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
  lh.writeUInt32LE(g.length, 18); lh.writeUInt32LE(veri.length, 22); lh.writeUInt16LE(adB.length, 26);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
  ch.writeUInt32LE(g.length, 20); ch.writeUInt32LE(veri.length, 24); ch.writeUInt16LE(adB.length, 28);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + adB.length, 12); eocd.writeUInt32LE(30 + adB.length + g.length, 16);
  return Buffer.concat([lh, adB, g, ch, adB, eocd]);
}

test('SIKIŞTIRILMIŞ: gzip · başlık alanlı gzip · zip tarayıcının akış açıcısıyla aynı ağaca varır', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await page.evaluate(() => {
    window.veMntWiz3bAc = () => false;
    window.__inflate = 0;
    const asil = window.veXlsInflateRaw;
    window.veXlsInflateRaw = function () { window.__inflate++; return asil.apply(this, arguments); };
  });
  const ham = Buffer.from(STEP.gucGrubu(), 'utf8');
  const dosyalar = [['guc.stpZ', zlib.gzipSync(ham), 'gzip'], ['catia.stpZ', gzipBaslikli(ham), 'gzip'], ['guc.zip', zipYap('alt/GUC.STP', ham), 'zip']];
  for (const [ad, bayt, kap] of dosyalar) {
    const fc = await secici(page).catch(async () => {
      // kart zaten açık: kartın kendi seçicisi
      const [f] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ve-mw-body .ve-fw-stp-sec')]);
      return f;
    });
    await fc.setFiles({ name: ad, mimeType: 'application/octet-stream', buffer: bayt });
    await page.waitForFunction((a) => { const s = veMntWizStp(); return s && s.dosya === a && s.durum !== 'okunuyor'; }, ad, { timeout: 30000 });
    const s = await page.evaluate(() => { const s = veMntWizStp(); return { durum: s.durum, kap: s.kap, hata: s.hata || null }; });
    expect([ad, s]).toEqual([ad, { durum: 'hazir', kap: kap, hata: null }]);
    expect(await page.locator('#ve-mw-body table.ve-mw-tbl-stp tbody tr').count()).toBe(9);
  }
  expect(await page.evaluate(() => window.__inflate)).toBe(0);         // saf JS açıcı çağrılmadı
});
