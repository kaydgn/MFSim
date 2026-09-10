/**
 * komuta-dogrula.test.js — sipariş fişi DOĞRULAYICISI (tools/komuta-dogrula.js)
 *
 * Doğrulayıcı, fişin uygulanmadan önce geçtiği tek kapı. Bu yüzden burada
 * ölçülen şey metin değil DAVRANIŞ: script gerçekten çalıştırılıyor ve ÇIKIŞ
 * KODUNA bakılıyor. "Uyarıyı yazdırıp 0 dönmek" en kötü hâl olurdu — kapı
 * yazılı görünür, hiçbir şeyi durdurmaz.
 *
 * ÜÇ SESSİZ HATA SINIFI:
 *
 * 1) BAYAT FİŞ SESSİZCE UYGULANIR. Fiş kullanıcının elindeki kopyadan yazılıyor;
 *    o kopya bayatsa numaralar başka kayıtları gösterir. Kapı `olcum` özeti.
 *
 * 2) YANLIŞ ALARM KAPIYI ÖLDÜRÜR. Sha karşılaştırması tek başına yetmiyor:
 *    ölçüldü, bir turda main altı PR ilerledi ve karşılama listesi HİÇ
 *    değişmedi. Özet tutuyorsa künye farkı sapma SAYILMAMALI — yoksa kapı her
 *    seferinde bağırır ve ciddiye alınmaz olur.
 *
 * 3) OLMAYAN KAYDI SİLMEK. Özet tutsa bile fiş var olmayan bir anahtarı
 *    hedefleyebilir (elle yazım, kopyalama hatası). Ayrı kapı.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const KOK = path.join(__dirname, '../..');
const BETIK = path.join(KOK, 'tools/komuta-dogrula.js');
const K = require(path.join(KOK, 'js/cp-komuta.js'));
const { VE_KARSILAMA_GORSELLER } = require(path.join(KOK, 'js/karsilama-gorseller.js'));

// Tezgâhın Node'daki ölçümü — doğrulayıcının içeride yaptığının aynısı.
function guncelOzet(id) {
  const t = K.VE_KOMUTA_TEZGAHLAR.find((x) => x.id === id);
  return K.veKomutaOlcumOzeti(t.olc(require(path.join(KOK, t.dosya))[t.disaAktarim]));
}

// Betiği GERÇEKTEN çalıştırır; çıkış kodu ile çıktıyı birlikte döner.
function calistir(fisMetni) {
  const yol = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'komuta-')), 'fis.txt');
  fs.writeFileSync(yol, fisMetni, 'utf8');
  try {
    const cikti = execFileSync(process.execPath, [BETIK, yol], { encoding: 'utf8' });
    return { kod: 0, cikti };
  } catch (e) {
    return { kod: e.status, cikti: (e.stdout || '') + (e.stderr || '') };
  } finally {
    fs.rmSync(path.dirname(yol), { recursive: true, force: true });
  }
}

function fis(ek) {
  return K.veKomutaFisUret(Object.assign({
    kunye: '1dbcd0a · PR #914',
    tezgah: 'karsilama',
    dosya: 'js/karsilama-gorseller.js',
    olcum: guncelOzet('karsilama')
  }, ek || {}));
}

describe('güncel fiş geçer', () => {
  test('özet tutuyorsa çıkış kodu 0 ve "FİŞ GÜNCEL" diyor', () => {
    const r = calistir(fis({ kaldir: [] }));
    expect(r.kod).toBe(0);
    expect(r.cikti).toContain('FİŞ GÜNCEL');
  });

  test('KÜNYE ESKİ ama özet tutuyorsa yine geçer — yanlış alarm YOK', () => {
    // Kapının ciddiye alınmasının koşulu bu: araya giren PR'lar bu tezgâha
    // dokunmadıysa fiş geçerlidir. Ölçülen olay: main altı PR ilerledi,
    // karşılama listesi hiç değişmedi.
    const r = calistir(fis({ kunye: '0000000 · PR #1', kaldir: [] }));
    expect(r.kod).toBe(0);
    expect(r.cikti).toContain('FİŞ GÜNCEL');
  });

  test('var olan hedefler için kalan kayıt sayısını yazıyor', () => {
    const hedef = VE_KARSILAMA_GORSELLER.slice(0, 2).map((f) => /(\d+)/.exec(f)[1]);
    const r = calistir(fis({ kaldir: hedef }));
    expect(r.kod).toBe(0);
    expect(r.cikti).toContain(String(VE_KARSILAMA_GORSELLER.length - 2) + ' kayıt kalır');
  });
});

describe('kapı gerçekten ısırıyor — hepsi çıkış kodu 1', () => {
  test('BAYAT FİŞ: özet tutmuyor', () => {
    const r = calistir(fis({ olcum: '31 kayit · aabbcc', kaldir: [] }));
    expect(r.kod).toBe(1);
    expect(r.cikti).toContain('SAPMA');
    expect(r.cikti).toContain('31');   // sayı değişimi adıyla yazılıyor
  });

  test('HEDEF YOK: özet tutsa bile olmayan anahtar durduruyor', () => {
    const r = calistir(fis({ kaldir: ['9999'] }));
    expect(r.kod).toBe(1);
    expect(r.cikti).toContain('ARTIK YOK');
    expect(r.cikti).toContain('9999');
  });

  test('ÖLÇÜMSÜZ FİŞ: sessizce geçmiyor, gözle doğrulama istiyor', () => {
    const r = calistir(fis({ olcum: '', kaldir: [] }));
    expect(r.kod).toBe(1);
    expect(r.cikti).toMatch(/ölçüm özeti taşımıyor/);
  });

  test('FİŞ DEĞİL: başlığı tutmayan metin', () => {
    const r = calistir('merhaba, 05 numaralı kareyi kaldır');
    expect(r.kod).toBe(1);
    expect(r.cikti).toContain('sipariş fişi değil');
  });

  test('BİLİNMEYEN TEZGÂH', () => {
    const r = calistir(fis({ tezgah: 'olmayan', kaldir: [] }));
    expect(r.kod).toBe(1);
    expect(r.cikti).toContain('Bilinmeyen tezgâh');
  });

  test('DOSYA UYUŞMUYOR: fiş başka bir dosyayı adres gösteriyor', () => {
    const r = calistir(fis({ dosya: 'js/baska-dosya.js', kaldir: [] }));
    expect(r.kod).toBe(1);
    expect(r.cikti).toContain('tezgâhın dosyası değil');
  });
});

describe('kaynak kapıları', () => {
  test('betik ikinci bir kaynak listesi TUTMUYOR — tezgâhın beyanından okuyor', () => {
    const src = fs.readFileSync(BETIK, 'utf8');
    expect(src).toContain('t.disaAktarim');
    expect(src).toContain('require(path.join(KOK, t.dosya))');
    // Tezgâh adı ya da ölçtüğü global betiğe elle yazılmış olmamalı.
    expect(src).not.toContain('VE_KARSILAMA_GORSELLER');
    expect(src).not.toContain("'karsilama'");
  });

  test('npm betiği kayıtlı', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(KOK, 'package.json'), 'utf8'));
    expect(pkg.scripts['komuta:dogrula']).toContain('tools/komuta-dogrula.js');
  });
});
