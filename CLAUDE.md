# MFSim - Claude Code Talimatları

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

> **KAYNAK BELGELER DEPODA:** bu bölümde adı geçen Gates raporlarının onu
> `docs/gates-reports/pdf/` altında duruyor ve testler onları **doğrudan
> okuyor**. Bir sayının kökenini merak ettiğinde ya da yeni bir referans değer
> gerektiğinde önce `docs/gates-reports/README.md`'ye bak — hangi raporda hangi
> sayfada ne olduğu orada yazılı. Fixture'ın 284 statik değeri kaynağına karşı
> ölçüldü: **0 uyuşmazlık**.

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

**Mutlak B10 ömrü KAPI DIŞINDA** — yalnız tüm çaplar 79.6–176 mm iken geçerli,
dışında sistematik 0.55×.

##### Burulma modeli — çekirdeğe SONRADAN girdi, kapısı AYRI

Eskiden doğal frekans da kapı dışındaydı: "çekirdek yalnız kol modu verir,
raporla karşılaştırılamaz". Artık `torsionalModel()` var — kayış spanlarıyla
kuplajlı N kasnak + kol serbestliği, enerji formülasyonundan
(`K = Bᵀ diag(k) B + yay`, `M = diag(I)`, Jacobi özdeğer). Gates raporunun
"System Resonance (Mode 1)" satırıyla **karşılaştırılabilir**.

Ama **statik zincirle aynı güven düzeyinde DEĞİL** ve bu ayrım korunmalı:

| | Statik zincir | Burulma modeli |
|---|---|---|
| Doğrulama | 17 rapor / 2095 değer | 6 sistem / tek sayı (Mode 1) |
| Sapma | %0.33 | RMS ~%8 |
| Serbest parametre | yok | kord rijitliği, kavis payı (`beltFactor`) |

Testi bu yüzden **iki katmanlı** (`tests/unit/fead-core.test.js`):
kalibrasyondan BAĞIMSIZ yapısal özdeşlikler sıkı toleransla (tam 1 rijit cisim
modu; take-up özdeşliği `Σ(∂span/∂kol) = take-up oranı` %0.01 içinde; yalnız
gergiye komşu iki spanın türevi sıfırdan farklı), kalibrasyon ise gevşek
(5 sistem RMS <%8). Kalibrasyon takımı doğrulama fixture'ında **zaten
duruyordu** (`AG_MISC` içindeki `NF` ve `inertia` alanları) ama koşucu onları
beslemiyordu; test besliyor.

**İKİ SESSİZ GİRDİ — ikisi de ölçüldü:**

| Girdi | İhmal edilirse | Neden sessiz |
|-------|----------------|--------------|
| Gergi **kasnak kütlesi** (`pulleyMass`) | 1. mod **+%32** (BMC 15.3 → 20.3 Hz) | model yine çözülür |
| **Krank mili** ataleti (kasnağınki değil) | AG0868 ailesi 29/36/41 → **41/50/57 Hz**, RMS %5 → %33 | model yine çözülür |

İkincisi MFSim'de **ölü girdiydi**: Çözücü panelindeki "Krank ataleti" alanı
soruluyor ama hiçbir yere gitmiyordu (burulma modeli yoktu). Şimdi
`veFeadTorsionalOpt` ile çekirdeğe `inertias` üzerinden geçiyor — kasnağın kendi
`inertiaKgM2` alanına YAZILMIYOR ki `peakEstimate` kasnak ataletini istediğinde
karşısında krank milini bulmasın.

Kol→span uzama türevi **PROJEKSİYONLA** alınır (`u·v`), serbest span boyunun
sonlu farkıyla değil: ikisi aynı şey değil (sarım değişimi teğet noktalarını
kaydırır, kavis terimi dışarıda kalır) ve sonlu fark take-up kontrolünde
%3–49 sapıyordu. Projeksiyonla **%0.000**.

`analyze()` burulmayı kendisi de hesaplayabiliyor ama **seçeneksiz** — krank
ataleti geçilemediği için kasnak ataletiyle koşar. Köprü onu `torsional: false`
ile kapatıyor: panelde tek frekans olsun, iki farklı cevap değil.

**AG00810 kalibrasyon takımının dışında** ve sebebi model değil VERİ: gergisinin
kol ataleti (0.004) çekirdeğin ölçülmüş iki gergisinden hiçbiri değil, yani
kasnak kütlesi bilinmiyor → nokta kütle terimi eksik → 20.3 Hz (Gates 13.29).
Testi bunu belgeliyor ki biri "AG00810 tutmuyor" diye modeli suçlamasın.

#### KAYIŞ BOYU SABİT DEĞİL — iki kip, ve "çözülemez" kümesinin kaldırılması

Kullanıcı bildirimi (2026-08-25): *"Biz tasarımı yaptıktan sonra tasarıma göre
tedarikçi ile iletişime geçip, tasarıma uygun bir kayış tedarik ediyoruz. O
yüzden kayışımız sabit değil… Ayrıca modelin çözülemez olduğu bir küme olmaması
gerekiyor. Çözülür, ama belki hatalı, belki sınırda çıkar."*

Haklıydı ve **ölçüldü**: alternatörü **1 mm** kaydırmak gergi kolunu −3.0°
döndürüyor, gerginliği −38.6 N (−%5.9) değiştiriyor; **10 mm**'de model
çözülemez oluyordu. Ama sebep geometri DEĞİL — o noktada geometri kusursuz
çözülüyor (Σsarım = 360.00°, altı span geçerli). Çöken tek şey şuydu:

```
kol 0°     → kayış yolu 1711.3 mm
kol 64.5°  → kayış yolu 1684.4 mm     (kolun TÜM gezinme aralığı)
istenen    → 1715.0 mm                ← 3.7 mm YUKARIDA, kuşatılamıyor
```

Yani duvar `solveArmForBeltLength`'in kök kuşatamamasıydı: **kısıtı biz
dayatıyorduk.**

##### Kol açısı ile kayış boyu TEK serbestlik derecesini paylaşır

Hangisinin GİRDİ olduğu seçilmek zorunda; `veFeadBeltMode` (kayış düğümünde
`data.lengthMode`) bunu söyler:

| Kip | Kol nereye oturur | ÇIKTI | Hangi soruya cevap |
|-----|-------------------|-------|--------------------|
| `fixed` | `solveArmForBeltLength(effLength)` | gerginlik | "Bu kayış bu düzene uyar mı?" |
| `free` | **nominal yay yükü açısı** `(M_mean − M₀)/k` | **kayış boyu** | "Bu düzen için hangi kayışı ısmarlamalıyım?" |

**SERBEST KİPİN ANKRAJI GERGİNLİK OLAMAZ.** Tasarım gerginliği artık bir girdi
değil, yay dengesinden TÜRÜYOR (bkz. *"ANKRAJ TÜRETİLİYOR"*). Hedef alınsaydı
döngü kurulurdu: gerginlik açıdan çıkıyor, açı gerginlikten. Nominal kol açısı
ise **salt yay künyesinden** geliyor — tedarikçi sayfasındaki *"Spring Mean
Load"* (BMC: 22.07 Nm) ve yay künyesi (M₀, k) yeter, geometriye hiç bakmaz.
Fizik de bunu söylüyor: gergi kolu yayı nominal momentine kurulmuş halde
çalışsın diye seçilir; kayış boyu da onu oraya oturtan boydur.

Serbest kip **"boyu hesaplanmış sabit kip"e indirgeniyor**: türetilen boy
`sys.belt.effLength`'e geri yazılıyor, böylece `positionTable`, `meanRel`,
`ribFatigueDistribution` ve `beltLifeB10` kipten haberdar olmak zorunda değil.

**GERİYE DÖNÜK:** kip yazılı değilse `effLength`'i olan proje `fixed` sayılır →
bugüne kadar kaydedilmiş her proje birebir eski davranışını korur. **ÖLÇÜLDÜ:**
dokunulmamış BMC sabit kipte `kol 28.4271° · L 1715.0000 · T 532.142 N ·
hub 302.125 N` — değişiklikten öncekiyle birebir aynı.

> Bu dört sayı bir dönem `28.5090° / 649.986 N / 369.064 N` olarak yazılıydı ve
> öyle KALDI: gergi pivotu bir GİRDİ olmaktan çıkıp parça künyesinden türemeye
> başlayınca (`aa8ddf7`) taban kaydı, ama yalnız o değişikliğin kendi bölümü
> güncellendi. Testler doğru çıpayı taşıyordu
> (`fead-belt-mode.test.js` → `TABAN`), yani kanonik kayıt kendi test dosyasını
> yanlış tarif ediyordu. Ölçülüp düzeltildi. **Regresyon değil**: 532.1 N,
> Gates'in 543.9 N'ına −%2.2 ve pivot bölümünde belgeli.

**BAĞIMSIZ DOĞRULAMA — ÖLÇÜLDÜ.** Serbest kip kayış boyunu HİÇ görmeden
hesaplıyor (girdi: kasnak koordinatları, çaplar, gergi künyesi) ve tedarikçi
sayfasının kendi kayışını geri veriyor: **1715.27 ↔ 1715 mm (%0.016)**.

**ÖLÇÜLDÜ (serbest kip, alternatör sürüklenirken):** −200…+60 mm boyunca çözüm
KOPMUYOR ve **hiç kenetlenme olmuyor**; kol 28.0625°'de duruyor, gereken boy
2095.4 → 1612.0 mm, gerginlik 358.8 → 1253.6 N.

**Gerginlik sürüklerken SABİT DEĞİL ve bu fizik:** aynı yay açısında moment
aynı (`M = M₀ + k·θ`) ama take-up geometriyle değişiyor
(`dL/dθ = a·sinβ·2sin(φ/2)`), dolayısıyla `T = M/(dL/dθ)` da değişiyor —
sürükleme aralığında **3.5 kat**.

**İki kip yakınsıyor ama ÖZDEŞ DEĞİL** ve fark anlamlı: sabit kip
`kol 28.4271° · L 1715.0000 (girdi) · T 532.14 N`, serbest kip
`kol 28.0625° · L 1715.2666 (çıktı) · T 525.55 N`. 0.36°'lik açı farkı 1715'in
**yuvarlanmış bir katalog boyu** olmasından. Özdeş olmalarını beklemek katalog
yuvarlamasını yok saymak olurdu.

##### İŞLEVSEL DENETİM — iki sessiz kusur (2026-08-26)

Kullanıcı sordu: *"Kayış ya sabit oluyordu… veya serbest oluyordu… Bu programda
işlevsel olarak çalışıyor mu?"* Zincir uçtan uca ölçüldü ve **ana yolda
çalışıyor**: sabit kipte ±10 mm boy değişimi gerginliği `1101 → 356 N` aralığında
3.09 kat oynatıyor, serbest kipte boy alanına yazılan hiçbir değer
(`null/1500/1715/1900`) sonucu değiştirmiyor, −200…+60 mm taramasında 27/27 nokta
çözülüyor, kip proje kaydına giriyor ve gidiş-dönüşte korunuyor, geriye dönük
göç birebir (`lengthMode` yoksa + boy varsa → `fixed`, kol 28.4271°).

Ama **iki sessiz kusur** çıktı ve ikisi de aynı sınıftan: *panel, kolun nominal
açıda oturmadığı durumlarda çıkan boyu, oturmuş gibi basıyordu.*

**1 · NOMİNAL KOL AÇISI GEOMETRİ KAPISININ ALTINDAYDI.**
`rel_mean = (M_mean − M₀)/k` — üç sayı da salt yay künyesinden gelir, montaj
merkezi bu hesaba HİÇ girmez. Buna rağmen `veFeadTensionerMount` onu geometri
kapılarının altında hesaplıyor ve `cenX/cenY` yoksa erken dönüşte kaybediyordu.

Panelin **birinci sınıf** seçeneği (*"Serbest kol açısını elle gir"*,
`angleMode='direct'`) montaj merkezini SORMUYOR. **ÖLÇÜLDÜ** (BMC, künye
tastamam: 8.60 · 0.480 · 22.07 → 28.0625°):

| | kol | L | nominalRel | fallback | hata | uyarı |
|---|---|---|---|---|---|---|
| mount | 28.0625° | 1715.27 | 28.0625 | false | 0 | 0 |
| direct (eski) | **38.1174°** | 1717.32 | **NaN** | **true** | 0 | 0 |
| direct (yeni) | **28.0625°** | — | **28.0625** | **false** | 0 | 0 |

Yani kullanıcı hatasız ve uyarısız **yanlış boy ısmarlıyordu**. Hesap artık
bütün geometri kapılarının ÜSTÜNDE.

**2 · `nominalFallback` YAZILIYOR AMA HİÇ OKUNMUYORDU.**
Bayrak `js/` içinde tek bir yerden okunmuyordu; panel yine *"gergi künyesinden
hesaplandı… Tedarikçiye verilecek boy budur"* diyordu. Aynı sessizlik
KENETLENMİŞ çözümde de vardı: köprü sebebi adıyla yazıyor
(*"nominal çalışma açısı (280.6°) … aralığın dışında"*) ama Kayış Özellikleri
paneli `build.warnings`'i HİÇ basmıyordu — `veFeadWarningBox` yalnız Kayış Yolu
ve Çözücü panellerindeydi. **ÖLÇÜLDÜ** (`kArm` 0.480 → 0.048, gerçekçi bir
ondalık kayması): `L = 1754.94 mm`, nominalden **+39.7 mm**, panelde kenetlenme
izi **yok**.

Panel artık üç hâli ayırıyor ve sağlıklı modelde metin **birebir eskisi**
(yanlış alarm yok):

| durum | ne diyor | sayı |
|-------|----------|------|
| kol nominalde | *"Tedarikçiye verilecek boy budur"* | amber |
| künye eksik | *"…gezinme aralığının ORTASINDAN… tedarikçiye verilecek boy DEĞİLDİR"* | **kırmızı + ?** |
| kol kenetlendi | *"Kol nominal açısına oturamadı… bu boy ısmarlanmamalıdır"* | **kırmızı + ?** |

ve boyun OKUNDUĞU panel artık sebebi de basıyor. Bu, modülün kendi kuralının
uygulanması: **geçerlilik sınırı sonucun İÇİNDE taşınır** (B10 çap penceresi ve
tepe yükün *"KALİBRE DEĞİL"* damgasıyla aynı gerekçe).

Beş mutasyonla ölçüldü, beşi de kırmızı: nominal açıyı yine geometrinin altına
alma, panelin köken ayrımını kapatma, yalnız kenetlenme dalını kapatma, kayış
panelinden uyarı kutusunu kaldırma, şüpheli sayıyı işaretlememe.

##### Kipin TOPOLOJİ YÜZEYİ — kayış düğümünde tıklanabilir rozet

Kullanıcı isteği: *"Topoloji üzerinden çok basit bir şekilde 'kayış boyu sabit'
veya 'kayış boyu değişken' seçeneği olsun."*

Kip `node.data.lengthMode`'da ve **panel ile kanvas AYNI alanı okuyor**
(`veFeadBeltMode`) — Kayış Yolu kartındaki kol konumu seçicisinin kuralının
aynısı: iki ayrı ayar tutulsa panel bir kipi, rozet başkasını gösterirdi.

| Yüzey | Ne | Nerede |
|-------|-----|--------|
| Kanvas | Tıklanabilir rozet `SABİT` ↔ `SERBEST` | `veFeadApplyBeltModeBadge` |
| Panel | Açılır seçici + kipe göre değişen künye | `getFeadBeltPropertiesHTML` |

**Rozet salt gösterge değil, SEÇİM YÜZEYİ.** 60×54'lük kayış kutusuna açılır
liste sığmıyor, iki durumlu bir anahtar sığıyor. Renk kipin anlamını taşıyor:
`SABİT` mavi (bir GİRDİ), `SERBEST` amber (bir ÇIKTI — kayışın kendi rengi ve
bu modülde "hesaplanmış" demek).

**Rozet `mousedown`'ı DURDURMAK ZORUNDA:** düğüm sürüklemesi orada başlıyor
(`veAttachNodeDrag`), durdurulmazsa tık hiç gelmiyor — yön gülünde ölçülmüş
"hareketsiz tık kayboluyor" sınıfının aynısı.

**Serbest kipte "Efektif boy" bir ALAN DEĞİL, bir OKUMA.** Alan kaldırılıp
yerine hiçbir şey konmasaydı kullanıcı "boy nereden geldi" sorusuyla baş başa
kalırdı; `veFeadDerivedLengthHTML` türetilen boyu ve hangi kol açısından
geldiğini basıyor (tasarım gerginliğinin "Algılanan Model" tablosunda
görünmesiyle aynı gerekçe). Çözülemeyen modelde sayı UYDURULMUYOR — `—` ve sebep.

**Geçiş `saveState` çağırır** (geri alınabilir): kip bir görünüm tercihi değil,
çözümü değiştiren bir karar. Kol konumu ve yön gülü konumu bunun tersi ve
bilerek öyle.

Altı mutasyonla ölçüldü, altısı da kırmızı.

##### KATALOG BOYU = EFEKTİF BOY — depodaki veriyle kanıtlandı

Üreticiler aynı sayıya farklı ad veriyor: Gates *"effective length"*, Optibelt
ve ContiTech *"reference length L_b"*. Hangisi olduğu MFSim için kritik, çünkü
`belt.effLength` ISO 9981 efektif boyunu bekliyor ve `L_pitch − L_eff = 2π·h_b`
(Gates PK'da **7.54 mm**) — karıştırmak sessiz bir %0.44 kayması olurdu.

Cevap tahminle değil **ölçümle** verildi: BMC tedarikçi sayfası hem kasnak
koordinatlarını hem kayış adını (`8PK 1715`) veriyor. Serbest kip boyu HİÇ
görmeden hesaplıyor:

| hipotez | sapma |
|---|---|
| "1715" **efektif** boy | **0.267 mm · %0.0156** |
| "1715" pitch boy | 7.807 mm · %0.4552 |

Efektif hipotezi **29 kat** daha iyi uyuyor. Katalog adındaki sayı doğrudan
`effLength`'e yazılır, çevrim YOK.

##### "Çözülemez" yerine "sınırda" — kenetlenen kol çözümü

`FEADCore.bisect` kök kuşatılmamışsa açık hata veriyor ve bu **doğru bir
çekirdek davranışı** (sessizce uç nokta döndürmek "makul ama yanlış" cevap
üretirdi — çekirdeğin kendi notu: *"v1'de bu kontrol yoktu"*). Ama kasnak
konumu kanvastan sürüklenebildiği için kullanıcı çözüm uzayına **dışarıdan**
giriyor; her ara karede istisna kullanılamaz bir yüzey olurdu.

`veFeadSolveArmClamped` ayrımı koruyor: hedef kuşatılmışsa **çekirdeğin kendi
çözümü** döner (birebir, toleransı dahil); kuşatılmamışsa en yakın uca
kenetlenir ve sebebi `atLimit` ile taşınır.

**Kenetleme tek başına yetmedi ve sebebi fizikte.** Kolun uç konumu take-up
tekilliğine komşu (`T = M/(dL/dθ)`, `dL/dθ → 0`); oraya kenetlenince
**ÖLÇÜLDÜ: 4.15e10 N** gerginlik çıkıyor ve gerilme/hubload/ömür tablolarına
sızıyordu. Doğal çıkış noktası **keyfî bir eşik değil**: gerginin künyesi kolun
nominal çalışma açısını zaten söylüyor. Sığmayan kayışta anlamlı tek çalışma
noktası odur — serbest kipin bulduğu açının aynısı — ve oradaki
`requiredBeltMm` doğrudan *"hangi kayışı ısmarlamalıyım"* sorusunun cevabı:

> *"Seçilen kayış (1715.0 mm) bu yerleşime 1.6 mm KISA. … Çalışma noktası,
> gerginin nominal kol açısına alındı; bu yerleşim için gereken kayış
> **1733.3 mm**."*

**ÖLÇÜLDÜ:** 1000 mm'lik (700 mm kısa) bir kayışla bile model çözülüyor, ankraj
türetiliyor (643.2 N) ve önerilen boy **1715.3 mm** — yani sayfanın kendi
kayışı. Eskiden bu durum ankrajsız kalıyor, gerilme hiç hesaplanamıyordu.

Önerilen boyun, serbest kipin aynı yerleşimde bulduğu boyla **aynı** olması
testli — iki yol tek cevaba varmazsa biri sessizce yanlış demektir.

##### Geometri ihlalleri İSTİSNA değil, taşınan ihlal (`solveGeometry` hoşgörülü kipi)

Çekirdeğe **eklemeli** bir seçenek girdi: `solveGeometry(resolved, {tolerant:true})`
kapanma (Σsarım ≠ 360) ve temizlik (kayış kasnağın içinden geçiyor) ihlallerini
atmak yerine `geom.violations` olarak döndürüyor. Gerekçe: o iki durumda sayılar
**zaten hesaplanabiliyor** (teğet noktaları, spanlar, sarımlar); geçersiz olan
YOL, aritmetik değil. **VARSAYILAN KAPALI** → 2095 referans değerli doğrulama
kapısı değişmiyor (127 test, birebir yeşil).

**Kasnak çakışması bunun dışında:** orada ortak teğet YOKTUR, üretilecek sayı da
yoktur. Tek gerçek durdurucu odur ve hangi kasnak çifti olduğunu söyler.

Kart artık geçersiz yolu **çiziyor** ve sebebi durum şeridinde adıyla yazıyor
(`✗ Kayış yolu KAPANMIYOR · …`). Çizimi gizlemek teşhisi de gizliyordu — hangi
kasnağın ters sarıldığı ancak ona bakınca görünür.

##### ÜÇ SESSİZ HATA — üçü de geliştirme sırasında oldu, üçü de testli

| Hata | Belirtisi | Ölçüm |
|------|-----------|-------|
| Hoşgörü `feasibleRelMax`'ı bozdu | O fonksiyon kolun fiziksel sınırını **"istisna atıyor mu"** diye arıyordu; hiçbir şey atmayınca sınır **66.5° → 89°** çıktı, kayış hedefi kuşatılmamış sayıldı | BMC `L_eff` 1715.0 yerine **1730.2 mm** (+%0.89) |
| `_geomOpt` `makeSystem`'in SONUNDA atanıyordu | `sense` otomatik bulma probu daha önce ve `geometryAtRaw` **try/catch DIŞINDA** geometri çözüyor | Hoşgörü orada etkisiz, model **kurulmadan** atıyor |
| Dejenerelik ölçütü "sarım" sanıldı | Tekillik `sin(β)`'dan geliyor, sarımdan değil | Ters temasta kenetlenme noktasında sarım **360.00°** (kocaman) ama take-up **1.7e-8 mm/°**, T **3.2e10 N** |

Birincisinin düzeltmesi ince: ölçüt **"geçerli geometri veriyor mu"** oldu, ama
yol BAŞTAN geçersizse (yanlış kasnak sırası) bu ölçüt bütün aralığı elerdi ve
model yine cevapsız kalırdı → o durumda matematiksel alana geri düşülüyor.
Hoşgörü **kapalıyken** iki ölçüt aynı şey (ihlal zaten atar), yani doğrulanmış
davranışa etkisi YOK.

**Kapı altı mutasyonla ölçüldü, beşi kırmızı.** Altıncısı (kuşatma
ön-kontrolünü kaldırmak) **semantik olarak eşdeğer** — `try/catch` zaten aynı
kenetlemeye düşüyor; ön-kontrol sıcak yolda istisna kurmayı önleyen bir hızlı
yol, bağımsız gözlenebilir bir davranış değil.

##### Katalog — `js/fead-belts.js` (5 profil, 244 stok boy + otomotiv ızgarası)

`BELT_DB` (çekirdek) yalnız profil SABİTLERİNİ taşıyor (hb/hr/kütle); standart
BOYLAR ayrı bir katalog katmanında ve DOM'suz (`structural-materials.js` kalıbı).

**KATALOG BİR KISIT DEĞİL, BİR ÖNERİ.** Kullanıcının akışı tasarımdan tedariğe
gidiyor ve Optibelt kataloğu da bunu yazıyor: *"Further dimensions and minimum
order quantities on request"* + ayrı bir *"Intermediate lengths"* satırı. Ara
boy ısmarlanabiliyor, dolayısıyla panel elle girişi engellemiyor.

**İKİ KÜME AYRI ve karıştırılmıyor:**

| Küme | Ne | Nereden |
|------|-----|---------|
| `VE_FEAD_BELT_STOCK` | ISO 9982 / DIN 7867 endüstriyel boylar (PH 37 · PJ 71 · PK 62 · PL 47 · PM 27) | Optibelt "product range" kataloğunun RB bölümü, `profile and Lb (mm)` tablolarından birebir |
| `VE_FEAD_BELT_GRID` | Otomotiv pratiği — bir **KURAL** (5 mm adım), liste değil | piyasa taraması (1700·1705·1706·1707·1710·1714·1715·1720·1725) |

**AYRIMIN SEBEBİ ÖLÇÜLDÜ:** BMC'nin kendi kayışı **8PK 1715 endüstriyel stok
listesinde YOK** — komşuları 1690 ve 1755, yani **65 mm'lik boşluk**. Yalnız
stok listesi katalog sayılsaydı kullanıcının elindeki kayış "katalogda yok"
görünürdü. Izgara ise onu **tam** veriyor.

Izgara neden liste değil: 5 mm adım ölçülmüş bir PRATİK, gerçek üretim yer yer
daha ince (1706, 1707, 1714). 460 satırlık bir liste yazmak olmayan bir
kesinlik iddia etmek olurdu.

**KATALOGUN DEĞERİ LİSTE DEĞİL, SONUÇ.** `veFeadBeltFit` bir aday boyu çözüp
kolun nereye oturacağını ve gerginliği veriyor; "1690 mı 1755 mi" sorusu ancak
böyle cevaplanıyor. **Sığmayan aday bir sayı değil, bir HÜKÜM:** kenetlenme
take-up tekilliğine komşu olduğu için 1690 mm denenince **4.05e10 N** çıkıyor —
o sayı tabloya basılmıyor, `fits:false` ve "sığmıyor" yazılıyor.

**ÜÇ BAĞIMSIZ YOL TEK NOKTADA BULUŞUYOR** (testli): serbest kip geometriden
`1715.27 mm` diyor → katalog ızgarası `8PK1715` öneriyor → o boy seçilince
çözüm sabit kip tabanına (`kol 28.4271° · T 532.142 N · hub 302.125 N`)
**birebir** oturuyor.

Kaburga sayısı yalnız **PK** için yazılı (3–12, ContiTech otomotiv); endüstriyel
kayışlar kaburgalı rulodan kesildiği için diğerlerinde sayı UYDURULMADI —
`veFeadBeltRibsCheck` orada `null` döner, "geçersiz" demez.

Katalogdan boy seçmek **kipi de SABİTLER** (`veFeadPickBelt`): seçilen boy bir
girdi, serbest kipte kalmak kullanıcının seçimini sessizce yok saymak olurdu.

Kapı yedi mutasyonla ölçüldü, yedisi de kırmızı.

#### Üç katman — hangi dosya neyi yapar

| Dosya | Katman | Kural |
|-------|--------|-------|
| `js/fead-core.js` | Hesap çekirdeği | Dışarıdan geldi, **birebir** durur, dokunulmaz (güncelleme de dışarıdan gelir) |
| `js/fead-model.js` | Köprü (DOM'suz) | Kanvas düğümü → `FEADCore.makeSystem()`; temas/sürücü/çap çözümü, hata çevirisi |
| `js/cp-fead.js` | Sunum | Yalnız HTML kurar; **kendi geometrisini hesaplamaz** |

Yükleme sırası (index.html): `fead-model.js` → `fead-core.js` → `cp-fead.js`.
Model katmanı, `cp-fead.js`'in de kullandığı saf yardımcıları (`_feadNum`,
`_feadDefOf`, `_feadIsPulley`, `veFeadContactOf`, `veFeadOD`,
`veFeadRouteOrder`…) bildirir — aynı adı iki dosyada bildirmek üst-seviye
çakışması olurdu (`source-hygiene` kapısı).

#### Kayış BAĞLANTISININ görünüşü — düğüme dokunmadan

**Kasnak kutusu MFSim'in klasik dörtgeni olarak kalır.** Bir denemede kasnaklar
gerçek çapına ölçekli DAİREYE çevrilmiş ve düğümler mm koordinatlarına
dizilmişti; iki sonuç da istenmedi (kutu kimliği kayboldu, topoloji kanvastaki
Kayış Yolu kartının kopyasına döndü) ve **tamamen geri alındı**. Değişen tek
şey TEL:

| Ne | Nerede | Neden |
|----|--------|-------|
| Port KOMŞUYA BAKAN kenardan çıkar | `veFeadPortSideFor` (cp-fead.js) → `defaultPortSide` (components.js) | Klasik kural (giriş solda / çıkış sağda) bir ÇEVRİMDE yolun yarısında ters düşüyor: kayış sağdan sola dönerken tel düğümün ÜSTÜNDEN geri geçiyordu |
| Kontrol kolu uzunluğun **%42**'si (26–96 px) | `connections.js` `curve` dalı, yalnız kayış bağlantısında | Sabit 40 px kısa açıklıkta kutunun dibinde kıvrım, uzun açıklıkta ortada köşelenme veriyordu |
| Amber, 2.5 px | `.ve-connection-fead-belt` | Bu tel "iki bileşen ilişkili" demiyor, "kayış buradan geçiyor" diyor |
| Telin ortasında **gidiş yönü oku** | `veConnDirMark` (connections.js), `.ve-conn-dir` | Aynı halka iki yönde de gezilebilir ve **hangi açıklığın GERGİN olduğu buna göre değişir**; yön topolojiden okunamıyordu |

##### Port DAİRESİ de aynı karede tazelenir (`veSyncPortDom`)

Kenar kuralı `defaultPortSide`'ı **dinamik** yaptı: cevap artık komşunun nerede
olduğuna bakıyor, yani **bir bağlantı kurulunca ya da düğüm sürüklenince
değişiyor**. Telin ucu bunu görüyordu (`getPortPosition` her tazelemede yeniden
hesaplıyor); port DAİRESİ görmüyordu — DOM'a yazan iki yol (`ui-core.js`
`createNode`, `state.js` `restoreState`) yalnız `def.portLayout ||
node.data.portPositions` varsa yazıyor, FEAD kasnağında **ikisi de yok**. Daire,
düğüm kurulurken hesaplanan klasik kenarda (giriş solda / çıkış sağda) çakılı
kalıyordu.

**ÖLÇÜLDÜ (gerçek tarayıcı, elle bağlanan 5 kasnaklı halka):** on uçtan altısı
`36.8 · 42.4 · 48.8 · 54 · 72 px` sapmıştı — yalnız komşusu tesadüfen sağda
kaldığı için klasik kuralla çakışan iki uç 0'daydı. Kullanıcının bildirdiği
"bağlantı portları denk gelmiyor" tam olarak buydu. Düzeltmeden sonra on ucun
onu da **0.00 px**; sürükledikten sonra da, elle taşınmış bir portta da 0.

Tazeleme **TEK NOKTADAN**: `updateAllConnections` (connections.js) her
mutasyondan zaten geçiyor (35 çağrı yeri) ve daire ile tel aynı saf fonksiyondan
(`vePortBoxStyle` / `vePortOffset`) besleniyor. Klasik topolojilerde kenar hiç
değişmediği için tek bir DOM yazması bile olmuyor (ölçüldü: 17 düğüm / 12
bağlantılı Araç Performans örneğinde bütün kenarlar left/right, bütün sapmalar
0). Beş mutasyonla ölçüldü — çağrıyı kaldırma, `portPositions`'ı yok sayma,
yalnız `left` yazma, kenarlık+yarıçap düzeltmesini atlama, değişmese de yazma —
beşi de kırmızı.

**Hesaplara dokunmuyor.** Çözücü mm koordinatlarını panelden okuyor, kanvas
yerleşiminden değil. Ölçüldü: AG00686 **karışık sırayla** elle bağlanınca
(ortadaki telden başlayarak) kayış sırası yine `CRK→IDR→A_C→TEN`, sarım
`210.2 · 26.7 · 202.9 · 26.4`, span `249.2 · 212.6 · 248.9 · 212.6`, Mean kol
açısı `33.1°` — hepsi Gates raporuyla birebir.

##### Port kenarı, yön oku ve araç şeritleri (eski `veFeadArrangeRing` bölümü)

> **HALKA DÜZENİ EMEKLİ.** Bu bölüm "Otomatik Düzenle FEAD'de HALKA kurar"
> başlığıyla yazılmıştı ve halka **konum hiçbir şey ifade etmezken** doğruydu.
> Kanvas kayış düzlemi olduktan sonra halkaya dizmek kullanıcının girdiği bütün
> mm koordinatlarını silmek olurdu; yerini `veFeadArrangeByCoords` aldı (bkz.
> *"KANVAS = KAYIŞ DÜZLEMİ"*). Aşağıdaki halka gerekçesi, aynı yön yeniden
> denenirse nelerin ölçülmüş olduğunu bilmek için duruyor; **port kenarı, yön
> oku ve araç şeritleri** ise bugün de geçerli ve halkadan bağımsız.

Genel yerleştirici (`tidy-layout.js`) katmanlı bir **DAG** düzeni kuruyor:
kenarları soldan sağa sıralı katmanlara bölüyor. FEAD ise kapalı bir **ÇEVRİM** —
katmanlama onu keyfî bir yerden kırıp dönüş telini bütün kümenin üstünden
geçiriyor. **ÖLÇÜLDÜ (BMC örneği, 6 kasnak):** örnek kurulduğunda kesişen tel
çifti 0; "Otomatik Düzenle" sonrası altı kasnak tek bir YATAY sıraya diziliyor ve
`Sürücü Kasnak → Avara 1` dönüş teli hepsinin üstünden geri geçerek 1 kesişim
üretiyordu.

Halka düzeninde kesişim **yapısal olarak** sıfır: kasnaklar kayış sırasında
çember üzerine dizilince her tel yalnız komşusuna gidiyor (ölçüldü: 0). Sürücü
tepede, sıra saat yönünde. Yarıçap kutu köşegeninden **türer** (kiriş
`2R·sin(π/N)`) — sabit yarıçap N büyüdükçe kutuları üst üste bindirirdi. Araç
düğümleri halkanın DIŞINDA: künyeler sol, Kayış Yolu kartı sağ
şeritte — `veFeadLoadExample` ile aynı bölüşüm, yoksa kart halkanın içine düşüp
tellerin altında kalırdı.

**Kutu, sembol ve ölçü DEĞİŞMİYOR** — yalnız konum. mm koordinatı
KULLANILMIYOR: o, kanvastaki Kayış Yolu kartının işi.

Kenar seçimi kutunun **ORANINA** göre (`|dx|·h ≥ |dy|·w`), sabit 45° köşegenle
değil — 72×66'lık krank ile 54×50'lik avarada fark ediyor. Ve bu bir
**VARSAYILAN**: kullanıcı bir portu sağ tıkla taşıdıysa (`node.data.portPositions`)
onun seçimi kazanmaya devam eder.

Yön oku eğride **Bézier'in t = 0.5 noktasından** çıkar
(`B(0.5) = (P0 + 3C1 + 3C2 + P3)/8`); "iki ucun ortası" kontrol kolları eğriyi
bir yana çektiği için telin üstünden kayardı. 46 px'den kısa açıklıkta ok hiç
çizilmez. Dört mutasyonla ölçüldü (Bézier ortası → uç ortası, eşiği kaldırma,
oran → 45°, giriş/çıkış komşusunu takas): dördü de kırmızı.

Örnek yüklenirken araç düğümleri (Kayış Özellikleri · Çözücü · Başlangıç ve
Örnekler · Rapor) **sol şeride** alınır — eskiden kümenin üstüne diziliyorlardı
ve alt topoloji açılışında konan "Başlangıç ve Örnekler" kutusu tam kayış
yolunun üstüne düşüyordu (Klima ↔ Avara 1 açıklığı oradan geçiyor). Bu bölüşüm
**korundu** ama artık kurucunun kendi işi değil: `veFeadArrangeByCoords` bütün
araç düğümlerini kümenin dışındaki iki şeride koyuyor ve örnek kurucusu ona
devrediyor (bkz. *"örnek kurucusu kutuyu koordinatın SÖYLEMEDİĞİ yere
koyuyordu"*).

#### KANVAS = KAYIŞ DÜZLEMİ — konum artık FİZİKSEL

Kullanıcı isteği (2026-08-25): *"Krank kasnağına koordinatları girdiğimiz zaman,
bu koordinatların 0,0 noktası olması ve topoloji üzerinde bileşenleri hareket
ettirdiğimde, örneğin alternatör kasnağını, kanvas üzerinde de hareket etmesi ve
hesapların buna göre anında güncellenmesi."*

Eskiden kanvastaki konum **hiçbir şey ifade etmiyordu** — çözücü mm
koordinatlarını yalnız panelden okuyordu. Artık ikisi TEK BİR ŞEY.

| Ne | Karar | Nerede |
|----|-------|--------|
| Orijin | **Sürücü kasnak** (rol, tip değil) | `veFeadOriginNode` |
| Ölçek | **1 px = 1 mm**, hassasiyet zoom'dan | `VE_FEAD_PX_PER_MM` |
| Y ekseni | Kanvasta aşağı, mm'de **yukarı** | `veFeadCanvasToMm` |
| Gergi sürüklemesi | **Pivot** taşınır, montaj merkezi rijit takip eder | `veFeadDragTensioner` |
| "Otomatik Düzenle" | Halka değil, **koordinata yerleştir** | `veFeadArrangeByCoords` |

**ÖTELEME BEDAVA — ÖLÇÜLDÜ.** Bütün geometri merkez FARKLARINDAN kuruluyor
(`tangent`: `w = c_j − c_i`), dolayısıyla krankı orijine almak ücretsiz. BMC'nin
altı kasnağı + gergi pivotu + montaj merkezi birlikte `(+500, −300)` ötelenince
`ΔL_eff = 0.00e+0`, altı sarım açısında `Δ = 0.00e+0`, gerginlik
`532.142 → 532.142 N` — kayan nokta hassasiyetinde **birebir**. Eski projeler bu
yüzden sessizce göç edebiliyor (`veFeadNormalizeOrigin`, alt topoloji açılışında).

##### Üç sessiz kırılma noktası — üçü de testli

| Nokta | Yanlış yapılırsa | Neden sessiz |
|-------|------------------|--------------|
| **Y ekseni** | Bütün topoloji aynalanır | TAM ayna bütün skalerleri BİREBİR aynı bırakıyor (fizik ayna simetrik); hata sayılardan görünmez, yalnız çizimden |
| **Kutu merkezi** | Her kasnağa kendi kutu yarısı kadar kayma | Kutu ölçüleri 54…72 px arasında değiştiği için kayma kasnaktan kasnağa farklı — tek bir ofsetle yakalanamaz |
| **Gergi** | Pivot bayat kalır, gergi yanlış yerde çözülür | Kol boyu TUTAR (`veFeadArmCheck` geçer), yalnız yerleşim yanlış |

Üçüncüsü **kapı boşluğuydu**: gergi senkrondan çıkarılınca hiçbir test
kırılmıyordu. Orijin sürüklendiğinde krank-göreli HER koordinat aynı karede
tazelenmeli — gergininki ayrı bir geçişe bırakılamaz.

##### mm → px TAM SAYIYA YUVARLANMAZ

1 px = 1 mm olduğu için tam sayı yuvarlaması koordinatı **1 mm'ye kuantalardı**
ve bu sessiz bir kayıp: ölçüldü, alternatörün 1 mm'si gerginliği **38.6 N (%5.9)**
değiştiriyor, gergi kol boyu kapısının toleransı ise 0.5 mm. Yuvarlama 0.01 mm
— her iki eşiğin de çok altında ve gidiş-dönüş kayıpsız.

##### İmza: kasnak konumu girer, araç düğümü GİRMEZ

`veFeadTopoSignature` konumu bilerek dışlıyordu (ölçüldü: 30 sürükleme karesinde
0 yeniden kurulum). Artık konum fiziksel olduğu için kasnak koordinatı imzaya
**giriyor** — bu bilinçli bir geri adım. Ama imzaya giren şey **kanvas pikseli
değil mm koordinatı**: 440×500'lük Kayış Yolu kartını kendi kutusundan tutup
taşımak çözücüyü koşturmuyor.

##### Kademeli tazeleme — ÖLÇÜLDÜ

| Ne | Süre | Ne zaman |
|----|-----:|----------|
| `veFeadSyncMmFromCanvas` (6 kasnak) | 0.025 ms | her karede |
| `veFeadBuildSystem` + geometri (kart) | 2.245 ms | her karede |
| `veFeadAnalyze` (duty + ömür + burulma) | 7.013 ms | **bırakınca** |

Karede koşan toplam **2.27 ms** → 60 fps bütçesinde **7.4× pay**, kare tavanı
441 fps. Tam çözüm sürükleme yolunda HİÇ koşmuyor.

##### BAĞ AÇILIP KAPANABİLİR — `fead-coordlink` "Konum Bağı" (2026-08-28)

Kullanıcı isteği: *"topoloji üzerindeki bileşenleri kaydırdığımızda, gerçekten
koordinatları da değişiyordu. Şu an default olarak öyle. Bunu açılır kapanır bir
özellik haline getirmek istiyorum… ufak, böyle açılıp kapanabilen bir bileşen…
Onu topolojiye çekip açtığımız kapattığımız zaman, yukarıda bahsettiğim özellik
devreye girsin veya devreden çıksın."*

Bağ açıkken kanvas bir BLOK DİYAGRAMI olmaktan çıkıyor: kutular fiziksel
yerlerinde durmak zorunda, yani okunurluk için kaydırılamıyorlar. Yeni düğüm o
bağı kapatılabilir yapıyor — kapalıyken kutu salt görsel, koordinat salt panel
girdisi.

| Ne | Karar | Nerede |
|----|-------|--------|
| Ad / tip | **Konum Bağı** · `fead-coordlink` · 54×48 · 0 giriş / 0 çıkış · `maxInstances:1` | `components.js` |
| Bayrak | `node.data.linked` — yalnız `=== false` anlamlı | `veFeadCoordLinkOn` |
| Okuma | **TEK NOKTA** (kanvas · panel · rozet üçü de aynı fonksiyon) | `fead-model.js` |
| Rozet | `AÇIK` **amber** ↔ `KAPALI` **mavi**, tıklanabilir | `veFeadApplyCoordLinkBadge` |

**DÜĞÜM YOKSA BAĞ AÇIK** — geriye dönük uyum tam bu satırda: bugüne kadar
kaydedilmiş hiçbir projede bu düğüm yok, hepsi birebir eski davranışını
sürdürüyor. Düğüm var ama `linked` yazılı değilse de AÇIK: paletten bırakmak tek
başına modeli değiştirmemeli. **ÇOK KOPYADA KAPALI KAZANIR** (`maxInstances`
ikinciyi engelliyor ama elle düzenlenmiş bir dosya taşıyabilir; açıkça KAPALI
diyen bir düğümü yok saymak kullanıcının talimatını çöpe atmak olurdu).

**RENK ANLAM TAŞIR** ve modülün kendi dilinden geliyor (kayış kipi rozetiyle
aynı): amber = TÜREYEN, mavi = GİRDİ. Bağ açıkken mm kanvastan türüyor,
kapalıyken salt panel girdisi. **Soluk gri REDDEDİLDİ** — bu özelliğin en pahalı
sessiz hatası kullanıcının bağın kapalı olduğunu FARK ETMEMESİ; soluk bir rozet
tam olarak onu davet ederdi. `BAĞLI/SERBEST` de reddedildi: kayış kipi rozeti
aynı kanvasta `SERBEST` yazıyor, 60 px yan yana iki farklı anlam olurdu.

###### BAĞIMSIZLIK SİMETRİK — tek yön kapatmak özelliği ÇALIŞMAZ yapardı

Kapı iki yönde de var ve ikincisi bir incelik değil, özelliğin var olma şartı:

| Yön | Kapı | Kapatılmasaydı |
|-----|------|----------------|
| kanvas → mm | `veFeadSyncDrag` | — (istenen davranış zaten bu) |
| mm → kanvas | `veFeadPlaceFromCoords` | Alt topoloji her açılışta kutuları koordinata GERİ ÇEKER; kullanıcının dizilişi kaybolur. Panele tek bir sayı yazmak da (`veFeadSet` → `VE_FEAD_COORD_KEYS`) o kutuyu tek başına yerine oturtup dizilişi bozar |

**KAPI SAF FONKSİYONUN İÇİNDE DEĞİL.** `veFeadSyncMmFromCanvas` /
`veFeadSyncCanvasFromMm` DOM'suz saf dönüşümler ve öyle kalıyor: kapı oraya
konsaydı bağdan bağımsız olarak koordinat yazması gereken çağıranlar (göç, örnek
kurucu, ileride bir toplu işlem) sessizce engellenirdi. Testi bu ayrımı ayrıca
tutuyor.

**"Otomatik Düzenle" KAPININ DIŞINDA** — açık bir kullanıcı eylemi ve kapalı
bağda tek yönlü uzlaştırma yolu odur. Örnek yükleme de öyle (ona devrediyor).
`veFeadNormalizeOrigin` mm→mm bir öteleme, tek kutuya dokunmuyor → etkilenmiyor.

**Kart tazeleme için ek kapı YOK ve gerekmiyor:** `veFeadTopoSignature` mm
okuyor, piksel değil. Bağ kapalıyken mm değişmiyor → imza sabit → kart yeniden
kurulmuyor. Doğru davranış kendiliğinden çıkıyor.

###### AÇARKEN KUTU KOORDİNATA DÖNER — koordinat kutuya YAZILMAZ

Üç seçenek vardı ve ikisi tehlikeli:

| | Ne yapar | Hüküm |
|---|---|---|
| **(a) kutular mm'ye döner** | model doğrudur, diziliş geçicidir | **SEÇİLEN** |
| (b) mm kutulardan yeniden yazılır | Kullanıcının bağı kapatma SEBEBİNİ (modeli değiştirmeden dizmek) tek tıkla ve sessizce tersine çevirir | RED |
| (c) hiçbir şey | (b)'nin gecikmiş ve daha kötü hâli — aşağıya bak | RED |

(a) ayrıca sistemin kendi davranışıyla tutarlı: alt topoloji her açılışında
`veFeadPlaceFromCoords` zaten kutuları koordinata oturtuyor. Geçiş `saveState`
çağırıyor (geri alınabilir) ve toast kaç kutunun oturduğunu yazıyor — 0 ise
kullanıcı hiçbir şeyin değişmediğini görür.

###### DÜĞÜMÜ SİLMEK = BAĞI AÇMAK — ölçülmüş bir sessiz patlama

Bu, ilk uygulamada **kaçırılan** kusurdu ve (c) seçeneğinin neden reddedildiğini
de açıklıyor. Düğüm silinince bağ AÇILIYOR ("düğüm yoksa AÇIK" varsayılanı),
ama kutular hâlâ serbest yerlerinde. Ayrışma sessiz kalmıyor, **PATLIYOR**:
`veFeadSyncMmFromCanvas` mm'yi **MUTLAK** hesaplıyor (delta değil), dolayısıyla
sonraki İLK sürükleme birikmiş kaymanın tamamını tek karede modele yazıyor.

**ÖLÇÜLDÜ** (BMC, bağ kapalıyken alternatör 80 px sağa / 50 px yukarı dizilmiş,
sonra bağ düğümü silinmiş):

| | alternatör mm | kol |
|---|---|---|
| silmeden hemen sonra | −281.00 | 28.4271° |
| **ve 1 px SÜRÜKLENİNCE** | **−200.00** | **28.0625°** |

Bir pikselin karşılığı **81 mm** — uyarısız, hatasız. Bu, modülün belgelenmiş
38.108 mm sınıfının aynısı. `veFeadCoordLinkAfterDelete` (silme yolundan,
`map.js` `deleteSelectedNodes`) silmeyi rozeti AÇIK'a çevirmekle aynı şey
sayıyor: kutular koordinata döner. Geriye KAPALI bir kopya kaldıysa uzlaştırma
YAPILMAZ.

###### İki yan etki, ikisi de bilinçli

**KENETLEME GERİ GELİR.** Kasnak sürüklenirken hizalama kenetlemesi kapalıydı,
çünkü kutu KENARLARINI yapıştırmak koordinatı sessizce yutuyordu (ölçüldü:
24.514 mm istenirken 3.940 mm). Bağ kapalıyken o gerekçe yok — kutu salt görsel,
kenetleme klasik topolojilerdeki anlamına dönüyor ve yutacak bir mm yok.

**KASNAK PANELİ SEBEBİ YAZIYOR.** Konum X/Y alanları normalde kutuyu da taşıyor;
kapalıyken taşımıyor. Sessiz bırakılsaydı kullanıcı sayıyı yazar, kutu yerinde
kalır ve **alanın bozuk olduğunu sanardı** — oysa model DEĞİŞTİ. Sağlıklı (bağ
açık) durumda metin birebir eskisi: yanlış alarm yok.

**ÖLÇÜLDÜ (gerçek tarayıcı, tek dosya `file://`, BMC):** palet girdisi "FEAD
Araçları" kategorisinde ve `fead-analysis` kapsamında; düğüm 54×48, rozet
`AÇIK` amber; kapatınca hiçbir şey oynamıyor; kapalıyken alternatör kutusu
2736.41 → 2826.41 px (DOM dahil) giderken mm **−281 sabit**; yeniden açınca kutu
2736.41'e dönüyor ve mm yine −281. Konsolda bu özelliğe ait hata yok.

Kapı **on mutasyonla** ölçüldü, onu da kırmızı: sürükleme kapısını silme,
varsayılanı ters çevirme (11 test), ters yön kapısını silme, `saveState`'i
kaldırma, açarken mm←kutu yazma, KAPALI rozetini soluk griye çevirme,
kenetlemeyi bağdan koparma, silme kancasını kaldırma, kasnak paneli uyarısını
yutma, çok kopyada İLKİNİ kazandırma.

##### DÖNÜŞ YÖNÜ — `fead-spin` "Dönüş Yönü" (2026-08-28)

Kullanıcı sorusu: *"kayışın dönüş yönü neye göre belirleniyor? Bu dönüş yönünü
de CW veya CCW olacak şekilde ayarlayacak bir bileşen kuralım yine bir önceki
gibi. Buna göre de matematiği ayarlayalım (eğer değişiyorsa)."*

**YÖN BİR AYAR DEĞİL, ROTA SIRASININ SONUCU.** `FEADCore.loopSense`
(fead-core.js) kasnak merkezlerinin kayış gidiş sırasındaki **ayakkabı bağı
(shoelace) işaretli alanına** bakıyor: `+1` = CCW, `−1` = CW — **motora ÖNDEN
bakışta**. Yani kabloları hangi sırada çektiysen yön odur; `solveGeometry`
onu okuyup her kasnağa `d = (grooved ? s : −s)` veriyor.

###### MATEMATİK: GEOMETRİ DEĞİŞMEZ, GERİLME DEĞİŞİR

| | İleri | Ters | Fark |
|---|---|---|---|
| kasnak başına sarım | — | — | **2,5e−14 °** |
| L_eff (AG00976) | 1716,200 | 1716,200 | **0,000000000 mm** |
| Σ işaretli sarım | 360,00 | 360,00 | 0 |
| kol açısı (meanRel) | 28,075036° | 28,075036° | 0 |
| **span gerilmeleri** | 1381,0 · 1379,7 · 1023,3 · 1021,9 · 545,4 · **544,0** | 545,4 · 544,0 · 67,5 · 66,2 · **−290,3** · **−291,6** | **NEGATİF** |

Geometrinin değişmemesi bir yaklaşıklık değil **cebirsel özdeşlik**: ters
yürütmek hem `s`yi (dolayısıyla her `d`yi) hem de giriş/çıkış teğetlerini
takas ediyor, `(−d)·(θ_giriş − θ_çıkış) = d·(θ_çıkış − θ_giriş)` — iki işaret
birbirini götürüyor. **Hesap katmanına tek satır dokunulmadı.**

Gerilmenin değişmesi de fizik: `spanTensions` ankrajı gergiye yazıp
(`T[gergi] = designTensionN`) kayış gidiş yönünde yürüyor — sürücüde `+P/v`,
aksesuarlarda `−P/v`.

###### GERGİ GEVŞEK TARAFTA OLMALI — 14 Gates sisteminin 14'ünde de öyle

Ters yönde gergi krankın **GERGİN** tarafına düşüyor ve spanlar ankrajın
altına iniyor. Bu bir modelleme kusuru değil, gerçek bir tasarım kuralı:
otomatik gergi gevşek tarafa konur, gergin tarafta tahrik gerginliğinin
tamamını yayla karşılamak zorunda kalır ve durdurucusuna dayanır.

**ÖLÇÜLDÜ:** doğrulama fixture'ındaki 14 kurulabilir sistemin **14'ünde de**
ankraj GLOBAL MİNİMUM, üstelik gergi sıranın SON kasnağı. İstisna yok.

Ölçüt **EŞİKSİZ** (`veFeadTensionerSide`): *"ankrajın altına inen span var
mı"*. Negatif sayı ARAMAZ — negatiflik o durumun yalnız uç hâli.
*"Gergi kranka komşu olmalı"* gibi bir KONUM kuralı yanlış olurdu: aralarında
güç çekmeyen bir avara bulunabilir ve bu geçerlidir (sentetik olarak ölçüldü).
Sayılan şey komşuluk değil, **GÜÇ**.

###### ÜÇ SESSİZ KUSUR — üçü de bu turda çıktı

| Kusur | Belirti | Kök neden |
|-------|---------|-----------|
| **Ters kablolama sessizce kabul ediliyordu** | `route.ok`, `build.ok`, `build.warnings = []`; Kayış Yolu kartı **YEŞİL** (Σ=360, L geçerli) — ve gerilmeler negatif | Gerginin hangi tarafta olduğunu soran tek satır yoktu |
| **Panel ULAŞILAMAZ bir çare gösteriyordu** | *"kayış gevşiyor: tasarım gerginliği yetersiz"* + *"Tasarım gerginliğini yükseltin"* | O alan 2026-08-25'te **girdi olmaktan çıktı** (yay dengesinden türüyor). `grep designTension js/cp-fead.js` → **sıfır eşleşme**. Aritmetik olarak işe yarardı (544 → 900 N negatifleri kaldırıyor) ama basılacak düğme yok |
| **Uyarı raporlara HİÇ ULAŞMIYORDU** | 12 duty satırının 10'u uyarı taşırken `R.warnings = null`; iki raporun da "Çözümün taşıdığı uyarılar" kutusu **BOŞ** | Çekirdeğin uyarısı `analysis.duty[i].warnings` içindeydi; `_frWarnBox` / `_fsrWarnBox` yalnız üst seviyeye bakıyor |

**KAYMA HÜKMÜ DE BASTIRILDI.** `slipSafety` gevşek tarafı `1e-9`'a
kenetliyor, dolayısıyla çöken bir zincirde `SF = −0,00` çıkıyor ve panel onu
`✗ KALDI` diye basıyordu. Negatif bir emniyet faktörü fiziksel olarak
anlamsız — o sayı kayma değil, çöken gerilme zincirinin sayısal gölgesi.
Ters yerleşimde kayma hükmü artık **verilmiyor** ve bu yazılı.

###### BİLEŞEN DURUM TUTMUYOR — KABLOLARI ÇEVİRİYOR

| Ne | Karar | Nerede |
|----|-------|--------|
| Ad / tip | **Dönüş Yönü** · `fead-spin` · 54×48 · 0/0 · `maxInstances:1` | `components.js` |
| Durum | **YOK** — yön kabloların kendisinde | `veFeadReverseRoute` |
| Okuma | **TEK NOKTA** `veFeadCurrentSpin` (rozet + panel) | `cp-fead.js` |
| Rozet | `↺ CCW` ↔ `↻ CW` — **glif durumu, RENK hükmü taşır** | `veFeadApplySpinBadge` |

Düğüme `data.dir` gibi bir alan koymak ikinci bir gerçek kaynağı yaratırdı ve
**üç yerden ısırırdı**:

1. Kanvastaki gidiş oku (`veConnDirMark`) telin from→to yönünü çiziyor —
   bayrakla ok **yalan söylerdi**.
2. `veFeadTopoSignature` tel uçlarını okuyor ama araç düğümlerinin `data`'sını
   **OKUMUYOR** (ölçüldü). Bayrak imzaya girmezdi → rozete tıklayınca kart
   doğrudan çağrıyla tazelenir ama **GERİ AL sonrası bayat kalırdı**.
3. Bayrak silinince yön sessizce dönerdi → ayrı bir silme kancası gerekirdi.

Kabloyu çevirmek üçünü birden yok ediyor. **ÖLÇÜLDÜ:** kablo çevirmenin
verdiği sıra, *"krank sabit + kalanı ters"* kuralının verdiği sırayla birebir
aynı — yani bayrak yolunun tek iddia edilen üstünlüğü (kabloya dokunmamak)
karşılıksız. Takas **YERİNDE**: `createConnection` kimliği `'conn-' +
Date.now()` ile ürettiği için altı teli yeniden kurmak altı ÖZDEŞ kimlik
verirdi.

**RENK ÜÇÜNCÜ BİR EKSEN.** Aynı kanvasta iki rozet daha var (`SABİT/SERBEST`,
`AÇIK/KAPALI`) ve ikisinde de renk *"mavi = GİRDİ, amber = TÜRETİLEN"* demek.
CW ile CCW'nin **ikisi de eşit meşru**; birine amber vermek *"bu yön
hesaplanmış, öbürü girilmiş"* derdi ve yalan olurdu. Durumu **ok** taşıyor,
renk ise bu yönün **çalışıp çalışmadığını**: yeşil = gergi gevşek tarafta,
kırmızı = gergin tarafta, nötr = henüz çözüm yok (hüküm uydurulmaz).

###### İKİ ÖLÇÜLMÜŞ KUSUR — ikisi de kapı yazılırken çıktı

**1 · YÖN DÜĞÜM DİZİSİ SIRASINDAN OKUNUYORDU.** Rozet
`nodes.filter(isPulley)` sırasını `loopSense`'e veriyordu. O sıra kayış yolunu
anlatmıyor: örnek yüklenirken tesadüfen örtüşüyor, ama **kablolar çevrilince
dizi değişmiyor** — rozet çevirdikten sonra da eski yönü gösteriyordu. Okuma
artık `veFeadRouteOrder`'dan.

**2 · ROZET BİR ÇÖZÜM GERİDE KALIYORDU.** Rozetin RENGİ hükmü taşıyor ve hüküm
ancak çözümle biliniyor; `veFeadSolve` rozetleri tazelemiyordu. **ÖLÇÜLDÜ
(gerçek tarayıcı):** ileri yönde nötr, ters yönde **YEŞİL**, geri dönünce
**KIRMIZI** — renk her seferinde bir önceki modelin hükmünü gösteriyordu.

**ÖLÇÜLDÜ (gerçek tarayıcı, tek dosya `file://`, AG00976):**

| | rozet | renk | yön | gergi | min T |
|---|---|---|---|---|---|
| ileri | `↺ CCW` | yeşil | +1 | gevşek ✓ | **544,0 N** |
| ters | `↻ CW` | **kırmızı** | −1 | **gergin ✗** | **−291,6 N** |
| geri | `↺ CCW` | yeşil | +1 | gevşek ✓ | 544,0 N |

Gidiş-dönüş birebir (`1381 · 1379,7 · 1023,3 · 1021,9 · 545,4 · 544`), konsol
hatası yok.

Kapı **on bir mutasyonla** ölçüldü, on biri de kırmızı: doğal yön işaretini
çevirme, gergide `cenX` yerine `x` kullanma, araç tellerini de çevirme, yönü
düğüm dizisinden okuma, hükmü yalnız negatif sayıya bağlama, uyarıyı üst
seviyeye yükseltmeme, panelde eski yanlış teşhise dönme, CW/CCW'yi farklı
renklendirme, çevirmede `saveState`'i kaldırma, port yazmayı atlama, çözüm
sonrası rozet tazelemesini kaldırma.

##### Gerçek çap hayaleti — KALDIRILDI (2026-08-26)

> **EMEKLİ.** Kullanıcı bildirimi: *"topolojide bu bileşenlerin etrafına böyle
> sanal bir çizgili daireler çizmişsin. Onları kaldıralım, gerek yok."*
> `veFeadApplyDiaGhost` / `veFeadRefreshDiaGhosts` / `.ve-fead-dia` tamamen
> silindi. Aşağısı, aynı yön yeniden önerilirse nelerin ölçülmüş olduğunu
> bilmek için duruyor — çünkü hayaletin ÇÖZDÜĞÜ sorun hâlâ yerinde.

Kutu 54–72 px, gerçek kasnaklar 57–162 mm; birebir ölçekte kutu krankı **2.25 kat
küçük** gösteriyor. Konum fiziksel olduğu için bu yanıltıcı: **çakışmayan iki
kutu, çakışan iki kasnak** olabilir — ve çekirdek onu "kayış kasnağın içinden
geçiyor" diye reddeder. Hayalet o çarpışmayı hata çıkmadan ÖNCE görünür yapıyordu.
Kasnaklar daireye çevrilmiyor: `c48fe17`'de denendi ve kullanıcının isteğiyle
geri alındı.

**Kaldırırken ölçülen bir BOŞLUK:** özelliğin tamamı silindiği hâlde 5918
birim testinin hiçbiri kırılmadı — hayaletin hiç kapısı YOKTU. Bugün o
çarpışmayı gösteren tek yüzey, çözüm anında çekirdeğin verdiği hata.

Kaldırma bir NEGATİF KAPIYLA kilitlendi (Geometri panelindeki *"incelik
seçicisi ve 'Kenarlar' kutusu YOK"* kalıbının aynısı): `veFeadApplyBadge`
kasnak kutusuna kesikli çember çizmiyor, ve üretici/tazeleyici dışa
açılmıyor. Kapı sınıf adına DEĞİL biçime de bakıyor (`border-radius:50%` +
`dashed`), yoksa başka adla geri gelebilirdi. Ölçüldü: çağrıyı geri koyan
mutasyon kırmızı.

Silinince iki temizlik daha gerekti (ikisi de yapıldı): rozet gerekçesi kendi
fonksiyonundan kopup `veFeadSyncDrag`'in yorumuna kaynamıştı, ve `veFeadSet`
içindeki `if` tek ifadeyi sarar hâle gelmişti.

##### "Otomatik Düzenle" artık koordinata yerleştiriyor

Halka düzeni doğruydu — **konum hiçbir şey ifade etmezken**. Artık halkaya
dizmek kullanıcının girdiği bütün mm koordinatlarını SİLMEK olurdu, yani
"düzenle" düğmesi modeli bozardı. Yeni anlamı: kanvas konumlarını mm'den yeniden
kur. Koordinatı olmayan kasnak gizlenmiyor, kümenin altına diziliyor (sessizce
(0,0)'a koymak iki kasnağı üst üste bindirirdi).

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı.

##### GERÇEK TARAYICI iki sessiz kaymayı daha çıkardı

Birim testler koordinat katmanını Node'da doğruluyor; zincirin yarısı orada
HİÇ koşmuyor (gerçek `mousedown/mousemove/mouseup`, `canvasZoom` bölmesi,
DOM'a yazılan `style.left`, kartın `innerHTML` ile yeniden kurulması).
`tests/e2e/fead-canvas-drag.spec.js` onu koşturdu ve **iki ayrı kayma** çıktı.
Ortak imzaları: kutu doğru yerde duruyor, panel doğru sayıyı gösteriyor, hiçbir
hata çıkmıyor — yalnız model kullanıcının koymadığı bir koordinatla çözülüyor.

**1 · Örnek kurucusu kutuyu koordinatın SÖYLEMEDİĞİ yere koyuyordu.**
`veFeadLoadExample` kümeyi 520×400'lük bir kutuya sığdıran **kendi ölçeğini**
kullanıyordu (BMC'de ×1.1178) ve kutuları köşe koordinatıyla diziyordu — kanvas
kayış düzlemi OLMADAN önce doğru olan, sonra yalan olan bir yerleşim.

**ÖLÇÜLDÜ (gerçek tarayıcı, BMC, HİÇ SÜRÜKLEMEDEN):**

```
alternatör kutu merkezi − krank kutu merkezi = −319.108 px
alternatör mm koordinatı                     = −281.000 mm   → 38.108 mm FARK
```

Fark iki parçalı: ölçek payı (`−281 × 0.1178 = −33.11`) + kutu genişliği payı
(`(54−72)/2 = −5.00`). Sessizliğin sebebi **hatanın ilk sürüklemeye kadar
görünmemesi**: `veFeadSyncMmFromCanvas` kanvası okuyup mm'yi tazelediği için o
38.108 mm koordinatın üstüne biniyor — kullanıcı 60 px sürüklüyor, model 98 mm
oynuyor. Düzeltme yeni bir hesap değil, **ikinci bir hesabın kaldırılması**:
kurucu artık `veFeadArrangeByCoords({silent:true})`'a devrediyor, yani panel
düzenlemesinin ve "Otomatik Düzenle"nin kullandığı yolun ta kendisine.

| | eski | yeni |
|---|---:|---:|
| altı kasnağın en büyük sapması | **38.108 mm** | **0.0000 mm** |
| 60 px sürüklemenin karşılığı (zoom 0.653) | −98.1 mm | **−91.926 mm** (= istenen) |

**2 · Hizalama kenetlemesi koordinatı yiyordu.** `checkAlignment` kutu
KENARLARINI yapıştırır ve bunu yaparken **bütün** düğümler için sabit 65 px
genişlik varsayar; kasnak kutuları 54…72 px olduğu için hizalanan şey ne merkez
ne kenar. Varsayılan KAPALI (`SNAP_ENABLED`), yani ancak kullanıcı açtığında ya
da Q basılı tutulduğunda ateşleniyor — bu yüzden ilk ölçümde **hiç
görünmedi** ve ancak açıkça açılarak yakalandı.

**ÖLÇÜLDÜ** (BMC, alternatör Avara 2'nin satırına doğru 16 ekran px yukarı,
zoom 0.653 — Avara 2 mm'de 7.94 mm yukarıda, yani 8 px eşiğinin tam içinde):

| | istendi | oldu |
|---|---:|---:|
| kenetleme FEAD'de **açık** | 24.514 mm | **3.940 mm** |
| kenetleme FEAD'de **kapalı** (bugünkü hâl) | 24.514 mm | **24.514 mm** |

20.6 mm sessizce yutuluyordu. Kenetleme artık FEAD kasnağı sürüklenirken
devre dışı (`js/ui-core.js`); klasik topolojilerde aynen çalışıyor.

Üç mutasyonla ölçüldü (eski ölçekli yerleşimi geri getirme, `silent` bayrağını
yutma, kutu konumunu yine tam sayıya yuvarlama) — üçü de kırmızı; kenetleme
kapısı ayrıca E2E'de (Node'da hiç koşmuyor).

##### Örnek KULLANIMA HAZIR gelir — başlangıç kutusu gider, Rapor kalır (2026-08-26)

Kullanıcı isteği: *"'Başlangıç ve Örnekler' bileşeni silinmiş ve 'Çözücü'
bileşeninin altına 'Rapor' bileşeni gelmiş"* olsun.

| Ne | Neden |
|----|-------|
| `fead-example` örnek yüklenince **SİLİNİR** | O düğüm bir AÇILIŞ yüzeyi (`veFeadPopulateStarter` onu alt topoloji BOŞKEN koyuyor) ve tek işi örnek listesini sunmak. Örnek kurulduktan sonra sol şeritte yer kaplıyor ve "buradan devam et" diyen bir düğme gibi duruyordu — oysa devam edilecek yer kurulmuş modelin kendisi |
| `fead-report` örneğe **EKLENİR** | `ex-layout` ile aynı gerekçe: örnek "çözülebilir bir model" değil, KULLANIMA HAZIR bir model. Kullanıcı raporu almak için bileşeni paletten ayrıca aramak zorunda kalıyordu |

**SİLME `deleteSelectedNodes` DEĞİL.** `fead-example` girişsiz/çıkışsız, yani
bağlantısı yok; silmek diziden ve DOM'dan çıkarmakla bitiyor. O fonksiyon ise
sensör/parametrik referanslarını da tarıyor ve `selectedNodes` global'ini
TÜKETİYOR — burada seçim kullanıcınındır.

**SPLICE, YENİDEN ATAMA DEĞİL:** `nodes = nodes.filter(...)` global'i yeni bir
diziye bağlar; tarayıcıda çalışır (bütün betikler aynı global'i paylaşıyor) ama
Node testinde `global.nodes` bayat kalır.

**SIRASI YERLEŞTİRİCİDEN ÖNCE.** Sonra silinseydi sol şeritte ona ayrılmış boş
bir sıra kalır (kutu 56 px + 24 boşluk), kalan üç kutu 40 px yukarıda ve kümeye
göre ortalanmamış dururdu.

**ŞERİT SIRASI PUSH SIRASIDIR.** `veFeadArrangeByCoords`'un `serit()`'i araç
düğümlerini `nodes` dizisi sırasına göre diziyor ve o dizi
`veFeadExampleNodes`'un push sırasından geliyor: `ex-belt → ex-solver →
ex-layout → ex-report`, layout sağ şeride ayrıldığı için sol şerit
**Kayış Özellikleri → Çözücü → Rapor**. Rapor solver'dan önce push edilseydi
şeritte de onun üstünde çıkardı.

**BEDELİ:** örnek bir kez yüklendikten sonra `veFeadPopulateStarter` bir daha
koşmuyor (yalnız alt topoloji BOŞKEN koşuyor), yani başka bir örnek yüklemek
için `fead-example` paletten geri sürüklenmeli. Palette duruyor ("FEAD
Araçları"). Zaten dolu bir kanvasa ikinci örnek kurmak kasnakları üst üste
bindirirdi; silme bu yüzden akışla tutarlı.

##### Kart 420×340 → 440×500, ve AŞILMIŞ VARSAYILANLAR bir LİSTE

Kullanıcı isteği: *"Kanvas biraz boyuna geniş [olsun]"*. Eski ölçü bir ALT
SINIRDI, hedef değil: 420×340, FEAD_INFORMATION oranı (465×315 mm) ve okunabilir
en küçük kasnak adı için hesaplanmıştı.

**ÖLÇÜLDÜ** (BMC, 420×340): şemaya kalan alan 330×262 px ve kayış yolu
316.3×262 ile YÜKSEKLİĞE dayanıyordu. 440×500'de (şerit de koşullu olunca) aynı
içerik **404 × 334.7** px'e çıkıyor. Kazanç TEK BİR ÖLÇEK ÇARPANI, altı kasnakta
da aynı: **1.277, yani +%27.7** — yarıçaplar `45.5→58.0 · 42.7→54.5 · 21.3→27.3
(×3) · 16.4→21.0` (alternatör Ø57, en küçüğü). Sabit şeritlerin (SER 20 + SEC 22)
yüksekliğe maliyeti de **%12.4 → %8.4**.

> Bu paragraf bir kez YANLIŞ yazıldı ("alternatör 24.9 → 34.5 px, %38") ve
> çapraz denetim yakaladı: 24.9 bir yarıçap değil, kayış yolunun x ofsetiydi.
> Doğrusu 16.4 → 21.0 px, +%27.7. "Makul ama yanlış" sınıfı, kanonik kayıtta.

`VE_FEAD_LAYOUT_LEGACY` artık **LİSTE** (`[{60,56}, {420,340}]`), tek çift değil:
60×56 kart-öncesi (Aşama 0–3) ölçüydü, 420×340 kartın ilk varsayılanı. İkincisi
listeye alınmasaydı bugüne kadar kaydedilmiş HER proje eski küçük kartla açılır
ve aynı sürümde iki farklı kart ölçüsü dolaşırdı. Kapı ayrıca listedeki hiçbir
çiftin GÜNCEL ölçü olamayacağını arıyor — olsaydı göç kendini sonsuza kadar
"değişti" sayıp her açılışta `saveState`'i kirletirdi.

Kapı yalnız alt sınırlara bakmıyor: **`H > W`** de aranıyor. İki alt sınır
(`W > 300`, `H > 240`) tutulsaydı 500×440 — yani YATAY bir kart — da geçerdi ve
"boyuna geniş" isteği sessizce geri alınabilirdi. "Bilerek verilen ölçü korunur"
testi de artık ne güncel ne aşılmış hiçbir çiftle örtüşmeyen bir ölçü kullanıyor
(640×420); eskisi 640×**500** idi ve 500 yeni `VE_FEAD_LAYOUT_H`'in ta kendisi
olmuştu, yani test doğru sebepten değil tesadüfen geçiyordu.

`veFeadLayoutCardHTML`'deki `|| 420` / `|| 340` yedeği de kaldırıldı: kart
ölçüsünün İKİNCİ KOPYASIYDI ve büyüme sırasında sessizce eskimişti
(`components.js`'in kendi kuralı: *"ölçü tip tanımlarına BURADAN yazılır, defs
içinde ayrıca sayı tutulmaz"*).

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

#### Kanvasta tel çekmek — çizim KURULAN topolojiyi gösterir

Kullanıcı bildirimi (2026-08-21): *"bağlantıyı kopardığımda kanvastaki görüntü
gitmiyor, tekrar bağlamaya çalıştığımda da bağlanmıyor; araya bileşen
ekleyemiyorum. Bu da programın çözeceği problemlerin ezbere olabileceği
kanısına vardırıyor."* Üretildi ve **üç ayrı sessizlik** çıktı.

**1 · Güzergâh çözücüsü kopuk kasnağı sessizce kayışa katıyordu.**
`veFeadRouteOrder`'ın son satırı şuydu:

```js
pulleys.forEach(function(p){ if(!seen[p.id]) order.push(p); });   // ESKİ
```

Yani zincire bağlı OLMAYAN kasnak sıraya ekleniyordu; çekirdek de pekâlâ
"geçerli" bir kapalı çevrim çözüyordu. **ÖLÇÜLDÜ (gerçek tarayıcı, BMC):**
"Avara 2"nin iki teli de silindikten sonra kart hâlâ `✓ 6 kasnak · L 1715.0 mm`
diyordu. Çizim, kurulan TOPOLOJİYİ değil bileşen LİSTESİNİ gösteriyordu — yani
kullanıcının "ezbere" sezgisi bu satırda haklıydı.

Artık `veFeadRouteDiagnose` sırayı üretirken geçerliliği de taşıyor: çevrim
kapalı mı, kopuk kasnak var mı, bir kasnaktan iki tel mi çıkıyor. `build`
bunlara bakıp **çözmeyi reddediyor ve sebebini adıyla yazıyor**
("Kayış yoluna bağlı olmayan kasnak var: Avara 2"). Sıra yine BÜTÜN kasnakları
taşır — yerleştirici (`veFeadArrangeByCoords`) ve rozetler kopuk kasnağı da görmeli;
ayrılan şey sıra değil, GEÇERLİLİK.

> Bu değişiklik bir testi kırdı ve kırdığı için değerliydi: `fead-model.test.js`
> içindeki uçtan uca AG00686 testi `veFeadBuildSystem(kur().list, kur().conns)`
> yazıyordu. `kur()` her çağrıda YENİ kimlikler ürettiği için bağlantılar başka
> bir düğüm kümesini gösteriyordu — yani test kabloları hiç sınamıyordu, eski
> "kopuğu sıraya ekle" davranışı sayesinde dizi sırası tesadüfen doğru yolu
> veriyordu.

**2 · Kart bağlantı değişince hiç tazelenmiyordu.** Kartın tek tazeleme noktası
`saveState()`'ti; ama `saveState` mutasyondan **ÖNCE** çağrılıyor (geri-al
yığınına ön durumu koymak için, bkz. `handleConnectionContextAction`). Tel
silindikten sonra kartı yenileyen hiçbir şey yoktu. Tazeleme artık
`updateAllConnections`'ta — her mutasyondan geçen tek nokta, port DOM senkronu
da aynı gerekçeyle oraya bağlıydı — ama **topoloji imzasına** bağlı:
`veFeadTopoSignature` düğüm kimlikleri ve tel uçlarından üretiliyor, KONUM
girmiyor. **ÖLÇÜLDÜ:** 30 sürükleme karesinde kart yeniden kurulumu **0**
(kurmak çözücüyü koşturmak demek).

**3 · Geçersiz port çifti sessizce yutuluyordu.** İki çıkışa arka arkaya
tıklamak hiçbir şey yapmıyor, hiçbir mesaj çıkmıyordu. FEAD'de bu özellikle
yanıltıcı: port kenarı komşuya bakacak şekilde DİNAMİK (`veFeadPortSideFor`),
yani "giriş solda / çıkış sağda" ipucu yok — kullanıcı hangisinin ne olduğunu
konumdan okuyamıyor. Karar tek yerde toplandı (`veTryConnectPorts`, ui-core.js;
`state.js`'teki ikinci kopya ona devretti) ve sebep yazılıyor. İki kopya
kalsaydı geri-al/yükle sonrası kurulan portlar o mesajı vermezdi.

**Ayrıca:** kurulum geçerli olup da geometri çözülemediğinde kart yalnız
"Kayış yolu henüz kurulamadı" diyordu; çekirdeğin sebebi (`build.geomError`)
artık kartta ve panelde basılıyor.

**Kural:** kanvasta çizilen tel HER ZAMAN görünür ve HER ZAMAN çözüme girer.
Model tutarsızsa şema yerine SEBEP yazılır — tel gizlenmez, bağlantı
reddedilmez. **ÖLÇÜLDÜ (çözümün modele bağlı olduğunun kanıtı, BMC):** iki
avarayı kayış sırasında takas etmek, alternatörü 20 mm oynatmak ve bir temas
tarafını çevirmek — üçü de çözücüyü reddettiriyor ve sebebini yazıyor; geri
alınca sarım açıları birebir geri geliyor (`154.3 · 52.8 · 198.4 · 64.3 ·
157.4 · 33.0`).

#### İKİ YÜZEY — graf GİRDİ, kart ÇIKTI (`js/fead-graph.js`)

> **BU BÖLÜM BAYAT — anlatılan yüzey kodda YOK.** `js/fead-graph.js`, dairesel
> kasnak düğümü, açısal port ve `veFeadArrangeGraph` `c48fe17` ile **geri
> alındı** (kullanıcı geri bildirimi: "tipik dörtgen topoloji bileşenleri devam
> etsin; sadece bağlantılarını daha estetik yapalım"). Bugün geçerli olan
> yukarıdaki *"Kayış BAĞLANTISININ görünüşü — düğüme dokunmadan"* bölümüdür.
> Aşağısı, aynı yön yeniden denenirse nelerin ölçülmüş olduğunu bilmek için
> duruyor.

FEAD iç topolojisi artık serbest bir blok diyagramı değil: kasnaklar
**girilen mm koordinatlarına** oturur (kanvasta **1 px = 1 mm**), düğüm
**girilen çapında bir DAİRE**dir, portlar kayış sırasındaki **komşuya bakar**.
Ölçülen kazanç: BMC örneğinde tel kesişimi **3 → 0**.

Bunu yapmayan bir yerleşim üç ayrı sebeple karışıyordu ve üçü de kapatıldı:
konum keyfîydi (kasnağın mm koordinatı ekranda hiçbir şey ifade etmiyordu),
port sabitti (giriş SOLDA / çıkış SAĞDA → kayış sağdan sola dönerken tel
düğümün üstünden geri geçiyordu), biçim dikdörtgendi (çap ekranda yoktu).

**Graf, Kayış Yolu kartının yerine GEÇMEZ — bölüşüm görüntüye göre değil
YETENEĞE göre:**

| | Graf = **girdi** yüzeyi | Kart = **çıktı** yüzeyi |
|---|---|---|
| Ne gösterir | çözücü **olmadan** çizilebilen her şey | yalnız **çözücünün** söyleyebildiği şey |
| İçerik | merkez, çap, temas tarafı, sürücü rolü, serpantin sırası, pivot | sarım açıları, span, L_eff, `Σsarım=360` kapısı, gerginlik, take-up |
| Yarım modelde | **çalışır** (3 kasnak, kayış kapanmamış) | "kapanmıyor — temas tarafına bak" der |
| Etkileşim | düzenlenebilir | salt okunur gösterge |

Ölçüldü: doğru kurulmuş BMC modelinde girilen gergi montaj merkezi
(−170.08, 99.16) ile çözücünün bulduğu çalışma merkezi (−170.12, 98.46)
arasında **0.70 mm ≈ 0.21 px** var. Yani model doğruyken iki resim ayırt
edilemez — bu gereksizlik değil, **doğrulamanın kendisi**; ayrıldıklarında
(ters temas tarafı, ters pivot, işareti yanlış koordinat) fark teşhis olur.
Yapısal olarak grafın **asla** yapamayacağı şey ise şu: grafta bir kasnak =
bir düğüm, düğümün tek konumu var; gergi kasnağının ise BMC'de **4 ayrı
konumu, 59.9 mm'lik bir zarfı ve 374…876 N aralığı** var — kart TÜMÜ kipinde
dördünü üst üste çizebiliyor. Bu yüzden "kenar = çözülmüş kayış" (etüt 1'in E
alternatifi) **yapılmadı**.

**Biçim üç kanal taşıyor** (`css .ve-node--fead-pulley`): çeper ÇAPI → dış çap,
çeper DOKUSU → temas tarafı (düz = kaburgalı, kesikli = sırt), çeper RENGİ →
rol (sürücü amber · aksesuar mavi · avara nötr · gergi yeşil — kartın pivot
rengiyle aynı). Tip kimliği ortadaki sembolde kalır.

**Ölçek SABİT (1 px = 1 mm), "görünüme sığdıran" değil:** sığdıran ölçek daha
şık dururdu ama iki kasnağın ekrandaki oranı topolojiden topolojiye değişirdi.
Alt/üst sınıra çarpan kasnak ölçekli DEĞİLDİR ve işaretlenir. Çapı GİRİLMEMİŞ
kasnak nötr ölçüde (`VE_FEAD_NODIA_DIA = 64`, `componentDefs` varsayılanıyla
aynı sayı — testi var) ve noktalı çizilir: tipe göre uydurulmuş bir çapı
(krank 180 mm) ölçekli göstermek, biçimin taşıdığı tek bilgiyi yalan yapardı.

**Port artık AÇI** (`portPositions[pid] = {side:'angle', deg}`). `deg` EKRAN
düzleminde ölçülür: 0° = +X, 90° = **aşağı** — yani doğrudan
`atan2(Δy_ekran, Δx_ekran)`. Tek geometri kaynağı yine `vePortOffset`
(components.js): port DOM'u, bağlantı ucu ve pano üçü de oradan okuyor.
Teğet noktası DEĞİL merkez doğrultusu kullanılıyor — teğet için çözücü gerekir,
graf ise çözücüsüz de çalışmak zorunda.

**"Otomatik Düzenle" FEAD'de kendi yerleştiricisine gider** (`veTidyLayout` →
`veFeadArrangeGraph`). Genel yerleştirici katmanlı bir DAG düzeni kurar; FEAD
bir ÇEVRİM, katmanlamak onu keyfî bir yerden kırar ve dönüş kenarını her şeyin
üstünden geçirir. Kasnak biçimi/ölçüsü ise **`saveState()`'ten** tazelenir —
Kayış Yolu kartıyla aynı tek nokta.

Kayış bağlantısı **düz çizgi ve amber** (`.ve-connection-fead-belt`): kayışın
kasnaklar arası parçası fizikte zaten bir doğru, ve bu tel "iki bileşen
ilişkili" demiyor, "kayış buradan geçiyor" diyor. Dışa aktarma (SVG/PNG) da
kasnağı daire + kesikli çeperle çiziyor — ekranda daire olanın çıktıda kutu
çıkması `node.data.labelPos` hatasının aynı sınıfıydı.

#### Kanvasta CANLI kayış yolu kartı (`fead-layout`)

"Kayış Yolu" düğümü bir düğme değil: tuvalin üstünde, topolojinin **yanında**
duran ölçekli bir şema (440×500). Girdi değiştikçe yeniden çizilir, yani
kullanıcı modelinin tutarlı olup olmadığını **panel açmadan** görür. Topoloji
grafiği kayışın SIRASINI gösteriyor ama ŞEKLİNİ göstermiyor; üst üste binen iki
kasnak, ters temas tarafı ya da işareti yanlış bir koordinat orada fark
edilmiyor — kart o boşluğu kapatıyor.

Şema düğümlerin KANVASTAKİ yerinden değil, kasnakların kayış düzlemindeki (mm)
koordinatlarından çizilir; düğümü sürüklemek şemayı değiştirmez. Parçalar
`data-ve` ile adlandırılı (`belt`, `pulley`, `spin`, `pivot`, `arm`, `compass`)
— ham "A" sayarak yay saymak kırılgandı, oklar ve yön gülü de yay çiziyor.

| İşaret | Ne söylüyor |
|--------|-------------|
| Turuncu yol | çekirdeğin teğet noktaları + işaretli sarım yayları |
| Yol üstündeki **dişler** | kayışın **kaburgalı yüzü** — kaburgalı temas edende kasnağın İÇİNE, sırttan temas edende DIŞARI bakar |
| Kesikli çember | kayış o kasnağa **sırttan** değiyor |
| Kasnak içi ok | dönüş yönü (sırttan temas edende ters döner) |
| Yeşil artı + kesikli çizgi | gergi **pivotu** ve kolu — ters pivot burada gözle görünür |
| Yön gülü (0/90/180/270) | açı konvansiyonu; "montaj açısı −3.18°" onsuz okunamıyor |
| Soluk gri yollar | **diğer kol konumları** (TÜMÜ kipi) — kolun gezdiği aralık |
| Üst künye | çizilen konumun adı · kol açısı · gerginlik |
| Alt şerit | ✓/✗ · kasnak sayısı · L_eff · **Σsarım** (360° olmak ZORUNDA) |

##### Gergi kol konumu seçicisi

Gergi kolu yay dengesinde duruyor: kayış uzayıp kısaldıkça (tolerans + aşınma)
kol dönüyor, gergi kasnağının merkezi kayıyor ve **kayış yolu her konumda başka
bir eğri** oluyor. Kartın altındaki kutu konumu seçiyor; seçim
`node.data.posMode` (varsayılan `mean`) ve **panel ile kart AYNI alanı okur** —
iki ayrı ayar tutulsa panel bir konumu, kanvastaki kart başkasını gösterirdi.
Şema, geometri tablosu ve durum şeridi hepsi seçili konumu anlatır.

Konumlar `FEADCore.positionTable`'dan (`FreeArm · Replace · MaxBelt · Mean ·
MinBelt · Load`); `TÜMÜ` kipi Mean'i önde, geri kalanları soluk çizer.
İki tuzak testli: (a) **tolerans/aşınma 0 iken dört orta konum aynı açıya
oturuyor** — tekilleştirilmezse dört özdeş eğri üst üste biner ve çizim hatası
gibi görünür; (b) çözülemeyen bir konum (BMC'de `Replace`, kayış çözüm
aralığının dışına çıkıyor) listede yok, seçiliyse şema boş kalmaz — Mean'e düşer
ve sebep yazılır. Hayalet etiketleri **pivottan dışa doğru** yerleşir; sabit
"solda" yerleşimde üç etiket üst üste biniyordu (gergi bu düzende ~25 px yol
alıyor).

##### Kaburgalı yüz kayışın ÜSTÜNDE çizilir (`data-ve="rib"`)

Temas tarafını şimdiye kadar yalnız kasnağın kesikli çemberi söylüyordu — bir
**uzlaşım**, yani öğrenilmesi gereken bir kod. Oysa fark gerçek ve çizilebilir:
kayışın bir yüzü kaburgalı, öbürü düz sırt. Yol boyunca dizilen kısa dişler o
yüzü işaretliyor; **kaburgalı temas eden kasnakta dişler kasnağın İÇİNE,
sırttan temas edende DIŞARI bakıyor.** Kullanıcı artık kodu değil parçayı
görüyor — ve bu modülün en pahalı sessiz hatası (ters temas tarafı) şekil
olarak yanlış görünüyor.

Yön TEK BİR KURALDAN çıkar ve yol boyunca sabittir (kayış kendi yüzlerini
değiştiremez): mm düzleminde ilerleme yönü `u` iken kaburgalı yüz normali
`rot90ccw(u) / sense`. Türetme: kaburgalı kasnakta `d = +sense` ve teğet
`u = d·(−sinθ, cosθ)` olduğundan `rot90ccw(u) = d·(−cosθ, −sinθ)` = `d ×`
merkeze doğru; sırttan temas edende `d = −sense` olduğu için aynı normal
kasnaktan uzağa bakar. **`sense`i yok sayıp sabit bir yön yazmak bu topolojide
doğru, AYNASINDA yanlış** çizerdi — testi bu yüzden aynalanmış bir çevrimi de
koşuyor. Üç mutasyonla ölçüldü: normali ters çevirme, `sense`i sabitleme,
sarım yönünü (`p.d`) sabitleme — üçü de kırmızı.

**ÖLÇÜLDÜ (gerçek tarayıcı, BMC örneği):** üç kaburgalı kasnakta dişlerin
%100'ü içeri (20 / 24 / 8 diş), üç sırttan temas eden kasnakta %100'ü dışarı
(5 / 5 / 4 diş).

##### Sarım yayının sweep bayrağı — bir kez yanlış yazıldı

`ty(y) = offY + (maxY − y)·s` ölçeklemesi mm düzlemini **ekranda aynı yönde**
gösterir (yönelim korunur). SVG'nin açı sistemi ise y-aşağı: pozitif açı yönü
görsel olarak saat yönü. Dolayısıyla mm düzleminde CCW olan (`p.d > 0`) ekranda
da CCW görünür ve SVG'de **negatif** yöndür → `sweep = 0`.

Eskiden `sweep = (d > 0 ? 1 : 0)` yazıyordu. Yarıçap ve teğet uçları DOĞRU
olduğu için yay yine iki uca değiyordu ama **aynalanmış çemberin** üzerinde
kalıyor, yani kasnağın İÇİNDEN geçiyordu — ekranda "kaymış, bükülmüş kayış".
Eski test yay SAYISINA baktığı için yeşil kalmıştı. ÖLÇÜLDÜ (BMC, 420×320): yay
merkezleri kasnak merkezlerinden **6.7–42.7 px** sapıyordu; düzeltmeyle altı
kasnakta da **0.008 px**. Dönüş oku aynı ters konvansiyondaydı (kasnağın gerçek
dönüşünün tersini gösteriyordu), o da düzeltildi.

Yeni kapı bu sınıfı kilitliyor: **her yayın örtük merkezi, o kasnağın merkezi
olmak zorunda** (SVG uç→merkez dönüşümü, spec F.6.5) — hayalet yollar dahil.

Çözülemeyen modelde kart boş kalmaz, **sebebi yazar** — kullanıcı "çizim gitti"
değil "kayış yolu kapanmıyor, temas tarafına bak" mesajını görür.

**TAZELEME TEK NOKTADAN: `saveState()`.** Her mutasyon (alan değişti, bağlantı
kuruldu/silindi, düğüm eklendi/silindi) zaten oradan geçiyor; yirmi ayrı yere
çağrı serpiştirmek biri unutulduğunda şemanın sessizce eski geometriyi
göstermesi olurdu. `try/catch` şart — bir çözüm hatası undo yığınını bozmamalı.

Ölçü tek kaynak: `VE_FEAD_LAYOUT_W/H` (components.js) → `componentDefs`. Eski
60×56 kayıtlar `veFeadNormalizeLayoutSize` ile yükselir, elle boyutlandırılan
her ölçü korunur. `veArrangeModuleBase` artık öge başına ölçü kabul ediyor
(`{lx, ly, w, h}`) — herkese 65×60 sayılınca 420 px'lik kart grubu yanlış
ortalayıp görünür alanın sağından taşıyordu (ölçüldü).

**`veFeadBeltPath` EMEKLİ.** İskeletin kendi çizimi bütün kasnakları dış teğet
sayıyordu → sırttan temas edenlerde sarım YANLIŞTI (AG00686: CRK 207.7 ↔ 172.2,
−35.5°). Kendi içinde tutarlı olduğu için (Σ=360) gözle yakalanmıyordu. Şema
artık `FEADCore.solveGeometry`'nin teğet noktaları + işaretli sarım yayları.

**ÖLÇÜLDÜ (gerçek tarayıcı):** AG00686 kanvasa kurulunca sarım
`CRK 210.2 · IDR 26.7 · A_C 202.9 · TEN 26.4`, span
`249.2 · 212.6 · 248.9 · 212.6`, Mean kol açısı `33.1°`, take-up `0.559 mm/°`
— **hepsi Gates raporuyla birebir.**

##### Kart ÇALIŞIR — kayış gider, kasnaklar döner (`veFeadAnimTick`)

Şema doğru ama DONMUŞ bir kesitti. Anlattığı üç şey — hangi kasnak ne kadar
hızlı döner, hangisi **ters** döner, kayış ne kadar hızlı gider — yalnız
tabloda sayı olarak duruyordu; artık hareketin kendisi.

**Yeni fizik yok:** üçü de çekirdekte hazırdı (`beltSpeed`, `speedRatio`,
`geom.pulleys[i].d`). Yapılan iş o sayıları ekranda okunur bir hıza indirmek.

**GERÇEK ZAMAN OLMAZ — ÖLÇÜLDÜ** (BMC, o zamanki 420×340 kart, 0.553 px/mm;
kart 440×500 olunca ölçek 1.277× büyüdü, aşağıdaki px/s sayıları da o kadar —
ama tavan DEVİR tabanlı olduğu için gerekçe değişmiyor):

| motor | kayış | ekranda | diş/s | alternatör |
|---|---|---|---|---|
| 800 dev/dk | 7.56 m/s | 4182 px/s | 597 | 40.5 tur/s |
| 2750 dev/dk | 26.00 m/s | 14377 px/s | 2054 | 139.4 tur/s |

60 Hz ekranda **en yavaş** satırda bile kayış kare başına 70 px (10 diş adımı)
atlıyor → diş sırası strob; alternatör kare başına 0.68 tur → wagon-wheel, yani
gerçek yönünün **tersine** dönüyor görünür. Bu yüzden ağır çekim — oranlar
birebir. Tavan (`VE_FEAD_ANIM_TARGET_REV_S` = 1 tur/s) örnekleme sınırından:
en küçük kasnakta diş açı adımı 24.5°, 1 tur/s'de kare başına 6°, yani adımın
yarısının altında → yön tek anlamlı.

**Katsayı SEÇİLİ devre değil REFERANS devre (listenin en yükseği) bağlanır.**
Seçili devre göre normalize edilseydi her devirde ekrandaki hız AYNI çıkar ve
devir seçicisi hiçbir şey değiştirmezdi; testi bu istenmeyen alternatifi de
koşturup belgeliyor. BMC'de katsayı `×1/139`: 800 dev/dk'da alternatör
0.29 tur/s, kayış 30 px/s; 2750'de 103 px/s.

**Diş sırası ve kollar TEK FAZDAN** (`_feadBeltWalk` → `_feadTeethPath` /
`_feadSpokePath`): kayış zinciri boyunca kümülatif yay uzunluğu. Kol açısı
`θ = a0 + d·faz/r` olduğundan `ω = d·v/r` **kendiliğinden** çıkıyor — kayışın
kasnak üzerinde kaymadığı yapısal olarak garanti. İki ayrı sayaçtan sürülseydi
zamanla ayrışır ve V kaburgalı bir tahrikte **olmayan** bir kayma gösterirdi.

**Çepere diş değil KOL çizilir.** V kaburgalı kayış sürtünmeyle çalışır,
kasnak oluğu **çevreseldir**; çepere radyal diş koymak senkron (dişli) kayış
resmi olurdu — yanlış bir mekanizma öğretirdi. Kol bir yüzey iddiası değil,
nirengi işareti. Animasyon açıkken dönüş oku çizilmez (aynı şeyi ikinci kez
söyler ve 0.55R'de kollarla çakışırdı); `Durgun` seçilince geri gelir.

**Diş adımı çevreyi TAM BÖLER** (`_feadToothStep`): 7 px hedefi çevreye tam
oturmuyor ve kapanış artığı, akan kayışın üstünde sabit bir noktada duran tek
bir tökezleme olurdu (BMC: 1722.5 mm → 136 diş → 12.67 mm). Parça sınırı da
epsilonla kapanır ve sayaç katla ilerletilir: **ÖLÇÜLDÜ**, kayan noktada tam
sınıra düşen diş 12 fazın birinde iki parçaya birden yazılıyordu (141 ↔ 140
diş) — çevrimde bir kez yanıp sönen bir diş.

**Animatör DOM'da DURUM TUTMAZ.** Kart her `saveState()`'te innerHTML ile
baştan kuruluyor; kurulum/temizlik çiftine dayanan bir animasyon o yeniden
kurulmayı her seferinde yakalamak zorunda kalırdı (unutulan tek yol → sızıntı
ya da donmuş kart). Tek rAF döngüsü her karede `svg[data-fead-anim]` arar,
bulduğuna fazı uygular, kart kalmayınca **kendini durdurur**. Faz **düğüm
kimliğiyle** saklanır (öğeyle değil): öğede dursaydı kayış her tuş vuruşunda
başa sarardı. Sekme gizliyken rAF zaten durur, `dt` 0.1 s'ye kırpılır (bir
dakikalık gizlilikten sonra kayış fırlamasın), `prefers-reduced-motion` açıksa
animasyon hiç başlamaz. Kare başına iş: bir diş yolu + kasnak başına bir kol
yolu, hepsi attribute yazımı.

**Devir seçicisi kol konumuyla AYNI satırda** (ikinci bir şerit çizimden 22 px
alırdı; iki şeritle alternatör dairesi 13 px'in altına iniyordu). Seçenekler
duty tablosundan gelir, `Durgun` ilk sıradadır, varsayılan **baskın** duty
satırıdır (en büyük yüzde). Duty tablosu boşsa tek bir varsayılan devir
(1000) gelir ve etiketinde bunu **yazar**: oranlar salt geometriden geldiği
için animasyon yine doğrudur, uydurma olan yalnız mutlak devirdir. Ağır çekim
katsayısı da künyede yazılıdır — gizlenseydi kullanıcı ekrandan devir okumaya
kalkardı.

**ÖLÇÜLDÜ (gerçek tarayıcı, BMC, 800 dev/dk):** altı kasnağın altısı da
beklenen hızda dönüyor — `Sürücü 0.105 · Klima 0.112 · Alternatör 0.291 ·
üç sırt kasnağı −0.224 tur/s` — sapma **%0.0**, işaretler doğru (sırttan temas
edenler ters yönde), diş sayısı faz boyunca sabit (136).

Animasyon **yalnız kanvas kartında**: panel, HTML rapor §8.5 ve SVG/PNG dışa
aktarma aynı çiziciyi kullanıyor ama `animate` geçirmiyor → statik kalıyorlar.

##### Yön gülünün ŞERİDİ artık ÖLÇÜLMÜŞ bir çarpışmaya bağlı (2026-08-26)

Gül varsayılan yerinde (sağ alt) dururken şemadan **54 px'lik bir sağ şerit**
KOŞULSUZ ayrılıyordu: 420 px'lik kartın sekizde biri, yalnız dört sayı için.
Gül sürüklenebiliyordu (`veFeadCompassDragStart`) ve **taşındığı anda şerit
ayrılmıyordu** — yer açma sorumluluğu kullanıcıya geçtiği için. Yani kazanç
kullanıcının gülü elle taşımasına bağlıydı.

Kullanıcı isteği (2026-08-26): *"kanvasın sağ altındaki koordinat sembolü ana
şekle daha yakın [olsun]"*. Çözüm gülü oynatmak DEĞİL, şeridi kaldırıp şeklin
ona doğru büyümesini sağlamak oldu — çünkü şerit çoğu yerleşimde **gereksiz**:
gül sağ ALT köşede duruyor, kayış yolunun sağ alt köşesi ise sıklıkla BOŞ
(BMC'de krank sağda değil, ORTA-ALTTA).

Yeni kural bir ÖLÇÜM (`_roseCarpti`): önce şerit ayrılmadan ölçeklenir, sonra
gülün kutusu **gerçekten çizilen şeylere** — kasnak çemberleri (+ad payı), kayış
açıklıkları, hayalet konumların açıklıkları, gergi kolu ve pivotu — çarpıyor mu
diye bakılır. Çarpmıyorsa şerit hiç ayrılmaz.

**ÖLÇÜT SINIR KUTUSU DEĞİL, ÇİZİLEN ŞEYİN KENDİSİ.** Sınır kutusu kullanılsaydı
BMC'de de çarpardı (kutunun sağ alt köşesi güle 0.5 px kalıyor) ve şerit hiç
kazanılmazdı — oysa orası boş.

**ÖLÇÜLDÜ** (BMC, en büyük kasnak yarıçapı px):

| kart | eski (koşulsuz) | yeni | kazanç |
|---|---:|---:|---|
| **440×458** (yeni varsayılan) | 50.29 | **58.05** | **+%15.4** |
| 420×298 (eski varsayılan) | 45.45 | 45.45 | %0.0 — ölçek zaten yüksekliğe bağlıydı |
| 380×298 | 41.67 | 45.45 | +%9.1 |
| 340×298 | 35.92 | 43.68 | **+%21.6** |
| 300×240 | 30.17 | 35.39 | +%17.3 |
| 260×200 | 23.50 | 28.45 | +%21.1 |
| 220×180 | 16.68 | 16.68 | %0 — **ÇARPIŞMA VAR, şerit ayrılıyor** |
| 180×140 | 9.86 | 9.86 | %0 — çarpışma var |

Yani kazanç yer VARKEN doğuyor, yer YOKKEN davranış birebir eskisi. Gülü elle
taşımak artık çoğu kartta hiçbir şey kazandırmıyor — çünkü kazanç ZATEN
varsayılanda geliyor.

**KUTU KOŞULSUZ, ŞERİT KOŞULLU — iki ayrı soru.** İlk yazımda ikisi tek bayrağa
(`!moved`) bağlanmıştı ve bu sessiz bir kusurdu: `compassPos` verilir verilmez
gül **etiket engeli olmaktan çıkıyordu**, yani tam da kullanıcı gülü şemanın
içine sürüklediğinde koruma kapanıyordu. **ÖLÇÜLDÜ** (BMC, 440×458, gülün 16×16
kesir ızgarası = 256 konum): engel varken çakışan konum **3**, engel yokken
**61**. Kalan 3 konum yerleştiricinin kendi ilan ettiği geri düşüşü (dört adayın
hiçbiri temiz değilse etiket üste döner ve çakışır — kaybolmaz).

Etiket ölçütü **çapa noktası değil KUTU**: ilk kapı çapaya bakıyordu ve
mutasyondan GEÇTİ — `middle` çapası çakışmanın 43 px solunda duruyor, kutu ise
sağa taşıyor.

Konum **kesir** olarak saklanır (`node.data.compassPos = {fx, fy}`), piksel
olarak değil: kart yeniden boyutlandırılınca gül aynı bağıl yerde kalır. Piksel
saklansaydı daraltma anında çerçevenin dışında kalırdı — ki kullanıcının yapmak
istediği tam olarak daraltmak. Kenetleme sürükleme SIRASINDA uygulanıyor (sınır
çekilirken görünsün), ve gülden küçük bir kartta gül merkeze oturuyor: yarısı
dışarıda bir gül hiçbir şey demez.

**HAREKETSİZ TIK HİÇBİR ŞEY YAZMAZ** — gerçek tarayıcıda ölçülen bir hata:
her `mouseup`'ta `saveState` çağrılınca kart `innerHTML` ile yeniden kuruluyor
ve **çift tık olayı ulaşacağı öğeyi bulamadan** ateşlenmiyordu, yani "çift tıkla
varsayılana dön" sessizce çalışmıyordu. İkinci kazanç: gülün üstüne yapılan her
tık undo yığınına boş bir adım koymuyor artık.

Fare noktası `getScreenCTM` ile çözülür, kutu oranı yalnız yedektir: kart ile
viewBox aynı en-boy oranında olsa da **tuval zoom'lu olabiliyor** ve onu yalnız
CTM kapsıyor.

Panel de aynı alanı okuyor ve aynı kancayı kuruyor (kol konumundaki kuralın
aynısı: iki ayrı ayar tutulsa panel bir yeri, kart başka bir yeri gösterirdi).
Rapor ve SVG/PNG dışa aktarma düğüm kimliği almadığı için **sürüklenmez** —
orada gül varsayılan yerinde kalır.

#### Çevrimdışı HTML rapor (`js/cp-fead-report.js`)

Tedarikçi (Gates) "Accessory Belt Drive System" çıktısının 11 sayfası, Takoz
raporuyla **AYNI görsel dilde** tek dosyalık çevrimdışı bir HTML'e dökülüyor.
Kalıp birebir Takoz'unki: sabit **teori şablonu** (§1–7, 9, 10, Ek A) +
çözümden üretilen **§8** + **Uygunluk hükmü**.

| Dosya | Sorumluluk |
|-------|-----------|
| `tools/report-assets/fead-theory-source.html` | Teori metni (elle yazılır) — tokenlar ZATEN içinde |
| `tools/report-assets/build-fead-report-template.js` | Doğrula → KaTeX önyükleyiciyi ekle → base64 (`npm run build:fead-report`) |
| `js/fead-report-template.js` | Üretilen şablon (`window.FEAD_REPORT_TEMPLATE_B64`) — **elle düzenlenmez** |
| `js/cp-fead-report.js` | Panel · giriş · antet · §8 (18 alt bölüm) · Uygunluk · 6 SVG şekli |

Takoz şablonundan **tek yapısal farkı**: orada derleyici harici bir referans
belgeyi regex ameliyatıyla token'lıyordu; burada kaynak zaten token'lı yazıldı,
derleyici yalnız **doğruluyor**. Regex ameliyatı, kaynak metin bir kelime
değiştiğinde sessizce yanlış yere token koyabilecek tek yerdi.

**KaTeX ve fontlar Takoz raporuyla ORTAK** (`window.MNT_REPORT_ASSETS`, ~1 MB).
İkinci bir kopyanın karşılığı yok; `js/results.js` de aynısını yapıyor. Varlık
yükleyicideki **sayaç döngüden ÖNCE kurulur** — Takoz'daki tuzağın aynısı:
artışı döngü içine koymak tek dosya build'inde her oturumun ilk rapor denemesini
kırıyor, `index.html`'de görünmüyor.

Ad öneki **`_fr…`** (`cp-mount-report.js` `_r…`, `cp-fead.js` `_fead…`
kullanıyor) — aynı adı iki dosyada üst-seviye bildirmek `source-hygiene`
kapısına takılır. `getFeadReportPropertiesHTML` bu yüzden `cp-fead.js`'ten
**silinip** buraya taşındı.

##### Şeklin geometrisi de ÇEKİRDEKTEN gelir (Şekil 1)

§2'deki kavramsal FEAD şeması elle yazılmış sabit bir SVG'ydi ve **beş yol
ucunun beşi de** kasnak çemberinin dışındaydı (ölçüldü): krankın "sarım yayı"
r=70 ile (560,60)→(560,200) arasına çizildiği için örtük merkezi (630,130)
yerine **(560,130)**'a düşüyor, yani kasnağın MERKEZİNDEN geçiyordu; aksesuar
yayının kirişi 2r'den uzun olduğu için SVG yarıçapı 62 → 64.2'ye büyütüp yayı
kasnaktan **96 px** uzağa oturtuyordu — **kayış o kasnağa hiç değmiyordu.** Alt
künye satırı da 820'lik viewBox'ı 32 px aşıp kırpılıyordu (rapor CSS'i SVG
yazılarını IBM Plex Mono'ya sabitliyor: karakter 0.6 em, proporsiyonel değil).

Şekil artık `FEADCore.solveGeometry`'nin teğet noktaları, sarım açıları ve
dönüş yönleriyle çiziliyor. Kazanç yalnız "doğru duruyor" değil: çekirdek
**kapalı çevrim değişmezini (Σ işaretli sarım = 360°) ve kayışın bir kasnağın
içinden geçmediğini doğruluyor** — yani şekil kurulduğu anda geçerli, gözle
denetlenmesi gerekmiyor. Yerleşim doğrulama takımındaki AG00686 ile aynı
ailedendir (iki kaburgalı büyük kasnak, ana eksenin karşı taraflarında iki sırt
kasnağı); sarımlar 216/32/200/23°, referansın 208/27/201/22°'sine komşu.
Sweep bayrağı Kayış Yolu kartıyla **aynı kuralı** kullanır (`d > 0 → sweep 0`);
iki çizim aynı konvansiyonu paylaşmazsa biri sessizce aynalanır.

İşaretler de ölçülerek yerleşti: sarım açısı önce kasnağın **dışına** halka
olarak çizilmişti, 216°'lik o yay ikinci bir kayış gibi okunuyor ve krank
etiketinin üstünden geçiyordu — klasik teknik resim gösterimine (merkezden iki
teğete yarıçap + içeride küçük yay) alındı. Etiketler `_frTxtW` ile ölçülüp
çakışmayana kadar itiliyor; elle bir koordinat daha yazmak düzeltilen hatanın
aynısı olurdu.

Kapı dört mutasyonla ölçüldü (sweep sabitleme, sarım yarıçapını %5 şişirme,
teğet ucu yerine kasnak merkezine gitme, künyeyi taşırma) — dördü de kırmızı.

##### Kanvastan gelen şekil raporda GÖRÜNMEZDİ — palet jetonları

§8.5'teki şekli MFSim'in kendi çizicisi (`veFeadLayoutSVG`) üretiyor; tek-çizici
kuralı bunu gerektiriyor. Ama o çizici **uygulamanın** palet değişkenlerini
kullanıyor (`--accent-warning`, `--text-muted`, `--bg-input`, … 11 jeton) ve
raporun paleti bambaşka (`--ink`, `--prusya`, `--line`…). Tanımsız bir `var()`
"invalid at computed-value time"dır; kalıtılan bir özellik olan `stroke` için
sonuç **`none`** demektir.

**ÖLÇÜLDÜ (gerçek tarayıcı, BMC raporu):** kayış, altı kasnak çemberi, kaburga
dişleri, sarım yayları, gergi kolu ve pivot **tamamen görünmezdi**; ayakta kalan
tek şey etiketler ve merkez noktalarıydı (onlar `fill` kullanıyor). Şeklin
künyesi olmayan bir çizimi anlatıyordu. Sayfa hatası yok, konsol temiz, sessiz.

Şablon CSS'i jetonları `.appfig` altında raporun baskı paletine bağlıyor
(`tools/report-assets/fead-theory-source.html`), `_frLayoutFigure` de `<figure>`
elemanına o sınıfı koyuyor. Kapı, şeklin kullandığı **her** `var(--…)` jetonunun
şablonda tanımlı olmasını arıyor — sınıf düşse de bir jeton eksik kalsa da
kırmızı (iki mutasyonla ölçüldü).

##### Tasarım gerginliğinin kaynağı — §8.6/§8.7/§8.9 (mühendis sorusu, 2026-08-24)

Kullanıcı raporu bir mühendisle inceledi ve üç soru geldi: *"Take-up oranı nasıl
hesaplanıyor, bir girdi giriyor muyuz? φ ve β nasıl elde ediliyor?"* — üçü de tek
şeyi sorguluyordu: **Design Tension nereden geliyor.** Üretildi ve **üç gerçek
kusur** çıktı.

**1 · §8.7'nin TEK denklemi yanlış çevrim çarpanıyla basılıyordu.** Metin

```
T = M/(dL/dθ) · (180/π) · (1/1000) = 650 N          ← ESKİ
```

diyordu; elle çalışıldığında **2,13 N** veriyor (ölçüldü). Basılan 650 N doğruydu
— ama ayrı bir alandan geliyordu, yani aritmetiği denetleyen okuyucu **raporun
yanlış olduğu** sonucuna varıyordu. Mühendisin sorusunun sebebi büyük olasılıkla
tam olarak buydu. Doğru çarpan `× 1000 × (π/180)`; artık **ara değer de**
basılıyor (m/rad cinsinden take-up), yani bölme elle tekrarlanabiliyor.

**2 · §8.9 ORTALAMA eğime "take-up oranı" diyordu.** Eğrinin uçtan uca ortalama
eğimi **0,4481 mm/°**, çalışma noktasındaki gerçek türev **0,5984 mm/°** —
**%25,1 fark** (ölçüldü, BMC). §8.7 ve tedarikçi raporunun *"Belt Take-up /
Tensioner Arm Ratio"* satırı **anlık** türevdir. Aynı ad iki farklı sayıyı
taşıyordu. §8.9 artık çalışma noktasındaki **teğeti çiziyor** (eğimi take-up
oranının kendisi) ve ikisini ayrı ayrı adlandırıyor.

**3 · Design Tension'ın GİRDİ olduğu hiçbir yerde yazmıyordu** — ve sonradan
görüldü ki **girdi olmaması gerekiyordu.** Bkz. bir sonraki bölüm.

**"Kayma emniyeti değişmez" iddiası ÖLÇÜLDÜ ve fazla kesinmiş** (800 d/d,
650→400 N): yük **çeken** kasnaklarda SF değişiyor (Sürücü 5,348 → 4,024,
Alternatör 6,667 → 5,235), yük **çekmeyenlerde** (avara, gergi) gerginlik oranı
tam 1 olduğu için SF hiç değişmiyor — ve **hükmü veren en düşük SF tam orada:
%0,0**. Doğrusu: *tablo kısmen gösterir, hüküm göstermeyebilir.* Rapor metni ve
bu tablo ona göre düzeltildi.

##### φ ve β artık ÇİZİLİYOR — çizim sembol taşır, sayı denklemde durur

İki yeni şekil, çözülmüş geometriden üretiliyor (Şekil 1'deki kural: elle
yerleştirilmiş koordinat yok):

| Şekil | Nerede | Ne gösteriyor |
|---|---|---|
| **φ kuruluşu** | §8.6 | teğet noktaları, +X referansı, θ_giriş/θ_çıkış, işaretli sarım yayı; altında (3.3)'ün bu kasnak için KaTeX aritmetiği |
| **β / take-up** | §8.7 | pivot, kol `a`, birim açıklık doğrultuları, bileşke `f`, hareket yönü `t`, β yayı ve φ yayı |

§8.6'ya ayrıca **kasnak başına θ_giriş/θ_çıkış/d/φ tablosu** girdi: her satırın
φ'si **o satırdaki iki θ'dan** yeniden hesaplanıyor, yani tablo kendi
aritmetiğini taşıyor ve `Σ d·φ = 360°` orada kapanıyor.

**Sayı çizime YAZILMAZ.** Değerleri yayların yanına koymak ölçüldü: etiket
kutuları yay işaretlerinin, yarıçap doğrularının ve kayışın üstüne biniyordu.
Çizimde yalnız semboller (`θ_giriş`, `φ`, `β`, `a`, `f`, `t`, `P_giriş`) duruyor;
sayılar hemen altındaki **KaTeX denklemlerinde** ve tablolarda. Aynı gerekçeyle
şekil künyelerindeki üç satırlık sayısal türetme de kaldırılıp denklem bloğuna
taşındı — SVG metni KaTeX ile dizilemez ve belgenin tipografisinden kopuk
görünüyordu (kullanıcı bildirimi: *"çok yazısal görünüyor, ana görünüm temasını
bozmayalım"*).

**Şeklin YANINDA açıklama sütunu var** (`_frLegend`). Kullanıcı bildirimi
(2026-08-24): *"'fi' ne demek falan çok belli olmamış."* Doğruydu — sayıları
çizimden çıkarınca sembolün NE OLDUĞU yalnız künye metninde kalıyordu, oysa
okuyucu şekle bakarken orada değil. Sol şerit her sembolü tanımlıyor
(`φ — SARIM AÇISI`, `f — bileşke`, `a — gergi kol boyu`, …); SVG metni satır
kaydırmadığı için sarma elle yapılıyor (`_frWrap`).

**Kadraj YATAY, çünkü şekiller fazla uzundu.** `svg{width:100%}` olduğu için
ekrandaki yükseklik = genişlik × (H/W); iki yeni şekil **534 ve 452 px** iken
raporun diğer sekizi 209–346 px bandındaydı (ölçüldü). viewBox yataylaşınca
hem **297 / 316 px**'e indiler hem de açığa çıkan sol şerit açıklamaya yer
açtı — aynı değişiklik iki sorunu birden çözüyor. Kapı oranı `H/W < 0,45`
olarak kilitliyor.

**Etiketler ÇAKIŞMA ÖNLEYİCİ bir yerleştiriciden geçiyor** (`_frLabels`): istenen
yönde adım adım ilerleyip hem çerçeveden, hem önceki etiketlerden, hem de
**engel olarak kaydedilen çizim öğelerinden** (kasnak çemberi, yarıçap doğruları,
kol, vektör gövdeleri) çıkan ilk yeri seçer. Yalnız radyal ilerleyen ilk sürümde
`u_çıkış` etiketi çerçevenin dışına itilip **kayboluyordu** (ölçüldü); arama
yarıçap-baskın, yön ikincil oldu. Sıra = öncelik: şeklin konusu olan β ve φ önce
yerleşir. `θ_giriş`/`θ_çıkış` açıortayda değil
**kendi yarıçap doğrultularında** duruyor: iki teğet noktası çevrenin karşıt
yerlerinde olduğu için etiketler yapısal olarak ayrılır — açıortayda ikisi de
aynı dörtte bire düşüp sıkışıyordu (kadraj küçüldükten sonra iç bölge dar).

**Denklem numaraları sayaçtan** (`_frEq`, tablo/şekil sayaçlarıyla aynı kalıp) ve
metindeki atıflar **aynı kaynaktan** (`_frEqRef`) basılıyor — elle "(8.4)" yazmak,
araya bir denklem girdiğinde gövde metnini sessizce yanlış denkleme yollardı.

**Teori tarafı:** §4.2 artık (4.3)'ü **türetiyor** (merkezin hızı `a·t`, yalnız
komşu iki açıklığın değişmesi, `|f| = 2sin(φ/2)`, `f` ile `t` arasındaki açının
`90°−β` olması); §5.1'e **ankraj paragrafı** eklendi (bağıntılar gerginliğin nasıl
DEĞİŞTİĞİNİ verir, mutlak SEVİYESİNİ tasarım gerginliği verir); §10'a `f`, `t`,
`dL/dθ`, `T_tasarım` sembolleri girdi. Şablon CSS'ine `h4` kuralı eklendi (rapor
üreteci artık alt başlık kullanıyor; satır içi stil bırakmak temayı bozardı).

**Kapı dokuz mutasyonla ölçüldü, dokuzu da kırmızı:** çevrim çarpanını terse
yazma, `takeupRad` hesabını ters çevirme, sarım yayının sweep bayrağını çevirme,
yay süpürmesini kısa yola normalize etme, etiket çakışma denetimini kaldırma,
take-up'ı envanterde "girdi" diye işaretleme, tasarım gerginliği
karşılaştırmasını kaldırma, teoriden türetmeyi silme, §8.9'da ortalama eğime
"take-up oranı" deme. Dördüncüsü ilk turda **YEŞİL kaldı** — kayış yayını
denetleyen test φ'yi *gösteren* işaret yayına bakmıyordu; o kapı da eklendi.

##### İKİ RAPOR TÜRÜ — 'Rapor' bileşeninden seçilir (2026-08-26)

Kullanıcı isteği: *"Bu raporun kalmasını istiyorum, yanına Gates raporunun
aynısı olacak şekilde özet bir rapor daha çıkar. Rapor bileşeninde 'Detaylı
Rapor' ve 'Özet Rapor' seçenekleri olsun."*

| Tür | Dosya | Ne anlatır | Boy |
|-----|-------|-----------|-----|
| `detailed` (varsayılan) | `js/cp-fead-report.js` | Teori §1–10 + Ek A + §8 çözümü | ~944 KB |
| `summary` | `js/cp-fead-summary.js` | Tedarikçi çıktısının **beş sonuç sayfası** | ~340 KB |

Seçim `node.data.reportKind`'da; **varsayılan `detailed`** → alanı olmayan her
eski proje bugüne kadarki davranışını birebir korur (testli). Panel iki KART
çiziyor (iki durumlu anahtar değil): hangi belgenin ne olduğu seçim yapılmadan
ÖNCE okunabilsin.

Özet rapor **KaTeX taşımıyor** — teori yok, denklem yok. Boy farkının tamamı bu.
Fontlar Takoz/ayrıntılı raporla ORTAK (`window.MNT_REPORT_ASSETS.fontsCss`).

###### DÜZEN TEDARİKÇİ SAYFASININ KENDİSİ — kendi yorumumuz değil (2026-08-26)

İlk sürüm A4 **yatay**, kendi başlıklarıyla ("Sonuç Özeti" kartları) ve şemayı
üç sayfaya birden koyan bir belgeydi. Kullanıcı reddetti: *"Her yere bu şekli
koymuşsun. Gerek yok… Gates raporunun aynısı olsun. Gates raporunda sayfalarda
ne varsa aynısı olsun."*

PDF `pymupdf` ile görüntüye çevrilip yerleşim **okundu** (metin koordinatları
döndürülmüş çıktığı için tahminle kurulamıyordu). Gerçek yapı:

| | Gates | ilk sürümümüz |
|---|---|---|
| Sayfa | A4 **dikey**, iki sütun, kırmızı ayraçlar | A4 yatay, tek akış |
| Antet | marka + firma + sistem adı ÜSTTE | teknik resim antedi ALTTA |
| Şema | 1, 2 ve 5. sayfalarda | **üç sayfada da, büyük** |
| Sayfa 1 | kayış/gergi künyesi · şema · **gerginlik kontrol grafiği** · B10 · **doğal frekans haritası** · tepe yük · eksenel kaçıklık | kendi uydurduğumuz özet kartları |
| Sayfa 3 | gergi tablosu + **küçük** take-up grafiği | tablo + büyük kendi grafiğimiz |

Belge yeniden kuruldu. Grafikler AYRINTILI RAPORDAN geliyor — ikinci bir çizici
yok: `veFeadFigureRaw(fn, R, W, H)` aynı figür işlevini **küçük ve numarasız**
koşturuyor (`_FR_W`/`_FR_H` zaten `_frChart`'ın yedeği, `_FR_RAW` figür
sarmalını atlıyor; şekil sayaçlarına dokunmuyor).

**ÜÇ SESSİZ KUSUR — üçü de bu turda çıktı, üçü de testli:**

| Kusur | Belirti | Kök neden |
|---|---|---|
| Gerginlik grafiğinin ekseni | y ekseni **8411 N**'e uzuyor, altı çalışma konumu x ekseninin dibinde tek çizgiye yapışıyordu | Ölçek tabanına **Load** katılıyordu. Load bir MEKANİK DURDURUCU: orada take-up tekilleşir ve gerginlik 5257 N (çalışma 544 N). Fonksiyonun kendi yorumu "çalışma konumlarına göre sınırlanır" diyordu — tersi oluyordu. **Bu kusur AYRINTILI RAPORDA da vardı**; düzeltme ikisini birden düzeltiyor (yeni tavan 1170 N, Gates 900) |
| Take-up çağrısı bölümü sürüklüyordu | Özet sayfa 3'e §8.9'un başlığı ve iki paragrafı düşüyordu | `_frTakeupFigure` bir **bölüm** üreticisi, figür değil. Çizim `_frTakeupChart` olarak ayrıldı; bölüm de onu çağırıyor |
| Gergi kasnağının X/Y'si `—` | Yerleşim tablosunda konum "bilinmiyor" gibi okunuyordu | Konum bir GİRDİ değil, kol açısından türeyen çalışma merkezi. Çalışma (Ortalama) konumundan basılıyor ve † ile türev olduğu işaretli (−161,97 / 91,27 ↔ Gates −161,97 / 91,29) |

Boşalan yere gerçek tablo kondu (kaburga yorulma dağılımı — kalibre bir sonuç),
sayfa 3'ün take-up grafiğinin yanına açıklık frekansları.

**ÖLÇÜ KALDIRACI:** şekiller sütuna `width:100%` ile oturuyor, yazı boyutu ise
viewBox biriminde sabit. Küçük viewBox'ta etiketler çizimin üstüne biniyordu;
viewBox BÜYÜTÜLÜNCE yazı göreli küçülüyor ve sığıyor. Kalan taşma (uzun kasnak
adları şema çerçevesini aşıyor) `veFeadLayoutSVG`'nin sınırlara etiket
genişliğini katmamasından — Şekil 1'de düzeltilen sınıfın aynısı, kanvas
çizicisinde duruyor.

###### Sayfa eşlemesi — Gates AG00976 (05.06.2025, v13.02)

| Özet sayfa | Gates sayfa | İçerik |
|---|---|---|
| 1 Sonuç Özeti | 1/12 | kayış+gergi künyesi · şema · duty+B10 · **tepe yük** |
| 2 Geometrik Analiz 1/2 | 2/12 | yerleşim verisi · kayış/gergi girdisi · span/sarım/oran |
| 3 Geometrik Analiz 2/2 | 3/12 | gergi geometrisi (6 konum × 10 satır) · take-up · boy eğrisi |
| 4 Kayma ve Gerginlik | 6/12 | kayma duyarlılığı (en kritik kombinasyon) · emniyet matrisi + grafiği |
| 5 Hubload Analizi | 8/12 | yük koşulları · ortalama gerginlik/hubload/yön matrisleri |

**ÖLÇÜLDÜ — tedarikçi sayfası geri üretiliyor** (AG00976 örneği, PDF'in kendi
sayıları): açıklık `148,0 · 141,4 · 150,8 · 272,7 · 194,4 · 141,3`, sarım
`156,2 · 52,8 · 198,4 · 64,3 · 157,1 · 34,6`, hız oranı ve gereken kayış boyu
altı konumda **birebir**; take-up `0,708 mm/°`; ortalama gerginlik/hubload
880 d/d'de `1381/1380/1023/1022/545/544` ve `1892/1228/2373/1089/1539/324`
(≤2 N). Tek sapma Load sütununda (%0,66) — orası belgeli tekillik.

###### TEPE YÜK TABLOSU BASILIR AMA "KALİBRE DEĞİL" DAMGASIYLA

Gates bu tabloyu *"en kritik ivme + yük kombinasyonu"* **arayarak** kuruyor.
Çekirdeğin `peakEstimate`'i yarı-statik ve kendi notu şunu diyor: *"gergi kolu
dinamigi dahil DEGIL"*. Kombinasyon taraması (aksesuarlar %100/%10, ivme
±1100 d/d/s) köprü katmanında yapıldı — çekirdeğe DOKUNULMADAN — ve
**ÖLÇÜLDÜ: yakınsamıyor**:

| | MFSim | Gates | fark |
|---|---:|---:|---:|
| yük taşıyanlar | 1471 · 1464 · 1058 · 1051 | 1585 · 1582 · 1177 · 1174 | −%7,2 … −%10,5 |
| alternatör | 671 | 546 | **+%22,8** |
| gergi | 544 | 544 | %0,0 |

Tablo yine basılıyor — düzen tedarikçi çıktısıyla aynı kalsın — ama başlığında
`KALİBRE DEĞİL` damgası, altında ölçülen sapma bandı ve *"yatak/braket
seçiminde tek başına kullanılmamalıdır"* uyarısı var. Sayı gizlenmiyor, çünkü
bu modülün kuralı geçerlilik sınırını sonucun **içinde** taşımak.

**SESSİZ KIRILMA — kW anahtarı.** İlk sürümde tepe gerginlik ORTALAMANIN
ALTINA düşüyordu (FAN 634 N, oysa ortalaması 1381 N): `R.duty` zaten çekirdek
biçiminde (kW kasnak ADIYLA anahtarlı) ama kod onu ikinci kez
`veFeadDutyToCore`'dan geçiriyordu; anahtarlar tutmayınca **bütün aksesuarlar
0 kW** ile koşuyordu. Tablo yine üretiliyor, yalnız sayı küçülüyor — modülün
en pahalı sınıfının aynısı. Kapı artık *"tepe ≥ ortalama"* değişmezini tutuyor.

###### Uydurulmayan iki şey

`Belt Slip Sensitivity`'nin ters çözümü (gereken gerginlik/sarım artışı) ve
`Permissible Axial Offset` yok. İkincisi için çekirdekte `alignmentAllowance`
VAR ama düz kasnakların açısal kaçıklığını (ψ) GİRDİ olarak istiyor ve MFSim
o alanı sormuyor; ψ=0 ile basılan sayı iyimser bir yalan olurdu.

###### Sayı biçimi ve şekil ORTAK — ikinci kopya yok

`_frF`/`_frFs`/`_frPct`/`_frEsc`/`_frNum` ve kayma hükmü (`_frSlipStats`)
ayrıntılı rapordan çağrılıyor; iki belge aynı sayıyı farklı basamazdı.
Yerleşim şeması yine `veFeadLayoutSVG` — ve `class="appfig"` ŞART: o çizici
uygulamanın palet jetonlarını kullanıyor, tanımsız `var()` kalıtılan `stroke`
için `none` demek (ayrıntılı raporda ölçüldü: kayış ve kasnaklar görünmez
kalmıştı). Kapı, şeklin kullandığı her jetonun belgenin CSS'inde tanımlı
olmasını arıyor.

Kapı altı mutasyonla ölçüldü, altısı da kırmızı: tepe kW anahtarını geri
bozma, `.appfig` sınıfını düşürme, varsayılan türü `summary` yapma, açıklık
boyunu %1 kaydırma, CSS'ten `--accent-warning` silme, sapma bandını yutma.

###### KOZMETİK TUR — okunmazlığın kökü TİPOGRAFİ DEĞİL YERLEŞİMDİ (2026-08-26)

Kullanıcı bildirimi: *"Yine her yere bu diyagramları koymuşsun… Zaten tablolar
diyagramlar taşmış, yazılar komik bir şekilde kötü duruyor falan. Gates
raporuna tamamen bağımlı kalmana gerek yok. Güzel bir kozmetik düzenleme ile
raporu gerçekten okunabilir bir hale getirmeni istiyorum."*

**ÖLÇÜLDÜ (gerçek tarayıcı, önce ↔ sonra):**

| | önce | sonra |
|---|---:|---:|
| yatay taşan öge | **41** | **0** |
| ayrı punto sayısı | **17** | 6 (belge) + şeklin kendi 4'ü |
| 8,5 px altındaki öge | **651** | **11** (yalnız pusula ve künye) |
| viewBox dışına taşan SVG yazısı | **8** | **0** |
| sentetik kalın (gömülü olmayan ağırlık) | **2 çift · 36 öge** | **0** |
| etiket ↔ kayış yolu çakışması (şema) | **4** | **0** |
| sayfa doluluk oranı | %48–116 | **%92–97** |

**KÖK NEDEN TİPOGRAFİ DEĞİLDİ.** Punto 8,2 px'e o yüzden düşürülmüştü:
matris sütun başlığı kasnak ADIYDI ve *"Otomatik Gergi (E9843)"* tek başına
22 karakter — altı kasnakta satır A4'e sığmıyor, sığdırmanın tek yolu puntoyu
kırmaktı. Kısa kod (`_fsrCodes` → `FAN · AVA1 · KK · AVA2 · ALT · TEN`) o
baskıyı kaldırdı, punto serbest kaldı. Tedarikçi çıktısının FAN/IDR/A_C/ALT/TEN
kullanmasının sebebi de bu. **Kısaltma ancak karşılığı AYNI SAYFADA duruyorsa
okunur** → kodu kullanan her sayfa `_fsrCodeLegend` basıyor.

**DİYAGRAM İKİ KEZ DEĞİL, BİR KEZ.** Kullanıcı aynı itirazı iki kez yaptı.
Belgede **tek yerleşim şeması** (sayfa 1) ve **tek grafik** (sayfa 3) var.
Doğal frekans haritası, take-up eğrisi, kayma çubuk grafiği ve yorulma çubuk
grafiği KALKTI — dördü de aynı sayfadaki bir tablo satırını ikinci kez
anlatıyordu.

**AMA "BİR KEZ" DEMEK "HİÇ" DEMEK DE DEĞİL — ve dördü fazla silinmişti.**
Üçüncü bildirim şuydu: *"Rapordaki tüm şekiller yok ama? Gates raporundaki tüm
şekilleri, diyagramları çıkar bakalım."* Çıkarıldı ve **ölçüm kullanıcıyı
doğruladı**: tedarikçi çıktısının beş şekil türünden **üçü** belgede yoktu.

| # | Gates şekli | Gates sayfası | Kozmetik turundan sonra | Bugün |
|---|-------------|---------------|-------------------------|-------|
| 1 | Yerleşim şeması + pusula | 1 · 2 · 5 | ✓ s1 | ✓ s1 |
| 2 | Belt Tension Control | 1 · 2 | ✓ s3 | ✓ s3 |
| 3 | **Natural Frequency Map** | 1 | ✗ | **✓ s1** |
| 4 | **Belt Take-up** | 3 | ✗ | **✓ s3** |
| 5 | **Belt Slip Safety Factor** | 4 | ✗ | **✓ s5** |
| 6 | **Gergi kolu konum zarfı** | 5 | ✗ | **✓ s1** (şemanın içinde) |

Üçünün de üreticisi ayrıntılı raporda **zaten vardı** (`_frFreqFigure`,
`_frTakeupChartRaw`, `_frSlipFigure`) — eksik olan hesap değil YERLEŞİMDİ.
"Aynı sayfadaki bir tablo satırını tekrar ediyor" gerekçesi yanlıştı: take-up
eğrisinin **çalışma noktasındaki teğetinin eğimi take-up oranının ta kendisi**
(0,7082 ↔ tablodaki 0,708), yani grafik sayıyı tekrar etmiyor, **kanıtlıyor**.

**Kol zarfı BEDAVA:** `veFeadLayoutSVG`'ye `posMode:'all'` geçmek yeterli —
gergi kasnağı altı konumda üst üste çiziliyor, her konum için ayrı kayış yolu
soluk çiziliyor. 0 px ek yer, ve sayfa 3'ün zarf tablosunun görsel karşılığı.
Hayalet ETİKETLERİ kapalı (`ghostLabels:false`): 395 px'lik şemada altı ad üst
üste biniyordu (ölçüldü: "Serbest" ↔ "Değişt." **104 px²**) ve konumların adı
zaten sayfa 3'te. Tedarikçi çıktısı da zarfı etiketsiz çiziyor.

**İKİ GRAFİK YAN YANA** (kullanıcı isteği): gerginlik eğrisi ve take-up
eğrisi AYNI yatay ekseni (gergi kol açısı) paylaşıyor; yan yana konunca aynı
x'te iki büyüklük birlikte okunuyor — solda gerginlik yükselirken sağda
gereken kayış boyu düşüyor. Alt alta bu eşleme gözle kurulmuyordu. Kutu
ölçüsü sütundan BÜYÜK seçilir (390 birim ↔ 345 px sütun) ki ölçek 0,885
olsun ve puntolar 9,3–10,2 px'e insin; sütun genişliği seçilseydi ölçek 1
kalır ve grafik yazıları gövdeden büyük görünürdü.

**AMA "BİR KEZ" DEMEK "BÜYÜK" DEMEK DEĞİL** — üçüncü bildirim bunu söyledi:
*"Şekiller çok büyük. Gerçekten bu kadar büyük olmasına gerek yok."*
**ÖLÇÜLDÜ ve haklıydı:**

| | önce | sonra | A4 içerik alanının (972 px) |
|---|---:|---:|---:|
| Sayfa 1 · yerleşim şeması | 521 px | **243 px** | %54 → **%25** |
| Sayfa 3 · gerginlik grafiği | 623 px | **412 px** | %64 → **%42** |

**KÜÇÜLEN ÇİZİM, YAZI DEĞİL.** Çizicinin kabuğu `max-width:<W>px` taşıyor:
W kabın genişliğinden küçük seçildiği sürece ölçek 1 kalır ve kullanıcı
birimindeki puntolar (kasnak adı 9) ekranda yine 9 px basılır. Aynı kuralın
TERSİ yönü daha önce ısırmıştı — 460 birimlik kutuyu 397 px'lik sütuna
sığdırmak ölçeği 0,863 yapıp adları 6,0 px'e indiriyordu.

Şema **sütuna** giriyor: kümenin doğal en-boy oranı ≈1,64 (yatay), yani tam
genişlikte yükseklik zorunlu olarak 430 px'e çıkıyor. 395 px'lik sütunda aynı
oran **242 px** veriyor ve boşalan yeri künyeler dolduruyor — yani küçültme
yer kaybı değil, yer KAZANCI (sayfa 1'de 455 px, sayfa 3'te 264 px).

##### Sekiz kozmetik karar — her biri ölçülmüş bir kusurun karşılığı

| # | Karar | Neyi kapatıyor |
|---|-------|----------------|
| 1 | Sütun başlığı **kısa kod** + sayfa altında künye | 41 yatay taşmanın çoğu; puntoyu kıran baskı |
| 2 | **Bütün hücreleri aynı olan sütun tablodan çıkar**, künyeye iner (`_fsrConstCols`) | 5 tabloda 11 sütun · 130 hücre · 11 farklı sayı |
| 3 | Kalınlık **gömülü ağırlıklara** bağlı (Archivo 700 · serif 600 · mono 500) | sentetik kalın: 36 ögede glifler şişiyordu |
| 4 | Punto **tek ölçekten** (`--f-xl…--f-xs`), satır içi px YOK | 17 ayrı punto |
| 5 | Şemada etiket **kayış yolunu ENGEL sayar** (üst→alt→sağ→sol) | 4 çakışma |
| 6 | Şemanın **W'si kabın genişliğini aşmaz** | 460 birimlik kutu 397 px'e sığdırılınca ölçek 0,863 → adlar **6,0 px** |
| 7 | Eksen bölmesi **1/2/2,5/5 × 10ⁿ**'e oturur (`_frNiceAxis`) | `0 · 12,1 · 24,2 · 36,2 · 48,3` — 36,2 bir bölme değil, yuvarlama artığı |
| 8 | Kırmızı vurgu yalnız **hükmü verebilen** kasnakta | 36 hücre kırmızıydı ve sayfanın KENDİ hükmüyle çelişiyordu |

**6. maddenin sebebi çizicinin kabuğunda:** `veFeadLayoutSVG` `max-width:<W>px`
yazıyor, yani SVG asla W'den geniş çizilmiyor ama dar bir kaba konursa
KÜÇÜLTÜLÜYOR — ve puntolar kullanıcı biriminde sabit olduğu için onlar da
küçülüyor. Kural: **istenen W, kabın genişliğinden küçük ya da eşit olmalı.**
Kanvas kartında W zaten kutunun kendi ölçüsü, yani oran 1 ve sorun yok.

**8. madde bir MANTIK hatasıydı, kozmetik değil.** `SF < servis faktörü` olan
her hücre kırmızı basılıyordu; AG00976'da bu, gerginlik oranı 1,00 olan üç
sütunun (iki avara + gergi) **36 hücresini** kırmızıya boyuyordu. Ama aynı
sayfanın hükmü *"yük taşımayanlarda o sayı bir marj değil KAPASİTEDİR"* diyor
— vurgu metnin tam tersini bağırıyordu. Sayı gizlenmiyor: soluk basılıyor ve
başlığında **`yük taşımaz`** yazıyor.

##### Çizici de düzeldi — kazanç KANVASTA da var

Üçü de `js/cp-fead.js` / `js/cp-fead-report.js` içinde ve iki belgeyi birden
düzeltiyor:

| Ne | Nerede | Kanvasa etkisi |
|----|--------|----------------|
| Sınır kutusuna **etiket genişliği** katılıyor (iki geçiş: önce ölçek, sonra taşan pay kadar kenar payı) | `veFeadLayoutSVG` | uzun adlı kasnak artık çerçeveyi aşmıyor |
| Etiket **kayış yolunu engel sayıyor** | `veFeadLayoutSVG` | kart da okunur oldu |
| Eksen bölmesi yuvarlak sayıya oturuyor | `_frNiceAxis` / `_frChart` | ayrıntılı raporun **bütün** grafikleri (ölçüldü: `0 | 200 | 400…`, `1690 | 1700…`) |

Ölçek ile etiket genişliği **birbirine bağlı** (etiket px, sınır mm; ikisini
çözen `s` sınırdan geliyor) → tek geçişte çözülemez. İkinci geçiş `s`'yi
küçültür, yani etiketler daha da daralır; yakınsama tek adımda garanti.

**Etiket kısaltmak ile yer değiştirmek AYRI işler** ve mutasyonla ayrıştı:
etiketi koşulsuz üste sabitleyince **kısa kodla bile** iki çakışma çıkıyor
(`AVA1`, `TEN`); yerleştirici açıkken **tam adla bile** çakışma yok. Yani kod
GENİŞLİK için, yerleştirici ÇAKIŞMA için.

##### Ekranda kırpılan ≠ baskıda taşan — ikisi de sessizdi

Sayfa bir ara `height:297mm; overflow:hidden` idi ve baskıda `height:auto`.
Yani ekranda **sessizce kırpılan** içerik baskıda **altıncı sayfaya** düşüyor,
iki yüzey birbirinden habersiz kalıyordu. Artık `min-height`: taşan sayfa
ekranda da UZUYOR — kardeşlerinden uzun duran bir sayfa gözle görünür.

##### Beş sayfa = beş soru

Tedarikçi çıktısının sayfa adları (*"Geometric Analysis 1/2"*) bir DOSYA
numaralandırmasıydı; sayfanın neyi cevapladığını söylemiyordu.

| # | Sayfa | Cevapladığı soru |
|---|-------|------------------|
| 1 | **Genel Bakış** | nasıl duruyor · özetle nasıl (şema · künyeler · 5 kritik sayı · **kapsam**) |
| 2 | **Geometri** | nerede duruyor (yerleşim · kayış yolu · aksesuar devirleri · **boy dengesi**) |
| 3 | **Gergi Çalışma Zarfı** | kol nasıl geziyor (6 konum × 10 satır · gerginlik eğrisi) |
| 4 | **Yükler** | ne kadar yükleniyor (duty girdisi · gerginlik ve hubload matrisleri) |
| 5 | **Dayanım** | ne kadar dayanıyor (kayma · yorulma · ömür · titreşim · tepe yük) |

**Sayfa 1'in "Belgenin Kapsamı" bloğu bir süs değil:** bir özet raporun en
pahalı sessiz hatası, İÇERMEDİĞİ bir kontrolün yapıldığı izlenimini
bırakmasıdır — tablolar dolu görünür, hüküm verilir, okuyucu neyin
denetlenmediğini bilmez. Blok "ne var / ne yok"u yan yana yazıyor.

**Sayfa 2'nin "Kayış Boyu Dengesi" tablosu ELLE TOPLANABİLİR olsun diye var:**
*"efektif tahrik boyu 1716,2 mm"* tek başına doğrulanamaz; sarım yayları
(667,53) + serbest açıklıklar (1048,67) = 1716,20 mm olarak parçalanınca
okuyucu toplamı kendisi yapabiliyor.

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı: serif kalınlığını 700
yapma (sentetik), iki satırlık tabloda da sabit sütun arama, şemada tam ad +
sarım açısına dönme, kırmızıyı global en düşüğe çevirme, `nice` ekseni kapatma,
bir sayfanın kod künyesini düşürme, punto tabanını 7,4'e indirme, şemayı ikinci
kez çizme.

##### Eksik şekiller geri gelirken ÇİZİCİLER de düzeldi — beş sessiz kusur

Beşinin de ortak imzası aynı: belge yine üretiliyor, hata çıkmıyor, yalnız
şekil ya yanlış duruyor ya da **yanlış şeyi söylüyor**. Beşi de kapısızken
mutasyondan sağ çıkıyordu; kapıları eklendi ve onu da kırmızı.

| Kusur | Belirti | Kök neden |
|-------|---------|-----------|
| Frekans haritasının **göstergesi çizim alanının içinde** | yedi girdi, altı eğrinin dördünü kesiyor | `_frChart`'ın sağ payı 18 px'te sabitti; gösterge için pay yoktu |
| Gösterge **tam kasnak adlarını** basıyor | en geniş girdi 262 px = çizim alanının %42'si | ad kısaltma yüzeyi yoktu |
| Kayma grafiğinin **sağ payı 30 px'te sabit** | `14,95` viewBox'ı **10 px** aşıp kırpılıyor | pay etiket genişliğinden türemiyordu |
| Kayma grafiği **gergiyi kırmızı** basıyor | sayfanın kendi hükmüyle çelişiyor | yük taşıyan/taşımayan ayrımı yalnız MATRİSTE yapılmıştı |
| Frekans haritası **`H: 300`** yazıyor | özet raporda sayfa taşıyor | `_FR_H` sessizce yutuluyordu (take-up doğru yapıyordu) |

**KOD ÜRETİCİSİ KÖPRÜYE TAŞINDI** (`veFeadPulleyCodes`, `js/fead-model.js`):
kısa kodu artık hem özet rapor hem ayrıntılı raporun frekans ve kayma
grafikleri kullanıyor. İkinci bir kopya `source-hygiene` kapısına takılır ve
iki yüzey sessizce ayrışırdı. Kod bir kısaltma değil bir **kimlik**:
kullanıldığı her yüzeyde karşılığı aynı sayfada basılmak zorunda.

> Beşincisi **ilk turda YEŞİL kaldı**: kapı `_frNiceAxis`'i doğrudan
> çağırıyordu, GRAFİĞİN onu kullandığını ölçmüyordu. İkinci kapı basılan bölme
> ETİKETLERİNE bakıyor (eşit aralık + adım 1/2/2,5/5 × 10ⁿ) — Şekil 1'deki
> *"yay sayısına bakan test"* dersinin aynısı.

##### DENETİM TURU — üç sessiz SAYI hatası (2026-08-26)

Kullanıcı sordu: *"Ayrıca tepe gerginliği ve hubload için kalibre değil
yazmışsın. Neden kalibre değil? Programımız bunu hesaplamıyor mu?"* — ve
ayrıca *"hesapların rapora tam olarak aktarıldığından da emin olalım"*.
On üç ajanlık bir denetim koştu; Gates'ten aktarılan **sayılarda yanlış
YOK** (yerleşim 34 değer 0,00 mm · span+sarım 12 değer 0,039 · ortalama
gerginlik/hubload 144 değer ≤1 N · kayma matrisi 72 değer 0 uyuşmazlık),
ama **hüküm ve metin katmanında üç gerçek hata** çıktı.

###### 1 · KAYIŞ BİRİM KÜTLESİ — çekirdeğin KENDİ uyarısı yok sayılıyordu

`fead-core.js` `BELT_DB` Gates PK için **katalog** kütlesini taşıyor
(0,0144 kg/m/kaburga) ama kendi yorumunda **reddediyor**: hem kesit tahmini
hem AG00686 frekans haritasından geri-hesap **~0,0196** veriyor ve
*"massPerRibKgM'i acikca gecmek onerilir"* diye yazıyor. `AG00976_GATES_2025`
örneği alanı **yazmıyordu** → katalog değeri kullanılıyordu.

**ÖLÇÜLDÜ** (2750 d/d, altı açıklık):

| m′ | f₁ [Hz] | ateşlemeyle kesişen hücre | en düşük f₁/ateşleme |
|---|---|---:|---:|
| 0,0144 (katalog) | 299,0 · 312,9 · 237,6 · **131,3** · 155,8 · 214,3 | **1 / 72** | 0,955 |
| **0,0196** (geri-hesap) | 250,1 · 261,7 · 196,3 · **108,5** · 127,1 · 174,7 | **3 / 72** | **0,789** |

**HATA EMNİYETLİ TARAFTA DEĞİL:** `f₁ ∝ 1/√m′`, yani hafif kayış frekansı
YÜKSEK gösterir ve **rezonans riskini küçültür**. Yalnız frekans tablosunu
etkiliyor: B10 (1403,032) ve tasarım gerginliği (544,0497) iki değerde de
birebir aynı.

###### 2 · REZONANS HÜKMÜ YOKTU — üstelik sayfanın KENDİ verisinde kesişme var

Belge hem açıklık frekansını hem ateşleme frekansını basıyor ama
**karşılaştırmıyordu**. Basılan tek titreşim hükmü `Çırpınma = yok` idi ve
okuyucu onu *"titreşim sorunu yok"* diye okuyor — oysa çırpınma bambaşka bir
mod (kayış hızı ↔ enine dalga hızı), rezonansla ilgisi yok.

Artık hüküm basılıyor: *"en düşük f₁ / ateşleme = 0,789 (AVA2 → ALT @ 2750
d/d); ateşleme frekansının altına düşen hücre 3 / 72 ✗"*. **Frekans haritası
ile açıklık tablosu aynı sayfaya alındı** — harita bu tablonun çizimi, tablo
haritanın sayısı; ayrı sayfalarda okuyucu eğriyi sayıya bağlayamıyordu.

Kapsam kutusundaki *"rezonans haritası yer ALMAZ"* satırı da düzeltildi:
sayfa 1 o haritayı **çiziyor**. Yer almayan şey açıklık titreşimi değil, çok
serbestlik dereceli **burulma** modu.

###### 3 · MANŞETTE HAM B10 — modelin kendi düzeltmesi gizliydi

Sayfa 1'in kartı ham **1403 saat** basıyordu (Gates 2670'e −%47), modelin
ampirik düzeltmeli kestirimi **2551** (−%4,5) yalnız sayfa 5'te duruyordu.
Kart artık düzeltilmiş değeri manşete, hamı alt satıra alıyor — sayı
gizlenmiyor, **sıralaması** düzeliyor.

Ayrıca: *"yorulma payları çap penceresinden bağımsız olarak geçerlidir"*
iddiası **geçersizdi** — pencere dağılımın kendisinden kalibre edilmiş.
Doğrusu ölçüldü: **SIRALAMA** üs seçiminden bağımsız (m = 5,6 ↔ 4,05 ↔ 3,4
için de ALT baskın), ama mutlak pay değil (%86,9 → %73,4).

###### "KALİBRE DEĞİL" = HESAPLANMIYOR DEĞİL, DOĞRULANMIYOR

Kullanıcının sorusunun cevabı: **tepe yük hesaplanıyor.** Çekirdeğin
`peakEstimate`'i yarı-statik gerilme zinciri + kasnak başına atalet terimi
kuruyor; köprü katmanı aksesuar güçlerinin %100/%10 kombinasyonları ile
± ivmeyi tarayıp kasnak başına en büyüğü alıyor.

Eksik olan **doğrulama**: 17 rapordan çıkarılmış 2095 değerlik kümede
**tek bir tepe değeri yok** (ölçüldü — fixture'da `peak`/`accel` alanı hiç
geçmiyor). Tepe tablosu olan tek rapora karşı sapma gerginlikte
**−%10,5 … +%22,8** (RMS %11,8), hubloadda **−%10,3 … +%17,5** (RMS %9,7).

> **BU AÇIKLAMA ÇÜRÜTÜLDÜ (2026-08-27).** Aşağıdaki "şekil farkı" gerekçesi bir
> yıl sonra ölçümle düştü: aksesuarların atalet talepleri iki modelde **%2,5
> içinde aynıydı** (KK 49,25 ↔ 48 N · ALT 154,58 ↔ 151 N). Dağılım aynı;
> ayrışan tek şey tepe zincirinde **çevrimin kapanmamasıydı**. Çevrim
> kapatılınca aşağıdaki bütün sapmalar %1'in altına iniyor ve tablo Gates'in
> desenine oturuyor (bkz. *"TEPE ZİNCİRİNDE ÇEVRİM KAPANMIYORDU"*). Sayılar
> **o zamanki hâli** belgelemek için duruyor; bugünkü sapma bandı
> gerginlikte −%0,0 … +%1,0, hubloadda −%0,0 … +%0,9.

**AMA ASIL FARK BÜYÜKLÜKTE DEĞİL ŞEKİLDE** — damganın *o zamanki* gerekçesi buydu.
Tepe/ortalama oranı:

| | MFSim | Gates |
|---|---:|---:|
| FAN | 1,065 | 1,148 |
| AVA1 | 1,061 | 1,146 |
| KK | 1,034 | 1,151 |
| AVA2 | 1,029 | 1,149 |
| **ALT** | **1,230** | **1,002** |
| TEN | 1,000 | 1,000 |

Tedarikçi yük taşıyan dört kasnağın dördüne de neredeyse **aynı payı**
(≈1,15) veriyor ve alternatöre hiç vermiyor. Bu model tersini yapıyor:
atalet terimi kasnak BAŞINA (`J·α·oran/r`) olduğu için ivmenin etkisi küçük
ve hızlı dönen alternatörde **toplanıyor** (+%23), büyükler %3–7'de kalıyor.
İki model aynı sayıya farklı yoldan yaklaşmıyor; yükü **başka yere
dağıtıyorlar**. Damganın kalkması için birden çok raporun tepe tablosu
gerekir — tek raporla sabit uydurmak o raporu ezberlemek olurdu.

Gerekçe artık tablonun altında paragraf değil, **kapsam bölümünde künye**
(model sınırları: tepe yük · B10 çap penceresi · kayış kütlesi). Tablonun
altında tek satır kalıyor: *"Kalibre değil, HESAPLANMIYOR demek değildir."*

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı: rezonans hükmünü
kaldırma, kayış kütlesini katalog değerine döndürme, kapsam çelişkisini geri
getirme, manşete yine ham B10 yazma, model sınırları künyesini silme,
frekans göstergesini içeri alma, kayma grafiğinde yük ayrımını kaldırma,
gergi kod kısayolunu silme.

##### PROFESYONEL TUR — kapsam kutusu kalktı, dört bölüm eklendi (2026-08-27)

Kullanıcı bildirimi: *"'Belgenin Kapsamı' kısmını da çıkar. Ona da gerek yok.
Çok amatörce olmuş. Bu raporu daha profesyonel bir yapıya kavuşturalım. Amatör
açıklamaları kaldıralım."* Ayrıca: *"'Detay Rapor' kısmında olup da bu raporda
olmayan hangi kısımlar var?"*

###### AÇIKLAMA DEĞİL KÜNYE — ölçülen ton farkı

**ÖLÇÜLDÜ:** on sekiz açıklama notundan ikisi 627 ve 684 karakterdi — birer
deneme yazısı. Bir mühendislik raporunda tablo altı notu bir cümledir.

| | önce | sonra |
|---|---:|---:|
| en uzun not | **684 karakter** | 176 |
| 300 karakteri aşan not | **4** | **0** |
| toplam açıklama metni | 4 186 karakter | **1 693** |

Kaldırılan kalıplar: ikinci tekil anlatım, *"…demek değildir"*, *"çare …"*,
*"biri 'yok' diye öbürü güvenli sayılmaz"*, ölçüm anlatısı. Kalan: birim,
kaynak, ve sayının yanlış okunmasını önleyen tek cümle.

**KAPSAM KUTUSU KALKTI, YERİNE NUMARALI NOTLAR.** *"Bu belge şunları verir /
Bu belgede yer ALMAZ"* iki kutusu bir rapor bölümü değil, bir sunum öğesiydi.
Model sınırları bir mühendislik raporunda kalmak ZORUNDA — ama yeri belgenin
sonundaki **numaralı Notlar** bölümüdür ve metin oraya `(Not n)` ile atıf
yapar. Altı not: tepe yükün doğrulanmamışlığı · B10 çap penceresi · yorulma
üssü · kayış birim kütlesi · hubload vektörü · kapsam dışı kalanlar.

###### DETAYLI RAPORLA KAPSAM DENKLİĞİ — dört bölüm eksikti

Ayrıntılı raporun 19 alt bölümü tek tek tarandı (`kapsam.js`). On beşi özette
zaten vardı; **dördü yoktu ve dördü de üretilebilirdi**:

| Detaylı rapor | Özette | Bugün | Veri |
|---|---|---|---|
| §8.13 Aksesuar mil torku | ✗ | **✓ s4** | `Q = 9549·P/n`, perPulley'den türer |
| §8.15 Yük durumunun yorulmaya katkısı | ✗ | **✓ s4** | `fatigue.perLoadPct` |
| §8.18 Sistem burulma titreşimi | ✗ | **✓ s1** | `R.torsional` |
| §8.19 Tasarım notları | ✗ | **✓ s6** | numaralı Notlar |

**BURULMA SAYFA 1'DE, TİTREŞİMİN GERİ KALANIYLA BİRLİKTE:** doğal frekans
haritası, açıklık tablosu ve burulma modları üçü de titreşim; ayrı sayfalara
düşünce okuyucu üçünü birbirine bağlayamıyordu.

**BURULMA SAYISI KRANK MİLİ ATALETİNE BAĞLI** ve harness'ta ölü girdiydi:
gerçek panel yolu `crankInertia` geçiyor, doğrulama harness'ı geçmiyordu —
1. elastik mod **12,9 yerine 16,8 Hz** çıkıyordu (%29). Test harness'ı artık
uygulamanın yolunu birebir taklit ediyor; kapı frekansı 11–15 Hz bandında
tutuyor.

###### ALTI SAYFA — içerik büyüdüğü için, tercih olarak değil

| # | Sayfa | Cevapladığı soru |
|---|-------|------------------|
| 1 | **Genel Bakış** | nasıl duruyor · titreşimi ne (şema · künyeler · 5 kart · frekans haritası · açıklık tablosu · burulma) |
| 2 | **Geometri** | nerede duruyor |
| 3 | **Gergi Çalışma Zarfı** | kol nasıl geziyor (6 konum · iki grafik yan yana) |
| 4 | **Çalışma Çevrimi ve Torklar** | ne isteniyor (duty girdisi · mil torku · yorulma katkısı) |
| 5 | **Gerginlik ve Hubload** | ne kadar kuvvet (ortalama gerginlik · hubload · tepe yük) |
| 6 | **Dayanım ve Titreşim** | ne kadar dayanıyor (kayma · yorulma · ömür · Notlar) |

Sayfa 4'ün üç tablosu da **devir noktasıyla indekslidir** (girdi → ondan çıkan
tork → o noktanın yorulmaya katkısı); sayfa 5'in üçü de kuvvettir. Bölüşüm
tema değil, INDEKS ortaklığı.

**ÖLÇÜLDÜ:** altı sayfa da taşmasız, doluluk %81–99, yatay taşma 0, viewBox
dışı SVG yazısı 0, çakışma 0, sentetik kalın 0.

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı: Notlar bölümünü kaldırma,
burulma / mil torku / yük katkısı bloklarını tek tek kaldırma, kapsam dışı
notunu silme, tork sabitini bozma (9549 → 9459), rezonans hükmünü kaldırma,
kayış kütlesini katalog değerine döndürme. Tork ve yük katkısı kapıları önce
**yalnız başlığa** bakıyordu ve mutasyondan sağ çıkıyordu — artık basılan
hücrenin ARİTMETİĞİNİ (`Q = 9549·P/n`) ve payların toplamının %100 olmasını
tutuyorlar.

##### TEPE ZİNCİRİNDE ÇEVRİM KAPANMIYORDU — 14 farkın tek kök nedeni (2026-08-27)

Kullanıcı özet raporu Gates AG00976'nın kendi PDF'iyle **tablo tablo, sayı sayı**
karşılaştırttı. 318 değer ölçüldü, **300'ü tuttu**; tutmayan 18'in **14'ü tek
tabloda** — tepe gerginlik/hubload — ve hepsinin tek bir kök nedeni çıktı.

| Blok | Değer | Tutan |
|------|------:|------:|
| Kasnak yerleşimi · kayış yolu · duty girdisi | 96 | 96 |
| Ortalama gerginlik + hubload (12×6×2) | 144 | 144 |
| Gergi çalışma zarfı (6×10) | 60 | 56 |
| **Tepe gerginlik + hubload + yön** | 18 | **4** |

Gergi zarfındaki dördü de Gates'in **kendi basım gürültüsünün** içinde: Gates
1 ondalık basıyor ve kendi tablosu (θ ↔ X,Y, pivot + kol boyu ile) **0,108 mm /
0,068°** kendi içinde tutarsız; modelinki 2,8e−14. Load konumundaki +%0,66 ise
take-up tekilliğinin büyütmesi — aynı 0,05°'lik sarım farkı Mean'de %0,14,
Load'da **%1,08** oynatıyor (7,7 kat).

**BAĞIMSIZ DOĞRULAMA — Gates'in kendi eğrisi:** s1'deki "Belt Tension Control"
grafiği 600 dpi'da piksel piksel izlendi. Dikey konum çizgileri modelin göreli
kol açılarına **0,08° içinde** oturuyor (tablodaki 1 ondalıklı basımdan daha
iyi), ve eğrinin kendisi 58 noktada **RMS %0,25** (en kötü %0,70) örtüşüyor.

###### Kök neden: ivme terimi kayış çevrimini kapatmıyordu

Kayış KAPALI bir halkadır: bir tam turda gerginlik değişimlerinin toplamı sıfır
olmak **zorunda** — topolojik özdeşlik, modelleme tercihi değil.
`peakEstimate` bunu GÜÇ için zorluyor (`kw[krank] = Σ diğerleri`), ATALET için
zorlamıyordu: kranka kasnağın **kendi** ataletini yazıyordu.

```
krank adımı  J·α·oran/r                        =  +89,69 N
Σ aksesuar   5,53 + 49,25 + 5,53 + 154,58      = −214,89 N
ÇEVRİM ARTIĞI                                  = −125,20 N   ← sıfır olmalıydı
```

Zincir gergi açıklığında ankrajlanıp ondan **bir önceki** kasnakta bittiği için
artık hiçbir yere yazılmıyor: tamamı son halkaya (ALT→gergi) biniyor.

**ÜÇ REFERANSSIZ KANIT** (Gates'e hiç bakmadan):

| Kanıt | Ölçüm |
|-------|-------|
| Yön bağımlılığı | zinciri ileri ↔ geri yürütmek beş kasnakta da tam **130,73 N** fark veriyor; çevrim kapansaydı 0 olurdu |
| Ankraj bağımlılığı | ankrajı ALT'a almak sistemi 6,85 N, ALT'ta 123,88 N kaydırıyor |
| Fiziksel imkânsızlık | 0,010 kW'lık bir **avara** üzerinden %29,5 gerginlik sıçraması (ortalama zincirde aynı avarada fark −1,3 N = fiziksel beklenti) |

Aynı sınama ORTALAMA zincirde **1,4e−13 N** ile kapanıyor — yani yaklaşım değil,
tutarsızlık. AG00976'ya özgü de değil: `BMC_FEAD_2026`'da −157,8 N.

**FİZİK:** kayış krank kasnağını hızlandırmaz — o motora cıvatalı ve motor onu
zaten döndürüyor. Kayışın hızlandırdığı kütleler AKSESUARLARDIR; krankta görülen
gerginlik artışı onların taleplerinin **toplamıdır**. Gates'in tablosu bu
kapanışı sağlıyor (204 ↔ 205 N), MFSim'inki sağlamıyordu.

###### Düzeltme çekirdeğe DOKUNMUYOR

`peakEstimate` `inertias` sözlüğünü zaten kabul ediyor — burulma modelinin
kullandığı yol. `veFeadPeakInertias` (fead-model.js) kranka, adımı Σ aksesuara
eşitleyen **eşdeğer** bir J geçiriyor; α sadeleştiği için J_eş ivmeden bağımsız.

**GERGİ KASNAĞI TOPLAMA GİRMEZ** ve bu bir eksiklik değil: zincir orada
ankrajlı olduğu için o kasnağın kendi adımı zaten hiç uygulanmıyor. Toplama
katılsaydı çevrim yine kapanmaz, +5,53 N artık kalırdı. Çekirdeğin kendi notu
*"gergi kolu dinamigi dahil DEGIL"* diyor; gergi kasnağının atalet talebi
(≈%0,35) o sınırın içinde ve **raporda yazılı**.

**ÖLÇÜLDÜ:**

| | önce | sonra | Gates |
|---|---:|---:|---:|
| Tepe gerginlik RMS | %11,83 | **%0,41** | — |
| en kötü | %22,81 | **%0,69** | — |
| Tepe hubload RMS | %9,75 | **%0,39** | — |
| ALT tepe gerginliği | 671 N | **545 N** | 546 N |
| Gergi hubload yönü | 198,8° | **217,1°** | 218° |

**İKİNCİ, BAĞIMSIZ DOĞRULAMA:** düzeltme yalnız s1 tepe tablosundan türetildi.
Gates'in **s6/12** "Most Critical Load Condition" tablosu türetmede hiç
kullanılmadı; kayma-kritik kombinasyon seçimi orada **2/6 → 5/6** tutmaya geçti.

###### "ŞEKİL FARKI" AÇIKLAMASI YANLIŞTI — ölçümle çürütüldü

Bu kayıt ve `cp-fead-summary.js`'in künyesi bir dönem sapmayı bir **model
karakteri** olarak anlatıyordu: *"atalet terimi kasnak başına olduğu için etki
hızlı dönen alternatörde toplanıyor; iki model yükü BAŞKA yere dağıtıyor."*
Ölçüm bunu çürüttü: aksesuarların atalet talepleri iki modelde **%2,5 içinde
aynı** (KK 49,25 ↔ 48 N · ALT 154,58 ↔ 151 N). Dağılım aynıydı; ayrışan tek şey
çevrimin kapanmasıydı. Şekil farkı bağımsız bir karakter değil, kusurun
SONUCUYDU — tepe/ortalama oranı kapanışla birlikte **1,155–1,162** oluyor
(Gates ≈1,15) ve alternatörde 1,00 (Gates 1,002).

**"Kalibre değil" damgası KALIYOR:** doğrulama kümesinde hâlâ tek bir tepe
değeri yok, yani tablo TEK bir rapora karşı ölçülebiliyor.

###### Aynı turda kapatılan dört yan kusur

| Kusur | Belirti | Düzeltme |
|-------|---------|----------|
| **Ölü girdi** — panel ivmesi tabloya ulaşmıyor | `R.peakAccelRpmS` okunuyor, `js/` içinde YAZAN yok; panelde 1100 → 3000 tabloyu **hiç değiştirmiyordu** | `veFeadAnalyze` `accelRpmS`/`decelRpmS`'i sonuca taşıyor, `cp-fead.js` geçiriyor |
| **Basılan ivme işareti** | ALT satırı +1100 yazıyordu, kazanan dal yavaşlamaydı | Etkin işaret dalından okunuyor |
| **Anlamsız kombinasyon etiketi** | ALT ve TEN kW kombinasyonundan cebirsel bağımsız (yayılım 2,3e−13 N); kazanan kayan nokta artığıyla seçiliyordu | Ayırt etmiyorsa `combo: null` |
| **Taramanın yarısı tekrar** | köprü ±ivme geçiyor, çekirdek de kendi içinde ±dallanıyor → 16 dalın 8'i kopya | Tek katmanda süpürme |

**İVME İŞARETİ KAPISI AG00976'DA ISIRAMAZ** ve sebebi öğretici: çevrim
kapatıldıktan sonra altı kasnağın altısı da **hızlanma** dalında kazanıyor —
yavaşlama hiçbir yerde tepe üretmiyor. Kapı bu yüzden yavaşlamanın gerçekten
kazandığı bir düzende kurulu (avara ataletleri ×1000 → 1/6 kasnak decel).

###### Belgenin kendi tutarlılığı — üç bayat metin

| Ne | Neydi | Ne oldu |
|----|-------|---------|
| Manşetteki sayfa atfı | `bkz. sayfa 5` elle yazılı; belge beş sayfadan altıya çıkınca bayat kaldı, ömür bloğu **sayfa 6**'da | `_fsrSheetNo` sayfa listesinden türetiyor |
| Not 3'ün üs duyarlılığı | `%86,9'dan %73,4'e` elle yazılı iki sabit, yalnız m = 5,6 ↔ 3,4 çiftine ait; PK-2_2a seçiliyken tablo **%53,0** derken not %86,9 diyordu | Baskın kasnak ve payı dağılımın KENDİSİNDEN |
| Ömür kartı | Seçili yorulma modelini etiket olarak basıyor ama saat **her zaman m = 5,6** ile hesaplanıyordu; köprü uyumsuzluğu `life.modelMismatch` ile bildiriyordu, özet rapor **okumuyordu** | Kart uyuşmazlığı kırmızı basıyor |

**Kapı sekiz mutasyonla ölçüldü, sekizi de kırmızı:** `veFeadPeakInertias`'ı boş
döndürme (7 test), `inertias`'ı geçirmeme (5), panel ivmesini taşımama, etiketi
her zaman basma, uyuşmazlığı susturma, Not 3'ü yine elle yazma, sayfa atfını
5'e sabitleme, geçirilen ivmeyi kaydetme.

##### KAYMA EŞİĞİ — "ne kadar aşağı inebilirim" (2026-08-28)

Kayma hükmü boyutsuz SF ile veriliyordu; **N cinsinden** *"kaymamak için gereken
en düşük ankraj gerginliği"* diye bir büyüklük modelde HİÇ YOKTU. Tedarikçi
çıktısı onu gerginlik grafiğinde yatay bir çizgi olarak basıyor; MFSim'in aynı
grafiği o çizgisiz çiziyordu.

`veFeadSlipThreshold` (fead-model.js) **kapalı formda, iterasyonsuz**: açıklık
gerginlikleri ankrajdan SABİT farklarla ayrılır (fark torkla belirlenir,
ankrajdan bağımsızdır), yani `T_i = T₀ + Δ_i`. Bir kasnakta kayma sınırı
`T_gergin/T_gevşek = e^(μφ) = cap` olduğunda

```
T₀* = (Δ_gergin − cap·Δ_gevşek) / (cap − 1)
```

**İKİ BAĞIMSIZ YOL, |Δ| ≤ 1,4e−14 N.** İkinci yol cebirle ilgisiz: ankraj
gerçekten değiştirilip `veFeadAnalyze` baştan koşturuluyor ve yük taşıyan
kasnakların en düşük SF'sinin 1'e düştüğü nokta iki-bölmeyle aranıyor.
Sonuç `SF = 1,000000000` @ **80,948 N**, aynı kasnak (FAN), aynı devir (1000).
Bir işaret hatası iki yolda birden aynı şekilde çıkamaz.

| | AG00976 |
|---|---|
| Eşik | **80,95 N** |
| Belirleyici | Sürücü Kasnak (FAN) @ **1000 d/d** |
| Tasarım gerginliği | 544,05 N |
| Pay | **6,72 kat** |

**GERGİN OLAN AÇIKLIK ARANIR — sürücüde ÇIKIŞ, sürülende GİRİŞ.** ÖLÇÜLDÜ
(@1000 d/d): altı kasnağın **beşinde giriş** daha gergin. *"Çıkış her zaman
gergin"* varsayımı alternatörde kökü **39,52 → −480,98 N** yapıyor — ama genel
EN BÜYÜK yine FAN'da kaldığı için toplam sayıya bakan bir kapı bunu SESSİZCE
geçiriyor (mutasyonla ölçüldü, kapı yeniden kuruldu: tek bir sürülen kasnak
yalıtılıyor).

**YÜK TAŞIMAYANLAR DIŞARIDA — gerekçe TUTARLILIK, matematiksel imkânsızlık
DEĞİL.** Bir avara da pekâlâ kök verir; ÖLÇÜLDÜ, kökleri **−856,6 … +5,6 N**,
yani belirleyicinin çok altında → **bu sistemde filtre sayıyı DEĞİŞTİRMİYOR**.
Filtrenin işi hükmü hizada tutmak: kayma hükmünü raporun kendisi yük
taşıyanların en düşüğünden veriyor (`_frMinSF`), çünkü oran ≈ 1 olan bir
avarada SF bir MARJ değil o sarım açısının KAPASİTESİDİR. İki farklı kayma
ölçütü aynı belgede duramaz. Kapı bu yüzden **sentetik**: avaranın kökü
belirleyicinin üstüne (19 490 N) çıkarılıyor ve yine yüklü olan seçiliyor.

**GATES'İN BASTIĞI SAYI KOPYALANMIYOR ve sebebi Gates'in kendi çelişkisi:**
s1 grafiğinde **157,65 N** yazıyor, ama kendi kayma sayfasının (s6/12) FAN
eğrisinden türeyen değer **66,6 N** — aynı raporun iki sayfası arasında
**2,37 kat**. MFSim'in 80,95 N'ı Gates'in kayma VERİSİNE +%21,5 uzakta, basılı
ÇİZGİYE 2 kat. Sayı modelin kendi zincirinden türetiliyor.

**Çizgi eğrinin ALTINA çiziliyor** (üstünü örtmesin) ve altı taralı — tedarikçi
çıktısının kendi biçimi. Çizgi hem ayrıntılı hem özet raporda, **tek çiziciden**
(`_frTensionFigure`).

###### Eşik çizgisinin YERİ ayrı bir kapı — ve ilk hâli ısırmıyordu

Sayıyı künyeye doğru yazıp çizgiyi yanlış yere koymak SESSİZ bir kusur: belge
tutarlı görünür, grafik yalan söyler. Kapı çizginin y'sini grafiğin kendi
**bölme etiketlerinden** geri çözüyor (çizicinin `sy`sine hiç başvurmadan).

İlk tolerans *"başka bir bölmeye düşmesin"* idi ve bölme aralığı **48,4 px**
olduğu için bu **24 px'lik** bir kapı demekti: `+12 px` kaydırma da, `×1,5`
ölçek hatası da SESSİZCE geçiyordu (ölçüldü). Etiket temel çizgisinin bölmenin
4 px altına yazıldığı (`y="(Y+4)"`) fark edilip ofset ayıklanınca tolerans
**0,5 px**'e indi; dört mutasyonun dördü de kırmızı — `×1,5`, `+12 px`,
**`+1 px`** ve tasarım gerginliğini çizme.

###### Aynı turda kapatılan üç eksik satır

| Ne | Neydi | Ne oldu |
|----|-------|---------|
| **Kayış katalog adı** | Künye `GATES 8PK` diyordu; tedarikçiyle konuşurken tek tanımlayıcı olan `8PK1715HD` belgede HİÇ geçmiyordu | `beltType` köprüden geçiyor, künyede `GATES 8PK1715HD` |
| **Yay ortalama momenti** | Tedarikçi künyesinin *"Spring Mean Load"* satırı belgede yoktu | `M₀ + k·rel` → **22,076 Nm** ↔ Gates 22,07 (%0,027), † ile türev işaretli |
| **Hazırlayan** | Antet alanı OKUYOR ama hiçbir yüzey YAZMIYORDU → altı sayfada da `Hazırlayan: —` | Panelde alan var; kapı zinciri uçtan uca tutuyor |

**KAYIŞ KİMLİĞİ AYRI SATIR DEĞİL** ve sebebi ölçüldü: ayrı satır sayfa 1'i
**8 px** taşırıyordu (1131 ↔ tavan 1123) ve katalog adı profili zaten kapsıyor.

**YAY MOMENTİ ÜÇ ONDALIKLA basılır, iki değil:** 22,076 iki ondalıkta
**22,08**'e yuvarlanıyor ve Gates 22,07 yazdığı için okuyucu bir basamaklık
HAYALİ bir uyuşmazlık görürdü. İki yol da (çekirdeğin `springTorque`u ve yedek
`M₀ + k·rel`) aynı sayıyı veriyor ve kapı ikisini birbirine bağlıyor.

###### KK ATALETİ DEĞİŞTİRİLMEDİ — bir "aykırı değer" iddiası ÖLÇÜMLE ÇÜRÜTÜLDÜ

Bir denetim turunda *"Klima kompresörünün ataleti Gates'inkinin 5,85 katı, bir
aykırı değer"* iddiası çıktı. **Çürütüldü:**

1. **Atalet çapla ölçeklenmiyor** — fixture'ın kendisi gösteriyor:
   ALT Ø57,4 → 0,014 ama TM31 Ø154,4 → 0,0053. Bunlar kasnak ataleti değil,
   **sürülen makinenin** ataleti; büyük kasnak küçük atalet taşıyabiliyor.
2. **Tepe tablosu KK'yı doğrudan yokluyor.** Tarama: en iyi uyum **0,025**
   (RMS %0,253), bugünkü **0,031** (%0,41), Gates'in ima ettiği **0,0053**
   (%1,19). RMS < %0,5 bandı KK ∈ **[0,018 – 0,032]** veriyor; Gates'in
   çapraz-rapor bandı bunun **3–6 katı dışında**.

Yani veri bugünkü değeri destekliyor, iddiayı değil. **Girdi değiştirilmedi.**

> **YÖNTEM NOTU — ölçüm aracının kendisi bir kez sessizce ÖLÜYDÜ.** Atalet
> yoklaması `n.data.name` üzerinden mutasyon uyguluyordu; örnek düğümleri adı
> `customName`de taşıyor, dolayısıyla sekiz tarama satırı da **birebir aynı**
> sayıyı basıyordu ve "duyarsız" diye okunuyordu. Yoklama artık `n.id` ile
> anahtarlanıyor **ve** mutasyon `node.data`'yı gerçekten değiştirmediyse
> `MUTASYON ETKİSİZ — ölçüm geçersiz` diye ATIYOR. Kullanıcının uyardığı
> sınıfın (*"yanlış iteratif değer çıkarma"*) tam örneği.

**FAN ATALETİ DUYARSIZ ve bu çevrim kapanışının KANITI:** FAN'ın kendi
ataletini değiştirmek tepe tablosunu **%0,413**'te sabit bırakıyor — krankın
kendi ataleti artık zincire hiç girmiyor, `veFeadPeakInertias` onu aksesuar
taleplerinin toplamına eşitliyor (bkz. *"TEPE ZİNCİRİNDE ÇEVRİM
KAPANMIYORDU"*).

**Kapı on üç mutasyonla ölçüldü, on üçü de kırmızı:** kapalı formda işaret ters
(4 test), satırlarda maks yerine min (3), `max/min` yerine "çıkış hep gergin"
(1), yük filtresini kaldırma (1), raporun oranı kendi kopyasında tutması (1),
eşiği hiç hesaplamama (3), çizgiyi %50 / +12 px / **+1 px** kaydırma ve tasarım
gerginliğini çizme (her biri 1), Gates'in 157,65'ini kopyalama (1), yay
momentini sabitleme (1), katalog adını düşürme (2), yay momenti satırını
kaldırma (1), Hazırlayan alanını panelden kaldırma (1), anteti hep `—` bastırma
(1).

##### Uydurulmayan şeyler — raporun kendi §9'unda yazılı

| Gates sayfası | Neden yok |
|---|---|
| Natural Frequency / System Resonance | Çok serbestlik dereceli **burulma** modu; çekirdek yalnız gergi kol modu verir (ölçüldü: %19 fark) |
| Pulley Alignment Sensitivity | Geometri tek düzlemde çözülüyor; fleeting açısı ve eksenel offset modelde yok |
| Belt Slip Sensitivity taraması | "En kritik ivme + yük kombinasyonu" araması ve ters çözüm çekirdekte yok |
| Weibull / incidents per 1000 | İstatistiksel dağılım modeli yok |
| Peak Torque eğrisi | Ayrı büyüklük; §8.13 açıkça **"ortalama"** diyor |

##### İki sessiz birim tuzağı (ikisi de testli)

`wearPct` çekirdekte **ORAN** (0,007), tedarikçi sayfasında **%0,70** — ham
basılsaydı okuyan kişi payı yüz kat küçük sanırdı. `Number(null) === 0` ise
girilmemiş bir alanı "0 ölçüldü" gibi gösterirdi; `_frNum` null/undefined/''
değerlerini NaN'a çeviriyor ve rapor `—` basıyor.

##### Grafik ölçeği — tekillik kesilir

Belt Tension Control grafiğinde kol açısı çözüm aralığının ucuna yaklaşırken
gerginlik **tekilleşiyor** (T milyarlara çıkıyor). Ham veriye göre ölçeklenen
eksen grafiği okunmaz yapıyordu: çalışma noktaları x ekseninin üstüne yapışıyor,
y etiketleri 9 haneli sayıya dönüyordu (ölçüldü). Eksen çalışma konumlarının
gerginliğine göre sınırlanıyor ve eğri orada kesiliyor — Gates çıktısı da öyle.
Tolerans/aşınma 0 iken dört konum aynı açıya oturduğu için etiketler **tek
çizgide birleştiriliyor**.

##### Biçim: devir SATIR, kasnak SÜTUN

§8.11 ve §8.17 devir başına ayrı tablo basıyordu; aynı span boyları dokuz kez
tekrarlanıyor ve belge 41 000 px'e çıkıyordu (ölçüldü). Matris biçiminde bir
sütunu yukarıdan aşağı okumak, o kasnağın devirle nasıl değiştiğini doğrudan
gösteriyor — tedarikçi sayfasının biçimi de bu.

##### Tasarım gerginliği bir GİRDİ DEĞİL — ankraj türetiliyor (2026-08-25)

Bir önceki bölüm "Design Tension'ın GİRDİ olduğu hiçbir yerde yazmıyordu" diye
bitiyordu ve raporda `girdi` etiketiyle işaretlenmişti. Kullanıcı doğru soruyu
sordu: **girdi olmamalı.** Ölçüldü, haklı çıktı, alan kaldırıldı.

Gerilme zinciri gergide ankrajlanır (`T[gergi] = designTensionN`) ve bütün span
gerilmeleri, hubloadlar, kayma emniyetleri ondan kurulur. Ama gergi kolunun
taşıyabileceği gerginlik yay dengesinden **zaten belirli**:

```
T = M(θ)/(dL/dθ),   M = M₀ + k·θ,   dL/dθ = a·sinβ·2sin(φ/2)
```

Sağdaki hiçbir şey serbest değil: `a`, `M₀`, `k` gergi künyesinden okunur;
`θ`, `φ`, `β` çözülmüş geometriden gelir. **ÖLÇÜLDÜ (10 Gates raporu):**

| | girilen | türeyen | fark |
|---|---|---|---|
| AG00686 | 766 | 765.9 | −0.01% |
| AG00879 · AG00894 · AG00902 ×2 · AG0868 ×3 · AG00686-1520 | 258–609 | 258.2–608.3 | ≤0.12% |
| AG00810 | 759 | 759.9 | +0.12% |

En büyük fark **%0.12**, RMS **%0.08** — tamamı yuvarlama (Gates tam sayı
basıyor). İki kanal zaten **tek kanaldı**.

**Türetilmiş ankrajla 2095 değerlik kapı GEÇİYOR:** çalışma sapması
%0.328 → **%0.391** (eşik %0.5), Load ve kol açısı hiç değişmiyor. O 0.06 puan
model hatası değil: Gates kendi zincirini **yuvarlanmış** tam sayıyla
ankrajlıyor (765.9 değil 766), dolayısıyla girilen değer Gates'in aritmetiğini
yapısal olarak biraz daha iyi taklit ediyordu. Fizik olarak türetilmiş değer
daha tutarlı.

Değişiklik **çekirdeğe dokunmuyor** — çekirdek `designTensionN`'i almaya devam
ediyor, yalnız köprü artık onu kullanıcıdan değil yay dengesinden yazıyor
(`veFeadBuildSystem`, "ANKRAJ TÜRETİLİYOR" bloğu). Doğrulama koşucusu köprüyü
atladığı için (`buildMisc` sistemi doğrudan kurar) kapı raporun kendi değeriyle
ölçmeye devam ediyor; türetilmiş hâli ayrıca ölçüldü.

**Dokunulan yerler:** Çözücü panelindeki alan silindi (`cp-fead.js`) ve
türetilen değer **Algılanan Model** tablosunda görünüyor — panelde okunacak
başka yeri yok, görünmezse "gerginlik nereden geldi" sorusu cevapsız kalırdı.
Raporun §8.7'si karşılaştırma yerine **kuruluş** anlatıyor; envanterde satır
"— aşağıdakilerin hiçbiri girilmez —" ayracının ALTINA taşındı. Teori
belgesindeki "Bu değer **bir girdidir**" cümlesi düzeltildi ve şablon yeniden
üretildi. Hata çevirisi "girilmedi" yerine "türetilemedi" diyor.

**Türetme başarısız olabilir** (kayış boyu gergi kolunun erişemeyeceği kadar
kısa/uzunsa `meanRel` çözülemez). O zaman ankraj YOKTUR: uyarı düşer, çekirdek
gerilme istendiğinde kendi açık hatasını verir, ama `build.ok` **true kalır** ki
yarım modelde kayış yolu kartı çizilmeye devam etsin (kart gerginlik değil
geometri gösteriyor).

Altı mutasyonla ölçüldü — ankrajı yine panelden okuma (3 test kırmızı), türetmeyi
atlama (52), `cfg` ile `sys`i ayrıştırma (1), türetilemedi uyarısını yutma (1),
panel alanını geri getirme (1), Algılanan Model satırını kaldırma (1).

#### Çalışma çevrimi ve çözüm

Duty satırları Çözücü düğümünde durur ve **kW sözlüğü DÜĞÜM KİMLİĞİYLE
anahtarlanır, adla değil** — kullanıcı kasnağı yeniden adlandırınca girdiği güç
kaybolmasın (çekirdeğe geçerken ada çevrilir):

```js
node.data.duty = [ { rpm, dcPct, degC, kw: { <düğüm id>: kW } } ]
```

**Sürücü sütunu tabloda YOK.** Gücü çekirdek diğerlerinin toplamı olarak
hesaplar; çevrim ancak böyle kapanır. Elle girilirse çekirdek reddeder.

**Aksesuar kW'ı katalogdan gelebilir** — MFSim'in mevcut `VE_ALTERNATOR_PRESETS`
/ `VE_AC_PRESETS` / `VE_AIRCOMP_PRESETS` eğrileri (Araç Performans'la AYNI
kaynak, ikinci kopya yok). Aksesuar devri **kasnak pitch çaplarından**
hesaplanır, preset'in kendi `driveRatio`'su KULLANILMAZ: spesifikasyon §2.3'e
göre Excel'in en ciddi hatası elle yazılmış hız oranlarıydı ve bütün
gerilmeleri %17 düşürüyordu. Testi bu ayrımı kilitliyor.

Sonuç oturumluk bir global: `window.veFeadResults`. Takoz'un `veMountResults`'ı
ile aynı kalıp **ve aynı tuzak** — proje değişince temizlenmeli, yoksa yeni
projede önceki projenin tabloları durur (`_feadForgetResults`, `topology.js`
`veResetSubtopoNav`'dan çağrılıyor).

**ÖLÇÜLDÜ (gerçek tarayıcı, AG00686 duty tablosu):** çıkış gerilmeleri
`800: 1210/1208/767/766 · 1250: 1238/1237/767/766 · 2000: 1249/1248/766/766`,
hubload `1911/557/1938/350 · 1939/571/1966/349 · 1949/576/1977/349` —
**hepsi Gates raporuyla birebir.** Yorulma dağılımı `CRK 2.8 · IDR 43.5 ·
A_C 10.2 · TEN 43.5` (rapor 2.6/43.3/10.8/43.3 → 0.6 yüzde puanı içinde).

Gerilme, hubload, kayma ve frekans **HEP ÇALIŞMA (Mean) KONUMUNDA** hesaplanır
(`FEADCore.analyze` → `meanRel`), oysa Geometri tablosu kullanıcının seçtiği kol
konumunu gösterebiliyor. Sarım açısı konumla değiştiği için hubload da değişir;
bu yüzden iki sonuç kartının künyesinde konum **yazılı** — yoksa yan yana okuyan
kullanıcı Min konumun geometrisiyle Mean konumun hubload'unu eşleştirirdi.

##### ÇALIŞMA ÇEVRİMİ BOŞ AÇILMAZ — `js/fead-duty.js` (2026-08-31)

Kullanıcı bildirimi: *"Motor ve Çevrim kısmında aksesuar seçtiğimizde çalışma
çevrimini otomatik olarak hesaplamıyor. El ile girmek gerekiyor. Bu olmamalı.
Programın içinde aksesuarların devirlere göre güç değerleri mevcut olmalı.
Çalışma çevrimi sabit zaten, ona göre tabloyu program otomatik olarak
çıkarmalı."*

**Bildirimin bir yarısı TUTTU, öbür yarısı ÖLÇÜMLE DÜŞTÜ.**

| İddia | Hüküm |
|-------|-------|
| *"tabloyu el ile girmek gerekiyor"* | **DOĞRU** — ÖLÇÜLDÜ: taze sihirbazda **0 devir noktası**; aksesuar modeli seçilse bile doldurulacak satır yok. Panel de aynı: `duty: []` ve *"Henüz devir noktası yok."* |
| *"aksesuar güç değerleri programda mevcut olmalı"* | **ZATEN VAR** — `VE_ALTERNATOR_PRESETS` / `VE_AC_PRESETS` / `VE_AIRCOMP_PRESETS` (Araç Performans'la ORTAK). Eksik olan güç değil, o gücün yazılacağı SATIRDI |
| *"çalışma çevrimi sabit zaten"* | **TUTMADI** — arşivdeki 14 sistemde **ALTI ayrı** devir/%zaman deseni var |

###### TEK BİR "STANDART" ÇEVRİM YOK — ölçüldü

`tests/fixtures/fead-validation.js` taranınca:

| desen | sistem | devir bandı | %zaman |
|-------|-------:|-------------|--------|
| 12 nokta (AG00976) | 4 | 800–2750 | 25·4·4,5·5·5,5·6·7,5·9·0,5·12·16·5 |
| 6 nokta (AG00686 / AG0868) | **5** | 800–2000 | 27·10·13·18·19·13 |
| 10 nokta, ara noktalar sıfır (AG00810) | 1 | 600–2000 | 27·0·10·13·0·18·0·19·0·13 |
| 10 nokta, düşük devir (AG00894) | 1 | 519–2077 | 26,6·10·13·17·18·8·4·3·0,3·0,1 |
| 5 nokta (AG00879) | 1 | 600–2200 | 5·35·35·20·5 |
| 4 nokta (AG00902) | 2 | 700–3000 | 35·45·19·1 |

Yedincisi tedarikçiye GİDEN sayfada (`BMC_FEAD_2026`): 9 nokta, 800–2750.

Yani çevrim **motorun/aracın verisidir**, evrensel bir sabit değil. Tek bir
deseni "standart" diye gömmek, arşivin gösterdiği altı deseni yok saymak
olurdu — bu deponun `sayı UYDURULMAZ` kuralının tam karşılığı. Kütüphane bu
yüzden bir **liste**: yedi ölçülmüş kayıt, her biri kaynağıyla adlandırılmış.

###### VARSAYILAN BİR İDDİA DEĞİL, BİR BAŞLANGIÇ

`VE_FEAD_DUTY_DEFAULT = 'AG00686-6'` ve gerekçesi arşivden: 14 sistemin
**5'i** (en çoğu) bu çevrimi paylaşıyor, bandı (800–2000) ağır ticari bir
motorun rölanti–anma aralığı, ve altı satır gözle denetlenebilecek kadar kısa.
Seçici hemen üstünde duruyor ve kart hangi kaydın yüklü olduğunu **kaynağıyla**
yazıyor — yani "bu senin motorunun çevrimi" iddiası hiçbir yerde yok.

###### İKİ YÜZEY, TEK KÜTÜPHANE

| Yüzey | Nerede |
|-------|--------|
| Sihirbaz 6. adım — *"Çalışma Çevrimi Kaydı"* kartı | `_fwStepCevrim` → `veFeadWizDutyLib` |
| Çözücü paneli — *"Çevrim kaydı"* seçicisi | `veFeadDutyEditor` → `veFeadDutyLib` |

Etiket **tek üreticiden** (`veFeadDutyLabel`): iki yüzey aynı listeyi farklı
adlandırsaydı kullanıcı sihirbazda seçtiği çevrimi panelde bulamazdı (gergi
künyesi turunda ölçülmüş sınıf).

**"ÖZEL" BİR SEÇENEK DEĞİL, BİR OKUMA.** Kullanıcı satırları elle düzenlerse
tablo hiçbir kayda uymaz (`veFeadDutyMatch` → `null`) ve seçici bunu söyler.
Sessizce en yakın kaydı göstermek, düzenlenmiş bir tabloyu katalog kaydı gibi
okutmak olurdu. Eşleme **kW'a BAKMAZ**: güç girilmiş olması çevrimi değiştirmez.

###### TOHUM TEK SEFERLİK VE YALNIZ BOŞ TABLOYA

`veFeadDutySeed` bir `dutySeeded` bayrağı yazıyor. Bayrak olmasaydı, kullanıcı
satırları **bilerek** sildiğinde tablo her panel açılışında geri gelirdi. Dolu
bir tabloya hiç dokunulmuyor → **kaydedilmiş her proje birebir eski davranışını
sürdürüyor** (testli: kendi çevrimi olan bir düğüm ezilmiyor, örneklerin 12 ve
9 satırı korunuyor).

Tohum **panel kurulurken** atılıyor, eylem yolunda değil: yalnız
`_feadSolverNode`'a bağlansaydı tablo İLK açılışta yine boş görünür, ancak
kullanıcı bir düğmeye bastıktan sonra dolardı.

###### ÇEVRİM DEĞİŞİNCE kW TAŞINIR

Devri tutan satırların kayıtlı ölçümü korunuyor; ortak olmayan devirde kW
**uydurulmuyor** (boş kalıp katalogdan hesaplanıyor). Taşınmasaydı çevrim
değiştirmek AG00976'nın rapordan gelen güç tablosunu sessizce silerdi.

###### AYNI TURDA ÇIKAN SESSİZ KUSUR — "güç yok" ile "model yok" aynı etiketti

`_fwKwEff` iki bambaşka durumu tek `yok` etiketine katıyordu:

| durum | doğru anlamı |
|-------|--------------|
| model henüz **çözülmüyor** | güç **hesaplanamaz** — aksesuar devri kasnak pitch çaplarından gelir, yarım modelde bilinemez |
| model çözülüyor, katalog/eğri yok | gerçekten **0 kW ile koşar** |

Yarım modelde kart bütün aksesuarları *"güç yok"* diye uyarıyordu; oysa eksik
olan güç değil MODELDİ. Ayrı etiket: `cozumsuz` → *"model çözülmüyor"*.

###### ÖLÇÜLDÜ — uçtan uca

| | önce | sonra |
|---|---:|---:|
| taze sihirbaz duty satırı | **0** | **6** (`AG00686-6`) |
| çözücü paneli duty satırı | **0** + *"Henüz devir noktası yok."* | **6** + çevrim seçicisi |
| aksesuar modeli seçilince ALT kW (12 nokta) | elle | **7,62 … 15,13 kW** (katalog) |
| çevrim `AG00902-4`'e çevrilince | — | devir 700·1200·2000·3000, kW **4,99 · 10,74 · 13,68 · 15,40** |

Son satır asıl kazanç: çevrim değişince kW **yeni devir noktalarında yeniden
hesaplanıyor** — hiçbir yerde elle giriş yok.

**GERÇEK TARAYICI:** sihirbaz taze açılışta 6 satır · açılır pencereden gerçek
seçim `700·1200·2000·3000` veriyor · kW hücreleri `kayıtlı ölçüm` / `2.70` /
`3.61` basıyor; panel 6 satır ve seçiciyle açılıyor, *"Henüz devir noktası
yok."* mesajı **yok**; konsol temiz.

Kapı **on üç mutasyonla** ölçüldü, on üçü de kırmızı: sihirbazı yine boş
tabloyla açma, panel tohumunu kaldırma, tohumun dolu tabloyu da ezmesi,
tek-seferlik bayrağını kaldırma, kW taşımayı iki yüzeyden tek tek düşürme,
kütüphaneye uydurma bir "standart" çevrim ekleme, bir kaydın %zamanını
kaynaktan kaydırma, listeyi referansla döndürme, eşlemenin kW'a bakması,
`cozumsuz`u yine `yok` yapma, çevrim seçicisini iki yüzeyden tek tek düşürme.

##### Duty sıcaklığı: satır başına °C → çekirdeğin istediği TEK °C

Çekirdeğin `beltLifeB10`'u sıcaklığı **toplam geçiş sayısını çarpan tek bir sayı**
olarak alıyor (`D = geometri · Σ geçiş · 2^((T−80)/23)`), duty tablosu ise
sıcaklığı **satır başına** soruyor. İndirgeme köprüde (`veFeadDutyDegC`) ve iki
kez yanlıştı:

| Ne yanlıştı | Sonuç | Neden sessiz |
|-------------|-------|--------------|
| `d.dcPct \|\| 100/n` — açıkça **0** girilen yüzde "girilmemiş" sayılıyordu, payda ise 0 sayıyordu | ağırlıklar 1'e toplanmıyordu | hata yok, yalnız sayı kayıyor |
| sıcaklıkların **aritmetik** ortalaması | ömür hep **uzun**, hep aynı yöne | tek sıcaklıklı tabloda fark yok |

**ÖLÇÜLDÜ (BMC örneği):** bütün yüzdeler boşken degC 90 yerine **1000 °C**;
sayfadaki gibi TEK bir satır %0 girilince (3000 rpm satırı) 90 yerine 99 °C ve
B10 **992 → 756 saat (−%24)**; satırlar 70…110 °C'ye dağılınca aritmetik
ortalama 89.4 °C → 1010 saat, doğrusu 96.7 °C → **810 saat** (ömür 1.25× uzun
görünüyordu). Çekirdek aynı yeri doğru yapıyor (`u.dcPct != null ? …`).

Doğrusu **yaklaşıklık değil, cebirsel özdeşlik**: satır başına hasarı toplayıp
geri çözünce

```
degC_eş = 80 + ΔT · log2( Σ wᵢ · 2^((Tᵢ − 80)/ΔT) ),   wᵢ = geçiş payı = dcᵢ·vᵢ/L
```

çıkıyor. Tek sıcaklıklı tabloda `log2(2^x) = x` → tam o sıcaklık, yani
doğrulanmış Gates sonuçları **kaymıyor**. Ağırlık `dc` değil **geçiş sayısı**
(`dc·v`): çekirdek `passes` toplamını da böyle kuruyor, yüksek devirde kayış
birim zamanda daha çok geçiyor. Beş mutasyonla ölçüldü (eşdeğer→aritmetik 3
test, `dc·v`→`dc` 2, sıfırı yine "girilmemiş" sayma 1, uyuşmazlık uyarısını
susturma 1, ΔT 23→30 1) — hepsi kırmızı.

##### Yorulma modeli seçimi mutlak ömre GEÇEMEZ — ve bunu söylüyor

Panel iki yorulma modeli sunuyor (`PK-2_2p-MT3` m=5.6 ↔ `PK-2_2a-MT3` m=4.05)
ve seçim **dağılıma** geçiyor. Mutlak ömre geçemez: `beltLifeB10`'un `C` sabiti
`Σ w·d^(−m)` ölçeğini soğuruyor, üs değişince ömür yüzlerce kat kayar
(**ÖLÇÜLDÜ:** BMC 992 → **1.1 saat**). Doğrulama koşucusu B10'u yalnız 5.6
takımıyla ölçüyor; tek PK-2_2a sistemi olan AG00810 ayrıca çap aralığının da
dışında. Eskiden panel, m=4.05 ile hesaplanmış bir dağılım tablosunun hemen
altına m=5.6 ile hesaplanmış bir ömür basıyordu — **sessizce**. Artık ömür kartı
hangi sabitlere göre olduğunu yazıyor (`VE_FEAD_LIFE_FATIGUE_MODEL`); sayı
gizlenmiyor, çünkü bu modülün kuralı geçerlilik sınırını sonucun **içinde**
taşımak.

#### Tedarikçi sayfası (FEAD_INFORMATION) — panellerin girdi biçimi

Paneller **tedarikçiye gönderilen sayfanın biçimini** soruyor: kasnak merkez
koordinatları, çaplar, gergi konumu, aksesuar devir/güç tabloları, motor duty
cycle, otomatik gergi künyesi. Sayfanın kendisi `js/fead-model.js` içinde
`VE_FEAD_EXAMPLES['BMC_FEAD_2026']` olarak yaşıyor ve tek tıkla iç topolojiye
kuruluyor (`veFeadLoadExample`). Bu aynı zamanda **ikinci, bağımsız doğrulama**:
Gates raporlarıyla ortak hiçbir sayı yok, `tests/unit/fead-example.test.js`
dört bağımsız çıpaya bakıyor — kayış boyu **1715 mm**, kol boyu **90.0 mm**,
Spring Mean Load **22.07 Nm**, tahrik oranı **197.32/179.62 = 1.1** — ve dördü
de tutuyor.

**İKİ SESSİZ KANAL — ikisi de ölçüldü, ikisi de testli:**

| Karışan şey | Sonuç | Neden sessiz |
|-------------|-------|--------------|
| Gergi **montaj merkezi** ↔ **serbest kol açısı** | gerginlik 650 N yerine **251 N** (2.6× düşük) | geometri kusursuz çözülür, hata verilmez |
| ~~**Tasarım gerginliği** ↔ **yay dengesi**~~ | ~~bütün gerilme ve hubloadlar 250 N kayar~~ | **KAPANDI** — alan kaldırıldı, ankraj türetiliyor |

Birincisi: sayfa serbest açıyı VERMİYOR, gergi kasnağının **montaj merkezini**
veriyor. Serbest açı `veFeadFreeAngleFrom` ile türetilir
(`montajAçı − sense × (Mean−Pre)/Rate`); `sense`i çekirdek bulduğu için
`veFeadBuildSystem` **iki geçiş** yapıyor. `|montaj merkezi − pivot|` ile
girilen kol boyu 0.5 mm'den fazla ayrılırsa çözüm DURUR — iki sayı da sayfada
yazar, uyuşmazlık okuma hatasıdır. Panel varsayılanı VERİDEN çözülür
(`veFeadAngleMode`): eski kayıtlar yalnız `freeAngleDeg` taşıdığı için koşulsuz
`mount` varsayılanı onları açılışta çözülemez yapardı.

İkincisi ARTIK YOK: tasarım gerginliği sorulmuyor, türetiliyor — aşağıdaki
"Tasarım gerginliği bir GİRDİ DEĞİL" bölümüne bakınız.

Servis faktörü (sayfada 1.3) kayma emniyetinin istenen alt sınırı olarak sonuç
tablosunda hüküm veriyor — eşik eskiden 1.3'te SABİTTİ, artık kullanıcının
girdiği değer.

##### Tedarikçiden DÖNEN rapor da bir örnek — `AG00976_GATES_2025` (2026-08-25)

Yukarıdaki `BMC_FEAD_2026` tedarikçiye **giden** sayfadır (FEAD_INFORMATION,
26.05.2025). Artık ondan **dönen** rapor da kayıt defterinde: *"AG00976 BMC
Otomotif FEAD 5 · Cummins Eng.Scndr ALT&AC Drive · Gates 8PK1715HD-Fleetrunner ·
Ten@-250/110 · Corrected-IDR1 · 05.06.2025"*, Gates v13.02. Aynı araç, aynı altı
kasnak — ama **aynı sayılar değil**, ve ikisinin birden durmasının sebebi bu.

Bu rapor `tests/fixtures/fead-validation.js` içinde **zaten** vardı
(`AG00976['1715@-250/110']`, 2095 değerlik kapının parçası); eksik olan onu
kanvasa **kurulabilir** yapmaktı. Referans değerler ikinci kez yazılmadı —
`tests/unit/fead-example-ag00976.test.js` fixture'dan okuyor.

###### Uçtan uca ÖLÇÜLDÜ — örnek raporu geri üretiyor

Doğrulama harness'ı `makeSystem()`i doğrudan çağırıyor, yani **köprüyü atlıyor**.
Bu örnek zincirin tamamını koşturuyor (örnek tanımı → düğüm dizisi →
`veFeadBuildSystem` → çekirdek):

| Ne | Kaç değer | En kötü sapma |
|----|----------:|---------------|
| span + sarım | 12 | **0.039** (derece/mm) |
| gergi konum tablosu (kol · X · Y · β · sarım · EDL · REBL) | 6 × 7 | kol **0.063°** |
| konum gerginliği / hubload | 6 × 2 | **%0.13** / **%0.09** |
| duty gerilme + hubload | 12 × 6 × 2 | **%0.09** / **%0.15** |
| sürücü kW | 12 | **birebir** (6.34) |
| take-up · yay momenti | 2 | **%0.03** / %0.09 |
| **tasarım gerginliği (TÜRETİLEN)** | 1 | **birebir** (544 N) |
| **serbest kol açısı (TÜRETİLEN)** | 1 | **0.04°** (16.06 ↔ 16.1) |

Son iki satır bedava değil, **bağımsız doğrulama**: ikisi de örnekte YAZILI
DEĞİL, geometri + yay künyesinden çıkıyor, ve rapor ikisini de ayrıca basıyor.

###### EFEKTİF BOY 1714.6 — raporun başlığı değil, REBL sütunu

Rapor başlığı `Effective Belt Length (ISO 9981) 1715` diyor. Ama kendi
*Tensioner Geometry* tablosunun REBL sütunu dört konumun **dördünde de tam
0.4 mm aşağıda**: 1730.9 / 1720.6 / 1714.6 / 1708.6. Aradaki **adımlar** birebir
tutuyor (tol 6.0 ve `wear·L` = 0.006 × 1715 = 10.29), yani kayan şey adım değil
nominal boyun **kendisi** — "1715" yuvarlanmış katalog adı (8PK**1715**HD).

**ÖLÇÜLDÜ:**

| efektif boy | en kötü kol | en kötü gerginlik | 12 span/sarım |
|---|---|---|---|
| 1715.0 (katalog adı) | 0.62° | **%2.28** | 2'si kayık |
| **1714.6** (REBL sütunu) | **0.08°** | **%0.29** | **12/12 birebir** |

0.4 mm'lik bir okuma farkı kolu 0.56° döndürüyor ve gerginliği %1.5 kaydırıyor.

###### DEVİR SÜTUNU MOTOR DEVRİ DEĞİL

Rapor FAN kasnağını krank kabul ediyor (`Speed Ratio (Ref. Engine) FAN = 1.000`)
ve duty tablosunun "Engine RPM" sütunu **o kasnağın** devri. Sayfanın kendi ilk
satırı bunu doğruluyor: motor 800 × 1.1 = **880**. Bu yüzden örnek
`driveRatio: 1` ile kurulu — raporu geri üretmek için gereken tanım budur.
Gerçek motor devri isteniyorsa `ratioMode:'derive'` + krank/fan çapları
(`BMC_FEAD_2026` öyle).

###### Sayfanın elle yazdığı hız oranı ÇAPLA çelişiyor

Sayfa alternatör oranını **dış çaplarla** yazmış: `162/57 = 2,842`. Raporun ve
modelin değeri **2.768** (pitch: 164.4/59.4). **%2.7 fark**, ve bu sayı aksesuar
devrini belirlediği için doğrudan güç eğrisi okumasına giriyor. Spesifikasyon
§2.3'ün *"Excel'in en ciddi hatası elle yazılmış hız oranlarıydı"* maddesinin
bu veri setindeki karşılığı; oran her zaman **pitch çapından** hesaplanıyor
(`veFeadAutoKw`) ve test bunu ayırt ediyor.

###### SAYFADA OLMAYIP RAPORDA OLAN ÜÇ ŞEY — ve %19.5'lik fark

| Alan | Sayfa | Rapor |
|------|-------|-------|
| gergi **PİVOTU** | **yok** — yalnız kasnağın *"öngörülen merkezi montaj pozisyonu"* | **(−250.00, 110.00)**, dosya adında da yazılı |
| kayış **toleransı** | yok | **±6.00 mm** |
| **aşınma payı** | yok | **%0.60** |

`BMC_FEAD_2026` pivotu **veriden TÜRETMİŞTİ** (`|merkez − pivot| = kol boyu`
olacak şekilde: −259.94, 104.15). Rapor gerçek pivotu yazınca ayrışma
ölçülebilir oldu: iki pivot **11.5 mm** apayrı.

**İZOLASYON — ÖLÇÜLDÜ** (Mean konumu, rapor 543.9 N):

| adım | kol | gerginlik | sapma |
|------|-----|-----------|-------|
| 0 · sayfa olduğu gibi | 28.51° | 650.0 N | **+%19.5** |
| 1 · + gerçek pivot | — | — | **ÇÖZÜLMEZ** ↓ |
| 2 · gerçek pivot + serbest açı 16.1° | 29.77° | 571.5 N | +%5.1 |
| 3 · + tolerans/aşınma | 29.77° | 571.5 N | +%5.1 |
| 4 · + `lengthOffset` 1.6 | 27.50° | 534.8 N | −%1.7 |
| 5 · + efektif boy 1714.6 | 28.06° | 543.5 N | **−%0.1** |

**1. adım bir hata değil, kapının ısırması:** sayfanın montaj merkezi raporun
gerçek pivotundan 90 değil **80.65 mm** uzakta, ve `veFeadArmCheck` çözümü
durdurup farkı adıyla yazıyor (*"fark −9.35 mm; ikisi de sayfada yazar, biri
yanlış okunmuş"*). İki belge körlemesine birleştirilemiyor — tam olarak
istenen davranış.

**3. adım tolerans/aşınmanın Mean'i etkilemediğini gösteriyor** ve bu doğru:
o iki alan çalışma noktasını değil **zarfı** açar. Sıfır bırakılınca
`Replace = Max = Mean = Min` oluyor, yani kolun gezinme aralığı hiç görünmüyor —
hata da alınmıyor. Örneğin o iki alanı taşıması bu yüzden veri değil **özellik**.

###### İki sapma kaldı, ikisinin de sebebi MODELİN KENDİ İLAN ETTİĞİ SINIR

| Büyüklük | MFSim | Gates | Sapma | Neden |
|---|---|---|---|---|
| B10 (ham) | 1403 s | 2670 s | **−%47** | ALT **Ø57 mm**, geçerlilik aralığı 79.6–176 mm. Model bunu `inValidRange:false` + `outOfRange:["…(d=57.0 mm)"]` ile **kendisi söylüyor** ve 0.55× sistematiği belgeli |
| B10 (düzeltilmiş) | 2551 s | 2670 s | **−%4.5** | ampirik düzeltme uygulanmış hâli |
| Burulma 1. mod | 12.95 Hz | 12.52 Hz | **+%3.4** | bu sistem burulma **kalibrasyon takımında DEĞİL** (takım: AG00686 ×2 + AG0868 ailesi) → kalibre edilmemiş bir sisteme karşı bağımsız ölçüm, modelin kendi ±%8 bandının içinde |

Burulmada **krank MİLİ ataleti** yine ısırdı: geçilmezse 12.95 → **16.76 Hz**
(+%29). Testi ikisini de koşturup farkı belgeliyor.

###### kW örnekte KASNAK ANAHTARIYLA durur, çekirdeğe DÜĞÜM KİMLİĞİYLE gider

Duty satırlarının kW sözlüğü çekirdeğe **düğüm kimliğiyle** gidiyor
(`veFeadDutyToCore` → `r.kw[n.id]`), ama örnek tanımına kimlik yazmak örneği
düğüm kurma ayrıntısına bağlardı. Örnek `kwByKey:{ A_C:2.70, … }` yazıyor,
çeviri `veFeadExampleNodes`'ta **tek yerde**. Ayrışırsa hata **SESSİZ**:
eşleşmeyen kimlik "kW girilmemiş" sayılır ve o aksesuar **0 kW** ile koşar —
çözüm yine üretilir, yalnız gerilmeler düşer. Kapı bunu iki uçtan tutuyor
(çeviri oldu mu · olmazsa sonuç gerçekten değişiyor mu).

###### Panel kartı iki örneği AYIRT EDİYOR

Kart *"birinci kademe: `<crankOD>` / `<fanOD>` mm"* satırını ham basıyordu;
Gates örneğinde o iki alan YOK (`ratioMode:'direct'`) → **"undefined / undefined
mm"** çıkıyordu ve bir sayı gibi okunuyordu. Satır artık kipe göre yazılıyor,
ve karta **kayış satırı** eklendi (`8PK1715HD · 1714.6 mm · tolerans ±6 mm ·
aşınma %0.60` ↔ `8PK 1715 · 1715 mm · tolerans YOK · aşınma YOK`) — iki örneğin
farkı listede görünsün diye. Aksesuar gücü iki yoldan gelebildiği için
(kasnağın kendi eğrisi ↔ duty satırındaki kW) kart ikisini ayrı ayrı sayıyor;
yalnız eğriyi saysaydı raporlu örnek "0 aksesuar" der ve boş görünürdü.

**Kapı sekiz mutasyonla ölçüldü, sekizi de kırmızı:** efektif boy 1714.6 → 1715
(6 test), pivot → sayfanınki (19), gergi teması back → grooved (10), tolerans
6 → 0 (2), kimlik çevirisini kaldırma (3), tahrik oranı 1 → 1.0985 (3), ALT
çapı 57 → 59.4 (8), kart düzeltmesini geri alma (1).

##### Rapor incelemesi — bir SESSİZ girdi kaybı ve beş bayat yüzey (2026-08-25)

Kullanıcı, `AG00976_GATES_2025` örneğinden üretilmiş bir raporu inceletti:
*"Raporda yanlış yerler var. Eksik yerler de var."* Haklıydı ve çıkan kusurlar
iki ayrı sınıftandı.

###### KÖK NEDEN: duty kW'ı çözüme HİÇ ULAŞMIYORDU

Raporun §8.10 tablosunda bütün kW'lar **0,00**, §8.11'de bütün açıklık
gerginlikleri **544 N** (yani tasarım gerginliğine düzleşmiş), hubload'lar
`1065/484/1074/579/1066/323`. **Hiçbir hata mesajı yoktu.**

Sebep: duty satırlarının kW sözlüğü **düğüm kimliğiyle** anahtarlanır
(`veFeadDutyToCore` → `r.kw[n.id]`), ama `veFeadLoadExample` her düğümü
**yeni bir kimlikle** kuruyor (`createNode` kendi kimliğini üretir) ve
`data`'yı birebir kopyalıyor. Sözlük `ex-A_C` anahtarlarıyla kalıyor, kanvas
düğümü `canvas-3` oluyor → hiçbir aksesuar eşleşmiyor → hepsi 0 kW.

`idMap` zaten vardı ama **yalnız bağlantılar için** kullanılıyordu. Göç artık
`veFeadRemapDutyKw` ile (fead-model.js, DOM'suz) ve döngü BİTTİKTEN sonra
yapılıyor — çözücü düğümü de aynı döngüde kurulduğu için harita ancak orada
tamamlanıyor. Eşleşmeyen anahtar **silinmiyor**, olduğu gibi taşınıyor:
kullanıcının kanvasta zaten düzenlediği bir satırın anahtarı haritada olmaz.

**ÖLÇÜLDÜ (gerçek yükleyici, düzeltmeden önce ↔ sonra):**

| 880 d/d | önce | sonra | Gates |
|---|---|---|---|
| sürücü kW | 0,00 | **6,34** | 6,34 |
| gerilme | `544·6` | **1381/1380/1023/1022/545/544** | 1381/1380/1023/1022/545/544 |
| hubload | `1065/484/1074/579/1066/323` | **1892/1228/2373/1089/1539/324** | 1891/1228/2372/1088/1539/324 |

**MEVCUT TESTLER BU SINIFI GÖREMİYORDU** ve sebebi öğretici: hepsi
`veFeadExampleNodes`'u DOĞRUDAN kullanıyor, yani kimlikler `ex-*` olarak
kalıyor ve eşleşme **tesadüfen** tutuyor. Kapı bu yüzden gerçek yükleyiciyi
(`createNode` sözleşmesi taklit edilerek) koşturmak zorunda.

###### KAYMA HÜKMÜ KAYMASI İMKÂNSIZ BİR KASNAKTAN GELİYORDU

Rapor *"En düşük kayma emniyeti 1,24 ✗"* deyip **"tasarım onaylanmamalıdır"**
hükmü veriyor ve çaresini *"tasarım gerginliğini yükseltin"* diye yazıyordu.
Ama raporun **kendi §8.7'si** şunu söylüyor: *"yük çekmeyen kasnaklarda
gerginlik oranı 1'dir ve SF hiç değişmez."* Yani önerilen çare, hükmü veren
kasnakta **ölçülebilir bir etki yapmıyor**. Belge kendi kendisiyle çelişiyordu.

**ÖLÇÜLDÜ (AG00976, 880 d/d):**

| | oran | kapasite | SF |
|---|---|---|---|
| Sürücü · Klima · Alternatör (**yük taşıyan**) | 1,348–2,538 | 11,6–22,6 | **4,58–16,73** |
| Avara 1 · Avara 2 · Gergi (**yük taşımayan**) | 1,0010–1,0024 | 1,24–1,48 | **1,232–1,479** |

SF = kapasite / oran. Oran ~1,00 iken SF bir **MARJ değil, KAPASİTEDİR** — o
sarım açısının taşıyabileceği azami oran. Servis faktörü ise TALEBİN üzerine
konan bir marjdır; talep yokken anlamsızdır. İki küme arasında **iki mertebe**
fark var, yani ayrımın eşiği (`VE_FR_SLIP_LOADED_RATIO` = 1,01) kritik değil.

Gates de aynı sistem için hemfikir: *"Belt Slip Sensitivity"* sayfasının
*"Required Increase Tension or Wrap Angle"* sütunu **altı kasnağın hiçbirinde
dolu değil**.

**Tablo GİZLENMİYOR** — altı kasnağın altı sayısı da basılmaya devam ediyor;
değişen yalnız HÜKMÜ verenin hangisi olduğu, ve yük taşımayanlar kapasiteleriyle
ayrıca yazılıyor.

###### Dört bayat yüzey — model değişti, metin kalmıştı

| Yer | Neydi | Neden yanlış |
|-----|-------|--------------|
| §8.1 | `Kayış efektif boyu: 1716,2 mm · gereken 1714,6 mm` | 1716,2 **TAHRİK** boyudur (Gates *Effective Drive Length*), kayış künyesindeki efektif boy değil. §8.8 ikisini zaten ayrı adlandırıyordu, özet ayırmıyordu |
| Antet | `8 kaburga · 1715 mm` | `_frF(effLength, 0)` — tam sayıya yuvarlama katalog adını gerçek boyun yerine koyuyordu; aradaki 0,4 mm kolu 0,56° döndürüyor |
| §8.7 giriş | *"biri kullanıcının girdiği ankraj… ikisinin karşılaştırması verilir"* | Tasarım gerginliği alanı KALDIRILDI (ankraj türetiliyor); okuyucu panelde olmayan bir alanı arıyordu |
| Uygunluk #6 | `Tasarım gerginliği ↔ yay dengesi · sapma ≤ %2 · ✓` | **TOTOLOJİ**: ankraj artık yay dengesinin ta kendisi, sapma yapısal olarak sıfır. Geçen bir kriter gibi görünüp hiçbir şey denetlemiyordu → artık *"türetilebildi mi"* soruyor ve sayıyı yazıyor |

###### İki eksik yüzey

**§8.3'te gergi kasnağının X/Y'si `—` basılıyordu** — oysa konum bilinmiyor
değil, **türetilmiş**: çözülmüş çalışma merkezi. Artık basılıyor (eğik + †
ile türev olduğu işaretli). Dipnot ayrıca **§8.7'ye** yolluyordu; orada X/Y
YOK (kol açısı, sarım, β, take-up, moment, gerginlik, hubload var), konum
tablosu **§8.8**'de.

**§8.13 hiçbir aksesuara güç girilmemişse tek sütunlu ve bomboş** çıkıyordu:
on iki devir satırı, hiçbir sayı, hiçbir açıklama. Okuyucu bunu *"tork
hesaplanamadı"* diye okuyordu; sebep girdinin kendisiydi. Artık boş tablo hiç
basılmıyor, yerine sebep yazılıyor.

**Kapı sekiz mutasyonla ölçüldü, sekizi de kırmızı:** kW göçünü kaldırma (2 test),
göçün eşleşmeyeni silmesi (1), §8.1 eski etiket (1), antet yuvarlaması (1),
§8.7 bayat metin (1), uygunluk #6 totolojisi (1), §8.13 kapısı (1), kayma
hükmünü global en düşüğe çevirme (1).

> Sekizincisi **ilk turda YEŞİL kaldı**: kapı hükmün ETİKETİNE bakıyordu,
> SAYISINA değil. Yalnız başlığı denetleyen bir test, `_frMinSF`'i global en
> düşüğe geri çeviren mutasyonu geçiriyordu. Kapı artık iki kümenin ayrıştığını
> ve hükmü verenin yük taşıyanların en düşüğü olduğunu SAYIYLA tutuyor.


##### GERGİ KÜNYESİ RAPORDAN, PİVOT BİR TASARIM ÇIKTISI (2026-08-25)

> **BU BÖLÜM AŞILDI — anlatılan yapılandırma kodda YOK.** `BMC_FEAD_2026` bir
> sonraki bölümde pivotu GİRMEYİ bıraktı; bugün kasnak merkezi sayfanın kendi
> koordinatı (−170,080 / 99,160) ve pivot ondan TÜRÜYOR. Aşağıdaki tablonun
> son satırı (Gates pivotu + Gates merkezi → 571,1 N) ve *"kalan %5 kayıştan,
> kanıtı serbest kipte 543,7 N"* çıkarımı **o yapılandırmaya aittir**; serbest
> kip bugün 525,6 N veriyor ve o çıkarım artık tutmuyor (bkz. bir sonraki
> bölüm). Burası, aynı yol yeniden denenirse nelerin ölçülmüş olduğunu bilmek
> için duruyor. Pivotun kayış yoluna bağlı OLMAMASI ve tautoloji dersi ise
> bugün de geçerli.

Kullanıcı kararı: *"Tedarikçiye ne gönderdik kısmını geçelim, sen Gates
raporundaki 'Tensioner Data' kısmını baz alarak hesaplamalarını yap."* Ardından
asıl noktayı koydu: *"Tensioner pivot noktası tedarikçiye girdi olarak
gitmeyecek. İlk önce bu hesabın nasıl yapıldığını verelim."*

`BMC_FEAD_2026`'nın gergisi artık raporun **Tensioner Data** bloğundan
(pivot −250,00 / 110,00 · merkez −161,97 / 91,29). Sayfanın *"öngörülen merkezi
montaj pozisyonu"* tahmininden türetilmiş pivot (−259,94 / 104,15) **terk
edildi** — gerçeğinden 11,5 mm sapıyordu.

**ÖLÇÜLDÜ:**

| | serbest açı | Mean kol | T | Gates 544 N'a |
|---|---|---|---|---|
| türetilmiş pivot (eski) | 24,88° | 28,51° | 650,0 N | **+%19,5** |
| Gates pivotu + sayfa merkezi | — | — | — | **ÇÖZÜLMEZ** (kol boyu −9,35 mm) |
| **Gates pivotu + Gates merkezi** | 16,06° | 29,73° | **571,1 N** | **+%5,0** |

Kalan %5 **gergiden değil kayıştan**: bu örnek kayış künyesini hâlâ sayfadan
alıyor (1715 · tolerans 0 · aşınma 0 · lengthOffset 0). Kanıtı: **serbest
kipte** — kol nominal yay açısına oturduğu, yani sayfanın kayışı denklemden
düştüğü zaman — T **543,7 N** çıkıyor, Gates'in Design Tension'ı **544 N**.

İki örnek artık **aynı gergiyi, farklı kayışı** anlatıyor ve testi bunu
kilitliyor.

###### PİVOT BAĞIMSIZ DEĞİL — ama denetlenebilir de değil

Rapora §8.7'ye *"Gergi pivotu nereden geliyor"* bloğu girdi. Dayandığı iki
gözlem:

1. **Kayış yolu pivota HİÇ bağlı değil.** Geometri yalnız gergi *kasnağının
   merkezine* bakar (teğet çözümü merkez farklarından kurulur). Pivotu
   kaydırmak sarımları, açıklıkları, kayış boyunu değiştirmez.
2. **Pivotun tek etkisi kolun hangi yönde hareket ettiğidir** — yani β, yani
   take-up, yani gerginlik. Pivot ile tasarım gerginliği **aynı denklemin iki
   yüzü**: `pivot → β → dL/dθ → T` (analiz) ↔ `T* → dL/dθ → β → pivot` (tasarım).

Tasarım yönü kapalı formda: `sinβ = (M/T*)/(a·2sin(φ/2))`, `θ_kol = θ_hub + s·β`,
`p = c + a·(cos θ_kol, sin θ_kol)`. **ÖLÇÜLDÜ:** AG00976 için Gates'in bastığı
pivotu **0,01 mm**, β'yı **0,006°** ile geri veriyor.

**TAUTOLOJİ TUZAĞINA İLK SÜRÜMDE DÜŞÜLDÜ.** Blok önce *"türetilen pivot ↔
girilen pivot sapması"*nı bir **DENETİM** diye basıyordu. Sapma iki örnekte de
**0,000 mm** çıktı ve çıkmak **ZORUNDAYDI**: tasarım gerginliği zaten pivottan
türüyor, onu denkleme geri beslemek aynı β'yı ve aynı pivotu verir. Geçen bir
denetim gibi görünüp hiçbir şey ölçmüyordu — uygunluk kriteri #6'da düzeltilen
hatanın birebir aynısı, aynı oturumda ikinci kez.

Doğrusu denklemi **duyarlılık** olarak vermek: hedef gerginlik SEÇİLİR (bağımsız
bir mühendislik kararıdır), pivot ondan çıkar. Tablo o eşlemeyi veriyor ve
**gerçekten ayrışıyor** — AG00976'da %15 düşük gerginlik pivotu **21,7 mm**
kaydırıyor. Belge ayrıca *"Bu bir DENETİM değildir"* diye **yazıyor** ve
vurgulu satırın neden modelin kendi pivotunu vermek zorunda olduğunu açıklıyor.

**Pivotun BAĞIMSIZ doğrulanması ancak ölçülmüş bir pivotla** (tedarikçi raporu,
montaj resmi) mümkün — model kendi kendini doğrulayamaz ve rapor bunu söylüyor.


##### PİVOT BİR GİRDİ DEĞİL — parça künyesinden TÜRER (2026-08-25)

> **BU BÖLÜM AŞILDI (2026-08-28) — yön TERSİNE çevrildi.** Kullanıcı kararı:
> *"Kullanıcı ilk olarak KIRMIZI NOKTA olarak OTOMATİK GERGİ MONTAJ
> KOORDİNATLARInı verecek."* Bugün pivot bir GİRDİ, kasnak merkezi bir ÇIKTI
> ve kol açısı bir ZARFTAN seçiliyor (bkz. *"PİVOT GİRDİ, KOL AÇISI ZARFTAN"*).
> Aşağıdaki türetme `angleMode:'mount'` kipinde **aynen duruyor** — kaydedilmiş
> her proje onu kullanıyor ve tabanı birebir korunuyor. Tautoloji dersi ve
> "kayış yolu pivota bağlı değil" ölçümü bugün de geçerli; **ölçülen bedeli**
> ise yeni bölümde: türetilen pivot Gates'in ölçtüğünden 15,45 mm sapıyor ve
> gerginliği **%7,1** kaydırıyor.

Bir önceki bölüm pivotu Gates raporundan almıştı. Kullanıcı asıl noktayı
sonra koydu ve **haklıydı**:

> *"Otomatik gergi bileşeninde kol ve pivot kısmına kullanıcı girdi
> girmeyecek. Kullanıcının girdiği koordinat gergi KASNAĞININ merkezi;
> pivot noktası sonra hesaplanıyor."*

**KOORDİNAT TABLOSU KASNAK MERKEZİ VERİR, GÖVDE DEĞİL** — ve bunun kanıtı
tablonun kendi **ALT satırı**: alternatör gövdesi kocaman (render'da bordo
silindir) ama tabloya giren Ø57'lik **kasnağın** merkezi. Gergi satırı da
(Ø75 flat) aynı şeydir.

Kapanışı gerginin **parça çizimi** veriyor:

> `E9843 PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm SPRING TORQUE
> @ 28° FREEARM-MEAN ROTATION`

yani kolun **çalışma (Mean) konumundaki mutlak açısı**, parçanın konum
pimiyle birlikte **okunan** bir değerdir — türetilmiyor. Kol boyu da künyede.
Pivot kolun öbür ucudur:

```
pivot = c − a·(cos θ_kol , sin θ_kol)
```

**ÖLÇÜLDÜ — bağıntı raporun kendi pivotunu geri veriyor:** AG00976'nın altı
kol konumunun **altısında da**, raporun bastığı kasnak merkezi + raporun
bastığı kol açısı, raporun bastığı pivotu **0,11 mm** içinde veriyor.

###### ÜÇ HİPOTEZ ÇÖZDÜRÜLDÜ — koordinat KASNAK, pivot DEĞİL

> **TERMİNOLOJİ AŞILDI (2026-08-29):** bu bölümdeki *"pivot"*, bugün
> **otomatik gergi montaj konumu** olarak adlandırılıyor ve gerginin TEK
> koordinatıdır. Ölçümler geçerli.


| hipotez | sarım | T | Gates 543,9 N'a |
|---|---|---|---|
| koordinat = kasnak · θ=**344°** (parça çizimi) | 33,0° | **532,1 N** | **−%2,2** |
| koordinat = kasnak · θ=348° (Gates'in kol açısı) | 33,0° | 561,1 N | +%3,2 |
| koordinat = **PİVOT** (zarf kipi) | 59,7° | **279,4 N** | **−%48,6** |

> **ÜÇÜNCÜ SATIRIN GEREKÇESİ DEĞİŞTİ (2026-08-28).** Bu satır bir dönem
> *"ÇÖZÜLMÜYOR — kasnak sürücünün içine düşüyor (merkez mesafesi 111,6 mm)"*
> diyordu ve o eleme kol açısını **344°'de sabit** tutuyordu, yani bir MODEL
> sınırıydı, geometrik bir imkânsızlık değil. Zarf kipinde kol açısı serbest ve
> model **çözülüyor**: 360 açının **280'i** geçerli geometri veriyor. Eleme
> artık sayısal ve daha güçlü — üstelik **360°'in tamamı tarandı** ve boyu ile
> gerginliği BİRLİKTE tutan açı yok: boyu en iyi tutan θ=134° gerginliği %28,
> gerginliği en iyi tutan θ=0° boyu %4,6 ıskalıyor; gevşek pencerede (L ±%0,5
> ve T ±%5) kalan **2 açıda** (141–142°) sarım RMS 6,0–6,3° ile çöküyor.
>
> **En doğrudan kanıt ise ayrı:** mount kipinde ÇÖZÜLEN çalışma merkezi
> (−170,240 / 98,610) sayfanın koordinatına yalnız **0,57 mm** uzakta.
> Koordinat pivot olsaydı kasnak merkezi ondan tam kol boyu (90 mm) uzakta
> olurdu — nitekim hipotez satırında öyle çıkıyor.

Üçüncüsü koordinatın pivot **olmadığını** eliyor. Birincisi ise
şunu gösteriyor: pivot **hiç girilmeden**, yalnız müşterinin koordinatı +
parça künyesiyle tedarikçinin cevabına **%2,2** içinde varılıyor.

**KALAN %2,2'NİN KAYNAĞI ÖLÇÜLDÜ — ve KAYIŞ DEĞİL.** Bir önceki bölüm
(Gates pivotu girilirken) kalan %5'i kayışa bağlıyor ve kanıtını *serbest
kipte* buluyordu: kol nominal yay açısına oturunca, yani sayfanın kayışı
denklemden düşünce, T 543,7 N çıkıyordu. **O kanıt artık geçerli değil** —
türetilmiş pivotla serbest kip **525,6 N** veriyor, yani sabit kipten (532,1)
Gates'e **daha uzak**. Kayış denklemden düştüğünde fark kapanmıyorsa fark
kayıştan gelmiyor demektir.

Geriye kalan tek serbest büyüklük **pivot**, ve iki belge onu farklı yere
koyuyor: türetilen (−256,59 / 123,97) ile Gates'in ölçtüğü (−250,00 / 110,00)
arasında **15,445 mm** var (aynı belgede bir dönem 11,5 yazılıydı — o sayı
TERK EDİLMİŞ −259,94/104,15 pivotuna aitti). Duyarlılığı da ölçülü: aynı kasnak merkezinde kol
açısını 344° → 348° almak T'yi **532,1 → 561,1 N** yapıyor, yani **4° ≈ %5,4**.

İlk iki satırın **sarımı aynı** (33,0°): kasnak merkezi ikisinde de aynı,
değişen yalnız β — yani take-up, yani gerginlik.

**MUTLAK AÇI SALT PARÇAYA AİT DEĞİL, MONTAJA DA BAĞLI.** Aynı E9843 Gates
raporunda **347,99°**'de duruyor. Parçanın kendi değişmezi **bağıl** dönme —
*"28° FREEARM-MEAN"* ↔ yay künyesinden türeyen `(22,07 − 8,60)/0,480 =
28,06°` — ve iki örnek de onu doğruluyor (BMC **28,43°**, AG00976
**28,08°**). Bu yüzden iki örnek farklı mutlak açı taşır ve biri
"düzeltilerek" öbürüne eşitlenmemelidir.

###### RAPORUN BELT DATA BLOĞU BMC'YE KONMAZ — ölçüldü, TERSİ çıktı

Açık duran bir soru vardı: *"AG00976 raporunun Belt Data bloğu (1714,6 · ±6 ·
%0,60 · offset 1,6) `BMC_FEAD_2026`'ya da konsun mu?"* Pivot **raporundan
girilirken** cevap evetti — kalan %5'i kapatıyordu. Türetilmiş pivotla
**ÖLÇÜLDÜ ve cevap hayır**:

| BMC | bağıl kol | M | nominalden | T | Gates 543,9 N'a |
|---|---|---|---|---|---|
| sayfa kayışı (bugün) | 28,43° | 22,245 Nm | **%0,79** | **532,1 N** | **−%2,2** |
| + Gates Belt Data | 26,80° | 21,463 Nm | %2,75 | 503,7 N | **−%7,4** |

Sapma **üç katına** çıkıyor. Sebep basit: gergi koordinatı sayfadan, kayış
künyesi rapordan gelirse model **iki farklı sistemi** anlatır. İki künye tek
kaynaktan gelmeli — `AG00976_GATES_2025` ikisini de rapordan alıyor ve aynı
büyüklük orada **%0,09**.

Kapı bu kararı kilitliyor (`fead-example.test.js`, *"Gates Belt Data BMC'ye
KONMAZ"*): istenmeyen alternatif de koşturuluyor, çünkü karıştırma **sessiz** —
model yine çözülür, uyarı çıkmaz, yalnız sonuç uzaklaşır. İki mutasyonla
ölçüldü (BMC kayışını Gates'inkiyle değiştirme → 4 test kırmızı; kol açısını
344 → 348 → 5 test kırmızı).

###### İKİ DURUM, İKİ ANLAM — ve karıştırmak TOTOLOJİ üretir

| | pivot TÜRETİLDİ (`BMC_FEAD_2026`) | pivot GİRİLDİ (`AG00976_GATES_2025`) |
|---|---|---|
| Kaynak | kasnak merkezi + parça künyesi | tedarikçi raporunda **ölçülü** |
| Kol boyu çapraz kontrolü | **TOTOLOJİK** — pivot zaten kol boyu kadar uzağa konuyor | **GERÇEK DENETİM** — iki bağımsız sayı |
| Rapor ne der | *"Bu bir denetim değildir"* | *"kol boyu tutmak zorundadır"* |

`veFeadArmCheck` bunu `tautological` bayrağıyla taşıyor. Bayrak olmasaydı
yapısal olarak sıfır çıkan bir fark "geçen kriter" diye basılırdı — bu
oturumda **üçüncü kez** aynı tuzak (uygunluk #6, ilk pivot bloğu).

###### SÜRÜKLEME PİVOTU DONDURMAMALI — kapı boşluğuydu

`veFeadDragTensioner` merkezi ve pivotu birlikte taşıyordu. Türetilmiş
pivotta `pivotX/pivotY` yazmak onu sessizce **girilmiş** pivota çevirir:
ilk sürükleme parça künyesini dondurur, kullanıcı kol açısını bir daha
değiştiremez. Artık türetilmiş pivotta yalnız merkez taşınıyor; pivot
kendiliğinden takip ediyor. Mutasyonla ölçüldü — kapı **yoktu**, eklendi.

###### Panel ve rapor

Panelde **"Kol Künyesi"** kartı kol boyu + kol açısını soruyor ve türetilen
pivotu **yazıyor**; pivot alanları *"Ölçülmüş Pivot — opsiyonel"* başlığı
altında ikincil kaldı. Rapor §8.7'nin pivot bloğu artık gerçek kuruluşu
anlatıyor ve iki durumu ayırıyor.

**Kayış yolunun pivota bağlı olmaması** zincirin ayrılabilmesinin sebebi ve
raporda yazılı: geometri yalnız kasnak merkezine bakar; pivot yalnız β'yı,
yani take-up'ı, yani gerginliği belirler. Testi bunu ÖLÇÜYOR — pivot kolun
etrafında döndürülünce sarım `<0,001°` değişiyor ama β `>1°` ve gerginlik
`>%1` değişiyor.

**Kapı altı mutasyonla ölçüldü, altısı da kırmızı:** türetmeyi kaldırma
(103 test), türetmede işareti çevirme (14), örnekte kol açısı 344 → 348 (8),
totoloji bayrağını sabitleme (1), sürüklemede pivotu yine yazma (1), raporun
totoloji uyarısını basmaması (1).

##### TEK KOORDİNAT — "PİVOT" TERMİNOLOJİSİ VE KARŞILIKLI DOĞRULAMA KALKTI (2026-08-29)

Kullanıcı kararı: *"Programda hâlâ garip bir ikilik var… Sanırım programda
hâlâ karşılıklı doğrulama gibi bir kıstas var. ASLA OLMAYACAK. Herhangi bir
doğrulama gibi bir olay söz konusu değil. Önceki 'pivot nokta' değeri girdi
olmayacak asla. O terminoloji kalkacak. Artık sadece 'otomatik gergi montaj
konumu' var. Buradan otomatik gerginin avara kısmının hareketi tanımlanacak
sadece."*

**İKİLİK GERÇEKTİ ve üç yüzeydeydi:**

| Nerede | Ne vardı |
|--------|----------|
| Panel | `angleMode` seçicisi (zarf / montaj merkezi / serbest açı) + ikincil *"Ölçülmüş Pivot"* alanları + *"Doğrulama"* kartı (`verifyCenX/Y`) |
| Sihirbaz | *"Gergiyi nasıl tanımlayacaksınız?"* adımı — aynı üç kip |
| Köprü | `veFeadArmCheck` (üç bantlı `\|merkez − pivot\|` ↔ kol boyu hükmü) + zarf kipinde iki koordinat varsa uyarı basan blok |

**HEPSİ KALKTI.** Bugün gergi için girilen tek şey **Otomatik Gergi Montaj
Konumu**; avara kasnağının merkezi ondan ve kol açısından TÜRER
(`c = p + a·(cos θ, sin θ)`), ve program hiçbir şeyi hiçbir şeyle
karşılaştırmıyor.

| Kalkan | Yerine |
|--------|--------|
| `veFeadAngleMode` · `veFeadArmCheck` · `veFeadTensionerMount` · `veFeadFreeAngleFrom` · `veFeadPivotFromArm` | `veFeadSpringSetup` (salt yay künyesi) + `veFeadMigrateTensioner` (tek seferlik göç) |
| `veFeadVerifyCard` · `veFeadSetVerifyCen` · `veFeadMountReadout` | — |
| `cenX/cenY` · `angleMode` · `freeAngleDeg` · `verifyCenX/Y` | `pivotX/pivotY` (montaj konumu) |

**`veFeadTensionerMount` İKİ İŞ YAPIYORDU** ve ayrılması şarttı: yay
kurulmasını (`rel_mean = (M_mean − M₀)/k`, geometriye HİÇ bakmaz) hesaplamak
VE iki koordinat arasındaki geometriyi çözmek. Birincisi zarf ölçütünün
girdisi olduğu için kalmak zorundaydı; ikincisi kalktı.

###### GÖÇ TEK NOKTADAN, VE KOLU SABİTLİYOR

`veFeadMigrateTensioner` eski kaydı bir KEZ çeviriyor: montaj konumu yazılıysa
o kazanır, yoksa kasnak merkezi + kol boyu + kol açısından çıkarılır. Sonra
eski alanlar **silinir**.

**KOL SABİTLENİYOR** (`armPinned`) ve bu göçün asıl işi: eski kayıt kolun
nerede durduğunu BİLİYORDU (montaj merkezi onu söylüyordu). Sabitlenmezse zarf
kendi açısını seçer ve kullanıcının kaydettiği model sessizce başka bir yere
oturur.

**GÖÇ KÖPRÜDE KOŞUYOR**, yalnız panelde değil: kart · rapor · sürükleme hepsi
`veFeadBuildSystem`'den geçiyor. Panele bağlansaydı, paneli hiç açmadan
çözülen bir modelde eski alanlar canlı kalırdı.

**İKİNCİ KOORDİNAT TÜRETİLEMESE BİLE SİLİNİR.** Bu, *"kasnak merkezi montaj
konumu yerine geçemez"* kapısının dayandığı özellik: bırakılsaydı köprüde ona
düşen bir yedek yol doğabilirdi ve o yolun bedeli ÖLÇÜLÜ — gerginlik
**−%48,6**, sarım en kötü **+27,9°**.

###### ÖLÇÜLEN BEDEL — iki örneğin tabanı kaydı

Eski `mount` kipi kayış boyunu GİRDİ alıp kolu ona oturtuyordu; bugün kayış
boyu bir ÇIKTI ve kol nominal yay açısında duruyor.

| | eski (mount) | yeni (tek koordinat) | fark |
|---|---:|---:|---|
| AG00976 · kol | −11,9992° | −11,9992° (sabitlendi) | — |
| AG00976 · L | 1714,6000 (girdi) | **1714,6088** (çıktı) | +0,009 mm |
| AG00976 · T | 544,0497 | **543,8534** | **−%0,036** |
| BMC · rel | 28,4271° | **28,0625°** (nominal) | −0,36° |
| BMC · L | 1715,0000 (girdi) | **1715,2692** (çıktı) | +0,27 mm |
| BMC · T | 532,142 | **525,511** | **−%1,24** |

AG00976 neredeyse hiç kaymıyor çünkü kayışının gerçek efektif boyunu (1714,6)
taşıyor. BMC'nin **%1,24**'ü ise kayıştan: *"1715"* YUVARLANMIŞ bir katalog
adı ve girdi olarak kolu nominalin 0,36° ötesine itiyordu. Bu fark zaten
belgeliydi (*"İki kip yakınsıyor ama ÖZDEŞ DEĞİL"*); tek kip kalınca
nominal olan kazandı.

###### İKİ TEHLİKE SINIFI YAPISAL OLARAK YOK OLDU

| Eski sınıf | Neden artık yok |
|---|---|
| *"Gates Belt Data BMC'ye KONMAZ"* — iki belgenin kayış verisini karıştırmak gerginliği %2,2'den %7,4'e taşıyordu | Kayış künyesi çözüme HİÇ girmiyor; karıştırmak sonucu **birebir** değiştirmiyor (testli) |
| *"Erişilemeyen kayış boyu"* — kolun ulaşamadığı hedef, kenetlenme, önerilen boy | Boy bir girdi değil; ne yazılırsa yazılsın çalışma noktası aynı (testli, 4 farklı boy) |

**KAYIŞ VERİSİ VARSAYILANI `none`.** Katalog sabitlerine bağlı çıktılar (B10 ·
kaburga yorulması · açıklık frekansları) artık varsayılan olarak KAPALI, çünkü
kayış boyu bir sonuç ve kayış henüz seçilmemiş. Kullanıcı seçtikten sonra
panelden açıyor; testler de açıkça açıyor.

###### AYNI TURDA ÇIKAN DAVRANIŞ İYİLEŞMELERİ

| Ne | Eskiden | Bugün |
|----|---------|-------|
| Yay künyesi eksik | Kol gezinme aralığının ORTASINA düşüyor, panel yine *"tedarikçiye verilecek boy budur"* diyordu | Model çözülmüyor ve *"Spring Mean Load girilmedi"* diyor — nominal açı salt künyeden geldiği için seçilecek nokta YOK |
| Ölü yay | `build.ok` TRUE kalıyor, gerilme istenince çekirdek patlıyordu | Adı konmuş durdurma |

Kapı **on bir mutasyonla** ölçüldü, on biri de kırmızı: kip seçicisini panele
geri koyma, ikinci koordinat alanını geri koyma, göçün merkezi silmemesi, göçün
kolu sabitlememesi, göçün köprüde hiç koşmaması, montaj konumundan pivot
türetme, kayış boyu kilidini kaldırma, raporda *"gerçek denetim"* dalını geri
getirme, sihirbaza kip sorusunu geri koyma, pim planını kurmama, ikinci
koordinatı türetilemediğinde bırakma.

> Bir mutasyon (*"montaj konumundan pivot türetme"*) **semantik olarak
> eşdeğer**: göç `cenX/cenY`yi her durumda sildiği için köprüde o alanlara
> düşecek bir yol kalmıyor. Onun dayandığı özellik ayrı bir kapıyla tutuluyor.

##### PİVOT GİRDİ, KOL AÇISI ZARFTAN SEÇİLİR — yön tersine çevrildi (2026-08-28)

> **BU BÖLÜM AŞILDI (2026-08-29).** Anlatılan üç kipli yapı ve `veFeadArmCheck`
> çapraz kontrolü kodda YOK — bkz. bir üstteki *"TEK KOORDİNAT"* bölümü. Zarf
> ölçütü, kalibrasyonu ve *"paketleme modelde yok"* sınırı bugün de geçerli;
> değişen şey, zarfın artık TEK kip olması ve karşılaştırılacak ikinci bir
> koordinatın kalmaması.

Kullanıcı isteği: *"Kullanıcı ilk olarak KIRMIZI NOKTA olarak OTOMATİK GERGİ
MONTAJ KOORDİNATLARInı verecek. Daha sonra program OTOMATİK GERGİ ÖZELLİKLERİ
baz alınarak bir PİVOT NOKTASI ZARFI oluşturacak … bu sonsuz noktalar içinden
en uygun noktayı seçecek. Bunu Gates'in nasıl yaptığını daha bilmiyoruz.
Amacımız bunu bulmak zaten."* Ve: *"kayış boyu KESİNLİKLE BİR SONUÇ OLACAK."*

**İkisi TEK değişiklik.** Gergi kasnağının merkezi girdi olmaktan çıkınca kol
açısını pinleyen şey de kalkıyor; geriye kalan tek serbestlik derecesi zarftan
seçiliyor ve kayış boyu **yapısal olarak** o seçimin sonucu oluyor.

| | eski (`mount`) | yeni (`envelope`) |
|---|---|---|
| Kullanıcı verir | gergi **KASNAĞININ** merkezi (YEŞİL) | gergi **GÖVDESİNİN** montaj noktası = pivot (KIRMIZI) |
| Program türetir | pivot | kasnak merkezi **ve kayış boyu** |
| Kayış boyu | GİRDİ (`fixed`) ya da seçilebilir | **her zaman ÇIKTI** — kip kilitli |

###### YÖN DEĞİŞİKLİĞİ BİR KOLAYLIK DEĞİL, ÖLÇÜLMÜŞ BİR HATANIN DÜZELTMESİ

Montajda SABİT olan pivottur; kasnak merkezi kolun o anki açısıyla değişen bir
konumdur. Eskiden **değişken olanı sorup sabit olanı türetiyorduk**.

**ÖLÇÜLDÜ** (AG00976 · Gates 8PK1715HD raporu, aynı araç):

| | pivot | Gates'e sapma | gerginlik |
|---|---|---|---|
| Gates'in ölçtüğü | (−250,00 · 110,00) | — | 544,3 N |
| BMC örneğinin merkezden **türettiği** | (−256,59 · 123,97) | **15,45 mm** | **505,8 N (−%7,1)** |

Ve bunu **hiçbir şey yakalamıyordu**: `veFeadArmCheck` pivot türetilmişken
TOTOLOJİK (fark yapısal olarak sıfır) — kodun kendi notu bunu yazıyor.

###### SEÇİM ÖLÇÜTÜ TAHMİN EDİLMEDİ, 14 GATES SİSTEMİNDEN GERİYE ÇÖZÜLDÜ

Altı aday ölçüt, her sistemde zarf 0,25° adımla taranarak Gates'in gerçek
çalışma açısıyla karşılaştırıldı (**aci farkinin medyani**):

| ölçüt | medyan | ±5° içinde |
|---|---:|---:|
| **min take-up EN BÜYÜK** | **4,5°** | **9 / 14** |
| ortalama konumdaki T en küçük | 10,3° | 2 / 14 |
| T tepe değeri en küçük | 20,3° | 0 / 14 |
| T_max / T_min en küçük | 23,5° | 1 / 14 |
| hubload tepesi en küçük | 30,8° | 0 / 14 |
| en küçük sarım en büyük | 53,1° | 0 / 14 |

```
ÖLÇÜT:  max over θ  of  min over rel ∈ [0, 1,5·rel_nom]  of  dL/dθ(θ, rel)
```

**FİZİKSEL ANLAMI:** `T = M/(dL/dθ)` olduğu için take-up'ın en KÜÇÜK olduğu yer
gerginliğin en BÜYÜK olduğu yerdir. Ölçüt, kayışın servis zarfı boyunca (yeni/
uzun kayıştan yıpranmış/kısa kayışa) görülen **tepe gerginliği en küçük** yapan
montaj saatini seçiyor — klasik gergi yerleşim kuralı.

**β = 90° DEĞİL** (klasik ders kitabı kuralı) ve bu ölçüldü: Gates'in çalışma
noktalarında β **42,7…59,5°**. sin β büyürken sarım çöküyor, çarpım orta bir
açıda tepe yapıyor.

**TEPE DÜZ DEĞİL — isabet gerçek.** %1 platosu ortalama **4,9°** (çoğu sistemde
1,0–2,8°), yani "±5° içinde" ucuz bir isabet olmuyor. Gates'in noktasındaki
ölçüt cezası medyan **%4,0**, iki sistemde tam **%0,0**.

**1,5 ÇARPANI UYDURULMADI:** 1,0…2,0 tarandı, **1,2–1,6 bir PLATO** (medyan
3,5–4,5°, 8–9/14 sistem ±5°); 1,0'da 6,5°, 2,0'de 11,5°'e bozuluyor. 1,5
platonun ortasında ve fiziksel karşılığı var: çalışma açısı + %50 pay.

###### BAĞIMSIZ DOĞRULAMA — KAYIŞ BOYU KAYIŞA HİÇ BAKMADAN GERİ ÜRETİLİYOR

Ölçüt kayış verisine girmiyor (gezinme aralığı yay künyesinden:
`rel_nom = (M_mean − M₀)/k`). Ölçüldü: kayıştan türeyen aralık (Replace…MinBelt)
ile künyeden türeyen `[0, 1,5·nom]` **aynı** sonucu veriyor (medyan 4,5° ↔ 4,5°).
Bu, kayış boyunun çıktı olabilmesinin ön koşulu — yoksa döngü kurulurdu.

Sonuç: program kayışı **hiç görmeden** Gates'in kayışını geri veriyor.

| | sapma |
|---|---|
| 11 / 14 sistem | **±%0,35 içinde** |
| medyan | **%0,21** |
| en kötü (AG0868-4PK) | %1,98 |

**UÇTAN UCA** (gerçek örnek düğümleri → köprü → çekirdek, AG00976): seçilen kol
açısı −10,90°, **kayış boyu 1715,39 mm** (Gates REBL 1714,6 → **+%0,05**),
gerginlik 540,1 N (Gates 544 → −%0,7), sarımlar `156,6 · 52,8 · 198,4 · 64,3 ·
157,6 · 35,4` (Gates `156,2 · 52,8 · 198,4 · 64,3 · 157,1 · 34,6`, en kötü 0,8°).

###### SINIR: PAKETLEME MODELDE YOK — ve sonuç bunu SÖYLÜYOR

Zarfın hangi yayının motor bloğunda kullanılabilir olduğunu model bilmiyor.
14 sistemin 13'ünde en iyi nokta Gates'inkine komşu; **AG00879'da 153° uzakta**
ve orası motorun öteki yanı. Bu yüzden sonuç bir **ÖNERİ**: kullanıcı açıyı
sabitleyebiliyor (`armPinned`) ve zarf o zaman bir seçici değil bir **TEŞHİS**
yüzeyi oluyor. Sınır panelde ve raporda **yazılı** — modülün kendi kuralı
(B10 çap penceresi, tepe yükün *"KALİBRE DEĞİL"* damgası ile aynı gerekçe).

###### KİP ÜÇLÜ, VARSAYILAN GERİYE DÖNÜK

`veFeadAngleMode`: açık seçim kazanır; yoksa `cenX/cenY` → `mount`,
`freeAngleDeg` → `direct`, `pivotX/pivotY` → **`envelope`**, hiçbiri yoksa
**`envelope`** (yeni akış). **Geriye dönük etkisi YOK ve ölçüldü:** kaydedilmiş
her projede bu üç alandan en az biri yazılı, dolayısıyla değişen tek şey
paletten YENİ konan bir gerginin hangi soruyla açıldığı. Taban birebir
korunuyor — AG00976 `kol 28,0750° · L 1714,60 · T 544,05`, BMC
`kol 28,4271° · L 1715,00 · T 532,14`.

**ZARF KİPİNDE PİVOT TÜRETİLMEZ.** Montaj merkezi + kol açısı girilse bile
köprü onları kullanmıyor ve sebebini adıyla yazıyor. Türetmeye izin verilseydi
kullanıcı montaj merkezini girip pivotu "girdi" sanabilirdi — düzeltilen sessiz
hata sınıfının ta kendisi, üstelik ölçülmüş bedeliyle.

**KAYIŞ KİPİ KİLİTLİ ve kilit ÜÇ YÜZEYDE birden.** Zarf kipinde kayış boyu
yapısal olarak bir çıktı; panel seçici yerine *"SERBEST (kilitli)"* yazıyor,
kanvas rozeti tıklamayı reddediyor, `veFeadToggleBeltMode` de. Tek yerde
tutulsaydı panel bir kipi, rozet başkasını gösterirdi — bu modülün tekrar eden
kuralı (*"panel ile kart AYNI alanı okur"*).

###### KADEMELİ TAZELEME — ÖLÇÜLDÜ

| yol | ne yapar | süre |
|---|---|---:|
| genel zarf taraması (360°, kaba 2° + ince 0,1°) | ilk çözüm | **84 ms** |
| tohumlu **yerel** arama (±6°, 0,5°) | bırakma / yeniden çözüm | **6 ms** |
| saklanan açı (`selectArm:false`) | **her sürükleme karesi** | **0 ms** |

Kart bütçesi 2,2 ms, yani genel tarama 38 kat aşardı. Sürükleme yolunda kol
açısı **donuyor** — ve bu yalnız bir hız kararı değil, fiziksel olarak doğrusu:
kullanıcı alternatörü sürüklerken gerginin montajdaki saati değişmiyor, değişen
kayış boyu ve gerginlik. Bırakınca `veFeadReselectArm` yeniden iyileştiriyor.

Seçilen açı düğüme **memo** olarak yazılıyor (`armMeanDeg` + `armAuto`) ama
**`saveState` çağrılmıyor**: bu bir kullanıcı kararı değil, hesabın ara sonucu —
geri-al yığınına binmesi kartın her tazelenmesinde bir adım eklemek olurdu (yön
gülü konumundaki kuralın aynısı).

**Kapı 17 mutasyonla ölçüldü, 16'sı kırmızı:** ölçütü ortalamaya çevirme (4
test), çarpanı 2,6 yapma (5), kayış kipi kilidini kaldırma (3), pivotu yine
türetme (1), memoyu yazmama (2), sabitlenmiş açıyı yok sayma (1), zarfın üçte
birini tarama (19), ince taramayı kapatma (3), yeni gerginin varsayılanını mount
yapma (1), panel kilidini kaldırma (1), rozeti kilitte SABİT yazdırma (1),
`selectArm:false`'u yutma (2), kart yolunu her karede taratma (1), boşuna
tazeleme (1), raporda boyu yine GİRDİ tarafına koyma (1), rapordan kol açısını
düşürme (1), panelden zarf okumasını düşürme (1). On yedincisi (bırakma
yolundaki `armPinned` kontrolü) **semantik olarak eşdeğer** — köprü katmanı
sabitlenmiş açıyı zaten aynen döndürüyor, dolayısıyla gözlenebilir bir fark yok.

> İki mutasyon **ilk turda YEŞİL kaldı** ve ikisi de aynı dersi tekrarladı:
> kapı ÜRETİLEN YÜZEYE bakmalı, üreticiye değil. Rozet tıkı `veFeadToggleBeltMode`
> üzerinden sınanıyordu (rozetin kendi `onclick` kapısını görmüyordu) ve zarf
> okuması `veFeadEnvelopeReadout` doğrudan çağrılıyordu (panelden düşürülmesini
> görmüyordu). Şekil 1'deki *"yay SAYISINA bakan test"* dersinin aynısı.

##### MONTAJ KOORDİNATI ↔ KASNAK MERKEZİ — arşivden ölçüldü (2026-08-28)

> **KISMEN AŞILDI (2026-08-29).** Ölçümler (iki nokta tam kol boyu kadar
> ayrı, merkez gezer pivot gezmez, raporun kendi tanımı) bugün de geçerli ve
> tek koordinat kararının dayanağı. Ama artık MFSim iki koordinatı bir arada
> KABUL ETMİYOR: `veFeadArmCheck`'in üç bantlı hükmü kalktı, çünkü
> karşılaştırılacak ikinci bir sayı yok. Bkz. *"TEK KOORDİNAT"*.


Kullanıcı bildirimi: *"Otomatik gergilerde kasnak merkezi montaj civatasının
koordinatı olacak. Yani kasnak merkezi ile montaj koordinatı aynı otomatik
gergide."* Ve daha önce yazılmış bir cümle düzeltildi: *"BMC örneği zarf kipine
geçemiyor… tedarikçiye giden sayfa kasnak merkezini veriyor, montaj cıvatasının
koordinatını vermiyor."*

İki ayrı iddia var ve **ölçüm ikisini de ayırdı**. `docs/gates-reports/pdf/`
arşivindeki 10 gerçek Gates raporu + fixture'ın 14 sistemi / 81 konumu okundu.

###### İKİ NOKTA AYNI DEĞİL — dört bağımsız kanıt

| kanıt | ölçüm |
|---|---|
| Mesafe **tam kol boyu** | 14/14 sistem, 81 konum: `\|merkez − pivot\| ↔ arm` en büyük sapma **0,0645 mm**, RMS 0,0248 — basım yuvarlama bütçesi (√2·0,05 = 0,0707) **içinde** |
| Merkez **geziyor**, pivot **gezmiyor** | FreeArm→Load arası merkez yolu **37,4…98,7 mm**; pivot altı konumda da tek sayı çifti. Bir montaj cıvatası kolun konumuyla gezemez |
| Raporun **kendi tanımı** (s.4) | *"arm direction is from **pulley center to pivot**"*, `pt = Tensioner pivot point` — kol ikisinin arasındaki doğrudur |
| `Layout Data` tablosunun gergi satırı | Mean **konumuna** 0,014–0,058 mm, pivota **90 mm** — o satır pivot değil çalışma merkezi |

Raporlarda `mounting` / `bolt` / `boss` / `attachment` diye **ayrı bir gergi
koordinatı YOK** (3/3 tarama). Gerginin tek sabit noktası
`Pivot Point {X, Y Coordinates} mm` satırıdır ve **yalnız DÖNEN raporda** basılır.

###### İDDİANIN HAKLI YARISI — ve bir belge farkı

Kullanıcının kastettiği "montaj koordinatı" gerçekten bir GİRDİ olarak vardır;
adı **Pivot Point**'tir. Ama tedarikçiye **giden** FEAD bilgi sayfası o satırı
**hiç taşımaz** — oradaki gergi satırı diğer kasnaklarla aynı şeydir. Yani iki
belge farklı şeyleri adlandırmıyor: **biri bir alanı hiç taşımıyor.**

**BMC sayfasının (−170,080 / 99,160) koordinatı KASNAK MERKEZİDİR** ve bu ayrıca
ölçüldü:

| ölçüm | sayı |
|---|---|
| mount kipinde ÇÖZÜLEN çalışma merkezi ↔ sayfa koordinatı | **0,57 mm** |
| koordinat pivot sayılsaydı merkez oradan | **90,00 mm** (tanım gereği) |
| pivot sayılınca T (zarfın seçtiği θ=114,6°) | **279,4 N** ↔ Gates 544 = **−%48,6** |
| aynı hipotezde kayış boyu | +%1,36 · sarım RMS **15,4°**, en kötü **+27,9°** |

###### AMA MFSim'DE KOORDİNAT ARTIK MONTAJ CIVATASIDIR — ve bu bir kapı boşluğuydu

Kullanıcının kararı MFSim'in kendi yüzeyine dair ve uygulandı: **gergi
bileşeninin koordinatı, diğer bütün kasnaklardan farklı olarak, kasnağın
merkezi değil gövdenin motora bağlandığı noktadır.** Zarf kipinde zaten tek
girdi odur.

Bu kapatılana kadar zarf kipinde **kanvas↔mm zincirinin İKİ UCU DA gergiyi
atlıyordu** ve ikisi de sessizdi: `veFeadSyncCanvasFromMm` 6 kasnaklı AG00976'da
4 düğüme dokunup gergiyi bırakıyor (kutu kayış düzleminden **kopuk**),
`veFeadDragTensioner` ise `mount.ok=false`'ta erken çıkıp gergi kutusunun
sürüklenmesini **hiç modele yansıtmıyordu**. İkisi de artık pivotu okuyor/yazıyor;
**mount kipi birebir eski.**

###### KAPI BEDAVA: iki koordinat birlikte varsa mesafe hüküm veriyor

`|c − p|` üç banda ayrılıyor: **≈0** → *"aynı nokta girilmiş"*, **≈kol boyu** →
tutarlı, **başka** → *"biri yanlış okunmuş"* (BMC koordinatı ↔ Gates pivotu:
**80,652 mm**, kol 90). Panel de pivot alanının etiketinde ölçülen bedeli
(**−%48,6**) yazıyor.

Kapı sekiz mutasyonla ölçüldü, sekizi de kırmızı.

###### RAPOR VE TEORİ BELGESİ DE ÇEVRİLDİ

Detaylı raporun `_frPivotBlock`'u bugünkü akışın **TERSİNİ** yazıyordu
(*"Pivot… bulunmaz ve kullanıcıdan istenmez"*) ve bu belge tedarikçiye gidiyor.
Blok kipe göre ikiye ayrıldı; mount dalı birebir eski. Zarf dalı pivotun bir
GİRDİ olduğunu, iki noktanın ayrımını **ölçüsüyle** ve denklemi ters yönde
(`c = p + a(cosθ, sinθ)`) yazıyor.

**§8.7 içine `<h4>` "Kol açısı zarftan nasıl seçiliyor" girdi** — yeni bir
§8.x AÇILMADI ve sebebi ölçüldü: belgede **elle yazılmış 32 tane §8.x çapraz
atfı** var; 8.8–8.19 kaydırılsa on ikisi **sessizce** yanlış bölüme yollardı.

Teori belgesinde §4.3 iki yönü de anlatıyor ((4.4) kök bulma ↔ (4.5) boy bir
çıktı), yeni **§4.5 Montaj zarfı** bölümü ölçütü (4.6)/(4.7) ile veriyor, ve
bir **AD ÇAKIŞMASI** kapandı: §4.4'ün *servis zarfı* (pivot sabit, kol kayış
boyuyla gezer) ile §4.5'in *montaj zarfı* (kol saati serbest) artık ayrı
adlandırılıyor.

Rapor tarafında üç sessiz kusur daha kapandı: zarf kipinde *"gerçek bir
denetimdir"* dalı basılıyor ve `armFromCoords` NaN olduğu için **"(— mm)"**
yazıyordu (aynı sınıfın **dördüncü** tekrarı); §8.2 türetilen efektif boya
*"girdi"* derken §8.7 envanteri aynı sayıya *"türev"* diyordu; uygunluk kriteri
*"montaj merkezi girilmedi"* basıyordu — girilmedi değil, **sorulmuyor**.

Kapı dokuz mutasyonla ölçüldü, dokuzu da kırmızı.

###### ~~ÖLÇÜLMEDİ~~ → ÖLÇÜLDÜ (2026-08-29, parça çizimi)

> Bu madde şunu diyordu: *"Gergi gövde cıvatasının ekseni ile kol dönme
> ekseninin eşeksenli olup olmadığı — parça çizimi depoda yok."* Kullanıcı
> çizimi gönderdi (*"Genelde hemen hemen tüm otomatik gergilerin görünümü
> böyle. Yani teknik resimleri bu."*) ve varsayım **ölçüldü**: gövdenin
> merkezî bağlantı deliği kolun dönme ekseniyle **eşmerkezli**. Yani
> "girilen montaj koordinatı = pivot" bir varsayım değil artık, okunmuş bir
> ölçü. Eksantrik gövdeli bir gergide ikisi ayrılırdı; bugün elde öyle bir
> parça YOK ve model onları bir saymaya devam ediyor.

##### KOL AÇISININ İMALAT KARŞILIĞI — KONUM PİMİ (2026-08-29)

Aynı çizim ikinci bir şey getirdi ve o **yeni bir sonuç**: zarf bir açı
SEÇİYOR (θ*), ama atölyeye gidecek talimat *"gövdeyi 236,1°'ye kur"* değildir.
Gövdeyi **merkezî cıvata TUTAR — saatini BELİRLEMEZ**; saati gövdeden bloğa
giren bir **konum pimi** sabitler. Seçimin imalat karşılığı pim deliğinin
yeridir.

```
pim açısı = θ* + Δ_parça          (E9843: Δ = −113,00°, r = 31,00 mm)
```

**ÖLÇÜLDÜ — çizimin kendi aritmetiği tastamam kapanıyor:**

| ne | hesap | çizimin yazdığı | fark |
|----|-------|-----------------|------|
| pim yarıçapı | `√(19,51² + 24,09²)` = 30,9995 | — | — |
| pim açısı (gövdeye göre) | `atan(24,09/19,51)` = 50,9967° | **51°** | 0,003° |
| kol çalışma açısı | 360 − 16 | **344°** (MEAN ANGLE) | birebir |
| pim mutlak (3. bölge) | 180 + 51 | — | — |
| **Δ_parça** | 231 − 344 | — | **−113,00°** |

**OFSET NEDEN PARÇA SABİTİ:** pim deliği GÖVDEDE, kolun gövdeye göre çalışma
konumu ise yayla sabitlenmiş. Gövdeyi döndürmek ikisini **birlikte** döndürür
→ aradaki açı gövdenin saatinden bağımsız.

**ÇİZİM KÜNYENİN KENDİSİNİ DE DOĞRULUYOR — bağımsız kaynak.** Çizim
*"28° FREEARM-MEAN ROTATION"* yazıyor; **aynı sayı** tedarikçi raporunun yay
künyesinden `(22,07 − 8,60)/0,480 = 28,0625°` çıkıyor — **0,06°**. İki
bağımsız belge (parça çizimi ↔ Gates raporu), tek sayı.

**SAYI PARÇAYA AİT, MEKANİZMA GENEL.** Kullanıcının *"hepsi böyle görünür"*
sözü MEKANİZMA için geçerli (tek merkezî cıvata + saati belirleyen konum
pimi); yarıçap ve ofset PARÇAYA aittir. Kütüphanenin kendi kuralı burada da
geçerli: çizimi olmayan parçaya sayı **UYDURULMAZ** — `veFeadPinPlan`
`ok:false` döner ve sebebi adıyla yazar (`T38624 için parça çizimi yok`).
Kodu hiç olmayan dört AG00976 kaydında sebep başka: *"parça kodu yok"*.

| Yüzey | Ne | Nerede |
|-------|-----|--------|
| Köprü | `veFeadPinPlan(td, armAbsDeg)` — tek üretici | `fead-model.js` |
| Kütüphane | `VE_FEAD_TEN_PIN` · `veFeadTenPin` · `veFeadTenPinAngle` | `fead-tensioners.js` |
| Panel | zarf **ve** montaj okumasında iki satır + gerekçe notu | `veFeadPinRows` / `veFeadPinNote` |
| Rapor | §8.7 içinde `<h4>` + (4.8) + Tablo C satırları | `_frPinBlock` |
| Teori | §4.5'in son paragrafı + (4.8) + §10'da iki sembol | `fead-theory-source.html` |

**PİM İKİ KİPTE DE KURULUYOR** ve bu bir genişletme değil bir zorunluluk:
montaj kipinde de kol çalışma açısı bir ÇIKTIDIR (`montajDeg` = pivot →
girilen merkez). Yalnız zarf kipinde kurulsaydı montaj kipinde hesaplanan
sayı hiçbir yerden okunmayan **ölü veri** olurdu — bu deponun tekrar eden
hata sınıfı.

**PARÇA KODU KAYDA KOPYALANIR VE KODSUZ KÜNYEDE SİLİNİR** (`td.tenPart`).
Silinmeseydi bir künyeden diğerine geçince yeni gerginin pimi ESKİ parçanın
çizimiyle hesaplanırdı — sayı çıkar, uyarı çıkmaz. Kopya olması ise
kütüphanenin kendi kuralı (`structural-materials.js` kalıbı): katalog sürümü
değişse de kaydedilmiş proje kendiliğinden değişmez.

###### AYNI TURDA ÇIKAN SESSİZ KUSUR — LaTeX kaçışı JS'te YUTULUYOR

Pim denklemi yazılırken çıktı ve **önceden de vardı**: rapor üreteci
denklemleri JS dizgisi olarak kuruyor, orada `'\;'` **tek** ters bölü ile
yazılırsa JS onu yiyip düz `;` bırakıyor. Belge yine üretiliyor, hata
çıkmıyor — yalnız denklem **yalan söylüyor**:

| JS kaynağında yazan | KaTeX'in gördüğü | ekranda |
|---|---|---|
| `\;` (çift) | `\;` | ince boşluk ✓ |
| `\;` (tek) | `;` | **noktalı virgül** ✗ |
| `\\theta` (çift) | `\theta` | θ ✓ |
| `\theta` (tek) | SEKME + `heta` | **çöp** ✗ |

**ÖLÇÜLDÜ: 21 yerde** (§8.7'nin pivot ve zarf denklemleri). Aynı sınıfın daha
sert hâli `'	heta'` → **SEKME + "heta"**. Kapı ÜRETİLEN METNE bakıyor
(`fead-pin.test.js`): her `$$…$$` ve `\(…\)` bloğunda ters bölüsüz `;`,
sekme ve çıplak komut gövdesi (`theta`, `text`, `Delta`, `frac`, `circ`,
`big`, `sin`, `cos`) aranıyor. İki mutasyonla ölçüldü — bir `\;`'yi geri
`\;` yapmak ve pim denkleminin `\theta`'sını tekilleştirmek — ikisi de
kırmızı.

Kapı **on üç mutasyonla** ölçüldü, on üçü de kırmızı: ofsetin işaretini
çevirme, yarıçapı kaydırma, kodsuz künyede eski kodu bırakma, kodu hiç
kopyalamama, çizimi olmayan parçaya E9843'ün sayısını verme, `build.pin`'i
hiç kurmama, yalnız zarf kipinde kurma, panelin iki okumasından pim satırını
tek tek düşürme, künye yokken paneli susturma, raporun pim bloğunu düşürme,
eşmerkezlilik notunu silme, künye yokken rapora sayı uydurtma.

> Bir mutasyon (künye yokken paneli susturma) **ilk turda YEŞİL kaldı** ve
> aynı dersi tekrarladı: satır ile açıklama notunun İKİSİ de *"Konum pimi"*
> yazıyor, dolayısıyla yalnız metne bakan kapı satırın düşürülmesini
> geçiriyordu. Kapı artık satırın kendi işaretine bakıyor.

###### AYNI SINIFTAN İKİ OKUYUCU DAHA — ikisi de sessizdi (2026-08-29)

Kullanıcı akışı sordu (*"bir sistem ADIM ADIM nasıl kuruluyor?"*), zincir uçtan
uca koşturuldu ve zarf kipinde **`cenX/cenY` okuyan iki yüzey daha** çıktı. İkisi
de hesaba dokunmuyor — o yüzden hiçbir test kırılmıyordu — ama **kullanıcının
gördüğü şey yanlıştı**:

| Nerede | Belirti | Ölçüm (AG00976, zarf kipi) |
|--------|---------|----------------------------|
| `veFeadNaturalSense` | "Dönüş Yönü" rozeti ve paneli **çözülmüş** modelde bile `— (okunamadı)` | `sense` **1 yerine 0** |
| `veFeadArrangeByCoords` | "Otomatik Düzenle" gergiyi *"koordinatı yok"* sayıp kümenin ALTINA diziyor + uyarı toast'ı | kutu **2857,4/3039,0 yerine 2971,0/3277,3** |

İkincisi bir **AYRIŞMAYDI**: alt topoloji açılışındaki yol
(`veFeadSyncCanvasFromMm`) gergiyi zaten doğru şekilde pivota oturtuyordu, yani
kullanıcı düzenleyip kapatıp açınca kutu yerinden **zıplıyordu**.

**İKİ NOKTA, İKİ OKUYUCU — birleştirilemez.** Kural artık tek yerde ama
fonksiyon **iki tane**, çünkü iki yüzey iki farklı noktayı istiyor:

| Okuyucu | Ne döndürür | Kim kullanır |
|---------|-------------|--------------|
| `veFeadTensionerBoxMm` | **kutunun gösterdiği** nokta — zarf kipinde PİVOT, aksi hâlde montaj merkezi | `veFeadSyncCanvasFromMm` · `veFeadArrangeByCoords` · örnek kurucusu |
| `veFeadTensionerCenter` | **kasnak merkezi** — zarf kipinde `c = p + a·(cos θ, sin θ)` ile TÜRER | `veFeadNaturalSense` (loopSense) · zarf okuması |

Tek fonksiyona indirgemek yönü **kol boyu kadar kaymış** bir çokgenden okumak
olurdu (90 mm).

**ÜÇ BAĞIMSIZ DOĞRULAMA — hepsi ölçüldü:**

| Ne | Sonuç |
|----|-------|
| Türetilen merkez ↔ çekirdeğin ÇALIŞMA merkezi | `−161,624 / 92,981` ↔ `−161,624 / 92,981` — **birebir** (yaklaşıklık değil: memo, zarfın seçtiği çalışma açısının kendisi) |
| Rozet yönü ↔ `geometryAt(...).sense` | **1 ↔ 1** |
| "Otomatik Düzenle" → sonra `veFeadSyncCanvasFromMm` | taşınan düğüm **0**, en büyük sapma **0,0000 px** (iki yol artık aynı yere koyuyor) |

**`build.spin` BİR ÇÖZÜM GERİDE KALIYORDU** ve düzeltmesi sıra meselesi: yön rota
kurulur kurulmaz okunuyor, ama zarf kipinde gergi kasnağının merkezi o an HENÜZ
YOK (kol açısı aynı fonksiyonun ilerisinde seçiliyor). Zarf bloğundan sonra
tazeleniyor.

**MOUNT KİPİNDE TÜRETMEYE DÜŞÜLMEZ** ve bu bilinçli: orada girdi montaj
merkezidir, yoksa model zaten *"montaj merkezi girilmedi"* diye duruyor —
türetilmiş bir sayı basmak çözülemeyen bir modele yön uydurmak olurdu. Zarf
kipinde ise **bayat `cenX/cenY` okunmaz** (mount'tan geçmiş bir kayıtta yazılı
kalabilir); köprü de onları girdi saymıyor, olsa olsa uyarı konusu ediyor.

**Kapı yedi mutasyonla ölçüldü, yedisi de kırmızı:** `naturalSense`i yine
`cenX/cenY`ye bağlama, merkez yerine pivot döndürme, zarf sonrası spin
tazelemesini kaldırma, "Otomatik Düzenle"yi yine `cenX/cenY`ye bağlama, kutu
okuyucusunu zarf kipinde de montaj merkezine bağlama, bayat `cenX/cenY`yi
kazandırma, türetmede işareti çevirme.

> **Sentetik kapı ŞART ÇIKTI.** İki gerçek örnekte pivot ile merkez **AYNI**
> dolanım işaretini veriyor (ölçüldü), yani yalnız onlara bakan bir test
> *"merkez yerine pivot"* mutasyonundan sağ çıkardı. Kapı bu yüzden merkezin
> doğrunun ÜSTÜNDE, pivotun ALTINDA olduğu üç kasnaklı sentetik bir düzen de
> koşuyor: orada işaret **çevriliyor** (+1 ↔ −1).

##### GERGİ KÜNYE KÜTÜPHANESİ — `js/fead-tensioners.js` (14 kayıt, 2 aile)

Kullanıcı isteği: *"Bu otomatik gergi özelliklerini de Gates raporlarından
kalibre ederek çekeceğiz."* Kalıp `fead-belts.js` ile aynı: DOM'suz saf veri,
panel yalnız okur.

**PARÇA NUMARASI UYDURULMADI** ve kayıtlar **kaynak raporla** adlandırıldı;
anahtar hangi ölçümden geldiğini söyler.

> **DÜZELTME — parça numarası RAPORDA VAR.** Bu paragraf bir dönem *"Gates
> raporları gerginin parça numarasını yazmıyor; tek bilinen `E9843` ve o da tek
> bir aracın montaj çiziminden geliyor"* diyordu. `docs/gates-reports/pdf/`
> arşivi kurulunca ÖLÇÜLDÜ ve tutmadı: **on raporun onunda da** kod raporun
> kendi **Drive Notes** alanında yazıyor, üstelik **dört ayrı kod**:
>
> ```
> Tensioner T38624; CW; 24.6Nm          E9843, 22Nm@27°, CCW@115/260
> Tensioner Gates T38665; 31Nm          T38519 (29.5Nm): CCW@-303/7
> ```
>
> Kodlar artık `part` alanında. Arşivde PDF'i olmayan **dört AG00976 kaydı
> `part` TAŞIMIYOR** — doğrulanamayan bir kod yazmak tam da kaçınılmak istenen
> şey olurdu; kapı bunu ayrıca tutuyor.

Aynı alan bir şey daha ele verdi: Drive Notes **bağıl açıyı** da yazıyor
(`E9843/16Nm@15°` · `/19Nm@21°` · `/22.5Nm@28°`) ve bunlar künyeden hesaplanan
`(mean−pre)/rate` ile birebir tutuyor (`15.07 · 20.99 · 27.96`) — künyenin iç
tutarlılığının **kaynaktan bağımsız** kanıtı.

###### İKİ VERİ KUSURU — arşive karşı ölçülünce çıktı

| Kusur | Neydi | Rapor ne diyor |
|-------|-------|----------------|
| `AG00810.ribs` | **8** | **10** (`10PK1215HD`). Alanın kendi tanımı *"künyenin ölçüldüğü kayış genişliği — `meanNm` bunun için geçerli"*, yani yanlış genişlik yanlış çalışma momenti demek |
| `AG00810.preloadNm` | `11.561`, notu yalnız *"bandın üstünde"* | Raporda **HİÇ YOK** — fixture'ın kendi künyesinde *"mean torktan türetildi"* yazılı. Artık `preloadDerived:true` ile işaretli; işaretsiz hâlinde okuyan kişi onu raporun sayısı sanırdı |

**`ribs` kusuru BUGÜN ÇIKTIYI DEĞİŞTİRMİYOR ve bunu söylemek önemli:** bant
hesabı (`relNom8PK`) `ribs === 8` süzgecinden sonra bir de `rel < 30` kesiyor
ve AG00810'un 37.1°'si zaten oradan eleniyor — düzeltmeden önce ve sonra bant
birebir `27.10–29.62`. Yani `<30` kesmesi, `ribs` alanının yapması gereken işi
yapıyordu.

###### Kütüphane ARŞİVE bağlı (`tests/unit/gates-archive.test.js`)

Künyeler `tests/fixtures/fead-validation.js`'ten çıkarılmıştı; arşiv kurulunca
onu da **asıl raporuna** karşı ölçmek mümkün oldu. Kütüphanenin kendi testi iç
tutarlılığa bakar, bu kapı **kaynağa**: on kaydın kol/oran/moment değerleri
(30 sayı) birebir, ön yükün dokuzu birebir ve onuncusu türetilmiş diye
işaretli, kaburga sayısı raporun künyesiyle aynı, parça kodu Drive Notes'ta
gerçekten geçiyor.

Kapı **altı mutasyonla** ölçüldü, altısı da kırmızı: `ribs`'i 8'e geri alma,
türetilmiş ön yük işaretini kaldırma, bir parça kodunu yanlış yazma,
doğrulanamayan kayda kod uydurma, bir yay oranını kaydırma, okuyucudaki
tire-bölünmesi düzeltmesini kaldırma.

###### HANGİ ALAN PARÇANIN, HANGİSİ MONTAJIN — ÖLÇÜLDÜ

Ayrım tahmin değil: **AG0868 ailesi AYNI gergiyi üç kayış genişliğiyle**
kullanıyor ve yalnız bir alan değişiyor.

| | ön yük | katsayı | çalışma momenti | nominal dönme |
|---|---:|---:|---:|---:|
| 8PK | 8,56 | 0,501 | **22,57** | **27,96°** |
| 6PK | 8,65 | 0,495 | **19,04** | **20,99°** |
| 4PK | 8,46 | 0,505 | **16,07** | **15,07°** |

Ön yük ve katsayı **%2 içinde sabit** (aynı yay), çalışma momenti kayış
genişliğiyle ölçekleniyor. Yani:

| | alanlar |
|---|---|
| **PARÇA** | kol boyu · ön yük · yay katsayısı · kasnak çapı · temas tarafı |
| **MONTAJ** | çalışma momenti — kolun ne kadar kurulduğu, bir TASARIM AYARI |

Künye uygulamak **pivot ve kol açısını YAZMAZ** (testli): ikisi de motorun
verisi, parçanın değil. Künye pivotu da taşısaydı kullanıcı bir kataloğun
koordinatını kendi motoruna uygulamış olurdu.

###### İKİ AİLE, VE ~28°'nin RASTLANTI OLMADIĞI

14 kaydın 13'ü tek gövde ailesinden: kol **90 mm**, kasnak **Ø77,2**, sırttan
temas, katsayı **0,475–0,505** Nm/° (±%3). Tek istisna **AG00879**: kol 56 mm,
Ø76,2, katsayı 0,409, ön yük 20,05 — belirgin şekilde başka bir parça.

Kol-90 ailesinin tam genişlikli (8PK) **dokuz** kaydında
`(M_mean − M₀)/k = 27,10 … 29,62°`. Kullanıcının gönderdiği E9843 montaj
çizimi aynı sayıyı yazıyor: *"PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm
SPRING TORQUE @ **28° FREEARM-MEAN ROTATION**"*. Parçanın kendi değişmezi
**bağıl** dönmedir; mutlak açı montaja aittir ve zarftan seçilir.

###### BANT KAYITLARDAN TÜRETİLİR, ELLE YAZILMAZ

İlk sürüm yuvarlanmış sınırlar taşıyordu ve **kapı bunu yakaladı**:
`(16,07 − 8,46)/0,505 = 15,0693…`, elle yazılan alt sınır ise `15,07` — yani
kütüphane **kendi kaydını** "bandın dışında" ilan ediyordu. Elle yazılmış bir
sınır ayrıca yeni bir kayıt eklendiğinde sessizce eskir (kart ölçüsündeki
"ikinci kopya" dersinin aynısı).

**Bant bir HÜKÜM değil bir KARŞILAŞTIRMA:** kullanıcının gergisi bu 14 raporun
dışından olabilir ve bu bir hata değildir. Ama **bir ondalık kayması tam
buradan görünür** — `rate 0,480 → 0,048` hem katsayı bandını hem nominal
dönmeyi (280°) düşürüyor, yani iki bağımsız işaret veriyor.

**KAYIT KOPYA OLARAK GİDER:** kütüphane sürümü değişip bir değer düzeltilse
bile kaydedilmiş proje kendiliğinden değişmez (`tenLib`/`tenLibVer` yalnız İZ
bırakıyor) — `structural-materials.js`'in kendi kuralı, bu projenin en çok
kaçındığı hata sınıfı.

**EN KRİTİK KAPI:** kütüphanedeki her sayı `tests/fixtures/fead-validation.js`
içindeki raporlardan çıkarıldı, yani **ikinci bir kopya**. Ayrışırsa hata
SESSİZ olur — kullanıcı künye seçer, model çözülür, uyarı çıkmaz, yalnız
sayılar raporunkinden başkadır. Test 14 kaydın 14'ünü de fixture'la **birebir**
karşılaştırıyor ve nominal dönmeyi raporun kendi Mean satırıyla (0,2° içinde)
tutuyor.

Kapı **dokuz mutasyonla** ölçüldü, dokuzu da kırmızı: bir künyeyi fixture'dan
kaydırma, uygulamada kasnak çapını atlama, bant denetimini boşaltma, listeyi
referansla döndürme, künyeden pivota yazma, Türkçe katlamayı kaldırma, bandı
elle yazılmış sınıra döndürme, paneli künye kartını basmaz yapma, seçilen
künyeyi uygulamama.

> Türkçe katlama kapısı **ilk turda YEŞİL kaldı**: test `AG00976` / `KASNAK`
> gibi sorgularla koşuyordu ve ikisi de `toLowerCase()` ile de bulunuyor. Kapı
> artık `DIŞINDA` / `dışında` / `DISINDA` dörtlüsünü koşuyor — JS'te
> `'I'.toLowerCase() === 'i'` (Türkçe'de `'ı'` olmalı), yani ancak katlamayla
> bulunuyor.

##### KAYIŞ TİPİNE BAĞLI ÇIKTILAR — ŞİMDİLİK KAPALI (2026-08-28)

Kullanıcı isteği: *"'kayış boyu' kullanılarak yapılan hesaplamalar, diyagramlar
vb şeyler, yani 'kayış tipi' özelinde gelen profil sabitleri ile hesaplanan
şeyler olmayacak. ŞİMDİLİK. İlerleyen zamanlarda BELKİ kayış tipi sabit kabul
ederek bir hesaplama yapabiliriz."*

Zarf kipinde kayış boyu bir ÇIKTI, yani tasarım aşamasında kayış **henüz
seçilmemiştir**. O aşamada katalog sabitleriyle hesap yapmak olmayan bir seçimi
varsaymak olurdu — ve bu modülde en pahalı hata sınıfı "makul ama yanlış"
sayıdır: tablolar dolu görünür, hüküm verilir, okuyucu neyin varsayıldığını
bilmez.

| kapatılan çıktı | kayış katalogundan gelen |
|---|---|
| B10 kayış ömrü | `effLength` · `massPerRibKgM × ribs` · yorulma sabitleri |
| Kaburga yorulma dağılımı | yorulma sabitleri (PK-2_2p-MT3 / PK-2_2a-MT3) |
| Açıklık doğal frekansları + çırpınma | birim kütle (`massPerRibKgM × ribs`) |
| Kol konum tablosunun zarfı | `tolerance` · `wearPct` |

**KAPATILAMAYAN TEK ŞEY: `hb` / `hr`.** Pitch yarıçapı `OD/2 + hb` (kaburgalı)
ya da `OD/2 + hr` (sırttan); ikisi de profil sabiti. PK'da `hb = 1,2 mm`, yani
merkez mesafelerinde 2,4 mm'lik fark. Bunlar olmadan **teğet geometrisi
yoktur** — kapatmak "kayışsız kayış tahriki" demek olurdu. Panel ve rapor bunu
açıkça yazıyor: kapatılan şey profil değil, profilin **katalog sonuçları**.

**VARSAYILAN VERİDEN ÇÖZÜLÜR** (`veFeadBeltDataMode`): zarf kipinde `none`,
diğer kiplerde `full` — yani bugüne kadarki her kayıt davranışını birebir
koruyor (testli). Kullanıcının açık seçimi ikisini de ezer.

**SESSİZ DEĞİL:** kapatılanlar `beltDataOff` olarak sonuca giriyor, panel
listeliyor, rapor §8'in başında *"Kayış tipine bağlı çıktılar bu belgede YER
ALMIYOR"* kutusunu basıyor. Bir özet belgenin en pahalı sessiz hatası,
İÇERMEDİĞİ bir kontrolün yapıldığı izlenimini bırakmasıdır.

Kapı **altı mutasyonla** ölçüldü, altısı da kırmızı: zarf kipinde yine `full`
verme, kapalıyken ömür/yorulmayı yine üretme, frekansları bırakma, kapatılanlar
listesini boşaltma, panel anahtarını başlıksız bırakma, rapordan kutuyu düşürme.

> Altıncısı **ilk turda YEŞİL kaldı** — kapı `_frBeltDataBox`'ı doğrudan
> çağırıyordu, `_frSection8`'in onu BASTIĞINI ölçmüyordu. Aynı oturumda
> **üçüncü kez** aynı ders: kapı ÜRETİLEN YÜZEYE bakmalı, üreticiye değil.

##### BAŞLANGIÇ SİHİRBAZI — `js/cp-fead-wizard.js` (7 adım, 2026-08-29)

Kullanıcı isteği: *"Bir 'Başlangıç Sihirbazı' bileşeni kuracağız. Bu bileşene
tıkladığımızda adım adım bir modeli kurmak için gereken tüm girdileri
gireceğiz. İlk sayfada sihirbaz kullanıcıya kasnak koordinatlarını soracak,
diğer sayfada diğer girdileri…"*

Çözdüğü şey bir eksiklik DEĞİL bir **SIRA** sorunu: bütün girdiler zaten
panellerdeydi, ama hangi sırayla girileceğini ve hangi alanın hangi belgeden
okunduğunu ancak modülü bilen biri biliyordu. Boş bir iç topolojide kullanıcı
"önce ne koyayım" sorusuyla baş başaydı.

| Adım | Ne sorar |
|------|----------|
| 1 Başlangıç | sistem adı · örnekten doldur |
| 2 Kasnaklar | tip · ad · Ø OD · X/Y · temas tarafı · sürücü rolü · atalet — **gergi de burada** (künye + montaj konumu) |
| 3 Kayış Yolu | serpantin sırası (↑↓) · yönü çevir · dönüş yönü okuması |
| 4 Otomatik Gergi | künye kütüphanesi · montaj konumu · kol · yay künyesi · titreşim girdileri |
| 5 Kayış | profil/marka/kanal · kayış tipine bağlı çıktılar (boy bir ÇIKTI) |
| 6 Motor ve Çevrim | tahrik oranı · motor künyesi · **aksesuar modelleri** · duty tablosu (devir · %zaman · °C · aksesuar kW **okuması**) |
| 7 Özet ve Kurulum | canlı çözüm kartları · **kayış yolu şeması** · uyarılar · Modeli Kur |

###### ÜÇ KURAL — üçü de bu modülün kendi derslerinden

1. **SİHİRBAZ KENDİ MODELİNİ KURMAZ.** Durum → `veFeadWizNodes` → köprünün
   düğüm biçimi (`veFeadExampleNodes` ile AYNI sözleşme). **Önizleme de kurulum
   da aynı listeden** geçiyor; ikinci bir kurucu yazmak, önizlemenin kanvasta
   çıkan modelden sessizce ayrışması demekti.
2. **DOĞRULAMA DA KÖPRÜDEN.** Her adımda `veFeadBuildSystem` koşuyor ve onun
   `errors/warnings` listesi adıma süzülüp gösteriliyor (`VE_FW_ERR_STEP`).
   İkinci bir zorunlu-alan listesi, köprü değişince sessizce eskiyen bir kapı
   olurdu. Köprü hiçbir durumda istisna atmadığı için sihirbaz İLK adımdan
   itibaren canlı çalışıyor.
3. **DURUM OTURUMLUK, KURULUM KALICI.** Kırk alanlık bir formda her tuş vuruşu
   `saveState()` çağırsaydı geri-al yığını kullanılamaz hale gelirdi (panel
   alanlarının kuralı burada geçerli DEĞİL: orada bir alan = bir karar). Taslak
   KAPANIŞTA `node.data.wiz`e yazılıyor; `saveState` yalnız kapanışta ve
   kurulumda.

###### EN SIKI KAPI BİR EŞİTLİK — sihirbaz iki örneği de BİREBİR geri üretiyor

Sihirbazın durumu bambaşka bir biçim (form satırları, kasnak anahtarları,
`kwByKey` yerine `kw`) ama çözüm **aynı sayı** olmak zorunda. **ÖLÇÜLDÜ:**

| | sihirbaz | örnek kurucusu |
|---|---|---|
| AG00976 | L **1714,6000** · T **544,0497** · rel **28,0750** · spin 1 | birebir aynı |
| BMC | L **1715,0000** · T **532,1423** · rel **28,4271** · spin 1 | birebir aynı |

Çeviride bir alan düşse (temas tarafı, sürücü rolü, kip, yay künyesi, duty kW)
sonuç sessizce kayardı — model yine çözülür, yalnız başka bir sistemi anlatır.

###### GERGİ TEK KOORDİNAT TAŞIR — ve ötekiler TAŞINMAZ

`angleMode` **açıkça** yazılıyor (köprü veriden de çözebiliyor ama açık seçim
her zaman kazanır): yarım doldurulmuş bir formda kip, kullanıcının seçtiğinden
BAŞKA çıkabilirdi. Kasnak merkezi **yazılmıyor** — yazılsaydı köprünün "iki
koordinat da var" uyarısı, kullanıcının GİRMEDİĞİ bir alandan gelirdi; merkez
zaten montaj konumu + kol açısından TÜREYEN bir çıktı. Kayış boy kipi de
yazılmıyor: boy yapısal olarak bir çıktı ve köprü kipi zaten kilitliyor.

###### KURULUM: mevcut model SESSİZCE silinmez

Kanvasta kasnak varken kurulum **kapalı** ve sebebi yazılı: üstüne kurmak bir
kasnaktan iki tel çıkması demekti (çatal → çözüm reddedilir). Açık onay
kutusu işaretlenince siliniyor ve **geri alınabilir**. Araç düğümleri
(kayış · çözücü · kart · rapor) silinmiyor, **yeniden kullanılıyor**:
`fead-belt` zaten `maxInstances:1` ve kullanıcının kart ölçüsü / rapor türü
gibi tercihlerini çöpe atmanın karşılığı yok.

**SİHİRBAZ DÜĞÜMÜ KURULUMDAN SONRA KALIR** — `fead-example`'ın tersine, ve
ayrım kullanıcı verisinde: sihirbaz düğümü kullanıcının kendi formunu taşıyor
(silmek onu çöpe atmak olurdu), örnek düğümü hiçbir şey taşımıyor.

###### İki UI kararı, ikisi de ölçülmüş bir kusurun karşılığı

| Karar | Neyi kapatıyor |
|-------|----------------|
| Canlı şerit **yama**, tam yeniden çizim değil (220 ms gecikmeli) | Her tuş vuruşunda panel yeniden kurulsaydı **ODAK düşerdi** — malzeme kütüphanesi aramasında ölçülmüş sınıf. Ayrıca zarf kipinin ilk taraması 84 ms; kol açısı memosu duruma yazıldığı için sonraki çözümler 6 ms |
| Adım rayı **tıklanabilir** ve rozeti o adımın **hata sayısını** taşıyor | Sihirbaz bir kilit değil bir sıra önerisi; kullanıcı 5. adımda bir kasnağı düzeltmek için 2'ye dönebilmeli ve hangi adıma döneceğini son adımı beklemeden görmeli |

Boş topoloji artık **iki** açılış yüzeyiyle geliyor (sihirbaz + örnekler): ikisi
farklı soruya cevap veriyor — *"kendi motorumun verisini nasıl gireceğim"* ile
*"çalışan bir model neye benziyor"*.

###### ÖLÇÜLDÜ — gerçek tarayıcı (6 E2E, ilk turda yeşil)

Çift tık sihirbazı açıyor · yedi adım rayda · örnekten doldurunca şerit
`✓ model çözülüyor · L 1715.0 mm · T 532.1 N · ↺ CCW` ve **hata rozeti 0** ·
gerçek klavye girişinde değer modele işliyor ve **odak alanda kalıyor** ·
özet adımında şema **6 kasnak çemberiyle** çiziliyor · "Modeli Kur" **6 kasnak
+ 6 tel** kuruyor, önizleme ile kurulan model **1e-6 içinde aynı**, sihirbaz
düğümü kalıyor, örnek düğümü gidiyor · modal ekrana sığıyor ve gövde **yatay
kaydırmıyor** (tablo kendi kabında kayıyor) · konsol hatası **yok**.

Kozmetik tur ekran görüntüsüyle yapıldı ve dört düzeltme çıkardı: duty kW yer
tutucusu `0` gerçek bir değer gibi okunuyordu (boş hücre "kasnağın kendi
eğrisinden gelsin" demek) → tire; özet kartı **mount kipinde olmayan** mutlak
kol açısını `—` basıyordu → kipe göre *"Kol açısı (mutlak)"* ↔ *"Kol dönmesi
(göreli)"*; şema 520 px'de etiketleri kayış yolunun üstüne bindiriyordu →
700×440 (kabı aşmadan); tablo sütunları tip/ad adlarını kırpıyordu → sütun
alt genişlikleri.

**Kapı on mutasyonla ölçüldü, onu da kırmızı:** duty kW çevirisini kaldırma,
zarf kipinde montaj merkezini de yazma, kipi veriden çözdürme, zarf kipinde
kayış boy kipini yazma, kasnak silinince duty sütununu bırakma, kurulum
kapısını kaldırma, sihirbaz düğümünü de silme, başlangıçta yalnız örnek
kutusu koyma, `maxInstances`ı kaldırma, form içi düzenlemede `saveState`
çağırma.

> Onuncusu **ilk turda YEŞİL kaldı**: kapı yalnız satır EKLEME yolunu
> yokluyordu, oysa asıl risk alan YAZMA yolunda (`_fwSet`). Kapı artık üç
> yolu birden koşuyor.

###### BEŞ DÜZELTME — kullanıcı turu (2026-08-31)

Kullanıcı sihirbazı kullanıp beş madde bildirdi. Üçü eksiltme, ikisi ekleme; ama
ikisinin altından **sessiz birer kusur** çıktı.

| # | İstek | Ne yapıldı |
|---|-------|------------|
| 1 | *"'Kasnaklar' kısmında otomatik gergi eklenmiyor/çıkarılmıyor… koordinatları oraya el ile girelim, bu sayfadan gerginin tipini seçelim"* | Gergi 2. adımda **sanal satır** olarak duruyor (`_fwTenRow`) |
| 2 | *"Otomatik gergi tiplerinde Gates raporları yazıyor… sadece kol uzunluğu ve çalışma momenti yazsın"* | `veFeadTenLabel` — **tek üretici**, panel de onu kullanıyor |
| 3 | *"Sihirbaz içinde 'Katalog Önerisi' kısmı var. Onu kaldıralım."* | Blok kalktı, yerine Kayış Özellikleri paneline yönlendiren tek satır |
| 4 | *"Kullanıcı alternatör ve klima kompresörü tipini tıpkı bileşenindeki gibi açılır pencere ile seçecek… El ile değer girmeyeceğiz."* | **Aksesuar Modelleri** kartı + duty kW hücreleri **salt okuma** |
| 5 | *"Sonuçlar kısmından 'kol açısı' açıklamasını kaldıralım."* | Özet 6 → **5 künye** |

###### 1 · GERGİ SATIRI SANAL — silinemez, sürücü olamaz, koordinatı KİPE bağlı

Gergi bir kasnak listesi ögesi değil (`st.ten` ayrı bir alan, `st.pulleys`
dizisinde yeri yok) ve öyle KALIYOR: onu diziye almak sürücü seçimi, silme,
sıralama ve duty sütunu yollarının hepsine "ama gergi hariç" istisnası eklemek
olurdu. Satır **sanal**: tabloya çiziliyor, yazdığı yer `st.ten`.

| Ne | Karar |
|----|-------|
| Sürücü radyosu | **kapalı** — gergi güç çekmez, çeviremez |
| Silme düğmesi | **kapalı** — gergi zincirin yapısal parçası, sıraya kendiliğinden giriyor |
| Koordinat alanları | **montaj konumu** (`pivotX/pivotY`) — kasnak merkezine ASLA yazmaz |
| Hangi nokta olduğu | Satırın kendi **amber çipinde** yazılı: `X/Y = montaj noktası` |

Çip bir süs değil: bu modülün **ölçülmüş en pahalı karışıklığı** tam bu iki
noktanın karıştırılması (montaj noktası sanılan kasnak merkezi → T **−%48,6**,
en kötü sarım **+%27,9**, model yine çözülür ve uyarı çıkmaz). Diğer beş satırın
X/Y'si her zaman kasnak merkezi olduğu için gergi satırı bunu **söylemek
zorunda** — ve kapı yalnız doğru alana yazdığını değil, `cenX/cenY`'ye
yazMADIĞINI da tutuyor (o alana yazmak kullanıcının sayısını 90 mm ötedeki bir
noktaya koymak olurdu).

> Alan adı `pivotX/pivotY` olarak KALDI (veri biçimi), yüzeydeki ad ise
> **montaj konumu** — PR #831'in terminoloji kararı. İkisini tek yerde
> (`veFeadWizTenCoordKeys` / `veFeadWizTenCoordLabel`) tutmak, satırın ve 4.
> adımın aynı alanı yazmasının garantisi.

**AYNI DURUM, İKİ YÜZEY.** `veFeadWizTenSet` doğrudan `st.ten`'e yazıyor — 4.
adımın okuduğu alanın ta kendisi. İkinci bir kopya tutulsaydı iki sayfa sessizce
ayrışırdı (bu modülün tekrar eden kuralı: *"panel ile kart AYNI alanı okur"*).
Aynı gerekçeyle 2. adımdaki künye seçicisi de 4. adımdakiyle **aynı fonksiyona**
(`veFeadWizTenLib`) gidiyor.

Kart alt başlığı da düzeldi: `6 kasnak (gergi dahil)` — eskiden 5 diyordu ve
kullanıcının bildirdiği *"gergi eklenmiyor"* algısını besliyordu.

###### 2 · ETİKET TEK ÜRETİCİDEN — ve 14 kayıt 14 AYRI etiket veriyor

```js
veFeadTenLabel(rec)  →  'kol 90 mm · 22.07 Nm'
```

Eski etiket kayıt anahtarını (`AG00976-1715`) ve raporun adını taşıyordu; o
anahtar künyenin **hangi ölçümden çıkarıldığını** söyler, kullanıcıya ise
parçanın ne olduğunu söylemez.

**TEKİLLİK ÖLÇÜLDÜ: 14 kayıt → 14 ayrı etiket.** Kol boyu ikiye ayırıyor
(90 mm ×13, 56 mm ×1), çalışma momenti geri kalanı: `16,07 · 19,04 · 22,07 ·
22,15 · 22,20 · 22,21 · 22,43 · 22,54 · 22,57 · 22,66 · 23,00 · 24,54 · 29,48 ·
31,14`. Yani sadeleşme bir **çakışma** üretmiyor — üretseydi kullanıcı iki
farklı künyeyi ayırt edemezdi.

Üretici `js/fead-tensioners.js`'te ve **panel de onu kullanıyor**
(`veFeadTensionerLibCard`): iki yüzey aynı listeyi farklı adlandırsaydı
kullanıcı sihirbazda seçtiği künyeyi panelde bulamazdı.

**BEDELİ YAZILI:** etiket artık parça kimliğini taşımıyor. Parça kodu kayıtların
**10'unda var** (`E9843` ×6, `T38624` ×2, `T38665`, `T38519`) ve istenirse
etikete eklenebilir; bugün kullanıcının açık isteği *"diğer açıklamalara gerek
yok"* olduğu için eklenmedi. Sihirbazın gergi kartı da geçerlilik satırını
(*"kütüphane bir sertifika değil"*) artık basmıyor; panel basmaya devam ediyor.

###### KÜNYE UYGULAMASINDA SESSİZ KUSUR — beyaz liste `tenPart`'ı YUTUYORDU

Kapıyı yazarken çıktı. Sihirbaz künyeyi kendi **beyaz listesiyle** kopyalıyordu
(kol · ön yük · katsayı · moment · çap · temas) ve iki alan listede yoktu:
`tenPart` (parça kodu) ile `inertia`. Üstelik kodu OLMAYAN bir künyeye
geçildiğinde eski kod **silinmiyordu** — yani bir sonraki gerginin pimi ESKİ
parçanın çizimiyle hesaplanırdı; `veFeadTensionerApply`'ın kendi kuralı tam
olarak bunu yasaklıyor.

**ÖLÇÜLDÜ** (AG00976 durumuna kütüphaneden künye uygulanınca):

| uygulanan kayıt | `tenPart` | `build.pin` |
|---|---|---|
| beyaz liste (eski) | **yok** | `ok:false` · *"Gergi parça kodu yok"* — **yanlış sebep** |
| AG00894 (E9843) | `E9843` | `ok:true` · **235,00°** · r 31 mm · ofset −113° |
| AG00686 (T38624) | `T38624` | `ok:false` · *"T38624 için parça çizimi yok"* — **doğru sebep** |

Yani kullanıcı kodu olan bir künye seçiyor, sihirbaz *"kod yok"* diyordu.
Düzeltme yeni bir kural değil, **ikinci kopyanın kaldırılması**: satır artık
doğrudan `veFeadTensionerApply(st.ten, rec)` çağırıyor — panelin kullandığı
yolun ta kendisi.

###### 4 · AKSESUAR MODELİ SEÇİLİR, kW ELLE GİRİLMEZ

Duty tablosunun kW hücreleri **girdi olmaktan çıktı**, okuma oldu
(`.ve-fw-ro`). Değer nereden gelirse gelsin aynı hücrede görünüyor ve **kaynağı
ayrı bir sütunda yazılı** (`katalog` · `kasnak eğrisi` · `kayıtlı ölçüm` ·
`güç yok`).

**ÖNCELİK KÖPRÜDEN KOPYALANMADI, AYNADI.** `_fwKwEff` köprünün
(`veFeadDutyToCore` → `veFeadAutoKw`) sırasını birebir izliyor: duty kW →
kasnağın kendi `pwrCurve`'ü → `accPreset` kataloğu → 0. Ayrışsaydı sihirbaz bir
sayı gösterir, çözüm başkasıyla koşardı.

**MODEL SEÇMEK KAYITLI kW'ı TEMİZLER** ve bu, isteğin çalışabilmesinin şartı:
`AG00976_GATES_2025`'in gücü **yalnız duty kW'ında** yazılı, yani temizlenmezse
kayıtlı sayı katalogu her zaman yener ve açılır pencere hiçbir şey yapmamış
görünürdü.

**ÖLÇÜLDÜ (alternatör, 880 → 2750 d/dk):**

| kaynak | kW |
|---|---|
| kayıtlı ölçüm (Gates AG00976, 155 A) | 3,61 · 3,78 · … · 4,02 |
| katalog `tepas_350a` seçilince | **7,62 · 9,08 · … · 15,13** |

880 d/dk'da **2,1 kat** — çünkü katalogun en küçük alternatörü **180 A**, raporun
alternatörü 155 A. Seçim kozmetik değil; fark da uydurma değil, katalogun kendi
eğrisi. Katalog **Araç Performans modülüyle ORTAK** (`VE_ALTERNATOR_PRESETS` /
`VE_AC_PRESETS` / `VE_AIRCOMP_PRESETS`) — ikinci bir kopya yok — ve aksesuar
devri her zaman **kasnak pitch çaplarından** hesaplanıyor, preset'in kendi
`driveRatio`'sundan değil (spesifikasyon §2.3'ün *"Excel'in en ciddi hatası elle
yazılmış hız oranlarıydı"* maddesi).

**SESSİZ SIFIR ARANIYOR:** yük taşıyabilecek bir aksesuarın ne modeli ne kayıtlı
ölçümü varsa kart onu **adıyla** listeliyor. Sessiz bırakılsaydı o aksesuar
0 kW ile koşar, gerilmeler tasarım gerginliğine düzleşirdi — bu deponun
belgelenmiş `544·6` sınıfı (bkz. *"KÖK NEDEN: duty kW'ı çözüme HİÇ
ULAŞMIYORDU"*).

Avara ve gergi satırları tabloda **duruyor** (`katalog yok` yazıyor): AG00976'da
onların da kayıtlı 0,01 kW'ı var; satırı gizlemek o ölçümü görünmez yapardı.
Sürücü kasnak listede YOK — gücü diğerlerinin toplamı, elle girilirse çekirdek
zaten reddediyor.

###### 5 · ÖZETTEN KOL AÇISI KALKTI — geriye BEŞ künye kaldı

`Durum · Kasnak · Kayış boyu · Tasarım gerginliği · Dönüş yönü`. Kol açısı
kaldırıldı; sayı kaybolmuyor, 4. adımın kendi kartında ve raporda duruyor.

###### Kapı **on beş mutasyonla** ölçüldü, on beşi de kırmızı

Gergi satırını tablodan düşürme · sürücü radyosunu açma · silme düğmesini açma ·
satırı kasnak merkezine yazdırma · X/Y çipini düşürme · `veFeadWizTenSet`'i
ayrı bir kopyaya yazdırma · etiketi yine anahtarla basma · panelin kendi etiket
kopyasını tutması · `tenPart`'ı yine beyaz listeyle yutma · kodsuz künyede eski
kodu bırakma · katalog önerisi bloğunu geri koyma · duty kW hücresini yine girdi
yapma · `_fwKwEff` önceliğini köprüden ayırma · model seçince kayıtlı kW'ı
bırakma · özete kol açısı künyesini geri koyma.

**ÖLÇÜLDÜ — gerçek tarayıcı (8 E2E):** 2. adımda gergi satırı altıncı sırada,
künye açılır penceresi ve amber çip yerinde, sürücü radyosu ile silme düğmesi
`disabled`; koordinat alanına gerçek klavye girişi **odağı düşürmeden** modele
işliyor ve 4. adımda aynı sayı görünüyor; 6. adımda alternatör modeli seçilince
duty hücreleri katalog sayısına dönüyor ve kaynak sütunu `katalog` yazıyor;
7. adımda beş künye var, `kol açısı` **yok**.

###### KOZMETİK TUR — alt çubuk ve adım rayı (2026-08-31)

Aynı gün iki bildirim daha geldi ve ikisinin de cevabı **ölçümden** çıktı.

**1 · ALT ÇUBUK KENDİ BAŞLIĞINDAN KALINDI.** *"Yeşil ile çizdiğim yer çok geniş
olmuş. Oradaki butonlar falan da çok geniş duruyor… orantısız duruyor."*
Sayı seçilmedi, **modalın kendi üst çubuğundan okundu**:

| | önce | sonra | çıpa |
|---|---:|---:|---|
| alt çubuk | **48 px** | **40 px** | `.ve-settings-header` = **39 px** |
| düğme | 29 px | **25 px** | uygulamanın `.ve-trace-btn`'ü 22 px |
| düğme genişliği | 62 · 67 · 104 | **56 · 61 · 98** | — |
| gövdeye kalan yer | — | **+8 px** | — |

Yani çubuk keyfî olarak küçültülmedi: **aynı diyaloğun iki çubuğu artık aynı
bantta**. Orantısızlığın kaynağı da buydu — alt çubuk üst çubuğundan 9 px
kalındı.

**2 · ADIM RAYI ÜÇ DURUM YAKIYOR.** *"Eksik girdi olduğunda kırmızı, girdiler
tam olduğunda ise belirgin bir yeşil… Şu anda kullanıcı yeteri kadar
bilgilenemiyor."* Eksiklik yapısaldı ve **iki katmanlıydı**:

| Eski davranış | Neden yetersiz |
|---|---|
| Tek işaret **hata rozeti** idi (yalnız hata varken çiziliyor) | *"sorun yok"* ile *"buraya hiç bakılmadı"* AYIRT EDİLEMİYORDU |
| `done` sınıfı **konumu** anlatıyordu (`i < _fwStep`) | Üstünden geçilmiş ama EKSİK bir adım yeşil halkalı görünüyordu — ray **yanlış bilgi** veriyordu |

Durum `veFeadWizStepState(b, step)` ile **tek yerden** üretiliyor ve kaynağı
köprünün kendi listesi (`b.errors` / `b.warnings`); ikinci bir doğrulama
listesi, köprü değişince sessizce eskiyen bir kapı olurdu — sihirbazın kuruluş
kuralının ta kendisi.

**ÜÇ DURUM, İKİ DEĞİL:** bu modülde *"çözülüyor ama uyarı taşıyor"* gerçek ve
sık bir hâl (kalibrasyon dışı çap, türetilemeyen ankraj, kenetlenmiş kol). Onu
yeşile katmak *"her şey tamam"* demek, kırmızıya katmak çözülen bir modeli
bozuk göstermek olurdu.

**İKİ KANAL, ÇAKIŞMADAN** — ve bu bir incelik değil, eski `done`un düştüğü
tuzağın kapatılması:

| Kanal | Ne söylüyor |
|-------|-------------|
| Zemin tinti + kalın başlık + kalın şerit | **HANGİ** adımdayız (`.on`) |
| Renk (sol şerit · numara dairesi · rozet) | O adımın **DURUMU** (`.ve-fw-st-*`) |

Tek kanala bindirilseydi **seçili adımın durumu görünmezdi** — oysa
kullanıcının en çok baktığı adım tam olarak o. Seçili adımda daire *dolar*
(aynı renk, ters kontrast), yani "buradasın" okunurken durum kaybolmuyor.

**ÖLÇÜLDÜ (gerçek tarayıcı, hesaplanmış RENK — sınıf adı değil):**

| durum | Başlangıç | Kasnaklar | Kayış Yolu | Otomatik Gergi | Kayış | Motor | Özet |
|---|---|---|---|---|---|---|---|
| boş sihirbaz | ✓ yeşil | **1 kırmızı** | **1 kırmızı** | **4 kırmızı** | ✓ | ✓ | ✓ |
| AG00976 örneği | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| bir kasnağın çapı silinince | ✓ | **1 amber** | ✓ | ✓ | ✓ | ✓ | ✓ |

Üçüncü satır üç durumun da ayrı ayrı yandığının kanıtı: eksik çap köprüde bir
UYARI (varsayılana düşüyor), hata değil — amber onu doğru anlatıyor.

**Kapı yedi mutasyonla ölçüldü, yedisi de kırmızı:** uyarıyı yeşile katma,
rozeti yalnız hata varken basma, durum sınıfını hiç basmama, konumsal `done`a
geri dönme, CSS'ten `st-ok` kuralını silme, alt çubuk dolgusunu 9 px'e geri
alma, düğme dolgusunu `6px 13px`'e geri alma.

Beşincisi **yalnız E2E'den** görünüyor ve sebebi öğretici: sınıf basılmaya
devam ediyor, yalnız kuralı yok — ray yine sessiz kalıyor. Bu yüzden gerçek
tarayıcı kapısı sınıf ADINA değil **hesaplanmış renge** bakıyor (şerit ile
rozetin aynı renkte olması, kırmızıda R'nin G'den ≥60 baskın olması, yeşilde
tersi).

###### SEKİZ DÜZELTME — ikinci kullanıcı turu (2026-08-31)

Kullanıcı sihirbazı yeniden kullanıp sekiz madde bildirdi. Beşi eksiltme, üçü
düzeltme; ama üçünün altından **birer sessiz kusur** çıktı.

| # | İstek | Ne yapıldı |
|---|-------|------------|
| 1 | *"otomatik gerginin satırında 'elle gir' gibi bir şey var. O olmayacak, orada normal 'Otomatik Gergi' yazacak."* | TİP sütunu **adı** basıyor, künye seçici onun ALTINDA (`.ve-fw-tip-ten`) |
| 2 | *"'Kasnaklar' kısmına 'dönüş yönü' seçmeyi de eklememiz gerekiyor."* | İki durumlu seçici — **durum tutmaz**, sırayı çevirir |
| 3 | *"Uyarılar kısmı… koordinat girmemize rağmen hemen güncellemiyor."* | Canlı yama uyarı kutusunu ve adım rayını da tazeliyor |
| 4 | *"'elle gir' haricinde… değerler değiştirilmemeli"* | Künye seçiliyken parça alanları `readonly` |
| 5 | *"'Bu künyeden çıkanlar' kısmına gerek yok."* | Kart ve onu üreten blok kalktı |
| 6 | *"'Künye' ve 'Malzeme' kısımlarına gerek yok… SADECE VE SADECE kayış boyunu çıktı olarak verecek"* | Üç kart kalktı, `beltDataMode` her zaman `none` |
| 7 | *"aksesuarların tiplerini seçtiğimde değerler hala gelmiyor. Garip bir yapı var"* | İki ayrı kusur — aşağıda |
| 8 | *"girdilerin topolojideki bileşenlere doğru aktarıldığından emin olalım"* | Uçtan uca ölçüldü, kapı kondu |

###### 1 · SİHİRBAZIN GERGİ ADI TEK ÜRETİCİDEN — ve palet adı DEĞİL

Palet adı **"Gergi"** (`componentDefs['fead-tensioner'].name`), sihirbaz ise
baştan beri **"Otomatik Gergi"** diyor: 4. adımın başlığı, kayış yolu listesi
ve kurulan düğümün `customName` yedeği üçü de o. Kullanıcı satırda da onu
istedi; ilk uygulama palet adını basınca gerçek tarayıcıda **"Gergi"** çıktı.

Üretici bu yüzden `_fwTenAd()` ve **dört yüzeyi birden** besliyor. Kapı yalnız
metne bakmıyor: satırın **yer tutucusu ile kurulan düğümün adı AYNI olmak
zorunda** — ad boş bırakıldığında kanvasa yazılacak şey odur.

**AD HÜCRESİ DE DİĞERLERİYLE BİREBİR OLDU** (*"Ad kısmı da diğerleri gibi
olacak"*): oradaki amber çip (`X/Y = montaj noktası`) **silinmedi** —
karıştırmanın ölçülmüş bedeli gerginlikte **−%48,6** — **uyardığı sütuna**,
yani X sütununun altına taşındı. Uyarıyı komşu sütunda tutmak zaten yanlış
yerdeydi.

###### 2 · YÖN SEÇİMİ DURUM TUTMAZ — `fead-spin` kuralının aynısı

Duruma bir `dir` alanı koymak ikinci bir gerçek kaynak yaratırdı ve üç yerden
ısırırdı (3. adımın sıra listesi yalan söyler · kurulan kanvasın gidiş okları
bayrakla çelişir · bayrak silinince yön sessizce döner). Seçim yalnız şunu
yapıyor: **istenen yön bugünkünden farklıysa sırayı çevir.**

**AYNI YÖNÜ SEÇMEK HİÇBİR ŞEY YAPMAZ** — yoksa aynı düğmeye ikinci tık sırayı
geri çevirir ve seçici bir aç/kapa gibi davranırdı.

**ÖLÇÜLDÜ (gerçek tarayıcı, AG00976, düğmeye gerçek tık):** `↺ CCW → ↻ CW`,
`spin +1 → −1`, kayış boyu `1714.608847610321 ↔ 1714.6088476103205` — yani
**13 basamak birebir**. Geometrinin değişmemesi bir yaklaşıklık değil cebirsel
özdeşlik; kapı bunu ölçüyor ki bir gün "yönü çevirmek boyu da değiştirsin"
diye bir düzeltme sessizce girmesin.

**RENK HÜKÜM TAŞIMAZ:** CW ile CCW'nin ikisi de eşit meşru (kanvastaki
`fead-spin` rozetinin kuralı) — seçili olan vurgulanır, öteki nötr kalır.
Yön okunamıyorsa iki düğme de kapalı: hüküm uydurulmuyor.

###### 2b · İKİ SIRA DOLAŞIYORDU — yön seçicisi bunu ORTAYA ÇIKARDI

Yön seçicisi `veFeadWizRouteReverse`'e gidiyor ve o fonksiyonda **ölçülmüş bir
kusur** vardı. Gergi `st.pulleys` dizisinde değil `st.ten`de duruyor;
`'__ten__'` anahtarını sıraya `veFeadWizRoute` **anlık** olarak ekliyor ve
`_fwState.route`'a YAZMIYORDU. Yani iki farklı sıra vardı: **OKUNAN** (gergi
dahil) ve **YAZILAN** (gergi hariç) — taşıma ile çevirme yazılan sırada
çalışıyordu.

| Kusur | Belirti |
|-------|---------|
| Çevirme çevrimi ters yürütmüyor, gerginin halkadaki **YERİNİ** değiştiriyordu | okunan sıra `p1>p2>p3>p4>p5>__ten__` → `p1>p5>p4>p3>p2>__ten__`, gergi **SONDA kaldı** |
| `veFeadWizRouteMove('__ten__', ±1)` `indexOf < 0` ile **erken dönüyordu** | 3. adımdaki gerginin ok düğmeleri etkin görünüp hiçbir şey yapmıyordu |

**ÖLÇÜLDÜ** (AG00976, elle kurulmuş — yani sırasında `'__ten__'` olmayan
model): kayış boyu `1714,61 → 2459,29 mm` (+%43,4), gerginlik
`543,85 → 323,41 N` (−%40,5). Model **yine "çözülüyor"**du; kapanma ve
temizlik ihlalleri hoşgörülü kipte UYARI olarak düşüyor, hata olarak değil.

Örnek kurucusundan gelen modellerde sıra `'__ten__'` taşıdığı için bu kusur
**görünmüyordu** — yalnız kullanıcının elle kurduğu modelde ısırıyordu.

Çözüm iki sırayı **birleştirmek**: iki işlem de OKUNAN sırayı alıp geri
yazıyor. `veFeadWizRoute` yalnız eksikse eklediği için bu yazma **birim
işlemdir** ve seedlenmiş durumu değiştirmiyor (testli). Düzeltmeden sonra
elle kurulmuş modelde de `L` ve `T` **6 hane birebir** sabit, `warnings` boş.

> **BİR İDDİA ÖLÇÜLDÜ VE ÇÜRÜTÜLDÜ.** Aynı turda *"sihirbaz `veFeadAnalyze`'ı
> hiç çağırmadığı için ters yönde gerilme zinciri çöküyor ama yedi adım da
> yeşil kalıyor"* diye bir bulgu çıktı. Ölçüldü: iki örnek × iki yön =
> **dört kombinasyonun dördünde de** `tensionerSide` `{ok:true}` ve
> `build.warnings` boş. Yani bastırılan bir hüküm YOK. Sihirbaz `veFeadAnalyze`'ı
> gerçekten çağırmıyor ve bu bilinçli: çağrı başına 5–13 ms, canlı yolun
> bütçesi ise 6 ms (zarfın genel taraması zaten 84 ms olduğu için memo var).
> Gergi tarafı hükmü kurulmuş modelde Kayış Yolu kartından ve Çözücü
> panelinden veriliyor; sihirbaz yalnız kuralı **yazıyor** ("otomatik gergi
> kayışın gevşek tarafında olmalıdır — 14 Gates sisteminin 14'ünde de öyle").

###### 4 · KİLİT `readonly`, `disabled` DEĞİL

Kullanıcı *"değerler değiştirilmemeli"* dedi, *"görünmesin"* değil. `disabled`
bir alan gri boşluk gibi okunur ve içindeki SAYI kaybolmuş görünür; `readonly`
sayıyı okunur bırakıp yalnız yazmayı reddediyor.

**İSTEĞİN İKİNCİ YARISI BEDAVA** (*"'elle gir'e tıklayınca önceki seçtiği
gergi değerleri gelmeli"*): "elle gir" künyeyi UYGULAMIYOR, yalnız `tenLib`i
boşaltıyor — son seçilen künyenin yazdığı sayılar olduğu gibi kalıyor.
Alanları temizlemek isteğin tam tersi olurdu ve mutasyonla kilitlendi.

**KİLİTLENEN KÜME `veFeadTensionerApply`'ın YAZDIĞI kümedir**, ikinci bir liste
değil: künye bir alan daha yazmaya başlarsa o alan sessizce açık kalmasın.
**MONTAJ KONUMU ASLA KİLİTLENMEZ** — motorun verisi, parçanın değil.

**ÖLÇÜLDÜ (gerçek tarayıcı):** künye yokken kilitli alan **0**; `AG00879`
seçilince **6** ve `armLen` `56` **readonly**, `pivotX` readonly DEĞİL;
"elle gir" seçilince kilit **0** ve `armLen` yine **56**.

###### 6 · KAYIŞ ADIMI TEK ÇIKTI — ama SORULMAYAN ≠ TAŞINMAYAN

| Kalkan | Neden |
|--------|-------|
| Künye (tip/kod · tolerans · aşınma) | üçü de kayış SEÇİLDİKTEN sonra anlamlı; Kayış Özellikleri panelinde aynen duruyor |
| Malzeme (kaburga başına kütle) | yalnız açıklık frekansı için — o da kayış tipine bağlı bir çıktı, yani zaten kapalı |
| "Kayış Tipine Bağlı Çıktılar" seçicisi | iki seçenekli bir kip DEĞİL artık: kayış boyu tek çıktı, katalog sabitleri KAPALI |

`veFeadWizNodes` artık **koşulsuz** `beltDataMode: 'none'` yazıyor: seçenek
sunulmuyorsa kurulan model kipi açık bırakamaz (eski bir taslakta `full`
yazılı kalmışsa sessizce taşınırdı).

**VERİ KAYBOLMUYOR ve bu ayrı bir kapı:** örnekten gelen `beltType` ·
`tolerance` · `wearPct` · `massPerRibKgM` kayış düğümüne **taşınmaya devam
ediyor** — kullanıcının *"otomatik olarak gelsin"* isteği tam olarak bu.
Sorulmayan alan ile taşınmayan alan ayrı şeyler; ikincisi kullanıcının
verisini sessizce yutardı.

###### 7 · İKİ SESSİZ KUSUR — biri hizada, biri kapıda

**(a) SÜTUNLAR KAYIYORDU** ve sebebi tek bir CSS satırıydı: `.ve-fw-ro`
sınıfı `display:inline-block` taşıyordu ve sınıf hem `<span>` hem `<td>`
üzerinde kullanılıyor. Bir `<td>`'yi `inline-block` yapmak onu tablo
düzeninden **ÇIKARIR** — tarayıcı anonim hücre kurar, sütunlar çöker.
**ÖLÇÜLDÜ** (çalışma çevrimi tablosu, 7 sütun): başlık genişlikleri
`196·196·196·69·113·88·14` iken gövde `196·196·196·14·14·14·113` çıkıyor, yani
üç kW hücresi tek sütuna sıkışıyor ve satır silme ✕'i **"Klima Kompresörü"
başlığının altına** düşüyordu. Kullanıcının bildirdiği *"Klima kompresörü
sütununun altında satırları silen çarpılar"* tam olarak buydu. `display`
kuralı `span.ve-fw-ro`'ya daraltıldı; ölçüldü, sekiz sütunun sekizinde de
başlık↔gövde farkı **≤1 px**.

**(b) GÜÇ KAPISI YANLIŞ KAPIYDI.** `_fwKwEff` çözülmüş bir `sys` istiyordu,
yani **bütün koordinatlar girilmeden** aksesuar modeli seçmek tabloyu
değiştirmiyordu. Oysa aksesuar devri geometriye BAĞLI DEĞİL — çekirdeğin kendi
tanımı:

```
oran(i) = driveRatio · rPitch(sürücü) / rPitch(i)
```

Üç sayının üçü de ÇAPTAN ve kayış profilinden geliyor; teğet noktası, sarım
açısı, kol açısı hiçbiri girmiyor.

Köprüye `veFeadRatioSys` girdi: **oran için yeterli, geometri için yetersiz**
bir sistem. `FEADCore.accessoryRpm`'in okuduğu ÜÇ alanı taşır (`driveRatio` ·
`pulleys[i].rPitch` · `_crkIdx`) ve başka hiçbir şeyi. **FİZİK
KOPYALANMIYOR:** yarıçapı çekirdeğin kendi `beltProps` + `radiiFromOD`'si
veriyor, devri yine çekirdeğin `accessoryRpm`'i okuyor. Çap ya da profil
eksikse `null` döner — uydurulmuş bir yarıçap, uydurulmuş bir devir ve
uydurulmuş bir kW demekti.

**`out.sys` VARSA `ratioSys` ONA EŞİTLENİR:** çözülmüş model tek bir gerçek
kaynak taşımalı, yoksa iki yol sessizce ayrışırdı.

**PANEL DE AYNI YOLDAN GEÇİYOR** (`veFeadDutyEditor`): kapı orada da
`build.ok` idi ve yarım modelde tabloda **hiç kW sütunu** olmuyordu.

**İKİ "değer yok" TEK ETİKETE KATILMAZ:** oran kurulamıyorsa `cozumsuz`, oran
kurulu ama katalog/eğri yoksa `yok` — ikincisi gerçekten 0 kW ile koşacağını
söylüyor.

**ÖLÇÜLDÜ:** koordinatsız iki kasnaklı modelde `prestolite_180a` seçilince
`1000 d/dk → 5.79 kW` (model çözülmüyor, `b.ok === false`); gerçek tarayıcıda
klima modeli seçilince duty okuması `2.70 → 1.74 kW`.

###### 8 · GİRDİLER TOPOLOJİYE ULAŞIYOR — uçtan uca ölçüldü

Kullanıcı *"aksesuar tiplerini seçtikten sonra, topoloji üzerindeki bileşen
üzerinden bu aksesuarın tipini vs göreyim"* dedi. Zincir gerçek `createNode`
sözleşmesiyle koşturuldu: **10 bileşen · 6 tel**, `accPreset` düğüme yazılıyor
**ve bileşenin kendi panelindeki "Katalog Modeli" kartında `selected`
görünüyor**; gergi TEK koordinat taşıyor (`cenX/cenY` **yok**); duty kW
sözlüğü `wz-*` → kanvas kimliğine göçüyor (kalıntı bir anahtar SESSİZ 0 kW
demekti); kurulan modelin çözümü önizlemeyle **birebir** (`L` ve `T` 6 hane).

Çevrim kaydının izi (`dutyLib`) de artık taşınıyor — hesaba girmiyor, ama
kullanıcının hangi ölçülmüş kaydı seçtiğini söyleyen tek yer o
(`structural-materials.js`'in `lib`/`libVer` izinin aynı gerekçesi).

Kapı **27 mutasyonla** ölçüldü, 27'si de kırmızı: yön seçimini bayrağa çevirme ·
aynı yönü seçmeyi de çevirtme · 2. adımın yön kartını düşürme · yön
okunamazken düğmeleri açma · CW'yi amber yapma · satırda tipi yine künye
seçicisi yapma · ad yer tutucusunu sabitleme · kilidi kaldırma · "elle gir"e
değerleri sildirme · montaj konumunu da kilitleme · kayış kipini yine seçim
yapma · Künye kartını geri koyma · kayış künyesini düğüme taşımama · kW'ı yine
`build.ok`'a bağlama · `ratioSys`i hiç kurmama · `ratioSys`i çözülmüş
sistemden ayırma · bilinmeyen profilde yarıçap uydurma · `accPreset`i düğüme
taşımama · üç CSS sınıfını tek tek düşürme · çevirmeyi ve taşımayı yine HAM
sıraya bağlama · çevirmede ilk ögeyi de çevirme · çipi AD hücresinde bırakma ·
çipi tamamen silme · gergi adını palet adına döndürme.

###### BEŞ DÜZELTME — üçüncü kullanıcı turu (2026-08-31)

Kozmetik istekler; ama ikisinin altından **ölçülmüş birer kusur** çıktı ve
biri de bu turda üretilmiş bayat bir CSS kuralıydı.

| # | İstek | Ne yapıldı |
|---|-------|------------|
| 1 | *"'örnekten doldur'… seçtiğimiz seçeneğin belirgin olmasını istiyorum"* | Yüklenen kart **gölge + sol şerit + "✓ yüklendi"** |
| 2 | *"'otomatik gergi' olmamış… diğerleri gibi yapalım… 'X/Y = montaj noktası' gibi garip belirteçlere gerek yok"* | Künye seçicisi 4. adıma taşındı, çip kalktı, satır diğerleriyle **birebir** |
| 3 | *"'kayış yolu' kısmında CCW ve CW butonlarına gerek yok"* | Kalktı; "⇄ Yönü çevir" ve canlı şeritteki yön okuması duruyor |
| 4 | *"alternatör tiplerini seçtiğimde tablo… yana çekiliyor"* | Sabit sütun düzeni |
| 5 | *"'çevrim' seçtiğim zaman sayfa en tepeye atıyor"* | Kaydırma konumu aynı adımda korunuyor |

###### 1 · KART "YÜKLENDİ" DER, "SEÇİLİ" DEMEZ

Kart bir seçim kutusu değil bir **EYLEM** düğmesi: formu dolduruyor ve
kullanıcı sonra her alanı değiştirebiliyor. *"Seçili"* demek formun hâlâ o
örneğe EŞİT olduğunu iddia etmek olurdu — kütüphane bunu bilmiyor (duty
seçicisindeki *"özel"* okumasının aynı gerekçesi).

**RENK YERİNE GÖLGE + ŞERİT:** üç kart da eşit meşru, dolu bir vurgu rengi
birini *"birincil eylem"* gibi gösterirdi. İz `st.seededFrom`'da ve **çözüme
girmiyor** — düğüm verisinde hiçbir yerde geçmiyor (testli). *"Boş başla"* da
bir seçimdir ve işaretleniyor.

###### 2 · SATIR DİĞERLERİYLE BİREBİR — ve bilgi KAYBOLMADI

Künye seçicisi satırdan kalktı, 4. adımda AYNEN duruyor: aynı kaydı yazan bir
kontrolü iki yüzeyde birden sunmanın karşılığı yoktu. Amber çip de kalktı.

**AMA UYARI KALDIRILMADI, YER DEĞİŞTİRDİ.** Kasnak merkezi ↔ montaj noktası
karışması bu modülün en pahalı sessiz hatası (gerginlik **−%48,6**, sarım en
kötü **+%27,9**, model YİNE çözülür ve uyarı çıkmaz). Bilgi iki yerde:
X/Y alanlarının kendi `title` ipucunda ve tablonun altındaki kartta, ölçülmüş
bedeliyle birlikte. Kapı ikisini birden arıyor — yoksa bir gün
*"sadeleştirme"* diye tamamen silinirdi.

**ÖLÇÜLDÜ (gerçek tarayıcı):** satırın sütun hizası tutuyor ve **yükseklik
farkı 0 px** — iki katmanlı tip hücresi + çip satırı şişiriyordu.

###### 4 · SÜTUNLAR İÇERİKTEN DEĞİL ORANDAN

**ÖLÇÜLDÜ:** aksesuar modeli seçilince açılır listenin genişliği
**362 → 283 px**. Sebep `table-layout` varsayılanının **auto** olması:
*"Güç kaynağı"* hücresi `kayıtlı ölçüm` iken kısa, `katalog modeli · Valeo
TM31` iken uzun ve aradaki farkı Model sütunundan çalıyor. Tablo bir seçimle
yeniden bölüşüyordu — kullanıcının gördüğü *"yana çekilme"* buydu.

`table-layout:fixed` + oranlı `colgroup` bunu yapısal olarak kapatıyor.
Açılır listenin kendi `min-width`'i sabit düzeni ezeceği için sıfırlanıyor.
**ÖLÇÜLDÜ (sonra):** başlık genişlikleri `297·314·262` ve açılır liste
`306 px` — seçimden önce ve sonra **birebir aynı**.

###### 5 · KAYDIRMA AYNI ADIMDA KORUNUR, ADIM DEĞİŞİNCE SIFIRLANIR

`veFeadWizRender` içindeki `body.scrollTop = 0` **KOŞULSUZDU**. O satır adım
değişiminde doğru — yeni adım baştan okunur — ama aynı adımı yerinde yeniden
çizerken (çevrim seçmek, aksesuar modeli seçmek, temas tarafını değiştirmek)
kullanıcıyı bulunduğu yerden koparıyordu. **ÖLÇÜLDÜ:** `scrollTop` 900 → **0**;
düzeltmeden sonra gerçek tarayıcıda **548 → 548**, adım değişiminde **0**.

**KONUM SAKLANMIYOR, OKUNUYOR.** İlk yazımda adım başına bir bellek
(`_fwScroll`) tutuluyordu ve mutasyon onu **yeşil geçirdi**: yazılıyor, hiçbir
yerden okunmuyordu — bu deponun kendi adıyla andığı **ölü veri** sınıfı.
Gövde elemanı yeniden çizimler arasında aynı kaldığı için `scrollTop`'u
kendisi taşıyor. **Kırpma şart:** içerik kısaldıysa (satır silindi, kart
kalktı) eski konum artık yok ve tarayıcı sessizce dibe yapıştırır.

###### AYNI TURDA ÇIKAN BAYAT KURAL

`.ve-fw-tip-ten` **iki kez** tanımlıydı: bir önceki turun iki katmanlı hücresi
için yazılmış `display:flex` kuralı, satır düz metne dönünce geride kalmıştı.
Aynı sınıfa iki farklı düzen dayatan bir kural sessiz kalır — hücre hizasız
görünür, hata çıkmaz. Kullanılmayan `.ve-fw-sub` ile birlikte silindi ve kapı
artık kuralın **tek kez** tanımlı olmasını arıyor.

Kapı **20 mutasyonla** ölçüldü, 20'si de kırmızı: kaydırmayı yine koşulsuz
sıfırlama, adım değişiminde konumu koruma, kırpmayı kaldırma, seçili kart
işaretini düşürme, işareti her karta verme, seed izini yazmama, "Boş başla"
izini yazmama, izi düğüm verisine sızdırma, sabit tablo düzenini kaldırma,
colgroup oranlarını 100'den kaydırma, satıra künye seçicisini geri koyma,
X/Y ipucunu düşürme, kart ipucundan ölçülmüş bedeli silme, Kayış Yolu'na
CCW/CW'yi geri koyma, beş CSS kuralını tek tek düşürme.

**Sırada:** kullanıcı kayışı seçtikten sonra katalog sonuçlarını geri almanın
akışı (bugün Kayış Özellikleri panelinden elle yapılıyor); ve zarf çözümünün
Sonuçlar sayfasında kanal olarak yayını.



**Sırada:** Sonuçlar sayfasında FEAD çözüm sekmesi (kanal yayını).

#### Yapısal Analiz — `js/cp-structural.js` (Geometri + Ağ DOLU, kalan ikisi iskelet)

Dördüncü modül. Zincirin **ilk iki bileşeni çalışıyor** — Geometri (STEP içe
aktarma + 3B görüntüleyici) ve Hesaplama Ağı (yüzey yeniden-mesh + TetGen →
tet10) — ve Geometri'ye asılı **Malzeme ve Özellikler** alt bileşeni de
çalışıyor; kalan iki panel hâlâ iskelet ve ayrı oturumlarda doldurulacak.
`_strPending` kuralı orada duruyor: panel boş ama SESSİZ değil.

```
Geometri → Hesaplama Ağı → Sınır Koşulları → Sonuçlar
   │
   └── Malzeme ve Özellikler   (ALT bileşen — zincirin halkası değil)
```

**Zincir PORTLARLA zorlanır, yorumla değil:** `str-geometry` girişi 0,
`str-results` çıkışı 0 → kullanıcı zinciri ters kuramaz. İlk açılışta zincir
**kurulu ve bağlı** gelir (diğer üç modül yalnız "Başlangıç" kartı koyar; onların
alt topolojisi değişken, bunun ki sabit — tam bir Geometri, bir Ağ, bir Sınır
Koşulları, bir Sonuçlar, ve Geometri'ye asılı bir Malzeme. Seçim yok, o yüzden
boş tuval bırakmanın karşılığı yok).

##### Kapsam ölçümle belirlendi — iki kural

Aynı konsol kiriş (200×20×10 mm, çelik, 1000 N) saf JS'te üç eleman tipiyle:

| Eleman | DOF | Süre | Hata |
|--------|----:|-----:|-----:|
| 2D lineer üçgen (CST) | 410 | 23 ms | **−17,96 %** |
| 2D kuadratik (Q8) | 330 | 13 ms | −0,35 % |
| 3D lineer tet (tet4) | 27 783 | 14,7 s | **−24,0 %** |

1. **ELEMAN KUADRATİK (tet10).** tet4 ile 28 bin serbestlik derecesinde bile
   cevap %24 yanlış — ve hep **rijit** tarafa, yani güvenli tarafa değil. Kontur
   grafiği kusursuz görünür; hata gözle yakalanmaz.
2. **YAKINSAMA GÖSTERİLMEK ZORUNDA.** Tek bir FEA sonucu bir sayı değil bir
   kanaattir. Rapor yakınsama eğrisini basmadan hüküm veremez.

##### Mesh boru hattı — darboğaz TetGen DEĞİL

TetGen 1.6.1 native derlenip ölçüldü: küpte hacim **tam 1000,000000 mm³**, ters
tet 0, sınır işaretçileri korunuyor. `-o2` **doğrudan tet10** üretiyor (orta
düğümleri biz eklemiyoruz). Kalite reçetesi `-pq1.4/20 -O9 -o/150//2.5` →
min dihedral **7,58°**, `<10°` kuyruğu **%0,01**. (`-q<radius-edge>/<min-dihedral>`
kısa yardımda yazmıyor, kaynaktan çıkarıldı.)

**`predicates.cxx` MUTLAKA `-O0`** — Shewchuk'un kesin aritmetiği terimlerin
yeniden sıralanmamasına dayanır; iyileştirme açılırsa TetGen **sessizce
geçersiz** ağ üretir (TetGen'in kendi `CMakeLists.txt`'i uyarıyor).

Asıl darboğaz **OCCT'nin RENDER tessellation'ı**: min açı 2,81° (küp) — ve
parametreyi sıkmak **iyileştirmiyor, BOZUYOR**: 2,50° → **0,14°**, tet
11,8 bin → **1,32 M**. Altı gerçek CAD parçasında ham besleme denendi: **biri
hiç çözülemedi** (yüzey kendi kendini kesiyor), MAINBODY_BACK'te 11 bin üçgen
**834 bin tete** patladı. Araya **yüzey yeniden-mesh'leme** adımı şart; prototip
küpte 2,50° → **11,96°** yaptı (su geçirmez, hacim sapması %0,035).

##### Sınır koşulu CAD YÜZÜNE bağlanır, ağ düğümüne değil

Zincir uçtan uca ölçüldü ve ayakta:
`occt brep_faces` → `TetGen facetmarkerlist` → çıktı `trifacemarkerlist`.
Yüzey yeniden bölünse bile kimlik korunuyor. Ağ düğümüne bağlansaydı, yakınsama
çalışması için ağ her yenilendiğinde bütün sınır koşulları düşerdi — ve yakınsama
çalışması bu modülde **zorunlu** (yukarıdaki 2. kural).

##### Lisans — TetGen AGPL, MFSim MIT

TetGen AGPL-3 veya WIAS'tan ticari lisans. Karar: **kaynak MIT kalır, dağıtılan
build AGPL-3** (MIT tek yönlü uyumlu; telif hakkı kullanıcıda olduğu için
optikonalite korunur).

##### AĞIR VARLIKLAR GÖMÜLÜR — çevrimdışı çalışmak ŞART

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

##### Geometri — STEP içe aktarma (`js/structural-model.js` + `cp-structural-viewer.js`)

Zincirin ilk bileşeni. FEAD'deki üç katmanın aynısı:

| Dosya | Katman | Kural |
|-------|--------|-------|
| `vendor/opencascade.*` | Hesap çekirdeği | **Dışarıdan geldi, birebir durur** (npm `opencascade.js@1.1.1`, LGPL-2.1). `fead-core.js` ile aynı kural |
| `js/structural-model.js` | Köprü (DOM'suz) | Ham occt çıktısı → MFSim modeli; yüz kimliği, sınır kutusu, hata çevirisi |
| `js/cp-structural-viewer.js` | Sunum (THREE) | Kanvas, kamera, yüz vurgusu. Kalıp `cp-mount-viewer.js` |
| `js/cp-structural.js` | Sunum (HTML) | Panel, dosya alma, künye. **Kendi geometrisini hesaplamaz** |
| `js/structural-materials.js` | Katalog (DOM'suz) | 112 malzeme / 16 aile + arama. **Sunum katmanında tek bir malzeme değeri yazılı değil** |

###### ÇEKİRDEK DEĞİŞTİ — okuyucu değil, boolean'lı OCCT (2026-08-25)

Kullanıcı bildirimi: *"bir braket parçasını eklediğim zaman '7 ayrı katı/kabuk'
olarak algılamışsın… onu tek bir katı olarak algıla, yani otomatik boolean
olsun. Yoksa ağ örme işleminde problem yaşıyorum."*

Eski çekirdek (`occt-import-js`) **salt okuyucuydu** — dışa verdiği üç fonksiyon
`ReadStepFile` / `ReadIgesFile` / `ReadBrepFile`, boolean YOK. Ve bunun ucuz bir
çaresi de yok: değen ama AYRI duran katıların yüzey üçgenlemesi arayüzde
uyuşmuyor (**ÖLÇÜLDÜ**, as1-tu-203: 18 katının her biri kendi içinde su
geçirmez, 32 çift sınır kutusunda örtüşüyor, ama 1 800 köşeden yalnız **204**'ü
ortak) — yani üçgenleri tek tampona yığmak bir tet ağ örücüsü için hâlâ kendi
kendini kesen girdi demek. Uyumlu arayüz ancak **B-Rep seviyesinde imprint &
merge** ile kurulur.

Bedeli ÖLÇÜLDÜ ve kullanıcı kabul etti:

| | gzip | gömülü (base64) | tek dosya |
|---|---:|---:|---:|
| `occt-import-js` (eski, salt okuyucu) | 3,09 MB | 3,96 MB | 12,6 MB |
| **`opencascade.js@1.1.1`** (boolean + STEP + mesh) | **13,1 MB** | **17,5 MB** | **26,8 MB** |
| 2.x modüler toolkit seti (aynı yetenek) | 15,5 MB | — | daha kötü |

2.x'in modüler derlemesi hem daha büyük hem de dinamik yan modüllerle geliyor
(tek blob gömme kalıbımıza uymaz); 1.1.1 **tek** glue + **tek** wasm.

**Boru hattı** (`_sgOcctPipeline`, tek fonksiyon — worker'a `toString()` ile
gidiyor, ikinci kopya YOK):

```
STEPControl_Reader → katıları topla
  → BRepAlgoAPI_Fuse (TEK BOP: arguments=ilk, tools=geri kalanı)
  → ShapeUpgrade_UnifySameDomain   (iç duvarlar + dikişler silinir)
  → BRepMesh_IncrementalMesh → yüz başına üçgen aralığı
```

**ÖLÇÜLDÜ (gerçek OCCT):**

| girdi | sonuç | union |
|---|---|---:|
| 3 değen kutu | 3 → **1 katı**, 6 yüz | 119 ms |
| plaka + 2 kulak (3 gövde) | 3 → **1 katı**, 10 yüz | 64 ms |
| **plaka + 2 kulak + 4 göbek (7 gövde)** | 7 → **1 katı**, 18 yüz (ham 30) | **135 ms** |
| as1-tu-203 montajı (18 katı, cıvatalar delikten geçiyor) | 18 → **1 katı**, 104 yüz | 15,5 s |

Yani çok gövdeli bir **PARÇADA** birleştirme fark edilmiyor; saniyeler ancak
gerçek bir **MONTAJDA** görülüyor. Hacim sapması as1-tu-203'te `%0,00002`.

**Hacim farkı bir HATA DEĞİL, BİLGİ.** Birleşim hacmi gövdelerin toplamından
küçükse gövdeler üst üste biniyordu (örnek brakette **%6,1** — göbekler
plakanın içine giriyor). Panel bunu ayrı bir cümleyle yazıyor; "gövdeler yalnız
değiyordu" ile "örtüşüyordu" birbirinden ayrı okunuyor.

**Boolean BAŞARISIZ olursa panel SESSİZ KALMIYOR:** "N ayrı katı — birleştirilemedi
(sebep); ağ örerken sorun çıkarabilir". "1 katı" deyip geçseydi kullanıcı bunu
ancak ağ örerken, anlaşılmaz bir hatayla öğrenirdi.

**İki sessiz kayıp — ikisi de kapatıldı:**

| Ne | Eski çekirdek | Yeni çekirdek |
|---|---|---|
| Parça adı / rengi | STEP ürün adından geliyordu | birleştirmeden sonra anlamsız → ad **dosya adından** |
| OCCT'nin kendi teşhisi | kendiliğinden `print`'e düşüyordu | **düşmüyor** (ölçüldü: bozuk dosyada 0 satır) → `PrintCheckLoad` açıkça çağrılıyor |

**Yeni bir aşama var:** `reader · parse · fuse · build`. `fuse` yalnız dosyada
birden çok katı varsa görülür ve worker'dan bildiriliyor — 15 saniye boyunca
"Geometri çözümleniyor" yazmak ilerleme göstergesinin var oluş sebebini yok
ederdi. `download` aşaması KALKTI (aşağıda).

**.wasm UYGULAMAYA GÖMÜLÜ — çevrimdışı çalışır.** `js/structural-occt-wasm.js`
(gzip+base64, **17,5 MB**; ham 62,8 MB) uygulamanın içinde taşınıyor ve **ilk**
içe aktarmada talep üzerine çalıştırılıyor (`type="text/x-mfsim-asset"` →
açılışta ne tarayıcı ne `MFSimLoader` dokunur; `js/mount-report-assets.js` ile
aynı kalıp). Üretim: `npm run build` (build:occt-wasm'ı kendisi koşturur).

**İLK İÇE AKTARMANIN BEDELİ ARTTI — ÖLÇÜLDÜ (gerçek tarayıcı):** 62,8 MB'lık
wasm'ın derlenmesi **7,8 s** (JS heap 226 MB, wasm heap 64 MB). Bu oturumda
**bir kez** ödeniyor; sonraki içe aktarmalar çekirdeği hazır buluyor. Worker'da
koştuğu için arayüz bu sırada da yaşıyor, ve ilerleme kartındaki geçen süre
sayacı akıyor.

**ÖLÇÜLDÜ (gerçek tarayıcı):**

| senaryo | okuyucu | içe aktarma sırasında ağ isteği |
|---|---|---|
| Tek dosya, ağ açık | `(gömülü)` ✓ | yalnız `blob:` worker URL'i |
| Tek dosya, **ağ kesik** | `(gömülü)` ✓ | **hiç yok** |
| **`file://`** (indirilmiş dosya) | `(gömülü)` ✓ | yalnız `blob:` |
| Modüler (geliştirme) | `(gömülü)` ✓ | kendi iki dosyası |

**gzip ŞART:** ham base64 62,8 MB'ı **83,8 MB**'a çıkarırdı; `gzip -9` ile
13,1 MB → base64 **17,5 MB**, yani beşte bir. Açma `DecompressionStream('gzip')`
ile ve **worker'da** — 17,5 MB'lık dizgiyi ana iş parçacığında çözmek saniyelik
bir donma demekti, yani kaçındığımız şeyin ta kendisi.

**`vendor/opencascade.wasm.gz` depoda KALIYOR** (ham 62,8 MB depoya konmaz) ve
CI onu `_site/vendor/`'a kopyalıyor — iki sebeple: gömülü varlığın kaynağı ve
LGPL-2.1'in *"kütüphane değiştirilebilir olmalı"* koşulunun karşılığı.

**AĞDAN İNDİRME YEDEĞİ KALKTI.** Eskiden gömülü varlık okunamazsa `vendor/`'dan
indirilirdi; tek gerekçesi `DecompressionStream` bilmeyen tarayıcıydı. Ama
vendor dosyası artık ZATEN gzip'li, yani o tarayıcıda yedek de açılamazdı —
var olmayan bir durumu kurtaran bir yol taşımanın karşılığı yoktu. Onunla
birlikte `download` aşaması, `Content-Length` tahmini ve aday-yol araması da
gitti. **Üretilen varlık artık git'e dahil değil:** `npm run build` her
seferinde vendor'dan üretiyor, yani "vendor güncellendi ama varlık üretilmedi"
diye bir bayat durum HİÇ oluşamıyor (eskiden bunu bayt-bayt bir test kolluyordu).

**Worker glue'yu da AĞSIZ alıyor:** vendor script etiketi `data-mfsim-occt-glue`
ile işaretli; tek dosya sürümünde içerik orada INLINE durduğu için köprü
`textContent`'ten okuyor (`type` javascript olmadığından tarayıcı onu
çalıştırmaz, `MFSimLoader` kopyasını çalıştırır → yer tutucunun metni yerinde
kalır). Emscripten'in kendi yol tahminine (`document.currentScript.src`) hiç
güvenilmiyor: tek dosyada o alan **yoktur**.

**EN KRİTİK ÖZELLİK — yüz kimliği ağ inceliğinden BAĞIMSIZ.** Sınır koşulu CAD
yüzüne bağlanacak, yakınsama çalışması ise ağı defalarca yenileyecek; kimlik
incelikle değişseydi her yenilemede bütün sınır koşulları düşerdi. **ÖLÇÜLDÜ**
(`as1-tu-203.stp`, üç incelik): `4688 → 4408 → 2456` üçgen, **160 yüz ve aynı
kimlikler**. Kimlik `m<mesh>/f<yüz>` (`veStrFaceKey`). İkinci değişmez: yüz
aralıkları üçgenleri **boşluksuz ve örtüşmesiz** böler — `first`/`last` anlamı
sessizce kayarsa (0↔1 tabanlı, kapsayan↔kapsamayan) geometri kusursuz görünür
ama yüz seçimi YANLIŞ üçgenleri toplar.

**Birim çevrimi occt'de doğru, regex'le OKUNMAZ.** Aynı küp mm/inch/metre ile
yazılmış üç dosyada da 1000,0000 mm çıkıyor — sessiz 25,4× hatası yok. STEP
başlığından birimi regex ile okuma **denendi ve bırakıldı**: `cube-m.step`
hiçbir `SI_UNIT(...METRE)` kalıbına uymuyor.

**Künye HAFİF** (`veStrGeomRecord`): ne üçgen ne STEP kaynağı girer. `node.data`
her `saveState()`'te derin kopyalanıyor ve alt-topolojiye gömülüyor. Üçgenler
oturumluk önbellekte (`window.veStrGeometryCache`, `_strForgetResults`'tan
temizleniyor — Takoz/FEAD tuzağının aynısı); zaten TÜRETİLMİŞ veri, yakınsama
çalışması için ZATEN farklı inceliklerde yeniden üretilecek.

###### STEP kaynağı node.data'da DURMAZ — ölçülmüş bir hatanın düzeltmesi

İlk sürüm kaynağı `node.data.geometry.source`'a yazıyordu. **ÖLÇÜLDÜ (gerçek
tarayıcı) ve bu bir hataydı — üstelik dosya yalnız 140 KB'ken:**

| | kaynak künyede | oturumluk depoda |
|---|---:|---:|
| `saveState()` süresi | 2,17 ms | **0,12 ms** |
| 20 adımlık undo yığını | 3,14 MB | **184 KB** |
| künye boyutu | 155,8 KB | **8,0 KB** |

Sebep: `saveState()` bütün `node.data`'yı `JSON.parse(JSON.stringify(...))` ile
kopyalıyor ve yığın **50 adım** tutuyor (`js/state.js` `MAX_UNDO_STEPS`). 3 MB'lık
bir kaynakta bu ~150 MB yığın demekti. **İkinci ve daha sessiz sorun:** otomatik
yedek `localStorage`'a yazılıyor (kota ~5-10 MB, `js/settings.js`) ve aynı
temizleyiciden geçiyor — çok MB'lık bir kaynak yedeği SESSİZCE bozardı, ki
`simResults`'ın oraya hiç yazılmama sebebi tam olarak budur.

Artık kaynak oturumluk depoda (`veStrSrcSet/Get/Clear`) ve **yalnız proje
DOSYAYA kaydedilirken** enjekte ediliyor (`veStrSrcAttach`, `js/toolbar.js`
`veSaveTopology`); yüklenirken geri toplanıyor (`veStrSrcHarvest`). Dosyaya
gzip+base64 gider — STEP metni ~4,6–5,3× sıkışıyor, base64'ten sonra net kazanç
**~4×** (ölçüldü). Sınır SIKIŞTIRILMIŞ boyuta konuyor
(`VE_STR_SRC_STORE_LIMIT` = 8 MB ≈ 30 MB ham STEP), çünkü dosyaya giden o.

**`veStrSrcAttach` KOPYALA-YAZ olmak ZORUNDA** ve ilk hâli değildi: yerinde
yazıyordu, ama `veSanitizeNodesSubtopology` (topology.js) hiçbir şey
değişmediyse AYNI diziyi döndürüyor ("gereksiz kopya üretme"). **ÖLÇÜLDÜ:**
kaynak canlı `tab.state`'e sızıp otomatik yedeğe de giriyordu — yedek 9,9 KB
yerine **46,4 KB**, yani düzeltmenin tamamı boşa çıkıyordu. Artık dokunulan her
düğüm kopyalanıyor; canlı duruma tek bir yazma bile yapılmıyor.

**ÖLÇÜLDÜ (gidiş-dönüş):** as1-tu-203 içe aktarılıp kaydedilince dosya
10,0 → 46,5 KB (+36,5 KB sıkıştırılmış kaynak), yedek 9,9 KB ve kaynaksız;
yüklenince kaynak depoya dönüyor ve geometri **4688 üçgen / 160 yüz** olarak
yeniden üretiliyor.

###### Kanvas rozeti — parça yüklü mü, kaç CAD yüzü var

Zincirin ilk halkası boşsa gerisi de boştur; ama Geometri kutusu kanvasta dolu
ile boş arasında hiç fark göstermiyordu. `veStrApplyBadge` (FEAD rozetiyle aynı
kalıp ve aynı gerekçe: stil ELEMANIN ÜSTÜNDE, çünkü `css/styles.css`'e dokunmak
Ölçüm Görüntüleyici'nin dağıtım dosyasını bayatlatıyor). Boşken **`STEP`**
(nötr), doluyken **`⬡160`** (amber) + künye başlığı. Boşken de rozet VAR:
"rozet yok" ile "parça yok" ayırt edilemezdi. Üç yerden tazeleniyor —
`ui-core.js` (düğüm kurulumu), `state.js` (geri yükleme), `topology.js` (sekme
yükleme) — FEAD rozetinin bağlı olduğu üç noktanın aynısı.

###### Panel parça YÜKLÜYKEN büyür — görüntüleyici boşluğu yutar

Kullanıcı bildirimi (2026-08-22): *"Daha geniş bir pencere olsun, genişlettikçe
de [görüntüleyicinin altındaki boşluk] kapansın."* **ÖLÇÜLDÜ (gerçek tarayıcı,
1600×1000, as1-tu-203):** pencere 980×900, sol ray 830.6 px, görüntüleyici
540 px → parçanın **altında 290.6 px boşluk**, ve pencere ekran genişliğinin
ancak **%61**'i. İçerik ayrıca kaydırıyordu (905 > 865).

Düzeltme **iki parçalı ve ikisi de gerekli**: pencere büyüyor
(`.ve-properties--strgeom`: `min(1560px, 96vw)` × `94vh`) **ve** görüntüleyici
artan boyu yutuyor (grid `align-items:stretch`, sağ sütun flex sütunu, kutu
`flex:1`). Yalnız birincisi yapılsaydı **boşluk BÜYÜRDÜ**.

| | önce | sonra |
|---|---:|---:|
| Pencere | 980 × 900 | **1536 × 940** |
| Görüntüleyici | 699 × 540 | **1202 × 831** (alan **2,65×**) |
| Altındaki boşluk | 290.6 px | **0** |
| İçerik kaydırıyor mu | evet (905 > 865) | **hayır** |

**Sınıf yalnız parça YÜKLÜYKEN veriliyor** (`node.data.geometry`, cp-core.js) —
motor panelindeki `--engine-empty` kuralının aynısı: boşken sağ sütun tek
satırlık bir yer tutucu, 94vh'lik pencere bomboş açılırdı.

Kutunun ölçüsü **satır içinde değil sınıfta** (`.ve-str-vwr-box`): satır içi bir
`height` özgüllükte sınıfı ezer ve boşluğu sessizce geri getirirdi. Sol ray
**sabit 300 px** — `--wideright` oranı (0.6fr) 1560 px'te rayı 396 px yapıyordu,
yani görüntüleyiciden çalıyordu. Ray kendi içinde kaydırır (sayfanın tamamı
kaydırılsaydı görüntüleyici de ekrandan çıkardı) ve **CAD yüz listesi artan boyu
yutar** (`max-height:180px` tavanı kalkar).

Kapı iki katmanlı: Node tarafı flex zincirinin **her halkasını** arıyor (üç
mutasyonla ölçüldü — `align-items:stretch` kaldırma, kutuya satır içi `height`
geri koyma, sınıfı koşulsuz verme), gerçek ölçüm ise E2E'de
(`structural-geometry.spec.js`): sol ray ile kutunun **aynı yerde bitmesi**,
kanvasın gerçekten o ölçüde kurulması (ResizeObserver), içeriğin kaydırmaması.

###### Üç varsayılan kullanıcı isteğiyle değişti (2026-08-22)

| Ne | Eski | Yeni |
|---|---|---|
| CAD yüz listesi + fare künyesi | panel açılınca **oradaydı** | **kapalı**, tek anahtarla açılır |
| Görüntü ağı inceliği | üç kademeli seçici (varsayılan Orta) | seçici **yok** — hep **İnce** (`VE_STR_MESH_LINEAR = 0.0005`) |
| "Kenarlar" aç/kapa kutusu | var | **yok** — kenarlar hep açık |

Ortak gerekçe: üçü de kullanıcının dokunmadığı, panelde yer kaplayan ayarlardı.
İncelik kademesini kaldırmanın bedeli ölçüldü ve küçük: as1-tu-203'te üçgen
`4 408 → 4 736`, kullanıcının braketinde `4 902 → 5 572` — ve **yüz kimlikleri
incelikten bağımsız** olduğu için sınır koşulları bundan hiç etkilenmiyor.

**Yüz inceleme kipi TEK ANAHTAR, İKİ YÜZ:** liste ile 3B künyesi aynı kipin iki
görünümü (`_veStrFaceMode`, oturumluk — seçimle aynı gerekçe: bir görünüm
tercihi undo yığınına binmemeli). Ayrı ayrı açılsalardı "liste açık ama parçada
bir şey görünmüyor" gibi yarım durumlar çıkardı. Kapanınca **ekranda hiçbir
işaret kalmaz** — vurgu, seçim ve künye üçü de silinir; yarısı duran bir kip
kapalı sayılmaz. Kanvasın alt şeridi de kipe bağlı: kapalıyken "parçanın üstüne
gel → CAD yüzü" yazmak yalan olurdu.

Kip kapalıyken görüntüleyici **raycast bile yapmıyor** (`onHover` erken çıkış) —
kazanç yalnız görsel değil, kare başına bir ışın taraması.

Liste DOM'da hep duruyor, yalnız gizli: 240 satırı her açılışta yeniden kurmak
(ve kaydırma konumunu kaybetmek) bir görünüm anahtarının bedeli olamaz, ayrıca
satır işaretleyicisi (`_strFaceMarkRow`) satırların DOM'da olmasına dayanıyor.
Anahtar paneli **yeniden çizmiyor**: `showNodeProperties` çağrılsaydı 3B kanvas
da yeniden kurulur, kamera ve sahne baştan yüklenirdi.

###### CAD yüz listesi — Sınır Koşullarının doğrudan hazırlığı

3B'de fareyle yüz bulmak keşif için iyi ama 160 yüzlü bir montajda "hangi yüzü
seçtim / hangileri var" sorusuna cevap vermiyor. Panelde (kullanıcı açınca)
kaydırılabilir liste var ve **liste ile 3B TEK seçimi paylaşıyor**: listeden tıkla → parçada
vurgulanır, parçada tıkla → listede işaretlenir ve görünüre kaydırılır, fareyle
gez → listede `hover`. Aynı satıra ikinci tık seçimi kaldırır (başka yolu yoktu).

**Gezinme vurgusu ile seçim AYRI katman** (`hl` / `sel`): tek katman olsaydı
fare parçadan çıkınca seçim de silinirdi — oysa seçim, sınır koşulunun
bağlanacağı şey.

**Seçim rengi tema jetonundan DEĞİL, sabit magenta.** Parça rengi STEP
dosyasından geliyor (occt `mesh.color`) ve her şey olabilir; **ÖLÇÜLDÜ:**
as1-tu-203'te plaka MAVİ ve seçim `--accent-primary` (mavi) iken vurgu
görünmüyordu. Liste satırı da aynı magentayı kullanıyor — iki farklı renk "iki
ayrı şey seçili" gibi okunurdu.

**Döndürme seçimi bozmuyor:** hareketsiz sol tık seçer, 4 px'i aşan hareket
döndürmedir. Eşik olmasaydı her döndürme sonunda seçim kayardı.

Seçim OTURUMLUK (`node.data`'ya yazılmıyor): bir vurgu tercihi her
`saveState()`'te undo yığınına binmemeli. Sınır Koşulları kendi kalıcı bağlarını
kuracak — kimlik zaten künyede duruyor.

**Ağ inceliği FEA ağı DEĞİL** — OCCT'nin RENDER tessellation'ı, yalnız
görüntülemek ve yüz aralıklarını kurmak için (min açı 2,81°, sıkmak BOZUYOR;
yukarıda ölçülü). Artık sabit (`VE_STR_MESH_LINEAR`), panelde seçici yok.

**OCCT'nin kendi teşhisi kullanıcıya ULAŞIYOR.** Kütüphane `"Line 2: Incorrect
syntax: unexpected QUID, expecting STEP"` gibi tam sebebi yazıyor ama varsayılanda
bu `console`'a düşüyor ve kullanıcı yalnız "dosya okunamadı" görüyordu;
`print`/`printErr` yakalanıp mesaja iliştiriliyor (`_sgWithDiag`, en fazla iki
satır).

###### Çözümleme WORKER'da — arayüz donmuyor

STEP çözümlemesi ana iş parçacığında koşarsa arayüz **kilitlenir**, ve donma
yalnız çirkin değil YANILTICI: kullanıcı programın çöktüğünü sanıp sekmeyi
kapatır. Ölçüt "hızlı mı" değil, **arayüzün yaşıyor olması** — dürüst ölçüsü
içe aktarma boyunca çizilen KARE SAYISI.

**ÖLÇÜLDÜ** (gerçek tarayıcı, `as1-tu-203.stp`, okuyucu önceden ısıtılmış ki
ölçüm indirmeyi değil çözümlemeyi görsün):

| ağ | | süre | çizilen kare | en uzun donma |
|---|---|---:|---:|---:|
| 20 296 üçgen | ana iş parçacığı | 469 ms | **1** | — |
| | worker | 803 ms | **50** | 22 ms |
| 45 240 üçgen | ana iş parçacığı | 1665 ms | **1** | — |
| | worker | 1497 ms | **91** | 19 ms |

45 bin üçgende eski yol 1,7 saniye boyunca **tek bir kare** çiziyor. Worker'da
süre de kısalıyor (sonuç kopyalanmıyor, transfer ediliyor).

Worker **Blob'dan** kuruluyor: glue metni + boru hattının kaynak metni
(`_sgOcctPipeline.toString()`) + `VE_STR_WORKER_BRIDGE` tek Blob'a yazılıp
`new Worker(blobURL)` ile açılıyor → hiçbir dosya yolu varsayımı yok, ve ana
iş parçacığı yedeği ile worker **aynı fonksiyonu** koşuyor (iki kopya tutulsaydı
ayrışma sessiz olurdu: worker yolu çalışırken yedek yol başka bir geometri
üretirdi). Boru hattı bu yüzden dışarıdan hiçbir şeye başvurmuyor — testi bunu
da kolluyor. Üçgenler **tipli dizi olarak
transfer** ediliyor (sıfır kopya). Worker açılamazsa (CSP, eski tarayıcı) ana
iş parçacığı yedeğine düşülüyor ve panel bunu **yazıyor** — "hiç açılmadı" ile
"donarak açıldı" arasında dağlar kadar fark var.

###### Yükleme göstergesi PARÇAYI anlatır, kütüphaneyi değil

Kartın **ana satırı dosyanın adıdır**; aşama alt satırda geçer. Bir ara sürümde
kart "STEP okuyucusu indiriliyor" diyordu ve kullanıcı haklı olarak itiraz etti:
okuyucunun hazırlanması bir **uygulama ayrıntısı**, kullanıcının beklediği şey
parçanın işlenmesi.

Aşamalar (`VE_STR_STAGES`): `reader` (yalnız ilk içe aktarmada, gömülü .wasm
açılıp derlenirken — **ağ yok**) · `parse` (geometri çözümleniyor) · `build`
(sahne kuruluyor). Dördüncü aşama `download` **normalde HİÇ GÖRÜLMEZ**; yalnız
gömülü varlık okunamazsa (`DecompressionStream` yok) yedek yolda çıkar ve tek
**belirli** (%) aşama odur.

Belirsiz aşamalara uydurma bir yüzde koymak — "%60" deyip 8 saniye beklemek —
yalan olurdu; orada akan çubuk + **geçen süre sayacı** var. Sayacın akması,
"program çalışıyor" diyen en ucuz ve en dürüst işaret; ve worker sayesinde
gerçekten akıyor.

**Yedek yolda `Content-Length` GÜVENİLMEZ — ölçüldü.** Hem `npx serve` hem
GitHub Pages `.wasm`'ı `content-encoding: br` + `transfer-encoding: chunked`
ile gönderiyor; o durumda başlık tarayıcıya **hiç gelmiyor**
(`headers.get('content-length')` → `null`). Toplam bu yüzden
`VE_STR_OCCT_WASM_BYTES` sabitinden geliyor (`fetch` gövdeyi saydam açtığı için
okunan baytlar açılmış baytlardır); sabit dosyayla kaymasın diye test **gerçek
dosya boyutuna kilitliyor**, ve tahmin tutmazsa (`loaded > total`) yüzde
gösterilmiyor — %140 yazan bir çubuk, çubuk olmamasından kötüdür.

**Fare vurgusu bir süs değil, zincirin KANITI:** vurgulanan şey üçgen değil CAD
YÜZÜ (`veStrFaceOfTriangle`). Sınır Koşulları bileşeni yüz seçerken AYNI
çeviriyi kullanacak.

**ÖLÇÜLDÜ (gerçek tarayıcı):** `rounded-cube.step` → 64 üçgen · 7 CAD yüzü ·
10×10×10 mm · 684 ms; fareyle `m0/f3` yüzü (2 üçgen) vurgulanıyor.

**ÖLÇÜLDÜ — GERÇEK PARÇA (kullanıcının braketi, AP242 / 3DEXPERIENCE, 378 KB).**
Fixture'lar AP203/214; **AP242 de sorunsuz okunuyor**:

| incelik | üçgen | CAD yüzü | kimlikler | süre |
|---|---:|---:|---|---:|
| Kaba (0,01) | 4 836 | 240 | — | 648 ms |
| Orta (0,002) | 4 902 | 240 | aynı | 505 ms |
| İnce (0,0005) | 5 572 | 240 | aynı | 485 ms |

7 katı · 131,00 × 150,82 × 131,76 mm · yüz aralıkları üçgenleri **tam bölüyor**.
Parça adı dosyada BOŞ — künye `Parça N` yedeğine düşüyor (normalize'da yazılı).
Kaynak sıkıştırma bu dosyada 6,6× (base64 sonrası net **4,9×**).
Dosya kullanıcının kendi parçası → **depoya eklenmedi**, yalnız ölçüm için
kullanıldı; fixture'lar occt-import-js'in kendi açık test dosyaları.

###### Bileşen bırakma alanı ölçüm kaplamasını devralır (`data-ve-dropzone`)

`js/measure-dropzone.js` dinleyicileri `document` üzerinde ve **bubble**
evresinde. Geometri'nin STEP bırakma alanı `stopPropagation()` çağırınca oradaki
`drop` işleyicisi **hiç çalışmıyor** → `veImpDropShow(false)` çağrılmıyor →
ölçüm kaplaması ekranda **ASILI kalıyor**, program kilitlenmiş görünüyor. İkinci
sorun daha sinsi: kullanıcı .step sürüklerken kaplama "ölçüm dosyasını bırakın"
diyerek **yanlış hedefi** gösteriyordu.

Çözüm tek yerde: `data-ve-dropzone` taşıyan bir alanın üstünde kaplama kendini
çeker ve sayacı sıfırlar (`veImpLocalZone` / `veImpYieldToLocal`); alandan
çıkılınca `dragenter` onu geri getirir — kendi kendini düzeltir. Ağ ve Sınır
Koşulları bileşenleri de kendi alanlarını böyle kuracak.

**ÖLÇÜLDÜ (gerçek tarayıcı, öncesi/sonrası):** alan üzerindeyken kaplama açık
`ESKİ true → YENİ false`; **bıraktıktan sonra** kaplama açık
`ESKİ true → YENİ false`. Genel davranış korunuyor (alan dışında kaplama yine
açılıyor). `measure-dropzone.js` ORTAK dosya → `npm run sync:viewer` yapıldı.

##### Malzeme ve Özellikler — Geometri'ye asılan ALT bileşen (`str-material`)

Zincirin halkası **değil**, Geometri'nin **eki**: içe aktarılan parçaya malzeme
atar. "Alt bileşen" olduğu iki YAPISAL işaretten okunuyor, yazıdan değil:

| İşaret | Değer | Neyi imkânsız kılıyor |
|--------|-------|-----------------------|
| **Çıkışı YOK** (`outputs: 0`) | kutu bir yaprak | "Geometri → Malzeme → Ağ" diye yanlış bir zincir kurulamaz |
| **Kutu küçük** (50×46 ↔ zincirin 62×56) | bakışta hiyerarşi | — (aksesuarların Motor'a asılırkenki 54×50 kalıbı) |

**Geometri'nin GİRİŞİ AÇILMADI** ve bu bilinçli: malzeme ekini girişten
beslemek zincirin başını kaybettirir (`str-mesh` çıkışı Geometri'ye
bağlanabilirdi). Bunun yerine Geometri **ikinci bir ÇIKIŞ** aldı:
`output-0` (SAĞ) = analiz zinciri, `output-1` (ALT) = malzeme eki. Tek porta
iki tel de bağlanabilirdi (bir port çok bağlantı taşıyor) ama ikisi **aynı
ağızdan** çıkardı ve alttaki kutuya giden tel sağa çıkıp geri dönerdi.

**Eski kayıtlar göç İSTEMİYOR — ölçüldü.** Geometri tek çıkışlıyken kaydedilmiş
projelerde bağlantı `fromPort: 'output'` taşıyor ve o ad artık yok; ama çizici
`vePortOffset` üzerinden onu da sağ kenarın ortasına koyuyor: yeni `output-0`
ile sapma **0,00 px** (gerçek tarayıcı). Tel yerinden oynamıyor.

**Geometri'nin ADI SOLA alındı** — zevk değil, ölçülmüş bir çakışmanın
düzeltmesi. Malzeme teli alt porttan **dümdüz** iniyor (yatay sapma 0,00 px) ve
ad varsayılan yerinde tam onun altında ortalıydı → tel adın üstünden geçiyordu,
yani projenin kendi yerleşim kuralının ihlali. Dört seçenek ölçüldü:

| Ad konumu | Tel adı kesiyor mu | Rozet/zincir çakışması |
|-----------|--------------------|------------------------|
| bottom (varsayılan) | **evet** | — |
| top | hayır | **STEP rozeti adın üstünde** |
| right | hayır | **ad zincir telinin üstünde** |
| **left** | hayır | yok ✓ |

###### Çözücünün gerçekten istediği şey — ve eksik olanın NEYİ engellediği

Lineer elastik tet10 için gereken tam liste kısa: **E ve ν**. Geri kalanı ayrı
sorulara cevap veriyor, o yüzden hepsi tek "zorunlu" torbasına atılmadı —
`errors` çözümü DURDURUR, `warns` yalnız bir yeteneği kapatır:

| Alan | Yoksa |
|------|-------|
| E, ν | **ÇÖZÜM YOK** (rijitlik matrisi kurulamaz) |
| ρ | öz ağırlık / kütle / modal kapalı |
| σ_akma | gerilme basılır, **emniyet payı hükmü verilemez** |
| σ_çekme | kopma payı (bilgi) |
| α | ısıl yük (ileride) |

Hepsi tek torbaya atılsaydı ρ'suz bir model "çözülemez" ilan edilirdi — oysa
öz ağırlıksız bir gerilme çözümü geçerli bir analizdir.

###### ν < 0,5 bir zevk meselesi değil, TEKİLLİK

`K = E / (3(1−2ν))`; ν → 0,5'te payda sıfıra gider, K → ∞. Yer değiştirme
temelli standart elemanlarda bu rijitlik matrisinin koşullanmasının bozulması
demek: **ν = 0,5 tam tekillik**, **ν > 0,49 hacimsel kilitlenme** — çözüm koşar,
sayı çıkar ve sonuç sistematik olarak **FAZLA RİJİT** olur. Yani gözle
yakalanmayan, güvenli tarafta OLMAYAN bir hata: modülün tet4 ölçümünde
(%24 rijit) belgelenen sınıfın aynısı. ν ≥ 0,5 **reddediliyor**, 0,49–0,5
**uyarılıyor**, ve türetilen K o aralıkta sayı üretmiyor (`null`).

###### SESSİZ BİRİM TUZAĞI: ρ

Modülün birim sistemi **mm · N · MPa**; o sistemde kütle birimi **TON**, yani
yoğunluk **ton/mm³**: çelik 7850 kg/m³ = **7,85e-9 ton/mm³**. 7850'i doğrudan
yazmak kütleyi **10¹² kat** büyütür — çözüm yine koşar, öz ağırlık altında parça
"erir". Panel kg/m³ soruyor (kullanıcının bildiği birim), çevrimi kendisi yapıyor
ve **çevrilmiş değeri panelde yazıyor** — kimse hangi sayının çözücüye gittiğini
tahmin etmek zorunda kalmasın. FEAD'deki `wearPct` oran↔yüzde tuzağının aynısı.

###### Bağ TELDEN okunuyor, ikinci bir "hedef seç" alanı yok

`veStrMatHost` malzeme kutusuna gelen teli izleyip `str-geometry` düğümünü
buluyor. Panelde ayrı bir hedef alanı tutulsaydı tel ile alan sessizce
ayrışırdı (FEAD'de panel ile kartın AYNI alanı okuması kuralının aynısı).
Üç durum da AÇIKÇA yazılı: bağlı değil / bağlı ama parça yok / parça künyesi.
"Bağlı değil" sessiz bırakılsaydı kullanıcı malzemeyi girer, kaydeder ve çözücü
onu hiç görmezdi.

###### Rozet AMBER yalnız çözülebilir kayıtta

Adı yazılmış ama E'si girilmemiş bir malzeme "hazır" görünmemeli. Boşken de
rozet **var** (`MALZ`) — Geometri rozetindeki gerekçenin aynısı: "rozet yok" ile
"malzeme yok" ayırt edilemezdi. Adsız ama E girilmiş kayıt `210 GPa` okur.

**ÖLÇÜLDÜ (gerçek tarayıcı, başlangıç topolojisi):** beş bileşen kuruluyor,
Geometri 62×56 / Malzeme 50×46, teller `output-0→Ağ` ve `output-1→Malzeme`,
malzeme telinin **yatay sapması 0,00 px** (alt kenar → üst kenar), Malzeme'nin
DOM'da **0 çıkış portu**, elle bağlama iki yönden de aynı bağlantıyı kuruyor,
S355JR girilince G **80.769,2 MPa** · K **175.000,0 MPa** · ρ **7,850e-9 ton/mm³**,
alt topolojiden çıkıp geri girince kayıt ve tel aynen duruyor, konsol hatası
**yok**.

###### Malzeme kütüphanesi — `js/structural-materials.js` (112 kayıt / 16 aile)

Katalog AYRI DOSYADA ve DOM'suz: panel (`cp-structural.js`) onu yalnız
**gösteriyor**, tek bir malzeme değeri sunum katmanında yazılı değil. FEAD'deki
üç katmanın (çekirdek / köprü / sunum) aynı ayrımı.

| Aile | Kayıt | Aile | Kayıt |
|------|------:|------|------:|
| Yapı çelikleri (EN 10025) | 9 | Nikel alaşımları | 5 |
| Islah/sementasyon (EN 10083/10084) | 12 | Bakır alaşımları | 6 |
| Yay çelikleri (EN 10089) | 3 | Titanyum | 3 |
| Paslanmaz (EN 10088) | 10 | Magnezyum | 3 |
| Dökme çelik (EN 10293) | 4 | Diğer metaller | 4 |
| Dökme demir (EN 1561/1563/1562/16079) | 11 | Polimerler | 15 |
| Alüminyum — dövme (EN 755/485) | 11 | Elastomerler | 5 |
| Alüminyum — döküm (EN 1706) | 5 | Seramik ve cam | 6 |

**KATALOG BİR SERTİFİKA DEĞİL** ve panel bunu listenin ÜSTÜNDE yazıyor
(altında değil): değerler standardın **nominal** değerleri, gerçek bir dökümün
muayene belgesi değil. Nominal değeri ölçülmüş değer sanmak bu modülün en pahalı
sessiz hatası olurdu. Hepsi **20 °C** içindir.

**Kayıt KOPYA olarak gidiyor, referans olarak değil.** Kütüphane sürümü
değişip bir değer düzeltilse bile kaydedilmiş proje **kendiliğinden değişmez**;
`lib` + `libVer` yalnız İZ bırakıyor. Bir katalog güncellemesinin kaydedilmiş
bir analizi sessizce değiştirmesi, bu projenin en çok kaçındığı hata sınıfı.

**REFERANS alanlar (λ, c_p) kayda GEÇMİYOR.** Çözücü onları kullanmıyor; düğüme
kopyalamak ileride "bu sayı nereden geldi, güncel mi" sorusunu doğuran ölü veri
olurdu. Panelde soluk basılıyorlar ve etiketleri *(ref.)* diyor.

###### Aynı malzeme ÜÇ ayrı adla anılıyor — arama bunun üstüne kurulu

Sahada aynı çelik `1.4301`, `X5CrNi18-10` ve `AISI 304` olarak geçiyor; aradaki
fark çoğu zaman yalnız **ayıraç** (`1.4301` ↔ `1,4301` ↔ `14301`). Arama üç
katmanlı ve her katman ayrı bir soruya cevap veriyor:

| Katman | Ne yapar | Neyi çözer |
|--------|----------|------------|
| `veStrMatFold` | Türkçe → ASCII katlama | `toLowerCase()` TEK BAŞINA YETMEZ: JS'te `'I'.toLowerCase()` → `'i'` (Türkçe'de `'ı'`), `'İ'` → birleşik noktalı `i`. Katlama olmadan "ISLAH" ve "İNCONEL" hiç bulunmuyordu |
| `veStrMatKey` | ayıraçları **atar** | `1.4301` = `1,4301` = `14301` |
| `veStrMatTokens` | ayıraçlardan **böler** | `"304"` araması `AISI 304`'ü getirir, `AISI 304L`'yi değil |

Son satır ölçülmüş bir düzeltme: parça eşleşmesi eklenmeden önce ikisi de aynı
puanı alıyor, eşitliği alfabetik sıra bozuyor ve **304L, 304'ten önce**
geliyordu. Puanlama kademeli (tam ad 100 · parça 90 · başlangıç 80/70 ·
içerme 50/40 · standart-kategori 20).

**`alt` TEKİL, `fam` PAYLAŞILAN.** Kapı gerçek bir çakışma buldu: `AL995`
(alümina seramik) ile `Al99,5` (saf alüminyum) ayıraçlar atılınca **aynı
anahtara** iniyordu — ρ 3890 ↔ 2710, yani birbirinin yerine geçmesi sessiz ve
ciddi bir hataydı. Aile/atölye terimleri (`sfero`, `pik döküm`) ise bilerek
paylaşılıyor ve `fam` alanında; tekillik kapısı yalnız `alt`'a bakıyor.

###### Katalog kendi kısıtlarını KAYITTA taşıyor

Kütüphaneden seçilen hiçbir malzeme "çözülemez" bir kayıt üretemez (testli,
112 kaydın hepsi). Ama üç sınıf, çözümün **geçerli olmadığını** söylemek
zorunda ve söylüyor:

| Sınıf | Kayıt ne diyor |
|-------|----------------|
| Elastomer (5) | ν → 0,5 → hacimsel kilitlenme; hiperelastik. **Bu çözücü için uygun değil** — kauçuk takoz için Takoz modülü |
| Gri dökme demir + seramik + cam | **Akma göstermez** (σ_ak `null`, 0 değil); basma ≫ çekme ya da Weibull dağılımı → von Mises hükmü yanıltır |
| PTFE, kurşun | Oda sıcaklığında **sürünür**; lineer elastik çözüm yalnız anlık cevabı verir |

`sy: null` ile alanı **hiç koymamak** farklı: kayda yazılmadığı için
`veStrMatValidate` "akma dayanımı yok, emniyet payı hükmü verilemez" uyarısını
üretiyor — yani kısıt kaydın kendisiyle birlikte taşınıyor.

###### Kapı ölçümle kuruldu, tahminle değil

Sayılar ölçülemez (standart değerleri); **tutarlılıkları** ölçülebilir ve
`tests/unit/structural-materials.test.js` beş katmanda onu ölçüyor. En sıkı
kapı türetilen **G = E/2(1+ν)**'nün sınıf penceresine düşmesi: ν 0,30 yerine
0,03 yazılırsa E ve ρ doğru kalır, ν aralık kontrolünden de geçer (0,03 < 0,5)
— yalnız G pencereden çıkar. On mutasyonla ölçüldü, onu da kırmızı.

###### Panel İKİ SÜTUN — ve sağ sütun SEÇİLENİ gösterir, uygulananı değil

Solda katalog (ara · süz · liste), sağda **Malzeme Özellikleri**. "Hangi
malzemeler var" ile "bu malzemenin özellikleri ne" ayrı iki soru ve ikincisi
birincisine bakarken görünmek zorunda.

**ÖNCE BAK, SONRA UYGULA.** Kullanıcı bildirimi (2026-08-24): *"malzeme
kütüphanesinden malzeme seçtiğim zaman 'Uygulanan Malzeme' penceresi üzerinden
malzeme özellikleri görünmüyor. 'Parçaya Uygula' dediğim zaman görünüyor."* —
yani **uygulamak, bakmanın ön koşuluydu**. Artık liste satırına tıklamak
yeterli: bütün özellikler, künye ve üç diyagram anında sağ sütunda.

Karar TEK YERDE (`veStrMatShown`), çünkü paneli çizen yer ile sıcaklık
değerlendiricisini tazeleyen yer AYNI kaydı görmek zorunda; ikisi ayrı
hesaplasaydı sıcaklık satırı önizlemede başka bir malzemeyi anlatırdı.

| Durum | Gösterilen | Alanlar | Alt şerit |
|-------|-----------|---------|-----------|
| Katalogdan **seçili**, uygulanmamış | katalog kaydı | **salt okunur** | **Parçaya Uygula** |
| Seçili = uygulanmış (değişmemiş) | düğümün kaydı | düzenlenebilir | ✓ uygulanmış |
| Seçim yok, kayıt var | düğümün kaydı | düzenlenebilir | — |
| Elle değiştirilmiş kayıt yeniden seçildi | katalog kaydı | salt okunur | Parçaya Uygula (yeniden) |

**Önizlemede alanlar SALT OKUNUR** ve şerit "ÖNİZLEME — henüz uygulanmadı"
diyor. İkisi de gerekli: düzenlenebilir bıraksaydık yazının gideceği bir yer
olmazdı, şerit olmasaydı dolu görünen alanlara bakan kullanıcı uyguladığını
sanırdı. Önizleme düğüme **tek bir alan bile yazmıyor** (testli).

Katalog künye kartı SOL sütundan **kalktı** — aynı sayıları iki kez basmak
olurdu ve dar sütunda listeden yer çalıyordu.

**Tarama durumu OTURUMLUK** (arama metni, seçili kategori/kayıt): `node.data`'ya
yazılsalardı her tuş vuruşu undo yığınına binerdi ve "geri al" malzemeyi değil
arama metnini geri getirirdi. Arama listeyi **yerinde** tazeliyor, paneli değil
— panel yeniden çizilseydi arama kutusu DOM'dan silinir ve odak her harfte
kaybolurdu.

**İZ ÜÇ DURUM anlatıyor** ve üçü farklı şey söylüyor: katalogdan geldi ve
değişmedi / katalogdan geldi ama **elle değişti** (ad artık kaydı anlatmıyor) /
hiç katalogdan gelmedi.

**ÖLÇÜLDÜ (gerçek tarayıcı):** 112 kayıt global olarak yükleniyor, panel
1180×880 ve **kaydırmıyor**, liste 112 satır + **16 aile başlığı**, `1.4301`
yazınca sonuç 1'e iniyor ve **odak arama kutusunda kalıyor**, `X5CrNi18-10`
uygulanınca kayıt `E 200000 · ν 0,3 · ρ 7900 · σ_ak 210 · σ_ç 520 · α 16` +
`lib/libVer` izi, rozet **amber `X5CrNi18-10`**, listede uygulanan satır
işaretli, G **76.923** · K **166.667** · ρ **7,900e-9 ton/mm³**.

> **Aile başlığı sayısı ölçümle düzeldi:** boş sorgu düz alfabetik sıralanırken
> 16 aile için **30 başlık** basılıyordu — aileler birbirinin içine giriyor,
> yapışkan başlık her birkaç satırda değişiyor ve katalog gezilemez oluyordu.
> Arama YOKKEN sıra aileye göre; arama VARKEN başlık hiç basılmıyor, çünkü
> orada sıra puana göre ve başlık koymak sırayı yalanlardı.

**Rozet uzun katalog adlarını kırpmadan önce ayıklıyor:** ham kısaltma
`EN AW-6082 T6` → `EN AW-608…` veriyordu ve bu **başka bir alaşım numarası**
gibi okunuyor. Standart öneki (`EN `, `EN-`) ve parantez içi atılıyor →
`AW-6082 T6`, `AC-43000 T6`, `GJS-500-7`. Tam ad ipucunda.

###### Genişletilmiş veri — sıcaklık · yorulma · sertlik (kullanıcı isteği 2026-08-24)

*"Tipik Ansys'teki gibi"* istendi: sıcaklığa bağlı değerler, Wöhler eğrileri,
sertlik. Katalog üç MODEL katmanıyla genişletildi. Ortak ilke: sayıları
uydurmak yerine **standardın modelini** kurmak ve modelin sınırını sonucun
İÇİNDE taşımak.

| Katman | Ne | Kaynak |
|--------|-----|--------|
| `VE_STR_MAT_TEMP_SETS` (12 eğri) | k_E(θ), k_Y(θ), k_P(θ) | EN 1993-1-2 Tablo 3.1 · EN 1993-1-2 Ek C · EN 1999-1-2 + 8 tipik seyir |
| `VE_STR_MAT_FAT_SETS` (13 takım) | σ_W = f_W·R_m, Basquin k, diz N_D, ikinci eğim k₂ | FKM Richtlinie (8) + 5 tipik |
| Kayıt başına | HB / HV / Shore D / Shore A · uzama A% · azami servis °C | standart + el kitabı |

**MALZEME BAŞINA DEĞİL SINIF BAŞINA EĞRİ.** S235 ile S355 aynı k(θ) eğrisini
paylaşır; azalan şey mutlak dayanım değil, 20 °C değerine ORAN. 112 kayda 112
eğri yazmak hem yanlış hem bakımsız olurdu.

**İKİ AYRI GÜVEN DÜZEYİ VE PANELDE AYRI AYRI YAZILI:** `tur:'std'` bir
standardın TABLOSU, `tur:'tipik'` el kitabının SEYRİ. Ayrım gizlenseydi
kullanıcı ikisini aynı ağırlıkta okurdu — kataloğun "nominal ≠ sertifika"
kuralının sıcaklık tarafındaki karşılığı. Testi hangi eğrinin hangi sınıfta
olduğunu SABİTLİYOR: bir el kitabı eğrisini sessizce `'std'`ye yükseltmek
üstteki genel testten GEÇİYORDU (mutasyonla ölçüldü).

**k_Y 400 °C'ye kadar 1,000 KALIR ve bu doğrudur.** EN 1993-1-2'nin k_Y'si %2
gerinimdeki ETKİN akma dayanımı; elastik sınır çoktan düşmüştür ve onu k_P
anlatıyor (200 °C'de 0,807, 400 °C'de 0,420). Yalnız k_Y basılsaydı kullanıcı
"400 °C'ye kadar hiçbir şey olmuyor" diye okurdu — ikisi birden basılıyor.

**ALÜMİNYUMUN GERÇEK DAYANMA SINIRI YOKTUR.** S-N eğrisi dizden sonra da
düşer (`k2`), o yüzden "sonsuz ömür" bölgesi ÇİZİLMEZ; çelikte çizilir.
Yataylık gösterilseydi olmayan bir güvenlik anlatılmış olurdu.

**MODELİN GEÇERLİLİK SINIRI ÇİZİMDE.** Basquin doğrusu geriye uzatılınca R_m'yi
aşar (S355: σ_a(10³) ≈ 840 MPa, R_m 470) — orası düşük çevrimli yorulma
bölgesi ve model orada geçerli DEĞİL. Eğri R_m'de kesiliyor, kesilen bölge
grafikte taranıyor ve "LCF — model dışı" yazıyor. `f_W` ayrıca İŞLENMEMİŞ
malzeme içindir: yüzey pürüzlülüğü, boyut, çentik ve ortalama gerilme etkileri
(FKM K_WK çarpanları) DAHİL DEĞİL ve bu diyagramın altında yazılı.

**SERTLİK ÖLÇEĞİ SINIFA GÖRE:** metalde Brinell, seramikte Vickers,
termoplastikte Shore D, elastomerde Shore A. Hepsini tek sayıya indirmek
yanlış olurdu — Shore A 70 ile HB 70 aynı büyüklük bile değil. Kapı **Rm/HB**
oranını sınıf penceresinde arıyor (ISO 18265: alaşımsız çelikte ≈ 3,38; gri
dökme demirde grafit lamelleri yüzünden 1,2–1,5; titanyumda ≈ 2,8) — bir σ_ç
ya da HB ondalık kayması buradan yakalanıyor.

###### Üç diyagram — hepsi KAYITTAN türüyor

| Diyagram | Neyi anlatıyor | Sınırı |
|----------|----------------|--------|
| σ–ε | E eğimi, akma, çekme, kopma uzaması | **İdealleştirilmiş**: dört sayı gerçek, aralarındaki biçim değil |
| Wöhler (S-N) | dayanma sınırı, diz, LCF bölgesi | **Ölçülmüş değil**, FKM modeli; yüzey/boyut/çentik dahil değil |
| k(θ) | ısındığında ne kaybedilir | Kaynağı ve türü (std/tipik) etikette |

Tablodaki sayı ile diyagram **AYNI kaynaktan** besleniyor; ayrı bir veriden
çizilseydi ikisi sessizce ayrışırdı. Kapı iki şey arıyor: hiçbir koordinat
NaN/Infinity olmasın (eksik bir alan bozuk bir yol üretir ve tarayıcı onu
ÇİZMEZ, hata da vermez) ve çizilen şey kaydın anlattığıyla tutarlı olsun
(gevrekte akma çizgisi yok, alüminyumda dayanma sınırı yok).

**Sıcaklıkta Değerlendir** satırı eğriyi okumak yerine SAYIYI veriyor: θ
yazılıyor, E(θ) ve σ_ak(θ) basılıyor. Seçilen θ OTURUMLUK — bir okuma tercihi
undo yığınına binmemeli. Azami servis sıcaklığı aşılırsa uyarıyor (sürünme ve
kalıcı hasar bu modelde YOK).

**Diyagramlar yalnız KATALOG kaydında.** Elle girilen altı sayı sertlik, uzama,
sıcaklık eğrisi ve yorulma modelini üretmeye yetmez; panel bunu SÖYLÜYOR —
sessiz bırakılsaydı kullanıcı "neden grafik çıkmıyor" diye kendinde arardı.

###### Panel oranı TERSİNE çevrildi

Kullanıcı bildirimi: *"'Malzeme Kütüphanesi' kısmı çok geniş olmuş."* Katalog
listesi bir ad + bir sayıdan ibaret; genişlik ona değil diyagramlara lazım.
Sütunlar **300 px ↔ kalan her şey** oldu (ölçüldü: 300 ↔ 846 px). Liste
satırından ρ da çıkarıldı — üçüncü kolon satırı üç satıra taşırıyordu.
Uygulanan kayıt panel açılınca listede **görünür yapılıyor**: 112 satırda
ekranın dışında kalan bir ✓ hiçbir şey söylemez.

**ÖLÇÜLDÜ (gerçek tarayıcı, S355JR):** panel 1180×968 ve kaydırmıyor · sütunlar
300 ↔ 846 px · üç diyagram 401×200 ve çizgilerin hesaplanmış `stroke` değeri
gerçek renk (`none` DEĞİL — rapordaki jeton dersi) · künye `150 HBW · Rm/HB
3,13 · A %22 · 400 °C · σ_W 212 MPa · 45,2 kN·m/kg` · θ 20 → 500 yazınca
E `210.000 → 126.000` MPa ve σ_ak `355 → 277` MPa, odak kutuda KALIYOR ·
servis sıcaklığı aşılınca uyarı çıkıyor · konsol hatası yok.

Kapı **14 mutasyonla** ölçüldü, on dördü de kırmızı.

##### Hesaplama Ağı — yüzey hazırlığı + TetGen (`structural-remesh.js` + `structural-mesh-model.js`)

Zincirin ikinci halkası **DOLU**. Boru hattı üç adım:

```
OCCT tessellation  →  yüzey yeniden-mesh  →  TetGen  →  tet10
   (render ağı)        (izotropik, saf JS)    (WASM)
```

| Dosya | Katman | Kural |
|-------|--------|-------|
| `vendor/tetgen-src/*` | Hesap çekirdeği | **Dışarıdan geldi, birebir durur** (TetGen 1.6, Hang Si / WIAS, AGPL-3). `fead-core.js` ve occt ile aynı kural |
| `tools/tetgen-wasm-src/tetgen-glue.cpp` | Köprü (C++) | MFSim'in kendi kaynağı (MIT): tipli dizi girdi/çıktı, `throw <int>` → Türkçe mesaj |
| `js/structural-remesh.js` | Yüzey hazırlığı (DOM'suz) | OCCT'nin render ağını TetGen'in kabul edeceği üniform ağa çevirir |
| `js/structural-mesh-model.js` | Köprü (DOM'suz) | PLC kurar, çekirdeği çağırır, sonucu normalize eder, hata çevirir |
| `js/cp-structural.js` | Sunum | Panel + rozet + 3B görünüm. **Kendi ağını örmez** |

**TetGen'i KENDİMİZ DERLEDİK** — occt npm'den hazır `.wasm` olarak geliyordu,
TetGen için öyle bir paket YOK (npm/CDN arandı, yok). `npm run build:tetgen-wasm`
emscripten ile derliyor, `npm run build:tetgen-wasm-asset` çıkanı gzip+base64
gömüyor (**0,72 MB ham → 0,24 MB**; occt'nin 3,96 MB'ının yanında ihmal
edilebilir). İkisi de NADİREN koşar: çıktılar depoda, günlük akış (`npm run
build` / `npm test`) derleyiciye hiç dokunmaz.

**`predicates.cxx` MUTLAKA `-O0`** — Shewchuk'un kesin aritmetiği IEEE 754
yuvarlamasının TAM sırasına dayanır; optimizasyon ifadeleri yeniden sıralayıp
predikati **sessizce** yanlış yapar ve TetGen geçersiz ağ üretir. Testi var.

###### SINIR KOŞULU ZİNCİRİ AYAKTA — NATIVE OLARAK ÖLÇÜLDÜ

Modülün en kritik sözleşmesi. Sınır koşulu ağ düğümüne değil **CAD yüzüne**
bağlanacak, yakınsama çalışması ise ağı defalarca yenileyecek:

```
occt brep_faces → remesh faceIds → TetGen facetmarkerlist
                → çıktı trifacemarkerlist → yeniden m<i>/f<j>
```

Native TetGen ile ölçüldü (küpün üst yüzü 42, diğer beşi 7): çıktı sınır
üçgenlerinin işaretçisi **%100 {7,42}**, başka değer YOK. Kalite kısıtı yüzeyi
yeniden bölmeye zorlanınca (`-a5`, 12 → 232 sınır üçgeni) sonuç aynı: 194 + 38,
sıfır kayıp. Gerçek parçada da (rounded-cube) **7/7 CAD yüzü** çıktıda.

###### YÜZEY HAZIRLIĞI ŞART — ve bağımsız olarak doğrulandı

OCCT'nin ağı GÖRÜNTÜLEMEK için üretilir: min açısı ~2,8°'ye inen sliver'lar
bırakır. Onlar TetGen'e **sınır kısıtı** olarak gider (PLC kipinde TetGen sınır
üçgenlerini DEĞİŞTİREMEZ) ve etraflarını doldurmaya çalışırken patlar.

Bu tespit MFSim dışında bir kaynakta da var: aynı braket için kurulmuş bir
Python boru hattı (gmsh + pymeshfix + tetgen) aynı duvara çarpmış ve kendi
notlarına *"ağ kalitesinin darboğazı tetgen değil… kök neden yüzey onarımının
bıraktığı üçgenler… gerçekten iyileştirmek istersen yüzeyi yeniden ağla,
tetgen parametreleriyle uğraşma"* diye yazmış. `structural-remesh.js` tam olarak
o maddedir.

Botsch–Kobbelt döngüsü (böl → birleştir → çevir → düzleştir). **ÖLÇÜLDÜ**
(10 mm küp, hedef 1,2 mm, 10 paso): açık kenar **0**, anormal kenar **0**,
yüzeyden sapma **0,000e+0**, hacim **1000,0000 mm³** (sapma %0,0000),
min açı **45,00°**, 10° altı üçgen **%0,00**.

**Dört hata sınıfı ölçümle yakalandı ve dördü de testli:**

| Hata | Belirtisi | Kapı |
|------|-----------|------|
| Anlık görüntü üzerinde ikinci işlem | 888 üçgende **1220 açık kenar** | üçgen pasoda BİR kez |
| Sınır düğümünün yanlış yöne birleşmesi | hacim **%3,5** kayıyor | iç nokta sınıra birleşir, tersi ASLA |
| Bağlantı (link) koşulu yok | 9. pasoda **8 anormal kenar** | ortak komşu denetimi |
| **İçbükey dörtgenin çevrilmesi** | sapma 0 ama hacim 1000,000 → **1000,418** | alan korunumu (%2) |

Sonuncusu en sinsisi: normal denetimi onu **göremez** (normaller aynı yönde
kalır), yalnız hacim değişmezinden görünür.

**Ölçüt VALANS değil MİN AÇI.** Klasik izotropik yeniden-mesh valans eşitler;
bu modülün varlık sebebi min açıyı yükseltmek olduğu için ölçüt doğrudan odur.
Kapılar `acos` KULLANMAZ (`_rmShapeQ`, `4√3·A/(a²+b²+c²)`): üçgen başına üç ters
trigonometri iç döngüde milyonlarca kez koşuyordu — düzleştirme **11,0 s**
sürüyordu.

**Bölme EN UZUNDAN başlar.** `Object.keys` sırası geometriyle ilgisizdir;
sırasız hâlde aynı küpte min açı 45° → **17,6°**'ye düşüyor ve üçgenlerin
**%45,8'i** 10° altına iniyordu.

**Hedef kenar boyunun KATI BAŞINA TAVANI var** (kendi köşegeninin 1/8'i).
Montajın tamamı için seçilen tek sayı küçük parçalar için fazlasıyla kaba
olabiliyor: braket montajında 5,98 mm hedefle 17 mm'lik mesafe parçaları
ekranda **yuvarlak çakıl taşına** dönüyor ve hacim kaybı %5,7'ye çıkıyordu;
tavanla %3,9.

###### KESİŞME KALKANI — yerel denetimlerin göremediği üç sınıf

Kullanıcı bildirimi (2026-08-25): *"eleman boyutunun önemi yoksa, ağdan
bağımsızlık hesapları vs nasıl yapacağız?"* Haklıydı ve sorun gerçekti:
yeniden-mesh'lenmiş yüzeyi TetGen bazı hedef boylarında REDDEDİYOR, köprü de
ham yüzeye düşüp eleman boyu kontrolünü tamamen kaybediyordu.

> **ÖNCEKİ ÖLÇÜM GEÇERSİZDİ.** "Her hedef boyda kesişim üretiliyor" kaydı
> bozuk bir koşucudan geliyordu: TetGen girdisi `.smesh` uzantısı olmadan
> yazılıyor, TetGen hata verip çıkıyor, ayrıştırıcı da "0 kesişim" okuyordu.
> Uzantı düzeltilince gerçek tablo çıktı ve arıza hedef boyla **MONOTON
> DEĞİL** (h=12 ve h=5 zaten temizdi) — yani "eleman boyu kalınlıktan büyük
> olmasın" gibi bir kural bunu AÇIKLAMIYOR.

**Yeniden-mesh KALİTEDE zaten çalışıyordu** ve bu ayrım önemli: ortalama min
açı **12,5° → 41,6°**, 10° altı üçgen **%46,7 → %0,56**. Kalan *minimum*
(~3,5°) bir kusur değil, KISITIN kendisi: en kötü 200 üçgenin **170'inin üç
köşesi de bir CAD yüzü sınırında** (226 yüzün 20'si 3 mm'den dar şeritler).

Üç işlemin (birleştir/çevir/düzleştir) denetimleri **YEREL**: normal
katlanması, alan korunumu, şekil ölçütü — hepsi işlemin DOKUNDUĞU yıldıza
bakar. Hiçbiri *"bu üçgen 3 mm ötedeki karşı duvarın içinden geçiyor mu"*
diye soramaz. Kalkan (`VE_STR_REMESH_SHIELD`) düzgün bir ızgarayla o soruyu
soruyor. **Bölme kalkan DIŞINDA** ve bu bir eksiklik değil: yeni düğümü mevcut
kenarın üstüne koyduğu için yeni üçgenlerin birleşimi eskisinin TAM aynı
noktalarını kaplar, kesişim üretmesi geometrik olarak imkânsız.

**Kusur ABLASYONLA yerini buldu** (h=6): yalnız-split, split+collapse,
split+smooth, flip KAPALI ve smooth KAPALI koşularının BEŞİ de temiz; kesişim
ancak flip ile smooth BİRLİKTE koşunca doğuyor.

###### Kalkanın ÜÇ kör noktası — üçü de ölçülerek bulundu

| # | Kör nokta | Nasıl görüldü | Ölçüt |
|---|-----------|---------------|-------|
| 1 | **Köşe paylaşan çiftler tümden eleniyordu** ("komşular zaten değer") | TetGen'in h=10'da bildirdiği `[794,595] ↔ [793,597]` çifti tam da tek köşe paylaşan iki üçgene aitti | 1 ortak köşede **KARŞI KENAR**: temas meşru, gerçek kesişim ancak o köşeye komşu OLMAYAN kenar öbürünün içinden geçerse var |
| 2 | **Asılı düğüm (T-bağlantısı)** | Paso paso izlendi: 9. pasonun DÜZLEŞTİRME adımında `kenar[1915,1916] boy 3,1000 · düğüm 1924 · t = 0,5000` | Yabancı kenarın İÇİNE düşen düğüm, **iki yönde** (düğüm→kenar ve kenar→düğüm) |
| 3 | **Eş düzlemli kenar çaprazlaması** | TetGen'in kendi ölçütü ("Two segments exactly intersect"); çift doğrudan incelendi: doğrular arası uzaklık **0,000e+0**, parametreler **s=0,440 · t=0,751** | Köşe PAYLAŞMAYAN kenar çiftleri için parça–parça çaprazlama, **ortak köşe sayısına bakmadan** |

Üçüncüsü kritik bir ayrıntı taşıyor: **kenar komşusu iki üçgen de
çaprazlayabilir** — ortak kenar (a,b) iken (a,c)×(b,d) ve (b,c)×(a,d) çiftleri
köşe paylaşmaz ve yüzey keskin katlanınca gerçekten kesişirler.

**İKİ YAKLAŞIM ÖLÇÜLDÜ VE ATILDI:**

| Deneme | Sonuç |
|--------|-------|
| Asılı düğümü ONARMAK (kenarı düğümde bölmek) | h=12'de atılan üçgen **0 → 4**; durumu KÖTÜLEŞTİRİYOR |
| Köşe paylaşan çiftleri "zerre büzüp" (1e-6) Möller ile sınamak | Hile İŞE YARAMIYOR: ayrılma yönü kesişim doğrultusuyla aynı değil. Kalkanın **51.797 reddinin 51.691'i** bu yoldan geliyordu — reddin **%99,8'i asılsız**, ortalama min açı 41,6° → **29,7°** |
| Eşikle ÖNLEME (T-bağlantısı eşiğini büyütmek) | 1e-2'de meşru birleştirmeler de reddediliyor: üçgen sayısı İKİYE KATLANIYOR, min açı 3,36° → **0,01°** |

###### T-bağlantısı eşiği KALİTEYLE ödeniyor — 1e-4

Kenar çaprazlaması ölçütü eklendikten sonra gerçek kesişimleri o yakaladığı
için eşiğin gevşek olmasına gerek kalmadı; gevşekliğin bedeli ise doğrudan
kalite. **ÖLÇÜLDÜ (TetGen üç eşikte de TEMİZ, yani seçim yalnız kaliteye
bakıyor):**

| eşik | h=8 (min / ort / <10°) | h=6 | h=4 |
|---|---|---|---|
| **1e-4** | **3,956° / 38,1° / %1,24** | **3,565° / 41,6° / %0,51** | **2,746° / 43,6° / %0,27** |
| 3e-4 | 0,007° / 37,6° / %2,49 | 0,007° / 41,1° / %1,78 | 0,007° / 43,1° / %1,26 |
| 1e-3 | 0,007° / 37,4° / %2,95 | — | — |

Gevşek eşik en kötü üçgeni 4°'den **0,007°**'ye indiriyor ve o sliver'lar
TetGen'de **DEJENERE TET**'e dönüşüyordu (ölçüldü: h=12/8/6 → **54/478/103**
adet) — ki bu modülün kendi kuralına göre dejenere eleman bir uyarı değil,
çözümü durduran bir HÜKÜM. 1e-4'te ortalama kalite kalkansız tabanla
(ort 41,6° · <10° %0,56) aynı bantta.


**T-BAĞLANTISI ÖLÇÜTÜNDE KENAR KOMŞULARI MUTLAKA ELENMELİ** ve bunun sebebi
tanım gereği: bir **sliver** üçgenin üçüncü köşesi zaten karşı kenarının
üstündedir. Elenmezse her sliver kendi komşusunu asılı düğüm sanıyor ve
iyileştirici işlemleri de birlikte engelliyordu.

###### Kalkanın MALİYETİ — ölçülerek üçe bölündü

İlk sürüm toplam sürenin **%96'sıydı** (h=10, 2 paso: 44 s; sorgu başına
**486** aday). İki değişiklik:

| Değişiklik | Aday/sorgu | Süre |
|---|---:|---:|
| ilk sürüm ("büyük kova" her sorguda taranıyor) | 486 | 44,0 s |
| kutusu çok hücreye yayılan üçgeni **yayarak yazmak** | 117 | 12,6 s |
| aday başına **kutu ön elemesi** | **3** | **2,96 s** |

"Büyük kova" tasarımının neden çöktüğü ölçüldü: ham OCCT üçgenlemesinde düz
yüzeylerde 150 mm'ye varan üçgenler var (parça 131×150×131 mm), yani kova
doluydu ve her sorgu onu baştan sona tarıyordu.

###### PASO SAYISI HEDEFTEN TÜRER — dejenere tet'in GERÇEK sebebi

Kalkan ve eşik yerine oturduktan sonra bile İNCE hedeflerde dejenere tet
kalıyordu (h=3 → **2.081**, h=2 → 377) ve sebebi ikisinden de bağımsız çıktı:
**paso sayısı yetmiyordu.**

Döngünün ilk işi bölme ve bölme her pasoda kenarı yarıya indiriyor. Hedef
küçüldükçe pasoların daha çoğu boya inmeye gidiyor, geriye kaliteyi
toparlayacak paso kalmıyor.

**ÖLÇÜLDÜ (kullanıcının braketi, h=3):**

| | min açı | 2° altı | 5° altı | üçgen |
|---|---|---|---|---|
| 10 paso | 1,59° | **4** | 42 | 34.554 |
| 20 paso | **5,89°** | **0** | **0** | 32.108 |

Ve o birkaç sliver YÜZEY üçgeninin TetGen'de binlerce dejenere tet'e
dönüştüğü korelasyonla gösterildi — bir sliver yüzey üçgeni etrafında yassı
tet yelpazesi doğuruyor:

| hedef | 2° altı yüzey üçgeni | dejenere tet |
|---|---:|---:|
| 4 | 0 | **0** |
| 3 | 4 | **2.081** |
| 2,5 | 8 | 2 |
| 2 | 12 | 377 |

**Paso ARTINCA üçgen sayısı DÜŞÜYOR** (34,5 bin → 32,1 bin): fazladan pasolar
bölmüyor, birleştirip düzeltiyor — yani TetGen'in işi de azalıyor.

Formül: `ceil(log2(başlangıç ortalama kenarı / hedef))` bölme pasosu **+ 12**
kalite pasosu, 24 tavanıyla. **ÖLÇÜLDÜ** (braket, başlangıç ortalama kenarı
**15,45 mm**): h=16 → 12 paso · h=12 → 13 · h=8 → 13 · h=4 → 14 · h=3 → 15.

> **Kaba hedefte davranış BİREBİR eski DEĞİL** ve bu bilerek: taban 10'dan
> 12'ye çıktı. Bedeli ölçüldü ve kazanç yönünde — h=8'de eleman sayısı
> 43.990 → **41.772**, yüzey 2° altı üçgen zaten 0'dı ve öyle kaldı.

###### SON DURUM — dejenere eleman HER hedefte sıfır

| hedef (mm) | yüzey üçgeni | yüzey min açı | 2° altı | düğüm | eleman | SD | **dejenere** |
|---|---:|---:|---:|---:|---:|---:|---:|
| 8 | 6.110 | 3,96° | 0 | 74.828 | 41.772 | 224.484 | **0** |
| 4 | 18.772 | 3,61° | 0 | 95.950 | 52.579 | 287.850 | **0** |
| 3 | 32.220 | 5,89° | 0 | 168.681 | 94.347 | 506.043 | **0** |
| 2,5 | 46.208 | 5,95° | 0 | 244.161 | 140.548 | 732.483 | **0** |
| 2 | 72.222 | **10,02°** | 0 | 384.450 | 226.579 | 1.153.350 | **0** |

Eleman sayısı da serbestlik derecesi de **monoton** — yakınsama çalışması için
gereken kaba→ince seri artık var. h=2'de yüzeyde **10° altı üçgen bile
kalmıyor**.

**Kaba uçta hedef DOYUYOR ve bu fizik:** braket 3,1 mm sac. 12 mm'lik bir
eleman o duvarın içinden geçemez, TetGen kaliteyi tutmak için Steiner noktası
ekler ve sayı sabitlenir (h=12/8/6 → 46k/44k/40k, hatta hafif TERS). Anlamlı
yakınsama aralığı duvar kalınlığının altında başlıyor.

###### SONUÇ — on bir hedef boyunun on biri de temiz

NATIVE TetGen `-d`, kullanıcının braketi:

| hedef (mm) | 16 | 12 | 10 | 8 | 6 | 5 | 4,2 | 4 | 3,15 | 3 | 2,5 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| atılan üçgen | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| üçgen | 2760 | 3598 | 4748 | 6334 | 9832 | 13682 | 18872 | 20404 | 32118 | 35630 | 50358 |

Öncesinde h=12/10/8/6/4/3 sırasıyla 8/6/1/2/2/4 üçgen atıyordu. Köprü artık
gerçekten yeniden-mesh'lenmiş yüzeyle çalışıyor (h=12'de **59.556** eleman;
eski ham yol her hedefte **204.542**) ve eleman sayısı hedefle **monoton**
değişiyor — **yakınsama çalışması artık mümkün.**

Kapı dört mutasyonla ölçüldü, dördü de kırmızı. İki fikstür de ölçülerek
düzeltildi çünkü ilk hâlleri mutasyonu YAKALAMIYORDU: asılı düğüm fikstürü
köşe paylaşmıyordu (o durumda `_rmTriTriHit` zaten "kesişiyor" diyor), oysa
gerçek durumda asılı düğümün zincir komşusu kenarı taşıyan üçgenin köşesidir
— yani TEK ortak köşe vardır ve orada devreye giren karşı kenar ölçütü bu
yapıyı göremez.

###### NON-MANIFOLD ÜRETİLMEZ, KORUNUR, RAPORLANIR

Gerçek CAD verisinde bir kenar 2'den fazla üçgene komşu olabiliyor: OCCT
tessellation'ı temas eden/çakışan yüzeyleri aynı koordinata oturtuyor. **Bu
parçanın kendi geometrisinden gelir**, remesh'in ürettiği bir bozukluk değil —
ama bölmek onları **çoğaltır**: braket katısı 0'da 18 kenar remesh sonunda
**303'e** çıkıyordu. Artık o kenarlara hiç dokunulmuyor (sayı sabit: 26) ve
`nonManifoldEdges` olarak künyeye çıkıyor.

###### KATI BAŞINA TETRAHEDRALİZASYON — tercih değil zorunluluk

Braket **7 katıdan** oluşuyor ve katılar birbirine **TEMAS ediyor** (kaynaklı
montaj). Hepsi tek yüzey ağı olarak verildiğinde TetGen 18,5 s sonra bellek
taşmasıyla duruyor. Python boru hattı da aynı duvara çarpmış; oradaki çözüm CAD
seviyesinde boolean birleştirmeydi (gmsh `fuse`), ki occt-import-js yalnız
OKUYUCU olduğu için burada yok.

Katı başına ayırmak sorunu yapısal olarak kaldırıyor: her katı kendi içinde
kapalı, çakışma ancak katılar ARASINDA. **ÖLÇÜLDÜ:** braketin yedi katısının
beşinde non-manifold kenar sıfır; **4/7 katı ağa giriyor**, 3'ü (nm kenarı olan
18/4/4) giremiyor. Korelasyon tam — kök neden kesin.

**Bir katı çökerse SONRAKİLER İÇİN TAZE WASM ÖRNEĞİ kurulur.** ÖLÇÜLDÜ: ilk
katı taştıktan sonra aynı örnekle koşan diğer ALTI katı da çöküyordu, oysa
beşinin yüzeyi kusursuz. (Küçük bir sentetik durumda örnek sağ çıkmıştı;
gerçek bir parçadaki taşma o kadar iyi huylu değil.)

**Bedeli AÇIKÇA yazılıyor:** temas yüzeylerinde iki katının düğümleri
çakışmaz, yani parçalar ağ düzeyinde birbirine **bağlı değildir**. Panel bunu
uyarı olarak basıyor; sessiz bırakılsaydı kullanıcı yedi ayrı parçayı tek
gövde sanırdı.

###### KRİTİK METRİK `v_min`, `q_min` DEĞİL

Python boru hattının en pahalı dersi ve burada da geçerli: şekil ölçütü iyi bir
ağda bile 0,0000 görünebiliyor, ama **hacmi sıfıra yakın tetler** rijitlik
matrisini sayısal olarak tekil yapıyor ve **hiçbir ön koşullandırıcı
kurtaramıyor** (o tarafta CG 800 iterasyonda 1e-2'de takılmış). Bu yüzden panel
`minTetVolume` ve `degenerate`i ayrı ayrı basıyor, dejenere > 0 ise bu bir
uyarı değil çözümü durduran bir **hüküm** ve rozet KIRMIZI oluyor.

###### ÖLÇÜLDÜ — GERÇEK TARAYICI (tek dosya, `file://`)

| | rounded-cube | braket (7 katı) |
|---|---|---|
| süre | **2,6 s** | **5,2 s** |
| çizilen kare | **156** | **289** |
| eleman | 41.200 tet10 | 12.366 tet10 |
| dejenere / ters | 0 / 0 | 0 / 0 |
| hacim kaybı | %0,10 | %3,86 |
| yüzey min açı | 1,80° → **21,27°** | 4,45° → 11,27° |
| katı | 1/1 | **4/7** |
| `node.data` | 929 bayt | 2344 bayt |

Kare sayısı **arayüzün yaşadığının** kanıtı: ana iş parçacığında koşsaydı
~1 olurdu (Geometri bileşeninde ölçülen dersin aynısı). Hem yüzey hazırlığı hem
tetrahedralizasyon worker'da.

Karşılaştırma için: aynı braket, Python boru hattı — hacim kaybı **%1,47**
(pymeshfix onarımı), burada **%0,10** (rounded-cube) / %3,86 (braket, kaba
hedefle). Yüzey hazırlığı hacmi ölçüp raporluyor; %4'ü aşarsa panel uyarıyor.

###### Panel: tek sayı, dört hüküm, bir 3B görünüm

Kullanıcının dokunduğu TEK şey **hedef kenar boyu** (girilmezse parçanın sınır
kutusu köşegeninin 1/40'ı). Kalite reçetesi (`q1.4/18`) panelde YOK ve bu
bilinçli: Python boru hattı bu parametreleri taramış ve *"2,5 kat eleman,
marjinal kazanç, minimum kalite DAHA DA DÜŞÜK"* sonucuna varmış — o düğmeleri
kullanıcının önüne koymak, iyileştirdiğini sanarak ağı bozabileceği bir yüzey
açardı. Değerler künyede **yazılı**.

Rozet: boşken `AĞ` (nötr), doluyken `△41,2b` (amber), **dejenere varsa KIRMIZI**.
3B görünüm ağın dış yüzeyini + **eleman sınırlarını** çiziyor; tel kafes şart,
çünkü düz gölgeli bir katı 500 elemanlı ağ ile 500 bin elemanlı ağda AYNI
görünür — oysa kullanıcının ayarladığı tek şey tam olarak o yoğunluk.

**Bilinen kısıt:** temas eden katılardan oluşan montajlarda (kaynaklı sac
braket gibi) non-manifold kenarı olan katılar ağa giremiyor. Sonraki adım
manifold-güvenli kaynak (çakışan yüzeyleri ayıran vertex splitting) ya da CAD
seviyesinde boolean birleştirme.

###### WORKER PAKETİ ELLE SAYILMIŞ BİR LİSTE — ve bir kez eksik kaldı

Kullanıcı bildirimi (2026-08-25, tek dosya `file://`): *"geometriyi attıktan
sonra … ağı oluştur diyorum, herhangi bir şey olmuyor. Ne hata veriyor ne başka
bir şey. Offline olarak kullanmamdan kaynaklı mı acaba?"* Üretildi. **Offline
ile ilgisi yoktu** (konsoldaki `file://` CORS satırları — `pwa/manifest.json`,
`version.json` — ağa çıkan başka özelliklere ait); iki ayrı kusur üst üste
binmişti ve ikisi de ÇEVRİMİÇİ sürümde de vardı.

**1 · Worker paketi `_smAssign`'ı taşımıyordu.** Worker'a giden şey bir DOSYA
değil, `_smMeshBridgeSource()` içinde **elle sayılmış** bir fonksiyon listesi
(`fn.toString()` birleştirmesi). Ham-yüzey yedeği (bir önceki bölüm) eklenirken
kullanılan `_smAssign` listeye girmemişti. Ana iş parçacığı yolunda aynı kod
**çalışıyor** — fonksiyon orada kapsamda — yani birim testleri ve doğrudan
çağrılan bütün ölçümler yeşildi; hata yalnız worker'da, yani **gerçek panel
yolunda** çıkıyordu:

```
res = { ok: false, error: "_smAssign is not defined" }
```

**2 · Panel o sebebi yazıp hemen SİLİYORDU.** `veStrMeshBuild` sırası şuydu:
`_strMeshStatus(sebep)` → `showNodeProperties(node)`. İkincisi paneli
`innerHTML` ile baştan kuruyor, yani `#ve-str-mesh-status` elemanını da
yeniliyor. Sonuç: ilerleme kartı kapanmış, durum satırı boş, sonuç yok —
**ekranda hiçbir iz**. Kullanıcının "ne hata veriyor ne başka bir şey" dediği
şey tam olarak buydu. Sıra tersine çevrildi (önce panel, sonra mesaj); başarı ve
red yolları da aynı sırada.

**ÖLÇÜLDÜ (gerçek tarayıcı, `file:///…/MFSim_Code.html`, kullanıcının braketi):**

| | öncesi | sonrası |
|---|---|---|
| ilerleme kartı | `display:none` (hiç açılmadı gibi) | `block` → aşama yazıyor |
| durum satırı | **boş** (5 dk boyunca) | `Ağ hazır: 204.542 eleman.` |
| `node.data.mesh` | yok | var |

İki kapı kondu ve ikisi de mutasyonla ölçüldü. Birincisi paketin **kendi
kendine yettiğini** arıyor: worker'a giden bütünün (`structural-remesh.js` +
paket) İÇİNDEN çağrılan her `_sm…`/`veStr…` adı o bütünde **bildirilmiş**
olmalı — `_smAssign.toString()` listeden düşürülünce kırmızı. İkincisi
davranışsal: `showNodeProperties` paneli gerçekten yeniden kuran bir sahte ile
değiştirilip mesajın **ayakta kaldığı** ölçülüyor — sıra geri çevrilince
kırmızı.

**Sırada:** Sınır Koşulları (yüz seçimi) · Sonuçlar (çözücü + yakınsama
eğrisi). Kütüphane tarafında sırada olan: sıcaklığa bağlı özellikler ve
ortotrop (kompozit) malzeme kartı — ikisi de bugün katalogda YOK ve panel
bunu yazıyor.

### Topoloji sınır çerçevesi ADI da sarar (`veNodeLabelOverflow`)

Kesikli çerçeve (`veBoundaryBox` → `veUpdateBoundary`) yalnız KUTULARI sarıyordu;
ada ait tek pay altta sabit `VE_NODE_LABEL_H` (20 px) idi. Oysa ad dört kenara
da konabiliyor (sağ tık → Etiket Konumu · `node.data.labelPos` · css
`.lbl-top/.lbl-left/.lbl-right`) ve yana alındığında kutunun dışına ADIN
GENİŞLİĞİ kadar taşıyor. Kullanıcı bildirimi (2026-08-24, Yapısal Analiz ·
Geometri): *"ismini sola çektiğim zaman topoloji çizgisinin dışına taşmış."*

Aynı sessizlik **yatayda da** vardı ve dört modülün hepsini ilgilendiriyor: alt
etiket kutunun MERKEZİNE göre ortalanıyor (`translateX(-50%)`), yani kutusundan
geniş her ad iki yana eşit taşıyor.

**ÖLÇÜLDÜ (gerçek tarayıcı).** Kullanıcının bildirdiği durum: "Geometri" adı
sola alınınca adın sol ucu çerçevenin **5,0 px DIŞINDA**; düzeltmeyle **50,0 px
içeride** — yani tam dolgu kadar. Depodaki 18 örnek topoloji tek tek koşuldu:

| | eski | yeni |
|---|---|---|
| adı çerçeve dışında kalan örnek | **9 / 18** | 0 |
| en kötü taşma | **79,5 px** (`ap_ypa4x4`, motor adı · üst) | 0 |
| tek örnekte en çok taşan ad | **5** (`ap_jmma`) | 0 |

Çerçeve yatayda 24–145 px açılıyor, **dikeyde hiç değişmiyor**: alt pay hiç
küçülmüyor (`of.bottom` tabanı `VE_NODE_LABEL_H`) → bu düzeltme çerçeveyi
yalnız BÜYÜTÜR, kurulu hiçbir topoloji daralmaz.

**Modül KARTI dışarıda:** kart adı kutunun dışında yüzmez, kartın İÇİNDE bir
satırdır (`.ve-node--module .ve-node-label{position:static}`) → taşma sayılmaz.
Ölçüt tip listesi değil, o kuralın kendi ölçütü (`veIsModuleNode`).

**Ölçü DOM'dan, `offsetWidth` ile — `getBoundingClientRect` DEĞİL:** ikincisi
kamera zoom'unu (CSS transform) içine katar, sınır kutusu ise yerel px; zoom
%50'de çerçeve adın yarısını keserdi. `veBoundaryBox` SAF kalsın diye ölçüm
işlevi DIŞARIDAN geçiliyor; geçilmezse fonksiyon birebir eski davranışını
korur (saf koşucuda DOM yok, uydurma bir genişlik çerçeveyi yanlış yere koyar).

**ÖNBELLEK ŞART — ölçüldü** (16 düğüm · 12 tel, kare başına, 300 kare):
ölçümsüz 0,369 ms · **önbellekli 0,480 ms** · önbelleksiz 0,784 ms. `veUpdateBoundary`,
`updateAllConnections`'tan geçtiği için her sürükleme karesinde koşuyor;
önbelleksiz hâl kare başına zorlanmış bir yerleşim (layout) demekti. Anahtar
METİN + ELEMAN: ölçüyü değiştiren tek şey yeniden adlandırma, `isConnected` de
DOM yeniden kurulduğunda bayat referansı ele veriyor. Yazı tipi geç yüklenirse
`document.fonts.ready` önbelleği bir kez boşaltıyor.

**Ad kenarı değişince çerçeve de tazelenmeli.** `handleLabelContextAction`'ın
`saveState()`'i mutasyondan ÖNCE çağrılıyor (geri-al yığını — FEAD kartındaki
tuzağın aynısı), yani tazelemeyi o üstlenemez; `veUpdateBoundary` hem oradan hem
yeniden adlandırmadan (`map.js`) çağrılıyor.

Boşluk sayıları (`VE_LABEL_GAP_V` 4 · `VE_LABEL_GAP_H` 7) CSS'te de yazılı; kapı
sayıyı JS'e değil `css/styles.css`'in KENDİSİNE bağlıyor — ayrışırlarsa çerçeve
yine çizilir, yalnız adı birkaç piksel keser. Yedi mutasyonla ölçüldü (yan
taşmayı yok sayma, iki boşluk sabitini kaydırma, CSS tarafını kaydırma, yatay
taşmayı ikiye bölmeme, modül istisnasını kaldırma, alt pay tabanını kaldırma,
ölçüm işlevini hiç kullanmama) — yedisi de kırmızı.

### Sonuçlar penceresi — TXT raporları A4 SAYFA (kullanıcı isteği 2026-08-25)

Kullanıcı bildirimi: *"sonuçlar penceresi üzerinde TXT raporları sanki bir fiş
gibi duruyor… Burası normal bir A4 boyutunda olsun… Ayrıca başlığın yazdığı
header, 'Veri Gezgini' headeri ile aynı doğrultuda ve boyutta değil."*
Üretildi; **iki ayrı hata** çıktı ve ikisi de ölçüldü.

**1 · "Fiş" — ortalama blok blok yapılıyordu.** `veRenderCenteredTXT` metni
boş-satır bloklarına ayırıp her bloğu ayrı bir `<pre width:fit-content;
margin:0 auto>` olarak ORTALIYORDU. Ama raporun **iki farklı sütun genişliği**
var (ölçüldü: dar bölümler ~80, geniş tablolar **119** karakter; iz raporunda
121), dolayısıyla bloklar birbirine göre kayıyordu:

| | eski | yeni |
|---|---:|---:|
| `<pre>` bloğu | **43** | **1** |
| ayrı sol kenar | **10** | **1** |
| sol kenar yayılımı | **222 px** | 0 |
| kutu genişliği | 854 px (içeriğe göre) | **794 px** (A4) |

Yani sütun hizası blok İÇİNDE korunuyor, bloklar ARASINDA bozuluyordu —
ortalamanın kazandırdığı hiçbir şey yoktu. Metin artık **tek `<pre>`, sola
yaslı**; kutu A4 sayfa (210×297 mm @96dpi = 794×1123 px). Gölge farkı korundu
(kullanıcı açıkça istedi).

**Font ölçüsü sayfaya SIĞMAKTAN türer, sabit değil.** A4 içerik alanına
(794 − 2·45 = 704 px) 119 sütun sığması gerekiyor; hesap **CSS'te**:

```css
font-size: min(var(--rep-fs-max),
               calc((var(--rep-page-w) - 2*var(--rep-page-pad))
                    / var(--rep-cols) / var(--rep-ch)));
```

`--rep-cols` (en uzun satır) sayfaya satır içinde yazılır. Hesabı JS'te yapıp
px yazmak yerine CSS'e bırakmak, **aynı kuralın indirilen HTML'de de birebir
çalışmasını** sağlıyor — orada JS yok. **ÖLÇÜLDÜ:** 119 sütunlu Tam Gaz raporu
9.83 px'e oturuyor ve `<pre>` genişliği **702 px = içerik alanı 702 px**, yani
yatay kaydırma YOK; 80 sütunluk dar rapor tavana (`--rep-fs-max` 11 px)
oturuyor, sayfayı doldurmak için şişmiyor.

`--rep-ch` (karakter genişliği / font boyutu) **ölçülür, varsayılmaz**: font
ailesine göre değişiyor (Consolas 0.55, DejaVu Sans Mono / Menlo 0.60) ve sabit
bir oran dar karakterli fontta sayfanın onda birini boş bırakırdı.
`veTxtCharRatio()` gizli bir ögeyle bir kez ölçer; ölçüm tutmazsa CSS'in
varsayılanına (0.62) düşer — **büyük oran = küçük font = taşma yerine boşluk**,
yani güvenli taraf. Ölçüm ögesinin punto'su CSS'te DEĞİL JS'te: o bir tasarım
jetonu değil, ölçüm parametresidir (tipografi ölçeği kapısı bunu doğru yakaladı).

**2 · Üst bant panel ayırıcısında KIRILIYORDU.** Rapor bandı 48 px, soldaki
"Veri Gezgini" bandı 36 px; alt çizgiler **12 px kayık**, çizgi 2 px'e karşı
1 px, başlık 13 px'e karşı 12 px (gerçek tarayıcı, 1600×950). Bu, 2026-08-17'de
`.ve-results-head` ↔ `.ve-trace-toolbar` arasında kapatılan kırılmanın
**aynısıydı**; rapor overlay'i o düzeltmeye dahil edilmemişti. Bant artık
`.ve-rep-head` ile **aynı `--results-bar-h`'tan** besleniyor, düğmeler ölçüm
penceresi araç çubuğunun düğmesini (`.ve-trace-btn`) **paylaşıyor** — aynı
bandın iki yarısı için ikinci bir düğme stili tutmanın karşılığı yok.
**ÖLÇÜLDÜ:** alt çizgi farkı **12 → 0 px**, yükseklik 36 ↔ 36, başlık 12 ↔ 12.

**BANDI KURAN TEK YER VAR.** Beş panel (dört TXT önizlemesi + Detaylı Rapor)
bandı satır içi stille, birbirinin kopyası olarak kuruyordu; biri düzeltilince
diğer dördü sessizce ayrışırdı — nitekim ayrışmıştı. Artık `veRepHeadHTML` tek
üretici, panel yalnız başlığını ve indirme adını veriyor (`veTxtPreviewShow`).
Bu, düğme kablolaması testinin ölçütünü de değiştirdi: kopya SAYMAK anlamını
yitirdi, test artık ÜRETİLEN YÜZEYE bakıyor.

İndirilen HTML aynı sayfayı açar ve `@page{size:A4}` ile gerçekten A4'e basar.
Arayüz jetonlarına başvurmama kuralı (`report-cosmetics.test.js`) korunuyor:
belge kendi `--rp-*` ölçeğini kendi `:root`'unda taşıyor.

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı: bandın kendi ölçüsünü
tutması, sayfanın içeriğe göre daralması, A4 yerine keyfî genişlik, font
tavanının kalkması, gövdenin yine blok blok ortalanması, karakter oranının
güvensiz tarafa kayması, indirilen belgenin A4'e basmaması, bir panelin kendi
bandını kurması.

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
| `tests/unit/fead-core.test.js` | `js/fead-core.js` + `tests/fixtures/fead-validation.js` | **FEAD çekirdeğinin doğrulama kapısı**: 17 Gates raporu / 2095 değer (çalışma %0.5, Load dahil %1.5, kol açısı 0.2°), 8 koruma mekanizması, SPEC §9 yapısal özdeşlikleri (sarım değişmezi, `L_pitch−L_eff=2π·hb`, çevrim kapanışı, sürücü gücü), UMD tarayıcı köprüsü; **burulma modeli**: yapısal özdeşlikler (tam 1 rijit cisim modu, take-up özdeşliği %0.01, yalnız gergi komşusu spanlar) + Gates "System Resonance (Mode 1)" kalibrasyonu (5 sistem RMS <%8, 4/6/8PK kaburga ölçeklemesi) |
| `tests/unit/gates-archive.test.js` | `docs/gates-reports/pdf/` + `tests/helpers/gates-pdf.js` + `tests/fixtures/fead-validation.js` | **Arşiv KAPISI — testler Gates PDF'lerini doğrudan okuyor.** Okuyucu saf Node + `zlib` (yeni bağımlılık yok) ve üç sessiz kusuru çözmek zorunda: font BAŞINA ToUnicode (birleştirme dört raporda çöp metin üretiyor — glif 44 → `space`/`A`/`#`/`@`/`G`), eksi işaretinin AYRI çizim çağrısı olması (`["-","72.00"]` → kaçırılırsa kasnak aynalanır), nesne akışları (ObjStm — AG00894'te tek font bile bulunamıyor). Fixture'ın **284** statik değeri (yerleşim · çap · açıklık · sarım · gergi künyesi) on raporun tamamında **0 uyuşmazlıkla** geri üretiliyor. Belge bütünlüğü: `Page N of M` ile alıntı tespiti — üç rapor alıntı, yedisi tam (AG00879'un sayfa AĞACI 5 gösteriyor ama 12 sayfa da içinde). Altbilgi tek satır ve birleşik (`Page 1 of 119.37.0.0`) → düz kalıp **119** okur  Ayrıca **gergi künye kütüphanesini** (`js/fead-tensioners.js`) kaynağına bağlar: on kaydın kol/oran/moment değeri (30 sayı) birebir, ön yükün dokuzu birebir + onuncusu `preloadDerived` ile işaretli (raporda YOK), kaburga sayısı raporun künyesiyle aynı (AG00810 bir dönem 8 yazıyordu, raporu 10PK), parça kodu Drive Notes'ta gerçekten geçiyor ve doğrulanamayan dört kayıt kod TAŞIMIYOR |
| `tests/unit/fead-canvas-mm.test.js` | `js/fead-model.js` koordinat katmanı + `js/connections.js` imza | **Kanvas = kayış düzlemi**: gidiş-dönüş birebir, Y EKSENİ TERS (kanvasta aşağı = mm'de azalan), kutu ölçüsünün sistematik kayma ÜRETMEMESİ (sol üstten ölçmek 54…72 px arası değişen bir sapma verirdi), 1 px = 1 mm. **Orijin**: sürücü kasnak (rol, tip değil), kendi mm'sinin (0,0) olması, kasnak yoksa senkronun hiç çalışmaması. **Senkron**: sürüklemenin mm'yi o kadar değiştirmesi, ORİJİNİ sürüklemenin diğerlerini karşı yönde kaydırması, araç düğümlerine dokunmaması. **Gergi**: pivot + montaj merkezinin RİJİT taşınması (kol boyu ve montaj açısı korunur, `veFeadArmCheck` geçer) ve ORİJİN sürüklenince gergi pivotunun da tazelenmesi (bu bir KAPI BOŞLUĞUYDU — gergi senkrondan çıkarılınca hiçbir test kırılmıyordu). **Göç**: ötelemenin L_eff/sarım/gerginliği BİREBİR bırakması, göçün krankı (0,0)'a çekmesi, gergi pivotunun da ötelenmesi (kısmi göç modeli bozardı). **İmza**: kasnak mm koordinatı/çapı/temas tarafı imzaya girer, Kayış Yolu kartını taşımak imzayı DEĞİŞTİRMEZ. **Uçtan uca**: alternatörü kanvasta taşımak gereken kayış boyunu gerçekten değiştiriyor |
| `tests/unit/fead-duty.test.js` | `js/fead-duty.js` + `js/cp-fead.js` + `index.html` | **Çalışma çevrimi kütüphanesi**: yedi kaydın yedisi de kaynağında (fixture + BMC örneği) BİREBİR var — ikinci kopya sessizce ayrışırsa kullanıcı çevrim seçer, model çözülür, uyarı çıkmaz, yalnız ömür ve yorulma payları raporundan başka çıkar; arşivin TEK çevrim göstermediği (≥6 desen) — kütüphanenin var olma sebebi; Σ%zaman = 100, devir dizisi artan, anahtarlar tekil, künyede kaynak YAZILI; liste KOPYA döner (katalog güncellemesi eski projeyi bozmaz), satırlar kW'ı BOŞ üretir (güç hesaplanır), bilinmeyen anahtar uydurma kayıt üretmez; eşleme gidiş-dönüş tutar, tek devir değişince NULL döner ve kW'a BAKMAZ; etiket tek üreticiden ve iki yüzey de onu çağırıyor; betik `index.html`'de cp-fead ve sihirbazdan ÖNCE (çıpa script etiketi — çıplak dosya adı bir YORUMU bulup sırayı yanlış okuyor), tohum panel KURULURKEN atılıyor |
| `tests/e2e/fead-duty.spec.js` | Çalışma çevrimi (uçtan uca) | **GERÇEK tarayıcı**: sihirbaz taze açılışta dolu tabloyla geliyor ve çevrim seçicisi yerinde, açılır pencereden GERÇEK seçim (`selectOption`) tabloyu o kayıtla değiştiriyor (700·1200·2000·3000), kW hücreleri kaynağıyla birlikte basılıyor; **panel** de `showNodeProperties` ile 6 satır ve seçiciyle kuruluyor ve *"Henüz devir noktası yok."* mesajı YOK. Panel yolu Node'da HİÇ koşmuyor |
| `tests/unit/fead-belts.test.js` | `js/fead-belts.js` + `js/fead-model.js` aday değerlendirmesi | **Kayış kataloğu**: listelerin sıralı/tekil/pozitif olması, aralıkların ContiTech beyanıyla çakışması (bir listenin yanlış profile yapışması ancak böyle yakalanır), en kısa boyun min. kasnak çevresinden büyük olması, `veFeadBeltStock`'un KOPYA döndürmesi. **Izgara bir kural**: en yakın adıma yuvarlama, aralık dışında kenetlenme, ızgarası olmayan profilde sessizce PK ızgarasının kullanılmaması. **Kod**: otomotiv ve endüstriyel yazımın ikisinin de çözülmesi, gidiş-dönüş, kaburga denetiminin yalnız verisi olan profilde hüküm vermesi. **Ölçülmüş boşluk**: 8PK 1715'in endüstriyel listede OLMAMASI (komşuları 65 mm uzakta) — kataloğun iki kümeli olmasının sebebi. **Uçtan uca**: serbest kipin gereken boyu → katalog ızgarası → sabit kip tabanı (kol 28.4271° · T 532.142 · hub 302.125) birebir; sığmayan adayın gerginlik YAZMAMASI (4.05e10 N sızmıyor), boy uzadıkça kol ve gerginliğin düşmesi, aday değerlendirmesinin çalışma noktası önbelleğini kirletmemesi |
| `tests/unit/fead-belt-mode.test.js` | `js/fead-model.js` kayış kipi + `js/fead-core.js` hoşgörülü geometri | **Kayış boyu sabit değil**: kip çözümü ve geriye dönük uyumluluk (boyu olan eski proje `fixed`, boyu olmayan artık ÇÖZÜLÜYOR); sabit kipte tabanın BİREBİR korunması (kol 28.4271° · L 1715.0000 · T 532.142 · hub 302.125); **nominal kol açısı yay künyesinden, geometriden DEĞİL** — montaj merkezi ya da pivot yokken de türetilir, künye gerçekten eksikse NaN kalır (uydurulmaz) ve `direct` kol açısı kipinde serbest kayış NOMİNALE oturur, aralığın ortasına DEĞİL (eskiden kol 38.1174° · fallback true · uyarı 0); serbest kipte gerginliğin ankraj, boyun ÇIKTI olması ve iki kipin doğru modelde AYNI çalışma noktasına varması; sürüklerken çözümün kopmaması (−200…+40 mm, boy monoton). **Kenetleme**: kuşatılmış hedefte çekirdeğin çözümünün birebir dönmesi, erişilemeyen hedefte istisna yerine sınır + aralığın yazılması, sığmayan kayışta NOMİNAL kol açısına düşülüp ÖNERİLEN boyun serbest kipinkiyle aynı çıkması, kenetlenmişken uyuşmazlık uyarısının İKİNCİ KEZ basılmaması. **Hoşgörülü geometri**: kapanmayan çevrimin çözülüp `geomValid:false` ile yazılması, çekirdek varsayılanının hâlâ ATMASI, çakışan kasnakların tek gerçek durdurucu olması. **Üç sessiz hata**: `feasibleRelMax` ölçütü, `_geomOpt`'un sistem ömrünün başında kurulması, dejenereliğin SARIM değil TAKE-UP ile ölçülmesi |
| `tests/unit/fead-model.test.js` | `js/fead-model.js` | **Köprü kapısı**: AG00686 MFSim KANVAS DÜĞÜMÜ olarak kurulup Gates sayılarını üretiyor mu (span %0.5, sarım 0.2°, Mean kol açısı 0.2°); temas tarafı üç katmanlı çözümü, sürücü rolü, `dia→od` göçü, ad tekilleştirme, hata çevirisi. **Güzergâh teşhisi**: tel silinince çözüm ARTIK aynı kalmıyor (eskiden kopuk kasnak sıraya sessizce ekleniyordu), kopuk kasnak adıyla bildiriliyor, kapanmayan zincir ve çatal (bir kasnaktan iki tel) sebebiyle yazılıyor, `veFeadRouteOrder` sözleşmesi (yerleştirici için bütün kasnaklar) korunuyor. Ayrıca **ters temas tarafının hata VERMEDİĞİNİ** belgeler (rozetin varlık nedeni). **Duty kapısı**: AG00686 duty tablosunun çıkış gerilmeleri ve hubload'ları %0.5 içinde; kW'ın kimlikle anahtarlanması (yeniden adlandırmada kaybolmuyor), sürücü gücünün toplamdan hesaplanması, ateşleme frekansı, yorulma dağılımının çapa bağlı olması, katalog oranının ÇAPTAN hesaplanması. **Sıcaklık kapısı**: satır başına °C → tek °C indirgemesi hasar-eşdeğer (tek sıcaklıkta birebir aynı, dağılımda aritmetik ortalamanın üstünde), ağırlık `dc·v`, açıkça girilen %0 sıfır ağırlıklı; **yorulma modeli** seçimi dağılıma geçer, mutlak ömre geçemez ve bu yazılır. **Burulma köprüsü**: gergi kasnak kütlesi ve KRANK MİLİ ataleti çekirdeğe geçiyor (ölü girdiydi), krank adla anahtarlanır, `analyze()` içindeki çift hesap kapalı, eksik atalet sessiz değil |
| `tests/unit/fead-spin.test.js` | `js/fead-model.js` yön + gergi tarafı · `js/cp-fead.js` rozet/panel/teşhis | **Dönüş Yönü**: yön rota sırasının dolanım işaretinden gelir (çekirdeğin `loopSense` ölçütü, ikinci kopya yok), ters kablolama işareti çevirir, gergide MONTAJ merkezi kullanılır ve koordinat eksikse yön 0 (uydurulmaz); **rota kablolardan çevrilir** — uçlar YERİNDE takas edilir (yeni kimlik yok), iki kez çevirmek birim işlem, yalnız iki ucu da kasnak olan teller çevrilir; **geometri BİREBİR** (kasnak başına sarım, L_eff, Σ=360, kol açısı — hepsi 9 basamak) ama **gerilme zinciri değişir** (AG00976 ileri min 544,0 N ↔ ters min −291,6 N); **gergi tarafı hükmü** eşiksiz (ankrajın altına inen span aranır, negatif sayı değil), ileri yönde geçer / ters yönde sebebi adıyla yazar ve ULAŞILAMAZ çareyi (*"tasarım gerginliğini yükseltin"*) YASAKLAR, uyarı üst seviyeye yükselir (raporlar yalnız oraya bakıyor), çöken zincirde kayma hükmü verilmez; **rozet** glifle durumu (`↺ CCW`/`↻ CW`) renkle hükmü taşır ve CW/CCW AYNI renktedir, yön ROTA sırasından okunur (düğüm dizisinden değil), çözümden SONRA tazelenir (bir çözüm geride kalmaz); sözleşme (0/0, `maxInstances:1`, palet + kayıt defteri + `cp-core` dağıtımı) ve **silme kancası YOK** — durum kablolarda; **zarf kipinde merkez TÜRER** — `cenX/cenY` orada hiç yazılmadığı için yön okunamıyordu (sense 1 yerine 0, rozet `—`), artık `veFeadTensionerCenter` pivot + kol boyu + seçilen kol açısından çözüyor ve sonuç çekirdeğin çalışma merkeziyle birebir; `build.spin` zarf seçiminden SONRA tazeleniyor (bir çözüm geride kalmıyor); bayat `cenX/cenY` zarf kipinde okunmaz, mount kipinde türetmeye düşülmez; pivotu çokgene koymak sentetik düzende işareti ÇEVİRİYOR (iki gerçek örnekte çevirmiyor — kapı bu yüzden sentetik) |
| `tests/unit/fead-coordlink.test.js` | `js/fead-model.js` okuyucu + `js/cp-fead.js` kapıları + `js/map.js` silme kancası | **Konum Bağı**: düğüm yoksa bağ AÇIK (geriye dönük uyumun kendisi), `linked` yazılı değilse de AÇIK, çok kopyada KAPALI kazanır; sürükleme kapısı (TABAN çıpası: bağ düğümü YOKKEN alternatör +40/+25 px → +40/+25 mm, gergi merkezi −15/−10, orijin sürüklemesi 5 düğüm) ve kapalıyken **0**; kapı SAF fonksiyonun içinde DEĞİL (`veFeadSyncMmFromCanvas` doğrudan çağrılınca yine çalışır); **bağımsızlık SİMETRİK** — kapalıyken `veFeadPlaceFromCoords` da 0 döner ve panelden koordinat yazmak kutuyu oynatmaz; açarken kutu koordinata DÖNER, koordinat kutuya YAZILMAZ; **düğümü silmek bağı açar ve UZLAŞTIRIR** (kanca yokken 1 px sürükleme mm'yi 81 mm sıçratıyordu), geriye KAPALI kopya kalırsa uzlaştırma yapılmaz; rozet AÇIK amber / KAPALI mavi (ikisi de SATURE — soluk gri kullanıcıyı fark etmemeye davet ederdi), mousedown durduruluyor; panel kanvasla aynı alanı okur ve düğüme HİÇ yazmaz; kasnak paneli kapalıyken kutunun oynamayacağını YAZAR; sözleşme (0/0, `maxInstances:1`, FEAD araçlarının hepsinden küçük kutu, palet + `VE_MODULES` + `cp-core` dağıtımı) |
| `tests/unit/cp-fead.test.js` | `js/cp-fead.js` + `js/components.js` | FEAD sunum katmanı: **yön gülü** (kenetleme, kesir olarak saklama, hareketsiz tıkın hiçbir şey yazmaması, kancanın yalnız kanvas/panelde kurulması); **şerit ÖLÇÜLMÜŞ bir çarpışmaya bağlı** — gül çizime çarpmıyorsa ayrılmaz (varsayılan kartta ayrılmıyor, taşımak hiçbir şey kazandırmıyor), çarpıyorsa AYRILIR ve dar kartta eski davranış birebir korunuyor; **gül etiket engelidir ve bu KOŞULSUZ** (taşınmışken de — engeli `!moved`e bağlamak, gül şemanın ortasına sürüklendiğinde korumayı kapatıyordu; ölçüldü: 256 konumda çakışma 3 ↔ 61), ölçüt çapa noktası değil etiket KUTUSU (çapa ölçütü mutasyondan GEÇİYORDU); **türetilen boyun KÖKENİ** — sağlıklı modelde metin değişmiyor (yanlış alarm yok), künye eksikse *"tedarikçiye verilecek boy DEĞİLDİR"* diyor, kol kenetlendiyse *"nominal açısına oturamadı"* diyor, ikisinde de sayı kırmızı + `?`, ve kenetlenmenin SEBEBİ Kayış Özellikleri panelinde basılıyor (`veFeadWarningBox` orada YOKTU); **kart ölçüsü** — aşılmış her varsayılan (60×56 ve 420×340) yükselir, listedeki hiçbir çift güncel ölçü olamaz, bilerek verilen ölçü korunur; **örnek KULLANIMA HAZIR** — "Başlangıç ve Örnekler" düğümü örnek kurulunca KALMAZ, "Rapor" düğümü kurulur ve sol şerit sırası Kayış Özellikleri → Çözücü → Rapor çıkar (sıra `veFeadExampleNodes`'un push sırasının gözlenebilir sonucu), kayıtlı BÜTÜN örneklerde; kanvas rozeti, `feadContact` varsayılanları, panel smoke testleri, alt-sistem sözleşmesi, `fead-*` tip tanımları; panelin HANGİ ALANLARI sorduğu (montaj merkezi ↔ serbest açı), servis faktörü hükmü; **kayışın kaburgalı yüzü** (diş yönü + aynalanmış çevrim), **telin komşuya bakan kenarı** (oran kuralı, elle taşınan portun kazanması) ve **`veFeadArrangeByCoords`** (kanvas mesafesi = mm mesafesi, Y TERS, kümenin ortalanması, koordinatsız kasnağın gizlenmemesi, araçların kümenin dışında kalması, koordinata DOKUNMAMASI, `veTidyLayout`'un devretmesi, `silent` kipinde saveState/toast'ın çağrılmaması, konumun 1 mm'ye KUANTALANMAMASI); **örnek kurucusu koordinatı yalanlamıyor** — `veFeadLoadExample` gerçek `createNode` ile koşturulup her kasnağın kutu merkezinin mm koordinatına oturması ölçülüyor (eski ölçekli yerleşimde sapma 38.108 mm) ve ilk sürüklemenin koordinatı KAYDIRMADIĞI, kayıtlı BÜTÜN örneklerde; **gergi kutusu kip başına doğru noktada** — zarf kipinde PİVOT, mount kipinde montaj merkezi, ve "Otomatik Düzenle" ile alt topoloji açılışı (`veFeadSyncCanvasFromMm`) AYNI yere koyuyor (sync tek kutuyu bile oynatmıyor); girdisi eksik gergi yine gizlenmiyor, kümenin altına diziliyor |
| `tests/unit/cp-fead-report.test.js` | `js/cp-fead-report.js` + `tools/report-assets/fead-theory-source.html` | **Rapor içeriği**: Türkçe sayı biçimi (gerçek eksi, `—` ≠ 0), `wearPct` oran→yüzde çevrimi, sarım açılarının DERECE basılması, Σsarım=360 ve `L_pitch−L_eff=2πh_b` denetimlerinin belgede görünmesi, sürücü kW sütununun duty tablosunda OLMAMASI, çözülemeyen konumun `Err.` ile işaretlenmesi, `undefined`/`NaN`/`[object` sızmaması, "ortalama tork ≠ peak", sistem burulma modunun yokluğunun yazılması, uygunluk hükmünün servis faktörünü kullanması, şekil/tablo numaralarının boşluksuz ve her üretimde sıfırlanması, şablon tokenlarının tek kez geçmesi, içindekiler id'lerinin üreteçle aynı olması; **tasarım gerginliğinin kaynağı**: (8.x) denklem zincirinin ELLE ÇALIŞILABİLİR olması (çevrim çarpanı bir kez TERS yazılmıştı — basılan denklem 650 N yerine 2,13 N veriyordu), girdi ↔ türev envanteri, take-up'ın GİRDİ OLMADIĞI, tasarım gerginliğinin TÜRETİLDİĞİ (T = M/(dL/dθ) formülü ve sayısı belgede, "sorulmaz" yazılı, eski karşılaştırma tablosu YOK, eski kayıttaki designTensionN raporu etkilemiyor); **φ kuruluşu**: her satırın φ'sinin BASILAN iki θ'dan yeniden çıkması, Σd·φ=360, sarım ve φ İŞARET yaylarının örtük merkezinin kasnak merkezinde olması ve süpürmenin kısa yola normalize EDİLMEMESİ (198°'lik sarımda 162° çizerdi); **§8.9**: take-up'ın ANLIK türev olarak adlandırılması, ortalama eğimin ayrı basılması, monoton olmaması; **etiket yerleştirici**: çakışma, kilitli alan ve çember engeli; **teori**: (4.3) türetmesi, §5.1 ankraj paragrafı, §10 sembolleri, şablona gerçekten girmiş olması |
| `tests/unit/fead-anim.test.js` | `js/cp-fead.js` animasyon + `js/fead-model.js` kinematik | **Kayış Yolu kartının animasyonu**: ω·r = v özdeşliği, ağır çekim katsayısının REFERANS devre bağlanması (seçili devre bağlansaydı seçici işlevsiz kalırdı — istenmeyen alternatif de koşturulup belgeleniyor), diş adımının çevreyi tam bölmesi, diş sayısının faz boyunca sabit kalması, bir adımlık fazın deseni birebir kendine getirmesi, dişlerin GİDİŞ yönünde ilerlemesi, kol açısal hızının `d·v/r` olması (sırttan temas edende ters) ve kol ucu çevresel hızının kayış hızına eşitliği (kasnakta kayma yok), animasyonun YALNIZ kanvas kartında olması, fazın düğüm kimliğinde durması (yeniden kurulumda kayış zıplamıyor), uzun duraklamada `dt` kırpması |
| `tests/unit/fead-example.test.js` | `js/fead-model.js` örnekleri + FEAD_INFORMATION | **Tedarikçi sayfası çıpası** (Gates'ten bağımsız ikinci doğrulama): kayış boyu 1715 mm, kol boyu 90.0 mm, Spring Mean Load 22.07 Nm, tahrik oranı 1.1; sayfanın devir→kW tabloları; **sessiz kanalın** ölçülmüş belgesi (montaj merkezi ↔ serbest açı 2.6×); **tasarım gerginliği TÜRETİLİR**: örnek onu taşımıyor, T = M/(dL/dθ) kuruluşu, eski kayıttaki değerin yok sayılması, türetilemezse sessiz kalmaması |
| `tests/unit/fead-example-ag00976.test.js` | `js/fead-model.js` örnek kayıt defteri + `js/cp-fead.js` örnek kartı | **Gates raporu çıpası** — tedarikçiden DÖNEN rapor (AG00976 · 8PK1715HD · Ten@-250/110 · Corrected-IDR1) örnek olarak kurulup UÇTAN UCA geri üretiliyor. Doğrulama harness'ı köprüyü ATLIYOR (`makeSystem`i doğrudan çağırıyor); burada zincirin tamamı koşuyor. Referans değerler fixture'dan okunuyor, İKİNCİ KOPYA YOK. Kapsam: 12 span+sarım (0.2 derece/mm), 6 konum × 7 sütun (kol 0.2°, çalışma gerginliği %0.5, Load %1.5), duty 12×6 gerilme+hubload (%0.5), sürücü gücünün TOPLAMDAN hesaplanması, dış çap → raporun Pitch/Effective sütunları, hız oranının PITCH çapından gelmesi (sayfanın elle yazdığı 162/57 = 2.842'yi AYIRT EDİYOR), **tasarım gerginliğinin ve serbest kol açısının TÜRETİLİP** raporun kendi satırlarına oturması, kol boyu çapraz kontrolünün ısırması; **efektif boy 1714.6** (raporun REBL sütunu — katalog adı 1715 kullanılırsa AÇIKÇA kırılıyor), tolerans/aşınma yoksa kol zarfının tek noktaya ÇÖKMESİ, `kwByKey` → düğüm kimliği çevirisi (kayarsa aksesuar SESSİZCE 0 kW ile koşar), B10'un aralık dışı olduğunu MODELİN KENDİSİNİN söylemesi, burulmanın kalibrasyon takımı DIŞINDAKİ bir sistemde %8 bandına düşmesi ve krank MİLİ ataleti geçilmezse %29 kayması; iki örneğin (giden sayfa ↔ dönen rapor) AYRI KALMASI ve pivot farkının gerginliği %19.5 kaydırması; panel kartında `undefined` basılmaması |
| `tests/unit/structural-model.test.js` | `js/structural-model.js` + `vendor/opencascade.*` | **STEP köprüsü**: GERÇEK dosyalar GERÇEK OCCT ile okunuyor (sahte veri yok). **Yüz kimliği ağ inceliğinden bağımsız** (üçgen değişir, `m<i>/f<j>` değişmez), yüz aralıkları üçgenleri boşluksuz/örtüşmesiz böler, `veStrFaceOfTriangle` eşlemesi, birimin mm'ye çevrilmesi, künyenin ÜÇGEN TAŞIMAMASI, hata çevirisi (bozuk dosya ≠ katısız dosya) + OCCT'nin kendi teşhisinin mesaja iliştirilmesi, oturumluk önbelleğin temizlenmesi. **BOOLEAN**: 7 gövdeli parça 1 katıya iniyor, yüz sayısı 30 → 18 (dikişler siliniyor), hacim korunuyor (kayıp yalnız örtüşen ortak hacim), birleştirmeden SONRA da yüz aralıkları üçgenleri tam bölüyor, tek katılı dosyada boolean HİÇ çalışmıyor, `fuse:false` ile kapatılabiliyor, künyeye giriyor. **Gömülü çekirdek**: üretilmişse vendor'la bayt bayt aynı, WASM imzası, gzip'in gerçekten kazandırdığı, index.html'de AÇILIŞTA yüklenmediği, varlığın `.gitignore`'da olduğu. **Kaynak deposu**: künye STEP kaynağı TAŞIMIYOR (undo yığını), `veStrSrcAttach` KOPYALA-YAZ (canlı state'e tek yazma bile yok — kaynağın otomatik yedeğe sızdığı ölçülmüş hatanın kapısı), alt-topolojideki düğüme ulaşması, deposu olmayan düğümde gereksiz kopya üretmemesi, eski projelerin HAM `source` alanını da kabul etmesi. **Worker sözleşmesi**: köprü DOM'a dokunmuyor (worker'da `document`/`window` yok), sonuç transfer ile dönüyor, AŞAMA worker'dan bildiriliyor, boru hattı worker'a KAYNAK METİN olarak giriyor ve dışarıdan hiçbir şeye başvurmuyor (ikinci kopya yok), normalize tipli diziyi YENİDEN KOPYALAMIYOR. **İlerleme**: aşamalar `reader·parse·fuse·build`, çok gövdeli dosyada `fuse` sırayla bildiriliyor, tek katılıda HİÇ bildirilmiyor |
| `tests/unit/structural-remesh.test.js` | `js/structural-remesh.js` | **Yüzey hazırlığının DEĞİŞMEZ kapısı**: modülün değeri min açıda ama asıl kapılar değişmezlerde — bir yeniden-mesh üç ayrı şekilde sessizce bozulur ve üçü de ekranda kusursuz görünür. Fikstürün KENDİSİ önce doğrulanıyor (küp DIŞA-CCW, hacim tam +1000, açık kenar 0 — yanlış sarımlı bir fikstür bütün hacim kapılarını anlamsız yapardı). **Topoloji**: açık kenar 0 + anormal (3+ üçgenli) kenar 0 — bu kapı geliştirme sırasında ÜÇ hatayı yakaladı (anlık görüntü üzerinde ikinci bölme → 1220 açık kenar, bağlantı koşulsuz birleştirme → 8 anormal, pasoda ikinci çevirme → 4 anormal). **Hacim**: 1000 mm³ %0,01 içinde — içbükey dörtgenin çevrilmesini normal denetimi GÖREMEZ (normaller aynı yönde kalır), yalnız hacim değişmezinden görünür (ölçüldü: 1000,000 → 1000,418). **Düğümler yüzeyde kalıyor** (teğetsel düzleştirme yüzeyden çıkarmıyor, sapma < 1e-9). **Kalite**: min açı > 30° ve 10° altı üçgen 0 (sırasız bölmeyle 45° → 0,20° ve %45,8). **CAD yüzü kimliği** her üçgende ve yalnız girdideki altı kimlik, altısı da temsil ediliyor. **Sliver iyileştirme**: kasıtlı ince üçgen enjekte edilmiş küpte min açı yükseliyor, topoloji ve hacim korunuyor. **Hedef kenar**: verilmezse katının KENDİ köşegeninden (÷40), kaba bir hedef katı başına TAVANLA kırpılıyor (÷8 — braket montajında 5,98 mm hedef 17 mm'lik parçaları çakıl taşına çeviriyordu). **Non-manifold**: temiz ağda 0, kusurlu ağda ÜRETİLMİYOR ve BÖLÜNEREK ÇOĞALMIYOR (4 kenar 303'e çıkıyordu). **Şekil ölçütü** min açıyla aynı yönde değişiyor (kapılar `acos` kullanamaz — düzleştirme 11,0 s sürüyordu) |
| `tests/unit/structural-mesh-model.test.js` | `js/structural-mesh-model.js` + `vendor/tetgen-wasm.*` | **Ağ köprüsü**: GERÇEK TetGen çekirdeği GERÇEK STEP dosyasında (sahte veri yok). **SINIR KOŞULU ZİNCİRİ** — occt `brep_faces` → remesh `faceIds` → TetGen `facetmarkerlist` → çıktı `trifacemarkerlist` → yeniden `m<i>/f<j>`: her sınır üçgeni bir CAD yüzüne bağlı (kayıp YOK), girdideki BÜTÜN yüzler çıktıda, kimlik biçimi Geometri bileşeniyle AYNI. **ELEMAN KUADRATİK** (`cornersPerTet === 10`) — tet4 bu modülde yasak, ölçüldü: 27.783 SD'de bile %24 RİJİT. **Dejenere/ters eleman yok**, `minTetVolume` eşiğin üstünde (kritik metrik `v_min`, `q_min` DEĞİL). **Hacim kaybı** %4 altında ve ağ hacmi yüzey hacmiyle tutarlı. **Reçete**: `p` + `q1.4/18` + `o2` + Steiner TAVANI (tarayıcıda sınırsız nokta sekmeyi kilitler) + `Q`; kullanılan anahtarlar sonuçta YAZILI. **Künye AĞ TAŞIMIYOR** (düğüm/eleman dizileri yok, künye < ağın kendisi) ve çözümün ne ile kurulduğunu taşıyor; oturumluk önbellek temizlenebiliyor. **PLC**: CAD kimliği tamsayı işaretçiye eşleniyor ve TERS TABLO dönüyor (yoksa çıktıdaki 17 numaralı işaretçinin hangi yüz olduğu kaybolurdu), sıfır KULLANILMIYOR (TetGen işaretçisizleri 0 sayıyor). **Hata sessiz değil**: parçasız istek ve kendini kesen yüzey — sözleşme "bu girdi ÇÖKER" değil, köprünün İKİ durumdan birini vermesi (ham istisna sızdırmaması). **Gömülü ağ üreteci**: `js/structural-tetgen-wasm.js` vendor .wasm'ıyla BAYT BAYT aynı, WASM imzası, index.html'de AÇILIŞTA yüklenmiyor, AGPL-3 lisansı ve TetGen KAYNAĞI depoda, derleyici `predicates.cxx`'i `-O0` ile derliyor (kesin aritmetik şartı). **Worker paketi KENDİ KENDİNE YETİYOR**: worker'a giden bütünün (`structural-remesh.js` + `_smMeshBridgeSource()`) içinden çağrılan her `_sm…`/`veStr…` adı o bütünde bildirilmiş — liste elle sayıldığı için bir kez eksik kaldı (`_smAssign`) ve hata YALNIZ worker'da, yani gerçek panel yolunda çıkıyordu |
| `tests/unit/structural-materials.test.js` | `js/structural-materials.js` + `js/cp-structural.js` | **Malzeme kütüphanesinin tutarlılık kapısı** (112 kayıt × beş katman): sayılar ölçülemez (standart değerleri) ama TUTARLILIKLARI ölçülür — kimlik tekilliği, GÖSTERİM çakışması (kapı gerçek bir çakışma buldu: `AL995` alümina ↔ `Al99,5` saf alüminyum, ρ 3890 ↔ 2710), 0 ≤ ν < 0,5, σ_ak ≤ σ_ç, σ_ak'ın gevrekte null olması (0 DEĞİL), sınıf başına E ve ρ pencereleri ve **türetilen G = E/2(1+ν)**'nün sınıf aralığına düşmesi (ν ondalık kaymasını yakalayan asıl kapı — 0,03 da ν aralığından geçer, G'den geçmez). **Uçtan uca**: HER kaydın `veStrMatValidate`'ten hatasız geçmesi, gevrek kayıtların akma uyarısını, elastomerlerin kilitlenme uyarısını ÜRETMESİ. **Çapa değerler** ve özgül dayanım sıralaması (Ti > Al > çelik). **Arama**: Türkçe katlama (`toLowerCase` tek başına yetmez), ayıraç bağımsızlığı (1.4301 = 14301), parça eşleşmesi ("304" → 304, 304L değil), aile terimlerinin (`fam`) tekillik beklemeden bütün aileyi getirmesi, boş sorgunun AİLEYE göre sıralanması (alfabetikken 16 aile için 30 başlık basılıyordu). **Kayda çevirme**: kopya olması (katalog güncellemesi eski projeyi bozmaz), `lib`/`libVer` izi, referans alanların (λ, c_p) kayda GEÇMEMESİ. **Genişletilmiş veri**: her kaydın uzama/servis sıcaklığı/sertlik ölçeği (metalde HB, seramikte HV, termoplastikte Shore D, elastomerde Shore A), **Rm/HB oranının sınıf penceresi** (ISO 18265; gri dökme demirin oranı çelikten AÇIKÇA farklı). **Sıcaklık eğrileri**: 20 °C'de k=1, monoton düşüş, EN 1993-1-2 çıpaları (kY 500/600/700 = 0,780/0,470/0,230 · kE 400 = 0,700), kY'nin 400 °C'ye kadar 1,000 kalması ama kP'nin çoktan düşmesi, DOĞRUSAL ara değerleme, aralık dışında EKSTRAPOLASYON YOK, alüminyumun 200 °C'de dayanımının üçte ikisini kaybetmesi, 5xxx'in 6xxx-T6'dan ısıda daha iyi olması, ferritik/martenzitiğin östenitik eğrisini KULLANMAMASI, eğrisi olmayan sınıfta null; **std ↔ tipik sınıflandırmasının SABİTLENMESİ** (bir el kitabı eğrisini sessizce standarda yükseltmek genel testten geçiyordu). **Wöhler**: σ_W = f_W·Rm, monotonluk, Rm'de KESİM, çelikte dayanma sınırı VAR / alüminyumda YOK, dizde süreklilik, LCF sınırının hesaplanması, σ_ç olmayan kayıtta model üretilmemesi |
| `tests/unit/cp-structural.test.js` | `js/cp-structural.js` + `js/components.js` | **Yapısal Analiz iskeleti**: alt-sistem sözleşmesi, zincirin PORTLARLA zorlanması (Geometri girişsiz / Sonuçlar çıkışsız), başlangıç kenarlarının indisle değil TİPLE yazılı olması, panel smoke testleri, iskeletin BEŞ dosyaya birden bağlı olduğu (components / cp-core / ui-core / topology / index.html — biri unutulursa kaydedilen proje bozulur). **Geometri ve Hesaplama Ağı artık DOLU**: hâlâ iskelet olan panel sayısı iki (biri dolunca liste güncellenmeli), Ağ zincirinin BEŞ dosyaya birden bağlı olması (remesh / mesh-model / gömülü .wasm / vendor glue / cp-core görüntüleyici kancası) ve köprünün remesh'ten SONRA yüklenmesi, CI'ın TetGen .wasm + AGPL-3 lisansını Pages'e kopyalaması, içe aktarma yüzeyi + sürükle-bırak bağlı, geometri YOKKEN 3B kanvas kurulmuyor, kaynağın projeye yazılıp yazılmadığı AÇIKÇA yazılı; vendorlu okuyucu/.wasm/lisans deposu ve CI'ın .wasm'ı Pages'e kopyalaması; **panel ölçüsü** — büyük pencere sınıfı yalnız parça yüklüyken veriliyor, kutunun ölçüsü satır içinde değil sınıfta, boşluğu yutan flex zincirinin her halkası yerinde; **üç varsayılan** — incelik seçicisi ve "Kenarlar" kutusu YOK (sabit + hep açık), yüz inceleme kipi KAPALI başlar ve liste ile 3B künyesini tek anahtarla birlikte açar, kapalıyken raycast yapılmaz. **Ağ paneli**: köprü `ok:false` döndürünce ya da reddedince SEBEP ekranda KALIYOR — mesaj `showNodeProperties`'ten SONRA yazılıyor, tersi paneli innerHTML ile baştan kurup mesajı siliyordu (kullanıcının "ne hata veriyor ne başka bir şey" dediği sessizlik). **Malzeme ve Özellikler**: alt bileşen sözleşmesi (çıkışı YOK → zincire ara halka olarak sokulamaz; kutu zincirinkinden küçük; giriş ÜST kenarda), ν ≥ 0,5 tekillik kapısı ve 0,49–0,5 kilitlenme uyarısı, ρ'nun kg/m³ → ton/mm³ çevrimi (7850 → 7,85e-9) ve girilmemiş ρ'nun 0 DEĞİL null olması, G/K formülleri, bağın TELDEN okunması, rozetin yalnız çözülebilir kayıtta amber olması, eski kayıtlardaki `output` adının yeni `output-0` ile aynı noktaya düşmesi (göç gerekmiyor), Geometri adının SOLA alınması ve bunun düğüme gerçekten yazılması. **Malzeme kütüphanesi paneli**: iki sütun (solda katalog / sağda uygulanan kayıt), geçerlilik sınırının listenin ÜSTÜNDE olması, kütüphane yüklenmezse panelin sessiz kalmaması, uygulanan kaydın KOPYA olması, izin üç durumu (katalogdan geldi / elle değişti / hiç gelmedi), aynı satıra ikinci tıkın seçimi kaldırması ve seçimin düğüme HİÇ yazılmaması, aile başlığı sayısının aile sayısına eşit olması, uzun katalog adlarının rozette ayırt edici parçayı koruması (`EN AW-6082 T6` → `AW-6082 T6`), 112 kaydın hepsinin tek tek seçilip uygulanabilmesi. **Diyagramlar**: 112 kaydın hepsinde üç diyagramın da SONLU koordinat üretmesi (NaN'lı bir yol tarayıcıda sessizce çizilmez), σ–ε'nin orijinden başlaması ve gevrekte akma çizgisi ÇİZMEMESİ, Wöhler eğrisinin monoton düşmesi + LCF bölgesinin taranması + alüminyumda "dayanma sınırı YOK" yazması, sıcaklık eğrisinde karbon çeliğinin ÜÇ serisi (östenitikte orantı sınırı verisi yok → seri de yok) ve azami servis çizgisi, TİPİK eğrilerde kaynak türünün açıkça yazılması, model sınırlarının diyagramların altında durması, ELLE girilen kayıtta diyagram olmaması ve sebebinin yazılması, sıcaklık değerlendiricisinin düğüme HİÇ yazmaması, uygulanan kaydın listede görünür yapılması, **katalog sütununun DAR ve sabit olması** (oranı geri çevirmek hiçbir testi kırmıyordu) |
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
| `tests/e2e/structural-geometry.spec.js` | Geometri bileşeni (uçtan uca) | **GERÇEK tarayıcı**: gömülü 62,8 MB wasm'ın worker'da açılıp derlenmesi → OCCT → **boolean** → panel künyesi → WebGL sahnesi; **7 gövdeli parça TEK KATI olarak geliyor** ve panel bunu yazıyor (worker'da, künyeye de giriyor); fareyle CAD YÜZÜ vurgusu (üçgen değil), ağ inceliği değişince üçgen değişip kimliklerin sabit kalması, STEP olmayan dosyanın sessizce yutulmaması, **ölçüm kaplamasının STEP alanında çekilip asılı kalmaması**; **arayüz donmuyor** — içe aktarma boyunca çizilen kare sayısı ana iş parçacığında ≤3, worker'da >20 (ölçümde 1 ↔ 91), panelin gerçekten worker'a gitmesi ve ilerleme kartının aşama değiştirip iş bitince kapanması; **kanvas rozeti** (boşken `STEP`, doluyken `⬡18`), **CAD yüz listesi** (18 satır; listeden tık → 3B'de vurgu, 3B'de gezinme → listede işaret, 3B'de tık → listede seçim, ikinci tık seçimi kaldırır, DÖNDÜRME seçimi bozmaz), **kaynağın yalnız dosyaya yazılması** (künye ve otomatik yedek kaynaksız); **görüntüleyicinin boyu** — parça yüklenince pencere ekranı kullanıyor, sol ray ile 3B kutusu AYNI yerde bitiyor (boşluk 290.6 → 0 px), kanvas o ölçüde kuruluyor ve içerik kaydırmıyor; **varsayılanlar** — incelik/kenar kontrolü panelde yok ve her içe aktarma 0.0005 ile geliyor, yüz listesi ve fare künyesi kullanıcı açana kadar çıkmıyor, kapatınca hiçbir işaret kalmıyor. Bu halkalar Node'da HİÇ koşmuyor |
| `tests/e2e/results-txt-page.spec.js` | TXT rapor önizlemesi (yerleşim) | **GERÇEK tarayıcı**: iki bandın AYNI yerde bitmesi (ölçülen eski fark 12 px), başlıkların aynı punto, sayfanın 794 px = A4 olması, metnin tek blok / tek sol kenar kalması (eski: 43 blok, 10 kenar), 119 sütunluk tablonun sayfaya sığması (yatay kaydırma yok) ve dar raporun tavan puntoyla açılması. Rapor METNİ sahte — ölçülen şey kabuk; bu halkalar Node'da HİÇ koşmuyor |
| `tests/unit/fead-wizard.test.js` | `js/cp-fead-wizard.js` + `js/components.js` + `js/cp-fead.js` | **Başlangıç Sihirbazı**: bileşen sözleşmesi (0/0, `maxInstances:1`, palet + kayıt defteri + panel dağıtımı + çift tık + modal kabuğu + CSS sınıfları), betiğin `cp-fead.js`'ten SONRA yüklenmesi, başlangıçta İKİ açılış yüzeyi; **durum → düğüm çevirisi iki örneği de BİREBİR geri üretiyor** (AG00976 L 1714,6 · T 544,05 · rel 28,075 · BMC L 1715,0 · T 532,142 · rel 28,4271) ve duty kW anahtardan kimliğe çevriliyor — çevrilmezse sonucun gerçekten değiştiği İKİ UÇTAN tutuluyor; gerginin TEK koordinat taşıması (kasnak merkezi ve kip alanı YOK, kayış boy kipi yazılmaz — boy yapısal olarak çıktı); sıra/sürücü/satır kuralları (ilk kasnak sürücü doğar, sürücü tek, gergi sıraya kendiliğinden girer, kasnak silinince duty sütunu da düşer, tip değişince temas tarafı tipin varsayılanına döner, sırayı çevirmek yönü çevirir); kurulum kapısı (mevcut kasnakla kapalı + sebep, onayla açık) ve kurulum (6 kasnak + 6 tel, kW göçü, **kurulan model önizlemeyle birebir**, sihirbaz düğümü KALIR / örnek düğümü GİDER, temizle işaretliyse teller de gider); adım eşlemesi, yedi adımın boş ve dolu durumda `undefined`/`NaN` basmadan çizilmesi, taslağın düğüme yazılıp KALDIĞI YERDEN açılması ve **form içi düzenlemenin `saveState` çağırmaması**; **gergi satırı** (2. adımda sanal olarak var, sürücü olamaz ve silinemez, X/Y'si gerginin **montaj konumu** — `cenX/cenY`'ye ASLA yazmıyor — ve hangi nokta olduğu çipte yazılı, satırın yazdığı yer 4. adımın okuduğu `st.ten`'in ta kendisi); **künye etiketi** tek üreticiden (`veFeadTenLabel` → `kol 90 mm · 22.07 Nm`), 14 kayıt 14 AYRI etiket, panel de aynı üreticiyi kullanıyor ve künye uygulaması `veFeadTensionerApply`'a devrediyor — kendi beyaz listesi `tenPart`/`inertia`'yı yutuyor ve kodsuz künyede eski kodu bırakıyordu (pim *"kod yok"* diyordu, oysa kayıtta kod VAR); **katalog önerisi** bloğunun bulunmaması; **aksesuar modelleri** (duty kW hücresi GİRDİ değil okuma, `_fwKwEff` önceliği köprüyle aynı — duty kW > kasnak eğrisi > katalog > 0 — model seçince kayıtlı kW'ın TEMİZLENMESİ ki katalog devreye girsin, ölçüldü: ALT 3,61 → 7,62 kW, ve güç kaynağı olmayan yük taşıyıcının adıyla uyarılması); **özette kol açısı künyesinin OLMAMASI**; **adım rayının üç durumu** (`veFeadWizStepState` köprünün KENDİ listesinden türüyor, hata uyarıyı bastırıyor, boş sihirbazda `st-err` / dolu örnekte yedi `st-ok` + `✓` rozeti, yedi adımın yedisi de durum sınıfı ve rozet taşıyor — sessiz adım yok — ve DURUM ile ODAK ayrı kanallar: konumsal `done` emekli); **alt çubuk dolgusunun** modal başlığının bandını aşmaması | · **ikinci tur**: gergi satırının TİP sütunu bileşenin ADINI basıyor ve künye seçici ONUN ALTINDA, ad yer tutucusu ile kurulan düğümün `customName`i AYNI üreticiden (`_fwTenAd` → `Otomatik Gergi`, palet adı "Gergi" iken); **dönüş yönü** seçimi durum TUTMAZ (sırayı çevirir, `st`'ye `spin/dir/yon` yazılmaz), aynı yönü seçmek hiçbir şey yapmaz, geometri BİREBİR sabit (L ve rel 6 hane), iki adım AYNI üreticiyi basıyor, yön okunamazken düğmeler kapalı ve CW ↔ CCW aynı renkte; **künye kilidi** (`readonly`, `disabled` değil — sayı okunur kalır), montaj konumu ASLA kilitlenmez, "elle gir" kilidi açar ve künyenin değerlerini KORUR, satır ile 4. adım aynı okuyucudan, kilit çözümü değiştirmez; **kayış adımı** Profil/Marka/kanal DURUYOR ama Künye · Malzeme · kip seçicisi YOK, `beltDataMode` koşulsuz `none`, ve SORULMAYAN alan TAŞINMAYAN alan DEĞİL (örneğin `beltType`/`tolerance`/`wearPct`/`massPerRibKgM` kayış düğümüne gidiyor); **güç geometriden bağımsız** — koordinatsız modelde katalog kW'ı geliyor ve devirle değişiyor, oran bile kurulamıyorsa sebep AYRI (`cozumsuz` ≠ `yok`), çözülmüş modelde `ratioSys === sys`; **girdiler topolojiye ulaşıyor** — `accPreset` düğüme yazılıyor VE bileşenin kendi panelinde `selected` görünüyor, gergi tek koordinat taşıyor, kW sözlüğü kanvas kimliğine göçüyor, kurulan modelin çözümü önizlemeyle birebir; **serpantin sırası** — OKUNAN ve YAZILAN sıra birleşti: çevirme gerçekten çeviriyor (elle kurulmuş modelde gergi SONDA kalıyordu → L 1714,61 → 2459,29 mm), gergi satırının ok düğmeleri artık ölü değil, ve iki kez çevirmek birim işlem; **üçüncü tur** — yüklenen örnek kartı işaretli ve iz çözüme GİRMİYOR, işaret karttan karta geçiyor, "Boş başla" da bir seçim; gergi satırında künye seçicisi YOK (4. adımda VAR) ve çip yok ama uyarı alanın `title`'ında + kartta duruyor; Kayış Yolu'nda CCW/CW yok, "Yönü çevir" var; aksesuar tablosu `table-layout:fixed` + oranlı colgroup ve model seçmek oranları değiştirmiyor; kaydırma konumu aynı adımda korunuyor, adım değişince sıfırlanıyor, içerik kısalınca kırpılıyor; `.ve-fw-tip-ten` kuralı TEK KEZ tanımlı ve `.ve-fw-sub` hiçbir yerde yok
| `tests/e2e/fead-wizard.spec.js` | Sihirbaz (uçtan uca) | **GERÇEK tarayıcı**: çift tıkla açılış, yedi adımlık ray, örnekten doldurunca canlı şeridin `✓ model çözülüyor` + L/T/yön basması ve hata rozetinin kalmaması, **gerçek klavye girişinde odağın alanda KALMASI** (canlı şerit yama; tam yeniden çizim odağı düşürürdü), özet adımında kayış yolu şemasının SVG olarak çizilmesi, "Modeli Kur"un kanvasa 6 kasnak + 6 tel kurup **önizlemeyle birebir aynı çözümü** vermesi, modalın ekrana sığması ve gövdenin yatay kaydırmaması; **gergi satırı** 2. adımda altıncı sırada — künye seçicisi ve amber X/Y çipi yerinde, sürücü radyosu ile silme düğmesi `disabled`, koordinat alanına gerçek klavye girişi odağı düşürmeden modele işliyor ve 4. adımda aynı sayı görünüyor; **aksesuar modeli** seçilince duty hücreleri katalog sayısına dönüyor ve kaynak sütunu `katalog` yazıyor; **alt çubuk** modalın kendi başlığıyla aynı bantta (48 → 40 px, başlık 39) ve düğmeler ≤26 px; **adım rayı** üç durumu HESAPLANMIŞ RENKLE yakıyor (sınıf adı değil — `st-ok` CSS kuralını silen mutasyon yalnız buradan görünür): boş sihirbazda kırmızı + sayı, örnekte yedi yeşil + ✓, bir çap silinince o adım ayrışıyor ve kalan altısı yeşil kalıyor. Bu halkalar Node'da HİÇ koşmuyor |
| `tests/e2e/fead-wizard-tur2.spec.js` | Sihirbaz — ikinci kullanıcı turu | **GERÇEK tarayıcı**: gergi satırının TİP sütunu `Otomatik Gergi` yazıyor ve künye seçicisi onun altında, sürücü radyosu ile silme düğmesi `disabled`, **başlık↔gövde sütun hizası ≤1 px** (kullanıcının bildirdiği "garip yapı" bir CSS `display` kaçağıydı ve hizayı ancak tarayıcı ölçer); dönüş yönü düğmesine GERÇEK tık sırayı çeviriyor, `spin` +1 → −1 oluyor ve kayış boyu **13 basamak birebir** kalıyor; künye seçilince 6 alan `readonly` ama montaj konumu DEĞİL, "elle gir" seçilince kilit kalkıyor ve **künyenin değeri korunuyor** (`armLen` 56); kayış adımında Künye/Malzeme/kip seçicisi ekranda YOK, "Gereken boy" ve "KAPALI" VAR; aksesuar modeli seçilince duty okuması `2.70 → 1.74 kW` değişiyor. Bu halkalar Node'da HİÇ koşmuyor |
| `tests/e2e/fead-wizard-tur3.spec.js` | Sihirbaz — üçüncü kullanıcı turu | **GERÇEK tarayıcı**: yüklenen örnek kartı hesaplanmış GÖLGE taşıyor (sınıf adı değil) ve kenarlığı diğerlerinden farklı, işaret tek kartta; gergi satırının sütun hizası tutuyor ve **yükseklik farkı 0 px** (iki katmanlı tip hücresi + çip satırı şişiriyordu), TİP hücresi düz metin, çip yok, X alanının `title` ipucu montaj noktasını söylüyor; Kayış Yolu'nda `.ve-fw-spin` **0 adet** ama "Yönü çevir" ve canlı şeritteki yön okuması duruyor; aksesuar modeli seçilince başlık genişlikleri ve açılır liste **birebir sabit** (eski: 362 → 283 px); çevrim seçilince gövdenin `scrollTop`'u **548 → 548** (eski: 900 → 0) ve adım değişiminde 0. Bu halkalar Node'da HİÇ koşmuyor |
| `tests/e2e/fead-canvas-drag.spec.js` | FEAD kanvas ↔ mm zinciri (uçtan uca) | **GERÇEK tarayıcı**: fare sürüklemesi → `veAttachNodeDrag` → `veFeadSyncDrag` → mm → topoloji imzası → Kayış Yolu kartının yeniden kurulması → yeni L_eff. Node'da HİÇ koşmayan halkalar: gerçek `mousedown/mousemove/mouseup`, `canvasZoom` bölmesi, DOM'a yazılan `style.left`, kartın `innerHTML` ile kurulması. Kart sürüklerken CANLI tazeleniyor (bırakmayı beklemiyor), kayış kipi rozeti gerçek tıkla değişiyor ve çözüm kipe uyuyor, "Otomatik Düzenle" koordinatları silmiyor. **Dönüş Yönü**: rozet tıklanınca kablolar gerçekten çevriliyor, kanvastaki gidiş okları onunla dönüyor (bayrak yolunda ok yalan söylerdi), kartın `data-fead-anim` künyesindeki `sense` +1 → −1 oluyor ama `loop` ve `L` birebir sabit kalıyor (geometri yönden bağımsız), ikinci tık başa döndürüyor. **Konum Bağı**: rozet tıklanınca kapanıyor (kutu oynuyor, mm ve kartın `L`'si birebir sabit), yeniden açınca kutu koordinatına dönüyor ve `style.left` de tazeleniyor, kapalı bağda kenetleme geri geliyor, kapalı düğümü SİLMEK kutuları oturtuyor ve sonraki 1 px yine 1 mm ediyor (kanca yokken 81 mm ediyordu). **Örneğin yeni hâli**: kesikli çap hayaleti DOM'da HİÇ YOK, sol şerit `Kayış Özellikleri → Çözücü → Rapor` (başlangıç kutusu yok), kart 440×500 ve SVG'si `0 0 440 458`, kayış yolu 400 px'ten geniş — yani yön gülü şeridi AYRILMAMIŞ (ayrılsaydı 350 px olurdu). **Kenetleme kapısı**: `SNAP_ENABLED` açıkken bile kasnak istendiği kadar oynuyor (kapatılmasa 24.514 mm istenirken 3.940 mm olurdu — varsayılan kapalı olduğu için ancak açıkça açılarak yakalanıyor) |
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

## Artifact önizlemesi KALDIRILDI (2026-08-25)

Bir dönem tek dosya claude.ai'ın Artifact sayfası olarak yayınlanıyordu
(`tools/build-artifact.js` → `MFSim_Artifact.html`, gövde varyantı + ortam
bayrağı `js/env.js`). Kullanıcı **kullanmadığını** söyledi ve kaldırıldı.

Kaldırmayı tetikleyen şey de bu zaten bir kapıydı: boolean'lı OCCT çekirdeğine
geçince tek dosya 12,6 → 26,8 MB oldu ve **artifact'in 16 MB sınırı** CI'ı
kırdı. Kullanılmayan bir varyantın, uygulama her büyüdüğünde merge'i bloke
etmesinin karşılığı yok.

Kalkanlar da onunla gitti: `js/env.js` (`veArtifactEnv` / `veNetworkAllowed` /
`veOfflineNote`) ve onu okuyan dört kapı — deploy noktası, commit listesi,
harita, canlı radyo — artık koşulsuz çalışıyor. Bunlar zaten yalnız artifact
ortamında kapanıyordu; Pages ve indirilen tek dosya sürümlerinde hep açıktı,
yani **davranış değişmedi**.

> Yeniden gerekirse: gövde varyantının üç sessiz tuzağı ölçülmüştü — sahte
> `</body>` (rapor üreticileri HTML şablonu basıyor, gerçek belgede 3 kez
> geçiyor; `maskRawTextKeepOffsets` bunun için var ve **build.js'te KALDI**),
> `data-theme` çakışması (host aynı özniteliğe yazıyor), ve script/style
> sayımının JS içindeki şablonları da sayması. Git geçmişinde duruyor.

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
