/**
 * kimlik-menu.test.js — HESAP MENÜSÜ: TEK ESC TEK KATMAN, AÇILIŞIN İLK ANINDA DA
 * ─────────────────────────────────────────────────────────────────────────────
 * Esc'nin dinleyicisi menü açılırken `setTimeout(0)` ile bağlanıyordu: açılışla
 * zamanlayıcı arasında gelen Esc menüyü kapatmıyor, alttaki katmana (müfettiş
 * sütunu — map.js'in dinleyicisi) iniyordu. Ürün turu yük altında yakaladı
 * (ust-bant.spec.js → TEK ESC TEK KATMAN: 160 testte 1 kez kırmızı). Dış tıkın
 * dinleyicisi gecikmeli kalır — menüyü açan tıkı görmesin.
 */
const fs = require('fs');
const path = require('path');
const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
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

// SIKI MENÜ (kullanıcı 2026-11-10, Canlı Not 109: *"Bu kısımda da boşluklar fazla …
// isimler çizgi falan çok boşluklu"*): hesap menüsünde satır 24 px (30 idi), başlıkta
// 28 px avatar (36 idi), ayraç payı 3 px (4 idi), yüzeyin dolgusu 4 px (6 idi). Menü
// 206 → 160 px. Menü yüzeyi (`.ve-context-menu`) sağ tık menülerinin de yüzeyi:
// değişiklik hesap menüsünün kapsamında kalır. Avatarın 36 px boyu Ayarlar → Kimlik'te.
describe('SIKI MENÜ — hesap menüsü', () => {
  const kural = (sel) => (CSS.match(new RegExp('(?:^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
  test('satır, başlık, ayraç ve dolgu sıkı; paylaşılan menü yüzeyi eski ölçüde', () => {
    expect(kural('.ve-avatar-menu .ve-context-item')).toMatch(/padding:\s*4px 10px/);
    expect(kural('.ve-avatar-menu .ve-context-divider')).toMatch(/margin:\s*3px 8px/);
    expect(kural('.ve-avatar-menu .ve-avatar-menu-av')).toMatch(/width:\s*28px[^}]*height:\s*28px/);
    expect(kural('.ve-avatar-menu')).toMatch(/padding:\s*4px 0/);
    expect(kural('.ve-avatar-menu-bas')).toMatch(/padding:\s*6px 12px/);
    expect(kural('.ve-avatar-menu-ad')).toMatch(/padding:\s*6px 12px/);
    // Paylaşılan taban: sağ tık menüleri 30 px satır, 4 px ayraç payıyla kalır.
    expect(kural('.ve-context-item')).toMatch(/padding:\s*7px 10px/);
    expect(kural('.ve-context-divider')).toMatch(/margin:\s*4px 8px/);
    // Ayarlar → Kimlik avatarı hesap menüsünün tabanındaki 36 px dairedir.
    expect(kural('.ve-avatar-menu-av')).toMatch(/width:\s*36px[^}]*height:\s*36px/);
  });
});
