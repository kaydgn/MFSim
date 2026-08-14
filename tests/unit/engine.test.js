/**
 * cp-engine.js — Motor paneli hesap tablosu (Tam Gaz "1d+")
 * ─────────────────────────────────────────────────────────
 * Izgaranın türetilen (ƒ) sütunları çözücüyle AYNI formülü kullanmalı:
 *   D = aksesuar kaybı(devir) · F = max(0, C − D) · E = F × 9549.3 / A
 * Bu çekirdek "makul ama yanlış" regresyona açık (kırpma, birim çevrimi,
 * devir oranı) → test değeri yüksek (bkz. CLAUDE.md test politikası).
 *
 * Panel HTML'i için TEK smoke testi var: etiket başına assertion açılmıyor.
 */

document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
global.veActiveModule = 'full-throttle';

const stubs = stubGlobals({
  showConfirmToast: jest.fn((msg, cb) => cb && cb()),
  veFitCanvas: jest.fn(() => null),          // kanvas çizimi testin konusu değil
  pcAttach: jest.fn(),
  pcDrawHint: jest.fn(),
  vePcInterpY: jest.fn(() => null),
  pcZoomWindow: jest.fn(() => ({ minY: 0, maxY: 1 })),
  showInfoPopup: jest.fn(),
  veTogglePropertiesPanel: jest.fn(),
  VE_FT_MOTOR_PRESETS: {},
});

// cp-accessories.js gerçek sürümüyle yükleniyor: veCalcAccLossAtRPM onun
// veAccessoryLossKw'ine devrediyor — stub konsaydı kayıp yasası test edilmezdi.
eval(loadSource('cp-accessories.js'));
eval(loadSource('cp-engine.js'));

beforeEach(() => {
  nodes = [];
  connections = [];
  veActiveModule = 'full-throttle';
  document.body.innerHTML = '<div id="ve-canvas"></div>';
  resetStubs(stubs);
});

// ── Yardımcılar ──
const FAN_ONLY = [{ name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4 }];
const AZRA_ROWS = [
  { rpm: 1100, torque: 3000, power: 345.6 },
  { rpm: 1800, torque: 2373.6, power: 447.4 },
  { rpm: 2100, torque: 1000, power: 219.9 },
];

function engineNode(id, over) {
  const n = {
    id: id || 'comp-1', type: 'engine', x: 0, y: 0, width: 66, height: 76,
    data: Object.assign({
      torqueData: AZRA_ROWS.map((r) => Object.assign({}, r)),
      accessories: FAN_ONLY.map((a) => Object.assign({}, a)),
      motorSpecs: { idleRpm: 550, governedSpeed: 2100, noLoadGoverned: 2150 },
      governedRpm: 2100,
    }, over || {}),
  };
  nodes = [n];
  return n;
}

// Paneli DOM'a bas → ızgara, ƒ hücreleri ve metrik kutuları gerçekten var olur.
function mountPanel(node) {
  document.body.innerHTML = '<div class="ve-properties-content">' +
    getEnginePropertiesHTML(node) + '</div>';
  // Gerçek açılış yolu: showNodeProperties panel DOM'u kurulduktan sonra
  // updateVEMotorChart çağırıyor → denklem + ƒ sütunları + metrikler dolar.
  updateVEMotorChart(node.id);
  return node;
}

function sheetRows(nodeId) {
  return Array.from(document.querySelectorAll('#ve-motor-table-' + nodeId + ' tr'));
}
function derivedOf(tr) {
  return Array.from(tr.querySelectorAll('td.f')).map((td) => td.textContent);
}
function metric(k, nodeId) {
  const el = document.getElementById('ve-eng-m-' + k + '-' + nodeId);
  return el ? el.textContent : null;
}

