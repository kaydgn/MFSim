/**
 * fead-step.spec.js — SİHİRBAZDA "STEP'TEN BAŞLA" (gerçek tarayıcı)
 *
 * Kullanıcı isteği (2026-09-26): CATIA/3DEXPERIENCE montajı programa atılır,
 * parçaları kullanıcı ELLE seçer, bir düğmeyle çaplar ve merkezler hesaplanır
 * ve kayış düzlemi hemen çizilir.
 *
 * Node'da HİÇ koşmayan halkalar:
 *   · dosya girişinin gerçek File nesnesi (arrayBuffer) ve bir kare sonraki
 *     ayrıştırma — .stpZ (başlık alanlı gzip) tarayıcıda açılıyor mu
 *   · 3B GÖRÜNTÜLEYİCİ (js/cp-fead-3b.js): uygulamanın kendi karesi WebGL'de
 *     gerçekten çiziyor, parçaya gerçek fare tıklaması onu seçiyor, rol düğmesi
 *     kartın durumuna yazıyor, önden bakış 2B çizimle aynı eksenlerde (düşey
 *     düzlemde de XY düzleminde de), Esc yalnız 3B'yi kapatıyor, kart altından
 *     değişince pencere kapanıyor
 *   · kartın gerçek tıklamaları: "3B'de seç", "Sihirbaza aktar", "Sıra doğru"
 *   · çizim gerçekten görünür bir boyutta ve rengi temadan çözülüyor
 *   · BIRAKMA: kartın üstüne bırakılan dosya okunur ve ölçüm içe aktarma
 *     kaplaması/sihirbazı AÇILMAZ (`data-ve-dropzone` sözleşmesi)
 *   · tablo kartın içinde kalıyor — yatay kaydırma yok
 *   · künye seçilince model gerçekten çözülüyor ve "Modeli Kur" 4 kasnak kuruyor
 * Sentetik dosya Gates AG00686 düzeni (tests/helpers/step-ornek.js) — birim
 * testiyle AYNI dosya.
 */
const { test, expect } = require('@playwright/test');
const zlib = require('zlib');
const O = require('../helpers/step-ornek.js');
test.setTimeout(180000);

function stpZ(metin) {
  // CATIA'nın .stpZ'si gzip; başlıkta dosya adı taşıyabiliyor (FNAME)
  const govde = zlib.deflateRawSync(Buffer.from(metin, 'latin1'));
  return Buffer.concat([Buffer.from([0x1f, 0x8b, 8, 8, 0, 0, 0, 0, 0, 3]),
    Buffer.from('AG00686.stp\0', 'latin1'), govde, Buffer.alloc(8)]);
}

async function feadAc(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.veFeadOpenEditor === 'function', null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  // Boş FEAD topolojisini BAŞLANGIÇ SAYFASI karşılar (FEAD kural 5, 2026-09-29):
  // "Sihirbazla kur" kapısı sihirbazı 1. adımda — STEP kartıyla — açar.
  await page.locator('#ve-fead-baslangic .ve-fead-bas-kapi[data-ey="sihirbaz"]').click();
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible({ timeout: 20000 });
}

