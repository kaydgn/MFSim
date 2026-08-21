# MFSim - Claude Code Talimatları

## Proje Yapısı
Tarayıcı tabanlı Motor Fren Simülasyonu uygulaması (saf HTML/CSS/JS, framework yok).

- `index.html` — Ana sayfa (modüler versiyon, js/ klasöründen script yükler)
- `MFSim_Code.html` — Tek dosya versiyonu (otomatik üretilir, elle düzenlenmez, **git'e dahil değil** — `npm run build` üretir, CI deploy Pages'e yayınlar)
- `js/` — Modüler JavaScript dosyaları
- `css/` — Stiller
- `build.js` — Build script (`index.html` + `js/` + `css/` → `MFSim_Code.html`)
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
| **Tasarım gerginliği** ↔ **yay dengesi** | bütün gerilme ve hubloadlar 250 N kayar | kayma emniyeti bir ORAN, değişmiyor |

Birincisi: sayfa serbest açıyı VERMİYOR, gergi kasnağının **montaj merkezini**
veriyor. Serbest açı `veFeadFreeAngleFrom` ile türetilir
(`montajAçı − sense × (Mean−Pre)/Rate`); `sense`i çekirdek bulduğu için
`veFeadBuildSystem` **iki geçiş** yapıyor. `|montaj merkezi − pivot|` ile
girilen kol boyu 0.5 mm'den fazla ayrılırsa çözüm DURUR — iki sayı da sayfada
yazar, uyuşmazlık okuma hatasıdır. Panel varsayılanı VERİDEN çözülür
(`veFeadAngleMode`): eski kayıtlar yalnız `freeAngleDeg` taşıdığı için koşulsuz
`mount` varsayılanı onları açılışta çözülemez yapardı.

İkincisi `veFeadBuildSystem` sonundaki uyarı: `designTensionN` gergi yay
dengesinden %2'den fazla ayrılırsa kaymanın kaç newton olduğu yazılıyor.

Servis faktörü (sayfada 1.3) kayma emniyetinin istenen alt sınırı olarak sonuç
tablosunda hüküm veriyor — eşik eskiden 1.3'te SABİTTİ, artık kullanıcının
girdiği değer.

**Sırada:** Sonuçlar sayfasında FEAD çözüm sekmesi (kanal yayını).

#### Yapısal Analiz — `js/cp-structural.js` (İSKELET, panelleri bilerek boş)

Dördüncü modül. Şu an **yalnız iskelet**: modül kartı, iç topoloji gezinmesi,
breadcrumb, sidebar kapsamı ve dört zincir bileşeni. Bileşen panelleri **boş** —
ayrı oturumlarda tek tek doldurulacak.

```
Geometri → Hesaplama Ağı → Sınır Koşulları → Sonuçlar
```

**Zincir PORTLARLA zorlanır, yorumla değil:** `str-geometry` girişi 0,
`str-results` çıkışı 0 → kullanıcı zinciri ters kuramaz. İlk açılışta zincir
**kurulu ve bağlı** gelir (diğer üç modül yalnız "Başlangıç" kartı koyar; onların
alt topolojisi değişken, bunun ki sabit — tam bir Geometri, bir Ağ, bir Sınır
Koşulları, bir Sonuçlar. Seçim yok, o yüzden boş tuval bırakmanın karşılığı yok).

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
optikonalite korunur). WASM'lar tek dosyaya inline EDİLMEZ, talep üzerine
yüklenir — hem boyut (occt 7,25 MB + tetgen) hem lisans aynı kapıya çıkıyor.

