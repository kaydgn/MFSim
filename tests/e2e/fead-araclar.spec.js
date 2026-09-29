/**
 * fead-araclar.spec.js — FEAD ARAÇLARI PENCERESİ (gerçek tarayıcı)
 *
 * Kullanıcı kararı (2026-09-28, tasarım tezgâhı IV · A): *"A güzel. A'yı çok
 * beğendim. Onu yapalım."* Sihirbaz, Çözücü, Rapor ve Dönüş Yönü topolojide
 * kutu olmaktan çıktı; eylemleri tuvalin sol üstündeki yüzen pencerede.
 *
 * Node'da HİÇ koşmayan halkalar: pencerenin gerçek ölçüsü ve yeri, sığdırmanın
 * onu kadrajdan düşmesi (kart pencerenin ALTINDA kalmıyor), gerçek fareyle
 * taşıma → kesikli yuva → yapışma, çift tıkla katlama, gerçek tıkla Hesapla /
 * Yön / Ayarlar / Sihirbaz, ve kapsam dışında (ana topoloji) görünmemesi.
 * Birim tarafı: tests/unit/fead-araclar.test.js.
 */
const { test, expect } = require('@playwright/test');
const { motorluOrnekler } = require('./helpers/fead-motor');
test.setTimeout(180000);

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    try { localStorage.removeItem('mfsim.fead.araclar'); } catch (e) { /* yok */ }
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadAraclarKapsam === 'function' && Array.isArray(window.nodes),
    null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  // Gates örnekleri motorun devirlerini taşımıyor; işletme hesabı onlarsız
  // yapılmaz (FEAD kural 42) — katalog kaydının devir sınırları yazılır.
  await motorluOrnekler(page);
}

// FEAD'e gir, karşılama sihirbazını KAPAT (kullanıcı da öyle yapar).
async function feadAc(page) {
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-layout'), null, { timeout: 20000 });
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();
}

const pencere = (page) => page.locator('#ve-fead-araclar');
const govde = (page) => page.locator('#ve-fead-araclar .ve-fead-arac-govde');

// Kartların ekrandaki kutuları ↔ pencerenin kutusu.
const olc = (page) => page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom }; };
  const p = document.getElementById('ve-fead-araclar');
  const kap = document.getElementById('ve-canvas-wrapper');
  const kartlar = [...document.querySelectorAll('#ve-canvas .ve-node')].map(r);
  const pk = r(p);
  const ust = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  return {
    kap: r(kap), pen: pk, kartlar,
    ortu: p.getAttribute('data-ve-ortu'),
    cakisma: kartlar.filter((k) => ust(k, pk)).length,
    gorunur: !p.hidden && getComputedStyle(p).display !== 'none',
  };
});

test('YUVADA: sol üstte, kartların üstüne binmiyor; araçların kutusu yok', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1920, height: 952 });
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });
  await page.waitForTimeout(900);

  // Tuvalde kutu kuran tek FEAD tipi Kayış Yolu kartı.
  const kutular = await page.evaluate(() =>
    [...document.querySelectorAll('#ve-canvas .ve-node')].map((e) => e.getAttribute('data-type')).sort());
  expect(kutular).toEqual(['fead-layout', 'fead-layout']);
  for (const t of ['fead-solver', 'fead-report', 'fead-wizard', 'fead-belt']) {
    expect(await page.evaluate((x) => {
      const n = window.nodes.find((k) => k.type === x);
      return { var: !!n, dom: !!(n && document.getElementById(n.id)) };
    }, t)).toEqual({ var: true, dom: false });
  }
  // Palette araç yok — Kayış Yolu kaldı.
  expect(await page.locator('[data-type="fead-solver"], [data-type="fead-report"], [data-type="fead-wizard"], [data-type="fead-spin"]').count()).toBe(0);

  const o = await olc(page);
  expect(o.gorunur).toBe(true);
  expect(o.ortu).toBe('sol');
  // YUVA: kabın sol üstünden 12 px içeride.
  expect(Math.round(o.pen.x - o.kap.x)).toBe(12);
  expect(Math.round(o.pen.y - o.kap.y)).toBe(12);
  // SIĞDIRMA PENCEREYİ DÜŞTÜ: hiçbir kart pencerenin altında değil.
  expect(o.cakisma).toBe(0);
  o.kartlar.forEach((k) => expect(k.x).toBeGreaterThanOrEqual(o.pen.r));
  // Dört bölüm ve başlık pencere ailesinden.
  await expect(pencere(page).locator('.ve-settings-header')).toHaveCount(1);
  for (const b of ['model', 'cozum', 'rapor', 'yon'])
    await expect(govde(page).locator(`[data-bol="${b}"]`)).toHaveCount(1);
  expect(hatalar).toEqual([]);
});

