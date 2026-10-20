/**
 * mount-pencere.spec.js — TAKOZ PENCERELERİNİN ÇİZİMİ (gerçek tarayıcı)
 * ─────────────────────────────────────────────────────────────────────────
 * Tur 6 (2026-10-15) ölçümü:
 *   · Örnek penceresinin "Kanvasa kurulacak topoloji" şeması: tek dosyada PNG
 *     gömülü değil, kullanıcının gördüğü her zaman YEDEK ŞEMA. Şemanın içindeki
 *     ikonlar kabın enine büyüyordu (`.ve-mnt-ex-sema svg{width:100%}` iç
 *     svg'leri de yakalıyor: 40 → 137 px), adları 4,8 px'ti
 *   · 2D tam ekranda köşe göstergesi ("+Y") soldaki takozun karesinin altında
 *     (Siper, önden görünüş); koordinat üçlüsü "·" ayraçlıydı
 *   · (3B tam ekranın three.js kamerası ve ipucu kapıları 2026-10-16'da
 *     sahneyle birlikte EMEKLİ: "Klasik 3B" yalnız ad — kullanıcı kararı)
 *   · 2026-10-16: döndürülebilir aksonometri 3D Görüntüleyici'den 2D
 *     Görünüm'e taşındı, bileşenin adı Görünümler; düz görünüşler (üç sekme ve
 *     tam ekranın altı) kalktı, işaretler büyüdü (pencerede takoz 12 → 18 px,
 *     G 13 → 19,6 px). 3D Görüntüleyici yer tutucu (2026-10-20'den beri
 *     CAD'in evi: STEP dosyası ve roller — tests/e2e/mount-cad.spec.js).
 *   · 2026-10-16 (ikinci tur, kullanıcı kararı): Görünümler TEK görünüm
 *     (çizim + işaretler), açı yazısı ve bölümleri yok, tam ekran çizimin
 *     başlığında; pencere SONUÇ GÖSTERMEZ (kuvvet, sehim, mod katmanı ve
 *     canlandırma kalktı). "Güç grubundaki yeri" aksonometrik, bileşen işaretli.
 *   · 2026-10-16 (üçüncü tur, kullanıcı): sürüklerken yazılar kayboluyordu
 *     (Tulga'da 15 yazının 3'ü kalıyordu) — artık yazılı ve işaretiyle
 *     yürüyor; föyün satırı çizimdeki parçayı aydınlatıyor (perde); "Güç
 *     grubundaki yeri" Görünümler'in döndürülebilir bileşeni, bileşen
 *     perdenin üstünde; tam ekranın altında 85–495 px boşluk kalıyordu.
 * Node'da koşamaz: CSS seçicisi ve yerleşim tarayıcıda.
 */
const { test, expect } = require('@playwright/test');
const Y = require('../helpers/yerlesim-olcu.js');
test.setTimeout(240000);
// Servis çalışanının (sw.js) karşıladığı istek `page.route`a hiç uğramıyor —
// PNG'yi yok saymak için kapalı olmalı.
test.use({ serviceWorkers: 'block' });

