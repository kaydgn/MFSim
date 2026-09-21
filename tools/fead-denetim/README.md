# FEAD bağımsız denetim

FEAD çekirdeğini **Gates raporlarına hiç bakmadan** sınar. Mevcut doğrulama
kapısı (17 rapor / 2095 değer, `tests/unit/fead-core.test.js`) modeli
tedarikçinin sayılarına bağlar; bu araç aynı modeli **kendi içinden** sınar:

| Ölçüt | Örnek |
|-------|-------|
| Kapalı biçimli analitik sonuç | düzgün n-kenarlıda `L = n·a + 2πr`, teğet `√(d²−ρ²)`, periyodik halkanın `ω_k = 2√(kR²/I)·|sin(πk/n)|` özdeğerleri |
| Değişmezlik | yerleşimi döndür/ötele/ölçekle, kasnak listesini çevrimsel kaydır → skaler sonuçlar değişmemeli |
| Korunum | `Σ hubload = 0`, gerilme çevriminin kapanması, `ΔT·v = P`, `v = ω_i·r_i` |
| Fiziksel sıralama | aynı makinenin iki yazımı (tahrik oranı 1 ↔ 2) aynı sonucu vermeli |

**Neden ayrı bir araç:** bu sınamaların hiçbiri referans veri İSTEMEZ, yani
tedarikçi arşivi olmayan bir ortamda da koşar; ve kalibrasyon takımının
göremediği bir hata sınıfını görürler — Gates örneklerinin tamamı
`driveRatio = 1` yazılı olduğu için o çarpanın iki kez uygulandığı bir hata
2095 değerin hiçbirini oynatmaz.

```bash
node tools/fead-denetim                  # altı takımın hepsi (~25 sn)
node tools/fead-denetim analitik         # tek takım
FEAD_DENETIM_N=5000 node tools/fead-denetim degismezlik
```

`npm test`'e BAĞLI DEĞİL: rastgele üretilen sistemler üzerinde koşuyor ve bir
kapı değil bir **ölçüm aracı**. Bulduğu hükümlerin kapısı, hükmü taşıyan
modülün kendi test dosyasına yazılır.

| Takım | Ne ölçer |
|-------|----------|
| `analitik` | 39 kapalı biçimli sınama |
| `degismezlik` | N rastgele sistem × 34 değişmez (varsayılan N=2000) |
| `hedefli` | tahrik oranı · tepe çevrim kapanışı · kol açısının kök sayısı · merkezkaç · burulma rijit modu · seçenek geçirme · ad çakışması · ömür modeli · yük sıralaması |
| `supurme` | profil×marka · yay künyesi · kaburga ↔ ömür · duty kapsamı · span frekansı · makullük panosu |
| `katalog` | 11 profil-marka çiftinde çap katmanı · kayma emniyetinde yüklü kasnak ayrımı |
| `cirpinma` | çırpınma bayrağının iki sebebinin ayrıştırılması |

Üretici (`lib.js` → `genSystem`) dışbükey bir gövde üzerine kaburgalı
kasnaklar, kirişin dışına sırttan temaslı avaralar ve hubload bileşkesine dik
bir gergi kolu kurar; kayış boyu hedef kol açısındaki çözüme eşitlenir, yani
**çalışma noktası kurgu gereği bilinir**. Tasarım gerginliği köprünün yaptığı
gibi yay dengesinden TÜRETİLİR, girdi olarak verilmez.
