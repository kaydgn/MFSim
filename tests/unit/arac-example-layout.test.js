/**
 * arac-example-layout.test.js
 * ───────────────────────────
 * Araç Performans örneklerinin KANONİK YERLEŞİM kapısı.
 *
 * KULLANICI ŞİKÂYETİ (2026-08-17): "örneklerin topolojileri biraz karışık
 * olmuş; bileşenler arası bağlantılar daha düzgün, çizgi biçiminde olmalı."
 *
 * KÖK NEDEN (ölçüldü): örnek dosyaları js/cp-arac-performans.js →
 * VE_ARAC_PERFORMANS_LAYOUT ızgarasından üretilmişti ama o ızgara PORT
 * GEOMETRİSİNİ saymıyordu:
 *   • motor 66×76 ve çıkışı %50'de (y+38), sıradan kutu 65×60 ve portu y+30 —
 *     ikisi aynı ly'ye konunca motor→konvertör teli 8 px eğik çıkıyordu;
 *   • transfer→diferansiyel dalları eksenden −80 / +110 px sapıyordu, yani fan
 *     simetrik değildi; tekerlek dörtlüsünün merkezi şaft ekseninden 40 px
 *     aşağıdaydı;
 *   • bütün bağlantılar 'curve' idi, dallanmalar da dahil.
 *
 * Bu dosya düzeltmeyi SAYIYLA tutar. Kırılgan değil: bir etiketi değil,
 * ölçülebilir geometriyi (port y'leri, simetri, kesişim) sınıyor ve port
 * geometrisini GERÇEK kaynaktan (js/components.js vePortOffset) okuyor —
 * yerleşim ile çizim kodu ayrışırsa burası kırmızıya döner.
 */
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
eval(loadSource('components.js'));      // gerçek componentDefs + vePortOffset
eval(loadSource('connections.js'));     // gerçek getPortPosition

const { VE_ARAC_PERFORMANS_LAYOUT } = require('../../js/cp-arac-performans.js');

const ROOT = path.join(__dirname, '..', '..');
const EXDIR = path.join(ROOT, 'assets', 'examples');
const FILES = fs.readdirSync(EXDIR).filter(f => /^ap_.*_topoloji\.json$/.test(f)).sort();
const load = f => JSON.parse(fs.readFileSync(path.join(EXDIR, f), 'utf8'));
const EXAMPLES = FILES.map(f => [f, load(f)]);

// Zincirin dört halkası — aralarındaki bağlantı TAM YATAY olmak zorunda.
const CHAIN = ['engine', 'torque-converter', 'gearbox', 'propshaft', 'transfer'];
const CHAIN_PAIRS = new Set(CHAIN.slice(0, -1).map((t, i) => t + '|' + CHAIN[i + 1]));

const byId = doc => new Map(doc.nodes.map(n => [n.id, n]));
const pair = (doc, c) => {
  const m = byId(doc);
  return [m.get(c.from), m.get(c.to)];
};
const P = (node, port) => getPortPosition(node, port);

test('örnek dosyası bulundu (kapı boşa koşmasın)', () => {
  expect(FILES.length).toBeGreaterThanOrEqual(15);
});

