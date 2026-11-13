// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ — ANGST+PFISTER APSOvib® TAKOZ VERİTABANI (DOM'suz saf veri)
// ═══════════════════════════════════════════════════════════════════════════
// Üreticinin MOBİL UYGULAMA takozlarından motor ve güç grubuna gidenler (kullanıcı
// 2026-11-10: "program içinde kayıtlı olan Angst-Pfister takozlarını da araştır"):
// konik yatak (Conical bearing, 9 tip) · HD konik yatak (High Deflection, 2 tip) ·
// H-takoz (H-Mount, 8 boy) · marine motor takozu (3 tip) · HD jeneratör yatağı
// (2 tip) — 24 tip, 86 kod. Makine ayağı, CUPMOUNT ve yalıtım halkası alınmadı
// (cihaz ve makine elemanı, güç grubu takozu değil).
//
// KAYNAKLAR (hepsi üreticinin kendisi; çapraz okundu):
//   • APSOparts e-mağazası (2026-11-10) — her tipin makale tablosu (sertlik, yük,
//     yay yolu, rijitlik; marinede ağırlık) ve ölçü nitelikleri. GÜNCEL kaynak.
//   • Föyler: Conical Bearings EN (2015, N), H-Mounts EN (2018, N), Marine Engine
//     Mounts EN (2017, kg) · Genel katalog "Antivibration Technology" (2017, kg).
//   • BİRİM: konik yatak ve jeneratör yatağında e-mağazanın ve kataloğun "kg"ı daN
//     (föy 2015: 026 S 1 136 kg ↔ 1.360 N; jeneratör: Cz = 10·Fz/Sz); marinede
//     e-mağaza N verir (≈ kg × 9,81). Burada kuvvetler N.
//   • ÇAPRAZ: konik yatağın 33 kodunda e-mağaza × 10 = föy 2015 (33/33); H-takozun
//     32 kodunda e-mağaza = föy 2018 (32/32). AYRIŞMALAR: marine 0375'in yay yolu
//     katalogda 6 mm, e-mağaza ve föyde 4 mm (4 alındı); marine tip 3'ün sertlik notu
//     e-mağazada ve katalogda tip 1'in kopyası (~40/45/55/65), föy ve tip kodu
//     (0345 … 0375) 45/55/65/75 (föy alındı); H-takozun 5 kodunda yazılı C ile F/S
//     ayrışıyor (II 140/167 orta yumuşak 650 ↔ 680, II 250/270 sert 5.300 ↔ 5.333 ve
//     2.500 ↔ 2.333, III 135 sert 1.900 ↔ 1.600) — yazılı C alındı (±%20).
//
// RİJİTLİK [N/mm]: konik yatakta k = F/S her eksende (Fz/Sz · Fx/Sx · Fy/Sy; üretici
// "yay değerleri önceliklidir" diyor, sertlik yaklaşık); H-takozda yazılı Cz ve Cx,y
// (±%20); marine ve jeneratörde yalnız Z (Fz/Sz · yazılı Cz). Kapasite = statik Fz
// (N/9,81 kg).
// DİNAMİK TAHMİN (Canlı Not 113'ün kuralı: yayımlanmayan değer modeli reddettirmez,
// tahminle çözülür ve işaretlenir; tahminli tip Parametrik Analiz'in adayıdır — Canlı Not 1008). A+P dinamik
// rijitlik yayımlamıyor: NR takozda (konik · HD · marine · jeneratör) din./stat. =
// (Sh+20)/50 — AMC'nin NR konilerinde doğal frekans grafiklerinden ölçülen yasa
// (js/mount-amc.js; sertlik A+P'nin yaklaşık değeri, "~45 Shore A"). H-takoz CR ve
// sertliği yazılmıyor: AMC-EO'nun dinamiği ölçülmüş 9 NR kodunun medyanı (DIN_MEDYAN,
// hidrolik hariç; kapı ölçümden yeniden hesaplar). Statiği dinamik saymak modal
// frekansı sessizce düşürürdü — oran 1 YAZILMAZ.
// RADYAL yalnız yazılı olduğu yerde: marine ve jeneratörde X · Y yayımlanmıyor ve
// ölçülmüş benzer tip yok (üretici marinede yalnız "dikey rijitlik yataydan büyük"
// diyor; AMC'nin bütün oranları > 1) — tip eksik kalır; Takoz Özellikleri'nden girilen
// X · Y'nin dinamiği aynı oranla kurulur (tamamla).
//
// PROGRAMDAKİ BMC GİRDİLERİ (LMT-1433-00 · LMT-1433-37 · "Mount 1") LASPAR'ın: LMT-1433-00
// LASPAR kataloğunda (js/mount-laspar.js). Ölçüsü konik yatak 026'nınki (107 × 90, delik
// 80 × 65; radyal X = Y → 026 S 1) — LASPAR künyesinde "A+P eşi" (mount-laspar.js → AP_ESI).
//
// ANAHTAR 'ap' + makale no (10 hane) — kayıtlı projeler takozu node.data.libKey ile
// bağlar, DEĞİŞMEZ. Ad: "<ürün> <tip> <sertlik> ShA (A+P 12.2140.2503)"; H-takozda
// Shore yazılmıyor, sertlik sınıfıyla: "H-Mount II 135-335-120 middle soft (A+P …)".
// ═══════════════════════════════════════════════════════════════════════════

