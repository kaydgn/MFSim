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
 *   · 3B tam ekranda model görüntünün küçük bir köşesinde: kamera sabit
 *     uzaklıktaydı; geometrinin izdüşümü Tulga'da görüntünün 0,27'si (yeni
 *     0,79). Sığdırma grubun eksen hizalı kutusuna yapılsaydı çapraz dizilişte
 *     kutunun köşeleri boşlukta kalır, model yine küçük kalırdı
 *   · kamera hafızası modele bağlı değildi: yeni sığdırmayla Tulga'nın kamerası
 *     Siper'e taşınınca kamera modelin İÇİNE düşüyordu (izdüşüm 40,84 kat)
 *   · 3B ipucunda üçlüler "582,5 · 21,5 · 422,8" (16 ipucu; kural "; ")
 * Node'da koşamaz: CSS seçicisi, yerleşim ve WebGL kamerası tarayıcıda.
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
    typeof window.veMnt2DTamEkran === 'function' && Array.isArray(window.nodes), null, { timeout: 90000 });
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

test('2D tam ekran: köşe göstergesi işaretin altında değil, koordinat ayracı "; "', async ({ page }) => {
  await bootApp(page);
  const out = [];
  for (const [k, imza] of ORNEK) {
    await ornek(page, k, imza);
    await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-2dview'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
    await page.waitForTimeout(600);
    await page.evaluate(() => veMnt2DTamEkran());
    await page.waitForTimeout(1200);
    await page.evaluate(Y.KAYNAK);
    const r = await page.evaluate(() => ({ yer: window.__yerlesim('#ve-mnt-fs'), metin: document.getElementById('ve-mnt-fs').textContent }));
    Y.yerlesimOzet(r.yer, k).forEach((x) => out.push(x));
    if (/\d · [−-]?\d/.test(r.metin)) out.push(k + ': koordinat "·" ayraçlı');
    if (!/\(\s*[−-]?[\d.]+(,\d+)?; [−-]?[\d.]+(,\d+)?; [−-]?[\d.]+(,\d+)?\) mm/.test(r.metin)) out.push(k + ': "(x; y; z) mm" üçlüsü yok');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.evaluate(() => veTogglePropertiesPanel(false));
  }
  expect(out).toEqual([]);
});

// Görünen içeriğin izdüşümü: geometrinin GERÇEK köşeleri (grubun eksen hizalı
// kutusu değil — çapraz dizilişte o kutunun köşeleri boşlukta kalıyor)
const IZDUSUM = () => {
  const V = _veMountViewer, c = V.canvas, W = c.clientWidth, H = c.clientHeight;
  V.camera.updateMatrixWorld(); V.group.updateMatrixWorld(true);
  const xs = [], ys = [], v = new THREE.Vector3();
  V.group.traverse((o) => {
    const a = o.visible && o.geometry && o.geometry.attributes && o.geometry.attributes.position;
    if (!a) return;
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).project(V.camera);
      xs.push((v.x + 1) / 2 * W); ys.push((1 - v.y) / 2 * H);
    }
  });
  const w = (Math.max(...xs) - Math.min(...xs)) / W, h = (Math.max(...ys) - Math.min(...ys)) / H;
  const bilgi = [];
  V.group.traverse((o) => { if (o.userData && o.userData.info) bilgi.push(o.userData.info.replace(/<[^>]+>/g, '')); });
  return { W, H, dolu: Math.round(Math.max(w, h) * 100) / 100,
    icinde: Math.min(...xs) >= 0 && Math.max(...xs) <= W && Math.min(...ys) >= 0 && Math.max(...ys) <= H, bilgi };
};
async function tamEkran3B(page) {
  await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-viewer'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForTimeout(900);
  await page.evaluate(() => veMntViewerFullscreen());
  await page.waitForFunction(() => window._veMountViewer && _veMountViewer.group && _veMountViewer.group.children.length > 0
    && _veMountViewer.canvas.id === 've-mnt-fs-canvas', null, { timeout: 20000 });
  await page.waitForTimeout(800);
  return page.evaluate(IZDUSUM);
}

