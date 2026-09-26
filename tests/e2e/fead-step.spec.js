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
  // Boş FEAD topolojisi sihirbazla karşılar (FEAD kural 5)
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible({ timeout: 20000 });
}

test('STEP\'ten başla: .stpZ seç → 3B\'de parçaya tıklayıp rol ver → hesapla (halkalar) → aktar → künye → Modeli Kur', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1366, height: 768 });
  await feadAc(page);

  // ── 1) DOSYA SEÇ (gerçek File nesnesi, gzip) → 3B görüntüleyici AÇILIR ──
  const kart = page.locator('.ve-fw-stp');
  await expect(kart).toBeVisible();
  await page.locator('.ve-fw-stp-file').setInputFiles({
    name: 'AG00686.stpZ', mimeType: 'application/octet-stream', buffer: stpZ(O.ag00686Step()),
  });
  const satir = page.locator('.ve-fw-tbl-stp tr[data-ve-stp]');
  // Kartın ağacı (3B'nin arkasında): bütün parçalar (kayış dâhil), HİÇBİRİ rol almamış
  await expect(satir).toHaveCount(5, { timeout: 20000 });
  await expect(page.locator('.ve-fw-stp .ve-fw-seeded')).toContainText('sıkıştırılmış (gzip)');
  expect(await satir.locator('select').evaluateAll((l) => l.map((s) => s.value))).toEqual(['', '', '', '', '']);
  await expect(page.locator('#ve-fw-stp-hesapla')).toBeDisabled();
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
  // SIĞDIRMA montajın KENDİ noktalarıyla: eksene hizalı kutunun köşeleriyle
  // sığdırmak eğik bakışta modeli küçültüyordu (kullanıcının dosyasında tuvalin
  // %29'u). Ölçülen: örneklenmiş köşelerin izdüşümünün yarı genişliği (NDC) —
  // bu dosyada noktalarla 0,85, kutuyla 0,77; eşik ikisinin ortasında.
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
    return Math.max((x1 - x0) / 2, (y1 - y0) / 2);
  });
  let dol = await doluluk();
  expect(dol).toBeGreaterThan(0.81);
  expect(dol).toBeLessThan(1);
  // "Sığdır" düğmesi de aynı noktalarla: tekerlekle uzaklaş → sığdır
  const tuv0 = await page.locator('#ve-fw-3b-tuval').boundingBox();
  await page.mouse.move(tuv0.x + tuv0.width / 2, tuv0.y + tuv0.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(doluluk).toBeLessThan(0.6);
  await page.locator('.ve-fw-3b-bas button', { hasText: 'Sığdır' }).click();
  dol = await doluluk();
  expect(dol).toBeGreaterThan(0.81);
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
      gl.readPixels(Math.floor(w / 2) - 20, Math.floor(h / 2) - 20, 41, 41, gl.RGBA, gl.UNSIGNED_BYTE, px);
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
  await expect(yan.locator('.ve-fw-3b-rol[aria-pressed="true"]')).toHaveText('Rol yok');
  await yan.locator('.ve-fw-3b-rol[data-ve-3b-rol="fead-crank"]').click();
  await expect(yan.locator('.ve-fw-3b-rol[aria-pressed="true"]')).toContainText('Krank Kasnağı');
  for (const [re, tip] of [[/AVARA/, 'fead-idler'], [/KL[İI]MA/, 'fead-ac'], [/GERG[İI]/, 'fead-tensioner']]) {
    const p = await tikla(re);
    await page.mouse.click(p.n.x, p.n.y);
    await yan.locator('.ve-fw-3b-rol[data-ve-3b-rol="' + tip + '"]').click();
  }
  await expect(yan).toContainText('Rol verilenler 4');
  // Boşluğa tıklamak seçimi kaldırır (tuvalin sol üst köşesi)
  const tuv = await page.locator('#ve-fw-3b-tuval').boundingBox();
  await page.mouse.click(tuv.x + 12, tuv.y + 12);
  await expect(yan).toContainText('Modelde bir parçaya tıklayın');
  // Rol KARTLA ORTAK: kartın ağacında aynı roller
  const adSatiri = (ad) => satir.filter({ has: page.locator('td:first-child', { hasText: new RegExp(ad) }) });
  await expect(adSatiri('KRANK').locator('select')).toHaveValue('fead-crank');
  await expect(adSatiri('GERGİ').locator('select')).toHaveValue('fead-tensioner');

  // ── 3) HESAPLA (3B'de): dört halka, gergi kolu, sayı tablosu ─────────────
  await page.locator('#ve-fw-3b-hesapla').click();
  await expect(yan).toContainText('✓ 4 kasnak');
  expect((await page.evaluate(() => veFeadWiz3bDurum())).halka).toBe(4);
  const capler = await yan.locator('tr[data-ve-3b-kasnak] td:nth-child(2)').allInnerTexts();
  expect(capler.map((t) => +t.replace(',', '.')).sort((a, b) => a - b)).toEqual([75, 75, 127, 160]);
  await expect(page.locator('#ve-fw-3b-onden')).toBeEnabled();

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

  // Rol değişince sonuç düşer — halkalar gider, yeniden hesaplanır
  const klima = await tikla(/KL[İI]MA/);
  await page.mouse.click(klima.n.x, klima.n.y);
  await yan.locator('.ve-fw-3b-rol[data-ve-3b-rol="fead-alternator"]').click();
  expect((await page.evaluate(() => veFeadWiz3bDurum())).halka).toBe(0);
  await yan.locator('.ve-fw-3b-rol[data-ve-3b-rol="fead-ac"]').click();
  await page.locator('#ve-fw-3b-hesapla').click();
  // Hesap seçimi kaldırır: seçim öteki kasnakları soldururdu, halkalar hepsinde okunmalı
  expect(await page.evaluate(() => veFeadWiz3bDurum())).toMatchObject({ halka: 4, secili: -1 });

  // TEK ESC TEK KATMAN: yalnız 3B kapanır, sihirbaz ve kartın çizimi yerinde
  await page.keyboard.press('Escape');
  await expect(page.locator('#ve-fw-3b')).toBeHidden();
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();
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
  expect(st.belt).toEqual({ profile: 'PK', brand: 'GATES', ribs: 8 });   // kayışa dokunulmadı
  expect(st.sira).toBe('agac');

  // ── 5) KASNAKLAR: sıra uyarısı ve onayı ─────────────────────────────────
  await page.locator('.ve-fw-steps li').nth(1).click();
  await expect(page.locator('#ve-fw-issue')).toContainText('STEP ağacından');
  await expect(page.locator('.ve-fw-steps li').nth(1)).toHaveClass(/ve-fw-st-(warn|err)/);
  await page.locator('#ve-fw-sira-onay').click();
  await expect(page.locator('#ve-fw-issue')).not.toContainText('STEP ağacından');
  await expect(page.locator('#ve-fw-sira-onay')).toHaveCount(0);

  // ── 6) GERGİ: künye seç → model çözülür ─────────────────────────────────
  await page.locator('.ve-fw-steps li').nth(2).click();
  await page.locator('.ve-fw-card select').first().selectOption('AG00686');
  await expect(page.locator('.ve-fw-pill-ok')).toBeVisible({ timeout: 10000 });
  const b = await page.evaluate(() => {
    const r = veFeadWizBuild();
    return { ok: r.ok, spin: r.spin, n: r.order.length };
  });
  expect(b).toEqual({ ok: true, spin: -1, n: 4 });

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
  await yan.locator('.ve-fw-3b-rol[data-ve-3b-rol="fead-tensioner"]').click();
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
  await yan.locator('.ve-fw-3b-rol[data-ve-3b-rol="fead-crank"]').click();
  await page.locator('#ve-fw-3b-hesapla').click();
  await expect(yan).toContainText('✓ 2 kasnak');
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
