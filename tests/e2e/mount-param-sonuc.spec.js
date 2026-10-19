/**
 * mount-param-sonuc.spec.js — PARAMETRİK ANALİZ'İN SONUÇ'U (gerçek tarayıcı)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı kararları (2026-10-18): taramanın sonucu pencerenin Sonuç
 * kategorisinde — "Tablo + iki sade grafik, diğer diyagramlar kalsın fakat
 * kullanıcı istediği zaman açabilsin". Node'da koşmayan halkalar:
 *   · gerçek "Tara" tıklaması taramayı bitirir, Sonuç kurulur ve görüşe gelir
 *   · iki grafik kabın GERÇEK genişliğinde 1:1 (yazı ekrandaki boyunda)
 *   · önerinin halkası ve mod çentiği gerçek fareyle ipucu verir
 *   · sınır alanına gerçek yazım Sonuç'u tarama YİNELENMEDEN yeniler
 *   · Diyagramlar listesi galeriyi açar; soldaki listeden geçiş aynı katmanda;
 *     3B gerçek fareyle ve oklarla döner; kesit seçicisi haritayı değiştirir;
 *     ✕ kapatır, pencere yerinde kalır
 *   · Modele uygula gerçek tıkla takozlara yazar, tek geri-al adımı, Ctrl+Z
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

test('Tara → Sonuç: yedi bölüm, iki grafik 1:1, ipucu, canlı sınır; galeri: liste, geçiş, 3B, kesit', async ({ page }) => {
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
      durum: document.getElementById('ve-mnt-param-st-' + i).textContent, liste: kat.querySelectorAll('.ve-prm-dg').length };
  }, id);
  expect(S.bas).toEqual(['Öneri', 'Kriterler', 'Modlar', 'Statik sehim ve iletilebilirlik', 'Yakın seçenekler', 'Eleme', 'Diyagramlar']);
  expect(S.gorus).toBe(true);
  expect(S.durum).toMatch(/^Tarandı \([\d,]+ s\)$/);
  expect(S.liste).toBe(10);

  // 1:1 — iki grafiğin ekrandaki genişliği kendi genişliği (ölçeklenmiyor), kabı dolduruyor
  const olcu = await page.evaluate(() => [...document.querySelectorAll('.ve-fp-kat[data-k="sonuc"] svg.ve-pd')].map((s) => {
    const r = s.getBoundingClientRect(), cs = getComputedStyle(s);
    return { pd: s.parentElement.getAttribute('data-pd'), w: r.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth),
      a: Number(s.getAttribute('width')), kap: s.parentElement.clientWidth };
  }));
  expect(olcu.map((o) => o.pd)).toEqual(['mod', 'dag']);
  olcu.forEach((o) => { expect(Math.abs(o.w - o.a)).toBeLessThan(0.6); expect(Math.abs(o.kap - (o.a + 2))).toBeLessThan(1.5); });

  // araç ipucu: önerinin halkası (kombinasyon, amaçlar, hüküm) ve bir mod çentiği
  const ipucu = async (sec) => {
    const el = await page.$(sec);
    await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 1);
    await page.waitForTimeout(100);
    return page.evaluate(() => { const t = document.getElementById('ve-mnt-2d-tip'); return t && t.style.display !== 'none' ? t.textContent : ''; });
  };
  const ip = await ipucu('.ve-pd-kap[data-pd="dag"] circle.ve-pd-uz');
  expect(ip).toMatch(/T %[\d,]+ · δs [\d,]+ mm/);
  expect(ip).toMatch(/Uygun/);
  expect(await ipucu('.ve-pd-kap[data-pd="mod"] rect.ve-pd-hit[data-ip]')).toMatch(/^Mevcut · 1\. mod/);

  // canlı sınır: statik sehim üst sınırına gerçek yazım — tarama yinelenmez, cevap yeni sınırla
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
    const sat = [...document.querySelectorAll('table.ve-prm-kriter tbody tr')].find((r) => r.getAttribute('data-k') === 'sehim');
    return { ayni: _MNT_PARAM_SONUC[i].D === window.__depo, ust: H.ctx.s.sehimUst, durum: document.getElementById('ve-mnt-param-durum-' + i).textContent,
      n: S2.uygunN, N: S2.N, sinir: sat.children[1].textContent };
  }, id);
  expect(canli.ayni).toBe(true);
  expect(canli.ust).toBe(6);
  expect(canli.durum).toBe('Uygun ' + canli.n + ' / ' + canli.N);
  expect(canli.sinir.replace(/ /g, ' ')).toBe('3–6 mm');

  // galeri: listedeki gerçek düğme büyük çizimi açar
  const dg = page.locator('.ve-fp-kat[data-k="sonuc"] .ve-prm-dg[data-pd="d11"]');
  await dg.scrollIntoViewIfNeeded();
  await dg.click();
  await page.waitForSelector('#ve-mnt-fs #ve-mnt-prm-fs svg.ve-pd');
  const g0 = await page.evaluate(() => ({ w: Number(document.querySelector('#ve-mnt-prm-fs svg.ve-pd').getAttribute('width')),
    bas: document.querySelector('#ve-mnt-fs .ve-settings-header > span').textContent.trim(),
    basili: [...document.querySelectorAll('.ve-pd-ray button[aria-pressed="true"]')].map((b) => b.textContent) }));
  expect(g0.w).toBeGreaterThan(1000);
  expect(g0.bas).toBe('Pareto cephesi');
  expect(g0.basili).toEqual(['Pareto cephesi']);

  // soldaki listeden 3B: gerçek fareyle döner, odakta oklar döndürür; yalnız çizim yenilenir
  await page.click('.ve-pd-ray button[data-pd="d2"]');
  await page.waitForSelector('#ve-mnt-prm-fs .ve-pd-kap[data-pd="d2"] svg.ve-pd');
  expect(await page.locator('#ve-mnt-fs').count()).toBe(1);
  const sv = await page.$('#ve-mnt-prm-fs .ve-pd-kap[data-pd="d2"] svg.ve-pd');
  const b = await sv.boundingBox();
  const once = await page.evaluate(() => document.querySelector('#ve-mnt-prm-fs .ve-pd-kap[data-pd="d2"] svg.ve-pd').outerHTML.length);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(b.x + b.width / 2 + k * 10, b.y + b.height / 2 + k * 3);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const kam = await page.evaluate((i) => _MNT_PARAM_KAM[i + '|d2'], id);
  expect(kam.az).toBeLessThan(235);
  expect(kam.el).toBeGreaterThan(24);
  expect(await page.evaluate(() => document.querySelector('#ve-mnt-prm-fs .ve-pd-kap[data-pd="d2"] svg.ve-pd').outerHTML.length)).not.toBe(once);
  await page.keyboard.press('ArrowLeft');
  expect((await page.evaluate((i) => _MNT_PARAM_KAM[i + '|d2'], id)).az).toBe((kam.az + 5) % 360);
  await page.click('#ve-mnt-prm-fs .ve-pd-sifirla');
  expect(await page.evaluate((i) => _MNT_PARAM_KAM[i + '|d2'], id)).toBeUndefined();

  // kesit seçicisi: eksen çifti değişince harita değişir
  await page.click('.ve-pd-ray button[data-pd="d4"]');
  await page.waitForSelector('#ve-mnt-prm-fs .ve-pd-kap[data-pd="d4"] svg.ve-pd');
  const harita = () => page.evaluate(() => document.querySelector('#ve-mnt-prm-fs .ve-pd-kap[data-pd="d4"] svg.ve-pd').outerHTML);
  const h0 = await harita();
  await page.selectOption('#ve-mnt-prm-fs .ve-pd-kesit select >> nth=0', '0,1');
  await page.waitForTimeout(200);
  expect(await harita()).not.toBe(h0);

  await page.click('#ve-mnt-fs-x');
  await expect(page.locator('#ve-mnt-fs')).toHaveCount(0);
  await expect(page.locator('.ve-fp-kat[data-k="sonuc"] .ve-prm-dg')).toHaveCount(10);
  expect(hata).toEqual([]);
});

// EYLEM SATIRI (kullanıcı 2026-10-18: *"Tara … dediğimde program kasıyor. Ona
// bir progress bar tarzı bir şey oluşturalım. Ayrıca … butonu çok geniş ve
// büyük"*). Ölçülen önce (main 46465f1, ASFAT, 379 px'lik sütun): düğme
// 359 × 40, ilerleme yazısı kaydırma alanının 830 px altında, 19.683
// kombinasyonluk taramada 114–131 uzun görev (> 50 ms; parça 50 ms ve 200
// kombinasyondu). Burada 729 kombinasyon: eski parçayla ~8 uzun görev.
// MODELE UYGULA ve AD (kullanıcı turu 2026-10-19: "Öneriyi modele aktaran
// bir düğme yok" · "Cone 67 50Sh (AMC 1…" iki ayrı tipte aynı görünüyordu).
// Node'da koşmayan halkalar: gerçek tık takozlara yazar ve TEK geri-al
// adımıdır; pencere yeniden kurulur, Sonuç yerinde kalır (tarama eskimez);
// Takoz penceresinin listesi uygulanan tipi gösterir; Ctrl+Z geri alır.
// Gruplar ve Adaylar'da hiçbir ad kırpılmaz (önce 6 + 17 hücre).
test('MODELE UYGULA: gerçek tık tek geri-al adımı, Sonuç yerinde, Takoz listesi tipi gösterir, Ctrl+Z; adlar kırpılmaz', async ({ page }) => {
  const hata = [];
  page.on('pageerror', (e) => hata.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') hata.push(m.text()); });
  const id = await kur(page);
  await page.waitForTimeout(500);
  const ad = await page.evaluate(() => {
    const td = [...document.querySelectorAll('.ve-fp-kat[data-k="grup"] td.sar, .ve-fp-kat[data-k="aday"] td.sar')];
    return { n: td.length, kesik: td.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent) };
  });
  expect(ad).toEqual({ n: 3 * 2 + 27, kesik: [] });
  await page.click('#ve-mnt-param-btn-' + id);
  await page.waitForFunction((i) => !_MNT_PARAM_IS && !!_MNT_PARAM_SONUC[i], id, { timeout: 60000 });
  await page.waitForTimeout(600);
  const durum = () => page.evaluate((i) => {
    const kat = document.querySelector('.ve-fp-kat[data-k="sonuc"]'), tk = nodes.filter((n) => n.type === 'mnt-mount');
    const b = kat.querySelector('.ve-prm-eylem button[data-uygula]');
    return {
      adim: undoStack.length, veri: JSON.stringify(tk.map((n) => n.data)), tip: tk.map((n) => n.data.libKey || null),
      kat: kat.getAttribute('data-d'), em: [...kat.querySelectorAll('.ve-prm-og-s em')].map((e) => e.textContent),
      krit: [...kat.querySelectorAll('table.ve-prm-kriter tbody tr')].map((r) => [r.children[2].textContent, r.children[3].textContent]),
      dugme: { idx: Number(b.getAttribute('data-uygula')), kapali: b.getAttribute('aria-disabled'), title: b.getAttribute('title') },
      not: document.getElementById('ve-mnt-param-st-' + i).textContent
    };
  }, id);
  const once = await durum();
  expect(once.dugme.kapali).toBeNull();
  const uyeTip = await page.evaluate(([i, x]) => {
    const e = _MNT_PARAM_SONUC[i], t = e.D.tipler(x), m = {};
    e.M.G.forEach((g, gi) => g.idler.forEach((d) => { m[d] = t[gi]; }));
    return nodes.filter((n) => n.type === 'mnt-mount').map((n) => m[n.id] || null);
  }, [id, once.dugme.idx]);
  const dugme = page.locator('.ve-fp-kat[data-k="sonuc"] .ve-prm-eylem button[data-uygula]');
  await dugme.scrollIntoViewIfNeeded();
  await dugme.click();
  await page.waitForTimeout(500);
  const sonra = await durum();
  expect(sonra.adim - once.adim).toBe(1);
  expect(sonra.tip).toEqual(uyeTip);
  expect(sonra.kat).toBe('ok');
  expect(sonra.em).toEqual(['Aynı', 'Aynı', 'Aynı']);
  sonra.krit.forEach((r) => expect(r[0]).toBe(r[1]));
  expect(sonra.dugme).toEqual({ idx: once.dugme.idx, kapali: 'true', title: 'Öneri modelde.' });
  expect(sonra.not).toBe('Uygulandı (6 takoz)');
  const tid = await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-mount');
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); return n.id; });
  await page.waitForTimeout(400);
  expect(await page.evaluate((i) => document.getElementById('ve-mnt-libKey-' + i).value, tid)).toBe(uyeTip[0]);
  await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => JSON.stringify(nodes.filter((n) => n.type === 'mnt-mount').map((n) => n.data)))).toBe(once.veri);
  expect(hata).toEqual([]);
});

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