describe('şaft ekseni — güç zincirinin bağlantıları TAM YATAY', () => {
  test.each(EXAMPLES)('%s', (_f, doc) => {
    const chain = doc.connections.filter(c => {
      const [a, b] = pair(doc, c);
      return CHAIN_PAIRS.has(a.type + '|' + b.type);
    });
    expect(chain.length).toBe(CHAIN.length - 1);   // dördü de var
    chain.forEach(c => {
      const [a, b] = pair(doc, c);
      const y1 = P(a, c.fromPort || 'output').y;
      const y2 = P(b, c.toPort || 'input').y;
      // Eşit y ⇒ 'curve' kübik Bézier'i düz yatay çizgiye çöker (kontrol
      // noktaları da aynı y'de: js/connections.js updateAllConnections).
      expect(y2).toBeCloseTo(y1, 9);
    });
  });

  test.each(EXAMPLES)('%s — zincir tek eksende, hepsi aynı y', (_f, doc) => {
    // Motorun ÇIKIŞI ile geri kalan dört halkanın GİRİŞİ tek eksende.
    // (Çıkış portları tipe göre bölünüyor: transfer 6×6'da üç çıkışlı, bu
    // yüzden eksen ölçüsü giriş portundan alınır — o hep %50'de.)
    const axis = P(doc.nodes.find(n => n.type === 'engine'), 'output').y;
    CHAIN.slice(1).forEach(t => {
      const n = doc.nodes.find(x => x.type === t);
      expect([t, P(n, 'input').y]).toEqual([t, axis]);
    });
    // Transfer çıkışları ekseni ORTALAR: ilk ve son sapma eşit ve zıt.
    const outs = doc.connections.filter(c => c.from === doc.nodes.find(n => n.type === 'transfer').id);
    const tr = doc.nodes.find(n => n.type === 'transfer');
    const dy = outs.map(c => P(tr, c.fromPort).y - axis).sort((a, b) => a - b);
    expect(dy[0] + dy[dy.length - 1]).toBeCloseTo(0, 9);
  });
});

describe('fan simetrisi — dallar eksenden EŞİT ve ZIT sapıyor', () => {
  test.each(EXAMPLES)('%s', (_f, doc) => {
    const m = byId(doc);
    let fans = 0;
    doc.nodes.forEach(n => {
      const outs = doc.connections.filter(c => c.from === n.id);
      const ports = new Set(outs.map(c => c.fromPort || 'output'));
      // Gerçek dallanma = birden çok AYRI çıkış portu. Motorun tek portundan
      // çıkan ikinci tel (ec-matching) fan değildir.
      if (ports.size < 2 || ports.size !== outs.length) return;
      fans++;
      const dev = outs
        .slice()
        .sort((a, b) => (a.fromPort < b.fromPort ? -1 : 1))
        .map(c => P(m.get(c.to), c.toPort || 'input').y - P(n, c.fromPort).y);
      expect(dev[0] + dev[dev.length - 1]).toBeCloseTo(0, 9);
      if (dev.length === 3) expect(dev[1]).toBeCloseTo(0, 9);   // orta dal düz
    });
    // 4×4 → transfer + 2 dif = 3 fan; 6×6 → transfer + 3 dif = 4 fan
    expect(fans).toBe(doc.nodes.filter(n => n.type === 'differential').length + 1);
  });
});

describe('bağlantı biçimi — zincir düz çizgi, dallar dik açılı', () => {
  test.each(EXAMPLES)('%s', (_f, doc) => {
    doc.connections.forEach(c => {
      const [a, b] = pair(doc, c);
      const want = CHAIN_PAIRS.has(a.type + '|' + b.type) ? 'curve' : 'stepped';
      expect([a.type + '→' + b.type, c.lineType]).toEqual([a.type + '→' + b.type, want]);
      expect(c.controlPoints).toEqual([]);
    });
  });
});

describe('temiz güzergâh — hiçbir bağlantı bir bileşenin ÜSTÜNDEN geçmiyor', () => {
  // 'stepped' güzergâhı: (x1,y1) → (midX,y1) → (midX,y2) → (x2,y2)
  // (js/connections.js). Dikey bacak iki sütunun tam ortasından iner; kapı
  // o bacağın gerçekten BOŞ kanalda kaldığını ölçer.
  const segHitsBox = ([ax, ay, bx, by], n) => {
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx);
    const y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    return x1 > n.x && x0 < n.x + n.width && y1 > n.y && y0 < n.y + n.height;
  };
  test.each(EXAMPLES)('%s', (_f, doc) => {
    doc.connections.forEach(c => {
      const [a, b] = pair(doc, c);
      const p1 = P(a, c.fromPort || 'output'), p2 = P(b, c.toPort || 'input');
      expect(p2.x).toBeGreaterThan(p1.x);          // hiçbir tel geriye akmıyor
      const mid = (p1.x + p2.x) / 2;
      const segs = c.lineType === 'stepped'
        ? [[p1.x, p1.y, mid, p1.y], [mid, p1.y, mid, p2.y], [mid, p2.y, p2.x, p2.y]]
        : [[p1.x, p1.y, p2.x, p2.y]];
      doc.nodes.forEach(n => {
        if (n.id === a.id || n.id === b.id) return;
        segs.forEach(s => {
          expect([c.from + '→' + c.to + ' ⟂ ' + n.type, segHitsBox(s, n)])
            .toEqual([c.from + '→' + c.to + ' ⟂ ' + n.type, false]);
        });
      });
    });
  });
});

