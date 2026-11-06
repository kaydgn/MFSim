// ============================================================================
// tools/belge-tanim.js — ŞANZIMAN AİLESİNİN BELGESİ: sayfalar ve işaretli bölgeler
// ────────────────────────────────────────────────────────────────────────────
// Kullanıcı 2026-11-06 (Canlı Not 52): *"Önce şanzıman ailesi seçeriz, ardından o
// seçtiğimiz şanzıman ailesine ait PDF açılır ve o PDF üzerinden işaretlemeli
// şekilde şanzımanın özelliklerini seçeriz. Ama PDF ile aynı kalırız."*
//
// Bölgenin KONUMU belgeden ölçülür (tools/belge-sayfa.js, pdftotext -bbox): burada
// yalnız satırın YAZISI (`m`) ve seçtiği değerler (`s`) yazılır.
//   m      satırın metni (baştan eşleşir; `tam`: birebir)
//   sonra  önce bulunması gereken satırlar, sırayla (aynı adlı satırları ayırır)
//   satir  adın satır sayısı (iki satıra sarılan ad)
//   s      tık bu seçenekleri yazar; satır, seçim bunları taşıyorsa seçili
//   ek     yalnız seçili sayılma ve geçerlilik koşulu: { seçenek: [izinli değerler] }
//   alan   satırın sayısının programdaki karşılığı (VE_MNT_A4K yolu) — kapı
//          tests/unit/mount-belge.test.js → PDF İLE AYNI
//   sutun  sütun bölgesi: başlığın metni; kutu başlıktan `bitis` satırına
//   kutu   [x0, y0, x1, y1] pt — elle (soğutucunun başlığı ve resmi)
//   kutuSon  kutunun alt sınırı bu satırın altı (resmin künyesi)
// Sayfa: no (belgedeki), bas (bölümün belgedeki adı), x (satır kutusunun yatay
// aralığı, pt).
// ============================================================================
'use strict';

const ALTI = { dizi: ['cr', 'wr'] };           // close ratio · wide ratio (altı vites)

// §9.1 / §11.1 alt tabloları: grup satırı + soğutucu satırları
function cgGrup(bag, bas) {
  const B = bag === 'd' ? 'DIRECT-MOUNT TRANSMISSIONS' : 'REMOTE-MOUNT TRANSMISSIONS';
  const L = [{ m: B, s: { bag }, ek: ALTI }];
  [['No Retarder, No PTO Provision', '0', '0', ['u', 's', 'y']],
   ['No Retarder, With PTO Provision', '0', '1', ['u', 's', 'y']],
   ['With Retarder, No PTO Provision', '1', '0', ['u', 'r']],
   ['With Retarder, With PTO Provision', '1', '1', ['u', 'r']]].forEach(([g, ret, pto, sog]) => {
    L.push({ m: g, sonra: [B], s: { bag, ret, pto }, ek: ALTI });
    const ad = { u: 'With remote cooler provision', s: 'With standard-capacity, direct-mount cooler',
      y: 'With high-capacity, direct-mount cooler', r: 'With direct-mount retarder/sump cooler' };
    sog.forEach((k) => L.push({ m: ad[k], sonra: [B, g], s: { bag, ret, pto, sog: k }, ek: ALTI,
      alan: 'cg.6.' + bag + '.' + ret + pto + '.' + k }));
  });
  return L;
}
function cg7(bag) {
  const B = bag === 'd' ? 'DIRECT-MOUNT TRANSMISSIONS' : 'REMOTE-MOUNT TRANSMISSIONS';
  return [{ m: B, s: { dizi: '7', bag } }].concat([
    ['No Retarder, No PTO Provision', '0', '0'], ['No Retarder, With PTO Provision', '0', '1'],
    ['With Retarder, No PTO Provision', '1', '0'], ['With Retarder, With PTO Provision', '1', '1']]
    .map(([g, ret, pto]) => ({ m: g, sonra: [B], s: { dizi: '7', bag, ret, pto }, alan: 'cg.7.' + bag + '.' + ret + pto })));
}

