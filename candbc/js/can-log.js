// ═══════════════════════════════════════════════════════════════════════════
// CAN LOG AYRIŞTIRICI — biçim algılama + kare deposu
// ═══════════════════════════════════════════════════════════════════════════
//
// DOM'suz. Girdi ham metin, çıktı TİPLİ DİZİLERDEN oluşan bir kare deposu.
//
// ── NEDEN TEK BİR "ÇÖZÜMLEYİCİ" YOK ──────────────────────────────────────
// CAN kaydının tek bir dosya biçimi yoktur: SocketCAN'in candump'ı, Vector'ün
// .asc'si, PEAK'in .trc'si, BusMaster'ın .log'u ve bir düzine CSV dışa aktarımı
// aynı veriyi bambaşka sütunlarla yazar. Bu yüzden burada BİÇİM BAŞINA bir
// eşleyici var ve dosya açılırken hepsi bir örnek üzerinde yarıştırılıyor
// (cdbDetectLogFormat): en çok satırı çözen kazanır.
//
// ── SESSİZ YANLIŞ ÇIKTIYA KARŞI KAPI ─────────────────────────────────────
// Kazanan biçim ve ÇÖZÜLEMEYEN SATIR SAYISI kullanıcıya yazılır. Bir kayıt
// %60 çözülüp geri kalanı sessizce atılırsa grafik "makul ama eksik" çıkar ve
// kimse fark etmez. Atlanan satırların ilk örnekleri de saklanır
// (store.skippedSamples) — kullanıcı neyin düştüğünü görebilsin.
//
// ── ZAMAN ─────────────────────────────────────────────────────────────────
// Her biçimin kendi zaman birimi var (candump saniye, PCAN milisaniye,
// BusMaster ss:dd:sn:ms). Depoda zaman DAİMA SANİYEdir; dönüşüm biçim
// tanımındaki timeScale ile yapılır ve kullanıcı arayüzden değiştirebilir.

// ── Küçük yardımcılar ─────────────────────────────────────────────────────

function cdbHexPairs(s) {
  var out = [];
  var t = String(s || '').replace(/0x/gi, ' ').replace(/[,;]/g, ' ');
  // Boşluksuz blok ("0102030405") da boşluklu blok da aynı yoldan geçsin.
  if (/^\s*[0-9A-Fa-f]+\s*$/.test(t) && t.replace(/\s/g, '').length % 2 === 0) {
    var h = t.replace(/\s/g, '');
    for (var i = 0; i < h.length; i += 2) out.push(parseInt(h.substr(i, 2), 16));
    return out;
  }
  var toks = t.trim().split(/\s+/);
  for (var k = 0; k < toks.length; k++) {
    if (/^[0-9A-Fa-f]{1,2}$/.test(toks[k])) out.push(parseInt(toks[k], 16));
    else if (/^[0-9A-Fa-f]+$/.test(toks[k]) && toks[k].length % 2 === 0) {
      for (var j = 0; j < toks[k].length; j += 2) out.push(parseInt(toks[k].substr(j, 2), 16));
    } else break;
  }
  return out;
}

// Bir jeton listesinin SONUNDAKİ en uzun "iki haneli onaltılık" dizisi.
// PCAN/BusMaster gibi sütun düzeni sürümden sürüme değişen biçimlerde veri
// bloğunu bulmanın en dayanıklı yolu bu: veri her zaman satırın SONUNDADIR.
function cdbTailHexRun(tokens) {
  var end = tokens.length;
  var i = end;
  while (i > 0 && /^[0-9A-Fa-f]{2}$/.test(tokens[i - 1])) i--;
  return { from: i, count: end - i };
}

// ── Biçim eşleyicileri ────────────────────────────────────────────────────
// Her eşleyici bir satır alır, çözebiliyorsa
//   { t, id, ext, dlc, bytes:[…] }
// döner; çözemiyorsa null. `ctx` biçim başlıklarından toplanan durumdur
// (ör. ASC'de "base hex" / "base dec").

