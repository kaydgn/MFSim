/**
 * mount-3b.spec.js — TAKOZ 3B GÖRÜNTÜLEYİCİSİ: BÜYÜK MONTAJ (gerçek tarayıcı)
 *
 * 2026-10-20, Takoz adım 3. Ölçüldü (420 MB'lık deneme montajı, Chromium):
 * eski görüntüleyici bütün montajı tek bağlamla üçgenliyordu (yığın tepesi
 * 3,2 GB), kurulum bitene dek montajı gizliyordu ve parça başına iki nesneyle
 * (23.388 çizim çağrısı) bir döndürme karesini 190 ms'de kuruyordu.
 *
 * Node'da HİÇ koşmayan halkalar: WebGL kümeleri ve gölgelendirici eki,
 * kurulum sürerken çizim, Durdur · Devam düğmeleri, fareyle tıklayıp seçme,
 * 3B'den rol ve hesap. Birim tarafı: mount-step.test.js → *AĞ İŞİ* ·
 * mount-wizard.test.js → *HESAP BEKLER* · mount-3b.test.js.
 * Deneme montajı programın üreteciyle (tools/step-deneme.js, 5 MB, 151 parça).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const STEP = require('../helpers/step-takoz.js');
test.setTimeout(180000);

const DIZIN = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-3b-'));
const DENEME = path.join(DIZIN, 'deneme-5.stp');
const GUC = path.join(DIZIN, 'guc.stp');
test.beforeAll(() => {
  execFileSync(process.execPath, [path.join(__dirname, '../../tools/step-deneme.js'), '--mb', '5', '--cikti', DENEME]);
  fs.writeFileSync(GUC, STEP.gucGrubu());
});
test.afterAll(() => { fs.rmSync(DIZIN, { recursive: true, force: true }); });

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntOpenEditor === 'function' &&
    typeof window.veMntWiz3bAc === 'function' && typeof window.THREE !== 'undefined' && Array.isArray(window.nodes),
    null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await expect(page.locator('#ve-mnt-baslangic')).toBeVisible();
}
async function dosyaSec(page, dosya) {
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="step"]'),
  ]);
  await fc.setFiles(dosya);
}
const durum = (page) => page.evaluate(() => veMntWiz3bDurum());
const hazir = (page) => page.waitForFunction(() => {
  const k = document.getElementById('ve-mw-3b-tuval');
  return k && k.getAttribute('data-durum') === 'hazir';
}, null, { timeout: 120000 });

test('PARÇA PARÇA: kurulurken montaj görünür, çizim kümelerde, ortak işin dilimi kısa', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  // Ortak işin dilimleri ve kurulum sürerken çizilen kareler sayfanın içinde ölçülür
  await page.evaluate(() => {
    const o = window.__olc = { adim: [], araKare: 0 };
    const J0 = window.veMntStpAgIs;
    window.veMntStpAgIs = function () {
      const J = J0.apply(this, arguments), ad = J.adim;
      J.adim = function (b) { const t = performance.now(); const r = ad(b); o.adim.push(performance.now() - t); return r; };
      return J;
    };
    const ac = window.veMntWiz3bAc;
    window.veMntWiz3bAc = function () {
      const r = ac.apply(this, arguments), V = window._mw3b;
      if (!V || !V.renderer) return r;      // okuma kartı (STEP'ten başla): çizici okuma bitince kurulur
      const ro = V.renderer.render.bind(V.renderer);
      V.renderer.render = function (s, c) {
        ro(s, c);
        if (V.kap.getAttribute('data-durum') === 'kuruluyor' && V.renderer.info.render.triangles > 0) o.araKare++;
      };
      return r;
    };
  });
  await dosyaSec(page, DENEME);
  await hazir(page);
  const d = await durum(page);
  const o = await page.evaluate(() => window.__olc);
  const parca = await page.evaluate(() => veMntWizStp().sonuc._geo.filter((g) => g.yuzler.length).length);
  expect(d.islenen).toBe(parca);
  expect(d.toplam).toBe(parca);
  // Kurulum bitmeden montaj çizildi (eski görüntüleyici sonuna dek gizliydi)
  expect(o.araKare).toBeGreaterThan(0);
  // Çizim çağrısı parça sayısından bağımsız: kümeler (eskiden parça başına iki)
  expect(d.cagri).toBe(d.kume + d.cizgiKume);
  expect(d.cagri).toBeLessThanOrEqual(8);
  expect(d.cagri * 20).toBeLessThan(2 * parca);
  // Ortak işin dilimi bütçesini (10 ms) en çok bir yüz aşar
  expect(Math.max(...o.adim)).toBeLessThan(60);
  // Kurulumun kutusu kalktı; ağlar kümeye bakan görünüm (veri iki kez tutulmuyor)
  await expect(page.locator('#ve-mw-3b-kur')).toBeHidden();
  const gorunum = await page.evaluate(() => {
    const V = window._mw3b, s = veMntWizStp();
    return V.ekli.every((i) => s.ag[i].uc.buffer === V.kume[V.parca[i].b].poz.buffer);
  });
  expect(gorunum).toBe(true);
  expect(hatalar).toEqual([]);
});

test('DURDUR · DEVAM: durunca üretim durur ve çizilen kalır; Devam bitirir', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, DENEME);
  await page.waitForFunction(() => { const d = veMntWiz3bDurum(); return d && d.islenen >= 10; }, null, { timeout: 60000 });
  await page.click('#ve-mw-3b-durdur');
  const d1 = await durum(page);
  expect(d1.durum).toBe('durdu');
  await expect(page.locator('#ve-mw-3b-kur')).toContainText('Durduruldu');
  await page.waitForTimeout(800);
  const d2 = await durum(page);
  expect(d2.islenen).toBeLessThanOrEqual(d1.islenen + 1);   // yarım kalan parça biter, yenisine başlanmaz
  expect(d2.islenen).toBeLessThan(d2.toplam);
  expect(d2.parca).toBeGreaterThan(0);
  await page.click('#ve-mw-3b-devam');
  await hazir(page);
  const d3 = await durum(page);
  expect(d3.islenen).toBe(d3.toplam);
  await expect(page.locator('#ve-mw-3b-kur')).toBeHidden();
});

test('SEÇ · ROL · HESAP: tıklanan parça seçilir ve öteki parçalar solar; rol 3B\'den, hesap noktayı çizer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, GUC);
  await hazir(page);
  const motor = await page.evaluate(() => veMntWizStp().sonuc.parcalar.filter((p) => p.ad === 'Motor bloğu')[0]);
  const q = await page.evaluate((i) => veMntWiz3bIsabetNoktasi(i), motor.i);
  expect(q).not.toBeNull();
  await page.mouse.click(q.x, q.y);
  await expect.poll(async () => (await durum(page)).secili).toBe(motor.dugum);
  // Seçim dışı TEK KAT tül: ön geçiş (derinlik) ve tül birlikte açık
  const soluk = await page.evaluate(() => { const V = window._mw3b; return V.kume.every((K) => K.soluk.visible && K.derin.visible); });
  expect(soluk).toBe(true);
  await page.click('#ve-mw-3b-alt [data-ve-3b-rol="mnt-motor"]');
  await expect.poll(() => page.evaluate((d) => veMntWizStp().roller[d], motor.dugum)).toBe('mnt-motor');
  await page.click('#ve-mw-3b-hesapla');
  await expect.poll(async () => (await durum(page)).nokta).toBe(1);
  const coz = await page.evaluate(() => { const c = veMntWizStp().coz; return c && c.birimler.map((b) => [b.ad, b.kaynak]); });
  expect(coz).toEqual([['Motor bloğu', 'hacim']]);
});

// GÖRÜNÜM (2026-11-02, kullanıcı: "Ağırlık merkezi ve orta nokta görselleştirmesi
// güzel değil" · "Takozların orta noktasını alıyoruz. Ağırlık merkezini değil").
// Ölçülen önce (main 7c94ad5, bu montaj ve bu roller): yedi etiketten iki çift üst
// üste; ağırlık merkezi ile takoz noktası aynı koyu nokta (3B ağında, yedi ayrı
// çizim çağrısı); ekseni bulunamayan takoz hacim merkezinde; koordinat ekseni yok.
test('İŞARET · ETİKET · EKSEN: etiketler üst üste binmez, takoz noktası ağırlık merkezi simgesi değil', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, DENEME);
  await hazir(page);
  // Kamerayla dönen koordinat ekseni: Koordinat Düzlemi'nin altı yazısı
  const eksen = await page.$$eval('#ve-mw-3b-eksen text', (t) => t.map((x) => x.textContent).sort());
  expect(eksen).toEqual(['+X · Arka', '+Y · Sağ', '+Z · Yukarı', 'Aşağı', 'Ön', 'Sol'].sort());
  await page.evaluate(() => {
    const s = veMntWizStp(), A = s.sonuc.agac, bul = (ad) => A.filter((d) => d.ad === ad)[0];
    const ata = { 'Motor': 'mnt-motor', 'Şanzıman': 'mnt-gearbox', 'Transfer kutusu': 'mnt-transfer', 'Braketler': 'mnt-bracket' };
    Object.keys(ata).forEach((ad) => veMntWizStpRol(bul(ad).i, ata[ad]));
    bul('Takozlar').cocuklar.forEach((c) => veMntWizStpRol(c, 'mnt-mount'));
  });
  await page.click('#ve-mw-3b-hesapla');
  await expect.poll(async () => (await durum(page)).nokta).toBe(7);
  await page.evaluate(() => veMntWiz3bSigdir());
  await expect.poll(async () => (await durum(page)).etiket).toBe(7);
  const o = await page.evaluate(() => {
    const R = [...document.querySelectorAll('#ve-mw-3b-etiket .ve-fw-3b-etk')].map((e) => e.getBoundingClientRect());
    let cakisan = 0;
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++)
      if (R[i].left < R[j].right && R[j].left < R[i].right && R[i].top < R[j].bottom && R[j].top < R[i].bottom) cakisan++;
    const yan = document.getElementById('ve-mw-3b-yan').getBoundingClientRect();
    const say = (t) => document.querySelectorAll('#ve-mw-3b-etiket-cizgi [data-ve-3b-isaret="' + t + '"]').length;
    const tk = veMntWizStp().coz.birimler.filter((b) => b.ad === 'Takozlar civata 22')[0];
    const satir = document.querySelector('[data-ve-3b-takozlar] tr[data-ve-3b-birim="' + tk.dugum + '"]');
    const ad = satir.querySelector('td:first-child button');
    return { cakisan, kartAltinda: R.filter((r) => r.right > yan.left && r.top < yan.bottom).length,
             govde: say('govde'), takoz: say('takoz'), kaynak: tk.kaynak, nokta: satir.cells[2].textContent,
             adTitle: ad.getAttribute('title'), adSigar: ad.getBoundingClientRect().right <= satir.cells[0].getBoundingClientRect().right + 0.5,
             cagri: window._mw3b.renderer.info.render.calls, kume: window._mw3b.kume.length + window._mw3b.ckume.length };
  });
  expect(o.cakisan).toBe(0);
  expect(o.kartAltinda).toBe(0);
  expect([o.govde, o.takoz]).toEqual([4, 3]);
  // Ekseni bulunamayan takoz (dairesel kenarı yok): dış ölçülerin merkezi
  expect(o.kaynak).toBe('kutu');
  expect(o.nokta).toBe('Dış ölçü merkezi');
  // Ad hücrede kısalır, tam adı ipucunda (eskiden düğme bütün olarak "…" oluyordu)
  expect(o.adTitle).toBe('Takozlar civata 22 · Takoz');
  expect(o.adSigar).toBe(true);
  // İşaretler SVG'de: çizim çağrısı yalnız kümeler ve iki halka
  expect(o.cagri).toBe(o.kume + 2);
});

// ÜRÜN AĞACI VE Ctrl (2026-11-02, kullanıcı: "Ürün ağacının tıpkı 3D Experience
// programı gibi sol tarafta gösterilmesini istiyorum." · "tek tek seçmek yerine
// CTRL tuşunu aktif edelim"). Önce (main a8dd3a4): 3B'de ağaç yok, seçim tek düğüm.
test('AĞAÇ · CTRL: Ctrl+tık seçime ekler, rol hepsine; 3B\'de seçilen satır ağaçta görünür, satırın üstü 3B\'de vurgulanır', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, DENEME);
  await hazir(page);
  const ilk = await page.evaluate(() => {
    const s = veMntWizStp(), A = s.sonuc.agac, kok = A.filter((d) => d.ebeveyn < 0)[0];
    const satir = [...document.querySelectorAll('#ve-mw-3b-agac-l [data-ve-3b-agac]')].map((r) => +r.getAttribute('data-ve-3b-agac'));
    const tk = A.filter((d) => d.ad === 'Takozlar')[0];
    // Ekranda tıklanabilen üç braket ya da takoz parçası (küçük cıvatalar bu bakışta başka parçanın arkasında)
    const aday = A.filter((d) => d.ad === 'Braketler' || d.ad === 'Takozlar').reduce((L, d) => L.concat(d.cocuklar), [])
      .map((c) => ({ i: c, p: A[c].parcalar[0], q: veMntWiz3bIsabetNoktasi(A[c].parcalar[0]) })).filter((t) => t.q).slice(0, 3);
    return { satir, kokCocuk: kok.cocuklar, sec: aday, tkI: tk.i };
  });
  expect(ilk.kokCocuk.every((c) => ilk.satir.includes(c))).toBe(true);
  expect(ilk.sec.length).toBe(3);
  // Ctrl + gerçek fare, 3B'de üç parça
  await page.keyboard.down('Control');
  for (const t of ilk.sec) await page.mouse.click(t.q.x, t.q.y);
  await page.keyboard.up('Control');
  await expect.poll(async () => (await durum(page)).secim).toEqual(ilk.sec.map((t) => t.i));
  expect(await page.$$eval('#ve-mw-3b-agac-l .ve-mw-3b-agac-r.on', (r) => r.length)).toBe(3);
  await expect(page.locator('#ve-mw-3b-yan [data-ve-3b-secili="3"]')).toBeVisible();
  // Ctrl ile boşluğa tık seçimi bozmaz
  await page.keyboard.down('Control');
  await page.mouse.click(700, 120);
  await page.keyboard.up('Control');
  expect((await durum(page)).secim.length).toBe(3);
  await page.click('#ve-mw-3b-alt [data-ve-3b-rol="mnt-bracket"]');
  await expect.poll(() => page.evaluate((L) => L.map((i) => veMntWizStp().roller[i]), ilk.sec.map((t) => t.i)))
    .toEqual(['mnt-bracket', 'mnt-bracket', 'mnt-bracket']);
  // Ctrl'süz tık seçimi o parçaya indirir; derindeki satır ağaçta görünür olur
  const m = await page.evaluate(() => {
    const s = veMntWizStp(), A = s.sonuc.agac, d = A.filter((x) => x.ad === 'Motor')[0], c = A[d.cocuklar[d.cocuklar.length - 3]];
    return { i: c.i, p: c.parcalar[0] };
  });
  const q = await page.evaluate((p) => veMntWiz3bIsabetNoktasi(p), m.p);
  expect(q).not.toBeNull();
  await page.mouse.click(q.x, q.y);
  await expect.poll(async () => (await durum(page)).secim).toEqual([m.i]);
  const gor = await page.evaluate((i) => {
    const r = document.querySelector('#ve-mw-3b-agac-l [data-ve-3b-agac="' + i + '"]'), l = document.getElementById('ve-mw-3b-agac-l').getBoundingClientRect();
    if (!r) return null;
    const b = r.getBoundingClientRect();
    return { on: r.classList.contains('on'), icinde: b.top >= l.top - 1 && b.bottom <= l.bottom + 1 };
  }, m.i);
  expect(gor).toEqual({ on: true, icinde: true });
  // Ağaçta satır: tık seçer, Ctrl+tık ekler; üstüne gelmek 3B'de düğümün parçalarını vurgular
  const tkSatir = page.locator('#ve-mw-3b-agac-l [data-ve-3b-agac="' + ilk.tkI + '"] .ve-mw-3b-agac-ad');
  await tkSatir.click();
  await expect.poll(async () => (await durum(page)).secim).toEqual([ilk.tkI]);
  await page.locator('#ve-mw-3b-agac-l [data-ve-3b-agac="' + m.i + '"] .ve-mw-3b-agac-ad').click({ modifiers: ['Control'] });
  await expect.poll(async () => (await durum(page)).secim).toEqual([ilk.tkI, m.i]);
  await tkSatir.hover();
  await expect.poll(async () => (await durum(page)).fareDugum).toBe(ilk.tkI);
  const fare = await page.evaluate((i) => {
    const V = window._mw3b, P = V.parca[veMntWizStp().sonuc.agac[i].parcalar[0]];
    return (V.kume[P.b].durum[P.o] & 4) !== 0;
  }, ilk.tkI);
  expect(fare).toBe(true);
  await page.mouse.move(700, 450);
  await expect.poll(async () => (await durum(page)).fareDugum).toBe(-1);
  // Çift tık: kamera düğümün parçalarına sığar (hedef düğümün kutusunun ortası)
  const once = await page.evaluate(() => window._mw3b.ctrl.r);
  await tkSatir.dblclick();
  const odak = await page.evaluate((i) => {
    const V = window._mw3b, s = veMntWizStp(), kutu = new THREE.Box3();
    veMntWiz3bParcalar(s, i).forEach((p) => { const k = s.ag[p] && s.ag[p].kutu; if (k) kutu.union(new THREE.Box3(new THREE.Vector3(k[0], k[1], k[2]), new THREE.Vector3(k[3], k[4], k[5]))); });
    return { r: V.ctrl.r, ic: kutu.expandByScalar(1).containsPoint(V.ctrl.hedef) };
  }, ilk.tkI);
  expect(odak.ic).toBe(true);
  expect(odak.r).toBeLessThan(once);
});

