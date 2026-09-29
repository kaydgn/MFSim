/**
 * fead-pano.spec.js — FEAD A3 SONUÇ PANOSU (gerçek tarayıcı)
 * ─────────────────────────────────────────────────────────────────────
 * Birim kapısı (tests/unit/cp-fead-pano.test.js) sayıları ve ölçü
 * BÜTÇESİNİ ölçer; bütçenin gerçekten tuttuğunu yalnız tarayıcı söyler —
 * jsdom yerleşim yapmaz, yazı ölçmez, sayfa basmaz. Burada ölçülen:
 *
 *   · sayfa 1.587 × 1.122 px ve üç sütunun içeriği kendi kutusunda
 *     (sütun taşması sessizdir: `overflow:hidden` sayfa onu keser)
 *   · hiçbir hücre / başlık / gösterge yazısı kesilmiyor
 *   · gövde yazısı 10 pt tabanında — SVG yazısı ekrandaki ölçeğiyle; tek
 *     istisna alt indis
 *   · kayış yolu çiziminde iki yazı üst üste binmiyor (taban yazıyı
 *     büyütüyor; yerleştirici kendi boyuyla yerleştirmişti)
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
    const TABAN = 13.333 - 0.01;
    const pn = document.querySelector('.pn');
    const pr = pn.getBoundingClientRect();
    const out = { sayfa: [pr.width, pr.height], tasan: [], kesik: [], kucuk: [], binen: [], yazi: 0 };
    const icAlt = pr.bottom - 40 + 0.5;
    document.querySelectorAll('.pn .sut').forEach((s, i) => {
      const sr = s.getBoundingClientRect();
      [...s.querySelectorAll('*')].forEach((c) => {
        if (c.closest('svg')) return;
        const cr = c.getBoundingClientRect();
        if (cr.height && (cr.bottom > sr.bottom + 0.5 || cr.bottom > icAlt))
          out.tasan.push('sütun ' + i + ' ' + c.tagName + ' "' + (c.textContent || '').slice(0, 24) + '" ' + Math.round(cr.bottom) + ' > ' + Math.round(Math.min(sr.bottom, icAlt)));
      });
    });
    document.querySelectorAll('.pn td, .pn th, .pn h2, .pn .kpi .k, .pn .kpi b, .pn .kpi .s, .pn .kp span, .pn .not, .pn .ust b, .pn .ust .kn span').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
        out.kesik.push(el.tagName + ' "' + el.textContent.slice(0, 30) + '" ' + el.scrollWidth + '/' + el.clientWidth + ' ' + el.scrollHeight + '/' + el.clientHeight);
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
      if (px < TABAN) out.kucuk.push((t ? 'svg' : 'html') + ' ' + px.toFixed(2) + ' "' + n.textContent.trim().slice(0, 20) + '"');
    }
    // Kayış yolu: iki yazının kutusu (hâle hariç, gerçek glif kutusu) kesişiyor mu
    const yazilar = [...document.querySelectorAll('.pn .cizim text')]
      .filter((t) => t.textContent.trim() && !t.closest('title'))
      .map((t) => { const b = t.getBoundingClientRect(); return { s: t.textContent.trim(), b }; });
    for (let i = 0; i < yazilar.length; i++) for (let j = i + 1; j < yazilar.length; j++) {
      const a = yazilar[i].b, b = yazilar[j].b;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1) out.binen.push(yazilar[i].s + ' ↔ ' + yazilar[j].s + ' (' + ox.toFixed(1) + '×' + oy.toFixed(1) + ')');
    }
    return out;
  });
  // BASKI: tek sayfa, yatay A3 (1.190,55 × 841,89 pt)
  const pdf = (await p.pdf({ preferCSSPageSize: true, printBackground: true })).toString('latin1');
  r.pdfSayfa = (pdf.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
  r.medya = ((/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/.exec(pdf)) || []).slice(1).map(Number);
  await p.close();
  return r;
};

test('A3 pano — bütün örneklerde sayfa, sütun, kesik yazı, 10 pt tabanı, çizimde binen yazı ve tek sayfa baskı', async ({ page, browser }) => {
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
    r.kucuk.forEach((x) => bulgu.push(k + ' · 10 pt altı · ' + x));
    r.binen.forEach((x) => bulgu.push(k + ' · binen · ' + x));
  }
  console.log('ölçülen yazı', yazi, '· bulgu', bulgu.length);
  expect(yazi).toBeGreaterThan(3000);                 // tarama boşa çalışmıyor
  expect(bulgu).toEqual([]);
});

test('A3 pano — sayfa bütçesinin en sıkı hâli: 6 kasnak × 17 devir tek sayfada; sığmayan KIRPILMAZ', async ({ page, browser }) => {
  await ac(page);
  // En sıkı sığan hâl: satır tabanı (17 px), taşma yok, tek sayfa.
  const html = await pano(page, 'AG00976_GATES_2025', 17);
  expect(html).toContain('--sat:17px');
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
