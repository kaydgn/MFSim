#!/usr/bin/env node
/**
 * MFSim — STEP ÖLÇÜMÜ (gerçek program, gerçek tarayıcı)
 *
 * Kullanım:
 *   npm run build && npm run step:olcum -- .step-deneme/deneme-420.stp
 *   npm run step:olcum -- <dosya.stp> --orneklem 50 --incelik takoz,0.1 --program <html>
 *
 * NE ÖLÇER — programın KENDİ yolu, Takoz → "STEP'ten başla":
 *   1 · okuma + montaj ağacı: dosya seçiminden kartın hazır olmasına kadar
 *       süre, sekmenin JS belleği (sınırıyla), çizici sürecin tepe belleği
 *   2 · 3B ağı: her N'inci parça programın üçgenleyicisiyle; süre, üçgen ve
 *       bellek bütüne ORANLANIR (bugünkü kodla 400 MB'lık montajın tamamı
 *       yarım saati buluyor; örneklem dakikada biter). Bağlam ölçüm boyunca
 *       canlı tutulur — görüntüleyici de kurulum bitene dek tutuyor.
 * İncelik `takoz`: programın Takoz sabiti (VE_MNT_STP_UCGEN; eski programda
 * yoksa varsayılan) · sayı: o kiriş payı (mm), FEAD'in varsayılanı 0.1.
 *
 * Program varsayılan olarak depodaki MFSim_Code.html (önce `npm run build`);
 * ESKİ sürümle kıyas için `--program` ile başka bir derleme verilir.
 * Tarayıcı MFSIM_CHROMIUM'dan (playwright.config.js'in kuralı).
 */
'use strict';
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var chromium = require('@playwright/test').chromium;

var ROOT = path.join(__dirname, '..');
function arguman(ad, yedek) {
  var i = process.argv.indexOf('--' + ad);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : yedek;
}
var DOSYA = process.argv[2] && process.argv[2].indexOf('--') !== 0 ? path.resolve(process.argv[2]) : null;
var PROGRAM = path.resolve(arguman('program', path.join(ROOT, 'MFSim_Code.html')));
var ADIM = Math.max(1, +arguman('orneklem', 50) || 50);
var INCELIK = String(arguman('incelik', 'takoz')).split(',');
if (!DOSYA || !fs.existsSync(DOSYA)) { console.error('STEP dosyası bulunamadı. Kullanım: npm run step:olcum -- <dosya.stp>'); process.exit(2); }
if (!fs.existsSync(PROGRAM)) { console.error(PROGRAM + ' yok. Önce: npm run build'); process.exit(2); }

var MB = function (x) { return Math.round(x / 1048576); };
var yaz = function (o) { console.log(JSON.stringify(o)); };
// Çizici süreçlerin toplam belleği (yalnız Linux'ta ölçülür; başka yerde 0)
function cizicRss() {
  try {
    var out = childProcess.execSync("ps -eo rss,args | grep -E 'type=renderer' | grep -v grep", { encoding: 'utf8' });
    return out.trim().split('\n').reduce(function (s, l) { return s + (+l.trim().split(/\s+/)[0] || 0); }, 0) * 1024;
  } catch (e) { return 0; }
}

