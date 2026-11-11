// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — GERÇEK KANVAS BİLEŞENLERİ (panel + çözücü)
// ============================================================================
// SPEC "Takoz Çökme–Titreşim Modülü (6 SD Rijit Gövde Modeli)" v1.0.
// Hesap çekirdeği: js/mount-core.js (veMountCore) — DOM'suz saf fonksiyonlar.
//
// MİMARİ (kullanıcı kararı): Motor / Şanzıman / Şaft / Braket / Transfer (kütle
// gövdeleri) ve Takoz bileşenleri iç topolojiye sürüklenir; BAĞLANTI YOKTUR
// (bağlantı portu bulunmaz). Çözücü iç topolojideki TÜM kütle+takoz düğümlerini
// (nodes içinde def.isMountBody / def.isMount) OTOMATİK algılayıp 6 SD analizini
// otomatik yük durumlarıyla çalıştırır — kullanıcı ne bağlantı ne yük durumu girer.
//
// Birim (SPEC 2): UI mm/kg/N/mm; çekirdek SI. Dönüşüm yalnız burada.
// Kalıcılık: her node kendi node.data'sında (proje kaydet/yükle otomatik).
// ----------------------------------------------------------------------------

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function _mntNum(v, d){ if(v===undefined||v===null||v==='') return d===undefined?0:d; var x=(typeof v==='string')?v.trim().replace(',', '.'):v; var n=Number(x); return Number.isFinite(n)?n:(d===undefined?0:d); }
function _mntFmt(x, dg){ if(!Number.isFinite(x)) return '—'; dg=(dg===undefined)?3:dg; return veSayi(x, dg); }
function _mntEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _mntDeflColor(mm){ var a=Math.abs(mm); if(a<0.5) return '#22c55e'; if(a<1.0) return '#84cc16'; if(a<2.0) return '#eab308'; if(a<3.0) return '#f97316'; return '#ef4444'; }
function _mntForceColor(kN){ var a=Math.abs(kN); if(a<5) return '#22c55e'; if(a<10) return '#84cc16'; if(a<20) return '#eab308'; if(a<30) return '#f97316'; return '#ef4444'; }
function _mntDef(n){ return (typeof componentDefs!=='undefined') ? componentDefs[n.type] : (n.def||{}); }
function _mntNodeName(n){ return n.customName || (_mntDef(n)||{}).name || n.type; }

// A26 gömülü takoz kütüphanesi (SPEC 7.2)
// Gömülü girdi: statik (sx/sy/sz) + dinamik (dx/dy/dz) rijitlik [N/mm]. Bir eksende
// nonlineer kuvvet–sehim yasası iki biçimde tanımlanabilir (yoksa o eksen lineerdir):
//   • `fits:{x,y,z}`   — ANALİTİK kapalı-form (mm/N). Çekirdek force+tanjantı tam ve
//        pürüzsüz üretir (Newton için ideal). 'poly': F=k0·x+c3·x³+c5·x⁵ (radyal);
//        'asym' (eksenel, MODEL konvansiyonu δ<0 = BASMA): δ<0 → comp.k0·δ/(1+δ/comp.xmax)
//        (rasyonel, −xmax'ta bump-stop), δ≥0 → ext.k0·δ+ext.c3·δ³ (kübik, geri-gelme).
//   • `curves:{x,y,z}` — ölçülmüş [[δ_mm,f_N],…] nokta tablosu (monoton kübik interp).
// TK0xx fit'leri test raporu grafiklerinin (Fx/Fy radyal, Fz eksenel) curve-fit'idir;
// dz @5 mm ön yük. Test grafiğinde +yer değiştirme=BASMA olduğundan, eksenel fit modelin
// δ<0=basma konvansiyonuna göre yazılmıştır (comp=test'in sert dalı). NOT: radyal fit
// orijin eğimi = statik Cx/Cy; eksenel fit orijin eğimi (~k0≈360) tablo Cz'den (192)
// yüksektir (rasyonel form uç-noktaya oturtulmuş) — daha iyi fit gelirse güncellenir.
//
// ── AD KURALI (kullanıcı kararı 2026-10-19: "Takoz adları genel ve resmi olsun")
// Ad = ürün tipi + sertlik + (parça no), üreticinin kataloğundaki adla; üretici
// kodu üreticisiyle yazılır: "Cone 38 60 ShA (AMC 137963)" — tek başına altı
// haneli kod ekranda binliksiz sayı okunur. Proje, rapor ve not ada girmez —
// köken bu yorumda. Aynı parça TEK girdidir; tek istisna aşağıdaki 57RS
// çiftleri. Kapı: tests/unit/mount-library-adlar.test.js.
//
// ── AYNI PARÇA KODU, FARKLI TAKOZ ────────────────────────────────────────────
// 57RS313773 ve 57RS313774 kodları İKİ AYRI kaynakta, İKİ AYRI takoz için
// geçiyor (kullanıcı teyidi: kodlar aynı olsa da farklı takozlardır). Bu yüzden
// her biri AYRI girdi olarak tutulur; hangisinin kullanılacağına kullanıcı
// açılır listede karar verir. Girdi adı KOD + KAYNAK taşır — başka bir şey değil.
//
//   kaynak       | kod        | statik x/y/z    | dinamik x/y/z
//   -------------|------------|-----------------|-----------------
//   A26          | 57RS313773 |  334/ 334/2300  |  435/ 435/3000
//   A26          | 57RS313774 | 1200/1200/2400  |  950/ 950/1900
//   ASR-SR-116   | 57RS313773 |  462/ 462/2200  |  630/ 630/3000
//   ASR-SR-116   | 57RS313774 | 1045/1045/1800  | 1045/1045/1800
//
// ÖN/ARKA gibi KONUM etiketleri girdi adına KONMAZ: bir takozun ön mü arka mı
// olduğu takozun değil, monte edildiği yerin özelliğidir — araçtan araca
// değişir. Konum, takoz düğümünün kendi adıyla (customName) ifade edilir.
// (Kaynak dokümanlardaki roller kayıt olsun diye: A26'da 773=ön, 774=arka;
//  ASR-SR-116'da tersi. Bu yalnız köken bilgisidir, koda girmez.)
//
// A26 satırları powerpack_mount_analysis_A26.html'den birebir port edilmiştir.
// ASR-SR-116 satırları BMC "ASFAT 8x8 OBUS Takoz Seçimi" (04.08.2021) Tablo 9'dur;
// o dokümanın Tablo 8 (sehim) ve Tablo 11 (sönüm) sonuçları bu değerlerle
// yeniden üretilebilir — bkz. tests/unit/mount-library-sources.test.js.
//
// ANAHTARLAR DEĞİŞMEZ: kayıtlı projeler takozu node.data.libKey ile bağlar;
// mevcut '57RS313773'/'57RS313774' anahtarları A26 girdilerinde KALIR, yeni
// kaynak '-sr116' sonekiyle eklenir. Yalnız görünen ad kaynağı belirtir.
//
// ── AMC MECANOCAUCHO® KONİK TAKOZLAR ────────────────────────────────────────
// İKİ VERİ TABANI VAR; İKİSİ DE DOĞRU, AMA AYNI ŞEY DEĞİL:
//
//   (A) NOMİNAL KATALOG — üreticinin ürün verisi. Yüksüz, küçük-sehim rijitliği.
//       Takozun KENDİ özelliğidir, hangi araca takıldığından bağımsızdır.
//   (B) BMC 8x8 ÇALIŞMA NOKTASI — AMC'nin o araç için yaptığı hesapların
//       içinden geri çözülen EFEKTİF rijitlik. Takozun o montajdaki ön yükü
//       altındaki sekant değeridir; araca özgüdür.
//
// Kütüphanede (A) durur (anahtar 'amcNNNNNN'): aynı parça tek girdidir (AD
// KURALI). (B)'nin '-calc' girdileri 2026-10-19'da kütüphaneden çıktı; değerleri
// o dört AMC raporunu yeniden üreten testin verisidir
// (tests/unit/mount-library-amc-cone.test.js). Tek istisna Cone 121 NP (137829):
// nominal verisi yayımlanmadı, girdisi (B) değerlerini taşır. Farkı görmezden
// gelmeyin: Cone 38'de sx 1800 (nominal) ↔ 2670 (çalışma noktası) — %48.
// Nedeni fiziksel, bkz. "NEDEN FARKLILAR" başlığı.
//
// ── (A) NOMİNAL KATALOG ─────────────────────────────────────────────────────
// Kaynak: AMC ürün karşılaştırma aracı (amceodev.amcsa.es/curves_comparative.aspx,
// 24.11.2025 dökümü) + Cone 67 için AMC teknik departmanından yazılı bildirim
// (Okan Tandoğan) + SOLID CONE / CONE WITH CUTOUTS katalogları (kod, sertlik,
// maks. yük, sıkma torku) + AMC genel kataloğu "Cauchometal" (EN): ürün adları
// (CONE TYPE 38 · 39 · NG/NP CONE TYPE 121 · HYDRAULIC CONE MOUNTS 72).
//
//   kod    | tip         | kauçuk| Sh | maks. yük | kx    | ky    | kz   | cdyn/cstat
//   -------|-------------|-------|----|-----------|-------|-------|------|-----------
//   137963 | Cone 38     |  NR   | 60 |   650 kg  | 1800  | 1210  | 1150 | 1,6
//   137964 | Cone 38     |  NR   | 70 |   900 kg  | 2770  | 1990  | 1900 | 1,8
//   137731 | Cone 67     |  NR   | 50 |   900 kg  | 3090  | 2150  | 1325 | 1,4
//   137981 | Cone 39     |  NR   | 40 |   400 kg  | 1340  | 1340  |  720 | 1,2 ⚠
//   137982 | Cone 39     |  NR   | 50 |   600 kg  | 2200  | 2200  | 1150 | 1,4 ⚠
//   137983 | Cone 39     |  NR   | 60 |   900 kg  | 2490  | 2490  | 1400 | 1,6 ⚠
//   137830 | Cone 121 NG |  NR   | 55 |  1750 kg  | 4000  | 4000  | 1350 | 1,5
//   137833 | Cone 121 NG |  NR   | 65 |  2000 kg  | 5800  | 5800  | 2500 | 1,7
//   177296 | Hydr. C. 72 |  —    | 60 |   900 kg  | 1090  | 1090  |  650 | 2,0
//                                                     [kx,ky,kz = N/mm, statik]
//   dx/dy/dz = sx/sy/sz × cdyn/cstat (üreticinin verdiği yöntem).
//
//   ⚠ Cone 39'un cdyn/cstat satırı elimizdeki ekran görüntüsünde KESİK. Değerler
//     AMC'nin kendi NR verisinden çıkan kuraldan alındı: cdyn/cstat = (Sh+20)/50.
//     Kural, elimizdeki BEŞ NR koni verisinin BEŞİNİ de birebir veriyor —
//     50Sh→1,4 (137731) · 55Sh→1,5 (137830) · 60Sh→1,6 (137963) · 65Sh→1,7
//     (137833) · 70Sh→1,8 (137964). Yine de TÜRETİLMİŞ değerdir: AMC'nin gerçek
//     satırı gelirse 137981/137982/137983'ün dx/dy/dz'si güncellenmeli.
//
//   SÖNÜM kütüphanede tutulmaz (ζ takoz başına değil, Çözücü'de montaj geneli
//   tek değerdir). Kaynaktaki değerler kayıt olsun diye: Cone 121 NG 55/65Sh
//   ζ = 0,05 · Cone 67 50Sh ζ = 0,04.
//
//   EKSİK: 137984 (Cone 39 70Sh, 1100 kg) kataloğda var ama rijitlik verisi
//   verilmedi → girdi AÇILMADI. 137829 (Cone 121 NP 55Sh, 1200 kg) için de
//   nominal veri gelmedi (yayımlanmış veri yok, 2026-10-19) → o girdi yalnız
//   (B) tabanını taşır.
//
// RADYAL ANİZOTROPİ KASITLIDIR — sx ≠ sy yazım hatası değildir:
//   Cone 38 ve Cone 67 "CONE WITH CUTOUTS" ailesinden. AMC kataloğu birebir
//   şöyle der: "The cutouts on the rubber section offer different horizontal/
//   vertical stiffness ratios… a lower stiffness is required in one of the axes."
//   AMC'nin Cone 67 bildirimi ekseni açıkça adlandırıyor: "Longitudinal X 3090 —
//   Transversal Y (Cutouts) 2150 — Axial Z 1325". Yani YUMUŞAK eksen oyukların
//   olduğu Y. Takoz 90° döndürülerek monte edilirse sx ve sy YER DEĞİŞİR.
//   Cone 39 ve Cone 121 NG "SOLID CONE" — eksenel simetrik, kx = ky (üreticinin
//   tablosu da öyle veriyor; uydurma değil, ölçüm).
//
// ── (B) BMC 8x8 ÇALIŞMA NOKTASI (test verisi; kütüphanede yalnız 137829) ────
// Kaynak: AMC Technical Assistance Service çok-gövdeli titreşim analizi raporları,
// müşteri 79724 BMC Otomotiv, proje 3066 "8x8 Armored Carrier Truck – Powertrain",
// hesaplar 13440 / 13948 / 13955 / 13957. Dört rapor AYNI güç grubunu (Motor
// 1472,2 kg + Şanzıman 813 kg, toplam 2285,2 kg) dört FARKLI takoz kombinasyonuyla
// çözer — aynı takoz tipi birden çok bağımsız yapılandırmada görünür.
//   • statik ← 4 raporun "Static Results" tablolarındaki 20 takoz satırının
//     sehim+kuvvet çiftlerine (1g) en küçük kareler uyumu;
//   • dinamik ← "Natural Frequencies" tablolarındaki 24 özdeğere 6 SD rijit gövde
//     özdeğer probleminin uyumu.
// Bu değerlerle MFSim çekirdeği dört raporun TAMAMINI yeniden üretir: statik
// sehim ≤ 0,03 mm · takoz kuvveti ≤ 0,005 kN · 24 doğal frekansın 22'si ≤ 0,07 Hz.
// (Tek belirgin artık hesap 13948'in 4.–5. modu, ≤ 0,47 Hz: o raporda Cone 121 NP
// %65–67 yüklü, AMC'nin nonlineer basma eğrisinin çalışma noktası teğetiyle
// çözdüğü bölge; tek lineer rijitlik oraya tam oturmuyor.)
//
// ── NEDEN FARKLILAR ─────────────────────────────────────────────────────────
// Nominal değerler yüksüz/küçük-sehim; rapor değerleri ise takozun GERÇEK ön
// yükü altındaki sekant rijitliği. İki fizik etkisi farkı açıklıyor:
//   • Eksenel: koninin basma eğrisi yükle sertleşir — AMC kataloğunun kendi
//     ifadesiyle "increasing progressively as the load increases". Cone 121 NG
//     %45 yükte kz 1350 → 1530 (+%13).
//   • Radyal: eksenel ön yük kauçuğu kayma yönünde de sertleştirir; oyuklu
//     konide bu etki sert eksende (x) çok daha belirgin — Cone 38'de 1800 →
//     2670 (+%48), Cone 67'de 3090 → 3550 (+%15), buna karşılık yumuşak eksen
//     (y) ve eksenel (z) neredeyse değişmiyor (≤ %12 / ≤ %3).
// ÖLÇÜLDÜ: nominal değerlerle dört rapor çözülünce sapma Δf 2,92 Hz'e, Δδz
// 0,70 mm'ye çıkıyor; (B) değerleriyle 0,47 Hz / 0,03 mm. Yani hangi tabanı
// seçtiğiniz sonucu değiştirir — kütüphane genel ürün seçimi içindir (A); bu
// aracın AMC raporlarını yeniden üretmek (B)'nin işidir ve testte durur.
//
// ── LMT-1433-00 (AMC DEĞİL — BMC güç grubu FEA raporlarının takozu) ─────────
// Kaynak: BMC R&D FEA raporları — "BMC Engine Mount (8x8 Ttar)" (Onur GÖR,
// 02.10.2018, V00) ve "(4x4 Tatar)" (12.02.2019, V01). İkisinin "Engine Mount
// Design Proposal (Standard Part)" tablosu takoz BAŞINA rijitliği sertliğe göre
// veriyor; V01 sunumu bu satırın parça adını açıkça "LMT-1433-00" yazıyor.
// Teknik resimler Angst+Pfister logosu taşıyor → parça büyük olasılıkla A+P'dir,
// AMC Mecanocaucho değil (KATALOGLA TEYİT EDİLMEDİ, arama sonuç vermedi).
//
//   ShA | X N/mm | Y N/mm | Z N/mm      (takoz başına; flanş 107×90, delik 80×65)
//   ----|--------|--------|--------
//    40 |   900  |   900  |   450
//    55 |  1500  |  1500  |   750
//    70 |  2500  |  2500  |  1150
//
// TEK TABAN — sx = dx KASITLI: kaynak statik/dinamik ayrımı yapmıyor, sertlik
// başına TEK üçlü veriyor. Kütüphanede bunun emsali var (57RS313774-sr116 de
// tek tabanlıdır). Uydurma bir cdyn/cstat oranı YAZILMADI.
//
// DEĞERLER RAPORUN KENDİ MODAL SONUCUNU VERİYOR (ölçüldü): Konsept 2 = 3 konum ×
// 2 adet LMT-1433-00 + Z'de 110 N/mm yay. Takoz konumları raporlarda YOK, ama
// düşey (bounce) modu konumdan bağımsızdır: f=(1/2π)·√(Σkz/m).
//   65 ShA · 2302 kg → hesap 8,266 Hz ↔ raporun modu 8,250 Hz   (%0,20)
//   55 ShA · 2302 kg → hesap 7,122 Hz ↔ raporun modu 7,281 Hz   (%2,2)
//   55 ShA · 1966 kg → hesap 7,707 Hz ↔ raporun modu 8,090 Hz   (%4,7)
// Yani tablo, FEA'nın modal analizinde kullandığı rijitliktir.
//
// STATİK TARAFTA AÇIK UÇ: raporlanan "@1g sehim" doğrusal tahminin 1,26 / 1,18 /
// 1,10 katı (sırasıyla yukarıdaki üç durum). Oran SABİT DEĞİL — bir kısmı takoz
// başına eğilme (raporlanan değer büyük olasılıkla maksimum), bir kısmı
// nonlineerlik olabilir; ikisi ayrıştırılamıyor (konumlar yok). Bu yüzden
// buradan bir statik/dinamik oranı TÜRETİLMEDİ. Angst+Pfister'in statik+dinamik
// ayrımlı verisi gelirse sz/sx düşürülüp dx/dz ayrıştırılmalıdır.
//
// ── "Mount 1" — aynı tablonun ÖTEKİ satırı (kullanıcı kararı: numarasız ekle) ─
// Aynı "Design Proposal (Standard Part)" tablosunun ilk satırı. PARÇA NUMARASI
// HİÇBİR DOKÜMANDA GEÇMİYOR — kaynak yalnız "Mount 1" diye anıyor (LMT-1433-00
// ise "Mount 2"). Numara bulununca girdi ADI düzeltilmeli, anahtarlar kalır.
//
//   ShA | X N/mm | Y N/mm | Z N/mm      (takoz başına)
//   ----|--------|--------|--------
//    40 |   800  |   450  |   300
//    55 |  1000  |   750  |   500
//    70 |  1350  |  1100  |   800
//
// LMT-1433-00'ın aksine RADYAL ANİZOTROPİK (sx > sy > sz).
//
// RAPORUN KENDİ TOPLAMLARIYLA ÇAPRAZ DOĞRULANDI: Konsept 1'in "Total Stiffness"
// satırı bu tablodan yeniden kuruluyor → Konsept 1 = 6 adet "Mount 1" @ 70 ShA.
//   arka sol/sağ  rapor Z1600 Y2100 X2700  ↔  2×(800,1100,1350) = Z1600 Y2200 X2700
//   ön            rapor Z1600 Y2700 X2100  ↔  aynı takoz 90° DÖNDÜRÜLMÜŞ (X↔Y)
// Z ve X birebir; tek sapma Y'de %4,8 (2200 ↔ 2100) — tablodaki 1100 ya da
// rapordaki 2100 yuvarlanmış olmalı. Döndürme bulgusu önemlidir: MFSim'de takoz
// düğümünün AÇI ALANI YOKTUR, döndürülmüş montaj sx ↔ sy takas edilerek girilir.
//
// ── LMT-1433-37 — 'amc55sha' girdisi ────────────────────────────────────────
// mount-core.js SIPER_EXAMPLE'ın kaynağı ("takoz kataloğu LMT-1433-37 (55 ShA)");
// değerler (1252/1252/640 · 2055/2055/977) A26 aracından. Aracın verdiği ad
// "AMC 55 ShA" bir AMC ürün adı değil (AMC kodu altı hanelidir) → 2026-10-19'da
// "LMT-1433-37 55 ShA" oldu. Anahtar kaldı.
//
// EKLENMEYENLER (veri yok):
//   • LMT-1433-20 — TTAR ölçüm raporunda ön takoz olarak geçiyor ("X yönü
//     yumuşatılmış" varyant), rijitlik verisi hiçbir dokümanda yok.
//
// İnternette bulunmayanlar (2026-10-19): 57RS…, TK035/040/050, LMT-1433 ve
// "Mount 1" firma içi numaralar — adları kaynak belgelerdeki gibi.
// ── maxLoad — TAŞIMA KAPASİTESİ [kg], opsiyonel ─────────────────────────────
// Üretici kataloğunun verdiği en büyük statik EKSENEL (basma, z) yük. Birim
// KİLOGRAM'dır: AMC, Angst+Pfister ve benzeri kataloglar kapasiteyi kg olarak
// yazar ("Max. Load 2.000 kg"), kullanıcı datasheet'ten okuduğu sayıyı çevirmek
// zorunda kalmasın. Kuvvete tek bir yerde dönüşür: F_max = maxLoad · g [N].
//
// FİZİĞE GİRMEZ: çözücü bu alanı görmez, rijitliği ve sehimi değiştirmez.
// Yalnız RAPORLAMA sınırıdır — "bu takoz taşıdığı yükün yüzde kaçında
// çalışıyor" sorusunu cevaplar (Rapor §8.3 Yük (%) sütunu, Sonuçlar'da F(δ)
// kapasite çizgisi ve yorum cümleleri).
//
// YALNIZ ÜRETİCİNİN KATALOĞUNDAN: AMC girdileri sitenin tablosundaki "Max. Load"u
// taşır (js/mount-amc.js). Ötekilerde boş — elimizdeki kaynakların hiçbiri o
// girdiler için kapasite vermiyor, makul bir sayı UYDURULMADI; kapasite
// tanımsızken sütun, çizgi ve cümle hiç görünmez. Kullanıcı datasheet'ten
// okuduğu değeri Takoz panelinden ya da Takoz Özellikleri'nden girer.
//
// ── AMC MECANOCAUCHO® — js/mount-amc.js (148 kod, üreticinin bütün konik aileleri)
// Girdiler veri modülünden üretilir; eski 10 kod (aşağıdaki (A) tablosu ve 137829)
// kütüphanedeki yerinde durur — ilk 24 girdinin sırası taramanın kombinasyon
// sırasıdır. Radyal rijitliği yayımlanmayan kodlarda sx/sy/dx/dy TAHMİNİ (Canlı Not
// 113: AMC-EO'nun radyal/eksenel oranı, js/mount-amc.js → RADYAL TAHMİN): tip çözülür,
// girilen değer tahminin yerine geçer, tahminli tip taramaya aday olmaz
// (_mntLibTahmin); kz'si olmayan DSM kodları EKSİK (_mntLibTam).
var _MNT_AMC = (typeof VE_MNT_AMC !== 'undefined') ? VE_MNT_AMC
  : ((typeof require === 'function') ? require('./mount-amc.js') : null);
// ── ANGST+PFISTER APSOvib® — js/mount-ap.js (86 kod: konik · HD konik · H-takoz ·
// marine · jeneratör). Dinamik rijitlik yayımlanmıyor: dx/dy/dz boş, tip EKSİK
// (Takoz Özellikleri'nden tamamlanır); girdiler AMC'nin ardına, ailenin sırasıyla.
var _MNT_AP = (typeof VE_MNT_AP !== 'undefined') ? VE_MNT_AP
  : ((typeof require === 'function') ? require('./mount-ap.js') : null);
// ── MARKA (kullanıcı 2026-11-10, Canlı Not 106: *"Takoz tiplerini markalarına
// göre kategorize edelim. Kullanıcı marka seçsin, ona göre seçeneklerini
// seçsin."*) ───────────────────────────────────────────────────────────────
// Her katalog girdisi bir `marka` taşır; Takoz Özellikleri önce markayı, sonra
// o markanın tiplerini sorar. Kaynak:
//   • AMC Mecanocaucho — üreticinin altı haneli kodu ("(AMC 137963)"); girdiler
//     js/mount-amc.js'ten markasıyla gelir (VE_MNT_AMC.girdi).
//   • Angst+Pfister — LMT-1433-xx ve "Mount 1": BMC FEA raporlarının teknik
//     resimleri A+P logosu taşıyor (KATALOGLA TEYİT EDİLMEDİ, yukarıdaki
//     LMT-1433-00 bloğu); marka yanlışsa düzeltme TEK alan: `marka`.
//   • Diğer — 57RS… ve TK035/040/050: kaynak belgelerde marka yazılı değil.
// Özel takozların markası "Özel takozlar" (listede katalog markalarından sonra).
// Anahtarlar ve adlar DEĞİŞMEZ (kayıtlı projeler). Kapı: mount-library-marka.test.js.
var VE_MNT_LIB_MARKALAR = ['AMC Mecanocaucho', 'Angst+Pfister', 'Diğer'];
var VE_MNT_LIB_MARKA_OZEL = 'Özel takozlar';
var VE_MOUNT_LIBRARY = {
  'amc55sha':         { marka:'Angst+Pfister', name:'LMT-1433-37 55 ShA',               sx:1252, sy:1252, sz:640,  dx:2055, dy:2055, dz:977 },
  '57RS313773':       { marka:'Diğer', name:'57RS313773 (A26)',          sx:334,  sy:334,  sz:2300, dx:435,  dy:435,  dz:3000 },
  '57RS313774':       { marka:'Diğer', name:'57RS313774 (A26)',          sx:1200, sy:1200, sz:2400, dx:950,  dy:950,  dz:1900 },
  '57RS313773-sr116': { marka:'Diğer', name:'57RS313773 (ASR-SR-116)',   sx:462,  sy:462,  sz:2200, dx:630,  dy:630,  dz:3000 },
  '57RS313774-sr116': { marka:'Diğer', name:'57RS313774 (ASR-SR-116)',   sx:1045, sy:1045, sz:1800, dx:1045, dy:1045, dz:1800 },
  // TK035 · 57RS328045 · 35 ShA — MLMT-0216-33-TK035 (curve-fit, R²≈0.997)
  'TK035': { marka:'Diğer', name:'TK035 35 ShA (57RS328045)', sx:415, sy:210, sz:192, dx:535, dy:250, dz:230,
    fits:{
      x:{ form:'poly', k0:415, c3:-2.44, c5:0.0201 },
      y:{ form:'poly', k0:210, c3:-1.28, c5:0.0169 },
      z:{ form:'asym', comp:{k0:367, xmax:5.60}, ext:{k0:361, c3:2.20} }   // basma sert (rasyonel), geri-gelme kübik
    } },
  // TK040 · 57RS329001M · 45 ShA — MLMT-0216-33-TK040 (curve-fit, R²≈0.99)
  'TK040': { marka:'Diğer', name:'TK040 45 ShA (57RS329001M)', sx:515, sy:260, sz:242, dx:740, dy:355, dz:335,
    fits:{
      x:{ form:'poly', k0:515, c3:-3.29, c5:0.0311 },
      y:{ form:'poly', k0:260, c3:-2.78, c5:0.0269 },
      z:{ form:'asym', comp:{k0:387, xmax:5.66}, ext:{k0:400, c3:2.06} }
    } },
  // TK050 · 57RS326612M · 50 ShA — MLMT-0216-33-TK050 (curve-fit, R²≈0.99)
  'TK050': { marka:'Diğer', name:'TK050 50 ShA (57RS326612M)', sx:665, sy:335, sz:290, dx:1165, dy:590, dz:490,
    fits:{
      x:{ form:'poly', k0:665, c3:-5.85, c5:0.0618 },
      y:{ form:'poly', k0:335, c3:-2.53, c5:0.0249 },
      z:{ form:'asym', comp:{k0:381, xmax:5.02}, ext:{k0:374, c3:2.11} }
    } },
  // ── (A) AMC MECANOCAUCHO® konik takozlar — burada YAZILMAZ: js/mount-amc.js
  // (EO tablosu) üretir ve bu noktaya koyar (aşağıda, sözlüğün hemen ardından).
  // dx/dy/dz = sx/sy/sz × cdyn/cstat. Oyuklu konide sx ≠ sy KASITLI (oyuk ekseni
  // = yumuşak eksen y); masif konide kx = ky (üreticinin tablosu da öyle).
  // Cone 121 NP 55 ShA (137829) için nominal radyal veri YOK — girdi (B) BMC 8x8
  // çalışma noktası değerlerini taşır (AMC hesap 13948'den geri çözüm, %65–67 yükte).
  // ── LMT-1433-00 — BMC güç grubu FEA raporlarının takozu ─────────────────
  // TEK RİJİTLİK TABANI: kaynak statik/dinamik AYRIMI YAPMIYOR → sx = dx.
  // Nedeni ve ölçümü için aşağıdaki "LMT-1433-00" blok yorumuna bakın.
  'lmt1433-00-40sh': { marka:'Angst+Pfister', name:'LMT-1433-00 40 ShA', sx:900,  sy:900,  sz:450,  dx:900,  dy:900,  dz:450  },
  'lmt1433-00-55sh': { marka:'Angst+Pfister', name:'LMT-1433-00 55 ShA', sx:1500, sy:1500, sz:750,  dx:1500, dy:1500, dz:750  },
  'lmt1433-00-70sh': { marka:'Angst+Pfister', name:'LMT-1433-00 70 ShA', sx:2500, sy:2500, sz:1150, dx:2500, dy:2500, dz:1150 },
  // ── "Mount 1" — aynı raporun ÖTEKİ standart parçası, PARÇA NUMARASI YOK ──
  // Ad kaynaktaki etiketin kendisidir ("Mount 1"); numara bulununca girdi adı
  // düzeltilmeli (anahtarlar kalır). LMT-1433-00'dan farklı olarak radyal
  // ANİZOTROPİK: sx > sy. Tek taban (sx = dx), gerekçesi LMT-1433-00 ile aynı.
  'bmc-mount1-40sh': { marka:'Angst+Pfister', name:'Mount 1 40 ShA', sx:800,  sy:450,  sz:300, dx:800,  dy:450,  dz:300 },
  'bmc-mount1-55sh': { marka:'Angst+Pfister', name:'Mount 1 55 ShA', sx:1000, sy:750,  sz:500, dx:1000, dy:750,  dz:500 },
  'bmc-mount1-70sh': { marka:'Angst+Pfister', name:'Mount 1 70 ShA', sx:1350, sy:1100, sz:800, dx:1350, dy:1100, dz:800 }
};
// AMC girdileri: eski 10 kod TK050'nin ardındaki yerine (sözlüğün sırası korunur),
// kalan kodlar sona — ailenin, tipin, sertliğin sırasıyla.
(function(L, A, P){
  if(!A) return;
  var k=Object.keys(L), yer=k.indexOf('TK050')+1, bas={}, son={};
  k.slice(0, yer).forEach(function(x){ bas[x]=L[x]; });
  A.ESKI.forEach(function(kod){ bas['amc'+kod]=A.girdi(kod); });
  k.slice(yer).forEach(function(x){ bas[x]=L[x]; });
  A.kodlar().forEach(function(kod){ if(!bas['amc'+kod]) son['amc'+kod]=A.girdi(kod); });
  if(P) P.kodlar().forEach(function(kod){ son['ap'+kod]=P.girdi(kod); });
  k.forEach(function(x){ delete L[x]; });
  Object.keys(bas).forEach(function(x){ L[x]=bas[x]; });
  Object.keys(son).forEach(function(x){ L[x]=son[x]; });
})(VE_MOUNT_LIBRARY, _MNT_AMC, _MNT_AP);

// ─── ETKİN KÜTÜPHANE (gömülü + gömülü override + kullanıcı tanımlı) ───────────
// Gömülü katalog (VE_MOUNT_LIBRARY) fabrika varsayılanıdır ve ÇALIŞMA ANINDA
// DEĞİŞMEZ (asla mutasyona uğramaz). "Takoz Özellikleri" (mnt-library) düğümleri:
//   node.data.mounts    → kullanıcı tanımlı takozlar (Özel grup)
//   node.data.overrides → gömülü takozlara alan-bazlı düzenleme (fabrikanın üzerine)
// Bu üç kaynak burada birleştirilir. Takoz panelinin kütüphane açılır listesi ve
// veMntApplyLib doğrudan VE_MOUNT_LIBRARY yerine bu birleşik haritayı okur —
// böylece kullanıcının eklediği/değiştirdiği takozlar da yansır. Override'lar
// alan-bazlıdır: düzenlenmemiş alanlar fabrika değerini izler; ↺ ile override
// silinince gömülü girdi fabrikaya döner. Girdi biçimi (birleşik):
//   { key, name, sx, sy, sz, dx, dy, dz, builtin, overridden }.
function veMntGetLibraryMap(){
  var map={};
  var cv=function(a){ return (Array.isArray(a)&&a.length>=2)?a:null; };   // geçerli eğri (≥2 nokta) veya null
  Object.keys(VE_MOUNT_LIBRARY).forEach(function(k){
    var m=VE_MOUNT_LIBRARY[k], c=m.curves||{}, f=m.fits||{};
    map[k]={ key:k, name:m.name, marka:(m.marka||'Diğer'), sx:m.sx, sy:m.sy, sz:m.sz, dx:m.dx, dy:m.dy, dz:m.dz, builtin:true, overridden:false,
      maxLoad:(m.maxLoad!==undefined?m.maxLoad:null),        // taşıma kapasitesi [kg] (opsiyonel)
      fitX:f.x||null, fitY:f.y||null, fitZ:f.z||null,       // fabrika analitik fit (varsa)
      curveX:cv(c.x), curveY:cv(c.y), curveZ:cv(c.z),       // ya da nokta tablosu (varsa)
      amc:m.amc||null, ap:m.ap||null,                       // üreticinin künyesi (js/mount-amc.js · js/mount-ap.js)
      tahmin:(m.tahmin && m.tahmin.length) ? m.tahmin.slice() : null };   // tahmini alanlar (Canlı Not 113)
  });
  (typeof nodes!=='undefined'?nodes:[]).forEach(function(n){
    var def=_mntDef(n)||{};
    if(!def.isMountLibrary || !n.data) return;
    // Gömülü override'ları uygula (fabrika değerinin üzerine, alan-bazlı). Eğriler
    // fabrikadan gelir (override edilmez) — base'ten aynen taşınır.
    var ov=n.data.overrides;
    if(ov && typeof ov==='object'){
      Object.keys(ov).forEach(function(k){
        var base=map[k]; if(!base) return;                // yalnız var olan gömülü girdiler
        var o=ov[k]||{}; if(!o || Object.keys(o).length===0) return;
        var pick=function(f){ return (o[f]!==undefined && o[f]!==null && o[f]!=='') ? (f==='name'?o[f]:_mntNum(o[f])) : base[f]; };
        // Girilen alan tahmin değildir; kalan tahmin girilen değerden yeniden kurulur
        // (kz girildiyse kx = oran·kz, kx girildiyse dinamiği kx × din./stat.).
        var tah=(base.tahmin||[]).filter(function(f){ return !(o[f]!==undefined && o[f]!==null && o[f]!==''); });
        map[k]={ key:k, name:pick('name'), marka:base.marka, sx:pick('sx'), sy:pick('sy'), sz:pick('sz'),
          dx:pick('dx'), dy:pick('dy'), dz:pick('dz'), builtin:true, overridden:true,
          maxLoad:pick('maxLoad'),
          fitX:base.fitX, fitY:base.fitY, fitZ:base.fitZ,
          curveX:base.curveX, curveY:base.curveY, curveZ:base.curveZ, amc:base.amc, ap:base.ap,
          tahmin:tah.length ? tah : null };
        var Ure=base.amc ? _MNT_AMC : (base.ap ? _MNT_AP : null);
        if(tah.length && Ure && Ure.tamamla) Ure.tamamla(map[k]);
      });
    }
    // Kullanıcı tanımlı takozlar (Özel grup) — 3-eksen eğri (curveX/Y/Z) taşıyabilir.
    if(Array.isArray(n.data.mounts)){
      n.data.mounts.forEach(function(e){
        if(!e || !e.key) return;
        map[e.key]={ key:e.key, name:(e.name||'Özel Takoz'), marka:VE_MNT_LIB_MARKA_OZEL,
          sx:_mntNum(e.sx), sy:_mntNum(e.sy), sz:_mntNum(e.sz),
          dx:_mntNum(e.dx), dy:_mntNum(e.dy), dz:_mntNum(e.dz), builtin:false,
          maxLoad:(e.maxLoad===undefined||e.maxLoad===null||e.maxLoad==='')?null:_mntNum(e.maxLoad),
          // Opsiyonel nonlineer yasa (takoz tipinin özelliği) — Takoz'a uygulanınca kopyalanır.
          fitX:(e.fitX||null), fitY:(e.fitY||null), fitZ:(e.fitZ||null),
          curveX:cv(e.curveX), curveY:cv(e.curveY), curveZ:cv(e.curveZ) };
      });
    }
  });
  return map;
}
// Girdileri markaya göre gruplar: [{ ad, girdiler:[…] }] — katalog markaları
// sabit sırada, Özel takozlar sonda; girdisiz marka listede yok. Takoz
// Özellikleri'nin Marka listesi ve Takoz penceresinin tip listesi AYNI
// gruplamadan okur; marka içinde sıra _mntLibSirali'den (AMC: aile · tip · sertlik).
function veMntLibMarkalar(girdiler){
  var out=[], L=_mntLibSirali(girdiler||[]);
  VE_MNT_LIB_MARKALAR.concat([VE_MNT_LIB_MARKA_OZEL]).forEach(function(ad){
    var g=L.filter(function(e){ return e.marka===ad; });
    if(g.length) out.push({ ad:ad, girdiler:g });
  });
  return out;
}
function veMntGetLibraryList(){
  var map=veMntGetLibraryMap(), out=[];
  Object.keys(map).forEach(function(k){ out.push(map[k]); });
  return out;
}
// Tip TAM mı: altı rijitliğin hepsi > 0 (çözücünün kuralı). AMC'nin radyal değerini
// yayımlamadığı kodlar tahminle tamdır (Canlı Not 113); eksik yalnız kz'si olmayan
// (DSM) ya da Takoz Özellikleri'nde boşaltılan tip.
function _mntLibTam(e){
  return !!e && ['sx','sy','sz','dx','dy','dz'].every(function(f){ return _mntNum(e[f], 0)>0; });
}
// Tipin TAHMİNİ alanları (js/mount-amc.js → RADYAL TAHMİN · js/mount-ap.js → DİNAMİK TAHMİN):
// girilen değer listeden düşer. Tahminli tip çözülür; katalog taramasına aday olmaz
// (cp-mount-param.js → _mntParamAdaylar).
function _mntLibTahmin(e){
  return (e && Array.isArray(e.tahmin)) ? e.tahmin : [];
}
// Tahminin adı: AMC'de radyal (hidrolikte dinamik de), A+P'de dinamik.
function _mntLibTahminAdi(e){
  var T=_mntLibTahmin(e), r=T.indexOf('sx')>=0 || T.indexOf('sy')>=0;
  return r ? (T.indexOf('dz')>=0 ? 'Radyal ve dinamik tahmini' : 'Radyal tahmini') : 'Dinamik tahmini';
}
// Tahminin künyesi. AMC (radyal): "kz × x 2,12 · y 1,39 · Cone 38, 40–60 ShA" (aynı tipin
// ölçülmüş sertlikleri arası) · "kz × 2,44 · Solid cone, 4 tip" (ailenin ölçülmüş tipleri) ·
// "kz × 1,98 · 7 tipin medyanı", sonda ölçümün belgesi (AMC-EO · AMC çizimi). A+P (dinamik):
// "statik × 1,6 · 60 ShA, (Sh + 20)/50 · AMC NR koniler" · "statik × 1,52 · AMC-EO, 9 NR kodun medyanı".
function _mntLibTahminKunye(e){
  var D=e && e.ap && e.ap.dinamik;
  if(D) return 'statik × '+_mntS(D.din,2)+' · '+(D.tur==='sertlik'
    ? veSayi(D.sh,0)+' ShA, (Sh + 20)/50 · AMC NR koniler'
    : 'AMC-EO, '+D.n+' NR kodun medyanı');
  var R=e && e.amc && e.amc.radyal; if(!R) return '';
  var oran=(Math.abs(R.x-R.y)<5e-4) ? _mntS(R.x,2) : 'x '+_mntS(R.x,2)+' · y '+_mntS(R.y,2);
  var K=R.kaynak||{}, sh=K.sh||null;
  var kay=K.tur==='tip' ? K.ad+(sh ? ', '+sh.map(function(v){ return veSayi(v,0); }).join('–')+' ShA' : '')
        : K.tur==='aile' ? K.ad+', '+K.n+' tip' : K.n+' tipin medyanı';
  return 'kz × '+oran+' · '+kay+' · '+((K.belge && K.belge.length) ? K.belge.join(' · ') : 'AMC-EO');
}
// Listelerin sırası: üretici veritabanı dışı katalog kendi sırasıyla, sonra AMC ve
// A+P kodları ailenin, tipin, sertliğin sırasıyla (kütüphanenin iç sırası taramanın
// kombinasyon sırası).
function _mntLibSirali(list){
  var yer={};
  (_MNT_AMC ? _MNT_AMC.kodlar() : []).forEach(function(k, i){ yer['amc'+k]=i; });
  (_MNT_AP ? _MNT_AP.kodlar() : []).forEach(function(k, i){ yer['ap'+k]=100000+i; });
  var id=function(e){ return e.amc ? 'amc'+e.amc.kod : (e.ap ? 'ap'+e.ap.kod : null); };
  var ure=list.filter(function(e){ return yer[id(e)]!==undefined; });
  var obur=list.filter(function(e){ return yer[id(e)]===undefined; });
  ure.sort(function(a, b){ return yer[id(a)]-yer[id(b)]; });
  return obur.concat(ure);
}

// Otomatik yük durumları — araç yük kitabı g-faktörleri (a_x, a_y, a_z magnitüd;
// yön MFSim konvansiyonuyla işaretlenir: frenleme −x, yanal +y, düşey −z; a_z
// yerçekimi DAHİL toplam düşey g). n vektörü çekirdeğe SI olarak gider; tork
// durumları (Forward/Reverse) ayrıca _mntTorqueCases ile eklenir → 14 senaryo.
//
// g-seviyeleri:
//   • Cornering 0.6g, Brake-in-Turn 0.4g (boyuna+yanal), Max Bump/Pothole 3.5g düşey,
//   • Kerb Strike 1.55g yanal (bordür darbesi); a_y İŞARETİ cornering'in TERSİDİR
//     (Kerb sol = −1.55, cornering sol = +0.6), Max Rebound +1g (droop/ekstansiyon).
// L/R varyantları a_y işaretiyle ayrışır. Büyük sehimli satırlar (Max Bump, Pothole,
// Reverse) ±15 mm metal-metal durdurucuyla klipslenir (solveCaseStop, F4);
// çözücü useStop=true ile çağrılır.
//
// ÇEKİRDEK DÖRTLÜNÜN KAYNAĞI: "Maks. Tork, 3.5 Düşey, 1g yanal ve 1g boyuna
// yükleme koşulları kontrol edilmelidir" — MSB Tank Taşıyıcı Araç motor takoz
// inceleme raporu (Güven YAVUZ, 11.03.2019) "Hedef Kriterleri" sayfası. Aynı
// dörtlü BMC R&D FEA raporunda da hesaplanmıştır (Onur GÖR, 02.10.2018 / V01
// 12.02.2019) — "Max. Displacement Results" tablosu, Konsept 2 · LMT-1433-00:
//   motor 1266 kg 55 ShA → Z(1g) 5,3 · Z(3,5g) 15 · X(1g) 3,3 · Y(1g) 4,5 · tork 2,5 mm
//   motor 1602 kg 55 ShA → 5,8 · 17,5 · 4,0 · 5,8 · 2,5 mm
//   motor 1602 kg 65 ShA → 4,0 · 11,8 · 2,6 · 3,7 · 1,6 mm
// ±15 mm metal-metal durdurucu eşiği de bu tabloyla aynı mertebededir (3,5g
// düşeyde 15–17,5 mm). Diğer satırlar (Cornering, Kerb Strike, Pothole, Rebound)
// bu dörtlünün ÜSTÜNE eklenen genel araç yük kitabıdır, o raporlarda yoktur.
var MNT_AUTO_CASES = [
  { name:'Static',            n:[ 0,    0,   -1  ], T:[0,0,0] }, // 1g düşey
  { name:'Max Bump',          n:[ 0,    0,   -3.5], T:[0,0,0] }, // 3.5g düşey → klips
  { name:'Braking',           n:[-1,    0,   -1  ], T:[0,0,0] }, // 1g boyuna (fren)
  { name:'Acceleration',      n:[ 1,    0,   -1  ], T:[0,0,0] }, // 1g boyuna (hızlanma)
  { name:'Cornering Left',    n:[ 0,    0.6, -1  ], T:[0,0,0] }, // 0.6g yanal (sol)
  { name:'Cornering Right',   n:[ 0,   -0.6, -1  ], T:[0,0,0] }, // 0.6g yanal (sağ)
  { name:'Brake in Turn L',   n:[-0.4,  0.4, -1  ], T:[0,0,0] }, // 0.4g fren+yanal (sol)
  { name:'Brake in Turn R',   n:[-0.4, -0.4, -1  ], T:[0,0,0] }, // 0.4g fren+yanal (sağ)
  { name:'Pothole Braking',   n:[-3,    0,   -3.5], T:[0,0,0] }, // çukur+fren → klips
  { name:'Kerb Strike L',     n:[ 0,   -1.55,-1  ], T:[0,0,0] }, // 1.55g yanal bordür (sol) — işaret cornering'in TERSİ
  { name:'Kerb Strike R',     n:[ 0,    1.55,-1  ], T:[0,0,0] }, // 1.55g yanal bordür (sağ)
  { name:'Max Rebound',       n:[ 0,    0,    1  ], T:[0,0,0] }  // droop / negatif-g (ekstansiyon)
];

// ── ARACIN İLERİ YÖNÜ · KALDIRIM DARBESİ · TORK YÖNÜ — Çözücü'nün ayarı ──
// (2026-11-02). MNT_AUTO_CASES gövdeye etkiyen yükün yönüdür ve aracın İLERİSİ
// −X, SAĞI +Y olan eksende yazılı (Tulga'nın CAD ekseni). İleri +X olan modelde
// (TTAR) n_x ve n_y çevrilir (Z etrafında 180°); yoksa fren ve viraj yükü ters
// uygulanır. Kaldırım darbesi analize göre: varsayılan 1,55 g virajın tersi
// yönde; TTAR'ın Adams'ı 3,5 g virajla aynı yönde.
// TORK YÖNÜ İLERİ YÖNDEN TÜRETİLMEZ: reaksiyon krankın modeldeki dönüş
// yönünden ve aktarmanın dönüşü çevirip çevirmediğinden gelir. Krank önden
// saat yönünde, motorun önü −X'te, çıkış krankla aynı yönde → Tx = −T_shaft
// (varsayılan: SPEC T5, analitik B1, TTAR'ın Adams'ı). Tulga'nın Adams'ı +X
// (güç grubundaki transfer kutusu dönüşü çeviriyorsa fiziksel karşılığı bu).
// Kapı: mount-arac-ekseni.test.js · mount-adams-tulga.test.js · mount-adams-ttar.test.js.
var MNT_ILERI = '-x', MNT_KALDIRIM_G = 1.55, MNT_KALDIRIM_YON = 'ters', MNT_TORK_YON = '-x';
// İLERİ YÖNÜN ÖNERİSİ — güç grubunun dizilişinden (F048, 2026-11-10). Motorun
// önü (kasnak tarafı) şanzımanın (yoksa transfer kutusunun) karşı yanındadır;
// öneri motorun önü aracın önüne bakar varsayımıyla: motor şanzımandan −X
// taraftaysa ileri −X. YÖN KENDİLİĞİNDEN BELİRLENİR (kullanıcı 2026-11-10, Canlı Not
// 121: *"manuel olarak girdiğimizde de otomatik olarak belirlensin ve bu kısım
// kalksın"*): Çözücü'de Araç ekseni bölümü ve onay YOK. Etkin yön projede yazılıysa
// o (örnekler kendi Adams analizinin yönünü taşır — Siper +X, motorun önü geriye
// bakan araç), değilse dizilişin önerisi, o da yoksa −X; yük kitabının künyesi
// yazar. Komşusu tork yönüdür (F049): ileri yönden türetilmez; projede yazılıysa o,
// değilse −X. Kapı: mount-ileri-oneri.test.js · mount-arac-ekseni.test.js.
var MNT_ILERI_ESIK = 1;   // mm — motor ile şanzımanın X farkı bunun altındaysa öneri yok
function _mntIleriOnerisi(liste){
  var L=liste || (typeof nodes!=='undefined' && Array.isArray(nodes) ? nodes : []);
  var bul=function(tip){ for(var i=0;i<L.length;i++){ var n=L[i];
    if(n && n.type===tip && n.data && Number.isFinite(_mntNum(n.data.cgx, NaN))) return n; } return null; };
  var m=bul('mnt-motor'), s=bul('mnt-gearbox') || bul('mnt-transfer');
  if(!m || !s) return null;
  var mx=_mntNum(m.data.cgx), sx=_mntNum(s.data.cgx);
  if(!(Math.abs(sx-mx)>=MNT_ILERI_ESIK)) return null;
  return { ileri:(mx<sx ? '-x' : '+x'), motorX:mx, arkaX:sx, arka:s.type };
}
function _mntIleriOnayli(d){ return !!d && (d.ileri==='+x' || d.ileri==='-x'); }
// TORK YÖNÜ TRANSFERİN DÜZENİNDEN (F049, 2026-11-11). İleri vites reaksiyonu
// krankın dönüşünün tersidir: krank önden saat yönünde → ω motorun önünden
// arkasına, reaksiyon motorun ÖNÜ yönünde (motorun önü −X'te → −X). Transfer
// Kutusu'nun çıkışı krankın tersine dönüyorsa (`donus` 'ters') yön çevrilir.
// Motorun önü dizilişten (_mntIleriOnerisi), yoksa −X. Öncelik: transferde
// yazılı dönüş → projede yazılı eski `torkYon` (Çözücü'de seçici yokken
// kaydedilmiş projeler) → dizilişin türettiği (dönüş krankla aynı).
// Kapı: mount-tork-yonu.test.js · mount-adams-tulga.test.js.
var MNT_DONUS = 'ayni';
function _mntTorkOnerisi(liste){
  var L=liste || (typeof nodes!=='undefined' && Array.isArray(nodes) ? nodes : []);
  var t=null;
  for(var i=0;i<L.length;i++){ if(L[i] && L[i].type==='mnt-transfer'){ t=L[i]; break; } }
  var don=t && t.data && t.data.donus, yazili=(don==='ayni' || don==='ters');
  var O=_mntIleriOnerisi(L), on=O ? O.ileri : MNT_TORK_YON;
  var ters=yazili ? don==='ters' : MNT_DONUS==='ters';
  return { torkYon:(ters ? (on==='+x' ? '-x' : '+x') : on), yazili:yazili, donus:(yazili ? don : MNT_DONUS), dizilis:!!O };
}
// Seçicinin gösterdiği dönüş: ETKİN tork yönünü veren dönüş (eski projenin
// yazılı tork yönü dâhil — seçici başka, hesap başka yön söylemesin).
function _mntDonusEtkin(liste){
  var L=liste || (typeof nodes!=='undefined' && Array.isArray(nodes) ? nodes : []);
  var T=_mntTorkOnerisi(L);
  if(T.yazili) return T.donus;
  var cz=null;
  for(var i=0;i<L.length;i++){ if(L[i] && L[i].type==='mnt-solver'){ cz=L[i]; break; } }
  var ty=cz && cz.data && cz.data.torkYon;
  if(ty!=='+x' && ty!=='-x') return T.donus;
  return ty===T.torkYon ? T.donus : (T.donus==='ters' ? 'ayni' : 'ters');
}
function _mntTorkKaynak(d, tork){
  if(tork && tork.yazili) return 'transfer';
  if(d && (d.torkYon==='+x' || d.torkYon==='-x')) return 'proje';
  return (tork && tork.dizilis) ? 'dizilis' : 'varsayilan';
}
function _mntYonAyari(d, oneri, tork){
  d = d || {};
  var g = _mntNum(d.kaldirimG, NaN);
  var xx = function(v, vars){ return (v==='+x' || v==='-x') ? v : vars; };
  var oy = oneri && (oneri.ileri==='+x' || oneri.ileri==='-x') ? oneri.ileri : MNT_ILERI;
  return { ileri: xx(d.ileri, oy),
           kaldirimG: (Number.isFinite(g) && g>0) ? g : MNT_KALDIRIM_G,
           kaldirimYon: (d.kaldirimYon==='ayni' || d.kaldirimYon==='ters') ? d.kaldirimYon : MNT_KALDIRIM_YON,
           torkYon: (tork && tork.yazili) ? tork.torkYon : xx(d.torkYon, tork ? tork.torkYon : MNT_TORK_YON) };
}
// Aracın ekseninde (ileri −X) yazılı yük n → modelin ekseni
function _mntYonN(n, yon){
  return (yon && yon.ileri==='+x') ? [-n[0], -n[1], n[2]] : [n[0], n[1], n[2]];
}
// Tork reaksiyonunun işareti: Tx = s · T_shaft (ileri vites momentinin yönü)
function _mntTorkIsareti(yon){ return (yon && yon.torkYon==='+x') ? 1 : -1; }
// TEK ÜRETİCİ — çözücünün yük kitabı: g-durumları (kaldırım ayarlı, yön
// çevrilmiş) + tork durumları. Rapor, Çözücü'nün tablosu, parametrik analiz ve
// sihirbaz hep buradan okur.
function _mntYukDurumlari(gather){
  var yon=(gather && gather.yon) || _mntYonAyari();
  var kL=(yon.kaldirimYon==='ayni' ? 1 : -1)*yon.kaldirimG;
  return MNT_AUTO_CASES.map(function(c){
    var n=c.n;
    if(c.name==='Kerb Strike L') n=[n[0], kL, n[2]];
    else if(c.name==='Kerb Strike R') n=[n[0], -kL, n[2]];
    return { name:c.name, n:_mntYonN(n, yon), T:c.T.slice() };
  }).concat(_mntTorqueCases(gather && gather.torque, yon));
}

// ── Şok darbesi varsayılanı ─────────────────────────────────────────────────
// AMC Mecanocaucho raporlarının kullandığı darbe: 3 g tepe, 20 ms süre.
// Yük durumlarından FARKLI bir şeydir — onlar yarı-statik ivme katsayısı,
// bu ise ZAMANA BAĞLI bir darbe (yarım sinüs). Aynı 3,5 g'lik çukur yük
// durumu ile karıştırılmasın: orada sonuç tek bir denge hâli, burada bir
// salınım geçmişi.
var MNT_SHOCK_G = 3, MNT_SHOCK_MS = 20;

// ════════════════════════════════════════════════════════════════════════════
//  ANA MODÜL — ALT-SİSTEM (SUBSYSTEM) DÜĞÜMÜ  (arac-performans kalıbı)
// ════════════════════════════════════════════════════════════════════════════
// "Takoz Çökme-Titreşim" ana bileşen listesindeki TEK giriştir (Alt Modüller).
// Ana canvas'ta tek blok; çift tıkla → kendi İÇ TOPOLOJİSİNE girilir. Alt
// bileşenler (Motor/Şanzıman/Şaft/Braket/Kütle/Takoz/Çözücü) YALNIZ orada görünür
// (sidebar 'takoz' modu) ve normal sürükle-bağla ile kurulur. "← Ana Topolojiye
// Dön" ile çıkılır. Ana canvas makinesi (topology.js) aynen yeniden kullanılır:
// girişte ebeveyn durumu saklanır, canvas alt-topoloji ile değiştirilir; çıkışta
// alt-topoloji node.data.subTopology'ye yazılır. Kaydet öncesi veSaveActiveTabState
// → veMntCollapseToRoot ile köke çöker.
var veMntStack = [];
var _veMntBusy = false;

// MODÜL KARTI (kök tuvalde, tek tık) — alt topolojinin İÇERİĞİ ve MODELİ,
// açmadan. FEAD'in modül kartıyla aynı kalıp: İçerik · Model bölümleri, sağ
// sütunda "Alt topolojiyi aç". Model sayıları alt topolojinin KAYITLI
// listesinden, çözücünün AYNI toplayıcısıyla (_mntGatherForSolver(…, liste))
// — açıkken okunacak CG ile aynısı. Sonuç yok (2026-10-16: yalnız raporda).
function getMntModulePropertiesHTML(node){
  var sub = node && node.data && node.data.subTopology;
  var liste = (sub && Array.isArray(sub.nodes)) ? sub.nodes : [];
  var nBag = (sub && Array.isArray(sub.connections)) ? sub.connections.length : 0;
  var kurulu = liste.length > 0;
  var say = { govde:0, takoz:0, arac:0 };
  liste.forEach(function(n){
    var d=(n && _mntDef(n)) || {};
    if(d.isMountBody) say.govde++; else if(d.isMount) say.takoz++; else say.arac++;
  });
  // FEAD'in modül kartının grameri: salt okunur alan ızgarası (Kasnak · Gergi
  // · Kayış · Araç ↔ Kütle gövdesi · Takoz · Araç · Bağlantı). Takoz'da
  // bağlantı gerçek bir sayıdır (salt görsel, çözücü tipe göre toplar) —
  // FEAD'de yapısal olarak hep 0 olduğu için kalkmıştı.
  var icerik = kurulu
    ? _mntIzgara(2, _mntOku('Kütle gövdesi', String(say.govde)) + _mntOku('Takoz', String(say.takoz))
                  + _mntOku('Araç', String(say.arac)) + _mntOku('Bağlantı', String(nBag)))
    : _mntNot('Alt topoloji açılmadı.', '');
  icerik = _mntBolum('Bileşenler', kurulu ? liste.length+' bileşen · alt topolojide' : 'alt topolojide', icerik);
  var model = '';
  if(kurulu){
    var g=_mntGatherForSolver(null, liste), mTop=0, mp=null;
    g.components.forEach(function(c){ mTop+=_mntNum(c.mass,0); });
    var C=(typeof veMountCore!=='undefined') ? veMountCore : null;
    if(C && C.mmToM && C.combineMassProps && g.components.length){
      try{ mp=C.combineMassProps(_mntToSI(g, 9.81).components); }catch(e){ mp=null; }
    }
    model = _mntIzgara(1, _mntOku('Toplam kütle <u>[kg]</u>', g.components.length ? _mntS(mTop, 1) : '—'))
      + _mntIzgara(3, ['X','Y','Z'].map(function(A, i){
          return _mntOku('CG · '+A+' <u>[mm]</u>', mp ? _mntS(mp.cg[i]*1000, 1) : '—');
        }).join(''));
    model = _mntBolum('Model', '', model);
  } else {
    model = _mntBolum('Model', '', _mntNot('Model kurulmadı.', ''));
  }
  var yan = vePencereEylem('<button type="button" class="ve-fp-solve" onclick="veMntOpenEditor(\''+node.id+'\')">'
    + veIkon('folder-open')+' Alt topolojiyi aç</button>');
  return _mntPencereKabuk(node, [{ k:'ic', ad:'İçerik', govde:icerik }, { k:'mod', ad:'Model', govde:model }], yan);
}

// REFERANS yerleşim (yerel px) — güç grubunun düzenli üstten-görünüş şeması ve
// analiz araçlarının konumları. Model açılışında bu yerleşimin TAMAMI KURULMAZ
// (boş topolojiyi başlangıç sayfası karşılar). Buradaki koordinatlar (a) Sihirbaz
// bileşeninin konumu ve (b) örnek yüklenince kurulan topolojinin görünür alana
// ortalanması için koordinat çerçevesi olarak kullanılır.
var VE_MNT_STARTER_LAYOUT = [
  // ── Üst şerit: analiz araçları (tek sıra, eşit aralık) ──
  { type:'mnt-library',                        lx:40,  ly:20 },
  { type:'mnt-viewer',                         lx:190, ly:20 },
  { type:'mnt-2dview',                         lx:340, ly:20 },
  { type:'mnt-solver',   name:'Çözücü',         lx:490, ly:20 },
  { type:'mnt-wizard',                         lx:640, ly:20 },
  { type:'mnt-report',                         lx:790, ly:20 },
  // ── Sağ takozlar (şasi sağ tarafı → şemada üstte) ──
  { type:'mnt-mount',    name:'Sağ Yan Takoz',  lx:300, ly:190 },
  { type:'mnt-mount',    name:'Sağ Arka Takoz', lx:480, ly:190 },
  // ── Güç grubu (gövdeler yatay sıra) ──
  { type:'mnt-mount',    name:'Ön Takoz',       lx:60,  ly:320 },
  { type:'mnt-motor',    name:'Motor',          lx:180, ly:308 },
  { type:'mnt-gearbox',  name:'Şanzıman',       lx:320, ly:320 },
  { type:'mnt-transfer', name:'Transfer Kutusu',lx:445, ly:320 },
  { type:'mnt-shaft',    name:'Şaft',           lx:575, ly:320 },
  // ── Sol takozlar (şasi sol tarafı → şemada altta) ──
  { type:'mnt-mount',    name:'Sol Yan Takoz',  lx:300, ly:450 },
  { type:'mnt-mount',    name:'Sol Arka Takoz', lx:480, ly:450 }
];

// Node'a özel ad ata + kanvastaki etiketi güncelle.
function _mntSetNodeName(node, name){
  if(!node || !name) return;
  node.customName = name;
  if(typeof document!=='undefined'){
    var el=document.getElementById(node.id);
    if(el){ var lbl=el.querySelector('.ve-node-label'); if(lbl) lbl.textContent=name; }
  }
}

// Node'u (id ile) topolojiden ve DOM'dan kaldır — bağlantılarını da temizle.
function _mntRemoveNode(id){
  if(typeof connections!=='undefined'){
    connections = connections.filter(function(c){ return c.from!==id && c.to!==id; });
  }
  if(typeof document!=='undefined'){
    var el=document.getElementById(id); if(el) el.remove();
  }
  if(typeof nodes!=='undefined'){
    nodes = nodes.filter(function(n){ return n.id!==id; });
  }
}

// BAŞLANGIÇ SİHİRBAZI BİLEŞENİ YOKSA EKLE — örnek yükleyicisinin yardımcısı (örneğin
// JSON'u onu taşımayabilir). Referans yerleşimdeki yuvasına konur; örnek güç grubunu
// sol-orta bölgeye kurduğundan çakışmaz. Kalkan "Başlangıç ve Örnekler" bileşeninin
// (`mnt-example`, Canlı Not 110) yerini tutar: örnek listesi başlangıç sayfasında, model
// kurulduktan sonra sihirbaza bu bileşenle dönülür.
//
// AÇILIŞ BUNU ÇAĞIRMAZ (2026-10-14, kullanıcı: *"FEAD modülünün başlangıç ekranı çok
// güzel, aynı onun gibi bir ekran istiyorum"*): boş bir Takoz topolojisini BAŞLANGIÇ
// SAYFASI karşılar (js/cp-mount-baslangic.js). Bileşen kendiliğinden kurulsaydı sayfanın
// "model boş" sorusu bir düğümle cevaplanmış olurdu; sayfa onu ayrıca "boş" sayar.
function veMntPopulateStarter(){
  if(typeof createNode!=='function') return [];
  var base = (typeof veArrangeModuleBase==='function')
    ? veArrangeModuleBase(VE_MNT_STARTER_LAYOUT.map(function(it){ return {lx:it.lx, ly:it.ly}; }))
    : { x:3000, y:3000 };
  var slot = VE_MNT_STARTER_LAYOUT.find(function(it){ return it.type==='mnt-wizard'; }) || { lx:640, ly:20 };
  var created=[];
  var before=nodes.length;
  createNode('mnt-wizard', base.x+slot.lx, base.y+slot.ly);
  if(nodes.length>before){
    var n=nodes[nodes.length-1];
    if(slot.name) _mntSetNodeName(n, slot.name);
    created.push(n);
  }
  if(typeof updateAllConnections==='function') updateAllConnections();
  return created;
}

// ── ANALİZ ARAÇLARI — referans yerleşimin üst şeridi ────────────────────────
// Kütle ve takoz dışındaki Takoz düğümleri. "Boş kanvas" kapısı ve sihirbazın
// "Modeli kur"u bu listeyi kurar: EKSİK olanı ekler, var olanı ikinci kez
// kurmaz — iki Çözücü olsaydı hangisinin sonucu yayınladığı belirsiz kalırdı.
// Liste VE_MNT_STARTER_LAYOUT'un üst şeridinden TÜRER (ikinci bir liste yok).
var VE_MNT_ARAC_TIPLERI = VE_MNT_STARTER_LAYOUT
  .filter(function(it){ return it.ly===20; })
  .map(function(it){ return it.type; });
// `base` (ops.): yerleşim tabanı — verilmezse şerit görünür alanın ortasına.
// Döner: kurulan düğümler.
function _mntAracGaranti(base){
  if(typeof createNode!=='function' || typeof nodes==='undefined') return [];
  var serit = VE_MNT_STARTER_LAYOUT.filter(function(it){ return VE_MNT_ARAC_TIPLERI.indexOf(it.type)>=0; });
  if(!base){
    base = (typeof veArrangeModuleBase==='function')
      ? veArrangeModuleBase(serit.map(function(it){ return {lx:it.lx, ly:it.ly}; }))
      : { x:3000, y:3000 };
  }
  var created=[];
  serit.forEach(function(it){
    if(nodes.some(function(n){ return n.type===it.type; })) return;
    var once=nodes.length;
    createNode(it.type, base.x+it.lx, base.y+it.ly);
    if(nodes.length>once){
      var n=nodes[nodes.length-1];
      if(it.name) _mntSetNodeName(n, it.name);
      created.push(n);
    }
  });
  return created;
}

// TOPLU KURULUMDAN SONRA SEÇİM BIRAKILIR. createNode her düğümü bir kare
// SONRA seçiyor (setTimeout) — toplu kurulumun sonunda son kurulan düğüm
// (şeridin sonundaki Rapor) seçili kalıyordu; seçim kullanıcının değil.
function _mntSecimiBirak(){
  if(typeof setTimeout!=='function' || typeof clearSelection!=='function') return;
  setTimeout(function(){ clearSelection(); }, 40);
}

// BOŞ KANVAS — başlangıç sayfasının üçüncü kapısı. Analiz araçlarını kurar;
// kütle gövdelerini ve takozları kullanıcı Bileşenler'den sürükler. Bir eylem
// = bir geri-al adımı (veStateBatch): Ctrl+Z boş topolojiye, yani başlangıç
// sayfasına döner. Döner: kurulan düğümler.
function veMntKanvasBos(){
  if(typeof createNode!=='function') return [];
  var created=[];
  var kur=function(){ created=_mntAracGaranti(); };
  if(typeof veStateBatch==='function') veStateBatch(kur); else kur();
  _mntSecimiBirak();
  if(typeof updateAllConnections==='function') updateAllConnections();
  if(typeof veFitViewToContent==='function') veFitViewToContent({ maxZoom:1 });
  return created;
}

// ÖRNEĞİ ANAHTARIYLA YÜKLE — başlangıç sayfasının örnek satırları. Kayıt girişinde
// JSON topolojisi varsa ondan (birebir), yoksa programatik model kurucusundan.
function veMntOrnekYukle(key){
  if(typeof veMountCore==='undefined' || !key) return false;
  var ex = (veMountCore.getMountExample) ? veMountCore.getMountExample(key) : null;
  if(!ex) return false;
  if(ex.topology){ _mntLoadExampleFromJSON(ex.topology, ex); return true; }
  _mntLoadExampleFromModel(key);
  return true;
}

// YÜKLENEN ÖRNEKTE BİLEŞENLER SÜTUNU KAPALI (kullanıcı 2026-11-05, Canlı Not
// 38: *"Örnek yüklediğim zaman hala 'bileşenler' sütunu açık geliyor. Kapalı
// gelsin"*): sütun daraltılır, açma düğmesi rayda. Tercih yazılmaz
// (Canlı Not 62 — aşağıda); vazgeçilen yükleme daraltmaz. GEÇİŞSİZ ve SIĞDIRMADAN ÖNCE: tuval 220 px genişliyor — geçişle
// ya da sığdırmadan sonra daralsaydı kadraj dar tuvalde kurulur, model sola
// kayık kalırdı.
function _mntOrnekPaletKapat(){ return veMntPaletKapat(); }

// TAKOZ'DA BİLEŞENLER SÜTUNU KAPALI AÇILIR (kullanıcı 2026-11-06, Canlı Not 62:
// *"…modülünü açtığımda, solda bileşenler penceresi otomatik açık olarak geliyor.
// Gelmesin"*; önce yalnız örnek yüklenince kapanıyordu): modüle
// girince sütun GEÇİŞSİZ daralır, kadraj daralmış tuvalde kurulur. Tercih YAZILMAZ —
// öteki modüllerin sütunu kullanıcının tercihinde kalır, Takoz'dan çıkınca tercih geri
// gelir (veMntPaletGeriAc). Kullanıcının açma düğmesi tercihi yine yazar.
var VE_MNT_PALET_ANAHTAR = 'mf-sidebar-collapsed';
var _mntPaletBizim = false;
function veMntPaletKapat(){
  if(typeof document==='undefined' || typeof veToggleSidebar!=='function') return false;
  var sb = document.getElementById('ve-sidebar');
  if(!sb) return false;
  if(sb.classList.contains('ve-sb-collapsed')) return true;
  var tercih = null;
  try { tercih = localStorage.getItem(VE_MNT_PALET_ANAHTAR); } catch(e){}
  sb.classList.add('ve-sb-no-anim');
  veToggleSidebar(true);
  void sb.offsetWidth;                 // genişlik geçişsiz otursun
  sb.classList.remove('ve-sb-no-anim');
  try {
    if(tercih === null) localStorage.removeItem(VE_MNT_PALET_ANAHTAR);
    else localStorage.setItem(VE_MNT_PALET_ANAHTAR, tercih);
  } catch(e){}
  _mntPaletBizim = true;
  return true;
}
// Takoz'dan çıkış: sütunu Takoz daralttıysa ve kullanıcının tercihi açıksa geri açar
function veMntPaletGeriAc(){
  if(!_mntPaletBizim) return false;
  _mntPaletBizim = false;
  if(typeof document==='undefined' || typeof veToggleSidebar!=='function') return false;
  var sb = document.getElementById('ve-sidebar'), tercih = null;
  try { tercih = localStorage.getItem(VE_MNT_PALET_ANAHTAR); } catch(e){}
  if(!sb || !sb.classList.contains('ve-sb-collapsed') || tercih === '1') return false;
  veToggleSidebar(false);
  try { if(tercih === null) localStorage.removeItem(VE_MNT_PALET_ANAHTAR); } catch(e){}   // tercih olduğu gibi
  return true;
}

// Sidebar kapsamını güncelle (takoz iç topolojisi ⇄ ana ekran). Kapsam açık
// alt-sistem stack'lerinden merkezi olarak hesaplanır (bkz. veSyncSidebarScope).
function _veMntSetSidebar(mode){
  if(typeof veSyncSidebarScope==='function'){ veSyncSidebarScope(); return; }
  if(typeof veShowAllSidebarComponents==='function') veShowAllSidebarComponents();
}

// _silent: autosave gibi arka-plan işlemleri köke çöküp (veSaveActiveTabState)
// kullanıcıyı bulunduğu iç topolojiye geri getirirken true geçer; bu görünmez
// geri-girişte toast/animasyon tetiklenmez (breadcrumb ve sidebar yine güncellenir).
function veMntOpenEditor(nodeId, _silent){
  if(_veMntBusy) return;
  if(typeof nodes==='undefined' || typeof veSerializeCurrentState!=='function') return;
  var node = nodes.find(function(n){ return n.id===nodeId; });
  if(!node || node.type!=='mount-analysis') return;
  _veMntBusy=true;
  try {
    if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
    if(typeof veTogglePropertiesPanel==='function') veTogglePropertiesPanel(false);
    var parentState = veSerializeCurrentState();
    veMntStack.push({ nodeId:nodeId, parentState:parentState });
    veClearCanvasDOM();
    veMntPaletKapat();                 // Canlı Not 62: kadraj kurulmadan önce (geçişsiz)
    var sub = node.data && node.data.subTopology;
    if(sub && sub.nodes && sub.nodes.length){
      veLoadTabState({ state: sub });
    } else {
      // BOŞ TOPOLOJİYİ BAŞLANGIÇ SAYFASI KARŞILAR (js/cp-mount-baslangic.js) —
      // düğüm kurulmaz. Sayfa kapsam senkronunda (aşağıda) modele göre açılır.
      // Boş durum geri-al yığınının TABANI: ilk kapı (Boş kanvas · örnek ·
      // sihirbaz) geri alınınca kullanıcı sayfaya döner.
      veLoadTabState({ state: null });
      if(typeof veStateResetBaseline==='function') veStateResetBaseline();
    }
    _veMntSetSidebar('takoz');
  } finally { _veMntBusy=false; }
  if(!_silent && typeof veAnimateCanvasTransition==='function') veAnimateCanvasTransition('enter');
  veMntUpdateBreadcrumb();
}

// _silent: köke çökerken (veMntCollapseToRoot → kaydet/sekme değiştir öncesi) true
// gelir; kullanıcıya görünmeyen bu toplu çıkışta geçiş animasyonu tetiklenmez.
function veMntCloseEditor(_silent){
  if(_veMntBusy) return;
  if(!veMntStack.length) return;
  _veMntBusy=true;
  try {
    if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
    var subState = veSerializeCurrentState();
    // Gömmeden ÖNCE hafiflet (bkz. topology.js veSanitizeEmbeddedState): undo/redo
    // geçmişi + tam simResults gömülünce çarpımsal büyüyüp JSON.stringify'ı
    // "Invalid string length" ile patlatır ve yedek kotasını taşırır.
    if(typeof veSanitizeEmbeddedState==='function') subState = veSanitizeEmbeddedState(subState);
    var ctx = veMntStack.pop();
    var pn = (ctx.parentState.nodes||[]).find(function(n){ return n.id===ctx.nodeId; });
    if(pn){ if(!pn.data) pn.data={}; pn.data.subTopology = subState; }
    veClearCanvasDOM();
    veLoadTabState({ state: ctx.parentState });
    _veMntSetSidebar('performans');
  } finally { _veMntBusy=false; }
  if(!_silent && typeof veAnimateCanvasTransition==='function') veAnimateCanvasTransition('exit');
  veMntUpdateBreadcrumb();
}

function veMntCollapseToRoot(){
  var guard=0;
  while(veMntStack.length && guard++<32){ veMntCloseEditor(true); }
}

// Alt-topoloji çıkış düğmesi — sınır çerçevesinin İÇİNE, sol üst köşeye tutunur
// (arac-performans ile aynı CSS sınıfı ve konumlama mantığı).
function veMntUpdateBreadcrumb(){
  if(typeof document==='undefined') return;
  var el=document.getElementById('ve-mnt-breadcrumb');
  if(veMntStack.length===0){ if(el) el.remove(); return; }
  if(!el){
    el=document.createElement('div');
    el.id='ve-mnt-breadcrumb';
    el.className='ve-arac-breadcrumb';
    // Görünümün (#ve-canvas-wrapper) İÇİNE, transform'lu #ve-canvas'ın DIŞINA —
    // bkz. js/cp-arac-performans.js veAracUpdateBreadcrumb.
    var host=document.getElementById('ve-canvas-wrapper')
          || document.getElementById('ve-split-container')
          || document.querySelector('.ve-canvas-area')
          || document.body;
    host.appendChild(el);
  }
  var depth=veMntStack.length;
  el.innerHTML=
    '<button onclick="veMntCloseEditor()" title="Ana topolojiye dön'
    + (depth>1 ? ' (derinlik '+depth+')' : '') + '">'
    + '<span class="mf-ico mf-ico-chevrons-left" aria-hidden="true"></span>'
    + (depth>1 ? '<i class="ve-bc-depth">'+depth+'</i>' : '')
    + '</button>';
  if(typeof veAnchorBoundaryChip==='function') veAnchorBoundaryChip();
}

// ════════════════════════════════════════════════════════════════════════════
//  KÜTLE GÖVDESİ PANELİ (Motor / Şanzıman / Şaft / Braket / Kütle)
// ════════════════════════════════════════════════════════════════════════════
// Nokta-kütle VARSAYILANI tipe göre: Şaft ince/hafif; PTO ve Pompa parçalarının
// kendi atalet tensörü katalog/CAD verisinde çoğu zaman YOKTUR (ASR-SR-116 Tablo 4
// yalnız kütle+CG verir) → nokta kütle. Grubun ataleti parçaların CG yayılımından
// paralel-eksen teoremiyle zaten doğar. 'PTO Toplam' ise grup ataletini TAŞIR
// (ASR-SR-116 Tablo 3) → nokta kütle DEĞİL.
// Motorun aksesuarları da (Alternatör … Isı Sacı): teknik resim kütle ve
// ağırlık merkezi verir, atalet vermez.
var _MNT_POINTMASS_DEFAULT = { 'mnt-shaft':1, 'mnt-pto':1, 'mnt-pump':1,
  'mnt-alternator':1, 'mnt-alt-bracket':1, 'mnt-ac':1, 'mnt-heat-shield':1 };
function _mntEnsureMassData(node){
  if(!node.data) node.data = {};
  if(node.data.pointMass===undefined) node.data.pointMass = !!_MNT_POINTMASS_DEFAULT[node.type];
  return node.data;
}
// ════════════════════════════════════════════════════════════════════════════
//  PENCERE DİLİ — FEAD'İN KABUĞU, TAKOZ'UN FÖYÜ (2026-10-14)
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı seçimi (tasarım tuvali, üç aday × üç pencere): "Hepsi için B föy
// seçeneği" + C'nin "Güç grubundaki yeri" krokisi. Pencereler müfettiş
// sütununda (sağda) açılır: dar kapta tek sütun, geniş modalde iki sütun.
// Eskiden 8 kütle tipinin hepsi ve Takoz MODAL açılıyordu (altılı ızgarada
// "550.03" 46 px'e sığmıyordu) ve görünüm satır içi `style=` dizelerindeydi.
//
// KABUK FEAD'İNKİYLE AYNI DOM SÖZLEŞMESİ: gövde `ve-fp-panes-<id>`, kategori
// `.ve-fp-kat[data-k]`, eksik bandı `ve-fp-eksik-<id>`. Sözleşme süs değil —
// yerinde tazeleme ve müfettiş, kontrast, sayı taramaları gövdeyi bu
// kimliklerle buluyor. Kategoriler 2026-10-16'dan beri SEKME DEĞİL, tek
// gövdede alt alta (kullanıcı: *"Tek bir pencerede hepsi sığar"*). 'i'
// düğmesinin ipucu da ortak (`.ve-fp-i`, belge düzeyinde dinlenir).
//
// PENCERE HESAPLAMAZ, OKUR: türetilen her sayı çözücünün yolundan gelir
// (_mntGatherForSolver → _mntToSI → çekirdek). Boş alan pencerede de
// çözücüde olduğu gibi 0'dır — ve bu yüzden KATEGORİNİN DURUMUNA yazılır.

// Türkçe sayı, gerçek eksi (−). Sayı değilse '—'.
function _mntS(v, d){
  return (typeof v==='number' && isFinite(v)) ? veSayi(v, d, { eksi:'−' }) : '—';
}
// Simge (Yunan harfi, alt indisli büyüklük) büyük harfe dönmesin — başlık
// satırı `text-transform:uppercase` taşıyor ("δ" "Δ", "n_x" "N_X" olurdu).
function _mntSym(s){ return '<i class="ve-fp-sym">'+s+'</i>'; }
function _mntBos(v){ return v===undefined || v===null || String(v).trim()===''; }
function _mntDugum(id){
  if(typeof nodes==='undefined' || !Array.isArray(nodes)) return null;
  for(var i=0;i<nodes.length;i++){ if(nodes[i] && nodes[i].id===id) return nodes[i]; }
  return null;
}
// Yük durumunun penceredeki KISA adı — dar sütunda raporun uzun adı
// ("Frenlemeli viraj — sol") kırpılıyordu; tam adı `title`da.
var _MNT_DURUM_KISA = {
  'Static':'Statik', 'Max Bump':'Tümsek 3,5g', 'Braking':'Frenleme', 'Acceleration':'Hızlanma',
  'Cornering Left':'Viraj sol', 'Cornering Right':'Viraj sağ',
  'Brake in Turn L':'Fren + viraj sol', 'Brake in Turn R':'Fren + viraj sağ',
  'Pothole Braking':'Çukur + fren', 'Kerb Strike L':'Bordür sol', 'Kerb Strike R':'Bordür sağ',
  'Max Rebound':'Geri esneme', 'Forward Torque':'İleri tork', 'Reverse Torque':'Geri tork'
};
function _mntDurumAdi(name){ return (typeof _mntRepCaseTr==='function') ? _mntRepCaseTr(name) : String(name||''); }
function _mntDurumKisa(name){ return _MNT_DURUM_KISA[name] || _mntDurumAdi(name); }

// ── KATEGORİ DURUMU — FEAD'in dört durumu (ok · eksik · bos · yok) ───────────
// `bant:false` durumu banttan ayırır: bir BULGU (üç durumda çekme) eksik bir
// girdi değildir; "Doldur" bandına girmez.
function _mntDurum(d, yazi, neden, hedef, bant){
  return { d:d, yazi:yazi, neden:neden||'', hedef:hedef||'', bant:(bant!==false) };
}
// EKSİK BANDI — gövdenin üstünde, yalnız eksik varken: sonucu ve oraya giden
// bağlantı. Üretici ORTAK KİTTE (FEAD'in bandıyla aynı DOM ve kimlik).
function _mntEksikBandi(nodeId, kategoriler){
  return vePencereEksikBandi(nodeId, kategoriler, 'veMntEksikGit');
}

// Bandın bağlantısı: kategoriye gider ve eksiğin alanına — durum bir HEDEF
// taşımıyorsa ilk BOŞ girdiye — odaklanır; boş girdi yoksa kategorinin kabına.
// Gövdesi ortak kitte (`vePencereEksikGit`).
function veMntEksikGit(nodeId, k, hedefId){
  return vePencereEksikGit(nodeId, k, hedefId, 'input[type="text"]:not([readonly]):not([disabled])');
}

// PENCERE KABUĞU ORTAK KİTTEN (js/pencere-kabuk.js) — FEAD'in pencereleriyle
// AYNI üretici (kullanıcı, 2026-10-16: *"Tüm programda tek tip bir kozmetik
// yapımız olacak"*). İskelet FEAD'inki: kimlik → eksik bandı → kategoriler
// (TEK GÖVDE, alt alta); `yan` sağ sütun — bağlam (kroki), pencerenin cevabı
// ve eylemi. Uygunluk YOK (2026-10-16: sonuç yalnız raporda); sağ sütunu boş
// pencere tek sütuna iner. Gövdenin üstünde eksik bandından başka bir şey
// durmaz: kroki sağ sütunun başında (FEAD'in bağlam sütunu), Takoz
// Özellikleri'nin seçicisi ilk kategoride. Kapı: tests/unit/pencere-kabuk.test.js.
function _mntPencereKabuk(node, kategoriler, yan){
  return vePencereKabuk(node, kategoriler, yan, {
    sinif:'ve-mnt-pencere', nitelik:' data-mnt-pencere="'+node.id+'"', git:'veMntEksikGit' });
}

// BÖLÜM — başlık çizgisi + içerik (FEAD'in `.ve-fp-sect`'i). `opt.id` +
// `opt.tazele`: bölüm GİRDİ TAŞIMIYORSA bütünüyle yerinde tazelenir;
// `opt.emId`: girdi taşıyan bölümün yalnız künyesi tazelenir; `opt.cozum`:
// bölüm eylemin ÇÖZÜM DURUMUNU söyler (`data-cozum-durumu` — pencerede
// çözümle değişmesine izin verilen tek şey; yalnız Rapor'da).
function _mntBolum(baslik, em, ic, opt){
  opt=opt||{};
  return '<section class="ve-fp-card"'+(opt.id?' id="'+opt.id+'"':'')+(opt.tazele?' data-tazele':'')+(opt.cozum?' data-cozum-durumu':'')+'>'
    + '<div class="ve-fp-sect"><b>'+baslik+'</b>'
    + ((em||opt.emId) ? '<em'+(opt.emId?' id="'+opt.emId+'" data-tazele':'')+(opt.emTam?' title="'+_mntEsc(opt.emTam)+'"':'')+'>'+(em||'')+'</em>' : '')
    + '</div>'+ic+'</section>';
}
function _mntIzgara(k, ic){ return '<div class="ve-fp-grid" style="--fp-k:'+k+';">'+ic+'</div>'; }

// ALAN — etiket üstte, girdi altta (FEAD alan dili). Kimlik ve setter her
// yerde AYNI: `ve-mnt-<alan>-<düğüm>` · veMntSet. Değer MAKİNE biçiminde
// yazılır; Türkçe gösteren sayi-alan.js'tir. `zorunlu`: boşken çözücü 0 alır
// ya da modeli reddeder — alan bunu yer tutucusu ve tonuyla söyler.
function _mntAlan(node, key, etiket, opt){
  opt=opt||{};
  var v=(node.data && node.data[key]!=null) ? node.data[key] : '';
  var zor=!!opt.zorunlu, bos=_mntBos(v);
  return '<label class="ve-fp-f"><span class="ve-fp-l">'+etiket+'</span>'
    + '<input class="ve-fp-inp'+(zor&&bos?' ve-mnt-zor':'')+'" type="text" inputmode="decimal" id="ve-mnt-'+key+'-'+node.id+'"'
    + ' value="'+_mntEsc(v)+'"'+(zor?' data-zorunlu':'')
    + ((opt.ph||zor) ? ' placeholder="'+_mntEsc(opt.ph||'zorunlu')+'"' : '')
    + (opt.ipucu ? ' title="'+_mntEsc(opt.ipucu)+'"' : '')
    + ' onchange="'+(opt.setter||'veMntSet')+'(\''+node.id+'\',\''+key+'\',this.value)"></label>';
}
// OKUNUR DEĞER — düzenlenemez, girdiyle AYNI hizada; oyuk zemin `[readonly]`.
function _mntOku(etiket, deger, opt){
  opt=opt||{};
  return '<label class="ve-fp-f"><span class="ve-fp-l">'+etiket+'</span>'
    + '<input class="ve-fp-inp'+(opt.ton?' ve-fp-inp--ton" data-ton="'+opt.ton:'')+'" value="'+_mntEsc(deger)+'" readonly tabindex="-1"'
    + (opt.id?' id="'+opt.id+'" data-tazele':'')+(opt.ipucu?' title="'+_mntEsc(opt.ipucu)+'"':'')+'></label>';
}
// VARSAYILANLI ALAN — değer alanın KENDİSİ, yer tutucu değil; yanında 'i'
// kaynağını söyler (FEAD kural 43). Boşaltılınca varsayılan DEĞER olarak geri
// gelir: hesaba giren sayı hep görünür. `degis` onchange ifadesidir.
function _mntVarsayilanAlan(node, key, etiket, varsayilan, kaynak, degis){
  var d=node.data||{}, elle=!_mntBos(d[key]);
  var id='ve-mnt-'+key+'-'+node.id;
  var t=elle ? 'Girilen değer · varsayılan '+_mntS(varsayilan)
             : 'Varsayılan — '+kaynak+'.';
  return '<div class="ve-fp-f" data-mnt-vars="'+id+'" data-kaynak="'+(elle?'elle':'varsayilan')+'">'
    + '<label class="ve-fp-l" for="'+id+'">'+etiket+'</label>'
    + '<span class="ve-fp-deger"><input class="ve-fp-inp" type="text" inputmode="decimal" id="'+id+'"'
    + ' value="'+_mntEsc(elle ? d[key] : String(varsayilan))+'" onchange="'+degis+'">'
    + '<button type="button" class="ve-fp-i" data-kaynak="'+(elle?'elle':'varsayilan')+'"'
    + ' data-ipucu="'+_mntEsc(t)+'" aria-label="'+_mntEsc(t)+'">'+veIkon('info')+'</button></span></div>';
}
// DURUM SATIRI — bir seçimin ya da hesabın SONUCU, açıklama değil (FEAD kural
// 45: "pencere açıklama taşımaz, durum söyler"; açıklama kılavuzda). Biçim
// FEAD'in satırı (`_feadHint` · `.ve-fead-not`): alanın altında soluk, kısa
// bir not; hükmü baştaki kalın sözcük taşır ve tonu `data-d`den (css) — FEAD
// aynı tonu satır içi `style=` ile yazıyor. Kalın sözcüğü olmayan uyarı
// cümlenin tamamını kalın yazar (FEAD'in kalıbı). Eskiden ikonlu, renk
// zeminli bir kutuydu (`.ve-mnt-not`): FEAD'de kutu yalnız pencerenin
// CEVABIDIR (`_mntDurumKutu`).
function _mntNot(ic, d, opt){
  opt=opt||{};
  ic=String(ic==null?'':ic);
  if((d==='warn' || d==='no') && ic.indexOf('<b>')<0) ic='<b>'+ic+'</b>';
  return '<div class="ve-fp-not"'+(d?' data-d="'+d+'"':'')+(opt.id?' id="'+opt.id+'" data-tazele':'')+'>'+ic+'</div>';
}
// PENCERENİN CEVABI — FEAD'in durum kutusu (`.ve-fp-durum`, Rapor penceresi):
// sağ sütunda, eylemin üstünde; hükmü baştaki kalın sözcük taşır.
function _mntDurumKutu(ic, d){
  return '<div class="ve-fp-durum"'+(d?' data-d="'+d+'"':'')+'>'+ic+'</div>';
}

// ── FÖY TABLOSU — eksen başına bir satır: girdi ve ondan türetilen yan yana ─
// `ve-izgara`: veri ızgarası kuralı (kullanıcı kararı 13·B) — girdi dinlenmede
// kutusuz, fare üstünde ve yazarken kutulu. Sütun oranı `<colgroup>`da VERİ.
function _mntFoyAc(sutunlar, aria, sinif){
  var h='<table class="ve-mnt-foy ve-izgara'+(sinif?' '+sinif:'')+'"'+(aria?' aria-label="'+_mntEsc(aria)+'"':'')+'><colgroup>';
  sutunlar.forEach(function(c){ h+='<col'+(c.gen?' style="width:'+c.gen+'"':'')+'>'; });
  h+='</colgroup><thead><tr>';
  sutunlar.forEach(function(c){
    h+='<th'+(c.sinif?' class="'+c.sinif+'"':'')+(c.ipucu?' title="'+_mntEsc(c.ipucu)+'"':'')+'>'+c.b+'</th>';
  });
  return h+'</tr></thead><tbody>';
}
var _MNT_FOY_KAPA='</tbody></table>';
function _mntFoyGir(node, key, aria, opt){
  opt=opt||{};
  var v=(node.data && node.data[key]!=null) ? node.data[key] : '';
  var zor=!!opt.zorunlu, bos=_mntBos(v);
  return '<td class="gir'+(zor&&bos?' zor':'')+(opt.tahmin?' tah" title="Tahmini':'')+'"><input type="text" inputmode="decimal" id="ve-mnt-'+key+'-'+node.id+'"'
    + ' value="'+_mntEsc(v)+'"'+(zor?' data-zorunlu':'')
    + ((opt.ph||zor) ? ' placeholder="'+_mntEsc(opt.ph||'zorunlu')+'"' : '')
    + ' aria-label="'+_mntEsc(aria)+(opt.tahmin?' · tahmini':'')+'" onchange="'+(opt.setter||'veMntSet')+'(\''+node.id+'\',\''+key+'\',this.value)"></td>';
}
// Türetilen hücre — oyuk zemin; kimlik verilirse yerinde tazelenir.
function _mntFoyCoz(ic, opt){
  opt=opt||{};
  return '<td class="cz'+(opt.ay?' ay':'')+(opt.sinif?' '+opt.sinif:'')+'"'
    + (opt.id?' id="'+opt.id+'" data-tazele':'')+(opt.ipucu?' title="'+_mntEsc(opt.ipucu)+'"':'')+'>'+ic+'</td>';
}

// ════════════════════════════════════════════════════════════════════════════
//  CANLI MODEL — pencerenin türettiği sayılar (çözümden bağımsız)
// ════════════════════════════════════════════════════════════════════════════
// Kanvastaki modelin birleşik kütlesi ve ağırlık merkezi — çözücünün AYNI
// birleştirmesi (çekirdek combineMassProps) ve AYNI boş alan kuralı (_mntToSI:
// boş = 0). Pencere kendi CG'sini hesaplasaydı boş bir alan pencerede "—",
// çözücüde 0 olurdu ve iki yüzey aynı model için iki ayrı CG söylerdi.
function _mntCanliModel(){
  var g=_mntGatherForSolver(null);
  var C=(typeof veMountCore!=='undefined') ? veMountCore : null;
  var si=(C && C.mmToM) ? _mntToSI(g, 9.81) : null;
  var mp=(si && si.components.length && C.combineMassProps) ? C.combineMassProps(si.components) : null;
  var mTop=0;
  g.components.forEach(function(c){ mTop+=_mntNum(c.mass,0); });
  return { g:g, si:si, mp:mp, mTop:mTop };
}
// Seçili bileşenin birleşik CG'ye göre konumu [mm] (boş = 0, çözücü gibi).
function _mntAmFarki(p, M){
  if(!M.mp) return null;
  var d=[p[0]-M.mp.cg[0]*1000, p[1]-M.mp.cg[1]*1000, p[2]-M.mp.cg[2]*1000];
  return { d:d, r:Math.sqrt(d[0]*d[0]+d[1]*d[1]+d[2]*d[2]) };
}

// ATALET TENSÖRÜ FİZİKSEL Mİ? Her çerçevede I_yy + I_zz − I_xx = 2∫x² dm ≥ 0
// (üç eksen için) ve asal momentler ≥ 0. Çözücü fiziksel olmayan bir tensörü
// de çözer — uyarmaz, modlar sessizce yanlış çıkar (bir köşegen hanesi
// kayınca: 14,7 → 147). Asal momentler ve eşdeğer kutu çekirdekten
// (principalInertia · equivalentBox — 3B görünümün kutusu da oradan).
function _mntAtalet(d){
  var C=(typeof veMountCore!=='undefined') ? veMountCore : null;
  var I=[[_mntNum(d.Ixx),_mntNum(d.Ixy),_mntNum(d.Ixz)],
         [_mntNum(d.Ixy),_mntNum(d.Iyy),_mntNum(d.Iyz)],
         [_mntNum(d.Ixz),_mntNum(d.Iyz),_mntNum(d.Izz)]];
  var bos=_mntBos(d.Ixx) && _mntBos(d.Iyy) && _mntBos(d.Izz);
  var Ix=I[0][0], Iy=I[1][1], Iz=I[2][2];
  var tol=1e-9*(Math.abs(Ix)+Math.abs(Iy)+Math.abs(Iz)+1e-12);
  var ihlal='';
  if(Iy+Iz-Ix < -tol) ihlal='Iyy + Izz < Ixx';
  else if(Ix+Iz-Iy < -tol) ihlal='Ixx + Izz < Iyy';
  else if(Ix+Iy-Iz < -tol) ihlal='Ixx + Iyy < Izz';
  var asal=(C && C.principalInertia) ? C.principalInertia(I) : null;
  if(!ihlal && asal && asal.values[0] < -tol) ihlal='negatif asal moment';
  var kutu=(C && C.equivalentBox) ? C.equivalentBox(_mntNum(d.mass,0), I, false) : null;
  return { I:I, bos:bos, ihlal:ihlal, asal:asal ? asal.values : null, kutu:kutu };
}

// ════════════════════════════════════════════════════════════════════════════
//  GÜÇ GRUBUNDAKİ YERİ — AKSONOMETRİK KROKİ
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı isteği (2026-10-16): *"Diğer bileşen pencerelerinin içinde de
// 'Güç grubundaki yeri' kısmında aksonometrik görünümün görünmesini
// istiyorum."* Kroki Görünümler'in çizicisi (js/mount-akso.js) ve AYNI
// kurucusu (_mntAksoModelKur) — canlı modelden, çözümsüz. Eskiden kendi 2B
// çizimiydi (üstten / yandan, daire ve kare) ve takozda son çözümün sehim
// okunu taşıyordu — pencere sonuç göstermez (aşağıda).
//
// GÖRÜNÜMLER'İN KENDİSİ (kullanıcı, ikinci tur: *"o 3B olmamış. Aynı
// 'Görünümler' bileşenindeki gibi olacak. Bileşene göre parçayı belirgin
// gösterecek."*): sabit dimetrik çizim emekli; kroki Görünümler'in serbest
// kameralı bileşeni (_mntAksoHTML — başlık, görünüm düğmeleri, sürükle-döndür,
// tekerlek, tam ekran) ve açı onunla ORTAK (VE_MNT_AKSO3B). Bu bileşen
// perdenin ÜSTÜNDE, adıyla (o.secili + o.perde): parça aydınlık, kalan model
// gölgede — föy satırının vurgusuyla aynı dil.
//
// Kroki her girdi değişikliğinde yerinde tazelenir (`data-tazele`, dış HTML
// karşılaştırılır): bu yüzden HEP AYNI genişlikte kurulur (data-w) — gerçek
// genişlikte kurulsaydı her tazelemede değişmiş sayılıp yeniden yazılırdı.
// Açı ortak ve kalıcı, yakınlık kap başına: tazeleme kamerayı sıfırlamaz.
var _MNT_KROKI_W = 354;   // Görünümler'in çiziminin birimi (müfettiş sütununun içi)
// KROKİ SAĞ SÜTUNDA (FEAD'in bağlam sütunu): çizimin birimi sağ sütunun iki
// sütunlu (modal) penceredeki genişliği — 296 px (`.ve-fp-split`). Tek
// sütunlu müfettişte (354 px) 1,2 büyür.
var _MNT_YER_W = 296;

// Bölüm FEAD'in başlığıyla (`.ve-fp-sect`); dinleyiciler ilk fare girişinde
// ya da odakta bağlanır — bölüm yerinde tazelenince öğe değişir, dinleyici
// onunla gider.
function _mntKrokiHTML(node, M){
  var kapId='ve-mnt-yer-'+node.id;
  var ic=(!M.g.components.length && !M.g.mounts.length) ? _mntNot('Modelde gövde ya da takoz yok.', '')
    : '<div class="ve-mnt-akso-kap" id="'+kapId+'" data-sec="'+_mntEsc(node.id)+'" data-w="'+_MNT_YER_W+'"'
      + ' onmouseenter="_mntAksoBagla(this)" onfocusin="_mntAksoBagla(this)">'
      + _mntAksoHTML({ M:M }, _MNT_YER_W, false, kapId, { sec:node.id })+'</div>';
  return '<section class="ve-fp-card ve-mnt-yer" id="ve-mnt-kroki-'+node.id+'" data-tazele>'
    + '<div class="ve-fp-sect"><b>Güç grubundaki yeri</b></div>'+ic+'</section>';
}

// ════════════════════════════════════════════════════════════════════════════
//  PENCERE SONUÇ GÖSTERMEZ (kullanıcı kararı 2026-10-16)
// ════════════════════════════════════════════════════════════════════════════
// *"TÜM BİLEŞENLERİN İÇİNDE sonuç ile alakalı bir bilgi, bir sonuç vs
// olmayacak … kullanıcı sadece detaylı sonuç raporu ile yetinecek."* On yedi
// Takoz penceresinin on yedisi sağ sütununda raporun Uygunluk satırlarını
// taşıyordu (veMntUygunluk) ve hepsi çözümden sonra değişiyordu; takoz
// penceresinde sehim, sönüm ve kapasite, Çözücü'de modlar ve vites başına
// kuvvet, Görünümler'de kuvvet, sehim ve mod katmanı vardı. Hepsi kalktı:
// sonuç yalnız ayrıntılı raporda (cp-mount-report.js, uygunluk tablosu dâhil).
// Pencerede çözümle değişen TEK şey eylemin hazırlığıdır — Çözücü'nün notu
// (son hesap güncel · bayat) ve Rapor'un çözüm durumu; ikisi de
// `data-cozum-durumu` taşır. Kapı: pencere-kabuk.test.js → "ÇÖZÜMDEN BAĞIMSIZ".

// ─── Tipe özel kinematik bölümleri (tork yük durumları için) ─────────────────
// Motor tork zinciri girdileri komponentler içine dağıtılır: Motor→tepe tork,
// Şanzıman→vites oranları + stall, Transfer→transfer oranı + aks payı.
// ─── Motor kataloğu köprüsü (Araç Performans preset'leri → takoz Motor'u) ────
// Aynı motor iki modülde de kullanılabiliyor; TAHRİK büyüklükleri (tepe tork,
// maks güç, rölanti) katalogda ZATEN var — elle ikinci kez girilmesin.
//
//   KATALOGDAN GELİR : Te · TeRpm · Pmax · PmaxRpm · idleRpm
//   ELLE KALIR       : kütle · ağırlık merkezi · atalet tensörü · silindir sayısı
//
// Elle kalanlar motor kataloğu verisi DEĞİL, araca özel entegrasyon verisidir
// (CATIA ölçümü); katalog onları taşımaz ve seçim onlara DOKUNMAZ.
//
// SESSİZ HATA TUZAĞI: preset'teki specs.inertia KRANK MİLİ DÖNER ataletidir
// (0,5–3 kg·m²) — takozun istediği rijit gövde atalet TENSÖRÜ (100+ kg·m²) ile
// aynı şey DEĞİLDİR, iki mertebe fark eder. Bu yüzden asla aktarılmaz.
function _mntEnginePresets(){
  if(typeof VE_FT_MOTOR_PRESETS!=='undefined') return VE_FT_MOTOR_PRESETS;
  if(typeof window!=='undefined' && window.VE_FT_MOTOR_PRESETS) return window.VE_FT_MOTOR_PRESETS;
  return null;
}

// Preset → takoz Motor alanları. Tepe tork ve maks güç eğriden okunur; düz tork
// platosunda EN DÜŞÜK devir alınır (katalog konvansiyonu — data artan devirde
// sıralı, kesin '>' ile ilk maksimum korunur). Bilinmeyen anahtar → null.
function _mntEnginePresetValues(key){
  var P=_mntEnginePresets(); if(!P || !P[key]) return null;
  var p=P[key], sp=p.specs||{}, rows=Array.isArray(p.data)?p.data:[];
  var out={};
  if(_mntNum(sp.idleRpm,0)>0) out.idleRpm=_mntNum(sp.idleRpm);
  var bt=null, bp=null;
  rows.forEach(function(r){
    var rpm=_mntNum(r.rpm,NaN), tq=_mntNum(r.torque,NaN), pw=_mntNum(r.power,NaN);
    if(!Number.isFinite(rpm)) return;
    if(Number.isFinite(tq) && (!bt || tq>bt.v)) bt={v:tq, rpm:rpm};
    if(Number.isFinite(pw) && (!bp || pw>bp.v)) bp={v:pw, rpm:rpm};
  });
  if(bt){ out.Te=bt.v;                        out.TeRpm=bt.rpm; }
  if(bp){ out.Pmax=Math.round(bp.v*10)/10;    out.PmaxRpm=bp.rpm; }
  return out;
}

// Katalog seçimi uygula. Boş anahtar → yalnız bağ kaldırılır, GİRİLEN DEĞERLER
// SİLİNMEZ (kullanıcı katalogdan yükleyip sonra elle rötuşlayabilsin).
function veMntApplyEnginePreset(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  if(!key){
    delete node.data.enginePreset;
  } else {
    var v=_mntEnginePresetValues(key); if(!v) return;
    Object.keys(v).forEach(function(k){ node.data[k]=v[k]; });
    node.data.enginePreset=key;
    if(typeof showToast==='function'){
      var P=_mntEnginePresets(), nm=(P && P[key] && P[key].name) || key;
    }
  }
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}

// Aile gruplaması — Araç Performans motor seçicisiyle (cp-engine.js) AYNI düzen,
// böylece kullanıcı iki modülde aynı listeyi görür.
var _MNT_ENG_FAMILIES = [
  {label:'BMC / AZRA',        prefix:['azra_','bmc_']},
  {label:'Cummins ISB 4.5L',  prefix:['isb45']},
  {label:'Cummins ISB 6.7L',  prefix:['isb67']},
  {label:'Cummins ISL 8.9L',  prefix:['isl']},
  {label:'Cummins ISG 12L',   prefix:['isg']},
  {label:'Cummins ISM 10.8L', prefix:['ism']},
  {label:'Cummins ISX 15L',   prefix:['isx']},
  {label:'GM Duramax',        prefix:['duramax_']},
  {label:'Diğer',             prefix:[]}
];
function _mntEnginePresetSelect(node){
  var P=_mntEnginePresets();
  if(!P) return '';                      // katalog yüklü değil → seçiciyi hiç gösterme
  var keys=Object.keys(P); if(!keys.length) return '';
  var cur=node.data.enginePreset||'';
  var h='<select class="ve-fp-sel" id="ve-mnt-enginePreset-'+node.id+'" onchange="veMntApplyEnginePreset(\''+node.id+'\',this.value)">';
  h+='<option value="">— elle gir —</option>';
  var used={};
  _MNT_ENG_FAMILIES.forEach(function(fam){
    var ks=keys.filter(function(k){
      if(used[k]) return false;
      if(!fam.prefix.length) return true;
      return fam.prefix.some(function(p){ return k.indexOf(p)===0; });
    });
    if(!ks.length) return;
    h+='<optgroup label="'+_mntEsc(fam.label)+' ('+ks.length+')">';
    ks.forEach(function(k){ used[k]=1;
      h+='<option value="'+_mntEsc(k)+'"'+(k===cur?' selected':'')+'>'+_mntEsc(P[k].name||k)+'</option>'; });
    h+='</optgroup>';
  });
  h+='</select>';
  return h;
}

// KATALOGTAN SAPMA — "elle" demek için değerin katalogtan FARKLI olması
// gerekir (FEAD kural 17): yalnız "dolu mu" bakan bir tespit katalogun kendi
// yazdığı alanları kullanıcıya mal ederdi. Dönüş: { ad, ayni:[], farkli:[] } | null.
var _MNT_MOTOR_KATALOG = [['Te','tepe tork'], ['TeRpm','tepe tork devri'], ['Pmax','maks. güç'],
                          ['PmaxRpm','maks. güç devri'], ['idleRpm','rölanti']];
function _mntMotorSapma(node){
  var key=node.data && node.data.enginePreset; if(!key) return null;
  var v=_mntEnginePresetValues(key); if(!v) return null;
  var P=_mntEnginePresets(), ad=(P && P[key] && P[key].name) || key;
  var ayni=[], farkli=[];
  _MNT_MOTOR_KATALOG.forEach(function(a){
    if(v[a[0]]===undefined) return;
    var x=_mntNum(node.data[a[0]], NaN);
    if(Number.isFinite(x) && Math.abs(x-v[a[0]])<=1e-9*Math.max(1, Math.abs(v[a[0]]))) ayni.push(a[1]);
    else farkli.push(a[1]);
  });
  return { ad:ad, ayni:ayni, farkli:farkli };
}

// İKİ GÖVDEDE AYNI TORK ALANI — çözücü İLK doluyu okur (düğüm sırası), öteki
// sessizce yok sayılır. Bu gövdenin dolu alanlarından başkasınınkiyle
// gölgelenenler: [{ alan, kaynak }].
function _mntGolgelenen(node){
  var K=_mntGatherTorqueKaynakli().kaynak, d=node.data||{}, out=[];
  _MNT_TORK_ALANLARI.forEach(function(k){
    if(!_mntBos(d[k]) && K[k] && K[k].id!==node.id) out.push({ alan:k, kaynak:K[k] });
  });
  return out;
}
function _mntGolgeDurumu(node){
  var g=_mntGolgelenen(node);
  if(!g.length) return null;
  return _mntDurum('eksik', 'çakışma', g.length+' tork alanı başka bir gövdede de dolu ('
    + g.map(function(x){ return x.alan; }).join(', ')+') — çözücü '+_mntNodeName(g[0].kaynak)+' gövdesinin değerini okuyor.');
}

// TORK ZİNCİRİ — çözücünün kurduğu AYNI tork yük durumlarından okunur
// (_mntTorqueCases · _mntGearTorqueCases): mil torku T = Te·R_stall·i_vites·
// i_transfer·φ. Ayrı bir çarpım yazılsaydı boş bir transfer oranı burada
// "—", çözücüde 1 olurdu.
function _mntTorkZinciri(){
  var G=_mntGatherTorqueKaynakli(), t=G.t;
  var fwd=null, rev=null;
  _mntTorqueCases(t).forEach(function(c){
    if(c.name==='Forward Torque') fwd=c.Tshaft;
    if(c.name==='Reverse Torque') rev=c.Tshaft;
  });
  return { t:t, kaynak:G.kaynak, ileri:fwd, geri:rev };
}
function _mntZincirHTML(nodeId){
  var Z=_mntTorkZinciri(), t=Z.t, K=Z.kaynak;
  var kay=function(k){ return K[k] ? _mntEsc(_mntNodeName(K[k])) : '—'; };
  var carp=function(k, d, varsayilan){
    if(_mntBos(t[k])) return (varsayilan!=null) ? '× '+_mntS(varsayilan)+' · boş' : '—';
    return '× '+_mntS(_mntNum(t[k]), d);
  };
  var h=_mntFoyAc([{ b:'Halka', gen:'38%' }, { b:'Kaynak', gen:'32%', sinif:'sol' }, { b:'Çarpan', gen:'30%', sinif:'cz ay' }], 'Tork zinciri');
  h+='<tr><td>Motor torku</td><td class="sol">'+kay('Te')+'</td>'+_mntFoyCoz(_mntBos(t.Te) ? '—' : _mntS(_mntNum(t.Te),0)+' Nm', { ay:true })+'</tr>';
  h+='<tr><td>Stall oranı</td><td class="sol">'+kay('Rstall')+'</td>'+_mntFoyCoz(carp('Rstall', 2), { ay:true })+'</tr>';
  h+='<tr><td>1. vites</td><td class="sol">'+kay('g1')+'</td>'+_mntFoyCoz(carp('g1', 2), { ay:true })+'</tr>';
  h+='<tr><td>Transfer oranı</td><td class="sol">'+kay('iTransfer')+'</td>'+_mntFoyCoz(carp('iTransfer', 3, 1), { ay:true })+'</tr>';
  h+='<tr><td>Aks payı '+_mntSym('φ')+'</td><td class="sol">'+kay('phiFwd')+'</td>'+_mntFoyCoz(carp('phiFwd', null, 1), { ay:true })+'</tr>';
  h+='<tr class="top"><td>Mil torku · ileri</td><td></td>'+_mntFoyCoz(Z.ileri!=null ? _mntS(Z.ileri,0)+' N·m' : '—', { ay:true })+'</tr>';
  h+='<tr class="top"><td>Mil torku · geri</td><td class="sol sf">'+(_mntBos(t.gR) ? '' : 'geri vites × '+_mntS(_mntNum(t.gR),2))+'</td>'
    + _mntFoyCoz(Z.geri!=null ? _mntS(Z.geri,0)+' N·m' : '—', { ay:true })+'</tr>';
  return '<div id="ve-mnt-zincir-'+nodeId+'" data-tazele>'+h+_MNT_FOY_KAPA+'</div>';
}

// ATEŞLEME — f = (N/60)·(z/2); Kriter 1'in mod sınırı ½·f. Raporla AYNI bağıntı
// (_mntRepIsolation) — burada çözümden bağımsız, girilen değerden.
function _mntAtesleme(d){
  var n=_mntNum(d.idleRpm, NaN), z=_mntNum(d.cylinders, NaN);
  return (n>0 && z>0) ? (n/60)*(z/2) : NaN;
}

// MOTOR BÖLÜMLERİ — katalog · motor noktaları · tork zinciri · ateşleme.
function _mntEngineSection(node){
  var d=node.data||{};
  var sel=_mntEnginePresetSelect(node), P=_mntEnginePresets();
  var h='';
  if(sel){
    // DURUM: seçimin getirdiği (FEAD kural 44; FEAD'in motor kartı: "Alanlar
    // X kaydıyla birebir" · "Katalogdan sapıldı"). GETİRMEDİĞİ (kütle, CG,
    // gövde ataleti — kataloğun ataleti KRANK MİLİNİNKİ) ayrı notla anlatılmaz:
    // alan boş kalır, eksik bandı söyler (mount-engine-preset.test.js).
    var sap=_mntMotorSapma(node), not;
    if(sap && sap.farkli.length) not=_mntNot('<b>Katalogdan sapıldı:</b> '+sap.farkli.join(', ')+' ('+_mntEsc(sap.ad)+')', 'warn');
    else if(sap) not=_mntNot('Alanlar <b>'+_mntEsc(sap.ad)+'</b> kaydıyla birebir ('+sap.ayni.length+'/'+sap.ayni.length+')', 'ok');
    else not='';
    h+=_mntBolum('Katalog', Object.keys(P).length+' motor',
        _mntIzgara(1, '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Motor</span>'+sel+'</label>')
      + '<div id="ve-mnt-motorkat-'+node.id+'" data-tazele>'+not+'</div>');
  }
  var f=_mntFoyAc([{ b:'Nokta', gen:'40%' }, { b:'Değer', gen:'30%' }, { b:'Devir <u>[d/dk]</u>', gen:'30%' }], 'Motor noktaları');
  f+='<tr><td>Tepe tork [Nm]</td>'+_mntFoyGir(node, 'Te', 'Tepe tork', { ph:'760' })+_mntFoyGir(node, 'TeRpm', 'Tepe torkta devir', { ph:'1500' })+'</tr>';
  f+='<tr><td>Maks. güç [kW]</td>'+_mntFoyGir(node, 'Pmax', 'Maks. güç', { ph:'156.6' })+_mntFoyGir(node, 'PmaxRpm', 'Maks. güçte devir', { ph:'2300' })+'</tr>';
  f+='<tr><td>Rölanti</td><td class="sf">—</td>'+_mntFoyGir(node, 'idleRpm', 'Rölanti devri', { zorunlu:true })+'</tr>';
  f+='<tr><td>Silindir sayısı</td>'+_mntFoyGir(node, 'cylinders', 'Silindir sayısı', { zorunlu:true })+'<td class="sf">—</td></tr>';
  h+=_mntBolum('Motor noktaları', P ? 'katalogdan dolar' : '', f+_MNT_FOY_KAPA);
  h+=_mntBolum('Tork zinciri', '', _mntZincirHTML(node.id));
  var fa=_mntAtesleme(d);
  h+=_mntBolum('Ateşleme', 'f = (N/60)·(z/2)',
      _mntIzgara(2,
        _mntOku('Rölantide <u>[Hz]</u>', Number.isFinite(fa) ? _mntS(fa,1) : '— (silindir/rölanti yok)', { id:'ve-mnt-fate-'+node.id })
      + _mntOku('Mod sınırı '+_mntSym('½·f')+' <u>[Hz]</u>', Number.isFinite(fa) ? _mntS(0.5*fa,1) : '—', { id:'ve-mnt-fsin-'+node.id })));
  return h;
}
function _mntMotorDurumu(node){
  var d=node.data||{};
  if(_mntBos(d.cylinders) || !(_mntNum(d.cylinders,0)>0))
    return _mntDurum('eksik', 'eksik', 'Silindir sayısı boş: Kriter 1–2 değerlendirilemiyor.', 've-mnt-cylinders-'+node.id);
  if(_mntBos(d.idleRpm) || !(_mntNum(d.idleRpm,0)>0))
    return _mntDurum('eksik', 'eksik', 'Rölanti devri boş: Kriter 1–2 değerlendirilemiyor.', 've-mnt-idleRpm-'+node.id);
  if(_mntBos(d.Te) || !(_mntNum(d.Te,0)>0))
    return _mntDurum('eksik', 'eksik', 'Tepe tork boş: tork yük durumları kurulmuyor.', 've-mnt-Te-'+node.id);
  var gol=_mntGolgeDurumu(node); if(gol) return gol;
  var Z=_mntTorkZinciri();
  if(Z.ileri==null) return _mntDurum('eksik', 'zincir', 'Tork zinciri eksik: tork yük durumları kurulmuyor.');
  return _mntDurum('ok', 'tamam');
}

// ŞANZIMAN BÖLÜMLERİ — vites oranları; her satırın mil torku çözücünün vites
// başına durumlarından (_mntGearTorqueCases, Kriter 3).
var _MNT_VITESLER = [['g1','1. vites'],['g2','2. vites'],['g3','3. vites'],['g4','4. vites'],
                     ['g5','5. vites'],['g6','6. vites'],['g7','7. vites'],['gR','Geri']];
var _MNT_VITES_ALAN = ['g1','g2','g3','g4','g5','g6','g7'];
// ŞANZIMANIN KATALOĞU (2026-11-06) — veri sayfasındaki dişli düzenleri ve
// konvertörler (js/mount-veri-sayfasi.js; Allison 4000: CR · WR · yedi vitesli,
// TC-521…571). Motorun kataloğuyla aynı kalıp: seçim alanları DOLDURUR, bağ
// kaldırılınca girilen değerler silinmez; sapma alan alan söylenir.
function _mntVsKatalog(){
  var V=null;
  if(typeof veMntVsDisliDuzenleri==='function') V={ veMntVsDisliDuzenleri:veMntVsDisliDuzenleri, veMntVsKonvertorler:veMntVsKonvertorler };
  else if(typeof require==='function'){ try { V=require('./mount-veri-sayfasi.js'); } catch(e){} }
  var K=V ? { disli:V.veMntVsDisliDuzenleri(), tc:V.veMntVsKonvertorler() } : { disli:[], tc:[] };
  _mntOrtakSanziman(K);
  return K;
}
// ORTAK KATALOG (F002, 2026-11-11) — veri sayfası olmayan şanzıman ve konvertör
// programın ortak kataloğundan (Araç Performans'ın VE_GEARBOX_PRESETS ·
// VE_FT_TC_PRESETS; kopya kurulmaz, global okunur). Anahtar 'ap:<anahtar>'.
// Veri sayfasıyla aynı oranlı düzen ve aynı adlı-aynı stall'lı konvertör
// yazılmaz (veri sayfası daha çok veri taşır). Yediden çok ileri vitesli düzen
// yok: Takoz'un vites alanları g1…g7.
var _MNT_AP_AILE = { '1000_2000':'1000/2000', '3000':'3000', '4000':'4000' };
function _mntOrtakGlobal(ad){
  var v=null;
  if(ad==='VE_GEARBOX_PRESETS' && typeof VE_GEARBOX_PRESETS!=='undefined') v=VE_GEARBOX_PRESETS;
  else if(ad==='VE_FT_TC_PRESETS' && typeof VE_FT_TC_PRESETS!=='undefined') v=VE_FT_TC_PRESETS;
  else if(ad==='VE_TRANSFER_PRESETS' && typeof VE_TRANSFER_PRESETS!=='undefined') v=VE_TRANSFER_PRESETS;
  if(!v && typeof window!=='undefined' && window[ad]) v=window[ad];
  return v || null;
}
function _mntApAileAdi(marka, fam){
  return fam && _MNT_AP_AILE[fam] ? marka+' '+_MNT_AP_AILE[fam] : marka;
}
function _mntOrtakSanziman(K){
  var G=_mntOrtakGlobal('VE_GEARBOX_PRESETS'), T=_mntOrtakGlobal('VE_FT_TC_PRESETS');
  var vsD=K.disli.slice(), vsT=K.tc.slice();
  var esit=function(a, b){ return a.length===b.length && a.every(function(v, i){ return Math.abs(v-b[i])<1e-9; }); };
  if(G) Object.keys(G).forEach(function(k){
    var p=G[k], gs=Array.isArray(p.gears) ? p.gears : [];
    var ileri=gs.filter(function(g){ return String(g.gear).charAt(0)!=='R'; }).map(function(g){ return _mntNum(g.ratio); });
    var r=gs.filter(function(g){ return String(g.gear).charAt(0)==='R'; })[0];
    var geri=r ? _mntNum(r.ratio) : null;
    if(!ileri.length || ileri.length>_MNT_VITES_ALAN.length) return;
    if(vsD.some(function(x){ return esit(x.ileri, ileri) && x.geri===geri; })) return;
    var ad=String(p.name||k).split('|'), marka=ad.length>1 ? ad[0].trim() : '', model=(ad[1]||ad[0]).trim();
    K.disli.push({ k:'ap:'+k, ad:(marka ? marka+' ' : '')+model, etiket:model, aile:_mntApAileAdi(marka||model, p.family),
                   ileri:ileri, geri:geri });
  });
  if(T) Object.keys(T).forEach(function(k){
    var p=T[k], d=Array.isArray(p.data) ? p.data : [];
    var s0=d.filter(function(x){ return _mntNum(x.sr, NaN)===0; })[0];
    var stall=s0 ? _mntNum(s0.tau, NaN) : NaN;
    if(!(stall>0)) return;
    var ad=p.name||k;
    if(vsT.some(function(x){ return x.ad===ad && Math.abs(x.stall-stall)<1e-9; })) return;
    K.tc.push({ k:'ap:'+k, ad:ad, aile:_mntApAileAdi('Allison', p.family), stall:stall });
  });
}
// TRANSFERİN KATALOĞU — programın ortak transfer kataloğu (VE_TRANSFER_PRESETS);
// kademe başına bir seçenek, anahtar '<marka|model>#<kademe>'.
function _mntTransferKatalog(){
  var P=_mntOrtakGlobal('VE_TRANSFER_PRESETS'), out=[];
  if(P) Object.keys(P).forEach(function(k){
    var p=P[k];
    (p.rows||[]).forEach(function(r){
      var o=_mntNum(r.ratio, NaN); if(!(o>0)) return;
      out.push({ k:k+'#'+r.mode, ad:p.model+' · '+r.mode, aile:p.marka, oran:o });
    });
  });
  return out;
}
function _mntTransferPresetValues(key){
  var t=_mntTransferKatalog().filter(function(x){ return x.k===key; })[0];
  return t ? { iTransfer:t.oran } : null;
}
function veMntApplyTransferPreset(nodeId, key){ _mntSanzimanPresetUygula(nodeId, key, 'trPreset', _mntTransferPresetValues); }
function _mntTransferSapma(node){
  return _mntPresetSapma(node, 'trPreset', _mntTransferPresetValues, [['iTransfer','transfer oranı']], function(k){
    var t=_mntTransferKatalog().filter(function(x){ return x.k===k; })[0]; return t ? t.aile+' '+t.ad : k; });
}
function _mntTransferKatalogHTML(node){
  var L=_mntTransferKatalog(); if(!L.length) return '';
  var sel=_mntSanzimanSecHTML(node, L, 'trPreset', 'veMntApplyTransferPreset', function(x){ return x.ad+' · '+_mntS(x.oran, 3); });
  return _mntBolum('Katalog', L.length+' kademe',
      _mntIzgara(1, '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Transfer kademesi</span>'+sel+'</label>')
    + '<div id="ve-mnt-trkat-'+node.id+'" data-tazele>'+_mntSapmaNot(_mntTransferSapma(node))+'</div>');
}
// Dişli düzeninin alanları: ileri vitesler (düzende olmayan vites null —
// uygulanınca SİLİNİR: yedi vitesliden altı vitesliye dönen bir 7. vites
// Kriter 3'e hayalet bir vites koyardı) ve geri
function _mntDisliPresetValues(key){
  var d=_mntVsKatalog().disli.filter(function(x){ return x.k===key; })[0];
  if(!d) return null;
  var out={};
  _MNT_VITES_ALAN.forEach(function(k, i){ out[k]=i<d.ileri.length ? d.ileri[i] : null; });
  out.gR=d.geri;
  return out;
}
function _mntKonvertorPresetValues(key){
  var c=_mntVsKatalog().tc.filter(function(x){ return x.k===key; })[0];
  return c ? { Rstall:c.stall } : null;
}
// ŞANZIMAN → KONVERTÖR (kullanıcı 2026-11-11, Araç Performans'taki gibi): seçili
// vites konfigürasyonunun ailesi konvertör listesini süzer; aile değişince
// uymayan konvertör ve onun stall oranı düşer. Aile bilinmiyorsa liste tam.
function _mntSanzimanAilesi(gearKey){
  var d=gearKey ? _mntVsKatalog().disli.filter(function(x){ return x.k===gearKey; })[0] : null;
  return d ? d.aile : null;
}
function _mntKonvertorListesi(gearKey){
  var K=_mntVsKatalog(), a=_mntSanzimanAilesi(gearKey);
  var L=a ? K.tc.filter(function(x){ return x.aile===a; }) : [];
  return L.length ? L : K.tc;
}
// Seçim sonrası: uymayan konvertörü (ve stall'ı) düşür; ailede tek konvertör
// varsa onu seç. data: düğüm verisi ya da sihirbazın tork durumu.
function _mntKonvertorEsle(data){
  var L=_mntKonvertorListesi(data.gearPreset), tk=data.tcPreset;
  if(tk && !L.some(function(x){ return x.k===tk; })){ delete data.tcPreset; delete data.Rstall; tk=null; }
  if(!tk && _mntSanzimanAilesi(data.gearPreset) && L.length===1){ data.tcPreset=L[0].k; data.Rstall=L[0].stall; }
}
function _mntSanzimanPresetUygula(nodeId, key, alan, degerler){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  if(!key) delete node.data[alan];
  else {
    var v=degerler(key); if(!v) return;
    Object.keys(v).forEach(function(k){ if(v[k]===null) delete node.data[k]; else node.data[k]=v[k]; });
    node.data[alan]=key;
  }
  if(alan==='gearPreset') _mntKonvertorEsle(node.data);
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntApplyGearPreset(nodeId, key){ _mntSanzimanPresetUygula(nodeId, key, 'gearPreset', _mntDisliPresetValues); }
function veMntApplyTcPreset(nodeId, key){ _mntSanzimanPresetUygula(nodeId, key, 'tcPreset', _mntKonvertorPresetValues); }
// Sapma: { ad, ayni:[], farkli:[] } | null — kaydın söz söylemediği alan sayılmaz
function _mntPresetSapma(node, alan, degerler, adlar, kayitAd){
  var key=node.data && node.data[alan]; if(!key) return null;
  var v=degerler(key); if(!v) return null;
  var ayni=[], farkli=[];
  adlar.forEach(function(a){
    if(v[a[0]]===undefined) return;
    var x=node.data[a[0]];
    if(v[a[0]]===null){ if(!_mntBos(x)) farkli.push(a[1]); return; }
    var n=_mntNum(x, NaN);
    if(Number.isFinite(n) && Math.abs(n-v[a[0]])<=1e-9*Math.max(1, Math.abs(v[a[0]]))) ayni.push(a[1]);
    else farkli.push(a[1]);
  });
  return { ad:kayitAd(key), ayni:ayni, farkli:farkli };
}
function _mntDisliSapma(node){
  return _mntPresetSapma(node, 'gearPreset', _mntDisliPresetValues, _MNT_VITESLER, function(k){
    var d=_mntVsKatalog().disli.filter(function(x){ return x.k===k; })[0]; return d ? d.ad : k; });
}
function _mntKonvertorSapma(node){
  return _mntPresetSapma(node, 'tcPreset', _mntKonvertorPresetValues, [['Rstall','stall oranı']], function(k){
    var c=_mntVsKatalog().tc.filter(function(x){ return x.k===k; })[0]; return c ? c.aile+' '+c.ad : k; });
}
function _mntSapmaNot(sap){
  if(!sap) return '';
  if(sap.farkli.length) return _mntNot('<b>Katalogdan sapıldı:</b> '+sap.farkli.join(', ')+' ('+_mntEsc(sap.ad)+')', 'warn');
  return _mntNot('Alanlar <b>'+_mntEsc(sap.ad)+'</b> kaydıyla birebir ('+sap.ayni.length+'/'+sap.ayni.length+')', 'ok');
}
// Seçici: aile başına grup; seçeneğin adı ailesiz (grubun adı aile)
function _mntSanzimanSecHTML(node, liste, alan, fn, etiket){
  var cur=(node.data||{})[alan]||'', aileler=[];
  liste.forEach(function(x){ if(aileler.indexOf(x.aile)<0) aileler.push(x.aile); });
  return '<select class="ve-fp-sel" id="ve-mnt-'+alan+'-'+node.id+'" onchange="'+fn+'(\''+node.id+'\',this.value)">'
    + '<option value="">— elle gir —</option>'
    + aileler.map(function(a){
        return '<optgroup label="'+_mntEsc(a)+'">'+liste.filter(function(x){ return x.aile===a; }).map(function(x){
          return '<option value="'+_mntEsc(x.k)+'"'+(x.k===cur?' selected':'')+'>'+_mntEsc(etiket(x))+'</option>'; }).join('')+'</optgroup>';
      }).join('')
    + '</select>';
}
function _mntSanzimanKatalogHTML(node){
  var K=_mntVsKatalog();
  if(!K.disli.length && !K.tc.length) return '';
  var dis=_mntSanzimanSecHTML(node, K.disli, 'gearPreset', 'veMntApplyGearPreset', function(x){ return x.etiket; });
  var tc=_mntSanzimanSecHTML(node, _mntKonvertorListesi((node.data||{}).gearPreset), 'tcPreset', 'veMntApplyTcPreset', function(x){ return x.ad+' · '+_mntS(x.stall, 2); });
  return _mntBolum('Katalog', K.disli.length+' vites konfigürasyonu · '+K.tc.length+' konvertör',
      _mntIzgara(2, '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Vites konfigürasyonu</span>'+dis+'</label>'
                  + '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Konvertör</span>'+tc+'</label>')
    + '<div id="ve-mnt-sanzkat-'+node.id+'" data-tazele>'+_mntSapmaNot(_mntDisliSapma(node))+_mntSapmaNot(_mntKonvertorSapma(node))+'</div>');
}
function _mntGearboxSection(node){
  var Z=_mntTorkZinciri(), tmil={};
  _mntGearTorqueCases(Z.t).forEach(function(c){
    tmil[c.gearLabel==='Geri' ? 'gR' : 'g'+parseInt(c.gearLabel, 10)]=c.Tshaft;
  });
  var f=_mntFoyAc([{ b:'Vites', gen:'34%' }, { b:'Oran', gen:'30%' },
                   { b:_mntSym('T<sub>mil</sub>')+' <u>[N·m]</u>', gen:'36%', sinif:'cz ay', ipucu:'Mil torku (Kriter 3)' }], 'Vites oranları');
  _MNT_VITESLER.forEach(function(v){
    f+='<tr><td>'+v[1]+'</td>'+_mntFoyGir(node, v[0], v[1]+' oranı', v[0]==='g1' ? { zorunlu:true } : null)
      + _mntFoyCoz(tmil[v[0]]!=null ? _mntS(tmil[v[0]],0) : '—', { ay:true, id:'ve-mnt-tmil-'+v[0]+'-'+node.id })+'</tr>';
  });
  var h=_mntSanzimanKatalogHTML(node);
  h+=_mntBolum('Vites oranları', 'ileri tork: 1. vites · geri tork: geri', f+_MNT_FOY_KAPA);
  h+=_mntBolum('Konvertör', '',
      _mntIzgara(2, _mntAlan(node, 'Rstall', 'Stall oranı', { zorunlu:true })
                  + _mntOku('İleri mil torku <u>[N·m]</u>', Z.ileri!=null ? _mntS(Z.ileri,0) : '—', { id:'ve-mnt-tileri-'+node.id })));
  return h;
}
// BAĞLANTI YÜZÜ (2026-11-06) — motorla şanzımanın bağlandığı düzlem: merkezi
// (eksenin ön yüzle kesişimi) ve eksenin yönü STEP'ten (veri sayfasının
// referansı — js/mount-step.js → veMntStpKayit), statik eğilme momenti sınırı
// veri sayfasından (Allison 4000: 3.500 N·m). Rapor momenti bu düzlemde keser;
// pencere sonuç göstermez. Yön yoksa boyuna eksen (+X).
var _MNT_BAG = [['bagX','bagNx'], ['bagY','bagNy'], ['bagZ','bagNz']];
function _mntBagYon(d){
  var n=_MNT_BAG.map(function(a){ return _mntNum(d[a[1]], NaN); });
  var l=Math.sqrt(n.reduce(function(t, v){ return t+(Number.isFinite(v) ? v*v : NaN); }, 0));
  return (l>0) ? n.map(function(v){ return v/l; }) : [1, 0, 0];
}
function _mntBaglantiSection(node){
  var d=node.data||{}, a=_mntBagYon(d), yaz=_MNT_BAG.some(function(x){ return !_mntBos(d[x[1]]); });
  var f=_mntFoyAc([{ b:'Eksen', gen:'34%' }, { b:'Merkez', gen:'33%' }, { b:'Eksenin yönü', gen:'33%', sinif:'cz ay' }], 'Bağlantı yüzü');
  _MNT_BAG.forEach(function(x, i){
    f+='<tr><td>'+_MNT_EKSEN[i][1]+'</td>'+_mntFoyGir(node, x[0], 'Bağlantı yüzünün merkezi '+_MNT_EKSEN[i][0])
      + _mntFoyCoz(_mntS(a[i], 3), { ay:true, ipucu:yaz ? '' : 'Boyuna eksen' })+'</tr>';
  });
  var h=_mntBolum('Bağlantı yüzü', '[mm] · global eksen', f+_MNT_FOY_KAPA);
  h+=_mntBolum('Statik eğilme momenti', '', _mntIzgara(2, _mntAlan(node, 'egSinir', 'Sınır <u>[N·m]</u>')));
  return h;
}
function _mntBaglantiDurumu(node){
  var d=node.data||{}, dolu=_MNT_BAG.filter(function(x){ return !_mntBos(d[x[0]]); }).length;
  if(!dolu) return _mntDurum('bos', 'tanımsız');
  if(dolu<3){
    var bos=_MNT_BAG.filter(function(x){ return _mntBos(d[x[0]]); })[0][0];
    return _mntDurum('eksik', 'eksik', 'Bağlantı yüzünün merkezi eksik: eğilme momenti hesaplanmaz.', 've-mnt-'+bos+'-'+node.id);
  }
  return _mntDurum('ok', _mntNum(d.egSinir,0)>0 ? 'sınır '+_mntS(_mntNum(d.egSinir),0)+' N·m' : 'sınır yok');
}
function _mntVitesDurumu(node){
  var d=node.data||{};
  if(_mntBos(d.g1) || _mntNum(d.g1,0)===0)
    return _mntDurum('eksik', 'eksik', '1. vites boş — ileri tork durumu kurulmuyor.', 've-mnt-g1-'+node.id);
  if(_mntBos(d.Rstall) || !(_mntNum(d.Rstall,0)>0))
    return _mntDurum('eksik', 'eksik', 'Stall oranı boş — tork yük durumları kurulmuyor.', 've-mnt-Rstall-'+node.id);
  var gol=_mntGolgeDurumu(node); if(gol) return gol;
  var n=_MNT_VITESLER.filter(function(v){ return v[0]!=='gR' && !_mntBos(d[v[0]]) && _mntNum(d[v[0]],0)!==0; }).length;
  if(_mntBos(d.gR) || _mntNum(d.gR,0)===0) return _mntDurum('bos', n+' vites · geri yok');
  return _mntDurum('ok', n+' + geri');
}

// TRANSFER BÖLÜMLERİ — oran ve aks payı; boş oran çözücüde 1'dir (redüksiyonsuz)
// ve bu yüzden zorunlu sayılır, aks payının 1'i ise gerçek bir varsayılan.
function _mntTransferSection(node){
  var Z=_mntTorkZinciri();
  var don=_mntDonusEtkin();
  var donus='<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Çıkış dönüşü</span>'
    + '<select class="ve-fp-sel" id="ve-mnt-donus-'+node.id+'" onchange="veMntSetDonus(\''+node.id+'\',this.value)">'
    + [['ayni','Krankla aynı'],['ters','Krankın tersi']].map(function(o){
        return '<option value="'+o[0]+'"'+(don===o[0] ? ' selected' : '')+'>'+o[1]+'</option>'; }).join('')
    + '</select></label>';
  var h=_mntTransferKatalogHTML(node);
  h+=_mntBolum('Oran ve aks payı', '',
      _mntIzgara(2, _mntAlan(node, 'iTransfer', 'Transfer oranı', { zorunlu:true }) + donus)
    + _mntIzgara(2,
        _mntVarsayilanAlan(node, 'phiFwd', 'Aks payı '+_mntSym('φ')+' · ileri', 1,
          'tam tepki', 'veMntSet(\''+node.id+'\',\'phiFwd\',this.value)')
      + _mntVarsayilanAlan(node, 'phiRev', 'Aks payı '+_mntSym('φ')+' · geri', 1,
          'tam tepki', 'veMntSet(\''+node.id+'\',\'phiRev\',this.value)')));
  h+=_mntBolum('Mil torku', '',
      _mntIzgara(2,
        _mntOku('İleri <u>[N·m]</u>', Z.ileri!=null ? _mntS(Z.ileri,0) : '—', { id:'ve-mnt-tfwd-'+node.id })
      + _mntOku('Geri <u>[N·m]</u>', Z.geri!=null ? _mntS(Z.geri,0) : '—', { id:'ve-mnt-trev-'+node.id })));
  return h;
}
function _mntTahrikDurumu(node){
  var d=node.data||{};
  if(_mntBos(d.iTransfer) || _mntNum(d.iTransfer,0)===0)
    return _mntDurum('eksik', 'eksik', 'Transfer oranı boş: çözücü 1 alır.', 've-mnt-iTransfer-'+node.id);
  var gol=_mntGolgeDurumu(node); if(gol) return gol;
  return _mntDurum('ok', 'tamam');
}

// ─── PTO GRUBU (PTO · Pompa · PTO Toplam) ────────────────────────────────────
// Bu üç bileşen aynı kütle panelini kullanır; farkları burada eklenen bilgi
// şerididir: (1) hangi giriş yolunda olduğun, (2) referans değerler, (3) iki
// yolun ÇAKIŞTIĞI durumun canlı uyarısı. "Bu bir PTO tipi mi?" sorusunun tek
// kaynağı _MNT_PTO_REF anahtarlarıdır (ayrı bir tip listesi tutulmaz).

// Panel girdilerinin placeholder'ları — kullanıcı beklenen mertebeyi görsün.
// Kaynak: ASR-SR-116 (ASFAT 8x8 Obüs) Tablo 2/3/4, mm · kg · kg·m².
var _MNT_PTO_PH = {
  'mnt-pto':       { mass:'25',   cg:['741,21','77,01','894,73'] },
  'mnt-pump':      { mass:'37',   cg:['971,21','77,01','894,73'] },
  'mnt-pto-group': { mass:'97',   cg:['1058,06','77,01','894,73'], I:['0,45','6,515','6,15'] }
};

// Referans tabloları — ASR-SR-116 Tablo 4 (parça bazında) ve Tablo 2+3 (grup).
// Rapor grup ataletini YALNIZ toplam için verir; tek tek PTO/pompa ataleti
// belgede yoktur — bu yüzden parça satırlarında atalet sütunu da yoktur.
var _MNT_PTO_REF = {
  'mnt-pto': {
    head: ['PTO parçası','m [kg]','X [mm]','Y [mm]','Z [mm]'],
    rows: [['Üst PTO','25','741,21','77,01','894,73'],
           ['Yan PTO','25','741,21','−269,52','473,30']]
  },
  'mnt-pump': {
    head: ['Pompa','m [kg]','X [mm]','Y [mm]','Z [mm]'],
    rows: [['Üst Pompa 1','37','971,21','77,01','894,73'],
           ['Üst Pompa 2','17,5','1.271,20','77,01','894,73'],
           ['Üst Pompa 3','17,5','1.481,21','77,01','894,73'],
           ['Yan Pompa 1','21','991,21','−269,52','473,30']]
  },
  'mnt-pto-group': {
    head: ['Grup','m [kg]','X [mm]','Y [mm]','Z [mm]','Ixx','Iyy','Izz'],
    rows: [['Üst PTO Grubu','97','1.058,06','77,01','894,73','0,45','6,515','6,15'],
           ['Yan PTO Grubu','46','855,34','−269,52','473,30','0,136','0,915','0,915']]
  }
};

// Topolojide İKİ giriş yolu birden kullanılıyor mu? (PTO Toplam + ayrı PTO/Pompa
// → aynı kütle iki kez sayılır). Döner: null | {groups:[ad], parts:[ad]}.
function _mntPtoConflict(){
  if(typeof nodes==='undefined' || !nodes) return null;
  var groups=[], parts=[];
  nodes.forEach(function(n){
    if(!n) return;
    if(n.type==='mnt-pto-group') groups.push(_mntNodeName(n));
    else if(n.type==='mnt-pto' || n.type==='mnt-pump') parts.push(_mntNodeName(n));
  });
  return (groups.length && parts.length) ? { groups:groups, parts:parts } : null;
}

// Referans değer tablosu — parça/grup SÜTUNDA, büyüklük SATIRDA. Eski yatay
// biçimde grubun sekiz sütunu (m, X, Y, Z, Ixx, Iyy, Izz) 380 px'lik müfettiş
// sütununa sığmıyordu; çevrilmiş biçimde sütun sayısı parça sayısı kadar.
// Etiket sütunu %28 ("Ixx [kg·m²]" sığar); dört parçada (Pompa) dolgu da
// sıklaşır — %36'lık etiketle 57 px'lik sütunda "1.271,20" 4 px kırpılıyordu.
function _mntPtoRefTable(type){
  var ref=_MNT_PTO_REF[type]; if(!ref) return '';
  var n=ref.rows.length, gen=Math.floor(72/n)+'%';
  var h=_mntFoyAc([{ b:'Büyüklük', gen:'28%' }].concat(ref.rows.map(function(r){ return { b:_mntEsc(r[0]), gen:gen }; })),
                  'ASR-SR-116 referans değerleri', 've-mnt-foy--sar'+(n>=4 ? ' ve-mnt-foy--sik' : ''));
  for(var i=1;i<ref.head.length;i++){
    h+='<tr><td>'+_mntEsc(ref.head[i])+(/^I/.test(ref.head[i]) ? ' [kg·m²]' : '')+'</td>';
    ref.rows.forEach(function(r){ h+='<td>'+_mntEsc(r[i])+'</td>'; });
    h+='</tr>';
  }
  return h+_MNT_FOY_KAPA;
}

// PTO BÖLÜMLERİ — giriş yolu (toplu/ayrıntılı), iki yolun ÇAKIŞMASI ve referans.
// Giriş yolunun ADI bölümün künyesinde (toplu · ayrıntılı); iki yolun ne
// demek olduğu kılavuzda (FEAD kural 45). İki yolun ÇAKIŞMASI kategorinin
// durumudur: eksik bandı yazar, kategori ikinci kez not basmaz.
function _mntPtoSection(node){
  var grup=(node.type==='mnt-pto-group');
  var yol=_mntIzgara(1, _mntOku('Bu bileşen', grup ? 'PTO grubunun toplamı (grup tensörüyle)' : 'parça (kütle ve CG)'));
  return _mntBolum('Giriş yolu', grup ? 'toplu' : 'ayrıntılı', yol)
    + _mntBolum('ASR-SR-116 referansı', 'ASFAT 8x8 obüs · global eksen · mertebe', _mntPtoRefTable(node.type));
}
function _mntPtoDurumu(node){
  var cf=_mntPtoConflict();
  if(cf) return _mntDurum('eksik', 'çakışma',
    'Olası çift sayım: PTO Toplam ('+cf.groups.length+') + PTO/Pompa ('+cf.parts.length+')');
  return _mntDurum('ok', node.type==='mnt-pto-group' ? 'toplu' : 'ayrıntılı');
}

// ─── MOTORUN AKSESUARLARI — kayıtlı aksesuarın kütlesi (2026-11-02) ─────────
// Alternatör ve Klima Kompresörü programın aksesuar kataloğundan seçilir
// (js/fead-accessories.js — FEAD kasnağının künyesi, anahtar BMC parça
// numarası): seçim kütleyi yazar, kaynağı künyede. Ağırlık merkezi teknik
// resimden; resimde yoksa aksesuarın orta noktası (STEP'te dış ölçülerin
// merkezi — js/mount-step.js). "— elle gir —" yalnız bağı çözer (takoz
// kütüphanesiyle aynı kural). Liste ve aile eşlemesi TEK yerde: STEP'in kütle
// kaynağıyla aynı çağrı (veMntStpAksKatalog).
function _mntAksKatalog(tip){
  return (typeof veMntStpAksKatalog==='function') ? veMntStpAksKatalog(tip) : [];
}
function _mntAksSecili(node){
  var k=(node.data||{}).aksKatalog;
  return k ? (_mntAksKatalog(node.type).filter(function(a){ return a.key===k; })[0] || null) : null;
}
function _mntAksSection(node){
  var L=_mntAksKatalog(node.type), sec=_mntAksSecili(node);
  var opt=function(a){ return '<option value="'+_mntEsc(a.key)+'"'+(sec===a?' selected':'')+'>'
    + _mntEsc(a.ad+' · '+a.key+' · '+_mntS(a.kg,1)+' kg')+'</option>'; };
  var sel='<select class="ve-fp-sel" id="ve-mnt-aks-'+node.id+'" onchange="veMntAksUygula(\''+node.id+'\',this.value)">'
    + '<option value="">— elle gir —</option>'+L.map(opt).join('')+'</select>';
  var h=_mntIzgara(1, '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Kayıtlı aksesuar</span>'+sel+'</label>');
  if(sec) h+=_mntIzgara(1, _mntOku('Kütlenin kaynağı', sec.kgKaynak || '—', { ipucu:sec.kgKaynak || '' }));
  return _mntBolum('Kayıtlı aksesuar', L.length+' kayıt', h);
}
function _mntAksDurumu(node){
  var sec=_mntAksSecili(node), d=node.data||{};
  if(!sec) return _mntDurum('ok', 'elle');
  return _mntNum(d.mass,NaN)===sec.kg ? _mntDurum('ok', 'katalog') : _mntDurum('ok', 'elle değişti');
}
function veMntAksUygula(nodeId, key){
  var node=(typeof nodes!=='undefined' && Array.isArray(nodes)) ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return false;
  var d=node.data||(node.data={});
  if(!key){
    if(d.aksKatalog===undefined) return false;
    delete d.aksKatalog;
  } else {
    var a=_mntAksKatalog(node.type).filter(function(x){ return x.key===key; })[0];
    if(!a) return false;
    d.aksKatalog=a.key; d.mass=a.kg;
  }
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
  return true;
}

// ── KÜTLE VE ATALET ─────────────────────────────────────────────────────────
var _MNT_EKSEN = [['X','X · boyuna'], ['Y','Y · yanal'], ['Z','Z · düşey']];
function _mntNoktaKutle(node){
  return '<label class="ve-fp-chk"><input type="checkbox"'+(node.data.pointMass?' checked':'')
    + ' onchange="veMntSetCheck(\''+node.id+'\',\'pointMass\',this.checked)"><span>Nokta kütle (atalet = 0)</span></label>';
}
// İKİ KATEGORİ, İKİ DURUM: KÜTLE VE CG (kütle, ağırlık merkezi ve birleşik
// CG'ye göre yeri) · ATALET (tensör ya da nokta kütle). Gövdede alt alta
// dururlar (2026-10-16'dan beri sekme değil); ayrı kalmalarının sebebi
// durumları — eksik bandı "CG eksik" ile "atalet yok"u ayrı satırda, ayrı
// bağlantıyla söyler.
function _mntKutleCgGovde(node, M){
  var d=node.data||{};
  var ph=_MNT_PTO_PH[node.type] || null;      // tipe özel yer tutucu (PTO grubu)
  var m=_mntNum(d.mass,0), pay=(M.mTop>0 && m>0) ? m/M.mTop : NaN;
  var h=_mntBolum('Kütle', '[kg]', _mntIzgara(2,
      _mntAlan(node, 'mass', 'Kütle <u>[kg]</u>', { zorunlu:true, ph:(ph ? ph.mass : '') })
    + _mntOku('Toplamdaki payı', Number.isFinite(pay) ? '%'+_mntS(pay*100,1)+' · '+_mntS(M.mTop,1)+' kg içinde' : '—',
              { id:'ve-mnt-pay-'+node.id })));
  // Ağırlık merkezi — birleşik CG'ye göre konum (kol) yanında.
  var p=[_mntNum(d.cgx,0), _mntNum(d.cgy,0), _mntNum(d.cgz,0)], F=_mntAmFarki(p, M);
  var f=_mntFoyAc([{ b:'Eksen', gen:'34%' }, { b:'CG', gen:'33%' },
                   { b:'Birleşik CG\'ye '+_mntSym('Δ'), gen:'33%', sinif:'cz ay', ipucu:'Gövde CG − birleşik CG' }], 'Ağırlık merkezi');
  ['cgx','cgy','cgz'].forEach(function(k, i){
    f+='<tr><td>'+_MNT_EKSEN[i][1]+'</td>'+_mntFoyGir(node, k, 'CG '+_MNT_EKSEN[i][0], { zorunlu:true, ph:(ph ? ph.cg[i] : '') })
      + _mntFoyCoz(F ? _mntS(F.d[i],1) : '—', { ay:true, id:'ve-mnt-amd-'+i+'-'+node.id })+'</tr>';
  });
  f+='<tr class="top"><td>Uzaklık</td><td></td>'+_mntFoyCoz(F ? _mntS(F.r,1) : '—', { ay:true, id:'ve-mnt-amr-'+node.id })+'</tr>';
  h+=_mntBolum('Ağırlık merkezi', '[mm] · global eksen', f+_MNT_FOY_KAPA);
  return h;
}
function _mntAtaletGovde(node){
  var d=node.data||{}, h='';
  var ph=_MNT_PTO_PH[node.type] || null;
  // Atalet tensörü — simetrik: üst üçgen yazılır, alt üçgen onun aynası.
  if(!d.pointMass){
    var A=_mntAtalet(d), phI=(ph && ph.I) ? ph.I : null;
    var gir=function(k, kosegen){
      var v=(d[k]!=null) ? d[k] : '', bos=_mntBos(v), i=['Ixx','Iyy','Izz'].indexOf(k);
      return '<input class="ve-mnt-mtx-g'+(kosegen&&bos?' ve-mnt-zor':'')+'" type="text" inputmode="decimal" id="ve-mnt-'+k+'-'+node.id+'"'
        + ' value="'+_mntEsc(v)+'"'+(kosegen?' data-zorunlu':'')
        + ' placeholder="'+_mntEsc(kosegen ? (phI ? phI[i] : 'zorunlu') : '0')+'"'
        + ' aria-label="'+k+'" onchange="veMntSet(\''+node.id+'\',\''+k+'\',this.value)">';
    };
    var ayna=function(k, ad){
      return '<input class="ve-mnt-mtx-g ve-mnt-ayna" value="'+_mntEsc(_mntS(_mntNum(d[k],0)))+'" readonly tabindex="-1"'
        + ' id="ve-mnt-ayna-'+ad+'-'+node.id+'" data-tazele aria-label="'+ad+' = '+k+' (simetrik)">';
    };
    var mx='<div class="ve-mnt-mtx" role="group" aria-label="Atalet tensörü">'
      + '<span></span><span class="ve-mnt-mtx-h">X</span><span class="ve-mnt-mtx-h">Y</span><span class="ve-mnt-mtx-h">Z</span>'
      + '<span class="ve-mnt-mtx-h sol">X</span>'+gir('Ixx',true)+gir('Ixy')+gir('Ixz')
      + '<span class="ve-mnt-mtx-h sol">Y</span>'+ayna('Ixy','Iyx')+gir('Iyy',true)+gir('Iyz')
      + '<span class="ve-mnt-mtx-h sol">Z</span>'+ayna('Ixz','Izx')+ayna('Iyz','Izy')+gir('Izz',true)
      + '</div>';
    var asal=A.asal ? A.asal.map(function(v){ return _mntS(v,1); }).join(' · ') : '—';
    var kutu=A.kutu ? A.kutu.map(function(v){ return _mntS(v*1000,0); }).join(' × ') : '—';
    h+=_mntBolum('Atalet tensörü', '[kg·m²] · simetrik · CG\'de',
        mx + _mntNoktaKutle(node)
      + _mntIzgara(2,
          _mntOku('Asal momentler', asal, { id:'ve-mnt-asal-'+node.id })
        + _mntOku('Eşdeğer kutu <u>[mm]</u>', kutu, { id:'ve-mnt-kutu-'+node.id,
            ipucu:'Eşdeğer dolu prizma, X × Y × Z' })));
  } else {
    // Nokta kütlede tensör SORULMAZ; bunun ne demek olduğu kılavuzda (FEAD
    // kural 45 — pencere açıklama taşımaz).
    h+=_mntBolum('Atalet', 'nokta kütle · I = 0', _mntNoktaKutle(node));
  }
  return h;
}
// Kategori durumları — çözücünün boş alan kuralından (boş = 0 ya da ret).
function _mntKutleCgDurumu(node){
  var d=node.data||{}, id=node.id;
  if(_mntBos(d.mass)) return _mntDurum('eksik', 'eksik', 'Kütle boş — çözücü bu gövdeyi reddeder (kütle ≤ 0).', 've-mnt-mass-'+id);
  if(!(_mntNum(d.mass,0)>0)) return _mntDurum('eksik', 'eksik', 'Kütle ≤ 0 — çözücü bu gövdeyi reddeder.', 've-mnt-mass-'+id);
  var ax=['cgx','cgy','cgz'];
  for(var i=0;i<3;i++){
    if(_mntBos(d[ax[i]])) return _mntDurum('eksik', 'CG eksik', 'Ağırlık merkezinin '+_MNT_EKSEN[i][0]+' alanı boş — çözücü 0 alır.', 've-mnt-'+ax[i]+'-'+id);
  }
  return _mntDurum('ok', 'tamam');
}
function _mntAtaletDurumu(node){
  var d=node.data||{}, id=node.id;
  if(d.pointMass) return _mntDurum('ok', 'nokta kütle');
  var A=_mntAtalet(d);
  if(A.bos) return _mntDurum('eksik', 'atalet yok', 'Atalet tensörü boş: çözücü sıfır alır.', 've-mnt-Ixx-'+id);
  var dk=['Ixx','Iyy','Izz'];
  for(var j=0;j<3;j++){
    if(_mntBos(d[dk[j]])) return _mntDurum('eksik', 'atalet eksik', dk[j]+' boş — çözücü 0 alır.', 've-mnt-'+dk[j]+'-'+id);
  }
  if(A.ihlal) return _mntDurum('eksik', 'fiziksel değil', 'Atalet tensörü fiziksel değil ('+A.ihlal+'): modlar yanlış çıkar.', 've-mnt-Ixx-'+id);
  return _mntDurum('ok', 'tamam');
}
// Gövdenin TOPLU hükmü (iki kategorinin ilk eksiği) — sihirbaz ve testler okur.
function _mntKutleDurumu(node){
  var D=_mntKutleCgDurumu(node);
  if(D.d!=='ok') return D;
  D=_mntAtaletDurumu(node);
  return (D.d==='ok') ? _mntDurum('ok', 'tamam') : D;
}

// KÜTLE GÖVDESİ PENCERESİ — kategoriler: Kütle ve CG · Atalet + tipe özel
// üçüncüsü (Motor ve tork · Vitesler · Tahrik · PTO grubu); sağ sütunda
// güç grubundaki yeri (aksonometrik kroki). Sonuç yok — yalnız raporda.
function getMntMassPropertiesHTML(node){
  _mntEnsureMassData(node);
  var M=_mntCanliModel();
  var kategoriler=[
    { k:'kutle', ad:'Kütle ve CG', govde:_mntKutleCgGovde(node, M), durum:_mntKutleCgDurumu(node) },
    { k:'atalet', ad:'Atalet', govde:_mntAtaletGovde(node), durum:_mntAtaletDurumu(node) }
  ];
  if(node.type==='mnt-motor') kategoriler.push({ k:'motor', ad:'Motor ve tork', govde:_mntEngineSection(node), durum:_mntMotorDurumu(node) });
  else if(node.type==='mnt-gearbox'){
    kategoriler.push({ k:'vites', ad:'Vitesler', govde:_mntGearboxSection(node), durum:_mntVitesDurumu(node) });
    kategoriler.push({ k:'baglanti', ad:'Bağlantı yüzü', govde:_mntBaglantiSection(node), durum:_mntBaglantiDurumu(node) });
  }
  else if(node.type==='mnt-transfer') kategoriler.push({ k:'tahrik', ad:'Tahrik', govde:_mntTransferSection(node), durum:_mntTahrikDurumu(node) });
  else if(_MNT_PTO_REF[node.type]) kategoriler.push({ k:'pto', ad:'PTO grubu', govde:_mntPtoSection(node), durum:_mntPtoDurumu(node) });
  else if(_mntAksKatalog(node.type).length) kategoriler.push({ k:'katalog', ad:'Katalog', govde:_mntAksSection(node), durum:_mntAksDurumu(node) });
  return _mntPencereKabuk(node, kategoriler, _mntKrokiHTML(node, M));
}

// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ PENCERESİ — Tip ve rijitlik · Konum
// ════════════════════════════════════════════════════════════════════════════
var _MNT_RIJ = [['kxs','kxd','X · boyuna','x'], ['kys','kyd','Y · yanal','y'], ['kzs','kzd','Z · düşey','z']];
// Dinamik/statik oranının eksenler arası yayılımı — eksen TAKASININ izi.
// Tulga'nın iki TK040 takozunda dinamik X ile Z takaslı girilmişti ve statik
// çözüm onu hiç göstermiyordu (k_stat'a dokunmuyor); 27 katalog girdisinin en
// kötüsü 1,117, takaslı hâl 4,701 (mount-example-library-match.test.js).
var _MNT_ORAN_YAYILIM_SINIR = 1.5;
function _mntOranYayilim(d){
  var r=_MNT_RIJ.map(function(a){ var s=_mntNum(d[a[0]],NaN), k=_mntNum(d[a[1]],NaN); return (s>0 && k>0) ? k/s : NaN; });
  if(r.some(function(x){ return !Number.isFinite(x); })) return null;
  return { oranlar:r, yayilim:Math.max.apply(null, r)/Math.min.apply(null, r) };
}

// KÜTÜPHANE EŞLEŞMESİ — seçili girdiyle (yoksa altı değeri BİREBİR tutan tek
// girdiyle) karşılaştırma: kaç değer aynı, hangileri elle değişmiş, girdinin
// nonlineer yasası bu takozda var mı. Seçim yalnız bir başlangıçtır.
var _MNT_RIJ_KUT = [['kxs','sx','kx stat.'], ['kys','sy','ky stat.'], ['kzs','sz','kz stat.'],
                    ['kxd','dx','kx din.'], ['kyd','dy','ky din.'], ['kzd','dz','kz din.']];
function _mntYasaVar(o){
  return ['X','Y','Z'].some(function(A){
    var f=o['fit'+A], c=o['curve'+A];
    return (f && (f.form==='poly' || f.form==='asym')) || (Array.isArray(c) && c.length>=2);
  });
}
function _mntKutuphaneEslesme(node){
  var d=node.data||{}, map=veMntGetLibraryMap();
  // İki tarafı da BOŞ alan eşittir: AMC'nin radyalini yayımlamadığı tip uygulanınca
  // takozun X/Y'si de boş — "elle değiştirildi" sayılmaz. Bağsız takozun tip araması
  // en az bir dolu değer ister: boş takoz rijitliksiz tiple (DSM) eşleşmez.
  var bos=function(v){ return !Number.isFinite(_mntNum(v,NaN)); };
  var esit=function(a, b){ if(bos(a) && bos(b)) return true;
    var x=_mntNum(a,NaN), y=_mntNum(b,NaN);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x-y)<=1e-9*Math.max(1, Math.abs(y)); };
  var say=function(e){ var ayni=0, farkli=[];
    _MNT_RIJ_KUT.forEach(function(a){ if(esit(d[a[0]], e[a[1]])) ayni++; else farkli.push(a[2]); });
    return { ayni:ayni, farkli:farkli }; };
  var e=(d.libKey && map[d.libKey]) ? map[d.libKey] : null;
  if(!e && _MNT_RIJ_KUT.some(function(a){ return !bos(d[a[0]]); })){
    var tam=Object.keys(map).map(function(k){ return map[k]; }).filter(function(x){ return say(x).ayni===6; });
    if(tam.length===1) e=tam[0];
  }
  if(!e) return null;
  var s=say(e);
  return { e:e, ayni:s.ayni, farkli:s.farkli, yasaKut:_mntYasaVar(e), yasaTk:_mntYasaVar(d) };
}
function _mntKutuphaneNotu(node){
  var E=_mntKutuphaneEslesme(node), d=node.data||{};
  if(!E) return _mntNot(d.libKey ? 'Seçili kütüphane girdisi artık yok — değerler elle.'
                                 : 'Kütüphanede eşleşen takoz yok; değerler elle.', '');
  var ad='<b>'+_mntEsc(E.e.name)+'</b>';
  var yasa=(E.yasaKut && !E.yasaTk) ? ' · kütüphanedeki nonlineer yasası bu takozda yok' : '';
  var tadi=_mntLibTahminAdi(E.e);
  var tah=_mntTakozTahmin(node).length ? ' · '+tadi.charAt(0).toLocaleLowerCase('tr')+tadi.slice(1)+' ('+_mntEsc(_mntLibTahminKunye(E.e))+')' : '';
  if(E.farkli.length) return _mntNot(ad+' ile '+E.ayni+'/6 değer aynı; '+E.farkli.join(', ')+' elle değiştirildi'+yasa+tah+'.', 'warn');
  return _mntNot(ad+' ile 6/6 değer aynı'+yasa+tah+'.', '');
}
// TAKOZUN TAHMİNİ RİJİTLİKLERİ (Canlı Not 113): bağlı tipin tahminli alanlarından takozda
// tipin değerini taşıyanlar ([kxs…kzd] alan adları) — elle girilen değer tahmin değildir.
// Takoz penceresi (föy hücresi, tip notu) ve rapor (Tablo 2) bunu okur.
function _mntTakozTahmin(node){
  var E=_mntKutuphaneEslesme(node), T=E ? _mntLibTahmin(E.e) : [];
  if(!T.length) return [];
  var d=node.data||{};
  return _MNT_RIJ_KUT.filter(function(a){
    if(T.indexOf(a[1])<0) return false;
    var x=_mntNum(d[a[0]],NaN), y=_mntNum(E.e[a[1]],NaN);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x-y)<=1e-9*Math.max(1, Math.abs(y));
  }).map(function(a){ return a[0]; });
}

// İKİ KATEGORİ, İKİ DURUM: TİP VE RİJİTLİK (kütüphane seçimi, rijitlik föyü,
// yasa notu, kapasite) · KONUM (konum ve birleşik CG'ye farkı). Tek gövdede
// alt alta durur (2026-10-16, kullanıcı: *"'Tip ve rijitlik' ve 'Konum'.
// Bunları ayrı pencereler olarak vermeye gerek yok"*). Konum föyünün
// "Statik sehim" sütunu ve kapasitenin "Statik yük" okuması sonuçtu — kalktı
// (sonuç yalnız raporda).
function _mntTakozTipGovde(node){
  var d=node.data||{};
  var lib=veMntGetLibraryList();
  // Seçili tip notun eşleşmesinden (_mntKutuphaneEslesme): bağsız ama altı
  // değeri bir tiple aynı takoz o tipi gösterir. Örnek modellerin takozları
  // bağsız kaydedilmişti; liste "— elle gir —" derken not tipi adlandırıyordu
  // (ASFAT 6/6, Siper 6/6, Tulga 5/5 takoz).
  var E=_mntKutuphaneEslesme(node), secili=E ? E.e.key : '';
  var opt=function(e){ return '<option value="'+_mntEsc(e.key)+'"'+(secili===e.key?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; };
  var sel='<select class="ve-fp-sel" id="ve-mnt-libKey-'+node.id+'" onchange="veMntApplyLib(\''+node.id+'\',this.value)">'
    + '<option value="">— elle gir —</option>';
  // Takoz Özellikleri'nin Marka listesiyle aynı gruplar: katalog markaları, sonda Özel
  // takozlar (Canlı Not 106: *"Takoz tiplerini markalarına göre kategorize edelim"*);
  // sayaç yok (Canlı Not 65)
  veMntLibMarkalar(lib).forEach(function(g){
    sel+='<optgroup label="'+_mntEsc(g.ad)+'">'+g.girdiler.map(opt).join('')+'</optgroup>';
  });
  sel+='</select>';
  var h=_mntBolum('Takoz tipi', '',
      _mntIzgara(1, '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Kütüphane</span>'+sel+'</label>')
    + '<div id="ve-mnt-libnot-'+node.id+'" data-tazele>'+_mntKutuphaneNotu(node)+'</div>');
  // Rijitlik — statik ve dinamik aynı satırda; oran türetilir.
  var f=_mntFoyAc([{ b:'Eksen', gen:'31%' }, { b:'Statik', gen:'23%' }, { b:'Dinamik', gen:'23%' },
                   { b:'Din./stat.', gen:'23%', sinif:'cz ay' }], 'Rijitlik');
  var tahT=_mntTakozTahmin(node);
  _MNT_RIJ.forEach(function(r){
    var s=_mntNum(d[r[0]],NaN), k=_mntNum(d[r[1]],NaN);
    f+='<tr><td>'+r[2]+'</td>'+_mntFoyGir(node, r[0], 'Statik k'+r[3], { zorunlu:true, tahmin:tahT.indexOf(r[0])>=0 })
      + _mntFoyGir(node, r[1], 'Dinamik k'+r[3], { zorunlu:true, tahmin:tahT.indexOf(r[1])>=0 })
      + _mntFoyCoz((s>0 && k>0) ? _mntS(k/s,2) : '—', { ay:true, id:'ve-mnt-oran-'+r[3]+'-'+node.id })+'</tr>';
  });
  var O=_mntOranYayilim(d), sinir=_mntS(_MNT_ORAN_YAYILIM_SINIR,1);
  var kapi='<div class="ve-fp-gate ve-mnt-ic" data-d="'+(O ? (O.yayilim>_MNT_ORAN_YAYILIM_SINIR ? 'warn' : 'ok') : 'wait')+'"'
    + ' id="ve-mnt-oranyay-'+node.id+'" data-tazele title="'+_mntEsc(O
        ? 'Din./stat. oranı yayılımı '+_mntS(O.yayilim,2)+' · sınır '+sinir
        : 'Altı rijitlik eksik')+'">'
    + '<i></i>Eksenler arası oran yayılımı<span>'+(O ? _mntS(O.yayilim,2)+' · sınır '+sinir : '—')+'</span></div>';
  h+=_mntBolum('Rijitlik', '[N/mm]', f+_MNT_FOY_KAPA+kapi);
  h+='<div id="ve-mnt-yasa-'+node.id+'" data-tazele>'+_mntMountCurveNote(node)+'</div>';
  // Kapasite hesabın GİRDİSİ DEĞİL, raporun kapasite kullanımını ölçtüğü
  // sınır: çözücü onu görmez.
  h+=_mntBolum('Kapasite', 'isteğe bağlı · hesaba girmez', _mntIzgara(2,
      _mntAlan(node, 'maxLoad', 'Maks. eksenel yük <u>[kg]</u>', { ph:'katalogdan' })));
  // Yanal durdurucu — takozun yanal (Y) sehimi bu boşlukta metal-metal temasa oturur.
  // Takoz tipinin değil bağlantının özelliği: kütüphane uygulaması dokunmaz.
  h+=_mntBolum('Durdurucu', 'isteğe bağlı', _mntIzgara(2,
      _mntAlan(node, 'bosY', 'Yanal boşluk <u>[mm]</u>', { ph:'yok', ipucu:d.bosYKaynak })));
  return h;
}
function _mntTakozKonumGovde(node, M){
  var d=node.data||{};
  // Konum ve birleşik CG'ye göre yeri (canlı model).
  var P=[_mntNum(d.x,0), _mntNum(d.y,0), _mntNum(d.z,0)], F=_mntAmFarki(P, M);
  var f2=_mntFoyAc([{ b:'Eksen', gen:'20%' }, { b:'Konum', gen:'40%' },
                    { b:'CG\'ye '+_mntSym('Δ'), gen:'40%', sinif:'cz ay', ipucu:'Takoz konumu − birleşik CG' }], 'Konum');
  ['x','y','z'].forEach(function(k, i){
    f2+='<tr><td>'+_MNT_EKSEN[i][0]+'</td>'+_mntFoyGir(node, k, 'Konum '+_MNT_EKSEN[i][0], { zorunlu:true })
      + _mntFoyCoz(F ? _mntS(F.d[i],1) : '—', { ay:true, id:'ve-mnt-tamd-'+i+'-'+node.id })+'</tr>';
  });
  return _mntBolum('Konum', '[mm] · global eksen', f2+_MNT_FOY_KAPA);
}
// Kategori durumları — çözücünün boş alan kuralından (boş ya da ≤ 0 rijitlik
// modeli reddeder, boş konum 0 alınır) ve eksen takası bekçisinden.
function _mntTakozTipDurumu(node){
  var d=node.data||{}, id=node.id;
  for(var i=0;i<_MNT_RIJ.length;i++){
    var r=_MNT_RIJ[i];
    if(!(_mntNum(d[r[0]],0)>0)) return _mntDurum('eksik', 'rijitlik eksik', 'Statik k'+r[3]+' boş ya da ≤ 0 — çözücü modeli reddeder.', 've-mnt-'+r[0]+'-'+id);
    if(!(_mntNum(d[r[1]],0)>0)) return _mntDurum('eksik', 'rijitlik eksik', 'Dinamik k'+r[3]+' boş ya da ≤ 0 — çözücü modeli reddeder.', 've-mnt-'+r[1]+'-'+id);
  }
  var O=_mntOranYayilim(d);
  if(O && O.yayilim>_MNT_ORAN_YAYILIM_SINIR) return _mntDurum('eksik', 'oran?',
    'Din./stat. oranı yayılımı '+_mntS(O.yayilim,2)+' > '+_mntS(_MNT_ORAN_YAYILIM_SINIR,1)+': eksen takası olabilir.', 've-mnt-kxd-'+id);
  return _mntDurum('ok', 'tamam');
}
function _mntTakozKonumDurumu(node){
  var d=node.data||{}, id=node.id, ax=['x','y','z'];
  for(var j=0;j<3;j++){
    if(_mntBos(d[ax[j]])) return _mntDurum('eksik', 'konum eksik', 'Konum '+_MNT_EKSEN[j][0]+' boş — çözücü 0 alır.', 've-mnt-'+ax[j]+'-'+id);
  }
  return _mntDurum('ok', 'tamam');
}

// TAKOZ PENCERESİ — kategoriler: Tip ve rijitlik · Konum; sağ sütunda güç
// grubundaki yeri (aksonometrik kroki, bu takoz vurgulu). Sonuç yok.
function getMntMountPropertiesHTML(node){
  if(!node.data) node.data={};
  var M=_mntCanliModel();
  var kategoriler=[
    { k:'tip', ad:'Tip ve rijitlik', govde:_mntTakozTipGovde(node), durum:_mntTakozTipDurumu(node) },
    { k:'konum', ad:'Konum', govde:_mntTakozKonumGovde(node, M), durum:_mntTakozKonumDurumu(node) }
  ];
  return _mntPencereKabuk(node, kategoriler, _mntKrokiHTML(node, M));
}

// Takoz'a uygulanmış nonlineer yasa için SALT-OKUNUR bilgi notu. Yasa artık
// "Takoz Özellikleri" (kütüphane) bileşeninde bir takoz TİPİNİN özelliği olarak
// tanımlanır; kütüphaneden uygulandığında node.data'ya kopyalanır. Burada
// yalnız gösterilir, düzenlenmez (düzenleme kütüphane panelinde).
//
// İKİ BİÇİM VAR ve ikisi de nonlineerdir (çekirdek mountHasCurve ikisini de
// sayar, veMntApplyLib ikisini de kopyalar):
//   fit<EKSEN>    analitik yasa (poly / asym)     — TK035, TK040, TK050
//   curve<EKSEN>  ölçülmüş nokta tablosu (≥2)
// Bu not eskiden yalnız curve'e bakıyordu: kütüphaneden TK035 uygulanan bir
// takozda kart HİÇ çıkmıyor, takoz sıradan lineer bir takoz gibi görünüyordu —
// oysa çözücü onu Newton ile çözüyor. Aynı yanlış ölçüt raporun kapağında da
// vardı (cp-mount-report.js _mntRepNLMounts).
function _mntMountCurveNote(node){
  var d=node.data||{};
  var axes=[], anyFit=false, anyTab=false;
  [['X','x'],['Y','y'],['Z','z']].forEach(function(a){
    var f=d['fit'+a[0]];
    var p=d['curve'+a[0]];
    // Biçim kapısı çekirdekle AYNI (makeAxisLaw): tanınmayan bir form nonlineer
    // sayılmaz — sayılsaydı panel "eğri var" derken çözücü onu atardı.
    if(f && (f.form==='poly' || f.form==='asym')){ axes.push(a[1]); anyFit=true; }
    else if(Array.isArray(p) && p.length>=2){ axes.push(a[1]); anyTab=true; }
  });
  if(!axes.length) return '';
  var labels=axes.join(', ');
  var kaynak = (anyFit&&anyTab) ? 'analitik fit + ölçüm noktaları'
             : anyFit ? 'analitik fit' : 'ölçülmüş nokta tablosu';
  // Durum: yasanın varlığı, KAYNAĞI (değerin nereden geldiği — FEAD'in 'i'si
  // gibi) ve çözücünün yolu; burada düzenlenmez.
  return _mntBolum('Kuvvet–sehim yasası ('+labels+')', _mntEsc(kaynak)+' · Takoz Özellikleri',
    _mntNot('Çözüm yöntemi: Newton', ''));
}

// ════════════════════════════════════════════════════════════════════════════
//  YERİNDE TAZELEME — pencere KURULMAZ
// ════════════════════════════════════════════════════════════════════════════
// Sayı alanları (veMntSet) pencereyi yeniden kurmuyor — kursaydı Sekme ile
// geçilen bir sonraki alanın odağı düşerdi (bu deponun tekrar eden dersi,
// FEAD kural 11/35). Ama türetilen değerler (pay, CG farkı, oran, kroki,
// kategori durumu ve eksik bandı, eylemin hazırlığı) o zaman bir düzenleme
// geride kalırdı: kütleyi
// değiştiren kullanıcı eski payı okurdu. `saveState` "girdi değişti" olayının
// tek kaynağı ve bunu oradan çağırır; çözüm bitince de çağrılır. Yalnız
// `[data-tazele]` taşıyan öğelere, varsayılanlı alanlara, kategori durumlarına
// ve banda dokunur — yazılan GİRDİLERE DOKUNMAZ.
function _mntPencereHTML(node){
  if(!node) return '';
  if(node.type==='mnt-mount') return getMntMountPropertiesHTML(node);
  if(node.type==='mnt-solver') return getMntSolverPropertiesHTML(node);
  if(node.type==='mnt-library') return getMntLibraryPropertiesHTML(node);
  if(node.type==='mnt-report') return getMntReportPropertiesHTML(node);
  if(node.type==='mnt-2dview') return getMnt2DViewPropertiesHTML(node, true);
  if(node.type==='mnt-parametric' && typeof getMntParamPropertiesHTML==='function') return getMntParamPropertiesHTML(node);
  if((_mntDef(node)||{}).isMountBody || _MNT_POINTMASS_DEFAULT[node.type]!==undefined || _MNT_PTO_REF[node.type]
     || /^mnt-(motor|gearbox|bracket|transfer)$/.test(node.type)) return getMntMassPropertiesHTML(node);
  return '';
}
function veMntPencereTazele(){
  if(typeof document==='undefined' || !document.querySelector) return 0;
  var kok=document.querySelector('.ve-properties-content [data-mnt-pencere]');
  if(!kok) return 0;
  var node=_mntDugum(kok.getAttribute('data-mnt-pencere'));
  if(!node) return 0;
  var html=_mntPencereHTML(node); if(!html) return 0;
  var tmp=document.createElement('div'); tmp.innerHTML=html;
  var bul=function(id){ return tmp.querySelector('[id="'+id+'"]'); };
  var n=0;
  Array.prototype.forEach.call(kok.querySelectorAll('[data-tazele][id]'), function(el){
    if(!el.isConnected) return;                       // dışındaki tazelenen öğeyle gitti
    var yeni=bul(el.id);
    if(yeni && el.outerHTML!==yeni.outerHTML){ el.outerHTML=yeni.outerHTML; n++; }
  });
  // Varsayılanlı alan: değer ve 'i' (odaktaki alana yazılmaz).
  Array.prototype.forEach.call(kok.querySelectorAll('[data-mnt-vars]'), function(el){
    var yeni=tmp.querySelector('[data-mnt-vars="'+el.getAttribute('data-mnt-vars')+'"]');
    if(!yeni) return;
    el.setAttribute('data-kaynak', yeni.getAttribute('data-kaynak'));
    var a=el.querySelector('input'), b=yeni.querySelector('input');
    if(a && b && a!==document.activeElement && String(a.value)!==String(b.getAttribute('value'))){ a.value=b.getAttribute('value'); n++; }
    var ia=el.querySelector('.ve-fp-i'), ib=yeni.querySelector('.ve-fp-i');
    if(ia && ib && ia.outerHTML!==ib.outerHTML) ia.outerHTML=ib.outerHTML;
  });
  // Seçici modelin değerini izler (odaktaki seçiciye yazılmaz; seçici kurulmaz).
  Array.prototype.forEach.call(kok.querySelectorAll('select[data-mnt-izle][id]'), function(el){
    var yeni=bul(el.id), o=yeni && yeni.querySelector('option[selected]');
    if(o && el!==document.activeElement && el.value!==o.getAttribute('value')){ el.value=o.getAttribute('value'); n++; }
  });
  // Zorunlu alanın tonu yazılan değeri izler.
  Array.prototype.forEach.call(kok.querySelectorAll('input[data-zorunlu]'), function(i){
    var bos=String(i.value).trim()==='';
    var td=i.parentNode;
    if(td && td.tagName==='TD') td.classList.toggle('zor', bos);
    else i.classList.toggle('ve-mnt-zor', bos);
  });
  // Kategori durumları ve eksik bandı
  var gov=document.getElementById('ve-fp-panes-'+node.id), govY=bul('ve-fp-panes-'+node.id);
  if(gov && govY){
    Array.prototype.forEach.call(gov.children, function(kat){
      if(!kat.classList.contains('ve-fp-kat')) return;
      var y=govY.querySelector('.ve-fp-kat[data-k="'+kat.getAttribute('data-k')+'"]'); if(!y) return;
      var yd=y.getAttribute('data-d');
      if(kat.getAttribute('data-d')===yd) return;
      if(yd) kat.setAttribute('data-d', yd); else kat.removeAttribute('data-d');
      n++;
    });
    var bant=document.getElementById('ve-fp-eksik-'+node.id), bantY=bul('ve-fp-eksik-'+node.id);
    if(bant && bantY){ if(bant.outerHTML!==bantY.outerHTML){ bant.outerHTML=bantY.outerHTML; n++; } }
    else if(bant){ bant.remove(); n++; }
    else if(bantY){ gov.insertAdjacentHTML('beforebegin', bantY.outerHTML); n++; }
  }
  return n;
}

// ─── Setters ─────────────────────────────────────────────────────────────────
function veMntSet(nodeId, key, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data[key]=val;
  if(typeof saveState==='function') saveState();
}
function veMntSetCheck(nodeId, key, checked){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data[key]=!!checked;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node); // atalet alanlarını göster/gizle
}
function veMntApplyLib(nodeId, key){
  var node=(typeof nodes!=='undefined' && Array.isArray(nodes)) ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  // "— elle gir —": yalnız kütüphane BAĞI kalkar, değerler yerinde kalır
  // (kullanıcı katalogdan yükleyip elle rötuşlayabilsin — motor kataloğuyla aynı).
  if(!key){
    if(node.data && node.data.libKey!==undefined){
      delete node.data.libKey;
      if(typeof saveState==='function') saveState();
    }
    return;
  }
  if(!node.data) node.data={};
  if(!_mntLibUygula(node.data, key)) return;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
// KÜTÜPHANE GİRDİSİNİ BİR TAKOZUN VERİSİNE YAZ — TEK YAZICI. Takoz paneli ve
// sihirbazın Takozlar adımı bunu çağırır (FEAD kural 24'ün dersi: bir girdi
// iki yüzeyde soruluyorsa yazıcısı tek olmalı — biri kapasiteyi temizleyip
// öbürü temizlemeseydi tip değişince eski kapasite sessizce sürerdi).
// `d`: takozun veri nesnesi (node.data ya da sihirbazın takoz satırı).
// Döner: yazıldı mı (bilinmeyen anahtar → false, hiçbir alana dokunulmaz).
function _mntLibUygula(d, key){
  return _mntLibGirdiYaz(d, key ? veMntGetLibraryMap()[key] : null, key);
}
// Yazıcının kendisi — girdi (`m`, birleşik haritanın kaydı) elde. Katalog
// taraması haritayı bir kez kurar ve her kombinasyonda bunu çağırır
// (js/cp-mount-param.js); ikinci bir yazıcı açılmaz.
function _mntLibGirdiYaz(d, m, key){
  if(!m || !d) return false;
  d.kxs=m.sx; d.kys=m.sy; d.kzs=m.sz;
  d.kxd=m.dx; d.kyd=m.dy; d.kzd=m.dz; d.libKey=key;
  // Taşıma kapasitesi de takoz TİPİNİN özelliğidir. Kütüphane girdisinde
  // tanımlıysa kopyalanır; tanımsızsa Takoz'daki eski değer TEMİZLENİR —
  // yoksa başka bir takoz tipine geçildiğinde önceki tipin kapasitesi sessizce
  // devam eder ve "%42 kullanımdasın" gibi yanlış bir cümle üretilirdi.
  if(m.maxLoad!==undefined && m.maxLoad!==null && _mntNum(m.maxLoad,0)>0) d.maxLoad=m.maxLoad;
  else delete d.maxLoad;
  // Nonlineer yasa kütüphane girdisinin özelliği: uygularken 3 ekseni de Takoz'a
  // KOPYALA (anlık snapshot; gather okur). Eksen başına fit ÖNCELİKLİ; yoksa nokta
  // tablosu; ikisi de yoksa o eksende eski yasa temizlenir (lineere döner).
  ['X','Y','Z'].forEach(function(A){
    var fit=m['fit'+A], cur=m['curve'+A];
    if(fit && (fit.form==='poly'||fit.form==='asym')){
      d['fit'+A]=JSON.parse(JSON.stringify(fit));   // fabrika mutasyona uğramaz
      delete d['curve'+A];
    } else if(Array.isArray(cur) && cur.length>=2){
      d['curve'+A]=cur.map(function(p){ return [_mntNum(p[0]), _mntNum(p[1])]; });
      delete d['fit'+A];
    } else {
      delete d['fit'+A]; delete d['curve'+A];
    }
  });
  return true;
}

// (Nonlineer z-eğrisi düzenleme artık Takoz Özellikleri kütüphane panelinde —
//  veMntLibCurve* — takoz TİPİNE bağlı; veMntApplyLib uygulanınca Takoz'a kopyalar.)

// ════════════════════════════════════════════════════════════════════════════
//  ÖRNEK YÜKLEYİCİ — hazır doğrulama modellerini topolojiye kurar
// ════════════════════════════════════════════════════════════════════════════
// Örnek modelleri başlangıç sayfası seçer (js/cp-mount-baslangic.js → veMntOrnekYukle).
// "Başlangıç ve Örnekler" bileşeni ve penceresi KALKTI (Canlı Not 110): kayıt defteri
// erişimi, topoloji şeması, künye föyü ve pencere kapıları onunla birlikte gitti.
// Yeni örnek eklemek: mount-core.js MOUNT_EXAMPLES defterine bir giriş ekle — başka
// hiçbir yeri değiştirmeye gerek yoktur (başlangıç sayfası + yükleyici buradan okur).

// Örnek adı → kanvas kütle-gövdesi tipi (test buildTTARTopology ile aynı eşleme).
// Yükleyici önce c.kind'i, yoksa bu adı kullanır.
// PTO kalıpları motor/şanzımandan ÖNCE denenir ("PTO Grubu" içinde motor/şanzıman
// geçmez ama sıralama niyeti açık tutsun); grup → pompa → PTO sırası zorunlu:
// "Top PTO Group" hem /pto/ hem /group/ eşler, en özgül olan kazanmalı.
function _mntExampleBodyType(name){
  return /(pto|pompa|pump)[^a-zçğıöşü]*(grubu|grup|group|toplam|total)|(grubu|grup|group|toplam|total)[^a-zçğıöşü]*(pto|pompa|pump)/i.test(name) ? 'mnt-pto-group'
    : /pompa|pump/i.test(name) ? 'mnt-pump'
    : /\bpto\b|kuyruk\s*mili/i.test(name) ? 'mnt-pto'
    : /motor/i.test(name) ? 'mnt-motor'
    : /şanz|sanz/i.test(name) ? 'mnt-gearbox'
    : /şaft|saft|shaft/i.test(name) ? 'mnt-shaft'
    : /cradle|braket|bracket/i.test(name) ? 'mnt-bracket' : 'mnt-transfer';
}

// Örnek modelinin yerel-piksel yerleşimi — HEM otomatik şema HEM yükleyici bunu
// kullanır, böylece görsel ile "Aktar"ın kurduğu topoloji birebir aynıdır.
// Koordinatlar STARTER yerleşimiyle uyumlu: kütleler orta bant (ly=205),
// takozlar ilk yarısı üst (ly=40), kalanı alt (ly=360). Bir bileşen veya takoz
// kendi at:[lx,ly] konumunu taşırsa o kullanılır (görsele tam uyum).
function _mntExampleLayout(model){
  var comps=(model&&model.components)||[], mounts=(model&&model.mounts)||[];
  var bodyY=205, half=Math.ceil(mounts.length/2);
  var bodies=comps.map(function(c,i){
    return (c.at&&c.at.length===2) ? {lx:c.at[0], ly:c.at[1]} : {lx:130+i*95, ly:bodyY};
  });
  var mnts=mounts.map(function(m,i){
    if(m.at&&m.at.length===2) return {lx:m.at[0], ly:m.at[1]};
    var top=i<half, col=top?i:(i-half);
    return {lx:140+col*140, ly: top?40:360};
  });
  return { bodies:bodies, mnts:mnts, bodyY:bodyY, half:half };
}

// Örnek modeli tutarlılık kontrolü — uyarı nesneleri döner ({level,msg}).
function _mntExampleValidate(){
  var g = _mntGatherForSolver();
  var out=[];
  if(g.components.length===0) out.push({level:'err', msg:'Kütle gövdesi yok.'});
  if(g.mounts.length===0) out.push({level:'err', msg:'Takoz yok (en az 3).'});
  else if(g.mounts.length<3) out.push({level:'warn', msg:'Az takoz: '+g.mounts.length+' (en az 3).'});
  else if(g.mounts.length>4) out.push({level:'warn', msg:'Fazla takoz: '+g.mounts.length+' (tipik 3–4).'});
  g.components.forEach(function(c){ if(!(_mntNum(c.mass)>0)) out.push({level:'err', msg:_mntEsc(c.name)+': kütle tanımsız/sıfır.'}); });
  g.mounts.forEach(function(m){
    if(!(_mntNum(m.kzs)>0)) out.push({level:'warn', msg:_mntEsc(m.name)+': düşey (z) statik rijitlik tanımsız.'});
    if(!Number.isFinite(_mntNum(m.z,NaN))) out.push({level:'warn', msg:_mntEsc(m.name)+': z konumu tanımsız.'});
  });
  // PTO grubu: iki giriş yolu (toplu / ayrıntılı) aynı anda kullanılırsa kütle
  // İKİ KEZ sayılır — çözücü sessizce "makul ama yanlış" bir toplam üretir.
  var pc=_mntPtoConflict();
  if(pc) out.push({level:'warn', msg:'Olası çift sayım: PTO Toplam ('+pc.groups.length+') + PTO/Pompa ('+pc.parts.length+')'});
  var hasSolver = (typeof nodes!=='undefined') && nodes.some(function(n){ return (_mntDef(n)||{}).isMountSolver; });
  if(!hasSolver) out.push({level:'warn', msg:'Çözücü yok. '+veYon('Bileşenler’den ekleyin.')});
  return out;
}

// Örnek yüklenince tutarsızlık varsa tek bildirim (hata sayısıyla). Eskiden denetim
// "Başlangıç ve Örnekler" penceresinin Tutarlılık uyarıları bölümünde de görünürdü.
function _mntRenderExampleReport(warnings, silent){
  var errN=warnings.filter(function(w){return w.level==='err';}).length;
  if(!silent && warnings.length && typeof showToast==='function') showToast('Örnek yüklendi — '+warnings.length+' uyarı ('+errN+' hata).', errN?'warning':'info');
}

// Ayrıştırılmış JSON'u veLoadTabState'in beklediği "state" biçimine getir.
// Kabul edilenler: {format,version,nodes,connections,…} · {state:{…}} · ham state
// · TAM PROJE KAYDI {tabs:[{state:{…}}],activeTabIdx}. Sonuncusu şart: kullanıcı
// örneği çoğu zaman "Kaydet" ile ürettiği proje dosyasından getirir; o biçim
// reddedilirse örnek sessizce "yüklenemedi" olur.
function _mntTopoState(j){
  if(!j) return null;
  var s = (j.state && j.state.nodes) ? j.state : (j.nodes ? j : null);
  if(!s && Array.isArray(j.tabs) && j.tabs.length){
    // Önce aktif sekme, sonra sırayla ilk DOLU sekme (boş sekme örnek değildir).
    var order = [], ai = j.activeTabIdx;
    if(typeof ai === 'number' && j.tabs[ai]) order.push(ai);
    j.tabs.forEach(function(_, i){ if(i !== ai) order.push(i); });
    for(var k = 0; k < order.length && !s; k++){
      var ts = j.tabs[order[k]] && j.tabs[order[k]].state;
      if(ts && ts.nodes && ts.nodes.length) s = ts;
    }
  }
  if(!s || !s.nodes) return null;
  var state = {
    nodes: s.nodes, connections: s.connections || [],
    compCounter: s.compCounter || 0,
    canvasOffset: s.canvasOffset || { x:3000, y:3000 },
    canvasZoom: s.canvasZoom || 1,
    // Gruplama çerçeveleri / yazı etiketleri de örnekle birlikte gelir. Alan
    // DÜŞERSE veLoadTabState → restoreState → restoreAnnotations([]) çağrılır ve
    // iç topolojideki çerçeveler örnek aktarımında sessizce SİLİNİR.
    annotations: s.annotations || []
  };
  // Kayıtlı örnekler yerel (300..1300, 150..650) bandında üretilmişti — yani
  // kanvasın SOL-ÜST köşesinde. Yükleme sırasında koordinatlar kanvas merkezine
  // taşınır: örneğin her yönünde ~2700px boş alan kalır (topoloji birleştirme
  // için yer) ve ızgaranın köşesine yapışmış görünmez. Kaynak JSON değişmez.
  if(typeof veCenterTopoState === 'function') veCenterTopoState(state);
  return state;
}

// Örnek topolojisini çöz: önce build'e gömülü (window.__MNT_TOPOLOGIES), yoksa
// fetch (geliştirme/Pages). Nesne verilirse doğrudan kullanır. cb(state|null).
function _mntResolveTopology(ref, cb){
  if(ref && typeof ref==='object'){ cb(_mntTopoState(ref)); return; }
  var url = String(ref||''); if(!url){ cb(null); return; }
  var emb = (typeof window!=='undefined' && window.__MNT_TOPOLOGIES) ? window.__MNT_TOPOLOGIES[url] : null;
  if(emb){ cb(_mntTopoState(emb)); return; }
  if(typeof fetch==='function'){
    fetch(url).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(j){ cb(_mntTopoState(j)); })
      .catch(function(){ cb(null); });
  } else { cb(null); }
}

// İç topolojiyi (kanvasın o anki hali) JSON olarak dışa aktar — kullanıcı bununla
// örnek topolojisi üretir. undo/redo/simResults gibi uçucu alanlar hariç tutulur.
function veMntExportTopology(){
  if(typeof veSerializeCurrentState!=='function'){ if(typeof showToast==='function') showToast('Dışa aktarma kullanılamıyor.','warning'); return; }
  if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
  var st = veSerializeCurrentState();
  var out = { format:'mfsim-mount-example', version:1,
    nodes: st.nodes, connections: st.connections,
    compCounter: st.compCounter, canvasOffset: st.canvasOffset, canvasZoom: st.canvasZoom,
    // Tuval açıklamaları (gruplama çerçevesi / yazı etiketi) uçucu DEĞİL:
    // yazılmazsa dışa aktarılan örnek yeniden yüklendiğinde çerçeveler kaybolur.
    annotations: st.annotations || [] };
  var json = JSON.stringify(out, null, 2);
  if(typeof document==='undefined') return json;
  var blob = new Blob([json], { type:'application/json' });
  if(typeof veShowSaveDialog==='function') veShowSaveDialog('ornek-topoloji.json', blob, 'İç topoloji JSON olarak kaydedildi ('+(st.nodes||[]).length+' düğüm)');
  return json;
}

// Örneği kayıtlı JSON topolojisinden yükle — iç topolojiyi tümüyle değiştirir.
function _mntLoadExampleFromJSON(ref, ex){
  var hasBodies = (typeof nodes!=='undefined') && nodes.some(function(n){ var d=_mntDef(n)||{}; return d.isMountBody||d.isMount; });
  if(hasBodies && typeof confirm==='function'){
    if(!confirm('İç topoloji örnekle değiştirilecek. Devam edilsin mi?')) return;
  }
  _mntResolveTopology(ref, function(state){
    if(!state || !state.nodes || !state.nodes.length){
      if(typeof showToast==='function') showToast('Örnek topolojisi yüklenemedi.','warning');
      return;
    }
    // GERİ ALINABİLİR TEK ADIM (2026-10-14). veLoadTabState geri-al yığınını
    // kaydın KENDİ yığınıyla değiştiriyor — örnek dosyasında yok, yani yığın
    // boşalıyordu ve Ctrl+Z örnekten önceki modele (başlangıç sayfasından
    // yüklendiyse sayfaya) dönemiyordu. Önceki yığın saklanır, yüklenen model
    // onun üstüne TEK adım olarak yazılır.
    var _once = (typeof undoStack!=='undefined' && Array.isArray(undoStack)) ? undoStack : null;
    if(_once && !_once.length && typeof saveState==='function'){ saveState(); _once = undoStack; }
    if(_once) _once = _once.slice();
    if(typeof veLoadTabState==='function') veLoadTabState({ state: state });
    // Sihirbaza dönülebilsin diye Başlangıç Sihirbazı bileşeni yoksa ekle.
    if(typeof nodes!=='undefined' && !nodes.some(function(n){ return (_mntDef(n)||{}).isMountWizard; }) && typeof veMntPopulateStarter==='function'){
      veMntPopulateStarter();
    }
    if(_once){ undoStack = _once; redoStack = []; }
    if(typeof saveState==='function') saveState();
    if(typeof updateAllConnections==='function') updateAllConnections();
    if(typeof veMntUpdateBreadcrumb==='function') veMntUpdateBreadcrumb();
    _mntOrnekPaletKapat();
    // Kamerayı yüklenen içeriğe otur. Kayıttaki kamera örneği ÜRETEN pencerenin
    // ölçüsüne göreydi; başka boyutta bir ekranda topolojinin bir kısmı görüş
    // dışında (kenara yapışmış) kalıyordu.
    if(typeof veFitViewToContent==='function') veFitViewToContent({ maxZoom:1 });
    if(typeof showToast==='function') showToast('Örnek yüklendi'+(ex&&ex.vehicle?(' — '+ex.vehicle):'')+'.','info');
  });
}

// ── Otomatik destek bağlantıları (GÖRSEL) ───────────────────────────────────
// "Neyi neyin desteklediğini" gösteren port bağlantılarını + port kenarlarını
// hesaplar. SAF fonksiyon (DOM/nodes/connections'a dokunmaz) → birim test edilir.
// items: [{id, kind, lx, ly}] (lx/ly = kanvas yerleşim konumu). Döner:
//   { links:[{from,to,fromPort,toPort}], ports:{ id:{ portType:{side} } } }
// Kural: her takoz → en yakın gövde/cradle; her cradle → en yakın (cradle olmayan)
// gövde. Çıkış portu hedefe, giriş portu gelen kaynakların ağırlık merkezine
// bakacak şekilde (üst/sağ/alt/sol) yönlendirilir. Çözücüyü ETKİLEMEZ (çözücü
// düğümleri tipe göre toplar; bağlantı zorunlu değildir).
function _mntComputeSupportLinks(items){
  items = items || [];
  var BODY = { 'mnt-motor':1, 'mnt-gearbox':1, 'mnt-shaft':1, 'mnt-transfer':1 };
  // PTO grubu bileşenleri TAŞINAN kütlelerdir: güç grubuna civatalanır, takoza
  // doğrudan oturmaz. Bu yüzden (a) cradle gibi kendi çıkışlarıyla en yakın ana
  // gövdeye bağlanırlar, (b) supportTargets'a GİRMEZLER — bir takoz asla PTO'ya
  // asılmaz (fiziksel olarak yanlış olurdu).
  // Liste burada YEREL: bu fonksiyon saf kalsın diye global componentDefs'e
  // (isMountCarried) bakmaz — girdisi düğüm değil {id,kind,lx,ly} verisidir.
  var CARRIED = { 'mnt-pto':1, 'mnt-pump':1, 'mnt-pto-group':1 };
  // Motorun aksesuarları motora civatalanır: taşıyıcıları en yakın MOTOR
  // (motor yoksa en yakın ana gövde)
  var AKSESUAR = { 'mnt-alternator':1, 'mnt-alt-bracket':1, 'mnt-ac':1, 'mnt-heat-shield':1 };
  Object.keys(AKSESUAR).forEach(function(k){ CARRIED[k] = 1; });
  var pureBodies = items.filter(function(it){ return BODY[it.kind]; });
  var motors = pureBodies.filter(function(it){ return it.kind==='mnt-motor'; });
  var cradles    = items.filter(function(it){ return it.kind==='mnt-bracket'; });
  var carried    = items.filter(function(it){ return CARRIED[it.kind]; });
  var mounts     = items.filter(function(it){ return it.kind==='mnt-mount'; });
  var supportTargets = pureBodies.concat(cradles);
  var byId={}; items.forEach(function(it){ byId[it.id]=it; });

  function nearest(a, pool){
    var best=null, bd=Infinity;
    pool.forEach(function(b){
      if(b.id===a.id) return;
      var dx=b.lx-a.lx, dy=b.ly-a.ly, d=dx*dx+dy*dy;
      if(d<bd){ bd=d; best=b; }
    });
    return best;
  }
  function sideToward(a, b){
    var dx=b.lx-a.lx, dy=b.ly-a.ly;
    if(Math.abs(dx) >= Math.abs(dy)) return dx>=0 ? 'right' : 'left';
    return dy>=0 ? 'bottom' : 'top';
  }

  // 1. Ham linkler: her takoz → en yakın gövde/cradle; her cradle → en yakın gövde.
  var byTarget={};
  function addRaw(src, tgt){ if(src&&tgt) (byTarget[tgt.id]=byTarget[tgt.id]||[]).push(src); }
  mounts.forEach(function(m){ addRaw(m, nearest(m, supportTargets)); });
  cradles.forEach(function(c){ addRaw(c, nearest(c, pureBodies)); });
  carried.forEach(function(p){ addRaw(p, nearest(p, (AKSESUAR[p.kind] && motors.length) ? motors : pureBodies)); });   // PTO/Pompa → taşıyıcı gövde, aksesuar → motor

  // 2. Her hedefte gelenleri AYRI giriş portlarına dağıt; hem kaynağın çıkışını hem
  //    hedefin o portunu KARŞILIKLI birbirine baktır (per-instance portPositions).
  //    Böylece ters yönelimli iki cradle bile doğru çıkar (biri üstten, biri alttan).
  var links=[], ports={};
  function setSide(id, portType, side){ (ports[id]=ports[id]||{})[portType]={ side:side }; }
  var SIDE_ORD = { top:0, right:1, bottom:2, left:3 };
  Object.keys(byTarget).forEach(function(tid){
    var tgt=byId[tid];
    var incs=byTarget[tid].slice();
    var inCount=(tgt.inCount!=null)?tgt.inCount:incs.length;
    // Her geleni gideceği kenara göre etiketle, sonra ÇAPRAZ olmayacak sırada diz:
    // önce kenar (grupla), sonra kenarın perp ekseni boyunca konum (sol/sağ → üstten
    // alta ly; üst/alt → soldan sağa lx). Port index'i bu sırayla artınca, üstteki
    // gelen üstteki porta düşer → çizgiler kesişmez.
    incs.forEach(function(s){ s._side = sideToward(tgt, s); });
    incs.sort(function(a,b){
      if(a._side !== b._side) return (SIDE_ORD[a._side]||0) - (SIDE_ORD[b._side]||0);
      return (a._side==='left'||a._side==='right') ? (a.ly-b.ly) : (a.lx-b.lx);
    });
    incs.forEach(function(src, i){
      var pi=Math.min(i, Math.max(0,inCount-1));         // fazla gelen → son portu paylaşır
      var toPort=(inCount<=1) ? 'input' : ('input-'+pi);
      links.push({ from:src.id, to:tgt.id, fromPort:'output', toPort:toPort });
      setSide(src.id, 'output', sideToward(src, tgt));   // kaynak çıkışı hedefe baksın
      setSide(tgt.id, toPort, src._side);                 // hedef portu kaynağa baksın
    });
  });
  return { links:links, ports:ports };
}

// Örnek yükleyicilerin ortak "bağla + port kenarlarını uygula" adımı. placed =
// oluşturulan gövde/takoz düğümlerinin [{id,kind,lx,ly}] listesi. createConnection
// id'yi Date.now()'la üretir → senkron döngüde çakışabilir, compCounter ile
// benzersizleştir (topology.js:392 / cp-arac-performans.js:106 deseni).
function _mntWireSupportLinks(placed){
  if(typeof createConnection!=='function') return;
  var wiring = _mntComputeSupportLinks(placed);
  Object.keys(wiring.ports).forEach(function(id){
    var n = (typeof nodes!=='undefined') ? nodes.find(function(x){ return x.id===id; }) : null;
    if(!n) return;
    n.data = n.data || {};
    n.data.portPositions = Object.assign(n.data.portPositions || {}, wiring.ports[id]);
  });
  wiring.links.forEach(function(lk){
    var before = connections.length;
    createConnection(lk.from, lk.to, lk.fromPort, lk.toPort);
    if(connections.length>before && typeof compCounter!=='undefined'){
      compCounter++;
      connections[connections.length-1].id = 'conn-' + compCounter;
    }
  });
}

// ── ŞASİ METAFORU (kütle-yay-zemin) ─────────────────────────────────────────
// Takoz topolojisini "titreşim diyagramı" gibi çizer: güç grubu bir ŞASİ ÇERÇEVESİ
// içinde; gövdeler aktarma-hattı omurgasıyla; her takoz karşıya uzanan çizgi yerine
// en yakın çerçeve kenarına KISA BİR YAY + dış tarafta zemin sembolü. updateAllConn.
// sonunda çağrılır (connections.js hook), <g class="ve-mnt-chassis"> ekler; her
// çağrıda yeniden çizilir. Takoz+gövde yoksa no-op → başka modüller etkilenmez.
// NOT: mount düğümleri arası port-port eğrileri updateAllConnections'ta atlanır
// (bu metafor onların yerini alır).
function veMntDecorateConnections(svg){
  if(!svg || typeof document==='undefined' || typeof nodes==='undefined') return;
  var old = svg.querySelector('g.ve-mnt-chassis');
  if(old && old.parentNode) old.parentNode.removeChild(old);
  var mountsN = nodes.filter(function(n){ return (_mntDef(n)||{}).isMount; });
  var bodiesN = nodes.filter(function(n){ return (_mntDef(n)||{}).isMountBody; });
  if(!mountsN.length && !bodiesN.length) return;
  var NS='http://www.w3.org/2000/svg';
  var g = document.createElementNS(NS,'g');
  g.setAttribute('class','ve-mnt-chassis');
  g.style.pointerEvents='none';

  // ── Şasi çerçevesi: gövdelerin (cradle dahil) sınır kutusu + pay ──
  // ADI DA SARAR (ana tuvalin sınır çerçevesiyle aynı ölçü: veMeasureNodeLabel +
  // veNodeLabelOverflow). Yalnız kutuları sardığında kutudan geniş ad ("Ön Takoz
  // Braketi") noktalı kenara değiyordu. Ölçülemezse pay 0 — davranış eskisi.
  var fr=null;
  if(bodiesN.length){
    var pad=26, x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
    bodiesN.forEach(function(n){ var w=n.width||50,h=n.height||46;
      var o={ left:0, right:0, top:0, bottom:0 };
      if(typeof veNodeLabelOverflow==='function' && typeof veMeasureNodeLabel==='function')
        o=veNodeLabelOverflow((n.data&&n.data.labelPos)||'bottom', w, h, veMeasureNodeLabel(n));
      x1=Math.min(x1,n.x-o.left); y1=Math.min(y1,n.y-o.top); x2=Math.max(x2,n.x+w+o.right); y2=Math.max(y2,n.y+h+o.bottom); });
    fr={x1:x1-pad, y1:y1-pad, x2:x2+pad, y2:y2+pad};
    var rect=document.createElementNS(NS,'rect');
    rect.setAttribute('x',fr.x1); rect.setAttribute('y',fr.y1);
    rect.setAttribute('width',fr.x2-fr.x1); rect.setAttribute('height',fr.y2-fr.y1);
    rect.setAttribute('rx',16); rect.setAttribute('fill','var(--accent-primary)');
    rect.setAttribute('fill-opacity','0.045'); rect.setAttribute('stroke','var(--accent-primary)');
    rect.setAttribute('stroke-width','1.6'); rect.setAttribute('stroke-dasharray','2 6'); rect.setAttribute('opacity','0.7');
    g.appendChild(rect);
    var t=document.createElementNS(NS,'text');
    t.setAttribute('x',fr.x1+11); t.setAttribute('y',fr.y1+16);
    // Yazı vurgunun okunur sürümüyle, opaklıksız: %72 opaklıkta 2,9:1 kalıyordu.
    t.setAttribute('fill','var(--ink-accent)'); t.setAttribute('font-size','10.5');
    t.setAttribute('letter-spacing','1.5');
    t.textContent='ŞASİ'; g.appendChild(t);
    // İLK BOYAMA: örnek yüklenince çerçeve çizilir ve AYNI görevde kamera
    // sığdırılır; Chromium o arada yerleşen SVG yazısını yeni dönüşümde
    // boyamıyordu — etiket DOM'da, kutusu ölçülüyor, ekranda yok (üç örnekte,
    // 1× ve 1,5×). Bir kare sonra yazı yeniden yerleşir. Kapı:
    // mount-topoloji.spec.js → "ŞASİ etiketi boyanır".
    if(typeof requestAnimationFrame==='function')
      requestAnimationFrame(function(){ if(t.isConnected) t.textContent='ŞASİ'; });
  }

  // ── Aktarma hattı omurgası: ana gövdeler, x sırasına göre merkezden ──
  // Braket/cradle ve "taşınan" gövdeler (PTO/Pompa/PTO Toplam — isMountCarried)
  // omurgaya GİRMEZ: hiçbiri aktarma hattının kendisi değil, ona asılan yardımcı
  // kütlelerdir.
  var spineB = bodiesN.filter(function(n){
      return n.type!=='mnt-bracket' && !(_mntDef(n)||{}).isMountCarried; })
    .sort(function(a,b){ return a.x - b.x; });
  // Çizgi kutudan kutuya, KENARDAN kenara: merkezden çizildiğinde motorun,
  // şanzımanın ve transferin kutusunun ve ikonunun üstünden geçiyordu.
  // Kutular üst üste biniyorsa (kenarlar arasında boşluk yok) çizgi çizilmez.
  for(var i=0;i<spineB.length-1;i++){
    var a=spineB[i], b=spineB[i+1];
    var ca={ x:a.x+(a.width||50)/2, y:a.y+(a.height||46)/2 }, cb={ x:b.x+(b.width||50)/2, y:b.y+(b.height||46)/2 };
    var pa=_mntEdge(a, cb.x, cb.y), pb=_mntEdge(b, ca.x, ca.y);
    if((pb.x-pa.x)*(cb.x-ca.x)+(pb.y-pa.y)*(cb.y-ca.y) <= 0) continue;
    var l=document.createElementNS(NS,'line');
    l.setAttribute('x1',pa.x); l.setAttribute('y1',pa.y);
    l.setAttribute('x2',pb.x); l.setAttribute('y2',pb.y);
    l.setAttribute('stroke','var(--text-secondary)'); l.setAttribute('stroke-width','3');
    l.setAttribute('stroke-linecap','round'); l.setAttribute('opacity','0.7'); g.appendChild(l);
  }

  // ── Takozlar: en yakın çerçeve kenarına kısa yay + dış tarafta zemin ──
  var opp={ left:'right', right:'left', top:'bottom', bottom:'top' };
  mountsN.forEach(function(n){
    var w=n.width||50,h=n.height||46, cx=n.x+w/2, cy=n.y+h/2;
    if(fr){
      // en yakın çerçeve kenarı + o kenar üzerine izdüşüm (köşeye taşmayı kırp)
      var dl=Math.abs(cx-fr.x1),dr=Math.abs(cx-fr.x2),dt=Math.abs(cy-fr.y1),db=Math.abs(cy-fr.y2);
      var mn=Math.min(dl,dr,dt,db), fp;
      if(mn===dt) fp={x:Math.max(fr.x1,Math.min(fr.x2,cx)), y:fr.y1};
      else if(mn===db) fp={x:Math.max(fr.x1,Math.min(fr.x2,cx)), y:fr.y2};
      else if(mn===dl) fp={x:fr.x1, y:Math.max(fr.y1,Math.min(fr.y2,cy))};
      else fp={x:fr.x2, y:Math.max(fr.y1,Math.min(fr.y2,cy))};
      var mp=_mntEdge(n, fp.x, fp.y);
      _mntSpring(g, mp, fp);
      // zemin: yayın TERS yönünde (dışta). İç yön = fp'ye bakan baskın eksen.
      var idx=fp.x-cx, idy=fp.y-cy;
      var inSide=(Math.abs(idx)>=Math.abs(idy)) ? (idx>0?'right':'left') : (idy>0?'bottom':'top');
      _mntChassisGlyph(g, n, opp[inSide]);
    } else {
      _mntChassisGlyph(g, n, 'left');
    }
  });
  svg.appendChild(g);
}

// Düğüm sınır kutusunun (tx,ty)'ye bakan kenar noktası.
function _mntEdge(n, tx, ty){
  var w=n.width||50,h=n.height||46, cx=n.x+w/2, cy=n.y+h/2, dx=tx-cx, dy=ty-cy;
  if(dx===0&&dy===0) return {x:cx,y:cy};
  var s=Math.min((w/2)/Math.abs(dx||1e-9), (h/2)/Math.abs(dy||1e-9));
  return {x:cx+dx*s, y:cy+dy*s};
}

// İki nokta arası KISA YAY (zig-zag) — takoz kenarından şasi çerçevesine.
function _mntSpring(g, a, b){
  var NS='http://www.w3.org/2000/svg';
  var vx=b.x-a.x, vy=b.y-a.y, L=Math.hypot(vx,vy)||1e-6, ux=vx/L, uy=vy/L, px=-uy, py=ux;
  var coils=Math.max(3, Math.min(6, Math.round(L/8))), amp=Math.min(4.5, L*0.16), seg=L/(coils+1);
  var d='M'+a.x+' '+a.y;
  for(var i=1;i<=coils;i++){ var tt=seg*i, sgn=(i%2?1:-1)*amp; d+=' L '+(a.x+ux*tt+px*sgn)+' '+(a.y+uy*tt+py*sgn); }
  d+=' L '+b.x+' '+b.y;
  var p=document.createElementNS(NS,'path');
  p.setAttribute('d',d); p.setAttribute('fill','none');
  p.setAttribute('stroke','var(--accent-success)'); p.setAttribute('stroke-width','2');
  p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); p.setAttribute('opacity','0.95');
  g.appendChild(p);
}

// Tek takoz için dış kenara sabit-mesnet sembolü çiz: takozdan raya kısa bağ +
// ray + dışa dönük tarama çizgileri. side = şasinin bulunduğu kenar.
function _mntChassisGlyph(g, n, side){
  var NS='http://www.w3.org/2000/svg';
  var w=n.width||50, h=n.height||46, gap=9, rail=Math.min(w,h)*0.62, tick=7, N=5;
  var cx=n.x+w/2, cy=n.y+h/2;
  var col='var(--accent-primary)';
  function ln(x1,y1,x2,y2,wd,op){
    var l=document.createElementNS(NS,'line');
    l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
    l.setAttribute('stroke',col); l.setAttribute('stroke-width',wd); l.setAttribute('stroke-linecap','round');
    if(op!=null) l.setAttribute('opacity',op);
    g.appendChild(l);
  }
  var vertical = (side==='left'||side==='right');
  if(vertical){
    var ax = side==='left' ? n.x-gap : n.x+w+gap;
    var edgeX = side==='left' ? n.x : n.x+w;
    var dir = side==='left' ? -1 : 1;
    ln(edgeX, cy, ax, cy, 2.2, 0.9);                 // takoz → ray
    ln(ax, cy-rail/2, ax, cy+rail/2, 2.4, 1);        // ray
    for(var i=0;i<N;i++){ var yy=cy-rail/2 + i*(rail/(N-1));
      ln(ax, yy, ax+tick*dir, yy-tick, 1.4, 0.7); }  // tarama
  } else {
    var ay = side==='top' ? n.y-gap : n.y+h+gap;
    var edgeY = side==='top' ? n.y : n.y+h;
    var dirY = side==='top' ? -1 : 1;
    ln(cx, edgeY, cx, ay, 2.2, 0.9);
    ln(cx-rail/2, ay, cx+rail/2, ay, 2.4, 1);
    for(var j=0;j<N;j++){ var xx=cx-rail/2 + j*(rail/(N-1));
      ln(xx, ay, xx-tick, ay+tick*dirY, 1.4, 0.7); }
  }
}

// Programatik model kurucusu (kayıt girişinde JSON yoksa): model'den kütle/takoz
// düğümlerini oluşturur.
function _mntLoadExampleFromModel(anahtar){
  if(typeof veMountCore==='undefined' || typeof createNode!=='function') return;
  var key = anahtar || 'siper';
  // Seçilen örneğin modelini kayıt defterinden çöz (bilinmezse ilk örneğe düşer).
  var ex = (veMountCore.getMountExample) ? veMountCore.getMountExample(key) : null;
  var EX = (ex && ex.model) || veMountCore.TTAR_EXAMPLE; if(!EX) return;

  // Mevcut kütle/takoz bileşenlerini bul (Çözücü/Sihirbaz/Görüntüleyici korunur).
  var toRemove = nodes.filter(function(n){ var d=_mntDef(n)||{}; return d.isMountBody || d.isMount; });
  if(toRemove.length){
    var ok = (typeof confirm==='undefined') ? true : confirm(toRemove.length+' kütle/takoz bileşeni silinecek. Devam edilsin mi?');
    if(!ok) return;
    toRemove.forEach(function(n){ _mntRemoveNode(n.id); });
  }

  // Örnek düğümlerini STARTER ile aynı tabana göre yerleştir ki yardımcı araçlarla
  // (3D / Görünümler / Sihirbaz / Çözücü — sağ ve üst kenarda) çakışmasın.
  // Yerleşim panel önizlemesiyle AYNI (_mntExampleLayout) → görsel ile kurulan
  // topoloji birebir örtüşür; bileşen/takoz kendi at:[lx,ly]'sini taşıyabilir.
  var LAY=_mntExampleLayout(EX);
  var layout=LAY.bodies.concat(LAY.mnts);
  var base = (typeof veArrangeModuleBase==='function')
    ? veArrangeModuleBase(VE_MNT_STARTER_LAYOUT.map(function(it){ return {lx:it.lx, ly:it.ly}; }))
    : { x:3000, y:3000 };

  var tq=EX.torque||{};
  var li=0;
  var placed=[];  // otomatik destek bağlantıları için: {id,kind,lx,ly}
  EX.components.forEach(function(c){
    var pos=layout[li++]; var before=nodes.length;
    var kind=c.kind || _mntExampleBodyType(c.name);
    createNode(kind, base.x+pos.lx, base.y+pos.ly);
    if(nodes.length>before){
      var n=nodes[nodes.length-1];
      n.data=Object.assign(n.data||{}, { mass:c.mass, cgx:c.cg[0], cgy:c.cg[1], cgz:c.cg[2], Ixx:c.Ixx, Iyy:c.Iyy, Izz:c.Izz, Ixy:c.Ixy, Ixz:c.Ixz, Iyz:c.Iyz, pointMass:!!c.pointMass });
      // Bağlantı yüzü (JSON'daki bagX · bagY · bagZ · egSinir'in kayıttaki karşılığı)
      if(Array.isArray(c.bag) && c.bag.length===3){ n.data.bagX=c.bag[0]; n.data.bagY=c.bag[1]; n.data.bagZ=c.bag[2]; }
      if(c.egSinir>0) n.data.egSinir=c.egSinir;
      if(kind==='mnt-transfer' && (c.donus==='ayni' || c.donus==='ters')) n.data.donus=c.donus;
      // Tork zinciri: Motor→Te; Şanzıman→vites/stall + transfer/aks payı
      // (örnekte ayrı Transfer gövdesi yok → değerler Şanzıman'da tutulur).
      if(kind==='mnt-motor'){
        n.data.Te=tq.Te;
        if(tq.idleRpm) n.data.idleRpm=tq.idleRpm;
        if(tq.cylinders) n.data.cylinders=tq.cylinders;
      }
      else if(kind==='mnt-gearbox' && tq.fwd){
        n.data.g1=tq.fwd.iGear; n.data.gR=(tq.rev||{}).iGear; n.data.Rstall=tq.Rstall;
        n.data.iTransfer=tq.iTransfer; n.data.phiFwd=tq.fwd.phiAxle; n.data.phiRev=(tq.rev||{}).phiAxle; n.data.derate=tq.derate;
      }
      _mntSetNodeName(n, c.name);
      placed.push({ id:n.id, kind:kind, lx:pos.lx, ly:pos.ly,
        inCount:(typeof nodePortCount==='function') ? nodePortCount(n,'inputs') : 1 });
    }
  });
  EX.mounts.forEach(function(m){
    var pos=layout[li++]; var before=nodes.length;
    createNode('mnt-mount', base.x+pos.lx, base.y+pos.ly);
    if(nodes.length>before){
      var n=nodes[nodes.length-1];
      n.data=Object.assign(n.data||{}, { x:m.pos[0], y:m.pos[1], z:m.pos[2], kxs:m.kstat[0], kys:m.kstat[1], kzs:m.kstat[2], kxd:m.kdyn[0], kyd:m.kdyn[1], kzd:m.kdyn[2] });
      _mntSetNodeName(n, m.name);
      placed.push({ id:n.id, kind:'mnt-mount', lx:pos.lx, ly:pos.ly });
    }
  });
  // Takoz/cradle destek bağlantılarını (görsel) otomatik kur.
  _mntWireSupportLinks(placed);

  // Çözücü yoksa ekle (starter'daki sağ-üst konuma). Aracın ileri yönü, tork
  // yönü ve kaldırım darbesi örneğin ayarı: örnekte yoksa varsayılan (alan silinir).
  var cz=nodes.filter(function(n){ return (_mntDef(n)||{}).isMountSolver; })[0];
  if(!cz){
    var once=nodes.length;
    createNode('mnt-solver', base.x + 640, base.y + 20);
    if(nodes.length>once) cz=nodes[nodes.length-1];
  }
  if(cz){
    cz.data=cz.data||{};
    ['ileri','torkYon','kaldirimG','kaldirimYon'].forEach(function(k){
      if(EX.solver && EX.solver[k]!=null) cz.data[k]=EX.solver[k]; else delete cz.data[k];
    });
  }
  if(typeof saveState==='function') saveState();
  if(typeof updateAllConnections==='function') updateAllConnections();
  _mntOrnekPaletKapat();

  // Tutarsızlık varsa kullanıcıya tek bildirim (fazla takoz vb.).
  _mntRenderExampleReport(_mntExampleValidate(), false);
}

// ════════════════════════════════════════════════════════════════════════════
//  3D GÖRÜNTÜLEYİCİ — iç topolojinin 3B yerleşimi (tema uyumlu)
// ════════════════════════════════════════════════════════════════════════════
// 3D GÖRÜNTÜLEYİCİ — CAD'in evi: penceresi js/cp-mount-cad.js'te
// (getMntViewerPropertiesHTML; 2026-10-20'ye dek yer tutucuydu).
// Görünümler'in aksonometrisi tam ekranda (düğmesi çizimin başlığında):
// aynı çizim, işaretler adlarıyla. Kapanınca pencerenin çizimi aynı bakışa
// (tercih ortak) yeniden kurulur.
// `sec`: "Güç grubundaki yeri"nden açılınca bileşenin kimliği (tam ekranda da
// perdenin üstünde). Çizim kabın yüksekliğini doldurur ve pencere boyu
// değişince yeniden ölçülür (_mntAksoTamH).
function veMntAkso3BTamEkran(sec){
  if(typeof document==='undefined') return;
  var gozcu=null;
  _mntFsOverlay('Görünümler', '<div class="ve-mnt2d-fs" id="ve-mnt-akso3b-fs-kap">'
    + '<div class="ve-mnt-akso-kap" id="ve-mnt-akso3b-fs" data-tam="1"'+(sec!=null ? ' data-sec="'+_mntEsc(sec)+'"' : '')+'></div></div>', function(){
    var kap=document.getElementById('ve-mnt-akso3b-fs-kap'); if(!kap) return;
    var kur=function(){ _mntAksoKur('ve-mnt-akso3b-fs', kap.clientWidth-26); };
    kur();
    if(typeof ResizeObserver!=='undefined'){
      var raf=0, son=[kap.clientWidth, kap.clientHeight];
      gozcu=new ResizeObserver(function(){
        if(kap.clientWidth===son[0] && kap.clientHeight===son[1]) return;
        son=[kap.clientWidth, kap.clientHeight];
        if(raf) cancelAnimationFrame(raf);
        raf=requestAnimationFrame(function(){ raf=0; kur(); });
      });
      gozcu.observe(kap);
    }
  }, function(){ if(gozcu) gozcu.disconnect(); veMntAksoTazele(); });
}
// Pencerenin aksonometrileri (Görünümler ve "Güç grubundaki yeri") ortak
// açıyla yeniden kurulur — tam ekran kapanınca.
function veMntAksoTazele(){
  if(typeof document==='undefined') return 0;
  var n=veMnt2DViewRefresh() ? 1 : 0;
  Array.prototype.forEach.call(document.querySelectorAll('.ve-properties-content .ve-mnt-yer .ve-mnt-akso-kap[id]'), function(k){
    if(_mntAksoKur(k.id)) n++;
  });
  return n;
}

// ════════════════════════════════════════════════════════════════════════════
//  GÖRÜNÜMLER (eski adıyla 2D Görünüm) — döndürülebilir aksonometri
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı kararı (2026-10-16): 3D Görüntüleyici'nin döndürülebilir
// aksonometrisi bu bileşene taşındı — "alt taraftaki görünümler olmayacak,
// klasik 3B görünüm gibi olacak", adı Görünümler. Pencere tek bir döndürülen
// çizim: düz görünüş sekmeleri (Üstten · Yandan · Önden) ve tam ekranın
// altındaki düz görünüşler kaldırıldı; aynı yönler çizimin HAZIR BAKIŞLARI.
// Düz görünüş çizicisi (veMnt2DGorunusSVG) sihirbazın önizlemesinde yaşıyor.
// Pencerenin verisi ÇÖZÜCÜNÜN modelidir: birleşik CG onun birleştirmesinden
// (_mntCanliModel → combineMassProps), boş konum çözücü gibi 0'da çizilir ve
// İşaretler föyünde "boş" diye işaretlenir.
function _mnt2DPencereVeri(){
  var M=_mntCanliModel(), noG={}, noT={};
  var comps=M.g.components.map(function(c, i){ noG[c.id]=String(i+1);
    return { id:c.id, name:c.name, mass:_mntNum(c.mass), x:_mntNum(c.cgx), y:_mntNum(c.cgy), z:_mntNum(c.cgz) }; });
  var mounts=M.g.mounts.map(function(m, i){ noT[m.id]='T'+(i+1);
    return { id:m.id, name:m.name, x:_mntNum(m.x), y:_mntNum(m.y), z:_mntNum(m.z) }; });
  var cg=(M.mp && M.mp.cg.every(Number.isFinite))
    ? { x:M.mp.cg[0]*1000, y:M.mp.cg[1]*1000, z:M.mp.cg[2]*1000, m:M.mTop } : null;
  return { M:M, veri:{ comps:comps, mounts:mounts, cg:cg }, noG:noG, noT:noT };
}
// ════════════════════════════════════════════════════════════════════════════
//  GÖRÜNÜMLER · AKSONOMETRİ (çizici js/mount-akso.js)
// ════════════════════════════════════════════════════════════════════════════
// SERBEST KAMERA (adım 3, kullanıcı 2026-10-15: "bu görünüm 2B değil, biraz
// daha 3B tarzı"): açı azimut/yükseliş, sığdırma dönmeden bağımsız. 2026-10-16'dan
// beri Görünümler penceresinin TEK çizimi; 2D Görünüm'ün sabit bakışı (izdüşüm
// + sekiz bakış düğmesi) onunla birlikte emekli.
//
// TEK GÖRÜNÜM (kullanıcı kararı 2026-10-16, ikinci tur): "Aksonometrik ve
// İşaretler … birleştirelim", açı yazısı (yükseliş · azimut), Görünüş (hazır
// bakışlar), Katmanlar, Uygunluk ve Etkileşim bölümleri yok, tam ekran çizimin
// başlığında. Çizim SONUÇ GÖSTERMEZ — kuvvet, statik sehim ve mod katmanı
// kalktı: "kullanıcı sadece detaylı sonuç raporu ile yetinecek". Etkileşimin
// dili başlıktaki bakış adının ipucunda (`title`), ayrı bölüm değil.
//
// GÖRÜNÜM TERCİHİ MODELDE DEĞİL (FEAD kural 15'in
// gerekçesi): kaydedilmez, geri-al yığınına yazılmaz, tarayıcıda saklanır —
// yalnız açı; eski kayıttaki katman anahtarları (kuvvet, mod, direk…) okunmaz.
// Yakınlık ve kaydırma oturumluk, kap başına.
var VE_MNT_AKSO3B_ANAHTAR = 've-mnt-akso3b';
var VE_MNT_AKSO3B = { az:null, el:null };
// Bakışın ADI (başlık): açı bunlardan birine yarım dereceden yakınsa onun adı,
// değilse "Serbest bakış". Dimetrik (varsayılan, Sıfırla) ve izometrik
// önden-soldan-yukarıdan; üstten, önden, yandan eski düz görünüşlerin yönleri.
var VE_MNT_AKSO3B_ON = [['dim', 'Dimetrik'], ['iso', 'İzometrik'], ['ust', 'Üstten'], ['on', 'Önden'], ['yan', 'Yandan']];
var _mntAkso3bOkundu = false, _mntAksoGor = {}, _mntAksoCizim = {};
function _mntAkso3bOnAci(k){
  var Ak=_mntAk();
  if(k==='dim' || k==='iso') return Ak ? Ak.kamAci(k, { x:-1, y:-1, z:1 }) : (k==='iso' ? { az:225, el:35.26 } : { az:249.3, el:19.47 });
  if(k==='ust') return { az:270, el:88 };
  if(k==='on') return { az:180, el:0 };
  if(k==='yan') return { az:270, el:0 };
  return null;
}
function _mntAkso3bOnAdi(A){
  for(var i=0;i<VE_MNT_AKSO3B_ON.length;i++){
    var a=_mntAkso3bOnAci(VE_MNT_AKSO3B_ON[i][0]);
    var daz=Math.abs(((A.az-a.az)%360+540)%360-180);
    if(daz<0.5 && Math.abs(A.el-a.el)<0.5) return VE_MNT_AKSO3B_ON[i];
  }
  return null;
}
function _mntAkso3bOku(){
  var A=VE_MNT_AKSO3B;
  if(!_mntAkso3bOkundu){
    _mntAkso3bOkundu=true;
    try{
      var k=(typeof localStorage!=='undefined') ? JSON.parse(localStorage.getItem(VE_MNT_AKSO3B_ANAHTAR) || 'null') : null;
      if(k && typeof k==='object'){
        if(Number.isFinite(k.az)) A.az=((k.az%360)+360)%360;
        if(Number.isFinite(k.el)) A.el=Math.max(-88, Math.min(88, k.el));
      }
    }catch(e){ /* tarayıcı belleği yok: varsayılanlar */ }
  }
  if(A.az==null || A.el==null){ var d=_mntAkso3bOnAci('dim'); A.az=d.az; A.el=d.el; }
  return A;
}
function _mntAkso3bYaz(){
  try{ if(typeof localStorage!=='undefined') localStorage.setItem(VE_MNT_AKSO3B_ANAHTAR, JSON.stringify({ az:VE_MNT_AKSO3B.az, el:VE_MNT_AKSO3B.el })); }catch(e){ /* yok sayılır */ }
}
function _mntAksoGorus(kapId){ return _mntAksoGor[kapId] || (_mntAksoGor[kapId]={ yakin:1, kay:[0, 0] }); }
// Sürükleme → açı (saf): yatayda 0,5°/px azimut, düşeyde 0,5°/px yükseliş.
// Model eli izler: sağa çekmek onu sağa döndürür (kamera sola, azimut
// azalır), aşağı çekmek daha yukarıdan gösterir; yükseliş ±88°'de durur.
function _mntAkso3bDondur(a, dx, dy){
  var az=(((a.az-dx*0.5)%360)+360)%360;
  return { az:az, el:Math.max(-88, Math.min(88, a.el+dy*0.5)) };
}
// Tekerlek (saf): imlecin altındaki nokta yerinde kalır. Çizimde
// ekran = merkez + (q − q_c)·sc + kay; sc → g·sc iken kay' = (1 − g)(p − merkez) + g·kay.
function _mntAkso3bYakinlas(G, f, p, merkez){
  var y=Math.max(0.4, Math.min(8, G.yakin*f)), g=y/G.yakin;
  return { yakin:y, kay:[(1-g)*(p[0]-merkez[0])+g*G.kay[0], (1-g)*(p[1]-merkez[1])+g*G.kay[1]] };
}

// Çizici ayrı dosyada (js/mount-akso.js): yükleyici bir modülü atlarsa
// (loader: "atlanan modül görünür, yükleme sürer") pencere sebebini söyler.
function _mntAk(){ return (typeof veMntAkso!=='undefined' && veMntAkso && veMntAkso.ciz) ? veMntAkso : null; }
function _mntAksoKoord(x, y, z, b){ return '('+_mntS(x, b||0)+'; '+_mntS(y, b||0)+'; '+_mntS(z, b||0)+')'; }

// ÇİZİMİN MODELİ — pencere hesaplamaz, okur: CANLI modelden (_mnt2DPencereVeri
// → _mntCanliModel; G İşaretler föyününkiyle aynı). Çözüm OKUNMAZ (kullanıcı
// kararı 2026-10-16): pencerenin çizimi girdiyi gösterir, sonucu rapor.
function _mntAksoModel(P){
  P=P||_mnt2DPencereVeri();
  return _mntAksoModelKur(P.M.g, P.M.mp, null, 'yok');
}
// Örnek kaydından (veMountCore.getMountExample(k).model; mm, kg, N/mm) —
// başlangıç sayfasının karosu. Pencereyle AYNI kurucu: karo kendi modelini
// kurmaz. Örnekte çözüm yok.
function veMntAksoOrnekModel(model){
  if(!model || !model.components) return null;
  var g={
    components:model.components.map(function(c, i){
      var cg=c.cg||[0, 0, 0];
      return { id:'g'+i, name:c.name, mass:c.mass, cgx:cg[0], cgy:cg[1], cgz:cg[2],
        Ixx:c.Ixx, Iyy:c.Iyy, Izz:c.Izz, Ixy:c.Ixy, Ixz:c.Ixz, Iyz:c.Iyz, pointMass:!!c.pointMass };
    }),
    mounts:(model.mounts||[]).map(function(t, i){
      var p=t.pos||[0, 0, 0], k=t.kstat||[0, 0, 0];
      return { id:'t'+i, name:t.name, x:p[0], y:p[1], z:p[2], kxs:k[0], kys:k[1], kzs:k[2] };
    })
  };
  var C=(typeof veMountCore!=='undefined') ? veMountCore : null, mp=null;
  if(C && C.combineMassProps && C.mmToM && g.components.length){
    try{ mp=C.combineMassProps(_mntToSI(g, 9.81).components); }catch(e){ mp=null; }
  }
  return _mntAksoModelKur(g, mp, null, 'yok');
}
// Çözümün KENDİ girdisinden (R.gather · R.mp) — raporun teknik illüstrasyonu.
// Rapor çözülen modeli anlatır: canlı topoloji o zamandan beri değişmiş
// olabilir, çizim ondan kurulmaz. Çözüm YALNIZ raporda çizilir.
function veMntAksoCozumModel(R){
  if(!R || !R.gather || !R.gather.components || !R.mp) return null;
  return _mntAksoModelKur(R.gather, R.mp, R, 'guncel');
}
// Düğüm LİSTESİNDEN (sihirbazın durumu — veMntWizNodes; Canlı Not 37): çizimin
// P'si, pencereyle AYNI kurucuya. Birleşik CG combineMassProps'tan.
function veMntAksoListeVeri(liste){
  var g=_mntGatherForSolver(null, liste||[]), C=(typeof veMountCore!=='undefined') ? veMountCore : null, mp=null;
  if(C && C.combineMassProps && C.mmToM && g.components.length){
    try{ mp=C.combineMassProps(_mntToSI(g, 9.81).components); }catch(e){ mp=null; }
  }
  return { M:{ g:g, mp:mp } };
}
// Kurucu — saf: g (_mntGatherForSolver'ın biçimi: mm, kg, N/mm), mp
// (combineMassProps, SI), R (raporun çözümü ya da null), durum (yok · guncel ·
// bayat). Her öğe düğüm kimliğini (`id`) taşır: "Güç grubundaki yeri"
// bileşenin kendisini kimlikle bulur (sıra, silinen bir düğümle kayardı).
function _mntAksoModelKur(g, mp, R, durum){
  var C=(typeof veMountCore!=='undefined') ? veMountCore : null;
  var mTop=0, mHam=0;
  g.components.forEach(function(c){ mTop+=Math.max(0, _mntNum(c.mass, 0)); mHam+=_mntNum(c.mass, 0); });
  var govde=g.components.map(function(c, i){
    var mass=_mntNum(c.mass, 0), x=_mntNum(c.cgx), y=_mntNum(c.cgy), z=_mntNum(c.cgz);
    var kutu=(C && C.equivalentBox) ? C.equivalentBox(mass, [[_mntNum(c.Ixx),0,0],[0,_mntNum(c.Iyy),0],[0,0,_mntNum(c.Izz)]], !!c.pointMass) : null;
    if(kutu) kutu=kutu.map(function(v){ return v*1000; });
    var pay=mTop>0 ? Math.max(0, mass)/mTop : 0, ad=String(c.name||'Gövde');
    // braket: düğümün tipi; tipsiz girdide (örnek kaydı) adı
    var braket=(c.tip!=null) ? c.tip==='mnt-bracket' : /braket|bracket|cradle/i.test(ad);
    return { k:'g'+(i+1), id:c.id, no:String(i+1), ad:ad, m:mass, x:x, y:y, z:z, pay:pay, kutu:kutu, ana:false, braket:braket,
      bilgi:[(i+1)+' · '+ad, 'Kütle '+_mntS(mass, 1)+' kg (%'+_mntS(pay*100, 1)+')', 'CG '+_mntAksoKoord(x, y, z)+' mm',
        kutu ? 'Eşdeğer kutu '+kutu.map(function(v){ return _mntS(v, 0); }).join(' × ')+' mm'
             : (c.pointMass ? 'Nokta kütle' : 'Eşdeğer kutu yok')] };
  });
  // Ana gövde: raporun eşiği — toplamın %10'u, en az iki gövde.
  var ana=govde.filter(function(g){ return g.pay>=(_mntAk() ? _mntAk().ANA_PAY : 0.10); });
  if(ana.length<2) ana=govde.slice().sort(function(a, b){ return b.m-a.m; }).slice(0, 2);
  ana.forEach(function(g){ g.ana=true; });
  var ms=R ? (R.mounts||[]) : [], st=null;
  if(R) (R.allCases||[]).forEach(function(rc){ if(rc.name==='Static' && rc.res) st=rc.res; });
  var takoz=g.mounts.map(function(t, i){
    // Kimlikle eşle; kimliksiz girdide (elle kurulmuş çözüm) sıra: R.mounts
    // _mntToSI'nin çıktısı, toplanan sırayı korur. Eskiden iki tarafın da
    // kimliği yokken undefined === undefined her takozu İLK takoza bağlıyordu.
    var j=(t.id==null) ? (i<ms.length ? i : -1) : -1;
    for(var q=0;q<ms.length && t.id!=null;q++){ if(ms[q] && ms[q].id===t.id){ j=q; break; } }
    var pm=(st && st.perMount && j>=0) ? st.perMount[j] : null;
    var yuk=(R && R.loadShares && j>=0) ? R.loadShares[j] : null;
    var x=_mntNum(t.x), y=_mntNum(t.y), z=_mntNum(t.z), ad=String(t.name||'Takoz');
    var ks=[_mntNum(t.kxs), _mntNum(t.kys), _mntNum(t.kzs)];
    var bilgi=['T'+(i+1)+' · '+ad, 'Konum '+_mntAksoKoord(x, y, z)+' mm', 'Statik rijitlik '+ks.map(function(v){ return _mntS(v, 0); }).join('; ')+' N/mm'];
    if(pm && yuk!=null) bilgi.push('Statik yük '+_mntS(yuk, 1)+' kg · sehim '+_mntS(Math.abs(pm.delta[2]*1000), 2)+' mm');
    return { k:'T'+(i+1), id:t.id, no:'T'+(i+1), ad:ad, x:x, y:y, z:z, ks:ks, f:pm ? pm.f.slice() : null, yukKg:yuk, bilgi:bilgi };
  });
  govde.forEach(function(b){
    if(!b.braket || b.kutu) return;
    var lv=_mntAksoBraketLevha(b, govde, takoz);
    if(!lv) return;
    b.levha=lv;
    b.bilgi[3]=(lv.i===2 ? 'Eşdeğer kaide '+_mntS(lv.w, 0)+' × '+_mntS(lv.w, 0)+' × '+_mntS(lv.d, 0) : 'Eşdeğer köşebent '+_mntS(lv.d, 0)+' × '+_mntS(lv.w, 0)+' × '+_mntS(lv.t, 0))+' mm · çelik';
  });
  var cg=(mp && mp.cg && mp.cg.every(Number.isFinite)) ? { x:mp.cg[0]*1000, y:mp.cg[1]*1000, z:mp.cg[2]*1000 } : null;
  var G=cg ? { x:cg.x, y:cg.y, z:cg.z, m:mHam,
    bilgi:['Birleşik CG', _mntAksoKoord(cg.x, cg.y, cg.z, 1)+' mm', 'Toplam kütle '+_mntS(mHam, 1)+' kg'] } : null;
  var asal=null;
  if(mp && C && C.principalInertia && C.equivalentBox){
    var pr=C.principalInertia(mp.I_G);
    var kb=pr ? C.equivalentBox(mp.m, [[pr.values[0],0,0],[0,pr.values[1],0],[0,0,pr.values[2]]], false) : null;
    if(kb) asal={ degerler:pr.values, eksenler:pr.axes, kutu:kb.map(function(v){ return v*1000; }) };
  }
  var kisa=(typeof veMntBrief!=='undefined' && veMntBrief.modeShort) ? veMntBrief.modeShort : function(s){ return String(s||''); };
  return { govde:govde, takoz:takoz, G:G,
    cgR:(R && R.mp) ? R.mp.cg.map(function(v){ return v*1000; }) : (G ? [G.x, G.y, G.z] : [0, 0, 0]),
    q:(R && R.qStatic) ? { u:R.qStatic.slice(0, 3).map(function(v){ return v*1000; }), t:R.qStatic.slice(3, 6) } : null,
    modlar:(R && R.modes && R.modes.length) ? R.modes.map(function(md){ return { f:md.f_Hz, phi:md.phi, ad:kisa(md.label) }; }) : null,
    asal:asal, cozum:durum };
}
// BRAKET — KÖŞEBENT (kullanıcı 2026-11-05, Canlı Not 36: "braketlerin
// görselleştirmesi güzel değil"): ataletsiz braket nokta değil, topolojideki
// simgesi gibi bir L — AYAĞI en yakın takozun üstünde, KANADI gövdenin
// yüzünde. Yön braketin CG'sinin takoza göre baskın ekseni; o yönde gövde
// yoksa gövdeye varan sıradaki eksen (yön düşeyse gövdenin altına KAİDE);
// ayağın boyu takozdan o yönde ilk gövde kutusunun yüzüne (hiçbir yönde
// gövde yoksa CG uzaklığının iki katı), kanat ayakla eşit. Kesit kütleden (çelik ρ; köşebentte genişlik =
// `oran` × kalınlık, kaidede kare). Atalet girilmiş braket eşdeğer
// kutusuyla çizilir (Siper, Asfat); erimde takoz yoksa nokta kalır.
// Kapı: mount-akso.test.js → BRAKET.
var VE_MNT_AK_BRAKET = { erim:400, ro:7.85e-6, oran:3, enAz:20 };   // mm · kg/mm³ · w/t · mm
function _mntAksoBraketLevha(b, govde, takoz){
  var E=VE_MNT_AK_BRAKET, B=[b.x, b.y, b.z];
  var uz=function(p, q){ return Math.sqrt(Math.pow(p[0]-q[0], 2)+Math.pow(p[1]-q[1], 2)+Math.pow(p[2]-q[2], 2)); };
  var T=null, dT=E.erim;
  takoz.forEach(function(t){ var p=[t.x, t.y, t.z], d=uz(p, B); if(d<=dT){ dT=d; T={ p:p, k:t.k }; } });
  if(!T || !(b.m>0)) return null;
  var kutular=govde.filter(function(g){ return g!==b && !g.braket && g.kutu; }).map(function(g){
    var c=[g.x, g.y, g.z]; return { k:g.k, lo:c.map(function(v, i){ return v-g.kutu[i]/2; }), hi:c.map(function(v, i){ return v+g.kutu[i]/2; }) }; });
  // Yön: CG'nin takoza göre baskın ekseni; CG takozun üstündeyse en yakın kutuya
  var D=[B[0]-T.p[0], B[1]-T.p[1], B[2]-T.p[2]];
  if(Math.sqrt(D[0]*D[0]+D[1]*D[1]+D[2]*D[2])<10){
    var en=null, ed=Infinity;
    kutular.forEach(function(q){ var p=T.p.map(function(v, i){ return Math.max(q.lo[i], Math.min(q.hi[i], v)); }), d=uz(p, T.p); if(d<ed){ ed=d; en=p; } });
    D=en ? [en[0]-T.p[0], en[1]-T.p[1], en[2]-T.p[2]] : [0, 0, 1];
  }
  // Takozdan (eksen ii, yön ss) ilk kutunun yüzü — kesiti takozu içeren kutu
  var isin=function(ii, ss){
    var en=null;
    kutular.forEach(function(q){
      for(var k=0;k<3;k++) if(k!==ii && (T.p[k]<q.lo[k] || T.p[k]>q.hi[k])) return;
      var y=(ss>0 ? q.lo[ii]-T.p[ii] : T.p[ii]-q.hi[ii]);
      if(y>0 && y<=E.erim && (!en || y<en.d)) en={ d:y, k:q.k };
    });
    return en;
  };
  // Yön sırası: CG'nin baskın ekseni önce (kendi işaretiyle); o yönde gövde
  // yoksa sıradaki eksen, hiçbirinde yoksa en yakın yüz (altı yön) — Tulga'nın
  // sağ arka braketi takozun 29 mm üstünde, gövdesi yanında
  var sira=[0, 1, 2].sort(function(a, c){ return Math.abs(D[c])-Math.abs(D[a]); });
  var i=sira[0], s=D[i]<0 ? -1 : 1, d=null, hedef=null, vur=null;
  sira.forEach(function(ii){ if(vur || !(Math.abs(D[ii])>1)) return; var ss=D[ii]<0 ? -1 : 1, h=isin(ii, ss); if(h){ vur=h; i=ii; s=ss; } });
  if(!vur) [0, 1, 2].forEach(function(ii){ [-1, 1].forEach(function(ss){ var h=isin(ii, ss); if(h && (!vur || h.d<vur.d)){ vur=h; i=ii; s=ss; } }); });
  if(vur){ d=vur.d; hedef=vur.k; }
  else d=Math.max(60, Math.min(E.erim, 2*Math.abs(D[i])));
  if(d<E.enAz) return null;
  var V=b.m/E.ro, lv={ takoz:T.k, govde:hedef, T:T.p.slice(), i:i, s:s, d:d, ro:E.ro };
  if(i===2){ lv.w=lv.t=Math.sqrt(V/d); lv.h=0; lv.vz=s; }
  else {
    lv.h=d; lv.vz=(B[2]-T.p[2]<-5) ? -1 : 1;
    var t=Math.sqrt(V/(E.oran*2*d));
    for(var n=0;n<30;n++){ var t2=Math.sqrt(V/(E.oran*(2*d+0.5*t))); if(Math.abs(t2-t)<1e-12){ t=t2; break; } t=t2; }
    lv.t=t; lv.w=E.oran*t;
  }
  return lv;
}
// İŞARET BOYU (kullanıcı 2026-10-16: "takoz ve bileşenlerin ağırlık
// merkezlerinin görünümü biraz ufak olmuş"): pencerede ×1,5; daha geniş
// çizimde (geniş sütun, tam ekran) genişliğin kareköküyle en çok √2 kat daha.
// Yakınlaştırmanın payını çizici ekler (mount-akso.js → ik).
function _mntAksoIsaret(W){ return 1.5*Math.sqrt(Math.max(1, Math.min(2, W/_MNT_KROKI_W))); }
// Çizimin etkileşim dili — kısayol penceresinin dilinde (tipografi kuralı),
// başlıktaki bakış adının ipucu.
var _MNT_AKSO_IPUCU = 'Sol tık + sürükle: döndür · Sağ tık + sürükle: kaydır · Tekerlek: yakınlaştır · Çift tık: sıfırla';
// Gösterge — çizimin işaretleri, çizimin renkleriyle (pencere, tam ekran ve
// "Güç grubundaki yeri" aynı üreticiden).
function _mntAksoLejant(m, b, sec){
  return '<div class="ve-mnt-kroki-lej ve-mnt-ak-lej">'
    + '<span><svg viewBox="0 0 10 10" aria-hidden="true"><path class="ve-ak-lj-g" d="M5 1 L9 3 L5 5 L1 3 Z"/><path class="ve-ak-lj-gy" d="M1 3 L5 5 L5 9 L1 7 Z"/><path class="ve-ak-lj-gx" d="M5 5 L9 3 L9 7 L5 9 Z"/></svg>gövde · eşdeğer kutu</span>'
    + '<span><svg viewBox="0 0 10 10" aria-hidden="true"><rect class="ve-ak-lj-t" x="2" y="2" width="6" height="6" rx="1"/></svg>takoz · T</span>'
    + '<span><svg viewBox="0 0 10 10" aria-hidden="true"><circle class="ve-ak-lj-G" cx="5" cy="5" r="3.6"/></svg>G · birleşik CG</span>'
    + (m.govde.some(function(g){ return g.braket && (g.levha || g.kutu); }) ? '<span><svg viewBox="0 0 10 10" aria-hidden="true"><path class="ve-ak-lj-br" d="M2 1.5 H4.6 V6.6 H8.8 V9 H2 Z"/></svg>braket</span>' : '')
    + (m.govde.some(function(g){ return !g.kutu && !g.levha; }) ? '<span><svg viewBox="0 0 10 10" aria-hidden="true"><circle class="ve-ak-lj-n" cx="5" cy="5" r="2"/></svg>nokta kütle</span>' : '')
    + (b.z>0 ? '<span><svg viewBox="0 0 10 10" aria-hidden="true"><path class="ve-ak-lj-gol" d="M1 6 L5 4 L9 6 L5 8 Z"/></svg>Z = 0\'a düşen iz</span>' : '')
    + (sec ? '<span><svg viewBox="0 0 10 10" aria-hidden="true"><rect class="ve-ak-lj-sec" x="1.5" y="1.5" width="7" height="7" rx="1.5"/></svg>bu bileşen</span>' : '')
    + '</div>';
}
// Pencerenin, tam ekranın ve "Güç grubundaki yeri"nin aksonometrisi — başlık
// (bakışın adı, görünüm düğmeleri), çizim, gösterge. `tam`: tam ekran
// (işaretler adlarıyla; başlıkta tam ekran düğmesi yok). `ek.sec`: bu bileşenin
// düğüm kimliği — perdenin üstünde, adıyla; `ek.H`: tam ekranın ölçülen
// yüksekliği (_mntAksoTamH).
// YALIN KAP (Canlı Not 37 · sihirbazın masası): `ek.yalin` yalnız çizimi
// döndürür (başlık ve gösterge kabın sahibinde), `ek.H` yüksekliği, `ek.perdesiz`
// seçiliyi perdesiz vurgular, `ek.etiket` yazı kipini verir.
function _mntAksoHTML(P, W, tam, kapId, ek){
  if(!_mntAk()) return _mntNot('Aksonometrik çizici yüklenmedi.', 'warn');
  ek=ek||{};
  var A=_mntAkso3bOku(), m=_mntAksoModel(P);
  if(!m.govde.length && !m.takoz.length) return '<div class="ve-mnt-kroki-bos">Görüntülenecek bileşen yok.</div>';
  var ekranH=(typeof window!=='undefined' && window.innerHeight) || 900;
  var G=_mntAksoGorus(kapId), b=veMntAkso.kamB(veMntAkso.kamYon(A)), on=_mntAkso3bOnAdi(A);
  // Bileşen kimlikle bulunur (sıra, silinen bir düğümle kayardı).
  var sec=null;
  if(ek.sec!=null) m.govde.concat(m.takoz).forEach(function(x){ if(x.id!=null && String(x.id)===String(ek.sec)) sec=x; });
  W=Math.max(200, Math.round(W));
  // Serbest kamera: sığdırma dönmeden bağımsız (küre), yükseklik sabit. Yazı
  // yerleri bir önceki çizimden (yapışkan yer, mount-akso.js → yerlestir).
  var o={ W:W, stil:'golge', kat:{ golge:true }, etiket:ek.etiket || ((tam && W>=560) ? 'genis' : 'ad'),
    fs:{ k:_mnt2DFs('micro'), b:_mnt2DFs('tiny') },
    kam:{ az:A.az, el:A.el }, kure:true, yakin:G.yakin, kay:G.kay, isaret:_mntAksoIsaret(W),
    H:tam ? (ek.H>0 ? Math.round(ek.H) : Math.max(380, Math.min(760, Math.round(ekranH*0.7))))
          : (ek.H>0 ? Math.round(ek.H) : Math.round(Math.max(280, Math.min(460, W*0.92)))),
    yer:(_mntAksoCizim[kapId] && _mntAksoCizim[kapId].yer) || null };
  if(ek.balon) o.balon=true;   // yazılar çerçeveli çip, kısa kırık kılavuz (sihirbazın masası, Canlı Not 41)
  if(ek.ortu && ek.ortu.length) o.ortu=ek.ortu;   // çizimin üstünde yüzen yüzeyler
  if(sec){ o.secili=sec.k; o.perde=!ek.perdesiz; if(!ek.perdesiz) o.aria='Güç grubundaki yeri: '+sec.ad; }
  var r=veMntAkso.ciz(m, o), svg=_mntAksoSvg(r.svg);
  // Sürüklerken hızlı kare ve föyün vurgusu aynı model ve seçeneklerle
  // çizilir (_mntAkso3bHizli · _mntAksoOdak); `svg` son çizimin kendisi.
  _mntAksoCizim[kapId]={ m:m, o:o, F:r.F, yer:r.yer, svg:svg };
  if(ek.yalin) return '<div class="ve-mnt-2d ve-mnt-akso ve-mnt-akso3b ve-mnt-akso-yalin" data-mnt2d="akso">'+svg+'</div>';
  var ay=function(k, v){ return 'veMntAksoAyar(\''+kapId+'\',\''+k+'\''+(v==null ? '' : ',\''+v+'\'')+')'; };
  var dg=function(js, ik, ad){ return '<button type="button" title="'+ad+'" aria-label="'+ad+'" onclick="'+js+'">'+veIkon(ik)+'</button>'; };
  // Başlık: bakışın adı (ipucu çizimin etkileşimi), sağda görünüm düğmeleri —
  // yakınlaştırma çizicinin kendi ölçeği (yazı aynı boyda kalır), Sıfırla
  // dimetrik bakışa döner, tam ekran pencerenin çiziminde.
  var bas='<b data-ak3b-ad title="'+_mntEsc(_MNT_AKSO_IPUCU)+'">'+(on ? on[1] : 'Serbest bakış')+'</b>'
    + '<div class="ve-mnt2d-zoomctl" role="group" aria-label="Görünüm">'
    + dg(ay('yakin', 'in'), 'plus', 'Yakınlaştır')+dg(ay('yakin', 'out'), 'minus', 'Uzaklaştır')
    + dg(ay('sifirla'), 'rotate-ccw', 'Sıfırla — dimetrik bakış')
    + (tam ? '' : dg('veMntAkso3BTamEkran('+(sec ? '\''+_mntEsc(ek.sec)+'\'' : '')+')', 'maximize', 'Tam ekran'))
    + '</div>';
  return '<div class="ve-mnt-2d ve-mnt-akso ve-mnt-akso3b" data-mnt2d="akso"><div class="ve-mnt-kroki-bas">'+bas+'</div>'+svg+'</div>'
    + _mntAksoLejant(m, b, sec);
}
// Çizim klavyeyle odaklanır (oklar döndürür): tabindex dizgide — kap yerinde
// tazelenirken (kroki, `data-tazele`) dış HTML karşılaştırılır, sonradan
// eklenen bir nitelik her tazelemede "değişti" saydırırdı.
function _mntAksoSvg(svg){ return /^<svg [^>]*tabindex=/.test(svg) ? svg : svg.replace(/^<svg ([^>]*)>/, '<svg $1 tabindex="0">'); }
// Kabın çizimini yerinde değiştir (başlık, gösterge ve odak yerinde kalır).
function _mntAksoSvgDegis(kap, svg){
  var eski=kap.querySelector('svg.ve-mnt2d-akso'); if(!eski) return false;
  var tmp=document.createElement('div'); tmp.innerHTML=_mntAksoSvg(svg);
  var yeni=tmp.firstChild, odakta=(document.activeElement===eski);
  eski.parentNode.replaceChild(yeni, eski);
  if(odakta && yeni.focus) yeni.focus();
  return true;
}
// TAM EKRANDA ÇİZİME KALAN YÜKSEKLİK (kullanıcı 2026-10-16: "büyük ekran
// yaptığımda, görselleştiricinin altında … çok geniş bir boşluk var"): çizim
// ekranın %70'i, en çok 760 px kuruluyordu ve pencere ondan uzundu — altında
// 85 (1366 × 768) ile 495 px (2560 × 1440) arası boşluk. Yükseklik kabın
// (.ve-mnt2d-fs) içinden ölçülür: iç yükseklik eksi dolgu, eksi başlık ve
// gösterge (kurulu çizimden; ilk kurulumda tahmin).
function _mntAksoTamH(kap){
  var fs=kap && kap.parentNode; if(!fs || !fs.clientHeight) return 0;
  var cs=(typeof getComputedStyle==='function') ? getComputedStyle(fs) : null;
  var pad=cs ? (parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0) : 24;
  var sv=kap.querySelector('svg.ve-mnt2d-akso');
  var dis=sv ? kap.getBoundingClientRect().height-sv.getBoundingClientRect().height : 64;
  return Math.max(320, Math.floor(fs.clientHeight-pad-dis-1));
}
// Kabın aksonometrisini GERÇEK genişliğinde kur ve dinleyicileri bağla. W
// verilmezse kabın kendi genişliği.
// KABIN MODELİ (Canlı Not 37): kap kendi modelini beyan ederse (sihirbazın
// masası — `_mntAksoKaynak[kapId]`, P döndürür) kurulum, sürüklemenin bitişi ve
// görünüm düğmeleri onu okur; beyan yoksa canlı model.
var _mntAksoKaynak = {};
function _mntAksoKur(kapId, W, P){
  if(typeof document==='undefined') return false;
  var kap=document.getElementById(kapId); if(!kap) return false;
  var sabit=Number(kap.getAttribute('data-w'));            // kroki: hep aynı genişlik
  if(sabit>200) W=sabit;
  else if(!(W>200)) W=Math.floor(kap.clientWidth)-2;
  if(!(W>200)) return false;
  var tam=kap.getAttribute('data-tam')==='1', ek={ sec:kap.getAttribute('data-sec') };
  if(kap.getAttribute('data-yalin')==='1') ek.yalin=true;
  if(kap.getAttribute('data-perde')==='0') ek.perdesiz=true;
  if(kap.getAttribute('data-etiket')) ek.etiket=kap.getAttribute('data-etiket');
  if(kap.getAttribute('data-balon')==='1') ek.balon=true;
  if(kap.getAttribute('data-ortu')) ek.ortu=kap.getAttribute('data-ortu').split(';').map(function(t){
    var v=t.split(',').map(Number); return { l:v[0], t:v[1], r:v[2], b:v[3] }; }).filter(function(r){ return [r.l, r.t, r.r, r.b].every(isFinite); });
  if(!tam && Number(kap.getAttribute('data-h'))>120) ek.H=Number(kap.getAttribute('data-h'));
  P=P||(typeof _mntAksoKaynak[kapId]==='function' ? _mntAksoKaynak[kapId]() : null)||_mnt2DPencereVeri();
  if(tam) ek.H=_mntAksoTamH(kap);
  kap.innerHTML=_mntAksoHTML(P, W, tam, kapId, ek);
  // Tam ekran kabı doldurur: başlık ve gösterge ölçülür, ikinci kurulum farkı kapatır.
  if(tam){ var H2=_mntAksoTamH(kap); if(H2 && Math.abs(H2-ek.H)>1){ ek.H=H2; kap.innerHTML=_mntAksoHTML(P, W, tam, kapId, ek); } }
  _mntAksoBagla(kap);
  return true;
}
// Dinleyiciler KABA bir kez (kap tam çizimde yerinde kalır): fare üstü
// bilgisi, serbest kameranın eli (sürükleme, tekerlek, klavye —
// _mntAkso3bBagla; yakınlaştırma çizicinin kendi ölçeği, görünüm kutusu
// büyütülmez) ve bağlantılı vurgu. Krokide ilk fare girişinde ya da odakta.
function _mntAksoBagla(kap){
  if(!kap || !kap.id) return;
  _mnt2DAttachHover(kap);
  _mntAkso3bBagla(kap, kap.id);
  _mntAksoVurguBagla(kap);
}
// SÜRÜKLERKEN HIZLI KARE: yalnız çizim yeniden yazılır (aynı model ve
// seçenekler), başlık ve gösterge yerinde kalır; bırakınca tam çizim
// _mntAksoKur'dan. YAZILARIYLA (kullanıcı 2026-10-16: "görüntünün üzerindeki
// yazılar kayboluyor … beraber dönsünler"): eskiden kare yazısız çiziliyordu
// (Tulga'da 15 yazının 12'si sürükleme boyunca yoktu); yazı yerleri bir önceki
// kareden (yapışkan yer) — yazı işaretiyle yürür. Kare pencerede ~2 ms, tam
// ekranda ~8 ms.
function _mntAkso3bHizli(kapId){
  var c=_mntAksoCizim[kapId], kap=(typeof document!=='undefined') ? document.getElementById(kapId) : null;
  if(!c || !kap) return false;
  var A=_mntAkso3bOku(), G=_mntAksoGorus(kapId);
  // sürüklemenin karesi: çipler (sihirbazın masası) yerinde yürür, bırakınca _mntAksoKur yerleştirir
  var o=Object.assign({}, c.o, { kam:{ az:A.az, el:A.el }, yakin:G.yakin, kay:G.kay, yer:c.yer, surukle:true });
  var r=veMntAkso.ciz(c.m, o), svg=_mntAksoSvg(r.svg);
  if(!_mntAksoSvgDegis(kap, svg)) return false;
  c.F=r.F; c.yer=r.yer; c.svg=svg; c.odak=null;
  var on=_mntAkso3bOnAdi(A), ad=kap.querySelector('[data-ak3b-ad]');
  if(ad) ad.textContent=on ? on[1] : 'Serbest bakış';
  return true;
}
// Serbest kameranın ELİ: sol tık + sürükle döndürür, sağ tık (ya da Shift) +
// sürükle kaydırır, tekerlek imlecin altındaki noktayı sabit tutarak
// yakınlaştırır, çift tık sıfırlar; odaktaki çizimde oklar döndürür, + / −
// yakınlaştırır, 0 sıfırlar. Dinleyiciler KABA bir kez bağlanır (kap tam
// çizimde yerinde kalır, içi yeniden kurulur).
function _mntAkso3bBagla(kap, kapId){
  if(!kap || kap.__ak3b) return;
  kap.__ak3b=true;
  var s=null, raf=0, tekerZam=null;
  var cizimde=function(e){ return e.target && e.target.closest ? e.target.closest('svg.ve-mnt2d-akso') : null; };
  var kare=function(){ if(raf) return; raf=requestAnimationFrame(function(){ raf=0; _mntAkso3bHizli(kapId); }); };
  var bitir=function(odak){
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    _mntAkso3bYaz();
    _mntAksoKur(kapId);
    if(odak){ var sv=kap.querySelector('svg.ve-mnt2d-akso'); if(sv && sv.focus) sv.focus(); }
  };
  kap.addEventListener('pointerdown', function(e){
    var sv=cizimde(e); if(!sv || (e.button!==0 && e.button!==2)) return;
    e.preventDefault();
    var A=_mntAkso3bOku(), G=_mntAksoGorus(kapId), bb=sv.getBoundingClientRect();
    s={ x:e.clientX, y:e.clientY, az:A.az, el:A.el, kay:G.kay.slice(), kaydir:(e.button===2 || e.shiftKey),
        birim:(bb.width>0 ? (Number(sv.viewBox.baseVal.width) || bb.width)/bb.width : 1), oynadi:false, odak:document.activeElement===sv };
    try{ kap.setPointerCapture(e.pointerId); }catch(x){ /* eski tarayıcı */ }
    kap.classList.add('ve-ak3b-surukle');
    // Fare üstü bilgisi çizimi örtmez: basılı düğmede fare olayı gelmez
    // (pointerdown'ın preventDefault'u), kutu bırakınca yeniden açılır.
    var ip=document.getElementById('ve-mnt-2d-tip'); if(ip) ip.style.display='none';
  });
  kap.addEventListener('pointermove', function(e){
    if(!s) return;
    var dx=e.clientX-s.x, dy=e.clientY-s.y;
    if(!s.oynadi && Math.abs(dx)+Math.abs(dy)<3) return;
    s.oynadi=true;
    var A=_mntAkso3bOku(), G=_mntAksoGorus(kapId);
    if(s.kaydir) G.kay=[s.kay[0]+dx*s.birim, s.kay[1]+dy*s.birim];
    else { var y=_mntAkso3bDondur(s, dx, dy); A.az=y.az; A.el=y.el; }
    kare();
  });
  var birak=function(){
    if(!s) return;
    var oynadi=s.oynadi, odak=s.odak; s=null;
    kap.classList.remove('ve-ak3b-surukle');
    if(oynadi) bitir(odak);
  };
  kap.addEventListener('pointerup', birak);
  kap.addEventListener('pointercancel', birak);
  kap.addEventListener('contextmenu', function(e){ if(cizimde(e)) e.preventDefault(); });
  kap.addEventListener('wheel', function(e){
    var sv=cizimde(e); if(!sv) return;
    e.preventDefault();
    var c=_mntAksoCizim[kapId]; if(!c || !c.F || !c.F.kure) return;
    var pt=sv.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
    var q=pt.matrixTransform(sv.getScreenCTM().inverse()), G=_mntAksoGorus(kapId);
    var y=_mntAkso3bYakinlas(G, e.deltaY<0 ? 1.15 : 1/1.15, [q.x, q.y], c.F.kure);
    G.yakin=y.yakin; G.kay=y.kay;
    kare();
    clearTimeout(tekerZam);
    tekerZam=setTimeout(function(){ bitir(false); }, 220);
  }, { passive:false });
  kap.addEventListener('dblclick', function(e){
    if(!cizimde(e)) return;
    veMntAksoAyar(kapId, 'sifirla');
  });
  kap.addEventListener('keydown', function(e){
    var sv=cizimde(e); if(!sv) return;
    var A=_mntAkso3bOku(), G=_mntAksoGorus(kapId), y=null;
    if(e.key==='ArrowLeft') y=_mntAkso3bDondur(A, -10, 0);
    else if(e.key==='ArrowRight') y=_mntAkso3bDondur(A, 10, 0);
    else if(e.key==='ArrowUp') y=_mntAkso3bDondur(A, 0, -10);
    else if(e.key==='ArrowDown') y=_mntAkso3bDondur(A, 0, 10);
    else if(e.key==='+' || e.key==='=') G.yakin=Math.min(8, G.yakin*1.25);
    else if(e.key==='-') G.yakin=Math.max(0.4, G.yakin/1.25);
    else if(e.key==='0'){ G.yakin=1; G.kay=[0, 0]; y=_mntAkso3bOnAci('dim'); if(_mntAksoCizim[kapId]) _mntAksoCizim[kapId].yer=null; }
    else return;
    e.preventDefault();
    if(y){ A.az=y.az; A.el=y.el; }
    bitir(true);
  });
}
// Bağlantılı vurgu: işaretin üstüne gelince aynı işaretin her izi (gövde,
// gölgesi, etiketi) birlikte vurgulanır. Yazı opaklıkla soldurulmaz —
// vurgulanan işaretin kenarı vurgu rengini alır. ÇİZİM → FÖY (kullanıcı
// 2026-11-06, Canlı Not 48: *"görünüm üzerinden gezerken, işaretler tablosunun da
// renklenmesini istiyorum"*): pencerenin İşaretler föyü varsa (kabı çizimin
// kimliğini taşır, `data-ak-kap`) aynı anahtarlı satır da vurgulanır — föyün
// satırı → çizim yönünün (_mntAksoOdak) tersi.
function _mntAksoVurguBagla(kap){
  if(!kap || kap.__mntAksoVurgu) return;
  kap.__mntAksoVurgu=true;
  var son=null;
  var foy=function(){ return (kap.id && typeof document!=='undefined') ? document.querySelector('.ve-mnt-foy-odak[data-ak-kap="'+kap.id+'"]') : null; };
  var bitir=function(){
    if(!son) return;
    Array.prototype.forEach.call(kap.querySelectorAll('.ve-ak-vurgu'), function(e){ e.classList.remove('ve-ak-vurgu'); });
    var f=foy();
    if(f) Array.prototype.forEach.call(f.querySelectorAll('tr.ve-ak-satir'), function(t){ t.classList.remove('ve-ak-satir'); });
    son=null;
  };
  kap.addEventListener('mousemove', function(e){
    var el=e.target && e.target.closest ? e.target.closest('svg.ve-mnt2d-akso [data-ak]') : null;
    var k=el ? el.getAttribute('data-ak') : null;
    if(k==='duvar') k=null;
    if(k===son) return;
    bitir();
    if(!k) return;
    son=k;
    Array.prototype.forEach.call(kap.querySelectorAll('svg.ve-mnt2d-akso [data-ak="'+k+'"]'), function(x){ x.classList.add('ve-ak-vurgu'); });
    var f=foy(), tr=f ? f.querySelector('tr[data-ak="'+k+'"]') : null;
    if(tr) tr.classList.add('ve-ak-satir');
  });
  kap.addEventListener('mouseleave', bitir);
}
// Denetim: görünüm tercihini yaz ve kabın aksonometrisini yeniden kur
// (pencere kurulmaz — başlık ve föy yerinde kalır). `yakin`: in · out ·
// reset (yakınlık ve kaydırma); `sifirla`: dimetrik bakış + yakınlık +
// kaydırma (başlığın Sıfırla'sı, çift tık); `on`: hazır bakış — arayüzde
// düğmesi yok (2026-10-16), testler bakışı onunla kurar.
function veMntAksoAyar(kapId, k, v){
  var A=_mntAkso3bOku(), G=_mntAksoGorus(kapId), a=null;
  // Sıçrayan bakışta (Sıfırla, hazır bakış) yazılar yapışmaz: yerleri baştan.
  if((k==='sifirla' || k==='on') && _mntAksoCizim[kapId]) _mntAksoCizim[kapId].yer=null;
  if(k==='yakin'){
    if(v==='in') G.yakin=Math.min(8, G.yakin*1.25);
    else if(v==='out') G.yakin=Math.max(0.4, G.yakin/1.25);
    else { G.yakin=1; G.kay=[0, 0]; }
  } else if(k==='sifirla'){
    a=_mntAkso3bOnAci('dim'); A.az=a.az; A.el=a.el; G.yakin=1; G.kay=[0, 0];
  } else if(k==='on'){
    a=_mntAkso3bOnAci(v); if(a){ A.az=a.az; A.el=a.el; }
  }
  _mntAkso3bYaz();
  if(typeof document==='undefined') return false;
  var kap=document.getElementById(kapId);
  var odak=(document.activeElement && kap && kap.contains(document.activeElement)) ? document.activeElement.getAttribute('onclick') : null;
  var ok=_mntAksoKur(kapId);
  // Odak basılan denetimde kalır (klavyeyle gezen kullanıcı yerini kaybetmez).
  if(ok && odak){
    var yeni=Array.prototype.filter.call(kap.querySelectorAll('button[onclick]'), function(b){ return b.getAttribute('onclick')===odak; })[0];
    if(yeni && yeni.focus) yeni.focus();
  }
  return ok;
}

// FÖYÜN SATIRI → ÇİZİM (kullanıcı 2026-10-16: "o tabloda fare ile üstünde
// gezdirirken … o parçaya geldiğimde aydınlık olsun, diğer parçalar gölgeye
// düşsün"): satır çizimin anahtarını taşır (data-ak — _mntAksoModelKur'un
// k'si: G · g1… · T1…); fare satırdayken o parça perdenin üstünde, kalan
// model altında. Çizim aynı model, kamera ve yazı yerleriyle yeniden çizilir;
// satırdan çıkınca son çizim AYNEN geri konur (yazılar kıpırdamaz).
function _mntAksoOdak(kapId, k){
  if(typeof document==='undefined') return false;
  var c=_mntAksoCizim[kapId], kap=document.getElementById(kapId);
  if(!c || !kap) return false;
  k=k || null;
  if((c.odak || null)===k) return true;
  c.odak=k;
  if(!k) return _mntAksoSvgDegis(kap, c.svg);
  var A=_mntAkso3bOku(), G=_mntAksoGorus(kapId);
  var o=Object.assign({}, c.o, { kam:{ az:A.az, el:A.el }, yakin:G.yakin, kay:G.kay, yer:c.yer, secili:k, perde:true });
  return _mntAksoSvgDegis(kap, veMntAkso.ciz(c.m, o).svg);
}
// Föyün dinleyicisi tablonun kabında (satırlar yerinde tazelenebilir).
function _mntFoyOdak(e, kapId){
  var tr=(e && e.target && e.target.closest) ? e.target.closest('tr[data-ak]') : null;
  return _mntAksoOdak(kapId, tr ? tr.getAttribute('data-ak') : null);
}
// İŞARETLER DÜZENLENİR (kullanıcı 2026-11-11, Canlı Not 124: *"Bu tablo üzerinden
// komponentlere tıkladığımda X, Y, Z koordinatlarını düzenleyebileyim"*): gövdenin ve
// takozun konum hücresi bileşenin KENDİ alanının girdisi — gövde cgx · cgy · cgz,
// takoz x · y · z; kimlik ve değer bileşenin penceresindekiyle aynı
// (`ve-mnt-<alan>-<düğüm>`). Yazınca çizim yeniden kurulur (veMntIsaretYaz), Birleşik
// CG satırı ve eksik notu yerinde tazelenir; Birleşik CG türetilir, düzenlenmez.
// `kimlik`: pencerenin düğümü (tazelenen satırların kimliği).
function _mnt2DIsaretFoy(P, kimlik){
  var M=P.M, cg=P.veri.cg, eks=0, kim=_mntEsc(kimlik || 'foy');
  var hucre=function(v){ return _mntBos(v) ? '<td class="eks">boş</td>' : '<td>'+_mntS(_mntNum(v),0)+'</td>'; };
  var sat=function(k, no, ad, n, al, deger){
    if(deger.some(_mntBos)) eks++;
    var hc=n ? al.map(function(a, i){ return _mntFoyGir(n, a, ad+' '+'XYZ'[i], { zorunlu:true, ph:'boş', setter:'veMntIsaretYaz' }); }).join('')
             : deger.map(hucre).join('');
    return '<tr data-ak="'+k+'"><td>'+no+'</td><td class="sol" title="'+_mntEsc(ad)+'">'+_mntEsc(ad)+'</td>'+hc+'</tr>';
  };
  // Konum sütunları girdi taşır: sütunda girdi ≥ 56 px (mufettis-sigma.spec.js) → %18'er.
  var h=_mntFoyAc([{ b:'No', gen:'10%' }, { b:'Ad', gen:'36%', sinif:'sol' }, { b:'X', gen:'18%' }, { b:'Y', gen:'18%' }, { b:'Z', gen:'18%' }],
                  'İşaretler', 've-mnt-foy--sik');
  if(cg) h+='<tr class="top" data-ak="G" id="ve-mnt-isr-g-'+kim+'" data-tazele><td>G</td><td class="sol">Birleşik CG</td><td>'+_mntS(cg.x,0)+'</td><td>'+_mntS(cg.y,0)+'</td><td>'+_mntS(cg.z,0)+'</td></tr>';
  M.g.components.forEach(function(c, i){ h+=sat('g'+(i+1), String(i+1), c.name, _mntDugum(c.id), ['cgx','cgy','cgz'], [c.cgx, c.cgy, c.cgz]); });
  M.g.mounts.forEach(function(m, i){ h+=sat('T'+(i+1), 'T'+(i+1), m.name, _mntDugum(m.id), ['x','y','z'], [m.x, m.y, m.z]); });
  h+=_MNT_FOY_KAPA;
  return h+'<div id="ve-mnt-isr-eks-'+kim+'" data-tazele>'+(eks ? _mntNot(eks+' işaretin konumu eksik: 0 alındı.', 'warn') : '')+'</div>';
}
// İşaretin konumunu yaz (föyün girdisi): bileşenin alanı tek geri-al adımıyla
// (veMntSet → pencerenin tazelemesi: G satırı, eksik notu), sonra açık
// Görünümler'in çizimi yeni konumla — kamera, yakınlık ve yazı yerleri yerinde.
function veMntIsaretYaz(nodeId, key, val){
  veMntSet(nodeId, key, val);
  return veMnt2DViewRefresh();
}
// GÖRÜNÜMLER PENCERESİ — TEK görünüm (kullanıcı kararı 2026-10-16): döndürülen
// aksonometri, göstergesi ve altında işaretlerinin föyü (çizimdeki numaraların
// açılımı, konumları). Tek kategori; sağ sütun yok — kabuk tek sütuna iner.
// `tazele`: pencerenin yerinde tazelemesi (veMntPencereTazele) için — çizimin
// kabı yerinde tazelenmez (veMnt2DViewRefresh kurar), karşılaştırma çizimi
// kurulmaz: son çizimin kaydını (yapışkan yazı yerleri) ezerdi.
function getMnt2DViewPropertiesHTML(node, tazele){
  if(!node.data) node.data={};
  var P=_mnt2DPencereVeri(), M=P.M, kapId='ve-mnt-akso3b-'+node.id;
  var bos=!M.g.components.length && !M.g.mounts.length;
  var em=M.g.components.length+' gövde · '+M.g.mounts.length+' takoz'+(M.mTop>0 ? ' · '+_mntS(M.mTop,1)+' kg' : '');
  var govde=bos ? '<div class="ve-mnt-kroki-bos">Görüntülenecek bileşen yok.</div>'+_mntBolum('İşaretler', em, _mntNot('Kanvasta model yok.', ''))
    : '<div class="ve-mnt-akso-kap" id="'+kapId+'">'+(tazele ? '' : _mntAksoHTML(P, _MNT_KROKI_W, false, kapId))+'</div>'
      + _mntBolum('İşaretler', em, '<div class="ve-mnt-foy-odak" data-ak-kap="'+kapId+'" onmouseover="_mntFoyOdak(event,\''+kapId+'\')"'
        + ' onmouseleave="_mntAksoOdak(\''+kapId+'\',null)">'+_mnt2DIsaretFoy(P, node.id)+'</div>');
  return _mntPencereKabuk(node, [{ k:'akso', ad:'Aksonometrik', govde:govde }], '');
}
// Açılışta (cp-core), sütun genişliği değişince ve tam ekran kapanınca:
// aksonometri kabın GERÇEK genişliğinde yeniden kurulur.
function veMnt2DViewRefresh(){
  if(typeof document==='undefined') return false;
  var kok=document.querySelector('.ve-properties-content [data-mnt-pencere]');
  var node=kok ? _mntDugum(kok.getAttribute('data-mnt-pencere')) : null;
  if(!node || node.type!=='mnt-2dview') return false;
  var gov=document.getElementById('ve-fp-panes-'+node.id);
  var W=gov ? Math.floor(gov.clientWidth)-2 : 0;          // kabın kenarlığı 2 × 1
  return (W>200) ? _mntAksoKur('ve-mnt-akso3b-'+node.id, W) : false;
}
// Topolojiden 2D diyagram verisi topla (SI değil — mm; birleşik CG kütle-ağırlıklı).
// `liste` (ops.): düğüm listesi (sihirbazın önizlemesi); yoksa canlı `nodes`.
function _mnt2DGather(liste){
  var g=_mntGatherForSolver(null, liste);
  var num=function(v){ var n=Number(String(v).replace(',','.')); return Number.isFinite(n)?n:NaN; };
  var C=(typeof veMountCore!=='undefined') ? veMountCore : null;
  var comps=g.components.map(function(c){
      var o={id:c.id, name:c.name, mass:num(c.mass), x:num(c.cgx), y:num(c.cgy), z:num(c.cgz)};
      // Eşdeğer kutu (mm, x · y · z) — 3B'nin kutusu (_mntAksoModelKur): düz görünüşte
      // gövdenin çerçevesi (Canlı Not 79). Nokta kütle ve atalet eksikse yok.
      var k=(C && C.equivalentBox) ? C.equivalentBox(o.mass, [[num(c.Ixx),0,0],[0,num(c.Iyy),0],[0,0,num(c.Izz)]], !!c.pointMass) : null;
      if(k && k.every(function(v){ return v>0 && Number.isFinite(v); })) o.kutu=k.map(function(v){ return v*1000; });
      return o; })
    .filter(function(c){ return Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.z); });
  var mounts=g.mounts.map(function(m){ return {id:m.id, name:m.name, x:num(m.x), y:num(m.y), z:num(m.z)}; })
    .filter(function(m){ return Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z); });
  var mSum=0,sx=0,sy=0,sz=0;
  comps.forEach(function(c){ if(c.mass>0){ mSum+=c.mass; sx+=c.mass*c.x; sy+=c.mass*c.y; sz+=c.mass*c.z; } });
  var cg=mSum>0?{x:sx/mSum,y:sy/mSum,z:sz/mSum,m:mSum}:null;
  return { comps:comps, mounts:mounts, cg:cg };
}
// SVG metin/işaret yardımcıları — akademik, tek renkli (tema uyumlu) görünüm.
// Yüz KAPSAYICIDAN miras (tek yüz, 2026-09-23): çizim arayüzün içinde Inter,
// bir belgeye gömülünce belgenin yüzüyle yazılır. Eskiden eş aralıklı bir
// yığın ve hiç kullanılmayan ikinci bir sans yığını tutuyordu.
var _MNT2D_YUZ='inherit';
// İşaret renkleri — bileşen ikonuyla (components.js) tutarlı, tema uyumlu:
// takoz=yeşil, bileşen CG=amber, birleşik CG=kırmızı. Fallback'li accent-* değişkenleri.
var _MNT2D_C_MOUNT='var(--accent-success)';
var _MNT2D_C_COMP ='var(--accent-warning)';
var _MNT2D_C_CG   ='var(--accent-danger)';
// hale: zemin rengi verilirse yazı o renkte bir kontur taşır (paint-order) —
// altından geçen ızgara, referans ve kılavuz çizgisi yazının çevresinde kesilir.
function _mnt2DText(x,y,t,anchor,color,size,bold,family,hale){
  return '<text x="'+_mnt2DR(x)+'" y="'+_mnt2DR(y)+'" text-anchor="'+(anchor||'middle')+'" font-size="'+(size||8)+'"'
    + ' font-family="'+(family||_MNT2D_YUZ)+'" fill="'+(color||'var(--text-secondary)')+'"'+(bold?' font-weight="700"':'')
    + (hale ? ' paint-order="stroke" stroke="'+hale+'" stroke-width="2.4" stroke-linejoin="round"' : '')
    + '>'+_mntEsc(t)+'</text>';
}
// Doğru parçası ↔ kutu {l,r,t,b} (pay kadar büyütülmüş kutuya göre).
function _mnt2DSegKutu(x1, y1, x2, y2, k, pay){
  pay = pay || 0;
  var l = k.l - pay, r = k.r + pay, t = k.t - pay, b = k.b + pay;
  if(Math.max(x1, x2) < l || Math.min(x1, x2) > r || Math.max(y1, y2) < t || Math.min(y1, y2) > b) return false;
  if((x1 >= l && x1 <= r && y1 >= t && y1 <= b) || (x2 >= l && x2 <= r && y2 >= t && y2 <= b)) return true;
  var dx = x2 - x1, dy = y2 - y1;
  var yan = function(x, y){ return dx * (y - y1) - dy * (x - x1); };
  var a = yan(l, t), c = yan(r, t), d = yan(r, b), e = yan(l, b);
  return !((a > 0 && c > 0 && d > 0 && e > 0) || (a < 0 && c < 0 && d < 0 && e < 0));
}
function _mnt2DR(v){ return Math.round(v*10)/10; }
// "Güzel" eksen adımı (1·2·5 ×10^k) ve o adıma oturan işaret (tick) değerleri —
// ölçek ızgarası + sayısal eksen etiketleri için (mm). target ≈ istenen işaret sayısı.
function _mnt2DNiceStep(range, target){
  var raw=range/Math.max(1,target);
  if(!(raw>0)) return 1;
  var mag=Math.pow(10, Math.floor(Math.log(raw)/Math.LN10)), norm=raw/mag, step;
  if(norm<1.5) step=1; else if(norm<3) step=2; else if(norm<7) step=5; else step=10;
  return step*mag;
}
function _mnt2DNiceTicks(min, max, target){
  if(!(max>min)) return [min||0];
  var step=_mnt2DNiceStep(max-min, target||6), ticks=[];
  for(var v=Math.ceil(min/step)*step; v<=max+step*1e-6; v+=step) ticks.push(Math.round(v*1e6)/1e6);
  return ticks;
}
// Eksen işaret etiketi — tam sayı mm, eksi işareti tipografik "−".
function _mnt2DTick(v){ return veSayi(v, 0, { eksi: '−' }); }
function _mnt2DArrow(x1,y1,x2,y2,color,hl){
  hl=hl||7; var ang=Math.atan2(y2-y1,x2-x1);
  var ax=x2-hl*Math.cos(ang-0.42), ay=y2-hl*Math.sin(ang-0.42);
  var bx=x2-hl*Math.cos(ang+0.42), by=y2-hl*Math.sin(ang+0.42);
  return '<line x1="'+_mnt2DR(x1)+'" y1="'+_mnt2DR(y1)+'" x2="'+_mnt2DR(x2)+'" y2="'+_mnt2DR(y2)+'" stroke="'+color+'" stroke-width="1.4"/>'
    + '<polygon points="'+_mnt2DR(x2)+','+_mnt2DR(y2)+' '+_mnt2DR(ax)+','+_mnt2DR(ay)+' '+_mnt2DR(bx)+','+_mnt2DR(by)+'" fill="'+color+'"/>';
}
// Birleşik CG işareti — jeodezik istasyon sembolü (ters iki çeyrek dolu daire).
function _mnt2DCGMark(cx,cy,r,color){
  r=r||10; color=color||'var(--text-primary)'; var s='';
  s+='<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+r+'" fill="var(--bg-primary)" stroke="'+color+'" stroke-width="1.6"/>';
  s+='<path d="M'+_mnt2DR(cx)+' '+_mnt2DR(cy)+' L'+_mnt2DR(cx+r)+' '+_mnt2DR(cy)+' A'+r+' '+r+' 0 0 1 '+_mnt2DR(cx)+' '+_mnt2DR(cy+r)+' Z" fill="'+color+'"/>';
  s+='<path d="M'+_mnt2DR(cx)+' '+_mnt2DR(cy)+' L'+_mnt2DR(cx-r)+' '+_mnt2DR(cy)+' A'+r+' '+r+' 0 0 1 '+_mnt2DR(cx)+' '+_mnt2DR(cy-r)+' Z" fill="'+color+'"/>';
  return s;
}
// Takoz işareti — içi boş kare; yandan görünüşte tarama (hatch) ile doldurulur.
// Yalnızca şekilleri döndürür; hover bilgisi grubu saran <g>'de tutulur.
function _mnt2DMountMark(cx,cy,hatch,color,boy){
  var r=boy||8, s='', col=color||'var(--text-secondary)';
  s+='<rect x="'+_mnt2DR(cx-r)+'" y="'+_mnt2DR(cy-r)+'" width="'+(2*r)+'" height="'+(2*r)+'" rx="1.5" fill="var(--bg-primary)" stroke="'+col+'" stroke-width="1.5"/>';
  if(hatch){
    s+='<line x1="'+_mnt2DR(cx-r)+'" y1="'+_mnt2DR(cy+r)+'" x2="'+_mnt2DR(cx+r)+'" y2="'+_mnt2DR(cy-r)+'" stroke="var(--text-muted)" stroke-width="0.8"/>';
    s+='<line x1="'+_mnt2DR(cx-r)+'" y1="'+_mnt2DR(cy)+'" x2="'+_mnt2DR(cx)+'" y2="'+_mnt2DR(cy-r)+'" stroke="var(--text-muted)" stroke-width="0.8"/>';
    s+='<line x1="'+_mnt2DR(cx)+'" y1="'+_mnt2DR(cy+r)+'" x2="'+_mnt2DR(cx+r)+'" y2="'+_mnt2DR(cy)+'" stroke="var(--text-muted)" stroke-width="0.8"/>';
  }
  return s;
}
// Hover bilgisi attribute'u: satırları kaçışla + &#10; ile birleştir (pre-line render).
function _mnt2DInfoAttr(lines){
  return ' data-mnt-info="'+_mntEsc(lines.join('\n')).replace(/\n/g,'&#10;')+'"';
}
// 2D SVG işaretlerine fare-üstü (hover) bilgi kutusu bağla. Container'a olay
// dinleyici ekler; tek bir yüzen tooltip div'i paylaşılır.
function _mnt2DAttachHover(container){
  if(!container || typeof document==='undefined' || container.__mnt2dHover) return;
  container.__mnt2dHover=true;
  var tip=document.getElementById('ve-mnt-2d-tip');
  if(!tip){ tip=document.createElement('div'); tip.id='ve-mnt-2d-tip';
    tip.className='ve-mnt-hover-ip ve-mnt-hover-ip--metin';     // kutu CSS'ten
    tip.style.zIndex='100060';                                  // tam ekran perdesinin (100045) üstünde
    document.body.appendChild(tip);
  }
  function info(t){ while(t && t!==container){ if(t.getAttribute){ var v=t.getAttribute('data-mnt-info'); if(v) return v; } t=t.parentNode; } return null; }
  container.addEventListener('mousemove', function(e){
    // Sürüklerken (düğme basılı) bilgi kutusu çizimi örtmez.
    if(e.buttons){ tip.style.display='none'; return; }
    var v=info(e.target);
    if(v){ tip.textContent=v; tip.style.display='block';
      var x=e.clientX+14, y=e.clientY+16;
      if(x+tip.offsetWidth>window.innerWidth-8) x=e.clientX-tip.offsetWidth-14;
      if(y+tip.offsetHeight>window.innerHeight-8) y=e.clientY-tip.offsetHeight-16;
      tip.style.left=x+'px'; tip.style.top=y+'px';
    } else { tip.style.display='none'; }
  });
  container.addEventListener('mouseleave', function(){ tip.style.display='none'; });
}
// ÇİZİMİN YAZI BOYU ÖLÇEKTEN (theme.js → veThemeFs; tuvaldekiyle aynı kural):
// boy sayıyla yazılıyordu (8–9,5) ve ekranda 7,8–9,3 px kalıyordu — ölçek
// tabanı 10 px. Çizimler kabın genişliğinde 1:1 kurulduğu için (sihirbazın
// masası, aksonometri) bu boylar ekrandaki boydur.
function _mnt2DFs(ad){
  var y = { micro:10, tiny:11, body:12, md:13 };
  return (typeof veThemeFs === 'function') ? veThemeFs(ad) : y[ad];
}
// Yazının kutusu (SVG kullanıcı birimi) — taban çizgisi y, çapa anchor.
// Genişlik TAHMİNİ: rakam ve büyük harf ~0,6 em; tahmin bilerek cömert,
// kapının ölçtüğü gerçek kutudan küçük kalırsa çakışma kaçar.
function _mnt2DYaziKutu(x, y, t, anchor, size, bold){
  var w = String(t).length * size * (bold ? 0.64 : 0.6);
  var l = (anchor === 'end') ? x - w : (anchor === 'start') ? x : x - w / 2;
  return { l:l, r:l + w, t:y - size * 0.82, b:y + size * 0.26 };
}
function _mnt2DKesisir(a, b, pay){
  pay = pay || 0;
  return a.l < b.r + pay && b.l < a.r + pay && a.t < b.b + pay && b.t < a.b + pay;
}
function _mnt2DKesisimAlani(a, b){
  var x = Math.min(a.r, b.r) - Math.max(a.l, b.l), y = Math.min(a.b, b.b) - Math.max(a.t, b.t);
  return (x > 0 && y > 0) ? x * y : 0;
}
// ETİKET YERLEŞTİRİCİ — kutu çakışması, iki eksende. Eski yerleştirici yalnız
// aynı yandaki (üst/alt) etiketlerin YATAY aralıklarını kademeliyordu:
// işaretleri farklı yükseklikte duran iki etiket kademeler arasında yine
// biniyordu, öteki yanın etiketleriyle ve sabit yazılarla (eksen değeri,
// "Z = 0", +X/+Y) hiç karşılaştırılmıyordu — Tulga'da 9 çakışma ölçüldü
// (tests/e2e/yerlesim.spec.js). Şimdi her etiket, önce yerleşenlerin ve sabit
// yazıların/işaretlerin KUTULARINA çarpmayan ilk adaya konur: tercih edilen
// yan kademe kademe, sonra işaretin sağı/solu, sonra öteki yan. Hiçbiri boş
// değilse en az çakışan aday seçilir (etiket kaybolmaz).
// engeller: [{l,r,t,b}] · sinir: {l, r, t, b} — etiketin kalacağı alan.
// KILAVUZ ÇİZGİSİ DE BİR ENGEL (2026-10-15): kademeye çıkan etiketin
// kılavuzu işaretten etikete dikey iner ve aradaki öteki etiketin İÇİNDEN
// geçiyordu ("Ön Takoz Braketi"nin kılavuzu "Ön Takoz"un, "Braket"inki "Sağ
// Arka Takoz"un üstünden — ölçüldü, sihirbazın masası). Aday, kılavuzu
// yerleşmiş bir kutuyu kesiyorsa dolu sayılır; yerleşmiş kılavuzlar da
// sonraki etiketlerin engeli.
function _mnt2DLabels(items, sinir, engeller, hale){
  // Kılavuzlar BÜTÜN yazılardan önce çizilir (`svgK`): kaçınılamayan bir
  // kılavuz da öteki yazının hâlesinin altında kalır, harfleri kesmez.
  var svg = '', svgK = '', dolu = (engeller || []).slice(), PAY = 2, kilavuzlar = [];
  function kilavuzu(it, a, kutu){
    if(!a.cizgi) return null;
    var y0 = a.ust ? (it.cy - it.mr) : (it.cy + it.mr), y1 = a.ust ? (kutu.b + 1) : (kutu.t - 1);
    return [it.cx, y0, Math.max(kutu.l + 2, Math.min(kutu.r - 2, it.cx)), y1];
  }
  // Öncelik: kalın (birleşik CG), sonra büyük işaret, sonra soldan sağa.
  var sira = items.slice().sort(function(a, b){
    return ((b.bold ? 1 : 0) - (a.bold ? 1 : 0)) || (b.mr - a.mr) || (a.cx - b.cx);
  });
  sira.forEach(function(it){
    var h = it.size * 1.08, adim = h + 3, aday = [];
    // kay: 0 işaretin tam üstü/altı; ±1 bir yana kaymış (kılavuz eğik iner —
    // dikey kılavuz aradaki etiketin içinden geçecekse).
    function dikey(ust, t, kay){
      var bosluk = it.mr + 6;
      var y = ust ? (it.cy - bosluk - t * adim) : (it.cy + bosluk + it.size * 0.82 + t * adim);
      if(kay) return { x:it.cx + kay * (it.mr + 4), y:y, anchor:(kay > 0 ? 'start' : 'end'), cizgi:t > 0, ust:ust };
      return { x:it.cx, y:y, anchor:'middle', cizgi:t > 0, ust:ust };
    }
    var t;
    for(t = 0; t < 4; t++) aday.push(dikey(it.above, t));
    aday.push({ x:it.cx + it.mr + 5, y:it.cy + it.size * 0.32, anchor:'start', cizgi:false });
    aday.push({ x:it.cx - it.mr - 5, y:it.cy + it.size * 0.32, anchor:'end', cizgi:false });
    for(t = 0; t < 4; t++) aday.push(dikey(!it.above, t));
    for(t = 4; t < 12; t++) aday.push(dikey(it.above, t));
    // kaydırılmış kademeler EN SONDA: yalnız öteki adayların hepsi doluyken
    for(t = 1; t < 4; t++) aday.push(dikey(it.above, t, 1), dikey(it.above, t, -1), dikey(!it.above, t, 1), dikey(!it.above, t, -1));
    // SIRALI SEÇİM: önce hiçbir kutuya binmeyen adaylar — aralarında kılavuzu
    // da temiz olan ilki, yoksa kılavuzu en az kesen; hiçbiri kutulardan temiz
    // değilse en az binen (eski ölçüt). Kılavuz cezası yazı binmesiyle aynı
    // terazide tartılınca yazılar üst üste biniyordu (ölçüldü, 3 çift).
    var sec = null, enAz = Infinity, temiz = null, temizCeza = Infinity;
    for(var k = 0; k < aday.length; k++){
      var a = aday[k], kutu = _mnt2DYaziKutu(a.x, a.y, it.text, a.anchor, it.size, it.bold);
      // Kenara taşan orta çapalı aday kenara yaslanır (kırpılmasın).
      if(a.anchor === 'middle'){
        if(kutu.r > sinir.r){ a = { x:sinir.r, y:a.y, anchor:'end', cizgi:a.cizgi, ust:a.ust }; }
        else if(kutu.l < sinir.l){ a = { x:sinir.l, y:a.y, anchor:'start', cizgi:a.cizgi, ust:a.ust }; }
        kutu = _mnt2DYaziKutu(a.x, a.y, it.text, a.anchor, it.size, it.bold);
      }
      if(kutu.l < sinir.l - 0.5 || kutu.r > sinir.r + 0.5 || kutu.t < sinir.t || kutu.b > sinir.b) continue;
      var alan = 0, ceza = 0;
      for(var d = 0; d < dolu.length; d++) if(_mnt2DKesisir(kutu, dolu[d], PAY)) alan += _mnt2DKesisimAlani(kutu, dolu[d]) + 1;
      // yerleşmiş kılavuzlar bu kutuyu kesiyor mu · bu adayın kılavuzu yerleşmiş
      // bir kutuyu kesiyor mu (çıktığı işaretin kendi kutusu hariç)
      for(var g = 0; g < kilavuzlar.length; g++){
        var L = kilavuzlar[g];
        if(_mnt2DSegKutu(L[0], L[1], L[2], L[3], kutu, 1)) ceza++;
      }
      var kl = kilavuzu(it, a, kutu);
      if(kl) for(var d2 = 0; d2 < dolu.length; d2++){
        var o = dolu[d2];
        if(kl[0] >= o.l - 1 && kl[0] <= o.r + 1 && kl[1] >= o.t - 1 && kl[1] <= o.b + 1) continue;   // kendi işareti
        if(_mnt2DSegKutu(kl[0], kl[1], kl[2], kl[3], o, 1)) ceza++;
      }
      if(alan === 0 && ceza === 0){ temiz = { a:a, kutu:kutu }; temizCeza = 0; break; }
      if(alan === 0 && ceza < temizCeza){ temizCeza = ceza; temiz = { a:a, kutu:kutu }; }
      if(alan < enAz){ enAz = alan; sec = { a:a, kutu:kutu }; }
    }
    if(temiz) sec = temiz;
    if(!sec){ var a0 = dikey(it.above, 0); sec = { a:a0, kutu:_mnt2DYaziKutu(a0.x, a0.y, it.text, 'middle', it.size, it.bold) }; }
    dolu.push(sec.kutu);
    var A = sec.a, K = kilavuzu(it, A, sec.kutu);
    if(K){
      // Kılavuz çizgisi işaretin kenarından etiketin kutusuna.
      kilavuzlar.push(K);
      svgK += '<line x1="'+_mnt2DR(K[0])+'" y1="'+_mnt2DR(K[1])+'" x2="'+_mnt2DR(K[2])+'" y2="'+_mnt2DR(K[3])+'" stroke="var(--border-color)" stroke-width="0.7"/>';
    }
    svg += _mnt2DText(A.x, A.y, it.text, A.anchor, it.color, it.size, it.bold, undefined, hale);
  });
  return svgK + svg;
}
// Tek görünüş (üst/yan) çiz — akademik, tek renkli panel: başlık + eksen köşe
// göstergesi + kesikli referans çizgisi + işaretler + çakışmasız etiketler.
// İşaretlerin kutuları — `_mnt2DFigure`'un çizdiği yerle aynı (takozlarda
// yelpaze dâhil). Köşe göstergesinin yeri bunlardan kaçar.
function _mnt2DIsaretKutulari(o, iK){
  var hKey=o.hKey||'x', out=[];
  function hval(p){ return hKey==='y'?p.y:(hKey==='z'?p.z:p.x); }
  var mpts=(o.mounts||[]).map(function(m){ return { cx:o.px(hval(m)), cy:o.pyFn(o.vKey==='y'?m.y:m.z) }; });
  mpts.forEach(function(a,i){ if(a._g) return; var grp=[a]; a._g=1;
    mpts.forEach(function(b,j){ if(j<=i || b._g) return; if(Math.abs(a.cx-b.cx)<12 && Math.abs(a.cy-b.cy)<12){ grp.push(b); b._g=1; } });
    grp.forEach(function(pt,k){ var mx=pt.cx+(grp.length>1?(k-(grp.length-1)/2)*19:0), r=9*iK; out.push({ l:mx-r, r:mx+r, t:pt.cy-r, b:pt.cy+r }); });
  });
  (o.comps||[]).forEach(function(c){ var cx=o.px(hval(c)), cy=o.pyFn(o.vKey==='y'?c.y:c.z), r=o.cr(c.mass);
    out.push({ l:cx-r, r:cx+r, t:cy-r, b:cy+r }); });
  if(o.cg){ var gx=o.px(hval(o.cg)), gy=o.pyFn(o.vKey==='y'?o.cg.y:o.cg.z); out.push({ l:gx-11*iK, r:gx+11*iK, t:gy-11*iK, b:gy+11*iK }); }
  return out;
}
function _mnt2DFigure(o){
  // o: {ox, boxX,boxY,boxW,boxH, FIG_W, title, plotTop,plotH,plotL,plotR, px,pyFn,
  //     hKey,vKey, mounts,comps,cg, cr, compAbove, refV,refLabel,
  //     axis:{hLabel,vLabel,vDir,note}, compLabelFn, mountLabelFn, cgLabelFn}
  // hKey → yatay eksen koordinatı ('x' üst/yan, 'y' önden); vKey → düşey ('y'/'z').
  // İsteğe bağlı (veMnt2DGorunusSVG; verilmezse eski panelin çıktısı BİREBİR):
  //   yalin  → dış panel, başlık ve köşe göstergesi YOK; eksen adı uçlarda
  //   sade   → yalin + ızgara değeri ve etiket YOK (yalnız işaretler)
  //   secili → {tur:'takoz'|'govde', i}: o işaretin çevresinde halka
  //   secim  → işaret grubu `data-mnt-sec="takoz:i"` taşır (masada tıklama)
  //   isaretK → takoz ve birleşik CG işaretinin ölçek katsayısı (küçük resim)
  var svg='', plotBottom=o.plotTop+o.plotH;
  var iK=(o.isaretK>0)?o.isaretK:1;
  var hKey=o.hKey||'x';
  var yalin=!!(o.yalin||o.sade), sade=!!o.sade;
  var FS={ deger:_mnt2DFs('micro'), etiket:_mnt2DFs('micro'), eksen:_mnt2DFs('tiny'), g:_mnt2DFs('tiny'), baslik:_mnt2DFs('md') };
  var engel=[];   // sabit yazılar + işaretler — etiket yerleştiricinin kaçacağı kutular
  // HÂLE zeminin renginde: panelde dış kutunun dolgusu, yalın çizimde
  // (sihirbazın masası) masanın zemini. Izgara, referans ve kılavuz çizgileri
  // yazının altından geçiyordu (ölçüldü: masada 9, panelde 27 yazı).
  var HALE = yalin ? 'var(--bg-input)' : 'var(--bg-secondary)';
  function yaz(x, y, t, anchor, color, size, bold){
    engel.push(_mnt2DYaziKutu(x, y, t, anchor, size, bold));
    return _mnt2DText(x, y, t, anchor, color, size, bold, undefined, HALE);
  }
  function hval(p){ return hKey==='y'?p.y:(hKey==='z'?p.z:p.x); }
  function secAttr(tur, i){ return o.secim ? ' data-mnt-sec="'+tur+':'+i+'"' : ''; }
  function seciliMi(tur, i){ return !!(o.secili && o.secili.tur===tur && o.secili.i===i); }
  function halka(cx, cy, r){
    return '<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+_mnt2DR(r)+'" fill="none" stroke="var(--accent-primary)" stroke-width="2.2"/>';
  }
  // dış panel
  if(!yalin) svg+='<rect x="'+_mnt2DR(o.boxX)+'" y="'+_mnt2DR(o.boxY)+'" width="'+_mnt2DR(o.boxW)+'" height="'+_mnt2DR(o.boxH)+'" rx="8" fill="var(--bg-secondary)" stroke="var(--border-color)" stroke-width="1"/>';
  // ── ÖLÇEK IZGARASI — işaretlerin ALTINDA. Değer yazıları aşağıda, sabit
  // yazılardan SONRA: köşedeki eksen göstergesi (+X/+Y) ve not sol kenardaki
  // değer sütununa düşüyor; çarpan değer yazılmaz (çizgisi kalır). ──
  var gl=o.ox+o.plotL, gr=o.ox+o.FIG_W-o.plotR, degerler=[];
  // YATAY ADIM YAZIDAN: her ızgara çizgisinin değeri yazılır. Sabit sekiz
  // hedef dar çizimde (müfettiş sütunu, ~230 px'lik alan) 200 mm'lik adımla
  // "1.000"leri 26 px aralığa diziyordu; sağ uçtakiler eksen adına çarpıp
  // düşüyor, çizgisi değersiz kalıyordu. Hedef, en geniş değer + 8 px
  // sığana dek azalır — geniş çizimde (alan ≳ 360 px) sekiz kalır.
  function hTikler(){
    for(var t=8; t>2; t--){
      var tv=_mnt2DNiceTicks(o.hMin, o.hMax, t);
      if(tv.length<2) return tv;
      var gen=Math.max.apply(null, tv.map(function(v){ return String(_mnt2DTick(v)).length; }))*FS.deger*0.6;
      if(Math.abs(o.px(tv[1])-o.px(tv[0]))>=gen+8) return tv;
    }
    return _mnt2DNiceTicks(o.hMin, o.hMax, 2);
  }
  if(!sade && o.hMin!=null && o.hMax!=null){
    hTikler().forEach(function(tv){
      var gx=o.px(tv); if(gx<gl-0.5 || gx>gr+0.5) return;
      svg+='<line x1="'+_mnt2DR(gx)+'" y1="'+_mnt2DR(o.plotTop)+'" x2="'+_mnt2DR(gx)+'" y2="'+_mnt2DR(plotBottom)+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.4"/>';
      degerler.push([gx, plotBottom+FS.deger+4, _mnt2DTick(tv), 'middle']);
    });
  }
  if(!sade && o.vMin!=null && o.vMax!=null){
    _mnt2DNiceTicks(o.vMin, o.vMax, 5).forEach(function(tv){
      var gy=o.pyFn(tv); if(gy<o.plotTop-0.5 || gy>plotBottom+0.5) return;
      svg+='<line x1="'+_mnt2DR(gl)+'" y1="'+_mnt2DR(gy)+'" x2="'+_mnt2DR(gr)+'" y2="'+_mnt2DR(gy)+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.4"/>';
      degerler.push([gl-5, gy+FS.deger*0.35, _mnt2DTick(tv), 'end']);
    });
  }
  // başlık
  var baslikY=o.boxY+FS.baslik+8;
  if(!yalin) svg+=yaz(o.ox+o.plotL-2, baslikY, o.title, 'start', 'var(--text-heading)', FS.baslik, true);
  // kesikli referans çizgisi (Y=0 / Z=0)
  var ry=o.pyFn(o.refV);
  svg+='<line x1="'+_mnt2DR(yalin ? gl : o.ox+o.plotL-10)+'" y1="'+_mnt2DR(ry)+'" x2="'+_mnt2DR(o.ox+o.FIG_W-o.plotR)+'" y2="'+_mnt2DR(ry)+'" stroke="var(--border-color)" stroke-width="1.1" stroke-dasharray="5 4"/>';
  // Yalın çizimde (sihirbazın masası) yazı yok: çizginin sağ ucu takoz adlarının
  // yeriydi ve ikisi üst üste biniyordu; çizginin değeri eksenin "0" çentiği.
  // Referans yazısı ("Z = 0") işaretler çizildikten SONRA konur (aşağıda):
  // çizginin sağ ucuna sabitken uçtaki takozun karesi onun üstüne biniyordu.
  if(!yalin){
    // eksen köşe göstergesi (yatay + düşey eksen). Gösterge sol kenardaki
    // DEĞER SÜTUNUNA düşüyor; çarpan değer yazılmıyordu (yan ve önden
    // görünüşte en üst ızgaranın "500"ü). Yeri sütundan kaçar: ilk temiz
    // yükseklik seçilir, yoksa eski yer (çarpan değer yine düşer, çizgisi kalır).
    var up=(o.axis.vDir==='up'), axx=o.ox+22, hEt=(o.axis.hLabel||'+X');
    var gosterge=function(ay){
      var vy=(up? ay-28 : ay+28), vyY=(up? vy-4 : vy+FS.eksen+1);
      return { ay:ay, vy:vy, vyY:vyY, kutu:[
        _mnt2DYaziKutu(axx+30, ay+FS.eksen*0.36, hEt, 'start', FS.eksen, true),
        _mnt2DYaziKutu(axx-3, vyY, o.axis.vLabel, 'middle', FS.eksen, true),
        // Okların kendisi — L biçimi İKİ kutu: tek dikdörtgen L'nin boş
        // köşesini de kaplıyor ve oraya düşen değeri ("300") siliyordu.
        { l:axx-2, r:axx+28, t:ay-4, b:ay+4 },
        { l:axx-4, r:axx+4, t:Math.min(ay,vy)-2, b:Math.max(ay,vy)+2 } ] };
    };
    var degerKutu=degerler.map(function(d){ return _mnt2DYaziKutu(d[0], d[1], d[2], d[3], FS.deger, false); })
      // İşaretler de engel: Siper'in önden görünüşünde soldaki takozun karesi
      // "+Y"yi örtüyordu (kare göstergeden SONRA çiziliyor).
      .concat(_mnt2DIsaretKutulari(o, iK));
    var ilkY=(up? o.plotTop+44 : o.plotTop+14), G=gosterge(ilkY);
    for(var dy=0; dy<=80; dy+=2){
      var g=gosterge(ilkY+dy);
      if(Math.max(g.kutu[0].b, g.kutu[1].b, g.ay+4) > plotBottom-16) break;   // alt notun üstünde kalır
      if(!g.kutu.some(function(k){ return degerKutu.some(function(d){ return _mnt2DKesisir(k, d, 1); }); })){ G=g; break; }
    }
    svg+=_mnt2DArrow(axx,G.ay,axx+26,G.ay,'var(--text-secondary)')+yaz(axx+30,G.ay+FS.eksen*0.36,hEt,'start','var(--text-secondary)',FS.eksen,true);
    svg+=_mnt2DArrow(axx,G.ay,axx,G.vy,'var(--text-secondary)')+yaz(axx-3,G.vyY,o.axis.vLabel,'middle','var(--text-secondary)',FS.eksen,true);
    engel.push(G.kutu[2], G.kutu[3]);
    if(o.axis.note) svg+=yaz(o.ox+o.plotL-30, plotBottom-2, o.axis.note, 'start', 'var(--text-muted)', FS.deger);
  } else if(!sade){
    // Yalın kipte eksen ADI uçlarda: yatayın sağ ucunda, düşeyin tepesinde.
    // Değer satırının 2 px altında: 25'te kutusu değerlerinkine 0,2 px
    // yaklaşıyor ve altına düşen değer çarpışma sayılıp yazılmıyordu.
    svg+=yaz(gr, plotBottom+27, (o.axis.hLabel||'X')+' [mm]', 'end', 'var(--text-secondary)', FS.deger, true);
    svg+=yaz(gl-5, o.plotTop-8, (o.axis.vLabel||'Y')+' [mm]', 'end', 'var(--text-secondary)', FS.deger, true);
  }
  var sabit=engel.slice();
  degerler.forEach(function(d){
    var k=_mnt2DYaziKutu(d[0], d[1], d[2], d[3], FS.deger, false);
    if(sabit.some(function(e){ return _mnt2DKesisir(k, e, 1); })) return;
    svg+=yaz(d[0], d[1], d[2], d[3], 'var(--text-muted)', FS.deger);
  });
  var leftX=o.ox+o.plotL, rightX=o.ox+o.FIG_W-o.plotR, items=[];
  // ── İŞARETLER ── (etiketler ayrı geçişte, çakışma önleyici yerleştirilir)
  // takozlar — HER takoz GERÇEK izdüşüm konumunda çizilir (koordinat düzlemine
  // sadık; konum birleştirme yok). Yalnızca ~işaret boyutu kadar BİREBİR üst üste
  // binen işaretler (aynı piksele düşen sol/sağ çiftleri: yandan X–Z ve önden Y–Z
  // görünüşlerinde) görünürlük için hafifçe yatay yelpazelenir. Her takoz tek tek
  // etiketlenir; çakışan etiketler yerleştiricide çözülür.
  // GÖVDENİN ÇERÇEVESİ (kullanıcı 2026-11-09, Canlı Not 79: *"Üstten-Yandan-Önden görünüşlerde
  // en azından komponentlerin bir çerçevesi çıksın … Sanki 3B'ya yandan üstten bakıyormuş gibi
  // olsun"*): eşdeğer kutunun izdüşümü (3B'nin kutusu), işaretlerin ALTINDA; tıklanınca gövdeyi
  // seçer, seçiliyken kenarı vurgu. Kutusuz gövde (nokta kütle) yalnız dairesiyle.
  var EKS={ x:0, y:1, z:2 }, kh=EKS[hKey], kv=EKS[o.vKey||'z'];
  o.comps.forEach(function(c, ci){
    if(!c.kutu) return;
    var cv=(o.vKey==='y'?c.y:c.z), x0=o.px(hval(c)-c.kutu[kh]/2), x1=o.px(hval(c)+c.kutu[kh]/2);
    var y0=o.pyFn(cv+c.kutu[kv]/2), y1=o.pyFn(cv-c.kutu[kv]/2), sec=seciliMi('govde', ci);
    svg+='<g class="ve-mnt2d-kutu"'+secAttr('govde', ci)+'><rect x="'+_mnt2DR(Math.min(x0, x1))+'" y="'+_mnt2DR(Math.min(y0, y1))+'"'
      + ' width="'+_mnt2DR(Math.abs(x1-x0))+'" height="'+_mnt2DR(Math.abs(y1-y0))+'" fill="var(--text-muted)" fill-opacity="0.07"'
      + ' stroke="'+(sec ? 'var(--accent-primary)' : 'var(--text-secondary)')+'" stroke-width="'+(sec ? 1.6 : 1)+'"/></g>';
  });
  var mpts=o.mounts.map(function(m, mi){ var mv=(o.vKey==='y'?m.y:m.z); return {m:m, mi:mi, v:mv, cx:o.px(hval(m)), cy:o.pyFn(mv)}; });
  var COIN=12;   // px — bu yarıçapta üst üste binenler yelpazelenir (konum aldatmacası değil)
  mpts.forEach(function(a,i){ if(a._grp) return; var grp=[a]; a._grp=1;
    mpts.forEach(function(b,j){ if(j<=i || b._grp) return;
      if(Math.abs(a.cx-b.cx)<COIN && Math.abs(a.cy-b.cy)<COIN){ grp.push(b); b._grp=1; } });
    var n=grp.length;
    grp.forEach(function(pt,k){
      var mx=pt.cx+(n>1?(k-(n-1)/2)*19:0), my=pt.cy;
      var info=['Takoz — '+(pt.m.name||'Takoz'), 'Konum  ('+veSayi(_mnt2DR(pt.m.x))+'; '+veSayi(_mnt2DR(pt.m.y))+'; '+veSayi(_mnt2DR(pt.m.z))+') mm'];
      var sec=seciliMi('takoz', pt.mi), mR=(sec ? 13 : 9)*iK;
      if(sec) svg+=halka(mx, my, 13*iK);
      svg+='<g'+_mnt2DInfoAttr(info)+secAttr('takoz', pt.mi)+'>'+_mnt2DMountMark(mx, my, o.vKey==='z', _MNT2D_C_MOUNT, iK===1?undefined:8*iK)+'</g>';
      engel.push({ l:mx-mR, r:mx+mR, t:my-mR, b:my+mR });
      if(!sade) items.push({cx:mx, cy:my, mr:mR, above:(pt.v>=o.refV), text:o.mountLabelFn(pt.m), color:'var(--text-secondary)', size:FS.etiket, bold:false});
    });
  });
  // bileşen CG (içi boş daire, kütleye göre boyut)
  o.comps.forEach(function(c, ci){ var cv=(o.vKey==='y'?c.y:c.z), cx=o.px(hval(c)), cy=o.pyFn(cv), r=o.cr(c.mass);
    var info=[c.name||'Bileşen', 'CG  ('+veSayi(_mnt2DR(c.x))+'; '+veSayi(_mnt2DR(c.y))+'; '+veSayi(_mnt2DR(c.z))+') mm'];
    if(c.mass>0) info.push('Kütle  '+veSayi(c.mass, 1)+' kg');
    var sec=seciliMi('govde', ci), rR=sec ? r+5 : r;
    if(sec) svg+=halka(cx, cy, r+5);
    svg+='<g'+_mnt2DInfoAttr(info)+secAttr('govde', ci)+'>';
    svg+='<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+_mnt2DR(r)+'" fill="var(--bg-primary)" stroke="'+_MNT2D_C_COMP+'" stroke-width="1.5"/></g>';
    engel.push({ l:cx-rR, r:cx+rR, t:cy-rR, b:cy+rR });
    if(!sade) items.push({cx:cx, cy:cy, mr:rR, above:o.compAbove, text:o.compLabelFn(c), color:'var(--text-secondary)', size:FS.etiket, bold:false});
  });
  // birleşik CG (jeodezik sembol)
  if(o.cg){ var gx=o.px(hval(o.cg)), gy=o.pyFn(o.vKey==='y'?o.cg.y:o.cg.z);
    var cgInfo=['Birleşik CG', 'Konum  ('+veSayi(_mnt2DR(o.cg.x))+'; '+veSayi(_mnt2DR(o.cg.y))+'; '+veSayi(_mnt2DR(o.cg.z))+') mm'];
    if(o.cg.m>0) cgInfo.push('Toplam kütle  '+veSayi(o.cg.m, 1)+' kg');
    svg+='<g'+_mnt2DInfoAttr(cgInfo)+'>'+_mnt2DCGMark(gx,gy,10*iK,_MNT2D_C_CG);
    svg+='<circle cx="'+_mnt2DR(gx)+'" cy="'+_mnt2DR(gy)+'" r="'+_mnt2DR(12*iK)+'" fill="transparent"/></g>';
    engel.push({ l:gx-11*iK, r:gx+11*iK, t:gy-11*iK, b:gy+11*iK });
    if(!sade) items.push({cx:gx, cy:gy, mr:11*iK, above:o.compAbove, text:o.cgLabelFn(o.cg), color:'var(--text-primary)', size:FS.g, bold:true});
  }
  // Referans yazısı: çizginin sağ ucu (üst · alt), sonra sol ucu — işarete ve
  // sabit yazıya binmeyen ilk yer; hiçbiri boş değilse eski yer.
  if(o.refLabel && !yalin){
    var refAday=[[gr, ry-5, 'end'], [gr, ry+FS.deger+3, 'end'], [gl+4, ry-5, 'start'], [gl+4, ry+FS.deger+3, 'start']];
    var refSec=refAday[0];
    for(var ri=0; ri<refAday.length; ri++){
      var rk=_mnt2DYaziKutu(refAday[ri][0], refAday[ri][1], o.refLabel, refAday[ri][2], FS.deger, false);
      if(!engel.some(function(e){ return _mnt2DKesisir(rk, e, 1); })){ refSec=refAday[ri]; break; }
    }
    svg+=yaz(refSec[0], refSec[1], o.refLabel, refSec[2], 'var(--text-muted)', FS.deger);
  }
  // ── ETİKETLER ── (sabit yazılara ve birbirine çarpmadan; kutunun içinde)
  if(!sade) svg+=_mnt2DLabels(items, { l:leftX, r:rightX, t:(yalin ? o.boxY+2 : baslikY+6), b:o.boxY+o.boxH-3 }, engel, HALE);
  return svg;
}

// ── TEK GÖRÜNÜŞ, VERİLEN ÖLÇÜDE, GERÇEK ORANDA ─────────────────────────────
// Düz görünüşün işaret dili (_mnt2DFigure) iki kipte: küçük resim (`sade` —
// yalnız işaretler) ve sihirbazın çizim masası (`yalin` — eksen değerli,
// etiketli). Eski panelin üç figürü her ekseni AYRI
// ölçekler (figür yüksekliğini doldurur); burada iki eksen TEK ölçekte —
// küçük resim "bu güç grubu neye benziyor", masa "takoz nerede" sorusunu
// cevaplar ve çarpıtılmış bir oranla ikisi de yanlış cevap verirdi.
//   veri: _mnt2DGather biçimi {comps, mounts, cg}
//   opt : {gorunus:'ust'|'yan'|'on', sade, pay:{sol,sag,ust,alt}, secili, secim}
// Döner: '<svg …>' ya da gösterilecek işaret yoksa ''.
var VE_MNT2D_GORUNUS = {
  ust: { h:'x', v:'y', hLabel:'X', vLabel:'Y', refLabel:'Y = 0', ad:'Üstten' },
  yan: { h:'x', v:'z', hLabel:'X', vLabel:'Z', refLabel:'Z = 0', ad:'Yandan' },
  on:  { h:'y', v:'z', hLabel:'Y', vLabel:'Z', refLabel:'Z = 0', ad:'Önden' }
};
function veMnt2DGorunusSVG(veri, W, H, opt){
  opt=opt||{}; W=W||330; H=H||150;
  var G=VE_MNT2D_GORUNUS[opt.gorunus]||VE_MNT2D_GORUNUS.ust;
  var sade=!!opt.sade;
  var pay=opt.pay || (sade ? {sol:20, sag:20, ust:20, alt:20} : {sol:56, sag:30, ust:34, alt:36});
  var comps=(veri&&veri.comps)||[], mounts=(veri&&veri.mounts)||[], cg=(veri&&veri.cg)||null;
  if(!comps.length && !mounts.length) return '';
  var hs=[], vs=[0];                          // referans çizgisi (v = 0) görünür kalsın
  function ekle(p){ hs.push(p[G.h]); vs.push(p[G.v]); }
  mounts.forEach(ekle); comps.forEach(ekle); if(cg) ekle(cg);
  // gövdenin çerçevesi de alanın içinde (Canlı Not 79)
  var EKS={ x:0, y:1, z:2 };
  comps.forEach(function(c){ if(!c.kutu) return;
    var wh=c.kutu[EKS[G.h]]/2, wv=c.kutu[EKS[G.v]]/2;
    hs.push(c[G.h]-wh, c[G.h]+wh); vs.push(c[G.v]-wv, c[G.v]+wv); });
  var hMin=Math.min.apply(null,hs), hMax=Math.max.apply(null,hs);
  var vMin=Math.min.apply(null,vs), vMax=Math.max.apply(null,vs);
  var hR=Math.max(hMax-hMin,1), vR=Math.max(vMax-vMin,1);
  // İŞARETLER İÇİN İÇ PAY: uçtaki işaret çizim alanının tam kenarına düşüp
  // eksen değer sütununa taşıyordu (masada takozun karesi y ekseninin "0"ını
  // örtüyordu — ölçüldü). Eski panelin yatay payıyla aynı gerekçe; en büyük
  // işaret (seçili gövdenin halkası) kadar.
  var IC = sade ? 0 : 20*((opt.isaretK>0) ? opt.isaretK : 1);
  var UW=Math.max(W-pay.sol-pay.sag,10), UH=Math.max(H-pay.ust-pay.alt,10);
  var uw=Math.max(UW-2*IC,10), uh=Math.max(UH-2*IC,10);
  var s=Math.min(uw/hR, uh/vR);
  var ox=pay.sol+IC+(uw-hR*s)/2, oy=pay.ust+IC+(uh-vR*s)/2;
  function px(h){ return ox+(h-hMin)*s; }
  function py(v){ return oy+(vMax-v)*s; }
  var ms=comps.map(function(c){return c.mass;}).filter(function(m){return m>0;});
  var mMin=ms.length?Math.min.apply(null,ms):0, mMax=ms.length?Math.max.apply(null,ms):1;
  // KÜÇÜK RESİMDE İŞARET BÜYÜK: karo çizimi ~0,7 kat küçültür ve 8 birimlik
  // takoz karesi 5 px'e iniyordu — karenin sorusu "nerede ne var".
  var iK = (opt.isaretK>0) ? opt.isaretK : (sade ? 1.45 : 1);
  function cr(m){ if(!(m>0)) return 7*iK; var t=(mMax-mMin>1e-9)?(m-mMin)/(mMax-mMin):0.5; return (7+7*Math.sqrt(t))*iK; }
  function kisa(n){ n=String(n||''); return n.length>18?n.slice(0,17)+'…':n; }
  var inner=_mnt2DFigure({ isaretK:iK, ox:0, boxX:0, boxY:0, boxW:W, boxH:H, FIG_W:W,
    plotTop:pay.ust, plotH:UH, plotL:pay.sol, plotR:pay.sag, px:px, pyFn:py, hKey:G.h, vKey:G.v,
    // Izgara görünen ALANI kaplar, verinin aralığını değil (tek ölçekte bir
    // eksen veriden geniş kalır).
    hMin:hMin-(ox-pay.sol)/s, hMax:hMin-(ox-pay.sol)/s+UW/s,
    vMin:vMax+(oy-pay.ust)/s-UH/s, vMax:vMax+(oy-pay.ust)/s,
    mounts:mounts, comps:comps, cg:cg, cr:cr, compAbove:true, refV:0, refLabel:G.refLabel,
    axis:{hLabel:G.hLabel, vLabel:G.vLabel}, yalin:true, sade:sade,
    secili:opt.secili||null, secim:!!opt.secim,
    // Etiket: ad (masa, küçük resim) ya da çağıranın verdiği (govdeEtiket ·
    // takozEtiket).
    compLabelFn:opt.govdeEtiket || function(c){ return kisa(c.name); },
    mountLabelFn:opt.takozEtiket || function(m){ return kisa(m.name||'Takoz'); },
    cgLabelFn:function(){ return 'G'; } });
  return '<svg class="ve-mnt2d-gorunus" viewBox="0 0 '+W+' '+H+'"'
    + ' preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+G.ad+' görünüş"'
    + ' style="font-family:'+_MNT2D_YUZ+';">'+inner+'</svg>';
}

// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ ÖZELLİKLERİ PANELİ (kullanıcı tanımlı takoz kataloğu — ekle/çıkar/gör)
// ════════════════════════════════════════════════════════════════════════════
// mnt-library düğümü fiziksel topolojiye bağlanmaz; yalnızca kütüphaneyi
// genişletir. Kullanıcı takozları node.data.mounts içinde tutulur (proje
// kaydet/yükle otomatik). Buradaki her girdi tüm Takoz panellerinin "Kütüphaneden
// yükle" listesinde "Özel" grubunda görünür. Gömülü katalog salt-okunur gösterilir.
function _mntLibEnsure(node){
  if(!node.data) node.data={};
  if(!Array.isArray(node.data.mounts)) node.data.mounts=[];
  return node.data;
}
// Kütüphane girdisinin FÖY HÜCRESİ. Yazıcı `veMntLibSet` (özel girdi) ya da
// `veMntLibSetBuiltin` (gömülü: alan bazında override; fabrika sabiti
// değişmez). Kimlik `ve-mnt-lib-<alan>-<düğüm>` — pencerede tek girdi seçili.
// Çözücü üç eksenin hepsinde statik ve dinamik rijitliğin > 0 olmasını ister
// (validateModel); sıfır/boş hücre `zor` tonunu taşır.
function _mntLibFoyGir(node, e, field, aria, setter, opt){
  opt=opt||{};
  var v=(e[field]===undefined||e[field]===null)?'':e[field];
  var zor=!!opt.zorunlu && !(_mntNum(v,0)>0);
  var tah=_mntLibTahmin(e).indexOf(field)>=0;
  return '<td class="gir'+(zor?' zor':'')+(tah?' tah':'')+'"'+(tah?' title="Tahmini · '+_mntEsc(_mntLibTahminKunye(e))+'"':'')
    + '><input type="text" inputmode="decimal" id="ve-mnt-lib-'+field+'-'+node.id+'"'
    + ' value="'+_mntEsc(v)+'" aria-label="'+_mntEsc(aria)+(tah?' · tahmini':'')+'"'+(opt.zorunlu?' data-zorunlu':'')
    + ' onchange="'+setter+'(\''+node.id+'\',\''+_mntEsc(e.key)+'\',\''+field+'\',this.value)"></td>';
}
// ─── Grafik/detay yardımcıları (master-detay interaktif panel) ───────────────
// [[δ,f],…] noktaları arasında lineer interpolasyon/klips (2 nokta veya spline yoksa).
function _mntLinInterp(pts, x){
  var n=pts.length;
  if(x<=pts[0][0]) return pts[0][1];
  if(x>=pts[n-1][0]) return pts[n-1][1];
  for(var i=0;i<n-1;i++){
    if(x<=pts[i+1][0]){
      var dx=(pts[i+1][0]-pts[i][0])||1, t=(x-pts[i][0])/dx;
      return pts[i][1]+t*(pts[i+1][1]-pts[i][1]);
    }
  }
  return pts[n-1][1];
}
// Satırın kz özeti: değer yoksa tire (DSM gibi eğrisi doğrusal olmayan tipte kz yok).
function _mntLibKz(e){ var v=_mntNum(e.sz, 0); return 'kz '+(v>0 ? veSayi(v, 0) : '—'); }
// Bir girdi herhangi bir eksende nonlineer yasa (analitik fit VEYA nokta eğrisi) taşıyor mu?
function _mntEntryHasLaw(e){
  return ['fitX','fitY','fitZ'].some(function(f){ return !!e[f]; })
      || ['curveX','curveY','curveZ'].some(function(f){ return Array.isArray(e[f])&&e[f].length>=2; });
}
// Arama için ad/anahtar normalleştirme: Türkçe harf katlaması + küçük harf.
// 'İ'/'I' önce eşlenir — JS toLowerCase('İ') birleşik nokta üretir ve eşleşmeyi
// bozar. Böylece "sasi" → "şasi", "TK035" → "tk035" aramaları tutar.
function _mntLibNorm(s){
  return String(s==null?'':s)
    .replace(/İ/g,'i').replace(/I/g,'ı')
    .toLowerCase()
    .replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g')
    .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c');
}
// Açılır listede tek tıklanabilir takoz satırı: ad + kz; seçili satır zeminle ve
// kalın adla. Satırın başında tür noktası, sonunda eğri ve seçim işareti YOK
// (Canlı Not 122: *"Baştaki mavi butonlara … sağ kısımdaki kırmızı ve mavi
// tike de ne gerek var"*). data-search: filtrelemenin okuduğu normalleştirilmiş
// "ad + anahtar" metni.
function _mntLibOptionRow(node, e, sel){
  var isSel=!!sel && e.key===sel.key;
  var h='<div class="mntlib-opt'+(isSel?' sel':'')+'" role="option" aria-selected="'+(isSel?'true':'false')+'"'
    +' data-search="'+_mntEsc(_mntLibNorm(e.name+' '+e.key))+'"'
    +' onclick="veMntLibSelect(\''+node.id+'\',\''+_mntEsc(e.key)+'\')">';
  h+='<span class="mntlib-opt-name" title="'+_mntEsc(e.name)+'">'+_mntEsc(e.name)+'</span>';
  h+='<span class="mntlib-kz">'+_mntLibKz(e)+'</span>';
  h+='</div>';
  return h;
}
// Kapalı hâldeki seçici: seçili takozun adı ve kz'si + ▾ (Canlı Not 122: işaretsiz).
function _mntLibTrigger(node, sel){
  var h='<button type="button" class="mntlib-trigger" id="mntlib-tr-'+node.id+'"'
    +' aria-haspopup="listbox" aria-expanded="false" title="Takoz listesini aç"'
    +' onclick="veMntLibDropdownToggle(\''+node.id+'\',event)">';
  if(sel){
    h+='<span class="mntlib-trigger-name" title="'+_mntEsc(sel.name)+'">'+_mntEsc(sel.name)+'</span>';
    h+='<span class="mntlib-kz">'+_mntLibKz(sel)+'</span>';
  } else {
    h+='<span class="mntlib-trigger-name empty">Takoz seçilmedi</span>';
  }
  h+=veIkon('chevron-down', 'mntlib-caret')+'</button>';
  return h;
}
// Açılır liste gövdesi: arama kutusu + SEÇİLİ MARKANIN satırları (Canlı Not 106:
// marka Marka listesinde seçilir, bu liste onun tiplerini sorar — grup başlığı ve
// sayaç markayı ikinci kez söylerdi). Gizli olarak basılır; veMntLibDropdownToggle
// yalnız hidden'ı kaldırır.
function _mntLibDropdown(node, girdiler, sel){
  var h='<div class="mntlib-dd" id="mntlib-dd-'+node.id+'" role="listbox" hidden>';
  h+='<input type="text" class="mntlib-search" id="mntlib-q-'+node.id+'" placeholder="Takoz ara… (ad ya da kod)"'
    +' autocomplete="off" oninput="veMntLibFilter(\''+node.id+'\')"'
    +' onkeydown="veMntLibSearchKey(event,\''+node.id+'\')">';
  h+='<div class="mntlib-list" id="mntlib-list-'+node.id+'">';
  girdiler.forEach(function(e){ h+=_mntLibOptionRow(node, e, sel); });
  h+='<div class="mntlib-empty" id="mntlib-none-'+node.id+'" hidden>Eşleşen takoz yok.</div>';
  h+='</div></div>';
  return h;
}
// SEÇİCİ — Marka listesi, onun altında seçili markanın tipleri ve Yeni takoz
// (Canlı Not 105: sıkı iki satır; 106: önce marka, sonra o markanın tipleri).
// Tipin teknik resmi varsa Tip satırının sonunda (i) düğmesi (Canlı Not 111).
function _mntLibSecici(node, markalar, grup, sel){
  var mk='<select class="ve-fp-sel mntlib-marka" id="mntlib-marka-'+node.id+'" aria-label="Marka"'
    +' onchange="veMntLibMarka(\''+node.id+'\',this.value)">'
    + markalar.map(function(g){
        return '<option value="'+_mntEsc(g.ad)+'"'+((grup && g.ad===grup.ad)?' selected':'')+'>'+_mntEsc(g.ad)+'</option>';
      }).join('')+'</select>';
  return '<div class="mntlib-sec">'
    + '<span class="mntlib-et">Marka</span>'+mk
    + '<span class="mntlib-et">Tip</span>'
    + '<div class="mntlib-tip"><div class="mntlib-picker">'+_mntLibTrigger(node, sel)+_mntLibDropdown(node, grup?grup.girdiler:[], sel)+'</div>'
    + _mntLibCizimDugme(node, sel)+'</div>'
    + '<button type="button" class="mntlib-add" onclick="veMntLibAdd(\''+node.id+'\')">'+veIkon('plus')+' Yeni takoz</button>'
    + '</div>';
}
// Kütüphane girdisinin eksenleri — takozun KENDİ eksenleri (radyal/eksenel);
// uygulanınca takozun kxs…kzd alanlarına aynı sırayla kopyalanır.
var _MNT_LIB_EKS = [['x','kx','radyal'], ['y','ky','radyal'], ['z','kz','eksenel']];
// Girdiyi takoz alanlarına çevir — oran yayılımı Takoz penceresinin AYNI
// denetiminden (_mntOranYayilim) geçsin.
function _mntLibTakozAlan(e){
  return { kxs:e.sx, kys:e.sy, kzs:e.sz, kxd:e.dx, kyd:e.dy, kzd:e.dz };
}
// RİJİTLİK — Takoz penceresinin föyüyle aynı: statik ve dinamik aynı
// satırda, oran türetilir, altında eksenler arası oran yayılımı kapısı.
function _mntLibRijitlikHTML(node, e, setter){
  var f=_mntFoyAc([{ b:'Eksen', gen:'31%' }, { b:'Statik', gen:'23%' }, { b:'Dinamik', gen:'23%' },
                   { b:'Din./stat.', gen:'23%', sinif:'cz ay' }], 'Rijitlik');
  _MNT_LIB_EKS.forEach(function(a){
    var st=_mntNum(e['s'+a[0]],NaN), dn=_mntNum(e['d'+a[0]],NaN);
    f+='<tr><td>'+a[1]+' <span class="sf">'+a[2]+'</span></td>'
      + _mntLibFoyGir(node, e, 's'+a[0], 'Statik '+a[1]+' [N/mm]', setter, { zorunlu:true })
      + _mntLibFoyGir(node, e, 'd'+a[0], 'Dinamik '+a[1]+' [N/mm]', setter, { zorunlu:true })
      + _mntFoyCoz((st>0 && dn>0) ? _mntS(dn/st,2) : '—', { ay:true, id:'ve-mnt-lib-or'+a[0]+'-'+node.id })+'</tr>';
  });
  var O=_mntOranYayilim(_mntLibTakozAlan(e)), sinir=_mntS(_MNT_ORAN_YAYILIM_SINIR,1);
  var kapi='<div class="ve-fp-gate ve-mnt-ic" data-d="'+(O ? (O.yayilim>_MNT_ORAN_YAYILIM_SINIR ? 'warn' : 'ok') : 'wait')+'"'
    + ' id="ve-mnt-lib-yay-'+node.id+'" data-tazele title="'+_mntEsc(O
        ? 'Din./stat. oranı yayılımı '+_mntS(O.yayilim,2)+' · sınır '+sinir
        : 'Altı rijitlik eksik')+'">'
    + '<i></i>Eksenler arası oran yayılımı<span>'+(O ? _mntS(O.yayilim,2)+' · sınır '+sinir : '—')+'</span></div>';
  // Tahmini değer (Canlı Not 113): üreticinin yayımlamadığı eksen ya da dinamik — değer girilince satır düşer.
  if(_mntLibTahmin(e).length) kapi+='<div class="ve-fp-gate ve-mnt-ic" data-d="warn" id="ve-mnt-lib-tah-'+node.id+'">'
    + '<i></i>'+_mntLibTahminAdi(e)
    + '<span>'+_mntEsc(_mntLibTahminKunye(e))+'</span></div>';
  // Künye tipin adı: uzun ad (A+P) sütunda kesilir, tamamı ipucunda (yerleşim kapısı)
  return _mntBolum('Rijitlik', '[N/mm] · '+_mntEsc(e.name), f+_MNT_FOY_KAPA+kapi, { emTam:'[N/mm] · '+e.name });
}
// Grafiğin göstergesi — çizilen eksen grupları (renk), statik (düz), dinamik
// (kesikli) ve ölçüm noktaları. Örnek çizgiler SVG özniteliğiyle, yazı rengi CSS'ten.
function _mntLibLejant(G){
  function sw(inner){ return '<svg class="ve-mnt-lej-cizgi" viewBox="0 0 16 9" aria-hidden="true">'+inner+'</svg>'; }
  function cizgi(renk, kalin, kesik){
    return '<line x1="1" y1="4.5" x2="15" y2="4.5" stroke="'+renk+'" stroke-width="'+kalin+'"'+(kesik?' stroke-dasharray="4 2.5"':'')+'/>';
  }
  return '<div class="ve-mnt-kroki-lej">'
    + G.gruplar.map(function(g){ return '<span>'+sw(cizgi(g.renk, 2))+g.ad+'</span>'; }).join('')
    + '<span>'+sw(cizgi('var(--text-secondary)', 2))+'statik</span>'
    + '<span>'+sw(cizgi('var(--text-secondary)', 1.4, true))+'dinamik</span>'
    + (G.nokta ? '<span>'+sw('<circle cx="8" cy="4.5" r="2.6" fill="var(--bg-primary)" stroke="var(--text-secondary)" stroke-width="1.3"/>')+'ölçüm noktası</span>' : '')
    + '</div>';
}
// Analitik fit değerlendiricisi (x: sehim mm → kuvvet N) — çekirdek makeAxisLaw ile
// AYNI matematik (yalnız panel çizimi için). 'poly': k0·x+c3·x³+c5·x⁵; 'asym' parçalı.
function _mntFitForce(fit, x){
  if(!fit) return 0;
  if(fit.form==='asym'){
    var cp=fit.comp||{}, ex=fit.ext||{}, xmax=(cp.xmax>0?cp.xmax:1), EPS=0.02;
    if(x>=0) return _mntNum(ex.k0)*x + _mntNum(ex.c3)*x*x*x;    // geri-gelme (δ≥0, kübik)
    var u=1+x/xmax; if(u<EPS) u=EPS;                            // basma (δ<0, rasyonel, asimptot −xmax)
    return _mntNum(cp.k0)*x/u;
  }
  return _mntNum(fit.k0)*x + _mntNum(fit.c3)*x*x*x + _mntNum(fit.c5)*x*x*x*x*x;
}
// Fit için çizim aralığı [dmin,dmax] mm — |F|≈17 kN'a ulaştığı yer (eksenelde
// asimptota çok yaklaşmadan xmax·0.985'te durur). Grafik ölçeğini otomatik verir.
function _mntFitDomain(fit){
  var TARGET=17000;
  function reach(dir){ var last=0; for(var i=1;i<=160;i++){ var x=dir*0.25*i; if(Math.abs(_mntFitForce(fit,x))>=TARGET) return x; last=x; } return last; }
  if(fit && fit.form==='asym'){
    var xmax=(fit.comp&&fit.comp.xmax>0)?fit.comp.xmax:5;   // asimptot basma (δ<0) tarafında
    return [Math.max(reach(-1)||(-xmax*0.985), -xmax*0.985), reach(1)||15];
  }
  var h=reach(1)||15;
  return [-h, h];
}
// Eksenlerin renkleri — 3B'nin ve Görünümler'in eksen işaretinin dili: x kırmızı ·
// y yeşil · z mavi (Canlı Not 108).
var _MNT_LIB_EKS_RENK = { x:'var(--accent-danger)', y:'var(--accent-success)', z:'var(--accent-primary)' };
// Bir eksenin çizim verisi: statik yasa (analitik fit, PCHIP nokta eğrisi ya da
// lineer k_s·δ), dinamik eğim (k_d·δ), kendi çizim aralığı (lineerde yok: ortak).
function _mntLibEksenVeri(e, axis){
  var A=axis.toUpperCase();
  var sz=_mntNum(e['s'+axis]), dz=_mntNum(e['d'+axis]);
  var fit=e['fit'+A]||null, rawc=e['curve'+A];
  var raw=(!fit && Array.isArray(rawc) && rawc.length>=2)?rawc:null;
  var pts=raw?raw.map(function(p){ return [_mntNum(p[0]), _mntNum(p[1])]; }).sort(function(a,b){ return a[0]-b[0]; }):null;
  var dom=null;
  if(fit) dom=_mntFitDomain(fit);
  else if(pts) dom=[pts[0][0], pts[pts.length-1][0]];
  var spline=null;
  if(!fit && pts && pts.length>=3 && typeof veBuildPchipSpline==='function'){
    try{ spline=veBuildPchipSpline(pts.map(function(p){ return {rpm:p[0], torque:p[1]}; })); }catch(_e){ spline=null; }
  }
  function f(x){
    var v;
    if(fit) v=_mntFitForce(fit, x);
    else if(!pts) v=sz*x;
    else if(spline && typeof veEvalPchip==='function') v=veEvalPchip(spline, x);
    else v=_mntLinInterp(pts, x);
    return isFinite(v)?v:0;
  }
  return { axis:axis, sz:sz, dz:dz, fit:fit, pts:pts, dom:dom, f:f, egri:!!(fit||pts),
           imza:JSON.stringify([sz, dz, fit, pts]) };
}
// Kuvvet–sehim GRAFİĞİ: üç eksenin statik yasası (kalın) ve dinamik referans eğimi
// (kesikli) AYNI diyagramda (kullanıcı 2026-11-10, Canlı Not 108: *"X, Y, Z
// değerlerini aynı diyagram üzerinden verelim"*). Aynı eğriyi çizen eksenler
// (k_x = k_y gibi) TEK çizgi ve tek künyedir ("x · y radyal") — üst üste binip
// birini gizlemez. `axis` verilirse yalnız o eksen çizilir. ÇİZİM EKRANDA BİREBİR
// (Canlı Not 104: *"Diyagram büyük çok … yazı tipleri de büyük, tutarlı olsun"*):
// 340 birimlik çizim 340 px'te durur, yazı --fs-micro; eskiden 300 birim sütuna
// gerilip yazıyı %20 büyütüyordu ve yükseklik 212'ydi, şimdi 172.
function _mntLibGrafik(e, axis){
  var ev=(axis ? [axis] : ['x','y','z']).map(function(a){ return _mntLibEksenVeri(e, a); })
    .filter(function(v){ return v.sz>0 || v.dz>0 || v.egri; });
  if(!ev.length) ev=[_mntLibEksenVeri(e, axis||'z')];
  var dmin=Infinity, dmax=-Infinity;
  ev.forEach(function(v){ if(v.dom){ dmin=Math.min(dmin, v.dom[0]); dmax=Math.max(dmax, v.dom[1]); } });
  if(!isFinite(dmin)){ dmin=-15; dmax=15; }
  if(!(dmax>dmin)){ dmin-=1; dmax+=1; }
  var gruplar=[];
  ev.forEach(function(v){
    var g=gruplar.filter(function(x){ return x.imza===v.imza; })[0];
    if(g) g.eksenler.push(v.axis); else gruplar.push({ imza:v.imza, v:v, eksenler:[v.axis] });
  });
  var TUR={ x:'radyal', y:'radyal', z:'eksenel' };
  // Örnekle — her grup kendi aralığında (lineer: ortak aralık)
  var N=64, allF=[0];
  gruplar.forEach(function(g){
    var v=g.v, lo=v.dom?v.dom[0]:dmin, hi=v.dom?v.dom[1]:dmax;
    g.stat=[]; g.dyn=[];
    for(var i=0;i<=N;i++){
      var x=lo+(hi-lo)*i/N, fs=v.f(x), fd=v.dz*x;
      g.stat.push([x,fs]); g.dyn.push([x,fd]); allF.push(fs); allF.push(fd);
    }
    if(v.pts) v.pts.forEach(function(p){ allF.push(p[1]); });
    g.renk=_MNT_LIB_EKS_RENK[g.eksenler[0]];
    var tur=[]; g.eksenler.forEach(function(a){ if(tur.indexOf(TUR[a])<0) tur.push(TUR[a]); });
    g.ad=g.eksenler.join(' · ')+(tur.length===1 ? ' '+tur[0] : '');
  });
  var fmin=Math.min.apply(null, allF), fmax=Math.max.apply(null, allF);
  if(!(fmax>fmin)){ fmin-=1; fmax+=1; }
  var fpad=(fmax-fmin)*0.10; fmin-=fpad; fmax+=fpad;
  // Geometri — yazı ölçeğin tabanında (veThemeFs('micro')), ekranda 1:1.
  var W=340, H=172, plotL=40, plotR=332, plotT=8, plotB=138;
  function px(xx){ return plotL+(xx-dmin)/(dmax-dmin)*(plotR-plotL); }
  function py(ff){ return plotB-(ff-fmin)/(fmax-fmin)*(plotB-plotT); }
  var fs=_mnt2DFs('micro');
  var s='<svg class="ve-mnt-lib-svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Kuvvet–sehim eğrileri"'
    + ' style="display:block; font-family:'+_MNT2D_YUZ+';">';
  s+='<rect x="'+plotL+'" y="'+plotT+'" width="'+(plotR-plotL)+'" height="'+(plotB-plotT)+'" fill="var(--bg-input)" opacity="0.3"/>';
  var xticks=_mnt2DNiceTicks(dmin,dmax,5), yticks=_mnt2DNiceTicks(fmin,fmax,4);
  xticks.forEach(function(tv){ var gx=px(tv); if(gx<plotL-0.5||gx>plotR+0.5) return;
    s+='<line x1="'+_mnt2DR(gx)+'" y1="'+plotT+'" x2="'+_mnt2DR(gx)+'" y2="'+plotB+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.35"/>';
    s+=_mnt2DText(gx, plotB+12, _mnt2DTick(tv), 'middle', 'var(--text-muted)', fs);
  });
  // BİRİM EKSENİN BAŞLIĞINDA, DEĞERDE SONEK YOK: kuvvet bin newtonu aşınca
  // eksen kN'dir ("10k" yazılıyordu, başlık [N] derken). Ondalık adımdan.
  var kN=Math.max(Math.abs(fmin), Math.abs(fmax))>=1000;
  var fAdim=yticks.length>1 ? Math.abs(yticks[1]-yticks[0])/(kN?1000:1) : 1;
  var fBas=fAdim>=1 ? 0 : (fAdim>=0.1 ? 1 : 2);
  yticks.forEach(function(tv){ var gy=py(tv); if(gy<plotT-0.5||gy>plotB+0.5) return;
    s+='<line x1="'+plotL+'" y1="'+_mnt2DR(gy)+'" x2="'+plotR+'" y2="'+_mnt2DR(gy)+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.35"/>';
    s+=_mnt2DText(plotL-4, _mnt2DR(gy)+3.5, veSayi(kN ? tv/1000 : tv, fBas, { eksi:'−' }), 'end', 'var(--text-muted)', fs);
  });
  // Sıfır eksenleri (vurgulu)
  var y0=py(0), x0=px(0);
  if(y0>=plotT&&y0<=plotB) s+='<line x1="'+plotL+'" y1="'+_mnt2DR(y0)+'" x2="'+plotR+'" y2="'+_mnt2DR(y0)+'" stroke="var(--text-muted)" stroke-width="1"/>';
  if(x0>=plotL&&x0<=plotR) s+='<line x1="'+_mnt2DR(x0)+'" y1="'+plotT+'" x2="'+_mnt2DR(x0)+'" y2="'+plotB+'" stroke="var(--text-muted)" stroke-width="1"/>';
  var yol=function(P){ return P.map(function(p){ return _mnt2DR(px(p[0]))+','+_mnt2DR(py(p[1])); }).join(' '); };
  // Dinamik referanslar (kesikli) önce, statik yasalar (düz) üstüne; sonra ölçüm noktaları
  gruplar.forEach(function(g){
    s+='<polyline points="'+yol(g.dyn)+'" fill="none" stroke="'+g.renk+'" stroke-width="1.3" stroke-dasharray="5 3" opacity="0.8"/>';
  });
  gruplar.forEach(function(g){
    s+='<polyline points="'+yol(g.stat)+'" fill="none" stroke="'+g.renk+'" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';
  });
  var nokta=false;
  gruplar.forEach(function(g){
    if(!g.v.pts) return;
    nokta=true;
    g.v.pts.forEach(function(p){ s+='<circle cx="'+_mnt2DR(px(p[0]))+'" cy="'+_mnt2DR(py(p[1]))+'" r="2.4" fill="var(--bg-primary)" stroke="'+g.renk+'" stroke-width="1.4"/>'; });
  });
  // Eksen başlıkları
  s+=_mnt2DText((plotL+plotR)/2, H-4, 'sehim δ [mm]', 'middle', 'var(--text-secondary)', fs);
  var yc=(plotT+plotB)/2;
  s+='<text x="10" y="'+yc+'" text-anchor="middle" font-size="'+fs+'" font-family="'+_MNT2D_YUZ+'" fill="var(--text-secondary)" transform="rotate(-90 10 '+yc+')">kuvvet f ['+(kN ? 'kN' : 'N')+']</text>';
  s+='</svg>';
  return { svg:s, gruplar:gruplar.map(function(g){ return { ad:g.ad, renk:g.renk }; }), nokta:nokta, birim:kN?'kN':'N' };
}
function _mntLibForceChart(e, axis){ return _mntLibGrafik(e, axis).svg; }
// KUVVET–SEHİM — üç eksen tek diyagramda, sütun genişliğinde; eksen seçici ve
// eksenlerin yasası tablosu YOK (Canlı Not 108 · 103: *"Kaldıralım. Gerek yok."*).
// Özel girdide düşey (z) eğrinin noktaları altta bir föyde düzenlenir.
function _mntLibEgriHTML(node, e){
  var G=_mntLibGrafik(e);
  var h=_mntBolum('Kuvvet–sehim', _mntEsc(e.name),
    '<div class="ve-mnt-kroki" id="ve-mnt-lib-gr-'+node.id+'" data-tazele>'+G.svg+_mntLibLejant(G)+'</div>', { emTam:e.name });
  // Katalog tipinde diyagramın altında not YOK (kullanıcı 2026-11-06, Canlı Not 66):
  // salt okunurluk kılavuzda (7.1).
  if(!e.builtin) h+=_mntLibCurveEditor(node, _mntLibCustomEntry(node, e.key) || e);
  return h;
}
function _mntLibDurumlari(node, e){
  var bos=[];
  _MNT_LIB_EKS.forEach(function(a){ ['s','d'].forEach(function(t){ if(!(_mntNum(e[t+a[0]],0)>0)) bos.push(t+a[0]); }); });
  var O=_mntOranYayilim(_mntLibTakozAlan(e));
  var rij = bos.length
    ? _mntDurum('eksik', 'rijitlik eksik', bos.length+' rijitlik boş ya da ≤ 0: çözücü reddeder.', 've-mnt-lib-'+bos[0]+'-'+node.id)
    : (O && O.yayilim>_MNT_ORAN_YAYILIM_SINIR)
      ? _mntDurum('eksik', 'oran?', 'Din./stat. oranı eksenler arasında '+_mntS(O.yayilim,2)+' kat yayılıyor (sınır '+_mntS(_MNT_ORAN_YAYILIM_SINIR,1)+') — eksen takası olabilir.', 've-mnt-lib-dx-'+node.id)
      : _mntDurum('ok', _mntLibTahmin(e).length ? 'tahmini' : 'tamam');
  var egri=_mntDurum('ok', _mntEntryHasLaw(e) ? 'nonlineer' : 'lineer');
  return { rij:rij, egri:egri };
}
// SADE KİMLİK (kullanıcı 2026-11-06, Canlı Not 65: *"Çok karışık duruyor. 'Fabrika'
// falan yazıyor. 'Gömülü' falan yazıyor. Kaldıralım … Taşıma kapasitesi kısmını da
// kaldır"*): özel tipte ad + Sil; tür rozeti, Fabrika düğmesi, tipin sayacı ve
// Taşıma kapasitesi bölümü YOK. KATALOG TİPİNDE KİMLİK SATIRI YOK (Canlı Not 107:
// *"İsim değiştirme gömülü takozlar için mümkün değil … Özel takoz olursa belki"*):
// katalog adı seçicide okunur, değiştirilmez. Tipin kapasite alanı kayıtta durur
// (uygulanınca takoza geçer), pencerede yazılmaz. Kapı: mount-yon.test.js →
// *SADE TİP*.
function _mntLibKimlikHTML(node, e, setter){
  if(e.builtin) return '';
  var eylem='<button type="button" class="ve-fp-dugme" onclick="veMntLibRemove(\''+node.id+'\',\''+_mntEsc(e.key)+'\')">'+veIkon('trash')+' Sil</button>';
  return '<div class="ve-mnt-lib-kim">'
    + '<input class="ve-fp-inp ve-fp-inp--text" type="text" id="ve-mnt-lib-name-'+node.id+'" value="'+_mntEsc(e.name)+'"'
    + ' aria-label="Takoz tipinin adı" onchange="'+setter+'(\''+node.id+'\',\''+_mntEsc(e.key)+'\',\'name\',this.value)">'
    + eylem+'</div>';
}
// AMC KÜNYESİ — üreticinin verisi (js/mount-amc.js). Görsel YOK (kullanıcı
// 2026-11-10, Canlı Not 111: *"takoz resimlerini kaldıralım. Sadece teknik resmi
// kalsa yeter. Onu da direkt burada göstermeyelim … (i) butonu … pop-up pencere"*):
// tipin teknik resmi Tip satırının (i) düğmesiyle pencerede açılır (başlangıç
// sayfası kitinin penceresi, veBasResimGoster). Maks. yük burada yazılmaz (Canlı
// Not 65): tip uygulanınca takozun Kapasite alanına geçer. Kapı: mount-amc.test.js
// → *KÜNYE* · *TEKNİK RESİM*.
function _mntLibAmcKunye(e){
  return (e && e.amc && _MNT_AMC) ? _MNT_AMC.kunye(e.amc.kod) : null;
}
// A+P künyesi: katalog kodu (e.ap) ya da programın BMC girdisinin katalog eşi (LMT-1433-00).
function _mntLibApKunye(e){
  if(!e || !_MNT_AP) return null;
  return e.ap ? _MNT_AP.kunye(e.ap.kod) : _MNT_AP.kunyeEs(e.key);
}
// (i)'nin niteliği tipi söyler: data-amc (AMC kodu) · data-ap (A+P makale no) · data-ap-es
// (BMC girdisinin anahtarı → katalog eşinin resmi).
function _mntLibCizimDugme(node, e){
  var K=_mntLibAmcKunye(e), nit;
  if(K) nit='data-amc="'+_mntEsc(K.kod)+'"';
  else { K=_mntLibApKunye(e); if(K) nit=e.ap ? 'data-ap="'+_mntEsc(e.ap.kod)+'"' : 'data-ap-es="'+_mntEsc(e.key)+'"'; }
  if(!K || !K.cizim) return '';
  return '<button type="button" class="mntlib-bilgi" id="mntlib-bilgi-'+node.id+'" '+nit
    + ' aria-label="Teknik resim" title="Teknik resim" aria-haspopup="dialog"'
    + ' onclick="veMntLibCizimAc(this)">'+veIkon('info')+'</button>';
}
// (i) → pencere ailesinin görsel penceresi; kapanınca odak düğmeye döner.
function veMntLibCizimAc(dugme){
  if(!dugme) return false;
  var a=dugme.getAttribute('data-amc'), p=dugme.getAttribute('data-ap'), es=dugme.getAttribute('data-ap-es');
  var K=a ? (_MNT_AMC ? _MNT_AMC.kunye(a) : null)
      : p ? (_MNT_AP ? _MNT_AP.kunye(p) : null)
      : es ? (_MNT_AP ? _MNT_AP.kunyeEs(es) : null) : null;
  if(!K || !K.cizim || typeof veBasResimGoster!=='function') return false;
  return veBasResimGoster({ src:K.cizim, ad:K.urun+' · teknik resim', odak:dugme });
}
function _mntLibAmcKunyeHTML(e){
  var K=_mntLibAmcKunye(e); if(!K) return '';
  var sat=function(ad, v){ return v==null || v==='' ? '' : '<tr><th scope="row">'+ad+'</th><td>'+v+'</td></tr>'; };
  var h='<div class="ve-mnt-amc" data-amc="'+_mntEsc(K.kod)+'">'
    + '<table class="ve-mnt-amc-veri"><tbody>'
    + sat('Kod', 'AMC '+_mntEsc(K.kod))
    + sat('Ürün ailesi', '<span lang="en">'+_mntEsc(K.aile)+'</span>')
    + sat('Sertlik', K.sh!=null ? veSayi(K.sh, 0)+' ShA' : null)
    + sat('Sıkma torku', K.tork!=null ? veSayi(K.tork, (K.tork%1)?1:0)+' N·m' : null)
    + sat('Ağırlık', K.gr!=null ? veSayi(K.gr, 0)+' g' : null)
    + sat('Sönüm', K.sonum!=null ? veSayi(K.sonum, 2) : null)
    + sat('Kaynak', K.kaynak ? _mntEsc(K.kaynak) : null)
    + '</tbody></table>';
  return h+'</div>';
}
// A+P künyesi: katalog tipinde veri; programın BMC girdisinde (LMT-1433-00) katalog eşi.
// Teknik resim (i)'nin penceresinde (Canlı Not 111); kapasite yazılmaz (Canlı Not 65).
function _mntApOlcu(o){
  if(!o) return null;
  var n=function(v){ return veSayi(v, (v%1)?1:0); }, p=[];
  if(o.sd!=null){                                          // H-takoz: montaj deliği ve boru
    p.push('montaj deliği Ø'+n(o.sd)); if(o.T!=null) p.push('levha '+n(o.T));
    if(o.H!=null) p.push('boy '+n(o.H)); if(o.D2!=null) p.push('dış Ø'+n(o.D2));
    if(o.d1!=null) p.push('iç Ø'+n(o.d1)+' mm');
    if(o.vida) p.push(_mntEsc(o.vida));
    return p.join(' · ');
  }
  if(o.boy!=null) p.push(n(o.boy)+(o.en!=null ? ' × '+n(o.en) : '')+' mm');
  if(o.dBoy!=null) p.push('delik '+n(o.dBoy)+(o.dEn!=null ? ' × '+n(o.dEn) : ''));
  if(o.dCap!=null) p.push('Ø'+n(o.dCap));
  if(o.dis) p.push(_mntEsc(o.dis));
  return p.length ? p.join(' · ') : null;
}
function _mntLibApKunyeHTML(e){
  var K=_mntLibApKunye(e); if(!K) return '';
  var sat=function(ad, v){ return v==null || v==='' ? '' : '<tr><th scope="row">'+ad+'</th><td>'+v+'</td></tr>'; };
  var en=function(t){ return '<span lang="en">'+_mntEsc(t)+'</span>'; };
  var h='<div class="ve-mnt-amc" data-ap="'+_mntEsc(K.kod || K.uretici)+'">'
    + '<table class="ve-mnt-amc-veri"><tbody>'
    + (K.uretici ? sat('Üretici kodu', _mntEsc(K.uretici)) + sat('Katalog eşi', en(K.aile+' '+K.tipAdi))
                 : sat('Kod', 'A+P '+_mntEsc(K.kod)) + sat('Ürün ailesi', en(K.aile)) + sat('Tip', _mntEsc(K.tipAdi)))
    + (K.sinif ? sat('Sertlik', en(K.sinif)+(K.sh!=null ? ' · ~'+veSayi(K.sh, 0)+' ShA' : '')) : '')
    + sat('Ölçüler', _mntApOlcu(K.olcu))
    + sat('Yükseklik', K.olcu && K.olcu.yuk!=null ? veSayi(K.olcu.yuk, (K.olcu.yuk%1)?1:0)+' mm' : null)
    + sat('Rijitlik toleransı', K.tol!=null ? '±%'+veSayi(K.tol, 0) : null)
    + sat('Ağırlık', K.gr!=null ? veSayi(K.gr, 0)+' g' : null)
    + sat('Kaynak', K.kaynak ? _mntEsc(K.kaynak) : null)
    + '</tbody></table>';
  return h+'</div>';
}
// TAKOZ ÖZELLİKLERİ PENCERESİ — sütunda (2026-10-15'e dek 1040 px'lik modal
// bir görüntüleyiciydi: seçici + üç eksen grafiği yan yana). Üç kategori,
// gövdede alt alta: TİP (açılır liste ve seçili tipin kimliği — FEAD'in Kayış
// penceresinin Profil'i gibi seçim en üstte) · RİJİTLİK · KUVVET–SEHİM. Sağ
// sütun YOK (kullanıcı 2026-11-06, Canlı Not 66: *"Burayı komple kaldır …
// gereksiz bilgiler var"*): Kullanım (tipi taşıyan takozlar) ve Katalog
// (sayaçlar) kalktı; takozun tipten sapmasını Takoz penceresinin tip notu
// söyler. Gövdenin üstünde yalnız eksik bandı durur (aile kuralı); alttaki iki
// kategori seçili tipin adını bölüm künyesinde taşır. Kapı: mount-yon.test.js →
// *SADE PENCERE*.
// Bu pencerenin tipleri: düğümün özel takozları (kayıtlı ham girdinin marka etiketli
// KOPYASI — kayıtlı veriye alan eklenmez) ve gömülü katalog. Marka listesi ve seçili
// tip AYNI listeden okur.
function _mntLibGirdileri(node){
  var d=_mntLibEnsure(node);
  var custom=d.mounts.map(function(e){
    var c={}; Object.keys(e).forEach(function(k){ c[k]=e[k]; });
    c.marka=VE_MNT_LIB_MARKA_OZEL;
    return c;
  });
  var builtins=veMntGetLibraryList().filter(function(e){ return e.builtin; });
  return { custom:custom, builtins:builtins, hepsi:custom.concat(builtins) };
}
function getMntLibraryPropertiesHTML(node){
  var d=_mntLibEnsure(node);
  var G=_mntLibGirdileri(node);
  var sel=null;
  if(d._selKey) sel=G.hepsi.find(function(e){ return e.key===d._selKey; });
  if(!sel) sel=G.custom[0]||G.builtins[0]||null;
  var markalar=veMntLibMarkalar(G.hepsi);
  var grup=(sel && markalar.filter(function(g){ return g.ad===sel.marka; })[0]) || markalar[0] || null;
  var secici=_mntLibSecici(node, markalar, grup, sel);
  if(!sel){
    return _mntPencereKabuk(node, [
      { k:'tip', ad:'Tip', govde:_mntBolum('Takoz tipi', '', secici+_mntNot('Takoz seçilmedi.', '')) },
      { k:'rij', ad:'Rijitlik', govde:_mntBolum('Rijitlik', '[N/mm]', _mntNot('Takoz seçilmedi.', '')) }], '');
  }
  var setter=sel.builtin ? 'veMntLibSetBuiltin' : 'veMntLibSet';
  var D=_mntLibDurumlari(node, sel);
  var kategoriler=[
    { k:'tip', ad:'Tip', govde:_mntBolum('Takoz tipi', '', secici+_mntLibKimlikHTML(node, sel, setter)+_mntLibAmcKunyeHTML(sel)+_mntLibApKunyeHTML(sel)),
      durum:_mntDurum('ok') },
    { k:'rij', ad:'Rijitlik', govde:_mntLibRijitlikHTML(node, sel, setter), durum:D.rij },
    { k:'egri', ad:'Kuvvet–sehim', govde:_mntLibEgriHTML(node, sel), durum:D.egri }
  ];
  return _mntPencereKabuk(node, kategoriler, '');
}

// ─── Açılır liste denetimi (aç/kapa · ara · klavye) ──────────────────────────
// Liste innerHTML'in parçası olduğu için buradaki işler SALT DOM: hidden bayrağı
// ve satır filtresi. Panel yeniden çizilmez → arama yazarken odak korunur.
// _mntLibDDClose: açık listenin kapatıcısı (dış-tık/Escape dinleyicilerini de
// söker). Aynı anda tek liste açık kalır.
var _mntLibDDClose=null;
function veMntLibDropdownClose(){ if(_mntLibDDClose) _mntLibDDClose(); }
function veMntLibDropdownToggle(nodeId, ev){
  if(ev && ev.stopPropagation) ev.stopPropagation();
  if(typeof document==='undefined') return;
  var dd=document.getElementById('mntlib-dd-'+nodeId);
  if(!dd) return;
  var tr=document.getElementById('mntlib-tr-'+nodeId);
  var willOpen=dd.hidden;
  veMntLibDropdownClose();                 // açık liste varsa (bu ya da başka düğüm) kapat
  if(!willOpen) return;                    // aynı tetikleyiciye ikinci tık → kapalı kalsın
  dd.hidden=false;
  if(tr){ tr.classList.add('open'); tr.setAttribute('aria-expanded','true'); }
  var q=document.getElementById('mntlib-q-'+nodeId);
  if(q){ q.value=''; veMntLibFilter(nodeId); try{ q.focus(); }catch(_e){} }
  _mntLibSeciliyeKaydir(nodeId);
  // dd.isConnected: panel kapandıysa ya da yeniden çizildiyse liste DOM'dan
  // koptu demektir — dinleyiciler sessizce sökülür. Aksi hâlde ölü bir liste
  // ilk Escape'i yutar ve özellik penceresi kapanmaz.
  var onDown=function(e){
    if(!dd.isConnected){ veMntLibDropdownClose(); return; }
    if(!dd.contains(e.target) && !(tr && tr.contains(e.target))) veMntLibDropdownClose();
  };
  // Escape önce listeyi kapatır (özellik penceresi açık kalsın) → yakalama
  // evresinde durdurulur; ikinci Escape normal katman sırasına döner.
  var onKey=function(e){
    if(e.key!=='Escape') return;
    var live=dd.isConnected;
    veMntLibDropdownClose();
    if(!live) return;
    e.stopPropagation();
    if(tr) try{ tr.focus(); }catch(_e){}
  };
  _mntLibDDClose=function(){
    dd.hidden=true;
    if(tr){ tr.classList.remove('open'); tr.setAttribute('aria-expanded','false'); }
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    _mntLibDDClose=null;
  };
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('keydown', onKey, true);
}
// SEÇİLİ SATIR GÖRÜNÜR (kullanıcı 2026-11-10, Canlı Not 112: *"tabloyu tekrar
// açtığımda, tablonun en başına geliyor. Seçtiğim yere gelmiyor"*): liste açılınca
// seçili tipin satırı listenin ortasına kayar. Yalnız listenin kendi kaydırması
// oynar — scrollIntoView özellikler penceresini de kaydırırdı. Kapı:
// mount-library-dropdown.test.js → *SEÇİLİ SATIR*.
function _mntLibSeciliyeKaydir(nodeId){
  var list=document.getElementById('mntlib-list-'+nodeId);
  var sel=list ? list.querySelector('.mntlib-opt.sel') : null;
  if(!sel || sel.hidden) return;
  var L=list.getBoundingClientRect(), S=sel.getBoundingClientRect();
  var ust=S.top-L.top+list.scrollTop;
  list.scrollTop=Math.max(0, Math.round(ust-(list.clientHeight-S.height)/2));
}
// Arama: seçili markanın satırlarını DOM'da gizler/gösterir; hiç eşleşme yoksa
// "eşleşen yok" satırı görünür.
function veMntLibFilter(nodeId){
  if(typeof document==='undefined') return;
  var list=document.getElementById('mntlib-list-'+nodeId);
  if(!list) return;
  var q=document.getElementById('mntlib-q-'+nodeId);
  var needle=_mntLibNorm(q?q.value:'').trim();
  var opts=list.querySelectorAll('.mntlib-opt'), hits=0;
  Array.prototype.forEach.call(opts, function(el){
    var ok=!needle || (el.getAttribute('data-search')||'').indexOf(needle)>=0;
    el.hidden=!ok;
    if(ok) hits++;
  });
  var none=document.getElementById('mntlib-none-'+nodeId);
  if(none) none.hidden=(hits>0);
}
// Arama kutusu klavyesi: Enter → ilk görünen satırı seç, Escape → kapat.
function veMntLibSearchKey(ev, nodeId){
  if(!ev) return;
  if(ev.key==='Escape'){ ev.stopPropagation(); veMntLibDropdownClose(); return; }
  if(ev.key!=='Enter') return;
  ev.preventDefault();
  if(typeof document==='undefined') return;
  var list=document.getElementById('mntlib-list-'+nodeId);
  var first=list?list.querySelector('.mntlib-opt:not([hidden])'):null;
  if(first) first.click();
}


// ─── Kütüphane setter'ları ───────────────────────────────────────────────────
// Yeni takoz EKLENİR VE SEÇİLİR: liste artık açılır olduğu için seçim
// taşınmazsa yeni girdi kapalı listede gömülü kalır, detay kartı önceki takozu
// göstermeye devam ederdi (kullanıcı "eklendi mi?" diye listeyi açmak zorunda).
function veMntLibAdd(nodeId){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d._seq=(d._seq||0)+1;
  var key='mnt-usr-'+nodeId+'-'+d._seq;
  d.mounts.push({ key:key, name:'Yeni Takoz '+d._seq, sx:0, sy:0, sz:0, dx:0, dy:0, dz:0 });
  d._selKey=key;
  if(typeof saveState==='function') saveState();
  veMntLibDropdownClose();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibRemove(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d.mounts=d.mounts.filter(function(e){ return e.key!==key; });
  if(d._selKey===key) d._selKey=null;      // silinen takozda asılı kalmasın
  if(d._curveEditKey===key) d._curveEditKey=null;
  if(typeof saveState==='function') saveState();
  veMntLibDropdownClose();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibSet(nodeId, key, field, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  var e=d.mounts.find(function(x){ return x.key===key; }); if(!e) return;
  e[field]=(field==='name')?val:_mntNum(val);
  if(typeof saveState==='function') saveState();
  // Ad/rijitlik değişimi Takoz açılır listesini etkiler; panel yeniden çizilmez
  // (aktif input odağı korunur — girdiler zaten güncel değeri gösterir).
}
// Gömülü takoz düzenleme — fabrika VE_MOUNT_LIBRARY'yi asla mutasyona uğratmaz;
// değişikliği node.data.overrides[key][field] içine alan-bazlı yazar (kalıcı).
function veMntLibSetBuiltin(nodeId, key, field, val){
  if(!VE_MOUNT_LIBRARY[key]) return;                       // yalnız var olan gömülü girdi
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  if(!node.data.overrides || typeof node.data.overrides!=='object') node.data.overrides={};
  if(!node.data.overrides[key]) node.data.overrides[key]={};
  node.data.overrides[key][field]=(field==='name')?val:_mntNum(val);
  if(typeof saveState==='function') saveState();
  // Panel yeniden çizilmez (aktif input odağı korunur); ● rozeti bir sonraki
  // açılışta güncellenir, ↺ butonu her zaman tıklanabilir.
}
// Gömülü takozu fabrika ayarına döndür — override'ı sil.
function veMntLibResetBuiltin(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(node.data && node.data.overrides && node.data.overrides[key]!==undefined){
    delete node.data.overrides[key];
    if(typeof saveState==='function') saveState();
  }
  if(typeof showNodeProperties==='function') showNodeProperties(node); // fabrika değerlerini geri bas
}
// Açılır listede bir takoz seç → detay kartı o takozu gösterir (panel yeniden
// çizilir; liste yeni HTML'de kapalı gelir). Başka takoza geçilince açık eğri
// editörü kapanır (görsel durum temiz kalır).
function veMntLibSelect(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d._selKey=key;
  if(d._curveEditKey && d._curveEditKey!==key) d._curveEditKey=null;
  veMntLibDropdownClose();                 // dış-tık/Escape dinleyicileri sökülsün
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}

// Marka seç → seçili tip o markanın ilk tipine geçer (seçili tip zaten o markadaysa
// kalır); Tip listesi o markanın tiplerini sorar. Marka SEÇİLİ TİPTEN türer —
// ayrı bir durum tutulmaz, seçim her zaman geçerli bir tipte durur.
function veMntLibMarka(nodeId, marka){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  var g=veMntLibMarkalar(_mntLibGirdileri(node).hepsi).filter(function(x){ return x.ad===marka; })[0];
  if(!g) return;
  var mevcut=g.girdiler.filter(function(e){ return e.key===d._selKey; })[0];
  if(!mevcut){
    d._selKey=g.girdiler[0].key;
    if(d._curveEditKey && d._curveEditKey!==d._selKey) d._curveEditKey=null;
  }
  veMntLibDropdownClose();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}

// ─── Kütüphane girdisi: nonlineer z-eğrisi (takoz TİPİNİN özelliği) ──────────
// Eğri ÖZEL kütüphane girdisinde (node.data.mounts[i].curveZ = [[δ_mm,f_N],…])
// tutulur; veMntApplyLib ile Takoz'a KOPYALANIR. Gömülü katalog lineer kalır.
// d._curveEditKey: hangi özel girdinin eğri editörü açık (yalnız görsel durum).
function _mntLibCustomEntry(node, key){
  var d=_mntLibEnsure(node);
  return d.mounts.find(function(x){ return x.key===key; }) || null;
}
// Etkinleştir: girdinin sz'sinden (statik kz, N/mm) LİNEER başlangıç eğrisi tohumla.
// Başta lineerle aynı sonucu verir; kullanıcı ilerlemeli/asimetrik yaparak ayrıştırır.
function veMntLibCurveEnable(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(!e) return;
  var kz=_mntNum(e.sz, 0);   // N/mm
  e.curveZ=[[-15,-15*kz],[-7.5,-7.5*kz],[0,0],[7.5,7.5*kz],[15,15*kz]];
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibCurveDisable(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(e) delete e.curveZ;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
// Nokta düzenle — YENİDEN ÇİZME YOK (odak korunur). col: 0=δ[mm], 1=f[N].
function veMntLibCurveSetPoint(nodeId, key, idx, col, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key);
  if(!e || !Array.isArray(e.curveZ) || !e.curveZ[idx]) return;
  e.curveZ[idx][col]=_mntNum(val, 0);
  if(typeof saveState==='function') saveState();
}
function veMntLibCurveAddPoint(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(!e || !Array.isArray(e.curveZ)) return;
  var last=e.curveZ[e.curveZ.length-1]||[0,0];
  e.curveZ.push([_mntNum(last[0],0)+5, _mntNum(last[1],0)]);   // son noktanın 5 mm ötesine
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibCurveRemovePoint(nodeId, key, idx){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(!e || !Array.isArray(e.curveZ)) return;
  e.curveZ.splice(idx,1);
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
// Özel girdinin düşey (z) kuvvet–sehim eğrisi — noktalar bir föyde (δ, f).
// Eğri yoksa tanımlama eylemi: statik kz'den LİNEER başlangıç eğrisi
// (başta lineerle aynı sonucu verir; kullanıcı ilerlemeli/asimetrik yapar).
function _mntLibCurveEditor(node, e){
  var pts=Array.isArray(e.curveZ) ? e.curveZ : null;
  var k="'"+node.id+"','"+_mntEsc(e.key)+"'";
  if(!pts || pts.length<2){
    // Durum: eğri yok → tip lineer. Eğrinin çözücüye etkisi kılavuzda.
    return _mntBolum('Düşey (z) eğrisi', 'özel takoz',
        _mntNot('<b>Eğri yok</b> — tip lineer (statik kz).', '')
      + '<div class="ve-fp-eylem"><button type="button" class="ve-fp-dugme" onclick="veMntLibCurveEnable('+k+')">'
      + veIkon('activity')+' z-eğrisi tanımla</button></div>');
  }
  var f=_mntFoyAc([{ b:'Nokta', gen:'20%' }, { b:_mntSym('δ')+' <u>[mm]</u>', gen:'34%' }, { b:_mntSym('f')+' <u>[N]</u>', gen:'34%' }, { b:'', gen:'12%' }], 'z-eğrisinin noktaları');
  pts.forEach(function(p, i){
    f+='<tr><td>'+(i+1)+'</td>'
      + '<td class="gir"><input type="text" inputmode="decimal" value="'+_mntEsc(p[0])+'" aria-label="Nokta '+(i+1)+' sehim [mm]"'
      + ' onchange="veMntLibCurveSetPoint('+k+','+i+',0,this.value)"></td>'
      + '<td class="gir"><input type="text" inputmode="decimal" value="'+_mntEsc(p[1])+'" aria-label="Nokta '+(i+1)+' kuvvet [N]"'
      + ' onchange="veMntLibCurveSetPoint('+k+','+i+',1,this.value)"></td>'
      + '<td><button type="button" class="ve-mnt-sil" onclick="veMntLibCurveRemovePoint('+k+','+i+')" aria-label="Noktayı sil" title="Noktayı sil">'+veIkon('x')+'</button></td></tr>';
  });
  f+=_MNT_FOY_KAPA;
  return _mntBolum('Düşey (z) eğrisi', pts.length+' nokta · basma −', f   // metin: işaret kuralı (basma eksi)
    + '<div class="ve-fp-eylem">'
    + '<button type="button" class="ve-fp-dugme" onclick="veMntLibCurveAddPoint('+k+')">'+veIkon('plus')+' Nokta</button>'
    + '<button type="button" class="ve-fp-dugme" onclick="veMntLibCurveDisable('+k+')">Lineere dön</button></div>');
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜCÜ — bağlı node'ları topla, agrege et, çekirdeği çalıştır
// ════════════════════════════════════════════════════════════════════════════
// Çözücü, iç topolojideki TÜM kütle ve takoz node'larını OTOMATİK algılar —
// bağlantı zorunluluğu yoktur (kullanıcı isteği). Alt topoloji yalnız mount
// bileşenleri içerdiğinden nodes içindeki isMountBody/isMount düğümleri toplanır.
// Tork zinciri girdilerini (Te / vites / transfer / aks payı) kütle
// gövdelerinden konumdan bağımsız topla — hangi bileşende girildiği fark etmez
// (ilk tanımlı değer geçerli). Motor→Te, Şanzıman→vites+stall, Transfer→oran+φ.
// Tahrik/motor büyüklüklerini kütle gövdelerinden topla (ilk tanımlı değer kazanır).
// idleRpm + cylinders motorun ÖZELLİĞİDİR: buradan toplanıp rapora akar; raporun
// ateşleme frekansı f_ateş=(N/60)·(z/2) bu ikisine dayanır.
// TeRpm + PmaxRpm de toplanır: yük durumu hesabında kullanılmazlar ama Campbell
// diyagramının ÇALIŞMA BANDI üst sınırı bunlardan gelir (js/mount-signals.js
// _engineSpec). Motorun en yüksek devri bilinmezse band rölantinin katından
// tahmin edilir ve kesişimlerin bant içinde mi dışında mı olduğu yanlış söylenir.
var _MNT_TORK_ALANLARI=['Te','Rstall','g1','g2','g3','g4','g5','g6','g7','gR','iTransfer','phiFwd','phiRev','derate',
                        'idleRpm','cylinders','TeRpm','PmaxRpm'];
// Değerle birlikte KAYNAĞI da döner: pencerenin tork zinciri "bu çarpan hangi
// bileşenden geldi" sorusunu çözücünün okuduğu AYNI taramadan cevaplar.
// Ayrı bir tarama yazılsaydı iki gövdede aynı alan dolu olduğunda pencere
// birini, çözücü ötekini okurdu (ilk dolu kazanır — düğüm sırası).
// `liste` (ops.): düğüm listesi — verilmezse canlı `nodes`. Sihirbaz kendi
// modelini KURMAZ: durumunu düğüm listesine çevirip (veMntWizNodes) AYNI
// toplayıcıdan geçirir; önizleme ile kurulan model aynı yoldan okunur.
function _mntGatherTorqueKaynakli(liste){
  var t={}, kaynak={};
  (liste || (typeof nodes!=='undefined' && Array.isArray(nodes)?nodes:[])).forEach(function(n){
    if(!n || !(_mntDef(n)||{}).isMountBody) return;
    var d=n.data||{};
    _MNT_TORK_ALANLARI.forEach(function(k){
      if(t[k]===undefined && d[k]!==undefined && d[k]!==null && d[k]!==''){ t[k]=d[k]; kaynak[k]=n; }
    });
  });
  return { t:t, kaynak:kaynak };
}
function _mntGatherTorque(liste){ return _mntGatherTorqueKaynakli(liste).t; }
// `id` düğüm kimliğidir ve SI'ya, oradan R.mounts'a taşınır: pencere takozun
// sonucunu SIRAYLA değil KİMLİKLE bulur (sıra, silinen ya da sonradan eklenen
// bir takozla kayar ve başka takozun sehimi sessizce gösterilirdi).
// Aracın ileri yönü Çözücü'nün ayarı: çözücü verilmezse listedeki çözücüden.
function _mntGatherForSolver(solver, liste){
  var masses=[], mounts=[];
  var L=liste || (typeof nodes!=='undefined' && Array.isArray(nodes)?nodes:[]);
  if(!solver) solver=L.filter(function(n){ return n && (_mntDef(n)||{}).isMountSolver; })[0] || null;
  var baglanti=null;
  L.forEach(function(n){
    if(!n) return;
    var def=_mntDef(n)||{};
    if(def.isMountBody){
      var d=n.data||{};
      // tip: aksonometrinin braketi (eşdeğer levha, _mntAksoBraketLevha) — çözüme girmez
      masses.push({ id:n.id, name:_mntNodeName(n), tip:n.type, mass:d.mass, cgx:d.cgx, cgy:d.cgy, cgz:d.cgz, Ixx:d.Ixx, Iyy:d.Iyy, Izz:d.Izz, Ixy:d.Ixy, Ixz:d.Ixz, Iyz:d.Iyz, pointMass:!!d.pointMass });
      // Bağlantı yüzü: merkezi tam olan İLK gövde (şanzıman penceresi — _mntBaglantiSection)
      if(!baglanti && _MNT_BAG.every(function(x){ return !_mntBos(d[x[0]]); }))
        baglanti={ id:n.id, name:_mntNodeName(n), S:_MNT_BAG.map(function(x){ return _mntNum(d[x[0]]); }),
                   a:_mntBagYon(d), sinir:_mntNum(d.egSinir,0)>0 ? _mntNum(d.egSinir) : null };
    } else if(def.isMount){
      var m=n.data||{};
      mounts.push({ id:n.id, name:_mntNodeName(n), x:m.x, y:m.y, z:m.z, kxs:m.kxs, kys:m.kys, kzs:m.kzs, kxd:m.kxd, kyd:m.kyd, kzd:m.kzd,
                    maxLoad:m.maxLoad,                                        // taşıma kapasitesi [kg] (opsiyonel, fiziğe girmez)
                    bosY:m.bosY,                                              // yanal durdurucu boşluğu [mm] (opsiyonel, F006)
                    fitX:(m.fitX||null), fitY:(m.fitY||null), fitZ:(m.fitZ||null),   // opsiyonel analitik fit (x/y/z)
                    curveX:(Array.isArray(m.curveX)?m.curveX:null),                  // ya da nokta tablosu (x/y/z)
                    curveY:(Array.isArray(m.curveY)?m.curveY:null),
                    curveZ:(Array.isArray(m.curveZ)?m.curveZ:null) });
    }
  });
  var sd=solver && solver.data, oneri=_mntIleriOnerisi(L), tork=_mntTorkOnerisi(L);
  // ileriKaynak: yönün nereden geldiği — 'proje' (yazılı) · 'dizilis' (öneri) · 'varsayilan' (−X); rapor söyler.
  return { components:masses, mounts:mounts, torque:_mntGatherTorque(liste), yon:_mntYonAyari(sd, oneri, tork),
           ileriOnay:_mntIleriOnayli(sd), ileriKaynak:_mntIleriOnayli(sd) ? 'proje' : (oneri ? 'dizilis' : 'varsayilan'),
           torkKaynak:_mntTorkKaynak(sd, tork), donus:tork.donus,
           baglanti:baglanti };
}
// Girilen kinematikten tork yük durumlarını (ileri/geri) kur. Eksikse boş döner.
// İleri = 1. vites (en yüksek redüksiyon), geri = Geri vites. T_shaft çekirdeğin
// torqueChain'i ile hesaplanır; Tx = s·T_shaft, s Çözücü'nün tork yönünden
// (_mntTorkIsareti: varsayılan −1, SPEC T5 işaret düzeni). Mil torku `Tshaft`
// olarak taşınır — pencereler ve rapor onu Tx'in işaretinden geri çıkarmaz.
function _mntTorqueCases(torque, yon){
  var C=veMountCore; if(!C || !C.torqueChain) return [];
  var tq=torque||{}, s=_mntTorkIsareti(yon);
  var Te=_mntNum(tq.Te,0), Rstall=_mntNum(tq.Rstall,0), g1=_mntNum(tq.g1,0), gR=_mntNum(tq.gR,0);
  var iTr=_mntNum(tq.iTransfer,1); if(iTr===0) iTr=1;
  var phiF=_mntNum(tq.phiFwd,1); if(phiF===0) phiF=1;
  var phiR=_mntNum(tq.phiRev,1); if(phiR===0) phiR=1;
  var der=_mntNum(tq.derate,1); if(der===0) der=1;
  if(!(Te>0 && Rstall>0 && g1!==0)) return [];
  var cases=[];
  var Tfwd=C.torqueChain({Te:Te, Rstall:Rstall, iGear:g1, iTransfer:iTr, phiAxle:phiF, derate:der});
  cases.push({name:'Forward Torque', n:[0,0,-1], T:[s*Tfwd,0,0], Tshaft:Tfwd});
  if(gR!==0){
    var Trev=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gR, iTransfer:iTr, phiAxle:phiR, derate:der});
    cases.push({name:'Reverse Torque', n:[0,0,-1], T:[s*Trev,0,0], Tshaft:Trev});
  }
  return cases;
}

// Kriter 3 — HER tanımlı vites için ayrı tork durumu (mount kuvvetleri kontrolü).
// _mntTorqueCases yalnız 1. vitesi (maks tork) ana matrise koyar; bu ise g1..g7 +
// geri için ayrı durumlar döndürür. Kütle/rijitlik sabit, yalnız T_shaft vites
// oranıyla ölçeklenir → yüksek vites daha düşük kuvvet (1. vites bağlayıcıdır).
// Dönüş öğeleri gearLabel/ratio/Tshaft meta verisini taşır (rapor §8.9 tablosu).
// İşaret _mntTorqueCases'inkiyle aynı (Çözücü'nün tork yönü).
function _mntGearTorqueCases(torque, yon){
  var C=veMountCore; if(!C || !C.torqueChain) return [];
  var tq=torque||{}, s=_mntTorkIsareti(yon);
  var Te=_mntNum(tq.Te,0), Rstall=_mntNum(tq.Rstall,0);
  var iTr=_mntNum(tq.iTransfer,1); if(iTr===0) iTr=1;
  var phiF=_mntNum(tq.phiFwd,1); if(phiF===0) phiF=1;
  var phiR=_mntNum(tq.phiRev,1); if(phiR===0) phiR=1;
  var der=_mntNum(tq.derate,1); if(der===0) der=1;
  if(!(Te>0 && Rstall>0)) return [];
  var out=[];
  _MNT_VITES_ALAN.forEach(function(k,i){
    var gr=_mntNum(tq[k],0); if(gr===0) return;
    var Ts=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gr, iTransfer:iTr, phiAxle:phiF, derate:der});
    out.push({name:(i+1)+'. Vites', gearLabel:(i+1)+'. Vites', ratio:gr, Tshaft:Ts, n:[0,0,-1], T:[s*Ts,0,0]});
  });
  var gR=_mntNum(tq.gR,0);
  if(gR!==0){
    var Tr=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gR, iTransfer:iTr, phiAxle:phiR, derate:der});
    out.push({name:'Geri Vites', gearLabel:'Geri', ratio:gR, Tshaft:Tr, n:[0,0,-1], T:[s*Tr,0,0]});
  }
  return out;
}
// UI (mm/kg/N/mm) → SI. Yük durumları: 6 otomatik g-durumu + (kinematik
// girildiyse) ileri/geri tork durumları.
function _mntToSI(gather, g){
  var C=veMountCore;
  return {
    g: g||9.81,
    components: gather.components.map(function(c){ return {
      id:c.id, name:c.name||'kütle', mass:_mntNum(c.mass,0),
      cg:[C.mmToM(_mntNum(c.cgx)),C.mmToM(_mntNum(c.cgy)),C.mmToM(_mntNum(c.cgz))],
      I:[[_mntNum(c.Ixx),_mntNum(c.Ixy),_mntNum(c.Ixz)],[_mntNum(c.Ixy),_mntNum(c.Iyy),_mntNum(c.Iyz)],[_mntNum(c.Ixz),_mntNum(c.Iyz),_mntNum(c.Izz)]],
      pointMass:!!c.pointMass }; }),
    mounts: gather.mounts.map(function(m){
      var mnt={
        id:m.id, name:m.name||'takoz', pos:[C.mmToM(_mntNum(m.x)),C.mmToM(_mntNum(m.y)),C.mmToM(_mntNum(m.z))],
        kstat:[C.nPerMmToNPerM(_mntNum(m.kxs)),C.nPerMmToNPerM(_mntNum(m.kys)),C.nPerMmToNPerM(_mntNum(m.kzs))],
        kdyn:[C.nPerMmToNPerM(_mntNum(m.kxd)),C.nPerMmToNPerM(_mntNum(m.kyd)),C.nPerMmToNPerM(_mntNum(m.kzd))] };
      // Kapasite [kg] → SI'da KUVVET [N] olarak taşınır: raporlama katmanı bir
      // daha g ile çarpmak zorunda kalmasın (iki yerde çarpılırsa biri unutulur
      // ve % kullanım 9,81 kat şaşar). Tanımsızsa alan HİÇ eklenmez.
      var ml=_mntNum(m.maxLoad,0);
      if(ml>0) mnt.fCap=ml*(g||9.81);
      // Yanal durdurucu boşluğu [mm] → gapY [m]; boş ya da ≤ 0 → alan HİÇ eklenmez (durdurucu yok).
      var by=_mntNum(m.bosY,0);
      if(by>0) mnt.gapY=C.mmToM(by);
      // Nonlineer yasa → çekirdek. Eksen başına FİT (analitik) ÖNCELİKLİ: mm/N olarak
      // AYNEN geçer (çekirdek makeAxisLaw mm↔m dönüşümünü yapar). Yoksa nokta tablosu:
      // burada SI'ya (δ mm→m, f N aynı) çevrilir. Çekirdek mnt.fits/mnt.curves okur.
      var fits={}, curves={};
      [['X','x'],['Y','y'],['Z','z']].forEach(function(ax){
        var f=m['fit'+ax[0]];
        if(f && (f.form==='poly'||f.form==='asym')){ fits[ax[1]]=f; return; }
        var src=m['curve'+ax[0]];
        if(Array.isArray(src) && src.length>=2){
          curves[ax[1]]=src.map(function(p){ return [C.mmToM(_mntNum(p[0])), _mntNum(p[1])]; });
        }
      });
      if(Object.keys(fits).length) mnt.fits=fits;
      if(Object.keys(curves).length) mnt.curves=curves;
      return mnt; }),
    loadCases: _mntYukDurumlari(gather)
  };
}

// Sönüm oranı varsayılanı — TEK doğruluk kaynağı çekirdektir (veMountCore
// .DEFAULT_ZETA). Çağrı anında okunur ki modül yükleme sırasına bağlı olmasın;
// çekirdek yoksa (test izolasyonu) aynı değere düşer.
function _mntZetaDefault(){
  var C=(typeof veMountCore!=='undefined')?veMountCore:null;
  return (C && C.DEFAULT_ZETA>0) ? C.DEFAULT_ZETA : 0.02;
}
// Çözücü düğümünden geçerli ζ (girilmemiş/geçersiz → varsayılan).
function _mntZetaOf(solver){
  var v = solver && solver.data ? solver.data.zeta : undefined;
  var z = _mntNum(v, NaN);
  return (Number.isFinite(z) && z>=0 && z<1) ? z : _mntZetaDefault();
}

var _veMntLast=null;      // son sonuç (kopyala/CSV/3D için)

// Saklanan takoz sonucunu unut. İKİ yer birden temizlenmeli: Rapor _veMntLast'e,
// Sonuçlar paneli window.veMountResults'a bakar. Yalnız biri temizlenirse çözüm
// başarısızken pano hâlâ ESKİ koşunun kanallarını çizer — sessiz yalan.
function _mntForgetResults(){
  _veMntLast=null;
  if(typeof window!=='undefined') window.veMountResults=null;
}

// ── SONUÇ GÜNCELLİĞİ — MODELİN İMZASI ────────────────────────────────────────
// Rapor ve Sonuçlar son çözümün sayılarını gösteriyor; model hesaptan sonra
// değiştiyse o sayılar BAŞKA bir modelin cevabıdır, "güncel" görünmeleri
// sessiz bir yalandır. FEAD'in kural 33'ünün karşılığı: çözüm anında modelin
// imzası R'ye yazılır, şimdiki modelinkiyle karşılaştırılır. Pencerelerde
// yalnız eylemin hazırlığı onu okur (Çözücü'nün notu, Rapor'un durumu).
//
// İmza çözücünün GİRDİSİDİR — SI'ya çevrilmiş model + çözücü ayarları: yazım
// farkı ("124,96" ↔ "124.96" ↔ 124.96) imzayı değiştirmez, ad değiştirmez
// (fiziğe girmez). Nokta kütlenin tensörü imzaya girmez (çözücü onu sıfırlar).
// Tork alanlarının HEPSİ girer: vites oranları vites başına durumları,
// silindir sayısı uygunluğu değiştirir — ikisi de hesaplanan sonucun parçası.
function _mntImza(si, torque, sd, bag, yon){
  var t=torque||{}, d=sd||{};
  var v={
    b:bag ? [bag.id||'', bag.S, bag.a, bag.sinir] : 0,
    c:(si.components||[]).map(function(c){ return [c.id||'', c.mass, c.cg, c.pointMass?0:c.I, c.pointMass?1:0]; }),
    m:(si.mounts||[]).map(function(m){ return [m.id||'', m.pos, m.kstat, m.kdyn, m.fCap||0, m.fits||0, m.curves||0]; }),
    t:Object.keys(t).sort().map(function(k){ return [k, _mntNum(t[k], null)]; }),
    s:[d.solveMode||'auto', _mntZetaOf({ data:d }), _mntNum(d.shockG, MNT_SHOCK_G), _mntNum(d.shockMs, MNT_SHOCK_MS)],
    y:(function(Y){ return [Y.ileri, Y.kaldirimG, Y.kaldirimYon, Y.torkYon]; })(yon || _mntYonAyari(d))
  };
  var s=JSON.stringify(v), h=5381;
  for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0;
  return (h>>>0).toString(36)+'.'+s.length;
}

// Son çözümün ŞİMDİKİ modele göre durumu: 'yok' (çözüm yok ya da hata) ·
// 'guncel' (imza tutuyor) · 'bayat' (model hesaptan sonra değişti ya da
// çözücü bu topolojide yok). Dönüş: { durum, R }.
// `liste` (ops.): düğüm listesi — verilmezse canlı `nodes`. Kök tuvaldeki
// modül kartı alt topolojinin KAYITLI listesiyle sorar (o an canlı değil).
// `R` (ops.): sorulan çözüm — verilmezse son çözüm.
function veMntSonucDurumu(liste, R){
  R=R||_veMntLast;
  if(!R || R.error || !R.imza) return { durum:'yok', R:null };
  var list=liste || ((typeof nodes!=='undefined' && Array.isArray(nodes)) ? nodes : []);
  var solver=null;
  for(var i=0;i<list.length;i++){ if(list[i] && list[i].id===R.solverId){ solver=list[i]; break; } }
  if(!solver || typeof veMountCore==='undefined') return { durum:'bayat', R:R };
  var g=_mntGatherForSolver(solver, liste);
  var imza=_mntImza(_mntToSI(g, R.g||9.81), g.torque, solver.data, g.baglanti, g.yon);
  return { durum:(imza===R.imza ? 'guncel' : 'bayat'), R:R };
}

// Son çözümün modeli PROJENİN neresinde: canlı tuvalde (Takoz alt
// topolojisindeyiz), kökteki Takoz kartının KAYITLI alt topolojisinde, Takoz
// gezinme yığınında ya da sekmenin kayıtlı kökünde (başka bir modülün alt
// topolojisindeyken — Sonuçlar ağacı çizilmeden hemen önce kaydediliyor).
// FEAD'in veFeadLiveModelNodes kalıbı. null: model projede yok.
function veMntProjeModeli(solverId){
  if(!solverId) return null;
  var has=function(list){
    for(var i=0;i<(list||[]).length;i++){ if(list[i] && list[i].id===solverId) return true; }
    return false;
  };
  var subOf=function(list){
    for(var i=0;i<(list||[]).length;i++){
      var n=list[i], sub=n && n.type==='mount-analysis' && n.data && n.data.subTopology;
      if(sub && Array.isArray(sub.nodes) && has(sub.nodes)) return sub.nodes;
    }
    return null;
  };
  var cur=(typeof nodes!=='undefined' && Array.isArray(nodes)) ? nodes : [];
  if(has(cur)) return cur;
  var hit=subOf(cur);
  if(hit) return hit;
  for(var k=veMntStack.length-1;k>=0;k--){
    var ps=veMntStack[k] && veMntStack[k].parentState;
    hit=subOf(ps && ps.nodes);
    if(hit) return hit;
  }
  var tab=(typeof veTabs!=='undefined' && Array.isArray(veTabs) && typeof veActiveTabIdx!=='undefined') ? veTabs[veActiveTabIdx] : null;
  return subOf(tab && tab.state && tab.state.nodes);
}
// SONUÇLAR SAYFASININ VE RAPORUN HÜKMÜ: son çözüm PROJEDEKİ modeline göre —
// kök tuvaldeyken de. k ∈ yok · hata · guncel · bayat · kayip (FEAD'in
// veFeadResultState sözlüğü). Pencereler veMntSonucDurumu'nu okur: onlar için
// başka bir Takoz kartının çözümü "bu topolojinin" değildir.
function veMntResultState(R){
  if(R===undefined || R===null) R=_veMntLast;
  if(!R) return { k:'yok', R:null };
  if(R.error) return { k:'hata', R:R };
  var liste=veMntProjeModeli(R.solverId);
  if(!liste) return { k:'kayip', R:R };
  var S=veMntSonucDurumu(liste, R);
  return { k:(S.durum==='guncel' ? 'guncel' : (S.durum==='bayat' ? 'bayat' : 'yok')), R:R };
}


// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜCÜ PENCERESİ — Yük durumları · Ayarlar + Hesapla
// ════════════════════════════════════════════════════════════════════════════
// Pencere son çözümü TAŞIMAZ (kullanıcı kararı 2026-10-16: sonuç yalnız
// ayrıntılı raporda). Yük kitabı CANLI modelin girdisidir — çözücünün
// çözeceği durumlar; sehim, vites başına kuvvet ve modlar raporda (Modlar
// kategorisi ve kitabın δz sütunu kalktı). Yöntem seçimleri "bir sonraki
// Hesapla'da" uygulanır — hesap düğmeye kilitli.

// Çözüm modu etiketi — raporun kapağıyla (cp-mount-report.js _mntRepAntet)
// aynı otorite sırası: kullanıcının niyeti + fiilen koşan yol.
function _mntCozumModuEtiketi(R){
  return R.solveMode==='linear' ? 'Lineer — eğriler yok sayıldı'
    : R.solveMode==='nonlinear' ? (R.solvedNL ? 'Nonlineer (Newton)' : 'Nonlineer seçildi — eğri yok, lineer')
    : (R.solvedNL ? 'Otomatik → Nonlineer (Newton)' : 'Otomatik → Lineer');
}
// ÖN DENETİM — çözücünün AYNI doğrulaması (çekirdek validateModel) şimdiki
// model üzerinde: Hesapla'ya basmadan neyin reddedileceği görünür. Eski hâlde
// liste ancak basıldıktan sonra, ilerleme kutusunun yerinde çıkıyordu.
function _mntOnDenetim(node){
  var C=(typeof veMountCore!=='undefined') ? veMountCore : null;
  if(!C || !C.validateModel || !C.mmToM) return [];
  var si=_mntToSI(_mntGatherForSolver(node), 9.81);
  return C.validateModel(si.components, si.mounts);
}
// Hüküm pencerenin CEVABI: FEAD'in durum kutusu (boşken yer kaplamaz).
function _mntOnDenetimHTML(node){
  var p=_mntOnDenetim(node);
  return '<div class="ve-mnt-sonuc" id="ve-mnt-results" data-tazele>'
    + (p.length ? _mntDurumKutu('<b>Hesaplanamaz — '+p.length+' sorun.</b><ul>'
        + p.map(function(x){ return '<li>'+_mntEsc(x)+'</li>'; }).join('')+'</ul>', 'no') : '')
    + '</div>';
}
function _mntEgriYok(node){
  var d=node.data||{};
  if(d.solveMode!=='nonlinear') return false;
  var C=(typeof veMountCore!=='undefined') ? veMountCore : null;
  if(!C || !C.anyCurve || !C.mmToM) return false;
  return !C.anyCurve(_mntToSI(_mntGatherForSolver(node), 9.81).mounts);
}
// Eylemin notu — modelin büyüklüğü ve son hesabın HAZIRLIĞI (hesaplanmadı ·
// güncel · bayat): rapor üretilmeden önce yeniden hesaplanmalı mı. Sonuç
// değil; Çözücü penceresinde çözümle değişen TEK satır (`data-cozum-durumu`).
function _mntCozucuNotu(node, S){
  var M=_mntCanliModel();
  var R=(S.R && S.R.solverId===node.id) ? S.R : null;
  return _mntS(M.mTop,1)+' kg · '+M.g.components.length+' kütle · '+M.g.mounts.length+' takoz · '
    + (!R ? 'hesaplanmadı' : (S.durum==='bayat' ? 'model değişti' : 'son hesap güncel'));
}
// YÜK KİTABI — canlı modelin çözülecek durumları (otomatik g-durumları +
// tork girdisinden kurulan durumlar); n [g], T [kN·m].
function _mntCozucuDurumGovde(node){
  var C=(typeof veMountCore!=='undefined') ? veMountCore : null;
  var satirlar=(C && C.mmToM) ? _mntToSI(_mntGatherForSolver(node), 9.81).loadCases : [];
  var f=_mntFoyAc([{ b:'Durum', gen:'36%' }, { b:_mntSym('n<sub>x</sub>'), gen:'15%' }, { b:_mntSym('n<sub>y</sub>'), gen:'16%' },
                   { b:_mntSym('n<sub>z</sub>'), gen:'15%' }, { b:_mntSym('T<sub>x</sub>'), gen:'18%', ipucu:'Tork [kN·m]' }],
                  'Yük kitabı', 've-mnt-foy--sik');
  var sayi=function(v){ return '<td'+(v===0 ? ' class="sf"' : '')+'>'+_mntS(v)+'</td>'; };
  var tork=0;
  satirlar.forEach(function(lc){
    var n=lc.n||[0,0,0], T=lc.T||[0,0,0];
    if(T[0]!==0) tork++;
    f+='<tr><td title="'+_mntEsc(_mntDurumAdi(lc.name))+'">'+_mntEsc(_mntDurumKisa(lc.name))+'</td>'
      + sayi(n[0])+sayi(n[1])+sayi(n[2])
      + '<td'+(T[0]===0 ? ' class="sf"' : '')+'>'+(T[0]===0 ? '0' : _mntS(T[0]/1000,1))+'</td></tr>';
  });
  var Y=_mntYonAyari(node.data, _mntIleriOnerisi(), _mntTorkOnerisi()), eks=function(v){ return v==='+x' ? '+X' : '−X'; };
  var em=(satirlar.length-tork)+' otomatik durum'+(tork ? ' + '+tork+' tork' : ' · tork girdisi yok')
    + ' · ileri '+eks(Y.ileri)+' · tork '+eks(Y.torkYon);
  return _mntCozucuApGovde(node) + _mntCozucuYonGovde(node)
    + '<div id="ve-mnt-cdur-'+node.id+'" data-tazele>'+_mntBolum('Yük kitabı', em, f+_MNT_FOY_KAPA)+'</div>';
}
// ARAÇ PERFORMANS'TAN DOLDUR (F002, 2026-11-11) — Takoz kendi başına kurulur;
// projede Araç Performans modeli varsa tork zinciri ondan doldurulabilir.
// Kaynak: motorun tam yük eğrisi (tepe tork, maks. güç, rölanti), konvertörün
// K/τ eğrisinin SR = 0 noktası (stall), şanzımanın ileri vitesleri ve geri vites
// (düğümde yoksa çözülen katalog kaydından), transferin EN YÜKSEK oranlı kademesi
// (takoza en büyük tork). Yazım tek geri-al adımı; alan onu okuyan gövdeye
// (toplayıcının kaynağına) yazılır, yoksa tipin gövdesine.
var _MNT_AP_TIP = { engine:1, 'torque-converter':1, gearbox:1, transfer:1 };
function _mntApListe(L){
  return (L||[]).some(function(n){ return n && _MNT_AP_TIP[n.type]; });
}
function veMntApModeli(){
  var kok=(typeof veMntStack!=='undefined' && veMntStack.length && veMntStack[0].parentState)
    ? veMntStack[0].parentState.nodes : (typeof nodes!=='undefined' ? nodes : null);
  kok=Array.isArray(kok) ? kok : [];
  for(var i=0;i<kok.length;i++){
    var n=kok[i], sub=n && n.type==='arac-performans' && n.data && n.data.subTopology;
    if(sub && _mntApListe(sub.nodes)) return { ad:_mntNodeName(n), nodes:sub.nodes };
  }
  return _mntApListe(kok) ? { ad:'Araç Performans', nodes:kok } : null;
}
function _mntApZinciri(M){
  M=M || veMntApModeli(); if(!M) return null;
  var bul=function(t){ return M.nodes.filter(function(n){ return n && n.type===t; })[0] || null; };
  var e=bul('engine'), tc=bul('torque-converter'), gb=bul('gearbox'), tr=bul('transfer');
  var v={}, not=[];
  if(e){
    var ed=e.data||{}, bt=null, bp=null;
    (Array.isArray(ed.torqueData) ? ed.torqueData : []).forEach(function(r){
      var rpm=_mntNum(r.rpm,NaN), tq=_mntNum(r.torque,NaN), pw=_mntNum(r.power,NaN);
      if(!Number.isFinite(rpm)) return;
      if(Number.isFinite(tq) && (!bt || tq>bt.v)) bt={ v:tq, rpm:rpm };
      if(Number.isFinite(pw) && (!bp || pw>bp.v)) bp={ v:pw, rpm:rpm };
    });
    if(bt && bt.v>0){ v.Te=bt.v; v.TeRpm=bt.rpm; }
    if(bp && bp.v>0){ v.Pmax=Math.round(bp.v*10)/10; v.PmaxRpm=bp.rpm; }
    var idle=_mntNum((ed.motorSpecs||{}).idleRpm, NaN); if(idle>0) v.idleRpm=idle;
  }
  if(tc){
    var cd=tc.data||{}, C=Array.isArray(cd.tcData) && cd.tcData.length ? cd.tcData : null;
    if(!C){
      var TP=_mntOrtakGlobal('VE_FT_TC_PRESETS'), tk=typeof veResolveTCPresetKey==='function' ? veResolveTCPresetKey(tc) : '';
      if(TP && tk && TP[tk]) C=TP[tk].data;
    }
    var s0=(C||[]).filter(function(x){ return _mntNum(x.sr,NaN)===0; })[0];
    if(s0 && _mntNum(s0.tau,0)>0) v.Rstall=_mntNum(s0.tau);
  }
  if(gb){
    var gd=gb.data||{}, gs=Array.isArray(gd.ftGearData) ? gd.ftGearData : [];
    var ileri=gs.filter(function(g){ return g && g.name && String(g.name).charAt(0)!=='R'; }).map(function(g){ return _mntNum(g.ratio,NaN); })
      .filter(function(x){ return Number.isFinite(x) && x!==0; });
    if(ileri.length){
      _MNT_VITES_ALAN.forEach(function(k, i){ v[k]=i<ileri.length ? ileri[i] : null; });
      if(ileri.length>_MNT_VITES_ALAN.length) not.push((ileri.length-_MNT_VITES_ALAN.length)+' üst vites aktarılmadı');
    }
    var r=gs.filter(function(g){ return g && g.name && String(g.name).charAt(0)==='R'; })[0], gR=r ? _mntNum(r.ratio,NaN) : NaN;
    if(!Number.isFinite(gR) || gR===0){
      var GP=_mntOrtakGlobal('VE_GEARBOX_PRESETS'), gk=typeof veResolveGearboxPresetKey==='function' ? veResolveGearboxPresetKey(gb) : '';
      var pr=GP && gk && GP[gk] ? (GP[gk].gears||[]).filter(function(g){ return String(g.gear).charAt(0)==='R'; })[0] : null;
      gR=pr ? _mntNum(pr.ratio,NaN) : NaN;
    }
    if(Number.isFinite(gR) && gR!==0) v.gR=gR>0 ? -gR : gR;
  }
  if(tr){
    var ks=(tr.data||{}).ftTrGears, enb=null;
    (Array.isArray(ks) ? ks : []).forEach(function(k){
      var o=_mntNum(k.ratio!=null ? k.ratio : k.oran, NaN);
      if(o>0 && (!enb || o>enb.o)) enb={ o:o, ad:k.kademe||k.mode||'' };
    });
    if(enb){ v.iTransfer=enb.o; v._kademe=enb.ad; }
  }
  var alanlar=Object.keys(v).filter(function(k){ return k.charAt(0)!=='_' && v[k]!==null; });
  return alanlar.length ? { ad:M.ad, v:v, alanlar:alanlar, not:not } : null;
}
var _MNT_AP_HEDEF = { Te:'mnt-motor', TeRpm:'mnt-motor', Pmax:'mnt-motor', PmaxRpm:'mnt-motor', idleRpm:'mnt-motor',
  Rstall:'mnt-gearbox', g1:'mnt-gearbox', g2:'mnt-gearbox', g3:'mnt-gearbox', g4:'mnt-gearbox', g5:'mnt-gearbox',
  g6:'mnt-gearbox', g7:'mnt-gearbox', gR:'mnt-gearbox', iTransfer:'mnt-transfer' };
var _MNT_AP_BAG = { Te:'enginePreset', Rstall:'tcPreset', g1:'gearPreset', iTransfer:'trPreset' };
// Takoz'daki değerin Araç Performans'ınkiyle farkı: { ayni, farkli:[alan] }
function _mntApSapma(Z){
  var K=_mntGatherTorqueKaynakli().kaynak, ayni=0, farkli=[];
  Object.keys(_MNT_AP_HEDEF).forEach(function(k){
    if(Z.v[k]===undefined) return;
    var n=_mntApHedef(k, K), x=n && n.data ? n.data[k] : undefined;
    var a=_mntBos(x) ? null : _mntNum(x, NaN), b=Z.v[k];
    if(b===null ? a===null : (Number.isFinite(a) && Math.abs(a-b)<=1e-9*Math.max(1, Math.abs(b)))) ayni++;
    else farkli.push(k);
  });
  return { ayni:ayni, farkli:farkli };
}
function _mntApHedef(k, K){
  if(K[k]) return K[k];
  var tip=_MNT_AP_HEDEF[k], L=(typeof nodes!=='undefined' && Array.isArray(nodes)) ? nodes : [];
  var n=L.filter(function(x){ return x && x.type===tip; })[0];
  if(!n && tip==='mnt-transfer') n=L.filter(function(x){ return x && x.type==='mnt-gearbox'; })[0];
  return n || null;
}
function veMntApDoldur(solverId){
  var Z=_mntApZinciri(); if(!Z) return 0;
  var K=_mntGatherTorqueKaynakli().kaynak, yaz=[], atla=[];
  Object.keys(_MNT_AP_HEDEF).forEach(function(k){
    if(Z.v[k]===undefined) return;
    var n=_mntApHedef(k, K);
    if(!n){ if(Z.v[k]!==null) atla.push(k); return; }
    yaz.push({ n:n, k:k, v:Z.v[k] });
  });
  if(!yaz.length){ if(typeof showToast==='function') showToast('Takoz modelinde motor ve şanzıman yok.', 'warning'); return 0; }
  yaz.forEach(function(w){
    if(!w.n.data) w.n.data={};
    if(w.v===null) delete w.n.data[w.k]; else w.n.data[w.k]=w.v;
    if(_MNT_AP_BAG[w.k]) delete w.n.data[_MNT_AP_BAG[w.k]];
  });
  if(typeof saveState==='function') saveState();
  var sayi=yaz.filter(function(w){ return w.v!==null; }).length;
  if(atla.length && typeof showToast==='function') showToast(atla.length+' tork alanı aktarılmadı: gövdesi yok.', 'warning');
  var cz=(typeof nodes!=='undefined' ? nodes : []).filter(function(n){ return n && n.id===solverId; })[0];
  if(cz && typeof showNodeProperties==='function') showNodeProperties(cz);
  return sayi;
}
function _mntCozucuApGovde(node){
  var Z=_mntApZinciri(); if(!Z) return '';
  var S=_mntApSapma(Z), v=Z.v;
  var f=_mntFoyAc([{ b:'Halka', gen:'50%' }, { b:'Araç Performans', gen:'50%', sinif:'cz ay' }], 'Araç Performans');
  var sat=function(ad, x, d, birim){ return '<tr><td>'+ad+'</td>'+_mntFoyCoz(x==null ? '—' : _mntS(x, d)+(birim ? ' '+birim : ''), { ay:true })+'</tr>'; };
  f+=sat('Tepe tork', v.Te, 0, 'N·m')+sat('Stall oranı', v.Rstall, 2)+sat('1. vites', v.g1, 2)+sat('Geri', v.gR, 2)
    + sat('Transfer oranı'+(v._kademe ? ' · '+_mntEsc(v._kademe) : ''), v.iTransfer, 3)+sat('Rölanti', v.idleRpm, 0, 'd/dk');
  var not=S.farkli.length
    ? _mntNot('<b>Takoz’daki değerler farklı:</b> '+S.farkli.join(', '), 'warn')
    : _mntNot('Tork zinciri <b>'+_mntEsc(Z.ad)+'</b> modeliyle birebir ('+S.ayni+'/'+S.ayni+')', 'ok');
  if(Z.not.length) not+=_mntNot(Z.not.join(' · '), 'warn');
  var btn='<button type="button" class="ve-fp-dugme" id="ve-mnt-apdoldur-'+node.id+'"'
    + (S.farkli.length ? ' onclick="veMntApDoldur(\''+node.id+'\')"' : ' aria-disabled="true" title="Değerler aynı."')+'>'
    + veIkon('download')+' Araç Performans’tan doldur</button>';
  return _mntBolum('Tork zinciri', _mntEsc(Z.ad), f+_MNT_FOY_KAPA+not+'<div class="ve-fp-eylem">'+btn+'</div>',
                   { id:'ve-mnt-cap-'+node.id, tazele:true });
}
// KALDIRIM DARBESİ — yük kitabının girdisi (_mntYonAyari); kitap hemen altında
// değeri izler. Varsayılan seçim alan yazmaz. İleri yön ve tork yönü kendiliğinden
// (Canlı Not 121 — yukarıda F048): Araç ekseni bölümü yok, künyesi yük kitabında.
function _mntCozucuYonGovde(node){
  var Y=_mntYonAyari(node.data, _mntIleriOnerisi(), _mntTorkOnerisi());
  var secici=function(alan, etiket, deger, secenekler, degis){
    var h='<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">'+etiket+'</span>'
      + '<select class="ve-fp-sel" id="ve-mnt-'+alan+'-'+node.id+'" data-mnt-izle onchange="'+degis+'">';
    secenekler.forEach(function(o){ h+='<option value="'+o[0]+'"'+(deger===o[0] ? ' selected' : '')+'>'+o[1]+'</option>'; });
    return h+'</select></label>';
  };
  return _mntBolum('Kaldırım darbesi', 'yanal',
      _mntIzgara(2,
        _mntVarsayilanAlan(node, 'kaldirimG', 'İvme <u>[g]</u>', MNT_KALDIRIM_G, 'genel araç yük kitabı',
          'veMntSetYon(\''+node.id+'\',\'kaldirimG\',this.value)')
      + secici('kaldirimYon', 'Yön', Y.kaldirimYon, [['ters','Virajın tersi'], ['ayni','Virajla aynı']],
          'veMntSetYon(\''+node.id+'\',\'kaldirimYon\',this.value)')));
}

function _mntCozucuAyarGovde(node){
  var d=node.data||{}, sm=d.solveMode||'auto';
  var sel='<select class="ve-fp-sel" id="ve-mnt-solveMode-'+node.id+'" onchange="veMntSetSolveMode(\''+node.id+'\',this.value)">';
  [['auto','Otomatik'],
   ['nonlinear','Nonlineer (Newton)'],
   ['linear','Lineer (statik rijitlik)']
  ].forEach(function(o){ sel+='<option value="'+o[0]+'"'+(sm===o[0]?' selected':'')+'>'+o[1]+'</option>'; });
  sel+='</select>';
  var h=_mntBolum('Yöntem', '',
      _mntIzgara(1, '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Çözüm modu</span>'+sel+'</label>')
    + '<div id="ve-mnt-egriyok-'+node.id+'" data-tazele>'
    + (_mntEgriYok(node) ? _mntNot('Nonlineer seçili, eğri yok: lineer çözülür.', 'warn') : '')
    + '</div>'
    + _mntIzgara(1, _mntVarsayilanAlan(node, 'zeta', 'Sönüm oranı '+_mntSym('ζ')+' · tüm montaj', _mntZetaDefault(),
        'şirket kabulü', 'veMntSetZeta(\''+node.id+'\',this.value)')));
  h+=_mntBolum('Şok darbesi', 'yarım sinüs',
      _mntIzgara(2,
        _mntVarsayilanAlan(node, 'shockG', 'Tepe ivme <u>[g]</u>', MNT_SHOCK_G, 'AMC tedarikçi raporlarının darbesi',
          'veMntSetShock(\''+node.id+'\',\'shockG\',this.value)')
      + _mntVarsayilanAlan(node, 'shockMs', 'Süre <u>[ms]</u>', MNT_SHOCK_MS, 'AMC tedarikçi raporlarının darbesi',
          'veMntSetShock(\''+node.id+'\',\'shockMs\',this.value)')));
  return h;
}

// Kategori durumları — girdiden: ön denetim (çekirdeğin validateModel'i) ve
// yöntem seçimi. Son hesabın durumu bantta değil, eylemin notunda.
function _mntCozucuDurumlari(node){
  var out={}, d=node.data||{};
  var p=_mntOnDenetim(node);
  if(p.length) out.dur=_mntDurum('eksik', 'çözülemez', p[0]+(p.length>1 ? ' (+'+(p.length-1)+')' : '')+' — Hesapla bu modeli reddeder.');
  else {
    var C=(typeof veMountCore!=='undefined') ? veMountCore : null;
    out.dur=_mntDurum('ok', ((C && C.mmToM) ? _mntToSI(_mntGatherForSolver(node), 9.81).loadCases.length : 0)+' durum');
  }
  out.ayar=_mntEgriYok(node) ? _mntDurum('eksik', 'eğri yok', 'Nonlineer seçili, eğri yok: lineer çözülür.')
    : _mntDurum('ok', (!_mntBos(d.zeta) || !_mntBos(d.shockG) || !_mntBos(d.shockMs) || (d.solveMode && d.solveMode!=='auto')) ? 'elle' : 'varsayılan');
  return out;
}

function getMntSolverPropertiesHTML(node){
  if(!node.data) node.data={};
  if(!node.data.matrixMode) node.data.matrixMode='delta';
  if(!node.data.solveMode) node.data.solveMode='auto';
  var D=_mntCozucuDurumlari(node);
  var kategoriler=[
    { k:'dur', ad:'Yük durumları', govde:_mntCozucuDurumGovde(node), durum:D.dur },
    { k:'ayar', ad:'Ayarlar', govde:_mntCozucuAyarGovde(node), durum:D.ayar }
  ];
  // Sağ sütun FEAD'in sırasıyla: pencerenin cevabı (ön denetim) → eylem →
  // eylemin notu (son hesabın hazırlığı). Uygunluk yok — sonuç raporda.
  var yan=_mntOnDenetimHTML(node)
    + vePencereEylem('<button type="button" class="ve-fp-solve" id="ve-mnt-hesapla-'+node.id+'" onclick="veMntSolverCompute(\''+node.id+'\')">'
        + veIkon('play')+' Hesapla</button>',
      '<div class="ve-fp-solve-not" id="ve-mnt-cnot-'+node.id+'" data-tazele data-cozum-durumu>'+_mntEsc(_mntCozucuNotu(node, veMntSonucDurumu()))+'</div>');
  return _mntPencereKabuk(node, kategoriler, yan);
}

// ════════════════════════════════════════════════════════════════════════════
//  RAPOR PENCERESİ — çözümün durumu, §8.8'in girdileri ve KAYNAĞI, eylem
// ════════════════════════════════════════════════════════════════════════════
// Pencere bir şey GİRDİRMEZ: rölanti ve silindir Motor'un, ζ Çözücü'nün
// özelliğidir (aynı sayının iki yerde girilip ayrışması bir hata kaynağıydı).
// Pencere rapora gidecek değeri ve nereden geldiğini gösterir. SONUÇ YOK
// (kullanıcı kararı 2026-10-16): uygunluk satırları (veMntUygunluk) ve mod
// sayısı kalktı — sonuç raporun kendisinde. Pencerede çözümle değişen tek şey
// raporun hazırlığıdır (`data-cozum-durumu`): çözüm var mı, güncel mi, hangi
// modelden (bileşen · takoz · yük durumu sayısı, çözüm yolu).
// Rapor üreteci cp-mount-report.js'te kaldı; pencere öteki Takoz
// pencereleriyle aynı dilde olsun diye buraya taşındı.
function getMntReportPropertiesHTML(node){
  if(!node.data) node.data={};
  var R=(typeof _veMntLast!=='undefined') ? _veMntLast : null;
  var cozuldu=!!(R && !R.error);
  var S=veMntSonucDurumu();
  var bayat=cozuldu && S.durum==='bayat';
  var nC=0, nM=0, nD=0;
  if(cozuldu){
    nC=((R.gather||{}).components||[]).length; nM=(R.mounts||[]).length;
    nD=(R.allCases||[]).length;
  }
  var ozet=nC+' bileşen · '+nM+' takoz'+(nD ? ' · '+nD+' yük durumu' : '');
  // PENCERENİN CEVABI — FEAD'in Rapor penceresi gibi sağ sütunda, eylemin
  // üstünde (`.ve-fp-durum`). Eskiden tek bölmenin başında bir kutuydu.
  var durum = '<div id="ve-mnt-rap-coz-'+node.id+'" data-tazele data-cozum-durumu>'+(!cozuldu
    ? _mntDurumKutu('<b>Model çözülmedi.</b> '+veYon('Çözücü penceresinde Hesapla ile çözün.'), 'warn')
    : bayat
      ? _mntDurumKutu('<b>Model son hesaptan sonra değişti</b> — '+ozet+'. '+veYon('Çözücü penceresinde Hesapla ile yeniden çözün.'), 'warn')
      : _mntDurumKutu('<b>Model çözüldü</b> — '+ozet+'.', 'ok'))+'</div>';
  // İKİ KATEGORİ (FEAD: Tür · Künye): İÇERİK (raporun hangi çözümden
  // üretileceği — hazırlık, sonuç değil) · GİRDİLER (§8.8'in değerleri ve
  // kaynağı, canlı modelden). İçerik çözümden okur ve yerinde tazelenir
  // (`data-tazele`) — pencere açıkken gelen çözüm onu bayat bırakmasın.
  var icerik=_mntBolum('Çözüm', cozuldu ? (S.durum==='guncel' ? 'güncel' : 'son çözüm') : '',
      cozuldu
        ? _mntIzgara(3, _mntOku('Bileşen', String(nC)) + _mntOku('Takoz', String(nM)) + _mntOku('Yük durumu', String(nD)))
          + _mntIzgara(1, _mntOku('Çözüm yolu', _mntCozumModuEtiketi(R)))
        : _mntNot('Hesaplanmadı.', ''),
      { id:'ve-mnt-rap-ic-'+node.id, tazele:true, cozum:true });
  // Eylemin notu FEAD Rapor'unun satırı (`.ve-fp-durum-not`, kutusuz):
  // yalnız üretimin durumu (veMntGenerateReport → data-d) — çözümün durumu
  // hemen üstteki cevapta, ikinci kez yazılmaz.
  var eylem=vePencereEylem('<button type="button" class="ve-fp-solve" data-cozum-durumu'
      + (cozuldu ? ' onclick="veMntGenerateReport(\''+node.id+'\')"' : ' disabled aria-describedby="ve-mnt-rap-coz-'+node.id+'"')+'>'
      + veIkon('download')+' Raporu oluştur ve indir</button>',
    '<div class="ve-fp-durum-not" id="ve-mnt-report-status" data-cozum-durumu></div>');
  return _mntPencereKabuk(node, [{ k:'ic', ad:'İçerik', govde:icerik },
                                 { k:'gir', ad:'Girdiler', govde:_mntRaporFrekansHTML(node) }],
                          durum+eylem);
}
// §8.8'in girdileri — değer, KAYNAK ve türetilen ateşleme frekansı. Kaynak
// raporun kendi seçicisinden (_mntRepEngine/_mntRepZeta): Motor'da yoksa eski
// projenin Rapor düğümündeki yedek değere düşer ve pencere bunu SÖYLER.
// §8.8'İN GİRDİLERİ — CANLI modelden: Motor'un rölanti devri ve silindir
// sayısı, Çözücü'nün ζ'sı (girilmemişse varsayılan). Rapor aynı değerleri
// çözümün kendi girdisinden okur (R.gather · R.zeta); model hesaptan sonra
// değiştiyse durum kutusu "bayat" der. Eskiden bu bölüm de çözümden okuyordu:
// hesaplanmamış modelde Motor'a girilmiş rölanti "girilmedi" görünüyordu ve
// bölüm çözümle değişiyordu (2026-10-16: pencere çözümden bağımsız).
function _mntRaporFrekansHTML(node){
  var tq=_mntGatherTorque() || {};
  var cozucu=(typeof nodes!=='undefined' && Array.isArray(nodes))
    ? nodes.filter(function(n){ return n && (_mntDef(n)||{}).isMountSolver; })[0] : null;
  var zElle=!!(cozucu && cozucu.data && !_mntBos(cozucu.data.zeta));
  var Rc={ gather:{ torque:tq }, zeta:zElle ? _mntZetaOf(cozucu) : NaN };
  var eng=(typeof _mntRepEngine==='function') ? _mntRepEngine(Rc, node.data) : { idleRpm:NaN, cylinders:NaN };
  var zt=(typeof _mntRepZeta==='function') ? _mntRepZeta(Rc, node.data) : _mntZetaOf(cozucu);
  var gec=function(v){ v=Number(v); return Number.isFinite(v) && v>0; };
  var kaynak=function(k){ return gec(tq[k]) ? 'Motor' : (gec(node.data[k]) ? 'Rapor (eski)' : '—'); };
  var zKaynak=zElle ? 'Çözücü'
    : (Number.isFinite(Number(node.data.zeta)) && !_mntBos(node.data.zeta)) ? 'Rapor (eski)' : 'varsayılan';
  // Sondaki sıfır kırpılır (raporun _rF'i gibi): "0,02" · "30 Hz".
  var kirp=function(v, d){ return (typeof v==='number' && isFinite(v)) ? veSayi(+v.toFixed(d), null, { eksi:'−' }) : '—'; };   // makine: yuvarlama, yazan veSayi
  var deger=function(v, d, birim){
    return gec(v) ? '<td>'+kirp(Number(v), d)+(birim ? ' '+birim : '')+'</td>' : '<td class="eks">girilmedi</td>';
  };
  var fAtes=(gec(eng.idleRpm) && gec(eng.cylinders)) ? (eng.idleRpm/60)*(eng.cylinders/2) : NaN;
  var h=_mntFoyAc([{ b:'Büyüklük', gen:'42%' }, { b:'Değer', gen:'28%' }, { b:'Kaynak', gen:'30%', sinif:'sol' }],
                  'Frekans yerleşimi ve izolasyon girdileri');
  h+='<tr><td>Rölanti devri</td>'+deger(eng.idleRpm, 0, 'd/dk')+'<td class="sol">'+kaynak('idleRpm')+'</td></tr>';
  h+='<tr><td>Silindir sayısı</td>'+deger(eng.cylinders, 0, '')+'<td class="sol">'+kaynak('cylinders')+'</td></tr>';
  h+='<tr><td>Sönüm oranı '+_mntSym('ζ')+'</td><td>'+kirp(zt, 3)+'</td><td class="sol">'+zKaynak+'</td></tr>';
  h+='<tr class="top"><td>f<sub>ateş</sub> = (N/60)·(z/2)</td>'
    + _mntFoyCoz(Number.isFinite(fAtes) ? kirp(fAtes, 1)+' Hz' : '—')+'<td class="sol sf">türetilen</td></tr>';
  h+=_MNT_FOY_KAPA;
  if(!Number.isFinite(fAtes)) h+=_mntNot('Ateşleme frekansı yok (rölanti · silindir): §8.8 atlanır.', 'warn');
  return _mntBolum('Frekans yerleşimi ve izolasyon', 'rapor §8.8', h, { id:'ve-mnt-rap-gir-'+node.id, tazele:true });
}

// Şok darbesi girdisi (tepe ivme [g] / süre [ms]). Boş/geçersiz → alan silinir
// ve varsayılan kullanılır. Yeniden çizme YOK — sonuç korunur; değer bir
// sonraki ▶ Hesapla'da uygulanır (ζ ve çözüm modu ile aynı davranış).
function veMntSetShock(nodeId, key, val){
  if(key!=='shockG' && key!=='shockMs') return;
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  var s=(typeof val==='string')?val.trim():val;
  var v=_mntNum(s, NaN);
  if(s===''||s==null||!Number.isFinite(v)||!(v>0)) delete node.data[key];
  else node.data[key]=v;
  if(typeof saveState==='function') saveState();
}

// Aracın ileri yönü, tork momentinin yönü ('-x' varsayılan · '+x'), kaldırım
// darbesinin ivmesi [g] (boş/geçersiz → varsayılan) ve yönü ('ters' varsayılan
// · 'ayni'). Varsayılan değer alan yazmaz; değer bir sonraki ▶ Hesapla'da
// uygulanır, yük kitabı hemen tazelenir.
function veMntSetYon(nodeId, key, val){
  if(key!=='ileri' && key!=='torkYon' && key!=='kaldirimG' && key!=='kaldirimYon') return;
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  if(key==='ileri'){
    // Seçim ONAYDIR: iki değer de yazılır (onaysız yön dizilişin önerisi).
    if(val!=='+x' && val!=='-x') return;
    node.data.ileri=val;
  } else if(key==='torkYon'){
    if(val==='+x') node.data[key]='+x'; else delete node.data[key];
  } else if(key==='kaldirimYon'){
    if(val==='ayni') node.data.kaldirimYon='ayni'; else delete node.data.kaldirimYon;
  } else {
    var s=(typeof val==='string')?val.trim():val;
    var v=_mntNum(s, NaN);
    if(s===''||s==null||!Number.isFinite(v)||!(v>0)) delete node.data.kaldirimG;
    else node.data.kaldirimG=v;
  }
  if(typeof saveState==='function') saveState();
}


// Transfer Kutusu'nun çıkış dönüşü ('ayni' varsayılan · 'ters') — tork yönü
// ondan türer (F049). Varsayılan seçim de YAZILIR: yazılı dönüş projedeki eski
// tork yönünün önüne geçer (seçim bir karardır).
function veMntSetDonus(nodeId, val){
  if(val!=='ayni' && val!=='ters') return;
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data.donus=val;
  if(typeof saveState==='function') saveState();
}

// Çözüm modu seç (auto/nonlinear/linear). Yeniden çizme YOK — sonuç korunur;
// seçim bir sonraki ▶ Hesapla'da uygulanır (hesap butona kilitli).
function veMntSetSolveMode(nodeId, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data.solveMode=(val==='linear'||val==='nonlinear')?val:'auto';
  if(typeof saveState==='function') saveState();
}

// Sönüm oranı ζ (0 < ζ < 1). Boş/geçersiz → alan silinir, çözümde varsayılan
// (MNT_DEFAULT_ZETA) kullanılır. Yeniden çizme YOK — sonuç korunur; değer bir
// sonraki ▶ Hesapla'da uygulanır (çözüm modu ile aynı davranış).
function veMntSetZeta(nodeId, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  var s=(typeof val==='string')?val.trim():val;
  if(s===''||s==null){ delete node.data.zeta; }
  else {
    var z=_mntNum(s, NaN);
    if(Number.isFinite(z) && z>=0 && z<1) node.data.zeta=z;
  }
  if(typeof saveState==='function') saveState();
}

// ─── Çözüm hazırlığı (SYNC, DOM'suz) — gather→SI→mod→model + tek-durum çözücüsü ───
// Hem sync _mntComputeResults hem async (progress'li) veMntSolverCompute bunu kullanır;
// böylece iki yol da AYNI çözüm mantığını paylaşır. Dönüş: null (çözücü yok) |
// {error,gather} (validasyon) | prep nesnesi (solveOne/solveModes fonksiyonlarıyla).
function _mntPrepareSolve(solverId){
  var solver=nodes.find(function(n){return n.id===solverId;}); if(!solver) return null;
  return _mntPrepareFrom(_mntGatherForSolver(solver), solver);
}
// Toplanmış modelden çözüme hazırlık. `solver` Çözücü düğümüdür; sihirbazın
// canlı önizlemesi çözücü KURMADAN çözer ve yerine `{data:{}}` verir — çözüm
// modu ve ζ o zaman Çözücü'nün varsayılanları (auto · çekirdeğin ζ'sı). Ayrı
// bir "önizleme çözücüsü" yazılmadı: sihirbazın gösterdiği sehim, kurulan
// modelde Çözücü'nün bulacağı sehimin TA KENDİSİ olmalı.
function _mntPrepareFrom(gather, solver){
  solver=solver||{data:{}};
  var C=veMountCore;
  var si=_mntToSI(gather, 9.81);
  var problems=C.validateModel(si.components, si.mounts);
  if(problems.length) return { error:problems, gather:gather };
  var mp=C.combineMassProps(si.components);
  if(!mp) return { error:['Kütle hesaplanamadı (toplam ≤ 0).'], gather:gather };
  // Çözüm Modu: linear → nonlineer yasaları sıyır (saf lineer); nonlinear/auto → kullan.
  // HEM nokta tablosu (curves) HEM analitik fit (fits) sıyrılmalıdır: çekirdeğin
  // mountHasCurve'ü ikisine de bakar. Yalnız curves atılırsa, analitik fit taşıyan
  // takozda kullanıcı "Lineer" seçse bile solvedNL true kalır ve modal/enerji
  // bölümleri tanjant rijitlikten üretilir — yani seçilmeyen model raporlanır.
  var mode=(solver.data && solver.data.solveMode) || 'auto';
  var mounts=si.mounts;
  if(mode==='linear'){
    mounts=si.mounts.map(function(m){
      if(!m.curves && !m.fits) return m;
      var c={}; Object.keys(m).forEach(function(k){ if(k!=='curves' && k!=='fits') c[k]=m[k]; }); return c;
    });
  }
  var solvedNL=(typeof C.anyCurve==='function') && C.anyCurve(mounts);   // fiilen nonlineer mi
  var Kstat=C.buildK(mounts,mp.cg,false);
  var prep={
    C:C, solver:solver, gather:gather, si:si, mp:mp, mode:mode, mounts:mounts,
    solvedNL:solvedNL, nlNoCurve:(mode==='nonlinear' && !solvedNL),
    zeta:_mntZetaOf(solver),               // şirket kabulü — tüm montaja tek değer
    loadCases:si.loadCases, gearDefs:_mntGearTorqueCases(gather.torque, gather.yon),
    designDefs:[ {name:'3,5g Düşey',       n:[ 0,0,-3.5], T:[0,0,0]},
                 {name:'1g Yanal',         n:[ 0,1,-1  ], T:[0,0,0]},
                 {name:'1g Boyuna (fren)', n:[-1,0,-1  ], T:[0,0,0]} ].map(function(c){
                   return { name:c.name, n:_mntYonN(c.n, gather.yon), T:c.T }; })
  };
  // Tek yük durumu çözücüsü — solveAllCases yönlendirmesiyle AYNI: solvedNL → Newton
  // (solveCaseNL), değilse metal-metal durdurucu (solveCaseStop). onIter (ops.) yalnız
  // nonlineer yolda anlamlı: her Newton adımının residual normunu bildirir (progress).
  prep.solveOne=function(lc, onIter){
    var res = solvedNL
      ? C.solveCaseNL(mounts, mp.cg, mp.m, si.g, lc, {useStop:true, onIter:onIter})
      : C.solveCaseStop(Kstat, mounts, mp.cg, mp.m, si.g, lc, {useStop:true});
    return res ? {name:lc.name, loadCase:lc, res:res}
               : {name:lc.name, loadCase:lc, res:null, error:'K matrisi tekil (kinematik serbestlik olabilir).'};
  };
  // Modal — nonlineerde statik dengedeki (Static) tanjant rijitlik; değilse K_dyn.
  // Modal çözüm. Kullanılan M6 ve K matrisi prep'e SAKLANIR: modal enerji
  // (genelleştirilmiş kütle/rijitlik) ve mod başına sönüm oranı, modları üreten
  // AYNI matrislerden hesaplanmalı — yoksa k_gen/m_gen = ω² özdeşliği bozulur.
  prep.solveModes=function(allCases){
    var M6=C.buildM6(mp.m, mp.I_G);
    prep.M6=M6;
    if(solvedNL){
      var qStat=(allCases[0] && allCases[0].res) ? allCases[0].res.q : null;
      prep.Kmodal=C.buildKtangentDyn(mounts, mp.cg, qStat);
      // Sönüm de AYNI tabandan: c = 2ζ√(k·m) içindeki k, modal frekansı üreten
      // dinamik tanjant olmalı. Nominal k_dyn kullanılırsa sertleşen takozda
      // ζ_mod = φᵀCφ/(2ωφᵀMφ) sistematik olarak kayar (√(k_dyn/k_tan) kadar).
      prep.kBasis=(typeof C.mountTangentKdyn==='function') ? C.mountTangentKdyn(mounts, mp.cg, qStat) : null;
    } else {
      prep.Kmodal=C.buildK(mounts, mp.cg, true);
      prep.kBasis=null;                        // lineerde tanjant == nominal k_dyn
    }
    return C.solveModal(prep.Kmodal, M6, mounts, mp.cg);
  };
  return prep;
}

// prep + çözülmüş durumlar → R (ve _veMntLast). Sync ve async yol AYNI R'yi üretir.
function _mntAssembleR(prep, allCases, modes, gearCases, designCases){
  var R={ mp:prep.mp, allCases:allCases, mounts:prep.mounts, modes:modes, gather:prep.gather,
          gearCases:gearCases, designCases:designCases, g:prep.si.g,
          // Şok darbesi girdisi Çözücü'de yaşar, Sonuçlar'daki geçici rejim
          // kanalları (js/mount-signals.js) onu buradan okur. Yük durumlarına
          // ve modal çözüme GİRMEZ.
          shock:{ aG:_mntNum((prep.solver.data||{}).shockG, MNT_SHOCK_G),
                  ms:_mntNum((prep.solver.data||{}).shockMs, MNT_SHOCK_MS) },
          matrixMode:((prep.solver.data&&prep.solver.data.matrixMode)||'delta'), solveMode:prep.mode,
          solvedNL:prep.solvedNL, nlNoCurve:prep.nlNoCurve, solverId:prep.solver.id,
          zeta:prep.zeta,
          // Aracın ileri yönü ve kaldırım darbesi (Sonuçlar'ın ivme süpürmesi okur)
          yon:prep.gather.yon || _mntYonAyari(),
          // Çözümün HANGİ modele ait olduğu (veMntSonucDurumu). Hazırlık
          // anının girdisi: hesap sürerken yapılan düzenleme sonucu bayatlatır.
          ileriOnay:prep.gather.ileriOnay, ileriKaynak:prep.gather.ileriKaynak, torkKaynak:prep.gather.torkKaynak, donus:prep.gather.donus,
          imza:_mntImza(prep.si, prep.gather.torque, prep.solver.data, prep.gather.baglanti, prep.gather.yon) };
  // ── Bağlantı yüzünde statik eğilme momenti (2026-11-06) — torksuz her durumda
  // (çekirdek sectionMoment); hüküm raporda, Statik durumda sınıra göre
  R.baglanti=_mntBaglantiMomenti(prep, allCases, designCases);
  // ── Takoz sönüm katsayıları — TEK ζ'den türetilir (çekirdek mountDamping).
  // Yük payı STATİK durumdan alınır; Static çözülemediyse damping null kalır
  // (yük payı bilinmeden c türetilemez — uydurma değer üretilmez).
  var C=prep.C, stat=null;
  for(var i=0;i<(allCases||[]).length;i++){ if(allCases[i] && allCases[i].name==='Static'){ stat=allCases[i]; break; } }
  R.loadShares = (stat && stat.res && C.mountLoadShares) ? C.mountLoadShares(stat.res, prep.si.g) : null;
  R.damping    = (R.loadShares && C.mountDamping) ? C.mountDamping(prep.mounts, R.loadShares, prep.zeta, prep.kBasis) : null;
  R.kBasisTangent = !!prep.kBasis;                         // rapor notu: c hangi k'den türedi
  R.kBasis     = prep.kBasis || null;                      // takoz başına dinamik tanjant [kx,ky,kz]
  // Statik denge — geçici rejimin (şok) etrafında çözüldüğü çalışma noktası.
  // Nonlineer yasada süperpozisyon geçmediği için kuvvet TOPLAM sehimde
  // okunmalı; ±15 mm durdurucu boşluğu da yüksüz konumdan ölçülür.
  R.qStatic    = (stat && stat.res) ? stat.res.q : null;
  R.components = prep.si.components;                       // modal enerji gövde dağılımı için
  // ── Hareket zarfı (2026-11-09) — gövdelerin ve eşdeğer kutularının köşelerinin
  // STATİK konuma göre yer değiştirmesi, yük durumları + vitesler + tasarım durumları
  // (çekirdek motionEnvelope). Static çözülemediyse zarf yok: referans konum bilinmez.
  R.zarf = (R.qStatic && C.motionEnvelope)
    ? C.motionEnvelope(prep.si.components, (allCases||[]).concat(gearCases||[], designCases||[]), prep.mp.cg, R.qStatic)
    : null;
  // ── Sönümlü modal + modal enerji ──────────────────────────────────────────
  // Modları üreten AYNI M6/K ile hesaplanır (prep.solveModes bunları saklar).
  // Farklı bir K kullanılırsa k_gen/m_gen = ω² özdeşliği bozulur ve modal enerji
  // moda ait olmayan bir rijitliği raporlar. Matrisler yoksa (modal çözülmediyse)
  // alanlar null kalır — uydurma sayı üretilmez.
  if(modes && modes.length && prep.M6 && prep.Kmodal){
    if(R.damping && C.buildCdamp && C.modalDampingRatios){
      R.C6 = C.buildCdamp(prep.mounts, prep.mp.cg, R.damping);
      R.modalDamping = C.modalDampingRatios(modes, prep.M6, R.C6);
    }
    if(C.modalEnergy) R.modalEnergy = C.modalEnergy(modes, prep.M6, prep.Kmodal, prep.si.components, prep.mp.cg);
    // Takoz ve eksen başına frekans duyarlılığı — modları üreten AYNI taban
    // (prep.kBasis; lineerde null → k_din). Rapor §8.17 OKUR; bileşen
    // pencereleri sonuç göstermez (kullanıcı kararı 2026-10-16).
    if(C.modalSensitivity) R.sensitivity = C.modalSensitivity(modes, prep.M6, prep.mounts, prep.mp.cg, prep.kBasis);
  }
  // ── Sonuçlar paneli kanalları (js/mount-signals.js) ───────────────────────
  // Süpürmeler ÇÖZÜCÜNÜN kendi yolunu (prep.solveOne) kullanır — nonlineerse
  // Newton, değilse durduruculu lineer. Ayrı bir "gösterim için" çözüm yolu
  // açılmaz: pano ile Rapor aynı fizikten okumalı.
  //
  // Kanal üretimi çözümü BAĞLAMAZ: patlarsa R yine döner, pano yalnız kanalsız
  // kalır. Takoz hesabı raporun ana ürünü; panoya veri hazırlarken kaybedilemez.
  try {
    R.signals = (typeof veMntSignals!=='undefined' && veMntSignals)
      ? veMntSignals.build(R, { solveOne: prep.solveOne }) : [];
  } catch(e) { R.signals=[]; }
  _veMntLast=R;
  if(typeof window!=='undefined') window.veMountResults=R;
  return R;
}

// BAĞLANTI YÜZÜ MOMENTİ — gövdenin bağlantı yüzü (toplayıcının `baglanti`ı)
// varsa torksuz yük durumlarında kesit momenti. Döner: { ad, S (mm), a, sinir
// (N·m | null), satirlar:[{ name, egilme, burulma, m, takoz }] } | null.
// Tork durumu (lc.T ≠ 0) tabloya girmez: torkun kesitteki payı modelde yok.
function _mntBaglantiMomenti(prep, allCases, designCases){
  var B=prep.gather && prep.gather.baglanti, C=prep.C;
  if(!B || !C || !C.sectionMoment) return null;
  var S=B.S.map(function(v){ return C.mmToM(v); }), satirlar=[];
  (allCases||[]).concat(designCases||[]).forEach(function(rc){
    var lc=(rc && rc.loadCase)||{}, T=lc.T||[0,0,0];
    if(Math.abs(T[0])+Math.abs(T[1])+Math.abs(T[2])>0) return;
    var r=rc.res ? C.sectionMoment(prep.si.components, prep.mounts, rc.res, prep.si.g, lc.n, S, B.a) : null;
    satirlar.push({ name:rc.name, egilme:r ? r.egilme : NaN, burulma:r ? r.burulma : NaN, m:r ? r.m : NaN, takoz:r ? r.takoz : 0 });
  });
  return { id:B.id, ad:B.name, S:B.S.slice(), a:B.a.slice(), sinir:B.sinir, satirlar:satirlar };
}

// Hesap çekirdeği — DOM'DAN BAĞIMSIZ, SYNC. _veMntLast'i üretir, döner.
// {error:[...]} (validasyon) | {mp,allCases,mounts,modes,gather,...} | null
// (Canlı ilerleme çubuğu için async sürüm veMntSolverCompute; AYNI R'yi üretir.)
function _mntComputeResults(solverId){
  var prep=_mntPrepareSolve(solverId); if(!prep) return null;
  if(prep.error){ _mntForgetResults(); return { error:prep.error, gather:prep.gather }; }
  var allCases=prep.loadCases.map(function(lc){ return prep.solveOne(lc); });
  var modes=prep.solveModes(allCases);
  var gearCases=prep.gearDefs.length ? prep.gearDefs.map(function(lc){ return prep.solveOne(lc); }) : [];
  var designCases=prep.designDefs.map(function(lc){ return prep.solveOne(lc); });
  return _mntAssembleR(prep, allCases, modes, gearCases, designCases);
}

// ─── İlerleme çubuğu yardımcıları ────────────────────────────────────────────
// Bir sonraki boyamaya bırak (progress bar görünür olsun) + küçük gecikme.
function _mntYield(){
  return new Promise(function(resolve){
    if(typeof requestAnimationFrame==='function') requestAnimationFrame(function(){ setTimeout(resolve, 24); });
    else setTimeout(resolve, 0);
  });
}
// Yük durumu için iterasyon/durum etiketi (progress alt satırı).
function _mntCaseIterLabel(rc, prep){
  if(!rc || !rc.res) return 'çözülemedi';
  var ck=rc.res.checks||{};
  if(prep.solvedNL){
    var it=ck.newtonIters||1;
    return 'Newton '+it+' iter'+((ck.converged===false)?' · yakınsamadı':'');   // düz metin (kaçışlanıyor)
  }
  var nc=(ck.clampCount||0)+(ck.clampYCount||0);
  return 'lineer'+((nc>0)?(' · '+nc+' durdurucu'):'');
}
// İLERLEME EYLEM SATIRINDA (pencere kitinin çubuğu, vePencereIlerleme):
// sayı, çözülen durum ve oran; düğme meşgul (`aria-busy` — çift tık koşan
// hesabı yinelemez). Eskiden düğmenin İÇİNDE bir dolguydu; kompakt düğmede
// yazısıyla birlikte eni değişirdi. total=0 düğmeyi ve satırı bırakır.
function _mntHesaplaIlerleme(btn, done, total, label){
  if(!btn) return;
  var yaz=(typeof vePencereIlerleme==='function') ? vePencereIlerleme : function(){};
  if(total>0){
    btn.setAttribute('aria-busy', 'true');
    yaz(btn, { ad:'Hesap', metin:_mntS(done, 0)+' / '+_mntS(total, 0)+(label ? ' · '+label : ''), oran:done/total });
  } else {
    btn.removeAttribute('aria-busy');
    yaz(btn, null);
  }
}

// Çözücüyü çalıştır. ASYNC: yük durumlarını adım adım çözüp ilerlemeyi (ve
// nonlineerde her durumun Newton iterasyonunu) düğmede gösterir; bitince açık
// pencerenin hazırlık satırları YERİNDE tazelenir (Çözücü'nün notu, Rapor'un
// çözüm durumu) — pencere sonuç göstermez, sonuç raporda.
// Hesap yalnız bu fonksiyonla (Hesapla) koşar.
async function veMntSolverCompute(solverId){
  var btn=(typeof document!=='undefined' && document.getElementById) ? document.getElementById('ve-mnt-hesapla-'+solverId) : null;
  if(btn && btn.getAttribute('aria-busy')==='true') return null;     // çift tık: koşan hesap sürer
  var prep=_mntPrepareSolve(solverId);
  if(!prep){ veMntPencereTazele(); return null; }
  if(prep.error){
    _mntForgetResults(); veMntPencereTazele();
    return { error:prep.error, gather:prep.gather };
  }
  var total=prep.loadCases.length + prep.gearDefs.length + prep.designDefs.length + 1; // +modal
  var done=0, R=null;
  function step(label, sub){ done++; _mntHesaplaIlerleme(btn, done, total, label+(sub ? ' · '+sub : '')); }
  var worst={ iters:0, name:'', trace:null };   // en çok iterasyon yapan durum (residual izi)
  try {
    // 1) Ana yük durumları — nonlineerde her durumun Newton residual izini yakala
    var allCases=[];
    for(var i=0;i<prep.loadCases.length;i++){
      var lc=prep.loadCases[i], trace=[];
      var rc=prep.solveOne(lc, prep.solvedNL ? function(iter, res){ trace.push(res); } : null);
      allCases.push(rc);
      var it=(rc.res && rc.res.checks && rc.res.checks.newtonIters) || 0;
      if(prep.solvedNL && it>worst.iters){ worst={ iters:it, name:lc.name, trace:trace.slice() }; }
      step(lc.name, _mntCaseIterLabel(rc, prep));
      await _mntYield();
    }
    // 2) Vites tork durumları (Kriter 3)
    var gearCases=[];
    for(var gi=0; gi<prep.gearDefs.length; gi++){
      var glc=prep.gearDefs[gi], grc=prep.solveOne(glc);
      gearCases.push(grc); step(glc.name, _mntCaseIterLabel(grc, prep)); await _mntYield();
    }
    // 3) Tasarım yük durumları (Kriter 4)
    var designCases=[];
    for(var di=0; di<prep.designDefs.length; di++){
      var dlc=prep.designDefs[di], drc=prep.solveOne(dlc);
      designCases.push(drc); step(dlc.name, _mntCaseIterLabel(drc, prep)); await _mntYield();
    }
    // 4) Modal analiz
    var modes=prep.solveModes(allCases);
    step('Modal analiz', prep.solvedNL ? 'tanjant rijitlik' : 'K_dyn'); await _mntYield();
    R=_mntAssembleR(prep, allCases, modes, gearCases, designCases);
    R._worstIter=worst;   // Newton yakınsama özeti için
  } finally {
    _mntHesaplaIlerleme(btn, 0, 0, null);
  }
  veMntPencereTazele();
  // Sonuçlar ağacını BURADAN TAZELEMEYİZ — bilerek.
  //
  // veUpdateResultsTree ilk işi olarak veSaveActiveTabStateKeepView'i çağırır;
  // o da veSaveActiveTabState → veMntCollapseToRoot zincirini işletir
  // (js/topology.js:122). Yani "Hesapla"ya basan kullanıcı ALT TOPOLOJİDEyken
  // kanvas köke çökertilir, DOM yeniden kurulur ve az önce tazelenen pencere
  // ekrandan silinir. (KeepView sonradan geri getirir ama araya tam bir
  // serileştir-yükle turu girer — bkz. tests/unit/topology-save-
  // reentrancy.test.js, aynı zincirin daha önce dosya bozduğu yer.)
  //
  // Tazelemeye gerek de yok: kullanıcı Sonuçlar sayfasına geçtiğinde
  // veEnterResults zaten sekmeleri ve ağacı kuruyor (js/tabs.js:56).
  return R;
}

// ─── Render yardımcıları ─────────────────────────────────────────────────────
// (📐 Matematik paneli kaldırıldı — istek üzerine tamamen silindi.)

// ─── Tam ekran overlay (3D / 2D görünümleri büyütmek için) ───────────────────
// Büyük, esnek bir overlay: başlık + kapat (X/Esc) + içerik alanı. onMount(body)
// DOM eklendikten sonra çağrılır; onClose kapanışta.
function _mntFsOverlay(title, innerHTML, onMount, onClose){
  var old=document.getElementById('ve-mnt-fs'); if(old) old.remove();
  var ov=document.createElement('div'); ov.id='ve-mnt-fs';
  ov.style.cssText='position:fixed; inset:0; z-index:100045; background:var(--scrim); display:flex; align-items:center; justify-content:center; padding:2vh 2vw;';
  var box=document.createElement('div');
  box.style.cssText='width:96vw; height:94vh; max-width:1600px; display:flex; flex-direction:column; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-lg); box-shadow:var(--shadow-xl); overflow:hidden;';
  function close(){ document.removeEventListener('keydown', onKey); try{ if(onClose) onClose(); }catch(e){} ov.remove(); }
  function onKey(e){ if(e.key==='Escape') close(); }
  // Pencere ailesinin başlığı (CLAUDE.md → PENCERE AİLESİ TEK); ikon, pencereyi
  // açan "Tam Ekran" eyleminin ikonu. Eskiden kendi 700 kalınlıkta bandı vardı.
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', title);
  box.innerHTML='<div class="ve-settings-header"><span>' + veIkon('maximize') + ' ' + title + '</span><button id="ve-mnt-fs-x" class="ve-settings-close" type="button" title="Kapat (Esc)" aria-label="Kapat">' + veIkon('x') + '</button></div>'
    +'<div id="ve-mnt-fs-body" style="flex:1; min-height:0; position:relative; display:flex; flex-direction:column;">'+innerHTML+'</div>';
  ov.appendChild(box); document.body.appendChild(ov);
  ov.addEventListener('mousedown', function(e){ if(e.target===ov) close(); });
  document.getElementById('ve-mnt-fs-x').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  if(onMount){ try{ onMount(document.getElementById('ve-mnt-fs-body')); }catch(e){} }
}
// Node/Jest için dışa aç
if(typeof module!=='undefined' && module.exports){
  module.exports = {
    _mntAksKatalog: _mntAksKatalog, _mntAksSection: _mntAksSection, veMntAksUygula: veMntAksUygula,
    _MNT_POINTMASS_DEFAULT: _MNT_POINTMASS_DEFAULT,
    getMntModulePropertiesHTML: getMntModulePropertiesHTML,
    getMntReportPropertiesHTML: getMntReportPropertiesHTML,
    _mnt2DPencereVeri: _mnt2DPencereVeri,
    _mntAksoModel: _mntAksoModel,
    veMntAksoOrnekModel: veMntAksoOrnekModel, _mntAksoLejant: _mntAksoLejant, veMntAksoListeVeri: veMntAksoListeVeri,
    _mntAksoKaynak: _mntAksoKaynak,
    veMntAksoCozumModel: veMntAksoCozumModel,
    _mntAksoHTML: _mntAksoHTML,
    _mntAksoKur: _mntAksoKur, _mntAkso3bHizli: _mntAkso3bHizli, _mntAksoOdak: _mntAksoOdak, _mntFoyOdak: _mntFoyOdak, _mntAksoVurguBagla: _mntAksoVurguBagla,
    _mntAksoTamH: _mntAksoTamH, veMntAksoTazele: veMntAksoTazele, veMntAkso3BTamEkran: veMntAkso3BTamEkran,
    _mnt2DFs: _mnt2DFs, _mntFsOverlay: _mntFsOverlay,
    _mntAksoCizim: _mntAksoCizim, _mntAksoGorus: _mntAksoGorus,
    _mntAksoIsaret: _mntAksoIsaret,
    veMnt2DViewRefresh: veMnt2DViewRefresh,
    veMntAksoAyar: veMntAksoAyar,
    VE_MNT_AKSO3B: VE_MNT_AKSO3B, _mntAkso3bDondur: _mntAkso3bDondur, _mntAkso3bYakinlas: _mntAkso3bYakinlas,
    _mntAkso3bOnAci: _mntAkso3bOnAci, _mntAkso3bOnAdi: _mntAkso3bOnAdi, _mntAkso3bOku: _mntAkso3bOku,
    _mntRaporFrekansHTML: _mntRaporFrekansHTML,
    getMntMassPropertiesHTML: getMntMassPropertiesHTML,
    getMntMountPropertiesHTML: getMntMountPropertiesHTML,
    _mntMountCurveNote: _mntMountCurveNote,
    // Pencere dili (2026-10-14): imza, canlı model, kroki, durumlar, tazeleme
    _mntImza: _mntImza,
    veMntSonucDurumu: veMntSonucDurumu,
    veMntProjeModeli: veMntProjeModeli,
    veMntResultState: veMntResultState,
    _mntCanliModel: _mntCanliModel,
    _mntAtalet: _mntAtalet,
    _mntOranYayilim: _mntOranYayilim,
    _MNT_ORAN_YAYILIM_SINIR: _MNT_ORAN_YAYILIM_SINIR,
    _mntKutuphaneEslesme: _mntKutuphaneEslesme, _mntTakozTipGovde: _mntTakozTipGovde,
    _mntGatherTorqueKaynakli: _mntGatherTorqueKaynakli,
    _mntGolgelenen: _mntGolgelenen,
    _mntMotorSapma: _mntMotorSapma,
    _mntTorkZinciri: _mntTorkZinciri,
    _mntKrokiHTML: _mntKrokiHTML,
    veMntEksikGit: veMntEksikGit,
    veMntPencereTazele: veMntPencereTazele, veMntIsaretYaz: veMntIsaretYaz,
    // Pencere ailesi (2026-10-16): FEAD'in not satırı ve cevap kutusu, iki kategori
    _mntNot: _mntNot,
    _mntDurumKutu: _mntDurumKutu,
    _mntKutleCgDurumu: _mntKutleCgDurumu,
    _mntAtaletDurumu: _mntAtaletDurumu,
    _mntKutleDurumu: _mntKutleDurumu,
    _mntMotorDurumu: _mntMotorDurumu,
    _mntVitesDurumu: _mntVitesDurumu,
    // Şanzımanın kataloğu ve bağlantı yüzü (2026-11-06)
    _MNT_VITESLER: _MNT_VITESLER, _mntVsKatalog: _mntVsKatalog, _mntDisliPresetValues: _mntDisliPresetValues, _mntKonvertorListesi: _mntKonvertorListesi, _mntKonvertorEsle: _mntKonvertorEsle, _mntSanzimanAilesi: _mntSanzimanAilesi, _mntKonvertorPresetValues: _mntKonvertorPresetValues,
    veMntApplyGearPreset: veMntApplyGearPreset, veMntApplyTcPreset: veMntApplyTcPreset,
    _mntDisliSapma: _mntDisliSapma, _mntKonvertorSapma: _mntKonvertorSapma, _mntGearboxSection: _mntGearboxSection,
    _mntBaglantiSection: _mntBaglantiSection, _mntBaglantiDurumu: _mntBaglantiDurumu, _mntBagYon: _mntBagYon,
    _mntTahrikDurumu: _mntTahrikDurumu,
    _mntPtoDurumu: _mntPtoDurumu,
    _mntTakozTipDurumu: _mntTakozTipDurumu,
    _mntTakozKonumDurumu: _mntTakozKonumDurumu,
    _mntCozucuDurumlari: _mntCozucuDurumlari,
    _mntOnDenetim: _mntOnDenetim,
    _mntCozumModuEtiketi: _mntCozumModuEtiketi,
    _mntHesaplaIlerleme: _mntHesaplaIlerleme,
    getMntLibraryPropertiesHTML: getMntLibraryPropertiesHTML,
    getMntSolverPropertiesHTML: getMntSolverPropertiesHTML,
    veMntSetSolveMode: veMntSetSolveMode,
    veMntSetZeta: veMntSetZeta,
    _mntZetaDefault: _mntZetaDefault,
    _mntZetaOf: _mntZetaOf,
    veMntApplyEnginePreset: veMntApplyEnginePreset,
    _mntEnginePresetValues: _mntEnginePresetValues,
    _mntEnginePresetSelect: _mntEnginePresetSelect,
    _mntEngineSection: _mntEngineSection,
    _mntComputeResults: _mntComputeResults,
    veMntSolverCompute: veMntSolverCompute,
    _mntForgetResults: _mntForgetResults,
    getMnt2DViewPropertiesHTML: getMnt2DViewPropertiesHTML,
    _mnt2DGather: _mnt2DGather,
    _mnt2DYaziKutu: _mnt2DYaziKutu,
    _mnt2DKesisir: _mnt2DKesisir,
    VE_MOUNT_LIBRARY: VE_MOUNT_LIBRARY,
    veMntGetLibraryMap: veMntGetLibraryMap,
    veMntGetLibraryList: veMntGetLibraryList,
    _mntLibTam: _mntLibTam, _mntLibTahmin: _mntLibTahmin, _mntLibTahminKunye: _mntLibTahminKunye, _mntLibTahminAdi: _mntLibTahminAdi,
    _mntTakozTahmin: _mntTakozTahmin, _mntKutuphaneNotu: _mntKutuphaneNotu, _mntLibSirali: _mntLibSirali,
    _mntLibAmcKunyeHTML: _mntLibAmcKunyeHTML, _mntLibApKunyeHTML: _mntLibApKunyeHTML, veMntLibCizimAc: veMntLibCizimAc,
    veMntApplyLib: veMntApplyLib,
    veMntLibCurveEnable: veMntLibCurveEnable,
    veMntLibCurveDisable: veMntLibCurveDisable,
    veMntLibCurveSetPoint: veMntLibCurveSetPoint,
    veMntLibCurveAddPoint: veMntLibCurveAddPoint,
    veMntLibCurveRemovePoint: veMntLibCurveRemovePoint,
    veMntLibAdd: veMntLibAdd,
    veMntLibRemove: veMntLibRemove,
    veMntLibSet: veMntLibSet,
    veMntLibSetBuiltin: veMntLibSetBuiltin,
    veMntLibResetBuiltin: veMntLibResetBuiltin,
    veMntLibSelect: veMntLibSelect,
    veMntLibDropdownToggle: veMntLibDropdownToggle,
    veMntLibDropdownClose: veMntLibDropdownClose,
    veMntLibFilter: veMntLibFilter,
    veMntLibSearchKey: veMntLibSearchKey,
    _mntLibNorm: _mntLibNorm,
    _mntLibOptionRow: _mntLibOptionRow,
    _mntLibTrigger: _mntLibTrigger,
    _mntLibDropdown: _mntLibDropdown,
    _mntLibSecici: _mntLibSecici, _mntLibGirdileri: _mntLibGirdileri,
    veMntLibMarka: veMntLibMarka, veMntLibMarkalar: veMntLibMarkalar,
    VE_MNT_LIB_MARKALAR: VE_MNT_LIB_MARKALAR, VE_MNT_LIB_MARKA_OZEL: VE_MNT_LIB_MARKA_OZEL,
    _mntLibGrafik: _mntLibGrafik, _mntLibLejant: _mntLibLejant, _mntLibEgriHTML: _mntLibEgriHTML,
    MNT_AUTO_CASES: MNT_AUTO_CASES,
    // Aracın ileri yönü ve kaldırım darbesi (2026-11-02)
    MNT_ILERI: MNT_ILERI, MNT_KALDIRIM_G: MNT_KALDIRIM_G, MNT_KALDIRIM_YON: MNT_KALDIRIM_YON, MNT_TORK_YON: MNT_TORK_YON,
    _mntYonAyari: _mntYonAyari, _mntIleriOnerisi: _mntIleriOnerisi, _mntTorkOnerisi: _mntTorkOnerisi, _mntTorkKaynak: _mntTorkKaynak, _mntDonusEtkin: _mntDonusEtkin, _mntTransferSection: _mntTransferSection, _mntTransferKatalog: _mntTransferKatalog, _mntTransferPresetValues: _mntTransferPresetValues, veMntApplyTransferPreset: veMntApplyTransferPreset, veMntApModeli: veMntApModeli, _mntApZinciri: _mntApZinciri, veMntApDoldur: veMntApDoldur, _mntCozucuApGovde: _mntCozucuApGovde, veMntSetDonus: veMntSetDonus, _mntIleriOnayli: _mntIleriOnayli,
    _mntYonN: _mntYonN, _mntTorkIsareti: _mntTorkIsareti,
    _mntYukDurumlari: _mntYukDurumlari, _mntCozucuYonGovde: _mntCozucuYonGovde,
    veMntSetYon: veMntSetYon,
    VE_MNT_STARTER_LAYOUT: VE_MNT_STARTER_LAYOUT,
    veMntPopulateStarter: veMntPopulateStarter,
    veMntExportTopology: veMntExportTopology,
    veMntDecorateConnections: veMntDecorateConnections,
    _mntWireSupportLinks: _mntWireSupportLinks,
    _mntTopoState: _mntTopoState,
    _mntResolveTopology: _mntResolveTopology,
    _mntLoadExampleFromJSON: _mntLoadExampleFromJSON,
    _mntLoadExampleFromModel: _mntLoadExampleFromModel,
    _mntExampleLayout: _mntExampleLayout,
    _mntLibForceChart: _mntLibForceChart,
    _mntExampleBodyType: _mntExampleBodyType,
    _mntComputeSupportLinks: _mntComputeSupportLinks,
    _mntPtoConflict: _mntPtoConflict,
    _MNT_PTO_REF: _MNT_PTO_REF,
    _mntExampleValidate: _mntExampleValidate, _mntRenderExampleReport: _mntRenderExampleReport,
    _mntGatherForSolver: _mntGatherForSolver,
    _mntGatherTorque: _mntGatherTorque,
    _mntTorqueCases: _mntTorqueCases,
    _mntGearTorqueCases: _mntGearTorqueCases,
    _mntToSI: _mntToSI,
    _mntFitForce: _mntFitForce,
    _mntDeflColor: _mntDeflColor,
    _mntForceColor: _mntForceColor,
    // Başlangıç sayfası ve sihirbaz (2026-10-14)
    VE_MNT2D_GORUNUS: VE_MNT2D_GORUNUS,
    veMnt2DGorunusSVG: veMnt2DGorunusSVG,
    _mntPrepareFrom: _mntPrepareFrom,
    _mntLibUygula: _mntLibUygula,
    // Parametrik Analiz (js/cp-mount-param.js) bu yardımcılarla kurar
    _mntLibGirdiYaz: _mntLibGirdiYaz, _mntEntryHasLaw: _mntEntryHasLaw,
    _mntDef: _mntDef, _mntNum: _mntNum, _mntEsc: _mntEsc, _mntS: _mntS, _mntSym: _mntSym, _mntBos: _mntBos,
    _mntDugum: _mntDugum, _mntPencereKabuk: _mntPencereKabuk, _mntPencereHTML: _mntPencereHTML,
    _mntBolum: _mntBolum, _mntIzgara: _mntIzgara, _mntOku: _mntOku,
    _mntFoyAc: _mntFoyAc, _MNT_FOY_KAPA: _MNT_FOY_KAPA,
    VE_MNT_ARAC_TIPLERI: VE_MNT_ARAC_TIPLERI,
    _mntAracGaranti: _mntAracGaranti,
    veMntKanvasBos: veMntKanvasBos,
    veMntOrnekYukle: veMntOrnekYukle,
    _mntOrnekPaletKapat: _mntOrnekPaletKapat, veMntPaletKapat: veMntPaletKapat, veMntPaletGeriAc: veMntPaletGeriAc,
    _mntPaletSifirla: function(){ _mntPaletBizim = false; },
  };
  // Son çözüm bu modülün değişkeninde; tarayıcıda tek global, Node'da modül
  // kapsamında kalır. Pencereyi sentetik bir çözümle ölçen testler onu buradan kurar.
  Object.defineProperty(module.exports, '_veMntLast', {
    get:function(){ return _veMntLast; }, set:function(v){ _veMntLast=v; }, enumerable:false });

}
