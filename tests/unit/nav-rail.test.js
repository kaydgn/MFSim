/**
 * Sayfa rayı (activity bar) — sayfa anahtarı durum yönetimi
 * ─────────────────────────────────────────────────────────
 * veSubTabDegistir() iki şeyi aynı anda tutarlı tutmak zorunda: hangi SAYFA
 * görünür ve rayda hangi öğe aktif. İkisi ayrışırsa kullanıcı "Sonuçlar" işaretli
 * dururken topolojiye bakar — gözle "makul ama yanlış" görünen, kimsenin hata
 * sanmadığı bir durum. Bu yüzden test edilen şey görsel değil, o senkron.
 *
 * Kapsam:
 *   • sayfa görünürlüğü ⇄ rayda aktif öğe senkronu
 *   • ARIA (aria-selected) ve roving tabindex — ray Tab sırasında BİR durak
 *   • ↑/↓/Home/End ile klavye gezinmesi
 *
 * Etiket metinleri ve CSS bilerek test EDİLMEZ (bkz. CLAUDE.md test politikası):
 * "Topoloji" yazısını değiştirmek davranışı bozmaz, testi bozmamalı.
 */

// Ray, tabs.js'in IIFE'si dinleyiciyi bağlamadan ÖNCE var olmalı → modül
// kapsamında bir kez kurulur, testler arasında innerHTML sıfırlanmaz.
document.body.innerHTML = `
  <div id="ve-ribbon"></div>
  <div id="sayfa2-content">
    <nav class="ve-nav-rail" id="ve-nav-rail" role="tablist">
      <button class="ve-nav-item active" data-subtab="arac-performans" role="tab"
              aria-selected="true" tabindex="0"></button>
      <button class="ve-nav-item" data-subtab="sonuclar" role="tab"
              aria-selected="false" tabindex="-1"></button>
    </nav>
    <div class="ve-main" id="ve-page-topoloji"></div>
    <div class="ve-sub-page" id="ve-page-sonuclar" style="display:none;"></div>
  </div>
`;

const stubs = stubGlobals({
  veEnterResults: jest.fn(),
  veShowAllSidebarComponents: jest.fn(),
  veRibbonOnPageChange: jest.fn(),
});

eval(loadSource('tabs.js'));

const rail = () => document.getElementById('ve-nav-rail');
const item = (name) => document.querySelector('.ve-nav-item[data-subtab="' + name + '"]');
const main = () => document.querySelector('.ve-main');
const sonuclar = () => document.getElementById('ve-page-sonuclar');
const aktif = () => document.querySelector('.ve-nav-item.active').getAttribute('data-subtab');

const bas = (tus) =>
  document.activeElement.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: tus, bubbles: true })
  );

beforeEach(() => {
  resetStubs(stubs);
  veSubTabDegistir('arac-performans');
  resetStubs(stubs);
});

describe('sayfa görünürlüğü ⇄ rayda aktif öğe', () => {
  test('Sonuçlar seçilince topoloji gizlenir, sonuç sayfası açılır', () => {
    veSubTabDegistir('sonuclar');
    expect(main().style.display).toBe('none');
    expect(sonuclar().style.display).toBe('flex');
    expect(aktif()).toBe('sonuclar');
  });

  test('Topoloji seçilince tersi olur — sayfa ile ray birlikte döner', () => {
    veSubTabDegistir('sonuclar');
    veSubTabDegistir('arac-performans');
    expect(main().style.display).toBe('flex');
    expect(sonuclar().style.display).toBe('none');
    expect(aktif()).toBe('arac-performans');
  });

  test('aktif öğe her zaman TEK — iki sayfa aynı anda işaretli kalmaz', () => {
    veSubTabDegistir('sonuclar');
    expect(document.querySelectorAll('.ve-nav-item.active')).toHaveLength(1);
    veSubTabDegistir('arac-performans');
    expect(document.querySelectorAll('.ve-nav-item.active')).toHaveLength(1);
  });

  test('Sonuçlar sayfası açılışı veri ağacını tazeler (veEnterResults)', () => {
    veSubTabDegistir('sonuclar');
    expect(stubs.veEnterResults).toHaveBeenCalled();
  });

  test('şerit her sayfa değişiminde haberdar edilir (bağlamsal sekme)', () => {
    veSubTabDegistir('sonuclar');
    expect(stubs.veRibbonOnPageChange).toHaveBeenCalled();
  });
});

describe('erişilebilirlik', () => {
  test('aria-selected aktif öğeyi izler', () => {
    veSubTabDegistir('sonuclar');
    expect(item('sonuclar').getAttribute('aria-selected')).toBe('true');
    expect(item('arac-performans').getAttribute('aria-selected')).toBe('false');
  });

  /* Roving tabindex: her öğe tabindex=0 olsaydı Tab tuşu ray'da öğe sayısı
     kadar durur, klavye kullanıcısı her turda fazladan tuşa basardı. */
  test('Tab sırasında yalnız aktif öğe var (roving tabindex)', () => {
    veSubTabDegistir('sonuclar');
    const odaklanabilir = [...document.querySelectorAll('.ve-nav-item')]
      .filter((b) => b.tabIndex === 0);
    expect(odaklanabilir).toHaveLength(1);
    expect(odaklanabilir[0].getAttribute('data-subtab')).toBe('sonuclar');
  });
});

describe('klavye gezinmesi', () => {
  test('↓ bir sonraki sayfaya geçer ve odağı taşır', () => {
    item('arac-performans').focus();
    bas('ArrowDown');
    expect(aktif()).toBe('sonuclar');
    expect(document.activeElement).toBe(item('sonuclar'));
  });

  test('↑ geri döner', () => {
    veSubTabDegistir('sonuclar');
    item('sonuclar').focus();
    bas('ArrowUp');
    expect(aktif()).toBe('arac-performans');
  });

  test('uçlarda sarar — son öğede ↓ ilk öğeye gider', () => {
    veSubTabDegistir('sonuclar');
    item('sonuclar').focus();
    bas('ArrowDown');
    expect(aktif()).toBe('arac-performans');
  });

  test('Home / End uçlara atlar', () => {
    item('arac-performans').focus();
    bas('End');
    expect(aktif()).toBe('sonuclar');
    bas('Home');
    expect(aktif()).toBe('arac-performans');
  });

  test('ilgisiz tuş sayfayı değiştirmez', () => {
    item('arac-performans').focus();
    bas('a');
    bas('Enter');
    expect(aktif()).toBe('arac-performans');
  });
});
