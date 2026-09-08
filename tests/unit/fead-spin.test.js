/**
 * fead-spin.test.js — KAYIŞ DÖNÜŞ YÖNÜ (CW / CCW)
 *
 * Kullanıcı sorusu (2026-08-28): *"kayışın dönüş yönü neye göre belirleniyor?
 * Bu dönüş yönünü de CW veya CCW olacak şekilde ayarlayacak bir bileşen
 * kuralım… Buna göre de matematiği ayarlayalım (eğer değişiyorsa)."*
 *
 * CEVAP ÖLÇÜLDÜ, ve iki yarısı birbirinin tersi:
 *
 *   GEOMETRİ YÖNDEN BAĞIMSIZ — cebirsel özdeşlik, yaklaşıklık değil.
 *   `solveGeometry` her kasnakta `d = (grooved ? s : −s)` kuruyor ve sarımı
 *   `wr = d·(θ_çıkış − θ_giriş)` ile alıyor. Ters yürütmek hem `s`yi hem de
 *   giriş/çıkış teğetlerini takas ediyor: `(−d)·(θ_giriş − θ_çıkış)` =
 *   `d·(θ_çıkış − θ_giriş)`. İki işaret birbirini götürüyor.
 *   ÖLÇÜLDÜ: kasnak başına sarım farkı 2,5e−14°, L_eff farkı 0,000000000 mm.
 *
 *   GERİLME ZİNCİRİ BAĞIMSIZ DEĞİL — ve bu FİZİK. `spanTensions` ankrajı
 *   gergiye yazıp LİSTE sırasında yürüyor (sürücüde +P/v, aksesuarlarda
 *   −P/v). Ters yönde gergi krankın GERGİN tarafına düşüyor ve spanlar
 *   ankrajın altına iniyor. Otomatik gergi tanım gereği GEVŞEK tarafa konur —
 *   14 Gates sisteminin 14'ünde de öyle.
 *
 * ── 2026-09-08: LİSTE SIRASI KAYIŞIN GİDİŞİNİN TERSİDİR ───────────────────
 *
 * Kullanıcı bildirimi (dört kez): *"krank kasnağı saat yönünde dönmüyor"*.
 * Haklıydı ve hata bir fizik varsayımındaydı: "sürücünün çıkışı gergin"
 * sanılıyordu. Sürücü kayışı kendine ÇEKER — gergin taraf sürücüye GİREN
 * açıklıktır, çıkan gevşektir (bisikletin dişlisi üst zinciri çeker, alt
 * zincir gevşektir). Çekirdek listeyi yürürken sürücüde `+P/v` yazdığına
 * göre liste = gidişin TERSİ; Gates de tablosunu böyle yazıyor ve AG00976
 * raporunun kendi okları (`A_C -> FAN · ALT -> A_C · FAN -> ALT`, üçü de
 * tablonun tersi) ile gerilme satırı (tablo sırasında FAN 1585 → A_C 1177 →
 * ALT 546: aksesuarda DÜŞÜYOR) bunu doğruluyor. Liste CCW dolanıyor → kayış
 * CW akıyor → krank CW. `veFeadNaturalSense` işareti çevirir; konumlara ve
 * 2095 doğrulanmış sayıya dokunulmadı. Kapılar aşağıda, "LİSTE SIRASI
 * KAYIŞIN GİDİŞİNİN TERSİ" öbeğinde — ikisi raporun PDF'inden okuyor.
 *
 * Bu dosyanın kilitlediği üçüncü şey, panelin bir dönem verdiği YANLIŞ
 * TEŞHİS: "tasarım gerginliğini yükseltin". O alan 2026-08-25'te girdi
 * olmaktan çıktı (yay dengesinden türüyor), yani çare basılacak düğmesi
 * olmayan bir denetimi gösteriyordu.
 */
const path = require('path');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const V = require('../fixtures/fead-validation.js');
const { gatesPdfPages, gatesPdfText } = require('../helpers/gates-pdf.js');
const AG00976_PDF = path.join(__dirname,
  '../../docs/gates-reports/pdf/AG00976_8PK1715HD_Ten-250-110_2025-06-05.pdf');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
eval(loadSource('fead-belts.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });

function _pivotFromArm(td) {
  const a = Number(td.armLen), th = Number(td.armMeanDeg) * Math.PI / 180;
  if (!Number.isFinite(Number(td.cenX)) || !Number.isFinite(a) || !Number.isFinite(th)) return null;
  return [Number(td.cenX) - a * Math.cos(th), Number(td.cenY) - a * Math.sin(th)];
}

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  global.veFeadResults = null;
});

function kur(key, ters) {
  const pack = M.veFeadExampleNodes(key);
  const ns = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  const cs = pack.connections.map((c) => Object.assign({}, c));
  global.nodes = ns; global.connections = cs;
  if (ters) M.veFeadReverseRoute(ns, cs);
  return { ns, cs, b: M.veFeadBuildSystem(ns, cs) };
}

const dutyRows = (ns) => (ns.find((n) => n.type === 'fead-solver').data.duty) || [];
const coz = (s) => M.veFeadAnalyze(s.b, { rows: dutyRows(s.ns) });
const kisa = (nm) => String(nm).replace(/ .*/, '');

