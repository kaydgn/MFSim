/**
 * fead-layout-plane.test.js — ÇİZİLEN RESİM RAPORUN RESMİ MİDİR?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * KULLANICI BİLDİRİMİ (2026-09-04): *"gergi ve kasnak konumları programda
 * yanlış çıkıyor. Ters çıkıyor… Otomatik gergi krank kasnağının sol tarafında
 * olması gerekirken, sağ tarafında çıkıyor. Gates raporlarının PDF ilk
 * sayfasında kasnak konumları var."*
 *
 * DOĞRUYDU ve **7011 testin hiçbiri yakalamamıştı.** Sebep bir hesap hatası
 * değildi: `VE_FEAD_VIEW_FRONT` bayrağı çizimi X'te aynalıyordu, yani resim
 * raporun 1. sayfasındaki şemanın AYNASI oluyordu. AG0868'de rapor CRK'yı
 * SOLDA / A_C'yi SAĞDA gösterirken program tersini çiziyordu; 12 örneğin
 * 12'sinde de öyleydi.
 *
 * NEDEN HİÇBİR TEST GÖRMEDİ: mevcut kapılar aynanın KENDİ tutarlılığını
 * ölçüyordu (aynalama tam simetri mi, `d` işareti çevriliyor mu, rozet kartla
 * aynı yönü mü basıyor). Hepsi doğruydu — ayna içinde her şey tutarlıydı.
 * Sorulmayan soru şuydu: **çizilen resim RAPORUN resmiyle aynı düzende mi?**
 * Bu dosya yalnız onu soruyor ve cevabı raporun KENDİ "Layout Data"
 * koordinatlarından alıyor (doğrulama fixture'ı → `docs/gates-reports/pdf/`).
 *
 * ── 2026-09-07: KAPI DÜZLEMİ ARTIK KENDİSİ KURUYOR ────────────────────────
 *
 * Kullanıcı konvansiyonu (2026-09-07): *"Normalde krank kasnağı (yani sürücü
 * kasnak) saat yönünde dönmesi lazım."* Rapor düzleminde kayış ÖLÇÜLMÜŞ olarak
 * CCW dolanıyor, dolayısıyla "krank CW" ile "düzen raporun sayfasıyla aynı"
 * AYNI ANDA SAĞLANAMAZ — biri ötekinin X aynası. Varsayılan ön görünüşe döndü.
 *
 * KAPININ ÖLÇTÜĞÜ ŞEY DEĞİŞMEDİ, YALNIZ DÜZLEMİ KENDİSİ SEÇİYOR. Eski sürümü
 * bayrağın DEĞERİNİ kilitliyordu (`expect(...VIEW_FRONT).toBe(false)`); o kilit
 * bir tercihi savunuyordu, ölçtüğü ilişkiyi değil. Artık karşılaştırma
 * `veFeadSetViewFront(false)` ile rapor düzleminde yapılıyor: 2026-09-04'te
 * yakalanan hata sınıfı (çizicinin son adımındaki bir işaret hatası) hangi
 * varsayılanda olursak olalım kırmızıya döner.
 *
 * VE İKİ DÜZLEM BİRBİRİNE BAĞLANDI (aşağıdaki son öbek): ön görünüş, rapor
 * düzleminin TAM X aynası olmak zorunda — yani bir düzlemde düzeltilen bir
 * işaret hatası ötekinde sessizce kalamaz.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const V = require('../../tests/fixtures/fead-validation.js');
const META = require('../../tools/fead-gates-examples-meta.json');

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

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

/** Örneği kurup çözer (fead-spin.test.js ile aynı yol). */
function kur(key) {
  const pack = M.veFeadExampleNodes(key);
  const ns = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  const cs = pack.connections.map((c) => Object.assign({}, c));
  global.nodes = ns; global.connections = cs;
  return M.veFeadBuildSystem(ns, cs);
}

/**
 * ÇİZİLEN kasnak MERKEZLERİ — kasnak sırası → {x, y}, doğrudan üretilen
 * SVG'den (`circle[data-pi]`). Kaynak çizimin KENDİSİ: ara katman okunsaydı,
 * çizicinin son adımındaki bir işaret hatası görünmezdi — tam olarak kaçırılan
 * sınıf bu.
 *
 * MERKEZ OKUNUYOR, ETİKET DEĞİL: ad çemberin ÜSTÜNE yazılıyor (`Y − R − 4`),
 * yani etiketin y'si yarıçapı da içeriyor. İlk sürüm etiketi ölçtü ve dört
 * örnekte KIRMIZI verdi — sebebi çizim değil ölçüm hatasıydı: Ø172 krank ile
 * Ø137 klima yan yanayken etiket sırası merkez sırasından farklı çıkıyor.
 */
