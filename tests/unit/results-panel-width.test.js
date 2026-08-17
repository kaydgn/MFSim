/**
 * results-panel-width.test.js — Sonuçlar / Veri Gezgini panelinin genişliği
 *
 * KULLANICI ŞİKÂYETİ (2026-08-13): "Sonuçlar penceresini açtığım zaman default
 * olarak kötü görünüyor" — panel 250px'ti ve ağaçtaki en uzun etiket
 * ("Detay Matematik Hesapları — Yüksek Kademe (TXT)") iki satıra sarıyordu.
 *
 * ÖLÇÜM (gerçek tarayıcı): etiketin tek satıra sığması için panel ≥ 360px
 * olmalı — 340px'te hâlâ sarıyor.
 *
 * Burada test edilen şey etiketin kendisi DEĞİL (o kırılgan olurdu), iki
 * yapısal sözleşme:
 *   1) varsayılan genişlik ölçülen eşiğin altına düşmesin,
 *   2) sürükleme sınırları (results.js) ile kutunun CSS sınırları (index.html)
 *      AYNI olsun — ayrılırsa sürükleme kendi sınırına dayanır ama kutu CSS
 *      sınırında durur; kullanıcı "takıldı" sanır.
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const results = fs.readFileSync(path.join(__dirname, '../../js/results.js'), 'utf8');

// #ve-results-browser'ın satır-içi stilinden sayıları çek
const boxStyle = (html.match(/id="ve-results-browser"\s+style="([^"]+)"/) || [])[1] || '';
const px = (prop) => {
  const m = boxStyle.match(new RegExp(prop + '\\s*:\\s*(\\d+)px'));
  return m ? parseInt(m[1], 10) : null;
};

// results.js veInitResultSlots içindeki kırpma: Math.max(MIN, Math.min(MAX, ...))
const clamp = results.match(/Math\.max\((\d+),\s*Math\.min\((\d+),\s*startW/);

// Tarayıcıda ölçüldü. Eşik 360'tı; oku olmayan ağaç satırlarına ok sütunu
// kadar (18px) girinti eklenince — sol kenar tırtıklı durmasın diye, 2026-08-17
// — o etiket yeniden sarmaya başladı ve eşik 370'e çıktı. Ölçüm: 360'ta iki
// satır sarıyor, 370'te hiçbiri sarmıyor.
const OLCULEN_ESIK = 370;

describe('Veri Gezgini paneli — varsayılan genişlik', () => {
  test('satır-içi stil okunabiliyor', () => {
    expect(boxStyle).toContain('width');
    expect(px('width')).not.toBeNull();
    expect(px('min-width')).not.toBeNull();
    expect(px('max-width')).not.toBeNull();
  });

  test('varsayılan genişlik, sarmayı bitiren ölçülen eşikten küçük değil', () => {
    expect(px('width')).toBeGreaterThanOrEqual(OLCULEN_ESIK);
  });

  test('min < varsayılan < max', () => {
    expect(px('min-width')).toBeLessThan(px('width'));
    expect(px('max-width')).toBeGreaterThan(px('width'));
  });

  // Varsayılan tavana yapışırsa ayırıcı işe yaramaz hâle gelir.
  test('varsayılanın üstünde genişletmek için hâlâ yer var (≥100px)', () => {
    expect(px('max-width') - px('width')).toBeGreaterThanOrEqual(100);
  });
});

describe('Sürükleme sınırları ile CSS sınırları aynı', () => {
  test('results.js kırpması bulunuyor', () => {
    expect(clamp).not.toBeNull();
  });

  test('alt sınır index.html min-width ile aynı', () => {
    expect(parseInt(clamp[1], 10)).toBe(px('min-width'));
  });

  test('üst sınır index.html max-width ile aynı', () => {
    expect(parseInt(clamp[2], 10)).toBe(px('max-width'));
  });
});

// Aynı panel Ölçüm Görüntüleyici'de de var; kırpma oraya ELDEN taşınıyor
// (viewer/sync.js "veInitResultSlots" çapası). Sınırlar orada da tutmalı.
describe('Görüntüleyici kopyasında da sınırlar tutarlı', () => {
  const vHtml = fs.readFileSync(path.join(__dirname, '../../viewer/index.html'), 'utf8');
  const vBoard = fs.readFileSync(path.join(__dirname, '../../viewer/js/board.js'), 'utf8');
  const vStyle = (vHtml.match(/id="ve-results-browser"\s+style="([^"]+)"/) || [])[1] || '';
  const vpx = (prop) => {
    const m = vStyle.match(new RegExp(prop + '\\s*:\\s*(\\d+)px'));
    return m ? parseInt(m[1], 10) : null;
  };
  const vClamp = vBoard.match(/Math\.max\((\d+),\s*Math\.min\((\d+),\s*startW/);

  test('görüntüleyici kırpması bulunuyor', () => {
    expect(vClamp).not.toBeNull();
    expect(vpx('min-width')).not.toBeNull();
  });

  test('görüntüleyicinin kendi sınırları kendi içinde tutarlı', () => {
    expect(parseInt(vClamp[1], 10)).toBe(vpx('min-width'));
    expect(parseInt(vClamp[2], 10)).toBe(vpx('max-width'));
  });
});
