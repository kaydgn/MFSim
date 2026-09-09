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
 * ── 2026-09-07 → 09-08: AYNA KALKTI, YÖN DÜZELDİ ──────────────────────────
 *
 * Kullanıcı konvansiyonu (2026-09-07): *"Normalde krank kasnağı (yani sürücü
 * kasnak) saat yönünde dönmesi lazım."* Bir tur boyunca bu, "rapor düzleminde
 * kayış CCW dolanıyor, dolayısıyla krank CW ile raporun düzeni aynı anda
 * sağlanamaz" diye okundu ve çizim X'te AYNALANDI. Kullanıcı üç kez reddetti
 * ve haklıydı: ayna kaldırıldı (bu dosyanın "ÇİZİM AYNALANMAZ" öbeği).
 *
 * ÇELİŞKİ YOKTU — YANLIŞ OLAN OKUMAYDI. Gates'in kasnak tablosu (ve ondan
 * kurulan liste) kayışın gidişinin TERSİ sırada yazılı: çekirdeğin gerilme
 * zinciri listeyi yürürken sürücüde `+P/v` yazıyor, oysa sürücü kayışı
 * kendine ÇEKER (gergin taraf ona giren açıklık). İkisi ancak liste = gidişin
 * tersi ise bağdaşır; AG00976 raporunun kendi okları (`FAN -> ALT`) ve gerilme
 * satırı (tablo sırasında aksesuarda DÜŞÜYOR) bunu doğruluyor. Liste CCW
 * dolanıyor → kayış CW akıyor → krank CW. Aynı çizim, aynı sayılar, doğru
 * işaret. Kapı: `tests/unit/fead-spin.test.js` → "LİSTE SIRASI KAYIŞIN
 * GİDİŞİNİN TERSİ"; bu dosyadaki oniki-örnek öbeği de artık CW'yi kilitliyor.
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
  return M.veFeadBuildSystem(ns);
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

// ÇİZİM AYNALANMAZ: karşılaştırma doğrudan yapılır, kurulacak bir düzlem yok.
const raporDuzleminde = (fn) => fn();

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
    // Kanvas kutuları ile kart AYNI ELDE olmak zorunda. Bir dönem kart aynalı,
    // kanvas değildi (2026-09-04) ve kullanıcı aynı modelin iki resmini ters
    // görüyordu; ayna kalktığı için ikisi de artık tek çerçevede.
    test(id + ' — kanvas X sırası ile kart X sırası AYNI', () => {
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
    });
  });
});

