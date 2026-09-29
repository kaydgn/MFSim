/**
 * fead-motor.js — testte ÖRNEĞİN MOTOR KÜNYESİNİ TAMAMLAR.
 *
 * İşletme hesabı (gerilme, kayma, ömür, senaryo) motor künyesi olmadan
 * yapılmaz (js/fead-model.js → veFeadIsletmeEksik). Gates örnekleri motorun
 * devir sınırlarını TAŞIMAZ — raporlarda yok — ve örneğe sayı uydurulmaz
 * (FEAD kural 19). Test, kullanıcının yapacağını yapar: motor kataloğundan bir
 * kaydın DEVİR SINIRLARINI yazar.
 *
 * ÇAPLAR YAZILMAZ: `veFeadEngineApply` kademe çaplarını da yazıyor ve BMC
 * örneğinin oranını (197,32 / 179,62) kataloğun çaplarıyla değiştirirdi —
 * ölçülen şey başka bir model olurdu. Dolu alan EZİLMEZ.
 *
 * Kullanım:
 *   const { motorluOrnekler } = require('../helpers/fead-motor');
 *   motorluOrnekler(M);          // M = require('../../js/fead-model.js')
 * `veFeadExampleNodes`'u sarar; örnek yükleyicisi (cp-fead.js →
 * veFeadLoadExample) onu global adıyla çağırdığı için global de sarılır.
 */
const E = require('../../js/fead-engines.js');

// ISL8.9E3 375 — rölanti 700 · governed 2100 · overspeed 2900 · 6 silindir.
const MOTOR = '57RS303252';

function motorTamamla(sd, key) {
  const e = E.veFeadEngineOf(key || MOTOR);
  if (!sd || !e) return sd;
  ['idleRpm', 'governedRpm', 'overspeedRpm'].forEach((k) => {
    if (!(Number(sd[k]) > 0) && e[k] != null) sd[k] = e[k];
  });
  if (!(Number(sd.cylinders) > 0)) sd.cylinders = e.cyl;
  return sd;
}

function motorluPaket(pack, key) {
  if (!pack || !Array.isArray(pack.nodes)) return pack;
  pack.nodes.forEach((n) => {
    if (n && n.type === 'fead-solver') { n.data = n.data || {}; motorTamamla(n.data, key); }
  });
  return pack;
}

function motorluOrnekler(M, key) {
  const asil = M.veFeadExampleNodes;
  if (asil && asil._motorlu) return M.veFeadExampleNodes;
  const sarili = function (k) { return motorluPaket(asil.apply(this, arguments), key); };
  sarili._motorlu = true;
  M.veFeadExampleNodes = sarili;
  if (typeof global.veFeadExampleNodes === 'function') global.veFeadExampleNodes = sarili;
  return sarili;
}

module.exports = { MOTOR, motorTamamla, motorluPaket, motorluOrnekler };
