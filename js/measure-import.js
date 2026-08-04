// ═══════════════════════════════════════════════════════════════════════════
// ÖLÇÜM İÇE AKTARMA — anlam katmanı
// ═══════════════════════════════════════════════════════════════════════════
//
// js/xlsx-read.js hücreleri verir; BURASI onlara anlam yükler:
//   • hangi satır başlık satırı (üstte üstbilgi/açıklama satırları olabilir)
//   • sütun adının içindeki birim ve mesaj adı ("EngineData::EngSpeed [1/min]")
//   • hangi sütun X ekseni (genelde ilk sütun = zaman, ama kullanıcı seçer)
//   • "1.234,56" mı "1,234.56" mı — ondalık ayırıcı
//   • seyrek hücreler (CAN sinyalleri farklı periyotlarla gelir)
//
// TASARIM — neden sanal veri kaynağı:
// Ölçüm penceresinin TÜM veri okuması js/graphics.js'teki veGetSensorData()
// kapısından geçiyor. İçe aktarılan sütunlar oraya '#veriKümesiId' önekli bir
// sözde-sensör olarak girince şerit çizimi, imleç, Y eksenleri, istatistik,
// mini eğri, sürükle-bırak ve ayrık/metin kanal tespiti HİÇBİR DEĞİŞİKLİK
// OLMADAN çalışır. Kimlik uzayında zaten üç önek vardı ('~' sihirbaz,
// '@' çapraz sekme); bu dördüncüsü.
//
// Veri KASITEN window.veSimResults'ın DIŞINDA durur: o nesne bir Cd düzenlemesi
// ya da sekme değişiminde null'lanıyor (js/results.js:88, js/topology.js:403)
// ve içe aktarılan ölçüm onunla birlikte silinirdi.

// Oturum boyunca yaşayan veri kümeleri. Proje dosyasına YAZILMAZ: ham ölçüm
// onlarca MB olabiliyor ve proje dosyasını kullanılamaz hâle getirirdi.
var veImpDatasets = [];
var veImpSeq = 0;

// Oturuma özgü kimlik damgası. Veri kümeleri projeye yazılmaz ama panodaki
// slot REFERANSI ('#imp1') proje durumuyla birlikte kaydediliyor. Sayaç her
// oturumda 1'den başlasaydı, yeni bir oturumda yapılan ilk içe aktarma da
// 'imp1' kimliğini alır ve eski projedeki bayat referans sessizce BAŞKA bir
// ölçüm dosyasına bağlanırdı: grafik açılır, veri yanlış olur. Damga ile
// bayat referans hiçbir şeye çözülmez ve veImpPruneSlots onu temizler.
var VE_IMP_SESSION = (function() {
  var t = Date.now().toString(36);
  var r = Math.floor(Math.random() * 46656).toString(36);
  return t.slice(-5) + ('00' + r).slice(-3);
})();

// ── Metin yardımcıları ────────────────────────────────────────────────────

// Türkçe duyarlı katlama. 'İ'.toLocaleLowerCase('tr') iki karakter ürettiği
// için toLocaleLowerCase kullanılmaz (js/signal-tree.js ile aynı gerekçe).
var VE_IMP_FOLD = {
  'I': 'i', 'İ': 'i', 'ı': 'i', 'Ş': 's', 'ş': 's', 'Ğ': 'g', 'ğ': 'g',
  'Ü': 'u', 'ü': 'u', 'Ö': 'o', 'ö': 'o', 'Ç': 'c', 'ç': 'c'
};

function veImpNorm(s) {
  var t = String(s == null ? '' : s), out = '';
  for(var i = 0; i < t.length; i++) {
    var ch = t.charAt(i);
    out += VE_IMP_FOLD[ch] || ch.toLowerCase();
  }
  return out;
}

// ── Sütun adı çözümü ──────────────────────────────────────────────────────

// Birim gibi görünen parantez içeriği. Uzun bir açıklama birim DEĞİLDİR:
// "Hız (aracın yol boyunca ölçülen hızı)" başlığında parantezi birim sanmak
// eksen etiketini anlamsızlaştırırdı.
function veImpLooksLikeUnit(s) {
  var t = String(s || '').trim();
  if(!t || t.length > 14) return false;
  if(/\s{2,}/.test(t)) return false;
  // En fazla tek boşluk ve yalnızca birim karakterleri
  return /^[A-Za-zµΩ°%/·^*.\-0-9 ()]+$/.test(t) && /[A-Za-zµΩ°%]/.test(t);
}

