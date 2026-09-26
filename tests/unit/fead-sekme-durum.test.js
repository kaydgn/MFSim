/**
 * fead-sekme-durum.test.js — DURUMLU SEKMELER (FEAD pencereleri)
 *
 * Kullanıcı isteği (2026-09-26, ekran görüntüsüyle): *"kullanıcı bu kısmı
 * görmeyebilir ve eksik bilgi girebilir. Bu kısmın daha görünür olmasını
 * istiyorum."* Tasarım tezgâhından **B · Durumlu Sekmeler** seçildi: her
 * sekme adının altında bir durum satırı, eksik varsa şeridin altında sonucu
 * ve oraya giden bağlantıyı yazan bir bant.
 *
 * Bu dosyanın asıl kapısı ANLAŞMA. Sekme durumu köprünün yüklemlerinden
 * okunuyor ama yine de ayrı bir yerde yazılı — köprüye yeni bir zorunlu alan
 * eklenir de buraya eklenmezse sekme "tamam" der, model çözülmez, ve bu
 * SESSİZDİR. Bu yüzden her zorunlu alan GERÇEK bir modelde (AG00976) tek tek
 * boşaltılıyor ve iki taraf birlikte ölçülüyor: köprü hatasını/uyarısını
 * veriyor MU, sekme 'eksik' diyor MU. Biri olup öteki olmazsa kırmızı.
 *
 * Kurallar (cp-fead.js → veFeadSekmeDurumlari):
 *   ok · eksik (boşluğun bir SONUCU var) · bos (isteğe bağlı) · yok (hiçbir
 *   hesap okumuyor — sürücünün devir sınırı ve güç eğrisi)
 */
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

const M = require('../../js/fead-model.js');
Object.keys(M).forEach((k) => { if (global[k] === undefined) global[k] = M[k]; });
// Çekirdek `global.FEADCore` olarak yazılır — köprü onu global'den arıyor.
global.FEADCore = require('../../js/fead-core.js');
[require('../../js/fead-accessories.js'), require('../../js/fead-tensioners.js'),
 require('../../js/fead-engines.js'), require('../../js/fead-checks.js')]
  .forEach((m) => Object.keys(m).forEach((k) => { if (global[k] === undefined) global[k] = m[k]; }));
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });

const SRC = fs.readFileSync(path.join(__dirname, '../../js/cp-fead.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

// Gerçek, çözülen örnek — her testte TAZE kopya.
function ornek() {
  const pack = veFeadExampleNodes('AG00976_GATES_2025');
  global.nodes = pack.nodes.map((n) => ({
    id: n.id, type: n.type, def: componentDefs[n.type],
    customName: n.customName, data: JSON.parse(JSON.stringify(n.data)) }));
  return global.nodes;
}
const dugum = (id) => global.nodes.filter((n) => n.id === id)[0];
const durum = (id) => veFeadSekmeDurumlari(dugum(id));
const kopru = () => veFeadBuildFromCanvas();
const mesajlar = (b) => (b.errors || []).concat(b.warnings || []).join('\n');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  delete global.veFeadResults;
  if (typeof window !== 'undefined') delete window.veFeadResults;
  document.body.innerHTML = '<div id="ve-canvas"></div>';
});

