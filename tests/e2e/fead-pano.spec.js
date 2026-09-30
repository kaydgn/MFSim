/**
 * fead-pano.spec.js — FEAD A3 SONUÇ PANOSU (gerçek tarayıcı)
 * ─────────────────────────────────────────────────────────────────────
 * Birim kapısı (tests/unit/cp-fead-pano.test.js) sayıları ve ölçü
 * BÜTÇESİNİ ölçer; bütçenin gerçekten tuttuğunu yalnız tarayıcı söyler —
 * jsdom yerleşim yapmaz, yazı ölçmez, sayfa basmaz. Burada ölçülen:
 *
 *   · sayfa 1.587 × 1.122 px ve dört sütunun içeriği kendi kutusunda
 *     (sütun taşması sessizdir: `overflow:hidden` sayfa onu keser)
 *   · hiçbir sütun 45 px'ten fazla BOŞ kalmıyor (kullanıcı bildirimi,
 *     2026-09-30: "raporda boş kalan yerler olmuş")
 *   · hiçbir hücre / başlık / gösterge yazısı kesilmiyor, gösterge kutusu
 *     taşmıyor
 *   · gövde yazısı 8 pt, birim satırı · alt başlık · damga 7 pt tabanında —
 *     SVG yazısı ekrandaki ölçeğiyle; tek istisna alt indis
 *   · iki çizimde (kayış yolu · hubload) iki yazı üst üste binmiyor (taban
 *     yazıyı büyütüyor; yerleştirici kendi boyuyla yerleştirmişti)
 *   · PDF baskısı TEK sayfa ve yatay A3 (297 mm = 1.122,5 px: 1.123 px'lik
 *     sayfa ikinci, boş bir sayfa açardı)
 *   · kullanıcının yolu: FEAD araçları → A3 → Hesapla → İndir; ölçülen
 *     şey İNEN dosya
 *   · örneklerin hepsinde, artı satır sayısı zorlanmış bir çözümde
 *
 * Node'da koşamaz: belge gerçek bir çözümden üretiliyor ve ölçüler yazı
 * tipinin gerçek genişliğine bağlı.
 */
const { test, expect } = require('@playwright/test');
const { motorluOrnekler } = require('./helpers/fead-motor');
const path = require('path');
const fs = require('fs');

const BUILD = process.env.MFSIM_OLCUM_HTML || path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(300000);

const ac = async (page) => {
  await page.setViewportSize({ width: 1920, height: 1032 });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.click('.ve-module-card[data-module="fead-analysis"]');
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await motorluOrnekler(page);
};

// Örneği sayfanın İÇİNDE köprüden çözer ve panoyu üretir — uygulamanın
// modeline dokunmadan (örnek yükleyicisi mevcut modelin ÜSTÜNE ekliyor;
// ölçüldü: ikinci örnekte "Birden fazla Gergi var"). Kullanıcının yolu ayrı
// testte, gerçek indirmeyle. `zorla`: çevrim satırlarını çoğaltır (orta
// sütunun satır boyu daralsın — sayfa bütçesinin en sıkı hâli).
const pano = async (page, anahtar, zorla) => page.evaluate(([k, z]) => {
  const pack = veFeadExampleNodes(k);
  const ns = pack.nodes.map((n) => ({ id: n.id, type: n.type, def: componentDefs[n.type],
    customName: n.customName, data: JSON.parse(JSON.stringify(n.data)) }));
  // Belgenin TAMAMI ölçülür: kayışa bağlı çıktılar (ömür · frekans) açık.
  ns.filter((n) => n.type === 'fead-belt').forEach((n) => { n.data.beltDataMode = 'full'; });
  const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
  const build = veFeadBuildSystem(ns);
  const sd = solv.data;
  let R = veFeadAnalyze(build, { rows: veFeadDutyRows(solv), cylinders: Number(sd.cylinders),
    crankInertia: Number(sd.crankInertia) || 0, fatigueModel: sd.fatigueModel || 'PK-2_2p-MT3',
    accelRpmS: Number(sd.accelRpmS) || NaN, decelRpmS: Number(sd.decelRpmS) || NaN });
  if (!R.ok) throw new Error(k + ': ' + R.error);
  R.build = build; R.pulleyNames = build.names; R.solvedAt = Date.now();
  R.checkOpt = veFeadCheckOpt(sd, veFeadDutyRows(solv));
  R.checks = veFeadChecks(build, R.checkOpt);
  // Sonuçlar panosunun veri kümeleri çözüm anında yazılır (veFeadSolve) —
  // pano mil torkunu ve motor çevrimini onlardan OKUR.
  R.signals = veFeadSignals.build(R);
  if (z) {
    const d = R.analysis.duty, ek = [];
    for (let i = 0; ek.length + d.length < z; i++) ek.push(Object.assign({}, d[i % d.length], { engineRpm: d[i % d.length].engineRpm + 1 }));
    R = Object.assign({}, R, { analysis: Object.assign({}, R.analysis, { duty: d.concat(ek) }) });
  }
  return veFeadPanoHTML(R, null);
}, [anahtar, zorla || 0]);

