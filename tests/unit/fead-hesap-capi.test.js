/**
 * fead-hesap-capi.test.js — HESAP ÇAPI: KAYIŞIN KORD ÇİZGİSİ NEREDE
 *
 * Kullanıcı isteği (2026-09-28): *"Biz şu an 147 mm çap ile hesap yapıyoruz
 * fakat kullanıcı kayışın kalınlığını da hesaba katıp 150 mm çap ile hesap
 * yapmak isteyebilir."* Kararlar: seçim KAYIŞ İÇİN TEK (kord çizgisi tek);
 * STEP'ten kurulan modelde varsayılan CAD eskizinin d_w'si.
 *
 * Kasnağın çapı `od` (d_b) girdidir; çekirdek kayış yolunu, hız oranını ve
 * kuvvetleri kord çizgisinde kurar (kaburgalı OD/2 + h_b, sırt OD/2 + h_r).
 * Seçilen şey h_b / h_r'nin KAYNAĞI (`belt.hesapCap`):
 *   katalog (boş) · cad (hbCad · hrCad) · db (h_b = h_r = 0)
 *
 * Kapılar:
 *   · KATALOG ESKİ DAVRANIŞIN BAYT BAYT AYNISI — kayış nesnesine dokunulmaz
 *   · ÇEKİRDEK SEÇİLEN ÇİFTLE KURAR — her kasnağın rPitch/rEff'i, üç kaynak
 *   · ÖZDEŞLİK L_pitch − L_eff = 2π·h_b(etkin) — her örnek, üç kaynak
 *   · ÇEKİRDEĞİN TUZAĞI: hb + hr birlikte verilince katalog düşerdi — ön
 *     birleştirme kaburga adımını, kalınlığı, kütleyi, kord rijitliğini korur
 *   · SESSİZ YEDEK YOK: CAD seçili ama ölçü yoksa katalog + uyarı
 *   · BÜTÜN YÜZEYLER AYNI d_w'yi yazar (kart · sağ sütun · rapor · özet ·
 *     sihirbaz bandı) — dönüşüm tek yerde
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const fead = require('../../js/cp-fead.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

function kur(key, mut) {
  const pack = veFeadExampleNodes(key);
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  if (mut) mut(pack.nodes);
  return veFeadBuildSystem(pack.nodes);
}
const kayis = (nodes) => nodes.find((n) => n.type === 'fead-belt').data;
const geomOf = (b) => F.tensionerState(b.sys, F.meanRel(b.sys)).geom;
const ORNEKLER = () => Object.keys(VE_FEAD_EXAMPLES);
const CAD = { hesapCap: 'cad', hbCad: 1.5, hrCad: 1.5 };

describe('KATALOG — eski davranışın bayt bayt aynısı', () => {
  test('boş alan ve "katalog": kayış nesnesine hb/hr/kord YAZILMAZ, geometri aynı', () => {
    let n = 0;
    for (const key of ORNEKLER()) {
      const a = kur(key);
      const k = kur(key, (nodes) => { kayis(nodes).hesapCap = 'katalog'; });
      if (!a.ok) continue;
      expect([key, 'hb' in a.sys.belt, 'hr' in a.sys.belt, 'kord' in a.sys.belt]).toEqual([key, false, false, false]);
      expect([key, JSON.stringify(k.sys.belt)]).toEqual([key, JSON.stringify(a.sys.belt)]);
      const ga = geomOf(a), gk = geomOf(k);
      expect([key, gk.LeffMm, gk.LpitchMm]).toEqual([key, ga.LeffMm, ga.LpitchMm]);
      expect(a.kord.kaynak).toBe('katalog');
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });
});

describe('ÇEKİRDEK SEÇİLEN ÇİFTLE KURAR', () => {
  test.each([
    ['cad', CAD, 1.5, 1.5],
    ['db', { hesapCap: 'db' }, 0, 0]
  ])('%s: kaburgalı rPitch = OD/2 + h_b, sırt rPitch = OD/2 + h_r (her örnek)', (_ad, alan, hb, hr) => {
    let n = 0;
    for (const key of ORNEKLER()) {
      const b = kur(key, (nodes) => { Object.assign(kayis(nodes), alan); });
      if (!b.ok) continue;
      for (const p of b.sys.pulleys) {
        const beklenen = p.contact === 'grooved'
          ? { rPitch: p.od / 2 + hb, rEff: p.od / 2 }
          : { rPitch: p.od / 2 + hr, rEff: p.od / 2 + hr + hb };
        expect([key, p.name, p.rPitch, p.rEff]).toEqual([key, p.name, beklenen.rPitch, beklenen.rEff]);
      }
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });

  test('özdeşlik L_pitch − L_eff = 2π·h_b(etkin) — her örnek, üç kaynak', () => {
    let n = 0;
    for (const key of ORNEKLER()) {
      for (const [alan, hb] of [[{}, null], [CAD, 1.5], [{ hesapCap: 'db' }, 0]]) {
        const b = kur(key, (nodes) => { Object.assign(kayis(nodes), alan); });
        if (!b.ok) continue;
        const h = hb === null ? F.beltProps({ profile: b.sys.belt.profile, brand: b.sys.belt.brand }).hb : hb;
        const g = geomOf(b);
        expect([key, alan.hesapCap || 'katalog', Math.abs(g.LpitchMm - g.LeffMm - 2 * Math.PI * h) < 1e-6])
          .toEqual([key, alan.hesapCap || 'katalog', true]);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(30);
  });

  test('d_b seçilince kayış yolu kasnak çaplarında: krankın kord çapı = dış çapı', () => {
    const b = kur('AG00686_1475_GATES_2023', (nodes) => { kayis(nodes).hesapCap = 'db'; });
    const krank = b.sys.pulleys.find((p) => p.contact === 'grooved' && p.crank)
      || b.sys.pulleys.find((p) => p.contact === 'grooved');
    expect(2 * krank.rPitch).toBe(krank.od);
  });
});

describe('ÇEKİRDEĞİN TUZAĞI — ön birleştirme katalog sabitlerini düşürmez', () => {
  test('tuzak gerçek: hb + hr birlikte verilince beltProps kataloğu birleştirmez', () => {
    const bp = F.beltProps({ profile: 'PK', brand: 'GATES', hb: 1.5, hr: 1.5 });
    expect(bp.ribPitch).toBeUndefined();
    expect(bp.cordStiffnessNPerRib).toBeUndefined();
  });
  test('köprü kataloğu ALTA koyar: kaburga adımı · kalınlık · min. çap · kütle · kord rijitliği yerinde', () => {
    const kat = F.beltProps({ profile: 'PK', brand: 'GATES' });
    for (const alan of [CAD, { hesapCap: 'db' }]) {
      const b = kur('AG00686_1475_GATES_2023', (nodes) => { Object.assign(kayis(nodes), alan); });
      expect(b.ok).toBe(true);
      const bp = b.sys._bp;
      for (const a of ['ribPitch', 'thickness', 'minPulleyDia', 'maxSpeedMs', 'cordStiffnessNPerRib'])
        expect([alan.hesapCap, a, bp[a]]).toEqual([alan.hesapCap, a, kat[a]]);
      // Köprünün yazdığı alan katalogun üstünde kalır (kaynaklı kütle varsayılanı)
      expect(bp.massPerRibKgM).toBe(kur('AG00686_1475_GATES_2023').sys.belt.massPerRibKgM);
      expect([bp.hb, bp.hr]).toEqual(alan.hesapCap === 'db' ? [0, 0] : [1.5, 1.5]);
    }
  });
  test('kütle ve kord rijitliği hesabı kaynaktan bağımsız: açıklık frekansı girdisi değişmez', () => {
    const a = kur('AG00686_1475_GATES_2023'), c = kur('AG00686_1475_GATES_2023', (nodes) => { Object.assign(kayis(nodes), CAD); });
    expect(c.sys.belt.massPerRibKgM).toBe(a.sys.belt.massPerRibKgM);
    expect(c.sys._bp.cordStiffnessNPerRib).toBe(a.sys._bp.cordStiffnessNPerRib);
  });
});

describe('SESSİZ YEDEK YOK', () => {
  test('CAD seçili ama ölçü yok: katalog kullanılır VE uyarı yazılır', () => {
    const b = kur('AG00686_1475_GATES_2023', (nodes) => { kayis(nodes).hesapCap = 'cad'; });
    expect(b.ok).toBe(true);
    expect(b.kord.kaynak).toBe('katalog');
    expect(b.warnings.join(' ')).toMatch(/CAD eskizi.*kataloğu kullanıldı/);
    expect('kord' in b.sys.belt).toBe(false);
  });
  test('h_r ölçülmemişse (eskizde sırt kasnağı yok) katalogdan — ve kaynağı söylenir', () => {
    const kat = F.beltProps({ profile: 'PK', brand: 'GATES' });
    const b = kur('AG00686_1475_GATES_2023', (nodes) => { Object.assign(kayis(nodes), { hesapCap: 'cad', hbCad: 1.5 }); });
    expect(b.kord).toMatchObject({ kaynak: 'cad', hb: 1.5, hr: kat.hr, hrKaynak: 'katalog' });
    expect(veFeadKordOfset(b.sys.belt)).toMatchObject({ kaynak: 'cad', hb: 1.5, hr: kat.hr, hrKaynak: 'katalog' });
  });
});

describe('DÖNÜŞÜM TEK YERDE — kayış nesnesi etkin h_b ile', () => {
  test('veFeadBoyCizgileri(L, kayış): d_w = çekirdeğin L_pitch\'i (düğüm verisi = çözülmüş kayış)', () => {
    for (const alan of [{}, CAD, { hesapCap: 'db' }]) {
      let bdVeri = null;
      const b = kur('AG00686_1475_GATES_2023', (nodes) => { Object.assign(kayis(nodes), alan); bdVeri = kayis(nodes); });
      const g = geomOf(b);
      const x1 = veFeadBoyCizgileri(g.LeffMm, b.sys.belt);
      const x2 = veFeadBoyCizgileri(g.LeffMm, bdVeri);
      expect([alan.hesapCap || 'katalog', Math.abs(x1.dw - g.LpitchMm) < 1e-9]).toEqual([alan.hesapCap || 'katalog', true]);
      expect(x2.dw).toBe(x1.dw);
      expect(x2.kaynak).toBe(x1.kaynak);
    }
  });
  test('eski imza (profil, marka) katalogu okur', () => {
    const x = veFeadBoyCizgileri(1000, 'PK', 'CONTITECH');
    expect(x.hb).toBe(1.5);
    expect(x.kaynak).toBe('katalog');
  });
});

// ── BÜTÜN YÜZEYLER AYNI d_w'yi YAZAR ────────────────────────────────────────
// Dönüşüm tek yerde (`veFeadBoyCizgileri` + `veFeadKordOfset`); her yüzey
// kayışın KENDİSİNİ verir. Biri profil/marka ile çağırsaydı CAD seçiliyken
// katalog h_b'siyle yazar, belge kendi içinde 0,3·2π mm çelişirdi.
describe('BÜTÜN YÜZEYLER AYNI d_w\'yi yazar — CAD ve d_b', () => {
  const RP = require('../../js/cp-fead-report.js');
  const SU = require('../../js/cp-fead-summary.js');
  const wiz = require('../../js/cp-fead-wizard.js');
  Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
  Object.keys(RP).forEach((k) => { if (global[k] === undefined) global[k] = RP[k]; });
  const coz = (alan) => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const b = pack.nodes.find((n) => n.type === 'fead-belt');
    Object.assign(b.data, alan, { beltDataMode: 'full' });
    global.nodes = pack.nodes; global.connections = pack.connections;
    const build = veFeadBuildSystem(pack.nodes);
    const solv = pack.nodes.find((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver);
    const R = veFeadAnalyze(build, { rows: veFeadDutyRows(solv), cylinders: 6, fatigueModel: 'PK-2_2p-MT3' });
    R.build = build; R.pulleyNames = build.names;
    return { R, belt: b };
  };
  const NODE = { id: 'rep1', type: 'fead-report', data: {} };
  const esc = (s) => s.replace(/\./g, '\\.');

  test.each([
    ['cad', CAD, 1.5, 'CAD kayış eskizinden ölçüldü', 'kesit-dw'],
    ['db', { hesapCap: 'db' }, 0, 'yok sayıldı — hesap d<sub>b</sub> çizgisinde', 'kesit-db']
  ])('%s: rapor · özet · sihirbaz bandı · kart · sağ sütun aynı kordu yazar', (_ad, alan, hb, kaynak, cizgi) => {
    const { R, belt } = coz(alan);
    expect(R.build.ok).toBe(true);
    const L = R.build.sys.belt.effLength;
    const kord = veSayi(L + 2 * Math.PI * hb, 1);
    // rapor §8.2: kord satırı, hesap çapı satırı, h_b kaynağı, figürün hesap çizgisi
    const h = RP._frSection8(R, NODE);
    expect(h).toMatch(new RegExp('Kord boyu \\(d<sub>w</sub> çizgisi[^<]*</td><td>' + esc(kord) + '<'));
    expect(h).toMatch(new RegExp('Hesap çapı</td><td>d<sub>' + (hb ? 'w' : 'b') + '</sub>'));
    expect(h).toMatch(new RegExp('kord ofseti h<sub>b</sub></td><td>' + esc(veSayi(hb, 2)) + '</td><td class="c">mm</td><td class="l">' + kaynak));
    expect(h).toMatch(new RegExp('data-ve="' + cizgi + '" data-ve-hesap="1"'));
    // Sonuç Özeti
    expect(SU._fsrSheet1(R, NODE)).toContain(veSayi(L, 1) + ' mm · kord ' + kord);
    // sihirbaz bandı (çözümün boyu kilitli kipte L_eff − ofset)
    const bl = R.build.beltLengthMm;
    expect(wiz.veFeadWizLiveHTML(R.build)).toContain('d<sub>w</sub> ' + veSayi(bl + 2 * Math.PI * hb, 1));
    // sihirbazın Kayış adımı: "Kord boyu (CAD çizgisi)" okuması
    if (!document.getElementById('ve-feadwiz-overlay'))
      document.body.innerHTML += '<div id="ve-feadwiz-overlay"><div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
    wiz.veFeadWizReset();
    expect(wiz.veFeadWizStepHTML(3, R.build))
      .toContain('Kord boyu (CAD çizgisi)</span><b>' + veSayi(bl + 2 * Math.PI * hb, 1) + ' mm</b>');
    // pencerenin Boy kartı ve sağ sütun
    const x = fead.veFeadBoyOkuma(belt);
    expect(x.dw - x.db).toBeCloseTo(2 * Math.PI * hb, 9);
    const c = Object.fromEntries(fead.veFeadBeltSideRows(belt).satirlar);
    expect(fead.veFeadBoyCizgileriHTML(belt)).toContain('value="' + c['Kord boyu'] + '"');
    expect(c['Hesap çapı']).toBe(hb ? 'Kord (d_w) · CAD eskizi' : 'Kasnak dış çapı (d_b)');
  });

  test('katalogda da hesap çizgisi işaretli: d_w dolu ve kalın, d_b kesikli', () => {
    const { R } = coz({});
    const h = RP._frSection8(R, NODE);
    expect(h).toMatch(/data-ve="kesit-dw" data-ve-hesap="1"/);
    expect(h).toMatch(/data-ve="kesit-db" x1/);                 // işaretsiz
    expect(h).toMatch(/Hesap çapı<\/td><td>d<sub>w<\/sub> \(kord\)<\/td><td class="c">—<\/td><td class="l">girdi — marka kataloğu/);
    expect(h).toMatch(/kord ofseti h<sub>b<\/sub><\/td><td>1,20<\/td><td class="c">mm<\/td><td class="l">profil sabiti/);
  });

  test('CAD seçiliyken figür eskizin h_b / h_r\'siyle ölçekli: kord–d_b aralığı h_b ile orantılı', () => {
    const y = (svg, ad) => Number(new RegExp('data-ve="' + ad + '"[^>]*y1="([\\d.]+)"').exec(svg)[1]);
    const kat = fead.veFeadKesitSVG('PK', 'GATES', {});
    const cad = fead.veFeadKesitSVG('PK', 'GATES', { kord: { kaynak: 'cad', hb: 1.5, hr: 1.5 } });
    const oran = (svg) => (y(svg, 'kesit-db') - y(svg, 'kesit-dw'));
    // Gates kataloğu h_b 1,2 · CAD 1,5 — aynı ölçekte aralık 1,5/1,2 kat
    expect(oran(cad) / oran(kat)).toBeCloseTo(1.5 / 1.2, 1);
  });
});

describe('KAYIŞ PENCERESİ VE SİHİRBAZ — tek liste, tek alan', () => {
  const wiz = require('../../js/cp-fead-wizard.js');
  const tekKayis = (data) => {
    const n = { id: 'blt1', type: 'fead-belt', def: componentDefs['fead-belt'], data };
    global.nodes = [n]; global.connections = [];
    return n;
  };
  test('CAD seçeneği YALNIZ eskizden ölçülmüş h_b varken sunulur; sayılar etiketin içinde', () => {
    expect(fead.veFeadHesapCapSecenekleri({ brand: 'GATES' }).map((o) => o[0])).toEqual(['katalog', 'db']);
    const s = fead.veFeadHesapCapSecenekleri({ brand: 'GATES', hbCad: 1.5 });
    expect(s.map((o) => o[0])).toEqual(['katalog', 'cad', 'db']);
    expect(s[0][1]).toMatch(/Gates kataloğu · h_b 1,20/);
    expect(s[1][1]).toMatch(/CAD eskizi · h_b 1,50/);
  });
  test('pencere seçiciyi Profil sekmesinde basar, seçili olan alanın değeri; ipucu hesaptaki çifti söyler', () => {
    const n = tekKayis({ lengthMode: 'fixed', effLength: 1410, profile: 'PK', brand: 'GATES', hesapCap: 'cad', hbCad: 1.5, hrCad: 1.5 });
    const d = document.createElement('div');
    d.innerHTML = fead.getFeadBeltPropertiesHTML(n);
    const sel = d.querySelector('#ve-fead-hesapCap-blt1');
    expect(sel).not.toBeNull();
    expect(sel.value).toBe('cad');
    expect(sel.getAttribute('onchange')).toContain("veFeadSetChoice('blt1','hesapCap'");
    expect(d.textContent).toMatch(/Hesapta: hb = 1,50 mm · hr = 1,50 mm \(CAD eskizi\)/);
  });
  test('sihirbazın Kayış adımı AYNI listeyi basar ve durumun alanını yazar', () => {
    document.body.innerHTML += '<div id="ve-feadwiz-overlay"><div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
    wiz.veFeadWizReset();
    const st = wiz.veFeadWizState();
    st.belt.hbCad = 1.5;
    const d = document.createElement('div');
    d.innerHTML = wiz.veFeadWizStepHTML(3, null);             // 4 · Kayış
    const sel = [...d.querySelectorAll('select')].find((s) => /belt\.hesapCap/.test(s.getAttribute('onchange')));
    expect([...sel.options].map((o) => o.value)).toEqual(fead.veFeadHesapCapSecenekleri(st.belt).map((o) => o[0]));
  });
  test('TOHUM → DÜĞÜM gidiş-dönüş: hesap çapı ve CAD ölçüsü kurulan modele taşınır', () => {
    const ex = JSON.parse(JSON.stringify(VE_FEAD_EXAMPLES.AG00686_1475_GATES_2023));
    Object.assign(ex.belt, { hesapCap: 'cad', hbCad: 1.5, hrCad: 1.5 });
    const st = wiz._fwSeedKayit(ex);
    const bd = wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-belt').data;
    expect(bd).toMatchObject({ hesapCap: 'cad', hbCad: 1.5, hrCad: 1.5 });
    st.belt.hesapCap = 'katalog';                       // varsayılan alan yazmaz
    expect(wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-belt').data.hesapCap).toBeUndefined();
  });
});

describe('KILAVUZ — açıklama kılavuzda, sihirbazda değil', () => {
  test('§8.6 hesap çapını ve üç seçeneği anlatır; nerede seçildiğini söyler', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/guide-fead.js'), 'utf8');
    expect(src).toMatch(/8\.6 Hesap çapı — kayış yolu hangi çizgide kurulur/);
    for (const s of ['Kord (d<sub>w</sub>) · marka kataloğu', 'Kord (d<sub>w</sub>) · CAD eskizi', 'Kasnak dış çapı (d<sub>b</sub>)'])
      expect(src).toContain(s);
    expect(src).toMatch(/kayış için tektir/);
    expect(src).toMatch(/Profil<\/b> sekmesi → <em>Hesap çapı<\/em>/);
  });
});