describe('ÇİZİM AYNALANMAZ — konumlar raporun Layout Data\'sıdır', () => {
  // KULLANICI ÜÇ KEZ BİLDİRDİ, üçüncüsünde dört kaynakla gösterdi (2026-09-07):
  // Gates AG00976 raporunun şeması, aynı raporun Layout Data tablosu, sistemin
  // CAD görüntüsü ve mühendisin Excel tasarımı — dördü de AYNI düzeni veriyor.
  //
  // Sorun hiçbir zaman VERİDE değildi: depodaki örnek raporun koordinatlarının
  // birebir aynısını taşıyor. Sorun, çizim anında X'i çeviren bir bayraktı ve
  // o bayrak üç turda üç kez yanlış resim üretti. KALDIRILDI.
  //
  // Bu öbek bayrağın yokluğunu değil, RESMİN KENDİSİNİ ölçüyor.

  test('ayna makinesi ÇİZİM YOLUNDAN çağrılamaz — bayrak da erişimci de YOK', () => {
    expect(M.VE_FEAD_VIEW_FRONT).toBeUndefined();
    expect(M.veFeadSetViewFront).toBeUndefined();
    expect(M.veFeadViewFront).toBeUndefined();
    expect(M.veFeadSpinToFront).toBeUndefined();
    expect(M.veFeadPlaneNote).toBeUndefined();
    // Saf simetri fonksiyonu DURUYOR — ölçülmüş bir ilişkiyi taşıyor, ama
    // yalnız kendi testinde kullanılıyor.
    expect(typeof M.veFeadMirrorGeomX).toBe('function');
  });

  // AG00976 — kullanıcının gönderdiği raporun KENDİ "Layout Data" tablosu.
  // Bu örnek fixture'da yok (jeneratörden gelmiyor), o yüzden çıpa burada.
  const AG00976 = {
    'Sürücü Kasnak (FAN)':    [0.00, 0.00],
    'Avara 1':                [130.10, 139.90],
    'Klima Kompresörü':       [184.20, 314.50],
    'Avara 2':                [0.00, 267.40],
    'Alternatör (155 A)':     [-281.00, 259.50],
    'Otomatik Gergi (E9843)': [-161.97, 91.29],
  };

  test('AG00976 örneği raporun koordinatlarını BİREBİR taşıyor', () => {
    const ex = M.veFeadExampleOf('AG00976_GATES_2025');
    ex.pulleys.forEach((pu) => {
      const bek = AG00976[pu.name];
      expect(bek).toBeTruthy();
      const d = pu.data || {};
      let x = Number(d.x), y = Number(d.y);
      if (!Number.isFinite(x)) {
        const kutu = M.veFeadTensionerBoxMm(d);
        expect(kutu).toBeTruthy();
        x = kutu[0]; y = kutu[1];
      }
      expect(x).toBeCloseTo(bek[0], 2);
      expect(y).toBeCloseTo(bek[1], 2);
    });
  });

  // ── HEPSİ, TEK TEK ────────────────────────────────────────────────────
  //
  // Kullanıcı sordu: *"Sadece bu örnek için mi yaptın?"* Haklı bir şüpheydi —
  // önceki sürümde bu öbek YALNIZ AG00976'yı çiviliyordu. Aynalama global
  // olarak kalktı ama KAPI tek örneğe bakıyordu; bir kapı ölçmediği yerde
  // yoktur. Artık ONİKİ ÖRNEĞİN ONİKİSİ de burada.
  const ORNEKLER = M.veFeadExampleKeysAll();

  const mmOf = (pu) => {
    const d = pu.data || {};
    let x = Number(d.x), y = Number(d.y);
    if (!Number.isFinite(x)) {
      const k = M.veFeadTensionerBoxMm(d);
      if (k) { x = k[0]; y = k[1]; }
    }
    return { x: x, y: y };
  };

  test('kapı boş değil — en az oniki örnek ölçülüyor', () => {
    expect(ORNEKLER.length).toBeGreaterThanOrEqual(12);
  });

  ORNEKLER.forEach((key) => {
    test(key + ' — ÇİZİLEN X sırası saklanan mm ile AYNI (ayna yok)', () => {
      const b = kur(key);
      expect(b.ok).toBe(true);
      const ex = M.veFeadExampleOf(key);
      const scr = ekranKonumlari(b, ex.pulleys.length);

      // ÇİFT ÇİFT: iki kasnak aynı X'i paylaşabiliyor (AG00976'da FAN ile
      // IDR2, ikisi de x = 0) ve sıralama orada keyfi bir tie-break üretir.
      let bakilan = 0;
      ex.pulleys.forEach((p1, i) => {
        ex.pulleys.forEach((p2, j) => {
          if (j <= i) return;
          const dmm = mmOf(p1).x - mmOf(p2).x;
          if (!Number.isFinite(dmm) || Math.abs(dmm) < 1) return;
          bakilan++;
          expect(isaret(scr[i].x - scr[j].x)).toBe(isaret(dmm));
        });
      });
      expect(bakilan).toBeGreaterThan(0);
    });
  });

  test('ÇİZİLEN RESİM de aynı — ALT ve gergi SOLDA, klima SAĞDA', () => {
    // Kullanıcının bildirdiği belirtinin birebir kendisi. Aynalı bir çizimde
    // bu kapı kırmızıya döner; ölçülen şey etiket değil SVG'nin cx'i.
    const b = kur('AG00976_GATES_2025');
    expect(b.ok).toBe(true);
    const ex = M.veFeadExampleOf('AG00976_GATES_2025');
    const scr = ekranKonumlari(b, ex.pulleys.length);
    const ix = (ad) => ex.pulleys.findIndex((p) => p.name === ad);

    const fan = scr[ix('Sürücü Kasnak (FAN)')];
    const alt = scr[ix('Alternatör (155 A)')];
    const ac = scr[ix('Klima Kompresörü')];
    const ten = scr[ix('Otomatik Gergi (E9843)')];

    expect(alt.x).toBeLessThan(fan.x);      // ALT krankın SOLUNDA
    expect(ten.x).toBeLessThan(fan.x);      // gergi krankın SOLUNDA
    expect(ac.x).toBeGreaterThan(fan.x);    // klima krankın SAĞINDA
    expect(alt.x).toBeLessThan(ten.x);      // ALT gerginin de solunda
    // Y: krank en altta (ekran y'si en büyük)
    expect(fan.y).toBeGreaterThan(ac.y);
    expect(fan.y).toBeGreaterThan(alt.y);
  });

  test('ONİKİ ÖRNEĞİN ONİKİSİNDE DE KRANK SAAT YÖNÜNDE — liste CCW, gidiş tersi', () => {
    const anahtarlar = M.veFeadExampleKeysAll();
    expect(anahtarlar.length).toBeGreaterThanOrEqual(12);
    anahtarlar.forEach((id) => {
      const b = kur(id);
      expect(b.ok).toBe(true);
      // Liste (Gates tablo) sırasının dolanımı CCW — Σ işaretli sarım = +360.
      const g = F.tensionerState(b.sys, b.relDeg || F.meanRel(b.sys)).geom;
      expect(g.sense).toBe(1);
      // Kayışın gerçek dönüşü onun TERSİ: krank saat yönünde.
      expect(b.spin).toBe(-1);
      const et = M.veFeadSpinLabel(b.spin);
      expect(et.sense).toBe(-1);                  // etiket çizilen yönü basar
      expect(et.kisa).toBe('\u21bb CW');
      expect(et.uzun).toContain('Gates rapor düzlemi');
    });
  });

  test('ROTAYI YERİNDE ÇEVİRMEK FİZİĞİ KIRAR — ölçülmüş bedel, kayıt için', () => {
    // "Konumlar dursun, kayış ters yürüsün" yolunun bedeli. Kayıt burada
    // duruyor ki bir sonraki oturum yeniden ölçmek zorunda kalmasın.
    // 2026-09-08: krank CW için bu yola GEREK KALMADI — liste zaten gidişin
    // tersi, dolayısıyla ileri kablolama CW demek. Kabloları çevirmek CCW
    // verir ve bedeli aşağıdaki gibi: gergi gergin tarafa düşer.
    const key = 'BMC_FEAD_2026';
    const rows = (M.veFeadExampleOf(key).solver || {}).duty || [];
    expect(rows.length).toBeGreaterThan(0);

    const enDusukSpan = (ters) => {
      const pack = M.veFeadExampleNodes(key);
      const ns = pack.nodes.map((n) => {
        const d = componentDefs[n.type] || {};
        return { id: n.id, type: n.type, customName: n.customName || null, def: d,
                 x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
                 data: JSON.parse(JSON.stringify(n.data || {})) };
      });
      global.nodes = ns; global.connections = [];
      // ÇEVİRME ARTIK SIRADAN (kablo 2026-09-09'da kalktı): Dönüş Yönü düğümü
      // beltIndex'leri yeniden yazıyor. Ölçülen bedel aynı bedel.
      if (ters) M.veFeadReverseRoute(ns);
      const b = M.veFeadBuildSystem(ns);
      expect(b.ok).toBe(true);
      const R = M.veFeadAnalyze(b, { rows: rows, cylinders: 6 });
      expect(R.ok).toBe(true);
      let en = Infinity;
      ((R.analysis && R.analysis.duty) || []).forEach((d) => {
        (d.perPulley || []).forEach((x) => {
          const t = Number(x.exitTensionN);
          if (Number.isFinite(t) && t < en) en = t;
        });
      });
      return { spin: b.spin, enDusuk: en };
    };

    const ileri = enDusukSpan(false);
    const geri = enDusukSpan(true);
    expect(ileri.spin).toBe(-1);                   // Gates sırası → krank CW
    expect(geri.spin).toBe(1);                     // çevrilmiş → CCW, ve bedeli:
    expect(ileri.enDusuk).toBeCloseTo(526, 0);
    expect(geri.enDusuk).toBeCloseTo(-196, 0);     // NEGATİF — fiziksel olarak yok
  });

  test('`veFeadMirrorGeomX` hâlâ tam simetri — ölçülmüş ilişki korunuyor', () => {
    const b = kur('AG0868_4PK_GATES_2022');
    const g = F.tensionerState(b.sys, F.meanRel(b.sys)).geom;
    const m = M.veFeadMirrorGeomX(g);
    expect(m.pulleys.map((p) => p.c[0])).toEqual(g.pulleys.map((p) => -p.c[0]));
    expect(m.pulleys.map((p) => p.c[1])).toEqual(g.pulleys.map((p) => p.c[1]));
    expect(m.pulleys.map((p) => p.d)).toEqual(g.pulleys.map((p) => -p.d));
    expect(m.sense).toBe(-g.sense);
    g.wraps.forEach((w, i) => expect(m.wraps[i]).toBeCloseTo(w, 12));
  });

  test('`rawFrame` çizimi varsayılanla AYNI resmi verir — ayna yok', () => {
    const b = kur('AG0868_4PK_GATES_2022');
    const n = M.veFeadExampleOf('AG0868_4PK_GATES_2022').pulleys.length;
    const a = ekranKonumlari(b, n);
    const ham = ekranKonumlari(b, n, { rawFrame: true });
    a.forEach((q, i) => expect(ham[i].x).toBeCloseTo(q.x, 6));
  });
});
