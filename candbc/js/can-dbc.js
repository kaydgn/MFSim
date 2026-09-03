// ═══════════════════════════════════════════════════════════════════════════
// DBC AYRIŞTIRICI — Vector CANdb++ veritabanı dosyası
// ═══════════════════════════════════════════════════════════════════════════
//
// DOM'suz saf ayrıştırıcı: girdi metin, çıktı düz nesne. Tarayıcıya da Node'a
// da bağlı değil, testleri doğrudan require ile koşuyor.
//
// ── AYRIŞTIRMANIN İKİ KATMANI ────────────────────────────────────────────
// DBC dosyası "satır tabanlı" görünür ama DEĞİLDİR: CM_ / VAL_ / BA_ gibi
// deyimler ';' ile biter ve araya satır sonu girebilir; üstelik tırnak içinde
// hem ';' hem satır sonu geçebilir. Bu yüzden önce TIRNAK BİLEN bir mantıksal
// satır bölücü koşar (cdbSplitStatements), sonra deyimler eşlenir. Ham
// text.split('\n') ile yazılmış bir ayrıştırıcı, açıklaması iki satıra yayılan
// ilk sinyalde sessizce yanlış sonuç verir.
//
// ── EKSİK ALAN null, SIFIR DEĞİL ─────────────────────────────────────────
// Çevrim süresi (GenMsgCycleTime) bildirilmemiş bir mesajda cycleTime = null.
// Sıfır yazmak "0 ms'de bir gönderiliyor" iddiası olurdu.

// Uzatılmış kimlik biti — DBC mesaj kimliğinin 31. biti 29-bit çerçeveyi
// işaretler (Vector kuralı). Kalan 29 bit gerçek kimlik.
var CDB_EXT_FLAG = 0x80000000;

// ── Tırnak bilen yardımcılar ──────────────────────────────────────────────

// s içindeki ilk `ch` konumu — TIRNAK İÇİNDEKİLER SAYILMAZ. Bulunamazsa -1.
function cdbIndexOfUnquoted(s, ch) {
  var q = false;
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '"') { q = !q; continue; }
    if (!q && c === ch) return i;
  }
  return -1;
}

// Metni MANTIKSAL satırlara böler: tırnak içindeki satır sonu bölmez.
// Dönen her öğe { text, line } — line, hata iletilerinde kullanılacak 1 tabanlı
// KAYNAK satır numarası.
function cdbSplitLines(text) {
  var out = [];
  var buf = '';
  var q = false;
  var line = 1, start = 1;
  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);
    if (c === '\r') continue;
    if (c === '"') { q = !q; buf += c; continue; }
    if (c === '\n') {
      line++;
      if (q) { buf += '\n'; continue; }
      out.push({ text: buf, line: start });
      buf = ''; start = line;
      continue;
    }
    buf += c;
  }
  if (buf.length) out.push({ text: buf, line: start });
  return out;
}

// ';' ile biten deyimler — mantıksal satırlar bunlar için birleştirilir.
//
// ANAHTAR KELİMEDEN SONRA İÇERİK ŞARTI (\s+\S) bir incelik değil KAPIDIR.
// Her DBC dosyasının başındaki NS_ bloğu bu anahtar kelimeleri TEK BAŞINA,
// birer sembol adı olarak sıralar:
//     NS_ :
//         CM_
//         BA_
// Şart olmadan o "CM_" satırı bir deyim sanılır, kapanış ';'i aranarak
// sonraki satırlar yutulur ve BU_ / BO_ bloklarının tamamı ayrıştırıcıya hiç
// ulaşmaz — dosya "0 mesaj" olarak okunur. Ölçüldü: bu şart eklenmeden önce
// başlığı normal olan bir DBC'de iki mesajın ikisi de kayboluyordu.
var CDB_TERMINATED = /^\s*(CM_|VAL_|VAL_TABLE_|BA_|BA_DEF_|BA_DEF_DEF_|BA_DEF_REL_|BA_DEF_DEF_REL_|BA_REL_|SIG_VALTYPE_|SIG_GROUP_|SG_MUL_VAL_|BO_TX_BU_|EV_|ENVVAR_DATA_|SGTYPE_)\s+\S/;

