/* =========================================================================
 *  Gates rapor ARŞİVİ — kaynak ile çıkarılmış veri arasındaki kapı
 * =========================================================================
 *  `docs/gates-reports/pdf/` altındaki raporlar iki şeyin kaynağı:
 *
 *    • `tests/fixtures/fead-validation.js`  — statik zincirin 2095 değeri
 *      (dış kopya, elle çıkarılmış, uzun süre HİÇ doğrulanmamıştı)
 *    • `tests/helpers/gates-vibration.js`   — burulma kalibrasyonunun girdileri
 *      ve referansı (kopya YOK, doğrudan PDF'ten okunuyor)
 *
 *  Bu dosya ikisini de kaynağına bağlar. Kapı olmadan bir sayı sessizce
 *  ayrışabilir ve testler yeşil kalır — bu projenin en pahalı hata sınıfı.
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { gatesPdfPages, numberAfter, numbersAfter, pageMarker } = require('../helpers/gates-pdf.js');
const { REPORT, vibrationOf } = require('../helpers/gates-vibration.js');
const V = require('../fixtures/fead-validation.js');

const DIR = path.join(__dirname, '../../docs/gates-reports/pdf');
const pdfs = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.pdf')).sort();

/** Doğrulama anahtarı → arşiv dosyası (statik zincir için; hepsi mevcut). */
const STATIK = {
  'AG0868-4PK':   'AG0868_4PK1013HD_E9843-16Nm_2022-12-27.pdf',
  'AG0868-6PK':   'AG0868_6PK1018HD_E9843-19Nm_2022-12-27.pdf',
  'AG0868':       'AG0868_8PK1020HD_E9843-22.5Nm_2022-12-27.pdf',
  'AG00902-1275': 'AG00902_8PK1275HD_E9843-22Nm_2023-12-08.pdf',
  'AG00902-1300': 'AG00902_8PK1300HD_E9843-22Nm_2023-11-30.pdf',
  'AG00686':      'AG00686_8PK1475HD_T38624-24.6Nm_2023-09-07.pdf',
  'AG00686-1520': 'AG00686_8PK1520HD_T38624-22.2Nm_2023-09-07.pdf',
  'AG00810':      'AG00810_10PK1215HD_T38519-v8_2021-09-16.pdf',
  'AG00879':      'AG00879_8PK1392HD_T38665-31Nm_2023-05-17.pdf',
  'AG00894':      'AG00894_8PK1738HD_E9843-23Nm_2023-09-18.pdf',
};

const sayfa = (file, baslik) => {
  const p = gatesPdfPages(path.join(DIR, file)).find((t) => t.indexOf(baslik) >= 0);
  if (!p) throw new Error(baslik + ' yok: ' + file);
  return p;
};

describe('Gates arşivi — okuyucu', () => {
  test('on raporun onu da okunuyor ve metin üretiyor', () => {
    const list = pdfs();
    expect(list.length).toBe(10);
    list.forEach((f) => {
      const pages = gatesPdfPages(path.join(DIR, f));
      expect(pages.length).toBeGreaterThan(0);
      expect(pages.join('').length).toBeGreaterThan(5000);
    });
  });

  // Metin glif KİMLİĞİ olarak yazılı ve eşleme fonta özgü. Bütün CMap'leri tek
  // tabloda birleştiren bir sürüm ölçüldü ve YANLIŞTI: dört raporda glifler
  // çakışıyor (glif 44 → space / 'A' / '#' / '@' / 'G'). Bu test okumanın
  // gerçekten anlamlı metin verdiğini tutuyor — çöp çözümleme buradan geçemez.
  test('font çözümlemesi doğru: her rapor kendi künyesini okutuyor', () => {
    Object.entries(STATIK).forEach(([key, file]) => {
      const t = sayfa(file, 'Geometric Analysis, Sheet 1 of 2');
      expect(t).toContain('Layout Data mm');
      expect(t).toContain('Tensioner Data');
      expect(t).toContain('Span Length');
      expect(t).toMatch(new RegExp(key.split('-')[0]));
    });
  });

  // EKSİ İŞARETİ AYRI ÇİZİM ÇAĞRISI: X sütunu `["-","72.00"]` olarak geliyor.
  // Kaçırılırsa koordinat MUTLAK DEĞERİYLE okunur — kasnak aynalanır, geometri
  // yine "çözülür", hata verilmez.
  test('negatif koordinatlar işaretiyle okunuyor', () => {
    const t = sayfa(STATIK['AG00686'], 'Geometric Analysis, Sheet 1 of 2');
    const x = numbersAfter(t, 'X', 4);
    expect(x.filter((v) => v < 0).length).toBeGreaterThan(0);
    expect(x).toEqual(V.AG_MISC['AG00686'].order.map((p) => V.AG_MISC['AG00686'].xy[p][0]));
  });
});

