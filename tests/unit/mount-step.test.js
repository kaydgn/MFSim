/**
 * mount-step.test.js — TAKOZ: STEP'TEN GÖVDE VE TAKOZ (js/mount-step.js)
 *
 * Kullanıcı isteği (2026-10-14): Takoz'a "STEP dosyadan başlama" — FEAD'in
 * "STEP'ten başla" kapısının aynısı. Okuyucu anlam yüklemez, rolü kullanıcı
 * verir; ölçülen şey geometri.
 *
 * Kapıların sorduğu şey (sessiz hata sınıfı — sayı yanlış çıkar, sihirbaz yine dolar):
 *   · hacim merkezi ve atalet ANALİTİK cevabı bilinen katılarda tutuyor mu
 *     (kutu birebir, silindir kiriş payı kadar);
 *   · çarpım ataletinin İŞARETİ çekirdeğin kuralı mı (tensör bileşeni,
 *     Ixy = −∫xy dm — döndürülmüş kutuyla);
 *   · rol bir ALT MONTAJA verilince parçaları tek birimde toplanıyor mu;
 *   · kütle yoksa atalet YAZILMIYOR mu (uydurulmuş yoğunluk yok);
 *   · kapalı olmayan ağda hacim yerine kutunun merkezi + uyarı.
 * Montaj tests/helpers/step-takoz.js'ten — gerçek CATIA dosyasının kalıbı.
 */
const S = require('../helpers/step-takoz.js');
const Y = require('../helpers/step-yaz.js');
const M = require('../../js/mount-step.js');

const oku = (metin) => {
  const son = M.veMntStpOku(metin);
  expect(son.ok).toBe(true);
  return son;
};
const dugumAd = (son, ad) => son.agac.filter((d) => d.ad === ad)[0];
const roller = (son, tablo) => {
  const r = son.agac.map(() => null);
  Object.keys(tablo).forEach((ad) => { r[dugumAd(son, ad).i] = tablo[ad]; });
  return r;
};
const yakin = (a, b, bagil) => expect(Math.abs(a - b) / Math.max(Math.abs(b), 1e-9)).toBeLessThan(bagil);