// ═════════════════════════════════════════════════════════════════════
// ƒ sütunlarının formülü — çözücüyle tek kaynak
// ═════════════════════════════════════════════════════════════════════
describe('ƒ sütunları (D kayıp · E net tork · F net güç)', () => {
  test('fan küp yasası: 1800 rpm satırında D/E/F beklenen değerler', () => {
    // loss = 22.4 × (1800/2100)³ = 14.11 kW · F = 447.4 − 14.11 = 433.3
    // E = 433.3 × 9549.3 / 1800 = 2298.6 Nm
    const n = mountPanel(engineNode('comp-1'));
    const row = sheetRows(n.id)[1];
    expect(derivedOf(row)).toEqual(['14.1', '2298.7', '433.3']);
  });

  test('governed devrinde kayıp tam kullanıcı değeri (oran = 1)', () => {
    const n = mountPanel(engineNode('comp-1'));
    expect(derivedOf(sheetRows(n.id)[2])[0]).toBe('22.4');
  });

  test('ƒ değerleri çözücünün gördüğü kayıpla BİREBİR aynı', () => {
    const n = engineNode('comp-1');
    mountPanel(n);
    sheetRows(n.id).forEach((tr, i) => {
      const rpm = AZRA_ROWS[i].rpm;
      const solverLoss = veAccessoryLossKw(n.data.accessories, rpm, 2100);
      const solverNetP = Math.max(0, AZRA_ROWS[i].power - solverLoss);
      const [d, e, f] = derivedOf(tr);
      expect(d).toBe(solverLoss.toFixed(1));
      expect(f).toBe(solverNetP.toFixed(1));
      expect(e).toBe((solverNetP * 9549.3 / rpm).toFixed(1));
    });
  });

  test('kayıp brüt güçten büyükse net 0\'a kırpılır (negatif yazılmaz)', () => {
    // 2150 rpm'de brüt güç 0 → net de 0, negatif DEĞİL
    const n = engineNode('comp-1', {
      torqueData: [{ rpm: 1000, torque: 100, power: 10 }, { rpm: 2150, torque: 0, power: 0 }],
    });
    mountPanel(n);
    const last = sheetRows(n.id)[1];
    const [, e, f] = derivedOf(last);
    expect(f).toBe('0.0');
    expect(e).toBe('0.0');
    expect(parseFloat(f)).toBeGreaterThanOrEqual(0);
  });

  test('boş / geçersiz devir satırında ƒ hücreleri "—"', () => {
    const n = mountPanel(engineNode('comp-1'));
    const tbody = document.getElementById('ve-motor-table-' + n.id);
    tbody.innerHTML += veEngSheetRowHTML(n.id, 4, '', '', '');
    expect(derivedOf(sheetRows(n.id)[3])).toEqual(['—', '—', '—']);
  });
});

// ═════════════════════════════════════════════════════════════════════
// veEngSheetSyncDerived — hücre değişimi → ƒ tazelenmesi
// ═════════════════════════════════════════════════════════════════════
describe('veEngSheetSyncDerived', () => {
  test('brüt güç hücresi değişince o satırın ƒ sütunları yeniden hesaplanır', () => {
    const n = mountPanel(engineNode('comp-1'));
    const row = sheetRows(n.id)[1];
    row.querySelectorAll('input')[2].value = '500';
    onVEMotorDataChange(n.id);
    // 500 − 14.11 = 485.9 kW
    expect(derivedOf(sheetRows(n.id)[1])[2]).toBe('485.9');
    expect(n.data.torqueData[1].power).toBe(500);
  });

  test('governed değişimi ƒ sütunlarını tazeler (kayıp devir oranına bağlı)', () => {
    const n = mountPanel(engineNode('comp-1'));
    expect(derivedOf(sheetRows(n.id)[1])[0]).toBe('14.1');   // governed 2100
    document.getElementById('ve-ft-spec-governedSpeed-' + n.id).value = '1800';
    onVEFTSpecChange(n.id);
    // governed 1800 → 1800 rpm'de oran 1 → kayıp tam 22.4
    expect(derivedOf(sheetRows(n.id)[1])[0]).toBe('22.4');
  });

  test('aksesuar kaybı değişimi tüm satırların ƒ sütunlarını tazeler', () => {
    const n = mountPanel(engineNode('comp-1'));
    document.querySelectorAll('.ve-acc-user-' + n.id)[0].value = '0';
    onVEAccChange(n.id);
    expect(derivedOf(sheetRows(n.id)[1])).toEqual(['0.0', '2373.5', '447.4']);
  });

  test('satır silinince numaralar 1..n yeniden yazılır ve A1:Cn etiketi güncellenir', () => {
    const n = mountPanel(engineNode('comp-1'));
    expect(document.getElementById('ve-sheet-range-' + n.id).textContent).toContain('A1:C3');
    const btn = sheetRows(n.id)[0].querySelector('button.ve-row-del');
    removeVEMotorRow(btn, n.id);
    const nos = sheetRows(n.id).map((tr) => tr.querySelector('td.n').textContent);
    expect(nos).toEqual(['1', '2']);
    expect(document.getElementById('ve-sheet-range-' + n.id).textContent).toContain('A1:C2');
    // tfoot ipucu satırının numarası da kayar
    expect(document.querySelector('#ve-motor-data-area-' + n.id + ' tfoot td.n').textContent).toBe('3');
  });
});

