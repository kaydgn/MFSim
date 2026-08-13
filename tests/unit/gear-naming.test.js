/**
 * gear-naming.test.js — ileri / geri vites ayrımı
 *
 * BULUNAN ARIZA (2026-08-13, tarayıcıda ölçüldü): örnek topoloji yüklenip
 * "Hesapla" denince çözücü ÇÖZÜM BAŞARISIZ veriyordu:
 *
 *     [1.10s]   İleri vites     : 0 adet          ← 'err' seviyesi
 *     [2.13s] KRİTİK HATA SAYISI: 1
 *     [2.13s] Simülasyon başlatılamıyor.
 *
 * Kök neden: ileri vites sayımı `name.charAt(0) === 'F'` bakıyordu. Bu kural
 * yalnız uygulamanın VARSAYILAN tablosuna uyuyor ('F1'…'F6','R1'); örnekler ve
 * iSCAAN raporları Allison adlandırması kullanıyor ('1C','2C','3L','4L'…).
 * Dolayısıyla YÜKLENEN HER ÖRNEKTE ileri vites 0 sayılıyor ve simülasyon hiç
 * başlamıyordu. (Fizik doğruydu: ft-performance.js ayrı bir yol kullanıyor —
 * bu yüzden birim kalibrasyon testleri yeşil kalıyordu ve arıza yalnız
 * arayüzde görünüyordu.)
 *
 * Düzeltme: ayrım tek yerden — cp-gearbox.js veIsForwardGear / veIsReverseGear.
 */

const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
eval(loadSource('cp-gearbox.js'));

describe('veIsForwardGear / veIsReverseGear — iki adlandırma da tanınır', () => {
  test('uygulamanın varsayılan tablosu (F1…F6, R1)', () => {
    expect(VE_FT_GB_DEFAULT_GEARS.filter(veIsForwardGear).length).toBe(6);
    expect(VE_FT_GB_DEFAULT_GEARS.filter(veIsReverseGear).length).toBe(1);
  });

  // ESKİ kodun kırıldığı yer: bu adlandırmada 0 ileri vites sayılıyordu.
  test('Allison adlandırması (1C, 2C, 3L, 4L, 5L, 6L)', () => {
    const gears = [
      { name: '1C', ratio: 3.487 }, { name: '2C', ratio: 1.864 },
      { name: '3L', ratio: 1.409 }, { name: '4L', ratio: 1.0 },
      { name: '5L', ratio: 0.75 },  { name: '6L', ratio: 0.652 }
    ];
    expect(gears.filter(veIsForwardGear).length).toBe(6);
    expect(gears.filter(veIsReverseGear).length).toBe(0);
  });

  test('preset veritabanının "gear" alanı da çözülür', () => {
    const g = VE_GEARBOX_PRESETS['4500SP'].gears;
    expect(g.filter(function (x) { return veIsForwardGear(x, 'gear'); }).length).toBe(6);
    expect(g.filter(function (x) { return veIsReverseGear(x, 'gear'); }).length).toBe(1);
  });

  test('geri vites: adı R ile başlıyorsa ORANI POZİTİF olsa da geridir', () => {
    expect(veIsReverseGear({ name: 'R1', ratio: 5.026 })).toBe(true);
    expect(veIsForwardGear({ name: 'R1', ratio: 5.026 })).toBe(false);
    expect(veIsReverseGear({ name: 'R', ratio: 4.0 })).toBe(true);
  });

  test('geri vites: adı yoksa NEGATİF orandan anlaşılır', () => {
    expect(veIsReverseGear({ name: '', ratio: -5.03 })).toBe(true);
    expect(veIsForwardGear({ name: '', ratio: -5.03 })).toBe(false);
  });

  test('oranı olmayan/sıfır kayıt ileri vites sayılmaz', () => {
    expect(veIsForwardGear({ name: '1C', ratio: 0 })).toBe(false);
    expect(veIsForwardGear({ name: '1C' })).toBe(false);
    expect(veIsForwardGear(null)).toBe(false);
    expect(veIsReverseGear(null)).toBe(false);
  });
});

// Kapı: düzeltilen YOLLAR eski kurala geri dönmesin. (Bir de kullanılmayan
// veShiftControllerStep var — ölü kod, kasten dokunulmadı; bu yüzden kapı
// dosya bazlı, kaynak geneli değil.)
describe('Çözücü yolları eski "F ile başlar" kuralına dönmedi', () => {
  ['solver-pro.js', 'cp-solver.js'].forEach(function (f) {
    test(f + ' içinde ham charAt(0) === \'F\' süzgeci yok', () => {
      const src = fs.readFileSync(path.join(__dirname, '../../js/', f), 'utf8');
      // Yorum satırlarını at, kalan kodda ara
      const kod = src.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
      expect(kod).not.toMatch(/charAt\(0\)\s*===\s*'F'/);
    });
  });
});
