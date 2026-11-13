/**
 * mount-adams-isg.test.js — 6×6 ISG 430: ADAMS SUNUMUNUN ANALİZİ PROGRAMDA (2026-11-13)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı: *"PPTX belgesindeki analizi çözer misin?"* Sunumun girdisi ve sonucu
 * tests/fixtures/adams-isg430.js'te; model programın örneği (isg430askili), çözüm
 * Çözücü'nün YOLUNDAN (H.coz → _mntComputeResults: toplayıcı, birim, askı elemanı).
 *   · ADAMS = PROGRAM — beş kombinasyonun 30 statik sehimi ve 30 frekansı, ön yüksüz yayla:
 *     sehimde RMS 0,022 mm, frekansta RMS %0,17; TR'ler sunumun yuvarlamasında aynı.
 *     İki bulgu sayıyla: (1) Adams'ın sonuçları ön yüksüz bir yayınki — sunumun 918,4 N'u
 *     çözüme girmemiş; (2) Adams'ın "Left" takozları konum tablosunun +y'sinde (sehimin
 *     sol/sağı tabloya göre ayna).
 *   · SUNUMUN ÖN YÜKÜ — 918,4 N tasarım konumunda: modlar ve TR değişmez (yay doğrusal),
 *     yük önden arkaya kayar; yay statikte 72 mm, Max Bump'ta blok boyunda.
 *   · SUNUMUN ÖLÇÜTÜ — son mod < 35/1,41 = 24,82 Hz: TK65 geçmiyor, öteki dördü geçiyor.
 * Bileşenlerin kütlesi sunumda yok: örneğin dağılımı (1.002 · 524,3 · 8,1 · 26,1 kg) bu
 * 60 sonuca uydurma — toplam sunumun 1.560,5 kg'ı.
 */
const H = require('../helpers/takoz-dogrulama.js');
const A = require('../fixtures/adams-isg430.js');
const { cp, rp } = H.kur();
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
Object.keys(rp).forEach((k) => { if (global[k] === undefined) global[k] = rp[k]; });
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
Object.assign(global, require('../../js/mount-yay.js'));
const core = require('../../js/mount-core.js');

const KOMBI = Object.keys(A.kombinasyon);
// Örneğin topolojisi, takozlar kombinasyonun tipleriyle; Ld: askının tasarım boyu [mm] (90 = ön yüksüz)
function topo(kb, Ld) {
  const t = H.ornek('isg430askili');
  const K = A.kombinasyon[kb];
  t.nodes.filter((n) => n.type === 'mnt-mount').forEach((n, i) => {
    const tp = A.tip[i < 2 ? K.on : K.arka];
    Object.assign(n.data, { kxs: tp[0][0], kys: tp[0][1], kzs: tp[0][2], kxd: tp[1][0], kyd: tp[1][1], kzd: tp[1][2] });
  });
  if (Ld != null) t.nodes.filter((n) => n.type === 'mnt-aski').forEach((n) => { n.data.tasarimL = Ld; });
  return t;
}
const statik = (R) => R.allCases.find((rc) => rc.name === 'Static').res;
const sehim = (R) => statik(R).perMount.map((m) => m.delta[2] * 1000);
// Adams'ın sırası FL FR ML MR RL RR; "Left" tablonun +y'si → programın Sağ takozu
const ayna = (d) => [d[1], d[0], d[3], d[2], d[5], d[4]];
const rms = (l) => Math.sqrt(l.reduce((s, v) => s + v * v, 0) / l.length);

describe('ÖRNEK — sunumun girdisi', () => {
  test('konumlar, yay noktası, ataletler, toplam kütle; takozlar sunumun en düşük TR\'li kombinasyonu', () => {
    const t = H.ornek('isg430askili');
    const tak = t.nodes.filter((n) => n.type === 'mnt-mount');
    expect(tak.map((n) => [n.data.x, n.data.y, n.data.z])).toEqual(A.takoz);
    const as = t.nodes.filter((n) => n.type === 'mnt-aski');
    expect(as.map((n) => [n.data.x, n.data.y, n.data.z])).toEqual(A.yay.ust);
    // ön yük tasarım konumunda: k(L0 − Ld) = 918,4 N (resmin yayı; k 57,39 ↔ sunum 57,4)
    as.forEach((n) => expect(n.data.k * (n.data.L0 - n.data.tasarimL)).toBeCloseTo(A.yay.onYuk, -1));
    const gv = t.nodes.filter((n) => n.data && n.data.mass > 0);
    expect(gv.reduce((s, n) => s + n.data.mass, 0)).toBeCloseTo(A.toplamKutle, 6);
    expect(gv.find((n) => n.type === 'mnt-motor').data).toMatchObject({ Ixx: 47.5, Iyy: 133, Izz: 114, idleRpm: A.rolanti.devir, cylinders: A.rolanti.silindir });
    const K = A.kombinasyon.F3840R3940;
    tak.forEach((n, i) => {
      const tp = A.tip[i < 2 ? K.on : K.arka];
      expect([n.data.kxs, n.data.kys, n.data.kzs, n.data.kxd, n.data.kyd, n.data.kzd]).toEqual(tp[0].concat(tp[1]));
    });
    // iki kopya aynı: çekirdeğin örneği ile topoloji
    const M = core.getMountExample('isg430askili').model;
    expect(M.mounts.map((m) => [m.name, m.pos])).toEqual(tak.map((n) => [n.customName, [n.data.x, n.data.y, n.data.z]]));
    expect(M.askilar.map((a) => [a.name, a.pos, a.tasarimL])).toEqual(as.map((n) => [n.customName, [n.data.x, n.data.y, n.data.z], n.data.tasarimL]));
  });
});