describe('GÜÇ GRUBU — analitik cevaplı katılar', () => {
  const son = oku(S.gucGrubu());
  const R = roller(son, {
    'Motor bloğu': 'mnt-motor', 'Şanzıman gövdesi': 'mnt-gearbox', 'Arka braket': 'mnt-bracket',
    'Sağ ön takoz': 'mnt-mount', 'Sol ön takoz': 'mnt-mount', 'Sağ arka takoz': 'mnt-mount', 'Sol arka takoz': 'mnt-mount'
  });
  const coz = M.veMntStpCoz(son, R);
  const birim = (ad) => coz.birimler.filter((b) => b.ad === ad)[0];

  test('ağaç: kök + 7 düğüm + alt montajın iki parçası; 8 parça', () => {
    expect(son.parcalar).toHaveLength(8);
    expect(dugumAd(son, 'Braket üst').ebeveyn).toBe(dugumAd(son, 'Arka braket').i);
  });

  test('yalnız ROLLÜ düğümler birim olur, her biri kapalı katı', () => {
    expect(coz.ok).toBe(true);
    expect(coz.hatalar).toEqual([]);
    expect(coz.birimler.map((b) => b.ad).sort()).toEqual(['Arka braket', 'Motor bloğu', 'Sağ arka takoz',
      'Sağ ön takoz', 'Sol arka takoz', 'Sol ön takoz', 'Şanzıman gövdesi'].sort());
    coz.birimler.forEach((b) => {
      expect(b.kapali).toBe(true);
      expect(b.kaynak).toBe(b.tip === 'mnt-mount' ? 'eksen' : 'hacim');
    });
  });

  test('kutu (motor): hacim ve merkez BİREBİR', () => {
    const b = birim('Motor bloğu');
    yakin(b.V, 900 * 700 * 800, 1e-9);
    b.konum.forEach((v, i) => expect(Math.abs(v - S.GUC.motor.konum[i])).toBeLessThan(1e-6));
  });

  // İç teğet çokgenin alan açığı (4/3)·s/R — s Takoz'un kiriş payı (0,5 mm)
  const PAY_S = (4 / 3) * M.VE_MNT_STP_UCGEN.kiris / 260;

  test('silindir (şanzıman, ekseni x): hacim kiriş payının açığı kadar, merkez birebir', () => {
    const b = birim('Şanzıman gövdesi');
    yakin(b.V, Math.PI * 260 * 260 * 700, PAY_S);
    b.konum.forEach((v, i) => expect(Math.abs(v - S.GUC.sanziman.konum[i])).toBeLessThan(1e-3));
  });

  // Kural: üst bağlantı yüzeyinin merkezi (2026-10-20, adım 5) — silindir takozda
  // üst disk, merkezin L/2 üstü; ayrıntılı kapılar mount-nokta.test.js'te
  test('takoz noktası = üst bağlantı yüzeyinin merkezi (dört takoz, iki ayna çift)', () => {
    S.GUC.takozlar.forEach((t) => {
      const b = birim(t.ad);
      [t.konum[0], t.konum[1], t.konum[2] + t.olcu[1] / 2].forEach((v, i) => expect(Math.abs(b.konum[i] - v)).toBeLessThan(1e-9));
      expect(b.nokta.r).toBe(t.olcu[0]);
    });
  });

  test('ALT MONTAJA verilen rol iki parçayı TEK birimde toplar', () => {
    const b = birim('Arka braket');
    yakin(b.V, 2 * 120 * 600 * 20, 1e-9);
    // İki plaka z = 450 ± 40 → birleşik merkez 450
    [700, 0, 450].forEach((v, i) => expect(Math.abs(b.konum[i] - v)).toBeLessThan(1e-6));
    expect(M.veMntStpBirimler(son, R).filter((x) => x.ad === 'Arka braket')[0].parcalar).toHaveLength(2);
  });

  test('kayıt: kütle verilince atalet homojen yoğunlukla — kutu birebir, silindir kiriş payının açığı kadar', () => {
    const k = M.veMntStpKayit(coz, { [birim('Motor bloğu').dugum]: 400, [birim('Şanzıman gövdesi').dugum]: '150' });
    const g = (ad) => k.liste.filter((n) => n.customName === ad)[0];
    const mot = g('Motor bloğu').data;
    expect(mot.mass).toBe(400);
    expect(mot.pointMass).toBe(false);
    yakin(mot.Ixx, 400 * (0.7 * 0.7 + 0.8 * 0.8) / 12, 2e-5);
    yakin(mot.Iyy, 400 * (0.9 * 0.9 + 0.8 * 0.8) / 12, 2e-5);
    yakin(mot.Izz, 400 * (0.9 * 0.9 + 0.7 * 0.7) / 12, 2e-5);
    [mot.Ixy, mot.Ixz, mot.Iyz].forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-4));
    const san = g('Şanzıman gövdesi').data;            // eksen x: Ixx = m r²/2
    expect(san.mass).toBe(150);
    yakin(san.Ixx, 150 * 0.26 * 0.26 / 2, PAY_S);
    yakin(san.Iyy, 150 * (3 * 0.26 * 0.26 + 0.7 * 0.7) / 12, PAY_S);
    yakin(san.Izz, san.Iyy, 1e-3);
  });

  test('kütle YOKSA atalet yazılmaz — yalnız ağırlık merkezi (kaynak işaretiyle)', () => {
    const k = M.veMntStpKayit(coz, {});
    const i = k.liste.findIndex((n) => n.customName === 'Arka braket');
    expect(k.liste[i].data).toEqual({ cgx: 700, cgy: 0, cgz: 450 });
    expect(k.kaynak[i]).toEqual({ cg: true });
    const t = k.liste.findIndex((n) => n.type === 'mnt-mount');
    expect(Object.keys(k.liste[t].data).sort()).toEqual(['x', 'y', 'z']);
    expect(k.kaynak[t]).toEqual({ konum: true });
  });

  test('kayıt µm\'ye yuvarlanır — dönüşüm gürültüsü alana yazılmaz', () => {
    const k = M.veMntStpKayit(coz, {});
    k.liste.forEach((n) => Object.values(n.data).forEach((v) => {
      expect(Math.abs(v * 1000 - Math.round(v * 1000))).toBeLessThan(1e-6);
    }));
  });
});

