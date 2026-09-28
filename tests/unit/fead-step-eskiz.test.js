/**
 * fead-step-eskiz.test.js — STEP'TE KABURGALI KASNAĞIN KESİTİ VE HESAP ÇAPI (6.2)
 *
 * Kullanıcı isteği (2026-09-28): *"3B görsel izleme kısmından krank kasnağını ve
 * klima kompresörü kasnağını seçtiğimiz zaman ... bu değerlerin otomatik olarak
 * hesaplanmasını istiyorum. Bu değerler hesaplandıktan sonra, kullanıcı oradan
 * hesaplara dahil edeceği çap değerini seçecek."* Kararlar: seçim kayış için
 * TEK; STEP'ten kurulan modelde varsayılan CAD eskizinin d_w'si.
 *
 * Kullanıcının dosyasında (depoda değil) kayış eskizinin dört yayı dört kasnağa
 * oturuyor ve dördünün ofseti 1,500 mm — ContiTech PK'nın h_b = h_r'si. Aynı
 * kalıp sentetik montajla: eskiz ÇEKİRDEĞİN geometrisinden, verilen ofsetlerle.
 *
 * Kapılar:
 *   · OKUYUCU eskizi doğru ve yay olarak okur: kapalı, boyu çekirdeğin L_pitch'i
 *     (+X · −X motor · inç/derece dosya)
 *   · TANIYICI yay − dış çap farkını kasnak başına ölçer: kaburgalıda h_b, sırtta
 *     h_r; tutarsızsa YAZMAZ ve söyler; eskizin geçmediği kasnağı söyler; kayış
 *     rolü yoksa eskiz okunmaz
 *   · KANAL TABANI yanakların uçlarına değen yüz — iç alın/delik taban değil
 *     (klimada 6,00 okunuyordu)
 *   · KAYIT: hbCad · hrCad modele, varsayılan seçim CAD; kullanıcının seçimi kazanır;
 *     katalog alan yazmaz
 *   · SİHİRBAZ: varsayılan CAD, seçici tek (kart · 3B · kasnak bölümü), kasnağın
 *     kesiti ölçülen · katalog · CAD · hesap satırlarıyla; aktarımdan sonra seçim
 *     sihirbazın kayışında; kurulan model eskizin çizgisinde çözer
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const P = require('../../js/step-p21.js');
const S = require('../../js/fead-step.js');
const U = require('../../js/step-ucgen.js');
const O = require('../helpers/step-ornek.js');

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
  require('../../js/fead-engines.js'), require('../../js/fead-accessories.js'), require('../../js/fead-checks.js'), P, S, U]
  .forEach((m) => { Object.keys(m).forEach((k) => { global[k] = m[k]; }); });
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });
const G = require('../../js/cp-fead-3b.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};
const ROL = [[/GERG/, 'fead-tensioner'], [/KRANK/, 'fead-crank'], [/KL[İI]MA/, 'fead-ac'],
  [/AVARA/, 'fead-idler'], [/KAYI/, 'fead-belt']];
const roller = (o, kural = ROL) => o.agac.map((d) => (kural.find(([re]) => re.test(d.ad)) || [])[1] || null);
const coz = (opt, kural) => { const o = S.veFeadStpOku(O.ag00686Step(opt)); return S.veFeadStpCoz(o, roller(o, kural)); };
const ESKIZ = { eskiz: { hb: 1.5, hr: 1.5 } };
const dugum = (re) => wiz.veFeadWizStp().sonuc.agac.findIndex((d) => re.test(d.ad));
const hazirla = (opt, kural = ROL) => {
  kabuk(); wiz.veFeadWizReset();
  wiz.veFeadWizStpOku(O.ag00686Step(opt), 'AG00686.stp');
  kural.forEach(([re, tip]) => { const i = dugum(re); if (i >= 0) wiz.veFeadWizStpRol(i, tip); });
  wiz.veFeadWizStpHesapla();
  return wiz.veFeadWizStp();
};
const kesitSatiri = (html, veri) => {
  const d = document.createElement('div'); d.innerHTML = html;
  const tr = d.querySelector('[data-ve-kesit="' + veri + '"]');
  return tr ? [...tr.children].map((td) => td.textContent.trim()) : null;
};

describe('OKUYUCU — eskiz doğru ve yay olarak', () => {
  test.each([
    ['+X', {}], ['−X motor', { motor: '-X' }], ['inç · derece', { uzunluk: 'inch', aci: 'derece' }]
  ])('%s: kapalı, 4 yay + 4 doğru, boyu çekirdeğin L_pitch\'i', (_ad, ek) => {
    const metin = O.ag00686Step(Object.assign({}, ESKIZ, ek));
    const m = P.veStepP21Oku(metin), mt = P.veStepP21Montaj(m);
    const kay = mt.parcalar.find((p) => p.egriler.length);
    const e = P.veStepP21Egri(m, kay.egriler[0], kay.M, kay.birim);
    expect(e).toMatchObject({ ad: 'Sketch.2', kapali: true, destek: true });
    expect(e.parcalar.map((q) => q.tip)).toEqual(['CIRCLE', 'LINE', 'CIRCLE', 'LINE', 'CIRCLE', 'LINE', 'CIRCLE', 'LINE']);
    expect(Math.abs(e.L - O.agEskiz(ESKIZ.eskiz).L)).toBeLessThan(1e-6);
  });
  test('yayın yönü okunur: ters yönlü kırpma süpürülen açıyı tümler — boy yine aynı', () => {
    // Çevre toplamı yönden bağımsız doğru olmalı: yanlış okunan yön, yayı 2π − θ
    // okur ve boy yüzlerce mm kayardı
    const g = O.agEskiz(ESKIZ.eskiz);
    const m = P.veStepP21Oku(O.ag00686Step(ESKIZ)), mt = P.veStepP21Montaj(m);
    const kay = mt.parcalar.find((p) => p.egriler.length);
    const e = P.veStepP21Egri(m, kay.egriler[0], kay.M, kay.birim);
    const yay = e.parcalar.filter((q) => q.tip === 'CIRCLE').map((q) => q.aci);
    expect(yay.map((a, i) => Math.abs(a - g.geom.wraps[i]) < 1e-9)).toEqual([true, true, true, true]);
  });
});

describe('OKUYUCU — ters yazılmış parça (same_sense .F.)', () => {
  test('okuyucu parçayı geri çevirir: eğri yine kapalı, boy aynı, eskiz yine ölçülür', () => {
    const opt = { eskiz: { hb: 1.5, hr: 1.5, sonTers: true } };
    const m = P.veStepP21Oku(O.ag00686Step(opt)), mt = P.veStepP21Montaj(m);
    const kay = mt.parcalar.find((p) => p.egriler.length);
    const e = P.veStepP21Egri(m, kay.egriler[0], kay.M, kay.birim);
    expect(e.kapali).toBe(true);
    expect(Math.abs(e.L - O.agEskiz(opt.eskiz).L)).toBeLessThan(1e-6);
    expect(coz(opt).kayis.eskiz.hb).toBeCloseTo(1.5, 9);
  });
});

describe('TANIYICI — yay − dış çap farkı kasnak başına', () => {
  test('kaburgalıda h_b, sırtta h_r; dört yay dört kasnağa; uyarı yok', () => {
    for (const ek of [{}, { motor: '-X' }, { uzunluk: 'inch', aci: 'derece' }]) {
      const c = coz(Object.assign({}, ESKIZ, ek));
      const es = c.kayis.eskiz;
      expect(es.hb).toBeCloseTo(1.5, 9);
      expect(es.hr).toBeCloseTo(1.5, 9);
      expect(es.yaylar).toHaveLength(4);
      expect(es.uyarilar).toEqual([]);
      for (const y of es.yaylar) expect(y.ofset).toBeCloseTo(1.5, 9);
    }
    const c2 = coz({ eskiz: { hb: 1.2, hr: 1.1 } });
    expect([c2.kayis.eskiz.hb, c2.kayis.eskiz.hr].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([1.2, 1.1]);
  });
  test('TUTARSIZ ofset yazılmaz ve söylenir (ortalaması kimsenin çizmediği bir çizgi)', () => {
    const c = coz({ eskiz: { hb: 1.5, hr: 1.5, ofset: { A_C: 1.2 } } });
    expect(c.kayis.eskiz.hb).toBeNull();
    expect(c.kayis.eskiz.hbYayilim).toBeCloseTo(0.3, 9);
    expect(c.kayis.eskiz.hr).toBeCloseTo(1.5, 9);           // sırt tutarlı, o yazılır
    expect(c.uyarilar.join(' ')).toMatch(/kaburgalı kasnaklarda yay − dış çap farkı tutarsız \(yayılım 0,300 mm\); h_b eskizden alınmadı/);
  });
  test('eskizin GEÇMEDİĞİ kasnak söylenir; eşleşen yaylar yine ölçülür', () => {
    const c = coz({ eskiz: { hb: 1.5, hr: 1.5, kaydir: { IDR: [5, 0] } } });
    expect(c.kayis.eskiz.yaylar).toHaveLength(3);
    expect(c.uyarilar.join(' ')).toMatch(/"Sketch\.2" "AVARA KASNAK Ø75x32,5" kasnağından geçmiyor/);
  });
  test('AÇIK eğri eskiz sayılmaz (boyu bir çevrim değil, kısmi bir yol)', () => {
    expect(coz({ eskiz: { hb: 1.5, hr: 1.5, acik: true } }).kayis.eskiz).toBeNull();
  });
  test('kayış rolü yoksa eskiz OKUNMAZ (kayışa dokunulmaz)', () => {
    const c = coz(ESKIZ, ROL.filter(([, t]) => t !== 'fead-belt'));
    expect(c.kayis).toBeUndefined();
  });
  test('eskizsiz dosya: eskiz yok, uyarı yok', () => {
    const c = coz({});
    expect(c.kayis.eskiz).toBeNull();
  });
});

describe('KANAL TABANI yanakların uçlarına değen yüz', () => {
  test('kanal penceresine düşen iç alın ve delik taban DEĞİL (klimada 6,00 okunuyordu)', () => {
    const c = coz({ klimaIcDuzlem: true });
    const ac = c.kasnaklar.find((k) => k.tip === 'fead-ac');
    // Sentetik profilin tabanı: tepe − 0,23 − 2,696 − 0,3293 (gerçek krankın sayıları)
    expect(ac.tabanCap).toBeCloseTo(127 - 2 * 3.2553, 3);
    const krank = c.kasnaklar.find((k) => k.tip === 'fead-crank');
    expect(krank.tabanCap).toBeCloseTo(160 - 2 * 3.2553, 3);
  });
});

describe('KAYIT — ölçüler modele, varsayılan CAD', () => {
  test('hbCad · hrCad µm\'ye yuvarlı, seçim CAD; CAD kartının izi eskizi taşır', () => {
    const k = S.veFeadStpKayit(coz(ESKIZ), {});
    expect(k.belt).toMatchObject({ hbCad: 1.5, hrCad: 1.5, hesapCap: 'cad' });
    expect(k.kayisCad.eskiz).toMatchObject({ ad: 'Sketch.2', hb: 1.5, hr: 1.5, yay: 4 });
    expect(Math.abs(k.kayisCad.eskiz.L - O.agEskiz(ESKIZ.eskiz).L)).toBeLessThan(0.001);
  });
  test('kullanıcının seçimi kazanır; katalog alan YAZMAZ', () => {
    const c = coz(ESKIZ);
    expect(S.veFeadStpKayit(c, { hesapCap: 'db' }).belt.hesapCap).toBe('db');
    const kat = S.veFeadStpKayit(c, { hesapCap: 'katalog' }).belt;
    expect(kat.hesapCap).toBeUndefined();
    expect(kat.hbCad).toBe(1.5);                               // seçenek sonra da açık kalsın
  });
  test('eskiz yoksa ne ölçü ne seçim yazılır', () => {
    const k = S.veFeadStpKayit(coz({}), {});
    expect(k.belt.hbCad).toBeUndefined();
    expect(k.belt.hesapCap).toBeUndefined();
    expect(k.kayisCad.eskiz).toBeUndefined();
  });
});

describe('SİHİRBAZ — seçim tek, varsayılan CAD, kesit kendiliğinden', () => {
  test('varsayılan: eskiz varsa CAD, yoksa katalog; CAD eskizsiz seçilemez', () => {
    let s = hazirla(ESKIZ);
    expect(wiz._fwStpHesapCap(s)).toBe('cad');
    s = hazirla({});
    expect(wiz._fwStpHesapCap(s)).toBe('katalog');
    expect(wiz.veFeadWizStpHesapCap('cad')).toBe(false);
    expect(wiz._fwStpHesapCap(s)).toBe('katalog');
  });
  test('kartın kasnak hücresi hesap çapını yazar — seçim değişince hepsi birlikte', () => {
    const s = hazirla(ESKIZ);
    const hucre = () => {
      const d = document.createElement('div'); d.innerHTML = wiz.veFeadWizStepHTML(0, null);
      return [...d.querySelectorAll('tr.ve-fw-stp-r')].map((tr) => tr.children[2].textContent).filter((t) => /hesap Ø/.test(t));
    };
    // krank Ø160 · klima Ø127 · avara/gergi Ø75 (sırt)
    expect(hucre().join(' | ')).toMatch(/Ø160,0.*hesap Ø163,0/);
    expect(hucre().join(' | ')).toMatch(/Ø75,0 · düz.*hesap Ø78,0/);
    wiz.veFeadWizStpHesapCap('db');
    expect(hucre().join(' | ')).toMatch(/Ø160,0.*hesap Ø160,0/);
    wiz.veFeadWizStpHesapCap('katalog');                    // Gates PK: h_b 1,2 · h_r 1,1
    expect(hucre().join(' | ')).toMatch(/Ø160,0.*hesap Ø162,4/);
    expect(hucre().join(' | ')).toMatch(/Ø75,0 · düz.*hesap Ø77,2/);
    expect(s.hesapCap).toBe('katalog');
  });
  test('kasnağın kesiti: ölçülen · katalog · CAD · hesap satırları; figürde hesap çizgisi', () => {
    const s = hazirla(ESKIZ);
    const ki = s.coz.kasnaklar.findIndex((k) => k.tip === 'fead-crank');
    const h = wiz._fwStpKasnakKesitHTML(s, ki);
    expect(kesitSatiri(h, 'adim')).toEqual(['Kanal adımı s', '3,560', 'katalog 3,56']);
    expect(kesitSatiri(h, 'db')).toEqual(['Kaburga tepesi db', '160,00', 'ölçülen']);
    expect(kesitSatiri(h, 'taban')).toEqual(['Kanal tabanı', '153,49', 'derinlik 3,26']);
    expect(kesitSatiri(h, 'dw-katalog')).toEqual(['Kord dw', '162,40', 'Gates kataloğu']);
    expect(kesitSatiri(h, 'dw-cad')).toEqual(['Kord dw', '163,00', 'CAD · hb 1,50']);
    expect(kesitSatiri(h, 'hesap')).toEqual(['Hesap çapı', '163,00', 'CAD eskizi']);
    expect(h).toMatch(/data-ve="kesit-dw" data-ve-hesap="1"/);
    // seçicinin düğmeleri BU kasnağın sayılarını taşır
    const d = document.createElement('div'); d.innerHTML = h;
    expect([...d.querySelectorAll('[data-ve-hesapcap]')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')))
      .toEqual(['dw · Gates 162,40', 'dw · CAD 163,00*', 'db 160,00']);
    // düz kasnak: sırttan — hesap çapı OD + 2·h_r
    const ai = s.coz.kasnaklar.findIndex((k) => k.tip === 'fead-idler');
    expect(kesitSatiri(wiz._fwStpKasnakKesitHTML(s, ai), 'hesap')).toEqual(['Hesap çapı', '78,00', 'CAD eskizi']);
  });
  test('3B paneli: seçili kasnağın kesiti, hesap sütunu ve TEK seçici', () => {
    const s = hazirla(ESKIZ);
    const krank = dugum(/KRANK/);
    const h = G.veFeadWiz3bPanelHTML(s, krank);
    const d = document.createElement('div'); d.innerHTML = h;
    expect(d.querySelector('[data-ve-3b-kesit]')).not.toBeNull();
    expect([...d.querySelectorAll('[data-ve-3b-hesapcap]')].map((td) => td.textContent).sort()).toEqual(['130,0', '163,0', '78,0', '78,0'].sort());
    // seçici iki yerde (kesit + hesap bölümü) ve ikisi de aynı işlevi çağırır
    const gruplar = d.querySelectorAll('[data-ve-hesapcap-grup]');
    expect(gruplar.length).toBe(2);
    [...gruplar].forEach((g) => [...g.querySelectorAll('button')].forEach((b) =>
      expect(b.getAttribute('onclick')).toMatch(/^veFeadWizStpHesapCap\('(katalog|cad|db)'\)$/)));
    // rolsüz parça seçiliyse kesit yok
    expect(G.veFeadWiz3bPanelHTML(s, -1)).not.toMatch(/data-ve-3b-kesit/);
    expect(G._fw3bSeciliKasnak(s, krank)).toBe(s.coz.kasnaklar.findIndex((k) => k.tip === 'fead-crank'));
  });
  test('kartın da seçicisi var: üç düğme, aynı işlev', () => {
    hazirla(ESKIZ);
    const d = document.createElement('div'); d.innerHTML = wiz.veFeadWizStepHTML(0, null);
    const g = d.querySelectorAll('.ve-fw-stp [data-ve-hesapcap-grup]');
    expect(g.length).toBe(1);
    expect([...g[0].querySelectorAll('button')].map((b) => b.getAttribute('data-ve-hesapcap'))).toEqual(['katalog', 'cad', 'db']);
  });
  test('aktarımdan SONRA Kayış adımında değişen seçim 3B\'de ve kartta okunur (tek kaynak: sihirbazın kayışı)', () => {
    const s = hazirla(ESKIZ);
    wiz.veFeadWizStpAktar();
    wiz._fwSetRender('belt.hesapCap', 'katalog');
    expect(wiz._fwStpHesapCap(s)).toBe('katalog');
    const ki = s.coz.kasnaklar.findIndex((k) => k.tip === 'fead-crank');
    expect(wiz._fwStpHesapCapi(s, s.coz.kasnaklar[ki])).toBeCloseTo(162.4, 9);
  });
  test('kullanıcının 3B seçimi aktarımla modele geçer (d_b) — varsayılan CAD onu ezmez', () => {
    hazirla(ESKIZ);
    wiz.veFeadWizStpHesapCap('db');
    wiz.veFeadWizStpAktar();
    expect(wiz.veFeadWizState().belt).toMatchObject({ hbCad: 1.5, hrCad: 1.5, hesapCap: 'db' });
  });
  test('alt montaj gergide parçaya tıklanınca BİRİMİN kesiti (en yakın rollü ata)', () => {
    kabuk(); wiz.veFeadWizReset();
    wiz.veFeadWizStpOku(O.gergiAltMontaj(), 'ALT.stp');
    const s = wiz.veFeadWizStp();
    const ag = s.sonuc.agac;
    wiz.veFeadWizStpRol(ag.findIndex((d) => d.ad === 'OTOMATİK GERGİ'), 'fead-tensioner');
    wiz.veFeadWizStpRol(ag.findIndex((d) => d.ad === 'KRANK'), 'fead-crank');
    wiz.veFeadWizStpHesapla();
    const kasnakParca = ag.findIndex((d) => d.ad === 'KASNAK');
    const ki = G._fw3bSeciliKasnak(s, kasnakParca);
    expect(ki).toBeGreaterThanOrEqual(0);
    expect(s.coz.kasnaklar[ki].tip).toBe('fead-tensioner');
  });
  test('aktarım: seçim ve ölçüler sihirbazın kayışına; sonra seçim ORADA değişir; model eskizin çizgisinde', () => {
    const s = hazirla(ESKIZ);
    wiz.veFeadWizStpHesapCap('db');
    wiz.veFeadWizStpHesapCap('cad');
    wiz.veFeadWizStpAktar();
    const st = wiz.veFeadWizState();
    expect(st.belt).toMatchObject({ hbCad: 1.5, hrCad: 1.5, hesapCap: 'cad' });
    Object.keys(O.AG_REF.yay).forEach((k) => wiz.veFeadWizTenSet(k, O.AG_REF.yay[k]));   // yay künyesi STEP'te yok
    const pack = wiz.veFeadWizNodes(st);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const b = veFeadBuildSystem(pack.nodes);
    expect(b.errors).toEqual([]);
    const krank = b.sys.pulleys.find((p) => p.od === 160);
    expect(krank.rPitch).toBeCloseTo(80 + 1.5, 9);
    // aktarımdan sonra 3B/kart seçimi sihirbazın kayışını yazar
    wiz.veFeadWizStpHesapCap('db');
    expect(st.belt.hesapCap).toBe('db');
    expect(wiz._fwStpHesapCap(s)).toBe('db');
  });
  test('CAD\'deki kayış kartı: eskizin adı ve ofsetleri, eskiz kordu − model kordu', () => {
    hazirla(ESKIZ);
    wiz.veFeadWizStpAktar();
    const st = wiz.veFeadWizState();
    Object.keys(O.AG_REF.yay).forEach((k) => wiz.veFeadWizTenSet(k, O.AG_REF.yay[k]));
    const pack = wiz.veFeadWizNodes(st);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const b = veFeadBuildSystem(pack.nodes);
    expect(b.ok).toBe(true);
    const h = wiz._fwCadKayisHTML(st, b);
    expect(h).toMatch(/Eskiz<\/span><b>Sketch\.2 · 4 yay · h_b 1,50 · h_r 1,50<\/b>/);
    const tm = fead.veFeadTableRows(b);
    const fk = st.stepKaynak.kayis.eskiz.L - tm.LpitchMm;
    expect(h).toContain('Eskiz kordu − model kordu</span><b>' + (fk < 0 ? '−' : '+') + veSayi(Math.abs(fk), 1) + ' mm</b>');
  });
});

describe('KILAVUZ — açıklama kılavuzda', () => {
  test('§3.5 kesiti, eskizi ve hesap çapının STEP varsayılanını anlatır', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/guide-fead.js'), 'utf8');
    expect(src).toMatch(/_gfNot\('Kaburgalı kasnağın kesiti ve hesap çapı'/);
    expect(src).toMatch(/kayış eskizi<\/strong>/);
    expect(src).toMatch(/STEP’ten kurulan modelde varsayılan eskizin/);
  });
});