// ═══════════════════════════════════════════════════════════════════════════
describe('ANLAŞMA — sekme "eksik" der ⇔ köprü şikâyet eder', () => {
  test('dokunulmamış örnek: köprü temiz, zorunlu alanlı hiçbir sekme eksik değil', () => {
    ornek();
    const b = kopru();
    expect(b.ok).toBe(true);
    const bak = [['ex-A_C', ['geo', 'rol']], ['ex-IDR1', ['geo', 'rol']], ['ex-FAN', ['geo', 'rol']],
                 ['ex-TEN', ['geo', 'kol', 'yay']], ['ex-belt', ['pro', 'boy', 'mal']]];
    bak.forEach(([id, ks]) => {
      const D = durum(id);
      ks.forEach((k) => expect({ id, k, d: D[k].d }).toEqual({ id, k, d: 'ok' }));
    });
  });

  // [düğüm, alan, sekme, köprünün sözü]
  const VAKALAR = [
    ['ex-A_C',  'x',          'geo', /konumu \(X \/ Y\) girilmedi/],
    ['ex-A_C',  'y',          'geo', /konumu \(X \/ Y\) girilmedi/],
    ['ex-A_C',  'od',         'geo', /dış çapı girilmedi/],
    ['ex-IDR1', 'x',          'geo', /konumu \(X \/ Y\) girilmedi/],
    ['ex-IDR1', 'od',         'geo', /dış çapı girilmedi/],
    ['ex-TEN',  'cenX',       'geo', /merkez koordinatı \(X \/ Y\)/],
    ['ex-TEN',  'cenY',       'geo', /merkez koordinatı \(X \/ Y\)/],
    ['ex-TEN',  'od',         'geo', /dış çapı girilmedi/],
    ['ex-TEN',  'armLen',     'kol', /kol boyu girilmedi/],
    ['ex-TEN',  'armMeanDeg', 'kol', /çalışma açısı/],
    ['ex-TEN',  'preload',    'yay', /ön yük momenti girilmedi/],
    ['ex-TEN',  'kArm',       'yay', /yay katsayısı/],
    ['ex-TEN',  'meanLoad',   'yay', /Spring Mean Load/],
    ['ex-belt', 'ribs',       'pro', /kanal \(kaburga\) sayısı/],
  ];
  VAKALAR.forEach(([id, alan, k, soz]) => {
    test(id + '.' + alan + ' boşalınca: köprü "' + soz.source.slice(0, 26) + '…" DER ve ' + k + ' eksik', () => {
      ornek();
      delete dugum(id).data[alan];
      expect(mesajlar(kopru())).toMatch(soz);                 // köprünün tarafı
      const D = durum(id);
      expect(D[k].d).toBe('eksik');                            // sekmenin tarafı
      expect(D[k].neden).toBeTruthy();                         // sonucu YAZILI
    });
  });

  test('yay katsayısı 0: köprü reddeder (çalışma momenti türetilemez), sekme de', () => {
    ornek();
    dugum('ex-TEN').data.kArm = 0;
    expect(kopru().ok).toBe(false);
    expect(durum('ex-TEN').yay.d).toBe('eksik');
  });

  test('kayış boyu: gergi varken kip KİLİTLİ serbest — boş boy HATA DEĞİL, sekme de tamam', () => {
    ornek();
    Object.assign(dugum('ex-belt').data, { lengthMode: 'fixed' });
    delete dugum('ex-belt').data.effLength;
    expect(mesajlar(kopru())).not.toMatch(/efektif boyu girilmedi/);
    expect(durum('ex-belt').boy).toEqual(expect.objectContaining({ d: 'ok', yazi: 'tasarımdan' }));
  });

  test('kayış boyu: gergisiz modelde sabit kip + boş boy → köprü HATA, sekme eksik', () => {
    ornek();
    global.nodes = global.nodes.filter((n) => n.id !== 'ex-TEN');
    Object.assign(dugum('ex-belt').data, { lengthMode: 'fixed' });
    delete dugum('ex-belt').data.effLength;
    expect(mesajlar(kopru())).toMatch(/efektif boyu girilmedi/);
    expect(durum('ex-belt').boy.d).toBe('eksik');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('DEVİR SINIRLARI — sayım KAPININ gördüğüyle aynı', () => {
  test('sınırı olmayan aksesuar 0/3 eksik; sınırı olan tamam — kapı da ikincisini görüyor', () => {
    ornek();
    expect(durum('ex-A_C').dev).toEqual(expect.objectContaining({ d: 'eksik', yazi: '0/3 girildi' }));
    expect(durum('ex-A_C').dev.neden).toMatch(/değerlendirilemiyor/);
    expect(durum('ex-ALT').dev).toEqual(expect.objectContaining({ d: 'ok' }));
    // Kapının kendisi: devir sınırı satırlarında alternatör VAR, klima YOK.
    const b = kopru();
    const sn = b.solver;
    const K = veFeadChecks(b, veFeadCheckOpt(sn.data, veFeadDutyRows(sn)));
    const adlar = (K.speedLimit.rows || []).map((r) => r.ad);
    expect(adlar.some((a) => /Alternatör/.test(a))).toBe(true);
    expect(adlar.some((a) => /Klima/.test(a))).toBe(false);
  });

  test('KATALOGTAN GELEN SINIR DOLU SAYILIR — ham alanlar boşken de', () => {
    // Yalnız `data.optimumRpm`a bakan bir sayım, katalog seçmiş kullanıcıya
    // "0/3" derdi; oysa kapı sınırı katalogtan okuyor (veFeadAccLimits).
    ornek();
    const kayit = veFeadAccList('ac')[0];
    const c = dugum('ex-A_C');
    c.data.accLib = kayit.key;
    ['optimumRpm', 'maxContRpm', 'maxPeakRpm'].forEach((k) => delete c.data[k]);
    expect(durum('ex-A_C').dev.d).toBe('ok');
  });

  test('kısmi giriş: n/3 ve kaç sınırın boş olduğu yazıyor', () => {
    ornek();
    dugum('ex-A_C').data.maxContRpm = 7000;
    const D = durum('ex-A_C').dev;
    expect(D).toEqual(expect.objectContaining({ d: 'eksik', yazi: '1/3 girildi' }));
    expect(D.neden).toMatch(/^2 sınır boş/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('SÜRÜCÜ — iki sekme hiçbir hesaba girmiyor', () => {
  test('açık işaretli sürücü: devir sınırı ve güç eğrisi "kullanılmaz"', () => {
    ornek();
    const D = durum('ex-FAN');
    expect(D.dev).toEqual({ d: 'yok', yazi: 'kullanılmaz' });
    expect(D.egr).toEqual({ d: 'yok', yazi: 'kullanılmaz' });
  });

  test('işaret yokken KÖPRÜNÜN seçtiği sürücü — yalnız data.driver\'a bakmak yetmez', () => {
    ornek();
    delete dugum('ex-FAN').data.driver;
    const b = kopru();
    const i = b.order.findIndex((n) => n.id === 'ex-FAN');
    expect(b.sys.pulleys[i].crank).toBe(true);                 // köprü onu sürücü sayıyor
    expect(durum('ex-FAN').dev.d).toBe('yok');                 // sekme de
  });

  test('sürücülük ROL: işaret başka kasnağa geçince sekmeler geri gelir', () => {
    ornek();
    delete dugum('ex-FAN').data.driver;
    dugum('ex-ALT').data.driver = true;
    expect(durum('ex-FAN').dev.d).not.toBe('yok');
    expect(durum('ex-ALT').dev.d).toBe('yok');
  });

  test('sürücünün iki sekmesi ALAN SORMAZ (kural 25) — sebebini yazar', () => {
    ornek();
    const kap = document.createElement('div');
    kap.innerHTML = getFeadPulleyPropertiesHTML(dugum('ex-FAN'));
    ['dev', 'egr'].forEach((k) => {
      const pn = kap.querySelector('[id^="ve-fp-panes-"] > [data-k="' + k + '"]');
      expect(pn.querySelectorAll('input, select, textarea').length).toBe(0);
      expect(pn.textContent).toMatch(/hiçbir hesaba girmiyor/);
    });
    // Aksesuarda aynı sekmeler alanlarını soruyor.
    kap.innerHTML = getFeadPulleyPropertiesHTML(dugum('ex-A_C'));
    expect(kap.querySelector('[id^="ve-fp-panes-"] > [data-k="dev"]')
      .querySelectorAll('input').length).toBeGreaterThanOrEqual(3);
  });

  test('avarada iki sekme HİÇ açılmaz; durum listesi de onları taşımaz', () => {
    ornek();
    const D = durum('ex-IDR1');
    expect(Object.keys(D).sort()).toEqual(['geo', 'rol']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('GÜÇ EĞRİSİ — sessiz sıfır yakalanıyor', () => {
  test('çevrim kW taşıyorsa eğri isteğe bağlı', () => {
    ornek();
    expect(durum('ex-A_C').egr).toEqual({ d: 'bos', yazi: 'isteğe bağlı' });
  });

  test('bir çevrim satırında kW yok ve eğri yok → EKSİK; köprü o satıra 0 kW yazıyor', () => {
    ornek();
    const solv = dugum('ex-solver');
    delete solv.data.duty[3].kw['ex-A_C'];
    const D = durum('ex-A_C').egr;
    expect(D).toEqual(expect.objectContaining({ d: 'eksik', yazi: 'kW eksik' }));
    expect(D.neden).toMatch(/1 satırında/);
    // Köprünün tarafı: o satırda klimanın yükü SIFIR (sessiz).
    const b = kopru();
    const ad = b.names[b.order.findIndex((n) => n.id === 'ex-A_C')];
    const core = veFeadDutyToCore(b, veFeadDutyRows(solv));
    expect(core[3].loadsKw[ad]).toBe(0);
    expect(core[2].loadsKw[ad]).toBeGreaterThan(0);
  });

  test('eğri girilince eksik kalkar — ve köprü o satırı artık eğriden dolduruyor', () => {
    ornek();
    const solv = dugum('ex-solver');
    delete solv.data.duty[3].kw['ex-A_C'];
    dugum('ex-A_C').data.pwrCurve = [{ rpm: 1000, kw: 1.5 }, { rpm: 6000, kw: 4.0 }];
    expect(durum('ex-A_C').egr).toEqual({ d: 'ok', yazi: '2 nokta' });
    const b = kopru();
    const ad = b.names[b.order.findIndex((n) => n.id === 'ex-A_C')];
    expect(veFeadDutyToCore(b, veFeadDutyRows(solv))[3].loadsKw[ad]).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('ÇÖZÜCÜ — dört sekmenin dördü de bir sonuca bağlı', () => {
  test('örnekte motor devirleri yok: Girdiler eksik, kapı da "governed bilinmiyor" diyor', () => {
    ornek();
    const D = durum('ex-solver');
    expect(D.gir).toEqual(expect.objectContaining({ d: 'eksik', yazi: '0/2 girildi' }));
    const b = kopru();
    const K = veFeadChecks(b, veFeadCheckOpt(b.solver.data, veFeadDutyRows(b.solver)));
    expect(K.ratioWindow.durum).toBe('wait');
    Object.assign(dugum('ex-solver').data, { governedRpm: 2100, overspeedRpm: 2600 });
    expect(durum('ex-solver').gir.d).toBe('ok');
  });

  test('Model köprünün hükmü; çözülemezse sebebi köprünün İLK hatası', () => {
    ornek();
    expect(durum('ex-solver').mod).toEqual({ d: 'ok', yazi: 'çözüldü' });
    delete dugum('ex-A_C').data.x;
    const D = durum('ex-solver').mod;
    expect(D.d).toBe('eksik');
    expect(D.neden).toBe(kopru().errors[0]);
  });

  test('Çevrim satır sayısı (rozetin yerini aldı); boş çevrim eksik', () => {
    ornek();
    expect(durum('ex-solver').cev).toEqual({ d: 'ok', yazi: '12 satır' });
    dugum('ex-solver').data.duty = [];
    expect(durum('ex-solver').cev.d).toBe('eksik');
  });

  test('Sonuç: hesap yok → isteğe bağlı değil "hesaplanmadı"; hata → eksik', () => {
    ornek();
    expect(durum('ex-solver').son).toEqual({ d: 'bos', yazi: 'hesaplanmadı' });
    window.veFeadResults = { ok: false, solvedNodeId: 'ex-solver' };
    expect(durum('ex-solver').son.d).toBe('eksik');
  });

  test('araç pencerelerinin durumu YOK (yalnız veri girilen pencereler)', () => {
    ornek();
    ['ex-layout', 'ex-report'].forEach((id) => expect(durum(id)).toBeNull());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('ŞERİT VE BANT — pencerede', () => {
  const ciz = (html) => { const k = document.createElement('div'); k.innerHTML = html; return k; };

  test('her sekme adının altında durum satırı; düğmede aynı durum', () => {
    ornek();
    const kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-A_C')));
    const sek = [...kap.querySelectorAll('.ve-fp-tab')];
    expect(sek.map((b) => b.getAttribute('data-k'))).toEqual(['geo', 'rol', 'dev', 'egr']);
    expect(sek.map((b) => b.querySelector('.ve-fp-tab-d').textContent))
      .toEqual(['tamam', 'tamam', '0/3 girildi', 'isteğe bağlı']);
    sek.forEach((b) => expect(b.getAttribute('data-d'))
      .toBe(b.querySelector('.ve-fp-tab-d').getAttribute('data-d')));
    // Ad ayrı bir elemanda: sekme adı okunurken durum ona karışmıyor.
    expect(sek[2].querySelector('.ve-fp-tab-ad').textContent).toBe('Devir Sınırları');
  });

  test('eksik varken bant: sekmenin ADI, SONUCU ve bağlantısı; yokken bant YOK', () => {
    ornek();
    let kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-A_C')));
    const bant = kap.querySelector('.ve-fp-eksik');
    expect(bant).toBeTruthy();
    expect(bant.querySelectorAll('.ve-fp-eksik-s').length).toBe(1);
    expect(bant.textContent).toMatch(/Devir Sınırları/);
    expect(bant.textContent).toMatch(/değerlendirilemiyor/);
    expect(bant.querySelector('button').getAttribute('onclick')).toMatch(/veFeadEksikGit\('ex-A_C','dev'\)/);
    // Bant sekme gövdelerinin DIŞINDA — hangi sekme açık olursa olsun görünür.
    expect(kap.querySelector('[id^="ve-fp-panes-"]').contains(bant)).toBe(false);
    kap = ciz(getFeadPulleyPropertiesHTML(dugum('ex-ALT')));
    expect(kap.querySelector('.ve-fp-eksik')).toBeNull();
  });

  test('araç penceresinde durum satırı da bant da yok, şerit yine var', () => {
    ornek();
    const kap = ciz(veFeadPanelShell(dugum('ex-report'),
      [{ k: 'a', ad: 'A', govde: 'x' }, { k: 'b', ad: 'B', govde: 'y' }], { html: '' }));
    expect(kap.querySelectorAll('.ve-fp-tab').length).toBe(2);
    expect(kap.querySelectorAll('.ve-fp-tab-d').length).toBe(0);
    expect(kap.querySelector('.ve-fp-eksik')).toBeNull();
  });

  test('ROZET KALKTI (kural 26): ne şeritte ne kaynakta', () => {
    ornek();
    const kap = ciz(getFeadSolverPropertiesHTML(dugum('ex-solver')));
    expect(kap.querySelectorAll('.ve-fp-tab b').length).toBe(0);
    expect(SRC).not.toMatch(/s\.rozet|rozetD/);
    expect(CSS).not.toMatch(/\.ve-fp-tab b\b/);
    // Satır sayısı durum satırında.
    expect(kap.querySelector('.ve-fp-tab[data-k="cev"] .ve-fp-tab-d').textContent).toBe('12 satır');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('YERİNDE TAZELEME — panel kurulmadan, odak düşmeden', () => {
  test('üç sınır yazılınca durum "tamam", bant kalkar, GİRİŞLER AYNI NESNE', () => {
    ornek();
    document.body.innerHTML = getFeadPulleyPropertiesHTML(dugum('ex-A_C'));
    const giris = document.getElementById('ve-fead-optimumRpm-ex-A_C');
    expect(giris).toBeTruthy();
    expect(document.querySelector('.ve-fp-eksik')).toBeTruthy();
    // veFeadSet'in yaptığı: alanı yazar, paneli KURMAZ.
    Object.assign(dugum('ex-A_C').data, { optimumRpm: 6000, maxContRpm: 8000, maxPeakRpm: 12000 });
    expect(veFeadSekmeTazele()).toBe(1);
    const d = document.querySelector('.ve-fp-tab[data-k="dev"]');
    expect(d.getAttribute('data-d')).toBe('ok');
    expect(d.querySelector('.ve-fp-tab-d').textContent).toBe('tamam');
    expect(document.querySelector('.ve-fp-eksik')).toBeNull();
    expect(document.getElementById('ve-fead-optimumRpm-ex-A_C')).toBe(giris);   // yeniden KURULMADI
  });

  test('ters yön de: alan boşalınca bant GERİ gelir, şeridin hemen altına', () => {
    ornek();
    document.body.innerHTML = getFeadPulleyPropertiesHTML(dugum('ex-ALT'));
    expect(document.querySelector('.ve-fp-eksik')).toBeNull();
    delete dugum('ex-ALT').data.maxPeakRpm;
    veFeadSekmeTazele();
    const bant = document.querySelector('.ve-fp-eksik');
    expect(bant).toBeTruthy();
    expect(bant.previousElementSibling.classList.contains('ve-fp-tabs')).toBe(true);
    expect(bant.textContent).toMatch(/1 sınır boş/);
  });

  test('saveState TAZELER — "girdi değişti" olayının tek kaynağı', () => {
    // state.js yalıtık bir kapsamda kurulur: bu dosyanın global'leriyle çakışmasın.
    const kod = fs.readFileSync(path.join(__dirname, '../../js/state.js'), 'utf8');
    const tazele = jest.fn();
    const kur = new Function('nodes', 'connections', 'veFeadSekmeTazele', 'veFeadRefreshLayoutCards',
      kod + '\nreturn saveState;');
    const saveState = kur([], [], tazele, jest.fn());
    saveState();
    expect(tazele).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('BANTTAN GİT — sekmeyi açar, ilk BOŞ girişe odaklanır', () => {
  test('Doldur → devir sekmesi açık ve imleç optimumda', () => {
    ornek();
    document.body.innerHTML = getFeadPulleyPropertiesHTML(dugum('ex-A_C'));
    expect(veFeadEksikGit('ex-A_C', 'dev')).toBe(true);
    expect(document.querySelector('.ve-fp-tab[data-k="dev"]').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(document.getElementById('ve-fead-optimumRpm-ex-A_C'));
  });

  test('boş girişi olmayan sekmede odak SEKMENİN KENDİSİNE', () => {
    ornek();
    window.veFeadResults = { ok: false, solvedNodeId: 'ex-solver' };
    document.body.innerHTML = getFeadSolverPropertiesHTML(dugum('ex-solver'));
    expect(veFeadEksikGit('ex-solver', 'son')).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('.ve-fp-tab[data-k="son"]'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('GÖRÜNÜM CSS\'TE, JETONDAN', () => {
  // TABAN kural: satır başındaki (girintisiz) bildirim — dar kap sorgusunun
  // içindeki girintili kopya değil.
  const kural = (sec) => {
    const i = CSS.indexOf('\n' + sec + '{');
    return i < 0 ? '' : CSS.slice(i, CSS.indexOf('}', i));
  };
  test('bant bir denetim: zemin + çerçeve jetondan, dar kapta sarar', () => {
    const r = kural('.ve-fp-tabs');
    expect(r).toMatch(/background:var\(--bg-tertiary\)/);
    expect(r).toMatch(/border:1px solid var\(--border-color\)/);
    expect(r).toMatch(/flex-wrap:wrap/);
  });
  test('durum rengi ANLAMDAN (--ink-*), biçim renksiz de ayırıyor', () => {
    expect(kural('.ve-fp-tab-d[data-d="ok"]')).toMatch(/var\(--ink-success\)/);
    expect(kural('.ve-fp-tab-d[data-d="eksik"]')).toMatch(/var\(--ink-warning\)/);
    expect(kural('.ve-fp-tab-d[data-d="bos"] i')).toMatch(/background:none/);
    expect(kural('.ve-fp-tab-d[data-d="yok"] i')).toMatch(/display:none/);
    // Pencere HTML'i durum rengi YAZMIYOR.
    ornek();
    expect(getFeadPulleyPropertiesHTML(dugum('ex-A_C'))).not.toMatch(/ve-fp-tab-d[^>]*style=/);
  });
});
