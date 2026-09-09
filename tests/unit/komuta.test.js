/**
 * komuta.test.js — Komuta Penceresi (js/cp-komuta.js)
 *
 * Pencerenin işi iki cümlede: programın CANLI veri yapılarını ölçmek, ve
 * ölçümden Claude Code'a yapıştırılacak bir SİPARİŞ FİŞİ üretmek. Değer de
 * risk de fişte; bu dosya fişi bir SÖZLEŞME olarak tutuyor.
 *
 * DÖRT SESSİZ HATA SINIFI:
 *
 * 1) FİŞ AYRIŞTIRILAMAZ HALE GELİR. Üreteç ile okuyucu ayrı ayrı doğru olup
 *    birlikte yanlış olabilir (not alanına düşen bir satır sonu, hizalama
 *    boşluğunun değişmesi, alan adının Türkçeleşmesi). Kapı gidiş-dönüş:
 *    ayristir(uret(x)) === x. Tek tek assertion'lar bunu YAKALAMAZ.
 *
 * 2) TEZGÂHIN ADRES GÖSTERDİĞİ DOSYA KAYBOLUR. Fişin `dosya` satırı benim
 *    hangi dosyaya dokunacağımı söylüyor. `js/karsilama-gorseller.js` yeniden
 *    adlandırılırsa fiş olmayan bir dosyayı adres gösterir ve BU SESSİZDİR —
 *    pencere çalışmaya devam eder, fiş üretilir, yalnız yanlıştır.
 *
 * 3) KÜNYE SATIRI SESSİZCE BOŞALIR. Fişin tek güvenlik kemeri künye: fişi
 *    alan taraf onu origin/main ile karşılaştırıp "bu 3 commit eski bir
 *    kopyadan yazılmış" diyebiliyor. Künye okunamadığında satır BOŞ kalırsa
 *    o kemer sessizce çözülür — "künye yok" ile "künye güncel" ayırt edilemez.
 *
 * 4) PENCERE BEYAN ETMEYE BAŞLAR. Tezgâhlar elle yazılmış özet TUTMAZ, canlı
 *    yapıyı ölçer (CLAUDE.md: elle yazılan özet sessizce bayatlar; bu dosya
 *    bir kez 6.052 satıra çıktı). Kapı: kaynakta `olc` bir FONKSİYON, ve
 *    ölçüm gerçek listeyle birlikte değişiyor.
 */

const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '../..');
const KAYNAK = fs.readFileSync(path.join(KOK, 'js/cp-komuta.js'), 'utf8');

// window/DOM'suz saf çekirdek — modül module.exports guard'ı taşıyor.
const K = require(path.join(KOK, 'js/cp-komuta.js'));

describe('sipariş fişi — gidiş-dönüş sözleşmesi', () => {
  const ornek = {
    kunye: 'd7810f9 · PR #911 · 2026-09-09',
    tezgah: 'karsilama',
    dosya: 'js/karsilama-gorseller.js',
    kaldir: ['05', '13', '22'],
    ekle: [],
    not: '05 ile 08 aynı kare, 08 kalsın'
  };

  test('üretilen fiş geri okunduğunda AYNI siparişi verir', () => {
    expect(K.veKomutaFisAyristir(K.veKomutaFisUret(ornek))).toEqual(ornek);
  });

  test('boş sipariş de gidiş-dönüş yapar', () => {
    const bos = { kunye: 'x', tezgah: 't', dosya: 'd', kaldir: [], ekle: [], not: '' };
    expect(K.veKomutaFisAyristir(K.veKomutaFisUret(bos))).toEqual(bos);
  });

  test('nottaki satır sonu üretimde temizlenir — sonraki satır alan sanılmaz', () => {
    const fis = K.veKomutaFisUret({ kunye: 'x', tezgah: 't', dosya: 'd', not: 'ilk\nkaldir: 99' });
    // Satır sonu geçmiş olsaydı '99' bir KALDIRMA emrine dönüşürdü.
    expect(K.veKomutaFisAyristir(fis).kaldir).toEqual([]);
    expect(K.veKomutaFisAyristir(fis).not).toBe('ilk kaldir: 99');
  });

  test('başlığı tutmayan metin null döner — yanlış nesne DÖNMEZ', () => {
    expect(K.veKomutaFisAyristir('merhaba\nkaldir: 05')).toBeNull();
    expect(K.veKomutaFisAyristir('')).toBeNull();
    expect(K.veKomutaFisAyristir(null)).toBeNull();
  });

  test('baştaki boş satırlar ve satır içi boşluk affediliyor (elle yapıştırma)', () => {
    const fis = '\n\n' + K.veKomutaFisUret({ kunye: 'x', tezgah: 't', dosya: 'd', kaldir: ['05'] })
      .replace('kaldir', '  kaldir');
    expect(K.veKomutaFisAyristir(fis).kaldir).toEqual(['05']);
  });

  test('alan adları DİAKRİTİKSİZ — kopyala/yapıştırda kodlama kaçağı olmasın', () => {
    const fis = K.veKomutaFisUret({ tezgah: 't', dosya: 'd' });
    fis.split('\n').slice(1).forEach((satir) => {
      expect(satir.split(':')[0]).toMatch(/^[a-z ]+$/);
    });
  });

  test('değeri olmayan alan atlanmaz, "(yok)" yazar', () => {
    const fis = K.veKomutaFisUret({ tezgah: 't', dosya: 'd' });
    expect(fis).toContain('kaldir');
    expect(fis).toContain('(yok)');
    // "(yok)" geri okunurken boşa dönmeli, dizgeye değil.
    expect(K.veKomutaFisAyristir(fis).kaldir).toEqual([]);
    expect(K.veKomutaFisAyristir(fis).not).toBe('');
  });
});

