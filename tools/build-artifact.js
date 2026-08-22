#!/usr/bin/env node
/**
 * MFSim → Artifact gövde varyantı
 *
 *   MFSim_Code.html  →  MFSim_Artifact.html
 *
 * NEDEN VAR: kullanıcının ağı GitHub'a da GitHub Pages'e de çıkamıyor; çalışan
 * tek kanal claude.ai. Program açılışta SIFIR ağ isteği yaptığı için (ölçüldü:
 * 0 istek, 0 konsol hatası) barındırma yeri serbest — tek dosyayı claude.ai'ın
 * Artifact sayfası olarak yayınlıyoruz.
 *
 * NEDEN AYRI BİR VARYANT: Artifact sayfayı KENDİ iskeletine sarıyor
 * (<!doctype><html><head>…</head><body>). Tam bir HTML belgesi göndermek iç içe
 * html/head/body üretirdi — tarayıcı çoğunu kurtarır ama davranış tanımsızdır.
 * Bu betik sarmalayıcıyı söküp gövdeyi teslim eder.
 *
 * GİRDİSİ ÜRETİLMİŞ MONOLİT: build.js'in bütün kalkanları (shieldScriptEnd),
 * gömmeleri (vendor/css/js/örnekler) ve yapısal doğrulamaları zaten koşmuş
 * oluyor. İkinci bir gömme yolu açsaydık iki yol sessizce ayrışırdı.
 *
 * Kullanım: node tools/build-artifact.js   (npm run build:artifact)
 */

var fs = require('fs');
var path = require('path');
var SHIELD = require('../build-shield.js');

var ROOT = path.join(__dirname, '..');
var INPUT = path.join(ROOT, 'MFSim_Code.html');
var OUTPUT = path.join(ROOT, 'MFSim_Artifact.html');

// Artifact sayfası 16 MB'ı geçemez. Sınıra değil, sınırın ALTINA bakıyoruz ki
// büyüme fark edilsin (Yapısal Analiz'in WASM'ları geldiğinde bu kapı çalar).
var BOYUT_SINIRI = 16 * 1024 * 1024;

// Artifact yalnız dosyanın İLK 8 KB'ını <title> için tarar.
var TITLE_TARAMA = 8 * 1024;

// Pages deploy'u bunları _site'a kopyaladığı için monolitte göreli başvuru
// olarak DURUYORLAR (bkz. build.js IZINLI_DIS_KAYNAK). Artifact'te böyle bir
// kopyalama yok → 404. Sessiz 404 bırakmak yerine referansı düşürüyoruz.
var DUSURULEN_LINKLER = [/<link\s+rel="manifest"[^>]*>\s*/gi, /<link\s+rel="icon"[^>]*>\s*/gi];

// ─────────────────────────────────────────────────────────────────────────────
// Saf çekirdek — testler bunu çağırır (dosya sistemi yok)
// ─────────────────────────────────────────────────────────────────────────────

// Monolitteki CSS'ten MFSim'in tema kimliklerini çıkarır.
//
// NEDEN ÇIKARIYORUZ, NEDEN ELLE YAZMIYORUZ: aşağıdaki tema koruması bu listeye
// dayanıyor. Elle yazılmış bir liste, css'e yeni bir tema eklendiği gün sessizce
// eksik kalır ve o tema artifact'te "yabancı değer" sayılıp geri alınırdı —
// yani yeni tema seçilemezdi ve sebebi hiçbir yerde görünmezdi.
function temalariCikar(html) {
  var set = {};
  SHIELD.styleBodies(html).forEach(function (css) {
    var re = /\[data-theme="([a-z0-9-]+)"\]/gi, m;
    while ((m = re.exec(css))) set[m[1]] = true;
  });
  return Object.keys(set).sort();
}

// documentElement'in data-theme'ini MFSim'e geri kazandıran shim.
//
// ÇAKIŞMA: MFSim 16 temayı documentElement'in data-theme'ine yazıyor
// (js/theme.js + index.html'deki ilk-boyama betiği). Artifact görüntüleyicisi
// de İZLEYİCİNİN tema tercihini AYNI özniteliğe damgalıyor ("dark"/"light").
// İzleyici claude.ai temasını değiştirdiği anda MFSim'in paleti kayboluyor:
// css'teki [data-theme="slate"] gibi kuralların hiçbiri tutmuyor, program
// değişkensiz kalıyor.
//
// Çözüm MFSim'in kendi kodunu DEĞİŞTİRMİYOR (css/ ve js/theme.js'e sıfır
// dokunuş, yani Pages sürümü sıfır risk alıyor): yabancı bir değer yazıldığında
// gözlemci son geçerli MFSim temasını geri koyuyor. Değer MFSim'in listesindeyse
// hiçbir şey yapmıyor — kullanıcının tema seçimi normal çalışıyor.
function temaKorumasi(temalar, varsayilan) {
  return [
    '(function(){',
    '  var GECERLI = ' + JSON.stringify(temalar) + ';',
    '  var VARSAYILAN = ' + JSON.stringify(varsayilan) + ';',
    '  var kok = document.documentElement;',
    '  function gecerliMi(v){ return GECERLI.indexOf(v) !== -1; }',
    '  var son = VARSAYILAN;',
    '  try { var kayit = localStorage.getItem("mf-theme"); if (kayit && gecerliMi(kayit)) son = kayit; } catch(e){}',
    '  kok.setAttribute("data-theme", son);',
    '  if (typeof MutationObserver !== "function") return;',
    '  new MutationObserver(function(){',
    '    var simdi = kok.getAttribute("data-theme");',
    '    if (gecerliMi(simdi)) { son = simdi; return; }   // MFSim kendi temasını değiştirdi',
    '    kok.setAttribute("data-theme", son);             // artifact host damgaladı → geri al',
    '  }).observe(kok, { attributes: true, attributeFilter: ["data-theme"] });',
    '})();'
  ].join('\n');
}

