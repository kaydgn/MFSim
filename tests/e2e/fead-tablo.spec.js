/**
 * fead-tablo.spec.js — KAYIŞ TABLOSU (PAFTA) GERÇEK TARAYICIDA
 *
 * Kullanıcı kararı (2026-09-26, tasarım tezgâhı III → "A · Pafta"): Kayış Yolu
 * kartı bir Gates sayfası — çizim üstte, Layout Data altında — ve tablolu kart
 * öteki karttan GENİŞ ("daha rahat okunsun tablodakiler"). Çekmece (tuvalin
 * altı) emekli: kasnak ile satırı arası 659–785 px'ti, açılınca tuval
 * 870 → 604 px'e kısalıyordu (1920×952, AG00810).
 *
 * Birim testler satırları, sütun kimliklerini, boy sabitlerini ve göçü Node'da
 * doğruluyor (`fead-table.test.js`). Buradaki soru: YÜZEY ayakta mı? Node'da
 * HİÇ koşmayan halkalar —
 *
 *   • tablonun kartın İÇİNDE, çizimin altında ve çubuğun üstünde durması,
 *   • gerçek bir `<input>`a yazıp `change` tetiklemek, Sekme ve Enter,
 *   • satır okuna / yön düğmesine / ✕'e GERÇEK tıklamak,
 *   • "Tablo" düğmesinin kartı genişletip daraltması (komşu kayar),
 *   • `:hover` / `:focus` durumlarının hesaplanması (jsdom hesaplamaz).
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

// FEAD iç topolojisini aç ve KARŞILAMA SİHİRBAZINI kapat. Kapatma ADIMI DA
// BİR KAPI: sihirbaz kapanmazsa modal kanvası örter ve hiçbir yere tıklanamaz.
async function feadAc(page) {
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.waitForTimeout(200);
  await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();
}

async function bootApp(page) {
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
}

// Örneği kur: tablo geometri kartında KENDİLİĞİNDEN açık (ön ayarın tablosu).
async function ornek(page, key) {
  await bootApp(page);
  await feadAc(page);
  await page.evaluate((k) => veFeadLoadExample(k), key || 'AG00976_GATES_2025');
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.mouse.move(2, 2);
  const kart = page.locator('.ve-node[data-type="fead-layout"]').first();
  const tablo = kart.locator('.ve-fead-pafta');
  await expect(tablo.locator('tr[data-ve-node]')).toHaveCount(6);
  return { kart, tablo };
}
const kartlar = (page) => page.evaluate(() => window.nodes.filter((n) => n.type === 'fead-layout')
  .map((n) => ({ id: n.id, x: n.x, w: n.width, tablo: n.data.tablo,
                 paf: !!document.querySelector('#' + n.id + ' .ve-fead-pafta') })));

test('PAFTA: kartın altında — yazılır, Sekme/Enter, sıra, yön, sil/ekle, Tablo düğmesi', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  const { kart, tablo } = await ornek(page);

  // ── 1) TABLO KARTIN İÇİNDE — kanvasta tablo düğümü, çekmece, kutu YOK ─────
  const yapi = await page.evaluate(() => {
    const kas = (n) => !!(componentDefs[n.type] || {}).isFeadPulley;
    return {
      tabloDugum: window.nodes.filter((n) => n.type === 'fead-table').length,
      cekmece: !!document.getElementById('ve-fead-tablo'),
      kasnakDom: window.nodes.filter(kas).filter((n) => document.getElementById(n.id)).length,
      pafta: document.querySelectorAll('.ve-fead-pafta').length,
      dugme: document.querySelectorAll('.ve-fead-tablo-dugme').length,
      basili: document.querySelectorAll('.ve-fead-tablo-dugme[aria-pressed="true"]').length,
    };
  });
  expect(yapi).toEqual({ tabloDugum: 0, cekmece: false, kasnakDom: 0, pafta: 1, dugme: 2, basili: 1 });

  // ── 2) YERİ: çizimin ALTINDA, çubuğun ÜSTÜNDE, kartın İÇİNDE ─────────────
  const yer = await kart.evaluate((el) => {
    const R = (e) => e.getBoundingClientRect();
    const k = R(el), p = R(el.querySelector('.ve-fead-pafta')), s = R(el.querySelector('.ve-fead-kanvas svg'));
    const c = R(el.querySelector('.ve-fead-yuz'));
    return { icinde: p.left >= k.left - 1 && p.right <= k.right + 1 && p.top >= k.top && p.bottom <= k.bottom,
             cizimUstte: s.bottom <= p.top + 0.5, cubukAltta: c.top >= p.bottom - 0.5,
             kaydirma: el.querySelector('.ve-fead-pf-kay').scrollHeight - el.querySelector('.ve-fead-pf-kay').clientHeight };
  });
  expect(yer.icinde).toBe(true);
  expect(yer.cizimUstte).toBe(true);                // çizim tablonun arkasına uzanmıyor
  expect(yer.cubukAltta).toBe(true);                // çubuk tabloyu örtmüyor
  expect(yer.kaydirma).toBeLessThanOrEqual(0);      // altı satır kaydırmasız

  // ── 3) BAŞLIKLAR KISA, DEFTERİN ADI `title`DA ───────────────────────────
  const govde = await tablo.evaluate((el) => el.textContent);
  ['Ø eff', 'Sarım', 'Span', 'Layout Data'].forEach((t) => expect(govde).toContain(t));
  const ipuclari = await tablo.evaluate((el) =>
    [...el.querySelectorAll('[title]')].map((e) => e.getAttribute('title')).join(' | '));
  ['Efektif Çap (mm)', 'Sarım Açısı (°)', 'Span Uzunluğu (mm)', 'Kasnak Dönüş Yönü']
    .forEach((t) => expect(ipuclari).toContain(t));

  // ── 4) GERÇEK BİR HÜCREYE YAZMAK MODELİ DEĞİŞTİRİYOR (virgül dâhil) ─────
  const once = await page.evaluate(() => {
    const alt = window.nodes.find((n) => n.type === 'fead-alternator');
    return { L: veFeadBuildFromCanvas().beltLengthMm, altId: alt.id };
  });
  const dHucre = tablo.locator('tr[data-ve-node]', { hasText: 'Alternatör' }).locator('td.k-od input');
  await dHucre.fill('63,5');
  await dHucre.dispatchEvent('change');
  await page.waitForTimeout(200);
  const sonra = await page.evaluate((id) => ({
    od: window.nodes.find((x) => x.id === id).data.od, L: veFeadBuildFromCanvas().beltLengthMm }), once.altId);
  expect(sonra.od).toBeCloseTo(63.5, 6);
  expect(sonra.L).not.toBeCloseTo(once.L, 3);

  // ── 5) SEKME SAĞA, ENTER AŞAĞI — odak tazelemede düşmüyor ───────────────
  const satirAd = (ad) => tablo.locator('tr[data-ve-node]', { hasText: ad }).first();
  await satirAd('Avara 1').locator('td.k-x input').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('131,5');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(250);
  const odak = () => page.evaluate(() => {
    const a = document.activeElement;
    return { tabloda: !!(a && a.closest && a.closest('.ve-fead-pafta')),
             hucre: a && a.closest('td') && a.closest('td').className,
             satir: a && a.closest('tr') && a.closest('tr').getAttribute('data-ve-node') };
  });
  const o1 = await odak();
  expect(o1.tabloda).toBe(true);
  expect(o1.hucre).toMatch(/k-y/);                  // X'ten sonra Y
  expect(await page.evaluate(() =>
    window.nodes.find((n) => n.customName === 'Avara 1').data.x)).toBeCloseTo(131.5, 6);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('140');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const o2 = await odak();
  const sira = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.id));
  const avaraId = await page.evaluate(() => window.nodes.find((n) => n.customName === 'Avara 1').id);
  expect(o2.hucre).toMatch(/k-y/);                  // AYNI sütun…
  expect(o2.satir).toBe(sira[sira.indexOf(avaraId) + 1]);   // …bir ALT satır
  expect(await page.evaluate(() =>
    window.nodes.find((n) => n.customName === 'Avara 1').data.y)).toBeCloseTo(140, 6);
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });

  // ── 6) SATIR OKU SIRAYI DEĞİŞTİRİYOR; SÜRÜCÜ KİLİTLİ ───────────────────
  const siraOnce = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.customName));
  const s2 = tablo.locator('tr[data-ve-node]').nth(2);
  await s2.hover();
  await s2.locator('button[title*="yukarı"]').click();
  await page.waitForTimeout(200);
  const siraSonra = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.customName));
  expect(siraSonra[0]).toBe(siraOnce[0]);
  expect(siraSonra[1]).toBe(siraOnce[2]);
  const ilk = tablo.locator('tr[data-ve-node]').first();
  await expect(ilk.locator('button.ve-fead-tbl-mv[disabled]')).toHaveCount(2);
  await expect(ilk.locator('.ve-fead-pf-no.drv')).toHaveCount(1);

  // ── 7) DÖNÜŞ YÖNÜ: yazı düğme, tık öteki yöne — `contact` + efektif çap ─
  const avara = () => satirAd('Avara 1');
  const eff = async () => parseFloat(await avara().locator('td.k-eff').innerText());
  const effOnce = await eff();
  await expect(avara().locator('button.ve-fead-pf-yon')).toHaveAttribute('data-yon', 'Sol');
  await avara().locator('button.ve-fead-pf-yon').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() =>
    window.nodes.find((n) => n.customName === 'Avara 1').data.contact)).toBe('grooved');
  await expect(avara().locator('button.ve-fead-pf-yon')).toHaveAttribute('data-yon', 'Sağ');
  expect(await eff()).toBeCloseTo(effOnce + 0.2, 3);              // 2·hr → 2·hb, GATES PK

  // ── 8) SATIR SİL / EKLE — gerginin ✕'i PASİF ───────────────────────────
  await expect(tablo.locator('tr.ten button.ve-fead-tbl-del')).toBeDisabled();
  const silOnce = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.customName));
  const s3 = tablo.locator('tr[data-ve-node]').nth(3);
  await s3.hover();
  await s3.locator('button.ve-fead-tbl-del').click();
  await page.waitForTimeout(250);
  const silSonra = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.customName));
  expect(silSonra).toHaveLength(silOnce.length - 1);
  expect(silSonra).not.toContain(silOnce[3]);
  await tablo.locator('select[data-ve="add-pulley"]').selectOption('fead-waterpump');
  await page.waitForTimeout(300);
  const ek = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.type));
  expect(ek[ek.length - 1]).toBe('fead-tensioner');               // GERGİ SONDA
  expect(ek[ek.length - 2]).toBe('fead-waterpump');               // yeni ONUN ÖNÜNDE

  // ── 9) TABLO DÜĞMESİ: kart daralır, SAĞDAKİ kart kayar; açınca geri ────
  const k0 = await kartlar(page);
  expect(k0.map((k) => k.w)).toEqual([640, 440]);                 // tablolu kart GENİŞ
  await kart.locator('.ve-fead-tablo-dugme').click();
  await page.waitForTimeout(250);
  const k1 = await kartlar(page);
  expect(k1[0]).toMatchObject({ w: 440, paf: false, tablo: 0 });
  expect(k1[1].x).toBe(k0[1].x - 200);
  expect(await kart.locator('.ve-fead-tablo-dugme').getAttribute('aria-pressed')).toBe('false');
  await kart.locator('.ve-fead-tablo-dugme').click();
  await page.waitForTimeout(250);
  const k2 = await kartlar(page);
  expect(k2[0]).toMatchObject({ w: 640, paf: true });
  expect(k2[0].tablo).toBeUndefined();              // ön ayarın dediğine döndü: alan SİLİNDİ
  expect(k2[1].x).toBe(k0[1].x);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  DURUM GERİ BİLDİRİMİ — NODE'DA HİÇ ÖLÇÜLEMEYEN HALKA
// ═══════════════════════════════════════════════════════════════════════════
// Kullanıcı bildirimi (2026-09-09): *"'Kayış Tablosu' çok demode ve ilkel
// duruyor."* Sebep stilin nerede durduğuydu: satır içi CSS DURUM İFADE
// EDEMEZ. jsdom `:hover`ı da `:focus`u da hesaplamaz — kapı buradadır.
test('PAFTA CANLI: fare · odak · seçili satır · çözüm sütunu · çizimle bağ', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  const { kart, tablo } = await ornek(page);
  const satir = tablo.locator('tr[data-ve-node]');
  const golge = (l) => l.evaluate((el) => getComputedStyle(el).boxShadow);

  // ── 1) FARE: satırın hücreleri tonlanıyor; sütun başı tepki vermiyor ────
  const hucre = satir.nth(2).locator('td.k-y');
  expect(await golge(hucre)).toBe('none');
  await satir.nth(2).hover();
  expect(await golge(hucre)).not.toBe('none');
  const th = tablo.locator('th.k-x');
  const thZemin = await th.evaluate((el) => getComputedStyle(el).backgroundColor);
  await th.hover();
  expect(await th.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(thZemin);

  // ── 2) SATIRA GELMEK KASNAĞI İKİ ÇİZİMDE DE YAKIYOR — ve tersi ──────────
  await satir.nth(2).hover();
  await page.waitForTimeout(100);
  const id2 = await satir.nth(2).getAttribute('data-ve-node');
  const yanan = await page.evaluate((id) => [...document.querySelectorAll('.ve-fead-kanvas')].map((k) =>
    k.querySelectorAll('circle[data-ve="pulley"][data-fead-k="' + id + '"].is-hov').length), id2);
  expect(yanan).toEqual([1, 1]);
  await page.mouse.move(2, 2);
  const id4 = await satir.nth(4).getAttribute('data-ve-node');
  await kart.locator('circle.ve-fead-hit[data-fead-k="' + id4 + '"]').hover({ force: true });
  await page.waitForTimeout(100);
  await expect(tablo.locator('tr.is-hov')).toHaveCount(1);
  expect(await tablo.locator('tr.is-hov').getAttribute('data-ve-node')).toBe(id4);
  await page.mouse.move(2, 2);

  // ── 3) GÖBEKTE NUMARA — yalnız tablosu açık kartta ──────────────────────
  const balon = await page.evaluate(() => [...document.querySelectorAll('.ve-node[data-type="fead-layout"]')]
    .map((k) => [...k.querySelectorAll('[data-ve="sira-no"] text')].map((t) => t.textContent).join(',')));
  expect(balon).toEqual(['1,2,3,4,5,6', '']);

  // ── 4) ZEBRA YOK, ÇÖZÜM SÜTUNU OYUK, yazılamaz ──────────────────────────
  const zemin = (l) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await zemin(satir.nth(0).locator('td.k-x'))).toBe(await zemin(satir.nth(1).locator('td.k-x')));
  const cz = await zemin(satir.nth(4).locator('td.k-sar'));
  expect(cz).not.toBe('rgba(0, 0, 0, 0)');
  expect(cz).not.toBe(await zemin(satir.nth(4).locator('td.k-x')));
  await expect(satir.nth(4).locator('td.cz input, td.cz button, td.cz select')).toHaveCount(0);

  // ── 5) SİLME ve SIRA OKLARI DİNLENMEDE GÖRÜNMEZ, FARE ve ODAKLA GELİR ───
  const sil = satir.nth(3).locator('button.ve-fead-tbl-del');
  const ok = satir.nth(3).locator('.ve-fead-pf-mv');
  await satir.nth(0).hover();
  expect(await sil.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
  expect(await ok.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
  await satir.nth(3).hover();
  await page.waitForTimeout(200);
  expect(Number(await sil.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
  expect(Number(await ok.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
  // KLAVYE YOLU GERÇEK SEKMEYLE: fare BAŞKA satırda, Sekme yön düğmesinden ✕'e.
  await satir.nth(0).hover();
  await satir.nth(3).locator('button.ve-fead-pf-yon').focus();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  expect(await sil.evaluate((el) => el === document.activeElement)).toBe(true);
  expect(Number(await sil.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9);

  // ── 6) ODAK HALKASI ─────────────────────────────────────────────────────
  const alan = satir.nth(2).locator('td.k-x input');
  expect(await golge(alan)).toBe('none');
  await alan.focus();
  expect(await golge(alan)).not.toBe('none');
  await page.evaluate(() => document.activeElement.blur());

  // ── 7) AD DÜĞMESİ PENCEREYİ AÇIYOR — satır ve İKİ ÇİZİM işaretli ────────
  for (const i of [0, 2, 5]) {
    await page.evaluate(() => veTogglePropertiesPanel(false));
    await page.waitForTimeout(120);
    const ad = (await satir.nth(i).locator('button.ve-fead-tbl-name').innerText()).trim();
    await satir.nth(i).locator('button.ve-fead-tbl-name').click();
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => {
      const o = document.getElementById('ve-properties-overlay');
      return !!o && o.style.display !== 'none';
    })).toBe(true);
    const secili = tablo.locator('tr.is-sel');
    await expect(secili).toHaveCount(1);
    expect((await secili.locator('button.ve-fead-tbl-name').innerText()).trim()).toBe(ad);
    expect(await page.evaluate(() => {
      const id = selectedNodes[0].id;
      return document.querySelectorAll('.ve-fead-kanvas circle[data-ve="pulley"][data-fead-k="'
        + id + '"].is-sel').length;
    })).toBe(2);
  }
  await page.evaluate(() => { veTogglePropertiesPanel(false); clearSelection(); });
  await page.waitForTimeout(150);
  await expect(tablo.locator('tr.is-sel')).toHaveCount(0);

  // ── 8) AD DÜĞMESİ "PENCERE AÇILIR" DİYOR — gölge fare altında ──────────
  const dugme = satir.nth(2).locator('button.ve-fead-tbl-name');
  const olc = () => dugme.evaluate((el) => ({
    golge: getComputedStyle(el).boxShadow,
    kirpma: getComputedStyle(el.closest('td')).overflow,
    simge: Number(getComputedStyle(el.querySelector('svg.ac')).opacity) }));
  const dinlenme = await olc();
  expect(dinlenme.golge).toBe('none');
  expect(dinlenme.kirpma).toBe('visible');
  expect(dinlenme.simge).toBeGreaterThan(0.9);
  await dugme.hover();
  await page.waitForTimeout(250);
  expect((await olc()).golge).not.toBe('none');

  // ── 9) KARTA SIĞIYOR — yatay kaydırma yok, uzun ad kısaltılmıyor ────────
  expect(await tablo.locator('.ve-fead-pf-kay').evaluate((el) =>
    el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await tablo.locator('tr.ten .ve-fead-tbl-name .ad').evaluate((el) =>
    el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  YERLEŞİM — İKİ EKRAN ÖLÇÜSÜ
// ═══════════════════════════════════════════════════════════════════════════
// Çekmece döneminde tablo açmak tuvali kısaltıyor ve kamerayı sığdırıyordu.
// Pafta kanvas alanına hiçbir şey eklemez: tuval AYNI boyda, kamera oynamaz,
// iki kart da görünür ve tablolu kart geniş.
for (const [W, H] of [[1366, 768], [1920, 1080]]) {
  test(`PAFTA ${W}×${H}: tuval kısalmıyor, kartlar görünür, tablo kartı geniş`, async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', (e) => hatalar.push(String(e)));
    await page.setViewportSize({ width: W, height: H });
    await bootApp(page);
    await feadAc(page);
    const tuval0 = await page.evaluate(() => document.getElementById('ve-canvas-wrapper').getBoundingClientRect().height);
    const cocuk0 = await page.evaluate(() => document.querySelector('.ve-canvas-area').children.length);
    await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
    await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
      null, { timeout: 20000 });
    await page.waitForTimeout(700);
    const kamera = () => page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y }));
    const o = await page.evaluate(() => {
      const R = (el) => el.getBoundingClientRect();
      const w = R(document.getElementById('ve-canvas-wrapper'));
      const ks = window.nodes.filter((n) => n.type === 'fead-layout');
      const el = document.getElementById(ks[0].id);
      const p = el.querySelector('.ve-fead-pafta');
      const inp = p.querySelector('td.k-x input');
      return {
        tuval: w.height, cocuk: document.querySelector('.ve-canvas-area').children.length,
        genislik: ks.map((n) => n.width),
        kesik: ks.map((n) => R(document.getElementById(n.id)))
          .filter((r) => r.top < w.top - 1 || r.bottom > w.bottom + 1 || r.left < w.left - 1 || r.right > w.right + 1).length,
        yazi: parseFloat(getComputedStyle(inp).fontSize) * canvasZoom,
        // Çizimdeki kasnak adının ekrandaki boyu — tablo çizimle AYNI oranda.
        ad: (() => {
          const t = el.querySelector('.ve-fead-kanvas svg text[data-ve="name"]');
          const m = t.getScreenCTM();
          return parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b);
        })(),
        kaydirma: p.querySelector('.ve-fead-pf-kay').scrollHeight - p.querySelector('.ve-fead-pf-kay').clientHeight,
        yatay: p.querySelector('.ve-fead-pf-kay').scrollWidth - p.querySelector('.ve-fead-pf-kay').clientWidth,
        // İÇERİĞİNİ KESEN HÜCRE: tablo kaymasa da hücre kendi içinde kırpabilir
        // (`overflow:hidden`) — sayı ya da sıra okları SESSİZCE yarım görünür.
        hucre: [...p.querySelectorAll('td, th, input')]
          .filter((e) => e.scrollWidth > e.clientWidth + 1)
          .map((e) => (e.className || e.tagName) + ' ' + (e.value || e.textContent || '').trim().slice(0, 16)),
      };
    });
    expect(o.tuval).toBe(tuval0);                     // tuval KISALMADI
    expect(o.cocuk).toBe(cocuk0);                     // kabuğa satır eklenmedi
    expect(o.genislik).toEqual([640, 440]);
    expect(o.kesik).toBe(0);                          // iki kart da tam görünüyor
    expect(o.kaydirma).toBeLessThanOrEqual(0);
    expect(o.yatay).toBeLessThanOrEqual(1);
    expect(o.hucre).toEqual([]);                      // hiçbir hücre içeriğini kesmiyor
    // TABLO ÇİZİMLE BİRLİKTE ÖLÇEKLENİR (Pafta'nın sözü): sayı, çizimdeki
    // kasnak adından hep ~%20 büyük. Kullanıcının ekranında (1920) kamera 1'de
    // ve sayı arayüzün gövde boyunda; dar ekranda sığdırma ikisini birlikte
    // küçültür (1366 × 768, palet açık: kamera 0,70).
    expect(o.yazi / o.ad).toBeGreaterThan(1.15);
    expect(o.yazi / o.ad).toBeLessThan(1.3);
    if (W >= 1920) expect(o.yazi).toBeGreaterThanOrEqual(12);
    // Tabloyu kapatıp açmak kamerayı OYNATMAZ (çekmece sığdırıyordu).
    const k0 = await kamera();
    await page.locator('.ve-node[data-type="fead-layout"]').first().locator('.ve-fead-tablo-dugme').click();
    await page.locator('.ve-node[data-type="fead-layout"]').first().locator('.ve-fead-tablo-dugme').click();
    await page.waitForTimeout(300);
    expect(await kamera()).toEqual(k0);
    expect(hatalar).toEqual([]);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  TABLO KARTI TAŞIMAZ; TEKERLEK LİSTEYE; EKLENEN SATIR GÖRÜNÜR
// ═══════════════════════════════════════════════════════════════════════════
test('PAFTA: hücreye basmak kartı taşımıyor, tekerlek listeyi kaydırıyor, eklenen satır görünür', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const { kart, tablo } = await ornek(page);
  const konum = () => page.evaluate(() => {
    const n = window.nodes.find((x) => x.type === 'fead-layout');
    return [n.x, n.y, canvasZoom, canvasOffset.x, canvasOffset.y].join(',');
  });

  // ── 1) TABLODA SÜRÜKLEMEK kartı TAŞIMIYOR, kanvası KAYDIRMIYOR ──────────
  const k0 = await konum();
  const b = await tablo.locator('tr[data-ve-node]').nth(1).locator('td.k-sar').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 140, b.y + 80, { steps: 8 });
  await page.mouse.up();
  expect(await konum()).toBe(k0);

  // ── 2) TEKERLEK: liste taşıyorsa LİSTEYİ kaydırır, kanvası hiç ────────
  // Tablonun tavanı kartın %55'i: altı satır sığıyor, on iki satır taşıyor.
  for (let i = 0; i < 6; i++) {
    await tablo.locator('select[data-ve="add-pulley"]').selectOption('fead-idler');
    await page.waitForTimeout(250);
  }
  const kay = tablo.locator('.ve-fead-pf-kay');
  expect(await kay.evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);
  await kay.evaluate((el) => { el.scrollTop = 0; });
  const k1 = await konum();
  await tablo.locator('tr[data-ve-node]').nth(1).hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(300);
  expect(await kay.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await konum()).toBe(k1);
  // Sütun başı kayarken yerinde (yapışkan).
  const thUst = await tablo.locator('th.k-x').evaluate((el) =>
    el.getBoundingClientRect().top - el.closest('.ve-fead-pf-kay').getBoundingClientRect().top);
  expect(Math.abs(thUst)).toBeLessThanOrEqual(1);

  // ── 3) EKLENEN SATIR GÖRÜŞ ALANINDA ────────────────────────────────────
  const idler = () => page.evaluate(() =>
    window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).map((n) => n.id));
  const once = await idler();
  await tablo.locator('select[data-ve="add-pulley"]').selectOption('fead-ps');
  await page.waitForTimeout(350);
  const yeni = (await idler()).find((x) => !once.includes(x));
  expect(await tablo.evaluate((k, id) => {
    const w = k.querySelector('.ve-fead-pf-kay').getBoundingClientRect();
    const r = k.querySelector('tr[data-ve-node="' + id + '"]').getBoundingClientRect();
    return r.top >= w.top - 1.5 && r.bottom <= w.bottom + 1.5;
  }, yeni)).toBe(true);
  // Çizim tablonun tavanında bile kartın içinde kalıyor.
  expect(await kart.evaluate((el) => el.querySelector('.ve-fead-kanvas svg, .ve-fead-kan-bos')
    .getBoundingClientRect().bottom <= el.querySelector('.ve-fead-pafta').getBoundingClientRect().top + 0.5)).toBe(true);

  expect(hatalar).toEqual([]);
});

// ARKA PLAN KAYDI (köke çöker, aynı anda geri girer) tabloyu SÖKMEZ: kart
// yeniden kurulur, tablo onunla birlikte gelir.
test('PAFTA: arka plan kaydından sonra tablo yerinde; ana topolojide tablo yok', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await ornek(page);
  await page.evaluate(() => veSaveActiveTabStateKeepView());
  await page.waitForTimeout(400);
  await expect(page.locator('.ve-node[data-type="fead-layout"]').first()
    .locator('.ve-fead-pafta tr[data-ve-node]')).toHaveCount(6);
  await page.evaluate(() => veFeadCloseEditor());
  await page.waitForTimeout(400);
  await expect(page.locator('.ve-fead-pafta')).toHaveCount(0);
  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  CTRL+Z — ÖRNEK TEK ADIMDA, AÇILIŞ YÜZEYİ SİLİNMİYOR
// ═══════════════════════════════════════════════════════════════════════════
// Kullanıcı bildirimi (2026-09-09): *"CTRL Z komutunu kullandığımda tablo
// siliniyor."* Ölçüldü (düzeltmeden önce): örnek yığına ONÜÇ adım yazıyordu
// ve Ctrl+Z modeli düğüm düğüm söküyordu. Açılış yüzeyi artık sihirbaz + BOŞ
// Kayış Yolu kartı ve örnek o kartı DEVRALIYOR — geri alınınca kart boş
// hâline döner, kaybolmaz.
test('CTRL+Z: örnek TEK adımda geri alınır, açılış kartı SİLİNMEZ', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });
  await page.waitForTimeout(700);

  const durum = () => page.evaluate(() => ({
    dugum: window.nodes.length,
    kasnak: window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length,
    kanvas: window.nodes.filter((n) => n.type === 'fead-layout').length,
    bos: /henüz kasnak yok/.test((document.querySelector('.ve-fead-kanvas') || {}).textContent || ''),
    satir: document.querySelectorAll('.ve-fead-pafta tr[data-ve-node]').length,
    undo: (window.undoStack || []).length }));

  const yuklu = await durum();
  expect(yuklu.kasnak).toBe(6);
  expect(yuklu.kanvas).toBe(2);                     // ÜÇ DEĞİL — boş kart devralındı
  expect(yuklu.satir).toBe(6);
  expect(yuklu.undo).toBe(2);                       // taban + örnek

  const geriAl = async (n) => {
    for (let i = 0; i < n; i++) {
      await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(350);
    }
  };
  await geriAl(1);
  const sonra = await durum();
  expect(sonra.kasnak).toBe(0);                     // yarım sökülmüş model YOK
  expect(sonra.kanvas).toBe(1);                     // açılış kartı DURUYOR
  expect(sonra.bos).toBe(true);                     // ve boş hâlini söylüyor
  expect(sonra.satir).toBe(0);                      // tablosu da boş

  await geriAl(5);                                  // taban: daha fazlası bir şey silmez
  expect((await durum()).dugum).toBe(2);            // sihirbaz + kanvas

  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(500);
  const ileri = await durum();
  expect(ileri.kasnak).toBe(6);
  expect(ileri.kanvas).toBe(2);
  expect(ileri.satir).toBe(6);

  expect(hatalar).toEqual([]);
});