async function bootApp(page) {
  await page.setViewportSize({ width: 1920, height: 952 });
  // İkinci örnek "İç topoloji … DEĞİŞTİRİLECEK" onayını soruyor
  page.on('dialog', (d) => d.accept());
  // Tek dosyadaki hâl: örnek PNG'leri gömülü değil
  await page.route('**/assets/examples/*.png', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntLoadExample === 'function' &&
    typeof window.veMntAkso3BTamEkran === 'function' && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}
async function ornek(page, k, imza) {
  await page.evaluate((kk) => {
    let ex = nodes.find((x) => x.type === 'mnt-example'); if (!ex) ex = createNode('mnt-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = kk; veMntLoadExample(ex.id);
  }, k);
  await page.waitForFunction((im) => nodes.some((n) => (n.customName || '').indexOf(im) >= 0), imza, { timeout: 20000 });
  await page.waitForTimeout(700);
}
const ORNEK = [['tulga', 'Ön Takoz Braketi'], ['siper', 'cradle'], ['asfat', '57RS']];

test('Örnek penceresi (PNG yok): şemanın ikonları kartının içinde, okunmayan yazı yok', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('mnt-example', 300, 200); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForTimeout(600);
  await page.evaluate(Y.KAYNAK);
  const out = [];
  for (const [k] of ORNEK) {
    // Pencere her örnekte yeniden açılır: modül açılışının gecikmeli bir adımı
    // ilk açılan pencereyi kapatabiliyor (ölçüldü: perde display:none, şema 0 px)
    await page.evaluate((kk) => {
      const n = nodes.find((x) => x.type === 'mnt-example');
      clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); veMntSetExample(n.id, kk);
    }, k);
    // Resim `loading="lazy"`: görüş alanına girene dek istenmez, yedeğe de
    // düşmez. Hemen istenir (404 → `onerror` → yedek şema), zamanlamaya kalmaz.
    await page.evaluate(() => {
      const f = document.querySelector('.ve-mnt-ex-sema');
      if (f) f.scrollIntoView({ block: 'center' });
      const img = f && f.querySelector('img');
      if (img) img.loading = 'eager';
    });
    await page.waitForFunction(() => {
      const f = document.querySelector('.ve-mnt-ex-sema');
      const d = f && f.querySelector(':scope > svg, :scope > div > svg');
      return !!(d && d.getBoundingClientRect().width > 50);
    }, null, { timeout: 15000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const f = document.querySelector('.ve-mnt-ex-sema');
      const img = f && f.querySelector('img');
      const dis = f && f.querySelector(':scope > svg, :scope > div > svg');
      const buyuk = [...(dis ? dis.querySelectorAll('svg') : [])].filter((ic) => {
        const kart = ic.previousElementSibling;
        if (!kart || kart.tagName !== 'rect') return false;
        return ic.getBoundingClientRect().width > kart.getBoundingClientRect().width + 0.5;
      }).length;
      return { png: !!(img && img.naturalWidth), gorunur: !!(dis && dis.getBoundingClientRect().width > 50), buyuk,
        ikon: dis ? dis.querySelectorAll('svg').length : 0, yer: window.__yerlesim('.ve-mnt-ex-sema') };
    });
    expect(r.png).toBe(false);                 // yedek şema gerçekten görünen
    expect(r.gorunur).toBe(true);
    expect(r.ikon).toBeGreaterThan(5);
    if (r.buyuk) out.push(k + ': kartından büyük ikon ' + r.buyuk);
    Y.yerlesimOzet(r.yer, k).forEach((x) => out.push(x));
  }
  expect(out).toEqual([]);
});

// Tam ekranda düz görünüşler YOK (2026-10-16); işaretler adlarıyla, koordinat
// üçlüsü işaretin bilgisinde (fare üstü) "(x; y; z) mm".
test('Görünümler tam ekran: düz görünüş yok, yerleşim temiz, koordinat ayracı "; "', async ({ page }) => {
  await bootApp(page);
  const out = [];
  for (const [k, imza] of ORNEK) {
    await ornek(page, k, imza);
    await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-2dview'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
    await page.waitForTimeout(600);
    // Tam ekran düğmesi çizimin başlığında (2026-10-16): gerçek tıklama
    await page.click('#ve-properties .ve-mnt-akso3b .ve-mnt2d-zoomctl button[aria-label="Tam ekran"]');
    await page.waitForTimeout(1200);
    await page.evaluate(Y.KAYNAK);
    const r = await page.evaluate(() => ({ yer: window.__yerlesim('#ve-mnt-fs'),
      baslik: document.querySelector('#ve-mnt-fs .ve-settings-header').textContent.trim(),
      duz: document.querySelectorAll('#ve-mnt-fs .ve-mnt2d-gorunus, #ve-mnt-fs .ve-mnt2d-fig, #ve-mnt-fs .ve-mnt2d-fs-uc').length,
      bilgi: [...document.querySelectorAll('#ve-mnt-fs [data-mnt-info]')].map((e) => e.getAttribute('data-mnt-info')).join('\n') }));
    Y.yerlesimOzet(r.yer, k).forEach((x) => out.push(x));
    if (r.baslik !== 'Görünümler') out.push(k + ': başlık "' + r.baslik + '"');
    if (r.duz) out.push(k + ': tam ekranda düz görünüş ' + r.duz);
    if (/\d · [−-]?\d/.test(r.bilgi)) out.push(k + ': koordinat "·" ayraçlı');
    if (!/\(\s*[−-]?[\d.]+(,\d+)?; [−-]?[\d.]+(,\d+)?; [−-]?[\d.]+(,\d+)?\) mm/.test(r.bilgi)) out.push(k + ': "(x; y; z) mm" üçlüsü yok');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.evaluate(() => veTogglePropertiesPanel(false));
  }
  expect(out).toEqual([]);
});