// Takoz'un STEP'i bütün güç grubu: üçgen inceliği TEK sabitten (0,5 mm) — hesap,
// sihirbaz ve 3B görüntüleyici aynı ağı görmezse aynı birim iki ayrı ağırlık
// merkezi verir. FEAD'in görüntüleyicisi varsayılan 0,1 mm'de kalır.
describe('ÜÇGEN İNCELİĞİ TEK YERDEN', () => {
  const U = require('../../js/step-ucgen.js');
  const kaynak = (f) => require('fs').readFileSync(require('path').join(__dirname, '../../js', f), 'utf8');
  test('hesabın kendi üçgenlemesi sabitin ağını kullanır, varsayılanınkini değil', () => {
    expect(M.VE_MNT_STP_UCGEN).toEqual({ kiris: 0.5, aci: 20 });
    const son = oku(S.gucGrubu());
    const R = roller(son, { 'Şanzıman gövdesi': 'mnt-gearbox' });
    const agla = (B) => ({ ag: (pi) => M.veMntStpParcaAgi(son, pi, B) });
    const kendi = M.veMntStpCoz(son, R).birimler[0];
    const sabit = M.veMntStpCoz(son, R, agla(U.veStepUcgenBaglam(son._model, M.VE_MNT_STP_UCGEN))).birimler[0];
    const ince = M.veMntStpCoz(son, R, agla(U.veStepUcgenBaglam(son._model))).birimler[0];
    expect(kendi.V).toBe(sabit.V);
    expect(kendi.V).not.toBe(ince.V);
  });
  // Bağlamı yalnız mount-step.js kurar (ortak ağ işi · hesap) ve hep sabitle:
  // 3B görüntüleyici ve sihirbaz ağı ortak işten alır, kendi bağlamını kurmaz.
  test('Takoz bağlamı yalnız ortak işte kurulur ve sabitin ağını kullanır; FEAD varsayılanda', () => {
    ['cp-mount-3b.js', 'cp-mount-wizard.js'].forEach((f) => {
      expect({ f, n: (kaynak(f).match(/veStepUcgenBaglam\(/g) || []).length }).toEqual({ f, n: 0 });
    });
    const c = kaynak('mount-step.js').match(/\.Baglam\([^)]*\)/g) || [];
    expect(c.length).toBeGreaterThanOrEqual(3);
    c.forEach((x) => expect(x).toMatch(/VE_MNT_STP_UCGEN/));
    expect(kaynak('cp-fead-3b.js')).toMatch(/veStepUcgenBaglam\(s\.sonuc\._model\)/);
  });
});

