/**
 * @jest-environment jsdom
 */
// TAKOZ · PARAMETRİK ANALİZ — EXCEL ÇIKTISI (js/mount-param-excel.js · js/xlsx-yaz.js)
// Kullanıcı kararı 2026-11-09: "Kullanıcı bu Excel formatında çıktı alacak." Düzen
// Canlı Not'ta 19 notla kuruldu (10 Ton TTA, R12). Kapılar:
//   DÜZEN     — Özet · Tarama · K0…Kn; Özet'in sütunları ve başlık notları; K sayfasının
//               düğmeleri, tablo yerleri; ızgara kapalı; kullanılmayan satır/sütun gizli
//   UYGUNLUK  — tek renkli sütun: en uygun koyu yeşil (beyaz yazı), öteki uygunlar sırayla
//               açılan yeşil, uygun olmayan renksiz; başka hücre boyanmaz
//   AD        — "ASR…" eki hiçbir yerde yok; sayfa adı ≤ 31 karakter, bağlantılar ona gider
//   SAYI      — frekans payı ve kapasite onaylanan Excel'in değerleri (R12)
//   SIĞAR     — her kenarlıklı hücrenin yazısı sütun genişliğine sığar (Calibri ölçüsü)
const X = require('../../js/xlsx-yaz.js');
const E_ = require('../../js/mount-param-excel.js');
const R = require('../../js/xlsx-read.js');

// 10 Ton TTA'nın iki konfigürasyonu — onaylanan Excel'in (R12) değerleri
const F_K0 = [5.1126, 5.7046, 6.5321, 8.4885, 10.7892, 15.4683];
const F_K1 = [4.2509, 5.0319, 6.4155, 7.3113, 10.6584, 16.0972];
function vaka(ad, dz) { return { ad, d: [[0.2, 0, dz[0]], [-0.5, 0.0044, dz[1]], [-0.45, 0.0044, dz[2]]] }; }
const E = {
  baslik: '10 Ton TTA — takoz konfigürasyonları', fAtes: 35, rolanti: 700, silindir: 6, zeta: 0.02, kutle: 1739.1,
  gruplar: ['Ön takoz · 57RS313774', 'Sağ/Sol arka takoz · 57RS313773'],
  takozlar: [{ ad: 'Ön takoz · 57RS313774', grup: 0 }, { ad: 'Sağ arka takoz · 57RS313773', grup: 1 }, { ad: 'Sol arka takoz · 57RS313773', grup: 1 }],
  konfig: [
    { K: 0, mevcut: true, tipler: ['57RS313774 (ASR-SR-116)', '57RS313773 (ASR-SR-116)'], uygunluk: 'Uygun değil',
      kriter: [true, true, false, true], f: F_K0, T: 0.10309,
      takozTip: ['57RS313774 (ASR-SR-116)', '57RS313773 (ASR-SR-116)', '57RS313773 (ASR-SR-116)'],
      vakalar: [vaka('Static', [-2.69, -2.66, -2.9]), vaka('Max Bump', [-15.1, -8.9, -9.7])],
      modlar: F_K0.map((f, i) => ({ f, ad: ['pitch+bounce', 'roll', 'bounce', 'lateral+yaw', 'fore-aft', 'roll'][i] })) },
    { K: 1, tipler: ['LMT-1433-00 55 ShA', '57RS313773 (A26)'], uygunluk: 'En uygun', kriter: [true, true, true, true],
      f: F_K1, T: 0.088119, takozTip: ['LMT-1433-00 55 ShA', '57RS313773 (A26)', '57RS313773 (A26)'],
      vakalar: [vaka('Static', [-6.37, -2.55, -2.79])], modlar: F_K1.map((f) => ({ f, ad: 'roll' })) },
    { K: 2, tipler: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)'], uygunluk: 'Kısmen uygun',
      kriter: [true, true, true, true], f: [6.82, 7.98, 11.41, 12.04, 14.21, 15.21], T: 0.1217,
      takozTip: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', 'Cone 121 NP 55 ShA (AMC 137829)'],
      vakalar: [vaka('Static', [-3.9, -5.4, -5.9])], modlar: [{ f: 6.82, ad: 'yaw+lateral' }] },
    { K: 3, tipler: ['Mount 1 40 ShA', 'Cone 39 50 ShA (AMC 137982)'], uygunluk: 'Kısmen uygun',
      kriter: [true, true, true, true], f: [3.58, 4.45, 5.0, 7.0, 9.0, 12.13], T: 0.045,
      takozTip: ['Mount 1 40 ShA', 'Cone 39 50 ShA (AMC 137982)', 'Cone 39 50 ShA (AMC 137982)'],
      vakalar: [], modlar: [] }
  ],
  tarama: { N: 576, gruplar: [0, 1], satirlar: [
    { tipler: ['Mount 1 40 ShA', 'Cone 39 50 ShA (AMC 137982)'], f: [3.58, 4.45, 6.0, 7.78, 10.11, 12.13], fB: 7.16, T: 0.045, d: 15.0,
      k: [true, true, true, true], yuk: [470, 661], azami: [null, 600] },
    { tipler: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)'], f: [6.82, 7.98, 11.41, 12.04, 14.21, 15.21], fB: 11.49, T: 0.1217, d: 5.9,
      k: [true, true, true, true], yuk: [496, 648], azami: [null, 1200] },
    { tipler: ['57RS313774 (ASR-SR-116)', 'Cone 38 60 ShA (AMC 137963)'], f: [3.7, 4.42, 6.0, 7.01, 8.9, 12.0], fB: 3.62, T: 0.012, d: 15.1,
      k: [true, false, false, true], yuk: [497.3, 647.8], azami: [null, 650] }
  ] }
};