// ÇİZİM AYNALANMAZ (2026-09-07): ekranda görülen yön, modelin `spin`'inin
// KENDİSİ. Ve `spin` kayışın GERÇEK dönüşüdür (2026-09-08): Gates tablo
// sırasında kurulu bütün örneklerde liste CCW dolanır, kayış CW akar, krank
// CW döner. `ORNEK_SPIN` bu sabittir; glif ondan basılır.
const ORNEK_SPIN = -1;
const glif = (spin) => (spin > 0 ? '\u21ba CCW' : '\u21bb CW');

// ─────────────────────────────────────────────────────────────────────────────
describe('yön NEREDEN geliyor', () => {
  test('rota sırasının dolanım işaretinden — çekirdeğin loopSense ölçütü, TERS işaretle', () => {
    const s = kur('AG00976_GATES_2025', false);
    const kasnak = s.ns.filter((n) => M._feadIsPulley(n));
    expect(M.veFeadNaturalSense(s.b.order)).toBe(ORNEK_SPIN);   // −1 = CW
    // İkinci kopya YOK: köprü çekirdeğin kendi fonksiyonunu çağırıyor. Çekirdeğin
    // `sense`i LİSTENİN el yönü (+1, CCW); kayışın dönüşü onun tersi.
    const g = F.geometryAt(s.b.sys, s.b.relDeg || 0);
    expect(g.sense).toBe(1);
    expect(M.veFeadNaturalSense(s.b.order)).toBe(-g.sense);
    expect(kasnak.length).toBe(6);
  });

  test('ters kablolama işareti ÇEVİRİYOR', () => {
    expect(M.veFeadNaturalSense(kur('AG00976_GATES_2025', false).b.order)).toBe(ORNEK_SPIN);
    expect(M.veFeadNaturalSense(kur('AG00976_GATES_2025', true).b.order)).toBe(-ORNEK_SPIN);
    expect(M.veFeadNaturalSense(kur('BMC_FEAD_2026', false).b.order)).toBe(ORNEK_SPIN);
    expect(M.veFeadNaturalSense(kur('BMC_FEAD_2026', true).b.order)).toBe(-ORNEK_SPIN);
  });

  test('koordinatı eksik modelde yön 0 — uydurulmaz', () => {
    const s = kur('BMC_FEAD_2026', false);
    delete s.ns.find((n) => n.type === 'fead-alternator').data.x;
    expect(M.veFeadNaturalSense(s.b.order)).toBe(0);
    expect(M.veFeadNaturalSense([])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// YÖN AVARA MERKEZİNDEN OKUNUR — MONTAJ KONUMUNDAN DEĞİL
//
// Gerginin kayış düzleminde iki noktası var ve aralarında tam kol boyu kadar
// mesafe (90 mm). Dolanım yönü (loopSense) kasnak MERKEZLERİNİN çokgenine
// bakıyor; oraya montaj konumunu koymak yönü kol boyu kadar kaymış bir
// çokgenden okumak olurdu. Hesap etkilenmez (çekirdek yönü çözülmüş
// geometriden buluyor), yani hata SESSİZ olurdu: sayılar doğru, rozet yanlış.
describe('yön AVARA MERKEZİNDEN okunur', () => {
  const kanvas = (key) => {
    const s = kur(key, false);
    const ten = s.ns.find((n) => n.type === 'fead-tensioner');
    return { ns: s.ns, cs: s.cs, ten, b: M.veFeadBuildSystem(s.ns, s.cs) };
  };

  test('AG00976 çözülüyor ve yön okunuyor', () => {
    const z = kanvas('AG00976_GATES_2025');
    expect(z.b.ok).toBe(true);
    expect(M.veFeadNaturalSense(z.b.order)).toBe(ORNEK_SPIN);
    // Çekirdeğin ÇÖZDÜĞÜ el yönüyle bağlı olmak zorunda (ters işaret): rozet
    // bir hüküm taşıyor, geometriden bağımsız bir ikinci yön kaynağı olamaz.
    expect(F.geometryAt(z.b.sys, z.b.relDeg).sense).toBe(-ORNEK_SPIN);
  });

  test('build.spin çözümle tutarlı', () => {
    const z = kanvas('AG00976_GATES_2025');
    expect(z.b.spin).toBe(ORNEK_SPIN);
  });

  test('BMC de çözülüyor ve yön okunuyor', () => {
    const z = kanvas('BMC_FEAD_2026');
    expect(z.b.ok).toBe(true);
    expect(z.b.spin).toBe(ORNEK_SPIN);
    expect(F.geometryAt(z.b.sys, z.b.relDeg).sense).toBe(-ORNEK_SPIN);
  });

  test('okunan merkez, çekirdeğin ÇALIŞMA merkeziyle BİREBİR', () => {
    // Kapının asıl gücü burada: girilen merkez "yaklaşık" değil, çözümün
    // kendisi. Kol nominal yay yüküne oturduğu için çekirdek tam o noktayı
    // veriyor — girdi ile çıktı aynı sayı.
    const z = kanvas('AG00976_GATES_2025');
    const cen = M.veFeadTensionerCenter(z.ten.data, z.b.armAbsDeg);
    const ts = F.tensionerState(z.b.sys, z.b.relDeg);
    expect(cen[0]).toBeCloseTo(ts.center[0], 3);
    expect(cen[1]).toBeCloseTo(ts.center[1], 3);
    // ve MONTAJ KONUMU DEĞİL: tam kol boyu kadar uzakta.
    const p = M.veFeadTensionerPivot(z.ten.data);
    expect(Math.hypot(cen[0] - p[0], cen[1] - p[1]))
      .toBeCloseTo(z.ten.data.armLen, 6);
  });

  test('MONTAJ KONUMUNU çokgene koymak yönü ÇEVİREBİLİR — sentetik kapı', () => {
    // İki gerçek örnekte iki nokta AYNI işareti veriyor (ölçüldü), yani yalnız
    // onlara bakan bir test "montaj konumunu kullan" mutasyonundan sağ
    // çıkardı. Burada merkez doğrunun ÜSTÜNDE, montaj konumu ALTINDA.
    const P = (id, type, data) => ({ id, type, def: componentDefs[type], data });
    const ns = [
      P('p1', 'fead-crank',     { driver: true, od: 80, x: 0,   y: 0 }),
      P('p2', 'fead-alternator', { od: 60, x: 100, y: 0 }),
      P('p3', 'fead-tensioner',  { od: 75, cenX: 50, cenY: 10, armLen: 20,
                                   armMeanDeg: 90 })
    ];
    const merkez = M.veFeadTensionerCenter(ns[2].data);
    expect(merkez[0]).toBeCloseTo(50, 9);
    expect(merkez[1]).toBeCloseTo(10, 9);
    const p = M.veFeadTensionerPivot(ns[2].data);
    expect(p[0]).toBeCloseTo(50, 9);
    expect(p[1]).toBeCloseTo(-10, 9);                           // 20 mm aşağı
    expect(F.loopSense([[0, 0], [100, 0], [50, 10]])).toBe(1);   // merkezle liste CCW
    expect(M.veFeadNaturalSense(ns)).toBe(-1);                  // → kayış CW
    expect(F.loopSense([[0, 0], [100, 0], [50, -10]])).toBe(-1); // montajla liste CW → +1 çıkardı
  });

  test('merkez YOKSA yön uydurulmaz (0)', () => {
    const z = kanvas('AG00976_GATES_2025');
    expect(M.veFeadNaturalSense(z.b.order)).toBe(ORNEK_SPIN);
    delete z.ten.data.cenX;
    expect(M.veFeadTensionerCenter(z.ten.data)).toBe(null);
    expect(M.veFeadNaturalSense(z.b.order)).toBe(0);
  });

  test('BAYAT pivotX/pivotY okunmaz — göç onları zaten siliyor', () => {
    // Eski bir kayıttan gelen montaj konumu yazılı KALAMAZ: göç onu siliyor.
    // Elle düzenlenmiş bir dosya taşısa bile okuyucu ona hiç bakmıyor.
    const z = kanvas('AG00976_GATES_2025');
    const dogru = M.veFeadTensionerCenter(z.ten.data);
    z.ten.data.pivotX = 9999; z.ten.data.pivotY = -9999;
    const sonra = M.veFeadTensionerCenter(z.ten.data);
    expect(sonra[0]).toBeCloseTo(dogru[0], 9);
    expect(sonra[1]).toBeCloseTo(dogru[1], 9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('rotayı çevirmek — KABLOLARDAN, bayraktan DEĞİL', () => {
  test('uçlar YERİNDE takas edilir, port kimlikleri yazılır', () => {
    const pack = M.veFeadExampleNodes('BMC_FEAD_2026');
    const ns = pack.nodes.map((n) => ({ id: n.id, type: n.type,
      def: componentDefs[n.type], data: n.data || {} }));
    const cs = pack.connections.map((c) => Object.assign({}, c));
    const ilk = cs[0], fromOnce = ilk.from, toOnce = ilk.to;
    const k = M.veFeadReverseRoute(ns, cs);
    expect(k).toBe(cs.length);
    expect(cs[0]).toBe(ilk);                    // AYNI nesne (yeni kimlik yok)
    expect(ilk.from).toBe(toOnce);
    expect(ilk.to).toBe(fromOnce);
    expect(ilk.fromPort).toBe('output');
    expect(ilk.toPort).toBe('input');
  });

  test('iki kez çevirmek BİRİM işlem', () => {
    const pack = M.veFeadExampleNodes('BMC_FEAD_2026');
    const ns = pack.nodes.map((n) => ({ id: n.id, type: n.type,
      def: componentDefs[n.type], data: n.data || {} }));
    const cs = pack.connections.map((c) => Object.assign({}, c));
    const once = cs.map((c) => c.from + '>' + c.to).join(',');
    M.veFeadReverseRoute(ns, cs);
    expect(cs.map((c) => c.from + '>' + c.to).join(',')).not.toBe(once);
    M.veFeadReverseRoute(ns, cs);
    expect(cs.map((c) => c.from + '>' + c.to).join(',')).toBe(once);
  });

  test('yalnız İKİ UCU DA KASNAK olan teller çevrilir', () => {
    const ns = [
      { id: 'p1', type: 'fead-crank', def: componentDefs['fead-crank'], data: {} },
      { id: 'p2', type: 'fead-idler', def: componentDefs['fead-idler'], data: {} },
      { id: 'r1', type: 'fead-report', def: componentDefs['fead-report'], data: {} },
    ];
    const cs = [{ from: 'p1', to: 'p2' }, { from: 'p2', to: 'r1' }];
    expect(M.veFeadReverseRoute(ns, cs)).toBe(1);
    expect(cs[0].from).toBe('p2');
    expect(cs[1].from).toBe('p2');              // araç düğümüne giden tel DURUR
    expect(cs[1].to).toBe('r1');
  });

  test('çevrilmiş rota köprüde GEÇERLİ kalır (yol yine kapanır)', () => {
    const s = kur('AG00976_GATES_2025', true);
    expect(s.b.ok).toBe(true);
    expect(s.b.route.closed).toBe(true);
    expect(s.b.route.isolated.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MATEMATİK — geometri değişmez, gerilme değişir', () => {
  test('GEOMETRİ BİREBİR: sarım, açıklık, L_eff, Σ=360', () => {
    ['AG00976_GATES_2025', 'BMC_FEAD_2026'].forEach((key) => {
      const a = kur(key, false), b = kur(key, true);
      const ga = F.geometryAt(a.b.sys, a.b.relDeg);
      const gb = F.geometryAt(b.b.sys, b.b.relDeg);
      expect(gb.LeffMm).toBeCloseTo(ga.LeffMm, 9);
      expect(Math.abs(gb.signedWrapDeg)).toBeCloseTo(Math.abs(ga.signedWrapDeg), 6);
      expect(Math.abs(ga.signedWrapDeg)).toBeCloseTo(360, 2);
      // Kasnak BAŞINA — küme eşitliği değil, adıyla eşleşen sarım.
      ga.names.forEach((nm, i) => {
        const j = gb.names.indexOf(nm);
        expect(j).toBeGreaterThanOrEqual(0);
        expect(gb.wraps[j]).toBeCloseTo(ga.wraps[i], 9);
      });
      // Kol açısı da aynı: take-up geometriden geliyor.
      expect(b.b.relDeg).toBeCloseTo(a.b.relDeg, 6);
    });
  });

  test('GERİLME ZİNCİRİ DEĞİŞİR — ters yönde ankrajın ALTINA iniyor', () => {
    const a = kur('AG00976_GATES_2025', false);
    const ra = coz(a);
    const ta = ra.analysis.duty[0].perPulley.map((x) => x.exitTensionN);
    // İleri: Gates satırı (1381/1380/1023/1022/545/544)
    expect(ta[0]).toBeCloseTo(1381.0, 0);
    expect(Math.min.apply(null, ta)).toBeCloseTo(544.0, 0);
    expect(Math.min.apply(null, ta)).toBeGreaterThan(0);

    const b = kur('AG00976_GATES_2025', true);
    const rb = coz(b);
    const tb = rb.analysis.duty[0].perPulley.map((x) => x.exitTensionN);
    expect(Math.min.apply(null, tb)).toBeLessThan(0);        // NEGATİF
    expect(Math.min.apply(null, tb)).toBeCloseTo(-291.6, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('gergi tarafı hükmü', () => {
  test('İLERİ yönde gergi GEVŞEK tarafta (ankraj = minimum)', () => {
    const s = kur('AG00976_GATES_2025', false);
    const R = coz(s);
    expect(R.tensionerSide.ok).toBe(true);
    expect(R.warnings.join(' ')).not.toMatch(/GERGİN tarafında/);
  });

  test('TERS yönde gergi GERGİN tarafta — sebep ADIYLA yazılıyor', () => {
    const s = kur('AG00976_GATES_2025', true);
    const R = coz(s);
    expect(R.tensionerSide.ok).toBe(false);
    expect(R.tensionerSide.drain.length).toBeGreaterThan(0);
    expect(R.tensionerSide.negative).toBe(true);
    expect(R.tensionerSide.deficitN).toBeGreaterThan(500);
    const w = R.warnings.join(' ');
    expect(w).toMatch(/GERGİN tarafında/);
    expect(w).toMatch(/GEVŞEK/);
    // ULAŞILAMAZ ÇARE YASAK: tasarım gerginliği bir alan DEĞİL.
    expect(w).not.toMatch(/gerginliği yükselt/i);
    expect(w).toMatch(/yükseltilemez/);
  });

  test('uyarı ÜST SEVİYEYE yükseliyor — raporlar yalnız oraya bakıyor', () => {
    // Çekirdeğin uyarısı duty satırındaydı; iki raporun uyarı kutusu da
    // R.warnings + R.build.warnings okuyor, dolayısıyla ters modelde kutu
    // BOŞ kalıyordu (ölçüldü: 12 satırın 10'u uyarılıyken R.warnings=null).
    const s = kur('AG00976_GATES_2025', true);
    const R = coz(s);
    const satirUyarisi = R.analysis.duty.some((d) => d.warnings && d.warnings.length);
    expect(satirUyarisi).toBe(true);
    expect(R.warnings.length).toBeGreaterThan(0);
  });

  test('ölçüt EŞİKSİZ: ankrajın altına inen span aranır, negatif sayı değil', () => {
    const row = { perPulley: [
      { name: 'K', exitTensionN: 900 }, { name: 'A', exitTensionN: 400 },
      { name: 'T', exitTensionN: 500 } ] };
    const v = M.veFeadTensionerSide(row, 'T');
    expect(v.ok).toBe(false);            // hiçbir sayı negatif DEĞİL
    expect(v.negative).toBe(false);
    expect(v.drain).toEqual(['A']);
    expect(v.deficitN).toBeCloseTo(100, 6);
  });

  test('güç girilmemiş modelde bütün spanlar eşit — hüküm GEÇER', () => {
    const row = { perPulley: [
      { name: 'K', exitTensionN: 532.142 }, { name: 'T', exitTensionN: 532.142 } ] };
    expect(M.veFeadTensionerSide(row, 'T').ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('rozet ve panel', () => {
  const el = () => {
    const d = document.createElement('div');
    const box = document.createElement('div');
    box.className = 've-node-box';
    d.appendChild(box);
    return d;
  };
  const spinNode = () => {
    const d = componentDefs['fead-spin'];
    return { id: 'spin1', type: 'fead-spin', def: d, x: 0, y: 0,
             width: d.defaultWidth, height: d.defaultHeight, data: {} };
  };

  test('yön ROTA sırasından okunur, düğüm DİZİSİ sırasından değil', () => {
    // Bu kapı gerçek bir kusuru yakaladı: rozet `nodes.filter(isPulley)`
    // sırasını okuyordu. O sıra kayış yolunu anlatmıyor — kablolar çevrilince
    // dizi DEĞİŞMİYOR, dolayısıyla rozet çevirdikten sonra da eski yönü
    // gösteriyordu. Sessiz, çünkü sayı makul.
    const s = kur('AG00976_GATES_2025', false);
    expect(fead.veFeadCurrentSpin()).toBe(ORNEK_SPIN);
    M.veFeadReverseRoute(global.nodes, global.connections);
    // Düğüm dizisi hiç değişmedi…
    expect(M.veFeadNaturalSense(global.nodes.filter((n) => M._feadIsPulley(n)))).toBe(ORNEK_SPIN);
    // …ama rota çevrildi, ve okunan yön rotayı izliyor.
    expect(fead.veFeadCurrentSpin()).toBe(-ORNEK_SPIN);
  });

  test('rozet GLİFLE durumu, RENKLE hükmü taşır', () => {
    const s = kur('AG00976_GATES_2025', false);
    const b = spinNode(); global.nodes.push(b);

    // Çözüm yokken renk İDDİA ETMEZ.
    let a = el();
    expect(fead.veFeadApplyBadge(a, b)).toBe(true);
    let r = a.querySelector('.ve-fead-badge');
    // ROZET KAYIŞIN GERÇEK DÖNÜŞÜNÜ BASAR: AG00976 Gates sırasında kurulu →
    // liste CCW, kayış CW, krank CW. Rozet modelin `spin`'ini basmak zorunda;
    // ayrışırsa sessiz kalır, çünkü ikisi de ayrı ayrı makul görünür.
    expect(M.veFeadNaturalSense(s.b.order)).toBe(ORNEK_SPIN);
    expect(r.textContent).toBe(glif(ORNEK_SPIN));
    expect(r.textContent).toBe('\u21bb CW');
    expect(r.style.cssText).toContain('--text-secondary');

    // Gergi gevşek tarafta → yeşil
    global.veFeadResults = { tensionerSide: { ok: true } };
    a = el(); fead.veFeadApplyBadge(a, b);
    expect(a.querySelector('.ve-fead-badge').style.cssText).toContain('--accent-success');

    // Gergi gergin tarafta → kırmızı
    global.veFeadResults = { tensionerSide: { ok: false } };
    a = el(); fead.veFeadApplyBadge(a, b);
    expect(a.querySelector('.ve-fead-badge').style.cssText).toContain('--accent-danger');
  });

  test('ÇÖZDÜKTEN SONRA rozet tazelenir — bir çözüm GERİDE kalmaz', () => {
    // ÖLÇÜLDÜ (gerçek tarayıcı, tazeleme YOKKEN): ileri yönde nötr, ters
    // yönde YEŞİL, geri dönünce KIRMIZI — renk her seferinde bir ÖNCEKİ
    // modelin hükmünü gösteriyordu. Sessiz, çünkü sayı makul.
    const s = kur('AG00976_GATES_2025', true);
    const b = spinNode(); global.nodes.push(b);
    const el0 = el(); el0.id = b.id;
    document.body.appendChild(el0);
    global.veFeadResults = null;
    fead.veFeadApplyBadge(el0, b);
    expect(el0.querySelector('.ve-fead-badge').style.cssText).toContain('--text-secondary');

    // Çözüm koştur → rozet AYNI karede hükme geçmeli
    const sv = s.ns.find((n) => n.type === 'fead-solver');
    fead.veFeadSolve(sv.id);
    expect(global.veFeadResults.tensionerSide.ok).toBe(false);
    expect(el0.querySelector('.ve-fead-badge').style.cssText).toContain('--accent-danger');
    document.body.removeChild(el0);
  });

  test('CW ile CCW aynı renk ekseninde DEĞİL — glif ayırıyor', () => {
    // İki mevcut rozette renk "mavi = GİRDİ, amber = TÜRETİLEN" demek.
    // CW ve CCW ikisi de eşit meşru; birine amber vermek yalan olurdu.
    const s = kur('AG00976_GATES_2025', false);
    const b = spinNode(); global.nodes.push(b);
    global.veFeadResults = { tensionerSide: { ok: true } };
    const a1 = el(); fead.veFeadApplyBadge(a1, b);
    const ilk = a1.querySelector('.ve-fead-badge');         // Gates sırası → CW

    M.veFeadReverseRoute(global.nodes, global.connections);
    const a2 = el(); fead.veFeadApplyBadge(a2, b);
    const ters = a2.querySelector('.ve-fead-badge');        // çevrilmiş → CCW

    expect(ilk.textContent).toBe(glif(ORNEK_SPIN));
    expect(ters.textContent).toBe(glif(-ORNEK_SPIN));
    expect(ilk.textContent).not.toBe(ters.textContent);  // ters çevirmek İŞE YARADI
    expect(ters.style.background).toBe(ilk.style.background);   // AYNI renk
    expect(ilk.style.cssText).not.toContain('--accent-warning');
    expect(ilk.style.cssText).not.toContain('--accent-primary');
  });

  test('rozet mousedown\'ı durdurur ve tık yönü çevirir', () => {
    const s = kur('AG00976_GATES_2025', false);
    const b = spinNode(); global.nodes.push(b);
    const a = el(); fead.veFeadApplyBadge(a, b);
    const r = a.querySelector('.ve-fead-badge');
    let durdu = false;
    r.onmousedown({ stopPropagation: () => { durdu = true; } });
    expect(durdu).toBe(true);

    const once = M.veFeadNaturalSense(s.b.order);
    r.onclick({ stopPropagation() {}, preventDefault() {} });
    const sonra = M.veFeadNaturalSense(M.veFeadRouteOrder(global.nodes, global.connections));
    expect(sonra).toBe(-once);
    expect(stubs.saveState).toHaveBeenCalled();
  });

  test('panel yönü ve hükmü yazar, düğüme HİÇ yazmaz', () => {
    const s = kur('AG00976_GATES_2025', false);
    const b = spinNode(); global.nodes.push(b);
    const once = JSON.stringify(b.data);

    let h = fead.getFeadSpinPropertiesHTML(b);
    // PANEL DE KAYIŞIN GERÇEK DÖNÜŞÜNÜ BASAR. Rozet ile panel aynı üreticiden
    // besleniyor (`veFeadSpinLabel`); ikisi ayrışsaydı biri sessizce eskirdi.
    const yon = ORNEK_SPIN;
    expect(h).toContain(yon > 0 ? 'CCW (saat yönünün TERSİNE)' : 'CW (saat yönünde)');
    // ÇELİŞEN BAŞLIK YASAK — ama ETİKETLİ karşı yön serbest. Uzun metin
    // 2026-09-07'den beri öbür bakışı da adıyla veriyor ("… · Gates rapor
    // düzleminde CCW"); körlemesine `not.toContain('CCW')` onu da yakalıyordu
    // ve ölçtüğü şey artık yanlıştı. Ölçülen: BAŞLIK tek ve çizimle aynı.
    expect(h).not.toContain(yon > 0 ? 'CW (saat yönünde) —' : 'CCW (saat yönünün TERSİNE) —');
    expect(h).toContain('veFeadToggleSpin()');
    // DÜZLEM YAZILI OLMALI — hangi taraftan bakıldığı belirtilmeden CW/CCW
    // hiçbir şey söylemez. Metin tek üreticiden (`_feadPlaneName`) geliyor.
    expect(h).toContain(M._feadPlaneName());
    expect(h).toContain('Değişmez');               // geometri yönden bağımsız
    expect(JSON.stringify(b.data)).toBe(once);

    global.veFeadResults = { tensionerSide: { ok: false, anchorN: 544, minN: -291.6,
                                              minName: 'Avara 1', deficitN: 835.6, drain: ['x'] } };
    h = fead.getFeadSpinPropertiesHTML(b);
    expect(h).toContain('GERGİN tarafında');
    expect(h).not.toMatch(/undefined|NaN|\[object/);
    // ULAŞILAMAZ ÇARE YASAK — tasarım gerginliği panelde bir alan DEĞİL.
    expect(h).not.toMatch(/gerginliği yükselt/i);
    expect(h).toMatch(/yükseltilemez|bir alan değil/i);
  });

  test('SONUÇ KARTI da doğru sebebi yazar, "gerginliği yükseltin" DEMEZ', () => {
    // Kullanıcının çözdükten sonra gördüğü asıl yüzey burası.
    const s = kur('AG00976_GATES_2025', true);
    const R = coz(s);
    global.veFeadResults = Object.assign({ ok: true }, R);
    const h = fead.veFeadDutyResultTable(
      Object.assign({}, R, { pulleyNames: s.b.names }));
    expect(h).toContain('GERGİN tarafında');
    expect(h).toMatch(/yükseltilemez/);
    expect(h).not.toMatch(/[Tt]asarım gerginliğini yükseltin/);
    // Çöken zincirde kayma hükmü VERİLMEZ: slipSafety gevşek tarafı 1e-9'a
    // kenetliyor, çıkan −0.00 bir emniyet faktörü değil sayısal gölge.
    expect(h).toMatch(/kayma emniyet faktörü hüküm vermez/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('bileşen sözleşmesi', () => {
  test('bağlanamaz araç düğümü, tek kopya, "ufak"', () => {
    const d = componentDefs['fead-spin'];
    expect(d).toBeTruthy();
    expect(d.inputs).toBe(0);
    expect(d.outputs).toBe(0);
    expect(d.isFeadSpin).toBe(true);
    expect(d.maxInstances).toBe(1);
    const alan = (t) => (componentDefs[t].defaultWidth || 65)
                      * (componentDefs[t].defaultHeight || 60);
    ['fead-belt', 'fead-report', 'fead-example'].forEach((t) => {
      expect(alan('fead-spin')).toBeLessThan(alan(t));
    });
  });

  test('palet, kayıt defteri ve panel dağıtımı bağlı', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '../..');
    const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const i0 = idx.indexOf('FEAD Araçları');
    expect(i0).toBeGreaterThan(0);
    expect(idx.slice(i0, idx.indexOf('</div>\n\n', i0))).toContain('data-type="fead-spin"');
    expect(VE_MODULES['full-throttle'].components).toContain('fead-spin');
    const core = fs.readFileSync(path.join(root, 'js/cp-core.js'), 'utf8');
    expect(core).toContain("node.type === 'fead-spin'");
    expect(core).toContain('getFeadSpinPropertiesHTML(node)');
  });

  test('SİLME KANCASI YOK ve olmamalı — durum kablolarda', () => {
    // Konum Bağı'nda kanca ŞARTTI: düğüm iki gerçeği (kutu px ↔ mm) ayrı
    // tutuyordu ve silmek onları uzlaştırmasız bırakıyordu (81 mm patlaması).
    // Burada yön kabloların İÇİNDE; düğmeyi silmek hiçbir şeyi ayrıştırmaz.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../js/map.js'), 'utf8');
    expect(src).not.toContain('SpinAfterDelete');
    const s = kur('AG00976_GATES_2025', true);
    const once = M.veFeadNaturalSense(s.b.order);
    global.nodes = global.nodes.filter((n) => n.type !== 'fead-spin');
    expect(M.veFeadNaturalSense(M.veFeadRouteOrder(global.nodes, global.connections)))
      .toBe(once);                                 // yön DEĞİŞMEDİ
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LİSTE SIRASI KAYIŞIN GİDİŞİNİN TERSİ (2026-09-08)
//
// Dört kapı, dördü de aynı hükmü başka bir kaynaktan ölçüyor:
//   1. çekirdeğin gerilme zinciri (liste sırasında sürücüde ARTIYOR),
//   2. AG00976 raporunun kendi okları (PDF'ten okunur, üçü de tablonun tersi),
//   3. AG00976 raporunun gerilme satırı (PDF'ten okunur, tablo sırasında
//      aksesuarda DÜŞÜYOR — gidiş yönünde okunsaydı yükselirdi),
//   4. ekrana basılan sürücü oku (oniki örnekte de saat yönü).
// Fizik: sürücü kayışı kendine çeker → gergin taraf sürücüye GİREN açıklık.
// Dolayısıyla "liste sırasında sürücüde artan" bir zincir ancak liste gidişin
// TERSİ ise fizikle bağdaşır. Kullanıcı dört kez "krank saat yönünde dönmüyor"
// dedi; sebep buydu ve bir çizim düzlemi meselesi DEĞİLDİ.
describe('LİSTE SIRASI KAYIŞIN GİDİŞİNİN TERSİ', () => {
  const tabloSistemi = () => V.buildAG00976('1715@-250/110');

  test('çekirdek zinciri: LİSTE sırasında sürücüde +P/v, aksesuarda −P/v → liste = gidişin tersi', () => {
    const s = kur('AG00976_GATES_2025', false);
    const R = coz(s);
    expect(R.ok).toBe(true);
    const rows = (R.analysis && R.analysis.duty) || [];
    // En yüklü devir satırı: aksesuar güçleri sıfır olmasın.
    const row = rows.reduce((a, b) => {
      const g = (r) => (r.perPulley || []).reduce((t, p) => t + (Number(p.powerKw) || 0), 0);
      return g(b) > g(a) ? b : a;
    }, rows[0]);
    let yuklu = 0;
    row.perPulley.forEach((p, i) => {
      const dT = Number(p.exitTensionN) - Number(p.entryTensionN);     // liste sırasında
      const crank = !!(s.b.sys.pulleys[i] && s.b.sys.pulleys[i].crank);
      if (crank) expect(dT).toBeGreaterThan(50);                        // liste çıkışı GERGİN
      else if ((Number(p.powerKw) || 0) > 0.05) { yuklu++; expect(dT).toBeLessThan(-5); }
      else expect(Math.abs(dT)).toBeLessThan(5);                        // avara: kayıpsız
    });
    expect(yuklu).toBeGreaterThanOrEqual(2);
    // Sürücü kayışı çeker: gergin taraf ona GİREN açıklıktır. Liste çıkışı
    // gergin çıktığına göre liste gidişin tersi → dönüş = −loopSense(liste).
    const g = F.geometryAt(s.b.sys, s.b.relDeg || 0);
    expect(F.loopSense(g.pulleys.map((p) => p.c))).toBe(1);
    expect(s.b.spin).toBe(-F.loopSense(g.pulleys.map((p) => p.c)));
    expect(s.b.spin).toBe(ORNEK_SPIN);
  });

  test('AG00976 raporunun kendi okları: düz kasnak komşuları TABLONUN TERSİ yönde', () => {
    const txt = gatesPdfText(AG00976_PDF).replace(/\s+/g, ' ');
    const m = /Adjacent Grooved Pulleys((?: [A-Z_0-9]+ - >[A-Z_0-9]+){3})/.exec(txt);
    expect(m).not.toBeNull();
    const oklar = [];
    m[1].replace(/([A-Z_0-9]+) - >([A-Z_0-9]+)/g, (_, a, b) => { oklar.push([a, b]); return ''; });
    expect(oklar).toHaveLength(3);

    const sys = tabloSistemi();
    const ad = sys.pulleys.map((p) => p.name);                 // Gates tablo sırası
    const oluklu = (i) => sys.pulleys[i].contact !== 'back';
    const n = ad.length;
    const geri = (i) => { for (let k = 1; k < n; k++) { const j = (i - k + n) % n; if (oluklu(j)) return ad[j]; } return null; };
    const ileri = (i) => { for (let k = 1; k < n; k++) { const j = (i + k) % n; if (oluklu(j)) return ad[j]; } return null; };
    const duzler = ad.map((_, i) => i).filter((i) => !oluklu(i));
    expect(duzler).toHaveLength(3);                            // IDR1 · IDR2 · TEN
    duzler.forEach((i, k) => {
      // Gates "X -> Y": kayış X'ten gelip bu düz kasnağı geçerek Y'ye gidiyor.
      // Tablo sırasında bu kasnağın önceki oluklusu Y, sonrakisi X — yani ok
      // tablonun TERSİ. Üçünde de.
      expect(oklar[k]).toEqual([ileri(i), geri(i)]);
      expect(oklar[k]).not.toEqual([geri(i), ileri(i)]);
    });
    expect(oklar.map((o) => o.join('>'))).toEqual(['A_C>FAN', 'ALT>A_C', 'FAN>ALT']);
  });

  test('AG00976 raporunun gerilme satırı: tablo sırasında aksesuarda DÜŞÜYOR, sürücüde YÜKSELİYOR', () => {
    const sayfa = gatesPdfPages(AG00976_PDF).find((t) => t.indexOf('Belt Life B10') >= 0);
    expect(sayfa).toBeDefined();
    const m = /Tension((?: \d+){6}) Hubload/.exec(sayfa.replace(/\s+/g, ' '));
    expect(m).not.toBeNull();
    const T = m[1].trim().split(' ').map(Number);
    expect(T).toEqual([1585, 1582, 1177, 1174, 546, 544]);      // FAN IDR A_C IDR ALT TEN

    const sys = tabloSistemi();
    sys.pulleys.forEach((p, i) => {
      const dT = T[i] - T[(i - 1 + sys.pulleys.length) % sys.pulleys.length];
      if (p.crank) expect(dT).toBeGreaterThan(500);             // 544 → 1585
      else if (p.contact !== 'back') expect(dT).toBeLessThan(-300); // A_C · ALT
      else expect(Math.abs(dT)).toBeLessThanOrEqual(3);          // avara / gergi
    });
    // Gidiş yönünde aksesuar gerginliği ARTIRIR (sürülen kasnak kayışı
    // frenler: çıkışı gergin). Tablo sırasında düştüğüne göre tablo = tersi.
  });

  test('ekrandaki SÜRÜCÜ OKU saat yönünde — oniki örnekte, sırttan temas edenler ters', () => {
    M.veFeadExampleKeysAll().forEach((key) => {
      const s = kur(key, false);
      expect(s.b.ok).toBe(true);
      const svg = fead.veFeadLayoutSVG(s.b, 420, 320, { arrows: true });
      expect(svg).toBeTruthy();
      // Oklar: A rr rr 0 <büyük-yay> <sweep> — sweep 1 = ekranda saat yönü.
      const sweeps = [];
      svg.replace(/<path data-ve="spin" d="[^"]*?A[\d.]+ [\d.]+ 0 1 (\d) /g, (_, sw) => { sweeps.push(Number(sw)); return ''; });
      expect(sweeps.length).toBeGreaterThanOrEqual(2);
      expect(sweeps[0]).toBe(1);                                 // sürücü (sıranın başı) CW
      expect(sweeps).toContain(0);                               // sırttan temas eden CCW
    });
  });

  test('yükteki `spin` rozetle AYNI işaret, `sense` tersi — kart ile rozet ayrışamaz', () => {
    const s = kur('AG00976_GATES_2025', false);
    const svg = fead.veFeadLayoutSVG(s.b, 420, 320, { animate: { dispMmS: 40 } });
    const m = /data-fead-anim="([^"]*)"/.exec(svg);
    expect(m).not.toBeNull();
    const spec = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    expect(spec.spin).toBe(fead.veFeadCurrentSpin());
    expect(spec.spin).toBe(ORNEK_SPIN);
    expect(spec.sense).toBe(-spec.spin);
  });
});