describe('Gates arşivi — fixture KAYNAĞINA bağlı', () => {
  test('284 değer: yerleşim · çap · açıklık · sarım · gergi künyesi', () => {
    let checked = 0;
    const bad = [];
    Object.entries(STATIK).forEach(([key, file]) => {
      const fx = V.AG_MISC[key];
      const order = fx.order;
      const t = sayfa(file, 'Geometric Analysis, Sheet 1 of 2');
      [['X', order.map((p) => fx.xy[p][0])],
       ['Y', order.map((p) => fx.xy[p][1])],
       ['Pitch', order.map((p) => fx.pulley[p].p)],
       ['Effective', order.map((p) => fx.pulley[p].e)],
       ['mm', order.map((p) => fx.span[p])],          // Span Length
       ['°', order.map((p) => fx.wrap[p])],           // Wrap Angle
      ].forEach(([lab, exp]) => {
        const got = numbersAfter(t, lab, order.length);
        exp.forEach((e, i) => {
          checked++;
          if (Math.abs(e - got[i]) > 0.005) bad.push(`${key} ${lab} ${order[i]}: ${e} ↔ ${got[i]}`);
        });
      });
      [['Design Tension N', 'design'], ['Arm Length mm', 'arm'],
       ['Spring Mean Load Nm', 'meanLoad'], ['Spring Rate Nm/deg', 'rate'],
       ['Belt Length Tolerance (+/-) mm', 'tol']].forEach(([lab, k]) => {
        const g = numberAfter(t, lab);
        if (g == null || fx[k] == null) return;
        checked++;
        if (Math.abs(fx[k] - g) > 0.005) bad.push(`${key} ${lab}: ${fx[k]} ↔ ${g}`);
      });
    });
    expect(bad).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(280);
  });
});

