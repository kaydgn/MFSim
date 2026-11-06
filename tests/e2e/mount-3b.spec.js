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
const Y = require('../helpers/yerlesim-olcu.js');
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
  // Özellikler paneli KAPALI başlar (Canlı Not 26); içeriğini okuyan testler tercihi açık yazar
  await page.evaluate(() => { try { localStorage.setItem(VE_MW_3B_YAN_ANAHTAR, 'acik'); } catch (e) {} });
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
// ROL ALANI (Canlı Not 49): alan menünün dilinde listeyi açar, satır rolü verir
async function rolVer(page, kap, tip) {
  await page.click(kap + ' #ve-mw-3b-rol');
  await page.click('#ve-mw-3b-menu [data-k="rol:' + tip + '"]');
  await expect(page.locator('#ve-mw-3b-menu')).toHaveCount(0);
}
const hazir = (page) => page.waitForFunction(() => {
  const k = document.getElementById('ve-mw-3b-tuval');
  return k && k.getAttribute('data-durum') === 'hazir';
}, null, { timeout: 120000 });
// BOŞLUĞA SAĞ TIK (Canlı Not 25: Bakış · Görünüş · Seçim · Ölçü · Kesit komut
// çubuğunda değil): tuvalin boş bir noktası → menü → (alt menü) → satır.
async function bosMenu(page, k, alt) {
  const bos = await page.evaluate(() => {
    const V = window._mw3b, cv = V.renderer.domElement, r = cv.getBoundingClientRect();
    for (let y = r.top + 40; y < r.bottom - 40; y += 23)
      for (let x = r.left + 40; x < r.right - 40; x += 29)
        if (document.elementFromPoint(x, y) === cv && _mw3bIsabet(x, y) < 0) return { x, y };
    return null;
  });
  if (!bos) throw new Error('tuvalde boş nokta yok');
  await page.mouse.click(bos.x, bos.y, { button: 'right' });
  await expect(page.locator('#ve-mw-3b-menu')).toBeVisible();
  if (alt) await page.hover('#ve-mw-3b-menu [data-k="' + k + '"]');
  await page.click('#ve-mw-3b-menu [data-k="' + (alt || k) + '"]');
  await expect(page.locator('#ve-mw-3b-menu')).toHaveCount(0);
}

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
  // Çizim çağrısı parça sayısından bağımsız: kümeler (eskiden parça başına iki) ve
  // zeminin geçişi (çalışma masası: tek tam ekran dörtgen)
  expect(d.cagri).toBe(d.kume + d.cizgiKume + d.zemin);
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
  // TAM EKRAN ve İŞ KARTI (2026-11-04): kart tuvalin sağ altında, adı işin adı;
  // görüntüleyici ekranın tamamı, başlık bandı yok
  const yer = await page.evaluate(() => {
    const k = document.getElementById('ve-mw-3b-kur').getBoundingClientRect();
    const t = document.getElementById('ve-mw-3b-tuval').getBoundingClientRect();
    const m = document.querySelector('#ve-mnt-3b-overlay .ve-fw-modal').getBoundingClientRect();
    return { sag: Math.round(t.right - k.right), alt: Math.round(t.bottom - k.bottom),
      ad: document.querySelector('#ve-mw-3b-kur .ve-mw-3b-is-bas').textContent.trim(),
      tam: [m.left, m.top, m.width, m.height].map(Math.round).join(' '), ekran: '0 0 ' + innerWidth + ' ' + innerHeight,
      baslik: !!document.querySelector('#ve-mnt-3b .ve-settings-header'), kapat: !!document.querySelector('#ve-mnt-3b #ve-mw-3b-tuval > #ve-mw-3b-kapat') };
  });
  expect(yer).toEqual({ sag: 16, alt: 16, ad: '3B kurulumu', tam: yer.ekran, ekran: '0 0 1440 900', baslik: false, kapat: true });
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
  await rolVer(page, '#ve-mw-3b-alt', 'mnt-motor');
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
  // ETİKET YALNIZ FARE ÜSTÜNDE (Canlı Not 12): hesaptan sonra işaret var, etiket yok;
  // fare bir işaretin üstüne gelince yalnız onun etiketi, uzaklaşınca hiçbiri
  await expect.poll(async () => (await durum(page)).nokta).toBe(7);
  expect((await durum(page)).etiket).toBe(0);
  const is = await page.evaluate(() => {
    const r = document.getElementById('ve-mw-3b-tuval').getBoundingClientRect(), q = _mw3b.isaretEkran[0];
    return { x: r.left + q.x, y: r.top + q.y, u: q.u, ad: veMntWizStp().sonuc.agac[q.u].ad };
  });
  await page.mouse.move(is.x, is.y);
  await expect.poll(async () => (await durum(page)).etiket).toBe(1);
  expect(await page.locator('#ve-mw-3b-etiket .ve-fw-3b-etk b').innerText()).toBe(is.ad);
  expect(await page.locator('#ve-mw-3b-etiket .ve-fw-3b-etk').evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe('none');
  await page.mouse.move(is.x + 400, is.y + 300);
  await page.mouse.move(5, 5);
  await expect.poll(async () => (await durum(page)).etiket).toBe(0);
  // Bütün birimler seçiliyken bütün etiketler — üst üste binmez, kartın altına girmez
  await page.evaluate(() => { _mw3b.secim = veMntWizStp().coz.birimler.map((b) => b.dugum); _mw3bEtiketle(); });
  await expect.poll(async () => (await durum(page)).etiket).toBe(7);
  const o = await page.evaluate(() => {
    const R = [...document.querySelectorAll('#ve-mw-3b-etiket .ve-fw-3b-etk')].map((e) => e.getBoundingClientRect());
    let cakisan = 0;
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++)
      if (R[i].left < R[j].right && R[j].left < R[i].right && R[i].top < R[j].bottom && R[j].top < R[i].bottom) cakisan++;
    const yan = document.getElementById('ve-mw-3b-yan').getBoundingClientRect();
    const say = (t) => document.querySelectorAll('#ve-mw-3b-etiket-cizgi [data-ve-3b-isaret="' + t + '"]').length;
    const tk = veMntWizStp().coz.birimler.filter((b) => b.ad === 'Takozlar civata 22')[0];
    veMntWiz3bGrupAc('takoz');                                              // Birimler grubu kapalı açılır (Canlı Not 18)
    const satir = document.querySelector('[data-ve-3b-grup="takoz"] [data-ve-3b-birim="' + tk.dugum + '"]');
    const ad = satir.querySelector('.ve-mw-3b-birim-ad');
    return { cakisan, kartAltinda: R.filter((r) => r.right > yan.left && r.top < yan.bottom).length,
             govde: say('govde'), takoz: say('takoz'), kaynak: tk.kaynak, nokta: satir.getAttribute('title'),
             adTitle: ad.getAttribute('title'), adSigar: ad.getBoundingClientRect().width > 0 && ad.getBoundingClientRect().right <= satir.getBoundingClientRect().right + 0.5,
             cagri: window._mw3b.renderer.info.render.calls, kume: window._mw3b.kume.length + window._mw3b.ckume.length,
             zemin: veMntWiz3bDurum().zemin };
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
  // İşaretler SVG'de: çizim çağrısı yalnız kümeler, iki halka ve zeminin geçişi
  expect(o.cagri).toBe(o.kume + 2 + o.zemin);
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
  await rolVer(page, '#ve-mw-3b-alt', 'mnt-bracket');
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

// CAD ARAÇLARI (2026-11-02, kullanıcı: "3D görüntüleyici tıpkı bir CAD programı gibi
// olmalı. Ölçümler, kesit alma vb."). Önce (main 6d04652): hazır bakış ve kesit yoktu.
test('BAKIŞ · KESİT: hazır bakışlar kamerayı çevirir; kesit dört malzemeyi kırpar, kesilen yan seçilmez', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, GUC);
  await hazir(page);
  const yon = () => page.evaluate(() => { const d = new THREE.Vector3(); window._mw3b.camera.getWorldDirection(d); return [d.x, d.y, d.z]; });
  await bosMenu(page, 'bakis', 'bakis:ust');
  expect((await yon())[2]).toBeLessThan(-0.999);
  await bosMenu(page, 'bakis', 'bakis:on');
  expect((await yon())[0]).toBeGreaterThan(0.999);
  await bosMenu(page, 'bakis', 'bakis:izo');
  const motor = await page.evaluate(() => veMntWizStp().sonuc.parcalar.filter((p) => p.ad === 'Motor bloğu')[0]);
  const q = await page.evaluate((i) => veMntWiz3bIsabetNoktasi(i), motor.i);
  expect(q).not.toBeNull();
  await bosMenu(page, 'kesit');
  const kesik = () => page.evaluate(() => {
    const V = window._mw3b, M = V.malzeme;
    return { lc: V.renderer.localClippingEnabled, n: [M.opak, M.soluk, M.derinlik, M.cizgi].map((x) => (x.clippingPlanes || []).length), gorsel: !!V.kesitG };
  });
  expect(await kesik()).toEqual({ lc: true, n: [1, 1, 1, 1], gorsel: true });
  await expect(page.locator('#ve-mw-3b-kesit-d')).toBeVisible();
  // Değer YAZILIR (kullanım notu T12): alan Türkçe, kaydırıcı izler
  const orta = await page.evaluate(() => { const r = document.getElementById('ve-mw-3b-kesit-d'); return Math.round((+r.min + +r.max) / 2 * 10 + 3) / 10; });
  await page.fill('#ve-mw-3b-kesit-gir', String(orta).replace('.', ','));
  await page.press('#ve-mw-3b-kesit-gir', 'Enter');
  const yaz = await page.evaluate(() => { const r = document.getElementById('ve-mw-3b-kesit-d'); return { d: window._mw3b.kesit.d, r: +r.value, adim: +r.step }; });
  expect(yaz.d).toBe(orta);
  expect(Math.abs(yaz.r - orta)).toBeLessThanOrEqual(yaz.adim);
  // Düzlem montajın en küçük x'ine: bütün montaj kesilen yanda — motora tık bir şey seçmez
  await page.evaluate(() => { const r = document.getElementById('ve-mw-3b-kesit-d'); r.value = r.min; r.dispatchEvent(new Event('input', { bubbles: true })); });
  // kaydırıcıyı alan izler
  expect(await page.evaluate(() => +document.getElementById('ve-mw-3b-kesit-gir').value))
    .toBeCloseTo(await page.evaluate(() => +document.getElementById('ve-mw-3b-kesit-d').min), 1);
  await page.mouse.click(q.x, q.y);
  expect((await durum(page)).secim).toEqual([]);
  // Ters: kalan yan değişir, motor yine seçilir
  await page.click('#ve-mw-3b-kesit-ters');
  await page.mouse.click(q.x, q.y);
  await expect.poll(async () => (await durum(page)).secim).toEqual([motor.dugum]);
  // Kesit kapanınca (çubuktaki kapat) kırpma ve düzlemin görseli kalkar
  await page.click('#ve-mw-3b-kesit-kapat');
  expect(await kesik()).toEqual({ lc: true, n: [0, 0, 0, 0], gorsel: false });
  await expect(page.locator('#ve-mw-3b-kesit-d')).toHaveCount(0);
});


