/**
 * solver-run-opens-component.test.js
 * ──────────────────────────────────
 * Şerit "Çalıştır" düğmesi ARTIK Çözücü bileşenini açar.
 *
 * ESKİ DAVRANIŞ (hata): veSolverRun() kendi başına bir hesap koşturuyor ve
 * sonuçlarını #ve-page-cozucu alt-sayfasındaki ve-solver-progress /
 * ve-solver-result elemanlarına yazıyordu. O sayfa gezinmede YOK ve
 * display:none — getElementById onu yine bulduğu için simülasyon gerçekten
 * koşuyor, ama çıktısı görünmez bir sayfaya gidiyordu. Kullanıcıya "düğme
 * hiçbir şey yapmıyor" gibi görünüyordu ve Çözücü bileşeninin "Hesapla"
 * düğmesinden (veSolverRunProfessional) tamamen ayrı, eski bir yoldu.
 *
 * YENİ: tek doğruluk kaynağı Çözücü bileşeni. Çalıştır onu açar.
 */
const stubs = stubGlobals();

// veSolverRun'ın kullandığı UI yardımcıları
let opened = [];        // veTogglePropertiesPanel(true/false) çağrıları
let shown = [];         // panele içeriği basılan düğümler
let cleared = 0;

global.veTogglePropertiesPanel = jest.fn((s) => opened.push(s));
global.addToSelection = jest.fn((n) => shown.push(n));
global.clearSelection = jest.fn(() => { cleared++; });

eval(loadSource('solver.js'));

beforeEach(() => {
  resetStubs(stubs);
  opened = []; shown = []; cleared = 0;
  global.veTogglePropertiesPanel.mockClear();
  global.addToSelection.mockClear();
  global.clearSelection.mockClear();
  global.connections = [];
});

describe('veSolverRun — Çözücü bileşenini açar', () => {
  test('çözücü düğümü seçilir ve özellik penceresi açılır', () => {
    const solver = { id: 'sv1', type: 'solver', data: {} };
    global.nodes = [{ id: 'e1', type: 'engine', data: {} }, solver];

    veSolverRun();

    expect(shown).toEqual([solver]);           // panel içeriği ÇÖZÜCÜ için üretildi
    expect(opened).toEqual([true]);            // pencere açıldı
    expect(cleared).toBe(1);                   // önceki seçim temizlendi
  });

  test('çözücü yoksa açmaz, kullanıcıya söyler', () => {
    global.nodes = [{ id: 'e1', type: 'engine', data: {} }];

    veSolverRun();

    expect(shown).toEqual([]);
    expect(opened).toEqual([]);
    expect(stubs.showToast).toHaveBeenCalled();
    expect(stubs.showToast.mock.calls[0][0]).toMatch(/Çözücü/);
  });

  test('birden çok düğüm arasından çözücüyü bulur', () => {
    const solver = { id: 'sv9', type: 'solver', data: {} };
    global.nodes = [
      { id: 'e1', type: 'engine', data: {} },
      { id: 'g1', type: 'gearbox', data: {} },
      solver,
      { id: 'w1', type: 'wheel', data: {} }
    ];

    veSolverRun();

    expect(shown[0].id).toBe('sv9');
  });

  test('HESAP KOŞTURMAZ — yalnız pencereyi açar', () => {
    // Eski yol veFTRunSimulationEngine çağırıyordu. Yeni yol çağırmamalı:
    // hesap, açılan penceredeki "Hesapla" düğmesinden başlatılır.
    const engineSpy = jest.fn();
    global.veFTRunSimulationEngine = engineSpy;
    global.veSolverValidate = jest.fn(() => true);
    global.nodes = [{ id: 'sv1', type: 'solver', data: {} }];

    veSolverRun();

    expect(engineSpy).not.toHaveBeenCalled();
  });
});

describe('kaynak bekçileri — iki düğme ayrışmasın', () => {
  test('şerit düğmesi "Çözücü" adıyla veSolverRun çağırıyor', () => {
    const ribbon = loadSource('ribbon.js');
    // Ad davranışı anlatmalı: düğme hesabı başlatmıyor, Çözücü'yü açıyor.
    expect(ribbon).toContain("label:'Çözücü'");
    expect(ribbon).toContain("run:'veSolverRun'");
    // Eski yanıltıcı ad geri gelmemeli.
    expect(ribbon).not.toContain("label:'Çalıştır'");
  });

  test('Ölçüm penceresinin boş-durum düğmesi de "aç" diyor', () => {
    // Metin panel tip seçicisinden (veRenderSlotPicker, kaldırıldı) ölçüm
    // penceresinin boş durumuna taşındı — güvence aynı kaldı: düğme hesabı
    // başlatmıyor, Çözücü bileşenini açıyor, adı da bunu söylemeli.
    const trace = loadSource('trace-view.js');
    expect(trace).toContain('Çözücüyü Aç');
    expect(trace).not.toContain('Simülasyonu Çalıştır<');
  });

  test('eski hesap yolu Çalıştır düğmesine bağlı değil', () => {
    // veSolverRunLegacy yalnız referans olarak duruyor; hiçbir düğme onu
    // çağırmamalı, aksi hâlde görünmez sayfaya yazan yol geri gelir.
    const src = loadSource('solver.js');
    expect(src).toContain('function veSolverRunLegacy(');
    ['ribbon.js', 'command-palette.js', 'results.js'].forEach((f) => {
      expect(loadSource(f)).not.toContain('veSolverRunLegacy');
    });
  });

  test('veSolverRun artık görünmez sayfanın elemanlarına dokunmuyor', () => {
    const src = loadSource('solver.js');
    // Fonksiyon gövdesini kes: veSolverRun'dan veSolverRunLegacy'ye kadar
    const start = src.indexOf('function veSolverRun()');
    const end = src.indexOf('function veSolverRunLegacy(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).not.toContain('ve-solver-progress');
    expect(body).not.toContain('ve-solver-result');
  });
});
