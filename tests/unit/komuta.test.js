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
    olcum: '28 kayit \u00b7 9cc1a3',
    istek: 'kaldir',
    kayit: ['05', '13', '22'],
    not: '05 ile 08 aynı kare, 08 kalsın'
  };

  test('üretilen fiş geri okunduğunda AYNI siparişi verir', () => {
    expect(K.veKomutaFisAyristir(K.veKomutaFisUret(ornek))).toEqual(ornek);
  });

  test('boş sipariş de gidiş-dönüş yapar', () => {
    const bos = { kunye: 'x', tezgah: 't', dosya: 'd', olcum: '', istek: 'kaldir', kayit: [], not: '' };
    expect(K.veKomutaFisAyristir(K.veKomutaFisUret(bos))).toEqual(bos);
  });

  test('nottaki satır sonu üretimde temizlenir — sonraki satır alan sanılmaz', () => {
    const fis = K.veKomutaFisUret({ kunye: 'x', tezgah: 't', dosya: 'd', not: 'ilk\nkayit: 99' });
    // Satır sonu geçmiş olsaydı '99' bir KALDIRMA emrine dönüşürdü.
    expect(K.veKomutaFisAyristir(fis).kayit).toEqual([]);
    expect(K.veKomutaFisAyristir(fis).not).toBe('ilk kayit: 99');
  });

  test('başlığı tutmayan metin null döner — yanlış nesne DÖNMEZ', () => {
    expect(K.veKomutaFisAyristir('merhaba\nkayit: 05')).toBeNull();
    expect(K.veKomutaFisAyristir('')).toBeNull();
    expect(K.veKomutaFisAyristir(null)).toBeNull();
  });

  test('baştaki boş satırlar ve satır içi boşluk affediliyor (elle yapıştırma)', () => {
    const fis = '\n\n' + K.veKomutaFisUret({ kunye: 'x', tezgah: 't', dosya: 'd', kayit: ['05'] })
      .replace('kayit', '  kayit');
    expect(K.veKomutaFisAyristir(fis).kayit).toEqual(['05']);
  });

  test('alan adları DİAKRİTİKSİZ — kopyala/yapıştırda kodlama kaçağı olmasın', () => {
    const fis = K.veKomutaFisUret({ tezgah: 't', dosya: 'd' });
    fis.split('\n').slice(1).forEach((satir) => {
      expect(satir.split(':')[0]).toMatch(/^[a-z ]+$/);
    });
  });

  test('değeri olmayan alan atlanmaz, "(yok)" yazar', () => {
    const fis = K.veKomutaFisUret({ tezgah: 't', dosya: 'd' });
    expect(fis).toContain('kayit');
    expect(fis).toContain('(yok)');
    // "(yok)" geri okunurken boşa dönmeli, dizgeye değil.
    expect(K.veKomutaFisAyristir(fis).kayit).toEqual([]);
    expect(K.veKomutaFisAyristir(fis).not).toBe('');
  });
});

