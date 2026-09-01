# MFSim - Claude Code Talimatları

## Belgeleme kuralı — ÖNCE BUNU OKU

Bu dosya bir **değişiklik günlüğü değil**, her oturumda koşulsuz geçerli olan
kuralların listesidir. Bir turun **ölçüm anlatısı buraya YAZILMAZ.**

| Ne | Nereye |
|----|--------|
| Koşulsuz kural ("şu dosya elle düzenlenmez", "şu eleman tipi yasak") | **bu dosya** |
| Bir modülün karar gerekçesi ("neden bu alternatif reddedildi") | ilgili modül skill'i (`.claude/skills/<modül>/`) |
| Ölçüm tabloları, "N mutasyonla ölçüldü", önce/sonra sayıları | **PR gövdesi + test dosyası** |
| Kodda karşılığı kalmamış yön | modül skill'inin `references/emekli-*.md` dosyası |

Bir karar kaydı üç parçadır ve üçü de kısadır: **hüküm + tek satır gerekçe +
kapının testi.** Kanıt testin kendisidir; belgede ikinci kez anlatılması
gereken bir şey yoktur.

**Bu dosya bir kez 6.052 satıra çıktı** — %71'i tek bir modülün (FEAD) ölçüm
defteriydi ve her oturumun bağlam penceresinin büyük kısmını baştan işgal
ediyordu. Sebebi bir kural değil **biçim taklidiydi**: dosyayı okuyan her
oturum üslubunu sürdürdü, dosya büyüdü, desen güçlendi. Yukarıdaki tablo o
döngünün sönümleyicisidir; olmadan yeni yapı da aynı şekilde şişer.

## Proje Yapısı
Tarayıcı tabanlı Motor Fren Simülasyonu uygulaması (saf HTML/CSS/JS, framework yok).

- `index.html` — Ana sayfa (modüler versiyon, js/ klasöründen script yükler)
- `MFSim_Code.html` — Tek dosya versiyonu (otomatik üretilir, elle düzenlenmez, **git'e dahil değil** — `npm run build` üretir, CI deploy Pages'e yayınlar)
- `js/` — Modüler JavaScript dosyaları
- `css/` — Stiller
- `build.js` — Build script (`index.html` + `js/` + `css/` → `MFSim_Code.html`)
- `js/fead-belts.js` — FEAD kayış kataloğu (5 profil, 244 stok boy + otomotiv
  ızgarası). DOM'suz saf veri; ISO 9982 / DIN 7867, üretici kataloglarından çıkarıldı.
- `js/cp-fead-wizard.js` — FEAD **Başlangıç Sihirbazı** (7 adımlık modal). Kendi
  modelini KURMAZ: durum → `veFeadWizNodes` → köprünün düğüm biçimi; önizleme de
  kurulum da aynı listeden geçer.
- `js/fead-duty.js` — FEAD **çalışma çevrimi** kütüphanesi (7 ölçülmüş çevrim).
  DOM'suz saf veri; altısı Gates arşivinden, biri BMC tedarikçi sayfasından.
  **Tek bir "standart" çevrim YOK** — arşivde altı ayrı desen ölçüldü.
- `js/fead-tensioners.js` — FEAD otomatik gergi künye kütüphanesi (14 kayıt, 2 aile).
  DOM'suz saf veri; **14 Gates raporundan ölçülerek** çıkarıldı, parça numarası
  uydurulmadı. Bant kayıtlardan TÜRETİLİR, elle yazılmaz.
- `js/fead-engines.js` — FEAD **motor kataloğu** (24 kayıt). DOM'suz saf veri;
  BMC'nin KIRPI II FEAD hesap defterinin "Motor Bilgileri" sayfasından çıkarıldı:
  dört devir sınırı, FEAD kasnak çapları, tam yük tork/güç eğrisi. Eksik alan
  `null` — sıfır yazmak olmayan bir kasnak iddia etmek olurdu.
