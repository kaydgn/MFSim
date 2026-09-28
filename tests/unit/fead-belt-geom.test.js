/**
 * fead-belt-geom.test.js — KAYIŞ PROFİL GEOMETRİSİ (5 profil × 3 üretici)
 *
 * ── ÖLÇÜLEN HATA ──────────────────────────────────────────────────────────
 * Bu tablo eklenmeden önce 15 profil×marka bileşiminin DÖRDÜ `makeSystem`
 * içinde hata fırlatıyordu: GATES + PH/PJ/PL/PM. Çekirdeğin BELT_DB'sinde
 * GATES'in yalnız PK'sı var ve GATES panelin VARSAYILAN markası — yani
 * kullanıcının yalnız PROFİLİ değiştirmesi modeli çözülemez yapıyordu.
 * Panelde de kırmızı bir hata satırı beliriyordu.
 *
 * ── DÜZELTMENİN ŞEKLİ: ÇEKİRDEK DEĞİL, KÖPRÜ ──────────────────────────────
 * Eksik satırlar `js/fead-core.js`'e YAZILMADI — o dosya dışarıdan geldi ve
 * birebir durur (üç katman kuralı). Katalog projenin kendi veri katmanında
 * (`js/fead-belts.js`) büyüdü; köprü (`js/fead-model.js`) hb/hr'yi çekirdeğe
 * AÇIKÇA geçiriyor ve çekirdeğin kendi kaçış kapısı devreye giriyor.
 *
 * ── İKİ KAYNAK OLDU; AYRIŞMAMALARI BU DOSYANIN ASIL İŞİ ───────────────────
 * Aynı sayı artık iki yerde: çekirdeğin BELT_DB'sinde ve proje tablosunda.
 * "Çekirdeğin sahip olduğu her satır proje tablosuyla birebir aynı" testi bu
 * yüzden var — biri güncellenip diğeri unutulursa kırmızıya döner. Bu modülün
 * hata sınıfı sessiz olduğu için kapı ŞART.
 *
 * ── DEĞERLERİN KAYNAĞI ────────────────────────────────────────────────────
 * Optibelt  → "optibelt RB Ribbed Belts" teknik el kitabı, profil tablosu.
 *             El kitabı formülü de yazıyor: dw = db + 2·hb (hb YARIÇAP payı).
 * ContiTech → CONTI-V MULTIRIB kataloğu, Tablo 1 (hb ve hr ayrı satırlar).
 * Gates PK  → BMC defteri; `docs/gates-reports/` altındaki 17 raporla koşan
 *             çekirdek doğrulama kapısı bu profille çalışıyor.
 * Gates PJ/PL/PM → Gates hb/hr YAYIMLAMIYOR. ISO 9982:1998 §3.4 nominali
 *             alındı ve 'iso' damgasıyla işaretlendi.
 * ISO 9982  → Tablo 1 (kanal adımı e), Tablo 2 (min. etkin çap), §3.4 (be).
 */
const Core = require('../../js/fead-core.js');
const B = require('../../js/fead-belts.js');

// Köprü kardeş fonksiyonları GLOBAL olarak arıyor (tarayıcıda tek kapsam).
global.FEADCore = Core;
Object.assign(global, B);
const M = require('../../js/fead-model.js');

const PROFILLER = ['PH', 'PJ', 'PK', 'PL', 'PM'];
const MARKALAR = ['GATES', 'OPTIBELT', 'CONTITECH'];

// ─── DEFTERİN SİSTEMİ — çözülebilirlik kapısı bunun üzerinden ölçülüyor ────
const PIVOT = [-162 + 90 * Math.cos((168 * Math.PI) / 180),
                 91 + 90 * Math.sin((168 * Math.PI) / 180)];
const ARM_ABS = (Math.atan2(91 - PIVOT[1], -162 - PIVOT[0]) * 180) / Math.PI;

function kirpiCfg(profile, brand) {
  return {
    belt: { profile, brand, ribs: 8, effLength: 1720.434 },
    pulleys: [
      { name: 'Tahrik Kasnağı', od: 159, x: 0, y: 0, contact: 'grooved', crank: true },
      { name: 'Avara 1', od: 75, x: 130, y: 138, contact: 'back' },
      { name: 'Klima Komp.', od: 152, x: 184, y: 315, contact: 'grooved' },
      { name: 'Avara 2', od: 75, x: 0, y: 267.4, contact: 'back' },
      { name: 'Alternatör', od: 63.5, x: -281, y: 259.3, contact: 'grooved' },
      { name: 'Gergi Kasnağı', od: 75, contact: 'back', tensioner: true },
    ],
    driveRatio: 218.3 / 179.62,
    tensioner: { pivot: PIVOT, armLength: 90, preloadNm: 8.6,
                 rateNmPerDeg: 0.477, freeAngleDeg: ARM_ABS },
  };
}