test('Hesapla → Güncel + dört kart; Yön → Bayat, hüküm düşer; yeniden Hesapla', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length === 6,
    null, { timeout: 20000 });
  await page.waitForTimeout(600);

  const cip = govde(page).locator('[data-bol="cozum"] h4 .ve-fr-chip');
  await expect(cip).toHaveText('Sonuç yok');
  await govde(page).locator('[data-ey="hesapla"]').click();
  await expect(cip).toHaveText('Güncel');
  await expect(govde(page).locator('.ve-fead-arac-kpi > div')).toHaveCount(4);
  const huk = govde(page).locator('[data-bol="yon"] .ve-fead-arac-huk');
  await expect(huk).toHaveAttribute('data-d', 'ok');

  // YÖN: seçili olmayan seçeneğe GERÇEK tık — sıra çevrilir, sonuç bayatlar.
  const secili = govde(page).locator('[data-bol="yon"] [role="radio"][aria-checked="true"]');
  const once = await secili.getAttribute('data-v');
  await govde(page).locator('[data-bol="yon"] [role="radio"][aria-checked="false"]').click();
  await expect(secili).not.toHaveAttribute('data-v', once);
  await expect(cip).toHaveText('Bayat — model değişti');
  await expect(huk).toHaveCount(0);                     // eski yönün hükmü gösterilmez
  await expect(govde(page).locator('.ve-fead-arac-kpi.bayat')).toHaveCount(1);

  await govde(page).locator('[data-ey="hesapla"]').click();
  await expect(cip).toHaveText('Güncel');
  await expect(huk).toHaveAttribute('data-d', 'no');     // ters yön: gergi gergin tarafta
  expect(hatalar).toEqual([]);
});

test('Ayarlar Çözücü penceresini, Künye Rapor penceresini, Sihirbaz sihirbazı açar', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);

  // BOŞ topoloji: Hesapla pasif ve sebebini ipucunda taşıyor.
  const h = govde(page).locator('[data-ey="hesapla"]');
  await expect(h).toHaveAttribute('aria-disabled', 'true');
  await expect(h).toHaveAttribute('title', /Henüz kasnak yok/);

  await govde(page).locator('[data-ey="sihirbaz"]').click();
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();
  await page.evaluate(() => veFeadWizClose(false));
  await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();

  await govde(page).locator('[data-ey="ayarlar"]').click();
  await expect(page.locator('#ve-properties-title')).toContainText('Çözücü');
  await govde(page).locator('[data-ey="rapor"]').click();
  await expect(page.locator('#ve-properties-title')).toContainText('Rapor');
  expect(hatalar).toEqual([]);
});

