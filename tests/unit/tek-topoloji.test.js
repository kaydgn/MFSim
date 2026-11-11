/**
 * tek-topoloji.test.js — PROGRAM TEK TOPOLOJİYLE ÇALIŞIR (Canlı Not 87 · 89 · 90)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı (2026-11-09, Canlı Not 87): "Programda genel olarak tek bir topoloji
 * üzerinden ilerliyoruz. Yan yana ek topolojiler açıp sistem kurmuyoruz. O yüzden
 * bu topoloji pencere mantığını tamamen kaldıralım programdan. Bu görüntüyü de
 * kaldıralım."
 *
 * Önce: tuvalin üstünde sekme şeridi ("Topoloji 1 (1) +"), sekme ekleme · kapatma ·
 * adlandırma · çoğaltma · sağ tık menüsü ve sekmeyi sürükleyip bölünmüş (yan yana)
 * görünüm; uyarı paneli o bandın altında tuvalin tamamı eninde açılıyordu.
 * Şimdi: `veTabs` içte TEK elemanlı kap (kaydetme biçimi `tabs:[…]` aynı); çok
 * sekmeli eski proje yüklenince yalnız etkin topoloji kurulur ve durum söylenir.
 * Çizimin kendisi: kabuk-sutun.spec.js → "TEK TOPOLOJİ" · "RAY TAM BOY".
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
const TOPO = oku('js/topology.js');

// Kaynaktan TEK bir üst seviye işlevi çıkarır (gövdesi dengeli süslü parantezle).
function islev(kaynak, ad) {
  const i = kaynak.indexOf('function ' + ad + '(');
  if (i < 0) return null;
  let d = 0, j = kaynak.indexOf('{', i);
  for (; j < kaynak.length; j++) {
    if (kaynak[j] === '{') d++;
    else if (kaynak[j] === '}' && --d === 0) break;
  }
  return kaynak.slice(i, j + 1);
}

describe('TEK TOPOLOJİ — sekme ve yan yana görünüm yok', () => {
  test('sekme ve bölünmüş görünüm işlevleri programda tanımlı değil, çağrılmıyor', () => {
    const yasak = ['veSwitchTab', 'veCloseTab', 'veRenameTab', 'veDuplicateTab', 'veShowTabMenu',
      'veRenderTabs', 'veActivateSplit', 'veCloseSplit', 'veCreateSplitDOM', 'veFocusPane', 'veRenderSnapshot'];
    const dosyalar = fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
    const bulunan = [];
    dosyalar.concat(['index.html']).forEach((f) => {
      const s = oku(f);
      yasak.forEach((ad) => { if (new RegExp('\\b' + ad + '\\b').test(s)) bulunan.push(f + ' → ' + ad); });
    });
    expect(bulunan).toEqual([]);
    expect(TOPO).not.toMatch(/veSplitMode|veSplitPanes/);
  });

  test('sayfada sekme şeridi ve belge bandı yok; durum şeridi ve Uyarılar paneli de yok (Canlı Not 129)', () => {
    const HTML = oku('index.html');
    expect(HTML).not.toMatch(/id="ve-tab-bar"|id="ve-doc-dock"|class="ve-tab\b/);
    expect(HTML).not.toMatch(/id="ve-status-bar"|id="ve-warnings-panel"|id="ve-warnings-chip"/);
  });
});

describe('veTekTopoloji — kayıttan ETKİN sekme', () => {
  const sec = new Function(islev(TOPO, 'veTekTopoloji') + '\nreturn veTekTopoloji;')();
  test('etkin sekme seçilir, kalanlar sayılır', () => {
    const t = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    expect(sec({ tabs: t, activeTabIdx: 1 })).toEqual({ tab: t[1], atlanan: 2 });
    expect(sec({ tabs: t })).toEqual({ tab: t[0], atlanan: 2 });                 // indeks yok → ilki
    expect(sec({ tabs: t, activeTabIdx: 9 })).toEqual({ tab: t[2], atlanan: 2 }); // taşan indeks → sonuncusu
    expect(sec({ tabs: [t[0]], activeTabIdx: 0 })).toEqual({ tab: t[0], atlanan: 0 });
  });
});

describe('yedekten dönüş — çok sekmeli eski kayıt tek topoloji kurar', () => {
  test('yalnız etkin sekme yüklenir; kalan sayısı durum olarak söylenir', () => {
    const SET = oku('js/settings.js');
    const toast = jest.fn(), yukle = jest.fn();
    const g = {
      veTabs: [], veTabCounter: 0, veActiveTabIdx: 0, veActiveModule: '', veProjectName: '',
      showToast: toast, veLoadTabState: yukle,
      veTekTopoloji: new Function(islev(TOPO, 'veTekTopoloji') + '\nreturn veTekTopoloji;')(),
      veTekTopolojiBildir: null,
    };
    g.veTekTopolojiBildir = new Function('showToast', islev(TOPO, 'veTekTopolojiBildir') + '\nreturn veTekTopolojiBildir;')(toast);
    const kur = new Function(...Object.keys(g), islev(SET, '_veSettingsApplyProjectData')
      + '\nvar s = _veSettingsApplyProjectData(arguments[arguments.length-1]);'
      + '\nreturn { s: s, veTabs: veTabs, veActiveTabIdx: veActiveTabIdx, veTabCounter: veTabCounter };');
    const veri = { version: 2, activeTabIdx: 1, tabCounter: 3, tabs: [
      { id: 'tab-1', name: 'Topoloji 1', state: { nodes: [1] } },
      { id: 'tab-2', name: 'Topoloji 2', state: { nodes: [1, 2] } },
      { id: 'tab-3', name: 'Topoloji 3', state: { nodes: [] } }] };
    const r = kur(...Object.values(g), veri);
    expect(r.s).toBe(true);
    expect(r.veTabs.map((t) => [t.id, t.name, t.nodeCount])).toEqual([['tab-2', 'Topoloji 2', 2]]);
    expect([r.veActiveTabIdx, r.veTabCounter]).toEqual([0, 1]);
    expect(yukle).toHaveBeenCalledWith(r.veTabs[0]);
    expect(toast).toHaveBeenCalledWith('Projedeki 3 topolojiden yalnız "Topoloji 2" açıldı.', 'warning');
  });
});