// 4b (2026-11-02): "Modelde yüzey seçme özelliğini de getirelim." · "Ölçümler…"
test('YÜZEY · ÖLÇÜ: süzgeç yüzü seçer, parçanın seçimi değişmez; ölçü daireden merkeze, köşeden köşeye yapışır', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await dosyaSec(page, GUC);
  await hazir(page);
  const ekran = (p) => page.evaluate((p) => {
    const V = window._mw3b, r = V.renderer.domElement.getBoundingClientRect();
    V.camera.updateMatrixWorld();
    const q = new THREE.Vector3(p[0], p[1], p[2]).project(V.camera);
    return { x: r.left + (q.x + 1) / 2 * r.width, y: r.top + (1 - q.y) / 2 * r.height };
  }, p);
  await page.evaluate(() => veMntWiz3bBakis('ust'));
  const motor = await page.evaluate(() => veMntWizStp().sonuc.parcalar.filter((p) => p.ad === 'Motor bloğu')[0]);

  // — YÜZEY: fare altı önden seçilir, tık yüzü seçer (süzgeç boşluğun menüsünden) —
  await bosMenu(page, 'suzgec', 'suzgec:yuz');
  await expect.poll(async () => (await durum(page)).suzgec).toBe('yuz');
  await expect(page.locator('#ve-mw-3b-yan [data-ve-3b-yuz]')).toContainText('Modelde bir yüz seçin.');
  const m = await ekran([-300, 5, 1250]);                        // motorun üst yüzünün ortası
  // Boş nokta tuvalin kendisine sorulur: ışın hiçbir parçaya çarpmıyor, üstünde kart, ağaç, alt dizi yok
  const bos = await page.evaluate(() => {
    const V = window._mw3b, cv = V.renderer.domElement, r = cv.getBoundingClientRect();
    for (let y = r.top + r.height * 0.3; y < r.bottom - 20; y += 23)
      for (let x = r.left + 20; x < r.right - 20; x += 29)
        if (document.elementFromPoint(x, y) === cv && !_mw3bIsinK(x, y)) return { x, y };
    return null;
  });
  expect(bos).not.toBeNull();
  expect((await durum(page)).soluk).toBe(false);
  await page.mouse.move(m.x, m.y);
  await expect.poll(async () => ((await durum(page)).yuzOn || {}).parca).toBe(motor.i);
  await expect(page.locator('#ve-mw-3b-ipucu')).toHaveText('Düzlem · z = 1.250,0 mm');
  expect((await durum(page)).fare).toBe(-1);                      // parçanın fare vurgusu yok
  // Yüzey odağı (Canlı Not 21): fare altındaki yüzün parçası odakta, öteki parçalar tül;
  // yüzün vurgusu derinlik sınamasız — önündeki parçanın ardında kalmaz
  expect(await durum(page)).toMatchObject({ yuzOdak: motor.i, soluk: true });
  expect(await page.evaluate(() => _mw3b.yuzOnG.material.depthTest)).toBe(false);
  await page.mouse.click(m.x, m.y);
  await expect.poll(async () => (await durum(page)).yuz).toMatchObject({ parca: motor.i, tip: 'PLANE' });
  expect((await durum(page)).secim).toEqual([]);
  const yb = page.locator('#ve-mw-3b-yan [data-ve-3b-yuz]');
  await expect(yb).toContainText('Motor bloğu');
  await expect(yb).toContainText('z = 1.250,000 mm');
  await expect(yb).toContainText('≈ 630.000 mm²');
  // Seçili yüzün üstünde önden seçim yok (iki kat vurgu olmaz); yüzden çıkıp
  // dönünce gezinmek kare çizdirmez — yüz değişmedikçe tanım okunmaz
  const kare = () => page.evaluate(() => window._mw3b.renderer.info.render.frame);
  await page.mouse.move(m.x + 2, m.y + 1);
  await expect.poll(async () => ((await durum(page)).yuzOn)).toBe(null);
  await page.mouse.move(bos.x, bos.y);
  await page.mouse.move(m.x + 2, m.y + 1);
  await page.waitForTimeout(150);
  const k0 = await kare();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(m.x + 2 + i * 3, m.y + 1 + i * 2); await page.waitForTimeout(40); }
  expect(await kare() - k0).toBeLessThanOrEqual(1);
  expect((await durum(page)).yuzOn).toBe(null);
  // Vurgu sahnede ve kesitle kırpılır
  const vurgu = () => page.evaluate(() => { const V = window._mw3b; return V.yuzG ? (V.yuzG.material.clippingPlanes || []).length : -1; });
  expect(await vurgu()).toBe(0);
  await page.evaluate(() => veMntWiz3bKesit());
  expect(await vurgu()).toBe(1);
  await page.click('#ve-mw-3b-kesit-kapat');
  // Boşluğa tık yüzü bırakır
  await page.mouse.click(bos.x, bos.y);
  await expect.poll(async () => (await durum(page)).yuz).toBe(null);
  // Esc: süzgeç Parça'ya döner, görüntüleyici açık kalır
  await page.mouse.click(m.x, m.y);
  await expect.poll(async () => (await durum(page)).yuz).not.toBe(null);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await durum(page)).suzgec).toBe('parca');
  expect((await durum(page)).yuz).toBe(null);
  expect(await page.evaluate(() => !!window._mw3b.yuzG)).toBe(false);
  await expect(yb).toHaveCount(0);
  expect(await page.evaluate(() => veMntWiz3bAcik())).toBe(true);

  // — ÖLÇÜ (alttan: takozların alt kapağı ve motorun alt yüzü en yakında) —
  // dairesel kenar → merkez; iki takozun alt merkezi 760 mm
  await page.evaluate(() => veMntWiz3bBakis('alt'));
  await bosMenu(page, 'olcu');
  await expect.poll(() => page.evaluate(() => !!window._mw3b.olcu)).toBe(true);
  await expect(page.locator('#ve-mw-3b-yan [data-ve-3b-olcu]')).toContainText('Modelde iki nokta seçin.');
  const a = await ekran([-650, 425, 390]);                        // sağ ön takozun alt çemberi
  await page.mouse.move(a.x, a.y);
  await expect.poll(async () => ((await durum(page)).olcu || {}).aday).toBe('daire');
  await expect(page.locator('#ve-mw-3b-ipucu')).toHaveText('Daire merkezi · Ø 90,0 mm');
  await expect(page.locator('#ve-mw-3b-etiket-cizgi polyline.ve-mw-3b-olcu-a')).toHaveCount(1);
  await page.mouse.click(a.x, a.y);
  const b = await ekran([-650, -425, 390]);                       // sol ön takozun alt çemberi
  await page.mouse.click(b.x, b.y);
  await expect.poll(async () => (await durum(page)).olcu).toMatchObject({ a: 'daire', b: 'daire' });
  const dd = page.locator('#ve-mw-3b-yan [data-ve-3b-olcu-d]');
  await expect(dd).toHaveAttribute('data-ve-3b-olcu-d', '760');
  await expect(dd).toContainText('760,000 mm');
  await expect(page.locator('#ve-mw-3b-etiket-cizgi [data-ve-3b-olcu-yazi] text')).toHaveText('760,0 mm');
  await expect(page.locator('#ve-mw-3b-etiket-cizgi [data-ve-3b-olcu-n]')).toHaveCount(2);
  // Üçüncü tık yeni ölçü; motorun alt yüzünün iki köşesi 700 mm (Δy)
  // köşenin 4 px içi (yüzün merkezine doğru): ışın yüze çarpar, köşeye yapışır
  const mz = await ekran([-300, 5, 450]);
  const ic = async (p) => { const k = await ekran(p), l = Math.hypot(mz.x - k.x, mz.y - k.y); return { x: k.x + (mz.x - k.x) / l * 4, y: k.y + (mz.y - k.y) / l * 4 }; };
  const k1 = await ic([150, -345, 450]), k2 = await ic([150, 355, 450]);
  await page.mouse.move(k1.x, k1.y);
  await expect.poll(async () => ((await durum(page)).olcu || {}).aday).toBe('kose');
  await expect(page.locator('#ve-mw-3b-ipucu')).toHaveText('Köşe');
  await page.mouse.click(k1.x, k1.y);
  await expect.poll(async () => (await durum(page)).olcu).toMatchObject({ a: 'kose', b: '' });
  await expect(dd).toHaveCount(0);
  await page.mouse.click(k2.x, k2.y);
  await expect(dd).toHaveAttribute('data-ve-3b-olcu-d', '700');
  await expect(page.locator('#ve-mw-3b-yan [data-ve-3b-olcu]')).toContainText('Δy700,000 mm');
  // Kamera dönünce çizim izdüşümden yeniden kurulur
  const x1 = await page.locator('#ve-mw-3b-etiket-cizgi line.ve-mw-3b-olcu-c').getAttribute('x1');
  await page.evaluate(() => veMntWiz3bBakis('izo'));
  await expect.poll(() => page.locator('#ve-mw-3b-etiket-cizgi line.ve-mw-3b-olcu-c').getAttribute('x1')).not.toBe(x1);
  // Esc ölçüyü kapatır, görüntüleyici açık kalır
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => !!window._mw3b.olcu)).toBe(false);
  await expect(page.locator('#ve-mw-3b-yan [data-ve-3b-olcu]')).toHaveCount(0);
  await expect(page.locator('#ve-mw-3b-etiket-cizgi [data-ve-3b-olcu-n]')).toHaveCount(0);
  expect(await page.evaluate(() => veMntWiz3bAcik())).toBe(true);
  expect(hatalar).toEqual([]);
});

