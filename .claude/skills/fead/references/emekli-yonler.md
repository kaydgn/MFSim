# FEAD — EMEKLİ yönler (kodda YOK)

> Arşiv: anlatılan yüzeyler bugün kodda yok. Aynı yön yeniden denenirse
> nelerin ÖLÇÜLMÜŞ olduğunu bilmek için duruyor. Bugün geçerli karşılığı
> `kanvas-ve-kart.md` içindedir.

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


#### KAYIŞ TABLOSU — KART LİSTESİ ve ÇEKMECE (2026-09-21 → 09-26)

> **BU BÖLÜM BAYAT — anlatılan iki yüzey kodda YOK.** 2026-09-26'da Pafta'ya
> (SKILL.md kural 14: tablo Kayış Yolu kartının içinde, çizimin altında)
> yerlerini bıraktılar. Aynı yön yeniden denenirse nelerin ölçülmüş olduğunu
> bilmek için duruyor.

**KART LİSTESİ (2026-09-21, tasarım tezgâhı → "C · Kart Listesi").** `<table>`
kalkmıştı: her satır bir `.ve-fead-krt`, üç bölge (`kim` · `gir` · `coz`);
bölge genişlikleri `veFeadKartBolgeW` ile sütun listesinden türeyip
`--fead-krt-*` özel özellikleriyle geçiyordu. `coz` bölgesi `1fr` ve genişliği
yazılmıyordu — sabit yazılınca genişletilen kartın sağında ölü şerit kalıyordu
(782 px kartta 12 px). Kayış boyu ve Σ toplam KÜNYEDEYDİ (`rowspan`lı kayış
boyu hücresi beş satır boyunca ~170 px boş kalıyordu); Dönüş Yönü iki durumlu
segmentti. Kılavuzun ölçekleyicisi genişliği `--fead-krt-en`den okuyordu
(bölgeleri toplamak `1fr`i atlıyordu: 768 yerine 534). Emekli sebebi:
kullanıcı çekmecedeki hâlini *"çok kaba duruyor"* buldu ve tezgâh III'te
Pafta'yı seçti. Kart listesinden Pafta'ya geçen kurallar (görünüm CSS'te, ad
hücresi bir bağlantı, bölge içinde defter sırası, eklenen satır görünür) kural
14'te duruyor.

**ÇEKMECE (2026-09-23 → 09-26).** Tablo kanvas kartından (`fead-table`) inip
Kayış Yolu kartının "Tablo" düğmesiyle açılan, modal olmayan bir pencere oldu
(`veFeadTabloAc` · `veFeadTabloKapat` · `#ve-fead-tablo`); 09-24'ten itibaren
tuvalin ALTINA yapışık bir satırdı. Tuval o kadar kısalıyor, kamera yalnız
kesilen çizimde sığdırıyor, hiç yakınlaşmıyor ve kapanınca dönüyordu. Üst
kenarda tutamak vardı (boy oturumluk, tuvale en az 180 px). FEAD'den çıkınca
kapanıyor, arka plan kaydının gidiş-dönüşünde kapanmıyordu. Kanvasla
ÖLÇEKLENMİYORDU (sayılar arayüzün `--fs-lg` basamağında), başlığı kabuk
bandıydı. Ölçülen bedeli (AG00810, 1920×952): tuvalden 266 px (870 → 604),
kasnak ↔ satır mesafesi 659–785 px. Pafta'da tuval 870 px'te kalıyor, mesafe
302–405 px.
