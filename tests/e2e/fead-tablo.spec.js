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

// FEAD iç topolojisini aç ve KARŞILAMA SİHİRBAZINI kapat.
//
// Boş bir FEAD topolojisi 2026-09-09'dan beri sihirbazla karşılıyor (kullanıcı
// isteği). Bu dosyanın ölçtüğü şey Kayış Tablosu, yani sihirbaz kapatılmalı —
// gerçek kullanıcının kendi modelini elle kurarken yaptığının aynısı. Kapatma
// ADIMI DA BİR KAPI: sihirbaz kapanmazsa modal kanvası örter ve tablodaki
// hiçbir hücreye tıklanamaz.
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

test('Kayış Tablosu kanvasta: kurulur, yazılır, sıra değişir', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);

  await feadAc(page);
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 20000 });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });

  // ── 1) KART KANVASA MONTE OLDU MU ───────────────────────────────────────
  const kart = page.locator('.ve-fead-table-card').first();
  await expect(kart).toBeVisible();
  // Kart satırları TAZELEMEYLE doğuyor: düğüm var olur olmaz okumak, yalnız
  // künyesi kurulmuş bir kart yakalıyordu (ölçüldü: `innerText` "KAYIŞ ✓").
  await expect(kart.locator('.ve-fead-krt[data-ve-node]')).toHaveCount(6);
  // `textContent`, `innerText` DEĞİL: ikincisi CSS'in `text-transform`unu
  // uyguluyor ("Ø eff" → "Ø EFF") ve yerleşime bağlı, yani yazılan metni
  // değil çizilen metni ölçer.
  const govde = await kart.evaluate((el) => el.textContent);
  // ── ETİKET KISA, DEFTERİN ADI `title`DA ─────────────────────────────────
  // Izgarada her sütunun bir `<th>`i vardı ve defterin tam adı orada
  // yazılıydı. Kart listesinde başlık satırı yok: ekranda kısa ad duruyor
  // ("Ø eff"), defterdeki tam ad alanın üstüne gelince görünüyor. İkisi de
  // AYNI sütun listesinden geliyor — kapı bunu tutuyor, yoksa biri
  // değiştiğinde öteki sessizce eskir.
  ['Ø eff', 'Sarım', 'Span', 'Σsarım', 'Σ toplam', 'Kayış boyu']
    .forEach((t) => expect(govde).toContain(t));
  const ipuclari = await kart.evaluate((el) =>
    [...el.querySelectorAll('[title]')].map((e) => e.getAttribute('title')).join(' | '));
  ['Efektif Çap (mm)', 'Sarım Açısı (°)', 'Span Uzunluğu (mm)',
   'Kasnak Dönüş Yönü', 'Kayış Uzunluğu (mm)']
    .forEach((t) => expect(ipuclari).toContain(t));
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
  const satir = kart.locator('.ve-fead-krt[data-ve-node]', { hasText: 'Alternatör' }).first();
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
  await kart.locator('.ve-fead-krt[data-ve-node]').nth(2).locator('button[title*="yukarı"]').click();
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
  const ilkSatir = kart.locator('.ve-fead-krt[data-ve-node]').first();
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
  const avaraSatir = kart.locator('.ve-fead-krt[data-ve-node]', { hasText: 'Avara 1' }).first();
  // Ø eff çözüm bölgesinin İLK okuması (defter sırası: Efektif Çap · Sarım · Span).
  const effOku = (r) => r.locator('.coz .ve-fead-krt-rv > b').first();
  const effOnce = parseFloat((await effOku(avaraSatir).innerText()).replace(',', '.'));
  const avaraId = await page.evaluate(() =>
    window.nodes.find((n) => n.customName === 'Avara 1').id);
  expect(await page.evaluate((id) =>
    window.nodes.find((n) => n.id === id).data.contact, avaraId)).toBe('back');

  // AÇILIR LİSTE DEĞİL İKİ DURUMLU SEGMENT: iki seçenek de tek bakışta
  // sığıyor ve tarayıcının oku listedeki en göze batan parçaydı.
  await expect(avaraSatir.locator('.ve-fead-krt-seg[data-ve="spin"] button'))
    .toHaveCount(2);
  await expect(avaraSatir.locator('.ve-fead-krt-seg[data-ve="spin"] button.on'))
    .toHaveText('Sol');
  await avaraSatir.locator('.ve-fead-krt-seg[data-ve="spin"] button', { hasText: 'Sağ' })
    .click();
  await page.waitForTimeout(200);

  expect(await page.evaluate((id) =>
    window.nodes.find((n) => n.id === id).data.contact, avaraId)).toBe('grooved');
  const effSonra = parseFloat((await effOku(
    kart.locator('.ve-fead-krt[data-ve-node]', { hasText: 'Avara 1' }).first()
  ).innerText()).replace(',', '.'));
  expect(effSonra).toBeCloseTo(effOnce + 0.2, 3);      // 2·hr → 2·hb, GATES PK
  await expect(avaraSatir.locator('.ve-fead-krt-seg[data-ve="spin"] button.on'))
    .toHaveText('Sağ');

  // ── 9) KAYIŞ UZUNLUĞU KÜNYEDE ───────────────────────────────────────────
  // Izgarada bütün satırları saran `rowspan`lı tek hücreydi ve beş satır boyu
  // bir dikdörtgenin ortasında tek sayı taşıyordu (~170 px boş). Boy satıra
  // değil ÇEVRİME ait — künyede orası da söylenmiş oluyor.
  await expect(kart.locator('td[rowspan]')).toHaveCount(0);
  const boyKunye = kart.locator('.ve-fead-tbl-kunye', { hasText: 'Kayış boyu' });
  await expect(boyKunye).toHaveCount(1);
  expect(parseFloat((await boyKunye.locator('b').innerText()).replace(',', '.')))
    .toBeGreaterThan(1000);

  // ── 10) SATIR SİL / EKLE — kutu yokken tek yol ──────────────────────────
  const silOnce = await page.evaluate(() =>
    veFeadBeltOrder(window.nodes).map((n) => n.customName));
  await kart.locator('.ve-fead-krt[data-ve-node]').nth(3).locator('button.ve-fead-tbl-del').click();
  await page.waitForTimeout(200);
  const silSonra = await page.evaluate(() =>
    veFeadBeltOrder(window.nodes).map((n) => n.customName));
  expect(silSonra).toHaveLength(silOnce.length - 1);
  expect(silSonra).not.toContain(silOnce[3]);
  await expect(kart.locator('.ve-fead-krt[data-ve-node]')).toHaveCount(5);

  await kart.locator('select[data-ve="add-pulley"]').selectOption('fead-waterpump');
  await page.waitForTimeout(250);
  const ekSonra = await page.evaluate(() => ({
    sira: veFeadBeltOrder(window.nodes).map((n) => n.type),
    dom: window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley)
      .filter((n) => document.getElementById(n.id)).length,
  }));
  expect(ekSonra.sira).toHaveLength(6);
  // DAVRANIŞ 2026-09-22'DE DEĞİŞTİ: yeni kasnak sıranın sonuna değil OTOMATİK
  // GERGİNİN ÖNÜNE düşüyor. Eskisi, kullanıcı bir kasnak ekler eklemez
  // "döngü gergiyle biter" kuralını kırıyor ve modeli uyarılı hâle getiriyordu.
  expect(ekSonra.sira[ekSonra.sira.length - 1]).toBe('fead-tensioner');   // GERGİ SONDA
  expect(ekSonra.sira[ekSonra.sira.length - 2]).toBe('fead-waterpump');   // yeni ONUN ÖNÜNDE
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
test('Kayış Tablosu CANLI: fare · odak · seçili satır · çözüm bölgesi', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });
  const kart = page.locator('.ve-fead-table-card').first();
  const satir = kart.locator('.ve-fead-krt[data-ve-node]');
  await expect(satir).toHaveCount(6);

  // ── 1) FARE: satırın zemini değişiyor ───────────────────────────────────
  const zemin = (i) => satir.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
  const once = await zemin(2);
  await satir.nth(2).hover();
  expect(await zemin(2)).not.toBe(once);

  // ── 2) ZEBRA YOK, ÇÖZÜM BÖLGESİ GÖMÜLÜ ──────────────────────────────────
  // Izgarada girdi/çözüm ayrımının taşıyıcısı boyalı bir SÜTUN şeridiydi
  // (`<col class="coz">`); kart listesinde ayrım BÖLGENİN KENDİSİ — sağdaki
  // çözüm bölgesi gömülü bir yüzey ("burası yazılmaz, okunur"). Ayrım ancak
  // gerçek tarayıcıda ölçülebilir: zemin bir tema jetonundan geliyor ve
  // jeton kart zeminiyle aynı değere düşerse ayrım SESSİZCE kaybolur —
  // hiçbir şey patlamaz, iki bölge aynı görünür.
  expect(await zemin(0)).toBe(await zemin(1));            // komşu satırlar aynı
  const seffaf = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const bolge = await satir.nth(2).evaluate((el) => {
    const cs = getComputedStyle;
    return { coz: cs(el.querySelector('.coz')).backgroundColor,
             gir: cs(el.querySelector('.gir')).backgroundColor,
             kim: cs(el.querySelector('.kim')).backgroundColor,
             // Okuma alanı kendi zeminini BASMIYOR: bassaydı bölgenin
             // yüzeyi kırpılır ve ayrım satır satır delik deşik olurdu.
             oku: cs(el.querySelector('.coz .ve-fead-krt-rv')).backgroundColor };
  });
  expect(seffaf(bolge.coz)).toBe(false);                  // çözüm bölgesi BOYALI
  expect(bolge.coz).not.toBe(bolge.gir);                  // girdi bölgesinden AYRI
  expect(seffaf(bolge.gir)).toBe(true);
  expect(seffaf(bolge.kim)).toBe(true);
  expect(seffaf(bolge.oku)).toBe(true);
  // ÇÖZÜM BÖLGESİNDE YAZILABİLİR HİÇBİR ŞEY YOK, girdi bölgesinde OKUMA yok.
  await expect(satir.nth(2).locator('.coz input, .coz select, .coz button'))
    .toHaveCount(0);
  await expect(satir.nth(2).locator('.gir .ve-fead-krt-rv')).toHaveCount(0);

  // ── 2b) SİLME DİNLENMEDE GÖRÜNMEZ ───────────────────────────────────────
  // Altı satırda altı ✕ sürekli duruyordu ve sayı sütunlarının sağ ucunda
  // tablonun ilk okunan işareti bir SİLME düğmesiydi. `opacity` geçişi satır
  // içi CSS'te yazılamaz ve Node'da hiç hesaplanmaz.
  const sil = satir.nth(3).locator('button.ve-fead-tbl-del');
  expect(await sil.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
  await satir.nth(3).hover();
  await page.waitForTimeout(200);
  expect(Number(await sil.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
  // Klavye yolu KAPANMADI: odaklanınca geri geliyor (opacity:0 tabbable olmayı
  // bozmaz, `display:none` bozardı).
  await satir.nth(0).hover();                             // fare BAŞKA satırda
  await sil.focus();
  await page.waitForTimeout(150);
  expect(Number(await sil.evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9);

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
  // AD HÜCRESİ PENCEREYİ DE AÇIYOR (`veTogglePropertiesPanel(true)`) ve
  // `#ve-properties-overlay` bir MODAL: ilk tıktan sonra tablonun üstünü
  // kapatıyor, ikinci tık ona gidiyor ve döngü 180 sn zaman aşımına
  // düşüyordu. Kullanıcı da aynı şeyi yapar — bakar, kapatır, sıradakine
  // tıklar. Pencere her turda kapatılıyor; ölçülen hüküm değişmedi.
  const pencereKapat = () => page.evaluate(() => {
    if (typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);
  });
  for (const i of [0, 2, 5]) {
    await pencereKapat();
    await page.waitForTimeout(120);
    const ad = (await satir.nth(i).locator('button.ve-fead-tbl-name').innerText()).trim();
    await satir.nth(i).locator('button.ve-fead-tbl-name').click();
    await page.waitForTimeout(250);
    // Pencere GERÇEKTEN açıldı — hücrenin tuttuğu söz bu.
    expect(await page.evaluate(() => {
      const o = document.getElementById('ve-properties-overlay');
      return !!o && o.style.display !== 'none';
    })).toBe(true);
    const secili = kart.locator('.ve-fead-krt.is-sel');
    await expect(secili).toHaveCount(1);
    expect((await secili.locator('button.ve-fead-tbl-name').innerText()).trim()).toBe(ad);
    // Ve panel gerçekten O kasnağı açtı.
    expect(await page.evaluate(() => (window.selectedNodes || []).length)).toBe(1);
  }

  // Boşluğa tıklayınca işaret de kalkar — kasnakların kanvasta kutusu yok,
  // yani `clearSelection`ın kutudan sildiği sınıf onlarda hiçbir şeye yazmaz.
  await page.evaluate(() => clearSelection());
  await page.waitForTimeout(150);
  await expect(kart.locator('.ve-fead-krt.is-sel')).toHaveCount(0);

  // ── 4b) AD DÜĞMESİ "PENCERE AÇILIR" DİYOR ───────────────────────────────
  // Kullanıcı isteği: *"tıklanınca açılır bir pencere olduğunu belli eden bir
  // yapı olsun. Gölge olur, o olur bu olur."* Gölge Node'da ÖLÇÜLEMEZ, ve
  // ölçülmezse sessizce hiç çizilmeyebilir: kimlik bölgesine bir
  // `overflow:hidden` girerse gölgeyi de 1 px'lik kalkışı da keser.
  const dugme = satir.nth(2).locator('button.ve-fead-tbl-name');
  const olc = () => dugme.evaluate((el) => {
    const cs = getComputedStyle(el);
    const sv = el.querySelector('svg.ac');
    return { golge: cs.boxShadow, kenar: cs.borderColor, zemin: cs.backgroundColor,
             donusum: cs.transform,
             kirpma: getComputedStyle(el.closest('.kim')).overflow,
             simgeGorunur: Number(getComputedStyle(sv).opacity),
             simgeOran: sv.getBoundingClientRect().width / el.getBoundingClientRect().height };
  });
  const dinlenme = await olc();
  expect(dinlenme.golge).toBe('none');
  expect(dinlenme.kirpma).toBe('visible');          // bölge gölgeyi kırpmıyor
  // SİMGE DİNLENMEDE DURUYOR — afordansın kendisi o. Kutu, zemin ve gölge
  // yalnız fare altında geliyor; simge çıkarsa afordans yine "ondan haberi
  // olana" görünür hâle düşer (2026-09-09'un ölçülmüş hatası).
  expect(dinlenme.simgeGorunur).toBeGreaterThan(0.9);
  // ÖLÇÜ ORANLA, PİKSELLE DEĞİL: kart kanvasta duruyor ve kameranın
  // yakınlaştırması ölçüyü ölçekliyor — mutlak bir px eşiği, tasarım hiç
  // değişmese de yakınlaştırma değişince kırılır (ölçüldü: 11 px'lik simge
  // 3,13 px geldi ve simge küçülmemişti).
  expect(dinlenme.simgeOran).toBeGreaterThan(0.2);
  await dugme.hover();
  await page.waitForTimeout(250);
  const uzerinde = await olc();
  expect(uzerinde.golge).not.toBe('none');          // GÖLGE
  expect(uzerinde.donusum).not.toBe(dinlenme.donusum);   // 1 px kalkış
  expect(uzerinde.kenar).not.toBe(dinlenme.kenar);
  // Simge bir ÇİZİM: eksik bir yazı karakteri afordansın kendisini yok ederdi.
  await expect(dugme.locator('svg.ac')).toHaveCount(1);
  // PANELİ AÇIK olan düğme BASILI kalıyor — satır vurgusuyla karışmayan
  // ikinci bir işaret.
  await satir.nth(3).locator('button.ve-fead-tbl-name').click();
  await page.waitForTimeout(300);
  const acik = await satir.nth(3).locator('button.ve-fead-tbl-name')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(acik).not.toBe(dinlenme.zemin);

  // ── 5) TABLO KABINA SIĞIYOR — yatay kaydırma yok ────────────────────────
  expect(await kart.locator('.ve-fead-krt-wrap').evaluate((el) =>
    el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  CTRL+Z KAYIŞ TABLOSUNU SİLMİYOR
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı bildirimi (2026-09-09): *"CTRL Z komutunu kullandığımda tablo
// siliniyor. Yani boş bir hale geliyor. Hata veriyor, garip oluyor."*
//
// ÖLÇÜLDÜ (bu spec, düzeltmeden ÖNCE): örnek yükleme yığına ONÜÇ ayrı adım
// yazıyordu, çünkü `createNode` her düğümde `saveState()` çağırıyor. Ctrl+Z
// modeli düğüm düğüm SÖKÜYORDU — 12. basışta tablo boşalıyor ("henüz kasnak
// yok"), 13.'te kart tamamen gidiyor, 15.'te yığın tükenip "Geri alınacak
// işlem yok" uyarısı çıkıyordu. Üç belirtinin üçü de tek sebepten: ADIM BOYU.
//
// Kapı Node'a taşınamaz: ölçülen şey gerçek klavye olayı → gerçek `undo()` →
// `restoreState`in kanvası yeniden kurması.
test('CTRL+Z: örnek TEK adımda geri alınır, tablo SİLİNMEZ', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });
  await page.waitForTimeout(700);

  const durum = () => page.evaluate(() => {
    const kart = document.querySelector('.ve-fead-table-card');
    return { dugum: window.nodes.length,
             kasnak: window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length,
             kart: !!kart,
             satir: kart ? kart.querySelectorAll('.ve-fead-krt[data-ve-node]').length : -1,
             undo: (window.undoStack || []).length };
  });

  // ── ONİKİ DÜĞÜMLÜK KURULUM = TEK ADIM ───────────────────────────────────
  const yuklu = await durum();
  expect(yuklu.kasnak).toBe(6);
  expect(yuklu.satir).toBe(6);
  // Açılış yüzeyi (taban) + örnek = 2. Düzeltmeden önce 14'tü.
  expect(yuklu.undo).toBe(2);

  const geriAl = async (n) => {
    for (let i = 0; i < n; i++) {
      await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(350);
    }
  };

  // ── BİR BASIŞ ÖRNEĞİN TAMAMINI GERİ ALIR ────────────────────────────────
  await geriAl(1);
  const sonra = await durum();
  expect(sonra.kasnak).toBe(0);                       // yarım sökülmüş model YOK
  expect(sonra.kart).toBe(true);                      // TABLO DURUYOR
  expect(await page.evaluate(() =>
    /henüz kasnak yok/.test(document.querySelector('.ve-fead-table-card').innerText))).toBe(true);

  // ── AÇILIŞ DURUMU TABAN: DAHA FAZLA BASMAK TABLOYU SİLMİYOR ─────────────
  // Kullanıcının gördüğü asıl belirti buydu. Modüle girip araçları almak bir
  // DÜZENLEME değil; adım olsaydı Ctrl+Z boş bir kanvasa düşürürdü.
  await geriAl(6);
  const taban = await durum();
  expect(taban.kart).toBe(true);
  expect(taban.dugum).toBe(2);                        // sihirbaz + tablo
  expect(await page.evaluate(() =>
    window.nodes.filter((n) => n.type === 'fead-table').length)).toBe(1);

  // ── VE İLERİ AL ÖRNEĞİ TEK ADIMDA GERİ GETİRİYOR ────────────────────────
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(500);
  const ileri = await durum();
  expect(ileri.kasnak).toBe(6);
  expect(ileri.satir).toBe(6);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  TEKERLEK LİSTEYİ KAYDIRIR, KANVASI UZAKLAŞTIRMAZ
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı gibi kullanılırken ölçüldü (2026-09-11): kart alçaltılıp altı
// satır görünmez olduğunda, listenin üstünde tekerleği çevirmek tabloyu
// KAYDIRMIYOR — kanvası UZAKLAŞTIRIYOR (zoom 0,486 → 0,438, tablonun
// scrollTop'u 0'da kalıyor). Yani kartın içindeki liste tekerlekle hiç
// kaydırılamıyordu ve kullanıcının ilk refleksi yanlış şeyi yapıyordu.
//
// Sebep `ui-core.js`'teki kanvas dinleyicisinin KAYITSIZ `preventDefault()`u:
// olay hücreden kanvas kabuğuna kabarıyor ve varsayılan kaydırma eylemi,
// yolun HERHANGİ bir düğümünde iptal edilince hiç gerçekleşmiyor.
//
// KAPI NODE'A TAŞINAMAZ: jsdom ne düzen kurar (taşma yok, `scrollHeight`
// hep `clientHeight`) ne de gerçek bir tekerlek olayının varsayılan eylemini
// çalıştırır — ölçülen şeyin ikisi de burada.
test('TEKERLEK: liste kaydırılabilirken tabloyu kaydırır, kanvası değil', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });
  await page.waitForTimeout(600);

  const kart = page.locator('.ve-fead-table-card').first();

  // ── 1) TAŞMA YOKKEN tekerlek KANVASIN ─────────────────────────────────
  // Kart varsayılan ölçüsünde altı satırı kayarsız gösteriyor; burada
  // tekerleği yutmak, kart üstünde kanvası hiç yakınlaştıramamak demekti.
  const tasmaYok = await kart.locator('.ve-fead-krt-wrap')
    .evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
  expect(tasmaYok).toBe(true);
  const z0 = await page.evaluate(() => canvasZoom);
  const satir = kart.locator('.ve-fead-krt[data-ve-node]');
  await satir.nth(2).hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => canvasZoom)).not.toBe(z0);

  // ── 2) TAŞMA VARKEN tekerlek TABLONUN ─────────────────────────────────
  // Kartı alçalt (tabanın üstünde kalarak) — liste artık kayıyor.
  await page.evaluate(() => {
    const n = window.nodes.find((x) => x.type === 'fead-table');
    n.height = 230;
    document.getElementById(n.id).querySelector('.ve-node-box').style.height = '230px';
    if (typeof veFeadRefreshCards === 'function') veFeadRefreshCards();
  });
  await page.waitForTimeout(350);
  const tasmaVar = await kart.locator('.ve-fead-krt-wrap')
    .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(tasmaVar).toBe(true);

  const z1 = await page.evaluate(() => canvasZoom);
  await satir.nth(1).hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(350);
  const sonra = await page.evaluate(() => ({
    zoom: canvasZoom,
    kaydi: document.querySelector('.ve-fead-krt-wrap').scrollTop,
  }));
  expect(sonra.kaydi).toBeGreaterThan(0);      // TABLO kaydı
  expect(sonra.zoom).toBe(z1);                 // kanvas OYNAMADI

  // ── 3) KÜNYENİN üstünde tekerlek yine KANVASIN ────────────────────────
  // Kaydırılabilir yüzey listenin kendisi; künye şeridi kanvasın parçası.
  await kart.locator('.ve-fead-tbl-head').hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => canvasZoom)).not.toBe(z1);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  KART EN KÜÇÜK ÖLÇÜSÜNÜN ALTINA İNMİYOR
