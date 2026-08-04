// ═══════════════════════════════════════════════════════════════════════════
// XLSX / CSV OKUYUCU — sıfır bağımlılık, saf JS
// ═══════════════════════════════════════════════════════════════════════════
//
// Neden kendi okuyucumuz: build.js her şeyi TEK bir MFSim_Code.html'e gömüyor.
// SheetJS'in tam sürümü ~900 KB; bu dosyaya %18 ekliyor ve npm'deki kopyası
// 2022'den beri güncellenmiyor. Buradaki okuyucu ~26 KB (yorumlar dahil, ham
// hâliyle gömülüyor) ve yalnızca bizim ihtiyacımız olan alt kümeyi çözüyor:
// DİKDÖRTGEN bir ölçüm sayfası
// (başlık satırı + sayı/metin hücreleri). Formül, grafik, pivot, koşullu
// biçim OKUNMAZ — ölçüm dosyasında bunlar yok.
//
// TASARIM KARARI — inflate neden saf JS:
// Tarayıcıda DecompressionStream('deflate-raw') var ama ASENKRON ve jsdom'da
// YOK. Sıkıştırmayı saf JS'te çözünce (a) tek kod yolu kalıyor, (b) Jest'te
// gerçek .xlsx baytları üzerinde test edilebiliyor, (c) eski tarayıcı da
// çalışıyor. Bedeli hız; ölçüm dosyası boyutlarında (onlarca MB'a kadar)
// kabul edilebilir ölçüldü.
//
// Katman sınırı: BU DOSYA BİÇİMİ ÇÖZER, ANLAM YÜKLEMEZ. "Hangi sütun zaman
// ekseni", "birim ne", "ondalık virgül mü nokta mı" sorularının yeri
// js/measure-import.js. Burada hücrede ne yazıyorsa o döner.

// ── DEFLATE (RFC 1951, ham akış) ──────────────────────────────────────────

var VE_XLS_LEN_BASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,
                       67,83,99,115,131,163,195,227,258];
var VE_XLS_LEN_EXTRA = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
var VE_XLS_DIST_BASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,
                        769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
var VE_XLS_DIST_EXTRA = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
// Kod uzunluğu alfabesinin akıştaki sırası — RFC 1951 §3.2.7.
var VE_XLS_CLEN_ORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

