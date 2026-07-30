/**
 * Topoloji doğrulama çekirdeği — js/solver.js › veCollectValidation()
 * ──────────────────────────────────────────────────────────────────
 * Doğrulama artık iki yere birden çiziliyor (Çözücü kartı + görünür Uyarılar
 * paneli), ikisi de aynı yapılandırılmış listeden besleniyor. Listede sessiz
 * bir kayma olursa:
 *
 *   • eksik bir bileşen "tamam" görünür → kullanıcı eksik topolojiyle
 *     çalıştığını sanır, Çalıştır ise reddeder (tam da düzelttiğimiz çelişki),
 *   • ya da sağlam bir topoloji bloklanır ve kullanıcı sebebini bulamaz.
 *
 * İkisi de gözle yakalanmaz; bu yüzden kural burada sabitlenir. Çizim (HTML)
 * kasıtlı olarak test edilmez — proje test politikası.
 */
const stubs = stubGlobals({
  veGetActiveModule: () => ({ requiredComponents: [] }),
  componentDefs: {},
});
global.veActiveModule = 'full-throttle';
global.VE_ACC_PORT_MAP = {};
global.VE_ACC_TYPES = {};

eval(loadSource('solver.js'));

beforeEach(() => resetStubs(stubs));

// ── Topoloji kurma yardımcıları ──────────────────────────────────────────
const node = (id, type, data) => ({ id, type, data: data || {}, x: 0, y: 0 });
const link = (from, to) => ({ id: from + '>' + to, from, to });

/** Geçerli tam-analiz topolojisi: motor(tork verili) → şanzıman → tekerlek, + araç */
function saglikliTopoloji() {
  global.nodes = [
    node('e', 'engine', { torqueData: [{ rpm: 1000, torque: 500 }, { rpm: 2000, torque: 600 }] }),
    node('g', 'gearbox'),
    node('w', 'wheel'),
    node('v', 'vehicle', { mass: 18000 }),
    node('d', 'differential'),
  ];
  global.connections = [link('e', 'g'), link('g', 'd'), link('d', 'w')];
}

const etiketler = (res) => res.items.map((i) => i.label);
const bul = (res, label) => res.items.find((i) => i.label === label);

describe('veCollectValidation — sağlıklı topoloji', () => {
  beforeEach(saglikliTopoloji);

  test('engel yok, tam analiz modunda hesaplamaya hazır', () => {
    const res = veCollectValidation();
    expect(res.allOk).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.mode).toBe('Tam analiz');
  });

  test('zorunlu bileşenlerin hepsi listede ve tamam', () => {
    const res = veCollectValidation();
    ['Motor bileşeni', 'Şanzıman bileşeni', 'Tekerlek bileşeni', 'Araç Gövdesi bileşeni']
      .forEach((l) => expect(bul(res, l).level).toBe('ok'));
  });
});

describe('veCollectValidation — bloklayan eksikler', () => {
  test('motor yoksa hata verir ve hesaplamayı bloklar', () => {
    saglikliTopoloji();
    global.nodes = global.nodes.filter((n) => n.type !== 'engine');
    const res = veCollectValidation();
    expect(res.allOk).toBe(false);
    expect(bul(res, 'Motor bileşeni').level).toBe('err');
  });

  test('motor tork verisi tek noktaysa yetersiz sayılır', () => {
    saglikliTopoloji();
    global.nodes[0].data.torqueData = [{ rpm: 1000, torque: 500 }];
    const res = veCollectValidation();
    expect(res.allOk).toBe(false);
    expect(bul(res, 'Motor tork verileri').detail).toMatch(/eksik veya yetersiz/);
  });

  test('araç kütlesi girilmemişse hata', () => {
    saglikliTopoloji();
    delete global.nodes.find((n) => n.type === 'vehicle').data.mass;
    const res = veCollectValidation();
    expect(res.allOk).toBe(false);
    expect(bul(res, 'Araç ağırlığı').level).toBe('err');
  });
});

