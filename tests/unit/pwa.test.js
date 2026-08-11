/**
 * pwa.test.js — PWA kurulum ve çevrimdışı yolunun YAPISAL kapısı
 * ─────────────────────────────────────────────────────────────
 *
 * OLAY: PWA tamamen ölüydü ve hiçbir test bunu görmüyordu. İki bağımsız
 * kırılma, aynı kökten — "pwa/ bir alt dizin ama her şey kök gibi yazılmış":
 *
 *  1. KURULAN KISAYOL 404 AÇIYORDU. manifest'teki "start_url": "./",
 *     manifest'in KENDİ URL'ine göre çözülür → <site>/pwa/. O dizinde index
 *     yok. Canlı ölçüm: https://kaydgn.github.io/MFSim/pwa/ → HTTP 404.
 *     Kullanıcı "Uygulamayı yükle" dediğinde kısayol her açılışta GitHub
 *     Pages 404 sayfasını gösteriyordu; uygulama hiç açılmıyordu.
 *
 *  2. SERVICE WORKER UYGULAMA SAYFASINI HİÇ KONTROL ETMİYORDU. Bir SW'nin
 *     VARSAYILAN KAPSAMI kendi dosya yolunun dizinidir; pwa/sw.js olarak
 *     kaydedilince kapsam <site>/pwa/ oluyordu. Uygulama sayfası (<site>/)
 *     kapsam DIŞINDAYDI → "sw.js önbelleğe alır, çevrimdışı açılır" varsayımı
 *     hiçbir zaman gerçekleşmedi. Üstelik ASSETS'teki './' de <site>/pwa/
 *     demek olduğu için cache.addAll 404 alıp reddediyor, install adımı
 *     düşüyor ve SW zaten AKTİVE OLMUYORDU.
 *     Yan etki: js/deploy-status.js'teki getRegistration() her zaman
 *     undefined dönüyordu — "Şimdi Güncelle"nin SW yolu ölüydü.
 *
 *  3. MANİFEST OLMAYAN İKONLARA REFERANS VERİYORDU. icon-192.png ve
 *     icon-512.png depoda YOK. Canlı ölçüm: ikisi de HTTP 404.
 *
 * Bu testler dosya sisteminin ve yapılandırmanın KENDİSİNİ denetler; tarayıcı
 * gerektirmez, bu yüzden CI'da her koşuda çalışır.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// Toplama anında okuma YAPILMAZ. Dosya yerinde değilse readFileSync describe
// gövdesinde patlar, jest süiti hiç yükleyemez ve çıktı "0 test" olur —
// ekranda ham bir ENOENT kalır, hangi kuralın çiğnendiği görünmez. Eksik dosya
// da bir BULGUDUR ve okunur bir mesajla düşmelidir.
function oku(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

const manifestMetin = oku('pwa/manifest.json');
const manifest = manifestMetin ? JSON.parse(manifestMetin) : { icons: [] };
const indexHtml = oku('index.html') || '';
const deployYml = oku('.github/workflows/ci-deploy.yml') || '';
const genVersion = oku('gen-version.js') || '';

// Yayınlanan sitede manifest <site>/pwa/manifest.json adresindedir. manifest
// içindeki göreli yollar BUNA göre çözülür. Yayınlanmış URL'i taklit et.
function cozumle(deger) {
  return new URL(deger, 'https://ornek.test/MFSim/pwa/manifest.json').pathname;
}

describe('manifest — kurulan kısayol uygulamayı açar', () => {
  test('start_url uygulama KÖKÜNE çözülür, pwa/ alt dizinine değil', () => {
    expect(cozumle(manifest.start_url)).toBe('/MFSim/');
  });

  test('scope da uygulama kökü — start_url kapsamın içinde', () => {
    const scope = cozumle(manifest.scope);
    expect(scope).toBe('/MFSim/');
    expect(cozumle(manifest.start_url).startsWith(scope)).toBe(true);
  });

  test('referans verilen HER ikon depoda GERÇEKTEN var', () => {
    // 404 veren bir ikon, hiç ikon vermemekten kötüdür: tarayıcı kurulum
    // sırasında indirmeye çalışır ve kurulum kalitesi düşer.
    const eksik = manifest.icons
      .map((i) => i.src)
      .filter((src) => !fs.existsSync(path.join(ROOT, 'pwa', src)));
    expect(eksik).toEqual([]);
  });

  test('en az bir ikon var ve kurulabilirlik için yeterli', () => {
    expect(manifest.icons.length).toBeGreaterThan(0);
    const yeterli = manifest.icons.some(
      (i) => i.sizes === 'any' || parseInt(String(i.sizes).split('x')[0], 10) >= 144
    );
    expect(yeterli).toBe(true);
  });
});

describe('service worker — uygulama sayfasını KAPSAR', () => {
  test('sw.js depo KÖKÜNDE (kapsam uygulama kökü olsun diye)', () => {
    expect(fs.existsSync(path.join(ROOT, 'sw.js'))).toBe(true);
    // Eski yerinde kalmış bir kopya, hangisinin yayınlandığı sorusunu doğurur.
    expect(fs.existsSync(path.join(ROOT, 'pwa/sw.js'))).toBe(false);
  });

  test('kayıt yolu alt dizine işaret etmiyor', () => {
    const m = /navigator\.serviceWorker\.register\(\s*(['"])([^'"]+)\1/.exec(indexHtml);
    expect(m).not.toBeNull();
    const yol = m[2];
    expect(yol).not.toMatch(/\//);          // 'pwa/sw.js' gibi bir yol kapsamı daraltır
    expect(yol).toBe('sw.js');
  });

  test('deploy sw.js\'i KÖKE kopyalıyor', () => {
    expect(deployYml).toMatch(/cp\s+sw\.js\s+_site\/sw\.js/);
    expect(deployYml).not.toMatch(/_site\/pwa\/sw\.js/);
  });

  test('gen-version.js SHA yerine koymayı DOĞRU dosyada yapıyor', () => {
    // Yanlış yolu arayan bir yer-koyucu sessizce hiçbir şey yapmaz; SW adı
    // her deploy'da aynı kalır ve eski önbellek hiç temizlenmez.
    expect(genVersion).toMatch(/path\.join\(outDir,\s*['"]sw\.js['"]\)/);
    expect(genVersion).not.toMatch(/path\.join\(outDir,\s*['"]pwa['"]/);
  });
});

describe('service worker — tek bir eksik varlık SW\'yi öldürmüyor', () => {
  const sw = oku('sw.js') || '';

  test('install adımı cache.addAll KULLANMIYOR', () => {
    // addAll TOPTAN reddeder: bir varlık 404 verirse waitUntil düşer ve SW
    // hiç aktive olmaz — çevrimdışı desteğin tamamı tek bir yol hatasıyla
    // sessizce ölür. Tam olarak bu olmuştu.
    expect(sw).not.toMatch(/addAll\s*\(/);
    expect(sw).toMatch(/cache\.add\(/);
    expect(sw).toMatch(/\.catch\(/);         // tek tek denenir, düşen yutulur
  });

  test('önbelleğe alınan her varlık depoda var', () => {
    const m = /var ASSETS = \[([\s\S]*?)\]/.exec(sw);
    expect(m).not.toBeNull();
    const yollar = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(yollar).toContain('./');          // uygulama sayfasının kendisi
    const eksik = yollar
      .filter((y) => y !== './')
      .filter((y) => !fs.existsSync(path.join(ROOT, y.replace(/^\.\//, ''))));
    expect(eksik).toEqual([]);
  });

  test('SHA yer tutucusu duruyor (deploy başına yeni önbellek adı)', () => {
    expect(sw).toMatch(/__DEPLOY_SHA__/);
  });
});
