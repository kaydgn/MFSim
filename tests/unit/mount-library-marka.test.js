/**
 * mount-library-marka.test.js — TAKOZ ÖZELLİKLERİ: MARKA SEÇİCİSİ, KİMLİK, TEK DİYAGRAM
 * ─────────────────────────────────────────────────────────────────────────────────
 * Kullanıcı 2026-11-10 (Canlı Not 103–108), Takoz Özellikleri penceresi:
 *   103  "Eksenlerin yasası" tablosu kalktı
 *   104  diyagram ekranda birebir (340 px), yazı tek ölçekte
 *   105  Tip satırı sıkı: katalog tipinde ad alanı yok
 *   106  Marka seçilir, tipler o markanın tiplerinden seçilir
 *   107  katalog tipinin adı değişmez (kimlik satırı yalnız özel tipte)
 *   108  X · Y · Z tek diyagramda; aynı eğriyi çizen eksenler tek çizgi
 * Yerleşim ve ölçüler gerçek tarayıcıda: tests/e2e/mount-pencere.spec.js.
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const cp = require('../../js/cp-mount.js');

const stubs = stubGlobals();
beforeEach(() => resetStubs(stubs));
afterEach(() => { delete global.nodes; });

const libNode = (mounts, secili) => ({
  id: 'lib1', type: 'mnt-library', def: { isMountLibrary: true },
  data: Object.assign({ mounts: mounts || [] }, secili ? { _selKey: secili } : {}),
});
const dom = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const pencere = (node) => { global.nodes = [node]; return dom(cp.getMntLibraryPropertiesHTML(node)); };
const markaSecenekleri = (d) =>
  [...d.querySelectorAll('select.mntlib-marka option')].map((o) => o.value);

describe('MARKA — katalogdaki her tipin markası var', () => {
  const kat = () => cp.veMntGetLibraryList().filter((e) => e.builtin);

  test('her tip listedeki üç markadan birini taşır; dağılım 148 · 7 · 7 (AMC: js/mount-amc.js)', () => {
    const sayi = {};
    kat().forEach((e) => { sayi[e.marka] = (sayi[e.marka] || 0) + 1; });
    expect(Object.keys(sayi).sort()).toEqual([...cp.VE_MNT_LIB_MARKALAR].sort());
    expect(sayi['AMC Mecanocaucho']).toBe(148);
    expect(sayi['Angst+Pfister']).toBe(7);
    expect(sayi['Diğer']).toBe(7);
    expect(kat()).toHaveLength(162);
  });

  test('anahtar, ad ve rijitlik değerleri markadan etkilenmez (kayıtlı projeler)', () => {
    const k = cp.VE_MOUNT_LIBRARY;
    expect(k.amc55sha).toMatchObject({ name: 'LMT-1433-37 55 ShA', sx: 1252, sz: 640, dz: 977 });
    expect(k.TK040).toMatchObject({ name: 'TK040 45 ShA (57RS329001M)', dx: 740, dz: 335 });
    expect(Object.keys(k)).toHaveLength(162);
  });

  test('düzenlenmiş gömülü tip markasını korur; özel tip "Özel takozlar"dır', () => {
    const lib = libNode([{ key: 'k1', name: 'Deneme', sx: 1, sy: 1, sz: 1, dx: 1, dy: 1, dz: 1 }]);
    lib.data.overrides = { TK040: { sz: 300 } };
    global.nodes = [lib];
    const m = cp.veMntGetLibraryMap();
    expect(m.TK040.marka).toBe('Diğer');
    expect(m.TK040.overridden).toBe(true);
    expect(m.k1.marka).toBe(cp.VE_MNT_LIB_MARKA_OZEL);
  });

  test('gruplama sabit sırada, girdisiz marka listede yok', () => {
    const g = cp.veMntLibMarkalar(kat());
    expect(g.map((x) => x.ad)).toEqual(['AMC Mecanocaucho', 'Angst+Pfister', 'Diğer']);
    expect(g.reduce((t, x) => t + x.girdiler.length, 0)).toBe(162);
    // marka içinde AMC ailenin · tipin · sertliğin sırasıyla (kütüphanenin iç sırası değil)
    expect(g[0].girdiler.map((e) => e.amc.kod)).toEqual(require('../../js/mount-amc.js').kodlar());
  });
});

describe('SEÇİCİ — önce Marka, sonra o markanın tipleri', () => {
  test('Marka listesi üç katalog markasıdır; özel tip varsa "Özel takozlar" da', () => {
    expect(markaSecenekleri(pencere(libNode()))).toEqual(['AMC Mecanocaucho', 'Angst+Pfister', 'Diğer']);
    const ozel = libNode([{ key: 'k1', name: 'Deneme', sz: 100 }]);
    expect(markaSecenekleri(pencere(ozel))).toEqual(['AMC Mecanocaucho', 'Angst+Pfister', 'Diğer', 'Özel takozlar']);
  });

  test('seçili markanın tipleri listelenir; Marka listesi seçili tipin markasını gösterir', () => {
    const d = pencere(libNode([], 'TK040'));
    expect(d.querySelector('select.mntlib-marka').value).toBe('Diğer');
    const adlar = [...d.querySelectorAll('.mntlib-opt-name')].map((e) => e.textContent);
    expect(adlar).toHaveLength(7);
    expect(adlar.every((a) => /57RS|TK0/.test(a))).toBe(true);
    expect(d.querySelector('.mntlib-opt.sel .mntlib-opt-name').textContent).toContain('TK040');
  });

  test('Marka seçilince seçili tip o markanın ilk tipine geçer', () => {
    const node = libNode([], 'TK040');
    global.nodes = [node];
    cp.veMntLibMarka('lib1', 'AMC Mecanocaucho');
    expect(node.data._selKey).toBe('amc137005');                 // listenin ilki: Cone 01 45 ShA
    expect(stubs.showNodeProperties).toHaveBeenCalledWith(node);
    const d = pencere(node);
    expect(d.querySelector('select.mntlib-marka').value).toBe('AMC Mecanocaucho');
    expect(d.querySelectorAll('.mntlib-opt')).toHaveLength(148);
  });

  test('seçili tip zaten o markadaysa Marka seçimi tipi DEĞİŞTİRMEZ', () => {
    const node = libNode([], 'amc137982');
    global.nodes = [node];
    cp.veMntLibMarka('lib1', 'AMC Mecanocaucho');
    expect(node.data._selKey).toBe('amc137982');
  });

  test('bilinmeyen marka sessizce yok sayılır; seçim geçerli kalır', () => {
    const node = libNode([], 'TK040');
    global.nodes = [node];
    cp.veMntLibMarka('lib1', 'Yok');
    expect(node.data._selKey).toBe('TK040');
  });

  test('düzenleme sırasında marka seçimi eğri editörünü başka tipe taşımaz', () => {
    const node = libNode([{ key: 'k1', name: 'Deneme', sz: 100 }], 'k1');
    node.data._curveEditKey = 'k1';
    global.nodes = [node];
    cp.veMntLibMarka('lib1', 'AMC Mecanocaucho');
    expect(node.data._selKey).toBe('amc137005');
    expect(node.data._curveEditKey).toBeNull();
  });

  test('kayıtlı veriye marka alanı yazılmaz', () => {
    const node = libNode([{ key: 'k1', name: 'Deneme', sx: 1, sy: 1, sz: 1, dx: 1, dy: 1, dz: 1 }], 'k1');
    pencere(node);
    expect(node.data.mounts[0]).not.toHaveProperty('marka');
  });
});

describe('KİMLİK — ad yalnız özel tipte değişir', () => {
  test('katalog tipinde ad alanı ve Sil yok', () => {
    const d = pencere(libNode([], 'TK040'));
    expect(d.querySelector('.ve-mnt-lib-kim')).toBeNull();
    expect(d.querySelector('input[id^="ve-mnt-lib-name-"]')).toBeNull();
    expect(d.querySelector('[onclick*="veMntLibRemove"]')).toBeNull();
  });

  test('özel tipte ad alanı ve Sil durur', () => {
    const d = pencere(libNode([{ key: 'k1', name: 'Deneme', sz: 100 }]));
    expect(d.querySelector('input[id="ve-mnt-lib-name-lib1"]').value).toBe('Deneme');
    expect(d.querySelector('[onclick*="veMntLibRemove(\'lib1\',\'k1\')"]')).not.toBeNull();
  });
});

describe('TEK DİYAGRAM — x · y · z aynı grafikte', () => {
  const grafik = (d) => d.querySelector('svg.ve-mnt-lib-svg');
  const lejant = (d) => [...d.querySelectorAll('.ve-mnt-kroki-lej span')].map((s) => s.textContent.trim());

  test('Eksenlerin yasası tablosu, eksen seçici ve eksen işleyicisi yok', () => {
    const d = pencere(libNode([], 'TK040'));
    expect(d.textContent).not.toMatch(/Eksenlerin yasası|ks·δ|nokta tablosu/);
    expect(d.querySelector('.ve-mnt-seg')).toBeNull();
    expect(typeof cp.veMntLibEksen).toBe('undefined');
    expect(d.querySelectorAll('.ve-fp-kat[data-k="egri"] table').length).toBe(0);
  });

  test('Kuvvet–sehim bölümü başlıklı; grafik tek ve sütun genişliğinde', () => {
    const d = pencere(libNode([], 'TK040'));
    const kat = d.querySelector('.ve-fp-kat[data-k="egri"]');
    expect(kat.querySelector('.ve-fp-sect > b').textContent).toBe('Kuvvet–sehim');
    expect(kat.querySelectorAll('svg.ve-mnt-lib-svg')).toHaveLength(1);
    const g = grafik(d);
    expect(g.getAttribute('viewBox')).toBe('0 0 340 172');     // ekranda birebir: 340 px × 172 px
    expect(g.getAttribute('width')).toBe('340');
    expect(g.getAttribute('role')).toBe('img');
  });

  test('farklı üç eksen üç çizgi: x radyal · y radyal · z eksenel; statik düz, dinamik kesikli', () => {
    const d = pencere(libNode([], 'TK040'));            // kx 515 · ky 260 · kz 242
    expect(lejant(d).slice(0, 3)).toEqual(['x radyal', 'y radyal', 'z eksenel']);
    const g = grafik(d);
    expect(g.querySelectorAll('polyline:not([stroke-dasharray])')).toHaveLength(3);
    expect(g.querySelectorAll('polyline[stroke-dasharray]')).toHaveLength(3);
    const renkler = [...g.querySelectorAll('polyline:not([stroke-dasharray])')].map((p) => p.getAttribute('stroke'));
    expect(new Set(renkler).size).toBe(3);                // her eksenin kendi rengi
  });

  test('aynı eğriyi çizen x ve y TEK çizgi, TEK künye: "x · y radyal"', () => {
    const d = pencere(libNode([], 'amc137982'));         // kx = ky
    expect(lejant(d).slice(0, 2)).toEqual(['x · y radyal', 'z eksenel']);
    const g = grafik(d);
    expect(g.querySelectorAll('polyline:not([stroke-dasharray])')).toHaveLength(2);
    expect(g.querySelectorAll('polyline[stroke-dasharray]')).toHaveLength(2);
  });

  test('gösterge: statik, dinamik; ölçüm noktası yalnız nokta eğrisi varsa', () => {
    const lineer = lejant(pencere(libNode([], 'TK040')));
    expect(lineer).toEqual(expect.arrayContaining(['statik', 'dinamik']));
    expect(lineer).not.toContain('ölçüm noktası');
    const ozel = libNode([{ key: 'k1', name: 'Deneme', sx: 100, sy: 100, sz: 200, dx: 150, dy: 150, dz: 300,
      curveZ: [[-10, -6400], [0, 0], [10, 6400]] }], 'k1');
    const noktali = lejant(pencere(ozel));
    expect(noktali).toContain('ölçüm noktası');
    expect(grafik(pencere(ozel)).querySelectorAll('circle')).toHaveLength(3);
  });

  test('yazı TEK ölçekte: grafikteki bütün yazı aynı boyda ve ölçeğin tabanında', () => {
    const g = grafik(pencere(libNode([], 'TK040')));
    const boylar = new Set([...g.querySelectorAll('text')].map((t) => t.getAttribute('font-size')));
    expect(boylar.size).toBe(1);
    expect(Number([...boylar][0])).toBeLessThanOrEqual(10);   // --fs-micro: ekranda 10 px
  });

  test('eksen başlığında birim; değerde sonek yok', () => {
    const buyuk = grafik(pencere(libNode([], 'TK040'))).textContent;   // 15 mm · 740 N/mm → kN
    expect(buyuk).toContain('sehim δ [mm]');
    expect(buyuk).toContain('kuvvet f [kN]');
    expect(buyuk).not.toMatch(/\d+k\b/);
    const kucuk = dom(cp._mntLibForceChart({ sz: 20, dz: 30 }, 'z')).textContent;
    expect(kucuk).toContain('kuvvet f [N]');
  });

  test('analitik fit ve nokta eğrisi olan eksen kendi aralığında çizilir (lineer ortak aralık)', () => {
    const e = {
      sx: 100, dx: 150, sy: 100, dy: 150, sz: 200, dz: 300,
      curveZ: [[-4, -1000], [0, 0], [6, 2500]],
    };
    const G = cp._mntLibGrafik(e);
    expect(G.gruplar.map((x) => x.ad)).toEqual(['x · y radyal', 'z eksenel']);
    expect(G.nokta).toBe(true);
    const doc = dom(G.svg);
    const xs = [...doc.querySelectorAll('polyline:not([stroke-dasharray])')].map((p) =>
      p.getAttribute('points').split(' ').map((q) => Number(q.split(',')[0])));
    // z eğrisi −4…6 mm aralığında; x·y lineeri ortak aralıkta (eğrinin aralığına oturur)
    expect(Math.min(...xs[1])).toBeGreaterThanOrEqual(40);
    expect(Math.max(...xs[1])).toBeLessThanOrEqual(332);
  });

  test('model değişmez: pencere kurmak kayıtlı veriyi yazmaz', () => {
    const lib = libNode([{ key: 'k1', name: 'Deneme', sx: 1, sy: 1, sz: 1, dx: 1, dy: 1, dz: 1 }], 'k1');
    const once = JSON.stringify(lib.data);
    pencere(lib);
    expect(JSON.stringify(lib.data)).toBe(once);
  });
});