module.exports = {
  'allison-4000': {
    pdf: 'docs/belge/allison-4000/DATA_4K_TRANSMISSION_DATA_PRODUCT_FAMILY.pdf',
    ad: '4000 Product Family Transmission Data', kod: 'DATA_4K', tarih: '15.10.2020',
    dpi: 150, kalite: 0.8,
    sayfalar: [
      { no: 5, bas: '8.0 Dry Weights', x: [52, 560], bolge: [
        { m: 'Close Ratio and Wide Ratio Models', ek: ALTI, alan: 'kutle.temel.cr' },
        { m: 'Seven-Speed Models', s: { dizi: '7' }, alan: 'kutle.temel.7' },
        { m: 'Power Take-Off Provision', s: { pto: '1' }, alan: 'kutle.pto' },
        { m: 'Retarder Option', s: { ret: '1' }, alan: 'kutle.ret' },
        { m: 'Direct-Mount Retarder / Sump Cooler', s: { ret: '1', sog: 'r' }, alan: 'kutle.sog.r' },
        // uzak soğutucu şasidedir: kütlesi gövdeye girmez (programda 0)
        { m: 'Remote Retarder / Sump Cooler', s: { ret: '1', sog: 'u' } },
        { m: 'Direct-Mount Non-Retarder Standard-Capacity Cooler', s: { ret: '0', sog: 's' }, alan: 'kutle.sog.s' },
        { m: 'Direct-Mount Non-Retarder High-Capacity Cooler', s: { ret: '0', sog: 'y' }, alan: 'kutle.sog.y' },
        { m: 'Retarder Accumulator', tam: true, s: { ret: '1', aku: '1' }, alan: 'kutle.aku' },
        { m: 'Retarder Accumulator Solenoid', s: { ret: '1', aku: '1' }, alan: 'kutle.akuSol' },
        { m: 'Remote-Mount Provision', s: { bag: 'u' }, alan: 'kutle.uzak' },
        { m: 'Rear Mount Bracket for Remote-Mount 6-Speed Transmissions', s: { bag: 'u' }, ek: ALTI, alan: 'kutle.uzakArka6' },
        { m: 'Output Flange or Yoke', ek: {} }
      ] },
      { no: 6, bas: '9.1 Center of Gravity: Close Ratio and Wide Ratio Models', x: [58, 548],
        bolge: cgGrup('d').concat(cgGrup('u')) },
      { no: 7, bas: '9.2 Center of Gravity: Seven-Speed Models', x: [58, 548], bolge: cg7('d').concat(cg7('u')) },
      { no: 8, bas: '11.0 Mass Moments of Inertia', x: [58, 552], bolge: [
        { m: 'No Retarder, No PTO Provision', s: { ret: '0', pto: '0' }, ek: ALTI, alan: 'atalet.6.00' },
        { m: 'No Retarder, With PTO Provision', s: { ret: '0', pto: '1' }, ek: ALTI, alan: 'atalet.6.01' },
        { m: 'With Retarder, No PTO Provision', s: { ret: '1', pto: '0' }, ek: ALTI },
        { m: 'With Remote Cooler Provision', sonra: ['With Retarder, No PTO Provision'], s: { ret: '1', pto: '0', sog: 'u' }, ek: ALTI, alan: 'atalet.6.10.u' },
        { m: 'With Direct-Mount Retarder/Sump', sonra: ['With Retarder, No PTO Provision'], satir: 2, s: { ret: '1', pto: '0', sog: 'r' }, ek: ALTI, alan: 'atalet.6.10.r' },
        { m: 'With Retarder and PTO Provision', s: { ret: '1', pto: '1' }, ek: ALTI },
        { m: 'With Remote Cooler Provision', sonra: ['With Retarder and PTO Provision'], s: { ret: '1', pto: '1', sog: 'u' }, ek: ALTI, alan: 'atalet.6.11.u' },
        { m: 'With Direct-Mount Retarder/Sump', sonra: ['With Retarder and PTO Provision'], satir: 2, s: { ret: '1', pto: '1', sog: 'r' }, ek: ALTI, alan: 'atalet.6.11.r' },
        { m: 'No Retarder, No PTO Provision', sonra: ['11.2 MOMENTS OF INERTIA'], s: { dizi: '7', ret: '0', pto: '0' }, alan: 'atalet.7.00' },
        { m: 'No Retarder, With PTO Provision', sonra: ['11.2 MOMENTS OF INERTIA'], s: { dizi: '7', ret: '0', pto: '1' }, alan: 'atalet.7.01' },
        { m: 'With Retarder, No PTO Provision', sonra: ['11.2 MOMENTS OF INERTIA'], s: { dizi: '7', ret: '1', pto: '0' }, alan: 'atalet.7.10' },
        { m: 'With Retarder and PTO Provision', sonra: ['11.2 MOMENTS OF INERTIA'], s: { dizi: '7', ret: '1', pto: '1' }, alan: 'atalet.7.11' }
      ] },
      { no: 9, bas: '12.0 Gear Ratios', x: [72, 540], bolge: [
        { sutun: 'CLOSE-RATIO', bitis: 'REVERSE', s: { dizi: 'cr' }, alan: ['oran.cr', 'geri.cr'] },
        { sutun: 'WIDE-RATIO', bitis: 'REVERSE', s: { dizi: 'wr' }, alan: ['oran.wr', 'geri.wr'] },
        { sutun: 'SEVEN-SPEED', bitis: 'REVERSE', s: { dizi: '7' }, alan: ['oran.7', 'geri.7'] }
      ] },
      { no: 10, bas: '13.0 Oil Types and Oil Fill Information', x: [58, 548], bolge: [
        { m: 'Deep Oil Sump, with PTO Provision', sonra: ['Base Models'], s: { kar: 'derin', pto: '1' }, ek: ALTI, alan: 'yag.6.derin.1' },
        { m: 'Deep Oil Sump, without PTO Provision', sonra: ['Base Models'], s: { kar: 'derin', pto: '0' }, ek: ALTI, alan: 'yag.6.derin.0' },
        { m: 'Shallow Oil Sump, with PTO Provision', s: { kar: 'sig', pto: '1' }, ek: ALTI, alan: 'yag.6.sig.1' },
        { m: 'Shallow Oil Sump, without PTO Provision', s: { kar: 'sig', pto: '0' }, ek: ALTI, alan: 'yag.6.sig.0' },
        { m: 'Deep Oil Sump, with PTO Provision', sonra: ['Seven-Speed Models'], s: { dizi: '7', kar: 'derin', pto: '1' }, alan: 'yag.7.derin.1' },
        { m: 'Deep Oil Sump, without PTO Provision', sonra: ['Seven-Speed Models'], s: { dizi: '7', kar: 'derin', pto: '0' }, alan: 'yag.7.derin.0' },
        { m: 'Direct-Mount, Non-Retarder, Standard-Capacity Cooler', s: { ret: '0', sog: 's' }, alan: 'yag.sog.s' },
        { m: 'Direct-Mount, Non-Retarder, High-Capacity Cooler', s: { ret: '0', sog: 'y' }, alan: 'yag.sog.y' },
        { m: 'Direct-Mount, Retarder/Sump Cooler', s: { ret: '1', sog: 'r' }, alan: 'yag.sog.r' },
        // uzak soğutucunun yağı gövdeye girmez (programda 0)
        { m: 'Remote, Retarder with Sump Cooler', s: { ret: '1', sog: 'u' } },
        { m: 'Additional Fill for Retarder Accumulator', s: { ret: '1', aku: '1' }, alan: 'yag.aku' }
      ] },
      // Soğutucular: başlık ve resim (17.3–17.8)
      { no: 21, bas: '17.3 Remote Retarder / Sump Cooler', bolge: [{ m: '17.3 REMOTE RETARDER', kutuSon: 'D185', s: { ret: '1', sog: 'u' } }] },
      { no: 27, bas: '17.4 Direct-Mount Retarder / Sump Cooler', bolge: [{ m: '17.4 DIRECT-MOUNT', kutuSon: 'D182', s: { ret: '1', sog: 'r' } }] },
      { no: 33, bas: '17.5 Direct-Mount, Standard-Capacity Cooler', bolge: [{ m: '17.5 DIRECT-MOUNT', kutuSon: 'D186', s: { ret: '0', sog: 's' } }] },
      { no: 37, bas: '17.6 Direct-Mount High-Capacity Cooler', bolge: [{ m: '17.6 DIRECT-MOUNT', kutuSon: 'D187', s: { ret: '0', sog: 'y' } }] },
      { no: 41, bas: '17.7 Remote-Mount Tube & Shell Cooler', bolge: [{ m: '17.7 REMOTE-MOUNT', kutuSon: 'D184', s: { sog: 'u' } }] },
      { no: 45, bas: '17.8 Remote-Mount Tube & Shell Cooler', bolge: [{ m: '17.8 REMOTE-MOUNT', kutuSon: 'D183', s: { sog: 'u' } }] }
    ]
  }
};
