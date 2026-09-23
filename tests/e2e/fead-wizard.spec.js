/**
 * fead-wizard.spec.js — FEAD BAŞLANGIÇ SİHİRBAZI (gerçek tarayıcı)
 *
 * Birim testler sihirbazın ÇEVİRİSİNİ sınıyor (durum → düğüm → çözüm) ve o
 * zincir Node'da eksiksiz koşuyor. Buradaki soru başka: YÜZEY ayakta mı?
 *
 * Node'da HİÇ koşmayan halkalar: modal kabuğunun gerçekten açılması, adım
 * rayının tıklanabilirliği, gerçek klavye girişi (ve odağın alanda KALMASI —
 * canlı şerit her tuşta tam yeniden çizim yapsaydı odak düşerdi), kayış yolu
 * şemasının SVG olarak çizilmesi, ve "Modeli Kur" düğmesinin kanvasa gerçek
 * düğüm kurması.
 *
 * ── 2026-09-07: BU DOSYA İKİ TURDUR BAYATTI, SESSİZCE ────────────────────
 *
 * CI'daki `e2e-urun` işi yalnız üç ÜRÜN spec'ini koşturuyor (published ·
 * viewer · can-cozumleyici), yani buradaki kırılma hiçbir kapıdan görünmedi.
 * İki kaynağı vardı ve ikisi de kendi turunda güncellenmeliydi:
 *
 *   • ADIM SAYISI 7 → 6 (PR #872): "Kayış Yolu" adımı kaldırıldı, yeteneği
 *     Kasnaklar tablosuna taşındı. Eski → yeni indeks: 0→0 · 1→1 ·
 *     2 (yol) silindi · 3→2 · 4→3 · 5→4 · 6→5.
 *   • ÖRNEK SEÇİCİ (PR #868): kart düğmeleri (`.ve-fw-btn-wide`) yerine
 *     <select> + ↑↓ gezinme geldi. Konumsal tıklama zaten kırılgandı; seçim
 *     artık ÜRETİCİDEN yapılıyor (`veFeadWizSeed`), yeni spec'lerin yolu.
 */
const { test, expect } = require('@playwright/test');