// ── GÖRÜNÜMLER · AKSONOMETRİ (adım 3 + taşıma, 2026-10-16) ─────────────────
// Aksonometrinin SERBEST kamerası, Görünümler penceresinin tek çizimi. Node'daki
// kapı (mount-akso.test.js → SERBEST KAMERA · İŞARET BOYU) çizicinin
// matematiğini tutuyor; burada GERÇEK fare: sol tık + sürükle modeli eliyle
// döndürür ve çizim büyüyüp küçülmez, tekerlek imlecin altındaki takozu
// yerinde tutar, sağ tık kaydırır, oklar döndürür; başlığın Sıfırla'sı
// dimetriğe döner; her açıda ve tam ekranda yerleşim temiz; işaretler büyük.
const AKSO3B_SIFIR = () => Object.assign(VE_MNT_AKSO3B, { az: null, el: null });
test('Görünümler · Aksonometrik: sürükle-döndür, tekerlek, kaydır; her açıda yerleşim temiz, işaretler büyük', async ({ page }) => {
  await bootApp(page);
  const out = [];
  for (const [k, imza] of ORNEK) {
    await ornek(page, k, imza);
    await page.evaluate(async () => { const s = nodes.find((n) => n.type === 'mnt-solver'); await veMntSolverCompute(s.id); });
    await page.evaluate(AKSO3B_SIFIR);
    await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-2dview'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
    await page.waitForTimeout(900);
    await page.evaluate(Y.KAYNAK);
    const ilk = await page.evaluate(() => {
      const kat = [...document.querySelectorAll('#ve-properties .ve-fp-govde > .ve-fp-kat')];
      const kap = document.querySelector('#ve-properties .ve-mnt-akso-kap'), svg = kap && kap.querySelector('svg.ve-mnt2d-akso');
      // İŞARETİN EKRANDAKİ BOYU (CSS px): takoz küpü ve G'nin kutusunun uzun kenarı
      const k = svg ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 0;
      const boy = (sel) => [...svg.querySelectorAll(sel)].map((e) => { const r = e.getBBox(); return Math.max(r.width, r.height) * k; });
      return { kategoriler: kat.map((x) => x.getAttribute('data-k')), sekme: document.querySelectorAll('#ve-properties .ve-fp-tab').length,
        id: kap && kap.id, vb: svg && svg.viewBox.baseVal.width, en: svg && svg.getBoundingClientRect().width,
        sahne: !!window._veMountViewer, takoz: Math.min(...boy('.ve-ak-t')), G: Math.max(...boy('.ve-ak-gam')) };
    });
    expect(ilk.kategoriler).toEqual(['akso']);                     // tek görünüm: çizim + işaretler
    expect(ilk.sekme).toBe(0);                                     // sekme şeridi yok (2026-10-16)
    expect(ilk.sahne).toBe(false);                                 // three.js sahnesi kurulmadı
    expect(Math.abs(ilk.vb - ilk.en)).toBeLessThan(1.5);          // 1:1 — yazı küçülmez
    expect(ilk.takoz).toBeGreaterThan(17);                         // önce 12 px
    expect(ilk.G).toBeGreaterThan(19);                             // önce 13 px
    const id = ilk.id;
    const durum = () => page.evaluate((i) => ({ az: VE_MNT_AKSO3B.az, el: VE_MNT_AKSO3B.el, sc: _mntAksoCizim[i].F.sc,
      ad: document.querySelector('#' + i + ' [data-ak3b-ad]').textContent }), id);
    const olc = async (ad) => {
      await page.mouse.move(4, 4);
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => window.__yerlesim('#ve-properties'));
      Y.yerlesimOzet(r, k + ' · ' + ad).forEach((x) => out.push(x));
    };
    const ayar = (a, b) => page.evaluate(([i, kk, vv]) => veMntAksoAyar(i, kk, vv), [id, a, b]);
    await olc('dimetrik');
    // GERÇEK sürükleme: sağa 80 px → azimut 40° azalır, ölçek aynı
    const once = await durum();
    const kutu = async () => (await page.$('#' + id + ' svg.ve-mnt2d-akso')).boundingBox();
    let s = await kutu();
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(s.x + s.width / 2 + i * 10, s.y + s.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const sag = await durum();
    expect(sag.az).toBeCloseTo((once.az - 40 + 360) % 360, 6);
    expect(sag.sc).toBeCloseTo(once.sc, 9);
    expect(sag.ad).toBe('Serbest bakış');
    await olc('sağa sürüklendi');
    s = await kutu();
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2 + i * 10);
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect((await durum()).el).toBeCloseTo(once.el + 30, 6);
    await olc('aşağı sürüklendi');
    for (const [on, ad] of [['ust', 'Üstten'], ['on', 'Önden'], ['yan', 'Yandan'], ['iso', 'İzometrik']]) {
      await ayar('on', on);
      expect((await durum()).ad).toBe(ad);
      await olc(ad);
    }
    await page.evaluate((i) => { VE_MNT_AKSO3B.az = 200; VE_MNT_AKSO3B.el = 30; _mntAksoKur(i); }, id);
    await olc('az 200');
    // Başlığın Sıfırla'sı: dimetrik bakış (gerçek tıklama)
    await page.click('#' + id + ' .ve-mnt2d-zoomctl button[aria-label="Sıfırla — dimetrik bakış"]');
    expect((await durum()).ad).toBe('Dimetrik');
    if (k === 'tulga') {
      // TEKERLEK: imleç T1'in üstünde; üç tık sonra T1 yine imlecin altında
      const t1 = async () => { const b = await (await page.$('#' + id + ' svg.ve-mnt2d-akso .ve-ak-t[data-ak="T1"]')).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
      const p0 = await t1();
      await page.mouse.move(p0[0], p0[1]);
      for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(60); }
      await page.waitForTimeout(450);
      const p1 = await t1();
      expect(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])).toBeLessThan(1.5);
      expect(await page.evaluate((i) => _mntAksoGor[i].yakin, id)).toBeCloseTo(Math.pow(1.15, 3), 6);
      await olc('yakınlaşmış');
      // SAĞ TIK + sürükle: çizim imleçle kayar (görünüm 1:1)
      const g0 = await (await page.$('#' + id + ' svg.ve-mnt2d-akso .ve-ak-gam')).boundingBox();
      await page.mouse.move(p1[0] + 30, p1[1]);
      await page.mouse.down({ button: 'right' });
      for (let i = 1; i <= 4; i++) await page.mouse.move(p1[0] + 30 + i * 10, p1[1] + i * 5);
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(300);
      const g1 = await (await page.$('#' + id + ' svg.ve-mnt2d-akso .ve-ak-gam')).boundingBox();
      expect(g1.x - g0.x).toBeCloseTo(40, 0);
      expect(g1.y - g0.y).toBeCloseTo(20, 0);
      // KLAVYE: odaktaki çizimde sol ok azimutu 5° artırır; 0 sıfırlar
      const az0 = (await durum()).az;
      await page.focus('#' + id + ' svg.ve-mnt2d-akso');
      await page.keyboard.press('ArrowLeft');
      expect((await durum()).az).toBeCloseTo((az0 + 5) % 360, 6);
      await page.keyboard.press('0');
      const sifir = await durum();
      expect([sifir.ad, await page.evaluate((i) => _mntAksoGor[i].yakin, id)]).toEqual(['Dimetrik', 1]);
      // İŞARETLER föyü çizimle AYNI gövdede (2026-10-16): yerleşim temiz
      const nid = await page.evaluate(() => nodes.find((x) => x.type === 'mnt-2dview').id);
      expect(await page.evaluate((n) => document.querySelectorAll('#ve-fp-panes-' + n + ' > [data-k="akso"] tbody tr').length, nid)).toBe(14);
      await page.evaluate((n) => document.querySelector('#ve-fp-panes-' + n + ' > [data-k="akso"] table').scrollIntoView({ block: 'center' }), nid);
      await olc('İşaretler');
    }
    // TAM EKRAN: serbest açı, işaretler adlarıyla
    await page.evaluate(() => { VE_MNT_AKSO3B.az = 200; VE_MNT_AKSO3B.el = 30; veMntAkso3BTamEkran(); });
    await page.waitForTimeout(900);
    const tam = await page.evaluate(() => ({ yer: window.__yerlesim('#ve-mnt-fs'),
      ad: [...document.querySelectorAll('#ve-mnt-akso3b-fs svg text')].map((t) => t.textContent) }));
    Y.yerlesimOzet(tam.yer, k + ' · tam ekran').forEach((x) => out.push(x));
    if (!tam.ad.some((t) => /^T1 /.test(t))) out.push(k + ' · tam ekranda takoz adı yok');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.evaluate(() => veTogglePropertiesPanel(false));
  }
  await page.evaluate(AKSO3B_SIFIR);
  expect(out).toEqual([]);
});

