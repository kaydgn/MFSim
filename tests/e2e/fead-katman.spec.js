/**
 * fead-katman.spec.js — KATMAN PANELİ GERÇEK TARAYICIDA
 *
 * Birim testler listeyi, varsayılanları ve yazmayı Node'da tutuyor. Buradaki
 * soru başka: YÜZEY ayakta mı? Node'da HİÇ koşmayan halkalar —
 *
 *   • düğmeye GERÇEK tıklamak ve panelin kartın içinde açılması,
 *   • kutucuğa tıklayınca ÇİZİMİN değişmesi ve panelin AÇIK KALMASI,
 *   • panelin şeridi itmeden çizimin üstüne binmesi,
 *   • `:hover` / `:has(input:checked)` gibi durum kuralları (jsdom hiçbirini
 *     hesaplamaz),
 *   • iki kartın yan yana AYRI resim çizmesi,
 *   • ÖN AYAR düğmesinin kartı gerçekten çevirmesi (2026-09-11: kanvas tipi
 *     teke indi, geometri ↔ işletme ayrımı bir ön ayar oldu).
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

async function feadOrnek(page) {
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.waitForTimeout(250);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-layout'),
    null, { timeout: 20000 });
  await page.waitForTimeout(700);
}

const adSay = (page, id) => page.evaluate((i) =>
  document.getElementById(i).querySelectorAll('svg text[data-ve="name"]').length, id);

test('KATMAN PANELİ: açılır, çizimi değiştirir, açık kalır', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadOrnek(page);

  // ÖRNEK İKİ KANVAS KURUYOR (aynı tipten, ayrı ön ayarla). Geometri olanı
  // seç — yalnız tipe bakan bir arama hangisini bulacağını söylemez.
  const id = await page.evaluate(() => window.nodes.find(
    (n) => n.type === 'fead-layout' && !(n.data || {}).katOn).id);
  const kart = page.locator('#' + id);
  const dugme = kart.locator('.ve-fead-kat-dugme');

  // ── 1) DÜĞME KARTIN İÇİNDE ──────────────────────────────────────────────
  // Şeritte üç seçici + düğme var ve şerit kaymıyor; düğme taşarsa paneli
  // açmanın tek yolu görünmez olur.
  await expect(dugme).toHaveCount(1);
  expect((await dugme.innerText()).replace(/\s+/g, ' ')).toContain('Katmanlar');
  expect(await page.evaluate((i) => {
    const el = document.getElementById(i);
    const b = el.querySelector('.ve-fead-kat-dugme');
    const k = el.querySelector('.ve-node-box');
    return { tasti: b.getBoundingClientRect().right > k.getBoundingClientRect().right + 1,
             seritKaydi: b.parentElement.scrollWidth > b.parentElement.clientWidth + 1 };
  }, id)).toEqual({ tasti: false, seritKaydi: false });

  // ── 2) GERÇEK TIKLAMA PANELİ AÇIYOR ─────────────────────────────────────
  await expect(kart.locator('.ve-fead-kat')).toHaveCount(0);
  const seritOnce = await kart.locator('.ve-fead-kat-dugme')
    .evaluate((el) => Math.round(el.getBoundingClientRect().top));
  await dugme.click();
  await page.waitForTimeout(350);
  const panel = kart.locator('.ve-fead-kat');
  await expect(panel).toHaveCount(1);
  await expect(panel.locator('input[type="checkbox"]')).toHaveCount(8);
  // İKİ SATIR İŞLEM: üstte adlandırılmış ön ayarlar, altta toptan işlemler.
  await expect(panel.locator('.ve-fead-kat-islem.onayar button')).toHaveCount(2);
  await expect(panel.locator('.ve-fead-kat-islem:not(.onayar) button')).toHaveCount(2);
  // AÇIK ÖN AYAR BASILI DURUYOR — ve bu bir CSS durumu, jsdom hesaplamaz.
  const onAyar = panel.locator('.ve-fead-kat-islem.onayar button');
  await expect(onAyar.nth(0)).toHaveClass(/is-acik/);
  await expect(onAyar.nth(1)).not.toHaveClass(/is-acik/);
  expect(await onAyar.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(await onAyar.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor));

  // PANEL ÇİZİMİN ÜSTÜNE BİNER, ŞERİDİ İTMEZ. Akışa girseydi panel açılınca
  // çizim alanı daralır, şema yeniden ölçeklenir ve kullanıcı "neyi
  // değiştirdim" sorusunu bir de kayan resimle çözmek zorunda kalırdı.
  expect(await kart.locator('.ve-fead-kat-dugme')
    .evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(seritOnce);
  // Ve panel kartın İÇİNDE duruyor.
  expect(await page.evaluate((i) => {
    const el = document.getElementById(i);
    const p = el.querySelector('.ve-fead-kat').getBoundingClientRect();
    const k = el.querySelector('.ve-node-box').getBoundingClientRect();
    return p.right <= k.right + 1 && p.bottom <= k.bottom + 1 && p.top >= k.top - 1;
  }, id)).toBe(true);

  // ── 3) KUTUCUK ÇİZİMİ DEĞİŞTİRİYOR ve PANEL AÇIK KALIYOR ────────────────
  // Panel her tazelemede yeniden kuruluyor; açıklık bir yerde tutulmasaydı
  // ilk tıklamadan sonra panel kapanır ve ikinci kutucuk işaretlenemezdi.
  expect(await adSay(page, id)).toBe(6);
  await panel.locator('input[type="checkbox"]').first().uncheck();
  await page.waitForTimeout(400);
  expect(await adSay(page, id)).toBe(0);
  await expect(kart.locator('.ve-fead-kat')).toHaveCount(1);      // AÇIK KALDI
  // 7 → 5, altı değil: adları kapatmak BAĞLI katmanı ("adı kısalt") da
  // kapatıyor. Sayaç çözülmüş kümeyi sayıyor, kullanıcının tıkladığı kutu
  // sayısını değil — "7/8 yazıyor ama iki katman kapalı" olmasın.
  expect((await dugme.innerText()).replace(/\s+/g, ' ')).toContain('5/8');

  // BAĞLI KATMAN PASİFLEŞTİ: adlar kapalıyken "adı kısalt" bir şey ifade
  // etmiyor — satır silinmiyor, soluyor.
  const kisa = panel.locator('.ve-fead-kat-sat').nth(1);
  await expect(kisa).toHaveClass(/pasif/);
  expect(await kisa.locator('input').isDisabled()).toBe(true);

  // ── 4) DURUM KURALLARI GERÇEKTEN HESAPLANIYOR ───────────────────────────
  // jsdom `:hover`ı da `:has(input:checked)`i de hiç hesaplamaz; kapı
  // Node'a taşınamaz.
  const satir = panel.locator('.ve-fead-kat-sat').nth(4);      // Dönüş okları
  const zemin = () => satir.evaluate((el) => getComputedStyle(el).backgroundColor);
  const once = await zemin();
  await satir.hover();
  await page.waitForTimeout(200);
  expect(await zemin()).not.toBe(once);
  // İşaretli satırın yazısı vurgulu, işaretsizinki değil.
  const renk = (i) => panel.locator('.ve-fead-kat-sat').nth(i)
    .locator('.ad').evaluate((el) => getComputedStyle(el).fontWeight);
  expect(Number(await renk(4))).toBeGreaterThan(Number(await renk(0)));  // 4 açık, 0 kapalı

  // ── 5) TOPTAN İŞLEMLER ──────────────────────────────────────────────────
  const toptan = panel.locator('.ve-fead-kat-islem:not(.onayar) button');
  await toptan.nth(1).click();                                          // Hiçbiri
  await page.waitForTimeout(400);
  expect((await dugme.innerText()).replace(/\s+/g, ' ')).toContain('0/8');
  await toptan.nth(0).click();                                          // Tümü
  await page.waitForTimeout(400);
  expect((await dugme.innerText()).replace(/\s+/g, ' ')).toContain('8/8');
  // ELLE DEĞİŞİKLİK VARKEN HİÇBİR ÖN AYAR BASILI DEĞİL: kart artık bir ön
  // ayar değil, ondan TÜREMİŞ bir küme ve düğme bunu söylemeli.
  await expect(panel.locator('.ve-fead-kat-islem.onayar button.is-acik')).toHaveCount(0);

  // ── 6) ÖN AYAR DÜĞMESİ KARTI GERÇEKTEN ÇEVİRİYOR ────────────────────────
  // Kanvas tipi teke indi (2026-09-11); "geometri kartı" ile "çalışma noktası"
  // arasındaki fark artık BU İKİ DÜĞME. Ölçülen şey resmin kendisi: işletme
  // ön ayarında animasyon yükü doğuyor, geometride yok.
  await panel.locator('.ve-fead-kat-islem.onayar button').nth(1).click();   // İşletme
  await page.waitForTimeout(500);
  expect(await page.evaluate((i) => ({
    on: (window.nodes.find((n) => n.id === i).data || {}).katOn,
    anim: !!document.getElementById(i).querySelector('svg[data-fead-anim]'),
    gerilme: document.getElementById(i).querySelectorAll('[data-ve="belt-tension"]').length,
  }), id)).toEqual({ on: 'isletme', anim: true, gerilme: 6 });
  await expect(kart.locator('.ve-fead-kat')).toHaveCount(1);            // panel AÇIK kaldı
  await expect(kart.locator('.ve-fead-kat-islem.onayar button').nth(1)).toHaveClass(/is-acik/);

  await kart.locator('.ve-fead-kat-islem.onayar button').nth(0).click(); // Geometri
  await page.waitForTimeout(500);
  expect((await dugme.innerText()).replace(/\s+/g, ' ')).toContain('7/8');
  expect(await page.evaluate((i) => {
    const n = window.nodes.find((x) => x.id === i);
    return { kat: n.data.kat, on: n.data.katOn, rpm: n.data.animRpm,
             anim: !!document.getElementById(i).querySelector('svg[data-fead-anim]') };
  }, id)).toEqual({ kat: undefined, on: undefined, rpm: undefined, anim: false });

  // ── 7) KAPATMA ──────────────────────────────────────────────────────────
  await panel.locator('.ve-fead-kat-kapat').click();
  await page.waitForTimeout(300);
  await expect(kart.locator('.ve-fead-kat')).toHaveCount(0);

  expect(hatalar).toEqual([]);
});

test('İKİ KART, İKİ AYRI RESİM — kişiselleştirmenin kendisi', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadOrnek(page);

  // AÇILIR AÇILMAZ İKİ KANVAS — ve TİPLERİ AYNI (kullanıcı isteği).
  expect(await page.evaluate(() => ({
    kanvas: window.nodes.filter((n) => n.type === 'fead-layout').length,
    isletme: window.nodes.filter((n) => n.type === 'fead-layout'
      && (n.data || {}).katOn === 'isletme').length,
    eskiTip: window.nodes.filter((n) => n.type === 'fead-run').length,
  }))).toEqual({ kanvas: 2, isletme: 1, eskiTip: 0 });

  const a = await page.evaluate(() => window.nodes.find(
    (n) => n.type === 'fead-layout' && !(n.data || {}).katOn).id);
  const b = await page.evaluate(() => {
    const n = createNode('fead-layout', 3500, 3500);
    return n && n.id;
  });
  await page.waitForTimeout(700);
  expect(b).toBeTruthy();

  // İkinci kart AYNI modeli çiziyor — başlangıçta iki resim de aynı.
  expect(await adSay(page, a)).toBe(6);
  expect(await adSay(page, b)).toBe(6);

  // İkinci kartı ÇIPLAK YOL yap: gerçek düğme ve gerçek kutucuklarla.
  await page.locator('#' + b + ' .ve-fead-kat-dugme').click();
  await page.waitForTimeout(300);
  const p2 = page.locator('#' + b + ' .ve-fead-kat');
  await p2.locator('.ve-fead-kat-islem:not(.onayar) button').nth(1).click();   // Hiçbiri
  await page.waitForTimeout(450);

  // ASIL KAPI: iki kart AYRI resim çiziyor.
  expect(await adSay(page, a)).toBe(6);
  expect(await adSay(page, b)).toBe(0);
  expect(await page.evaluate(([x, y]) => ({
    biri: !!(window.nodes.find((n) => n.id === x).data || {}).kat,
    oteki: !!(window.nodes.find((n) => n.id === y).data || {}).kat,
  }), [a, b])).toEqual({ biri: false, oteki: true });

  // İKİNCİ PANEL AÇILINCA BİRİNCİSİ KAPANIR: iki panel aynı anda açıkken
  // hangi kartın ayarına baktığın okunmuyor.
  await page.locator('#' + a + ' .ve-fead-kat-dugme').click();
  await page.waitForTimeout(350);
  await expect(page.locator('#' + a + ' .ve-fead-kat')).toHaveCount(1);
  await expect(page.locator('#' + b + ' .ve-fead-kat')).toHaveCount(0);

  // ── KOL KONUMU: her geometri kartı KENDİ seçimini çiziyor ───────────────
  // Eskiden ikisi de birinci kartın konumundan çiziyordu: seçicide bir konum,
  // resimde başka. Sessizdi, çünkü iki kart da kendi başına tutarlı görünür.
  const konumlar = await page.evaluate(([x, y]) => {
    const oku = (i) => {
      const s = document.getElementById(i).querySelector('select');
      return s ? s.value : null;
    };
    return { a: oku(x), b: oku(y) };
  }, [a, b]);
  expect(konumlar.a).toBe(konumlar.b);              // ikisi de varsayılanda

  const yol = () => page.evaluate(([x, y]) => {
    const say = (i) => document.getElementById(i).querySelectorAll('svg path').length;
    return { a: say(x), b: say(y) };
  }, [a, b]);
  const yolOnce = await yol();
  await page.evaluate((y) => veFeadSetChoice(y, 'posMode', 'all'), b);
  await page.waitForTimeout(500);
  const yolSonra = await yol();
  // "TÜMÜ" kipi hayalet yolları ekliyor. KIYAS KARTIN KENDİSİYLE: iki kartı
  // birbiriyle kıyaslamak yanıltıcı olurdu — ikinci kartın katmanları da
  // kapalı, yani zaten daha az yol çiziyor.
  expect(yolSonra.b).toBeGreaterThan(yolOnce.b);
  expect(yolSonra.a).toBe(yolOnce.a);            // birinci kart DEĞİŞMEDİ

  // ── ÜÇÜNCÜ KANVAS: aynı tip, üçüncü bir ön ayar seçimi ─────────────────
  // Tip teke indiği için "çalışma noktası eklemek" ayrı bir palet kutusu değil
  // artık: kanvas eklenir, ön ayarı seçilir. Kapı bunun GERÇEKTEN çalıştığını
  // ölçüyor — paletten kurulan yeni kart da ön ayar düğmesini taşımalı.
  const r2 = await page.evaluate(() => {
    const n = createNode('fead-layout', 3900, 3500);
    return n ? n.id : null;
  });
  await page.waitForTimeout(500);
  expect(r2).toBeTruthy();
  expect(await page.evaluate(() => window.nodes.filter((n) => n.type === 'fead-layout').length)).toBe(4);
  await expect(page.locator('#' + r2 + ' .ve-fead-kat-dugme')).toHaveCount(1);
  await page.locator('#' + r2 + ' .ve-fead-kat-dugme').click();
  await page.waitForTimeout(300);
  await page.locator('#' + r2 + ' .ve-fead-kat-islem.onayar button').nth(1).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate((i) =>
    !!document.getElementById(i).querySelector('svg[data-fead-anim]'), r2)).toBe(true);

  expect(hatalar).toEqual([]);
});
