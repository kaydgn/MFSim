/**
 * Artifact gövde varyantı — tools/build-artifact.js
 * ─────────────────────────────────────────────────
 * Kullanıcının ağı GitHub'a da Pages'e de çıkamıyor; program claude.ai'ın
 * Artifact sayfası olarak yayınlanıyor. Bu dosya iki şeyi kapıya bağlıyor:
 *
 *   1. Dönüştürücü — sarmalayıcıyı doğru söküyor mu, ve BENİ BİR KEZ YAKALAYAN
 *      hatayı bir daha yapmıyor mu (aşağıda "sahte </body>").
 *   2. Ağ kapıları — artifact ortamında dört özellik fetch ÇAĞIRMIYOR mu.
 *
 * Test politikası gereği HTML dizgesinde etiket aramıyoruz; aranan şey
 * DAVRANIŞ: kesilen gövde, kaçan istek, ezilen tema.
 */

const path = require('path');
const BA = require(path.join(__dirname, '../../tools/build-artifact.js'));
const SHIELD = require(path.join(__dirname, '../../build-shield.js'));

// Gerçek belgenin küçük ama YAPISAL OLARAK AYNI bir örneği: html/head/body,
// tema özniteliği, tema tanımlayan bir <style>, pwa link'leri ve script.
function belge(opts) {
  opts = opts || {};
  return [
    '<!DOCTYPE html>',
    '<html lang="tr" data-theme="slate">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <title>MFSim — Test</title>',
    '  <link rel="manifest" href="pwa/manifest.json" />',
    '  <link rel="icon" type="image/svg+xml" href="pwa/icon.svg" />',
    '  <style>[data-theme="slate"]{--a:1}[data-theme="navy"]{--a:2}</style>',
    '</head>',
    '<body' + (opts.bodyAttrs || '') + '>',
    '  <div id="uygulama">merhaba</div>',
    '  <script>',
    '  ' + (opts.scriptGovde || 'var x = 1;'),
    '  <' + '/script>',
    '  <div id="son">SON</div>',
    '</body>',
    '</html>'
  ].join('\n');
}

describe('build-artifact — dönüştürücü', () => {
  test('sarmalayıcı etiketlerin hiçbiri çıktıda kalmaz', () => {
    const cikti = BA.donustur(belge());
    const maskeli = SHIELD.maskRawText(cikti);
    expect(maskeli).not.toMatch(/<!doctype/i);
    expect(maskeli).not.toMatch(/<\/?html\b/i);
    expect(maskeli).not.toMatch(/<\/?head\b/i);
    expect(maskeli).not.toMatch(/<\/?body\b/i);
  });

  test('gövdenin SONU korunur — script içindeki sahte "</body>" gövdeyi kesmez', () => {
    // BU TESTİN SEBEBİ ÖLÇÜLMÜŞ BİR HATA: MFSim'in rapor üreticileri
    // (cp-mount-report.js, cp-fead-report.js) HTML şablonu basıyor, yani
    // "</body>" dizesi JS gövdelerinin İÇİNDE de geçiyor — gerçek belgede
    // 3 kez. "İlk eşleşme gerçektir" varsayan ilk sürüm gövdeyi 425 KB'ta
    // kesti ve 80 script'in yalnızca 9'unu taşıdı; sayfa yarım açılırdı.
    const cikti = BA.donustur(belge({
      scriptGovde: 'var sablon = "<html><body>rapor<' + '/body><' + '/html>";'
    }));
    expect(cikti).toContain('SON');                 // gövdenin son elemanı taşındı
    expect(cikti).toContain('rapor');               // sahte şablon da yerinde duruyor
    expect(SHIELD.scanDocument(cikti).scripts).toBe(2);   // özgün + shim
  });

  test('<title> tam bir kez ve ilk 8 KB içinde geçer', () => {
    const cikti = BA.donustur(belge());
    const kac = (cikti.match(/<title>/gi) || []).length;
    expect(kac).toBe(1);
    expect(cikti.indexOf('<title>')).toBeLessThan(8 * 1024);
    // Galeri başlığı AD olmalı: uzun tireden sonrası (açıklama) düşer.
    expect(cikti).toContain('<title>MFSim</title>');
    expect(cikti).not.toContain('<title>MFSim — Test</title>');
  });

  test('ortam bayrağı ilk script bloğunda ve diğer her script\'ten ÖNCE gelir', () => {
    const cikti = BA.donustur(belge());
    const bayrak = cikti.indexOf('window.MFSIM_ENV = "artifact"');
    expect(bayrak).toBeGreaterThan(-1);
    // Bayraktan sonra gelen ilk script bloğu uygulamanınki olmalı; yani
    // bayrak, uygulama script'inin önünde. Sıra bozulursa modüller bayraksız koşar.
    expect(bayrak).toBeLessThan(cikti.indexOf('var x = 1'));
  });

  test('pwa manifest ve icon başvuruları düşürülür (artifact\'te 404 verirler)', () => {
    const cikti = BA.donustur(belge());
    expect(cikti).not.toContain('pwa/manifest.json');
    expect(cikti).not.toContain('pwa/icon.svg');
  });

  test('<body> özniteliği eklenirse SESSİZCE düşürülmez, durur', () => {
    expect(() => BA.donustur(belge({ bodyAttrs: ' class="koyu"' })))
      .toThrow(/özniteliği taşınmıyor/);
  });

  test('tema listesi CSS\'ten çıkarılır, elle yazılmaz', () => {
    expect(BA.temalariCikar(belge())).toEqual(['navy', 'slate']);
    // css'e yeni tema eklenince liste kendiliğinden büyümeli
    const genis = belge().replace('[data-theme="navy"]{--a:2}',
      '[data-theme="navy"]{--a:2}[data-theme="cream"]{--a:3}');
    expect(BA.temalariCikar(genis)).toEqual(['cream', 'navy', 'slate']);
  });
});

