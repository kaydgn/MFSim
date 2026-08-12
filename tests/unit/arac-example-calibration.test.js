/**
 * arac-example-calibration.test.js
 * ────────────────────────────────
 * ÖRNEK FİLOSUNUN iSCAAN KALİBRASYONU — sayısal çekirdek kapısı.
 *
 * `arac-example.test.js` örneklerin YAPISINI koruyor (kayıt defteri ↔ disk,
 * zincir tamlığı). Ama hiçbir test örneklerin ÇALIŞTIRILDIĞINDA hâlâ iSCAAN
 * raporlarındaki sayıları verdiğini kontrol etmiyordu. Çözücüde yapılan bir
 * değişiklik on beş örneği birden sessizce kaydırabilir ve "makul ama yanlış"
 * sonuç üretebilirdi — gözle yakalanmaz.
 *
 * Burada örnek JSON'ları gerçek `veGetPowertrainChain` yoluyla yüklenip
 * `veFTRunSimulationEngine` ile koşturuluyor ve İKİ çıpa raporla ölçülüyor:
 *
 *   1) STALL MOTOR DEVRİ — duran araçtaki konvertör denge noktası.
 *      Kaynak: raporun "Gear F1 (Ratio = …) - Converter Mode" tablosunun
 *      SR = 0.000 satırındaki Engine Speed.
 *
 *   2) AZAMİ HIZ — düz yolda tavan.
 *      Kaynak: "Vehicle Performance Summary". DİKKAT: hızlanma tablosunun son
 *      satırı tavan hız DEĞİLDİR (o tablo ivme ihmal edilebilir olunca biter),
 *      bu yüzden Performance Summary kullanılıyor. Rapor her kademe için İKİ
 *      değer basıyor — fan On (düşük) ve fan Off (yüksek); doğru sonuç bu
 *      bandın içindedir.
 *
 * Karşılaştırma R.solverStats.maxSpeed_kmh üzerinden yapılır; R.speed dizisinin
 * SONUNDA Allison rapor biçimi için eklenen "statik uzantı" satırları var
 * (v_max ötesi droop bölgesi) ve Math.max(R.speed) onları da görür.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const SRC = ['numerics.js', 'cp-engine.js', 'cp-gearbox.js', 'cp-accessories.js',
             'ft-performance.js', 'solver-pro.js'];

/**
 * iSCAAN referansları — her satırın kaynağı ilgili bundled rapordur.
 * stall  : Converter Mode / Gear F1 / SR=0.000 satırındaki motor devri [rpm]
 * kademe : { transfer oranı: [tavan hız fan-On, fan-Off] }  [km/h]
 */
