/**
 * teori-sablon.js — rapor teori şablonlarının düz metni (ARAYÜZ ANLATMAZ)
 * ───────────────────────────────────────────────────────────────────────
 * İki raporun teori kısmı js/*-report-template.js'e TABAN64 gömülü; cırcır
 * (tools/metin-dili.js) onu göremiyor. FEAD ve Takoz rapor kapıları şablonu
 * buradan çözer ve AYNI ölçütle tarar.
 *
 * Belgede yöntem, varsayım, kaynak, kabul ölçütü ve geçerlilik sınırı kalır;
 * yazılımın davranışı, geliştirme geçmişi, test ölçümü ve okuyucuya iş girmez.
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '../..');

// dosya: 'js/fead-report-template.js' · ad: 'FEAD_REPORT_TEMPLATE_B64'
function sablon(dosya, ad) {
  const src = fs.readFileSync(path.join(KOK, dosya), 'utf8');
  const m = new RegExp('window\\.' + ad + ' = "([^"]+)"').exec(src);
  if (!m) throw new Error(dosya + ': ' + ad + ' bulunamadı');
  return Buffer.from(m[1], 'base64').toString('utf8');
}

// kodsuz: Ek A'nın <pre> bloğu da atılır (büyük harf taraması kod adlarını saymasın)
function duzMetin(h, kodsuz) {
  return h.replace(kodsuz ? /<(script|style|svg|pre)\b[\s\S]*?<\/\1>/g : /<(script|style|svg)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');
}

const TEORI_YASAK = /(?<![\p{L}-])(program\p{L}*|ölçüldü|ölçülmüştür|kapı\p{L}*|seçici\p{L}*|okuyucu\p{L}*|okunmalı\p{L}*|otomatik üretil\p{L}*|iç topoloji\p{L}*|köprü\p{L}*|MFSim|UMD|panelde|kanvas\p{L}*|sorulmaz|bir dönem|bir zamanlar|karıştırılmamalı\p{L}*|kullanıcı\p{L}*)(?![\p{L}])/iu;

function yasakBulgulari(h) {
  const t = duzMetin(h, false);
  return [...t.matchAll(new RegExp(TEORI_YASAK.source, 'giu'))]
    .map((m) => m[1] + ' ← ' + t.slice(Math.max(0, m.index - 50), m.index + 50));
}

function buyukHarfBulgulari(h, adlar) {
  const AD = new Set(adlar || []);
  return [...duzMetin(h, true).matchAll(/(?<![\p{L}\p{N}_@])([A-ZÇĞİÖŞÜ]{4,})(?![\p{L}\p{N}_@])/gu)]
    .map((m) => m[1]).filter((w) => !AD.has(w));
}

module.exports = { sablon, duzMetin, TEORI_YASAK, yasakBulgulari, buyukHarfBulgulari };
