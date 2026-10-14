/**
 * ayarlar-dogruluk.test.js — AYARLAR PENCERESİ DOĞRUYU SÖYLÜYOR MU?
 * ───────────────────────────────────────────────────────────────────────
 * Elle yazılmış dört bilgi sessizce yanlıştı:
 *   · sürüm      hiç yazılmayan bir globalden okunuyordu → HER kopyada "dev"
 *   · açıklama   üç modülden yalnız Araç Performans'ı sayıyordu
 *   · lisans     "ISC" — depodaki LICENSE MIT
 *   · bağımlılık Three.js "r0.149" (doğrusu r149 = 0.149.0), Plotly "2.35"
 * ve beş bölümün dördünde başlık menüdeki addan farklıydı ("Otomatik kaydet"
 * → "Periyodik yedekleme", "Hakkında" → "MFSim"). Kapı: her bilgi KAYNAĞIYLA
 * karşılaştırılır — gömülü dosyanın künyesi, LICENSE, tip tanımları, menü.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const stubs = stubGlobals();
eval(loadSource('shortcuts-help.js'));
eval(loadSource('settings.js'));
beforeEach(() => { resetStubs(stubs); delete window.__MFSIM_BUILD; });

// index.html'deki Ayarlar penceresinin menüsü + içerik kabı, olduğu gibi.
function pencereKur() {
  const idx = oku('index.html');
  const nav = idx.match(/<nav class="ve-settings-nav"[\s\S]*?<\/nav>/)[0];
  document.body.innerHTML = '<div id="ve-settings-overlay">' + nav + '<section id="ve-settings-content"></section></div>';
  return [...document.querySelectorAll('.ve-settings-nav-item')].map((b) => [b.getAttribute('data-section'), b.textContent.trim()]);
}

describe('bölüm başlığı menüdeki ad', () => {
  test('beş bölümün beşinde başlık = menü adı', () => {
    const menu = pencereKur();
    expect(menu.length).toBe(5);
    menu.forEach(([k, ad]) => {
      veSettingsShowSection(k);
      const h = document.querySelector('#ve-settings-content h3.ve-settings-section-title');
      expect(`${k}: ${h && h.textContent}`).toBe(`${k}: ${ad}`);
    });
  });

  test('kaynakta elle yazılmış bölüm başlığı kalmadı', () => {
    expect(oku('js/settings.js')).not.toMatch(/<h3 class="ve-settings-section-title">[^'<]/);
  });
});

describe('Hakkında', () => {
  test('sürüm gömülü künyeden: commit · PR · tarih; künye yoksa bunu söyler, "dev" uydurmaz', () => {
    expect(_veSettingsSurum()).toMatch(/künye yok/);
    window.__MFSIM_BUILD = { shortSha: 'abc1234', prNumber: 1085, date: '2026-10-14T12:00:00Z' };
    expect(_veSettingsSurum()).toBe('abc1234 · PR #1085 · ' + new Date('2026-10-14T12:00:00Z').toLocaleDateString('tr-TR'));
    expect(oku('js/settings.js')).not.toMatch(/__mfsimVersion|'dev'/);
  });

  test('açıklama her modülü sayar (tip tanımlarından)', () => {
    global.componentDefs = {
      'arac-performans': { name: 'Araç Performans', isSubsystem: true },
      'mount-analysis': { name: 'Takoz Çökme-Titreşim', isSubsystem: true },
      'fead-analysis': { name: 'FEAD', isSubsystem: true },
      engine: { name: 'Motor' },
    };
    try {
      pencereKur();
      const html = _veSettingsRenderAbout();
      ['Araç Performans', 'Takoz Çökme-Titreşim', 'FEAD'].forEach((m) => expect(html).toContain(m));
      expect(html).not.toContain('Motor');
    } finally { delete global.componentDefs; }
  });

  test('lisans depodaki LICENSE ile aynı', () => {
    const lisans = oku('LICENSE').split('\n')[0].replace(/\s*License\s*$/i, '').trim();
    expect(VE_SETTINGS_LISANS).toBe(lisans);
  });

  test('bağımlılık sürümleri gömülü dosyaların kendi künyesiyle aynı', () => {
    const surum = Object.fromEntries(VE_SETTINGS_BAGIMLILIK.map((d) => [d[0], d[1]]));
    // Three.js: index.html'deki köken notu (build-freshness.test.js onu dosyaya bağlıyor)
    const three = oku('index.html').match(/three@(\d+)\.(\d+)\.(\d+)/);
    expect(surum['Three.js']).toBe(`r${three[2]} (${three[1]}.${three[2]}.${three[3]})`);
    expect(oku('vendor/plotly-gl3d.min.js').slice(0, 600)).toContain('v' + surum['Plotly.js'].split(' ')[0]);
    expect(oku('vendor/leaflet.js')).toContain('"' + surum.Leaflet + '"');
    expect(oku('css/fonts.css').slice(0, 400)).toContain('@fontsource/inter@' + surum.Inter);
    // KaTeX raporların varlık dosyasına base64 gömülü; sürüm kendi kodunda
    const a = oku('js/mount-report-assets.js'), i = a.indexOf('katexJsB64'), q = a.indexOf('"', i) + 1;
    const katex = Buffer.from(a.slice(q, a.indexOf('"', q)), 'base64').toString('utf8');
    expect(katex).toContain('version:"' + surum.KaTeX + '"');
    VE_SETTINGS_BAGIMLILIK.forEach((d) => expect(`${d[0]}: ${d[1]}`).not.toMatch(/: r0\.|: —$/));
  });

  test('soluk yazı opaklıkla değil jetonla (bağımlılık tablosunda satır içi opacity yok)', () => {
    pencereKur();
    expect(_veSettingsRenderAbout()).not.toMatch(/opacity/);
  });
});
