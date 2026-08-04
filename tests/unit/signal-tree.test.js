/**
 * js/signal-tree.js — Veri Gezgini sinyal ağacının çekirdek mantığı
 *
 * Burada test edilenler kasıtlı olarak SAF olanlar: arama katlaması, üç-durumlu
 * grup hesabı, istatistik, mini eğri noktaları, kanal toplama. HTML üreten
 * fonksiyonlar (veSigRowHTML/veSigGroupHTML) test edilmiyor — bir etiketi
 * değiştirince kırılan, davranışı değil detayı ölçen testler olurdu
 * (bkz. CLAUDE.md "Test Politikası").
 */

// componentDefs / COMPONENT_SIGNALS modülde `typeof ... !== 'undefined'` ile
// okunuyor; require'dan ÖNCE global'e kurulmaları gerekmiyor ama çağrı anında
// var olmalılar.
global.componentDefs = {
  'engine': { name: 'Motor' },
  'torque-converter': { name: 'Tork Konvertörü' },
  'gearbox': { name: 'Şanzıman' },
  'vehicle': { name: 'Araç' }
};
global.COMPONENT_SIGNALS = {
  'engine': {
    outputs: [
      { id: 'rpm', name: 'Motor Devri', unit: 'rpm' },
      { id: 'torque', name: 'Net Motor Torku', unit: 'Nm' },
      { id: 'power', name: 'Motor Gücü', unit: 'kW' }
    ]
  },
  'gearbox': {
    outputs: [
      { id: 'rpm_in', name: 'Giriş Devri', unit: 'rpm' },
      { id: 'torque_in', name: 'Giriş Torku', unit: 'Nm' },
      { id: 'torque_out', name: 'Çıkış Torku', unit: 'Nm' }
    ]
  },
  'vehicle': {
    outputs: [
      { id: 'v_speed', name: 'Araç Hızı', unit: 'km/h' }
    ]
  }
};

const S = require('../../js/signal-tree.js');

// ── Arama katlaması ──────────────────────────────────────────────────────────
describe('veSigNorm — arama katlaması', () => {
  test('uzunluğu korur (vurgulama indeksleri ham metne uygulanıyor)', () => {
    // toLocaleLowerCase('tr') 'İ' için iki karakter üretir; bu yüzden
    // kullanılmıyor. Regresyon burada yakalanır.
    ['İSTASYON', 'Hız Oranı', 'ÇÖZÜCÜ', 'ĞÜŞİÖÇI', 'Motor Devri'].forEach((s) => {
      expect(S.veSigNorm(s)).toHaveLength(s.length);
    });
  });

  test('Türkçe karakterleri aksansız karşılığına katlar', () => {
    expect(S.veSigNorm('Hız')).toBe('hiz');
    expect(S.veSigNorm('ÇÖZÜCÜ')).toBe('cozucu');
    expect(S.veSigNorm('Şanzıman')).toBe('sanziman');
    expect(S.veSigNorm('İvme')).toBe('ivme');
  });

  test('boş / null girdi patlamaz', () => {
    expect(S.veSigNorm(null)).toBe('');
    expect(S.veSigNorm(undefined)).toBe('');
  });
});

describe('veSigMatches', () => {
  test('aksansız yazan kullanıcı Türkçe adı bulur', () => {
    expect(S.veSigMatches('Araç Hızı', 'hiz')).toBe(true);
    expect(S.veSigMatches('Şanzıman Çıkış Torku', 'sanziman')).toBe(true);
    expect(S.veSigMatches('Motor Devri', 'devri')).toBe(true);
  });

  test('eşleşmeyeni eşleştirmez', () => {
    expect(S.veSigMatches('Motor Devri', 'tork')).toBe(false);
  });

  test('boş sorgu her şeyi geçirir', () => {
    expect(S.veSigMatches('herhangi', '')).toBe(true);
  });
});