// 1) candump — karma (#) biçimi:  (1656664830.024244) can0 123#DEADBEEF
//    CAN FD: 123##0DEADBEEF  ('##' sonrası ilk hane bayrak)
//    Uzatılmış kimlik KİMLİK ALANININ GENİŞLİĞİNDEN okunur: candump standart
//    kimliği 3, uzatılmışı 8 haneyle yazar. Değere bakmak yetmez — 0x123
//    hem 11 bit hem 29 bit çerçeve olabilir.
var CDB_RE_DUMP_HASH = /^\s*(?:\(\s*([0-9.]+)\s*\)\s+)?([A-Za-z][\w-]*)\s+([0-9A-Fa-f]{3,8})(#{1,2})(\S*)\s*$/;

function cdbMatchDumpHash(line) {
  var m = CDB_RE_DUMP_HASH.exec(line);
  if (!m) return null;
  var idHex = m[3];
  var body = m[5] || '';
  var bytes;
  if (m[4] === '##') body = body.slice(1);          // FD bayrak hanesi
  if (/^R/i.test(body)) bytes = [];                 // uzaktan çerçeve (RTR)
  else {
    if (!/^[0-9A-Fa-f]*$/.test(body) || body.length % 2 !== 0) return null;
    bytes = cdbHexPairs(body);
  }
  return {
    t: m[1] !== undefined ? parseFloat(m[1]) : null,
    id: parseInt(idHex, 16),
    ext: idHex.length > 3,
    dlc: bytes.length,
    bytes: bytes
  };
}

// 2) candump — okunur biçim:  (1234.5678)  can0  123   [8]  DE AD BE EF
var CDB_RE_DUMP_PRETTY = /^\s*(?:\(\s*([0-9.]+)\s*\)\s+)?([A-Za-z][\w-]*)\s+([0-9A-Fa-f]{3,8})\s+\[(\d+)\]\s*([0-9A-Fa-f\s]*?)\s*$/;

function cdbMatchDumpPretty(line) {
  var m = CDB_RE_DUMP_PRETTY.exec(line);
  if (!m) return null;
  return {
    t: m[1] !== undefined ? parseFloat(m[1]) : null,
    id: parseInt(m[3], 16),
    ext: m[3].length > 3,
    dlc: parseInt(m[4], 10),
    bytes: cdbHexPairs(m[5])
  };
}

// 3) Vector ASC — klasik CAN satırı
//      0.000000 1  100             Rx   d 8 01 02 03 04 05 06 07 08
//    Kimliğin sonundaki 'x' uzatılmış çerçeve demektir. Taban dosya
//    başlığındaki "base hex" / "base dec" satırından gelir.
var CDB_RE_ASC = /^\s*([0-9.]+)\s+(\d+)\s+([0-9A-Fa-f]+)(x?)\s+(Rx|Tx|TxRq)\s+([dr])\s+([0-9A-Fa-f]+)\s*([0-9A-Fa-f\s]*?)\s*(?:Length\s*=.*)?$/i;

function cdbMatchAsc(line, ctx) {
  var m = CDB_RE_ASC.exec(line);
  if (!m) return cdbMatchAscFd(line, ctx);
  var radix = (ctx && ctx.ascBase === 'dec') ? 10 : 16;
  var id = parseInt(m[3], radix);
  if (!isFinite(id)) return null;
  var dlc = parseInt(m[7], 16);
  return {
    t: parseFloat(m[1]),
    id: id,
    ext: m[4].toLowerCase() === 'x' || id > 0x7FF,
    dlc: dlc,
    bytes: m[6].toLowerCase() === 'r' ? [] : cdbHexPairs(m[8])
  };
}

// 3b) Vector ASC — CAN FD satırı
//      0.010000 CANFD 1 Rx 123 MsgAdi 1 0 8 8 01 02 …
//    Sütun sayısı sembolik ada göre değiştiği için YAPISAL arama yapılır:
//    kimlikten sonra "brs esi dlc uzunluk" dörtlüsü + tam o kadar veri baytı.
function cdbMatchAscFd(line, ctx) {
  if (line.indexOf('CANFD') < 0) return null;
  var tk = line.trim().split(/\s+/);
  var i = tk.indexOf('CANFD');
  if (i < 1) return null;
  var t = parseFloat(tk[0]);
  if (!isFinite(t)) return null;
  var radix = (ctx && ctx.ascBase === 'dec') ? 10 : 16;
  for (var p = i + 3; p + 3 < tk.length; p++) {
    if (!/^[01]$/.test(tk[p]) || !/^[01]$/.test(tk[p + 1])) continue;
    if (!/^[0-9A-Fa-f]{1,2}$/.test(tk[p + 2])) continue;
    var nb = parseInt(tk[p + 3], 10);
    if (!isFinite(nb) || nb < 0 || nb > 64) continue;
    if (tk.length - (p + 4) < nb) continue;
    // Kimlik, brs'ten önceki son onaltılık jeton (arada sembolik ad olabilir).
    var idTok = null;
    for (var q = p - 1; q >= i + 3; q--) {
      if (/^[0-9A-Fa-f]+x?$/.test(tk[q])) { idTok = tk[q]; break; }
    }
    if (idTok === null) continue;
    var ext = /x$/i.test(idTok);
    var id = parseInt(idTok.replace(/x$/i, ''), radix);
    if (!isFinite(id)) continue;
    var bytes = [];
    for (var b = 0; b < nb; b++) {
      if (!/^[0-9A-Fa-f]{2}$/.test(tk[p + 4 + b])) return null;
      bytes.push(parseInt(tk[p + 4 + b], 16));
    }
    return { t: t, id: id, ext: ext || id > 0x7FF, dlc: nb, bytes: bytes };
  }
  return null;
}

// 4) PEAK PCAN-Trace (.trc) — v1.0 … v2.1
//      1)      1000.0  0018  8  01 02 …
//      1      1000.000 DT     0300 Rx 8  01 02 …
//    Sütun düzeni sürüme göre değişiyor; VERİ HER SÜRÜMDE SONDA olduğu için
//    sondaki onaltılık dizi çapa alınır, DLC ve kimlik ondan geriye okunur.
function cdbMatchTrc(line) {
  var s = line.trim();
  if (!s.length || s.charAt(0) === ';') return null;
  var tk = s.replace(/\)/g, ' ').trim().split(/\s+/);
  if (tk.length < 4) return null;
  if (!/^\d+$/.test(tk[0])) return null;                      // mesaj numarası
  if (!/^[\d.]+$/.test(tk[1])) return null;
  var t = parseFloat(tk[1]);                                  // zaman (ms)
  if (!isFinite(t)) return null;

  var run = cdbTailHexRun(tk);
  if (run.count < 1) return null;

  // DLC veri bloğunun hemen ÖNCESİNDE durur. İki haneli onaltılık yazılmışsa
  // (PCAN v2 FD) bloğun İÇİNE düşer; bu yüzden iki olasılık da denenir ve
  // hangisi bayt sayısını TUTTURUYORSA o seçilir. Tutturmayan bir eşleşme
  // sessizce kırpılmış bir kare üretirdi.
  var dlcIx, dataFrom, count;
  var pre = run.from - 1;
  var dlcPre = (pre >= 2 && /^\d+$/.test(tk[pre])) ? parseInt(tk[pre], 10) : NaN;
  var dlcIn  = parseInt(tk[run.from], 16);
  if (isFinite(dlcPre) && dlcPre === run.count) {
    dlcIx = pre; dataFrom = run.from; count = run.count;
  } else if (isFinite(dlcIn) && dlcIn === run.count - 1 && run.count >= 2) {
    dlcIx = run.from; dataFrom = run.from + 1; count = run.count - 1;
  } else if (isFinite(dlcPre) && dlcPre >= 0 && dlcPre <= 64) {
    dlcIx = pre; dataFrom = run.from; count = Math.min(run.count, dlcPre);
  } else return null;

  // Kimlik: DLC'den önceki son onaltılık jeton (Rx/Tx, DT, veri yolu no atlanır).
  var idTok = null;
  for (var q = dlcIx - 1; q >= 2; q--) {
    if (/^(Rx|Tx|DT|FD|BS|EV|ST|ER|RR|--|-)$/i.test(tk[q])) continue;
    if (/^[0-9A-Fa-f]+$/.test(tk[q])) { idTok = tk[q]; break; }
  }
  if (idTok === null) return null;
  var id = parseInt(idTok, 16);
  if (!isFinite(id)) return null;

  var bytes = [];
  for (var b = 0; b < count; b++) bytes.push(parseInt(tk[dataFrom + b], 16));
  // PCAN standart kimliği DÖRT haneye doldurur ("0018"), uzatılmışı sekize.
  // candump'taki "üç haneden uzunsa uzatılmış" ölçütü burada YANLIŞ olurdu.
  return { t: t, id: id, ext: idTok.length > 4 || id > 0x7FF, dlc: bytes.length, bytes: bytes };
}

