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
// ── GERÇEK bileşen tanımlarını js/components.js'ten oku ─────────────────
// Bunlar eskiden `componentDefs: {}` diye BOŞ stub'lanıyordu ve
// VE_STANDALONE_TYPES hiç tanımlanmıyordu. Tam da bu yüzden doğrulamanın
// bağımsız-tip muafiyetindeki hata testlerden kaçtı: sahte bir dünyada her
// bileşen "bağlanabilir ve bağlanmalı" görünüyordu. Artık muafiyet iki gerçek
// kaynaktan türetiliyor (port sayısı + VE_STANDALONE_TYPES), o yüzden test de
// o kaynakları okuyor. components.js'te bir tip eklenir/çıkarılırsa test
// kendiliğinden onu görür.
function _gercekTanimlar() {
  const src = loadSource('components.js');
  const defs = {};
  for (const m of src.matchAll(/'([a-z0-9-]+)':\s*\{/g)) {
    let blk = src.slice(m.index, m.index + 1800);
    const son = blk.indexOf('\n  },');
    if (son > 0) blk = blk.slice(0, son);
    const i = blk.match(/inputs:\s*(\d+)/);
    const o = blk.match(/outputs:\s*(\d+)/);
    if (i && o) defs[m[1]] = { inputs: +i[1], outputs: +o[1] };
  }
  const sa = src.match(/var VE_STANDALONE_TYPES\s*=\s*\[([\s\S]*?)\]/);
  const standalone = sa
    ? sa[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean)
    : [];
  return { defs, standalone };
}
const GERCEK = _gercekTanimlar();

const stubs = stubGlobals({
  veGetActiveModule: () => ({ requiredComponents: [] }),
  componentDefs: GERCEK.defs,
});
global.VE_STANDALONE_TYPES = GERCEK.standalone;
global.veActiveModule = 'full-throttle';
global.VE_ACC_PORT_MAP = {};
global.VE_ACC_TYPES = {};

eval(loadSource('solver.js'));

describe('test harness’ı gerçek tanımları okuyor', () => {
  test('bileşen tanımları yüklendi ve port sayıları var', () => {
    expect(Object.keys(GERCEK.defs).length).toBeGreaterThan(25);
    expect(GERCEK.defs.engine.inputs).toBeGreaterThan(0);
    expect(GERCEK.defs['arac-performans']).toEqual({ inputs: 0, outputs: 0 });
  });

  test('VE_STANDALONE_TYPES yüklendi', () => {
    expect(GERCEK.standalone).toContain('vehicle');
    expect(GERCEK.standalone).toContain('ec-matching');
    expect(GERCEK.standalone.length).toBeGreaterThan(8);
  });
});

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
    node('v', 'vehicle', { ftGVW: 18000 }),
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
    const v = global.nodes.find((n) => n.type === 'vehicle');
    v.data = {};                       // ne ftGVW ne mass
    const res = veCollectValidation();
    expect(res.allOk).toBe(false);
    expect(bul(res, 'Araç ağırlığı').level).toBe('err');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GERİLEME TESTLERİ — kullanıcı bildirimi: "ağırlık girilmiş ama uyarı
// 'girilmemiş' diyor". Üç ayrı hata çıktı ve ÜÇÜ DE hesaplamayı BLOKLUYORDU,
// yani doğru kurulmuş bir topoloji hiç çalıştırılamıyordu.
// ═══════════════════════════════════════════════════════════════════════════

describe('gerileme: araç kütlesi PANELİN yazdığı anahtardan okunmalı', () => {
  // Araç panelinin İKİ varyantı var ve iki ayrı anahtar yazıyor:
  //   Araç Performans (FT) paneli  → data.ftGVW   (çözücü: ft-performance.js)
  //   Çözücü Pro paneli            → data.mass    (çözücü: simulation-engine.js)
  // Doğrulama YALNIZCA data.mass okuyordu; varsayılan modül FT panelini
  // çizdiğinden kullanıcı 7530 kg girse bile "girilmemiş" diyordu.
  test('FT paneli anahtarı (ftGVW) kabul edilir', () => {
    saglikliTopoloji();
    const v = global.nodes.find((n) => n.type === 'vehicle');
    v.data = { ftGVW: 7530 };
    const res = veCollectValidation();
    const it = bul(res, 'Araç ağırlığı');
    expect(it.level).toBe('ok');
    expect(it.detail).toBe('7530 kg');
    expect(res.allOk).toBe(true);
  });

  test('Çözücü Pro anahtarı (mass) da kabul edilir', () => {
    saglikliTopoloji();
    const v = global.nodes.find((n) => n.type === 'vehicle');
    v.data = { mass: 18000 };
    const res = veCollectValidation();
    expect(bul(res, 'Araç ağırlığı').level).toBe('ok');
    expect(bul(res, 'Araç ağırlığı').detail).toBe('18000 kg');
  });

  test('ftGVW varsa mass’a düşülmez (ftGVW asıl kaynak)', () => {
    saglikliTopoloji();
    const v = global.nodes.find((n) => n.type === 'vehicle');
    v.data = { ftGVW: 7530, mass: 18000 };
    expect(bul(veCollectValidation(), 'Araç ağırlığı').detail).toBe('7530 kg');
  });

  test('sıfır ve negatif kütle geçersiz', () => {
    saglikliTopoloji();
    const v = global.nodes.find((n) => n.type === 'vehicle');
    [0, -100, '', 'abc', null].forEach((deger) => {
      v.data = { ftGVW: deger };
      expect(bul(veCollectValidation(), 'Araç ağırlığı').level).toBe('err');
    });
  });
});

describe('gerileme: bağlanamayan düğüm "bağlı değil" sayılmaz', () => {
  // Muafiyet listesi solver.js'te ELLE KOPYALANMIŞTI ve components.js'teki
  // VE_STANDALONE_TYPES ile senkron değildi. Sonuç: kullanıcı "Motor-Konvertör
  // Eşleştirme" (ec-matching) eklediğinde BLOKLAYAN "bağlı değil" hatası.
  test('portu olmayan modül kapsayıcısı (arac-performans) bağlı değil sayılmaz', () => {
    saglikliTopoloji();
    global.nodes.push(node('m', 'arac-performans'));
    const res = veCollectValidation();
    expect(bul(res, 'Güç zinciri bileşenleri bağlı').level).toBe('ok');
    expect(res.allOk).toBe(true);
  });

  test('ec-matching (portu var ama bağlantısı zorunlu değil) bağlı değil sayılmaz', () => {
    saglikliTopoloji();
    global.nodes.push(node('x', 'ec-matching'));
    const res = veCollectValidation();
    expect(bul(res, 'Güç zinciri bileşenleri bağlı').level).toBe('ok');
    expect(res.allOk).toBe(true);
  });

  test('VE_STANDALONE_TYPES’ın TAMAMI muaf — kopya liste sapması olmasın', () => {
    GERCEK.standalone.forEach((tip) => {
      saglikliTopoloji();
      global.nodes.push(node('t_' + tip, tip));
      const res = veCollectValidation();
      expect(bul(res, 'Güç zinciri bileşenleri bağlı').level).toBe('ok');
    });
  });

  test('portu olmayan HER tip muaf (mnt-* araç blokları dahil)', () => {
    const portsuz = Object.keys(GERCEK.defs)
      .filter((t) => GERCEK.defs[t].inputs === 0 && GERCEK.defs[t].outputs === 0);
    expect(portsuz.length).toBeGreaterThan(10);
    portsuz.forEach((tip) => {
      saglikliTopoloji();
      global.nodes.push(node('p_' + tip, tip));
      expect(bul(veCollectValidation(), 'Güç zinciri bileşenleri bağlı').level).toBe('ok');
    });
  });

  test('GERÇEKTEN bağlanması gereken bileşen bağlı değilse HÂLÂ hata verir', () => {
    // Muafiyet genişletildi diye kontrol körleşmemeli.
    saglikliTopoloji();
    global.nodes.push(node('gb2', 'gearbox'));   // portu var, bağımsız değil, bağlı değil
    const res = veCollectValidation();
    expect(bul(res, 'Güç zinciri bileşenleri bağlı').level).toBe('err');
    expect(res.allOk).toBe(false);
    expect(res.warnings.some((w) => /bağlı değil/.test(w.label))).toBe(true);
  });

  test('tanımı olmayan tip hakkında iddia edilmez (bağlı değil sayılır)', () => {
    // componentDefs'te olmayan bir tip için port kuralı uygulanamaz; eski
    // davranış korunur ki bilinmeyen bir tip sessizce muaf olmasın.
    saglikliTopoloji();
    global.nodes.push(node('u', 'bilinmeyen-tip'));
    expect(bul(veCollectValidation(), 'Güç zinciri bileşenleri bağlı').level).toBe('err');
  });
});

describe('gerileme: arazi eğimi SAĞLANAMAZ bir hata değil', () => {
  // Yol panelinde manuel eğim girişi YOK (yalnız eğim modu + segment tablosu;
  // "Ort. Eğim" salt-okunur). data.grade'i hiçbir panel yazmıyor. Eskiden
  // BLOKLAYAN "Arazi eğimi — girilmemiş" hatası vardı → kullanıcı asla
  // gideremiyordu.
  const yolEkle = (data) => { global.nodes.push(node('r', 'road', data)); };

  test('eğim yoksa BLOKLAMAZ, düz yol bilgisi verir', () => {
    saglikliTopoloji(); yolEkle({});
    const res = veCollectValidation();
    expect(res.errors.some((e) => /eğim/i.test(e.label))).toBe(false);
    expect(res.allOk).toBe(true);
    expect(res.items.some((i) => i.level === 'info' && /düz yol/.test(i.label))).toBe(true);
  });

  test('segment modunda segment sayısını söyler', () => {
    saglikliTopoloji();
    yolEkle({ egimMode: 'segment', routeSegments: [{}, {}, {}] });
    const res = veCollectValidation();
    expect(res.items.some((i) => i.level === 'info' && /3 segment/.test(i.label))).toBe(true);
    expect(res.allOk).toBe(true);
  });

  test('sabit eğim girilmişse değerini söyler', () => {
    saglikliTopoloji(); yolEkle({ grade: 6.5 });
    const res = veCollectValidation();
    expect(res.items.some((i) => i.level === 'info' && /%6\.5/.test(i.label))).toBe(true);
  });

  test('eğim %0 ise "girilmedi" olarak okunur (0 geçerli ama bilgi aynı)', () => {
    saglikliTopoloji(); yolEkle({ grade: 0 });
    const res = veCollectValidation();
    expect(res.items.some((i) => i.level === 'info' && /düz yol/.test(i.label))).toBe(true);
    expect(res.allOk).toBe(true);
  });
});

describe('kaynak sözleşmesi: doğrulama, panelin YAZDIĞI anahtarı okur', () => {
  // Üç hatanın kökü aynıydı: doğrulama, gerçeğin kendi kopyasını tutuyordu.
  // Bu testler kaynak tarayarak sözleşmeyi sabitliyor.
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.join(__dirname, '../../');
  const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

  test('solver.js kendi bağımsız-tip listesini TANIMLAMIYOR', () => {
    const src = oku('js/solver.js');
    // Elle yazılmış tip dizisi (ör. ['vehicle','road',...]) geri gelmesin.
    expect(src).not.toMatch(/standaloneTypes\s*=\s*\[\s*'/);
    expect(src).toMatch(/VE_STANDALONE_TYPES/);
  });

  test('araç kütlesi anahtarı hem panelde hem çözücüde hem doğrulamada aynı', () => {
    expect(oku('js/component-extras.js')).toMatch(/\.data\.ftGVW\s*=/);   // panel yazar
    expect(oku('js/ft-performance.js')).toMatch(/vd\.ftGVW/);               // çözücü okur
    expect(oku('js/solver.js')).toMatch(/vd\.ftGVW/);                       // doğrulama okur
  });

  test('doğrulama artık data.mass’ı TEK kaynak saymıyor', () => {
    const src = oku('js/solver.js');
    // ftGVW okunmadan doğrudan mass'a bakan eski satır geri gelmesin.
    expect(src).not.toMatch(/vehicleNode\.data\.mass\s*>\s*0/);
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