// Kanonik Huffman tablosu: uzunluk başına kaç kod var (count) ve kodların
// sembol karşılıkları (symbol). zlib'in "puff" referans çözücüsüyle aynı
// gösterim — tablo kurmak yerine bit bit ilerleyip aralık karşılaştırıyor,
// bu yüzden kısa ve doğrulaması kolay.
function veXlsBuildHuff(lengths, off, num) {
  var count = new Int32Array(16), i;
  for(i = 0; i < num; i++) count[lengths[off + i]]++;
  count[0] = 0;
  var offs = new Int32Array(16);
  for(i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
  var symbol = new Int32Array(num);
  for(i = 0; i < num; i++) {
    var L = lengths[off + i];
    if(L) symbol[offs[L]++] = i;
  }
  return { count: count, symbol: symbol };
}

// Ham deflate akışını çözer. Girdi/çıktı Uint8Array.
function veXlsInflateRaw(src) {
  var srcLen = src.length;
  var pos = 0, bitBuf = 0, bitCnt = 0;
  var out = new Uint8Array(srcLen < 4096 ? 16384 : srcLen * 4);
  var outLen = 0;

  function grow(need) {
    if(outLen + need <= out.length) return;
    var cap = out.length;
    while(cap < outLen + need) cap *= 2;
    var n = new Uint8Array(cap);
    n.set(out.subarray(0, outLen));
    out = n;
  }

  function bits(n) {
    if(n === 0) return 0;
    var v = bitBuf;
    while(bitCnt < n) {
      if(pos >= srcLen) throw new Error('deflate: akış beklenmedik şekilde bitti');
      v |= src[pos++] << bitCnt;
      bitCnt += 8;
    }
    bitBuf = v >>> n;
    bitCnt -= n;
    return v & ((1 << n) - 1);
  }

  function decode(h) {
    var code = 0, first = 0, index = 0, cnt = h.count;
    for(var len = 1; len <= 15; len++) {
      code |= bits(1);
      var c = cnt[len];
      if(code - first < c) return h.symbol[index + (code - first)];
      index += c;
      first = (first + c) << 1;
      code <<= 1;
    }
    throw new Error('deflate: geçersiz Huffman kodu');
  }

  var fixedLit = null, fixedDist = null;
  function fixedTrees() {
    if(fixedLit) return;
    var l = new Uint8Array(288), i = 0;
    for(; i < 144; i++) l[i] = 8;
    for(; i < 256; i++) l[i] = 9;
    for(; i < 280; i++) l[i] = 7;
    for(; i < 288; i++) l[i] = 8;
    fixedLit = veXlsBuildHuff(l, 0, 288);
    var d = new Uint8Array(30);
    for(i = 0; i < 30; i++) d[i] = 5;
    fixedDist = veXlsBuildHuff(d, 0, 30);
  }

  var last;
  do {
    last = bits(1);
    var type = bits(2);

    if(type === 0) {
      // Saklanan blok: bayt sınırına hizalan, LEN/NLEN oku, ham kopyala.
      bitBuf = 0; bitCnt = 0;
      if(pos + 4 > srcLen) throw new Error('deflate: saklanan blok başlığı eksik');
      var len = src[pos] | (src[pos + 1] << 8);
      var nlen = src[pos + 2] | (src[pos + 3] << 8);
      pos += 4;
      if((len ^ 0xffff) !== nlen) throw new Error('deflate: saklanan blok uzunluğu tutarsız');
      if(pos + len > srcLen) throw new Error('deflate: saklanan blok verisi eksik');
      grow(len);
      out.set(src.subarray(pos, pos + len), outLen);
      outLen += len; pos += len;

    } else if(type === 1 || type === 2) {
      var lit, dist;
      if(type === 1) {
        fixedTrees(); lit = fixedLit; dist = fixedDist;
      } else {
        var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        var cl = new Uint8Array(19), i;
        for(i = 0; i < hclen; i++) cl[VE_XLS_CLEN_ORDER[i]] = bits(3);
        var clTree = veXlsBuildHuff(cl, 0, 19);
        var total = hlit + hdist;
        var lens = new Uint8Array(total);
        i = 0;
        while(i < total) {
          var sym = decode(clTree), rep, val;
          if(sym < 16) { lens[i++] = sym; continue; }
          if(sym === 16) {
            if(i === 0) throw new Error('deflate: tekrar kodu önceki uzunluk olmadan geldi');
            val = lens[i - 1]; rep = 3 + bits(2);
          } else if(sym === 17) { val = 0; rep = 3 + bits(3); }
          else { val = 0; rep = 11 + bits(7); }
          if(i + rep > total) throw new Error('deflate: kod uzunluğu tablosu taştı');
          while(rep-- > 0) lens[i++] = val;
        }
        lit = veXlsBuildHuff(lens, 0, hlit);
        dist = veXlsBuildHuff(lens, hlit, hdist);
      }

      for(;;) {
        var s = decode(lit);
        if(s < 256) { grow(1); out[outLen++] = s; continue; }
        if(s === 256) break;
        s -= 257;
        if(s >= 29) throw new Error('deflate: geçersiz uzunluk kodu');
        var length = VE_XLS_LEN_BASE[s] + bits(VE_XLS_LEN_EXTRA[s]);
        var ds = decode(dist);
        if(ds >= 30) throw new Error('deflate: geçersiz mesafe kodu');
        var distance = VE_XLS_DIST_BASE[ds] + bits(VE_XLS_DIST_EXTRA[ds]);
        if(distance > outLen) throw new Error('deflate: geri başvuru pencere dışında');
        grow(length);
        var from = outLen - distance;
        // Örtüşen kopya olabilir (distance < length) — bayt bayt kopyalanmalı.
        for(var k = 0; k < length; k++) out[outLen++] = out[from + k];
      }

    } else {
      throw new Error('deflate: ayrılmış blok tipi (bozuk dosya)');
    }
  } while(!last);

  return out.subarray(0, outLen);
}

// ── ZIP okuyucu ───────────────────────────────────────────────────────────

function veXlsU16(b, p) { return b[p] | (b[p + 1] << 8); }
function veXlsU32(b, p) {
  return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) + b[p + 3] * 16777216;
}
function veXlsU64(b, p) {
  // 2^53 üstü zaten ArrayBuffer sınırının ötesinde; çift duyarlıkla okumak yeterli.
  return veXlsU32(b, p) + veXlsU32(b, p + 4) * 4294967296;
}

