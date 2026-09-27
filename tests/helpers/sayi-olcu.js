/**
 * sayi-olcu.js — EKRANDA ve BELGEDE Türkçe sayı ölçütleri (karar 7·C)
 * ───────────────────────────────────────────────────────────────────────────
 * Pencere taraması (tests/e2e/sayi-pencere.spec.js) ile belge taraması
 * (tests/e2e/sayi-belge.spec.js) AYNI ölçütü kullanır; kural burada tek yerde.
 * Davranışı tests/unit/sayi-olcu.test.js tutar — ölçütün kendisi de düşebilmeli.
 *
 * Ölçülen dört yazım:
 *   NOKTA        noktalı ondalık: "0.5361" · "8.5". Üç haneli kesir ("1.090")
 *                Türkçe binlikle karışır, SAYILMAZ — onu kaynak tarayıcısı
 *                (tools/sayi-dili.js) toFixed'den yakalar.
 *   GRUPSUZ      binliği gruplanmamış 4+ haneli sayı: "2800 rpm"
 *   BOSLUKLU     boşlukla gruplanmış sayı: "13 150" (ISO yazımı; seçilmedi)
 *   SONDA_YUZDE  sayıdan SONRA yüzde: "97,0%" · "5 %" (Türkçe: %97,0)
 *
 * AD OLAN SAYI KALIR: şanzıman modeli, parça no, ön ayar adı, standart,
 * formül sabiti (P × 9550 / n · T·ω/1000), tarih, telif yılı, bölüm no.
 */

const NOKTA = /(?<![\p{L}\d.,_\-])(?:0\.\d+|\d+\.\d{1,2}|\d+\.\d{4,})(?![\d.,])/gu;
const GRUPSUZ = /(?<![\p{L}\d.,_\-])\d{4,}(?:[.,]\d+)?(?![\d\p{L}])/gu;
const BOSLUKLU = /(?<![\p{L}\d.,])\d{1,3}(?: \d{3})+(?:[.,]\d+)?(?!\d)/gu;
const SONDA_YUZDE = /(?<![\p{L}])\d+(?:[.,]\d+)?\s?%(?!\d)/gu;

