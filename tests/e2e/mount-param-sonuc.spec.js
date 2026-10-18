/**
 * mount-param-sonuc.spec.js — PARAMETRİK ANALİZ'İN SONUÇ'U (gerçek tarayıcı)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı kararı (2026-10-18): taramanın diyagramları pencerenin Sonuç
 * kategorisinde. Node'da koşmayan halkalar:
 *   · gerçek "Tara" tıklaması taramayı bitirir, Sonuç kurulur ve görüşe gelir
 *   · çizim kabın GERÇEK genişliğinde 1:1 (yazı ekrandaki boyunda) — ölçek yok
 *   · 3B gerçek fareyle döner, odakta oklar döndürür; yalnız çizim yenilenir
 *   · noktanın araç ipucu kombinasyonu söyler
 *   · sınır alanına gerçek yazım Sonuç'u tarama YİNELENMEDEN yeniler
 *   · tam ekran düğmesi büyük çizimi açar, ✕ kapatır, pencere yerinde kalır
 *   · kesit seçicisi haritayı değiştirir
 * Yerleşim ve kontrast ölçüsü yüzey turunda (yuzey-turu.js → takozTuru).
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);
test.use({ serviceWorkers: 'block' });

async function kur(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on('dialog', (d) => d.accept());
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.createNode === 'function' && typeof window.veMntLoadExample === 'function'
    && typeof window.veMntParamTara === 'function' && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 90000 });
  await page.evaluate(() => { let ex = nodes.find((x) => x.type === 'mnt-example'); if (!ex) ex = createNode('mnt-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'asfat'; veMntLoadExample(ex.id); });
  await page.waitForFunction(() => nodes.some((n) => (n.customName || '').indexOf('57RS') >= 0), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const tut = ['57RS313773', 'amc137731', 'bmc-mount1-55sh', '57RS313773-sr116', '57RS313774-sr116', 'bmc-mount1-40sh'];
    const n = createNode('mnt-parametric', 900, 120);
    n.data = { haric: Object.keys(veMntGetLibraryMap()).filter((k) => tut.indexOf(k) < 0) };
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
    return n.id;
  });
}

test('Tara → Sonuç: gerçek genişlik, 3B döner, ipucu, canlı sınır, tam ekran, kesit', async ({ page }) => {
  const hata = [];
  page.on('pageerror', (e) => hata.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') hata.push(m.text()); });
  const id = await kur(page);
  await page.waitForTimeout(500);
  await page.click('#ve-mnt-param-btn-' + id);
  await page.waitForFunction((i) => !_MNT_PARAM_IS && !!_MNT_PARAM_SONUC[i], id, { timeout: 60000 });
  await page.waitForTimeout(600);

  // Sonuç kuruldu ve görüşte
  const S = await page.evaluate((i) => {
    const kat = document.querySelector('.ve-fp-kat[data-k="sonuc"]'), ic = document.querySelector('.ve-properties-content');
    const r = kat.getBoundingClientRect(), q = ic.getBoundingClientRect();
    return { bas: [...kat.querySelectorAll('.ve-fp-sect > b')].map((b) => b.textContent), gorus: r.top < q.bottom && r.top >= q.top - 2,
      durum: document.getElementById('ve-mnt-param-st-' + i).textContent };
  }, id);
  expect(S.bas.length).toBe(11);
  expect(S.gorus).toBe(true);
  expect(S.durum).toMatch(/^Tarandı \([\d,]+ s\)$/);

  // 1:1 — her çizimin ekrandaki genişliği kendi genişliği (ölçeklenmiyor), kabı dolduruyor
  const olcu = await page.evaluate(() => [...document.querySelectorAll('.ve-fp-kat[data-k="sonuc"] svg.ve-pd')].map((s) => {
    const r = s.getBoundingClientRect(), cs = getComputedStyle(s);
    return { w: r.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth), a: Number(s.getAttribute('width')), kap: s.parentElement.clientWidth };
  }));
  expect(olcu.length).toBe(10);
  olcu.forEach((o) => { expect(Math.abs(o.w - o.a)).toBeLessThan(0.6); expect(Math.abs(o.kap - (o.a + 2))).toBeLessThan(1.5); });

  // 3B: gerçek fareyle döndür — açı değişir, yalnız çizim yenilenir (seçici yerinde)
  const sv = await page.$('.ve-pd-kap[data-pd="d2"] svg.ve-pd');
  await sv.scrollIntoViewIfNeeded();
  const b = await sv.boundingBox();
  const once = await page.evaluate(() => document.querySelector('.ve-pd-kap[data-pd="d2"] svg.ve-pd').outerHTML.length);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(b.x + b.width / 2 + k * 10, b.y + b.height / 2 + k * 3);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const kam = await page.evaluate((i) => _MNT_PARAM_KAM[i + '|d2'], id);
  expect(kam.az).toBeLessThan(235);
  expect(kam.el).toBeGreaterThan(24);
  expect(await page.evaluate(() => document.querySelector('.ve-pd-kap[data-pd="d2"] svg.ve-pd').outerHTML.length)).not.toBe(once);
  await page.keyboard.press('ArrowLeft');
  expect((await page.evaluate((i) => _MNT_PARAM_KAM[i + '|d2'], id)).az).toBe((kam.az + 5) % 360);

  // araç ipucu: Pareto cephesinin uzlaşı halkası
  const halka = await page.$('.ve-pd-kap[data-pd="d11"] circle.ve-pd-uz');
  await halka.scrollIntoViewIfNeeded();
  const hb = await halka.boundingBox();
  await page.mouse.move(hb.x + 1, hb.y + hb.height / 2);
  await page.waitForTimeout(100);
  const ip = await page.evaluate(() => { const t = document.getElementById('ve-mnt-2d-tip'); return t && t.style.display !== 'none' ? t.textContent : ''; });
  expect(ip).toMatch(/T %[\d,]+ · δs [\d,]+ mm/);
  expect(ip).toMatch(/Uygun/);

  // canlı sınır: E2 alanına gerçek yazım — tarama yinelenmez, cevap yeni sınırla
  const D0 = await page.evaluate((i) => { window.__depo = _MNT_PARAM_SONUC[i].D; return true; }, id);
  expect(D0).toBe(true);
  const alan = page.locator('#ve-mnt-param-sehimUst-' + id);
  await alan.scrollIntoViewIfNeeded();
  await alan.fill('6');
  await alan.press('Enter');
  await alan.evaluate((e) => e.blur());
  await page.waitForTimeout(300);
  const canli = await page.evaluate((i) => {
    const n = nodes.find((x) => x.id === i), H = _mntParamHazirlik(n);
    const S2 = _mntParamOzet(_MNT_PARAM_SONUC[i], veMntKatalog.baglam(H.ctx)).S;
    return { ayni: _MNT_PARAM_SONUC[i].D === window.__depo, ust: H.ctx.s.sehimUst, durum: document.getElementById('ve-mnt-param-durum-' + i).textContent, n: S2.uygunN, N: S2.N };
  }, id);
  expect(canli.ayni).toBe(true);
  expect(canli.ust).toBe(6);
  expect(canli.durum).toBe('Uygun ' + canli.n + ' / ' + canli.N);

  // tam ekran: gerçek düğme, büyük çizim, ✕ kapatır, pencere yerinde
  const tam = page.locator('.ve-fp-kat[data-k="sonuc"] .ve-pd-tam[aria-label="Tam ekran · Pareto cephesi"]');
  await tam.scrollIntoViewIfNeeded();
  await tam.click();
  await page.waitForSelector('#ve-mnt-fs svg.ve-pd');
  expect(await page.evaluate(() => Number(document.querySelector('#ve-mnt-fs svg.ve-pd').getAttribute('width')))).toBeGreaterThan(1000);
  await page.click('#ve-mnt-fs-x');
  await expect(page.locator('#ve-mnt-fs')).toHaveCount(0);
  await expect(page.locator('.ve-fp-kat[data-k="sonuc"]')).toHaveCount(1);

  // kesit seçicisi: eksen çifti değişince harita değişir
  const harita = () => page.evaluate(() => document.querySelector('.ve-pd-kap[data-pd="d4"] svg.ve-pd').outerHTML);
  const h0 = await harita();
  await page.selectOption('.ve-fp-kat[data-k="sonuc"] .ve-pd-kesit select >> nth=0', '0,1');
  await page.waitForTimeout(200);
  expect(await harita()).not.toBe(h0);

  expect(hata).toEqual([]);
});

// EYLEM SATIRI (kullanıcı 2026-10-18: *"Tara … dediğimde program kasıyor. Ona
// bir progress bar tarzı bir şey oluşturalım. Ayrıca … butonu çok geniş ve
// büyük"*). Ölçülen önce (main 46465f1, ASFAT, 379 px'lik sütun): düğme
// 359 × 40, ilerleme yazısı kaydırma alanının 830 px altında, 19.683
// kombinasyonluk taramada 114–131 uzun görev (> 50 ms; parça 50 ms ve 200
// kombinasyondu). Burada 729 kombinasyon: eski parçayla ~8 uzun görev.
test('EYLEM SATIRI: kompakt düğme, satır alta yapışık, ilerleme görünür ve ilerler, tarama dilimli — uzun görev yok', async ({ page }) => {
  const hata = [];
  page.on('pageerror', (e) => hata.push(String(e)));
  const id = await kur(page);
  await page.evaluate((i) => {                                   // bütün adaylar, bir grup sabit: 27 × 27
    const n = nodes.find((x) => x.id === i), G = _mntParamModel().G;
    n.data = { sabit: { [G[1].anahtar]: true } };
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); showNodeProperties(n);
  }, id);
  await page.waitForTimeout(600);
  const geo = () => page.evaluate((i) => {
    const ic = document.querySelector('.ve-properties-content'), s = document.querySelector('.ve-properties-content .ve-fp-yurut');
    const b = document.getElementById('ve-mnt-param-btn-' + i), il = s.querySelector('.ve-fp-ilerleme');
    const r = (e) => e.getBoundingClientRect(), q = r(ic), rs = r(s), rb = r(b);
    return { tasar: ic.scrollHeight > ic.clientHeight + 40, dip: Math.round(q.bottom - rs.bottom), sw: rs.width, bw: rb.width, bh: rb.height,
      sag: Math.round(rs.right - rb.right), metin: b.textContent.trim(),
      il: il ? { gorus: r(il).top >= q.top && r(il).bottom <= q.bottom + 1, y: il.querySelector('span').textContent, v: +il.getAttribute('aria-valuenow') } : null };
  }, id);
  const g0 = await geo();
  expect(g0.tasar).toBe(true);                                  // içerik taşıyor — satır yapışık olmalı
  expect(Math.abs(g0.dip)).toBeLessThanOrEqual(1);              // satır kaydırma alanının dibinde
  expect(g0.bh).toBeLessThanOrEqual(32);                        // kompakt: eskisi 40 px ve sütunun eninde
  expect(g0.bw).toBeLessThan(0.4 * g0.sw);
  expect(g0.sag).toBeGreaterThanOrEqual(8);                     // sağa yaslı, satırın dolgusuyla
  expect(g0.sag).toBeLessThanOrEqual(12);
  expect(g0.metin).toBe('Tara');
  expect(g0.il).toBeNull();

  await page.evaluate((i) => {
    window.__uzun = []; window.__son = Infinity; window.__deger = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__uzun.push([e.startTime, e.duration]))).observe({ type: 'longtask' });
    const k = window._mntParamSonucKaydet;
    window._mntParamSonucKaydet = function () { window.__son = performance.now(); return k.apply(this, arguments); };
    new MutationObserver(() => { const il = document.querySelector('.ve-fp-yurut[data-is] .ve-fp-ilerleme'); if (il) window.__deger.push(+il.getAttribute('aria-valuenow')); })
      .observe(document.querySelector('.ve-properties-content'), { subtree: true, attributes: true, childList: true, attributeFilter: ['aria-valuenow'] });
  }, id);
  await page.click('#ve-mnt-param-btn-' + id);
  const g1 = await geo();
  expect(g1.metin).toBe('Durdur');
  expect(g1.il && g1.il.gorus).toBe(true);                      // ilerleme düğmenin yanında, görüşte
  expect(g1.il.y).toMatch(/^Kombinasyon [\d.]+ \/ 729$/);
  await page.waitForFunction((i) => !_MNT_PARAM_IS && !!_MNT_PARAM_SONUC[i], id, { timeout: 120000 });
  await page.waitForTimeout(400);
  const S = await page.evaluate(() => ({ uzun: window.__uzun.filter((u) => u[0] < window.__son).map((u) => Math.round(u[1])), son: window.__son, deger: window.__deger }));
  expect(Number.isFinite(S.son)).toBe(true);
  expect(S.uzun.length).toBeLessThanOrEqual(1);                 // tarama boyunca (bitiş evresi hariç) — tek bir GC payı
  const ara = S.deger.filter((v) => v > 0 && v < 100);
  expect(new Set(ara).size).toBeGreaterThanOrEqual(2);          // çubuk gerçekten ilerliyor
  S.deger.forEach((v, k) => { if (k) expect(v).toBeGreaterThanOrEqual(S.deger[k - 1]); });
  const g2 = await geo();
  expect(g2.metin).toBe('Tara');
  expect(g2.il).toBeNull();
  expect(await page.evaluate((i) => document.getElementById('ve-mnt-param-st-' + i).textContent, id)).toMatch(/^Tarandı \([\d,]+ s\)$/);
  expect(hata).toEqual([]);
});
