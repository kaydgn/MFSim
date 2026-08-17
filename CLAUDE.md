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
- `viewer/` — **Ölçüm Görüntüleyici** (ayrı program, bkz. `viewer/README.md`)
- `MFSim_Olcum_Goruntuleyici.html` — Görüntüleyicinin tek dosya çıktısı (`npm run build:viewer` üretir; MFSim_Code.html'in aksine **git'e dahil** — dağıtımı bu dosyanın indirilmesiyle oluyor)

**ÖNEMLİ:** Kod değişiklikleri **yalnızca** `js/` ve `css/` klasörlerindeki modüler dosyalara ve `index.html`'e yapılır. `MFSim_Code.html` dosyası **elle düzenlenmez** — `npm run build` ile otomatik üretilir.

### Üç ana modül (alt-sistem kartı → kendi iç topolojisi)

Karşılama ekranındaki her kart, ana tuvale tek bir **alt-sistem kartı** bırakır;
çift tıklayınca kartın kendi iç topolojisi açılır. Üçü de **aynı nested kalıbı**
paylaşır (stack + `node.data.subTopology` + breadcrumb çipi + sidebar kapsamı):

| Modül | Tip anahtarı | Sidebar kapsamı | Ana dosya | Bağlantının anlamı |
|-------|--------------|-----------------|-----------|--------------------|
| Araç Performans | `arac-performans` | `arac-performans` | `js/cp-arac-performans.js` | Güç akışı |
| Takoz Çökme-Titreşim | `mount-analysis` | `mount-analysis` | `js/cp-mount.js` | Salt görsel (çözücü tipe göre toplar) |
| FEAD (kayış-kasnak) | `fead-analysis` | `fead-analysis` | `js/cp-fead.js` | **Kayış yolu** — serpantin sırası (Krank çıkışı → … → Krank girişi) |

Yeni bir modül eklerken dokunulan yerler: `js/components.js` (`componentDefs`
tanımı + `isSubsystem` + `VE_MODULES.components` + `veSyncSidebarScope`),
`js/cp-core.js` (panel dağıtımı + panel genişlik listeleri), `js/ui-core.js`
(çift tık), `js/topology.js` (busy bayrağı, köke çökme, gezinme yakala/geri yükle,
`veResetSubtopoNav`), `index.html` (script etiketi, Modüller satırı, palet
kategorileri, karşılama kartı).

#### FEAD hesap çekirdeği — `js/fead-core.js` (DIŞARIDAN GELDİ, BİREBİR DURUR)

`js/fead-core.js` MFSim içinde yazılmadı: 17 Gates raporundan çıkarılmış **2095
referans değerle** kalibre edilmiş, doğrulanmış bir çekirdek olarak dışarıdan
alındı (v2.0, UMD, bağımlılıksız → `window.FEADCore`).

**BU DOSYA MFSim STİLİNE ÇEVRİLMEZ.** `const`/arrow/template literal kullanıyor,
projenin geri kalanı `var` kullanıyor — fark bilerek duruyor. Dosyanın tek
değeri o 2095 değeri birebir üretmesi; stil uyarlaması sırasındaki bir işaret
hatası "testten geçen ama yanlış" bir çekirdek üretir. Uyarlanacak olan
çekirdeğin ÇEVRESİ (`js/cp-fead.js`), çekirdeğin kendisi değil. Sütun-0'da
üst-seviye bildirimi yok (IIFE sarmalı) → hijyen kapısına takılmaz; içindeki
`</script` dizisini build kalkanı (`shieldScriptEnd`) zaten kapsıyor.

Doğrulama verisi + koşucu `tests/fixtures/fead-validation.js` içinde, kaynağıyla
**birebir** (tek yerel fark: `require` yolu — dosyanın başında yazılı).
`tests/unit/fead-core.test.js` onu koşturup eşiklere bakar. `tests/` altında
olduğu için build'e girmez. Eşikler (harness'ın kendi ölçütleri):

| Ölçüt | Eşik | Neden |
|-------|------|-------|
| Çalışma konumları | %0.5 | deterministik fizik |
| Load dahil | %1.5 | Load bir MEKANİK STOP; sarım sıfıra yaklaşınca gerginlik tekilleşir, 0.1° yuvarlama %1.4–2.3 fark yaratır |
| Kol açıları | 0.2° | sıfıra yakın açıda yüzde hatası anlamsız |
| Kaburga yorulma dağılımı | 1.5 yüzde puanı | kalibre model |

