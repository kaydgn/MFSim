/**
 * fead-wizard-tur3.spec.js — SİHİRBAZ, ÜÇÜNCÜ KULLANICI TURU (gerçek tarayıcı)
 *
 * Beş maddenin dördü YERLEŞİM ya da GERÇEK ETKİLEŞİM sorusu, yani Node'da
 * ölçülemiyor:
 *   1 · Yüklenen örnek kartının gerçekten belirgin çizilmesi (hesaplanmış
 *       gölge/kenarlık — sınıf adı değil).
 *   2 · Gergi satırının diğer satırlarla aynı hizada durması.
 *   4 · Aksesuar modeli seçilince sütun genişliklerinin OYNAMAMASI
 *       (ölçülen eski kayma: açılır liste 362 → 283 px).
 *   5 · Çevrim seçilince gövdenin kaydırma konumunu KORUMASI.
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadWizOpen === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 60000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
}

async function sihirbaz(page){
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => Array.isArray(window.nodes) && window.nodes.length > 0, null, { timeout: 20000 });
  await page.evaluate(() => veFeadWizOpen(window.nodes.find(n => n.type === 'fead-wizard').id));
  await page.waitForSelector('#ve-feadwiz-overlay');
}

test('tur3 — seçili kart · gergi satırı · yön · tablo hizası · kaydırma', async ({ page }) => {
  const hata = [];
  page.on('pageerror', e => hata.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') hata.push(m.text()); });
  await sihirbaz(page);

  // ── 1 · YÜKLENEN KART BELİRGİN ─────────────────────────────────────────
  const kartOku = () => page.evaluate(() => {
    return [...document.querySelectorAll('.ve-fw-btn-wide')].map(el => {
      const cs = getComputedStyle(el);
      return { ad: (el.querySelector('b') || {}).textContent,
               on: el.classList.contains('ve-fw-btn-on'),
               shadow: cs.boxShadow !== 'none' && cs.boxShadow !== '',
               mark: !!el.querySelector('.ve-fw-btn-mark'),
               border: cs.borderTopColor };
    });
  });
  const k0 = await kartOku();
  console.log('KART önce', JSON.stringify(k0.map(x => ({ a: x.ad, on: x.on, s: x.shadow }))));
  expect(k0.filter(x => x.on).length).toBe(0);
  expect(k0.filter(x => x.shadow).length).toBe(0);

  // GERÇEK TIK ile örnek yükle
  await page.locator('.ve-fw-btn-wide').first().click();
  await page.waitForTimeout(400);
  const k1 = await kartOku();
  console.log('KART sonra', JSON.stringify(k1.map(x => ({ a: x.ad, on: x.on, s: x.shadow, m: x.mark }))));
  const secili = k1.filter(x => x.on);
  expect(secili.length).toBe(1);
  expect(secili[0].shadow).toBe(true);      // GÖLGE gerçekten hesaplanıyor
  expect(secili[0].mark).toBe(true);
  // Seçili kartın kenarlığı diğerlerinden FARKLI (belirginlik ölçüsü)
  const digerleri = k1.filter(x => !x.on).map(x => x.border);
  expect(digerleri).not.toContain(secili[0].border);

  // ── 2 · GERGİ SATIRI DİĞERLERİYLE AYNI ─────────────────────────────────
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);
  const satir = await page.evaluate(() => {
    const tbl = document.querySelector('.ve-fw-tbl');
    const ten = tbl.querySelector('tr.ve-fw-tr-ten');
    const ilk = tbl.querySelector('tbody tr');
    const x = (tr) => [...tr.children].map(e => Math.round(e.getBoundingClientRect().left));
    return {
      hiza: x(ten).length === x(ilk).length && x(ten).every((v, i) => Math.abs(v - x(ilk)[i]) <= 1),
      tipMetni: ten.children[1].innerText.trim(),
      // DÖRDÜNCÜ tur: hücre tek seçenekli bir <select> — diğer satırlarla aynı
      // biçim. Kilit görünümle değil SEÇENEK KÜMESİYLE kuruluyor.
      tipSelect: !!ten.children[1].querySelector('select'),
      tipSecenek: ten.children[1].querySelectorAll('option').length,
      cip: !!ten.querySelector('.ve-fw-tag'),
      yukseklikFarki: Math.abs(Math.round(ten.getBoundingClientRect().height
                              - ilk.getBoundingClientRect().height)),
      xIpucu: (ten.children[4].querySelector('input') || {}).title || ''
    };
  });
  console.log('SATIR', JSON.stringify(satir));
  expect(satir.hiza).toBe(true);
  expect(satir.tipMetni).toBe('Otomatik Gergi');
  expect(satir.tipSelect).toBe(true);
  expect(satir.tipSecenek).toBe(1);
  expect(satir.cip).toBe(false);
  expect(satir.yukseklikFarki).toBeLessThanOrEqual(2);   // satır artık şişmiyor
  expect(satir.xIpucu).toMatch(/montaj noktas/);

  // ── 3 · KAYIŞ YOLU'NDA CCW/CW YOK ──────────────────────────────────────
  await page.evaluate(() => veFeadWizGoto(2));
  await page.waitForTimeout(300);
  const yol = await page.evaluate(() => ({
    spin: document.querySelectorAll('.ve-fw-spin').length,
    cevir: !!document.querySelector('button[onclick*="veFeadWizRouteReverse"]'),
    seritYon: (document.querySelector('.ve-fw-live') || {}).innerText || ''
  }));
  console.log('YOL', JSON.stringify(yol));
  expect(yol.spin).toBe(0);
  expect(yol.cevir).toBe(true);
  expect(yol.seritYon).toMatch(/CCW|CW/);   // yön okuması KAYBOLMADI

  // ── 4 · AKSESUAR TABLOSU SEÇİMLE KAYMIYOR ──────────────────────────────
  await page.evaluate(() => veFeadWizGoto(5));
  await page.waitForTimeout(400);
  const sutun = () => page.evaluate(() => {
    const t = document.querySelector('.ve-fw-tbl-fixed');
    return { th: [...t.querySelectorAll('thead th')].map(e => Math.round(e.getBoundingClientRect().width)),
             sel: [...t.querySelectorAll('select')].map(e => Math.round(e.getBoundingClientRect().width)) };
  });
  const s0 = await sutun();
  // TEK YAZICI (2026-09-01): iki katalog tek seçicide birleşti.
  const sel = page.locator('select[onchange*="veFeadWizAccModel"]').first();
  const opts = await sel.evaluate(e => [...e.options].map(o => o.value));
  await sel.selectOption(opts[opts.length - 1]);
  await page.waitForTimeout(400);
  const s1 = await sutun();
  console.log('SÜTUN önce', JSON.stringify(s0), 'sonra', JSON.stringify(s1));
  expect(s1.th).toEqual(s0.th);       // başlık genişlikleri BİREBİR
  expect(s1.sel).toEqual(s0.sel);     // açılır liste OYNAMIYOR (eski: 362 → 283)

  // ── 5 · ÇEVRİM SEÇİNCE KAYDIRMA KORUNUYOR ──────────────────────────────
  const y0 = await page.evaluate(() => {
    const b = document.getElementById('ve-fw-body');
    b.scrollTop = Math.round((b.scrollHeight - b.clientHeight) * 0.6);
    return b.scrollTop;
  });
  expect(y0).toBeGreaterThan(50);
  await page.locator('select[onchange*="veFeadWizDutyLib"]').first().selectOption('AG00902-4');
  await page.waitForTimeout(400);
  const y1 = await page.evaluate(() => document.getElementById('ve-fw-body').scrollTop);
  console.log('KAYDIRMA', y0, '→', y1);
  expect(Math.abs(y1 - y0)).toBeLessThanOrEqual(1);

  // adım değişimi SIFIRLAR
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('ve-fw-body').scrollTop)).toBe(0);

  expect(hata.filter(h => !/favicon|manifest|version\.json|Failed to load resource/i.test(h))).toEqual([]);
});
