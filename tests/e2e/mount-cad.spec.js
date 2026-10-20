/**
 * mount-cad.spec.js — 3D GÖRÜNTÜLEYİCİ: CAD'İN EVİ (gerçek tarayıcı)
 *
 * 2026-10-20, Takoz adım 4. Ölçülen önce (main 1ae9e2c): pencerede yalnız
 * "henüz yok" notu; 7 rolün 0'ı projeye yazılıyor, aynı dosya yeniden
 * açılınca 0 / 7; "Yeni proje"nin ilk Takoz modülünde önceki projenin STEP
 * dosyası ve rolleri.
 *
 * Node'da HİÇ koşmayan halkalar: pencerenin dosya seçicisi (gerçek
 * filechooser) ve okuma çubuğu + Vazgeç, 3B'nin kendi perdesinde açılması
 * ve Esc'in yalnız onu kapatması, programın KENDİ kaydı (veSaveTopology'nin
 * Blob'u) → sayfa yeniden → programın kendi açışı (veLoadTopology) → aynı
 * dosyada rollerin geri gelmesi. Birim tarafı: mount-cad.test.js.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const STEP = require('../helpers/step-takoz.js');
const Y = require('../helpers/yerlesim-olcu.js');
test.setTimeout(240000);

const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-cad-'));
const GUC = path.join(DIZIN, 'guc.stp');
const BUYUK = path.join(DIZIN, 'deneme-30.stp');
const PROJE = path.join(DIZIN, 'proje.json');
test.beforeAll(() => {
  fs.writeFileSync(GUC, STEP.gucGrubu());
  execFileSync(process.execPath, [path.join(__dirname, '../../tools/step-deneme.js'), '--mb', '30', '--cikti', BUYUK]);
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
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 90000 });
}
async function modulVeOrnek(page) {
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await page.click('#ve-mnt-baslangic .ve-bas-karo[data-ey="ornek"]');
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-viewer'));
}
async function pencereAc(page) {
  await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-viewer'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForFunction(() => typeof veMntCadPencereAcik === 'function' && veMntCadPencereAcik());
}
async function pencereden(page, dosya) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click('#ve-properties #ve-mnt-cad-sec')]);
  await fc.setFiles(dosya);
}
const ucHazir = (page) => page.waitForFunction(() => {
  const k = document.getElementById('ve-mw-3b-tuval');
  return k && k.getAttribute('data-durum') === 'hazir';
}, null, { timeout: 120000 });
const ROL = { 'Motor bloğu': 'mnt-motor', 'Şanzıman gövdesi': 'mnt-gearbox', 'Arka braket': 'mnt-bracket' };

test('PENCERE: seçici → çubuk + Vazgeç; dosya → kendi perdesinde 3B; rol; Esc yalnız 3B\'yi kapatır', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await modulVeOrnek(page);
  await pencereAc(page);
  // Dosyasız: tek bölüm, yönlendirme, eylem dosya seçici; yerleşim temiz
  await page.evaluate(Y.KAYNAK);
  const bos = await page.evaluate(() => ({
    bolum: [...document.querySelectorAll('#ve-properties .ve-fp-govde > .ve-fp-kat')].map((k) => k.getAttribute('data-k')),
    eylem: [...document.querySelectorAll('#ve-properties .ve-fp-solve')].map((e) => e.tagName + ':' + e.textContent.trim()),
    yer: window.__yerlesim('#ve-properties') }));
  expect([bos.bolum, bos.eylem]).toEqual([['dosya'], ['BUTTON:STEP dosyası seç…']]);
  expect(Y.yerlesimOzet(bos.yer, '3D Görüntüleyici · dosyasız')).toEqual([]);
  // Büyük dosya: okunurken eylem çubuk + Vazgeç; Vazgeç okumayı bırakır
  await pencereden(page, BUYUK);
  await page.waitForSelector('#ve-properties #ve-mnt-cad-vazgec', { timeout: 10000 });
  expect(await page.evaluate(() => !!document.querySelector('#ve-properties .ve-fp-yurut[data-is] .ve-fp-ilerleme'))).toBe(true);
  await page.click('#ve-properties #ve-mnt-cad-vazgec');
  expect(await page.evaluate(() => veMntWizStp())).toBe(null);
  await page.waitForSelector('#ve-properties #ve-mnt-cad-sec');
  // Güç grubu: okununca 3B pencerenin perdesinde açılır, aktarım yok
  await pencereden(page, GUC);
  await ucHazir(page);
  const uc = await page.evaluate(() => ({
    yer: veMntWiz3bYer(), perde: getComputedStyle(document.getElementById('ve-mnt-3b-overlay')).display,
    kapat: !!document.querySelector('#ve-mnt-3b .ve-settings-header .ve-settings-close .mf-ico-x'),
    aktar: !!document.getElementById('ve-mw-3b-aktar'), sihirbaz: veMntWizAcik() }));
  expect(uc).toEqual({ yer: 'pencere', perde: 'flex', kapat: true, aktar: false, sihirbaz: false });
  // 3B'den rol: gerçek tıklama ile motoru seç, çipten rol ver
  await page.evaluate(() => veMntWiz3bSec(veMntWizStp().sonuc.agac.find((d) => d.ad === 'Motor bloğu').i));
  await page.click('#ve-mnt-3b [data-ve-3b-rol="mnt-motor"]');
  expect(await page.evaluate(() => nodes.find((x) => x.type === 'mnt-viewer').data.cad.roller.map((r) => r.rol))).toEqual(['mnt-motor']);
  // Esc: 3B kapanır, pencere açık ve rolü ağacında gösteriyor
  await page.keyboard.press('Escape');
  const sonra = await page.evaluate(() => ({
    uc: veMntWiz3bAcik(), perde: getComputedStyle(document.getElementById('ve-mnt-3b-overlay')).display, pencere: veMntCadPencereAcik(),
    em: document.querySelector('#ve-properties .ve-fp-kat[data-k="parca"] .ve-fp-sect em').textContent,
    eylem: document.querySelector('#ve-properties .ve-fp-solve').id }));
  expect(sonra).toEqual({ uc: false, perde: 'none', pencere: true, em: '1 rol', eylem: 've-mnt-cad-3b' });
  // Pencerenin ağacından rol + hesap → Kütle bölümü; yerleşim temiz
  await page.selectOption('#ve-properties tr[data-ve-stp] select >> nth=1', 'mnt-gearbox');
  await page.click('#ve-properties #ve-mnt-cad-hesapla');
  await page.waitForSelector('#ve-properties .ve-fp-kat[data-k="kutle"] input[data-mw-stp-kutle]');
  await page.evaluate(Y.KAYNAK);
  const hazir = await page.evaluate(() => ({ yer: window.__yerlesim('#ve-properties'),
    kaydirma: document.querySelector('#ve-properties .ve-properties-content').scrollWidth - document.querySelector('#ve-properties .ve-properties-content').clientWidth }));
  expect(Y.yerlesimOzet(hazir.yer, '3D Görüntüleyici · hazır')).toEqual([]);
  expect(hazir.kaydirma).toBe(0);
  // "3B'de aç" aynı görüntüleyiciyi yeniden açar
  await page.click('#ve-properties #ve-mnt-cad-3b');
  await ucHazir(page);
  expect(await page.evaluate(() => veMntWiz3bYer())).toBe('pencere');
  await page.click('#ve-mnt-3b .ve-settings-close');
  expect(await page.evaluate(() => veMntWiz3bAcik())).toBe(false);
  expect(hatalar).toEqual([]);
});

test('KAYIT: rolleri kaydet → sayfa yeniden → projeyi aç → aynı dosya → roller ve kütle geri; yeni projede eski oturum yok', async ({ page, context }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await modulVeOrnek(page);
  await pencereAc(page);
  await pencereden(page, GUC);
  await ucHazir(page);
  await page.keyboard.press('Escape');
  await page.evaluate((R) => {
    const s = veMntWizStp();
    s.sonuc.agac.forEach((d) => {
      if (R[d.ad]) veMntWizStpRol(d.i, R[d.ad]);
      if (/takoz$/.test(d.ad)) veMntWizStpRol(d.i, 'mnt-mount');
    });
    veMntWizStpHesapla();
    veMntWizStpKutle(s.sonuc.agac.find((d) => d.ad === 'Motor bloğu').i, '412');
  }, ROL);
  const once = await page.evaluate(() => veMntWizStp().sonuc.agac.filter((d) => veMntWizStp().roller[d.i]).map((d) => d.ad + ':' + veMntWizStp().roller[d.i]));
  expect(once).toHaveLength(7);
  // Programın kendi kaydı: Farklı kaydet penceresine giden Blob
  const json = await page.evaluate(async () => {
    let blob = null;
    const asil = window.veShowSaveDialog;
    window.veShowSaveDialog = (ad, b) => { blob = b; };
    try { veSaveTopology(); } finally { window.veShowSaveDialog = asil; }
    return blob.text();
  });
  expect(json.indexOf('ISO-10303-21')).toBe(-1);                 // dosya projede değil
  expect((json.match(/"rol":"mnt-/g) || []).length).toBe(7);
  fs.writeFileSync(PROJE, json);
  // Yeni proje: ilk Takoz modülü (aynı kimlik) eski oturumu göstermez
  await page.evaluate(() => { const a = window.showConfirmToast; window.showConfirmToast = (m, f) => f(); try { veNewProject(); } finally { window.showConfirmToast = a; } });
  expect(await page.evaluate(() => veMntWizStp())).toBe(null);
  // Ertesi gün: yeni sayfa, programın açışı
  const yeni = await context.newPage();
  yeni.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(yeni);
  const [fc] = await Promise.all([yeni.waitForEvent('filechooser'), yeni.evaluate(() => veLoadTopology())]);
  await fc.setFiles(PROJE);
  await yeni.waitForFunction(() => nodes.some((n) => n.type === 'mount-analysis'));
  await yeni.evaluate(() => veMntOpenEditor(nodes.find((x) => x.type === 'mount-analysis').id));
  await yeni.waitForFunction(() => nodes.some((n) => n.type === 'mnt-viewer'));
  await pencereAc(yeni);
  // Dosya açık değil: kayıtlı roller föyde
  const kayit = await yeni.evaluate(() => ({
    bolum: [...document.querySelectorAll('#ve-properties .ve-fp-govde > .ve-fp-kat')].map((k) => k.getAttribute('data-k')),
    satir: document.querySelectorAll('#ve-properties .ve-fp-kat[data-k="kayit"] tbody tr').length,
    kunye: document.querySelector('#ve-properties [data-mnt-cad-kayit]').textContent }));
  expect(kayit.bolum).toEqual(['dosya', 'kayit']);
  expect(kayit.satir).toBe(7);
  expect(kayit.kunye).toMatch(/guc\.stp/);
  await pencereden(yeni, GUC);
  await ucHazir(yeni);
  await yeni.keyboard.press('Escape');
  const sonra = await yeni.evaluate(() => {
    const s = veMntWizStp();
    return { roller: s.sonuc.agac.filter((d) => s.roller[d.i]).map((d) => d.ad + ':' + s.roller[d.i]),
      kg: s.kutle[s.sonuc.agac.find((d) => d.ad === 'Motor bloğu').i],
      durum: document.querySelector('#ve-properties [data-mw-stp-kayit]').textContent.trim() };
  });
  expect(sonra).toEqual({ roller: once, kg: 412, durum: 'Kayıtlı roller: 7 / 7' });
  expect(hatalar).toEqual([]);
});