// ZIP merkezi dizinini okur ve ad → giriş sözlüğü döndürür. Girişler TEMBEL
// çözülür: 20 sayfalık bir çalışma kitabında yalnızca istenen sayfa açılır.
function veXlsZipRead(bytes) {
  var n = bytes.length;
  if(n < 22) throw new Error('ZIP: dosya çok küçük');

  // EOCD imzası (PK\5\6) sondan geriye aranır — sonda 64 KB'a kadar yorum olabilir.
  var eocd = -1;
  var limit = Math.max(0, n - 65557);
  for(var i = n - 22; i >= limit; i--) {
    if(bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocd = i; break;
    }
  }
  if(eocd < 0) throw new Error('ZIP: merkezi dizin sonu (EOCD) bulunamadı — dosya .xlsx değil ya da bozuk');

  var count = veXlsU16(bytes, eocd + 10);
  var cdOff = veXlsU32(bytes, eocd + 16);

  // ZIP64: alanlar 0xFFFF/0xFFFFFFFF ile doldurulmuşsa gerçek değerler
  // ZIP64 EOCD kaydında. Locator, EOCD'den 20 bayt önce durur.
  if(count === 0xffff || cdOff === 0xffffffff) {
    var loc = eocd - 20;
    if(loc >= 0 && bytes[loc] === 0x50 && bytes[loc + 1] === 0x4b &&
       bytes[loc + 2] === 0x06 && bytes[loc + 3] === 0x07) {
      var z64 = veXlsU64(bytes, loc + 8);
      if(z64 >= 0 && z64 + 56 <= n && bytes[z64] === 0x50 && bytes[z64 + 1] === 0x4b &&
         bytes[z64 + 2] === 0x06 && bytes[z64 + 3] === 0x06) {
        count = veXlsU64(bytes, z64 + 32);
        cdOff = veXlsU64(bytes, z64 + 48);
      }
    }
  }

  var entries = {};
  var p = cdOff;
  for(var e = 0; e < count; e++) {
    if(p + 46 > n) break;
    if(veXlsU32(bytes, p) !== 0x02014b50) break;
    var method = veXlsU16(bytes, p + 10);
    var compSize = veXlsU32(bytes, p + 20);
    var nameLen = veXlsU16(bytes, p + 28);
    var extraLen = veXlsU16(bytes, p + 30);
    var cmtLen = veXlsU16(bytes, p + 32);
    var localOff = veXlsU32(bytes, p + 42);

    var name = '';
    for(var c = 0; c < nameLen; c++) name += String.fromCharCode(bytes[p + 46 + c]);
    // Girişin adı UTF-8 olabilir (bayrak 0x800). Yol adları ASCII olduğu için
    // ölçüm dosyalarında fark etmiyor; yine de çöz.
    if(veXlsU16(bytes, p + 8) & 0x800) {
      try { name = veXlsUtf8(bytes.subarray(p + 46, p + 46 + nameLen)); } catch(err) {}
    }

    // ZIP64 ek alanı: 0xFFFFFFFF olan boyut/ofset burada gerçek değerini alır.
    if(compSize === 0xffffffff || localOff === 0xffffffff) {
      var xp = p + 46 + nameLen, xEnd = xp + extraLen;
      while(xp + 4 <= xEnd) {
        var hid = veXlsU16(bytes, xp), hsz = veXlsU16(bytes, xp + 2);
        if(hid === 0x0001) {
          var q = xp + 4;
          // Sıra: uncompressed, compressed, localHeaderOffset — yalnızca
          // 0xFFFFFFFF olanlar yazılır.
          if(veXlsU32(bytes, p + 24) === 0xffffffff) q += 8;
          if(compSize === 0xffffffff) { compSize = veXlsU64(bytes, q); q += 8; }
          if(localOff === 0xffffffff) { localOff = veXlsU64(bytes, q); q += 8; }
          break;
        }
        xp += 4 + hsz;
      }
    }

    entries[name] = { method: method, compSize: compSize, localOff: localOff };
    p += 46 + nameLen + extraLen + cmtLen;
  }

  function has(name) { return Object.prototype.hasOwnProperty.call(entries, name); }

  function read(name) {
    if(!has(name)) throw new Error('ZIP: giriş yok — ' + name);
    var en = entries[name];
    var lo = en.localOff;
    if(lo + 30 > n || veXlsU32(bytes, lo) !== 0x04034b50) {
      throw new Error('ZIP: yerel başlık bozuk — ' + name);
    }
    // Yerel başlıktaki ad/ek alan uzunlukları merkezi dizindekinden FARKLI
    // olabilir; veri konumu için yerel olanlar geçerlidir.
    var start = lo + 30 + veXlsU16(bytes, lo + 26) + veXlsU16(bytes, lo + 28);
    var raw = bytes.subarray(start, start + en.compSize);
    if(en.method === 0) return raw;
    if(en.method === 8) return veXlsInflateRaw(raw);
    throw new Error('ZIP: desteklenmeyen sıkıştırma yöntemi (' + en.method + ')');
  }

  return { entries: entries, has: has, read: read, names: Object.keys(entries) };
}

