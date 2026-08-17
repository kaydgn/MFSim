/**
 * cp-fead.test.js — FEAD (motor ön uç kayış-kasnak sistemi) modülü
 *
 * Bu dosya modülün İSKELETİNİ değil, iskeletin SAYISAL/YAPISAL çekirdeğini
 * tutar (CLAUDE.md test politikası: mantık ve matematiğe test, HTML dizgisine
 * hayır):
 *
 *   1. veFeadBeltPath — kayış çevresinin GEOMETRİSİ. Kasnaklar arası dış teğet
 *      ve sarım yayı analitik çözülüyor; burada sessiz bir hata "makul ama
 *      yanlış" bir kayış yolu çizer, gözle yakalanmaz. Referans değerler elde
 *      türetildi (bkz. testteki ara hesap).
 *   2. veFeadRouteOrder — kayışın uğrama sırası. FEAD'de bağlantı = kayış yolu;
 *      sıra kayarsa sarım açıları ve kayış boyu topluca yanlış çıkar.
 *   3. Alt-sistem sözleşmesi — modül panelinin "Alt Topolojiyi Aç" kancası ve
 *      çift tık kapısı. Diğer iki modülde bu kancalar birer kez kırıldı.
 */
const fead = require('../../js/cp-fead.js');

// componentDefs, cp-fead.js'in tipten rol okuduğu tek kaynak (isFeadDriver…).
// Gerçek dosyadan yüklenir; testte elle sahte tanım tutmak ikinci bir gerçek
// kaynak yaratırdı.
const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

// ── Yardımcı: gerçek tip tanımını taşıyan kasnak düğümü ────────────────────
let _id = 0;
const kasnak = (type, data, name) => ({
  id: 'f' + ++_id, type, customName: name || null,
  def: componentDefs[type], data: data || {}
});

describe('veFeadBeltPath — kayış çevresinin geometrisi', () => {
  test('iki eşit kasnak: teğetler merkez doğrusuna PARALEL, sarımlar 180°', () => {
    // R eşitken dış teğet merkez doğrusuna paraleldir; teğet noktaları tam
    // tepe ve tam dip olur → path'te y = 50±10 görünmeli.
    const d = fead.veFeadBeltPath([{ x: 30, y: 50, r: 10 }, { x: 70, y: 50, r: 10 }]);
    expect(d).toMatch(/^M30 40 L70 40 /);
    expect(d).toContain('L30 60');
    expect(d.trim().endsWith('Z')).toBe(true);
    // Eşit yarıçapta iki sarım da tam yarım tur: large-arc bayrağı ikisinde de 0
    // (180° "büyük yay" DEĞİLDİR — sınırda 0 kalmalı).
    expect(d.match(/A10 10 0 0 1/g)).toHaveLength(2);
  });

  test('farklı yarıçap: büyük kasnakta sarım 180°yi AŞAR → large-arc = 1', () => {
    // R1=16 @ (38,58), R2=9 @ (68,58): d=30, ψ=acos(7/30)=76,51°.
    // Sarım(büyük) = 360−2ψ = 206,98° > 180 → 1;  sarım(küçük) = 2ψ = 153° → 0.
    const d = fead.veFeadBeltPath([{ x: 38, y: 58, r: 16 }, { x: 68, y: 58, r: 9 }]);
    expect(d).toContain('A9 9 0 0 1');     // küçük kasnak: büyük yay değil
    expect(d).toContain('A16 16 0 1 1');   // büyük kasnak: büyük yay
    // Teğet noktaları: (38+16·cosψ, 58−16·sinψ) = (41,73 / 42,44)
    expect(d).toMatch(/^M41\.73 42\.44 /);
    expect(d).toContain('L70.1 49.25');
  });

  test('üç kasnak: her kasnak için bir yay, her kenar için bir teğet', () => {
    const d = fead.veFeadBeltPath([
      { x: 34, y: 62, r: 15 }, { x: 70, y: 32, r: 9 }, { x: 74, y: 66, r: 7 }
    ]);
    expect((d.match(/ A/g) || [])).toHaveLength(3);
    expect((d.match(/ L/g) || [])).toHaveLength(3);
  });

  test('bir kasnak diğerinin İÇİNDE ise dış teğet yoktur → null (sessiz saçma çizim yok)', () => {
    expect(fead.veFeadBeltPath([{ x: 50, y: 50, r: 30 }, { x: 52, y: 50, r: 5 }])).toBeNull();
    expect(fead.veFeadBeltPath([{ x: 50, y: 50, r: 10 }, { x: 50, y: 50, r: 10 }])).toBeNull();
  });

  test('iki kasnaktan az / bozuk veri → null', () => {
    expect(fead.veFeadBeltPath([])).toBeNull();
    expect(fead.veFeadBeltPath([{ x: 1, y: 1, r: 5 }])).toBeNull();
    expect(fead.veFeadBeltPath(null)).toBeNull();
    // Konumu girilmemiş kasnak elenir → geriye tek kasnak kalır → null
    expect(fead.veFeadBeltPath([{ x: 1, y: 1, r: 5 }, { x: NaN, y: 2, r: 5 }])).toBeNull();
  });
});

