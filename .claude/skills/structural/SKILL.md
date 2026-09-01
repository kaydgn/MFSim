---
name: structural
description: MFSim Yapısal Analiz (FEA) modülünün karar kaydı ve dokunulmazlıkları. js/cp-structural.js, js/cp-structural-viewer.js, js/structural-model.js, js/structural-remesh.js, js/structural-mesh-model.js, js/structural-materials.js dosyalarından birine, gömülü OCCT/TetGen varlıklarına ya da Yapısal testlere (tests/unit/structural-*, cp-structural, tests/e2e/structural-*) dokunmadan ÖNCE çağır. Eleman tipi kuralı, CAD yüzü kimliği, worker paketi, remesh kalkanı ve malzeme kütüphanesi kuralları buradadır.
---

# Yapısal Analiz modülü — dokunmadan önce

Zincir **portlarla zorlanır**, yorumla değil:

```
Geometri → Hesaplama Ağı → Sınır Koşulları → Sonuçlar
   │
   └── Malzeme ve Özellikler   (ALT bileşen — zincirin halkası değil)
```

Geometri girişsiz, Sonuçlar çıkışsız → zincir ters kurulamaz. Malzeme'nin
**çıkışı yoktur** → ara halka olarak sokulamaz. İlk iki halka + Malzeme DOLU;
Sınır Koşulları ve Sonuçlar hâlâ iskelet (`_strPending`: panel boş ama SESSİZ
değil).

## Dokunulmazlar

1. **ELEMAN KUADRATİK (tet10).** tet4 bu modülde yasak: ölçüldü, 27.783
   serbestlik derecesinde bile cevap %24 yanlış — ve hep **rijit**, yani
   güvenli tarafa değil. Kontur grafiği kusursuz görünür, hata gözle
   yakalanmaz.
2. **YAKINSAMA GÖSTERİLMEK ZORUNDA.** Tek bir FEA sonucu bir sayı değil bir
   kanaattir; rapor yakınsama eğrisini basmadan hüküm veremez.
3. **Sınır koşulu CAD YÜZÜNE bağlanır, ağ düğümüne değil.** Kimlik
   `m<mesh>/f<yüz>` (`veStrFaceKey`) ve **ağ inceliğinden bağımsızdır** —
   yakınsama çalışması ağı defalarca yeniler; düğüme bağlansaydı her
   yenilemede bütün sınır koşulları düşerdi. Zincir uçtan uca ölçülü:
   occt `brep_faces` → remesh `faceIds` → TetGen `facetmarkerlist` → çıktı
   `trifacemarkerlist`.
4. **`vendor/opencascade.*` ve `vendor/tetgen-src/*` dışarıdan geldi, birebir
   durur** — `js/fead-core.js` ile aynı kural. MFSim'in kendi kaynağı yalnız
   `tools/tetgen-wasm-src/tetgen-glue.cpp`.
5. **`predicates.cxx` MUTLAKA `-O0`.** Shewchuk'un kesin aritmetiği IEEE 754
   yuvarlamasının TAM sırasına dayanır; iyileştirme açılırsa TetGen
   **sessizce geçersiz** ağ üretir.
6. **Künye HAFİF.** `node.data`'ya üçgen, ağ dizisi ya da STEP kaynağı
   YAZILMAZ: `saveState()` bütün `node.data`'yı derin kopyalıyor, yığın 50
   adım tutuyor ve otomatik yedek `localStorage`'a gidiyor (kota ~5–10 MB).
   Ölçüldü: 140 KB'lık bir kaynak künyeye yazılınca `saveState` 0,12 → 2,17 ms,
   yığın 184 KB → 3,14 MB. Kaynak oturumluk depoda, yalnız proje DOSYAYA
   kaydedilirken enjekte edilir ve o yol **kopyala-yaz** olmak zorundadır.
7. **Kritik metrik `v_min`, `q_min` DEĞİL.** Şekil ölçütü iyi bir ağda bile
   0,0000 görünebilir; rijitlik matrisini tekil yapan şey hacmi sıfıra yakın
   tetlerdir. `degenerate > 0` bir uyarı değil, **çözümü durduran hüküm**.
8. **Worker paketi ELLE SAYILMIŞ bir listedir** (`_smMeshBridgeSource()`).
   Yeni bir `_sm…` / `veStr…` fonksiyonu eklersen pakete de ekle: ana iş
   parçacığı yolunda kod kapsamdadır, hata YALNIZ worker'da — yani gerçek
   panel yolunda — çıkar. Kapısı var, ama önce sen ekle.
9. **Panel mesajı `showNodeProperties`'ten SONRA yazılır.** Tersi paneli
   `innerHTML` ile baştan kurup mesajı siler; kullanıcı "ne hata veriyor ne
   başka bir şey" der.
10. **Ağır çözümleme WORKER'da.** Ölçüt "hızlı mı" değil, arayüzün yaşıyor
    olması — dürüst ölçüsü içe aktarma boyunca çizilen KARE SAYISI (ana iş
    parçacığında 1, worker'da 91).
11. **Malzeme kataloğu bir SERTİFİKA DEĞİL** — standardın nominal değerleri,
    20 °C için. Kayıt düğüme **kopya** olarak gider (katalog güncellemesi
    kaydedilmiş bir analizi sessizce değiştirmemeli); `lib`/`libVer` yalnız iz
    bırakır. ν ≥ 0,5 reddedilir (tekillik), 0,49–0,5 uyarılır (hacimsel
    kilitlenme). ρ panelde kg/m³ sorulur, çözücüye **ton/mm³** gider.

## Referans dosyaları

| Dosya | Ne var |
|---|---|
| `references/kapsam.md` | Zincirin kuruluşu · kapsamı belirleyen iki ölçüm · mesh boru hattı · sınır koşulu kimliği |
| `references/geometri.md` | STEP içe aktarma · boolean'lı OCCT'ye geçiş · gömülü .wasm · kaynak deposu · worker · CAD yüz listesi · panel ölçüsü |
| `references/malzeme.md` | `str-material` alt bileşeni · 112 kayıt / 16 aile · arama katmanları · sıcaklık, yorulma, sertlik verisi · üç diyagram |
| `references/ag.md` | Yüzey yeniden-mesh · kesişme kalkanı ve üç kör noktası · paso sayısı · katı başına tetrahedralizasyon · non-manifold · panel |
| `references/testler.md` | Yapısal test dosyalarının kapsamı |

Lisans (**TetGen AGPL-3, MFSim MIT — dağıtılan build AGPL-3**) ve **ağır
varlıkların gömülmesi** kuralı proje geneli olduğu için kökteki `CLAUDE.md`'de
durur.

## Bu modülü belgelerken

Bir turun **ölçüm anlatısı** bu dosyalara yazılmaz; hüküm + tek satır gerekçe +
kapının testi yazılır. Kural kökteki `CLAUDE.md`'nin "Belgeleme kuralı"
bölümündedir.
