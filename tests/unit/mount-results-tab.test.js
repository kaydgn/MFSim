/**
 * Takoz sonuçlarının Sonuçlar paneline bağlanması
 * ───────────────────────────────────────────────
 * "Sonuçlar" panosu bugüne kadar yalnız ARAÇ çözümünden besleniyordu
 * (window.veSimResults). Takoz modülünün kendi çözücüsü var ve sonucu ayrı
 * bir global'de (window.veMountResults) duruyor. Bu dosya o bağlantının
 * kararlarını kilitler:
 *
 *   • Takoz sekmesi araç çözümünden BAĞIMSIZ açılır — kullanıcı yalnız takoz
 *     modelini çözmüş olabilir; "önce aracı çöz" demek yanlış olurdu.
 *   • Takoz kanalının X ekseni kendi veri kümesinden gelir, panodan
 *     DEVRALINMAZ; pano başka bir eksendeyse bırakma reddedilir. 240 noktalık
 *     bir FRF eğrisi 500 örneklik zaman eksenine çizilirse sonuç sessizce
 *     yanlıştır — kullanıcı bunu gözle yakalayamaz.
 *   • Takoz sekmesinde "Zaman" ekseni seçeneği YOKTUR: hiçbir kanal zamana
 *     bağlı değil, sunmak kullanıcıyı boş eksene götürür.
 *
 * Kanal SAYILARININ doğruluğu mount-signals.test.js'in işi; burada yalnız
 * pano ile çekirdek arasındaki kablolama sınanır.
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const S = require('../../js/mount-signals.js');
global.veMntSignals = S;

const stubs = stubGlobals();
global.COMPONENT_SIGNALS = {};
global.componentDefs = {};
global.connections = [];
global.nodes = [];
global.veTabs = [{ id: 't1', name: 'T1', state: { simResults: null, nodes: [], connections: [] } }];
global.veActiveTabIdx = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.compCounter = 0;
global.veProjectName = 'Test';
global.SENSOR_PACKAGES = [];

eval(loadSource('measure-core.js'));
eval(loadSource('signal-tree.js'));
// veTrCloneBoard / veTrResetView — çözüm sekmesi pano takasının kullandığı
// derin kopya ve görünüm sıfırlama buradan gelir.
eval(loadSource('trace-view.js'));
eval(loadSource('results.js'));
eval(loadSource('graphics.js'));

// results.js kendi showToast'ını tanımlıyor (js/results.js:5513). Doğrudan
// eval, bildirimi MODÜL kapsamına koyar — global.showToast'ı ezmek işe yaramaz,
// eval'lenmiş kod kendi kapsamındaki bağı görür. Bu yüzden çıplak isme atanır.
let toasts = [];
showToast = jest.fn((msg, type) => toasts.push({ msg, type }));

// ── Çözülmüş takoz modeli (mount-signals.test.js ile aynı ASFAT modeli) ──────
const mm = (v) => v / 1000, kN = (v) => v * 1000;
const G = 9.81;
const COMPS = [
  { name: 'Motor', mass: 1600, cg: [-314.94, -0.127, 857.56].map(mm),
    I: [[110.7, 0, 0], [0, 260.2, 0], [0, 0, 205.9]], pointMass: false },
  { name: 'Şanzıman', mass: 839, cg: [932.365, -13.003, 700.632].map(mm),
    I: [[44.6, 0, 0], [0, 97.8, 0], [0, 0, 94.6]], pointMass: false },
];
const K = { s: [1045, 1045, 1800], d: [1045, 1045, 1800] };
const MOUNTS = [['Ön Sol', -953.45, -50.67, 367], ['Ön Sağ', -953.45, 50.67, 367],
  ['Sol Arka', 636.8, -347.1, 615.77], ['Sağ Arka', 636.8, 347.1, 615.77]]
  .map((h) => ({ name: h[0], pos: [h[1], h[2], h[3]].map(mm),
                 kstat: K.s.map(kN), kdyn: K.d.map(kN) }));
const MP = core.combineMassProps(COMPS);
const KSTAT = core.buildK(MOUNTS, MP.cg, false);
const STAT = core.solveCase(KSTAT, MOUNTS, MP.cg, MP.m, G, { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
const DAMP = core.mountDamping(MOUNTS, core.mountLoadShares(STAT, G), 0.02);
const solveOne = (lc) => ({ name: lc.name, loadCase: lc,
  res: core.solveCaseStop(KSTAT, MOUNTS, MP.cg, MP.m, G, lc, { useStop: true }) });

function solvedMount() {
  const R = { mp: MP, mounts: MOUNTS, damping: DAMP, g: G };
  R.signals = S.build(R, { solveOne });
  return R;
}

function emptyBoard() { return [{}, {}, {}, {}]; }

beforeEach(() => {
  resetStubs(stubs);
  toasts = [];
  showToast.mockClear();
  window.veSimResults = null;
  window.veMountResults = null;
  veResultSlots = emptyBoard();
  veActiveSolverTabId = 'performance';
});

describe('çözüm sekmesi', () => {
  test('takoz çözümü yokken sekme görünmez', () => {
    expect(veGetAvailableSolverTabs().map((t) => t.id)).toEqual([]);
  });

  test('araç hiç çözülmemişken bile takoz sekmesi açılır', () => {
    window.veMountResults = solvedMount();
    expect(veGetAvailableSolverTabs().map((t) => t.id)).toEqual(['mount']);
  });

  test('araç ve takoz birlikte çözülünce iki sekme de listelenir', () => {
    window.veSimResults = { speed: [0, 1, 2], time: [0, 1, 2] };
    window.veMountResults = solvedMount();
    expect(veGetAvailableSolverTabs().map((t) => t.id)).toEqual(['performance', 'mount']);
  });

  test('hatalı/kanalsız takoz sonucu sekme açmaz', () => {
    window.veMountResults = { error: ['eksik girdi'] };
    expect(veGetAvailableSolverTabs().map((t) => t.id)).toEqual([]);
    window.veMountResults = { signals: [] };
    expect(veGetAvailableSolverTabs().map((t) => t.id)).toEqual([]);
  });
});

describe('veri yolu — veGetSensorData', () => {
  beforeEach(() => { window.veMountResults = solvedMount(); });

  test('kanal ve X ekseni araç çözümü olmadan okunur', () => {
    const f = veGetSensorData('~mnt-frf', 'f');
    const T = veGetSensorData('~mnt-frf', 'T_2');
    expect(f.length).toBe(S.FRF_NPTS);
    expect(T.length).toBe(S.FRF_NPTS);
    expect(window.veSimResults).toBeNull();     // araç sonucu gerekmedi
  });

  test('takoz sonucu silinince kanal da yok olur — bayat eğri kalmaz', () => {
    window.veMountResults = null;
    expect(veGetSensorData('~mnt-frf', 'T_2')).toBeNull();
  });

  test('bilinmeyen küme null döner', () => {
    expect(veGetSensorData('~mnt-yok', 'T_2')).toBeNull();
  });
});

describe('panoya kanal ekleme — X ekseni kuralı', () => {
  beforeEach(() => { window.veMountResults = solvedMount(); veActiveSolverTabId = 'mount'; });

  test('boş panoya bırakılan kanal, kendi kümesinin eksenini kurar', () => {
    veAddSignalToSlot(0, '~mnt-frf', 'T_2');
    expect(veResultSlots[0].sensors.length).toBe(1);
    expect(veResultSlots[0].xAxis.id).toBe('~mnt-frf:f');
    expect(veResultSlots[0].xAxis.unit).toBe('Hz');
    expect(veResultSlots[0].sensors[0].unit).toBe('−');
  });

  test('aynı kümeden ikinci kanal aynı eksende birleşir', () => {
    veAddSignalToSlot(0, '~mnt-frf', 'T_2');
    veAddSignalToSlot(0, '~mnt-frf', 'T0_2');
    expect(veResultSlots[0].sensors.length).toBe(2);
    expect(veResultSlots[0].xAxis.id).toBe('~mnt-frf:f');
  });

  test('başka kümeden kanal REDDEDİLİR — frekans eğrisi ivme eksenine düşmez', () => {
    veAddSignalToSlot(0, '~mnt-frf', 'T_2');
    veAddSignalToSlot(0, '~mnt-gz', 'dmax');
    expect(veResultSlots[0].sensors.length).toBe(1);
    expect(veResultSlots[0].sensors[0].signal).toBe('T_2');
    // Sessizce yutulmaz: kullanıcı neden çizilmediğini panonun eksen adıyla
    // birlikte öğrenir.
    expect(toasts.length).toBe(1);
    expect(toasts[0].msg).toContain('Frekans [Hz]');
  });

  test('zaman eksenli pano takoz kanalını kabul etmez', () => {
    veResultSlots[0] = { type: 'line', xAxis: { id: 'time', name: 'Zaman [s]', unit: 's' },
                         sensors: [{ id: '~engine', signal: 'rpm', name: 'Devir', unit: 'rpm' }] };
    veAddSignalToSlot(0, '~mnt-frf', 'T_2');
    expect(veResultSlots[0].sensors.length).toBe(1);
    expect(veResultSlots[0].sensors[0].id).toBe('~engine');
  });

  test('aynı kanal iki kez eklenmez', () => {
    veAddSignalToSlot(0, '~mnt-frf', 'T_2');
    veAddSignalToSlot(0, '~mnt-frf', 'T_2');
    expect(veResultSlots[0].sensors.length).toBe(1);
  });

  test('bilinmeyen kanal panoyu kirletmez', () => {
    veAddSignalToSlot(0, '~mnt-frf', 'yok');
    expect(veResultSlots[0].sensors || []).toEqual([]);
  });

  test('grup sürüklemesi kümenin tüm kanallarını ekler', () => {
    veAddSensorToSlot(0, '~mnt-frf');
    const ds = solvedMount().signals.find((d) => d.key === 'frf');
    expect(veResultSlots[0].sensors.length).toBe(ds.channels.length);
    expect(veResultSlots[0].xAxis.id).toBe('~mnt-frf:f');
  });
});

describe('takoz sekmesi kaybolunca (çözüm geçersizleşti)', () => {
  function tabBar() {
    document.body.innerHTML = '<div id="ve-solver-tab-bar"></div>';
    return document.getElementById('ve-solver-tab-bar');
  }

  test('sekme devri panoyu da takas eder — diğer sekmenin şeritleri ezilmez', () => {
    // Araç + takoz çözülü. Kullanıcı Performans panosunu kurar, takoz sekmesine
    // geçip FRF kanalı bırakır. Takoz çözümü geçersizleşir. Sekme kimliği
    // panoyla BİRLİKTE devredilmezse, bir sonraki sekme değişimi takoz panosunu
    // 'performance' adına yazar ve kullanıcının araç panosu kalıcı olarak gider.
    tabBar();
    window.veSimResults = { speed: [0, 1], time: [0, 1] };
    window.veMountResults = solvedMount();

    veActiveSolverTabId = 'performance';
    veResultSlots[0] = { type: 'line', xAxis: { id: 'time', name: 'Zaman [s]', unit: 's' },
                         sensors: [{ id: '~engine', signal: 'rpm', name: 'Devir', unit: 'rpm' }] };
    veSwitchSolverTab('mount');
    veAddSignalToSlot(0, '~mnt-frf', 'T_2');
    expect(veResultSlots[0].sensors[0].id).toBe('~mnt-frf');

    window.veMountResults = null;         // başarısız yeniden çözüm
    veUpdateSolverTabs();

    expect(veActiveSolverTabId).toBe('performance');
    // Araç panosu geri geldi, takoz şeritleri panoda DEĞİL
    expect(veResultSlots[0].sensors[0].id).toBe('~engine');
    // ve takoz panosu kendi adı altında saklandı
    expect(veSolverTabSlots['mount'][0].sensors[0].id).toBe('~mnt-frf');
  });

  test('hiç sekme kalmayınca kimlik "mount"ta takılı kalmaz', () => {
    // Yalnız takoz çözülmüş oturumda çözüm geçersizleşirse sekme çubuğu gizlenir.
    // Kimlik 'mount' kalırsa sonuç ağacı takoz dalını çizip erken döner ve
    // kullanıcı KENDİ sensör ağacına ulaşamaz — çubuk gizli olduğu için geri
    // dönüş düğmesi de yoktur.
    tabBar();
    window.veMountResults = solvedMount();
    veActiveSolverTabId = 'mount';
    veUpdateSolverTabs();
    expect(veActiveSolverTabId).toBe('mount');

    window.veMountResults = null;
    veUpdateSolverTabs();
    expect(veActiveSolverTabId).toBe('performance');
  });
});

describe('pano ile çözümün uzlaştırılması (veMntSyncBoard)', () => {
  test('var olan kanalın adı güncel çözümden tazelenir', () => {
    window.veMountResults = solvedMount();
    veActiveSolverTabId = 'mount';
    veAddSignalToSlot(0, '~mnt-gz', 'dmax');
    veResultSlots[0].sensors[0].name = 'ESKİ AD';       // kaydedilmiş bayat etiket
    expect(veMntSyncBoard()).toBe(0);
    expect(veResultSlots[0].sensors[0].name).toBe('En büyük takoz çökmesi');
  });

  test('artık var olmayan kanal DÜŞÜRÜLÜR, ekseni de bırakılır', () => {
    // Kayıtlı proje takoz kanalı taşır ama takoz sonucu oturumluk: yeniden
    // açılışta kanal yoktur. Panoda kalırsa adlandırılmış ama kalıcı boş bir
    // şerit olur ve pano takoz ekseninde kilitli kaldığı için araç sinyalleri
    // de reddedilir.
    window.veMountResults = solvedMount();
    veActiveSolverTabId = 'mount';
    veAddSignalToSlot(0, '~mnt-frf', 'T_2');
    veAddSignalToSlot(0, '~mnt-frf', 'T0_2');
    window.veMountResults = null;
    expect(veMntSyncBoard()).toBe(2);
    expect(veResultSlots[0].sensors).toEqual([]);
    expect(veResultSlots[0].xAxis).toBeUndefined();
  });

  test('araç sinyallerine dokunmaz', () => {
    window.veMountResults = null;
    veResultSlots[0] = { type: 'line', xAxis: { id: 'time', name: 'Zaman [s]', unit: 's' },
                         sensors: [{ id: '~engine', signal: 'rpm', name: 'Devir', unit: 'rpm' }] };
    expect(veMntSyncBoard()).toBe(0);
    expect(veResultSlots[0].sensors.length).toBe(1);
    expect(veResultSlots[0].xAxis.id).toBe('time');
  });
});

describe('kayıtlı takoz ekseni çözülemezse zamana düşmez', () => {
  test('veTrResolveX null döner — araç zaman ekseni "Frekans [Hz]" diye çizilmez', () => {
    // Pano projeyle kaydediliyor, takoz sonucu ise oturumluk. Yeniden açılışta
    // eksen serisi null döner; genel geri düşüş devreye girerse ARAÇ zaman
    // dizisi kullanılır ve pencere 0–30 s'lik ekseni "Frekans [Hz]" etiketiyle
    // çizer, imleç saniyeyi Hz diye okur. Eksen yoksa pencere boş görünmeli.
    window.veSimResults = { speed: [0, 1, 2], time: [0, 1, 2] };
    window.veMountResults = null;
    const slot = {
      type: 'line',
      xAxis: { id: '~mnt-frf:f', name: 'Frekans [Hz]', unit: 'Hz' },
      sensors: [{ id: '~mnt-frf', signal: 'T_2', name: 'İletilebilirlik T — Z (düşey)', unit: '−' }]
    };
    expect(veTrResolveX(slot)).toBeNull();
  });

  test('araç ekseni çözülemezse eski geri düşüş korunur', () => {
    window.veSimResults = { speed: [0, 1, 2], time: [0, 1, 2] };
    const slot = { type: 'line', xAxis: { id: 'time', name: 'Zaman [s]', unit: 's' }, sensors: [] };
    expect(veTrResolveX(slot)).toBe(window.veSimResults.time);
  });
});

describe('X ekseni seçici', () => {
  beforeEach(() => { window.veMountResults = solvedMount(); });

  test('pano boşken tüm küme eksenleri sunulur, zaman sunulmaz', () => {
    veActiveSolverTabId = 'mount';
    const opts = veGetAvailableXAxisOptions(0);
    expect(opts.map((o) => o.id)).toEqual([
      '~mnt-frf:f', '~mnt-fdefl:d', '~mnt-gz:a', '~mnt-gy:a', '~mnt-gx:a',
      '~mnt-shockz:t', '~mnt-shocky:t', '~mnt-shockx:t'
    ]);
    expect(opts.map((o) => o.unit)).toEqual(['Hz', 'mm', 'g', 'g', 'g', 's', 's', 's']);
    // Şok kümesinin ekseni ZAMAN ama araç zaman ekseni DEĞİL: kimliği kümeye
    // bağlı, tek-eksen kuralı onu araç sinyalleriyle aynı pencereye sokmaz.
    expect(opts.some((o) => o.id === 'time')).toBe(false);
  });

  test('pano doluyken YALNIZ o kümenin ekseni sunulur', () => {
    // Seçici tek-eksen kuralını atlatan tek yoldu: veSetSlotXAxis ekseni
    // değiştirir ama şeritlerin verisine dokunmaz. Kümelerin uzunlukları farklı
    // (240 / 121 / 36) olduğundan 240 örneklik iletilebilirlik eğrisi 36
    // noktalık ivme ekseninde sessizce kırpılıp çizilirdi.
    veActiveSolverTabId = 'mount';
    veAddSignalToSlot(0, '~mnt-frf', 'T_2');
    const opts = veGetAvailableXAxisOptions(0);
    expect(opts.map((o) => o.id)).toEqual(['~mnt-frf:f']);
  });

  test('araç sekmesinde davranış değişmez — zaman hâlâ ilk seçenek', () => {
    veActiveSolverTabId = 'performance';
    window.veSimResults = { speed: [0, 1], time: [0, 1] };
    expect(veGetAvailableXAxisOptions(0)[0].id).toBe('time');
  });
});