// ÇALIŞMA MASASI (2026-11-03, kullanıcı tasarım tuvalinden seçti). Node'da koşmayan
// halkalar: panellerin tuvalin YANINDA durması (gerçek yerleşim), bakış listesinin
// kamerayı çevirmesi (küp yok — Canlı Not 15), görünüş kiplerinin çizim nesnelerine geçmesi,
// aramanın bütün ağaçta süzmesi ve Esc'in aramayı temizleyip 3B'yi kapatmaması,
// imlecin koordinatı, dar pencerede panellerin daralması.
test('ÇALIŞMA MASASI: paneller tuvalin yanında; küp yok, bakış listeden; görünüş; arama; imleç', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, DENEME);
  await hazir(page);
  const yer = await page.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const t = r('ve-mw-3b-tuval'), a = r('ve-mw-3b-agac'), y = r('ve-mw-3b-yan'), d = r('ve-mw-3b-durum'), c = r('ve-mw-3b-kapat');
    const ad = document.querySelector('#ve-mw-3b-agac .ve-mw-3b-dock-bas #ve-mw-3b-dosya'), say = document.getElementById('ve-mw-3b-agac-say');
    return { agacSag: a.right, tuvalSol: t.left, tuvalSag: t.right, yanSol: y.left, tuvalUst: t.top, agacUst: a.top, yanUst: y.top,
      kapatSag: Math.round(t.right - c.right), kapatUst: Math.round(c.top - t.top), komut: !!document.querySelector('.ve-mw-3b-komut'),
      ad: ad && ad.textContent, sayH: say.getBoundingClientRect().height, sayYazi: say.textContent,
      tuvalAlt: t.bottom, durumUst: d.top, durumH: d.height, bant: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bant-h')) };
  });
  expect(yer.agacSag).toBeLessThanOrEqual(yer.tuvalSol + 0.5);
  expect(yer.tuvalSag).toBeLessThanOrEqual(yer.yanSol + 0.5);
  expect(yer.tuvalAlt).toBeLessThanOrEqual(yer.durumUst + 0.5);
  expect(Math.abs(yer.durumH - yer.bant)).toBeLessThan(1);
  // Komut çubuğu YOK (Canlı Not 44): paneller ve tuval çalışma alanının tepesinden başlar;
  // dosyanın adı Ürün ağacının başlığında, parça sayısı tek satırda; Kapat tuvalin sağ üstünde
  expect(yer.komut).toBe(false);
  expect([yer.tuvalUst, yer.agacUst, yer.yanUst]).toEqual([0, 0, 0]);
  expect(yer.ad).toBe(path.basename(DENEME));
  expect(yer.sayYazi).toMatch(/^[\d.]+ parça$/);
  expect(yer.sayH).toBeLessThan(18);
  expect([yer.kapatSag, yer.kapatUst]).toEqual([12, 12]);
  // Görünüm küpü ve yakınlık düğmeleri YOK (Canlı Not 15)
  expect(await page.locator('#ve-mw-3b-kup, .ve-mw-3b-yakin, .ve-mw-3b-gez').count()).toBe(0);
  // Araçlar komut çubuğunda YOK (Canlı Not 25): Bakış · Görünüş · Seçim · Ölçü · Kesit boşluğun menüsünde
  expect(await page.locator('#ve-mw-3b-bakis, #ve-mw-3b-gorunus, [data-ve-3b-suzgec], #ve-mw-3b-olcu, #ve-mw-3b-kesit').count()).toBe(0);
  // Bakış: seçilen bakış uygulanır (Üst → tam tepeden)
  await bosMenu(page, 'bakis', 'bakis:ust');
  await expect.poll(async () => (await durum(page)).phi).toBeGreaterThan(1.5);
  await bosMenu(page, 'bakis', 'bakis:izo');
  await expect.poll(async () => (await durum(page)).phi).toBeLessThan(1.5);
  // Görünüş: x-ışınında tül çok katlı (ön geçiş kapalı), gölgelide kenar yok
  await bosMenu(page, 'gorunus', 'gorunus:xray');
  expect(await page.evaluate(() => _mw3b.kume.every((K) => K.soluk.visible && !K.derin.visible))).toBe(true);
  await bosMenu(page, 'gorunus', 'gorunus:golge');
  expect(await page.evaluate(() => _mw3b.ckume.every((C) => !C.cizgi.visible) && _mw3b.kume.every((K) => !K.soluk.visible))).toBe(true);
  await bosMenu(page, 'gorunus', 'gorunus:kenar');
  expect(await page.evaluate(() => _mw3b.ckume.every((C) => C.cizgi.visible))).toBe(true);
  // Arama: bütün ağaçta, büyük-küçük harf ayırmadan; satırın tıkı seçer; Esc aramayı temizler, 3B açık kalır
  await page.fill('#ve-mw-3b-ara', 'KASNAK');
  const ara = await page.evaluate(() => ({ say: document.getElementById('ve-mw-3b-agac-say').textContent,
    ad: [...document.querySelectorAll('#ve-mw-3b-agac-l [data-ve-3b-agac] .ve-mw-3b-agac-ad > span:first-child')].map((x) => x.textContent) }));
  expect(ara.ad.length).toBeGreaterThan(0);
  expect(ara.ad.every((a) => /kasnak/i.test(a))).toBe(true);
  expect(ara.say).toBe(ara.ad.length + ' sonuç');
  await page.locator('#ve-mw-3b-agac-l [data-ve-3b-agac] .ve-mw-3b-agac-ad').first().click();
  await expect.poll(async () => (await durum(page)).secim.length).toBe(1);
  await page.focus('#ve-mw-3b-ara');
  await page.keyboard.press('Escape');
  await expect(page.locator('#ve-mw-3b-ara')).toHaveValue('');
  expect(await page.evaluate(() => veMntWiz3bAcik())).toBe(true);
  expect((await durum(page)).ara).toBe('');
  // İmleç: parçanın üstünde koordinat, tuvalden çıkınca boş
  await page.evaluate(() => veMntWiz3bSec(-1));
  const q = await page.evaluate(() => {
    for (const p of veMntWizStp().sonuc.parcalar) { const n = veMntWiz3bIsabetNoktasi(p.i); if (n) return n; }
    return null;
  });
  expect(q).not.toBeNull();
  await page.mouse.move(q.x, q.y);
  await expect(page.locator('#ve-mw-3b-imlec')).toHaveText(/^İmleç −?[\d.]+,\d; −?[\d.]+,\d; −?[\d.]+,\d mm$/);
  await page.mouse.move(5, 5);
  await expect(page.locator('#ve-mw-3b-imlec')).toHaveText('');
  // Dar pencere: paneller daralır, Özellikler yatayda kaymaz
  await page.setViewportSize({ width: 1024, height: 700 });
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('ve-mw-3b-agac').getBoundingClientRect().width))).toBe(232);
  expect(await page.evaluate(() => { const y = document.getElementById('ve-mw-3b-yan'); return y.scrollWidth <= y.clientWidth + 1; })).toBe(true);
  expect(hatalar).toEqual([]);
});

