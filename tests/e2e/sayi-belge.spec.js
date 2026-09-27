/**
 * sayi-belge.spec.js — BELGELERDE TÜRKÇE SAYI (karar 7·C, aşama 3)
 * ─────────────────────────────────────────────────────────────────────
 *
 * Karar sayfası: "tablolar, kartlar, grafik eksenleri, günlük ve indirilen
 * raporlar aynı yazımı kullanır. Yüzde işareti önde (%25)."
 *
 * ÖLÇÜLEN KUSUR (2026-09-27, isb340_tc411 örneği, segment sürüşü ve engel
 * aşma açık): Araç Performans'ın altı TXT raporunda, ayrıntılı raporunda,
 * rapor grafiklerinde ve indirilen HTML raporunda 12.155 noktalı ondalık,
 * 3.868 gruplanmamış sayı, 1.979 boşlukla gruplanmış sayı ("13 150") ve 24
 * sondaki yüzde ("97,0%") vardı. Bu tarama o yapıda düşüyor, bu yapıda 0.
 *
 * TXT HİZASI: Türkçe binlik sayıyı uzatır ("13150" → "13.150"); dolgusu
 * yetmeyen hücre sonraki sütunu iter. Kutulu ve boşluk hizalı tabloların
 * ikisi de ölçülür (kural: tests/helpers/sayi-olcu.js, kendi testi var).
 *
 * Formül (KaTeX) metinden çıkarılır — innerText sayıyı parçalara bölüyor —
 * ve TeX kaynağında noktalı ondalık ayrıca aranır (Türkçe yazım "0{,}5").
 *
 * Node'da koşamaz: belgeler gerçek bir çözümden üretiliyor.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { tara, kutuIhlal, tabloIhlal, TEX_NOKTA } = require('../helpers/sayi-olcu.js');

const BUILD = process.env.MFSIM_OLCUM_HTML || path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(300000);

// Üretilen HTML belgeyi ayrı sayfada açar: kullanıcının gördüğü metin + TeX.
const belgeMetni = async (browser, html) => {
  const p = await browser.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const tex = [...document.querySelectorAll('annotation[encoding="application/x-tex"]')].map((a) => a.textContent);
    document.querySelectorAll('.katex').forEach((k) => k.replaceWith(document.createTextNode('⟦TeX⟧')));
    return { metin: document.body.innerText, tex: tex.join('\n') };
  });
  await p.close();
  return r;
};

test('Araç Performans: TXT raporları, ayrıntılı rapor, grafikleri ve indirilen rapor Türkçe sayı yazıyor; TXT hizası bozulmuyor', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1920, height: 1032 });
  await page.addInitScript(() => {
    const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t) {
      if (window.__olcKayit) window.__olcFill.push(String(t));
      return f.apply(this, arguments);
    };
  });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.click('.ve-module-card[data-module="arac-performans"]');
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.confirm = () => true;
    let ex = nodes.find((x) => x.type === 'ap-example');
    if (!ex) ex = createNode('ap-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411';
    veApLoadExample(ex.id);
  });
  await page.waitForTimeout(2500);
  // İki isteğe bağlı analiz de koşsun: raporları dolsun, bin metrelik yollar gruplansın
  await page.evaluate(() => {
    const sol = nodes.find((x) => x.type === 'solver');
    sol.data.accelDecelAnalysis = true; sol.data.obstacleCrossingAnalysis = true;
    let sc = nodes.find((x) => x.type === 'scenario');
    if (!sc) sc = createNode('scenario', 900, 620);
    sc.data = sc.data || {};
    sc.data.roadSegments = [{ no: 1, grade: 0, distance: 1200, deltaH: 0 },
      { no: 2, grade: 4.5, distance: 850, deltaH: 38.3 }, { no: 3, grade: -3, distance: 1500, deltaH: -45 }];
    if (!nodes.some((x) => x.type === 'obstacle-crossing')) createNode('obstacle-crossing', 1000, 620);
    veSolverRunProfessional();
  });
  await page.waitForFunction(() => window.veSimResults && window.veSimResults.reportSnapshot, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const o = document.getElementById('ve-solver-modal-overlay'); if (o) o.remove(); });

  const txt = await page.evaluate(() => {
    const s = window.veSimResults;
    return {
      'TXT tam gaz': veGenerateFTTxtReport(s),
      'TXT detay matematik': veGenerateFTCalcTraceReport(s, null, null),
      'TXT detay matematik (düşük kademe)': veGenerateFTCalcTraceReport(s, null, 'low'),
      'TXT topoloji': veGenerateTopologyTxtReport(),
      'TXT hızlanma-yavaşlama': veGenerateSegmentDriveTxtReport(s),
      'TXT engel aşma': veGenerateObstacleCrossingTxtReport(s),
    };
  });
  for (const [ad, t] of Object.entries(txt)) {
    expect([ad, t.length > 2000 && t.charAt(0) !== '(']).toEqual([ad, true]);   // rapor gerçekten üretildi
  }

  await page.locator('#ve-nav-rail button:has-text("Sonuçlar")').first().click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__olcFill = []; window.__olcKayit = true; veRenderDetailedReport(); });
  await page.waitForSelector('#ve-report-overlay .dr-hdr', { timeout: 15000 });
  await page.evaluate(() => {
    document.querySelectorAll('#ve-report-overlay .dr-hdr').forEach((h) => {
      const b = h.nextElementSibling;
      if (b && !b.classList.contains('dr-open')) h.click();
    });
  });
  await page.waitForTimeout(2500);
  const rapor = await page.evaluate(() => document.getElementById('ve-report-overlay').innerText);
  const tuval = await page.evaluate(() => { window.__olcKayit = false; return [...new Set(window.__olcFill)].join('\n'); });
  await page.evaluate(() => { window.__olcDoc = null; window._veReportDownloadBlob = (d) => { window.__olcDoc = d; }; veDownloadReportHTML(); });
  await page.waitForFunction(() => window.__olcDoc, null, { timeout: 60000 });
  const indirilen = await belgeMetni(browser, await page.evaluate(() => window.__olcDoc));

  const belgeler = Object.assign({}, txt, {
    'ayrıntılı rapor': rapor,
    'ayrıntılı raporun grafikleri': tuval,
    'indirilen HTML rapor': indirilen.metin,
  });
  const sorun = [], adlar = {};
  let taranan = 0;
  for (const [ad, metin] of Object.entries(belgeler)) {
    taranan += metin.length;
    const r = tara(metin);
    r.sorun.forEach((s) => sorun.push(`${ad} · ${s.tur} "${s.sayi}" ⟨${s.bag}⟩`));
    for (const [k, n] of Object.entries(r.adlar)) adlar[k] = (adlar[k] || 0) + n;
  }
  const hiza = [];
  for (const [ad, metin] of Object.entries(txt)) {
    kutuIhlal(metin).forEach((x) => hiza.push(`${ad} · kutu · ${x}`));
    tabloIhlal(metin).forEach((x) => hiza.push(`${ad} · tablo · ${x}`));
  }
  const tex = (indirilen.tex.match(TEX_NOKTA) || []);
  console.log('taranan', taranan, 'karakter · ad olarak kalan', JSON.stringify(adlar));

  expect(taranan).toBeGreaterThan(400000);
  expect(tuval.length).toBeGreaterThan(200);                // grafikler gerçekten çizildi
  expect(indirilen.tex.length).toBeGreaterThan(500);         // formüller gerçekten var
  expect(sorun).toEqual([]);
  expect(hiza).toEqual([]);
  expect(tex).toEqual([]);
});
