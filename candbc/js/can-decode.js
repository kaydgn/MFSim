// ═══════════════════════════════════════════════════════════════════════════
// SİNYAL ÇÖZÜCÜ — bit çıkarma, işaret, ölçekleme, çoklama
// ═══════════════════════════════════════════════════════════════════════════
//
// DOM'suz. Bu dosyanın hata sınıfı SESSİZDİR: bir işaret hatası programı
// durdurmaz, yalnızca yanlış bir eğri çizer. Bu yüzden bit düzeni burada tek
// bir yerde tanımlıdır ve testi referans değerlerle bağlanmıştır.
//
// ── BİT NUMARALANDIRMASI (DBC kuralı) ────────────────────────────────────
// Doğrusal bit konumu = bayt_indeksi * 8 + bayt_içi_bit. Bayt içindeki bit 0
// EN DÜŞÜK anlamlı bittir. Yani 0. bayt için konumlar 0..7, 1. bayt için 8..15.
//
//   @1 (Intel / little endian): startBit sinyalin EN DÜŞÜK anlamlı bitidir;
//      sinyal konum numarası ARTARAK ilerler.
//
//   @0 (Motorola / big endian): startBit sinyalin EN YÜKSEK anlamlı bitidir;
//      sinyal bayt içinde AŞAĞI iner, bayt bitince BİR SONRAKİ baytın 7.
//      bitinden devam eder. Adım kuralı: bit 0'daysak +15, değilse -1.
//
// İkisini tek döngüde "startBit + i" ile yazmak Motorola'yı sessizce bozar —
// en sık görülen DBC hatası budur ve testten geçen bir kod üretir.
//
// ── 53 BİT SINIRI ────────────────────────────────────────────────────────
// Ham değer JavaScript sayısı (IEEE-754 çift duyarlık) olarak taşınıyor; 53
// bitten uzun tam sayılar TAM temsil edilemez. Sınır gizlenmiyor: DBC
// ayrıştırıcısı böyle bir sinyalde uyarı yazıyor (bkz. can-dbc.js).

// Ham bit alanını okur. buf: kare verisinin bulunduğu düz tampon,
// off: karenin tampondaki başlangıcı, len: karenin bayt uzunluğu.
// Kare sınırının dışındaki bitler 0 kabul edilir (kısa DLC'li kare).
function cdbRawBits(buf, off, len, startBit, bitLen, littleEndian) {
  var v = 0, i, byi, bit;
  if (littleEndian) {
    var mul = 1;
    for (i = 0; i < bitLen; i++) {
      var bp = startBit + i;
      byi = bp >> 3;
      bit = (byi < len) ? ((buf[off + byi] >> (bp & 7)) & 1) : 0;
      if (bit) v += mul;
      mul *= 2;
    }
    return v;
  }
  var pos = startBit;
  for (i = 0; i < bitLen; i++) {
    byi = pos >> 3;
    var bi = pos & 7;
    bit = (byi < len) ? ((buf[off + byi] >> bi) & 1) : 0;
    v = v * 2 + bit;
    pos = (bi === 0) ? pos + 15 : pos - 1;
  }
  return v;
}

// İşaretli sinyalde iki-tümleyen çevrimi.
function cdbSignExtend(v, bitLen) {
  var half = Math.pow(2, bitLen - 1);
  return v >= half ? v - 2 * half : v;
}

// IEEE-754 float/double sinyaller için bitleri LSB-önce paketleyip yeniden
// yorumlar. Nadir bir yol olduğu için hız değil DOĞRULUK gözetiliyor.
var CDB_FBUF = new ArrayBuffer(8);
var CDB_FU8  = new Uint8Array(CDB_FBUF);
var CDB_FDV  = new DataView(CDB_FBUF);

function cdbRawFloat(buf, off, len, startBit, bitLen, littleEndian, isDouble) {
  var nb = isDouble ? 8 : 4;
  for (var i = 0; i < 8; i++) CDB_FU8[i] = 0;
  for (var i2 = 0; i2 < bitLen && i2 < nb * 8; i2++) {
    var bit;
    if (littleEndian) {
      var bp = startBit + i2;
      var byi = bp >> 3;
      bit = (byi < len) ? ((buf[off + byi] >> (bp & 7)) & 1) : 0;
      CDB_FU8[i2 >> 3] |= bit << (i2 & 7);
    } else {
      // Motorola: en yüksek anlamlı bitten başlanır; hedefte de öyle yerleşir.
      var pos = startBit, k;
      for (k = 0; k < i2; k++) pos = ((pos & 7) === 0) ? pos + 15 : pos - 1;
      var byi2 = pos >> 3;
      bit = (byi2 < len) ? ((buf[off + byi2] >> (pos & 7)) & 1) : 0;
      var dst = bitLen - 1 - i2;                 // MSB → en yüksek hedef bit
      CDB_FU8[dst >> 3] |= bit << (dst & 7);
    }
  }
  return isDouble ? CDB_FDV.getFloat64(0, true) : CDB_FDV.getFloat32(0, true);
}

