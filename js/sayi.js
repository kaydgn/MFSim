/**
 * sayi.js — TEK SAYI YAZICISI (kullanıcı kararı 7·C, 2026-09-26)
 * ───────────────────────────────────────────────────────────────────────────
 * Ekrana, tuvale, günlüğe ve indirilen belgeye giden sayı Türkçe yazılır:
 * ondalık VİRGÜL, binlik NOKTA — 1.716,2. Karar sayfasındaki ölçüm: 213 sayı
 * noktalı (1716.2), 17 sayı virgüllü (1714,6), aynı modülde ikisi birden;
 * günlük hız oranını "1.090" yazıyordu, Türkçe okuyan onu "bin doksan" okur.
 *
 * MAKİNE BİÇİMİ DEĞİŞMEZ: girdi alanının değeri, CSV, JSON, dosya adı ve
 * SVG yol verisi `toFixed` ile noktalı kalır; satır `// makine: <sebep>`
 * taşır (kapı: tests/unit/sayi-dili.test.js).
 *
 * GİRDİ ALANINA GRUPLAMASIZ yazılır ({ binlik: false }): gruplanmış TAM SAYI
 * ("1.800") okurken bin sekiz yüz mü, bir virgül sekiz mi belli değildir ve
 * okuyucu (veSayiOku) onu bugünkü gibi 1,8 okur — sessiz bin kat hata.
 * Okuyucu virgülsüz noktayı bilerek ONDALIK sayar: dişli oranı "1.000",
 * "2.480" bugün böyle yazılıyor. Ondalık taşıyan gruplu sayı ("1.716,2")
 * belirsiz değildir — virgül binliği belirler.
 *
 * Ölçüm Görüntüleyici'de BİREBİR kopya (viewer/sync.js); js/ikon.js gibi
 * yükleyiciden önce yüklenir.
 */

// v → "1.716,2". basamak: ondalık hane (verilmezse sayının kendisi, en çok 6).
// opt.binlik (varsayılan true) · opt.eksi (varsayılan '-'; belgeler '−') ·
// opt.isaret (true → pozitifte de '+'). Sayı değilse '—'.
function veSayi(v, basamak, opt) {
  opt = opt || {};
  var n = (typeof v === 'number') ? v : (v === null || v === '' ? NaN : Number(v));
  if(!isFinite(n)) return '—';
  var s = (basamak == null) ? String(+n.toFixed(6)) : n.toFixed(basamak);   // makine: yazıcının kendisi
  if(s.indexOf('e') >= 0) return veSayiUstel(n, 2, opt);
  var neg = s.charAt(0) === '-';
  if(neg) s = s.slice(1);
  // "-0,0" yazılmaz: yuvarlanınca sıfıra inen eksi sayı işaretini bırakır
  if(neg && /^[0.]+$/.test(s)) neg = false;
  var p = s.split('.'), tam = p[0];
  if(opt.binlik !== false) tam = tam.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  var out = (p.length > 1) ? tam + ',' + p[1] : tam;
  if(neg) return (opt.eksi || '-') + out;
  return (opt.isaret && n > 0 ? '+' : '') + out;
}

// Üstel yazım, ondalığı virgül: 1,23e-4 (çok küçük eksen/imleç değerleri).
function veSayiUstel(v, basamak, opt) {
  var n = Number(v);
  if(!isFinite(n)) return '—';
  var s = n.toExponential(basamak == null ? 2 : basamak).replace('.', ',');   // makine: yazıcının kendisi
  if(s.charAt(0) === '-' && opt && opt.eksi) s = opt.eksi + s.slice(1);
  return s;
}

// Girdi → sayı. "63,5" · "63.5" · "1.716,2" · "1716,2" · " −2,5 " okunur.
// Virgül VARSA noktalar binliktir, YOKSA nokta ondalıktır (bugünkü davranış).
// Boş ya da bozuk → NaN.
function veSayiOku(s) {
  if(typeof s === 'number') return s;
  var t = String(s == null ? '' : s).trim().replace(/[−‒–]/g, '-').replace(/\s/g, '');
  if(!t) return NaN;
  if(t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
  if(!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
  return parseFloat(t);
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veSayi: veSayi, veSayiUstel: veSayiUstel, veSayiOku: veSayiOku };
}