const ISCAAN = {
  turan:            { rapor: '497-A321222-1', stall: 2204, kademe: { 1.257: [116.2, 116.9], 2.337: [62.8, 62.9] } },
  tta2:             { rapor: '497-A299082-1', stall: 1745, kademe: { 1.054: [110.3, 117.9], 2.337: [52.6, 53.2] } },
  isb340_tc411:     { rapor: '497-A380684-1', stall: 2733, kademe: { 1.090: [133.0, 134.1], 2.470: [59.1, 59.2] } },
  isb340_tc413:     { rapor: '497-A380787-1', stall: 2204, kademe: { 1.090: [133.0, 134.1], 2.470: [59.1, 59.2] } },
  isg430_4000sp:    { rapor: '497-A392415-1', stall: 1398, kademe: { 0.874: [97.7, 101.7], 1.536: [57.1, 57.8] } },
  bmc10ton_380_32t: { rapor: '497-A355435-1', stall: 1526, kademe: { 0.874: [92.3, 96.1], 1.536: [54.0, 54.7] } },
  bmc10ton_380_30t: { rapor: '497-A355294-1', stall: 1526, kademe: { 0.874: [92.4, 96.1], 1.536: [54.0, 54.7] } },
  bmc10ton_400:     { rapor: '497-A355436-1', stall: 1551, kademe: { 0.874: [92.5, 96.2], 1.536: [54.0, 54.7] } },
  bmc10ton_430_30t: { rapor: '497-A355437-1', stall: 1581, kademe: { 0.874: [92.9, 96.2], 1.536: [54.1, 54.7] } },
  bmc10ton_430_32t: { rapor: '497-A355438-1', stall: 1581, kademe: { 0.874: [92.8, 96.2], 1.536: [54.1, 54.7] } },
  bmc10ton_460:     { rapor: '497-A355439-1', stall: 1621, kademe: { 0.874: [94.0, 96.9], 1.536: [54.6, 55.1] } },
  // ── BİLİNEN AYKIRILAR ──
  // Bantları GENİŞ ama SABİT: bugünkü sapmayı dondururlar, büyümesine izin
  // vermezler. Daralttıkça iyileşme ölçülebilir olsun diye ayrı tutuldular.
  // duramax KÖK NEDENİ BULUNDU (düzeltme henüz YOK — aş. gerekçe):
  //
  // MFSim motor eğrisini PCHIP ile ara değerliyor, iSCAAN DOĞRUSAL ara
  // değerliyor. Bu fark yalnız eğrinin dik olduğu yerde önem kazanır ve L5D
  // Duramax'ın eğrisi tam stall bölgesinde neredeyse basamak:
  //     1000 rpm → 271.0 N·m ,  1200 rpm → 583.0 N·m   (200 rpm'de +%115)
  // 1023 rpm'de PCHIP 285.4, doğrusal 306.9 verir — %7.0 fark. Raporun
  // eşleme tablosundaki net tork (249.8) doğrusal ara değerlemeyle birebir
  // oturuyor (249.5), PCHIP'le oturmuyor. Düşük brüt tork → düşük net tork →
  // denge daha düşük devirde kuruluyor: 960 vs 1023.
  //
  // NEDEN DÜZELTİLMEDİ: motor eğrisini doğrusala çevirmeyi ölçtüm. Stall
  // düzeliyor (duramax 960→990, isb340_tc411 2750→2735 yani +%0.6→+%0.07)
  // AMA tavan hız bütün filoda düşüyor ve birkaçı iSCAAN bandının ALTINA
  // çıkıyor (tta2 111.9→109.9 vs bant 110.3; duramax 133.5→133.0 vs 133.3),
  // duramax'ın 0-20'si de −%25'ten −%32'ye kötüleşiyor. Net etki NEGATİF,
  // bu yüzden değiştirilmedi. Çözüm ara değerlemeyi değiştirmekse gerisinin
  // yeniden kalibre edilmesi gerekiyor — ayrı ve büyük bir iş.
  duramax:          { rapor: '497-A425591-1', stall: 1023, stallTol: 0.07, kademe: { 1.000: [133.3, 141.9], 2.470: [57.1, 57.4] },
                      not: 'Stall %6.2 düşük (960 vs 1023) — kök neden: PCHIP↔doğrusal ara değerleme farkı, ' +
                           'motor eğrisi 1000→1200 arasında %115 sıçrıyor ve stall tam orada.' },
  ypa4x4:           { rapor: '497-A336126-1', stall: 2036, stallTol: 0.04, kademe: { 3.430: [120.2, 136.8] }, vmaxTol: 0.6,
                      not: '9 vitesli 2957 SP. Stall %3.1 yüksek. Ayrıca durum makinesi raporun 1. viteste ' +
                           'kilitlenmesini (1C→1L→2L) temsil edemiyor.' },
};

/**
 * HIZLANMA ÇIPALARI — 0-20/40/60/80 km/h [s], kademe oranına göre.
 *
 * Stall ve tavan hız QUASİ-STATİK uçlardır: eylemsizlik ikisini de
 * etkilemez, dişli verimi tavana ancak kıl payı dokunur. Yani yukarıdaki iki
 * çıpa geçici rejimi HİÇ korumuyor — bunu mutasyon testiyle doğruladım
 * (I_conv_turbine 0.3→1.2 ve I_trans 1.0→3.0 değişiklikleri o testleri
 * kırmıyordu). Geçici rejimin bekçisi bu blok.
 *
 * Değerler MFSim'in BUGÜNKÜ ölçümü (altın çıpa), yanlarında iSCAAN referansı.
 * Amaç ikisini eşitlemek değil — farkın SESSİZCE büyümemesi.
 */
