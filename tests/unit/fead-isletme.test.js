/**
 * fead-isletme.test.js — İŞLETME HESABI MOTOR VE AKSESUAR OLMADAN YAPILMAZ
 *
 * Kullanıcı bildirimi (2026-09-29): *"Hem başlangıç sihirbazında, hem de
 * programın kanvas üzerindeki değerlerinde, program motor ve aksesuar
 * seçmeden hesap yapıyor … Bu bir hata. Düzgün olsun."*
 *
 * İki sınıf sonuç var ve kapılar bu ayrımı tutar:
 *   · GEOMETRİ ve gergi statiği motordan/aksesuardan bağımsız — her zaman.
 *   · İŞLETME (gerilme, hubload, kayma, ömür, senaryo) motor künyesinden
 *     (silindir · rölanti · governed), tahrik oranından, aksesuar gücünden ve
 *     çevrimden türer. Biri eksikken üretilen sayı bir varsayımdır.
 *
 * Tek kaynak köprüde: `build.isletme` (js/fead-model.js → veFeadIsletmeEksik).
 * Çözüm, FEAD araçları penceresi, çözücü paneli, kanvas kartı, senaryo ve
 * sihirbaz AYNI hükmü okur. Kural: FEAD skill'i, kural 42.
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const rapor = require('../../js/cp-fead-report.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const TR = require('../../js/fead-transient.js');
const EN = require('../../js/fead-engines.js');
const CK = require('../../js/fead-checks.js');
const { motorTamamla, MOTOR } = require('../helpers/fead-motor');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
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
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'),
 require('../../js/fead-tensioners.js'), require('../../js/fead-accessories.js'),
 EN, CK].forEach((lib) => {
  Object.keys(lib).forEach((k) => { global[k] = lib[k]; });
});
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(TR).forEach((k) => { global[k] = TR[k]; });
global.veFeadBrief = require('../../js/fead-brief.js');
const S = require('../../js/fead-signals.js');
global.veFeadSignals = S;
[fead, rapor, wiz].forEach((mod) => {
  Object.keys(mod).forEach((k) => { if (global[k] === undefined) global[k] = mod[k]; });
});
const RS = require('../../js/cp-fead-results.js');
Object.keys(RS).forEach((k) => { if (global[k] === undefined) global[k] = RS[k]; });
const AR = require('../../js/cp-fead-araclar.js');

beforeEach(() => {
  resetStubs(stubs);
  global.veFeadResults = null;
  window.veFeadResults = null;
  global.nodes = [];
  AR._feadAracSifirla();
});

// Örneği tuvale kur — MOTORSUZ (örneğin kendisi). `motor` verilirse testin
// yardımcısı katalog kaydının devir sınırlarını yazar (kullanıcının adımı).
function kur(key, motor) {
  const pack = M.veFeadExampleNodes(key || 'AG00976_GATES_2025');
  global.nodes = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  if (motor) motorTamamla(sv().data);
  return global.nodes;
}
const sv = () => global.nodes.find((n) => n.type === 'fead-solver');
const tip = (t) => global.nodes.find((n) => n.type === t);
const b = () => M.veFeadBuildFromCanvas();
const toasts = () => global.showToast.mock.calls.map((c) => c[0] + ' [' + c[1] + ']');

// ════════════════════════════════════════════════════════════════════════════
describe('köprü — TEK hazırlık kaynağı (build.isletme)', () => {
  test('boş çözücü: motor künyesinin üç alanı, oran ve çevrim ADIYLA eksik', () => {
    const r = M.veFeadIsletmeEksik({ ratioMode: 'derive' }, [], null, []);
    expect(r.ok).toBe(false);
    const g = (x) => r.eksik.filter((e) => e.grup === x).map((e) => e.alan);
    expect(g('motor')).toEqual(['cylinders', 'idleRpm', 'governedRpm']);
    expect(g('oran')).toEqual(['ratioMode']);
    expect(g('cevrim')).toEqual(['duty']);
    // Overspeed İSTENMEZ — yalnız devir sınırı kapısına girer ('wait' verir).
    expect(r.eksik.some((e) => e.alan === 'overspeedRpm')).toBe(false);
  });

  test('governed rölantiden büyük olmalı; tek çaplı ara kademe oranı çözmez', () => {
    const r = M.veFeadIsletmeEksik({ cylinders: 6, idleRpm: 800, governedRpm: 700,
                                    ratioMode: 'derive', crankOD: 197.72 },
                                   [], null, [{ rpm: 880 }]);
    expect(r.eksik.map((e) => e.ad)).toEqual([
      'governed devri (rölantiden büyük olmalı)',
      'tahrik oranı (ara kademede krank ve kademe kasnağı çapı)'
    ]);
  });

  test('Gates örneği: geometri ÇÖZÜLÜR, işletme motorun devirlerini bekler', () => {
    kur();
    const x = b();
    expect(x.ok).toBe(true);                                // kayış yolu çözülüyor
    expect(x.isletme.ok).toBe(false);
    expect(M.veFeadIsletmeMetni(x.isletme)).toBe('Motor künyesi eksik: rölanti devri · governed devri');
    motorTamamla(sv().data);
    expect(b().isletme).toEqual({ ok: true, eksik: [] });
  });

  test('gücü hiçbir kaynaktan gelmeyen aksesuar ADIYLA; avara · gergi · sürücü asla', () => {
    kur(null, true);
    const alt = global.nodes.find((n) => n.type === 'fead-alternator');
    sv().data.duty.forEach((r) => { delete r.kw[alt.id]; });
    const e = b().isletme.eksik;
    expect(e.map((x) => x.grup)).toEqual(['aksesuar']);
    expect(e[0].ad).toBe(alt.customName);
    // KISMİ: yalnız bir devirde yoksa hangi devirde olduğu yazılır (birimsiz —
    // metin hem panelde hem sihirbazda basılıyor).
    kur(null, true);
    const alt2 = global.nodes.find((n) => n.type === 'fead-alternator');
    const r0 = sv().data.duty[0];
    delete r0.kw[alt2.id];
    expect(b().isletme.eksik[0].ad).toBe(alt2.customName + ' (' + veSayi(r0.rpm, 0) + ' devrinde)');
  });

  test('hazırlık geometri çözülmese de yazılır — kurucunun her dönüş yolunda', () => {
    const x = M.veFeadBuildSystem([]);
    expect(x.ok).toBe(false);
    expect(x.isletme && x.isletme.ok).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('üç yüzey AYNI hükmü verir — çözüm · pencere · panel', () => {
  test('Hesapla (çözüm) KOŞMAZ, sonucu yazmaz, sebebi bildirir', () => {
    kur();
    const R = fead.veFeadSolve(sv().id);
    expect(R).toBeNull();
    expect(window.veFeadResults).toBeNull();
    expect(toasts()).toContain('Hesaplanmadı — Motor künyesi eksik: rölanti devri · governed devri [warning]');
  });

  test('FEAD araçları penceresi: Hesapla pasif, sebep altında — motor girilince etkin', () => {
    kur();
    const d = AR.veFeadAraclarDurum();
    expect(d.hazir).toBe(false);
    expect(d.neden).toBe('Motor künyesi eksik: rölanti devri · governed devri — Ayarlar\'dan tamamlayın.');
    const h = AR.veFeadAraclarGovdeHTML(d);
    expect(h).toMatch(/data-ey="hesapla" aria-disabled="true"/);
    motorTamamla(sv().data);
    expect(AR.veFeadAraclarDurum().hazir).toBe(true);
  });

  test('çözücü paneli: Hesapla disabled ve notu AYNI metin', () => {
    kur();
    const h = fead.getFeadSolverPropertiesHTML(sv());
    expect(h).toMatch(/<button type="button" class="ve-fp-solve" disabled/);
    expect(h).toContain('<div class="ve-fp-solve-not">Motor künyesi eksik: rölanti devri · governed devri.</div>');
    motorTamamla(sv().data);
    expect(fead.getFeadSolverPropertiesHTML(sv())).not.toMatch(/class="ve-fp-solve" disabled/);
  });

  test('silindir sayısı 6\'ya DÜŞMEZ — köprü modelin alanını okur, boşsa çözüm yok', () => {
    kur(null, true);
    const x = b(), rows = M.veFeadDutyRows(sv());
    expect(M.veFeadAnalyze(x, { rows }).ok).toBe(true);          // alan dolu: okundu
    delete sv().data.cylinders;
    const R = M.veFeadAnalyze(b(), { rows });
    expect(R.ok).toBe(false);
    expect(R.error).toBe('Motor künyesi eksik: silindir sayısı girilmedi.');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('kanvas kartı — harita yoksa SEBEBİ lejantın yerinde', () => {
  const kart = () => ({ id: 'lay-isl', type: 'fead-layout', def: componentDefs['fead-layout'],
                        width: 440, height: 500, data: { katOn: 'isletme' } });

  test('motor yokken gerilme haritası ÜRETİLMEZ (eskiden 8 açıklıkta "544 N")', () => {
    kur();
    const x = b();
    expect(M.veFeadSpanTensionMap(x, null, 880)).toBeNull();
    motorTamamla(sv().data);
    expect(M.veFeadSpanTensionMap(b(), null, 880)).not.toBeNull();
  });

  test('işletme kartı eksiği yazar, harita ve açıklık sayısı yok; motorla tersi', () => {
    kur();
    let h = fead.veFeadLayoutCardHTML(kart());
    expect(h).toContain('data-ve="isletme-eksik"');
    expect(h).toContain('açıklık gerilmesi hesaplanmadı');
    expect(h).toContain('Motor künyesi eksik: rölanti devri · governed devri');
    expect(h).not.toContain('data-ve="belt-tension"');
    motorTamamla(sv().data);
    h = fead.veFeadLayoutCardHTML(kart());
    expect(h).not.toContain('data-ve="isletme-eksik"');
    expect(h).toContain('data-ve="belt-tension"');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('sessiz varsayılanlar kalktı', () => {
  test('sihirbazın boş durumu silindir sayısı TAŞIMAZ', () => {
    expect(wiz.veFeadWizDefault().solver.cylinders).toBeUndefined();
  });

  test('yer tutucu kullanılmayan bir sayı YAZMAZ — zorunlu alan "zorunlu" der', () => {
    const ph = {};
    wiz.VE_FW_ENG_FIELDS.forEach((f) => { ph[f.yol.replace('solver.', '')] = f.ph; });
    expect([ph.cylinders, ph.idleRpm, ph.governedRpm]).toEqual(['zorunlu', 'zorunlu', 'zorunlu']);
    // Boşken varsayılanla koşan alan o varsayılanı yazar (çekirdeğin 1100'ü).
    expect(Number(ph.accelRpmS)).toBe(TR.VE_FEAD_SCN_ACCEL_DEF);
    expect(Number(ph.decelRpmS)).toBe(TR.VE_FEAD_SCN_ACCEL_DEF);
    // Panel AYNI kuralı taşır.
    const kartH = fead.veFeadEngineCard({ id: 'sv', type: 'fead-solver', data: {} });
    expect((kartH.match(/placeholder="zorunlu"/g) || []).length).toBe(3);
    expect(kartH).not.toMatch(/placeholder="(6|700|2100|2900|0\.70|1000)"/);
  });

  test('senaryo rölanti/tepe/silindiri UYDURMAZ — motor yoksa kurulmaz', () => {
    kur();
    expect(TR.veFeadScenarioBuild(b())).toBeNull();
    motorTamamla(sv().data);
    const scn = TR.veFeadScenarioBuild(b());
    expect(scn).not.toBeNull();
    expect([scn.idle, scn.cyl]).toEqual([700, 6]);                 // katalog kaydının kendisi
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('senaryonun yükü KARARLI ÇÖZÜMÜN kaynağından', () => {
  // ÖLÇÜLDÜ (eski kod, AG00976 @ 880 d/dk): senaryo 0 kW, kararlı çözüm 6,34 kW.
  // Gates örneklerinin gücü YALNIZ kayıtlı ölçümde yazılı; senaryo onu hiç
  // okumuyordu ve kayış aksesuarsızmış gibi gerilmeyi düz çiziyordu.
  test('çevrimin her devrinde senaryo yükü = kararlı çözümün yükü', () => {
    kur(null, true);
    const x = b(), idle = TR.veFeadScnInputs(x).idleRpm;
    const top = (o) => Object.keys(o).reduce((a, k) => a + o[k], 0);
    let say = 0;
    M.veFeadDutyToCore(x, M.veFeadDutyRows(sv())).forEach((r) => {
      if (!(r.engineRpm >= idle)) return;
      say++;
      expect(top(TR.veFeadScnLoadsAt(x, r.engineRpm, idle))).toBeCloseTo(top(r.loadsKw), 9);
    });
    expect(say).toBeGreaterThan(2);
    // İki devir ARASI doğrusal — uçların dışı sabit (eksi güç üretilmez).
    const alt = x.order.findIndex((n) => n.type === 'fead-alternator');
    const pts = M.veFeadDutyRows(sv()).map((r) => r.rpm).sort((a, c) => a - c);
    const ust = M.veFeadKwAt(x, alt, x.order[alt], pts[pts.length - 1] * 3);
    expect(ust).toBeCloseTo(M.veFeadKwAt(x, alt, x.order[alt], pts[pts.length - 1]), 12);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('kayma emniyeti yüksüz kasnaktan HÜKÜM VERMEZ', () => {
  // Yedek eskiden "yük taşıyan yoksa bütün kasnaklar"dı: gücü sıfır bir modelde
  // gergi kasnağının capstan KAPASİTESİ (1,24) emniyet diye basılıyordu.
  const yuksuz = () => {
    kur(null, true);
    const R = fead.veFeadSolve(sv().id);
    R.analysis.duty.forEach((d) => (d.slip || []).forEach((s) => { s.tensionRatio = 1.001; }));
    return R;
  };
  test('özet kartı "wait" ve sayısız, rapor ölçütü "—", pencere hükmü YOK', () => {
    const R = yuksuz();
    const k = S.summary(R).find((x) => x.k === 'kayma');
    expect([k.durum, k.deger]).toEqual(['wait', '—']);
    expect(rapor._frMinSF(R)).toBeNaN();
    expect(fead.veFeadResultVerdicts(R)).not.toMatch(/GEÇTİ|KALDI/);
  });
  test('yük taşıyan kasnak varken hüküm yine YÜK TAŞIYANLARDAN', () => {
    kur(null, true);
    const R = fead.veFeadSolve(sv().id);
    const k = S.summary(R).find((x) => x.k === 'kayma');
    expect(k.durum).toBe('ok');
    expect(rapor._frMinSF(R)).toBeCloseTo(rapor._frSlipStats(R).loadedMin, 12);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('devir sınırı kapısı — eksik motor devri "uygun" SAYILMAZ', () => {
  const kapi = (sd) => CK.veFeadCheckSpeedLimit(b(), CK.veFeadCheckOpt(sd, M.veFeadDutyRows(sv())));
  test('overspeed yokken anlık sınır denetlenmedi: "wait" ve sebep', () => {
    kur(null, true);
    const sd = Object.assign({}, sv().data);
    expect(kapi(sd).durum).toBe('ok');                        // üç nokta da bilinir
    delete sd.overspeedRpm;
    const r = kapi(sd);
    expect(r.durum).toBe('wait');
    expect(r.note).toMatch(/overspeed devri girilmedi/);
  });
  test('bilinen bir İHLAL eksik veriyle örtülmez — yine "no"', () => {
    kur(null, true);
    const sd = Object.assign({}, sv().data, { governedRpm: 9000 });
    delete sd.overspeedRpm;
    expect(kapi(sd).durum).toBe('no');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('sihirbaz — "kurulmaya hazır" yalnız işletme girdisi de tamsa', () => {
  const kabuk = () => {
    document.body.innerHTML = '<div id="ve-canvas"></div>'
      + '<div id="ve-feadwiz-overlay" style="display:none;">'
      + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>'
      + '<div id="ve-fw-ang" style="display:none;"></div>';
  };
  test('örnek: 5. adım eksiği adıyla, alt bilgi BEKLİYOR; motorla hazır', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    let x = wiz.veFeadWizBuild();
    expect(wiz.veFeadWizIssues(x, 4)).toEqual([
      { tur: 'err', m: 'Motor künyesi eksik: rölanti devri · governed devri.' }]);
    let alt = wiz.veFeadWizFootHTML(x).replace(/<[^>]+>/g, '');
    expect(alt).toContain('kayış yolu çözülüyor — işletme hesabı bekliyor: motor künyesi eksik');
    expect(alt).not.toContain('kurulmaya hazır');
    motorTamamla(wiz.veFeadWizState().solver);
    x = wiz.veFeadWizBuild();
    expect(wiz.veFeadWizIssues(x, 4)).toEqual([]);
    alt = wiz.veFeadWizFootHTML(x).replace(/<[^>]+>/g, '');
    expect(alt).toContain('kurulmaya hazır');
  });
  test('çözülemeyen oran "elle girildi" DEMEZ', () => {
    expect(M.veFeadDriveModeLabel('direct', false)).toBe('çözülemedi — çap eksik');
    kabuk(); wiz.veFeadWizReset();
    const h = wiz.veFeadWizStepHTML(4, wiz.veFeadWizBuild());
    expect(h).toContain('çözülemedi — çap eksik');
    expect(h).not.toContain('elle girildi');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('motor kataloğu AÇIKÇA SEÇİLMİŞ tahrik düzenini ezmez', () => {
  // Motor künyesi zorunlu olunca örneği tamamlamak için motor seçen kullanıcı,
  // kataloğun kademe çaplarıyla bütün devirleri sessizce kaydırırdı
  // (57RS303234: 218,3 / 179,62 = 1,215 → %21,5).
  test('doğrudan tahrikli örnek doğrudan kalır; seçilmemiş düzen türetmeye geçer', () => {
    const sd = { ratioMode: 'direct', driveRatio: 1 };
    EN.veFeadEngineApply(sd, '57RS303234');
    expect(sd.ratioMode).toBe('direct');
    expect(M.veFeadDriveRatio(sd).ratio).toBe(1);
    const bos = {};
    EN.veFeadEngineApply(bos, '57RS303234');
    expect(bos.ratioMode).toBe('derive');
    expect(M.veFeadDriveRatio(bos).ratio).toBeCloseTo(218.3 / 179.62, 12);
    // Çapları olan ara kademe: katalog çapları geçerli (öneri; sapma yazılır).
    const kademe = { ratioMode: 'derive', crankOD: 200, fanOD: 180 };
    EN.veFeadEngineApply(kademe, '57RS303234');
    expect(M.veFeadDriveRatio(kademe).ratio).toBeCloseTo(218.3 / 179.62, 12);
    expect(MOTOR).toBe('57RS303252');
  });

  // Karar kipin ADINA değil ETKİN orana bakar. Sihirbaz örneğin `direct` 1'ini
  // `derive` kipine çeviriyor ama sayıyı taşıyor; motor seçimi o modelde oranı
  // 1 → 1,1008'e kaydırıyordu (ölçüldü, gerçek tarayıcı, 57RS303252).
  test('sihirbazdan kurulan örnek (derive + taşınan oran): motor seçimi oranı DEĞİŞTİRMEZ', () => {
    const sd = { ratioMode: 'derive', driveRatio: 1 };
    expect(M.veFeadDriveRatio(sd)).toMatchObject({ ok: true, ratio: 1 });
    EN.veFeadEngineApply(sd, MOTOR);
    expect(M.veFeadDriveRatio(sd).ratio).toBe(1);
    expect([sd.crankOD, sd.fanOD]).toEqual([197.72, 179.62]);   // motor verisi yazıldı
    ['unity', 'crankDirect'].forEach((k) => {
      const x = { ratioMode: k };
      EN.veFeadEngineApply(x, MOTOR);
      expect([x.ratioMode, M.veFeadDriveRatio(x).ratio]).toEqual([k, 1]);
    });
  });
});
