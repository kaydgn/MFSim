/**
 * mount-adams-isg.test.js — 6×6 ISG 430: ADAMS SUNUMUNUN ANALİZİ PROGRAMDA (2026-11-13)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı: *"PPTX belgesindeki analizi çözer misin?"* Sunumun girdisi ve sonucu
 * tests/fixtures/adams-isg430.js'te; model programın örneği (isg430askili), çözüm
 * Çözücü'nün YOLUNDAN (H.coz → _mntComputeResults: toplayıcı, birim, askı elemanı).
 *   · ADAMS = PROGRAM — beş kombinasyonun 30 statik sehimi ve 30 frekansı, örneğin ön yüksüz
 *     yayıyla: sehimde RMS 0,022 mm, frekansta RMS %0,17; TR'ler sunumun yuvarlamasında aynı.
 *     İki bulgu sayıyla: (1) Adams'ın sonuçları ön yüksüz bir yayınki — sunumun 918,4 N'u
 *     çözüme girmemiş (örnek Adams'ın çözdüğünü taşır); (2) Adams'ın "Left" takozları konum
 *     tablosunun +y'sinde (sehimin sol/sağı tabloya göre ayna).
 *   · PARAMETRİK ANALİZ = ADAMS — kullanıcı 2026-11-13: *"bu HTML raporu … senin RMS farklarını
 *     bulduğun değerler çıkmıyor"*. Örnek 918,4 N'u taşıyordu (K0'da sehim RMS 0,93 mm) ve ön
 *     grubun doğrusal Cone 38-40'ı kütüphanenin EĞRİLİ tipinin adını alıyordu (K0 4,76 mm, aynı
 *     adlı tarama satırı 5,05 mm). K0 = Çözücü = Adams; değerleri aynı yasası farklı takoz o tip
 *     değil, adı "· doğrusal".
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
global.veMntKatalog = require('../../js/mount-katalog.js');
const P = require('../../js/cp-mount-param.js');
Object.keys(P).forEach((k) => { if (global[k] === undefined) global[k] = P[k]; });
global.veMntParamExcel = require('../../js/mount-param-excel.js');
const PS = require('../../js/cp-mount-param-sonuc.js');
const PD = A.yay.onYuk / 9.81;   // sunumun ön yükü [kgf]: 918,4 N = 93,6 kgf (resmin ilk noktası 74 mm · 93,5 ± 8)

const KOMBI = Object.keys(A.kombinasyon);
// Örneğin topolojisi, takozlar kombinasyonun tipleriyle; P: askının tasarım konumundaki ön yükü [kgf]
function topo(kb, P) {
  const t = H.ornek('isg430askili');
  const K = A.kombinasyon[kb];
  t.nodes.filter((n) => n.type === 'mnt-mount').forEach((n, i) => {
    const tp = A.tip[i < 2 ? K.on : K.arka];
    Object.assign(n.data, { kxs: tp[0][0], kys: tp[0][1], kzs: tp[0][2], kxd: tp[1][0], kyd: tp[1][1], kzd: tp[1][2] });
  });
  if (P != null) t.nodes.filter((n) => n.type === 'mnt-aski').forEach((n) => { n.data.onyukF = P; });
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
    // Adams'ın çözdüğü gibi tasarım konumundaki ön yük 0; sunumun yazdığı ön yük (PD) yayın
    // resminin ilk noktası: 74 mm'de k(L0 − 74) = 93,6 kgf, resim 93,5 ± 8 kgf
    const ilk = global.veMntYay('tta-aski').noktalar.find((p) => p.ad === 'ilk');
    as.forEach((n) => {
      expect([n.data.kurulum, n.data.onyukF, n.data.yay]).toEqual(['onyuk', 0, 'tta-aski']);
      expect(n.data.k * (n.data.L0 - ilk.L) / 9.81).toBeCloseTo(PD, 1);
      expect(Math.abs(PD - ilk.F)).toBeLessThan(ilk.tol);
    });
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

describe('ADAMS = PROGRAM — örneğin ön yüksüz yayıyla beş kombinasyon', () => {
  const sonuc = {};
  beforeAll(() => { KOMBI.forEach((kb) => { sonuc[kb] = H.coz(topo(kb)); }); });
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

describe('PARAMETRİK ANALİZ = ADAMS — K0 Çözücü\'nün çözümü, mevcut tip yasasıyla', () => {
  let Hz, O;
  beforeAll(() => {
    const t = H.ornek('isg430askili');
    global.nodes = JSON.parse(JSON.stringify(t.nodes));
    global.connections = t.connections || [];
    Hz = P._mntParamHazirlik({ data: {} });
    O = P._mntParamOlcucu(Hz.M, global.veMntKatalog.baglam(Hz.ctx));
  });
  test('K0: Çözücü\'nün sehimi ve modları birebir; Adams\'tan sehim RMS < 0,03 mm, TR sunumun yuvarlamasında', () => {
    const R = H.coz(H.ornek('isg430askili')), k0 = O.tam(null).o, a = A.kombinasyon.F3840R3940;
    expect(k0.dz).toEqual(sehim(R).map((v) => expect.closeTo(v, 9)));
    expect(k0.f).toEqual(R.modes.map((m) => expect.closeTo(m.f_Hz, 9)));
    expect(rms(ayna(k0.dz).map((v, i) => v - a.d[i]))).toBeLessThan(0.03);
    expect(Math.abs(k0.T * 100 - a.TR)).toBeLessThan(0.1);
  });
  test('tarama: Cone 39-40 × 3 Adams\'ın C3940\'ı; eğrili Cone 38-40\'lı satır önde K0\'dan > 0,2 mm fazla çöker', () => {
    const c = O.tam(['amc137981', 'amc137981', 'amc137981']).o, a = A.kombinasyon.C3940;
    expect(rms(ayna(c.dz).map((v, i) => v - a.d[i]))).toBeLessThan(0.03);
    const k0 = O.tam(null).o, e = O.tam(['amc137961', 'amc137981', 'amc137981']).o;
    [0, 1].forEach((i) => expect(e.dz[i]).toBeLessThan(k0.dz[i] - 0.2));
  });
  test('değerleri aynı yasası farklı takoz o tip DEĞİL: ad "· doğrusal" · "· eğri", kısa adda da', () => {
    const [on, orta, arka] = Hz.M.G, lib = Hz.M.lib;
    expect([on.tip, on.benzer, orta.tip, arka.tip]).toEqual([null, 'amc137961', 'amc137981', 'amc137981']);
    expect(P._mntParamGrupTipAdi(Hz.M, on)).toBe(lib.amc137961.name + ' · doğrusal');
    expect(P._mntParamGrupTipAdi(Hz.M, orta)).toBe(lib.amc137981.name);
    const ks = PS._mntPrmKisaF({ M: Hz.M, D: { adaylar: Hz.aday } });
    expect(ks(P._mntParamGrupTipAdi(Hz.M, on))).toBe('Cone38-40 · doğrusal');
    const uye = (g) => global.nodes.filter((n) => g.idler.includes(n.id));
    uye(on).forEach((n) => cp._mntLibUygula(n.data, 'amc137961'));               // tip yasasıyla → o tip
    uye(orta).forEach((n) => { n.data.curveZ = [[0, 0], [2, 1500], [5, 4200]]; });  // tipte olmayan eğri
    const M2 = P._mntParamModel();
    expect([M2.G[0].tip, M2.G[0].benzer, M2.G[1].tip, M2.G[1].benzer]).toEqual(['amc137961', null, null, 'amc137981']);
    expect(P._mntParamGrupTipAdi(M2, M2.G[1])).toBe(lib.amc137981.name + ' · eğri');
    // iki tarafta da yasa, yasa başka (eğrinin kuvveti %10 fazla): o tip değil
    uye(on).forEach((n) => { ['fitZ', 'curveZ'].forEach((a) => { if (n.data[a]) n.data[a] = JSON.parse(JSON.stringify(n.data[a])); });
      if (n.data.curveZ) n.data.curveZ = n.data.curveZ.map((q) => [q[0], q[1] * 1.1]);
      else n.data.fitZ.k0 *= 1.1; });
    const M3 = P._mntParamModel();
    expect([M3.G[0].tip, M3.G[0].benzer, P._mntParamGrupTipAdi(M3, M3.G[0])]).toEqual([null, 'amc137961', lib.amc137961.name + ' · eğri']);
  });
});

describe('SUNUMUN ÖN YÜKÜ — 918,4 N tasarım konumunda', () => {
  test('modlar değişmez; yük öne kayar; yay statikte ~72 mm, Max Bump\'ta blok boyunda', () => {
    const R0 = H.coz(H.ornek('isg430askili')), R = H.coz(topo('F3840R3940', PD));
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
    const son = Object.fromEntries(KOMBI.map((kb) => [kb, Math.max(...H.coz(topo(kb)).modes.map((m) => m.f_Hz))]));
    expect(A.rolanti.fAtes / A.rolanti.guvenlik).toBeCloseTo(A.rolanti.sonModSinir, 1);
    expect(KOMBI.filter((kb) => son[kb] < A.rolanti.sonModSinir)).toEqual(['C3940', 'C3850', 'F3840R3940', 'F3840R3850']);
    expect(son.TK65).toBeCloseTo(25.62, 1);
  });
});
