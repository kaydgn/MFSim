/**
 * kimlik-menu.test.js — HESAP MENÜSÜ: TEK ESC TEK KATMAN, AÇILIŞIN İLK ANINDA DA
 * ─────────────────────────────────────────────────────────────────────────────
 * Esc'nin dinleyicisi menü açılırken `setTimeout(0)` ile bağlanıyordu: açılışla
 * zamanlayıcı arasında gelen Esc menüyü kapatmıyor, alttaki katmana (müfettiş
 * sütunu — map.js'in dinleyicisi) iniyordu. Ürün turu yük altında yakaladı
 * (ust-bant.spec.js → TEK ESC TEK KATMAN: 160 testte 1 kez kırmızı). Dış tıkın
 * dinleyicisi gecikmeli kalır — menüyü açan tıkı görmesin.
 */
const stubs = stubGlobals();
eval(loadSource('kimlik.js'));

beforeEach(() => {
  resetStubs(stubs);
  document.body.innerHTML = '<button id="ve-bant-avatar"></button><div id="alt"></div>';
});
afterEach(() => { veAvatarMenuKapat(); jest.useRealTimers(); });

describe('TEK ESC TEK KATMAN — açılışın ilk anında', () => {
  test('açılır açılmaz gelen Esc menüyü kapatır, alttaki katmana inmez (zamanlayıcı beklenmez)', () => {
    jest.useFakeTimers();
    veAvatarMenuAc();
    expect(document.querySelectorAll('.ve-avatar-menu')).toHaveLength(1);
    const alt = jest.fn();
    document.addEventListener('keydown', alt);              // alttaki katman: kabarcık evresinde
    document.getElementById('alt').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    document.removeEventListener('keydown', alt);
    expect(document.querySelectorAll('.ve-avatar-menu')).toHaveLength(0);
    expect(alt).not.toHaveBeenCalled();
    expect(document.getElementById('ve-bant-avatar').getAttribute('aria-expanded')).toBe('false');
  });

  test('dış tık menüyü kapatır — dinleyicisi açılıştan sonra bağlanır, kapanan menüde bağlanmaz', () => {
    jest.useFakeTimers();
    veAvatarMenuAc();
    const tik = () => document.getElementById('alt').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    tik();                                                   // açılışın aynı anı: menü kalır
    expect(document.querySelectorAll('.ve-avatar-menu')).toHaveLength(1);
    jest.runAllTimers();
    tik();
    expect(document.querySelectorAll('.ve-avatar-menu')).toHaveLength(0);
    // Esc ile hemen kapanan menünün zamanlayıcısı dinleyiciyi bağlamaz
    veAvatarMenuAc();
    document.getElementById('alt').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    const ekle = jest.spyOn(document, 'addEventListener');
    jest.runAllTimers();
    expect(ekle.mock.calls.filter((c) => c[0] === 'mousedown')).toHaveLength(0);
    ekle.mockRestore();
  });
});
