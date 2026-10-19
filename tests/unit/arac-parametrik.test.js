/**
 * arac-parametrik.test.js — Araç Performans'ın Parametrik Analiz'i PALETTE YOK
 * ───────────────────────────────────────────────────────────────────────
 * Kullanıcı kararı (2026-10-19, Metin Ekleme D6 → "Paletten kaldır"): bileşen
 * yarım kalmıştı — parametre ekleme düğmesi (`veAddParametricParam`'ın "ⓟ"
 * çağıranı) programın hiçbir sürümünde yazılmadı, eklenen parametreleri
 * koşturan hesap da yok; pencere hep "Parametre yok" gösteriyordu. Özellik
 * kurulana kadar tuvale konamaz. Komut paleti bileşen listesini paletten okur
 * (`command-palette.js`), yani palet girişi ikisinin TEK kapısı.
 *
 * Tanım ve pencere DURUR: eski kayıttaki `parametric` düğümü yine açılır.
 * Takoz'un Parametrik Analiz'i (`mnt-parametric`) ayrı bileşendir, palette kalır.
 * Karar kaydı: arac-performans skill'i → references/acik-ayrismalar.md (5).
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
const paletTipleri = [...html.matchAll(/class="ve-component[^"]*"[^>]*data-type="([^"]+)"/g)].map((m) => m[1]);

const stubs = stubGlobals();
eval(loadSource('components.js'));
beforeEach(() => resetStubs(stubs));

test('Araç Performans paletinde ve komut paletinin kaynağında Parametrik Analiz yok', () => {
  expect(paletTipleri.length).toBeGreaterThan(20);
  expect(paletTipleri).not.toContain('parametric');
  const cp = fs.readFileSync(path.join(KOK, 'js/command-palette.js'), 'utf8');
  expect(cp).toContain("querySelectorAll('.ve-component[data-type]')");
});

test('eski kayıttaki düğüm açılır: tanım ve pencere duruyor', () => {
  expect(componentDefs.parametric).toBeDefined();
  expect(componentDefs.parametric.name).toBe('Parametrik Analiz');
  const core = fs.readFileSync(path.join(KOK, 'js/cp-core.js'), 'utf8');
  expect(core).toMatch(/node\.type === 'parametric'\)\s*\{\s*html \+= getParametricPropertiesHTML\(node\)/);
});

test('Takoz’un Parametrik Analiz’i palette kalır', () => {
  expect(paletTipleri).toContain('mnt-parametric');
});