// Monolitik belgeyi Artifact gövdesine çevirir.
function donustur(html) {
  var hataOnEk = 'build-artifact: ';

  // Etiketler HAM metinde değil, KONUM KORUYAN MASKEDE aranır: "</body>" ve
  // kardeşleri JS gövdelerinin içinde de geçiyor (rapor üreticileri HTML
  // şablonu basıyor — ölçüldü: üçünün de 3 kopyası var, 2'si sahte). Ham
  // metinde "ilk eşleşme" gövdeyi 425 KB'ta kesiyor ve 80 script'in 9'u
  // görünüyordu. Maske gövdeleri boşluğa çevirdiği için indisler ham metinde
  // aynen geçerli.
  var maske = SHIELD.maskRawTextKeepOffsets(html);

  function tekEslesme(re, ad) {
    var r = new RegExp(re.source, 'gi'), m, bulunan = [];
    while ((m = r.exec(maske))) bulunan.push(m);
    if (bulunan.length !== 1) {
      throw new Error(hataOnEk + ad + ' etiketi maskede ' + bulunan.length +
        ' kez geçiyor — tam 1 bekleniyordu');
    }
    return bulunan[0];
  }

  var headAc = tekEslesme(/<head\b[^>]*>/, '<head>');
  var headKapa = tekEslesme(/<\/head\s*>/, '</head>');
  var bodyAcM = tekEslesme(/<body\b([^>]*)>/, '<body>');
  var bodyKapa = tekEslesme(/<\/body\s*>/, '</body>').index;
  // Öznitelikleri HAM metinden oku (maskede yalnız konum güvenilir).
  var bodyAc = /<body\b([^>]*)>/i.exec(html.slice(bodyAcM.index, bodyAcM.index + bodyAcM[0].length));

  var htmlAc = tekEslesme(/<html\b([^>]*)>/, '<html>');
  var lang = (/lang="([^"]*)"/i.exec(htmlAc[1]) || [])[1] || null;

  // <body> özniteliği BUGÜN YOK (index.html'de düz "<body>"). Biri eklerse
  // sessizce düşürmek css'i sessizce bozardı — durup söylüyoruz. Taşımanın
  // doğru yeri artifact'in kendi <body>'si; o zaman burası shim'e yazacak.
  var bodyAttrs = ((bodyAc && bodyAc[1]) || '').trim();
  if (bodyAttrs) {
    throw new Error(hataOnEk + '<body ' + bodyAttrs + '> özniteliği taşınmıyor — ' +
      'shim\'e document.body.setAttribute ekleyin');
  }

  var head = html.slice(headAc.index + headAc[0].length, headKapa.index);
  var body = html.slice(bodyAcM.index + bodyAcM[0].length, bodyKapa);

  // <title> başa alınacak — head'den söküyoruz ki iki kez geçmesin.
  var titleM = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head);
  if (!titleM) throw new Error(hataOnEk + 'girdide <title> yok');
  // Artifact galerisinde başlık bir AD'dır, özet değil: kart zaten ayrı bir
  // açıklama satırı taşıyor. Belgenin kendi başlığı "MFSim — Araç Performans
  // Simülasyonu" biçiminde (ad + uzun tire + açıklama); galeriye yalnız adı
  // veriyoruz, tarayıcı sekmesinde de okunması gereken şey zaten o.
  var title = titleM[1].trim().split(/\s+—\s+/)[0].trim();
  head = head.replace(titleM[0], '');

  DUSURULEN_LINKLER.forEach(function (re) { head = head.replace(re, ''); });

  var temalar = temalariCikar(html);
  var varsayilan = (/data-theme="([^"]*)"/i.exec(htmlAc[1]) || [])[1] || temalar[0];
  if (temalar.indexOf(varsayilan) === -1) {
    throw new Error(hataOnEk + 'varsayılan tema "' + varsayilan + '" css\'teki tema listesinde yok');
  }

  var shim = [
    '// ═══ ARTIFACT ORTAM SHIM\'İ — tools/build-artifact.js üretti ═══',
    '// 1) Ortam bayrağı: js/env.js bunu okuyup ağa bağlı özellikleri kapatıyor.',
    '//    EN ÖNDE olmak zorunda — arkasındaki hiçbir modül bayraksız koşmasın.',
    'window.MFSIM_ENV = "artifact";',
    lang ? 'document.documentElement.setAttribute("lang", ' + JSON.stringify(lang) + ');' : '',
    '// 2) Tema koruması (aşağıdaki yorumun gerekçesi: data-theme çakışması).',
    temaKorumasi(temalar, varsayilan)
  ].filter(Boolean).join('\n');

  return '<title>' + title + '</title>\n' +
    '<script>\n' + shim + '\n</script>\n' +
    head.trim() + '\n' +
    body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Yapısal doğrulama — bozuk dosya yayınlanmasın
