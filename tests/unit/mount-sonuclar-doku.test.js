/**
 * mount-sonuclar-doku.test.js — SONUÇLAR SAYFASININ DOKUSU (Tur 6, 2026-10-15)
 * ─────────────────────────────────────────────────────────────────────────
 * Takoz turunda Sonuçlar'da ölçülen eski hâl:
 *   · frekans yanıtında "izolasyon başlangıcı 10,2 Hz" işareti DÜŞEY (T_2)
 *     eğriden hesaplanıp şeritlerin hepsini dikine kesiyordu; boyuna şeritte
 *     o şeridin kendi eşiği 15,7 Hz — işaret yönünü söylemiyordu
 *   · ağaç satırının oku adsız, odaklanamayan bir <span>'dı (klavyeyle
 *     açılamıyor, ekran okuyucu ne olduğunu söyleyemiyordu)
 *   · koyu temada fare altındaki işaretsiz satırın yazısı 4,497:1 (AA 4,5)
 * Fare altının gerçek ölçümü ortak turda (yuzey-turu.js → sonuclar · kontrast.spec).
 */
const fs = require('fs');
const path = require('path');
const B = require('../../js/mount-brief.js');
const KOK = path.join(__dirname, '../..');
const CSS = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8');
const RES = fs.readFileSync(path.join(KOK, 'js/results.js'), 'utf8');
// results.js global tanımlar; iki küçük işlev kaynağından çıkarılır
const islev = (ad) => RES.match(new RegExp('function ' + ad + '\\(([^)]*)\\) \\{[\\s\\S]*?\\n\\}'))[0];

describe('FRF — izolasyon işareti hangi yönün eşiği olduğunu söyler', () => {
  test('işaretin etiketi "düşey" diyor', () => {
    const f = [], T = [];
    for (let i = 0; i < 200; i++) { const fi = Math.pow(10, -1 + 3 * i / 199), r = fi / 7; f.push(fi); T.push(Math.abs(1 / (1 - r * r)) + 0.001); }
    const ds = { key: 'frf', x: { data: f }, channels: [{ id: 'T_2', name: 'İletilebilirlik T — Z (düşey)', unit: '−', data: T }] };
    const b = B.build(ds, { modes: [] });
    const iz = b.marks.filter((m) => m.kind === 'ref');
    expect(iz).toHaveLength(1);
    expect(iz[0].label).toMatch(/^düşey izolasyon başlangıcı [\d,]+ Hz$/);
  });
});

describe('Sonuçlar ağacı — ok adlı, odaklanabilir bir düğme', () => {
  const veIkon = (ad) => '<span class="mf-ico mf-ico-' + ad + '" aria-hidden="true"></span>';
  const veAgacOk = new Function('veIkon', islev('veAgacOk') + '\nreturn veAgacOk;')(veIkon);
  const veToggleTree = new Function(islev('veToggleTree') + '\nreturn veToggleTree;')();

  test('ok bir <button>: adı ve açıklığı var', () => {
    const d = document.createElement('div'); d.innerHTML = veAgacOk(false);
    const b = d.firstElementChild;
    expect(b.tagName).toBe('BUTTON');
    expect(b.getAttribute('type')).toBe('button');
    expect(b.getAttribute('aria-label')).toBeTruthy();
    expect(b.getAttribute('aria-expanded')).toBe('false');
  });

  test('aç/kapa aria-expanded\'ı ve oku birlikte çevirir', () => {
    document.body.innerHTML = '<div class="ve-tree-item"><div class="ve-tree-row">' + veAgacOk(false)
      + '<span>Sekme</span></div><div class="ve-tree-children"></div></div>';
    const satir = document.querySelector('.ve-tree-row'), b = satir.querySelector('.arrow');
    veToggleTree(satir);
    expect(document.querySelector('.ve-tree-children').classList.contains('open')).toBe(true);
    expect(b.getAttribute('aria-expanded')).toBe('true');
    expect(b.querySelector('.mf-ico').className).toContain('chevron-down');
    veToggleTree(satir);
    expect(b.getAttribute('aria-expanded')).toBe('false');
  });

  test('alt öğesi olmayan satırın ok yeri tıklanmaz, gizli', () => {
    expect(RES).not.toMatch(/<span class="arrow" onclick=/);
  });

  test('CSS: düğmenin tarayıcı görünümü sıfır, klavye odağı görünür', () => {
    expect(CSS).toMatch(/\.ve-tree-row \.arrow\{[^}]*background:none;border:0;padding:0/);
    expect(CSS).toMatch(/\.ve-tree-row \.arrow:focus-visible\{[^}]*outline:2px solid/);
  });
});

describe('Fare altındaki işaretsiz satır — soluk yazı tülün üstünde AA', () => {
  test('ad ve birim fare altında --text-secondary', () => {
    expect(CSS).toMatch(/\.vsig-row:hover \.vsig-name, \.vsig-row:hover \.vsig-unit\{color:var\(--text-secondary\);\}/);
  });
});