// ── UTF-8 ─────────────────────────────────────────────────────────────────

// TextDecoder tarayıcıda var, jsdom'da yok. Elle çözüm hem testte hem
// tarayıcıda aynı sonucu vermeli — hızlı yol varsa o kullanılır.
function veXlsUtf8(bytes) {
  if(typeof TextDecoder !== 'undefined') {
    try { return new TextDecoder('utf-8').decode(bytes); } catch(e) {}
  }
  var out = '', i = 0, n = bytes.length, chunk = [];
  while(i < n) {
    var b = bytes[i++], cp;
    if(b < 0x80) cp = b;
    else if(b < 0xe0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if(b < 0xf0) {
      cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) |
           ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    }
    if(cp > 0xffff) {
      cp -= 0x10000;
      chunk.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else chunk.push(cp);
    // String.fromCharCode'a bir seferde çok argüman verilirse yığın taşar.
    if(chunk.length >= 4096) { out += String.fromCharCode.apply(null, chunk); chunk.length = 0; }
  }
  if(chunk.length) out += String.fromCharCode.apply(null, chunk);
  return out;
}

// ── XML yardımcıları ──────────────────────────────────────────────────────

function veXlsUnescape(s) {
  if(s.indexOf('&') < 0) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, function(m, ent) {
    switch(ent) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
    }
    var code = (ent.charAt(1) === 'x' || ent.charAt(1) === 'X')
      ? parseInt(ent.substring(2), 16) : parseInt(ent.substring(1), 10);
    return isFinite(code) ? String.fromCharCode(code) : m;
  });
}

function veXlsAttr(tag, name) {
  var re = new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"');
  var m = re.exec(tag);
  if(m) return veXlsUnescape(m[1]);
  re = new RegExp('\\b' + name + "\\s*=\\s*'([^']*)'");
  m = re.exec(tag);
  return m ? veXlsUnescape(m[1]) : null;
}

// Bazı üreticiler ad alanı öneki kullanır (<x:row>). Deseni tek biçime indir.
function veXlsStripNs(xml) {
  return /<\w+:(?:row|sheetData|c|si|sheet)\b/.test(xml)
    ? xml.replace(/<(\/?)[A-Za-z0-9_.\-]+:/g, '<$1')
    : xml;
}

// "BC" → 54. Hücrenin r="BC12" başvurusundan sütun indeksi.
function veXlsColIndex(ref) {
  var n = 0;
  for(var i = 0; i < ref.length; i++) {
    var c = ref.charCodeAt(i);
    if(c >= 65 && c <= 90) n = n * 26 + (c - 64);
    else if(c >= 97 && c <= 122) n = n * 26 + (c - 96);
    else break;
  }
  return n - 1;
}

// ── xlsx parçaları ────────────────────────────────────────────────────────

// sharedStrings.xml → dizi. Zengin metin (<si><r><t>..</t></r>…) parçaları
// birleştirilir: ölçüm başlıklarında biçimlendirme olabiliyor.
function veXlsSharedStrings(xml) {
  xml = veXlsStripNs(xml);
  var out = [];
  var siRe = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g, m;
  while((m = siRe.exec(xml)) !== null) {
    var body = m[1];
    if(body == null) { out.push(''); continue; }
    var s = '', tRe = /<t\b([^>]*)>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g, t;
    while((t = tRe.exec(body)) !== null) s += (t[2] == null ? '' : veXlsUnescape(t[2]));
    out.push(s);
  }
  return out;
}