// ÖZELLİKLER AÇILIR KAPANIR (Canlı Not 26, 2026-11-05 — kullanıcı: "Şu kısımı açılır
// kapanır şeklinde yapalım. Kullanıcı istemediği zaman kapalı kalsın."). Önce: panel
// hep açıktı (352 px) ve kapatılamıyordu. Node'da koşmayan halkalar: ızgaranın şeride
// inmesi, tuvalin ve çizicinin genişlemesi, seçimin paneli açmaması, klavye odağı,
// tercihin yeniden açılan 3B'de korunması.
test('ÖZELLİKLER AÇILIR KAPANIR: kapalı başlar, seçim açmaz; şerit açar, düğme daraltır; tercih kalır', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await page.evaluate(() => { try { localStorage.removeItem(VE_MW_3B_YAN_ANAHTAR); } catch (e) {} });
  await dosyaSec(page, DENEME);
  await hazir(page);
  const olc = () => page.evaluate(() => {
    const yan = document.getElementById('ve-mw-3b-yan'), d = document.getElementById('ve-mw-3b-yan-dugme');
    const v = new THREE.Vector2();
    _mw3b.renderer.getSize(v);
    return { yan: Math.round(yan.getBoundingClientRect().width), tuval: document.getElementById('ve-mw-3b-tuval').clientWidth,
      cizici: v.x, ac: d.getAttribute('aria-expanded'), masa: document.querySelector('.ve-mw-3b-masa').getAttribute('data-yan'),
      gorunen: [...yan.children].filter((c) => c.offsetWidth > 0).map((c) => c.className),
      tercih: localStorage.getItem(VE_MW_3B_YAN_ANAHTAR), odak: document.activeElement && document.activeElement.id,
      r: veMntWiz3bDurum().r };
  });
  // Kapalı başlar: şerit, içinde yalnız düğme; adı dikey ve şeridin içinde
  const k0 = await olc();
  expect(k0).toMatchObject({ yan: 30, ac: 'false', masa: 'kapali', gorunen: ['ve-mw-3b-yan-serit'], tercih: null });
  await expect(page.locator('#ve-mw-3b-yan-dugme')).toHaveText('Özellikler');
  const ad = await page.evaluate(() => {
    const s = document.querySelector('.ve-mw-3b-yan-dikey').getBoundingClientRect(), y = document.getElementById('ve-mw-3b-yan').getBoundingClientRect();
    return { dikey: s.height > 2 * s.width, icinde: s.left >= y.left && s.right <= y.right && s.bottom <= y.bottom };
  });
  expect(ad).toEqual({ dikey: true, icinde: true });
  // Seçim paneli açmaz: içerik kurulur, gösterilmez
  await page.evaluate(() => veMntWiz3bSec(veMntWizStp().sonuc.agac.findIndex((d) => d.ebeveyn >= 0)));
  await expect.poll(async () => (await durum(page)).secim.length).toBe(1);
  expect((await olc()).masa).toBe('kapali');
  await expect(page.locator('#ve-mw-3b-yan [data-ve-3b-secili]')).toHaveCount(1);
  await expect(page.locator('#ve-mw-3b-yan [data-ve-3b-secili]')).toBeHidden();
  // Şeridin tıkı açar: panel 352 px, tuval o kadar daralır, çizici izler; odak daraltma düğmesinde;
  // kamerasına dokunulmamış görünüm dar tuvale yeniden sığar (uzaklık artar)
  await page.click('#ve-mw-3b-yan-dugme');
  const a = await olc();
  expect(a).toMatchObject({ yan: 352, ac: 'true', masa: 'acik', tercih: 'acik', odak: 've-mw-3b-yan-dugme' });
  expect(k0.tuval - a.tuval).toBe(322);
  expect(a.r).toBeGreaterThan(k0.r * 1.05);
  await expect.poll(async () => (await olc()).cizici).toBe(a.tuval);
  await expect(page.locator('#ve-mw-3b-yan-dugme')).toHaveAttribute('aria-label', 'Özellikler panelini daralt');
  await expect(page.locator('#ve-mw-3b-yan [data-ve-3b-secili]')).toBeVisible();
  // Tercih kalır: 3B kapanıp yeniden açılınca panel açık
  await page.click('#ve-mw-3b-kapat');
  expect(await page.evaluate(() => veMntWiz3bAc('pencere'))).toBe(true);
  await hazir(page);
  expect(await olc()).toMatchObject({ yan: 352, ac: 'true', masa: 'acik' });
  // Klavyeyle daraltılır: tuval geri genişler, tercih kapalı
  await page.focus('#ve-mw-3b-yan-dugme');
  await page.keyboard.press('Enter');
  const k1 = await olc();
  expect(k1).toMatchObject({ yan: 30, ac: 'false', masa: 'kapali', tercih: 'kapali', odak: 've-mw-3b-yan-dugme' });
  expect(k1.tuval).toBe(k0.tuval);
  expect(Math.abs(k1.r - k0.r) / k0.r).toBeLessThan(1e-6);          // açılıştaki sığdırmanın aynısı
  await expect.poll(async () => (await olc()).cizici).toBe(k0.tuval);
  // Kameraya dokunulmuşsa (tekerlek) bakış yerinde kalır
  const t = await page.locator('#ve-mw-3b-tuval').boundingBox();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await olc()).r).toBeLessThan(k1.r);
  const r0 = (await olc()).r;
  await page.click('#ve-mw-3b-yan-dugme');
  expect(await olc()).toMatchObject({ yan: 352, masa: 'acik', r: r0 });
  expect(hatalar).toEqual([]);
});

