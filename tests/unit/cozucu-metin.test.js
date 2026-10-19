/**
 * cozucu-metin.test.js — ARAYÜZ ANLATMAZ, çözücü ve sensörler (aşama 8)
 * ───────────────────────────────────────────────────────────────────────
 * Cırcır (metin-dili.test.js) yalnız sözlüğün işaretlediğini görür. Bu
 * aşamada kalkanların bir kısmı işaretsizdi ya da bir VERİ ALANIYDI:
 *   · sensör paketlerinin `significance` (diyagram "ne gösterir") ve
 *     `description` alanları — 82 + 26 açıklama, bilgi penceresinde ve kartta
 *   · çözücü penceresinde yöntem karşılaştırması, model anlatımı ve sözde kod
 *   · günlükte kesme yardımcısının açıklama yuvası (`whatNote`) ve tarifleri
 * Kurallar:
 *   · paket kaydı ad, eksen, sensör ve not taşır; açıklama alanı yok
 *   · diyagram künyesi (eksen · not) satırın ipucunda, ayrı pencere yok
 *   · çözücü ve günlük dizgeleri tarif fiili taşımaz
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { yonYuvasi } = require('../helpers/yon-yuvasi.js');

const ROOT = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function dizgeler(dosya) {
  const ast = parser.parse(oku(dosya), { sourceType: 'script', errorRecovery: true });
  const out = [];
  (function yuru(n) {
    if (!n || typeof n.type !== 'string') return;
    if (yonYuvasi(n)) return;           // yönlendirme yuvası (veYon) — biçimini metin-dili ölçer
    if (n.type === 'StringLiteral') out.push({ satir: n.loc.start.line, metin: n.value });
    for (const k in n) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(yuru); else if (v && typeof v.type === 'string') yuru(v);
    }
  })(ast.program);
  return out;
}

const stubs = stubGlobals();
eval(loadSource('sensors.js'));
beforeEach(() => resetStubs(stubs));

describe('sensör paketi açıklama alanı taşımaz', () => {
  test('SENSOR_PACKAGES: paket ve diyagram kaydında significance · description yok', () => {
    expect(SENSOR_PACKAGES.length).toBeGreaterThan(10);
    const sapan = [];
    SENSOR_PACKAGES.forEach((p) => {
      if ('description' in p) sapan.push(p.id + '.description');
      (p.diagrams || []).forEach((d) => { if ('significance' in d) sapan.push(p.id + '/' + d.id + '.significance'); });
    });
    expect(sapan).toEqual([]);
  });

  test('diyagram künyesi satırın ipucunda: eksenler ve not', () => {
    const d = { name: 'Motor BSFC çalışma haritası', xAxis: 'Motor devri (rpm)', yAxis: 'Motor torku (Nm)', note: 'Kontur haritası motor veritabanından' };
    expect(swDiagramKunye(d)).toBe('X: Motor devri (rpm) · Y: Motor torku (Nm) · Kontur haritası motor veritabanından');
    expect(swDiagramKunye({ xAxis: 'a', yAxis: ['b', 'c'], zAxis: 'd' })).toBe('X: a · Y: b / c · Z: d');
    expect(typeof swShowDiagramInfo).toBe('undefined');
  });
});

const TARIF = /(?<![\p{L}])(girin|giriniz|seçin|seçiniz|ekleyin|tıklayın|kontrol edin|önerilir|bırakın|yazın|verin|silin|açın|kurun|çevirin|düzeltin|düzeltiniz|kullanın|bağlayın|deneyin|artırın|büyütün|gevşetin|lütfen)(?![\p{L}])/iu;

describe('çözücü penceresi ve günlüğü tarif taşımaz', () => {
  test.each(['js/sensors.js', 'js/cp-solver.js', 'js/solver-pro.js', 'js/solver.js'])('%s', (f) => {
    const sapan = dizgeler(f).filter((d) => TARIF.test(d.metin)).map((d) => f + ':' + d.satir + ' ' + d.metin.slice(0, 120));
    expect(sapan).toEqual([]);
  });

  test('kesme yardımcısı açıklama yuvası taşımaz (kalıp açıklama yuvası açmaz)', () => {
    const src = oku('js/solver-pro.js');
    expect(src).toMatch(/function veLogCappedList\(arr, logFn, lineFn\) \{/);
    expect(src).not.toMatch(/whatNote/);
  });

  test('vites geçiş analizi: model anlatımı ve sözde kod kartı yok, eşik tabloları ve shift sırası var', () => {
    const src = oku('js/cp-solver.js');
    expect(src).not.toMatch(/Matematiksel modeller|Vites geçiş algoritması|Girdiler: N_engine/);
    expect(src).toMatch(/>Shift sırası</);
  });

  test('kapı düşebiliyor', () => {
    ['Simülasyon başlatılamıyor. Lütfen hataları düzeltin.', 'Δt\'yi büyütün ya da sabit adımlı bir yöntem (RK4) kullanın.',
     'Tolerans değerlerini gevşetmeyi deneyin.', 'Yüksek — adım sayısını artırın']
      .forEach((m) => expect(TARIF.test(m)).toBe(true));
  });
});
