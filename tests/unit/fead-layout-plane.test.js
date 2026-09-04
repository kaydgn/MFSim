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
 * KAPI BAYRAKTAN BAĞIMSIZ DEĞİL, BİLEREK: varsayılan bir daha ters çevrilirse
 * bu dosya kırmızıya döner. Ayna makinesi silinmedi (ölçülmüş bir ilişkiyi
 * taşıyor, bkz. docs/gates-reports/README.md §5-6); yalnız VARSAYILAN artık
 * rapor düzlemi ve kapısı burada.
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
function ekranKonumlari(build, adet) {
  const svg = fead.veFeadLayoutSVG(build, 700, 380,
    { posMode: 'mean', compass: false, pivot: true, arrows: false });
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
        const scr = ekranKonumlari(b, adlar.length);

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
        const scr = ekranKonumlari(b, adlar.length);
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
        const scr = ekranKonumlari(b, adlar.length);
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

describe('ayna makinesi DURUYOR — silinmedi, yalnız varsayılan değil', () => {
  test('varsayılan RAPOR düzlemi', () => {
    expect(M.VE_FEAD_VIEW_FRONT).toBe(false);
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

  test('`rawFrame` çizimi aynasız ister — varsayılanla AYNI resmi verir', () => {
    const b = kur('AG0868_4PK_GATES_2022');
    const adlar = M.veFeadExampleOf('AG0868_4PK_GATES_2022').pulleys.map((p) => p.name);
    const a = ekranKonumlari(b, adlar.length);
    const svg = fead.veFeadLayoutSVG(b, 700, 380,
      { posMode: 'mean', compass: false, pivot: true, arrows: false, rawFrame: true });
    const box = document.createElement('div'); box.innerHTML = svg;
    const ham = [];
    Array.from(box.querySelectorAll('circle[data-pi]')).forEach((e) => {
      ham[Number(e.getAttribute('data-pi'))] = parseFloat(e.getAttribute('cx'));
    });
    a.forEach((q, i) => expect(ham[i]).toBeCloseTo(q.x, 6));
  });
});