// Tek karede tek sinyalin FİZİKSEL değeri. Kare bu sinyali taşımıyorsa
// (çoklama uyuşmazlığı) null döner — 0 DEĞİL: sıfır geçerli bir ölçüm.
function cdbDecodeSignal(buf, off, len, sig) {
  var raw;
  if (sig.valueType === 'float' || sig.valueType === 'double') {
    raw = cdbRawFloat(buf, off, len, sig.startBit, sig.length, sig.littleEndian, sig.valueType === 'double');
    return raw * sig.factor + sig.offset;
  }
  raw = cdbRawBits(buf, off, len, sig.startBit, sig.length, sig.littleEndian);
  if (sig.signed) raw = cdbSignExtend(raw, sig.length);
  return raw * sig.factor + sig.offset;
}

// Çoklama denetimi: sinyal bu karede geçerli mi?
// muxRaw çoklayıcı sinyalin HAM (ölçeklenmemiş) değeridir — SG_MUL_VAL_ ve
// m<n> belirteci ham değere göre tanımlıdır, fiziksele göre değil.
function cdbMuxMatches(sig, muxRaw) {
  if (sig.muxValue === null) return true;          // çoklanmamış sinyal
  if (muxRaw === null) return false;               // çoklayıcı okunamadı
  if (sig.muxRanges) {
    for (var i = 0; i < sig.muxRanges.length; i++) {
      if (muxRaw >= sig.muxRanges[i][0] && muxRaw <= sig.muxRanges[i][1]) return true;
    }
    return false;
  }
  return muxRaw === sig.muxValue;
}

/**
 * Bir sinyalin ZAMAN SERİSİNİ kurar.
 *
 * Girdi bir KANALDIR (bkz. can-match.js), DBC mesajı değil: seri kayıtta
 * gerçekten geçen TEK bir kimliğin kareleri üzerinde kurulur. Aynı mesajı iki
 * ECU gönderiyorsa iki ayrı seri çıkar — birleştirmek iki isteği tek eğriye
 * karıştırmak olurdu.
 *
 * Seri TALEP ÜZERİNE kurulur, kayıt yüklenirken değil: 950 mesajlı bir DBC ile
 * 200 bin kareli bir kayıtta bütün sinyalleri önden çözmek onlarca saniye ve
 * yüzlerce MB demek. Onay kutusu işaretlenince yalnız O sinyal, yalnız KENDİ
 * kanalının kareleri üzerinde çözülür (store.byKey dizini).
 *
 * @returns {{t:Float64Array, v:Float64Array, n, min, max, skipped}}
 */
function cdbBuildSeries(store, ch, sig) {
  var idx = store.byKey[ch.key];
  var msg = ch.msg;
  if (!idx || !idx.length || !msg) return { t: new Float64Array(0), v: new Float64Array(0), n: 0, min: 0, max: 0, skipped: 0 };

  var muxor = (sig.muxValue !== null) ? msg.muxor : null;
  var t = new Float64Array(idx.length);
  var v = new Float64Array(idx.length);
  var n = 0, skipped = 0;
  var lo = Infinity, hi = -Infinity;
  var need = cdbSignalTopBit(sig) / 8;   // sinyalin gerektirdiği bayt sayısı

  for (var i = 0; i < idx.length; i++) {
    var fi = idx[i];
    var off = store.off[fi], len = store.len[fi];
    // Kare bu sinyali taşıyacak kadar uzun değil → sessizce 0 çizmek yerine ATLA.
    if (len < need) { skipped++; continue; }
    if (muxor) {
      var mr = cdbRawBits(store.data, off, len, muxor.startBit, muxor.length, muxor.littleEndian);
      if (muxor.signed) mr = cdbSignExtend(mr, muxor.length);
      if (!cdbMuxMatches(sig, mr)) { skipped++; continue; }
    } else if (sig.muxValue !== null) { skipped++; continue; }
    var val = cdbDecodeSignal(store.data, off, len, sig);
    if (!isFinite(val)) { skipped++; continue; }
    t[n] = store.t[fi];
    v[n] = val;
    if (val < lo) lo = val;
    if (val > hi) hi = val;
    n++;
  }
  return {
    t: t.subarray(0, n), v: v.subarray(0, n), n: n,
    min: n ? lo : 0, max: n ? hi : 0, skipped: skipped
  };
}

// Bir karenin BÜTÜN sinyallerini çözer (kare listesi / imleç rozeti için).
// Çoklama burada da geçerli: kareye ait olmayan sinyal listede GÖRÜNMEZ.
function cdbDecodeFrame(store, msg, frameIndex) {
  var off = store.off[frameIndex], len = store.len[frameIndex];
  var out = [];
  var muxRaw = null;
  if (msg.muxor) {
    muxRaw = cdbRawBits(store.data, off, len, msg.muxor.startBit, msg.muxor.length, msg.muxor.littleEndian);
    if (msg.muxor.signed) muxRaw = cdbSignExtend(muxRaw, msg.muxor.length);
  }
  for (var i = 0; i < msg.signals.length; i++) {
    var sg = msg.signals[i];
    if (!cdbMuxMatches(sg, muxRaw)) continue;
    if (len < cdbSignalTopBit(sg) / 8) continue;
    var val = cdbDecodeSignal(store.data, off, len, sg);
    out.push({ sig: sg, value: val, text: cdbValueText(sg, val) });
  }
  return out;
}