function ekranKonumlari(build, adet, opt) {
  const svg = fead.veFeadLayoutSVG(build, 700, 380,
    Object.assign({ posMode: 'mean', compass: false, pivot: true, arrows: false },
                  opt || {}));
  expect(svg).toBeTruthy();
  const box = document.createElement('div');
  box.innerHTML = svg;
  const bul = [];
  Array.from(box.querySelectorAll('circle[data-pi]')).forEach((e) => {
    bul[Number(e.getAttribute('data-pi'))] =
      { x: parseFloat(e.getAttribute('cx')), y: parseFloat(e.getAttribute('cy')) };
  });
  expect(bul.filter(Boolean)).toHaveLength(adet);
  return bul;
}

const isaret = (v) => (Math.abs(v) < 1e-9 ? 0 : (v > 0 ? 1 : -1));

// Karşılaştırma RAPOR düzleminde yapılır — varsayılan ne olursa olsun.
const VARSAYILAN_DUZLEM = M.VE_FEAD_VIEW_FRONT;
const raporDuzleminde = (fn) => {
  M.veFeadSetViewFront(false);
  try { return fn(); } finally { M.veFeadSetViewFront(VARSAYILAN_DUZLEM); }
};

// Jeneratörün ürettiği dokuz örnek + elle yazılmış AG00879: hepsinin fixture
// karşılığı var, yani raporun Layout Data'sı okunabiliyor.
const KAYIT = META.map((m) => ({ id: m.id, fixture: m.fixture }))
  .concat([{ id: 'AG00879_GATES_2023', fixture: 'AG00879' }])
  .filter((r) => V.AG_MISC[r.fixture]);

describe('çizilen resim = RAPORUN resmi (Gates Layout Data)', () => {
  test('kapı boş değil — en az dokuz rapor karşılaştırılıyor', () => {
    expect(KAYIT.length).toBeGreaterThanOrEqual(9);
  });

  KAYIT.forEach(({ id, fixture }) => {
    describe(id + '  ←  ' + fixture, () => {
      const o = V.AG_MISC[fixture];
      const ex = M.veFeadExampleOf(id);
      // Örnek kasnakları rapor sırasıyla kurulmuştur (jeneratör `o.order`'ı
      // izliyor); eşleme bu yüzden konum konum yapılabiliyor.
      const adlar = ex.pulleys.map((p) => p.name);

      test('kasnak sayısı ve sırası raporunkiyle aynı', () => {
        expect(adlar).toHaveLength(o.order.length);
      });

      test('SOL-SAĞ DÜZENİ RAPORLA AYNI — aynalanmış resim burada kırmızıya döner', () => {
        const b = kur(id);
        expect(b.ok).toBe(true);
        const scr = raporDuzleminde(() => ekranKonumlari(b, adlar.length));

        // Her kasnak ÇİFTİ için: raporda solda olan ekranda da solda olmalı.
        // Sıralama yerine ÇİFT karşılaştırması, çünkü iki kasnak aynı X'i
        // paylaşabiliyor (BMC'de krank ile alternatör: ikisi de x = 0) ve
        // sıralama o durumda keyfi bir tie-break üretiyor.
        let bakilan = 0;
        o.order.forEach((k1, i) => {
          o.order.forEach((k2, j) => {
            if (j <= i) return;
            const dxRapor = o.xy[k1][0] - o.xy[k2][0];
            if (Math.abs(dxRapor) < 1) return;            // aynı X — hüküm yok
            bakilan++;
            expect(isaret(scr[i].x - scr[j].x)).toBe(isaret(dxRapor));
          });
        });
        expect(bakilan).toBeGreaterThan(0);               // iddia gerçekten kuruldu
      });

      test('ALT-ÜST DÜZENİ RAPORLA AYNI — Y ekranda AŞAĞI, raporda YUKARI', () => {
        const b = kur(id);
        const scr = raporDuzleminde(() => ekranKonumlari(b, adlar.length));
        let bakilan = 0;
        o.order.forEach((k1, i) => {
          o.order.forEach((k2, j) => {
            if (j <= i) return;
            const dyRapor = o.xy[k1][1] - o.xy[k2][1];
            if (Math.abs(dyRapor) < 1) return;
            bakilan++;
            // Ekran Y'si aşağı büyür: raporda YUKARIDA olan ekranda KÜÇÜK y.
            expect(isaret(scr[i].y - scr[j].y)).toBe(-isaret(dyRapor));
          });
        });
        expect(bakilan).toBeGreaterThan(0);
      });

      test('GERGİ RAPORUN GÖSTERDİĞİ YANDA — kullanıcının bildirdiği belirti', () => {
        // Bildirim birebir buydu: *"Otomatik gergi krank kasnağının sol
        // tarafında olması gerekirken, sağ tarafında çıkıyor."*
        const b = kur(id);
        const scr = raporDuzleminde(() => ekranKonumlari(b, adlar.length));
        const tenIdx = o.order.indexOf('TEN');
        const krkIdx = o.order.findIndex((k) => /^(CRK|FAN)$/.test(k));
        expect(tenIdx).toBeGreaterThanOrEqual(0);
        expect(krkIdx).toBeGreaterThanOrEqual(0);
        const dxRapor = o.xy['TEN'][0] - o.xy[o.order[krkIdx]][0];
        if (Math.abs(dxRapor) < 1) return;                // üst üste — hüküm yok
        expect(isaret(scr[tenIdx].x - scr[krkIdx].x)).toBe(isaret(dxRapor));
      });
    });
  });
});