const HIZLANMA = {
  turan:            { 1.257: [1.60, 5.41, 11.71, 21.25], 2.337: [1.69, 5.59, 12.10, null] },
  tta2:             { 1.054: [2.48, 7.84, 16.98, 31.92], 2.337: [2.12, 7.45, null, null] },
  isb340_tc411:     { 1.090: [1.63, 5.55, 11.67, 21.25], 2.470: [1.70, 5.68, 12.53, null] },
  isb340_tc413:     { 1.090: [1.64, 5.56, 11.69, 21.27], 2.470: [1.72, 5.70, 12.55, null] },
  isg430_4000sp:    { 0.874: [2.84, 9.23, 20.58, 38.32], 1.536: [2.48, 8.98, 26.05, null] },
  bmc10ton_380_32t: { 0.874: [3.27, 11.04, 24.69, 48.14], 1.536: [2.94, 10.77, null, null] },
  bmc10ton_380_30t: { 0.874: [3.07, 10.36, 23.09, 44.79], 1.536: [2.78, 10.12, null, null] },
  bmc10ton_400:     { 0.874: [3.15, 10.63, 23.60, 45.40], 1.536: [2.82, 10.29, null, null] },
  bmc10ton_430_30t: { 0.874: [2.83, 9.57, 21.17, 39.62], 1.536: [2.56, 9.25, null, null] },
  bmc10ton_430_32t: { 0.874: [3.01, 10.20, 22.63, 42.52], 1.536: [2.71, 9.83, null, null] },
  bmc10ton_460:     { 0.874: [2.85, 9.47, 20.81, 38.63], 1.536: [2.55, 9.09, null, null] },
  duramax:          { 1.000: [1.70, 4.10, 8.01, 13.68], 2.470: [1.56, 4.20, 12.87, null] },
  ypa4x4:           { 3.430: [1.56, 5.08, 10.99, 20.54] },
};

/** Aynı noktalarda iSCAAN'ın kendi hızlanma tablosu (kalibrasyon cetveli). */
const HIZLANMA_ISCAAN = {
  turan:            { 1.257: [1.61, 5.45, 11.66, 21.03], 2.337: [1.63, 5.44, 11.58, null] },
  tta2:             { 1.054: [2.55, 7.88, 16.88, 31.66], 2.337: [2.13, 7.24, null, null] },
  isb340_tc411:     { 1.090: [1.71, 5.61, 11.65, 21.14], 2.470: [1.60, 5.45, null, null] },
  isb340_tc413:     { 1.090: [1.71, 5.61, 11.65, 21.14], 2.470: [1.70, 5.54, null, null] },
  isg430_4000sp:    { 0.874: [3.06, 9.52, 21.03, 38.86], 1.536: [2.73, 9.31, null, null] },
  bmc10ton_380_32t: { 0.874: [3.50, 11.44, 25.22, 48.96], 1.536: [3.22, 11.10, null, null] },
  bmc10ton_380_30t: { 0.874: [3.27, 10.70, 23.59, 45.52], 1.536: [3.02, 10.50, null, null] },
  bmc10ton_400:     { 0.874: [3.38, 10.99, 24.09, 46.12], 1.536: [3.07, 10.60, null, null] },
  bmc10ton_430_30t: { 0.874: [3.05, 9.90, 21.63, 40.24], 1.536: [2.77, 9.51, null, null] },
  bmc10ton_430_32t: { 0.874: [3.17, 10.54, 23.05, 43.18], 1.536: [2.98, 10.11, null, null] },
  bmc10ton_460:     { 0.874: [2.97, 9.70, 21.16, 39.05], 1.536: [2.73, 9.31, null, null] },
  duramax:          { 1.000: [2.27, 4.72, 8.65, 14.33], 2.470: [1.69, 4.26, null, null] },
  ypa4x4:           { 3.430: [1.51, 4.95, 10.70, 20.01] },
};

