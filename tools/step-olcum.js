#!/usr/bin/env node
/**
 * MFSim — STEP ÖLÇÜMÜ (gerçek program, gerçek tarayıcı)
 *
 * Kullanım:
 *   npm run build && npm run step:olcum -- .step-deneme/deneme-420.stp
 *   npm run step:olcum -- <dosya.stp> --orneklem 50 --incelik takoz,0.1 --program <html>
 *   npm run step:olcum -- <dosya.stp> --orneklem 0      (yalnız okuma; 3B örneklemi yok)
 *   npm run step:olcum -- <dosya.stp> --tam             (okuma + TAM 3B kurulumu)
 *
 * NE ÖLÇER — programın KENDİ yolu, Takoz → "STEP'ten başla":
 *   1 · okuma + montaj ağacı: dosya seçiminden kartın hazır olmasına kadar
 *       süre ve evreleri, ARAYÜZÜN DONMASI (50 ms'yi aşan görevler, toplam
 *       engel süresi, en uzun kare boşluğu), sekmenin JS belleği (sınırıyla),
 *       dosyanın JS yığını DIŞINDAKİ baytları, çizici sürecin tepe belleği
 *   2 · 3B ağı: her N'inci parça programın üçgenleyicisiyle; süre, üçgen ve
 *       bellek bütüne ORANLANIR. Bağlam programdaki gibi: parça başına
 *       bırakılır (veStepUcgenBirak — yoksa eski program: tek bağlam).
 *   3 · `--tam`: görüntüleyici açık kalır ve BÜTÜN montajı kurar — seçimden
 *       3B'nin hazır olmasına süre, ilk görüntü, kurulum boyunca uzun görevler
 *       ve ortak işin en uzun dilimi (yeni programda), yığın ve çizici süreç
 *       tepesi; kurulumdan sonra döndürme karesinin JS süresi, çizim çağrısı ve
 *       üçgen sayısı. Ekran kartı olmayan makinede (başsız Chromium) karenin
 *       kendisi işlemcide çizilir: uzun görevlerin büyüğü odur.
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
var ADIM = Math.max(0, +arguman('orneklem', 50));   // 0: 3B örneklemi yok
var INCELIK = String(arguman('incelik', 'takoz')).split(',');
var TAM = process.argv.indexOf('--tam') >= 0;
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
  // Donma ölçüsü sayfanın içinde: 50 ms'yi aşan görevler (longtask) ve kare
  // boşluğu (rAF). Okumanın sonu kartın kurulmaya başladığı an (`_mwStpKur`;
  // eski programda yok — orada okuma zaten tek görev, sonu 'hazir'ın İLK
  // karesi): sonrasında açılan 3B görüntüleyicinin işi okumaya sayılmaz,
  // ayrıca `sonra3B` olarak yazılır. Saat geri çağrının İÇİNDEN: rAF'ın
  // verdiği damga karenin planlandığı an — uzun görev o damgadan SONRA
  // koşunca boşluk bir sonraki kareye yazılıyordu (ölçüldü).
  await sayfa.evaluate(function () {
    var o = window.__olc = { uzun: [], bosluk: 0, son: performance.now(), bas: performance.now(), hazir: null, kur: null,
      hazir3b: null, ilk: null, adim: [], tepeHeap: 0 };
    new MutationObserver(function () {
      var k = document.getElementById('ve-mw-3b-tuval');
      if (o.hazir3b === null && k && k.getAttribute('data-durum') === 'hazir') o.hazir3b = performance.now();
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-durum'] });
    setInterval(function () { var h = performance.memory.usedJSHeapSize; if (h > o.tepeHeap) o.tepeHeap = h; }, 250);
    if (typeof window.veMntStpAgIs === 'function') {
      var J0 = window.veMntStpAgIs;
      window.veMntStpAgIs = function () {
        var J = J0.apply(this, arguments), ad = J.adim;
        J.adim = function (b) { var t = performance.now(), r = ad(b); o.adim.push(performance.now() - t); return r; };
        return J;
      };
    }
    if (typeof window.veMntWiz3bAc === 'function') {
      var ac = window.veMntWiz3bAc;
      window.veMntWiz3bAc = function () {
        var r = ac.apply(this, arguments), V = window._mw3b;
        if (V && V.renderer) {
          var ro = V.renderer.render.bind(V.renderer);
          V.renderer.render = function (sh, c) { ro(sh, c); if (o.ilk === null && V.renderer.info.render.triangles > 0) o.ilk = performance.now(); };
        }
        return r;
      };
    }
    try {
      new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { o.uzun.push([e.startTime, e.duration]); }); })
        .observe({ type: 'longtask' });
    } catch (e) { o.uzunYok = true; }
    if (typeof window._mwStpKur === 'function') {
      var kur = window._mwStpKur;
      window._mwStpKur = function () { if (o.kur === null) o.kur = performance.now(); return kur.apply(this, arguments); };
    }
    (function kare() {
      if (o.hazir !== null) return;
      var t = performance.now();
      if (o.kur === null && t - o.son > o.bosluk) o.bosluk = t - o.son;
      o.son = t;
      var s = veMntWizStp();
      if (s && (s.durum === 'hazir' || s.durum === 'hata')) o.hazir = t;
      requestAnimationFrame(kare);
    })();
  });
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
  // Okumanın bittiği kare çizilsin (donmuş okumada o kare okumanın sonudur)
  await sayfa.waitForFunction(function () { return window.__olc.hazir !== null; }, null, { timeout: 600000 });
  var a1 = await sayfa.evaluate(function (tam) {
    if (!tam && typeof veMntWiz3bKapat === 'function') veMntWiz3bKapat();
    if (!tam && window.gc) gc();
    var s = veMntWizStp(), so = s.sonuc || { parcalar: [] }, o = window.__olc;
    var sinir = o.kur !== null ? o.kur : o.hazir;
    var uz = o.uzun.filter(function (e) { return e[0] < sinir; });
    var uc = o.uzun.filter(function (e) { return e[0] >= sinir; });
    // Dosyanın JS yığını DIŞINDA duran baytları (ArrayBuffer): yeni okuyucu
    // dosyayı bayt dizisi olarak tutar; eski okuyucuda dosya yığındaki metindi.
    var dis = 0, m = so._model || {};
    Object.keys(m).forEach(function (k) { var v = m[k]; if (v && ArrayBuffer.isView(v)) dis += v.byteLength; });
    return { durum: s.durum, hata: s.hata || null, parca: so.parcalar.length, sureMs: so.sureMs || {},
      yuz: so.parcalar.reduce(function (t, p) { return t + p.yuzSayisi; }, 0), heap: performance.memory.usedJSHeapSize,
      dis: dis, okumaMs: sinir - o.bas, uzunGorev: o.uzunYok ? null : uz.length,
      sonra3B: uc.map(function (e) { return Math.round(e[1]); }),
      enUzunGorevMs: uz.reduce(function (t, e) { return Math.max(t, e[1]); }, 0),
      engelMs: uz.reduce(function (t, e) { return t + Math.max(0, e[1] - 50); }, 0), enUzunKareMs: o.bosluk };
  }, TAM);
  yaz({ adim: 'okundu + montaj ağacı', sn: +(a1.okumaMs / 1000).toFixed(1), durum: a1.durum, hata: a1.hata,
    parca: a1.parca, yuz: a1.yuz, evreMs: a1.sureMs,
    donma: { uzunGorev: a1.uzunGorev, enUzunGorevMs: Math.round(a1.enUzunGorevMs), engelSn: +(a1.engelMs / 1000).toFixed(1),
      enUzunKareMs: Math.round(a1.enUzunKareMs) }, sonra3BUzunGorevMs: a1.sonra3B,
    heapMB: MB(a1.heap), yiginDisiMB: MB(a1.dis), tepeCizicMB: MB(tepe), beklemeSn: sn1 });
  if (TAM && a1.durum === 'hazir') {
    // ── 3 · TAM 3B kurulumu ──
    var t3 = Date.now();
    try {
      await sayfa.waitForFunction(function () { var k = document.getElementById('ve-mw-3b-tuval'); return k && k.getAttribute('data-durum') === 'hazir'; },
        null, { timeout: 1800000, polling: 1000 });
    } catch (e) { yaz({ adim: '3B bitmedi', hata: String(e).slice(0, 200) }); }
    await new Promise(function (ok) { setTimeout(ok, 3000); });
    var a3 = coktu ? null : await sayfa.evaluate(function () {
      var o = window.__olc, V = window._mw3b, sinir = o.kur !== null ? o.kur : o.hazir;
      var uz = o.uzun.filter(function (e) { return e[0] >= sinir; }).map(function (e) { return Math.round(e[1]); }).sort(function (a, b) { return b - a; });
      var r = { hazirMs: o.hazir3b !== null ? Math.round(o.hazir3b - o.bas) : null, ilkGoruntuMs: o.ilk !== null ? Math.round(o.ilk - o.bas) : null,
        uzunGorev: uz.length, enUzun: uz.slice(0, 6), engelSn: +(uz.reduce(function (t, d) { return t + Math.max(0, d - 50); }, 0) / 1000).toFixed(1),
        isDilimiEnUzunMs: o.adim.length ? Math.round(Math.max.apply(null, o.adim)) : null, tepeHeapMB: Math.round(o.tepeHeap / 1048576) };
      if (window.gc) gc();
      r.sonHeapMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
      if (V && V.renderer) {
        var cpu = [];
        for (var k = 0; k < 9; k++) { V.ctrl.theta += 0.05; _mw3bKamera(); var t = performance.now(); V.renderer.render(V.scene, V.camera); cpu.push(performance.now() - t); }
        cpu.sort(function (a, b) { return a - b; });
        r.kare = { jsMs: Math.round(cpu[4] * 10) / 10, cagri: V.renderer.info.render.calls, ucgen: V.renderer.info.render.triangles };
      }
      return r;
    });
    yaz({ adim: 'tam 3B', sn: a3 && a3.hazirMs !== null ? +(a3.hazirMs / 1000).toFixed(1) : (Date.now() - t3) / 1000, coktu: coktu, sonuc: a3, tepeCizicMB: MB(tepe) });
    clearInterval(orneklem); await tarayici.close(); process.exit(coktu ? 1 : 0);
  }
  if (a1.durum !== 'hazir' || !ADIM) { clearInterval(orneklem); await tarayici.close(); process.exit(a1.durum === 'hazir' ? 0 : 1); }

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
        if (typeof veStepUcgenBirak === 'function') veStepUcgenBirak(B);
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
