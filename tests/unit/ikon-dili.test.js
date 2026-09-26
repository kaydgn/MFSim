/**
 * ikon-dili.test.js — TEK İKON AİLESİ (kullanıcı kararı 10·B, 2026-09-26)
 * ───────────────────────────────────────────────────────────────────────────
 * Arayüzde ikon işi gören her şey css/icons.css'teki çizgi ikondur. Sembol
 * karakteri (▶ ▼ ✓ ✕ ⚠ ★) yazı tipinden çizilir — Windows'ta Segoe UI
 * Symbol'dan — ve aynı şeritte ikinci bir çizim dili olur. Ölçülen: 16
 * ekranda 200 çizgi ikonun yanında 104 sembol karakteri.
 *
 * Kapılar:
 *   · css/icons.css ÜRETİLİR (tools/ikonlar.js) — elle düzenlenmez
 *   · kaynakta adı geçen her ikon tanımlı — bilinmeyen ad dolu bir KARE çizer
 *   · aşama dosyalarında ikon işi gören sembol karakteri yok (tools/ikon-dili.js);
 *     aşama 3'ten beri kapı LİSTE DEĞİL KURAL: kılavuz metni dışındaki her
 *     ürün dosyası taranır, yeni dosya kendiliğinden kapıya girer
 *   · tek üretici: master rozeti, bildirim ikonu tablosu, program simgesi eşlemesi
 */
const fs = require('fs');
const path = require('path');
const T = require('../../tools/ikon-dili.js');
const U = require('../../tools/ikonlar.js');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
const ADLAR = new Set(Object.keys(U.ikonlar()));

// Aşama 1: kabuk. Ölçüm Görüntüleyici'nin panosu (viewer/js/board.js)
// Sonuçlar'ın ağacının kopyası — onunla birlikte aşama 3'te.
const ASAMA1 = ['index.html', 'css/styles.css', 'viewer/index.html', 'viewer/js/app.js',
  'js/ikon.js', 'js/ribbon.js', 'js/command-palette.js', 'js/context-menus.js', 'js/settings.js',
  'js/status.js', 'js/shortcuts-help.js', 'js/toolbar.js', 'js/cp-komuta.js', 'js/guide-kit.js',
  'js/kimlik.js', 'js/cp-programlar.js', 'js/tablo-pencere.js', 'js/solver-pro.js', 'js/trace-view.js',
  'js/measure-import-ui.js', 'js/signal-tree.js', 'js/deploy-status.js', 'js/topology.js',
  'js/ui-core.js', 'js/components.js', 'js/state.js', 'js/loader.js', 'js/module-loader.js',
  'js/annotations.js', 'js/cp-core.js', 'js/radio.js', 'js/empty-hint.js', 'js/tabs.js', 'js/theme.js'];
// Aşama 2: bileşen panelleri (js/cp-*.js — rapor üreticileri aşama 3'te),
// yardımcı bileşenler, harita, çözücü paneli, FEAD köprüsünün yön etiketi.
// Kılavuz metinleri (guide-*.js) belge — tools/ikon-dili.js başlığında sebebi.
const RAPOR = /^cp-(fead-report|fead-summary|mount-report)\.js$/;
const ASAMA2 = fs.readdirSync(path.join(KOK, 'js'))
  .filter((f) => /^cp-.*\.js$/.test(f) && !RAPOR.test(f))
  .concat(['component-extras.js', 'map.js', 'solver.js', 'fead-model.js'])
  .map((f) => 'js/' + f)
  .filter((f) => !ASAMA1.includes(f));
// Aşama 3: geri kalan HER ürün dosyası — Sonuçlar, rapor üreticilerinin
// paneli, sensörler, Ölçüm Görüntüleyici, CAN Çözümleyici, oyunlar. Dışarıda
// kalan tek şey kılavuz METNİ (guide-*.js — sebebi tools/ikon-dili.js'te).
const dizin = (d) => fs.readdirSync(path.join(KOK, d)).filter((f) => f.endsWith('.js')).map((f) => d + '/' + f);
const URUN = dizin('js').filter((f) => !/^js\/guide-/.test(f))
  .concat(dizin('viewer/js'), dizin('candbc/js'), ['index.html', 'viewer/index.html', 'candbc/index.html'])
  .concat(fs.readdirSync(path.join(KOK, 'css')).filter((f) => f.endsWith('.css')).map((f) => 'css/' + f));