// 5) BusMaster .log
//      20:16:19:0246 Rx 1 0x18fef100 x 8 01 02 …
//      0:4:20:7502   Rx 1 18FED917   x 8 FC FF 00 FF FF FF FF FF
//
// ── ZAMANIN SON ALANI MİLİSANİYE DEĞİL ───────────────────────────────────
// BusMaster zamanı <sa>:<dk>:<sn>:<kesir> yazar ve KESİR SABİT GENİŞLİKTEDİR.
// Kullanıcının kaydında ölçüldü: alan dört haneli ve en büyük değeri 9999;
// saniye tam da 9999'dan sonra artıyor. Yani birim 0,1 ms — saniyenin
// ON BİNDE BİRİ, binde biri değil.
//
//     0:0:0:9998  →  0:0:1:0004        (199.664 satırda doğrulandı)
//
// 1000'e bölen bir okuma iki hata birden yapardı: eksen on kat uzar ve her
// saniye sınırında zaman ~9 saniye GERİYE atlar. İkincisi grafiği sessizce
// karıştırır. Bu yüzden bölen alanın YAZILI GENİŞLİĞİNDEN türetiliyor:
// dört hane → 10000, üç hane → 1000. Sabit bir sayı yazmak, kesri
// milisaniye yazan bir BusMaster sürümünde aynı hatayı ters yönde yapardı.
var CDB_RE_BUSMASTER = /^\s*(\d+):(\d+):(\d+):(\d+)\s+(Rx|Tx)\s+(\d+)\s+(?:0x)?([0-9A-Fa-f]+)\s+([sx])\s+(\d+)\s*([0-9A-Fa-f\s]*?)\s*$/i;