// ═══════════════════════════════════════════════════════════════════════════
//
// Ölçülen sessiz kayıp: 130 px yükseklikte yapışkan başlık ile Σ satırı
// gövdeyi tamamen örtüyor — altı satırın altısı da görünmez oluyor ama Σ
// hâlâ 663,4 · 1048,7 yazıyor. Node tarafı tabanın BEYAN edildiğini tutuyor;
// burada ölçülen şey GERÇEK SÜRÜKLEMENİN o tabanda durması ve tabandaki
// kartın hâlâ satır göstermesi.
test('YENİDEN BOYUTLANDIRMA: taban aşılmıyor ve tabanda satırlar görünüyor', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });
  await page.waitForTimeout(600);

  // Kartı seç ki tutamaklar etkin olsun, sonra SE tutamağını sol-üste sürükle.
  const id = await page.evaluate(() => window.nodes.find((n) => n.type === 'fead-table').id);
  await page.evaluate((i) => {
    clearSelection();
    addToSelection(window.nodes.find((n) => n.id === i));   // DÜĞÜM, DOM elemanı değil
  }, id);
  await page.waitForTimeout(250);
  const tut = page.locator('#' + id + ' .ve-resize-se');
  const bb = await tut.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x - 1400, bb.y - 900, { steps: 14 });   // sınırın çok ötesine
  await page.mouse.up();
  await page.waitForTimeout(400);

  const olcu = await page.evaluate((i) => {
    const n = window.nodes.find((x) => x.id === i);
    const k = document.querySelector('.ve-fead-table-card');
    const w = k.querySelector('.ve-fead-krt-wrap');
    const wr = w.getBoundingClientRect();
    const gorunen = [...k.querySelectorAll('.ve-fead-krt[data-ve-node]')]
      .filter((tr) => { const r = tr.getBoundingClientRect();
        return r.top < wr.bottom - 2 && r.bottom > wr.top + 2; }).length;
    return { w: Math.round(n.width), h: Math.round(n.height),
             min: { w: componentDefs['fead-table'].minWidth, h: componentDefs['fead-table'].minHeight },
             gorunenSatir: gorunen, gizliSutunPx: w.scrollWidth - w.clientWidth };
  }, id);

  expect(olcu.w).toBe(olcu.min.w);
  expect(olcu.h).toBe(olcu.min.h);
  // TABANDA KART HÂLÂ ÇALIŞIYOR: en az iki satır görünüyor ve hiçbir sütun
  // kaymıyor. Eski 50×50 tabanında ikisi de sıfırdı.
  expect(olcu.gorunenSatir).toBeGreaterThanOrEqual(2);
  expect(olcu.gizliSutunPx).toBeLessThanOrEqual(1);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  EKLENEN SATIR GÖRÜNÜR OLUYOR
