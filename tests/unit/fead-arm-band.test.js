/**
 * fead-arm-band.test.js — OLANAKLI KOL AÇISI BANDI + T(θ)
 *
 * Kol çalışma açısı bir GİRDİ (bkz. fead-arm-input.test.js). Bu dosya onun
 * üstüne binen iki yüzeyi tutuyor ve ikisi de SEÇİCİ DEĞİL:
 *
 *   KAPI  — girilen açı fiziksel olarak kullanılabilir mi? Ölçüt tamamen
 *           kullanıcının kendi verisinden: kayışın servis aralığı, gerginin
 *           load stop'u, sarımın ayakta kalması. Gates'ten türetilmiş SABİT YOK.
 *   EĞRİ  — T(θ): o açının gerginlik karşılığı, kullanıcının noktası işaretli.
 *
 * NEDEN SEÇİCİ OLAMAZ (ölçüldü, 14 Gates sistemi, aşağıda KOŞUYOR): Gates'in
 * noktası bandın içinde 14/14 — yani ölçüt hiçbir gerçek tasarımı reddetmiyor —
 * ama bant 96…218° geniş ve ortasını seçmek medyan 96° hata verirdi. Fizik
 * doğruluyor, daraltmıyor.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const TEN = require('../../js/fead-tensioners.js');
Object.keys(TEN).forEach((k) => { global[k] = TEN[k]; });

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = []; global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { global[k] = fead[k]; });
const RP = require('../../js/cp-fead-report.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const KEY = 'AG00976_GATES_2025';
function kur(key, yama) {
  const pack = veFeadExampleNodes(key || KEY);
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
  if (yama) yama(ten.data);
  global.nodes = pack.nodes; global.connections = pack.connections;
  return { pack, ten, build: veFeadBuildSystem(pack.nodes, pack.connections) };
}

/* ══════════════ 1) KÖPRÜ — bandın kendisi ═══════════════════════════════ */
describe('veFeadArmBand — kapı', () => {
  test('iki örnekte de bant çözülüyor ve KULLANICININ açısı İÇİNDE', () => {
    [KEY, 'BMC_FEAD_2026'].forEach((k) => {
      const { build } = kur(k);
      const b = veFeadArmBand(build);
      expect(b.ok).toBe(true);
      expect(b.arcDeg).toBeGreaterThan(60);
      expect(b.userOk).toBe(true);
      expect(b.userWhy).toBe('');
    });
  });

  // İÇ TUTARLILIK: bandın kullanıcı noktasındaki gerginliği, çözümün kendi
  // gerginliğinin ta kendisi olmalı. Ayrışırsa bant ikinci bir fizik kopyası
  // demektir — bu modülün adıyla yasakladığı şey.
  test('T(θ_kullanıcı) çözümün gerginliğiyle BİREBİR', () => {
    [KEY, 'BMC_FEAD_2026'].forEach((k) => {
      const { build } = kur(k);
      const b = veFeadArmBand(build);
      expect(b.userTensionN).toBeCloseTo(build.springTensionN, 6);
    });
  });

  // BANDIN TAŞIDIĞI ASIL DEĞİŞMEZ. Yeni yönün bütün gerekçesi bu: merkez
  // sabitken çalışma noktasındaki kayış boyu kol açısından BAĞIMSIZ. Bant
  // 360°'yi tarıyor, yani bu kapı onu 90 ayrı açıda birden ölçüyor.
  test('kayış boyu bandın HER noktasında AYNI — θ’dan bağımsız', () => {
    const { build } = kur();
    const b = veFeadArmBand(build);
    const Ls = b.samples.filter((x) => x.ok && Number.isFinite(x.meanBeltMm))
      .map((x) => x.meanBeltMm);
    expect(Ls.length).toBeGreaterThan(30);
    expect(Math.max(...Ls) - Math.min(...Ls)).toBeLessThan(1e-6);
    expect(Ls[0]).toBeCloseTo(build.beltLengthMm, 6);
  });

  // ...ve GERGİNLİK bağımsız DEĞİL — kapı ikisini birden tutmalı, yoksa
  // "her şey sabit" diye okunabilir bir bant sessizce geçerdi.
  test('gerginlik θ ile GERÇEKTEN değişiyor', () => {
    const { build } = kur();
    const b = veFeadArmBand(build);
    const Ts = b.samples.filter((x) => x.ok).map((x) => x.tensionN);
    expect(Math.max(...Ts) / Math.min(...Ts)).toBeGreaterThan(1.3);
  });

  test('BANDIN DIŞINDAKİ açı sebebiyle reddediliyor', () => {
    const { build } = kur(KEY, (td) => { td.armMeanDeg = 28; });
    const b = veFeadArmBand(build);
    expect(b.userOk).toBe(false);
    expect(b.userWhy.length).toBeGreaterThan(10);
  });

  // GEREKÇE BİZİM, ÇEKİRDEĞİN HAM METNİ DEĞİL. Çekirdek arama aralığını ve
  // fonksiyon adını basıyor ("FEADCore/solveArmForBeltLength … [-1713.51 ..
  // -1704.51] (arama araligi 0..60.4)"); bu bir TEŞHİS yüzeyi, iz değil.
  test('sebepler okunur — çekirdek izi sızmıyor', () => {
    const { build } = kur();
    const b = veFeadArmBand(build);
    const sebepler = b.samples.filter((x) => !x.ok).map((x) => x.why);
    expect(sebepler.length).toBeGreaterThan(0);
    sebepler.forEach((w) => {
      expect(w).not.toMatch(/FEADCore|Err\.|arama arali|\[-?\d/);
      expect(w.length).toBeGreaterThan(8);
    });
  });

  // HER İKİ RED SEBEBİ DE GERÇEKTEN AYRIŞIYOR. Yalnız "bir sebep var" demek,
  // servis-ucu denetimini tümden düşüren mutasyondan sağ çıkardı (ölçüldü).
  test('servis ucu denetimi GERÇEKTEN eliyor — kendi sebebiyle', () => {
    const { build } = kur();
    const b = veFeadArmBand(build);
    const uc = b.samples.filter((x) => /servis aralığının ucu/.test(x.why));
    const yol = b.samples.filter((x) => /kayış yolu kapanmıyor/.test(x.why));
    expect(uc.length).toBeGreaterThan(10);        // AG00976'da 42 örnek
    expect(yol.length).toBeGreaterThan(5);
    expect(uc.map((x) => x.why).join(' ')).toMatch(/Replace|MinBelt/);
  });

  test('eksik künyede bant SESSİZ değil', () => {
    const b = veFeadArmBand({ cfg: null, center: null });
    expect(b.ok).toBe(false);
    expect(b.note.length).toBeGreaterThan(10);
  });
});

/* ══════════════ 1b) KALİBRASYON YOK — 14 Gates sistemine karşı ═════════════
   Ölçüt tamamen kullanıcının kendi verisinden kuruluyor; bu blok onu 14 gerçek
   tedarikçi tasarımına karşı BAĞIMSIZ olarak doğruluyor. İki yönlü kapı:
     (a) YANLIŞ RED YOK — 14/14 sistemin gerçek çalışma açısı bandın içinde
     (b) BOŞ KAPI DEĞİL — bant 360°'nin tamamı değil, yarısı kadar
   İkincisi olmadan "her şeyi kabul et" mutasyonu sessizce geçerdi.            */
describe('14 Gates sistemi — bağımsız doğrulama', () => {
  const V = require('../fixtures/fead-validation.js');
  const SYS = []
    .concat(Object.keys(V.AG00976).map((k) => ({ id: `AG00976/${k}`, mk: () => V.buildAG00976(k) })))
    .concat(Object.keys(V.AG_MISC).map((k) => ({ id: k, mk: () => V.buildMisc(k) })));

  test('gerçek çalışma açısı 14/14 bandın İÇİNDE, bant 96…218° GENİŞ', () => {
    let ic = 0; let n = 0; const gen = [];
    SYS.forEach((S) => {
      let sys; try { sys = S.mk(); } catch (e) { return; }
      const p = sys.tensioner.pivot; const a = sys.tensioner.armLength;
      const rel = F.meanRel(sys); const st = F.tensionerState(sys, rel); const c = st.center;
      const th = Math.atan2(c[1] - p[1], c[0] - p[0]) * 180 / Math.PI;
      const cfg = {
        pulleys: sys.pulleys.map((q) => (q.tensioner
          ? { name: q.name, rPitch: q.rPitch, rEff: q.rEff, contact: q.contact, tensioner: true }
          : { name: q.name, rPitch: q.rPitch, rEff: q.rEff, contact: q.contact,
              x: q.x, y: q.y, crank: !!q.crank })),
        belt: Object.assign({}, sys.belt),
        tensioner: Object.assign({}, sys.tensioner),
        driveRatio: 1, lengthOffsetMm: sys.lengthOffsetMm || 0, geomOpt: { tolerant: true },
      };
      M._feadBandForget();
      const b = veFeadArmBand({ cfg, center: c, armAbsDeg: th, spring: { relMeanDeg: rel } },
        { stepDeg: 2 });
      n++;
      expect(b.ok).toBe(true);
      if (b.userOk) ic++;
      gen.push(b.arcDeg);
    });
    expect(n).toBeGreaterThanOrEqual(14);
    expect(ic).toBe(n);                                  // (a) yanlış red YOK
    expect(Math.max(...gen)).toBeLessThan(300);          // (b) boş kapı DEĞİL
    expect(Math.min(...gen)).toBeGreaterThan(60);
  });
});

/* ══════════════ 2) MEMO — neyi tazeler, neyi tazelemez ══════════════════ */
describe('memo', () => {
  test('aynı geometride İKİNCİ çağrı memodan geliyor', () => {
    const { build } = kur();
    veFeadArmBand(build);
    expect(veFeadArmBand(build).memo).toBe(true);
  });

  // BANT KOL AÇISINDAN BAĞIMSIZ (yukarıda ölçüldü), dolayısıyla açıyı
  // değiştirmek memoyu ÇÖPE ATMAMALI — atsaydı her açı düzenlemesi 350 ms
  // öderdi. Kullanıcının noktası zaten memodan SONRA ayrıca örnekleniyor.
  test('kol açısı değişince memo DURUYOR ama kullanıcı noktası TAZELENİYOR', () => {
    const { build } = kur();
    const b1 = veFeadArmBand(build);
    expect(b1.userOk).toBe(true);
    const b2 = veFeadArmBand(Object.assign({}, build, { armAbsDeg: 28 }));
    expect(b2.memo).toBe(true);                 // tarama yeniden koşmadı
    expect(b2.userOk).toBe(false);              // ama nokta yeniden ölçüldü
    expect(b2.arcDeg).toBe(b1.arcDeg);
  });

  test('MERKEZ değişince memo DÜŞÜYOR — bant gerçekten yeniden hesaplanıyor', () => {
    const { build } = kur();
    veFeadArmBand(build);
    const b2 = veFeadArmBand(Object.assign({}, build,
      { center: [build.center[0] + 25, build.center[1] - 15] }));
    expect(b2.memo).toBeUndefined();
  });
});

/* ══════════════ 3) YÜZEY — panel ve rapor, ÜRETİLEN çıktıdan ═══════════ */
describe('panel yüzeyi', () => {
  test('kapı satırı ve şekil BASILIYOR', () => {
    const { ten } = kur();
    const h = fead.getFeadTensionerPropertiesHTML(ten);
    expect(h).toMatch(/Kol açısı olanaklı bantta/);
    expect(h).toMatch(/data-ve="band-curve"/);
    expect(h).toMatch(/data-ve="band-user"/);
    expect((h.match(/data-ve="band-block"/g) || []).length).toBeGreaterThan(3);
    expect(h).toMatch(/Bu bir öneri değildir/);
    expect(h).not.toMatch(/NaN|undefined/);
  });

  test('bandın DIŞINDA açıda panel SEBEBİ yazıyor', () => {
    const { ten } = kur(KEY, (td) => { td.armMeanDeg = 28; });
    const h = fead.getFeadTensionerPropertiesHTML(ten);
    expect(h).toMatch(/bandın DIŞINDA/);
    expect(h).toMatch(/Bu açı kullanılamaz/);
    expect(h).not.toMatch(/NaN|undefined/);
  });

  // İŞARETÇİ DOĞRU YERDE OLMALI — varlığı YETMEZ. Mutasyonla ölçüldü: çizgiyi
  // HTML yorumuna almak dizgiyi yerinde bırakıyor ve yalnız `toMatch` yapan bir
  // kapı SESSİZCE geçiyordu. Kapı artık konumu ölçüyor: iki farklı açıda
  // çizdirip x'in θ ile DOĞRUSAL ve doğru yönde gittiğini doğruluyor.
  // Yerleşim sabitleri (kenar boşlukları, genişlik) teste YAZILMIYOR — oran
  // karşılaştırması onlardan bağımsız.
  test('şekildeki kullanıcı işaretçisi θ ile DOĞRU yerde', () => {
    const { build } = kur();
    const band = veFeadArmBand(build);
    const xOf = (deg) => {
      const svg = veFeadBandSVG(Object.assign({}, band, { userDeg: deg }), 320, 132);
      const m = /<line data-ve="band-user" x1="([\d.]+)"/.exec(svg);
      expect(m).not.toBeNull();
      return Number(m[1]);
    };
    const xA = xOf(-90); const xB = xOf(0); const xC = xOf(90);
    expect(xB).toBeGreaterThan(xA);                       // θ artınca sağa
    expect(xC).toBeGreaterThan(xB);
    expect(xB - xA).toBeCloseTo(xC - xB, 1);              // ve DOĞRUSAL
    // ±180 uçları eksenin iki ucuna oturuyor (sarmalama doğru)
    expect(xOf(-180)).toBeLessThan(xA);
    expect(xOf(179)).toBeGreaterThan(xC);
  });

  // EĞRİ KOPUKLUKLARI KORUNMALI. Birleştirilirse çizgi taralı (kullanılamaz)
  // bölgenin ÜSTÜNDEN geçer ve orada bir gerginlik varmış gibi okunur — tam
  // olarak şeklin engellemesi gereken şey. Kapı, çizilen parça sayısını
  // örneklerdeki BİTİŞİK olanaklı koşu sayısıyla karşılaştırıyor.
  test('eğri kullanılamaz bölgede KOPUYOR — parça sayısı koşu sayısına eşit', () => {
    const { build } = kur();
    const band = veFeadArmBand(build);
    let kosu = 0; let onceOk = false;
    band.samples.forEach((x) => {
      const ok = x.ok && Number.isFinite(x.tensionN);
      if (ok && !onceOk) kosu++;
      onceOk = ok;
    });
    expect(kosu).toBeGreaterThan(1);            // fikstür gerçekten kopuk
    const svg = veFeadBandSVG(band, 320, 132);
    expect((svg.match(/data-ve="band-curve"/g) || []).length).toBe(kosu);

    // ...VE TARALI BÖLGEYE UZANMIYOR. Koşu SAYISI bunu yakalamıyor: çözülemez
    // örneklerin bir kısmının gerginliği yine de hesaplanmış oluyor (burada 21
    // örnek) ve onları da çizmek koşu sayısını DEĞİŞTİRMİYOR — mutasyonla
    // ölçüldü, kapı sessizce geçiyordu. Nokta SAYISI ise birebir tutuyor.
    const nokta = (svg.match(/points="([^"]+)"/g) || [])
      .reduce((n, p) => n + p.split(' ').length, 0);
    const okSay = band.samples.filter((x) => x.ok && Number.isFinite(x.tensionN)).length;
    expect(nokta).toBe(okSay);
    expect(band.samples.filter((x) => !x.ok && Number.isFinite(x.tensionN)).length)
      .toBeGreaterThan(5);                      // ...ve o örnekler GERÇEKTEN var
  });

  // TEPE KIRPMA — İKİ YÖNLÜ. Sarım sıfıra giderken T tekilleşiyor; kırpılmazsa
  // eğrinin okunur bölgesi birkaç piksele çöker. Ama kırpma KOŞULLU olmalı,
  // yoksa gerek olmayan yerde eğrinin tepesini keser. Kapı ikisini de tutuyor:
  // BMC'de tepe kullanıcının 3 katını aşıyor (kırpılmalı), AG00976'da aşmıyor
  // (kırpılmamalı).
  test('tepe yalnız GEREKTİĞİNDE kırpılıyor', () => {
    const oran = (key) => {
      const { build } = kur(key);
      M._feadBandForget();
      const band = veFeadArmBand(build);
      const Ts = band.samples.filter((x) => x.ok).map((x) => x.tensionN);
      return { band, k: Math.max(...Ts) / band.userTensionN };
    };
    const bmc = oran('BMC_FEAD_2026');
    expect(bmc.k).toBeGreaterThan(3);
    expect(veFeadBandSVG(bmc.band, 320, 132)).toMatch(/data-ve="band-clip"/);

    const ag = oran(KEY);
    expect(ag.k).toBeLessThan(3);
    expect(veFeadBandSVG(ag.band, 320, 132)).not.toMatch(/data-ve="band-clip"/);
  });

  test('şekil çözülemeyen bantta SESSİZCE boş dönüyor (patlamıyor)', () => {
    expect(veFeadBandSVG(null, 300, 120)).toBe('');
    expect(veFeadBandSVG({ ok: true, samples: [] }, 300, 120)).toBe('');
  });
});

describe('rapor yüzeyi', () => {
  // ÜRETİLEN YÜZEYDEN: bloğu doğrudan çağıran bir kapı, onu §8'den düşüren
  // mutasyondan sağ çıkardı (bu turda iki kez ölçüldü).
  function sec8() {
    const pack = veFeadExampleNodes(KEY);
    const ns = pack.nodes.map((n) => ({ id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)) }));
    const build = veFeadBuildSystem(ns, pack.connections);
    const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
    const R = veFeadAnalyze(build, { rows: veFeadDutyRows(solv), cylinders: 6,
      fatigueModel: 'PK-2_2p-MT3' });
    R.build = build; R.pulleyNames = build.names; R.serviceFact = 1.3;
    return RP._frSection8(R, { id: 'rep1', type: 'fead-report', data: {} });
  }

  test('bant bloğu §8’in İÇİNDE, sayısıyla ve şekliyle', () => {
    const h = sec8();
    expect(h).toMatch(/Kol açısı fiziksel olarak kullanılabilir mi/);
    expect(h).toMatch(/Kol açısı bandı/);
    expect(h).toMatch(/data-ve="band-curve"/);
    expect(h).toMatch(/14\/14/);                 // ölçümün kendisi belgede
    expect(h).toMatch(/96…218/);
    expect(h).toMatch(/Bu bir SEÇİCİ değil, bir KAPIDIR/);
    expect(h).not.toMatch(/NaN|undefined|\[object/);
  });

  test('rapor bir ÖNERİ sunmuyor — "en iyi açı" dili YOK', () => {
    const h = sec8();
    expect(h).not.toMatch(/en uygun açı|önerilen açı|seçilen açı|θ\^\{\*\}/);
  });
});
