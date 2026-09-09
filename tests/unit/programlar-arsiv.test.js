/**
 * Program Arşivi — js/cp-programlar.js + programlar/kayit.json + build.js
 * ──────────────────────────────────────────────────────────────────────
 * Arşiv penceresi bildirimsel bir kayıttan (programlar/kayit.json) çiziliyor.
 * Bu kapının tuttuğu hata sınıfı SESSİZ: pencere yine açılır, liste yine
 * çizilir, yalnız bir satır çalışmaz ya da hiç görünmez.
 *
 *   • Kayıttaki `dosya` diskte yoksa → satır çizilir, tıklayınca tarayıcının
 *     "dosya bulunamadı" sayfası gelir.
 *   • Kayıttaki `kume` pencerenin küme tablosunda yoksa → o satır HİÇ
 *     çizilmez; sayaç 51 der, listede 50 satır olur.
 *   • Yoklama hedefi (programlar/arsiv-var.js) silinirse → arşiv YANINDAYKEN
 *     bile "arşiv yanınızda değil" yazılır ve bütün satırlar pasif çizilir.
 *   • build.js'in gömdüğü global adı cp-programlar.js'in okuduğundan ayrışırsa
 *     → indirilen tek dosyada liste BOŞ çıkar (geliştirmede fetch'e düştüğü
 *     için yerelde görünmez).
 *
 * Çizim/DOM katmanı test edilmiyor (CLAUDE.md test politikası).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../');
const PROG_DIR = path.join(ROOT, 'programlar');
const KAYIT = JSON.parse(fs.readFileSync(path.join(PROG_DIR, 'kayit.json'), 'utf8'));

const {
  veProgramlarUrl,
  veProgramlarYolMetni,
  veProgramlarBoyut,
  veProgramlarSuz,
  VE_PROGRAMLAR_KUMELER
} = require('../../js/cp-programlar.js');

describe('kayıt defteri ↔ disk', () => {
  test('kayıttaki her dosya diskte var', () => {
    const eksik = KAYIT.programlar
      .map((p) => ({ ad: p.ad, tam: path.join(PROG_DIR, p.dosya) }))
      .filter((x) => !fs.existsSync(x.tam))
      .map((x) => x.ad + ' → ' + path.relative(ROOT, x.tam));
    expect(eksik).toEqual([]);
  });

  test('artifact/ ve disaridan/ altındaki her HTML kayıtta var — öksüz dosya yok', () => {
    const kayitli = new Set(
      KAYIT.programlar.map((p) => path.normalize(path.join(PROG_DIR, p.dosya)))
    );
    const diskte = [];
    ['artifact', 'disaridan'].forEach((alt) => {
      const d = path.join(PROG_DIR, alt);
      if (!fs.existsSync(d)) return;
      fs.readdirSync(d)
        .filter((f) => f.endsWith('.html'))
        .forEach((f) => diskte.push(path.normalize(path.join(d, f))));
    });
    const oksuz = diskte.filter((f) => !kayitli.has(f)).map((f) => path.relative(ROOT, f));
    expect(oksuz).toEqual([]);
  });

  test('her kaydın küme değeri pencerenin küme tablosunda var', () => {
    const bilinen = new Set(VE_PROGRAMLAR_KUMELER.map((k) => k.anahtar));
    const yabanci = [...new Set(KAYIT.programlar.map((p) => p.kume))].filter((k) => !bilinen.has(k));
    expect(yabanci).toEqual([]);
  });

  test('üretilen üç ürün boyut TAŞIMAZ, donmuş dosyaların hepsi taşır', () => {
    const urun = KAYIT.programlar.filter((p) => p.kume === 'urun');
    expect(urun.length).toBe(3);
    // Boyutları her build'de değişir; kayda yazılsaydı ilk build'de bayatlardı.
    urun.forEach((p) => expect(p.boyut).toBeUndefined());

    const donmus = KAYIT.programlar.filter((p) => p.kume !== 'urun');
    donmus.forEach((p) => {
      expect(typeof p.boyut).toBe('number');
      expect(p.boyut).toBe(fs.statSync(path.join(PROG_DIR, p.dosya)).size);
    });
  });
});

describe('yol kurulumu', () => {
  test('yol programlar/ önekiyle kuruluyor', () => {
    expect(veProgramlarUrl({ dosya: 'artifact/x.html' })).toBe('programlar/artifact/x.html');
  });

  test('dosyasız kayıt boş yol verir — window.open çağrılmaz', () => {
    expect(veProgramlarUrl(null)).toBe('');
    expect(veProgramlarUrl({})).toBe('');
  });

  // Kayıt yolları programlar/'a göreli; üç ürün ../ ile başlıyor. Tarayıcı
  // normalize edince belge diziniyle AYNI yere düşmeleri gerekir — ürünlere
  // ayrı bir dal yazılmamasının tek gerekçesi bu.
  test('../ ile başlayan ürün yolu belge dizinine düşer (depo ve dağıtım)', () => {
    const urun = KAYIT.programlar.find((p) => p.kume === 'urun');
    ['file:///bir/yer/MFSim_Code.html', 'https://ornek.test/index.html'].forEach((taban) => {
      const coz = new URL(veProgramlarUrl(urun), taban).href;
      const dizin = taban.slice(0, taban.lastIndexOf('/') + 1);
      expect(coz).toBe(dizin + path.basename(urun.dosya));
    });
  });

  // Satırda gösterilen yol sadeleştirilir; tarayıcıya giden yol DEĞİŞMEZ.
  test('gösterim yolu ../ taşımaz ama hedefi değiştirmez', () => {
    KAYIT.programlar.forEach((p) => {
      const metin = veProgramlarYolMetni(p);
      expect(metin).not.toContain('..');
      const taban = 'file:///bir/yer/MFSim_Code.html';
      expect(new URL(veProgramlarUrl(p), taban).href).toBe(new URL(metin, taban).href);
    });
  });

  test('artifact yolu alt klasörde kalır', () => {
    const a = KAYIT.programlar.find((p) => p.kume === 'artifact');
    const coz = new URL(veProgramlarUrl(a), 'file:///bir/yer/MFSim_Code.html').href;
    expect(coz).toBe('file:///bir/yer/programlar/' + a.dosya);
  });
});

describe('yoklama hedefi', () => {
  // Silinirse: arşiv yanındayken bile "yok" ölçülür, bütün satırlar pasifleşir.
  test('programlar/arsiv-var.js var ve tek işi işaret koymak', () => {
    const p = path.join(PROG_DIR, 'arsiv-var.js');
    expect(fs.existsSync(p)).toBe(true);
    const src = fs.readFileSync(p, 'utf8');
    expect(src).toContain('__MFSIM_ARSIV_VAR');
    // Katalog buraya İKİNCİ KEZ yazılmasın: iki kopya ayrışırdı. Yorumları
    // atınca geriye TEK atama kalmalı — veri yükü değil, işaret.
    const kod = src.split('\n').filter((l) => !/^\s*(\/\/|$)/.test(l)).join('\n').trim();
    expect(kod).toBe('window.__MFSIM_ARSIV_VAR = true;');
  });

  test('cp-programlar.js aynı hedefi yokluyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'cp-programlar.js'), 'utf8');
    expect(src).toContain("'programlar/arsiv-var.js'");
    // fetch ile DEĞİL: file:// üzerinde fetch var/yok ayrımı yapmıyor (ölçüldü).
    expect(src).toMatch(/onerror\s*=/);
  });
});

describe('build köprüsü', () => {
  const buildSrc = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
  const modulSrc = fs.readFileSync(path.join(ROOT, 'js', 'cp-programlar.js'), 'utf8');

  test('build.js kataloğu gömüyor, modül AYNI adı okuyor', () => {
    expect(buildSrc).toContain('window.__MFSIM_PROGRAMLAR');
    expect(buildSrc).toContain("path.join(ROOT, 'programlar', 'kayit.json')");
    expect(modulSrc).toContain('window.__MFSIM_PROGRAMLAR');
  });

  test('index.html modülü yüklüyor', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('js/cp-programlar.js');
  });

  // KARAR: katalog gömülür, programların GÖVDESİ gömülmez. Arşiv gzip'li
  // 17,40 MB; gömülseydi gönderilen .gz 30 MiB teslim sınırını aşardı.
  test('arşivin HTML gövdeleri tek dosyaya gömülmüyor', () => {
    expect(buildSrc).not.toMatch(/programlar[^\n]*\.html/);
    expect(buildSrc).not.toContain("'programlar', 'artifact'");
  });
});

describe('biçimleme ve arama', () => {
  test('boyut ölçeğe göre yazılıyor', () => {
    expect(veProgramlarBoyut(512)).toBe('512 B');
    expect(veProgramlarBoyut(2048)).toBe('2 KB');
    expect(veProgramlarBoyut(12 * 1048576)).toBe('12.0 MB');
  });

  test('boyutsuz kayıt boş dize verir — "0 B" yazılmaz', () => {
    // Üretilen üç üründe boyut YOK; "0 B" yazmak olmayan bir ölçü iddia ederdi.
    [undefined, null, 0, NaN, 'x'].forEach((v) => expect(veProgramlarBoyut(v)).toBe(''));
  });

  test('arama ad, dosya ve notta geçiyor', () => {
    const liste = [
      { ad: 'Kayış Yolu', dosya: 'artifact/kayis.html', kume: 'artifact' },
      { ad: 'CAN Çözümleyici', dosya: '../MFSim_CAN.html', kume: 'urun', not: 'build:can üretir' }
    ];
    expect(veProgramlarSuz(liste, 'kayış').map((p) => p.ad)).toEqual(['Kayış Yolu']);
    expect(veProgramlarSuz(liste, 'MFSim_CAN').map((p) => p.ad)).toEqual(['CAN Çözümleyici']);
    expect(veProgramlarSuz(liste, 'build:can').map((p) => p.ad)).toEqual(['CAN Çözümleyici']);
    expect(veProgramlarSuz(liste, '').length).toBe(2);
  });

  test('arama Türkçe büyük/küçük harfe duyarsız (I/İ tuzağı)', () => {
    const liste = [{ ad: 'Işık Defteri', dosya: 'a.html', kume: 'artifact' }];
    expect(veProgramlarSuz(liste, 'IŞIK').length).toBe(1);
    expect(veProgramlarSuz(liste, 'ışık').length).toBe(1);
  });
});

describe('şerit kablolaması', () => {
  const { VE_RIBBON_TABS, VE_RIBBON_ALWAYS_ON } = require('../../js/ribbon.js');

  test('Araçlar sekmesinde Arşiv grubu var', () => {
    const araclar = VE_RIBBON_TABS.find((t) => t.id === 'araclar');
    const oge = araclar.groups
      .reduce((a, g) => a.concat(g.items), [])
      .find((i) => i.run === 'veProgramArsiviOpen');
    expect(oge).toBeTruthy();
  });

  // Kılavuzlarla aynı gerekçe: arşiv çözülmüş model istemez, karşılama
  // ekranındayken de okunabilir olmalı. Muafiyet olmasaydı tam o anda PASİF
  // çizilirdi — kural yüzeyde yazılı, davranışta yok olurdu.
  test('boş tuvalde pasif çizilmiyor', () => {
    expect(VE_RIBBON_ALWAYS_ON).toContain('veProgramArsiviOpen');
  });
});
