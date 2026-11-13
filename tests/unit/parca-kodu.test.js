/**
 * parca-kodu.test.js — PROGRAMDA PARÇA KODU YOK (kullanıcı 2026-11-11, Canlı Not 1004:
 * "Artık program içinde BMC parça kodu görmek istemiyorum … Programda ne BMC parça kodu
 * varsa, hepsini kaldır.")
 * ─────────────────────────────────────────────────────────────────────────
 *   · KAYNAK — programa giren hiçbir dosyada (js/ · css/ · index.html · assets/examples)
 *     parça kodu yok: ne ad, ne anahtar, ne yorum
 *   · GÖÇ — eski projenin anahtarı (takozun libKey'i, aksesuarın aksKatalog'u, kasnağın
 *     accLib'i, çözücünün engineLib'i, sihirbazın durumu, adayların listesi ve nesne
 *     anahtarı, `bmc:` önekli değer) yenisine göç eder; göçün hedefi bugünün kataloğunda VAR
 *   · ETİKET — FEAD'in motor ve aksesuar listesi ve Takoz'un kayıtlı aksesuarı kodsuz ve
 *     etiketler TEK (aynı adlı motorlar ayrıştıkları kasnak çapıyla)
 *
 * ESKİ KODLAR YALNIZ BURADA (test, programa girmez): göçün girdisi.
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '../..');

// Eski anahtar → yeni anahtar (programda yalnız özetleri var — js/state.js → VE_PARCA_GOC).
const ESKI = {
  // Takoz kütüphanesi
  '57RS313773': 'a26-a', '57RS313774': 'a26-b', '57RS313773-sr116': 'asfat-a', '57RS313774-sr116': 'asfat-b',
  // FEAD aksesuar kataloğu (aynı modelin birebir aynı satırları tek kayıt)
  '57RS317093': 'prestolite-180a', '57RS318932': 'prestolite-180a', '57RS320300': 'prestolite-180a',
  '57RS321859': 'tepas-350a', '57RS309791': 'prestolite-120a', '57RS317557': 'prestolite-140a',
  '57RS309036': 'prestolite-155a', '57RS309348': 'prestolite-155a', '54100000001': 'prestolite-250a',
  '57RS322565': 'prestolite-600a', '57RS321633': 'valeo-tm21', '55100000130': 'valeo-tm31',
  '57RS322530': 'valeo-tm31', '57RS319930': 'sanden-7h15',
  // FEAD motor kataloğu (iki satır birebir aynı motor)
  '57RS303251': 'motor-01', '57RS303276': 'motor-02', '57RS303310': 'motor-03', '57RS303311': 'motor-04',
  '57RS303321': 'motor-05', '57RS303324': 'motor-06', '57RS303325': 'motor-07', '57RS303290': 'motor-08',
  '57RS303322': 'motor-09', '57RS303234': 'motor-10', '57RS303252': 'motor-11', '57RS303315': 'motor-11',
  '57RS303280': 'motor-12', '57RS303323': 'motor-13', '57RS303120': 'motor-14', '57RS303172': 'motor-15',
  '57RS303235': 'motor-16', '57RS303304': 'motor-17', '57RS303309': 'motor-18', '57RS303316': 'motor-19',
  '57RS303279': 'motor-20', '57RS303291': 'motor-21', '57RS303308': 'motor-22', '57RS303317': 'motor-23',
  // Askı yayı kataloğu (şema 11 — kayıt şema 10'dan sonra da yazılmıştı)
  'bmc-2k60377': 'tta-aski',
};
// Tablonun kendisi doğru mu: eski motor kataloğunun 24 satırı, aksesuarın 14 satırı, takozun 4 girdisi,
// askı yayının 1 girdisi (resmin ve malzeme belgesinin kodu).
const KOD = /57RS\d{4,}[A-Z]?|54100000001|55100000130|2[Kk]60377|BRS170582/;

function dosyalar(dizin, uz) {
  const out = [];
  (function gez(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) gez(p); else if (uz.test(e.name)) out.push(p);
    });
  })(dizin);
  return out;
}

describe('KAYNAK — programa giren dosyalarda parça kodu yok', () => {
  test('js/ · css/ · index.html · assets/examples', () => {
    const build = fs.readFileSync(path.join(KOK, 'build.js'), 'utf8') + fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
    // programa girmeyen ölü dosya (Yapısal Analiz kalktı; base64'ünde rastlantı "57RS")
    const js = dosyalar(path.join(KOK, 'js'), /\.js$/).filter((p) => build.indexOf(path.basename(p)) >= 0 || !/structural-occt/.test(p));
    const liste = js.concat(dosyalar(path.join(KOK, 'css'), /\.css$/), [path.join(KOK, 'index.html')],
      dosyalar(path.join(KOK, 'assets/examples'), /\.json$/));
    const bulunan = [];
    liste.forEach((p) => {
      if (/structural-occt-wasm/.test(p)) return;
      fs.readFileSync(p, 'utf8').split('\n').forEach((s, i) => { if (KOD.test(s)) bulunan.push(path.relative(KOK, p) + ':' + (i + 1)); });
    });
    expect(bulunan).toEqual([]);
    expect(build.indexOf('structural-occt-wasm')).toBe(-1);   // atlanan dosya programa girmiyor
  });
});

describe('GÖÇ — eski projenin anahtarı yenisine', () => {
  global.nodes = []; global.connections = [];
  eval(fs.readFileSync(path.join(KOK, 'js/state.js'), 'utf8'));
  const C = require('../../js/cp-mount.js');
  global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
  const E = require('../../js/fead-engines.js');
  const A = require('../../js/fead-accessories.js');

  test('tablo: 43 eski anahtar, programda yalnız özetleri; her hedef bugünün kataloğunda', () => {
    expect(Object.keys(ESKI).length).toBe(43);
    expect(Object.keys(VE_PARCA_GOC).length).toBe(43);
    Object.keys(ESKI).forEach((k) => expect(VE_PARCA_GOC[_veFnv(k)]).toBe(ESKI[k]));
    const var_ = new Set([].concat(Object.keys(C.VE_MOUNT_LIBRARY), E.VE_FEAD_ENGINE_DB.map((e) => e.key), A.VE_FEAD_ACC_DB.map((a) => a.key),
      require('../../js/mount-yay.js').VE_MNT_YAY.map((y) => y.k)));
    Object.values(ESKI).forEach((v) => expect(var_.has(v)).toBe(true));
  });

  test('değer, iç içe nesne, dizi, nesne anahtarı ve `bmc:` öneki; alt topoloji de; şema 11', () => {
    const eski = () => ({
      schemaVersion: 9,
      nodes: [
        { id: 't1', type: 'mnt-mount', data: { libKey: '57RS313774-sr116', customName: 'Ön · eski ad' } },
        { id: 'a1', type: 'mnt-alternator', data: { aksKatalog: '57RS318932', mass: 9.8 } },
        { id: 'p1', type: 'mnt-parametric', data: { adaylar: { 't1|t2': ['57RS313773', 'amc55sha'] }, haric: ['57RS313774'] } },
        { id: 'k1', type: 'mnt-library', data: { ozel: { '57RS313773-sr116': { sx: 1 } } } },
        { id: 'y1', type: 'mnt-aski', data: { yay: 'bmc-2k60377', k: 57.39 } },
        { id: 'f', type: 'fead-analysis', data: { subTopology: { schemaVersion: 9, nodes: [
          { id: 'alt', type: 'fead-alternator', data: { accLib: '57RS309348', accLibVer: '1.0.0' } },
          { id: 'cz', type: 'fead-solver', data: { engineLib: '57RS303315' } },
          { id: 'sz', type: 'fead-wizard', data: { wiz: { pulleys: [{ accLib: '55100000130' }], secim: 'bmc:57RS319930' } } },
        ] } } },
      ],
    });
    const s = veApplyLegacyMigrations(eski());
    expect(s.schemaVersion).toBe(11);
    const d = (id) => s.nodes.find((n) => n.id === id).data;
    expect(d('t1')).toEqual({ libKey: 'asfat-b', customName: 'Ön · eski ad' });   // kullanıcının adı yerinde
    expect(d('a1').aksKatalog).toBe('prestolite-180a');
    expect(d('p1')).toEqual({ adaylar: { 't1|t2': ['a26-a', 'amc55sha'] }, haric: ['a26-b'] });
    expect(d('k1').ozel).toEqual({ 'asfat-a': { sx: 1 } });
    expect(d('y1')).toEqual({ yay: 'tta-aski', k: 57.39 });
    const alt = s.nodes.find((n) => n.id === 'f').data.subTopology;
    const fd = (id) => alt.nodes.find((n) => n.id === id).data;
    expect(fd('alt').accLib).toBe('prestolite-155a');
    expect(fd('cz').engineLib).toBe('motor-11');
    expect(fd('sz').wiz).toEqual({ pulleys: [{ accLib: 'valeo-tm31' }], secim: 'bmc:sanden-7h15' });
    expect(alt.schemaVersion).toBe(11);
    expect(JSON.stringify(s)).not.toMatch(KOD);
    // güncel kayıt göçe girmez; ikinci geçiş bir şey değiştirmez
    expect(veParcaKoduGoc(s)).toBe(0);
  });

  test('şema 10 damgalı kayıtta askı yayının eski anahtarı da göç eder; öteki alanlar yerinde', () => {
    const s = veApplyLegacyMigrations({ schemaVersion: 10, nodes: [
      { id: 'y1', type: 'mnt-aski', data: { yay: 'bmc-2k60377', montajF: 80, customName: 'Sol askı' } },
      { id: 't1', type: 'mnt-mount', data: { libKey: 'asfat-a' } },
    ] });
    expect(s.schemaVersion).toBe(11);
    expect(s.nodes.map((n) => n.data)).toEqual([{ yay: 'tta-aski', montajF: 80, customName: 'Sol askı' }, { libKey: 'asfat-a' }]);
    expect(JSON.stringify(s)).not.toMatch(KOD);
  });
});

describe('ETİKET — listeler kodsuz ve tek', () => {
  global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
  const E = require('../../js/fead-engines.js');
  const A = require('../../js/fead-accessories.js');
  test('motor ve aksesuar etiketleri kodsuz, tek; aynı adlı motorlar kasnak çapıyla ayrışır', () => {
    const me = E.veFeadEngineList().map((e) => e.label), ae = A.veFeadAccList().map((a) => a.label);
    [].concat(me, ae).forEach((l) => expect(l).not.toMatch(KOD));
    expect(new Set(me).size).toBe(me.length);
    expect(new Set(ae).size).toBe(ae.length);
    expect(me.filter((l) => /ISL8\.9E3 375/.test(l))).toEqual([
      'ISL8.9E3 375/FR94882  ·  2.100 RPM  ·  krank Ø218,3', 'ISL8.9E3 375/FR94882  ·  2.100 RPM  ·  krank Ø197,72']);
    expect(E.veFeadEngineFind('ISL8.9').map((e) => e.key)).toEqual(['motor-10', 'motor-11']);
    expect([E.VE_FEAD_ENGINE_DB.length, A.VE_FEAD_ACC_DB.length]).toEqual([23, 10]);
  });
});