describe('veSigHighlight', () => {
  test('eşleşmeyi ham metnin doğru yerinde işaretler', () => {
    expect(S.veSigHighlight('Motor Devri', 'devri'))
      .toBe('Motor <mark class="vsig-hit">Devri</mark>');
  });

  test('Türkçe karakterli eşleşmede metin bozulmaz', () => {
    // 'Hız' üç karakter; katlama uzunluk korumasaydı burada kayardı
    expect(S.veSigHighlight('Araç Hızı', 'hiz'))
      .toBe('Araç <mark class="vsig-hit">Hız</mark>ı');
  });

  test('sorgu yoksa yalnızca kaçış yapar', () => {
    expect(S.veSigHighlight('a<b>&"c"', '')).toBe('a&lt;b&gt;&amp;&quot;c&quot;');
  });

  test('eşleşme yoksa metni olduğu gibi kaçırır', () => {
    expect(S.veSigHighlight('Motor', 'zzz')).toBe('Motor');
  });
});

// ── Sinyal ↔ panel bağı ──────────────────────────────────────────────────────
describe('veSigIndexInSlot', () => {
  const slot = { sensors: [
    { id: '~engine', signal: 'rpm' },
    { id: '~engine', signal: 'torque' },
    { id: 'n-s1', signal: 'rpm' }
  ]};

  test('id + signal ikilisiyle eşleşir', () => {
    expect(S.veSigIndexInSlot(slot, '~engine', 'torque')).toBe(1);
    expect(S.veSigIndexInSlot(slot, 'n-s1', 'rpm')).toBe(2);
  });

  test('aynı sinyal farklı sensörde karışmaz', () => {
    expect(S.veSigIndexInSlot(slot, '~engine', 'rpm')).toBe(0);
  });

  test('yoksa -1', () => {
    expect(S.veSigIndexInSlot(slot, '~engine', 'power')).toBe(-1);
    expect(S.veSigIndexInSlot(null, '~engine', 'rpm')).toBe(-1);
    expect(S.veSigIndexInSlot({}, '~engine', 'rpm')).toBe(-1);
  });
});

describe('veSlotSignalColor', () => {
  test('renk atanmamışsa palet sırasını izler', () => {
    const slot = { sensors: [{}, {}, {}] };
    expect(S.veSlotSignalColor(slot, 0)).toBe(S.VE_SIGNAL_COLORS[0]);
    expect(S.veSlotSignalColor(slot, 2)).toBe(S.VE_SIGNAL_COLORS[2]);
  });

  test('palet 6\'dan sonra başa döner', () => {
    const slot = { sensors: [] };
    expect(S.veSlotSignalColor(slot, 6)).toBe(S.VE_SIGNAL_COLORS[0]);
    expect(S.veSlotSignalColor(slot, 7)).toBe(S.VE_SIGNAL_COLORS[1]);
  });

  test('kullanıcı rengi palet sırasını ezer', () => {
    const slot = { sensors: [{ color: '#123456' }, {}] };
    expect(S.veSlotSignalColor(slot, 0)).toBe('#123456');
    expect(S.veSlotSignalColor(slot, 1)).toBe(S.VE_SIGNAL_COLORS[1]);
  });

  test('geçersiz slot/indeks patlamaz', () => {
    expect(S.veSlotSignalColor(null, 0)).toBe(S.VE_SIGNAL_COLORS[0]);
    expect(S.veSlotSignalColor({ sensors: [] }, 99)).toBe(S.VE_SIGNAL_COLORS[3]);
  });
});

// ── Üç durumlu grup ──────────────────────────────────────────────────────────
describe('veSigGroupState', () => {
  const items = [
    { sensorId: '~engine', signalId: 'rpm' },
    { sensorId: '~engine', signalId: 'torque' },
    { sensorId: '~engine', signalId: 'power' }
  ];

  test('hiçbiri panelde değilse none', () => {
    expect(S.veSigGroupState(items, { sensors: [] })).toEqual({ on: 0, total: 3, state: 'none' });
  });

  test('bir kısmı panelde ise some', () => {
    const slot = { sensors: [{ id: '~engine', signal: 'rpm' }] };
    expect(S.veSigGroupState(items, slot)).toEqual({ on: 1, total: 3, state: 'some' });
  });

  test('hepsi panelde ise all', () => {
    const slot = { sensors: items.map((i) => ({ id: i.sensorId, signal: i.signalId })) };
    expect(S.veSigGroupState(items, slot)).toEqual({ on: 3, total: 3, state: 'all' });
  });

  test('boş grup all sayılmaz', () => {
    expect(S.veSigGroupState([], { sensors: [] }).state).toBe('none');
  });
});

