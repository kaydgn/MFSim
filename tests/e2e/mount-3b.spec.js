/**
 * mount-3b.spec.js — TAKOZ 3B GÖRÜNTÜLEYİCİSİ: BÜYÜK MONTAJ (gerçek tarayıcı)
 *
 * 2026-10-20, Takoz adım 3. Ölçüldü (420 MB'lık deneme montajı, Chromium):
 * eski görüntüleyici bütün montajı tek bağlamla üçgenliyordu (yığın tepesi
 * 3,2 GB), kurulum bitene dek montajı gizliyordu ve parça başına iki nesneyle
 * (23.388 çizim çağrısı) bir döndürme karesini 190 ms'de kuruyordu.
 *
 * Node'da HİÇ koşmayan halkalar: WebGL kümeleri ve gölgelendirici eki,
 * kurulum sürerken çizim, Durdur · Devam düğmeleri, fareyle tıklayıp seçme,
 * 3B'den rol ve hesap. Birim tarafı: mount-step.test.js → *AĞ İŞİ* ·
 * mount-wizard.test.js → *HESAP BEKLER* · mount-3b.test.js.
 * Deneme montajı programın üreteciyle (tools/step-deneme.js, 5 MB, 151 parça).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const STEP = require('../helpers/step-takoz.js');
test.setTimeout(180000);

const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-3b-'));
const DENEME = path.join(DIZIN, 'deneme-5.stp');
const GUC = path.join(DIZIN, 'guc.stp');
test.beforeAll(() => {
  execFileSync(process.execPath, [path.join(__dirname, '../../tools/step-deneme.js'), '--mb', '5', '--cikti', DENEME]);
  fs.writeFileSync(GUC, STEP.gucGrubu());
});
test.afterAll(() => { fs.rmSync(DIZIN, { recursive: true, force: true }); });

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntOpenEditor === 'function' &&
    typeof window.veMntWiz3bAc === 'function' && typeof window.THREE !== 'undefined' && Array.isArray(window.nodes),
    null, { timeout: 90000 });
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
async function dosyaSec(page, dosya) {
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="step"]'),
  ]);
  await fc.setFiles(dosya);
}
const durum = (page) => page.evaluate(() => veMntWiz3bDurum());
const hazir = (page) => page.waitForFunction(() => {
  const k = document.getElementById('ve-mw-3b-tuval');
  return k && k.getAttribute('data-durum') === 'hazir';
}, null, { timeout: 120000 });

test('PARÇA PARÇA: kurulurken montaj görünür, çizim kümelerde, ortak işin dilimi kısa', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  // Ortak işin dilimleri ve kurulum sürerken çizilen kareler sayfanın içinde ölçülür
  await page.evaluate(() => {
    const o = window.__olc = { adim: [], araKare: 0 };
    const J0 = window.veMntStpAgIs;
    window.veMntStpAgIs = function () {
      const J = J0.apply(this, arguments), ad = J.adim;
      J.adim = function (b) { const t = performance.now(); const r = ad(b); o.adim.push(performance.now() - t); return r; };
      return J;
    };
    const ac = window.veMntWiz3bAc;
    window.veMntWiz3bAc = function () {
      const r = ac.apply(this, arguments), V = window._mw3b, ro = V.renderer.render.bind(V.renderer);
      V.renderer.render = function (s, c) {
        ro(s, c);
        if (V.kap.getAttribute('data-durum') === 'kuruluyor' && V.renderer.info.render.triangles > 0) o.araKare++;
      };
      return r;
    };
  });
  await dosyaSec(page, DENEME);
  await hazir(page);
  const d = await durum(page);
  const o = await page.evaluate(() => window.__olc);
  const parca = await page.evaluate(() => veMntWizStp().sonuc._geo.filter((g) => g.yuzler.length).length);
  expect(d.islenen).toBe(parca);
  expect(d.toplam).toBe(parca);
  // Kurulum bitmeden montaj çizildi (eski görüntüleyici sonuna dek gizliydi)
  expect(o.araKare).toBeGreaterThan(0);
  // Çizim çağrısı parça sayısından bağımsız: kümeler (eskiden parça başına iki)
  expect(d.cagri).toBe(d.kume + d.cizgiKume);
  expect(d.cagri).toBeLessThanOrEqual(8);
  expect(d.cagri * 20).toBeLessThan(2 * parca);
  // Ortak işin dilimi bütçesini (10 ms) en çok bir yüz aşar
  expect(Math.max(...o.adim)).toBeLessThan(60);
  // Kurulumun kutusu kalktı; ağlar kümeye bakan görünüm (veri iki kez tutulmuyor)
  await expect(page.locator('#ve-mw-3b-kur')).toBeHidden();
  const gorunum = await page.evaluate(() => {
    const V = window._mw3b, s = veMntWizStp();
    return V.ekli.every((i) => s.ag[i].uc.buffer === V.kume[V.parca[i].b].poz.buffer);
  });
  expect(gorunum).toBe(true);
  expect(hatalar).toEqual([]);
});

test('DURDUR · DEVAM: durunca üretim durur ve çizilen kalır; Devam bitirir', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, DENEME);
  await page.waitForFunction(() => { const d = veMntWiz3bDurum(); return d && d.islenen >= 10; }, null, { timeout: 60000 });
  await page.click('#ve-mw-3b-durdur');
  const d1 = await durum(page);
  expect(d1.durum).toBe('durdu');
  await expect(page.locator('#ve-mw-3b-kur')).toContainText('Durduruldu');
  await page.waitForTimeout(800);
  const d2 = await durum(page);
  expect(d2.islenen).toBeLessThanOrEqual(d1.islenen + 1);   // yarım kalan parça biter, yenisine başlanmaz
  expect(d2.islenen).toBeLessThan(d2.toplam);
  expect(d2.parca).toBeGreaterThan(0);
  await page.click('#ve-mw-3b-devam');
  await hazir(page);
  const d3 = await durum(page);
  expect(d3.islenen).toBe(d3.toplam);
  await expect(page.locator('#ve-mw-3b-kur')).toBeHidden();
});

test('SEÇ · ROL · HESAP: tıklanan parça seçilir ve öteki parçalar solar; rol 3B\'den, hesap noktayı çizer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, GUC);
  await hazir(page);
  const motor = await page.evaluate(() => veMntWizStp().sonuc.parcalar.filter((p) => p.ad === 'Motor bloğu')[0]);
  const q = await page.evaluate((i) => veMntWiz3bIsabetNoktasi(i), motor.i);
  expect(q).not.toBeNull();
  await page.mouse.click(q.x, q.y);
  await expect.poll(async () => (await durum(page)).secili).toBe(motor.dugum);
  // Seçim dışı soluk: kümelerin soluk çizimi açık (çağrı kadar artar)
  const soluk = await page.evaluate(() => { const V = window._mw3b; return V.kume.every((K) => K.soluk.visible); });
  expect(soluk).toBe(true);
  await page.click('#ve-mw-3b-alt [data-ve-3b-rol="mnt-motor"]');
  await expect.poll(() => page.evaluate((d) => veMntWizStp().roller[d], motor.dugum)).toBe('mnt-motor');
  await page.click('#ve-mw-3b-hesapla');
  await expect.poll(async () => (await durum(page)).nokta).toBe(1);
  const coz = await page.evaluate(() => { const c = veMntWizStp().coz; return c && c.birimler.map((b) => [b.ad, b.kaynak]); });
  expect(coz).toEqual([['Motor bloğu', 'hacim']]);
});