// EYLEM ŞERİDİ (kullanıcı 2026-11-06, Canlı Not 45: "Hesapla butonu neden böyle
// duruyor? Neden burada duruyor? Sağ taraftaki sütunun altına …"). Önce: tuvalin sağ
// altında tek düğmeli, solu boş bir kart. Node'da koşmayan halkalar: yapışık şeridin
// panelin dibine oturması, kapalı panelde yalnız sıradaki adımın simgesinin şeritte
// görünmesi, gerçek tıklamanın hesabı başlatması.
test('EYLEM ŞERİDİ: Özellikler\'in dibinde, sağa yaslı; kapalı panelde şeridin dibinde sıradaki adımın simgesi; tuvalde eylem yok', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await page.evaluate(() => { try { localStorage.removeItem(VE_MW_3B_YAN_ANAHTAR); } catch (e) {} });
  await dosyaSec(page, GUC);
  await hazir(page);
  // rolsüzken şerit yok
  await expect(page.locator('#ve-mw-3b-eylem')).toBeHidden();
  await page.evaluate(() => {
    const s = veMntWizStp();
    s.sonuc.agac.forEach((d) => { if (d.ad === 'Motor bloğu') veMntWizStpRol(d.i, 'mnt-motor'); if (/takoz$/i.test(d.ad)) veMntWizStpRol(d.i, 'mnt-mount'); });
  });
  const yer = () => page.evaluate(() => {
    const r = (e) => e && e.getBoundingClientRect(), yan = r(document.getElementById('ve-mw-3b-yan'));
    const ey = r(document.getElementById('ve-mw-3b-eylem')), h = document.getElementById('ve-mw-3b-hesapla'), a = document.getElementById('ve-mw-3b-aktar');
    const gor = (e) => !!(e && e.offsetWidth > 0);
    return { yanSag: yan.right, yanAlt: yan.bottom, yanSol: yan.left, eyAlt: ey && ey.bottom,
      hesapla: gor(h) ? { sag: r(h).right, sol: r(h).left, g: Math.round(r(h).width), ad: h.textContent.trim(), ipucu: h.getAttribute('title') } : null,
      aktar: gor(a) ? { g: Math.round(r(a).width), ipucu: a.getAttribute('title') } : null,
      tuvalde: !!document.querySelector('#ve-mw-3b-tuval #ve-mw-3b-hesapla, #ve-mw-3b-tuval .ve-mw-3b-eylem') };
  });
  // KAPALI panel: şeridin dibinde yalnız Hesapla'nın simgesi (adı ipucunda); tuvalde eylem yok
  let y = await yer();
  expect(y.tuvalde).toBe(false);
  expect(y.hesapla.g).toBeLessThanOrEqual(26);
  expect(y.hesapla.sol).toBeGreaterThanOrEqual(y.yanSol);
  expect(y.hesapla.ipucu).toBe('Hesapla');
  expect(Math.abs(y.eyAlt - y.yanAlt)).toBeLessThan(1.5);
  // AÇIK panel: şerit panelin dibinde, düğme sağa yaslı ve adıyla; ipucu adı tekrarlamaz
  await page.click('#ve-mw-3b-yan-dugme');
  y = await yer();
  expect(Math.abs(y.eyAlt - y.yanAlt)).toBeLessThan(1.5);
  expect(Math.round(y.yanSag - y.hesapla.sag)).toBe(14);
  expect([y.hesapla.ad, y.hesapla.ipucu]).toEqual(['Hesapla', null]);
  // gerçek tık hesabı başlatır; sonra sıradaki adım Sihirbaza aktar
  await page.click('#ve-mw-3b-hesapla');
  await page.waitForFunction(() => { const s = veMntWizStp(); return s.coz && s.coz.ok; }, null, { timeout: 60000 });
  y = await yer();
  expect(y.hesapla.ad).toBe('Yeniden hesapla');
  expect(y.aktar).not.toBe(null);
  // kapalı panelde yalnız sıradaki adım (Sihirbaza aktar) görünür
  await page.click('#ve-mw-3b-yan-dugme');
  y = await yer();
  expect(y.hesapla).toBe(null);
  expect(y.aktar).toEqual({ g: 24, ipucu: 'Sihirbaza aktar' });
  expect(hatalar).toEqual([]);
});

