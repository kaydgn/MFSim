/**
 * fead-tensioners.test.js — GERGİ KÜNYE KÜTÜPHANESİ
 *
 * Kullanıcı isteği (2026-08-28): *"Bu otomatik gergi özelliklerini de Gates
 * raporlarından kalibre ederek çekeceğiz."*
 *
 * EN KRİTİK KAPI BU DOSYANIN İLK TESTİ: kütüphanedeki her sayı
 * `tests/fixtures/fead-validation.js` içindeki raporlardan çıkarıldı, yani
 * İKİNCİ BİR KOPYA. İkisi ayrışırsa hata SESSİZ olur — kullanıcı kütüphaneden
 * bir künye seçer, model çözülür, hiçbir uyarı çıkmaz, yalnız sayılar
 * raporunkinden başkadır. Test her kaydı fixture'la BİREBİR karşılaştırıyor.
 */
const T = require('../../js/fead-tensioners.js');
const V = require('../fixtures/fead-validation.js');

/* Kayıt anahtarı → fixture kaydı. */
const KAYNAK = {
  'AG00976-1715': V.AG00976['1715@-250/110'],
  'AG00976-1705': V.AG00976['1705@-250/110'],
  'AG00976-1668': V.AG00976['1668@-240/115'],
  'AG00976-1655': V.AG00976['1655@-250/104'],
  'AG00879': V.AG_MISC.AG00879,
  'AG00894': V.AG_MISC.AG00894,
  'AG00902-1300': V.AG_MISC['AG00902-1300'],
  'AG00902-1275': V.AG_MISC['AG00902-1275'],
  'AG00686': V.AG_MISC.AG00686,
  'AG00686-1520': V.AG_MISC['AG00686-1520'],
  'AG0868-8PK': V.AG_MISC.AG0868,
  'AG0868-6PK': V.AG_MISC['AG0868-6PK'],
  'AG0868-4PK': V.AG_MISC['AG0868-4PK'],
  'AG00810': V.AG_MISC.AG00810,
};

describe('kütüphane ↔ fixture — İKİNCİ KOPYA AYRIŞMASIN', () => {
  test('14 kaydın 14’ü de fixture’daki raporla BİREBİR', () => {
    const l = T.veFeadTensionerList();
    expect(l).toHaveLength(14);
    l.forEach((r) => {
      const d = KAYNAK[r.key];
      expect(d).toBeTruthy();                       // eşlenmemiş kayıt YOK
      expect(r.armLen).toBe(d.arm);
      expect(r.preloadNm).toBe(d.preload);
      expect(r.rateNm).toBe(d.rate);
      expect(r.meanNm).toBe(d.meanLoad);
      // gergi kasnağının çapı ve temas tarafı — AG_MISC'te pulley.TEN'de
      if (d.pulley && d.pulley.TEN) {
        expect(r.od).toBe(d.pulley.TEN.p);
        expect(r.contact).toBe(d.pulley.TEN.c);
      }
      if (d.inertia && d.inertia.TEN != null) expect(r.inertia).toBe(d.inertia.TEN);
    });
  });

  test('nominal dönme fixture’ın Mean satırıyla tutuyor', () => {
    T.veFeadTensionerList().forEach((r) => {
      const d = KAYNAK[r.key];
      const mean = d.pos.find((p) => p.name === 'Mean');
      // (M_mean − M₀)/k, raporun kendi Mean göreli açısı ile 0.2° içinde.
      expect(Math.abs(r.relNomDeg - mean.rel)).toBeLessThan(0.2);
    });
  });
});

