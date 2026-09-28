// ═══════════════════════════════════════════════════════════════════════════════
// SONUÇ TABLOSU (FÖY) — Sonuçlar penceresinin "Tablo" kipi
//
// Kullanıcı seçimi (2026-09-28, tasarım tuvalindeki "C · Föy"): tablo bir rapor
// sayfası gibi durur — kâğıt, başlık, kalın üst/alt çizgi, ince ara çizgi,
// dört satırda bir nefes payı. Sayılar MÜREKKEP renginde; sinyalin rengi yalnız
// adının yanındaki noktada. Önceki tablonun ölçülen kusurları ve kapıları:
// docs/decisions/ortak-yuzeyler.md → "Sonuçlar tablosu föydür".
//
// TEK ÜRETİCİ. MFSim (js/graphics.js → veRenderTable) ve Ölçüm Görüntüleyici
// (viewer/js/board.js) bu dosyayı BİREBİR paylaşır (viewer/sync.js). Veri
// ÇÖZÜMÜ burada YOK: her program kendi kaynağından bir MODEL kurar
// (veFoyModel), bu dosya onu yazar, panoya kopyalar ve CSV'ye döker.
//
//   model = { baslik, kaynak,
//             x:        { ad, birim, veri: [] },
//             sutunlar: [{ ad, birim, renk, veri: [] | null }] }
//
// Saf yardımcılar (ondalık, seyreltme, özet, metin dökümü) Jest'te doğrudan
// test edilir: tests/unit/sonuc-tablo.test.js.
// ═══════════════════════════════════════════════════════════════════════════════

// Ekranda en çok bu kadar satır (DOM bedeli). Uzun seri seyreltilir ve bu
// SÖYLENİR (föyün not satırı); Kopyala ve CSV her zaman TÜM örnekleri alır.
var VE_FOY_AZAMI = 200;