// ── İstatistik ───────────────────────────────────────────────────────────────
describe('veSigStats', () => {
  test('min / ort / maks doğru', () => {
    const st = S.veSigStats([2, 4, 6, 8]);
    expect(st.min).toBe(2);
    expect(st.max).toBe(8);
    expect(st.avg).toBe(5);
    expect(st.n).toBe(4);
  });

  test('NaN ve Infinity atlanır, ortalama sağlam kalır', () => {
    const st = S.veSigStats([1, NaN, 3, Infinity, 5]);
    expect(st.n).toBe(3);
    expect(st.min).toBe(1);
    expect(st.max).toBe(5);
    expect(st.avg).toBe(3);
  });

  test('negatif değerler doğru', () => {
    const st = S.veSigStats([-5, 0, 5]);
    expect(st.min).toBe(-5);
    expect(st.max).toBe(5);
    expect(st.avg).toBe(0);
  });

  test('veri yoksa null', () => {
    expect(S.veSigStats([])).toBeNull();
    expect(S.veSigStats(null)).toBeNull();
    expect(S.veSigStats([NaN, NaN])).toBeNull();
  });
});

// ── Mini eğri ────────────────────────────────────────────────────────────────
describe('veSigSparkPoints', () => {
  const series = Array.from({ length: 200 }, (_, i) => Math.sin(i / 10) * 50 + 60);

  test('istenen sayıda nokta üretir', () => {
    expect(S.veSigSparkPoints(series, 46, 13, 32).split(' ')).toHaveLength(32);
  });

  test('noktalar kutunun içinde kalır', () => {
    S.veSigSparkPoints(series, 46, 13, 32).split(' ').forEach((p) => {
      const [x, y] = p.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(46);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(13);
    });
  });

  test('sabit seride sıfıra bölme yok — düz orta çizgi', () => {
    const flat = S.veSigSparkPoints([7, 7, 7, 7, 7], 46, 13, 5);
    flat.split(' ').forEach((p) => {
      const y = Number(p.split(',')[1]);
      expect(y).toBeCloseTo(6.5, 5);
    });
  });

  test('örnek sayısı seri uzunluğunu aşamaz', () => {
    expect(S.veSigSparkPoints([1, 2, 3], 46, 13, 32).split(' ')).toHaveLength(3);
  });

  test('yetersiz girdide boş döner', () => {
    expect(S.veSigSparkPoints(null, 46, 13)).toBe('');
    expect(S.veSigSparkPoints([5], 46, 13)).toBe('');
    expect(S.veSigSparkPoints([1, 2], 0, 13)).toBe('');
  });
});