describe('parça ↔ montaj ayrımı — ölçülmüş', () => {
  test('AG0868 üçlüsü: aynı yay, kayış genişliğiyle DEĞİŞEN ayar', () => {
    const a = T.veFeadTensionerOf('AG0868-8PK');
    const b = T.veFeadTensionerOf('AG0868-6PK');
    const c = T.veFeadTensionerOf('AG0868-4PK');
    // PARÇA aynı: kol, çap, temas birebir; yay katsayısı %2 içinde
    [b, c].forEach((x) => {
      expect(x.armLen).toBe(a.armLen);
      expect(x.od).toBe(a.od);
      expect(x.contact).toBe(a.contact);
      expect(Math.abs(x.rateNm - a.rateNm) / a.rateNm).toBeLessThan(0.02);
      expect(Math.abs(x.preloadNm - a.preloadNm) / a.preloadNm).toBeLessThan(0.02);
    });
    // MONTAJ ayarı kayış genişliğiyle ölçekleniyor — ve monoton
    expect(a.meanNm).toBeGreaterThan(b.meanNm);
    expect(b.meanNm).toBeGreaterThan(c.meanNm);
    expect(a.relNomDeg).toBeGreaterThan(b.relNomDeg);
    expect(b.relNomDeg).toBeGreaterThan(c.relNomDeg);
    expect(a.ribs).toBe(8); expect(b.ribs).toBe(6); expect(c.ribs).toBe(4);
  });

  test('kol-90 · 8PK ailesinin nominal dönmesi ~28° — E9843 çiziminin sayısı', () => {
    const aile = T.veFeadTensionerList()
      .filter((r) => r.armLen === 90 && r.ribs === 8
        && r.relNomDeg >= T.VE_FEAD_TEN_BAND.relNom8PK.min - 1e-9
        && r.relNomDeg <= T.VE_FEAD_TEN_BAND.relNom8PK.max + 1e-9);
    expect(aile.length).toBeGreaterThanOrEqual(8);
    // ÖLÇÜLEN bant 27,10…29,62° — uydurma bir tolerans değil, dokuz kaydın
    // kendi en küçük/en büyüğü. E9843 çiziminin "28° FREEARM-MEAN ROTATION"ı
    // tam ortasında.
    expect(T.VE_FEAD_TEN_BAND.relNom8PK.min).toBeCloseTo(27.10, 1);
    expect(T.VE_FEAD_TEN_BAND.relNom8PK.max).toBeCloseTo(29.62, 1);
    expect(28).toBeGreaterThan(T.VE_FEAD_TEN_BAND.relNom8PK.min);
    expect(28).toBeLessThan(T.VE_FEAD_TEN_BAND.relNom8PK.max);
    aile.forEach((r) => { expect(Math.abs(r.relNomDeg - 28)).toBeLessThan(2.0); });
  });

  test('AG00879 ayrı bir gövde — kol 56, katsayı 0.409, ön yük 20.05', () => {
    const r = T.veFeadTensionerOf('AG00879');
    expect(r.armLen).toBe(56);
    T.veFeadTensionerList().filter((x) => x.key !== 'AG00879')
      .forEach((x) => { expect(x.armLen).toBe(90); });
    expect(r.rateNm).toBeLessThan(T.VE_FEAD_TEN_BAND.rateNm.min + 1e-9);
    expect(r.preloadNm).toBe(T.VE_FEAD_TEN_BAND.preloadNm.max);
  });
});