/**
 * Köprünün kayış kurulumunun AYNISI: `veFeadKordOfset` çifti verirse ve o çift
 * proje tablosundan geldiyse çekirdeğe AÇIKÇA geçilir, katalog satırı ALTA
 * konur. İki satır da köprüdeki iki satırın birebir karşılığı; ikisi de
 * `veFeadBeltProjeProps` üzerinden gider, yani eşleme tek yerde.
 */
function kordUygula(belt) {
  const ko = M.veFeadKordOfset(belt);
  if ((ko.kaynak !== 'katalog' || ko.projeTablosu)
      && Number.isFinite(ko.hb) && Number.isFinite(ko.hr)) {
    let kat = null;
    try { kat = Core.beltProps({ profile: belt.profile, brand: belt.brand }); } catch (e) { kat = null; }
    if (!kat) kat = M.veFeadBeltProjeProps(belt.profile, belt.brand);
    return Object.assign({}, kat || {}, belt, { hb: ko.hb, hr: ko.hr });
  }
  return belt;
}

/** Köprünün kurduğu kayışla sistemi kurup geometriyi çözer. */
function coz(profile, brand, { dolgu = true } = {}) {
  const cfg = kirpiCfg(profile, brand);
  if (dolgu) cfg.belt = kordUygula(cfg.belt);
  const sys = Core.makeSystem(cfg);
  const g = Core.geometryAt(sys, 0);
  return {
    hb: sys._bp.hb, hr: sys._bp.hr,
    kutle: sys._bp.massPerRibKgM, kord: sys._bp.cordStiffnessNPerRib,
    sarim: g.wraps.map((x) => +x.toFixed(9)),
    rPitch: g.pulleys.map((p) => +p.rPitch.toFixed(9)),
  };
}

// ══════════════════════════════════════════ 1) ÇÖKME GİTTİ ══════════════
describe('Çözülebilirlik — 15 bileşimin hepsi', () => {
  test('köprü doldurunca 15 profil×marka bileşiminin HEPSİ çözülüyor', () => {
    const kirilan = [];
    PROFILLER.forEach((p) => MARKALAR.forEach((m) => {
      try { coz(p, m); } catch (e) { kirilan.push(`${p}/${m}: ${e.message}`); }
    }));
    expect(kirilan).toEqual([]);
  });

  // MUTASYON KAPISI: köprünün doldurması OLMAZSA tam olarak dört bileşim
  // kırılır. Bu sayı düşerse düzeltme etkisizleşmiş, artarsa çekirdek
  // katalogu daralmış demektir; ikisi de sessizce olmamalı.
  test('köprü doldurmazsa TAM OLARAK dört bileşim çöker (GATES + PH/PJ/PL/PM)', () => {
    const kirilan = [];
    PROFILLER.forEach((p) => MARKALAR.forEach((m) => {
      try { coz(p, m, { dolgu: false }); } catch (e) { kirilan.push(`${p}/${m}`); }
    }));
    expect(kirilan.sort()).toEqual(['PH/GATES', 'PJ/GATES', 'PL/GATES', 'PM/GATES']);
  });

  test('veFeadBeltGeom 15 bileşimin hepsinde kayıt döndürüyor', () => {
    PROFILLER.forEach((p) => MARKALAR.forEach((m) => {
      const g = B.veFeadBeltGeom(p, m);
      expect(g).toBeTruthy();
      expect(typeof g.hb).toBe('number');
      expect(typeof g.hr).toBe('number');
    }));
  });
});

