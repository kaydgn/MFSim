#!/usr/bin/env node
/**
 * komuta-dogrula.js — bir SİPARİŞ FİŞİNİN hâlâ geçerli olup olmadığını ÖLÇER
 *
 *   npm run komuta:dogrula -- <fis-dosyasi>
 *   pbpaste | npm run komuta:dogrula -- -          (stdin)
 *
 * NİYE VAR: fiş, kullanıcının ELİNDEKİ kopyadan yazılıyor; o kopya bayatsa
 * fişteki numaralar başka kayıtları gösteriyor olabilir ve hata SESSİZDİR —
 * uygulanır, makul görünür, yanlıştır.
 *
 * NİYE SHA YETMİYOR: ölçüldü — bir turda `main` altı PR ilerledi ve karşılama
 * listesi HİÇ DEĞİŞMEDİ. Sha karşılaştırması orada "fiş altı PR eski" der.
 * Yanlış alarm, ve birkaç kez tekrarlanınca kapı ciddiye alınmaz olur. Bu
 * yüzden ölçülen şey sürüm değil, TEZGÂHIN KENDİ İÇERİĞİ: fişteki `olcum`
 * özeti çalışma ağacından yeniden hesaplanıp karşılaştırılıyor.
 *
 * ÇIKIŞ KODU: 0 = uygulanabilir, 1 = sapma/hata var (uygulamadan önce oku).
 *
 * Tezgâhın ölçtüğü kaynağı BU DOSYA BİLMEZ: tezgâh kendi `dosya` +
 * `disaAktarim` alanlarında beyan ediyor, buradaki iş onu require edip aynı
 * `olc()`u koşturmak. İkinci bir kaynak listesi tutulmuyor.
 */

const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const K = require(path.join(KOK, 'js/cp-komuta.js'));

function oku(arg) {
  if (arg === '-') return fs.readFileSync(0, 'utf8');
  if (!arg) throw new Error('kullanım: komuta-dogrula.js <fis-dosyasi> | -');
  if (!fs.existsSync(arg)) throw new Error('dosya yok: ' + arg);
  return fs.readFileSync(arg, 'utf8');
}

// Tezgâh ölçtüğü kaynağı `dosya` + `disaAktarim` ile beyan ediyor; `olc(veri)`
// saf olduğu için burada global'e HİÇBİR ŞEY yazılmıyor. (İlk yazımda yazılıyordu
// ve ikinci tezgâhta çöktü: arşivin verisi `programlar` adıyla duruyor, onu
// global'e koymak js/ genelinde bir ad çakışması demekti.)
function tezgahiOlc(t) {
  if (!t.disaAktarim) throw new Error('tezgâh "' + t.id + '" disaAktarim beyan etmiyor');
  const mod = require(path.join(KOK, t.dosya));
  const veri = mod[t.disaAktarim];
  if (veri === undefined) {
    throw new Error(t.dosya + ' içinde ' + t.disaAktarim + ' dışa aktarılmıyor');
  }
  return t.olc(veri) || [];
}


function main() {
  const fis = K.veKomutaFisAyristir(oku(process.argv[2]));
  if (!fis) {
    console.error('✗ Bu metin bir sipariş fişi değil (başlık "' +
                  K.VE_KOMUTA_FIS_BASLIK + '" olmalı).');
    process.exit(1);
  }

  const t = K.VE_KOMUTA_TEZGAHLAR.find((x) => x.id === fis.tezgah);
  if (!t) {
    console.error('✗ Bilinmeyen tezgâh: "' + fis.tezgah + '"');
    console.error('  Tanımlı olanlar: ' + K.VE_KOMUTA_TEZGAHLAR.map((x) => x.id).join(', '));
    process.exit(1);
  }
  if (fis.dosya && fis.dosya !== t.dosya) {
    console.error('✗ Fişteki dosya tezgâhın dosyası değil:');
    console.error('    fiş     : ' + fis.dosya);
    console.error('    tezgâh  : ' + t.dosya);
    process.exit(1);
  }

  const simdi = tezgahiOlc(t);
  const simdikiOzet = K.veKomutaOlcumOzeti(simdi);
  const anahtarlar = simdi.map((k) => String(k.anahtar));

  console.log('tezgâh : ' + t.id + '  (' + t.dosya + ')');
  console.log('istek  : ' + (fis.istek || '(yok)'));
  console.log('fişteki: ' + (fis.olcum || '(yok)'));
  console.log('şimdi  : ' + simdikiOzet);
  console.log('künye  : ' + (fis.kunye || '(yok)'));

  let hata = false;

  if (!fis.olcum) {
    // Eski fiş (olcum alanı yokken üretilmiş) ya da elle yazılmış.
    console.log('\n⚠ Fiş ölçüm özeti taşımıyor — liste değişmiş olabilir, gözle doğrula.');
    hata = true;
  } else if (fis.olcum === simdikiOzet) {
    console.log('\n✓ FİŞ GÜNCEL — tezgâhın içeriği fiş yazıldığından beri değişmedi.');
    console.log('  (Künye farklı olabilir: araya giren PR\'lar bu listeye dokunmamış.)');
  } else {
    hata = true;
    const eskiSayi = parseInt(String(fis.olcum), 10);
    console.log('\n✗ SAPMA — tezgâhın içeriği fiş yazıldığından beri DEĞİŞTİ.');
    if (Number.isFinite(eskiSayi) && eskiSayi !== simdi.length) {
      console.log('  Kayıt sayısı: ' + eskiSayi + ' → ' + simdi.length);
    } else {
      console.log('  Kayıt sayısı aynı (' + simdi.length + ') ama kayıtlar farklı.');
    }
    console.log('  Fişin hangi kayda ait olduğu belirsiz; kullanıcıya sor.');
  }

  // ASIL SORU: fişin hedefleri hâlâ duruyor mu? Özet tutsa bile buna bakılır —
  // olmayan bir kaydı silmek (ya da olmayan bir kaydı incelemeye kalkmak)
  // sessiz bir yanlış uygulamadır.
  const hedefler = fis.kayit || [];
  const kayip = hedefler.filter((a) => anahtarlar.indexOf(a) < 0);
  if (kayip.length) {
    hata = true;
    console.log('\n✗ DUR: fişin hedeflediği kayıt(lar) ARTIK YOK: ' + kayip.join(', '));
    console.log('  Uygulama, hedeflenmeyen bir kaydı etkileyebilir. Uygulamadan önce sor.');
  } else if (hedefler.length) {
    console.log('\n  Hedefler yerinde: ' + hedefler.join(', '));
    if (fis.istek === 'kaldir') {
      console.log('  Kaldırma sonrası ' + (simdi.length - hedefler.length) + ' kayıt kalır.');
    }
  } else if (fis.istek !== 'incele') {
    // Hedefsiz bir kaldır/düzelt fişi bir iş TARİF ETMİYOR; sessizce "geçti"
    // demek, kullanıcının işaretlemeyi unuttuğunu gizlerdi.
    hata = true;
    console.log('\n⚠ Fiş hiçbir kayıt seçmemiş — "' + fis.istek + '" neye uygulanacak?');
  }

  process.exit(hata ? 1 : 0);
}

try { main(); } catch (e) {
  console.error('✗ ' + e.message);
  process.exit(1);
}
