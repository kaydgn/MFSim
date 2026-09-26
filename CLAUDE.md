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
- `js/cp-fead-wizard.js` — FEAD **Başlangıç Sihirbazı** (adımlı modal; adımlar `VE_FW_STEPS`). Kendi
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
- `js/fead-transient.js` — FEAD **geçici rejim**: motor çevrimi senaryosu
  (durgun → marş → ateşleme → rölanti → hızlanma → yavaşlama → stop). DOM'suz;
  çekirdeğe dokunmaz. **Devir geçmişi DAYATILIR, simüle edilmez** — MFSim'de
  volan ataleti yok, modeldeki krank ataleti burulma modelininki. Rampa
  kullanıcının ivme alanından, şekli motorun tork eğrisinden.
- `js/fead-checks.js` — FEAD **uygunluk kapıları**: kasnak merkez mesafesi,
  çevrim oranı penceresi, aksesuar devir sınırı. DOM'suz; **panel ve rapor AYNI
  çağrıyı paylaşır** (`veFeadChecks`), rapor onu çözüm anında yazılan
  `R.checks`'ten okur ve yeniden hesaplamaz.
- `js/fead-signals.js` + `js/fead-brief.js` + `js/cp-fead-results.js` — Sonuçlar
  sayfasının **FEAD sekmesi**: dört veri kümesi (çevrim · Campbell · gergi kolu ·
  senaryo), şerit yorumu ve sunum (özet kartları, hazır diyagramlar, Sonuç
  Özeti). **Pano OKUR, hesaplamaz** — kümeler çözüm anında `R.signals`'a
  yazılır; kural ve kapıları FEAD skill'inde (kural 33).
- `js/step-p21.js` + `js/fead-step.js` — **STEP'ten kasnak geometrisi**
  (CATIA/3DEXPERIENCE montajı). DOM'suz; okuyucu anlam yüklemez, tanıyıcı
  model KURMAZ — çıktı FEAD örnek kaydı biçiminde, sihirbaz onu örnek gibi
  yükler. OCCT gömülmez. Kurallar FEAD skill'inde (kural 34). `index.html`
  yükler; arayüzü sihirbazın 1. adımındaki **"STEP'ten başla"** kartı.
- `tools/shot.js` — Ekran görüntüsü aracı (İSTEĞE BAĞLI — yalnız kullanıcı isteyince; `npm run shot -- --help`)
- `tools/karsilama-secici.{js,html}` + `tools/karsilama-kunye.json` — karşılama
  karelerinin **seçim tahtası**: numaralı/gruplanmış/büyütülebilir 28 kare, tıklanan
  kare "kaldırılacak" işareti alır ve karar Artifact `db`'sine yazılır. Sebep, dosya
  adının hangi resmin hangisi olduğunu söylememesi. **Üretilen sayfa git'e dâhil
  DEĞİL** (28 kare gömülü, klasörle bayatlar); künye elle yazılır ama klasörle iki
  yönlü bağlıdır (`tests/unit/karsilama-secici.test.js`).
- `tools/karsilama-webp.js` — slayta **yeni kare ekleme**: JPEG/PNG → webp + liste.
  Numara devam eder, **silinen karenin numarası boş kalır** — 28 dosyayı yeniden
  adlandırmak kullanıcının ekranda öğrendiği numaraları geçersiz kılardı.
- `tools/karsilama-bul.js` + `tools/karsilama-aday-secici.{js,html}` — karşılama
  için **aday kare tarayıcısı** (Wikimedia Commons) ve adayların seçim sayfası.
  Commons kullanılıyor çünkü ölçüyü ve künyeyi makine okunur veriyor, yani
  çözünürlük süzgeci İNDİRMEDEN önce uygulanabiliyor. **Lisans bir kapı değil
  künyedir** (kullanıcı kararı, 2026-09-11) — karta yazılır, eleme yapmaz.
  **Boyut tahmin edilmez, ölçülür**: üreteç her adayı klasöre girecek kalitede
  webp'ye çevirip gerçek baytı yazar. İndirilenler ve üretilen sayfa git'e
  dâhil DEĞİL; kaynak üçlüsü (tarayıcı + üreteç + şablon) git'te.
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
- `candbc/` — **CAN Çözümleyici** (ayrı program, bkz. `candbc/README.md`)
- `MFSim_CAN_Cozumleyici.html` — CAN Çözümleyici'nin tek dosya çıktısı (`npm run build:can` üretir; görüntüleyici gibi **git'e dahil**)
- `programlar/` — MFSim çevresinde üretilen **tek dosyalık HTML programların arşivi**
  ve `kayit.json` künyesi (bkz. `programlar/README.md`). Artifact kopyaları
  donmuştur; üretilen üç ürün (`MFSim_Code.html`, görüntüleyici, CAN)
  **taşınmadı**, kayıt onlara depo kökünden yol veriyor. `kayit.json` elle
  düzenlenmez, üretilir. Programa Araçlar → **Program Arşivi**'nden bağlı
  (`js/cp-programlar.js`). **KATALOG gömülür, programların GÖVDESİ gömülmez** —
  arşiv gzip'li 17,4 MB, gömülseydi tek dosya 30 MiB teslim sınırını aşardı.
  Bu yüzden pencere arşivin yanında olup olmadığını `programlar/arsiv-var.js`'i
  **script etiketiyle yoklayarak ÖLÇER** (`file://` üzerinde `fetch` var/yok
  ayrımı yapmıyor); o dosya bir yoklama hedefidir, veri konmaz.
- `js/cp-komuta.js` — **Komuta Penceresi** (Araçlar → Komuta, ayrı şifre). İki işi
  var: elindeki kopyanın durumunu ÖLÇMEK ve buradan bir **sipariş fişi** yazmak.
  Pencere hiçbir şeyi DEĞİŞTİRMEZ. Tezgâhlar elle yazılmış özet TUTMAZ, canlı
  veri yapısını okur — elle yazılan özet sessizce bayatlar (bu dosyanın kendi
  6.052 satırlık dersi). Fiş, tezgâhın ölçtüğü içeriğin ÖZETİNİ taşır ve
  `npm run komuta:dogrula` onu çalışma ağacından yeniden hesaplar.
  **Yeni tezgâh eklerken:** `olc(veri)` SAF olmak zorunda (global okumaz) ve
  tezgâh ölçtüğü kaynağı İKİ YERDEN beyan eder — tarayıcı için `kaynak()`,
  Node için `dosya` + `disaAktarim`. İkisinin AYNI sayıyı ölçtüğü
  `tests/e2e/komuta.spec.js`'te kapılı: ayrışma SESSİZDİR — pencere kendinden
  emin biçimde "0 kayıt" gösterir, hiçbir şey patlamaz.
- `.claude/skills/` — modüllere özgü karar kayıtları (koşullu yüklenir; aşağıya bak)
- `docs/decisions/` — ortak yüzey kararları + tam test dosyası tablosu

**ÖNEMLİ:** Kod değişiklikleri **yalnızca** `js/` ve `css/` klasörlerindeki modüler dosyalara ve `index.html`'e yapılır. `MFSim_Code.html` dosyası **elle düzenlenmez** — `npm run build` ile otomatik üretilir.

### Üç ana modül (alt-sistem kartı → kendi iç topolojisi)

Karşılama ekranındaki her kart, ana tuvale tek bir **alt-sistem kartı** bırakır;
çift tıklayınca kartın kendi iç topolojisi açılır. Üçü de **aynı nested kalıbı**
paylaşır (stack + `node.data.subTopology` + breadcrumb çipi + sidebar kapsamı):

| Modül | Tip anahtarı | Sidebar kapsamı | Ana dosya | Bağlantının anlamı |
|-------|--------------|-----------------|-----------|--------------------|
| Araç Performans | `arac-performans` | `arac-performans` | `js/cp-arac-performans.js` | Güç akışı |
| Takoz Çökme-Titreşim | `mount-analysis` | `mount-analysis` | `js/cp-mount.js` | Salt görsel (çözücü tipe göre toplar) |
| FEAD (kayış-kasnak) | `fead-analysis` | `fead-analysis` | `js/cp-fead.js` | **YOK — kasnakların kanvasta KUTUSU BİLE yok** (`noCanvasBox`). Kasnak Kayış Yolu **ÇİZİMİNDE** seçilir, sürüklenir ve paletten kayışın üstüne bırakılarak eklenir (**Çizim Masası**); kesin sayı ve sıra **Kayış Tablosu ÇEKMECESİNDE** (kartın "Tablo" düğmesi; tuvalin ALTINA yapışık, üstüne binmez — kanvas bileşeni değil; kart listesi: kim · gir · coz). Kanvas kartının **TEK tipi var** (`fead-layout`); geometri ↔ işletme ayrımı bir **ÖN AYAR** (`node.data.katOn`), tip değil; kartta **yatay bant YOK** — denetimler çizimin üstünde yüzer. Kart **çoğaltılabilir** ve her kart kendi KATMANLARINI seçer (`node.data.kat`) |

