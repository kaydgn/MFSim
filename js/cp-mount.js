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
// İKİ AYRI VERİ TABANI VAR; İKİSİ DE DOĞRU, AMA AYNI ŞEY DEĞİL:
//
//   (A) NOMİNAL KATALOG — üreticinin ürün verisi. Yüksüz, küçük-sehim rijitliği.
//       Takozun KENDİ özelliğidir, hangi araca takıldığından bağımsızdır.
//   (B) BMC 8x8 ÇALIŞMA NOKTASI — AMC'nin o araç için yaptığı hesapların
//       içinden geri çözülen EFEKTİF rijitlik. Takozun o montajdaki ön yükü
//       altındaki sekant değeridir; araca özgüdür.
//
// (A) gömülü katalog girdileridir (anahtar: 'amcNNNNNN'). (B) yalnız o dört
// AMC raporunu birebir yeniden üretmek için '-calc' sonekiyle AYRI girdi olarak
// durur. Farkı görmezden gelmeyin: Cone 38'de sx 1800 (nominal) ↔ 2670 (çalışma
// noktası) — %48. Nedeni fiziksel, bkz. "NEDEN FARKLILAR" başlığı.
//
// ── (A) NOMİNAL KATALOG ─────────────────────────────────────────────────────
// Kaynak: AMC ürün karşılaştırma aracı (amceodev.amcsa.es/curves_comparative.aspx,
// 24.11.2025 dökümü) + Cone 67 için AMC teknik departmanından yazılı bildirim
// (Okan Tandoğan) + SOLID CONE / CONE WITH CUTOUTS katalogları (kod, sertlik,
// maks. yük, sıkma torku).
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
//   177296 | (tip adı kaynakta yok)| — |  900 kg  | 1090  | 1090  |  650 | 2,0
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
//   nominal veri gelmedi → o girdi yalnız (B) tabanını taşır, adında yazılıdır.
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
// ── (B) BMC 8x8 ÇALIŞMA NOKTASI ('-calc' sonekli girdiler) ──────────────────
// Kaynak: AMC Technical Assistance Service çok-gövdeli titreşim analizi raporları,
// müşteri 79724 BMC Otomotiv, proje 3066 "8x8 Armored Carrier Truck – Powertrain",
// hesaplar 13440 / 13948 / 13955 / 13957. Dört rapor AYNI güç grubunu (Motor
// 1472,2 kg + Şanzıman 813 kg, toplam 2285,2 kg) dört FARKLI takoz kombinasyonuyla
// çözer — aynı takoz tipi birden çok bağımsız yapılandırmada görünür.
//   • statik ← 4 raporun "Static Results" tablolarındaki 20 takoz satırının
//     sehim+kuvvet çiftlerine (1g) en küçük kareler uyumu;
//   • dinamik ← "Natural Frequencies" tablolarındaki 24 özdeğere 6 SD rijit gövde
//     özdeğer probleminin uyumu.
// Bu girdilerle MFSim çekirdeği dört raporun TAMAMINI yeniden üretir: statik
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
// 0,70 mm'ye çıkıyor; '-calc' değerleriyle 0,47 Hz / 0,03 mm. Yani hangi tabanı
// seçtiğiniz sonucu değiştirir — GENEL ÜRÜN SEÇİMİ için nominal (A), BU ARACIN
// AMC raporlarını yeniden üretmek için (B) kullanın.
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
// EKLENMEYENLER (veri yok):
//   • LMT-1433-20 — TTAR ölçüm raporunda ön takoz olarak geçiyor ("X yönü
//     yumuşatılmış" varyant), rijitlik verisi hiçbir dokümanda yok.
//   • LMT-1433-37 — mount-core.js SIPER_EXAMPLE'ın kaynağı; kütüphanedeki
//     'amc55sha' girdisi (1252/1252/640) odur. DİKKAT: o girdinin adı "AMC 55 ShA"
//     ama parça LMT-1433 ailesinden, yani muhtemelen AMC değil A+P — ad yanıltıcı
//     olabilir. Teyit gelmeden DEĞİŞTİRİLMEDİ.
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
// GÖMÜLÜ GİRDİLERDE BOŞ: elimizdeki kaynak dokümanların hiçbiri bu katalog
// girdileri için kapasite vermiyor. Makul bir sayı UYDURULMADI — kapasite
// tanımsızken sütun, çizgi ve cümle hiç görünmez. Kullanıcı datasheet'ten
// okuduğu değeri Takoz panelinden ya da Takoz Özellikleri'nden girer.
var VE_MOUNT_LIBRARY = {
  'amc55sha':         { name:'AMC 55 ShA',                       sx:1252, sy:1252, sz:640,  dx:2055, dy:2055, dz:977 },
  '57RS313773':       { name:'57RS313773 (A26)',          sx:334,  sy:334,  sz:2300, dx:435,  dy:435,  dz:3000 },
  '57RS313774':       { name:'57RS313774 (A26)',          sx:1200, sy:1200, sz:2400, dx:950,  dy:950,  dz:1900 },
  '57RS313773-sr116': { name:'57RS313773 (ASR-SR-116)',   sx:462,  sy:462,  sz:2200, dx:630,  dy:630,  dz:3000 },
  '57RS313774-sr116': { name:'57RS313774 (ASR-SR-116)',   sx:1045, sy:1045, sz:1800, dx:1045, dy:1045, dz:1800 },
  // TK035 · 57RS328045 · 35 ShA — MLMT-0216-33-TK035 (curve-fit, R²≈0.997)
  'TK035': { name:'TK035 (57RS328045)', sx:415, sy:210, sz:192, dx:535, dy:250, dz:230,
    fits:{
      x:{ form:'poly', k0:415, c3:-2.44, c5:0.0201 },
      y:{ form:'poly', k0:210, c3:-1.28, c5:0.0169 },
      z:{ form:'asym', comp:{k0:367, xmax:5.60}, ext:{k0:361, c3:2.20} }   // basma sert (rasyonel), geri-gelme kübik
    } },
  // TK040 · 57RS329001M · 45 ShA — MLMT-0216-33-TK040 (curve-fit, R²≈0.99)
  'TK040': { name:'TK040 (57RS329001M)', sx:515, sy:260, sz:242, dx:740, dy:355, dz:335,
    fits:{
      x:{ form:'poly', k0:515, c3:-3.29, c5:0.0311 },
      y:{ form:'poly', k0:260, c3:-2.78, c5:0.0269 },
      z:{ form:'asym', comp:{k0:387, xmax:5.66}, ext:{k0:400, c3:2.06} }
    } },
  // TK050 · 57RS326612M · 50 ShA — MLMT-0216-33-TK050 (curve-fit, R²≈0.99)
  'TK050': { name:'TK050 (57RS326612M)', sx:665, sy:335, sz:290, dx:1165, dy:590, dz:490,
    fits:{
      x:{ form:'poly', k0:665, c3:-5.85, c5:0.0618 },
      y:{ form:'poly', k0:335, c3:-2.53, c5:0.0249 },
      z:{ form:'asym', comp:{k0:381, xmax:5.02}, ext:{k0:374, c3:2.11} }
    } },
  // ── (A) AMC MECANOCAUCHO® konik takozlar — NOMİNAL KATALOG ───────────────
  // dx/dy/dz = sx/sy/sz × cdyn/cstat. Oyuklu konide sx ≠ sy KASITLI (oyuk ekseni
  // = yumuşak eksen y); masif konide kx = ky (üreticinin tablosu da öyle).
  'amc137963': { name:'Cone 38 60Sh (AMC 137963)',      sx:1800, sy:1210, sz:1150, dx:2880, dy:1936, dz:1840 },  // ×1,6
  'amc137964': { name:'Cone 38 70Sh (AMC 137964)',      sx:2770, sy:1990, sz:1900, dx:4986, dy:3582, dz:3420 },  // ×1,8
  'amc137731': { name:'Cone 67 50Sh (AMC 137731)',      sx:3090, sy:2150, sz:1325, dx:4326, dy:3010, dz:1855 },  // ×1,4
  'amc137981': { name:'Cone 39 40Sh (AMC 137981)',      sx:1340, sy:1340, sz:720,  dx:1608, dy:1608, dz:864  },  // ×1,2 ⚠türetilmiş oran
  'amc137982': { name:'Cone 39 50Sh (AMC 137982)',      sx:2200, sy:2200, sz:1150, dx:3080, dy:3080, dz:1610 },  // ×1,4 ⚠türetilmiş oran
  'amc137983': { name:'Cone 39 60Sh (AMC 137983)',      sx:2490, sy:2490, sz:1400, dx:3984, dy:3984, dz:2240 },  // ×1,6 ⚠türetilmiş oran
  'amc137830': { name:'Cone 121 NG 55Sh (AMC 137830)',  sx:4000, sy:4000, sz:1350, dx:6000, dy:6000, dz:2025 },  // ×1,5
  'amc137833': { name:'Cone 121 NG 65Sh (AMC 137833)',  sx:5800, sy:5800, sz:2500, dx:9860, dy:9860, dz:4250 },  // ×1,7
  'amc177296': { name:'AMC 177296',                     sx:1090, sy:1090, sz:650,  dx:2180, dy:2180, dz:1300 },  // ×2,0 (tip adı kaynakta yok)
  // ── (B) BMC 8x8 ÇALIŞMA NOKTASI — AMC hesaplarından geri çözüm ───────────
  // Ön yük altındaki EFEKTİF sekant rijitlik; yalnız o dört raporu (13440/13948/
  // 13955/13957) yeniden üretmek için. Genel ürün seçiminde (A)'yı kullanın.
  'amc137963-calc': { name:'Cone 38 60Sh (AMC 137963 · BMC 8x8 çalışma noktası)',     sx:2670, sy:1065, sz:1180, dx:4265, dy:1690, dz:1715 },
  'amc137731-calc': { name:'Cone 67 50Sh (AMC 137731 · BMC 8x8 çalışma noktası)',     sx:3550, sy:2115, sz:1280, dx:4630, dy:2785, dz:1625 },
  'amc137830-calc': { name:'Cone 121 NG 55Sh (AMC 137830 · BMC 8x8 çalışma noktası)', sx:4405, sy:4405, sz:1530, dx:6380, dy:6380, dz:2080 },
  // Cone 121 NP 55Sh için nominal veri GELMEDİ — bu girdi yalnız çalışma noktası
  // tabanını taşır. Anahtar değişmedi (kayıtlı projelerin bağı kopmasın).
  'amc137829': { name:'Cone 121 NP 55Sh (AMC 137829 · BMC 8x8 çalışma noktası)', sx:3150, sy:3150, sz:1075, dx:4605, dy:4605, dz:1755 },
  // ── LMT-1433-00 — BMC güç grubu FEA raporlarının takozu ─────────────────
  // TEK RİJİTLİK TABANI: kaynak statik/dinamik AYRIMI YAPMIYOR → sx = dx.
  // Nedeni ve ölçümü için aşağıdaki "LMT-1433-00" blok yorumuna bakın.
  'lmt1433-00-40sh': { name:'LMT-1433-00 40 ShA', sx:900,  sy:900,  sz:450,  dx:900,  dy:900,  dz:450  },
  'lmt1433-00-55sh': { name:'LMT-1433-00 55 ShA', sx:1500, sy:1500, sz:750,  dx:1500, dy:1500, dz:750  },
  'lmt1433-00-70sh': { name:'LMT-1433-00 70 ShA', sx:2500, sy:2500, sz:1150, dx:2500, dy:2500, dz:1150 },
  // ── "Mount 1" — aynı raporun ÖTEKİ standart parçası, PARÇA NUMARASI YOK ──
  // Ad kaynaktaki etiketin kendisidir ("Mount 1"); numara bulununca girdi adı
  // düzeltilmeli (anahtarlar kalır). LMT-1433-00'dan farklı olarak radyal
  // ANİZOTROPİK: sx > sy. Tek taban (sx = dx), gerekçesi LMT-1433-00 ile aynı.
  'bmc-mount1-40sh': { name:'Mount 1 40 ShA (BMC FEA · parça no yok)', sx:800,  sy:450,  sz:300, dx:800,  dy:450,  dz:300 },
  'bmc-mount1-55sh': { name:'Mount 1 55 ShA (BMC FEA · parça no yok)', sx:1000, sy:750,  sz:500, dx:1000, dy:750,  dz:500 },
  'bmc-mount1-70sh': { name:'Mount 1 70 ShA (BMC FEA · parça no yok)', sx:1350, sy:1100, sz:800, dx:1350, dy:1100, dz:800 }
};

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
    map[k]={ key:k, name:m.name, sx:m.sx, sy:m.sy, sz:m.sz, dx:m.dx, dy:m.dy, dz:m.dz, builtin:true, overridden:false,
      maxLoad:(m.maxLoad!==undefined?m.maxLoad:null),        // taşıma kapasitesi [kg] (opsiyonel)
      fitX:f.x||null, fitY:f.y||null, fitZ:f.z||null,       // fabrika analitik fit (varsa)
      curveX:cv(c.x), curveY:cv(c.y), curveZ:cv(c.z) };     // ya da nokta tablosu (varsa)
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
        map[k]={ key:k, name:pick('name'), sx:pick('sx'), sy:pick('sy'), sz:pick('sz'),
          dx:pick('dx'), dy:pick('dy'), dz:pick('dz'), builtin:true, overridden:true,
          maxLoad:pick('maxLoad'),
          fitX:base.fitX, fitY:base.fitY, fitZ:base.fitZ,
          curveX:base.curveX, curveY:base.curveY, curveZ:base.curveZ };
      });
    }
    // Kullanıcı tanımlı takozlar (Özel grup) — 3-eksen eğri (curveX/Y/Z) taşıyabilir.
    if(Array.isArray(n.data.mounts)){
      n.data.mounts.forEach(function(e){
        if(!e || !e.key) return;
        map[e.key]={ key:e.key, name:(e.name||'Özel Takoz'),
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
function veMntGetLibraryList(){
  var map=veMntGetLibraryMap(), out=[];
  Object.keys(map).forEach(function(k){ out.push(map[k]); });
  return out;
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
// analiz araçlarının konumları. Model açılışında bu yerleşimin TAMAMI artık
// KURULMAZ; yalnız "Başlangıç ve Örnekler" bileşeni gelir (aşağıdaki
// veMntPopulateStarter). Buradaki koordinatlar hâlâ (a) tek bileşenin konumu ve
// (b) "Örneği Aktar" ile kurulan topolojinin görünür alana ortalanması için
// koordinat çerçevesi olarak kullanılır.
var VE_MNT_STARTER_LAYOUT = [
  // ── Üst şerit: analiz araçları (tek sıra, eşit aralık) ──
  { type:'mnt-coordframe',                     lx:40,  ly:20 },
  { type:'mnt-library',                        lx:190, ly:20 },
  { type:'mnt-viewer',                         lx:340, ly:20 },
  { type:'mnt-2dview',                         lx:490, ly:20 },
  { type:'mnt-solver',   name:'Çözücü',         lx:640, ly:20 },
  { type:'mnt-example',                        lx:790, ly:20 },
  { type:'mnt-report',                         lx:940, ly:20 },
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

// "BAŞLANGIÇ VE ÖRNEKLER" BİLEŞENİ YOKSA EKLE — örnek yükleyicisinin yardımcısı
// (örneğin JSON'u onu taşımayabilir: ASFAT taşımıyor). Referans yerleşimdeki
// sağ-üst yuvasına konur; "Örneği Aktar" güç grubunu sol-orta bölgeye
// kurduğundan çakışmaz.
//
// AÇILIŞ ARTIK BUNU ÇAĞIRMAZ (2026-10-14, kullanıcı: *"FEAD modülünün
// başlangıç ekranı çok güzel, aynı onun gibi bir ekran istiyorum"*): boş bir
// Takoz topolojisini BAŞLANGIÇ SAYFASI karşılar (js/cp-mount-baslangic.js).
// Bileşen kendiliğinden kurulsaydı sayfanın "model boş" sorusu bir düğümle
// cevaplanmış olurdu; sayfa onu ayrıca "boş" sayar, çünkü 2026-10-14'ten önce
// kaydedilmiş boş topolojiler bu tek düğümü taşıyor.
function veMntPopulateStarter(){
  if(typeof createNode!=='function') return [];
  var base = (typeof veArrangeModuleBase==='function')
    ? veArrangeModuleBase(VE_MNT_STARTER_LAYOUT.map(function(it){ return {lx:it.lx, ly:it.ly}; }))
    : { x:3000, y:3000 };
  var slot = VE_MNT_STARTER_LAYOUT.find(function(it){ return it.type==='mnt-example'; }) || { lx:790, ly:20 };
  var created=[];
  var before=nodes.length;
  createNode('mnt-example', base.x+slot.lx, base.y+slot.ly);
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

// ÖRNEĞİ ANAHTARIYLA YÜKLE — başlangıç sayfasının karoları ve "Başlangıç ve
// Örnekler" panelinin "Örneği aktar"ı. Kayıt girişinde JSON topolojisi varsa
// ondan (birebir), yoksa programatik model kurucusundan.
function veMntOrnekYukle(key){
  if(typeof veMountCore==='undefined' || !key) return false;
  var ex = (veMountCore.getMountExample) ? veMountCore.getMountExample(key) : null;
  if(!ex) return false;
  if(ex.topology){ _mntLoadExampleFromJSON(ex.topology, ex); return true; }
  _mntLoadExampleFromModel(null, key);
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
var _MNT_POINTMASS_DEFAULT = { 'mnt-shaft':1, 'mnt-pto':1, 'mnt-pump':1 };
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
// ("Yanal bordür darbesi — sol (1,55g)") kırpılıyordu; tam adı `title`da.
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
    + ((em||opt.emId) ? '<em'+(opt.emId?' id="'+opt.emId+'" data-tazele':'')+'>'+(em||'')+'</em>' : '')
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
  return '<td class="gir'+(zor&&bos?' zor':'')+'"><input type="text" inputmode="decimal" id="ve-mnt-'+key+'-'+node.id+'"'
    + ' value="'+_mntEsc(v)+'"'+(zor?' data-zorunlu':'')
    + ((opt.ph||zor) ? ' placeholder="'+_mntEsc(opt.ph||'zorunlu')+'"' : '')
    + ' aria-label="'+_mntEsc(aria)+'" onchange="'+(opt.setter||'veMntSet')+'(\''+node.id+'\',\''+key+'\',this.value)"></td>';
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
    if(c.name==='Forward Torque') fwd=-c.T[0];
    if(c.name==='Reverse Torque') rev=-c.T[0];
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
                     ['g5','5. vites'],['g6','6. vites'],['gR','Geri']];
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
  var h=_mntBolum('Vites oranları', 'ileri tork: 1. vites · geri tork: geri', f+_MNT_FOY_KAPA);
  h+=_mntBolum('Konvertör', '',
      _mntIzgara(2, _mntAlan(node, 'Rstall', 'Stall oranı', { zorunlu:true })
                  + _mntOku('İleri mil torku <u>[N·m]</u>', Z.ileri!=null ? _mntS(Z.ileri,0) : '—', { id:'ve-mnt-tileri-'+node.id })));
  return h;
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
  var h=_mntBolum('Oran ve aks payı', '',
      _mntIzgara(1, _mntAlan(node, 'iTransfer', 'Transfer oranı', { zorunlu:true }))
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
  else if(node.type==='mnt-gearbox') kategoriler.push({ k:'vites', ad:'Vitesler', govde:_mntGearboxSection(node), durum:_mntVitesDurumu(node) });
  else if(node.type==='mnt-transfer') kategoriler.push({ k:'tahrik', ad:'Tahrik', govde:_mntTransferSection(node), durum:_mntTahrikDurumu(node) });
  else if(_MNT_PTO_REF[node.type]) kategoriler.push({ k:'pto', ad:'PTO grubu', govde:_mntPtoSection(node), durum:_mntPtoDurumu(node) });
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
  var esit=function(a, b){ var x=_mntNum(a,NaN), y=_mntNum(b,NaN);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x-y)<=1e-9*Math.max(1, Math.abs(y)); };
  var say=function(e){ var ayni=0, farkli=[];
    _MNT_RIJ_KUT.forEach(function(a){ if(esit(d[a[0]], e[a[1]])) ayni++; else farkli.push(a[2]); });
    return { ayni:ayni, farkli:farkli }; };
  var e=(d.libKey && map[d.libKey]) ? map[d.libKey] : null;
  if(!e){
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
  if(E.farkli.length) return _mntNot(ad+' ile '+E.ayni+'/6 değer aynı; '+E.farkli.join(', ')+' elle değiştirildi'+yasa+'.', 'warn');
  return _mntNot(ad+' ile 6/6 değer aynı'+yasa+'.', '');
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
  var B=lib.filter(function(e){ return e.builtin; }), Cu=lib.filter(function(e){ return !e.builtin; });
  var opt=function(e){ return '<option value="'+_mntEsc(e.key)+'"'+(d.libKey===e.key?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; };
  var sel='<select class="ve-fp-sel" id="ve-mnt-libKey-'+node.id+'" onchange="veMntApplyLib(\''+node.id+'\',this.value)">'
    + '<option value="">— elle gir —</option>';
  if(B.length) sel+='<optgroup label="Gömülü">'+B.map(opt).join('')+'</optgroup>';
  if(Cu.length) sel+='<optgroup label="Özel (Takoz Özellikleri)">'+Cu.map(opt).join('')+'</optgroup>';
  sel+='</select>';
  var h=_mntBolum('Takoz tipi', B.length+' gömülü · '+Cu.length+' özel',
      _mntIzgara(1, '<label class="ve-fp-f ve-fp-f--sel"><span class="ve-fp-l">Kütüphane</span>'+sel+'</label>')
    + '<div id="ve-mnt-libnot-'+node.id+'" data-tazele>'+_mntKutuphaneNotu(node)+'</div>');
  // Rijitlik — statik ve dinamik aynı satırda; oran türetilir.
  var f=_mntFoyAc([{ b:'Eksen', gen:'31%' }, { b:'Statik', gen:'23%' }, { b:'Dinamik', gen:'23%' },
                   { b:'Din./stat.', gen:'23%', sinif:'cz ay' }], 'Rijitlik');
  _MNT_RIJ.forEach(function(r){
    var s=_mntNum(d[r[0]],NaN), k=_mntNum(d[r[1]],NaN);
    f+='<tr><td>'+r[2]+'</td>'+_mntFoyGir(node, r[0], 'Statik k'+r[3], { zorunlu:true })
      + _mntFoyGir(node, r[1], 'Dinamik k'+r[3], { zorunlu:true })
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
// Örnek seçimi: kalıcı yaz + paneli yeniden çiz (görsel/detay canlı değişsin).
function veMntSetExample(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data.exampleKey=key;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
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
//  ÖRNEK — hazır doğrulama modellerini seç, önizle ve topolojiye yükle
// ════════════════════════════════════════════════════════════════════════════
// "Örnek" bileşeni: gömülü örnek modelleri (veMountCore.MOUNT_EXAMPLES) seçip
// önizler ve tek tıkla iç topolojiye kurar. Panel yukarıdan aşağı: preset seçici
// → topoloji görseli → araç detayları → "Örneği Aktar" → tutarlılık raporu.
// Yeni örnek eklemek: mount-core.js MOUNT_EXAMPLES defterine bir giriş ekle —
// başka hiçbir yeri değiştirmeye gerek yoktur (panel + yükleyici buradan okur).

// Kayıt defteri erişimi — çekirdeğe bağlı, çekirdek yoksa güvenli düşüş.
function _mntExampleReg(key){
  if(typeof veMountCore!=='undefined' && veMountCore.getMountExample) return veMountCore.getMountExample(key);
  var m=(typeof veMountCore!=='undefined') ? veMountCore.TTAR_EXAMPLE : null;
  return { id:'ttar', name:'BMC TTAR 2031', vehicle:'BMC TTAR 2031', model:m };
}
function _mntExampleList(){
  if(typeof veMountCore!=='undefined' && veMountCore.getMountExampleList) return veMountCore.getMountExampleList();
  return [_mntExampleReg('ttar')];
}

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

// componentDefs ikonunun iç SVG içeriğini çıkar (varsa) — nested <svg> ile gömmek için.
function _mntIconInner(type){
  var def=(typeof componentDefs!=='undefined') ? componentDefs[type] : null;
  var svg=def && def.svg;
  if(!svg) return null;
  var m=svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return m ? m[1] : null;
}

// Modelden tema-uyumlu şematik topoloji SVG'si üret (örnek kendi görselini
// vermediğinde). Kütle/takoz düğümleri uygulamanın GERÇEK ikonlarıyla
// (componentDefs) çizilir; ikon yoksa (ör. Jest) kutu/daireye düşer. tools[] =
// önizleme süsü (yardımcı araçlar; yükleyici bunları KURMAZ). Yükleyiciyle aynı
// at:[lx,ly] yerleşimini kullanır → görsel ile kurulan kanvas birebir örtüşür.
function _mntExampleDiagramSVG(model, tools){
  if(!model || !model.components || !model.components.length) return '';
  var L=_mntExampleLayout(model), comps=model.components, mounts=model.mounts||[];
  var items=[];
  comps.forEach(function(c,i){ items.push({type:(c.kind||_mntExampleBodyType(c.name)), name:c.name, x:L.bodies[i].lx, y:L.bodies[i].ly, role:'body'}); });
  mounts.forEach(function(m,i){ items.push({type:'mnt-mount', name:m.name, x:L.mnts[i].lx, y:L.mnts[i].ly, role:'mount'}); });
  // Araç adı bileşenin KENDİ adı (componentDefs): kayıtta elle yazılmış kopya
  // bayatlıyordu — "2D Görünüm" → "Görünümler" yeniden adlandırmasında kurgu
  // örnekler eski adda kaldı; "Örnek" de kanvasa kurulan düğümün adı değildi.
  (tools||[]).forEach(function(t){
    var d=(typeof componentDefs!=='undefined') ? componentDefs[t.type] : null;
    if(t && t.at && t.at.length===2) items.push({type:t.type, name:(d && d.name) || t.type, x:t.at[0], y:t.at[1], role:'tool'});
  });
  var CARD=54, IC=40, M=22, xs=[], ys=[];
  items.forEach(function(it){ xs.push(it.x-CARD/2, it.x+CARD/2); ys.push(it.y-CARD/2, it.y+CARD/2); });
  var minX=Math.round(Math.min.apply(null,xs)-M), maxX=Math.round(Math.max.apply(null,xs)+M);
  var minY=Math.round(Math.min.apply(null,ys)-M), maxY=Math.round(Math.max.apply(null,ys)+M);
  var s='<svg viewBox="'+minX+' '+minY+' '+(maxX-minX)+' '+(maxY-minY)+'" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="display:block;font-family:inherit;">';
  // Takoz → en yakın kütle ince kılavuz çizgisi (arka planda)
  var bodies=items.filter(function(it){ return it.role==='body'; });
  items.filter(function(it){ return it.role==='mount'; }).forEach(function(mo){
    var nb=bodies[0], bd=Infinity;
    bodies.forEach(function(bp){ var dx=bp.x-mo.x, dy=bp.y-mo.y, d=dx*dx+dy*dy; if(d<bd){ bd=d; nb=bp; } });
    if(nb) s+='<line x1="'+mo.x+'" y1="'+mo.y+'" x2="'+nb.x+'" y2="'+nb.y+'" stroke="var(--border-hover)" stroke-width="1.3" stroke-dasharray="3 3" opacity="0.55"/>';
  });
  // Düğümler: kart + gerçek ikon (yoksa yedek). Ad GÖRÜNÜR YAZI DEĞİL, <title>:
  // şema sütunda ~0,45 ölçekle çiziliyor ve 10,5 birimlik ad ekranda 4,8 px
  // kalıyordu (okunmuyor, çizgilere karışıyordu); ad fare üstünde ve künyede.
  items.forEach(function(it){
    var x0=it.x-CARD/2, y0=it.y-CARD/2, tool=it.role==='tool';
    s+='<g><title>'+_mntEsc(it.name)+'</title>';
    var stroke=tool?'var(--border-color)':(it.role==='mount'?'var(--accent-success)':'var(--accent-primary)');
    s+='<rect x="'+x0+'" y="'+y0+'" width="'+CARD+'" height="'+CARD+'" rx="9" fill="var(--bg-secondary)" stroke="'+stroke+'" stroke-width="'+(tool?1.2:1.6)+'"'+(tool?' opacity="0.9"':'')+'/>';
    var inner=_mntIconInner(it.type);
    if(inner){
      s+='<svg x="'+(it.x-IC/2)+'" y="'+(it.y-IC/2)+'" width="'+IC+'" height="'+IC+'" viewBox="0 0 100 100">'+inner+'</svg>';
    } else if(it.role==='mount'){
      s+='<circle cx="'+it.x+'" cy="'+it.y+'" r="13" fill="var(--accent-success)" fill-opacity="0.16" stroke="var(--accent-success)" stroke-width="2"/><circle cx="'+it.x+'" cy="'+it.y+'" r="4" fill="var(--accent-success)"/>';
    } else {
      s+='<rect x="'+(it.x-16)+'" y="'+(it.y-9)+'" width="32" height="18" rx="3" fill="var(--bg-tertiary)" stroke="var(--accent-primary)" stroke-width="1.5"/>';
    }
    s+='</g>';
  });
  s+='</svg>';
  return s;
}

// Örneğin KÜNYESİ — araç adı, kısa etiket, açıklama ve künye föyü (örnek
// kaydının `specs` satırları: büyüklük · değer).
function _mntExampleDetailsHTML(ex){
  var h='<div class="ve-mnt-ex-bas"><b>'+_mntEsc(ex.vehicle||ex.name||'')+'</b>'
    + (ex.subtitle ? '<em>'+_mntEsc(ex.subtitle)+'</em>' : '')
    + (ex.description ? '<p>'+_mntEsc(ex.description)+'</p>' : '')+'</div>';
  var specs=ex.specs||[];
  if(specs.length){
    h+=_mntFoyAc([{ b:'Künye', gen:'50%' }, { b:'Değer', gen:'50%' }], 'Örneğin künyesi');
    specs.forEach(function(r){ h+='<tr><td>'+_mntEsc(r[0])+'</td><td>'+_mntEsc(r[1])+'</td></tr>'; });
    h+=_MNT_FOY_KAPA;
  }
  return h;
}

// BAŞLANGIÇ KAPILARI — boş topolojiyi karşılayan başlangıç sayfası model
// kurulunca çekilir; aynı iki yol (sihirbaz · STEP) burada da açık kalır.
// Kapı sayfanınkiyle AYNI üreticiden (js/baslangic-sayfa.js → veBasKapiHTML).
function _mntExampleKapilarHTML(){
  if(typeof veBasKapiHTML!=='function') return '';
  return '<div class="ve-bas-kapilar ve-mnt-ex-kapilar">'
    + veBasKapiHTML({ ey:'sihirbaz', ikon:'wand', ad:'Sihirbazla kur', birincil:true, onclick:'veMntWizAc()' })
    + veBasKapiHTML({ ey:'step', ikon:'box', ad:'STEP\'ten başla', onclick:'veMntWizAcStep()' })
    + '</div>';
}

// ÖRNEK PENCERESİ — iki kategori, pencerenin adı gibi (Başlangıç ve Örnekler):
// ÖRNEK (seçim, künye ve kanvasa kurulacak topolojinin resmi) · BAŞLANGIÇ
// (modeli kurmanın öteki yolları: sihirbaz · STEP — başlangıç sayfasıyla aynı
// kapılar). Sağ sütun KANVASTAKİ modelin denetimi ve eylem ("Örneği aktar"
// kanvası değiştirir — birincil düğme). İki kategori (Örnek · Başlangıç)
// gövdede alt alta.
function getMntExamplePropertiesHTML(node){
  if(!node.data) node.data={};
  var list=_mntExampleList();
  var sel=node.data.exampleKey || (list[0]&&list[0].id) || 'siper';
  var ex=_mntExampleReg(sel);
  var nid=node.id;
  // Topolojinin resmi HER ZAMAN modelden çizilen şema (kullanıcı kararı
  // S3·B, 2026-10-15): temaya uyar, tek dosyaya gömülü, ad fare üstünde. Ekran
  // görüntüsü (PNG) koyu temada ~5 px yazı taşıyordu ve tek dosyada hiç
  // yüklenmiyordu — kullanıcı onu hiç görmemişti.
  var diagram=_mntExampleDiagramSVG(ex.model, ex.tools);
  var secim='<label class="ve-fp-f"><span class="ve-fp-l">Örnek model</span>'
    + '<select class="ve-fp-sel" id="ve-mnt-example-sel" onchange="veMntSetExample(\''+nid+'\',this.value)">'
    + _mntOrnekSecenekleri(list, sel)
    + '</select></label>';
  var mdl=ex.model||{};
  var ornek=_mntBolum('Örnek model', (mdl.components||[]).length+' gövde · '+(mdl.mounts||[]).length+' takoz',
      secim+_mntExampleDetailsHTML(ex)
    + (diagram ? '<figure class="ve-mnt-ex-sema">'+diagram+'<figcaption>Kanvasa kurulacak topoloji</figcaption></figure>' : ''));
  var kapilar=_mntExampleKapilarHTML();
  var baslangic=_mntBolum('Modeli kur', '', kapilar || _mntNot('Başlangıç kiti yüklenmedi.', 'warn'));
  // Sağ sütun FEAD'in sırasıyla: pencerenin cevabı (tutarlılık) → ikincil
  // eylem → eylem satırı (sütunun sonu, dar kapta yapışık). Uygunluk yok —
  // sonuç yalnız raporda.
  var yan=_mntBolum('Tutarlılık uyarıları', 'kanvastaki model', '<div id="ve-mnt-example-report">'+_mntExampleDenetimIc(_mntExampleValidate(), true)+'</div>')
    + '<div class="ve-fp-eylem"><button type="button" class="ve-fp-dugme" onclick="veMntExportTopology()"'
    + '>'
    + veIkon('download')+' İç topolojiyi JSON dışa aktar</button></div>'
    + vePencereEylem('<button type="button" class="ve-fp-solve" onclick="veMntLoadExample(\''+nid+'\')">'+veIkon('play')+' Örneği aktar</button>');
  return _mntPencereKabuk(node, [{ k:'ornek', ad:'Örnek', govde:ornek },
                                 { k:'bas', ad:'Başlangıç', govde:baslangic }], yan);
}

// Seçenekler başlangıç sayfasıyla AYNI iki grupta: gerçek araçlar · kurgu
// doğrulama modelleri (kayıtta `kurgu`). Kurgu yoksa düz liste.
function _mntOrnekSecenekleri(list, sel){
  var opt=function(e){ return '<option value="'+_mntEsc(e.id)+'"'+(sel===e.id?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; };
  var kurgu=list.filter(function(e){ return e.kurgu; });
  if(!kurgu.length) return list.map(opt).join('');
  return '<optgroup label="Gerçek araç modelleri">'+list.filter(function(e){ return !e.kurgu; }).map(opt).join('')+'</optgroup>'
    + '<optgroup label="Doğrulama örnekleri — kurgu">'+kurgu.map(opt).join('')+'</optgroup>';
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
  if(!hasSolver) out.push({level:'warn', msg:'Çözücü yok.'});
  return out;
}

// Denetimin satırları — pencere kurulurken ve örnek yüklenince AYNI üretici.
// Boş kanvas bir hata değil başlangıçtır: "henüz model yok" der. Hüküm
// pencerenin CEVABI: FEAD'in durum kutusu (`.ve-fp-durum`), maddeler liste.
function _mntExampleDenetimIc(warnings, kurulus){
  var g=_mntGatherForSolver();
  if(kurulus && !g.components.length && !g.mounts.length) return _mntNot('Kanvasta model yok.', '');
  if(!warnings.length) return _mntDurumKutu('<b>Model tutarlı</b> — uyarı yok.', 'ok');
  // Çözücünün ön denetimiyle aynı dil: tek durum satırı, maddeler liste.
  var hata=warnings.filter(function(w){ return w.level==='err'; });
  var uyari=warnings.filter(function(w){ return w.level!=='err'; });
  var liste=function(L){ return '<ul>'+L.map(function(w){ return '<li>'+w.msg+'</li>'; }).join('')+'</ul>'; };
  return (hata.length ? _mntDurumKutu('<b>'+hata.length+' hata</b> — çözücü modeli reddeder.'+liste(hata), 'no') : '')
    + (uyari.length ? _mntDurumKutu('<b>'+uyari.length+' uyarı</b>'+liste(uyari), 'warn') : '');
}
function _mntRenderExampleReport(warnings, silent){
  var el = (typeof document!=='undefined') ? document.getElementById('ve-mnt-example-report') : null;
  if(el) el.innerHTML=_mntExampleDenetimIc(warnings, false);
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
    // Başka örnek yüklenebilsin diye "Başlangıç ve Örnekler" düğümü yoksa ekle.
    if(typeof nodes!=='undefined' && !nodes.some(function(n){ return (_mntDef(n)||{}).isMountExample; }) && typeof veMntPopulateStarter==='function'){
      veMntPopulateStarter();
    }
    if(_once){ undoStack = _once; redoStack = []; }
    if(typeof saveState==='function') saveState();
    if(typeof updateAllConnections==='function') updateAllConnections();
    if(typeof veMntUpdateBreadcrumb==='function') veMntUpdateBreadcrumb();
    // Kamerayı yüklenen içeriğe otur. Kayıttaki kamera örneği ÜRETEN pencerenin
    // ölçüsüne göreydi; başka boyutta bir ekranda topolojinin bir kısmı görüş
    // dışında (kenara yapışmış) kalıyordu.
    if(typeof veFitViewToContent==='function') veFitViewToContent({ maxZoom:1 });
    if(typeof showToast==='function') showToast('Örnek yüklendi'+(ex&&ex.vehicle?(' — '+ex.vehicle):'')+'.','info');
  });
}

// "Örneği Aktar" yönlendiricisi: kayıt girişinde JSON topolojisi (topology) varsa
// ondan yükle; yoksa mevcut programatik model kurucusuna düş.
function veMntLoadExample(nodeId){
  if(typeof veMountCore==='undefined') return;
  var node = (typeof nodes!=='undefined') ? nodes.find(function(n){ return n.id===nodeId; }) : null;
  var key = (node && node.data && node.data.exampleKey)
    || ((veMountCore.getMountExampleList && veMountCore.getMountExampleList()[0]||{}).id) || 'siper';
  veMntOrnekYukle(key);
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
  var pureBodies = items.filter(function(it){ return BODY[it.kind]; });
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
  carried.forEach(function(p){ addRaw(p, nearest(p, pureBodies)); });   // PTO/Pompa → taşıyıcı gövde

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
function _mntLoadExampleFromModel(nodeId, anahtar){
  if(typeof veMountCore==='undefined' || typeof createNode!=='function') return;
  var node = nodeId ? nodes.find(function(n){ return n.id===nodeId; }) : null;
  var key = anahtar || (node && node.data && node.data.exampleKey) || 'siper';
  // Seçilen örneğin modelini kayıt defterinden çöz (bilinmezse ilk örneğe düşer).
  var ex = (veMountCore.getMountExample) ? veMountCore.getMountExample(key) : null;
  var EX = (ex && ex.model) || veMountCore.TTAR_EXAMPLE; if(!EX) return;

  // Mevcut kütle/takoz bileşenlerini bul (Çözücü/Örnek/Görüntüleyici korunur).
  var toRemove = nodes.filter(function(n){ var d=_mntDef(n)||{}; return d.isMountBody || d.isMount; });
  if(toRemove.length){
    var ok = (typeof confirm==='undefined') ? true : confirm(toRemove.length+' kütle/takoz bileşeni silinecek. Devam edilsin mi?');
    if(!ok) return;
    toRemove.forEach(function(n){ _mntRemoveNode(n.id); });
  }

  // Örnek düğümlerini STARTER ile aynı tabana göre yerleştir ki yardımcı araçlarla
  // (Koordinat Düzlemi / 3D / 2D / Örnek / Çözücü — sağ ve üst kenarda) çakışmasın.
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
      // Tork zinciri: Motor→Te; Şanzıman→vites/stall + transfer/aks payı
      // (örnekte ayrı Transfer gövdesi yok → değerler Şanzıman'da tutulur).
      if(kind==='mnt-motor'){ n.data.Te=tq.Te; }
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

  // Çözücü yoksa ekle (starter'daki sağ-üst konuma).
  if(!nodes.some(function(n){ return (_mntDef(n)||{}).isMountSolver; })){
    createNode('mnt-solver', base.x + 640, base.y + 20);
  }
  if(typeof saveState==='function') saveState();
  if(typeof updateAllConnections==='function') updateAllConnections();

  // createNode +20ms otomatik seçimi paneli son eklenen düğüme çevirir → Örnek
  // düğümünü yeniden seçip raporu bas ki kullanıcı uyarıları (fazla takoz vs)
  // görsün. setTimeout/DOM yoksa (Jest) doğrudan bas.
  var exNode = (typeof nodes!=='undefined') ? nodes.find(function(n){ return n.id===nodeId; }) : null;
  if(typeof setTimeout==='function' && typeof document!=='undefined'){
    setTimeout(function(){
      if(exNode && typeof clearSelection==='function' && typeof addToSelection==='function'){
        clearSelection(); addToSelection(exNode);
        if(typeof showNodeProperties==='function') showNodeProperties(exNode);
      }
      _mntRenderExampleReport(_mntExampleValidate(), false);
    }, 90);
  } else {
    _mntRenderExampleReport(_mntExampleValidate(), false);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  3D GÖRÜNTÜLEYİCİ — iç topolojinin 3B yerleşimi (tema uyumlu)
// ════════════════════════════════════════════════════════════════════════════
// ─── Görüntüleyici denetimleri ───────────────────────────────────────────────
// İki ayrı buton dili: KATMAN ÇİPİ (aç/kapa, durumu renkle taşır) ve EYLEM
// düğmesi (tek seferlik iş). Eskiden ikisi de aynı gri butondu ve kapalı katman
// opacity:0.45 ile soldurulduğu için "devre dışı/bozuk" görünüyordu. Katmanlar
// üçlü ızgarada (.mnt-vwr-toggles), eylemler pencerenin eylem satırında
// (.ve-fp-eylem).
function _mntVwrToggle(what, label, title, on){
  var isOn = (on !== false);
  return '<button type="button" class="mnt-vwr-toggle'+(isOn?' is-on':'')+'" aria-pressed="'+(isOn?'true':'false')+'"'
    + ' title="'+_mntEsc(title||label)+'"'
    + ' onclick="var v=veMountViewerToggle(\''+what+'\'); this.classList.toggle(\'is-on\', v); this.setAttribute(\'aria-pressed\', v?\'true\':\'false\');">'
    + _mntEsc(label) + '</button>';
}
function _mntVwrAction(onclick, icon, label, title){
  return '<button type="button" class="mnt-vwr-action" onclick="'+onclick+'" title="'+_mntEsc(title||label)+'">'
    + (icon ? '<span class="mf-ico mf-ico-'+icon+'"></span>' : '')
    + '<span>'+_mntEsc(label)+'</span></button>';
}
// ETKİLEŞİM — kısayol penceresinin dilinde (tipografi kuralı).
function _mntVwrIpucu(satirlar){
  return '<ul class="ve-mnt-ipucu">'+satirlar.map(function(s){ return '<li>'+s+'</li>'; }).join('')+'</ul>';
}
// SAHNE KABI — çizim sütunun genişliğinde KARE: dar sütunda 380 px'lik bir
// pencere 58vh boyunda dikine bir şerit çiziyordu (354 × 540).
function _mntSahneHTML(wrapId, canvasId){
  return '<div class="ve-mnt-sahne" id="'+wrapId+'"><canvas id="'+canvasId+'"></canvas></div>';
}
// 3D GÖRÜNTÜLEYİCİ — YER TUTUCU (kullanıcı kararları 2026-10-16): "Klasik 3B"
// ilerleyen zamanda gerçek CAD dosyasıyla işlenecek ("sadece isim olarak
// kalabilir"); döndürülebilir aksonometri Görünümler bileşenine taşındı.
// Pencere TEK kategori ve başlıksız: aile kuralı her kategoriye bir bölüm
// başlığı ister, başlıksız yer tutucuyu tipin kendisi beyan eder
// (componentDefs['mnt-viewer'].yerTutucu = notun metni) ve aile kapısı
// (pencere-kabuk.test.js) yalnız beyan edeni bağışlar.
function getMntViewerPropertiesHTML(node){
  if(!node.data) node.data={};
  var d=(typeof componentDefs!=='undefined' && componentDefs['mnt-viewer']) || {};
  return _mntPencereKabuk(node, [{ k:'sahne', ad:'Klasik 3B', govde:'<div class="ve-mnt-kroki-bos">'+_mntEsc(d.yerTutucu || '')+'</div>' }], '');
}
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
//  KOORDİNAT DÜZLEMİ — koordinat sistemini 3B göster (eksen + düzlem + yön)
// ════════════════════════════════════════════════════════════════════════════
// Eksenlerin YÖNÜ föyde: konum ve CG değerleri bu eksenlere göre girilir.
// Örnek işaretin rengi 3B eksenin rengi (CSS `.ve-mnt-is[data-i="x|y|z"]`).
function getMntCoordFramePropertiesHTML(node){
  if(!node.data) node.data={};
  var eksen=function(A, art, eks, ad){
    return '<tr><td><span class="ve-mnt-is" data-i="'+A.toLowerCase()+'" aria-hidden="true"></span><b>'+A+'</b> '+ad+'</td>'
      + '<td class="sol">'+art+'</td><td class="sol">'+eks+'</td></tr>';
  };
  var foy=_mntFoyAc([{ b:'Eksen', gen:'40%' }, { b:'+ yön', gen:'30%', sinif:'sol' }, { b:'− yön', gen:'30%', sinif:'sol' }], 'Eksenlerin yönü')
    + eksen('X', 'araç arkası', 'ön', 'boyuna')
    + eksen('Y', 'sağ', 'sol', 'yanal')
    + eksen('Z', 'yukarı', 'aşağı', 'düşey')
    + _MNT_FOY_KAPA;
  var govde=_mntBolum('Sahne', 'eksen · düzlem',
      _mntSahneHTML('ve-mnt-coord-wrap', 've-mnt-coord-canvas')
    + '<div class="ve-fp-eylem">'
    +   _mntVwrAction("veMountViewerReset();", 'crosshair', 'Sıfırla', 'Sıfırla')
    + '</div>')
    + _mntBolum('Katmanlar', '', '<div class="mnt-vwr-toggles">'
    +   _mntVwrToggle('planes', 'Düzlem', 'Koordinat düzlemleri')
    +   _mntVwrToggle('grid', 'Zemin', 'Zemin ızgarası', false)
    + '</div>');
  // İki kategori: SAHNE · EKSENLER (yönlerin föyü ve etkileşim); sağ sütun
  // yok (Uygunluk 2026-10-16'dan beri yalnız raporda) — kabuk tek sütun.
  var eksenler=_mntBolum('Eksenler', '', foy)
    + _mntBolum('Etkileşim', '', _mntVwrIpucu(['Sol tık + sürükle: döndür', 'Tekerlek: yakınlaştır']));
  return _mntPencereKabuk(node, [{ k:'sahne', ad:'Sahne', govde:govde },
                                 { k:'eks', ad:'Eksenler', govde:eksenler }], '');
}
function veMntCoordFrameRefresh(){
  if(typeof veMountViewerInit==='function'){
    try{ veMountViewerInit('ve-mnt-coord-canvas','coordframe'); veMountViewerUpdate(); }catch(e){}
  }
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
    return { k:'g'+(i+1), id:c.id, no:String(i+1), ad:ad, m:mass, x:x, y:y, z:z, pay:pay, kutu:kutu, ana:false,
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
    + (m.govde.some(function(g){ return !g.kutu; }) ? '<span><svg viewBox="0 0 10 10" aria-hidden="true"><circle class="ve-ak-lj-n" cx="5" cy="5" r="2"/></svg>nokta kütle</span>' : '')
    + (b.z>0 ? '<span><svg viewBox="0 0 10 10" aria-hidden="true"><path class="ve-ak-lj-gol" d="M1 6 L5 4 L9 6 L5 8 Z"/></svg>Z = 0\'a düşen iz</span>' : '')
    + (sec ? '<span><svg viewBox="0 0 10 10" aria-hidden="true"><rect class="ve-ak-lj-sec" x="1.5" y="1.5" width="7" height="7" rx="1.5"/></svg>bu bileşen</span>' : '')
    + '</div>';
}
// Pencerenin, tam ekranın ve "Güç grubundaki yeri"nin aksonometrisi — başlık
// (bakışın adı, görünüm düğmeleri), çizim, gösterge. `tam`: tam ekran
// (işaretler adlarıyla; başlıkta tam ekran düğmesi yok). `ek.sec`: bu bileşenin
// düğüm kimliği — perdenin üstünde, adıyla; `ek.H`: tam ekranın ölçülen
// yüksekliği (_mntAksoTamH).
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
  var o={ W:W, stil:'golge', kat:{ golge:true }, etiket:(tam && W>=560) ? 'genis' : 'ad',
    fs:{ k:_mnt2DFs('micro'), b:_mnt2DFs('tiny') },
    kam:{ az:A.az, el:A.el }, kure:true, yakin:G.yakin, kay:G.kay, isaret:_mntAksoIsaret(W),
    H:tam ? (ek.H>0 ? Math.round(ek.H) : Math.max(380, Math.min(760, Math.round(ekranH*0.7))))
          : Math.round(Math.max(280, Math.min(460, W*0.92))),
    yer:(_mntAksoCizim[kapId] && _mntAksoCizim[kapId].yer) || null };
  if(sec){ o.secili=sec.k; o.perde=true; o.aria='Güç grubundaki yeri: '+sec.ad; }
  var r=veMntAkso.ciz(m, o), svg=_mntAksoSvg(r.svg);
  // Sürüklerken hızlı kare ve föyün vurgusu aynı model ve seçeneklerle
  // çizilir (_mntAkso3bHizli · _mntAksoOdak); `svg` son çizimin kendisi.
  _mntAksoCizim[kapId]={ m:m, o:o, F:r.F, yer:r.yer, svg:svg };
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
function _mntAksoKur(kapId, W, P){
  if(typeof document==='undefined') return false;
  var kap=document.getElementById(kapId); if(!kap) return false;
  var sabit=Number(kap.getAttribute('data-w'));            // kroki: hep aynı genişlik
  if(sabit>200) W=sabit;
  else if(!(W>200)) W=Math.floor(kap.clientWidth)-2;
  if(!(W>200)) return false;
  var tam=kap.getAttribute('data-tam')==='1', ek={ sec:kap.getAttribute('data-sec') };
  P=P||_mnt2DPencereVeri();
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
  var o=Object.assign({}, c.o, { kam:{ az:A.az, el:A.el }, yakin:G.yakin, kay:G.kay, yer:c.yer });
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
// vurgulanan işaretin kenarı vurgu rengini alır.
function _mntAksoVurguBagla(kap){
  if(!kap || kap.__mntAksoVurgu) return;
  kap.__mntAksoVurgu=true;
  var son=null;
  var bitir=function(){ if(son){ Array.prototype.forEach.call(kap.querySelectorAll('.ve-ak-vurgu'), function(e){ e.classList.remove('ve-ak-vurgu'); }); son=null; } };
  kap.addEventListener('mousemove', function(e){
    var el=e.target && e.target.closest ? e.target.closest('svg.ve-mnt2d-akso [data-ak]') : null;
    var k=el ? el.getAttribute('data-ak') : null;
    if(k==='duvar') k=null;
    if(k===son) return;
    bitir();
    if(!k) return;
    son=k;
    Array.prototype.forEach.call(kap.querySelectorAll('svg.ve-mnt2d-akso [data-ak="'+k+'"]'), function(x){ x.classList.add('ve-ak-vurgu'); });
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
function _mnt2DIsaretFoy(P){
  var M=P.M, cg=P.veri.cg, eks=0;
  var hucre=function(v){ return _mntBos(v) ? '<td class="eks">boş</td>' : '<td>'+_mntS(_mntNum(v),0)+'</td>'; };
  var sat=function(k, no, ad, x, y, z){
    if(_mntBos(x) || _mntBos(y) || _mntBos(z)) eks++;
    return '<tr data-ak="'+k+'"><td>'+no+'</td><td class="sol" title="'+_mntEsc(ad)+'">'+_mntEsc(ad)+'</td>'+hucre(x)+hucre(y)+hucre(z)+'</tr>';
  };
  var h=_mntFoyAc([{ b:'No', gen:'12%' }, { b:'Ad', gen:'40%', sinif:'sol' }, { b:'X', gen:'16%' }, { b:'Y', gen:'16%' }, { b:'Z', gen:'16%' }],
                  'İşaretler', 've-mnt-foy--sik');
  if(cg) h+='<tr class="top" data-ak="G"><td>G</td><td class="sol">Birleşik CG</td><td>'+_mntS(cg.x,0)+'</td><td>'+_mntS(cg.y,0)+'</td><td>'+_mntS(cg.z,0)+'</td></tr>';
  M.g.components.forEach(function(c, i){ h+=sat('g'+(i+1), String(i+1), c.name, c.cgx, c.cgy, c.cgz); });
  M.g.mounts.forEach(function(m, i){ h+=sat('T'+(i+1), 'T'+(i+1), m.name, m.x, m.y, m.z); });
  h+=_MNT_FOY_KAPA;
  if(eks) h+=_mntNot(eks+' işaretin konumu eksik: 0 alındı.', 'warn');
  return h;
}
// GÖRÜNÜMLER PENCERESİ — TEK görünüm (kullanıcı kararı 2026-10-16): döndürülen
// aksonometri, göstergesi ve altında işaretlerinin föyü (çizimdeki numaraların
// açılımı, konumları). Tek kategori; sağ sütun yok — kabuk tek sütuna iner.
function getMnt2DViewPropertiesHTML(node){
  if(!node.data) node.data={};
  var P=_mnt2DPencereVeri(), M=P.M, kapId='ve-mnt-akso3b-'+node.id;
  var bos=!M.g.components.length && !M.g.mounts.length;
  var em=M.g.components.length+' gövde · '+M.g.mounts.length+' takoz'+(M.mTop>0 ? ' · '+_mntS(M.mTop,1)+' kg' : '');
  var govde=bos ? '<div class="ve-mnt-kroki-bos">Görüntülenecek bileşen yok.</div>'+_mntBolum('İşaretler', em, _mntNot('Kanvasta model yok.', ''))
    : '<div class="ve-mnt-akso-kap" id="'+kapId+'">'+_mntAksoHTML(P, _MNT_KROKI_W, false, kapId)+'</div>'
      + _mntBolum('İşaretler', em, '<div class="ve-mnt-foy-odak" onmouseover="_mntFoyOdak(event,\''+kapId+'\')"'
        + ' onmouseleave="_mntAksoOdak(\''+kapId+'\',null)">'+_mnt2DIsaretFoy(P)+'</div>');
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
  var comps=g.components.map(function(c){ return {id:c.id, name:c.name, mass:num(c.mass), x:num(c.cgx), y:num(c.cgy), z:num(c.cgz)}; })
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
  return '<td class="gir'+(zor?' zor':'')+'"><input type="text" inputmode="decimal" id="ve-mnt-lib-'+field+'-'+node.id+'"'
    + ' value="'+_mntEsc(v)+'" aria-label="'+_mntEsc(aria)+'"'+(opt.zorunlu?' data-zorunlu':'')
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
// Girdinin türü — tetikleyici, liste satırı ve rozet AYNI koddan okur:
// eğrili · değiştirilmiş gömülü · gömülü · özel. Renk CSS'te (`data-t`).
function _mntLibTur(e){
  return _mntEntryHasLaw(e) ? 'egri' : (e.overridden ? 'degisti' : (e.builtin ? 'gomulu' : 'ozel'));
}
function _mntLibRozet(e){
  var t=(!e.builtin) ? 'ozel' : (e.overridden ? 'degisti' : 'gomulu');
  return '<span class="ve-mnt-rozet" data-t="'+t+'">'+({ ozel:'Özel', degisti:'Değiştirildi', gomulu:'Gömülü' })[t]+'</span>';
}
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
// Açılır listede tek tıklanabilir takoz satırı (seçili → koyu zemin + ✓).
// data-search: filtrelemenin okuduğu normalleştirilmiş "ad + anahtar" metni.
function _mntLibOptionRow(node, e, sel){
  var isSel=!!sel && e.key===sel.key;
  var h='<div class="mntlib-opt'+(isSel?' sel':'')+'" role="option" aria-selected="'+(isSel?'true':'false')+'"'
    +' data-search="'+_mntEsc(_mntLibNorm(e.name+' '+e.key))+'"'
    +' onclick="veMntLibSelect(\''+node.id+'\',\''+_mntEsc(e.key)+'\')">';
  h+='<span class="mntlib-dot" data-t="'+_mntLibTur(e)+'"></span>';
  h+='<span class="mntlib-opt-name">'+_mntEsc(e.name)+'</span>';
  h+='<span class="mntlib-kz">kz '+veSayi(_mntNum(e.sz), 0)+'</span>';
  // ∿ / ✓ yuvaları HER satırda basılır (gerekmiyorsa boş) → kz sütunu hizalı kalır
  h+='<span class="mntlib-wave"'+(_mntEntryHasLaw(e)?' title="nonlineer eğri">'+veIkon('activity'):'>')+'</span>';
  h+='<span class="mntlib-check">'+(isSel?veIkon('check'):'')+'</span>';
  h+='</div>';
  return h;
}
// Kapalı hâldeki seçici: seçili takozun nokta/ad/kz/∿ özeti + ▾.
function _mntLibTrigger(node, sel){
  var h='<button type="button" class="mntlib-trigger" id="mntlib-tr-'+node.id+'"'
    +' aria-haspopup="listbox" aria-expanded="false" title="Takoz listesini aç"'
    +' onclick="veMntLibDropdownToggle(\''+node.id+'\',event)">';
  if(sel){
    h+='<span class="mntlib-dot" data-t="'+_mntLibTur(sel)+'"></span>';
    h+='<span class="mntlib-trigger-name">'+_mntEsc(sel.name)+'</span>';
    h+='<span class="mntlib-kz">kz '+veSayi(_mntNum(sel.sz), 0)+'</span>';
    if(_mntEntryHasLaw(sel)) h+='<span class="mntlib-wave" title="nonlineer eğri">'+veIkon('activity')+'</span>';
  } else {
    h+='<span class="mntlib-trigger-name empty">Takoz seçilmedi</span>';
  }
  h+=veIkon('chevron-down', 'mntlib-caret')+'</button>';
  return h;
}
// Açılır liste gövdesi: arama kutusu + iki grup (Özel / Gömülü) + satırlar.
// Gizli olarak basılır; veMntLibDropdownToggle yalnız hidden'ı kaldırır.
function _mntLibDropdown(node, custom, builtins, sel){
  var nOv=builtins.filter(function(e){ return e.overridden; }).length;
  var h='<div class="mntlib-dd" id="mntlib-dd-'+node.id+'" role="listbox" hidden>';
  h+='<input type="text" class="mntlib-search" id="mntlib-q-'+node.id+'" placeholder="Takoz ara… (ad ya da kod)"'
    +' autocomplete="off" oninput="veMntLibFilter(\''+node.id+'\')"'
    +' onkeydown="veMntLibSearchKey(event,\''+node.id+'\')">';
  // Grup sayacı ayrı bir span: arama sırasında EŞLEŞEN sayısına döner (aksi
  // hâlde "Gömülü Katalog · 27" başlığı 3 satırın üstünde asılı kalır ve
  // listenin süzüldüğünü yalanlar). data-total ile aramasız hâline geri döner.
  var cnt=function(n){ return '<span class="mntlib-count" data-total="'+n+'">'+n+'</span>'; };
  h+='<div class="mntlib-list" id="mntlib-list-'+node.id+'">';
  h+='<div class="mntlib-group">Özel Takozlar · '+cnt(custom.length)+'</div>';
  if(!custom.length){
    h+='<div class="mntlib-note">Özel takoz yok.</div>';
  } else {
    custom.forEach(function(e){ h+=_mntLibOptionRow(node, e, sel); });
  }
  h+='<div class="mntlib-group">Gömülü Katalog · '+cnt(builtins.length)+(nOv?' · '+nOv+' değiştirildi':'')+'</div>';
  builtins.forEach(function(e){ h+=_mntLibOptionRow(node, e, sel); });
  h+='<div class="mntlib-empty" id="mntlib-none-'+node.id+'" hidden>Eşleşen takoz yok.</div>';
  h+='</div></div>';
  return h;
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
  return _mntBolum('Rijitlik', '[N/mm] · '+_mntEsc(e.name), f+_MNT_FOY_KAPA+kapi);
}
// TAŞIMA KAPASİTESİ — tipin özelliği, Tip kategorisinde. Takoza uygulanınca
// kopyalandığı (tanımsızsa takozdaki eski değerin silindiği) kılavuzda.
function _mntLibKapasiteHTML(node, e, setter){
  var mlv=(e.maxLoad===undefined||e.maxLoad===null)?'':e.maxLoad;
  var kap=_mntIzgara(2,
      '<label class="ve-fp-f"><span class="ve-fp-l">Maks. eksenel yük <u>[kg]</u></span>'
    + '<input class="ve-fp-inp" type="text" inputmode="decimal" id="ve-mnt-lib-maxLoad-'+node.id+'" value="'+_mntEsc(mlv)+'"'
    + ' placeholder="tanımsız" onchange="'+setter+'(\''+node.id+'\',\''+_mntEsc(e.key)+'\',\'maxLoad\',this.value)"></label>'
    + _mntOku('Kuvvet karşılığı <u>(1 g)</u>', (_mntNum(mlv,0)>0) ? _mntS(_mntNum(mlv)*9.81/1000,2)+' kN' : '—', { id:'ve-mnt-lib-kapN-'+node.id }));
  return _mntBolum('Taşıma kapasitesi', 'tipin özelliği · hesaba girmez', kap);
}
// Grafiğin göstergesi — statik (lineer ya da eğri), dinamik, ölçüm noktaları.
// Örnek çizgiler SVG özniteliğiyle, yazı rengi CSS'ten.
function _mntLibLejant(hasCurve, hasMarkers){
  function sw(inner){ return '<svg class="ve-mnt-lej-cizgi" viewBox="0 0 16 9" aria-hidden="true">'+inner+'</svg>'; }
  var statColor=hasCurve?'var(--accent-danger)':'var(--accent-primary)';
  return '<div class="ve-mnt-kroki-lej">'
    + '<span>'+sw('<line x1="1" y1="4.5" x2="15" y2="4.5" stroke="'+statColor+'" stroke-width="2"/>')+'statik'+(hasCurve?' (eğri)':' (lineer)')+'</span>'
    + '<span>'+sw('<line x1="1" y1="4.5" x2="15" y2="4.5" stroke="var(--accent-warning)" stroke-width="1.6" stroke-dasharray="4 2.5"/>')+'dinamik</span>'
    + (hasMarkers ? '<span>'+sw('<circle cx="8" cy="4.5" r="2.6" fill="var(--bg-primary)" stroke="var(--accent-danger)" stroke-width="1.3"/>')+'ölçüm noktası</span>' : '')
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
// Kuvvet–sehim GRAFİĞİ (eksen bazlı: 'x'|'y'|'z'): statik yasa (analitik fit, ya da
// PCHIP nokta eğrisi, ya da lineer k_s·δ), dinamik referans slope (k_d·δ, kesikli) ve
// (nokta eğrisi için) ölçüm noktaları. Salt-görsel SVG.
function _mntLibForceChart(e, axis){
  axis=axis||'z';
  var A=axis.toUpperCase();
  var sz=_mntNum(e['s'+axis]), dz=_mntNum(e['d'+axis]);
  var fit=e['fit'+A]||null;
  var rawc=e['curve'+A];
  var raw=(!fit && Array.isArray(rawc) && rawc.length>=2)?rawc:null;
  var pts=raw?raw.map(function(p){ return [_mntNum(p[0]), _mntNum(p[1])]; }).sort(function(a,b){ return a[0]-b[0]; }):null;
  var hasCurve=!!fit || !!pts;
  var dmin, dmax;
  if(fit){ var dm=_mntFitDomain(fit); dmin=dm[0]; dmax=dm[1]; }
  else if(pts){ dmin=pts[0][0]; dmax=pts[pts.length-1][0]; }
  else { dmin=-15; dmax=15; }
  if(!(dmax>dmin)){ dmin-=1; dmax+=1; }
  // Statik yasa değerlendiricisi
  var spline=null;
  if(!fit && pts && pts.length>=3 && typeof veBuildPchipSpline==='function'){
    try{ spline=veBuildPchipSpline(pts.map(function(p){ return {rpm:p[0], torque:p[1]}; })); }catch(_e){ spline=null; }
  }
  function fStat(x){
    var v;
    if(fit) v=_mntFitForce(fit, x);
    else if(!pts) v=sz*x;
    else if(spline && typeof veEvalPchip==='function') v=veEvalPchip(spline, x);
    else v=_mntLinInterp(pts, x);
    return isFinite(v)?v:0;
  }
  // Örnekle
  var N=64, i, x, statPts=[], dynPts=[], allF=[0];
  for(i=0;i<=N;i++){ x=dmin+(dmax-dmin)*i/N; var fs=fStat(x), fd=dz*x; statPts.push([x,fs]); dynPts.push([x,fd]); allF.push(fs); allF.push(fd); }
  if(pts) pts.forEach(function(p){ allF.push(p[1]); });
  var fmin=Math.min.apply(null, allF), fmax=Math.max.apply(null, allF);
  if(!(fmax>fmin)){ fmin-=1; fmax+=1; }
  var fpad=(fmax-fmin)*0.10; fmin-=fpad; fmax+=fpad;
  // Geometri (yan yana 3 grafik için kompakt). Yazı ölçeğin tabanında
  // (veThemeFs('micro')): 9–9,5 birim ekranda 9,1 px kalıyordu.
  var W=300, H=212, plotL=44, plotR=292, plotT=12, plotB=172;
  function px(xx){ return plotL+(xx-dmin)/(dmax-dmin)*(plotR-plotL); }
  function py(ff){ return plotB-(ff-fmin)/(fmax-fmin)*(plotB-plotT); }
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block; font-family:'+_MNT2D_YUZ+';">';
  s+='<rect x="'+plotL+'" y="'+plotT+'" width="'+(plotR-plotL)+'" height="'+(plotB-plotT)+'" fill="var(--bg-input)" opacity="0.3"/>';
  // Izgara + eksen etiketleri (4 işaret hedefi — kalabalık olmasın)
  var xticks=_mnt2DNiceTicks(dmin,dmax,4), yticks=_mnt2DNiceTicks(fmin,fmax,4);
  xticks.forEach(function(tv){ var gx=px(tv); if(gx<plotL-0.5||gx>plotR+0.5) return;
    s+='<line x1="'+_mnt2DR(gx)+'" y1="'+plotT+'" x2="'+_mnt2DR(gx)+'" y2="'+plotB+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.35"/>';
    s+=_mnt2DText(gx, plotB+14, _mnt2DTick(tv), 'middle', 'var(--text-muted)', _mnt2DFs('micro'));
  });
  // BİRİM EKSENİN BAŞLIĞINDA, DEĞERDE SONEK YOK: kuvvet bin newtonu aşınca
  // eksen kN'dir ("10k" yazılıyordu, başlık [N] derken). Ondalık adımdan.
  var kN=Math.max(Math.abs(fmin), Math.abs(fmax))>=1000;
  var fAdim=yticks.length>1 ? Math.abs(yticks[1]-yticks[0])/(kN?1000:1) : 1;
  var fBas=fAdim>=1 ? 0 : (fAdim>=0.1 ? 1 : 2);
  yticks.forEach(function(tv){ var gy=py(tv); if(gy<plotT-0.5||gy>plotB+0.5) return;
    s+='<line x1="'+plotL+'" y1="'+_mnt2DR(gy)+'" x2="'+plotR+'" y2="'+_mnt2DR(gy)+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.35"/>';
    s+=_mnt2DText(plotL-4, _mnt2DR(gy)+3.5, veSayi(kN ? tv/1000 : tv, fBas, { eksi:'−' }), 'end', 'var(--text-muted)', _mnt2DFs('micro'));
  });
  // Sıfır eksenleri (vurgulu)
  var y0=py(0), x0=px(0);
  if(y0>=plotT&&y0<=plotB) s+='<line x1="'+plotL+'" y1="'+_mnt2DR(y0)+'" x2="'+plotR+'" y2="'+_mnt2DR(y0)+'" stroke="var(--text-muted)" stroke-width="1"/>';
  if(x0>=plotL&&x0<=plotR) s+='<line x1="'+_mnt2DR(x0)+'" y1="'+plotT+'" x2="'+_mnt2DR(x0)+'" y2="'+plotB+'" stroke="var(--text-muted)" stroke-width="1"/>';
  // Dinamik referans (kesikli) + statik yasa (kalın) + ölçüm noktaları
  s+='<polyline points="'+dynPts.map(function(p){ return _mnt2DR(px(p[0]))+','+_mnt2DR(py(p[1])); }).join(' ')+'" fill="none" stroke="var(--accent-warning)" stroke-width="1.6" stroke-dasharray="5 3" opacity="0.9"/>';
  var statColor=hasCurve?'var(--accent-danger)':'var(--accent-primary)';
  s+='<polyline points="'+statPts.map(function(p){ return _mnt2DR(px(p[0]))+','+_mnt2DR(py(p[1])); }).join(' ')+'" fill="none" stroke="'+statColor+'" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
  if(pts) pts.forEach(function(p){ s+='<circle cx="'+_mnt2DR(px(p[0]))+'" cy="'+_mnt2DR(py(p[1]))+'" r="2.6" fill="var(--bg-primary)" stroke="var(--accent-danger)" stroke-width="1.5"/>'; });
  // Eksen başlıkları
  s+=_mnt2DText((plotL+plotR)/2, H-3, 'sehim δ [mm]', 'middle', 'var(--text-secondary)', _mnt2DFs('micro'));
  var yc=(plotT+plotB)/2;
  s+='<text x="11" y="'+yc+'" text-anchor="middle" font-size="'+_mnt2DFs('micro')+'" font-family="'+_MNT2D_YUZ+'" fill="var(--text-secondary)" transform="rotate(-90 11 '+yc+')">kuvvet f ['+(kN ? 'kN' : 'N')+']</text>';
  s+='</svg>';
  return s;
}
// Eksenin yasası — grafiğin başlığı ve yasa föyü AYNI okumadan.
function _mntLibYasa(e, ax){
  var A=ax.toUpperCase(), f=e['fit'+A], c=e['curve'+A];
  if(f) return { tur:'fit', ad:'analitik fit', ayr:(f.form==='asym' ? 'asimetrik · basma sınırı' : 'polinom') };
  if(Array.isArray(c) && c.length>=2) return { tur:'nokta', ad:'nokta tablosu', ayr:c.length+' nokta' };
  return { tur:'lineer', ad:'lineer', ayr:_mntSym('k<sub>s</sub>·δ') };
}
// SEÇİLİ EKSEN GÖRÜNÜM DURUMUDUR, modelde değil: kaydedilmez, geri alınmaz.
var VE_MNT_LIB_EKSEN = {};
function veMntLibEksen(nodeId, ax){
  if(['x','y','z'].indexOf(ax)<0) return;
  VE_MNT_LIB_EKSEN[nodeId]=ax;
  veMntPencereTazele();                    // yalnız grafik bloğu değişir — pencere kurulmaz
}
// KUVVET–SEHİM — tek eksen sütun genişliğinde (eskiden üç grafik yan
// yana 1040 px'lik modaldaydı). Altında üç eksenin yasası; özel girdide
// düşey (z) eğrinin noktaları bir föyde düzenlenir.
function _mntLibEgriHTML(node, e){
  var ax=VE_MNT_LIB_EKSEN[node.id] || 'z';
  var Y=_mntLibYasa(e, ax), eksen=_MNT_LIB_EKS.filter(function(a){ return a[0]===ax; })[0];
  var seg='<div class="ve-mnt-seg" role="group" aria-label="Eksen">'+_MNT_LIB_EKS.map(function(a){
      return '<button type="button" aria-pressed="'+(a[0]===ax)+'" onclick="veMntLibEksen(\''+node.id+'\',\''+a[0]+'\')">'+a[0].toUpperCase()+'</button>';
    }).join('')+'</div>';
  var h='<div class="ve-mnt-kroki" id="ve-mnt-lib-gr-'+node.id+'" data-tazele>'
    + '<div class="ve-mnt-kroki-bas"><b>'+_mntSym('F<sub>'+ax+'</sub>')+' · '+eksen[2]+'</b><em>'+Y.ad+'</em>'+seg+'</div>'
    + _mntLibForceChart(e, ax)
    + _mntLibLejant(Y.tur!=='lineer', Y.tur==='nokta')+'</div>';
  var f=_mntFoyAc([{ b:'Eksen', gen:'30%' }, { b:'Yasa', gen:'38%', sinif:'sol' }, { b:'Ayrıntı', gen:'32%', sinif:'sol' }], 'Eksenlerin yasası');
  _MNT_LIB_EKS.forEach(function(a){
    var y=_mntLibYasa(e, a[0]);
    f+='<tr><td>'+a[1]+' <span class="sf">'+a[2]+'</span></td><td class="sol">'+y.ad+'</td><td class="sol sf">'+y.ayr+'</td></tr>';
  });
  h+=_mntBolum('Yasa', _mntEsc(e.name)+' · δ [mm] · f [N]', f+_MNT_FOY_KAPA);
  if(e.builtin){
    h+=_mntNot(_mntEntryHasLaw(e) ? '<b>Gömülü takoz</b> — eğriler fabrika değeri, salt okunur.'
      : '<b>Gömülü takoz</b> — lineer.', '');
  } else {
    h+=_mntLibCurveEditor(node, _mntLibCustomEntry(node, e.key) || e);
  }
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
      : _mntDurum('ok', 'tamam');
  var egri=_mntDurum('ok', _mntEntryHasLaw(e) ? 'nonlineer' : 'lineer');
  return { rij:rij, egri:egri };
}
// KULLANIM — bu tip modelde hangi takozlarda. Takoz uygulandığı anın
// değerlerini KOPYALAR (veMntApplyLib → _mntLibUygula); tip sonradan
// değişince takoz eskisinde kalır ve bunu yalnız bu karşılaştırma gösterir.
function _mntLibKullanimHTML(node, e){
  var list=(typeof nodes!=='undefined' && Array.isArray(nodes)) ? nodes : [];
  var tk=list.filter(function(n){ return n && n.type==='mnt-mount' && n.data && n.data.libKey===e.key; });
  var h, em='bu modelde';
  if(!tk.length){
    h=_mntNot('Bu tip modeldeki hiçbir takoza uygulanmamış.', '');
  } else {
    em=tk.length+' takoz';
    var farkVar=false;
    h=_mntFoyAc([{ b:'Takoz', gen:'56%' }, { b:'Değerler', gen:'44%', sinif:'sol' }], 'Bu tipi kullanan takozlar');
    tk.forEach(function(n){
      var d=n.data, fark=_MNT_RIJ_KUT.filter(function(p){ return _mntNum(d[p[0]],NaN)!==_mntNum(e[p[1]],NaN); });
      if(fark.length) farkVar=true;
      h+='<tr><td>'+_mntEsc(_mntNodeName(n))+'</td>'
        + '<td class="sol'+(fark.length?' kr':'')+'"'+(fark.length ? ' title="'+_mntEsc(fark.map(function(p){ return p[2]; }).join(' · '))+'"' : '')+'>'
        + (fark.length ? fark.length+' değer farklı' : 'tiple aynı')+'</td></tr>';
    });
    h+=_MNT_FOY_KAPA;
    if(farkVar) h+=_mntNot('Takozlarda tipin eski değerleri var.', 'warn');
  }
  return _mntBolum('Kullanım', em, h, { id:'ve-mnt-lib-kul-'+node.id, tazele:true });
}
function _mntLibKatalogHTML(custom, builtins, nCurve){
  var nOv=builtins.filter(function(e){ return e.overridden; }).length;
  var f=_mntFoyAc([{ b:'Katalog', gen:'64%' }, { b:'Adet', gen:'36%' }], 'Katalog')
    + '<tr><td>Özel takoz</td><td>'+custom.length+'</td></tr>'
    + '<tr><td>Gömülü takoz</td><td>'+builtins.length+'</td></tr>'
    + '<tr><td>Değiştirilmiş gömülü</td><td>'+nOv+'</td></tr>'
    + '<tr><td>Nonlineer yasalı</td><td>'+nCurve+'</td></tr>'+_MNT_FOY_KAPA;
  // Gömülü takozdaki değişikliğin nereye yazıldığı (düğüme; "Fabrika" geri
  // döndürür) kılavuzda — pencere açıklama taşımaz (FEAD kural 45).
  return _mntBolum('Katalog', '', f);
}
function _mntLibKimlikHTML(node, e, setter){
  var eylem=(!e.builtin)
    ? '<button type="button" class="ve-fp-dugme" onclick="veMntLibRemove(\''+node.id+'\',\''+_mntEsc(e.key)+'\')">'+veIkon('trash')+' Sil</button>'
    : '<button type="button" class="ve-fp-dugme" onclick="veMntLibResetBuiltin(\''+node.id+'\',\''+_mntEsc(e.key)+'\')"'
      + (e.overridden ? '' : ' aria-disabled="true"')+'>'+veIkon('rotate-ccw')+' Fabrika</button>';
  return '<div class="ve-mnt-lib-kim">'
    + '<input class="ve-fp-inp ve-fp-inp--text" type="text" id="ve-mnt-lib-name-'+node.id+'" value="'+_mntEsc(e.name)+'"'
    + ' aria-label="Takoz tipinin adı" onchange="'+setter+'(\''+node.id+'\',\''+_mntEsc(e.key)+'\',\'name\',this.value)">'
    + _mntLibRozet(e)+eylem+'</div>';
}
// TAKOZ ÖZELLİKLERİ PENCERESİ — sütunda (2026-10-15'e dek 1040 px'lik modal
// bir görüntüleyiciydi: seçici + üç eksen grafiği yan yana). Üç kategori,
// gövdede alt alta: TİP (açılır liste, seçili tipin kimliği ve taşıma
// kapasitesi — FEAD'in Kayış penceresinin Profil'i gibi seçim en üstte) ·
// RİJİTLİK · KUVVET–SEHİM; sağ sütunda Kullanım (bu tip hangi takozlarda,
// değerleri tiple aynı mı) ve Katalog. Gövdenin üstünde yalnız eksik bandı
// durur (aile kuralı); alttaki iki kategori seçili tipin adını bölüm
// künyesinde taşır. Açılır listenin davranışı (arama, klavye) değişmedi.
function getMntLibraryPropertiesHTML(node){
  var d=_mntLibEnsure(node);
  var custom=d.mounts;                                        // bu düğümün özel takozları (ham girdiler; builtin yok → özel)
  var builtins=veMntGetLibraryList().filter(function(e){ return e.builtin; });
  var nCurve=custom.concat(builtins).filter(_mntEntryHasLaw).length;
  var sel=null;
  if(d._selKey) sel=custom.concat(builtins).find(function(e){ return e.key===d._selKey; });
  if(!sel) sel=custom[0]||builtins[0]||null;
  var secici='<div class="mntlib-bar">'
    + '<div class="mntlib-picker">'+_mntLibTrigger(node, sel)+_mntLibDropdown(node, custom, builtins, sel)+'</div>'
    + '<button type="button" class="mntlib-add" onclick="veMntLibAdd(\''+node.id+'\')">'+veIkon('plus')+' Yeni takoz</button>'
    + '</div>';
  var katalog=_mntLibKatalogHTML(custom, builtins, nCurve);
  var tipEm=custom.length+' özel · '+builtins.length+' gömülü';
  if(!sel){
    return _mntPencereKabuk(node, [
      { k:'tip', ad:'Tip', govde:_mntBolum('Takoz tipi', tipEm, secici+_mntNot('Takoz seçilmedi.', '')) },
      { k:'rij', ad:'Rijitlik', govde:_mntBolum('Rijitlik', '[N/mm]', _mntNot('Takoz seçilmedi.', '')) }],
      katalog);
  }
  var setter=sel.builtin ? 'veMntLibSetBuiltin' : 'veMntLibSet';
  var D=_mntLibDurumlari(node, sel);
  var kategoriler=[
    { k:'tip', ad:'Tip', govde:_mntBolum('Takoz tipi', tipEm, secici+_mntLibKimlikHTML(node, sel, setter))
        + _mntLibKapasiteHTML(node, sel, setter),
      durum:_mntDurum('ok', sel.builtin ? (sel.overridden ? 'değiştirildi' : 'gömülü') : 'özel') },
    { k:'rij', ad:'Rijitlik', govde:_mntLibRijitlikHTML(node, sel, setter), durum:D.rij },
    { k:'egri', ad:'Kuvvet–sehim', govde:_mntLibEgriHTML(node, sel), durum:D.egri }
  ];
  return _mntPencereKabuk(node, kategoriler, _mntLibKullanimHTML(node, sel)+katalog);
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
// Arama: satırları DOM'da gizler/gösterir; boşalan grup başlığı gizlenir,
// dolu başlığın sayacı EŞLEŞEN sayısına döner (arama silinince toplama geri).
function veMntLibFilter(nodeId){
  if(typeof document==='undefined') return;
  var list=document.getElementById('mntlib-list-'+nodeId);
  if(!list) return;
  var q=document.getElementById('mntlib-q-'+nodeId);
  var needle=_mntLibNorm(q?q.value:'').trim();
  // Grubu kapat: başlığı gizle ya da sayacını güncelle (opt sayısı; not satırı sayılmaz).
  var closeGrp=function(g, nOpt, nRow){
    if(!g) return;
    g.hidden=(nRow===0);
    var c=g.querySelector('.mntlib-count');
    if(c) c.textContent = needle ? String(nOpt) : (c.getAttribute('data-total')||String(nOpt));
  };
  var kids=list.children, grp=null, grpOpt=0, grpRow=0, hits=0;
  for(var i=0;i<kids.length;i++){
    var el=kids[i], cl=el.classList;
    if(cl.contains('mntlib-group')){
      closeGrp(grp, grpOpt, grpRow);
      grp=el; grpOpt=0; grpRow=0;
    } else if(cl.contains('mntlib-opt')){
      var ok=!needle || (el.getAttribute('data-search')||'').indexOf(needle)>=0;
      el.hidden=!ok;
      if(ok){ grpOpt++; grpRow++; hits++; }
    } else if(cl.contains('mntlib-note')){
      el.hidden=!!needle;                  // "henüz özel takoz yok" notu yalnız aramasız görünür
      if(!needle) grpRow++;
    }
  }
  closeGrp(grp, grpOpt, grpRow);
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
var _MNT_TORK_ALANLARI=['Te','Rstall','g1','g2','g3','g4','g5','g6','gR','iTransfer','phiFwd','phiRev','derate',
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
function _mntGatherForSolver(solver, liste){
  var masses=[], mounts=[];
  (liste || (typeof nodes!=='undefined' && Array.isArray(nodes)?nodes:[])).forEach(function(n){
    if(!n) return;
    var def=_mntDef(n)||{};
    if(def.isMountBody){
      var d=n.data||{};
      masses.push({ id:n.id, name:_mntNodeName(n), mass:d.mass, cgx:d.cgx, cgy:d.cgy, cgz:d.cgz, Ixx:d.Ixx, Iyy:d.Iyy, Izz:d.Izz, Ixy:d.Ixy, Ixz:d.Ixz, Iyz:d.Iyz, pointMass:!!d.pointMass });
    } else if(def.isMount){
      var m=n.data||{};
      mounts.push({ id:n.id, name:_mntNodeName(n), x:m.x, y:m.y, z:m.z, kxs:m.kxs, kys:m.kys, kzs:m.kzs, kxd:m.kxd, kyd:m.kyd, kzd:m.kzd,
                    maxLoad:m.maxLoad,                                        // taşıma kapasitesi [kg] (opsiyonel, fiziğe girmez)
                    fitX:(m.fitX||null), fitY:(m.fitY||null), fitZ:(m.fitZ||null),   // opsiyonel analitik fit (x/y/z)
                    curveX:(Array.isArray(m.curveX)?m.curveX:null),                  // ya da nokta tablosu (x/y/z)
                    curveY:(Array.isArray(m.curveY)?m.curveY:null),
                    curveZ:(Array.isArray(m.curveZ)?m.curveZ:null) });
    }
  });
  return { components:masses, mounts:mounts, torque:_mntGatherTorque(liste) };
}
// Girilen kinematikten tork yük durumlarını (ileri/geri) kur. Eksikse boş döner.
// İleri = 1. vites (en yüksek redüksiyon), geri = Geri vites. T_shaft çekirdeğin
// torqueChain'i ile hesaplanır; Tx = −T_shaft (SPEC T5 işaret düzeni).
function _mntTorqueCases(torque){
  var C=veMountCore; if(!C || !C.torqueChain) return [];
  var tq=torque||{};
  var Te=_mntNum(tq.Te,0), Rstall=_mntNum(tq.Rstall,0), g1=_mntNum(tq.g1,0), gR=_mntNum(tq.gR,0);
  var iTr=_mntNum(tq.iTransfer,1); if(iTr===0) iTr=1;
  var phiF=_mntNum(tq.phiFwd,1); if(phiF===0) phiF=1;
  var phiR=_mntNum(tq.phiRev,1); if(phiR===0) phiR=1;
  var der=_mntNum(tq.derate,1); if(der===0) der=1;
  if(!(Te>0 && Rstall>0 && g1!==0)) return [];
  var cases=[];
  var Tfwd=C.torqueChain({Te:Te, Rstall:Rstall, iGear:g1, iTransfer:iTr, phiAxle:phiF, derate:der});
  cases.push({name:'Forward Torque', n:[0,0,-1], T:[-Tfwd,0,0]});
  if(gR!==0){
    var Trev=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gR, iTransfer:iTr, phiAxle:phiR, derate:der});
    cases.push({name:'Reverse Torque', n:[0,0,-1], T:[-Trev,0,0]});
  }
  return cases;
}

// Kriter 3 — HER tanımlı vites için ayrı tork durumu (mount kuvvetleri kontrolü).
// _mntTorqueCases yalnız 1. vitesi (maks tork) ana matrise koyar; bu ise g1..g6 +
// geri için ayrı durumlar döndürür. Kütle/rijitlik sabit, yalnız T_shaft vites
// oranıyla ölçeklenir → yüksek vites daha düşük kuvvet (1. vites bağlayıcıdır).
// Dönüş öğeleri gearLabel/ratio/Tshaft meta verisini taşır (rapor §8.9 tablosu).
function _mntGearTorqueCases(torque){
  var C=veMountCore; if(!C || !C.torqueChain) return [];
  var tq=torque||{};
  var Te=_mntNum(tq.Te,0), Rstall=_mntNum(tq.Rstall,0);
  var iTr=_mntNum(tq.iTransfer,1); if(iTr===0) iTr=1;
  var phiF=_mntNum(tq.phiFwd,1); if(phiF===0) phiF=1;
  var phiR=_mntNum(tq.phiRev,1); if(phiR===0) phiR=1;
  var der=_mntNum(tq.derate,1); if(der===0) der=1;
  if(!(Te>0 && Rstall>0)) return [];
  var out=[];
  ['g1','g2','g3','g4','g5','g6'].forEach(function(k,i){
    var gr=_mntNum(tq[k],0); if(gr===0) return;
    var Ts=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gr, iTransfer:iTr, phiAxle:phiF, derate:der});
    out.push({name:(i+1)+'. Vites', gearLabel:(i+1)+'. Vites', ratio:gr, Tshaft:Ts, n:[0,0,-1], T:[-Ts,0,0]});
  });
  var gR=_mntNum(tq.gR,0);
  if(gR!==0){
    var Tr=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gR, iTransfer:iTr, phiAxle:phiR, derate:der});
    out.push({name:'Geri Vites', gearLabel:'Geri', ratio:gR, Tshaft:Tr, n:[0,0,-1], T:[-Tr,0,0]});
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
    loadCases: MNT_AUTO_CASES.concat(_mntTorqueCases(gather.torque))
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
function _mntImza(si, torque, sd){
  var t=torque||{}, d=sd||{};
  var v={
    c:(si.components||[]).map(function(c){ return [c.id||'', c.mass, c.cg, c.pointMass?0:c.I, c.pointMass?1:0]; }),
    m:(si.mounts||[]).map(function(m){ return [m.id||'', m.pos, m.kstat, m.kdyn, m.fCap||0, m.fits||0, m.curves||0]; }),
    t:Object.keys(t).sort().map(function(k){ return [k, _mntNum(t[k], null)]; }),
    s:[d.solveMode||'auto', _mntZetaOf({ data:d }), _mntNum(d.shockG, MNT_SHOCK_G), _mntNum(d.shockMs, MNT_SHOCK_MS)]
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
  var imza=_mntImza(_mntToSI(g, R.g||9.81), g.torque, solver.data);
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
  var em=(satirlar.length-tork)+' otomatik durum'+(tork ? ' + '+tork+' tork' : ' · tork girdisi yok');
  return '<div id="ve-mnt-cdur-'+node.id+'" data-tazele>'+_mntBolum('Yük kitabı', em, f+_MNT_FOY_KAPA)+'</div>';
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
    ? _mntDurumKutu('<b>Model çözülmedi.</b>', 'warn')
    : bayat
      ? _mntDurumKutu('<b>Model son hesaptan sonra değişti</b> — '+ozet+'.', 'warn')
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
      + (cozuldu ? ' onclick="veMntGenerateReport(\''+node.id+'\')"' : ' disabled')+'>'
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
    loadCases:si.loadCases, gearDefs:_mntGearTorqueCases(gather.torque),
    designDefs:[ {name:'3,5g Düşey',       n:[ 0,0,-3.5], T:[0,0,0]},
                 {name:'1g Yanal',         n:[ 0,1,-1  ], T:[0,0,0]},
                 {name:'1g Boyuna (fren)', n:[-1,0,-1  ], T:[0,0,0]} ]
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
          // Çözümün HANGİ modele ait olduğu (veMntSonucDurumu). Hazırlık
          // anının girdisi: hesap sürerken yapılan düzenleme sonucu bayatlatır.
          imza:_mntImza(prep.si, prep.gather.torque, prep.solver.data) };
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
  return 'lineer'+((ck.clampCount>0)?(' · '+ck.clampCount+' durdurucu'):'');
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
    getMntModulePropertiesHTML: getMntModulePropertiesHTML,
    getMntReportPropertiesHTML: getMntReportPropertiesHTML,
    _mnt2DPencereVeri: _mnt2DPencereVeri,
    _mntAksoModel: _mntAksoModel,
    veMntAksoOrnekModel: veMntAksoOrnekModel,
    veMntAksoCozumModel: veMntAksoCozumModel,
    _mntAksoHTML: _mntAksoHTML,
    _mntAksoKur: _mntAksoKur, _mntAkso3bHizli: _mntAkso3bHizli, _mntAksoOdak: _mntAksoOdak, _mntFoyOdak: _mntFoyOdak,
    _mntAksoTamH: _mntAksoTamH, veMntAksoTazele: veMntAksoTazele, veMntAkso3BTamEkran: veMntAkso3BTamEkran,
    _mnt2DFs: _mnt2DFs,
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
    _mntKutuphaneEslesme: _mntKutuphaneEslesme,
    _mntGatherTorqueKaynakli: _mntGatherTorqueKaynakli,
    _mntGolgelenen: _mntGolgelenen,
    _mntMotorSapma: _mntMotorSapma,
    _mntTorkZinciri: _mntTorkZinciri,
    _mntKrokiHTML: _mntKrokiHTML,
    veMntEksikGit: veMntEksikGit,
    veMntPencereTazele: veMntPencereTazele,
    // Pencere ailesi (2026-10-16): FEAD'in not satırı ve cevap kutusu, iki kategori
    _mntNot: _mntNot,
    _mntDurumKutu: _mntDurumKutu,
    _mntKutleCgDurumu: _mntKutleCgDurumu,
    _mntAtaletDurumu: _mntAtaletDurumu,
    _mntKutleDurumu: _mntKutleDurumu,
    _mntMotorDurumu: _mntMotorDurumu,
    _mntVitesDurumu: _mntVitesDurumu,
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
    getMntExamplePropertiesHTML: getMntExamplePropertiesHTML,
    getMntViewerPropertiesHTML: getMntViewerPropertiesHTML,
    getMntCoordFramePropertiesHTML: getMntCoordFramePropertiesHTML,
    getMnt2DViewPropertiesHTML: getMnt2DViewPropertiesHTML,
    _mnt2DGather: _mnt2DGather,
    _mnt2DYaziKutu: _mnt2DYaziKutu,
    _mnt2DKesisir: _mnt2DKesisir,
    veMntLibEksen: veMntLibEksen,
    VE_MOUNT_LIBRARY: VE_MOUNT_LIBRARY,
    veMntGetLibraryMap: veMntGetLibraryMap,
    veMntGetLibraryList: veMntGetLibraryList,
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
    MNT_AUTO_CASES: MNT_AUTO_CASES,
    VE_MNT_STARTER_LAYOUT: VE_MNT_STARTER_LAYOUT,
    veMntPopulateStarter: veMntPopulateStarter,
    veMntExportTopology: veMntExportTopology,
    veMntDecorateConnections: veMntDecorateConnections,
    _mntWireSupportLinks: _mntWireSupportLinks,
    _mntTopoState: _mntTopoState,
    _mntResolveTopology: _mntResolveTopology,
    _mntLoadExampleFromJSON: _mntLoadExampleFromJSON,
    _mntExampleReg: _mntExampleReg,
    _mntExampleList: _mntExampleList,
    _mntExampleLayout: _mntExampleLayout,
    _mntExampleDiagramSVG: _mntExampleDiagramSVG, _mntLibForceChart: _mntLibForceChart,
    _mntExampleBodyType: _mntExampleBodyType,
    _mntComputeSupportLinks: _mntComputeSupportLinks,
    _mntPtoConflict: _mntPtoConflict,
    _MNT_PTO_REF: _MNT_PTO_REF,
    _mntExampleValidate: _mntExampleValidate,
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
    _mntExampleKapilarHTML: _mntExampleKapilarHTML
  };
  // Son çözüm bu modülün değişkeninde; tarayıcıda tek global, Node'da modül
  // kapsamında kalır. Pencereyi sentetik bir çözümle ölçen testler onu buradan kurar.
  Object.defineProperty(module.exports, '_veMntLast', {
    get:function(){ return _veMntLast; }, set:function(v){ _veMntLast=v; }, enumerable:false });

}