// ÖRNEK SEÇİMİ ÜRETİCİDEN, konumdan DEĞİL. Anahtar verilmezse listenin ilki —
// kaldırılan kart düğmelerinin `.first()` davranışının birebir karşılığı.
const ornekKur = (page, key) => page.evaluate((k) => {
  veFeadWizSeed(k || veFeadExampleKeys()[0]);
  veFeadWizRender();
}, key || null);

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

    // AÇILIŞ YÜZEYİ: sihirbaz + BOŞ Kayış Yolu kartı (Çizim Masası,
    // 2026-09-23 — tablo kanvastan indi, kartın düğmesiyle açılan pencere).
    // "Başlangıç ve Örnekler" (`fead-example`) 2026-09-09'da KALDIRILDI —
    // sunduğu iki şey (sihirbaz düğmesi + örnek listesi) sihirbazın 1.
    // adımında zaten vardı. Bu spec o gün sessizce öldü: hâlâ o tipin
    // VARLIĞINI bekliyordu. Kapı artık ters yönde duruyor, yani bileşen geri
    // gelirse burada görünür.
    const tipler = await page.evaluate(() => window.nodes.map((n) => n.type));
    expect(tipler).toContain('fead-wizard');
    expect(tipler).toContain('fead-layout');
    expect(tipler).not.toContain('fead-table');
    expect(tipler).not.toContain('fead-example');

    // ÇİFT TIK sihirbazı açar (alt-sistem kartlarındaki el alışkanlığı).
    // BOŞ TOPOLOJİ ZATEN SİHİRBAZLA KARŞILIYOR (2026-09-09), yani pencere açık
    // ve `dblclick`i yutuyor — bu satır o gün 30 sn zaman aşımına düşmeye
    // başladı. Ölçülmek istenen şey karşılama değil ÇİFT TIK, o yüzden pencere
    // önce kapatılıyor: kullanıcı da karşılamayı kapatıp düğüme çift tıklar.
    const id = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-wizard').id);
    await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(true); });
    await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();
    await page.dblclick('#' + id);
    await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();

    // Adımlar rayda duruyor (Kayış Yolu adımı 2026-09-04'te kalktı: altı).
    await expect(page.locator('#ve-fw-nav .ve-fw-step')).toHaveCount(6);
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
    await ornekKur(page);
    await expect(page.locator('#ve-fw-live .ve-fw-pill-ok')).toBeVisible();

    const pills = await page.locator('#ve-fw-live .ve-fw-pill').allTextContents();
    const metin = pills.join(' | ');
    expect(metin).toMatch(/mm/);          // kayış boyu
    expect(metin).toMatch(/N/);           // gerginlik
    expect(metin).toMatch(/CCW|CW/);      // dönüş yönü

    // Adım rayında artık KIRMIZI adım yok (örnek eksiksiz). Rozet HER adımda
    // duruyor — tamamlanmışta ✓ — yani ölçüt rozetin varlığı değil DURUMU.
    await expect(page.locator('#ve-fw-nav .ve-fw-st-err')).toHaveCount(0);
    await expect(page.locator('#ve-fw-nav .ve-fw-st-ok')).toHaveCount(6);
  });

  test('gerçek klavye girişi: değer modele işliyor ve ODAK alanda kalıyor', async ({ page }) => {
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await ornekKur(page);

    // 2. adım: kasnaklar
    await page.locator('#ve-fw-nav .ve-fw-step').nth(1).click();
    const satir = page.locator('#ve-fw-body .ve-fw-tbl tbody tr');
    expect(await satir.count()).toBeGreaterThan(3);

    // Alternatörün X'ini elle değiştir.
    // ALAN ARTIK `type="text" inputmode="decimal"` — `type="number"` virgülü
    // yutuyordu (kullanıcı isteği, 2026-09-01), o yüzden seçici de değişti.
    //
    // HÜCRE SÜTUN SIRASINDAN DEĞİL YAZDIĞI ALANDAN seçiliyor. Sıra indisiyle
    // (`.nth(1)`) seçen eski hâl, tabloya bir sütun eklenince SESSİZCE başka
    // bir hücreyi dolduruyordu: test 130,1'i çapa yazıp X'in değişmemesine
    // bakıyor, ve kırmızılık ancak sayıya bakınca anlaşılıyordu.
    // SATIR DA GERGİYİ DIŞLIYOR: gergi satırı aynı tbody'de ve kendi
    // yazıcılarını kullanıyor (`veFeadWizTenSet`), yani `.nth(1)` ona düşünce
    // aranan alan o satırda HİÇ yok ve tık 30 sn bekliyordu.
    const kasnakSatir = page.locator('#ve-fw-body .ve-fw-tbl tbody tr:not(.ve-fw-tr-ten)');
    const hucre = kasnakSatir.nth(1).locator('input[oninput*="\'x\',this.value"]');
    await expect(hucre).toHaveCount(1);
    // HANGİ KASNAĞA YAZDIĞIMIZI SATIRIN KENDİSİ SÖYLESİN: tablo `pulleys`
    // dizisi sırasıyla değil KAYIŞ SIRASIYLA çiziliyor, yani satır indisi ile
    // dizi indisi aynı olmak zorunda değil. Anahtar, satırın kendi
    // yazıcısından okunuyor.
    const pKey = await hucre.evaluate((el) =>
      (el.getAttribute('oninput').match(/veFeadWizPulleySet\('([^']+)'/) || [])[1]);
    expect(pKey).toBeTruthy();
    await hucre.click();
    await hucre.fill('-300');
    // Canlı şerit gecikmeli tazeleniyor (220 ms); odak DÜŞMEMELİ.
    await page.waitForTimeout(500);
    const odak = await page.evaluate(() => document.activeElement && document.activeElement.value);
    expect(odak).toBe('-300');

    const x = await page.evaluate((k) =>
      (veFeadWizState().pulleys.find((p) => p.key === k) || {}).x, pKey);
    expect(String(x)).toBe('-300');
    // Model hâlâ çözülüyor ve kayış boyu DEĞİŞTİ (konum fiziksel).
    await expect(page.locator('#ve-fw-live .ve-fw-pill-ok')).toBeVisible();
  });

  test('özet adımı: kayış yolu ŞEMASI çiziliyor, kur düğmesi etkin', async ({ page }) => {
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await ornekKur(page);
    await page.locator('#ve-fw-nav .ve-fw-step').nth(5).click();   // Özet ve Kurulum

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
    await ornekKur(page);

    const beklenen = await page.evaluate(() => {
      const b = veFeadWizBuild();
      return { L: b.beltLengthMm, T: b.springTensionN, spin: b.spin };
    });

    await page.locator('#ve-fw-nav .ve-fw-step').nth(5).click();   // Özet ve Kurulum
    await page.locator('#ve-fw-create').click();
    await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();

    const sonuc = await page.evaluate(() => {
      const kasnak = window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley);
      const b = veFeadBuildSystem(window.nodes);
      return {
        kasnak: kasnak.length,
        // YÖNÜN/ SIRANIN TAŞIYICISI TEL DEĞİL, İNDİS (2026-09-09). Eski kapı
        // `connections.length === 6` bekliyordu; kasnaklar bağlanmaz oldu,
        // sayı 0'a düştü ve bu spec o gün sessizce öldü. Bugünkü karşılığı:
        // her kasnak 1..N arasında TEK BİR indis taşıyor.
        tel: window.connections.length,
        indis: kasnak.map((n) => n.data.beltIndex).sort((x, y) => x - y).join(','),
        sihirbaz: window.nodes.filter((n) => n.type === 'fead-wizard').length,
        ornek: window.nodes.filter((n) => n.type === 'fead-example').length,
        kart: window.nodes.filter((n) => n.type === 'fead-layout').length,
        ok: b.ok, L: b.beltLengthMm, T: b.springTensionN, spin: b.spin,
        // KOORDİNAT KUTUDA DEĞİL VERİDE: kasnakların kanvasta kutusu yok
        // (`noCanvasBox`), dolayısıyla `n.x` artık bir yerleşim ayrıntısı.
        // Ölçülmesi gereken şey mm koordinatlarının taşınmış olması.
        farkli: new Set(kasnak.map((n) => Math.round(n.data.x))).size
      };
    });
    expect(sonuc.kasnak).toBe(6);
    expect(sonuc.tel).toBe(0);           // kasnaklar BAĞLANMAZ
    expect(sonuc.indis).toBe('1,2,3,4,5,6');
    expect(sonuc.kart).toBe(2);          // geometri + işletme ön ayarı
    expect(sonuc.sihirbaz).toBe(1);      // taslağı taşıyor, KALIR
    expect(sonuc.ornek).toBe(0);         // bileşen KALDIRILDI, geri gelmemeli
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

  test('gergi satırı Kasnaklar tablosunda — silinemez ve odak DÜŞMÜYOR', async ({ page }) => {
    // Mevcut odak kapısı bir KASNAK satırını ölçüyor; gergi satırı ayrı bir
    // kod yolu (veFeadWizTenSet) ve tam yeniden çizim tetiklerse orada odak
    // düşerdi — bu regresyon kasnak satırından GÖRÜNMEZ.
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await ornekKur(page);
    await page.locator('#ve-fw-nav .ve-fw-step').nth(1).click();

    const ten = page.locator('#ve-fw-body tr.ve-fw-tr-ten');
    await expect(ten).toHaveCount(1);
    await expect(ten.locator('button.ve-fw-x')).toBeDisabled();
    await expect(ten.locator('input[type="radio"]')).toBeDisabled();

    // X hücresine gerçek klavyeyle yaz — değer modele işlemeli, odak kalmalı.
    const x = ten.locator('input[inputmode="decimal"]').nth(1);
    await x.click();
    await x.fill('-168.4');
    await page.waitForTimeout(450);
    const odak = await page.evaluate(() => document.activeElement && document.activeElement.value);
    expect(odak).toBe('-168.4');
    const st = await page.evaluate(() => {
      const s = veFeadWizState();
      const k = veFeadWizTenCoordKeys(s);
      return { mod: s.tenMode, deger: s.ten[k[0]], anahtar: k[0] };
    });
    expect(String(st.deger)).toBe('-168.4');

    // Aynı değer Otomatik Gergi adımının ALANINDA da duruyor (tek kayıt, iki
    // yüzey). toContainText KULLANILMAZ: input DEĞERİ metin içeriği değildir,
    // o kapı kod doğruyken bile kırmızı verir.
    await page.locator('#ve-fw-nav .ve-fw-step').nth(2).click();   // Otomatik Gergi
    const dortAdim = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#ve-fw-body input'))
        .map((i) => i.value).filter((v) => v === '-168.4').length);
    expect(dortAdim).toBeGreaterThan(0);
  });

  // SATIR TAŞIMA BASILAN YÖNDE — GERÇEK TIKLAMAYLA.
  //
  // Kullanıcı isteği (2026-09-22): *"Tabloda otomatik gergiyi en son kısımda
  // görmek istiyoruz."* Tablo artık Gates/tablo sırasını basıyor ama model
  // sırası (`st.route`) GİDİŞ olarak kaldı; `veFeadWizPulleyMove` deltayı bu
  // yüzden ÇEVİRİYOR. Çevirmeyi unutmak sessiz bir kusur olurdu: kullanıcı
  // "aşağı" der, satır YUKARI gider. jsdom kapıları bunu göremez — okunan
  // sıraya bakabilirler, BASILAN satırların DOM'daki yerine değil.
  test('TABLO SIRASI: gergi SON satır ve ok satırı BASILAN yönde taşıyor', async ({ page }) => {
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await ornekKur(page);
    await page.locator('#ve-fw-nav .ve-fw-step').nth(1).click();

    const satirlar = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('.ve-fw-tbl-kasnak tbody tr')).map((tr) =>
        tr.classList.contains('ve-fw-tr-ten') ? '__ten__'
          : (tr.querySelector('input[type="text"]') || {}).value || '?'));

    const once = await satirlar();
    expect(once[once.length - 1]).toBe('__ten__');        // GERGİ SON SATIR

    // İKİ UÇ KİLİTLİ ve kilit sessiz değil — `disabled` basılıyor.
    const tr = page.locator('.ve-fw-tbl-kasnak tbody tr');
    await expect(tr.nth(0).locator('.ve-fw-mini').nth(0)).toBeDisabled();
    await expect(tr.nth(0).locator('.ve-fw-mini').nth(1)).toBeDisabled();
    await expect(tr.last().locator('.ve-fw-mini').nth(0)).toBeDisabled();
    await expect(tr.last().locator('.ve-fw-mini').nth(1)).toBeDisabled();

    // 2. satırın ↓'sine GERÇEK tıkla: o satır BİR AŞAĞI inmeli.
    const tasinan = once[1];
    await tr.nth(1).locator('.ve-fw-mini').nth(1).click();
    await page.waitForTimeout(350);
    const sonra = await satirlar();
    expect(sonra[2]).toBe(tasinan);                        // AŞAĞI indi
    expect(sonra[1]).toBe(once[2]);                        // komşu yukarı çıktı
    expect(sonra[0]).toBe(once[0]);                        // sürücü yerinde
    expect(sonra[sonra.length - 1]).toBe('__ten__');       // gergi hâlâ sonda
  });

  test('aksesuar modeli açılır pencereden seçilir, kW elle GİRİLMEZ', async ({ page }) => {
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    // AG00976: gücü duty kW'da duran örnek (aksesuarların eğrisi yok)
    await ornekKur(page, 'AG00976_GATES_2025');
    await page.locator('#ve-fw-nav .ve-fw-step').nth(4).click();   // Motor ve Çevrim

    await expect(page.locator('#ve-fw-body')).toContainText('Aksesuar Modelleri');
    // Duty tablosunda kW artık GİRDİ değil
    const kwInput = await page.evaluate(() =>
      document.querySelectorAll('#ve-fw-body [oninput*="veFeadWizDutyKw"]').length);
    expect(kwInput).toBe(0);

    // TEK YAZICI (2026-09-01): iki katalog tek seçicide birleşti.
    const sec = page.locator('#ve-fw-body select[onchange*="veFeadWizAccModel"]');
    expect(await sec.count()).toBeGreaterThanOrEqual(1);
    const once = await page.evaluate(() => {
      const s = veFeadWizState();
      const alt = s.pulleys.find((p) => p.type === 'fead-alternator');
      return { kayit: s.solver.duty[0].kw[alt.key], preset: alt.accPreset };
    });
    expect(once.preset).toBeUndefined();
    expect(once.kayit).toBeGreaterThan(0);

    // Alternatör modelini seç → kayıtlı kW temizlenir, katalog devreye girer
    const altSec = page.locator('#ve-fw-body tr', { hasText: 'Alternatör' })
      .locator('select[onchange*="veFeadWizAccModel"]').first();
    // Araç Performans kataloğundan bir kayıt seç (`ap:` ön ekli) — `accPreset`
    // yolunu ölçmek için; BMC kayıtları `accLib` + eğri yazıyor, o ayrı kapıda.
    const apDeger = await altSec.evaluate((e) =>
      [...e.options].map((o) => o.value).find((v) => v.indexOf('ap:') === 0));
    await altSec.selectOption(apDeger);
    await page.waitForTimeout(400);
    const sonra = await page.evaluate(() => {
      const s = veFeadWizState();
      const alt = s.pulleys.find((p) => p.type === 'fead-alternator');
      const b = veFeadWizBuild();
      return { kayit: s.solver.duty[0].kw[alt.key], preset: alt.accPreset,
               dugum: veFeadWizNodes(s).nodes.find((n) => n.id === 'wz-' + alt.key).data.accPreset,
               ok: b.ok };
    });
    expect(sonra.preset).toBeTruthy();
    expect(sonra.kayit).toBeUndefined();      // kayıtlı kW temizlendi
    expect(sonra.dugum).toBe(sonra.preset);   // çözüme gidiyor
    expect(sonra.ok).toBe(true);
  });

  test('yerleşim: modal ekrana sığıyor, gövde yatay KAYDIRMIYOR', async ({ page }) => {
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await ornekKur(page);

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

    // Tablo taşıyorsa KENDİ kabında kayar (gövde değil) — Motor ve Çevrim en geniş tablo.
    await page.locator('#ve-fw-nav .ve-fw-step').nth(4).click();   // Motor ve Çevrim
    const t2 = await page.evaluate(() => {
      const b = document.getElementById('ve-fw-body');
      return b.scrollWidth - b.clientWidth;
    });
    expect(t2).toBeLessThanOrEqual(1);
  });

  // ── KOZMETİK TUR (kullanıcı bildirimi, 2026-08-31) ──────────────────────
  //
  // İkisi de yalnız GERÇEK TARAYICIDA ölçülebilir: hesaplanmış yükseklik ve
  // hesaplanmış renk Node'da YOKTUR. Birim kapıları CSS kuralının metnine
  // bakabiliyor, sonucuna bakamıyor.
  test('alt çubuk modalın KENDİ başlığından kalın değil', async ({ page }) => {
    // *"Yeşil ile çizdiğim yer çok geniş olmuş. Butonlar falan da çok geniş."*
    // ÖLÇÜLDÜ (öncesi): çubuk 48 px, başlık 39 px — 9 px kalın.
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));
    await page.evaluate(() => { veFeadWizSeed('AG00976_GATES_2025'); veFeadWizGoto(5); });

    const m = await page.evaluate(() => ({
      foot: document.getElementById('ve-fw-foot').getBoundingClientRect().height,
      head: document.querySelector('#ve-feadwiz-overlay .ve-settings-header').getBoundingClientRect().height,
      btn: [...document.querySelectorAll('#ve-fw-foot button')]
        .map((b) => b.getBoundingClientRect().height),
    }));
    // Çubuk başlıkla AYNI bantta (kenarlık payı 2 px).
    expect(Math.abs(m.foot - m.head)).toBeLessThanOrEqual(2);
    expect(m.btn.length).toBe(3);
    m.btn.forEach((h) => {
      expect(h).toBeLessThanOrEqual(26);   // eskiden 29
      expect(h).toBeGreaterThanOrEqual(20); // tıklanabilirlik tabanı
    });
  });

  test('adım rayı ÜÇ durumu da gerçekten yakıyor — renkle', async ({ page }) => {
    // *"eksik girdi olduğunda kırmızı, girdiler tam olduğunda belirgin yeşil."*
    // Kapı sınıf ADINA değil HESAPLANMIŞ RENGE bakıyor: sınıf basılıp CSS
    // kuralı düşse ray yine sessiz kalırdı (ölçüldü: st-ok kuralını silen
    // mutasyon yalnız buradan görünür).
    await bootApp(page);
    await openFead(page);
    await page.evaluate(() => veFeadWizOpen(window.nodes.find((x) => x.type === 'fead-wizard').id));

    const oku = () => [...document.querySelectorAll('#ve-fw-nav .ve-fw-step')].map((li) => {
      const n = li.querySelector('.ve-fw-step-n');
      return { durum: (li.className.match(/ve-fw-st-(\w+)/) || [])[1] || null,
               rozet: n ? n.textContent : null,
               serit: getComputedStyle(li).borderLeftColor,
               zemin: n ? getComputedStyle(n).backgroundColor : null };
    });

    // BOŞ sihirbaz: eksik adımlar KIRMIZI ve sayı taşıyor.
    const bos = await page.evaluate(oku);
    expect(bos.length).toBe(6);
    const kirmizi = bos.filter((r) => r.durum === 'err');
    expect(kirmizi.length).toBeGreaterThan(0);
    kirmizi.forEach((r) => {
      expect(r.serit).toBe(r.zemin);              // şerit ve rozet AYNI renkte
      expect(Number(r.rozet)).toBeGreaterThan(0); // sayı, ✓ değil
    });
    // ...ve renk gerçekten kırmızı ailesinden. AİLE TONDAN (HSV) ölçülür:
    // ilk hâli kanal farkıyla ölçüyordu (R > G + 60 / G > R + 60) ve Atölye
    // paletinin yeşili #2f6b45'te G − R TAM 60 — renk açıkça yeşil (ton 142°,
    // doygunluk .56) ama vekil eşikte kırılıyordu. Ton + doygunluk NİYETİN
    // kendisi ("kırmızı" / "belirgin yeşil") ve korunmak istenen mutasyonu
    // (st-ok kuralı silinir → nötr gri rozet, doygunluk ≈ .06) yine yakalar.
    const rgb = (c) => c.match(/\d+/g).map(Number);
    const hsv = (c) => {
      const [r, g, b] = rgb(c).slice(0, 3).map((v) => v / 255);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0;
      if (d) {
        h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
      }
      return { h, s: mx ? d / mx : 0 };
    };
    const k = hsv(kirmizi[0].zemin);
    expect(k.h <= 20 || k.h >= 340).toBe(true);
    expect(k.s).toBeGreaterThan(0.4);

    // DOLU örnek: altısı da YEŞİL ve ✓ taşıyor.
    await page.evaluate(() => veFeadWizSeed('AG00976_GATES_2025'));
    const dolu = await page.evaluate(oku);
    expect(dolu.every((r) => r.durum === 'ok')).toBe(true);
    expect(dolu.every((r) => r.rozet === '✓')).toBe(true);
    const y = hsv(dolu[0].zemin);                  // yeşil ailesi
    expect(y.h).toBeGreaterThanOrEqual(90);
    expect(y.h).toBeLessThanOrEqual(170);
    expect(y.s).toBeGreaterThan(0.4);

    // ARADA: bir kasnağın çapı silinince O ADIM ayrışıyor, kalanlar yeşil kalır.
    await page.evaluate(() => { veFeadWizState().pulleys[2].od = ''; veFeadWizRender(); });
    const eksik = await page.evaluate(oku);
    expect(eksik[1].durum).not.toBe('ok');
    expect(eksik.filter((r) => r.durum === 'ok').length).toBe(eksik.length - 1);
  });
});