// ══════════════════════════ 2) ÇEKİRDEKLE AYRIŞMAMA (asıl kapı) ═════════
describe('Proje tablosu ↔ çekirdeğin BELT_DB\'si', () => {
  // Çekirdekteki HER satır proje tablosunda birebir aynı olmalı. Sayı iki
  // yerde durduğu için bu testin kırılması "biri güncellendi, diğeri unutuldu"
  // demektir — tam olarak yakalanması gereken şey.
  test('çekirdeğin sahip olduğu her satır proje tablosuyla BİREBİR aynı', () => {
    const esle = { hb: 'hb', hr: 'hr', ribPitch: 'ribAdim', thickness: 'kalinlik',
                   minPulleyDia: 'minKasnak', maxSpeedMs: 'maksHiz',
                   massPerRibKgM: 'ribKutle' };
    let bakilan = 0;
    Object.keys(Core.BELT_DB).forEach((p) => {
      Object.keys(Core.BELT_DB[p]).forEach((m) => {
        const cek = Core.BELT_DB[p][m], prj = B.veFeadBeltGeom(p, m);
        expect(prj).toBeTruthy();
        Object.keys(esle).forEach((k) => {
          if (cek[k] == null) return;
          expect(`${p}/${m}.${k} = ${prj[esle[k]]}`).toBe(`${p}/${m}.${k} = ${cek[k]}`);
          bakilan++;
        });
      });
    });
    expect(bakilan).toBeGreaterThanOrEqual(11 * 7);   // 11 satır × 7 alan
  });

  test('çekirdekte 11, proje tablosunda 15 satır var — eksik dördü GATES', () => {
    const cekirdek = [];
    Object.keys(Core.BELT_DB).forEach((p) =>
      Object.keys(Core.BELT_DB[p]).forEach((m) => cekirdek.push(`${p}/${m}`)));
    expect(cekirdek.length).toBe(11);
    const eksik = [];
    PROFILLER.forEach((p) => MARKALAR.forEach((m) => {
      if (cekirdek.indexOf(`${p}/${m}`) < 0) eksik.push(`${p}/${m}`);
    }));
    expect(eksik.sort()).toEqual(['PH/GATES', 'PJ/GATES', 'PL/GATES', 'PM/GATES']);
  });
});

// ══════════════════════ 3) ÇALIŞAN YOL BİREBİR DEĞİŞMEDİ ════════════════
describe('Geriye dönük uyum', () => {
  // Köprünün doldurması ÇEKİRDEĞİN BİLDİĞİ bileşimlere dokunmamalı: oradaki
  // kalibre sabiti (cordStiffnessNPerRib) yalnız çekirdekte ve kopyalanmadı.
  test('çekirdeğin bildiği 11 bileşimde tek bir sayı bile değişmiyor', () => {
    Object.keys(Core.BELT_DB).forEach((p) => {
      Object.keys(Core.BELT_DB[p]).forEach((m) => {
        const once = coz(p, m, { dolgu: false });
        const sonra = coz(p, m, { dolgu: true });
        expect(sonra).toEqual(once);
      });
    });
  });

  test('PK/GATES kord rijitliği çekirdekten geliyor — burulma modeli ayakta', () => {
    expect(coz('PK', 'GATES').kord).toBe(Core.BELT_DB.PK.GATES.cordStiffnessNPerRib);
    expect(coz('PK', 'GATES').kord).toBeGreaterThan(0);
  });

  // Kalibre edilmemiş bileşimde uydurulmuş bir rijitlik basmaktansa yokluğu
  // taşınır; çekirdek burulma modelini zaten try/catch'e almış, `null` döner.
  test('yeni açılan dört bileşimde kord rijitliği YOK (uydurulmuyor)', () => {
    ['PH', 'PJ', 'PL', 'PM'].forEach((p) => {
      expect(coz(p, 'GATES').kord).toBeUndefined();
    });
  });

  // Eskiden `veFeadKordOfset` bu dört bileşimde `kaynak:'katalog'` deyip
  // hb/hr'yi NaN döndürüyordu: panel "katalog" yazarken sayı yoktu. Çökmeden
  // beter — bu modülün belgelenmiş sessiz sınıfı.
  test('veFeadKordOfset hiçbir bileşimde NaN döndürmüyor', () => {
    const nan = [];
    PROFILLER.forEach((p) => MARKALAR.forEach((m) => {
      const k = M.veFeadKordOfset({ profile: p, brand: m });
      if (!Number.isFinite(k.hb) || !Number.isFinite(k.hr)) nan.push(`${p}/${m}`);
    }));
    expect(nan).toEqual([]);
  });

  test('projeTablosu bayrağı TAM OLARAK çekirdeğin bilmediği dörtte açık', () => {
    const acik = [];
    PROFILLER.forEach((p) => MARKALAR.forEach((m) => {
      if (M.veFeadKordOfset({ profile: p, brand: m }).projeTablosu) acik.push(`${p}/${m}`);
    }));
    expect(acik.sort()).toEqual(['PH/GATES', 'PJ/GATES', 'PL/GATES', 'PM/GATES']);
  });

  test('proje satırı çekirdeğin alan adlarına çevriliyor — rib kütlesi dahil', () => {
    const r = M.veFeadBeltProjeProps('PJ', 'GATES');
    expect(r.massPerRibKgM).toBe(0.009);   // düşerse açıklık frekansları hesaplanamaz
    expect(r.ribPitch).toBe(2.34);
    expect(r.minPulleyDia).toBe(20);
    expect(r.maxSpeedMs).toBe(60);
  });
});

