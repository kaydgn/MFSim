'use strict';
/**
 * metin-dili.js — ARAYÜZ ANLATMAZ (kullanıcı kararı, 2026-10-16)
 * ───────────────────────────────────────────────────────────────────────────
 * Ekranda ve belgede yalnız AD, VERİ ve DURUM durur. Bu dosya kuralın makineyle
 * okunan tarafının TEK kaynağı: kapı (tests/unit/metin-dili.test.js) ve temizlik
 * aşamalarının envanteri buradan tarar.
 *
 * ÇIKARMA: dize sabitleri Babel AST'den okunur. '+' zinciri tek metindir, ifade
 * yeri ‹›. HTML etiketi sökülür; satır içi etiket (b, i, span, sub…) metni
 * bölmez, öteki her etiket ve satır sonu böler. title · placeholder ·
 * aria-label · alt ayrı öğedir. Konsol, seçici, olay adı, karşılaştırma ve
 * nesne anahtarı metin değildir.
 *
 * İŞARETLER (hüküm değil ADAY — hüküm aşamanın incelemesinde verilir):
 *   sohbet     başlayalım · seçtiğin · sen · istersen · önerilen · lütfen
 *   kendi      bu sayfa / pencere / tablo · aşağıdaki · burada
 *   gerekce    neden · çünkü · aksi hâlde · karşı olgu (olurdu, silerdi, çıkmazdı)
 *   gelistirme ölçüldü · kapı · çekilir · sessizce · cümle içinde BÜYÜK HARFLE vurgu
 *   tarif      ≥ 4 sözcüklü metinde emir kipi (ekle · seçin · sürükle · oku)
 *   uzun       ≥ ESIK sözcüklü düz yazı
 *
 * PROFİL: kılavuz (js/guide-*.js) açıklamanın yeridir — orada yalnız sohbet,
 * gerekçe ve geliştirme dili sayılır. Belge gövdesi (sınırı ikon kapısıyla
 * ortak: tools/ikon-dili.js → BELGE · BELGE_DOSYA) mühendislik metni taşır —
 * uzun yazı ve "aşağıdaki tablo" sayılmaz.
 *
 * Kullanım:
 *   node tools/metin-dili.js <dosya...>        işaretli metinleri listeler
 *   node tools/metin-dili.js --envanter [çıkış] bütün metinler (JSON)
 *   node tools/metin-dili.js --taban [--kabul]  kapının tabanını yazar; yeni kayıt
 *                                               yalnız --kabul ile girer
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { belgeMi, yorumsuzJs } = require('./ikon-dili.js');

const KOK = path.join(__dirname, '..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
const TABAN = path.join(KOK, 'tests/fixtures/metin-dili-taban.json');
const ESIK = 8;

// ── KAPSAM ─────────────────────────────────────────────────────────────────
// Ürünün metni: js/ (dışarıdan gelen çekirdek hariç), görüntüleyicinin kendi
// dosyaları (öteki dosyaları js/'in kopyası), CAN Çözümleyici ve üç sayfa.
// Yeni dosya kendiliğinden girer.
const ISTISNA = {
  'js/fead-core.js': 'dışarıdan geldi, birebir durur (FEAD skill, kural 1)',
  'js/structural-occt-wasm.js': 'üretilen dosya: gömülü WASM ikilisi',
  'js/mount-report-assets.js': 'üretilen dosya: gömülü KaTeX yazı tipleri'
};
const GORUNTULEYICI_OZ = ['viewer/js/app.js', 'viewer/js/board.js', 'viewer/js/theme.js'];
function kapsam() {
  const js = (d) => fs.readdirSync(path.join(KOK, d)).filter((f) => f.endsWith('.js')).map((f) => d + '/' + f).sort();
  return [...js('js').filter((f) => !ISTISNA[f]), ...GORUNTULEYICI_OZ, ...js('candbc/js'),
    'index.html', 'viewer/index.html', 'candbc/index.html'];
}
const KILAVUZ = /^js\/guide-/;

// ── SÖZLÜK — Türkçe küçük harfe çevrilmiş metinde aranır ───────────────────
// \b Türkçe harfi sözcük saymaz; sınır elle kurulur.
const S = (govde) => new RegExp('(?<![\\p{L}\\p{N}_])(?:' + govde + ')(?![\\p{L}\\p{N}_])', 'gu');
const SOZLUK = {
  sohbet: [
    S('\\p{L}{2,}(?:y?alım|y?elim)'),                                  // başlayalım · ekleyelim
    S('sen|senin|sana|seni|sende|senden|sence'),
    S('istersen|isterseniz|dilersen|dilerseniz'),
    S('\\p{L}{2,}[dt](?:ığ|iğ|uğ|üğ)(?:ın|in|un|ün)(?:(?:ız|iz|uz|üz)\\p{L}*)?'),  // seçtiğin · yüklediğiniz
    S('\\p{L}{2,}(?:abilirsin|ebilirsin)(?:iz)?'),
    S('\\p{L}{2,}(?:ırsın|irsin|ursun|ürsün|arsın|ersin)(?:ız|iz|uz|üz)?'),
    S('önerilen|öneririz|önerimiz|tavsiye\\p{L}*|lütfen|unutma\\p{L}*|merak etme\\p{L}*|hadi|harika|tebrikler|maalesef|ne yazık ki|hoş geldin\\p{L}*|merhaba')
  ],
  kendi: [
    S('bu (?:sayfa|pencere|panel|bölüm|kısım|rapor|belge|tablo|kart|düğme|alan|sekme|ekran|grafik|diyagram|liste|şerit|satır|sütun|kutu|menü|görünüm|seçenek|ayar|özellik|pano|föy|şekil)\\p{L}*'),
    S('aşağıda\\p{L}*|yukarıda\\p{L}*|burada\\p{L}*|buradan|şurada|sağdaki|soldaki|üstteki|alttaki')
  ],
  gerekce: [
    S('neden(?!\\s+ol)'),
    S('çünkü|aksi h[âa]lde|zira|bilerek|kasıtlı\\p{L}*|bilinçli\\p{L}*|sorulmuyor|istenmiyor'),
    S('\\p{L}{2,}(?:ır|ir|ur|ür|ar|er)(?:dı|di|du|dü)(?:k|n|nız|niz)?'),   // olurdu · silerdi
    S('\\p{L}{2,}(?:maz|mez)(?:dı|di)|\\p{L}{2,}(?:acak|ecek)(?:tı|ti)'),
    S('(?:program|yazılım)\\p{L}*(?:\\s+\\p{L}+){0,3}\\s+\\p{L}+(?:maz|mez)')
  ],
  gelistirme: [
    S('ölçüldü|ölçtük|kapı|kapı[sdyln]\\p{L}*|çekilir|sessizce|tek kaynak\\p{L}*|bayat\\p{L}*|regresyon\\p{L}*|commit\\p{L}*|kullanıcı (?:kararı|isteği|bildirimi)|bu kod\\p{L}*|kodun kendisi\\p{L}*')
  ],
  tarif: [
    new RegExp('(?<![\\p{L}\\p{N}_])(?:ekle|seç|sürükle|tıkla|gir|kur|aç|kapat|kullan|bak|ver|oku|yaz|değiştir|düzelt|dene|çalıştır|hesapla|yükle|kaydet|sil|taşı|bırak|çöz|başla|dön|tanımla|belirle|işaretle|onayla|bağla|güncelle|ayarla|sırala|çevir|çiz|ölç|incele|tut|bas)'
      + '(?:in|ın|un|ün|yin|yın|yun|yün)?(?=\\s*(?:[.;:!)…]|$)|\\s+(?:ya da|veya|ve|ile|sonra)(?![\\p{L}]))', 'gu'),
    S('kaydedin')
  ]
};
// Cümle içinde büyük harfle vurgu ("bir KAPIDIR"). Bütünü büyük harf olan metin
// bir başlıktır (TXT raporun "SONUÇ ÖZETİ") ve sayılmaz; kısaltma (FEAD, STEP)
// Türkçe harf taşımadığı için düşmez. Türkçe harfli özel ad: AD_BUYUK.
const BUYUK = /(?<![\p{L}\p{N}_])[A-ZÇĞİÖŞÜ]{4,}(?![\p{L}\p{N}_])/gu;
const VURGU = new Set(['ASLA', 'AYNI', 'SADECE', 'YALNIZ', 'TAMAMI', 'KALIR', 'ARTIK', 'ANCAK', 'HEPSİ']);
const AD_BUYUK = new Set(['KİRPİ', 'ŞİMŞEK', 'GÜÇ']);

const PROFIL_ISARET = {
  arayuz: ['sohbet', 'kendi', 'gerekce', 'gelistirme', 'tarif', 'uzun'],
  belge: ['sohbet', 'gerekce', 'gelistirme', 'tarif'],
  kilavuz: ['sohbet', 'gerekce', 'gelistirme']
};

function sozcukSay(t) {
  return t.split(/[\s/]+/).map((p) => p.replace(/^[(“"'‘«]+|[.,;:!?…)”"'’»]+$/g, ''))
    .filter((p) => /^\p{L}[\p{L}'’-]*$/u.test(p) && p.length >= 2).length;
}

function isaretle(metin, profil) {
  const kucuk = metin.toLocaleLowerCase('tr');
  const n = sozcukSay(metin), out = [];
  for (const k of PROFIL_ISARET[profil]) {
    if (k === 'uzun') { if (n >= ESIK) out.push(k); continue; }
    if (k === 'tarif' && n < 4) continue;
    const res = SOZLUK[k];
    if (res.some((re) => { re.lastIndex = 0; return re.test(kucuk); })) { out.push(k); continue; }
    if (k === 'gelistirme' && /\p{Ll}/u.test(metin)) {
      // Baştaki iki ve daha çok büyük harfli sözcük bir başlıktır ("TEKERLEK GÜCÜ (ortalama)").
      const govde = metin.replace(/^[\s‹›(\[]*(?:[A-ZÇĞİÖŞÜ0-9][A-ZÇĞİÖŞÜ0-9.\-–/]*[\s:—–·-]+){2,}/u, '');
      const vurgu = [...govde.matchAll(BUYUK)].map((m) => m[0])
        .some((w) => !AD_BUYUK.has(w) && (VURGU.has(w) || /[ÇĞİÖŞÜ]/.test(w)));
      if (vurgu) out.push(k);
    }
  }
  return out;
}

// ── HTML'DEN METNE ─────────────────────────────────────────────────────────
const SATIR_ICI = /^(?:b|i|em|strong|span|sub|sup|u|a|code|small|abbr|var|kbd|mark|br|wbr|s|q|cite|dfn|time|bdi|tspan)$/i;
const VARLIK = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", mdash: '—', ndash: '–', hellip: '…',
  middot: '·', times: '×', minus: '−', deg: '°', rarr: '→', larr: '←', thinsp: ' ', ensp: ' ', emsp: ' ' };
const cozVarlik = (t) => t.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, v) => {
  if (v[0] === '#') { const n = v[1] === 'x' || v[1] === 'X' ? parseInt(v.slice(2), 16) : parseInt(v.slice(1), 10); return isFinite(n) ? String.fromCodePoint(n) : m; }
  return Object.prototype.hasOwnProperty.call(VARLIK, v.toLowerCase()) ? VARLIK[v.toLowerCase()] : m;
});
const YER = '\u0002';            // ifadenin yeri
const sade = (t) => cozVarlik(t).replace(/\u0002/g, '‹›').replace(/\s+/g, ' ').trim();
const OZNITELIK = /\b(title|placeholder|aria-label|alt|data-tip)\s*=\s*(["'])([^"']*?)\2/gi;

function bolutle(ham) {
  const out = [];
  ham = ham.replace(/<(style|script)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi, '\u0001').replace(/\/\*[\s\S]*?\*\//g, '\u0001');
  ham.replace(/<[a-zA-Z][^<>]*>/g, (etiket) => {
    for (const m of etiket.matchAll(OZNITELIK)) out.push({ metin: m[3], baglam: m[1].toLowerCase() });
    return etiket;
  });
  const govde = ham.replace(/<!--[\s\S]*?-->/g, '\u0001')
    .replace(/<(\/?)([a-zA-Z][\w-]*)\b[^<>]*>/g, (t, k, ad) => (SATIR_ICI.test(ad) ? (/^br$/i.test(ad) || (k && /^span$/i.test(ad)) ? ' ' : '') : '\u0001'));
  govde.split(/[\u0001\n]/).forEach((p) => out.push({ metin: p, baglam: 'metin' }));
  return out;
}

// ── JS ─────────────────────────────────────────────────────────────────────
let _parser = null;
function parser() { return _parser || (_parser = require('@babel/parser')); }

const KOD_CAGRI = /^(?:querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName|closest|matches|getAttribute|hasAttribute|removeAttribute|addEventListener|removeEventListener|dispatchEvent|createElement|createElementNS|getItem|setItem|removeItem|getPropertyValue|setProperty|removeProperty|split|join|indexOf|lastIndexOf|includes|startsWith|endsWith|replace|replaceAll|match|matchAll|test|search|padStart|padEnd|toggle|contains|getContext|postMessage|importScripts|fetch|require|insertAdjacentHTML_konum|scrollIntoView|use|doc|collection|setData|getData)$/;
const KOD_IDENT = /^(?:require|fetch|RegExp|Error|TypeError|RangeError|parseInt|parseFloat|Number|Symbol|Function|importScripts|setTimeout|setInterval)$/;
const KARSILASTIRMA = /^(?:===|!==|==|!=|in|instanceof|<|>|<=|>=)$/;

function cagriAdi(c) {
  if (!c) return '';
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression' && !c.computed && c.property) return c.property.name || '';
  return '';
}
function konsolMu(c) {
  return c && c.type === 'MemberExpression' && c.object && c.object.type === 'Identifier' && c.object.name === 'console';
}

// Zincirin metni; ifade yerine YER.
function zincir(n) {
  if (n.type === 'StringLiteral') return n.value;
  if (n.type === 'TemplateLiteral') return n.quasis.map((q) => (q.value.cooked == null ? q.value.raw : q.value.cooked)).join(YER);
  if (n.type === 'BinaryExpression' && n.operator === '+') return zincir(n.left) + zincir(n.right);
  return YER;
}
const metinDugumu = (n) => n && (n.type === 'StringLiteral' || n.type === 'TemplateLiteral' ||
  (n.type === 'BinaryExpression' && n.operator === '+'));
// '+' zincirinin tepesi metin mi: en az bir dize parçası taşıyor mu.
function dizeVar(n) {
  if (n.type === 'StringLiteral' || n.type === 'TemplateLiteral') return true;
  if (n.type === 'BinaryExpression' && n.operator === '+') return dizeVar(n.left) || dizeVar(n.right);
  return false;
}

// Düğüm metin değil de kod mu (seçici, olay adı, anahtar, karşılaştırma)?
// Yalnız DOĞRUDAN üst bakılır: bir geri çağırmanın içindeki bildirim metni,
// geri çağırmayı alan addEventListener yüzünden düşmesin.
function kodMu(n, ust, ata) {
  if (!ust) return false;
  if ((ust.type === 'ObjectProperty' || ust.type === 'ObjectMethod' || ust.type === 'ClassProperty') && ust.key === n && !ust.computed) return true;
  if (ust.type === 'MemberExpression' && ust.property === n) return true;
  if (ust.type === 'BinaryExpression' && KARSILASTIRMA.test(ust.operator)) return true;
  if (ust.type === 'SwitchCase' && ust.test === n) return true;
  if (ust.type === 'ImportDeclaration' || ust.type === 'ExportAllDeclaration') return true;
  if (ust.type === 'CallExpression' || ust.type === 'NewExpression') {
    if (ust.callee === n) return true;
    if (konsolMu(ust.callee)) return true;
    const ad = cagriAdi(ust.callee);
    if (ust.callee.type === 'Identifier' && KOD_IDENT.test(ad)) return true;
    if (ad === 'setAttribute' || ad === 'insertAdjacentHTML') return ust.arguments[0] === n;
    if (KOD_CAGRI.test(ad)) return true;
    if ((ad === 'add' || ad === 'remove') && ust.callee.object && cagriAdi(ust.callee.object) === 'classList') return true;
  }
  if (ust.type === 'ThrowStatement') return false;
  void ata;
  return false;
}

// Bağlam: metin ekranda nereye gidiyor (bildirim, ipucu, alan adı…).
const BILDIRIM = /^(?:showToast|veToast|veBildirim|toast|alert|confirm|prompt|veOnay|veSor)$/;
function baglamBul(n, ust) {
  if (!ust) return { baglam: 'metin' };
  if (ust.type === 'CallExpression') {
    const ad = cagriAdi(ust.callee);
    if (BILDIRIM.test(ad)) return { baglam: 'bildirim', cagri: ad };
    if (ad === 'setAttribute' && ust.arguments[1] === n && ust.arguments[0] && ust.arguments[0].type === 'StringLiteral')
      return { baglam: ust.arguments[0].value.toLowerCase() };
    return { baglam: 'metin', cagri: ad || undefined };
  }
  if (ust.type === 'AssignmentExpression' && ust.right === n && ust.left.type === 'MemberExpression' && !ust.left.computed) {
    const p = ust.left.property.name;
    if (p === 'title' || p === 'placeholder') return { baglam: p };
    return { baglam: 'metin', alan: p };
  }
  if (ust.type === 'ObjectProperty' && ust.value === n) {
    const k = ust.key && (ust.key.name || ust.key.value);
    return { baglam: 'metin', alan: k };
  }
  if (ust.type === 'ThrowStatement' || (ust.type === 'NewExpression' && /Error$/.test(cagriAdi(ust.callee)))) return { baglam: 'hata' };
  return { baglam: 'metin' };
}

function kimlik(dosya, metin, baglam) {
  return crypto.createHash('sha1').update(dosya + '\u0000' + baglam + '\u0000' + metin).digest('hex').slice(0, 10);
}

function ogeler(dosya, ham, satir, profil, kok) {
  const out = [];
  for (const b of bolutle(ham)) {
    const metin = sade(b.metin);
    const n = sozcukSay(metin);
    if (!n) continue;
    const baglam = b.baglam === 'metin' ? kok.baglam : b.baglam;
    out.push({ id: kimlik(dosya, metin, baglam), dosya, satir, profil, baglam, alan: kok.alan, cagri: kok.cagri,
      sozcuk: n, metin, isaret: isaretle(metin, profil) });
  }
  return out;
}

function jsMetinleri(dosya, ham) {
  let ast;
  try {
    ast = parser().parse(ham, { sourceType: 'script', errorRecovery: true, allowReturnOutsideFunction: true });
  } catch (e) {
    throw new Error(dosya + ': ayrıştırılamadı — ' + e.message);
  }
  const kilavuz = KILAVUZ.test(dosya);
  const belge = kilavuz ? () => false : belgeMi(dosya, yorumsuzJs(ham), true);
  const out = [];
  (function yuru(n, ust, ata) {
    if (!n || typeof n.type !== 'string') return;
    if (metinDugumu(n) && !(ust && ust.type === 'BinaryExpression' && ust.operator === '+' && metinDugumu(ust))) {
      if (dizeVar(n) && !kodMu(n, ust, ata)) {
        const profil = kilavuz ? 'kilavuz' : belge(n.start) ? 'belge' : 'arayuz';
        out.push(...ogeler(dosya, zincir(n), n.loc.start.line, profil, baglamBul(n, ust)));
      }
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments' || k === 'extra') continue;
      const v = n[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') yuru(c, n, ata); }
      else if (v && typeof v.type === 'string') yuru(v, n, ata);
    }
  })(ast.program, null, null);
  return out;
}

// ── HTML SAYFASI ───────────────────────────────────────────────────────────
// Betik ve stil gövdesi metin değil; satır içi betik ayrıca JS olarak taranır.
function satirSayaci(ham) {
  const bas = [0];
  for (let i = ham.indexOf('\n'); i >= 0; i = ham.indexOf('\n', i + 1)) bas.push(i + 1);
  return (at) => { let a = 0, b = bas.length - 1; while (a < b) { const o = (a + b + 1) >> 1; if (bas[o] <= at) a = o; else b = o - 1; } return a + 1; };
}
function htmlMetinleri(dosya, ham) {
  const out = [];
  const satirNo = satirSayaci(ham);
  const ici = ham.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const re = />([^<>]+)</g;
  let m;
  while ((m = re.exec(ici))) {
    const metin = sade(m[1]);
    const n = sozcukSay(metin);
    if (!n) continue;
    out.push({ id: kimlik(dosya, metin, 'metin'), dosya, satir: satirNo(m.index + 1), profil: 'arayuz', baglam: 'metin',
      sozcuk: n, metin, isaret: isaretle(metin, 'arayuz') });
  }
  const etiketRe = /<[a-zA-Z][^<>]*>/g;
  while ((m = etiketRe.exec(ici))) {
    for (const a of m[0].matchAll(OZNITELIK)) {
      const metin = sade(a[3]);
      const n = sozcukSay(metin);
      if (!n) continue;
      const baglam = a[1].toLowerCase();
      out.push({ id: kimlik(dosya, metin, baglam), dosya, satir: satirNo(m.index), profil: 'arayuz', baglam,
        sozcuk: n, metin, isaret: isaretle(metin, 'arayuz') });
    }
  }
  const betikRe = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = betikRe.exec(ham))) {
    const bas = satirNo(m.index + m[0].indexOf('>') + 1) - 1;
    if (!/\S/.test(m[1])) continue;
    let ic;
    try { ic = jsMetinleri(dosya, m[1]); } catch (e) { continue; }
    ic.forEach((x) => { x.satir += bas; out.push(x); });
  }
  return out;
}

function metinler(dosya) {
  const ham = oku(dosya);
  return dosya.endsWith('.html') ? htmlMetinleri(dosya, ham) : jsMetinleri(dosya, ham);
}

// İşaretli öğeler, dosya başına kimliğe göre tekil.
function isaretliler(dosyalar) {
  const out = [];
  for (const f of dosyalar || kapsam()) {
    const gor = new Set();
    for (const x of metinler(f)) {
      if (!x.isaret.length || gor.has(x.id)) continue;
      gor.add(x.id);
      out.push(x);
    }
  }
  return out;
}

// Taban: dosya → { kimlik: önizleme }. Önizleme yalnız okuyan için; eşleşme kimlikle.
function tabanOku() {
  return fs.existsSync(TABAN) ? JSON.parse(fs.readFileSync(TABAN, 'utf8')).dosyalar : {};
}
function tabanYaz(liste, kabul) {
  const eski = tabanOku();
  const yeni = {};
  liste.forEach((x) => { (yeni[x.dosya] = yeni[x.dosya] || {})[x.id] = x.metin.slice(0, 80); });
  const eklenen = [];
  for (const [f, k] of Object.entries(yeni)) for (const id of Object.keys(k)) if (!(eski[f] && eski[f][id])) eklenen.push(f + ' ' + id);
  if (eklenen.length && !kabul && Object.keys(eski).length) {
    throw new Error(eklenen.length + ' yeni kayıt tabana girmek istiyor — taban yalnız küçülür.\n'
      + '  Metni düzelt; kullanıcı "kalsın" dediyse --kabul ver.\n  ' + eklenen.slice(0, 20).join('\n  '));
  }
  const dosyalar = {};
  Object.keys(yeni).sort().forEach((f) => {
    dosyalar[f] = {};
    Object.keys(yeni[f]).sort().forEach((id) => { dosyalar[f][id] = yeni[f][id]; });
  });
  const sayi = Object.values(dosyalar).reduce((a, k) => a + Object.keys(k).length, 0);
  fs.writeFileSync(TABAN, JSON.stringify({
    kural: 'ARAYÜZ ANLATMAZ (CLAUDE.md). Kuraldan önce yazılmış, henüz temizlenmemiş işaretli metinler. '
      + 'Yalnız küçülür: node tools/metin-dili.js --taban',
    sayi, dosyalar
  }, null, 1) + '\n');
  return { sayi, eklenen: eklenen.length };
}

module.exports = { kapsam, metinler, isaretliler, isaretle, sozcukSay, bolutle, tabanOku, tabanYaz,
  SOZLUK, PROFIL_ISARET, ESIK, ISTISNA, TABAN, KILAVUZ };

if (require.main === module) {
  const arg = process.argv.slice(2);
  if (arg[0] === '--envanter') {
    const hepsi = kapsam().flatMap((f) => metinler(f));
    const cikis = arg[1] || path.join(KOK, 'metin-envanteri.json');
    fs.writeFileSync(cikis, JSON.stringify(hepsi));
    console.log(hepsi.length + ' metin · ' + hepsi.filter((x) => x.isaret.length).length + ' işaretli → ' + cikis);
  } else if (arg[0] === '--taban') {
    const r = tabanYaz(isaretliler(), arg.includes('--kabul'));
    console.log('taban: ' + r.sayi + ' kayıt' + (r.eklenen ? ' (' + r.eklenen + ' eklendi)' : ''));
  } else {
    const l = isaretliler(arg.length ? arg : undefined);
    l.forEach((x) => console.log(x.dosya + ':' + x.satir + ' [' + x.isaret.join(' ') + '] ' + x.metin.slice(0, 160)));
    console.log(l.length ? l.length + ' işaretli metin' : 'işaretli metin yok');
  }
}
