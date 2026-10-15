/**
 * mount-ornek-yerlesim.test.js — TAKOZ ÖRNEKLERİNİN ARAÇ KARTLARI DÜZENLİ
 * ─────────────────────────────────────────────────────────────────────────
 * Tur 6 (2026-10-15) ölçümü: üç örnek topolojide (assets/examples/*_topoloji.json)
 * analiz araçlarının kartları elle konmuştu ve dağınıktı — Tulga'da aynı
 * sıradaki üst kenarlar 160,4 · 163,6 · 163,7 (merkezler 190,4–191,7), alt
 * sırada aralar 43,7 · 52,8 px ve sıranın solu üsttekinden 25,7 px kayık;
 * Siper'in 2D Görünüm'ü elle büyütülmüş (63,24×57,69).
 * Kural: kart TİPİN ölçüsünde (`veNodeDefaultSize` — tiplerin boyu farklı:
 * 54 · 56 · 60), aynı sıradakiler aynı merkez yüksekliğinde,
 * sütunlar tek adımlı ızgarada; gruplama çerçevesi kartlarını payla sarar.
 * Adların birbirine değmemesi (ASFAT: −6 px) tarayıcıda ölçülür:
 * tests/e2e/helpers/yuzey-turu.js → üç örneğin topolojisi.
 */
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
eval(loadSource('components.js'));
const cp = require('../../js/cp-mount.js');
beforeEach(() => resetStubs(stubs));

const ORNEKLER = ['tulga', 'siper', 'asfat'];
const oku = (ad) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/' + ad + '_topoloji.json'), 'utf8'));
const ARAC = cp.VE_MNT_ARAC_TIPLERI.concat(['mnt-example']);
const yakin = (a, b, t = 0.5) => Math.abs(a - b) <= t;

describe('araç kartları: tipin ölçüsü, sıra ve sütun', () => {
  test.each(ORNEKLER)('%s: kart ölçüsü tipin varsayılanı (veNodeDefaultSize)', (ad) => {
    const yanlis = oku(ad).nodes.filter((n) => ARAC.includes(n.type)).filter((n) => {
      const d = veNodeDefaultSize(n.type);
      return n.width !== d.w || n.height !== d.h;
    }).map((n) => n.type + ' ' + n.width + '×' + n.height);
    expect(yanlis).toEqual([]);
  });

  test.each(ORNEKLER)('%s: aynı sıradaki kartlar aynı merkez yüksekliğinde, sütunlar tek adımda', (ad) => {
    const k = oku(ad).nodes.filter((n) => ARAC.includes(n.type)).map((n) => ({ t: n.type, cx: n.x + n.width / 2, cy: n.y + n.height / 2 }));
    expect(k.length).toBeGreaterThanOrEqual(5);
    // sıralar: merkez yüksekliği 40 px'ten yakın olanlar aynı sırada sayılır
    const sira = [];
    k.slice().sort((a, b) => a.cy - b.cy).forEach((c) => {
      const s = sira.find((r) => Math.abs(r[0].cy - c.cy) < 40);
      if (s) s.push(c); else sira.push([c]);
    });
    sira.forEach((r) => r.forEach((c) => expect(`${c.t} cy ${c.cy}`).toBe(`${c.t} cy ${r[0].cy}`)));
    // sütunlar: bütün merkezler tek bir adımın katlarında
    const xs = [...new Set(k.map((c) => Math.round(c.cx * 10) / 10))].sort((a, b) => a - b);
    const adim = xs.slice(1).map((x, i) => x - xs[i]);
    const p = Math.min(...adim);
    adim.forEach((d) => expect(yakin(d / p, Math.round(d / p), 0.01)).toBe(true));
  });

  test('gruplama çerçevesi kartlarını en az 8 px payla sarar (ASFAT)', () => {
    const j = oku('asfat');
    const kartlar = j.nodes.filter((n) => ARAC.includes(n.type));
    const cer = (j.annotations || []).filter((a) => a.type === 'frame');
    expect(cer.length).toBe(2);
    kartlar.forEach((n) => {
      const ic = cer.filter((f) => n.x >= f.x && n.x + n.width <= f.x + f.width && n.y >= f.y && n.y + n.height <= f.y + f.height);
      expect(`${n.type}: ${ic.length}`).toBe(`${n.type}: 1`);
      const f = ic[0];
      const pay = Math.min(n.x - f.x, f.x + f.width - n.x - n.width, n.y - f.y);
      expect(pay).toBeGreaterThanOrEqual(8);
    });
  });
});