function cdbMatchBusmaster(line, ctx) {
  var m = CDB_RE_BUSMASTER.exec(line);
  if (!m) return null;
  var frac = m[4];
  var t = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) +
          parseInt(frac, 10) / Math.pow(10, frac.length);
  // BusMaster başlıkta ***HEX*** ya da ***DEC*** yazar. Taban yanlış okunursa
  // kimlik de veri de bambaşka çıkar ve hiçbir mesaj eşleşmez.
  var radix = (ctx && ctx.bmBase === 'dec') ? 10 : 16;
  var id = parseInt(m[7], radix);
  if (!isFinite(id)) return null;
  var bytes = radix === 10 ? cdbDecBytes(m[10]) : cdbHexPairs(m[10]);
  return {
    t: t,
    id: id,
    ext: m[8].toLowerCase() === 'x' || id > 0x7FF,
    dlc: parseInt(m[9], 10),
    bytes: bytes
  };
}

// Onluk kipte veri baytları boşlukla ayrılmış ondalık sayılardır.
function cdbDecBytes(s) {
  var out = [], toks = String(s || '').trim().split(/\s+/);
  for (var i = 0; i < toks.length; i++) {
    if (!/^\d{1,3}$/.test(toks[i])) break;
    var v = parseInt(toks[i], 10);
    if (v > 255) break;
    out.push(v);
  }
  return out;
}