Yeni bir modül eklerken dokunulan yerler: `js/components.js` (`componentDefs`
tanımı + `isSubsystem` + `VE_MODULES.components` + `veSyncSidebarScope`),
`js/cp-core.js` (panel dağıtımı + panel genişlik listeleri), `js/ui-core.js`
(çift tık), `js/topology.js` (busy bayrağı, köke çökme, gezinme yakala/geri yükle,
`veResetSubtopoNav`), `index.html` (script etiketi, Modüller satırı, palet
kategorileri, karşılama kartı).


### Modül karar kayıtları — koşullu yüklenir

Modül karar kayıtları bu dosyadan **çıkarıldı** ve skill hâline getirildi;
gövdeleri ancak çağrıldığında yüklenir. Bu bir arşivleme değil, bir yükleme
kuralıdır: FEAD'e dokunmayan bir oturum FEAD kayıtlarını ödemez.

| Modül | Skill | Ne zaman çağrılır |
|-------|-------|-------------------|
| FEAD (kayış-kasnak) | `fead` | `js/fead-*.js`, `js/cp-fead*.js`, `js/guide-fead.js` ya da FEAD testlerine dokunmadan **ÖNCE** |
| Araç Performans (tam gaz) | `arac-performans` | `js/ft-performance.js`, `js/simulation-engine.js`, `js/numerics.js`, `js/cp-arac-*.js`, `js/cp-engine.js`, `js/cp-gearbox.js`, `js/cp-torque-converter.js`, `js/cp-matching.js`, `js/ft-obstacle.js`, `js/ft-segment-drive.js`, `assets/examples/ap_*.json` ya da Araç Performans testlerine dokunmadan **ÖNCE** |
| Komuta Penceresi / sipariş fişi | `komuta` | Kullanıcı `MFSIM-SIPARIS` başlıklı bir metin YAPIŞTIRDIĞINDA, ya da `js/cp-komuta.js`, `tools/komuta-dogrula.js`, komuta testlerine dokunmadan **ÖNCE** |

**Bu bir nezaket değil kapıdır.** Bu modüllerin hata sınıfı sessizdir — sayı
yanlış çıkar, program çalışmaya devam eder, uyarı verilmez. Skill'i okumadan
yapılan bir "iyileştirme" (çekirdeği proje stiline çevirmek, gerginin tanımını
eski yönüne döndürmek) testten geçebilir ve yine yanlış olabilir.

Takoz modülünün ayrı karar kaydı **yok**; kuralları kendi test dosyalarında ve
kodun yorumlarında duruyor.

Araç Performans'ın kaydı 2026-09-07'de **açıldı** — o güne kadar yoktu. Sebep
bir düzen değişikliği değil, bir ölçüm: `ft-performance.js`'in PCHIP uç eğim
kelepçesi referansın hatalı çevirisiydi (`< 0` yerine `<= 0` olmalıydı), düz uç
aralıklı her tabloda şekil koruma garantisini bozuyordu ve **sevk edilen veride
canlıydı**. Yani modül, FEAD'in skill'e sahip olma gerekçesi olan
sessiz hata sınıfını gösterdi. Kayıt o turda çıkan kararları ve kapatılmamış üç
ayrışmayı taşıyor.

### Üç katman kalıbı (dışarıdan gelen çekirdekli modül)

FEAD bu kalıbı izler:

| Katman | Kural |
|--------|-------|
| Hesap çekirdeği (`js/fead-core.js`) | **Dışarıdan geldi, birebir durur, dokunulmaz** — güncellemesi de dışarıdan gelir. Proje stiline ÇEVRİLMEZ |
| Köprü (`js/fead-model.js`) | DOM'suz. Kanvas düğümü → çekirdek girdisi; hata çevirisi |
| Sunum (`js/cp-fead.js`) | Yalnız HTML/kanvas kurar; **kendi geometrisini hesaplamaz** |

Uyarlanacak olan çekirdeğin **çevresidir**, çekirdeğin kendisi değil. Bir stil
uyarlaması sırasındaki tek işaret hatası "testten geçen ama yanlış" bir çekirdek
üretir.

## Proje geneli kurallar

### AĞIR VARLIKLAR GÖMÜLÜR — çevrimdışı çalışmak ŞART

MFSim tek dosya olarak indirilip kullanılıyor. Yanında `vendor/` klasörü
olmayan bir kurulumda çalışma anında çekilen her varlık **yok** demektir; bu
bir incelik değil, özelliğin hiç olmaması demek. Bu yüzden ağır varlıklar
(WASM, font, KaTeX) uygulamanın İÇİNE gömülür ve **talep üzerine** açılır.

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
  üretici** kurar ve `--bant-h`'tan beslenir; panel başına kopya bant
  kurulmaz.
- **KABUĞUN ÜST BANDI TEK ÇİZGİ, TUVAL KENARA YAPIŞIK.** Her sayfada yan yana
  duran başlıklar (Topoloji: "Bileşenler" · sekme bandı · müfettiş başlığı;
  Sonuçlar: Veri Gezgini · araç çubuğu · rapor bandı) ölçüyü ve zemini TEK
  jetondan alır: `--bant-h` + `--bant-zemin`. Bandın başlığı altındaki
  sütunun sol kenarından başlar. Tuvalin kendi çerçevesi yok (çukur emekli):
  sınırı komşusunun çizgisidir. Kapı: `kabuk-bant.test.js` +
  `kabuk-sutun.spec.js` → *"KABUK TEK ÇİZGİ"*.
- **BİR KULLANICI EYLEMİ = BİR GERİ-AL ADIMI.** `createNode` her düğümde
  `saveState()` çağırıyor; ONİKİ düğüm kuran bir kurucu (modül örneği,
  sihirbaz, açılış yüzeyi) bu yüzden `js/state.js` → **`veStateBatch(fn)`** ile
  sarılır, yoksa Ctrl+Z modeli düğüm düğüm söker. Bir topolojinin AÇILIŞ
  durumu geri alınamaz (`veStateResetBaseline`) — modüle girip araçları almak
  bir düzenleme değil. Kapı: `state.test.js` (mekanizma) + `cp-fead.test.js` /
  `fead-wizard.test.js` / `fead-cizim-masasi.test.js` (kurucular ve çizimde
  ekleme o mekanizmadan geçiyor mu).
- **YIĞINDAKİ DURUM BİR ANLIK GÖRÜNTÜDÜR.** Geri-al / ileri-al yığındaki
  kaydın KOPYASINI geri yükler (`js/state.js` → `_veStateKopya`):
  `restoreState` düğüm `data`sını durumun kendi nesnesinden alıyor ve kopyasız
  hâlde geri-al'dan sonraki ilk yerinde düzenleme kaydı da değiştiriyordu —
  sonraki Ctrl+Z "Geri alındı" deyip hiçbir şeyi geri almıyordu. Kapı:
  `geri-al-yolu.test.js` (GERÇEK `restoreState`; `state.test.js` onu sahte yapıyor).
- **ÇİZİLEN KAMERA CİHAZ PİKSELİNE OTURUR** (`js/canvas-space.js` →
  `veCanvasTransformCss`). `#ve-canvas`a çıplak `translate(offset)` yazılmaz:
  kesirli ofset 1× ekranda tuvaldeki her kenarı iki piksele yayıyordu. Yuvarlanan
  yalnız çizim, `canvasOffset` DEĞİL (pan adımları onun üstüne birikiyor).
  Kapı: `tuval-cihaz-pikseli.test.js`.
- **KART İÇİNDEKİ KAYDIRILABİLİR YÜZEY TEKERLEĞİ ÖNCE ALIR**
  (`js/ui-core.js` → `veWheelInnerPane`). Kanvasın tekerlek dinleyicisi
  kayıtsız `preventDefault()` çağırdığı sürece kart içindeki hiçbir liste
  kaydırılamaz — olay oradan kabarıyor. Koşul ÇİFT: `overflow` izin veriyor
  **ve** içerik sığmıyor; yalnız birincisi taşması olmayan her kapta tekerleği
  yutar. Kapı: `kart-yuzey.spec.js` → *"TEKERLEK"* (sentetik kart).
