/**
 * fead-wizard-tur4.spec.js — SİHİRBAZ, DÖRDÜNCÜ KULLANICI TURU (gerçek tarayıcı)
 *
 * Node'da ölçülemeyen halkalar:
 *   1 · Gergi satırının diğer satırlarla AYNI yükseklikte/hizada durması.
 *   2 · ↑ ↓ düğmelerine GERÇEK tık ile satırın yer değiştirmesi.
 *   3 · VİRGÜLLE yazmanın gerçekten çalışması — `type="number"` alanında
 *       tarayıcı virgülü yutuyordu ve bunu yalnız gerçek klavye gösterir.
 *   5 · Açı seçici penceresi: fare hareketiyle kolun dönmesi, tıkta kutunun
 *       dolması, "Uygula"nın alana yazması.
 *   9 · Alanın NİSPİ değeri göstermesi (344 mutlak → 164).
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadWizOpen === 'function'
    && Array.isArray(window.nodes), null, { timeout: 60000 });
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
  await page.waitForFunction(() => window.nodes.length > 0, null, { timeout: 20000 });
  await page.evaluate(() => veFeadWizOpen(window.nodes.find(n => n.type === 'fead-wizard').id));
  await page.waitForSelector('#ve-feadwiz-overlay');
  await page.evaluate(() => { veFeadWizSeed('BMC_FEAD_2026'); veFeadWizRender(); });
  await page.waitForTimeout(350);
}

test('tur4 — gergi satırı · taşıma · virgül · açı seçici · nispi açı', async ({ page }) => {
  const hata = [];
  page.on('pageerror', e => hata.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') hata.push(m.text()); });
  await sihirbaz(page);
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);

  // ── 1 · GERGİ SATIRI DİĞERLERİYLE AYNI ─────────────────────────────────
  const satir = await page.evaluate(() => {
    const tbl = document.querySelector('.ve-fw-tbl');
    const ilk = tbl.querySelector('tbody tr');
    const ten = tbl.querySelector('tr.ve-fw-tr-ten');
    const x = (tr) => [...tr.children].map(e => Math.round(e.getBoundingClientRect().left));
    const bicim = (tr) => [...tr.children].map(td => {
      const c = td.querySelector('input,select,span'); return c ? c.tagName : '-'; });
    return {
      hiza: x(ten).every((v, i) => Math.abs(v - x(ilk)[i]) <= 1),
      dhFark: Math.abs(Math.round(ten.getBoundingClientRect().height - ilk.getBoundingClientRect().height)),
      bicimAyni: JSON.stringify(bicim(ten)) === JSON.stringify(bicim(ilk)),
      zemin: getComputedStyle(ten.children[3]).backgroundColor
             === getComputedStyle(ilk.children[3]).backgroundColor,
      // AÇIKLAMA YÜZEYİ YOK (kullanıcı isteği, 2026-09-02).
      hint: document.querySelectorAll('.ve-fw-hint').length,
      gozKirpma: [...document.querySelectorAll('.ve-fw-card-h em')].length
    };
  });
  console.log('SATIR', JSON.stringify(satir));
  expect(satir.hiza).toBe(true);
  expect(satir.dhFark).toBeLessThanOrEqual(2);
  expect(satir.bicimAyni).toBe(true);
  expect(satir.hint).toBe(0);
  expect(satir.gozKirpma).toBe(0);

  // ── 2 · SATIR TAŞIMA — GERÇEK TIK ──────────────────────────────────────
  const adlar = () => page.evaluate(() =>
    [...document.querySelectorAll('.ve-fw-tbl tbody tr:not(.ve-fw-tr-ten)')]
      .map(tr => tr.children[2].querySelector('input').value
                 || tr.children[2].querySelector('input').placeholder));
  const a0 = await adlar();
  await page.locator('.ve-fw-tbl tbody tr:nth-child(2) button[title="Yukarı taşı"]').click();
  await page.waitForTimeout(300);
  const a1 = await adlar();
  console.log('TAŞIMA', JSON.stringify(a0), '→', JSON.stringify(a1));
  expect(a1[0]).toBe(a0[1]);
  expect(a1[1]).toBe(a0[0]);
  // İlk satırın ↑ düğmesi kapalı
  expect(await page.locator('.ve-fw-tbl tbody tr:nth-child(1) button[title="Yukarı taşı"]')
    .isDisabled()).toBe(true);

  // ── 3 · VİRGÜL — GERÇEK KLAVYE ─────────────────────────────────────────
  // Satır hücreleri: radyo · tip · ad · OD · X · Y · temas · J · ops
  // → o satırın `input`ları: radyo(0) ad(1) OD(2) X(3) Y(4) J(5)
  const xAlan = page.locator('.ve-fw-tbl tbody tr:nth-child(1) input').nth(3);
  await xAlan.fill('');
  await xAlan.type('123,45');
  await page.waitForTimeout(250);
  const virgul = await page.evaluate(() => {
    const st = veFeadWizState();
    const pack = veFeadWizNodes(st);
    return { alanTipi: [...document.querySelectorAll('.ve-fw-tbl tbody tr:nth-child(1) input')][3].type,
             durum: st.pulleys[0].x, modele: pack.nodes[0].data.x };
  });
  console.log('VİRGÜL', JSON.stringify(virgul));
  expect(virgul.alanTipi).toBe('text');            // number OLSAYDI virgül yutulurdu
  expect(String(virgul.durum)).toBe('123,45');     // alan virgülü GÖRDÜ
  expect(virgul.modele).toBeCloseTo(123.45, 9);    // model DOĞRU sayıyı aldı

  // ── 9 · NİSPİ AÇI ──────────────────────────────────────────────────────
  await page.evaluate(() => { veFeadWizState().ten.armMeanDeg = 344; veFeadWizGoto(3); });
  await page.waitForTimeout(300);
  const alanDeg = await page.evaluate(() =>
    [...document.querySelectorAll('input')].find(e =>
      (e.getAttribute('oninput') || '').includes('veFeadWizArmShown')).value);
  console.log('AÇI ALANI (344 mutlak →)', alanDeg);
  expect(Number(alanDeg)).toBeCloseTo(164, 6);

  // ── 5 · AÇI SEÇİCİ ─────────────────────────────────────────────────────
  await page.locator('button.ve-fw-ang-btn').click();
  await page.waitForTimeout(300);
  const acik = await page.evaluate(() => {
    const ov = document.getElementById('ve-fw-ang');
    const svg = ov.querySelector('svg');
    return { gorunur: getComputedStyle(ov).display !== 'none', svg: !!svg,
             eksen: (ov.textContent.match(/-?\d+°/g) || []).slice(0, 6),
             kutu: !!document.getElementById('ve-fw-ang-in'),
             baslangic: document.getElementById('ve-fw-ang-in').value };
  });
  console.log('SEÇİCİ', JSON.stringify(acik));
  expect(acik.gorunur).toBe(true);
  // KAYIŞ + YEŞİL OK + YAKINLAŞTIRMA (kullanıcı isteği, 2026-09-02)
  const cizim = await page.evaluate(() => {
    const s = document.querySelector('#ve-fw-ang-plot svg');
    const yol = [...s.querySelectorAll('path')]
      .find(p => (p.getAttribute('stroke') || '').includes('accent-warning'));
    const ok = [...s.querySelectorAll('line')]
      .find(l => (l.getAttribute('stroke') || '').includes('accent-success'));
    const uc = [...s.querySelectorAll('path')]
      .find(p => (p.getAttribute('fill') || '').includes('accent-success'));
    return { kayis: !!yol, kayisUzunluk: yol ? Math.round(yol.getTotalLength()) : 0,
             yesilOk: !!ok, okUcu: !!uc,
             okRengi: ok ? getComputedStyle(ok).stroke : '',
             yazi: [...s.querySelectorAll('text')].map(t => t.textContent),
             zoomDugme: document.querySelectorAll('.ve-fw-ang-zoom button').length,
             k: +s.getAttribute('data-k') };
  });
  console.log('ÇİZİM', JSON.stringify(cizim));
  expect(cizim.kayis).toBe(true);
  expect(cizim.kayisUzunluk).toBeGreaterThan(300);      // gerçek bir yol
  expect(cizim.yesilOk).toBe(true);
  expect(cizim.okUcu).toBe(true);
  expect(cizim.okRengi).not.toBe('');
  // Kasnak ADI yok — yalnız eksen etiketleri ve açı sayısı.
  cizim.yazi.forEach(t => expect(t).toMatch(/^-?\d+(\.\d+)?°$/));
  expect(cizim.zoomDugme).toBe(3);

  // YAKINLAŞTIRMA gerçek tıkla ölçeği büyütüyor
  await page.locator('.ve-fw-ang-zoom button[title="Yakınlaş"]').click();
  await page.waitForTimeout(250);
  const k2 = await page.evaluate(() => +document.querySelector('#ve-fw-ang-plot svg').getAttribute('data-k'));
  console.log('ZOOM', cizim.k, '→', k2);
  expect(k2).toBeGreaterThan(cizim.k);
  await page.locator('.ve-fw-ang-zoom button[title="Sığdır"]').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => +document.querySelector('#ve-fw-ang-plot svg').getAttribute('data-k')))
    .toBeCloseTo(cizim.k, 5);
  expect(acik.svg).toBe(true);
  expect(acik.kutu).toBe(true);
  expect(Number(acik.baslangic)).toBeCloseTo(164, 3);

  // FARE: düzlemin sağ ortasına git → açı 0'a yaklaşmalı
  const kutu = await page.locator('#ve-fw-ang-plot svg').boundingBox();
  const merkez = await page.evaluate(() => {
    const s = document.querySelector('#ve-fw-ang-plot svg');
    const vb = s.getAttribute('viewBox').split(/\s+/);
    const r = s.getBoundingClientRect();
    const k = +s.getAttribute('data-k'), ox = +s.getAttribute('data-ox'), oy = +s.getAttribute('data-oy');
    const cx = +s.getAttribute('data-cx'), cy = +s.getAttribute('data-cy');
    return { sx: r.left + (ox + cx * k) * r.width / +vb[2],
             sy: r.top + (oy - cy * k) * r.height / +vb[3],
             pxPerMm: k * r.width / +vb[2] };
  });
  await page.mouse.move(merkez.sx + merkez.pxPerMm * 85, merkez.sy);
  await page.waitForTimeout(200);
  const sifir = await page.evaluate(() => VE_FW_ANG.shown);
  console.log('FARE sağda →', sifir.toFixed(3), '°');
  expect(Math.abs(sifir)).toBeLessThan(2);

  // TIK: kutuya yazılmalı
  await page.mouse.click(merkez.sx, merkez.sy - merkez.pxPerMm * 85);
  await page.waitForTimeout(250);
  const tik = await page.evaluate(() => ({
    kutu: document.getElementById('ve-fw-ang-in').value,
    durum: VE_FW_ANG.shown }));
  console.log('TIK üstte →', JSON.stringify(tik));
  // Tolerans 2°: ekran koordinatı piksele yuvarlanıyor ve yarıçap küçük —
  // ölçülen şey "tık kutuyu doğru yönle dolduruyor mu", ondalık değil.
  expect(Math.abs(Number(tik.kutu) - 90)).toBeLessThan(2);
  expect(Number(tik.kutu)).toBe(tik.durum);

  // UYGULA: alana yazılmalı
  await page.locator('#ve-fw-ang-in').fill('-30');
  await page.locator('#ve-fw-ang button.ve-fw-btn-primary').click();
  await page.waitForTimeout(350);
  const son = await page.evaluate(() => ({
    kapandi: getComputedStyle(document.getElementById('ve-fw-ang')).display === 'none',
    saklanan: veFeadWizState().ten.armMeanDeg,
    alan: [...document.querySelectorAll('input')].find(e =>
      (e.getAttribute('oninput') || '').includes('veFeadWizArmShown')).value }));
  console.log('UYGULA', JSON.stringify(son));
  expect(son.kapandi).toBe(true);
  expect(son.saklanan).toBeCloseTo(150, 3);        // −30 nispi → 150 mutlak
  expect(Number(son.alan)).toBeCloseTo(-30, 3);

  expect(hata.filter(h => !/favicon|manifest|version\.json|Failed to load resource/i.test(h))).toEqual([]);
});