// "EngineData::EngSpeed [1/min]" → { group:'EngineData', name:'EngSpeed', unit:'1/min' }
//
// Yalnızca '::' ayracı gruba bölünür. Nokta KASITEN bölünmez: "1.Vites" ya da
// "T_gb_out.max" gibi başlıklar yanlış yere ikiye ayrılırdı.
function veImpParseHeader(raw) {
  var t = String(raw == null ? '' : raw).trim();
  var unit = '';

  // Sondaki [birim] veya (birim)
  var m = /^([\s\S]*?)[\s]*\[([^\]]*)\]\s*$/.exec(t);
  if(m && veImpLooksLikeUnit(m[2])) { t = m[1].trim(); unit = m[2].trim(); }
  else {
    m = /^([\s\S]*?)[\s]*\(([^)]*)\)\s*$/.exec(t);
    if(m && veImpLooksLikeUnit(m[2]) && m[1].trim()) { t = m[1].trim(); unit = m[2].trim(); }
  }

  var group = '';
  var sep = t.lastIndexOf('::');
  if(sep > 0) { group = t.substring(0, sep).trim(); t = t.substring(sep + 2).trim(); }

  return { group: group, name: t || String(raw || '').trim(), unit: unit, raw: String(raw == null ? '' : raw) };
}

// ── Sayı çözümü ───────────────────────────────────────────────────────────