// ═══════════════════ 4) hb BİR YARIÇAP PAYI — çap DEĞİL ═════════════════
describe('h_b yarıçap payıdır', () => {
  // Optibelt el kitabının formülü: dw = db + 2·hb. Çekirdeğin formülü
  // rPitch = OD/2 + hb. İkisi aynı şey. Yanlış yön (2·hb) kasnak başına
  // h_b kadar kayma demek — PK'da 1,6 mm, merkez mesafesinde 3,2 mm.
  test('rPitch = OD/2 + h_b (kaburgalı) — üç markada da', () => {
    MARKALAR.forEach((m) => {
      const g = B.veFeadBeltGeom('PK', m);
      const bp = { hb: g.hb, hr: g.hr };
      expect(Core.radiiFromOD(159, 'grooved', bp).rPitch).toBeCloseTo(159 / 2 + g.hb, 12);
      expect(Core.radiiFromOD(159, 'back', bp).rPitch).toBeCloseTo(159 / 2 + g.hr, 12);
    });
  });

  test('h_b çap payı sayılsaydı defterin çapı tutmazdı (159 → 161,4)', () => {
    const g = B.veFeadBeltGeom('PK', 'GATES');
    expect(2 * (159 / 2 + g.hb)).toBeCloseTo(161.4, 9);   // defterin F5 hücresi
    expect(159 + g.hb).not.toBeCloseTo(161.4, 3);          // yanlış yön
  });
});

// ═══════════════════════ 5) ÜRETİCİ KATALOĞU ÇIPALARI ═══════════════════
describe('Üretici kataloglarına çıpa', () => {
  // optibelt RB teknik el kitabı, profil tablosu — beş sütunun tamamı.
  test('Optibelt beş profil: s · h · v · db_min · hb', () => {
    const bek = {
      PH: [1.60, 2.50, 60, 13, 0.80], PJ: [2.34, 3.30, 60, 20, 1.25],
      PK: [3.56, 4.60, 50, 45, 1.60], PL: [4.70, 7.00, 40, 75, 3.50],
      PM: [9.40, 13.00, 30, 180, 5.00],
    };
    Object.keys(bek).forEach((p) => {
      const g = B.veFeadBeltGeom(p, 'OPTIBELT');
      expect([g.ribAdim, g.kalinlik, g.maksHiz, g.minKasnak, g.hb]).toEqual(bek[p]);
    });
  });

  // ContiTech CONTI-V MULTIRIB, Tablo 1 — hb ve hr ayrı satırlar.
  // PL'de KIRPIK profil alındı (7,5 mm / 0,037 kg/m); katalog tam profili de
  // veriyor (9,0 / 0,040) ve defterin doğruladığı sayı kırpık olan.
  test('ContiTech beş profil: s · h · hb · hr · db_min · v · kg/m', () => {
    const bek = {
      PH: [1.60, 2.70, 0.8, 1.0, 13, 60, 0.005],
      PJ: [2.34, 3.80, 1.2, 1.1, 20, 60, 0.009],
      PK: [3.56, 5.00, 1.5, 1.5, 45, 50, 0.021],
      PL: [4.70, 7.50, 3.0, 1.5, 75, 40, 0.037],
      PM: [9.40, 14.50, 4.0, 2.0, 180, 35, 0.120],
    };
    Object.keys(bek).forEach((p) => {
      const g = B.veFeadBeltGeom(p, 'CONTITECH');
      expect([g.ribAdim, g.kalinlik, g.hb, g.hr, g.minKasnak, g.maksHiz, g.ribKutle])
        .toEqual(bek[p]);
    });
  });

  // ISO 9982:1998 Tablo 1 (kanal adımı e) ve Tablo 2 (min. etkin çap):
  // profile özgü, markadan BAĞIMSIZ. Üç üreticide de aynı olmalı.
  test('kanal adımı ve min. kasnak çapı markadan bağımsız (ISO 9982)', () => {
    const ISO_E = { PH: 1.60, PJ: 2.34, PK: 3.56, PL: 4.70, PM: 9.40 };
    const ISO_D = { PH: 13, PJ: 20, PK: 45, PL: 75, PM: 180 };
    PROFILLER.forEach((p) => MARKALAR.forEach((m) => {
      const g = B.veFeadBeltGeom(p, m);
      expect(`${p}/${m} e`).toBe(`${p}/${m} e`);
      expect(g.ribAdim).toBe(ISO_E[p]);
      expect(g.minKasnak).toBe(ISO_D[p]);
    }));
  });
});