Kapı **ısırıyor** — dört mutasyonla ölçüldü: `hb` 1.2→1.25 (2 test kırmızı),
gergi dengesinde `2sin(φ/2)`→`sin(φ)` (3), sarım değişmezi kontrolünü kaldırma
(suit çöker), gerilme işaretini ters çevirme (4).

**Mutlak B10 ömrü ve doğal frekans KAPI DIŞINDA** — spesifikasyonun geçerlilik
sınırları: doğal frekans çok serbestlik dereceli bir burulma modu (çekirdek
yalnız kol modu verir, raporla karşılaştırılamaz); mutlak ömür yalnız tüm
çaplar 79.6–176 mm iken geçerli, dışında sistematik 0.55×.

#### Üç katman — hangi dosya neyi yapar

| Dosya | Katman | Kural |
|-------|--------|-------|
| `js/fead-core.js` | Hesap çekirdeği | Dışarıdan geldi, **birebir** durur, dokunulmaz |
| `js/fead-model.js` | Köprü (DOM'suz) | Kanvas düğümü → `FEADCore.makeSystem()`; temas/sürücü/çap çözümü, hata çevirisi |
| `js/cp-fead.js` | Sunum | Yalnız HTML kurar; **kendi geometrisini hesaplamaz** |

Yükleme sırası (index.html): `fead-model.js` → `fead-core.js` → `cp-fead.js`.
Model katmanı, `cp-fead.js`'in de kullandığı saf yardımcıları (`_feadNum`,
`_feadDefOf`, `_feadIsPulley`, `veFeadContactOf`, `veFeadOD`,
`veFeadRouteOrder`…) bildirir — aynı adı iki dosyada bildirmek üst-seviye
çakışması olurdu (`source-hygiene` kapısı).

#### Üç yapısal kural (iskeletten farkı, hepsi testli)

1. **Sürücülük ROL, tip değil** (`node.data.driver`). Gates AG00976'da sürücü
   kasnak FAN'dır; tipe bağlamak o topolojiyi kurulamaz yapardı.
2. **Temas tarafı (grooved/back) GERÇEK ALAN.** Ters verilirse çekirdek
   **geçerli ama başka** bir güzergâh çözer — kapalı çevrim ve sarım değişmezi
   TUTAR, hata verilmez. Bu yüzden üç katman: tip varsayılanı
   (`componentDefs.feadContact`) → panelde açık aç/kapa → **kanvasta rozet**
   (K/S, sürücüde ►). Testi bu sessizliği belgeliyor.
3. **Çap = DIŞ ÇAP (`od`).** Yarıçapları çekirdek `hb`/`hr` ile türetir. Eski
   `dia` alanı `veFeadMigrateNode` ile sessizce göç eder.

**`veFeadBeltPath` EMEKLİ.** İskeletin kendi çizimi bütün kasnakları dış teğet
sayıyordu → sırttan temas edenlerde sarım YANLIŞTI (AG00686: CRK 207.7 ↔ 172.2,
−35.5°). Kendi içinde tutarlı olduğu için (Σ=360) gözle yakalanmıyordu. Şema
artık `FEADCore.solveGeometry`'nin teğet noktaları + işaretli sarım yayları.

**ÖLÇÜLDÜ (gerçek tarayıcı):** AG00686 kanvasa kurulunca sarım
`CRK 210.2 · IDR 26.7 · A_C 202.9 · TEN 26.4`, span
`249.2 · 212.6 · 248.9 · 212.6`, Mean kol açısı `33.1°`, take-up `0.559 mm/°`
— **hepsi Gates raporuyla birebir.**

**Sırada:** çalışma çevrimi (duty) tablosu + `analyze()` + sonuç sekmesi.

### Ölçüm Görüntüleyici (`viewer/`)

