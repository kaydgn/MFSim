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

// ── Elden taşınan TEK fonksiyonlar ────────────────────────────────────────
//
// Görüntüleyiciye ait bir dosyanın İÇİNDE, MFSim'den birebir alınmış bir
// fonksiyon durabiliyor. Dosyanın tamamı kopya olmadığı için otomatik
// kopyalanamaz — ama AYRIŞTIĞI söylenebilir, ve söylenmeli: README'de
// "upstream'de değişirse elle taşınır" yazan bir kural, hatırlanmadığı gün
// sessizce bozulur. board.js'in sayı biçimlendiricilerinde tam olarak bu oldu:
// iki kopya birbirinden habersiz ayrı ayrı düzeltilmişti.
//
// Bunlar OTOMATİK TAŞINMAZ (çevreleyen dosya görüntüleyiciye ait, körlemesine
// yazmak tehlikeli); yalnız rapor edilir, kararı insan verir.
// `kip`:
//   'birebir'  → gövdeler BAYT BAYT aynı olmalı (temiz kopya)
//   'davranis' → yorum ve boşluk elenerek karşılaştırılır. Bunlar bugün
//                yalnızca yoruma/biçime göre ayrışmış kopyalar: davranış aynı,
//                metin değil. Bayt eşitliği dayatmak, görüntüleyiciye özgü
//                yorumları silmeyi zorlardı; asıl korunması gereken MANTIK.
var CARRIED = [
  { fn: 'veThemeRgba', from: 'js/theme.js', to: 'viewer/js/theme.js', kip: 'birebir',
    neden: 'canvas CSS değişkeni çözemiyor; köprü fonksiyon' },

  // board.js'e elden taşınmış olanlar (2026-08 ölçümü: 28 üst-seviye
  // fonksiyonun 28'i de js/ altında AYNI ADLA duruyor; bunların 8'i bayt bayt
  // kopya, 6'sı yalnız yorumda ayrışmış). Öncesinde bu listede TEK giriş vardı
  // ve 27'si izlenmiyordu — yani MFSim'deki bir düzeltme görüntüleyiciye
  // ulaşmadığında hiçbir kapı ötmüyordu.
  { fn: 'veNiceStep',        from: 'js/graphics.js', to: 'viewer/js/board.js', kip: 'birebir', neden: 'eksen adım hesabı' },
  { fn: 'veAxisDecimals',    from: 'js/graphics.js', to: 'viewer/js/board.js', kip: 'birebir', neden: 'eksen ondalık basamağı' },
  { fn: '_veToastDismiss',   from: 'js/results.js',  to: 'viewer/js/board.js', kip: 'birebir', neden: 'bildirim kapatma' },
  { fn: 'veToggleTree',      from: 'js/results.js',  to: 'viewer/js/board.js', kip: 'birebir', neden: 'ağaç düğümü aç/kapa' },
  { fn: 'veFilterResultsTree', from: 'js/results.js', to: 'viewer/js/board.js', kip: 'birebir', neden: 'ağaç arama süzgeci' },
  { fn: 'veTrDragSession',   from: 'js/results.js',  to: 'viewer/js/board.js', kip: 'birebir', neden: 'sürükleme oturumu' },
  { fn: 'veStartSignalDrag', from: 'js/results.js',  to: 'viewer/js/board.js', kip: 'birebir', neden: 'sinyal sürükleme' },
  { fn: 'veInitResultSlots', from: 'js/results.js',  to: 'viewer/js/board.js', kip: 'birebir', neden: 'pano gözü kurulumu' },

  { fn: 'escapeHTML',        from: 'js/ui-core.js',  to: 'viewer/js/board.js', kip: 'davranis', neden: 'HTML kaçışı — güvenlik kritik, ayrışmamalı' },
  { fn: 'veFormatTooltipVal', from: 'js/graphics.js', to: 'viewer/js/board.js', kip: 'davranis', neden: 'sayı biçimlendirici — iki kopya bir kez ayrı ayrı düzeltilmişti' },
  { fn: 'veFormatAxisVal',   from: 'js/graphics.js', to: 'viewer/js/board.js', kip: 'davranis', neden: 'eksen sayı biçimlendirici — aynı olay' },
  { fn: '_veToastStack',     from: 'js/results.js',  to: 'viewer/js/board.js', kip: 'davranis', neden: 'bildirim yığını yerleşimi' },
  { fn: 'showToast',         from: 'js/results.js',  to: 'viewer/js/board.js', kip: 'davranis', neden: 'bildirim gösterimi' },
  { fn: 'veStartSensorDrag', from: 'js/results.js',  to: 'viewer/js/board.js', kip: 'davranis', neden: 'sensör sürükleme' }
];