// Bir hücreyi sayıya çevirir. null = sayı değil / boş.
//
// commaDecimal: Avrupa biçimi ("1.234,56"). Bu bayrak sütun bazında değil
// DOSYA bazında belirlenir — tek bir dışa aktarımda iki biçim karışmaz ve
// sütun bazlı tahmin, tam sayı dolu bir sütunda kararsız kalırdı.
function veImpToNumber(v, commaDecimal) {
  if(typeof v === 'number') return isFinite(v) ? v : null;
  if(typeof v === 'boolean') return v ? 1 : 0;
  if(v == null) return null;

  var s = String(v).trim();
  if(s === '') return null;
  // İnce/bölünmez boşluk binlik ayracı olarak kullanılıyor
  s = s.replace(/[   \s]/g, '');
  if(s === '') return null;

  if(commaDecimal) {
    // Üstel kısım ayrılır: "1.5E-05" içindeki nokta ondalıktır, binlik ayracı
    // değil. Toptan silinince sayı 0.00015 oluyordu — on kat sapma.
    // Ön elemeler: bu yol on binlerce hücrede koşuyor, düzenli ifadeler
    // yalnızca ilgili karakter varsa çalıştırılır.
    var em = (s.indexOf('e') >= 0 || s.indexOf('E') >= 0) ? /^([^eE]*)([eE][+-]?\d+)$/.exec(s) : null;
    var mant = em ? em[1] : s, exp = em ? em[2] : '';
    // Nokta yalnızca GEÇERLİ binlik gruplarında ayraçtır: 1.234.567,89.
    // "1.5" gibi üç basamaklı olmayan bir grup binlik olamaz — orada nokta
    // ondalıktır ve korunur.
    if(mant.indexOf('.') >= 0 && /^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(mant)) {
      mant = mant.replace(/\./g, '');
    }
    s = mant.replace(',', '.') + exp;
  } else {
    // "1,234.56" → binlik virgülü at. "12,5" gibi tek virgül DOKUNULMAZ:
    // ondalık bayrağı kapalıysa bu sayı değildir, metindir.
    if(/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  }

  if(!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  var n = parseFloat(s);
  return isFinite(n) ? n : null;
}

// Dosyada ondalık ayırıcı virgül mü? Örnek hücrelere bakar.
//
// "1,200" iki okumaya birden uyar: Avrupa'da 1.2, İngilizcede 1200. Bu kalıp
// (1-3 basamak + tam üç basamaklı gruplar) KANIT SAYILMAZ, ayrı tutulur —
// aksi halde binlik ayraçlı bir dosya Avrupa biçimi sanılıyor ve 1200 değeri
// grafiğe 1.2 olarak giriyordu. Kararsızlıkta binlik okuması seçilir.
function veImpDetectCommaDecimal(rows, startRow) {
  var comma = 0, dot = 0, grouped = 0;
  var end = Math.min(rows.length, (startRow || 0) + 200);
  for(var r = startRow || 0; r < end; r++) {
    var row = rows[r] || [];
    for(var c = 0; c < row.length; c++) {
      var v = row[c];
      if(typeof v !== 'string') continue;
      var s = v.trim();
      if(/^[+-]?\d{1,3}(,\d{3})+$/.test(s)) grouped++;
      else if(/^[+-]?\d+,\d+$/.test(s)) comma++;
      else if(/^[+-]?\d+\.\d+$/.test(s)) dot++;
      else if(/^[+-]?\d{1,3}(\.\d{3})+$/.test(s)) comma++;   // 1.234.567 → Avrupa binliği
    }
    if(comma + dot + grouped > 400) break;
  }
  return comma > dot;
}

// ── Başlık satırı tespiti ─────────────────────────────────────────────────

function veImpRowStats(row, commaDecimal) {
  var num = 0, text = 0, empty = 0;
  (row || []).forEach(function(v) {
    if(v === null || v === undefined || v === '') { empty++; return; }
    if(veImpToNumber(v, commaDecimal) !== null) num++; else text++;
  });
  return { num: num, text: text, empty: empty, filled: num + text };
}

// Bilinen birim sözlüğü. Birim SATIRINI ararken veImpLooksLikeUnit yeterince
// ayırt edici değil: "Time" ve "EngSpeed" de onun kalıbına uyuyor ve başlık
// satırı birim satırı sanılıp gerçek başlık bir üste kayıyordu.
var VE_IMP_UNIT_WORDS = {
  's': 1, 'sn': 1, 'sec': 1, 'ms': 1, 'us': 1, 'µs': 1, 'min': 1, 'h': 1, 'hr': 1,
  'm': 1, 'mm': 1, 'cm': 1, 'km': 1, 'in': 1, 'ft': 1,
  'g': 1, 'kg': 1, 't': 1, 'lb': 1,
  'n': 1, 'nm': 1, 'kn': 1, 'knm': 1,
  'w': 1, 'kw': 1, 'mw': 1, 'hp': 1, 'ps': 1,
  'v': 1, 'mv': 1, 'a': 1, 'ma': 1, 'ohm': 1,
  'hz': 1, 'khz': 1, 'rpm': 1, 'bar': 1, 'pa': 1, 'kpa': 1, 'mpa': 1, 'psi': 1,
  'k': 1, 'j': 1, 'kj': 1, 'wh': 1, 'kwh': 1, 'l': 1, 'ml': 1,
  'deg': 1, 'rad': 1, 'grad': 1, '-': 1, '—': 1, '–': 1
};

// Tek bir hücre birim BAŞLIĞI mı? veImpLooksLikeUnit'ten katı: sözlükte
// olmalı ya da birim yazımına özgü bir işaret taşımalı.
function veImpIsUnitToken(v) {
  var s = String(v == null ? '' : v).trim();
  if(!s || s.length > 12) return false;
  if(/[\/°%Ωµ²³]/.test(s)) return true;                 // km/h, °C, %, m/s², µs
  if(/^\d+\s*\/\s*\w+$/.test(s)) return true;           // 1/min
  return !!VE_IMP_UNIT_WORDS[veImpNorm(s)];
}

// Bir satır "birim satırı" mı? Ölçüm dışa aktarımlarında başlığın hemen
// altında s / 1/min / km/h yazan bir satır sık görülür.
function veImpLooksLikeUnitRow(row, commaDecimal) {
  var st = veImpRowStats(row, commaDecimal);
  if(st.filled === 0 || st.num > 0) return false;
  var unitish = 0, seen = 0;
  (row || []).forEach(function(v) {
    if(v === null || v === undefined || v === '') return;
    seen++;
    if(veImpIsUnitToken(v)) unitish++;
  });
  return seen > 0 && unitish / seen >= 0.6;
}

// Üstbilgi satırlarının imzası: sonu iki nokta üst üste ile biten metin
// hücresi ("Measurement:", "Exported:"). Veri satırında böyle bir hücre olmaz.
function veImpHasLabelCell(row) {
  for(var i = 0; i < (row || []).length; i++) {
    var v = row[i];
    if(typeof v === 'string' && /:\s*$/.test(v)) return true;
  }
  return false;
}

// Başlık satırının indeksi + varsa birim satırı + verinin başladığı satır.
//
// Yöntem: önce İLK SAYISAL satır bulunur, sonra ondan geriye doğru en yakın
// "veri genişliğine uyan metin satırı" başlık kabul edilir. Üstteki
// "Measurement: / Exported:" gibi üstbilgi satırları böyle elenir — onlar
// yalnızca bir-iki hücre dolu olduğu için genişlik eşiğini geçemez.
function veImpDetectHeaderRow(rows, commaDecimal) {
  var n = rows ? rows.length : 0;
  if(n === 0) return { headerRow: -1, unitRow: -1, dataRow: -1 };

  // Tablonun genişliği: en dolu satır. Üstteki "Measurement: …" gibi iki
  // hücrelik üstbilgi satırları bu eşiği geçemez ve veri sanılmaz.
  var width = 0;
  for(var w = 0; w < n; w++) {
    var sw = veImpRowStats(rows[w], commaDecimal);
    if(sw.filled > width) width = sw.filled;
  }
  var minFilled = Math.max(width > 1 ? 2 : 1, Math.ceil(width * 0.6));

  // Veri satırı: genişliğe uyar ve EN AZ BİR sayısal hücresi vardır.
  // "Hücrelerin çoğu sayısal olmalı" kuralı dar tablolarda çöküyordu: iki
  // sütunlu bir dosyada tek bir metin kanalı (vites modu) oranı %50'ye
  // düşürüyor ve gerçek veri satırı başlık sanılıyordu.
  function isData(r) {
    if(r < 0 || r >= n) return false;
    var s = veImpRowStats(rows[r], commaDecimal);
    if(s.filled < minFilled || s.num < 1) return false;
    // "Exported:" / "Version:" gibi ETİKET hücresi taşıyan satır üstbilgidir,
    // veri değil — sayısal bir değer taşısa bile ("Version: 17").
    return !veImpHasLabelCell(rows[r]);
  }

  var dataRow = -1;
  for(var r = 0; r < n; r++) {
    if(isData(r)) { dataRow = r; break; }
  }

  // Hiç sayısal satır yok → ilk dolu satır başlık, veri yok.
  if(dataRow < 0) {
    for(var k = 0; k < n; k++) {
      if(veImpRowStats(rows[k], commaDecimal).filled >= 2) {
        return { headerRow: k, unitRow: -1, dataRow: k + 1 };
      }
    }
    return { headerRow: 0, unitRow: -1, dataRow: 1 };
  }

  // Veri satırından geriye: genişliğe uyan en yakın metin satırı
  var header = -1;
  for(var i = dataRow - 1; i >= 0 && i >= dataRow - 8; i--) {
    var s2 = veImpRowStats(rows[i], commaDecimal);
    if(s2.filled === 0) continue;
    if(s2.text >= 1 && s2.filled >= minFilled) { header = i; break; }
  }
  if(header < 0) return { headerRow: -1, unitRow: -1, dataRow: dataRow };

  // Bulunan satır birim satırıysa gerçek başlık bir üsttedir.
  var unitRow = -1;
  if(header > 0 && veImpLooksLikeUnitRow(rows[header], commaDecimal)) {
    var above = veImpRowStats(rows[header - 1], commaDecimal);
    if(above.filled >= minFilled) { unitRow = header; header = header - 1; }
  } else if(header + 1 < dataRow && veImpLooksLikeUnitRow(rows[header + 1], commaDecimal)) {
    unitRow = header + 1;
  }

  return { headerRow: header, unitRow: unitRow, dataRow: dataRow };
}

// ── Sütun çıkarımı ────────────────────────────────────────────────────────

// Ham satırlardan sütun tanımlarını üretir. Değerler HENÜZ okunmaz —
// önizleme ekranı yalnızca ad/birim/tip göstereceği için tüm dosyayı sayıya
// çevirmek gereksiz beklemedir.
// Etiketli durum şeridine çevrilebilecek en fazla ayrık değer sayısı.
// js/trace-view.js veTrEncodeText en çok 16 etiket çizebiliyor.
var VE_IMP_STATE_MAX = 16;

function veImpBuildColumns(rows, layout, commaDecimal) {
  var hdr = (layout.headerRow >= 0 ? rows[layout.headerRow] : null) || [];
  var units = (layout.unitRow >= 0 ? rows[layout.unitRow] : null) || [];

  var width = 0;
  rows.forEach(function(r) { if(r && r.length > width) width = r.length; });

  // Tarama adımı: uzun dosyada her satıra bakmak gereksiz, ama örneklem
  // dosyanın TAMAMINA yayılmalı. 20.000 örnek tip ve doluluk için fazlasıyla
  // yeterli; 15.000 satırlık tipik bir ölçümde adım 1, yani tam tarama.
  var totalRows = Math.max(0, rows.length - layout.dataRow);
  var step = Math.max(1, Math.ceil(totalRows / 20000));

  var cols = [];
  for(var c = 0; c < width; c++) {
    var rawName = hdr[c];
    var parsed = veImpParseHeader(rawName == null || rawName === '' ? ('Sütun ' + (c + 1)) : rawName);
    var unit = parsed.unit;
    if(!unit && units[c] != null && units[c] !== '' && veImpLooksLikeUnit(units[c])) {
      unit = String(units[c]).trim();
    }

    // Tip ve doluluk: sütunun TAMAMINDAN örneklenir, yalnızca baştan değil.
    // Baştan örnekleme gerçek ölçümlerde yanılıyor: bir sinyal koşunun 20.
    // saniyesinde konuşmaya başlıyorsa ilk yüzlerce satırı boştur ve sütun
    // 'empty' sayılıp listeden tamamen düşerdi.
    var num = 0, text = 0, empty = 0, sampled = 0;
    var seen = {}, distinct = 0;
    for(var r2 = layout.dataRow; r2 < rows.length; r2 += step) {
      var v = (rows[r2] || [])[c];
      sampled++;
      if(v === null || v === undefined || v === '') { empty++; continue; }
      if(veImpToNumber(v, commaDecimal) !== null) num++; else text++;
      if(distinct <= VE_IMP_STATE_MAX) {
        var sk = String(v);
        if(!Object.prototype.hasOwnProperty.call(seen, sk)) { seen[sk] = 1; distinct++; }
      }
    }

    // Karma sütun: çoğunlukla sayı, arada sembolik değer ('N', 'R1', 'error').
    // CAN'de bu bir DURUM sinyalidir. Sayı sayıldığı için sütun 'num' olur,
    // sembolik hücreler null'a düşer ve örnekle-ve-tut onları bir önceki
    // SAYIYA yapıştırırdı — vites 'N' iken grafikte 3 görünürdü. Ayrık değer
    // sayısı azsa sütun metin şeridine çevrilir (etiketli durum kanalı);
    // değilse sayı kalır ama sembolik hücreler gerçek boşluk olur (bkz.
    // veImpReadValues), asla uydurulmaz.
    var mixed = num > 0 && text > 0;
    var kind;
    if(num >= text && num > 0) kind = (mixed && distinct <= VE_IMP_STATE_MAX) ? 'text' : 'num';
    else kind = (text > 0) ? 'text' : 'empty';

    cols.push({
      key: 'c' + c,
      index: c,
      name: parsed.name,
      rawName: parsed.raw,
      group: parsed.group,
      unit: unit || '',
      kind: kind,
      mixed: mixed,
      distinct: distinct,
      sparse: sampled > 0 && empty > sampled * 0.1,
      filled: num + text,
      sampled: sampled
    });
  }
  return cols;
}

// Sütunun değerlerini okur. text sütunlarında metin KORUNUR — ölçüm
// penceresi metin kanallarını CANoe'nun durum şeridi gibi çizebiliyor
// (js/trace-view.js veTrEncodeText).
function veImpReadValues(rows, col, layout, commaDecimal, asText) {
  var out = [];
  for(var r = layout.dataRow; r < rows.length; r++) {
    var v = (rows[r] || [])[col.index];
    if(asText) {
      out.push(v === null || v === undefined || v === '' ? null : String(v));
    } else if(v === null || v === undefined || v === '') {
      out.push(null);                       // gerçekten boş → örnekle-ve-tut sürdürür
    } else {
      // Dolu ama sayıya çevrilemiyor: NaN. null DEĞİL — null olsaydı
      // veImpForwardFill bir önceki sayıyı buraya kopyalar, okunamayan hücre
      // uydurma bir değer olarak çizilirdi. NaN'da kalem kalkar (boşluk).
      var nv = veImpToNumber(v, commaDecimal);
      out.push(nv === null ? NaN : nv);
    }
  }
  return out;
}

// Örnekle-ve-tut: boş hücre son geçerli değeri sürdürür.
//
// Neden gerekli: CAN sinyalleri farklı periyotlarla geldiği için sütunların
// çoğu satırı boştur. Boşluk bırakılırsa çizim katmanı her boşlukta kalemi
// kaldırır (js/trace-view.js:551) ve eğri tek tek noktalara dağılıp GÖRÜNMEZ
// olur. CANoe da bu sinyalleri basamak (sample & hold) çizer.
// İlk örnekten ÖNCESİ doldurulmaz: orada gerçekten veri yoktur.
function veImpForwardFill(values) {
  var out = values.slice(), last = null;
  for(var i = 0; i < out.length; i++) {
    if(out[i] === null || out[i] === undefined) { out[i] = last; }
    else last = out[i];
  }
  return out;
}

// ── X ekseni tahmini ──────────────────────────────────────────────────────

var VE_IMP_TIME_UNITS = { 's': 1, 'sn': 1, 'sec': 1, 'saniye': 1, 'ms': 1, 'us': 1, 'µs': 1 };

// Kullanıcı X eksenini kendi seçer; bu yalnızca AÇILIR LİSTENİN ÖN SEÇİMİ.
// Kullanıcının söylediği gibi "genelde ilk sütun zaman oluyor" — bu yüzden
// eşitlikte soldaki sütun kazanır.
function veImpGuessXColumn(cols) {
  var best = -1, bestScore = -1;
  (cols || []).forEach(function(c, i) {
    if(c.kind !== 'num') return;
    var score = 0;
    var n = veImpNorm(c.name), u = veImpNorm(c.unit);
    if(/^(time|zaman|t|timestamp|abstime|absolutetime|zamandamgasi)$/.test(n.replace(/[\s_\-]/g, ''))) score += 100;
    else if(n.indexOf('time') >= 0 || n.indexOf('zaman') >= 0) score += 60;
    if(VE_IMP_TIME_UNITS[u]) score += 30;
    // Artan sıralı olmak zaman ekseninin ayırt edici özelliği
    if(c._monotonic) score += 20;
    // Soldaki sütun önce
    score += Math.max(0, 10 - i);
    if(score > bestScore) { bestScore = score; best = i; }
  });
  if(best < 0) {
    for(var i2 = 0; i2 < (cols || []).length; i2++) if(cols[i2].kind === 'num') return i2;
  }
  return best;
}

// Artan mı? (tahmin puanı için; kesin kural değil)
function veImpIsMonotonic(values) {
  var prev = null, seen = 0;
  for(var i = 0; i < values.length; i++) {
    var v = values[i];
    if(v === null || !isFinite(v)) continue;
    if(prev !== null && v < prev) return false;
    prev = v; seen++;
    if(seen > 5000) break;
  }
  return seen >= 2;
}

// ── Veri kümesi kurulumu ──────────────────────────────────────────────────

// Seçilen X sütunu ve işaretlenen Y sütunlarından bir veri kümesi üretir.
// Dönen nesne doğrudan kayıt defterine girer.
function veImpBuildDataset(opts) {
  var rows = opts.rows, layout = opts.layout, cols = opts.columns;
  var commaDecimal = !!opts.commaDecimal;
  var xCol = cols[opts.xIndex];
  if(!xCol) throw new Error('X ekseni sütunu seçilmedi.');

  var xVals = veImpReadValues(rows, xCol, layout, commaDecimal, false);
  // X ekseninde NaN olamaz: imleç ikili arama yapıyor (veCursorSnapIndex) ve
  // zaman ölçeği bu diziye dayanıyor. Okunamayan zaman hücresi boşluk sayılır,
  // hemen aşağıda örnekle-ve-tut ile kapatılır.
  for(var xi = 0; xi < xVals.length; xi++) {
    if(typeof xVals[xi] === 'number' && !isFinite(xVals[xi])) xVals[xi] = null;
  }

  // Zaman ekseni tarih biçimliyse hücrede Excel seri numarası durur (gün
  // cinsinden). Saniyeye çevrilmezse eksen 45000 civarı anlamsız sayılar
  // gösterirdi.
  var xUnit = xCol.unit || '';
  if(opts.dateCols && opts.dateCols[xCol.index]) {
    for(var i = 0; i < xVals.length; i++) if(xVals[i] !== null) xVals[i] = xVals[i] * 86400;
    if(!xUnit) xUnit = 's';
    // Mutlak zamanı göreliye çek: ölçüm 0'dan başlasın.
    var base = null;
    for(var b = 0; b < xVals.length; b++) if(xVals[b] !== null) { base = xVals[b]; break; }
    if(base !== null) for(var j = 0; j < xVals.length; j++) if(xVals[j] !== null) xVals[j] -= base;
  }
  // X ekseninde boşluk olamaz — imleç ve zaman ölçeği ona dayanıyor.
  xVals = veImpForwardFill(xVals);

  var id = 'imp' + VE_IMP_SESSION + '-' + (++veImpSeq);
  var columns = [];
  (opts.yIndexes || []).forEach(function(ci) {
    var c = cols[ci];
    if(!c || ci === opts.xIndex) return;
    var asText = (c.kind === 'text');
    var vals = veImpReadValues(rows, c, layout, commaDecimal, asText);
    // Örnekle-ve-tut METİN kanallarında da geçerli: vites modu ('1C'/'2L')
    // bir sonraki değişime kadar sürer. Doldurulmazsa durum şeridi boşluk
    // dolu olur, çizim katmanı her boşlukta kalemi kaldırır ve şerit BOŞ
    // görünür — Y ekseninde etiketler durduğu hâlde tek çizgi çıkmaz.
    if(opts.holdSparse !== false) vals = veImpForwardFill(vals);
    columns.push({
      key: c.key, name: c.name, rawName: c.rawName, group: c.group,
      unit: c.unit, kind: c.kind, sparse: c.sparse, values: vals
    });
  });

  return {
    id: id,
    sensorId: '#' + id,
    dataSource: 'import:' + id,
    name: opts.name || 'İçe aktarılan ölçüm',
    fileName: opts.fileName || '',
    sheetName: opts.sheetName || '',
    rowCount: xVals.length,
    truncated: !!opts.truncated,
    x: { key: xCol.key, name: xCol.name, unit: xUnit, values: xVals },
    columns: columns
  };
}

// ── Kayıt defteri ─────────────────────────────────────────────────────────

function veImpAdd(ds) {
  veImpDatasets.push(ds);
  return ds;
}

function veImpFind(id) {
  for(var i = 0; i < veImpDatasets.length; i++) if(veImpDatasets[i].id === id) return veImpDatasets[i];
  return null;
}

// '#imp3' → 'imp3'; 'import:imp3' → 'imp3'
function veImpIdOf(ref) {
  var s = String(ref == null ? '' : ref);
  if(s.charAt(0) === '#') return s.substring(1);
  if(s.indexOf('import:') === 0) return s.substring(7);
  return '';
}

function veImpIsImportRef(ref) {
  return !!veImpIdOf(ref) && !!veImpFind(veImpIdOf(ref));
}

function veImpColumn(ds, key) {
  if(!ds) return null;
  for(var i = 0; i < ds.columns.length; i++) if(ds.columns[i].key === key) return ds.columns[i];
  return null;
}

// veGetSensorData'nın '#' dalı buraya bağlanır.
function veImpSeries(sensorId, signalId) {
  var ds = veImpFind(veImpIdOf(sensorId));
  if(!ds) return null;
  if(signalId === '__x') return ds.x.values;
  var c = veImpColumn(ds, signalId);
  return (c && c.values && c.values.length) ? c.values : null;
}

// veTrResolveX'in içe aktarma dalı buraya bağlanır.
function veImpXSeries(dataSourceOrId) {
  var ds = veImpFind(veImpIdOf(dataSourceOrId));
  return ds ? ds.x.values : null;
}

// Panodan son içe aktarma sinyali de kalktığında ölçümün zaman ekseni panoyu
// terk etmelidir. Aksi halde `slot._dataSource` yapışık kalır ve sonradan
// eklenen bir SİMÜLASYON sinyali ölçümün zaman dizisine karşı çizilir —
// grafik makul görünür, veri yanlıştır. Boş panoda eksen yeniden serbesttir.
function veImpDropStaleAxis(slot) {
  if(!slot) return false;
  var ds = slot._dataSource;
  if(!ds || String(ds).indexOf('import:') !== 0) return false;
  var stillThere = (slot.sensors || []).some(function(s) {
    return s && (s._dataSource === ds || String(s.id).charAt(0) === '#');
  });
  if(stillThere) return false;
  delete slot._dataSource;
  slot.xAxis = { id: 'time', name: 'Zaman', unit: 's' };
  return true;
}

function veImpRemove(id) {
  for(var i = 0; i < veImpDatasets.length; i++) {
    if(veImpDatasets[i].id === id) { veImpDatasets.splice(i, 1); return true; }
  }
  return false;
}

function veImpAny() { return veImpDatasets.length > 0; }

// Panodaki, artık var olmayan bir veri kümesine bakan şeritleri temizler.
// Proje dosyası şerit listesini saklıyor ama ölçüm verisini saklamıyor;
// yeniden açılışta bu şeritler sonsuza dek "veri yok" gösterirdi.
function veImpPruneSlots(slots) {
  var removed = 0;
  (slots || []).forEach(function(slot) {
    if(!slot || !slot.sensors) return;
    var keep = slot.sensors.filter(function(s) {
      var id = veImpIdOf(s.id);
      if(!id) return true;
      if(veImpFind(id)) return true;
      removed++;
      return false;
    });
    if(keep.length !== slot.sensors.length) {
      slot.sensors = keep;
      if(slot.lanes) slot.lanes = [];
      if(keep.length === 0 && slot._dataSource && slot._dataSource.indexOf('import:') === 0) {
        delete slot._dataSource;
        if(slot.xAxis && slot.xAxis._dataSource) delete slot.xAxis._dataSource;
      }
    }
  });
  return removed;
}

// Veri Gezgini ağacı için grup listesi. Şekil js/signal-tree.js'in
// veSigCollectGroups çıktısıyla BİREBİR aynı olmalı — ağaç satırı üreten kod
// ortak (veSigGroupHTML / veSigRowHTML).
function veImpCollectGroups() {
  return veImpDatasets.map(function(ds) {
    var items = ds.columns.map(function(c) {
      return {
        sensorId: ds.sensorId,
        signalId: c.key,
        name: c.name,
        unit: c.unit || '',
        dir: 'comp',
        compType: ds.name,
        source: ds.fileName || 'Excel',
        virtual: true
      };
    });
    return {
      gid: 'imp:' + ds.id,
      key: 'imp:' + ds.id,
      name: ds.name,
      icon: '<span class="mf-ico mf-ico-grid-cells"></span>',
      items: items,
      dragId: ds.sensorId,
      _import: ds.id
    };
  });
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veImpNorm: veImpNorm,
    veImpLooksLikeUnit: veImpLooksLikeUnit,
    veImpIsUnitToken: veImpIsUnitToken,
    veImpParseHeader: veImpParseHeader,
    veImpToNumber: veImpToNumber,
    veImpDetectCommaDecimal: veImpDetectCommaDecimal,
    veImpRowStats: veImpRowStats,
    veImpLooksLikeUnitRow: veImpLooksLikeUnitRow,
    veImpDetectHeaderRow: veImpDetectHeaderRow,
    veImpBuildColumns: veImpBuildColumns,
    veImpReadValues: veImpReadValues,
    veImpForwardFill: veImpForwardFill,
    veImpGuessXColumn: veImpGuessXColumn,
    veImpIsMonotonic: veImpIsMonotonic,
    veImpBuildDataset: veImpBuildDataset,
    veImpAdd: veImpAdd,
    veImpFind: veImpFind,
    veImpIdOf: veImpIdOf,
    veImpColumn: veImpColumn,
    veImpSeries: veImpSeries,
    veImpXSeries: veImpXSeries,
    veImpRemove: veImpRemove,
    veImpDropStaleAxis: veImpDropStaleAxis,
    veImpAny: veImpAny,
    veImpPruneSlots: veImpPruneSlots,
    veImpCollectGroups: veImpCollectGroups,
    _reset: function() { veImpDatasets = []; veImpSeq = 0; }
  };
}