// Sayısal değerin VAL_ tablosundaki metin karşılığı; yoksa null.
// Tablo HAM değere göre tanımlıdır, fiziksele göre değil — çarpan 1 ve ofset 0
// olmayan bir sinyalde fiziksel değerle aramak sessizce boş dönerdi.
function cdbValueText(sig, phys) {
  if (!sig.values) return null;
  var raw = (phys - sig.offset) / (sig.factor || 1);
  var key = Math.round(raw);
  if (Math.abs(raw - key) > 1e-6) return null;
  return sig.values.hasOwnProperty(key) ? sig.values[key] : null;
}

// Sinyalin ONDALIK BASAMAK sayısı ÇARPANDAN türer, sabit değildir.
// Çarpanı 1 olan bir bayrağı "0,000" diye yazmak olmayan bir çözünürlük
// iddia eder; çarpanı 0,125 olan devri "1452" diye yazmak da gerçek
// çözünürlüğü gizler. Ölçüt: çarpanı tam sayıya çeviren en küçük basamak.
function cdbSigDecimals(sig) {
  if (sig.valueType !== 'int') return 3;
  var f = Math.abs(sig.factor);
  if (!isFinite(f) || f === 0) return 3;
  for (var d = 0; d <= 6; d++) {
    var scaled = f * Math.pow(10, d);
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return d;
  }
  return 6;
}

// EKRANDA gösterilen basamak ÜÇLE sınırlıdır. Sınır bilgi kaybettirmiyor:
// çarpanı 1/256 olan bir hız sinyalinde komşu ham değerler 0,0039 km/h
// arayla durur, üçüncü ondalık onları zaten ayırır. Sınırsız bırakıldığında
// rozet "80.445313 km/h" yazıyordu — okunmayan üç hane, dar bir rozette
// okunması gereken üç haneyi dışarı itiyor.
var CDB_DISPLAY_DEC = 3;

// Sinyal değerinin okunur biçimi: VAL_ tablosu varsa METİN, yoksa çarpandan
// türeyen ondalıkla sayı + birim. Kare listesi ve imleç rozeti AYNI
// biçimlendiriciyi kullanır — ayrışırlarsa aynı sayı iki yerde iki türlü
// görünür. DIŞA AKTARIM bunu kullanmaz: CSV tam çözünürlükte yazar.
function cdbFmtSigVal(sig, v, withUnit) {
  var txt = cdbValueText(sig, v);
  if (txt !== null) return txt;
  var s = v.toFixed(Math.min(cdbSigDecimals(sig), CDB_DISPLAY_DEC));
  return (withUnit !== false && sig.unit) ? s + ' ' + sig.unit : s;
}

// Sinyal AYRIK mı? Ayrık sinyaller basamaklı çizilir: vites 3'ten 4'e geçerken
// 3,5'ten geçmez (UI_PATTERN_GUIDE, "Ölçüm Penceresi" §4).
// Ölçüt: değer tablosu var, ya da 1 bitlik bayrak, ya da tam sayı adımlı
// (çarpan 1, ofset tam sayı) ve dar bir sinyal.
function cdbIsDiscrete(sig) {
  if (sig.values) return true;
  if (sig.length === 1) return true;
  if (sig.valueType !== 'int') return false;
  return sig.factor === 1 && Math.abs(sig.offset - Math.round(sig.offset)) < 1e-12 && sig.length <= 8;
}

// Sinyalin benzersiz anahtarı — ağaç, grafik ve dışa aktarım aynı anahtarı
// kullanır; ayrışmasınlar.
//
// Anahtar KANALDAN türer, DBC mesajından değil: aynı mesajı iki kaynak
// gönderiyorsa iki ayrı sinyal vardır ve ikisi de çizilebilmelidir. Mesaj
// kimliğinden türeseydi ikisi tek anahtara düşer, biri ötekini gizlerdi.
function cdbSigKey(ch, sig) {
  return ch.key + '.' + sig.name;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cdbRawBits: cdbRawBits,
    cdbSignExtend: cdbSignExtend,
    cdbRawFloat: cdbRawFloat,
    cdbDecodeSignal: cdbDecodeSignal,
    cdbMuxMatches: cdbMuxMatches,
    cdbBuildSeries: cdbBuildSeries,
    cdbDecodeFrame: cdbDecodeFrame,
    cdbValueText: cdbValueText,
    cdbSigDecimals: cdbSigDecimals,
    cdbFmtSigVal: cdbFmtSigVal,
    cdbIsDiscrete: cdbIsDiscrete,
    cdbSigKey: cdbSigKey
  };
}