// SAĞ TIK MENÜSÜ (Canlı Not 8, 2026-11-05 — kullanıcı: "Sağ klik yaptığımızda
// 3D Experience programının CAD modülündeki özellikler gelsin. İşte parçayı hide
// yapma, seçilen parçayı ürün ağacında gösterme vs."). Önce: sağ tık hiçbir şey
// açmıyordu, gizleme yoktu. Node'da koşmayan halkalar: gerçek sağ tık (sürükleme
// kaydırır, tık menü açar), gölgelendiricinin gizli parçayı atması (isabet yok),
// Esc'in yalnız menüyü kapatması, Ağaçta göster'in kapalı dalı açıp satırı bulması.
test('SAĞ TIK: menü imleçte; Gizle parçayı çizmez ve seçtirmez; Ağaçta göster; Tümünü göster; sağ sürükleme kaydırır; Esc yalnız menüyü kapatır', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, DENEME);
  await hazir(page);
  const q = await page.evaluate(() => {
    for (const p of veMntWizStp().sonuc.parcalar) { const n = veMntWiz3bIsabetNoktasi(p.i); if (n) return { ...n, i: p.i, dugum: p.dugum }; }
    return null;
  });
  expect(q).not.toBe(null);
  // Sağ sürükleme kaydırır, menü açmaz
  const h0 = await page.evaluate(() => [_mw3b.ctrl.hedef.x, _mw3b.ctrl.hedef.y, _mw3b.ctrl.hedef.z]);
  await page.mouse.move(q.x, q.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(q.x + 60, q.y + 20, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  expect((await durum(page)).menu).toBe(false);
  expect(await page.evaluate(() => [_mw3b.ctrl.hedef.x, _mw3b.ctrl.hedef.y, _mw3b.ctrl.hedef.z])).not.toEqual(h0);
  // Kaydırma parçayı başka yere taşıdı: noktayı yeniden ölç
  const p = await page.evaluate((i) => veMntWiz3bIsabetNoktasi(i), q.i);
  expect(p).not.toBe(null);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.locator('#ve-mw-3b-menu')).toBeVisible();
  const m = await page.locator('#ve-mw-3b-menu').boundingBox();
  expect(Math.abs(m.x - p.x)).toBeLessThan(260);
  expect((await durum(page)).secim).toEqual([q.dugum]);              // tıklanan düğüm seçildi
  expect(await page.locator('#ve-mw-3b-menu > [data-k], #ve-mw-3b-menu > .ve-mw-3b-menu-kap > [data-k]').evaluateAll((b) => b.map((x) => x.getAttribute('data-k'))))
    .toEqual(expect.arrayContaining(['gizle', 'yalniz', 'tumu', 'agac', 'odak', 'sigdir', 'rol', 'temizle']));
  // Esc yalnız menüyü kapatır
  await page.keyboard.press('Escape');
  await expect(page.locator('#ve-mw-3b-menu')).toHaveCount(0);
  expect(await page.evaluate(() => veMntWiz3bAcik())).toBe(true);
  // Ağaçta göster: kapalı dal açılır, satır görünür ve kısa vurgu alır
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await page.click('#ve-mw-3b-menu [data-k="agac"]');
  const satir = page.locator('#ve-mw-3b-agac-l [data-ve-3b-agac="' + q.dugum + '"]');
  await expect(satir).toBeVisible();
  await expect(satir).toHaveClass(/isik/);
  // Gizle: parça isabet almaz (gölgelendirici de atar), ağaçta satırı soluk
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await page.click('#ve-mw-3b-menu [data-k="gizle"]');
  await expect(page.locator('#ve-mw-3b-menu')).toHaveCount(0);
  expect((await durum(page)).gizli).toBeGreaterThan(0);
  expect(await page.evaluate((a) => _mw3bIsabet(a.x, a.y) !== a.i, { ...p, i: q.i })).toBe(true);
  await expect(satir).toHaveClass(/gizli/);
  // Boşlukta sağ tık (Canlı Not 20): görünümün menüsü — Arka plan → Düz beyaz (tercih kalır)
  const bos = await page.evaluate(() => {
    const V = window._mw3b, cv = V.renderer.domElement, r = cv.getBoundingClientRect();
    for (let y = r.top + 40; y < r.bottom - 40; y += 23)
      for (let x = r.left + 40; x < r.right - 40; x += 29)
        if (document.elementFromPoint(x, y) === cv && _mw3bIsabet(x, y) < 0) return { x, y };
    return null;
  });
  await page.mouse.click(bos.x, bos.y, { button: 'right' });
  await expect(page.locator('#ve-mw-3b-menu [data-k="gizle"]')).toHaveCount(0);
  expect(await page.locator('#ve-mw-3b-menu > [data-k], #ve-mw-3b-menu > .ve-mw-3b-menu-kap > [data-k]').evaluateAll((b) => b.map((x) => x.getAttribute('data-k'))))
    .toEqual(['tumu', 'sigdir', 'bakis', 'gorunus', 'zemin', 'suzgec', 'olcu', 'kesit', 'temizle']);
  await page.hover('#ve-mw-3b-menu [data-k="zemin"]');
  await page.click('#ve-mw-3b-menu [data-k="zemin:beyaz"]');
  expect(await page.evaluate(() => [veMntWiz3bDurum().zeminK, _mw3b.scene.background.isColor && _mw3b.scene.background.getHexString(),
    window.localStorage.getItem(VE_MW_3B_ZEMIN_ANAHTAR)])).toEqual(['beyaz', 'ffffff', 'beyaz']);
  await page.evaluate(() => { veMntWiz3bZeminSec('studyo'); });
  // Ağacın satırında sağ tık da aynı menü; Tümünü göster her parçayı geri getirir
  await satir.locator('.ve-mw-3b-agac-ad').click({ button: 'right' });
  await expect(page.locator('#ve-mw-3b-menu [data-k="goster"]')).toBeVisible();
  await page.click('#ve-mw-3b-menu [data-k="tumu"]');
  expect((await durum(page)).gizli).toBe(0);
  await expect(satir).not.toHaveClass(/gizli/);
  expect(await page.evaluate((i) => veMntWiz3bIsabetNoktasi(i) !== null, q.i)).toBe(true);
  // Klavye: ↓ ile gezilir, → alt menüyü açar, Enter uygular (Rol → Braket)
  await page.mouse.click(p.x, p.y, { button: 'right' });
  const rolAc = page.locator('#ve-mw-3b-menu [data-k="rol"]');
  await rolAc.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#ve-mw-3b-menu [data-k="rol:mnt-motor"]')).toBeFocused();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await expect(page.locator('#ve-mw-3b-menu [data-k="rol:mnt-bracket"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ve-mw-3b-menu')).toHaveCount(0);
  expect(await page.evaluate((d) => veMntWizStp().roller[d], q.dugum)).toBe('mnt-bracket');
  expect(hatalar).toEqual([]);
});

