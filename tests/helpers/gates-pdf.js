/* =========================================================================
 * gates-pdf.js — Gates raporlarının PDF'inden metin okuyan asgari çözücü
 * =========================================================================
 * NEDEN VAR: `docs/gates-reports/pdf/` altındaki raporlar, burulma testinin
 * kullandığı girdilerin (krank mili ataleti, gergi kasnak kütlesi, Mode 1)
 * TEK KAYNAĞI. O sayıları teste elle yazıp kaynağı hiç denetlememek bu
 * projenin en pahalı hata sınıfı olurdu: sayı sessizce ayrışır, test yeşil
 * kalır. Bu okuyucu kapının kaynağa bakmasını sağlıyor.
 *
 * NEDEN SAF NODE: `pymupdf` bu ortamda kuruluyor ama CI'ın test job'ı yalnız
 * Node çalıştırıyor. Yerleşik `zlib` yetiyor — yeni bağımlılık yok.
 *
 * NEDEN FONT BAŞINA: metin glif KİMLİĞİ olarak yazılı (`<0025>` = 'B') ve
 * eşleme fonta özgü. Belgedeki bütün CMap'leri tek tabloda birleştirmek
 * ÖLÇÜLDÜ ve YANLIŞ: altı raporun dördünde glifler çakışıyor (glif 44 →
 * space / 'A' / '#' / '@' / 'G'). Birleştiren bir sürüm o dört raporda
 * sessizce çöp metin üretirdi. Bu yüzden sayfa → kaynak sözlüğü → /Fn →
 * font nesnesi → o fontun kendi ToUnicode'u zinciri kuruluyor.
 *
 * KAPSAM DAR ve bilerek öyle: Gates çıktısının ürettiği biçim. Genel bir PDF
 * ayrıştırıcısı DEĞİLDİR ve olmaya çalışmamalı.
 * ========================================================================= */
'use strict';
const fs = require('fs');
const zlib = require('zlib');

/* ── Nesne tablosu ──────────────────────────────────────────────────────── */

/** `N G obj … endobj` bloklarını çıkarır: numara → { dict, stream }. */
function parseObjects(buf) {
  const s = buf.toString('latin1');
  const objs = {};
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const num = parseInt(m[1], 10);
    const start = m.index + m[0].length;
    const end = s.indexOf('endobj', start);
    if (end < 0) continue;
    const body = s.slice(start, end);
    const sp = body.indexOf('stream');
    let dict = body, stream = null;
    if (sp >= 0) {
      dict = body.slice(0, sp);
      let a = start + sp + 6;
      while (buf[a] === 13 || buf[a] === 10) a++;
      const e = s.indexOf('endstream', a);
      if (e > 0) {
        const raw = buf.slice(a, e);
        // SIKIŞTIRILMAMIŞ AKIŞ DA AKIŞTIR: bir raporda (AG00879) ToUnicode
        // CMap'leri filtresiz duruyor; yalnız inflate edilenleri almak onları
        // sessizce düşürüyor ve belge hiç okunamıyordu.
        try { stream = zlib.inflateSync(raw).toString('latin1'); }
        catch (_) { stream = raw.toString('latin1'); }
      }
    }
    objs[num] = { dict: dict, stream: stream };
  }
  return objs;
}

/**
 * NESNE AKIŞLARINI (ObjStm) açar ve içindeki sözlükleri tabloya ekler.
 *
 * PDF 1.5 ile gelen bu biçimde nesneler sıkıştırılmış bir akışın İÇİNDE
 * durur; düz `N 0 obj` taraması onları GÖREMEZ. Ölçüldü: AG00894 böyle
 * yazılmış (10 ObjStm) ve genişletme olmadan belgede tek bir font bile
 * bulunamıyordu. Akış İÇİNDE akış olamaz, yani buradan yalnız sözlükler
 * çıkar — ToUnicode'un kendi akışı zaten düz bir nesnedir.
 */
function expandObjectStreams(objs) {
  Object.keys(objs).forEach((n) => {
    const o = objs[n];
    if (!o.stream || !/\/Type\s*\/ObjStm/.test(o.dict)) return;
    const cnt = /\/N\s+(\d+)/.exec(o.dict);
    const first = /\/First\s+(\d+)/.exec(o.dict);
    if (!cnt || !first) return;
    const head = o.stream.slice(0, parseInt(first[1], 10));
    const nums = (head.match(/\d+/g) || []).map(Number);
    const body = o.stream.slice(parseInt(first[1], 10));
    for (let i = 0; i < parseInt(cnt[1], 10); i++) {
      const num = nums[2 * i], off = nums[2 * i + 1];
      if (num == null || off == null) break;
      const end = nums[2 * i + 3] != null ? nums[2 * i + 3] : body.length;
      if (objs[num] === undefined) objs[num] = { dict: body.slice(off, end), stream: null };
    }
  });
  return objs;
}

/** `/Ad 12 0 R` → 12 */
function refOf(dict, key) {
  const m = new RegExp('\\/' + key + '\\s+(\\d+)\\s+\\d+\\s+R').exec(dict);
  return m ? parseInt(m[1], 10) : null;
}