/** Örneği gerçek zincir çözümüyle koştur; kademe başına sonuç döndür. */
function runExample(file) {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, parseFloat, parseInt, isNaN, isFinite,
    Number, String, Array, Object, Date, RegExp, Error, Boolean, Map, Set,
    setTimeout: () => {},
  };
  ctx.window = ctx; ctx.global = ctx;
  ['showToast', 'saveState', 'updateProperties', 'render', 'veResetChartView', 'veUpdateStatusBar']
    .forEach(f => { ctx[f] = () => {}; });
  ctx.veActiveModule = 'full-throttle';
  ctx.COMPONENT_SIGNALS = {};
  ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }) };
  vm.createContext(ctx);
  SRC.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f }));

  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  ctx.nodes = j.nodes;
  ctx.connections = j.connections;
  return vm.runInContext(`(function() {
    var tr = nodes.find(function(n) { return n.type === 'transfer'; });
    var gears = tr ? tr.data.ftTrGears : [{ kademe: 'tek', ratio: 1 }];
    return gears.map(function(g) {
      var R = veFTRunSimulationEngine(g.kademe);
      var at = function(v) {
        for (var i = 1; i < R.speed.length; i++) {
          if (R.speed[i - 1] <= v && R.speed[i] >= v) {
            var q = R.speed[i] > R.speed[i - 1] ? (v - R.speed[i - 1]) / (R.speed[i] - R.speed[i - 1]) : 0;
            return R.time[i - 1] + q * (R.time[i] - R.time[i - 1]);
          }
        }
        return null;
      };
      return { ratio: parseFloat(g.ratio),
               vmax: R.solverStats.maxSpeed_kmh,
               stall: R.settledStall && R.settledStall.N_engine,
               accel: [at(20), at(40), at(60), at(80)] };
    });
  })()`, ctx);
}

const IDS = Object.keys(ISCAAN);
const sonuc = {};
beforeAll(() => {
  IDS.forEach(id => {
    sonuc[id] = runExample(path.join(ROOT, 'assets', 'examples', `ap_${id}_topoloji.json`));
  });
}, 300000);

describe('stall motor devri — duran araçtaki konvertör denge noktası', () => {
  test.each(IDS)('%s', id => {
    const ref = ISCAAN[id];
    const tol = ref.stallTol || 0.015;          // aykırı olmayanlarda %1.5
    const got = sonuc[id][0].stall;
    expect(got).toBeGreaterThan(0);
    // Kademe stall'ı değiştirmez (araç duruyor) — bütün kademeler aynı olmalı
    sonuc[id].forEach(r => expect(r.stall).toBe(got));
    expect(Math.abs(got - ref.stall) / ref.stall).toBeLessThan(tol);
  });

  test('aykırı olmayan on bir örnekte sapma %1’in altında', () => {
    // Bu kapı toplu kaymayı yakalar: tek tek %1.5 bandını geçmeyen ama hepsi
    // birden aynı yöne kayan bir regresyon burada kırmızıya döner.
    const sapma = IDS.filter(id => !ISCAAN[id].stallTol).map(id => {
      const r = ISCAAN[id];
      return { id: id, e: 100 * (sonuc[id][0].stall - r.stall) / r.stall };
    });
    expect(sapma.length).toBe(11);
    sapma.forEach(s => expect(Math.abs(s.e)).toBeLessThan(1.0));
    const ort = sapma.reduce((a, b) => a + b.e, 0) / sapma.length;
    expect(Math.abs(ort)).toBeLessThan(0.6);
  });
});

describe('azami hız — iSCAAN Performance Summary bandında', () => {
  test.each(IDS)('%s', id => {
    const ref = ISCAAN[id];
    const tol = ref.vmaxTol || 0.5;             // km/h; bant dışına taşma payı
    Object.keys(ref.kademe).forEach(oranStr => {
      const oran = parseFloat(oranStr);
      const [lo, hi] = ref.kademe[oranStr];
      const m = sonuc[id].find(r => Math.abs(r.ratio - oran) < 0.02);
      expect(m).toBeTruthy();
      expect(m.vmax).toBeGreaterThan(lo - tol);
      expect(m.vmax).toBeLessThan(hi + tol);
    });
  });

  test('yirmi beş kademe ölçümünün tamamı kapsanıyor', () => {
    // Kademe eşleşmesi sessizce düşerse yukarıdaki testler boş geçerdi.
    const n = IDS.reduce((s, id) => s + Object.keys(ISCAAN[id].kademe).length, 0);
    expect(n).toBe(25);   // 12 örnek × 2 kademe + ypa4x4 tek kademe
    IDS.forEach(id => Object.keys(ISCAAN[id].kademe).forEach(o => {
      expect(sonuc[id].some(r => Math.abs(r.ratio - parseFloat(o)) < 0.02)).toBe(true);
    }));
  });
});