test('STEP\'ten başla: .stpZ seç → 3B\'de parçaya tıklayıp rol ver → hesapla (halkalar) → aktar → künye → Modeli Kur', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1366, height: 768 });
  await feadAc(page);
  // Sihirbazın 3B'siz ölçüsü: kapanınca dönülecek ölçü BU (sabit sayı değil —
  // pencere 2026-09-29'da genişledi ve sabit 1.180 kapıyı yanlış yere çiviledi).
  const genislik = () => page.evaluate(() => Math.round(document.querySelector('.ve-fw-modal').getBoundingClientRect().width));
  const normal = await genislik();

  // ── 1) DOSYA SEÇ (gerçek File nesnesi, gzip) → 3B görüntüleyici AÇILIR ──
  const kart = page.locator('.ve-fw-stp');
  await expect(kart).toBeVisible();
  await page.locator('.ve-fw-stp-file').setInputFiles({
    name: 'AG00686.stpZ', mimeType: 'application/octet-stream', buffer: stpZ(O.ag00686Step()),
  });
  const satir = page.locator('.ve-fw-tbl-stp tr[data-ve-stp]');
  // Kartın ağacı (3B'nin arkasında): bütün parçalar (kayış dâhil); YALNIZ GERGİ rol
  // almış — dosya okununca otomatik bulundu (5.2: imza + ad · kod · katalog) ve işaretli
  await expect(satir).toHaveCount(5, { timeout: 20000 });
  await expect(page.locator('.ve-fw-stp .ve-fw-seeded').first()).toContainText('sıkıştırılmış (gzip)');
  expect(await satir.locator('select').evaluateAll((l) => l.map((s) => s.value))).toEqual(['', '', '', 'fead-tensioner', '']);
  await expect(page.locator('.ve-fw-stp [data-ve-otomatik]')).toContainText('Gergi otomatik bulundu');
  await expect(page.locator('.ve-fw-stp .ve-fw-oto-rozet')).toHaveCount(1);
  // Tablo kartın içinde: yatay kaydırma yok (1366 × 768)
  const tasma = await page.evaluate(() => {
    const w = document.querySelector('.ve-fw-tbl-stp').closest('.ve-fw-tblwrap');
    const g = document.getElementById('ve-fw-body');
    return { tablo: w.scrollWidth - w.clientWidth, govde: g.scrollWidth - g.clientWidth };
  });
  expect(tasma.tablo).toBeLessThanOrEqual(1);
  expect(tasma.govde).toBeLessThanOrEqual(1);

  await expect(page.locator('#ve-fw-3b')).toBeVisible();
  await expect(page.locator('#ve-fw-3b-tuval')).toHaveAttribute('data-durum', 'hazir', { timeout: 30000 });
  expect((await page.evaluate(() => veFeadWiz3bDurum())).parca).toBe(5);
  // Kaplama sihirbazın başlığını da örtüyor: başlığı PENCERE AİLESİNİN — bant,
  // yazı ve 22 px çizgi ikonlu kapat sihirbazın kendi başlığıyla aynı ölçüde
  const bas = await page.evaluate(() => {
    const olc = (h) => { const r = h.getBoundingClientRect(), k = h.querySelector('.ve-settings-close'), c = k.getBoundingClientRect(), cs = getComputedStyle(h);
      return [Math.round(r.height), Math.round(c.width), Math.round(c.height), cs.fontSize, cs.fontWeight, !!k.querySelector('.mf-ico-x')]; };
    return { sihirbaz: olc(document.querySelector('.ve-fw-modal > .ve-settings-header')), uc: olc(document.querySelector('.ve-fw-3b-bas')) };
  });
  expect(bas.uc).toEqual(bas.sihirbaz);
  // GENİŞ PENCERE (kullanıcı isteği 2026-09-28): 3B açıkken sihirbaz ekranı
  // doldurur — 1366'da 1.342 px (3B'siz 1.318); kapanınca eski ölçüsüne döner (aşağıda).
  expect(await genislik()).toBeGreaterThanOrEqual(1366 - 30);
  expect(await genislik()).toBeGreaterThan(normal);
  await expect(page.locator('#ve-feadwiz-overlay')).toHaveClass(/ve-fw-3b-genis/);
  // SIĞDIRMA montajın KENDİ noktalarıyla: eksene hizalı kutunun köşeleriyle
  // sığdırmak eğik bakışta modeli küçültüyordu (kullanıcının dosyasında tuvalin
  // %29'u). Ölçülen: örneklenmiş köşelerin izdüşümünün yarı genişliği (NDC) —
  // hedef 0,80 (VE_FW_3B_ACILIS.doluluk, 2026-09-30: 0,85 "çok yakın"); kutuyla
  // sığdırılsaydı ~0,72. Eşik ikisinin arasında. TASARIM B'de (2026-09-30) kart
  // ve dizi tuvalin ÜSTÜNDE: doluluk onların örtmediği SERBEST alana göre, ve
  // montaj ne kartın ne dizinin altına girer.
  const doluluk = () => page.evaluate(() => {
    const V = _fw3b;
    V.camera.updateMatrixWorld();
    let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
    (veFeadWizStp().ag || []).forEach((a) => {
      if (!a) return;
      for (let i = 0; i < a.uc.length; i += 30) {
        const p = new THREE.Vector3(a.uc[i], a.uc[i + 1], a.uc[i + 2]).project(V.camera);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
    });
    const F = veFeadWiz3bSerbest(), w = V.kap.clientWidth, h = V.kap.clientHeight;
    const ax = (w - F.sag) / w, ay = (h - F.alt) / h;
    window.__ortu = { sag: x1 <= 1 - 2 * F.sag / w + 0.02, alt: y0 >= -1 + 2 * F.alt / h - 0.02, F };
    return Math.max((x1 - x0) / 2 / ax, (y1 - y0) / 2 / ay);
  });
  let dol = await doluluk();
  // montaj kartın ve dizinin örttüğü yere girmiyor; örtüler gerçekten ölçüldü
  expect(await page.evaluate(() => window.__ortu)).toMatchObject({ sag: true, alt: true });
  expect(await page.evaluate(() => window.__ortu.F.sag)).toBeGreaterThan(400);
  expect(await page.evaluate(() => window.__ortu.F.alt)).toBeGreaterThanOrEqual(124);
  expect(dol).toBeGreaterThan(0.76);
  expect(dol).toBeLessThan(0.84);
  // AÇILIŞ BAKIŞI kayış düzleminden (2026-09-30): kamera düzlemin ÖNÜNDE
  // (hesabın bakış kuralı), üç çeyrek açıyla; düzlemin yukarısı ekranda yukarı.
  const bakis = await page.evaluate(() => {
    const V = _fw3b, e = veFeadWiz3bAcilisEksen(veFeadWizStp());
    V.camera.updateMatrixWorld();
    const ileri = new THREE.Vector3(); V.camera.getWorldDirection(ileri);
    const yuk = new THREE.Vector3().setFromMatrixColumn(V.camera.matrixWorld, 1);
    return { on: ileri.dot(new THREE.Vector3(...e.d)), yukari: yuk.dot(new THREE.Vector3(...e.yukari)) };
  });
  expect(bakis.on).toBeGreaterThan(0.75);                 // önden, ~33° eğik
  expect(bakis.on).toBeLessThan(0.95);                    // dümdüz önden değil (üç çeyrek)
  expect(bakis.yukari).toBeGreaterThan(0.85);
  // "Sığdır" düğmesi de aynı noktalarla: tekerlekle uzaklaş → sığdır
  const tuv0 = await page.locator('#ve-fw-3b-tuval').boundingBox();
  await page.mouse.move(tuv0.x + tuv0.width / 2, tuv0.y + tuv0.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(doluluk).toBeLessThan(0.6);
  await page.locator('.ve-fw-3b-bas button', { hasText: 'Sığdır' }).click();
  dol = await doluluk();
  expect(dol).toBeGreaterThan(0.76);
  // Tuval gerçekten ÇİZİLDİ — UYGULAMANIN KENDİ karesinde: ortada zemin
  // renginden farklı pikseller. Tampon kareden sonra silinir, yani pikseller
  // uygulamanın render çağrısının hemen ardından okunur. Test sahneyi kendisi
  // çizseydi uygulamanın çizim yolu hiç ölçülmezdi (mutasyonla ölçüldü: çizim
  // çağrısı silinince eski kapı yeşil kalıyordu).
  const cizildi = await page.evaluate(() => new Promise((ok) => {
    const r = _fw3b.renderer, asil = r.render;
    const sure = setTimeout(() => { r.render = asil; ok(-1); }, 5000);
    r.render = function(sahne, kamera){
      asil.call(r, sahne, kamera);
      r.render = asil; clearTimeout(sure);
      const gl = r.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(4 * 41 * 41);
      // SERBEST alanın ortası (tasarım B: kart sağda, dizi altta örter; montaj oraya sığdırılır)
      const F = veFeadWiz3bSerbest(), k = w / _fw3b.kap.clientWidth;
      gl.readPixels(Math.floor((w - F.sag * k) / 2) - 20, Math.floor((h + F.alt * k) / 2) - 20, 41, 41, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const z = sahne.background; let farkli = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (Math.abs(px[i] - z.r * 255) + Math.abs(px[i + 1] - z.g * 255) + Math.abs(px[i + 2] - z.b * 255) > 30) farkli++;
      }
      ok(farkli);
    };
    veFeadWiz3bSigdir();                     // uygulamanın kendi çizim isteği
  }));
  expect(cizildi).toBeGreaterThan(50);

  // ── 2) 3B'DE PARÇAYA TIKLA → ROL VER ────────────────────────────────────
  const parcaAdlari = await page.evaluate(() => veFeadWizStp().sonuc.parcalar.map((p) => p.ad));
  const tikla = async (re) => {
    const i = parcaAdlari.findIndex((a) => re.test(a));
    const n = await page.evaluate((j) => veFeadWiz3bIsabetNoktasi(j), i);
    expect(n).not.toBeNull();
    await page.mouse.move(n.x, n.y);
    return { i, n };
  };
  // Fare altında parçanın adı
  const krank = await tikla(/KRANK/);
  await expect(page.locator('#ve-fw-3b-ipucu')).toBeVisible();
  await expect(page.locator('#ve-fw-3b-ipucu')).toContainText('KRANK');
  await page.mouse.click(krank.n.x, krank.n.y);
  const yan = page.locator('#ve-fw-3b-yan');
  await expect(yan.locator('.ve-fw-3b-yol b')).toContainText('KRANK');
  // Roller alttaki dizide (tasarım B); seçilen parçanın rolü yok → basılı çip yok
  await expect(page.locator('#ve-fw-3b-alt button.ve-fw-3b-rol[aria-pressed="true"]')).toHaveCount(0);
  await expect(yan.locator('[data-ve-3b-rol]')).toHaveCount(0);
  await page.locator('#ve-fw-3b-alt .ve-fw-3b-rol[data-ve-3b-rol="fead-crank"]').click();
  await expect(page.locator('#ve-fw-3b-alt .ve-fw-3b-rol[aria-pressed="true"]')).toContainText('Krank Kasnağı');
  // KAYIŞ DA 3B'DE SEÇİLİR (kullanıcı isteği 2026-09-28)
  for (const [re, tip] of [[/AVARA/, 'fead-idler'], [/KL[İI]MA/, 'fead-ac'], [/GERG[İI]/, 'fead-tensioner'], [/KAYI/, 'fead-belt']]) {
    const p = await tikla(re);
    await page.mouse.click(p.n.x, p.n.y);
    await page.locator('#ve-fw-3b-alt .ve-fw-3b-rol[data-ve-3b-rol="' + tip + '"]').click();
  }
  await expect(yan).toContainText('Rol verilenler 5');
  // Boşluğa tıklamak seçimi kaldırır (tuvalin sol üst köşesi)
  const tuv = await page.locator('#ve-fw-3b-tuval').boundingBox();
  await page.mouse.click(tuv.x + 12, tuv.y + 12);
  await expect(page.locator('#ve-fw-3b-alt')).toContainText('modelde bir parçaya tıklayın');   // yönerge dizide (tasarım B)
  await expect(yan.locator('[data-ve-3b-secili]')).toHaveCount(0);
  // Rol KARTLA ORTAK: kartın ağacında aynı roller
  const adSatiri = (ad) => satir.filter({ has: page.locator('td:first-child', { hasText: new RegExp(ad) }) });
  await expect(adSatiri('KRANK').locator('select')).toHaveValue('fead-crank');
  await expect(adSatiri('GERGİ').locator('select')).toHaveValue('fead-tensioner');

  // ── 3) HESAPLA (3B'de): dört halka, gergi kolu, sayı tablosu ─────────────
  await page.locator('#ve-fw-3b-hesapla').click();
  await expect(yan).toContainText('4 kasnak');
  await expect(yan.locator('[data-ve-3b-hesap-durum] .mf-ico-check').first()).toBeVisible();   // onay çizgi ikon (karar 10·B)
  expect((await page.evaluate(() => veFeadWiz3bDurum())).halka).toBe(4);
  // ÇAP ETİKETLERİ (tasarım B): her kasnağın yanında, sayısı kartın tablosuyla aynı
  expect((await page.evaluate(() => veFeadWiz3bDurum())).etiket).toBe(4);
  const etk = await page.locator('#ve-fw-3b-etiket [data-ve-3b-etiket]').allInnerTexts();
  expect(etk.join(' | ')).toMatch(/Krank[\s\S]*Ø160,0 · hesap 162,4/);
  const capler = await yan.locator('tr[data-ve-3b-kasnak] td:nth-child(2)').allInnerTexts();
  expect(capler.map((t) => +t.replace(',', '.')).sort((a, b) => a - b)).toEqual([75, 75, 127, 160]);
  await expect(page.locator('#ve-fw-3b-onden')).toBeEnabled();
  // Kayış kasnak sayılmadı; kodu, kanalı ve genişliği panelde
  await expect(yan.locator('[data-ve-3b-kayis]')).toContainText('8PK1475 · 8 kanal · 28,48 mm');

  // ÖNDEN BAK: 3B, 2B çizimle AYNI eksenlerde. AG00686'da klima krankın
  // solunda ve üstünde (x −224, y 448); arkadan bakınca sağda kalır.
  const ekran = () => page.evaluate(() => {
    const V = _fw3b, c = veFeadWizStp().coz, r = V.renderer.domElement.getBoundingClientRect();
    V.camera.updateMatrixWorld();
    const yer = (tip) => { const k = c.kasnaklar.find((q) => q.tip === tip); const p = new THREE.Vector3(...k.merkez).project(V.camera);
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; };
    return { krank: yer('fead-crank'), klima: yer('fead-ac') };
  });
  await page.locator('#ve-fw-3b-onden').click();
  let e = await ekran();
  expect(e.klima.x).toBeLessThan(e.krank.x);
  expect(e.klima.y).toBeLessThan(e.krank.y);
  await yan.locator('.ve-fw-spin', { hasText: 'Arkadan' }).click();
  await page.locator('#ve-fw-3b-onden').click();
  e = await ekran();
  expect(e.klima.x).toBeGreaterThan(e.krank.x);
  await yan.locator('.ve-fw-spin', { hasText: 'Önden' }).click();

  // Hesaptan sonra rol değişince sonuç KENDİSİ yenilenir (2026-09-30: her
  // kasnakta düğmeye dönmek zahmetliydi) — halkalar kalır, tablo yeni rolü taşır
  const klima = await tikla(/KL[İI]MA/);
  await page.mouse.click(klima.n.x, klima.n.y);
  await page.locator('#ve-fw-3b-alt .ve-fw-3b-rol[data-ve-3b-rol="fead-alternator"]').click();
  expect((await page.evaluate(() => veFeadWiz3bDurum())).halka).toBe(4);
  expect(await page.evaluate(() => veFeadWizStp().coz.kasnaklar.map((k) => k.tip))).toContain('fead-alternator');
  await page.locator('#ve-fw-3b-alt .ve-fw-3b-rol[data-ve-3b-rol="fead-ac"]').click();
  // Tek düğme alttaki dizide: kart kaydırılsa da yerinde, kartın altında değil
  await yan.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const dugme = await page.locator('#ve-fw-3b-alt #ve-fw-3b-hesapla').boundingBox(), yk = await yan.boundingBox();
  expect(dugme.x + dugme.width).toBeLessThan(yk.x);
  const tuvK = await page.locator('#ve-fw-3b-tuval').boundingBox();
  expect(dugme.y + dugme.height).toBeLessThanOrEqual(tuvK.y + tuvK.height);
  await page.locator('#ve-fw-3b-hesapla').click();
  // Hesap seçimi kaldırır: seçim öteki kasnakları soldururdu, halkalar hepsinde okunmalı
  expect(await page.evaluate(() => veFeadWiz3bDurum())).toMatchObject({ halka: 4, secili: -1 });

  // TEK ESC TEK KATMAN: yalnız 3B kapanır, sihirbaz ve kartın çizimi yerinde
  await page.keyboard.press('Escape');
  await expect(page.locator('#ve-fw-3b')).toBeHidden();
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();
  expect(await genislik()).toBe(normal);                      // sihirbaz eski ölçüsünde
  await expect(page.locator('#ve-feadwiz-overlay')).not.toHaveClass(/ve-fw-3b-genis/);
  await expect(page.locator('.ve-fw-stp-svg [data-ve-stp-kasnak]')).toHaveCount(4);
  await expect(page.locator('.ve-fw-stp-svg .ve-fw-stp-kol')).toHaveCount(1);
  await expect(adSatiri('KRANK')).toContainText('8 × PK');
  // Kartın çizimi görünür bir boyutta ve renkleri temadan (stroke çözülmüş)
  const cizim = await page.evaluate(() => {
    const svg = document.querySelector('.ve-fw-stp-svg');
    const c = svg.querySelector('[data-ve-stp-kasnak] circle');
    const r = svg.getBoundingClientRect();
    return { w: r.width, h: r.height, stroke: getComputedStyle(c).stroke };
  });
  expect(cizim.w).toBeGreaterThan(300);
  expect(cizim.h).toBeGreaterThan(200);
  expect(cizim.stroke).not.toBe('none');
  // Kart düğmesi pencereyi yeniden açar — üçgenler kartta saklı, yeniden örülmez
  await page.locator('#ve-fw-stp-3b').click();
  await expect(page.locator('#ve-fw-3b-tuval')).toHaveAttribute('data-durum', 'hazir', { timeout: 5000 });
  expect((await page.evaluate(() => veFeadWiz3bDurum())).halka).toBe(4);

  // ── 4) AKTAR (3B'den): pencere kapanır, sihirbaz dolar ───────────────────
  await page.locator('#ve-fw-3b-aktar').click();
  await expect(page.locator('#ve-fw-3b')).toBeHidden();
  await expect(page.locator('.ve-fw-stp')).toContainText('4 kasnak sihirbaza aktarıldı');
  const st = await page.evaluate(() => {
    const s = veFeadWizState();
    return { tipler: s.pulleys.map((p) => p.type).sort(), ten: s.ten, belt: s.belt, sira: s.siraKaynagi };
  });
  expect(st.tipler).toEqual(['fead-ac', 'fead-crank', 'fead-idler']);
  expect(st.ten.tenPart).toBe('T38624');
  expect(st.ten.armLen).toBe(90);
  // Kayış rolü verildi: profil · kanal · kod dosyadan, marka varsayılan; numara girdi değil
  expect(st.belt).toEqual({ profile: 'PK', brand: 'GATES', ribs: 8, beltType: '8PK1475' });
  expect(st.sira).toBe('agac');

  // ── 5) KASNAKLAR: sıra uyarısı ve onayı ─────────────────────────────────
  // Onay "Kasnaklar — kayış sırasıyla" kartının İÇİNDE (kullanıcı isteği
  // 2026-09-29: alttaki "Sıra ve yön" / sorun kutusundaki ikinci kopya kalktı).
  // Adım rayı yine uyarır: sorun listede, yalnız kutuda basılmıyor.
  const kutuMetni = () => page.evaluate(() => (document.getElementById('ve-fw-issue') || {}).textContent || '');
  await page.locator('.ve-fw-steps li').nth(1).click();
  await expect(page.locator('.ve-fw-kl-onay')).toContainText('STEP ağacından');
  expect(await kutuMetni()).not.toContain('STEP ağacından');
  await expect(page.locator('.ve-fw-steps li').nth(1)).toHaveClass(/ve-fw-st-(warn|err)/);
  await page.locator('#ve-fw-sira-onay').click();
  await expect(page.locator('.ve-fw-kl-onay')).toHaveCount(0);
  await expect(page.locator('#ve-fw-sira-onay')).toHaveCount(0);
  expect(await kutuMetni()).not.toContain('STEP ağacından');

  // ── 6) GERGİ: künye seç → model çözülür ─────────────────────────────────
  await page.locator('.ve-fw-steps li').nth(2).click();
  await page.locator('.ve-fw-card select').first().selectOption('AG00686');
  await expect(page.locator('#ve-fw-live .ve-fw-damga[data-model="ok"]')).toBeVisible({ timeout: 10000 });
  const b = await page.evaluate(() => {
    const r = veFeadWizBuild();
    return { ok: r.ok, spin: r.spin, n: r.order.length };
  });
  expect(b).toEqual({ ok: true, spin: -1, n: 4 });
  // KAYIŞ adımı: CAD'deki kayış bu düzende ne yapar
  await page.locator('.ve-fw-steps li').nth(3).click();
  await expect(page.locator('[data-ve="cad-kayis"]')).toContainText('8PK1475');
  await expect(page.locator('[data-ve="cad-kayis"]')).toContainText('Bu kayışla kol');

  // ── 7) MODELİ KUR ───────────────────────────────────────────────────────
  await page.locator('.ve-fw-steps li').nth(5).click();
  await page.locator('#ve-fw-create').click();
  await page.waitForFunction(() =>
    window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length === 4,
    null, { timeout: 20000 });
  const kur = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.type));
  expect(kur).toEqual(['fead-crank', 'fead-idler', 'fead-ac', 'fead-tensioner']);

  expect(hatalar).toEqual([]);
});