// ── Biçim kayıt defteri ───────────────────────────────────────────────────
// timeScale: ham zamanı SANİYEye çeviren çarpan.
var CDB_LOG_FORMATS = [
  { id: 'candump',   name: 'candump (SocketCAN, ID#VERİ)', timeScale: 1,     match: cdbMatchDumpHash },
  { id: 'candump-p', name: 'candump (SocketCAN, okunur)',  timeScale: 1,     match: cdbMatchDumpPretty },
  { id: 'asc',       name: 'Vector ASC (CANalyzer/CANoe)', timeScale: 1,     match: cdbMatchAsc },
  { id: 'trc',       name: 'PEAK PCAN-Trace (.trc)',       timeScale: 0.001, match: cdbMatchTrc },
  { id: 'busmaster', name: 'BusMaster (.log)',             timeScale: 1,     match: cdbMatchBusmaster }
];

function cdbFormatById(id) {
  for (var i = 0; i < CDB_LOG_FORMATS.length; i++) if (CDB_LOG_FORMATS[i].id === id) return CDB_LOG_FORMATS[i];
  return null;
}

// Yorum / başlık satırı mı? Algılama oranını bunlar bozmasın diye elenir.
function cdbIsNoise(line) {
  var s = line.trim();
  if (!s.length) return true;
  if (s.charAt(0) === ';' || s.charAt(0) === '#') return true;
  if (s.slice(0, 2) === '//') return true;
  if (s.slice(0, 3) === '***') return true;                 // BusMaster başlığı
  if (/^(date|base|internal events|Begin Triggerblock|End TriggerBlock|Measurement|Statistic:|version)\b/i.test(s)) return true;
  if (/^-+$/.test(s)) return true;
  return false;
}

// ── Biçim algılama ────────────────────────────────────────────────────────
// Örnek satırlar üzerinde bütün eşleyiciler yarıştırılır; en çok satırı
// çözen kazanır. Beraberlikte kayıt defterindeki sıra belirler.
function cdbDetectLogFormat(lines, ctx) {
  var best = null;
  var scores = [];
  for (var i = 0; i < CDB_LOG_FORMATS.length; i++) {
    var f = CDB_LOG_FORMATS[i];
    var hit = 0, seen = 0;
    for (var j = 0; j < lines.length; j++) {
      if (cdbIsNoise(lines[j])) continue;
      seen++;
      if (f.match(lines[j], ctx)) hit++;
    }
    var ratio = seen ? hit / seen : 0;
    scores.push({ id: f.id, name: f.name, hit: hit, seen: seen, ratio: ratio });
    if (!best || hit > best.hit) best = { format: f, hit: hit, seen: seen, ratio: ratio };
  }
  return { best: (best && best.hit > 0) ? best : null, scores: scores };
}

// Dosya başlığından biçim bağlamını toplar (şimdilik yalnız ASC'nin tabanı).
function cdbLogContext(lines) {
  var ctx = { ascBase: 'hex', bmBase: 'hex' };
  for (var i = 0; i < lines.length && i < 60; i++) {
    var m = /^\s*base\s+(hex|dec)\b/i.exec(lines[i]);
    if (m) ctx.ascBase = m[1].toLowerCase();
    // BusMaster: ***HEX*** / ***DEC***
    var b = /^\s*\*\*\*(HEX|DEC)\*\*\*/i.exec(lines[i]);
    if (b) ctx.bmBase = b[1].toLowerCase();
  }
  return ctx;
}

// ── Kare deposu ───────────────────────────────────────────────────────────
// Milyonlarca kare düz JS nesnesi olarak tutulamaz. Depo tipli dizilerdir ve
// veri baytları TEK bir düz tampona yazılır; her kare oraya (offset, uzunluk)
// ile bakar. Kare başına maliyet ~25 bayt.

function cdbNewStore() {
  return {
    n: 0, cap: 4096,
    t:    new Float64Array(4096),
    id:   new Uint32Array(4096),
    ext:  new Uint8Array(4096),
    off:  new Uint32Array(4096),
    len:  new Uint8Array(4096),
    data: new Uint8Array(32768), dataLen: 0, dataCap: 32768,
    skipped: 0, skippedSamples: [],
    lines: 0
  };
}

