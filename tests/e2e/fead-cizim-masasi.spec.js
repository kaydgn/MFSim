/**
 * fead-cizim-masasi.spec.js — ÇİZİM MASASI GERÇEK TARAYICIDA
 *
 * Kullanıcı kararı (2026-09-23): *"Çizim Masası çok güzel."* Kayış Yolu
 * kartının çizimi giriş yüzeyi: kasnağa tıklamak penceresini açar,
 * sürüklemek konumunu yazar, ok tuşu 1 mm kaydırır, paletten kayışın üstüne
 * bırakılan kasnak iki komşunun arasına girer.
 *
 * NODE'DA HİÇ KOŞMAYAN HALKALAR — bu dosyanın varlık sebebi:
 *   • gerçek fare zinciri (mousedown → mousemove → mouseup) ve kanvasın
 *     YAKINLAŞTIRMASI altında ekran → mm köprüsü (`getScreenCTM`),
 *   • sürükleme boyunca ölçeğin donması (imleç kasnaktan kaçmasın),
 *   • HTML5 sürükle-bırak (`dragover` / `drop`) — jsdom hiç üretmez,
 *   • gerçek klavye olayı ve Ctrl+Z'nin `restoreState`i.
 * Mantığın birim kapıları: `tests/unit/fead-cizim-masasi.test.js`.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function ornek(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });
  await page.waitForTimeout(900);
}

// Bir kasnağın GEOMETRİ kartındaki isabet halkasının ekran merkezi.
const halka = (page, ad) => page.evaluate((a) => {
  const n = window.nodes.find((x) => x.customName === a);
  const kart = window.nodes.find((x) => x.type === 'fead-layout' && !(x.data || {}).katOn);
  const c = document.querySelector('#' + kart.id + ' g[data-ve="hit"] circle[data-fead-k="' + n.id + '"]');
  const r = c.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: n.id, kart: kart.id };
}, ad);
const veri = (page, id) => page.evaluate((i) => {
  const d = window.nodes.find((x) => x.id === i).data;
  return { x: d.x, y: d.y, cenX: d.cenX, cenY: d.cenY };
}, id);
const ondalik = (v) => Math.round(v * 10) / 10;

test('SÜRÜKLE: konum girdisi imleçle birlikte yazılır, tek geri-al adımı', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await ornek(page);
  const h = await halka(page, 'Alternatör (155 A)');
  const once = await veri(page, h.id);
  const undo0 = await page.evaluate(() => undoStack.length);
  const s = await page.evaluate((k) => {
    const svg = document.querySelector('#' + k + ' .ve-fead-kanvas svg[data-fead-xf]');
    // ekran px → mm: çizicinin ölçeği × SVG'nin EKRAN MATRİSİ (viewBox'ın
    // `meet` ölçeği + kanvasın yakınlaştırması; ürünün ters köprüsüyle aynı
    // kaynak). Genişlik oranı yalnız genişlikle sınırlı kutuda doğru: tablolu
    // kartta çizim yükseklikle sınırlı ve oran %0,4 sapıyordu (102,7 mm'de
    // 0,55 mm).
    return +svg.getAttribute('data-fead-xf').split(' ')[0] * svg.getScreenCTM().a;
  }, h.kart);

  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + 20, h.y - 10, { steps: 4 });
  await page.mouse.move(h.x + 40, h.y - 20, { steps: 4 });
  // SÜRÜKLERKEN künye ekranda: konum ve iki komşu açıklığın boyu.
  const kunye = await page.evaluate((k) => ({
    konum: (document.querySelector('#' + k + ' [data-ve="drag-readout"]') || {}).textContent || '',
    aciklik: document.querySelectorAll('#' + k + ' [data-ve="drag-span"]').length,
    imlec: getComputedStyle(document.body).cursor }), h.kart);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const sonra = await veri(page, h.id);

  expect(kunye.konum).toMatch(/^X -?\d+\.\d · Y -?\d+\.\d mm$/);
  expect(kunye.aciklik).toBe(2);
  expect(kunye.imlec).toBe('grabbing');
  // İMLEÇLE BİRLİKTE: 40 px sağa, 20 px yukarı = +40/s mm x, +20/s mm y (y YUKARI).
  expect(sonra.x - once.x).toBeCloseTo(40 / s, 0);
  expect(sonra.y - once.y).toBeCloseTo(20 / s, 0);
  expect(sonra.x).toBe(ondalik(sonra.x));           // 0,1 mm ızgarası
  // BİR HAMLE = BİR ADIM, ve Ctrl+Z hamlenin TAMAMINI geri alıyor.
  expect(await page.evaluate(() => undoStack.length)).toBe(undo0 + 1);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  const geri = await veri(page, h.id);
  expect(geri.x).toBe(once.x);
  expect(geri.y).toBe(once.y);
  expect(hatalar).toEqual([]);
});

test('SÜRÜKLE: kayışı koparan konum YAZILMAZ ve sebebi söylenir', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await ornek(page);
  const avara = await halka(page, 'Avara 1');
  const krank = await halka(page, 'Sürücü Kasnak (FAN)');
  const once = await veri(page, avara.id);

  await page.mouse.move(avara.x, avara.y);
  await page.mouse.down();
  await page.mouse.move(krank.x, krank.y, { steps: 12 });
  await page.waitForTimeout(150);
  const serit = await page.evaluate((k) =>
    (document.querySelector('#' + k + ' .ve-fead-kan-durum') || {}).textContent || '', avara.kart);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const sonra = await veri(page, avara.id);

  expect(serit).toMatch(/Buraya taşınamaz — /);
  // Kasnak krankın üstüne İNMEDİ: son geçerli yerinde kaldı.
  expect(Math.hypot(sonra.x, sonra.y)).toBeGreaterThan(40);
  expect(await page.evaluate(() => veFeadYolDurumu(veFeadBuildFromCanvas(), 'mean').ok)).toBe(true);
  expect(sonra).not.toEqual(once);                  // geçerli kısmı YAZILDI
  expect(hatalar).toEqual([]);
});

test('TIKLA: pencere açılır, kasnak iki çizimde de işaretli; GERGİDE avara merkezi oynar', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await ornek(page);
  const g = await halka(page, 'Otomatik Gergi (E9843)');
  await page.mouse.click(g.x, g.y);
  await page.waitForTimeout(300);
  const acik = await page.evaluate((id) => ({
    pencere: getComputedStyle(document.getElementById('ve-properties-overlay')).display !== 'none',
    secili: (window.selectedNodes || []).map((n) => n.id),
    isaret: document.querySelectorAll('.ve-fead-kanvas circle[data-ve="pulley"][data-fead-k="' + id + '"].is-sel').length,
  }), g.id);
  expect(acik.pencere).toBe(true);
  expect(acik.secili).toEqual([g.id]);
  expect(acik.isaret).toBe(2);                      // iki çizimde de

  // KLAVYE: pencere kapalıyken ok tuşu SEÇİLİ kasnağı kaydırır. Gergide
  // girdi avara MERKEZİ (cenX/cenY) — montaj konumu ondan TÜRER.
  await page.evaluate(() => veTogglePropertiesPanel(false));
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  const once = await veri(page, g.id);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowUp');
  await page.waitForTimeout(250);
  const sonra = await veri(page, g.id);
  expect(sonra.cenX).toBeCloseTo(once.cenX + 1, 6);  // ADIM TAM, ızgaraya yuvarlanmıyor
  expect(sonra.cenY).toBeCloseTo(once.cenY + 10, 6);
  expect(hatalar).toEqual([]);
});

// Ölçüldü (2026-09-23): (1) imzaya girmeyen bir düzenlemenin (katman) geri
// alınması, kasnaklardan ÖNCE gelen kartı "henüz kasnak yok"a düşürüyordu;
// (2) bir geri-al'dan sonraki ok tuşu yığındaki kaydı da değiştiriyordu ve
// sonraki Ctrl+Z koordinatı geri getirmiyordu. Mekanizma geri-al-yolu.test.js'te.
test('CTRL+Z: çizim kartı boşalmaz, geri-al üst üste de geri alır', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await ornek(page);
  const kartlar = () => page.evaluate(() => window.nodes.filter((n) => n.type === 'fead-layout')
    .map((n) => (document.querySelector('#' + n.id + ' .ve-fead-kan-bos') ? 'BOŞ' : 'çizim')));
  const odaksiz = () => page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  // Ön koşul: açılış kartı yeniden kullanıldığı için kart kasnaklardan ÖNCE.
  expect(await page.evaluate(() => window.nodes.findIndex((n) => n.type === 'fead-layout')
    < window.nodes.findIndex((n) => (componentDefs[n.type] || {}).isFeadPulley))).toBe(true);

  await page.evaluate(() => {
    veFeadKatmanSet(window.nodes.find((n) => n.type === 'fead-layout').id, 'ok', false);
  });
  await odaksiz();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  expect(await kartlar()).toEqual(['çizim', 'çizim']);

  const h = await halka(page, 'Alternatör (155 A)');
  const x0 = (await veri(page, h.id)).x;
  for (let tur = 1; tur <= 2; tur++) {
    const c = await halka(page, 'Alternatör (155 A)');   // geri-al seçimi temizliyor
    await page.mouse.click(c.x, c.y);
    await page.evaluate(() => veTogglePropertiesPanel(false));
    await odaksiz();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    expect((await veri(page, h.id)).x).toBeCloseTo(x0 + 1, 6);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    expect({ tur, x: (await veri(page, h.id)).x }).toEqual({ tur, x: x0 });
  }
  expect(await kartlar()).toEqual(['çizim', 'çizim']);
  expect(hatalar).toEqual([]);
});

// Paletten HTML5 sürükle-bırak: kaynak öğe → çizimde bir nokta.
async function birak(page, tip, hedef, olcIz) {
  const src = page.locator('.ve-component[data-type="' + tip + '"]').first();
  await src.scrollIntoViewIfNeeded();
  const bb = await src.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hedef.x - 30, hedef.y - 30, { steps: 5 });
  await page.mouse.move(hedef.x, hedef.y, { steps: 5 });
  let iz = null;
  if (olcIz) iz = await page.evaluate(() => {
    const g = document.querySelector('[data-ve="birak-iz"]');
    if (!g) return null;
    const l = g.querySelector('line'), t = g.querySelector('text');
    return { cizgi: l && l.getAttribute('class'), yazi: t ? t.textContent : '' };
  });
  await page.mouse.up();
  await page.waitForTimeout(450);
  return iz;
}
// Açıklık i'nin ortasının ekran koordinatı (geometri kartında).
const aciklik = (page, i) => page.evaluate((k) => {
  const kart = window.nodes.find((x) => x.type === 'fead-layout' && !(x.data || {}).katOn);
  const svg = document.querySelector('#' + kart.id + ' .ve-fead-kanvas svg[data-fead-xf]');
  const [s, ox, oy, mx, my] = svg.getAttribute('data-fead-xf').split(' ').map(Number);
  const b = veFeadBuildFromCanvas();
  const sp = FEADCore.tensionerState(b.sys, FEADCore.meanRel(b.sys)).geom.spans[k];
  const pt = svg.createSVGPoint();
  pt.x = ox + ((sp.Pi[0] + sp.Pj[0]) / 2 - mx) * s;
  pt.y = oy + (my - (sp.Pi[1] + sp.Pj[1]) / 2) * s;
  const q = pt.matrixTransform(svg.getScreenCTM());
  return { x: q.x, y: q.y, N: b.order.length,
           sol: b.order[k].id, sag: b.order[(k + 1) % b.order.length].id };
}, i);

test('PALETTEN BIRAK: açıklığa girer, kapalı açıklık ve boşluk REDDEDİLİR', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await ornek(page);
  const sira = () => page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.id));
  const once = await sira();

  // ── 1) AÇIKLIĞA: iz hedefi söylüyor, kasnak iki komşunun ARASINA düşüyor ──
  const a = await aciklik(page, 3);
  const iz = await birak(page, 'fead-idler', a, true);
  expect(iz).toEqual({ cizgi: 'hedef', yazi: expect.stringMatching(/ ↔ /) });
  const sonra = await sira();
  expect(sonra).toHaveLength(once.length + 1);
  const yeni = sonra.find((x) => !once.includes(x));
  expect(sonra.indexOf(yeni)).toBe(sonra.indexOf(a.sol) + 1);
  expect(sonra.indexOf(a.sag)).toBe(sonra.indexOf(yeni) + 1);
  expect(sonra[sonra.length - 1]).toBe(once[once.length - 1]);   // gergi SONDA
  expect(await page.evaluate(() => veFeadYolDurumu(veFeadBuildFromCanvas(), 'mean').ok)).toBe(true);
  // TEK ADIM: Ctrl+Z eklenen kasnağı bütünüyle geri alıyor.
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); veTogglePropertiesPanel(false); });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  expect(await sira()).toEqual(once);

  // ── 2) GERGİ ↔ SÜRÜCÜ AÇIKLIĞI KAPALI: iz kırmızı, kasnak girmiyor ───────
  const k = await aciklik(page, once.length - 1);
  const izK = await birak(page, 'fead-idler', k, true);
  expect(izK.cizgi).toBe('kapali');
  expect(await sira()).toEqual(once);

  // ── 3) ÇİZİMDE AMA KAYIŞTAN UZAK: eklenmiyor ─────────────────────────────
  const uzak = await page.evaluate(() => {
    const kart = window.nodes.find((x) => x.type === 'fead-layout' && !(x.data || {}).katOn);
    const r = document.querySelector('#' + kart.id + ' .ve-fead-kanvas').getBoundingClientRect();
    return { x: r.left + 30, y: r.top + 60 };
  });
  await birak(page, 'fead-alternator', uzak, false);
  expect(await sira()).toEqual(once);
  expect(await page.evaluate(() => document.querySelectorAll('[data-ve="birak-iz"]').length)).toBe(0);

  // ── 4) ÇİZİMİN DIŞINA: tablonun ekleyicisi — eklenen satır Paftada ─────
  // Geometri kartının tablosu zaten açık; kapalı olsaydı ekleyici açardı
  // (birim kapısı: fead-cizim-masasi.test.js).
  await birak(page, 'fead-waterpump', { x: 1500, y: 950 }, false);
  const dis = await sira();
  expect(dis).toHaveLength(once.length + 1);
  const pafta = page.locator('.ve-fead-pafta');
  await expect(pafta).toBeVisible();
  await expect(pafta.locator('tr[data-ve-node]')).toHaveCount(once.length + 1);
  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  KAYIŞ ÇİZİMDE TIKLANIR (2026-09-26) — "Kayış Özellikleri" kutusu kalktı
// ═══════════════════════════════════════════════════════════════════════════
// Kullanıcı isteği: *"'kayış özellikleri' bileşenini de kaldırmanı istiyorum.
// Onun yerine kanvas üzerindeki kayış tıklanabilir olacak tıpkı diğer
// bileşenler gibi."* Node'da HİÇ koşmayan halkalar: görünmez isabet yolunun
// gerçek fareyi alması (`pointer-events="stroke"` + saydam çizgi), `:hover`
// yerine sınıfla yanan hale, mousedown'ın kartın sürüklemesini durdurması ve
// kökteki Delete dinleyicisinin silinmez tipi ayıklaması.
test('KAYIŞA TIKLA: Kayış Özellikleri açılır — kutusu yok, silinmez, iki çizimde işaretli', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await ornek(page);
  const on = await page.evaluate(() => {
    const b = window.nodes.find((n) => n.type === 'fead-belt');
    return { palet: document.querySelectorAll('.ve-component[data-type="fead-belt"]').length,
             kutu: !!document.getElementById(b.id) };
  });
  expect(on).toEqual({ palet: 0, kutu: false });           // palette yok, kanvasta kutusu yok

  // Kayışın bir AÇIKLIĞININ ortası — kasnak halkasından uzak.
  const a = await aciklik(page, 1);
  await page.mouse.move(a.x, a.y);
  await page.waitForTimeout(250);
  const hov = await page.evaluate((p) => {
    const e = document.elementFromPoint(p.x, p.y);
    return { hale: +getComputedStyle(document.querySelector('[data-ve="belt-hov"]')).opacity,
             hedef: e && e.getAttribute('class'), imlec: e && getComputedStyle(e).cursor };
  }, a);
  expect(hov.hedef).toMatch(/ve-fead-hit-kayis/);
  expect(hov.imlec).toBe('pointer');
  expect(hov.hale).toBeGreaterThan(0);

  const kartYeri = () => page.evaluate(() => {
    const k = window.nodes.find((x) => x.type === 'fead-layout' && !(x.data || {}).katOn);
    return [k.x, k.y];
  });
  const once = await kartYeri();
  await page.mouse.click(a.x, a.y);
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const ov = document.getElementById('ve-properties-overlay');
    return {
      secili: window.selectedNodes.map((n) => n.type),
      acik: !!ov && getComputedStyle(ov).display !== 'none',
      baslik: document.getElementById('ve-properties-title').textContent.trim(),
      cop: ov.querySelectorAll('.ve-prop-del').length,
      isaret: [...document.querySelectorAll('.ve-node[data-type="fead-layout"]')]
        .map((k) => k.querySelectorAll('path[data-ve="belt"].is-sel').length),
    };
  });
  expect(r.secili).toEqual(['fead-belt']);
  expect(r.acik).toBe(true);
  expect(r.baslik).toContain('Kayış Özellikleri');
  expect(r.cop).toBe(0);                                    // silinmez tip çöp kutusu göstermez
  expect(r.isaret).toEqual([1, 1]);                         // iki çizimde de seçili
  expect(await kartYeri()).toEqual(once);                   // tık kartı SÜRÜKLEMEDİ

  // DELETE kayışı silmez, sebebini söyler.
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.nodes.filter((n) => n.type === 'fead-belt').length)).toBe(1);
  expect((await page.locator('.ve-toast, [class*="toast"]').allInnerTexts()).join(' ')).toMatch(/silinmez/);

  // İKİNCİ YOL: paftanın başlığındaki kayış künyesi.
  await page.evaluate(() => { veTogglePropertiesPanel(false); clearSelection(); });
  await page.waitForTimeout(200);
  await page.locator('.ve-fead-pafta [data-ve="kayis-kunye"]').first().click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.selectedNodes.map((n) => n.type))).toEqual(['fead-belt']);
  expect(hatalar).toEqual([]);
});
