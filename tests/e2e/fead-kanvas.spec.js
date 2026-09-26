/**
 * fead-kanvas.spec.js — KAYIŞ YOLU KARTI: BANT YOK, DENETİM ÜSTTE YÜZER
 *
 * Kart 2026-09-21'e kadar DÖRT yatay bant taşıyordu ve her biri yüksekliğini
 * ÇİZİMDEN alıyordu (iki seçici şeridi 44 px + durum şeridi 20 px + titreşim
 * açıkken kazanç şeridi 20 px daha). Bantlar kalktı: çizim kartın tamamını
 * alıyor, denetimler çizimin üstünde yüzüyor. Geometri kartında Kayış
 * Tablosu (Pafta, 2026-09-26) çizimin altında: çizimden alınan tek şey o ve
 * altındaki çubuk satırı.
 *
 * NODE'DA HİÇ KOŞMAYAN HALKALAR — jsdum yerleşim hesaplamaz, bu dosyanın
 * varlık sebebi tam olarak bunlar:
 *
 *   • çizimin GERÇEKTEN kartın tamamını alması (bant yüksekliği 0),
 *   • yüzen çubuğun TEK SATIR kalması ve kartın dışına taşmaması
 *     — `left:50%` ile ortalanırsa sığdırma genişliği yarıya iner ve çubuk
 *       dört satıra sarar; birim testte bu görünmez,
 *   • yön gülünün çubuğun ALTINDA KALMAMASI (ölçülmüş hata: gül tamamen
 *     görünmez oluyordu),
 *   • durum rozetinin iki hâlinin FARKLI genişlikte olması.
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

// Kart kanvasta ZOOM'lu duruyor; bütün ölçüler CSS px'e çevrilerek okunuyor.
const olc = (page, id) => page.evaluate((i) => {
  const el = document.getElementById(i);
  const n = window.nodes.find((x) => x.id === i);
  const s = el.getBoundingClientRect().width / n.width;
  const R = (e) => {
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { t: b.top / s, l: b.left / s, w: b.width / s, h: b.height / s,
             b: b.bottom / s, r: b.right / s };
  };
  const ort = (a, c) => !!a && !!c &&
    !(a.r < c.l || a.l > c.r || a.b < c.t || a.t > c.b);
  const kutu = R(el.querySelector('.ve-node-box'));
  const yuz = R(el.querySelector('.ve-fead-yuz'));
  const gul = R(el.querySelector('[data-ve="compass"]'));
  const kanvas = R(el.querySelector('.ve-fead-kanvas'));
  const paf = R(el.querySelector('.ve-fead-pafta'));
  const kart = el.querySelector('.ve-fead-layout-card');
  return {
    kartH: n.height, kartW: n.width, kutu, kanvas, yuz, gul, paf,
    yuzUst: parseFloat(getComputedStyle(kart).getPropertyValue('--fead-yuz-ust')),
    ciz: R(el.querySelector('.ve-fead-kanvas > .ciz')),
    svg: R(el.querySelector('.ve-fead-kanvas > .ciz > svg')),
    rozet: R(el.querySelector('.ve-fead-kan-durum')),
    vib: R(el.querySelector('.ve-fead-yuz-vib')),
    secici: el.querySelectorAll('.ve-fead-yuz select').length,
    katDugme: el.querySelectorAll('.ve-fead-yuz .ve-fead-kat-dugme:not(.ve-fead-tablo-dugme)').length,
    tabloDugme: el.querySelectorAll('.ve-fead-yuz .ve-fead-tablo-dugme').length,
    gulOrtuldu: ort(gul, yuz),
    gulTabloda: ort(gul, paf),
    // Bant kalıntısı: akışa giren, üst kenarlıklı kutu.
    bant: el.querySelectorAll('.ve-fead-card-body > div:not(.ve-fead-kanvas)').length,
  };
}, id);

test('KAYIŞ YOLU KARTI: bant yok, çubuk tek satır, gül açıkta', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await feadOrnek(page);

  const id = await page.evaluate(() => window.nodes.find(
    (n) => n.type === 'fead-layout' && !(n.data || {}).katOn).id);
  const idIsletme = await page.evaluate(() => window.nodes.find(
    (n) => n.type === 'fead-layout' && (n.data || {}).katOn === 'isletme').id);
  const m = await olc(page, id);

  // ── 1) ÇİZİM KARTIN TAMAMINI ALIYOR — tablo ve çubuk satırı DIŞINDA ────
  // Bant döneminde çizime kartın yüksekliğinden 64 px eksiği kalıyordu
  // (440×500 kartta 436), titreşim açıkken 416. Şimdi kabuk ne kadarsa çizim
  // de o kadar. Geometri kartında Kayış Tablosu (Pafta, 2026-09-26) çizimin
  // ALTINDA ve çubuk onun altındaki satırda: çizimden alınan yalnız o ikisi,
  // ve üçü birbirine binmiyor.
  expect(Math.round(m.ciz.h)).toBe(Math.round(m.kanvas.h));
  expect(Math.round(m.svg.w)).toBe(Math.round(m.kanvas.w));
  expect(m.paf).not.toBeNull();
  expect(Math.round(m.svg.h + m.paf.h + m.yuzUst)).toBe(Math.round(m.kanvas.h));
  expect(m.svg.b).toBeLessThanOrEqual(m.paf.t + 1);
  expect(m.paf.b).toBeLessThanOrEqual(m.yuz.t + 1);
  // Kabuk da kartın gövdesinin tamamı: aralarında yalnız kenarlık payı var.
  expect(m.kutu.h - m.kanvas.h).toBeLessThanOrEqual(4);
  // TABLOSUZ kart (işletme ön ayarı): çizim kabuğun TAMAMI.
  const mi = await olc(page, idIsletme);
  expect(mi.paf).toBeNull();
  expect(Math.round(mi.svg.h)).toBe(Math.round(mi.kanvas.h));
  expect(Math.round(mi.svg.w)).toBe(Math.round(mi.kanvas.w));

  // ── 2) YÜZEN ÇUBUK: TEK SATIR, KARTIN İÇİNDE ───────────────────────────
  // `left:50%` ile ortalanırsa mutlak kabın sığdırma genişliği "kap − left"
  // oluyor (440'lık kartta 220) ve çubuk DÖRT satıra sarıyor: ölçüldü, 40 px
  // yerine 110 px. Yüzen çubuğun bütün kazancı geri giderdi.
  expect(m.secici).toBe(3);
  expect(m.katDugme).toBe(1);
  // Kayış Tablosu'nun düğmesi de çubukta (tabloyu kartın içinde açar/kapar)
  // ve çubuk onunla da TEK SATIR kalıyor — aşağıdaki yükseklik kapısı ikisini
  // birlikte ölçüyor.
  expect(m.tabloDugme).toBe(1);
  expect(m.yuz.h).toBeLessThan(48);                         // tek satır
  expect(m.yuz.l).toBeGreaterThanOrEqual(m.kutu.l - 1);
  expect(m.yuz.r).toBeLessThanOrEqual(m.kutu.r + 1);
  expect(m.yuz.b).toBeLessThanOrEqual(m.kutu.b + 1);
  // Çubuk içinde yatay kaydırma YOK: seçiciler daralıyor, sarmıyor.
  expect(await page.evaluate((i) => {
    const y = document.getElementById(i).querySelector('.ve-fead-yuz');
    return y.scrollWidth > y.clientWidth + 1;
  }, id)).toBe(false);

  // ── 3) YÖN GÜLÜ ÇUBUĞUN ALTINDA DEĞİL ──────────────────────────────────
  // ÖLÇÜLMÜŞ HATA: bantlar kalkınca gülün varsayılan yeri (sağ alt) tam
  // çubuğun altına düştü ve gül TAMAMEN görünmez oldu. Gül süs değil —
  // "montaj açısı −3,18°" gibi bir sayının hangi yöne baktığı yalnız ondan
  // okunuyor. Çözüm çizimi küçültmek değil, gülü yukarı almaktı.
  expect(m.gul).not.toBeNull();
  expect(m.gulOrtuldu).toBe(false);
  expect(m.gulTabloda).toBe(false);                        // tablonun altında da değil

  // ── 4) DURUM ROZETİ SAĞ ÜSTTE ──────────────────────────────────────────
  expect(m.rozet.t - m.kanvas.t).toBeLessThan(12);
  expect(m.kanvas.r - m.rozet.r).toBeLessThan(12);
  expect((await page.locator('#' + id + ' .ve-fead-kan-durum').innerText())
    .replace(/\s+/g, ' ')).toContain('Σsarım');

  // ── 5) TİTREŞİM ŞERİDİ DE YÜZÜYOR — ÇİZİM KÜÇÜLMÜYOR ───────────────────
  // Bant hâlinde titreşimi açmak çizimden 20 px koparıyordu ("bedelini
  // isteyen öder"); artık bedel sıfır.
  await page.evaluate((i) => {
    veFeadSetChoice(i, 'animRpm', '800');
    veFeadSetChoice(i, 'vibMode', 'span');
  }, id);
  await page.waitForTimeout(600);
  const v = await olc(page, id);
  expect(v.vib).not.toBeNull();
  expect(Math.round(v.ciz.h)).toBe(Math.round(m.ciz.h));     // çizim DEĞİŞMEDİ
  expect(Math.round(v.svg.h)).toBe(Math.round(m.svg.h));
  // Şerit tablonun ve çubuğun ÜSTÜNDE, hiçbiriyle çakışmıyor.
  expect(v.vib.b).toBeLessThanOrEqual(v.paf.t + 1);
  expect(v.vib.b).toBeLessThanOrEqual(v.yuz.t + 1);
  expect(v.vib.l).toBeGreaterThanOrEqual(v.kutu.l - 1);
  expect(v.vib.r).toBeLessThanOrEqual(v.kutu.r + 1);
  await page.evaluate((i) => veFeadSetChoice(i, 'vibMode', 'off'), id);
  await page.waitForTimeout(400);

  // ── 6) ROZETİN BİRİNCİL OKUMASI DURUMA GÖRE DEĞİŞİYOR ──────────────────
  // Yolunda olan hâlde birincil metin TEK SAYI (Σsarım), kasnak sayısı ve boy
  // ikincil; yolunda OLMAYAN hâlde birincil metin ARIZANIN CÜMLESİ ve ikincil
  // metin hiç yok. Ters olsaydı "Kayış yolu kapanmadı" bir onay işaretinin
  // yanında ikinci sınıf bir not olarak dururdu.
  //
  // BOZMA YOLU BİLEREK ÇAP: sürücünün temas tarafını çevirmek BOZMUYOR —
  // çevrim aynalanıyor ve Σ −360° çıkıyor, ki çekirdek onu geçerli sayıyor
  // (rozet "(ters yön)" yazıp yeşil kalıyor, doğrusu bu). Kayış Tablosu
  // kapılarının kullandığı ✗ kolu çaptır.
  const rozetParca = () => page.evaluate((i) => {
    const r = document.getElementById(i).querySelector('.ve-fead-kan-durum');
    return { sinif: r.className,
             isaret: r.querySelector('b').textContent,
             birincil: r.querySelector('span').textContent,
             ikincil: r.querySelector('i') ? r.querySelector('i').textContent : null,
             renk: getComputedStyle(r).color };
  }, id);
  const iyi = await rozetParca();
  expect(iyi.isaret).toBe('✓');
  expect(iyi.birincil).toMatch(/^Σsarım/);                  // birincil: tek sayı
  expect(iyi.ikincil).toMatch(/kasnak/);                    // ikincil: künye

  const acId = await page.evaluate(() =>
    window.nodes.find((n) => n.type === 'fead-ac').id);
  const acOd = await page.evaluate((i) =>
    window.nodes.find((n) => n.id === i).data.od, acId);
  await page.evaluate((i) => veFeadTableSet(i, 'od', 5000), acId);
  await page.waitForTimeout(600);
  const kot = await rozetParca();
  expect(kot.isaret).toBe('✗');
  expect(kot.birincil).toMatch(/KAPANMIYOR|İÇİNDEN|kapanmadı/);  // birincil: arıza
  expect(kot.ikincil).toBeNull();                           // ikincil YOK
  // Kırmızı ve YEŞİL DEĞİL — renk CSS'ten geliyor, jsdom hesaplamaz.
  expect(kot.renk).not.toBe(iyi.renk);
  await page.evaluate((a) => veFeadTableSet(a.i, 'od', a.d), { i: acId, d: acOd });
  await page.waitForTimeout(600);
  expect((await rozetParca()).renk).toBe(iyi.renk);

  expect(hatalar).toEqual([]);
});

// ── ÇUBUĞUN SEÇİCİLERİ KESİLMİYOR ────────────────────────────────────────
// Liste genişliğini EN UZUN seçeneğinden alıyordu: "Kapalı" yazan Titreşim
// "Çırpma (kayış verisi kapalı)" kadar yer istiyor, daralma payını da en çok o
// alıyordu. Ölçüldü (12 örnek × 2 kart × 3 seçici): varsayılan hâlde 72
// seçicinin 25'i kesikti — "Çalışma (Mean) · 28.1°" 105 px isterken 51 px.
// Şimdi seçici SEÇİLİ metne göre boyutlanıyor (`field-sizing:content`) ve
// kol listesi modelin kısa adını taşıyor. jsdom yerleşim hesaplamaz: bu
// halka Node'da HİÇ koşmuyor.
test('ÇUBUK SEÇİCİLERİ: seçili metin hiçbir durumda kesilmiyor', async ({ page }) => {
  await bootApp(page);
  await feadOrnek(page);
  const kesikler = () => page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const out = [];
    document.querySelectorAll('.ve-fead-yuz .ve-fead-yuz-dnt select').forEach((s) => {
      const cs = getComputedStyle(s);
      c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      const metin = s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : '';
      const icerik = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (c.measureText(metin).width > icerik + 0.5) out.push(metin + ' (' + Math.round(icerik) + ' px)');
    });
    const yuk = [...document.querySelectorAll('.ve-fead-yuz')].map((e) => e.getBoundingClientRect().height);
    return { out, sayi: document.querySelectorAll('.ve-fead-yuz .ve-fead-yuz-dnt select').length, yuk };
  });
  const kartlar = await page.evaluate(() => window.nodes.filter((n) => n.type === 'fead-layout').map((n) => n.id));
  const durumlar = [null, { animRpm: 'scn' }, { posMode: 'all' }, { vibMode: 'mode:0' }];
  for (const d of durumlar) {
    if (d) await page.evaluate(([ids, s]) => ids.forEach((id) =>
      Object.entries(s).forEach(([k, v]) => veFeadSetChoice(id, k, v))), [kartlar, d]);
    await page.waitForTimeout(500);
    const r = await kesikler();
    expect(r.sayi).toBe(kartlar.length * 3);                     // üç seçici × kart
    expect([JSON.stringify(d), r.out]).toEqual([JSON.stringify(d), []]);
    r.yuk.forEach((h) => expect(h).toBeLessThan(48));           // çubuk hâlâ TEK SATIR
  }
});
