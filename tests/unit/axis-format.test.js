/**
 * Eksen etiketi biçimlendirme — js/graphics.js
 * ────────────────────────────────────────────
 * Eksen basamak sayısı ADIMA göre BİR KEZ belirlenir; her etiket aynı
 * basamakla yazılır. Eskiden basamak DEĞER BAŞINA seçiliyordu, bu yüzden
 * eksen "60.0  80.0  100  120" diye okunuyordu: aynı eksende iki farklı
 * basamak düzeni.
 *
 * Burada sessiz bir kayma "makul ama yanlış" bir eksen üretir — grafik
 * çalışır görünür, sayılar tutarsız okunur. Gözle ancak o eksen o aralıkta
 * çizilirse fark edilir; testin karşılığı burada.
 */
const src = loadSource('graphics.js');

// graphics.js üst-seviye fonksiyon bildiriyor; yalnız ilgili iki saf
// fonksiyonu kapsama alıyoruz (dosyanın tamamı DOM'a dokunuyor).
const veAxisDecimals = new Function(
  src.slice(src.indexOf('function veAxisDecimals')) + '\nreturn veAxisDecimals;'
)();
const veFormatAxisVal = new Function(
  src.slice(src.indexOf('function veFormatAxisVal')) + '\nreturn veFormatAxisVal;'
)();

describe('veAxisDecimals — basamak sayısı adımdan gelir', () => {
  test('tam sayı adımlar basamak istemez', () => {
    [1, 2, 5, 10, 20, 50, 100, 1000].forEach((s) => expect(veAxisDecimals(s)).toBe(0));
  });

  test('ondalık adımlar kendi basamağını ister', () => {
    expect(veAxisDecimals(0.5)).toBe(1);
    expect(veAxisDecimals(0.2)).toBe(1);
    expect(veAxisDecimals(0.05)).toBe(2);
    expect(veAxisDecimals(0.02)).toBe(2);
    expect(veAxisDecimals(0.005)).toBe(3);
  });

  test('işaret önemsiz — mutlak değere bakılır', () => {
    expect(veAxisDecimals(-0.05)).toBe(veAxisDecimals(0.05));
  });

  test('geçersiz adım çökmez, 0 döner', () => {
    [0, -1, NaN, Infinity, undefined, null].forEach((s) => {
      expect(veAxisDecimals(s)).toBe(0);
    });
  });
});

describe('veFormatAxisVal — aynı eksende basamak sayısı DEĞİŞMEZ', () => {
  // Asıl regresyon: 20 adımlı bir eksende 60/80/100/120 etiketleri.
  test('20 adımlı eksende hiçbir etiket ondalık taşımaz', () => {
    const dec = veAxisDecimals(20);
    const etiketler = [60, 80, 100, 120].map((v) => veFormatAxisVal(v, dec));
    expect(etiketler).toEqual(['60', '80', '100', '120']);
  });

  test('0,5 adımlı eksende her etiket tek basamaklı', () => {
    const dec = veAxisDecimals(0.5);
    const etiketler = [0, 0.5, 1, 1.5, 2].map((v) => veFormatAxisVal(v, dec));
    expect(etiketler).toEqual(['0.0', '0.5', '1.0', '1.5', '2.0']);
  });

  test('sıfır ile büyük değer aynı eksende aynı basamağı alır', () => {
    const dec = veAxisDecimals(0.05);
    expect(veFormatAxisVal(0, dec)).toBe('0.00');
    expect(veFormatAxisVal(0.25, dec)).toBe('0.25');
    expect(veFormatAxisVal(4, dec)).toBe('4.00');
  });

  test('negatif değerler de aynı basamakla yazılır', () => {
    const dec = veAxisDecimals(0.5);
    expect(veFormatAxisVal(-1, dec)).toBe('-1.0');
    expect(veFormatAxisVal(-0.5, dec)).toBe('-0.5');
  });

  test('10 binin üstünde tam sayı eksende k kısaltması korunur', () => {
    expect(veFormatAxisVal(20000, 0)).toBe('20k');
    expect(veFormatAxisVal(150000, 0)).toBe('150k');
  });

  test('ondalıklı eksende k kısaltmasına DÜŞMEZ (basamak bilgisi kaybolmasın)', () => {
    expect(veFormatAxisVal(20000, 1)).toBe('20000.0');
  });

  test('adım verilmezse eski davranış korunur (geriye dönük)', () => {
    // Çağrı yerlerinden biri güncellenmezse sessizce bozulmasın diye
    // parametresiz yol hâlâ çalışıyor olmalı.
    expect(veFormatAxisVal(100)).toBe('100');
    expect(veFormatAxisVal(12.5)).toBe('12.5');
    expect(veFormatAxisVal(20000)).toBe('20k');
  });
});

