/**
 * mount-param-sonuc.spec.js — PARAMETRİK ANALİZ'İN SONUÇ'U (gerçek tarayıcı)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı kararları: taramanın sonucu pencerenin Sonuç kategorisinde (2026-10-18);
 * sıralama Excel'in kuralı — dört kesin kriter, sonra en küçük statik sehim; K0 ve
 * K1…K9 (2026-11-10). Node'da koşmayan halkalar:
 *   · gerçek "Tara" tıklaması taramayı bitirir, Sonuç kurulur ve görüşe gelir
 *   · iki grafik kabın GERÇEK genişliğinde 1:1 (yazı ekrandaki boyunda)
 *   · seçilenin halkası ve mod çentiği gerçek fareyle ipucu verir
 *   · K satırına gerçek tık seçilen bölümü değiştirir, tarama YİNELENMEZ;
 *     tip adları satırda bölünmez
 *   · Diyagramlar listesi galeriyi açar; soldaki listeden geçiş aynı katmanda;
 *     3B gerçek fareyle ve oklarla döner; kesit seçicisi haritayı değiştirir;
 *     ✕ kapatır, pencere yerinde kalır
 *   · Modele uygula gerçek tıkla takozlara yazar, tek geri-al adımı, Ctrl+Z
 * Yerleşim ve kontrast ölçüsü yüzey turunda (yuzey-turu.js → takozTuru).
 */
const { test, expect } = require('@playwright/test');
const { githubFikstur } = require('./helpers/github-fikstur');
test.setTimeout(180000);
test.use({ serviceWorkers: 'block' });

async function kur(page, nTip = 6) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on('dialog', (d) => d.accept());
  // GitHub API'si fikstürden: canlı API CI'da oran sınırına takılıp 403
  // döndürdü ve konsol hatası ilk testi düşürdü (koşu 1428).
  await githubFikstur(page);
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.createNode === 'function' && typeof window.veMntOrnekYukle === 'function'
    && typeof window.veMntParamTara === 'function' && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 90000 });
  await page.evaluate(() => { veMntOrnekYukle('asfat'); });
  await page.waitForFunction(() => nodes.some((n) => (n.customName || '').indexOf('57RS') >= 0), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  return page.evaluate((nTip) => {
    const tut = ['57RS313773', 'amc137731', 'bmc-mount1-55sh', '57RS313773-sr116', '57RS313774-sr116', 'bmc-mount1-40sh'];
    const tum = Object.keys(veMntGetLibraryMap());
    tum.forEach((k) => { if (tut.length < nTip && tut.indexOf(k) < 0) tut.push(k); });
    const n = createNode('mnt-parametric', 900, 120);
    n.data = { haric: tum.filter((k) => tut.indexOf(k) < 0) };
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
    return n.id;
  }, nTip);
}

