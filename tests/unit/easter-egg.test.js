/**
 * easter-egg.js birim testleri — Deniz Harp Okulu onur penceresi
 * ──────────────────────────────────────────────────────────────
 * Değeri olan kısım gizli-dizi eşleştirme motorudur (_mfDhoFeed): kayan
 * tampon, harf-dışı tuşları yok sayma, büyük/küçük harf farksızlığı ve
 * eşleşme sonrası sıfırlama. Sunum (modal HTML) için yalnız tek bir
 * "açılıyor/patlamıyor" smoke testi (test politikası: düşük değerli
 * assertion'ları çoğaltma).
 *
 * Modül module.exports guard'ı taşıdığı için doğrudan require edilir.
 */
const egg = require('../../js/easter-egg.js');

beforeEach(() => egg._mfDhoResetBuffer());

// ── Eşleştirme motoru ────────────────────────────────────────────────
describe('_mfDhoFeed — gizli dizi eşleştirme', () => {
  function feedAll(str) {
    let hit = false;
    for (const ch of str) hit = egg._mfDhoFeed(ch);
    return hit; // son tuştaki dönüş
  }

  test('tam dizi son harfte eşleşir', () => {
    const seq = egg.MF_DHO_CONFIG.sequence; // 'denizharp'
    expect(feedAll(seq)).toBe(true);
  });

  test('eksik dizi eşleşmez', () => {
    expect(feedAll('denizhar')).toBe(false);
  });

  test('araya giren boşluk/rakam yok sayılır ("deniz harp" == "denizharp")', () => {
    expect(feedAll('deniz harp')).toBe(true);
    egg._mfDhoResetBuffer();
    expect(feedAll('deniz1harp')).toBe(true);
  });

  test('büyük/küçük harf farksız', () => {
    expect(feedAll('DeNizHARP')).toBe(true);
  });

  test('önüne gelen alakasız harfler eşleşmeyi bozmaz (kayan tampon)', () => {
    expect(feedAll('xyzdenizharp')).toBe(true);
  });

  test('eşleşmeden hemen sonra tampon sıfırlanır (tek tuş tekrar tetiklemez)', () => {
    expect(feedAll('denizharp')).toBe(true);
    // Ekstra bir "p" yeni bir eşleşme üretmemeli
    expect(egg._mfDhoFeed('p')).toBe(false);
  });

  test('çok tuşlu ama hiç tamamlanmayan akış eşleşmez', () => {
    expect(feedAll('merhabadunya')).toBe(false);
  });
});

// ── Sunum smoke testi (tek) ──────────────────────────────────────────
describe('onur penceresi (smoke)', () => {
  test('open → overlay kurulur ve açılır, close → kapanır (patlamadan)', () => {
    expect(() => egg.veDenizHarpOpen()).not.toThrow();
    const ov = document.getElementById('mf-dho');
    expect(ov).not.toBeNull();
    expect(ov.classList.contains('open')).toBe(true);
    // İçerik amblem + okul adını taşımalı
    expect(ov.innerHTML).toContain(egg.MF_DHO_CONFIG.okulAdi);
    expect(() => egg.veDenizHarpClose()).not.toThrow();
    expect(ov.classList.contains('open')).toBe(false);
  });
});
