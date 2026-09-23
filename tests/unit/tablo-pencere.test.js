/**
 * tablo-pencere.test.js — SÜTUNA SIĞMAYAN TABLO AÇILIR PENCEREDE
 *
 * Kullanıcı isteği (2026-09-23): *"geniş tablolar bileşen pencerelerine
 * sığmıyor. Bu pencereleri açılır ufak pencereler şeklinde yapmamız
 * gerekiyor."* Ölçüldü: çalışma çevrimi tablosu 1162 px, sütun 359 px.
 *
 * Burada MEKANİZMA kapılı: katlama kararı, taşımanın KOPYA olmadığı, panel
 * yeniden çizilince pencerenin yeni birimi alması, ESC'nin tek katman
 * kapatması. jsdom yerleşim hesaplamaz — genişlikler elle verilir; gerçek
 * tarayıcı ölçümü `tests/e2e/tablo-pencere.spec.js`.
 */
const T = require('../../js/tablo-pencere.js');

// Bir birim + onu taşıyan panel. Genişlikler jsdom'a elle yazılır.
function panelKur(anahtar, dogal, kap) {
  const panel = document.createElement('div');
  panel.className = 've-properties-content';
  panel.innerHTML = '<section class="ve-fp-card">'
    + '<div class="ve-tablo" data-ve-tablo="' + anahtar + '" data-ve-tablo-baslik="Çalışma Çevrimi"'
    + ' data-ve-tablo-ozet="5 devir noktası · 600–2200 d/dk · 4 aksesuar sütunu">'
    + '<div class="ve-fp-duty"><table><tbody><tr><td><input id="h1" value="600"></td></tr></tbody></table></div>'
    + '<div class="ve-fp-eylem"><button type="button" class="ve-fp-dugme">+ Devir satırı</button></div>'
    + '</div></section>';
  document.body.appendChild(panel);
  const kapEl = panel.querySelector('.ve-fp-card');
  Object.defineProperty(kapEl, 'clientWidth', { configurable: true, get: () => kap });
  const tbl = panel.querySelector('table');
  Object.defineProperty(tbl, 'offsetWidth', { configurable: true, get: () => dogal });
  return panel;
}

beforeEach(() => {
  T.veTabloKapat();
  document.body.innerHTML = '';
});

describe('karar ÖLÇÜMDEN — liste değil', () => {
  test('sığmayan tablo KATLANIR ve yerinde özet kartı kalır', () => {
    const panel = panelKur('fead-duty:s1', 1162, 359);
    T.veTabloKatla(panel);
    const birim = panel.querySelector('[data-ve-tablo]');
    const kart = panel.querySelector('.ve-tablo-kart');
    expect(birim.classList.contains('ve-tablo--katli')).toBe(true);
    expect(kart.hidden).toBe(false);
    // Kart KENDİ cümlesini uydurmaz: özet panelden gelir; ilk parça başlık.
    expect(kart.querySelector('b').textContent).toBe('5 devir noktası');
    expect(kart.textContent).toContain('600–2200 d/dk');
    expect(kart.querySelector('.ve-tablo-ac')).toBeTruthy();
  });

  test('SIĞAN tabloya dokunulmaz — geniş modalda tablo yerinde durur', () => {
    const panel = panelKur('fead-curve:k1', 300, 359);
    T.veTabloKatla(panel);
    expect(panel.querySelector('[data-ve-tablo]').classList.contains('ve-tablo--katli')).toBe(false);
    expect(panel.querySelector('.ve-tablo-kart').hidden).toBe(true);
  });

  test('gizli sekmede (genişlik 0) karar VERİLMEZ — sekme açılınca verilir', () => {
    const panel = panelKur('fead-duty:s1', 1162, 0);
    T.veTabloKatla(panel);
    expect(panel.querySelector('[data-ve-tablo]').classList.contains('ve-tablo--katli')).toBe(false);
    // Sekme açıldı: aynı birim yeniden ölçülünce katlanır.
    Object.defineProperty(panel.querySelector('.ve-fp-card'), 'clientWidth', { configurable: true, get: () => 359 });
    T._veTabloOlc(panel.querySelector('[data-ve-tablo]'));
    expect(panel.querySelector('[data-ve-tablo]').classList.contains('ve-tablo--katli')).toBe(true);
  });
});