MFSim'in içe aktarma + diyagram özelliğinin tek başına çalışan sürümü; tek HTML
dosyası olarak dağıtılıyor. `viewer/js/` altındaki YEDİ dosya `js/`'ten
**birebir kopya** (`trace-view.js`'te iki işaretli fark hariç). Bu yüzden:

**İçe aktarma / şerit diyagramı tarafında bir düzeltme yaparsan
(`xlsx-read.js`, `measure-import*.js`, `measure-core.js`, `signal-tree.js`,
`trace-view.js`, `measure-dropzone.js`), düzeltmeyi `viewer/js/` altına da taşı:**

```bash
npm run sync:viewer && npm run build:viewer
```

Elle `cp` YAPMA — `trace-view.js`'in iki yerel farkı var ve elle uzlaştırma bir
kez yanlış yapıldı (görüntüleyici açılışta hata veriyordu). Farkların metni
`viewer/sync.js` içinde; çapa tutmazsa script durur, sessizce yanlış dosya
üretmez. `npm test` senkron bozulunca kırmızıya döner
(`tests/unit/viewer-sync.test.js`). Ayrıntı: `viewer/README.md`.

`viewer/js/theme.js`, `board.js`, `app.js` görüntüleyiciye özgüdür, kopya
değildir — MFSim'den taşınmaz.

**`css/` DE GÖRÜNTÜLEYİCİYE GİRİYOR — kolay kaçırılan kapı.** `viewer/build.js`
`../css/*.css` dosyalarını da inline ediyor. Yani `css/styles.css`'te yapılan
HERHANGİ bir değişiklik `MFSim_Olcum_Goruntuleyici.html`'i BAYATLATIR; dosya
git'e dahil olduğu için CI'daki "Dağıtım dosyası taze mi" kapısı
(`build:viewer` + `git diff --exit-code`) kırmızıya döner. `viewer/js/` hiç
değişmediğinden `sync:viewer --check` bunu YAKALAMAZ ve `npm test` de yeşil
kalır — bir kez tam olarak böyle kaçtı. Kural:

```bash
# css/ VEYA viewer/js/ dokunulduysa, commit'ten önce:
npm run build:viewer     # ve üretilen HTML'i commit'e dahil et
```

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
| `tests/unit/signal-tree.test.js` | `js/signal-tree.js` | Arama katlaması, üç-durumlu grup, istatistik, mini eğri, kanal toplama |
| `tests/unit/trace-view.test.js` | `js/trace-view.js` | Şerit uzlaştırma, ayrık/metin kanal tespiti, Y aralığı, şerit yerleşimi, tutamak isabeti, logaritmik X ve Y ekseni, **birleşik şeritte sinyal başına Y ekseni** |
| `tests/unit/measure-core.test.js` | `js/measure-core.js` | Örnek kilitleme, pencerenin tek X ekseni kuralı |
| `tests/unit/numerics.test.js` | `js/numerics.js` | PCHIP spline, RK45 solver, enerji dengesi |
| `tests/unit/mount-signals.test.js` | `js/mount-signals.js` | Takoz kanalları: FRF ızgarası, Campbell mertebe/mod çizgileri, F(δ) yasası, ivme süpürmesi, kanal kimliği, diyagram yorumu |
| `tests/unit/mount-brief.test.js` | `js/mount-brief.js` | Yorumun sayısal çekirdeği: tepe bulma, izolasyon başlangıcı, ilk çekme, ara değerleme, Campbell kesişim devri |
| `tests/unit/mount-capacity.test.js` | `js/cp-mount.js` + `js/mount-brief.js` + `js/cp-mount-report.js` | Taşıma kapasitesi: kg→N dönüşümü, kapasite çizgisi, % kullanım, Rapor sütunu |
| `tests/unit/mount-isolation-3dir.test.js` | `js/cp-mount-report.js` | Ateşleme frekansında X/Y/Z izolasyon yüzdesi (tam 6 SD), tedarikçi raporuyla karşılaştırma |
| `tests/unit/mount-shock.test.js` | `js/mount-core.js` şok + `js/mount-signals.js` | Newmark-β geçici rejim: yarı-statik limit, sönümsüz enerji korunumu, modal salınım frekansı, durdurucu uyarısı |
| `tests/unit/arac-example.test.js` | `js/cp-arac-example.js` + `assets/examples/ap_*` | Araç Performans örnek kartları: kayıt defteri ↔ disk tutarlılığı, öksüz dosya yok, her örnekte çalışır güç aktarma zinciri |
| `tests/unit/arac-performans-shift-4500sp.test.js` | `js/cp-gearbox.js` | Allison 4500 SP S1–S4 vites eşikleri; 2C→2L avlanma bekçisi + bütün profillerde yapısal kapı |
| `tests/unit/matching-selection.test.js` | `js/cp-gearbox.js` + `js/cp-torque-converter.js` + `assets/examples/ap_*` | "Hangi şanzıman/konvertör seçili?" çözümü (anahtar → ad → oran/eğri eşleşmesi) + örneklerin preset anahtarı sayılarla tutarlı |
| `tests/unit/arac-example-data.test.js` | `assets/examples/ap_*` | **Girdi bütünlüğü**: kütle/alan/Cd/aks/Crr/vites/transfer/governed/aksesuar/pumpTorqueDrop iSCAAN raporlarıyla doğrulanmış değerlere sabitlendi |
| `tests/unit/arac-example-calibration.test.js` | `js/ft-performance.js` + `assets/examples/ap_*` | **Filo kalibrasyon kapısı**: 13 örnek gerçek zincirle koşuyor — stall devri, tavan hız (iSCAAN Performance Summary bandı), 0-20/40/60/80 altın çıpaları, **81 vites geçiş noktası** + avlanma bekçisi |
| `tests/unit/arac-performans-shift-2957sp.test.js` | `js/cp-gearbox.js` | Allison 2957 SP Wide DynActive: dokuz geçişin de N_motor 2400'e oturması, a = 1/i kuralı |
| `tests/unit/arac-performans-transfer-roles.test.js` | `js/ft-performance.js` | Transfer kademe rolü orandan çözülüyor (dizi konumundan değil) |
| `tests/unit/gear-efficiency.test.js` | `js/ft-performance.js` + `js/cp-gearbox.js` | Dişli verimi: şanzıman bazlı ölçülmüş katsayılar, vites başına tablo (2957 SP), stall kaybı, geri viteste NaN yok |
| `tests/unit/mount-example-names.test.js` | `js/mount-core.js` örnekleri + `assets/examples/*.json` | Örnek modellerde ad ↔ konum tutarlılığı (Sağ/Sol ↔ Y işareti), tekrarlı ad, iki kopyanın ayrışmaması |
| `tests/unit/mount-results-tab.test.js` | `js/results.js` + `js/graphics.js` | Takoz çözüm sekmesi, tek X ekseni kuralı, pano uzlaştırma |
| `tests/unit/mount-results-publish.test.js` | `js/cp-mount.js` | Çözümün panoya yayını; alt-topoloji çökertme regresyonu |
| `tests/unit/fead-core.test.js` | `js/fead-core.js` + `tests/fixtures/fead-validation.js` | **FEAD çekirdeğinin doğrulama kapısı**: 17 Gates raporu / 2095 değer (çalışma %0.5, Load dahil %1.5, kol açısı 0.2°), 8 koruma mekanizması, SPEC §9 yapısal özdeşlikleri (sarım değişmezi, `L_pitch−L_eff=2π·hb`, çevrim kapanışı, sürücü gücü), UMD tarayıcı köprüsü |
| `tests/unit/fead-model.test.js` | `js/fead-model.js` | **Köprü kapısı**: AG00686 MFSim KANVAS DÜĞÜMÜ olarak kurulup Gates sayılarını üretiyor mu (span %0.5, sarım 0.2°, Mean kol açısı 0.2°); temas tarafı üç katmanlı çözümü, sürücü rolü, `dia→od` göçü, ad tekilleştirme, hata çevirisi. Ayrıca **ters temas tarafının hata VERMEDİĞİNİ** belgeler (rozetin varlık nedeni) |
| `tests/unit/cp-fead.test.js` | `js/cp-fead.js` + `js/components.js` | FEAD sunum katmanı: kanvas rozeti, `feadContact` varsayılanları, panel smoke testleri, alt-sistem sözleşmesi, `fead-*` tip tanımlarının yapısal tutarlılığı |
| `tests/unit/canvas-space.test.js` | `js/canvas-space.js` | Sonsuz ızgara deseni, "ev" kamerası, topoloji ortalama |
| `tests/unit/module-start-center.test.js` | `js/components.js` `veStartModule` | Karşılama kartından gelen modül bloğu görünümün TAM ortasına düşer (kabuk senkronu ölçümden önce) |
| `tests/unit/port-geometry.test.js` | `js/components.js` port geometrisi + `js/connections.js` | Bağlantı ucu ile port dairesi aynı noktada — dört kenar, çok port, aynalama |
| `tests/unit/module-card.test.js` | `js/components.js` alt-sistem kartı + sidebar modül satırı | Modül kartı: içerik özeti (alt topolojiden), kart ölçüsünün tek kaynağı, eski 80×66 kaydın yükselmesi, **ad elemanının taşınması** (kopyalansaydı yeniden adlandırma sessizce eskirdi); palet sembolü `componentDefs`'ten (index.html'de ikinci kopya tutulmadığına dair kapı) |
| `tests/unit/example-topology-center.test.js` | `js/cp-mount.js` + `assets/examples/` | Örnek JSON'ları kanvas merkezine açar |
| `tests/unit/state.test.js` | `js/state.js` | Undo/redo stack yönetimi |
| `tests/unit/toolbar-save.test.js` | `js/toolbar.js` | Proje kaydetme, JSON serileştirme, showSaveFilePicker |
| `tests/unit/viewer-board.test.js` | `viewer/js/board.js` | Görüntüleyici panosu: bir panoda tek ölçüm dosyası kuralı, X ekseni seçenekleri, veri kapısı |
| `tests/unit/viewer-sync.test.js` | `viewer/sync.js` | Görüntüleyici kopyaları `js/`'ten geride kaldıysa kırmızı — sessiz ayrışmaya karşı kapı |
| `tests/unit/measure-dropzone.test.js` | `js/measure-dropzone.js` | Sürükle-bırak uzantı süzgeci (sessiz yanlış çıktıya karşı) |
| `tests/unit/simulation-engine-grade.test.js` | `js/simulation-engine.js` | Yol eğimi işaret konvansiyonu (harita ↔ fizik çevirisi) + dinamiğin değişmediğini bağlayan altın değerler |
| `tests/unit/source-hygiene.test.js` | `js/`, `viewer/js/`, `css/`, `index.html` | **Yapısal kapılar**: üst-seviye bildirim çakışması yok, kaynakta kontrol karakteri yok |
| `tests/unit/results-txt-preview-download.test.js` | `js/results.js` | TXT önizlemesinin "HTML İndir" yolu — iki rapor üreticisinin ayrı kaldığı ve düğme kablolaması |
| `tests/e2e/app.spec.js` | Tüm uygulama | Sayfa yükleme, menüler, bileşen ekleme, kaydetme |
| `tests/e2e/measure-import.spec.js` | İçe aktarma sihirbazı | Gerçek .xlsx → sütun tarama → X/Y seçimi → şeritler |
| `tests/e2e/viewer.spec.js` | `MFSim_Olcum_Goruntuleyici.html` | **Üretilen tek dosya**, `file://` üzerinden: açılış, içe aktarma, sürükle-bırak, birleştirme, tema, sıfır ağ isteği |
| `tests/e2e/measure-merge-drop.spec.js` | `js/measure-dropzone.js` + `js/trace-view.js` | MFSim'de sürükle-bırak ve çok eksenli birleştirme — araç performans VE takoz sekmesi |

