---
name: fead
description: MFSim FEAD (kayış-kasnak / accessory belt drive) modülünün karar kaydı ve dokunulmazlıkları. js/fead-core.js, js/fead-model.js, js/fead-belts.js, js/fead-duty.js, js/fead-tensioners.js, js/cp-fead.js, js/cp-fead-report.js, js/cp-fead-summary.js, js/cp-fead-wizard.js, js/guide-fead.js, js/fead-step.js, js/step-p21.js, js/step-ucgen.js dosyalarından birine ya da FEAD testlerine (tests/unit/fead-*, cp-fead*, gates-archive, guide-fead, tests/e2e/fead-*) dokunmadan ÖNCE çağır. Çekirdeğin birebir durma kuralı, 2095 referans değerlik doğrulama kapısı, kasnakların kanvasta KUTUSU OLMAMASI (giriş Kayış Yolu çiziminden — Çizim Masası; kesin sayı kartın içindeki Kayış Tablosu'nda — Pafta), gergi tanımı, katalog ve rapor kuralları buradadır.
---

# FEAD modülü — dokunmadan önce

Bu modülün hata sınıfı **sessizdir**: sayı yanlış çıkar, model yine çözülür,
uyarı verilmez. Aşağısı o sınıfa karşı kurulmuş kapılardır.

## Önce şunu bil: gergi tanımı OYNAK bir alan

**Gerginin nasıl tanımlandığı 2026-08-25 → 09-01 arasında DÖRT KEZ yön
değiştirdi** (kasnak merkezi girdi → pivot girdi + zarf → tek koordinat →
avara merkezi girdi + kol açısı girdi). Bu yüzden **bu dosya o alanın kuralını
yeniden yazmaz** — burada yazılı bir özet, bir sonraki dönüşte sessizce yanlış
olurdu.

> Gergi tanımına, kol açısına ya da kayış boyu kipine dokunacaksan
> **`references/cozum-ornekler-ve-ankraj.md`'yi aç ve *"AVARA MERKEZİ GİRDİ,
> MONTAJ KONUMU ÇIKTI"* bölümünü oku.** Ondan sonraki bölümler kendi
> başlıklarında AŞILDI diye işaretlidir ve yalnız ÖLÇÜMLERİ için duruyorlar;
> sırayla oku, atlama. Kodun kendisi (`js/cp-fead.js` gergi kartı,
> `js/fead-model.js`) belgeden daha günceldir — ikisi ayrışıyorsa kod kazanır
> ve kaydı düzeltmek işin parçasıdır.

## Dokunulmazlar

1. **`js/fead-core.js` DIŞARIDAN GELDİ, BİREBİR DURUR.** MFSim stiline
   ÇEVRİLMEZ — `const`/arrow/template literal kullanır, proje `var` kullanır,
   fark bilerek duruyor. Güncellemesi de dışarıdan gelir. Uyarlanacak olan
   çekirdeğin ÇEVRESİDİR (`js/cp-fead.js`), çekirdeğin kendisi değil.
2. **Üç katman.** `fead-core.js` (hesap) → `fead-model.js` (köprü, DOM'suz) →
   `cp-fead.js` (sunum; **kendi geometrisini hesaplamaz**). Yükleme sırası
   `index.html`'de: `fead-model.js` → `fead-core.js` → `cp-fead.js`.
3. **Doğrulama kapısı 17 Gates raporu / 2095 değer**, artı Gates arşivine
   doğrudan bağlı testler. Eşikler `references/uc-katman-ve-cekirdek.md`'de
   yazılı; **kanonik olan `tests/unit/fead-core.test.js`'in kendisidir.**
   Mutlak B10 ömrü kapı DIŞINDA — yalnız belgelenmiş çap penceresinde geçerli.
4. **KASNAKLARIN KANVASTA KUTUSU YOK** (2026-09-09, kullanıcı isteği).
   Kasnaklar MODELDE düğüm olarak durur — panel dağıtımı, geri-al,
   kaydetme/yükleme, şema göçü ve `veFeadSet` hepsi düğüm kimliğinden çalışır —
   ama kanvasa kutu ÇİZİLMEZ (`componentDefs.noCanvasBox` → `veIsCanvasHidden`,
   components.js). Kasnak **Kayış Yolu çiziminde** seçilir, taşınır ve eklenir
   (kural 32); kesin sayı **Kayış Tablosu'nda** (kartın çiziminin altındaki
   Pafta, kural 14). Detay panele
   çizimdeki kasnağa ya da tablodaki ADA tıklanarak gidilir.
   **Kapı ALTI yerde** ve hepsi kutunun varlığını varsayan süpürmeler: DOM
   kuran iki yol (`createNode` · `restoreState`) ve kutu sınırı okuyan dört yol
   (`veBoundaryBox` · `veFitViewToContent` · minimap bbox · SVG/PNG dışa
   aktarma). Biri atlanırsa hata sessizdir: çerçeve boş alanı sarar, "içeriğe
   sığdır" hiçbir şeyin olmadığı yere kaçar.
   **Kanvas ↔ mm köprüsü ve `fead-coordlink` bileşeni bununla birlikte KALKTI**
   (`veFeadPlaceFromCoords`, `veFeadSyncDrag`, `veFeadCanvasToMm`,
   `veFeadMmToCanvas`, `veFeadSyncMmFromCanvas`, `veFeadSyncCanvasFromMm`,
   `veFeadNodeCenter`, `veFeadDragTensioner`, `veFeadCoordLinkOn`). Kapı:
   `cp-fead.test.js` → *"kasnak KUTULARI ve kanvas↔mm köprüsü KALDIRILDI"*.
   **KAYIŞIN DA KUTUSU YOK** (2026-09-26, kullanıcı isteği: *"'kayış
   özellikleri' bileşenini de kaldırmanı istiyorum. Onun yerine kanvas
   üzerindeki kayış tıklanabilir olacak"*). Aynı kalıp: düğüm modelde,
   penceresi çizimdeki kayıştan açılır (`veFeadKayisAc`) — görünmez 12 px'lik
   isabet yolu kasnak halkalarının ALTINDA (sarım yayındaki tık kasnağındır)
   — ya da paftanın künyesinden. Paletten de çıktı, dolayısıyla **her FEAD
   topolojisinde tek kayış VAR**: açılış yüzeyi kurar, eski kayıtta yoksa
   açılışta geri-al tabanına eklenir (`veFeadKayisGaranti`), silinmez
   (`componentDefs.noDelete`). **Örnek kurucusu devraldığı kayışa örneğin
   verisini TAM yazar** — yazmasaydı kayış açılışın boş künyesiyle kalırdı ve
   model başka bir kayışı çözerdi (sessiz). Kapılar: `fead-cizim-masasi.test.js`
   → *"kayış çizimde tıklanır"*, `cp-fead.test.js` → *"açılışın kayışı
   devralınır"* + *"FEAD editörü açılışı"*, `fead-cizim-masasi.spec.js` →
   *"KAYIŞA TIKLA"*.
   **ARAÇLARIN DA KUTUSU YOK** (2026-09-28, kural 38): Çözücü · Rapor ·
   Sihirbaz aynı kalıpla kutusuz, silinmez, tek kopya; eylemleri FEAD araçları
   penceresinde. Tuvalde kutu kuran TEK FEAD tipi Kayış Yolu kartı. Kapı:
   `cp-fead.test.js` → *"kanvasta yalnız Kayış Yolu"*.
5. **BOŞ BİR FEAD TOPOLOJİSİNİ BAŞLANGIÇ SAYFASI KARŞILAR** (2026-09-29,
   kullanıcı kararı — tasarım tuvali "İlk açılış" · B: *"İlk açılış B
   başlangıç sayfası olacak"*). 2026-09-09'dan beri sihirbaz kendiliğinden
   açılıyordu; ölçüldü: ekranın %77'si, ilk karede "7 eksik/çelişkili girdi".
   Sayfa (`js/cp-fead-baslangic.js`) tuvali örter: üç kapı (Sihirbazla kur ·
   STEP'ten başla · Boş çizim masası) + Gates raporlarının kayış yolları.
   • **Görünürlük MODELDEN türer, bayrak yok**: kasnak yok VE Kayış Yolu kartı
     yok → sayfa (`veFeadBaslangicGerekli`). Kapı modeli kurar, sayfa çekilir;
     Ctrl+Z geri alırsa geri gelir. Açılış yüzeyi bu yüzden kart KURMAZ,
     yalnız kutusuz araç düğümleri (`VE_FEAD_ARAC_TIPLERI`).
   • **Kapılar modülün çağrıları**, sayfa düğüm kurmaz: `veFeadWizOpenAny` ·
     1. adımın dosya seçicisi (AYNI tıklamada) · `veFeadKanvasEkle({bos:true})`
     · `veFeadLoadExample`. Küçük resim çiziciden (`veFeadLayoutSVG`), liste
     sihirbazınki (`veFeadExampleKeys`).
   • **Sayfa açıkken FEAD araçları penceresi gizli** (`_feadAracBaslangic`:
     kapsam ve tazeleme tek soru yeri); dönüş düğmesi (z 60) sayfanın üstünde.
   • Kurulum kanvasta boş kart bulursa (Boş çizim masası) onu geometri kartı
     olarak DEVRALIR ve yuvasını alır — devralmasa üç çizim olurdu (ölçüldü).
   • Kasnağı olmayan kartta durum rozeti ÇİZİLMEZ: arıza değil başlangıç.
   "Başlangıç ve Örnekler" (`fead-example`) 2026-09-09'da KALDIRILDI; örnek
   KURUCUSU (`veFeadLoadExample`) duruyor. Kapılar: `fead-baslangic.test.js` +
   `tests/e2e/fead-baslangic.spec.js`, `cp-fead.test.js` → *"FEAD editörü
   açılışı"* · *"Başlangıç ve Örnekler bileşeni kaldırıldı"*,
   `fead-wizard.test.js` → *"BOŞ KAYIŞ YOLU varken"*,
   `fead-sihirbaz-tablo.spec.js`.
6. **"Otomatik Düzenle" yalnız KUTUSU OLAN kartları dizer** — bugün yalnız
   Kayış Yolu kartları (kasnak, kayış ve araçların kutusu yok): tek sıra, yan
   yana; sığdırma FEAD araçları penceresinin sağından başlar (kural 38).
   Sol şeridin kuralı GENEL olarak duruyor (kutulu bir künye gelirse oraya):
   **dikey adım KUTUYU DEĞİL, kutu+ADI sayar** (`veFeadArrangeByCoords` →
   `adPayi`) — ad kutunun ALTINDA duruyor, adım onu saymayınca adın altında
   2 px kalıyor ve komşunun dekorasyonu adın üstüne biniyordu. Ölçü sınır
   çerçevesiyle AYNI kaynaktan (`veMeasureNodeLabel` + `veNodeLabelOverflow`);
   ölçülemezse pay 0 ve davranış birebir eski hâli. Kapı: `cp-fead.test.js` →
   *"ad KUTUNUN ALTINDA duruyor"* (sentetik künye tipiyle) + *"ARAÇ
   DÜĞÜMLERİ DİZİLMEZ"*.
   **YERLEŞİM: kanvaslar YAN YANA** (kullanıcı isteği, 2026-09-14: *"Alt alta
   hiç estetik durmuyor"*) ve kurucuların YEDEK sırası da aynı şekli kurar
   (`veFeadFallbackSlots` — tek kaynak). Yedek yol Node'da
   ölçülemiyor (yerleştirici stub'lanamıyor, koordinatın üstüne yazıyor);
   kapısı `tests/e2e/fead-yerlesim.spec.js`. Ayrıntı:
   `references/kanvas-ve-kart.md` → *"YEDEK SIRA DA AYNI ŞEKLİ KURAR"*.
7. **KASNAKLAR BAĞLANMAZ — SIRA TABLODA** (2026-09-09). Kayış yolu bir graf
   değil bir liste: sıra `node.data.beltIndex` alanında, Kayış Tablosu'nun
   satır sırası. `beltIndex` **Gates TABLO sırasını** taşır (kayışın gidişinin
   TERSİ) ve `build.order`'ın kendisidir — çevirme yok; gidiş sırası isteyen
   `veFeadRouteFlip`'ten geçer. **Sıra SÜRÜCÜDEN başlar** (`veFeadBeltOrder`
   listeyi döndürür): "krank sabit, kalanı ters" kuralı, gergi konumu hükmü ve
   17 Gates raporunun tamamı buna dayanıyor. Kapı: `fead-table.test.js`,
   `fead-model.test.js` → *"kayış sırası — indisten, sürücüden başlayarak"*,
   `fead-wire-order-migration.test.js` (şema 3 → 4).
8. **Sürücülük ROL** (`node.data.driver`), tip değil. **Temas tarafı
   (grooved/back) gerçek alandır** — ters verilirse çekirdek hata VERMEZ,
   geçerli ama başka bir güzergâh çözer. Bu yüzden değer üç yüzeyde birden
   görünür: tip varsayılanı (`componentDefs.feadContact`) → kasnak paneli →
   **Kayış Tablosu'nun "Kasnak Dönüş Yönü" sütunu** (Sağ/Sol açılır listesi,
   `contact` alanını yazar). Kanvas rozeti (K/S) kutularla birlikte kalktı.
   **Çap = DIŞ ÇAP (`od`)**.
9. **Panel, tablo ve kart AYNI alanı okur.** Kol konumu, kayış kipi, yön gülü,
   dönüş yönü — ikinci bir ayar tutmak iki yüzeyin sessizce
   ayrışması demektir.
10. **Geçerlilik sınırı sonucun İÇİNDE taşınır.** Tepe yük `KALİBRE DEĞİL`
   damgasıyla, B10 çap penceresiyle, türetilen boy kökeniyle basılır. Sayı
   gizlenmez; sınırı yanında yazılır.
11. **Tazeleme tek noktadan.** Kanvas kartları ve tablolu kartların
    paftaları HEP BİRLİKTE, `veFeadRefreshCards`'tan; port DOM'u ve kart
    imzası `updateAllConnections`'tan. **Pafta bir kare SONRA tazelenir ve
    odağı anahtarıyla geri verir** — aynı anda kurulsa Sekme ile geçilen
    hücre sökülür, ikinci sayı yazılamazdı (`fead-table.test.js` → *"ODAK
    KORUNUR"*, `fead-tablo.spec.js`). Kart başına ayrı çağrı, altı düzenleme
    yolundan birinde birinin unutulması demek — ve fark sessiz: iki kart kendi
    başına tutarlı görünür, yalnız biri bir düzenleme geride kalır. Kaynak
    kapısı `fead-table.test.js` içinde.
    **GERİ YÜKLEME İMZAYI UNUTUR** (`veFeadTopoInvalidate`, `restoreState`'in
    sonunda): geri yükleme kartı düğümünü kurarken kuruyor ve açılış kartı
    örnekte yeniden kullanıldığı için kasnaklardan ÖNCE geliyor — o an model
    yarım, kart "henüz kasnak yok" basıyor. İmza kapısı imzaya girmeyen bir
    alanın (katman, çözücü alanı) geri alınmasında tazelemeyi atlıyordu.
    Kapı: `geri-al-yolu.test.js` + `fead-cizim-masasi.spec.js` → *"CTRL+Z"*.
    **SEÇİM DEĞİŞİNCE KART KURULMAZ, SINIF EŞİTLENİR** (`veFeadMarkSelectedRow`,
    `cp-core.js`'in `addToSelection`/`clearSelection` merkezlerinden çağrılır):
    kasnakların kutusu olmadığı için `addToSelection`'ın kutuya yazdığı
    `selected` sınıfı onlarda hiçbir şeye yazmıyor; işaret çizimde (`.is-sel` ·
    `.is-hov`, `veFeadCizimIsaretle`) ve tablo satırında. Tam yeniden kurmak
    düzenlenen hücrenin odağını, çizimde fare altındaki öğeyi düşürürdü. Ölçüldü: çağrı
    olmadan işaret hiç tazelenmiyor ve tabloda paneli AÇIK OLMAYAN bir satır
    işaretli kalıyor — işaretin hiç olmamasından kötü.
12. **Negatif kapı (kutu döneminden kalan): `veFeadApplyBadge` kasnak kutusuna
    kesikli çember ÇİZMEZ.** Kasnakların kutusu artık hiç yok, yani rozet de
    çizilmiyor; kapı yine de duruyor çünkü "gerçek çap hayaleti" fikri geri
    gelirse bu kez TABLOYA ya da karta konmak istenir ve gerekçesi aynı.
    Gerçek çap hayaleti kullanıcı isteğiyle kaldırıldı; kapı sınıf adına değil
    biçime de bakıyor (`border-radius:50%` + `dashed`).
13. Oturumluk sonuç globali **`window.veFeadResults` proje değişince
    temizlenmeli** (`_feadForgetResults`) — yoksa yeni projede önceki projenin
    tabloları durur.
14. **KAYIŞ TABLOSU KAYIŞ YOLU KARTININ İÇİNDE — PAFTA** (2026-09-26,
    kullanıcı, tasarım tezgâhı III: *"Pafta çok güzel duruyor"* + *"tablonun
    olduğu kanvas diğerine göre daha geniş olsun"*). Tablo çizimin ALTINDA,
    Gates raporunun *Layout Data* tablosu gibi, ve kanvasla ölçeklenir.
    Gerekçe ölçüldü (AG00810, 1920×952): kasnak ↔ satır mesafesi çekmecede
    659–785 px, paftada 302–405 px; tuvalden hiçbir şey alınmıyor (çekmece
    266 px alıyordu). Kanvas BİLEŞENİ DEĞİL, kartın KATMANI — tip, palet,
    panel yok (şema 6 → 7 göçü `veFeadMigrateTableOff` duruyor). Emekli iki
    yön (kart listesi · çekmece) ölçümleriyle `references/emekli-yonler.md`'de.
    Kapılar: `fead-table.test.js` → *"PAFTA — tablo kartın katmanı"*,
    `fead-tablo.spec.js` → *"PAFTA"*.
    - **AÇIKLIK ÖN AYARIN ALANI** (`tablo`: geometri 1 · işletme 0 — kanvasın
      tek tipi kuralı). Düğme kartın alanını yazar; ön ayarın söylediğine dönen değer
      alanı SİLER; ön ayar uygulamak alanı temizler. Görünüm durumu değil
      model: kaydedilir, geri alınır.
    - **KART ÖLÇÜSÜ TABLOYU İZLER**: tablolu kart `VE_FEAD_PAFTA_W` (640),
      tablosuz 440 — yalnız VARSAYILAN ölçüdeki kart (kullanıcının ölçüsüne
      dokunulmaz); aynı satırda sağdaki kartlar fark kadar kayar. 640'ta
      KASNAK sütunu 194 px. Eski kayıt şema 7 → 8 göçüyle büyür
      (`veFeadMigratePafta`); göç DOM'a dokunmaz — alt topolojinin
      kimlikleri ana tuvaldekilerle çakışabiliyor.
    - **PAFTA KALICI KAP, ÇİZİM DEĞİŞİR**: kart her model değişiminde
      kuruluyor ama `replaceChild` yalnız çizim kabuğunu değiştirir; pafta
      bir kare sonra ODAĞI (anahtar + seçim) ve YAZILMAMIŞ METNİ koruyarak
      tazelenir (`_feadPaftaCiz`, kural 11). `innerHTML` kartın tamamına
      yazılsaydı Sekme ile geçilen hücre sökülürdü.
    - **BOY TEK KAYNAK**: `veFeadPaftaH` (satırlardan; tavan kartın %55'i,
      taban iki satır) → kartın `--fead-paf-h`i. Çizim, katman paneli ve
      titreşim şeridi oradan hizalanır; çubuk tablonun ALTINDA
      (`--fead-yuz-ust`). `VE_FEAD_PF` sabitleri CSS'le birebir — ayrışma
      çizimi tablonun altına sokar ya da boşluk bırakır, sessizce
      (*"ÖLÇÜ SABİTLERİ CSS'le BİREBİR"*, `fead-kanvas.spec.js`).
    - **SÜTUN BÜTÇESİ KARTIN KENARLIĞINI DA SAYAR**: KASNAK = W − 2·(dolgu +
      kenar) − sabit sütunlar. Kenarlık sayılmayınca tarayıcıda 2 px yatay
      kaydırma çıkıyordu.
    - **SATIR ↔ KASNAK GÖBEKTEKİ NUMARAYLA**: tablo açıkken çizimdeki her
      kasnağın göbeğinde satır numarası (sürücü dolu, gergi yeşil çerçeve);
      eşleme ad okumadan kurulur.
    - **GİRDİ/ÇÖZÜM AYRIMI SÜTUNDA**: türetilen sütunlar (`cz`) oyuk zeminde
      (`--bg-tertiary`, panelin salt okunur alanıyla aynı —
      `fead-panel-gramer.spec.js`), ilkinin solunda ayraç. Sütunlar bölgeye
      göre dizilir (kim · gir · coz · son), defterin sırası bölge İÇİNDE
      korunur; bir sütunun `yer`i `coz` bayrağıyla tutarlı olmak zorunda
      (kural olarak kapılı). ZEBRA YOK.
    - **KAYIŞ BOYU VE Σsarım TABLODA DEĞİL, KARTIN ROZETİNDE** (sağ üst):
      ikisi de satıra değil çevrime ait; tablo tekrarlamaz
      (`fead-spin-flip.test.js`).
    - **BAŞLIKTA KAYIŞ KÜNYESİ BİR DÜĞME + KİP ANAHTARI** (2026-09-26): künye
      Kayış Özellikleri penceresini açar (kayışın kutusu yok, kural 4);
      yanındaki SERBEST/SABİT anahtarı eski kayış kutusunun rozeti
      (`veFeadKipDugmeHTML`). Kilitliyken `aria-disabled`, `disabled` DEĞİL —
      devre dışı düğme ipucunu göstermiyor, kullanıcı nedenini okuyamazdı.
    - **YÖN BİR METİN DÜĞMESİ** (simge + Sağ/Sol, tık çevirir) — seçilen
      tasarımın hücresi. Seçenek sayısı ikiden çıkarsa geri alınır. Gerginin
      ✕'i pasif (gergi tekil).
    - **PAFTA KANVASIN FARESİNİ YUTAR** (`mousedown` · `dblclick`): hücreye
      basmak kartı sürüklemez, metin seçilebilir.
    Kart listesi ve çekmece döneminden PAFTADA DA GEÇERLİ olanlar:
    **GÖRÜNÜM CSS'TE** (`.ve-fead-pf*` / `.ve-fead-tbl*`), satır içi `style=`
    dizelerinde DEĞİL — satır içi CSS DURUM İFADE EDEMEZ (`:hover`,
    `:focus`). Satır içinde kalan tek şey VERİ (`<colgroup>` genişlikleri,
    `--fead-paf-h`); vurgular `--accent-tint-*` / `--focus-ring`
    jetonlarından. Kapı ÇİFT: *"satır içi RENK … yazmıyor"* + *"DURUM
    KURALLARI CSS'te"*; tarayıcıda `fead-tablo.spec.js` → *"PAFTA CANLI"*.
    **AD HÜCRESİ BİR BAĞLANTI ve paneli AÇAR** (`veFeadTableOpen` →
    `veTogglePropertiesPanel(true)`; `addToSelection` yalnız içeriği
    doldurur, modal kapalı kalırdı). DÜĞME dinlenmede DOLU, ALAN dinlenmede
    BOŞ — kutulu ad hücresi 2026-09-10'da ölçüldü ve geri alındı (metin alanı
    gibi okunuyordu). Kapı: *"ad hücresi paneli AÇIYOR"*.
    **EKLENEN SATIR GÖRÜŞ ALANINA ALINIR** (`_feadScrollRowIntoView`,
    tazelemeden SONRA, `block:'nearest'`). Kapı: *"eklenen satır görünür
    kılınıyor"* + `fead-tablo.spec.js`.
    **ÇOK DÜĞÜM KURAN HER KURUCU `veStateBatch` İLE SARILIR** —
    `veFeadLoadExample`, `veFeadWizCreate`, `veFeadPopulateStarter`; açılış
    yüzeyi yığının TABANI (`veStateResetBaseline`). Sarılmazsa Ctrl+Z modeli
    düğüm düğüm söker. Kapılar: `cp-fead.test.js` / `fead-wizard.test.js` +
    `fead-tablo.spec.js` → *"CTRL+Z"*; mekanizma `state.test.js`'te, kuralı
    kökteki `CLAUDE.md`'de.
15. **KART NE ÇİZECEĞİNE KENDİ KARAR VERİR** (`VE_FEAD_KATMANLAR` ·
    `node.data.kat`). Çizicinin katmanları zaten vardı; eksik olan seçimin
    SAHİBİYDİ — bayraklar kart kurucusunda sabitti, yani ikinci bir kart
    açmak aynı resmi ikinci kez çizmekti. Seçim artık düğümün alanında ve
    kart başına ayrı; iki kanvas yan yana farklı katmanlarla durabilir
    (`maxInstances` bu yüzden kalktı).
    **LİSTE TEK KAYNAK**: kutucuk, varsayılan ve çiziciye giden seçenek adı
    aynı satırdan gelir — ikinci bir liste, panelde görünüp çizimde hiçbir şey
    yapmayan bir katman demekti ve bu SESSİZ olurdu.
    **EKSİK ANAHTAR VARSAYILANA DÜŞER**, kapalıya değil: eski kayıtta `kat`
    hiç yok ve o kart bugünkü görünümünü aynen korumalı. "Varsayılan" işlemi
    de alanı SİLER, sıfırla doldurmaz (dolduran hâl bugünün varsayılanını
    dondurup yarınkini kaçırırdı).
    **PANELİN AÇIK OLMASI MODELDE DEĞİL** (`VE_FEAD_KAT_ACIK`): görünüm
    durumu kaydedilmez ve geri-al yığınına yazılmaz — ama kart her değişimde
    yeniden kurulduğu için bir yerde durmak ZORUNDA, yoksa ilk tıklamada
    panel kapanır ve ikinci kutucuk işaretlenemez.
    **KOL KONUMU KART BAŞINA** (`veFeadPosMode(node)`). Bir dönem çalışma
    kartı bunu geometri kartından devralıyordu (`veFeadPosModeShared`, artık
    YOK): tek kart varken doğruydu, ikinci kanvas ise kendi seçicisini yazıp
    BİRİNCİ kartın konumunu çiziyordu.
    Görünüm CSS'te (`css/styles.css` → `.ve-fead-kat*`), kural 14'ün aynı
    gerekçesiyle. Kapılar: `tests/unit/fead-katman.test.js` +
    `tests/e2e/fead-katman.spec.js`.
16. **Uygunluk kapıları TEK ÇAĞRIDAN** (`js/fead-checks.js` · `veFeadChecks`):
    panel canlı hesaplar, rapor ise çözüm anında yazılan `R.checks`'i OKUR —
    yeniden hesaplasaydı çözümden sonra değiştirilen bir devir sınırı belgeye
    sızardı. Üç kural: merkez mesafesi kuralı **iki kasnaklı** V-kayış
    tahriklerinden geldiği için ihlali `'warn'` (tasarımı reddetmez, payı
    yazılır); çevrim oranı **pitch çapından** gelir (defterin dış çaplı ve elle
    yazılmış oranları %2,2 ve %27,8 sapıyor); eksik veri `'wait'`'tir ve
    **uygun sayılmaz**. Kapı: `tests/unit/fead-checks.test.js`.
    **Pencerelerin sağ sütunu ÜÇÜNCÜ yüzeydir** ve çözücüyü modelin kendisinden
    alır (`build.solver`): global taramayla argümansız aranınca hiç bulunmuyor,
    kapılar boş çevrimle soruluyordu — çözücü "uygun" derken sütun
    "değerlendirilemedi" diyordu. Kaynak metnine bakan kapı bunu göremezdi;
    kapı CEVABIN aynılığını ölçer (aynı dosya, *"sağ sütunu çözücü kartıyla
    AYNI hükmü"*).
17. **Katalog bir KISIT değil bir ÖNERİ** — kayış, gergi, motor ve aksesuar
    kütüphanelerinin dördünde de aynı kural. Elle girilen değer katalogtan
    üstündür; "elle" demek için değerin katalogtan FARKLI olması gerekir
    (yalnız "dolu mu" bakan bir tespit, katalogun kendi yazdığı alanları
    kullanıcıya mal ediyordu). Kapı: `tests/unit/fead-catalogs.test.js`.
    **Sapma ÜÇÜNDE DE raporlanır**: motor `veFeadEngineDrift`, aksesuar
    `veFeadAccLimits(...).kaynak`, gergi `veFeadTensionerDrift`. Üçüncüsü
    2026-09-14'e kadar YOKTU — künye seçip kol boyunu değiştiren kullanıcıya
    panel hâlâ künyenin adını yazıyordu. Gergide parça (kol · ön yük ·
    katsayı · çap · temas) ile montaj (çalışma momenti) AYRI raporlanır;
    momenti sapma saymak doğru kurulmuş her modeli uyarırdı.
18. **KATALOG ÇAPI DIŞ ÇAPTIR (`od`), PITCH DEĞİL.** Gates raporu kasnak
    çapını iki sütunda basar — `Flat` (dış) ve `Pitch` — ve sırttan temas eden
    kasnakta aralarında tam `2·h_r` vardır (PK/GATES: 2,20 mm). Gergi
    kütüphanesinin `od` alanı **on dört kaydın on dördünde de PITCH sütununu
    taşıyordu**; künyeyi uygulayan her model gergi kasnağını 2,20 mm büyük
    kurup kayış boyunu 0,67 mm kaydırıyordu (AG00976: 1715,28 ≠ 1714,61).
    Sessizdi — çevrim kapanıyor, çözüm çıkıyor. Kütüphanenin beş alanı arşive
    bağlıydı, `od` bağlı DEĞİLDİ; fixture kıyası da `od`'yi fixture'ın PITCH
    alanıyla eşitleyerek hatayı KORUYORDU. Kapı üç açıdan:
    `gates-archive.test.js` (Flat sütunu + `od+2·h_r` Pitch sütununda),
    `fead-tensioners.test.js` (fixture ilişkisi açıkça yazılı + çekirdeğin
    ürettiği pitch).

18. **KANVASIN TEK TİPİ VAR** (`fead-layout`); geometri ↔ işletme ayrımı bir
    ÖN AYARDIR (`node.data.katOn`), tip değil. `fead-run` diye bir bileşen
    yok. Açılışta yine İKİ kanvas gelir (örnek · sihirbaz · göç) ve ayrım
    kullanıcının **değiştirebildiği** şeydir — kural 15 geldikten sonra ikinci
    bir TİP aynı işi ikinci kez yapıyordu.
    Ön ayar **adıyla** taşınır (kopyasıyla değil) ve **devri de belirler**:
    geometri `devir:'off'` — donukluk eskiden tipin içindeydi, taşınmasaydı
    açılıştaki iki kanvas da animasyonlu gelirdi. Yazılmış bir alan ön ayarı
    susturur; ön ayar yalnız SÖZ SÖYLEDİĞİ alanı temizler.
    Sihirbazın araç eşleşmesi **tip + ön ayara** bakar (`_fwAracAnahtar`):
    yalnız tipe bakan bir eşleşme ya her kurulumda fazladan kanvas kurar ya da
    `nodes` sırası ters olduğunda geometri kartının üstüne işletme ön ayarını
    yazar — ikisi de sessiz. Kayıtlı `fead-run` düğümleri şema 5 → 6 göçüyle
    çevrilir (`veFeadMigrateRunToLayout`); çevrilmeseydi tanımsız tipli bir
    düğüm olarak kalırlardı. Ayrıntı ve kapı listesi
    `references/kanvas-ve-kart.md` → *"İKİ KANVAS, TEK TİP"*.
19. **ÖRNEĞE SAYI YAZMAK İÇİN KAYNAĞIN ONU SÖYLEMESİ GEREKİR — söylüyorsa
    GELİR.** Aksesuar devir sınırları on iki örneğin sekizine yazıldı, hepsi
    raporun KENDİ bileşen dosyasından (`SD7H15-AC.cmp` · `AG810-250Amp-ALT.cmp`
    · `TM31.cmp` · `Valeo - TM21 - 7_9kW_A_C.cmp`); kalanlarda rapor modeli
    söylemiyor (`A_C.cmp`) ya da model katalogda yok (`220Amp`, `TM32`) ve
    **sınır yazılmadı**. Kapı İKİ YÖNLÜ: yazılan sınır kataloğun o model için
    söylediği sayı olmak zorunda, VE adı kataloğa çözülüp sınırı taşımayan
    aksesuar da kırmızı (AG00902'nin TM21'i böyle kaçmıştı — hücre beş ayrı
    çizim çağrısıydı, satır okuyucu yalnız `7_9kW_A_C.cmp`'yi görüyordu).
    Adın parantezindeki model örneğin KENDİ PDF'inde yazılı olmak zorunda
    (uydurulamaz). Ad kataloğun yazımını kullanır ("Sanden 7H15", raporun
    `SD7H15`'i değil) — bağ gizli bir eşleme tablosu olmadan makineyle
    denetlenebiliyor. **Ad çizime sığmalı**: AG00902'de "Klima (TM21)" — daha
    uzun her yazım küçük kartta kol konumu künyesinin üstüne düşüyordu;
    yerleştiriciye "sığmayan ad kısalsın" eklemek REDDEDİLDİ (tam adlar
    kipindeki karelerin %45'inde kullanıcının "Adı kısalt"ı kapatma kararını
    eziyordu). `accLib` YAZILMAZ: künye uygulamak raporun ölçülmüş kW eğrisini
    ezer, ve rapor model söyler, BMC parça numarası söylemez.
    **GERGİ KÜNYESİ ÖRNEKLE GELİR** (`tenLib` · `tenLibVer` · `tenPart`, on bir
    Gates örneği): bağ bir seçim değil — on dört künyeden TAM OLARAK BİRİ
    sıfır sapma veriyor (`veFeadTensionerDrift`, parça + montaj) ve o, örneğin
    kendi raporunun künyesi. Bağ olmadan sihirbaz künyeyi "elle gir" gösteriyor
    ve pim satırı on iki örneğin on ikisinde "parça kodu yok" diyordu. BMC
    tedarikçi sayfası bağ TAŞIMAZ (künyenin kaynağı değil). Kapı:
    `fead-ornek-kunye.test.js`.
    **Motorun governed devri HİÇBİR örneğe yazılmaz** — arşivdeki on bir
    raporun hiçbirinde yok ve BMC sayfasının krank çapı (197,32) motor
    kataloğunda tam eşleşmiyor; en yakın dört kayıt governed'da ayrışıyor
    (2100 · 2200). Çevrim oranı kapısının "değerlendirilemedi" demesi bu
    yüzden DOĞRU davranıştır. Kapı: `fead-example.test.js`.
20. **SİHİRBAZ TOHUMU ALAN ALAN KOPYALAR — yeni alan İKİ YÖNE de eklenir.**
    `veFeadWizNodes` (durum → düğüm) devir sınırlarını taşıyordu,
    `veFeadWizSeed` (örnek → durum) taşımıyordu; örnekteki sınır kullanıcının
    gördüğü yolda (sihirbazın 1. adımı) sessizce düşüyor ve kurulan modelde
    uygunluk kapısı "değerlendirilemedi" diyordu. Kapı GİDİŞ-DÖNÜŞ ölçer, tek
    yön değil: `fead-wizard-catalog.test.js` → *"TOHUM → DÜĞÜM gidiş-dönüş"*.
21. **ŞEMADA HEM AD HEM SARIM AÇISI TAŞINIR.** Ad üstü, açı altı tercih eder
    (sıralar TERS — aynı olsaydı ikisi aynı yere koşar ve kaçınma hiçbir şey
    çözmezdi); adlar önce yerleşir ve açı için sert engel olur. Hiçbir aday
    temiz değilken geri düşüş **en az örtüşen** adaydır, ilk aday değil:
    boole ölçüt 3 px payla sıyıran adayı yazıyı tamamen örtenle eşit sayıyordu.
    Ölçüldü (420 çizim): çivili açı 117 çakışma → kendi aday listesi 60 → alan
    ölçütlü geri düşüş **0**. Kapı: `fead-card-design.test.js` →
    *"sarım açısı da KAÇAR"*.
    **Kanvas kartının yazısı arayüz ölçeğinden** (2026-09-25): kart çizimi
    kartın 1/k ölçüsünde üretilir, viewBox büyütür (`veFeadYaziK` =
    `--fs-micro` / 9). Etiket boyları ve yerleştirme ofsetleri kullanıcı
    biriminde kalır — DEĞİŞTİRİLMEZ; süpürme o ölçüyü de tarıyor (396×412).
    Rapor, küçük resim ve sihirbaz önizlemesi zaten büyütülerek gösteriliyor,
    onlara uygulanmaz. Kapı: `fead-cizim-masasi.test.js` → *"YAZI KATSAYISI"*.
    **Yüzen çubuğun bandı (`altPay`) ad ve açı için SERT engel; alt not ile
    gerilme ölçeği bandın ÜSTÜNDE çizilir** ve onlar da engel — gülün kuralı
    yazılara da uygulandı (ölçülmüştü: 68 yazı çubuğun altında, görünmüyordu).
    Pay yalnız kartta; rapor ve küçük resim değişmez. Kapı:
    `fead-card-design.test.js` → *"yüzen çubuğun altında yazı yok"*.
22. **AÇILIŞ KADRAJI: büyük kartlar SÜTUN DEĞİL, tek sıra** — iki kanvas yan
    yana (`veFeadArrangeByCoords` → `sira`). Üst üste dizilen büyük kartlar
    dar-uzun bir blok üretiyor ve geniş görüşe sığdırma yükseklikten
    sınırlanıyordu (ölçüldü: açılış zoom'u 0,473, görüşün %29,9'u). İki
    kanvas aynı modelin iki resmi; yan yana karşılaştırılıyor. Kapı:
    `cp-fead.test.js` → *"BÜYÜK kartlar"*.
23. **HER FEAD PANELİ AYNI KİMLİK SATIRINI ALIR.** Kasnaklar ve Çözücü
    `VE_WIDE_PANEL_TYPES`'ta DEĞİLDİ ve eksiklik bir karar değil bir atlamaydı:
    ikisi varsayılan (ortalı-simge) kimliğe düşüyor, gergi ve kayış kompakt-sol
    satıra — aynı modülün panelleri iki ayrı pencere gibi açılıyordu (başlık
    92 px ↔ 44 px, gerçek tarayıcıda ölçüldü).
    Panel kozmetiğinde iki kural daha, ikisi de ölçülmüş kusura karşı:
    **açıklama satırının ölçü sınırı var** (`.ve-fead-not`, 68ch — sınırsızken
    satırlar 207 karaktere çıkıyordu) ve **açılır liste sabit piksel değil**
    (`_FEAD_SEL`: taban + `auto` + tavan — sabit genişlik üç seçeneğin metnini
    kırpıyordu, en uzunu 169 px gerek / 120 px alan). Kapı:
    `source-hygiene.test.js` → *"FEAD panel kozmetiği"*.

24. **BİR GİRDİ İKİ YÜZEYDE SORULUYORSA LİSTESİ TEK KAYNAKTAN GELİR.** FEAD
    tahrik düzeni sihirbazda ve Çözücü panelinde ayrı ayrı yazılıydı: sihirbaz
    `crankDirect` kuruyor, panelin listesinde o değer HİÇ YOK, hiçbir seçenek
    `selected` almıyor, tarayıcı ilk seçeneği gösteriyor ve listeye dokunmak
    modeli sessizce `derive`a çeviriyordu. Liste artık `VE_FEAD_DRIVE_MODES`
    (fead-model.js). **Elle oran (`direct`) hiçbir yüzeyde ÜRETİLEMEZ**
    (kullanıcı kararı 2026-09-01; §2.3'ün en ciddi bulgusu) ama köprü onu
    okumaya devam eder — arşivdeki 12 Gates örneği öyle yazılı — ve panel
    seçeneği yalnız düğüm onu TAŞIYORSA basar. Kapı: `fead-defaults.test.js`
    → *"panelin listesi SİHİRBAZIN listesiyle birebir aynı"*, *"her düzen
    panelde SEÇİLİ geliyor"*, *"eski `direct` kaydı"*.

25. **SORULAN HER ALANIN BİR TÜKETİCİSİ OLMAK ZORUNDA.** `noLoadGovernedRpm`
    iki yüzeyde soruluyordu ve değerini okuyan hiçbir hesap, uygunluk kapısı
    ya da rapor satırı yoktu; katalogda duruyor, künye onu modele yazmaya
    devam ediyor, ama SORULMUYOR. Aynı kuralın tersi de geçerli: bir notun
    canlı bir alanı "hesaba katmaz" diye ilan etmesi de yasak — krank ataleti
    burulma modelini, ivme/yavaşlama tepe yük tablosunu besliyor. Sürücünün
    devir sınırları ve güç eğrisi bu yüzden 2026-09-28'de "kullanılmaz"
    olmaktan çıktı: motorun sınırları ve tam yük eğrisi (kural 42). Kapı:
    `cp-fead.test.js` → *"NO LOAD GOVERNED sorulmuyor"* + *"alanları ölü İLAN
    ETMİYOR"*, `fead-wizard.test.js` → *"no load governed SORULMUYOR"*.
    Tarama: panelin sorduğu 53 alandan tüketicisi olmayan tek alan buydu.

26. **KALDIRILAN BİR YAPININ DİLİ DE KALDIRILIR.** Tel dönemi 2026-09-09'da
    bitti (kasnaklar bağlanmaz, sıra `beltIndex`); Dönüş Yönü paneli ve
    toast'ı "kablolama sırası · tel from → to · bağlantıları ters çevirir ·
    kanvastaki gidiş okları" demeye devam ediyordu ve FEAD modül paneli
    yapısal olarak hep 0 olan bir "Bağlantı" satırı basıyordu (on iki tipin
    on ikisinde de `inputs:0, outputs:0`). Kasnak K/S rozeti de aynı sınıftan:
    kutu kalkınca `getElementById` hep null döndü, kod erişilemez hâlde kaldı.
    Kapı: `cp-fead.test.js` → *"BAĞLANTI satırı yok"* + *"HİÇBİRİNDE port
    yok"* + *"KASNAK rozet almaz"*. Araç kutuları (2026-09-28, kural 38):
    toast'lar, pencere metinleri ve kılavuz "Çözücü → ▶ Hesapla" / "kutusuna
    çift tıklayın" / "Dönüş Yönü kartı" demeye devam ediyordu — kapı
    `fead-araclar.test.js` → *"kaldırılan kutuların DİLİ"*.

27. **ÇEKİRDEĞİN KUSURU KÖPRÜDE KAPATILIR — VE BÜTÜN ÇAĞRI YERLERİNDE.**
    `peakEstimate` atalet adımına `driveRatio`yu İKİ KEZ uyguluyor (`alpha`da
    bir, `speedRatio`da bir); düzeltme ataletleri `1/driveRatio` ile
    ölçeklemek ve sözlüğü BÜTÜN kasnaklar için doldurmaktır
    (`veFeadPeakInertias`). Krank kendi ataletini değil çevrimi kapatan
    eşdeğeri taşır — kayış krank kasnağını hızlandırmaz. Geçici rejim aynı
    sözlüğü okur (`veFeadScnInertias` ona delege eder); iki sözlük tutmak,
    senaryonun gerginlik-ivme eğiminin özet tablosundan sessizce ayrışması
    demekti. Kalibrasyon takımı bu sınıfı göremez: **arşivdeki Gates
    örneklerinin tamamı `driveRatio = 1`.** Kapı:
    `fead-denetim-bulgular.test.js` → *"bulgu 1"*, `cp-fead-summary.test.js`.

28. **ZİNCİR ETKİN GERGİNLİK TAŞIR; AÇIKLIK FREKANSI GERÇEĞİNİ İSTER.**
    Kasnak yüzey kuvveti hareketli kayışta `N = T − m′v²`, dolayısıyla
    çekirdeğin `T = M/(dL/dθ)` zinciri etkin gerginliktir ve hubload · kapstan
    oranı · güç akışı onunla TUTARLIDIR — dokunulmaz. Enine dalga denklemi
    ise `c² = T/m′ + v²` ister: köprü farkı `veFeadSpanFreqRows`ta kapatır,
    `TN` zincirin sayısı kalır, merkezkaç payı `TcN` ile ayrı taşınır. Gevşek
    açıklığa (T ≤ 0) pay EKLENMEZ, yoksa negatif gerginlik uyarısı gizlenirdi.
    **Bu düzeltme türetilmiştir, tedarikçiye kalibre DEĞİLDİR**: 11 Gates
    raporunun hiçbirinde açıklık frekansı sayı olarak yok (grafik basılıyor).
    Bir Gates açıklık frekans tablosu geldiğinde sınanacak ilk yer burasıdır.
    Kapı: `fead-denetim-bulgular.test.js` → *"bulgu 2"*, `fead-vibration.test.js`.

29. **RİJİT CİSİM MODU SABİT SAYIYLA AYIKLANAMAZ.** Frekansı analitik olarak
    tam sıfır ama Jacobi artığı matris normuyla büyüyor ve çekirdeğin sabit
    `1e-6 Hz` eşiğini aşabiliyor; aştığında `firstElasticHz` ~0 Hz döner.
    Eşik `veFeadTorsionalNorm` içinde GÖRELİ (en büyük modun 10⁻⁶ katı) ve
    **burulma modelinin ÜÇ çağrı yeri de** oradan geçer — panel/rapor, mod
    listesi ve mod animasyonu. Üçüncüsü atlanırsa kullanıcının mod listesinin
    başına rijit mod düşer ve "1. mod" animasyonu titreşim değil topyekûn
    dönüş gösterir. Sayım sonuçta taşınır (ikinci bir sıfır özdeğer sessizce
    elastik yapılmaz). Kapı: `fead-denetim-bulgular.test.js` → *"bulgu 3"*.

30. **ÇEKİRDEKTE TUZAK, KÖPRÜDE KAPI OLAN ÜÇ ŞEY KAPISIZ BIRAKILMAZ.**
    Sayı olarak geçilen `mu` (`analyze` `opt.muGrooved` arar), aynı adlı iki
    kasnağın yüklerinin birleşmesi (`veFeadUniqueNames` tekilleştirir) ve duty
    kapsamının %100'den sapması (rapor hüküm verir, çekirdek uyarmaz) —
    üçü de bugün kapalı, ama kapatan şey bir sonraki düzenlemede sessizce
    kalkabilir. Yorulma defterindeki **açık ayrışma** da kaydedilir, KAPATILMAZ:
    `ribTensionExp = 1.13` (kontrollü kaburga deneyi) kullanılmıyor, mutlak
    ömür `absolute.tensionExp = 0.96` koşuyor; değiştirmek kalibrasyon sabiti
    C'yi yeniden uydurmayı gerektirir. Kapı: `fead-denetim-bulgular.test.js`
    → *"bulgu 4·5·6"*.

31. **HER FEAD PENCERESİ KRANK KASNAĞI AİLESİNDE — DAR KAPTA DA** (2026-09-23,
    kullanıcı isteği: *"kategori kategori pencereler"*). Kabuk TEK üreticiden
    (`veFeadPanelShell`: kategori sekmeleri · sağ sütun). **Tepede özet şeridi
    YOK** (kullanıcı kararı, aynı gün: *"tepede böyle özet bir açıklamaya gerek
    yok"* — çipleri pencerenin kendisinde zaten yazılı olanı tekrar ediyordu);
    Kayış Yolu (Şema · Geometri), Rapor
    (Tür · Künye), Sihirbaz (Taslak · Adımlar) ve
    kökteki modül kartı (İçerik · Model) da bu kabukta (Dönüş Yönü penceresi
    2026-09-28'de kalktı — FEAD araçları penceresinin Yön bölümü, kural 38). Pencerenin tek EYLEMİ
    sağ sütunda. **Modül kartı modelini ALT TOPOLOJİDEN kurar** — kökte
    `veFeadBuildFromCanvas` boş modeli çözerdi. "Her pencere" bir LİSTE değil
    KURAL olarak kapılı: `tests/unit/fead-pencere-ailesi.test.js` tipleri
    `componentDefs`ten, kurucuyu `cp-core.js`'in dağıtımından okur. **Tek sütuna geçişi PANELİN genişliği
    söyler** (`@container vepanel`, ≤ 640 px) — ekran sorgusu 380 px'lik
    müfettiş sütununda hiç tetiklenmiyordu ve düzenlenen sütuna 42 px
    kalıyordu. Dar kapta sekmeler üste, pencerenin EYLEMİ (`.ve-fp-solve`:
    Hesapla · Raporu Oluştur) kaydırma alanının dibine yapışır. Kapı:
    `tests/e2e/mufettis-sigma.spec.js` (okunurluk: düzenlenen sütun · girdi ·
    etiket · başlık · yatay kaydırma, her sekme gezilerek) + `cp-fead-report.test.js`.
    **Veri tablosu (çevrim · güç eğrisi) bir BİRİMDİR** (`data-ve-tablo`,
    tablo + kendi düğmeleri): sütuna sığmazsa yerinde özet kartı kalır ve
    "Tabloyu aç" onu küçük bir pencereye TAŞIR (`js/tablo-pencere.js`) —
    sütunda yatay kaydırma YOK (2026-09-23; önce 785–1162 / 359 px).
    **"Kayış yolundaki yeri" küçük resmi YOK** — önce kasnak penceresine
    indirildi (2026-09-23), sonra oradan da kalktı (2026-09-28, kullanıcı:
    *"Bunlara gerek yok"*); kasnağın yeri Kayış Yolu kartında ve paftada.
    Kapılar: `fead-panel-dili.test.js` → *"PENCERE DÜZENİ"* ve *"BİRİMİNDE"*,
    `fead-panel-gramer.spec.js`, `tablo-pencere.spec.js`; özet şeridinin ve
    küçük resmin YOKLUĞU `fead-pencere-ailesi.test.js`te, tipten okunan kural
    olarak.

32. **KASNAK ÇİZİMDE SEÇİLİR, TAŞINIR VE EKLENİR** (2026-09-23, kullanıcı
    kararı: *"Çizim Masası çok güzel"*). Kayış Yolu kartının çizimi giriş
    yüzeyi: tıklamak kasnağın penceresini açar, sürüklemek KONUM GİRDİSİNİ
    yazar (gergide avara merkezi `cenX/cenY` — montaj konumu ondan türer),
    ok 1 mm / Shift 10 mm, Delete siler; paftanın "＋ Kasnak ekle" listesinden
    kayışın ÜSTÜNE sürüklenen kasnak iki komşunun ARASINA girer (kural 41 —
    FEAD'de sütun yok). Kurallar:
    • **Çizim kendi geometrisini hesaplamaz** — ters köprü çizicinin bastığı
      `data-fead-xf`ten; sürükleme boyunca ölçek DONAR (kasnak imleçten
      kaçmasın).
    • **Kayışı koparan hamle yazılmaz** (`veFeadYolDurumu`: çözüm + Σ işaretli
      sarım 360 + kayış hiçbir kasnağın içinden geçmez); sebebi durum
      şeridinde. Model başta bozuksa hamle serbest (onaran kilitlenmesin).
      Açıklığa ekleme adayı KOPYADA çözülür — canlı model reddedilen adayla
      hiç oynamaz.
    • **Gergi ↔ sürücü açıklığı kapalı** (tablo sürücüyle başlar, gergiyle
      biter); avara bırakıldığı taraftan değer — halkanın içinde kaburgalı,
      dışında sırt; iç/dış halkanın YÖNÜNDEN (arşivin on iki örneğinin on
      ikisi aynı yönde dolanıyor — aynalanmış düzen ayrıca kapılı). Çap
      yazılmaz: model eksik çapı tipe göre varsayar ve UYARIR.
    • **Bir hamle = bir geri-al adımı** (sürükleme bırakınca, ekleme
      `veStateBatch` içinde — tablonun ekleyicisi de).
    • **Ok tuşu ızgaraya yuvarlamaz** (sürükleme 0,1 mm ızgarada): ölçüldü,
      yuvarlayan hâl gerginin −161,97'sini tek basışta −163,0 yapıyordu.
    • **Etkileşim katmanı yalnız kartta ve görünmez sunum niteliğiyle**
      (`fill="transparent"` · `fill="none" opacity="0"`) — kılavuz kartı
      CSS'siz gömüyor, nitelik olmasa her kasnağın arkasına siyah disk
      çizilirdi (kılavuzun sahne kapısı yakaladı).
    Kapılar: `tests/unit/fead-cizim-masasi.test.js` +
    `tests/e2e/fead-cizim-masasi.spec.js`.

33. **SONUÇLAR SAYFASINDA FEAD SEKMESİ — PANO OKUR, HESAPLAMAZ** (2026-09-24,
    kullanıcı isteği: *"FEAD'e özel bir Sonuçlar penceresi"*). Veri kümeleri
    ÇÖZÜM ANINDA `R.signals`'a yazılır (`js/fead-signals.js`, yorum
    `js/fead-brief.js`, sunum `js/cp-fead-results.js`): çevrim (devir) ·
    Campbell (devir) · kol taraması (kol açısı) · senaryo (zaman) — panonun tek
    X ekseni kuralı yüzünden DÖRT küme. Kurallar:
    • Kararlı rejim sayıları `R.analysis`'ten BİREBİR; tarama raporun
      ızgarasıyla aynı (`veFeadArmSweep` tek kaynak), tepe yük Özet Rapor'un
      `_fsrPeak`'inden. `R.build` canlı düğümlere bağlı — sonradan kurulan
      küme çözümden sonra değişen alanı sızdırırdı.
    • **Sonuç bir MODEL İMZASI taşır** (`R.sig` · `veFeadModelSig`: kasnak,
      kayış, çözücü verisi; görünüm düğümleri DIŞARIDA) ve bayatlık TEK
      çağrıdan (`veFeadResultState`): çözücü penceresi, Sonuçlar sekmesi ve
      rapor aynı hükmü okur. Ölçülen kusur: çap +%10 → tablo %8 eski, damga yok.
    • **Kayış verisi kapısı TEK soru** (`veFeadBeltDataOn`): kapalıyken ne
      çözüm, ne kartın çırpması, ne senaryo, ne pano açıklık frekansı üretir.
      Ölçülen kusur: 11/11 örnekte senaryo "⚠ REZONANS" yazıyordu.
    • Çözücü penceresinin Sonuç sekmesi ÖZETTİR (durum · kartlar · hüküm ·
      "Sonuçlar'da aç"); tablolar Sonuç Özeti penceresinde. Kartlar İKİ
      yüzeyde aynı üreticiden (`veFeadSignals.summary`).
    • Ortak dosyalarda FEAD dalı YOK: kaynak tablosuna (`veResultSources`,
      js/results.js) girer — kök `CLAUDE.md` → ortak yüzey kuralları.
    • **Şerit yorumu YALNIZ kendi kanallarını anlatır**; kümenin geneline dair
      cümle (ankraj, kayma eşiği, SF hükmü, kalibrasyon notu) tek bir SAHİP
      kanalın şeridine ya da aileyi toplayan şeride düşer — sahipler: gerginin
      çıkış açıklığı (ankrajı o taşır; gergi yoksa `tmin`) · `sfmin` · `tc` ·
      `tmod.1`. Gerekçe: "Ayır" sonrası aynı paragraf kanal sayısı kadar
      yazılıyordu, zarfa bağlı sahip ise bölünen ön ayarda cümleyi hiç
      yazmıyordu, ve tek kasnaklı kayma şeridi zarfın değerini o kasnağın
      adıyla basıyordu (yanlış sayı, sessiz).
    • **Şerit yorumunun başlığı ŞERİDİ adlandırır**: kanalların çoğunluğunun
      grubu ("Kayma emniyeti — 4 kanal"), yoksa küme. Küme adı iki şeritte
      aynıydı (Hubload'un iki şeridi de "Çalışma çevrimi — 6 kanal").
    • **Hüküm kanıtıyla**: devir sınırı kartı en dar payı ya da ihlali yazar,
      Sonuç Özeti satırlarını basar (çözücü penceresinin kapı kartıyla aynı
      `R.checks`). Kart yalnız "Uygun" diyordu — AG00976'da pay %4,9.
    Kapılar: `fead-sonuclar.test.js` (dört kusurun üçü + okuma sözleşmesi +
    "yorum TEKRAR ETMEZ": 11 örnek × iki kayış kipi × Ayır/ön ayar düzeni ·
    SUNUM: sayı öbeği, devir sınırı kanıtı, şerit başlığı),
    `fead-sonuclar-sekme.test.js` (kablolama + "Sonuçları Temizle"),
    `tests/e2e/fead-sonuclar.spec.js` (sayfa boyu kart, gerçek çizim; 1.920 ve
    1.366'da kırpılan/bölünen yazı, bozuk lejant, bitişik hücre).

34. **STEP'TEN KASNAK GEOMETRİSİ — OKUYUCU ANLAM YÜKLEMEZ, TANIYICI MODEL
    KURMAZ** (2026-09-26, kullanıcı isteği: CATIA/3DEXPERIENCE montajından
    kasnakları okumak). `js/step-p21.js` (saf JS STEP okuyucusu: birim ·
    montaj dönüşümü · yüz) → `js/fead-step.js` (tanıyıcı) → çıktı FEAD ÖRNEK
    KAYDI biçiminde; sihirbazın 1. adımındaki **"STEP'ten başla"** kartı onu
    örnek tohumunun AYNI yolundan yükler (`_fwSeedKayit`), ikinci kurulum
    yolu açılmaz. OCCT gömülmez: hafifi bile tek dosyayı gönderim sınırının
    üstüne çıkarıyor ve STEP'i üçgene çevirip dosyada yazılı yarıçapı
    kaybediyordu. Kurallar — her biri gerçek dosyada ölçülmüş bir hataya karşı:
    • **Dış çap kaburga tepesidir**, en büyük çap değil (krank omzu Ø150,5 /
      tepe Ø147; klima çemberi Ø151 / tepe Ø137). Tepe iki kanal tabanı
      arasındaki yüzlerden; tor tepesi yüzün İÇİNDEyse R + r.
    • **Kanal = inen yanağı izleyen çıkan yanak** (70° ± 0,75°); tek yanak kanal
      değil — gevşek kural klimayı 9 kanallı okuyordu. Adım profili verir.
    • **Düz kasnak = kayışı taşıyan yüzey**: düzleme dik, kayış genişliğini
      (kanal × adım) kapsayan, düzlemde ortalanmış; aynı yarıçaplı basamaklar
      aralarında ÇIKINTI yoksa tek yüzeydir (bitişiklik ölçüt değil).
    • **ÖNCE ROL, SONRA ANALİZ** (kullanıcı kararı 2026-09-26: *"program biz
      seçtikten sonra çıkaracak; yoksa farklı dosyalarda problem
      yaşayabiliriz"*): okuma yalnız ağacı ve yüzleri çıkarır
      (`veFeadStpOku`); kasnak, düzlem ve gergi YALNIZ rol verilen
      düğümlerde aranır (`veFeadStpCoz`). Ad hiçbir şeye karar vermez, rol
      geometriden tahmin edilmez. Rol DÜĞÜME verilir (parça ya da alt
      montaj); bir parça tek birime ait — en yakın rollü ata.
    • **Düzlem EN ÇOK birimi oturtan konum**, ortanca değil: iki izli bir
      damper ya da seçilmiş başka bir kayışın kasnağı ortancayı kaydırırdı;
      düzlem dışındaki rollü parça aktarılmaz ve söylenir.
    • **Kanal varsa kaburgalı**, rol ne olursa olsun (kaburgalı avara da var —
      kanal tepeleri arasındaki silindirler kayışı "kapsayan" bir düz aday da
      kurar); kanal yoksa kayışı taşıyan düz yüzey.
    • **Bakış yönü** görünür bir varsayılandır (motor = orijin düzlemin
      arkasında; orijin düzlemdeyse `bakis.kaynak: 'varsayilan'` + uyarı) —
      ayna modeli yine çözer, yalnız krankın dönüş yönünü çevirir.
    • **Birim dosyanın bağlamından**, tahmin edilmez; MAPPED_ITEM montajı
      desteklenmez ve uyarıyla söylenir.
    • **GERGİ DOSYA OKUNUNCA BULUNUR — tek istisna** (2026-09-28, kullanıcı:
      *"modeli attığımız zaman otomatik gergi otomatik olarak bulunabilir
      mi?"*). `veFeadStpOner` rol vermeden bütün birimleri (kök hariç) tarar;
      imza: kayış düzleminde bir avara (RP) · ekseninde büyük gövde yok (R8) ·
      ona paralel, kol aralığında (R4), disk DIŞINDA (R1), göbekli (r ≥ 20,
      ≥ 8 yüz — R2), cıvata dairesinde EŞ olmayan (R3), başka kasnakla
      eşeksenli olmayan (R5), kendisi kasnak olmayan (R6) bir pivot. Her kural
      bir tuzak montajda TEK BAŞINA yük taşır; bayrak en küçük birime.
      **Öneri bir karar değil**: sihirbaz rolü yalnız TEK aday varsa ve ad ·
      kod · katalogdan biri de doğruluyorsa önceden verir (`s.otomatik`,
      kartta ve 3B'de "otomatik" diye yazılı); doğrulanmayan aday yalnız
      "Gergi olabilir" diye önerilir. Kullanıcı o düğüme dokunursa ya da
      gergiyi başka parçaya verirse otomatik atama söner — seçimi kazanır.
      Kasnak rolleri hâlâ kullanıcının (ad bir dosyada başka şey olabilir).
    • **Kayış YALNIZ rolü verilirse** (2026-09-28, kullanıcı: *"3B
      görüntüleyicide kayışı da seçelim"*): `fead-belt` birimi kasnak DEĞİL —
      yüzleri kasnak diye hiç incelenmez (kayışın yayları kasnak eksenleriyle
      eşeksenli silindirler, aday üretirdi). Kod adın İÇİNDEN kesilir ve
      `veFeadBeltParseCode`'a verilir (ikinci ayrıştırıcı yok; klimanın
      "8PK-24V"si kod değil; iki farklı kod → hiçbiri). Genişlik yan
      düzlemlerden, kanal genişlikten sağlanır (8 × 3,56 = 28,48; pay 0,2 mm),
      ayrışma sebebiyle yazılır. Aktarım profil · kanal · kodu yazar, marka
      varsayılan kalır; **numara GİRDİ değil** (gergi varken boy çıktı) —
      `stepKaynak.kayis` izinde, Kayış adımının *CAD'deki kayış* kartı onu
      `veFeadBeltFit` ile değerlendirir (numara − gereken · kolun yeri, yönüyle).
      Rol verilmezse kayışa dokunulmaz; sıra ağaç sırasıdır
      (`siraKaynagi: 'agac'`).
    • **KAYIŞ ESKİZİ HESAP ÇAPINI VERİR** (2026-09-28, kural 39): kayış
      biriminin kapalı eğrisi (`veStepP21Egri` — okuyucu anlam yüklemez) yay
      yay kasnaklarla eşlenir; yay yarıçapı − OD/2 kaburgalıda h_b, sırtta
      h_r (kullanıcının dosyasında dördü de 1,500). Tutarsızsa (> 0,01 mm)
      yazılmaz. Kayıt `hbCad` · `hrCad`'yi yazar, seçim varsayılanı CAD
      (kullanıcı kararı); seçim aktarımdan önce STEP oturumunda, sonra
      sihirbazın kayışında — tek okuyucu `_fwStpHesapCap`. Hesaptan sonra 3B'de
      seçilen kasnağın KESİTİ (ölçülen · katalog · CAD · hesap) ve seçici.
      **Kanal tabanı yanakların uçlarına değen yüz** — iç alın/delik değil
      (klimada 6,00 okunuyordu, gerçeği Ø130,10).
    • Gerginin yay verisi STEP'te yok; `tenPart` yalnız parça kodu katalogda
      TEK ise yazılır (kural 19'un gerekçesi). Kayıt µm'ye (açı 0,0001°)
      yuvarlanır — dönüşüm gürültüsü alanlara yazılıyordu; ikinci gergi rolü
      aktarılmaz (ötekinin üstüne yazılırdı).
    • **Kap imzadan** (gzip · zip · düz), uzantıdan değil — `.stpZ` iki türlü
      de yazılıyor; açıcı `js/xlsx-read.js`'in inflate'i (tek kod yolu).
    **Sihirbaz kartı** (`js/cp-fead-wizard.js`, açıklama paragrafı YOK):
    • Tanıyıcının çıktısı OTURUMLUK (`_fwStp`), `node.data.wiz`e yazılmaz;
      durumda yalnız iz kalır (`stepKaynak`, `siraKaynagi`).
    • Satırlar ağacın düğümleri, **rolsüz açılır**; rol verilince ata ve
      torunların rolü düşer. **Hesap bir DÜĞMEDİR**: rol değişince sonuç
      DÜŞER (bayat sayı kalmasın), bakış değişince düşmez (yalnız izdüşüm).
      Sonuç kayış düzleminin çizimiyle gelir: kasnaklar dış çapıyla, gergi
      kolu ve pivotu; kayış yolu ÇİZİLMEZ (sıra dosyada yok, yol çekirdeğin
      işi); renk CSS jetonlarından.
    • **Tek krank, tek gergi** aktarımı DURDURUR; orijin KULLANICININ seçtiği
      krank. Kayış ve çözücü boş durumdan (`ex.belt || {}` kanalı silerdi).
    • **Sıra bir varsayım**: aktarımdan sonra Kasnaklar adımı uyarı taşır;
      ↑ ↓, yön çevirme ya da "✓ Sıra doğru" kaldırır.
    • **Künye CAD'deki gergiyi sessizce değiştiremez**: künye seçiliyken
      parça kodu / kol / çap STEP'ten farklıysa gergi adımı adıyla söyler;
      elle yazılan değer kullanıcının kararı (uyarı yok).
    • Kart bir **bırakma alanı** (`data-ve-dropzone`): yoksa ölçüm içe
      aktarması `.stp`'yi reddedip "okunamaz" derdi.
    **3B görüntüleyici** (`js/cp-fead-3b.js`, sihirbazın içinde `#ve-fw-3b`;
    kullanıcı akışı: *"3B görüntüleyicide parçaları manuel olarak seçeceğiz,
    ardından bir butona tıklayınca çaplar, merkezler hesaplanacak"*):
    • Dosya okununca AÇILIR (THREE yoksa açılmaz, kartın tablosu kalır). Durum
      kartla ORTAK (`veFeadWizStp()`); tazeleme `veFeadWizRender`ın sonundan —
      rol, hesap, bakış, aktarım hep oradan geçer. Rol düğmesi kartın işlevidir
      (`veFeadWizStpRol`), hesap da (`veFeadWizStpHesapla`): ikinci bir yol yok.
    • Tıklanan PARÇA seçilir; **alt montaja rol yoldan** verilir (kök · alt
      montaj · parça; kök bütün montajdır, tıklanmaz). Bir yolda TEK rol
      (kartın kuralı): birimin içindeki parçaya rol vermek birimin rolünü
      KALDIRIR, bölmez — panel bunu söyler. Seçili düğümün dışı solar —
      seçimin hangi parçaları kapsadığı böyle okunur. Başarılı hesaptan sonra
      seçim kalkar (halkalar her kasnakta okunsun).
    • Renk rolden, TEK tablodan (`VE_FW_3B_ROL_RENK` → tema jetonu): malzeme de
      paneldeki nokta da oradan; rolsüz parça soluk metin tonu.
    • Hesap sonucu 3B'de dış çap halkası + gergi kolu/pivotu (başlık tonunda,
      derinlik sınaması kapalı); **"Önden bak" 2B çizimin eksenleri**
      (`veFeadStp2B`: sağ · yukarı · bakış) — 3B ile tablo aynı resmi gösterir.
      Yukarı DÜZLEMDEN gelir: XY düzleminde kameranın varsayılan yukarısı (Z)
      bakış yönüne paraleldir ve resim keyfi bir açıyla döner.
    • Başlık PENCERE AİLESİNİN (`.ve-settings-header` + 22 px çizgi kapat,
      ikon `mf-ico-box`): kaplama sihirbazın kendi başlığını da örtüyor.
    • **Açıkken pencere GENİŞLER** (2026-09-28, kullanıcı: *"daha geniş bir
      pencere açılsın"*): kaplamaya `.ve-fw-3b-genis` (`_fw3bGenis`), sihirbaz
      1.180 px → ekranın tamamı (en çok 1.840); kapanınca eski ölçüsüne döner.
      Rol düğmeleri kartın seçicisiyle TEK listeden (`veFeadWizStpRolTipleri`).
      Sağ sütun 440 px (2026-09-29, kullanıcı: 320 px *"çok dar olmuş"*).
    • **KAYIŞ SEÇİLİNCE KESİT ŞEKLİ VE HESAP ÇAPI** (2026-09-29, kullanıcı:
      *"bu resimi 3B görsel okuyucu penceresine sağ tarafa yerleştireceksin …
      hangi çapı kullanacağını buradan kayışı seçtikten sonra seçecek"* —
      ContiTech'in Şekil 1 + Tablo 1'i). Seçim kayış biriminin içindeyse
      (`_fw3bSeciliKayis`, en yakın rollü ata) üç bölüm: Şekil 1
      (`veFeadKayisSekilSVG` — solda kayış s · h, sağda kasnakta h_r · h_b ·
      d_w · d_b; sayılar çizilen kayışın, hesap çizgisi seçimle) · hesap çapı
      MATRİSİ (sütun seçenek, satır kasnak; başlık düğmesi TEK yazıcı
      `veFeadWizStpHesapCap`) · markanın beş profilli ölçü tablosu
      (`veFeadKayisOlcuHTML` ← `veFeadBeltGeom`, kaynak damgası son satırda).
      **Resim gömülmez, program çizer**: resmin tablosu tek markanın sayıları —
      Gates seçili modelin yanında hesaptaki h_b'yle çelişirdi. L_b aralığı yok
      (boy verisi markaya göre değil). Hesaptan önce de açılır; profil
      kayışın ADINDAKİ koddan (`_fwStpKayisBirim` — tanıyıcının ayrıştırıcısı).
      Hesaptan sonra hesap bölümündeki Kayış satırı da kayışı seçer.
    • **Tek Esc tek katman**: Esc önce 3B'yi kapatır; sihirbaz kapanınca WebGL
      bağlamı bırakılır. Üçgenler kartta saklanır (`_fwStp.ag`), üçgenleme
      kare kare (24 ms bütçe) — dosyanızda 1,5 sn, tek seferde arayüz donardı.
    **Üçgenleyici** (`js/step-ucgen.js`): **üçgen YALNIZ görüntü içindir** —
    çap ve merkez analitik kalır (OCCT'yi bırakmanın gerekçesi). Kenar bir kez
    örneklenir, iki yüz AYNI noktaları kullanır (su geçirmez); sınır kenarı
    ne çevrilir ne bölünür. Ölçülmüş kusurların hükümleri:
    • Kutup payı 10⁻³ mm (CATIA kutup köşesini eksenden 1,6·10⁻⁴ mm'ye kadar
      uzak yazıyor; 10⁻⁹ sahte sarım üretti).
    • İnceltme Delaunay çevirmeli: çevirmesiz ikiye bölme kulak kırpmanın
      yelpazesini çoğaltıyordu (bir tor şeridi 5.120 köşe, montaj 3,78 milyon
      üçgen). Delaunay ölçeği yay × √eğrilik (oran ≤ 10:1) — eşyönlü ölçek
      ince torları gereksiz sıklaştırıyordu. Kiriş hatası YÜZEYİN
      noktalarıyla ölçülür (sınırın yüzeyden ayrılığı bölmeyle küçülmez).
    • Doğru üstünde biten kırpmanın son üçgeni yazılır (eğri yüzeyde o doğru
      bir yaydır); kiriş payından ince iki döngülü yüz fermuarla örülür.
    • Kırpmanın çıktısı inceltmeden ÖNCE de çevrilir: düzlem yüz hiç
      inceltilmez, eğri yüzde bölme sonrası yasallaştırma yalnız bölünen
      kenara bakar (dosyada baştaki çevirme olmadan %12 fazla üçgen).
    • Üçgen vermeyen yüz kenarlarıyla çizilir ve sayılır (`kenarYuz`) — dosyada
      iki tane, ikisi de aynı çemberin yayı ile kirişi arasında ≈ 0 alanlı.
    • B-spline ters çevirmesi düğüm aralığı başına 3 ızgara noktasından başlar
      (sabit 40×40 uzun bir yüzeyde yanlış yerel en küçüğe iniyordu).
    Kapılar: `tests/unit/fead-step.test.js` (sentetik dosyalar
    `tests/helpers/step-yaz.js` + `step-ornek.js`, gerçek dosyanın kalıbında;
    rolü TEST verir) — en değerlisi Gates AG00686'nın STEP → köprü zinciri
    (span %0,5 · sarım 0,2°) ve *"ROL KULLANICININ"* (seçilmemiş kasnak,
    iki izli damper, kaburgalı avara); `tests/unit/fead-wizard-step.test.js`
    (rolsüz açılış · hesap düğmesi · ata/torun · çizim · gidiş-dönüş · kayış
    · sıra · künye · .stpZ) + `tests/unit/fead-step-oner.test.js` (gergi
    imzası · sekiz kuralın tuzak montajları · en küçük birim · iki aday ·
    otomatik atama ve sönmesi) + `tests/unit/fead-step-eskiz.test.js` (eskiz okuma · h_b/h_r · kanal tabanı · varsayılan CAD · kesit · seçici) + `tests/unit/fead-kayis-sekil.test.js` (Şekil 1'in oranları · ölçü tablosu ↔ veri · matris · kayışın bölümü) + `tests/unit/fead-step-kayis.test.js` (kod kesme ·
    kayış birimi · genişlik · aktarım · tek kayış · CAD'deki kayış kartı · tek
    rol listesi) + `tests/unit/fead-3b.test.js` (birim · tek rol ·
    renk · panel · otomatik açılış · Esc · tazeleme kancası) +
    `tests/unit/step-ucgen.test.js` (kaplama TAM · alan · hacim ve yön · su
    geçirmezlik · baştaki Delaunay · ölçülmüş kusurlar) +
    `tests/e2e/fead-step.spec.js` (gerçek File · UYGULAMANIN KENDİ karesi
    çiziyor · başlık ailenin · sığdırma montajın kendi noktalarıyla · 3B'de
    tıklayıp rol · otomatik gergi · kayış rolü · geniş pencere · alt montaj · halkalar · önden/arkadan yön
    ve XY düzleminde yukarı · hesap seçimi kaldırır · Esc · kart altından
    değişince 3B kapanır · bırakma · Modeli Kur).

35. **SEKME ADI DURUMUNU TAŞIR — kural köprünün, kapı ANLAŞMA** (2026-09-26,
    kullanıcı: *"kullanıcı bu kısmı görmeyebilir ve eksik bilgi girebilir"* →
    tasarım tezgâhından B · Durumlu Sekmeler). `veFeadSekmeDurumlari`: ok ·
    eksik (boşluğun bir SONUCU var: köprü hatası, varsayılan uyarısı, kapının
    'wait'i, sessiz sıfır) · bos (isteğe bağlı) · yok (hiçbir hesap okumuyor).
    Eksik varsa şeridin altında sonucu ve oraya giden bağlantı. Kurallar:
    • **Yüklemler köprünün**: `veFeadHasOD` · `veFeadAccLimits` (katalogtan
      gelen sınır DOLU sayılır) · `veFeadResolveDriver` (işaretsiz krank da
      sürücü) · `veFeadBeltModeLocked` · `veFeadResultState`.
    • **Sürücünün sekmeleri DEPODAN okur** (kural 42): Motor (tahrik oranı ·
      governed · overspeed · rölanti) ve Çevrim. Aksesuarın iki sekmesi
      (devir sınırları · güç eğrisi) sürücüde YOK — sürücülük bir ROL, işaret
      geçince geri gelir. Birleşik sekmede "Doldur" eksiğin KENDİ alanına
      gider (`durum.hedef`), ilk boş alana değil.
    • **Güç eğrisi sessiz sıfırı yakalar**: eğri de katalog da yokken boş kW
      hücresine köprü 0 yazıyor (`veFeadDutyToCore`).
    • **Durum YERİNDE tazelenir** (`veFeadSekmeTazele`, `saveState`ten): sayı
      alanı paneli kurmaz, kursaydı Sekme ile geçilen alan sökülürdü.
    • **Köprüye yeni zorunlu alan ekleyen onu buraya da ekler.** Kapı her
      zorunlu alanı gerçek modelde tek tek boşaltıp köprünün sözü ile sekmenin
      hükmünü BİRLİKTE ölçer — biri olup öteki olmazsa kırmızı.
    Kapılar: `fead-sekme-durum.test.js` + `tests/e2e/fead-sekme-durum.spec.js`
    (gerçek klavye → `onchange` → kayıt kancası, sürücüde DEPOYA; dar
    müfettişte sürücü dâhil tek satır; iki temada kontrast).

36. **KAYNAKLI VARSAYILAN KÖPRÜDE, ÇEKİRDEK BİREBİR** (2026-09-26, literatür
    turu). Çekirdeğin kaynaksız ya da tek markaya bağlı sabiti köprüde
    kapatılır (kural 1 ve 27'nin kalıbı):
    • **Gates PK birim kütlesi** boş alanda 0,018 (`VE_FEAD_DEFAULTS.beltMassPerRib`,
      Gates 508C el kitabı; çekirdeğin 0,0144'ü hiçbir kaynakta yok). Değer her
      zaman geçer, künye yalnız TÜKETİLDİĞİNDE (kayış verisi açıkken) deftere
      yazılır; pencere aynı sayıyı alanın DEĞERİ olarak yazar (kural 43,
      `veFeadKayisKutlesi` → `veFeadBeltMassOf`).
    • **Kord rijitliği** PK'nın öteki markalarına Gates'in ETKİN değeriyle
      geçer ve sınır `limits`te yazılır (`veFeadCordStiffness`, üç çağrı yeri
      `veFeadTorsionalOpt`'tan); PK dışında sayı uydurulmaz.
    • **Çevrim kaydı kaynağının sıcaklığını taşır** (`degC`; paylaşılan
      çevrimde çoğunluk) — yeni alan `_fdDutyDeep` beyaz listesine de girer.
    • **§8.12: merkezkaç payı oranın İÇİNDE** (kural 28); sırt μ'nün kaynağı
      Dayco US 8,192,315.
    Hangi sabitin açık kaynakta karşılığı olduğu: `references/uc-katman-ve-cekirdek.md`
    → *"açık kaynak karşılığı"*. Kapılar: `fead-defaults.test.js` ③④,
    `fead-denetim-bulgular.test.js` → *"kord rijitliği markadan bağımsız"*,
    `fead-duty.test.js` → *"sıcaklık kaynağından"*, `cp-fead-report.test.js` →
    *"katılmamıştır hükmü geri gelmez"*.

37. **KAYIŞ NUMARASI d_b ÇİZGİSİNDE, d_w YANINDA** (2026-09-28, kullanıcı
    kararı). 8PK1410'daki 1410 kanallı kasnağın dış çapındaki boydur (ISO 9981
    efektif boyu, ContiTech L_b, çekirdeğin `LeffMm`'i); CAD eskizi çoğunlukla
    kordu (d_w = d_b + 2·h_b, `LpitchMm`) ölçer. Gerekçe: d_w'yi numara saymak
    kayışı 2π·h_b uzun seçtirir ve kolu sessizce başka açıya oturtur.
    • **Dönüşüm TEK yerde**: `veFeadBoyCizgileri` (köprü) — fark h_b'den, yani
      MARKADAN (PK Gates 7,54 · ContiTech 9,42 mm). Her yüzey (Boy sekmesinin
      kesit figürü `veFeadKesitSVG` · sağ sütun · rozet · sihirbaz bandı · rapor
      §8.2 · Sonuç Özeti) numarayı d_b'de yazar, kordu yanına bu dönüşümle.
    • **Okuma TEK kaynak**: `veFeadBoyOkuma` — çözüm varsa köprünün çözüme
      yazdığı boy, yoksa sabit kipte girilen; serbestte model yoksa '—'.
      Kilit (`veFeadBeltModeLocked`) "Boy kaynağı"nda da sayılır.
    • **`.ve-fp-l` etiketinde sembol yok**: etiket büyük harfe çeviren bir flex
      kutusu — `d<sub>b</sub>` "D B", π Π olur. Semboller figürde ve açıklamada.
    • Paftanın **"Efektif Çap"** sütunu d_w'dir (defterin adı, OD + 2·h_b);
      "efektif boy" d_b'de. Ad kalır (defterle birebir), ayrım kılavuz §8.5'te.
    Kapı: `fead-boy-cizgisi.test.js` (dönüşüm çekirdeğin geometrisiyle aynı ·
    çözüme yazılan boy L_eff − ofset · figür ölçekli · kart = sütun · öteki
    yüzeyler) + `fead-table.test.js` → *"ON sütun"* (rozet modelin sayılarını).

38. **ARAÇLAR PENCEREDE, TOPOLOJİDE DEĞİL** (2026-09-28, kullanıcı kararı —
    tasarım tezgâhı IV · A: *"A'yı çok beğendim. Onu yapalım."*). Sihirbaz ·
    Hesapla · Ayarlar (Çözücü) · Rapor · Yön, tuval kabının sol üstündeki
    **FEAD araçları** penceresinde (`js/cp-fead-araclar.js`). Çözücü, Rapor ve
    Sihirbaz kutusuz düğüm olarak yaşar (veri taşırlar); Dönüş Yönü düğümü
    hiçbir şey taşımıyordu ve kalktı (şema 9 göçü `veFeadMigrateSpinOff`).
    • **PENCERE AYAR TUTMAZ**: Hesapla çözücünün çevrimini, İndir raporun
      türünü okur; durum `veFeadResultState`, çip `veFeadResChipHTML`, kartlar
      `veFeadSignals.summary`, uygunluk `_feadSideGates` — aynı soruya iki
      yüzey aynı cevabı verir (kural 16 · 33).
    • **DÜĞÜMLER GARANTİ** (`veFeadAraclarGaranti`): açılış yüzeyi kurar, eski
      kayıtta eksik olan açılışta geri-al TABANINA eklenir; silinmez
      (`noDelete`), tek kopya. Paletten eklemenin yolu yok — garanti olmasa
      Hesapla "Çözücü yok" deyip kalırdı.
    • **YER VE KATLILIK MODELDE DEĞİL** (tarayıcıda, `mfsim.fead.araclar`):
      kaydedilmez, geri-al yığınına yazılmaz.
    • **YUVADAKİ PENCERE TUVALİ ÖRTTÜĞÜNÜ SÖYLER** (`data-ve-ortu="sol"`) ve
      sığdırma o genişliği düşer (`veTuvalSolOrtu`) — söylemeseydi açılış
      kadrajında kart pencerenin altında kalırdı. Serbest pencere söylemez.
    • **YALNIZ FEAD KAPSAMINDA**; kapsamın tek noktası `veSyncSidebarScope`.
      Gizleme `hidden` + `.ve-fead-arac[hidden]{display:none}` — sınıfın
      `display:flex`'i tarayıcının `[hidden]` kuralını ezer ve pencere ana
      topolojide görünür kalırdı (jsdom'da görünmez; kapı `fead-araclar.spec.js`
      → *"KAPSAM"*).
    • **TAZELEME ÜÇ NOKTADAN**: `veFeadRefreshLayoutCards` (her saveState) ·
      `veFeadSolve` · `_feadForgetResults`. Yön değişince gergi tarafı hükmü
      DÜŞER — bayat sonucun hükmü başka bir yönün hükmüdür.
    • **PASİF DÜĞME SEBEBİNİ SÖYLER**: Hesapla ve İndir `aria-disabled`
      (`disabled` değil) ve eylemleri sebebi yazar; çözüm hatasının sebebi
      Çözüm bölümünde. Yön ipucu DÜZLEMİ yazar (`veFeadSpinLabel(s).uzun`).
    Kapılar: `fead-araclar.test.js` · `fead-spin.test.js` → *"Yön yüzeyi"* ·
    `fit-view.test.js` → *"SOL ÖRTÜ"* · `tests/e2e/fead-araclar.spec.js`.

39. **HESAP ÇAPI: KORD ÇİZGİSİNİN h_b / h_r'Sİ TEK ALANDAN** (2026-09-28,
    kullanıcı: *"kullanıcı kayışın kalınlığını da hesaba katıp 150 mm çap ile
    hesap yapmak isteyebilir"*). Kasnağın `od`'si d_b'dir ve girdi kalır;
    çekirdek zaten kord çizgisinde kurar (kaburgalı OD/2 + h_b, sırt OD/2 +
    h_r). Seçilen şey çiftin KAYNAĞI, kayışın tek alanında (`hesapCap`):
    `katalog` (boş, marka) · `cad` (`hbCad` · `hrCad`, eskizden) · `db`
    (h_b = h_r = 0). Kayış için TEK seçim — kord çizgisi tek; kasnak başına
    seçim hız oranını sessizce karıştırırdı. `od`'ye 150 yazmak ÇİFT SAYAR
    (çekirdek 153 kurar) — hesap çapı `od`'ye yazılmaz.
    • **Tek kaynak**: `veFeadKordOfset` (köprü); `veFeadBoyCizgileri`,
      pencere, rapor, özet, sihirbaz kayışın KENDİSİNİ verir (profil/marka
      değil). Katalogda kayış nesnesine dokunulmaz (eski modeller bayt bayt).
    • **Çekirdeğin tuzağı** (kural 30): `beltProps` hb + hr birlikte gelince
      kataloğu birleştirmez — köprü kataloğu ALTA koyar.
    • CAD seçili ama ölçü yoksa katalog + uyarı; sessiz yedek yok.
    Kapı: `fead-hesap-capi.test.js`.

40. **PROFİL GEOMETRİSİ PROJE TABLOSUNDA — çekirdeğin BELT_DB'si EKSİK**
    (2026-09-28, ölçüm). Çekirdeğin kataloğunda GATES'in yalnız PK'sı var;
    15 profil×marka bileşiminin DÖRDÜ (GATES + PH/PJ/PL/PM) dışarıda kalıyor
    ve GATES panelin VARSAYILAN markası — kullanıcının yalnız PROFİLİ
    değiştirmesi yetiyor. Kural 39'dan önce `makeSystem` hata fırlatıyordu;
    39'dan sonra `veFeadKordOfset` `kaynak:'katalog'` deyip **h_b/h_r = NaN**
    dönüyordu: çökmeden beter, çünkü panel "katalog" yazarken sayı yoktu.
    • Eksik satır **çekirdeğe YAZILMAZ** (dışarıdan geldi, birebir durur).
      Katalog projenin veri katmanında: `js/fead-belts.js` ·
      `VE_FEAD_BELT_GEOM` (5 profil × 3 üretici).
    • `veFeadKordOfset` çekirdek bilmiyorsa proje tablosuna düşer ve
      `projeTablosu` bayrağını açar; köprü o bayrağı görünce çifti çekirdeğe
      AÇIKÇA geçirir. Çekirdek bileşimi TANIYORSA hiçbir şey değişmez —
      kalibre sabiti (`cordStiffnessNPerRib`) orada kalır, KOPYALANMAZ.
    • Eşleme (proje satırı → çekirdeğin alan adları) tek yerde:
      `veFeadBeltProjeProps`. İki kopya, birinde rib kütlesi unutulunca
      açıklık frekanslarını sessizce düşürürdü.
    • Her satır **kaynak damgası** taşır (`uretici` / `defter` / `iso`) ve
      panel onu yazar: ISO nominaline düşülmüş bir h_b ile üreticinin kendi
      h_b'si aynı hücrede aynı görünür, aynı şey değildir (kural 8).
      Gates h_b/h_r'yi PJ/PL/PM için yayımlamıyor; PH'yi hiç üretmiyor.
    • Kasnaktaki kesit figürü de (`veFeadKesitSVG` → `_feadKesitGeom`) proje
      tablosuna düşer — GATES + PJ/PL/PM'de figür hiç çizilmiyordu; çekirdeğin
      bildiği on bir bileşimde çıktı bayt bayt aynı (110 çıktı ölçüldü).
    Kapı: `fead-belt-geom.test.js` + `fead-kayis-sekil.test.js`.

41. **"BİLEŞENLER" SÜTUNU YOK — EKLEME TUVALDE** (2026-09-28, kullanıcı
    kararı: *"FEAD modülünde bu 'Bileşenler' sütununu kaldıralım, zaten
    ekleyeceğimiz bileşenlerin hepsini 'kanvaslar' üzerinden
    ekleyebiliyoruz."*). Modül beyan eder (`componentDefs['fead-analysis']
    .noPalette`), kapsamın tek noktası sınıfı yazar (`veSyncPaletsizKapsam` ←
    `veSyncSidebarScope`, `.ve-main.ve-paletsiz`), CSS sütunu VE açma rayını
    gizler; index.html'de FEAD kapsamlı kategori YOK (görünmez, ölü olurdu).
    Sütunun FEAD'deki dört işinin yeri:
    • **KASNAK → paftanın "＋ Kasnak ekle" LİSTESİ** (`veFeadTableAddHTML`):
      satıra TIK `veFeadTableAdd` (gerginin önüne, koordinatsız); satırı
      SÜRÜKLEMEK paletin bırakma kancalarına gider (`veFeadPaletUstunde` ·
      `veFeadPaletBirak` — ikinci bırakma yolu yazılmadı; bir `<select>`
      sürüklenemediği için liste). Gergi açıklığa girmez: satırı sürüklenmez.
      Liste YUKARI açılır (pafta kartın dibinde), sürüklemede solar ve
      tıklamayı geçirir (örttüğü kayış da hedef); açıklık modelde değil
      (`VE_FEAD_EK_ACIK`, kural 15'in gerekçesi).
    • **SÜRÜKLEME SONU LİSTE KABININ `ondragend`inde, belgede değil**
      (`veFeadEkBitti`): başarılı eklemede pafta yeniden kurulur ve kaynak
      satır DOM'dan sökülür; `dragend` BELGEYE ulaşmaz ama sökülen alt
      ağaçtaki kaba ulaşır (ölçüldü). Belgeye bağlanan bir temizlik onu
      kaçırır — liste açık çizilir, tip globalde (`vePaletSuruklenen`) kalırdı.
    • **YENİ KANVAS → FEAD araçları penceresinin "Kanvas"ı**
      (`veFeadKanvasEkle`): yer kuraldan — sıranın sağı, en üstteki kartla
      aynı hiza (kural 22); tek geri-al adımı; kadraj sığdırılır.
    • **NOT ARAÇLARI → FEAD araçları penceresinin "Not" bölümü** (kullanıcı:
      *"Not araçlarını da FEAD araçları penceresine ekleyelim"*). Açıklama
      modülüne (js/annotations.js) DOKUNULMAZ: sürükleme onun taşıyıcısını
      (`annotation-type`) yazar ve kabın `drop`ına düşer, tık onun kurucusunu
      çağırır (`veFeadNotEkle` → `createAnnotation`, tek geri-al adımı).
      Not kartların ARKASINDA durduğu için tık GÖRÜNÜR yere kurar: çerçeve
      kutulu kartların HEPSİNİ çevreler, yazı onların üstüne (çerçeve
      etiketine ve başka yazıya binmez — `veFeadNotYeri`); görünmüyorsa
      kamera en az kayar (`veFeadNotKaydir`). Hedef SEÇİM DEĞİL: örnek
      kurucusu son kartı seçili bırakıyor (ölçüldü). Seçim yalnız yeni notta
      kalır — Delete seçili kartı da silerdi. Pencere BIRAKMA HEDEFİ DEĞİL
      (`dropEffect = 'none'`, yalnız not sürüklemesinde): altına kurulan not
      pencerenin arkasında görünmez kalırdı.
    • **KAPSAM SIĞDIRMADAN ÖNCE** (`veFeadOpenEditor`): tuval FEAD'e girerken
      220 px genişliyor; senkron sığdırmadan sonra koşsaydı kadraj dar tuvalle
      kurulur, içerik sola kayık kalırdı. Kullanıcının daralt tercihi
      (`mf-sidebar-collapsed`) YAZILMAZ — kapsamın kuralı bir tercih değil.
    Kapılar: `kabuk-sutun.spec.js` → *"PALETSİZ KAPSAM"* ·
    `fead-araclar.spec.js` → *"SÜTUNSUZ AÇILIŞ"* + *"KANVAS"* + *"NOT ARAÇLARI"* ·
    `fead-cizim-masasi.spec.js` → *"LİSTEDEN KAYIŞA BIRAK"* ·
    `fead-table.test.js` → *"EKLEYİCİ BİR LİSTE"* · `fead-araclar.test.js` →
    *"PALETSİZ"* + *"YENİ KANVAS"* + *"NOT ARAÇLARI"* · `arac-performans.test.js` →
    *"PALETSİZ KAPSAM"*.

42. **İŞLETME VERİSİ SÜRÜCÜNÜN PENCERESİNDE, DEPOSU ÇÖZÜCÜ** (2026-09-28,
    kullanıcı: *"Krank kasnağı üzerinden sistemi tahrik edecek motoru
    seçelim … 'Çözücü' kısmında ben sadece sayısal yöntemler ve çözüm
    yaklaşımları görmek istiyorum"*).
    • **Sürücü kasnağın penceresi: Geometri · Rol · Motor · Çevrim.** Motor
      sekmesi motor kataloğunu, devir sınırlarını, güç eğrisini (tam yük +
      FEAD'in payı) ve FEAD tahrikini BİRLİKTE taşır — seçimin getirdiği
      seçicinin altında görünür; ayrı sekmelerle şerit 380 px'lik müfettişte
      iki satıra kırılıyordu (458 / 345 px). Pencere SÜRÜCÜNÜN
      (`veFeadResolveDriver`), krank tipininki değil — ikincil tahrikte fan.
    • **Veri depoda** (`veFeadIsletmeDeposu` = çözücü düğümü: garanti, tek,
      silinmez): sürücülük ROL — işaret geçince ya da kasnak silinince motor
      ve çevrim kalır. Eylemler AÇIK pencereyi kurar (`_feadPencereTazele`),
      yazılan düğümünkini değil — motor seçen kullanıcı Çözücü'ye atılmaz.
      Çevrim tohumu pencere kurulurken (`_feadDepo`).
    • **Kayış penceresinin Tasarım sekmesi** boy ofseti + yorulma modeli (depoda).
    • **Çözücü girdi SORMAZ**: Yöntemler (`VE_FEAD_YONTEMLER` — her satır bir
      ÇAĞRIYA bağlı; kodda karşılığı kalmayan yöntem listede yaşayamaz) ·
      Model · Sonuç. Yöntem seçimleri bu temelin üstüne kurulur.
    Kapılar: `fead-surucu-pencere.test.js` → *"TOHUM" · "DEPO" · "MOTOR" ·
    "YÖNTEMLER"*, `fead-sekme-durum.test.js` + `.spec.js`, `fead-checks.spec.js`,
    `fead-duty.spec.js`, `tablo-pencere.spec.js`.

43. **KAYNAKLI VARSAYILAN DEĞERİYLE YAZILIR, KAYNAĞI 'i'DE** (2026-09-28,
    kullanıcı: *"silik olarak görünüyor fakat hesaba katılıyor mu belli
    olmuyor. Düz direkt default değer yazsın ve yanında ufak bir 'i'"*).
    • Pencere ve köprü AYNI fonksiyonu okur, dönüş `{deger, kaynak, alan,
      ipucu}`: `veFeadKasnakAtalet` · `veFeadGergiAtalet` · `veFeadBoyOfseti` ·
      `veFeadKayisKutlesi` · `veFeadKayisToleransi` · `veFeadAsinmaPayi`.
      Boş alanın varsayılanı YER TUTUCU DEĞİL, alanın DEĞERİ; yazınca `elle`,
      silince varsayılan değer geri gelir (`veFeadVarsayilanSet` yerinde).
    • **Sürücüde krank mili ataleti kasnağınkinden ÖNCE** — rapor 0,064
      basarken model 0,70 ile çözüyordu (BMC, AG00976).
    • **Tolerans basamağı KULLANILAN boydan** (serbest kipte çözülen) —
      soluk '6', kısa kayışta köprünün kullandığı 5'i gizliyordu.
    • İpucu metni ÖRNEKLEMDEN (`VE_FEAD_ORNEKLEM`, Gates PDF okumasıyla
      birebir). Kutu belgenin gövdesinde (kaydırma kabı kırpmasın), düğmesinden
      uzun yaşamaz, ESC önce onu kapatır (tek tuş, tek katman). İkon
      `veIkon('info')`.
    Kapılar: `fead-surucu-pencere.test.js` → *"ATALET"* (12 örnek · 52 kasnak)
    + *"İPUCU"*, `fead-defaults.test.js` → *"'i' ipucunun örneklemi"*.

44. **AKSESUAR MODELİ TEK SEÇİCİ, SEÇİM ÇEVRİME ULAŞIR** (2026-09-28,
    kullanıcı: *"aksesuarları seçtiğimde bile değerleri sanki gelmiyor … bayat
    gibi"*). BMC künyesi ve Araç Performans modeli Rol sekmesinde TEK listede
    (`veFeadAccModelOpts`, `bmc:` / `ap:` ön ekli) ve TEK yazıcıda
    (`veFeadAccModelSet` — sihirbazla aynı, kural 24). Eğri getiren seçim o
    aksesuarın çevrim kW'larını siler — öncelik `çevrim kW > kendi eğri >
    katalog` olduğu için silinmeseydi seçim sonuca ULAŞMIYORDU (AG00976
    alternatör 3,61 … 4,02 kW sabit). Başka kataloğa geçiş künyenin yazdığını
    temizler. Kapı: `fead-surucu-pencere.test.js` → *"MODEL"*.

45. **PENCERE AÇIKLAMA TAŞIMAZ, DURUM SÖYLER** (2026-09-28, kullanıcı:
    *"bileşen pencerelerinin içeriği birer felaket … gereksiz açıklamalar var.
    Hepsini kaldıralım"*). Pencerede kalan not bir DURUMdur: uyarı (sapma,
    bant dışı, eksik), bir hükmün cümlesi ya da okumanın anahtarı (◆ gibi).
    "Bu alan şuna girer / neden böyle" açıklaması KILAVUZDADIR
    (`js/guide-fead.js`); aynı sayıyı ikinci kez söyleyen not da açıklamadır
    (ölçüldü: 12 örneğin pencerelerinde 590 not → 135). Kapı: kural 26'nın
    kapıları + `fead-pencere-ailesi.test.js`.

46. **İŞLETME HESABI MOTOR VE AKSESUAR OLMADAN YAPILMAZ** (2026-09-29,
    kullanıcı bildirimi: *"program motor ve aksesuar seçmeden hesap yapıyor …
    Bu bir hata."*). İki sınıf sonuç: GEOMETRİ ve gergi statiği her zaman
    çözülür; İŞLETME (gerilme, hubload, kayma, ömür, senaryo) dört girdiden
    türer ve biri eksikken hesap KOŞMAZ — üretilen sayı bir varsayım olurdu.
    • **TEK KAYNAK köprüde:** `build.isletme = {ok, eksik:[{grup, alan, ad}]}`,
      `veFeadBuildSystem` sarmalayıcısı HER dönüş yolunda yazar
      (`veFeadIsletmeEksik`). Gruplar: **motor** (silindir · rölanti · governed
      > rölanti; overspeed İSTENMEZ — devir sınırı kapısı onsuz `'wait'`),
      **oran** (tahrik oranı çözülüyor), **aksesuar** (yük taşıyan her kasnağın
      her devirde bir güç kaynağı: kayıtlı kW → kendi eğrisi → katalog),
      **çevrim** (≥1 devir). Metin tek üreticiden (`veFeadIsletmeMetni`).
    • Okuyanlar aynı hükmü verir: `veFeadSolve` koşmaz ve bildirir; FEAD
      araçları penceresi (sebep + eksiğin sekmesi) ile çözücü paneli
      Hesapla'yı pasifler; sürücünün Motor çipi ve aksesuarın güç çipi
      "işletme hesabı yapılmaz" der (kural 42'nin penceresi);
      kart haritasız çizer, eksik lejantın yerinde (`data-ve="isletme-eksik"`),
      oran çözülmediyse dönmez; senaryo `null`; sihirbazın 5. adımı kırmızı ve
      alt bilgi "işletme hesabı bekliyor" — model yine KURULABİLİR.
    • **VARSAYILAN UYDURULMAZ:** silindir 6 · rölanti 700 · tepe 2500 kalktı.
      `veFeadAnalyze` silindiri seçenekten, yoksa modelin alanından okur; boşsa
      hata. Zorunlu alanın yer tutucusu `zorunlu` der — kural 43'ün "varsayılan
      değeriyle yazılır"ı yalnız GERÇEKTEN varsayılanı olan alan içindir.
    • Senaryonun yükü kararlı çözümün kaynak sırasından (`veFeadKwAt`).
      Kayma hükmü YALNIZ yük taşıyan kasnaktan — "hiç yoksa bütün kasnaklar"
      yedeği üç yerde kalktı (özet · `_frMinSF` · pencere hükmü).
    • Motor kataloğu ETKİN sabit oranı ezmez (`veFeadEngineApply` kipin adına
      değil `veFeadDriveRatio`'ya bakar) — motor seçmek zorunlu, oran kaymamalı.
    • Örneğe motor sayısı YAZILMAZ (kural 19 — Gates raporlarında yok). Örneği
      çözen test katalog kaydının yalnız DEVİR SINIRLARINI yardımcıyla yazar
      (`tests/helpers/fead-motor.js`); kılavuzun sahnesi de öyle ve 9.2 söyler.
    • Krank mili ataleti bu kuralın DIŞINDA: arşiv medyanı belgelenmiş
      varsayılan (kılavuz 9.4, künyeye yazılır).
    Kapılar: `fead-isletme.test.js` · `fead-transient.test.js` → *"VARSAYILAN
    YOK"* · `fead-wizard.test.js` → *"ray gerçekten yanıyor"*.

47. **SİHİRBAZ BİR ÇİZİM MASASIDIR** (2026-09-29, kullanıcı kararı — tasarım
    tuvali "Adım içerikleri" · F: *"Yeni tasarımımız 'F çizim masası' olacak"*;
    föy (E) aynı gün emekli, adımlı ray aynen kaldı). Gövde iki sütun: solda
    MASA (adımın konusu ölçekli çizimde; sol üstte sonuç çipi, sağ üstte
    araçlar, sol altta lejant), sağda 316 px DENETİM SÜTUNU (özette masanın
    üstünde yüzen 288 px panel). Gövde kaymaz, sütun kayar. Ölçüldü (1440×900,
    AG00976): çizim 6 adımın 3'ünden 6'sına; Kasnaklar çizimi 114 → 446 bin px²;
    çizimdeki en küçük yazı 7 → 9,4 px; Motor ve çevrim gövdesinin 687 px'lik
    taşması → 0 (tablo pencerede).
    • **ÇİZİM TEK KAYNAK**: kayış yolu `veFeadLayoutSVG` (`inline`,
      `kunye:false` — çipi ve lejantı olan yüzeyde çizicinin künyesi ve alt
      notu çizilmez, kanvas kartında durur); masanın katmanı çizicinin
      dönüşümünü okur (`ek(T)` kancası), geometri kurmaz. Gergi konumları
      `veFeadPositionRows`, göbek yükü `FEADCore.tensionerState`; grafiklerin
      sayısı uygunluk kapısının kaynaklarından (`_fwKwEff` · `accessoryRpm` ·
      `veFeadAccLimits`); özetteki kesikli çizgi `veFeadChecks`'in ihlal satırı.
    • **ÖLÇEK k = 1,35** (`VE_FW_MASA_K` ↔ CSS `--masa-k`): çizim 1/k kurulur,
      k kat büyür; masa katmanının yazısı CSS'te k'ya bölünür. Grafik adımı 1:1.
    • **KASNAKLAR**: liste (sıra · ad · Ø · sarım) + seçili kasnağın editörü;
      gerginin editörü kasnaklarınkiyle BİREBİR (Tip tek seçenekli; Sürücü ve
      Sil kapalı, sebebi ipucunda). **Ekle · dönüş yönü · STEP sırasının onayı
      sıranın KENDİ kartında** — "Sıra ve yön" bloğu ve ayrı "Kayış yönünü
      çevir" düğmesi yok (2026-09-29, kullanıcı: *"Alt tarafı kaldıralım"*).
    • **MASA BİR GÖRÜNTÜLEYİCİ** (2026-09-29, kullanıcı: *"Yakınlaştırma-
      uzaklaştırma sağa sola pan … Tutup hareket etmeyi de kaldıralım"*):
      tıkla seç, sürükle kaydır (kasnağın üstünden başlasa da), tekerlek
      İMLEÇTEKİ noktaya yakınlaşır (×0,5–12), ok tuşu kaydırır; kasnak masada
      TAŞINMAZ, konum editörde. Görünüm TEK katmandan (`_fwLayout`: ekran =
      z·taban + t; taban çizicinin kendi dönüşümü) ve adım başına; ızgara her
      adımda mm'ye hizalı (`_fwIzgaraKur`). Pencere geniş (100vw−48, tavan
      1760 px; 100vh−48) — ray ve sütun aynı, büyüyen masa.
    • **TAHRİK KİPİ TEK ÇÖZÜCÜDEN** (`_fwOranKipi`): arayüz, düğüm, örnek
      tohumu ve kayıtlı taslak aynı cevabı verir; elle oran (`driveRatio`)
      sihirbaza TAŞINMAZ (Gates örneğinin `direct`+1'i "krank doğrudan"
      olur). Çap eksikken oran ÇÖZÜLMEZ ve "—" yazılır; okumalar canlı yamada
      (`#ve-fw-tahrik-oku`). Ölçülen hata: model 0,8685 ile çözerken kart
      "1,0000 · elle girildi" diyordu.
    • **5. ADIM: TAHRİK ZİNCİRİ + DEVİR PENCERELERİ** — zincirde halkanın
      çarpanı `FEADCore.speedRatio`; pencerelerde TEK eksen motor devri,
      aksesuar sınırı motor devrine çevrilir (sınır / oran), renk yalnız
      DURUM (seri paleti durum renkleriyle çakışıyordu; güç çubuğu mürekkep
      tonunda), kritik nokta ve notu uygunluk kapısından (`veFeadChecks`).
      Etiketler seyreltilir (`_fwSeyrek`, büyük değer önce). **Hiçbir sınır
      sessizce düşmez**: sürekli sınır tabanın `VE_FW_PENCERE_PAY` (1,4)
      katı içindeyse eksen onu kapsar; eksende kalmayan sınır çizimin
      sağındaki OLUKTA yazılır ("anlık 6.000 / motorda 4.072"). Çizimin
      yazıları oluğa taşmaz — sağda yer yoksa sola geçer. Ölçülen hata
      (teslimden önce): 12 örnekteki 18 sınırın 11'i görünmüyordu.
    • **Çevrim tablosu PENCEREDE** (`#ve-fw-cevrim`; kW hücresi yerinde
      tazelenir, girdi kutusu yeniden kurulmaz). İç pencerelerde Esc tek
      katman; sihirbazın kapanışı iç pencereleri kapatır.
    • **GRAFİK ETİKETİ ÇİZGİYİ KESMEZ** (yay doğrusu, `_fwYayGrafikHTML`):
      etiket adaylarından doğruyu, y eksenini ve önceki etiketleri kesmeyen
      ilkine konur. Sabit ofset 180 durumun 180'inde kesiyordu — doğru eğimli,
      ofset etiketin bir ucunda yetmiyor. Kapı: `fead-sihirbaz-masa.test.js`
      + `fead-wizard-tur3.spec.js` → *"YAY DOĞRUSU"* (gerçek yazı kutusu).
    • Föyden süren kurallar: adım numarası metne elle yazılmaz
      (`_fwAdimNo(anahtar)` — ölçüldü: "7. adımdaki iki kapı", adım sayısı 6);
      kurulacaklar listesi kurulumun KENDİSİNDEN (`_fwKurulumOzet`); K künyeden
      gelen alan (`_fwKun`); damganın sayısı VE RENGİ rayla tek kaynaktan
      (`veFeadWizStepState`; modelin hükmü `data-model`de); açıklama yüzeyi
      yasağı (yönerge yalnız `title`da, lejant bir anahtar).
    Kapılar: `fead-sihirbaz-masa.test.js` · `fead-wizard.test.js` ·
    `fead-wizard-catalog.test.js` · e2e `fead-wizard*.spec.js` ·
    `fead-sihirbaz-masa.spec.js` (pencere eni · gerçek fareyle gezinme ·
    tahrik oranı yazarken · STEP onayı tek satır · diyagramlarda yazı
    çakışması, bütün örnekler × iki ekran).

48. **SERVİS FAKTÖRÜ BİR YÜK KATSAYISIDIR, EŞİK DEĞİL** (2026-09-29, kullanıcı:
    *"kullanıcı tablodaki değerlerin birini seçecek. Matematiksel hesap ona
    göre güncellenecek"*). c₂ ContiTech / ISO-DIN yük katsayısı tablosundan
    (`VE_FEAD_SERVIS`, 4 yük sınıfı × 2 sürücü × 3 günlük süre) seçilir —
    kayışın Tasarım sekmesinde ve sihirbazın Kayış adımında, TEK üreticiyle
    (`veFeadServisTabloHTML`) ve TEK yazıcıyla (`veFeadServisSet`); veri
    depoda (`servisHucre` + `serviceFact`). Serbest sayı alanı yok.
    • **Kayma tasarım yükünde**: P_B = c₂·P, zincir afin
      (T_B = T₀ + c₂(T − T₀), `veFeadTasarimGerginlik`); çözümün `slip`
      satırları tasarım yükünde, gerçek yükteki `slipIsletme`; hüküm SF ≥ 1;
      kayma eşiği tam c₂ katı. Gerilme, hubload, ömür ve frekans GERÇEK yükte
      (Gates karşılaştırması bozulmasın). Eskiden alan orana konan bir eşikti
      (SF ≥ c₂) — yük katsayısını orana koymak başka bir ölçüttür.
    • **c₂ çözümde dondurulur** (`R.servis`); bütün yüzeyler oradan okur.
      Seçilmemişse c₂ = 1 ve "Seçilmedi" yazılır — varsayılan uydurulmaz
      (sihirbazın kaynaksız 1,3'ü kalktı); hücresiz kayıtlı sayı "kayıtlı
      değer" (BMC örneğinin kaynağı 1,3 der), 1'in altı 1'e çekilir.
      **Örnek c₂'yi yalnız kaynağından taşır**: Gates raporları servis faktörü
      uygulamıyor, Gates kaydı c₂ taşımaz (AG00976'nın kaynaksız 1,3'ü föyü
      4,58 → 3,88 kaydırıyordu). Kapı: *"ÖRNEKLER c₂'yi KAYNAĞINDAN taşır"*.
    • **Araç motoru normal kalkış grubunda** (içten yanmalı > 600 d/dk);
      ekran görüntüsündeki "n up to 600 rpm" ilk grupta çeviri hatası.
    Kapı: `fead-servis-faktoru.test.js` — bağımsız yol (yükler × c₂, c₂'siz
    çözüm) tasarım satırlarını birebir veriyor; sekiz mutasyonun sekizi kırmızı.
    • **Tablo iki yüzeyde AYNI çizilir**: pencerenin genel `th, td` dolgusu
      `!important` — istisna da öyle ve kapsamı bu tablo; başlık kuralı kabıyla
      nitelenir. Kapı: `fead-panel-gramer.spec.js` → *"c₂ tablosu … AYNI
      çiziliyor"* (ölçülen: pencerede "10–16" iki satır, düğme 16 px dar).

49. **KAYMA GATES'İN KOŞULUNDA, SÜRTÜNMEYİ KULLANICI SEÇER** (2026-09-29,
    kullanıcı: *"Bir Gates raporları üzerinden ilerliyoruz fakat bu değerin
    seçimini yine kullanıcıya bırakmamız gerekiyor … Gates kalibrasyonu en
    büyük verimiz şu anda"*). Gates'in kayma grafikleri sayıya çevrildi
    (`docs/gates-reports/kayma/`) ve iki ayrışma köprüde kapandı.
    • **Tanım kapasite**: SF = T_gevşek·(e^(μφ) − 1)/(T_gergin − T_gevşek) —
      sınırda oran tanımıyla aynı hüküm, üstünde torkla doğrusal. Oran tanımı
      avarada 1,05 basıp tehlike gibi görünüyordu (Gates 33,7).
    • **Koşul en kötüsü**: her çevrim devrinde {+ivme, 0, −yavaşlama} (atalet
      J·α/r, bir kez) × her aksesuar tepe gücünün %10/%100'ü × avara ve gergide
      0,01 kW (`veFeadKaymaDevir`). Zincir çekirdeğin `spanTensions`iyle birebir;
      satır kritik koşulu taşır (`kritik`). Tepe güç: kendi eğrisi → katalog →
      çevrim yükü (son hâl ve eksik ivme `limits`te yazılı). c₂ BÜTÜN talebi
      (güç, atalet, sürtünme) çarpar; eşik satırlardan (`kaymaEsik`).
    • **Yük taşıma ROLDEN** (`yukTasir`, `veFeadSlipYukTasir`): Gates koşulunda
      avaranın oranı 1,01'i aşıyor (AG00976'da altı kasnağın beşi "yük taşıyan"
      çıkıyordu). Çevrimde gücü yazılı avara yük taşır ve söylenir — gerilme
      tablosunun gördüğü yük kaymadan sessizce düşmez (AG00902).
    • **Sürtünme seçimi** (`VE_FEAD_SURTUNME`, depo `surtunme` + elle üç sayı,
      TEK yazıcı `veFeadSurtunmeSet`, TEK üretici `veFeadSurtunmeHTML` — kayışın
      Tasarım sekmesi ve sihirbazın Kayış adımı). **Gates kalibrasyonu
      varsayılan**: oluklu μ 0,92 + küçük kasnak kaybı ℓ = 7 mm
      (φ_etkin = φ − 2ℓ/r, YALNIZ oluklu — sırta uygulanınca küçük sarımlı
      avara Gates'le çelişiyor), sırt μ 0,60. **Literatür** çekirdeğin
      `CALIBRATION`ından okunur (kopya yok); Ø57–61 alternatörde ×1,4'ten
      iyimser — rapor yazar. Seçim çözümde donar (`R.surtunme`).
    • **Gates örnekleri raporun ivmesini taşır** (kural 19): on bir raporun
      on biri s1'de "Accel. RPM/s" yazıyor (1000; AG00976 1100) — dokuzunda
      eksikti ve kayma atalet talebini hiç görmüyordu.
    Kapı: `fead-kayma-gates.test.js` (zincir birebir · tanım · koşul · AG00810
    tepe 2.530 N · rol · eşik ↔ SF = 1 · Gates'in 11 raporu: oluklu ×0,85–1,20,
    sırt ×0,70–1,05 · seçim · yüzeyler · örneğin ivmesi PDF'ten) +
    `fead-panel-gramer.spec.js` → *"sürtünme seçicisi … AYNI çiziliyor"*.

**Bağımsız denetim aracı:** `npm run fead:denetim` (`tools/fead-denetim`) —
Gates'e hiç bakmadan koşan analitik + değişmezlik ölçümleri. 27–30 numaralı
kuralların hepsi oradan çıktı.

## Referans dosyaları

Değiştireceğin alanın dosyasını **oku**; hepsini birden okuma.

| Dosya | Ne var |
|---|---|
| `references/uc-katman-ve-cekirdek.md` | Üç katman kuralı · doğrulama kapısı ve eşikleri · burulma modeli ve iki sessiz girdisi · üç yapısal kural |
| `references/kayis-kipi-ve-katalog.md` | Kayış boyu kipleri · nominal kol açısı · kenetlenen kol · hoşgörülü geometri · `js/fead-belts.js` kataloğu ve iki kümesi |
| `references/kanvas-ve-kart.md` | Kanvas = kayış düzlemi · Konum Bağı · **Dönüş Yönü** (bileşen kalktı — kuralları FEAD araçları penceresinin Yön bölümünde) · port kenarı/yön oku/şeritler · `veFeadArrangeByCoords` · Kayış Yolu kartı · animasyon · yön gülü |
| `references/raporlar.md` | Ayrıntılı ve özet HTML rapor · §8 alt bölümleri · şekil çizicileri · kozmetik ve denetim turları · tepe zinciri çevrim kapanışı · kayma eşiği |
| `references/cozum-ornekler-ve-ankraj.md` | **Gergi tanımı (TEK KOORDİNAT — önce bunu oku)** · duty tablosu ve `js/fead-duty.js` çevrim kütüphanesi · gergi künye kütüphanesi (`js/fead-tensioners.js`) · ankrajın türetilmesi · Başlangıç Sihirbazı · örnekler |
| `references/testler.md` | FEAD test dosyalarının kapsamı |
| `references/emekli-yonler.md` | **ARŞİV** — kodda olmayan yönler (`fead-graph.js`, dairesel kasnak düğümü) |

## Bu modülü belgelerken

Bir turun **ölçüm anlatısı** bu dosyalara yazılmaz; hüküm + tek satır gerekçe +
kapının testi yazılır. Ölçüm tabloları PR gövdesinde ve test dosyasında kalır.
Bu modülün kaydı bir kez 2.835 satıra, sonra 4.300'e çıktı ve kökteki
`CLAUDE.md`'nin %63'ünü yiyordu — kural onun tekrarını önlemek içindir.
Ayrıntısı kökteki "Belgeleme kuralı" bölümünde.