test('ALT MONTAJA rol: parçaya tıkla → yolda üst düğüme çık → rol bütün parçalarına geçer', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1366, height: 768 });
  await feadAc(page);
  await page.locator('.ve-fw-stp-file').setInputFiles({
    name: 'GERGI.stp', mimeType: 'application/octet-stream', buffer: Buffer.from(O.gergiAltMontaj(), 'latin1'),
  });
  await expect(page.locator('#ve-fw-3b-tuval')).toHaveAttribute('data-durum', 'hazir', { timeout: 30000 });
  // Gergi dosya okununca ALT MONTAJ olarak bulundu (5.2): rol üst düğümde, panelde yazılı
  await expect(page.locator('#ve-fw-3b-yan [data-ve-otomatik]')).toContainText('OTOMATİK GERGİ');
  await expect(page.locator('#ve-fw-3b-yan')).toContainText('Rol verilenler 1');
  const adlar = await page.evaluate(() => veFeadWizStp().sonuc.parcalar.map((p) => p.ad));
  const i = adlar.indexOf('KASNAK');
  const n = await page.evaluate((j) => veFeadWiz3bIsabetNoktasi(j), i);
  expect(n).not.toBeNull();
  await page.mouse.click(n.x, n.y);
  const yan = page.locator('#ve-fw-3b-yan');
  // Yol: MONTAJ (kök, tıklanmaz) › OTOMATİK GERGİ (düğme) › KASNAK (seçili)
  await expect(yan.locator('.ve-fw-3b-yol b')).toHaveText('KASNAK');
  await expect(yan.locator('.ve-fw-3b-yol button', { hasText: 'MONTAJ' })).toHaveCount(0);
  await yan.locator('.ve-fw-3b-yol button', { hasText: 'OTOMATİK GERGİ' }).click();
  await expect(yan.locator('.ve-fw-3b-yol b')).toHaveText('OTOMATİK GERGİ');
  await expect(yan).toContainText('2 parça');
  await page.locator('#ve-fw-3b-alt .ve-fw-3b-rol[data-ve-3b-rol="fead-tensioner"]').click();
  // Kol parçasının birimi de gergi: fare altında birimin adı yazılır
  const kol = await page.evaluate((j) => veFeadWiz3bIsabetNoktasi(j), adlar.indexOf('KOL'));
  await page.mouse.move(kol.x, kol.y);
  await expect(page.locator('#ve-fw-3b-ipucu')).toContainText('Otomatik Gergi (OTOMATİK GERGİ)');
  // Kartın ağacı: rol üst düğümde, iki parça onun birimi
  await page.keyboard.press('Escape');
  const satirlar = await page.locator('.ve-fw-tbl-stp tr[data-ve-stp]').evaluateAll((l) => l.map((r) => ({
    ad: r.children[0].textContent, rol: r.querySelector('select').value, kasnak: r.children[2].textContent })));
  const bul = (ad) => satirlar.find((r) => r.ad === ad);
  expect(bul('OTOMATİK GERGİ').rol).toBe('fead-tensioner');
  expect(bul('KASNAK').kasnak).toMatch(/Otomatik Gergi birimi/);
  expect(bul('KOL').kasnak).toMatch(/Otomatik Gergi birimi/);

  // ÖNDEN BAK DÜZLEMİN YUKARISIYLA: bu dosyada eksenler Z boyunca, kayış
  // düzlemi XY ve 2B çizimin yukarısı +Y. Kameranın varsayılan yukarısı (Z)
  // burada bakış yönüne paralel olur ve resim keyfi bir açıyla döner —
  // AG00686'da (düşey düzlem) iki yukarı çakıştığı için fark görünmüyordu.
  await page.locator('#ve-fw-stp-3b').click();
  await expect(page.locator('#ve-fw-3b-tuval')).toHaveAttribute('data-durum', 'hazir', { timeout: 10000 });
  const krk = await page.evaluate((j) => veFeadWiz3bIsabetNoktasi(j), adlar.indexOf('KRANK'));
  expect(krk).not.toBeNull();
  await page.mouse.click(krk.x, krk.y);
  await page.locator('#ve-fw-3b-alt .ve-fw-3b-rol[data-ve-3b-rol="fead-crank"]').click();
  await page.locator('#ve-fw-3b-hesapla').click();
  await expect(yan).toContainText('2 kasnak');
  expect((await page.evaluate(() => veFeadWiz3bDurum())).halka).toBe(2);
  await page.locator('#ve-fw-3b-onden').click();
  const ekr = await page.evaluate(() => {
    const V = _fw3b, c = veFeadWizStp().coz, r = V.renderer.domElement.getBoundingClientRect();
    V.camera.updateMatrixWorld();
    const yer = (tip) => { const k = c.kasnaklar.find((q) => q.tip === tip); const p = new THREE.Vector3(...k.merkez).project(V.camera);
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; };
    return { gergi: yer('fead-tensioner'), krank: yer('fead-crank') };
  });
  // 2B çizimde gergi krankın 270 mm ÜSTÜNDE (x aynı)
  expect(ekr.gergi.y).toBeLessThan(ekr.krank.y - 50);
  expect(Math.abs(ekr.gergi.x - ekr.krank.x)).toBeLessThan(5);
  expect(hatalar).toEqual([]);
});