test('TAŞI → serbest (örtü yok, yer hatırlanır); yuvaya yaklaş → yapışır; çift tık katlar', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1600, height: 900 });
  await bootApp(page);
  await feadAc(page);

  const bas = pencere(page).locator('.ve-fead-arac-bas');
  const b0 = await bas.boundingBox();
  const tut = { x: b0.x + 60, y: b0.y + b0.height / 2 };

  // 1) Uzağa taşı: serbest pencere tuvali örttüğünü SÖYLEMEZ; yer hatırlanır.
  await page.mouse.move(tut.x, tut.y);
  await page.mouse.down();
  await page.mouse.move(tut.x + 300, tut.y + 160, { steps: 12 });
  await expect(page.locator('.ve-fead-arac-yuva.goster')).toHaveCount(1);   // yuva görünür
  await page.mouse.up();
  let d = await page.evaluate(() => ({
    ortu: document.getElementById('ve-fead-araclar').getAttribute('data-ve-ortu'),
    yer: JSON.parse(localStorage.getItem('mfsim.fead.araclar') || 'null'),
    kayit: JSON.stringify(window.nodes).includes('katli'),
  }));
  expect(d.ortu).toBeNull();
  expect(d.yer.yuva).toBe(false);
  expect(d.yer.x).toBeGreaterThan(200);
  expect(d.kayit).toBe(false);                            // model temiz
  await expect(page.locator('.ve-fead-arac-yuva.goster')).toHaveCount(0);

  // 2) Yuvaya geri sürükle: yaklaşınca "yakın", bırakınca yapışır.
  const b1 = await bas.boundingBox();
  const t1 = { x: b1.x + 60, y: b1.y + b1.height / 2 };
  await page.mouse.move(t1.x, t1.y);
  await page.mouse.down();
  await page.mouse.move(t1.x - (b1.x - b0.x) + 8, t1.y - (b1.y - b0.y) + 6, { steps: 14 });
  await expect(page.locator('.ve-fead-arac-yuva.yakin')).toHaveCount(1);
  await page.mouse.up();
  d = await page.evaluate(() => {
    const p = document.getElementById('ve-fead-araclar');
    return { ortu: p.getAttribute('data-ve-ortu'), left: p.style.left, top: p.style.top };
  });
  expect(d).toEqual({ ortu: 'sol', left: '12px', top: '12px' });

  // 3) Başlığa çift tık: dar şerit — başlık ve dört eylem.
  await bas.dblclick({ position: { x: 40, y: 8 } });
  await expect(pencere(page)).toHaveClass(/katli/);
  const en = await pencere(page).evaluate((el) => el.offsetWidth);
  expect(en).toBeLessThanOrEqual(48);
  await expect(pencere(page).locator('.ve-fead-arac-ray [data-ey]')).toHaveCount(4);
  await expect(govde(page)).toBeHidden();
  // Katlı hâl hatırlanır ve MODELE girmez.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mfsim.fead.araclar')).katli)).toBe(true);
  await pencere(page).locator('.ve-fead-arac-katla').click();
  await expect(pencere(page)).not.toHaveClass(/katli/);
  expect(hatalar).toEqual([]);
});

test('KAPSAM: ana topolojide pencere YOK, FEAD’e dönünce geri gelir', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
  await expect(pencere(page)).toBeVisible();
  await page.evaluate(() => veFeadCloseEditor());
  await page.waitForTimeout(500);
  await expect(pencere(page)).toBeHidden();
  await page.evaluate(() => veFeadOpenEditor(window.nodes.find((n) => n.type === 'fead-analysis').id));
  await page.waitForTimeout(500);
  await expect(pencere(page)).toBeVisible();
  expect(hatalar).toEqual([]);
});