- **KARTIN EN KÜÇÜK ÖLÇÜSÜNÜ TİPİ SÖYLER** (`componentDefs.minWidth/minHeight`
  → `js/node-resize.js` `veNodeMinSize`). Genel 50×50 tabanı içeriği olan bir
  kart için sessiz kayıp üretir (gövde tamamen örtülür, alanlar işaretsiz
  kayar). Beyan etmeyen tip eski tabanda kalır; taban hem
  sürüklemede hem AÇILIŞTA uygulanır (yoksa kuraldan önce kaydedilmiş kart
  bozuk açılır). Kapı: `fead-table.test.js` (mekanizma, sentetik tip) +
  `kart-yuzey.spec.js` → *"EN KÜÇÜK ÖLÇÜ"*.
- **TEK YAZI TİPİ: `--font-sans`** — Windows'ta Segoe UI (kullanıcı kendi
  ekranında seçti, 2026-09-25), başka yerde gömülü Inter (`css/fonts.css`).
  Başlık, gövde, etiket, sayı, form ve TUVAL dâhil. İNDİRİLEN BELGELER gömülü
  Inter'le yazar (A4 düzenleri onunla ölçüldü); `veThemeFontFaceCss()` yığındaki
  GÖMÜLÜ aileyi gömer, ilk aileyi değil. Rakam hizası `tabular-nums` ile. Tuval
  `var()` çözemez → yüz VE BOY köprüden: `veThemeFont('tiny', ağırlık)` —
  sayıyla boy yazılmaz (ölçek büyüyünce grafikler kıpırdamıyordu); renk de
  köprüden (`veThemeRgba`), çünkü `color-mix(`/`var(--` tuvalde sessizce yok
  sayılır. Kapı: `theme-font.test.js`. Çıplak aile adı yazılmaz.
  İstisnalar: hizası BOŞLUKLA kurulmuş düz metin (TXT rapor `<pre>`) ve KaTeX.
  Ölçek tabanı 10 px, gövde 12 px; kenar tonu zemine ≥ 1,5:1 (kullanıcı
  kararları). Kapı: `tek-yazi-tipi.test.js` + `.spec.js` · `typography-scale` ·
  `theme-contrast`.
- **SÜTUNDA YATAY KAYDIRMA YOK — sığmayan tablo AÇILIR PENCEREDE**
  (`js/tablo-pencere.js`). Panel tabloyu + kendi düğmelerini bir BİRİM
  işaretler (`data-ve-tablo` · `-baslik` · `-ozet`); karar ÖLÇÜMDEN (sığmıyorsa
  özet kartı + "Tabloyu aç"), tablo pencereye TAŞINIR, kopyalanmaz. Sekme
  açan kod kararı AYNI karede ister (`veTabloOlcIcinde`). İki sütunlu pencere
  de ekrana değil PENCEREYE sorar (`@container vepanel`). Kapı:
  `tablo-pencere.test.js` + `tablo-pencere.spec.js` + `mufettis-sigma.spec.js`.
- **SONUÇLAR PANOSUNA YAYIN YAPAN MODÜL KAYNAK TABLOSUNA GİRER**
  (`js/results.js` → `veResultSources`): sekme · kütüphane · yorum · sonuç
  globali · unutucu. `results.js` · `trace-view.js` · `graphics.js`'e modüle
  özgü dal YAZILMAZ — Takoz'un 42 satırlık dağınık dalı ikinci modülde
  kopyalanacaktı ve biri zaten unutulmuştu ("Sonuçları Temizle" FEAD'i
  silmiyordu). Kapı: `fead-sonuclar-sekme.test.js` + `mount-results-tab.test.js`.
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

### CAN Çözümleyici (`candbc/`)

CAN kayıtlarını DBC'ye göre çözüp diyagrama döken **üçüncü program**. Karar
kaydı ve dokunulmazlıkları `candbc/README.md` içinde; `candbc/js/*`,
`candbc/index.html` ya da CAN testlerine dokunmadan önce oku.

**`js/` ve `viewer/js/` ile HİÇBİR dosya paylaşmaz** — senkron kapısı yok,
`sync:viewer` bu klasöre bakmaz. Ortak olan tek şey `css/`, o da build'de
gömülüyor. Bu yüzden görüntüleyicideki tuzağın AYNISI burada da geçerli:

```bash
# css/ VEYA candbc/ dokunulduysa, commit'ten önce:
npm run build:can        # ve üretilen MFSim_CAN_Cozumleyici.html'i commit'e kat
```

`css/styles.css`'te yapılan bir rötuş `candbc/` altında hiçbir şeye
dokunmadığı için başka hiçbir kapı görmez; CI'daki tazelik kapısı
(`build:can` + `git diff --exit-code`) görür ve kırmızıya döner.

**`css/` ÜÇ ÜRÜNE BİRDEN GİRİYOR.** `viewer/build.js` ve `candbc/build.js` de
`../css/*.css`'i inline ediyor; `css/styles.css`'e dokunmak
`MFSim_Olcum_Goruntuleyici.html` ile `MFSim_CAN_Cozumleyici.html`'i **birden**
bayatlatıyor ve ikisi de git'e dâhil.

Bu bir kez görüntüleyicide, bir kez CAN'da kaçtı — çünkü kapı YALNIZ CI'daydı ve
her kaçış bir CI turu + bir düzeltme commit'i + bir tur daha demekti. **Kapı artık
`npm test` içinde**: `tests/unit/build-freshness.test.js` üretilen dosyayı geçici
bir yola derleyip depodakiyle karşılaştırıyor (1 sn) ve bayat dosyayı adıyla, ilk
fark satırıyla ve çalıştırılacak komutla söylüyor. Ürün sayısı artarsa o testin
tablosuna bir satır eklenir — `package.json`'daki `build:*` betiklerine bak.

```bash
# npm test "BAYAT" derse:
npm run build:viewer     # MFSim_Olcum_Goruntuleyici.html
npm run build:can        # MFSim_CAN_Cozumleyici.html
# (viewer/js/ dokunulduysa önce: npm run sync:viewer)
```


## Çalışma Akışı (hızlı döngü)

### ÖNCE: bağımlılıklar kurulu mu?

`node_modules/` git'e dâhil DEĞİL ve uzak oturum konteyneri depoyu her seferinde
temiz klonluyor. Kurulum yoksa `npm test` **koşmaz**: `npx` jest'i ağdan
indirmeye kalkar ve ölçülen sonuç 3 dk 52 sn sonra
"jest-environment-jsdom bulunamadı" — yani dört dakika sonra hiçbir test
koşmamış olur.