// Mantıksal satırları DEYİMLERE çevirir: ';' ile biten anahtar kelimelerde
// kapanış noktalı virgülü görülene kadar sonraki satırlar eklenir.
function cdbSplitStatements(text) {
  var lines = cdbSplitLines(text);
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].text;
    if (!CDB_TERMINATED.test(t)) { out.push({ text: t, line: lines[i].line }); continue; }
    var acc = t, n = 0;
    while (cdbIndexOfUnquoted(acc, ';') < 0 && i + 1 < lines.length && n < 4000) {
      i++; n++;
      acc += '\n' + lines[i].text;
    }
    out.push({ text: acc, line: lines[i - n] ? lines[i - n].line : lines[i].line });
  }
  return out;
}

// ── Düzenli ifadeler ──────────────────────────────────────────────────────

var CDB_RE_BO = /^\s*BO_\s+(\d+)\s+([^\s:]+)\s*:\s*(\d+)\s+(\S+)/;

// SG_ <ad> [M|m<n>[M]] : <başlangıç>|<uzunluk>@<düzen><işaret> (<çarpan>,<ofset>)
//     [<min>|<maks>] "<birim>" <alıcılar>
// Çoklayıcı belirteci ADDAN SONRA, ':' ÖNCE gelir ve boşlukla ayrılır.
var CDB_RE_SG = new RegExp(
  '^\\s*SG_\\s+([^\\s:]+)\\s*(?:\\s(M|m\\d+M?)\\s*)?:' +
  '\\s*(\\d+)\\s*\\|\\s*(\\d+)\\s*@\\s*([01])\\s*([-+])' +
  '\\s*\\(\\s*([^,]*?)\\s*,\\s*([^)]*?)\\s*\\)' +
  '\\s*\\[\\s*([^|\\]]*?)\\s*\\|\\s*([^\\]]*?)\\s*\\]' +
  '\\s*"([^"]*)"\\s*(.*)$'
);

var CDB_RE_BU = /^\s*BU_\s*:\s*(.*)$/;
var CDB_RE_VERSION = /^\s*VERSION\s+"([^"]*)"/;

// ── Sayı okuma ────────────────────────────────────────────────────────────
// DBC sayıları nokta ondalıklı ve üstel olabilir ("1E-3"). Okunamayan bir
// alan NaN olarak geçmez: varsayılana düşer ve uyarı yazılır.
function cdbNum(s, dflt) {
  var v = parseFloat(String(s).trim());
  return isFinite(v) ? v : dflt;
}

// ── Ana ayrıştırıcı ───────────────────────────────────────────────────────

/**
 * DBC metnini ayrıştırır.
 * @returns {{version, nodes, messages, byKey, valueTables, warnings}}
 *   byKey: 'S123' / 'E18FEF00' → mesaj (bkz. cdbMsgKey)
 */
