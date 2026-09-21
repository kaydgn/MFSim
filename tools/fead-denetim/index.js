#!/usr/bin/env node
/* FEAD BAĞIMSIZ DENETİM — Gates verisine HİÇ bakmadan koşar.
 * Ölçüt ya kapalı biçimli bir analitik sonuç ya da bir değişmezliktir.
 * Kullanım:  node tools/fead-denetim            (hepsi)
 *            node tools/fead-denetim analitik   (tek takım)
 *            FEAD_DENETIM_N=5000 node tools/fead-denetim degismezlik */
const takimlar = {
  analitik: 'A — kapalı biçimli sınamalar (çokgen, teğet, halka özdeğerleri)',
  degismezlik: 'B — dönme/ötelenme/ölçek/etiketleme değişmezlikleri, N sistem',
  hedefli: 'C — hedefli incelemeler (tahrik oranı, çevrim kapanışı, kök sayısı…)',
  supurme: 'D — değişken süpürmeleri (yay, kaburga, duty, frekans, makullük)',
  katalog: 'E — profil×marka çap katmanı + kayma emniyeti ayrımı',
  cirpinma: 'E2b — çırpınma bayrağının sebebi (gevşek ↔ merkezkaç ihmali)',
};
const istenen = process.argv.slice(2).filter(a => !a.startsWith('-'));
const kos = istenen.length ? istenen : Object.keys(takimlar);
for (const t of kos) {
  if (!takimlar[t]) { console.error(`bilinmeyen takım: ${t}\n` +
    Object.entries(takimlar).map(([k, v]) => `  ${k.padEnd(13)} ${v}`).join('\n')); process.exit(2); }
  console.log('\n' + '═'.repeat(78) + `\n${takimlar[t]}\n` + '═'.repeat(78));
  require('./' + t + '.js');
}
