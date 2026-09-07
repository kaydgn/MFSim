/**
 * pchip-uc-kopya.test.js — TEK ALGORİTMANIN ÜÇ AYRI YAZIMI
 *
 * NEDEN VAR: Aynı Fritsch–Carlson monoton kübik Hermite (PCHIP) matematiği
 * depoda ÜÇ ayrı yerde yazılı ve hiçbiri diğerine bağlı değil:
 *
 *   A  js/numerics.js       veBuildPchipSpline / veEvalPchip / veEvalPchipDeriv
 *      → Motor Freni modu (simulation-engine.js: tork eğrisi ve dT/dRPM),
 *        Takoz kütüphane kartı kuvvet-sehim grafiği (cp-mount.js)
 *   B  js/ft-performance.js pchipCreate / _pchipEndSlope / pchipEval
 *      → Tam Gaz modu: motor torku, konvertör K-faktörü ve tau
 *   C  js/mount-core.js     buildMonotoneCubic
 *      → Takoz Newton çözücüsü, modal frekanslar, fdefl sinyal kanalı
 *
 * (Adresler bilerek satır numarasız: bu dosyanın kendi başlığı bir kez
 *  kaydığında numaralar çürüdü — fonksiyon adı çürümüyor.)
 *
 * mount-core.js:299 yorumu zaten "numerics.js veBuildPchipSpline ile AYNI"
 * diyordu — ama bunu tutan hiçbir test YOKTU. Bu SESSİZ bir kusur sınıfı:
 * biri düzeltilince diğer ikisi eskir, her dosya kendi başına doğru kaldığı
 * için hiçbir davranış testi kırmızıya dönmez, ve aynı motor eğrisi Motor
 * Freni modunda başka, Tam Gaz modunda başka tork verir.
 *
 * ÖLÇÜLDÜ: iç nokta türevleri üçünde birebir aynı (max fark 5,7e-14). Ayrışma
 * UÇ EĞİMDEYDİ — ft-performance.js `d * del1 < 0` yazıyordu, diğer ikisi
 * `<= 0`. Referans (MATLAB/SLATEC pchipend) `sign(d) ~= sign(del1)` kullanır
 * ve sign(0) = 0 olduğu için uç aralık DÜZ iken ateşler; kesin `<` çarpım tam
 * sıfır olduğu için onu kaçırıyordu. 400.000 rastgele girdide referanstan
 * sapma: A 0 · C 0 · B 58.797. Sevk edilen veride ap_isb340_tc411
 * konvertörünün tau(SR) tablosu bu durumu tetikliyordu.
 *
 * Bu test o sessizliği bozar. Kapı ÜÇ ŞEYİ birden tutuyor:
 *   1. Tablo İÇİNDE (n>=3) üç kopya aynı eğriyi verir — gerçek MFSim
 *      verisinin TAMAMI taranarak.
 *   2. Düz uç aralıklı tabloda şekil koruma bozulmaz (düzeltmenin çivisi).
 *   3. BİLEREK ayrık üç nokta olduğu gibi durur — kapı onları eşitlemeye
 *      çalışmaz, aksine ayrı olduklarını İDDİA eder, ki biri sessizce
 *      "düzeltilirse" burası konuşsun.
 */
const fs = require('fs');
const path = require('path');

const core = require('../../js/mount-core.js');   // module.exports guard'ı VAR

// numerics.js ve ft-performance.js üst-seviye bildirim kullanıyor → eval.
// (source-hygiene.test.js js/ genelinde ad çakışması olmadığını garanti
// ettiği için ikisi aynı kapsamda yan yana yaşayabiliyor.)
const stubs = stubGlobals();
eval(loadSource('numerics.js'));
eval(loadSource('ft-performance.js'));
beforeEach(() => resetStubs(stubs));

const ROOT = path.join(__dirname, '..', '..');
const TOL = 1e-9;

// ─── üç kopyayı TEK arayüze indir: kur(xs, ys) → x'te değer ────────────────
const KOPYALAR = [
  ['A js/numerics.js', (xs, ys) => {
    const s = veBuildPchipSpline(xs.map((v, i) => ({ rpm: v, torque: ys[i] })));
    return (x) => veEvalPchip(s, x);
  }],
  ['B js/ft-performance.js', (xs, ys) => {
    const s = FT_SOLVER.pchipCreate(xs.slice(), ys.slice(), 'kapı');
    return (x) => FT_SOLVER.pchipEval(s, x);
  }],
  ['C js/mount-core.js', (xs, ys) => {
    const s = core.buildMonotoneCubic(xs.slice(), ys.slice());
    return (x) => s.eval(x);
  }],
];