describe('bant — bir HÜKÜM değil, karşılaştırma', () => {
  test('bant sınırları kayıtların KENDİ en küçük/en büyüğü (uydurma tolerans yok)', () => {
    const l = T.veFeadTensionerList();
    const mm = (f) => ({ min: Math.min(...l.map(f)), max: Math.max(...l.map(f)) });
    const arm = mm((r) => r.armLen), pre = mm((r) => r.preloadNm);
    const rate = mm((r) => r.rateNm), od = mm((r) => r.od), rel = mm((r) => r.relNomDeg);
    expect(T.VE_FEAD_TEN_BAND.armLen).toEqual(arm);
    expect(T.VE_FEAD_TEN_BAND.preloadNm).toEqual(pre);
    expect(T.VE_FEAD_TEN_BAND.rateNm).toEqual(rate);
    expect(T.VE_FEAD_TEN_BAND.od).toEqual(od);
    expect(T.VE_FEAD_TEN_BAND.relNomDeg.min).toBeCloseTo(rel.min, 2);
    expect(T.VE_FEAD_TEN_BAND.relNomDeg.max).toBeCloseTo(rel.max, 2);
  });

  test('kütüphanenin HER kaydı kendi bandını geçer', () => {
    T.veFeadTensionerList().forEach((r) => {
      const td = {};
      T.veFeadTensionerApply(td, r);
      const b = T.veFeadTensionerBandCheck(td);
      expect(b.outside).toEqual([]);
      expect(b.ok).toBe(true);
    });
  });

  test('ONDALIK KAYMASI yakalanıyor — 0.480 → 0.048', () => {
    const td = { armLen: 90, preload: 8.6, kArm: 0.048, meanLoad: 22.07, od: 77.2 };
    const b = T.veFeadTensionerBandCheck(td);
    expect(b.ok).toBe(false);
    expect(b.outside.join(' ')).toMatch(/yay katsayısı/);
    // ve nominal dönme de fırlıyor (280°) — iki bağımsız işaret
    expect(b.relNomDeg).toBeGreaterThan(200);
    expect(b.outside.join(' ')).toMatch(/nominal kol dönmesi/);
  });

  test('boş / girilmemiş alan bandı İHLAL saymaz', () => {
    expect(T.veFeadTensionerBandCheck({}).outside).toEqual([]);
    expect(T.veFeadTensionerBandCheck({ armLen: 0, preload: 0 }).outside).toEqual([]);
    expect(T.veFeadTensionerBandCheck(null).ok).toBe(true);
  });
});

describe('uygulama — KOPYA, ve montaj verisine dokunmaz', () => {
  test('künye uygulanınca alanlar yazılır, iz bırakılır', () => {
    const td = {};
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG00976-1715'));
    expect(td.armLen).toBe(90);
    expect(td.preload).toBe(8.60);
    expect(td.kArm).toBe(0.480);
    expect(td.meanLoad).toBe(22.07);
    expect(td.od).toBe(77.2);
    expect(td.contact).toBe('back');
    expect(td.tenLib).toBe('AG00976-1715');
    expect(td.tenLibVer).toBe(T.VE_FEAD_TEN_LIB_VERSION);
  });

  test('PİVOT ve KOL AÇISI yazılmaz — ikisi de motorun verisi', () => {
    const td = { pivotX: -250, pivotY: 110, armMeanDeg: 344, armPinned: true };
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG0868-4PK'));
    expect(td.pivotX).toBe(-250);
    expect(td.pivotY).toBe(110);
    expect(td.armMeanDeg).toBe(344);
    expect(td.armPinned).toBe(true);
  });

  test('liste KOPYA döndürür — katalog güncellemesi eski projeyi bozmaz', () => {
    const l1 = T.veFeadTensionerList();
    l1[0].preloadNm = 999;
    expect(T.veFeadTensionerList()[0].preloadNm).not.toBe(999);
    expect(T.veFeadTensionerOf('AG00976-1715').preloadNm).toBe(8.60);
  });
});

describe('arama', () => {
  test('Türkçe katlama: toLowerCase TEK BAŞINA yetmez', () => {
    expect(T.veFeadTensionerFind('AG00976').length).toBe(4);
    expect(T.veFeadTensionerFind('ag00976').length).toBe(4);
    // ASIL KAPI: JS'te 'I'.toLowerCase() === 'i' (Türkçe'de 'ı' olmalı) ve
    // 'İ'.toLowerCase() birleşik noktalı i veriyor. AG00879'un notunda
    // "DIŞINDA" geçiyor; katlama olmadan ne büyük ne küçük yazım bulur.
    ['DIŞINDA', 'dışında', 'DISINDA', 'disinda'].forEach((q) => {
      expect(T.veFeadTensionerFind(q).map((r) => r.key)).toEqual(['AG00879']);
    });
    // 'düşük ayar' notu iki dar kayışta; ü/ş/İ hepsi aynı katlamadan geçiyor
    expect(T.veFeadTensionerFind('DÜŞÜK').map((r) => r.key).sort())
      .toEqual(['AG0868-4PK', 'AG0868-6PK']);
  });

  test('boş sorgu tüm listeyi verir, eşleşmeyen sorgu boş', () => {
    expect(T.veFeadTensionerFind('').length).toBe(14);
    expect(T.veFeadTensionerFind('   ').length).toBe(14);
    expect(T.veFeadTensionerFind('YOKBOYLE')).toHaveLength(0);
  });

  test('anahtarlar TEKİL', () => {
    const k = T.veFeadTensionerList().map((r) => r.key);
    expect(new Set(k).size).toBe(k.length);
  });
});