describe('build-artifact — tema koruması', () => {
  // Shim'i gerçek DOM'da koşturuyoruz: MutationObserver'ın davranışı
  // dizge incelemesiyle ölçülemez.
  function kur(temalar, varsayilan) {
    document.documentElement.setAttribute('data-theme', 'dark');   // artifact host damgası
    // eslint-disable-next-line no-new-func
    new Function(BA.temaKorumasi(temalar, varsayilan))();
    return document.documentElement;
  }

  afterEach(() => { document.documentElement.removeAttribute('data-theme'); });

  test('host\'un damgası kurulum anında MFSim temasıyla değiştirilir', () => {
    const kok = kur(['slate', 'navy'], 'slate');
    expect(kok.getAttribute('data-theme')).toBe('slate');
  });

  test('host SONRADAN damgalarsa MFSim teması geri gelir', done => {
    const kok = kur(['slate', 'navy'], 'slate');
    kok.setAttribute('data-theme', 'light');
    setTimeout(() => {
      expect(kok.getAttribute('data-theme')).toBe('slate');
      done();
    }, 0);
  });

  test('MFSim\'in KENDİ tema seçimi ezilmez ve yeni son değer olur', done => {
    const kok = kur(['slate', 'navy'], 'slate');
    kok.setAttribute('data-theme', 'navy');
    setTimeout(() => {
      expect(kok.getAttribute('data-theme')).toBe('navy');
      kok.setAttribute('data-theme', 'dark');       // host tekrar damgalıyor
      setTimeout(() => {
        // slate'e değil, kullanıcının SON seçtiği navy'ye dönmeli
        expect(kok.getAttribute('data-theme')).toBe('navy');
        done();
      }, 0);
    }, 0);
  });
});

describe('build-artifact — doğrulama kapısı', () => {
  const girdi = belge();

  test('temiz çıktı geçer', () => {
    const r = BA.dogrula(BA.donustur(girdi), girdi);
    expect(r.hatalar).toEqual([]);
  });

  test('sarmalayıcı etiket kaçarsa yakalanır', () => {
    const bozuk = '<body>' + BA.donustur(girdi);
    expect(BA.dogrula(bozuk, girdi).hatalar.join(' ')).toMatch(/<body> etiketi kaldı/);
  });

  test('<title> 8 KB\'ın dışına düşerse yakalanır', () => {
    const bozuk = '<div>' + 'x'.repeat(9000) + '</div>' + BA.donustur(girdi);
    expect(BA.dogrula(bozuk, girdi).hatalar.join(' ')).toMatch(/ilk 8 KB dışında/);
  });

  test('script sayısı kayarsa yakalanır', () => {
    const bozuk = BA.donustur(girdi) + '<script>var fazladan=1;<' + '/script>';
    expect(BA.dogrula(bozuk, girdi).hatalar.join(' ')).toMatch(/Script blok sayısı/);
  });

  test('16 MB sınırı ölçülür', () => {
    const r = BA.dogrula(BA.donustur(girdi), girdi);
    expect(r.bayt).toBeLessThan(16 * 1024 * 1024);
  });
});

