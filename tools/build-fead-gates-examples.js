#!/usr/bin/env node
/**
 * build-fead-gates-examples.js — Gates ARŞİVİNDEN örnek tanımı üretir
 * ═══════════════════════════════════════════════════════════════════════════
 * `docs/gates-reports/pdf/` altındaki her raporun referans değerleri
 * `tests/fixtures/fead-validation.js` içinde ZATEN duruyor (doğrulama
 * kapısının kendisi). Bu betik o kayıtlardan `VE_FEAD_EXAMPLES` bloklarını
 * üretir — böylece sayılar İKİNCİ KEZ elle yazılmaz.
 *
 * ÇEVRİMLER (tek yerde, çünkü sessiz hata sınıfı burada):
 *   • Fixture PITCH ve EFFECTIVE çap tutar, MFSim DIŞ ÇAP (od) ister:
 *       grooved: pitch = od + 2·hb → od = e            (eff == od)
 *       back:    pitch = od + 2·hr, eff = od + 2·hr + 2·hb → od = p − 2·hr
 *   • Kayış boyu = raporun REBL(Mean) sütunu — başlıktaki katalog adı DEĞİL.
 *   • lengthOffsetMm = EDL(Mean) − REBL(Mean).
 *   • Kol açısı = konum tablosunun Mean satırındaki mutlak açı; montaj
 *     konumu ondan TÜRER (bugünkü gergi tanımı).
 *
 * Çıktı doğrudan `js/fead-model.js`'e yapıştırılmak üzere biçimlendirilir.
 * DOĞRULAMA betiğin işi değil: `tests/unit/fead-examples-gates.test.js`
 * üretilen her örneği fixture'a karşı UÇTAN UCA koşturuyor.
 */
const path = require('path');
const V = require(path.join(__dirname, '..', 'tests', 'fixtures', 'fead-validation.js'));
const { REPORT, vibrationOf } = require(path.join(__dirname, '..', 'tests', 'helpers', 'gates-vibration.js'));
const { gatesPdfPages, numbersAfter } = require(path.join(__dirname, '..', 'tests', 'helpers', 'gates-pdf.js'));

// "System Vibration Analysis" sayfası ATALETLERİ ve silindir sayısını da
// veriyor. Arşivde TAM duran yedi raporda var; üç ALINTI PDF'te (AG00894,
// AG00902 ×2) o sayfa YOK — oralarda atalet yazılmaz ve model eksikliği
// kendisi söyler. Uydurmak, tam da kaçınılan şey olurdu.
function titresim(key) {
  if (!REPORT[key]) return null;
  try {
    const v = vibrationOf(key);
    const page = gatesPdfPages(path.join(__dirname, '..', 'docs', 'gates-reports', 'pdf', REPORT[key]))
      .find((t) => t.indexOf('System Vibration Analysis') >= 0);
    let cyl = null;
    try { cyl = numbersAfter(page, '# of Cylinders', 1)[0]; } catch (e) { /* etiket yoksa yazma */ }
    return { v: v, cylinders: cyl };
  } catch (e) { return null; }
}

// PK kayış yükseklikleri (fead-core.js BELT_DB.PK.GATES) — arşivdeki on
// raporun onu da PK (4/6/8/10 kaburga).
const HB = 1.2, HR = 1.1;

// Kasnak anahtarı → MFSim düğüm tipi ve okunur ad.
const TYPE = {
  CRK:    ['fead-crank',       'Krank Kasnağı'],
  FAN:    ['fead-fan',         'Sürücü Kasnak (FAN)'],
  IDR:    ['fead-idler',       'Avara'],
  IDR1:   ['fead-idler',       'Avara 1'],
  IDR2:   ['fead-idler',       'Avara 2'],
  A_C:    ['fead-ac',          'Klima Kompresörü'],
  TM31:   ['fead-ac',          'Klima Kompresörü (TM31)'],
  SD7H15: ['fead-ac',          'Klima Kompresörü (SD7H15)'],
  ALT:    ['fead-alternator',  'Alternatör'],
  TEN:    ['fead-tensioner',   'Otomatik Gergi'],
};

function odOf(p) {
  // grooved: efektif çap = dış çap. back: pitch − 2·hr.
  return p.c === 'back' ? +(p.p - 2 * HR).toFixed(4) : +p.e.toFixed(4);
}

function num(x, d) {
  const v = +Number(x).toFixed(d);
  return Number.isInteger(v) ? String(v) : String(v);
}