`.claude/hooks/session-start.sh` bunu oturum başında yapıyor (`npm install`,
`ci` DEĞİL — konteyner durumu hook'tan sonra önbelleğe alınıyor). Elle kontrol:

```bash
[ -d node_modules/jest-environment-jsdom ] || npm install
```

Amaç: her küçük değişikliği build+tüm-test töreni yapmadan geliştirmek.
Önemli gerçek: **birim testler build'e ihtiyaç duymaz** — testler doğrudan
`js/` dosyalarını yükler, `MFSim_Code.html`'e dokunmaz. Build yalnızca
E2E ve deploy için gerekir.

### NEREYE VAKİT GİDİYOR — ÖLÇÜLDÜ (2026-09-07, 4 çekirdek)

Kullanıcı bildirimi: *"bir PR ve merge için en az 30-40 dakika bekliyoruz."*
Ölçüldü, ve suçlu tahmin edilenler değildi:

| İş | Süre | Not |
|----|------|-----|
| `npm run build` | **1 sn** | bedava, hiç kaçınma |
| tek test dosyası | **3 sn** | |
| `npm run test:takoz` | **8 sn** | 21 dosya |
| `npm run test:fead` | **20 sn** | 30 dosya / 1432 test |
| `npm run test:arac` | **46 sn** | |
| `npm test` (tam) | **67 sn** | 168 dosya, 256 sn CPU |
| tarayıcı doğrulaması | **8–17 sn** | loader beklenmezse 8 |

**KURAL: DÖNGÜDE MODÜL TESTİ, COMMIT'TEN ÖNCE TAM TEST — bir kez.**
Bir turda `npm test`'i beş kez koşturmak 8 dakika demek; aynı işi
`npm run test:fead` ile yapmak 100 saniye. Ölçülen kaçak buydu.

```bash
npm run test:fead     # ya da :arac · :takoz — döngü boyunca
npm run hazir         # build + tam test — commit'ten ÖNCE, TEK SEFER
npm run test:urun     # CI'nın e2e-urun işinin KENDİSİ — UI kabuğuna dokunduysan
```

Mutasyon testleri de modül testiyle koşar; tam testle değil.

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

FEAD satırları modül skill'ine taşındı
(`.claude/skills/fead/references/testler.md`); **tam tablo**
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
| `tests/unit/mount-shock.test.js` | `js/mount-core.js` şok + `js/mount-signals.js` | Newmark-β geçici rejim: yarı-statik limit, sönümsüz enerji korunumu, modal salınım frekansı, **metal-metal durdurucunun gerçekten sınırlaması** (daha az yol, daha çok kuvvet) |
| `tests/unit/mount-nonlinear-transient.test.js` | `js/mount-core.js` `shockResponse` + `buildKfromBasis` + FRF | **İki sessiz hatanın kapısı**: (1) şok çözümü lineerdi — statik taraf Newton koşarken geçici rejim sabit K ile tek çözüm yapıyordu; (2) rijitlik tabanı üç ayrı yerden geliyordu (modal tanjanttan, FRF/şok nominal k_dyn'den) → aynı panoda modal frekans ile FRF tepesi ayrışıyordu. Kilitler: yarı-statik limitte Newton'un `solveCaseNL`'e inmesi + kalan farkın sönümle küçülmesi (atalet artığı, model sapması değil), küçük genlikte şok salınımının TANJANT moda oturması, lineer modelde Newton yolunun eski çözümle birebir eşleşmesi, ve TTAR referans modelinde durdurucu payının statik önyükle birlikte ölçülmesi |
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
| `tests/unit/mount-adams-tulga.test.js` + `tests/fixtures/adams-tulga.js` | `assets/examples/tulga_topoloji.json` ↔ Adams referansı | **Karşılaştırmanın defteri** (doğruluk kapısı değil): Adams'ın Tulga tablosu ve Adams'ın koştuğu GİRDİ dondurulmuş. Üç şeyi sayıyla tutar: (1) statik taraf örtüşüyor — 10 temiz yük durumunda RMS 0,067 mm, tablonun 0,1 mm yuvarlamasının altında, ve iki varyantta AYNI (k_dyn statik çözüme girmez); (2) iki açık model farkı — Adams'ta olup MFSim'de olmayan yanal ~12 mm durdurucu ve ters tork yalpa işareti; (3) kapanmamış modal sorusu — Adams, TK040 dinamiği TAKASLI girdiye (RMS 0,539 Hz) kataloglu girdiden (1,010 Hz) daha yakın, yani Adams'ın girdisi de muhtemelen takaslı. MLMT-0216-33-TK040 raporu depoda YOK; geldiğinde hangi tarafın oynayacağı bu sayılardan okunur |
| `tests/unit/mount-example-library-match.test.js` | `assets/examples/*_topoloji.json` + `js/mount-core.js` `MOUNT_EXAMPLES` + `js/cp-mount.js` `VE_MOUNT_LIBRARY` | **Örnek modeller katalogla tutarlı mı**: Tulga'nın iki TK040 takozunda dinamik rijitliğin X ile Z'si takas girilmişti (katalog 740/355/335, örnekte 335/355/740) ve İKİ kopyada birden duruyordu. Sessizdi çünkü statik çözüm yalnız `k_stat` kullanır — 210 çökme değerinin hiçbiri değişmiyordu; hata yalnız modal/FRF/sönüm/şok tarafında görünür. İki kapı: statik üçlü kütüphanede tek bir kayıtla eşleşiyorsa dinamik üçlü de o kaydınki olmak zorunda; ve dinamik/statik oranının eksene göre yayılımı ≤ 1,5 (27 katalog girdisinin en kötüsü 1,117, takaslı hâl 4,701 — eşik ikisinin arasında) |
| `tests/unit/mount-example-names.test.js` | `js/mount-core.js` örnekleri + `assets/examples/*.json` | Örnek modellerde ad ↔ konum tutarlılığı (Sağ/Sol ↔ Y işareti), tekrarlı ad, iki kopyanın ayrışmaması |
| `tests/unit/mount-results-tab.test.js` | `js/results.js` + `js/graphics.js` | Takoz çözüm sekmesi, tek X ekseni kuralı, pano uzlaştırma |
| `tests/unit/mount-results-publish.test.js` | `js/cp-mount.js` | Çözümün panoya yayını; alt-topoloji çökertme regresyonu |
| `tests/unit/canvas-space.test.js` | `js/canvas-space.js` + `css/styles.css` | Sonsuz ızgara deseni, "ev" kamerası, topoloji ortalama; **sınır çerçevesi düğüm ADINI da sarar** — `veNodeLabelOverflow` dört kenar için taşma (yanda 7+genişlik, alt/üstte 4+yükseklik, karşılıklı taşma İKİ YANA EŞİT), modül kartının adının taşma EKLEMEMESİ, alt payın hiç küçülmemesi (çerçeve yalnız büyür), ölçüm işlevi geçilmezse davranışın BİREBİR eski hâli, ve boşluk sabitlerinin `css/styles.css`'teki margin'lerle aynı olması |
| `tests/unit/module-start-center.test.js` | `js/components.js` `veStartModule` | Karşılama kartından gelen modül bloğu görünümün TAM ortasına düşer (kabuk senkronu ölçümden önce) |
| `tests/unit/port-geometry.test.js` | `js/components.js` port geometrisi + `js/connections.js` | Bağlantı ucu ile port dairesi aynı noktada — dört kenar, çok port, aynalama; **`veSyncPortDom`** — kenar sonradan değişince (AYNALAMA) dairenin teli takip etmesi, elle taşınan portun ezilmemesi, kenar değişmiyorsa DOM'a hiç yazılmaması; **negatif kapı: FEAD kasnakları portsuz** — iki kasnak arasına tel kurulsa bile ne amber kayış sınıfı ne gidiş oku çizilir (`veConnDirMark`'ın matematiği duruyor, bugün çağıranı yok). Kasnakların ayrıca kanvasta KUTUSU da yok (`noCanvasBox`) |
| `tests/unit/module-card.test.js` | `js/components.js` alt-sistem kartı + sidebar modül satırı | Modül kartı: içerik özeti (alt topolojiden), kart ölçüsünün tek kaynağı, eski 80×66 kaydın yükselmesi, **ad elemanının taşınması** (kopyalansaydı yeniden adlandırma sessizce eskirdi); palet sembolü `componentDefs`'ten (index.html'de ikinci kopya tutulmadığına dair kapı) |
| `tests/unit/example-topology-center.test.js` | `js/cp-mount.js` + `assets/examples/` | Örnek JSON'ları kanvas merkezine açar |
| `tests/unit/topology-wiring.test.js` | `js/ui-core.js` `veTryConnectPorts` + `js/connections.js` topoloji imzası | **Kanvasta tel çekmek**: geçersiz port çifti (çıkış→çıkış, giriş→giriş, kendine) bağlantı kurmaz ama SESSİZ de kalmaz; doğru çift her iki yönden de aynı bağlantıyı kurar; topoloji imzası tel/düğüm değişince değişir, düğüm SÜRÜKLENİNCE değişmez (kart 30 karede 0 kez yeniden kurulur) |
| `tests/unit/fead-table.test.js` | `js/cp-fead.js` Kayış Tablosu + `js/fead-model.js` sıra | **Kasnakların sayısal giriş yüzeyi — 2026-09-23'ten beri PENCERE** (Çizim Masası): sütun kimlikleri kullanıcının hesap sayfasına karşı ölçülü (efektif çap = OD+2·hb / OD+2·hr, Σişaretli sarım 360°, L = Σspan + Σ(sarım·r)); türetilen sütunlar ÇEKİRDEKTEN; girdi sütunları geometri çözülemese de dolu; virgüllü ondalık (`63,5` → 63.5); satır taşıma ve sürücü kilidi; Dönüş Yönü iki durumlu segment ve `contact` yazar; ekle/sil (gergi tekil, ekleme gerginin önüne, `saveState` mutasyondan önce); görünüm CSS'te, durum kuralları jetondan; tazeleme TEK KAPIDAN (şema + açık pencere); ad düğmesi paneli AÇAR; **tablo bir kanvas bileşeni DEĞİL** (tip · palet · panel · ölçü sabiti yok) |
| `tests/e2e/fead-tablo.spec.js` + `fead-sihirbaz-tablo.spec.js` | Kayış Tablosu çekmecesi (gerçek tarayıcı) | **Çekmece**: kartın düğmesiyle açılır (iki kartta da basılı), ESC kapatır, kanvasla ÖLÇEKLENMEZ (zoom 0,35'te girdi arayüzün `--fs-lg` basamağında), tek başlık satırı; gerçek `63,5` yazımı modeli ve çözümü değiştirir; Sekme odağı düşürmüyor; satır oku, sürücü kilidi, yön segmenti (efektif çap +0,2 mm), sil/ekle; fare/odak/seçili satır CSS'ten, satır ↔ iki çizimde işaret, başlık satırı fareye tepki vermez; **tuvalin ALTINA yapışık** (1366×768 · 1920×1080: dört kenar 0 px, minimap üstte, çizim kesilmiyor, kamera YAKINLAŞMIYOR ve kapanınca dönüyor), tutamak tuvali o kadar kısaltıyor ve boyu hatırlıyor, FEAD'den çıkınca kapanıyor (arka plan kaydı kapatmıyor), kanvası kaydırmıyor, tekerlek listeyi kaydırıyor, eklenen satır görünür; Ctrl+Z örneği TEK adımda geri alıyor ve açılış kartı kalıyor. **Sihirbazın 'Modeli Kur'u**: 6 kasnak + iki kanvas (açılışın boş kartı DEVRALINIR) + kayış + çözücü + rapor + sihirbaz = 12 düğüm, 0 tel, uyarı yok, çözüm önizlemeyle birebir |
| `tests/unit/fead-cizim-masasi.test.js` | `js/cp-fead.js` Çizim Masası | **Kasnak çizimde seçilir, taşınır, eklenir**: ters köprü (ekran → mm) isabet halkasını kasnağın KONUM GİRDİSİNE döndürüyor (gergide `cenX/cenY`); etkileşim katmanı yalnız kartta ve CSS'siz belgede GÖRÜNMEZ; fare altı iki çizimde sınıfla, kart kurulmadan; ok tuşu TAM adım (ızgaraya yuvarlamaz), kayışı koparan adım yazılmaz; açıklık seçimi ve halkanın içi/dışı bağımsız kâhinle (aynalanmış düzen dâhil); ekleme adayı KOPYADA çözülür, gergi ↔ sürücü açıklığı kapalı, ekleme ve tablonun ekleyicisi TEK geri-al adımı; **tablo çekmecesi** kanvas alanının SATIRI (tuvalin içinde değil), FEAD içeriği kalmayınca kapanır, kamera yalnız kesilen çizimde oynar · hiç yakınlaşmaz · kapanınca döner, tutamak sınırları ve hatırlanan boy |
| `tests/e2e/fead-cizim-masasi.spec.js` | Çizim Masası (gerçek tarayıcı) | Sürükleme imleçle birlikte yazar (0,1 mm ızgara, künye ve iki açıklık boyu ekranda) ve TEK adım; koparan konum yazılmaz, sebebi şeritte; tık pencereyi açar ve iki çizimde işaretler; klavye gergide avara merkezini tam adımla oynatır; paletten bırakma açıklığa girer (iz hedefi söyler), kapalı açıklık kırmızı ve reddedilir, boşluk reddedilir, çizim dışı tabloya gider ve tabloyu açar |
| `tests/e2e/kart-yuzey.spec.js` | `js/node-resize.js` + `js/ui-core.js` | **İki ortak kural, sentetik kartla**: tutamak sürüklemesi tipin en küçük ölçüsünde duruyor; kart içindeki TAŞAN liste tekerleği önce alıyor, taşmayan kap almıyor |
| `tests/unit/fit-view.test.js` | `js/ui-core.js` `veFitViewToContent` | Seçeneksiz çağrı eski davranış; `only` süzülmeyeni kadrajdan çıkarıyor; kap çok küçükse kamera oynamıyor; `bottomInset` YOK (tablo çekmecesi tuvalin altında, örtü yok) |
| `tests/unit/fead-katman.test.js` | `js/cp-fead.js` katmanlar + `js/components.js` | **Kart ne çizeceğine kendi karar verir**: liste TEK KAYNAK — her katmanın çiziciye giden seçeneği var, çizici onu OKUYOR ve kart kurucusu bayrağı GEÇİYOR (üçünden biri kopunca kutucuk panelde görünür, çizimde hiçbir şey yapmaz); iki ÖN AYARIN varsayılanı farklı ve tip döneminin aynısı; **eksik anahtar varsayılana düşer** (eski kayıt çıplak şemayla açılmasın); tanınmayan ön ayar adı da varsayılana düşer; bağlı katman (adlar kapalıyken "adı kısalt"); seçim kart başına ve öteki kartın alanı bile açılmıyor; `saveState` mutasyondan ÖNCE; **ön ayar ADIYLA yazılır** (`katOn`), sekiz bayrağın kopyasıyla değil, ve elle seçimleri temizler; **ön ayar DEVRİ de belirler** (geometri `off`) ama yazılmış bir alanı EZMEZ ve söz söylemediği alana (titreşim · kol konumu) dokunmaz; varsayılan ön ayar `kat` ile `katOn`u SİLER; panel yalnız açık kart için basılır ve açıklık MODELDE DEĞİL; her ön ayar için bir düğme var, açık olan BASILI ve elle kutucuk oynayınca basılılık düşüyor; **`fead-run` diye bir tip YOK** — `componentDefs`te de, `index.html` paletinde de, `components.js` kodunda da; **kol konumu kart başına** (`veFeadPosModeShared` KALDIRILDI); iki kart aynı tipten ama iki ayrı resim çiziyor; **her bayrak çizimi gerçekten değiştiriyor** (kural, liste değil); adlar kapalıyken dar kartta yer de ayrılmıyor (240×180'de yarıçap 17,0 → 25,0); görünüm CSS'te ve durum kuralları var |
| `tests/e2e/fead-kanvas.spec.js` | `js/cp-fead.js` Kayış Yolu kartı (gerçek tarayıcı) | **BANT YOK, DENETİM ÜSTTE YÜZER**: kart dört yatay bant taşıyordu (iki seçici şeridi 44 px + durum 20 px + titreşim açıkken 20 px daha) ve her biri yüksekliğini ÇİZİMDEN alıyordu — 440×500 kartta çizime 436 px kalıyordu, titreşimle 416. Node'da hiç koşmayan halkalar: çizimin GERÇEKTEN kabuğun tamamını alması, yüzen çubuğun TEK SATIR kalması ve taşmaması (`left:50%` ile ortalanırsa mutlak kabın sığdırma genişliği yarıya iniyor ve çubuk dört satıra sarıyor — ölçüldü, 40 → 110 px), **yön gülünün çubuğun altında kalmaması** (ölçülmüş hata: gül TAMAMEN görünmez oluyordu; çözüm çizimi küçültmek değil gülü yukarı almak), titreşim şeridinin de yüzmesi ve çizimi küçültmemesi, rozetin BİRİNCİL okumasının duruma göre değişmesi (iyi hâlde tek sayı + soluk künye, kötü hâlde arızanın cümlesi ve künye YOK) ve renginin CSS'ten gelmesi; **çubuğun seçicileri kesilmiyor** — liste SEÇİLİ metne göre boyutlanır (`field-sizing:content`), kol listesi kısa adla (72 seçicide 25 → 0) |
| `tests/e2e/fead-katman.spec.js` | Katman paneli (gerçek tarayıcı) | **Node'da hiç koşmayan halkalar**: düğme yüzen çubuğun içinde ve çubuk kaymıyor, gerçek tıklama paneli açıyor, panel çubuğu İTMEDEN çizimin üstüne biniyor ve kartın içinde duruyor, kutucuk çizimi değiştiriyor ve **panel açık kalıyor** (kapansaydı ikinci kutucuk işaretlenemezdi), bağlı satır pasifleşiyor, `:hover` ve `:has(input:checked)` gerçekten hesaplanıyor, toptan işlemler sayacı 5/8 → 0/8 → 8/8 gezdiriyor; **ÖN AYAR DÜĞMESİ kartı gerçekten çeviriyor** (Geometri ↔ İşletme: animasyon yükü doğuyor/kayboluyor, basılı durum CSS'ten hesaplanıyor, elle kutucuk oynayınca hiçbir ön ayar basılı kalmıyor) ve Geometri'ye dönünce `kat`/`katOn`/`animRpm` alanlarının üçü de SİLİNİYOR; **iki kart iki ayrı resim** çiziyor, ikinci panel açılınca birincisi kapanıyor, her kart KENDİ kol konumunu çiziyor ve paletten kurulan ÜÇÜNCÜ kanvas da ön ayar seçebiliyor |
| `tests/unit/state.test.js` | `js/state.js` | Undo/redo stack yönetimi; **toplu kurulum TEK adım** (`veStateBatch`) — `createNode` her düğümde `saveState` çağırdığı için onikilik bir kurulum yığına onüç adım yazıyordu ve Ctrl+Z modeli düğüm düğüm SÖKÜYORDU; sayaç (bayrak değil — kurucular iç içe geçiyor), gövde patlasa bile `finally` ile kapanma (kapanmasaydı geri-al oturumun kalanında sessizce ölürdü) ve **açılış durumunun yığın TABANI olması** (`veStateResetBaseline`) |
| `tests/unit/geri-al-yolu.test.js` | `js/state.js` `restoreState` (GERÇEK) + `js/connections.js` imza | **Yığındaki durum bir anlık görüntü**: geri-al ve ileri-al KOPYA geri yükler — ikinci Ctrl+Z da geri alıyor, geri yüklenen düğüm kaydın nesnesini taşımıyor; FEAD kartı kasnaklardan önce gelse de geri yüklemeden sonra TAM modelle kuruluyor (imzaya girmeyen bir alanın geri alınması kartı boşaltmıyor) |
| `tests/unit/toolbar-save.test.js` | `js/toolbar.js` | Proje kaydetme, JSON serileştirme, showSaveFilePicker |
| `tests/unit/viewer-board.test.js` | `viewer/js/board.js` | Görüntüleyici panosu: bir panoda tek ölçüm dosyası kuralı, X ekseni seçenekleri, veri kapısı |
| `tests/unit/viewer-sync.test.js` | `viewer/sync.js` | Görüntüleyici kopyaları `js/`'ten geride kaldıysa kırmızı — sessiz ayrışmaya karşı kapı |
| `tests/unit/measure-dropzone.test.js` | `js/measure-dropzone.js` | Sürükle-bırak uzantı süzgeci (sessiz yanlış çıktıya karşı); **yerel bırakma alanı** (`data-ve-dropzone`) kaplamayı devralıyor — alan içine bırakılan dosya ölçüm sihirbazını açmıyor, alan dışı davranış korunuyor |
| `tests/unit/simulation-engine-grade.test.js` | `js/simulation-engine.js` | Yol eğimi işaret konvansiyonu (harita ↔ fizik çevirisi) + dinamiğin değişmediğini bağlayan altın değerler |
| `tests/unit/shot-tool.test.js` | `tools/shot.js` | Ekran görüntüsü aracının ayrıştırma çekirdeği: bilinmeyen bayrağın SESSİZCE yutulmaması (yanlış ekranın görüntüsü alınırdı), hedef takma adları, PNG ölçüsü, karşılaştırmanın İKİ GÖRÜNTÜYÜ TEK ÖLÇEKLE küçültmesi |
| `tests/unit/build-freshness.test.js` | `viewer/build.js` + `candbc/build.js` + `package.json` | **Git'e dâhil üretilen dosyalar taze mi**: `css/` üç ürüne birden girdiği için bir tema rötuşu `MFSim_Olcum_Goruntuleyici.html` ve `MFSim_CAN_Cozumleyici.html`'i birden bayatlatıyor ve kapı eskiden YALNIZ CI'daydı. Derleme geçici yola yapılır (`MFSIM_BUILD_OUT`) — test çalışma ağacını kirletmez. Ayrıca `three` köken kapısı: npm bağımlılığı kaldırıldı (kullanılmıyordu, kurulum başına 30,1 MB), sürüm izi `index.html` ile `vendor/three.min.js` arasında bağlı |
| `tests/unit/source-hygiene.test.js` | `js/`, `viewer/js/`, `css/`, `index.html` | **Yapısal kapılar**: üst-seviye bildirim çakışması yok, kaynakta kontrol karakteri yok |
| `tests/unit/pchip-uc-kopya.test.js` | `js/numerics.js` + `js/ft-performance.js` + `js/mount-core.js` | **Tek PCHIP algoritmasının ÜÇ ayrı yazımı aynı eğriyi verir**: `assets/examples`'taki her sayısal tablo üç kopyada karşılaştırılır — ayrışma sessizdi, çünkü her dosya kendi başına doğru. **Bilerek ayrık üç nokta ÇİVİLİ**: tablo dışı (A/B düz — C doğrusal, gerekçesi `mount-core.js`), n=2 (A `null` döner, `veEvalPchip` sessizce `0` verir), geçersiz girdi (yalnız `ft-performance.js` adresli hata atar) |
| `tests/unit/loader-splash.test.js` | `js/loader.js` + `index.html` açılış ekranı | **Açılış ekranı (AMBLEM)**: splash gövdesi ↔ `ELS` kimlik sözleşmesi (bir yeniden adlandırma cetveli sessizce durdururdu), `data-mfsim-stage` işaretlerinden öbeklerin kurulması (işaretsiz script bir öncekine yazılır; ad `&` içerebilir) ve **yalnız o anki öbeğin** Roma rakamıyla yazılması (rakam sıradan türer: IV, IX, XIV), etiketin yalnız öbek DEĞİŞİNCE belirmesi, atlanan modülün GÖRÜNÜR olması (uyarı satırı + öbek sürerken kehribar rakam) + yüklemenin devam etmesi, sürüm künyesi (modüler kopyada boş kalır), ipucu döngüsünün kapanışta DURMASI; **SAHNE**: kare listesinin defer OLMAMASI ve yükleyiciden ÖNCE gelmesi (defer setine düşerse açılış fotoğrafsız açılır), karenin seçilip boyanması + gömülü data URI ↔ dosya yolu, kare yoksa kâğıt zeminde açılıp yüklemenin yine bitmesi, **perdenin TEMANIN ZEMİNİNDEN türemesi** (tema-nötr siyah çıplak renk kapısından geçer ama açık temada koyu yazıyı koyu zemine oturturdu) ve fotoğrafsız hâlde hiç çizilmemesi, amblemin kapanışta kaymaması ve karşılama kartıyla aynı sol kenarda durması, modül giriş panelinin karşılama kartıyla BİREBİR geometrisi (left/genişlik/yarıçap/cam/gölge), **temanın ilk karede** uygulanması (kayıtlı tema hiçbir şey çizilmeden konuyor, eski kimlik ilk karede göçüyor, bozuk kayıt varsayılana düşüyor); **KADEME**: kademe sayısı tek kaynak (CSS jetonu `--mfsim-kademe`, loader onu OKUR ve cetvelin ızgarası da onunla çizilir — kademe başına bir bölme), ilerlemenin kademeye yuvarlanması (1/24'te cetvel hâlâ boş), son geçilen bölmenin VURGU taşıması ve bitişte vurgunun sönmesi, yüzdenin GÖRÜNMEMESİ (değer `aria-valuenow`da), dişlinin kademe başına bir çentik dönüp %100'de TAM TUR tamamlaması (devir teslimde dik durur), modül adının da kademeyle değişmesi, süsleme karelerinin (dönen dişli + parıltı) KALDIRILDIĞI |
| `tests/unit/results-txt-preview-download.test.js` | `js/results.js` | TXT önizlemesinin "HTML İndir" yolu — iki rapor üreticisinin ayrı kaldığı; düğme kablolaması artık ÜRETİLEN YÜZEYDEN ölçülüyor (kopya sayısı değil: bandı tek üretici kuruyor) ve dört panelin de aynı kabuğa gittiği |
| `tests/unit/results-txt-page.test.js` | `js/results.js` + `css/styles.css` | **TXT raporunun görünümü**: üst bandın soldaki "Veri Gezgini" bandıyla TEK ölçü kaynağından beslenmesi (yükseklik, alt çizgi, başlık puntosu, zemin, düğme sınıfı), sayfanın A4 olması ve içeriğe göre DARALMAMASI, gövdenin tek `<pre>` kalması (blok blok ortalama yok) ve metnin bire bir korunup kaçışlanması, font ölçüsünün sayfaya sığmaktan türemesi + okunur tavan, karakter oranının ölçülemeyince GÜVENLİ tarafa düşmesi, indirilen belgenin aynı sayfayı açıp `@page{size:A4}` ile basması |
| `tests/unit/programlar-arsiv.test.js` | `js/cp-programlar.js` + `programlar/kayit.json` + `build.js` | **Program arşivi kaydı sessiz kırılmasın**: kayıttaki her `dosya` diskte var, öksüz HTML yok, her `kume` pencerenin küme tablosunda var (yoksa satır HİÇ çizilmez), üretilen üç üründe `boyut` YOK / donmuşlarda diskle birebir, `../` ile başlayan ürün yolunun belge dizinine düşmesi (depo ve dağıtım), yoklama hedefinin var olması ve veri TAŞIMAMASI, build'in gömdüğü global adın modülün okuduğuyla aynı olması, arşiv gövdelerinin gömülmediği |
| `tests/e2e/programlar-arsiv.spec.js` | `js/cp-programlar.js` yoklaması | **GERÇEK tarayıcı**: arşiv yanında yokken liste yine çizilir ama satırlar pasif ve sebebi yazılı; yanındayken satırlar etkin ve tıklanan program gerçekten açılır. jsdom'da script etiketi ağa çıkmaz — bu halka Node'da HİÇ koşmuyor |
| `tests/e2e/fead-yerlesim.spec.js` | `js/cp-fead.js` `veFeadFallbackSlots` + `veFeadArrangeByCoords` | **Örnek yüklenince kartlar nereye düşüyor** (gerçek tarayıcı): tablo ÜSTTE, iki kanvas YAN YANA, hiçbir kart çakışmıyor ve blok geniş — dar-uzun sütun dizilişi sığdırmayı yükseklikten sınırlayıp zoom'u 0,473'e düşürüyordu. **İKİNCİ HALKA YEDEK YOL**: `window.veFeadArrangeByCoords` kırılıp aynı kapılar yeniden ölçülüyor — kurucular yerleştiriciyi `try/catch` ile sarıyor, yani o yol patlarsa geçerli kalan sıra yedektir ve eskiden kanvasları ALT ALTA diziyordu. Node'a TAŞINAMAZ: yerleştirici aynı modül kapsamında duruyor, stub'lanamıyor ve koordinatların üstüne hemen yazıyor |
| `tests/e2e/app.spec.js` | Tüm uygulama | Sayfa yükleme, menüler, bileşen ekleme, kaydetme |
| `tests/e2e/measure-import.spec.js` | İçe aktarma sihirbazı | Gerçek .xlsx → sütun tarama → X/Y seçimi → şeritler |
| `tests/e2e/viewer.spec.js` | `MFSim_Olcum_Goruntuleyici.html` | **Üretilen tek dosya**, `file://` üzerinden: açılış, içe aktarma, sürükle-bırak, birleştirme, tema, sıfır ağ isteği |
| `tests/e2e/results-txt-page.spec.js` | TXT rapor önizlemesi (yerleşim) | **GERÇEK tarayıcı**: iki bandın AYNI yerde bitmesi (ölçülen eski fark 12 px), başlıkların aynı punto, sayfanın 794 px = A4 olması, metnin tek blok / tek sol kenar kalması (eski: 43 blok, 10 kenar), 119 sütunluk tablonun sayfaya sığması (yatay kaydırma yok) ve dar raporun tavan puntoyla açılması. Rapor METNİ sahte — ölçülen şey kabuk; bu halkalar Node'da HİÇ koşmuyor |
| `tests/e2e/measure-merge-drop.spec.js` | `js/measure-dropzone.js` + `js/trace-view.js` | MFSim'de sürükle-bırak ve çok eksenli birleştirme — araç performans VE takoz sekmesi |

## Sık Kullanılan Komutlar

```bash
npm run test:watch          # ★ geliştirme döngüsü — kaydettikçe ilgili testler koşar
npm run test:changed        # git'te değişen dosyalarla ilgili testler (jest -o)
npm run test:fead           # ★ FEAD modülü — 20 sn (tam testin yerine, DÖNGÜDE)
npm run test:arac           # Araç Performans — 46 sn
npm run test:takoz          # Takoz — 8 sn
npm run hazir               # ★ build + tam test — COMMIT ÖNCESİ tek komut
npm run test:urun           # CI'nın e2e-urun işinin kendisi (liste package.json'da)
npm test                    # tüm birim testleri (sessiz) — 96 sn
npm run test:ci             # tüm birim testleri (--verbose --ci) — CI logları için
npm run build               # MFSim_Code.html üret (modüler → monolitik) — commit/deploy öncesi
npm run sync:viewer         # js/ → viewer/js/ (yedi kopya + iki yerel fark)
npm run build:viewer        # MFSim_Olcum_Goruntuleyici.html üret (Ölçüm Görüntüleyici)
npm run build:can           # MFSim_CAN_Cozumleyici.html üret (CAN Çözümleyici)
npm run build:all           # üçü birden (monolit + görüntüleyici + CAN Çözümleyici)
npm run shot -- --help      # ekran görüntüsü — İSTEĞE BAĞLI, yalnız kullanıcı isteyince
npm run karsilama:secici    # karşılama kare seçicisi (Artifact olarak yayınlanır)
npm run karsilama:webp -- <dosya...>   # yeni kare: JPEG/PNG → webp + listeye yaz
npm run karsilama:bul                  # Commons'tan aday kare tara + indir
npm run karsilama:aday-secici -- --adaylar <dizin>   # aday seçim sayfasını üret
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
git fetch origin main && git checkout -B main origin/main   # BAYAT DOSYA GÖNDERME
npm run build                                               # MFSim_Code.html
git rev-parse --short origin/main                           # build çıktısındaki künye ile AYNI olmalı
```
sonra gerçek tarayıcıda aç ve **0 ağ isteği / 0 konsol hatası** olduğunu ölç,
ardından dosyayı SendUserFile ile bırak.

**SIKIŞTIRMA BİR KOŞULDUR, BİR ADET DEĞİL — ÖNCE BOYUTU ÖLÇ (2026-09-23).**
Kural şudur: **sığıyorsa sıkıştırmadan gönder.**

```bash
ls -l MFSim_Code.html          # 30 MiB'ın ALTINDA mı?
# altındaysa  → MFSim_Code.html doğrudan gönderilir
# üstündeyse  → gzip -9 -c MFSim_Code.html > MFSim_Code.html.gz
```

Kullanıcı isteği (2026-09-23): *"Sıkıştırılmış olarak atmasana, normal at."*
Bu, 2026-09-08'deki *"Zipleyip atmaya devam"* kararını **iptal etmez, yerine
oturtur**: o gün dosya 30,8 MiB'tı ve SendUserFile'ın **30 MiB** sınırını
aştığı için gönderim REDDEDİLMİŞTİ — yani sıkıştırma bir tercih değil
ZORUNLULUKTU. Sınırın altına inince zorunluluk kalkıyor, çünkü sıkıştırılmış
dosya kullanıcıya fazladan bir iş yüklüyor (sağ tık → çıkart).

Bu kural bir kez **kalıcı teslim biçimi** diye yazıldı ve yanlıştı: koşulu
(30 MiB sınırı) kuralın kendisi sanmak, dosya 17,1 MiB'a düştüğünde bile
gereksiz yere sıkıştırmaya devam etmek demekti.

Küçültme önerildi (görselleri 1200 px / kalite 75 webp'e indirmek), kullanıcı
REDDETTİ — **o karar duruyor**: karelerin kalitesi düşürülmez. Dosya
büyümeye devam edecek, yani sınır er geç yeniden aşılacak; o gün sıkıştırma
kendiliğinden geri gelir.

Geçici `.gz` gönderimden sonra silinir (çalışma ağacı temiz kalsın).

**PULL BİR NEZAKET DEĞİL KAPIDIR — ÖLÇÜLDÜ.** Oturum konteyneri depoyu bir
ANLIK GÖRÜNTÜDEN klonluyor: bu oturum `d99ae2d`de (PR #848) açıldı, `main` ise
`f820711`deydi (PR #851) — üç PR geride. `MFSim_Code.html` git'e dahil olmadığı
için her oturum onu yeniden üretir; pull atlanırsa üretilen dosya anlık
görüntünün commit'inden gelir ve **kullanıcı eski programı alır**. Kullanıcı
bildirimi (2026-09-02): *"güncel programı aldığım zaman eski program geliyor."*

Kapı iki uçlu: build çıktısı `Sürüm künyesi göm: <sha> · PR #<n>` satırını basar
ve aynı künye dosyaya gömülür — kullanıcı da **Araçlar → Program Durumu**'ndan
(ya da yeşil noktanın üstüne gelerek) hangi kopyayı tuttuğunu ÇEVRİMDIŞI
görebilir. Gönderirken bu satırı durum özetine yaz.

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
onlarca MB'ı ikinci kez indirtmenin karşılığı yok: özet verilir, "aynı dosya" denir.

**Boyut takip edilir ve SEBEBİYLE BİRLİKTE yazılır.** Dosya 8,6 → 27,7 MB
yolunu izledi ve sıçramaların hepsi gömülen WASM'lardandı (OCCT STEP okuyucusu,
TetGen, boolean'lı OCCT çekirdeği); Yapısal Analiz kaldırılınca ikisi de gitti
ve dosya **17,1 MB**'a düştü. Sebepsiz bir büyüme bir regresyon işaretidir;
sayıyı çıplak basmak onu gizler.

## SİPARİŞ FİŞİ geldiğinde — DOĞRULAMADAN uygulama

Kullanıcı Komuta Penceresi'nden `MFSIM-SIPARIS` başlıklı bir metin
yapıştırabilir. **Asla doğrulamadan uygulama:**

```bash
npm run komuta:dogrula -- <fis-dosyasi>     # ya da: ... | npm run komuta:dogrula -- -
```

Çıkış kodu 0 değilse uygulama, kullanıcıya sor. Gerekçesi, fiil sözlüğü ve
fişin hedef dosyasının hangi BAŞKA skill'i tetiklediği **`komuta` skill'inde** —
fiş geldiğinde onu çağır.

## Teslim Akışı — PR + merge OTOMATİK, **CI BEKLENMEZ**

Kullanıcı talimatı (2026-07-31): **her güncellemeden sonra PR aç ve merge et.**
Ayrıca sorma, ayrıca onay bekleme.

```bash
npm run build     # MFSim_Code.html üret
npm test          # tüm birim testleri
```

1. `npm run build` + `npm test` **ikisi de yeşil** olmadan commit YOK.
2. UI kabuğuna dokunduysan `npm run test:urun`u yerelde koştur (aşağıda).
3. Commit → `git push -u origin <dal>` → PR aç → **MERGE ET.**
4. Merge'den sonra koşuya bir kez bak. Kırmızıysa ileri doğru düzelt.
5. **ARTIFACT HAZIRLA** — aşağıdaki kural.

### HER DEĞİŞİKLİKTEN SONRA ARTIFACT

Kullanıcı talimatı (2026-09-11): *"Her değişiklik sonrasında bir artifakt
hazırlamanı istiyorum."* Sorma, bekleme — teslimin parçası.

Sebebi bir süs değil bir kanal: kullanıcının ağı **GitHub'a da Pages'e de
çıkamıyor** (bkz. "Güncel programı alayım"), yani PR gövdesini okuyamıyor.
Sohbetteki özet de kaydırmada kayboluyor. Artifact, o turda NE DEĞİŞTİĞİNİN
kalıcı ve paylaşılabilir tek kaydı.

Sayfa **ne yapıldığını değil ne ÖLÇÜLDÜĞÜNÜ** taşır — bu deponun her yerindeki
kural: hüküm + gerekçe + kapı. Asgarî içerik:

| Ne | Nereden |
|----|---------|
| Bulunan her kusur: önce → sonra **sayısı** | turun ölçümleri |
| Düzeltmenin tek satır gerekçesi | commit gövdesi |
| Kapı testi ve **düşebildiğinin kanıtı** | düzeltme geri alınıp koşturularak |
| Değişen dosyalar + satır sayısı | `git show --stat` |
| Hata sanılıp kasıtlı çıkanlar | dokunulmayanlar da bir sonuçtur |

Ölçüm YOKSA artifact da yoktur: "iyileştirdim" diyen ama önce/sonra sayısı
olmayan bir sayfa, bu dosyanın 6.052 satıra çıkmasına yol açan biçim
taklidinin ta kendisidir.

### CI BEKLEMEK YASAK — ölçüldü, sıfır bilgi getiriyor

**Kullanıcı bildirimi (2026-09-07):** *"Ya neden beklediğini de anlamıyorum ki?
10 dakika boyunca CI bekliyorsun abi. Gerçekten kafayı yiyeceğim."* Ve haklı:

CI'daki `test` işi **tam olarak** şunu koşuyor (`.github/workflows/ci-deploy.yml`):

| CI adımı | Yereldeki karşılığı |
|----------|---------------------|
| `npm run build` | `npm run build` |
| `npm run test:ci` | `npm test` |
| `npm run sync:viewer -- --check` | `npm test` → `viewer-sync.test.js` |
| iki dağıtım dosyası tazelik kapısı | `npm test` → `build-freshness.test.js` |

Yani `npm test` yeşilse o iş **kesinlikle** yeşil. Onu beklemek, bilinen bir
sonucu iki buçuk dakika daha beklemektir.

Geriye yalnız `e2e-urun` kalıyor ve o işin koştuğu şey **`npm run test:urun`**:

```bash
npm run test:urun      # ~6–7 dk · MFSIM_CHROMIUM gerekli · spec listesi package.json'da
```

**Spec listesi BURAYA YAZILMAZ** — `package.json` tek kaynak. Elle yazılmış
üç dosyalık liste yedi dosyalık betiğin altında kaldı; `e2e-urun` beş
birleşme boyunca fark edilmeden kırmızıydı ve `deploy` atlandı (#977–#981).

Yerelde koşturmak bir CI turundan hızlı. **Ürün kabuğuna dokunan bir turda
koştur; dokunmayan turda ne koştur ne bekle.**

**Bir sonraki turun İLK işi önceki birleşmenin koşu SONUCUNU okumaktır** —
kuyruktaki bir koşuya "bir kez bakmak" sonucu göstermez.

### VE ASLA `sleep` DÖNGÜSÜYLE BEKLEME

Bir koşunun sonucu gerçekten gerekiyorsa **durumunu sor** (`actions_list` /
`list_workflow_jobs`) — körlemesine uyuma. Ölçülen kaçak: koşu 2 dk 30 sn
sürerken 5–8 dakikalık `sleep` döngüleri kuruldu ve kullanıcı boşuna bekledi.
Bir tur içinde en fazla BİR durum sorgusu; cevap "hâlâ koşuyor" ise iş biter,
sonuç bir sonraki turda görülür.

**Kapı kuralı:** testler kırmızıysa ya da build patlıyorsa merge etme —
durumu kullanıcıya söyle. "Otomatik merge" testleri atlamak demek değil;
**beklemek kısaltılıyor, doğrulama kısaltılmıyor.**

Yeşil testler tek başına "düzeldi" demek değildir: kullanıcının bildirdiği
senaryo birebir yeniden üretilip ESKİ kodda kırıldığı, YENİ kodda geçtiği
ölçülmeden sonuç kesin dille sunulmaz.

## Boşta koşan rutinler — kullanıcı yokken çalışan oturumlar

Dört zamanlanmış rutin (claude.ai → Routines) `main`i çeker, ölçer, **hiçbir
şeyi merge etmez.** Gece oturumunda GitHub araçları YOK: PR açılamaz, dal
itilir; PR'ı ertesi gün bir insan-oturumu açar.

| Rutin | Ne zaman (UTC) | Çıktısı |
|-------|----------------|---------|
| Gece tam E2E | hafta içi 00:00 | rapor + gerekirse `claude/gece-e2e-<tarih>` dalı |
| Boyut nöbeti | her gün 04:17 | `docs/olcum/boyut.csv`'ye satır → `claude/boyut-nobeti` dalı |
| Mutasyon nöbeti | cumartesi 01:23 | yakalanmayan mutantlar + kapı testi → `claude/mutasyon-<modül>-<tarih>` |
| Açık ayrışma işçisi | perşembe 01:07 | `acik-ayrismalar.md`'nin ilk maddesine **yalnız kapı testi** → dal |

Dördünün de uyduğu kurallar:

- **RUTİN PROMPTU ENVANTER İDDİA ETMEZ, ÖLÇER.** Gece E2E rutini "18 spec var"
  yazıyordu; üç gün sonra 21 oldu ve prompt örnek olarak silinmiş bir spec'i
  (`structural-geometry.spec.js`, Yapısal Analiz kaldırıldı) sayıyordu. Prompt
  depoda olmadığı için hiçbir test onu tutamaz — **tek çare sayıyı koşarken
  saymaktır** (`ls tests/e2e/*.spec.js | wc -l`).
- **DEĞİŞMEMİŞ `main`'de KOŞULMAZ.** Ölçüldü: bir gece E2E turu 1 sa 49 dk /
  $15,37. Değişmemiş bir ağaçta bu, bilinen sonucun ikinci kez satın
  alınmasıdır. Rutin ilk iş `git log origin/main --since=...` bakar, boşsa çıkar.
- **Bulgunun kalıcı bir yeri olmalı** — push bildirimi buharlaşır, transkript
  aranmaz. Ya bir dal, ya `docs/olcum/` altındaki defter.
- Modül kapısı rutinler için de geçerli: FEAD/Araç dosyalarına dokunacak bir
  rutin, promptunda **önce skill'i çağırmakla** yükümlüdür.
- Testi atlamak/gevşetmek yok, `main`'e itmek yok, merge yok.