## Sık Kullanılan Komutlar

```bash
npm run test:watch          # ★ geliştirme döngüsü — kaydettikçe ilgili testler koşar
npm run test:changed        # git'te değişen dosyalarla ilgili testler (jest -o)
npm test                    # tüm birim testleri (sessiz) — commit öncesi
npm run test:ci             # tüm birim testleri (--verbose --ci) — CI logları için
npm run build               # MFSim_Code.html üret (modüler → monolitik) — commit/deploy öncesi
npm run sync:viewer         # js/ → viewer/js/ (yedi kopya + iki yerel fark)
npm run build:viewer        # MFSim_Olcum_Goruntuleyici.html üret (Ölçüm Görüntüleyici)
npm run build:all           # ikisi birden
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
5. CI'ı izle ve sonucu kullanıcıya bildir. CI artık **PR'da da koşar** (yalnız
   `test` job'u; `build`/`deploy` PR'da atlanır) — yani kırık kod merge'den ÖNCE
   yakalanır. `main`'e push'ta üç job da koşar ve Pages'e yayınlar.
   `test` job'u ayrıca iki kapı içerir: görüntüleyici senkronu
   (`npm run sync:viewer -- --check`) ve `MFSim_Olcum_Goruntuleyici.html`'in
   kaynaklarla taze olması (yeniden üretip `git diff --exit-code`).

**Kapı kuralı:** testler kırmızıysa ya da build patlıyorsa merge etme —
durumu kullanıcıya söyle. "Otomatik merge" testleri atlamak demek değil;
tören kısaltılıyor, doğrulama kısaltılmıyor.

Yeşil testler tek başına "düzeldi" demek değildir: kullanıcının bildirdiği
senaryo birebir yeniden üretilip ESKİ kodda kırıldığı, YENİ kodda geçtiği
ölçülmeden sonuç kesin dille sunulmaz.