// Belgeyi TEK BAŞINA açar (uygulamanın CSS'i yok) ve ölçer.
const olc = async (browser, html) => {
  const p = await browser.newPage({ viewport: { width: 1700, height: 1300 } });
  await p.route('**/*', (r) => (r.request().url().startsWith('data:') ? r.continue() : r.abort()));
  await p.setContent(html, { waitUntil: 'load' });
  const r = await p.evaluate(async () => {
    await document.fonts.ready;
    const TABAN = 32 / 3 - 0.01, IKINCIL = 28 / 3 - 0.01;     // 8 pt · 7 pt
    const pn = document.querySelector('.pn');
    const pr = pn.getBoundingClientRect();
    const out = { sayfa: [pr.width, pr.height], tasan: [], kesik: [], kucuk: [], binen: [], bos: [], yazi: 0 };
    const icAlt = pr.bottom - 40 + 0.5;
    document.querySelectorAll('.pn .sut').forEach((s, i) => {
      const sr = s.getBoundingClientRect();
      let alt = sr.top;
      [...s.querySelectorAll('*')].forEach((c) => {
        if (c.closest('svg')) return;
        const cr = c.getBoundingClientRect();
        if (cr.height) alt = Math.max(alt, cr.bottom);
        if (cr.height && (cr.bottom > sr.bottom + 0.5 || cr.bottom > icAlt))
          out.tasan.push('sütun ' + i + ' ' + c.tagName + ' "' + (c.textContent || '').slice(0, 24) + '" ' + Math.round(cr.bottom) + ' > ' + Math.round(Math.min(sr.bottom, icAlt)));
      });
      out.bos.push(Math.min(sr.bottom, icAlt) - alt);
    });
    document.querySelectorAll('.pn td, .pn th, .pn h2, .pn h2 small, .pn .kpi .k, .pn .kpi b, .pn .kpi .s, .pn .not, .pn .notlar li, .pn .ust b, .pn .ust span').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
        out.kesik.push(el.tagName + ' "' + el.textContent.slice(0, 30) + '" ' + el.scrollWidth + '/' + el.clientWidth + ' ' + el.scrollHeight + '/' + el.clientHeight);
    });
    // Gösterge kutusu: satırları büzülmez (flex:none), taşan satır kutunun
    // altından çıkar — kutu `overflow:hidden` onu sessizce keserdi.
    document.querySelectorAll('.pn .kpi').forEach((k) => {
      const kr = k.getBoundingClientRect();
      [...k.children].forEach((c) => {
        const cr = c.getBoundingClientRect();
        if (cr.bottom > kr.bottom - 1 + 0.5) out.kesik.push('gösterge "' + k.textContent.slice(0, 30) + '" ' + cr.bottom.toFixed(1) + ' > ' + (kr.bottom - 1).toFixed(1));
      });
    });
    // HÜCRE PAYI — yazının GERÇEK genişliği içerik kutusundan en az 1 px dar.
    // scrollWidth tam sayıya yuvarlanıyor ve 1 px payla 0,84 px'lik taşmayı
    // görmüyordu; hücrenin üç nokta kuralı o taşmayı "156,…" diye BASIYORDU
    // (ölçüldü: 11 örnekte 36 hücre — β'da 25, "Ömür" başlığında 11).
    // Başlığın birim satırı (<i>, blok) ayrı satırdır, ayrı ölçülür.
    document.querySelectorAll('.pn td, .pn th').forEach((el) => {
      const cs = getComputedStyle(el);
      const ic = el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      const birim = el.querySelector(':scope > i');
      const rg = document.createRange();
      let en = 0;
      if (birim && el.firstChild !== birim) {
        rg.setStartBefore(el.firstChild); rg.setEndBefore(birim);
        const r2 = document.createRange(); r2.selectNodeContents(birim);
        en = Math.max(rg.getBoundingClientRect().width, r2.getBoundingClientRect().width);
      } else { rg.selectNodeContents(el); en = rg.getBoundingClientRect().width; }
      if (en > ic - 1)
        out.kesik.push(el.tagName + ' "' + el.textContent.slice(0, 30) + '" yazı ' + en.toFixed(2) + ' / kutu ' + ic.toFixed(2));
    });
    const w = document.createTreeWalker(pn, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (el.closest('title') || el.closest('sub')) continue;           // ipucu · alt indis
      out.yazi++;
      const t = el.closest('text');
      let px;
      if (t) { const m = t.getScreenCTM(); px = parseFloat(getComputedStyle(el).fontSize) * Math.hypot(m.a, m.b); }
      else px = parseFloat(getComputedStyle(el).fontSize);
      // 7 pt yalnız üç yerde: tablo başlığının birim satırı, blok alt başlığı, damga
      const ikincil = !t && !!el.closest('th i, h2 small, .dmg');
      if (px < (ikincil ? IKINCIL : TABAN)) out.kucuk.push((t ? 'svg' : 'html') + ' ' + px.toFixed(2) + ' "' + n.textContent.trim().slice(0, 20) + '"');
    }
    // İki çizim (kayış yolu · hubload): iki yazının kutusu kesişiyor mu
    document.querySelectorAll('.pn .cizim').forEach((cz, ci) => {
      const yazilar = [...cz.querySelectorAll('text')]
        .filter((t) => t.textContent.trim() && !t.closest('title'))
        .map((t) => { const b = t.getBoundingClientRect(); return { s: t.textContent.trim(), b }; });
      for (let i = 0; i < yazilar.length; i++) for (let j = i + 1; j < yazilar.length; j++) {
        const a = yazilar[i].b, b = yazilar[j].b;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 1 && oy > 1) out.binen.push('çizim ' + ci + ': ' + yazilar[i].s + ' ↔ ' + yazilar[j].s + ' (' + ox.toFixed(1) + '×' + oy.toFixed(1) + ')');
      }
    });
    return out;
  });
  // BASKI: tek sayfa, yatay A3 (1.190,55 × 841,89 pt)
  const pdf = (await p.pdf({ preferCSSPageSize: true, printBackground: true })).toString('latin1');
  r.pdfSayfa = (pdf.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
  r.medya = ((/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/.exec(pdf)) || []).slice(1).map(Number);
  await p.close();
  return r;
};

