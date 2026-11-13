/**
 * mount-aski-secim.test.js — ASKILI 10 TON TTA: TAKOZ SEÇİMİ (2026-11-13)
 * ─────────────────────────────────────────────────────────────────────────
 * Askılı föy takoz TİPİ vermiyor; soru "bu sisteme hangi takozlar uygun" (kullanıcı
 * 2026-11-13). Örneğin tipleri ve ön yükü Parametrik Analiz'in motorundan (üç grup ×
 * 23 aday tip = 12.167 kombinasyon, askı dâhil); seçimin dayanakları burada:
 *   · SEÇİLEN — ön çift TK040 (yasasıyla), arka dört AMC Cone 38 60 ShA (137963), yay
 *     başına 80 kgf: dört kesin kriter anma rijitlikte; ±%15 rijitlik köşelerinde
 *     Kriter 1 · 1b · 2 tutuyor, yalnız 5. ile 6. modun aralığı 0,28 Hz'e iniyor.
 *   · ÖN YÜK — föyün 50 kgf'ı bu takozlarla yetmiyor: en çok torkta yay açılıyor
 *     (uygunluğun askı satırı); 80 kgf'ta uygunluğun bütün satırları uygun ve bağlantı
 *     yüzünün momenti Cummins bandında (0 ≤ M_b ≤ 0,2·sınır).
 *   · YER TUTUCU — önceki örneğin ASFAT takozları Kriter 1b'yi (mod 8–10 Hz'te) ve 2'yi
 *     (TR ≥ %15) sağlamıyordu.
 */
const H = require('../helpers/takoz-dogrulama.js');
const { cp, rp } = H.kur();
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
Object.keys(rp).forEach((k) => { if (global[k] === undefined) global[k] = rp[k]; });
global.veMntKatalog = require('../../js/mount-katalog.js');
const P = require('../../js/cp-mount-param.js');
Object.keys(P).forEach((k) => { if (global[k] === undefined) global[k] = P[k]; });
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
Object.assign(global, require('../../js/mount-yay.js'));
const K = global.veMntKatalog;

const SECILEN = ['TK040', 'amc137963', 'amc137963'];
const ASFAT = ['asfat-b', 'asfat-a', 'asfat-a'];

// Örneğin topolojisi, tipler ve yay başına ön yük [kgf] uygulanmış
function topo(tipler, F) {
  const t = JSON.parse(JSON.stringify(H.ornek('tta10askili')));
  global.nodes = t.nodes;
  global.connections = [];
  const M = P._mntParamModel();
  if (tipler) M.G.forEach((g, gi) => g.idler.forEach((id) => { cp._mntLibUygula(t.nodes.find((n) => n.id === id).data, tipler[gi]); }));
  t.nodes.filter((n) => n.type === 'mnt-aski').forEach((n) => { n.data.montajF = F; });
  return t;
}
const uygunluk = (R) => rp.veMntUygunluk(R, {}).satirlar.map((s) => s.no + ':' + s.st);
const mb = (R) => R.baglanti.satirlar.find((r) => r.name === 'Static').egilme;

describe('SEÇİLEN — ön çift TK040, arka dört AMC 137963, 2 × 80 kgf', () => {
  test('örnek bu konfigürasyon: üç grup, tipler kütüphanenin girdileriyle 6/6 aynı', () => {
    const t = topo(null, 80);
    const M = P._mntParamModel(t.nodes);
    expect(M.G.map((g) => g.uyeler.length)).toEqual([2, 2, 2]);
    expect(M.G.map((g) => M.tak[g.uyeler[0]].libKey)).toEqual(SECILEN);
  });
  test('dört kesin kriter anma rijitlikte; ±%15 köşelerde 1 · 1b · 2 tutuyor, 5–6. modların aralığı 0,28 Hz', () => {
    topo(SECILEN, 80);
    const Hz = P._mntParamHazirlik({ id: 'pa', type: 'mnt-parametric', data: {} });
    const anma = K.baglam(Hz.ctx), O = P._mntParamOlcucu(Hz.M, anma);
    const h = K.hepsi(O.olc1(SECILEN), null, anma).sonuc;
    expect(['k1', 'k1a', 'k1b', 'k2'].map((k) => h[k].ok)).toEqual([true, true, true, true]);
    const tol = K.baglam(Object.assign({}, Hz.ctx, { acik: Object.assign({}, Hz.ctx.acik, { tolerans: true }), s: { tolerans: 0.15 } }));
    const o = P._mntParamOlcucu(Hz.M, tol).olc1(SECILEN), ht = K.hepsi(o, null, tol).sonuc;
    expect(['k1', 'k1b', 'k2'].map((k) => ht[k].ok)).toEqual([true, true, true]);
    expect(ht.k1a.ok).toBe(false);
    expect(ht.k1a.deger).toBeCloseTo(0.28, 2);
    expect(Math.max(...o.sert.f)).toBeLessThan(20);
    expect(o.sert.f.concat(o.yumusak.f).filter((f) => f >= 8 && f <= 10)).toEqual([]);
  });
  test('uygunluğun bütün satırları uygun; bağlantı yüzünün momenti Cummins bandında', () => {
    const R = H.coz(topo(SECILEN, 80));
    expect(uygunluk(R)).toEqual(['1:ok', '1a:ok', '1b:ok', '2:ok', '3:ok', '4:ok', '5:ok', '6:ok']);
    expect(mb(R)).toBeGreaterThan(0);
    expect(mb(R)).toBeLessThan(0.2 * 1350);
  });
});

describe('ÖN YÜK — föyün 50 kgf\'ı bu takozlarla yetmiyor', () => {
  test('50 kgf: en çok torkta yay serbest boyu aşıyor (açık), askı satırı uygun değil', () => {
    const R = H.coz(topo(SECILEN, 50));
    expect(uygunluk(R)).toContain('6:no');
    const acik = R.allCases.filter((rc) => rc.res.perHanger.some((p) => p.durum === 'acik')).map((rc) => rc.name);
    expect(acik).toEqual(expect.arrayContaining(['Forward Torque', 'Reverse Torque']));
  });
});

describe('YER TUTUCU — önceki örneğin ASFAT takozları', () => {
  test('Kriter 1b (mod 8–10 Hz bandında) ve 2 (TR ≥ %15) uygun değil', () => {
    const R = H.coz(topo(ASFAT, 50));
    const u = uygunluk(R);
    expect(u).toContain('1b:no');
    expect(u).toContain('2:no');
    expect(R.modes.some((m) => m.f_Hz >= 8 && m.f_Hz <= 10)).toBe(true);
  });
});