describe('veCollectValidation — bağlantısız bileşenler', () => {
  test('bağlantısız güç zinciri bileşeni hata üretir', () => {
    saglikliTopoloji();
    global.connections = [];                       // hiçbir şey bağlı değil
    const res = veCollectValidation();
    expect(res.allOk).toBe(false);
    expect(bul(res, 'Güç zinciri bileşenleri bağlı').detail).toMatch(/bileşen bağlı değil/);
  });

  test('HANGİ bileşenin bağlı olmadığı tek tek söylenir', () => {
    // Regresyon: eskiden yalnızca "2 bileşen bağlı değil" deniyordu; kullanıcı
    // hangisini arayacağını bilmiyordu. Artık her biri kendi satırında ve
    // nodeId taşıyor (panelde tıklanıp bileşene gidilebilsin diye).
    saglikliTopoloji();
    global.connections = [];
    const res = veCollectValidation();
    const kopuk = res.warnings.filter((w) => /bağlı değil/.test(w.label));
    // engine, gearbox, wheel, differential — araç bağımsız tip olduğu için sayılmaz
    expect(kopuk.length).toBe(4);
    expect(kopuk.every((w) => !!w.nodeId)).toBe(true);
    expect(new Set(kopuk.map((w) => w.nodeId))).toEqual(new Set(['e', 'g', 'w', 'd']));
  });

  test('bağımsız çalışan tipler (araç, çözücü, yol) bağlantısız sayılmaz', () => {
    saglikliTopoloji();
    global.nodes.push(node('s', 'solver'), node('r', 'road', { grade: 0 }));
    const res = veCollectValidation();
    expect(bul(res, 'Güç zinciri bileşenleri bağlı').level).toBe('ok');
  });
});

describe('veCollectValidation — kısmi analiz (sonlandırıcı)', () => {
  test('bağlı sonlandırıcı varsa kısmi moda geçer ve eksik bileşen bloklamaz', () => {
    global.nodes = [
      node('e', 'engine', { torqueData: [{ rpm: 1000, torque: 500 }, { rpm: 2000, torque: 600 }] }),
      node('g', 'gearbox'),
      node('t', 'terminator'),
    ];
    global.connections = [link('e', 'g'), link('g', 't')];
    const res = veCollectValidation();
    expect(res.mode).toBe('Kısmi analiz');
    // Tekerlek/Araç yok ama kısmi modda zorunlu değil
    expect(etiketler(res)).not.toContain('Tekerlek bileşeni');
    expect(res.allOk).toBe(true);
  });

  test('sonlandırıcı bağlı DEĞİLSE tam analiz kuralları geçerli', () => {
    global.nodes = [
      node('e', 'engine', { torqueData: [{ rpm: 1000, torque: 500 }, { rpm: 2000, torque: 600 }] }),
      node('t', 'terminator'),
    ];
    global.connections = [];
    const res = veCollectValidation();
    expect(res.mode).toBe('Tam analiz');
    expect(res.allOk).toBe(false);
  });
});

describe('veCollectValidation — uyarılar bloklamaz', () => {
  test('diferansiyel eksikse uyarı verir ama hesaplamayı durdurmaz', () => {
    saglikliTopoloji();
    global.nodes = global.nodes.filter((n) => n.type !== 'differential');
    global.connections = [link('e', 'g'), link('g', 'w')];
    const res = veCollectValidation();
    expect(res.allOk).toBe(true);
    expect(res.warnings.some((w) => /Diferansiyel/.test(w.label))).toBe(true);
  });
});

describe('veCollectValidation — yapı sözleşmesi', () => {
  test('her öğenin geçerli bir seviyesi var', () => {
    saglikliTopoloji();
    const res = veCollectValidation();
    const gecersiz = res.items.filter((i) => !['ok', 'err', 'warn', 'info'].includes(i.level));
    expect(gecersiz).toEqual([]);
  });

  test('errors/warnings listeleri items ile tutarlı', () => {
    saglikliTopoloji();
    global.connections = [];
    const res = veCollectValidation();
    expect(res.errors).toEqual(res.items.filter((i) => i.level === 'err'));
    expect(res.warnings).toEqual(res.items.filter((i) => i.level === 'warn'));
    expect(res.allOk).toBe(res.errors.length === 0);
  });
});
