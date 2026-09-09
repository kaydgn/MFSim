/**
 * fead-sihirbaz-tablo.spec.js — SİHİRBAZIN "MODELİ KUR"U NE KURUYOR?
 *
 * Kullanıcı sorusu (2026-09-09): *"Başlangıç sihirbazı kısmında 'modeli kur'
 * dediğimizde bu yapı gelecek değil mi? Yoksa hâlâ bileşenler mi gelecek?"*
 *
 * Cevap İKİSİ BİRDEN, ve bu bilinçli: kasnak kutuları kanvasta durur (kayış
 * düzlemindeki konumları modelin kendisi, ve tıklanınca detay paneli açılır),
 * kayış SIRASI ise Kayış Tablosu'nda. Bu dosya onu gerçek tarayıcıda ölçüyor.
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

test('sihirbaz "Modeli Kur": kasnaklar + TABLO, tel yok, uyarı yok', async ({ page }) => {
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

  // FEAD alt topolojisi — açılışta sihirbaz + örnekler + TABLO gelir
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-wizard'),
    null, { timeout: 20000 });
  const acilis = await page.evaluate(() => window.nodes.map((n) => n.type).sort());
  expect(acilis).toEqual(['fead-example', 'fead-table', 'fead-wizard']);
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
      indis: veFeadBeltOrder(window.nodes).map((n) => n.data.beltIndex),
      sira: veFeadBeltOrder(window.nodes).map((n) => n.customName),
    };
  });
  expect(durum.kasnak).toBe(6);              // BİLEŞENLER DE GELİYOR
  expect(durum.tablo).toBe(1);               // ve TEK tablo (ikinci kurulmuyor)
  expect(durum.sema).toBe(1);
  expect(durum.kayis).toBe(1);
  expect(durum.cozucu).toBe(1);
  expect(durum.rapor).toBe(1);
  expect(durum.kasnakTeli).toBe(0);          // KASNAKLAR BAĞLANMIYOR
  // ÖKSÜZ DÜĞÜM YOK: 6 kasnak + kayış + çözücü + şema + tablo + rapor +
  // sihirbaz (taslağı taşıdığı için KALIR) = 12. "Başlangıç ve Örnekler"
  // kurulumda siliniyor.
  expect(durum.toplam).toBe(12);
  expect(durum.tipler.filter((t) => t === 'fead-example')).toHaveLength(0);
  expect(durum.indis).toEqual([1, 2, 3, 4, 5, 6]);
  expect(durum.sira).toEqual(onizleme.sira); // önizlemeyle AYNI sıra

  // ── 1b) ARAÇ ÇUBUĞU SAYACI DA DOĞRU ─────────────────────────────────────
  // "Başlangıç ve Örnekler" düğümü `nodes`'tan doğrudan splice ediliyor
  // (deleteSelectedNodes bilerek kullanılmıyor), dolayısıyla sayacı kurucunun
  // KENDİSİ tazelemek zorunda. ÖLÇÜLDÜ: tazelenmeyince dizi 12 düğüm taşırken
  // çubuk 13 diyordu — bir sonraki topoloji değişimine kadar bayat.
  const cubuk = await page.locator('.ve-toolbar-info').first().innerText();
  expect(cubuk).toMatch(/12 bileşen/);
  expect(cubuk).toMatch(/0 bağlantı/);

  // ── 2) UYARI TOAST'I ÇIKMAMALI ──────────────────────────────────────────
  // `fead-table` araç yeniden kullanım listesinde yoksa createNode ikinci
  // tabloyu reddediyor ve kullanıcı "en fazla 1 tane olabilir" görüyordu.
  const toastlar = (await page.locator('.ve-toast, [class*="toast"]').allInnerTexts()).join(' ');
  expect(toastlar).not.toMatch(/en fazla 1 tane/);

  // ── 3) TABLO KURULAN MODELİ GÖSTERİYOR ──────────────────────────────────
  const kart = page.locator('.ve-fead-table-card').first();
  await expect(kart).toBeVisible();
  await expect(kart.locator('tbody tr')).toHaveCount(6);
  const govde = await kart.innerText();
  ['KASNAK', 'Efektif Çap(mm)', 'Kasnak Dönüş Yönü', 'Kayış Uzunluğu(mm)']
    .forEach((t) => expect(govde).toContain(t));
  await expect(kart.locator('select')).toHaveCount(6);           // yön açılır listeleri
  await expect(kart.locator('td[rowspan="6"]')).toHaveCount(1);  // birleşik kayış boyu

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