test('kartın üstüne BIRAKILAN dosya okunur; ölçüm içe aktarma açılmaz', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await feadAc(page);
  const metin = O.ag00686Step();
  await page.evaluate(async (m) => {
    const dt = new DataTransfer();
    dt.items.add(new File([m], 'AG00686.stp', { type: 'application/octet-stream' }));
    const el = document.querySelector('.ve-fw-stp');
    // Belgenin kendi dinleyicileri de koşar (kabarcık): kaplama sayacı + drop
    for (const tip of ['dragenter', 'dragover', 'drop']) {
      el.dispatchEvent(new DragEvent(tip, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }
  }, metin);
  await expect(page.locator('.ve-fw-tbl-stp tr[data-ve-stp]')).toHaveCount(5, { timeout: 20000 });
  const durum = await page.evaluate(() => ({
    kaplama: document.getElementById('ve-imp-drop').classList.contains('on'),
    isaret: document.querySelector('.ve-fw-stp').classList.contains('ve-fw-stp-on'),
    olcumSihirbazi: [...document.querySelectorAll('.ve-settings-overlay')]
      .filter((o) => o.id !== 've-feadwiz-overlay' && getComputedStyle(o).display !== 'none').length,
    // Ölçüm bırakma alanının uzantı süzgeci .stp'yi REDDEDER ve "okunamaz —
    // yalnızca .xlsx…" der: yerel alan sözleşmesi olmasa sihirbaz yine açılmaz
    // ama kullanıcı dosyasının okunduğu anda "okunamaz" yazısını görürdü.
    // Kapının asıl ölçtüğü şey bu yanıltıcı iletinin YOKLUĞU.
    okunamaz: [...document.querySelectorAll('.ve-toast')]
      .filter((t) => /okunamaz/.test(t.textContent)).length,
  }));
  expect(durum).toEqual({ kaplama: false, isaret: false, olcumSihirbazi: 0, okunamaz: 0 });
  // Pencere o dosyanındı: kart altından başka bir sonuca geçerse (okunamayan
  // bir dosya) 3B kapanır — eski dosyanın modeli ekranda kalmaz
  await expect(page.locator('#ve-fw-3b-tuval')).toHaveAttribute('data-durum', 'hazir', { timeout: 30000 });
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;'], 'BOZUK.stp', { type: 'application/octet-stream' }));
    const el = document.querySelector('.ve-fw-stp');
    for (const tip of ['dragenter', 'dragover', 'drop']) {
      el.dispatchEvent(new DragEvent(tip, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }
  });
  await expect(page.locator('.ve-fw-stp')).toContainText('BOZUK.stp', { timeout: 20000 });
  await expect(page.locator('#ve-fw-3b')).toBeHidden();
  expect(hatalar).toEqual([]);
});

// ── KABURGALI KASNAĞIN KESİTİ VE HESAP ÇAPI (6.2) ─────────────────────────────
// Kullanıcı isteği (2026-09-28): 3B'de kaburgalı kasnak seçilince kesitin
// değerleri kendiliğinden; kullanıcı hesaba girecek çapı oradan seçer. Kararlar:
// seçim kayış için TEK, STEP'te varsayılan CAD eskizinin d_w'si.
test('KESİT: eskizli dosyada krank seçilince kesit; hesap çapı düğmesi bütün kasnakları birlikte çevirir', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1600, height: 900 });
  await feadAc(page);
  await page.locator('.ve-fw-stp-file').setInputFiles({
    name: 'AG00686.stpZ', mimeType: 'application/octet-stream', buffer: stpZ(O.ag00686Step({ eskiz: { hb: 1.5, hr: 1.5 } })),
  });
  await expect(page.locator('#ve-fw-3b-tuval')).toHaveAttribute('data-durum', 'hazir', { timeout: 30000 });
  await page.evaluate(() => {
    const s = veFeadWizStp();
    s.sonuc.agac.forEach((d, i) => {
      const t = /KRANK/.test(d.ad) ? 'fead-crank' : /KL[İI]MA/.test(d.ad) ? 'fead-ac' : /AVARA/.test(d.ad) ? 'fead-idler' : /KAYI/.test(d.ad) ? 'fead-belt' : null;
      if (t) veFeadWizStpRol(i, t);
    });
  });
  await page.locator('#ve-fw-3b-hesapla').click();
  const yan = page.locator('#ve-fw-3b-yan');
  const sutun = () => yan.locator('[data-ve-3b-hesapcap]').allTextContents();
  // varsayılan CAD: kaburgalı d_b + 2·1,5 · sırt OD + 2·1,5
  expect((await sutun()).sort()).toEqual(['130,0', '163,0', '78,0', '78,0'].sort());
  // krank seçilince kesit
  await page.evaluate(() => { const s = veFeadWizStp(); veFeadWiz3bSec(s.sonuc.agac.findIndex((d) => /KRANK/.test(d.ad))); });
  const kesit = yan.locator('[data-ve-3b-kesit]');
  await expect(kesit).toBeVisible();
  await expect(kesit.locator('[data-ve-kesit="hesap"]')).toContainText('163,00');
  await expect(kesit.locator('[data-ve-kesit="dw-cad"]')).toContainText('163,00');
  await expect(kesit.locator('svg [data-ve-hesap="1"]')).toHaveCount(1);
  // basılı düğme CSS'ten ayrışıyor (gerçek hesaplanmış zemin)
  const zemin = await kesit.locator('[data-ve-hesapcap]').evaluateAll((l) => l.map((b) => getComputedStyle(b).backgroundColor));
  expect(new Set(zemin).size).toBeGreaterThan(1);
  // GERÇEK tıklama: d_b → bütün kasnaklar dış çapına
  await kesit.locator('[data-ve-hesapcap="db"]').click();
  expect((await sutun()).sort()).toEqual(['127,0', '160,0', '75,0', '75,0'].sort());
  await expect(yan.locator('[data-ve-3b-kesit] [data-ve-kesit="hesap"]')).toContainText('160,00');
  await yan.locator('[data-ve-3b-kesit] [data-ve-hesapcap="cad"]').click();
  expect((await sutun()).sort()).toEqual(['130,0', '163,0', '78,0', '78,0'].sort());
  // panel yatay kaymıyor (kesit tablosu sütuna sığıyor)
  expect(await yan.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
  // aktarım: seçim ve ölçüler sihirbazın kayışına
  await page.locator('#ve-fw-3b-aktar').click();
  await expect(page.locator('#ve-fw-3b')).toBeHidden();
  expect(await page.evaluate(() => veFeadWizState().belt)).toMatchObject({ hbCad: 1.5, hrCad: 1.5, hesapCap: 'cad' });
  expect(hatalar).toEqual([]);
});

