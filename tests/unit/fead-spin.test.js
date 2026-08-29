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
 *   gergiye yazıp kayış gidiş yönünde yürüyor (sürücüde +P/v, aksesuarlarda
 *   −P/v). Ters yönde gergi krankın GERGİN tarafına düşüyor ve spanlar
 *   ankrajın altına iniyor. Otomatik gergi tanım gereği GEVŞEK tarafa konur —
 *   14 Gates sisteminin 14'ünde de öyle.
 *
 * Bu dosyanın kilitlediği üçüncü şey, panelin bir dönem verdiği YANLIŞ
 * TEŞHİS: "tasarım gerginliğini yükseltin". O alan 2026-08-25'te girdi
 * olmaktan çıktı (yay dengesinden türüyor), yani çare basılacak düğmesi
 * olmayan bir denetimi gösteriyordu.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

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

// ─────────────────────────────────────────────────────────────────────────────
describe('yön NEREDEN geliyor', () => {
  test('rota sırasının dolanım işaretinden — çekirdeğin loopSense ölçütü', () => {
    const s = kur('AG00976_GATES_2025', false);
    const kasnak = s.ns.filter((n) => M._feadIsPulley(n));
    expect(M.veFeadNaturalSense(s.b.order)).toBe(1);        // +1 = CCW
    // İkinci kopya YOK: köprü çekirdeğin kendi fonksiyonunu çağırıyor.
    const g = F.geometryAt(s.b.sys, s.b.relDeg || 0);
    expect(g.sense).toBe(M.veFeadNaturalSense(s.b.order));
    expect(kasnak.length).toBe(6);
  });

  test('ters kablolama işareti ÇEVİRİYOR', () => {
    expect(M.veFeadNaturalSense(kur('AG00976_GATES_2025', false).b.order)).toBe(1);
    expect(M.veFeadNaturalSense(kur('AG00976_GATES_2025', true).b.order)).toBe(-1);
    expect(M.veFeadNaturalSense(kur('BMC_FEAD_2026', false).b.order)).toBe(1);
    expect(M.veFeadNaturalSense(kur('BMC_FEAD_2026', true).b.order)).toBe(-1);
  });

  test('koordinatı eksik modelde yön 0 — uydurulmaz', () => {
    const s = kur('BMC_FEAD_2026', false);
    delete s.ns.find((n) => n.type === 'fead-alternator').data.x;
    expect(M.veFeadNaturalSense(s.b.order)).toBe(0);
    expect(M.veFeadNaturalSense([])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ZARF KİPİNDE MERKEZ TÜRETİLİR — ölçülmüş bir SESSİZLİĞİN kapısı
//
// Zarf kipinde gergi kasnağının merkezi bir GİRDİ DEĞİL, çıktı: `cenX/cenY`
// hiç yazılmıyor. `veFeadNaturalSense` doğrudan o alanı okuduğu için ÇÖZÜLEN
// bir modelde bile 0 döndürüyordu — "Dönüş Yönü" rozeti ve paneli
// "— (okunamadı)" yazıyor, kullanıcı yönü göremiyordu. Hesap etkilenmiyordu
// (çekirdek yönü çözülmüş geometriden buluyor), yani hata SESSİZ: sayılar
// doğru, yüzey boş.
describe('zarf kipinde yön — merkez pivot + kol açısından TÜRER', () => {
  const zarfaCevir = (key) => {
    const s = kur(key, false);
    const ten = s.ns.find((n) => n.type === 'fead-tensioner');
    // Zarf kipinin gerçek girdisi: PİVOT. BMC'de pivot künyeden türüyor.
    const piv = _pivotFromArm(ten.data) || [ten.data.pivotX, ten.data.pivotY];
    delete ten.data.cenX; delete ten.data.cenY;
    delete ten.data.armMeanDeg; delete ten.data.freeAngleDeg;
    ten.data.pivotX = piv[0]; ten.data.pivotY = piv[1];
    return { ns: s.ns, cs: s.cs, ten, b: M.veFeadBuildSystem(s.ns, s.cs) };
  };

  test('AG00976 zarf kipinde ÇÖZÜLÜYOR ve yön okunuyor (eskiden 0)', () => {
    const z = zarfaCevir('AG00976_GATES_2025');
    expect(z.b.ok).toBe(true);
    expect(M.veFeadNaturalSense(z.b.order)).toBe(1);          // ← eskiden 0
    // Çekirdeğin ÇÖZDÜĞÜ yönle aynı olmak zorunda: rozet bir hüküm taşıyor,
    // geometriden bağımsız bir ikinci yön kaynağı olamaz.
    expect(F.geometryAt(z.b.sys, z.b.relDeg).sense).toBe(1);
  });

  test('build.spin bir ÇÖZÜM GERİDE kalmıyor', () => {
    // İlk okuma rota kurulur kurulmaz yapılıyor; o an kol açısı HENÜZ
    // SEÇİLMEMİŞ, yani merkez de yok. Zarf çözüldükten sonra tazelenmezse
    // ilk çözümde spin 0 kalırdı — model doğru, yüzey yanlış.
    const z = zarfaCevir('AG00976_GATES_2025');
    expect(z.b.spin).toBe(1);
    expect(z.ten.data.armMeanDeg).toBeCloseTo(z.b.armAbsDeg, 6);
  });

  test('BMC de zarfa çevrilince çözülüyor ve yön okunuyor', () => {
    const z = zarfaCevir('BMC_FEAD_2026');
    expect(z.b.ok).toBe(true);
    expect(z.b.spin).toBe(1);
    expect(F.geometryAt(z.b.sys, z.b.relDeg).sense).toBe(1);
  });

  test('türetilen merkez, çekirdeğin ÇALIŞMA merkeziyle birebir', () => {
    // Kapının asıl gücü burada: merkez "yaklaşık" değil, çözümün kendisi.
    // Kol açısı memosu zarfın seçtiği çalışma açısı olduğu için
    // c = p + a·(cosθ, sinθ) tam olarak çekirdeğin çalışma merkezini veriyor.
    const z = zarfaCevir('AG00976_GATES_2025');
    const cen = M.veFeadTensionerCenter(z.ten.data, z.b.armAbsDeg);
    const ts = F.tensionerState(z.b.sys, z.b.relDeg);
    expect(cen[0]).toBeCloseTo(ts.center[0], 3);
    expect(cen[1]).toBeCloseTo(ts.center[1], 3);
    // ve PİVOT DEĞİL: tam kol boyu kadar uzakta.
    expect(Math.hypot(cen[0] - z.ten.data.pivotX, cen[1] - z.ten.data.pivotY))
      .toBeCloseTo(z.ten.data.armLen, 6);
  });

  test('PİVOTU çokgene koymak yönü ÇEVİREBİLİR — sentetik kapı', () => {
    // İki gerçek örnekte pivot ile merkez AYNI işareti veriyor (ölçüldü), yani
    // yalnız onlara bakan bir test "pivotu kullan" mutasyonundan sağ çıkardı.
    // Burada merkez doğrunun ÜSTÜNDE, pivot ALTINDA: işaret çevriliyor.
    const P = (id, type, data) => ({ id, type, def: componentDefs[type], data });
    const ns = [
      P('p1', 'fead-crank',     { driver: true, od: 80, x: 0,   y: 0 }),
      P('p2', 'fead-alternator', { od: 60, x: 100, y: 0 }),
      P('p3', 'fead-tensioner',  { od: 75, angleMode: 'envelope',
                                   pivotX: 50, pivotY: -10, armLen: 20, armMeanDeg: 90 })
    ];
    const merkez = M.veFeadTensionerCenter(ns[2].data);
    expect(merkez[0]).toBeCloseTo(50, 9);
    expect(merkez[1]).toBeCloseTo(10, 9);                       // pivot + 20 mm yukarı
    expect(M.veFeadNaturalSense(ns)).toBe(1);                   // merkezle CCW
    expect(F.loopSense([[0, 0], [100, 0], [50, -10]])).toBe(-1); // pivotla CW
  });

  test('kol açısı YOKSA yön uydurulmaz (0)', () => {
    const z = zarfaCevir('AG00976_GATES_2025');
    expect(M.veFeadNaturalSense(z.b.order)).toBe(1);
    delete z.ten.data.armMeanDeg;
    expect(M.veFeadTensionerCenter(z.ten.data)).toBe(null);
    expect(M.veFeadNaturalSense(z.b.order)).toBe(0);
  });

  test('zarf kipinde BAYAT cenX/cenY okunmaz — köprü de okumuyor', () => {
    // Mount'tan zarfa geçen bir kayıtta cenX/cenY yazılı KALABİLİR. Köprü
    // onları girdi saymıyor (olsa olsa uyarı konusu); rozet sayarsa çözülen
    // geometriyle çelişen bir yön gösterebilirdi.
    const z = zarfaCevir('AG00976_GATES_2025');
    const dogru = M.veFeadTensionerCenter(z.ten.data);
    z.ten.data.cenX = 9999; z.ten.data.cenY = -9999;
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
    expect(fead.veFeadCurrentSpin()).toBe(1);
    M.veFeadReverseRoute(global.nodes, global.connections);
    // Düğüm dizisi hiç değişmedi…
    expect(M.veFeadNaturalSense(global.nodes.filter((n) => M._feadIsPulley(n)))).toBe(1);
    // …ama rota çevrildi, ve okunan yön rotayı izliyor.
    expect(fead.veFeadCurrentSpin()).toBe(-1);
  });

  test('rozet GLİFLE durumu, RENKLE hükmü taşır', () => {
    const s = kur('AG00976_GATES_2025', false);
    const b = spinNode(); global.nodes.push(b);

    // Çözüm yokken renk İDDİA ETMEZ.
    let a = el();
    expect(fead.veFeadApplyBadge(a, b)).toBe(true);
    let r = a.querySelector('.ve-fead-badge');
    expect(r.textContent).toBe('↺ CCW');
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
    const ccw = a1.querySelector('.ve-fead-badge');

    M.veFeadReverseRoute(global.nodes, global.connections);
    const a2 = el(); fead.veFeadApplyBadge(a2, b);
    const cw = a2.querySelector('.ve-fead-badge');

    expect(ccw.textContent).toBe('↺ CCW');
    expect(cw.textContent).toBe('↻ CW');
    expect(cw.style.background).toBe(ccw.style.background);   // AYNI renk
    expect(ccw.style.cssText).not.toContain('--accent-warning');
    expect(ccw.style.cssText).not.toContain('--accent-primary');
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
    expect(h).toContain('CCW');
    expect(h).toContain('veFeadToggleSpin()');
    expect(h).toContain('ÖNDEN bakış');            // bakış açısı YAZILI olmalı
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
