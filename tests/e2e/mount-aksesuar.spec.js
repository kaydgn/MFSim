/**
 * mount-aksesuar.spec.js — MOTORUN AKSESUARLARI (gerçek tarayıcı)
 *
 * 2026-11-02 (kullanıcı): her aksesuar ayrı bileşen; liste kullanıcının
 * Ağırlık Merkezi Hesaplama Programı'nın motor parçaları — Alternatör ·
 * Alternatör Braketi · Klima Kompresörü · Isı Sacı. Ağırlık merkezi teknik
 * resimden, yoksa aksesuarın orta noktası.
 * Önce (main 7c94ad5): paletinde aksesuar yoktu, 3B'de aksesuar rolü yoktu.
 *
 * Node'da HİÇ koşmayan halkalar: paletin "Motor aksesuarları" grubu, pencerenin
 * "Kayıtlı aksesuar" listesinde gerçek seçim (kütle alanı, tek geri-al adımı),
 * 3B'nin "Diğer…" listesinden aksesuar rolü ve hesabın orta noktası, pencere
 * yerleşimi. Birim tarafı: mount-aksesuar.test.js.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const STEP = require('../helpers/step-takoz.js');
const Y = require('../helpers/yerlesim-olcu.js');
test.setTimeout(240000);

const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-aks-'));
const DOSYA = path.join(DIZIN, 'aksesuar.stp');
const ALT = [-420, 260, 760];
test.beforeAll(() => {
  fs.writeFileSync(DOSYA, STEP.guçGrubuStep([
    { id: 'MOTOR', ad: 'Motor bloğu', sekil: 'kutu', olcu: [700, 500, 600], konum: [0, 0, 600] },
    { id: 'ALT-GOVDE', ad: 'Alternatör gövdesi', sekil: 'kutu', olcu: [160, 150, 170], konum: [0, 0, 0], alt: 'ALT_ASM' },
    { id: 'ALT-KASNAK', ad: 'Alternatör kasnağı', sekil: 'kutu', olcu: [30, 80, 80], konum: [-95, 0, 0], alt: 'ALT_ASM' },
    { id: 'KLIMA', ad: 'Klima kompresörü', sekil: 'kutu', olcu: [180, 140, 140], konum: [-380, -250, 980] }
  ], { altMontajlar: [{ id: 'ALT_ASM', ad: 'Alternatör', konum: ALT }] }));
});
test.afterAll(() => { fs.rmSync(DIZIN, { recursive: true, force: true }); });

async function bootApp(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on('dialog', (d) => d.accept());
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntOpenEditor === 'function' &&
    typeof window.veMntCad3bAc === 'function' && typeof window.THREE !== 'undefined' && Array.isArray(window.nodes),
    null, { timeout: 90000 });
  // Özellikler paneli KAPALI başlar (Canlı Not 26); içeriğini okuyan testler tercihi açık yazar
  await page.evaluate(() => { try { localStorage.setItem(VE_MW_3B_YAN_ANAHTAR, 'acik'); } catch (e) {} });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 90000 });
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await page.click('#ve-mnt-baslangic .ve-bas-satir[data-v="tulga"] .ve-bas-satir-yukle');   // satırın Yükle'si tek tıkla kurar
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-viewer'));
}

test('PALET VE PENCERE: "Motor aksesuarları" grubu; Klima Kompresörü kütlesi kayıtlı modelden, TEK geri-al adımı', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  // Örnek yüklenince Bileşenler sütunu KAPALI gelir (kullanıcı 2026-11-05, Canlı Not 38);
  // köşe hücresindeki açma düğmesi açar
  await expect(page.locator('#ve-sidebar')).toHaveClass(/ve-sb-collapsed/);
  await page.click('#ve-sidebar-reveal');
  // Palet: Takoz kapsamında dört satır
  const grup = page.locator('.ve-category:has(> .ve-category-title:text-is("Motor aksesuarları"))');
  await expect(grup).toBeVisible();
  await expect(grup.locator('.ve-comp-label')).toHaveText(['Alternatör', 'Alternatör Braketi', 'Klima Kompresörü', 'Isı Sacı']);
  // Bileşen ve penceresi
  const id = await page.evaluate(() => { const n = createNode('mnt-ac', 900, 500); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); return n.id; });
  await page.waitForSelector('#ve-mnt-aks-' + id);
  expect(await page.locator('#ve-mnt-aks-' + id + ' option').allTextContents()).toEqual([
    '— elle gir —', 'Valeo TM21 · 8,1 kg', 'Valeo TM31 · 15,5 kg', 'Sanden 7H15 · 6,9 kg']);
  const once = await page.evaluate(() => (typeof undoStack !== 'undefined' ? undoStack.length : null));
  await page.selectOption('#ve-mnt-aks-' + id, 'valeo-tm21');
  await page.waitForFunction((i) => { const n = nodes.find((x) => x.id === i); return n && n.data.mass === 8.1; }, id);
  expect(await page.evaluate((i) => {
    const n = nodes.find((x) => x.id === i), alan = document.querySelector('#ve-properties input[data-k="mass"], #ve-properties input[id*="mass"]');
    return { kaynak: n.data.aksKatalog, nokta: n.data.pointMass, alan: alan ? alan.value : null };
  }, id)).toEqual({ kaynak: 'valeo-tm21', nokta: true, alan: '8.1' });          // .value makine biçiminde (sayı alanı)
  if (once !== null) expect(await page.evaluate(() => undoStack.length)).toBe(once + 1);
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-properties')), 'Klima Kompresörü penceresi')).toEqual([]);
  // Ctrl+Z: tek adımda kütle ve bağ geri
  await page.evaluate(() => { if (typeof undo === 'function') undo(); });
  expect(await page.evaluate((i) => { const n = nodes.find((x) => x.id === i); return n ? [n.data.mass, n.data.aksKatalog] : null; }, id))
    .toEqual([undefined, undefined]);
  // Alternatör: kütlesi bilinen beş model (aynı model tek kayıt, Canlı Not 1004); en uzun kaynak metniyle yerleşim
  const al = await page.evaluate(() => { const n = createNode('mnt-alternator', 900, 650); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); return n.id; });
  await page.waitForSelector('#ve-mnt-aks-' + al);
  expect(await page.locator('#ve-mnt-aks-' + al + ' option').count()).toBe(6);
  await page.selectOption('#ve-mnt-aks-' + al, 'prestolite-120a');
  await page.waitForFunction((i) => { const n = nodes.find((x) => x.id === i); return n && n.data.mass === 8.16; }, al);
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-properties')), 'Alternatör penceresi')).toEqual([]);
  expect(hatalar).toEqual([]);
});

test('3B ROLÜ: Rol listesinin "Motor aksesuarları" grubunda dört aksesuar; alternatör rolü → ağırlık merkezi orta nokta', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-viewer'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForFunction(() => typeof veMntCadPencereAcik === 'function' && veMntCadPencereAcik());
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click('#ve-properties #ve-mnt-cad-sec')]);
  await fc.setFiles(DOSYA);
  await page.waitForFunction(() => { const k = document.getElementById('ve-mw-3b-tuval'); return k && k.getAttribute('data-durum') === 'hazir'; },
    null, { timeout: 120000 });
  const i = await page.evaluate(() => {
    const s = veMntWizStp(), bul = (a) => s.sonuc.agac.findIndex((d) => d.ad === a);
    veMntWizStpRol(bul('Motor bloğu'), 'mnt-motor');
    veMntWiz3bSec(bul('Alternatör'));
    return bul('Alternatör');
  });
  const rol = page.locator('#ve-mnt-3b #ve-mw-3b-rol');
  await expect(rol).toBeVisible();
  // Rol alanının listesi (Canlı Not 49): grup başlığının altındaki satırlar
  await rol.click();
  const ops = await page.evaluate(() => {
    const G = {}; let g = null;
    document.querySelectorAll('#ve-mw-3b-menu > .ve-mw-3b-menu-bas, #ve-mw-3b-menu > .ve-mw-3b-menu-o, #ve-mw-3b-menu > .ve-mw-3b-menu-ayrac').forEach((e) => {
      if (e.classList.contains('ve-mw-3b-menu-bas')) { g = e.textContent; G[g] = []; }
      else if (e.classList.contains('ve-mw-3b-menu-ayrac')) g = null;          // ayraçtan sonra Rolü kaldır
      else if (g) G[g].push(e.textContent);
    });
    return G['Motor aksesuarları'];
  });
  expect(ops).toEqual(['Alternatör', 'Alternatör Braketi', 'Klima Kompresörü', 'Isı Sacı']);
  await page.click('#ve-mw-3b-menu [data-k="rol:mnt-alternator"]');
  await page.waitForFunction((d) => veMntWizStp().roller[d] === 'mnt-alternator', i);
  await page.evaluate(() => { const s = veMntWizStp(); veMntWizStpRol(s.sonuc.agac.findIndex((d) => d.ad === 'Klima kompresörü'), 'mnt-ac'); });
  await page.click('#ve-mnt-3b #ve-mw-3b-hesapla');
  await page.waitForFunction(() => { const s = veMntWizStp(); return s.coz && s.coz.ok; });
  const r = await page.evaluate((d) => { const s = veMntWizStp(), b = s.coz.birimler.find((x) => x.dugum === d); return { kaynak: b.kaynak, konum: b.konum }; }, i);
  expect(r.kaynak).toBe('orta');
  [ALT[0] - 15, ALT[1], ALT[2]].forEach((v, k) => expect(Math.abs(r.konum[k] - v)).toBeLessThan(1e-6));
  // Kütle tablosu: klima kompresörünün kaynağında "Katalog" grubu; seçilen modelin kütlesi
  await page.evaluate(() => veMntWiz3bKapat());
  const kl = await page.evaluate(() => veMntWizStp().sonuc.agac.findIndex((d) => d.ad === 'Klima kompresörü'));
  const sec = page.locator('#ve-properties select[data-mw-stp-yog="' + kl + '"]');
  await expect(sec.locator('optgroup[label="Katalog"] option')).toHaveCount(3);
  await sec.selectOption('valeo-tm21');
  await expect(page.locator('#ve-properties [data-mw-stp-kutle-deger="' + kl + '"]').first()).toHaveText('8,10');
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-properties')), '3D Görüntüleyici · aksesuar')).toEqual([]);
  expect(hatalar).toEqual([]);
});