// ── Bilerek AYRI yazılmış olanlar ─────────────────────────────────────────
//
// Adı MFSim'dekiyle aynı ama gövdesi bilerek farklı. Bunlar KOPYA DEĞİL:
// görüntüleyicide çözücü, topoloji ve sensör kavramları yok; aynı işin
// görüntüleyici sürümü ayrı yazılmış. Listede olmalarının sebebi izlemek
// değil, HESABININ VERİLMİŞ olması: aşağıdaki kapı, board.js'teki her adın ya
// CARRIED'de ya burada olmasını şart koşuyor. Yeni bir fonksiyon elden
// taşındığında hiçbir listede olmadığı için script durur ve karar insana kalır.
var AYRIK = [
  { fn: 'veMntSets' }, { fn: 'veGetSensorData' }, { fn: 'veUpdateResultsTree' },
  { fn: 'veInheritedXAxis' }, { fn: 'veSyncBoardState' }, { fn: 'veWarnXAxisMismatch' },
  { fn: 'veAddSignalToSlot' }, { fn: 'veAddSensorToSlot' }, { fn: 'veRemoveSensorFromSlot' },
  { fn: 'veRenderSlot' }, { fn: 'veRenderTable' }, { fn: 'veGetAvailableXAxisOptions' },
  { fn: 'veShowXAxisPicker' }, { fn: 'veSetSlotXAxis' }
];

// Görüntüleyiciye özgü dosyalar (kopya DEĞİL). Aşağıdaki ters yön kapısı,
// viewer/js/ altındaki her dosyanın ya izlenen bir kopya ya da burada ilan
// edilmiş olmasını şart koşar — yoksa js/'ten kopyalanan 8. bir dosya sonsuza
// dek senkron dışı kalırdı ve "YEDİ dosya birebir kopya" kuralı yalnız insan
// hafızasıyla korunurdu.
var VIEWER_OZGU = ['theme.js', 'board.js', 'app.js'];