function cdbGrowTyped(arr, cap, Ctor) {
  var next = new Ctor(cap);
  next.set(arr);
  return next;
}

function cdbStorePush(st, fr) {
  if (st.n === st.cap) {
    st.cap *= 2;
    st.t   = cdbGrowTyped(st.t,   st.cap, Float64Array);
    st.id  = cdbGrowTyped(st.id,  st.cap, Uint32Array);
    st.ext = cdbGrowTyped(st.ext, st.cap, Uint8Array);
    st.off = cdbGrowTyped(st.off, st.cap, Uint32Array);
    st.len = cdbGrowTyped(st.len, st.cap, Uint8Array);
  }
  var nb = fr.bytes.length;
  while (st.dataLen + nb > st.dataCap) {
    st.dataCap *= 2;
    st.data = cdbGrowTyped(st.data, st.dataCap, Uint8Array);
  }
  for (var i = 0; i < nb; i++) st.data[st.dataLen + i] = fr.bytes[i] & 0xFF;
  st.t[st.n]   = fr.t;
  st.id[st.n]  = fr.id >>> 0;
  st.ext[st.n] = fr.ext ? 1 : 0;
  st.off[st.n] = st.dataLen;
  st.len[st.n] = nb;
  st.dataLen += nb;
  st.n++;
}

// Ayrıştırma bitince: dizileri kırp, mesaj başına kare dizinini kur.
// Dizin OLMADAN her sinyal için bütün kayıt taranırdı; 2 milyon kareli bir
// dosyada tek bir onay kutusu saniyelerce donma demek.
function cdbStoreFinalize(st, opts) {
  opts = opts || {};
  st.t   = st.t.subarray(0, st.n);
  st.id  = st.id.subarray(0, st.n);
  st.ext = st.ext.subarray(0, st.n);
  st.off = st.off.subarray(0, st.n);
  st.len = st.len.subarray(0, st.n);
  st.data = st.data.subarray(0, st.dataLen);

  var scale = opts.timeScale || 1;
  var i;
  if (scale !== 1) for (i = 0; i < st.n; i++) st.t[i] *= scale;
  st.tAbs0 = st.n ? st.t[0] : 0;
  if (opts.relativeTime !== false && st.n) {
    var t0 = st.t[0];
    for (i = 0; i < st.n; i++) st.t[i] -= t0;
  }

  // Mesaj anahtarı → kare indeksleri
  var counts = {};
  var keys = new Array(st.n);
  for (i = 0; i < st.n; i++) {
    var k = cdbMsgKey(st.id[i], st.ext[i] === 1);
    keys[i] = k;
    counts[k] = (counts[k] || 0) + 1;
  }
  var byKey = {}, fill = {};
  for (var k2 in counts) if (counts.hasOwnProperty(k2)) { byKey[k2] = new Int32Array(counts[k2]); fill[k2] = 0; }
  for (i = 0; i < st.n; i++) { var kk = keys[i]; byKey[kk][fill[kk]++] = i; }
  st.byKey = byKey;
  st.counts = counts;
  // Zaman geriye akıyorsa (birleştirilmiş kayıt, sarmalanmış sayaç) eksenin
  // uçları ilk/son kareden okunamaz. Durum ÖLÇÜLÜR, kullanıcıya söylenir ve
  // uçlar gerçek en küçük/en büyükten alınır.
  st.timeMonotonic = true;
  for (i = 1; i < st.n; i++) if (st.t[i] < st.t[i - 1]) { st.timeMonotonic = false; break; }
  if (st.timeMonotonic) {
    st.t0 = st.n ? st.t[0] : 0;
    st.t1 = st.n ? st.t[st.n - 1] : 0;
  } else {
    var lo = Infinity, hi = -Infinity;
    for (i = 0; i < st.n; i++) { if (st.t[i] < lo) lo = st.t[i]; if (st.t[i] > hi) hi = st.t[i]; }
    st.t0 = st.n ? lo : 0;
    st.t1 = st.n ? hi : 0;
  }
  return st;
}