// ── Sayı biçimlendirmede MFSim ↔ Görüntüleyici uzlaşması ────────────────────
//
// Aynı iki fonksiyonun iki kopyası var (js/graphics.js ve viewer/js/board.js)
// ve BİRBİRİNDEN AYRI DÜZELTİLMİŞLERDİ: her birinde ötekinin bilmediği bir
// düzeltme vardı. Ölçüldü, ikisi de birleştirildi; testler ikisini birden
// koruyor ki tekrar ayrışmasınlar.
const boardSrc = loadViewerSource('board.js');
const vFormatAxisVal = new Function(
  boardSrc.slice(boardSrc.indexOf('function veFormatAxisVal')) + '\nreturn veFormatAxisVal;'
)();
const vFormatTooltipVal = new Function(
  boardSrc.slice(boardSrc.indexOf('function veFormatTooltipVal')) + '\nreturn veFormatTooltipVal;'
)();
const gFormatTooltipVal = new Function(
  src.slice(src.indexOf('function veFormatTooltipVal')) + '\nreturn veFormatTooltipVal;'
)();

const ikisi = [['MFSim', veFormatAxisVal], ['görüntüleyici', vFormatAxisVal]];
const ikisiTip = [['MFSim', gFormatTooltipVal], ['görüntüleyici', vFormatTooltipVal]];

describe('veFormatAxisVal — iki kopya da aynı davranmalı', () => {
  ikisi.forEach(([ad, f]) => {
    describe(ad, () => {
      test('KÜÇÜK değer "0.000" diye ezilmez', () => {
        // toFixed(3) burada 0,0001 ile 0,0005'i aynı etikete çeviriyordu:
        // log eksende mertebe farklı iki bölme aynı sayıyı gösteriyordu.
        // Takoz iletilebilirliği tam bu aralıkta (0,003 … 0,03).
        expect(f(0.0001)).not.toBe(f(0.0005));
        expect(f(0.0001)).toMatch(/e-/);
      });

      test('SIFIR üstel yazılmaz', () => {
        expect(f(0)).toBe('0');
      });

      test('dec > 0 iken 10000 üstü KISALTILMAZ — ondalık kaybolmaz', () => {
        // "12k" istenen ondalığı atar ve 12345,6 ile 12345,7 aynı etikete
        // düşerdi: farklı iki bölme aynı sayıyı gösterirdi.
        expect(f(12345.6, 1)).not.toBe(f(12345.7, 1));
        expect(f(12345.6, 1)).toBe('12345.6');
      });

      test('dec === 0 iken 10000 üstü kısaltılır — eski davranış', () => {
        expect(f(12345, 0)).toBe('12k');
      });
    });
  });

  test('iki kopya AYNI çıktıyı veriyor', () => {
    const girdiler = [0, -0, 0.0001, 0.004, 0.05, 1.5, 12.34, 123.4, 12345.6, -9876.5];
    girdiler.forEach((v) => {
      expect(vFormatAxisVal(v)).toBe(veFormatAxisVal(v));
      [0, 1, 2, 3].forEach((d) => expect(vFormatAxisVal(v, d)).toBe(veFormatAxisVal(v, d)));
    });
  });
});

describe('veFormatTooltipVal — iki kopya da aynı davranmalı', () => {
  ikisiTip.forEach(([ad, f]) => {
    describe(ad, () => {
      test('SIFIR düz yazılır — "0.00e+0" değil', () => {
        // Tabloda gerçekten görüldü: hızın t=0 anındaki değeri "0.00e+0"
        // yazıyordu, komşu satırlar "0.068" iken.
        expect(f(0)).toBe('0');
      });

      test('METİN kanalı çökertmez — kendi değeri döner', () => {
        // Vites modu '1C'/'2L' gibi metin üretiyor; korumasız toExponential
        // "v.toExponential is not a function" ile patlıyordu.
        expect(() => f('1C')).not.toThrow();
        expect(f('1C')).toBe('1C');
      });

      test('boş/eksik/sonsuz değerler için tire', () => {
        [null, undefined, NaN, Infinity, -Infinity].forEach((v) => {
          expect(f(v)).toBe('—');
        });
      });

      test('küçük sayı üstel kalır — bilgi kaybolmaz', () => {
        expect(f(0.004)).toBe('4.00e-3');
      });
    });
  });

  test('iki kopya AYNI çıktıyı veriyor', () => {
    [0, -0, 0.004, 0.05, 1.5, 123.4, 12345.6, '1C', '', null, undefined, NaN, Infinity]
      .forEach((v) => expect(vFormatTooltipVal(v)).toBe(gFormatTooltipVal(v)));
  });
});

// ── Panel grafiklerinin eksen bölmeleri ─────────────────────────────────────
//
// Motor ve Tork Konvertörü panelleri (ve yol profili) ekseni görünen aralığı
// dörde bölerek çiziyordu: 1265 · 949 · 633 · 316, 418.4 · 335.2 · 252.0.
// Ölçüldü (gerçek tarayıcı, tuvale yazılan her metin): 10 panel ekseninin 6'sı
// yuvarlak değildi; raporların 21 ekseninin hepsi yuvarlaktı. Paneller artık
// raporların adım kuralını paylaşan tek yardımcıdan geçiyor.
const veEksenBolme = new Function(
  src.slice(src.indexOf('function veNiceStep')) + '\nreturn veEksenBolme;'
)();
const yuvarlak = (adim) => {
  const m = Math.pow(10, Math.floor(Math.log10(adim) + 1e-9));
  return [1, 2, 5, 10].some((k) => Math.abs(adim / m - k) < 1e-9);
};