/**
 * Tablo İÇİNDE üç kopyayı 200 noktada karşılaştırır. İlk ayrışmayı ADRESİYLE
 * döndürür — "eşit değil" demekten çok daha kullanışlı.
 */
function ilkAyrisma(xs, ys) {
  const f = KOPYALAR.map(([ad, kur]) => [ad, kur(xs, ys)]);
  const x0 = xs[0], x1 = xs[xs.length - 1];
  for (let k = 0; k <= 200; k++) {
    const x = x0 + (x1 - x0) * (k / 200);
    const v = f.map(([, g]) => g(x));
    for (let i = 1; i < v.length; i++) {
      const fark = Math.abs(v[i] - v[0]);
      if (fark > TOL) {
        return { x, a: f[0][0], b: f[i][0], va: v[0], vb: v[i], fark };
      }
    }
  }
  return null;
}

function bildir(baslik, d) {
  return d && `KOPYALAR AYRIŞTI — ${baslik}\n` +
              `  x        : ${d.x}\n` +
              `  ${d.a.padEnd(24)}: ${d.va}\n` +
              `  ${d.b.padEnd(24)}: ${d.vb}   (fark ${d.fark.toExponential(3)})\n` +
              `  düzeltme : uç eğim ve iç türev kuralı ÜÇ yazımda aynı olmalı —\n` +
              `             veBuildPchipSpline (js/numerics.js)\n` +
              `             _pchipEndSlope    (js/ft-performance.js)\n` +
              `             buildMonotoneCubic (js/mount-core.js)`;
}

// ─── 1. GERÇEK MFSim verisi — assets/examples'taki her sayısal tablo ───────
/** ap_*.json içindeki (x, y) çiftli sayısal tabloların tamamını toplar. */
function gercekTablolar() {
  const dizin = path.join(ROOT, 'assets', 'examples');
  const out = [];
  for (const dosya of fs.readdirSync(dizin).filter((f) => /^ap_.*\.json$/.test(f))) {
    const j = JSON.parse(fs.readFileSync(path.join(dizin, dosya), 'utf8'));
    for (const d of (j.nodes || []).map((n) => n.data || {})) {
      for (const alan of Object.keys(d)) {
        const v = d[alan];
        if (!Array.isArray(v) || v.length < 3) continue;
        if (!v[0] || typeof v[0] !== 'object') continue;
        const xk = Object.keys(v[0]).find((k) => k === 'rpm' || k === 'sr');
        if (!xk || v.some((p) => typeof p[xk] !== 'number')) continue;
        for (const yk of Object.keys(v[0])) {
          if (yk === xk || typeof v[0][yk] !== 'number') continue;
          if (v.some((p) => typeof p[yk] !== 'number')) continue;
          const xs = v.map((p) => p[xk]);
          if (xs.some((x, i) => i && x <= xs[i - 1])) continue;   // kesin artan değilse atla
          out.push([`${dosya.replace('_topoloji.json', '')} · ${alan}[${yk}]`,
                    xs, v.map((p) => p[yk])]);
        }
      }
    }
  }
  return out;
}

describe('gerçek MFSim verisi — üç kopya aynı eğriyi veriyor', () => {
  const tablolar = gercekTablolar();

  test('assets/examples taranabildi (kapı boşa koşmuyor)', () => {
    expect(tablolar.length).toBeGreaterThan(40);
  });

  test.each(tablolar)('%s', (ad, xs, ys) => {
    expect(bildir(ad, ilkAyrisma(xs, ys))).toBeNull();
  });
});