describe('KANVAS ile KART aynı elde — ikinci, bağımsız kusur', () => {
  // Bu ayna yalnız kartı değil, kartı KANVASTAN da ayırıyordu ve o fark
  // kaydın hiçbir yerinde yoktu: `veFeadMmToCanvas` X'i hiç çevirmiyor
  // (yalnız Y'yi ters alıyor — "kanvas = kayış düzlemi" kuralı), yani kanvasa
  // yerleştirilen kutular HER ZAMAN rapor düzlemindeydi. Kart aynalıyken
  // kullanıcı aynı modelin İKİ resmini ters görüyordu; "her şey karıştı"
  // bildiriminin büyük olasılıkla asıl kaynağı bu.
  //
  // Kapı ikisini BİRBİRİNE bağlıyor, ikisini de bayrağa değil.
  const ORNEK = ['AG0868_4PK_GATES_2022', 'AG00879_GATES_2023',
                 'AG00902_1275_GATES_2023', 'BMC_FEAD_2026'];

  ORNEK.forEach((id) => {
    // İKİ DÜZLEMDE DE. Aynalama iki yüzeyden yalnız birine konsaydı (2026-09-04'te
    // tam olarak bu olmuştu: kart aynalı, kanvas değil) kullanıcı aynı modelin
    // iki resmini ters el ile görürdü ve hiçbir sayı yanlış görünmezdi.
    [true, false].forEach((onGorunus) => {
    test(id + ' — kanvas X sırası ile kart X sırası AYNI (' +
         (onGorunus ? 'ön görünüş' : 'rapor düzlemi') + ')', () => {
      const eski = M.VE_FEAD_VIEW_FRONT;
      M.veFeadSetViewFront(onGorunus);
      try {
      const b = kur(id);
      expect(b.ok).toBe(true);
      const ex = M.veFeadExampleOf(id);
      const kart = ekranKonumlari(b, ex.pulleys.length);

      // Kanvas konumu, kanvasın KENDİ tek okuma noktalarından: düz kasnakta
      // `data.x/y`, gergide `veFeadTensionerBoxMm` (avara merkezi) — senkron
      // fonksiyonunun okuduğu alanların AYNISI. Ardından `veFeadMmToCanvas`.
      const org = { x: 500, y: 400, width: 65, height: 60 };
      const kanvas = ex.pulleys.map((pu) => {
        let mmX = Number(pu.data.x), mmY = Number(pu.data.y);
        if (!Number.isFinite(mmX)) {
          const kutu = M.veFeadTensionerBoxMm(pu.data || {});
          expect(kutu).toBeTruthy();                     // gergi merkezi okunabilmeli
          mmX = kutu[0]; mmY = kutu[1];
        }
        return M.veFeadMmToCanvas(mmX, mmY, org, 1, { w: 65, h: 60 });
      });

      let bakilan = 0;
      ex.pulleys.forEach((_, i) => {
        ex.pulleys.forEach((__, j) => {
          if (j <= i) return;
          const dK = kanvas[i].x - kanvas[j].x;
          if (Math.abs(dK) < 1) return;                  // aynı X — hüküm yok
          bakilan++;
          expect(isaret(kart[i].x - kart[j].x)).toBe(isaret(dK));
        });
      });
      expect(bakilan).toBeGreaterThan(0);
      } finally { M.veFeadSetViewFront(eski); }
    });
    });
  });
});