- `js/fead-accessories.js` — FEAD **aksesuar kataloğu** (10 alternatör + 4 klima
  kompresörü). DOM'suz saf veri; güç eğrisi MFSim'de zaten vardı, bu kataloğun
  getirdiği asıl şey **devir sınırları** (optimum · maksimum sürekli · anlık
  maksimum) — aşağıdaki iki kapı onlarsız kurulamaz.
- `js/fead-checks.js` — FEAD **uygunluk kapıları**: kasnak merkez mesafesi,
  çevrim oranı penceresi, aksesuar devir sınırı. DOM'suz; **panel ve rapor AYNI
  çağrıyı paylaşır** (`veFeadChecks`), rapor onu çözüm anında yazılan
  `R.checks`'ten okur ve yeniden hesaplamaz.
- `js/structural-materials.js` — Yapısal Analiz malzeme kütüphanesi (112 kayıt / 16 aile,
  DOM'suz saf veri + arama). Değerler standartların NOMİNAL değerleridir, sertifika değil.
- `js/structural-occt-wasm.js` — **Üretilen, git'e DAHİL DEĞİL**: OCCT çekirdeğinin
  .wasm'ı gzip+base64 gömülü (17,5 MB). `npm run build` her seferinde
  `vendor/opencascade.wasm.gz`'den yeniden üretir → "vendor güncellendi, varlık bayat
  kaldı" sınıfı YOK. Fresh clone'da modüler `index.html`'i açmadan önce
  `npm run build:occt-wasm` (ya da `npm run build`) koşmalı.
- `js/structural-tetgen-wasm.js` — **Üretilen** (elle düzenlenmez): ağ üretecinin .wasm'ı
  gzip+base64 gömülü. `npm run build:tetgen-wasm-asset` üretir, git'e dahildir.
  `.wasm`'ın kendisi de üretilen: `npm run build:tetgen-wasm` (emscripten gerekir,
  kaynak `vendor/tetgen-src/` + `tools/tetgen-wasm-src/`). Aynı bayt-bayt kapısı.
- `tools/shot.js` — Ekran görüntüsü aracı (İSTEĞE BAĞLI — yalnız kullanıcı isteyince; `npm run shot -- --help`)
- `docs/gates-reports/` — **Gates raporlarının ham PDF ARŞİVİ + künye indeksi**
  (`README.md`: hangi raporda ne var, sayfa haritası, hangileri alıntı). Bir rapor
  bir kez konur, sonraki oturumlar yeniden yüklemeden okur. Build/Pages'e girmez
  (ölçüldü); `assets/` DEĞİL, çünkü orası Pages'e kopyalanıyor. **Testler bu
  PDF'leri OKUYOR** (`tests/helpers/gates-pdf.js`), yani arşiv bir belge yığını
  değil bir KAPI. **FEAD ile ilgili "bu sayı nereden geldi" sorusunun cevabı
  büyük olasılıkla buradadır.**
- `tests/unit/` — Jest birim testleri
- `tests/e2e/` — Playwright E2E testleri
- `viewer/` — **Ölçüm Görüntüleyici** (ayrı program, bkz. `viewer/README.md`)
- `MFSim_Olcum_Goruntuleyici.html` — Görüntüleyicinin tek dosya çıktısı (`npm run build:viewer` üretir; MFSim_Code.html'in aksine **git'e dahil** — dağıtımı bu dosyanın indirilmesiyle oluyor)
- `.claude/skills/` — modüllere özgü karar kayıtları (koşullu yüklenir; aşağıya bak)
- `docs/decisions/` — ortak yüzey kararları + tam test dosyası tablosu

**ÖNEMLİ:** Kod değişiklikleri **yalnızca** `js/` ve `css/` klasörlerindeki modüler dosyalara ve `index.html`'e yapılır. `MFSim_Code.html` dosyası **elle düzenlenmez** — `npm run build` ile otomatik üretilir.

### Dört ana modül (alt-sistem kartı → kendi iç topolojisi)