test('A3 pano — bütün örneklerde sayfa, sütun, boş yer, kesik yazı, 8 pt tabanı, çizimde binen yazı ve tek sayfa baskı', async ({ page, browser }) => {
  await ac(page);
  const anahtarlar = await page.evaluate(() => veFeadExampleKeys());
  expect(anahtarlar.length).toBeGreaterThanOrEqual(11);
  const bulgu = [];
  let yazi = 0;
  for (const k of anahtarlar) {
    const r = await olc(browser, await pano(page, k));
    yazi += r.yazi;
    if (r.sayfa[0] !== 1587 || r.sayfa[1] !== 1122) bulgu.push(k + ' · sayfa ' + r.sayfa.join(' × '));
    if (r.pdfSayfa !== 1) bulgu.push(k + ' · baskı ' + r.pdfSayfa + ' sayfa');
    // A3 yatay = 1.190,55 × 841,89 pt; Chromium sayfayı cihaz pikseline
    // yuvarlıyor (ölçüldü: 1.191,12) — 1,5 pt = 0,5 mm pay.
    if (!(Math.abs(r.medya[0] - 1190.55) < 1.5 && Math.abs(r.medya[1] - 841.89) < 1.5))
      bulgu.push(k + ' · kâğıt ' + r.medya.join(' × ') + ' pt');
    r.tasan.forEach((x) => bulgu.push(k + ' · taşan · ' + x));
    r.kesik.forEach((x) => bulgu.push(k + ' · kesik · ' + x));
    r.kucuk.forEach((x) => bulgu.push(k + ' · taban altı · ' + x));
    r.binen.forEach((x) => bulgu.push(k + ' · binen · ' + x));
    r.bos.forEach((b, i) => { if (b > 45) bulgu.push(k + ' · sütun ' + i + ' boş ' + b.toFixed(1) + ' px'); });
  }
  console.log('ölçülen yazı', yazi, '· bulgu', bulgu.length);
  expect(yazi).toBeGreaterThan(3000);                 // tarama boşa çalışmıyor
  expect(bulgu).toEqual([]);
});

