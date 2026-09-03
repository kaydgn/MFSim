/**
 * fead-transient.test.js — FEAD GEÇİCİ REJİM (motor çevrimi senaryosu)
 *
 * Bu modülün TEK ÖNEMLİ SORUSU: hangi sayı türetildi, hangisi dayatıldı?
 * Devir geçmişi SİMÜLE EDİLMİYOR — MFSim'de volan ataleti yok ve modeldeki
 * "krank ataleti" burulma modelinin ataleti (BMC 0.70 kg·m²); onunla integre
 * etmek 15.000 d/dk/s verirdi, gerçeği 1000–2000. Bu yüzden rampa kullanıcının
 * ZATEN girdiği ivmeden gelir, ŞEKLİ motorun tork eğrisinden. Testler bu
 * ayrımı ve dört sessiz tuzağı kilitliyor.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const E = require('../../js/fead-engines.js');
const F = require('../../js/fead-core.js');
const V = require('../fixtures/fead-validation.js');
const { vibrationOf } = require('../helpers/gates-vibration.js');

global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(E).forEach((k) => { global[k] = E[k]; });
const TR = require('../../js/fead-transient.js');
Object.keys(TR).forEach((k) => { global[k] = TR[k]; });

// Gerçek sistem + GERÇEK ataletler (Gates raporundan) + gerçek bir yük eğrisi.
// Ataletsiz kurulan bir senaryoda ivme terimi sıfır çıkar ve testler "doğru
// sebepten değil, hiçbir şey olmadığı için" yeşile döner.
const kur = (sd) => {
  const v = vibrationOf('AG00686');
  const sys = V.buildMisc('AG00686');
  sys._cache = {};
  const order = sys.pulleys.map((p) => ({ data: {
    inertia: p.crank ? 0.064
      : (v.accessoryInertia[p.name] != null ? v.accessoryInertia[p.name] : 0.002)
  } }));
  const ai = sys.pulleys.findIndex((p) => p.name === 'A_C');
  order[ai].data.pwrCurve = [
    { rpm: 800, kw: 1.2 }, { rpm: 1500, kw: 2.6 },
    { rpm: 3000, kw: 5.2 }, { rpm: 6000, kw: 9.0 }
  ];
  return { ok: true, sys, names: sys.pulleys.map((p) => p.name), order,
    solver: { data: Object.assign({
      cylinders: 6, idleRpm: 700, governedRpm: 2600,
      accelRpmS: 1100, decelRpmS: 900, engineLib: '57RS303251'
    }, sd || {}) } };
};

describe('devir geçmişi — DAYATILMIŞ, ve bunu söylüyor', () => {
  test('senaryo sıfırdan başlar, sıfırda biter ve fazlar sırayla dizilir', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    expect(scn.ph.map((p) => p.k)).toEqual(
      ['off', 'crank', 'fire', 'idle', 'accel', 'hold', 'decel', 'idle2', 'stop']);
    for (let i = 1; i < scn.ph.length; i++)
      expect(scn.ph[i].t0).toBeCloseTo(scn.ph[i-1].t1, 9);
    expect(scn.ph[scn.ph.length - 1].t1).toBeCloseTo(scn.T, 3);
    expect(TR.veFeadScnStateAt(scn, 0).rpm).toBeCloseTo(0, 6);
    expect(TR.veFeadScnStateAt(scn, scn.T - 1e-6).rpm).toBeLessThan(60);
  });

  test('devir SÜREKLİ — faz sınırlarında sıçrama yok', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    scn.ph.forEach((p) => {
      if (p.t1 >= scn.T) return;
      const a = TR.veFeadScnStateAt(scn, p.t1 - 0.02).rpm;
      const b = TR.veFeadScnStateAt(scn, p.t1 + 0.02).rpm;
      expect(Math.abs(b - a)).toBeLessThan(80);     // 0.04 s'de en çok ~80 d/dk
    });
  });

  test('senaryo DÖNGÜSEL: t ile t+T aynı durum', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    [0.4, 3.1, 5.7, 9.2].forEach((t) => {
      const a = TR.veFeadScnStateAt(scn, t), b = TR.veFeadScnStateAt(scn, t + scn.T);
      expect(b.rpm).toBeCloseTo(a.rpm, 6);
      expect(b.faz).toBe(a.faz);
    });
  });

  // KAPI: dayatılmış olanı dayatılmış diye YAZMAK zorunda. Yazmasaydı kullanıcı
  // marş devrini ve yavaşlamayı ölçülmüş sanardı.
  test('dayatılan üç şey notlarda AÇIKÇA yazılı', () => {
    const n = TR.veFeadScenarioBuild(kur(), {}).notlar.join(' | ');
    expect(n).toMatch(/DAYATILMI[ŞS]/);
    expect(n).toMatch(/marş|Marş/);
    expect(n).toMatch(/gergi kolu dinamiği/i);
  });

  test('ivme girilmemişse varsayıldığını söyler', () => {
    const n = TR.veFeadScenarioBuild(kur({ accelRpmS: 0 }), {}).notlar.join(' | ');
    expect(n).toMatch(/varsay/i);
  });
});

describe('rampa ŞEKLİ — motorun kendi tork eğrisinden', () => {
  // KAPI FAZIN İÇİNİ ÖLÇER, uçlarını değil. İlk yazımda uç noktalara bakıyordu
  // ve faz sınırındaki yumuşama zaten α'yı düşürdüğü için şekillendirmeyi
  // TAMAMEN kaldıran bir mutasyon TESTTEN GEÇİYORDU. Şekil o sırada gerçekten
  // etkisizdi de (bkz. wAt'ın üstündeki not): oran yerine mutlak tork
  // kullanılınca ISB6.7'de faz içi α 752 → 1100 d/dk/s oluyor.
  test('eğri varsa ivme faz İÇİNDE şekilleniyor (düşük devirde tork az)', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    const acc = scn.ph.find((p) => p.k === 'accel');
    const ic = [];
    for (let i = 15; i <= 85; i += 10)
      ic.push(TR.veFeadScnStateAt(scn, acc.t0 + (acc.t1 - acc.t0) * i / 100).alpha);
    const enB = Math.max.apply(null, ic), enK = Math.min.apply(null, ic);
    expect(enK).toBeGreaterThan(0);
    expect(enB / enK).toBeGreaterThan(1.15);       // ölçülen 1.46
    // Rölantiden hemen sonra platodan YAVAŞ: tork eğrisinin kendi şekli
    expect(ic[0]).toBeLessThan(enB * 0.9);
  });

  // Şekillendirme SÜREYİ de uzatır (α ≤ ilan edilen tepe ivme). Ölçülen %14.6.
  test('şekilli rampa doğrusaldan UZUN sürer', () => {
    const sure = (b) => { const s = TR.veFeadScenarioBuild(b, {});
      const p = s.ph.find((x) => x.k === 'accel'); return p.t1 - p.t0; };
    const egrili = sure(kur()), duz = sure(kur({ engineLib: '' }));
    expect(egrili).toBeGreaterThan(duz * 1.05);
  });

  test('eğri YOKSA rampa doğrusal ve kart bunu YAZAR', () => {
    const scn = TR.veFeadScenarioBuild(kur({ engineLib: '' }), {});
    expect(scn.egri).toBe(false);
    expect(scn.notlar.join(' ')).toMatch(/DO[ĞG]RUSAL/);
    const acc = scn.ph.find((p) => p.k === 'accel');
    const ic = [];
    for (let i = 15; i <= 85; i += 10)
      ic.push(TR.veFeadScnStateAt(scn, acc.t0 + (acc.t1 - acc.t0) * i / 100).alpha);
    expect(Math.max.apply(null, ic) / Math.min.apply(null, ic)).toBeLessThan(1.02);
  });

  test('hızlanma süresi ivmeyle ters orantılı (büyüklük KULLANICININ)', () => {
    const sure = (a) => {
      const s = TR.veFeadScenarioBuild(kur({ accelRpmS: a }), {});
      const p = s.ph.find((x) => x.k === 'accel');
      return p.t1 - p.t0;
    };
    expect(sure(550) / sure(1100)).toBeCloseTo(2, 1);
  });

  test('tork aradeğerlemesi uçlarda kenetlenir', () => {
    const c = [{ rpm: 1000, nm: 500 }, { rpm: 2000, nm: 900 }];
    expect(TR.veFeadScnTorqueAt(c, 500)).toBe(500);
    expect(TR.veFeadScnTorqueAt(c, 3000)).toBe(900);
    expect(TR.veFeadScnTorqueAt(c, 1500)).toBeCloseTo(700, 9);
  });
});

describe('gerilme — çekirdekle BİREBİR, animatörde yeniden kurulur', () => {
  // TASARIM DAYANAĞI: T(N,α) = A(N) + α·B(N) TAM doğrusal olduğu için iki
  // devir ızgarası yeterli ve animatör kare başına çözücü koşturmuyor.
  // Doğrusallık bozulursa yük yanlış gerilme üretir ve kimse fark etmez.
  test('ızgara noktalarında çekirdeğin peakEstimate\'i BİREBİR yeniden kurulur', () => {
    const build = kur();
    const scn = TR.veFeadScenarioBuild(build, {});
    const J = TR.veFeadScnInertias(build);
    scn.gRpm.forEach((N, gi) => {
      const kw = TR.veFeadScnLoadsAt(build, N, scn.idle);
      [0, 300, 1100, -900].forEach((al) => {
        const yon = al >= 0 ? 'accel' : 'decel';
        const ref = F.peakEstimate(build.sys, {
          engineRpm: N, accelRpmS: Math.abs(al), loadsKw: kw, inertias: J })[yon].spanN;
        scn.gA[gi].forEach((A, k) => {
          // BÜTÇE YÜKÜN YUVARLAMASI: gA 1e-4 N, gB 1e-6 N/(d/dk·s) ile
          // yuvarlanıyor (attribute boyutu için). 3000 d/dk/s'lik bir ivmede
          // bu en çok ~3e-3 N eder — 790 N'luk bir gerilmede 4e-6 bağıl.
          // Daha dar bir eşik yuvarlamayı kusur sanardı, daha geniş olan
          // gerçek bir sapmayı kaçırırdı.
          const butce = 1e-4 + Math.abs(al) * 1e-6;
          expect(Math.abs(A + al * scn.gB[gi][k] - ref[k])).toBeLessThan(butce + 1e-9);
        });
      });
    });
  });

  test('ivme gerilmeyi ARTIRIR, yavaşlama AZALTIR (yön tersine döner)', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    const acc = scn.ph.find((p) => p.k === 'accel');
    const dec = scn.ph.find((p) => p.k === 'decel');
    const idl = scn.ph.find((p) => p.k === 'idle');
    const sI = TR.veFeadScnStateAt(scn, (idl.t0 + idl.t1) / 2);
    const sA = TR.veFeadScnStateAt(scn, acc.t0 + (acc.t1 - acc.t0) * 0.4);
    const sD = TR.veFeadScnStateAt(scn, dec.t0 + (dec.t1 - dec.t0) * 0.4);
    expect(sA.alpha).toBeGreaterThan(0);
    expect(sD.alpha).toBeLessThan(0);
    expect(sA.Tmax).toBeGreaterThan(sI.Tmax * 1.05);
    expect(sD.Tmin).toBeLessThan(sI.Tmin * 0.97);
  });

  // DÖRDÜNCÜ SESSİZ TUZAK. Sabit güç P/v'yi patlatıyor (ölçüldü: 41.927 N),
  // sabit tork duran motorda yük iddia ediyor. Kural: kuvvet devirle orantılı.
  test('duran motorda aksesuar yükü SIFIR — ve hiçbir devirde patlamıyor', () => {
    const build = kur();
    const scn = TR.veFeadScenarioBuild(build, {});
    const sifir = TR.veFeadScnLoadsAt(build, 0, scn.idle);
    Object.keys(sifir).forEach((k) => expect(sifir[k]).toBe(0));
    // Yük rölantiye kadar TEK YÖNLÜ artar ve rölantide eğrinin değerine oturur
    const tam = TR.veFeadScnLoadsAt(build, scn.idle, scn.idle);
    let onceki = -1;
    [0, 100, 250, 400, 550, 700].forEach((N) => {
      const L = TR.veFeadScnLoadsAt(build, N, scn.idle);
      const top = Object.keys(L).reduce((a, k) => a + L[k], 0);
      expect(top).toBeGreaterThanOrEqual(onceki - 1e-9);
      onceki = top;
    });
    expect(Object.keys(tam).reduce((a, k) => a + tam[k], 0)).toBeGreaterThan(0);
    // Ve senaryonun hiçbir anında gerilme saçmalamıyor
    for (let i = 0; i <= 400; i++) {
      const s = TR.veFeadScnStateAt(scn, scn.T * i / 400);
      s.spanN.forEach((T) => { expect(Number.isFinite(T)).toBe(true);
                               expect(Math.abs(T)).toBeLessThan(1e4); });
    }
  });

  test('durgun kayışta gerilme tasarım gerginliğine oturur', () => {
    const build = kur();
    const scn = TR.veFeadScenarioBuild(build, {});
    const s = TR.veFeadScnStateAt(scn, 0);
    s.spanN.forEach((T) => expect(T).toBeCloseTo(build.sys.designTensionN, 0));
  });
});

describe('rezonans süpürmesi — animasyonun asıl olayı', () => {
  test('bir motor çevriminde açıklıklar ateşleme mertebelerini GERÇEKTEN kesiyor', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    const gecis = {};
    let onceki = {};
    for (let i = 0; i <= 3000; i++) {
      const s = TR.veFeadScnStateAt(scn, scn.T * i / 3000);
      s.spanF.forEach((f, k) => {
        for (let ord = 1; ord <= 4; ord++) {
          const key = k + ':' + ord;
          const yakin = f > 0 && s.firingHz > 0 && Math.abs(ord * s.firingHz - f) / f < 0.02;
          if (yakin && !onceki[key]) gecis[key] = (gecis[key] || 0) + 1;
          onceki[key] = yakin;
        }
      });
    }
    // Dört açıklık × üç mertebe, çıkışta ve inişte — yirmiden fazla geçiş
    expect(Object.keys(gecis).length).toBeGreaterThanOrEqual(8);
    const toplam = Object.keys(gecis).reduce((a, k) => a + gecis[k], 0);
    expect(toplam).toBeGreaterThanOrEqual(16);
  });

  // İVME GERİLMEYİ DEĞİŞTİRDİĞİ İÇİN aynı mertebe ÇIKIŞTA ve İNİŞTE farklı
  // devirde kesiliyor. Bu bir kusur değil modelin sonucu; kaybolursa ivmenin
  // gerilmeye bağlanması kopmuş demektir.
  test('aynı kesişme çıkışta ve inişte FARKLI devirde olur (ivme histerezisi)', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    const bul = (fazK) => {
      const p = scn.ph.find((x) => x.k === fazK);
      let en = null;
      for (let i = 0; i <= 1200; i++) {
        const t = p.t0 + (p.t1 - p.t0) * i / 1200;
        const s = TR.veFeadScnStateAt(scn, t);
        const f = s.spanF[0];
        if (!(f > 0) || !(s.firingHz > 0)) continue;
        const d = Math.abs(2 * s.firingHz - f) / f;
        if (!en || d < en.d) en = { d: d, rpm: s.rpm };
      }
      return en;
    };
    const yukari = bul('accel'), asagi = bul('decel');
    expect(yukari.d).toBeLessThan(0.02);
    expect(asagi.d).toBeLessThan(0.02);
    expect(Math.abs(yukari.rpm - asagi.rpm)).toBeGreaterThan(40);
  });

  test('uyarma yoksa çırpma da yok — durgun kayış sallanmaz', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    const spec = { slow: 0.007 };
    const vib = { gain: 10, zeta: 0.06, spans: scn.L.map(() => ({ ph: 0 })) };
    const durgun = fead._feadScnVibLive(spec, TR.veFeadScnStateAt(scn, 0), vib);
    durgun.spans.forEach((s) => expect(s.ampMm).toBe(0));
    const idl = scn.ph.find((p) => p.k === 'idle');
    const calisir = fead._feadScnVibLive(
      spec, TR.veFeadScnStateAt(scn, (idl.t0 + idl.t1) / 2), vib);
    expect(Math.max.apply(null, calisir.spans.map((s) => s.ampMm))).toBeGreaterThan(0);
  });

  test('gösterge rezonansı ADIYLA yazar', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    let bulundu = null;
    for (let i = 0; i <= 1500 && !bulundu; i++) {
      const s = TR.veFeadScnStateAt(scn, scn.T * i / 1500);
      if (fead._feadScnRezonans(s)) bulundu = fead._feadScnHud(scn, s);
    }
    expect(bulundu).toMatch(/REZONANS/);
    expect(bulundu).toMatch(/mertebe/);
    expect(bulundu).toMatch(/dev\/dk/);
  });
});

// ── EN PAHALI KUSUR: YÜK ATTRIBUTE'A SIĞMIYORDU ────────────────────────────
// Animasyon yükü tek tırnaklı bir attribute'a yazılıyordu ve kodda "JSON yalnız
// sayı taşır, içinde tek tırnak geçemez" diye YAZILI bir varsayım vardı.
// Senaryo metin getirdi ("MFSim'de marş...") ve o tırnak attribute'ü 7573.
// karakterde kapattı: JSON.parse patladı, animasyon SESSİZCE hiç kurulmadı —
// kart donuk kaldı, konsola tek satır düşmedi. Bu blok o sessizliğin kapısı.
describe('animasyon yükü attribute\'tan sağ çıkar', () => {
  const cozGeri = (svg) => {
    const m = /data-fead-anim="([^"]*)"/.exec(svg);
    if (!m) return null;
    const ham = m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return JSON.parse(ham);
  };

  test('senaryolu yük ayrıştırılabiliyor ve içeriği yerinde', () => {
    const build = kur();
    const scn = TR.veFeadScenarioBuild(build, {});
    const svg = fead.veFeadLayoutSVG(build, 440, 458,
      { posMode: 'mean', scn: fead._feadScnSlim(scn),
        animate: { dispMmS: 0, slow: 0.007, label: 'x' } });
    const pay = cozGeri(svg);
    expect(pay).not.toBeNull();
    expect(pay.scn.ph.length).toBe(scn.ph.length);
    expect(pay.scn.rpm.length).toBe(scn.rpm.length);
    expect(pay.slow).toBeCloseTo(0.007, 6);
  });

  // Kapı yalnız BUGÜNKÜ metne bakmasın: içine kesme işareti ve çift tırnak
  // KOYARAK zorluyoruz. Kaçışlama kalkarsa bu test kırmızıya döner.
  test('içinde tek ve çift tırnak olan metin de sağ çıkar', () => {
    const build = kur();
    const scn = fead._feadScnSlim(TR.veFeadScenarioBuild(build, {}));
    scn.adlar = scn.adlar.map((a, i) => (i === 0 ? "MFSim'de \"Avara\" → Krank" : a));
    scn.ph[0].ad = "Durgun 'test'";
    const svg = fead.veFeadLayoutSVG(build, 440, 458,
      { posMode: 'mean', scn: scn, animate: { dispMmS: 0, slow: 0.007, label: 'x' } });
    const pay = cozGeri(svg);
    expect(pay).not.toBeNull();
    expect(pay.scn.adlar[0]).toBe("MFSim'de \"Avara\" → Krank");
    expect(pay.scn.ph[0].ad).toBe("Durgun 'test'");
  });

  // Notlar kullanıcı metnidir; kare başına okunmaz ve yükte DURMAZ.
  test('notlar yüke GİRMEZ (en uzun metin alanı)', () => {
    const scn = TR.veFeadScenarioBuild(kur(), {});
    expect(scn.notlar.length).toBeGreaterThan(0);
    expect(fead._feadScnSlim(scn).notlar).toBeUndefined();
    expect(Object.keys(fead._feadScnSlim(scn)).sort())
      .toEqual(Object.keys(scn).filter((k) => k !== 'notlar').sort());
  });

  test('yük makul boyutta kalıyor (kare başına okunmasa da DOM\'da duruyor)', () => {
    const scn = fead._feadScnSlim(TR.veFeadScenarioBuild(kur(), {}));
    expect(JSON.stringify(scn).length).toBeLessThan(12 * 1024);
  });
});

describe('girdiler MFSim\'in ZATEN sorduğu alanlardan', () => {
  test('tepe devir çalışma çevriminden, yoksa regülatörden, yoksa varsayılan', () => {
    const b1 = kur();
    b1.solver.data.duty = [{ rpm: 1800, dcPct: 50 }, { rpm: 2400, dcPct: 50 }];
    expect(TR.veFeadScnInputs(b1).peakRpm).toBe(2400);
    expect(TR.veFeadScnInputs(kur()).peakRpm).toBe(2600);         // regülatör
    expect(TR.veFeadScnInputs(kur({ governedRpm: 0 })).peakRpm)
      .toBe(TR.VE_FEAD_SCN_PEAK_DEF);
  });

  test('silindir sayısı ateşleme frekansını sürüyor', () => {
    const a = TR.veFeadScenarioBuild(kur({ cylinders: 6 }), {});
    const b = TR.veFeadScenarioBuild(kur({ cylinders: 4 }), {});
    const sa = TR.veFeadScnStateAt(a, a.ph.find((p) => p.k === 'hold').t0 + 0.1);
    const sb = TR.veFeadScnStateAt(b, b.ph.find((p) => p.k === 'hold').t0 + 0.1);
    expect(sa.firingHz / sb.firingHz).toBeCloseTo(1.5, 3);
    expect(sa.firingHz).toBeCloseTo(sa.rpm * 6 / 120, 6);
  });

  test('kol konumu senaryoya GEÇER — şema bir konumu, çırpma başkasını anlatmasın', () => {
    const build = kur();
    const a = TR.veFeadScenarioBuild(build, { relDeg: F.meanRel(build.sys) });
    const b = TR.veFeadScenarioBuild(build, { relDeg: F.meanRel(build.sys) * 0.5 });
    expect(a.L.join()).not.toBe(b.L.join());        // açıklık boyları değişiyor
  });

  test('model çözülemezse null döner (sessizce boş senaryo değil)', () => {
    expect(TR.veFeadScenarioBuild({ ok: false }, {})).toBeNull();
    expect(TR.veFeadScenarioBuild(null, {})).toBeNull();
    expect(TR.veFeadScnStateAt(null, 0)).toBeNull();
  });
});