describe('künye satırı — sapma kapısı', () => {
  test('gömülü künyeden sha + PR + tarih okunuyor', () => {
    const m = K.veKomutaKunyeMetni({ shortSha: 'd7810f9', prNumber: 911, date: '2026-09-09T12:00:00+03:00' });
    expect(m).toContain('d7810f9');
    expect(m).toContain('PR #911');
    expect(m).toContain('2026-09-09');
  });

  test('künye YOKSA satır boş kalmaz — doğrulanması gerektiğini söyler', () => {
    [null, undefined, {}, { sha: '' }].forEach((b) => {
      const m = K.veKomutaKunyeMetni(b === undefined ? null : b);
      expect(m.trim()).not.toBe('');
      expect(m).toMatch(/dogrulanmali/);
    });
  });

  test('fiş künyesiz üretilemez — her fişte kunye satırı var', () => {
    const fis = K.veKomutaFisUret({ tezgah: 't', dosya: 'd' });
    expect(fis.split('\n')[1]).toMatch(/^kunye\s*:\s*\S/);
  });
});

describe('tezgâhlar', () => {
  test('en az bir tezgâh var ve hepsinin id/ad/dosya alanı dolu', () => {
    expect(K.VE_KOMUTA_TEZGAHLAR.length).toBeGreaterThan(0);
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => {
      expect(String(t.id || '')).not.toBe('');
      expect(String(t.ad || '')).not.toBe('');
      expect(String(t.dosya || '')).not.toBe('');
    });
  });

  test('her tezgâhın adres gösterdiği dosya DİSKTE VAR', () => {
    const yok = K.VE_KOMUTA_TEZGAHLAR
      .filter((t) => !fs.existsSync(path.join(KOK, t.dosya)))
      .map((t) => t.id + ' → ' + t.dosya);
    expect(yok).toEqual([]);
  });

  test('tezgâh id\'leri tekil', () => {
    const idler = K.VE_KOMUTA_TEZGAHLAR.map((t) => t.id);
    expect(idler.length).toBe(new Set(idler).size);
  });

  test('ÖLÇER, BEYAN ETMEZ — her tezgâhın olc alanı fonksiyon', () => {
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => expect(typeof t.olc).toBe('function'));
  });
});

describe('karşılama tezgâhı canlı listeyi ölçüyor', () => {
  const tezgah = K.VE_KOMUTA_TEZGAHLAR.find((t) => t.id === 'karsilama');
  const { VE_KARSILAMA_GORSELLER } = require(path.join(KOK, 'js/karsilama-gorseller.js'));

  test('ölçüm programın gerçek kare listesiyle birebir', () => {
    global.VE_KARSILAMA_GORSELLER = VE_KARSILAMA_GORSELLER;
    const kayitlar = tezgah.olc();
    expect(kayitlar.length).toBe(VE_KARSILAMA_GORSELLER.length);
    expect(kayitlar.map((k) => k.etiket)).toEqual(VE_KARSILAMA_GORSELLER);
    delete global.VE_KARSILAMA_GORSELLER;
  });

  test('anahtar kare NUMARASI — fiş dosya adı değil numara taşır', () => {
    global.VE_KARSILAMA_GORSELLER = ['karsilama-05.webp', 'karsilama-31.webp'];
    expect(tezgah.olc().map((k) => k.anahtar)).toEqual(['05', '31']);
    delete global.VE_KARSILAMA_GORSELLER;
  });

  test('liste yoksa ölçüm patlamaz, boş döner', () => {
    expect(tezgah.olc()).toEqual([]);
  });

  test('künye başlıkları kare numarasıyla eşleşiyor (gömülü künye varsa)', () => {
    const kunye = JSON.parse(fs.readFileSync(path.join(KOK, 'tools/karsilama-kunye.json'), 'utf8'));
    // jsdom'da `window` zaten var; global.window'a ATAMA onu değiştirmez —
    // özellik mevcut window'un üstüne konur (ilk yazımda 28/29 buna düştü).
    window.__MFSIM_KARSILAMA_KUNYE = kunye;
    global.VE_KARSILAMA_GORSELLER = VE_KARSILAMA_GORSELLER;
    const bossuz = tezgah.olc().filter((k) => !k.baslik);
    delete window.__MFSIM_KARSILAMA_KUNYE;
    delete global.VE_KARSILAMA_GORSELLER;
    expect(bossuz).toEqual([]);
  });
});