// ═════════════════════════ 6) KAYNAK DAMGASI ════════════════════════════
describe('Kaynak damgası', () => {
  // Damgasız bir sayı, ölçülmüş bir sayıdan ayırt edilemezdi. Bu modülde
  // geçerlilik sınırı sayının yanında taşınır (kural 8).
  test('her satırın bilinen bir kaynağı var ve metni tanımlı', () => {
    PROFILLER.forEach((p) => MARKALAR.forEach((m) => {
      const g = B.veFeadBeltGeom(p, m);
      expect(Object.keys(B.VE_FEAD_BELT_GEOM_NOTE)).toContain(g.kaynak);
      expect(typeof g.not).toBe('string');
      expect(g.not.length).toBeGreaterThan(0);
    }));
  });

  test('Optibelt ve ContiTech\'in on satırı ÜRETİCİ kataloğundan', () => {
    ['OPTIBELT', 'CONTITECH'].forEach((m) => PROFILLER.forEach((p) => {
      expect(`${p}/${m}: ${B.veFeadBeltGeom(p, m).kaynak}`).toBe(`${p}/${m}: uretici`);
    }));
  });

  // Gates'in TEK ölçülmüş satırı PK. Diğer üçü ISO nominali ve öyle
  // damgalanmalı — "üretici böyle diyor" iddiası olmamalı.
  test('Gates: yalnız PK defter damgalı, PJ/PL/PM ISO damgalı', () => {
    expect(B.veFeadBeltGeom('PK', 'GATES').kaynak).toBe('defter');
    ['PH', 'PJ', 'PL', 'PM'].forEach((p) => {
      expect(`${p}: ${B.veFeadBeltGeom(p, 'GATES').kaynak}`).toBe(`${p}: iso`);
    });
  });

  // Gates'in kendi broşürü: "Micro-V belts are available in PJ, PK, PL and
  // PM cross-sections." PH satırı yine de DOLU — katalog bir kısıt değil bir
  // öneri (kural 11) — ama bayrağı var ve panel onu yazıyor.
  test('Gates PH üretilmiyor bayrağı taşıyor; diğer on dördü taşımıyor', () => {
    expect(B.veFeadBeltGeom('PH', 'GATES').uretilmiyor).toBe(true);
    PROFILLER.forEach((p) => MARKALAR.forEach((m) => {
      if (p === 'PH' && m === 'GATES') return;
      expect(`${p}/${m}`).toBe(`${p}/${m}`);
      expect(B.veFeadBeltGeom(p, m).uretilmiyor).toBeUndefined();
    }));
  });
});

// ═════════════════════════ 7) YAPISAL KURALLAR ══════════════════════════
describe('Tablonun yapısı', () => {
  test('veFeadBeltGeom KOPYA döndürüyor — tablo yerinde bozulamaz', () => {
    const a = B.veFeadBeltGeom('PK', 'GATES');
    a.hb = 999;
    expect(B.veFeadBeltGeom('PK', 'GATES').hb).toBe(1.2);
  });

  test('bilinmeyen profil/marka null; marka boşsa GATES varsayılıyor', () => {
    expect(B.veFeadBeltGeom('PX', 'GATES')).toBeNull();
    expect(B.veFeadBeltGeom('PK', 'YOK')).toEqual(B.veFeadBeltGeom('PK', 'GATES'));
    expect(B.veFeadBeltGeom('PK', null).marka).toBe('GATES');
  });

  test('marka listesi panelin sunduğu üçle aynı', () => {
    expect(B.VE_FEAD_BELT_BRANDS.slice().sort())
      .toEqual(['CONTITECH', 'GATES', 'OPTIBELT']);
  });

  test('profil listesi tablonun anahtarlarıyla aynı', () => {
    expect(Object.keys(B.VE_FEAD_BELT_GEOM).sort())
      .toEqual(B.VE_FEAD_BELT_PROFILES.slice().sort());
  });
});