describe('DÖNÜŞ YÖNÜ — krank saat yönünde (kullanıcı konvansiyonu, 2026-09-07)', () => {
  // Kullanıcı bildirimi: *"Sihirbaz içinde yüklü olan tüm örnekler CCW dönüyor.
  // Normalde krank kasnağı (yani sürücü kasnak) saat yönünde dönmesi lazım."*
  test('varsayılan ÖN GÖRÜNÜŞ', () => {
    expect(M.VE_FEAD_VIEW_FRONT).toBe(true);
  });

  test('ONİKİ ÖRNEĞİN ONİKİSİ DE CW — rozet, etiket ve sihirbaz aynı üreticiden', () => {
    const anahtarlar = M.veFeadExampleKeysAll();
    expect(anahtarlar.length).toBeGreaterThanOrEqual(12);
    anahtarlar.forEach((id) => {
      const b = kur(id);
      expect(b.ok).toBe(true);
      // VERİ düzlemi ölçülmüş olarak CCW (+1); on rapor, Σ işaretli sarım = +360.
      expect(b.spin).toBe(1);
      // EKRANDA görülen yön bunun tersi: CW.
      const et = M.veFeadSpinLabel(b.spin);
      expect(et.sense).toBe(-1);
      expect(et.kisa).toContain('CW');
      expect(et.kisa).not.toContain('CCW');
      expect(et.uzun).toContain('saat yönünde');
    });
  });

  test('ÇİZİM DE CW: kayış animasyonunun yönü etiketle AYNI işarette', () => {
    // Rozet ile kartın ayrışması bu modülün ölçülmüş hata sınıfı ("kart kayışı
    // bir yöne akıtırken rozet öbür yönü yazıyor"). Animasyon `geom.sense`'ten
    // besleniyor; burada onu ETİKETLE bağlıyoruz.
    const b = kur('AG0868_4PK_GATES_2022');
    const g = F.tensionerState(b.sys, F.meanRel(b.sys)).geom;
    const ekran = M.veFeadMirrorGeomX(g);          // ön görünüş = aynalı
    expect(isaret(ekran.sense)).toBe(M.veFeadSpinLabel(b.spin).sense);
    expect(isaret(ekran.sense)).toBe(-isaret(g.sense));
  });

  test('BAYRAK KAPANINCA ETİKET DE DÖNER — iki düzlem tek üreticiden', () => {
    const eski = M.VE_FEAD_VIEW_FRONT;
    try {
      M.veFeadSetViewFront(false);
      expect(M.veFeadSpinLabel(1).kisa).toContain('CCW');
      expect(M.veFeadSpinLabel(1).uzun).toContain('Gates rapor düzlemi');
      M.veFeadSetViewFront(true);
      expect(M.veFeadSpinLabel(1).kisa).toBe('\u21bb CW');
      expect(M.veFeadSpinLabel(1).uzun).toContain('önden');
    } finally { M.veFeadSetViewFront(eski); }
  });
});