// ROL ALANI (kullanıcı 2026-11-06, Canlı Not 49: *"Şu rol açılır penceresini de
// düzenleyelim … çok amatör duruyor"*): tarayıcının gruplu listesi yerine menünün
// dilinde liste. Kapalıyken komşu liste (Motor modeli) gibi; tık alanın altında açar.
test('ROL ALANI: kapalıyken liste gibi; tık alanın altında gruplu listeyi açar; klavye, Esc, ikinci tık, dışarı tık', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootApp(page);
  await dosyaSec(page, GUC);
  await hazir(page);
  const motor = await page.evaluate(() => { const i = veMntWizStp().sonuc.agac.findIndex((d) => d.ad === 'Motor bloğu'); veMntWiz3bSec(i); return i; });
  const alan = page.locator('#ve-mw-3b-alt #ve-mw-3b-rol');
  await expect(alan).toBeVisible();
  await expect(alan).toHaveText('—');
  // Kapalıyken: okun ve kutunun ölçüsü yerel listeyle AYNI kuraldan
  const kapali = await page.evaluate(() => {
    const a = document.getElementById('ve-mw-3b-rol'), s = document.createElement('select');
    s.className = 've-fw-inp'; a.parentNode.appendChild(s);
    const A = getComputedStyle(a), S = getComputedStyle(s), r = a.getBoundingClientRect();
    const o = { ok: A.backgroundImage === S.backgroundImage && A.backgroundPosition === S.backgroundPosition, h: Math.round(r.height),
      kenar: A.borderTopColor === S.borderTopColor, zemin: A.backgroundColor === S.backgroundColor, yazi: A.fontSize === S.fontSize };
    s.remove();
    return o;
  });
  expect(kapali).toEqual({ ok: true, h: 28, kenar: true, zemin: true, yazi: true });
  // Tık: liste alanın altında, en az alan genişliğinde, ekranın içinde; dört grup başlığı
  await alan.click();
  const menu = page.locator('#ve-mw-3b-menu.alanli');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('aria-label', 'Rol');
  await expect(alan).toHaveAttribute('aria-expanded', 'true');
  const [a, m] = [await alan.boundingBox(), await menu.boundingBox()];
  expect(Math.abs(m.x - a.x)).toBeLessThanOrEqual(1);
  expect(m.y).toBeGreaterThanOrEqual(a.y + a.height);
  expect(m.width).toBeGreaterThanOrEqual(a.width - 1);
  expect(m.y + m.height).toBeLessThanOrEqual(900);
  await expect(menu.locator('.ve-mw-3b-menu-bas')).toHaveText(['Gövdeler', 'Takoz', 'Aktarma', 'Motor aksesuarları']);
  expect(await menu.locator('.ve-mw-3b-menu-renk').count()).toBe(0);
  await expect(menu.locator('[data-k="rol:"]')).toBeDisabled();                 // rolsüzken Rolü kaldır kapalı
  await expect(menu.locator('[data-k="rol:mnt-motor"]')).toBeFocused();         // seçili yokken ilk satır
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('[data-k="rol:mnt-gearbox"]')).toBeFocused();
  // Esc: liste kapanır, odak alana döner, görüntüleyici açık kalır
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(alan).toBeFocused();
  await expect(alan).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => veMntWiz3bAcik())).toBe(true);
  // Klavyeyle açılır (↓); ikinci tık kapatır (yeniden açmaz)
  await page.keyboard.press('ArrowDown');
  await expect(menu).toBeVisible();
  await alan.click();
  await expect(menu).toHaveCount(0);
  // Dışarı tık kapatır (ağacın başlığı: seçimi değiştirmeyen bir yer)
  await alan.click();
  await expect(menu).toBeVisible();
  await page.click('.ve-mw-3b-dock-bas h3');
  await expect(menu).toHaveCount(0);
  await expect(alan).toHaveAttribute('aria-expanded', 'false');
  // Satır rolü verir; alan yeni rolü adıyla gösterir, odak alanda
  await alan.click();
  await page.click('#ve-mw-3b-menu [data-k="rol:mnt-motor"]');
  await expect(menu).toHaveCount(0);
  expect(await page.evaluate((d) => veMntWizStp().roller[d], motor)).toBe('mnt-motor');
  await expect(alan).toHaveAttribute('data-deger', 'mnt-motor');
  await expect(alan).toBeFocused();
  // Yeniden açınca seçili satır işaretli ve odakta; Rolü kaldır açık
  await alan.click();
  await expect(menu.locator('[data-k="rol:mnt-motor"]')).toHaveAttribute('aria-checked', 'true');
  await expect(menu.locator('[data-k="rol:mnt-motor"]')).toBeFocused();
  await expect(menu.locator('[data-k="rol:"]')).toBeEnabled();
  await page.evaluate(Y.KAYNAK);
  expect(Y.yerlesimOzet(await page.evaluate(() => window.__yerlesim('#ve-mw-3b-menu')), 'Rol listesi')).toEqual([]);
  await page.keyboard.press('Escape');
  expect(hatalar).toEqual([]);
});
