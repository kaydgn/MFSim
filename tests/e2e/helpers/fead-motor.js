/**
 * fead-motor.js (e2e) — sayfada ÖRNEKLERİ MOTORLU kılar.
 *
 * Birim testlerdeki `tests/helpers/fead-motor.js`in tarayıcı karşılığı. Gates
 * örnekleri motorun devir sınırlarını TAŞIMAZ (raporlarında yok) ve işletme
 * hesabı onlarsız yapılmaz (FEAD kural 46): örneği ÇÖZEN bir spec, kullanıcının
 * yapacağı adımı yapar — motor kataloğundan bir kaydın DEVİR SINIRLARINI yazar.
 * Kademe çapları YAZILMAZ (BMC örneğinin oranı değişirdi), dolu alan EZİLMEZ.
 *
 * Sarılanlar: örnek düğüm paketi (`veFeadExampleNodes` — örnek yükleyicisi onu
 * global adıyla çağırıyor) ve sihirbaz tohumu (`veFeadWizSeed` — açılır liste
 * de global adıyla çağırıyor). Program yüklendikten SONRA çağrılır.
 */
const MOTOR = '57RS303252';   // ISL8.9E3 375 — 700 · 2100 · 2900 RPM · 6 silindir

async function motorluOrnekler(page, key) {
  await page.evaluate((k) => {
    const e = typeof window.veFeadEngineOf === 'function' ? window.veFeadEngineOf(k) : null;
    if (!e) throw new Error('motor kataloğu kaydı yok: ' + k);
    const tamamla = (sd) => {
      ['idleRpm', 'governedRpm', 'overspeedRpm'].forEach((a) => {
        if (!(Number(sd[a]) > 0) && e[a] != null) sd[a] = e[a];
      });
      if (!(Number(sd.cylinders) > 0)) sd.cylinders = e.cyl;
    };
    const paket = window.veFeadExampleNodes;
    if (typeof paket === 'function' && !paket._motorlu) {
      const s = function () {
        const p = paket.apply(this, arguments);
        ((p && p.nodes) || []).forEach((n) => {
          if (n && n.type === 'fead-solver') { n.data = n.data || {}; tamamla(n.data); }
        });
        return p;
      };
      s._motorlu = true;
      window.veFeadExampleNodes = s;
    }
    const tohum = window.veFeadWizSeed;
    if (typeof tohum === 'function' && !tohum._motorlu) {
      const s = function () {
        const r = tohum.apply(this, arguments);
        const st = typeof window.veFeadWizState === 'function' ? window.veFeadWizState() : null;
        if (st && st.solver) {
          tamamla(st.solver);
          if (typeof window.veFeadWizRender === 'function') window.veFeadWizRender();
        }
        return r;
      };
      s._motorlu = true;
      window.veFeadWizSeed = s;
    }
  }, key || MOTOR);
}

module.exports = { MOTOR, motorluOrnekler };