// ── Parçalı ayrıştırma sürücüsü ───────────────────────────────────────────
// Tarayıcıyı kilitlememek için metin PARÇA PARÇA işlenir; her parçadan sonra
// denetim olay döngüsüne bırakılır. Worker kullanılmıyor: program tek dosya
// olarak file:// üzerinden çift tıklanarak açılıyor ve blob worker'ları o
// kaynakta her tarayıcıda çalışmıyor (Ölçüm Görüntüleyici'nin kararıyla aynı).
function cdbParseLogAsync(text, opts, onProgress, onDone) {
  opts = opts || {};
  var st = cdbNewStore();
  var head = [];
  var pos = 0, total = text.length;
  // Başlıktan bağlam + biçim algılama için ilk ~400 satır
  var probe = 0, pi = 0;
  while (probe < 400 && pi < total) {
    var nl = text.indexOf('\n', pi);
    if (nl < 0) { head.push(text.slice(pi)); break; }
    head.push(text.slice(pi, nl));
    pi = nl + 1; probe++;
  }
  var ctx = cdbLogContext(head);
  var det = cdbDetectLogFormat(head, ctx);
  var fmt = opts.formatId ? cdbFormatById(opts.formatId) : (det.best && det.best.format);
  if (!fmt) {
    onDone({ error: 'Bu dosyada tanınan bir CAN kayıt biçimi bulunamadı.', detect: det, store: null });
    return;
  }
  var scale = (opts.timeScale !== undefined && opts.timeScale !== null) ? opts.timeScale : fmt.timeScale;
  var seq = 0;   // zamansız biçimler için yedek eksen (kare sırası)
  var noTime = false;

  function step() {
    var t0 = Date.now();
    while (pos < total) {
      var nl = text.indexOf('\n', pos);
      var line = nl < 0 ? text.slice(pos) : text.slice(pos, nl);
      pos = nl < 0 ? total : nl + 1;
      if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
      st.lines++;
      if (!cdbIsNoise(line)) {
        var fr = fmt.match(line, ctx);
        if (fr) {
          if (fr.t === null || !isFinite(fr.t)) { fr.t = seq; noTime = true; }
          seq++;
          cdbStorePush(st, fr);
        } else {
          st.skipped++;
          if (st.skippedSamples.length < 12) st.skippedSamples.push({ line: st.lines, text: line.slice(0, 160) });
        }
      }
      // 16 ms'de bir denetimi bırak — 60 fps'lik bir kareye denk.
      if ((st.lines & 1023) === 0 && Date.now() - t0 > 16) break;
    }
    if (pos < total) {
      if (onProgress) onProgress(pos / total, st);
      setTimeout(step, 0);
      return;
    }
    cdbStoreFinalize(st, { timeScale: noTime ? 1 : scale, relativeTime: opts.relativeTime !== false });
    st.formatId = fmt.id;
    st.formatName = fmt.name;
    st.noTime = noTime;
    st.timeScale = noTime ? 1 : scale;
    if (onProgress) onProgress(1, st);
    onDone({ store: st, detect: det, format: fmt });
  }
  setTimeout(step, 0);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cdbHexPairs: cdbHexPairs,
    cdbTailHexRun: cdbTailHexRun,
    cdbMatchDumpHash: cdbMatchDumpHash,
    cdbMatchDumpPretty: cdbMatchDumpPretty,
    cdbMatchAsc: cdbMatchAsc,
    cdbMatchTrc: cdbMatchTrc,
    cdbMatchBusmaster: cdbMatchBusmaster,
    cdbDecBytes: cdbDecBytes,
    cdbDetectLogFormat: cdbDetectLogFormat,
    cdbLogContext: cdbLogContext,
    cdbIsNoise: cdbIsNoise,
    cdbNewStore: cdbNewStore,
    cdbStorePush: cdbStorePush,
    cdbStoreFinalize: cdbStoreFinalize,
    cdbParseLogAsync: cdbParseLogAsync,
    CDB_LOG_FORMATS: CDB_LOG_FORMATS
  };
}
