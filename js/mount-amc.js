// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ — AMC MECANOCAUCHO® KONİK TAKOZ VERİTABANI (DOM'suz saf veri)
// ═══════════════════════════════════════════════════════════════════════════
// Üreticinin konik ailelerinin TAMAMI (2026-11-10): masif koni (Solid cone),
// kesikli koni (Cone with cutouts), flanşlı koni (Cone with fixation flange),
// hidrolik koni ve DSM — 51 tip, 148 kod.
//
// KAYNAKLAR (hepsi üreticinin kendisi):
//   • ENVANTER — mecanocaucho.com aile sayfalarının tabloları: tip, kod, sertlik,
//     maks. yük (kg), sıkma torku (N·m), ağırlık (g). Hidrolik konilerin tablosu
//     sitede yok: AMC genel kataloğu (cauchometal_en.pdf) s.35.
//     DÜZELTME: 137936'nın Shore hücresine sitede ve katalogda ağırlık (662)
//     yazılmış; 2018 föyünün grafiği o çizgiyi "14-60" diye etiketliyor → 60 ShA.
//   • EKSENEL STATİK RİJİTLİK kz — üreticinin yük–sehim grafiklerinden. Grafik
//     log-log, her çizgi F = kz·δ (eğim 1,000 ± 0,002); kalibrasyon eksen
//     çentiklerinden (artık < 0,1 SVG birimi), kg/mm → N/mm g = 9,81 (AMC'nin
//     sabiti: değerler 5 N/mm'nin katına oturuyor). Kaynak sütunu:
//       w3  mecanocaucho.com aile grafiği (SVG, Rev. 3)
//       w2  mecanocaucho.com aile grafiği (SVG, Rev. 2 — flanşlı 50 · 51 · 100)
//       k2  AMC genel kataloğu s.36–37 (Rev. 2) — hidrolik koniler
//       f18 2018 föyü (Grupo CAP dağıtımı) — 14 · 4 delik; yenisinde yok
//     Çizginin her ucu bir maks. yüke oturuyor; dört kodda grafiğin ucu tablodan
//     farklı (177084 650 ↔ 550 · 137044 400 ↔ 370 · 137009 70 ↔ 75 · 137142
//     225 ↔ 245 kg) — tablonun değeri tutulur.
//     DOĞRULAMA: AMC-EO'nun bildiği 9 kodun 7'sinde grafik birebir (±0,1 %);
//     137731 −3,0 % (AMC'nin yazılı bildirimi tutulur), 137829 +2,3 % (o girdi
//     çalışma noktası tabanında). Kapı: tests/unit/mount-amc.test.js.
//   • DİNAMİK/STATİK ORAN — doğal frekans grafiklerinden (her çizgide sabit
//     k_din): sertlikli NR konilerde (Sh+20)/50 her sertlikte birebir; sertliği
//     yazılmayan flanşlı koniler (100 · 200) grafiğin oranı. Hidrolik konide
//     dinamik rijitlik frekansa bağlı (katalog s.36–37): oran YAZILMADI.
//   • RADYAL RİJİTLİK (kx, ky) YAYIMLANMIYOR — "Our Technical Department can
//     provide you with the elastical constants for each axis". Yalnız AMC-EO
//     dökümündeki 10 kodda ve teknik resimlerin 3 kodunda ölçülü (EO · RESIM);
//     öteki kodlarda TAHMİNİ (aşağıda
//     RADYAL TAHMİN — Canlı Not 113): tip çözülür, Takoz Özellikleri'nde girilen
//     değer tahminin yerine geçer; tahminli tip taramaya aday olmaz.
//   • DSM çift rijitlikli (ön sıkıştırma · statik · dinamik bölge): yük–sehim
//     eğrisi doğrusal değil, kz YAZILMADI.
//   • BMC TEKNİK RESİMLERİ (kullanıcı 2026-11-10, dokuz resim): AMC'nin kendi
//     çizimi + kodun veri kutusu (RESIM tablosu, aşağıda). Grafik kz'si resmin
//     Z'siyle beş kodun beşinde birebir — sayısallaştırmanın bağımsız doğrulaması.
//   • GÖRSEL — yalnız tipin TEKNİK RESMİ (ölçülü çizim), üreticinin sitesinden:
//     assets/takoz/amc/ (tools/takoz-gorsel.js üretir, elle düzenlenmez);
//     derleme gömer (build.js → __MFSIM_TAKOZ). Ürün ve uygulama fotoğrafları
//     YOK (kullanıcı 2026-11-10, Canlı Not 111: "Sadece teknik resmi kalsa yeter").
//
// ANAHTAR 'amc' + kod — kayıtlı projeler takozu node.data.libKey ile bağlar,
// DEĞİŞMEZ. Ad: "<ürün> <sertlik> ShA (AMC <kod>)"; sertliği yazılmayan üründe
// sertlik yok ("Cone 100 A (AMC 137213)").
// ═══════════════════════════════════════════════════════════════════════════

