/**
 * Uyarı paneli aç/kapa durumu — js/component-extras.js › veSetWarningsOpen()
 * ─────────────────────────────────────────────────────────────────────────
 * Panel artık alt bandın ÜSTÜNE açılan yüzen bir katman ve durumunu ÜÇ ayrı
 * yüzey gösteriyor:
 *
 *   • panelin kendisi          → .ve-warnings-panel.open (görünürlük)
 *   • durum çubuğundaki düğme  → aria-expanded + ok yönü
 *   • şerit / komut paleti     → #ve-warnings-body'deki 'collapsed' sınıfı
 *
 * Üçüncüsü SÖZLEŞME: js/ribbon.js basılı durumu doğrudan o sınıftan okuyor
 * (veRibbonHasClass('ve-warnings-body','collapsed')). Bu üçlü ayrışırsa hata
 * sessizdir — panel kapalıyken şerit düğmesi basılı görünür ya da tersi; ekrana
 * bakan kimse "makul ama yanlış" durumu fark etmez. Kural bu yüzden sabitlenir.
 */
document.body.innerHTML = `
  <div class="ve-bottom-dock" id="ve-bottom-dock">
    <div class="ve-warnings-panel" id="ve-warnings-panel">
      <div class="ve-warnings-body collapsed" id="ve-warnings-body"></div>
    </div>
    <button id="ve-warnings-chip" data-severity="none" aria-expanded="false">
      <span id="ve-warnings-count">0</span>
      <span id="ve-warnings-toggle">▲</span>
    </button>
  </div>
`;

global.nodes = [];
global.connections = [];

const stubs = stubGlobals({ componentDefs: {} });
eval(loadSource('component-extras.js'));

const $ = (id) => document.getElementById(id);
const durum = () => ({
  panelAcik: $('ve-warnings-panel').classList.contains('open'),
  govdeKapali: $('ve-warnings-body').classList.contains('collapsed'),
  aria: $('ve-warnings-chip').getAttribute('aria-expanded'),
  ok: $('ve-warnings-toggle').textContent,
});

beforeEach(() => {
  veSetWarningsOpen(false);
  resetStubs(stubs);
});

describe('veSetWarningsOpen — üç yüzey tek gerçeği gösterir', () => {
  test('açıkken: panel görünür, gövde kapalı DEĞİL, aria true, ok aşağı', () => {
    veSetWarningsOpen(true);
    expect(durum()).toEqual({ panelAcik: true, govdeKapali: false, aria: 'true', ok: '▼' });
  });

  test('kapalıyken: panel gizli, gövde kapalı, aria false, ok yukarı', () => {
    veSetWarningsOpen(true);
    veSetWarningsOpen(false);
    expect(durum()).toEqual({ panelAcik: false, govdeKapali: true, aria: 'false', ok: '▲' });
  });

  test('aynı durum iki kez yazılınca yüzeyler kaymaz (idempotent)', () => {
    veSetWarningsOpen(true);
    veSetWarningsOpen(true);
    expect(durum()).toEqual({ panelAcik: true, govdeKapali: false, aria: 'true', ok: '▼' });
  });
});

describe('veToggleWarnings / veOpenWarningsPanel / veWarningsPanelOpen', () => {
  test('toggle kapalıdan açar, tekrar toggle kapatır', () => {
    veToggleWarnings();
    expect(veWarningsPanelOpen()).toBe(true);
    veToggleWarnings();
    expect(veWarningsPanelOpen()).toBe(false);
  });

  test('veOpenWarningsPanel zaten açık paneli kapatmaz', () => {
    veOpenWarningsPanel();
    veOpenWarningsPanel();
    expect(veWarningsPanelOpen()).toBe(true);
  });

  // Doğrulama sonucu kapalı panelin arkasında kalmamalı: veShowValidationInWarnings
  // bu yolu kullanıyor, panel artık varsayılan olarak KAPALI açıldığı için
  // "açtığından emin ol" davranışı eskisinden daha kritik.
  test('kapalı panelde veOpenWarningsPanel açar', () => {
    expect(veWarningsPanelOpen()).toBe(false);
    veOpenWarningsPanel();
    expect(veWarningsPanelOpen()).toBe(true);
  });
});

describe('veRenderWarningsPanel — durum çubuğu rozeti', () => {
  test('uyarı yokken sayı 0 ve severity "none"', () => {
    veRenderWarningsPanel([], {});
    expect($('ve-warnings-count').textContent).toBe('0');
    expect($('ve-warnings-chip').getAttribute('data-severity')).toBe('none');
  });

  test('yalnız uyarı varken severity "warn" ve sayı uyarı adedi', () => {
    veRenderWarningsPanel([{ type: 'warn', msg: 'a' }, { type: 'warn', msg: 'b' }, { type: 'info', msg: 'c' }], {});
    expect($('ve-warnings-count').textContent).toBe('2');   // info sayılmaz
    expect($('ve-warnings-chip').getAttribute('data-severity')).toBe('warn');
  });

  test('hata varsa severity "error" — uyarılar da sayıya dahil', () => {
    veRenderWarningsPanel([{ type: 'error', msg: 'a' }, { type: 'warn', msg: 'b' }], {});
    expect($('ve-warnings-count').textContent).toBe('2');
    expect($('ve-warnings-chip').getAttribute('data-severity')).toBe('error');
  });

  // Rozet artık panel kapalıyken de sürekli görünüyor; yazmak paneli AÇMAMALI,
  // yoksa her topoloji düzenlemesi tuvalin üzerine panel açardı.
  test('rozeti güncellemek paneli kendiliğinden açmaz', () => {
    veRenderWarningsPanel([{ type: 'error', msg: 'a' }], {});
    expect(veWarningsPanelOpen()).toBe(false);
  });
});