test('Tara → Sonuç: altı bölüm, iki grafik 1:1, ipucu, K seçimi; galeri: liste, geçiş, 3B, kesit', async ({ page }) => {
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
  expect(S.bas).toEqual(['Konfigürasyonlar', 'K1', 'Modlar', 'Statik sehim ve iletilebilirlik', 'Kriterleri sağlayan', 'Diyagramlar']);
  expect(S.gorus).toBe(true);
  expect(S.durum).toMatch(/^Tarandı \([\d,]+ s\)$/);
  expect(S.liste).toBe(9);

  // 1:1 — iki grafiğin ekrandaki genişliği kendi genişliği (ölçeklenmiyor), kabı dolduruyor
  const olcu = await page.evaluate(() => [...document.querySelectorAll('.ve-fp-kat[data-k="sonuc"] svg.ve-pd')].map((s) => {
    const r = s.getBoundingClientRect(), cs = getComputedStyle(s);
    return { pd: s.parentElement.getAttribute('data-pd'), w: r.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth),
      a: Number(s.getAttribute('width')), kap: s.parentElement.clientWidth };
  }));
  expect(olcu.map((o) => o.pd)).toEqual(['mod', 'dag']);
  olcu.forEach((o) => { expect(Math.abs(o.w - o.a)).toBeLessThan(0.6); expect(Math.abs(o.kap - (o.a + 2))).toBeLessThan(1.5); });

  // araç ipucu: seçilenin halkası (kombinasyon, amaçlar, hüküm) ve bir mod çentiği
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
  expect(await ipucu('.ve-pd-kap[data-pd="mod"] rect.ve-pd-hit[data-ip]')).toMatch(/^K0 · 1\. mod/);

  // K seçimi: K3 (liste kısaysa sonuncusu) satırına gerçek tık — seçilen bölüm o K, grafikler
  // onunla; tarama yinelenmez
  await page.evaluate((i) => { window.__depo = _MNT_PARAM_SONUC[i].D; }, id);
  const kk = await page.evaluate(() => Math.min(3, document.querySelectorAll('.ve-fp-kat[data-k="sonuc"] .ve-prm-k').length - 1));
  expect(kk).toBeGreaterThan(1);
  const k3 = page.locator('.ve-fp-kat[data-k="sonuc"] .ve-prm-k[data-k="' + kk + '"]');
  await k3.scrollIntoViewIfNeeded();
  await k3.click();
  await page.waitForTimeout(300);
  const sec = await page.evaluate(([i, kk]) => {
    const kat = document.querySelector('.ve-fp-kat[data-k="sonuc"]');
    return { ayni: _MNT_PARAM_SONUC[i].D === window.__depo, bas: [...kat.querySelectorAll('.ve-fp-sect > b')].map((b) => b.textContent)[1],
      secili: kat.querySelector('.ve-prm-k[aria-selected="true"]').getAttribute('data-k'),
      sutun: kat.querySelector('table.ve-prm-kriter thead th:last-child').textContent,
      mod: [...kat.querySelectorAll('.ve-pd-kap[data-pd="mod"] text')].some((t) => t.textContent === 'K' + kk),
      // tip adı satırda bölünmez: her adın kutusu tek satır
      bolunen: [...kat.querySelectorAll('.ve-prm-k-ad .t')].filter((e) => e.getClientRects().length > 1).map((e) => e.textContent) };
  }, [id, kk]);
  expect(sec).toEqual({ ayni: true, bas: 'K' + kk, secili: String(kk), sutun: 'K' + kk, mod: true, bolunen: [] });

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
  await expect(page.locator('.ve-fp-kat[data-k="sonuc"] .ve-prm-dg')).toHaveCount(9);
  expect(hata).toEqual([]);
});

// EYLEM SATIRI (kullanıcı 2026-10-18: *"Tara … dediğimde program kasıyor. Ona
// bir progress bar tarzı bir şey oluşturalım. Ayrıca … butonu çok geniş ve
// büyük"*). Ölçülen önce (main 46465f1, ASFAT, 379 px'lik sütun): düğme
// 359 × 40, ilerleme yazısı kaydırma alanının 830 px altında, 19.683
// kombinasyonluk taramada 114–131 uzun görev (> 50 ms; parça 50 ms ve 200
// kombinasyondu). Burada aday × aday (tam ve tahminsiz tip; 2026-11-10: 27 × 27 = 729).
// MODELE UYGULA ve AD (kullanıcı turu 2026-10-19: "Öneriyi modele aktaran
// bir düğme yok" · "Cone 67 50Sh (AMC 1…" iki ayrı tipte aynı görünüyordu).
// Adaylar markaya göre açılır kapanır gruplarda: ölçü bütün gruplar açıkken.
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
  await page.evaluate(() => document.querySelectorAll('.ve-prm-marka').forEach((d) => { d.open = true; }));
  await page.waitForTimeout(200);
  const ad = await page.evaluate(() => {
    const td = [...document.querySelectorAll('.ve-fp-kat[data-k="grup"] td.sar, .ve-fp-kat[data-k="aday"] td.sar')];
    return { n: td.length, kesik: td.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent) };
  });
  // aday satırları kütüphanenin TAM ve TAHMİNSİZ tipleri (2026-11-10: 24 → 27, teknik resimlerle ölçülen
  // AMC kodları; tahminli tip — Canlı Not 113 — aday değil)
  const nTam = await page.evaluate(() => { const m = veMntGetLibraryMap(); return Object.keys(m).filter((k) => _mntLibTam(m[k]) && !_mntLibTahmin(m[k]).length).length; });
  expect(ad).toEqual({ n: 3 * 2 + nTam, kesik: [] });
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
  expect(sonra.dugme).toEqual({ idx: once.dugme.idx, kapali: 'true', title: 'K1 modelde.' });
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
  await page.evaluate((i) => {                                   // bütün adaylar, bir grup sabit: aday × aday
    const n = nodes.find((x) => x.id === i), G = _mntParamModel().G;
    n.data = { sabit: { [G[1].anahtar]: true } };
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); showNodeProperties(n);
  }, id);
  await page.waitForTimeout(600);
  // adayların marka grupları açık: içerik sütunu taşar (satırın yapışıklığı sınanır)
  await page.evaluate(() => document.querySelectorAll('.ve-prm-marka').forEach((d) => { d.open = true; }));
  await page.waitForTimeout(300);
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
    // ADIMIN SÜRESİ SABİT: çubuk ~100 ms'de bir yazılıyor ve hızlı makinede 729
    // kombinasyon 100 ms dolmadan bitip tek ara değer bırakıyordu (koşu 1428).
    // Tarama en az 400 ms sürer — sonuç makinenin hızından bağımsız.
    const tar = veMntKatalog.tarayici;
    veMntKatalog.tarayici = function () {
      const it = tar.apply(this, arguments), adim = it.adim, pay = 400 / Math.max(1, it.N);
      it.adim = function () { const s = performance.now(); while (performance.now() - s < pay); return adim.apply(this, arguments); };
      return it;
    };
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
  const nKomb = await page.evaluate(() => { const m = veMntGetLibraryMap(), t = Object.keys(m).filter((k) => _mntLibTam(m[k]) && !_mntLibTahmin(m[k]).length).length; return veSayi(t * t, 0); });
  expect(g1.il.y).toMatch(new RegExp('^Kombinasyon [\\d.]+ / ' + nKomb.replace('.', '\\.') + '$'));
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