function cdbParseDbc(text) {
  var db = {
    version: '',
    nodes: [],
    messages: [],
    byKey: {},
    valueTables: {},
    warnings: []
  };
  if (typeof text !== 'string' || !text.length) {
    db.warnings.push({ line: 0, text: 'DBC dosyası boş.' });
    return db;
  }

  var stmts = cdbSplitStatements(text);
  var cur = null;            // içinde bulunulan BO_ (SG_ satırları buna eklenir)
  var byRawId = {};          // ham DBC kimliği → mesaj (VAL_/CM_/BA_ için)

  function warn(line, msg) {
    if (db.warnings.length < 400) db.warnings.push({ line: line, text: msg });
  }

  for (var si = 0; si < stmts.length; si++) {
    var raw = stmts[si].text;
    var ln = stmts[si].line;
    var s = raw.trim();
    if (!s.length) { continue; }

    // BO_ — mesaj
    var m = CDB_RE_BO.exec(raw);
    if (m) {
      var rawId = parseInt(m[1], 10) >>> 0;
      var msg = {
        rawId: rawId,
        id: rawId & 0x1FFFFFFF,
        extended: (rawId & CDB_EXT_FLAG) !== 0,
        name: m[2],
        dlc: parseInt(m[3], 10),
        transmitter: m[4],
        comment: '',
        cycleTime: null,
        signals: [],
        sigByName: {},
        line: ln
      };
      // 11 bit'e sığmayan bir kimlik uzatılmış bayrağı olmadan da gelebilir
      // (bazı üreticiler bayrağı yazmıyor). Sessizce kabul edilir ama
      // eşleştirmede bilinsin diye işaretlenir.
      if (!msg.extended && msg.id > 0x7FF) msg.extended = true;
      db.messages.push(msg);
      byRawId[rawId] = msg;
      byRawId[msg.id] = byRawId[msg.id] || msg;
      var k = cdbMsgKey(msg.id, msg.extended);
      if (db.byKey[k]) warn(ln, 'Kimlik çakışması: ' + msg.name + ' ile ' + db.byKey[k].name + ' aynı kimliği (' + cdbFmtId(msg.id, msg.extended) + ') kullanıyor.');
      else db.byKey[k] = msg;
      cur = msg;
      continue;
    }

    // SG_ — sinyal (yalnız bir BO_ içindeyken anlamlı)
    if (/^SG_\s/.test(s)) {
      var g = CDB_RE_SG.exec(raw);
      if (!g) { warn(ln, 'SG_ satırı okunamadı: ' + s.slice(0, 90)); continue; }
      if (!cur) { warn(ln, 'SG_ bir BO_ dışında: ' + g[1]); continue; }
      var mux = g[2] || '';
      var sig = {
        name: g[1],
        startBit: parseInt(g[3], 10),
        length: parseInt(g[4], 10),
        littleEndian: g[5] === '1',
        signed: g[6] === '-',
        factor: cdbNum(g[7], 1),
        offset: cdbNum(g[8], 0),
        min: cdbNum(g[9], null),
        max: cdbNum(g[10], null),
        unit: g[11] || '',
        receivers: (g[12] || '').trim().split(/[\s,]+/).filter(function(x) { return x && x !== 'Vector__XXX'; }),
        isMuxor: mux === 'M' || /^m\d+M$/.test(mux),
        muxValue: /^m(\d+)/.test(mux) ? parseInt(/^m(\d+)/.exec(mux)[1], 10) : null,
        muxRanges: null,     // SG_MUL_VAL_ ile gelir (genişletilmiş çoklama)
        valueType: 'int',    // SIG_VALTYPE_ ile 'float' / 'double' olabilir
        comment: '',
        values: null,        // VAL_ ile gelen sayı → metin sözlüğü
        msgKey: cdbMsgKey(cur.id, cur.extended),
        msgName: cur.name,
        line: ln
      };
      if (sig.length <= 0) { warn(ln, 'Sinyal uzunluğu 0: ' + sig.name); continue; }
      // 53 bitten uzun bir sinyalin ham değeri IEEE-754 çift duyarlıkta TAM
      // temsil edilemez. Sessizce yuvarlamak yerine söyle.
      if (sig.length > 53 && sig.valueType === 'int') {
        warn(ln, sig.name + ': ' + sig.length + ' bit — ham değer 53 bitten uzun, düşük bitler yuvarlanır.');
      }
      if (cur.sigByName[sig.name]) warn(ln, cur.name + ' içinde iki kez ' + sig.name);
      cur.signals.push(sig);
      cur.sigByName[sig.name] = sig;
      continue;
    }

    // Deyim başlangıcı → BO_ kapsamı biter
    if (/^(BO_|BU_|VAL_|CM_|BA_|VERSION|NS_|BS_|VAL_TABLE_|SIG_VALTYPE_|SG_MUL_VAL_|BO_TX_BU_|EV_|SIG_GROUP_)/.test(s)) cur = null;

    var vm = CDB_RE_VERSION.exec(raw);
    if (vm) { db.version = vm[1]; continue; }

    var bu = CDB_RE_BU.exec(raw);
    if (bu) {
      db.nodes = bu[1].trim().split(/[\s,]+/).filter(function(x) { return x.length; });
      continue;
    }

    if (/^VAL_TABLE_\s/.test(s)) { cdbApplyValTable(db, s, ln, warn); continue; }
    if (/^VAL_\s/.test(s))       { cdbApplyVal(db, byRawId, s, ln, warn); continue; }
    if (/^CM_\s/.test(s))        { cdbApplyComment(db, byRawId, s, ln); continue; }
    if (/^BA_\s/.test(s))        { cdbApplyAttr(db, byRawId, s, ln); continue; }
    if (/^SIG_VALTYPE_\s/.test(s)) { cdbApplyValType(db, byRawId, s, ln, warn); continue; }
    if (/^SG_MUL_VAL_\s/.test(s))  { cdbApplyMulVal(db, byRawId, s, ln, warn); continue; }
    // Kalanı (NS_, BS_, BA_DEF_, SIG_GROUP_, EV_ …) bu programın işine
    // yaramıyor; sessizce geçilir — uyarı listesini gürültüye boğmaz.
  }

  // Çoklayıcısı olmayan ama m<n> sinyali olan mesaj → sessiz yanlış çözüm
  // kaynağı. Çözümleyici o sinyalleri atlar; sebebini burada söyle.
  for (var i = 0; i < db.messages.length; i++) {
    var mm = db.messages[i];
    var hasMuxed = false, hasMuxor = false;
    for (var j = 0; j < mm.signals.length; j++) {
      if (mm.signals[j].muxValue !== null) hasMuxed = true;
      if (mm.signals[j].isMuxor) hasMuxor = true;
    }
    mm.multiplexed = hasMuxed;
    mm.muxor = null;
    if (hasMuxor) {
      for (var j2 = 0; j2 < mm.signals.length; j2++) if (mm.signals[j2].isMuxor) { mm.muxor = mm.signals[j2]; break; }
    }
    if (hasMuxed && !hasMuxor) warn(mm.line, mm.name + ': çoklanmış sinyal var ama çoklayıcı (M) sinyali yok — o sinyaller çözülemez.');
    // Kare sınırını aşan sinyal: DLC 8 iken 64. bitten okumak
    for (var j3 = 0; j3 < mm.signals.length; j3++) {
      var sg = mm.signals[j3];
      var top = cdbSignalTopBit(sg);
      if (top > mm.dlc * 8) warn(sg.line, mm.name + '.' + sg.name + ': sinyal ' + top + '. bite kadar uzanıyor ama mesaj ' + mm.dlc + ' bayt (' + (mm.dlc * 8) + ' bit).');
    }
  }

  return db;
}

