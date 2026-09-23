/**
 * kabuk-sutun.spec.js — ATÖLYE KABUĞU: TEK SÜTUN + ALT DURUM ŞERİDİ
 * ──────────────────────────────────────────────────────────────────
 *
 * Bu halkaların hiçbiri Node'da koşamaz: ölçülen şey YERLEŞİM — hangi kutu
 * nerede, hangi kenarlık çiziliyor, tuvale kaç piksel kalıyor. jsdom
 * `getBoundingClientRect`i hep sıfır döndürür ve `border-right-color`ı
 * kaskaddan hesaplamaz.
 *
 * İKİ HÜKÜM:
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

// ── TUVAL ÇUKURU (Tur B) ───────────────────────────────────────────────────
// EMEKLİ HÜKÜM: "yalnız YÜZEN katman gölge alır; yerinde duran kabuk gölge
// almaz" kuralı tuvali düz bir dikdörtgen tutuyordu. İÇ gölge bir YÜKSELTİ
// değil bir DERİNLİK — nesneyi kaldırmaz, yüzeyi oyar; o ayrım olmadan kural
// çukuru da yasaklıyordu.
//
// Node'da ölçülemez: jsdom `box-shadow`u kaskaddan hesaplamaz ve `inset`
// anahtarını hiç döndürmez.
test('tuval bir ÇUKURA oturuyor — her kenardan içeri, yarıçaplı, İÇ gölgeli', async ({ page }) => {
  await modulAc(page);
  const r = await page.evaluate(() => {
    const w = document.querySelector('#ve-canvas-wrapper');
    const c = document.querySelector('#ve-split-container');
    const bw = w.getBoundingClientRect(); const bc = c.getBoundingClientRect();
    const cs = getComputedStyle(w);
    return {
      sol: Math.round(bw.x - bc.x), ust: Math.round(bw.y - bc.y),
      sag: Math.round((bc.x + bc.width) - (bw.x + bw.width)),
      alt: Math.round((bc.y + bc.height) - (bw.y + bw.height)),
      r: parseFloat(cs.borderTopLeftRadius),
      icGolge: /inset/.test(cs.boxShadow),
      kenar: parseFloat(cs.borderTopWidth),
    };
  });
  // DÖRT kenardan da içeri: tek kenarda pay, çukur değil kaymadır
  [r.sol, r.ust, r.sag, r.alt].forEach((p) => expect(p).toBeGreaterThan(0));
  expect(r.sol).toBe(r.sag);
  expect(r.ust).toBe(r.alt);
  expect(r.r).toBeGreaterThan(0);
  expect(r.kenar).toBeGreaterThan(0);
  // GÖLGE İÇERİDE: dış gölge yükselti olurdu — emekli hükmün yasakladığı şey o
  expect(r.icGolge).toBe(true);
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
