/**
 * mount-kutle.spec.js — KÜTLE KAYNAĞI (gerçek tarayıcı)
 *
 * 2026-10-20, Takoz adım 6. Ölçülen önce (main 03d38f0, sentetik kalıp
 * tests/helpers/step-takoz.js → kutleKalibi): tek açık parça motoru kutunun
 * merkezine düşürüyordu (kapalı parçaların merkezinden 45,15 mm), iki
 * malzemeli şanzımanın noktası kütle merkezinden 68,18 mm uzaktaydı, kütle
 * yalnız elle yazılıyordu.
 *
 * Node'da HİÇ koşmayan halkalar: kaynak seçicinin YAZISI kutusuna sığıyor mu
 * (seçicinin iç metnini yerleşim ölçeri görmez — ilk denemede "Dökme demir"
 * 76 px, alan 64 px'ti), gerçek seçimle hesap ve kütle, aktarımın "S"
 * işareti, programın kendi kaydı → sayfa yeniden → açış → föyde kaynak → aynı
 * dosyada kaynağın geri gelmesi. Birim tarafı: mount-kutle.test.js.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const STEP = require('../helpers/step-takoz.js');
const Y = require('../helpers/yerlesim-olcu.js');
test.setTimeout(240000);

const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-kutle-'));
const KALIP = path.join(DIZIN, 'kutle.stp');
const PROJE = path.join(DIZIN, 'proje.json');
test.beforeAll(() => { fs.writeFileSync(KALIP, STEP.kutleKalibi()); });
test.afterAll(() => { fs.rmSync(DIZIN, { recursive: true, force: true }); });

async function bootApp(page, w = 1600, h = 1000) {
  await page.setViewportSize({ width: w, height: h });
  page.on('dialog', (d) => d.accept());
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntOpenEditor === 'function' &&
    typeof window.veMntCad3bAc === 'function' && typeof window.THREE !== 'undefined' && Array.isArray(window.nodes),
    null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 90000 });
}
const ROL = [['Motor', 'mnt-motor'], ['Şanzıman', 'mnt-gearbox'], ['Arka braket', 'mnt-bracket']];
async function rolVer(page) {
  await page.evaluate((R) => {
    const s = veMntWizStp(), i = (a) => s.sonuc.agac.findIndex((d) => d.ad === a);
    R.forEach(([a, t]) => veMntWizStpRol(i(a), t));
  }, ROL);
}
// Kütle tablosu: seçicilerin en geniş seçeneği iç kutusuna sığıyor mu (aynı yazı tipiyle ölçülür)
const secicilerSigar = (page, kok) => page.evaluate((kok) => [...document.querySelectorAll(kok + ' select[data-mw-stp-yog]')].map((x) => {
  const c = document.createElement('canvas').getContext('2d'), cs = getComputedStyle(x);
  c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
  const metin = Math.max(...[...x.options].map((o) => c.measureText(o.text).width));
  const ic = x.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return { ad: x.getAttribute('aria-label'), sigar: metin <= ic, metin: Math.round(metin), ic: Math.round(ic) };
}).filter((x) => !x.sigar), kok);
const kutleHucre = (page, kok, ad) => page.evaluate(([kok, ad]) => {
  const s = veMntWizStp(), d = s.sonuc.agac.findIndex((x) => x.ad === ad);
  const td = document.querySelector(kok + ' tr[data-mw-stp-govde="' + d + '"] td:nth-child(4)');
  return td.querySelector('input') ? '[' + td.querySelector('input').value + ']' : td.textContent.trim();
}, [kok, ad]);

test('KART (1366×768): kaynak seçicisi sığar; dosyadan kütle merkezi, malzemeden kütle; aktarımda "S"', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page, 1366, 768);
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="step"]')]);
  await fc.setFiles(KALIP);
  await page.waitForFunction(() => { const s = veMntWizStp(); return s && s.durum === 'hazir'; }, null, { timeout: 60000 });
  await page.waitForFunction(() => typeof veMntWiz3bAcik === 'function' && veMntWiz3bAcik(), null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => { if (typeof veMntWiz3bKapat === 'function') veMntWiz3bKapat(); });
  await rolVer(page);
  await page.click('#ve-mw-body #ve-mw-stp-hesapla');
  await page.waitForSelector('#ve-mw-body table.ve-mw-tbl-kutle select[data-mw-stp-yog]');
  const KOK = '#ve-mw-body';
  // Gerçek seçim: şanzıman dosyadan (iki malzeme), braket çelik
  const sec = (ad) => KOK + ' select[aria-label="Kütle kaynağı — ' + ad + '"]';
  expect(await page.locator(sec('Motor') + ' option').allTextContents())
    .toEqual(['Elle', 'Çelik', 'Dökme demir', 'Sfero döküm', 'Alüminyum', 'Magnezyum']);
  await page.selectOption(sec('Şanzıman'), 'dosya');
  await page.selectOption(sec('Arka braket'), 'celik');
  await page.fill(KOK + ' input[data-mw-stp-kutle]', '418');
  expect([await kutleHucre(page, KOK, 'Motor'), await kutleHucre(page, KOK, 'Şanzıman'), await kutleHucre(page, KOK, 'Arka braket')])
    .toEqual(['[418]', '654,8', '22,6']);
  // Şanzımanın noktası kütle merkezi (iki malzemeyle ağırlıklı) — ağaçta da
  const konum = await page.evaluate(() => {
    const s = veMntWizStp(), b = s.coz.birimler.find((x) => x.ad === 'Şanzıman');
    const tr = document.querySelector('#ve-mw-body tr[data-ve-stp="' + b.dugum + '"]');
    return { c: b.konum.map((v) => Math.round(v * 100) / 100), agac: tr.cells[2].textContent.trim() };
  });
  expect(konum).toEqual({ c: [745.14, 40, 372.22], agac: '745,1; 40,0; 372,2' });
  // Yerleşim: seçicinin yazısı sığar, tablo yatayda taşmaz, yazı kutusunda
  expect(await secicilerSigar(page, KOK)).toEqual([]);
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-mw-yan')), 'sihirbaz · kütle')).toEqual([]);
  // Açık parça: uyarı adıyla ve payıyla
  expect(await page.locator(KOK + ' .ve-fw-issue').allTextContents())
    .toContain(' "Motor": 1 parça kapalı değil, hacme katılmadı (Kayış kapağı); yüzey payı %12,0.');
  // Aktar: braketin kütlesi malzemeden — sihirbazda "S" ve dayanağı
  await page.click(KOK + ' #ve-mw-stp-aktar');
  const g = await page.evaluate(() => {
    const r = veMntWizState().govdeler.find((x) => x.ad === 'Arka braket');
    return { mass: r.mass, kaynak: r.kaynak };
  });
  expect(g).toEqual({ mass: 22.608, kaynak: { cg: true, mass: true, I: true, not: 'Çelik · 7.850 kg/m³' } });
  await page.evaluate(() => { veMntWizGoto(VE_MW_STEPS.findIndex((s) => s.key === 'govde')); });
  await page.evaluate(() => veMntWizSec('govde', veMntWizState().govdeler.find((x) => x.ad === 'Arka braket').key));
  const isaret = await page.evaluate(() => [...document.querySelectorAll('#ve-mw-body .ve-fw-ed-alan')]
    .filter((a) => a.querySelector('sup.ve-fw-kun')).map((a) => [a.firstChild.firstChild.textContent, a.querySelector('sup').getAttribute('title')]));
  expect(isaret).toEqual([
    ['Kütle [kg]', 'STEP geometrisinden · Çelik · 7.850 kg/m³'],
    ['CG [mm]', 'STEP geometrisinden · Çelik · 7.850 kg/m³'],
    ['I [kg·m²]', 'STEP geometrisinden · Çelik · 7.850 kg/m³'],
    ['Çarpım', 'STEP geometrisinden · Çelik · 7.850 kg/m³']]);
  expect(hatalar).toEqual([]);
});

test('KAYIT: kaynak → kaydet → sayfa yeniden → föyde kaynak → aynı dosya → kaynak geri, nokta kütle merkezi', async ({ page, context }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await page.click('#ve-mnt-baslangic .ve-bas-karo[data-ey="ornek"]');
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-viewer'));
  const pencereAc = async (p) => {
    await p.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-viewer'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
    await p.waitForFunction(() => typeof veMntCadPencereAcik === 'function' && veMntCadPencereAcik());
  };
  const dosyaAc = async (p) => {
    const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 5000 }), p.click('#ve-properties #ve-mnt-cad-sec')]);
    await fc.setFiles(KALIP);
    await p.waitForFunction(() => { const k = document.getElementById('ve-mw-3b-tuval'); return k && k.getAttribute('data-durum') === 'hazir'; },
      null, { timeout: 120000 });
    await p.keyboard.press('Escape');                                    // 3B kapanır, pencere kalır
  };
  await pencereAc(page);
  await dosyaAc(page);
  await rolVer(page);
  await page.click('#ve-properties #ve-mnt-cad-hesapla');
  await page.waitForSelector('#ve-properties .ve-fp-kat[data-k="kutle"] select[data-mw-stp-yog]');
  const KOK = '#ve-properties';
  await page.selectOption(KOK + ' select[aria-label="Kütle kaynağı — Şanzıman"]', 'dosya');
  await page.selectOption(KOK + ' select[aria-label="Kütle kaynağı — Arka braket"]', 'sfero');
  expect(await kutleHucre(page, KOK, 'Arka braket')).toBe('20,4');
  expect(await secicilerSigar(page, KOK)).toEqual([]);
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-properties')), '3D Görüntüleyici · kütle')).toEqual([]);
  // 3B: türetilen kütle değer + "S"
  await page.click('#ve-properties #ve-mnt-cad-3b');
  await page.waitForFunction(() => { const k = document.getElementById('ve-mw-3b-tuval'); return k && k.getAttribute('data-durum') === 'hazir'; });
  const uc = await page.evaluate(() => [...document.querySelectorAll('#ve-mnt-3b [data-ve-3b-govdeler] tbody tr')].map((tr) => tr.cells[2].textContent.trim()));
  expect(uc).toEqual(['', '654,8S', '20,4S']);
  await page.keyboard.press('Escape');
  // Programın kendi kaydı → yeni sayfa → açış
  const json = await page.evaluate(async () => {
    let blob = null;
    const asil = window.veShowSaveDialog;
    window.veShowSaveDialog = (ad, b) => { blob = b; };
    try { veSaveTopology(); } finally { window.veShowSaveDialog = asil; }
    return blob.text();
  });
  fs.writeFileSync(PROJE, json);
  const yeni = await context.newPage();
  yeni.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(yeni);
  const [fc] = await Promise.all([yeni.waitForEvent('filechooser'), yeni.evaluate(() => veLoadTopology())]);
  await fc.setFiles(PROJE);
  await yeni.waitForFunction(() => nodes.some((n) => n.type === 'mount-analysis'));
  await yeni.evaluate(() => veMntOpenEditor(nodes.find((x) => x.type === 'mount-analysis').id));
  await yeni.waitForFunction(() => nodes.some((n) => n.type === 'mnt-viewer'));
  await pencereAc(yeni);
  const foy = await yeni.evaluate(() => [...document.querySelectorAll('#ve-properties .ve-fp-kat[data-k="kayit"] tbody tr')]
    .map((tr) => [tr.cells[0].textContent.trim(), tr.cells[2].textContent.trim()]));
  expect(foy).toEqual([['Motor', '—'], ['Şanzıman', 'Dosyadan'], ['Arka braket', 'Sfero döküm']]);
  await dosyaAc(yeni);
  await yeni.click('#ve-properties #ve-mnt-cad-hesapla');
  await yeni.waitForFunction(() => { const s = veMntWizStp(); return s.coz && s.coz.ok; });
  const geri = await yeni.evaluate(() => {
    const s = veMntWizStp(), b = s.coz.birimler.find((x) => x.ad === 'Şanzıman');
    return { c: b.konum.map((v) => Math.round(v * 100) / 100), sec: document.querySelector('#ve-properties select[aria-label="Kütle kaynağı — Arka braket"]').value };
  });
  expect(geri).toEqual({ c: [745.14, 40, 372.22], sec: 'sfero' });
  expect(await kutleHucre(yeni, KOK, 'Arka braket')).toBe('20,4');
  expect(hatalar).toEqual([]);
});
