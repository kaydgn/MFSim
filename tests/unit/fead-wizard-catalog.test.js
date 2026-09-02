/**
 * fead-wizard-catalog.test.js — SİHİRBAZDA BMC KATALOGLARI VE ÜÇ KAPI
 *
 * Kataloglar ve kapılar önce panele girdi (`fead-catalogs` / `fead-checks`
 * testleri); bu dosya onların SİHİRBAZ tarafını tutuyor ve asıl kilitlediği
 * şey bir TAŞIMA:
 *
 *   sihirbaz durumu → veFeadWizNodes → kurulan düğüm
 *
 * Taşınmayan bir alan bu modülün belgelenmiş sessiz sınıfını üretir: kullanıcı
 * sihirbazda künyeyi seçer, 7. adımda kapılar hüküm verir, "Modeli Kur"a basar
 * ve kanvasta AYNI kapılar "değerlendirilemedi" der. Ne hata çıkar ne uyarı —
 * yalnız iki yüzey ayrışır. `accPreset`in taşınması aynı gerekçeyle test
 * edilmişti; bu dosya listeyi altı alana genişletiyor.
 *
 * İKİNCİ KURAL: sihirbaz kendi uygulama mantığını YAZMIYOR. `veFeadEngineApply`
 * ve `veFeadAccApply` çağrılıyor, yani "katalogda null olan alana dokunma" ve
 * "boş eğri yazma" kuralları tek yerde duruyor. Aşağıdaki iki test bunu
 * doğrudan ölçüyor.
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const E = require('../../js/fead-engines.js');
const A = require('../../js/fead-accessories.js');
const K = require('../../js/fead-checks.js');
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
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
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });

const WIZ_SRC = fs.readFileSync(path.join(__dirname, '../../js/cp-fead-wizard.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

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
// BMC tedarikçi sayfasının düzeni — kapıların gerçek bir model üstünde
// koşabilmesi için. Örnek kurucusu ve sihirbaz AYNI düğüm listesini üretiyor
// (fead-wizard.test.js'teki eşitlik kapısı), yani buradaki çözüm kanvastakiyle
// birebir aynı.
const bmcKur = () => { kabuk(); wiz.veFeadWizReset(); wiz.veFeadWizSeed('BMC_FEAD_2026'); };
const altSatiri = () => wiz.veFeadWizState().pulleys
  .filter((p) => p.type === 'fead-alternator')[0];
const acSatiri = () => wiz.veFeadWizState().pulleys.filter((p) => p.type === 'fead-ac')[0];

// ══════════════════════════════════════════════ MOTOR KATALOĞU (6. ADIM) ══
describe('Sihirbaz — BMC motor kataloğu', () => {
  test('uygulama panelin fonksiyonunu ÇAĞIRIYOR, kendi kuralını yazmıyor', () => {
    expect(WIZ_SRC).toContain('veFeadEngineApply(s, key)');
    expect(WIZ_SRC).toContain('veFeadAccApply({ data: p }, libKey)');
  });

  test('seçim silindiri, dört devri ve birinci kademe çaplarını yazar', () => {
    bmcKur();
    wiz.veFeadWizEngineLib('57RS303234');
    const s = wiz.veFeadWizState().solver;
    expect(s.engineLib).toBe('57RS303234');
    expect(s.cylinders).toBe(6);
    expect(s.idleRpm).toBe(700);
    expect(s.governedRpm).toBe(2100);
    expect(s.noLoadGovernedRpm).toBe(2330);
    expect(s.overspeedRpm).toBe(2900);
    expect(s.crankOD).toBe(218.3);
    expect(s.fanOD).toBe(179.62);
    expect(s.ratioMode).toBe('derive');
  });

  test('boş seçim yalnız BAĞI çözer, alanları silmez', () => {
    bmcKur();
    wiz.veFeadWizEngineLib('57RS303234');
    wiz.veFeadWizEngineLib('');
    const s = wiz.veFeadWizState().solver;
    expect(s.engineLib).toBeUndefined();
    expect(s.governedRpm).toBe(2100);
    expect(s.crankOD).toBe(218.3);
  });

  test('bilinmeyen anahtar hiçbir şey yazmaz', () => {
    bmcKur();
    const once = JSON.stringify(wiz.veFeadWizState().solver);
    wiz.veFeadWizEngineLib('YOK');
    expect(JSON.stringify(wiz.veFeadWizState().solver)).toBe(once);
  });

  test('satır katalogdan sapmayı ADIYLA yazar', () => {
    bmcKur();
    wiz.veFeadWizEngineLib('57RS303234');
    const s = wiz.veFeadWizState().solver;
    expect(wiz._fwEngineLibRow(s)).toContain('birebir');
    s.governedRpm = 2200;
    const h = wiz._fwEngineLibRow(s);
    expect(h).toContain('Katalogdan sapıldı');
    expect(h).toMatch(/governed/);
  });

  test('katalog yüklü değilse satır SESSİZ kalmıyor', () => {
    const yedek = global.veFeadEngineList;
    delete global.veFeadEngineList;
    expect(wiz._fwEngineLibRow({})).toContain('fead-engines.js');
    global.veFeadEngineList = yedek;
  });
});

// ═════════════════════════════════════════ AKSESUAR KÜNYESİ (6. ADIM) ══
describe('Sihirbaz — BMC aksesuar künyesi ve devir sınırları', () => {
  test('künye üç sınırı ve devir→kW eğrisini satıra yazar', () => {
    bmcKur();
    const p = altSatiri();
    wiz.veFeadWizAccLib(p.key, '57RS309348');
    expect(p.accLib).toBe('57RS309348');
    expect(p.optimumRpm).toBe(6000);
    expect(p.maxContRpm).toBe(8000);
    expect(p.maxPeakRpm).toBe(12000);
    expect(p.pwrCurve.length).toBe(16);
  });

  // BOŞ EĞRİ YAZILMAZ — kural katalogda, sihirbaz onu miras alıyor.
  test('defterde eğrisi olmayan künye kullanıcının tablosunu SİLMEZ', () => {
    bmcKur();
    const p = altSatiri();
    const kendi = [{ rpm: 2000, kw: 3.1 }];
    p.pwrCurve = kendi;
    wiz.veFeadWizAccLib(p.key, '57RS309791');       // Prestolite 120A — eğrisi yok
    expect(p.pwrCurve).toBe(kendi);
    expect(p.maxContRpm).toBe(9000);                // sınırlar yine geldi
  });

  test('bağı çözmek alanları bırakır', () => {
    bmcKur();
    const p = altSatiri();
    wiz.veFeadWizAccLib(p.key, '57RS309348');
    wiz.veFeadWizAccLib(p.key, '');
    expect(p.accLib).toBeUndefined();
    expect(p.maxContRpm).toBe(8000);
  });

  test('elle girilen sınır katalogtan üstün, kaynak "elle" okunur', () => {
    bmcKur();
    const p = altSatiri();
    wiz.veFeadWizAccLib(p.key, '57RS309348');
    expect(A.veFeadAccLimits(p).maxCont).toEqual({ rpm: 8000, kaynak: 'katalog' });
    p.maxContRpm = 7500;
    expect(A.veFeadAccLimits(p).maxCont).toEqual({ rpm: 7500, kaynak: 'elle' });
  });

  test('kart: künye OKUNUR (seçim yukarıda), sınır alanları hepsinde', () => {
    // İKİNCİ SEÇİCİ KALKTI (kullanıcı, 2026-09-01): aynı aksesuarın modeli iki
    // ayrı kartta seçilebiliyordu. Seçim artık YALNIZ "Aksesuar Modelleri"
    // kartında; burası onun okuması.
    bmcKur();
    const yuk = wiz.veFeadWizState().pulleys.filter((p) => !p.driver);
    const h = wiz._fwAccLimitCard(wiz.veFeadWizState(), yuk);
    expect(h).not.toContain('veFeadWizAccLib');
    expect(h).not.toContain('<select');
    expect(h).toContain('maxContRpm');
    // Avara kasnak yük taşımaz — satırı olmamalı.
    expect(h).not.toMatch(/Avara/);
    // Seçim yapılınca künye BURADA görünüyor.
    const alt = wiz.veFeadWizState().pulleys.find((p) => p.type === 'fead-alternator');
    const k = A.veFeadAccList('fead-alternator')[0].key;
    wiz.veFeadWizAccModel(alt.key, 'bmc:' + k);
    expect(wiz._fwAccLimitCard(wiz.veFeadWizState(),
      wiz.veFeadWizState().pulleys.filter((p) => !p.driver))).toContain(k);
    // Defterde OLMAYAN bir tipte sınır alanı yine var.
    wiz.veFeadWizPulleyAdd('fead-waterpump');
    const yuk2 = wiz.veFeadWizState().pulleys.filter((p) => !p.driver);
    const h2 = wiz._fwAccLimitCard(wiz.veFeadWizState(), yuk2);
    expect((h2.match(/maxContRpm/g) || []).length).toBeGreaterThan(2);
  });

  test('sınırı olmayan aksesuar kartta ADIYLA uyarılıyor', () => {
    bmcKur();
    const yuk = wiz.veFeadWizState().pulleys.filter((p) => !p.driver);
    const h = wiz._fwAccLimitCard(wiz.veFeadWizState(), yuk);
    expect(h).toContain('değerlendirilemedi');
    expect(h).toContain('uygun sayılmaz');
  });
});

// ═══════════════════════════════════════ DURUM → DÜĞÜM TAŞIMASI ══
describe('veFeadWizNodes — altı yeni alan taşınıyor', () => {
  test('kasnakta accLib ve üç sınır', () => {
    bmcKur();
    const p = altSatiri();
    wiz.veFeadWizAccLib(p.key, '57RS309348');
    const pack = wiz.veFeadWizNodes();
    const n = pack.nodes.filter((x) => x.id === 'wz-' + p.key)[0];
    expect(n.data.accLib).toBe('57RS309348');
    expect(n.data.accLibVer).toBe(A.VE_FEAD_ACC_LIB_VERSION);
    expect(n.data.optimumRpm).toBe(6000);
    expect(n.data.maxContRpm).toBe(8000);
    expect(n.data.maxPeakRpm).toBe(12000);
  });

  test('elle girilen sınır de taşınıyor (künye olmadan)', () => {
    bmcKur();
    const p = altSatiri();
    wiz.veFeadWizPulleySet(p.key, 'maxContRpm', '7200');
    const n = wiz.veFeadWizNodes().nodes.filter((x) => x.id === 'wz-' + p.key)[0];
    expect(n.data.maxContRpm).toBe(7200);
    expect(n.data.accLib).toBeUndefined();
  });

  test('çözücüde engineLib ve dört motor devri', () => {
    bmcKur();
    wiz.veFeadWizEngineLib('57RS303234');
    const sd = wiz.veFeadWizNodes().nodes.filter((x) => x.id === 'wz-solver')[0].data;
    expect(sd.engineLib).toBe('57RS303234');
    expect(sd.engineLibVer).toBe(E.VE_FEAD_ENGINE_LIB_VERSION);
    expect(sd.idleRpm).toBe(700);
    expect(sd.governedRpm).toBe(2100);
    expect(sd.noLoadGovernedRpm).toBe(2330);
    expect(sd.overspeedRpm).toBe(2900);
  });

  test('boş alan taşınmaz — 0 yazılmıyor', () => {
    bmcKur();
    const sd = wiz.veFeadWizNodes().nodes.filter((x) => x.id === 'wz-solver')[0].data;
    expect(sd.governedRpm).toBeUndefined();
    expect(sd.overspeedRpm).toBeUndefined();
    const n = wiz.veFeadWizNodes().nodes.filter((x) => x.id === 'wz-' + altSatiri().key)[0];
    expect(n.data.maxContRpm).toBeUndefined();
  });
});

// ═══════════════════════════════════ ÜÇ KAPI ÖZET ADIMINDA ══
describe('Sihirbaz — 7. adımın uygunluk kapıları', () => {
  // Sihirbazın kurduğu build köprünün kendi biçiminde; kapılar panelde
  // olduğu gibi doğrudan onun üstünde koşuyor.
  const kapilar = () => {
    const b = wiz.veFeadWizBuild();
    const s = wiz.veFeadWizState().solver;
    return { b, R: K.veFeadChecks(b, K.veFeadCheckOpt(s, s.duty || [])) };
  };

  test('künye ve motor verilmeden üç kapı da "wait" — uygun SAYILMIYOR', () => {
    bmcKur();
    const { b, R } = kapilar();
    expect(b.ok).toBe(true);
    // Merkez mesafesi geometriden çözülüyor, künye istemiyor.
    expect(['ok', 'warn']).toContain(R.centerDistance.durum);
    expect(R.ratioWindow.durum).toBe('wait');
    expect(R.speedLimit.durum).toBe('wait');
    expect(R.ratioWindow.ok).toBeNull();
  });

  test('motor + iki künye verilince kapılar hüküm veriyor', () => {
    bmcKur();
    wiz.veFeadWizEngineLib('57RS303234');
    wiz.veFeadWizAccLib(altSatiri().key, '57RS309348');
    wiz.veFeadWizAccLib(acSatiri().key, '57RS322530');
    const { R } = kapilar();
    expect(R.centerDistance.rows.length).toBe(6);
    expect(R.ratioWindow.rows.length).toBe(2);
    expect(R.ratioWindow.governedRpm).toBe(2100);
    expect(R.ratioWindow.durum).toBe('ok');
    // BMC örneğinin çevrimi 2750 d/dk'ya çıkıyor ve orada alternatör kendi
    // SÜREKLİ sınırının üstünde dönüyor — kapı bunu söylüyor.
    expect(R.speedLimit.durum).toBe('no');
  });

  // TAŞIMA KAPISININ ASIL ÖLÇÜMÜ: sihirbazın gördüğü hüküm, kurulan modelin
  // hükmüyle AYNI olmak zorunda. Alanlardan biri taşınmasaydı burası ayrışırdı.
  test('sihirbazın hükmü ile KURULAN modelin hükmü birebir', () => {
    bmcKur();
    wiz.veFeadWizEngineLib('57RS303234');
    wiz.veFeadWizAccLib(altSatiri().key, '57RS309348');
    wiz.veFeadWizAccLib(acSatiri().key, '57RS322530');
    const sihirbaz = kapilar().R;

    // Kurulan modelin yolu: aynı düğüm listesi köprüden geçiyor.
    const pack = wiz.veFeadWizNodes();
    const kurulan = M.veFeadBuildSystem(pack.nodes, pack.connections);
    const sd = pack.nodes.filter((n) => n.id === 'wz-solver')[0].data;
    const R2 = K.veFeadChecks(kurulan, K.veFeadCheckOpt(sd, sd.duty || []));

    expect(R2.centerDistance.durum).toBe(sihirbaz.centerDistance.durum);
    expect(R2.ratioWindow.durum).toBe(sihirbaz.ratioWindow.durum);
    expect(R2.speedLimit.durum).toBe(sihirbaz.speedLimit.durum);
    expect(R2.ratioWindow.rows.map((r) => Math.round(r.accRpm)))
      .toEqual(sihirbaz.ratioWindow.rows.map((r) => Math.round(r.accRpm)));
    expect(R2.centerDistance.rows.map((r) => r.a.toFixed(6)))
      .toEqual(sihirbaz.centerDistance.rows.map((r) => r.a.toFixed(6)));
  });

  test('kart üç kapıyı da basıyor ve durumu öznitelikte taşıyor', () => {
    bmcKur();
    wiz.veFeadWizEngineLib('57RS303234');
    wiz.veFeadWizAccLib(altSatiri().key, '57RS309348');
    wiz.veFeadWizAccLib(acSatiri().key, '57RS322530');
    const h = wiz._fwChecksCard(wiz.veFeadWizBuild());
    expect(h).toContain('data-ve-fw-checks');
    expect(h).toContain('Kasnak merkez mesafesi');
    expect(h).toContain('Çevrim oranı penceresi');
    expect(h).toContain('Aksesuar devir sınırı');
    expect(h).toMatch(/data-ve-fw-checks-durum="[a-z]+\/[a-z]+\/[a-z]+"/);
    // Üç kapı, üç tablo.
    expect((h.match(/<table/g) || []).length).toBe(3);
  });

  test('çözülemeyen modelde kart PATLAMIYOR, "değerlendirilemedi" diyor', () => {
    kabuk();
    wiz.veFeadWizReset();
    const h = wiz._fwChecksCard(wiz.veFeadWizBuild());
    expect(h).toContain('değerlendirilemedi');
    expect(h).not.toContain('undefined');
    expect(h).not.toContain('NaN');
  });

  test('kapılar yüklü değilse kart SESSİZ kalmıyor', () => {
    const yedek = global.veFeadChecks;
    delete global.veFeadChecks;
    expect(wiz._fwChecksCard(null)).toContain('fead-checks.js');
    global.veFeadChecks = yedek;
  });
});

// ═════════════════════════════════════════════════ YÜZEY SÖZLEŞMESİ ══
describe('Yüzey', () => {
  test('üçüncü durum rengi CSS\'te tanımlı — sınıf adı sessizce ölmesin', () => {
    expect(CSS).toContain('.ve-fw-warn{');
    expect(CSS).toContain('.ve-fw-gate-h{');
  });

  test('6. adım motor kataloğunu ve sınır kartını çağırıyor', () => {
    expect(WIZ_SRC).toContain('_fwEngineLibRow(s)');
    expect(WIZ_SRC).toContain('_fwAccLimitCard(st, yuk)');
  });

  test('7. adım kapı kartını çağırıyor', () => {
    expect(WIZ_SRC).toContain('_fwChecksCard(b)');
  });

  // Kapılar sihirbazda da TEK ÇAĞRIDAN: ikinci bir hesap iki yüzeyin sessizce
  // ayrışması demekti (modülün tekrar eden kuralı).
  test('sihirbaz kapıları YENİDEN HESAPLAMIYOR', () => {
    expect(WIZ_SRC).toContain('veFeadChecks(b, veFeadCheckOpt(');
    expect(WIZ_SRC).not.toContain('veFeadCheckCenterDistance(');
    expect(WIZ_SRC).not.toContain('veFeadCheckRatioWindow(');
    expect(WIZ_SRC).not.toContain('veFeadCheckSpeedLimit(');
  });
});