// ─── 2. DÜZ UÇ ARALIĞI — düzeltmenin çivisi ───────────────────────────────
//
// ft-performance.js'teki `<` bu tabloları yanlış çiziyordu: uç eğim
// sıfırlanmadığı için eğri platonun ALTINA sarkıyor, PCHIP'in şekil koruma
// garantisi bozuluyordu. Üçü de artık platoda düz kalmalı.
describe('düz uç aralığı — şekil koruma bozulmuyor', () => {
  const DUZ = [
    // Gerçekçi Allison/Cummins tork eğrisi: düşük devirde plato (İLK aralık düz)
    ['ilk aralık düz — tork platosu [N·m]',
     [800, 1200, 1600, 2000, 2400], [1000, 1000, 1100, 1025, 950], 1000, [900, 1000, 1100]],
    // Son aralık düz — ap_isb340_tc411 tau(SR) tablosunun tetiklediği durum
    ['son aralık düz — tork platosu [N·m]',
     [800, 1200, 1700, 1900, 2100], [900, 1600, 1700, 1200, 1200], 1200, [1950, 2000, 2050]],
  ];

  test.each(DUZ)('%s — üç kopya uyuşuyor', (ad, xs, ys) => {
    expect(bildir(ad, ilkAyrisma(xs, ys))).toBeNull();
  });

  test.each(DUZ)('%s — plato değerinden sapma yok', (ad, xs, ys, plato, ornekler) => {
    for (const [kopyaAd, kur] of KOPYALAR) {
      const f = kur(xs, ys);
      for (const x of ornekler) {
        expect(`${kopyaAd} @ x=${x}: ${f(x)} (plato ${plato})`)
          .toBe(`${kopyaAd} @ x=${x}: ${plato} (plato ${plato})`);
      }
    }
  });

  test('uç eğim kuralı: del_uç == 0 iken üç kopya da SIFIR veriyor', () => {
    // pchipCreate uç türevlerini spline'da saklıyor → doğrudan okunabiliyor.
    const xs = [0, 1, 2], ys = [0, 0, 1];          // ilk aralık düz, del0 = 0
    const sp = FT_SOLVER.pchipCreate(xs.slice(), ys.slice(), 'kapı');
    expect(sp.ds[0]).toBe(0);                       // eskiden -0.5 idi
    expect(core.buildMonotoneCubic(xs.slice(), ys.slice()).slope(0)).toBe(0);
  });
});

// ─── 3. BİLEREK AYRIK — kapı bunları EŞİTLEMEZ, ayrı olduklarını iddia eder ─
describe('bilerek ayrık kalan üç nokta', () => {
  const xs = [0, 1, 2, 3], ys = [0, 1, 4, 9];

  test('tablo DIŞI: A ve B uç değere yapışır, C doğrusal uzatır', () => {
    // C'nin doğrusal uzatması ZORUNLU: düz uzantı Newton'da K_T'yi tekilleştirip
    // çözücüyü çökertiyor (gerekçe mount-core.js:301-304). Bu bir hata değil.
    const A = KOPYALAR[0][1](xs, ys);
    const B = KOPYALAR[1][1](xs, ys);
    const C = KOPYALAR[2][1](xs, ys);

    expect(A(4)).toBeCloseTo(ys[3], 12);            // düz
    expect(B(4)).toBeCloseTo(ys[3], 12);            // düz
    expect(C(4)).toBeGreaterThan(ys[3] + 1);        // doğrusal — uç tanjantıyla taşar
  });

  test('n = 2: A null döner (veEvalPchip → 0), B ve C doğrusal', () => {
    expect(veBuildPchipSpline([{ rpm: 0, torque: 0 }, { rpm: 1, torque: 2 }])).toBeNull();
    expect(veEvalPchip(null, 0.5)).toBe(0);         // TUZAK: sessiz sıfır.
    // Çağıranlar bunu koruyor (simulation-engine.js:62, cp-mount.js:2476 n>=3).
    expect(KOPYALAR[1][1]([0, 1], [0, 2])(0.5)).toBeCloseTo(1, 12);
    expect(KOPYALAR[2][1]([0, 1], [0, 2])(0.5)).toBeCloseTo(1, 12);
  });

  test('geçersiz girdide: A sessiz, B adresli hata atıyor', () => {
    // Tek gerçek girdi doğrulaması B'de. A ve C aynı girdide sessizce
    // saçma spline üretiyor — bu fark BİLİNİYOR, kapı onu çivileyip duruyor.
    expect(() => FT_SOLVER.pchipCreate([0, 0, 1], [1, 2, 3], 'kapı')).toThrow();
    expect(() => veBuildPchipSpline(
      [{ rpm: 0, torque: 1 }, { rpm: 0, torque: 2 }, { rpm: 1, torque: 3 }])).not.toThrow();
  });
});
