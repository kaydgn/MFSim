/**
 * modul-komutlari.test.js — MODÜL TEST KOMUTU MODÜLÜN KENDİ DOSYALARINI KAPSAR
 * ───────────────────────────────────────────────────────────────────────────
 * Döngüde modül testi, commit'ten önce tam test koşulur (CLAUDE.md → "Çalışma
 * Akışı"). `npm run test:takoz` yalnız "unit/mount-" desenini taşıyordu:
 * Takoz pencerelerinin testleri (cp-mount 107, rapor 52, PTO 18, görüntüleyici
 * 15), kılavuz (22) ve örnek ortalama (7) — 7 dosya, 221 test — döngüde hiç
 * koşmuyordu; kırılmaları ancak tam testte görünüyordu. FEAD'in komutu kendi
 * pencere ve kılavuz testlerini kapsıyor.
 *
 * Kural: modülün kaynak öneklerini taşıyan her test dosyası (Takoz: mount- ·
 * cp-mount · guide-mount; FEAD: fead- · cp-fead · guide-fead) modül komutunun
 * deseniyle eşleşir. Jest deseni dosyanın tam yoluna uygular.
 */
const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');

const DOSYALAR = fs.readdirSync(__dirname).filter((f) => /\.test\.js$/.test(f));
const MODUL = {
  'test:takoz': /^(mount-|cp-mount|guide-mount)/,
  'test:fead': /^(fead-|cp-fead|guide-fead)/,
};
function desen(komut) {
  const m = String(pkg.scripts[komut] || '').match(/"([^"]+)"/);
  return m ? new RegExp(m[1].replace(/\\"/g, '"')) : null;
}

test('tarama gerçekten tarıyor: iki modülün de onlarca test dosyası var', () => {
  expect(DOSYALAR.filter((f) => MODUL['test:takoz'].test(f)).length).toBeGreaterThan(30);
  expect(DOSYALAR.filter((f) => MODUL['test:fead'].test(f)).length).toBeGreaterThan(30);
});

test.each(Object.keys(MODUL))('%s modülün kendi öneklerini taşıyan her dosyayı koşturur', (komut) => {
  const re = desen(komut);
  expect(re).not.toBeNull();
  const disarida = DOSYALAR.filter((f) => MODUL[komut].test(f))
    .filter((f) => !re.test(path.join(__dirname, f).split(path.sep).join('/')));
  expect(disarida).toEqual([]);
});