test('3B tam ekran: model görüntüyü doldurur, içinde kalır; başka örnekte eski kamera taşınmaz', async ({ page }) => {
  await bootApp(page);
  await ornek(page, 'tulga', 'Ön Takoz Braketi');
  const a = await tamEkran3B(page);
  expect(a.W).toBeGreaterThan(1000);
  // Tulga eski hâl: 540×341 px / 1.598×823 → 0,41
  expect(a.dolu).toBeGreaterThan(0.7);
  expect(a.icinde).toBe(true);
  // Koordinat üçlüsü ipucunda da "(x; y; z)" — kural 7·C
  expect(a.bilgi.length).toBeGreaterThan(5);
  expect(a.bilgi.filter((t) => /\d · [−-]?\d/.test(t))).toEqual([]);
  // Her ipucu (takoz · gövde · birleşik CG) bir konum taşır ve o "(x; y; z)" yazılır
  expect(a.bilgi.filter((t) => !/\([−\d.,]+; [−\d.,]+; [−\d.,]+\) mm/.test(t))).toEqual([]);
  // Kapanınca kamera hafızaya yazılır; Siper yüklenince o kamera Siper'e uygulanmaz
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.evaluate(() => veTogglePropertiesPanel(false));
  await ornek(page, 'siper', 'cradle');
  const b = await tamEkran3B(page);
  // Siper'de kamera içeriğin sınır küresinin dışında kalmak için durur (0,70)
  expect(b.icinde).toBe(true);
  expect(b.dolu).toBeGreaterThan(0.6);
});

// ── 2D GÖRÜNÜM · AKSONOMETRİK SEKME (2026-10-15, kullanıcı seçimi) ─────────
// Node'daki kapı (mount-akso.test.js) çizicinin KUTU TAHMİNİYLE ölçüyor;
// burada yazının gerçek kutusu, hâlesi ve çizgilerin gerçek sırası: üç örnek,
// her katman, iki izdüşüm, alttan ve arkadan bakış, tam ekranda üç duvar.
// Canlandırma kare üretiyor; çizim kabın genişliğinde 1:1 (yazı ölçek tabanında).
const AKSO_SIFIR = () => Object.assign(VE_MNT_AKSO, { iz: 'dim', bx: -1, by: -1, bz: 1, direk: false, kuvvet: false,
  cokme: false, mod: false, rijit: false, duvar: false, modI: 0, oynat: true });
