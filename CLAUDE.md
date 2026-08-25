# MFSim - Claude Code Talimatları

## Proje Yapısı
Tarayıcı tabanlı Motor Fren Simülasyonu uygulaması (saf HTML/CSS/JS, framework yok).

- `index.html` — Ana sayfa (modüler versiyon, js/ klasöründen script yükler)
- `MFSim_Code.html` — Tek dosya versiyonu (otomatik üretilir, elle düzenlenmez, **git'e dahil değil** — `npm run build` üretir, CI deploy Pages'e yayınlar)
- `js/` — Modüler JavaScript dosyaları
- `css/` — Stiller
- `build.js` — Build script (`index.html` + `js/` + `css/` → `MFSim_Code.html`)
- `js/structural-materials.js` — Yapısal Analiz malzeme kütüphanesi (112 kayıt / 16 aile,
  DOM'suz saf veri + arama). Değerler standartların NOMİNAL değerleridir, sertifika değil.
- `js/structural-occt-wasm.js` — **Üretilen** (elle düzenlenmez): STEP okuyucusunun .wasm'ı
  gzip+base64 gömülü. `npm run build:occt-wasm` üretir, git'e dahildir; `vendor/occt-import-js.wasm`
  değişirse YENİDEN ÜRETİLMELİ (testi bayt bayt karşılaştırıyor).
- `js/structural-tetgen-wasm.js` — **Üretilen** (elle düzenlenmez): ağ üretecinin .wasm'ı
  gzip+base64 gömülü. `npm run build:tetgen-wasm-asset` üretir, git'e dahildir.
  `.wasm`'ın kendisi de üretilen: `npm run build:tetgen-wasm` (emscripten gerekir,
  kaynak `vendor/tetgen-src/` + `tools/tetgen-wasm-src/`). Aynı bayt-bayt kapısı.
- `tools/shot.js` — Ekran görüntüsü aracı (İSTEĞE BAĞLI — yalnız kullanıcı isteyince; `npm run shot -- --help`)
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
| Telin ortasında **gidiş yönü oku** | `veConnDirMark` (connections.js), `.ve-conn-dir` | Aynı halka iki yönde de gezilebilir ve **sarım açıları buna göre değişir**; yön topolojiden okunamıyordu |

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

##### "Otomatik Düzenle" FEAD'de HALKA kurar (`veFeadArrangeRing`)

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
düğümleri halkanın DIŞINDA: künyeler sol, 420×340'lık Kayış Yolu kartı sağ
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
yolunun üstüne düşüyordu (Klima ↔ Avara 1 açıklığı oradan geçiyor).

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
taşır — yerleştirici (`veFeadArrangeRing`) ve rozetler kopuk kasnağı da görmeli;
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
duran ölçekli bir şema (420×340). Girdi değiştikçe yeniden çizilir, yani
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

**GERÇEK ZAMAN OLMAZ — ÖLÇÜLDÜ** (BMC, 420×340 kart, 0.553 px/mm):

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

##### Yön gülü TAŞINABİLİR — ve taşınınca şeridini şemaya bırakır

Gül varsayılan yerinde (sağ alt) dururken şemadan **54 px'lik bir sağ şerit**
ayrılıyor: 420 px'lik kartın sekizde biri, yalnız dört sayı için. Kartı
daraltmak isteyenin önündeki asıl engel buydu.

Gül artık sürüklenebiliyor (`veFeadCompassDragStart`) ve **taşındığı anda şerit
ayrılmaz** — yer açma sorumluluğu kullanıcıya geçtiği için. Taşımak bir tercih
bildirimidir; çift tık varsayılana döndürür ve şerit geri ayrılır.

**Kazanç kart DARALDIKÇA doğuyor.** Ölçek `s = min(genişlik/spanX,
yükseklik/spanY)`; kart genişken bağlayıcı olan yükseklik, yani şerit ölçeği hiç
kısıtlamıyor. **ÖLÇÜLDÜ** (BMC, en büyük kasnak yarıçapı px):

| düğüm ölçüsü | şeritli | şeritsiz | kazanç |
|---|---|---|---|
| 420×340 (varsayılan) | 45.5 | 45.5 | %0.0 |
| 380×340 | 41.7 | 45.5 | %9.1 |
| 340×340 | 35.9 | 43.7 | **%21.6** |
| 300×300 | 30.2 | 37.9 | **%25.7** |
| 240×260 | 21.6 | 29.3 | **%36.0** |

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
>   **değiştirilebilir** olması. `vendor/occt-import-js.wasm` depoda,
>   lisans metinleri dağıtımda, `npm run build:occt-wasm` gömülü blob'u o
>   dosyadan yeniden üretiyor → koşul karşılanıyor. TetGen'in AGPL-3'ü için
>   gömme/gömmeme hiçbir şeyi değiştirmez: yükümlülük "dağıtılan build AGPL-3"
>   kararında zaten karşılanmış.

**Yeni bir ağır varlık eklerken sorulacaklar** (kural değil, ölçüm):