const ASAMA3 = URUN.filter((f) => !ASAMA1.includes(f) && !ASAMA2.includes(f));

describe('kural — ikon işi ile metin ayrılıyor', () => {
  const yakalar = (m, f) => T.tara(m, f || 'a.js').map((x) => x.konum + ' ' + x.glif);
  test.each([
    ['<button>✕</button>', 'öğe ✕'],                        // öğenin tek içeriği
    ["x.textContent = '▼';", 'tek ▼'],                      // aç/kapa oku
    ["h = '✓ model çözülüyor';", 'baş ✓'],                  // etiketin başında resim yazısı
    ["h = 'Gergi gevşek ✓</b>';", 'son ✓'],                 // etiketin sonunda
    ["h += (on ? '● ' : '') + ad;", 'tek ●'],               // seçili işareti
    ["var i = '↓';   // metin:", 'tek ↓']                   // sebepsiz işaret susturmaz
  ])('yakalanır: %s', (m, k) => expect(yakalar(m)).toEqual([k]));
  test.each([
    ["h = '1C→2C';"],                                        // metnin içi
    ["a.join(' → ');"],                                      // iki yanı boşluklu ok: ayraç
    ["log('  ✓ Bulundu', 'ok');"],                           // çözücü günlüğü düz metin
    ["ctx.fillText('⚠ hata', 0, 0);"],                       // tuval yazısı
    ["r += '  ▸ Vites\\n';"],                                // TXT raporu satırı
    ["var i = '↓';   // metin: günlük satırı"],              // sebebi yazılı işaret
    ['// ✕ ile kapatın'],                                    // yorum
    ["var re = /[▶▼]/;"]                                     // düzenli ifade
  ])('geçer: %s', (m) => expect(yakalar(m)).toEqual([]));
  test('kaçışla yazılmış karakter de karakterdir (\\u21bb CW)', () => {
    // FEAD'in dönüş rozeti '↻ CW'yi kaçışla yazıyordu ve taramaya hiç girmiyordu.
    expect(yakalar("x = '\\u21bb CW';")).toEqual(['baş ↻']);
    expect(yakalar("x = '1C\\u21922C';")).toEqual([]);   // metnin içindeki ok yine metin
  });
  // Aşama 1 ve 2 bu sınıfı GÖRMEDEN "0" dedi: satır silen "×", sekme ekleyen
  // "+", yakınlaştıran "−" — yalnız öğenin TEK içeriğiyken ikondur.
  test.each([
    ['<button class="ve-row-del">×</button>', 'yalnız ×'],
    ['<div class="ve-tab-add">+</div>', 'yalnız +'],
    ['<button title="Uzaklaş">−</button>', 'yalnız −'],
    ["h = '<span>↔</span> Yatay aynala';", 'öğe ↔'],       // yeni ok ailesi
    ["t = '↳ gövdenin montaj konumu';", 'baş ↳'],
    ['<span>⟲</span> Varsayılana dön', 'öğe ⟲']
  ])('yakalanır (aşama 3): %s', (m, k) => expect(yakalar(m)).toEqual([k]));
  test.each([
    ["x = a + ' × ' + b;"],                                  // çarpım
    ["u = { unit: '−' };"],                                  // birim
    ["h = '<b>3 × 4</b>';"],                                 // metnin içi
    ["t = 'sol ↔ sağ';"],                                    // bağıntı
    ["j = '<span class=\"p\">+</span>';   // metin: tuş birleşimi (Ctrl + S)"]
  ])('geçer (aşama 3): %s', (m) => expect(yakalar(m)).toEqual([]));
  test('belge üreticisi: dosyanın TAMAMI belge, yalnız adı yazılı işlev arayüz', () => {
    const f = 'js/cp-mount-report.js';
    const s = "function getMntReportPropertiesHTML(n){ return '<b>✓</b>'; }\n"
      + 'function veMntGenerateReport(){}\n'
      + "function _mntRepX(){ return '<b>✓</b>'; }";
    expect(T.tara(s, f).map((x) => x.satir)).toEqual([1]);        // yalnız panel
    // Adı yazılı arayüz işlevi yoksa tarama PATLAR: yeniden adlandırma panelin
    // kapıdan sessizce çıkması olurdu.
    expect(() => T.tara("function x(){ return '<b>✓</b>'; }", f, { kati: true })).toThrow(/BELGE_DOSYA işlevi yok/);
    expect(T.sapmalar(f)).toEqual([]);                                    // gerçek dosya: işlevler yerinde
    // Karışık dosyada önek: indirilen AP raporunun bölümleri (_veRepSec…)
    const r = "function _veRepSecFoo(){ return '<b>✓</b>'; }\nfunction _veReportAntet(){}\n"
      + "function _veReportAssemble(){}\nfunction _veMakeReportHelpers(){}\nfunction ui(){ return '<b>✓</b>'; }";
    expect(T.tara(r, 'js/results.js').map((x) => x.satir)).toEqual([5]);
  });
  test('HTML: tuşun adı metindir, öğenin tek içeriği değildir', () => {
    expect(yakalar('<kbd>↑</kbd><kbd>↓</kbd> gezin', 'a.html')).toEqual([]);
    expect(yakalar('<span>▲</span>', 'a.html')).toEqual(['öğe ▲']);
  });
  test('CSS: sözde öğenin içeriği karakter olamaz (kaçışlı da)', () => {
    expect(yakalar(".a::after{content:'✓'}", 'a.css')).toEqual(['css ✓']);
    expect(yakalar(".a::after{content:'\\25be'}", 'a.css')).toEqual(['css ▾']);
    expect(yakalar('.a::before{content:"· "}', 'a.css')).toEqual([]);
  });
});

