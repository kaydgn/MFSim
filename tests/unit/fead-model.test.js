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