var VE_MNT_AP = (function() {
  'use strict';
  var MARKA = 'Angst+Pfister';
  // aile → [üreticinin aile adı, adın öneki, kaynak]
  var AILE = {
    konus:  ['APSOvib® Conical bearing', 'Conical bearing', 'konus'],
    hd:     ['APSOvib® Conical bearing HD High Deflection', 'Conical bearing HD', 'konus'],
    h:      ['APSOvib® H-Mount', 'H-Mount', 'h'],
    marine: ['APSOvib® Marine mount', 'Marine mount', 'marine'],
    gen:    ['APSOvib® HD Generator bearing', 'HD Generator bearing', 'gen']
  };
  var AILE_SIRA = ['konus', 'hd', 'h', 'marine', 'gen'];
  // tip → [aile, tip adı, e-mağaza no, çizim, ölçüler mm]
  //   ölçüler: boy × en · delik aralığı (boy × en) · delik Ø · yükseklik · diş;
  //   H-takoz: montaj deliği Ø (sd) · levha kalınlığı (T) · boy (H) · dış Ø (D2) · iç Ø (d1) · vida
  var TIP = {
    "021": ["konus", "021", "12214020", "k-021", {"boy": 84, "en": 50, "dBoy": 64, "dCap": 6.5, "yuk": 23.5}],
    "021-s1": ["konus", "021 S 1", "12214022", "k-021-s1", {"boy": 84, "en": 50, "dBoy": 64, "dCap": 6.5, "yuk": 26.5}],
    "025": ["konus", "025", "12214023", "k-025", {"boy": 106, "en": 68, "dBoy": 80, "dCap": 11, "yuk": 45}],
    "025-s1": ["konus", "025 S 1", "12214024", "k-025-s1", {"boy": 106, "en": 68, "dBoy": 80, "dCap": 11, "yuk": 45}],
    "026-s1": ["konus", "026 S 1", "12214025", "k-026-s1", {"boy": 107, "en": 90, "dBoy": 80, "dEn": 65, "dCap": 11, "yuk": 49.5}],
    "026-s3": ["konus", "026 S 3", "12214026", "k-026-s3", {"boy": 107, "en": 90, "dBoy": 80, "dEn": 65, "dCap": 11, "yuk": 49.5}],
    "027-s5": ["konus", "027 S 5", "12214027", "k-027-s5", {"boy": 120, "en": 100, "dBoy": 90, "dEn": 74, "dCap": 11, "yuk": 73}],
    "030": ["konus", "030", "12214028", "k-030", {"boy": 140, "en": 120, "dBoy": 112, "dEn": 92, "dCap": 11, "yuk": 85}],
    "05719": ["konus", "05719", "12214030", "k-05719", {"boy": 122, "en": 122, "dBoy": 100, "dEn": 100, "dCap": 11, "yuk": 128}],
    "hd-1": ["hd", "1", "12214009", "k-hd-1", {"boy": 105, "en": 91.5, "dBoy": 82.7, "dEn": 69.4, "dCap": 10.4, "yuk": 65.6}],
    "hd-2": ["hd", "2", "12214010", "k-hd-2", {"boy": 105, "en": 91.5, "dBoy": 82.7, "dEn": 69.4, "dCap": 10.4, "yuk": 65.6}],
    "h-i-090": ["h", "I 090-205-090", "12214701", "h-1", {"sd": 20.5, "T": 9, "H": 30, "D2": 33, "d1": 9, "vida": "M6/M8"}],
    "h-ii-135": ["h", "II 135-335-120", "12214702", "h-2", {"sd": 33.5, "T": 12, "H": 50, "D2": 48, "d1": 13.5, "vida": "M10/M12"}],
    "h-ii-140": ["h", "II 140-405-200", "12214703", "h-2", {"sd": 40.5, "T": 20, "H": 61.7, "D2": 64.8, "d1": 14, "vida": "M10/M12"}],
    "h-ii-167": ["h", "II 167-405-200", "12214704", "h-2", {"sd": 40.5, "T": 20, "H": 61.7, "D2": 64.8, "d1": 16.7, "vida": "3/8\"/M12"}],
    "h-ii-238": ["h", "II 238-588-290", "12214705", "h-2", {"sd": 58.8, "T": 29, "H": 73, "D2": 89, "d1": 23.8, "vida": "M16/M20"}],
    "h-ii-250": ["h", "II 250-658-250", "12214706", "h-2", {"sd": 65.8, "T": 25, "H": 87, "D2": 124, "d1": 25, "vida": "M20/M22"}],
    "h-ii-270": ["h", "II 270-658-250", "12214707", "h-2", {"sd": 65.8, "T": 25, "H": 87, "D2": 124, "d1": 27, "vida": "M24"}],
    "h-iii-135": ["h", "III 135-315-130", "12214708", "h-3", {"sd": 31.5, "T": 13, "H": 50, "D2": 48, "d1": 13.5, "vida": "M10/M12"}],
    "marine-1": ["marine", "1", "12214404", "m-1", {"boy": 120, "en": 60, "dBoy": 100, "yuk": 38, "dis": "M12"}],
    "marine-2": ["marine", "2", "12214405", "m-2", {"boy": 183, "en": 75, "dBoy": 140, "yuk": 50, "dis": "M16"}],
    "marine-3": ["marine", "3", "12214406", "m-3", {"boy": 230, "en": 112, "dBoy": 182, "yuk": 70, "dis": "M20"}],
    "gl-1": ["gen", "1", "12206462", "g-1", {"boy": 200, "en": 200, "dBoy": 165, "dEn": 165, "dCap": 14.5, "yuk": 84, "dis": "M20"}],
    "gl-2": ["gen", "2", "12206463", "g-2", {"boy": 270, "en": 270, "dBoy": 230, "dEn": 180, "dCap": 19, "yuk": 106, "dis": "M24"}],
  };
  var TIP_SIRA = Object.keys(TIP);
  // kod → [tip, sertlik sınıfı, ShA (yaklaşık; H-takozda yok), Fz N, Sz mm, Fx N, Sx mm, Fy N, Sy mm,
  //        Cz N/mm (yazılı), Cx,y N/mm (yazılı), ağırlık g] — e-mağazanın makale tablosu, N
  var KOD = {
    '1221402001': ["021", "soft", 45, 370, 3, 695, 3, 695, 3, null, null, null],
    '1221402003': ["021", "medium", 60, 670, 3, 1290, 3, 1290, 3, null, null, null],
    '1221402004': ["021", "hard", 70, 1100, 3, 2000, 3, 2000, 3, null, null, null],
    '1221402201': ["021-s1", "soft", 45, 260, 3, 790, 4, 500, 4, null, null, null],
    '1221402203': ["021-s1", "medium", 60, 450, 3, 1500, 4, 1090, 4, null, null, null],
    '1221402204': ["021-s1", "hard", 70, 720, 3, 2000, 3.5, 1580, 4, null, null, null],
    '1221402301': ["025", "soft", 45, 800, 3.5, 2335, 4, 2335, 4, null, null, null],
    '1221402303': ["025", "medium", 60, 1500, 3.5, 4000, 3.3, 4000, 3.3, null, null, null],
    '1221402304': ["025", "hard", 70, 2400, 3.5, 4000, 2, 4000, 2, null, null, null],
    '1221402401': ["025-s1", "soft", 45, 600, 3.5, 2395, 4, 1450, 4, null, null, null],
    '1221402403': ["025-s1", "medium", 60, 1150, 3.5, 4435, 4, 2915, 4, null, null, null],
    '1221402404': ["025-s1", "hard", 70, 1850, 3.5, 6000, 3.9, 4980, 4, null, null, null],
    '1221402501': ["026-s1", "soft", 45, 1360, 3.5, 4870, 4, 4870, 4, null, null, null],
    '1221402503': ["026-s1", "medium", 60, 2550, 3.5, 6870, 4, 6870, 4, null, null, null],
    '1221402504': ["026-s1", "hard", 70, 4100, 3.5, 10000, 3.4, 10000, 3.4, null, null, null],
    '1221402601': ["026-s3", "soft", 45, 950, 3.5, 3200, 4, 1835, 4, null, null, null],
    '1221402603': ["026-s3", "medium", 60, 1700, 3.5, 6600, 4, 3200, 4, null, null, null],
    '1221402604': ["026-s3", "hard", 70, 2800, 3.5, 8940, 4, 4665, 4, null, null, null],
    '1221402701': ["027-s5", "soft", 45, 3600, 3.5, 7465, 4, 7465, 4, null, null, null],
    '1221402703': ["027-s5", "medium", 60, 6500, 3.5, 11445, 4, 11445, 4, null, null, null],
    '1221402704': ["027-s5", "hard", 70, 9600, 3.5, 14000, 3.6, 14000, 3.6, null, null, null],
    '1221402801': ["030", "soft", 45, 4500, 4, 8645, 2.5, 8645, 2.5, null, null, null],
    '1221402803': ["030", "medium", 60, 9950, 4, 13900, 2.5, 13900, 2.5, null, null, null],
    '1221402804': ["030", "hard", 70, 14050, 4, 19660, 2.5, 19660, 2.5, null, null, null],
    '1221403001': ["05719", "soft", 45, 10000, 7, 9600, 1.5, 9600, 1.5, null, null, null],
    '1221403003': ["05719", "medium", 60, 20000, 7, 19200, 2.5, 19200, 2.5, null, null, null],
    '1221403004': ["05719", "hard", 70, 30000, 7, 30000, 3.5, 30000, 3.5, null, null, null],
    '1221400901': ["hd-1", "soft", 50, 2000, 6.5, 2800, 4, 1360, 4, null, null, null],
    '1221400903': ["hd-1", "medium", 55, 3000, 6.5, 4320, 4, 2080, 4, null, null, null],
    '1221400904': ["hd-1", "hard", 60, 3600, 6.5, 5120, 4, 2480, 4, null, null, null],
    '1221401001': ["hd-2", "soft", 50, 2800, 6.5, 2800, 4, 2800, 4, null, null, null],
    '1221401003': ["hd-2", "medium", 55, 3500, 6.5, 4320, 4, 4320, 4, null, null, null],
    '1221401004': ["hd-2", "hard", 60, 5000, 6.5, 5120, 4, 5120, 4, null, null, null],
    '1221470101': ["h-i-090", "soft", null, 405, 1.5, 400, 1, null, null, 270, 400, null],
    '1221470102': ["h-i-090", "middle soft", null, 555, 1.5, 500, 1, null, null, 370, 500, null],
    '1221470103': ["h-i-090", "middle hard", null, 825, 1.5, 780, 1, null, null, 550, 780, null],
    '1221470104': ["h-i-090", "hard", null, 1650, 1.5, 1800, 1, null, null, 1100, 1800, null],
    '1221470201': ["h-ii-135", "soft", null, 600, 3, 380, 1, null, null, 200, 380, null],
    '1221470202': ["h-ii-135", "middle soft", null, 900, 3, 600, 1, null, null, 300, 600, null],
    '1221470203': ["h-ii-135", "middle hard", null, 1860, 3, 1000, 1, null, null, 620, 1000, null],
    '1221470204': ["h-ii-135", "hard", null, 3000, 3, 2100, 1, null, null, 1000, 2100, null],
    '1221470301': ["h-ii-140", "soft", null, 1650, 3, 600, 1, null, null, 550, 600, null],
    '1221470302': ["h-ii-140", "middle soft", null, 2040, 3, 870, 1, null, null, 650, 870, null],
    '1221470303': ["h-ii-140", "middle hard", null, 3000, 3, 1450, 1, null, null, 1000, 1450, null],
    '1221470304': ["h-ii-140", "hard", null, 6000, 3, 2900, 1, null, null, 2000, 2900, null],
    '1221470401': ["h-ii-167", "soft", null, 1650, 3, 600, 1, null, null, 550, 600, null],
    '1221470402': ["h-ii-167", "middle soft", null, 2040, 3, 870, 1, null, null, 650, 870, null],
    '1221470403': ["h-ii-167", "middle hard", null, 3000, 3, 1450, 1, null, null, 1000, 1450, null],
    '1221470404': ["h-ii-167", "hard", null, 6000, 3, 2900, 1, null, null, 2000, 2900, null],
    '1221470501': ["h-ii-238", "soft", null, 1840, 2.3, 715, 1.1, null, null, 800, 650, null],
    '1221470502': ["h-ii-238", "middle soft", null, 3080, 2.8, 2070, 2.3, null, null, 1100, 900, null],
    '1221470503': ["h-ii-238", "middle hard", null, 6845, 3.7, 2660, 1.9, null, null, 1850, 1400, null],
    '1221470504': ["h-ii-238", "hard", null, 13000, 3.4, 4480, 1.6, null, null, 3800, 2800, null],
    '1221470601': ["h-ii-250", "soft", null, 2700, 3, 600, 1.5, null, null, 900, 400, null],
    '1221470602': ["h-ii-250", "middle soft", null, 4500, 3, 930, 1.5, null, null, 1500, 620, null],
    '1221470603': ["h-ii-250", "middle hard", null, 7500, 3, 1500, 1.5, null, null, 2500, 1000, null],
    '1221470604': ["h-ii-250", "hard", null, 16000, 3, 3500, 1.5, null, null, 5300, 2500, null],
    '1221470701': ["h-ii-270", "soft", null, 2700, 3, 600, 1.5, null, null, 900, 400, null],
    '1221470702': ["h-ii-270", "middle soft", null, 4500, 3, 930, 1.5, null, null, 1500, 620, null],
    '1221470703': ["h-ii-270", "middle hard", null, 7500, 3, 1500, 1.5, null, null, 2500, 1000, null],
    '1221470704': ["h-ii-270", "hard", null, 16000, 3, 3500, 1.5, null, null, 5300, 2500, null],
    '1221470801': ["h-iii-135", "soft", null, 1150, 3, 1400, 1, null, null, 380, 1400, null],
    '1221470802': ["h-iii-135", "middle soft", null, 1800, 3, 1900, 1, null, null, 600, 1900, null],
    '1221470803': ["h-iii-135", "middle hard", null, 2850, 3, 3000, 1, null, null, 950, 3000, null],
    '1221470804': ["h-iii-135", "hard", null, 4800, 3, 5200, 1, null, null, 1900, 5200, null],
    '1221440440': ["marine-1", "soft", 40, 340, 4, null, null, null, null, null, null, 337],
    '1221440445': ["marine-1", "middle soft", 45, 440, 4, null, null, null, null, null, null, 338],
    '1221440455': ["marine-1", "middle hard", 55, 680, 4, null, null, null, null, null, null, 338],
    '1221440465': ["marine-1", "hard", 65, 980, 4, null, null, null, null, null, null, 338],
    '1221440535': ["marine-2", "very soft", 35, 780, 5, null, null, null, null, null, null, 856],
    '1221440545': ["marine-2", "soft", 45, 1080, 5, null, null, null, null, null, null, 856],
    '1221440555': ["marine-2", "middle soft", 55, 1570, 5, null, null, null, null, null, null, 872],
    '1221440565': ["marine-2", "middle hard", 65, 2700, 5, null, null, null, null, null, null, 872],
    '1221440575': ["marine-2", "hard", 75, 4900, 5, null, null, null, null, null, null, 872],
    '1221440645': ["marine-3", "soft", 45, 3330, 6, null, null, null, null, null, null, 2240],
    '1221440655': ["marine-3", "middle soft", 55, 5100, 6, null, null, null, null, null, null, 2269],
    '1221440665': ["marine-3", "middle hard", 65, 7170, 6, null, null, null, null, null, null, 2265],
    '1221440675': ["marine-3", "hard", 75, 9400, 4, null, null, null, null, null, null, 2240],
    '1220640101': ["gl-1", "soft", 40, 7000, 12, null, null, null, null, 583, null, null],
    '1220640102': ["gl-1", "middle soft", 50, 12000, 12, null, null, null, null, 1000, null, null],
    '1220640103': ["gl-1", "middle hard", 60, 16000, 12, null, null, null, null, 1333, null, null],
    '1220640104': ["gl-1", "hard", 70, 30000, 12, null, null, null, null, 2500, null, null],
    '1220643001': ["gl-2", "soft", 40, 16000, 16, null, null, null, null, 1000, null, null],
    '1220643002': ["gl-2", "middle soft", 50, 24000, 16, null, null, null, null, 1500, null, null],
    '1220643003': ["gl-2", "middle hard", 60, 34000, 16, null, null, null, null, 2125, null, null],
    '1220643004': ["gl-2", "hard", 70, 42000, 16, null, null, null, null, 2625, null, null],
  };
  var SINIF_SIRA = ['very soft', 'soft', 'middle soft', 'medium', 'middle hard', 'hard'];
  // Belgenin tarihiyle (ay yıl) — yıl tek başına sayı okunurdu (Türkçe sayı kapısı).
  var KAYNAK = {
    konus: 'A+P föyü Kasım 2015 · e-mağaza 10.11.2026', h: 'A+P föyü Haziran 2018 · e-mağaza 10.11.2026',
    marine: 'A+P e-mağaza 10.11.2026 · föy Şubat 2017', gen: 'A+P e-mağaza 10.11.2026 · katalog Ekim 2017'
  };

  function noktali(kod) { return kod.slice(0, 2) + '.' + kod.slice(2, 6) + '.' + kod.slice(6); }
  function ad(kod) {
    var k = KOD[kod], t = TIP[k[0]], a = AILE[t[0]];
    return a[1] + ' ' + t[1] + ' ' + (k[2] != null ? k[2] + ' ShA' : k[1]) + ' (A+P ' + noktali(kod) + ')';
  }
  var yuvarla = function(v) { return Math.round(v); };
  // AMC-EO'nun dinamiği ölçülmüş NR kodlarında din./stat. medyanı (eksenlerin ortalaması).
  var DIN_MEDYAN = { din: 1.52, n: 9 };
  // Kodun din./stat. tahmini: { din, tur: 'sertlik' | 'medyan', sh, n }.
  function dinOrani(kod) {
    var k = KOD[kod]; if (!k) return null;
    if (k[2] != null) return { din: Math.round((k[2] + 20) / 50 * 100) / 100, tur: 'sertlik', sh: k[2] };
    return { din: DIN_MEDYAN.din, tur: 'medyan', n: DIN_MEDYAN.n };
  }
  // Tahminli dinamiği girdinin statiğinden kur (girilen değer tahmin değil, listeden düşer).
  function tamamla(e) {
    var D = e && e.ap && e.ap.dinamik, T = e && e.tahmin;
    if (!D || !T || !T.length) return e;
    ['x', 'y', 'z'].forEach(function(a) {
      if (T.indexOf('d' + a) < 0) return;
      var st = e['s' + a];
      e['d' + a] = (st > 0) ? Math.round(st * D.din) : null;
    });
    return e;
  }
  // Kütüphane girdisi (VE_MOUNT_LIBRARY biçimi). Bilinmeyen eksen null.
  function girdi(kod) {
    var k = KOD[kod]; if (!k) return null;
    var t = TIP[k[0]], aile = t[0];
    var e = { marka: MARKA, name: ad(kod), maxLoad: Math.round(k[3] / 9.81 * 10) / 10,
              sx: null, sy: null, sz: null, dx: null, dy: null, dz: null };
    if (aile === 'konus' || aile === 'hd') { e.sx = yuvarla(k[5] / k[6]); e.sy = yuvarla(k[7] / k[8]); e.sz = yuvarla(k[3] / k[4]); }
    else if (aile === 'h') { e.sx = k[10]; e.sy = k[10]; e.sz = k[9]; }
    else if (aile === 'marine') { e.sz = yuvarla(k[3] / k[4]); }
    else { e.sz = k[9]; }
    e.ap = { kod: kod, tip: k[0], aile: aile, sinif: k[1], sh: k[2], dinamik: dinOrani(kod) };
    e.tahmin = ['dx', 'dy', 'dz'];
    return tamamla(e);
  }
  // Bütün kodlar: ailenin · tipin · sertliğin sırasıyla.
  function kodlar() {
    return Object.keys(KOD).sort(function(a, b) {
      var A = KOD[a], B = KOD[b];
      return (AILE_SIRA.indexOf(TIP[A[0]][0]) - AILE_SIRA.indexOf(TIP[B[0]][0]))
        || (TIP_SIRA.indexOf(A[0]) - TIP_SIRA.indexOf(B[0]))
        || (SINIF_SIRA.indexOf(A[1]) - SINIF_SIRA.indexOf(B[1])) || (A[3] - B[3]);
    });
  }
  // Görselin adresi: derleme gömer (build.js → __MFSIM_TAKOZ), modüler kopyada dosya.
  function gorsel(adi) {
    var rel = 'takoz/ap/' + adi + '.webp';
    var G = (typeof window !== 'undefined' && window.__MFSIM_TAKOZ) || null;
    return (G && G[rel]) || ('assets/' + rel);
  }
  // Künye: Takoz Özellikleri'nin gösterdiği veri ve tipin teknik resmi — (i) düğmesinin
  // penceresinde, fotoğraf yok (Canlı Not 111). Kapasite YAZILMAZ (Canlı Not 65).
  function tipKunye(tip) {
    var t = TIP[tip], a = AILE[t[0]];
    return { tip: tip, urun: a[1] + ' ' + t[1], aile: a[0], tipAdi: t[1], olcu: t[4],
             cizim: gorsel('cizim-' + t[3]), kaynak: KAYNAK[a[2]] };
  }
  function kunye(kod) {
    var k = KOD[kod]; if (!k) return null;
    var K = tipKunye(k[0]);
    K.kod = noktali(kod); K.ad = ad(kod); K.sinif = k[1]; K.sh = k[2]; K.gr = k[11];
    K.tol = (TIP[k[0]][0] === 'h') ? 20 : null;
    return K;
  }
  return { MARKA: MARKA, AILE: AILE, AILE_SIRA: AILE_SIRA, TIP: TIP, TIP_SIRA: TIP_SIRA, KOD: KOD, KAYNAK: KAYNAK,
           DIN_MEDYAN: DIN_MEDYAN, noktali: noktali, ad: ad, dinOrani: dinOrani, tamamla: tamamla, girdi: girdi,
           kodlar: kodlar, gorsel: gorsel, kunye: kunye };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = VE_MNT_AP;