describe('açılır pencere — tablo TAŞINIR, kopyalanmaz', () => {
  test('pencere birimin KENDİSİNİ taşıyor (olay işleyicileri aynı modeli yazar)', () => {
    const panel = panelKur('fead-duty:s1', 1162, 359);
    T.veTabloKatla(panel);
    const birim = panel.querySelector('[data-ve-tablo]');
    panel.querySelector('.ve-tablo-ac').click();
    const pencere = document.querySelector('.ve-tablo-pencere');
    expect(pencere).toBeTruthy();
    expect(pencere.getAttribute('role')).toBe('dialog');
    expect(pencere.querySelector('[data-ve-tablo]')).toBe(birim);   // AYNI düğüm
    expect(birim.classList.contains('ve-tablo--katli')).toBe(false);
    // Satır ekleyen düğme birimin İÇİNDE — pencereden de satır eklenebilir.
    expect(pencere.querySelector('.ve-fp-dugme')).toBeTruthy();
    // Kart yerinde kalıyor ve pencerenin açık olduğunu söylüyor.
    expect(panel.querySelector('.ve-tablo-kart').classList.contains('ve-tablo-kart--acik')).toBe(true);
    // Başlık ve özet pencerenin şeridinde.
    expect(pencere.querySelector('.ve-tablo-bas').textContent).toContain('Çalışma Çevrimi');
  });

  test('kapatınca birim KARTIN ARKASINA döner ve yeniden katlanır', () => {
    const panel = panelKur('fead-duty:s1', 1162, 359);
    T.veTabloKatla(panel);
    const birim = panel.querySelector('[data-ve-tablo]');
    T.veTabloAc('fead-duty:s1');
    T.veTabloKapat();
    expect(document.querySelector('.ve-tablo-pencere')).toBeNull();
    const kart = panel.querySelector('.ve-tablo-kart');
    expect(kart.nextElementSibling).toBe(birim);
    expect(birim.classList.contains('ve-tablo--katli')).toBe(true);
    expect(kart.classList.contains('ve-tablo-kart--acik')).toBe(false);
    expect(T.veTabloAcikMi()).toBe(false);
  });

  test('panel YENİDEN ÇİZİLİNCE (satır eklendi) yeni birim pencereye alınır', () => {
    const panel = panelKur('fead-duty:s1', 1162, 359);
    T.veTabloKatla(panel);
    T.veTabloAc('fead-duty:s1');
    const eski = document.querySelector('.ve-tablo-pencere [data-ve-tablo]');
    // showNodeProperties içeriği baştan kurar — aynı düğüm, aynı anahtar.
    panel.remove();
    const yeni = panelKur('fead-duty:s1', 1300, 359);
    T.veTabloKatla(yeni);
    const icerik = document.querySelectorAll('.ve-tablo-pencere [data-ve-tablo]');
    expect(icerik.length).toBe(1);                    // eskisi söküldü
    expect(icerik[0]).not.toBe(eski);
    expect(yeni.contains(icerik[0])).toBe(false);     // yenisi pencerede
    expect(T.veTabloAcikMi()).toBe(true);
  });

  test('panel BAŞKA bir düğüme geçince pencere KAPANIR — sahipsiz tablo kalmaz', () => {
    const panel = panelKur('fead-duty:s1', 1162, 359);
    T.veTabloKatla(panel);
    T.veTabloAc('fead-duty:s1');
    panel.remove();
    const baska = document.createElement('div');
    baska.innerHTML = '<p>kasnak paneli</p>';
    document.body.appendChild(baska);
    T.veTabloKatla(baska);
    expect(document.querySelector('.ve-tablo-pencere')).toBeNull();
    expect(T.veTabloAcikMi()).toBe(false);
  });
});

describe('TEK ESC = TEK KATMAN', () => {
  test('ESC yalnız pencereyi kapatır — alttaki müfettişin dinleyicisi tuşu GÖRMEZ', () => {
    const panel = panelKur('fead-duty:s1', 1162, 359);
    T.veTabloKatla(panel);
    let alttaki = 0;
    const dinle = (e) => { if (e.key === 'Escape') alttaki++; };
    document.addEventListener('keydown', dinle);          // map.js'in dinleyicisi gibi
    try {
      T.veTabloAc('fead-duty:s1');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.querySelector('.ve-tablo-pencere')).toBeNull();
      expect(alttaki).toBe(0);
      // Pencere kapandıktan sonra ESC yine alttakine gider (dinleyici söküldü).
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(alttaki).toBe(1);
    } finally { document.removeEventListener('keydown', dinle); }
  });

  test('odaktaki hücre pencere sökülmeden ÖNCE bırakılır (son değer yazılsın)', () => {
    const panel = panelKur('fead-duty:s1', 1162, 359);
    T.veTabloKatla(panel);
    T.veTabloAc('fead-duty:s1');
    const hucre = document.getElementById('h1');
    hucre.focus();
    expect(document.activeElement).toBe(hucre);
    let bagliyken = null;
    hucre.addEventListener('blur', () => { bagliyken = !!hucre.closest('.ve-tablo-pencere'); });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(bagliyken).toBe(true);        // blur, hücre hâlâ pencerenin içindeyken
  });
});