const SABIT = '(?:1000|3600|9549|9550|50000|60000)';
const AD = [
  ['şanzıman modeli', /Allison|\bSP\b|\d{4}SP|8L90|8HP|ZF|Aile:|Ailesi/],
  ['parça / katalog no', /AMC|57RS|FR\d|TK0|\(A26\)|Valeo|Prestolite|Sanden|\d{9,}|E9843|AG00976|LMT-|ASR-SR/],
  ['motor ön ayarı', /Duramax|ISX|ISB|ISL|ISM|ISG|I6\b|\d\.\dL|Nm&|\(\d{4} Nm\) \|/],
  ['kompresör ön ayarı', /Wabco|Knorr|bar\b/],
  ['telif yılı', /©|\(c\)/],
  ['araç adı', /BMC|\d\.\dT\b/],
  ['formül sabiti', new RegExp('× 9550|× 9549|9549 ?[·,]|[*/×] ?' + SABIT + '(?![\\d.,])|(?<![\\d.,])' + SABIT + ' ?[*/×]')],
  ['standart / kayış adı', /ISO|DIN|SAE|\dPK/],
  ['tarih', /20\d\d-\d\d|\d\d\.\d\d\.20\d\d|(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) (?:19|20)\d\d/],
  // Kaynakça yılı: "Kong 2016", "Gerbert & Hansson (1987)", "Balta ve ark. 2015", "Eng. 55(2), 2019"
  ['kaynak yılı', /[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?: ve ark\.| & [A-ZÇĞİÖŞÜ][a-zçğıöşü]+)? \(?(?:19|20)\d\d\b|\d+\(\d+\), (?:19|20)\d\d/],
  ['bölüm no', /§/],
  // Denklem ve bölüm NUMARASI ondalık değil: "(4.4)", "Bölüm 8.18", başlık "9.1 Dinamik rijitlik".
  ['denklem / bölüm no', /\(\d+\.\d+\)|Bölüm \d|Denklem|Tablo \d|Şekil \d|(?:^|\s)\d+\.\d+ [A-ZÇĞİÖŞÜ][a-zçğıöşü]{3,}/],
];

// Eşleşmenin 14 karakter öncesine ve 10 karakter sonrasına bakılır: sınıf
// adın KENDİSİNDE aranır, satırın uzağındaki bir ad başka bir sayıyı affetmez.
function sinifla(sayi, bag) {
  const i = bag.indexOf(sayi);
  const cevre = bag.slice(Math.max(0, i - 14), i + sayi.length + 10);
  for (const [ad, re] of AD) if (re.test(cevre)) return ad;
  return null;
}

// Metindeki bütün yanlış yazımlar: [{ tur, sayi, bag }] + ad sayacı.
// Sondaki yüzdede ad aranmaz (ad "%" ile bitmiyor).
function tara(metin) {
  const sorun = [], adlar = {};
  for (const [tur, re] of [['nokta', NOKTA], ['grupsuz', GRUPSUZ], ['boşluklu', BOSLUKLU], ['sonda %', SONDA_YUZDE]]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(metin))) {
      const bag = metin.slice(Math.max(0, m.index - 30), m.index + m[0].length + 20).replace(/\s+/g, ' ').trim();
      // Satır başında "8.10 Mod şekilleri": bölüm başlığının numarası, ondalık değil.
      const baslik = tur === 'nokta' && (m.index === 0 || metin[m.index - 1] === '\n')
        && /^ [A-ZÇĞİÖŞÜ]/.test(metin.slice(m.index + m[0].length, m.index + m[0].length + 2));
      const ad = tur === 'sonda %' ? null : (baslik ? 'bölüm başlığı' : sinifla(m[0], bag));
      if (ad) adlar[ad] = (adlar[ad] || 0) + 1;
      else sorun.push({ tur, sayi: m[0], bag });
    }
  }
  return { sorun, adlar };
}

// ── TXT HİZASI ──────────────────────────────────────────────────────────────
// Türkçe binlik sayıyı uzatır ("13150" → "13.150"); dolgusu yetmeyen hücre
// sonraki sütunu iter. İki kural, önce/sonra karşılaştırmasız:
//
// 1) KUTU: üst kenar (┌ ╔ ┏) ile alt kenar arasındaki her satırda kutunun sağ
//    çizgisi üst kenarın köşesiyle AYNI sütunda.
const SOL_UST = '┌╔┏', SAG_UST = '┐╗┓', SOL_ALT = '└╚┗', DIK_SOL = '│║┃├╟┠┣╠', DIK_SAG = '│║┃┤╢┨┫╣';
function kutuIhlal(metin) {
  const L = metin.split('\n'), out = [];
  for (let i = 0; i < L.length; i++) {
    const s = [...L[i]];
    const c0 = s.findIndex((c) => SOL_UST.includes(c));
    if (c0 < 0) continue;
    let c1 = -1;
    for (let k = s.length - 1; k > c0; k--) if (SAG_UST.includes(s[k])) { c1 = k; break; }
    if (c1 < 0) continue;
    for (let j = i + 1; j < L.length; j++) {
      const t = [...L[j]];
      if (SOL_ALT.includes(t[c0]) || !DIK_SOL.includes(t[c0])) break;
      if (!DIK_SAG.includes(t[c1])) out.push((j + 1) + ': ' + L[j]);
    }
  }
  return out;
}