const KITAP = E_.kitap(E);
const sayfa = (ad) => KITAP.sayfalar.find((s) => s.ad === ad);
const hucre = (S, r, c) => S.hucre.find((h) => h[0] === r && h[1] === c);
const metinler = (S) => S.hucre.map((h) => h[2]).filter((v) => typeof v === 'string')
  .concat((S.not || []).map((n) => n[2]));

describe('DÜZEN', () => {
  test('sayfalar: Özet, Tarama, konfigürasyon başına bir sayfa', () => {
    expect(KITAP.sayfalar.map((s) => s.ad)).toEqual(['Özet', 'Tarama', 'K0 Mevcut', 'K1 LMT-55 + 57RS313773 A26',
      'K2 TK040-45 + Cone121NP-55', 'K3 Mount1-40 + Cone39-50']);
  });

  test('Özet: başlık B2 (14 pt), tablo 4. satırda; sütunlar onaylanan düzende', () => {
    const S = sayfa('Özet');
    expect(hucre(S, 2, 2)[2]).toBe('10 Ton TTA — takoz konfigürasyonları');
    expect(hucre(S, 2, 2)[3].boy).toBe(14);
    const bas = S.hucre.filter((h) => h[0] === 4).sort((a, b) => a[1] - b[1]).map((h) => h[2]);
    expect(bas).toEqual(['K', 'Sayfa', 'Ön takoz', 'Sağ/Sol arka takoz', 'Uygunluk', 'Kriter 1 · Modal bant < 17,50 Hz',
      'Kriter 1a · Mod ayrıklığı > 0,5 Hz', 'Kriter 1b · 8–10 Hz bandında mod yok', 'Kriter 2 · TR < %50',
      'Frekans payı [Hz]', 'TR [%]', 'En düşük mod [Hz]']);
  });

  test('kriterlerin tanımı başlığın notunda; tabloda açıklama satırı yok', () => {
    const S = sayfa('Özet');
    const notlu = S.not.map((n) => n[1]);
    expect(notlu).toEqual([6, 7, 8, 9, 10, 11]);         // Uygunluk · Kriter 1 · 1a · 1b · 2 · Frekans payı
    const k1 = S.not.find((n) => n[1] === 7)[2];
    expect(k1).toContain('f_ateş = 700 d/dk (rölanti) / 60 × 6 silindir / 2 = 35,00 Hz');
    expect(S.not.find((n) => n[1] === 10)[2]).toContain('ζ = 0,020;  m = 1.739,1 kg');
    expect(Math.max(...S.hucre.map((h) => h[0]))).toBe(8);   // başlık + tablo; altında bir şey yok
  });

  test('K sayfası: başlık C2 (üst boşluk 30 pt), düğmeler 4. satırda, tablo 6–8. satırdan', () => {
    const S = sayfa('K1 LMT-55 + 57RS313773 A26');
    expect(S.satir[1]).toBe(30);
    expect(hucre(S, 2, 3)[2]).toBe('K1 — Ön takoz: LMT-1433-00 55 ShA · Sağ/Sol arka takoz: 57RS313773 (A26)');
    expect(hucre(S, 4, 3)[2]).toBe('← Özet sayfasına dön');
    expect(hucre(S, 4, 4)[2]).toBe('← Geri konfigürasyon (K0)');
    expect(hucre(S, 4, 12)[2]).toBe('İleri konfigürasyon (K2) →');
    expect(S.birlesik).toEqual(expect.arrayContaining(['D4:F4', 'L4:N4', 'D6:F6', 'H7:J7', 'L7:N7']));
    expect(hucre(S, 7, 4)[2]).toBe('Ön takoz');
    expect(hucre(S, 7, 8)[2]).toBe('Sağ arka takoz');
    expect([8, 9, 10].map((c) => hucre(S, 8, c)[2])).toEqual(['X', 'Y', 'Z']);
    expect(hucre(S, 9, 3)[2]).toBe('Static');
    expect(hucre(S, 9, 6)[2]).toBe(-6.37);
    // modlar vakalardan 4 satır sonra, TR modlardan 3 satır sonra
    expect(hucre(S, 14, 2)[2]).toBe('Mod');
    expect(hucre(S, 14 + 6 + 3, 2)[2]).toBe('TR (%)');
    expect(hucre(S, 14 + 6 + 3, 3)[2]).toBeCloseTo(8.8119, 4);
  });

  test('ilk konfigürasyonda Geri, sonuncuda İleri yok', () => {
    expect(hucre(sayfa('K0 Mevcut'), 4, 4)).toBeUndefined();
    expect(hucre(sayfa('K0 Mevcut'), 4, 12)[2]).toBe('İleri konfigürasyon (K1) →');
    expect(hucre(sayfa('K3 Mount1-40 + Cone39-50'), 4, 12)).toBeUndefined();
  });

  test('her sayfada ızgara kapalı, kullanılmayan satır ve sütun gizli', () => {
    KITAP.sayfalar.forEach((S) => { expect([S.ad, S.izgara, S.gizle]).toEqual([S.ad, false, true]); });
    const F = X.dosyalar(KITAP);
    const s1 = F.find((f) => f[0] === 'xl/worksheets/sheet1.xml')[1];
    expect(s1).toContain('showGridLines="0"');
    expect(s1).toContain('zeroHeight="1"');
  });

  test('bağlantılar: Özet\'teki K ve Sayfa o sayfaya; düğmeler Özet\'e ve komşu sayfaya', () => {
    const S = sayfa('Özet');
    expect(S.bag).toEqual(expect.arrayContaining([[5, 2, 'K0 Mevcut', 'A1'], [6, 3, 'K1 LMT-55 + 57RS313773 A26', 'A1']]));
    const K1 = sayfa('K1 LMT-55 + 57RS313773 A26');
    expect(K1.bag).toEqual([[4, 3, 'Özet', 'A1'], [4, 4, 'K0 Mevcut', 'A1'], [4, 12, 'K2 TK040-45 + Cone121NP-55', 'A1']]);
    const adlar = KITAP.sayfalar.map((s) => s.ad);
    KITAP.sayfalar.forEach((s) => (s.bag || []).forEach((b) => expect(adlar).toContain(b[2])));
  });
});

