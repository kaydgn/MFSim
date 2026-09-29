// Gates'in kayma koşulunu MFSim köprüsüyle kurar ve dökümü yazar (ÖLÇÜM ARACI, kapı değil).
// jest altında koşar: tests/unit/'e kopyala, KAYMA_DIR'i girdilerin durduğu klasöre ver.
const fs = require('fs');
const G = process.env.KAYMA_DIR;
if (!G) throw new Error('KAYMA_DIR yok: gates-girdi.json + sayisal.json klasörünü ver');
const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = []; global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden; global.componentDefs = componentDefs; global.VE_MODULES = VE_MODULES;
const M = require('../../js/fead-model.js');
Object.keys(M).forEach((k) => { if (global[k] === undefined) global[k] = M[k]; });
global.FEADCore = require('../../js/fead-core.js');
[require('../../js/fead-accessories.js'), require('../../js/fead-tensioners.js'),
 require('../../js/fead-engines.js'), require('../../js/fead-checks.js')]
  .forEach((m) => Object.keys(m).forEach((k) => { if (global[k] === undefined) global[k] = m[k]; }));
const F = global.FEADCore;

const GIRDI = JSON.parse(fs.readFileSync(G + '/gates-girdi.json', 'utf8'));
const SAY = JSON.parse(fs.readFileSync(G + '/sayisal.json', 'utf8'));

const ara = (n, r) => {
  if (!n || !n.length) return null;
  if (r <= n[0][0]) return n[0][1];
  if (r >= n[n.length - 1][0]) return n[n.length - 1][1];
  for (let i = 1; i < n.length; i++) {
    const [a, va] = n[i - 1], [b, vb] = n[i];
    if (a <= r && r <= b) return b > a ? va + (vb - va) * (r - a) / (b - a) : va;
  }
  return null;
};
const temiz = (n) => {                                   // aynı devirde tek değer, sıralı
  const m = new Map();
  (n || []).forEach(([r, v]) => { const k = Math.round(r); if (!m.has(k)) m.set(k, []); m.get(k).push(v); });
  return [...m.entries()].map(([r, vs]) => [r, vs.reduce((a, b) => a + b, 0) / vs.length]).sort((a, b) => a[0] - b[0]);
};