Karşılama ekranındaki her kart, ana tuvale tek bir **alt-sistem kartı** bırakır;
çift tıklayınca kartın kendi iç topolojisi açılır. Dördü de **aynı nested kalıbı**
paylaşır (stack + `node.data.subTopology` + breadcrumb çipi + sidebar kapsamı):

| Modül | Tip anahtarı | Sidebar kapsamı | Ana dosya | Bağlantının anlamı |
|-------|--------------|-----------------|-----------|--------------------|
| Araç Performans | `arac-performans` | `arac-performans` | `js/cp-arac-performans.js` | Güç akışı |
| Takoz Çökme-Titreşim | `mount-analysis` | `mount-analysis` | `js/cp-mount.js` | Salt görsel (çözücü tipe göre toplar) |
| FEAD (kayış-kasnak) | `fead-analysis` | `fead-analysis` | `js/cp-fead.js` | **Kayış yolu** — serpantin sırası (Krank çıkışı → … → Krank girişi) |
| Yapısal Analiz (FEA) | `structural-analysis` | `structural-analysis` | `js/cp-structural.js` | **Analiz zinciri** — veri akışı (Geometri → Ağ → Sınır Koşulları → Sonuçlar) |

Yeni bir modül eklerken dokunulan yerler: `js/components.js` (`componentDefs`
tanımı + `isSubsystem` + `VE_MODULES.components` + `veSyncSidebarScope`),
`js/cp-core.js` (panel dağıtımı + panel genişlik listeleri), `js/ui-core.js`
(çift tık), `js/topology.js` (busy bayrağı, köke çökme, gezinme yakala/geri yükle,
`veResetSubtopoNav`), `index.html` (script etiketi, Modüller satırı, palet
kategorileri, karşılama kartı).


### Modül karar kayıtları — koşullu yüklenir

İki modülün karar kaydı bu dosyadan **çıkarıldı** ve skill hâline getirildi;
gövdeleri ancak çağrıldığında yüklenir. Bu bir arşivleme değil, bir yükleme
kuralıdır: FEAD'e dokunmayan bir oturum FEAD kayıtlarını ödemez.

| Modül | Skill | Ne zaman çağrılır |
|-------|-------|-------------------|
| FEAD (kayış-kasnak) | `fead` | `js/fead-*.js`, `js/cp-fead*.js`, `js/guide-fead.js` ya da FEAD testlerine dokunmadan **ÖNCE** |
| Yapısal Analiz (FEA) | `structural` | `js/structural-*.js`, `js/cp-structural*.js`, gömülü OCCT/TetGen varlıkları ya da Yapısal testlere dokunmadan **ÖNCE** |

