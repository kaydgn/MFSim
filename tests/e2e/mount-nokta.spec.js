/**
 * mount-nokta.spec.js — TAKOZ NOKTASI: DAİREDEN SEÇİM (gerçek tarayıcı)
 *
 * 2026-10-20, Takoz adım 5. Ölçülen önce (main 7d1539b, sunudaki beş noktada
 * duran sentetik takoz kalıbı): nokta biriminin hacim merkeziydi — sunudaki
 * CATIA ölçüsünün 37,44 mm altında (somunlu kalıp); 3B'de daireden nokta
 * seçmenin yolu yoktu.
 *
 * Node'da HİÇ koşmayan halkalar: gerçek fareyle dairesel kenarın üstüne
 * gelmek (halka + ipucu), tıklamak (nokta dairenin merkezi), kipin kamerayı
 * takoza sığdırması, Esc'in yalnız kipi kapatması, 3B kartının yerleşimi ve
 * programın kendi kaydı → sayfa yeniden → açış → aynı dosyada seçimin geri
 * gelmesi. Birim tarafı: mount-nokta.test.js · mount-3b.test.js.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const STEP = require('../helpers/step-takoz.js');
const Y = require('../helpers/yerlesim-olcu.js');
test.setTimeout(240000);

const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-nokta-'));
const TULGA = path.join(DIZIN, 'tulga.stp');
const PROJE = path.join(DIZIN, 'proje.json');
test.beforeAll(() => { fs.writeFileSync(TULGA, STEP.tulgaKalibi({ varyant: 'somun' })); });
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
async function pencereAc(page) {
  await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-viewer'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForFunction(() => typeof veMntCadPencereAcik === 'function' && veMntCadPencereAcik());
}
async function dosyaAc(page) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click('#ve-properties #ve-mnt-cad-sec')]);
  await fc.setFiles(TULGA);
  await page.waitForFunction(() => { const k = document.getElementById('ve-mw-3b-tuval'); return k && k.getAttribute('data-durum') === 'hazir'; },
    null, { timeout: 120000 });
}
const TAKOZ = STEP.TULGA_TAKOZ.map((t) => t[1]);
async function rolVer(page) {
  await page.evaluate((T) => {
    const s = veMntWizStp(), i = (a) => s.sonuc.agac.findIndex((d) => d.ad === a);
    [['Motor bloğu', 'mnt-motor'], ['Şanzıman gövdesi', 'mnt-gearbox'], ['Transfer gövdesi', 'mnt-transfer']]
      .concat(T.map((a) => [a, 'mnt-mount'])).forEach(([a, t]) => veMntWizStpRol(i(a), t));
  }, TAKOZ);
}
const satirlar = (page) => page.evaluate(() => [...document.querySelectorAll('#ve-mnt-3b [data-ve-3b-takozlar] tbody tr')]
  .map((tr) => [...tr.cells].map((c) => c.textContent.trim())));

test('DAİREDEN NOKTA: öneri sunudaki sayı; kip takoza sığar; kenara gel → halka; tıkla → merkez; Öneriye dön; Esc yalnız kip', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await page.click('#ve-mnt-baslangic .ve-bas-karo[data-ey="ornek"]');
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-viewer'));
  await pencereAc(page);
  await dosyaAc(page);
  await rolVer(page);
  await page.click('#ve-mnt-3b #ve-mw-3b-hesapla');
  await page.waitForFunction(() => { const s = veMntWizStp(); return s.coz && s.coz.ok; });
  // Öneri: beş takoz sunudaki CATIA ölçüsü, üst plakanın dairesi; beş halka
  expect(await satirlar(page)).toEqual([
    ['Ön takoz', '−196,034; 0,047; 179,682', 'Üst yüz Ø 70,0'],
    ['Sağ ön takoz', '439,961; 356,042; 499,855', 'Üst yüz Ø 70,0'],
    ['Sol ön takoz', '439,957; −355,957; 499,855', 'Üst yüz Ø 70,0'],
    ['Sağ arka takoz', '1.381,672; 305,873; 43,452', 'Üst yüz Ø 70,0'],
    ['Sol arka takoz', '1.381,671; −304,131; 51,439', 'Üst yüz Ø 70,0']]);
  expect(await page.evaluate(() => veMntWiz3bDurum().halka)).toBe(5);
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-mnt-3b')), '3B · takoz noktası')).toEqual([]);

  // Kip: Sol ön takozun bir parçası seçiliyken düğme; kip birimi seçer, kamerayı ona sığdırır
  await page.evaluate(() => veMntWiz3bSec(veMntWizStp().sonuc.agac.findIndex((d) => d.ad === 'Sol ön takoz taban flanşı')));
  await page.click('#ve-mw-3b-nokta');
  const kip = await page.evaluate(() => {
    const s = veMntWizStp(), d = s.sonuc.agac.findIndex((x) => x.ad === 'Sol ön takoz'), V = veMntWiz3bDurum();
    const R = document.querySelector('#ve-mw-3b-tuval canvas').getBoundingClientRect();
    // birimin ekrandaki boyu: üst plakanın dairesinin iki ucu
    const ust = [439.957, -355.957, 499.855].map((v, k) => v), ic = (p) => { const q = new THREE.Vector3(p[0], p[1], p[2]).project(_mw3b.camera); return [(q.x + 1) / 2 * R.width, (1 - q.y) / 2 * R.height]; };
    const a = ic([ust[0] - 35, ust[1], ust[2]]), b = ic([ust[0] + 35, ust[1], ust[2]]);
    return { kip: V.kip === d, secili: V.secili === d, sinif: document.getElementById('ve-mw-3b-tuval').classList.contains('ve-mw-3b-nokta-kip'),
      basili: document.getElementById('ve-mw-3b-nokta').getAttribute('aria-pressed'), cap: Math.hypot(a[0] - b[0], a[1] - b[1]) };
  });
  expect([kip.kip, kip.secili, kip.sinif, kip.basili]).toEqual([true, true, true, 'true']);
  expect(kip.cap).toBeGreaterThan(150);                                      // montajın içinde ~10 px'ti
  // Nokta işareti ekranda SABİT boyda: montaja göre boyutlanan küre yakında
  // daireyi örtüyordu. İki uzaklıkta ölçülür (kare çizildikten sonra).
  const isaretPx = () => page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const V = _mw3b, R = document.querySelector('#ve-mw-3b-tuval canvas').getBoundingClientRect();
    const hedefN = new THREE.Vector3(439.957, -355.957, 499.855);
    const m = V.sonucGrubu.children.filter((o) => o.geometry && o.geometry.type === 'SphereGeometry')
      .sort((a, b) => a.position.distanceTo(hedefN) - b.position.distanceTo(hedefN))[0];
    const sag = new THREE.Vector3().setFromMatrixColumn(V.camera.matrixWorld, 0).multiplyScalar(m.scale.x);
    const a = m.position.clone().project(V.camera), b = m.position.clone().add(sag).project(V.camera);
    ok(Math.hypot((b.x - a.x) / 2 * R.width, (b.y - a.y) / 2 * R.height));
  }))));
  const yakin = await isaretPx();
  await page.evaluate(() => { _mw3b.ctrl.r *= 4; _mw3bKamera(); _mw3bCiz(true); });
  const uzak = await isaretPx();
  await page.evaluate(() => { _mw3b.ctrl.r /= 4; _mw3bKamera(); _mw3bCiz(true); });
  [yakin, uzak].forEach((px) => { expect(px).toBeGreaterThan(4); expect(px).toBeLessThan(9); });
  expect(Math.abs(yakin - uzak)).toBeLessThan(0.5);
  // Esc yalnız kipi kapatır
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => [veMntWiz3bDurum().kip, veMntWiz3bAcik()])).toEqual([-1, true]);
  await page.click('#ve-mw-3b-nokta');

  // Gerçek fare: flanşın dairesi (Ø 120) — üstüne gel: halka + ipucu
  const hedef = await page.evaluate(() => {
    const pi = veMntWizStp().sonuc.parcalar.findIndex((p) => p.ad === 'Sol ön takoz taban flanşı');
    return veMntWiz3bDaireNoktasi(pi, 60);
  });
  expect(hedef).not.toBe(null);
  await page.mouse.move(hedef.x, hedef.y);
  await page.waitForFunction(() => { const a = veMntWiz3bDurum().aday; return a && a.r === 60; });
  expect(await page.evaluate(() => veMntWiz3bDurum().adayHalka)).toBe(true);
  const ipucu = await page.evaluate(() => document.getElementById('ve-mw-3b-ipucu').textContent);
  expect(ipucu).toMatch(/^Ø 120,0 mm · 439,957; −355,957; 4(31|41),855$/);
  // Tıkla: nokta dairenin merkezi (dosyadaki sayı), kip kapanır, kayda yazılır
  await page.mouse.click(hedef.x, hedef.y);
  await page.waitForFunction(() => veMntWiz3bDurum().kip === -1);
  const secildi = await page.evaluate(() => {
    const s = veMntWizStp(), d = s.sonuc.agac.findIndex((x) => x.ad === 'Sol ön takoz'), b = s.coz.birimler.find((x) => x.dugum === d);
    return { kaynak: b.kaynak, konum: b.konum, r: b.nokta.r,
      kayit: nodes.find((x) => x.type === 'mnt-viewer').data.cad.roller.find((x) => x.ad === 'Sol ön takoz').nokta };
  });
  expect(secildi.kaynak).toBe('kenar');
  expect(secildi.r).toBe(60);
  expect([secildi.konum[0], secildi.konum[1]]).toEqual([439.957, -355.957]);
  expect(secildi.kayit.c).toEqual(secildi.konum);
  expect((await satirlar(page))[2]).toEqual(['Sol ön takoz', '439,957; −355,957; ' + (secildi.konum[2] > 435 ? '441' : '431') + ',855', 'Daire Ø 120,0']);
  // Kipte boşluğa tıklamak: sebebi ipucunda, kip sürer
  await page.click('#ve-mw-3b-nokta');
  const R = await page.evaluate(() => { const r = document.querySelector('#ve-mw-3b-tuval canvas').getBoundingClientRect(); return [r.left, r.top]; });
  await page.mouse.click(R[0] + 30, R[1] + 30);
  expect(await page.evaluate(() => [document.getElementById('ve-mw-3b-ipucu').textContent, veMntWiz3bDurum().kip >= 0]))
    .toEqual(['Dairesel kenar yok.', true]);
  // ÖRTÜLEN KENAR seçilmez: flanşın alt dairesinin arka yarısı takozun arkasında —
  // ekranda üstüne düştüğü yerde aranan kenar o yarı olamaz
  const ortulu = await page.evaluate(() => {
    const V = _mw3b, s = V.s, pi = s.sonuc.parcalar.findIndex((p) => p.ad === 'Sol ön takoz taban flanşı'), a = s.ag[pi];
    const R = V.renderer.domElement.getBoundingClientRect(), birim = {};
    veMntWiz3bParcalar(s, V.nokta).forEach((i) => { birim[i] = 1; });
    let deneme = 0, kacan = 0;
    for (let q = 0; q < a.daire.length; q += 3) {
      const d = veMntStpKenarDaire(s.sonuc, pi, a.daire[q]);
      if (d.c[2] > 435) continue;                                     // alt daire (431,855)
      for (let sg = a.daire[q + 1]; sg < a.daire[q + 1] + a.daire[q + 2]; sg++) {
        const k = sg * 6, p = new THREE.Vector3((a.cizgi[k] + a.cizgi[k + 3]) / 2, (a.cizgi[k + 1] + a.cizgi[k + 4]) / 2, (a.cizgi[k + 2] + a.cizgi[k + 5]) / 2);
        const e = p.clone().project(V.camera), x = R.left + (e.x + 1) / 2 * R.width, y = R.top + (1 - e.y) / 2 * R.height;
        V.ray.setFromCamera(new THREE.Vector2(e.x, e.y), V.camera);
        const vur = _mw3bIsabetIsin(V.ray.ray.origin, V.ray.ray.direction, birim);
        if (!(p.distanceTo(V.ray.ray.origin) > vur.t + 20)) continue;  // görünür ya da sınırda
        deneme++;
        const b = _mw3bDaireAra(x, y);
        if (b && b.kenar === a.daire[q]) kacan++;
      }
    }
    return { deneme, kacan };
  });
  expect(ortulu.deneme).toBeGreaterThan(3);
  expect(ortulu.kacan).toBe(0);
  await page.keyboard.press('Escape');
  // Öneriye dön: kaynak eksen, kayıttaki seçim gider
  await page.click('#ve-mw-3b-nokta-oneri');
  expect(await page.evaluate(() => {
    const s = veMntWizStp(), d = s.sonuc.agac.findIndex((x) => x.ad === 'Sol ön takoz');
    return [s.coz.birimler.find((x) => x.dugum === d).kaynak, nodes.find((x) => x.type === 'mnt-viewer').data.cad.roller.find((x) => x.ad === 'Sol ön takoz').nokta];
  })).toEqual(['eksen', undefined]);
  expect(hatalar).toEqual([]);
});

test('KAYIT: seçilen daire → kaydet → sayfa yeniden → aç → föyde çapı → aynı dosya → seçim geri, hesap kenardan', async ({ page, context }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await page.click('#ve-mnt-baslangic .ve-bas-karo[data-ey="ornek"]');
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-viewer'));
  await pencereAc(page);
  await dosyaAc(page);
  await rolVer(page);
  const sec = await page.evaluate(() => {
    const s = veMntWizStp(), pi = s.sonuc.parcalar.findIndex((p) => p.ad === 'Sağ arka takoz kauçuk');
    const d = veMntStpKenarDaire(s.sonuc, pi, s.ag[pi].daire[0]);
    veMntWizStpNokta(s.sonuc.agac.findIndex((x) => x.ad === 'Sağ arka takoz'), d);
    return { c: d.c, r: d.r };
  });
  expect(sec.r).toBe(45);
  const json = await page.evaluate(async () => {
    let blob = null;
    const asil = window.veShowSaveDialog;
    window.veShowSaveDialog = (ad, b) => { blob = b; };
    try { veSaveTopology(); } finally { window.veShowSaveDialog = asil; }
    return blob.text();
  });
  expect(json.indexOf('ISO-10303-21')).toBe(-1);
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
  // Dosya açık değil: föyde takozun seçilen dairesi
  const foy = await yeni.evaluate(() => [...document.querySelectorAll('#ve-properties .ve-fp-kat[data-k="kayit"] tbody tr')]
    .map((tr) => [...tr.cells].map((c) => c.textContent.trim())).find((r) => r[0] === 'Sağ arka takoz'));
  expect(foy).toEqual(['Sağ arka takoz', 'Takoz', '—', 'Ø 90,0']);
  await dosyaAc(yeni);
  await yeni.keyboard.press('Escape');
  await yeni.click('#ve-properties #ve-mnt-cad-hesapla');
  await yeni.waitForFunction(() => { const s = veMntWizStp(); return s.coz && s.coz.ok; });
  const geri = await yeni.evaluate(() => {
    const s = veMntWizStp(), b = s.coz.birimler.find((x) => x.ad === 'Sağ arka takoz');
    return { kaynak: b.kaynak, konum: b.konum };
  });
  expect(geri).toEqual({ kaynak: 'kenar', konum: sec.c });
  expect(hatalar).toEqual([]);
});