const SURUKLEME = Number(process.env.SURUKLEME || 0);
test('döküm', () => {
  const out = {};
  for (const [ad, g] of Object.entries(GIRDI)) {
    if (ad[0] === '_') continue;
    const pack = M.veFeadExampleNodes(g.ornek);
    const ns = pack.nodes.map((n) => ({ id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)) }));
    global.nodes = ns;
    const build = M.veFeadBuildSystem(ns);
    const sys = build.sys;
    const ex = M.veFeadExampleOf(g.ornek);
    const idOf = {}; ns.forEach((n) => { idOf[n.id] = n; });
    // kasnak anahtarı: düğüm kimliği 'ex-<anahtar>' — sıra build.order
    // kasnak anahtarı: sys sırasındaki kasnağın düğümü (ad üzerinden) → 'ex-<anahtar>'
    const anahtar = sys.pulleys.map((p, i) => {
      const o = build.order[i];
      const id = (o && typeof o === 'object') ? o.id : o;
      const nd = ns.find((x) => x.id === id) || ns.find((x) => (build.byName && build.byName[p.name] && build.byName[p.name].id) === x.id);
      return String(nd ? nd.id : id).replace(/^ex-/, '');
    });
    if (!anahtar.every((k) => (ex.route || []).includes(k))) throw new Error(ad + ' anahtar ' + JSON.stringify(anahtar) + ' order ' + JSON.stringify(build.order).slice(0, 200));
    const geom = F.tensionerState(sys, F.meanRel(sys)).geom;
    const n = sys._n, c = sys._crkIdx, t = sys._tenIdx;
    const pl = sys.pulleys.map((p, i) => ({ key: anahtar[i], contact: geom.pulleys[i].contact,
      wrapDeg: geom.wraps[i] * 180 / Math.PI, rPitch: p.rPitch, speedRatio: F.speedRatio(sys, i) }));
    // atalet: Gates kayma sayfası; yoksa örnek
    const J = {};
    anahtar.forEach((k, i) => {
      const nd = ns.find((x) => String(x.id).replace(/^ex-/, '') === k);
      J[k] = (g.J && g.J[k] != null) ? g.J[k] : ((nd && nd.data && Number(nd.data.inertia)) || 0);
    });
    // yük eğrileri
    const sf = SAY[g._sayisal || ad].sf, pp = SAY[g._sayisal || ad].pp;
    const yukEgri = {};
    if (g.pp && pp && pp.egriler) {
      g.pp.forEach((k, j) => {
        const e = pp.egriler[j];
        const nokta = temiz(e && e.nokta).filter(([r]) => r <= sf.xmax + 1);
        if (nokta.length && Math.max(...nokta.map((a) => a[1])) > 0.5) yukEgri[k] = nokta;
      });
    } else {
      // AG00976: tepe yük sayfası alıntıda yok — çevrim tablosu (DC 95 %) kullanılır
      (ex.solver.duty || []).forEach((d) => Object.entries(d.kwByKey || {}).forEach(([k, kw]) => {
        if (kw > 0.05) (yukEgri[k] = yukEgri[k] || []).push([d.rpm, kw]);
      }));
      Object.keys(yukEgri).forEach((k) => yukEgri[k].sort((a, b) => a[0] - b[0]));
    }
    const yukler = Object.keys(yukEgri);
    const kw = (k, rpm) => {
      const v = ara(yukEgri[k], rpm);
      if (g.birim !== 'Nm') return v;
      const i = anahtar.indexOf(k);
      return v * rpm * pl[i].speedRatio * 2 * Math.PI / 60 / 1000;
    };
    // Gates eğrileri (lejant sırası = kasnak sırası)
    const gates = {};
    anahtar.forEach((k, i) => { gates[k] = temiz(sf.egriler[i] && sf.egriler[i].nokta); });
    const rmin = Math.ceil(Math.min(...anahtar.map((k) => gates[k].length ? gates[k][0][0] : 1e9)) / 25) * 25;
    const rmax = Math.floor(Math.max(...anahtar.map((k) => gates[k].length ? gates[k][gates[k].length - 1][0] : 0)) / 25) * 25;
    const izgara = []; for (let r = rmin; r <= rmax; r += 50) izgara.push(r);
    // kombinasyonlar: ivme {+A, 0, −A} × her yük {%10, %100}
    const kombi = [];
    for (const a of [g.A, 0, -g.A]) {
      const m = yukler.length;
      for (let b = 0; b < (1 << m); b++) {
        const fr = {}; yukler.forEach((k, j) => { fr[k] = (b >> j) & 1 ? 100 : 10; });
        kombi.push({ a, fr });
      }
    }
    const zincir = izgara.map((rpm) => kombi.map(({ a, fr }) => {
      const v = F.beltSpeed(sys, rpm);
      const dT = pl.map((p, i) => {
        if (i === c) return 0;
        // Gates avara ve gergiyi 0,01 kW sürtünme yüküyle giriyor (yük tabloları: TEN 0,01)
        const P = yukler.includes(p.key) ? kw(p.key, rpm) * fr[p.key] / 100 : SURUKLEME;
        const alfa = a * p.speedRatio * 2 * Math.PI / 60;
        return P * 1000 / v + J[p.key] * alfa / (p.rPitch / 1000);
      });
      dT[c] = dT.reduce((s, x, i) => s + (i === c ? 0 : x), 0);
      const T = new Array(n).fill(NaN); T[t] = g.T0;
      for (let j = 1; j < n; j++) { const k = (t + j) % n, pr = (k - 1 + n) % n; T[k] = T[pr] + (k === c ? +1 : -1) * dT[k]; }
      return pl.map((p, i) => [T[(i - 1 + n) % n], T[i]]);
    }));
    // bugünkü MFSim çıktısı (çevrim, kararlı durum, oran tanımı)
    const solv = ns.find((x) => componentDefs[x.type] && componentDefs[x.type].isFeadSolver);
    const R = M.veFeadAnalyze(build, { rows: M.veFeadDutyRows(solv), cylinders: 6 });
    const bugun = {};
    anahtar.forEach((k, i) => { bugun[k] = (R.analysis.duty || []).map((d) => [d.engineRpm, d.slip[i].SF, d.slip[i].tensionRatio]); });
    out[ad] = { ornek: g.ornek, pl, J, T0: g.T0, T0model: sys.designTensionN, A: g.A, yukler, izgara, kombi, zincir,
      gates: Object.fromEntries(anahtar.map((k) => [k, izgara.map((r) => ara(gates[k], r))])), bugun,
      kritik: g.kritik, yukOrnek: Object.fromEntries(yukler.map((k) => [k, izgara.map((r) => kw(k, r))])) };
  }
  fs.writeFileSync(G + (process.env.CIKTI || '/zincir.json'), JSON.stringify(out));
  expect(Object.keys(out).length).toBe(12);
});
