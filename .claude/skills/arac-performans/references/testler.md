# Araç Performans testleri — 27 dosya

Tam tablo `docs/decisions/testler.md` ve `CLAUDE.md`'de; burada **hangi kapıyı
ne zaman koşturacağın** var.

## Modülü testte yükleme kalıbı

`FT_SOLVER` bir IIFE ve `js/ft-performance.js` `module.exports` guard'ı
taşımıyor — tek başına `require` edilemez. Depodaki bütün FT testleri aynı
diziyi kullanıyor:

```js
const stubs = stubGlobals();
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
// bazıları ayrıca: global.window = { addEventListener: function(){} };
eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));
beforeEach(() => resetStubs(stubs));
```

`js/cp-arac-performans.js` ve `js/mount-core.js` guard taşıyor → doğrudan
`require('../../js/mount-core.js')`.

> Not: bu dizideki `numerics.js` FT çözücüsü için **gereksiz** (FT ondan hiçbir
> şey kullanmıyor), ama `pchip-uc-kopya.test.js` gibi üç kopyayı karşılaştıran
> testlerde gerekli. Kalıbı korumak zararsız; kopyalarken bunu bil.

## Hangi değişiklikte hangi kapı

| Neye dokundun | Önce koştur |
|---|---|
| Interpolasyon (`pchipCreate`, `_pchipEndSlope`, `veBuildPchipSpline`, `buildMonotoneCubic`) | `pchip-uc-kopya` → `arac-example-calibration` |
| Motor tork fonksiyonu, droop, konvertör eğrileri | `arac-example-calibration` → `arac-performans-shift-*` |
| Vites geçiş mantığı, profiller | `arac-performans-shift-4500sp` · `-2957sp` · `-governed` · `-hunt` |
| Dişli verimi, kayıplar | `gear-efficiency` → `arac-example-calibration` |
| Örnek JSON'ları | `arac-example-data` (girdi) + `arac-example-layout` (yerleşim) + `arac-example` (yapı) |
| Şanzıman/konvertör seçim çözümü | `matching-selection` |
| Yol eğimi, dinamik | `simulation-engine-grade` |
| Girdi doğrulama, NaN kapıları | `arac-performans-nan-guard` |
| Rapor üreticileri | `arac-performans-calc-trace-report` · `-notc-report` |

**Çözücünün sayısını değiştiren her şeyde `arac-example-calibration` beklenen
sonuçtur** — 13 araç, stall devri, tavan hız, 0-20/40/60/80 çıpaları,
81 vites geçiş noktası. Kırmızıya dönerse `references/kalibrasyon.md`'yi aç.

## E2E

`tests/e2e/arac-performans.spec.js` — gerçek tarayıcı. **CI'da koşmuyor**
(PR'da yalnız `published` · `viewer` · `can-cozumleyici` koşuyor), yerelde
`npx playwright test tests/e2e/arac-performans.spec.js` ile koşturulur.
