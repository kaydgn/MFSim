/**
 * fead-anim.test.js — KAYIŞ YOLU KARTININ ANİMASYONU
 *
 * Kart artık donmuş bir kesit değil: kayış gidiyor, kasnaklar dönüyor. Şemanın
 * anlattığı üç şey — hangi kasnak ne kadar hızlı, hangisi TERS yönde, kayış ne
 * kadar hızlı — ancak hareketle okunuyor.
 *
 * Buradaki testlerin hepsi ORAN ve FAZ ölçüyor, üslup değil. Sebep: animasyon
 * "akıcı görünüyor" diye doğru olmaz. Yanlış bir işaret ya da kayan bir faz
 * ekranda hâlâ akıcıdır ve şunları sessizce yanlış öğretir:
 *   • kasnak ters yöne dönerse   → sırttan temas eden avaralar yanlış görünür
 *   • kollar dişlerden ayrışırsa → kayış kasnağın üstünde KAYIYOR görünür
 *                                  (V kaburgalı bir tahrikte olmayan bir şey)
 *   • faz her karede sıfırlanırsa→ kayış yerinde titrer, ilerlemez
 *
 * KAPSAM AYRIMI: kinematik (kaç tur/s, ne kadar ağır çekim) fead-model.js'te,
 * faz→geometri (diş nerede, kol hangi açıda) cp-fead.js'te. İkisi ayrı test
 * edilir; ortak nokta ω = v/r özdeşliği ve o burada iki yönden de ölçülüyor.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (!global[k]) global[k] = fead[k]; });
// rAF: testte döngü kendiliğinden dönmesin. Sahte kimlik 0 döndürüyor, yani
// veFeadAnimEnsure "zaten planlı" durumuna geçmiyor ve tick elle sürülebiliyor.
global.requestAnimationFrame = () => 0;

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  document.body.innerHTML = '<div id="ve-canvas"></div>';
});

// ── BMC örneği: gerçek tedarikçi sayfası, 6 kasnak ──────────────────────────
function kurBMC() {
  const pack = veFeadExampleNodes('BMC_FEAD_2026');
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  global.nodes = pack.nodes;
  global.connections = pack.connections;
  const build = veFeadBuildSystem(pack.nodes, pack.connections);
  const layout = pack.nodes.find((n) => n.type === 'fead-layout');
  return { pack, build, layout };
}
const geomOf = (build) => F.tensionerState(build.sys, F.meanRel(build.sys)).geom;

// Kartın ölçek matematiğinin testteki karşılığı (veFeadLayoutSVG ile aynı).
function xformOf(build, W = 420, H = 298) {
  const geom = geomOf(build);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  geom.pulleys.forEach((p) => {
    minX = Math.min(minX, p.c[0] - p.rPitch); maxX = Math.max(maxX, p.c[0] + p.rPitch);
    minY = Math.min(minY, p.c[1] - p.rPitch); maxY = Math.max(maxY, p.c[1] + p.rPitch);
  });
  const pv = build.sys.tensioner && build.sys.tensioner.pivot;
  if (pv) {
    minX = Math.min(minX, pv[0]); maxX = Math.max(maxX, pv[0]);
    minY = Math.min(minY, pv[1]); maxY = Math.max(maxY, pv[1]);
  }
  const pad = 18, ROSE = 54;
  const s = Math.min((W - 2 * pad - ROSE) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
  const offX = pad + ((W - 2 * pad - ROSE) - (maxX - minX) * s) / 2;
  const offY = pad + ((H - 2 * pad) - (maxY - minY) * s) / 2;
  return fead._feadXform(s, offX, offY, minX, maxY);
}

// "M x y L x y" çiftlerini oku — hem diş hem kol yolları bu biçimde.
const parcalar = (d) => [...d.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)]
  .map((m) => ({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] }));

describe('Kinematik — çekirdeğin sayıları, ekranın hızı', () => {
  test('ω·r = v: her kasnağın devri kayış hızıyla TAM tutarlı', () => {
    const { build } = kurBMC();
    const kin = veFeadAnimKinematics(build, 800);
    expect(kin).not.toBeNull();
    kin.revPerSec.forEach((rev, i) => {
      const cevresel = rev * 2 * Math.PI * (build.sys.pulleys[i].rPitch / 1000);
      expect(cevresel).toBeCloseTo(kin.beltMs, 9);
    });
  });

  test('ağır çekim katsayısı REFERANS devre göre sabitlenir (seçici işe yarasın)', () => {
    const { build } = kurBMC();
    const dusuk = veFeadAnimKinematics(build, 800);
    const yuksek = veFeadAnimKinematics(build, 2750);
    // Aynı katsayı: seçili devir katsayıyı değiştirmiyor…
    expect(dusuk.slow).toBeCloseTo(yuksek.slow, 12);
    // …dolayısıyla ekrandaki hız devirle GERÇEKTEN oranlı değişiyor.
    expect(dusuk.dispMmS / yuksek.dispMmS).toBeCloseTo(800 / 2750, 6);
    // Referans devirde en hızlı kasnak tavana oturur (örnekleme sınırı).
    expect(yuksek.refMaxRevPerSec * yuksek.slow).toBeCloseTo(VE_FEAD_ANIM_TARGET_REV_S, 9);
  });

  test('katsayı seçili devre göre normalize EDİLSEYDİ seçici hiçbir şey değiştirmezdi', () => {
    // Bu, yazılmamış olan alternatifin belgesi: her devri kendi tavanına
    // oturtan bir katsayı ekranda AYNI hızı verirdi.
    const { build } = kurBMC();
    const a = veFeadAnimKinematics(build, 800, 800);
    const b = veFeadAnimKinematics(build, 2750, 2750);
    expect(a.dispMmS).toBeCloseTo(b.dispMmS, 6);       // ← istenmeyen davranış
    const c = veFeadAnimKinematics(build, 800);        // gerçek davranış
    const d = veFeadAnimKinematics(build, 2750);
    expect(c.dispMmS).toBeLessThan(d.dispMmS * 0.5);
  });

  test('devir listesi duty tablosundan gelir; tablo boşsa varsayılan İŞARETLİ', () => {
    const { build } = kurBMC();
    const list = veFeadAnimRpmChoices(build);
    expect(list.length).toBeGreaterThan(1);
    expect(list.every((c) => !c.fallback)).toBe(true);
    for (let i = 1; i < list.length; i++) expect(list[i].rpm).toBeGreaterThan(list[i - 1].rpm);

    build.solver.data.duty = [];
    const bos = veFeadAnimRpmChoices(build);
    expect(bos.length).toBe(1);
    expect(bos[0].fallback).toBe(true);
    expect(bos[0].rpm).toBe(VE_FEAD_ANIM_FALLBACK_RPM);
  });

  test('varsayılan devir BASKIN duty satırı; "off" korunur', () => {
    const { build, layout } = kurBMC();
    const baskin = veFeadDutyRows(build.solver)
      .reduce((a, r) => (r.dcPct > a.dcPct ? r : a));
    expect(veFeadAnimRpmOf(build, layout)).toBe(baskin.rpm);
    expect(veFeadAnimRpmOf(build, { data: { animRpm: 'off' } })).toBe('off');
    // Listeden düşmüş bir kayıt sessizce başka bir devre çevrilmez, baskına döner
    expect(veFeadAnimRpmOf(build, { data: { animRpm: 12345 } })).toBe(baskin.rpm);
  });
});

describe('Faz — dişler kayış boyunca yürür', () => {
  test('diş adımı çevreyi TAM böler (kapanışta dikiş yok)', () => {
    const { build } = kurBMC();
    const walk = fead._feadBeltWalk(geomOf(build));
    const T = xformOf(build);
    const step = fead._feadToothStep(walk.l, 7 / T.s);
    expect(walk.l / step).toBeCloseTo(Math.round(walk.l / step), 9);
    expect(Math.abs(step * T.s - 7)).toBeLessThan(0.5);   // hedeften sapma < %8
  });

  test('diş SAYISI faz boyunca sabit (yürüyen kayışta diş belirip kaybolmaz)', () => {
    const { build } = kurBMC();
    const geom = geomOf(build), walk = fead._feadBeltWalk(geom), T = xformOf(build);
    const step = fead._feadToothStep(walk.l, 7 / T.s);
    const sayilar = [];
    for (let k = 0; k < 12; k++) {
      const d = fead._feadTeethPath(walk, geom.sense, step, 3.2 / T.s, (k / 12) * step, T);
      sayilar.push(parcalar(d).length);
    }
    expect(Math.max(...sayilar) - Math.min(...sayilar)).toBe(0);
    expect(sayilar[0]).toBe(Math.round(walk.l / step));
  });

  test('bir adımlık faz, diş desenini BİREBİR kendine getirir (periyot = adım)', () => {
    const { build } = kurBMC();
    const geom = geomOf(build), walk = fead._feadBeltWalk(geom), T = xformOf(build);
    const step = fead._feadToothStep(walk.l, 7 / T.s);
    const a = fead._feadTeethPath(walk, geom.sense, step, 3.2 / T.s, 0, T);
    const b = fead._feadTeethPath(walk, geom.sense, step, 3.2 / T.s, step, T);
    expect(b).toBe(a);
  });

  test('faz artınca dişler kayışın GİDİŞ yönünde ilerler (geriye değil)', () => {
    const { build } = kurBMC();
    const geom = geomOf(build), walk = fead._feadBeltWalk(geom), T = xformOf(build);
    const step = fead._feadToothStep(walk.l, 7 / T.s);
    const dMm = step / 4;
    const sifir = parcalar(fead._feadTeethPath(walk, geom.sense, step, 3.2 / T.s, 0, T));
    const ileri = parcalar(fead._feadTeethPath(walk, geom.sense, step, 3.2 / T.s, dMm, T));
    // İlk açıklık doğrusunun yönü (ekran px'inde)
    const sp = walk.segs[0];
    const ux = (T.tx(sp.x + sp.ux) - T.tx(sp.x));
    const uy = (T.ty(sp.y + sp.uy) - T.ty(sp.y));
    const un = Math.hypot(ux, uy);
    // O doğrunun üstündeki ilk dişi ikisinde de bul, ilerlemeyi yöne PROJEKTE et
    const ilk = (list) => list.find((t) => Math.abs(
      (t.x1 - T.tx(sp.x)) * uy - (t.y1 - T.ty(sp.y)) * ux) / un < 0.2);
    const a = ilk(sifir), b = ilk(ileri);
    const yol = ((b.x1 - a.x1) * ux + (b.y1 - a.y1) * uy) / un;
    expect(yol).toBeGreaterThan(0);                       // İLERİ
    expect(yol).toBeCloseTo(dMm * T.s, 1);                // tam faz kadar
  });
});

describe('Kollar — dönüş hızı ve yönü', () => {
  // Kolun açısı ω = d·v/r ile dönmek ZORUNDA: bu, kayışın kasnak üzerinde
  // KAYMADIĞININ görsel karşılığı. Ayrı bir sayaçtan sürülseydi ekranda akıcı
  // ama yanlış bir mekanizma görünürdü.
  test('kol açısal hızı = d · faz/r (sırttan temas edende TERS yön)', () => {
    const { build } = kurBMC();
    const geom = geomOf(build), walk = fead._feadBeltWalk(geom), T = xformOf(build);
    const arcs = walk.segs.filter((sg) => sg.a === 1);
    // Yol koordinatları 0.01 px'e yuvarlanıyor; en küçük kasnakta kol ucu
    // ekranda ~14 px yarıçapta, yani açı kuantası ~7e-4 rad. Faz bu kuantanın
    // yüzlerce katı seçilir ki ölçülen şey yuvarlama değil DÖNÜŞ olsun.
    const dMm = 20, TOL = 2e-3;
    arcs.forEach((sg, j) => {
      const a0 = parcalar(fead._feadSpokePath(walk, 0, T, j))[0];
      const a1 = parcalar(fead._feadSpokePath(walk, dMm, T, j))[0];
      if (!a0) return;                                   // küçük kasnak: kol yok
      const cx = T.tx(sg.cx), cy = T.ty(sg.cy);
      const ac0 = Math.atan2(a0.y2 - cy, a0.x2 - cx);
      const ac1 = Math.atan2(a1.y2 - cy, a1.x2 - cx);
      let d = ac1 - ac0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      // EKRAN düzleminde y aşağı → mm düzlemindeki CCW dönüş ekranda negatif açı
      expect(Math.abs(d - (-sg.d * (dMm / sg.r)))).toBeLessThan(TOL);
    });
    // BMC'de üç kasnak ileri, üç sırt kasnağı geri dönüyor: yön TEK kaynaktan
    expect(arcs.filter((sg) => sg.d > 0).length).toBe(3);
    expect(arcs.filter((sg) => sg.d < 0).length).toBe(3);
  });

  test('kol ucunun çevresel hızı KAYIŞ hızına eşit (kasnakta kayma yok)', () => {
    const { build } = kurBMC();
    const geom = geomOf(build), walk = fead._feadBeltWalk(geom), T = xformOf(build);
    const arcs = walk.segs.filter((sg) => sg.a === 1);
    const dMm = 40;                       // 0.01 px yuvarlamasının çok üstünde
    arcs.forEach((sg, j) => {
      const a0 = parcalar(fead._feadSpokePath(walk, 0, T, j))[0];
      if (!a0) return;
      const a1 = parcalar(fead._feadSpokePath(walk, dMm, T, j))[0];
      const cx = T.tx(sg.cx), cy = T.ty(sg.cy);
      const r = Math.hypot(a0.x2 - cx, a0.y2 - cy);
      let d = Math.atan2(a1.y2 - cy, a1.x2 - cx) - Math.atan2(a0.y2 - cy, a0.x2 - cx);
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      // |Δθ|·R_kol = kayışın kat ettiği yol × (R_kol/R_kasnak) → yarıçapa bölünce eşit
      expect(Math.abs(Math.abs(d) * sg.r - dMm) / dMm).toBeLessThan(0.01);
      expect(r).toBeGreaterThan(0);
    });
  });

  test('ekranda çok küçük kalan kasnakta kol çizilmez (kalabalık)', () => {
    const { build } = kurBMC();
    const walk = fead._feadBeltWalk(geomOf(build));
    const kucuk = fead._feadXform(0.05, 0, 0, 0, 0);      // her kasnak < 9 px
    expect(fead._feadSpokePath(walk, 0, kucuk)).toBe('');
    const buyuk = xformOf(build);
    expect(fead._feadSpokePath(walk, 0, buyuk).length).toBeGreaterThan(0);
  });
});

describe('Yayın sözleşmesi — animasyon YALNIZ kanvas kartında', () => {
  test('panel/rapor/dışa aktarma çağrısı STATİK kalır (yük yok, ok var)', () => {
    const { build } = kurBMC();
    const svg = fead.veFeadLayoutSVG(build, 420, 340);    // opts yok = varsayılan
    expect(svg).not.toMatch(/data-fead-anim/);
    expect(svg).not.toMatch(/data-ve="spoke"/);
    expect(svg).toMatch(/data-ve="spin"/);               // dönüş oku yerinde
  });

  test('kart animasyon yükünü ve devir seçicisini taşır', () => {
    const { layout } = kurBMC();
    const html = fead.veFeadLayoutCardHTML(layout);
    expect(html).toMatch(/data-fead-anim=/);
    expect(html).toMatch(new RegExp('data-fead-node="' + layout.id + '"'));
    expect(html).toMatch(/data-ve="spoke"/);
    expect(html).toMatch(/veFeadSetChoice\('[^']+','animRpm'/);
    expect(html).toMatch(/dev\/dk/);
    expect(html).toMatch(/ağır çekim/);
    // Ok ve kol AYNI ANDA çizilmez: iki işaret üst üste binerdi
    expect(html).not.toMatch(/data-ve="spin"/);
  });

  test('"Durgun" seçilince yük hiç üretilmez, donuk şema geri gelir', () => {
    const { layout } = kurBMC();
    layout.data.animRpm = 'off';
    const html = fead.veFeadLayoutCardHTML(layout);
    expect(html).not.toMatch(/data-fead-anim/);
    expect(html).not.toMatch(/data-ve="spoke"/);
    expect(html).toMatch(/data-ve="spin"/);
    expect(html).toMatch(/value="off" selected/);
  });

  test('yük geçerli JSON ve ekran hızı kinematikle aynı sayı', () => {
    const { build, layout } = kurBMC();
    const html = fead.veFeadLayoutCardHTML(layout);
    const raw = /data-fead-anim='([^']+)'/.exec(html);
    expect(raw).not.toBeNull();
    const pay = JSON.parse(raw[1]);
    const kin = veFeadAnimKinematics(build, veFeadAnimRpmOf(build, layout));
    expect(pay.mmS).toBeCloseTo(kin.dispMmS, 3);
    expect(pay.segs.length).toBe(2 * build.order.length);   // açıklık + yay
    // Yürüyüş PITCH yarıçapından geçiyor, yani çevre L_pitch'tir; L_eff ondan
    // tam 2π·h_b kadar kısadır (SPEC §9 özdeşliği, çekirdek testinde de var).
    const g = geomOf(build);
    expect(pay.loop).toBeCloseTo(g.LpitchMm, 1);
    expect(pay.loop - g.LeffMm).toBeCloseTo(2 * Math.PI * F.beltProps(build.sys.belt).hb, 1);
  });

  test('çözülemeyen modelde kart patlamaz, animasyon da denenmez', () => {
    global.nodes = []; global.connections = [];
    const lay = { id: 'lay-x', type: 'fead-layout', def: componentDefs['fead-layout'], data: {} };
    const html = fead.veFeadLayoutCardHTML(lay);
    expect(typeof html).toBe('string');
    expect(html).not.toMatch(/data-fead-anim/);
  });
});

describe('Animatör — durum DOM\'da değil, döngü kendini durdurur', () => {
  function kartKur(layout) {
    document.body.innerHTML = '<div id="ve-canvas"></div>'
      + '<div id="' + layout.id + '" class="ve-node"><div class="ve-node-box">'
      + '<div class="ve-fead-layout-card">' + fead.veFeadLayoutCardHTML(layout)
      + '</div></div></div>';
    return document.querySelector('svg[data-fead-anim]');
  }

  test('kart yokken tick hiçbir şey yapmaz ve döngü biter', () => {
    document.body.innerHTML = '<div id="ve-canvas"></div>';
    expect(fead.veFeadAnimTick(1000)).toBe(0);
  });

  test('tick dişleri ve kolları TAZELER (faz ilerliyor)', () => {
    const { layout } = kurBMC();
    const el = kartKur(layout);
    expect(el).not.toBeNull();
    const rib0 = el.querySelector('[data-ve="rib"]').getAttribute('d');
    const kol0 = el.querySelector('[data-ve="spoke"]').getAttribute('d');
    fead.veFeadAnimTick(0);                 // ilk kare: dt = 0, saat kurulur
    fead.veFeadAnimTick(500);               // yarım saniye
    const rib1 = el.querySelector('[data-ve="rib"]').getAttribute('d');
    const kol1 = el.querySelector('[data-ve="spoke"]').getAttribute('d');
    expect(rib1).not.toBe(rib0);
    expect(kol1).not.toBe(kol0);
    expect(fead.veFeadAnimTick(600)).toBe(1);
  });

  test('faz DÜĞÜM KİMLİĞİNDE durur: kart yeniden kurulunca kayış zıplamaz', () => {
    const { layout } = kurBMC();
    kartKur(layout);
    fead.veFeadAnimTick(0);
    fead.veFeadAnimTick(400);
    const oncesi = document.querySelector('[data-ve="rib"]').getAttribute('d');
    kartKur(layout);                        // saveState → innerHTML yeniden kuruldu
    const el = document.querySelector('svg[data-fead-anim]');
    fead.veFeadAnimApply(el, 0);            // yeniden kurulan kart faz 0'da
    fead.veFeadAnimTick(400.0001);          // dt≈0 → kayıtlı faz geri gelmeli
    expect(el.querySelector('[data-ve="rib"]').getAttribute('d')).toBe(oncesi);
  });

  test('uzun duraklamadan sonra kayış FIRLAMAZ (dt sınırlı)', () => {
    const { layout } = kurBMC();
    const el = kartKur(layout);
    fead.veFeadAnimTick(0);
    fead.veFeadAnimTick(60000);             // sekme bir dakika gizli kaldı
    const spec = JSON.parse(el.getAttribute('data-fead-anim'));
    const a = el.querySelector('[data-ve="rib"]').getAttribute('d');
    // En fazla VE_FEAD_ANIM_MAX_DT kadar ilerlemiş olmalı
    fead.veFeadAnimApply(el, spec.mmS * 0.1);
    expect(el.querySelector('[data-ve="rib"]').getAttribute('d')).toBe(a);
  });
});