// ═════════════════════════════════════════════════════════════════════
// veEngPeakSummary + özet şeridi aritmetiği
// ═════════════════════════════════════════════════════════════════════
describe('özet şeridi (brüt − aksesuar = net)', () => {
  test('üç figür de NET TEPE devrinde okunur ve aritmetik kapanır', () => {
    const n = mountPanel(engineNode('comp-1'));
    const gp2 = parseFloat(metric('gp2', n.id));
    const loss2 = parseFloat(metric('loss2', n.id));
    const np2 = parseFloat(metric('np2', n.id));
    expect(gp2 - loss2).toBeCloseTo(np2, 1);
    expect(metric('rpm2', n.id)).toBe('1800');
  });

  test('özet kaybı governed kaybından KÜÇÜK (fan küp yasası)', () => {
    // Governed kaybını tepe güçten düşmek kapanmayan bir denklem üretirdi.
    const n = mountPanel(engineNode('comp-1'));
    const loss2 = parseFloat(metric('loss2', n.id));
    const lossGov = veCalcAccLossAtRPM(n.data.accessories, 2100, 2100);
    expect(loss2).toBeLessThan(lossGov);
    expect(loss2).toBeCloseTo(14.1, 1);
    expect(lossGov).toBeCloseTo(22.4, 1);
  });

  test('veri yoksa peak summary null döner', () => {
    expect(veEngPeakSummary([], FAN_ONLY, 2100)).toBeNull();
    expect(veEngPeakSummary([{ rpm: 0, power: 100 }], FAN_ONLY, 2100)).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// veEngUpdateMetrics — doğrulama sütunu
// ═════════════════════════════════════════════════════════════════════
describe('doğrulama metrikleri', () => {
  test('altı metrik dolar; brüt/net tepe ayrı devirlerde olabilir', () => {
    const n = mountPanel(engineNode('comp-1'));
    expect(metric('gp', n.id)).toBe('447.4 kW @ 1800');
    expect(metric('np', n.id)).toBe('433.3 kW @ 1800');
    expect(metric('gt', n.id)).toBe('3000 Nm @ 1100');
    expect(metric('loss', n.id)).toBe('22.4 kW @ 2100');
    expect(metric('pts', n.id)).toBe('3 satır · 1100–2100 rpm');
  });

  test('governed rozeti kaybı eksi işaretiyle ve devriyle gösterir', () => {
    const n = mountPanel(engineNode('comp-1'));
    expect(document.getElementById('ve-net-badge-' + n.id).textContent).toBe('−22.4 kW @ 2100');
  });

  test('governed yayılım şeridi render anında donmaz', () => {
    // Şerit HTML'e gömülü sabit değerle yazılıyordu: governed 1600'e çekilince
    // rozet/metrik 1600 derken şerit hâlâ 2100 gösteriyordu.
    const n = mountPanel(engineNode('comp-1'));
    expect(document.getElementById('ve-eng-govbar-' + n.id).textContent).toBe('2100');
    document.getElementById('ve-ft-spec-governedSpeed-' + n.id).value = '1600';
    onVEFTSpecChange(n.id);
    expect(document.getElementById('ve-eng-govbar-' + n.id).textContent).toBe('1600');
    expect(document.getElementById('ve-net-badge-' + n.id).textContent).toContain('1600');
  });

  test('veri yokken metrikler "—" kalır (uydurma sayı yok)', () => {
    const n = engineNode('comp-1', { torqueData: [] });
    mountPanel(n);
    veEngUpdateMetrics(n.id);
    ['gp', 'np', 'gt', 'nt', 'pts'].forEach((k) => expect(metric(k, n.id)).toBe('—'));
  });
});

// ═════════════════════════════════════════════════════════════════════
// Yapıştırma
// ═════════════════════════════════════════════════════════════════════
describe('veEngParseSheetText', () => {
  test('tab ayraçlı üç sütun', () => {
    expect(veEngParseSheetText('1000\t2701\t283\n1100\t3000\t345.6')).toEqual([
      { rpm: 1000, torque: 2701, power: 283 },
      { rpm: 1100, torque: 3000, power: 345.6 },
    ]);
  });

  test('güç sütunu yoksa torktan türetilir: P = T × n / 9549.3', () => {
    const out = veEngParseSheetText('1000 2701');
    expect(out).toHaveLength(1);
    expect(out[0].power).toBeCloseTo(2701 * 1000 / 9549.3, 6);
  });

  test('TR ondalık virgülü sütun ayracı sayılmaz', () => {
    // "345,6" iki sütuna bölünüp sessizce 345 kW yazılıyordu.
    expect(veEngParseSheetText('1100\t3000\t345,6')[0].power).toBe(345.6);
  });

  test('devri artan sıraya alır, geçersiz satırları atar', () => {
    const out = veEngParseSheetText('2000\t100\n' + 'başlık satırı\n' + '0\t50\n' + '1000\t200');
    expect(out.map((r) => r.rpm)).toEqual([1000, 2000]);
  });

  test('boş girdi → boş dizi', () => {
    expect(veEngParseSheetText('')).toEqual([]);
    expect(veEngParseSheetText(null)).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Denklem kutusu kanvastan bağımsız
// ═════════════════════════════════════════════════════════════════════
describe('eğri yaklaşımı', () => {
  test('brüt kanvas DOM\'da yokken denklem kutusu yine dolar', () => {
    // Tam Gaz yerleşiminde ve-motor-chart-<id> yok; denklem hesabı eskiden
    // kanvas bulunduktan SONRA çağrıldığı için kutu boş kalırdı.
    const n = mountPanel(engineNode('comp-1'));
    expect(document.getElementById('ve-motor-chart-' + n.id)).toBeNull();
    updateVEMotorChart(n.id);
    const box = document.getElementById('ve-motor-fit-' + n.id);
    expect(box.innerHTML).not.toContain('Veri girildikten sonra');
    expect(box.textContent.length).toBeGreaterThan(10);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Panel yerleşimi — smoke (panel başına TEK test, bkz. CLAUDE.md)
// ═════════════════════════════════════════════════════════════════════
describe('panel yerleşimi (smoke)', () => {
  test('Tam Gaz: üç sütunlu ızgara, tek kanvas, çift tablo yok', () => {
    const n = engineNode('comp-1');
    const html = getEnginePropertiesHTML(n);
    expect(html).toContain('ve-cp-grid--sheet');
    expect(html).toContain('ve-eng-sheet');
    // Brüt kanvas ve ikinci (net) tablo KALKTI — aynı veri iki kez yazılmıyor
    expect(html).not.toContain('ve-motor-chart-');
    expect(html).not.toContain('ve-net-table-');
    expect((html.match(/<canvas/g) || []).length).toBe(1);
    expect(html).toContain('ve-net-chart-' + n.id);
  });

  test('boş durumda dipnot ve üç sütun içeriği gizli (seçim diyaloğu kalır)', () => {
    const n = engineNode('comp-1', { torqueData: [] });
    const html = getEnginePropertiesHTML(n);
    // Dipnot ve veri-bağımlı sarmalayıcıların hepsi display:none ile başlar
    expect(html).toContain('class="sw-footer ve-ft-extra"');
    // Beş sarmalayıcı: özet şeridi + üç sütun + dipnot
    expect((html.match(/ve-ft-extra[^>]*display:none/g) || []).length).toBe(5);
    expect(html).toContain('ve-motor-placeholder-' + n.id);
  });

  test('Motor Freni dalı iki sütunlu eski yerleşimde kalır', () => {
    veActiveModule = 'engine-brake';
    const n = engineNode('comp-1');
    const html = getEnginePropertiesHTML(n);
    expect(html).not.toContain('ve-cp-grid--sheet');
    expect(html).not.toContain('ve-eng-sheet');
    expect(html).toContain('ve-motor-chart-' + n.id);   // brüt kanvas duruyor
    expect(html).toContain('Motor Freni Parametreleri');
  });

  test('Motor Freni satır üreticisi 4 sütunlu kalır (ızgaraya kaymaz)', () => {
    veActiveModule = 'engine-brake';
    const row = getVEMotorRowHTML('comp-1', 1000, 2701, 283);
    expect(row).not.toContain('class="f"');
    expect((row.match(/<td/g) || []).length).toBe(4);
  });

  test('Tam Gaz satır üreticisi 8 sütunlu ızgara satırı üretir', () => {
    // satır no + A,B,C girdi + D,E,F türetilen + sil
    const row = getVEMotorRowHTML('comp-1', 1000, 2701, 283);
    expect((row.match(/<td/g) || []).length).toBe(8);
    expect((row.match(/class="f"/g) || []).length).toBe(3);
  });
});