describe('UYGUNLUK — tek renkli sütun', () => {
  const S = sayfa('Özet');
  test('en uygun koyu yeşil ve beyaz yazı; kısmen uygunlar sırayla açılan yeşil; uygun olmayan renksiz', () => {
    expect(hucre(S, 5, 6)[2]).toBe('Uygun değil');
    expect(hucre(S, 5, 6)[3].dolgu).toBeUndefined();
    expect(hucre(S, 6, 6)[3]).toMatchObject({ dolgu: '1F7A3D', renk: 'FFFFFF', b: true });
    expect(hucre(S, 7, 6)[3].dolgu).toBe('6BC782');
    expect(hucre(S, 8, 6)[3].dolgu).toBe('7BCD90');
  });
  test('Uygunluk sütunundan başka hiçbir hücre boyanmaz (Not 15)', () => {
    const boyali = S.hucre.filter((h) => h[3] && h[3].dolgu).map((h) => h[1]);
    expect(new Set(boyali)).toEqual(new Set([6]));
  });
});

describe('AD', () => {
  test('"ASR" hiçbir hücrede, notta, sayfa adında ve dosyanın içinde yok', () => {
    KITAP.sayfalar.forEach((S) => {
      expect(S.ad).not.toMatch(/ASR/i);
      metinler(S).forEach((m) => expect(m).not.toMatch(/ASR/));
    });
    const F = X.dosyalar(KITAP);
    F.forEach(([ad, m]) => expect([ad, /ASR/.test(m)]).toEqual([ad, false]));
    expect(hucre(sayfa('Özet'), 5, 4)[2]).toBe('57RS313774');
  });

  test('kısa tip adı ve sayfa adı (≤ 31 karakter)', () => {
    expect(E_.kisa('Cone 39 50 ShA (AMC 137982)')).toBe('Cone39-50');
    expect(E_.kisa('57RS313773 (A26)')).toBe('57RS313773 A26');
    expect(E_.kisa('57RS313773 (ASR-SR-116)')).toBe('57RS313773');
    expect(E_.kisa('LMT-1433-00 55 ShA')).toBe('LMT-55');
    expect(E_.kisa('Cone 121 NG 65 ShA (AMC 137833)')).toBe('Cone121NG-65');
    const uzun = E_.sayfaAdi({ K: 7 }, ['Cone 121 NG 65 ShA (AMC 137833)', 'Hydr. Cone 72 ShA (AMC 177296)']);
    expect(uzun.length).toBeLessThanOrEqual(31);
    expect(uzun.startsWith('K7 ')).toBe(true);
  });

  test('mod adı onaylanan biçimde', () => {
    expect(E_.modAdi('pitch+bounce')).toBe('Pitch + Bounce');
    expect(E_.modAdi('fore-aft')).toBe('Fore-aft');
  });
});