/* ── ToUnicode ──────────────────────────────────────────────────────────── */

/** Bir ToUnicode CMap akışını glif→karakter tablosuna çevirir. */
function parseCMap(text) {
  const map = {};
  if (!text) return map;
  // beginbfchar:  <src> <dst>
  for (const blk of text.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
    const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let m;
    while ((m = re.exec(blk))) {
      map[parseInt(m[1], 16)] = String.fromCharCode(parseInt(m[2].slice(0, 4), 16));
    }
  }
  // beginbfrange: <lo> <hi> <dstStart>   ve   <lo> <hi> [<d1> <d2> …]
  for (const blk of text.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
    const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g;
    let m;
    while ((m = re.exec(blk))) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16);
      if (m[3] != null) {
        const base = parseInt(m[3].slice(0, 4), 16);
        for (let g = lo; g <= hi && g - lo < 65536; g++) map[g] = String.fromCharCode(base + (g - lo));
      } else {
        const list = m[4].match(/<([0-9A-Fa-f]+)>/g) || [];
        list.forEach((h, i) => {
          map[lo + i] = String.fromCharCode(parseInt(h.replace(/[<>]/g, '').slice(0, 4), 16));
        });
      }
    }
  }
  return map;
}

/** Font nesnesi numarası → glif tablosu. */
function fontMaps(objs) {
  const out = {};
  Object.keys(objs).forEach((n) => {
    const d = objs[n].dict;
    if (!/\/Type\s*\/Font/.test(d) && !/\/BaseFont/.test(d)) return;
    const tu = refOf(d, 'ToUnicode');
    if (tu == null || !objs[tu]) return;
    const map = parseCMap(objs[tu].stream);
    if (Object.keys(map).length) out[n] = map;
  });
  return out;
}

/* ── Sayfa çözümü ───────────────────────────────────────────────────────── */

/** `/Resources` sözlüğünü (satır içi ya da dolaylı) metin olarak verir. */
function resourcesOf(dict, objs) {
  const r = refOf(dict, 'Resources');
  if (r != null && objs[r]) return objs[r].dict;
  const i = dict.indexOf('/Resources');
  return i < 0 ? '' : dict.slice(i, i + 2000);
}

/** Kaynak sözlüğündeki `/F1 12 0 R` çiftlerini ad→font nesnesi olarak verir. */
function fontRefs(res) {
  const out = {};
  const fi = res.indexOf('/Font');
  if (fi < 0) return out;
  const seg = res.slice(fi, fi + 2000);
  const re = /\/([A-Za-z0-9]+)\s+(\d+)\s+\d+\s+R/g;
  let m;
  while ((m = re.exec(seg))) out[m[1]] = parseInt(m[2], 10);
  return out;
}

/** Bir sayfanın içerik akışlarını birleştirir. */
function contentOf(dict, objs) {
  const c = refOf(dict, 'Contents');
  if (c != null && objs[c]) return objs[c].stream || '';
  const m = /\/Contents\s*\[([^\]]*)\]/.exec(dict);
  if (!m) return '';
  return (m[1].match(/(\d+)\s+\d+\s+R/g) || []).map((r) => {
    const n = parseInt(r, 10);
    return objs[n] && objs[n].stream ? objs[n].stream : '';
  }).join('\n');
}

/**
 * İçerik akışını okunur metne çevirir. `/Fn … Tf` ile font değiştiği yerde
 * eşleme de değişir — çözücünün varlık sebebi bu.
 */
function decodeContent(t, refs, maps) {
  const out = [];
  let cur = null;
  // Konumlandırma işleçleri satır sınırı sayılır: Gates tablolarında etiket ve
  // değer AYRI çizim çağrılarıdır, ayrılmazlarsa "Mode 112.61" gibi birleşir.
  const re = /\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>|(Tm|Td|TD|T\*|BT|ET)/g;
  let m;
  while ((m = re.exec(t))) {
    if (m[1] != null) { cur = maps[refs[m[1]]] || null; continue; }
    if (m[3] != null) { out.push('\n'); continue; }
    const hex = m[2];
    let s = '';
    for (let k = 0; k + 4 <= hex.length; k += 4) {
      const g = parseInt(hex.substr(k, 4), 16);
      if (cur && cur[g] !== undefined) s += cur[g];
    }
    out.push(s);
  }
  return out.join('');
}

/** PDF dosyasını sayfa sayfa okunur metne çevirir. */
function gatesPdfPages(file) {
  const buf = fs.readFileSync(file);
  const objs = expandObjectStreams(parseObjects(buf));
  const maps = fontMaps(objs);
  if (!Object.keys(maps).length) throw new Error('ToUnicode bulunamadı: ' + file);
  const pages = [];
  Object.keys(objs).map(Number).sort((a, b) => a - b).forEach((n) => {
    const d = objs[n].dict;
    if (!/\/Type\s*\/Page[^s]/.test(d)) return;
    pages.push(decodeContent(contentOf(d, objs), fontRefs(resourcesOf(d, objs)), maps));
  });
  return pages;
}

/** Bütün belgenin metni. */
function gatesPdfText(file) { return gatesPdfPages(file).join('\n'); }