describe('fiil sözlüğü — fiş v2', () => {
  test('fiiller tekil, adı ve işaret metni dolu', () => {
    const idler = K.VE_KOMUTA_FIILLER.map((f) => f.id);
    expect(idler.length).toBe(new Set(idler).size);
    K.VE_KOMUTA_FIILLER.forEach((f) => {
      expect(String(f.ad || '')).not.toBe('');
      expect(String(f.isaret || '')).not.toBe('');
      expect(String(f.aciklama || '')).not.toBe('');
      expect(f.id).toMatch(/^[a-z]+$/);      // fişe diakritiksiz yazılıyor
    });
  });

  test('istek alanı boş bırakılmıyor — varsayılan fiil yazılıyor', () => {
    const fis = K.veKomutaFisUret({ tezgah: 't', dosya: 'd' });
    expect(K.veKomutaFisAyristir(fis).istek).toBe(K.VE_KOMUTA_FIILLER[0].id);
  });

  test('her fiil gidiş-dönüşte korunuyor', () => {
    K.VE_KOMUTA_FIILLER.forEach((f) => {
      const fis = K.veKomutaFisUret({ tezgah: 't', dosya: 'd', istek: f.id, kayit: ['a'] });
      expect(K.veKomutaFisAyristir(fis).istek).toBe(f.id);
    });
  });

  test('geçerlilik denetimi tanımlı fiillerden türüyor', () => {
    K.VE_KOMUTA_FIILLER.forEach((f) => expect(K.veKomutaFiilGecerli(f.id)).toBe(true));
    ['', 'sil', 'KALDIR', null].forEach((x) => expect(K.veKomutaFiilGecerli(x)).toBe(false));
  });

  test('v1 FİŞİ HÂLÂ OKUNUYOR — `kaldir:` satırı `istek`+`kayit`a çevriliyor', () => {
    // Kullanıcının elinde duran eski bir fişi reddetmek onu yeniden üretmeye
    // zorlardı; oysa anlamı belirsiz değil.
    const v1 = ['MFSIM-SIPARIS v1', 'kunye : abc', 'tezgah: karsilama',
                'dosya : js/karsilama-gorseller.js', 'kaldir: 06, 14', 'ekle  : (yok)'].join('\n');
    const o = K.veKomutaFisAyristir(v1);
    expect(o.istek).toBe('kaldir');
    expect(o.kayit).toEqual(['06', '14']);
    expect(o.tezgah).toBe('karsilama');
    expect(o.ekle).toBeUndefined();          // ölü alan taşınmıyor
  });

  test('bilinmeyen başlık hâlâ null', () => {
    expect(K.veKomutaFisAyristir('MFSIM-SIPARIS v9\nkayit: 05')).toBeNull();
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

describe('ölçüm özeti — fişin ikinci kapısı', () => {
  const kayit = (a) => ({ anahtar: a });

  test('aynı liste aynı özeti verir (belirlenimci)', () => {
    const a = [kayit('05'), kayit('13')];
    expect(K.veKomutaOlcumOzeti(a)).toBe(K.veKomutaOlcumOzeti([kayit('05'), kayit('13')]));
  });

  test('SIRA değişimi özeti DEĞİŞTİRMEZ — `kaldir` küme anlamlı', () => {
    // Dosyadaki sıranın değişmesi "06"nın hangi kare olduğunu değiştirmez;
    // sıralamayı sapma saymak her yeniden düzenlemede yanlış alarm verirdi.
    expect(K.veKomutaOlcumOzeti([kayit('13'), kayit('05')]))
      .toBe(K.veKomutaOlcumOzeti([kayit('05'), kayit('13')]));
  });

  test('tek bir kayıt değişince özet DEĞİŞİR', () => {
    const taban = K.veKomutaOlcumOzeti([kayit('05'), kayit('13')]);
    expect(K.veKomutaOlcumOzeti([kayit('05'), kayit('14')])).not.toBe(taban);
    expect(K.veKomutaOlcumOzeti([kayit('05')])).not.toBe(taban);
    expect(K.veKomutaOlcumOzeti([kayit('05'), kayit('13'), kayit('22')])).not.toBe(taban);
  });

  test('özet kayıt sayısını okunur biçimde taşıyor', () => {
    expect(K.veKomutaOlcumOzeti([kayit('05'), kayit('13')])).toMatch(/^2 kayit /);
    expect(K.veKomutaOlcumOzeti([])).toMatch(/^0 kayit /);
  });

  test('birleştirme kaçağı yok — ["ab","c"] ile ["a","bc"] ayrışıyor', () => {
    // Ayırıcısız birleştirilseydi ikisi de "abc" olurdu ve iki farklı liste
    // aynı özeti verirdi (sessiz "değişmemiş" hükmü).
    expect(K.veKomutaOlcumOzeti([kayit('ab'), kayit('c')]))
      .not.toBe(K.veKomutaOlcumOzeti([kayit('a'), kayit('bc')]));
  });

  test('fiş ölçüm satırını taşıyor ve gidiş-dönüşte korunuyor', () => {
    const fis = K.veKomutaFisUret({ tezgah: 't', dosya: 'd', olcum: '28 kayit \u00b7 9cc1a3' });
    expect(fis).toContain('olcum : 28 kayit');
    expect(K.veKomutaFisAyristir(fis).olcum).toBe('28 kayit \u00b7 9cc1a3');
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

  test('her tezgâh ölçtüğü kaynağı BEYAN ediyor ve o kaynak gerçekten dışa aktarılıyor', () => {
    // Doğrulayıcı bu beyandan çalışıyor; yoksa fişin geçerliliği Node'da
    // ölçülemez ve kapı sessizce "gözle bak"a düşer.
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => {
      expect(String(t.disaAktarim || '')).not.toBe('');
      const mod = require(path.join(KOK, t.dosya));
      expect(mod[t.disaAktarim]).toBeDefined();
    });
  });

  test('tezgâh id\'leri tekil', () => {
    const idler = K.VE_KOMUTA_TEZGAHLAR.map((t) => t.id);
    expect(idler.length).toBe(new Set(idler).size);
  });

  test('ÖLÇER, BEYAN ETMEZ — her tezgâhın olc alanı fonksiyon', () => {
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => expect(typeof t.olc).toBe('function'));
  });
});

describe('tezgâhlar canlı kaynaklarını ölçüyor', () => {
  // `olc(veri)` SAF: veriyi argümandan alıyor. Buradaki her ölçüm, tezgâhın
  // KENDİ beyanından (dosya + disaAktarim) gelen gerçek veriyle koşuyor —
  // testin elle kurduğu bir kurgu ile değil.
  const veriyle = (t) => t.olc(require(path.join(KOK, t.dosya))[t.disaAktarim]);

  test('her tezgâh boş olmayan bir kayıt listesi veriyor', () => {
    const bos = K.VE_KOMUTA_TEZGAHLAR.filter((t) => veriyle(t).length === 0).map((t) => t.id);
    expect(bos).toEqual([]);
  });

  test('her kaydın anahtarı ve gösterilecek bir adı var', () => {
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => {
      veriyle(t).forEach((k) => {
        expect(String(k.anahtar || '')).not.toBe('');
        expect(String(k.baslik || k.etiket || '')).not.toBe('');
      });
    });
  });

  test('ANAHTARLAR TEKİL — yoksa `kaldir` hangi kaydı gösterdiği belirsiz olurdu', () => {
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => {
      const a = veriyle(t).map((k) => String(k.anahtar));
      const tekrar = a.filter((x, i) => a.indexOf(x) !== i);
      expect({ tezgah: t.id, tekrar }).toEqual({ tezgah: t.id, tekrar: [] });
    });
  });

  test('`olc` SAF — global okumuyor, veri argümandan geliyor', () => {
    // Global'ler kurulu DEĞİLKEN de ölçüm çalışmalı. İlk sözleşmede olc()
    // üst-seviye bir addan okuyordu; ikinci tezgâh o adı js/ genelinde bir
    // çakışmaya zorladı (source-hygiene kapısı yasaklıyor).
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => {
      expect(typeof t.kaynak).toBe('function');
      expect(veriyle(t).length).toBeGreaterThan(0);
    });
  });

  test('veri yoksa ölçüm patlamıyor, boş dönüyor', () => {
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => {
      expect(t.olc(null)).toEqual([]);
      expect(t.olc([])).toEqual([]);
    });
  });

  test('düzen bilinen bir değer', () => {
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => {
      expect(['izgara', 'liste']).toContain(t.duzen);
    });
  });

  test('karşılama: anahtar kare NUMARASI — fiş dosya adı değil numara taşır', () => {
    const t = K.VE_KOMUTA_TEZGAHLAR.find((x) => x.id === 'karsilama');
    expect(t.olc(['karsilama-05.webp', 'karsilama-31.webp']).map((k) => k.anahtar))
      .toEqual(['05', '31']);
  });

  test('karşılama: künye başlıkları kare numarasıyla eşleşiyor', () => {
    const t = K.VE_KOMUTA_TEZGAHLAR.find((x) => x.id === 'karsilama');
    const kunye = JSON.parse(fs.readFileSync(path.join(KOK, 'tools/karsilama-kunye.json'), 'utf8'));
    // jsdom'da `window` zaten var; global.window'a ATAMA onu değiştirmez.
    window.__MFSIM_KARSILAMA_KUNYE = kunye;
    const bossuz = veriyle(t).filter((k) => !k.baslik);
    delete window.__MFSIM_KARSILAMA_KUNYE;
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

  test('liste düzeninin CSS karşılığı var', () => {
    const css = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8');
    expect(css).toContain('.ve-komuta-liste');
    expect(css).toMatch(/\.ve-komuta-kart\.satir/);
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