describe('ÇARPIM ATALETİNİN İŞARETİ — tensör bileşeni (CATIA: Ixy = −∫xy dm)', () => {
  // Kutu z etrafında 30° döndürülmüş: I = R·diag(Ixx, Iyy, Izz)·Rᵀ →
  // Ixy = c·s·(Ixx_yerel − Iyy_yerel). İşaret ters çıkarsa sehim ve modlar
  // sessizce başka bir gövdeyi çözerdi.
  const a = 0.9, b = 0.3, c = 0.4, m = 120, th = Math.PI / 6;
  const metin = S.guçGrubuStep([{ id: 'K', ad: 'Döndürülmüş kutu', sekil: 'kutu', olcu: [a * 1000, b * 1000, c * 1000],
    konum: [100, 200, 300], z: [0, 0, 1], x: [Math.cos(th), Math.sin(th), 0] }]);
  const son = oku(metin);
  const R = son.agac.map((d) => (d.ad === 'Döndürülmüş kutu' ? 'mnt-motor' : null));
  const coz = M.veMntStpCoz(son, R);
  const k = M.veMntStpKayit(coz, { [coz.birimler[0].dugum]: m });

  test('Ixy = c·s·(Ixx − Iyy) yerel eksende, Ixz = Iyz = 0', () => {
    const Ix = m * (b * b + c * c) / 12, Iy = m * (a * a + c * c) / 12;
    const d = k.liste[0].data;
    expect(Math.abs(d.Ixy - Math.cos(th) * Math.sin(th) * (Ix - Iy))).toBeLessThan(2e-4);
    expect(d.Ixy).toBeLessThan(0);                    // Ix < Iy (uzun kenar yerel x), 30°: negatif
    expect(Math.abs(d.Ixz)).toBeLessThan(1e-4);
    expect(Math.abs(d.Iyz)).toBeLessThan(1e-4);
    expect(d.cgx).toBe(100); expect(d.cgy).toBe(200); expect(d.cgz).toBe(300);
  });
});

describe('KAPALI OLMAYAN AĞ ve HATA YOLLARI', () => {
  test('beş yüzlü kutu (açık kabuk): kutunun merkezi + uyarı, atalet YOK', () => {
    const yz = new Y.StepYaz();
    const kok = yz.urun('ROOT', 'Kök');
    const u = yz.urun('ACIK', 'Açık kutu');
    yz.govde(u, S.kutuYuzleri(yz, 100, 200, 300).slice(0, 5), 'kabuk');
    yz.temsil(u);
    const t = yz.tak(kok, u, 'ACIK.1', [10, 20, 30], [0, 0, 1], [1, 0, 0]);
    yz.temsil(kok);
    yz.bagla(t);
    const son = oku(yz.metin());
    const R = son.agac.map((d) => (d.ad === 'Açık kutu' ? 'mnt-gearbox' : null));
    const coz = M.veMntStpCoz(son, R);
    expect(coz.ok).toBe(true);
    const b = coz.birimler[0];
    expect(b.kapali).toBe(false);
    expect(b.kaynak).toBe('kutu');
    [10, 20, 30].forEach((v, i) => expect(Math.abs(b.konum[i] - v)).toBeLessThan(1e-6));
    expect(b.acik).toBe(4);                           // eksik yüzün dört kenarı
    expect(coz.uyarilar.join(' ')).toMatch(/kapalı değil \(4 açık kenar\)/);
    const k = M.veMntStpKayit(coz, { [b.dugum]: 50 });
    expect(k.liste[0].data.mass).toBe(50);
    expect(k.liste[0].data.Ixx).toBeUndefined();
    expect(k.kaynak[0]).toEqual({ cg: true });
  });

  test('rol yoksa hesap yok — sebebiyle', () => {
    const son = oku(S.gucGrubu());
    const coz = M.veMntStpCoz(son, son.agac.map(() => null));
    expect(coz.ok).toBe(false);
    expect(coz.hatalar.join(' ')).toMatch(/Rol verilmiş parça yok/);
  });

  test('STEP olmayan metin: okuma başarısız, fırlatmaz', () => {
    const son = M.veMntStpOku('bu bir STEP dosyası değil');
    expect(son.ok).toBe(false);
    expect(M.veMntStpCoz(son, []).ok).toBe(false);
  });

  test('rol listesi TEK kaynak: çipler rollerin alt kümesi, hepsi Takoz tipi', () => {
    M.VE_MNT_STP_CIP.forEach((t) => expect(M.VE_MNT_STP_ROLLER).toContain(t));
    M.VE_MNT_STP_ROLLER.forEach((t) => expect(t).toMatch(/^mnt-/));
    expect(M.VE_MNT_STP_ROLLER).toContain('mnt-mount');
  });
});