// ── SÜTUNSUZ AÇILIŞ (2026-09-28) ─────────────────────────────────────────────
// FEAD'de "Bileşenler" sütunu yok (components.js → noPalette) ve tuval FEAD'e
// girerken 220 px GENİŞLİYOR. Kayıtlı bir modele dönüşte kadraj sütun
// kalktıktan SONRA kurulmalı: kapsam senkronu sığdırmadan sonra koşsaydı
// kadraj dar tuvalle kurulur, sütun kalkınca içerik sola kayık kalırdı
// (cp-fead.js → veFeadOpenEditor). Ölçü: kartların ortası ile görünür alanın
// (pencerenin sağı) ortası arasındaki fark, ilk girişle yeniden girişte AYNI.
test('SÜTUNSUZ AÇILIŞ: kayıtlı modele dönüşte kadraj sütunsuz tuvale kurulur', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1920, height: 952 });
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });
  await page.waitForTimeout(900);
  const merkez = () => page.evaluate(() => {
    const wr = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
    const pen = document.getElementById('ve-fead-araclar');
    const ortu = pen && pen.getAttribute('data-ve-ortu') === 'sol' ? pen.getBoundingClientRect().right - wr.left : 0;
    let l = Infinity, r = -Infinity;
    document.querySelectorAll('#ve-canvas .ve-node').forEach((e) => {
      const b = e.getBoundingClientRect(); l = Math.min(l, b.left); r = Math.max(r, b.right);
    });
    return { dx: (l + r) / 2 - (wr.left + ortu + (wr.width - ortu) / 2),
             sutun: document.getElementById('ve-sidebar').offsetWidth, tuvalX: Math.round(wr.left) };
  });
  const ilk = await merkez();
  expect(ilk.sutun).toBe(0);
  await page.evaluate(() => veFeadCloseEditor());
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.getElementById('ve-sidebar').offsetWidth)).toBeGreaterThan(100);
  await page.evaluate(() => veFeadOpenEditor(window.nodes.find((n) => n.type === 'fead-analysis').id));
  await page.waitForTimeout(900);
  const yeni = await merkez();
  expect(yeni.sutun).toBe(0);
  expect(yeni.tuvalX).toBe(ilk.tuvalX);
  expect(Math.abs(yeni.dx - ilk.dx)).toBeLessThanOrEqual(2);
  expect(hatalar).toEqual([]);
});

// ── KANVAS (2026-09-28) — sütunun Kayış Yolu satırının yeri ─────────────────
// Sütun kartı farenin bıraktığı yere koyuyordu; düğmenin faresi yok, yer
// KURALDAN: sıranın sağı, en üstteki kartla aynı hiza. Gerçek tık, gerçek
// Ctrl+Z (tek adım), ve yeni kart görünür alanda (kadraj sığdırıldı).
test('KANVAS: pencerenin düğmesi kartı sıranın sağına ekler; tek geri-al adımı', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1920, height: 952 });
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });
  await page.waitForTimeout(900);
  const kartlar = () => page.evaluate(() => window.nodes.filter((n) => n.type === 'fead-layout')
    .map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.width })));
  const once = await kartlar();
  await govde(page).locator('[data-bol="model"] [data-ey="kanvas"]').click();
  await page.waitForTimeout(600);
  const sonra = await kartlar();
  expect(sonra).toHaveLength(3);
  const yeni = sonra.find((k) => !once.some((o) => o.id === k.id));
  expect(yeni.x).toBe(Math.max(...once.map((o) => o.x + o.w)) + 24);
  expect(yeni.y).toBe(Math.min(...once.map((o) => o.y)));
  // Görünür alanda ve pencerenin altında değil.
  const o = await olc(page);
  expect(o.cakisma).toBe(0);
  const kutu = await page.evaluate((id) => {
    const b = document.getElementById(id).getBoundingClientRect(); return { r: b.right, b: b.bottom };
  }, yeni.id);
  expect(kutu.r).toBeLessThanOrEqual(o.kap.r + 1);
  expect(kutu.b).toBeLessThanOrEqual(o.kap.b + 1);
  // Tek adım: Ctrl+Z yeni kartı bütünüyle geri alıyor.
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  expect((await kartlar()).map((k) => k.id).sort()).toEqual(once.map((k) => k.id).sort());
  expect(hatalar).toEqual([]);
});

