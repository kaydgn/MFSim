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
 *     G 13 → 19,6 px). 3D Görüntüleyici yer tutucu.
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
    await page.evaluate(() => veMntAkso3BTamEkran());
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
// yerinde tutar, sağ tık kaydırır, oklar döndürür; her açıda, her katmanda ve
// tam ekranda üç duvarla yerleşim temiz; işaretler ekranda büyük.
const AKSO3B_SIFIR = () => Object.assign(VE_MNT_AKSO3B, { az: null, el: null, direk: false, kuvvet: false, cokme: false,
  mod: false, rijit: false, duvar: false, modI: 0, oynat: true });
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
      const t = document.querySelector('#ve-properties .ve-fp-tab[aria-selected="true"]');
      const kap = document.querySelector('#ve-properties .ve-mnt-akso-kap'), svg = kap && kap.querySelector('svg.ve-mnt2d-akso');
      // İŞARETİN EKRANDAKİ BOYU (CSS px): takoz küpü ve G'nin kutusunun uzun kenarı
      const k = svg ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 0;
      const boy = (sel) => [...svg.querySelectorAll(sel)].map((e) => { const r = e.getBBox(); return Math.max(r.width, r.height) * k; });
      return { sekme: t && t.getAttribute('data-k'), sekmeler: [...document.querySelectorAll('#ve-properties .ve-fp-tab')].map((x) => x.getAttribute('data-k')),
        id: kap && kap.id, vb: svg && svg.viewBox.baseVal.width, en: svg && svg.getBoundingClientRect().width,
        sahne: !!window._veMountViewer, takoz: Math.min(...boy('.ve-ak-t')), G: Math.max(...boy('.ve-ak-gam')) };
    });
    expect(ilk.sekme).toBe('akso');
    expect(ilk.sekmeler).toEqual(['akso', 'isaret']);              // düz görünüş sekmesi yok
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
    await ayar('kat', 'kuvvet'); await ayar('kat', 'cokme'); await olc('az 200 · kuvvet + statik sehim');
    await ayar('kat', 'cokme'); await ayar('kat', 'kuvvet');
    await ayar('kat', 'rijit'); await olc('az 200 · rijitlik'); await ayar('kat', 'rijit');
    await ayar('kat', 'direk'); await olc('az 200 · direk'); await ayar('kat', 'direk');
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
      // MOD canlanıyor
      await ayar('kat', 'mod');
      const kare = () => page.evaluate((i) => document.querySelector('#' + i + ' svg.ve-mnt2d-akso .ve-ak-hareket').innerHTML, id);
      const a1 = await kare(); await page.waitForTimeout(350); const a2 = await kare();
      if (a1 === a2) out.push(k + ' · mod canlanmıyor');
      await ayar('kat', 'mod');
      // İŞARETLER sekmesi: föy, yerleşim temiz
      const nid = await page.evaluate(() => nodes.find((x) => x.type === 'mnt-2dview').id);
      await page.click('#ve-fp-tabs-' + nid + ' .ve-fp-tab[data-k="isaret"]');
      await page.waitForTimeout(300);
      expect(await page.evaluate((n) => document.querySelectorAll('#ve-fp-panes-' + n + ' > [data-k="isaret"] tbody tr').length, nid)).toBe(14);
      await olc('İşaretler');
      await page.click('#ve-fp-tabs-' + nid + ' .ve-fp-tab[data-k="akso"]');
    }
    // TAM EKRAN: üç duvar, serbest açı
    await page.evaluate(() => { VE_MNT_AKSO3B.az = 200; VE_MNT_AKSO3B.el = 30; veMntAkso3BTamEkran(); });
    await page.waitForTimeout(900);
    await page.evaluate(() => veMntAksoAyar('ve-mnt-akso3b-fs', 'kat', 'duvar')); await page.waitForTimeout(400);
    const tam = await page.evaluate(() => ({ yer: window.__yerlesim('#ve-mnt-fs'), duvar: document.querySelectorAll('#ve-mnt-akso3b-fs .ve-ak-d-gol').length,
      ad: [...document.querySelectorAll('#ve-mnt-akso3b-fs svg text')].map((t) => t.textContent) }));
    Y.yerlesimOzet(tam.yer, k + ' · tam ekran üç duvar').forEach((x) => out.push(x));
    if (!tam.duvar) out.push(k + ' · tam ekranda duvar gölgesi yok');
    if (!tam.ad.some((t) => /^T1 /.test(t))) out.push(k + ' · tam ekranda takoz adı yok');
    await page.evaluate(() => veMntAksoAyar('ve-mnt-akso3b-fs', 'kat', 'duvar'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.evaluate(() => veTogglePropertiesPanel(false));
  }
  await page.evaluate(AKSO3B_SIFIR);
  expect(out).toEqual([]);
});

test('Görünümler · Aksonometrik: hareket azaltma açıkken mod durağan çizilir ve sebebi yazılır', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await bootApp(page);
  await ornek(page, 'tulga', 'Ön Takoz Braketi');
  await page.evaluate(async () => { const s = nodes.find((n) => n.type === 'mnt-solver'); await veMntSolverCompute(s.id); });
  await page.evaluate(AKSO3B_SIFIR);
  await page.evaluate(() => { VE_MNT_AKSO3B.mod = true; const n = nodes.find((x) => x.type === 'mnt-2dview'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForTimeout(800);
  const kare = () => page.evaluate(() => document.querySelector('#ve-properties svg.ve-mnt2d-akso .ve-ak-hareket').innerHTML);
  const a1 = await kare(); await page.waitForTimeout(400); const a2 = await kare();
  expect(a2).toBe(a1);
  expect(await page.evaluate(() => document.querySelector('#ve-properties .ve-mnt-ak-alt').textContent)).toContain('Hareket azaltma açık');
  await page.evaluate(AKSO3B_SIFIR);
});

// 3D GÖRÜNTÜLEYİCİ YER TUTUCU (kullanıcı kararları 2026-10-16): "Klasik 3B"
// gerçek CAD dosyasına ayrıldı, çizim Görünümler'e taşındı. Tek sekme, tipin
// notu; tuval, düğme ve çizim yok, pencere açılınca three.js sahnesi kurulmaz.
test('3D Görüntüleyici: yer tutucu — tek sekme, not, sahne ve çizim yok; yerleşim temiz', async ({ page }) => {
  await bootApp(page);
  await ornek(page, 'tulga', 'Ön Takoz Braketi');
  await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-viewer'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForTimeout(800);
  await page.evaluate(Y.KAYNAK);
  const r = await page.evaluate(() => {
    const p = document.querySelector('#ve-properties [role="tabpanel"]');
    return { sekme: [...document.querySelectorAll('#ve-properties .ve-fp-tab .ve-fp-tab-ad')].map((x) => x.textContent),
      tuval: document.querySelectorAll('#ve-properties canvas').length, cizim: document.querySelectorAll('#ve-properties svg.ve-mnt2d-akso').length,
      dugme: p.querySelectorAll('button').length, not: p.textContent.trim() === componentDefs['mnt-viewer'].yerTutucu, sahne: !!window._veMountViewer,
      yer: window.__yerlesim('#ve-properties') };
  });
  expect([r.sekme, r.tuval, r.cizim, r.dugme, r.not, r.sahne]).toEqual([['Klasik 3B'], 0, 0, 0, true, false]);
  expect(Y.yerlesimOzet(r.yer, 'tulga · 3D Görüntüleyici')).toEqual([]);
});