// ═══════════════════════════════════════════════════════════════════════════
//
// ÖLÇÜLDÜ (2026-09-11): varsayılan kartta yedinci kasnak eklendiğinde satır
// listenin dibinin 35 px altına düşüyor ve tablo hiç kaymıyordu.
test('KASNAK EKLE: yeni satır görüş alanına giriyor', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });
  await page.waitForTimeout(600);

  const kart = page.locator('.ve-fead-table-card').first();
  // ÖLÇÜLEN ŞEY "SON SATIR" DEĞİL, "YENİ EKLENEN SATIR". 2026-09-22'ye kadar
  // ikisi aynıydı; artık yeni kasnak gerginin ÖNÜNE düşüyor, yani sondan bir
  // önceki satır. Eskisi gibi son satıra bakmak, ölçülmek istenen şeyi SESSİZCE
  // başka bir satırla değiştirirdi.
  const satirDurumu = (id) => kart.evaluate((k, nid) => {
    const w = k.querySelector('.ve-fead-krt-wrap');
    const tr = k.querySelector('.ve-fead-krt[data-ve-node="' + nid + '"]');
    const wr = w.getBoundingClientRect(), sr = tr.getBoundingClientRect();
    return { satir: k.querySelectorAll('.ve-fead-krt[data-ve-node]').length,
             tamGorunur: sr.top >= wr.top - 1.5 && sr.bottom <= wr.bottom + 1.5 };
  }, id);
  const idler = () => page.evaluate(() =>
    window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).map((n) => n.id));

  // Liste taşana kadar ekle — GERÇEK açılır listeden, `veFeadTableAdd`
  // doğrudan çağrılarak değil.
  let son = { satir: 0 };
  for (let i = 0; i < 3; i++) {
    const once = await idler();
    await kart.locator('.ve-fead-tbl-add').selectOption('fead-idler');
    await page.waitForTimeout(350);
    const yeniId = (await idler()).find((x) => !once.includes(x));
    expect(yeniId).toBeTruthy();
    son = await satirDurumu(yeniId);
    expect(son.tamGorunur).toBe(true);        // EKLENEN satır her eklemede görünür
  }
  expect(son.satir).toBe(9);
  // Ve liste gerçekten taşmış durumda — yani kapı boş bir hâli ölçmüyor.
  expect(await kart.locator('.ve-fead-krt-wrap')
    .evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);

  expect(hatalar).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