describe('bileşen kutuları çakışmıyor', () => {
  test.each(EXAMPLES)('%s', (_f, doc) => {
    const ns = doc.nodes;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j];
        const hit = a.x < b.x + b.width && b.x < a.x + a.width &&
                    a.y < b.y + b.height && b.y < a.y + a.height;
        expect([a.type + ' ↔ ' + b.type, hit]).toEqual([a.type + ' ↔ ' + b.type, false]);
      }
    }
  });
});

describe('örnekler arası uygunluk — hepsi AYNI ızgarada', () => {
  test('aynı tip her örnekte aynı sütunda (x)', () => {
    const cols = new Map();
    EXAMPLES.forEach(([f, doc]) => doc.nodes.forEach(n => {
      if (!cols.has(n.type)) cols.set(n.type, new Map());
      cols.get(n.type).set(n.x, (cols.get(n.type).get(n.x) || 0) + 1);
    }));
    cols.forEach((xs, type) => {
      expect([type, [...xs.keys()]]).toEqual([type, [...xs.keys()].slice(0, 1)]);
    });
  });

  test('ölçüler tip varsayılanında — elle sürüklenmiş artık yok', () => {
    EXAMPLES.forEach(([f, doc]) => doc.nodes.forEach(n => {
      const d = veNodeDefaultSize(n.type);
      expect([f, n.type, n.width, n.height]).toEqual([f, n.type, d.w, d.h]);
    }));
  });

  test('şaft ekseni bütün örneklerde aynı y', () => {
    const axes = EXAMPLES.map(([, doc]) =>
      P(doc.nodes.find(n => n.type === 'gearbox'), 'output').y);
    axes.forEach(y => expect(y).toBe(axes[0]));
  });
});

describe('kod ile veri ayrışmasın — VE_ARAC_PERFORMANS_LAYOUT tek kaynak', () => {
  // Örnek dosyaları bu ızgaradan üretiliyor. Biri elle düzeltilip diğeri
  // unutulursa "Örneği Aktar" sonrası yeni eklenen bileşen yerleşimin dışına
  // düşer — sessiz ayrışma. Kapı ikisini birbirine bağlar.
  const key = it => `${it.type}@${it.lx},${it.ly}`;
  const want = VE_ARAC_PERFORMANS_LAYOUT.map(key).sort();

  const FOURBY = EXAMPLES.filter(([, d]) => d.nodes.filter(n => n.type === 'differential').length === 2);

  test('4×4 örnekleri yerleşimle BİREBİR aynı (taban kaydırması dışında)', () => {
    expect(FOURBY.length).toBeGreaterThan(5);
    FOURBY.forEach(([f, doc]) => {
      const minX = Math.min(...doc.nodes.map(n => n.x));
      const minY = Math.min(...doc.nodes.map(n => n.y));
      const got = doc.nodes.map(n => key({ type: n.type, lx: n.x - minX, ly: n.y - minY })).sort();
      expect([f, got]).toEqual([f, want]);
    });
  });

  test('yerleşimdeki ölçüler bileşen varsayılanıyla tutarlı', () => {
    VE_ARAC_PERFORMANS_LAYOUT.forEach(it => {
      const d = veNodeDefaultSize(it.type);
      if (it.w !== undefined) expect([it.type, it.w, it.h]).toEqual([it.type, d.w, d.h]);
      // Ölçü verilmemişse veArrangeModuleBase 65×60 sayar — o zaman tip de
      // 65×60 OLMALI, yoksa ortalama kayar (FEAD kartında tam bu olmuştu).
      else expect([it.type, d.w, d.h]).toEqual([it.type, 65, 60]);
    });
  });
});