function build(key, meta) {
  const o = V.AG_MISC[key];
  if (!o) throw new Error('Fixture kaydı yok: ' + key);
  const mean = o.pos.find((p) => p.name === 'Mean');
  const load = o.pos.find((p) => p.name === 'Load');
  if (!mean) throw new Error(key + ': Mean satırı yok');

  const effLength = mean.REBL;
  const offset = +(mean.EDL - mean.REBL).toFixed(4);
  const tenKey = o.order.find((k) => o.pulley[k].ten);

  const T = titresim(key);
  const L = [];
  L.push("  '" + meta.id + "': {");
  L.push('    name: ' + JSON.stringify(meta.name) + ',');
  L.push('    note: ' + JSON.stringify(meta.note) + ',');
  L.push("    belt:  { profile:'PK', brand:'GATES', beltType:" + JSON.stringify(meta.beltType)
       + ', ribs:' + o.ribs + ',');
  L.push('             effLength:' + effLength + ', tolerance:' + o.tol
       + ', wearPct:' + +(o.wear / 100).toFixed(6) + ' },');
  L.push("    solver:{ ratioMode:'direct', driveRatio:1,");
  if (T && T.cylinders != null) L.push('             cylinders:' + T.cylinders + ',');
  if (T && T.v.crankInertiaKgM2 != null) L.push('             crankInertia:' + T.v.crankInertiaKgM2 + ',');
  L.push('             lengthOffsetMm:' + offset + ',');
  L.push('             duty:[');
  o.duty.forEach((r, i) => {
    const kw = Object.keys(r.kw).map((k) => k + ':' + r.kw[k]).join(', ');
    L.push('               { rpm:' + r.engineRpm + ', dcPct:' + r.dcPct
         + ', degC:' + o.degC + ', kwByKey:{ ' + kw + ' } }'
         + (i < o.duty.length - 1 ? ',' : ''));
  });
  L.push('             ] },');
  L.push('    pulleys: [');
  o.order.forEach((k, i) => {
    const p = o.pulley[k], xy = o.xy[k];
    const [type, ad] = TYPE[k] || ['fead-idler', k];
    const son = i === o.order.length - 1;
    if (p.ten) {
      L.push("      { key:'" + k + "', type:'" + type + "', name:" + JSON.stringify(meta.tenName || ad) + ',');
      L.push("        data:{ od:" + odOf(p) + ", contact:'" + p.c + "',");
      // Merkez LAYOUT DATA satırından, konum tablosunun Mean'inden DEĞİL:
      // Layout iki ondalık, konum tablosu bire yuvarlıyor (ölçüldü: on raporda
      // 0,014–0,064 mm fark). İkisi aynı noktanın iki hassasiyeti.
      var cen = o.xy[k] || [mean.X, mean.Y];
      L.push('               cenX:' + cen[0] + ', cenY:' + cen[1] + ', armLen:' + o.arm + ',');
      L.push('               armMeanDeg:' + mean.absDeg + ',');
      L.push('               preload:' + o.preload + ', kArm:' + o.rate
           + ', meanLoad:' + o.meanLoad + ',');
      if (T) {
        const ti = T.v.accessoryInertia[k];
        L.push('               '
          + (ti != null ? 'inertia:' + ti + ', ' : '')
          + 'armInertia:' + T.v.armInertiaKgM2
          + ', pulleyMass:' + T.v.pulleyMassKg + ',');
      }
      L.push('               loadStopRelDeg:' + (load ? load.rel : 0) + ' } }' + (son ? '' : ','));
    } else {
      L.push("      { key:'" + k + "', type:'" + type + "', name:" + JSON.stringify(ad) + ',');
      // Sürücü düğümüne KRANK MİLİ ataleti giriyor: burulma modelinin sürücü
      // serbestliği krank milidir (doğrulama harness'i de öyle besliyor).
      const at = T ? (p.crank ? T.v.crankInertiaKgM2 : T.v.accessoryInertia[k]) : null;
      L.push('        data:{ od:' + odOf(p) + ', x:' + xy[0] + ', y:' + xy[1]
           + ", contact:'" + p.c + "'" + (p.crank ? ', driver:true' : '')
           + (at != null ? ', inertia:' + at : '') + ' } }'
           + (son ? '' : ','));
    }
  });
  L.push('    ],');
  L.push('    route: [' + o.order.map((k) => "'" + k + "'").join(', ') + ']');
  L.push('  }');
  return L.join('\n');
}

module.exports = { build, odOf, TYPE, HB, HR };

if (require.main === module) {
  const META = require(path.join(__dirname, 'fead-gates-examples-meta.json'));
  const out = META.map((m) => build(m.fixture, m));
  process.stdout.write(out.join(',\n\n') + '\n');
}
