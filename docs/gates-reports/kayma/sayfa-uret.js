// Kaymama koşulu analiz sayfasını üretir: sayfa-veri.json → fead-kaymama-kosulu.html
const fs = require('fs');
const G = process.argv[2];
const OUT = process.argv[3];
const D = JSON.parse(fs.readFileSync(G + '/sayfa-veri.json', 'utf8'));

const RAPOR_AD = {
  AG00686_8PK1475HD: 'AG00686-1475', AG00686_8PK1520HD: 'AG00686-1520', AG00810_10PK1215HD: 'AG00810',
  AG00879_8PK1392HD: 'AG00879', AG00894_8PK1738HD: 'AG00894', AG00902_8PK1275HD: 'AG00902-1275',
  AG00902_8PK1300HD: 'AG00902-1300', AG00976_8PK1715HD: 'AG00976', AG0868_4PK1013HD: 'AG0868-4PK',
  AG0868_6PK1018HD: 'AG0868-6PK', AG0868_8PK1020HD: 'AG0868-8PK',
};
// Kuşkulu veri: özet sayılarına girmez, tabloda ve grafikte işaretli durur.
function bayrak(rapor, k) {
  if (/^AG00902/.test(rapor) && /^(CRK|A_C|TEN)$/.test(k)) return 'Gates grafiği kendi ortalama gerginlik tablosuyla tek μ ile tutmuyor';
  if (rapor === 'AG00894_8PK1738HD' && /^(TM31|SD7H15|IDR1|IDR2)$/.test(k)) return 'aynı renkte iki eğri — eşleştirme belirsiz';
  if (rapor === 'AG00976_8PK1715HD' && /^(IDR1|IDR2|TEN)$/.test(k)) return 'Gates sayfası alıntıda yok — atalet örnekten';
  if (/^AG00686/.test(rapor) && k === 'TEN') return 'kasnağa kolun ataleti (0,0076 kg·m²) girilmiş';
  if (rapor === 'AG00879_8PK1392HD' && k === 'IDR') return 'talep çok küçük (J 0,0001) — sürtünme varsayımına duyarlı';
  return null;
}
const trS = (x, d) => (x == null || !isFinite(x)) ? '—' : x.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sfYaz = (x) => (x == null || !isFinite(x)) ? '—' : trS(x, x < 10 ? 2 : x < 100 ? 1 : 0);

// ── özet istatistikleri ─────────────────────────────────────────────────────
const muL = D.muListe.map((m) => ({ ...m, bayrak: bayrak(m.rapor, m.kasnak), ad: RAPOR_AD[m.rapor] }));
const temiz = (f) => muL.filter((m) => !m.bayrak && m.mu != null && f(m)).map((m) => m.mu).sort((a, b) => a - b);
const ist = (v) => ({ n: v.length, min: v[0], max: v[v.length - 1], med: v[Math.floor(v.length / 2)] });
const muOluk = ist(temiz((m) => m.temas === 'grooved' && m.rol !== 'alternator'));
const muAlt = ist(temiz((m) => m.rol === 'alternator'));
const muSirt = ist(temiz((m) => m.temas === 'back'));

const tab = D.tablo.map((t) => ({ ...t, bayrak: bayrak(t.rapor, t.kasnak), ad: RAPOR_AD[t.rapor] }));
const temizTab = tab.filter((t) => !t.bayrak);
const oranYeni = temizTab.map((t) => t.yeni / t.gates);
const icinde = (f) => temizTab.filter((t) => Math.abs(t.yeni / t.gates - 1) <= f).length;
const altSatir = temizTab.filter((t) => t.kasnak === 'ALT');
const yukluBugun = tab.filter((t) => t.yuklu && t.bugun != null && t.kasnak !== 'IDR' && !t.bayrak).map((t) => t.bugun / t.gates).sort((a, b) => a - b);
const bosBugun = tab.filter((t) => !t.yuklu && t.bugun != null).map((t) => t.bugun).sort((a, b) => a - b);
const bosGates = tab.filter((t) => !t.yuklu).map((t) => t.gates).sort((a, b) => a - b);
const S = {
  rapor: D.rapor, kasnak: tab.length, nokta: D.nokta,
  muOluk, muAlt, muSirt,
  icinde10: icinde(0.10), icinde15: icinde(0.15), temiz: temizTab.length,
  altKat: altSatir.map((t) => t.yeni / t.gates),
  yukluBugun: [yukluBugun[0], yukluBugun[yukluBugun.length - 1]],
  bosBugun: [bosBugun[0], bosBugun[bosBugun.length - 1]], bosGates: [bosGates[0], bosGates[bosGates.length - 1]],
};
const ara = (a, b, d) => trS(a, d) + '–' + trS(b, d);
S.f = {
  bosBugun: ara(S.bosBugun[0], S.bosBugun[1], 2),
  bosGates: trS(S.bosGates[0], 1) + '–' + trS(S.bosGates[1], 0),
  muOluk: ara(muOluk.min, muOluk.max, 3), muSirt: ara(muSirt.min, muSirt.max, 3), muAlt: ara(muAlt.min, muAlt.max, 3),
  altKat: '×' + trS(Math.min(...S.altKat), 2) + '–×' + trS(Math.max(...S.altKat), 2),
  muG: trS(D.mu.g, 2), muB: trS(D.mu.b, 2),
};
fs.writeFileSync(G + '/sayfa-ozet.json', JSON.stringify(S, null, 1));

const VERI = {
  mu: muL.map((m) => ({ a: m.ad, k: m.kasnak, rol: m.rol, t: m.temas, s: m.sarim, d: m.cap, J: m.J, mu: m.mu, b: m.bayrak })),
  tablo: tab.map((t) => ({ a: t.ad, k: t.kasnak, t: t.temas, s: t.sarim, y: t.yuklu, g: t.gates, n: t.bugun, r: t.yeni, b: t.bayrak })),
  grafik: D.grafikler.map((g) => ({ a: RAPOR_AD[g.rapor], x: g.izgara, k: g.kasnaklar.map((k) => ({
    k: k.kasnak, t: k.temas, g: k.gates, r: k.yeni, n: k.bugun,
    s: (D.tablo.find((t) => t.rapor === g.rapor && t.kasnak === k.kasnak) || {}).sarim })) })),
};

const tanim = D.tanim;
const html = fs.readFileSync(G + '/sayfa-sablon.html', 'utf8')
  .replace('/*@@VERI@@*/null', JSON.stringify(VERI))
  .replace(/@@([A-Za-z0-9_.]+)@@/g, (_, yol) => {
    const deger = yol.split('.').reduce((o, k) => (o == null ? o : o[k]), { S, T: tanim, V: D.dogrulama });
    if (typeof deger === 'number') {
      if (/kat$/.test(yol)) return trS(deger, 2);
      if (/\.(n|nokta|rapor|kasnak|icinde10|icinde15|temiz)$/.test(yol)) return trS(deger, 0);
      if (/^V\./.test(yol)) return trS(deger, Number.isInteger(deger) ? 0 : 1);
      return trS(deger, 3).replace(/0$/, '');
    }
    return String(deger);
  });
fs.writeFileSync(OUT, html);
console.log(JSON.stringify(S, null, 1));