test('2D Görünüm · Aksonometrik: ilk sekme, katmanlar ve tam ekran — yerleşim temiz, mod canlanıyor', async ({ page }) => {
  await bootApp(page);
  const out = [];
  for (const [k, imza] of ORNEK) {
    await ornek(page, k, imza);
    await page.evaluate(async () => { const s = nodes.find((n) => n.type === 'mnt-solver'); await veMntSolverCompute(s.id); });
    await page.evaluate(AKSO_SIFIR);
    await page.evaluate(() => { const n = nodes.find((x) => x.type === 'mnt-2dview'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
    await page.waitForTimeout(700);
    await page.evaluate(Y.KAYNAK);
    const ilk = await page.evaluate(() => {
      const t = document.querySelector('#ve-properties .ve-fp-tab[aria-selected="true"]');
      const svg = document.querySelector('#ve-properties svg.ve-mnt2d-akso');
      return { sekme: t && t.getAttribute('data-k'), vb: svg && svg.viewBox.baseVal.width, en: svg && svg.getBoundingClientRect().width,
        kap: document.querySelector('.ve-mnt-akso-kap') && document.querySelector('.ve-mnt-akso-kap').id };
    });
    expect(ilk.sekme).toBe('akso');
    expect(Math.abs(ilk.vb - ilk.en)).toBeLessThan(1.5);          // 1:1 — yazı küçülmez
    const ayar = (a, b) => page.evaluate(([id, kk, vv]) => veMntAksoAyar(id, kk, vv), [ilk.kap, a, b]);
    const olc = async (ad) => {
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => window.__yerlesim('#ve-properties'));
      Y.yerlesimOzet(r, k + ' · ' + ad).forEach((x) => out.push(x));
    };
    await olc('temel');
    await ayar('kat', 'kuvvet'); await ayar('kat', 'cokme'); await olc('kuvvet + statik sehim');
    await ayar('kat', 'cokme'); await ayar('kat', 'kuvvet');
    await ayar('kat', 'rijit'); await olc('rijitlik'); await ayar('kat', 'rijit');
    await ayar('kat', 'direk'); await olc('direk'); await ayar('kat', 'direk');
    await ayar('iz', 'iso'); await ayar('bz', -1); await olc('izometrik alttan');
    await ayar('iz', 'dim'); await ayar('bz', 1); await ayar('bx', 1); await ayar('by', 1); await olc('arkadan-sağdan');
    await ayar('bx', -1); await ayar('by', -1);
    // MOD: hareket eden katman her karede yeniden yazılır
    await ayar('kat', 'mod'); await olc('mod');
    const kare = () => page.evaluate(() => document.querySelector('#ve-properties svg.ve-mnt2d-akso .ve-ak-hareket').innerHTML);
    const a1 = await kare(); await page.waitForTimeout(350); const a2 = await kare();
    if (a1 === a2) out.push(k + ' · mod canlanmıyor');
    await ayar('kat', 'mod');
    // TAM EKRAN: üç duvar
    await page.evaluate(() => veMnt2DTamEkran()); await page.waitForTimeout(1000);
    await page.evaluate(() => veMntAksoAyar('ve-mnt-akso-fs', 'kat', 'duvar')); await page.waitForTimeout(400);
    const tam = await page.evaluate(() => ({ yer: window.__yerlesim('#ve-mnt-fs'),
      duvar: document.querySelectorAll('#ve-mnt-akso-fs .ve-ak-d-gol').length,
      ad: [...document.querySelectorAll('#ve-mnt-akso-fs svg text')].map((t) => t.textContent) }));
    Y.yerlesimOzet(tam.yer, k + ' · tam ekran üç duvar').forEach((x) => out.push(x));
    if (!tam.duvar) out.push(k + ' · tam ekranda duvar gölgesi yok');
    if (!tam.ad.some((t) => /^T1 /.test(t))) out.push(k + ' · tam ekranda takoz adı yok');
    await page.evaluate(() => veMntAksoAyar('ve-mnt-akso-fs', 'kat', 'duvar'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.evaluate(() => veTogglePropertiesPanel(false));
  }
  expect(out).toEqual([]);
});

test('2D Görünüm · Aksonometrik: hareket azaltma açıkken mod durağan çizilir ve sebebi yazılır', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await bootApp(page);
  await ornek(page, 'tulga', 'Ön Takoz Braketi');
  await page.evaluate(async () => { const s = nodes.find((n) => n.type === 'mnt-solver'); await veMntSolverCompute(s.id); });
  await page.evaluate(AKSO_SIFIR);
  await page.evaluate(() => { VE_MNT_AKSO.mod = true; const n = nodes.find((x) => x.type === 'mnt-2dview'); clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); });
  await page.waitForTimeout(800);
  const kare = () => page.evaluate(() => document.querySelector('#ve-properties svg.ve-mnt2d-akso .ve-ak-hareket').innerHTML);
  const a1 = await kare(); await page.waitForTimeout(400); const a2 = await kare();
  expect(a2).toBe(a1);
  expect(await page.evaluate(() => document.querySelector('#ve-properties .ve-mnt-ak-alt').textContent)).toContain('Hareket azaltma açık');
  await page.evaluate(AKSO_SIFIR);
});
