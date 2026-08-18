/**
 * fead-model.test.js — TOPOLOJİ → ÇEKİRDEK KÖPRÜSÜ
 *
 * En değerli test bu dosyanın en altında: Gates AG00686 raporunu MFSim
 * KANVAS DÜĞÜMÜ olarak kurup (node.data alanları, bağlantılar) köprüden
 * geçirmek ve raporun kendi sayılarını geri almak. Çekirdeğin doğru olduğunu
 * tests/unit/fead-core.test.js zaten kanıtlıyor; BURADA kanıtlanan şey
 * KULLANICI ARAYÜZÜNÜN o çekirdeğe doğru veriyi verdiği.
 *
 * Bu ayrım önemli: köprü sessizce yanlış bir alan okusa (ör. pitch yerine dış
 * çap, ya da temas taraflarını ters) çekirdek yine "başarıyla" çözer ve
 * kimse fark etmez. Kapı burada.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

// componentDefs: tip → rol/varsayılan temas tarafı okumasının tek kaynağı.
const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

let _id = 0;
const nd = (type, data, name) => ({
  id: 'n' + ++_id, type, customName: name || null,
  def: componentDefs[type], data: data || {}
});
const link = (a, b) => ({ id: 'c' + a.id + b.id, from: a.id, to: b.id, fromPort: 'output', toPort: 'input' });

describe('veFeadContactOf — temas tarafı üç katmanlı çözülür', () => {
  test('tip varsayılanı: aksesuar kaburgalı, avara ve gergi sırttan', () => {
    expect(veFeadContactOf(nd('fead-alternator'))).toBe('grooved');
    expect(veFeadContactOf(nd('fead-crank'))).toBe('grooved');
    expect(veFeadContactOf(nd('fead-idler'))).toBe('back');
    expect(veFeadContactOf(nd('fead-tensioner'))).toBe('back');
  });

  test('düğümün kendi değeri tip varsayılanını EZER (kullanıcı son sözü söyler)', () => {
    expect(veFeadContactOf(nd('fead-idler', { contact: 'grooved' }))).toBe('grooved');
    expect(veFeadContactOf(nd('fead-alternator', { contact: 'back' }))).toBe('back');
  });

  test('bozuk değer sessizce kabul edilmez, varsayılana düşer', () => {
    expect(veFeadContactOf(nd('fead-idler', { contact: 'saçma' }))).toBe('back');
    expect(veFeadContactOf(nd('fead-alternator', { contact: '' }))).toBe('grooved');
  });

  // componentDefs'te varsayılanı olmayan bir kasnak tipi kalmamalı: eksik
  // varsayılan sessizce 'grooved' olur ve avara/gergi yanlış taraftan sarar.
  test('HER kasnak tipinin componentDefs\'te varsayılanı var', () => {
    Object.keys(componentDefs).filter((t) => componentDefs[t].isFeadPulley).forEach((t) => {
      expect(['grooved', 'back']).toContain(componentDefs[t].feadContact);
    });
  });
});

describe('Sürücülük bir ROL, tip değil', () => {
  test('açık işaret tipin önüne geçer (ikincil tahrikte fan sürücü olabilir)', () => {
    const krank = nd('fead-crank');
    const fan = nd('fead-fan', { driver: true });
    expect(veFeadResolveDriver([krank, fan]).id).toBe(fan.id);
  });

  test('işaret yoksa tipi sürücü olan seçilir', () => {
    const alt = nd('fead-alternator'), krank = nd('fead-crank');
    expect(veFeadResolveDriver([alt, krank]).id).toBe(krank.id);
  });

  test('ne işaret ne tip varsa ilk kasnak; boş listede null', () => {
    const a = nd('fead-alternator'), b = nd('fead-ac');
    expect(veFeadResolveDriver([a, b]).id).toBe(a.id);
    expect(veFeadResolveDriver([])).toBeNull();
  });

  test('kayış sırası sürücüden başlar — sürücü değişince sıra da değişir', () => {
    const krank = nd('fead-crank'), alt = nd('fead-alternator'), ten = nd('fead-tensioner');
    const conns = [link(krank, alt), link(alt, ten), link(ten, krank)];
    expect(veFeadRouteOrder([alt, ten, krank], conns).map((n) => n.id))
      .toEqual([krank.id, alt.id, ten.id]);
    alt.data.driver = true;                       // sürücülüğü alternatöre ver
    expect(veFeadRouteOrder([alt, ten, krank], conns).map((n) => n.id))
      .toEqual([alt.id, ten.id, krank.id]);
  });
});

describe('dia → od göçü (eski kayıtlar)', () => {
  test('eski alan yeni alana taşınır ve silinir', () => {
    const n = nd('fead-crank', { dia: 180, x: 0, y: 0 });
    expect(veFeadMigrateNode(n)).toBe(true);
    expect(n.data.od).toBe(180);
    expect(n.data.dia).toBeUndefined();
  });

  test('yeni alan doluysa kullanıcının değeri KAZANIR, eski alan yine temizlenir', () => {
    const n = nd('fead-crank', { dia: 180, od: 172 });
    veFeadMigrateNode(n);
    expect(n.data.od).toBe(172);
    expect(n.data.dia).toBeUndefined();
  });

  test('göç edilecek bir şey yoksa dokunmaz', () => {
    const n = nd('fead-crank', { od: 172 });
    expect(veFeadMigrateNode(n)).toBe(false);
    expect(n.data.od).toBe(172);
  });

  test('toplu göç kaç düğüm dönüştürdüğünü söyler', () => {
    expect(veFeadMigrateAll([nd('fead-crank', { dia: 1 }), nd('fead-ac', { od: 2 }), nd('fead-idler', { dia: 3 })]))
      .toBe(2);
  });
});

// Çekirdek AD'ları anahtar olarak kullanıyor (loadsKw sözlüğü). İki kasnak
// aynı adı taşırsa güçleri sessizce birleşir → yanlış gerilme dağılımı.
describe('ad tekilleştirme — sessiz güç birleşmesine karşı', () => {
  test('aynı adlı iki avara ayrışır', () => {
    const a = nd('fead-idler', {}, 'Avara'), b = nd('fead-idler', {}, 'Avara');
    const u = veFeadUniqueNames([a, b]);
    expect(u.names).toEqual(['Avara', 'Avara (2)']);
    expect(u.byName['Avara']).toBe(a.id);
    expect(u.byName['Avara (2)']).toBe(b.id);
  });

  test('adsız düğümler tip adından türer ve yine tekilleşir', () => {
    const u = veFeadUniqueNames([nd('fead-idler'), nd('fead-idler'), nd('fead-idler')]);
    expect(new Set(u.names).size).toBe(3);
  });
});

describe('hata çevirisi — çekirdeğin teşhis dili kullanıcı diline', () => {
  test('sarım değişmezi hatası "ne yapmalıyım"a çevrilir', () => {
    const t = veFeadTranslateError(
      'FEADCore/geometri: isaretli sarim toplami 0.00 (360 olmali). Kasnak sirasi...');
    expect(t).toMatch(/bağlantı sırası/i);
    expect(t).toMatch(/temas tarafı/i);
    expect(t).not.toMatch(/FEADCore/);
  });

  test('eksik gergi alanı adıyla söylenir', () => {
    expect(veFeadTranslateError('FEADCore: tensioner.armLength gerekli'))
      .toBe('Gergi panelinde eksik alan: armLength');
  });

  // Bilinmeyen bir hatayı yutmak, yanlış çevirmekten kötüdür.
  test('eşleşmeyen mesaj yutulmaz, yalnız önek temizlenir', () => {
    expect(veFeadTranslateError('FEADCore/xyz: bambaska bir sey')).toBe('bambaska bir sey');
    expect(veFeadTranslateError('düz metin')).toBe('düz metin');
  });
});

describe('veFeadBuildSystem — eksik girdide İSTİSNA ATMAZ, sayar', () => {
  test('boş topoloji: hata listesi dolu, sys null, patlamıyor', () => {
    const r = veFeadBuildSystem([], []);
    expect(r.ok).toBe(false);
    expect(r.sys).toBeNull();
    expect(r.errors.join(' ')).toMatch(/kasnak yok/i);
  });

  test('gergisiz model gergiyi ister', () => {
    const r = veFeadBuildSystem([nd('fead-crank', { od: 180, x: 0, y: 0 }),
                                 nd('fead-alternator', { od: 60, x: 100, y: 100 })], []);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Gergi yok/i);
  });

  test('konumu girilmemiş kasnak adıyla bildirilir', () => {
    const k = nd('fead-crank', { od: 180 }, 'Krank');
    const r = veFeadBuildSystem([k, nd('fead-ac', { od: 120, x: 1, y: 1 }), nd('fead-tensioner', { od: 75 })], []);
    expect(r.errors.join(' ')).toMatch(/"Krank" kasnağının konumu/);
  });

  test('çapı girilmemiş kasnak UYARI üretir (hata değil) — şema yine çizilebilsin', () => {
    const k = nd('fead-crank', { x: 0, y: 0 }, 'Krank');
    const r = veFeadBuildSystem([k], []);
    expect(r.warnings.join(' ')).toMatch(/"Krank" dış çapı girilmedi/);
  });

  test('iki kasnak "Sürücü" işaretliyse reddedilir', () => {
    const a = nd('fead-crank', { od: 180, x: 0, y: 0, driver: true });
    const b = nd('fead-fan', { od: 150, x: 200, y: 0, driver: true });
    const r = veFeadBuildSystem([a, b, nd('fead-tensioner', { od: 75 })], []);
    expect(r.errors.join(' ')).toMatch(/Birden fazla kasnak "Sürücü"/);
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════
 *  UÇTAN UCA: Gates AG00686, MFSim kanvas düğümü olarak kurulup köprüden
 *  geçirilince raporun kendi sayılarını veriyor mu?
 * ════════════════════════════════════════════════════════════════════════
 * Referans (Gates AG00686, 8PK1475HD, 4 kasnak) — rapordan:
 *   span  CRK 249.2  IDR 212.6  A_C 248.9  TEN 212.6   [mm]
 *   sarım CRK 210.2  IDR  26.7  A_C 202.9  TEN  26.4   [°]
 *   ortalama konumda take-up 0.559 mm/° · tasarım gerginliği 765.7 N
 * Kasnak çapları rapordaki pitch/eff değerlerinden DIŞ ÇAPA çevrildi
 * (kaburgalı OD = 2·rEff, sırttan OD = 2·(rPitch − hr)) — kullanıcı arayüzü
 * dış çap istiyor, çekirdek yarıçapları kendi türetiyor. Zincir tam olarak bu.
 */