(async function () {
  var tarayici = await chromium.launch(Object.assign({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] },
    process.env.MFSIM_CHROMIUM ? { executablePath: process.env.MFSIM_CHROMIUM } : {}));
  var sayfa = await tarayici.newPage({ viewport: { width: 1600, height: 1000 } });
  var coktu = false;
  sayfa.on('crash', function () { coktu = true; yaz({ olay: 'sekme çöktü' }); });
  sayfa.on('pageerror', function (e) { yaz({ olay: 'sayfa hatası', hata: String(e).slice(0, 300) }); });
  var tepe = 0;
  var orneklem = setInterval(function () { var r = cizicRss(); if (r > tepe) tepe = r; }, 400);

  await sayfa.goto('file://' + PROGRAM);
  await sayfa.evaluate(function () { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await sayfa.waitForFunction(function () {
    return typeof window.createNode === 'function' && typeof window.veMntOpenEditor === 'function'
      && typeof window.veMntWizStp === 'function' && Array.isArray(window.nodes);
  }, null, { timeout: 120000 });
  await sayfa.evaluate(function () { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await sayfa.waitForFunction(function () { var s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 120000 });
  await sayfa.evaluate(function () { var n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await sayfa.waitForSelector('#ve-mnt-baslangic .ve-bas-kapi[data-ey="step"]');
  var bas = await sayfa.evaluate(function () { return { heap: performance.memory.usedJSHeapSize, sinir: performance.memory.jsHeapSizeLimit }; });
  yaz({ adim: 'program açık', program: path.relative(ROOT, PROGRAM) || PROGRAM, dosya: path.basename(DOSYA),
    dosyaMB: MB(fs.statSync(DOSYA).size), heapMB: MB(bas.heap), heapSiniriMB: MB(bas.sinir) });

  // ── 1 · okuma + montaj ağacı ──
  var secici = await Promise.all([sayfa.waitForEvent('filechooser'), sayfa.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="step"]')]);
  var t0 = Date.now();
  await secici[0].setFiles(DOSYA);
  var durum = null;
  while (!coktu) {
    try { durum = await sayfa.evaluate(function () { var s = veMntWizStp(); return s ? s.durum : null; }); }
    catch (e) { yaz({ olay: 'sayfaya ulaşılamadı', hata: String(e).slice(0, 200) }); break; }
    if (durum === 'hazir' || durum === 'hata') break;
    await new Promise(function (ok) { setTimeout(ok, 500); });
  }
  if (coktu || (durum !== 'hazir' && durum !== 'hata')) {
    yaz({ adim: 'okuma bitmedi', sn: (Date.now() - t0) / 1000, tepeCizicMB: MB(tepe) });
    clearInterval(orneklem); await tarayici.close(); process.exit(1);
  }
  var sn1 = (Date.now() - t0) / 1000;
  // Dosya okununca 3B görüntüleyici BÜTÜN montajı çizmeye başlar — ölçümü
  // örneklemle ayrıca yapmak için hemen kapatılır.
  var a1 = await sayfa.evaluate(function () {
    if (typeof veMntWiz3bKapat === 'function') veMntWiz3bKapat();
    if (window.gc) gc();
    var s = veMntWizStp(), so = s.sonuc || { parcalar: [] };
    return { durum: s.durum, hata: s.hata || null, parca: so.parcalar.length,
      yuz: so.parcalar.reduce(function (t, p) { return t + p.yuzSayisi; }, 0), heap: performance.memory.usedJSHeapSize };
  });
  yaz({ adim: 'okundu + montaj ağacı', sn: sn1, durum: a1.durum, hata: a1.hata, parca: a1.parca, yuz: a1.yuz,
    heapMB: MB(a1.heap), tepeCizicMB: MB(tepe) });
  if (a1.durum !== 'hazir') { clearInterval(orneklem); await tarayici.close(); process.exit(1); }

  // ── 2 · 3B ağı, örneklem ──
  for (var i = 0; i < INCELIK.length; i++) {
    var a2 = await sayfa.evaluate(function (g) {
      window.__olcAg = null; window.__olcB = null;
      if (window.gc) gc();
      var so = veMntWizStp().sonuc;
      var secenek = g.incelik === 'takoz' ? (typeof VE_MNT_STP_UCGEN !== 'undefined' ? VE_MNT_STP_UCGEN : undefined) : { kiris: +g.incelik };
      var B = veStepUcgenBaglam(so._model, secenek), ag = [];
      var h0 = performance.memory.usedJSHeapSize, t = performance.now(), parca = 0, yuz = 0, ucgen = 0;
      for (var k = 0; k < so._geo.length; k += g.adim) {
        var geo = so._geo[k];
        if (!geo || !geo.yuzler.length) continue;
        var top = veStepUcgenTopla(B, geo.M, geo.birim);
        geo.yuzler.forEach(function (f) { top.ekle(f); });
        var a = top.bitir();
        ag.push(a); parca++; yuz += geo.yuzler.length; ucgen += a.ucgen.length / 3;
      }
      var ms = performance.now() - t;
      window.__olcAg = ag; window.__olcB = B;
      if (window.gc) gc();
      var dizi = 0;
      ag.forEach(function (x) { dizi += x.uc.byteLength + x.normal.byteLength + x.ucgen.byteLength + x.cizgi.byteLength; });
      return { kiris: B.kiris, parca: parca, yuz: yuz, ucgen: ucgen, ms: ms, heapMB: (performance.memory.usedJSHeapSize - h0) / 1048576,
        diziMB: dizi / 1048576, toplamYuz: so.parcalar.reduce(function (t2, p) { return t2 + p.yuzSayisi; }, 0) };
    }, { incelik: INCELIK[i], adim: ADIM });
    var oran = a2.toplamYuz / a2.yuz;
    yaz({ adim: '3B ağı — örneklem', incelik: INCELIK[i], kirisMm: a2.kiris, orneklem: a2.parca + ' parça · ' + a2.yuz + ' yüz',
      tahmin: { dakika: +(a2.ms * oran / 60000).toFixed(1), milyonUcgen: +(a2.ucgen * oran / 1e6).toFixed(1),
        bellekGB: +((a2.heapMB + a2.diziMB) * oran / 1024).toFixed(1), sekmeJsGB: +((a1.heap / 1048576 + a2.heapMB * oran) / 1024).toFixed(1) },
      tepeCizicMB: MB(tepe) });
  }
  clearInterval(orneklem);
  await tarayici.close();
})().catch(function (e) { console.error('HATA', e); process.exit(1); });