var VE_XLS_DATE_FMT_IDS = [14,15,16,17,18,19,20,21,22,45,46,47];

// styles.xml → hangi stil indeksleri tarih/saat biçimli. Zaman sütunu mutlak
// zaman damgası olarak yazılmışsa hücrede seri numarası durur; anlamı ancak
// biçim koduyla anlaşılır.
function veXlsDateStyles(xml) {
  xml = veXlsStripNs(xml);
  var custom = {};
  var nfRe = /<numFmt\b([^>]*)\/?>/g, m;
  while((m = nfRe.exec(xml)) !== null) {
    var id = parseInt(veXlsAttr(m[1], 'numFmtId'), 10);
    var code = veXlsAttr(m[1], 'formatCode') || '';
    if(!isFinite(id)) continue;
    // Tırnaklı metin ve [Renk]/[h] gibi köşeli bölümler atılır, kalanda
    // y/m/d/h/s aranır. Aksi hâlde "0.000" biçimi tarih sanılabilirdi.
    var bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
    custom[id] = /[ymdhs]/i.test(bare);
  }

  var xfBlock = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  var isDate = {};
  if(!xfBlock) return isDate;
  var xfRe = /<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g, idx = 0, x;
  while((x = xfRe.exec(xfBlock[1])) !== null) {
    var nid = parseInt(veXlsAttr(x[1], 'numFmtId'), 10);
    if(isFinite(nid)) {
      isDate[idx] = Object.prototype.hasOwnProperty.call(custom, nid)
        ? custom[nid] : (VE_XLS_DATE_FMT_IDS.indexOf(nid) >= 0);
    }
    idx++;
  }
  return isDate;
}

// Bir sayfanın hücrelerini satır dizisine açar. Seyrek hücreler (CAN sinyalleri
// farklı periyotlarla geldiği için sık) r="B7" başvurusundan doğru sütuna
// yerleşir; atlanan hücre null kalır — "0" DEĞİL, çünkü sıfır geçerli bir
// ölçüm değeri ve boşlukla karıştırılmamalı.
function veXlsParseSheet(xml, shared, dateStyles, maxRows) {
  xml = veXlsStripNs(xml);
  var sd = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml);
  var body = sd ? sd[1] : xml;

  var rows = [], dateCols = {}, width = 0;
  var rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, rm;
  var truncated = false;

  while((rm = rowRe.exec(body)) !== null) {
    if(maxRows && rows.length >= maxRows) { truncated = true; break; }
    var cells = [];
    var content = rm[2];
    if(content) {
      var cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
      var auto = 0;
      while((cm = cRe.exec(content)) !== null) {
        var attrs = cm[1], inner = cm[2];
        var ref = veXlsAttr(attrs, 'r');
        var col = ref ? veXlsColIndex(ref) : auto;
        if(col < 0) col = auto;
        auto = col + 1;

        var t = veXlsAttr(attrs, 't');
        var val = null;
        if(inner) {
          if(t === 'inlineStr') {
            var isM = /<is\b[^>]*>([\s\S]*?)<\/is>/.exec(inner);
            var src = isM ? isM[1] : inner;
            var s = '', tRe2 = /<t\b[^>]*>([\s\S]*?)<\/t>/g, tm2;
            while((tm2 = tRe2.exec(src)) !== null) s += veXlsUnescape(tm2[1]);
            val = s;
          } else {
            var vM = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
            if(vM) {
              var raw = veXlsUnescape(vM[1]);
              if(t === 's') {
                var si = parseInt(raw, 10);
                val = (isFinite(si) && si >= 0 && si < shared.length) ? shared[si] : '';
              } else if(t === 'b') {
                val = (raw === '1');
              } else if(t === 'e') {
                val = null;                       // #N/A, #DIV/0! → veri yok
              } else if(t === 'str') {
                val = raw;                        // formül sonucu metin
              } else {
                var num = parseFloat(raw);
                val = isFinite(num) ? num : (raw === '' ? null : raw);
                if(typeof val === 'number') {
                  var sIdx = parseInt(veXlsAttr(attrs, 's'), 10);
                  if(isFinite(sIdx) && dateStyles[sIdx]) dateCols[col] = true;
                }
              }
            }
          }
        }
        while(cells.length < col) cells.push(null);
        cells[col] = val;
      }
    }
    if(cells.length > width) width = cells.length;
    rows.push(cells);
  }

  // Satırları eşit genişliğe tamamla — tüketiciler dikdörtgen bekliyor.
  for(var i = 0; i < rows.length; i++) {
    while(rows[i].length < width) rows[i].push(null);
  }

  return { rows: rows, dateCols: dateCols, truncated: truncated };
}

