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

const ORNEKLER = ['tulga', 'siper', 'asfat', 'tta10', 'tta10askili', 'kutu', 'hafif', 'kamyon'];   // son üçü kurgu (mount-ornek-kurgu.test.js)
const oku = (ad) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/' + ad + '_topoloji.json'), 'utf8'));
const ARAC = cp.VE_MNT_ARAC_TIPLERI;     // Takoz Özellikleri · 3D · Görünümler · Çözücü · Başlangıç Sihirbazı · Rapor
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

  test.each(ORNEKLER)('%s: gruplama çerçevesi kartlarını en az 8 px payla sarar', (ad) => {
    const j = oku(ad);
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

// Kullanıcı kararı S5·B (2026-10-15): çerçeveler YALNIZ ASFAT'taydı. Üç örnek
// AYNI düzeni taşır: Araçlar (Takoz Özellikleri · Çözücü · Başlangıç Sihirbazı · Rapor) ve
// Görselleştirici (Görünümler · 3D; Koordinat Düzlemi Canlı Not 63'te kalktı), ikisi
// de tek sıra. Tek sıra bir seçim
// değil ölçü: en uzun ad ("Başlangıç Sihirbazı" ≈ 112 px; kalkan "Başlangıç ve Örnekler" 123 px
// idi) 105 px adımda yan yana gelen komşusunun adına yaklaşır.
describe('üç örnekte iki çerçeve: Araçlar ve Görselleştirici (S5·B)', () => {
  const GORSEL = ['mnt-2dview', 'mnt-viewer'];
  const icinde = (n, f) => n.x >= f.x && n.x + n.width <= f.x + f.width && n.y >= f.y && n.y + n.height <= f.y + f.height;
  const kesisir = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  test.each(ORNEKLER)('%s: adlar, renkler ve üyeler', (ad) => {
    const j = oku(ad);
    const cer = (j.annotations || []).filter((a) => a.type === 'frame');
    const bul = (t) => cer.find((f) => f.text === t);
    const arac = bul('Araçlar'), gor = bul('Görselleştirici');
    expect(arac && arac.color).toBe('var(--accent-primary)');
    expect(gor && gor.color).toBe('var(--text-muted)');
    const uye = (f) => j.nodes.filter((n) => icinde(n, f)).map((n) => n.type).sort();
    expect(uye(gor)).toEqual(GORSEL.slice().sort());
    expect(uye(arac)).toEqual(j.nodes.filter((n) => ARAC.includes(n.type) && !GORSEL.includes(n.type)).map((n) => n.type).sort());
    expect(uye(arac)).toContain('mnt-wizard');
    expect(kesisir(arac, gor)).toBe(false);
    // gövde ve takozlar çerçevenin dışında
    j.nodes.filter((n) => !ARAC.includes(n.type)).forEach((n) => {
      expect(`${n.type} ${n.id}: ${kesisir(n, arac) || kesisir(n, gor)}`).toBe(`${n.type} ${n.id}: false`);
    });
  });
  test.each(ORNEKLER)('%s: Başlangıç Sihirbazı kartı örnekte tek ve veri taşımaz; Başlangıç ve Örnekler kartı yok', (ad) => {
    const j = oku(ad);
    const sih = j.nodes.filter((n) => n.type === 'mnt-wizard');
    expect(sih.length).toBe(1);
    expect(sih[0].data).toEqual({});
    expect(j.nodes.some((n) => n.type === 'mnt-example')).toBe(false);
  });
  test('üç örnekte Görselleştirici aynı ölçüde; Araçlar sütun sayısıyla', () => {
    const olc = ORNEKLER.map((ad) => {
      const cer = oku(ad).annotations.filter((a) => a.type === 'frame');
      const g = cer.find((f) => f.text === 'Görselleştirici'), a = cer.find((f) => f.text === 'Araçlar');
      return [g.width, g.height, a.height, a.x - g.x, (a.width - 120) % 105];
    });
    olc.forEach((o) => expect(o).toEqual([225, 130, 134, 0, 0]));
  });
});