// ── AĞ İŞİ — 3B ve hesap için TEK üretici (2026-10-20, Takoz adım 3) ─────
// Ölçülen kusurlar: tek bağlam bütün montajda birikiyordu (420 MB'lık
// montajda yığın tepesi 3,2 GB, sınır 4 GB); aynı parçanın örnekleri bağlamın
// önbelleğiyle yeniden kullanılıyordu — bağlam bırakılınca yeniden
// üçgenlenmesinler diye yerel ağ taşınır. Kapılar: bırakma her parçada,
// taşınan örnek BİT BİT doğrudan üçgenlemeyle aynı, iş yüz yüze saati sorar,
// öncelik ve durdurma.
describe('AĞ İŞİ — parça parça, bağlam bırakılır, aynı şekil bir kez (veMntStpAgIs)', () => {
  const U = require('../../js/step-ucgen.js');
  const son = oku(S.tekrarliMontaj());
  const geo = son._geo;
  const brk = son.parcalar.filter((p) => p.ad === 'Braket').map((p) => p.i);
  const govde = son.parcalar.filter((p) => p.ad === 'Gövde')[0].i;
  const bayt = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  const ayni = (a, b) => {
    ['uc', 'normal', 'ucgen', 'cizgi'].forEach((k) => expect({ k, esit: bayt(a[k]).equals(bayt(b[k])) }).toEqual({ k, esit: true }));
    expect(a.kutu).toEqual(b.kutu);
  };
  // Ölçü: tek bağlamla, her örnek kendi dönüşümüyle doğrudan üçgenleme
  const dogrudan = (i) => U.veStepUcgenParca(U.veStepUcgenBaglam(son._model, M.VE_MNT_STP_UCGEN), geo[i].yuzler, geo[i].M, geo[i].birim);
  const sahteSaat = () => { let t = 0; jest.spyOn(performance, 'now').mockImplementation(() => (t += 1)); return () => t; };
  afterEach(() => { if (performance.now.mockRestore) performance.now.mockRestore(); });

  test('montaj: braketin üç örneği aynı temsilde, gövde ayrı', () => {
    expect(brk).toHaveLength(3);
    expect(new Set(brk.map((i) => geo[i].sr)).size).toBe(1);
    expect(geo[govde].sr).not.toBe(geo[brk[0]].sr);
  });

  test('her parça bittiğinde bağlamın ara verisi (eğri · kenar · yüzey · yüz) bırakılmış', () => {
    const ag = [], izler = [];
    const J = M.veMntStpAgIs(son, ag, { bitti: (i) => izler.push([i, ['egri', 'kenar', 'yuzey', 'yuz'].map((k) => Object.keys(J.B[k]).length)]) });
    J.tum = true;
    expect(J.adim(Infinity)).toBe(true);
    expect(izler.map((x) => x[0]).sort()).toEqual(son.parcalar.map((p) => p.i).sort());
    izler.forEach((x) => expect(x[1]).toEqual([0, 0, 0, 0]));
  });

  test('aynı şekil BİR KEZ üçgenlenir; örnekler doğrudan üçgenlemeyle bit bit aynı, üçgen dizisi ortak', () => {
    const ag = [];
    const J = M.veMntStpAgIs(son, ag);
    J.tum = true;
    J.adim(Infinity);
    expect(J.B.sayac.yuz).toBe(geo[brk[0]].yuzler.length + geo[govde].yuzler.length);
    brk.concat([govde]).forEach((i) => ayni(ag[i], dogrudan(i)));
    expect(ag[brk[1]].ucgen).toBe(ag[brk[0]].ucgen);
    expect(ag[brk[2]].ucgen).toBe(ag[brk[0]].ucgen);
    expect(Object.keys(J.paylas)).toEqual([]);                 // son örnekle bırakıldı
    expect(J.say).toMatchObject({ parca: 4, parcaToplam: 4, yuzToplam: 3 * geo[brk[0]].yuzler.length + geo[govde].yuzler.length });
  });

  test('SAAT: iş her yüzden sonra saati sorar — dilimi en çok bir yüz aşar', () => {
    const saat = sahteSaat();
    const ag = [];
    const J = M.veMntStpAgIs(son, ag);
    J.tum = true;
    let dilim = 0, onceki = 0, enCok = 0;
    while (!J.adim(saat() + 4)) {
      const yuz = J.B ? J.B.sayac.yuz : 0;
      enCok = Math.max(enCok, yuz - onceki);
      onceki = yuz;
      if (++dilim > 500) break;
    }
    expect(enCok).toBeLessThanOrEqual(5);
    expect(dilim).toBeGreaterThanOrEqual(2);
    expect(ag.filter(Boolean)).toHaveLength(4);
  });

  test('ÖNCELİK: hesabın listesi önce; boş istek düşürür; uret eşzamanlı ve süren isteği bozmaz', () => {
    const sira = [];
    const J = M.veMntStpAgIs(son, [], { bitti: (i) => sira.push(i) });
    J.tum = true;
    J.iste([govde]);
    J.adim(Infinity);
    expect(sira[0]).toBe(govde);
    expect(sira).toHaveLength(4);

    const sira2 = [], ag2 = [];
    const J2 = M.veMntStpAgIs(son, ag2, { bitti: (i) => sira2.push(i) });
    J2.iste([govde]);
    J2.iste([]);
    expect(J2.adim(Infinity)).toBe(true);
    expect(sira2).toEqual([]);
    J2.tum = true;
    J2.iste([brk[2]]);
    J2.uret([govde]);
    expect(sira2).toEqual([govde]);
    expect(J2.tum).toBe(true);
    J2.adim(Infinity);
    expect(sira2[1]).toBe(brk[2]);
    expect(sira2).toHaveLength(4);
    expect(J2.eksik(son.parcalar.map((p) => p.i))).toBe(0);
  });

  test('DURDUR: istek kalkınca yarım parça biter, yenisine başlanmaz', () => {
    const saat = sahteSaat();
    const ag = [];
    const J = M.veMntStpAgIs(son, ag);
    J.tum = true;
    expect(J.adim(saat() + 2)).toBe(false);
    expect(J.cur).not.toBeNull();
    const yarim = J.cur.i;
    J.tum = false;
    expect(J.adim(Infinity)).toBe(true);
    expect(ag[yarim]).toBeTruthy();
    expect(ag.filter(Boolean)).toHaveLength(1);
  });

  test('eşzamanlı yol (veMntStpAgUret) yalnız listeyi üretir; hesap bağlamı da parça başına bırakır', () => {
    const ag = M.veMntStpAgUret(son, [], [govde]);
    expect(ag.filter(Boolean)).toHaveLength(1);
    ayni(ag[govde], dogrudan(govde));
    const B = U.veStepUcgenBaglam(son._model, M.VE_MNT_STP_UCGEN);
    U.veStepUcgenParca(B, geo[brk[0]].yuzler, geo[brk[0]].M, geo[brk[0]].birim);
    expect(Object.keys(B.yuzey).length).toBeGreaterThan(0);
    U.veStepUcgenBirak(B);
    expect(['egri', 'kenar', 'yuzey', 'yuz'].map((k) => Object.keys(B[k]).length)).toEqual([0, 0, 0, 0]);
    expect(B.sayac.yuz).toBe(geo[brk[0]].yuzler.length);       // sayaç kalır
  });
});