// GÜÇ GRUBUNDAKİ YERİ — Görünümler'in bileşeni (kullanıcı 2026-10-16: "o 3B
// olmamış. Aynı 'Görünümler' bileşenindeki gibi olacak. Bileşene göre parçayı
// belirgin gösterecek"). Gövde, takoz ve nokta kütle: bileşen perdenin
// üstünde ve EKRANDA görünür (halkası öndeki bir küpün altında değil), yazılar
// okunur ve çakışmaz; gerçek sürükleme döndürür ve her açıda yerleşim temiz;
// fare üstünde bilgi kutusu açılır; tam ekran bileşenle açılır.
test('Güç grubundaki yeri: Görünümler\'in bileşeni, bileşen perdenin üstünde ve AYDINLIK; sürükleyince döner; yerleşim temiz; fare üstü bilgi', async ({ page }) => {
  await bootApp(page);
  await ornek(page, 'tulga', 'Ön Takoz Braketi');
  await page.evaluate(Y.KAYNAK);
  await page.evaluate(AKSO3B_SIFIR);
  const out = [];
  const secimler = [
    ['Motor', "n.type === 'mnt-motor'"],
    ['Ön Takoz', "n.customName === 'Ön Takoz'"],
    ['arka braket (nokta kütle)', "n.type === 'mnt-bracket' && n.data.pointMass && Number(n.data.cgx) > 1300 && Number(n.data.cgy) > 0"]];
  const olc = () => page.evaluate(() => {
    const kok = document.querySelector('#ve-properties .ve-mnt-yer'), svg = kok && kok.querySelector('svg.ve-mnt2d-akso');
    if (!svg) return null;
    // işaretin merkezinde en üstteki öğe işaretin kendisi ya da halkası
    const hale = svg.querySelector('.ve-ak-sec-hale');
    let ustte = null;
    if (hale) {
      const b = hale.getBoundingClientRect();
      const e = document.elementFromPoint(b.left + b.width / 2, b.top + 1);
      ustte = e && (e === hale || !!e.closest('[data-sec]'));
    }
    // AYDINLIK (kullanıcı 2026-10-18: "parça da aydınlık olmalı"): seçilinin
    // HESAPLANMIŞ her yüzü perdenin altındaki zeminden ve gölgedeki aynı tür
    // parçanın her yüzünden açık. Takoz yeşili ve nokta kütle kahvesi
    // zeminden koyuydu (T1: 0,065 < 0,408).
    const renk = (c) => { const s = String(c); let m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number); if (/^color\(srgb/.test(s)) m = m.map((v, i) => (i < 3 ? v * 255 : v)); return m; };
    const lum = (m) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const pr = svg.querySelector(':scope > rect.ve-ak-perde'), pc = pr ? renk(getComputedStyle(pr).fill) : [0, 0, 0, 0], pa = pc.length > 3 ? pc[3] : 1;
    const kar = (m) => m.slice(0, 3).map((v, i) => v * (1 - pa) + pc[i] * pa);
    let z = svg, zem = null;
    while (z && !zem) { const bg = getComputedStyle(z).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) zem = renk(bg); z = z.parentElement; }
    const secili = svg.querySelector('.ve-ak-odak [data-sec]');
    const tur = !secili ? null : secili.classList.contains('ve-ak-t') ? '.ve-ak-t' : secili.classList.contains('ve-ak-nokta') ? '.ve-ak-nokta' : '.ve-ak-g';
    const yuz = (e) => (e.matches('circle') ? [e] : [...e.querySelectorAll('path')]);
    const aydinlik = !secili ? null : {
      en: Math.min(...yuz(secili).map((e) => lum(renk(getComputedStyle(e).fill)))),
      esik: Math.max(lum(kar(zem)), ...[...svg.querySelectorAll(tur)].filter((e) => !e.closest('.ve-ak-odak')).flatMap(yuz).map((e) => lum(kar(renk(getComputedStyle(e).fill))))) };
    return { sec: svg.querySelectorAll('[data-sec]').length, hale: !!hale, ustte, aydinlik,
      perde: !!svg.querySelector(':scope > rect.ve-ak-perde'), odak: [...new Set([...svg.querySelectorAll('.ve-ak-odak [data-ak]')].map((e) => e.getAttribute('data-ak')))],
      cip: (svg.querySelector('.ve-ak-odak .ve-ak-cip.sec-cip') || {}).textContent || '',
      ad: kok.querySelector('[data-ak3b-ad]').textContent, dugme: kok.querySelectorAll('.ve-mnt2d-zoomctl button').length,
      yazi: Math.min(...[...svg.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width)),
      yer: window.__yerlesim('#ve-properties') };
  });
  const denetle = (r, ad) => {
    if (!r) { out.push(ad + ': aksonometri yok'); return; }
    if (!r.sec) out.push(ad + ': bileşen işaretli değil');
    if (r.hale && !r.ustte) out.push(ad + ': seçim halkası örtülü');
    if (!r.cip) out.push(ad + ': adı yazılı değil');
    if (!r.perde || r.odak.length !== 1) out.push(ad + ': perde ' + r.perde + ' · odak ' + r.odak.join(','));
    if (!r.aydinlik || !(r.aydinlik.en > r.aydinlik.esik)) out.push(ad + ': parça aydınlık değil — en koyu yüz L ' + (r.aydinlik ? r.aydinlik.en.toFixed(3) + ' ≤ gölgede ' + r.aydinlik.esik.toFixed(3) : '?'));
    if (r.dugme !== 4) out.push(ad + ': görünüm düğmesi ' + r.dugme);
    if (r.yazi < 9.5) out.push(ad + ': yazı ' + r.yazi.toFixed(1) + ' px');
    Y.yerlesimOzet(r.yer, 'tulga · ' + ad).forEach((x) => out.push(x));
  };
  for (const [ad, kosul] of secimler) {
    await page.evaluate((f) => { const n = nodes.find(new Function('n', 'return ' + f)); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); }, kosul);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const k = document.querySelector('#ve-properties .ve-mnt-yer'); if (k) k.scrollIntoView({ block: 'center' }); });
    await page.mouse.move(4, 4);
    await page.waitForTimeout(200);
    const r = await olc();
    denetle(r, ad);
    if (r && r.ad !== 'Dimetrik') out.push(ad + ': başlık "' + r.ad + '"');
  }
  // GERÇEK SÜRÜKLEME (kroki): sağa 80 px → azimut 40° azalır, bakış serbest;
  // sürüklerken yazılar yerinde; her açıda bileşen üstte ve yerleşim temiz
  const az0 = await page.evaluate(() => VE_MNT_AKSO3B.az);
  const kutu = await (await page.$('#ve-properties .ve-mnt-yer svg.ve-mnt2d-akso')).boundingBox();
  const yaziSay = () => page.evaluate(() => document.querySelectorAll('#ve-properties .ve-mnt-yer svg.ve-mnt2d-akso text').length);
  const dinlenme = await yaziSay();
  await page.mouse.move(kutu.x + kutu.width / 2, kutu.y + kutu.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(kutu.x + kutu.width / 2 + i * 10, kutu.y + kutu.height / 2); await page.waitForTimeout(20); }
  await page.waitForTimeout(120);
  const surukle = await yaziSay();
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => VE_MNT_AKSO3B.az)).toBeCloseTo((az0 - 40 + 360) % 360, 6);
  expect(surukle).toBe(dinlenme);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(200);
  const r2 = await olc();
  denetle(r2, 'arka braket · döndürüldü');
  if (r2 && r2.ad !== 'Serbest bakış') out.push('döndürülünce başlık "' + r2.ad + '"');
  // FARE ÜSTÜ: takozun bilgisi kutuda (bölüm yerinde tazelense de bağlanır).
  // Ön takoz: arka braket perdenin üstünde, T3'ün önünde.
  const t = await (await page.$('#ve-properties .ve-mnt-yer svg.ve-mnt2d-akso .ve-ak-t[data-ak="T1"]')).boundingBox();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.waitForTimeout(150);
  await page.mouse.move(t.x + t.width / 2 + 1, t.y + t.height / 2);
  await page.waitForTimeout(150);
  const ip = await page.evaluate(() => { const e = document.getElementById('ve-mnt-2d-tip'); return e && e.style.display !== 'none' ? e.textContent : ''; });
  if (!/^T\d+ · .*\nKonum \(/.test(ip)) out.push('fare üstü bilgi yok: "' + ip + '"');
  // TAM EKRAN bileşenle açılır: orada da perdenin üstünde
  await page.click('#ve-properties .ve-mnt-yer .ve-mnt2d-zoomctl button[aria-label="Tam ekran"]');
  await page.waitForTimeout(900);
  const tam = await page.evaluate(() => [...new Set([...document.querySelectorAll('#ve-mnt-akso3b-fs .ve-ak-odak [data-ak]')].map((e) => e.getAttribute('data-ak')))]);
  if (tam.length !== 1) out.push('tam ekranda odak ' + tam.join(','));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.evaluate(AKSO3B_SIFIR);
  expect(out).toEqual([]);
});

