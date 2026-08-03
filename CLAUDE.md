# MFSim - Claude Code Talimatları

## Proje Yapısı
Tarayıcı tabanlı Motor Fren Simülasyonu uygulaması (saf HTML/CSS/JS, framework yok).

- `index.html` — Ana sayfa (modüler versiyon, js/ klasöründen script yükler)
- `MFSim_Code.html` — Tek dosya versiyonu (otomatik üretilir, elle düzenlenmez, **git'e dahil değil** — `npm run build` üretir, CI deploy Pages'e yayınlar)
- `js/` — Modüler JavaScript dosyaları
- `css/` — Stiller
- `build.js` — Build script (`index.html` + `js/` + `css/` → `MFSim_Code.html`)
- `tests/unit/` — Jest birim testleri
- `tests/e2e/` — Playwright E2E testleri

**ÖNEMLİ:** Kod değişiklikleri **yalnızca** `js/` ve `css/` klasörlerindeki modüler dosyalara ve `index.html`'e yapılır. `MFSim_Code.html` dosyası **elle düzenlenmez** — `npm run build` ile otomatik üretilir.

## Çalışma Akışı (hızlı döngü)

Amaç: her küçük değişikliği build+tüm-test töreni yapmadan geliştirmek.
Önemli gerçek: **birim testler build'e ihtiyaç duymaz** — testler doğrudan
`js/` dosyalarını yükler, `MFSim_Code.html`'e dokunmaz. Build yalnızca
E2E ve deploy için gerekir.

### Geliştirirken: watch modu (döngünün merkezi)
```bash
npm run test:watch      # arka planda açık kalsın; kaydettikçe İLGİLİ testler <1s'de koşar
```
Bu terminali açık bırak. Dosyayı kaydet → sadece değişimden etkilenen testler
otomatik koşar. Elle `npm run build` / `npm test` döngüsü YOK.

Watch modu yoksa, yalnızca değişen dosyalara bağlı testler:
```bash
npm run test:changed    # jest -o — git'te değişen dosyalarla ilgili testler
```

### Commit'ten HEMEN ÖNCE (tek sefer)
```bash
npm run build           # MFSim_Code.html üret
npm test                # tüm birim testleri (sessiz)
```
İkisi de yeşilse commit et (build çıktısı dahil). Yani build ve tam test
her düzenlemede değil, **commit başına bir kez** çalışır.

### E2E (opsiyonel, yalnızca UI akışını etkileyen değişikliklerde)
```bash
npm run test:e2e        # Chromium gerekir: npx playwright install chromium
```

## Test Politikası — hangi değişikliğe test yazılır?

Amaç: "her fonksiyona test" değil, **değer başına test**. Kırılgan testler
her UI rötuşunda kırılıp süreci uzatır.

**Test YAZ (yüksek değer):** mantık, matematik, sayısal çekirdek, veri
dönüşümü, durum yönetimi. Örnek: `numerics` (RK45/PCHIP), `mount-core`,
`solver`, `state` (undo/redo), kaydetme/serileştirme, topoloji tarama.
Bunlarda sessiz bir regresyon "makul ama yanlış" sonuç üretir; gözle
yakalanmaz — testin karşılığı burada.

**Test YAZMA (düşük değer / kırılgan):** yalnızca HTML string üreten sunum
fonksiyonları için `expect(html).toContain('...etiket/id...')` testleri.
Bunlar bir etiketi değiştirince kırılır, davranışı değil detayı test eder.
Gerekiyorsa panel başına **tek** bir "üretiliyor mu / patlamıyor mu" smoke
testi yeter; her alan/etiket için ayrı assertion açma.

### Yeni birim testi yazma şablonu

Ortak boilerplate `tests/helpers/setup.js`'te merkezi (jest `setupFiles`):
`loadSource()`, `stubGlobals()`, `resetStubs()` her test dosyasında hazır.

```js
// module.exports guard'ı olan modül → doğrudan require:
const core = require('../../js/mount-core.js');

// Üst-seviye (global) fonksiyon bildiren modül → stub + eval:
const stubs = stubGlobals();            // showToast/saveState/... = jest.fn()
eval(loadSource('sensors.js'));         // üst-seviye fonksiyonlar test kapsamına gelir
beforeEach(() => resetStubs(stubs));
```

Referans örnek: `tests/unit/sensors.test.js`.

## Test Dosyaları

| Dosya | Test Edilen Modül | Kapsam |
|-------|-------------------|--------|
| `tests/unit/numerics.test.js` | `js/numerics.js` | PCHIP spline, RK45 solver, enerji dengesi |
| `tests/unit/canvas-space.test.js` | `js/canvas-space.js` | Sonsuz ızgara deseni, "ev" kamerası, topoloji ortalama |
| `tests/unit/example-topology-center.test.js` | `js/cp-mount.js` + `assets/examples/` | Örnek JSON'ları kanvas merkezine açar |
| `tests/unit/state.test.js` | `js/state.js` | Undo/redo stack yönetimi |
| `tests/unit/toolbar-save.test.js` | `js/toolbar.js` | Proje kaydetme, JSON serileştirme, showSaveFilePicker |
| `tests/e2e/app.spec.js` | Tüm uygulama | Sayfa yükleme, menüler, bileşen ekleme, kaydetme |

## Sık Kullanılan Komutlar

```bash
npm run test:watch          # ★ geliştirme döngüsü — kaydettikçe ilgili testler koşar
npm run test:changed        # git'te değişen dosyalarla ilgili testler (jest -o)
npm test                    # tüm birim testleri (sessiz) — commit öncesi
npm run test:ci             # tüm birim testleri (--verbose --ci) — CI logları için
npm run build               # MFSim_Code.html üret (modüler → monolitik) — commit/deploy öncesi
npm run test:e2e            # E2E testleri (Chromium gerekli)
npm run test:all            # birim + E2E
```

## Teslim Akışı — PR + merge OTOMATİK

Kullanıcı talimatı (2026-07-31): **her güncellemeden sonra PR aç ve merge et.**
Ayrıca sorma, ayrıca onay bekleme.

Sıra — her adım bir öncekine KAPI:

```bash
npm run build     # MFSim_Code.html üret
npm test          # tüm birim testleri
```

1. `npm run build` + `npm test` **ikisi de yeşil** olmadan commit YOK.
2. Commit → `git push -u origin <dal>`
3. PR aç (gövdede: sorun, kök neden, ölçüm, test, doğrulama)
4. **Merge et** (`merge` yöntemi — depo geçmişi merge commit'i kullanıyor)
5. CI'ı izle (`main`'e push'ta koşar, PR'da KOŞMAZ) ve sonucu kullanıcıya bildir

**Kapı kuralı:** testler kırmızıysa ya da build patlıyorsa merge etme —
durumu kullanıcıya söyle. "Otomatik merge" testleri atlamak demek değil;
tören kısaltılıyor, doğrulama kısaltılmıyor.

Yeşil testler tek başına "düzeldi" demek değildir: kullanıcının bildirdiği
senaryo birebir yeniden üretilip ESKİ kodda kırıldığı, YENİ kodda geçtiği
ölçülmeden sonuç kesin dille sunulmaz.
