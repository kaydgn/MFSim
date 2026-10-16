/**
 * bildirim-olcu.js — bir kaynak dosyadaki BİLGİ bildirimlerinin metni.
 * ───────────────────────────────────────────────────────────────────────
 * ARAYÜZ ANLATMAZ kapılarının (kabuk-metin, fead-metin) ortak ölçüsü:
 * `showToast(…)` çağrısının ikinci argümanı 'warning' / 'error' değilse ilk
 * argümanın olası metinleri. `+` zinciri birleşir, koşulun iki kolu ayrı
 * sayılır, değişken parça ‹› olur ("Proje yüklendi: ‹› sekme").
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const KOK = path.join(__dirname, '../..');

function metinleri(x) {
  if (!x) return ['‹›'];
  if (x.type === 'StringLiteral') return [x.value];
  if (x.type === 'TemplateLiteral') return [x.quasis.map((q) => q.value.cooked).join('‹›')];
  if (x.type === 'BinaryExpression' && x.operator === '+') {
    const out = [];
    metinleri(x.left).forEach((a) => metinleri(x.right).forEach((b) => out.push(a + b)));
    return out.map((m) => m.replace(/(‹›)+/g, '‹›'));
  }
  if (x.type === 'ConditionalExpression') return metinleri(x.consequent).concat(metinleri(x.alternate));
  if (x.type === 'LogicalExpression') return metinleri(x.left).concat(metinleri(x.right));
  return ['‹›'];
}

// dosya → [{ satir, metin }]. `yerel`: showToast'u sarmalayan dosya içi ad
// (radio.js → toast).
function bilgiBildirimleri(dosya, yerel) {
  const ast = parser.parse(fs.readFileSync(path.join(KOK, dosya), 'utf8'), { sourceType: 'script', errorRecovery: true });
  const out = [];
  (function yuru(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression') {
      const c = n.callee;
      const ad = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && c.property ? c.property.name : '');
      if ((ad === 'showToast' || (yerel && ad === yerel)) && n.arguments.length) {
        const tur = n.arguments[1];
        const uyari = tur && tur.type === 'StringLiteral' && /^(warning|error)$/.test(tur.value);
        if (!uyari) {
          metinleri(n.arguments[0]).filter((m) => /\p{L}/u.test(m))
            .forEach((m) => out.push({ satir: n.loc.start.line, metin: m }));
        }
      }
    }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (k === 'loc') continue;
      if (Array.isArray(v)) v.forEach(yuru); else if (v && typeof v.type === 'string') yuru(v);
    }
  })(ast.program);
  return out;
}

module.exports = { metinleri, bilgiBildirimleri };
