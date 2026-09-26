'use strict';
/**
 * ikon-dili.js — TEK İKON AİLESİ (kullanıcı kararı 10·B, 2026-09-26)
 * ───────────────────────────────────────────────────────────────────────────
 * Arayüzde ikon işi gören her şey çizgi ikondur (`css/icons.css`, `.mf-ico`;
 * JS'te `veIkon(ad)`). Sembol karakteri (▶ ▼ ✓ ✕ ⚠ ★ …) yazı tipinden çizilir —
 * Windows'ta Segoe UI Symbol'dan — ve kalınlığı, boyu, taban çizgisi çizgi
 * ikonlarla uyuşmaz: aynı şeritte iki çizim dili yan yana durur.
 *
 * İKON İŞİ = karakter bir öğenin TEK içeriği ya da etiketin başında/sonunda
 * duran resim yazısı ("✕", "▶ Hesapla", "Gergi gevşek ✓"). Metnin İÇİNDEKİ
 * karakter metindir ("1C→2C", "3 × 4", "üst ↔ alt") ve bu araç ona bakmaz.
 *
 * Düz metin çıktı işareti METİN taşır — kapı onlara bakmaz:
 *   · çözücü günlüğü (`log('…')`), TXT rapor satırı (`…\n'`), tuval yazısı
 *     (`fillText`), konsol;
 *   · `BELGE` tablosundaki işlevler: indirilen/basılan belgenin gövdesi.
 *     Maske ikon bir arka plandır — kopyalanan tabloda boş hücre olur
 *     (`innerText` ""), arka plan grafikleri kapalı baskıda hiç çıkmaz.
 *
 * Kullanım: node tools/ikon-dili.js <dosya...>   → sapmaları listeler
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

// İkon adayı karakterler. Oklar (← ↑ ↓ →) yalnız TEK başına ya da etiketin
// BAŞINDA ikon sayılır; metnin içinde bir bağıntıdır ("Otomatik → Lineer").
const GLIF = '▶▸►▷◀◂◄◁▲▴△▼▾▽⚠✓✔✗✘✕✖★☆⚙⏳⏸↻↺⟳✎⤢◇◆◎●○⬤▢♪✥✦✧';
const OK = '←↑↓→';
const EMOJI = '\\u{1F300}-\\u{1FAFF}\\u{2693}';
const G = '[' + GLIF + EMOJI + ']';
const GO = '[' + GLIF + OK + EMOJI + ']';
const B = '(?:\\s|&nbsp;|&#160;)';

// Konumlar. Dizge ayıracı ' " ` üçü de.
const KONUM = [
  // tek başına dizge: '▼', ' ⚠', "✕"
  ['tek', new RegExp("(['\"`])" + B + '*(' + GO + ')' + B + '*\\1', 'gu')],
  // etiketin başı: >✕<, >▶ Hesapla, > ✓ uygun
  ['öğe', new RegExp('>' + B + '*(' + GO + ')(?=' + B + '|<|$)', 'gu')],
  // dizgenin başı: '✓ model çözülüyor', '⚠ Şanzıman…', '  ✓ GEÇTİ'
  ['baş', new RegExp("(['\"`])" + B + '*(' + GO + ')(?=' + B + '|<)', 'gu')],
  // etiketin sonu: gevşek ✓</span>, [s] ▾</button>
  ['son', new RegExp(B + '(' + G + ')' + B + '*</', 'gu')],
  // dizgenin sonu: 'Uyarılar 1 ▲', ' ⚠'
  ['sonu', new RegExp(B + '(' + G + ')' + B + "*(['\"`])", 'gu')]
];
// CSS: sözde öğenin içeriği karakter ('✓', '\25be').
const CSS_ICERIK = /content\s*:\s*(['"])((?:\\[0-9a-fA-F]{2,6}\s?)|[^'"\\])\1/g;
const CSS_KACIS = /^\\([0-9a-fA-F]{2,6})\s?$/;

// Düz metin bağlamı (satır). Günlük düz metin tablodur; TXT satırı \n ile biter.
const DUZ_METIN = [
  /(?<![.\w$])(?:log|_log)\(/,
  /\.(?:fillText|strokeText|measureText)\(/,
  /\bconsole\.\w+\(/,
  /\\n['"`]/
];

// Değişkene konup düz metne giden karakter satırın kendisinden anlaşılmaz
// (`var icon = '↓'; … log(… + icon)`): satır sonu yorumu `// metin: <sebep>`
// onu METİN diye işaretler. Sebep yazılır, yoksa işaret bir susturucu olur.
const METIN_ISARETI = /\/\/\s*metin:\s*\S/;

// Belge gövdesi üreten işlevler (dosya → işlev adları): indirilen/basılan
// belgenin içi. Arayüz kabuğu (kapat, bölüm oku, düğme) BURADA DEĞİL.
const BELGE = {};

// ── yorum sökücü ─────────────────────────────────────────────────────────────
// Dizgeleri, şablon dizgelerini ve düzenli ifadeleri koruyarak // ve /* */
// yorumlarını BOŞLUKLA değiştirir (satır numaraları ve konumlar korunur).
function yorumsuzJs(s) {
  const out = s.split('');
  let i = 0, son = '';
  const bosalt = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { const e = s.indexOf('\n', i); const j = e < 0 ? s.length : e; bosalt(i, j); i = j; continue; }
    if (c === '/' && d === '*') { const e = s.indexOf('*/', i + 2); const j = e < 0 ? s.length : e + 2; bosalt(i, j); i = j; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      while (j < s.length && s[j] !== c) { if (s[j] === '\\') j++; else if (c !== '`' && s[j] === '\n') break; j++; }
      i = j + 1; son = 'x'; continue;
    }
    if (c === '/') {
      // düzenli ifade mi bölme mi: önceki anlamlı simge karar verir
      if (/^[(,=:[!&|?{};+\-*%<>~^]$|^$/.test(son) || /\b(?:return|typeof|case|in|of)$/.test(s.slice(Math.max(0, i - 8), i).trimEnd())) {
        let j = i + 1, sinif = false;
        while (j < s.length && s[j] !== '\n') {
          if (s[j] === '\\') { j += 2; continue; }
          if (s[j] === '[') sinif = true; else if (s[j] === ']') sinif = false;
          else if (s[j] === '/' && !sinif) break;
          j++;
        }
        i = j + 1; son = 'x'; continue;
      }
    }
    if (!/\s/.test(c)) son = c;
    i++;
  }
  return out.join('');
}
function yorumsuzHtml(s) {
  return s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (m, a, b, c) => a + yorumsuzJs(b) + c);
}
function yorumsuzCss(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

// Belge işlevlerinin gövdesini [başlangıç, bitiş) aralığı olarak bulur.
function belgeAraliklari(f, s) {
  const out = [];
  (BELGE[f] || []).forEach((ad) => {
    const i = s.indexOf('function ' + ad + '(');
    if (i < 0) throw new Error(f + ': BELGE işlevi yok: ' + ad);
    let j = s.indexOf('{', i), d = 0;
    for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) break; }
    out.push([i, j + 1]);
  });
  return out;
}