describe('SAYI — onaylanan Excel\'in (R12) değerleri', () => {
  test('frekans payı: K0 −0,488 · K1 0,281 (Özet)', () => {
    expect(E_.frekansPayi(F_K0, 35)).toBeCloseTo(-0.4885, 4);
    expect(E_.frekansPayi(F_K1, 35)).toBeCloseTo(0.2810, 4);
    expect(hucre(sayfa('Özet'), 6, 11)[2]).toBeCloseTo(0.281, 3);
    expect(hucre(sayfa('Özet'), 6, 12)[2]).toBeCloseTo(8.8119, 4);    // TR [%]
    expect(hucre(sayfa('Özet'), 6, 13)[2]).toBeCloseTo(4.2509, 4);    // en düşük mod
  });
  test('kapasite: grup başına yük ↔ azami yük', () => {
    expect(E_.kapasite([470, 661], [null, 600])).toBe('Aşıyor');
    expect(E_.kapasite([496, 648], [null, 1200])).toBe('Bilinen yeter');
    expect(E_.kapasite([497, 647], [900, 650])).toBe('Yeter');
    expect(E_.kapasite([497, 647], [null, null])).toBe('Katalogda yok');
  });
  test('Tarama: dört kriter ✓/✗, satır sırası ve filtre', () => {
    const S = sayfa('Tarama');
    expect(hucre(S, 1, 1)[2]).toBe('Tarama — ilk 3 / 576 kombinasyon (Ön takoz × Sağ/Sol arka takoz)');
    const bas = S.hucre.filter((h) => h[0] === 5).sort((a, b) => a[1] - b[1]).map((h) => h[2]);
    expect(bas.slice(0, 3)).toEqual(['No', 'Ön takoz', 'Sağ/Sol arka takoz']);
    expect(bas.slice(-5)).toEqual(['Ön takoz statik yük [kg]', 'Sağ/Sol arka takoz statik yük [kg]',
      'Ön takoz azami yük [kg]', 'Sağ/Sol arka takoz azami yük [kg]', 'Kapasite']);
    const i1 = bas.indexOf('Kriter 1') + 1;
    expect([0, 1, 2, 3].map((j) => hucre(S, 8, i1 + j)[2])).toEqual(['✓', '✗', '✗', '✓']);
    expect(hucre(S, 8, i1 + 4)[2]).toBe('—');
    expect(hucre(S, 6, i1 + 4)[2]).toBe('Uygun');
    expect(S.filtre).toBe('A5:' + X.harf(bas.length) + '8');
  });
});

describe('SIĞAR — kenarlıklı her hücrenin yazısı sütununa sığar', () => {
  test('tek satırlık yazı sütun genişliğinin içinde; sarılan başlık satırı yüksekliğinde', () => {
    KITAP.sayfalar.forEach((S) => {
      const kapali = {};
      (S.birlesik || []).forEach((b) => {
        const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(b);
        const c = (h) => [...h].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
        for (let x = c(m[1]); x <= c(m[3]); x++) kapali[m[2] + ',' + x] = true;
      });
      S.hucre.forEach((h) => {
        const st = h[3] || {};
        if (!st.kenar || st.sar || kapali[h[0] + ',' + h[1]] || h[2] === '' || h[2] == null) return;
        const gen = (S.sutun[h[1]] || 8.43) * 7 + 5 - 6;
        const yazi = typeof h[2] === 'number' ? String(h[2].toFixed(3)).replace('.', ',') : h[2];   // makine: en uzun gösterim
        expect([S.ad, h[0], h[1], E_.px(yazi, st.b) <= gen + 6]).toEqual([S.ad, h[0], h[1], true]);
      });
    });
  });
});

describe('DOSYA — programın okuyucusuyla gidiş-dönüş', () => {
  test('okunan Özet ve K sayfası kurucunun değerlerini taşır', () => {
    const wb = R.veXlsOpen(X.yaz(KITAP));
    expect(wb.sheets.map((s) => s.name)).toEqual(KITAP.sayfalar.map((s) => s.ad));
    const oz = wb.readSheet(0).rows;
    expect(oz[5].slice(1, 6)).toEqual(['K1', 'K1 LMT-55 + 57RS313773 A26', 'LMT-1433-00 55 ShA', '57RS313773 (A26)', 'En uygun']);
    const k0 = wb.readSheet(2).rows;
    expect(k0[8][2]).toBe('Static');
    expect(k0[8][5]).toBeCloseTo(-2.69, 6);
  });
});
