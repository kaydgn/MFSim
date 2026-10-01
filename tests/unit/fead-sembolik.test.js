/**
 * fead-sembolik.test.js — ÇÖZÜLMEYEN MODEL: SEMBOLİK ÇİZİM + KURULUM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Kullanıcı bildirimi (2026-10-01): *"3B modelde ve manuel olarak kasnak
 * tanımlamaya başladığım zaman, özellikle 3B model kullanarak tanımladıktan
 * sonra, sanırım kayış ve otomatik gerginin detayları tanımlanmadığı için,
 * sistemi kurmuyor. Kanvasta çizim göstermiyor. … En azından sembolik bir
 * çizim olsun, eksikler yine belirtilsin."*
 *
 * Ölçüldü: STEP'ten gelen modelde (konum, çap, gerginin avara merkezi ve kolu
 * belli; yalnız yay verisi eksik) sihirbazın dört çizim adımı da çizim yerine
 * tek bir cümle basıyordu, "Modeli kur" çözüm istediği için KAPALIYDI ve
 * kanvas kartı "Şema çizilemiyor" diyordu.
 *
 * Hata sınıfları — hepsi sessiz:
 *   • sembolik çizim kendi geometrisini kurarsa (üç katman) çözülmemiş bir
 *     modelin "yolu" çizilir — kullanıcı onu çekirdeğin cevabı sanır;
 *   • konumu girilmemiş kasnağa yer UYDURULURSA çizim yalan söyler;
 *   • ters köprü (ekran → mm) sembolik çizimde kayarsa sürüklenen kasnak
 *     imlecin altından kaçar;
 *   • anahtar çizilmeyen bir çizgiyi adlandırırsa okunamaz.
 *
 * Gerçek tarayıcı halkaları (STEP → masa → Modeli kur → kart; şeritten
 * çizime sürükleme): tests/e2e/fead-sembolik.spec.js.
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'), require('../../js/fead-tensioners.js'),
 require('../../js/fead-accessories.js'), require('../../js/fead-engines.js'), require('../../js/fead-checks.js')]
  .forEach((mod) => Object.keys(mod).forEach((k) => { global[k] = mod[k]; }));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });

const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  global.selectedNodes = [];
});
const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:flex;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div>'
    + '<div id="ve-fw-ang" style="display:none;"></div>'
    + '<div id="ve-fw-eng" style="display:none;"></div>'
    + '<div id="ve-fw-cevrim" style="display:none;"></div></div>';
};
const dom = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const ADIM = (key) => wiz.VE_FW_STEPS.findIndex((s) => s.key === key);
const adimDOM = (i) => dom(wiz.veFeadWizStepHTML(i, wiz.veFeadWizBuild()));

// STEP'ten gelen durumun AYNISI (ölçüldü: AG00686 STEP'i → aktar): konumlar,
// çaplar, gerginin avara merkezi ve kolu var; yay verisi YOK.
const YAY = ['preload', 'kArm', 'meanLoad'];
const stepBenzeri = () => {
  kabuk();
  wiz.veFeadWizSeed('AG00686_1475_GATES_2023');
  const st = wiz.veFeadWizState();
  YAY.forEach((k) => delete st.ten[k]);
  return st;
};
// Elle başlanan sihirbaz: kasnaklar eklendi, koordinat ve gergi girilmedi.
const elle = () => {
  kabuk();
  wiz.veFeadWizReset();
  wiz.veFeadWizKasnakEkle('fead-alternator');
  wiz.veFeadWizKasnakEkle('fead-ac');
  return wiz.veFeadWizState();
};
// Kasnağın KONUM GİRDİSİ (gergide avara merkezi) — çizimin kâhini.
const girdi = (n) => (componentDefs[n.type].isFeadTensioner
  ? [Number(n.data.cenX), Number(n.data.cenY)] : [Number(n.data.x), Number(n.data.y)]);

// ═══════════════════════════════════════════════════════════════ ÇİZİCİ ══
describe('ÇİZİCİ — sembolik çizim yalnız GİRDİLERİ çizer', () => {
  test('çözülen modelde KULLANILMAZ; çözülmeyende seçenekle çizilir, seçeneksiz eski sözleşme (null)', () => {
    kabuk(); wiz.veFeadWizSeed('AG00686_1475_GATES_2023');
    const cozulen = wiz.veFeadWizBuild();
    expect(cozulen.ok).toBe(true);
    const s1 = fead.veFeadLayoutSVG(cozulen, 474, 444, { sembolik: true });
    expect(s1).toContain('data-ve="belt"');
    expect(s1).not.toContain('data-sembolik');

    stepBenzeri();
    const b = wiz.veFeadWizBuild();
    expect(b.ok).toBe(false);
    expect(b.errors).toHaveLength(3);
    // Rapor ve dışa aktarma seçeneği vermiyor: onlar için sözleşme AYNI.
    expect(fead.veFeadLayoutSVG(b, 474, 444)).toBeNull();
    const s2 = fead.veFeadLayoutSVG(b, 474, 444, { sembolik: true });
    expect(s2).toContain('data-sembolik="1"');
    expect(s2).not.toContain('data-ve="belt"');        // kayış yolu UYDURULMAZ
  });

  test('her kasnak GİRDİ konumunda ve çapında — çekirdeğe HİÇ gidilmez (üç katman)', () => {
    stepBenzeri();
    const b = wiz.veFeadWizBuild();
    // Çekirdeğin bütün işlevleri sayaçla sarılır; çizim boyunca sıfır kalmalı.
    const asil = {}, sayac = { n: 0 };
    Object.keys(F).forEach((k) => {
      if (typeof F[k] !== 'function') return;
      asil[k] = F[k];
      F[k] = function () { sayac.n++; return asil[k].apply(this, arguments); };
    });
    let T = null, svg;
    try {
      svg = fead.veFeadLayoutSVG(b, 474, 444, { sembolik: true, ek: (t) => { T = t; return ''; } });
    } finally {
      Object.keys(asil).forEach((k) => { F[k] = asil[k]; });
    }
    expect(sayac.n).toBe(0);
    expect(T && T.sembolik).toBe(true);
    const d = dom(svg);
    const cem = [...d.querySelectorAll('circle[data-ve="sem-kasnak"]')];
    expect(cem).toHaveLength(b.order.length);
    cem.forEach((c) => {
      const k = +c.getAttribute('data-pi'), n = b.order[k];
      const [x, y] = girdi(n);
      expect(+c.getAttribute('cx')).toBeCloseTo(T.tx(x), 1);
      expect(+c.getAttribute('cy')).toBeCloseTo(T.ty(y), 1);
      expect(+c.getAttribute('r')).toBeCloseTo(M.veFeadRadius(n) * T.s, 1);
      // Ek katmanın gördüğü konum da girdinin kendisi.
      expect(T.ps[k].c[0]).toBeCloseTo(x, 6);
      expect(T.ps[k].c[1]).toBeCloseTo(y, 6);
    });
    // Gerginin kolu köprünün montaj noktasına uzanır (kol boyu + açıdan).
    const pv = d.querySelector('[data-ve="pivot"] line');
    expect(pv).not.toBeNull();
    const PX = (+pv.getAttribute('x1') + +pv.getAttribute('x2')) / 2;
    expect(PX).toBeCloseTo(T.tx(b.pivot[0]), 1);
  });

  test('sıra çizgisi: hepsi yerindeyse KAPALI çokgen, şeritte kasnak varsa açık, ikiden azsa YOK', () => {
    stepBenzeri();
    let d = dom(fead.veFeadLayoutSVG(wiz.veFeadWizBuild(), 474, 444, { sembolik: true }));
    expect(d.querySelector('polygon[data-ve="sem-sira"]')).not.toBeNull();
    expect(d.querySelector('[data-ve="sem-bekleyen"]')).toBeNull();

    const st = wiz.veFeadWizState();
    st.pulleys[2].x = '';                               // klima konumsuz
    d = dom(fead.veFeadLayoutSVG(wiz.veFeadWizBuild(), 474, 444, { sembolik: true }));
    expect(d.querySelector('polygon[data-ve="sem-sira"]')).toBeNull();
    expect(d.querySelector('polyline[data-ve="sem-sira"]')).not.toBeNull();
    expect(d.querySelectorAll('[data-ve="sem-bekleyen"] circle[data-yok]')).toHaveLength(1);

    elle();
    d = dom(fead.veFeadLayoutSVG(wiz.veFeadWizBuild(), 474, 444, { sembolik: true }));
    expect(d.querySelector('[data-ve="sem-sira"]')).toBeNull();
  });

  test('konumu girilmemiş kasnak ŞERİTTE — yeri uydurulmaz, ek katmanda konumu YOK', () => {
    elle();
    const b = wiz.veFeadWizBuild();
    let T = null;
    const d = dom(fead.veFeadLayoutSVG(b, 474, 444, { sembolik: true, ek: (t) => { T = t; return ''; } }));
    // İki aksesuar + gergi: üçü de konumsuz, üçü de şeritte.
    expect(b.order).toHaveLength(3);
    expect(d.querySelectorAll('circle[data-ve="sem-kasnak"][data-yok]')).toHaveLength(3);
    expect(d.querySelectorAll('circle[data-ve="sem-kasnak"]:not([data-yok])')).toHaveLength(0);
    expect(T.ps.every((p) => p.c === null)).toBe(true);
    // Şerit kendini adlandırır; düzenlenebilir çizimde ne yapılacağını da söyler.
    expect(d.querySelector('[data-ve="sem-bekleyen"] text').textContent).toBe('konum yok');
    // RAF: şerit mm çerçevesinin parçası değil — zemini bütün kasnaklarını
    // (çember + ad) içine alır; zeminsizken eksenli masada koordinatta
    // duruyormuş gibi okunuyordu.
    const raf = d.querySelector('[data-ve="sem-bekleyen"] rect[data-ve="sem-raf"]');
    expect(raf).not.toBeNull();
    const rx = +raf.getAttribute('x'), rw = +raf.getAttribute('width');
    const ry = +raf.getAttribute('y'), rh = +raf.getAttribute('height');
    d.querySelectorAll('[data-ve="sem-bekleyen"] circle[data-ve="sem-kasnak"]').forEach((c) => {
      const cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy'), r = +c.getAttribute('r');
      expect(cx - r).toBeGreaterThanOrEqual(rx);
      expect(cx + r).toBeLessThanOrEqual(rx + rw);
      expect(cy - r).toBeGreaterThanOrEqual(ry);
      expect(cy + r + 12).toBeLessThanOrEqual(ry + rh);          // ad satırı da içeride
    });
    // Raf çizimin içinde kalır.
    expect(rx).toBeGreaterThanOrEqual(0);
    expect(rx + rw).toBeLessThanOrEqual(474);
  });

  test('çapı girilmemiş kasnak NOKTALI ve önizleme çapıyla; sırttan temas kesikli', () => {
    const st = stepBenzeri();
    const avara = st.pulleys.find((p) => p.type === 'fead-idler');
    avara.od = '';
    const b = wiz.veFeadWizBuild();
    const d = dom(fead.veFeadLayoutSVG(b, 474, 444, { sembolik: true }));
    const k = b.order.findIndex((n) => n.type === 'fead-idler');
    const c = d.querySelector('circle[data-ve="sem-kasnak"][data-pi="' + k + '"]');
    expect(c.getAttribute('data-cap')).toBe('yok');
    expect(c.getAttribute('stroke-dasharray')).toBe('1.5 3');
    const ti = b.order.findIndex((n) => componentDefs[n.type].isFeadTensioner);
    const g = d.querySelector('circle[data-ve="sem-kasnak"][data-pi="' + ti + '"]');
    expect(g.getAttribute('data-cap')).toBeNull();
    expect(g.getAttribute('stroke-dasharray')).toBe('4 3');          // gergi sırttan
  });

  test('yalnız gergi varsa çizilecek bir düzen YOK — sihirbaz "Henüz kasnak yok" der', () => {
    kabuk(); wiz.veFeadWizReset();
    const b = wiz.veFeadWizBuild();
    expect(b.order).toHaveLength(1);
    expect(fead.veFeadLayoutSVG(b, 474, 444, { sembolik: true })).toBeNull();
    const m = adimDOM(ADIM('kasnak')).querySelector('#ve-fw-masa-cizim');
    expect(m.querySelector('svg')).toBeNull();
    expect(m.querySelector('.ve-fw-masa-bos').textContent).toContain('Henüz kasnak yok.');
  });

  test('özet: çizilenin sayımı çizimle aynı (anahtarın kaynağı)', () => {
    stepBenzeri();
    expect(fead.veFeadSembolikOzet(wiz.veFeadWizBuild()))
      .toEqual({ kasnak: 4, yerli: 4, bekleyen: 0, capsiz: 0, sirt: 2, sira: true });
    elle();
    expect(fead.veFeadSembolikOzet(wiz.veFeadWizBuild()))
      .toEqual({ kasnak: 3, yerli: 0, bekleyen: 3, capsiz: 0, sirt: 0, sira: false });
  });
});

// ═══════════════════════════════════════════════════════════════ KART ══
describe('KANVAS KARTI — çözülmeyen model ÇİZİLİR, kart Çizim Masası kalır', () => {
  let _id = 0;
  const dugum = (type, data, name) => ({ id: 'k' + ++_id, type, customName: name || null,
    def: componentDefs[type], data: data || {} });
  // cp-fead.test.js'teki çözülen model + yay verisi YOK (STEP'in hâli).
  const kur = (yaySil = true) => {
    const crk = dugum('fead-crank', { od: 160, x: 0, y: 0, driver: true, beltIndex: 0 }, 'CRK');
    const idr = dugum('fead-idler', { od: 75, x: -72, y: 267, beltIndex: 1 }, 'IDR');
    const ac = dugum('fead-ac', { od: 127, x: -224, y: 448, beltIndex: 2 }, 'A_C');
    const ten = dugum('fead-tensioner', {
      od: 75, cenX: -151.89, cenY: 185.50, armLen: 90, armMeanDeg: 71.8, beltIndex: 3,
      preload: 8.59, kArm: 0.482, meanLoad: 22.09, sense: 1 }, 'TEN');
    if (yaySil) YAY.forEach((k) => delete ten.data[k]);
    const belt = dugum('fead-belt', { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6 });
    const sv = dugum('fead-solver', { designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5 });
    const lay = dugum('fead-layout', {});
    global.nodes = [crk, idr, ac, ten, belt, sv, lay];
    return { lay, crk, idr, ac, ten };
  };

  test('kart: sembolik çizim + EKSİK ŞERİDİ (ilk eksik, sayı, tamamı ipucunda) + kırmızı rozet', () => {
    const { lay } = kur();
    const html = fead.veFeadLayoutCardHTML(lay);
    const d = dom(html);
    expect(d.querySelector('.ve-fead-kanvas svg[data-sembolik="1"]')).not.toBeNull();
    const serit = d.querySelector('.ve-fead-kan-bos.sembolik');
    expect(serit).not.toBeNull();
    expect(serit.querySelector('b').textContent).toBe(fead.VE_FEAD_SEMBOLIK_BASLIK);
    expect(serit.textContent).toContain('Gergi yay ön yük momenti girilmedi.');
    expect(serit.querySelector('.ek').textContent).toBe('+2 eksik daha');
    const ipucu = serit.getAttribute('title');
    expect(ipucu).toContain('Gergi yay katsayısı');
    expect(ipucu).toContain('Yay çalışma momenti');
    expect(html).not.toContain('Şema çizilemiyor');
    // Rozet kartın durumunu söylemeye devam ediyor.
    expect(d.querySelector('.ve-fead-kan-durum.no')).not.toBeNull();
  });

  test('ters köprü sembolik çizimde de: her isabet halkası KONUM GİRDİSİNE döner', () => {
    const { lay } = kur();
    const d = dom(fead.veFeadLayoutCardHTML(lay));
    const svg = d.querySelector('.ve-fead-kanvas svg[data-fead-xf]');
    expect(svg).not.toBeNull();
    const xf = fead._feadCizimXf(svg);
    const hit = [...d.querySelectorAll('g[data-ve="hit"] circle.ve-fead-hit')];
    expect(hit).toHaveLength(4);
    hit.forEach((c) => {
      const n = global.nodes.find((x) => x.id === c.getAttribute('data-fead-k'));
      const [x, y] = fead._feadCizimMm(xf, { x: +c.getAttribute('cx'), y: +c.getAttribute('cy') });
      const [gx, gy] = girdi(n);
      expect(x).toBeCloseTo(gx, 1);
      expect(y).toBeCloseTo(gy, 1);
      expect(c.getAttribute('fill')).toBe('transparent');        // CSS'siz belgede görünmez
      expect(c.getAttribute('onmousedown')).toBe("veFeadCizimBas(event,'" + lay.id + "','" + n.id + "')");
    });
    // İşaret zemini de görünmez nitelikle (kılavuz kartı CSS'siz gömüyor).
    d.querySelectorAll('[data-ve="pulley-hov"]').forEach((c) => {
      expect(c.getAttribute('fill')).toBe('none');
      expect(c.getAttribute('opacity')).toBe('0');
    });
  });

  test('şeritteki kasnağın halkası VAR (tık penceresini açar), çizime sürüklemeyi söyler', () => {
    const { lay, ac } = kur();
    delete ac.data.x; delete ac.data.y;
    const d = dom(fead.veFeadLayoutCardHTML(lay));
    const h = d.querySelector('g[data-ve="hit"] circle[data-fead-k="' + ac.id + '"]');
    expect(h).not.toBeNull();
    expect(h.getAttribute('data-yok')).toBe('1');
    expect(h.querySelector('title').textContent).toContain('çizime sürükle');
    expect(d.querySelector('[data-ve="sem-bekleyen"] text').textContent).toBe('konum yok — çizime sürükle');
  });

  test('seçili kasnak işaretli — şeritte de; rapor çizimi katman taşımaz', () => {
    const { lay, ac } = kur();
    delete ac.data.x; delete ac.data.y;
    global.selectedNodes = [ac];
    const d = dom(fead.veFeadLayoutCardHTML(lay));
    const isa = [...d.querySelectorAll('[data-fead-k="' + ac.id + '"].is-sel')];
    expect(isa.length).toBeGreaterThanOrEqual(2);                     // zemin + çember
    // Kartın dışındaki çizim (rapor, panel): etkileşim katmanı YOK.
    const b = M.veFeadBuildSystem(global.nodes);
    const r = fead.veFeadLayoutSVG(b, 440, 400, { sembolik: true });
    expect(r).not.toContain('data-fead-xf');
    expect(r).not.toContain('veFeadCizimBas');
    expect(r).not.toContain('data-fead-k');
  });

  test('ŞERİT ÇİZİMİN ÜSTÜNDE: bütün çemberler ve adlar şeridin bandının altında', () => {
    const { lay } = kur();
    const svg = dom(fead.veFeadLayoutCardHTML(lay)).querySelector('.ve-fead-kanvas svg');
    const yk = fead.veFeadYaziK();
    const ust = fead.VE_FEAD_SEM_UST / yk;
    svg.querySelectorAll('circle[data-ve="sem-kasnak"]').forEach((c) => {
      expect(+c.getAttribute('cy') - +c.getAttribute('r')).toBeGreaterThanOrEqual(ust - 0.01);
    });
    svg.querySelectorAll('[data-ve="sem-ad"]').forEach((t) => {
      expect(+t.getAttribute('y') - 9).toBeGreaterThanOrEqual(ust - 0.01);
    });
  });

  test('şeridin boyu JS ↔ CSS birebir; ipucu jetonunun yedeği de aynı sayı', () => {
    const H = fead.VE_FEAD_SEM_H;
    expect(fead.VE_FEAD_SEM_UST).toBe(6 + H + 6);
    expect(CSS).toMatch(new RegExp('\\.ve-fead-layout-card\\{ --fead-sem-h:' + H + 'px; \\}'));
    const kural = /\.ve-fead-kan-bos\.sembolik\{([^}]*)\}/.exec(CSS);
    expect(kural).not.toBeNull();
    expect(kural[1]).toMatch(/top:6px/);
    expect(kural[1]).toContain('max-height:var(--fead-sem-h, ' + H + 'px)');
    // Şerit en çok iki satır — boyu taşarsa çizime biner.
    expect(CSS).toMatch(/\.ve-fead-kan-bos\.sembolik > span\{[^}]*-webkit-line-clamp:2/);
  });

  test('çözülen modelde şerit ve sembolik çizim YOK', () => {
    const { lay } = kur(false);
    const d = dom(fead.veFeadLayoutCardHTML(lay));
    expect(d.querySelector('svg[data-sembolik]')).toBeNull();
    expect(d.querySelector('.ve-fead-kan-bos')).toBeNull();
    expect(d.querySelector('[data-ve="belt"]')).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════ KURULUM ══
describe('KURULUM — çözülmeyen model de kurulur, söylenerek', () => {
  const sahteKanvas = () => {
    global.nodes = []; global.connections = [];
    let k = 0;
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      if (d.maxInstances && global.nodes.filter((n) => n.type === type).length >= d.maxInstances) return null;
      const n = { id: 'cs' + ++k, type, def: d, x, y,
                  width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} };
      global.nodes.push(n); return n;
    };
  };
  afterEach(() => { delete global.createNode; });

  test('STEP benzeri model: düğme AÇIK ve çözümsüz işaretli; kurulum 4 kasnak kurar ve UYARIYLA söyler', () => {
    stepBenzeri();
    wiz.veFeadWizGoto(wiz.VE_FW_STEPS.length - 1);
    const b = wiz.veFeadWizBuild();
    expect(b.ok).toBe(false);
    const d = dom(wiz.veFeadWizFootHTML(b));
    const dugme = d.querySelector('#ve-fw-create');
    expect(dugme.disabled).toBe(false);                 // eskiden: disabled (b.ok istiyordu)
    expect(dugme.getAttribute('data-cozumsuz')).toBe('1');
    expect(dugme.getAttribute('title')).toContain('eksikler kanvastaki kartta');
    // Kurulum kartı ne olacağını kurmadan ÖNCE söylüyor.
    const oz = adimDOM(ADIM('ozet'));
    expect(oz.querySelector('[data-ve-fw-kur-sembolik]').textContent).toContain('3 eksik');

    sahteKanvas();
    const out = wiz.veFeadWizCreate();
    expect(out).toBeTruthy();
    const kasnaklar = global.nodes.filter((n) => componentDefs[n.type].isFeadPulley);
    expect(kasnaklar).toHaveLength(4);
    const t = stubs.showToast.mock.calls.pop();
    expect(t[1]).toBe('warning');
    expect(t[0]).toContain('kayış yolu çözülmedi: 3 eksik girdi');
    // Kurulan model önizlemeyle AYNI eksiği taşıyor ve kart onu sembolik çizer.
    const kb = M.veFeadBuildSystem(global.nodes);
    expect(kb.ok).toBe(false);
    expect(kb.errors).toEqual(b.errors);
    const lay = global.nodes.find((n) => n.type === 'fead-layout');
    expect(fead.veFeadLayoutCardHTML(lay)).toContain('data-sembolik="1"');
  });

  test('gerginin çapı/kol boyu eksikliği ENGEL DEĞİL, adıyla NOT; kasnak yoksa kurulum KAPALI', () => {
    kabuk(); wiz.veFeadWizReset();
    const k0 = wiz.veFeadWizCanCreate();
    expect(k0.ok).toBe(false);                          // kurulacak kasnak yok
    expect(k0.sebep).toMatch(/henüz kasnak yok/i);
    expect(k0.sebep).toMatch(new RegExp(ADIM('kasnak') + 1 + '\\. adımda'));

    elle();
    const k1 = wiz.veFeadWizCanCreate();
    expect(k1.ok).toBe(true);
    expect(k1.eksik).toEqual(['kasnak çapı', 'kol boyu']);
    expect(k1.not).toMatch(/kasnak çapı ve kol boyu girilmedi/);
    expect(k1.not).toMatch(new RegExp(ADIM('gergi') + 1 + '\\. adımda'));
    const kart = adimDOM(ADIM('ozet'));
    const notlar = [...kart.querySelectorAll('.ve-fw-issue-warn')].map((e) => e.textContent);
    expect(notlar.some((m) => /kol boyu girilmedi/.test(m))).toBe(true);
    expect(notlar.some((m) => /Model yine kurulur/.test(m))).toBe(true);
  });

  test('çözülen modelde düğme işaretsiz, bildirim BAŞARI', () => {
    kabuk(); wiz.veFeadWizSeed('AG00686_1475_GATES_2023');
    wiz.veFeadWizGoto(wiz.VE_FW_STEPS.length - 1);
    const d = dom(wiz.veFeadWizFootHTML(wiz.veFeadWizBuild()));
    expect(d.querySelector('#ve-fw-create').getAttribute('data-cozumsuz')).toBeNull();
    sahteKanvas();
    wiz.veFeadWizCreate();
    const t = stubs.showToast.mock.calls.pop();
    expect(t[1]).toBe('success');
  });
});

// ═══════════════════════════════════════════════════════════════ MASA ══
describe('SİHİRBAZ MASASI — çözülmeyen model', () => {
  test('STEP benzeri modelde DÖRT çizim adımı da çizer (eskiden 4/4 cümle)', () => {
    stepBenzeri();
    ['kasnak', 'gergi', 'kayis', 'ozet'].forEach((key) => {
      const m = adimDOM(ADIM(key)).querySelector('#ve-fw-masa-cizim');
      expect([key, !!m.querySelector('svg[data-sembolik="1"]')]).toEqual([key, true]);
      expect([key, m.querySelector('.ve-fw-masa-bos')]).toEqual([key, null]);
    });
  });

  test('masa katmanı sembolik dönüşümle çalışır: isabet yerli kasnakta, seçim izdüşümü konumsuzda YOK', () => {
    const st = elle();
    st.pulleys[0].x = -200; st.pulleys[0].y = 0;        // alternatör yerinde
    wiz.veFeadWizSec(st.pulleys[0].key);
    let d = adimDOM(ADIM('kasnak'));
    expect(d.querySelectorAll('#ve-fw-masa .ve-fw-hit')).toHaveLength(1);
    expect(d.querySelector('#ve-fw-masa [data-ve="secim-x"]').textContent).toBe('X ' + veSayi(-200, 1));
    wiz.veFeadWizSec(st.pulleys[1].key);                // klima şeritte
    d = adimDOM(ADIM('kasnak'));
    expect(d.querySelector('#ve-fw-masa [data-ve="secim"]')).toBeNull();
    // Katman yine çiziliyor (ek katman patlasaydı eksen ve isabet de giderdi).
    expect(d.querySelectorAll('#ve-fw-masa .ve-fw-hit')).toHaveLength(1);
    expect(d.querySelector('#ve-fw-masa [data-ve="eksen"]')).not.toBeNull();
  });

  test('ANAHTAR ÇİZİLENİ adlandırır: sıra çizgisi ancak çiziliyorsa, sırttan ve çapsız varsa', () => {
    stepBenzeri();
    let lj = adimDOM(ADIM('kasnak')).querySelector('#ve-fw-masa-lejant').textContent;
    expect(lj).toContain('kayış sırası (sembolik)');
    expect(lj).toContain('sırttan');
    expect(lj).not.toContain('çap girilmedi');
    elle();                                             // hepsi şeritte, gergi çapsız
    lj = adimDOM(ADIM('kasnak')).querySelector('#ve-fw-masa-lejant').textContent;
    expect(lj).not.toContain('kayış sırası');
    expect(lj).not.toContain('çap girilmedi');          // şeritteki çapsız gergi noktalı çizilmiyor
  });

  // Uzaklaşan kadrajda ilk X çentiği köşedeki "mm"nin hemen sağına düşebiliyor
  // ve yazısı birime biniyordu ("mm−400", ölçüldü: STEP örneği, 1440×900).
  // Gerçek tarayıcı kadrajları o pencereye her zaman düşmüyor — kapı kadrajı
  // bir çentik boyu, 0,25 birim adımla TARAR.
  test('EKSEN BİRİMİ "mm" X ekseninin yazısına değmez — kadraj bir çentik boyu taranır', () => {
    kabuk();
    const W = 474, H = 444, s = 0.5, f = (v) => Math.round(v * 100) / 100;
    const xA = wiz.VE_FW_EKSEN.sol - 8, yA = H - wiz.VE_FW_EKSEN.alt + 6;
    let yazili = 0, ilk = Infinity;
    for (let ox = 0; ox < 200 * s; ox += 0.25) {
      const T = { W, H, f, s, ox, oy: 0, mx: -600, my: 400,
                  tx: (x) => ox + (x + 600) * s, ty: (y) => (400 - y) * s };
      const d = dom('<svg>' + wiz._fwEksenSVG(T) + '</svg>');
      [...d.querySelectorAll('.ve-fw-eksen-yazi text')].forEach((t) => {
        if (t.textContent === 'mm' || Math.abs(+t.getAttribute('y') - (yA + 12)) > 0.01) return;
        yazili++;
        // Yazının ALT SINIR eni: rakam ≥ 4,5 birim (≈ 8 birimlik yazı × 0,56 em);
        // "mm"nin sağ kenarı xA − 4, arada en az 2 birim.
        const sol = +t.getAttribute('x') - t.textContent.length * 4.5 / 2;
        ilk = Math.min(ilk, sol);
      });
    }
    expect(yazili).toBeGreaterThan(0);
    expect(ilk).toBeGreaterThanOrEqual(xA - 4 + 2);
  });

  test('SIĞDIRMA NEFESİ: kasnaklar masanın kenarlarından nefes kadar içeride (12 örnek)', () => {
    kabuk();
    const W = 640, H = 600;                              // jsdom'daki masa ölçüsü (`_fwMasa`)
    const n = Math.round(Math.min(W, H) * wiz.VE_FW_MASA_NEFES);
    expect(n).toBeGreaterThanOrEqual(40);
    M.veFeadExampleKeys().forEach((key) => {
      wiz.veFeadWizSeed(key);
      const svg = adimDOM(ADIM('kasnak')).querySelector('#ve-fw-masa-cizim svg');
      const vb = svg.getAttribute('viewBox').split(' ').map(Number);
      const cem = [...svg.querySelectorAll('circle[data-ve="pulley"]')]
        .map((c) => [+c.getAttribute('cx'), +c.getAttribute('cy'), +c.getAttribute('r')]);
      expect([key, cem.length > 0]).toEqual([key, true]);
      const x0 = Math.min(...cem.map((c) => c[0] - c[2])), x1 = Math.max(...cem.map((c) => c[0] + c[2]));
      const y0 = Math.min(...cem.map((c) => c[1] - c[2])), y1 = Math.max(...cem.map((c) => c[1] + c[2]));
      const k = vb[2] / W;                               // masa birimi = px / k
      // Sol ve alt eksenin, üst çipin payının ÜSTÜNE nefes; sağda yakınlaştırma düğmeleri.
      expect([key, x0 >= (wiz.VE_FW_EKSEN.sol + n) * k - 0.5]).toEqual([key, true]);
      expect([key, vb[2] - x1 >= n * k - 0.5]).toEqual([key, true]);
      expect([key, y0 >= n * k - 0.5]).toEqual([key, true]);
      expect([key, vb[3] - y1 >= (wiz.VE_FW_EKSEN.alt + n) * k - 0.5]).toEqual([key, true]);
    });
  });
});
