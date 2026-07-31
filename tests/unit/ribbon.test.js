/**
 * Şerit (ribbon) tanım bütünlüğü — js/ribbon.js
 * ─────────────────────────────────────────────
 * Şerit bildirimsel bir tablodan çizilir: her öğe bir global fonksiyon adına
 * ve bir ikon adına referans verir. İkisi de sessizce kırılır:
 *
 *   • `run` yanlış yazılırsa buton "devre dışı" çizilir — tıklayınca hiçbir
 *     şey olmaz, konsola da bir şey düşmez.
 *   • `icon` yanlış yazılırsa buton boş bir kutu olarak görünür.
 *
 * İkisi de gözle ancak o sekme açılıp o butona bakılırsa fark edilir. Tarayıcı
 * kontrolü yalnızca çizilen sekmeyi kapsar; bu test tüm sekmeleri kapsar.
 *
 * Çizim/DOM katmanı kasıtlı olarak test edilmez (CLAUDE.md test politikası).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../');
const JS_DIR = path.join(ROOT, 'js');

const { VE_RIBBON_TABS, veRibbonEsc, VE_RIBBON_ALWAYS_ON } = require('../../js/ribbon.js');

// js/ altındaki TÜM üst-seviye fonksiyon adları
const declaredFns = (() => {
  const set = new Set();
  fs.readdirSync(JS_DIR)
    .filter((f) => f.endsWith('.js'))
    .forEach((f) => {
      const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
      for (const m of src.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) set.add(m[1]);
      // window.X = function / var X = function
      for (const m of src.matchAll(/^\s*(?:var|window\.)\s*([A-Za-z_$][\w$]*)\s*=\s*function/gm)) set.add(m[1]);
    });
  return set;
})();

const iconNames = (() => {
  const css = fs.readFileSync(path.join(ROOT, 'css/icons.css'), 'utf8');
  return new Set([...css.matchAll(/mf-ico-([a-z0-9-]+)/g)].map((m) => m[1]));
})();

const allItems = () => {
  const out = [];
  VE_RIBBON_TABS.forEach((t) =>
    t.groups.forEach((g) => g.items.forEach((it) => out.push({ tab: t.id, group: g.label, item: it })))
  );
  return out;
};

describe('şerit tanımı — yapı', () => {
  test('en az bir sekme var (tanım kayması erken yakalansın)', () => {
    expect(VE_RIBBON_TABS.length).toBeGreaterThan(0);
    expect(allItems().length).toBeGreaterThan(10);
  });

  test('sekme kimlikleri benzersiz', () => {
    const ids = VE_RIBBON_TABS.map((t) => t.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test('her sekmenin etiketi ve en az bir grubu var', () => {
    const bad = VE_RIBBON_TABS.filter((t) => !t.label || !t.groups || t.groups.length === 0);
    expect(bad.map((t) => t.id)).toEqual([]);
  });

  test('her grubun etiketi ve en az bir öğesi var', () => {
    const bad = [];
    VE_RIBBON_TABS.forEach((t) =>
      t.groups.forEach((g) => {
        if (!g.label || !g.items || g.items.length === 0) bad.push(t.id + '/' + g.label);
      })
    );
    expect(bad).toEqual([]);
  });

  test('bağlamsal sekmenin `when` koşulu var — yoksa hep görünür kalırdı', () => {
    const ctx = VE_RIBBON_TABS.filter((t) => t.contextual);
    expect(ctx.length).toBeGreaterThan(0);
    expect(ctx.filter((t) => typeof t.when !== 'function').map((t) => t.id)).toEqual([]);
  });
});

describe('şerit tanımı — komut ve ikon referansları', () => {
  test('her öğenin etiketi, ikonu ve komutu var', () => {
    const bad = allItems()
      .filter(({ item }) => !item.label || !item.icon || !item.run)
      .map(({ tab, item }) => tab + '/' + (item.label || '?'));
    expect(bad).toEqual([]);
  });

  test('her `run` js/ içinde tanımlı bir fonksiyona işaret ediyor', () => {
    const missing = allItems()
      .filter(({ item }) => !declaredFns.has(item.run))
      .map(({ tab, item }) => tab + '/' + item.label + ' → ' + item.run);
    expect(missing).toEqual([]);
  });

  test('her `icon` css/icons.css içinde tanımlı', () => {
    const missing = allItems()
      .filter(({ item }) => !iconNames.has(item.icon))
      .map(({ tab, item }) => tab + '/' + item.label + ' → mf-ico-' + item.icon);
    expect(missing).toEqual([]);
  });

  test('`state` verilmişse fonksiyondur (aç/kapa göstergesi bozulmasın)', () => {
    const bad = allItems()
      .filter(({ item }) => item.state !== undefined && typeof item.state !== 'function')
      .map(({ tab, item }) => tab + '/' + item.label);
    expect(bad).toEqual([]);
  });

  test('`badge` verilmişse fonksiyondur (bildirim noktası çizilebilsin)', () => {
    const bad = allItems()
      .filter(({ item }) => item.badge !== undefined && typeof item.badge !== 'function')
      .map(({ tab, item }) => tab + '/' + item.label);
    expect(bad).toEqual([]);
  });

  test('`args` verilmişse dizidir (apply çağrısı patlamasın)', () => {
    const bad = allItems()
      .filter(({ item }) => item.args !== undefined && !Array.isArray(item.args))
      .map(({ tab, item }) => tab + '/' + item.label);
    expect(bad).toEqual([]);
  });

  test('size yalnızca lg / sm olabilir', () => {
    const bad = allItems()
      .filter(({ item }) => item.size !== 'lg' && item.size !== 'sm')
      .map(({ tab, item }) => tab + '/' + item.label + ' → ' + item.size);
    expect(bad).toEqual([]);
  });
});

describe('kaldırılan marka menüsünün komutları', () => {
  // Marka (MFSim) menüsü kaldırıldı; şerit tek komut yüzeyi. Menüdeki her komut
  // şeride taşınmış olmalı — biri düşerse KULLANICI O KOMUTA ULAŞAMAZ. "Çıkış
  // Yap" özellikle kritik: başka hiçbir yüzeyde yok (komut paletinde de).
  const allRuns = new Set(
    VE_RIBBON_TABS.flatMap((t) => t.groups.flatMap((g) => g.items.map((i) => i.run)))
  );

  test.each([
    'veNewProject',
    'veLoadTopology',
    'veSaveTopology',
    'veExportTopology',
    'veClearAll',
    'veOpenStatusModal',
    'veOpenSettings',
    'veShortcutsHelpOpen',
    'veGame2048Open',
    'mfsimLogout'
  ])('%s şeritte var', (run) => {
    expect(allRuns.has(run)).toBe(true);
  });

  test('çıkış, modül seçim ekranında da etkin (muafiyet listesinde)', () => {
    expect(VE_RIBBON_ALWAYS_ON).toContain('mfsimLogout');
  });
});

describe('çalışma alanı yokken pasifleşme muafiyet listesi', () => {
  // Modül seçim ekranında şeridin TAMAMI pasif çizilir; yalnızca bu listedeki
  // komutlar etkin kalır. Liste komut ADLARINI tutar — bir komut yeniden
  // adlandırılırsa liste sessizce eşleşmeyi kaybeder ve "Yeni Proje" de pasif
  // olur: kullanıcı hiçbir şey yapamaz hâle gelir. Bu test o sessiz kırılmayı
  // yakalar.
  const allRuns = new Set(
    VE_RIBBON_TABS.flatMap((t) => t.groups.flatMap((g) => g.items.map((i) => i.run)))
  );

  test('muaf komutların tümü şeritte gerçekten var', () => {
    const missing = VE_RIBBON_ALWAYS_ON.filter((r) => !allRuns.has(r));
    expect(missing).toEqual([]);
  });

  test('proje oluşturma ve açma her hâlükârda muaf', () => {
    expect(VE_RIBBON_ALWAYS_ON).toEqual(expect.arrayContaining(['veNewProject', 'veLoadTopology']));
  });

  test('çalışma alanı gerektiren komutlar muaf değil', () => {
    ['veSaveTopology', 'veSolverRun', 'veSolverValidate', 'veTidyLayout'].forEach((run) => {
      expect(VE_RIBBON_ALWAYS_ON).not.toContain(run);
    });
  });
});

describe('veRibbonEsc — etiketler HTML olarak enjekte edilir', () => {
  test('açılı ayraç ve tırnak kaçırılır', () => {
    expect(veRibbonEsc('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });

  test('& tek sefer kaçırılır (çift kaçırma olmasın)', () => {
    expect(veRibbonEsc('a & b')).toBe('a &amp; b');
  });

  test('boş / tanımsız değer boş dizge', () => {
    expect(veRibbonEsc(null)).toBe('');
    expect(veRibbonEsc(undefined)).toBe('');
  });
});
