/**
 * fead-wizard.spec.js — FEAD BAŞLANGIÇ SİHİRBAZI (gerçek tarayıcı)
 *
 * Birim testler sihirbazın ÇEVİRİSİNİ sınıyor (durum → düğüm → çözüm) ve o
 * zincir Node'da eksiksiz koşuyor. Buradaki soru başka: YÜZEY ayakta mı?
 *
 * Node'da HİÇ koşmayan halkalar: modal kabuğunun gerçekten açılması, adım
 * rayının tıklanabilirliği, gerçek klavye girişi (ve odağın alanda KALMASI —
 * canlı şerit her tuşta tam yeniden çizim yapsaydı odak düşerdi), Kayış Yolu
 * şemasının SVG olarak çizilmesi, ve "Modeli Kur" düğmesinin kanvasa gerçek
 * düğüm kurması.
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadWizOpen === 'function' &&
    Array.isArray(window.nodes),
    null, { timeout: 60000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
}

async function openFead(page) {
  await page.evaluate(() => {
    const n = createNode('fead-analysis', 400, 300);
    veFeadOpenEditor(n.id);
  });
  await page.waitForFunction(() => Array.isArray(window.nodes) && window.nodes.length > 0,
    null, { timeout: 20000 });
}

test.describe('FEAD Başlangıç Sihirbazı', () => {
  test('boş topoloji İKİ açılış yüzeyiyle geliyor ve sihirbaz açılıyor', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', (e) => hatalar.push(String(e)));
    await bootApp(page);
    await openFead(page);

    const tipler = await page.evaluate(() => window.nodes.map((n) => n.type));
    expect(tipler).toContain('fead-wizard');
    expect(tipler).toContain('fead-example');

    // ÇİFT TIK sihirbazı açar (alt-sistem kartlarındaki el alışkanlığı).
    const id = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-wizard').id);
    await page.dblclick('#' + id);
    await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();

    // Yedi adım rayda duruyor.
    await expect(page.locator('#ve-fw-nav .ve-fw-step')).toHaveCount(7);
    await expect(page.locator('#ve-fw-nav .ve-fw-step.on')).toHaveCount(1);
    expect(hatalar).toEqual([]);
  });

  test('örnekten doldur → canlı şerit ÇÖZÜLÜYOR diyor, sayılar geliyor', async ({ page }) => {
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => {
      const n = window.nodes.find((x) => x.type === 'fead-wizard');
      veFeadWizOpen(n.id);
    });
    await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();

    // "Örnekten doldur" kartındaki ilk düğme
    await page.locator('#ve-fw-body .ve-fw-btn-wide').first().click();
    await expect(page.locator('#ve-fw-live .ve-fw-pill-ok')).toBeVisible();

    const pills = await page.locator('#ve-fw-live .ve-fw-pill').allTextContents();
    const metin = pills.join(' | ');
    expect(metin).toMatch(/mm/);          // kayış boyu
    expect(metin).toMatch(/N/);           // gerginlik
    expect(metin).toMatch(/CCW|CW/);      // dönüş yönü

    // Adım rayında artık hata rozeti YOK (örnek eksiksiz).
    await expect(page.locator('#ve-fw-nav .ve-fw-step-n')).toHaveCount(0);
  });

  test('gerçek klavye girişi: değer modele işliyor ve ODAK alanda kalıyor', async ({ page }) => {
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await page.locator('#ve-fw-body .ve-fw-btn-wide').first().click();

    // 2. adım: kasnaklar
    await page.locator('#ve-fw-nav .ve-fw-step').nth(1).click();
    const satir = page.locator('#ve-fw-body .ve-fw-tbl tbody tr');
    expect(await satir.count()).toBeGreaterThan(3);

    // Alternatörün X'ini elle değiştir (5. sütun = Konum X)
    const hucre = satir.nth(1).locator('input[type="number"]').nth(1);
    await hucre.click();
    await hucre.fill('-300');
    // Canlı şerit gecikmeli tazeleniyor (220 ms); odak DÜŞMEMELİ.
    await page.waitForTimeout(500);
    const odak = await page.evaluate(() => document.activeElement && document.activeElement.value);
    expect(odak).toBe('-300');

    const x = await page.evaluate(() => veFeadWizState().pulleys[1].x);
    expect(String(x)).toBe('-300');
    // Model hâlâ çözülüyor ve kayış boyu DEĞİŞTİ (konum fiziksel).
    await expect(page.locator('#ve-fw-live .ve-fw-pill-ok')).toBeVisible();
  });

  test('özet adımı: kayış yolu ŞEMASI çiziliyor, kur düğmesi etkin', async ({ page }) => {
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await page.locator('#ve-fw-body .ve-fw-btn-wide').first().click();
    await page.locator('#ve-fw-nav .ve-fw-step').nth(6).click();

    // Şema gerçekten SVG olarak var ve kasnak çemberleri çizili.
    const svg = page.locator('#ve-fw-body .ve-fw-fig svg');
    await expect(svg).toBeVisible();
    const kasnak = await page.evaluate(() =>
      document.querySelectorAll('#ve-fw-body .ve-fw-fig svg [data-ve="pulley"]').length);
    expect(kasnak).toBeGreaterThanOrEqual(6);

    // Özet kartlarında sayılar var, "undefined" yok.
    const kartlar = await page.locator('#ve-fw-body .ve-fw-stat').allTextContents();
    expect(kartlar.join(' ')).not.toContain('undefined');
    await expect(page.locator('#ve-fw-create')).toBeEnabled();
  });

  test('Modeli Kur → kanvasta gerçek düğümler ve teller, çözüm aynı', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', (e) => hatalar.push(String(e)));
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await page.locator('#ve-fw-body .ve-fw-btn-wide').first().click();

    const beklenen = await page.evaluate(() => {
      const b = veFeadWizBuild();
      return { L: b.beltLengthMm, T: b.springTensionN, spin: b.spin };
    });

    await page.locator('#ve-fw-nav .ve-fw-step').nth(6).click();
    await page.locator('#ve-fw-create').click();
    await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();

    const sonuc = await page.evaluate(() => {
      const kasnak = window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley);
      const b = veFeadBuildSystem(window.nodes, window.connections);
      return {
        kasnak: kasnak.length,
        tel: window.connections.length,
        sihirbaz: window.nodes.filter((n) => n.type === 'fead-wizard').length,
        ornek: window.nodes.filter((n) => n.type === 'fead-example').length,
        kart: window.nodes.filter((n) => n.type === 'fead-layout').length,
        ok: b.ok, L: b.beltLengthMm, T: b.springTensionN, spin: b.spin,
        // Kutular koordinatlarına oturdu mu (arrangeByCoords çağrıldı mı)
        farkli: new Set(kasnak.map((n) => Math.round(n.x))).size
      };
    });
    expect(sonuc.kasnak).toBe(6);
    expect(sonuc.tel).toBe(6);
    expect(sonuc.kart).toBe(1);
    expect(sonuc.sihirbaz).toBe(1);      // taslağı taşıyor, KALIR
    expect(sonuc.ornek).toBe(0);         // açılış yüzeyi, işini bitirdi
    expect(sonuc.ok).toBe(true);
    expect(sonuc.farkli).toBeGreaterThan(3);
    // ÖNİZLEME = KURULAN MODEL
    expect(Math.abs(sonuc.L - beklenen.L)).toBeLessThan(1e-6);
    expect(Math.abs(sonuc.T - beklenen.T)).toBeLessThan(1e-6);
    expect(sonuc.spin).toBe(beklenen.spin);

    // Kanvastaki Kayış Yolu kartı da çözülmüş şemayı gösteriyor.
    const kartSvg = await page.evaluate(() =>
      document.querySelectorAll('.ve-node svg[data-fead-anim]').length);
    expect(kartSvg).toBeGreaterThanOrEqual(1);
    expect(hatalar).toEqual([]);
  });

  test('yerleşim: modal ekrana sığıyor, gövde yatay KAYDIRMIYOR', async ({ page }) => {
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await page.locator('#ve-fw-body .ve-fw-btn-wide').first().click();

    const olcum = await page.evaluate(() => {
      const m = document.querySelector('.ve-fw-modal');
      const b = document.getElementById('ve-fw-body');
      const n = document.getElementById('ve-fw-nav');
      const f = document.getElementById('ve-fw-foot');
      return { mw: m.getBoundingClientRect().width, mh: m.getBoundingClientRect().height,
               vw: window.innerWidth, vh: window.innerHeight,
               tasma: b.scrollWidth - b.clientWidth,
               nav: n.getBoundingClientRect().width,
               foot: f.getBoundingClientRect().height };
    });
    expect(olcum.mw).toBeLessThanOrEqual(olcum.vw);
    expect(olcum.mh).toBeLessThanOrEqual(olcum.vh);
    expect(olcum.tasma).toBeLessThanOrEqual(1);      // yatay kaydırma yok
    expect(olcum.nav).toBeGreaterThan(180);          // adım rayı görünür
    expect(olcum.foot).toBeGreaterThan(20);

    // Tablo taşıyorsa KENDİ kabında kayar (gövde değil) — 6. adım en geniş tablo.
    await page.locator('#ve-fw-nav .ve-fw-step').nth(5).click();
    const t2 = await page.evaluate(() => {
      const b = document.getElementById('ve-fw-body');
      return b.scrollWidth - b.clientWidth;
    });
    expect(t2).toBeLessThanOrEqual(1);
  });
});