describe('css/icons.css ÜRETİLİR', () => {
  test('dosya üreteçle birebir — elle düzenlenmedi, kaynak unutulmadı', () => {
    // Bayatsa: node tools/ikonlar.js
    expect(oku('css/icons.css') === U.uret()).toBe(true);
  });
  test('her ikon tek bir kabukta (viewBox 24, çizgi 2) — gövde yalnız çizim', () => {
    for (const [ad, govde] of Object.entries(U.ikonlar())) {
      expect({ ad, svgAc: /<svg\b/.test(govde) }).toEqual({ ad, svgAc: false });
    }
  });
});

describe('kaynakta adı geçen her ikon TANIMLI', () => {
  // Bilinmeyen ad dolu bir KARE çizer (maske yok, zemin currentColor) — hata
  // yok, uyarı yok. Sınıf, yardımcı çağrısı ve üçlü koşulun iki kolu taranır.
  const dosyalar = fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)
    .concat(['index.html', 'css/styles.css', 'viewer/index.html', 'candbc/index.html'])
    .concat(fs.readdirSync(path.join(KOK, 'viewer/js')).map((f) => 'viewer/js/' + f))
    .concat(fs.readdirSync(path.join(KOK, 'candbc/js')).map((f) => 'candbc/js/' + f));
  const ADI = [/mf-ico-([a-z0-9-]+)(?![a-z0-9-]*['"]?\s*\+)/g, /veIkon\(\s*'([a-z0-9-]+)'/g,
    /veIkonDegis\([^,()]+,\s*'([a-z0-9-]+)'/g,
    /veIkon(?:Degis)?\([^'()]*?\?\s*'([a-z0-9-]+)'\s*:\s*'([a-z0-9-]+)'/g];
  test('tanımsız ad yok', () => {
    const yok = [], gorulen = new Set();
    for (const f of dosyalar) {
      const s = T.yorumsuzJs(oku(f));
      for (const re of ADI) for (const m of s.matchAll(re)) {
        m.slice(1).filter(Boolean).forEach((ad) => { gorulen.add(ad); if (!ADLAR.has(ad)) yok.push(f + ': ' + ad); });
      }
    }
    expect([...new Set(yok)]).toEqual([]);
    expect(gorulen.size).toBeGreaterThan(50);            // tarama boşa çalışmıyor
  });
});

describe.each([['aşama 1 — kabuk', ASAMA1], ['aşama 2 — bileşen panelleri', ASAMA2],
  ['aşama 3 — geri kalan her ürün dosyası', ASAMA3]])('%s', (ad, dosyalar) => {
  test('liste boş değil', () => expect(dosyalar.length).toBeGreaterThan(15));
  test('ikon işi gören sembol karakteri yok', () => {
    const s = dosyalar.flatMap(T.sapmalar).map((x) => x.dosya + ':' + x.satir + ' [' + x.konum + ' ' + x.glif + '] ' + x.metin);
    expect(s).toEqual([]);
  });
});

describe('tek üretici', () => {
  test('master rozeti yalnız veMasterRozet\'ten (eskiden altı kopya, ipuçları ayrışmıştı)', () => {
    const uretici = [];
    fs.readdirSync(path.join(KOK, 'js')).forEach((f) => {
      const s = oku('js/' + f);
      const n = (s.match(/class="ve-wheel-master-badge"|className\s*=\s*'ve-wheel-master-badge'/g) || []).length;
      if (n) uretici.push(f + ' ×' + n);
    });
    expect(uretici).toEqual(['ui-core.js ×1']);
  });
  test('bildirim ikonu tablosu MFSim ile Ölçüm Görüntüleyici\'de AYNI ve her ad tanımlı', () => {
    const tablo = (f) => (/var VE_TOAST_IKON = (\{[^}]*\});/.exec(oku(f)) || [])[1];
    expect(tablo('js/results.js')).toBeTruthy();
    expect(tablo('viewer/js/board.js')).toBe(tablo('js/results.js'));
    const t = new Function('return ' + tablo('js/results.js'))();
    expect(Object.keys(t).sort()).toEqual(['error', 'info', 'success', 'warning']);
    Object.values(t).forEach((ad) => expect(ADLAR.has(ad)).toBe(true));
  });
  test('bildirim ikonu harf DEĞİL: showToast sembol karakteri yazmıyor', () => {
    ['js/results.js', 'viewer/js/board.js'].forEach((f) => {
      const s = oku(f), i = s.indexOf('function showToast(');
      const govde = s.slice(i, s.indexOf('\n}\n', i) + 2);
      expect(govde).toMatch(/mf-ico mf-ico-' \+ \(VE_TOAST_IKON\[type\]/);
      expect(T.tara(govde, f)).toEqual([]);
    });
  });
  test('Program Arşivi: kayıttaki her simge bir ikona eşleniyor ve ikon tanımlı', () => {
    global.veIkon = require('../../js/ikon.js').veIkon;
    const P = require('../../js/cp-programlar.js');
    const k = JSON.parse(oku('programlar/kayit.json'));
    const liste = Array.isArray(k) ? k : (k.programlar || Object.values(k)[0]);
    expect(liste.length).toBeGreaterThan(40);
    const eslesmeyen = liste.filter((p) => !P.VE_PROGRAMLAR_IKON.some((e) => String(p.simge || '').includes(e[0])))
      .map((p) => p.simge + ' ' + p.ad);
    expect(eslesmeyen).toEqual([]);
    P.VE_PROGRAMLAR_IKON.forEach((e) => expect(ADLAR.has(e[1])).toBe(true));
    // birden çok emojili simgede İLK emoji sayılır
    expect(P.veProgramlarIkon('🎞️⚙️')).toBe('film');
    expect(P.veProgramlarIkon('bilinmeyen')).toBe('file-text');
  });
  test('Ölçüm Görüntüleyici ile paylaşılan dosyalar veIkon ÇAĞIRMAZ (görüntüleyicide yok)', () => {
    fs.readdirSync(path.join(KOK, 'viewer/js')).forEach((f) => {
      expect({ f, cagri: /\bveIkon(?:Degis)?\(/.test(T.yorumsuzJs(oku('viewer/js/' + f))) }).toEqual({ f, cagri: false });
    });
  });
});

describe('js/ikon.js', () => {
  const { veIkon, veIkonDegis, veDurumIkon } = require('../../js/ikon.js');
  test('durum işareti: onay / uyarı / ret — rengi sınıftan, adıyla okunur', () => {
    expect(veDurumIkon('ok')).toBe('<span class="mf-ico mf-ico-check ve-durum ve-durum-ok" role="img" aria-label="Uygun"></span>');
    expect(veDurumIkon('err', 'Limit aşıldı')).toContain('mf-ico-x ve-durum ve-durum-err" role="img" aria-label="Limit aşıldı"');
    expect(veDurumIkon('bilinmeyen')).toContain('mf-ico-alert-triangle ve-durum ve-durum-warn');   // bilinmeyen tür uyarıya düşer
    const css = oku('css/styles.css');
    ['ok', 'warn', 'err'].forEach((t) => expect(css).toMatch(new RegExp('\\.ve-durum-' + t + '\\{\\s*color:var\\(--ink-')));
  });
  test('süs ikonu ekran okuyucudan gizli; tek başına anlam taşıyan ikon adıyla okunur', () => {
    expect(veIkon('x')).toBe('<span class="mf-ico mf-ico-x" aria-hidden="true"></span>');
    expect(veIkon('check', 'ok', 'Uygun "tam"')).toBe(
      '<span class="mf-ico mf-ico-check ok" role="img" aria-label="Uygun &quot;tam&quot;"></span>');
  });
  test('veIkonDegis yalnız ikon sınıfını değiştirir', () => {
    const el = document.createElement('span');
    el.className = 'vsig-arrow mf-ico mf-ico-chevron-right acik';
    veIkonDegis(el, 'chevron-down');
    expect(el.className.split(' ').sort()).toEqual(['acik', 'mf-ico', 'mf-ico-chevron-down', 'vsig-arrow']);
    const bos = document.createElement('span');
    veIkonDegis(bos, 'x');
    expect(bos.className).toBe('mf-ico mf-ico-x');
    expect(() => veIkonDegis(null, 'x')).not.toThrow();
  });
});

describe('aşama 3 — üreticiler', () => {
  test('yorumun uyarı paragrafı çizgi ikonla başlar; düz metnin işareti ekrana çıkmaz', () => {
    // Yorum motoru (mount-brief.js) DÜZ METİN yazar ve uyarıyı "⚠ " ile
    // işaretler; ekranda ikona çeviren trace-view.js → _veTrRich.
    const TV = require('../../js/trace-view.js');
    const h = TV.veTrNoteHTML([{ title: 'Şok', paras: ['⚠ **Newton** <yakınsamadı>', 'Olağan paragraf'] }]);
    expect(h).toContain('mf-ico-alert-triangle ve-trace-note-uyari');
    expect(h).not.toContain('⚠');
    expect(h).toContain('&lt;yakınsamadı&gt;');                          // metin yine kaçışlı
    expect((h.match(/mf-ico-alert-triangle/g) || []).length).toBe(1);   // yalnız uyarı paragrafı
  });
  test('ikonun sınıfını yazan aç/kapa: Sonuçlar ile Görüntüleyici aynı iki adı kullanır', () => {
    const govde = (f) => { const s = oku(f), i = s.indexOf('function veToggleTree('); return s.slice(i, s.indexOf('\n}\n', i)); };
    [govde('js/results.js'), govde('viewer/js/board.js')].forEach((g) => {
      expect(g).toMatch(/'chevron-down' : 'chevron-right'/);
      expect(g).not.toMatch(/textContent/);
    });
  });
});