1. `gzip -9` sonrası base64 boyutu kaç MB? (`tools/build-occt-wasm-asset.js`
   bunu basıyor.)
2. Tek dosyanın toplamı kabul edilebilir mi? Bugün 12,64 MB.
3. Açılışta yüklenmiyor mu? (`type="text/x-mfsim-asset"` → ne tarayıcı ne
   `MFSimLoader` dokunur.)
4. Açma işi **worker'da** mı? Ana iş parçacığında base64+gunzip yüz
   milisaniyelik donma demek.
5. Kaynak dosya depoda kalıyor mu? (Yeniden üretilebilirlik + lisans + eski
   tarayıcı yedeği.) Ve gömülü içeriğin kaynakla **bayt bayt** aynı olduğunu
   doğrulayan bir test var mı?

TetGen geldiğinde bu beş soru yeniden sorulacak; boyutu **ölçülmedi**, occt'ye
bakarak tahmin edilmeyecek.

##### Geometri — STEP içe aktarma (`js/structural-model.js` + `cp-structural-viewer.js`)

Zincirin ilk bileşeni. FEAD'deki üç katmanın aynısı:

| Dosya | Katman | Kural |
|-------|--------|-------|
| `vendor/occt-import-js.*` | Hesap çekirdeği | **Dışarıdan geldi, birebir durur** (npm `occt-import-js@0.0.23`, LGPL-2.1). `fead-core.js` ile aynı kural |
| `js/structural-model.js` | Köprü (DOM'suz) | Ham occt çıktısı → MFSim modeli; yüz kimliği, sınır kutusu, hata çevirisi |
| `js/cp-structural-viewer.js` | Sunum (THREE) | Kanvas, kamera, yüz vurgusu. Kalıp `cp-mount-viewer.js` |
| `js/cp-structural.js` | Sunum (HTML) | Panel, dosya alma, künye. **Kendi geometrisini hesaplamaz** |
| `js/structural-materials.js` | Katalog (DOM'suz) | 112 malzeme / 16 aile + arama. **Sunum katmanında tek bir malzeme değeri yazılı değil** |

**.wasm UYGULAMAYA GÖMÜLÜ — çevrimdışı çalışır.** `js/structural-occt-wasm.js`
(gzip+base64, **3,96 MB**; ham 7,25 MB) uygulamanın içinde taşınıyor ve **ilk**
içe aktarmada talep üzerine çalıştırılıyor (`type="text/x-mfsim-asset"` →
açılışta ne tarayıcı ne `MFSimLoader` dokunur; `js/mount-report-assets.js` ile
aynı kalıp). Üretim: `npm run build:occt-wasm`.

**ÖLÇÜLDÜ (gerçek tarayıcı):**

| senaryo | okuyucu | içe aktarma sırasında ağ isteği |
|---|---|---|
| Tek dosya, ağ açık | `(gömülü)` ✓ | yalnız `blob:` worker URL'i |
| Tek dosya, **ağ kesik** | `(gömülü)` ✓ | **hiç yok** |
| **`file://`** (indirilmiş dosya) | `(gömülü)` ✓ | yalnız `blob:` |
| Modüler (geliştirme) | `(gömülü)` ✓ | kendi iki dosyası |

**gzip ŞART:** ham base64 7,25 MB'ı **9,67 MB**'a çıkarırdı; `gzip -9` ile
3,96 MB. Açma `DecompressionStream('gzip')` ile ve **worker'da** — 3,96 MB'lık
dizgiyi ana iş parçacığında çözmek yüz milisaniyelik bir donma demekti, yani
kaçındığımız şeyin ta kendisi.

**`vendor/occt-import-js.wasm` depoda KALIYOR** ve CI onu `_site/vendor/`'a
kopyalamaya devam ediyor — üç sebeple: gömülü varlığın kaynağı, `DecompressionStream`
bilmeyen tarayıcı için yedek, ve LGPL-2.1'in *"kütüphane değiştirilebilir
olmalı"* koşulunun karşılığı. Bir test gömülü içeriğin vendor dosyasıyla
**bayt bayt aynı** olduğunu doğruluyor: vendor güncellenip varlık yeniden
üretilmezse program sessizce ESKİ okuyucuyu taşırdı.

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

**Paketin kendi worker'ı (`occt-import-js-worker.js`) KULLANILMIYOR** — üç
eksiği var: `locateFile` ile GÖRELİ yol çözüyor (worker dosyasının glue'nun
yanında durmasını şart koşar; tek dosya sürümünde o dosya yok), ilerleme
bildirmiyor, sonucu KOPYALAYARAK geri veriyor. Bizimki **Blob'dan** kuruluyor:
glue metni + `VE_STR_WORKER_BRIDGE` tek Blob'a yazılıp `new Worker(blobURL)` ile
açılıyor → hiçbir dosya yolu varsayımı yok. Üçgenler **tipli dizi olarak
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

###### Panel İKİ SÜTUN — bölüşüm görüntüye göre değil SORUYA göre

Solda katalog (ara · süz · liste · seçilenin künyesi), sağda parçaya
**uygulanmış** kayıt. "Hangi malzemeler var" ile "bu parçanın malzemesi ne"
ayrı iki soru ve ikincisi birincisine bakarken görünmek zorunda — yoksa
kullanıcı uygulayıp uygulamadığını unutuyor.

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
| `tests/unit/fead-model.test.js` | `js/fead-model.js` | **Köprü kapısı**: AG00686 MFSim KANVAS DÜĞÜMÜ olarak kurulup Gates sayılarını üretiyor mu (span %0.5, sarım 0.2°, Mean kol açısı 0.2°); temas tarafı üç katmanlı çözümü, sürücü rolü, `dia→od` göçü, ad tekilleştirme, hata çevirisi. **Güzergâh teşhisi**: tel silinince çözüm ARTIK aynı kalmıyor (eskiden kopuk kasnak sıraya sessizce ekleniyordu), kopuk kasnak adıyla bildiriliyor, kapanmayan zincir ve çatal (bir kasnaktan iki tel) sebebiyle yazılıyor, `veFeadRouteOrder` sözleşmesi (yerleştirici için bütün kasnaklar) korunuyor. Ayrıca **ters temas tarafının hata VERMEDİĞİNİ** belgeler (rozetin varlık nedeni). **Duty kapısı**: AG00686 duty tablosunun çıkış gerilmeleri ve hubload'ları %0.5 içinde; kW'ın kimlikle anahtarlanması (yeniden adlandırmada kaybolmuyor), sürücü gücünün toplamdan hesaplanması, ateşleme frekansı, yorulma dağılımının çapa bağlı olması, katalog oranının ÇAPTAN hesaplanması. **Sıcaklık kapısı**: satır başına °C → tek °C indirgemesi hasar-eşdeğer (tek sıcaklıkta birebir aynı, dağılımda aritmetik ortalamanın üstünde), ağırlık `dc·v`, açıkça girilen %0 sıfır ağırlıklı; **yorulma modeli** seçimi dağılıma geçer, mutlak ömre geçemez ve bu yazılır. **Burulma köprüsü**: gergi kasnak kütlesi ve KRANK MİLİ ataleti çekirdeğe geçiyor (ölü girdiydi), krank adla anahtarlanır, `analyze()` içindeki çift hesap kapalı, eksik atalet sessiz değil |
| `tests/unit/cp-fead.test.js` | `js/cp-fead.js` + `js/components.js` | FEAD sunum katmanı: **yön gülünün taşınması** (kenetleme, kesir olarak saklama, taşınınca şeridin şemaya bırakılması — dar kartta ölçülen kazanç, geniş kartta kazanç YOK, hareketsiz tıkın hiçbir şey yazmaması, kancanın yalnız kanvas/panelde kurulması); kanvas rozeti, `feadContact` varsayılanları, panel smoke testleri, alt-sistem sözleşmesi, `fead-*` tip tanımları; panelin HANGİ ALANLARI sorduğu (montaj merkezi ↔ serbest açı), servis faktörü hükmü; **kayışın kaburgalı yüzü** (diş yönü + aynalanmış çevrim), **telin komşuya bakan kenarı** (oran kuralı, elle taşınan portun kazanması) ve **`veFeadArrangeRing`** (ortak çember, kayış sırası, kutudan türeyen yarıçap, araçların halka dışında kalması, `veTidyLayout`'un devretmesi) |
| `tests/unit/cp-fead-report.test.js` | `js/cp-fead-report.js` + `tools/report-assets/fead-theory-source.html` | **Rapor içeriği**: Türkçe sayı biçimi (gerçek eksi, `—` ≠ 0), `wearPct` oran→yüzde çevrimi, sarım açılarının DERECE basılması, Σsarım=360 ve `L_pitch−L_eff=2πh_b` denetimlerinin belgede görünmesi, sürücü kW sütununun duty tablosunda OLMAMASI, çözülemeyen konumun `Err.` ile işaretlenmesi, `undefined`/`NaN`/`[object` sızmaması, "ortalama tork ≠ peak", sistem burulma modunun yokluğunun yazılması, uygunluk hükmünün servis faktörünü kullanması, şekil/tablo numaralarının boşluksuz ve her üretimde sıfırlanması, şablon tokenlarının tek kez geçmesi, içindekiler id'lerinin üreteçle aynı olması; **tasarım gerginliğinin kaynağı**: (8.x) denklem zincirinin ELLE ÇALIŞILABİLİR olması (çevrim çarpanı bir kez TERS yazılmıştı — basılan denklem 650 N yerine 2,13 N veriyordu), girdi ↔ türev envanteri, take-up'ın GİRDİ OLMADIĞI, tasarım gerginliğinin TÜRETİLDİĞİ (T = M/(dL/dθ) formülü ve sayısı belgede, "sorulmaz" yazılı, eski karşılaştırma tablosu YOK, eski kayıttaki designTensionN raporu etkilemiyor); **φ kuruluşu**: her satırın φ'sinin BASILAN iki θ'dan yeniden çıkması, Σd·φ=360, sarım ve φ İŞARET yaylarının örtük merkezinin kasnak merkezinde olması ve süpürmenin kısa yola normalize EDİLMEMESİ (198°'lik sarımda 162° çizerdi); **§8.9**: take-up'ın ANLIK türev olarak adlandırılması, ortalama eğimin ayrı basılması, monoton olmaması; **etiket yerleştirici**: çakışma, kilitli alan ve çember engeli; **teori**: (4.3) türetmesi, §5.1 ankraj paragrafı, §10 sembolleri, şablona gerçekten girmiş olması |
| `tests/unit/fead-anim.test.js` | `js/cp-fead.js` animasyon + `js/fead-model.js` kinematik | **Kayış Yolu kartının animasyonu**: ω·r = v özdeşliği, ağır çekim katsayısının REFERANS devre bağlanması (seçili devre bağlansaydı seçici işlevsiz kalırdı — istenmeyen alternatif de koşturulup belgeleniyor), diş adımının çevreyi tam bölmesi, diş sayısının faz boyunca sabit kalması, bir adımlık fazın deseni birebir kendine getirmesi, dişlerin GİDİŞ yönünde ilerlemesi, kol açısal hızının `d·v/r` olması (sırttan temas edende ters) ve kol ucu çevresel hızının kayış hızına eşitliği (kasnakta kayma yok), animasyonun YALNIZ kanvas kartında olması, fazın düğüm kimliğinde durması (yeniden kurulumda kayış zıplamıyor), uzun duraklamada `dt` kırpması |
| `tests/unit/fead-example.test.js` | `js/fead-model.js` örnekleri + FEAD_INFORMATION | **Tedarikçi sayfası çıpası** (Gates'ten bağımsız ikinci doğrulama): kayış boyu 1715 mm, kol boyu 90.0 mm, Spring Mean Load 22.07 Nm, tahrik oranı 1.1; sayfanın devir→kW tabloları; **sessiz kanalın** ölçülmüş belgesi (montaj merkezi ↔ serbest açı 2.6×); **tasarım gerginliği TÜRETİLİR**: örnek onu taşımıyor, T = M/(dL/dθ) kuruluşu, eski kayıttaki değerin yok sayılması, türetilemezse sessiz kalmaması |
| `tests/unit/structural-model.test.js` | `js/structural-model.js` + `vendor/occt-import-js.*` | **STEP köprüsü**: GERÇEK dosyalar GERÇEK OCCT ile okunuyor (sahte veri yok). **Yüz kimliği ağ inceliğinden bağımsız** (üçgen değişir, `m<i>/f<j>` değişmez), yüz aralıkları üçgenleri boşluksuz/örtüşmesiz böler, `veStrFaceOfTriangle` eşlemesi, birimin mm'ye çevrilmesi, künyenin ÜÇGEN TAŞIMAMASI, hata çevirisi (bozuk dosya ≠ katısız dosya) + OCCT'nin kendi teşhisinin mesaja iliştirilmesi, .wasm aday-yol araması (ilk tutan kazanır, hiçbiri tutmazsa denenenler yazılır), oturumluk önbelleğin temizlenmesi. **Gömülü okuyucu**: `js/structural-occt-wasm.js` vendor .wasm'ıyla BAYT BAYT aynı (vendor güncellenip varlık üretilmezse kırmızı), WASM imzası, gzip'in gerçekten kazandırdığı, index.html'de AÇILIŞTA yüklenmediği. **Kaynak deposu**: künye STEP kaynağı TAŞIMIYOR (undo yığını), `veStrSrcAttach` KOPYALA-YAZ (canlı state'e tek yazma bile yok — kaynağın otomatik yedeğe sızdığı ölçülmüş hatanın kapısı), alt-topolojideki düğüme ulaşması, deposu olmayan düğümde gereksiz kopya üretmemesi, eski projelerin HAM `source` alanını da kabul etmesi. **Worker sözleşmesi**: köprü DOM'a dokunmuyor (worker'da `document`/`window` yok), sonuç tipli dizi + transfer, `brep_faces` worker'dan aynen geçiyor, normalize hem worker hem ana-iş-parçacığı biçimini kabul ediyor ve tipli diziyi YENİDEN KOPYALAMIYOR. **İlerleme**: `VE_STR_OCCT_WASM_BYTES` gerçek dosya boyutuna kilitli, indirme loaded/total/pct bildiriyor, tahmin tutmazsa yüzde gösterilmiyor |
| `tests/unit/structural-remesh.test.js` | `js/structural-remesh.js` | **Yüzey hazırlığının DEĞİŞMEZ kapısı**: modülün değeri min açıda ama asıl kapılar değişmezlerde — bir yeniden-mesh üç ayrı şekilde sessizce bozulur ve üçü de ekranda kusursuz görünür. Fikstürün KENDİSİ önce doğrulanıyor (küp DIŞA-CCW, hacim tam +1000, açık kenar 0 — yanlış sarımlı bir fikstür bütün hacim kapılarını anlamsız yapardı). **Topoloji**: açık kenar 0 + anormal (3+ üçgenli) kenar 0 — bu kapı geliştirme sırasında ÜÇ hatayı yakaladı (anlık görüntü üzerinde ikinci bölme → 1220 açık kenar, bağlantı koşulsuz birleştirme → 8 anormal, pasoda ikinci çevirme → 4 anormal). **Hacim**: 1000 mm³ %0,01 içinde — içbükey dörtgenin çevrilmesini normal denetimi GÖREMEZ (normaller aynı yönde kalır), yalnız hacim değişmezinden görünür (ölçüldü: 1000,000 → 1000,418). **Düğümler yüzeyde kalıyor** (teğetsel düzleştirme yüzeyden çıkarmıyor, sapma < 1e-9). **Kalite**: min açı > 30° ve 10° altı üçgen 0 (sırasız bölmeyle 45° → 0,20° ve %45,8). **CAD yüzü kimliği** her üçgende ve yalnız girdideki altı kimlik, altısı da temsil ediliyor. **Sliver iyileştirme**: kasıtlı ince üçgen enjekte edilmiş küpte min açı yükseliyor, topoloji ve hacim korunuyor. **Hedef kenar**: verilmezse katının KENDİ köşegeninden (÷40), kaba bir hedef katı başına TAVANLA kırpılıyor (÷8 — braket montajında 5,98 mm hedef 17 mm'lik parçaları çakıl taşına çeviriyordu). **Non-manifold**: temiz ağda 0, kusurlu ağda ÜRETİLMİYOR ve BÖLÜNEREK ÇOĞALMIYOR (4 kenar 303'e çıkıyordu). **Şekil ölçütü** min açıyla aynı yönde değişiyor (kapılar `acos` kullanamaz — düzleştirme 11,0 s sürüyordu) |
| `tests/unit/structural-mesh-model.test.js` | `js/structural-mesh-model.js` + `vendor/tetgen-wasm.*` | **Ağ köprüsü**: GERÇEK TetGen çekirdeği GERÇEK STEP dosyasında (sahte veri yok). **SINIR KOŞULU ZİNCİRİ** — occt `brep_faces` → remesh `faceIds` → TetGen `facetmarkerlist` → çıktı `trifacemarkerlist` → yeniden `m<i>/f<j>`: her sınır üçgeni bir CAD yüzüne bağlı (kayıp YOK), girdideki BÜTÜN yüzler çıktıda, kimlik biçimi Geometri bileşeniyle AYNI. **ELEMAN KUADRATİK** (`cornersPerTet === 10`) — tet4 bu modülde yasak, ölçüldü: 27.783 SD'de bile %24 RİJİT. **Dejenere/ters eleman yok**, `minTetVolume` eşiğin üstünde (kritik metrik `v_min`, `q_min` DEĞİL). **Hacim kaybı** %4 altında ve ağ hacmi yüzey hacmiyle tutarlı. **Reçete**: `p` + `q1.4/18` + `o2` + Steiner TAVANI (tarayıcıda sınırsız nokta sekmeyi kilitler) + `Q`; kullanılan anahtarlar sonuçta YAZILI. **Künye AĞ TAŞIMIYOR** (düğüm/eleman dizileri yok, künye < ağın kendisi) ve çözümün ne ile kurulduğunu taşıyor; oturumluk önbellek temizlenebiliyor. **PLC**: CAD kimliği tamsayı işaretçiye eşleniyor ve TERS TABLO dönüyor (yoksa çıktıdaki 17 numaralı işaretçinin hangi yüz olduğu kaybolurdu), sıfır KULLANILMIYOR (TetGen işaretçisizleri 0 sayıyor). **Hata sessiz değil**: parçasız istek ve kendini kesen yüzey — sözleşme "bu girdi ÇÖKER" değil, köprünün İKİ durumdan birini vermesi (ham istisna sızdırmaması). **Gömülü ağ üreteci**: `js/structural-tetgen-wasm.js` vendor .wasm'ıyla BAYT BAYT aynı, WASM imzası, index.html'de AÇILIŞTA yüklenmiyor, AGPL-3 lisansı ve TetGen KAYNAĞI depoda, derleyici `predicates.cxx`'i `-O0` ile derliyor (kesin aritmetik şartı) |
| `tests/unit/structural-materials.test.js` | `js/structural-materials.js` + `js/cp-structural.js` | **Malzeme kütüphanesinin tutarlılık kapısı** (112 kayıt × beş katman): sayılar ölçülemez (standart değerleri) ama TUTARLILIKLARI ölçülür — kimlik tekilliği, GÖSTERİM çakışması (kapı gerçek bir çakışma buldu: `AL995` alümina ↔ `Al99,5` saf alüminyum, ρ 3890 ↔ 2710), 0 ≤ ν < 0,5, σ_ak ≤ σ_ç, σ_ak'ın gevrekte null olması (0 DEĞİL), sınıf başına E ve ρ pencereleri ve **türetilen G = E/2(1+ν)**'nün sınıf aralığına düşmesi (ν ondalık kaymasını yakalayan asıl kapı — 0,03 da ν aralığından geçer, G'den geçmez). **Uçtan uca**: HER kaydın `veStrMatValidate`'ten hatasız geçmesi, gevrek kayıtların akma uyarısını, elastomerlerin kilitlenme uyarısını ÜRETMESİ. **Çapa değerler** ve özgül dayanım sıralaması (Ti > Al > çelik). **Arama**: Türkçe katlama (`toLowerCase` tek başına yetmez), ayıraç bağımsızlığı (1.4301 = 14301), parça eşleşmesi ("304" → 304, 304L değil), aile terimlerinin (`fam`) tekillik beklemeden bütün aileyi getirmesi, boş sorgunun AİLEYE göre sıralanması (alfabetikken 16 aile için 30 başlık basılıyordu). **Kayda çevirme**: kopya olması (katalog güncellemesi eski projeyi bozmaz), `lib`/`libVer` izi, referans alanların (λ, c_p) kayda GEÇMEMESİ. **Genişletilmiş veri**: her kaydın uzama/servis sıcaklığı/sertlik ölçeği (metalde HB, seramikte HV, termoplastikte Shore D, elastomerde Shore A), **Rm/HB oranının sınıf penceresi** (ISO 18265; gri dökme demirin oranı çelikten AÇIKÇA farklı). **Sıcaklık eğrileri**: 20 °C'de k=1, monoton düşüş, EN 1993-1-2 çıpaları (kY 500/600/700 = 0,780/0,470/0,230 · kE 400 = 0,700), kY'nin 400 °C'ye kadar 1,000 kalması ama kP'nin çoktan düşmesi, DOĞRUSAL ara değerleme, aralık dışında EKSTRAPOLASYON YOK, alüminyumun 200 °C'de dayanımının üçte ikisini kaybetmesi, 5xxx'in 6xxx-T6'dan ısıda daha iyi olması, ferritik/martenzitiğin östenitik eğrisini KULLANMAMASI, eğrisi olmayan sınıfta null; **std ↔ tipik sınıflandırmasının SABİTLENMESİ** (bir el kitabı eğrisini sessizce standarda yükseltmek genel testten geçiyordu). **Wöhler**: σ_W = f_W·Rm, monotonluk, Rm'de KESİM, çelikte dayanma sınırı VAR / alüminyumda YOK, dizde süreklilik, LCF sınırının hesaplanması, σ_ç olmayan kayıtta model üretilmemesi |
| `tests/unit/cp-structural.test.js` | `js/cp-structural.js` + `js/components.js` | **Yapısal Analiz iskeleti**: alt-sistem sözleşmesi, zincirin PORTLARLA zorlanması (Geometri girişsiz / Sonuçlar çıkışsız), başlangıç kenarlarının indisle değil TİPLE yazılı olması, panel smoke testleri, iskeletin BEŞ dosyaya birden bağlı olduğu (components / cp-core / ui-core / topology / index.html — biri unutulursa kaydedilen proje bozulur). **Geometri ve Hesaplama Ağı artık DOLU**: hâlâ iskelet olan panel sayısı iki (biri dolunca liste güncellenmeli), Ağ zincirinin BEŞ dosyaya birden bağlı olması (remesh / mesh-model / gömülü .wasm / vendor glue / cp-core görüntüleyici kancası) ve köprünün remesh'ten SONRA yüklenmesi, CI'ın TetGen .wasm + AGPL-3 lisansını Pages'e kopyalaması, içe aktarma yüzeyi + sürükle-bırak bağlı, geometri YOKKEN 3B kanvas kurulmuyor, kaynağın projeye yazılıp yazılmadığı AÇIKÇA yazılı; vendorlu okuyucu/.wasm/lisans deposu ve CI'ın .wasm'ı Pages'e kopyalaması; **panel ölçüsü** — büyük pencere sınıfı yalnız parça yüklüyken veriliyor, kutunun ölçüsü satır içinde değil sınıfta, boşluğu yutan flex zincirinin her halkası yerinde; **üç varsayılan** — incelik seçicisi ve "Kenarlar" kutusu YOK (sabit + hep açık), yüz inceleme kipi KAPALI başlar ve liste ile 3B künyesini tek anahtarla birlikte açar, kapalıyken raycast yapılmaz. **Malzeme ve Özellikler**: alt bileşen sözleşmesi (çıkışı YOK → zincire ara halka olarak sokulamaz; kutu zincirinkinden küçük; giriş ÜST kenarda), ν ≥ 0,5 tekillik kapısı ve 0,49–0,5 kilitlenme uyarısı, ρ'nun kg/m³ → ton/mm³ çevrimi (7850 → 7,85e-9) ve girilmemiş ρ'nun 0 DEĞİL null olması, G/K formülleri, bağın TELDEN okunması, rozetin yalnız çözülebilir kayıtta amber olması, eski kayıtlardaki `output` adının yeni `output-0` ile aynı noktaya düşmesi (göç gerekmiyor), Geometri adının SOLA alınması ve bunun düğüme gerçekten yazılması. **Malzeme kütüphanesi paneli**: iki sütun (solda katalog / sağda uygulanan kayıt), geçerlilik sınırının listenin ÜSTÜNDE olması, kütüphane yüklenmezse panelin sessiz kalmaması, uygulanan kaydın KOPYA olması, izin üç durumu (katalogdan geldi / elle değişti / hiç gelmedi), aynı satıra ikinci tıkın seçimi kaldırması ve seçimin düğüme HİÇ yazılmaması, aile başlığı sayısının aile sayısına eşit olması, uzun katalog adlarının rozette ayırt edici parçayı koruması (`EN AW-6082 T6` → `AW-6082 T6`), 112 kaydın hepsinin tek tek seçilip uygulanabilmesi. **Diyagramlar**: 112 kaydın hepsinde üç diyagramın da SONLU koordinat üretmesi (NaN'lı bir yol tarayıcıda sessizce çizilmez), σ–ε'nin orijinden başlaması ve gevrekte akma çizgisi ÇİZMEMESİ, Wöhler eğrisinin monoton düşmesi + LCF bölgesinin taranması + alüminyumda "dayanma sınırı YOK" yazması, sıcaklık eğrisinde karbon çeliğinin ÜÇ serisi (östenitikte orantı sınırı verisi yok → seri de yok) ve azami servis çizgisi, TİPİK eğrilerde kaynak türünün açıkça yazılması, model sınırlarının diyagramların altında durması, ELLE girilen kayıtta diyagram olmaması ve sebebinin yazılması, sıcaklık değerlendiricisinin düğüme HİÇ yazmaması, uygulanan kaydın listede görünür yapılması, **katalog sütununun DAR ve sabit olması** (oranı geri çevirmek hiçbir testi kırmıyordu) |
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
| `tests/unit/results-txt-preview-download.test.js` | `js/results.js` | TXT önizlemesinin "HTML İndir" yolu — iki rapor üreticisinin ayrı kaldığı ve düğme kablolaması |
| `tests/e2e/app.spec.js` | Tüm uygulama | Sayfa yükleme, menüler, bileşen ekleme, kaydetme |
| `tests/e2e/measure-import.spec.js` | İçe aktarma sihirbazı | Gerçek .xlsx → sütun tarama → X/Y seçimi → şeritler |
| `tests/e2e/viewer.spec.js` | `MFSim_Olcum_Goruntuleyici.html` | **Üretilen tek dosya**, `file://` üzerinden: açılış, içe aktarma, sürükle-bırak, birleştirme, tema, sıfır ağ isteği |
| `tests/e2e/structural-geometry.spec.js` | Geometri bileşeni (uçtan uca) | **GERÇEK tarayıcı**: 7,3 MB .wasm'ın göreli yoldan çekilmesi → OCCT → panel künyesi → WebGL sahnesi; fareyle CAD YÜZÜ vurgusu (üçgen değil), ağ inceliği değişince üçgen değişip kimliklerin sabit kalması, STEP olmayan dosyanın sessizce yutulmaması, **ölçüm kaplamasının STEP alanında çekilip asılı kalmaması**; **arayüz donmuyor** — içe aktarma boyunca çizilen kare sayısı ana iş parçacığında ≤3, worker'da >20 (ölçümde 1 ↔ 91), panelin gerçekten worker'a gitmesi ve ilerleme kartının aşama değiştirip iş bitince kapanması; **kanvas rozeti** (boşken `STEP`, doluyken `⬡160`), **CAD yüz listesi** (160 satır; listeden tık → 3B'de vurgu, 3B'de gezinme → listede işaret, 3B'de tık → listede seçim, ikinci tık seçimi kaldırır, DÖNDÜRME seçimi bozmaz), **kaynağın yalnız dosyaya yazılması** (künye ve otomatik yedek kaynaksız); **görüntüleyicinin boyu** — parça yüklenince pencere ekranı kullanıyor, sol ray ile 3B kutusu AYNI yerde bitiyor (boşluk 290.6 → 0 px), kanvas o ölçüde kuruluyor ve içerik kaydırmıyor; **varsayılanlar** — incelik/kenar kontrolü panelde yok ve her içe aktarma 0.0005 ile geliyor, yüz listesi ve fare künyesi kullanıcı açana kadar çıkmıyor, kapatınca hiçbir işaret kalmıyor. Bu halkalar Node'da HİÇ koşmuyor |
| `tests/e2e/measure-merge-drop.spec.js` | `js/measure-dropzone.js` + `js/trace-view.js` | MFSim'de sürükle-bırak ve çok eksenli birleştirme — araç performans VE takoz sekmesi |

## Sık Kullanılan Komutlar

```bash
npm run test:watch          # ★ geliştirme döngüsü — kaydettikçe ilgili testler koşar
npm run test:changed        # git'te değişen dosyalarla ilgili testler (jest -o)
npm test                    # tüm birim testleri (sessiz) — commit öncesi
npm run test:ci             # tüm birim testleri (--verbose --ci) — CI logları için
npm run build               # MFSim_Code.html üret (modüler → monolitik) — commit/deploy öncesi
npm run sync:viewer         # js/ → viewer/js/ (yedi kopya + iki yerel fark)
npm run build:occt-wasm     # vendor/occt-import-js.wasm → js/structural-occt-wasm.js (gömülü STEP okuyucusu)
npm run build:tetgen-wasm       # vendor/tetgen-src/ → vendor/tetgen-wasm.{js,wasm}  (emscripten GEREKİR, nadiren)
npm run build:tetgen-wasm-asset # vendor/tetgen-wasm.wasm → js/structural-tetgen-wasm.js (gömülü ağ üreteci)
npm run build:viewer        # MFSim_Olcum_Goruntuleyici.html üret (Ölçüm Görüntüleyici)
npm run build:artifact      # MFSim_Artifact.html (claude.ai önizlemesi)
npm run build:all           # üçü birden
npm run shot -- --help      # ekran görüntüsü — İSTEĞE BAĞLI, yalnız kullanıcı isteyince
npm run test:e2e            # E2E testleri (Chromium gerekli)
npm run test:all            # birim + E2E
```

## Artifact önizlemesi — programı claude.ai üzerinden görmek

Kullanıcının ağı **GitHub'a da GitHub Pages'e de çıkamıyor** (2026-08-22);
çalışan tek kanal claude.ai. Program açılışta **sıfır ağ isteği** yaptığı için
(ölçüldü: 0 istek, 0 konsol hatası) barındırma yeri serbest — tek dosya
claude.ai'ın Artifact sayfası olarak yayınlanıyor.

```bash
npm run build           # MFSim_Code.html
npm run build:artifact  # MFSim_Artifact.html (gövde varyantı, .gitignore'da)
```
Sonra Artifact aracıyla **aynı dosya yolundan** yeniden yayınla → **URL değişmez**.

**Neden ayrı varyant:** Artifact sayfayı kendi iskeletine sarıyor
(`<!doctype><html><head>…<body>`). Tam belge göndermek iç içe html/head/body
üretirdi. `tools/build-artifact.js` sarmalayıcıyı söküp gövdeyi teslim eder;
girdisi **üretilmiş monolit** olduğu için build.js'in bütün kalkanları ve
gömmeleri zaten koşmuş olur (ikinci bir gömme yolu sessizce ayrışırdı).

### Üç sessiz tuzak — üçü de ölçüldü, üçü de testli

| Tuzak | Olan | Kapı |
|---|---|---|
| **Sahte `</body>`** | Rapor üreticileri HTML şablonu basıyor → dize JS içinde de geçiyor (gerçek belgede **3 kez**). "İlk eşleşme gerçektir" varsayan sürüm gövdeyi 425 KB'ta kesti, **80 script'in 9'unu** taşıdı | `maskRawTextKeepOffsets` (build-shield.js) — gövdeleri boşluğa çevirir, konumları korur |
| **`data-theme` çakışması** | MFSim 16 temayı `documentElement`'e yazıyor; artifact host'u **aynı özniteliğe** `dark`/`light` damgalıyor → paletin tamamı düşer | Shim'deki MutationObserver yabancı değeri geri alır; tema listesi **CSS'ten çıkarılır**, elle yazılmaz |
| **`<script>`/`<style>` sayımı** | `countScriptElements`/`styleBodies` JS içindeki şablonları da sayıyor (style 4 yerine **9**) | Doğrulama `scanDocument`'ten besleniyor |

### Ağ kapıları — `js/env.js`

Bayrağı **derleme zamanı** koyar (`window.MFSIM_ENV='artifact'`), sniffing YOK:
"fetch patlıyorsa artifact'teyiz" çıkarımı, güvenlik duvarı arkasındaki Pages
kullanıcısına da "bu ortamda kapalı" derdi. `index.html` ve `MFSim_Code.html`'de
bayrak yoktur → `veArtifactEnv()` false → **Pages sürümü sıfır risk alır.**

Dört özellik kapıya bağlı: **deploy noktası** (kırmızı yanıp "deploy başarısız"
diye YANLIŞ bir şey söylerdi), **commit listesi**, **harita** (boş gri kare
verirdi — Leaflet karo hatasını yutuyor), **canlı radyo**. Yerel müzik
kütüphanesi kapıya TAKILMAZ: ağı yok, kapatmak çalışan özelliği sebepsiz alırdı.

**Bilinen kısıt:** indirme bağlantıları (proje kaydet, rapor, PNG/SVG/CSV)
artifact görüntüleyicisinde çalışmaz — `downloads` yeteneğiyle çözülebilir,
bugün yapılmadı. İndirme gereken iş Pages sürümünde ya da indirilen tek dosyada
yapılır.

Kapılar **beş mutasyonla ölçüldü** (deploy kapısını kaldır, harita kapısını
kaldır, `veArtifactEnv` hep false, sahte-`</body>` korumasını naif eşleşmeye
döndür, tema geri-almasını kaldır) — beşi de kırmızı.

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