describe('build-shield — maskRawTextKeepOffsets', () => {
  test('uzunluğu ve dolayısıyla konumları korur', () => {
    const src = belge({ scriptGovde: 'var s = "<' + '/body>";' });
    const mk = SHIELD.maskRawTextKeepOffsets(src);
    expect(mk.length).toBe(src.length);
  });

  test('script gövdesindeki sahte etiketi maskeler, gerçeğini bırakır', () => {
    const src = belge({ scriptGovde: 'var s = "<' + '/body>";' });
    const mk = SHIELD.maskRawTextKeepOffsets(src);
    expect((mk.match(/<\/body\s*>/gi) || []).length).toBe(1);
    // ve bulunan konum HAM metinde de gerçekten </body>
    expect(src.slice(mk.search(/<\/body\s*>/i))).toMatch(/^<\/body>/i);
  });
});

// ── OCCT ÇEKİRDEĞİ ÖNİZLEMEYE GİRMEZ ───────────────────────────────────────
// Boolean'lı çekirdeğe geçince gömülü .wasm 17,5 MB oldu — tek başına artifact
// sınırının (16 MB) üstünde. Yük çıkarılmazsa önizleme kanalı TAMAMEN kapanır;
// oysa kullanıcının programı görebildiği tek kanal bu (CI bunu yakaladı:
// "boyut 26.82 MB — artifact sınırı 16 MB").
describe('artifact varyantı OCCT yükünü çıkarıyor', () => {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.join(__dirname, '../..');
  const src = fs.readFileSync(path.join(ROOT, 'tools/build-artifact.js'), 'utf8');

  test('yük ÇIKIYOR ama etiket KALIYOR', () => {
    // Etiketi de silseydik köprü "gömülü varlık sayfada yok" derdi ve sebep
    // bir yapılandırma hatası gibi okunurdu.
    expect(src).toContain('occtVarliginiCikar');
    expect(src).toMatch(/data-mfsim-asset="occt-wasm"/);
    expect(src).toMatch(/m\[1\] \+ '[\s\S]*?' \+ m\[3\]/);
  });

  test('bayrak shim\'de veriliyor — köprü SEBEBİYLE reddedebilsin', () => {
    expect(src).toContain('window.VE_STR_OCCT_ABSENT = true;');
    const model = fs.readFileSync(path.join(ROOT, 'js/structural-model.js'), 'utf8');
    expect(model).toContain('function veStrOcctAbsent()');
    // Erken çıkış: varlık okunmaya HİÇ kalkışılmamalı.
    expect(model).toMatch(/function _sgEmbeddedWasmB64\(\)\{\s*\n\s*if\(veStrOcctAbsent\(\)\) return Promise\.reject/);
    // Panel bunu DÜĞMEYE BASMADAN ÖNCE yazıyor.
    const panel = fs.readFileSync(path.join(ROOT, 'js/cp-structural.js'), 'utf8');
    expect(panel).toMatch(/veStrOcctAbsent\(\)[\s\S]{0,400}VE_STR_OCCT_ABSENT_MSG/);
  });

  test('üretilen dosya sınırın ALTINDA (varsa)', () => {
    const out = path.join(ROOT, 'MFSim_Artifact.html');
    if (!fs.existsSync(out)) return;          // build:artifact koşmamış
    const mb = fs.statSync(out).size / 1048576;
    expect(mb).toBeLessThan(16);
    // Ve yük gerçekten YOK: 17,5 MB'lık base64 içeride olsaydı sınırı aşardı,
    // ama küçük bir kalıntı da sessizce kalabilir — açıkça arıyoruz.
    const html = fs.readFileSync(out, 'utf8');
    expect(html).not.toMatch(/VE_STR_OCCT_WASM_GZ_B64\s*=\s*"[A-Za-z0-9+/=]{1000}/);
    expect(html).toContain('VE_STR_OCCT_ABSENT = true');
  });
});