var VE_MNT_AMC = (function() {
  'use strict';

  // aile → [üreticinin aile adı]
  var AILE = {
    masif:    ['Solid cone'],
    kesikli:  ['Cone with cutouts'],
    flansli:  ['Cone with fixation flange'],
    hidrolik: ['Hydraulic cone'],
    dsm:      ['DSM (dual stiffness mount)']
  };
  // tip → [aile, ürün adı, çizim, sıkma torku maks. (N·m), ağırlık (g)] — sitedeki tablo
  var TIP = {
    '01':        ['masif', 'Cone 01', '01', 20.5, 128],
    '02':        ['masif', 'Cone 02', '02', 71, 132],
    '11':        ['masif', 'Cone 11', '11', 71, 409],
    '13':        ['masif', 'Cone 13', '13', 71, 450],
    '14-2':      ['masif', 'Cone 14 2 Holes', '14-2', 71, 643],
    '14-4':      ['masif', 'Cone 14 4 Holes', '14-4', 71, 662],
    '17':        ['masif', 'Cone 17', '17', 71, 410],
    '21-2':      ['masif', 'Cone 21 2 Holes', '21-2', 113, 787],
    '21-4':      ['masif', 'Cone 21 4 Holes', '21-4', 113, 560],
    '27':        ['masif', 'Cone 27', '27', 170, 1175],
    '31':        ['masif', 'Cone 31', '31', 170, 1188],
    '33':        ['masif', 'Cone 33', '33', 170, 1462],
    '36':        ['masif', 'Cone 36', '36', 170, 1410],
    '39':        ['masif', 'Cone 39', '39', 170, 1438],
    '40':        ['masif', 'Cone 40', '40', 245, 1216],
    '45':        ['masif', 'Cone 45', '45', 245, 1751],
    '60':        ['masif', 'Cone 60', '60', 350, 1821],
    '62':        ['masif', 'Cone 62', '62', 170, 1946],
    '65':        ['masif', 'Cone 65', '65', 350, 2965],
    '68':        ['masif', 'Cone 68', '68', 350, 3267],
    '70':        ['masif', 'Cone 70', '70', 600, 3450],
    '75':        ['masif', 'Cone 75', '75', 600, 4230],
    '121-ng':    ['masif', 'Cone 121 NG', '121-ng', 600, 7840],
    '121-np':    ['masif', 'Cone 121 NP', '121-np', 600, 6940],
    '141':       ['masif', 'Cone 141', '141', 245, 1039],
    '00':        ['kesikli', 'Cone 00', '00', 20.5, 126],
    '10':        ['kesikli', 'Cone 10', '10', 71, 406],
    '12':        ['kesikli', 'Cone 12', '12', 71, 407],
    '20':        ['kesikli', 'Cone 20', '20', 113, 554],
    '30':        ['kesikli', 'Cone 30', '30', 170, 1167],
    '35':        ['kesikli', 'Cone 35', '35', 170, 1328],
    '38':        ['kesikli', 'Cone 38', '38', 170, 1438],
    '67':        ['kesikli', 'Cone 67', '67', 350, 3242],
    '120-np':    ['kesikli', 'Cone 120 NP', '120-np', 600, 6890],
    '50-m16x15': ['flansli', 'Cone 50 M16x1.5', '50-m16x15', 170, 1600],
    '50-m16x2':  ['flansli', 'Cone 50 M16x2', '50-m16x2', 170, 1600],
    '51-m16x15': ['flansli', 'Cone 51 M16x1.5', '51-m16x15', 170, 1750],
    '51-m16x2':  ['flansli', 'Cone 51 M16x2', '51-m16x2', 170, 1750],
    '100-a':     ['flansli', 'Cone 100 A', '100', 600, 9626],
    '100-b':     ['flansli', 'Cone 100 B', '100', 600, 9626],
    '100-c':     ['flansli', 'Cone 100 C', '100', 600, 9626],
    '200-a':     ['flansli', 'Cone 200 A', '200', 2100, 28438],
    '200-b':     ['flansli', 'Cone 200 B', '200', 2100, 28438],
    'hid-31':    ['hidrolik', 'Hydraulic Cone 31', 'hid-31', null, null],
    'hid-32':    ['hidrolik', 'Hydraulic Cone 32', 'hid-32', null, null],
    'hid-70':    ['hidrolik', 'Hydraulic Cone 70', 'hid-70', null, null],
    'hid-71':    ['hidrolik', 'Hydraulic Cone 71', 'hid-71', null, null],
    'hid-72':    ['hidrolik', 'Hydraulic Cone 72', 'hid-72', 170, 3034],   // tork · ağırlık: AMC çizimi (BMC teknik resmi)
    'dsm-22':    ['dsm', 'DSM 22', 'dsm-22', 113, 850],
    'dsm-83':    ['dsm', 'DSM 83', 'dsm-83', 71, 2000],
    'dsm-141':   ['dsm', 'DSM 141', 'dsm-141', 245, 1039]
  };
  // Tiplerin sırası (aile, sonra tip numarası). Nesnenin anahtar sırası kullanılmaz: JS
  // sayıya benzeyen anahtarları ('11', '141') öne alır, '01' ve '14-2'yi almaz.
  var TIP_SIRA = ['01', '02', '11', '13', '14-2', '14-4', '17', '21-2', '21-4', '27', '31', '33', '36', '39',
    '40', '45', '60', '62', '65', '68', '70', '75', '121-ng', '121-np', '141', '00', '10', '12', '20', '30',
    '35', '38', '67', '120-np', '50-m16x15', '50-m16x2', '51-m16x15', '51-m16x2', '100-a', '100-b', '100-c',
    '200-a', '200-b', 'hid-31', 'hid-32', 'hid-70', 'hid-71', 'hid-72', 'dsm-22', 'dsm-83', 'dsm-141'];
  // kod → [tip, sertlik ShA (null: üretici vermiyor), maks. yük (kg), kz statik (N/mm, grafik), din./stat., kz kaynağı]
  var KOD = {
    '137005': ['01', 45, 40, 130, 1.3, 'w3'],
    '137006': ['01', 60, 70, 215, 1.6, 'w3'],
    '137015': ['01', 70, 105, 410, 1.8, 'w3'],
    '137010': ['02', 45, 50, 190, 1.3, 'w3'],
    '137011': ['02', 60, 90, 320, 1.6, 'w3'],
    '137021': ['11', 45, 100, 250, 1.3, 'w3'],
    '137022': ['11', 60, 180, 450, 1.6, 'w3'],
    '137023': ['11', 70, 270, 675, 1.8, 'w3'],
    '137921': ['13', 45, 120, 240, 1.3, 'w3'],
    '137922': ['13', 55, 170, 330, 1.5, 'w3'],
    '137925': ['13', 70, 270, 440, 1.8, 'w3'],
    '137930': ['14-2', 45, 250, 700, 1.3, 'w3'],
    '137628': ['14-2', 65, 500, 1450, 1.7, 'w3'],
    '137935': ['14-4', 45, 250, 785, 1.3, 'f18'],
    '137936': ['14-4', 60, 450, 1165, 1.6, 'f18'],
    '137937': ['14-4', 70, 690, 1745, 1.8, 'f18'],
    '137903': ['17', 45, 160, 290, 1.3, 'w3'],
    '137904': ['17', 60, 250, 450, 1.6, 'w3'],
    '137905': ['17', 70, 350, 840, 1.8, 'w3'],
    '137470': ['21-2', 45, 180, 400, 1.3, 'w3'],
    '137472': ['21-2', 60, 300, 700, 1.6, 'w3'],
    '137474': ['21-2', 70, 500, 1350, 1.8, 'w3'],
    '137071': ['21-4', 45, 180, 400, 1.3, 'w3'],
    '137074': ['21-4', 60, 300, 700, 1.6, 'w3'],
    '137079': ['21-4', 70, 500, 1350, 1.8, 'w3'],
    '137142': ['27', 40, 245, 500, 1.2, 'w3'],
    '137143': ['27', 50, 350, 745, 1.4, 'w3'],
    '137144': ['27', 60, 500, 900, 1.6, 'w3'],
    '137063': ['31', 50, 310, 480, 1.4, 'w3'],
    '137061': ['31', 60, 500, 900, 1.6, 'w3'],
    '137062': ['31', 70, 750, 1600, 1.8, 'w3'],
    '137075': ['33', 45, 300, 600, 1.3, 'w3'],
    '137077': ['33', 60, 600, 930, 1.6, 'w3'],
    '137078': ['33', 70, 900, 1500, 1.8, 'w3'],
    '137171': ['36', 45, 400, 1250, 1.3, 'w3'],
    '137172': ['36', 60, 700, 1900, 1.6, 'w3'],
    '137173': ['36', 70, 1100, 3500, 1.8, 'w3'],
    '137981': ['39', 40, 400, 720, 1.2, 'w3'],
    '137982': ['39', 50, 600, 1150, 1.4, 'w3'],
    '137983': ['39', 60, 900, 1400, 1.6, 'w3'],
    '137984': ['39', 70, 1100, 2200, 1.8, 'w3'],
    '137081': ['40', 45, 420, 700, 1.3, 'w3'],
    '137082': ['40', 60, 690, 1150, 1.6, 'w3'],
    '137083': ['40', 70, 1080, 2000, 1.8, 'w3'],
    '137595': ['45', 45, 420, 700, 1.3, 'w3'],
    '137596': ['45', 60, 700, 1250, 1.6, 'w3'],
    '137597': ['45', 70, 1100, 2000, 1.8, 'w3'],
    '137091': ['60', 45, 900, 2000, 1.3, 'w3'],
    '137092': ['60', 60, 1250, 3000, 1.6, 'w3'],
    '137093': ['60', 70, 1560, 4000, 1.8, 'w3'],
    '137208': ['62', 45, 450, 1350, 1.3, 'w3'],
    '137226': ['62', 60, 1000, 2500, 1.6, 'w3'],
    '137232': ['62', 70, 1400, 4500, 1.8, 'w3'],
    '137176': ['65', 50, 500, 900, 1.4, 'w3'],
    '137177': ['65', 65, 1100, 1650, 1.7, 'w3'],
    '137178': ['65', 75, 1560, 2200, 1.9, 'w3'],
    '137738': ['68', 40, 750, 1100, 1.2, 'w3'],
    '137739': ['68', 50, 1300, 1820, 1.4, 'w3'],
    '137740': ['68', 60, 1700, 2200, 1.6, 'w3'],
    '137741': ['68', 70, 2200, 3270, 1.8, 'w3'],
    '137101': ['70', 45, 1000, 1430, 1.3, 'w3'],
    '137102': ['70', 60, 2100, 3000, 1.6, 'w3'],
    '137103': ['70', 70, 2500, 4165, 1.8, 'w3'],
    '137786': ['75', 45, 850, 465, 1.3, 'w3'],
    '137787': ['75', 60, 1600, 1000, 1.6, 'w3'],
    '137830': ['121-ng', 55, 1750, 1350, 1.5, 'w3'],
    '137833': ['121-ng', 65, 2000, 2500, 1.7, 'w3'],
    '137841': ['121-np', 45, 730, 800, 1.3, 'w3'],
    '137829': ['121-np', 55, 1200, 1100, 1.5, 'w3'],
    '137891': ['141', 50, 175, 210, 1.4, 'w3'],
    '137893': ['141', 60, 250, 250, 1.6, 'w3'],
    '137007': ['00', 45, 25, 83, 1.3, 'w3'],
    '137008': ['00', 60, 50, 150, 1.6, 'w3'],
    '137009': ['00', 70, 75, 250, 1.8, 'w3'],
    '137001': ['10', 45, 75, 185, 1.3, 'w3'],
    '137002': ['10', 60, 140, 300, 1.6, 'w3'],
    '137003': ['10', 70, 210, 525, 1.8, 'w3'],
    '137914': ['12', 45, 80, 140, 1.3, 'w3'],
    '137916': ['12', 55, 120, 210, 1.5, 'w3'],
    '137918': ['12', 70, 200, 450, 1.8, 'w3'],
    '137031': ['20', 45, 120, 300, 1.3, 'w3'],
    '137034': ['20', 60, 200, 500, 1.6, 'w3'],
    '137039': ['20', 70, 330, 750, 1.8, 'w3'],
    '137041': ['30', 40, 140, 265, 1.2, 'w3'],
    '137043': ['30', 50, 190, 410, 1.4, 'w3'],
    '137042': ['30', 60, 300, 600, 1.6, 'w3'],
    '137044': ['30', 70, 370, 960, 1.8, 'w3'],
    '137065': ['35', 45, 200, 800, 1.3, 'w3'],
    '137067': ['35', 60, 450, 1125, 1.6, 'w3'],
    '137068': ['35', 70, 760, 1760, 1.8, 'w3'],
    '137961': ['38', 40, 300, 450, 1.2, 'w3'],
    '137962': ['38', 50, 400, 700, 1.4, 'w3'],
    '137963': ['38', 60, 650, 1150, 1.6, 'w3'],
    '137964': ['38', 70, 900, null, 1.8, null],
    '137730': ['67', 40, 600, 880, 1.2, 'w3'],
    '137731': ['67', 50, 900, 1285, 1.4, 'w3'],
    '137732': ['67', 60, 1100, 1440, 1.6, 'w3'],
    '137733': ['67', 70, 1500, 2415, 1.8, 'w3'],
    '137871': ['120-np', 45, 440, 500, 1.3, 'w3'],
    '137872': ['120-np', 55, 720, 900, 1.5, 'w3'],
    '137231': ['50-m16x15', 40, 120, 230, 1.2, 'w2'],
    '137233': ['50-m16x15', 50, 170, 320, 1.4, 'w2'],
    '137235': ['50-m16x15', 60, 250, 460, 1.6, 'w2'],
    '137237': ['50-m16x15', 70, 300, 750, 1.8, 'w2'],
    '137085': ['50-m16x2', 40, 120, 230, 1.2, 'w2'],
    '137086': ['50-m16x2', 50, 170, 320, 1.4, 'w2'],
    '137087': ['50-m16x2', 60, 250, 460, 1.6, 'w2'],
    '137088': ['50-m16x2', 70, 300, 750, 1.8, 'w2'],
    '137241': ['51-m16x15', 40, 150, 310, 1.2, 'w2'],
    '137243': ['51-m16x15', 50, 220, 435, 1.4, 'w2'],
    '137245': ['51-m16x15', 60, 320, 715, 1.6, 'w2'],
    '137247': ['51-m16x15', 70, 420, 930, 1.8, 'w2'],
    '137095': ['51-m16x2', 40, 150, 310, 1.2, 'w2'],
    '137096': ['51-m16x2', 50, 220, 435, 1.4, 'w2'],
    '137097': ['51-m16x2', 60, 320, 715, 1.6, 'w2'],
    '137098': ['51-m16x2', 70, 420, 930, 1.8, 'w2'],
    '137213': ['100-a', null, 3750, 7500, 1.6, 'w2'],
    '137214': ['100-b', null, 2300, 4500, 1.5, 'w2'],
    '137215': ['100-c', null, 1600, 3200, 1.5, 'w2'],
    '137438': ['200-a', null, 8500, 18210, 1.7, 'w3'],
    '137437': ['200-b', null, 4500, 9295, 1.4, 'w3'],
    '177081': ['hid-31', 40, 250, 250, null, 'k2'],
    '177085': ['hid-31', 45, 310, 280, null, 'k2'],
    '177082': ['hid-31', 50, 370, 375, null, 'k2'],
    '177083': ['hid-31', 60, 500, 550, null, 'k2'],
    '177084': ['hid-31', 70, 550, 800, null, 'k2'],
    '177104': ['hid-32', 40, 250, 300, null, 'k2'],
    '177105': ['hid-32', 50, 370, 460, null, 'k2'],
    '177106': ['hid-32', 60, 500, 600, null, 'k2'],
    '177107': ['hid-32', 70, 550, 1000, null, 'k2'],
    '177051': ['hid-70', 40, 300, 400, null, 'k2'],
    '177052': ['hid-70', 50, 500, 600, null, 'k2'],
    '177053': ['hid-70', 60, 700, 800, null, 'k2'],
    '177054': ['hid-70', 70, 900, 1400, null, 'k2'],
    '177055': ['hid-71', 40, 400, 300, null, 'k2'],
    '177056': ['hid-71', 50, 600, 450, null, 'k2'],
    '177057': ['hid-71', 60, 900, 650, null, 'k2'],
    '177058': ['hid-71', 70, 1000, 1100, null, 'k2'],
    '177294': ['hid-72', 40, 400, 300, null, 'k2'],
    '177295': ['hid-72', 50, 600, 450, null, 'k2'],
    '177296': ['hid-72', 60, 900, 650, null, 'k2'],
    '177297': ['hid-72', 70, 1000, 950, null, 'k2'],
    '137460': ['dsm-22', 50, 250, null, null, null],
    '137461': ['dsm-83', 45, 150, null, null, null],
    '137462': ['dsm-83', 55, 250, null, null, null],
    '137463': ['dsm-83', 65, 350, null, null, null],
    '137464': ['dsm-141', 50, 175, null, null, null],
    '137465': ['dsm-141', 60, 250, null, null, null]
  };

  // AMC-EO (ürün karşılaştırma aracı, 24.11.2025 dökümü; Cone 67 AMC teknik
  // departmanının yazılı bildirimi) — [statik x, y, z], [dinamik x, y, z] N/mm.
  // 137829: nominal yayımlanmadı — AMC hesabı 13948'den geri çözülen BMC 8x8
  // çalışma noktası (tests/unit/mount-library-amc-cone.test.js).
  var EO = {
    '137963': [[1800, 1210, 1150], [2880, 1936, 1840]],
    '137964': [[2770, 1990, 1900], [4986, 3582, 3420]],
    '137731': [[3090, 2150, 1325], [4326, 3010, 1855]],
    '137981': [[1340, 1340, 720], [1608, 1608, 864]],
    '137982': [[2200, 2200, 1150], [3080, 3080, 1610]],
    '137983': [[2490, 2490, 1400], [3984, 3984, 2240]],
    '137830': [[4000, 4000, 1350], [6000, 6000, 2025]],
    '137833': [[5800, 5800, 2500], [9860, 9860, 4250]],
    '177296': [[1090, 1090, 650], [2180, 2180, 1300]],
    '137829': [[3150, 3150, 1075], [4605, 4605, 1755]]
  };
  // BMC TEKNİK RESİMLERİ (kullanıcı 2026-11-10; dokuz resim, CATIA V6, A3).
  // Her resim AMC'nin kendi çizimini (CONE 31 · 38 · 39 SUPPORT, HYDROCONE 72 SUPPORT;
  // 2019–2023) ve kodun veri kutusunu taşıyor: statik [x, y, z] N/mm (kutuda kN/mm),
  // dinamik/statik oran, sönüm. Resmin kendisi programa GİRMEZ (BMC'nin hakları,
  // program Pages'te yayımlanıyor); sayılar girer. BMC parça numarası ne ekranda ne
  // kodda yazılır (kullanıcı 2026-11-10: "BMC parça no kısmını eklemeyelim").
  //   • 137963 · 137964 · 177296: kutu = AMC-EO (üç eksen ve oran birebir).
  //   • 137061 · 137062 · 137961: X · Y YENİ → tam tip. 137061/137062 oran yazmıyor
  //     (yalnız sönüm): oran NF grafiğinin (Sh+20)/50'si (KOD'un din'i). 137961'in
  //     dinamik kutusu (1,44 · 0,936 · 0,54) = statik × 1,2.
  //   • 137961: Z BASMA EĞRİSİ (resimde gömülü grafik, 1531 × 733 px): ızgaradan
  //     kalibrasyon (artık < 0,6 px = 0,006 mm · 11 N), çizginin koyuluk ağırlıklı
  //     ortası, 4. derece polinom (orijinden; RMS 23 N, en büyük 68 N), 0,5 mm adım.
  //     Maks. yükte (300 kg) sekant 449,7 N/mm (tablo 450); orijin eğimi 409 N/mm.
  //     Geri-gelme tarafı resimde yok: eğri δ = 0'da biter, çekirdek ötesini uç
  //     eğimle doğrusal sürer (doğrusal takozun aynı varsayımı).
  //   • 137962: resmin başlığı Cone 38 50 ShA ama veri kutusu 137963'ün (60 ShA)
  //     kopyası (650 kg · 1,8 · 1,21 · 1,15 · 1,6) — YAZILMADI, tip eksik kalır.
  //   • 137981 · 137982: resimde yalnız ailenin yük tablosu (tabloyla aynı).
  //   • Resmin ağırlığı sitedekinden büyük (Cone 31 1,242 kg ↔ 1.188 g · Cone 38
  //     1,926 ↔ 1.438 · Cone 39 1,938 ↔ 1.438): sitenin değeri tutuldu; hidrolik 72'de
  //     sitede yok, resimden (3,034 kg).
  // sonum: kutunun "Damping"i — ζ montaj genelinde Çözücü'de; künyede veri.
  var RESIM = {
    '137061': { s: [2470, 2470, 900], sonum: 0.06 },
    '137062': { s: [2750, 2750, 1600], sonum: 0.08 },
    '137963': { s: [1800, 1210, 1150], din: 1.6 },
    '137964': { s: [2770, 1990, 1900], din: 1.8 },
    '177296': { s: [1090, 1090, 650], din: 2 },
    '137961': { s: [1200, 780, 450], din: 1.2, sonum: 0.03,
                // basma: [δ mm, F N], δ > 0 basma (resmin ekseni)
                egriZ: [[0.5, 204], [1, 407], [1.5, 609], [2, 811], [2.5, 1013], [3, 1218], [3.5, 1427],
                        [4, 1642], [4.5, 1866], [5, 2101], [5.5, 2352], [6, 2622], [6.5, 2915], [7, 3236],
                        [7.5, 3590], [8, 3982], [8.5, 4418], [9, 4905], [9.5, 5448], [10, 6055], [10.5, 6733],
                        [11, 7490], [11.5, 8335], [12, 9275], [12.5, 10319], [12.75, 10884]] }
  };
  // Kütüphanedeki eski sıra (ilk 24 girdinin sırası taramanın kombinasyon sırasıdır).
  var ESKI = ['137963', '137964', '137731', '137981', '137982', '137983', '137830', '137833', '177296', '137829'];
  var KAYNAK = {
    w3: 'AMC yük–sehim grafiği · Rev. 3', w2: 'AMC yük–sehim grafiği · Rev. 2',
    k2: 'AMC genel kataloğu · s. 36–37', f18: 'AMC föyü · 2018',
    eo: 'AMC-EO · 24.11.2025', bmc: 'AMC hesabı 13948 · çalışma noktası',
    resim: 'AMC çizimi · BMC teknik resmi'
  };
  var AILE_SIRA = ['masif', 'kesikli', 'flansli', 'hidrolik', 'dsm'];

  function ad(kod) {
    var k = KOD[kod], t = TIP[k[0]];
    return t[1] + (k[1] != null ? ' ' + k[1] + ' ShA' : '') + ' (AMC ' + kod + ')';
  }
  // ── RADYAL TAHMİN (kullanıcı 2026-11-10, Canlı Not 113: *"X ve Y eksenlerinde
  // değerlerimiz yok. Programın çözmesi gerek, yani program reddeder diye bir kıstas
  // olmaması lazım"*). Radyal değeri yayımlanmayan kodda kx = rx·kz, ky = ry·kz
  // (5 N/mm'ye yuvarlı), dinamik = statik × kodun din./stat. oranı (eksenelinkiyle
  // aynı). Oran AMC'nin KENDİ ölçümünden: AMC-EO dökümü + teknik resimlerin kutuları
  // (RESIM; EO'dakiler bir kez sayılır). Aynı tipte oran SERTLİKLE değişebilir:
  // Cone 39'da az (1,86 · 1,91 · 1,78), resimlerde çok (Cone 38 x: 40 ShA 2,67 ·
  // 60 ShA 1,57 · 70 ShA 1,46; Cone 31 60 ShA 2,74 · 70 ShA 1,72) — kodun oranı
  // tipin ölçülmüş sertlikleri arasında DOĞRUSAL ara değer, dışında en yakın ölçülmüş
  // sertliğinki (öteleme yok); bir sertliği dışarıda bırakan sınamada ortalamadan
  // yakın (kapı). Sıra: aynı tipin ölçümü → aynı ailenin ölçülmüş tiplerinin
  // medyanı (tip ortalaması, eksen başına; kesikli konide x ≠ y) → bütün ölçülmüş
  // tiplerin medyanı (x = y). Hidrolik konide din./stat. yayımlanmıyor: ailenin
  // ölçümü (177296: 2,0). DSM'de kz yok, tahmin de yok. Tahmin edilen alanlar
  // girdinin `tahmin` dizisinde; Takoz Özellikleri'nde girilen değer o alanı
  // tahminden çıkarır, kalan tahmin girilen değerden yeniden kurulur (tamamla).
  // Kapı: tests/unit/mount-amc.test.js → *RADYAL TAHMİN*.
  // Kodun ölçülmüş statik üçlüsü ve belgesi (EO önce; resimde yeni olan kutular).
  function olcum(kod) {
    if (EO[kod]) return { s: EO[kod][0], belge: 'AMC-EO' };
    var r = RESIM[kod];
    return (r && r.s) ? { s: r.s, belge: 'AMC çizimi' } : null;
  }
  var ORAN = (function() {
    var ort = function(v) { return v.reduce(function(t, x) { return t + x; }, 0) / v.length; };
    var med = function(v) {
      v = v.slice().sort(function(a, b) { return a - b; });
      var n = v.length; return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
    };
    var olc = {}, din = {};
    Object.keys(KOD).forEach(function(kod) {
      var o = olcum(kod); if (!o) return;
      var t = KOD[kod][0], s = o.s;
      (olc[t] = olc[t] || []).push({ kod: kod, sh: KOD[kod][1], x: s[0] / s[2], y: s[1] / s[2], belge: o.belge });
    });
    // din./stat. yalnız dinamiği ölçülen EO'dan (yalnız hidrolik okur; NR'de kodun oranı)
    Object.keys(EO).forEach(function(kod) {
      var s = EO[kod][0], d = EO[kod][1], a = TIP[KOD[kod][0]][0];
      (din[a] = din[a] || []).push(ort([d[0] / s[0], d[1] / s[1], d[2] / s[2]]));
    });
    var tip = {}, aile = {}, tum = [];
    var belgeler = function(L) { return ['AMC-EO', 'AMC çizimi'].filter(function(b) { return L.some(function(o) { return o.belge === b; }); }); };
    Object.keys(olc).forEach(function(t) {
      var L = olc[t].sort(function(a, b) { return (a.sh || 0) - (b.sh || 0); });
      var r = { x: ort(L.map(function(o) { return o.x; })), y: ort(L.map(function(o) { return o.y; })), n: L.length, olc: L, belge: belgeler(L) };
      tip[t] = r;
      var a = TIP[t][0]; (aile[a] = aile[a] || []).push(r);
      tum.push(r);
    });
    var A = {};
    Object.keys(aile).forEach(function(a) {
      var R = aile[a];
      A[a] = { x: med(R.map(function(r) { return r.x; })), y: med(R.map(function(r) { return r.y; })), n: R.length,
               belge: belgeler([].concat.apply([], R.map(function(r) { return r.olc; }))) };
    });
    var D = {};
    Object.keys(din).forEach(function(a) { D[a] = ort(din[a]); });
    var hx = med(tum.map(function(r) { return (r.x + r.y) / 2; }));
    return { tip: tip, aile: A, hepsi: { x: hx, y: hx, n: tum.length, belge: belgeler([].concat.apply([], tum.map(function(r) { return r.olc; }))) }, din: D };
  })();
  // Tipin oranı kodun sertliğinde: ölçülmüş sertlikler arasında doğrusal, dışında en
  // yakınınki; sertliği yazılmayan kodda (ya da ölçümde) tipin ortalaması.
  function tipOrani(T, sh) {
    var L = T.olc, son = L[L.length - 1];
    if (sh == null || L.some(function(o) { return o.sh == null; })) return { x: T.x, y: T.y, sh: null, olc: L };
    if (sh <= L[0].sh) return { x: L[0].x, y: L[0].y, sh: [L[0].sh], olc: [L[0]] };
    if (sh >= son.sh) return { x: son.x, y: son.y, sh: [son.sh], olc: [son] };
    for (var i = 0; i < L.length - 1; i++) {
      var a = L[i], b = L[i + 1];
      if (sh >= a.sh && sh <= b.sh) {
        var u = (sh - a.sh) / (b.sh - a.sh);
        return { x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y), sh: [a.sh, b.sh], olc: [a, b] };
      }
    }
    return { x: T.x, y: T.y, sh: null, olc: L };
  }
  var bes = function(v) { return Math.max(5, Math.round(v / 5) * 5); };
  // Kodun tahmin oranı: { x, y, din, kaynak:{ tur:'tip'|'aile'|'hepsi', ad, n, sh, belge } } —
  // ölçülü kodda null. sh: oranın alındığı ölçülmüş sertlik(ler) (tipte).
  function tahminOrani(kod) {
    var k = KOD[kod]; if (!k || olcum(kod)) return null;
    var t = k[0], a = TIP[t][0], r, kaynak;
    if (ORAN.tip[t]) {
      r = tipOrani(ORAN.tip[t], k[1]);
      kaynak = { tur: 'tip', ad: TIP[t][1], n: ORAN.tip[t].n, sh: r.sh,
                 belge: ['AMC-EO', 'AMC çizimi'].filter(function(b) { return r.olc.some(function(o) { return o.belge === b; }); }) };
    }
    else if (ORAN.aile[a]) { r = ORAN.aile[a]; kaynak = { tur: 'aile', ad: AILE[a][0], n: r.n, belge: r.belge }; }
    else { r = ORAN.hepsi; kaynak = { tur: 'hepsi', ad: null, n: r.n, belge: r.belge }; }
    var dn = k[4] != null ? k[4] : (ORAN.din[a] != null ? Math.round(ORAN.din[a] * 100) / 100 : null);
    return { x: Math.round(r.x * 1000) / 1000, y: Math.round(r.y * 1000) / 1000, din: dn, dinTahmin: k[4] == null && dn != null, kaynak: kaynak };
  }
  // Tahminli alanları girdinin KENDİ eksenelinden yeniden kur (girilmiş değer tahmin değil).
  function tamamla(e) {
    var R = e && e.amc && e.amc.radyal, T = e && e.tahmin;
    if (!R || !T || !T.length || !(e.sz > 0)) return e;
    var var_ = function(f) { return T.indexOf(f) >= 0; };
    if (var_('sx')) e.sx = bes(R.x * e.sz);
    if (var_('sy')) e.sy = bes(R.y * e.sz);
    if (R.din != null) {
      if (var_('dz')) e.dz = Math.round(e.sz * R.din);
      if (var_('dx') && e.sx > 0) e.dx = Math.round(e.sx * R.din);
      if (var_('dy') && e.sy > 0) e.dy = Math.round(e.sy * R.din);
    }
    return e;
  }

  // Kütüphane girdisi (VE_MOUNT_LIBRARY biçimi). Radyal yayımlanmayan kodda tahmin
  // (`tahmin` alanları, `amc.radyal` oranı); kz'si olmayan kodda (DSM) eksen null:
  // çözücü boş rijitliği reddeder, Takoz penceresi eksik der.
  // Kütüphanenin marka grubu (cp-mount.js → VE_MNT_LIB_MARKALAR'ın ilki, Canlı Not 106).
  var MARKA = 'AMC Mecanocaucho';
  function girdi(kod) {
    var k = KOD[kod]; if (!k) return null;
    var t = TIP[k[0]], eo = EO[kod], kz = k[3], din = k[4], r = RESIM[kod] || null, rs = r && r.s;
    var e = { marka: MARKA, name: ad(kod), maxLoad: k[2] };
    e.amc = { kod: kod, tip: k[0], aile: t[0], sh: k[1], tork: t[3], gr: t[4],
              kzKaynak: eo ? (kod === '137829' ? 'bmc' : 'eo') : (rs ? 'resim' : k[5]), kzGrafik: kz, din: din,
              sonum: (r && r.sonum != null) ? r.sonum : null };
    // Eğri model konvansiyonunda (δ < 0 = BASMA): [−δ, −F] … [0, 0].
    if (r && r.egriZ) e.curves = { z: r.egriZ.slice().reverse().map(function(p) { return [-p[0], -p[1]]; }).concat([[0, 0]]) };
    if (eo) {
      e.sx = eo[0][0]; e.sy = eo[0][1]; e.sz = eo[0][2]; e.dx = eo[1][0]; e.dy = eo[1][1]; e.dz = eo[1][2];
      return e;
    }
    if (rs) {
      var dn = (r.din != null) ? r.din : din;
      e.sx = rs[0]; e.sy = rs[1]; e.sz = rs[2];
      e.dx = Math.round(rs[0] * dn); e.dy = Math.round(rs[1] * dn); e.dz = Math.round(rs[2] * dn);
      return e;
    }
    e.sx = null; e.sy = null; e.sz = (kz != null ? kz : null);
    e.dx = null; e.dy = null; e.dz = (kz != null && din != null) ? Math.round(kz * din) : null;
    var R = kz != null ? tahminOrani(kod) : null;
    if (R) {
      e.amc.radyal = R;
      e.tahmin = ['sx', 'sy'].concat(R.din != null ? ['dx', 'dy'] : []).concat(R.dinTahmin ? ['dz'] : []);
      tamamla(e);
    }
    return e;
  }
  // Bütün kodlar, ailenin/tipin/sertliğin sırasıyla (eski 10 kod da yerinde).
  function kodlar() {
    var tipSira = TIP_SIRA;
    return Object.keys(KOD).sort(function(a, b) {
      var A = KOD[a], B = KOD[b];
      return (AILE_SIRA.indexOf(TIP[A[0]][0]) - AILE_SIRA.indexOf(TIP[B[0]][0]))
        || (tipSira.indexOf(A[0]) - tipSira.indexOf(B[0])) || ((A[1] || 0) - (B[1] || 0)) || ((A[2] || 0) - (B[2] || 0));
    });
  }
  // Görselin adresi: derleme gömer (build.js → __MFSIM_TAKOZ), modüler kopyada dosya.
  function gorsel(adi) {
    var rel = 'takoz/amc/' + adi + '.webp';
    var G = (typeof window !== 'undefined' && window.__MFSIM_TAKOZ) || null;
    return (G && G[rel]) || ('assets/' + rel);
  }
  // Künye: Takoz Özellikleri'nin gösterdiği veri ve tipin teknik resmi.
  function kunye(kod) {
    var k = KOD[kod]; if (!k) return null;
    var t = TIP[k[0]], a = AILE[t[0]], e = girdi(kod);
    return { kod: kod, ad: e.name, urun: t[1], aile: a[0], sh: k[1], maxLoad: k[2], tork: t[3], gr: t[4],
             cizim: gorsel('cizim-' + t[2]), kaynak: KAYNAK[e.amc.kzKaynak] || null, sonum: e.amc.sonum, egriZ: !!e.curves };
  }
  return { MARKA: MARKA, AILE: AILE, TIP: TIP, TIP_SIRA: TIP_SIRA, KOD: KOD, EO: EO, RESIM: RESIM, ESKI: ESKI, KAYNAK: KAYNAK,
           ORAN: ORAN, ad: ad, girdi: girdi, kodlar: kodlar, gorsel: gorsel, kunye: kunye,
           olcum: olcum, tipOrani: tipOrani, tahminOrani: tahminOrani, tamamla: tamamla };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = VE_MNT_AMC;
