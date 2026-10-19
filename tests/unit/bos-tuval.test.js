/**
 * bos-tuval.test.js — BOŞ TUVAL (yönlendirme yuvası, kullanıcı kararı 2026-10-19)
 * ───────────────────────────────────────────────────────────────────────────
 * Metin temizliği (aşama 1, kaydgn/MFSim#1129) boş tuval ipucunu kaldırdı ve
 * araştırma turu boş tuvalde 0 metin ölçtü: modülleri silen ya da karşılamayı
 * kapatan kullanıcının önünde ne durum ne yol vardı. Takoz'un "Boş kanvas"
 * kapısının bildirimi de aşama 6'da (kaydgn/MFSim#1143) kalkmıştı.
 * Kapılar: görünürlük kapsamdan ve modelden türer (bayrak yok), metin yuvadan
 * (veYon) ve biçime uyar, kısayol satırı kısayol penceresinin listesinden.
 */
const path = require('path');
const T = require('../../tools/metin-dili.js');

const stubs = stubGlobals();
eval(loadSource('shortcuts-help.js'));
global._veHelpGroups = _veHelpGroups;
global.componentDefs = {
  'ap-example': { isApExample: true }, 'mnt-example': { isMountExample: true },
  engine: {}, 'mnt-motor': {}, 'mnt-mount': {}, 'mnt-solver': {}, 'mnt-report': {}, 'fead-layout': {}
};
global.VE_MNT_ARAC_TIPLERI = ['mnt-solver', 'mnt-report'];
const B = require('../../js/bos-tuval.js');
beforeEach(() => resetStubs(stubs));

const d = (type) => ({ id: type + Math.random(), type });

describe('görünürlük kapsamdan ve modelden', () => {
  test('kök: yalnız hiç düğüm yokken', () => {
    expect(B.veBosTuvalKapsami('top', [])).toBe('top');
    expect(B.veBosTuvalKapsami('top', [d('arac-performans')])).toBeNull();
  });
  test('Araç Performans: yalnız "Başlangıç ve Örnekler" varken de boş', () => {
    expect(B.veBosTuvalKapsami('arac-performans', [])).toBe('arac-performans');
    expect(B.veBosTuvalKapsami('arac-performans', [d('ap-example')])).toBe('arac-performans');
    expect(B.veBosTuvalKapsami('arac-performans', [d('ap-example'), d('engine')])).toBeNull();
  });
  test('Takoz: analiz araçları boş sayılır, gövde ya da takoz değil; başlangıç sayfası açıkken yazı yok', () => {
    const araclar = [d('mnt-solver'), d('mnt-report')];
    expect(B.veBosTuvalKapsami('mount-analysis', araclar, false)).toBe('mount-analysis');
    expect(B.veBosTuvalKapsami('mount-analysis', araclar.concat(d('mnt-example')), false)).toBe('mount-analysis');
    expect(B.veBosTuvalKapsami('mount-analysis', araclar.concat(d('mnt-motor')), false)).toBeNull();
    expect(B.veBosTuvalKapsami('mount-analysis', araclar.concat(d('mnt-mount')), false)).toBeNull();
    expect(B.veBosTuvalKapsami('mount-analysis', [], true)).toBeNull();
  });
  test('FEAD: hiçbir zaman — başlangıç sayfası ve çizim masası kendi yolunu taşır', () => {
    expect(B.veBosTuvalKapsami('fead-analysis', [])).toBeNull();
    expect(B.veBosTuvalKapsami('fead-analysis', [d('fead-layout')])).toBeNull();
  });
});

describe('metin: durum + tek yönlendirme', () => {
  test.each(Object.keys(B.VE_BOS_TUVAL))('%s: yönlendirme biçime uyar, durum kısa ad', (k) => {
    const kayit = B.VE_BOS_TUVAL[k];
    expect(T.yonBicim(kayit.yon)).toEqual([]);
    expect(T.isaretle(kayit.durum, 'arayuz')).toEqual([]);
    expect(T.sozcukSay(kayit.durum)).toBeLessThanOrEqual(3);
  });
  test('kaynakta yönlendirme yuvadan geçiyor (veYon) — tarayıcı onu "yon" bağlamında ölçer', () => {
    const m = T.metinler('js/bos-tuval.js').filter((x) => x.baglam === 'yon');
    expect(m.map((x) => x.metin).sort()).toEqual(Object.values(B.VE_BOS_TUVAL).map((k) => k.yon).sort());
    m.forEach((x) => expect(x.isaret).toEqual([]));
  });
  test('kısayol satırı kısayol penceresinin listesinden; komut paleti YOK (üst bant gösteriyor)', () => {
    const html = B.veBosTuvalHTML('top');
    const kayit = _veHelpGroups().flatMap((g) => g.items).find((it) => it.label === 'Klavye kısayolları');
    expect(html).toContain('<kbd>' + kayit.keys[0] + '</kbd> Klavye kısayolları');
    expect(html).not.toContain('Komut paleti');
    expect(B.veBosTuvalHTML('mount-analysis')).not.toContain('kbd');
  });
});

describe('DOM: tuval kabında, tazelemede', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ve-canvas-wrapper"></div>';
    global.veSidebarScope = 'top';
    global.nodes = [];
  });
  test('boş kökte kurulur, düğüm gelince gizlenir, giden düğümle geri gelir', () => {
    expect(B.veBosTuvalTazele()).toBe('top');
    const el = document.getElementById('ve-bos-tuval');
    expect(el.hidden).toBe(false);
    expect(el.textContent).toContain('Tuval boş');
    global.nodes = [d('arac-performans')];
    expect(B.veBosTuvalTazele()).toBeNull();
    expect(el.hidden).toBe(true);
    global.nodes = [];
    B.veBosTuvalTazele();
    expect(el.hidden).toBe(false);
  });
  test('düğüm varken (örnek kartı, analiz araçları) yazı alta iner', () => {
    global.veSidebarScope = 'arac-performans';
    global.nodes = [d('ap-example')];
    expect(B.veBosTuvalTazele()).toBe('arac-performans');
    expect(document.getElementById('ve-bos-tuval').classList.contains('ve-bos-tuval--alt')).toBe(true);
  });
  test('kurulum ve tazeleme çağrıları: kapsam değişimi ve topoloji değişimi', () => {
    const fs = require('fs');
    const oku = (f) => fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8');
    expect(oku('map.js')).toMatch(/function updateNodeCount\(\)[\s\S]*?veBosTuvalTazele\(\)/);
    expect(oku('components.js')).toMatch(/function veSyncSidebarScope\(\)[\s\S]*?veBosTuvalTazele\(\)/);
    expect(fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8')).toMatch(/<script[^>]+src="js\/bos-tuval\.js"/);
  });
});