// ── Filtre ───────────────────────────────────────────────────────────────────
describe('veSigApplyFilter', () => {
  const groups = [{
    gid: 'engine', key: 'engine', name: 'Motor', icon: '', dragId: '~engine',
    items: [
      { sensorId: '~engine', signalId: 'rpm', name: 'Motor Devri' },
      { sensorId: '~engine', signalId: 'torque', name: 'Net Motor Torku' }
    ]
  }, {
    gid: 'vehicle', key: 'vehicle', name: 'Araç', icon: '', dragId: '~vehicle',
    items: [{ sensorId: '~vehicle', signalId: 'v_speed', name: 'Araç Hızı' }]
  }];
  const slot = { sensors: [{ id: '~engine', signal: 'rpm' }] };

  test('filtresiz her şey gelir', () => {
    const out = S.veSigApplyFilter(groups, slot, '', 'all');
    expect(out).toHaveLength(2);
    expect(out[0].items).toHaveLength(2);
  });

  test('"seçili" yalnızca panelde çizili olanları bırakır', () => {
    const out = S.veSigApplyFilter(groups, slot, '', 'on');
    expect(out).toHaveLength(1);
    expect(out[0].items.map((i) => i.signalId)).toEqual(['rpm']);
  });

  test('"kapalı" çizili olanı düşürür', () => {
    const out = S.veSigApplyFilter(groups, slot, '', 'off');
    expect(out.map((g) => g.gid)).toEqual(['engine', 'vehicle']);
    expect(out[0].items.map((i) => i.signalId)).toEqual(['torque']);
  });

  // Denetim bulgusu: filtre grubu beyaz listeyle YENİDEN kuruyordu ve
  // içe aktarma gruplarındaki `_import` alanı düşüyordu. Ağaçtaki
  // "✕ — kaldır" bağlantısı veImpDropDataset('undefined') üretiyor, tıklama
  // hiçbir şey yapmıyordu — hata da vermiyordu.
  test('gruba özel ek alanlar korunur (_import)', () => {
    const imp = [{
      gid: 'imp:imp1', key: 'imp:imp1', name: 'Graphics.csv', icon: '',
      dragId: '#imp1', _import: 'imp1',
      items: [{ sensorId: '#imp1', signalId: 'c1', name: 'EngSpeed' }]
    }];
    const out = S.veSigApplyFilter(imp, { sensors: [] }, '', 'all');
    expect(out).toHaveLength(1);
    expect(out[0]._import).toBe('imp1');
    expect(out[0].dragId).toBe('#imp1');
  });

  test('filtre kaynak grubu DEĞİŞTİRMEZ', () => {
    const src = [{ gid: 'g', key: 'g', name: 'G', icon: '', dragId: '~g',
                   items: [{ sensorId: '~g', signalId: 'a', name: 'A' },
                           { sensorId: '~g', signalId: 'b', name: 'B' }] }];
    S.veSigApplyFilter(src, { sensors: [{ id: '~g', signal: 'a' }] }, '', 'on');
    expect(src[0].items).toHaveLength(2);
  });

  test('arama sinyal adında eşleşir, boş grup düşer', () => {
    const out = S.veSigApplyFilter(groups, slot, 'tork', 'all');
    expect(out).toHaveLength(1);
    expect(out[0].items).toHaveLength(1);
  });

  test('arama grup adında da eşleşir (grubun tümü kalır)', () => {
    const out = S.veSigApplyFilter(groups, slot, 'motor', 'all');
    expect(out).toHaveLength(1);
    expect(out[0].items).toHaveLength(2);
  });

  test('sinyal anahtarında da aranır', () => {
    const out = S.veSigApplyFilter(groups, slot, 'v_speed', 'all');
    expect(out).toHaveLength(1);
    expect(out[0].gid).toBe('vehicle');
  });
});