// EXCEL (kullanıcı kararı 2026-11-09: "Kullanıcı bu Excel formatında çıktı alacak"):
// Seçilen K'nın bölümündeki düğmenin gerçek tıkı tarayıcının indirmesini başlatır; dosya
// tarayıcının sıkıştırmasıyla (CompressionStream) yazılır ve programın kendi
// okuyucusu açar — Node'da bu yol HİÇ koşmuyor (jsdom'da sıkıştırma yok).
// Düğme satırı dar sütunda taşmaz (üç düğme alt satıra iner).
test('EXCEL: gerçek tık indirir; sıkıştırılmış dosya açılır, Özet · Tarama · Sonuç; Tarama\'nın satırı kendi bloğuna bağlı; düğme satırı taşmaz', async ({ page }) => {
  const hata = [];
  page.on('pageerror', (e) => hata.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') hata.push(m.text()); });
  const id = await kur(page);
  await page.click('#ve-mnt-param-btn-' + id);
  await page.waitForFunction((i) => !_MNT_PARAM_IS && !!_MNT_PARAM_SONUC[i], id, { timeout: 60000 });
  await page.waitForTimeout(600);
  const dugme = page.locator('.ve-fp-kat[data-k="sonuc"] .ve-prm-eylem button[data-excel]');
  await dugme.scrollIntoViewIfNeeded();
  const satir = await page.evaluate(() => {
    const e = document.querySelector('.ve-fp-kat[data-k="sonuc"] .ve-prm-eylem');
    const r = e.getBoundingClientRect();
    return { tasma: e.scrollWidth > e.clientWidth + 1,
      disari: [...e.querySelectorAll('button')].filter((b) => { const q = b.getBoundingClientRect(); return q.right > r.right + 1 || q.left < r.left - 1; }).length };
  });
  expect(satir).toEqual({ tasma: false, disari: 0 });
  const [indir] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), dugme.click()]);
  expect(indir.suggestedFilename()).toBe('takoz_konfigurasyonlari.xlsx');
  const yol = await indir.path();
  const bayt = new Uint8Array(require('fs').readFileSync(yol));
  const R = require('../../js/xlsx-read.js');
  const z = R.veXlsZipRead(bayt);
  expect(z.names.some((n) => z.entries[n].method === 8)).toBe(true);           // tarayıcıda sıkıştırılmış
  const wb = R.veXlsOpen(bayt);
  const ad = wb.sheets.map((s) => s.name);
  expect(ad).toEqual(['Özet', 'Tarama', 'Sonuç']);                              // sekmeler görünür
  const w = R.veXlsUtf8(z.read('xl/workbook.xml'));
  expect(w).not.toMatch(/state="hidden"|showSheetTabs/);
  const oz = wb.readSheet(0).rows;
  expect(oz[5].slice(1, 3)).toEqual(['K', 'Sonuç']);
  expect(oz[6][1]).toBe('K0');
  const son = wb.readSheet(2).rows;
  expect(son[1][2]).toBe('Özet’te ya da Tarama’da konfigürasyonu seçin.');       // sekmeden açılınca sonuç yok
  const ta = wb.readSheet(1).rows;
  expect(ta[0][0]).toMatch(/^Tarama — [\d.]+ kombinasyon/);
  const no = ta.slice(5).map((r) => r[0]).filter(Number.isFinite);              // veri 6. satırdan
  expect(no.length).toBeGreaterThan(9);
  // her tarama satırının No'su Sonuç'taki bloğunun şeridine; bloğun başlığı o No
  const s2 = R.veXlsUtf8(z.read('xl/worksheets/sheet2.xml'));
  const hedef = [...s2.matchAll(/<c r="A(\d+)"[^>]*><f>HYPERLINK\(&quot;#'Sonuç'!\$A\$(\d+):\$A\$\d+&quot;,(\d+)\)<\/f>/g)];
  expect(hedef.map((m) => +m[3])).toEqual(no);
  hedef.forEach((m) => expect(son[+m[2]][2].split(' — ')[0]).toBe('No ' + Number(m[3]).toLocaleString('tr-TR')));   // şeridin ilk satırının altı başlık
  await expect(page.locator('#ve-mnt-param-st-' + id)).toHaveText(/^İndirildi \([\d.]+ KB\)$/);
  expect(hata).toEqual([]);
});

// EXCEL DİLİMLİ (2026-11-10): kitabın kurulumu ve dosyanın yazımı (XML, UTF-8, CRC,
// sıkıştırma) parça parça — 13.824 satırlık kitap tek görevde 1,7 sn donduruyordu. On beş
// adayla 3.375 kombinasyon: eski yazımda 210 ve 60 ms'lik iki görev; yenisinde en uzunu 21 ms.
// Pay: CI'ın çöp toplamasına en çok bir, 100 ms'nin altında uzun görev.
test('EXCEL DİLİMLİ: 3.375 kombinasyonun Excel\'i sürerken arayüz donmaz; dosya açılır', async ({ page }) => {
  test.setTimeout(120000);
  const hata = [];
  page.on('pageerror', (e) => hata.push(String(e)));
  const id = await kur(page, 15);
  await page.click('#ve-mnt-param-btn-' + id);
  await page.waitForFunction((i) => !_MNT_PARAM_IS && !!_MNT_PARAM_SONUC[i], id, { timeout: 90000 });
  expect(await page.evaluate((i) => _MNT_PARAM_SONUC[i].D.N, id)).toBe(3375);
  await page.waitForTimeout(400);
  const dugme = page.locator('.ve-fp-kat[data-k="sonuc"] .ve-prm-eylem button[data-excel]');
  await dugme.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.__uzun = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__uzun.push(Math.round(e.duration)))).observe({ type: 'longtask' });
  });
  const [indir] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), dugme.click()]);
  const bayt = new Uint8Array(require('fs').readFileSync(await indir.path()));
  await page.waitForTimeout(300);
  const uzun = await page.evaluate(() => window.__uzun);
  expect(uzun.length).toBeLessThanOrEqual(1);
  expect(uzun.filter((d) => d >= 100)).toEqual([]);
  const R = require('../../js/xlsx-read.js');
  const wb = R.veXlsOpen(bayt);
  expect(wb.sheets.map((x) => x.name)).toEqual(['Özet', 'Tarama', 'Sonuç']);
  expect(wb.readSheet(1).rows.filter((r) => Number.isFinite(r[0])).length).toBe(3375);
  const son = wb.readSheet(2).rows;                                              // her tarama satırının bloğu
  expect(son.filter((r) => typeof r[2] === 'string' && /^No [\d.]+ — /.test(r[2])).length).toBe(3375);
  expect(hata).toEqual([]);
});