//  KART TAŞIMA — TUTAMAK NEREDE, İMLEÇ NE SÖYLÜYOR
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı bildirimi (2026-09-22): *"Tablo taşıması düzelmemiş."* ÖLÇÜLDÜ,
// düzeltmeden önce (AG00976, zoom 1): kart YALNIZ üstteki künye şeridinden
// taşınıyordu, kasnak listesinin gövdesi taşımıyordu — ve şeritte tutamak
// olduğunu söyleyen TEK BİR İŞARET yoktu, ne imleç ne çizim. Üstelik
// `.ve-node{cursor:move}` kartın TAMAMINDA taşıma imleci gösteriyordu, yani
// imleç gövde boyunca olmayan bir şeyi vaat ediyordu.
//
// Bu halka Node'da KOŞAMAZ: gerçek `mousedown → mousemove → mouseup` zinciri,
// olay kabarması ve `getComputedStyle(cursor)` jsdom'da yok.
test('KART TAŞIMA: künye taşır, liste taşımaz, imleç ikisini de söyler',
  async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });

  const id = await page.evaluate(() => {
    const t = window.nodes.find((n) => n.type === 'fead-table');
    const w = document.getElementById('ve-canvas-wrapper');
    canvasZoom = 1;
    canvasOffset.x = w.clientWidth / 2 - (t.x + t.width / 2 - 3000);
    canvasOffset.y = w.clientHeight / 2 - (t.y + t.height / 2 - 3000);
    updateCanvasTransform();
    return t.id;
  });
  await page.waitForTimeout(200);

  async function surukle(sel) {
    const r = await page.locator(sel).first().boundingBox();
    const once = await page.evaluate((i) => {
      const n = window.nodes.find((x) => x.id === i); return { x: n.x, y: n.y };
    }, id);
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2 + 60, r.y + r.height / 2 + 40, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    return page.evaluate(([i, o]) => {
      const n = window.nodes.find((x) => x.id === i);
      const dd = { dx: Math.round(n.x - o.x), dy: Math.round(n.y - o.y) };
      n.x = o.x; n.y = o.y;                                   // sahneyi geri al
      const el = document.getElementById(i);
      if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
      if (typeof updateAllConnections === 'function') updateAllConnections();
      return dd;
    }, [id, once]);
  }

  // KÜNYE TAŞIR — kartın tek tutamağı, ve artık kendini söylüyor.
  expect(await surukle('.ve-fead-tbl-head')).toEqual({ dx: 60, dy: 40 });
  // VERİ YÜZEYİ TAŞIMAZ — yoksa bir alana yazmak kartı taşırdı.
  expect(await surukle('.ve-fead-krt[data-ve-node] .gir')).toEqual({ dx: 0, dy: 0 });

  // İMLEÇ AYNI AYRIMI SÖYLÜYOR. Kablolama doğru olup imleç yine her yerde
  // "move" gösterseydi kullanıcının şikâyeti aynen sürerdi.
  const imlec = await page.evaluate((i) => {
    const el = document.getElementById(i);
    const c = (s) => getComputedStyle(el.querySelector(s)).cursor;
    return { kutu: getComputedStyle(el).cursor, head: c('.ve-fead-tbl-head'),
             wrap: c('.ve-fead-krt-wrap') };
  }, id);
  expect(imlec.kutu).toBe('move');            // düğümün kendisi taşınabilir
  expect(imlec.head).toBe('move');
  expect(imlec.wrap).not.toBe('move');        // ESKİ HÂL: 'move' — yalan

  // TUTAMAK GÖRÜNÜR: nokta ızgarası dinlenmede de çiziliyor (yalnız fare
  // üstündeyken belirse, keşfedilemezlik aynen sürerdi).
  const grip = await page.evaluate((i) => {
    const h = document.getElementById(i).querySelector('.ve-fead-tbl-head');
    const st = getComputedStyle(h, '::before');
    return { img: st.backgroundImage, opak: parseFloat(st.opacity) };
  }, id);
  expect(grip.img).toContain('radial-gradient');
  expect(grip.opak).toBeGreaterThan(0);

  expect(hatalar).toEqual([]);
});