**Sırada:** Geometri (STEP içe aktarma + 3B görüntüleyici) · Hesaplama Ağı
(yeniden-mesh + TetGen WASM) · Sınır Koşulları (yüz seçimi) · Sonuçlar (çözücü).

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
| `tests/unit/cp-fead-report.test.js` | `js/cp-fead-report.js` + `tools/report-assets/fead-theory-source.html` | **Rapor içeriği**: Türkçe sayı biçimi (gerçek eksi, `—` ≠ 0), `wearPct` oran→yüzde çevrimi, sarım açılarının DERECE basılması, Σsarım=360 ve `L_pitch−L_eff=2πh_b` denetimlerinin belgede görünmesi, sürücü kW sütununun duty tablosunda OLMAMASI, çözülemeyen konumun `Err.` ile işaretlenmesi, `undefined`/`NaN`/`[object` sızmaması, "ortalama tork ≠ peak", sistem burulma modunun yokluğunun yazılması, uygunluk hükmünün servis faktörünü kullanması, şekil/tablo numaralarının boşluksuz ve her üretimde sıfırlanması, şablon tokenlarının tek kez geçmesi, içindekiler id'lerinin üreteçle aynı olması |
| `tests/unit/fead-anim.test.js` | `js/cp-fead.js` animasyon + `js/fead-model.js` kinematik | **Kayış Yolu kartının animasyonu**: ω·r = v özdeşliği, ağır çekim katsayısının REFERANS devre bağlanması (seçili devre bağlansaydı seçici işlevsiz kalırdı — istenmeyen alternatif de koşturulup belgeleniyor), diş adımının çevreyi tam bölmesi, diş sayısının faz boyunca sabit kalması, bir adımlık fazın deseni birebir kendine getirmesi, dişlerin GİDİŞ yönünde ilerlemesi, kol açısal hızının `d·v/r` olması (sırttan temas edende ters) ve kol ucu çevresel hızının kayış hızına eşitliği (kasnakta kayma yok), animasyonun YALNIZ kanvas kartında olması, fazın düğüm kimliğinde durması (yeniden kurulumda kayış zıplamıyor), uzun duraklamada `dt` kırpması |
| `tests/unit/fead-example.test.js` | `js/fead-model.js` örnekleri + FEAD_INFORMATION | **Tedarikçi sayfası çıpası** (Gates'ten bağımsız ikinci doğrulama): kayış boyu 1715 mm, kol boyu 90.0 mm, Spring Mean Load 22.07 Nm, tahrik oranı 1.1; sayfanın devir→kW tabloları; **iki sessiz kanalın** ölçülmüş belgesi (montaj merkezi ↔ serbest açı 2.6×, tasarım gerginliği ↔ yay dengesi 250 N) |
| `tests/unit/cp-structural.test.js` | `js/cp-structural.js` + `js/components.js` | **Yapısal Analiz iskeleti**: alt-sistem sözleşmesi, zincirin PORTLARLA zorlanması (Geometri girişsiz / Sonuçlar çıkışsız), başlangıç kenarlarının indisle değil TİPLE yazılı olması, panel smoke testleri, iskeletin BEŞ dosyaya birden bağlı olduğu (components / cp-core / ui-core / topology / index.html — biri unutulursa kaydedilen proje bozulur) |
| `tests/unit/canvas-space.test.js` | `js/canvas-space.js` | Sonsuz ızgara deseni, "ev" kamerası, topoloji ortalama |
| `tests/unit/module-start-center.test.js` | `js/components.js` `veStartModule` | Karşılama kartından gelen modül bloğu görünümün TAM ortasına düşer (kabuk senkronu ölçümden önce) |
| `tests/unit/port-geometry.test.js` | `js/components.js` port geometrisi + `js/connections.js` | Bağlantı ucu ile port dairesi aynı noktada — dört kenar, çok port, aynalama; **gidiş yönü oku** (Bézier t=0.5, 46 px eşiği, ters yön); **`veSyncPortDom`** — kenar sonradan değişince (bağlantı/sürükleme) dairenin teli takip etmesi, elle taşınan portun ezilmemesi, kenar değişmiyorsa DOM'a hiç yazılmaması |
| `tests/unit/module-card.test.js` | `js/components.js` alt-sistem kartı + sidebar modül satırı | Modül kartı: içerik özeti (alt topolojiden), kart ölçüsünün tek kaynağı, eski 80×66 kaydın yükselmesi, **ad elemanının taşınması** (kopyalansaydı yeniden adlandırma sessizce eskirdi); palet sembolü `componentDefs`'ten (index.html'de ikinci kopya tutulmadığına dair kapı) |
| `tests/unit/example-topology-center.test.js` | `js/cp-mount.js` + `assets/examples/` | Örnek JSON'ları kanvas merkezine açar |
| `tests/unit/topology-wiring.test.js` | `js/ui-core.js` `veTryConnectPorts` + `js/connections.js` topoloji imzası | **Kanvasta tel çekmek**: geçersiz port çifti (çıkış→çıkış, giriş→giriş, kendine) bağlantı kurmaz ama SESSİZ de kalmaz; doğru çift her iki yönden de aynı bağlantıyı kurar; topoloji imzası tel/düğüm değişince değişir, düğüm SÜRÜKLENİNCE değişmez (kart 30 karede 0 kez yeniden kurulur) |
| `tests/unit/state.test.js` | `js/state.js` | Undo/redo stack yönetimi |
| `tests/unit/toolbar-save.test.js` | `js/toolbar.js` | Proje kaydetme, JSON serileştirme, showSaveFilePicker |
| `tests/unit/viewer-board.test.js` | `viewer/js/board.js` | Görüntüleyici panosu: bir panoda tek ölçüm dosyası kuralı, X ekseni seçenekleri, veri kapısı |
| `tests/unit/viewer-sync.test.js` | `viewer/sync.js` | Görüntüleyici kopyaları `js/`'ten geride kaldıysa kırmızı — sessiz ayrışmaya karşı kapı |
| `tests/unit/measure-dropzone.test.js` | `js/measure-dropzone.js` | Sürükle-bırak uzantı süzgeci (sessiz yanlış çıktıya karşı) |
| `tests/unit/simulation-engine-grade.test.js` | `js/simulation-engine.js` | Yol eğimi işaret konvansiyonu (harita ↔ fizik çevirisi) + dinamiğin değişmediğini bağlayan altın değerler |
| `tests/unit/shot-tool.test.js` | `tools/shot.js` | Ekran görüntüsü aracının ayrıştırma çekirdeği: bilinmeyen bayrağın SESSİZCE yutulmaması (yanlış ekranın görüntüsü alınırdı), hedef takma adları, PNG ölçüsü, karşılaştırmanın İKİ GÖRÜNTÜYÜ TEK ÖLÇEKLE küçültmesi |
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
npm run shot -- --help      # ekran görüntüsü — İSTEĞE BAĞLI, yalnız kullanıcı isteyince
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