describe('ADAMS = PROGRAM — ön yüksüz yayla beş kombinasyon', () => {
  const sonuc = {};
  beforeAll(() => { KOMBI.forEach((kb) => { sonuc[kb] = H.coz(topo(kb, 90)); }); });
  test('sehim: 30 değerde RMS < 0,03 mm (ayna eşlemesiyle); eşlemesiz sol/sağ farkı ters', () => {
    const fark = [], tersFark = [];
    KOMBI.forEach((kb) => {
      const d = sehim(sonuc[kb]), a = A.kombinasyon[kb].d;
      ayna(d).forEach((v, i) => fark.push(v - a[i]));
      d.forEach((v, i) => tersFark.push(v - a[i]));
    });
    expect(rms(fark)).toBeLessThan(0.03);
    expect(Math.max(...fark.map(Math.abs))).toBeLessThan(0.05);
    expect(rms(tersFark)).toBeGreaterThan(0.3);                  // tablo olduğu gibi eşlenirse
  });
  test('frekans: 30 değerde RMS < %0,25, en çok %0,5', () => {
    const fark = [];
    KOMBI.forEach((kb) => {
      const f = sonuc[kb].modes.map((m) => m.f_Hz), a = A.kombinasyon[kb].f;
      f.forEach((v, i) => fark.push((v - a[i]) / a[i]));
    });
    expect(rms(fark)).toBeLessThan(0.0025);
    expect(Math.max(...fark.map(Math.abs))).toBeLessThan(0.005);
  });
  // Adams'ın TR'si düşey (bounce) SDOF'un sönümsüz iletilebilirliği, askının z rijitliği dâhil —
  // programın _mntRepIsolation'ı; fark sunumun tek ondalığından (TK65: 8,44 ↔ 8,5)
  test('TR: rölantide düşey iletilebilirlik sunumunkinden en çok 0,07 puan farklı', () => {
    KOMBI.forEach((kb) => {
      const iso = rp._mntRepIsolation(sonuc[kb], {});
      expect([kb, iso.fFire]).toEqual([kb, A.rolanti.fAtes]);
      expect([kb, Math.abs(iso.T0 * 100 - A.kombinasyon[kb].TR) < 0.07]).toEqual([kb, true]);
    });
  });
  test('askılar ön yüksüz: statik kuvvet 23–42 kgf, yay 82–87 mm (sunumun 918,4 N\'u ≈ 93,6 kgf)', () => {
    KOMBI.forEach((kb) => statik(sonuc[kb]).perHanger.forEach((p) => {
      expect(p.F / 9.81).toBeGreaterThan(22); expect(p.F / 9.81).toBeLessThan(42);
      expect(p.L * 1000).toBeGreaterThan(82); expect(p.L * 1000).toBeLessThan(87);
    }));
  });
});

describe('SUNUMUN ÖN YÜKÜ — 918,4 N tasarım konumunda', () => {
  test('modlar değişmez; yük öne kayar; yay statikte ~72 mm, Max Bump\'ta blok boyunda', () => {
    const R0 = H.coz(topo('F3840R3940', 90)), R = H.coz(H.ornek('isg430askili'));
    expect(R.modes.map((m) => m.f_Hz)).toEqual(R0.modes.map((m) => m.f_Hz).map((f) => expect.closeTo(f, 9)));
    const d0 = sehim(R0), d = sehim(R);
    [0, 1].forEach((i) => expect(d[i]).toBeLessThan(d0[i] - 0.9));          // ön takozlar ~1 mm daha çöker
    [2, 3, 4, 5].forEach((i) => expect(d[i]).toBeGreaterThan(d0[i] + 0.7));  // orta ve arka rahatlar
    statik(R).perHanger.forEach((p) => { expect(p.F / 9.81).toBeCloseTo(105.6, -1); expect(p.L * 1000).toBeCloseTo(71.9, 0); });
    const blok = R.allCases.filter((rc) => (rc.res.perHanger || []).some((p) => p.durum === 'blok')).map((rc) => rc.name);
    expect(blok).toEqual(['Max Bump']);
  });
});

describe('SUNUMUN ÖLÇÜTÜ — son mod < 24,82 Hz', () => {
  test('TK65 geçmiyor (25,6 Hz); öteki dört kombinasyon geçiyor', () => {
    const son = Object.fromEntries(KOMBI.map((kb) => [kb, Math.max(...H.coz(topo(kb, 90)).modes.map((m) => m.f_Hz))]));
    expect(A.rolanti.fAtes / A.rolanti.guvenlik).toBeCloseTo(A.rolanti.sonModSinir, 1);
    expect(KOMBI.filter((kb) => son[kb] < A.rolanti.sonModSinir)).toEqual(['C3940', 'C3850', 'F3840R3940', 'F3840R3850']);
    expect(son.TK65).toBeCloseTo(25.62, 1);
  });
});
