/**
 * Varsayılan değer sözleşmesi — çözücü çözüm kümeleri
 * ───────────────────────────────────────────────────
 * Kullanıcı bildirimi: "Sonuçlar'da hiç sinyal yok."
 *
 * Sebep: `performanceAnalysis` anahtarı için İKİ FARKLI VARSAYILAN vardı.
 *   cp-solver.js (panel)      : d.performanceAnalysis || false   → KAPALI say
 *   sensors.js  (tüketici)    : d.performanceAnalysis !== false  → AÇIK say
 *   solver-pro.js (tüketici)  : d.performanceAnalysis !== false  → AÇIK say
 *
 * Taze bir çözücüde değer tanımsız olduğundan panel kutuyu BOŞ çiziyor;
 * kullanıcı panelde herhangi bir alana dokunduğu anda onchange `false`
 * yazıyor ve Performans çözüm kümesi KAPANIYOR. O andan sonra Sensör
 * Sihirbazı 26 paketin hiçbirini kuramıyor → Sonuçlar ağacında hiç sinyal
 * çıkmıyor → ölçüm imleci de görünecek bir şey bulamıyor.
 *
 * Bu, dünkü "araç ağırlığı girilmemiş" hatasıyla AYNI SINIF: tek anahtar,
 * birden çok yerde farklı yorum. O yüzden burada tek bir satır değil, SINIF
 * sabitleniyor.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../');
const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
const oku = (f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');

// Bir anahtarın "varsayılanı kapalı" (`X || false`) ve "varsayılanı açık"
// (`X !== false`) biçimlerinde nerelerde geçtiğini toplar.
function varsayilanHaritasi() {
  const kapali = {};
  const acik = {};
  const ekle = (harita, anahtar, dosya) => {
    (harita[anahtar] = harita[anahtar] || new Set()).add(dosya);
  };
  const ONEK = String.raw`(?:\.data|\bd|\bnd|\bsd|\bvd|\brd|\b\w+Data)`;
  jsFiles.forEach((f) => {
    const src = oku(f);
    for (const m of src.matchAll(new RegExp(ONEK + String.raw`\.([A-Za-z_]\w*)\s*\|\|\s*false\b`, 'g'))) {
      ekle(kapali, m[1], f);
    }
    for (const m of src.matchAll(new RegExp(ONEK + String.raw`\.([A-Za-z_]\w*)\s*!==\s*false\b`, 'g'))) {
      ekle(acik, m[1], f);
    }
  });
  return { kapali, acik };
}

describe('bir anahtarın TEK varsayılanı olur', () => {
  const { kapali, acik } = varsayilanHaritasi();

  test('hiçbir anahtar hem "varsayılan kapalı" hem "varsayılan açık" sayılmıyor', () => {
    const catisan = Object.keys(acik)
      .filter((k) => kapali[k])
      .map((k) => `${k}: kapalı→[${[...kapali[k]].join(',')}] açık→[${[...acik[k]].join(',')}]`);
    // Hata mesajı hangi anahtarın hangi dosyalarda çeliştiğini doğrudan söyler.
    expect(catisan).toEqual([]);
  });

  test('tarama gerçekten örüntü buluyor (sessizce boşalmasın)', () => {
    // Regex bir gün bozulursa yukarıdaki test sahte yeşil vermesin.
    expect(Object.keys(acik).length + Object.keys(kapali).length).toBeGreaterThan(3);
  });
});

describe('performanceAnalysis varsayılanı AÇIK', () => {
  test('çözücü paneli tanımsız değeri AÇIK sayıyor', () => {
    const src = oku('cp-solver.js');
    expect(src).toMatch(/performanceAnalysis\s*!==\s*false/);
    // Eski hatalı biçim geri gelmesin.
    expect(src).not.toMatch(/performanceAnalysis\s*\|\|\s*false/);
  });

  test('tüketiciler de AÇIK sayıyor (panelle aynı)', () => {
    expect(oku('sensors.js')).toMatch(/performanceAnalysis\s*!==\s*false/);
    expect(oku('solver-pro.js')).toMatch(/performanceAnalysis\s*!==\s*false/);
  });

  test('onay kutusu, panelin okuduğu değişkenden çiziliyor', () => {
    const src = oku('cp-solver.js');
    // Kutunun "checked" hâli perfAnalysis'ten gelmeli; sabit kodlanmış olmamalı.
    expect(src).toMatch(/perfAnalysis\s*\?\s*'checked'\s*:\s*''/);
  });
});

describe('sensör paketlerinin çözüm kümesi kapısı', () => {
  // swGetActiveSolverTabs saf mantık: DOM'a dokunmuyor, yalnız nodes okuyor.
  const src = oku('sensors.js');
  const gate = new Function(
    'nodes',
    src.slice(src.indexOf('function swGetActiveSolverTabs')).split('\nfunction swCheckSensorExists')[0] +
      '\nreturn swGetActiveSolverTabs();'
  );

  test('çözücü yoksa hiçbir küme aktif değil', () => {
    expect(gate([])).toEqual({});
  });

  test('taze çözücü (data boş) → Performans AKTİF', () => {
    // Asıl gerileme: panel bunu KAPALI çizip false yazınca zincir kopuyordu.
    expect(gate([{ type: 'solver', data: {} }]).performance).toBe(true);
  });

  test('data hiç yoksa da Performans AKTİF', () => {
    expect(gate([{ type: 'solver' }]).performance).toBe(true);
  });

  test('kullanıcı BİLEREK kapatırsa kapalı kalır', () => {
    expect(gate([{ type: 'solver', data: { performanceAnalysis: false } }]).performance)
      .toBeUndefined();
  });

  test('accel-decel yol segmenti olmadan açılmaz', () => {
    const n = [{ type: 'solver', data: { accelDecelAnalysis: true } }];
    expect(gate(n)['accel-decel']).toBeUndefined();
    n.push({ type: 'scenario', data: { roadSegments: [{}, {}] } });
    expect(gate(n)['accel-decel']).toBe(true);
  });

  test('engel atlama, engel bileşeni olmadan açılmaz', () => {
    const n = [{ type: 'solver', data: { obstacleCrossingAnalysis: true } }];
    expect(gate(n).obstacle).toBeUndefined();
    n.push({ type: 'obstacle-crossing', data: {} });
    expect(gate(n).obstacle).toBe(true);
  });
});