// ── KAYIŞ SEÇİLİNCE: KESİT ŞEKLİ, HESAP ÇAPI, ÖLÇÜLER (7) ──────────────────────
// Kullanıcı isteği (2026-09-29): ContiTech'in kayış kesiti şekli ve tablosu 3B
// görüntüleyicinin sağında; kullanıcı hesap çapını KAYIŞI SEÇTİKTEN SONRA oradan
// seçer. Sütun 320 → 440 px ("çok dar olmuş"). Node'da HİÇ koşmayan halkalar:
// 3B'de kayışa gerçek tıklama, matris başlığına gerçek tıklama, seçili sütunun
// CSS'ten gelen zemini, gerçek yazı tipiyle şeklin yazılarının kesilmemesi.
test('KAYIŞIN BÖLÜMÜ HEP GÖRÜNÜR: kesit şekli + hesap çapı matrisi + ölçüler; seçim oradan, kart 420 px', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1366, height: 768 });
  await feadAc(page);
  await page.locator('.ve-fw-stp-file').setInputFiles({
    name: 'AG00686.stpZ', mimeType: 'application/octet-stream', buffer: stpZ(O.ag00686Step({ eskiz: { hb: 1.5, hr: 1.5 } })),
  });
  await expect(page.locator('#ve-fw-3b-tuval')).toHaveAttribute('data-durum', 'hazir', { timeout: 30000 });
  await page.evaluate(() => {
    const s = veFeadWizStp();
    s.sonuc.agac.forEach((d, i) => {
      const t = /KRANK/.test(d.ad) ? 'fead-crank' : /KL[İI]MA/.test(d.ad) ? 'fead-ac' : /AVARA/.test(d.ad) ? 'fead-idler' : /KAYI/.test(d.ad) ? 'fead-belt' : null;
      if (t) veFeadWizStpRol(i, t);
    });
  });
  const yan = page.locator('#ve-fw-3b-yan');
  // KART 420 px ve tuvalin ÜSTÜNDE yüzer (tasarım B): tuval gövdenin tamamı
  const kutu = () => page.evaluate(() => ({
    yan: Math.round(document.getElementById('ve-fw-3b-yan').getBoundingClientRect().width),
    tuval: Math.round(document.getElementById('ve-fw-3b-tuval').getBoundingClientRect().width) }));
  expect(await kutu()).toMatchObject({ yan: 420 });
  expect((await kutu()).tuval).toBeGreaterThanOrEqual(1300);

  // HEP GÖRÜNÜR (2026-09-30): seçim yokken de bölüm yerinde; 3B'de kayışa
  // GERÇEK tıklama onu kapatmaz ya da çoğaltmaz
  const bolum = yan.locator('[data-ve-3b-kayis-kesit]');
  await expect(bolum).toBeVisible();
  const i = await page.evaluate(() => { const s = veFeadWizStp(); return s.sonuc.parcalar.findIndex((p) => /KAYI/.test(p.ad)); });
  const n = await page.evaluate((j) => veFeadWiz3bIsabetNoktasi(j), i);
  expect(n).not.toBeNull();
  await page.mouse.click(n.x, n.y);
  await expect(bolum).toHaveCount(1);
  await expect(bolum).toBeVisible();
  const sekil = bolum.locator('svg[data-ve="kayis-sekil"]');
  const sb = await sekil.boundingBox();
  expect(sb.width).toBeGreaterThanOrEqual(360);            // kartın içeriği kadar geniş
  expect(sb.height).toBeGreaterThanOrEqual(90);            // PK'da kayış görünür boyda
  const matris = yan.locator('[data-ve-hesapcap-matris]');
  await expect(matris.locator('thead [data-ve-hesapcap]')).toHaveCount(2);   // CAD eskizi hesapta okunur
  await expect(matris.locator('tr[data-ve-hc="bekliyor"]')).toBeVisible();
  await expect(yan.locator('[data-ve-kayis-olcu] thead th.on')).toHaveText('PK');

  // HESAPLA: seçim kalkar (halkalar) ama bölüm KALIR
  await page.locator('#ve-fw-3b-hesapla').click();
  expect((await page.evaluate(() => veFeadWiz3bDurum())).secili).toBe(-1);
  await expect(bolum).toBeVisible();
  // Alttaki ikinci "Hesap çapı" seçicisi YOK — seçim kayış kesitinin matrisinde
  await expect(yan.locator('.ve-fw-3b-hesapcap')).toHaveCount(0);
  await expect(yan.locator('[data-ve-3b-sonuc] [data-ve-hesapcap-grup]')).toHaveCount(0);
  await yan.locator('[data-ve-3b-kayis] button').click();
  await expect(bolum).toBeVisible();
  await expect(matris.locator('thead [data-ve-hesapcap]')).toHaveCount(3);
  await expect(matris.locator('[aria-pressed="true"]')).toHaveAttribute('data-ve-hesapcap', 'cad');
  await expect(matris.locator('tr[data-ve-hc-kasnak]')).toHaveCount(4);
  await expect(sekil.locator('[data-ve="sekil-dw"]')).toHaveAttribute('data-ve-hesap', '1');
  // seçili sütun CSS'ten ayrışıyor (gerçek hesaplanmış zemin)
  const zemin = await matris.locator('tr[data-ve-hc-kasnak="0"] td').evaluateAll((l) => l.map((td) => getComputedStyle(td).backgroundColor));
  expect(zemin[2]).not.toBe(zemin[1]);
  // GERÇEK tıklama: d_b → basılılık, şeklin hesap çizgisi ve HESAP tablosunun
  // "Hesap Ø" sütunu birlikte (tek alan)
  const hesapO = () => yan.locator('[data-ve-3b-hesapcap]').allTextContents();
  expect((await hesapO()).sort()).toEqual(['130,0', '163,0', '78,0', '78,0'].sort());
  await matris.locator('thead [data-ve-hesapcap="db"]').click();
  await expect(matris.locator('[aria-pressed="true"]')).toHaveAttribute('data-ve-hesapcap', 'db');
  await expect(sekil.locator('[data-ve="sekil-db"]')).toHaveAttribute('data-ve-hesap', '1');
  await expect(sekil.locator('[data-ve-hesap]')).toHaveCount(1);
  expect((await hesapO()).sort()).toEqual(['127,0', '160,0', '75,0', '75,0'].sort());

  // SIĞMA: panel yatay kaymıyor, tablolar kendi kabına sığıyor
  expect(await yan.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
  const tasan = await yan.locator('table').evaluateAll((l) => l.filter((t) => t.scrollWidth > t.clientWidth + 1).map((t) => t.className));
  expect(tasan).toEqual([]);
  // ŞEKLİN YAZILARI KESİLMİYOR — gerçek yazı tipiyle, 14 bileşimin hepsinde
  // (ölçüldü: 44 px'lik sol bölgede PM'nin "h 14,50"si tamamen kesiliyordu)
  const kesilen = await page.evaluate(() => {
    const kap = document.createElement('div');
    kap.style.cssText = 'position:fixed;left:0;top:0;width:416px;';
    document.body.appendChild(kap);
    const out = [];
    VE_FEAD_BELT_PROFILES.forEach((p) => VE_FEAD_BELT_BRANDS.forEach((b) => {
      const g = veFeadBeltGeom(p, b);
      if (!g.kalinlik) return;
      ['dw', 'db'].forEach((h) => {
        kap.innerHTML = veFeadKayisSekilSVG({ e: g.ribAdim, t: g.kalinlik, hb: g.hb, hr: g.hr }, { hesap: h });
        const s = kap.querySelector('svg').getBoundingClientRect();
        kap.querySelectorAll('text').forEach((t) => {
          const r = t.getBoundingClientRect();
          if (r.left < s.left - 0.5 || r.right > s.right + 0.5 || r.top < s.top - 0.5 || r.bottom > s.bottom + 0.5)
            out.push(p + b + ' ' + h + ' ' + t.textContent);
        });
      });
    }));
    kap.remove();
    return out;
  });
  expect(kesilen).toEqual([]);

  // aktarım: kayışın bölümünde seçilen (d_b) sihirbazın kayışına
  await page.locator('#ve-fw-3b-aktar').click();
  await expect(page.locator('#ve-fw-3b')).toBeHidden();
  expect(await page.evaluate(() => veFeadWizState().belt)).toMatchObject({ hbCad: 1.5, hrCad: 1.5, hesapCap: 'db' });
  expect(hatalar).toEqual([]);
});
