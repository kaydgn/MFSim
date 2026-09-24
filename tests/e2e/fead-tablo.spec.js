/**
 * fead-tablo.spec.js — KAYIŞ TABLOSU PENCERESİ GERÇEK TARAYICIDA
 *
 * Tablo 2026-09-23'te kanvastan İNDİ (Çizim Masası): artık bir kanvas kartı
 * değil, Kayış Yolu kartının "Tablo" düğmesiyle açılan, MODAL OLMAYAN bir alt
 * pencere. Kanvas kartıyken açılış yakınlaştırmasında 7,1 px'e küçülen bir
 * formdu (ölçüldü); pencere kanvasla ölçeklenmez.
 *
 * Birim testler satırları ve sütun kimliklerini Node'da doğruluyor
 * (`fead-table.test.js`). Buradaki soru: YÜZEY ayakta mı? Node'da HİÇ
 * koşmayan halkalar —
 *
 *   • pencerenin gerçek düğmeyle açılması, ESC ile kapanması,
 *   • gerçek bir `<input>`a yazıp `change` tetiklemek (`veFeadTableSet`),
 *   • satır okuna GERÇEK tıklamak ve sıranın modelde değişmesi,
 *   • pencere açıkken ÇİZİMİN görünür ve kullanılabilir kalması,
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

// Örneği kur ve tabloyu KULLANICININ yolundan aç: kanvas kartının düğmesi.
async function ornekVeTablo(page) {
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.locator('.ve-fead-tablo-dugme').first().click();
  // İmleç düğmenin yerinde kalırsa, çekmece açılıp kamera çizimleri
  // sığdırınca bir satırın ya da kasnağın ÜSTÜNE düşebilir ve "dinlenme"
  // zemini fare altı olarak ölçülür. Kabuğun köşesine çekilir.
  await page.mouse.move(2, 2);
  const tablo = page.locator('#ve-fead-tablo');
  await expect(tablo.locator('.ve-fead-krt[data-ve-node]')).toHaveCount(6);
  return tablo;
}

test('Kayış Tablosu penceresi: açılır, yazılır, sıra değişir', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  const tablo = await ornekVeTablo(page);

  // ── 1) KANVASTA TABLO KARTI YOK — tip kalktı, düğüm de yok ──────────────
  const kanvas = await page.evaluate(() => {
    const kas = (n) => !!(componentDefs[n.type] || {}).isFeadPulley;
    return {
      tablo: window.nodes.filter((n) => n.type === 'fead-table').length,
      kartDom: document.querySelectorAll('#ve-canvas .ve-fead-table-card').length,
      kasnak: window.nodes.filter(kas).length,
      kasnakDom: window.nodes.filter(kas).filter((n) => document.getElementById(n.id)).length,
      basili: document.querySelectorAll('.ve-fead-tablo-dugme[aria-pressed="true"]').length,
      dugme: document.querySelectorAll('.ve-fead-tablo-dugme').length,
    };
  });
  expect(kanvas.tablo).toBe(0);
  expect(kanvas.kartDom).toBe(0);
  expect(kanvas.kasnak).toBe(6);
  expect(kanvas.kasnakDom).toBe(0);                 // kasnakların kutusu da yok
  // Açıklık İKİ kartın düğmesinde de basılı — tek pencere, iki kapı.
  expect(kanvas.dugme).toBe(2);
  expect(kanvas.basili).toBe(2);

  // ── 2) ETİKET KISA, DEFTERİN ADI `title`DA; TEK BAŞLIK SATIRI ──────────
  // `textContent`, `innerText` DEĞİL: ikincisi CSS'in `text-transform`unu
  // uyguluyor ve yerleşime bağlı.
  const govde = await tablo.evaluate((el) => el.textContent);
  ['Ø eff', 'Sarım', 'Span', 'Σsarım', 'Σ toplam', 'Kayış boyu']
    .forEach((t) => expect(govde).toContain(t));
  const ipuclari = await tablo.evaluate((el) =>
    [...el.querySelectorAll('[title]')].map((e) => e.getAttribute('title')).join(' | '));
  ['Efektif Çap (mm)', 'Sarım Açısı (°)', 'Span Uzunluğu (mm)', 'Kasnak Dönüş Yönü']
    .forEach((t) => expect(ipuclari).toContain(t));
  // Pencerede satırların tekrar eden etiketleri gizli, yerine BİR başlık satırı.
  const etiket = await tablo.evaluate((el) => ({
    bas: el.querySelectorAll('.ve-fead-krt--bas').length,
    gorunen: [...el.querySelectorAll('.ve-fead-krt[data-ve-node] .ve-fead-krt-fld > i')]
      .filter((i) => getComputedStyle(i).display !== 'none').length,
  }));
  expect(etiket).toEqual({ bas: 1, gorunen: 0 });

  // ── 3) YAZI KANVASLA ÖLÇEKLENMİYOR ──────────────────────────────────────
  // Kanvas kartıyken hücreler açılışta 7,1 px'e iniyordu. Kamera ne olursa
  // olsun pencerenin sayısı arayüzün kendi basamağında.
  await page.evaluate(() => { canvasZoom = 0.35; updateCanvasTransform(); });
  const punto = await tablo.locator('.ve-fead-krt[data-ve-node] input').first().evaluate((el) =>
    ({ css: parseFloat(getComputedStyle(el).fontSize), ekran: el.getBoundingClientRect().height }));
  expect(punto.css).toBe(13);
  expect(punto.ekran).toBeGreaterThan(18);          // gerçekten 13 px'lik bir alan

  // ── 4) GERÇEK BİR HÜCREYE YAZMAK MODELİ DEĞİŞTİRİYOR ────────────────────
  const once = await page.evaluate(() => {
    const b = veFeadBuildFromCanvas();
    const alt = window.nodes.find((n) => n.type === 'fead-alternator');
    return { L: b.beltLengthMm, altId: alt.id, od: alt.data.od };
  });
  const satir = tablo.locator('.ve-fead-krt[data-ve-node]', { hasText: 'Alternatör' }).first();
  const dHucre = satir.locator('input').nth(2);
  await dHucre.fill('63,5');
  await dHucre.dispatchEvent('change');
  await page.waitForTimeout(200);
  const sonra = await page.evaluate((id) => {
    const n = window.nodes.find((x) => x.id === id);
    return { od: n.data.od, L: veFeadBuildFromCanvas().beltLengthMm };
  }, once.altId);
  expect(sonra.od).toBeCloseTo(63.5, 6);            // VİRGÜLLÜ giriş okundu
  expect(sonra.L).not.toBeCloseTo(once.L, 3);       // çözüm gerçekten değişti

  // ── 5) SEKME ODAĞI DÜŞÜRMÜYOR ──────────────────────────────────────────
  // Hücre `onchange` ile yazıyor ve o olay hücreden ÇIKARKEN tetikleniyor;
  // tazeleme aynı anda yapılsa Sekme ile geçilen SONRAKİ hücre sökülür ve
  // ikinci sayı yazılamazdı. Pencere tazelemesi bir kare sonra ve odağı
  // anahtarıyla geri veriyor.
  const xHucre = tablo.locator('.ve-fead-krt[data-ve-node]', { hasText: 'Avara 1' })
    .first().locator('input').first();
  await xHucre.click();
  await xHucre.fill('131,5');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(250);
  const odak = await page.evaluate(() => {
    const a = document.activeElement;
    return { pencerede: !!(a && a.closest && a.closest('#ve-fead-tablo')),
             anahtar: a && a.getAttribute('onchange') };
  });
  expect(odak.pencerede).toBe(true);
  expect(odak.anahtar).toMatch(/,'y',/);            // X'ten sonra Y
  expect(await page.evaluate(() =>
    window.nodes.find((n) => n.customName === 'Avara 1').data.x)).toBeCloseTo(131.5, 6);

  // ── 6) SATIR OKU SIRAYI DEĞİŞTİRİYOR; SÜRÜCÜ KİLİTLİ ───────────────────
  const siraOnce = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.customName));
  await tablo.locator('.ve-fead-krt[data-ve-node]').nth(2).locator('button[title*="yukarı"]').click();
  await page.waitForTimeout(200);
  const siraSonra = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.customName));
  expect(siraSonra[0]).toBe(siraOnce[0]);                         // sürücü yerinde
  expect(siraSonra[1]).toBe(siraOnce[2]);                         // takas oldu
  expect(siraSonra.slice().sort()).toEqual(siraOnce.slice().sort());
  const ilk = tablo.locator('.ve-fead-krt[data-ve-node]').first();
  await expect(ilk.locator('button[title*="taşı"]')).toHaveCount(2);
  await expect(ilk.locator('button[title*="taşı"]').first()).toBeDisabled();
  await expect(ilk.locator('b.drv')).toHaveCount(1);

  // ── 7) DÖNÜŞ YÖNÜ `contact` YAZIYOR — efektif çap onunla oynuyor ────────
  const avara = () => tablo.locator('.ve-fead-krt[data-ve-node]', { hasText: 'Avara 1' }).first();
  const eff = async () => parseFloat((await avara().locator('.coz .ve-fead-krt-rv > b').first()
    .innerText()).replace(',', '.'));
  const effOnce = await eff();
  await expect(avara().locator('.ve-fead-krt-seg[data-ve="spin"] button.on')).toHaveText('Sol');
  await avara().locator('.ve-fead-krt-seg[data-ve="spin"] button', { hasText: 'Sağ' }).click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() =>
    window.nodes.find((n) => n.customName === 'Avara 1').data.contact)).toBe('grooved');
  expect(await eff()).toBeCloseTo(effOnce + 0.2, 3);              // 2·hr → 2·hb, GATES PK

  // ── 8) KAYIŞ BOYU KÜNYEDE, TEK KEZ ─────────────────────────────────────
  const boy = tablo.locator('.ve-fead-tbl-kunye', { hasText: 'Kayış boyu' });
  await expect(boy).toHaveCount(1);
  expect(parseFloat((await boy.locator('b').innerText()).replace(',', '.'))).toBeGreaterThan(1000);

  // ── 9) SATIR SİL / EKLE ─────────────────────────────────────────────────
  const silOnce = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.customName));
  await tablo.locator('.ve-fead-krt[data-ve-node]').nth(3).hover();
  await tablo.locator('.ve-fead-krt[data-ve-node]').nth(3).locator('button.ve-fead-tbl-del').click();
  await page.waitForTimeout(250);
  const silSonra = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.customName));
  expect(silSonra).toHaveLength(silOnce.length - 1);
  expect(silSonra).not.toContain(silOnce[3]);
  await tablo.locator('select[data-ve="add-pulley"]').selectOption('fead-waterpump');
  await page.waitForTimeout(300);
  const ek = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.type));
  expect(ek[ek.length - 1]).toBe('fead-tensioner');               // GERGİ SONDA
  expect(ek[ek.length - 2]).toBe('fead-waterpump');               // yeni ONUN ÖNÜNDE

  // ── 10) ESC KAPATIR, DÜĞMELER BASILILIĞI BIRAKIR ────────────────────────
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await expect(page.locator('#ve-fead-tablo')).toHaveCount(0);
  expect(await page.evaluate(() =>
    document.querySelectorAll('.ve-fead-tablo-dugme[aria-pressed="true"]').length)).toBe(0);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  DURUM GERİ BİLDİRİMİ — NODE'DA HİÇ ÖLÇÜLEMEYEN HALKA
// ═══════════════════════════════════════════════════════════════════════════
// Kullanıcı bildirimi (2026-09-09): *"'Kayış Tablosu' çok demode ve ilkel
// duruyor."* Sebep stilin nerede durduğuydu: satır içi CSS DURUM İFADE
// EDEMEZ. jsdom `:hover`ı da `:focus`u da hesaplamaz — kapı buradadır.
test('Kayış Tablosu CANLI: fare · odak · seçili satır · çözüm bölgesi · çizimle bağ', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  const tablo = await ornekVeTablo(page);
  const satir = tablo.locator('.ve-fead-krt[data-ve-node]');

  // ── 1) FARE: satırın zemini değişiyor; başlık satırı DEĞİŞMİYOR ────────
  const zemin = (l) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  const once = await zemin(satir.nth(2));
  await satir.nth(2).hover();
  expect(await zemin(satir.nth(2))).not.toBe(once);
  const bas = tablo.locator('.ve-fead-krt--bas');
  const basOnce = await zemin(bas);
  await bas.hover();
  expect(await zemin(bas)).toBe(basOnce);           // etkileşimsiz satır tepki vermez

  // ── 2) SATIRA GELMEK KASNAĞI İKİ ÇİZİMDE DE YAKIYOR ────────────────────
  await satir.nth(2).hover();
  await page.waitForTimeout(100);
  const yanan = await page.evaluate(() => {
    const id = document.querySelectorAll('#ve-fead-tablo .ve-fead-krt[data-ve-node]')[2]
      .getAttribute('data-ve-node');
    return [...document.querySelectorAll('.ve-fead-kanvas')].map((k) =>
      k.querySelectorAll('[data-fead-k="' + id + '"].is-hov').length);
  });
  expect(yanan).toHaveLength(2);
  yanan.forEach((n) => expect(n).toBeGreaterThanOrEqual(2));

  // ── 3) ZEBRA YOK, ÇÖZÜM BÖLGESİ GÖMÜLÜ ─────────────────────────────────
  expect(await zemin(satir.nth(0))).toBe(await zemin(satir.nth(1)));
  const seffaf = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const bolge = await satir.nth(4).evaluate((el) => {
    const cs = getComputedStyle;
    return { coz: cs(el.querySelector('.coz')).backgroundColor,
             gir: cs(el.querySelector('.gir')).backgroundColor };
  });
  expect(seffaf(bolge.coz)).toBe(false);
  expect(bolge.coz).not.toBe(bolge.gir);
  await expect(satir.nth(4).locator('.coz input, .coz select, .coz button')).toHaveCount(0);

  // ── 4) SİLME DİNLENMEDE GÖRÜNMEZ, FARE ve ODAKLA GELİR ─────────────────
  const sil = satir.nth(3).locator('button.ve-fead-tbl-del');
  await satir.nth(0).hover();
  expect(await sil.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
  await satir.nth(3).hover();
  await page.waitForTimeout(200);
  expect(Number(await sil.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
  // KLAVYE YOLU GERÇEK SEKMEYLE ölçülüyor: pencere fareyle açıldığı için
  // programatik `focus()` Chromium'da `:focus-visible` üretmez (son etkileşim
  // bir tıklamaydı) — ölçülen kişi klavye kullanıcısı, o da Sekme'yle gelir.
  await satir.nth(0).hover();                             // fare BAŞKA satırda
  await satir.nth(3).locator('.ve-fead-krt-seg button').last().focus();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  expect(await sil.evaluate((el) => el === document.activeElement)).toBe(true);
  expect(Number(await sil.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9);

  // ── 5) ODAK HALKASI ─────────────────────────────────────────────────────
  const alan = satir.nth(2).locator('input').first();
  expect(await alan.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
  await alan.focus();
  expect(await alan.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');

  // ── 6) SEÇİLİ SATIR — ad düğmesi pencereyi AÇIYOR, satır ve ÇİZİM işaretli
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
    const secili = tablo.locator('.ve-fead-krt.is-sel');
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
  await expect(tablo.locator('.ve-fead-krt.is-sel')).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelectorAll('.ve-fead-kanvas .is-sel').length)).toBe(0);

  // ── 7) AD DÜĞMESİ "PENCERE AÇILIR" DİYOR — gölge fare altında ──────────
  const dugme = satir.nth(2).locator('button.ve-fead-tbl-name');
  const olc = () => dugme.evaluate((el) => ({
    golge: getComputedStyle(el).boxShadow,
    kirpma: getComputedStyle(el.closest('.kim')).overflow,
    simge: Number(getComputedStyle(el.querySelector('svg.ac')).opacity) }));
  const dinlenme = await olc();
  expect(dinlenme.golge).toBe('none');
  expect(dinlenme.kirpma).toBe('visible');
  expect(dinlenme.simge).toBeGreaterThan(0.9);
  await dugme.hover();
  await page.waitForTimeout(250);
  expect((await olc()).golge).not.toBe('none');

  // ── 8) PENCEREYE SIĞIYOR — yatay kaydırma yok ──────────────────────────
  expect(await tablo.locator('.ve-fead-krt-wrap').evaluate((el) =>
    el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  ÇEKMECE — TUVALİN ALTINDA, ÜSTÜNDE DEĞİL
// ═══════════════════════════════════════════════════════════════════════════
// Kullanıcı (2026-09-24): "Tablo açılıyor fakat kötü bir yere geliyor."
// Ölçüldü (eski hâl, AG00976): tuvalin ÜSTÜNDE yüzen, ortalı, 16 px havada bir
// kart — 1366×768'de tuval alanının %45'ini ve minimap'in %65'ini örtüyor, çizimleri
// 0,83 → 0,49'a küçültüyor, kapanınca da öyle bırakıyordu; 1920×1080'de
// 1,00 → 1,11 YAKINLAŞIYORDU. Çekmece artık kanvas alanının SATIRI: tuval
// kısalır, hiçbir şey örtülmez. Node'a taşınamaz (jsdom yerleşim kurmaz).
for (const [W, H] of [[1366, 768], [1920, 1080]]) {
  test(`ÇEKMECE ${W}×${H}: tuvalin altına yapışık, hiçbir şeyi örtmüyor, kapanınca kamera döner`, async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', (e) => hatalar.push(String(e)));
    await page.setViewportSize({ width: W, height: H });
    await bootApp(page);
    await feadAc(page);
    await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
    await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
      null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const kamera = () => page.evaluate(() => ({ z: canvasZoom, x: canvasOffset.x, y: canvasOffset.y }));
    const k0 = await kamera();
    await page.locator('.ve-fead-tablo-dugme').first().click();
    await page.mouse.move(5, H - 5);
    await page.waitForTimeout(800);                   // kamera geçişi (tidy-cam)
    const o = await page.evaluate(() => {
      const R = (el) => el.getBoundingClientRect();
      const p = R(document.getElementById('ve-fead-tablo'));
      const w = R(document.getElementById('ve-canvas-wrapper'));
      const s = R(document.getElementById('ve-status-bar'));
      const mm = document.getElementById('ve-minimap');
      const m = (mm && !mm.classList.contains('ve-minimap-hidden')) ? R(mm) : null;
      const kartlar = window.nodes.filter((n) => n.type === 'fead-layout')
        .map((n) => R(document.getElementById(n.id)));
      const liste = document.querySelector('#ve-fead-tablo .ve-fead-krt-wrap');
      const coz = document.querySelector('#ve-fead-tablo .ve-fead-krt[data-ve-node] > .coz');
      const b = [...coz.querySelectorAll('.ve-fead-krt-rv > b')].map(R);
      return {
        kenar: [p.top - w.bottom, s.top - p.bottom, p.left - w.left, w.right - p.right].map(Math.round),
        minimapUstte: m ? m.bottom <= p.top + 0.5 : 'minimap yok',
        kesik: kartlar.filter((r) => r.top < w.top - 1 || r.bottom > w.bottom + 1
                                  || r.left < w.left - 1 || r.right > w.right + 1).length,
        kaydirma: liste.scrollHeight - liste.clientHeight,
        cozYayilim: Math.round(b[b.length - 1].left - b[0].left),
      };
    });
    expect(o.kenar).toEqual([0, 0, 0, 0]);            // tuvalin altı · şeridin üstü · iki yan
    expect(o.minimapUstte).toBe(true);
    expect(o.kesik).toBe(0);                          // iki çizim de tam görünüyor
    expect(o.kaydirma).toBeLessThanOrEqual(0);        // altı satır kaydırmasız
    expect(o.cozYayilim).toBeLessThanOrEqual(240);    // çözüm sayıları yayılmıyor
    expect((await kamera()).z).toBeLessThanOrEqual(k0.z + 1e-9);   // YAKINLAŞMAZ

    // KAPANINCA KAMERA DÖNER — kullanıcı oynatmadıysa tuval eski boyuna
    // uzarken çizimler sığdırılmış küçük hâlde kalmaz.
    await page.locator('#ve-fead-tablo .ve-tablo-kapat').click();
    await page.waitForTimeout(700);
    const k2 = await kamera();
    expect(k2.z).toBeCloseTo(k0.z, 9);
    expect(Math.abs(k2.x - k0.x)).toBeLessThan(0.5);
    expect(Math.abs(k2.y - k0.y)).toBeLessThan(0.5);
    expect(hatalar).toEqual([]);
  });
}

test('ÇEKMECE TUTAMAĞI: sürükleyince tuval o kadar kısalır; seçilen boy korunur, çift tık sıfırlar', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const tablo = await ornekVeTablo(page);
  await page.waitForTimeout(600);
  const olc = () => page.evaluate(() => ({
    p: Math.round(document.getElementById('ve-fead-tablo').getBoundingClientRect().height),
    w: Math.round(document.getElementById('ve-canvas-wrapper').getBoundingClientRect().height),
    ust: document.getElementById('ve-fead-tablo').getBoundingClientRect().top }));
  const a = await olc();
  const x = 700;
  await page.mouse.move(x, a.ust + 1.5);              // üst kenarın tutamağı
  await page.mouse.down();
  await page.mouse.move(x, a.ust + 1.5 - 120, { steps: 6 });
  await page.mouse.up();
  const b = await olc();
  expect(Math.abs(b.p - a.p - 120)).toBeLessThanOrEqual(2);
  expect(a.w - b.w).toBe(b.p - a.p);                  // tuval KISALDI — örtü yok
  // Çok yukarı çekmek tuvali tabanının altına indiremez.
  await page.mouse.move(x, b.ust + 1.5);
  await page.mouse.down();
  await page.mouse.move(x, 20, { steps: 8 });
  await page.mouse.up();
  const c = await olc();
  expect(c.w).toBeGreaterThanOrEqual(179);
  // Kapat · aç: seçilen boy korunur.
  await tablo.locator('.ve-tablo-kapat').click();
  await page.locator('.ve-fead-tablo-dugme').first().click();
  await page.waitForTimeout(300);
  expect((await olc()).p).toBe(c.p);
  // Çift tık: içerik kadarına döner.
  await page.locator('#ve-fead-tablo .ve-fead-tablo-tutamak').dblclick({ position: { x: 700 - 284, y: 5 } });
  await page.waitForTimeout(200);
  expect((await olc()).p).toBe(a.p);
  expect(hatalar).toEqual([]);
});

test('ÇEKMECE FEAD\'e AİT: ana topolojiye dönünce kapanır; arka plan kaydı KAPATMAZ', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  const tablo = await ornekVeTablo(page);
  // Arka plan kaydı: köke çöker ve aynı anda geri girer — çekmece yerinde.
  await page.evaluate(() => veSaveActiveTabStateKeepView());
  await page.waitForTimeout(300);
  await expect(tablo.locator('.ve-fead-krt[data-ve-node]')).toHaveCount(6);
  // Kullanıcı ana topolojiye dönüyor: eskiden çekmece SATIRSIZ açık kalıyordu.
  await page.evaluate(() => veFeadCloseEditor());
  await page.waitForTimeout(400);
  await expect(page.locator('#ve-fead-tablo')).toHaveCount(0);
  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  ÇEKMECE KANVASIN PARÇASI DEĞİL
// ═══════════════════════════════════════════════════════════════════════════
// Basmak kanvası kaydırmaya, tekerlek kanvası yakınlaştırmaya başlamamalı;
// eklenen satır listede görünür olmalı.
test('ÇEKMECE: kanvası kaydırmıyor, tekerlek listeyi kaydırıyor, eklenen satır görünür', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1600, height: 1000 });
  const tablo = await ornekVeTablo(page);
  await page.waitForTimeout(700);                   // kamera geçişi (tidy-cam)

  // ── 2) PENCEREYE BASMAK KANVASI KAYDIRMIYOR ────────────────────────────
  const kamera = () => page.evaluate(() => [canvasZoom, canvasOffset.x, canvasOffset.y].join(','));
  const k0 = await kamera();
  const bas = await tablo.locator('.ve-fead-tablo-bas').boundingBox();
  await page.mouse.move(bas.x + 200, bas.y + bas.height / 2);
  await page.mouse.down();
  await page.mouse.move(bas.x + 320, bas.y + 90, { steps: 8 });
  await page.mouse.up();
  expect(await kamera()).toBe(k0);

  // ── 3) TEKERLEK: liste taşıyorsa LİSTEYİ kaydırır, kanvası hiç ────────
  // Çekmecenin tavanı alanın yarısı (1600×1000'de ~480 px): liste ancak
  // on dört satırda taşıyor.
  for (let i = 0; i < 8; i++) {
    await tablo.locator('select[data-ve="add-pulley"]').selectOption('fead-idler');
    await page.waitForTimeout(250);
  }
  const wrap = tablo.locator('.ve-fead-krt-wrap');
  expect(await wrap.evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);
  await wrap.evaluate((el) => { el.scrollTop = 0; });
  const k1 = await kamera();
  await tablo.locator('.ve-fead-krt[data-ve-node]').nth(1).hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(300);
  expect(await wrap.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await kamera()).toBe(k1);
  // Künyenin üstünde de kanvas OYNAMAZ — pencere kanvasın parçası değil.
  await tablo.locator('.ve-fead-tbl-head').hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(250);
  expect(await kamera()).toBe(k1);

  // ── 4) EKLENEN SATIR GÖRÜŞ ALANINDA ────────────────────────────────────
  // Liste taşarken eklenen her satır tam görünmeli (ölçülmüş kusur: yedinci
  // kasnak listenin dibinin 35 px altına düşüyor, liste kaymıyordu).
  const idler = () => page.evaluate(() =>
    window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).map((n) => n.id));
  const once = await idler();
  await tablo.locator('select[data-ve="add-pulley"]').selectOption('fead-ps');
  await page.waitForTimeout(350);
  const yeni = (await idler()).find((x) => !once.includes(x));
  expect(await tablo.evaluate((k, id) => {
    const w = k.querySelector('.ve-fead-krt-wrap').getBoundingClientRect();
    const r = k.querySelector('.ve-fead-krt[data-ve-node="' + id + '"]').getBoundingClientRect();
    return r.top >= w.top - 1.5 && r.bottom <= w.bottom + 1.5;
  }, yeni)).toBe(true);

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
    undo: (window.undoStack || []).length }));

  const yuklu = await durum();
  expect(yuklu.kasnak).toBe(6);
  expect(yuklu.kanvas).toBe(2);                     // ÜÇ DEĞİL — boş kart devralındı
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

  await geriAl(5);                                  // taban: daha fazlası bir şey silmez
  expect((await durum()).dugum).toBe(2);            // sihirbaz + kanvas

  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(500);
  const ileri = await durum();
  expect(ileri.kasnak).toBe(6);
  expect(ileri.kanvas).toBe(2);

  expect(hatalar).toEqual([]);
});
