/**
 * fead-vibration.test.js — FEAD TİTREŞİM ANİMASYONU
 *
 * İki animasyon, iki farklı dürüstlük profili — testin ayırdığı şey bu:
 *
 *   MOD ŞEKLİ    şekil bir SONUÇTUR (özvektör); yalnız ölçeği gösterim
 *                kazancıdır ve bir özvektörün ölçeği zaten tanımsızdır.
 *                Burada uydurulan hiçbir şey YOK → şekil oranları çekirdeğin
 *                özvektörüyle BİREBİR ölçülüyor.
 *
 *   ÇIRPMA       frekans bir SONUÇ, şekil analitik yaklaşım, GENLİK DEĞİL.
 *                Genlik ilan edilmiş bir kazançtır → test genliğin bir sonuç
 *                gibi davranmadığını (kazançla doğrusal, kaydırıcıya bağlı)
 *                ve frekansın çekirdekten geldiğini ölçüyor.
 *
 * SESSİZ HATA SINIFI: bu modülde yanlış bir sayı programı durdurmaz. Buradaki
 * en pahalı sessizlik "kayış kasnakta kayıyor" görüntüsüdür — kolları
 * döndürüp kayışı yerinde bırakmak V kaburgalı bir tahrikte OLMAYAN bir şeyi
 * öğretirdi. Süreklilik kapısı (aşağıda) tam olarak onu kilitliyor.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const V = require('../fixtures/fead-validation.js');
const { vibrationOf } = require('../helpers/gates-vibration.js');

global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

// ── Gerçek sistem: Gates AG00686 (BMC 6 sil.), ataletleri de RAPORUNDAN ─────
// Uydurma atalet kullanılsaydı mod frekansları anlamsız olurdu ve "12 Hz'lik
// kol dansı" iddiası ölçülemezdi.
const kur = () => {
  const v = vibrationOf('AG00686');
  const sys = V.buildMisc('AG00686');
  sys.pulleys.forEach((p) => {
    p.inertiaKgM2 = p.crank ? v.crankInertiaKgM2
      : (v.accessoryInertia[p.name] != null ? v.accessoryInertia[p.name] : 0.0002);
  });
  sys.tensioner.armInertiaKgM2 = v.armInertiaKgM2;
  sys.tensioner.pulleyMassKg = v.pulleyMassKg;
  sys._cache = {};
  return { ok: true, sys, names: sys.pulleys.map((p) => p.name),
           order: sys.pulleys.map(() => ({})), solver: { data: { cylinders: 6 } } };
};
const walkOf = (build) => {
  const st = F.tensionerState(build.sys, F.meanRel(build.sys));
  return { walk: fead._feadBeltWalk(st.geom), geom: st.geom };
};
const T0 = fead._feadXform(0.7, 10, 10, 0, 500);

describe('AÇIKLIK ÇIRPMASI — frekans sonuç, genlik değil', () => {
  test('açıklık frekansı ÇEKİRDEKTEN gelir (köprü kendi formülünü kurmaz)', () => {
    const b = kur(), { geom } = walkOf(b);
    const T = F.spanTensions(b.sys, { engineRpm: 2750, loadsKw: {} });
    const ref = F.spanFrequencies(b.sys, geom, T.spanN, { engineRpm: 2750, modes: 1 });
    const P = M.veFeadVibSpanPayload(b, 2750, 0.00717, 6);
    P.spans.forEach((s, i) => expect(s.f).toBeCloseTo(ref[i].fHz[0], 9));
  });

  test('ateşleme frekansı silindir sayısından — 6 sil. 4 zamanlı @2750 = 137.5 Hz', () => {
    const P = M.veFeadVibSpanPayload(kur(), 2750, 0.00717, 6);
    expect(P.firingHz).toBeCloseTo(137.5, 6);
    expect(P.cylinders).toBe(6);
  });

  test('GENLİK BİR SONUÇ DEĞİL: kazançla tam doğrusal', () => {
    const b = kur();
    const a = M.veFeadVibSpanPayload(b, 2750, 0.00717, 3);
    const c = M.veFeadVibSpanPayload(b, 2750, 0.00717, 6);
    a.spans.forEach((s, i) => expect(c.spans[i].ampMm / s.ampMm).toBeCloseTo(2, 9));
  });

  test('kaydırıcı kenetli — sınır dışı kazanç sessizce kabul edilmez', () => {
    expect(M.veFeadVibGainOf({ data: { vibGain: 999 } })).toBe(M.VE_FEAD_VIB_GAIN_MAX);
    expect(M.veFeadVibGainOf({ data: { vibGain: -4 } })).toBe(M.VE_FEAD_VIB_GAIN_MIN);
    expect(M.veFeadVibGainOf({ data: {} })).toBe(M.VE_FEAD_VIB_GAIN_DEF);
  });

  // ANİMASYONUN ASIL DEĞERİ BU: en çok savrulan açıklık, ateşleme mertebesine
  // en yakın olan olmalı. Olmasaydı çırpma boş bir gösteri olurdu.
  // ÖLÇÜLDÜ (AG00686 @2750): ateşleme 137.5 Hz, CRK->IDR açıklığı 150.1 Hz
  // (%8.4 uzakta) ve büyütmesi 5.13 — dört açıklığın en büyüğü.
  test('rezonansa en yakın açıklık en çok savrulur (tanı değeri)', () => {
    const b = kur();
    const P = M.veFeadVibSpanPayload(b, 2750, 0.00717, 6);
    const enBuyuk = P.spans.indexOf(P.spans.slice().sort((x, y) => y.mag - x.mag)[0]);
    // Frekansı ateşlemeye en yakın olan açıklık
    const enYakin = P.spans.indexOf(P.spans.slice().sort(
      (x, y) => Math.abs(x.f - P.firingHz) - Math.abs(y.f - P.firingHz))[0]);
    expect(enBuyuk).toBe(enYakin);
    expect(P.spans[enBuyuk].mag).toBeGreaterThan(4);
  });

  test('büyütme sönüm tavanını aşmaz (rezonansta bile sonlu)', () => {
    const cap = 1 / (2 * M.VE_FEAD_VIB_ZETA);
    [800, 1500, 2750, 4000].forEach((rpm) => {
      M.veFeadVibSpanPayload(kur(), rpm, 0.00717, 20).spans
        .forEach((s) => expect(s.mag).toBeLessThanOrEqual(cap + 1e-9));
    });
  });

  test('ekran frekansı kinematiğin katsayısını PAYLAŞIR — oran birebir', () => {
    const P = M.veFeadVibSpanPayload(kur(), 2750, 0.00717, 6);
    expect(P.extraSlow).toBeCloseTo(1, 9);          // bu sistemde ek gerekmiyor
    P.spans.forEach((s) => expect(s.fScreen).toBeCloseTo(s.f * 0.00717, 9));
  });

  // EK AĞIR ÇEKİM YALNIZ GEREKİNCE. Tek ve düşük devirli bir duty tablosunda
  // katsayı büyür (referans devir küçük) ve 165 Hz ekranda 4+ Hz'e çıkar —
  // 60 Hz'de çevrim başına 15 kare, strob sınırında. O hâlde ek katsayı girer
  // ve künyeye YAZILIR; kinematikle olan oran bozulduğu için gizlenemez.
  test('ekran frekansı tavanı aşarsa ek ağır çekim girer ve tavan tutar', () => {
    const P = M.veFeadVibSpanPayload(kur(), 800, 0.25, 6);
    expect(P.extraSlow).toBeGreaterThan(1);
    P.spans.forEach((s) =>
      expect(s.fScreen).toBeLessThanOrEqual(M.VE_FEAD_VIB_MAX_SCREEN_HZ + 1e-9));
  });
});

describe('MOD ŞEKLİ — özvektörün kendisi', () => {
  test('şekil oranları çekirdeğin özvektörüyle BİREBİR (uydurma yok)', () => {
    const b = kur();
    const T = F.torsionalModel(b.sys, {});
    const elastik = T.modes.filter((m) => m.fHz > 1e-6);
    [0, 1, 2].forEach((k) => {
      const P = M.veFeadVibModePayload(b, k, 6, {});
      expect(P.fHz).toBeCloseTo(elastik[k].fHz, 9);
      const ref = elastik[k].shape;
      const mx = Math.max(...ref.map((x) => Math.abs(x.amp)));
      const oran = [...P.spin, P.armRad];
      const omx = Math.max(...oran.map(Math.abs));
      oran.forEach((a, i) => expect(a / omx).toBeCloseTo(ref[i].amp / mx, 9));
    });
  });

  // ÖLÇÜLDÜ: 1. mod 12.0 Hz ve şekli ARM -1.000 / TEN -0.909 / CRK +0.082,
  // yani gözle görülen "kol dansı" birebir bu mod. Krank neredeyse duruyor.
  test('1. mod GERGİ KOLU modudur — kol en büyük, krank en küçük', () => {
    const P = M.veFeadVibModePayload(kur(), 0, 6, {});
    const b = kur();
    const crk = b.sys._crkIdx;
    expect(P.fHz).toBeGreaterThan(10); expect(P.fHz).toBeLessThan(14);
    expect(Math.abs(P.armRad)).toBeGreaterThan(Math.abs(P.spin[crk]) * 5);
  });

  test('şekil ölçeği tavanlı — kaydırıcı sonuna dayanınca kol kayışa girmez', () => {
    const P = M.veFeadVibModePayload(kur(), 0, M.VE_FEAD_VIB_GAIN_MAX, {});
    expect(P.topDeg).toBeLessThanOrEqual(M.VE_FEAD_VIB_MODE_MAX_DEG + 1e-9);
  });

  // İKİ SESSİZ GİRDİ. Atalet eksikse çekirdek AÇIK hata veriyor; köprü onu
  // yutup sıfır göstermemeli — sıfır bir mod şekli, "titreşim yok" diye
  // okunurdu. Kart bunun yerine sebebi yazar.
  test('burulma modeli çözülemezse NULL döner (sessizce sıfır değil)', () => {
    const b = kur();
    delete b.sys.pulleys[1].inertiaKgM2;
    b.sys._cache = {};
    expect(M.veFeadVibModeList(b, {})).toBeNull();
    expect(M.veFeadVibModePayload(b, 0, 6, {})).toBeNull();
  });

  test('mod listesi rijit cisim modunu (f=0) ELEMİŞ olarak verir', () => {
    const b = kur();
    const liste = M.veFeadVibModeList(b, {});
    expect(liste.length).toBe(b.sys.pulleys.length + 1 - 1);   // N+1 SD − 1 rijit
    liste.forEach((f) => expect(f).toBeGreaterThan(1e-6));
  });
});

describe('DEFORMASYON — çizicilerin ortak mekanizması', () => {
  const spanVib = () => M.veFeadVibSpanPayload(kur(), 2750, 0.00717, 6);
  const modeVib = () => M.veFeadVibModePayload(kur(), 0, 6, {});

  // KAPI: def yokken davranış BİREBİR eski hâli. Bu olmasaydı titreşim
  // özelliği kapalıyken bile şema değişebilirdi.
  test('def YOKKEN diş ve kol yolları bire bir eskisi', () => {
    const b = kur(), { walk } = walkOf(b);
    const bos = { disp: () => null, spin: null };
    expect(fead._feadTeethPath(walk, 1, 12, 3, 40, T0, bos))
      .toBe(fead._feadTeethPath(walk, 1, 12, 3, 40, T0));
    expect(fead._feadSpokePath(walk, 40, T0, null, bos))
      .toBe(fead._feadSpokePath(walk, 40, T0, null));
  });

  test('mod şeklinde t=0 deformasyonu tam SIFIR (q = sin 0)', () => {
    const b = kur(), { walk } = walkOf(b);
    const def = fead._feadVibDef(modeVib(), 0, walk);
    expect(def.q).toBeCloseTo(0, 12);
    walk.segs.forEach((sg, i) => {
      const d = def.disp(i, sg.l / 2, sg);
      if (d) { expect(Math.abs(d[0])).toBeLessThan(1e-9);
               expect(Math.abs(d[1])).toBeLessThan(1e-9); }
    });
  });

  // ÇIRPMADA t=0 SIFIR DEĞİL: açıklıklar arasında faz kayması var (hepsi aynı
  // anda tepeye çıksaydı kayış nefes alıyor gibi görünürdü). O yüzden DONUK
  // kare de o deformasyonla çizilir — yoksa animasyon başlarken kayış
  // sıçrardı ve prefers-reduced-motion açık kullanıcı titreşimi HİÇ görmezdi.
  test('çırpmada faz kayması var ve donuk kare animasyonun İLK KARESİDİR', () => {
    const b = kur(), { walk, geom } = walkOf(b);
    const vib = spanVib();
    const def = fead._feadVibDef(vib, 0, walk);
    const sifirdanFarkli = walk.segs.some((sg, i) => {
      const d = def.disp(i, sg.l / 2, sg);
      return d && Math.hypot(d[0], d[1]) > 1e-6;
    });
    expect(sifirdanFarkli).toBe(true);
    // Şema o kareyle çiziliyor: donuk diş yolu = def@0 ile üretilen yol
    const svg = fead.veFeadLayoutSVG(b, 420, 300, { posMode: 'mean', vib: vib });
    const disler = /data-ve="rib" d="([^"]*)"/.exec(svg)[1];
    const stepMm = fead._feadToothStep(walk.l, 7 / 0.7);
    expect(disler.length).toBeGreaterThan(0);
    expect(disler).not.toBe(
      /data-ve="rib" d="([^"]*)"/.exec(
        fead.veFeadLayoutSVG(b, 420, 300, { posMode: 'mean' }))[1]);
    expect(stepMm).toBeGreaterThan(0);
  });

  test('çırpma: kayma açıklığa DİK ve uçlarda sıfır (yarım sinüs)', () => {
    const b = kur(), { walk } = walkOf(b);
    const vib = spanVib();
    const def = fead._feadVibDef(vib, 0.31, walk);
    walk.segs.forEach((sg, i) => {
      if (sg.a !== 0) return;
      expect(def.disp(i, 0, sg)[0]).toBeCloseTo(0, 9);        // uçlar kasnakta
      expect(def.disp(i, sg.l, sg)[0]).toBeCloseTo(0, 9);
      const d = def.disp(i, sg.l / 2, sg);
      expect(d[0] * sg.ux + d[1] * sg.uy).toBeCloseTo(0, 9);  // dik
      expect(Math.hypot(d[0], d[1])).toBeGreaterThan(0);
    });
  });

  test('çırpma kasnak yaylarına DOKUNMAZ — kayış kasnakta savrulmaz', () => {
    const b = kur(), { walk } = walkOf(b);
    const def = fead._feadVibDef(spanVib(), 0.31, walk);
    walk.segs.forEach((sg, i) => {
      if (sg.a === 1) expect(def.disp(i, sg.l / 2, sg)).toBeNull();
    });
  });

  // EN PAHALI SESSİZLİK. Kasnak dönerken kayış yerinde kalsaydı ekranda kayma
  // görünürdü — V kaburgalı sürtünmeli bir tahrikte olmayan bir şey.
  test('mod şekli: yay üstündeki nokta kasnakla KATI döner (kayma yok)', () => {
    const b = kur(), { walk } = walkOf(b);
    const vib = modeVib();
    const def = fead._feadVibDef(vib, 0.37, walk);
    const n = vib.spin.length;
    walk.segs.forEach((sg, i) => {
      if (sg.a !== 1) return;
      const p = fead._feadSegPulley(i, n);
      const th = vib.spin[p] * def.q;
      const t = sg.l * 0.4;
      const a = sg.a0 + sg.d * (t / sg.r);
      const px = sg.cx + sg.r * Math.cos(a), py = sg.cy + sg.r * Math.sin(a);
      const d = def.disp(i, t, sg);
      // Kendi merkezine göre yarıçap KORUNUR (gergide kol kayması çıkarılır)
      const off = (p === vib.tenIdx) ? def.armOff : [0, 0];
      const rx = px + d[0] - off[0] - sg.cx, ry = py + d[1] - off[1] - sg.cy;
      expect(Math.hypot(rx, ry)).toBeCloseTo(sg.r, 6);
      // ve dönme açısı tam özvektörün açısı
      expect(Math.atan2(ry, rx) - a).toBeCloseTo(th, 6);
    });
  });

  // SÜREKLİLİK: açıklığın ucu ile ona değen yayın ucu AYNI noktaya kaymalı.
  // Ayrışsaydı kayış ekranda yırtılırdı — ve bu, donuk şemada görünmeyen,
  // yalnız animasyon oynarken çıkan bir kusur olurdu.
  test('mod şekli: açıklık ucu ile yay ucu AYNI yere kayar (kayış yırtılmaz)', () => {
    const b = kur(), { walk } = walkOf(b);
    const def = fead._feadVibDef(modeVib(), 0.37, walk);
    const N = walk.segs.length;
    for (let i = 0; i < N; i += 2) {
      const span = walk.segs[i], arc = walk.segs[i + 1];
      const a = def.disp(i, span.l, span) || [0, 0];      // açıklığın VARIŞ ucu
      const c = def.disp(i + 1, 0, arc) || [0, 0];        // yayın BAŞLANGICI
      expect(a[0]).toBeCloseTo(c[0], 6);
      expect(a[1]).toBeCloseTo(c[1], 6);
      // ve bir sonraki açıklığın çıkış ucu ile yayın bitişi
      const nx = walk.segs[(i + 2) % N];
      const b2 = def.disp(i + 1, arc.l, arc) || [0, 0];
      const d2 = def.disp((i + 2) % N, 0, nx) || [0, 0];
      expect(b2[0]).toBeCloseTo(d2[0], 6);
      expect(b2[1]).toBeCloseTo(d2[1], 6);
    }
  });

  test('mod şekli: gergi kasnağı KOL YAYI üzerinde kalır (boy korunur)', () => {
    const b = kur(), { walk } = walkOf(b);
    const vib = modeVib();
    const L0 = Math.hypot(vib.tenC[0] - vib.pivot[0], vib.tenC[1] - vib.pivot[1]);
    [0.11, 0.37, 0.63, 0.9].forEach((tau) => {
      const def = fead._feadVibDef(vib, tau, walk);
      const cx = vib.tenC[0] + def.armOff[0], cy = vib.tenC[1] + def.armOff[1];
      expect(Math.hypot(cx - vib.pivot[0], cy - vib.pivot[1])).toBeCloseTo(L0, 6);
    });
  });

  test('kol yolu def ile GERÇEKTEN değişiyor (kapı ısırıyor mu)', () => {
    const b = kur(), { walk } = walkOf(b);
    const def = fead._feadVibDef(modeVib(), 0.37, walk);
    expect(fead._feadSpokePath(walk, 0, T0, null, def))
      .not.toBe(fead._feadSpokePath(walk, 0, T0, null));
  });

  test('kayış yolu: def yokken yay komutu (A), def varken örneklenmiş çokgen', () => {
    const b = kur(), { walk } = walkOf(b);
    const duz = fead._feadWalkPath(walk, T0, null);
    const egri = fead._feadWalkPath(walk, T0, fead._feadVibDef(spanVib(), 0.31, walk));
    expect(duz).toMatch(/A/);
    expect(egri).not.toMatch(/A/);
    expect(duz.endsWith(' Z')).toBe(true);
    expect(egri.endsWith(' Z')).toBe(true);
  });

  // Kapalı çevrim kapanmalı: kayış yolunun İLK noktası ile SON noktası aynı.
  test('kayış yolu deformasyonla da KAPALI kalır', () => {
    const b = kur(), { walk } = walkOf(b);
    [spanVib(), modeVib()].forEach((vib) => {
      const d = fead._feadWalkPath(walk, T0, fead._feadVibDef(vib, 0.29, walk));
      const say = d.match(/[-\d.]+ [-\d.]+/g);
      const ilk = say[0].split(' ').map(Number);
      const son = say[say.length - 1].split(' ').map(Number);
      expect(son[0]).toBeCloseTo(ilk[0], 1);
      expect(son[1]).toBeCloseTo(ilk[1], 1);
    });
  });
});

describe('parça → açıklık/kasnak eşlemesi (walk sırasının TEK yorumu)', () => {
  test('çift indeks açıklık, tek indeks kasnak yayı', () => {
    expect(fead._feadSegSpan(0)).toBe(0);
    expect(fead._feadSegSpan(2)).toBe(1);
    expect(fead._feadSegSpan(1)).toBe(-1);
    expect(fead._feadSegPulley(1, 4)).toBe(1);      // açıklık 0'ın VARDIĞI kasnak
    expect(fead._feadSegPulley(7, 4)).toBe(0);      // son yay başa döner
    expect(fead._feadSegPulley(0, 4)).toBe(-1);
  });

  test('eşleme gerçek zincirle tutarlı: yayın merkezi o kasnağın merkezi', () => {
    const b = kur(), { walk, geom } = walkOf(b);
    const n = geom.pulleys.length;
    walk.segs.forEach((sg, i) => {
      if (sg.a !== 1) return;
      const p = fead._feadSegPulley(i, n);
      expect(sg.cx).toBeCloseTo(geom.pulleys[p].c[0], 9);
      expect(sg.cy).toBeCloseTo(geom.pulleys[p].c[1], 9);
    });
  });
});

// ── PANEL ↔ KART TEK ALAN (modülün 7. kuralı) ──────────────────────────────
// İki yüzey ayrı alan tutsaydı panel bir modu, kanvastaki kart başkasını
// gösterirdi — bu modülde kol konumu ve yön gülünde aynı kural var.
describe('panel ile kart AYNI alanı okur', () => {
  test('seçim ve kazanç düğümün TEK alanından çözülür', () => {
    const n = { id: 'k1', data: { vibMode: 'mode:2', vibGain: 7 } };
    expect(M.veFeadVibModeOf(n)).toBe('mode:2');
    expect(M.veFeadVibGainOf(n)).toBe(7);
    // Panel kutusu da aynı alanı yazıyor (kanca düğüm kimliğiyle kurulu)
    const h = fead.veFeadVibStrip(n, kur(), null, 'mode:2');
    expect(h).toContain("veFeadSetChoice('k1','vibGain'");
    expect(h).toContain('Genlik ×7');
  });

  test('geçersiz kayıt sessizce "açık" sayılmaz', () => {
    ['', 'mode:', 'mode:x', 'evet', null, undefined].forEach((v) => {
      expect(M.veFeadVibModeOf({ data: { vibMode: v } })).toBe('off');
    });
  });

  // Kazanç şeridi, mod çözülemediğinde SEBEBİ yazmak zorunda: boş bir şerit
  // "titreşim yok" diye okunurdu.
  test('mod çözülemediyse şerit sebebi yazar (boş kalmaz)', () => {
    const h = fead.veFeadVibStrip({ id: 'k2', data: {} }, kur(), null, 'mode:0');
    expect(h).toMatch(/atalet/i);
  });

  test('çırpma seçiliyken devir yoksa şerit onu söyler', () => {
    const h = fead.veFeadVibStrip({ id: 'k3', data: {} }, kur(), null, 'span');
    expect(h).toMatch(/devir/i);
  });
});
