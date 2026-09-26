/**
 * fead-sihirbaz-tablo.spec.js — SİHİRBAZIN "MODELİ KUR"U NE KURUYOR?
 *
 * Kullanıcı sorusu (2026-09-09): *"Başlangıç sihirbazı kısmında 'modeli kur'
 * dediğimizde bu yapı gelecek değil mi? Yoksa hâlâ bileşenler mi gelecek?"*
 *
 * Cevap: kasnaklar MODELDE düğüm olarak kurulur (kutuları yok — 2026-09-09)
 * ve Kayış Yolu çiziminde görünür; kayış SIRASI Kayış Tablosu'nda (geometri
 * kartının çiziminin altındaki Pafta). Bu dosya onu gerçek tarayıcıda ölçüyor.
 *
 * Node'da HİÇ koşmayan halka: sihirbazın GERÇEK "Modeli Kur" düğmesine
 * tıklamak, createNode'un maxInstances kapısına çarpması ve kurulum sonrası
 * kanvasın hâli. Kurulum yolu örnek kurucusundan AYRI bir döngü — birinde
 * düzeltilen bir kusur ötekinde yaşayabilir (ölçüldü: `fead-table` araç
 * yeniden kullanım listesinde yoktu, sihirbaz ikinci tablo kurmaya kalkıp
 * uyarı basıyordu).
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

test('sihirbaz "Modeli Kur": kasnaklar + İKİ ÇİZİM, tel yok, uyarı yok', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));

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

  // FEAD alt topolojisi — açılışta sihirbaz + BOŞ Kayış Yolu kartı gelir, VE
  // SİHİRBAZ AÇILIR (tablo 2026-09-26'dan beri kartın kendi katmanı).
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-wizard'),
    null, { timeout: 20000 });

  // ── BOŞ TOPOLOJİ SİHİRBAZLA KARŞILIYOR ─────────────────────────────────
  // Kullanıcı isteği (2026-09-09): *"FEAD modülünü ana topoloji kısmından
  // açtığım zaman, direkt karşıma 'Başlangıç Sihirbazı' bileşeninin gelmesini
  // istiyorum."* Eskiden karşılayan şey BOŞ bir Kayış Tablosuydu.
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();
  // Kapatınca iç topoloji ayakta kalıyor — bu bir karşılama, kapı değil.
  await page.evaluate(() => veFeadWizClose(false));
  await page.waitForTimeout(200);
  await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();
  const acilis = await page.evaluate(() => window.nodes.map((n) => n.type).sort());
  // "Başlangıç ve Örnekler" 2026-09-09'da kaldırıldı (kullanıcı: *"Gerek yok"*)
  // — sunduğu liste sihirbazın 1. adımında zaten vardı.
  expect(acilis).toEqual(['fead-layout', 'fead-wizard']);
  // Boş kart kendi boş hâlini söylüyor ve iki yolu da gösteriyor.
  expect(await page.evaluate(() =>
    (document.querySelector('.ve-fead-kan-bos') || {}).textContent || '')).toMatch(/henüz kasnak yok/);
  const bosId = await page.evaluate(() => window.nodes.find((n) => n.type === 'fead-layout').id);
  expect(await page.evaluate(() =>
    window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length)).toBe(0);

  // Sihirbazı aç ve bir örnekle doldur (formu 7 adım elle doldurmak yerine)
  await page.evaluate(() => {
    const w = window.nodes.find((n) => n.type === 'fead-wizard');
    veFeadWizOpen(w.id);
    veFeadWizSeed('AG00976_GATES_2025');
  });
  await page.waitForTimeout(300);
  const onizleme = await page.evaluate(() => {
    const b = veFeadWizBuild();
    return { L: b.beltLengthMm, spin: b.spin, sira: b.order.map((n) => n.customName) };
  });

  // ── ADIMLARI GERÇEKTEN GEZ, SONRA DÜĞMEYE TIKLA ─────────────────────────
  // "Modeli Kur" yalnız SON adımda çizilir; ileri düğmesine gerçekten
  // tıklamak adımların da çizildiğini ölçüyor.
  const kurDugme = page.locator('#ve-fw-create');
  for (let i = 0; i < 12 && await kurDugme.count() === 0; i++) {
    // Seçici sihirbazın KENDİ düğmesine daraltıldı: `hasText:'İleri'` üstteki
    // araç çubuğunun "İleri Al" (yinele) düğmesine takılıyordu.
    await page.locator('.ve-fw-btn-primary').click();
    await page.waitForTimeout(120);
  }
  await expect(kurDugme).toBeVisible();
  await expect(kurDugme).toBeEnabled();
  await kurDugme.click();
  await page.waitForFunction(() =>
    window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length === 6,
    null, { timeout: 20000 });

  // ── 1) KANVASTA NE VAR ──────────────────────────────────────────────────
  const durum = await page.evaluate(() => {
    const kas = (n) => !!(componentDefs[n.type] || {}).isFeadPulley;
    return {
      kasnak: window.nodes.filter(kas).length,
      tablo: window.nodes.filter((n) => n.type === 'fead-table').length,
      sema: window.nodes.filter((n) => n.type === 'fead-layout').length,
      kayis: window.nodes.filter((n) => n.type === 'fead-belt').length,
      cozucu: window.nodes.filter((n) => n.type === 'fead-solver').length,
      rapor: window.nodes.filter((n) => n.type === 'fead-report').length,
      kasnakTeli: window.connections.filter((c) => {
        const f = window.nodes.find((n) => n.id === c.from);
        const t = window.nodes.find((n) => n.id === c.to);
        return f && t && kas(f) && kas(t);
      }).length,
      toplam: window.nodes.length,
      tipler: window.nodes.map((n) => n.type).sort(),
      isletme: window.nodes.filter((n) => n.type === 'fead-layout'
        && (n.data || {}).katOn === 'isletme').length,
      indis: veFeadBeltOrder(window.nodes).map((n) => n.data.beltIndex),
      sira: veFeadBeltOrder(window.nodes).map((n) => n.customName),
    };
  });
  expect(durum.kasnak).toBe(6);              // BİLEŞENLER DE GELİYOR
  expect(durum.tablo).toBe(0);               // tablo bir kanvas düğümü DEĞİL
  expect(durum.sema).toBe(2);                // İKİ kanvas, tek tip (geometri + işletme)
  // ÜÇÜNCÜ ÇİZİM YOK: açılışın boş kartı geometri kartı olarak DEVRALINDI.
  expect(await page.evaluate((id) => window.nodes.some((n) => n.id === id), bosId)).toBe(true);
  expect(durum.kayis).toBe(1);
  expect(durum.cozucu).toBe(1);
  expect(durum.rapor).toBe(1);
  expect(durum.kasnakTeli).toBe(0);          // KASNAKLAR BAĞLANMIYOR
  // KASNAKLARIN KUTUSU DA YOK: kanvastaki her kutu bir araç düğümü.
  const kutu = await page.evaluate(() => {
    const kas = (n) => !!(componentDefs[n.type] || {}).isFeadPulley;
    return {
      kasnakDom: window.nodes.filter(kas).filter((n) => document.getElementById(n.id)).length,
      domToplam: document.querySelectorAll('#ve-canvas .ve-node').length,
      aracSay: window.nodes.filter((n) => !kas(n)).length,
    };
  });
  expect(kutu.kasnakDom).toBe(0);
  expect(kutu.domToplam).toBe(kutu.aracSay);
  // ÖKSÜZ DÜĞÜM YOK: 6 kasnak + kayış + çözücü + şema + İŞLETME kartı + rapor
  // + sihirbaz (taslağı taşıdığı için KALIR) = 12.
  //
  // SAYI 13 → 12 (2026-09-23): Kayış Tablosu kanvas düğümü olmaktan çıktı.
  // Kanvas GEOMETRİ ve İŞLETME olarak iki kart; kurucu ikincisini kurmayı
  // unutursa sihirbazla kurulan model çalışma rejimi kartsız kalır ve bu
  // SESSİZDİR — model çözülür, kart yalnız yoktur.
  //
  // TİP TEK (2026-09-11): ikisi de `fead-layout`, ayrım ÖN AYARDA. Ölçüt bu
  // yüzden tip sayısı DEĞİL — iki kanvas + biri işletme ön ayarlı. Sihirbazın
  // araç eşleştirmesi yalnız tipe baksaydı ikinci kanvası her "Modeli Kur"da
  // YENİDEN kurardı (kartlar üst üste açıldığı için sessiz).
  expect(durum.toplam).toBe(12);
  expect(durum.tipler.filter((t) => t === 'fead-layout')).toHaveLength(2);
  expect(durum.tipler.filter((t) => t === 'fead-run')).toHaveLength(0);
  expect(durum.isletme).toBe(1);
  expect(durum.tipler.filter((t) => t === 'fead-example')).toHaveLength(0);
  expect(durum.indis).toEqual([1, 2, 3, 4, 5, 6]);
  expect(durum.sira).toEqual(onizleme.sira); // önizlemeyle AYNI sıra

  // ── 1b) ARAÇ ÇUBUĞU SAYACI DA DOĞRU ─────────────────────────────────────
  // "Başlangıç ve Örnekler" düğümü `nodes`'tan doğrudan splice ediliyor
  // (deleteSelectedNodes bilerek kullanılmıyor), dolayısıyla sayacı kurucunun
  // KENDİSİ tazelemek zorunda. ÖLÇÜLDÜ: tazelenmeyince dizi bir eksik sayıyla
  // görünüyordu — bir sonraki topoloji değişimine kadar bayat.
  const cubuk = await page.locator('.ve-toolbar-info').first().innerText();
  expect(cubuk).toMatch(new RegExp(durum.toplam + ' bileşen'));
  expect(cubuk).toMatch(/0 bağlantı/);

  // ── 2) UYARI TOAST'I ÇIKMAMALI ──────────────────────────────────────────
  // Açılış yüzeyinin düğümü yeniden kullanım listesinde yoksa createNode
  // ikincisini reddediyor ve kullanıcı "en fazla 1 tane olabilir" görüyordu
  // (ölçüldü — o gün Kayış Tablosu'yla).
  const toastlar = (await page.locator('.ve-toast, [class*="toast"]').allInnerTexts()).join(' ');
  expect(toastlar).not.toMatch(/en fazla 1 tane/);

  // ── 3) TABLO KURULAN MODELİ GÖSTERİYOR — geometri kartının Paftası ──────
  // Tablo 2026-09-26'dan beri Kayış Yolu kartının KATMANI: geometri ön ayarlı
  // kartta çizimin altında hep açık, düğmeye basmak gerekmiyor. İşletme kartı
  // tablosuz — sihirbazın kurduğu iki kanvastan yalnız biri taşıyor.
  const kart = page.locator('.ve-fead-pafta');
  await expect(kart).toHaveCount(1);
  await expect(kart).toBeVisible();
  await expect(kart.locator('tr[data-ve-node]')).toHaveCount(6);
  // ETİKET KISA, DEFTERİN ADI `title`DA. `textContent`, `innerText` DEĞİL:
  // ikincisi CSS'in `text-transform`unu uyguluyor ("Ø eff" → "Ø EFF").
  const govde = await kart.evaluate((el) => el.textContent);
  ['Ø eff', 'Sarım', 'Span']
    .forEach((t) => expect(govde).toContain(t));
  const ipuclari = await kart.evaluate((el) =>
    [...el.querySelectorAll('[title]')].map((e) => e.getAttribute('title')).join(' | '));
  ['Efektif Çap (mm)', 'Kasnak Dönüş Yönü', 'Span Uzunluğu (mm)']
    .forEach((t) => expect(ipuclari).toContain(t));
  // YÖN: açılır liste değil METİN DÜĞMESİ (altı satır, altısında da).
  await expect(kart.locator('select[data-ve="spin"]')).toHaveCount(0);
  await expect(kart.locator('button.ve-fead-pf-yon[data-ve="spin"]')).toHaveCount(6);
  await expect(kart.locator('select[data-ve="add-pulley"]')).toHaveCount(1);
  // KAYIŞ BOYU ROZETTE: boy satıra değil ÇEVRİME ait — tabloda ne birleşik
  // hücre ne künye satırı var; kartın sağ üst rozeti taşıyor.
  await expect(kart.locator('td[rowspan]')).toHaveCount(0);
  await expect(page.locator('.ve-fead-layout-card:has(.ve-fead-pafta) .ve-fead-kan-durum'))
    .toHaveAttribute('title', /L [\d.]+ mm/);

  // ── 4) ÇÖZÜM ÖNİZLEMEYLE BİREBİR ────────────────────────────────────────
  const kurulan = await page.evaluate(() => {
    const b = veFeadBuildFromCanvas();
    return { L: b.beltLengthMm, spin: b.spin, ok: b.ok, hata: b.errors };
  });
  expect(kurulan.ok).toBe(true);
  expect(kurulan.hata).toEqual([]);
  expect(kurulan.L).toBeCloseTo(onizleme.L, 6);
  expect(kurulan.spin).toBe(onizleme.spin);

  expect(hatalar).toEqual([]);
});