describe('veEksenBolme — panel eksenleri yuvarlak adımla', () => {
  test('ölçülen eski eksenler yuvarlak bölmeye oturuyor', () => {
    expect(veEksenBolme(0, 1265, 5).degerler).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
    expect(veEksenBolme(800, 2830, 5).degerler).toEqual([1000, 1500, 2000, 2500]);
    expect(veEksenBolme(85.6, 418.4, 5).degerler).toEqual([100, 150, 200, 250, 300, 350, 400]);
    const tau = veEksenBolme(0, 3.1, 5);
    expect(tau.degerler).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
    expect(tau.basamak).toBe(1);
  });

  test('aralık GENİŞLETİLMEZ: her bölme görünen aralığın içinde', () => {
    [[0, 1265], [800, 2830], [85.6, 418.4], [0.137, 0.583], [-12.5, 47.3], [812.4, 861.9]].forEach(([a, b]) => {
      veEksenBolme(a, b, 5).degerler.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(a - 1e-9);
        expect(v).toBeLessThanOrEqual(b + 1e-9);
      });
    });
  });

  test('yakınlaştırılmış pencerede de yuvarlak (0.137 … 0.583)', () => {
    const b = veEksenBolme(0.137, 0.583, 5);
    expect(b.degerler).toEqual([0.2, 0.3, 0.4, 0.5]);
    expect(b.basamak).toBe(1);
  });

  test('kayan nokta artığı etikete sızmaz (0.30000000000000004 yok)', () => {
    const b = veEksenBolme(0, 0.3, 3);
    expect(b.degerler).toEqual([0, 0.1, 0.2, 0.3]);
    b.degerler.forEach((v) => expect(String(v).length).toBeLessThanOrEqual(4));
  });

  test('ters sıralı ve dejenere girdi çökmez', () => {
    expect(veEksenBolme(1265, 0, 5).degerler).toEqual(veEksenBolme(0, 1265, 5).degerler);
    expect(veEksenBolme(5, 5, 5).degerler).toEqual([5]);
    expect(veEksenBolme(NaN, 5, 5).degerler).toEqual([]);
  });

  test('rastgele 500 aralıkta: adım 1·2·5 × 10^n, her değer adımın tam katı, 2–12 bölme', () => {
    let tohum = 7;
    const r = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };
    for (let i = 0; i < 500; i++) {
      const olcek = Math.pow(10, Math.floor(r() * 8) - 3);
      const a = (r() - 0.3) * olcek * 10, b = a + (0.05 + r()) * olcek * 10;
      const x = veEksenBolme(a, b, 5);
      expect(yuvarlak(x.adim)).toBe(true);
      expect(x.degerler.length).toBeGreaterThanOrEqual(2);
      expect(x.degerler.length).toBeLessThanOrEqual(12);
      x.degerler.forEach((v) => expect(Math.abs(v / x.adim - Math.round(v / x.adim))).toBeLessThan(1e-6));
    }
  });
});

describe('panel grafikleri eksenini veEksenBolme\'den alıyor (kaynak kapısı)', () => {
  // Çizim tuvalde; jsdom'da tuval yok. Kapı kaynağa bakar: eski "aralığı
  // dörde böl" döngüleri geri gelmesin ve her eksen yardımcıdan geçsin.
  const DOSYALAR = [
    ['cp-engine.js', 6],            // iki grafik × (devir · tork · güç)
    ['cp-torque-converter.js', 5],  // τ grafiği (SR · τ · η) + K grafiği (SR · K)
    ['component-extras.js', 2],     // yol profili (irtifa · mesafe)
  ];
  DOSYALAR.forEach(([dosya, en_az]) => {
    test(dosya, () => {
      const s = loadSource(dosya);
      expect((s.match(/veEksenBolme\(/g) || []).length).toBeGreaterThanOrEqual(en_az);
      // Eski kalıplar: "xMin + (xMax - xMin) * i / 4", "yMaxTorque * i / 4", "(lx / 4)"
      expect(s).not.toMatch(/\*\s*i\s*\/\s*[45]\b/);
      expect(s).not.toMatch(/\(\s*l[xy]\s*\/\s*4\s*\)/);
    });
  });

  test('Tork Konvertörü tuvale BEYAZ çizmiyor (açık temada görünmüyordu)', () => {
    // "Coupling" çizgisi ve yazısı beyaz %25/%40, ızgara beyaz %5 idi:
    // açık temanın zemininde üçü de yoktu.
    ['cp-torque-converter.js', 'cp-engine.js'].forEach((dosya) => {
      expect(loadSource(dosya)).not.toMatch(/(fill|stroke)Style\s*=\s*'rgba\(255,\s*255,\s*255/);
    });
  });
});