// ── Genel giriş noktası ───────────────────────────────────────────────────

// .xlsx baytlarını açar. Sayfa İÇERİKLERİ tembel okunur: kullanıcı önce
// sayfayı seçer, yalnızca o çözülür — 20 sayfalık kitapta 19'unu boşuna
// açmak hem yavaş hem belleği şişiriyor.
function veXlsOpen(bytes) {
  if(bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
  var zip = veXlsZipRead(bytes);

  if(!zip.has('xl/workbook.xml')) {
    throw new Error('Bu dosya bir Excel çalışma kitabı değil (xl/workbook.xml yok).');
  }

  var wb = veXlsStripNs(veXlsUtf8(zip.read('xl/workbook.xml')));

  // rId → hedef yol eşlemesi
  var rels = {};
  if(zip.has('xl/_rels/workbook.xml.rels')) {
    var rx = veXlsUtf8(zip.read('xl/_rels/workbook.xml.rels'));
    var rRe = /<Relationship\b([^>]*)\/?>/g, rm2;
    while((rm2 = rRe.exec(rx)) !== null) {
      var rid = veXlsAttr(rm2[1], 'Id');
      var tgt = veXlsAttr(rm2[1], 'Target');
      if(rid && tgt) rels[rid] = tgt;
    }
  }

  function resolve(target, i) {
    if(!target) return 'xl/worksheets/sheet' + (i + 1) + '.xml';
    var t = String(target).replace(/^\.\//, '');
    if(t.charAt(0) === '/') t = t.substring(1);
    else if(t.indexOf('xl/') !== 0) t = 'xl/' + t;
    return t;
  }

  var sheets = [];
  var shRe = /<sheet\b([^>]*)\/?>/g, sm;
  while((sm = shRe.exec(wb)) !== null) {
    var nm = veXlsAttr(sm[1], 'name');
    if(nm == null) continue;
    var rid2 = veXlsAttr(sm[1], 'id') || veXlsAttr(sm[1], 'r:id');
    var path = resolve(rels[rid2], sheets.length);
    if(!zip.has(path)) {
      var alt = 'xl/worksheets/sheet' + (sheets.length + 1) + '.xml';
      path = zip.has(alt) ? alt : path;
    }
    sheets.push({ name: nm, path: path });
  }

  // workbook.xml okunamadıysa sayfaları dosya adlarından tahmin et.
  if(sheets.length === 0) {
    zip.names.forEach(function(nm2) {
      if(/^xl\/worksheets\/sheet\d+\.xml$/.test(nm2)) {
        sheets.push({ name: nm2.replace(/^.*\/|\.xml$/g, ''), path: nm2 });
      }
    });
  }

  var _shared = null, _styles = null;
  function shared() {
    if(_shared) return _shared;
    _shared = zip.has('xl/sharedStrings.xml')
      ? veXlsSharedStrings(veXlsUtf8(zip.read('xl/sharedStrings.xml'))) : [];
    return _shared;
  }
  function styles() {
    if(_styles) return _styles;
    _styles = zip.has('xl/styles.xml')
      ? veXlsDateStyles(veXlsUtf8(zip.read('xl/styles.xml'))) : {};
    return _styles;
  }

  function readSheet(i, maxRows) {
    var sh = sheets[i];
    if(!sh) throw new Error('Sayfa yok: ' + i);
    if(!zip.has(sh.path)) throw new Error('Sayfa verisi bulunamadı: ' + sh.path);
    var parsed = veXlsParseSheet(veXlsUtf8(zip.read(sh.path)), shared(), styles(), maxRows);
    parsed.name = sh.name;
    return parsed;
  }

  return { sheets: sheets, readSheet: readSheet, zip: zip };
}

// ── CSV / TSV ─────────────────────────────────────────────────────────────

// Ayracı ilk satırlara bakarak seçer. Ondalık VİRGÜL kullanan bir dışa
// aktarımda ayraç noktalı virgüldür; virgülü ayraç sanmak tüm sayıları
// ikiye böler — bu yüzden aday başına satır başı tutarlılığa bakılır.
function veXlsSniffDelimiter(text) {
  var lines = text.split(/\r\n|\n|\r/).filter(function(l) { return l.trim() !== ''; }).slice(0, 20);
  if(lines.length === 0) return ',';
  var best = ',', bestScore = -1;
  [';', '\t', ',', '|'].forEach(function(d) {
    var counts = lines.map(function(l) {
      // Tırnak içindeki ayraçlar sayılmamalı.
      var n = 0, inQ = false;
      for(var i = 0; i < l.length; i++) {
        var ch = l.charAt(i);
        if(ch === '"') inQ = !inQ;
        else if(ch === d && !inQ) n++;
      }
      return n;
    });
    // Ayracı HİÇ içermeyen satırlar (tek hücrelik başlık/açıklama satırı gibi)
    // adayı elemez, yalnızca oylamaya katılmaz. Eskiden ilk satır ayracı
    // içermiyorsa aday tamamen düşüyordu: üstünde tek hücrelik bir başlık
    // taşıyan noktalı virgüllü CANoe dosyasında ayraç ',' seçiliyor ve
    // ondalık virgüller sütun sınırı sanılıp sayılar ikiye bölünüyordu.
    var nz = counts.filter(function(c) { return c > 0; });
    if(nz.length === 0) return;
    // En sık görülen alan sayısı (mod) ve kaç satırın ona uyduğu.
    var mode = 0, modeHits = 0;
    nz.forEach(function(cand) {
      var hits = nz.filter(function(c) { return c === cand; }).length;
      if(hits > modeHits || (hits === modeHits && cand > mode)) { modeHits = hits; mode = cand; }
    });
    // Tutarlılık ana ölçüt, sütun sayısı eşitlik bozucu.
    var score = modeHits * 1000 + mode;
    if(score > bestScore) { bestScore = score; best = d; }
  });
  return best;
}

// RFC 4180 uyumlu ayrıştırma (tırnak içinde ayraç/satır sonu, "" kaçışı).
function veXlsCsvParse(text, delim) {
  if(text.charCodeAt(0) === 0xfeff) text = text.substring(1);   // BOM
  delim = delim || veXlsSniffDelimiter(text);

  var rows = [], row = [], field = '', inQ = false, i = 0, n = text.length;
  while(i < n) {
    var ch = text.charAt(i);
    if(inQ) {
      if(ch === '"') {
        if(text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if(ch === '"') { inQ = true; i++; continue; }
    if(ch === delim) { row.push(field); field = ''; i++; continue; }
    if(ch === '\r' || ch === '\n') {
      if(ch === '\r' && text.charAt(i + 1) === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
      i++; continue;
    }
    field += ch; i++;
  }
  if(field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  // Son satır boşsa (dosya sonu satır sonuyla bitiyorsa) atılır.
  while(rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();

  var width = 0;
  rows.forEach(function(r) { if(r.length > width) width = r.length; });
  rows.forEach(function(r) { while(r.length < width) r.push(''); });

  return { rows: rows, delimiter: delim, dateCols: {}, truncated: false };
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veXlsInflateRaw: veXlsInflateRaw,
    veXlsBuildHuff: veXlsBuildHuff,
    veXlsZipRead: veXlsZipRead,
    veXlsUtf8: veXlsUtf8,
    veXlsUnescape: veXlsUnescape,
    veXlsAttr: veXlsAttr,
    veXlsColIndex: veXlsColIndex,
    veXlsSharedStrings: veXlsSharedStrings,
    veXlsDateStyles: veXlsDateStyles,
    veXlsParseSheet: veXlsParseSheet,
    veXlsOpen: veXlsOpen,
    veXlsSniffDelimiter: veXlsSniffDelimiter,
    veXlsCsvParse: veXlsCsvParse
  };
}
