/**
 * mount-veri-sayfasi.spec.js — VERİ SAYFASINDAN AĞIRLIK MERKEZİ (gerçek tarayıcı)
 *
 * 2026-11-02 (kullanıcının yöntemi): motorun veri sayfası ağırlık merkezini
 * bloğun ön yüzünden ve krank ekseninden verir; referansın yeri STEP dosyasında.
 * Önce (main 143c2cc): 3B'de motor modeli seçilemiyordu, ağırlık merkezi yalnız
 * geometriden (gerçek Tulga'da sunudakinden 38,4 mm uzak).
 *
 * Node'da HİÇ koşmayan halkalar: 3B'nin dizisinde model listesi, iki seçim
 * düğmesi, gerçek fareyle düzlem yüzün ve dairesel kenarın üstüne gelmek
 * (halka + ipucu) ve tıklamak, hesabın sununun motor ağırlık merkezini vermesi,
 * föyde satırın seçili gelmesi, Esc, dizinin yerleşimi. Birim tarafı:
 * mount-veri-sayfasi.test.js.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const STEP = require('../helpers/step-takoz.js');
const Y = require('../helpers/yerlesim-olcu.js');
test.setTimeout(240000);

const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-veri-'));
const TULGA = path.join(DIZIN, 'tulga.stp');
const KAY = STEP.TULGA_OTELEME;
test.beforeAll(() => { fs.writeFileSync(TULGA, STEP.tulgaKalibi({ oteleme: KAY, onFark: [0, 0, -2], krank: true })); });
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
}
const TAKOZ = STEP.TULGA_TAKOZ.map((t) => t[1]);

test('VERİ SAYFASI: 3B\'de model, ön yüz ve krank ekseni gerçek fareyle; ağırlık merkezi sununun; föyde seçili', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  // Tulga örneği tuvalde; 3D Görüntüleyici penceresinden dosya
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await page.click('#ve-mnt-baslangic .ve-bas-satir[data-v="tulga"] .ve-bas-satir-yukle');   // satırın Yükle'si tek tıkla kurar
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-viewer'));
  await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-viewer'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForFunction(() => typeof veMntCadPencereAcik === 'function' && veMntCadPencereAcik());
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click('#ve-properties #ve-mnt-cad-sec')]);
  await fc.setFiles(TULGA);
  await page.waitForFunction(() => { const k = document.getElementById('ve-mw-3b-tuval'); return k && k.getAttribute('data-durum') === 'hazir'; },
    null, { timeout: 120000 });
  await page.evaluate((T) => {
    const s = veMntWizStp(), i = (a) => s.sonuc.agac.findIndex((d) => d.ad === a);
    [['Motor bloğu', 'mnt-motor'], ['Şanzıman gövdesi', 'mnt-gearbox'], ['Transfer gövdesi', 'mnt-transfer']]
      .concat(T.map((a) => [a, 'mnt-mount'])).forEach(([a, t]) => veMntWizStpRol(i(a), t));
    veMntWiz3bSec(i('Motor bloğu'));
  }, TAKOZ);

  // Dizi: model listesi, model seçilince iki düğme (veri sayfasının adlarıyla)
  await expect(page.locator('#ve-mw-3b-veri')).toBeVisible();
  expect(await page.locator('[data-ve-3b-ref]').count()).toBe(0);
  await page.selectOption('#ve-mw-3b-veri', 'cummins-isb67-360');
  await expect(page.locator('[data-ve-3b-ref]')).toHaveText(['Bloğun ön yüzü', 'Krank ekseni']);

  // ÖN YÜZ: kip kamerayı motora sığdırır; düzlem yüzün üstüne gel → halka + ipucu; tıkla
  await page.click('[data-ve-3b-ref="yuz"]');
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-mnt-3b')), '3B · veri sayfası')).toEqual([]);
  if (process.env.MFSIM_VERI_GORUNTU) await page.screenshot({ path: process.env.MFSIM_VERI_GORUNTU });
  expect(await page.evaluate(() => [veMntWiz3bDurum().ref, document.getElementById('ve-mw-3b-tuval').classList.contains('ve-mw-3b-nokta-kip')]))
    .toEqual(['yuz', true]);
  const yuz = await page.evaluate(() => {
    const pi = veMntWizStp().sonuc.parcalar.findIndex((p) => p.ad === 'Motor bloğu');
    return veMntWiz3bYuzNoktasi(pi, [-1, 0, 0]);
  });
  expect(yuz).not.toBe(null);
  await page.mouse.move(yuz.x, yuz.y);
  await page.waitForFunction(() => { const a = veMntWiz3bDurum().aday; return a && a.tur === 'yuz'; });
  expect(await page.evaluate(() => [veMntWiz3bDurum().adayHalka, document.getElementById('ve-mw-3b-ipucu').textContent]))
    .toEqual([true, 'Düzlem · x = −277,040 mm']);
  await page.mouse.click(yuz.x, yuz.y);
  await page.waitForFunction(() => veMntWiz3bDurum().ref === '');
  await expect(page.locator('[data-ve-3b-ref="yuz"]')).toHaveAttribute('data-secildi', '1');

  // Esc yalnız kipi kapatır
  await page.click('[data-ve-3b-ref="eksen"]');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => [veMntWiz3bDurum().ref, veMntWiz3bAcik()])).toEqual(['', true]);

  // KRANK EKSENİ: kasnağın dairesi (Ø157) — motor biriminin dışında
  await page.click('[data-ve-3b-ref="eksen"]');
  const daire = await page.evaluate(() => {
    const pi = veMntWizStp().sonuc.parcalar.findIndex((p) => p.ad === 'Krank kasnağı');
    return veMntWiz3bDaireNoktasi(pi, 78.5);
  });
  expect(daire).not.toBe(null);
  await page.mouse.move(daire.x, daire.y);
  await page.waitForFunction(() => { const a = veMntWiz3bDurum().aday; return a && a.tur === 'eksen' && a.r === 78.5; });
  expect(await page.evaluate(() => document.getElementById('ve-mw-3b-ipucu').textContent)).toMatch(/^Ø 157,0 mm · −(317|277),040; 40,026; 434,626$/);
  await page.mouse.click(daire.x, daire.y);
  await page.waitForFunction(() => veMntWiz3bDurum().ref === '');

  // Hesap: ağırlık merkezi sununun motor ağırlık merkezi (+ öteleme); referans işareti ve eksenin halkası
  await page.click('#ve-mnt-3b #ve-mw-3b-hesapla');
  await page.waitForFunction(() => { const s = veMntWizStp(); return s.coz && s.coz.ok; });
  const sonuc = await page.evaluate(() => {
    const s = veMntWizStp(), d = s.sonuc.agac.findIndex((x) => x.ad === 'Motor bloğu'), b = s.coz.birimler.find((x) => x.dugum === d);
    return { kaynak: b.kaynak, konum: b.konum, R: b.veri.R, durum: veMntWiz3bDurum(),
      kayit: nodes.find((x) => x.type === 'mnt-viewer').data.cad.roller.find((x) => x.rol === 'mnt-motor') };
  });
  expect(sonuc.kaynak).toBe('veri');
  const beklenen = [124.96, 0.05, 550.03].map((v, i) => v + KAY[i]);
  sonuc.konum.forEach((v, i) => expect(Math.abs(v - beklenen[i])).toBeLessThan(1e-6));
  expect(sonuc.durum.referans).toBe(1);
  expect(sonuc.kayit.yog).toBe('cummins-isb67-360');
  expect(Object.keys(sonuc.kayit.ref).sort()).toEqual(['eksen', 'yuz']);

  // Pencerenin föyü: motor satırı seçili, fark 0,0; kütle tablosunda model ve
  // sayfanın ıslak kütlesi (yazılmaz — aksesuarlar ayrı bileşen)
  await page.evaluate(() => veMntWiz3bKapat());
  const foy = await page.evaluate(() => {
    const k = document.querySelector('#ve-properties .ve-fp-kat[data-k="model"]');
    const tr = [...k.querySelectorAll('tr[data-mw-stp-satir]')].map((r) => ({ birim: r.cells[1].textContent, fark: r.cells[3].textContent, secili: r.querySelector('input').checked }));
    const motor = veMntWizStp().sonuc.agac.findIndex((x) => x.ad === 'Motor bloğu');
    const sec = document.querySelector('#ve-properties select[data-mw-stp-yog="' + motor + '"]');
    const kg = document.querySelector('#ve-properties [data-mw-stp-kutle-deger="' + motor + '"]');
    return { tr, kaynak: sec.options[sec.selectedIndex].textContent, kg: kg && kg.textContent,
      alan: !!document.querySelector('#ve-properties input[data-mw-stp-kutle="' + motor + '"]') };
  });
  expect(foy.tr.find((r) => r.birim === 'Motor bloğu')).toEqual({ birim: 'Motor bloğu', fark: '0,0', secili: true });
  expect(foy.tr.find((r) => r.birim === 'Şanzıman gövdesi').secili).toBe(false);
  expect([foy.kaynak, foy.kg, foy.alan]).toEqual(['ISB6.7 360', '512,0', false]);
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-properties')), '3D Görüntüleyici · veri sayfası')).toEqual([]);
  expect(hatalar).toEqual([]);
});