// ── Kanal toplama ────────────────────────────────────────────────────────────
describe('veSigCollectGroups', () => {
  const nodes = [
    { id: 'n-eng', type: 'engine', customName: 'Cummins QSK38', data: {} },
    { id: 'n-gb', type: 'gearbox', customName: '', data: {} },
    { id: 'n-veh', type: 'vehicle', customName: '', data: {} },
    // Şanzıman GİRİŞİNE tutturulmuş fiziksel sensör
    { id: 'n-s1', type: 'sensor', customName: 'GB Giriş', data: { attachedConnection: 'c1', sensorDirection: 'to' } }
  ];
  const conns = [{ id: 'c1', from: 'n-eng', to: 'n-gb' }];
  const wiz = [
    { target: 'engine', attachment: 'output', signal: 'rpm' },
    { target: 'engine', attachment: 'output', signal: 'torque' },
    { target: 'vehicle', attachment: 'component', signal: 'v_speed' }
  ];

  test('fiziksel ve sanal sensörler bileşen başına tek grupta birleşir', () => {
    const g = S.veSigCollectGroups(nodes, conns, wiz, '');
    expect(g.map((x) => x.key)).toEqual(['engine', 'gearbox', 'vehicle']);
    expect(g[0].items).toHaveLength(2);   // sihirbaz: rpm + torque
    expect(g[2].items).toHaveLength(1);   // sihirbaz: v_speed
  });

  test('grup adı düğümün özel adını kullanır', () => {
    const g = S.veSigCollectGroups(nodes, conns, wiz, '');
    expect(g[0].name).toBe('Cummins QSK38');
    expect(g[1].name).toBe('Şanzıman');   // özel ad yok → componentDefs
  });

  test('giriş sensörü yalnızca _in sinyallerini okur', () => {
    const g = S.veSigCollectGroups(nodes, conns, [], '');
    const gb = g.find((x) => x.key === 'gearbox');
    expect(gb.items.map((i) => i.signalId).sort()).toEqual(['rpm_in', 'torque_in']);
    expect(gb.items.every((i) => i.dir === 'in')).toBe(true);
  });

  test('çıkış sensörü _in sinyallerini DIŞLAR', () => {
    const out = [{ id: 'n-s2', type: 'sensor', customName: '', data: { attachedConnection: 'c1', sensorDirection: 'from' } }];
    const g = S.veSigCollectGroups(nodes.slice(0, 3).concat(out), conns, [], '');
    const eng = g.find((x) => x.key === 'engine');
    expect(eng.items.map((i) => i.signalId)).toEqual(['rpm', 'torque', 'power']);
    expect(eng.items.every((i) => i.dir === 'out')).toBe(true);
  });

  test('sensördeki selectedSignals seçimine saygı duyar', () => {
    const picky = [{ id: 'n-s3', type: 'sensor', customName: '', data: { attachedComponent: 'n-eng', selectedSignals: ['power'] } }];
    const g = S.veSigCollectGroups(nodes.slice(0, 3).concat(picky), conns, [], '');
    const eng = g.find((x) => x.key === 'engine');
    expect(eng.items.map((i) => i.signalId)).toEqual(['power']);
  });

  test('aynı sensör+sinyal iki kez eklenmez', () => {
    const g = S.veSigCollectGroups(nodes, conns, wiz.concat(wiz), '');
    expect(g.find((x) => x.key === 'engine').items).toHaveLength(2);
  });

  test('sekme öneki sensorId ve gid\'e işlenir', () => {
    const g = S.veSigCollectGroups(nodes, conns, wiz, '@2:');
    const eng = g.find((x) => x.key === 'engine');
    expect(eng.gid).toBe('@2:engine');
    expect(eng.items[0].sensorId).toBe('@2:~engine');
  });

  test('tek kaynaklı grup sürüklenebilir, karışık grup sürüklenemez', () => {
    const g = S.veSigCollectGroups(nodes, conns, wiz, '');
    expect(g.find((x) => x.key === 'engine').dragId).toBe('~engine');

    // Motora hem fiziksel hem sanal kanal gelirse kaynak tek değil → null
    const mixed = nodes.slice(0, 3).concat([
      { id: 'n-s4', type: 'sensor', customName: '', data: { attachedComponent: 'n-eng' } }
    ]);
    const g2 = S.veSigCollectGroups(mixed, conns, wiz, '');
    expect(g2.find((x) => x.key === 'engine').dragId).toBeNull();
  });

  test('gruplar güç akışı sırasında gelir', () => {
    const shuffled = [nodes[2], nodes[1], nodes[0]];
    const g = S.veSigCollectGroups(shuffled, [], [
      { target: 'vehicle', attachment: 'component', signal: 'v_speed' },
      { target: 'gearbox', attachment: 'output', signal: 'torque_out' },
      { target: 'engine', attachment: 'output', signal: 'rpm' }
    ], '');
    expect(g.map((x) => x.key)).toEqual(['engine', 'gearbox', 'vehicle']);
  });

  test('bağlı olmayan sensör hiçbir gruba girmez', () => {
    const orphan = nodes.concat([{ id: 'n-s9', type: 'sensor', customName: 'Boşta', data: {} }]);
    const g = S.veSigCollectGroups(orphan, conns, [], '');
    const all = g.reduce((a, x) => a.concat(x.items), []);
    expect(all.some((i) => i.sensorId === 'n-s9')).toBe(false);
  });
});

// ── Biçimlendirme ────────────────────────────────────────────────────────────
describe('veSigFmt', () => {
  test('büyüklüğe göre ondalık seçer', () => {
    expect(S.veSigFmt(12345.678)).toBe('12346');
    expect(S.veSigFmt(1234.5)).toBe('1234.5');
    expect(S.veSigFmt(42.123)).toBe('42.12');
    expect(S.veSigFmt(1.2345)).toBe('1.234');
    expect(S.veSigFmt(0.012345)).toBe('0.0123');
    expect(S.veSigFmt(0)).toBe('0');
  });

  test('sayı olmayan girdide tire', () => {
    expect(S.veSigFmt(null)).toBe('—');
    expect(S.veSigFmt(undefined)).toBe('—');
    expect(S.veSigFmt(NaN)).toBe('—');
    expect(S.veSigFmt(Infinity)).toBe('—');
  });
});