describe('Gates arşivi — titreşim girdileri', () => {
  test('yedi raporda krank · kol · kütle · Mode 1 okunuyor', () => {
    Object.keys(REPORT).forEach((k) => {
      const v = vibrationOf(k);
      expect(v.crankInertiaKgM2).toBeGreaterThan(0);
      expect(v.armInertiaKgM2).toBeGreaterThan(0);
      expect(v.pulleyMassKg).toBeGreaterThan(0);
      expect(v.mode1Hz).toBeGreaterThan(5);
      expect(Object.keys(v.accessoryInertia).length).toBeGreaterThan(0);
    });
  });

  // KRANK MİLİ ATALETİ SİSTEM BAŞINA DEĞİŞİYOR. Test bir dönem beşi için de
  // 0.7 kullanıyordu; o değer yalnız takımın DIŞINDAKİ AG00810'da doğru.
  test('krank mili ataleti sabit DEĞİL — 0.15 / 0.5 / 0.7', () => {
    const j = Object.keys(REPORT).map((k) => vibrationOf(k).crankInertiaKgM2);
    expect(new Set(j).size).toBeGreaterThan(1);
    expect(vibrationOf('AG00686').crankInertiaKgM2).toBeCloseTo(0.15, 5);
    expect(vibrationOf('AG0868').crankInertiaKgM2).toBeCloseTo(0.50, 5);
    expect(vibrationOf('AG00810').crankInertiaKgM2).toBeCloseTo(0.70, 5);
  });

  // Bu kütle bir dönem "BİLİNMİYOR" diye belgeliydi ve çekirdeğin künyesinden
  // türetilmeye çalışılıyordu; raporun kendi sayfası yazıyor.
  test('AG00810 gergi kasnak kütlesi raporda YAZIYOR: 0.80 kg', () => {
    expect(vibrationOf('AG00810').pulleyMassKg).toBeCloseTo(0.80, 5);
  });

  // Fixture'ın NF alanı kaynağıyla uyuşmuyor — Gates SÜRÜM farkı değil, çünkü
  // sürüm damgaları birebir aynı. Kalibrasyon artık kaynağı kullanıyor; bu test
  // farkın kendisini belgeliyor ki biri sessizce fixture'a geri dönmesin.
  test('NF: fixture ile kaynak AYRIŞIYOR ve kaynak kazanır', () => {
    expect(vibrationOf('AG00686').mode1Hz).toBeCloseTo(12.61, 2);
    expect(V.AG_MISC['AG00686'].NF).toBeCloseTo(11.87, 2);
    expect(vibrationOf('AG00686-1520').mode1Hz).toBeCloseTo(12.61, 2);
    expect(V.AG_MISC['AG00686-1520'].NF).toBeCloseTo(13.35, 2);
    expect(vibrationOf('AG00810').mode1Hz).toBeCloseTo(15.05, 2);
    expect(V.AG_MISC['AG00810'].NF).toBeCloseTo(13.29, 2);
    // AG0868 ailesinin ikisi birebir tutuyor — yani fark sistematik DEĞİL
    expect(vibrationOf('AG0868-4PK').mode1Hz).toBeCloseTo(V.AG_MISC['AG0868-4PK'].NF, 2);
    expect(vibrationOf('AG0868-6PK').mode1Hz).toBeCloseTo(V.AG_MISC['AG0868-6PK'].NF, 2);
  });

  // Fixture'da AG00879 için atalet verisi HİÇ YOKTU (`inertia: null`); arşiv
  // onu kazandırdı. Aksesuar ataleti olmadan sistem %86 sapıyordu.
  test('AG00879 aksesuar ataletleri arşivden geliyor (fixture null)', () => {
    expect(V.AG_MISC['AG00879'].inertia).toBeNull();
    const acc = vibrationOf('AG00879').accessoryInertia;
    expect(Object.keys(acc).sort()).toEqual(['ALT', 'A_C', 'IDR', 'TEN']);
    expect(acc.ALT).toBeCloseTo(0.0085, 5);
  });
});

describe('Gates arşivi — belge bütünlüğü', () => {
  // ALINTI TUZAĞI: bir bölümü PDF'te bulamamak, o bölümün RAPORDA olmadığı
  // anlamına gelmiyor. `Page N of M` bunu ele veriyor.
  test('hangi raporun hangi sayfaları var — alıntılar işaretli', () => {
    const eksik = {};
    pdfs().forEach((f) => {
      const pages = gatesPdfPages(path.join(DIR, f));
      const nums = [];
      let total = null;
      pages.forEach((t) => {
        const m = pageMarker(t);
        if (m) { nums.push(m.page); total = m.total; }
      });
      const miss = [];
      for (let i = 1; i <= total; i++) if (nums.indexOf(i) < 0) miss.push(i);
      if (miss.length) eksik[f] = miss;
    });
    // AG00894 ve AG00902 ×2 gerçekten alıntı; AG00879 DEĞİL — sayfa ağacı
    // beşini gösteriyor ama on iki sayfanın tamamı dosyanın içinde ve hepsi
    // aynı tasarıma ait (ölçüldü).
    expect(Object.keys(eksik).sort()).toEqual([
      'AG00894_8PK1738HD_E9843-23Nm_2023-09-18.pdf',
      'AG00902_8PK1275HD_E9843-22Nm_2023-12-08.pdf',
      'AG00902_8PK1300HD_E9843-22Nm_2023-11-30.pdf',
    ]);
  });

  test('tam raporlar tepe yük tablosunu taşıyor (kalibre edilmemiş tablonun kaynağı)', () => {
    const tam = ['AG00686', 'AG00686-1520', 'AG00810', 'AG00879', 'AG0868-4PK', 'AG0868-6PK', 'AG0868'];
    tam.forEach((k) => {
      const t = sayfa(STATIK[k], 'Pulley Hubload Analysis (Peak)');
      expect(t).toContain('Peak Tension & Hubload');
    });
  });
});
