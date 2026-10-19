/**
 * tablo-bos-durum.test.js — TABLO VE 3B, ÇİZİLECEK VERİ YOKKEN (2026-10-19)
 * ───────────────────────────────────────────────────────────────────────
 * İz kipi veri yokken "Çözüm sonucu yok" yazar ve Çözücüyü aç · Ölçüm verisi
 * içe aktar düğmelerini gösterir. Tablo ve 3B kipi aynı hâlde kendi boş
 * durumunu basıyordu: "Veri tablosu boş · Veri Gezgini’nden sinyal seçin." —
 * Veri Gezgini'nde seçilecek sinyal yokken. Görüntüleyicide de aynısı
 * (ölçüm yokken). İki kip artık AYNI sorudan geçer (`veTrVeriYok`); karar
 * `veTrApplyMode`'da.
 */
const stubs = stubGlobals();
eval(loadSource('measure-core.js'));
eval(loadSource('signal-tree.js'));
eval(loadSource('trace-view.js'));
eval(loadSource('results.js'));

const graf = () => document.getElementById('ve-trace-graph');
const alt = () => document.getElementById('ve-rslot-body-0');
const bos = () => document.getElementById('ve-trace-empty');
const gorunur = (el) => el.style.display !== 'none';

beforeEach(() => {
  resetStubs(stubs);
  document.body.innerHTML = '<div id="ve-results-panels"></div>';
  delete window.veSimResults;
  global.veSolverRun = jest.fn();
  global.veImpOpenPicker = jest.fn();
  veResultSlots[0] = { type: 'line', sensors: [] };
  veTrBuildShell();
});
afterAll(() => { delete global.veSolverRun; delete global.veImpOpenPicker; });

describe('çizilecek veri yok', () => {
  test.each(['table', 'scatter3d'])('%s kipi iz kipinin boş durumunu gösterir', (kip) => {
    veTrSetMode(kip);
    expect(gorunur(graf())).toBe(true);
    expect(gorunur(alt())).toBe(false);
    expect(bos().textContent).toContain('Çözüm sonucu yok');
    expect(bos().querySelector('[data-act="open-solver"]')).not.toBeNull();
    expect(bos().querySelector('[data-act="import-measure"]')).not.toBeNull();
    expect(alt().textContent).not.toContain('Veri tablosu boş');
  });
  test('düğmeler çalışıyor (iz kipinin bağlantısı)', () => {
    veTrSetMode('table');
    bos().querySelector('[data-act="import-measure"]').click();
    expect(veImpOpenPicker).toHaveBeenCalledTimes(1);
  });
  test('kip düğmesi seçili kipi gösterir', () => {
    veTrSetMode('table');
    const b = document.querySelector('#ve-trace-toolbar [data-mode="table"]');
    expect(b.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('veri var, sinyal seçili değil', () => {
  test('tablo kendi boş durumunu gösterir ve Veri Gezgini’ne yollar', () => {
    window.veSimResults = { t: [0, 1] };
    veTrSetMode('table');
    expect(gorunur(graf())).toBe(false);
    expect(gorunur(alt())).toBe(true);
    expect(alt().textContent).toContain('Veri tablosu boş');
    expect(alt().textContent).toContain('Veri Gezgini’nden sinyal seçin.');
  });
  test('iz kipi değişmedi: veri varken sinyal seçimine, yokken çözüme gönderir', () => {
    expect(veTrVeriYok()).toBe(true);
    expect(veTrEmptyHTML()).toContain('Çözüm sonucu yok');
    window.veSimResults = { t: [0, 1] };
    expect(veTrVeriYok()).toBe(false);
    expect(veTrEmptyHTML()).toContain('Ölçüm penceresi boş');
  });
  test('veri gelince tablo kipi tabloya döner', () => {
    veTrSetMode('table');
    expect(gorunur(alt())).toBe(false);
    window.veSimResults = { t: [0, 1] };
    veTrRefresh();
    expect(gorunur(alt())).toBe(true);
    expect(gorunur(graf())).toBe(false);
  });
});