// ── Üst-seviye fonksiyon gövdesi çıkarma ──────────────────────────────────
//
// İlk yazımı `indexOf('function ' + name)` idi; bu bir ÖN-EK aramasıdır
// ('veThemeRgba' ararken 'veThemeRgbaHex' de eşleşir) ve eşleşme bir yorumun
// ya da dizgenin içinde olabilir — bu depo Türkçe yorumlarla dolu ve
// yorumlarda fonksiyon adı geçmesi olağan. Ayrıca süslü parantez sayımı
// dizge/yorum/regex atlamıyordu: gövdedeki tek bir dizge içi '{' sayacı
// kaydırıp yanlış bir dilim döndürebilirdi. İki yönde de kötü: yanlış dilim
// iki tarafta aynı çıkarsa gerçek ayrışma GÖRÜLMEZ, farklı çıkarsa var olmayan
// bir ayrışma bildirilir. Liste bir girişten on beşe çıktığı için bu artık
// teorik değil.
//
// Şimdi: bildirim SATIR BAŞINDA aranır (üst-seviye) ve tam ad eşleşir; sayım
// dizge, şablon dizgesi, yorum ve regex'i atlar.
function fnBody(src, name) {
  var decl = new RegExp('^function\\s+' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(', 'm');
  var m = decl.exec(src);
  if(!m) return null;

  var i = src.indexOf('{', m.index);
  if(i < 0) return null;

  var d = 0, q = null, k;
  for(k = i; k < src.length; k++) {
    var c = src[k], n = src[k + 1];

    if(q) {                                   // dizge / şablon / yorum / regex içi
      if(q === '//')       { if(c === '\n') q = null; }
      else if(q === '/*')  { if(c === '*' && n === '/') { q = null; k++; } }
      else if(c === '\\')  { k++; }           // kaçış: sonraki karakteri atla
      else if(c === q)     { q = null; }
      continue;
    }

    if(c === '/' && n === '/')      { q = '//'; k++; continue; }
    if(c === '/' && n === '*')      { q = '/*'; k++; continue; }
    if(c === '"' || c === "'" || c === '`') { q = c; continue; }
    if(c === '/' && oncekiRegexBaslatir(src, k)) { q = '/'; continue; }

    if(c === '{') d++;
    else if(c === '}') { d--; if(d === 0) return src.slice(m.index, k + 1); }
  }
  return null;
}

// '/' bir bölme mi yoksa regex başlangıcı mı? Önceki anlamlı karakter bir
// değer SONU ise bölmedir; değilse regex'tir. Tam bir JS ayrıştırıcısı değil
// ama bu depodaki kullanım için yeterli ve bölmeyi regex sanmaktan iyi.
function oncekiRegexBaslatir(src, k) {
  for(var i = k - 1; i >= 0; i--) {
    var c = src[i];
    if(c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
    return !/[\w$)\]]/.test(c);
  }
  return true;
}

var YORUM_BOSLUK = function(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');
};

function carriedDrift() {
  return CARRIED.filter(function(c) {
    var a = fnBody(fs.readFileSync(path.join(ROOT, c.from), 'utf8'), c.fn);
    var b = fnBody(fs.readFileSync(path.join(ROOT, c.to), 'utf8'), c.fn);
    if(a == null || b == null) {
      c.hata = c.fn + ' bulunamadı (' + (a == null ? c.from : c.to) + ')';
      return true;
    }
    return c.kip === 'davranis' ? YORUM_BOSLUK(a) !== YORUM_BOSLUK(b) : a !== b;
  });
}

// ── Hesabı verilmemiş kopya var mı? ───────────────────────────────────────
//
// Görüntüleyiciye özgü bir dosyadaki bir üst-seviye fonksiyonun adı js/
// altında da geçiyorsa, o ad ya izlenen bir kopyadır (CARRIED) ya da bilerek
// ayrıdır (AYRIK). İkisinde de yoksa: ya yeni bir elden taşıma yapılmış ve
// izlenmiyor, ya da bir ad çakışması var. İkisi de sessiz kalmamalı.
function ustSeviyeFonksiyonlar(src) {
  var re = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm, out = [], m;
  while((m = re.exec(src))) out.push(m[1]);
  return out;
}

function hesapsizKopyalar() {
  var jsAdlari = {};
  fs.readdirSync(path.join(ROOT, 'js')).filter(function(f) { return f.endsWith('.js'); })
    .forEach(function(f) {
      var s = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
      ustSeviyeFonksiyonlar(s).forEach(function(n) { if(!(n in jsAdlari)) jsAdlari[n] = 'js/' + f; });
    });

  var izlenen = {};
  CARRIED.forEach(function(c) { izlenen[c.fn] = 1; });
  AYRIK.forEach(function(a) { izlenen[a.fn] = 1; });

  var eksik = [];
  VIEWER_OZGU.forEach(function(f) {
    var yol = path.join(VIEWER, 'js', f);
    if(!fs.existsSync(yol)) return;
    ustSeviyeFonksiyonlar(fs.readFileSync(yol, 'utf8')).forEach(function(n) {
      if(jsAdlari[n] && !izlenen[n]) eksik.push({ fn: n, dosya: 'viewer/js/' + f, karsi: jsAdlari[n] });
    });
  });
  return eksik;
}

// ── Ters yön: viewer/js altındaki her dosyanın hesabı veriliyor mu? ───────
function hesapsizDosyalar() {
  var izlenen = VERBATIM.concat(['trace-view.js'], VIEWER_OZGU);
  return fs.readdirSync(path.join(VIEWER, 'js'))
    .filter(function(f) { return f.endsWith('.js'); })
    .filter(function(f) { return izlenen.indexOf(f) === -1; });
}

// ── Yürüt ─────────────────────────────────────────────────────────────────
var hedefler = VERBATIM.map(function(f) {
  return { ad: f, icerik: fs.readFileSync(path.join(ROOT, 'js', f), 'utf8') };
});
hedefler.push({ ad: 'trace-view.js', icerik: buildTraceView() });

var hesapsizD = hesapsizDosyalar();
if(hesapsizD.length) {
  console.error('✗ HESABI VERİLMEMİŞ GÖRÜNTÜLEYİCİ DOSYASI: ' + hesapsizD.join(', '));
  console.error('  viewer/js altındaki her dosya ya izlenen bir kopya (VERBATIM /');
  console.error('  trace-view.js) ya da görüntüleyiciye özgü (VIEWER_OZGU) olmalı.');
  console.error('  js/\'ten kopyalandıysa VERBATIM\'e, görüntüleyiciye özgüyse');
  console.error('  VIEWER_OZGU\'ye ekleyin — yoksa sonsuza dek senkron dışı kalır.');
  process.exit(1);
}

var hesapsizF = hesapsizKopyalar();
if(hesapsizF.length) {
  hesapsizF.forEach(function(x) {
    console.error('✗ HESABI VERİLMEMİŞ FONKSİYON: ' + x.fn + '  (' + x.dosya +
                  ' ↔ ' + x.karsi + ')');
  });
  console.error('  Aynı ad iki tarafta da üst-seviyede duruyor. Elden taşınmış bir');
  console.error('  kopyaysa viewer/sync.js CARRIED listesine ekleyin (izlensin);');
  console.error('  bilerek ayrı yazıldıysa AYRIK listesine ekleyin (hesabı verilsin).');
  process.exit(1);
}

var kayan = carriedDrift();
if(kayan.length) {
  kayan.forEach(function(c) {
    console.error('✗ ELDEN TAŞINAN FONKSİYON AYRIŞMIŞ: ' + c.fn +
                  '  (' + c.from + ' → ' + c.to + ')');
    console.error('  ' + (c.hata || 'Gövdeler birebir değil.') +
                  '  Sebep: ' + c.neden);
    console.error('  Bu otomatik taşınmaz — çevreleyen dosya görüntüleyiciye ait.');
    console.error('  ' + c.from + ' içindeki sürümü okuyup ' + c.to + '\'e ELLE taşıyın.');
  });
  process.exit(1);
}

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