describe('bilinen aykırılar dondurulmuş — sessizce büyümesinler', () => {
  // Bu iki örnek raporla tam oturmuyor; kök nedenleri AÇIK İŞ. Testin amacı
  // düzeltmek değil, bugünkü sapmayı ölçülü tutmak.
  test('duramax stall’ı %5–7 düşük kalıyor (960 / iSCAAN 1023)', () => {
    const e = 100 * (sonuc.duramax[0].stall - 1023) / 1023;
    expect(e).toBeLessThan(-5);
    expect(e).toBeGreaterThan(-7);
  });

  test('ypa4x4 stall’ı %2–4 yüksek kalıyor (2100 / iSCAAN 2036)', () => {
    const e = 100 * (sonuc.ypa4x4[0].stall - 2036) / 2036;
    expect(e).toBeGreaterThan(2);
    expect(e).toBeLessThan(4);
  });
});

describe('hızlanma — geçici rejim çıpaları', () => {
  const NOKTA = ['0-20', '0-40', '0-60', '0-80'];

  test.each(Object.keys(HIZLANMA))('%s — altın çıpadan %%2’den fazla kaymadı', id => {
    Object.keys(HIZLANMA[id]).forEach(oranStr => {
      const beklenen = HIZLANMA[id][oranStr];
      const m = sonuc[id].find(r => Math.abs(r.ratio - parseFloat(oranStr)) < 0.02);
      expect(m).toBeTruthy();
      beklenen.forEach((b, i) => {
        if (b == null) return;
        expect(m.accel[i]).not.toBeNull();
        expect(Math.abs(m.accel[i] - b) / b).toBeLessThan(0.02);
      });
    });
  });

  test('iSCAAN’a göre ortalama mutlak sapma %4’ün altında (kalibrasyon mandalı)', () => {
    // Mandal: kalibrasyon iyileştikçe bu eşik DARALTILIR. Bugün ölçülen %3.6.
    // duramax dahil — aykırıyı dışarıda bırakıp "iyi görünmek" istemiyoruz.
    const e = [];
    Object.keys(HIZLANMA_ISCAAN).forEach(id => {
      Object.keys(HIZLANMA_ISCAAN[id]).forEach(oranStr => {
        const ref = HIZLANMA_ISCAAN[id][oranStr];
        const m = sonuc[id].find(r => Math.abs(r.ratio - parseFloat(oranStr)) < 0.02);
        ref.forEach((s, i) => {
          if (s == null || m.accel[i] == null) return;
          e.push(Math.abs(100 * (m.accel[i] - s) / s));
        });
      });
    });
    expect(e.length).toBeGreaterThan(60);
    expect(e.reduce((a, b) => a + b, 0) / e.length).toBeLessThan(4.0);
  });

  test('duramax dışında hiçbir noktada sapma %10’u geçmiyor', () => {
    const kotu = [];
    Object.keys(HIZLANMA_ISCAAN).filter(id => id !== 'duramax').forEach(id => {
      Object.keys(HIZLANMA_ISCAAN[id]).forEach(oranStr => {
        const ref = HIZLANMA_ISCAAN[id][oranStr];
        const m = sonuc[id].find(r => Math.abs(r.ratio - parseFloat(oranStr)) < 0.02);
        ref.forEach((s, i) => {
          if (s == null || m.accel[i] == null) return;
          const d = 100 * (m.accel[i] - s) / s;
          if (Math.abs(d) > 10) kotu.push(`${id} ${oranStr} ${NOKTA[i]}: ${d.toFixed(1)}%`);
        });
      });
    });
    expect(kotu).toEqual([]);
  });
});
