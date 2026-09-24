/**
 * kabuk-sutun.spec.js — ATÖLYE KABUĞU: TEK SÜTUN + ALT DURUM ŞERİDİ
 * ──────────────────────────────────────────────────────────────────
 *
 * Bu halkaların hiçbiri Node'da koşamaz: ölçülen şey YERLEŞİM — hangi kutu
 * nerede, hangi kenarlık çiziliyor, tuvale kaç piksel kalıyor. jsdom
 * `getBoundingClientRect`i hep sıfır döndürür ve `border-right-color`ı
 * kaskaddan hesaplamaz.
 *
 * ÜÇ HÜKÜM:
 *
 * 1) RAY + PALET TEK SÜTUN. İkisi ayrı ebeveynde ve bu YAPISAL: ray
 *    `.ve-main`'in dışında, çünkü Sonuçlar'a geçince panel de tuval de
 *    değişir, ray yerinde kalır. Birleştirme bu yüzden bir DOM taşıması
 *    değil, bir YÜZEY kararı: aynı zemin + aradaki dikey çizginin kalkması.
 *    Çizgi yalnız TUVAL sayfasında kalkar — Sonuçlar'da palet gizleniyor ve
 *    sütunun tek kenarı onunla gidiyor, ray kendi kenarını geri almalı.
 *
 * 2) DURUM ŞERİDİ TUVALİN ALTINDA. Eskiden sekme bandının sağ yarısındaydı
 *    (327 px) ve bant tuvalin üstündeydi. O yerleşimin gerekçesi
 *    ("sekme açtığı belgeye bağlanır") yalnız SEKMELERE ait. Şerit inince
 *    sekmeler bandın tamamını aldı: 662 → 996 px.
 *
 * 3) KABUK TEK ÇİZGİ (2026-09-23). Üst kenardaki üç başlık ("Bileşenler",
 *    sekmeler, müfettiş) tek bant: aynı ölçü, aynı zemin, aynı alt çizgi.
 *    Tuval kenara yapışık; "tuval bir ÇUKURA oturur" hükmü emekli.
 *
 * ÖDENEN BEDEL BURADA ÇİVİLİ: tuval 24 px kaybetti. Bunu gizlemek yerine
 * ölçüyoruz — ve şeridin katlanmasının 86 px geri getirdiğini de.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');

test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});

async function modulAc(page) {
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.click('.ve-module-card[data-module="fead-analysis"]');
  await page.waitForTimeout(1200);
}

const olc = () => {
  const g = (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return {
      x: Math.round(b.x), y: Math.round(b.y),
      w: Math.round(b.width), h: Math.round(b.height),
      sagKenar: cs.borderRightColor, gorunur: b.width > 0 && b.height > 0,
    };
  };
  return {
    ray: g('#ve-nav-rail'), palet: g('#ve-sidebar'), dock: g('#ve-doc-dock'),
    durum: g('#ve-status-bar'), tuval: g('#ve-split-container'),
    bayrak: document.documentElement.classList.contains('ve-sayfa-tuval'),
    katli: !!document.querySelector('#ve-ribbon.is-collapsed'),
  };
};

// Saydam mı? `rgba(…, 0)` — tarayıcı `transparent`ı böyle serileştirir.
const saydam = (renk) => /,\s*0\s*\)$/.test(renk);

test('ray ile palet TEK sütun — aralarında çizgi yok, sağ kenarda TEK çizgi', async ({ page }) => {
  await modulAc(page);
  const r = await page.evaluate(olc);

  // bitişik
  expect(r.palet.x).toBe(r.ray.x + r.ray.w);
  // aradaki çizgi YOK
  expect(saydam(r.ray.sagKenar)).toBe(true);
  // sütunun sağ kenarında çizgi VAR
  expect(saydam(r.palet.sagKenar)).toBe(false);
});

test('Sonuçlar sayfasında ray kendi kenarını GERİ ALIR', async ({ page }) => {
  await modulAc(page);
  await page.evaluate(() => veSubTabDegistir('sonuclar'));
  await page.waitForTimeout(500);
  const r = await page.evaluate(olc);

  expect(r.bayrak).toBe(false);
  expect(r.palet.gorunur).toBe(false);        // palet gizlendi
  expect(saydam(r.ray.sagKenar)).toBe(false); // ray kenarını geri aldı
});

test('durum şeridi TUVALİN ALTINDA ve tuval genişliğinde', async ({ page }) => {
  await modulAc(page);
  const r = await page.evaluate(olc);

  expect(r.durum.y).toBeGreaterThanOrEqual(r.tuval.y + r.tuval.h - 1);
  expect(r.durum.x).toBe(r.tuval.x);
  expect(r.durum.w).toBe(r.tuval.w);
  // ve sekme bandının İÇİNDE değil
  expect(r.durum.y).toBeGreaterThan(r.dock.y + r.dock.h);
});

test('sekme bandı artık bandın TAMAMI — durum onu yemiyor', async ({ page }) => {
  await modulAc(page);
  const r = await page.evaluate(olc);
  expect(r.dock.w).toBe(r.tuval.w);
});

// ŞERİT KATLAMASI ZATEN VARDI (aktif sekmeye ikinci tık). Alt şerit onu
// bozmamalı: kazanç ölçülüyor ki bir sonraki tur farkında olmadan yutmasın.
//
// KAPI DURUMA DUYARLI, VARSAYILANA DEĞİL. İlk yazımı "açık başlar, katlayınca
// kazanır" diye kuruluyordu; üst bant turu gövdeyi VARSAYILAN KATLI yapınca
// aynı çağrı gövdeyi AÇIYOR ve kazanç eksiye dönüyordu. Hüküm hiç değişmedi —
// mekanizma tuvali ölçülebilir biçimde oynatıyor — ölçüm o hükme çevrildi.
test('şerit katlaması tuvali ölçülebilir biçimde oynatıyor', async ({ page }) => {
  await modulAc(page);
  const a = await page.evaluate(olc);
  await page.evaluate(() => veRibbonToggleCollapse());
  await page.waitForTimeout(500);
  const b = await page.evaluate(olc);

  // Hangisi katlıysa tuval O DURUMDA daha yüksek olmalı
  const katliOlan = a.katli ? a : b;
  const acikOlan = a.katli ? b : a;
  expect(katliOlan.katli).toBe(true);
  expect(acikOlan.katli).toBe(false);
  expect(katliOlan.tuval.h - acikOlan.tuval.h).toBeGreaterThan(60);

  // ve her iki durumda da durum şeridi ALTTA kalır
  [a, b].forEach((s) => {
    expect(s.durum.y).toBeGreaterThanOrEqual(s.tuval.y + s.tuval.h - 1);
  });
});

// ── KABUK TEK ÇİZGİ (2026-09-23) ───────────────────────────────────────────
// Kullanıcı: "pencere sınırları bir hizasız, tatsız, güzel değil." Ölçülen:
// üst kenarda yan yana üç başlık üç ayrı ölçü — "Bileşenler" 37, sekme bandı
// 29, müfettiş başlığı 33 px; alt çizgileri y=75 · 67 · 71'de. Tuval de 8 px
// içeride, 10 px köşeli ayrı çerçevedeydi (EMEKLİ "tuval bir ÇUKURA oturur"
// hükmü): her sınır iki çizgiydi ve aktif sekme tuvale değil aradaki 8 px'lik
// kâğıda açılıyordu.
//
// Node'da ölçülemez: jsdom yerleşim hesaplamaz, bir metnin çizildiği satırı
// (`Range.getBoundingClientRect`) hiç bilmez. CSS metninin kapısı
// tests/unit/kabuk-bant.test.js.
test('KABUK TEK ÇİZGİ — üç başlık aynı bantta, tuval komşularına yapışık', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await modulAc(page);
  // Sihirbaz boş topolojiyi karşılıyor; kapatıp açılış yüzeyinin bir kartının
  // penceresini sütunda açıyoruz (müfettiş başlığı ancak açıkken var).
  await page.evaluate(() => {
    if (typeof veFeadWizClose === 'function') veFeadWizClose(false);
    const n = nodes.find((x) => x.type === 'fead-layout') || nodes[0];
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
  });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const k = (s) => document.querySelector(s).getBoundingClientRect();
    const orta = (s) => {
      const rg = document.createRange(); rg.selectNodeContents(document.querySelector(s));
      const b = rg.getBoundingClientRect(); return b.top + b.height / 2;
    };
    const sb = k('.ve-sidebar-header'), dk = k('#ve-doc-dock'), mh = k('.ve-properties-header');
    const sp = k('#ve-sidebar'), w = k('#ve-canvas-wrapper'), st = k('#ve-status-bar');
    const mu = k('#ve-properties'), tab = k('#ve-tab-bar .ve-tab.active'), tb = k('#ve-tab-bar');
    const wcs = getComputedStyle(document.querySelector('#ve-canvas-wrapper'));
    const tcs = getComputedStyle(document.querySelector('#ve-tab-bar .ve-tab.active'));
    return {
      alt: [sb.bottom, dk.bottom, mh.bottom], boy: [sb.height, dk.height, mh.height],
      yazi: [orta('.ve-sidebar-title'), orta('#ve-tab-bar .ve-tab.active'), orta('#ve-properties-title')],
      tuval: { sol: w.left - sp.right, ust: w.top - dk.bottom, sag: mu.left - w.right, alt: st.top - w.bottom },
      kose: wcs.borderTopLeftRadius, golge: wcs.boxShadow, kenar: wcs.borderTopWidth,
      sekme: { alt: tab.bottom - dk.bottom, kesik: tab.bottom - tb.bottom, zemin: tcs.backgroundColor, tuvalZemin: wcs.backgroundColor },
    };
  });
  // Üç başlığın alt çizgisi AYNI y'de ve ölçüleri aynı (eski: 75 · 67 · 71).
  expect(Math.max(...r.alt) - Math.min(...r.alt)).toBeLessThanOrEqual(0.5);
  expect(Math.max(...r.boy) - Math.min(...r.boy)).toBeLessThanOrEqual(0.5);
  // Yazıları da aynı ortada: sekme bandın dibine yaslı kısa bir kutu olsaydı
  // "Topoloji 1" komşularından aşağıda kalırdı.
  expect(Math.max(...r.yazi) - Math.min(...r.yazi)).toBeLessThanOrEqual(1.5);
  // Tuval dört kenarda da komşusunun çizgisine yapışık (eski: 8 px pay her yanda).
  Object.values(r.tuval).forEach((p) => expect(Math.abs(p)).toBeLessThanOrEqual(0.5));
  expect(r.kose).toBe('0px');
  expect(r.kenar).toBe('0px');
  expect(r.golge).toBe('none');
  // Aktif sekme bandın çizgisini ÖRTÜYOR ve tuvalin zeminini taşıyor: tuvale
  // bağlanıyor. Şerit onu KESMİYOR (overflow-y:hidden).
  expect(Math.abs(r.sekme.alt)).toBeLessThanOrEqual(0.5);
  expect(r.sekme.kesik).toBeLessThanOrEqual(0.5);
  expect(r.sekme.zemin).toBe(r.sekme.tuvalZemin);
});

// BANT İNCE — ÖLÇÜ İÇERİKTEN (2026-09-24). Kullanıcı: 36 px'lik bant
// "gereksiz kalın". Bantların doğal yüksekliği 21 · 28 · 23 · 24 · 33 px'ti
// (Sonuçlar araç çubuğu 4 px'lik iç payla); bant 30 px'e indi, çubuğun payı
// 2 px'e. Kapı iki yönlü: her bant jetonun KENDİSİ (içerik bandı
// büyütmüyor — büyüseydi o bant komşusundan uzun kalırdı) ve jeton ince.
// Sonuçlar'ın iki bandı da burada, çünkü jeton onların da ölçüsü ve bu spec
// ürün kapısında (results-txt-page.spec.js değil).
test('BANT İNCE — her bant jetonun kendisi, içerik onu büyütmüyor', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await modulAc(page);
  await page.evaluate(() => {
    if (typeof veFeadWizClose === 'function') veFeadWizClose(false);
    const n = nodes.find((x) => x.type === 'fead-layout') || nodes[0];
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
  });
  await page.waitForTimeout(600);
  const boy = (sel) => page.evaluate((sel) => sel.map((s) => {
    const e = document.querySelector(s);
    return e && e.offsetWidth ? s + ' ' + e.getBoundingClientRect().height : s + ' YOK';
  }), sel);
  const jeton = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bant-h')));
  const topoloji = await boy(['.ve-sidebar-header', '#ve-doc-dock', '.ve-properties-header']);
  await page.evaluate(() => { veTogglePropertiesPanel(false); veSubTabDegistir('sonuclar'); });
  await page.waitForTimeout(800);
  const sonuclar = await boy(['.ve-results-head', '.ve-trace-toolbar']);
  // Jeton ince (eski: 36 px) ama en yüksek içeriği (araç çubuğu, 29) sığdırıyor.
  expect(jeton).toBeLessThanOrEqual(30);
  // Beş bandın beşi de ölçüldü (bulunamayan bant sessizce geçmesin) ve beşi
  // de tam jeton: içerik hiçbirini büyütmüyor.
  const hepsi = [...topoloji, ...sonuclar];
  expect(hepsi.filter((x) => / YOK$/.test(x))).toEqual([]);
  expect(hepsi.filter((x) => Math.abs(parseFloat(x.split(' ').pop()) - jeton) > 0.5)).toEqual([]);
});

// BAŞLIK İÇERİĞİN KENARINDA + KİMLİK SATIRI TİPİ SÖYLER (2026-09-23).
// Bandın başlığı altındaki sütunun sol kenarından başlamalı: "Bileşenler"
// simgesi 76'da, altındaki kategori başlıkları ve öğe simgeleri 81'deydi;
// müfettiş başlığı 1233'te, içeriği 1231'de. Kimlik satırı da iç kimliği
// basıyordu ("ID: comp-4") — kullanıcıya bir şey demeyen, hiçbir yerde
// aranamayan bir dize. Yerine TİP: "Sürücü Kasnak (FAN)" bir Fan Kavraması.
test('başlıklar içeriğin kenarında; kimlik satırı iç kimliği değil TİPİ söylüyor', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await modulAc(page);
  await page.evaluate(() => {
    if (typeof veFeadWizClose === 'function') veFeadWizClose(false);
    veFeadLoadExample('AG00976_GATES_2025');
  });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const sol = (el) => { const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect().left; };
    const kat = [...document.querySelectorAll('.ve-sidebar-content .ve-category')].find((c) => c.offsetParent);
    const kenar = {
      bas: document.querySelector('.ve-sidebar-header .mf-ico').getBoundingClientRect().left,
      kategori: sol(kat.querySelector('.ve-category-title')),
      oge: kat.querySelector('.ve-component svg').getBoundingClientRect().left,
    };
    const ac = async (n) => {
      clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
      await new Promise((z) => setTimeout(z, 500));
      const P = document.querySelector('#ve-properties');
      const ic = document.querySelector('.ve-properties-content');
      const o = { tip: (P.querySelector('.ve-prop-tip') || {}).textContent || null,
        kimlik: /\bcomp-\d+\b/.test(P.textContent),
        bas: document.querySelector('.ve-properties-header .mf-ico').getBoundingClientRect().left,
        icerik: ic.getBoundingClientRect().left + parseFloat(getComputedStyle(ic).paddingLeft) };
      veTogglePropertiesPanel(false);
      await new Promise((z) => setTimeout(z, 250));
      return o;
    };
    const surucu = nodes.find((x) => x.data && x.data.driver);
    return { kenar, surucu: await ac(surucu), tipAdi: componentDefs[surucu.type].name,
             cozucu: await ac(nodes.find((x) => x.type === 'fead-solver')) };
  });
  // Kenar çubuğu: başlığın simgesi = kategori başlığı = öğe simgesi (eski: 76 · 81 · 81).
  expect(Math.abs(r.kenar.bas - r.kenar.kategori)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.kenar.bas - r.kenar.oge)).toBeLessThanOrEqual(1);
  // Müfettiş: başlığın simgesi içeriğin sol kenarında (eski: 1233 ↔ 1231).
  expect(Math.abs(r.surucu.bas - r.surucu.icerik)).toBeLessThanOrEqual(0.5);
  // Adlandırılmış bileşen tipini söylüyor; iç kimlik HİÇBİR yerde basılmıyor.
  expect(r.surucu.tip).toBe(r.tipAdi);
  expect(r.surucu.kimlik).toBe(false);
  // Adı tipin adı olan bileşende alt satır YOK — aynı sözcük iki kez yazılmaz.
  expect(r.cozucu.tip).toBe(null);
  expect(r.cozucu.kimlik).toBe(false);
});

// KARŞILAMA EKRANINDA DURUM ŞERİDİ YOK.
// Kural eskiden GEREKMİYORDU: şerit `.ve-doc-dock`in içindeydi ve onun
// `.ve-no-module` kuralıyla birlikte gizleniyordu. Şerit tuvalin altına
// taşınınca kapsamdan SESSİZCE çıktı ve karşılamanın dibinde
// "0 bileşen, 0 bağlantı · %100 · Hazır" belirdi — arkada açık bir topoloji
// varmış gibi. BİR ÖĞEYİ TAŞIMAK, ÜSTÜNDEKİ KURALLARI DA TAŞIMAKTIR.
test('karşılama ekranında durum şeridi GÖRÜNMÜYOR', async ({ page }) => {
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });

  const karsilama = await page.evaluate(() => {
    const g = (s) => {
      const e = document.querySelector(s);
      if (!e) return { yok: true };
      const b = e.getBoundingClientRect();
      return { gorunur: b.width > 0 && b.height > 0 };
    };
    return { durum: g('#ve-status-bar'), dock: g('#ve-doc-dock'),
             modulYok: !!document.querySelector('.ve-main.ve-no-module') };
  });
  expect(karsilama.modulYok).toBe(true);
  expect(karsilama.durum.gorunur).toBe(false);
  expect(karsilama.dock.gorunur).toBe(false);

  // ve modüle girince GERİ GELİR — gizleme kalıcı olmamalı
  await page.click('.ve-module-card[data-module="fead-analysis"]');
  await page.waitForTimeout(1200);
  const icerde = await page.evaluate(() => {
    const b = document.querySelector('#ve-status-bar').getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  });
  expect(icerde).toBe(true);
});

// PALET: LİSTE SATIRI, KUTU DEĞİL (2026-09-23). Kullanıcı bildirimi (kenar
// çubuğunun ekran görüntüsüyle): "Şuradaki yapı biraz karışık. Düzen vs yok."
// Ölçülen iki kusur: (1) kategori başlığı ne kutunun kenarına ne ikona
// oturuyordu (kutu 72,5 · başlık 76 · ikon 82 px); (2) her öğe dolu zeminli,
// kenarlıklı bir kutuydu — FEAD paletinde on dokuz kutu üst üste.
test('palet: kategori başlığı İKONUN kenarında, öğe dinlenmede zeminsiz', async ({ page }) => {
  await modulAc(page);
  await page.mouse.move(1500, 900);           // fare hiçbir öğenin üstünde değil
  const r = await page.evaluate(() => {
    const kaymis = [], dolu = [];
    let olculen = 0;
    document.querySelectorAll('#ve-sidebar .ve-category').forEach((kat) => {
      const bas = kat.querySelector('.ve-category-title');
      const oge = [...kat.querySelectorAll('.ve-component')].filter((o) => o.getBoundingClientRect().height > 0);
      if (!bas || !oge.length || !bas.getBoundingClientRect().height) return;
      const ikon = oge[0].querySelector('svg');
      if (!ikon) return;
      olculen++;
      const rg = document.createRange(); rg.selectNodeContents(bas);
      const dx = rg.getBoundingClientRect().left - ikon.getBoundingClientRect().left;
      if (Math.abs(dx) > 1) kaymis.push(bas.textContent.trim() + ' ' + dx.toFixed(1) + ' px');
      oge.forEach((o) => {
        if (o.classList.contains('ve-submodule')) return;       // modül satırı kendi kabı
        const z = getComputedStyle(o).backgroundColor;
        if (!/,\s*0\s*\)$/.test(z) && z !== 'transparent') dolu.push(o.textContent.trim() + ' ' + z);
      });
    });
    return { kaymis, dolu, olculen };
  });
  expect(r.olculen).toBeGreaterThanOrEqual(2);  // FEAD Kasnakları + Araçları + Araçlar
  expect(r.kaymis).toEqual([]);
  expect(r.dolu).toEqual([]);
});