// GÖRÜNÜMLER — SÜRÜKLERKEN YAZILAR, FÖYÜN SATIRI (kullanıcı 2026-10-16:
// "aksonometrik görüntüyü oynatırken görüntünün üzerindeki yazılar
// kayboluyor … Beraber dönsünler" · "tabloda fare ile üstünde gezdirirken …
// o parçaya geldiğimde aydınlık olsun, diğer parçalar gölgeye düşsün").
test('Görünümler: sürüklerken yazılar yerinde ve bilgi kutusu kapalı; föyün satırı parçayı perdenin üstüne alır', async ({ page }) => {
  await bootApp(page);
  await ornek(page, 'tulga', 'Ön Takoz Braketi');
  await page.evaluate(AKSO3B_SIFIR);
  await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-2dview'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForTimeout(900);
  const sel = '#ve-properties .ve-mnt-akso-kap svg.ve-mnt2d-akso';
  const durum = () => page.evaluate((q) => { const sv = document.querySelector(q), ip = document.getElementById('ve-mnt-2d-tip');
    return { yazi: sv.querySelectorAll('text').length, cip: sv.querySelectorAll('.ve-ak-cip').length, ip: !!ip && ip.style.display !== 'none' }; }, sel);
  const dinlenme = await durum();
  expect(dinlenme.yazi).toBeGreaterThanOrEqual(15);
  // imleç bir gövdenin üstünde (bilgi kutusu açık), sonra sürükle
  const g = await (await page.$(sel + ' .ve-ak-g[data-ak="g2"]')).boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.waitForTimeout(100);
  await page.mouse.move(g.x + g.width / 2 + 1, g.y + g.height / 2);
  await page.waitForTimeout(100);
  expect((await durum()).ip).toBe(true);
  await page.mouse.down();
  const ara = [];
  for (let i = 1; i <= 12; i++) { await page.mouse.move(g.x + g.width / 2 + i * 8, g.y + g.height / 2 + i * 2); await page.waitForTimeout(25); if (i % 4 === 0) ara.push(await durum()); }
  await page.mouse.up();
  await page.waitForTimeout(300);
  ara.forEach((d) => { expect(d.yazi).toBe(dinlenme.yazi); expect(d.cip).toBe(dinlenme.cip); expect(d.ip).toBe(false); });
  expect((await durum()).yazi).toBe(dinlenme.yazi);
  // FÖYÜN SATIRI — gerçek fare
  await page.evaluate(() => document.querySelector('#ve-properties .ve-mnt-foy-odak').scrollIntoView({ block: 'end' }));
  await page.mouse.move(4, 4);
  await page.waitForTimeout(200);
  const once = await page.evaluate((q) => document.querySelector(q).outerHTML, sel);
  for (const k of ['T3', 'g1', 'G']) {
    await page.hover('#ve-properties .ve-mnt-foy-odak tr[data-ak="' + k + '"] td:nth-child(2)');
    await page.waitForTimeout(150);
    const r = await page.evaluate((q) => { const sv = document.querySelector(q);
      return { perde: !!sv.querySelector(':scope > rect.ve-ak-perde'), odak: [...new Set([...sv.querySelectorAll('.ve-ak-odak [data-ak]')].map((e) => e.getAttribute('data-ak')))],
        zemin: getComputedStyle(document.querySelector('#ve-properties .ve-mnt-foy-odak tr[data-ak]:hover td')).backgroundColor }; }, sel);
    expect([k, r.perde, r.odak]).toEqual([k, true, [k]]);
    expect(r.zemin).not.toBe('rgba(0, 0, 0, 0)');
  }
  await page.mouse.move(4, 4);
  await page.waitForTimeout(200);
  expect(await page.evaluate((q) => document.querySelector(q).outerHTML, sel)).toBe(once);
  await page.evaluate(AKSO3B_SIFIR);
});