describe('kütüphane KURULU MODELDE çalışıyor', () => {
  test('AG00976 künyesi uygulanınca çözüm o raporun sayılarını veriyor', () => {
    const F = require('../../js/fead-core.js');
    const M = require('../../js/fead-model.js');
    const d = V.AG00976['1715@-250/110'];
    const td = { pivotX: d.pivot[0], pivotY: d.pivot[1] };
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG00976-1715'));
    // Künyeden çıkan yay verisi çekirdeğin beklediği sistemi kurabiliyor mu?
    const mount = M.veFeadSpringSetup(td);
    const mean = d.pos.find((p) => p.name === 'Mean');
    expect(Math.abs(mount.relMeanDeg - mean.rel)).toBeLessThan(0.2);
    expect(td.od).toBe(77.2);
    expect(F.beltProps({ profile: 'PK', brand: 'GATES' })).toBeTruthy();
  });
});

// ── ETİKET PARÇAYI SÖYLER (kullanıcı, 2026-09-01) ──────────────────────────
//
// *"Şu anda bir sürü 90mm otomatik gergi var fakat bazı gates raporlarında
// 56mm gergiler de var."* Veri doğruydu (arşiv kapısı bunu ölçüyor); kusur
// etiketteydi — on üç kayıt aynı metni basıyordu.
describe('künye etiketi — parça numarasıyla', () => {
  const DB = T.VE_FEAD_TENSIONER_DB;

  test('etiket parça koduyla BAŞLIYOR, kodsuz kayıt "?" ile işaretli', () => {
    DB.forEach((r) => {
      const et = T.veFeadTenLabel(r);
      expect(et.indexOf(r.part || '?')).toBe(0);
      expect(et).toContain('kol ' + r.armLen + ' mm');
    });
    expect(DB.filter((r) => !r.part).length).toBe(4);      // AG00976 · kodsuz
  });

  test('parça sayısı kayıt sayısından AZ — asıl anlatılan bu', () => {
    // On dört kayıt, dört parça: E9843 altı sistemde, T38624 ikisinde.
    // Kayıtları ayıran şey parça değil MONTAJ ayarı (yay çalışma momenti).
    const kodlu = DB.filter((r) => r.part);
    const parca = new Set(kodlu.map((r) => r.part));
    expect(parca.size).toBeLessThan(kodlu.length);
    expect(parca.size).toBe(4);
  });

  test('AYNI PARÇANIN kol boyu ve yay katsayısı TUTARLI', () => {
    // Parça verisi montajdan bağımsızdır; ayrışması bir veri hatası olurdu.
    const grup = {};
    DB.filter((r) => r.part).forEach((r) => { (grup[r.part] = grup[r.part] || []).push(r); });
    Object.keys(grup).forEach((k) => {
      expect(new Set(grup[k].map((r) => r.armLen)).size).toBe(1);
      expect(new Set(grup[k].map((r) => r.od)).size).toBe(1);
    });
  });

  test('56 mm kayıt GERÇEKTEN var ve ayrı bir parça', () => {
    const kisa = DB.filter((r) => r.armLen === 56);
    expect(kisa.length).toBe(1);
    expect(kisa[0].part).toBe('T38665');
    expect(T.veFeadTenLabel(kisa[0])).toContain('56 mm');
    // ...ve gövdesi de başka: yay katsayısı ve ön yükü bandın DIŞINDA.
    expect(kisa[0].rateNm).toBeLessThan(0.45);
    expect(kisa[0].preloadNm).toBeGreaterThan(15);
  });

  test('etiketler HÂLÂ tekil — parça eklemek ayırt ediciliği bozmadı', () => {
    const et = DB.map(T.veFeadTenLabel);
    expect(new Set(et).size).toBe(et.length);
  });
});