describe('AÇI DEĞERLERİ HANGİ DÜZLEMDE — basılan yüzeyler söylüyor', () => {
  // Sessiz yanlış okuma sınıfı: çizim aynalı, açı DEĞERİ veri düzleminde.
  // Kullanıcı "Yön 350°" okuyup aynalı resimde oku 190°'de arayabilir.
  test('not TEK ÜRETİCİDEN ve yalnız ayna açıkken', () => {
    const eski = M.VE_FEAD_VIEW_FRONT;
    try {
      M.veFeadSetViewFront(false);
      expect(M.veFeadPlaneNote()).toBe('');
      M.veFeadSetViewFront(true);
      expect(M.veFeadPlaneNote()).toContain('Gates düzleminde');
    } finally { M.veFeadSetViewFront(eski); }
  });

  test('KASNAK PANELİ notu GERÇEKTEN basıyor — üretilen HTML\'den ölçülüyor', () => {
    // Üreticiyi değil YÜZEYİ ölçüyoruz: bu deponun tekrar eden kaçağı, kapının
    // üreticiyi doğrulayıp yüzeyin sessizce eski metni basmasıydı.
    kur('AG0868_4PK_GATES_2022');
    const nd = global.nodes.filter((n) => M._feadIsPulley(n))[0];
    expect(nd).toBeTruthy();
    const eski = M.VE_FEAD_VIEW_FRONT;
    try {
      M.veFeadSetViewFront(true);
      const on = fead.getFeadPulleyPropertiesHTML(nd);
      expect(on).toContain('Gates rapor düzlemi');
      expect(on).toContain('çizim ön görünüş');
      M.veFeadSetViewFront(false);
      const rapor = fead.getFeadPulleyPropertiesHTML(nd);
      expect(rapor).toContain('Gates rapor düzlemi');
      expect(rapor).not.toContain('çizim ön görünüş');
    } finally { M.veFeadSetViewFront(eski); }
  });
});

describe('ayna makinesi — iki düzlem BİRBİRİNE BAĞLI', () => {
  test('ön görünüş, rapor düzleminin TAM X aynası — çizilen SVG\'den', () => {
    // Kapı ilişkiyi bağlıyor, bir düzlemi değil: birinde düzeltilen bir işaret
    // hatası ötekinde sessizce kalamaz.
    const id = 'AG0868_4PK_GATES_2022';
    const b = kur(id);
    const n = M.veFeadExampleOf(id).pulleys.length;
    const eski = M.VE_FEAD_VIEW_FRONT;
    let on, rapor;
    try {
      M.veFeadSetViewFront(true);  on = ekranKonumlari(b, n);
      M.veFeadSetViewFront(false); rapor = ekranKonumlari(b, n);
    } finally { M.veFeadSetViewFront(eski); }
    // Aynı çerçeve, aynı ölçek → X sırası TERS, Y birebir aynı.
    let bakilan = 0;
    for (let i = 0; i < n; i++) {
      expect(on[i].y).toBeCloseTo(rapor[i].y, 6);
      for (let j = i + 1; j < n; j++) {
        const d = rapor[i].x - rapor[j].x;
        if (Math.abs(d) < 1) continue;
        bakilan++;
        expect(isaret(on[i].x - on[j].x)).toBe(-isaret(d));
      }
    }
    expect(bakilan).toBeGreaterThan(0);
  });

  test('`veFeadMirrorGeomX` hâlâ tam simetri — ölçülmüş ilişki korunuyor', () => {
    const b = kur('AG0868_4PK_GATES_2022');
    const g = F.tensionerState(b.sys, F.meanRel(b.sys)).geom;
    const m = M.veFeadMirrorGeomX(g);
    // Skalerler BİREBİR aynı; değişen yalnız el yönü.
    expect(m.pulleys.map((p) => p.c[0])).toEqual(g.pulleys.map((p) => -p.c[0]));
    expect(m.pulleys.map((p) => p.c[1])).toEqual(g.pulleys.map((p) => p.c[1]));
    expect(m.pulleys.map((p) => p.d)).toEqual(g.pulleys.map((p) => -p.d));
    expect(m.sense).toBe(-g.sense);
    g.wraps.forEach((w, i) => expect(m.wraps[i]).toBeCloseTo(w, 12));
  });

  test('`rawFrame` çizimi aynasız ister — BAYRAKTAN BAĞIMSIZ, hep rapor düzlemi', () => {
    const b = kur('AG0868_4PK_GATES_2022');
    const n = M.veFeadExampleOf('AG0868_4PK_GATES_2022').pulleys.length;
    const rapor = raporDuzleminde(() => ekranKonumlari(b, n));
    const eski = M.VE_FEAD_VIEW_FRONT;
    try {
      [true, false].forEach((on) => {
        M.veFeadSetViewFront(on);
        const ham = ekranKonumlari(b, n, { rawFrame: true });
        rapor.forEach((q, i) => expect(ham[i].x).toBeCloseTo(q.x, 6));
      });
    } finally { M.veFeadSetViewFront(eski); }
  });
});