// TAM EKRAN KABI DOLDURUR (kullanıcı 2026-10-16: "büyük ekran yaptığımda,
// görselleştiricinin altında, pencere üzerinde, çok geniş bir boşluk var").
// Ölçülen önce: göstergenin altında 85 (1366 × 768) · 141 (1600 × 1000) ·
// 160 (1920 × 1080) · 495 px (2560 × 1440). Pencere boyu değişince yeniden ölçülür.
test('Görünümler tam ekran: çizim kabın yüksekliğini doldurur; pencere boyu değişince yeniden ölçülür', async ({ page }) => {
  await bootApp(page);
  await ornek(page, 'tulga', 'Ön Takoz Braketi');
  const ac = async () => {
    await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-2dview'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
    await page.waitForTimeout(800);
  };
  const bosluk = () => page.evaluate(() => {
    const kap = document.getElementById('ve-mnt-akso3b-fs-kap'), lej = kap.querySelector('.ve-mnt-ak-lej');
    return { alt: Math.round(kap.getBoundingClientRect().bottom - lej.getBoundingClientRect().bottom), tasma: kap.scrollHeight - kap.clientHeight };
  });
  const out = [];
  for (const [w, h] of [[1366, 768], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    await ac();                                                    // pencere boyu değişince sütun kapanabiliyor
    await page.click('#ve-properties .ve-mnt-akso3b .ve-mnt2d-zoomctl button[aria-label="Tam ekran"]');
    await page.waitForTimeout(900);
    const b = await bosluk();
    if (b.alt > 16 || b.tasma > 0) out.push(`${w}×${h}: alt ${b.alt} px, taşma ${b.tasma}`);
    if (w === 1920) {
      await page.setViewportSize({ width: 2560, height: 1440 });   // açıkken büyüt
      await page.waitForTimeout(700);
      const b2 = await bosluk();
      if (b2.alt > 16 || b2.tasma > 0) out.push(`açıkken 2560×1440: alt ${b2.alt} px, taşma ${b2.tasma}`);
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(700);
      const b3 = await bosluk();
      if (b3.alt > 16 || b3.tasma > 0) out.push(`açıkken geri ${w}×${h}: alt ${b3.alt} px, taşma ${b3.tasma}`);
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  }
  expect(out).toEqual([]);
});

// 3D GÖRÜNTÜLEYİCİ YER TUTUCU (kullanıcı kararları 2026-10-16): "Klasik 3B"
// gerçek CAD dosyasına ayrıldı, çizim Görünümler'e taşındı. Tek kategori,
// tipin notu; tuval, düğme ve çizim yok, pencere açılınca three.js sahnesi kurulmaz.
test('3D Görüntüleyici: CAD\'in evi — dosyasızken STEP bölümü ve dosya seçici; sahne ve çizim yok; yerleşim temiz', async ({ page }) => {
  await bootApp(page);
  await ornek(page, 'tulga', 'Ön Takoz Braketi');
  await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-viewer'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForTimeout(800);
  await page.evaluate(Y.KAYNAK);
  const r = await page.evaluate(() => ({
    kat: [...document.querySelectorAll('#ve-properties .ve-fp-govde > .ve-fp-kat')].map((x) => x.getAttribute('aria-label')),
    tuval: document.querySelectorAll('#ve-properties canvas').length, cizim: document.querySelectorAll('#ve-properties svg.ve-mnt2d-akso').length,
    eylem: [...document.querySelectorAll('#ve-properties .ve-fp-solve')].map((e) => e.textContent.trim()),
    dosya: document.querySelectorAll('#ve-properties input[type="file"]').length, sahne: !!window._veMountViewer,
    yer: window.__yerlesim('#ve-properties') }));
  expect([r.kat, r.tuval, r.cizim, r.eylem, r.dosya, r.sahne]).toEqual([['STEP dosyası'], 0, 0, ['STEP dosyası seç…'], 0, false]);
  expect(Y.yerlesimOzet(r.yer, 'tulga · 3D Görüntüleyici')).toEqual([]);
});