function sapmalar(f) {
  return tara(oku(f), f);
}

// Metni tarar; tür dosya adının uzantısından (.css / .html / .js).
function tara(ham, f) {
  const s = f.endsWith('.css') ? yorumsuzCss(ham) : f.endsWith('.html') ? yorumsuzHtml(ham) : yorumsuzJs(ham);
  const satirlar = s.split('\n'), hamSatirlar = ham.split('\n');
  const satirNo = (i) => s.slice(0, i).split('\n').length;
  const out = [], gor = new Set();
  if (f.endsWith('.css')) {
    let m; CSS_ICERIK.lastIndex = 0;
    while ((m = CSS_ICERIK.exec(s))) {
      const k = CSS_KACIS.exec(m[2]);
      const ch = k ? String.fromCodePoint(parseInt(k[1], 16)) : m[2];
      if ((GLIF + OK).includes(ch)) out.push({ dosya: f, satir: satirNo(m.index), konum: 'css', glif: ch, metin: m[0] });
    }
    return out;
  }
  const belge = belgeAraliklari(f, s);
  for (const [konum, re] of KONUM) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(s))) {
      const ch = m[m.length - 1].length <= 2 && new RegExp(GO, 'u').test(m[m.length - 1]) ? m[m.length - 1] : m[konum === 'sonu' ? 1 : m.length - 1];
      const at = m.index + m[0].indexOf(ch);
      if (gor.has(at)) continue;
      const no = satirNo(at), satir = satirlar[no - 1];
      if (DUZ_METIN.some((d) => d.test(satir))) continue;
      if (METIN_ISARETI.test(hamSatirlar[no - 1])) continue;
      if (s.slice(Math.max(0, at - 5), at) === '<kbd>') continue;          // tuşun adı (↑ ↓ ↵)
      // iki yanı boşluklu ok bir ayraç ya da bağıntıdır: .join(' → '), ' → ' + mod
      if (OK.includes(ch) && /^\s/.test(s.slice(at - 1, at)) && /^\s/.test(s.slice(at + 1, at + 2))) continue;
      if (belge.some(([a, b]) => at >= a && at < b)) continue;
      gor.add(at);
      out.push({ dosya: f, satir: no, konum, glif: ch, metin: satir.trim().slice(0, 140) });
    }
  }
  return out.sort((a, b) => a.satir - b.satir);
}

module.exports = { sapmalar, tara, yorumsuzJs, yorumsuzHtml, yorumsuzCss, GLIF, OK, BELGE, DUZ_METIN, METIN_ISARETI };

if (require.main === module) {
  let n = 0;
  process.argv.slice(2).forEach((f) => {
    sapmalar(f).forEach((x) => { n++; console.log(x.dosya + ':' + x.satir + ' [' + x.konum + ' ' + x.glif + '] ' + x.metin); });
  });
  console.log(n ? n + ' sapma' : 'sapma yok');
  process.exitCode = n ? 1 : 0;
}