// ── NOT ARAÇLARI (2026-09-28) — sütunun "Araçlar" kategorisinin yeri ────────
// Kullanıcı: *"Not araçlarını da FEAD araçları penceresine ekleyelim."* Node'da
// HİÇ koşmayan halkalar: gerçek HTML5 sürükle-bırak (jsdom DataTransfer
// üretmez), pencerenin üstüne bırakmanın REDDİ (`dropEffect` kabın iznini
// eziyor mu), tıkla kurulan notun gerçekten GÖRÜNMESİ (kartların arkasında ya
// da pencerenin altında değil), Ctrl+Z ve Delete'in yalnız notu alması.
test('NOT ARAÇLARI: tık kartları çevreler/üstüne yazar, sürükleme bırakılan yere, pencereye bırakılmaz', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1366, height: 768 });
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });
  await page.waitForTimeout(900);
  const oge = (v) => govde(page).locator(`[data-bol="not"] [data-ey="not"][data-v="${v}"]`);
  await expect(oge('frame')).toHaveText('Çerçeve');
  await expect(oge('text')).toHaveText('Yazı');
  // Son not: kutusu, etiketi, kartların ve pencerenin kutusu.
  const son = () => page.evaluate(() => {
    const r = (el) => { const q = el.getBoundingClientRect(); return { x: q.left, y: q.top, r: q.right, b: q.bottom }; };
    const a = annotations[annotations.length - 1];
    const el = document.getElementById(a.id);
    const lbl = el.querySelector('.ve-annotation-label, .ve-annotation-content');
    const kartlar = [...document.querySelectorAll('#ve-canvas .ve-node')].map(r);
    const pen = r(document.getElementById('ve-fead-araclar')), kap = r(document.getElementById('ve-canvas-wrapper'));
    const ust = (p, q) => p.x < q.r && q.x < p.r && p.y < q.b && q.y < p.b;
    const ic = (p, q) => p.x >= q.x && p.r <= q.r && p.y >= q.y && p.b <= q.b;
    const k = r(el), e = r(lbl);
    return { n: annotations.length, tip: a.type, secili: selectedAnnotations.indexOf(a) >= 0,
      secKart: selectedNodes.length, kapta: ic(e, kap), kartAlti: kartlar.some((q) => ust(e, q)),
      pencereAlti: ust(e, pen), cevreler: kartlar.every((q) => ic(q, k)), kutu: k };
  });

  // ── 1) TIK: çerçeve iki kartı ÇEVRELER, etiketi görünür, seçim yalnız onda ──
  await oge('frame').click();
  await page.waitForTimeout(250);
  expect(await son()).toMatchObject({ n: 1, tip: 'frame', secili: true, secKart: 0, kapta: true,
    kartAlti: false, pencereAlti: false, cevreler: true });
  // ── 2) TIK: yazı kartların üstünde, görünür ──
  await oge('text').click();
  await page.waitForTimeout(250);
  expect(await son()).toMatchObject({ n: 2, tip: 'text', secili: true, kapta: true, kartAlti: false, pencereAlti: false });

  // ── 3) SÜRÜKLE: yazı → kartların altındaki boşluk, bırakılan noktaya ──
  const hedef = await page.evaluate(() => {
    const ks = [...document.querySelectorAll('#ve-canvas .ve-node')].map((e) => e.getBoundingClientRect());
    const wr = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
    return { x: Math.min(...ks.map((k) => k.left)) + 60, y: Math.min(Math.max(...ks.map((k) => k.bottom)) + 40, wr.bottom - 20) };
  });
  const surukle = async (v, x, y) => {
    const bb = await oge(v).boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(x - 30, y - 30, { steps: 6 });
    await page.mouse.move(x, y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  await surukle('text', hedef.x, hedef.y);
  const s3 = await son();
  expect(s3).toMatchObject({ n: 3, tip: 'text' });
  expect(Math.abs(s3.kutu.x - hedef.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(s3.kutu.y - hedef.y)).toBeLessThanOrEqual(2);
  // ── 4) PENCEREYE BIRAKMA reddedilir (altında görünmez bir not kurulmaz) ──
  const pb = await govde(page).locator('[data-bol="model"]').boundingBox();
  await surukle('frame', pb.x + 80, pb.y + 20);
  expect((await son()).n).toBe(3);

  // ── 5) Ctrl+Z: sürüklenen yazı TEK adımda geri; Delete yalnız notu siler ──
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  expect((await son()).n).toBe(2);
  await oge('text').click();
  await page.waitForTimeout(250);
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => ({ kart: window.nodes.filter((n) => n.type === 'fead-layout').length, not: annotations.length })))
    .toEqual({ kart: 2, not: 2 });
  expect(hatalar).toEqual([]);
});
