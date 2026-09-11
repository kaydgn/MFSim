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
test('Kayış Tablosu CANLI: fare · odak · seçili satır · sütun şeridi', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadAc(page);
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

  // ── 2) ZEBRA YOK, SÜTUN ŞERİDİ VAR ──────────────────────────────────────
  // Zebra kaldırıldı (ölçüldü): `rowspan`lı kayış boyu hücresi zebrayı
  // ATLIYOR ve kartın sağ ucunda gri/beyaz bir merdiven bırakıyordu. Yerine
  // türetilen sütunların ŞERİDİ geldi ve şerit ancak GERÇEK TARAYICIDA
  // ölçülebilen bir katman kuralına dayanıyor: `<col>` zemini `<td>` zemininin
  // ALTINDA çizilir, yani gövde hücresi opak bir zemin alırsa şerit sessizce
  // KAYBOLUR — hiçbir şey patlamaz, bant hiç görünmez.
  expect(await zemin(0)).toBe(await zemin(1));            // komşu satırlar aynı
  const seffaf = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const kat = await kart.evaluate((el) => {
    const cs = getComputedStyle;
    const cols = [...el.querySelectorAll('colgroup > col')];
    const bant = cols.filter((c) => c.classList.contains('coz'));
    const duz = cols.filter((c) => !c.classList.contains('coz'));
    const gövde = el.querySelector('tbody tr td.ve-fead-tbl-ro');
    return { bant: bant.map((c) => cs(c).backgroundColor),
             duz: duz.map((c) => cs(c).backgroundColor),
             hucre: cs(gövde).backgroundColor,
             bas: cs(el.querySelector('thead th')).backgroundColor };
  });
  expect(kat.bant).toHaveLength(4);                       // eff · sarım · span · kayış boyu
  kat.bant.forEach((c) => expect(seffaf(c)).toBe(false)); // şerit BOYALI
  kat.duz.forEach((c) => expect(seffaf(c)).toBe(true));   // ötekiler değil
  expect(seffaf(kat.hucre)).toBe(true);                   // hücre şeridi ÖRTMÜYOR
  expect(seffaf(kat.bas)).toBe(false);                    // başlık opak: şerit gövdede başlar

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

  // ── 4b) AD DÜĞMESİ "PENCERE AÇILIR" DİYOR ───────────────────────────────
  // Kullanıcı isteği: *"tıklanınca açılır bir pencere olduğunu belli eden bir
  // yapı olsun. Gölge olur, o olur bu olur."* Gölge Node'da ÖLÇÜLEMEZ, ve
  // ölçülmezse sessizce hiç çizilmeyebilir: `td`nin genel `overflow:hidden`i
  // gölgeyi de 1 px'lik kalkışı da keserdi.
  const dugme = satir.nth(2).locator('button.ve-fead-tbl-name');
  const olc = () => dugme.evaluate((el) => {
    const cs = getComputedStyle(el);
    const sv = el.querySelector('svg.ac');
    return { golge: cs.boxShadow, kenar: cs.borderColor, zemin: cs.backgroundColor,
             donusum: cs.transform, kirpma: getComputedStyle(el.closest('td')).overflow,
             simgeGorunur: Number(getComputedStyle(sv).opacity),
             simgeOran: sv.getBoundingClientRect().width / el.getBoundingClientRect().height };
  });
  const dinlenme = await olc();
  expect(dinlenme.golge).toBe('none');
  expect(dinlenme.kirpma).toBe('visible');          // hücre gölgeyi kırpmıyor
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
  expect(await kart.locator('.ve-fead-tbl-wrap').evaluate((el) =>
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
             satir: kart ? kart.querySelectorAll('tbody tr').length : -1,
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
  const tasmaYok = await kart.locator('.ve-fead-tbl-wrap')
    .evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
  expect(tasmaYok).toBe(true);
  const z0 = await page.evaluate(() => canvasZoom);
  const satir = kart.locator('tbody tr');
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
  const tasmaVar = await kart.locator('.ve-fead-tbl-wrap')
    .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(tasmaVar).toBe(true);

  const z1 = await page.evaluate(() => canvasZoom);
  await satir.nth(1).hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(350);
  const sonra = await page.evaluate(() => ({
    zoom: canvasZoom,
    kaydi: document.querySelector('.ve-fead-tbl-wrap').scrollTop,
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
    const w = k.querySelector('.ve-fead-tbl-wrap');
    const wr = w.getBoundingClientRect();
    const gorunen = [...k.querySelectorAll('tbody tr')]
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
  const sonSatirDurumu = () => kart.evaluate((k) => {
    const w = k.querySelector('.ve-fead-tbl-wrap');
    const son = [...k.querySelectorAll('tbody tr')].pop();
    const wr = w.getBoundingClientRect(), sr = son.getBoundingClientRect();
    return { satir: k.querySelectorAll('tbody tr').length,
             tamGorunur: sr.top >= wr.top - 1.5 && sr.bottom <= wr.bottom + 1.5 };
  });

  // Liste taşana kadar ekle — GERÇEK açılır listeden, `veFeadTableAdd`
  // doğrudan çağrılarak değil.
  for (let i = 0; i < 3; i++) {
    await kart.locator('.ve-fead-tbl-add').selectOption('fead-idler');
    await page.waitForTimeout(350);
    const d = await sonSatirDurumu();
    expect(d.tamGorunur).toBe(true);          // her eklemede görünür kalıyor
  }
  expect((await sonSatirDurumu()).satir).toBe(9);
  // Ve liste gerçekten taşmış durumda — yani kapı boş bir hâli ölçmüyor.
  expect(await kart.locator('.ve-fead-tbl-wrap')
    .evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);

  expect(hatalar).toEqual([]);
});