// 2) BOŞLUK TABLOSU: başlık + kesik çizgi, ardından boş satıra kadar. Ölçüt
//    başlık DEĞİL (ortalanmış başlıklar var), tablonun kendi satırları: üst üste
//    binen sayı aralıkları bir SÜTUN; sütunda ya bütün sayılar aynı yerde biter
//    (sağa yaslı) ya aynı yerde başlar (sola yaslı). Çoğunluğun ne bitişini ne
//    başlangıcını paylaşan sayının satırı ihlaldir. "etiket : değer", formül ve
//    verilerden önce iki kesik çizgi arasında duran başlık satırı tablo satırı
//    sayılmaz (TOPLAM satırı da kesik çizgiler arasında ama verilerden SONRA).
function tabloIhlal(metin) {
  const L = metin.split('\n'), out = new Set();
  const kesik = (l) => /^\s*[-=]{10,}\s*$/.test(l);
  const sayilar = (l, j) => {
    const o = []; const re = /(?<=^|\s)[-−+]?[\d.,]*\d(?=\s|$)/g; let m;
    while ((m = re.exec(l))) o.push({ a: m.index, b: m.index + m[0].length, j });
    return o;
  };
  const cogu = (arr) => { const say = new Map(); arr.forEach((x) => say.set(x, (say.get(x) || 0) + 1)); return [...say.entries()].sort((p, q) => q[1] - p[1])[0][0]; };
  for (let i = 1; i < L.length; i++) {
    if (!kesik(L[i]) || !L[i - 1].trim() || kesik(L[i - 1])) continue;
    const satir = [];
    for (let j = i + 1; j < L.length && L[j].trim(); j++) {
      if (kesik(L[j]) || L[j].indexOf(':') >= 0 || L[j].indexOf('=') >= 0) continue;
      if (!satir.length && j + 1 < L.length && kesik(L[j + 1])) continue;   // verilerden önce: başlık
      satir.push(j);
    }
    if (satir.length < 3) continue;
    const hepsi = [].concat(...satir.map((j) => sayilar(L[j], j))).sort((p, q) => p.a - q.a);
    let kume = [], sonu = -1;
    const denetle = () => {
      if (kume.length < 2) return;
      const b = cogu(kume.map((x) => x.b)), a = cogu(kume.map((x) => x.a));
      if (kume.every((x) => x.b === b) || kume.every((x) => x.a === a)) return;
      kume.forEach((x) => { if (x.b !== b && x.a !== a) out.add((x.j + 1) + ': ' + L[x.j]); });
    };
    for (const x of hepsi) {
      if (x.a >= sonu) { denetle(); kume = []; }
      kume.push(x); sonu = Math.max(sonu, x.b);
    }
    denetle();
  }
  return [...out];
}

// ── FORMÜLÜN TeX KAYNAĞI ────────────────────────────────────────────────────
// Türkçe yazım TeX'te "12.760{,}7": binlik nokta sıradan karakter, ondalık
// virgül süslü parantezde. İki yanlış yazım:
//   TEX_NOKTA   noktalı ondalık "0.5". Binlik nokta ve üç haneli kesir
//               SAYILMAZ — metindeki NOKTA'nın aynı kuralı.
//   TEX_VIRGUL  çıplak ondalık virgül "12,7". KaTeX virgülü NOKTALAMA sayar ve
//               arkasına ince boşluk koyar: "12, 7" okunur. Liste ayracı da
//               bu yüzden ';' — "[0;0;-mg]", "(12{,}5;\ 34)".
const TEX_NOKTA = /(?<![\w.{])(?:0\.\d+|\d+\.\d{1,2}(?!\d)|\d+\.\d{4,})/g;
const TEX_VIRGUL = /\d,\d/g;
function texTara(tex) {
  const out = [];
  for (const [tur, re] of [['nokta', TEX_NOKTA], ['çıplak virgül', TEX_VIRGUL]]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(tex))) out.push(`${tur} "${m[0]}" ⟨${tex.slice(Math.max(0, m.index - 24), m.index + m[0].length + 12).replace(/\s+/g, ' ')}⟩`);
  }
  return out;
}

module.exports = { NOKTA, GRUPSUZ, BOSLUKLU, SONDA_YUZDE, AD, sinifla, tara, kutuIhlal, tabloIhlal, TEX_NOKTA, TEX_VIRGUL, texTara };