test('A3 pano — sayfa bütçesinin en sıkı hâli: 6 kasnak × 14 devir tek sayfada; sığmayan KIRPILMAZ', async ({ page, browser }) => {
  await ac(page);
  // En sıkı sığan hâl: çevrim satırı tabanda (14 px), taşma yok, tek sayfa.
  const html = await pano(page, 'AG00976_GATES_2025', 14);
  expect(html).toContain('--uzun:14px');
  expect(html).not.toContain('class="pn tasma"');
  const r = await olc(browser, html);
  expect(r.pdfSayfa).toBe(1);
  expect([...r.tasan, ...r.kesik, ...r.kucuk]).toEqual([]);
  // Sığmayan: sayfa uzar ve İKİ A3 sayfası basılır — tablo kesilmez.
  const uzun = await pano(page, 'AG00976_GATES_2025', 30);
  expect(uzun).toContain('class="pn tasma"');
  const r2 = await olc(browser, uzun);
  expect(r2.pdfSayfa).toBe(2);
  expect(r2.kesik).toEqual([]);
});

test('kullanıcının yolu: araçlar penceresinde A3 → Hesapla → İndir; inen dosya tek A3 sayfa', async ({ page, browser }) => {
  await ac(page);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); veFeadLoadExample('AG00976_GATES_2025'); });
  await page.waitForTimeout(2000);
  const pen = page.locator('#ve-fead-araclar');
  await pen.locator('[data-ey="tur"][data-v="pano"]').click();
  await expect(pen.locator('[data-ey="tur"][data-v="pano"]')).toHaveAttribute('aria-checked', 'true');
  await pen.locator('[data-ey="hesapla"]').first().click();
  await page.waitForFunction(() => window.veFeadResults && window.veFeadResults.ok, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  const [indirme] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    pen.locator('.ve-fead-arac-govde [data-ey="indir"]').click()
  ]);
  expect(indirme.suggestedFilename()).toMatch(/_A3_\d{8}\.html$|^MFSim_FEAD_A3_Pano_\d{8}\.html$/);
  const html = fs.readFileSync(await indirme.path(), 'utf8');
  expect(html).toContain('<section class="pn');
  const r = await olc(browser, html);
  expect(r.sayfa).toEqual([1587, 1122]);
  expect(r.pdfSayfa).toBe(1);
  expect([...r.tasan, ...r.kesik, ...r.kucuk, ...r.binen]).toEqual([]);
});
