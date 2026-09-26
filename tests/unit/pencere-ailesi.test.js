/**
 * pencere-ailesi.test.js — BÜTÜN PENCERELER TEK AİLE (doku haritası K6)
 * ───────────────────────────────────────────────────────────────────────────
 * Ölçülen kusur: pencereler üç ayrı başlık diliyle çiziliyordu — beş pencere
 * `.ve-settings-header` (26 px bant, 13 px başlık, ✕ yazı karakteri),
 * Kısayollar · Kılavuzlar · Program Arşivi `.ve-help-head` (63 px, 16 px
 * başlık, 30 px elle SVG), Çözücü satır içi (40 px, 2 px çizgi, sabit gölge),
 * Tablo penceresi kendi başlığı (26 px elle SVG). Başlık ikonu şeritteki
 * girişinkiyle iki pencerede ayrışıyordu (Ayarlar, Program Durumu) ve FEAD
 * sihirbazının başlığı bir emojiydi.
 *
 * Hüküm: her pencere ORTAK başlığı taşır (bant `--bant-h`, başlık yazısı
 * kabuk bandınınki, kapat 22 px çizgi ikon); başlık ikonu pencereyi açan şerit
 * girişinin ikonudur. Hedef ölçü 26 px: aynı gün kayda geçen kullanıcı kararı
 * ("başlığın olduğu header kısmı boyuna çok büyük").
 *
 * Gerçek tarayıcıdaki karşılığı: tests/e2e/pencere-ailesi.spec.js.
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
const CSS = oku('css/styles.css');
const HTML = oku('index.html');
const KAYNAK = { 'index.html': HTML, 'viewer/index.html': oku('viewer/index.html') };
fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js'))
  .forEach((f) => { KAYNAK['js/' + f] = oku('js/' + f); });

// Tek seçicili kuralın gövdesi — girintili yazılmış olsa da.
function kural(sec) {
  const kac = sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = CSS.match(new RegExp('(?:^|\\n)\\s*' + kac + '\\s*\\{([^}]*)\\}'));
  return m ? m[1].replace(/\s+/g, ' ') : null;
}
const bildirim = (k, ad) => {
  const m = (k || '').match(new RegExp('(?:^|[;{\\s])' + ad + ':\\s*([^;]+);'));
  return m ? m[1].trim() : null;
};

// Kaynaktaki her pencere kapat düğmesi: açılış etiketinden </button>'a.
function kapatlar() {
  const out = [];
  for (const [dosya, s] of Object.entries(KAYNAK)) {
    const re = /class="(?:ve-settings-close|ve-properties-close)[^"]*"/g;
    let m;
    while ((m = re.exec(s))) {
      const son = s.indexOf('</button>', m.index);
      out.push({ dosya, govde: s.slice(m.index, son) });
    }
  }
  return out;
}

describe('kapat düğmesi TEK biçim', () => {
  test('her pencerenin kapatı çizgi ikon; yazı karakteri ya da elle SVG yok', () => {
    const k = kapatlar();
    // Beş pencere + Özellikler + görüntüleyici + yardım ailesi (3) + Tablo +
    // Çözücü + iki bildirim: tarama BOŞA çalışmıyor.
    expect(k.length).toBeGreaterThanOrEqual(14);
    const sapan = k.filter((x) => !/mf-ico-x/.test(x.govde) || /✕|×|<svg/.test(x.govde))
      .map((x) => x.dosya + ': ' + x.govde.slice(0, 60));
    expect(sapan).toEqual([]);
  });

  test('iki kapat sınıfı aynı ölçü: 22 px kutu, aynı ikon boyu, aynı köşe', () => {
    const a = kural('.ve-settings-close'), b = kural('.ve-properties-close');
    for (const ad of ['width', 'height', 'font-size', 'border-radius']) {
      expect([ad, bildirim(a, ad)]).toEqual([ad, bildirim(b, ad)]);
    }
    expect(bildirim(a, 'width')).toBe('22px');
    expect(kural('.ve-settings-close:focus-visible')).toMatch(/--focus-ring/);
    expect(kural('.ve-properties-close:focus-visible')).toMatch(/--focus-ring/);
  });
});

describe('başlık TEK bileşen', () => {
  test('eski başlık dilleri kalmadı (yardım başlığı, tablo kapatının görünümü)', () => {
    const eski = Object.entries(KAYNAK).filter(([, s]) => /ve-help-head|ve-help-close/.test(s)).map(([f]) => f);
    expect(eski).toEqual([]);
    expect(CSS).not.toMatch(/\.ve-help-head|\.ve-help-close/);
    expect(kural('.ve-tablo-kapat')).toBeNull();
    expect(kural('.ve-tablo-bas')).toBeNull();
  });

  test('ortak başlığı kuran her pencere', () => {
    for (const f of ['js/shortcuts-help.js', 'js/guide-kit.js', 'js/cp-programlar.js',
      'js/tablo-pencere.js', 'js/solver-pro.js']) {
      expect([f, /ve-settings-header/.test(KAYNAK[f])]).toEqual([f, true]);
    }
    expect(HTML.match(/class="ve-settings-header"/g)).toHaveLength(5);
  });

  test('başlık yazısı kabuk bandınınki (Bileşenler · müfettiş)', () => {
    const pen = kural('.ve-settings-header');
    for (const sec of ['.ve-sidebar-header', '.ve-properties-header']) {
      expect([sec, bildirim(kural(sec), 'font-size')]).toEqual([sec, bildirim(pen, 'font-size')]);
      expect([sec, bildirim(kural(sec), 'font-weight')]).toEqual([sec, bildirim(pen, 'font-weight')]);
    }
    expect(pen).toMatch(/min-height:\s*var\(--bant-h\)/);
  });

  test('çözücü penceresi jeton konuşur: perde, gölge, tek çizgi', () => {
    const s = KAYNAK['js/solver-pro.js'];
    expect(s).toMatch(/overlay\.style\.cssText = '[^']*background:var\(--scrim\)/);
    expect(s).toMatch(/modal\.style\.cssText = '[^']*box-shadow:var\(--shadow-xl\)/);
    expect(s).toMatch(/modal\.style\.cssText = '[^']*border:1px solid/);
    expect(s).not.toMatch(/backdrop-filter:blur/);
  });
});

describe('başlık ikonu onu açan şerit girişinin ikonu', () => {
  // run → ikon, şeritten (js/ribbon.js) okunur: ikinci bir liste tutulmaz.
  const SERIT = {};
  (KAYNAK['js/ribbon.js'].match(/icon:'[a-z-]+',[^}]*?run:'[A-Za-z]+'/g) || []).forEach((g) => {
    SERIT[g.match(/run:'([A-Za-z]+)'/)[1]] = g.match(/icon:'([a-z-]+)'/)[1];
  });
  const ilkIkon = (s, iz) => {
    const i = s.indexOf(iz);
    if (i < 0) return null;
    const m = s.slice(i).match(/mf-ico mf-ico-([a-z-]+)/);
    return m ? m[1] : null;
  };
  const PENCERE = [
    ['Ayarlar', 'index.html', 'id="ve-settings-title"', 'veOpenSettings'],
    ['Program Durumu', 'index.html', 'id="ve-status-title"', 'veOpenStatusModal'],
    ['Komuta', 'index.html', 'id="ve-komuta-title"', 'veKomutaAc'],
    ['İçe Aktarma', 'index.html', 'id="ve-import-title"', 'veImpOpenPicker'],
    ['Özellikler', 'index.html', 'id="ve-properties-title"', 'veTogglePropertiesPanel'],
    ['Özellikler (açılışta yeniden yazılan)', 'js/cp-core.js', "getElementById('ve-properties-title')", 'veTogglePropertiesPanel'],
    ['Kısayollar', 'js/shortcuts-help.js', 've-settings-header', 'veShortcutsHelpOpen'],
    ['Kılavuzlar', 'js/guide-kit.js', 've-settings-header', 'veGuideKitOpen'],
    ['Program Arşivi', 'js/cp-programlar.js', 've-settings-header', 'veProgramArsiviOpen'],
    ['Çözücü', 'js/solver-pro.js', "header.className = 've-settings-header'", 'veSolverRun'],
  ];
  test.each(PENCERE)('%s', (ad, dosya, iz, run) => {
    expect(SERIT[run]).toBeTruthy();
    expect(ilkIkon(KAYNAK[dosya], iz)).toBe(SERIT[run]);
  });

  test('her başlık bir çizgi ikonla başlar (emoji yok)', () => {
    const basliklar = HTML.match(/<div class="ve-settings-header">\s*<span[^>]*>[^<]*<?/g) || [];
    expect(basliklar).toHaveLength(5);
    basliklar.forEach((b) => expect(b).toMatch(/<span[^>]*>\s*<$/));
    expect(HTML).toMatch(/id="ve-fw-title"><span class="mf-ico mf-ico-wand"><\/span>/);
  });
});
