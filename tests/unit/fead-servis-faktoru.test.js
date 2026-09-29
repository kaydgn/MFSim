/**
 * fead-servis-faktoru.test.js — SERVİS FAKTÖRÜ c₂ (kural 48)
 *
 * Kullanıcı isteği (2026-09-29): servis faktörü bir yük katsayısı TABLOSUNDAN
 * seçilir — kayışın penceresinde ve sihirbazda — ve "matematiksel hesap ona
 * göre güncellenir". Tablo endüstriyel kayış hesabının c₂'sidir: aksesuar
 * gücünü tasarım gücüne çevirir (P_B = c₂·P). Kayma emniyeti bu tasarım
 * yükünde hesaplanır, hüküm SF ≥ 1. Gerilme, hubload, ömür GERÇEK yükte kalır.
 *
 * Kapının en değerli parçası BAĞIMSIZ YOL: köprü tasarım gerginliklerini afin
 * özdeşlikle kuruyor (T_B = T₀ + c₂·(T − T₀)); test aynı modeli bütün
 * aksesuar kW'larını c₂ ile ÇARPIP c₂'siz çözüyor. İki yol aynı kayma
 * satırlarını vermek zorunda — afin cebir kullanılmadan.
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const E = require('../../js/fead-engines.js');
const A = require('../../js/fead-accessories.js');
const K = require('../../js/fead-checks.js');
const RP = require('../../js/cp-fead-report.js');
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
const DUTY = require('../../js/fead-duty.js');
const BELTS = require('../../js/fead-belts.js');
const TENS = require('../../js/fead-tensioners.js');
[DUTY, BELTS, TENS, E, A, K].forEach((m) => {
  Object.keys(m).forEach((k) => { global[k] = m[k]; });
});
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(RP).forEach((k) => { if (global[k] === undefined) global[k] = RP[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};

// Örnekten çözüm — `mut(solverData)` servis faktörünü ya da yükleri değiştirir.
function coz(anahtar, mut, kwCarpan) {
  const pack = M.veFeadExampleNodes(anahtar);
  const ns = pack.nodes.map((n) => ({
    id: n.id, type: n.type, def: componentDefs[n.type],
    customName: n.customName, data: JSON.parse(JSON.stringify(n.data))
  }));
  const b0 = ns.find((n) => n.type === 'fead-belt');
  if (b0) b0.data.beltDataMode = 'full';
  const sv = ns.find((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver);
  if (mut) mut(sv.data);
  const build = M.veFeadBuildSystem(ns);
  const rows = M.veFeadDutyRows(sv).map((r) => {
    if (!(kwCarpan > 0)) return r;
    const kw = {};
    Object.keys(r.kw || {}).forEach((id) => { kw[id] = Number(r.kw[id]) * kwCarpan; });
    return Object.assign({}, r, { kw });
  });
  const R = M.veFeadAnalyze(build, { rows, cylinders: 6 });
  R.build = build;
  R.pulleyNames = build.names;
  return { R, build, ns, sv };
}
const temizle = (sd) => { delete sd.serviceFact; delete sd.servisHucre; };

// ══════════════════════════════════════════════════════════ TABLO ══
describe('TABLO — kullanıcının ekran görüntüsüyle birebir', () => {
  const T = M.VE_FEAD_SERVIS;
  test('24 hücre, dört yük sınıfı × iki sürücü grubu × üç çalışma süresi', () => {
    expect(T.yuk.map((y) => y.k)).toEqual(['hafif', 'orta', 'agir', 'cokAgir']);
    expect(T.surucu.map((s) => s.k)).toEqual(['normal', 'yuksek']);
    expect(T.saat.map((q) => q.k)).toEqual(['10', '16', '24']);
    let n = 0;
    T.yuk.forEach((y) => T.surucu.forEach((s) => T.saat.forEach((q) => {
      const h = M.veFeadServisHucre(y.k + '.' + s.k + '.' + q.k);
      expect(h).toBeTruthy();
      n++;
    })));
    expect(n).toBe(24);
  });

  test('değerler kaynağın değerleri (ekran görüntüsü, satır satır)', () => {
    const d = {};
    T.yuk.forEach((y) => { d[y.k] = [...y.deger.normal, ...y.deger.yuksek]; });
    expect(d).toEqual({
      hafif:   [1.0, 1.1, 1.2, 1.1, 1.2, 1.3],
      orta:    [1.1, 1.2, 1.3, 1.2, 1.3, 1.4],
      agir:    [1.2, 1.3, 1.4, 1.4, 1.5, 1.6],
      cokAgir: [1.3, 1.4, 1.5, 1.5, 1.6, 1.8]
    });
    // Kullanıcının kırmızı çerçevelediği hücre.
    expect(M.veFeadServisHucre('cokAgir.normal.24').deger).toBe(1.5);
  });

  test('ARAÇ MOTORU NORMAL KALKIŞTA — 600 d/dk üstü birinci grupta', () => {
    // Ekran görüntüsünde iki grup da "n up to 600 rpm" yazıyor; ISO/DIN V-kayış
    // hesabında birincisi "600 üstü". Ters yazılsaydı araç motoru yüksek kalkış
    // grubuna düşer ve c₂ bir basamak büyük seçilirdi.
    expect(T.surucu[0].tanim).toMatch(/600 d\/dk üstü içten yanmalı/);
    expect(T.surucu[1].tanim).toMatch(/600 d\/dk ve altı içten yanmalı/);
    expect(T.surucu[0].alt).toBe('motor > 600 d/dk');
  });

  test('tanınmayan anahtar bir değer UYDURMAZ', () => {
    ['', 'agir', 'agir.normal', 'agir.normal.99', 'yok.normal.10', 'agir.x.10', null, undefined]
      .forEach((k) => expect(M.veFeadServisHucre(k)).toBe(null));
  });
});

// ══════════════════════════════════════════════ ÇÖZÜCÜ VE YAZICI ══
describe('ÇÖZÜCÜ — etkin c₂ ve kaynağı', () => {
  test('hücre sayıdan ÜSTÜN: değer tablodan okunur, saklanan sayıdan değil', () => {
    const s = M.veFeadServisFaktoru({ servisHucre: 'agir.normal.16', serviceFact: 9 });
    expect(s).toMatchObject({ deger: 1.3, kaynak: 'tablo', anahtar: 'agir.normal.16' });
    expect(s.etiket).toBe('Ağır iş · normal kalkış · 10–16 sa/gün');
  });
  test('hücresiz sayı KAYITLI değerdir (eski proje, kaynağı sayıyı veren örnek)', () => {
    expect(M.veFeadServisFaktoru({ serviceFact: 1.3 })).toMatchObject({ deger: 1.3, kaynak: 'kayit' });
    expect(M.veFeadServisFaktoru({ serviceFact: '1,25' })).toMatchObject({ deger: 1.25, kaynak: 'kayit' });
  });
  test('1\'in altındaki kayıtlı sayı 1\'e çekilir ve SÖYLENİR — yük katsayısı yükü azaltamaz', () => {
    const s = M.veFeadServisFaktoru({ serviceFact: 0.8 });
    expect(s.deger).toBe(1);
    expect(s.uyari).toMatch(/1'in altında/);
  });
  test('seçilmemişse c₂ = 1 ve kaynak "yok" — varsayılan uydurulmaz', () => {
    [{}, null, undefined, { serviceFact: '' }, { serviceFact: 0 }, { servisHucre: 'bozuk' }]
      .forEach((sd) => expect(M.veFeadServisFaktoru(sd)).toMatchObject({ deger: 1, kaynak: 'yok' }));
  });
  test('TEK YAZICI hücreyle sayıyı BİRLİKTE yazar, geçersiz anahtar ikisini de siler', () => {
    const sd = { serviceFact: 1.3 };
    M.veFeadServisSet(sd, 'orta.yuksek.10');
    expect(sd).toEqual({ servisHucre: 'orta.yuksek.10', serviceFact: 1.2 });
    M.veFeadServisSet(sd, '');
    expect(sd).toEqual({});
  });
  test('c₂ yazımı tek biçim: tablo tek ondalık, sondaki sıfır yok', () => {
    expect(M.veFeadServisYaz(1.3)).toBe('1,3');
    expect(M.veFeadServisYaz(1)).toBe('1');
    expect(M.veFeadServisYaz(1.25)).toBe('1,25');
    expect(M.veFeadServisYaz(1.8)).toBe('1,8');
  });
});

// ═════════════════════════════════════════════ İKİ YÜZEY, TEK ÜRETİCİ ══
describe('YÜZEYLER — kayış penceresi ve sihirbaz aynı tabloyu basar', () => {
  const kur = () => {
    const pack = M.veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((x) => { x.def = componentDefs[x.type]; });
    global.nodes = pack.nodes;
    global.connections = pack.connections;
    return pack.nodes;
  };
  const dugmeler = (h) => (h.match(/class="ve-fead-c2-h"/g) || []).length;

  test('kayışın Tasarım sekmesinde tablo var; 24 hücre düğmesi, yazıcısı depoya', () => {
    const ns = kur();
    const kayis = ns.find((n) => n.type === 'fead-belt');
    const depo = M.veFeadIsletmeDeposu(ns);
    const h = fead.getFeadBeltPropertiesHTML(kayis);
    expect(h).toContain('data-ve="servis-tablo"');
    expect(dugmeler(h)).toBe(24);
    expect(h).toContain("veFeadServisSec('" + depo.id + "','agir.normal.16')");
  });

  test('sihirbazın Kayış adımında AYNI tablo; yazıcısı sihirbazın durumuna', () => {
    kabuk(); wiz.veFeadWizReset(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const h = wiz._fwStepKayis(null);
    expect(h).toContain('data-ve="servis-tablo"');
    expect(dugmeler(h)).toBe(24);
    expect(h).toContain("veFeadWizServisSec('agir.normal.16')");
  });

  test('iki yüzeyin tablosu yazıcısı dışında BİREBİR (tek üretici)', () => {
    const ns = kur();
    const depo = M.veFeadIsletmeDeposu(ns);
    const pencere = fead.veFeadServisTabloHTML(depo.data, (k) => 'X(\'' + k + '\')');
    kabuk(); wiz.veFeadWizReset(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const sihirbaz = fead.veFeadServisTabloHTML(wiz.veFeadWizState().solver, (k) => 'X(\'' + k + '\')');
    expect(sihirbaz).toBe(pencere);
  });

  test('seçili hücre BASILI, ötekiler değil; durum satırı c₂\'yi ve hücreyi yazar', () => {
    const h = fead.veFeadServisTabloHTML({ servisHucre: 'cokAgir.normal.24', serviceFact: 1.5 }, () => '');
    expect((h.match(/aria-pressed="true"/g) || []).length).toBe(1);
    expect(h).toMatch(/data-ve-c2="cokAgir\.normal\.24" aria-pressed="true"/);
    expect(h).toContain('<b>c₂ = 1,5</b> · Çok ağır iş · normal kalkış · &gt; 16 sa/gün');
    const bos = fead.veFeadServisTabloHTML({}, () => '');
    expect((bos.match(/aria-pressed="true"/g) || []).length).toBe(0);
    expect(bos).toContain('Seçilmedi · kayma gerçek yükte (c₂ = 1)');
    expect(bos).not.toContain('Seçimi kaldır');
  });

  test('pencerenin yazıcısı depoya yazar ve geri-al adımı açar', () => {
    const ns = kur();
    const depo = M.veFeadIsletmeDeposu(ns);
    fead.veFeadServisSec(depo.id, 'agir.normal.16');
    expect(depo.data.servisHucre).toBe('agir.normal.16');
    expect(depo.data.serviceFact).toBe(1.3);
    expect(stubs.saveState).toHaveBeenCalled();
    fead.veFeadServisSec(depo.id, '');
    expect(depo.data.servisHucre).toBeUndefined();
    expect(depo.data.serviceFact).toBeUndefined();
  });

  test('SERVİS FAKTÖRÜ SERBEST SAYI OLARAK SORULMUYOR — motor kartında da sihirbazın motorunda da', () => {
    expect(fead.veFeadEngineCard({ id: 's', type: 'fead-solver', data: {} })).not.toMatch(/serviceFact/);
    expect(wiz.VE_FW_ENG_FIELDS.some((f) => /serviceFact/.test(f.yol))).toBe(false);
  });
});

// ═══════════════════════════════════════════════ GİDİŞ-DÖNÜŞ (kural 20) ══
describe('GİDİŞ-DÖNÜŞ — sihirbaz ↔ düğüm', () => {
  test('sihirbazda seçilen hücre kurulan modelin deposuna taşınır', () => {
    kabuk(); wiz.veFeadWizReset(); wiz.veFeadWizSeed('AG00879_GATES_2023');
    wiz.veFeadWizServisSec('agir.yuksek.24');
    const st = wiz.veFeadWizState();
    expect(st.solver.servisHucre).toBe('agir.yuksek.24');
    const nodes = wiz.veFeadWizNodes(st).nodes;
    const depo = M.veFeadIsletmeDeposu(nodes);
    expect(depo.data.servisHucre).toBe('agir.yuksek.24');
    expect(depo.data.serviceFact).toBe(1.6);
    expect(M.veFeadServisFaktoru(depo.data)).toMatchObject({ deger: 1.6, kaynak: 'tablo' });
  });

  test('örnekten tohumlanan hücre sihirbaza gelir (örnek → durum)', () => {
    const ex = JSON.parse(JSON.stringify(M.veFeadExampleOf('AG00879_GATES_2023')));
    ex.solver.servisHucre = 'orta.normal.10'; ex.solver.serviceFact = 1.1;
    const st = wiz._fwSeedKayit(ex);
    expect(st.solver.servisHucre).toBe('orta.normal.10');
    const depo = M.veFeadIsletmeDeposu(wiz.veFeadWizNodes(st).nodes);
    expect(M.veFeadServisFaktoru(depo.data)).toMatchObject({ deger: 1.1, kaynak: 'tablo' });
  });

  test('BOŞ SİHİRBAZ c₂ YAZMAZ — eski varsayılan 1,3\'ün kaynağı yoktu', () => {
    const s = wiz.veFeadWizDefault().solver;
    expect(s.serviceFact).toBeUndefined();
    expect(s.servisHucre).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════ HESAP ══
describe('HESAP — kayma tasarım yükünde, gerisi gerçek yükte', () => {
  test('seçilmemişse (c₂ = 1) kayma satırları BİREBİR eski satırlar', () => {
    const { R } = coz('AG00976_GATES_2025', temizle);
    expect(R.servis).toMatchObject({ deger: 1, kaynak: 'yok' });
    R.analysis.duty.forEach((d) => expect(d.slip).toBe(d.slipIsletme));
  });

  // BAĞIMSIZ YOL — afin cebir KULLANILMADAN: yükleri c₂ ile çarpıp c₂'siz çöz.
  test('tasarım satırları = yükleri c₂ katına çıkarılmış modelin satırları', () => {
    const c2 = 1.6;
    const a = coz('AG00976_GATES_2025', (sd) => { temizle(sd); M.veFeadServisSet(sd, 'agir.yuksek.24'); }).R;
    const b = coz('AG00976_GATES_2025', temizle, c2).R;
    expect(a.servis.deger).toBe(c2);
    expect(a.analysis.duty.length).toBe(b.analysis.duty.length);
    a.analysis.duty.forEach((d, j) => {
      const e = b.analysis.duty[j];
      d.slip.forEach((s, i) => {
        expect(s.tensionRatio).toBeCloseTo(e.slip[i].tensionRatio, 9);
        expect(s.SF).toBeCloseTo(e.slip[i].SF, 9);
      });
    });
    // Ve fark GERÇEK: tasarım yükünde en düşük yüklü SF gerçekten düşüyor.
    const yukluMin = (R, alan) => Math.min.apply(null, R.analysis.duty.flatMap((d) =>
      d[alan].filter((s) => s.tensionRatio >= M.VE_FEAD_SLIP_LOADED_RATIO).map((s) => s.SF)));
    expect(yukluMin(a, 'slip')).toBeLessThan(yukluMin(a, 'slipIsletme') * 0.8);
  });

  test('gerilme, hubload ve ömür c₂\'den BAĞIMSIZ — gerçek yükte kalır', () => {
    const a = coz('AG00976_GATES_2025', (sd) => { temizle(sd); M.veFeadServisSet(sd, 'cokAgir.yuksek.24'); }).R;
    const b = coz('AG00976_GATES_2025', temizle).R;
    a.analysis.duty.forEach((d, j) => {
      const e = b.analysis.duty[j];
      d.perPulley.forEach((p, i) => expect(p.exitTensionN).toBe(e.perPulley[i].exitTensionN));
      d.hubloads.forEach((h, i) => expect(h.FN).toBe(e.hubloads[i].FN));
    });
    expect(a.life.hoursB10).toBe(b.life.hoursB10);
    expect(a.fatigue.perPulley.map((p) => p.sharePct)).toEqual(b.fatigue.perPulley.map((p) => p.sharePct));
  });

  test('kayma eşiği tam c₂ katı, pay 1/c₂', () => {
    const { R } = coz('AG00976_GATES_2025', (sd) => { temizle(sd); M.veFeadServisSet(sd, 'agir.normal.16'); });
    const t1 = M.veFeadSlipThreshold(R.build, R.analysis.duty);
    const tB = M.veFeadSlipThreshold(R.build, R.analysis.duty, R.servis.deger);
    expect(tB.tensionN / t1.tensionN).toBeCloseTo(1.3, 12);
    expect(tB.margin * 1.3).toBeCloseTo(t1.margin, 12);
    expect(tB.pulley).toBe(t1.pulley);
    expect(tB.c2).toBe(1.3);
  });

  test('ÇÖZÜM c₂\'Yİ DONDURUR — sonradan değişen seçim eski sonuca sızmaz', () => {
    const { R, sv } = coz('AG00976_GATES_2025', (sd) => { temizle(sd); M.veFeadServisSet(sd, 'agir.normal.16'); });
    M.veFeadServisSet(sv.data, 'hafif.normal.10');
    expect(R.servis.deger).toBe(1.3);
  });
});

// ═══════════════════════════════════════════════════════ BELGELER ══
describe('BELGELER — hüküm tasarım yükünde ve eşik 1', () => {
  // ÖLÇÜLDÜ (2026-09-29, AG00902-1275, alan boş): §8.12 notu SF 0,85 iken
  // "Servis faktörünün üstünde." yazıyordu; aynı belgenin uygunluk tablosu
  // "SF > 1 · 0,85 ✗" diyordu. Not artık kaymayı söylüyor.
  test('boş c₂ ve SF < 1: §8.12 "üstünde" DEMEZ, kaydığını söyler; uygunluk ✗', () => {
    const { R } = coz('AG00902_1275_GATES_2023', temizle);
    const s8 = RP._frSection8(R, { id: 'r', type: 'fead-report', data: {} }).replace(/<[^>]+>/g, ' ');
    expect(s8).not.toMatch(/Servis faktörünün üstünde/);
    expect(s8).toMatch(/gerçek yükte \(c₂ seçilmedi\) KAYIYOR/);
    const u = RP._frCompliance(R).replace(/<[^>]+>/g, ' ');
    expect(u).toMatch(/SF ≥ 1 \(c₂ seçilmedi\)/);
  });

  test('seçili c₂: §8.12 tasarım yükünü ve gerçek yükteki en düşüğü birlikte yazar', () => {
    const { R } = coz('AG00976_GATES_2025', (sd) => { temizle(sd); M.veFeadServisSet(sd, 'agir.normal.16'); });
    const s8 = RP._frSection8(R, { id: 'r', type: 'fead-report', data: {} }).replace(/<[^>]+>/g, ' ');
    expect(s8).toMatch(/tasarım yükündedir/);
    expect(s8).toMatch(/c₂ = 1,3/);
    expect(s8).toMatch(/Gerçek yükte \(c₂ = 1\) en düşük SF/);
  });

  test('§8.2 künyesi c₂\'yi kaynak hücresiyle yazar', () => {
    const { R } = coz('AG00976_GATES_2025', (sd) => { temizle(sd); M.veFeadServisSet(sd, 'agir.normal.16'); });
    const s8 = RP._frSection8(R, { id: 'r', type: 'fead-report', data: {} });
    expect(s8).toMatch(/Servis faktörü c₂ \(kayma tasarım yükü\)/);
    expect(s8).toMatch(/yük katsayısı tablosu: Ağır iş · normal kalkış · 10–16 sa\/gün/);
  });

  test('KAYNAK TARAMASI: hiçbir yüzey eski eşiği (R.serviceFact) okumuyor', () => {
    const dir = path.join(__dirname, '../../js');
    const bulunan = fs.readdirSync(dir).filter((f) => /\.js$/.test(f))
      .filter((f) => /R\.serviceFact|res\.serviceFact\s*=/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(bulunan).toEqual([]);
  });
});