// Sinyalin dokunduğu EN YÜKSEK bit numarası +1 (kapsam denetimi için).
function cdbSignalTopBit(sig) {
  if (sig.littleEndian) return sig.startBit + sig.length;
  // Motorola: başlangıç biti MSB'dir; sinyal bayt bayt AŞAĞI doğru ilerler.
  var byteIx = sig.startBit >> 3;
  var bitIx  = sig.startBit & 7;
  var rem = sig.length - (bitIx + 1);
  var bytes = 1 + (rem > 0 ? Math.ceil(rem / 8) : 0);
  return (byteIx + bytes) * 8;
}

// ── Yardımcı deyimler ─────────────────────────────────────────────────────

// "a" "b" "c" biçimindeki tırnaklı dizgeleri ve aralarındaki sayıları çeker.
function cdbPairs(s) {
  var out = {};
  var re = /(-?\d+)\s*"((?:[^"\\]|\\.)*)"/g, m;
  while ((m = re.exec(s)) !== null) out[parseInt(m[1], 10)] = m[2].replace(/\\"/g, '"');
  return out;
}

function cdbApplyValTable(db, s, ln, warn) {
  var m = /^VAL_TABLE_\s+(\S+)\s*([\s\S]*);\s*$/.exec(s);
  if (!m) { warn(ln, 'VAL_TABLE_ okunamadı.'); return; }
  db.valueTables[m[1]] = cdbPairs(m[2]);
}

function cdbApplyVal(db, byRawId, s, ln, warn) {
  var m = /^VAL_\s+(\d+)\s+(\S+)\s*([\s\S]*);\s*$/.exec(s);
  if (!m) { warn(ln, 'VAL_ okunamadı: ' + s.slice(0, 80)); return; }
  var msg = byRawId[parseInt(m[1], 10) >>> 0] || byRawId[(parseInt(m[1], 10) >>> 0) & 0x1FFFFFFF];
  if (!msg) { warn(ln, 'VAL_ tanımsız mesaja işaret ediyor: ' + m[1]); return; }
  var sig = msg.sigByName[m[2]];
  if (!sig) { warn(ln, 'VAL_ tanımsız sinyale işaret ediyor: ' + msg.name + '.' + m[2]); return; }
  var rest = m[3].trim();
  // "VAL_ 100 Sig TabloAdi ;" — bir değer tablosuna atıf
  if (/^[A-Za-z_]\w*$/.test(rest)) sig.values = db.valueTables[rest] || null;
  else sig.values = cdbPairs(rest);
}

function cdbApplyComment(db, byRawId, s, ln) {
  var m = /^CM_\s+SG_\s+(\d+)\s+(\S+)\s+"([\s\S]*)"\s*;\s*$/.exec(s);
  if (m) {
    var msg = byRawId[parseInt(m[1], 10) >>> 0] || byRawId[(parseInt(m[1], 10) >>> 0) & 0x1FFFFFFF];
    if (msg && msg.sigByName[m[2]]) msg.sigByName[m[2]].comment = m[3];
    return;
  }
  m = /^CM_\s+BO_\s+(\d+)\s+"([\s\S]*)"\s*;\s*$/.exec(s);
  if (m) {
    var msg2 = byRawId[parseInt(m[1], 10) >>> 0] || byRawId[(parseInt(m[1], 10) >>> 0) & 0x1FFFFFFF];
    if (msg2) msg2.comment = m[2];
    return;
  }
  // CM_ BU_ … ve genel açıklama bu programda kullanılmıyor.
}

