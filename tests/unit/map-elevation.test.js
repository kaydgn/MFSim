/**
 * map.js — Yükseklik (elevation) veri katmanı birim testleri
 * ──────────────────────────────────────────────────────────
 * Regresyon koruması: Open-Meteo elevation API istek başına EN FAZLA 100
 * koordinat kabul eder. Kod eskiden 1000'lik parçalar gönderiyordu → her
 * gerçek (>100 nokta) rotada HTTP 400 ve ardından "Failed to fetch" zinciri.
 * Ayrıca seyrek örnekleme + interpolasyon mantığının doğruluğu test edilir.
 */

// jsdom: map.js üst seviyede document.addEventListener çağırıyor
global.nodes = [];

const stubs = stubGlobals();
eval(loadSource('map.js'));

beforeEach(() => resetStubs(stubs));

// ═════════════════════════════════════════════════════════════════════
// _veBuildFetchIndices — seyrek örnekleme
// ═════════════════════════════════════════════════════════════════════
describe('_veBuildFetchIndices', () => {
  test('yoğun kısa rotayı minSpacing ile seyrekleştirir, uçları korur', () => {
    // 1000 nokta, her 1m (toplam 999m); minSpacing 25m → ~40 nokta
    var cum = [];
    for (var i = 0; i < 1000; i++) cum.push(i);
    var idxs = _veBuildFetchIndices(cum, 500, 25);
    expect(idxs[0]).toBe(0);
    expect(idxs[idxs.length - 1]).toBe(999);
    expect(idxs.length).toBeLessThan(60); // 999/25 ≈ 40 + uçlar
    for (var k = 1; k < idxs.length; k++) expect(idxs[k]).toBeGreaterThan(idxs[k - 1]);
  });

  test('uzun rotada maxPts sınırına uyar', () => {
    // 5000 nokta, her 100m (toplam ~500km); maxPts 500 → spacing ~1km
    var cum = [];
    for (var i = 0; i < 5000; i++) cum.push(i * 100);
    var idxs = _veBuildFetchIndices(cum, 500, 25);
    expect(idxs.length).toBeLessThanOrEqual(501);
    expect(idxs[0]).toBe(0);
    expect(idxs[idxs.length - 1]).toBe(4999);
  });

  test('2 nokta veya daha azında tüm noktaları döndürür', () => {
    expect(_veBuildFetchIndices([0], 500, 25)).toEqual([0]);
    expect(_veBuildFetchIndices([0, 10], 500, 25)).toEqual([0, 1]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// _veInterpElevByDist — mesafeye göre lineer interpolasyon
// ═════════════════════════════════════════════════════════════════════
describe('_veInterpElevByDist', () => {
  test('uçları korur ve ara noktalarda lineer interpolasyon yapar', () => {
    var cum = [0, 10, 20, 30, 40];
    var idxs = [0, 2, 4];             // coords 0,2,4 örneklendi
    var coarse = [100, 120, 110];     // elev @ idx 0,2,4
    var out = _veInterpElevByDist(cum, idxs, coarse);
    expect(out).toHaveLength(5);
    expect(out[0]).toBeCloseTo(100);
    expect(out[2]).toBeCloseTo(120);
    expect(out[4]).toBeCloseTo(110);
    expect(out[1]).toBeCloseTo(110);  // 0-20m ortası → (100+120)/2
    expect(out[3]).toBeCloseTo(115);  // 20-40m ortası → (120+110)/2
  });

  test('eşit olmayan mesafelerde mesafeyle orantılı interpolasyon', () => {
    var cum = [0, 25, 100];           // p=1 çeyrek noktada
    var idxs = [0, 2];
    var coarse = [0, 100];
    var out = _veInterpElevByDist(cum, idxs, coarse);
    expect(out[1]).toBeCloseTo(25);   // 25/100 * 100
  });
});

// ═════════════════════════════════════════════════════════════════════
// veFetchElevations — chunk limiti + tam kapsama (regresyon)
// ═════════════════════════════════════════════════════════════════════
describe('veFetchElevations', () => {
  afterEach(() => { delete global.fetch; });

  test('Open-Meteo isteklerini ≤100 nokta ile sınırlar ve coords uzunluğunda sonuç döner', async () => {
    var openMeteoCalls = [];
    global.fetch = jest.fn(function (url) {
      openMeteoCalls.push(url);
      var lat = new URL(url).searchParams.get('latitude').split(',');
      return Promise.resolve({
        ok: true,
        json: function () { return Promise.resolve({ elevation: lat.map(function () { return 100; }) }); }
      });
    });

    // 250 nokta, her adım ~1.1km (seyrekleştirmeden sonra da >100 kalır → çoklu chunk)
    var coords = [];
    for (var i = 0; i < 250; i++) coords.push({ lat: 38.0 + i * 0.01, lng: 27.0 });

    var elev = await veFetchElevations(coords);

    expect(elev).toHaveLength(250);
    expect(openMeteoCalls.length).toBeGreaterThan(1); // 100'lük parçalara bölündü
    openMeteoCalls.forEach(function (url) {
      var n = new URL(url).searchParams.get('latitude').split(',').length;
      expect(n).toBeLessThanOrEqual(100);
    });
  });

  test('Open-Meteo HTTP hatasında Open-Elevation yedeğine düşer', async () => {
    global.fetch = jest.fn(function (url, opts) {
      if (url.indexOf('open-meteo') >= 0) {
        return Promise.resolve({ ok: false, status: 400, json: function () { return Promise.resolve({}); } });
      }
      // Open-Elevation POST
      var body = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({ results: body.locations.map(function () { return { elevation: 200 }; }) });
        }
      });
    });

    var coords = [{ lat: 38.0, lng: 27.0 }, { lat: 38.1, lng: 27.0 }, { lat: 38.2, lng: 27.0 }];
    var elev = await veFetchElevations(coords);
    expect(elev).toHaveLength(3);
    expect(elev[0]).toBeCloseTo(200);
  });
});