describe('kaynak kapıları', () => {
  test('şifre hash\'i 64 haneli sha256', () => {
    const m = /VE_KOMUTA_HASH\s*=\s*'([0-9a-f]+)'/.exec(KAYNAK);
    expect(m).not.toBeNull();
    expect(m[1]).toHaveLength(64);
  });

  test('jeton sessionStorage\'da — kalıcı jeton tutulmuyor', () => {
    expect(KAYNAK).toContain('sessionStorage.getItem(VE_KOMUTA_KEY)');
    expect(KAYNAK).not.toMatch(/localStorage\.setItem\(VE_KOMUTA_KEY/);
  });

  test('pencere yalnız OKUR — kaydetme/mutasyon çağrısı yok', () => {
    // Komuta penceresinin sözü: programı değiştirmez. saveState/render gibi
    // mutasyon yüzeylerine dokunması bu sözü sessizce bozardı.
    expect(KAYNAK).not.toMatch(/\bsaveState\s*\(/);
    expect(KAYNAK).not.toMatch(/VE_KARSILAMA_GORSELLER\s*(\.push|\.splice|=[^=])/);
  });

  test('görünüm CSS\'te — kaynak satır içi renk/çerçeve yazmıyor', () => {
    // Kayış Tablosu'nda ölçülen tuzak: satır içi stil :hover/:focus/seçili
    // durumlarını ifade edemez, yüzey donuk görünür (CLAUDE.md).
    expect(KAYNAK).not.toMatch(/style="[^"]*(?:color|background|border)\s*:/);
  });

  test('CSS karşılıkları styles.css\'te var (durum kuralları dahil)', () => {
    const css = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8');
    ['.ve-komuta-kart', '.ve-komuta-izgara', '.ve-komuta-fis', '.ve-komuta-kunye']
      .forEach((s) => expect(css).toContain(s));
    expect(css).toMatch(/\.ve-komuta-kart:hover/);
    expect(css).toMatch(/\.ve-komuta-kart:focus-visible/);
    expect(css).toMatch(/\.ve-komuta-kart\.secili/);
  });

  test('seçim değişince aria-pressed sınıfla BİRLİKTE yazılıyor', () => {
    // E2E'de ölçüldü: yalnız sınıf çevrilince kart gözle seçili görünüyor ama
    // erişilebilirlik durumu 'false' kalıyordu. İkisi tek yerde eşitleniyor.
    const govde = /function veKomutaSecimDegistir\([\s\S]*?\n}/.exec(KAYNAK)[0];
    expect(govde).toContain("classList.toggle('secili'");
    expect(govde).toContain("setAttribute('aria-pressed'");
  });

  test('kullanıcı metni kaçışlanıyor', () => {
    expect(KAYNAK).toMatch(/function _vkKacir\(/);
    expect(KAYNAK).toContain('_vkKacir(k.baslik');
  });
});

describe('index.html + ribbon + build bağları', () => {
  const INDEX = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  const RIBBON = fs.readFileSync(path.join(KOK, 'js/ribbon.js'), 'utf8');
  const BUILD = fs.readFileSync(path.join(KOK, 'build.js'), 'utf8');

  test('script etiketi ve modal kabuğu index.html\'de', () => {
    expect(INDEX).toContain('src="js/cp-komuta.js"');
    expect(INDEX).toContain('id="ve-komuta-overlay"');
    expect(INDEX).toContain('id="ve-komuta-content"');
  });

  test('şeritte bir giriş var ve çağırdığı fonksiyon kaynakta tanımlı', () => {
    expect(RIBBON).toContain("run:'veKomutaAc'");
    expect(KAYNAK).toMatch(/function veKomutaAc\(/);
  });

  test('boş tuvalde de erişilebilir (VE_RIBBON_ALWAYS_ON)', () => {
    const liste = /VE_RIBBON_ALWAYS_ON\s*=\s*\[([\s\S]*?)\]/.exec(RIBBON)[1];
    expect(liste).toContain("'veKomutaAc'");
  });

  test('şeritteki ikon css/icons.css\'te tanımlı', () => {
    const icons = fs.readFileSync(path.join(KOK, 'css/icons.css'), 'utf8');
    const ad = /run:'veKomutaAc'[\s\S]{0,200}?icon:'([a-z-]+)'|icon:'([a-z-]+)',\s*label:'Komuta/.exec(RIBBON);
    const ikon = (/\{\s*size:'lg',\s*icon:'([a-z-]+)',\s*label:'Komuta/.exec(RIBBON) || [])[1];
    expect(ikon).toBeTruthy();
    expect(icons).toContain('mf-ico-' + ikon);
    expect(ad).toBeTruthy();
  });

  test('build.js künyeyi gömüyor ve modül aynı global adı okuyor', () => {
    expect(BUILD).toContain('window.__MFSIM_KARSILAMA_KUNYE');
    expect(KAYNAK).toContain('window.__MFSIM_KARSILAMA_KUNYE');
  });
});