/**
 * Etiketi metinde bulur ve BİTİŞ konumunu döndürür (yoksa -1).
 *
 * TİRE AYRI ÇİZİM ÇAĞRISIDIR — eksi işaretiyle aynı olgu. Aynı alanın etiketi
 * bir raporda `Spring Pre-Load Nm` tek parça, ötekinde `Spring Pre` + `-` +
 * `Load Nm` olarak bölünmüş. Düz `indexOf` ikinci gruptaki raporlarda etiketi
 * BULAMIYOR ve değer sessizce `null` dönüyordu — "bu raporda ön yük yok" gibi
 * okunur, oysa var (ölçüldü: on raporun altısı).
 */
function labelEnd(text, label) {
  const i = text.indexOf(label);
  if (i >= 0) return i + label.length;
  const pat = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '\\s*-\\s*');
  const m = new RegExp(pat).exec(text);
  return m ? m.index + m[0].length : -1;
}

/**
 * `etiket`ten SONRAKİ ilk sayıyı döndürür. Ölçüt sayfa NUMARASI değil
 * ETİKETİN KENDİSİ: alıntı belgelerde numaralar kayıyor.
 */
function numberAfter(text, label) {
  const e = labelEnd(text, label);
  if (e < 0) return null;
  const rest = text.slice(e, e + 200);
  // Burada kalıp ESNEK olmalı: değer hücresi `356 (80 lbf)` gibi birim de
  // taşıyabiliyor. Sütun okuyan `numbersAfter` ise KATI (tam satır) — ikisi
  // ayrı iş, tek bir kalıba indirilirse biri sessizce yanlış sayıyı alır
  // (ölçüldü: katı kalıp `Design Tension N`'i atlayıp pivot X'e düşüyordu).
  const m = /-?\d+(?:\.\d+)?/.exec(rest);
  if (!m) return null;
  const before = rest.slice(0, m.index);
  const neg = /(^|\n)\s*[-\u2212]\s*\n\s*$/.test(before);   // eksi ayrı çizim çağrısı
  return (neg ? -1 : 1) * parseFloat(m[0]);
}

/**
 * EKSİ İŞARETİ AYRI BİR ÇİZİM ÇAĞRISIDIR — ölçüldü: X sütunu
 * `["-","72.00","-","224.00"]` olarak geliyor, `["-72.00", …]` değil.
 * Bu bir Gates çıktısı ayrıntısı; çağıran her yerin ayrı ayrı hatırlaması
 * gereken bir kural olmamalı, o yüzden burada çözülüyor. Kaçırılırsa sayı
 * MUTLAK DEĞERİYLE okunur — sessiz ve pahalı (kasnak aynalanır).
 */
function tokensToNumbers(lines) {
  const out = [];
  let sign = 1;
  lines.forEach((raw) => {
    const t = raw.trim();
    if (t === '-' || t === '\u2212') { sign = -1; return; }
    if (/^-?\d+(?:\.\d+)?$/.test(t)) { out.push(sign * parseFloat(t)); sign = 1; return; }
    sign = 1;                       // sayı olmayan her şey işareti sıfırlar
  });
  return out;
}

/** `etiket` satırından sonraki ilk `n` sayıyı (işaretleriyle) döndürür. */
function numbersAfter(text, label, n) {
  const lines = text.split('\n').map((x) => x.trim()).filter(Boolean);
  // ÖNEK eşlemesi, tam eşitlik DEĞİL: aynı alanın etiketi belgeden belgeye
  // farklı bölünüyor — AG00810'da tek parça (`…Arm Kg-m2`), AG00686'da üç
  // parça (`…Arm Kg` + `-` + `m2`). Tam eşitlik arayan sürüm ikincisini
  // bulamayıp istisna atıyordu.
  const i = lines.findIndex((x) => x.indexOf(label) === 0);
  if (i < 0) throw new Error('etiket yok: ' + label);
  return tokensToNumbers(lines.slice(i + 1)).slice(0, n);
}

/**
 * Sayfa altbilgisinden `{ page, total }` okur.
 *
 * ALTBİLGİ TEK SATIRDIR ve parçaları BİRLEŞİK: ölçüldü, gerçek metin
 * `…18:30:03Page 1 of 119.37.0.0North America`. Yani sayfa toplamı (11) Gates
 * sürümünün ilk hanesine (9.37.0.0) yapışıyor ve düz `Page (\d+) of (\d+)`
 * kalıbı **119** okuyor. Bu sessiz bir kusur: rapor "eksik sayfalı" görünür,
 * oysa tamdır. Önce sürümün başladığı yerde duran kalıp denenir.
 */
function pageMarker(text) {
  let m = /Page (\d+) of (\d+)(?=\d\.\d)/.exec(text);   // sürüm hemen ardından
  if (!m) m = /Page (\d+) of (\d+)/.exec(text);            // ayrık altbilgi
  return m ? { page: parseInt(m[1], 10), total: parseInt(m[2], 10) } : null;
}

module.exports = { gatesPdfPages, gatesPdfText, numberAfter, numbersAfter, pageMarker };