describe('veFeadRouteOrder — kayışın uğrama sırası bağlantılardan okunur', () => {
  test('zincir krank kasnağından başlar, bağlantı sırasını izler', () => {
    const krank = kasnak('fead-crank');
    const alt = kasnak('fead-alternator');
    const ac = kasnak('fead-ac');
    // Topoloji sırası bilerek KARIŞIK: sıra bağlantıdan gelmeli, diziden değil.
    const list = [ac, alt, krank];
    const conns = [
      { from: krank.id, to: alt.id },
      { from: alt.id, to: ac.id },
      { from: ac.id, to: krank.id }        // çevrim kapanır
    ];
    expect(fead.veFeadRouteOrder(list, conns).map((n) => n.id)).toEqual([krank.id, alt.id, ac.id]);
  });

  test('kapalı çevrim sonsuz döngüye girmez (her kasnak bir kez)', () => {
    const a = kasnak('fead-crank'), b = kasnak('fead-idler');
    const conns = [{ from: a.id, to: b.id }, { from: b.id, to: a.id }];
    expect(fead.veFeadRouteOrder([a, b], conns)).toHaveLength(2);
  });

  test('bağlanmamış kasnak DÜŞMEZ, sona eklenir (yarım model de şema verir)', () => {
    const krank = kasnak('fead-crank');
    const alt = kasnak('fead-alternator');
    const yetim = kasnak('fead-idler');
    const sira = fead.veFeadRouteOrder([krank, alt, yetim], [{ from: krank.id, to: alt.id }]);
    expect(sira.map((n) => n.id)).toEqual([krank.id, alt.id, yetim.id]);
  });

  test('kasnak olmayan düğümler (kayış künyesi, çözücü) sıraya girmez', () => {
    const krank = kasnak('fead-crank');
    const sira = fead.veFeadRouteOrder(
      [krank, kasnak('fead-belt'), kasnak('fead-solver'), kasnak('fead-report')], []);
    expect(sira.map((n) => n.type)).toEqual(['fead-crank']);
  });

  test('krank yoksa ilk kasnaktan başlar (patlamaz)', () => {
    const alt = kasnak('fead-alternator'), idl = kasnak('fead-idler');
    expect(fead.veFeadRouteOrder([alt, idl], [{ from: alt.id, to: idl.id }])[0].id).toBe(alt.id);
    expect(fead.veFeadRouteOrder([], [])).toEqual([]);
  });
});

describe('veFeadRadius — çap girilmemişse tipe göre makul varsayılan', () => {
  test('girilen çap her zaman kazanır', () => {
    expect(fead.veFeadRadius({ type: 'fead-crank', data: { dia: 200 } })).toBe(100);
    expect(fead.veFeadRadius({ type: 'fead-crank', data: { dia: '150,5' } })).toBeCloseTo(75.25, 6);
  });

  test('boş/0/geçersiz çap → tipin varsayılanı (önizleme boş kalmasın)', () => {
    expect(fead.veFeadRadius({ type: 'fead-crank', data: {} }))
      .toBe(fead.VE_FEAD_DEFAULT_DIA['fead-crank'] / 2);
    expect(fead.veFeadRadius({ type: 'fead-alternator', data: { dia: '' } }))
      .toBe(fead.VE_FEAD_DEFAULT_DIA['fead-alternator'] / 2);
    // Krank varsayılanı aksesuardan BÜYÜK olmalı — şema gerçekçi dursun
    expect(fead.VE_FEAD_DEFAULT_DIA['fead-crank'])
      .toBeGreaterThan(fead.VE_FEAD_DEFAULT_DIA['fead-alternator']);
  });
});

