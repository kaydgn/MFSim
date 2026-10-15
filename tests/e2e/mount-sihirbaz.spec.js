/**
 * mount-sihirbaz.spec.js — TAKOZ SİHİRBAZININ YERLEŞİMİ (gerçek tarayıcı)
 * ─────────────────────────────────────────────────────────────────────────
 * Tur 6 (2026-10-15) ölçümü, Tulga ile tohumlanmış sihirbaz, 1920×952:
 *   · özet adımında görünüş düğmeleri (Üstten · Yandan · Önden) yüzen panelin
 *     ALTINDAYDI — aynı köşe, aynı katman; üçü de tıklanamıyordu
 *   · özet masasının çizimi panelin altına giriyordu (Transfer Kutusu, Sağ Arka
 *     Takoz, bir braket)
 *   · takoz editöründe "Konum [mm]", "Statik [N/mm]", "Dinamik [N/mm]" iki
 *     satıra kırılıyordu (66 px'lik etiket sütunu, en uzunu 91 px)
 *   · motor kataloğunun yer tutucusu kutusuna sığmıyordu ("seç …")
 *   · özet başlığı "STATİK DENGE · 1 G" — yer çekimi ivmesi g, G oluyordu
 * Node'da koşamaz: yerleşim, `elementFromPoint`, `text-transform` ve seçicinin
 * yazısı ancak tarayıcıda ölçülür. Mantık tarafı:
 * tests/unit/mount-sihirbaz-doku.test.js.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function bootApp(page) {
  await page.setViewportSize({ width: 1920, height: 952 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntWizAc === 'function' &&
    typeof window.veMntLoadExample === 'function' && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}

// Seçicinin GÖRÜNEN yazısı (seçili seçenek) kutusunun iç enine sığıyor mu
const SECICI = (kok) => {
  const cv = document.createElement('canvas').getContext('2d');
  return [...document.querySelectorAll(kok + ' select:not([multiple])')].filter((el) => el.offsetWidth).map((el) => {
    const cs = getComputedStyle(el), o = el.options[el.selectedIndex];
    cv.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const w = cv.measureText(o ? o.textContent.trim() : '').width;
    const ic = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { metin: o ? o.textContent.trim() : '', tasma: Math.round((w - ic) * 10) / 10 };
  });
};

test('Takoz sihirbazı: etiket tek satır, özet düğmeleri ve çizimi panelin dışında, seçici yazısı sığıyor', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => {
    const ex = createNode('mnt-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'tulga'; veMntLoadExample(ex.id);
  });
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-solver'), null, { timeout: 20000 });
  const adimlar = await page.evaluate(() => { veMntWizAc(); return VE_MW_STEPS.map((s) => s.key); });

  const kirik = [], secici = [];
  for (let i = 0; i < adimlar.length; i++) {
    await page.evaluate((j) => veMntWizGoto(j), i);
    await page.waitForTimeout(400);
    // EDİTÖR ETİKETİ TEK SATIR: tek satırlık kopyasıyla aynı boyda
    (await page.evaluate(() => [...document.querySelectorAll('#ve-mw-yan .ve-fw-ed-alan > span:first-child')]
      .filter((sp) => sp.offsetWidth).map((sp) => {
        const c = sp.cloneNode(true);
        c.style.cssText = 'position:absolute; white-space:nowrap; visibility:hidden;';
        sp.parentNode.appendChild(c);
        const tek = c.getBoundingClientRect().height; c.remove();
        return { et: sp.textContent.trim(), h: sp.getBoundingClientRect().height, tek };
      }))).forEach((x) => { if (x.h > x.tek + 2) kirik.push(adimlar[i] + ': ' + x.et); });
    (await page.evaluate(SECICI, '#ve-mntwiz-overlay')).forEach((x) => {
      if (x.tasma > 0.5) secici.push(adimlar[i] + ': "' + x.metin + '" ' + x.tasma + ' px');
    });
  }
  expect.soft(kirik).toEqual([]);
  expect.soft(secici).toEqual([]);

  // ÖZET: düğmeler ve işaretler yüzen panelin DIŞINDA
  await page.evaluate((j) => veMntWizGoto(j), adimlar.indexOf('ozet'));
  await page.waitForTimeout(500);
  const oz = await page.evaluate(() => {
    const panel = document.getElementById('ve-mw-yan').getBoundingClientRect();
    const ortulen = [...document.querySelectorAll('#ve-mntwiz-overlay .ve-fw-masa-arac button, #ve-mntwiz-overlay .ve-fw-masa-gezin button')]
      .filter((b) => b.offsetWidth).filter((b) => {
        const r = b.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !(e === b || b.contains(e));
      }).map((b) => (b.textContent || b.getAttribute('aria-label')).trim());
    const isaret = [...document.querySelectorAll('#ve-mw-masa-cizim [data-mnt-sec]')];
    const altinda = isaret.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.right > panel.left && r.left < panel.right && r.bottom > panel.top && r.top < panel.bottom;
    }).length;
    const bas = [...document.querySelectorAll('#ve-mw-yan .ve-fw-card-h span')].map((s) => s.innerText);
    return { ortulen, isaret: isaret.length, altinda, bas };
  });
  expect.soft(oz.ortulen).toEqual([]);
  expect(oz.isaret).toBeGreaterThan(5);
  expect.soft(oz.altinda).toBe(0);
  expect.soft(oz.bas.join(' | ')).toContain('1 g');
  // Görünüş düğmesi gerçekten çalışıyor (örtülmüş düğmenin tıklaması panele gidiyordu)
  await page.locator('#ve-mntwiz-overlay .ve-fw-masa-arac button', { hasText: 'Yandan' }).click();
  await expect(page.locator('#ve-mntwiz-overlay .ve-fw-masa-arac button', { hasText: 'Yandan' })).toHaveAttribute('aria-pressed', 'true');
  expect(hatalar).toEqual([]);
});