describe('uçtan uca: AG00686 kanvas düğümlerinden Gates sayıları', () => {
  const REF = {
    span: { CRK: 249.2, IDR: 212.6, A_C: 248.9, TEN: 212.6 },
    wrap: { CRK: 210.2, IDR: 26.7, A_C: 202.9, TEN: 26.4 },
    takeupMean: 0.559, designN: 765.7, relMean: 33.1
  };

  function kur() {
    // Gates Layout Data: CRK rEff 80 → OD 160 (kaburgalı)
    //                    IDR/TEN rPitch 38.6, hr 1.1 → OD 75 (sırttan)
    //                    A_C rEff 63.5 → OD 127 (kaburgalı)
    const crk = nd('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = nd('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = nd('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = nd('fead-tensioner', {
      od: 75, pivotX: -180, pivotY: 100, armLen: 90,
      preload: 8.59, kArm: 0.482, freeAngleDeg: 42, sense: 1, loadStopRelDeg: 62.4
    }, 'TEN');
    const belt = nd('fead-belt', {
      profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6, wearPct: 0.007
    });
    // lengthOffsetMm TASARIM BAŞINA kalibrasyon girdisidir (SPEC §3.6): kuralı
    // bilinmiyor, EDL(Mean) − L_nominal olarak bulunur. AG00686 için 3.50 mm.
    const solver = nd('fead-solver', { designTensionN: REF.designN, driveRatio: 1, lengthOffsetMm: 3.5 });
    const list = [crk, idr, ac, ten, belt, solver];
    // Kayış yolu: bağlantılar. Sıra kanvasta kullanıcının çizdiği yol.
    const conns = [link(crk, idr), link(idr, ac), link(ac, ten), link(ten, crk)];
    return { list, conns, crk, idr, ac, ten };
  }

  test('köprü sistemi kurabiliyor, hata yok', () => {
    const r = veFeadBuildSystem(kur().list, kur().conns);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('kayış sırası CRK → IDR → A_C → TEN', () => {
    const b = kur();
    expect(veFeadBuildSystem(b.list, b.conns).names).toEqual(['CRK', 'IDR', 'A_C', 'TEN']);
  });

  test('dış çaplardan türeyen yarıçaplar Gates Layout Data ile aynı', () => {
    const b = kur();
    const sys = veFeadBuildSystem(b.list, b.conns).sys;
    const p = {}; sys.pulleys.forEach((x) => { p[x.name] = x; });
    expect(p.CRK.rPitch).toBeCloseTo(81.2, 6);   // 160/2 + 1.2
    expect(p.CRK.rEff).toBeCloseTo(80.0, 6);
    expect(p.IDR.rPitch).toBeCloseTo(38.6, 6);   // 75/2 + 1.1
    expect(p.IDR.rEff).toBeCloseTo(39.8, 6);
    expect(p.A_C.rPitch).toBeCloseTo(64.7, 6);
    expect(p.A_C.rEff).toBeCloseTo(63.5, 6);
  });

  test('span boyları raporla %0.5 içinde', () => {
    const b = kur();
    const sys = veFeadBuildSystem(b.list, b.conns).sys;
    const g = F.tensionerState(sys, REF.relMean).geom;
    g.names.forEach((nm, i) => {
      const hata = Math.abs(g.exitSpanLen(i) - REF.span[nm]) / REF.span[nm] * 100;
      expect({ kasnak: nm, hataPct: +hata.toFixed(3) }).toMatchObject({ kasnak: nm });
      expect(hata).toBeLessThan(0.5);
    });
  });

  test('sarım açıları raporla 0.2° içinde — TEMAS TARAFI DOĞRU OKUNDU demek', () => {
    const b = kur();
    const sys = veFeadBuildSystem(b.list, b.conns).sys;
    const g = F.tensionerState(sys, REF.relMean).geom;
    g.names.forEach((nm, i) => {
      expect(Math.abs(g.wrapDeg(i) - REF.wrap[nm])).toBeLessThan(0.2);
    });
  });

  test('gergi dengesi: ortalama konumda take-up ve gerginlik raporla uyuşuyor', () => {
    const b = kur();
    const sys = veFeadBuildSystem(b.list, b.conns).sys;
    const st = F.tensionerState(sys, REF.relMean);
    expect(Math.abs(st.takeupMmPerDeg - REF.takeupMean) / REF.takeupMean * 100).toBeLessThan(0.5);
    expect(Math.abs(st.tensionN - REF.designN) / REF.designN * 100).toBeLessThan(0.5);
  });

  // TEMAS TARAFI TERSİNE ÇEVRİLİRSE NE OLUR? Çekirdek yine ÇÖZER (kapalı
  // çevrim, sarım değişmezi tutar) ama BAŞKA bir yol bulur. Spesifikasyonun
  // "sessizce yanlış tasarım" uyarısı tam olarak bu. Test onu belgeliyor:
  // kod hata vermiyor, sonuç sessizce kayıyor → o yüzden kanvasta rozet var.
  test('ters temas tarafı hata VERMEZ ama sarımı bozar (rozetin varlık nedeni)', () => {
    const b = kur();
    b.idr.data.contact = 'grooved';               // avarayı yanlışlıkla kaburgalı yap
    const r = veFeadBuildSystem(b.list, b.conns);
    expect(r.ok).toBe(true);                      // ← hata YOK
    const g = F.tensionerState(r.sys, REF.relMean).geom;
    const i = g.names.indexOf('IDR');
    expect(Math.abs(g.wrapDeg(i) - REF.wrap.IDR)).toBeGreaterThan(1);   // ← ama sonuç yanlış
  });

  test('yanlış bağlantı sırası sarım değişmeziyle YAKALANIR', () => {
    const b = kur();
    const bozuk = [link(b.crk, b.ac), link(b.ac, b.idr), link(b.idr, b.ten), link(b.ten, b.crk)];
    const r = veFeadBuildSystem(b.list, bozuk);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Kayış yolu kapanmıyor|kasnağın içinden|teğet/i);
  });

  test('konum tablosu üretiliyor, Mean kol açısı Gates ile 0.2° içinde', () => {
    const b = kur();
    const sys = veFeadBuildSystem(b.list, b.conns).sys;
    const rows = F.positionTable(sys);
    const mean = rows.filter((r) => r.position === 'Mean')[0];
    expect(mean).toBeDefined();
    expect(mean.error).toBeUndefined();
    expect(Math.abs(mean.relDeg - REF.relMean)).toBeLessThan(0.2);
    expect(rows.map((r) => r.position)).toEqual(
      ['FreeArm', 'Replace', 'MaxBelt', 'Mean', 'MinBelt', 'Load']);
  });

  // Boy ofseti neden bir GİRDİ: sıfır bırakılırsa kol açısı 6.5° kayıyor.
  // Kuralı bilinmediği için uydurulmuyor, kullanıcıdan alınıyor (SPEC §3.6) —
  // ve çekirdek onu bilinen bir referanstan kalibre edebiliyor.
  test('boy ofseti sıfırken kol açısı kayar; kalibrasyon 3.50 mm buluyor', () => {
    const b = kur();
    const sifir = b.list.map((n) => (n.type === 'fead-solver'
      ? Object.assign({}, n, { data: Object.assign({}, n.data, { lengthOffsetMm: 0 }) }) : n));
    const sysSifir = veFeadBuildSystem(sifir, b.conns).sys;
    expect(Math.abs(F.meanRel(sysSifir) - REF.relMean)).toBeGreaterThan(5);
    expect(F.calibrateLengthOffset(sysSifir, { relDeg: REF.relMean, beltLengthMm: 1475 }))
      .toBeCloseTo(3.5, 2);
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════
 *  ÇALIŞMA ÇEVRİMİ VE ÇÖZÜM (Aşama 2)
 * ════════════════════════════════════════════════════════════════════════
 * Referans: Gates AG00686'nın duty tablosu. Rapor her devir için kasnak
 * başına ÇIKIŞ GERİLMESİ ve HUBLOAD basıyor:
 *
 *   rpm   A_C[kW]   T: CRK  IDR  A_C  TEN     H: CRK  IDR  A_C  TEN
 *   800     3       1210 1208  767  766       1911  557 1938  350
 *   1250    5       1238 1237  767  766       1939  571 1966  349
 *   2000    8.2     1249 1248  766  766       1949  576 1977  349
 *
 * Sürücü (CRK) gücü GİRİLMEZ — çekirdek diğerlerinin toplamı olarak
 * hesaplar. Avara ve gergi 0.01 kW (rulman sürtünmesi).
 */
describe('duty cycle → çekirdek: AG00686 gerilme tablosu', () => {
  const REF = {
    800:  { kw: 3,   T: [1210, 1208, 767, 766], H: [1911, 557, 1938, 350] },
    1250: { kw: 5,   T: [1238, 1237, 767, 766], H: [1939, 571, 1966, 349] },
    2000: { kw: 8.2, T: [1249, 1248, 766, 766], H: [1949, 576, 1977, 349] }
  };

  function kur(dutyRows) {
    const crk = nd('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = nd('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = nd('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = nd('fead-tensioner', {
      od: 75, pivotX: -180, pivotY: 100, armLen: 90,
      preload: 8.59, kArm: 0.482, freeAngleDeg: 42, sense: 1, loadStopRelDeg: 62.4
    }, 'TEN');
    const belt = nd('fead-belt', {
      profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6, wearPct: 0.007
    });
    const sv = nd('fead-solver', {
      designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5, cylinders: 6,
      duty: (dutyRows || []).map((r) => ({
        rpm: r.rpm, dcPct: r.dcPct, degC: 92,
        kw: { [ac.id]: r.kw, [idr.id]: 0.01, [ten.id]: 0.01 }
      }))
    });
    const list = [crk, idr, ac, ten, belt, sv];
    const conns = [[crk, idr], [idr, ac], [ac, ten], [ten, crk]].map(([a, b]) => link(a, b));
    return { list, conns, sv, ac, idr, ten, crk };
  }

  test('kW sözlüğü DÜĞÜM KİMLİĞİYLE anahtarlanır, çekirdeğe ADLA geçer', () => {
    const b = kur([{ rpm: 1250, dcPct: 100, kw: 5 }]);
    const build = veFeadBuildSystem(b.list, b.conns);
    const duty = veFeadDutyToCore(build, veFeadDutyRows(b.sv));
    expect(duty).toHaveLength(1);
    expect(Object.keys(duty[0].loadsKw).sort()).toEqual(['A_C', 'IDR', 'TEN']);
    expect(duty[0].loadsKw.A_C).toBe(5);
    // Sürücü sözlükte YOK: çekirdek onu toplamdan hesaplıyor.
    expect(duty[0].loadsKw.CRK).toBeUndefined();
  });

  // Kimlikle anahtarlamanın nedeni: kullanıcı kasnağı yeniden adlandırdığında
  // girdiği güç kaybolmasın. Adla anahtarlanırsa sessizce 0'a düşerdi.
  test('kasnak yeniden adlandırılınca girilen güç KAYBOLMAZ', () => {
    const b = kur([{ rpm: 1250, dcPct: 100, kw: 5 }]);
    b.ac.customName = 'Klima (yeni ad)';
    const build = veFeadBuildSystem(b.list, b.conns);
    const duty = veFeadDutyToCore(build, veFeadDutyRows(b.sv));
    expect(duty[0].loadsKw['Klima (yeni ad)']).toBe(5);
  });

  test('devri 0/boş olan satır çözüme girmez (kayış hızı sıfır olurdu)', () => {
    const b = kur([{ rpm: 0, dcPct: 10, kw: 5 }, { rpm: 1250, dcPct: 90, kw: 5 }]);
    const build = veFeadBuildSystem(b.list, b.conns);
    expect(veFeadDutyToCore(build, veFeadDutyRows(b.sv))).toHaveLength(1);
  });

  test('çıkış gerilmeleri Gates duty tablosuyla %0.5 içinde', () => {
    const rows = Object.keys(REF).map((r) => ({ rpm: +r, dcPct: 100 / 3, kw: REF[r].kw }));
    const b = kur(rows);
    const build = veFeadBuildSystem(b.list, b.conns);
    const res = veFeadAnalyze(build, { rows: veFeadDutyRows(b.sv), cylinders: 6 });
    expect(res.ok).toBe(true);
    res.analysis.duty.forEach((d) => {
      const ref = REF[d.engineRpm].T;
      d.perPulley.forEach((p, i) => {
        const hata = Math.abs(p.exitTensionN - ref[i]) / ref[i] * 100;
        expect({ rpm: d.engineRpm, kasnak: p.name, hesap: +p.exitTensionN.toFixed(1), ref: ref[i] })
          .toMatchObject({ rpm: d.engineRpm });
        expect(hata).toBeLessThan(0.5);
      });
    });
  });

  test('hubload büyüklükleri Gates duty tablosuyla %0.5 içinde', () => {
    const rows = Object.keys(REF).map((r) => ({ rpm: +r, dcPct: 100 / 3, kw: REF[r].kw }));
    const b = kur(rows);
    const res = veFeadAnalyze(veFeadBuildSystem(b.list, b.conns),
      { rows: veFeadDutyRows(b.sv), cylinders: 6 });
    res.analysis.duty.forEach((d) => {
      const ref = REF[d.engineRpm].H;
      d.hubloads.forEach((x, i) => {
        expect(Math.abs(x.FN - ref[i]) / ref[i] * 100).toBeLessThan(0.5);
      });
    });
  });

  test('sürücü gücü diğerlerinin toplamı (çevrim kapanır)', () => {
    const b = kur([{ rpm: 1250, dcPct: 100, kw: 5 }]);
    const res = veFeadAnalyze(veFeadBuildSystem(b.list, b.conns),
      { rows: veFeadDutyRows(b.sv) });
    const pp = res.analysis.duty[0].perPulley;
    const crk = pp.filter((p) => p.name === 'CRK')[0];
    expect(crk.powerKw).toBeCloseTo(5 + 0.01 + 0.01, 9);
  });

  test('ateşleme frekansı silindir sayısından: 1250 rpm, 6 sil. → 62.5 Hz', () => {
    const b = kur([{ rpm: 1250, dcPct: 100, kw: 5 }]);
    const res = veFeadAnalyze(veFeadBuildSystem(b.list, b.conns),
      { rows: veFeadDutyRows(b.sv), cylinders: 6 });
    expect(res.analysis.duty[0].firingHz).toBeCloseTo(62.5, 6);
  });

  // Yorulma dağılımı ÇAPA ve TEMAS TARAFINA bağlı, gerilmeden bağımsız.
  // AG00686 raporu: CRK 2.6 · IDR 43.3 · A_C 10.8 · TEN 43.3 (IDR ile TEN
  // birebir eşit — ikisi de ø79.6, sırttan; gerilmeleri çok farklı olsa bile).
  test('yorulma dağılımı: aynı çap + aynı temas → AYNI pay', () => {
    const rows = Object.keys(REF).map((r) => ({ rpm: +r, dcPct: 100 / 3, kw: REF[r].kw }));
    const b = kur(rows);
    const res = veFeadAnalyze(veFeadBuildSystem(b.list, b.conns),
      { rows: veFeadDutyRows(b.sv), fatigueModel: 'PK-2_2p-MT3' });
    expect(res.fatigue).toBeTruthy();
    const pay = {};
    res.fatigue.perPulley.forEach((p) => { pay[p.name] = p.sharePct; });
    expect(pay.IDR).toBeCloseTo(pay.TEN, 6);
    // Küçük çap en çok hasarı alır; krank en az.
    expect(pay.IDR).toBeGreaterThan(pay.A_C);
    expect(pay.A_C).toBeGreaterThan(pay.CRK);
    expect(Object.values(pay).reduce((a, x) => a + x, 0)).toBeCloseTo(100, 6);
  });

  test('B10 ömrü hesaplanıyor ve geçerlilik alanı bildiriliyor', () => {
    const rows = Object.keys(REF).map((r) => ({ rpm: +r, dcPct: 100 / 3, kw: REF[r].kw }));
    const b = kur(rows);
    const res = veFeadAnalyze(veFeadBuildSystem(b.list, b.conns), { rows: veFeadDutyRows(b.sv) });
    expect(res.life).toBeTruthy();
    expect(res.life.hoursB10).toBeGreaterThan(0);
    // AG00686'nın çapları (79.6 / 137 / 160) geçerlilik alanı içinde
    expect(res.life.inValidRange).toBe(true);
  });

  // Geçerlilik sınırları SONUCUN İÇİNDE taşınır; dipnotta bırakılmaz.
  test('geçerlilik sınırları her koşuda sonuca ekleniyor', () => {
    const b = kur([{ rpm: 1250, dcPct: 100, kw: 5 }]);
    const res = veFeadAnalyze(veFeadBuildSystem(b.list, b.conns), { rows: veFeadDutyRows(b.sv) });
    const t = res.limits.join(' ');
    expect(t).toMatch(/Doğal frekans/);
    expect(t).toMatch(/KARŞILAŞTIRILAMAZ/);
    expect(t).toMatch(/yarı-statik/);
  });

  test('boş çevrimde analiz patlamaz, uyarı verir', () => {
    const b = kur([]);
    const res = veFeadAnalyze(veFeadBuildSystem(b.list, b.conns), { rows: [] });
    expect(res.ok).toBe(true);
    expect(res.duty).toEqual([]);
    expect(res.warnings.join(' ')).toMatch(/Çalışma çevrimi boş/);
  });

  test('çözülemeyen modelde analiz hata döndürür, istisna atmaz', () => {
    const res = veFeadAnalyze(veFeadBuildSystem([], []), { rows: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});

// Katalog bağı: aksesuar devri KASNAK ÇAPLARINDAN gelmeli, preset'in elle
// yazılmış driveRatio'sundan DEĞİL. Spesifikasyon §2.3'ün Excel hatası bu.
describe('katalog bağı — oran çaptan hesaplanır', () => {
  test('aksesuar devri pitch çap oranıyla, preset driveRatio ile DEĞİL', () => {
    global.VE_ALTERNATOR_PRESETS = {
      test_alt: { name: 'Test', driveRatio: 99, curve: [{ rpm: 0, kw: 0 }, { rpm: 10000, kw: 10 }] }
    };
    global.veAccInterpCurve = (curve, x) => {
      if (x <= curve[0].rpm) return curve[0].kw;
      const last = curve[curve.length - 1];
      if (x >= last.rpm) return last.kw;
      const t = (x - curve[0].rpm) / (last.rpm - curve[0].rpm);
      return curve[0].kw + t * (last.kw - curve[0].kw);
    };
    const crk = nd('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const alt = nd('fead-alternator', { od: 60, x: -72, y: 267, accPreset: 'test_alt' }, 'ALT');
    const ten = nd('fead-tensioner', {
      od: 75, pivotX: -180, pivotY: 100, armLen: 90,
      preload: 8.59, kArm: 0.482, freeAngleDeg: 42, sense: 1
    }, 'TEN');
    const belt = nd('fead-belt', { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 900, tolerance: 6 });
    const sv = nd('fead-solver', { designTensionN: 700, driveRatio: 1 });
    const build = veFeadBuildSystem([crk, alt, ten, belt, sv],
      [link(crk, alt), link(alt, ten), link(ten, crk)]);
    expect(build.ok).toBe(true);
    const i = build.names.indexOf('ALT');
    // pitch oranı = 81.2 / 31.2 = 2.6026 → 1000 rpm motorda ALT 2602.6 rpm
    const beklenenRpm = F.accessoryRpm(build.sys, i, 1000);
    expect(beklenenRpm).toBeCloseTo(1000 * 81.2 / 31.2, 3);
    // kW eğrisi lineer 0→10 arası 0..10000 rpm → 2602.6 rpm'de 2.6026 kW
    expect(veFeadAutoKw(build.sys, i, alt, 1000)).toBeCloseTo(beklenenRpm / 1000, 3);
    // preset'in driveRatio'su 99 — kullanılsaydı 99000 rpm ve 10 kW çıkardı
    expect(veFeadAutoKw(build.sys, i, alt, 1000)).not.toBeCloseTo(10, 1);
    delete global.VE_ALTERNATOR_PRESETS; delete global.veAccInterpCurve;
  });

  test('katalog seçilmemişse (elle) null döner — 0 sayılır', () => {
    expect(veFeadPresetOf(nd('fead-alternator', {}))).toBeNull();
    expect(veFeadPresetOf(nd('fead-alternator', { accPreset: '__manual__' }))).toBeNull();
    expect(veFeadPresetLib('fead-idler')).toBeNull();       // avaranın kataloğu yok
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  SICAKLIK KAPISI — satır başına °C → çekirdeğin istediği TEK °C
// ════════════════════════════════════════════════════════════════════════════
// Çekirdeğin beltLifeB10'u sıcaklığı TOPLAM geçiş sayısını çarpan tek bir sayı
// olarak alıyor; duty tablosu ise sıcaklığı SATIR BAŞINA soruyor. Aradaki
// indirgeme köprüde ve iki kez yanlıştı:
//   (a) `d.dcPct || 100/n` ifadesi AÇIKÇA 0 girilen yüzdeyi "girilmemiş"
//       sayıyordu — ağırlıklar 1'e toplanmıyordu;
//   (b) sıcaklıkların ARİTMETİK ortalaması alınıyordu, oysa hasar 2^(ΔT/23)
//       ile büyüyor: dışbükey bir fonksiyonun ortalaması ortalamanın
//       fonksiyonundan büyüktür (Jensen), yani ömür HEP UZUN çıkıyordu.
describe('veFeadDutyDegC — hasar-eşdeğer sıcaklık', () => {
  const bmc = () => {
    const ex = veFeadExampleNodes('BMC_FEAD_2026');
    ex.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const build = veFeadBuildSystem(ex.nodes, ex.connections);
    expect(build.ok).toBe(true);
    const solv = ex.nodes.find((n) => n.type === 'fead-solver');
    return { build, rows: veFeadDutyRows(solv) };
  };

  test('tek sıcaklıklı tablo TAM O SICAKLIĞI verir (yaklaşıklık değil)', () => {
    const { build, rows } = bmc();
    const duty = veFeadDutyToCore(build, rows);
    expect(duty.every((d) => d.degC === 90)).toBe(true);
    // log2(2^x) = x → tek sıcaklıkta indirgeme birim işlemdir. Bu, mevcut
    // doğrulanmış sonuçların (Gates tabloları) kaymadığının kapısı.
    expect(veFeadDutyDegC(build.sys, duty)).toBeCloseTo(90, 10);
  });

  test('sıcaklık dağılınca ARİTMETİK ORTALAMANIN ÜSTÜNDE oturur', () => {
    const { build, rows } = bmc();
    const spread = [70, 75, 80, 85, 90, 95, 100, 105, 110];
    const duty = veFeadDutyToCore(build, rows.map((r, i) => ({ ...r, degC: spread[i] })));
    const eq = veFeadDutyDegC(build.sys, duty);

    // Çekirdeğin modeliyle ELDE kurulan hasar toplamına birebir eşit olmalı.
    const FA = F.FATIGUE.absolute;
    const L = build.sys.belt.effLength / 1000;
    let w = 0, dmg = 0;
    duty.forEach((d) => {
      const p = (d.dcPct / 100) * (F.spanTensions(build.sys, d).vMs / L);
      w += p; dmg += p * Math.pow(2, (d.degC - FA.refDegC) / FA.halvingDegC);
    });
    const beklenen = FA.refDegC + FA.halvingDegC * Math.log2(dmg / w);
    expect(eq).toBeCloseTo(beklenen, 9);

    // Ölçülmüş büyüklük: dc ağırlıklı aritmetik ortalama 89.4 °C (BMC'nin
    // yüzdeleri düz değil), hasar-eşdeğer ~96.7 °C.
    const aritmetik = duty.reduce((a, d) => a + d.degC * (d.dcPct / 100), 0);
    expect(aritmetik).toBeCloseTo(89.4, 6);
    expect(eq).toBeGreaterThan(aritmetik + 5);
    expect(eq).toBeCloseTo(96.7, 1);

    // ve bu ömre geçiyor: eski davranış ömrü ~1.25× uzun gösteriyordu.
    const dogru = F.beltLifeB10(build.sys, { duty, degC: eq }).hoursB10;
    const eski = F.beltLifeB10(build.sys, { duty, degC: aritmetik }).hoursB10;
    expect(eski / dogru).toBeGreaterThan(1.2);
    expect(veFeadAnalyze(build, { rows: rows.map((r, i) => ({ ...r, degC: spread[i] })) })
      .life.hoursB10).toBeCloseTo(dogru, 6);
  });

  test('AĞIRLIK dc DEĞİL, GEÇİŞ SAYISI (dc·v) — mutasyon kapısı', () => {
    const { build, rows } = bmc();
    // Sıcak nokta YÜKSEK devirde: dc ile ağırlıklandırmak onu hafife alır.
    const duty = veFeadDutyToCore(build, rows.map((r) => ({ ...r, degC: r.rpm >= 2000 ? 115 : 75 })));
    const eq = veFeadDutyDegC(build.sys, duty);
    const FA = F.FATIGUE.absolute;
    // Aynı formül ama v'siz (yalnız dc) — ayrışmalı, yoksa test kör olurdu.
    let w = 0, dmg = 0;
    duty.forEach((d) => {
      const p = d.dcPct / 100;
      w += p; dmg += p * Math.pow(2, (d.degC - FA.refDegC) / FA.halvingDegC);
    });
    const dcIle = FA.refDegC + FA.halvingDegC * Math.log2(dmg / w);
    expect(Math.abs(eq - dcIle)).toBeGreaterThan(0.5);
    expect(eq).toBeGreaterThan(dcIle);          // hızlı = sıcak → geçişler ağır basar
  });

  test('AÇIKÇA %0 girilen satır SIFIR ağırlıklıdır (0 "girilmemiş" değildir)', () => {
    const { build, rows } = bmc();
    // Tedarikçi sayfasında 3000 rpm satırı %0 yazıyor. Eklenince sıcaklığı
    // değiştirmemeli: ağırlığı sıfır.
    const temiz = veFeadDutyDegC(build.sys, veFeadDutyToCore(build, rows));
    const sifirli = veFeadDutyDegC(build.sys,
      veFeadDutyToCore(build, rows.concat([{ rpm: 3000, dcPct: 0, degC: 200, kw: {} }])));
    expect(sifirli).toBeCloseTo(temiz, 9);
    // ESKİ DAVRANIŞ: 200 °C'lik %0 satırı ortalamayı yukarı çekerdi.
    expect(sifirli).toBeLessThan(95);
  });

  test('yüzdelerin HEPSİ boşken patlamaz — düz ortalamaya düşer', () => {
    const { build, rows } = bmc();
    const bos = rows.map((r) => ({ ...r, dcPct: 0 }));
    const duty = veFeadDutyToCore(build, bos);
    // ESKİ DAVRANIŞ: 1000 °C (ağırlıklar 1 yerine 100/n'e toplanıyordu).
    expect(veFeadDutyDegC(build.sys, duty)).toBeCloseTo(90, 6);
    const R = veFeadAnalyze(build, { rows: bos });
    expect(R.degCEq).toBeCloseTo(90, 6);
    // ve sebebi yazılır: hasar sıfır olduğu için ömür kartı "—" gösterecek.
    expect(R.warnings.join(' ')).toMatch(/%zaman/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  YORULMA MODELİ ↔ MUTLAK ÖMÜR — kalibrasyon sabiti üsse bağlı
// ════════════════════════════════════════════════════════════════════════════
// Panel iki yorulma modeli sunuyor (m = 5.6 ↔ 4.05) ve seçim DAĞILIMA geçiyor.
// Mutlak ömre GEÇEMEZ: beltLifeB10'un C sabiti Σ w·d^(−m) ölçeğini soğuruyor,
// üs değişince ömür yüzlerce kat kayar (ölçüldü: BMC 992 → 1.1 saat). Doğru
// davranış sessizce 5.6 kullanmak DEĞİL, kullandığını SÖYLEMEK.
describe('B10 ömrü ↔ seçili yorulma modeli', () => {
  const bmc = () => {
    const ex = veFeadExampleNodes('BMC_FEAD_2026');
    ex.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const build = veFeadBuildSystem(ex.nodes, ex.connections);
    const solv = ex.nodes.find((n) => n.type === 'fead-solver');
    return { build, rows: veFeadDutyRows(solv) };
  };

  test('kalibre model seçiliyken uyarı YOK', () => {
    const { build, rows } = bmc();
    const R = veFeadAnalyze(build, { rows, fatigueModel: VE_FEAD_LIFE_FATIGUE_MODEL });
    expect(R.life.modelMismatch).toBeUndefined();
    expect(R.limits.join(' ')).not.toMatch(/Mutlak B10 ömrü/);
  });

  test('başka model seçiliyken DAĞILIM değişir, ömür değişmez — ve bu YAZILIR', () => {
    const { build, rows } = bmc();
    const p = veFeadAnalyze(build, { rows, fatigueModel: 'PK-2_2p-MT3' });
    const a = veFeadAnalyze(build, { rows, fatigueModel: 'PK-2_2a-MT3' });

    // dağılım gerçekten seçilen modeli kullanıyor
    expect(a.fatigue.constants.m).toBeCloseTo(4.05, 6);
    expect(p.fatigue.constants.m).toBeCloseTo(5.6, 6);
    expect(a.fatigue.perPulley[0].sharePct).not.toBeCloseTo(p.fatigue.perPulley[0].sharePct, 1);

    // ömür ise AYNI kaldı (C bu üsse kalibre) — sessiz kalması yasak
    expect(a.life.hoursB10).toBeCloseTo(p.life.hoursB10, 6);
    expect(a.life.modelMismatch).toBe('PK-2_2a-MT3');
    expect(a.life.calibratedModel).toBe('PK-2_2p-MT3');
    expect(a.limits.join(' ')).toMatch(/Mutlak B10 ömrü/);
    expect(a.limits.join(' ')).toMatch(/PK-2_2a-MT3/);
  });

  test('bilinmeyen model adı limits satırına SIZMAZ (HTML olarak basılıyor)', () => {
    const { build, rows } = bmc();
    const R = veFeadAnalyze(build, { rows, fatigueModel: '<img src=x onerror=1>' });
    expect(R.limits.join(' ')).not.toMatch(/<img/);
    expect(R.warnings.join(' ')).toMatch(/[Yy]orulma dağılımı/);   // çekirdek reddetti
  });
});