describe('Alt-sistem sözleşmesi', () => {
  test('modül paneli "Alt Topolojiyi Aç" kancasını düğümün id\'siyle kurar', () => {
    const html = fead.getFeadModulePropertiesHTML({ id: 'comp-3', type: 'fead-analysis', data: {} });
    expect(html).toContain("veFeadOpenEditor('comp-3')");
    expect(html).toContain('alt topolojisine');
  });

  test('açılmış alt-topolojinin bileşen/bağlantı sayısı özette görünür', () => {
    const html = fead.getFeadModulePropertiesHTML({
      id: 'comp-4', type: 'fead-analysis',
      data: { subTopology: { nodes: [{}, {}, {}, {}], connections: [{}, {}, {}] } }
    });
    expect(html).toContain('>4<');
    expect(html).toContain('>3<');
  });

  test('çift tık kapısı: veFeadOpenEditor yalnız fead-analysis düğümünü açar', () => {
    // Yanlış tipte sessizce çıkmalı — aksi hâlde bir "Motor" düğümüne çift
    // tıklamak canvası boşaltırdı (stack'e yanlış ebeveyn durumu girerdi).
    global.nodes = [{ id: 'x1', type: 'engine', data: {} }];
    global.veSerializeCurrentState = jest.fn(() => ({ nodes: [] }));
    global.veClearCanvasDOM = jest.fn();
    global.veLoadTabState = jest.fn();
    fead.veFeadOpenEditor && fead.veFeadOpenEditor('x1');
    expect(veClearCanvasDOM).not.toHaveBeenCalled();
  });

  test('başlangıç yerleşimi "Başlangıç ve Örnekler" bileşenini içerir', () => {
    // İlk açılışta iç topolojiye yalnız bu bileşen konur (diğer iki modülle
    // aynı kalıp); yerleşimden düşerse modül BOŞ açılırdı.
    const tipler = fead.VE_FEAD_STARTER_LAYOUT.map((it) => it.type);
    expect(tipler).toContain('fead-example');
    expect(tipler).toContain('fead-crank');
    // Yerleşimdeki her tip gerçekten tanımlı olmalı (yazım hatası kapısı)
    tipler.forEach((t) => expect(componentDefs[t]).toBeDefined());
  });
});

describe('componentDefs — FEAD tipleri yapısal olarak tutarlı', () => {
  const feadTipler = () => Object.keys(componentDefs).filter((t) => t.indexOf('fead-') === 0);

  test('her kasnak kayış yolu için 1 giriş + 1 çıkış taşır', () => {
    feadTipler().filter((t) => componentDefs[t].isFeadPulley).forEach((t) => {
      expect(componentDefs[t].inputs).toBe(1);
      expect(componentDefs[t].outputs).toBe(1);
    });
  });

  test('araç blokları (kayış künyesi/çözücü/şema/örnek/rapor) portsuzdur', () => {
    ['fead-belt', 'fead-solver', 'fead-layout', 'fead-example', 'fead-report'].forEach((t) => {
      expect(componentDefs[t].inputs).toBe(0);
      expect(componentDefs[t].outputs).toBe(0);
    });
  });

  test('tam bir tahrik zinciri kurulabilir: krank + aksesuar + gergi + avara', () => {
    const roller = feadTipler().reduce((a, t) => {
      const d = componentDefs[t];
      if (d.isFeadDriver) a.driver++;
      if (d.isFeadAccessory) a.acc++;
      if (d.isFeadTensioner) a.tens++;
      if (d.isFeadIdler) a.idler++;
      return a;
    }, { driver: 0, acc: 0, tens: 0, idler: 0 });
    expect(roller.driver).toBe(1);          // tek tahrik kaynağı: krank
    expect(roller.acc).toBeGreaterThan(3);
    expect(roller.tens).toBe(1);
    expect(roller.idler).toBe(1);
  });

  test('her tipin sembolü var ve viewBox 0 0 100 100 (palet ölçü dili)', () => {
    feadTipler().forEach((t) => {
      expect(componentDefs[t].svg).toContain('viewBox="0 0 100 100"');
      expect(componentDefs[t].name).toBeTruthy();
    });
  });

  test('kayış künyesi iç topolojide tek kopya', () => {
    expect(componentDefs['fead-belt'].maxInstances).toBe(1);
  });
});