**Bu bir nezaket değil kapıdır.** İki modülün de hata sınıfı sessizdir — sayı
yanlış çıkar, program çalışmaya devam eder, uyarı verilmez. Skill'i okumadan
yapılan bir "iyileştirme" (çekirdeği proje stiline çevirmek, gerginin tanımını
eski yönüne döndürmek, tet4'e düşmek) testten geçebilir ve yine yanlış olabilir.

Takoz ve Araç Performans modüllerinin ayrı karar kaydı **yok**; kuralları kendi
test dosyalarında ve kodun yorumlarında duruyor.

### Üç katman kalıbı (dışarıdan gelen çekirdekli modüller)

FEAD ve Yapısal Analiz aynı kalıbı paylaşır ve **kural her ikisinde de aynıdır**:

| Katman | Kural |
|--------|-------|
| Hesap çekirdeği (`js/fead-core.js`, `vendor/opencascade.*`, `vendor/tetgen-src/*`) | **Dışarıdan geldi, birebir durur, dokunulmaz** — güncellemesi de dışarıdan gelir. Proje stiline ÇEVRİLMEZ |
| Köprü (`js/fead-model.js`, `js/structural-model.js`, `js/structural-mesh-model.js`) | DOM'suz. Kanvas düğümü → çekirdek girdisi; hata çevirisi |
| Sunum (`js/cp-fead.js`, `js/cp-structural.js`) | Yalnız HTML/kanvas kurar; **kendi geometrisini hesaplamaz** |

Uyarlanacak olan çekirdeğin **çevresidir**, çekirdeğin kendisi değil. Bir stil
uyarlaması sırasındaki tek işaret hatası "testten geçen ama yanlış" bir çekirdek
üretir.

## Proje geneli kurallar

### Lisans — TetGen AGPL, MFSim MIT

TetGen AGPL-3 veya WIAS'tan ticari lisans. Karar: **kaynak MIT kalır, dağıtılan
build AGPL-3** (MIT tek yönlü uyumlu; telif hakkı kullanıcıda olduğu için
optikonalite korunur).


### AĞIR VARLIKLAR GÖMÜLÜR — çevrimdışı çalışmak ŞART

MFSim tek dosya olarak indirilip kullanılıyor. Yanında `vendor/` klasörü
olmayan bir kurulumda çalışma anında çekilen her varlık **yok** demektir; bu
bir incelik değil, özelliğin hiç olmaması demek. Bu yüzden ağır varlıklar
(WASM, font, KaTeX) uygulamanın İÇİNE gömülür ve **talep üzerine** açılır.

> **Bu bölümde eskiden "WASM'lar tek dosyaya inline EDİLMEZ — hem boyut hem
> lisans aynı kapıya çıkıyor" yazıyordu (`623647f`, iskelet commit'i). O kayıt
> KALDIRILDI: bir planlama varsayımıydı, ölçülmemişti, ve iki ayrı konuyu tek
> gerekçede birleştiriyordu. İkisi de tutmadı.**
>
> • **Boyut** — sanılan maliyet ham base64'ün %133'üydü (occt için 9,67 MB).
>   Ölçüldü: `gzip -9` + base64 ile **3,96 MB**, yani üçte biri. Tek dosya
>   8,58 → **12,64 MB**.
> • **Lisans** — LGPL-2.1'in istediği "ayrı dosya" değil, kütüphanenin
>   **değiştirilebilir** olması. Kütüphane depoda (bugün
>   `vendor/opencascade.wasm.gz`), lisans metinleri dağıtımda,
>   `npm run build:occt-wasm` gömülü blob'u o dosyadan yeniden üretiyor →
>   koşul karşılanıyor. TetGen'in AGPL-3'ü için
>   gömme/gömmeme hiçbir şeyi değiştirmez: yükümlülük "dağıtılan build AGPL-3"
>   kararında zaten karşılanmış.

**Yeni bir ağır varlık eklerken sorulacaklar** (kural değil, ölçüm):

1. `gzip -9` sonrası base64 boyutu kaç MB? (`tools/build-occt-wasm-asset.js`
   bunu basıyor.)
2. Tek dosyanın toplamı kabul edilebilir mi? Bugün **26,8 MB** (OCCT çekirdeği
   boolean'lı sürüme geçince 12,6 → 26,8; karar kullanıcının).
3. Açılışta yüklenmiyor mu? (`type="text/x-mfsim-asset"` → ne tarayıcı ne
   `MFSimLoader` dokunur.)
4. Açma işi **worker'da** mı? Ana iş parçacığında base64+gunzip yüz
   milisaniyelik donma demek.
5. Kaynak dosya depoda kalıyor mu? Çok büyükse **gzip'li** konur — 62,8 MB'lık
   OCCT wasm'ı depoya sıkıştırılmış giriyor (13,1 MB) ve üreteç base64'ü ondan
   alıyor. (Yeniden üretilebilirlik + lisans + eski
   tarayıcı yedeği.) Ve gömülü içeriğin kaynakla **bayt bayt** aynı olduğunu
   doğrulayan bir test var mı?

TetGen geldiğinde bu beş soru yeniden sorulacak; boyutu **ölçülmedi**, occt'ye
bakarak tahmin edilmeyecek.

### Ortak yüzey kuralları

Gerekçeleri ve ölçümleri `docs/decisions/ortak-yuzeyler.md` içinde.

- **Topoloji sınır çerçevesi düğüm ADINI da sarar** (`veNodeLabelOverflow`). Ad
  dört kenara da konabiliyor; ölçü DOM'dan `offsetWidth` ile alınır
  (`getBoundingClientRect` DEĞİL — kamera zoom'unu içine katar), önbellek şart
  (her sürükleme karesinde koşuyor), boşluk sabitleri `css/styles.css`'teki
  margin'lerle aynı olmak zorunda.
- **Sonuçlar penceresindeki TXT raporları A4 SAYFADIR** (794×1123 px), tek
  `<pre>`, sola yaslı. Font ölçüsü **CSS'te** sayfaya sığmaktan türer (JS'te px
  yazılmaz — indirilen HTML'de JS yok). Üst bandı `veRepHeadHTML` **tek
  üretici** kurar ve `--results-bar-h`'tan beslenir; panel başına kopya bant
  kurulmaz.
- **Artifact önizlemesi kaldırıldı**, ama `build.js`'teki
  `maskRawTextKeepOffsets` **KALIR**: rapor üreticileri HTML şablonu bastığı
  için gerçek belgede sahte `</body>` geçiyor ve kalkan onun içindir.

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

FEAD ve Yapısal Analiz satırları modül skill'lerine taşındı
(`.claude/skills/<modül>/references/testler.md`); **tam tablo**
`docs/decisions/testler.md` içindedir.

| Dosya | Test Edilen Modül | Kapsam |
|-------|-------------------|--------|
| `tests/unit/signal-tree.test.js` | `js/signal-tree.js` | Arama katlaması, üç-durumlu grup, istatistik, mini eğri, kanal toplama |
| `tests/unit/trace-view.test.js` | `js/trace-view.js` | Şerit uzlaştırma, ayrık/metin kanal tespiti, Y aralığı, şerit yerleşimi, tutamak isabeti, logaritmik X ve Y ekseni, **birleşik şeritte sinyal başına Y ekseni**, açılır pencere kapatıcısının GECİKMESİZ bağlanması |
| `tests/unit/measure-core.test.js` | `js/measure-core.js` | Örnek kilitleme, pencerenin tek X ekseni kuralı |
| `tests/unit/numerics.test.js` | `js/numerics.js` | PCHIP spline, RK45 solver, enerji dengesi |
| `tests/unit/mount-signals.test.js` | `js/mount-signals.js` | Takoz kanalları: FRF ızgarası, Campbell mertebe/mod çizgileri, F(δ) yasası, ivme süpürmesi, kanal kimliği, diyagram yorumu |
| `tests/unit/mount-brief.test.js` | `js/mount-brief.js` | Yorumun sayısal çekirdeği: tepe bulma, izolasyon başlangıcı, ilk çekme, ara değerleme, Campbell kesişim devri |
| `tests/unit/mount-capacity.test.js` | `js/cp-mount.js` + `js/mount-brief.js` + `js/cp-mount-report.js` | Taşıma kapasitesi: kg→N dönüşümü, kapasite çizgisi, % kullanım, Rapor sütunu |
| `tests/unit/mount-isolation-3dir.test.js` | `js/cp-mount-report.js` | Ateşleme frekansında X/Y/Z izolasyon yüzdesi (tam 6 SD), tedarikçi raporuyla karşılaştırma |
| `tests/unit/mount-shock.test.js` | `js/mount-core.js` şok + `js/mount-signals.js` | Newmark-β geçici rejim: yarı-statik limit, sönümsüz enerji korunumu, modal salınım frekansı, durdurucu uyarısı |
| `tests/unit/arac-example.test.js` | `js/cp-arac-example.js` + `assets/examples/ap_*` | Araç Performans örnek kartları: kayıt defteri ↔ disk tutarlılığı, öksüz dosya yok, her örnekte çalışır güç aktarma zinciri |
| `tests/unit/node-label-anchor.test.js` | `js/components.js` `veNodeLabelAnchor` + `js/export-topology.js` + `js/topology.js` | Düğüm ADININ çizim çıpası tek kaynaktan: `node.data.labelPos` (üst/sol/sağ/alt) yalnız canlı kanvasta okunuyordu; dışa aktarılan SVG/PNG ve şerit paneli adı hep kutunun ALTINA çiziyordu — ekranda tellerden kaçırılan ad çıktıda yine şeritteydi |
| `tests/unit/arac-example-layout.test.js` | `assets/examples/ap_*` + `js/cp-arac-performans.js` | **Kanonik yerleşim kapısı**: şaft ekseni (zincirin dört bağlantısı tam yatay), fan simetrisi, dik açılı telin ne bileşenin ne de bir ADIN üstünden geçmesi, kutu çakışmaması, `lineType` sözleşmesi (zincir `curve` / dal `stepped`), bütün örneklerin AYNI sütunlarda olması, `VE_ARAC_PERFORMANS_LAYOUT` ile birebir uyum (6×6'da fan dışı + fan sütunları), "Örneği Aktar"ın eklediği `ap-example` düğümünün boş köşeye düşmesi |
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
| `tests/unit/canvas-space.test.js` | `js/canvas-space.js` + `css/styles.css` | Sonsuz ızgara deseni, "ev" kamerası, topoloji ortalama; **sınır çerçevesi düğüm ADINI da sarar** — `veNodeLabelOverflow` dört kenar için taşma (yanda 7+genişlik, alt/üstte 4+yükseklik, karşılıklı taşma İKİ YANA EŞİT), modül kartının adının taşma EKLEMEMESİ, alt payın hiç küçülmemesi (çerçeve yalnız büyür), ölçüm işlevi geçilmezse davranışın BİREBİR eski hâli, ve boşluk sabitlerinin `css/styles.css`'teki margin'lerle aynı olması |
| `tests/unit/module-start-center.test.js` | `js/components.js` `veStartModule` | Karşılama kartından gelen modül bloğu görünümün TAM ortasına düşer (kabuk senkronu ölçümden önce) |
| `tests/unit/port-geometry.test.js` | `js/components.js` port geometrisi + `js/connections.js` | Bağlantı ucu ile port dairesi aynı noktada — dört kenar, çok port, aynalama; **gidiş yönü oku** (Bézier t=0.5, 46 px eşiği, ters yön); **`veSyncPortDom`** — kenar sonradan değişince (bağlantı/sürükleme) dairenin teli takip etmesi, elle taşınan portun ezilmemesi, kenar değişmiyorsa DOM'a hiç yazılmaması |
| `tests/unit/module-card.test.js` | `js/components.js` alt-sistem kartı + sidebar modül satırı | Modül kartı: içerik özeti (alt topolojiden), kart ölçüsünün tek kaynağı, eski 80×66 kaydın yükselmesi, **ad elemanının taşınması** (kopyalansaydı yeniden adlandırma sessizce eskirdi); palet sembolü `componentDefs`'ten (index.html'de ikinci kopya tutulmadığına dair kapı) |
| `tests/unit/example-topology-center.test.js` | `js/cp-mount.js` + `assets/examples/` | Örnek JSON'ları kanvas merkezine açar |
| `tests/unit/topology-wiring.test.js` | `js/ui-core.js` `veTryConnectPorts` + `js/connections.js` topoloji imzası | **Kanvasta tel çekmek**: geçersiz port çifti (çıkış→çıkış, giriş→giriş, kendine) bağlantı kurmaz ama SESSİZ de kalmaz; doğru çift her iki yönden de aynı bağlantıyı kurar; topoloji imzası tel/düğüm değişince değişir, düğüm SÜRÜKLENİNCE değişmez (kart 30 karede 0 kez yeniden kurulur) |
| `tests/unit/state.test.js` | `js/state.js` | Undo/redo stack yönetimi |
| `tests/unit/toolbar-save.test.js` | `js/toolbar.js` | Proje kaydetme, JSON serileştirme, showSaveFilePicker |
| `tests/unit/viewer-board.test.js` | `viewer/js/board.js` | Görüntüleyici panosu: bir panoda tek ölçüm dosyası kuralı, X ekseni seçenekleri, veri kapısı |
| `tests/unit/viewer-sync.test.js` | `viewer/sync.js` | Görüntüleyici kopyaları `js/`'ten geride kaldıysa kırmızı — sessiz ayrışmaya karşı kapı |
| `tests/unit/measure-dropzone.test.js` | `js/measure-dropzone.js` | Sürükle-bırak uzantı süzgeci (sessiz yanlış çıktıya karşı); **yerel bırakma alanı** (`data-ve-dropzone`) kaplamayı devralıyor — alan içine bırakılan dosya ölçüm sihirbazını açmıyor, alan dışı davranış korunuyor |
| `tests/unit/simulation-engine-grade.test.js` | `js/simulation-engine.js` | Yol eğimi işaret konvansiyonu (harita ↔ fizik çevirisi) + dinamiğin değişmediğini bağlayan altın değerler |
| `tests/unit/shot-tool.test.js` | `tools/shot.js` | Ekran görüntüsü aracının ayrıştırma çekirdeği: bilinmeyen bayrağın SESSİZCE yutulmaması (yanlış ekranın görüntüsü alınırdı), hedef takma adları, PNG ölçüsü, karşılaştırmanın İKİ GÖRÜNTÜYÜ TEK ÖLÇEKLE küçültmesi |
| `tests/unit/source-hygiene.test.js` | `js/`, `viewer/js/`, `css/`, `index.html` | **Yapısal kapılar**: üst-seviye bildirim çakışması yok, kaynakta kontrol karakteri yok |
| `tests/unit/results-txt-preview-download.test.js` | `js/results.js` | TXT önizlemesinin "HTML İndir" yolu — iki rapor üreticisinin ayrı kaldığı; düğme kablolaması artık ÜRETİLEN YÜZEYDEN ölçülüyor (kopya sayısı değil: bandı tek üretici kuruyor) ve dört panelin de aynı kabuğa gittiği |
| `tests/unit/results-txt-page.test.js` | `js/results.js` + `css/styles.css` | **TXT raporunun görünümü**: üst bandın soldaki "Veri Gezgini" bandıyla TEK ölçü kaynağından beslenmesi (yükseklik, alt çizgi, başlık puntosu, zemin, düğme sınıfı), sayfanın A4 olması ve içeriğe göre DARALMAMASI, gövdenin tek `<pre>` kalması (blok blok ortalama yok) ve metnin bire bir korunup kaçışlanması, font ölçüsünün sayfaya sığmaktan türemesi + okunur tavan, karakter oranının ölçülemeyince GÜVENLİ tarafa düşmesi, indirilen belgenin aynı sayfayı açıp `@page{size:A4}` ile basması |
| `tests/e2e/app.spec.js` | Tüm uygulama | Sayfa yükleme, menüler, bileşen ekleme, kaydetme |
| `tests/e2e/measure-import.spec.js` | İçe aktarma sihirbazı | Gerçek .xlsx → sütun tarama → X/Y seçimi → şeritler |
| `tests/e2e/viewer.spec.js` | `MFSim_Olcum_Goruntuleyici.html` | **Üretilen tek dosya**, `file://` üzerinden: açılış, içe aktarma, sürükle-bırak, birleştirme, tema, sıfır ağ isteği |
| `tests/e2e/results-txt-page.spec.js` | TXT rapor önizlemesi (yerleşim) | **GERÇEK tarayıcı**: iki bandın AYNI yerde bitmesi (ölçülen eski fark 12 px), başlıkların aynı punto, sayfanın 794 px = A4 olması, metnin tek blok / tek sol kenar kalması (eski: 43 blok, 10 kenar), 119 sütunluk tablonun sayfaya sığması (yatay kaydırma yok) ve dar raporun tavan puntoyla açılması. Rapor METNİ sahte — ölçülen şey kabuk; bu halkalar Node'da HİÇ koşmuyor |
| `tests/e2e/measure-merge-drop.spec.js` | `js/measure-dropzone.js` + `js/trace-view.js` | MFSim'de sürükle-bırak ve çok eksenli birleştirme — araç performans VE takoz sekmesi |

## Sık Kullanılan Komutlar

```bash
npm run test:watch          # ★ geliştirme döngüsü — kaydettikçe ilgili testler koşar
npm run test:changed        # git'te değişen dosyalarla ilgili testler (jest -o)
npm test                    # tüm birim testleri (sessiz) — commit öncesi
npm run test:ci             # tüm birim testleri (--verbose --ci) — CI logları için
npm run build               # MFSim_Code.html üret (modüler → monolitik) — commit/deploy öncesi
npm run sync:viewer         # js/ → viewer/js/ (yedi kopya + iki yerel fark)
npm run build:occt-wasm     # vendor/opencascade.wasm.gz → js/structural-occt-wasm.js (gömülü OCCT; `npm run build` zaten koşturur)
npm run build:tetgen-wasm       # vendor/tetgen-src/ → vendor/tetgen-wasm.{js,wasm}  (emscripten GEREKİR, nadiren)
npm run build:tetgen-wasm-asset # vendor/tetgen-wasm.wasm → js/structural-tetgen-wasm.js (gömülü ağ üreteci)
npm run build:viewer        # MFSim_Olcum_Goruntuleyici.html üret (Ölçüm Görüntüleyici)
npm run build:all           # ikisi birden (monolit + görüntüleyici)
npm run shot -- --help      # ekran görüntüsü — İSTEĞE BAĞLI, yalnız kullanıcı isteyince
npm run test:e2e            # E2E testleri (Chromium gerekli)
npm run test:all            # birim + E2E
```

> **Artifact önizlemesi (`MFSim_Artifact.html`) KALDIRILDI (2026-08-25)** —
> gerekçesi ve ölçülmüş üç tuzağı `docs/decisions/ortak-yuzeyler.md` içinde.

## "Güncel programı alayım" — dosya + DURUM ÖZETİ

Kullanıcının ağı GitHub'a da GitHub Pages'e de çıkamıyor (2026-08-22); yayınlanan
programı göremiyor. Çalışan tek kanal claude.ai. Bu yüzden kullanıcı zaman zaman
tek dosyayı DOĞRUDAN sohbete istiyor. İstek geldiğinde sıra:

```bash
git checkout main && git pull origin main   # BAYAT DOSYA GÖNDERME
npm run build                                # MFSim_Code.html
```
sonra gerçek tarayıcıda aç ve **0 ağ isteği / 0 konsol hatası** olduğunu ölç,
ardından dosyayı SendUserFile ile bırak.

**Gönderilen dosya `MFSim_Code.html`** — tam belge, çift tıkla açılır.

Kullanıcı isteği (2026-08-25): dosyayla birlikte **DURUM ÖZETİ** de verilir —
*"hem takibini yaparız"*:

| Ne | Nereden |
|----|---------|
| Son gönderiden bu yana hangi PR'lar girdi | `git log --oneline <öncekiHEAD>..HEAD --merges` |
| Açık PR var mı | `list_pull_requests state=open` |
| Merge edilmemiş dal var mı | `git branch -r --no-merged origin/main` |
| Test + build durumu, dosya boyutu | `npm test`, build çıktısı |

**DEĞİŞMEMİŞSE DOSYA GÖNDERİLMEZ.** `main` bir önceki gönderimdeki commit'teyse
27 MB'ı ikinci kez indirtmenin karşılığı yok: özet verilir, "aynı dosya" denir.

**Boyut takip edilir ve BÜYÜME SEBEBİYLE BİRLİKTE yazılır.** Dosya 8,6 → 27,7 MB
yolunu izledi ve sıçramaların hepsi gömülen WASM'lardan: OCCT STEP okuyucusu
(+3,96 MB), TetGen (+0,24 MB), boolean'lı OCCT çekirdeği (12,6 → 26,8 MB).
Sebepsiz bir büyüme bir regresyon işaretidir; sayıyı çıplak basmak onu gizler.

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