// ─────────────────────────────────────────────────────────────────────────────
function dogrula(cikti, girdi) {
  var hatalar = [];

  // (a) Sarmalayıcı etiket kalmamalı. maskRawText script/style GÖVDELERİNİ
  //     boşaltıyor: JS dizgesi içindeki "<body …>" metnine takılmıyoruz —
  //     böyle metinler gerçekten var (build.js'in replacer testleri).
  var maskeli = SHIELD.maskRawText(cikti);
  if (/<!doctype/i.test(maskeli)) hatalar.push('<!doctype> kaldı');
  ['html', 'head', 'body'].forEach(function (etiket) {
    var re = new RegExp('<\\/?' + etiket + '\\b', 'i');
    if (re.test(maskeli)) hatalar.push('<' + etiket + '> etiketi kaldı');
  });

  // (b) <title> ilk 8 KB'ta olmalı — artifact yalnız orayı tarıyor.
  var tIdx = cikti.indexOf('<title>');
  if (tIdx === -1) hatalar.push('<title> yok');
  else if (tIdx >= TITLE_TARAMA) hatalar.push('<title> ilk 8 KB dışında (' + tIdx + ')');

  // (c) Script/style blokları erken kapanmamalı. Beklenen sayı: girdininki
  //     + bizim eklediğimiz shim betiği. Kaçak bir '</script' bu sayıyı kaydırır.
  // Sayaçlar scanDocument'ten: countScriptElements/styleBodies HAM dizi sayar ve
  // rapor üreticilerinin JS içinde bastığı <style>/<script> şablonlarını da
  // sayardı (ölçüldü: style 4 yerine 9). scanDocument yapısal olarak tarıyor.
  var girdiDoc = SHIELD.scanDocument(girdi);
  var beklenenScript = girdiDoc.scripts + 1;   // + shim betiği
  var beklenenStyle = girdiDoc.styles;
  var blokHata = SHIELD.verifyScriptBlocks(cikti, beklenenScript, beklenenStyle);
  if (blokHata) hatalar.push(blokHata);

  // (d) Boyut
  var bayt = Buffer.byteLength(cikti, 'utf8');
  if (bayt > BOYUT_SINIRI) {
    hatalar.push('boyut ' + (bayt / 1048576).toFixed(2) + ' MB — artifact sınırı 16 MB');
  }

  return { hatalar: hatalar, bayt: bayt, script: beklenenScript, style: beklenenStyle };
}

module.exports = { donustur: donustur, dogrula: dogrula, temalariCikar: temalariCikar, temaKorumasi: temaKorumasi };

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  if (!fs.existsSync(INPUT)) {
    console.error('\n✗ MFSim_Code.html yok — önce `npm run build` çalıştırın.\n');
    process.exit(1);
  }
  var girdi = fs.readFileSync(INPUT, 'utf8');
  var cikti;
  try {
    cikti = donustur(girdi);
  } catch (e) {
    console.error('\n✗ ' + e.message + '\n');
    process.exit(1);
  }

  var r = dogrula(cikti, girdi);
  if (r.hatalar.length) {
    console.error('\n✗ Artifact varyantı doğrulamayı geçemedi:');
    r.hatalar.forEach(function (h) { console.error('    ' + h); });
    console.error('');
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT, cikti, 'utf8');
  console.log('  Tema koruması: ' + temalariCikar(girdi).length + ' tema kimliği css\'ten çıkarıldı');
  console.log('  Yapısal doğrulama: ' + r.script + ' script + ' + r.style + ' style bloğu, sarmalayıcı etiket yok');
  console.log('\n✓ MFSim_Artifact.html oluşturuldu (' + (r.bayt / 1048576).toFixed(2) + ' MB / 16 MB sınırı — %' +
    ((r.bayt / BOYUT_SINIRI) * 100).toFixed(0) + ')');
}
