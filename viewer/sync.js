#!/usr/bin/env node
/**
 * MFSim → Ölçüm Görüntüleyici: kaynak senkronu
 *
 * Kullanım:
 *   npm run sync:viewer          uygula (js/ → viewer/js/)
 *   npm run sync:viewer -- --check   uygulama, YALNIZCA fark var mı söyle (CI kapısı)
 *
 * NEDEN VAR
 *
 * `viewer/js/` altındaki YEDİ dosya MFSim'in `js/` klasöründen kopyadır. Altısı
 * BİREBİR; `trace-view.js` iki yerel farkla. Bu adım README'de "elle uzlaştır"
 * diye yazılıydı ve elle uzlaştırma bir kez YANLIŞ yapıldı: bellekten yeniden
 * yazılan boş-durum bloğu, var olmayan bir DOM düğümüne innerHTML atıyordu.
 * Görüntüleyici açılışta TypeError veriyordu ve hiçbir birim testi bunu
 * görmüyordu (fark yalnızca üretilen tek dosyada yaşıyor).
 *
 * Çözüm farkları KODA gömmek: metinler burada tek yerde duruyor, çapa
 * kaybolursa script PATLIYOR (sessizce yanlış dosya üretmiyor).
 *
 * MFSim'de bu iki bloğun çevresi değişirse çapa tutmaz ve script durur —
 * doğru davranış budur: farkın hâlâ anlamlı olup olmadığına insan karar verir.
 */

var fs = require('fs');
var path = require('path');

var VIEWER = __dirname;
var ROOT = path.join(VIEWER, '..');
var CHECK = process.argv.indexOf('--check') !== -1;

// ── Birebir kopyalar ──────────────────────────────────────────────────────
var VERBATIM = [
  'xlsx-read.js',
  'measure-core.js',
  'measure-import.js',
  'measure-import-ui.js',
  'signal-tree.js',
  'measure-dropzone.js'
];

// ── trace-view.js: kopya + TAM OLARAK İKİ yerel fark ──────────────────────
//
// Her farkın `from`'u MFSim kaynağında BİR KEZ geçmeli. Sıfır kez geçerse
// (üstteki kod değişmiş) ya da birden çok geçerse (çapa artık ayırt edici
// değil) script durur.
var TRACE_PATCHES = [
  {
    ad: 'boş durum metni — burada çözücü yok',
    from:
      "  var noSim = !window.veSimResults && !hasImport && !mntOnly;\n" +
      "  var h = '';\n" +
      "\n" +
      "  if(noSim) {",
    to:
      "  var noSim = !window.veSimResults && !hasImport && !mntOnly;\n" +
      "  var h = '';\n" +
      "\n" +
      "  // VIEWER FARKI: burada çözücü YOK. MFSim'in \"Çözüm sonucu yok / Çözücüyü Aç\"\n" +
      "  // metni tek başına kullanılan görüntüleyicide olmayan bir şeye işaret eder ve\n" +
      "  // kullanıcı beklemediği bir eksiklik arar. Ayrım çözücünün VARLIĞINA bakarak\n" +
      "  // yapılıyor (dalın kendisi duruyor) — böylece MFSim'den gelecek bir düzeltme\n" +
      "  // yine bu bloğa temiz uygulanır.\n" +
      "  if(noSim && typeof veSolverRun !== 'function') {\n" +
      "    h += '<div class=\"ve-trace-empty-ico\"><span class=\"mf-ico mf-ico-upload\"></span></div>';\n" +
      "    h += '<div class=\"ve-trace-empty-title\">Henüz ölçüm yok</div>';\n" +
      "    h += '<div class=\"ve-trace-empty-sub\">Bir Excel (.xlsx) ya da CSV ölçüm dosyası açın — ' +\n" +
      "         'sütunları seçin, her sinyal kendi şeridinde çizilsin.</div>';\n" +
      "    if(typeof veImpOpenPicker === 'function') {\n" +
      "      h += '<button type=\"button\" class=\"ve-trace-btn\" data-act=\"import-measure\" ' +\n" +
      "           'style=\"height:26px;margin-top:6px;\">' +\n" +
      "           '<span class=\"mf-ico mf-ico-upload\"></span> Ölçüm Verisi İçe Aktar</button>';\n" +
      "    }\n" +
      "    return h;\n" +
      "  }\n" +
      "\n" +
      "  if(noSim) {"
  },
  {
    ad: "3B kipi listede yok (Three.js tek dosyaya ~600 KB ekliyor)",
    from: "  [['line', 'İz'], ['table', 'Tablo'], ['scatter3d', '3B']].forEach(function(m) {",
    to:
      "  // VIEWER FARKI (MFSim'de üçüncü kip '3B' de var): 3B dağılım Three.js\n" +
      "  // gerektiriyor ve tek dosyalık görüntüleyiciye ~600 KB ekliyordu. Ölçüm\n" +
      "  // okumanın çekirdeğinde değil — kip listeden çıkarıldı, kodu duruyor.\n" +
      "  [['line', 'İz'], ['table', 'Tablo']].forEach(function(m) {"
  }
];

function countOf(hay, needle) {
  var n = 0, i = 0;
  while((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

function buildTraceView() {
  var src = fs.readFileSync(path.join(ROOT, 'js', 'trace-view.js'), 'utf8');
  TRACE_PATCHES.forEach(function(p) {
    var n = countOf(src, p.from);
    if(n !== 1) {
      throw new Error(
        'trace-view.js çapası tutmadı — "' + p.ad + '" (' + n + ' kez bulundu, 1 olmalı).\n' +
        'MFSim tarafında bu bloğun çevresi değişmiş. Farkın hâlâ gerekli olup\n' +
        'olmadığına karar verip viewer/sync.js içindeki metni güncelleyin.');
    }
    src = src.replace(p.from, p.to);
  });
  return src;
}

// ── Yürüt ─────────────────────────────────────────────────────────────────
var hedefler = VERBATIM.map(function(f) {
  return { ad: f, icerik: fs.readFileSync(path.join(ROOT, 'js', f), 'utf8') };
});
hedefler.push({ ad: 'trace-view.js', icerik: buildTraceView() });

var degisen = [];
hedefler.forEach(function(t) {
  var yol = path.join(VIEWER, 'js', t.ad);
  var mevcut = fs.existsSync(yol) ? fs.readFileSync(yol, 'utf8') : null;
  if(mevcut === t.icerik) return;
  degisen.push(t.ad);
  if(!CHECK) fs.writeFileSync(yol, t.icerik, 'utf8');
});

if(CHECK) {
  if(degisen.length) {
    console.error('✗ Görüntüleyici kopyaları MFSim kaynağından GERİDE: ' + degisen.join(', '));
    console.error('  Düzeltme: npm run sync:viewer && npm run build:viewer');
    process.exit(1);
  }
  console.log('✓ Görüntüleyici kopyaları güncel (' + hedefler.length + ' dosya)');
} else if(degisen.length) {
  degisen.forEach(function(f) { console.log('  güncellendi: viewer/js/' + f); });
  console.log('\n✓ ' + degisen.length + ' dosya senkronlandı — şimdi: npm run build:viewer');
} else {
  console.log('✓ Görüntüleyici kopyaları zaten güncel (' + hedefler.length + ' dosya)');
}
