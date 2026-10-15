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
    coz.birimler.forEach((b) => { expect(b.kapali).toBe(true); expect(b.kaynak).toBe('hacim'); });
  });

  test('kutu (motor): hacim ve merkez BİREBİR', () => {
    const b = birim('Motor bloğu');
    yakin(b.V, 900 * 700 * 800, 1e-9);
    b.konum.forEach((v, i) => expect(Math.abs(v - S.GUC.motor.konum[i])).toBeLessThan(1e-6));
  });

  test('silindir (şanzıman, ekseni x): hacim kiriş payı kadar, merkez birebir', () => {
    const b = birim('Şanzıman gövdesi');
    yakin(b.V, Math.PI * 260 * 260 * 700, 2e-3);
    b.konum.forEach((v, i) => expect(Math.abs(v - S.GUC.sanziman.konum[i])).toBeLessThan(1e-3));
  });

  test('takoz konumu = biriminin hacim merkezi (dört takoz, iki ayna çift)', () => {
    S.GUC.takozlar.forEach((t) => {
      birim(t.ad).konum.forEach((v, i) => expect(Math.abs(v - t.konum[i])).toBeLessThan(1e-3));
    });
  });

  test('ALT MONTAJA verilen rol iki parçayı TEK birimde toplar', () => {
    const b = birim('Arka braket');
    yakin(b.V, 2 * 120 * 600 * 20, 1e-9);
    // İki plaka z = 450 ± 40 → birleşik merkez 450
    [700, 0, 450].forEach((v, i) => expect(Math.abs(b.konum[i] - v)).toBeLessThan(1e-6));
    expect(M.veMntStpBirimler(son, R).filter((x) => x.ad === 'Arka braket')[0].parcalar).toHaveLength(2);
  });

  test('kayıt: kütle verilince atalet homojen yoğunlukla — kutu birebir, silindir ≤ %0,2', () => {
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
    yakin(san.Ixx, 150 * 0.26 * 0.26 / 2, 2e-3);
    yakin(san.Iyy, 150 * (3 * 0.26 * 0.26 + 0.7 * 0.7) / 12, 2e-3);
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

describe('ÇARPIM ATALETİNİN İŞARETİ — tensör bileşeni (CATIA: Ixy = −∫xy dm)', () => {
  // Kutu z etrafında 30° döndürülmüş: I = R·diag(Ixx, Iyy, Izz)·Rᵀ →
  // Ixy = c·s·(Ixx_yerel − Iyy_yerel). İşaret ters çıkarsa çökme ve modlar
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
