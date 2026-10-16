/**
 * kabuk-metin.test.js — ARAYÜZ ANLATMAZ, kabuk (aşama 2, 2026-10-16)
 * ───────────────────────────────────────────────────────────────────────
 * Cırcır (metin-dili.test.js) yalnız sözlüğün İŞARETLEDİĞİ metni görür.
 * Kabuğun temizliğinde kalkan metinlerin çoğu işaretsizdi: "Hizalandı",
 * "Port kaldırıldı", "Yakınlaştırma: %120" gibi tekrar bildirimleri ve
 * "Tüm topolojiyi ekrana sığdır" gibi adı tekrarlayan ipuçları. Bu kapılar
 * o sınıfları KURAL olarak tutar:
 *   · şerit ipucu yalnız kısayol ya da dosya türü (veri) — adı tekrarlamaz
 *   · palet ipucu yalnız ad — cümle, tire, açıklama yok
 *   · kabukta uyarı/hata olmayan bildirim yalnız EKRANDA GÖRÜNMEYEN sonucu
 *     söyler (pano, yedek, dosya, geri al); izin listesi bilinçli bir karar
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

describe('şerit ipucu adı tekrarlamaz', () => {
  const { VE_RIBBON_TABS } = require('../../js/ribbon.js');
  const ogeler = VE_RIBBON_TABS.reduce((a, t) => a.concat(...t.groups.map((g) => g.items)), []);

  test('ipucu yok, ya da kısayol / dosya türü', () => {
    expect(ogeler.length).toBeGreaterThan(30);           // kapı boşa çalışmasın
    const sapan = ogeler.filter((i) => i.tip !== undefined && !/^(Ctrl\+[A-Z]|Excel · CSV)$/.test(i.tip))
      .map((i) => i.label.replace(/\n/g, ' ') + ': ' + i.tip);
    expect(sapan).toEqual([]);
  });

  test('pasif düğmenin ipucu durumu söyler, tarif vermez', () => {
    const src = oku('js/ribbon.js');
    expect(src).toContain("'Modül seçili değil'");
    expect(src).not.toMatch(/Önce bir modül seçin/);
  });
});

describe('palet ipucu yalnız ad', () => {
  test('bileşen satırlarının title\'ı cümle değil', () => {
    const html = oku('index.html');
    const t = [...html.matchAll(/<div class="ve-component[^"]*"[^>]*?title="([^"]*)"/g)].map((m) => m[1]);
    expect(t.length).toBeGreaterThan(3);
    expect(t.filter((x) => / — |[.:;]/.test(x))).toEqual([]);
  });
});

// Kabuğun dosyaları (aşama 2). Modül dosyaları kendi aşamasında.
const KABUK = ['js/ribbon.js', 'js/settings.js', 'js/command-palette.js', 'js/status.js', 'js/cp-komuta.js',
  'js/cp-programlar.js', 'js/context-menus.js', 'js/toolbar.js', 'js/topology.js', 'js/ui-core.js',
  'js/connections.js', 'js/align-nodes.js', 'js/auth.js', 'js/deploy-status.js', 'js/minimap.js',
  'js/annotations.js', 'js/state.js', 'js/kimlik.js', 'js/tidy-layout.js', 'js/window-drag.js',
  'js/radio.js', 'js/easter-egg.js', 'js/game-2048.js', 'js/module-loader.js', 'js/loader.js'];

// Ekranda GÖRÜNMEYEN sonuçlar: pano, tarayıcı deposu, dosya, geri al yığını.
// ‹› = değişken parça (sayı, ad).
const IZIN = [
  /^Geri alındı$/, /^İleri alındı$/, /^Yedek alındı$/, /^Yedek geri yüklendi$/, /^Otomatik yedek silindi$/,
  /^Tercihler sıfırlandı, sayfa yenileniyor…$/, /^Sipariş fişi panoya kopyalandı\.$/, /^Fiş seçildi · Ctrl\+C$/,
  /^Proje yüklendi: ‹› sekme$/, /^Topoloji yüklendi: ‹› bileşen$/,
  /^‹› bileşen (kopyalandı|yapıştırıldı)$/, /^İstasyon eklendi: ‹›$/, /^‹› parça eklendi\.$/
];
const izinli = (m) => IZIN.some((re) => re.test(m));

const { metinleri, bilgiBildirimleri } = require('../helpers/bildirim-olcu.js');
const bildirimler = (dosya) => bilgiBildirimleri(dosya, dosya === 'js/radio.js' ? 'toast' : null);

describe('kabukta bilgi bildirimi yalnız görünmeyen sonucu söyler', () => {
  test('uyarı/hata olmayan her bildirim izin listesinde', () => {
    const hepsi = KABUK.flatMap((f) => bildirimler(f).map((b) => Object.assign({ dosya: f }, b)));
    expect(hepsi.length).toBeGreaterThan(8);              // kapı boşa çalışmasın
    const sapan = hepsi.filter((b) => !izinli(b.metin)).map((b) => b.dosya + ':' + b.satir + ' ' + b.metin);
    expect(sapan).toEqual([]);
  });

  test('kapı düşebiliyor: tekrar bildirimi yakalanır', () => {
    expect(izinli('Hizalandı')).toBe(false);
    expect(izinli('Yakınlaştırma: %‹›')).toBe(false);
    expect(izinli('Yeni sekme: ‹›')).toBe(false);
    expect(metinleri(parser.parseExpression("'Proje yüklendi: ' + n + ' sekme'"))).toEqual(['Proje yüklendi: ‹› sekme']);
  });
});

// Modüle girmek ve çıkmak tuvalde görünüyor (breadcrumb, kapsam, kamera):
// "Ana topolojiye dönüldü" ve "Araç Performans — Alt Topoloji" tekrardı.
describe('kısayol ve onay düğmesi adları', () => {
  test('kısayol adı pencereyi anlatmaz, İngilizce karşılık eklemez', () => {
    const stubs = stubGlobals();
    eval(loadSource('shortcuts-help.js'));
    const adlar = _veHelpGroups().flatMap((g) => g.items.map((i) => i.label));
    expect(adlar.length).toBeGreaterThan(10);
    expect(adlar.filter((a) => /^Bu\b|\(/.test(a))).toEqual([]);
    resetStubs(stubs);
  });

  test('onay düğmesinin etiketi cümle düzeninde', () => {
    const { cumle } = require('../../tools/cumle-duzeni.js');
    const etiket = [];
    fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).forEach((f) => {
      const ast = parser.parse(oku('js/' + f), { sourceType: 'script', errorRecovery: true });
      (function yuru(n) {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'showConfirmToast'
            && n.arguments[3] && n.arguments[3].type === 'StringLiteral') etiket.push(n.arguments[3].value);
        for (const k of Object.keys(n)) { const v = n[k]; if (k === 'loc') continue; if (Array.isArray(v)) v.forEach(yuru); else if (v && typeof v.type === 'string') yuru(v); }
      })(ast.program);
    });
    expect(etiket.length).toBeGreaterThan(0);
    expect(etiket.filter((t) => cumle(t) !== t)).toEqual([]);
  });
});

describe('modüle giriş ve çıkış bildirim atmaz', () => {
  const ISLEV = [['js/cp-arac-performans.js', 'veAracOpenEditor'], ['js/cp-arac-performans.js', 'veAracCloseEditor'],
    ['js/cp-fead.js', 'veFeadOpenEditor'], ['js/cp-fead.js', 'veFeadCloseEditor'],
    ['js/cp-mount.js', 'veMntOpenEditor'], ['js/cp-mount.js', 'veMntCloseEditor']];
  test.each(ISLEV)('%s → %s', (dosya, ad) => {
    const ast = parser.parse(oku(dosya), { sourceType: 'script', errorRecovery: true });
    const fn = ast.program.body.find((n) => n.type === 'FunctionDeclaration' && n.id && n.id.name === ad);
    expect(fn).toBeTruthy();
    const govde = oku(dosya).slice(fn.start, fn.end);
    expect(govde).not.toMatch(/showToast\s*\(/);
  });
});

describe('açıklama yuvası yok', () => {
  test('Ayarlar ve Program Durumu açıklama paragrafı basmaz', () => {
    ['js/settings.js', 'js/status.js'].forEach((f) => expect(oku(f)).not.toMatch(/ve-settings-desc/));
    expect(/\.ve-settings-desc\b/.test(oku('css/styles.css'))).toBe(false);   // dosyayı dökmesin
  });

  test('Komuta tezgâhı ipucu, fiil açıklama taşımaz', () => {
    const K = require('../../js/cp-komuta.js');
    K.VE_KOMUTA_TEZGAHLAR.forEach((t) => expect({ id: t.id, ipucu: t.ipucu }).toEqual({ id: t.id, ipucu: undefined }));
    expect(oku('js/cp-komuta.js')).not.toMatch(/ve-komuta-(ipucu|fiil-aciklama|kunye-not|giris-alt|fis-alt)/);
  });

  test('hesap menüsünün kimlik bloğu yalnız adı taşır', () => {
    const src = oku('js/kimlik.js');
    const i = src.indexOf("'<div class=\"ve-avatar-menu-kim\">'");
    expect(i).toBeGreaterThan(-1);
    const blok = src.slice(i, src.indexOf("'</div>'", i));
    expect(blok).not.toMatch(/<span/);
    expect(blok).not.toMatch(/saklanır|yazılmaz/);
  });

  test('Program Arşivi kümesi not taşımaz', () => {
    const src = oku('js/cp-programlar.js');
    const kume = src.slice(src.indexOf('var VE_PROGRAMLAR_KUMELER'), src.indexOf('];', src.indexOf('var VE_PROGRAMLAR_KUMELER')));
    expect(kume).not.toMatch(/\bnot\s*:/);
  });
});
