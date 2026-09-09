/**
 * fead-tablo.spec.js — KAYIŞ TABLOSU GERÇEK TARAYICIDA
 *
 * Birim testler tablonun satırlarını ve sütun kimliklerini Node'da doğruluyor.
 * Buradaki soru başka: YÜZEY ayakta mı? Node'da HİÇ koşmayan halkalar —
 *
 *   • kartın kanvasa MONTE edilmesi (`veFeadApplyTableCard` → `.ve-node-box`),
 *   • gerçek bir `<input>`a yazıp `change` tetiklemek (`veFeadTableSet`),
 *   • satır okuna GERÇEK tıklamak ve sıranın kanvasta değişmesi,
 *   • iki kartın (şema + tablo) aynı düzenlemede birlikte tazelenmesi.
 *
 * Kart bir HTML öbeği olduğu için bir kablolama hatası birim testinden geçer,
 * tarayıcıda sessizce ölü bir tablo bırakırdı.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

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

test('Kayış Tablosu kanvasta: kurulur, yazılır, sıra değişir', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);

  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 20000 });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });

  // ── 1) KART KANVASA MONTE OLDU MU ───────────────────────────────────────
  const kart = page.locator('.ve-fead-table-card').first();
  await expect(kart).toBeVisible();
  const govde = await kart.innerText();
  // Başlıkta ad ile birim AYRI satırda (innerText'te aralarında \n var).
  ['KASNAK', 'Efektif Çap', 'Sarım Açısı', 'Σsarım', 'Σ toplam']
    .forEach((t) => expect(govde).toContain(t));
  expect(govde).not.toContain('X(mm)');

  // ── 1c) KASNAKLARIN KANVASTA KUTUSU YOK ─────────────────────────────────
  // Kullanıcı isteği (2026-09-09). Kasnaklar MODELDE düğüm olarak duruyor
  // (panel, geri-al, kayıt hepsi oradan) ama kanvasa kutu çizilmiyor.
  const kutu = await page.evaluate(() => {
    const kas = (n) => !!(componentDefs[n.type] || {}).isFeadPulley;
    return {
      kasnak: window.nodes.filter(kas).length,
      kasnakDom: window.nodes.filter(kas).filter((n) => document.getElementById(n.id)).length,
      aracDom: window.nodes.filter((n) => !kas(n)).filter((n) => document.getElementById(n.id)).length,
      domToplam: document.querySelectorAll('#ve-canvas .ve-node').length,
    };
  });
  expect(kutu.kasnak).toBe(6);
  expect(kutu.kasnakDom).toBe(0);                 // TEK BİR KUTU BİLE YOK
  expect(kutu.aracDom).toBe(kutu.domToplam);      // kanvastaki her kutu bir araç düğümü

  // ── 2) KASNAKLAR ARASINDA TEL YOK ───────────────────────────────────────
  const teller = await page.evaluate(() => {
    const kas = (id) => {
      const n = window.nodes.find((x) => x.id === id);
      return !!(n && (componentDefs[n.type] || {}).isFeadPulley);
    };
    return window.connections.filter((c) => kas(c.from) && kas(c.to)).length;
  });
  expect(teller).toBe(0);

  // Kamerayı tablonun üstüne getir: örnek kurulunca görünüm bütün kümeye
  // sığdırılıyor (zoom ~0,3) ve hücreler gerçek bir tıklama için fazla küçük
  // kalıyor. Zoom'u %100'e alıp kartı ortalıyoruz — ölçülen şey yerleşim değil,
  // KABLOLAMA.
  await page.evaluate(() => {
    const t = window.nodes.find((n) => n.type === 'fead-table');
    const w = document.getElementById('ve-canvas-wrapper');
    canvasZoom = 1;
    canvasOffset.x = w.clientWidth / 2 - (t.x + t.width / 2 - 3000);
    canvasOffset.y = w.clientHeight / 2 - (t.y + t.height / 2 - 3000);
    updateCanvasTransform();
  });

  // ── 3) GERÇEK BİR HÜCREYE YAZMAK MODELİ DEĞİŞTİRİYOR ────────────────────
  const once = await page.evaluate(() => {
    const b = veFeadBuildFromCanvas();
    const alt = window.nodes.find((n) => n.type === 'fead-alternator');
    return { L: b.beltLengthMm, altId: alt.id, od: alt.data.od };
  });
  // Alternatörün D sütunu: satırındaki üçüncü sayı alanı (X, Y, D)
  const satir = kart.locator('tr', { hasText: 'Alternatör' }).first();
  const dHucre = satir.locator('input').nth(2);
  await dHucre.fill('63,5');
  await dHucre.dispatchEvent('change');
  await page.waitForTimeout(150);

  const sonra = await page.evaluate((id) => {
    const n = window.nodes.find((x) => x.id === id);
    return { od: n.data.od, L: veFeadBuildFromCanvas().beltLengthMm };
  }, once.altId);
  expect(sonra.od).toBeCloseTo(63.5, 6);          // VİRGÜLLÜ giriş okundu
  expect(sonra.od).not.toBe(once.od);
  expect(sonra.L).not.toBeCloseTo(once.L, 3);     // çözüm gerçekten değişti

  // ── 4) SATIR OKU SIRAYI DEĞİŞTİRİYOR ────────────────────────────────────
  const siraOnce = await page.evaluate(() =>
    veFeadBeltOrder(window.nodes).map((n) => n.customName));
  // Üçüncü satırın "yukarı" oku (ilk satır sürücü — kilitli)
  await kart.locator('tbody tr').nth(2).locator('button[title*="yukarı"]').click();
  await page.waitForTimeout(150);
  const siraSonra = await page.evaluate(() =>
    veFeadBeltOrder(window.nodes).map((n) => n.customName));
  expect(siraSonra).not.toEqual(siraOnce);
  expect(siraSonra[0]).toBe(siraOnce[0]);                     // sürücü yerinde
  expect(siraSonra[1]).toBe(siraOnce[2]);                     // takas oldu
  expect(siraSonra.slice().sort()).toEqual(siraOnce.slice().sort());   // kasnak kaybı yok

  // ── 5) SÜRÜCÜ SATIRININ OKLARI PASİF — ama YİNE DE DÜĞME ────────────────
  // Eskiden pasif okun yerine soluk bir <span> basılıyordu ve o, klavyeyle
  // gezinen ya da ekran okuyucu kullanan biri için hiç VAR OLMAYAN bir
  // düğmeydi: "burada bir eylem var ama şu an kullanılamıyor" bilgisi hiç
  // verilmiyordu. `disabled` düğme ikisini birden söylüyor.
  const ilkSatir = kart.locator('tbody tr').first();
  await expect(ilkSatir.locator('button[title*="taşı"]')).toHaveCount(2);
  await expect(ilkSatir.locator('button[title*="taşı"]').first()).toBeDisabled();
  await expect(ilkSatir.locator('button[title*="taşı"]').last()).toBeDisabled();
  // Sürücülük SIRA sütununda işaretli (adda değil — 152 px'lik hücreden çip
  // için ~46 px alırdı ve ad zaten "Sürücü Kasnak (FAN)" diyor).
  await expect(ilkSatir.locator('b.drv')).toHaveCount(1);

  // ── 6) İKİ KART BİRLİKTE TAZELENDİ ──────────────────────────────────────
  await expect(page.locator('.ve-fead-layout-card').first()).toBeVisible();

  // ── 7) ÖRNEK KURARKEN "en fazla 1 tane" UYARISI ÇIKMAMALI ───────────────
  // Açılış yüzeyi tabloyu koyuyor, örnek kurucusu ikincisini kurmaya
  // çalışıyordu ve kullanıcı bir UYARI görüyordu (ölçüldü, ilk turda).
  const uyari = await page.locator('.ve-toast, [class*="toast"]').allInnerTexts();
  expect(uyari.join(' ')).not.toMatch(/en fazla 1 tane/);
  expect(await page.evaluate(() =>
    window.nodes.filter((n) => n.type === 'fead-table').length)).toBe(1);

  // ── 8) DÖNÜŞ YÖNÜ SEÇİCİSİ `contact` YAZIYOR (defterdeki gibi bir GİRDİ) ──
  // BMC hesap defterinde bu sütun Sağ/Sol açılır listesidir ve span'ler ondan
  // türer. MFSim'de aynı fizik `contact` alanında; seçici onu yazıyor ve
  // EFEKTİF ÇAP da değişiyor — defterde bu ikisi ayrı girdiler olduğu için
  // ayrışabiliyordu, burada yapısal olarak ayrışamaz.
  const avaraSatir = kart.locator('tbody tr', { hasText: 'Avara 1' }).first();
  const effOnce = parseFloat((await avaraSatir.locator('td').nth(4).innerText()).replace(',', '.'));
  const avaraId = await page.evaluate(() =>
    window.nodes.find((n) => n.customName === 'Avara 1').id);
  expect(await page.evaluate((id) =>
    window.nodes.find((n) => n.id === id).data.contact, avaraId)).toBe('back');

  await avaraSatir.locator('select[data-ve="spin"]').selectOption('Sağ');
  await page.waitForTimeout(200);

  expect(await page.evaluate((id) =>
    window.nodes.find((n) => n.id === id).data.contact, avaraId)).toBe('grooved');
  const effSonra = parseFloat((await kart.locator('tbody tr', { hasText: 'Avara 1' })
    .first().locator('td').nth(4).innerText()).replace(',', '.'));
  expect(effSonra).toBeCloseTo(effOnce + 0.2, 3);      // 2·hr → 2·hb, GATES PK

  // ── 9) KAYIŞ UZUNLUĞU BİRLEŞİK SÜTUNDA ──────────────────────────────────
  const birlesik = kart.locator('td[rowspan="6"]');
  await expect(birlesik).toHaveCount(1);
  expect(parseFloat((await birlesik.innerText()).replace(',', '.'))).toBeGreaterThan(1000);

  // ── 10) SATIR SİL / EKLE — kutu yokken tek yol ──────────────────────────
  const silOnce = await page.evaluate(() =>
    veFeadBeltOrder(window.nodes).map((n) => n.customName));
  await kart.locator('tbody tr').nth(3).locator('button.ve-fead-tbl-del').click();
  await page.waitForTimeout(200);
  const silSonra = await page.evaluate(() =>
    veFeadBeltOrder(window.nodes).map((n) => n.customName));
  expect(silSonra).toHaveLength(silOnce.length - 1);
  expect(silSonra).not.toContain(silOnce[3]);
  await expect(kart.locator('tbody tr')).toHaveCount(5);

  await kart.locator('select[data-ve="add-pulley"]').selectOption('fead-waterpump');
  await page.waitForTimeout(250);
  const ekSonra = await page.evaluate(() => ({
    sira: veFeadBeltOrder(window.nodes).map((n) => n.type),
    dom: window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley)
      .filter((n) => document.getElementById(n.id)).length,
  }));
  expect(ekSonra.sira).toHaveLength(6);
  expect(ekSonra.sira[ekSonra.sira.length - 1]).toBe('fead-waterpump');   // SONA
  expect(ekSonra.dom).toBe(0);                    // eklenen kasnağın da kutusu yok

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  DURUM GERİ BİLDİRİMİ — NODE'DA HİÇ ÖLÇÜLEMEYEN HALKA
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı bildirimi (2026-09-09): *"'Kayış Tablosu' çok demode ve ilkel
// duruyor."* Sebep bir renk tercihi değil, stilin nerede durduğuydu: kart
// baştan sona satır içi `style="…"` diziyordu ve satır içi CSS DURUM İFADE
// EDEMEZ. Aşağıdaki dört ölçüm o sınırın kalktığını gösteriyor ve dördü de
// yalnız GERÇEK TARAYICIDA var — jsdom `:hover`ı da `:focus`u da hiç
// hesaplamaz, yani bu kapı Node'a taşınamaz.
test('Kayış Tablosu CANLI: fare · odak · seçili satır · zebra', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });
  const kart = page.locator('.ve-fead-table-card').first();
  const satir = kart.locator('tbody tr');
  await expect(satir).toHaveCount(6);

  // ── 1) FARE: satırın zemini değişiyor ───────────────────────────────────
  const zemin = (i) => satir.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
  const once = await zemin(2);
  await satir.nth(2).hover();
  expect(await zemin(2)).not.toBe(once);

  // ── 2) ZEBRA: komşu satırlar aynı zemini paylaşmıyor ────────────────────
  expect(await zemin(0)).not.toBe(await zemin(1));

  // ── 3) ODAK: imlecin HANGİ hücrede olduğu görünüyor ─────────────────────
  // Eski kartta alanların `border:none`u vardı ve odak hiç çizilmiyordu:
  // kullanıcı hangi hücreye yazdığını ekrandan okuyamıyordu.
  const alan = satir.nth(2).locator('input').first();
  expect(await alan.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
  await alan.focus();
  const halka = await alan.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(halka).not.toBe('none');

  // ── 4) SEÇİLİ SATIR: TABLO İLE PANEL ARASINDAKİ TEK BAĞ ─────────────────
  // ÖLÇÜLMÜŞ HATA (bu tur): işaret doğru satıra konuyordu ama seçim
  // değişince hiç TAZELENMİYORDU — kart yalnız model değişince kuruluyor,
  // panel açmak modeli değiştirmiyor. Sonuç işaretin olmamasından kötüydü:
  // tabloda işaretli duran satır, paneli açık olan kasnak DEĞİLDİ.
  for (const i of [0, 2, 5]) {
    const ad = (await satir.nth(i).locator('button.ve-fead-tbl-name').innerText()).trim();
    await satir.nth(i).locator('button.ve-fead-tbl-name').click();
    await page.waitForTimeout(250);
    const secili = kart.locator('tbody tr.is-sel');
    await expect(secili).toHaveCount(1);
    expect((await secili.locator('button.ve-fead-tbl-name').innerText()).trim()).toBe(ad);
    // Ve panel gerçekten O kasnağı açtı.
    expect(await page.evaluate(() => (window.selectedNodes || []).length)).toBe(1);
  }

  // Boşluğa tıklayınca işaret de kalkar — kasnakların kanvasta kutusu yok,
  // yani `clearSelection`ın kutudan sildiği sınıf onlarda hiçbir şeye yazmaz.
  await page.evaluate(() => clearSelection());
  await page.waitForTimeout(150);
  await expect(kart.locator('tbody tr.is-sel')).toHaveCount(0);

  // ── 5) TABLO KABINA SIĞIYOR — yatay kaydırma yok ────────────────────────
  expect(await kart.locator('.ve-fead-tbl-wrap').evaluate((el) =>
    el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  expect(hatalar).toEqual([]);
});
