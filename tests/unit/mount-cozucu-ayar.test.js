/**
 * mount-cozucu-ayar.test.js — ÇÖZÜCÜ: SAYISAL YÖNTEMİN AYARI (Canlı Not 3002)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı 2026-11-13: *"Bu çözücü bileşeni, programın girdileri ve matematiği
 * çözerken kullandığı sayısal yöntemleri, farklı çözüm yöntemlerini vs belirleyecek
 * … profesyonel ticari programları aratmayan bir yapı kuralım."*
 *
 * Çözücü penceresi dört kategori taşır (Ayarlar · Statik denge · Dinamik · Geçici
 * rejim); ayar düğümde `data.cozucu = { statik, modal, frf, gecici }`, yalnız
 * varsayılandan farklı alanlar. Varsayılanın ve aralığın tek kaynağı çekirdek
 * (statikAyar · modalAyar · frfAyar · geciciAyar). Kapılar — hepsi SESSİZ hata sınıfı:
 * ayar pencerede görünür ama çözüme gitmezse sonuç seçilmeyen yöntemle üretilir.
 *
 *   · PENCERE — kategoriler ve bölümler; seçici modeli izler; entegratörün
 *     parametresi yalnız kendi yönteminde.
 *   · YAZICI — varsayılan yazılmaz, aralık dışı sınıra, tanınmayan varsayılana,
 *     kayıt değişiklikten SONRA.
 *   · VARSAYILAN = BUGÜN — ayarsız ve varsayılanları açıkça yazılmış çözüm birebir.
 *   · AKIŞ — statik ayar çekirdeğin statik çözücüsüne, geçici rejim şok çözümüne,
 *     frekans yanıtı Sonuçlar'ın ve raporun ızgarasına; R.cozucu raporda.
 *   · MODAL TABAN — statik tabanda modlar K_stat'ın modları; raporun rijitlik
 *     tabloları takozun kendi değerleri.
 *   · İMZA — ayar sonucu bayatlatır, varsayılanı yazmak bayatlatmaz.
 *   · PARAMETRİK — taramanın hazırlığı Çözücü'nün ayarını taşır.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const rep = require('../../js/cp-mount-report.js');
['veMntUygunluk', 'veMntRaporOpts', '_mntRepCaseTr', '_mntRepIsolation', '_mntRepEngine', '_mntRepZeta']
  .forEach((k) => { global[k] = rep[k]; });

const ornek = (ad) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples', ad + '_topoloji.json'), 'utf8'));
function kur(ad) {
  const t = ornek(ad || 'tulga');
  global.nodes = t.nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  global.connections = t.connections || [];
  return global.nodes;
}
const cozucu = () => global.nodes.find((n) => n.type === 'mnt-solver');
const takozlar = () => global.nodes.filter((n) => n.type === 'mnt-mount');
// Eğrili model: her takozun düşeyine asimptotlu basma yasası (orijin eğimi kataloğunki) —
// Newton yolunu (solveCaseNL) açar.
function egrili() {
  takozlar().forEach((n) => {
    const kz = Number(n.data.kzs);
    n.data.fitZ = { form: 'asym', comp: { k0: kz, xmax: 25 }, ext: { k0: kz, c3: 0 } };
  });
}
const coz = () => cp._mntComputeResults(cozucu().id);
const ac = (n) => { document.body.innerHTML = '<div class="ve-properties-content">' + cp.getMntSolverPropertiesHTML(n) + '</div>'; };

beforeEach(() => { resetStubs(stubs); cp._mntForgetResults(); global._veMntLast = null; jest.restoreAllMocks(); });

describe('PENCERE — dört kategori, bölümler, seçiciler', () => {
  test('kategoriler ve bölüm başlıkları; ilk bölüm Canlı Not 165\'in yan yana Yöntem\'i', () => {
    kur();
    ac(cozucu());
    expect([...document.querySelectorAll('.ve-fp-kat')].map((k) => k.getAttribute('aria-label')))
      .toEqual(['Ayarlar', 'Statik denge', 'Dinamik', 'Geçici rejim']);
    expect([...document.querySelectorAll('.ve-fp-sect b')].map((b) => b.textContent))
      .toEqual(['Yöntem', 'Nonlineer çözüm', 'Yakınsama', 'Temas', 'Modal', 'Frekans yanıtı', 'Zaman entegrasyonu', 'Newton yinelemesi']);
    // her seçici modeli izler (yerinde tazelemede kurulmaz)
    [...document.querySelectorAll('select[id^="ve-mnt-coz-"]')].forEach((s) => expect(s.hasAttribute('data-mnt-izle')).toBe(true));
  });

  test('alanlar çözülmüş ayarı gösterir — varsayılan değer alanın kendisi, seçicide seçili', () => {
    kur();
    const n = cozucu();
    ac(n);
    const V = cp._mntCozucuAyar({ data: {} });
    const id = (g, a) => document.getElementById('ve-mnt-coz-' + g + '-' + a + '-' + n.id);
    expect(id('statik', 'yontem').value).toBe(V.statik.yontem);
    expect(Number(id('statik', 'maxIter').value)).toBe(V.statik.maxIter);
    expect(Number(id('frf', 'nPts').value)).toBe(240);
    expect(id('modal', 'taban').value).toBe('dinamik');
    expect(id('gecici', 'entegrator').value).toBe('newmark-ort');
    expect(Number(id('gecici', 'adimPeriyot').value)).toBe(V.gecici.adimPeriyot);
  });

  test('entegratörün parametresi yalnız kendi yönteminde: HHT-α\'da α, genelleştirilmiş-α\'da ρ∞', () => {
    kur();
    const n = cozucu();
    const slot = () => document.getElementById('ve-mnt-coz-param-' + n.id);
    ac(n);
    expect(slot().children.length).toBe(0);
    cp.veMntSetCozucu(n.id, 'gecici', 'entegrator', 'hht');
    ac(n);
    expect(slot().querySelector('input').id).toBe('ve-mnt-coz-gecici-alfa-' + n.id);
    cp.veMntSetCozucu(n.id, 'gecici', 'entegrator', 'gen-alfa');
    ac(n);
    expect(slot().querySelector('input').id).toBe('ve-mnt-coz-gecici-rhoInf-' + n.id);
  });
});

describe('YAZICI — çekirdeğin çözücüsünden geçer', () => {
  test('varsayılan yazılmaz; boş siler; tanınmayan seçenek varsayılana düşer (alan yok)', () => {
    kur();
    const n = cozucu();
    cp.veMntSetCozucu(n.id, 'statik', 'yontem', 'newton');
    expect(n.data.cozucu).toBeUndefined();
    cp.veMntSetCozucu(n.id, 'statik', 'yontem', 'bfgs');
    expect(n.data.cozucu).toEqual({ statik: { yontem: 'bfgs' } });
    cp.veMntSetCozucu(n.id, 'statik', 'yontem', 'uydurma');
    expect(n.data.cozucu).toBeUndefined();
    cp.veMntSetCozucu(n.id, 'frf', 'nPts', '400');
    cp.veMntSetCozucu(n.id, 'frf', 'nPts', '');
    expect(n.data.cozucu).toBeUndefined();
    cp.veMntSetCozucu(n.id, 'yok', 'x', 1);                         // tanınmayan grup: dokunmaz
    expect(n.data.cozucu).toBeUndefined();
  });

  test('aralık dışı sınıra; Türkçe ondalık; Açık/Kapalı mantıksal; kayıt değişiklikten SONRA', () => {
    kur();
    const n = cozucu();
    let gorulen = null;
    stubs.saveState.mockImplementation(() => { gorulen = JSON.stringify(n.data.cozucu || null); });
    cp.veMntSetCozucu(n.id, 'frf', 'nPts', '100000');
    expect(n.data.cozucu.frf.nPts).toBe(core.frfAyar({ nPts: 1e9 }).nPts);
    expect(gorulen).toBe(JSON.stringify(n.data.cozucu));
    cp.veMntSetCozucu(n.id, 'frf', 'fMin', '0,5');
    expect(n.data.cozucu.frf.fMin).toBe(0.5);
    cp.veMntSetCozucu(n.id, 'frf', 'incelt', 'kapali');
    expect(n.data.cozucu.frf.incelt).toBe(false);
    cp.veMntSetCozucu(n.id, 'frf', 'incelt', 'acik');
    expect(n.data.cozucu.frf.incelt).toBeUndefined();
    cp.veMntSetCozucu(n.id, 'statik', 'tolF', '1e-6');
    expect(n.data.cozucu.statik.tolF).toBe(1e-6);
  });
});

describe('VARSAYILAN = BUGÜN — ayarsız çözüm ile varsayılanları yazılmış çözüm birebir', () => {
  const ozet = (R) => JSON.stringify({ q: R.allCases.map((c) => c.res && c.res.q), f: R.modes.map((m) => m.f_Hz),
    d: (R.damping || []).map((d) => d.c) });
  test.each([['lineer', false], ['eğrili (Newton)', true]])('%s', (ad, nl) => {
    kur();
    if (nl) egrili();
    const A = ozet(coz());
    const V = cp._mntCozucuAyar({ data: {} });
    cozucu().data.cozucu = JSON.parse(JSON.stringify(V));            // her alan açıkça varsayılan
    const B = ozet(coz());
    expect(B).toBe(A);
    expect(cp._mntComputeResults(cozucu().id).solvedNL).toBe(nl);
  });
});

describe('AKIŞ — ayar çözüme, Sonuçlar\'a ve rapora gider', () => {
  test('statik ayar çekirdeğin statik çözücüsüne: Newton yolu ve lineer (durduruculu) yol', () => {
    kur();
    egrili();
    const n = cozucu();
    cp.veMntSetCozucu(n.id, 'statik', 'yontem', 'bfgs');
    cp.veMntSetCozucu(n.id, 'statik', 'artim', '3');
    cp.veMntSetCozucu(n.id, 'statik', 'aktifTur', '20');
    const nl = jest.spyOn(core, 'solveCaseNL');
    const R = coz();
    expect(nl).toHaveBeenCalled();
    const o = nl.mock.calls[0][5];
    expect([o.yontem, o.artim, o.aktifTur, o.useStop]).toEqual(['bfgs', 3, 20, true]);
    expect(R.cozucu.statik).toMatchObject({ yontem: 'bfgs', artim: 3, aktifTur: 20 });
    nl.mockRestore();
    takozlar().forEach((t) => { delete t.data.fitZ; });              // lineer model
    const ln = jest.spyOn(core, 'solveCaseStop');
    coz();
    expect(ln.mock.calls[0][6].aktifTur).toBe(20);
  });

  test('geçici rejim ayarı şok çözümüne (Sonuçlar\'ın kanalları)', () => {
    kur();
    const n = cozucu();
    cp.veMntSetCozucu(n.id, 'gecici', 'entegrator', 'hht');
    cp.veMntSetCozucu(n.id, 'gecici', 'alfa', '-0,2');
    const sp = jest.spyOn(core, 'shockResponse');
    const R = coz();
    expect(sp).toHaveBeenCalled();
    const o = sp.mock.calls[0][4];
    expect([o.entegrator, o.alfa]).toEqual(['hht', -0.2]);
    expect(R.cozucu.gecici).toMatchObject({ entegrator: 'hht', alfa: -0.2 });
  });

  test('koşullu kararlı entegratör: kaba adım kararlılık sınırına iner ve Sonuçlar\'ın yorumu söyler', () => {
    kur();
    const n = cozucu();
    // Tulga'da durdurucu teması var; temas oranı 10⁴ ve periyot başına 4 adımda temas frekansı
    // doğrusal ivmenin kararlılık sınırını aşar (ölçüldü: Δt 5 → 0,743 ms). Temasın oranı statik
    // dengeyle aynı: şoka da gider.
    cp.veMntSetCozucu(n.id, 'statik', 'stiffRatio', '10000');
    cp.veMntSetCozucu(n.id, 'gecici', 'entegrator', 'newmark-dogrusal');
    cp.veMntSetCozucu(n.id, 'gecici', 'adimPeriyot', '4');
    const sp = jest.spyOn(core, 'shockResponse');
    const R = coz();
    expect(sp.mock.calls[0][4].stiffRatio).toBe(10000);
    sp.mockRestore();
    const ds = R.signals.find((d) => d.key === 'shockz');
    expect(ds.meta).toMatchObject({ entegrator: 'newmark-dogrusal', dtKisit: true, kararli: true });
    const B = global.veMntBrief.forLane(ds, R, [ds.channels.find((c) => /bileşke sehim/.test(c.name)).id]);
    expect(B.paras.join('\n')).toMatch(/Kararlılık için zaman adımı .* ms.* oldu\./);
    cp.veMntSetCozucu(n.id, 'gecici', 'entegrator', 'hht');            // koşulsuz kararlı: kısıt yok, cümle yok
    const R2 = coz();
    const ds2 = R2.signals.find((d) => d.key === 'shockz');
    expect(ds2.meta.dtKisit).toBe(false);
    const B2 = global.veMntBrief.forLane(ds2, R2, [ds2.channels.find((c) => /bileşke sehim/.test(c.name)).id]);
    expect(B2.paras.join('\n')).not.toMatch(/Kararlılık için zaman adımı/);
  });

  test('frekans yanıtı ayarı Sonuçlar\'ın ve raporun ızgarası: aralık ve nokta sayısı, inceltme kapalıyken taban', () => {
    kur();
    const n = cozucu();
    cp.veMntSetCozucu(n.id, 'frf', 'fMin', '1');
    cp.veMntSetCozucu(n.id, 'frf', 'fMax', '50');
    cp.veMntSetCozucu(n.id, 'frf', 'nPts', '60');
    cp.veMntSetCozucu(n.id, 'frf', 'incelt', 'kapali');
    const g = jest.spyOn(core, 'frfGrid');
    const R = coz();
    const o = g.mock.calls[0][4];
    expect([o.fMin, o.fMax, o.nPts, o.incelt]).toEqual([1, 50, 60, false]);
    const izgara = g.mock.results[0].value;
    expect(izgara).toHaveLength(60);                                  // inceltme yok: yalnız taban
    expect(izgara[0]).toBeCloseTo(1, 12);
    expect(izgara[59]).toBeCloseTo(50, 9);
    expect(rep._mntRepFrfAyar(R)).toEqual({ fMin: 1, fMax: 50, nPts: 60, incelt: false });
  });

  test('rapor: sayısal çözüm ayarları tablosu çözümün kaydından', () => {
    kur();
    const n = cozucu();
    cp.veMntSetCozucu(n.id, 'gecici', 'entegrator', 'gen-alfa');
    const R = coz();
    const h = rep._mntRepCozucuAyar(R);
    expect(h).toContain('Sayısal çözüm ayarları');
    expect(h).toContain('Genelleştirilmiş-α');
    expect(h).toContain('doğrudan çözüm (lineer model)');            // Tulga eğrisiz: Newton koşmadı
    expect(h).toContain('240 nokta');
    expect(rep._mntRepCozucuAyar({})).toBe('');                       // eski çözüm (R.cozucu yok): tablo yok
  });
});

describe('MODAL TABAN — statik rijitlik tabanı', () => {
  test('modlar K_stat\'ın modları; dinamik analizlerin takozları k_stat; raporun takozları kendi değerleri', () => {
    kur();
    const Rd = coz();
    cp.veMntSetCozucu(cozucu().id, 'modal', 'taban', 'statik');
    const Rs = coz();
    const Ks = core.buildK(Rs.mounts, Rs.mp.cg, false);
    const beklenen = core.solveModal(Ks, core.buildM6(Rs.mp.m, Rs.mp.I_G), Rs.mounts, Rs.mp.cg).map((m) => m.f_Hz);
    Rs.modes.forEach((m, i) => expect(m.f_Hz).toBeCloseTo(beklenen[i], 9));
    expect(Rs.modes[5].f_Hz).not.toBeCloseTo(Rd.modes[5].f_Hz, 3);       // gerçekten başka taban
    Rs.dinMounts.forEach((m) => expect(m.kdyn).toEqual(m.kstat));
    expect(Rs.mounts.map((m) => m.kdyn)).toEqual(Rd.mounts.map((m) => m.kdyn));
    Rs.damping.forEach((d, i) => expect(d.kBasis).toEqual(Rs.mounts[i].kstat));
  });
});

describe('İMZA — ayar sonucu bayatlatır', () => {
  test('her grubun ayarı bayatlatır, geri alınınca güncel; varsayılanı yazmak bayatlatmaz', () => {
    kur();
    const n = cozucu();
    global._veMntLast = coz();
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    [['statik', 'maxIter', '30'], ['modal', 'taban', 'statik'], ['frf', 'nPts', '100'], ['gecici', 'entegrator', 'hht']]
      .forEach(([g, a, v]) => {
        cp.veMntSetCozucu(n.id, g, a, v);
        expect([g, cp.veMntSonucDurumu().durum]).toEqual([g, 'bayat']);
        cp.veMntSetCozucu(n.id, g, a, '');
        expect([g, cp.veMntSonucDurumu().durum]).toEqual([g, 'guncel']);
      });
    n.data.cozucu = JSON.parse(JSON.stringify(cp._mntCozucuAyar({ data: {} })));
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
  });
});

describe('PARAMETRİK — taramanın hazırlığı Çözücü\'nün ayarını taşır', () => {
  test('_mntPrepareFrom(…, Çözücü) çözülmüş ayarı hazırlığa koyar', () => {
    kur();
    const n = cozucu();
    cp.veMntSetCozucu(n.id, 'statik', 'yontem', 'modnewton');
    const prep = cp._mntPrepareFrom(cp._mntGatherForSolver(n), n);
    expect(prep.ayar.statik.yontem).toBe('modnewton');
    const sihirbaz = cp._mntPrepareFrom(cp._mntGatherForSolver(n), { data: {} });   // sihirbazın önizlemesi: varsayılan
    expect(sihirbaz.ayar).toEqual(cp._mntCozucuAyar({ data: {} }));
  });
});