function cdbApplyAttr(db, byRawId, s, ln) {
  // Yalnız çevrim süresi okunuyor: ağaçta mesajın periyodunu göstermek için.
  var m = /^BA_\s+"GenMsgCycleTime"\s+BO_\s+(\d+)\s+(-?[\d.]+)\s*;\s*$/.exec(s);
  if (!m) return;
  var msg = byRawId[parseInt(m[1], 10) >>> 0] || byRawId[(parseInt(m[1], 10) >>> 0) & 0x1FFFFFFF];
  var v = parseFloat(m[2]);
  if (msg && isFinite(v) && v > 0) msg.cycleTime = v;
}

function cdbApplyValType(db, byRawId, s, ln, warn) {
  var m = /^SIG_VALTYPE_\s+(\d+)\s+(\S+)\s*:?\s*(\d+)\s*;\s*$/.exec(s);
  if (!m) return;
  var msg = byRawId[parseInt(m[1], 10) >>> 0] || byRawId[(parseInt(m[1], 10) >>> 0) & 0x1FFFFFFF];
  if (!msg) return;
  var sig = msg.sigByName[m[2]];
  if (!sig) return;
  var t = parseInt(m[3], 10);
  if (t === 1) sig.valueType = 'float';
  else if (t === 2) sig.valueType = 'double';
  if (sig.valueType === 'float' && sig.length !== 32) warn(ln, msg.name + '.' + sig.name + ': IEEE float bildirildi ama uzunluk ' + sig.length + ' bit (32 olmalı).');
  if (sig.valueType === 'double' && sig.length !== 64) warn(ln, msg.name + '.' + sig.name + ': IEEE double bildirildi ama uzunluk ' + sig.length + ' bit (64 olmalı).');
}

// SG_MUL_VAL_ <msgid> <sinyal> <çoklayıcı> <alt>-<üst>, … ;
// Genişletilmiş çoklama: bir sinyal birden çok çoklayıcı değerinde geçerli.
function cdbApplyMulVal(db, byRawId, s, ln, warn) {
  var m = /^SG_MUL_VAL_\s+(\d+)\s+(\S+)\s+(\S+)\s+([\s\S]*);\s*$/.exec(s);
  if (!m) return;
  var msg = byRawId[parseInt(m[1], 10) >>> 0] || byRawId[(parseInt(m[1], 10) >>> 0) & 0x1FFFFFFF];
  if (!msg) return;
  var sig = msg.sigByName[m[2]];
  if (!sig) return;
  var ranges = [];
  var re = /(\d+)\s*-\s*(\d+)/g, r;
  while ((r = re.exec(m[4])) !== null) ranges.push([parseInt(r[1], 10), parseInt(r[2], 10)]);
  if (ranges.length) {
    sig.muxRanges = ranges;
    if (sig.muxValue === null) sig.muxValue = ranges[0][0];
  }
  sig.muxorName = m[3];
}

// ── Kimlik biçimleri ──────────────────────────────────────────────────────

// Mesaj anahtarı: 'S' + kimlik (standart) / 'E' + kimlik (uzatılmış).
// Kimlik TEK BAŞINA yetmez — 0x100 hem 11 bit hem 29 bit çerçeve olabilir ve
// ikisi ayrı mesajdır.
function cdbMsgKey(id, extended) {
  return (extended ? 'E' : 'S') + (id >>> 0).toString(16).toUpperCase();
}

// 0x18FEF100 gibi; standart kimlikler 3, uzatılmışlar 8 hane.
function cdbFmtId(id, extended) {
  var h = (id >>> 0).toString(16).toUpperCase();
  var w = extended ? 8 : 3;
  while (h.length < w) h = '0' + h;
  return '0x' + h;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cdbParseDbc: cdbParseDbc,
    cdbSplitLines: cdbSplitLines,
    cdbSplitStatements: cdbSplitStatements,
    cdbIndexOfUnquoted: cdbIndexOfUnquoted,
    cdbMsgKey: cdbMsgKey,
    cdbFmtId: cdbFmtId,
    cdbSignalTopBit: cdbSignalTopBit,
    CDB_EXT_FLAG: CDB_EXT_FLAG
  };
}