function _veFoyKac(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Hücre değeri sayı mı? Sayıysa sayının kendisi, değilse null. İçe aktarılan
// ölçüm sayıyı metin olarak da taşıyabilir ("12"); vites kipi '1C' metindir.
function _veFoySayi(v) {
  if(typeof v === 'number') return isFinite(v) ? v : null;
  if(typeof v === 'string' && /^\s*[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i.test(v)) return Number(v);
  return null;
}

// Gösterilecek satırlar: her k. örnek ve SON örnek (seyreltme sonu atlarsa
// tablonun sonu serinin sonu sanılırdı). Dönüş: { idx: [...], adim: k }.
function veFoySeyrelt(n, azami) {
  azami = azami || VE_FOY_AZAMI;
  var adim = Math.max(1, Math.floor(n / azami));
  var idx = [];
  for(var i = 0; i < n; i += adim) idx.push(i);
  if(n > 0 && idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  return { idx: idx, adim: adim };
}

// Sayı bu ondalık hanede TAM mı? (ölçüm dosyasının 812,25'i iki hane taşır)
// Pay kayan noktanın kendi hatası kadardır (|s|·1e-12): göreli 1e-7 payı
// 1.380,838'i "dört hanede tam" sayıyordu — ölçüldü, tablo 1.380,8378 yazdı.
function _veFoyTam(v, d) {
  var s = v * Math.pow(10, d);
  return Math.abs(s - Math.round(s)) <= 1e-9 + Math.abs(s) * 1e-12;
}

// SÜTUNUN ondalık sayısı — bütün sütun için TEK sayı, virgüller alt alta gelir.
// Eskiden hane DEĞER BAŞINA seçiliyordu (99,50 ile 100,2 alt alta düşer) ve X
// sütunu her zaman üç hane yazıyordu (880,000).
//   • sayı yok (metin kanalı, veri yok) → null
//   • BÜYÜKLÜKTEN: ≥10.000 → 0 · ≥100 → 1 · ≥1 → 2 · ≥0,01 → 3,
//     daha küçük sütun → -1 (değer başına, üstel yazım)
//   • sütunun hepsi daha az hanede TAM ise KIRPILIR (tam sayı → 0; 2,7 → 1)
//   • daha çok hanede tamsa UZAR — ama yalnız en az üç FARKLI değer varsa:
//     ölçüm dosyasının kendi hassasiyeti (812,25) korunur, sabit bir sütunun
//     rastlantısal ikili kesri (543,875) komşusundan farklı yazılmaz (ölçüldü)
// `gosterilen` verilirse (X sütunu) ekranda ARDIŞIK iki satır aynı yazılamaz:
// hane, ayrışana dek artar (en çok 6).
function veFoyOndalik(veri, gosterilen) {
  var say = [], i, s;
  for(i = 0; veri && i < veri.length; i++) {
    s = _veFoySayi(veri[i]);
    if(s !== null) say.push(s);
  }
  if(!say.length) return null;
  var m = 0, farkli = [];
  for(i = 0; i < say.length; i++) {
    if(Math.abs(say[i]) > m) m = Math.abs(say[i]);
    if(farkli.length < 3 && farkli.indexOf(say[i]) < 0) farkli.push(say[i]);
  }
  var buyukluk = m >= 10000 ? 0 : m >= 100 ? 1 : m >= 1 ? 2 : m >= 0.01 ? 3 : -1;
  var tam = -1, k, hepsi;
  for(k = 0; k <= 4 && tam < 0; k++) {
    hepsi = true;
    for(i = 0; i < say.length; i++) if(!_veFoyTam(say[i], k)) { hepsi = false; break; }
    if(hepsi) tam = k;
  }
  var d = buyukluk;
  if(tam >= 0 && (buyukluk < 0 || tam <= buyukluk || farkli.length >= 3)) d = tam;
  if(gosterilen && d >= 0) {
    while(d < 6 && _veFoyCakisir(veri, gosterilen, d)) d++;
  }
  return d;
}

// Ekranda alt alta duran iki FARKLI değer bu hanede aynı mı yazılıyor?
function _veFoyCakisir(veri, idx, d) {
  var onceki = null, a;
  for(var j = 0; j < idx.length; j++) {
    a = _veFoySayi(veri[idx[j]]);
    if(a === null) { onceki = null; continue; }
    if(onceki !== null && a !== onceki && a.toFixed(d) === onceki.toFixed(d)) return true;   // makine: karşılaştırma, ekrana gitmez
    onceki = a;
  }
  return false;
}

// Sütun özeti — yalnız SAYISAL değerlerden; sayı yoksa null (metin kanalı
// '1C'/'2L' özet satırında '—' yazar, tablo patlamaz).
function veFoyOzet(veri) {
  var n = 0, top = 0, mn = Infinity, mx = -Infinity, s;
  for(var i = 0; veri && i < veri.length; i++) {
    s = _veFoySayi(veri[i]);
    if(s === null) continue;
    n++; top += s;
    if(s < mn) mn = s;
    if(s > mx) mx = s;
  }
  return n ? { min: mn, ort: top / n, maks: mx, n: n } : null;
}

// Tek hücrenin metni. d: sütunun ondalığı (veFoyOndalik); -1 → değer başına.
function veFoyHucre(v, d) {
  var s = _veFoySayi(v);
  if(s === null) {
    return (v === null || v === undefined || v === '' || typeof v === 'number') ? '—' : _veFoyKac(String(v));
  }
  if(d === null || d === undefined || d < 0) {
    return (typeof veFormatTooltipVal === 'function') ? veFormatTooltipVal(s) : veSayi(s);
  }
  return veSayi(s, d, { eksi: '−' });
}

// "Motor devri [d/dk]" + "d/dk" → "Motor devri": birim föyde kendi satırında.
function veFoyAd(ad, birim) {
  var a = String(ad == null ? '' : ad);
  if(birim) a = a.split(' [' + birim + ']').join('');
  return a.trim();
}

// Föyün not satırı: kaç satır gösteriliyor ve seyreltme var mı. Eskiden
// seyreltme SESSİZDİ — "#" sütunu 1, 2, 3 diye saydığı için 5.001 örnekli bir
// seride her 25. örneğin gösterildiği hiçbir yerde görünmüyordu.
function veFoyNot(n, sey) {
  if(!sey || sey.adim <= 1) return 'Satır: ' + veSayi(n, 0) + ' · tamamı';
  return 'Satır: ' + veSayi(sey.idx.length, 0) + ' / ' + veSayi(n, 0) +
         ' · her ' + veSayi(sey.adim, 0) + '. örnek gösteriliyor — Kopyala ve CSV tamamını alır';
}

// Sinyal rengi VERİDİR (kullanıcı seçebiliyor): yalnız renk sözdizimi geçer.
function _veFoyRenk(r) {
  r = String(r == null ? '' : r).trim();
  return /^#[0-9a-f]{3,8}$/i.test(r) || /^(rgb|rgba|hsl|hsla)\([0-9.,%\s]+\)$/i.test(r) ? r : '';
}

function _veFoyTh(ad, birim, renk) {
  var h = '<th scope="col"><span class="ve-foy-sad">';
  var c = _veFoyRenk(renk);
  if(c) h += '<span class="ve-foy-nokta" style="background:' + c + '"></span>';
  // "·" önceki sözcüğe bağlanır: kırılma ondan SONRA olur ("FAN → AVA1 ·" /
  // "gerginlik") — önce olunca ikinci satır "· gerginlik" diye başlıyordu.
  h += _veFoyKac(veFoyAd(ad, birim)).replace(/ · /g, '\u00a0· ') + '</span>';
  if(birim) h += '<span class="ve-foy-birim">(' + _veFoyKac(birim) + ')</span>';
  return h + '</th>';
}

// Föyün tamamı: kâğıt, başlık ve tablo. Kimlikler eski yüzeyle AYNI
// (#ve-table-N · #ve-table-body-N) — e2e kapıları ve dış çağrılar onları okur.
function veFoyHTML(model, slotIdx) {
  model = model || {};
  var id = (slotIdx == null) ? 0 : slotIdx;
  var x = model.x || { ad: '', birim: '', veri: [] };
  var xv = x.veri || [];
  var n = xv.length;
  var sey = veFoySeyrelt(n);
  var xd = veFoyOndalik(xv, sey.idx);
  var kol = (model.sutunlar || []).map(function(s) {
    return { s: s, d: veFoyOndalik(s.veri), oz: veFoyOzet(s.veri) };
  });

  var h = '<div class="ve-foy">';
  h += '<div class="ve-foy-baslik"><span class="ve-foy-ad">' + _veFoyKac(model.baslik || 'Sonuç tablosu') + '</span>';
  if(model.kaynak) h += '<span class="ve-foy-kaynak">' + _veFoyKac(model.kaynak) + '</span>';
  h += '</div>';

  h += '<table class="ve-foy-tablo" id="ve-table-' + id + '">';
  h += '<thead><tr>' + _veFoyTh(x.ad, x.birim, null);
  kol.forEach(function(k) { h += _veFoyTh(k.s.ad, k.s.birim, k.s.renk); });
  h += '</tr></thead>';

  h += '<tbody id="ve-table-body-' + id + '">';
  sey.idx.forEach(function(i, r) {
    // Dört satırda bir nefes payı: çizgisiz tabloda göz satırı böyle izler
    h += (r > 0 && r % 4 === 0) ? '<tr class="ve-foy-grup">' : '<tr>';
    h += '<td>' + veFoyHucre(xv[i], xd) + '</td>';
    kol.forEach(function(k) {
      h += '<td>' + veFoyHucre((k.s.veri && i < k.s.veri.length) ? k.s.veri[i] : null, k.d) + '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody>';

  // Özet ve not YAPIŞIK (CSS): uzun tabloda sona kaydırmadan görünür.
  h += '<tfoot>';
  [['En düşük', 'min'], ['Ortalama', 'ort'], ['En yüksek', 'maks']].forEach(function(o, j) {
    h += '<tr class="ve-foy-ozet ve-foy-ozet-' + (j + 1) + '"><th scope="row">' + o[0] + '</th>';
    kol.forEach(function(k) {
      // Tam sayı sütununun ortalaması tam sayı değildir (vites 3,5): bir hane
      var d = (o[1] === 'ort' && k.d === 0) ? 1 : k.d;
      h += '<td>' + (k.oz ? veFoyHucre(k.oz[o[1]], d) : '—') + '</td>';
    });
    h += '</tr>';
  });
  h += '<tr class="ve-foy-not"><td colspan="' + (kol.length + 1) + '">' + _veFoyKac(veFoyNot(n, sey)) + '</td></tr>';
  h += '</tfoot></table></div>';
  return h;
}

// Metin dökümü — TÜM örnekler (seyreltme yalnız ekranın).
//   'pano': sekme ayraçlı, ondalık VİRGÜL, grupsuz — Türkçe Excel'e yapıştırılır.
//           Noktalı "1380.8" Türkçe Excel'de BİNLİK okunur: sessiz bin kat hata.
//   'csv' : ';' ayraçlı, ondalık NOKTA — makine biçimi (karar 7·C).
function veFoyMetin(model, kip) {
  var csv = (kip === 'csv');
  var ayrac = csv ? ';' : '\t';
  function metin(t) {
    t = String(t);
    if(csv) return /[";\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    return t.replace(/[\t\r\n]+/g, ' ');
  }
  function hucre(v) {
    var s = _veFoySayi(v);
    if(s !== null) {
      var m = String(+s.toPrecision(12));   // makine: dışa aktarma — tam hassasiyet, kayan nokta artığı atılır
      return csv ? m : m.replace('.', ',');
    }
    return (v === null || v === undefined || typeof v === 'number') ? '' : metin(v);
  }
  function baslik(ad, birim) {
    var a = veFoyAd(ad, birim);
    return metin(birim ? a + ' [' + birim + ']' : a);
  }
  var x = (model && model.x) || { veri: [] };
  var xv = x.veri || [];
  var sut = (model && model.sutunlar) || [];
  var satir = [[baslik(x.ad, x.birim)].concat(sut.map(function(s) { return baslik(s.ad, s.birim); })).join(ayrac)];
  for(var i = 0; i < xv.length; i++) {
    var r = [hucre(xv[i])];
    for(var k = 0; k < sut.length; k++) {
      r.push(hucre((sut[k].veri && i < sut[k].veri.length) ? sut[k].veri[i] : null));
    }
    satir.push(r.join(ayrac));
  }
  return satir.join('\r\n') + '\r\n';
}

// Dosya adı başlıktan: Türkçe harf ASCII'ye iner (dosya sistemi, e-posta eki).
function veFoyDosyaAdi(model, simdi) {
  var tr = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
             'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
  var ad = String((model && model.baslik) || 'Tablo')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, function(c) { return tr[c]; })
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Tablo';
  var t = simdi || new Date();
  var p = function(v) { return String(v).padStart(2, '0'); };
  return 'MFSim_Tablo_' + ad + '_' + t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()) +
         '_' + p(t.getHours()) + p(t.getMinutes()) + '.csv';
}

// ── Araç çubuğunun iki eylemi (js/trace-view.js → Tablo kipi) ────────────────

function _veFoySimdiki() {
  var slot = (typeof VE_BOARD !== 'undefined') ? VE_BOARD : 0;
  return (typeof veFoyModel === 'function') ? veFoyModel(slot) : null;
}

function _veFoyUyar(m) {
  if(typeof showToast === 'function') showToast(m, 'warning');
}

// file:// üzerinde navigator.clipboard çoğu tarayıcıda YOK (güvenli bağlam
// değil — js/cp-komuta.js'teki ölçüm). Yedek yol: gizli metin alanı + copy.
function _veFoyEskiPano(metin) {
  var ok = false;
  try {
    var ta = document.createElement('textarea');
    ta.className = 've-foy-pano';
    ta.setAttribute('readonly', '');
    ta.value = metin;
    document.body.appendChild(ta);
    ta.select();
    ok = document.execCommand('copy');
    document.body.removeChild(ta);
  } catch(e) { ok = false; }
  return ok;
}

function veFoyKopyala() {
  var m = _veFoySimdiki();
  if(!m) { _veFoyUyar('Kopyalanacak tablo yok — önce Veri Gezgini\'nden sinyal seçin.'); return; }
  var metin = veFoyMetin(m, 'pano');
  var n = m.x.veri.length;
  var bildir = function(ok) {
    if(!ok) { _veFoyUyar('Pano bu tarayıcıda kullanılamadı — tabloyu CSV ile indirin.'); return; }
    if(typeof showToast === 'function') {
      showToast(veSayi(n, 0) + ' satır panoya kopyalandı — Excel\'e yapıştırabilirsiniz.', 'success');
    }
  };
  try {
    if(typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(metin).then(function() { bildir(true); },
        function() { bildir(_veFoyEskiPano(metin)); });
      return;
    }
  } catch(e) {}
  bildir(_veFoyEskiPano(metin));
}

function veFoyCsvIndir() {
  var m = _veFoySimdiki();
  if(!m) { _veFoyUyar('Dışa aktarılacak tablo yok — önce Veri Gezgini\'nden sinyal seçin.'); return; }
  // BOM: Excel UTF-8'i ancak onunla tanır (başlıkta →, ·, ü var)
  var blob = new Blob(['﻿' + veFoyMetin(m, 'csv')], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = veFoyDosyaAdi(m);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  if(typeof showToast === 'function') {
    showToast('CSV indirildi — ' + veSayi(m.x.veri.length, 0) + ' satır, ' + m.sutunlar.length + ' sinyal.', 'success');
  }
}

// Jest: saf yardımcılar doğrudan test edilebilsin
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FOY_AZAMI: VE_FOY_AZAMI,
    veFoySeyrelt: veFoySeyrelt,
    veFoyOndalik: veFoyOndalik,
    veFoyOzet: veFoyOzet,
    veFoyHucre: veFoyHucre,
    veFoyAd: veFoyAd,
    veFoyNot: veFoyNot,
    veFoyHTML: veFoyHTML,
    veFoyMetin: veFoyMetin,
    veFoyDosyaAdi: veFoyDosyaAdi
  };
}
