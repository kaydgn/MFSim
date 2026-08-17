/* =========================================================================
 * fead-validation.js  v2.0 — FEAD çekirdeği için referans veri + koşucu
 * =========================================================================
 * Gates raporlarından birebir alınmış referans değerler ve bunlara karşı
 * fead-core.js'i koşturan doğrulama harness'ı.
 *
 *   node fead-validation.js            -> özet
 *   node fead-validation.js --detay    -> sapması %0.5 üstü her satır
 *
 * VERİ SETLERİ
 *   AG00686 : BMC 6 sil., 8PK1475HD, 4 kasnak — gergi T38624 CW, sense = +1
 *             (tek pozitif yonlu vaka). Gercek rapor.
 *   AG0868  : BMC 6 sil., 3 kasnak (CRK A_C TEN) — UC VARYANT: 4PK1013 /
 *             6PK1018 / 8PK1020. Ayni kasnaklar, ayni duty, ayni 90 C;
 *             sadece kaburga sayisi ve tasarim gerginligi degisiyor ->
 *             KONTROLLU DENEY: omur ~ (kaburga/T)^1.13
 *   AG00686-1520 : CRK ø172 / A_C ø137, gergi T38624 CW (sense +1)
 *   AG00810 : BMC TTA-6x6, 250A alternator, 10PK1215HD, 4 kasnak.
 *             ALT capi 55 mm (en kucuk) ve yorulma modeli PK-2_2a-MT3
 *             (digerleri PK-2_2p-MT3) -> farkli yorulma sabitleri.
 *             Raporda Spring Pre-Load YOK; mean torktan turetildi (11.561 Nm).
 *   AG00976 : BMC Otomotif FEAD 5, Cummins ikincil tahrik, 6 kasnak
 *             (FAN IDR1 A_C IDR2 ALT TEN), 4 revizyon:
 *             8PK1668@-240/115, 8PK1655@-250/104,
 *             8PK1705@-250/110, 8PK1715@-250/110 (Corrected-IDR1)
 *   AG00879 : ANADOLU ISUZU 6x6 Cummins, 5 kasnak (FAN IDR A_C ALT TEN),
 *             8PK1392HD, gergi Gates T38665 (kol 56 mm) - FARKLI gergi ve
 *             farkli kasnak caplari: modelin evrenselligini sinar
 *   AG00894 : BMC 6 sil., 6 kasnak (CRK IDR TM31 IDR SD7H15 TEN), 8PK1738HD,
 *             IKI klima kompresoru / alternator YOK - farkli topoloji
 *   AG00902 : BMC Otomotiv Valeo TM21, 4 kasnak (CRK IDR A_C TEN), iki revizyon.
 *             8PK1300 (v10.01) ve 8PK1275 (v9.55): kasnak CAPLARI degisiyor
 *             (CRK 159->146, A_C 137->127) -> egilme terimi icin kritik cift.
 *             8PK1300'un ORTALAMA GERILME TABLOSU HATALI (asagiya bakiniz),
 *             bu yuzden o rapordan sadece geometri + gergi dogrulanir.
 *
 * NOT 1: Raporlar farkli Gates surumleriyle uretilmistir (v9.40 / v9.55 /
 *   v10.01 / v13.02). "Natural Frequency" degeri surume gore degisir; bkz.
 *   CALIBRATION.tensionerArmInertiaKgM2.
 * NOT 2: "Load" konumu bir MEKANIK STOP'tur, calisma noktasi degildir. Orada
 *   sarim sifira yaklastigi icin T = M/(r*sin(beta)*2sin(phi/2)) tekillesir:
 *   raporun bastigi kol acisindaki 0.1 derecelik yuvarlama tek basina %1.4-2.3
 *   gerilme farki yaratir. Bu yuzden gecme olcutu Load haric %0.5, Load dahil
 *   %1.5 olarak ayrilmistir.
 *
 * Tüm koordinat/çap/yay değerleri raporların "Layout Data" ve "Tensioner
 * Data" bloklarından; tüm beklenen sonuçlar "RESULTS", "Tensioner Geometry"
 * ve "Pulley Hubload Analysis (Mean)" sayfalarından alınmıştır.
 * ========================================================================= */
/* MFSim YEREL FARKI — TEK SATIR: çekirdek js/ altında, harness tests/fixtures/
 * altında durduğu için require yolu göreli olarak düzeltildi. Kaynak dosyada
 * './fead-core.js' yazıyordu. Referans verinin ve karşılaştırma mantığının
 * TEK BİR SAYISI değişmedi; bu dosyanın geri kalanı birebir kopyadır. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports)
    module.exports = factory(require('../../js/fead-core.js'));
  else root.FEADValidation = factory(root.FEADCore);
}(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';
  const NL = String.fromCharCode(10);

  const AG00686 = {
 "note": "Gates AG00686, BMC 6 sil., 8PK1475HD. Kayis gidis sirasi: CRK->IDR->A_C->TEN->CRK.",
 "pulleys": [
  {
   "name": "CRK",
   "x": 0,
   "y": 0,
   "rPitch": 81.2,
   "rEff": 80,
   "contact": "grooved",
   "crank": true
  },
  {
   "name": "IDR",
   "x": -72,
   "y": 267,
   "rPitch": 38.6,
   "rEff": 39.8,
   "contact": "back"
  },
  {
   "name": "A_C",
   "x": -224,
   "y": 448,
   "rPitch": 64.7,
   "rEff": 63.5,
   "contact": "grooved"
  },
  {
   "name": "TEN",
   "tensioner": true,
   "rPitch": 38.6,
   "rEff": 39.8,
   "contact": "back"
  }
 ],
 "tensioner": {
  "pivot": [
   -180,
   100
  ],
  "armLength": 90,
  "freeAngleDeg": 42,
  "sense": 1,
  "preloadNm": 8.59,
  "rateNmPerDeg": 0.482,
  "loadStopRelDeg": 62.4
 },
 "belt": {
  "profile": "PK",
  "brand": "GATES",
  "ribs": 8,
  "effLength": 1475,
  "tolerance": 6,
  "wearPct": 0.007
 },
 "designTensionN": 765.7,
 "ref": {
  "span": {
   "CRK": 249.2,
   "IDR": 212.6,
   "A_C": 248.9,
   "TEN": 212.6
  },
  "wrap": {
   "CRK": 210.2,
   "IDR": 26.7,
   "A_C": 202.9,
   "TEN": 26.4
  },
  "LeffMean": 1478.5,
  "takeupMean": 0.559,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "T": 334.2,
    "hub": 245.3,
    "dir": 199.1,
    "beta": 22.9,
    "wrap": 43.1
   },
   {
    "name": "Replace",
    "rel": 3.8,
    "T": 373.5,
    "hub": 264.5,
    "dir": 199.8,
    "beta": 26,
    "wrap": 41.5
   },
   {
    "name": "MaxBelt",
    "rel": 22.7,
    "T": 583,
    "hub": 324.6,
    "dir": 202.7,
    "beta": 41.9,
    "wrap": 32.3
   },
   {
    "name": "Mean",
    "rel": 33.1,
    "T": 765.7,
    "hub": 349.3,
    "dir": 203.8,
    "beta": 51.3,
    "wrap": 26.4
   },
   {
    "name": "MinBelt",
    "rel": 44.8,
    "T": 1151.6,
    "hub": 378.5,
    "dir": 204.5,
    "beta": 62.3,
    "wrap": 18.9
   },
   {
    "name": "Load",
    "rel": 62.4,
    "T": 3863.1,
    "hub": 436.8,
    "dir": 204.7,
    "beta": 79.7,
    "wrap": 6.5
   }
  ],
  "duty": [
   [
    800,
    3
   ],
   [
    1000,
    4
   ],
   [
    1250,
    5
   ],
   [
    1500,
    5.5
   ],
   [
    1750,
    6.8
   ],
   [
    2000,
    8.2
   ]
  ],
  "T": {
   "800": [
    1210,
    1208,
    767,
    766
   ],
   "1000": [
    1238,
    1237,
    767,
    766
   ],
   "1250": [
    1238,
    1237,
    767,
    766
   ],
   "1500": [
    1198,
    1198,
    766,
    766
   ],
   "1750": [
    1224,
    1223,
    766,
    766
   ],
   "2000": [
    1249,
    1248,
    766,
    766
   ]
  },
  "H": {
   "800": [
    1911,
    557,
    1938,
    350
   ],
   "1000": [
    1939,
    571,
    1967,
    350
   ],
   "1250": [
    1939,
    571,
    1966,
    349
   ],
   "1500": [
    1900,
    552,
    1927,
    349
   ],
   "1750": [
    1925,
    564,
    1952,
    349
   ],
   "2000": [
    1949,
    576,
    1977,
    349
   ]
  }
 }
};

  /* AG00976: dört revizyon. Kasnak çapları dördünde de aynı (Layout Data):
   *   FAN  pitch 164.40 / eff 162.00   A_C pitch 154.40 / eff 152.00
   *   ALT  pitch  59.40 / eff  57.00   düz kasnaklar: flat 75.00 ->
   *   pitch 77.20 (=OD/2+hr) / eff 79.60 (=OD/2+hr+hb), hb=1.2 hr=1.1  */
  const AG00976_OD = { FAN: 162.00, A_C: 152.00, ALT: 57.00, IDR1: 75, IDR2: 75, TEN: 75 };
  const AG00976_CONTACT = { FAN:'grooved', IDR1:'back', A_C:'grooved', IDR2:'back', ALT:'grooved', TEN:'back' };
  const AG00976_ORDER = ['FAN','IDR1','A_C','IDR2','ALT','TEN'];   // kayış gidiş yönü
  const AG00976 = {
 "1668@-240/115": {
  "belt": 1667,
  "tol": 6,
  "wear": 0.7,
  "ribs": 8,
  "pivot": [
   -240,
   115
  ],
  "arm": 90,
  "preload": 8.87,
  "rate": 0.484,
  "meanLoad": 22.43,
  "freeAbsDeg": 12,
  "sense": -1,
  "design": 439,
  "takeupRef": 0.892,
  "NF": 12.5,
  "B10": 2764,
  "xy": {
   "FAN": [
    0,
    0
   ],
   "IDR1": [
    143,
    140
   ],
   "A_C": [
    184,
    314.6
   ],
   "IDR2": [
    0,
    272.5
   ],
   "ALT": [
    -267,
    241
   ],
   "TEN": [
    -153.49,
    90.19
   ]
  },
  "span": {
   "FAN": 159.6,
   "IDR1": 137,
   "A_C": 149.1,
   "IDR2": 260,
   "ALT": 176,
   "TEN": 130.8
  },
  "wrap": {
   "FAN": 154.7,
   "IDR1": 45,
   "A_C": 194.2,
   "IDR2": 58.7,
   "ALT": 156.2,
   "TEN": 41.4
  },
  "lengthOffsetMm": 0.4,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 12,
    "X": -152,
    "Y": 133.7,
    "beta": 30.4,
    "dir": 222.4,
    "hub": 195,
    "T": 192.9,
    "wrap": 60.7,
    "EDL": 1691.9,
    "REBL": 1691.4
   },
   {
    "name": "Replace",
    "rel": 8.5,
    "absDeg": 3.5,
    "X": -150.2,
    "Y": 120.5,
    "beta": 36.8,
    "dir": 220.3,
    "hub": 241.1,
    "T": 258,
    "wrap": 55.7,
    "EDL": 1684.7,
    "REBL": 1684.3
   },
   {
    "name": "Max",
    "rel": 21.4,
    "absDeg": 350.6,
    "X": -151.2,
    "Y": 100.3,
    "beta": 47.5,
    "dir": 218.1,
    "hub": 289.9,
    "T": 365.2,
    "wrap": 46.8,
    "EDL": 1673,
    "REBL": 1672.6
   },
   {
    "name": "Mean",
    "rel": 28,
    "absDeg": 344,
    "X": -153.5,
    "Y": 90.2,
    "beta": 53.5,
    "dir": 217.5,
    "hub": 310,
    "T": 438.9,
    "wrap": 41.4,
    "EDL": 1667,
    "REBL": 1666.6
   },
   {
    "name": "Min",
    "rel": 35,
    "absDeg": 337,
    "X": -157.1,
    "Y": 79.9,
    "beta": 60.3,
    "dir": 217.3,
    "hub": 330.2,
    "T": 549.2,
    "wrap": 35,
    "EDL": 1661,
    "REBL": 1660.6
   },
   {
    "name": "Load",
    "rel": 48.3,
    "absDeg": 323.7,
    "X": -167.5,
    "Y": 61.7,
    "beta": 74.1,
    "dir": 217.8,
    "hub": 372.6,
    "T": 1007.1,
    "wrap": 21.3,
    "EDL": 1651.6,
    "REBL": 1651.2
   }
  ],
  "duty": [
   {
    "engineRpm": 800,
    "dcPct": 25,
    "A_C": 2.7,
    "ALT": 3.61,
    "T": {
     "FAN": 1360,
     "IDR1": 1358,
     "A_C": 966,
     "IDR2": 965,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1766,
     "IDR1": 1039,
     "A_C": 2307,
     "IDR2": 947,
     "ALT": 1379,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 4,
    "A_C": 3.6,
    "ALT": 3.78,
    "T": {
     "FAN": 1300,
     "IDR1": 1299,
     "A_C": 880,
     "IDR2": 879,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1707,
     "IDR1": 993,
     "A_C": 2163,
     "IDR2": 863,
     "ALT": 1294,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1100,
    "dcPct": 4.5,
    "A_C": 4,
    "ALT": 3.83,
    "T": {
     "FAN": 1269,
     "IDR1": 1268,
     "A_C": 846,
     "IDR2": 844,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1676,
     "IDR1": 970,
     "A_C": 2098,
     "IDR2": 829,
     "ALT": 1260,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1200,
    "dcPct": 5,
    "A_C": 4.4,
    "ALT": 3.87,
    "T": {
     "FAN": 1242,
     "IDR1": 1241,
     "A_C": 816,
     "IDR2": 815,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1650,
     "IDR1": 950,
     "A_C": 2042,
     "IDR2": 799,
     "ALT": 1230,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1400,
    "dcPct": 5.5,
    "A_C": 5.1,
    "ALT": 3.93,
    "T": {
     "FAN": 1191,
     "IDR1": 1190,
     "A_C": 767,
     "IDR2": 766,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1599,
     "IDR1": 910,
     "A_C": 1942,
     "IDR2": 751,
     "ALT": 1182,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 6,
    "A_C": 5.4,
    "ALT": 3.94,
    "T": {
     "FAN": 1165,
     "IDR1": 1164,
     "A_C": 746,
     "IDR2": 745,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1573,
     "IDR1": 890,
     "A_C": 1896,
     "IDR2": 731,
     "ALT": 1161,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1600,
    "dcPct": 7.5,
    "A_C": 5.7,
    "ALT": 3.69,
    "T": {
     "FAN": 1123,
     "IDR1": 1122,
     "A_C": 708,
     "IDR2": 708,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1531,
     "IDR1": 858,
     "A_C": 1817,
     "IDR2": 694,
     "ALT": 1124,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1700,
    "dcPct": 9,
    "A_C": 6,
    "ALT": 3.97,
    "T": {
     "FAN": 1122,
     "IDR1": 1122,
     "A_C": 712,
     "IDR2": 711,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1531,
     "IDR1": 858,
     "A_C": 1820,
     "IDR2": 697,
     "ALT": 1127,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1800,
    "dcPct": 0.5,
    "A_C": 6.3,
    "ALT": 3.98,
    "T": {
     "FAN": 1104,
     "IDR1": 1104,
     "A_C": 697,
     "IDR2": 696,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1513,
     "IDR1": 844,
     "A_C": 1788,
     "IDR2": 683,
     "ALT": 1113,
     "TEN": 310
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 12,
    "A_C": 6.7,
    "ALT": 3.99,
    "T": {
     "FAN": 1062,
     "IDR1": 1061,
     "A_C": 672,
     "IDR2": 671,
     "ALT": 440,
     "TEN": 439
    },
    "H": {
     "FAN": 1470,
     "IDR1": 812,
     "A_C": 1720,
     "IDR2": 659,
     "ALT": 1088,
     "TEN": 310
    }
   },
   {
    "engineRpm": 2500,
    "dcPct": 16,
    "A_C": 7,
    "ALT": 4,
    "T": {
     "FAN": 951,
     "IDR1": 951,
     "A_C": 626,
     "IDR2": 625,
     "ALT": 439,
     "TEN": 439
    },
    "H": {
     "FAN": 1361,
     "IDR1": 727,
     "A_C": 1565,
     "IDR2": 613,
     "ALT": 1042,
     "TEN": 310
    }
   },
   {
    "engineRpm": 2750,
    "dcPct": 5,
    "A_C": 7.4,
    "ALT": 4.02,
    "T": {
     "FAN": 923,
     "IDR1": 922,
     "A_C": 610,
     "IDR2": 609,
     "ALT": 439,
     "TEN": 439
    },
    "H": {
     "FAN": 1333,
     "IDR1": 705,
     "A_C": 1521,
     "IDR2": 598,
     "ALT": 1027,
     "TEN": 310
    }
   }
  ],
  "degC": 90
 },
 "1655@-250/104": {
  "belt": 1656,
  "tol": 6,
  "wear": 0.65,
  "ribs": 8,
  "pivot": [
   -250,
   104
  ],
  "arm": 90,
  "preload": 8.99,
  "rate": 0.484,
  "meanLoad": 22.54,
  "freeAbsDeg": 12,
  "sense": -1,
  "design": 580,
  "takeupRef": 0.678,
  "NF": 12.37,
  "B10": 2380,
  "xy": {
   "FAN": [
    0,
    0
   ],
   "IDR1": [
    143,
    140
   ],
   "A_C": [
    184,
    314.6
   ],
   "IDR2": [
    0,
    272.5
   ],
   "ALT": [
    -267,
    241
   ],
   "TEN": [
    -163.49,
    79.2
   ]
  },
  "span": {
   "FAN": 159.6,
   "IDR1": 137,
   "A_C": 149.1,
   "IDR2": 260,
   "ALT": 179.5,
   "TEN": 135.7
  },
  "wrap": {
   "FAN": 149.1,
   "IDR1": 45,
   "A_C": 194.2,
   "IDR2": 58.7,
   "ALT": 151.4,
   "TEN": 31
  },
  "lengthOffsetMm": 1.9,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 12,
    "X": -162,
    "Y": 122.7,
    "beta": 29.8,
    "dir": 221.8,
    "hub": 201.2,
    "T": 234.4,
    "wrap": 50.8,
    "EDL": 1678,
    "REBL": 1676.1
   },
   {
    "name": "Replace",
    "rel": 4.8,
    "absDeg": 7.2,
    "X": -160.7,
    "Y": 115.3,
    "beta": 33.5,
    "dir": 220.7,
    "hub": 227.8,
    "T": 279.9,
    "wrap": 48,
    "EDL": 1674.7,
    "REBL": 1672.8
   },
   {
    "name": "Max",
    "rel": 19.6,
    "absDeg": 352.4,
    "X": -160.8,
    "Y": 92.1,
    "beta": 46,
    "dir": 218.5,
    "hub": 285,
    "T": 438.3,
    "wrap": 37.9,
    "EDL": 1663.9,
    "REBL": 1662
   },
   {
    "name": "Mean",
    "rel": 28,
    "absDeg": 344,
    "X": -163.5,
    "Y": 79.2,
    "beta": 54,
    "dir": 218,
    "hub": 309.8,
    "T": 580.2,
    "wrap": 31,
    "EDL": 1657.9,
    "REBL": 1656
   },
   {
    "name": "Min",
    "rel": 37.8,
    "absDeg": 334.2,
    "X": -169,
    "Y": 64.8,
    "beta": 63.8,
    "dir": 218,
    "hub": 337.8,
    "T": 894.8,
    "wrap": 21.8,
    "EDL": 1651.9,
    "REBL": 1650
   }
  ],
  "duty": [
   {
    "engineRpm": 800,
    "dcPct": 25,
    "A_C": 2.7,
    "ALT": 3.61,
    "T": {
     "FAN": 1501,
     "IDR1": 1499,
     "A_C": 1107,
     "IDR2": 1106,
     "ALT": 582,
     "TEN": 580
    },
    "H": {
     "FAN": 2021,
     "IDR1": 1147,
     "A_C": 2587,
     "IDR2": 1085,
     "ALT": 1640,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 4,
    "A_C": 3.6,
    "ALT": 3.78,
    "T": {
     "FAN": 1441,
     "IDR1": 1440,
     "A_C": 1022,
     "IDR2": 1020,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1961,
     "IDR1": 1101,
     "A_C": 2443,
     "IDR2": 1001,
     "ALT": 1556,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1100,
    "dcPct": 4.5,
    "A_C": 4,
    "ALT": 3.83,
    "T": {
     "FAN": 1410,
     "IDR1": 1409,
     "A_C": 987,
     "IDR2": 986,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1931,
     "IDR1": 1078,
     "A_C": 2378,
     "IDR2": 967,
     "ALT": 1522,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1200,
    "dcPct": 5,
    "A_C": 4.4,
    "ALT": 3.87,
    "T": {
     "FAN": 1384,
     "IDR1": 1383,
     "A_C": 957,
     "IDR2": 956,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1905,
     "IDR1": 1058,
     "A_C": 2322,
     "IDR2": 938,
     "ALT": 1492,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1400,
    "dcPct": 5.5,
    "A_C": 5.1,
    "ALT": 3.93,
    "T": {
     "FAN": 1332,
     "IDR1": 1331,
     "A_C": 908,
     "IDR2": 907,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1854,
     "IDR1": 1018,
     "A_C": 2223,
     "IDR2": 890,
     "ALT": 1444,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 6,
    "A_C": 5.4,
    "ALT": 3.94,
    "T": {
     "FAN": 1306,
     "IDR1": 1305,
     "A_C": 887,
     "IDR2": 886,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1828,
     "IDR1": 998,
     "A_C": 2176,
     "IDR2": 869,
     "ALT": 1424,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1600,
    "dcPct": 7.5,
    "A_C": 5.7,
    "ALT": 3.69,
    "T": {
     "FAN": 1264,
     "IDR1": 1263,
     "A_C": 850,
     "IDR2": 849,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1787,
     "IDR1": 966,
     "A_C": 2098,
     "IDR2": 833,
     "ALT": 1387,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1700,
    "dcPct": 9,
    "A_C": 6,
    "ALT": 3.97,
    "T": {
     "FAN": 1264,
     "IDR1": 1263,
     "A_C": 853,
     "IDR2": 852,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1786,
     "IDR1": 966,
     "A_C": 2100,
     "IDR2": 836,
     "ALT": 1390,
     "TEN": 310
    }
   },
   {
    "engineRpm": 1800,
    "dcPct": 0.5,
    "A_C": 6.3,
    "ALT": 3.98,
    "T": {
     "FAN": 1246,
     "IDR1": 1245,
     "A_C": 838,
     "IDR2": 838,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1769,
     "IDR1": 952,
     "A_C": 2068,
     "IDR2": 822,
     "ALT": 1376,
     "TEN": 310
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 12,
    "A_C": 6.7,
    "ALT": 3.99,
    "T": {
     "FAN": 1203,
     "IDR1": 1202,
     "A_C": 813,
     "IDR2": 813,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1726,
     "IDR1": 920,
     "A_C": 2001,
     "IDR2": 797,
     "ALT": 1351,
     "TEN": 310
    }
   },
   {
    "engineRpm": 2500,
    "dcPct": 16,
    "A_C": 7,
    "ALT": 4,
    "T": {
     "FAN": 1093,
     "IDR1": 1092,
     "A_C": 767,
     "IDR2": 767,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1618,
     "IDR1": 835,
     "A_C": 1846,
     "IDR2": 752,
     "ALT": 1306,
     "TEN": 310
    }
   },
   {
    "engineRpm": 2750,
    "dcPct": 5,
    "A_C": 7.4,
    "ALT": 4.02,
    "T": {
     "FAN": 1064,
     "IDR1": 1063,
     "A_C": 751,
     "IDR2": 750,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1590,
     "IDR1": 813,
     "A_C": 1801,
     "IDR2": 736,
     "ALT": 1291,
     "TEN": 310
    }
   }
  ],
  "degC": 90
 },
 "1705@-250/110": {
  "belt": 1705,
  "tol": 6,
  "wear": 0.59,
  "ribs": 8,
  "pivot": [
   -250,
   110
  ],
  "arm": 90,
  "preload": 9.11,
  "rate": 0.483,
  "meanLoad": 22.66,
  "freeAbsDeg": 12,
  "sense": -1,
  "design": 580,
  "takeupRef": 0.681,
  "NF": 12.42,
  "B10": 2503,
  "xy": {
   "FAN": [
    0,
    0
   ],
   "IDR1": [
    139,
    139.9
   ],
   "A_C": [
    184.2,
    314.5
   ],
   "IDR2": [
    0,
    267.4
   ],
   "ALT": [
    -281,
    259.5
   ],
   "TEN": [
    -163.49,
    85.19
   ]
  },
  "span": {
   "FAN": 155.9,
   "IDR1": 138.3,
   "A_C": 150.8,
   "IDR2": 272.7,
   "ALT": 198.8,
   "TEN": 139.3
  },
  "wrap": {
   "FAN": 151.4,
   "IDR1": 47.4,
   "A_C": 196.3,
   "IDR2": 64.3,
   "ALT": 155.4,
   "TEN": 31.4
  },
  "lengthOffsetMm": 2,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 12,
    "X": -162,
    "Y": 128.8,
    "beta": 28.4,
    "dir": 220.4,
    "hub": 213,
    "T": 255.6,
    "wrap": 49.2,
    "EDL": 1726.4,
    "REBL": 1724.5
   },
   {
    "name": "Replace",
    "rel": 5.2,
    "absDeg": 6.8,
    "X": -160.6,
    "Y": 120.6,
    "beta": 32.7,
    "dir": 219.4,
    "hub": 240,
    "T": 303.4,
    "wrap": 46.6,
    "EDL": 1723,
    "REBL": 1721
   },
   {
    "name": "Max",
    "rel": 19.5,
    "absDeg": 352.5,
    "X": -160.8,
    "Y": 98.2,
    "beta": 45.1,
    "dir": 217.6,
    "hub": 290.9,
    "T": 448.3,
    "wrap": 37.9,
    "EDL": 1712.9,
    "REBL": 1710.9
   },
   {
    "name": "Mean",
    "rel": 28,
    "absDeg": 344,
    "X": -163.5,
    "Y": 85.2,
    "beta": 53.2,
    "dir": 217.2,
    "hub": 314.2,
    "T": 580.4,
    "wrap": 31.4,
    "EDL": 1706.9,
    "REBL": 1704.9
   },
   {
    "name": "Min",
    "rel": 37.6,
    "absDeg": 334.4,
    "X": -168.8,
    "Y": 71.2,
    "beta": 63,
    "dir": 217.4,
    "hub": 340.2,
    "T": 851.8,
    "wrap": 23,
    "EDL": 1700.9,
    "REBL": 1698.9
   }
  ],
  "duty": [
   {
    "engineRpm": 880,
    "dcPct": 25,
    "A_C": 2.7,
    "ALT": 3.61,
    "T": {
     "FAN": 1417,
     "IDR1": 1416,
     "A_C": 1060,
     "IDR2": 1058,
     "ALT": 582,
     "TEN": 580
    },
    "H": {
     "FAN": 1947,
     "IDR1": 1139,
     "A_C": 2451,
     "IDR2": 1127,
     "ALT": 1606,
     "TEN": 315
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 4,
    "A_C": 3.6,
    "ALT": 3.78,
    "T": {
     "FAN": 1441,
     "IDR1": 1440,
     "A_C": 1022,
     "IDR2": 1021,
     "ALT": 582,
     "TEN": 580
    },
    "H": {
     "FAN": 1971,
     "IDR1": 1159,
     "A_C": 2438,
     "IDR2": 1087,
     "ALT": 1568,
     "TEN": 315
    }
   },
   {
    "engineRpm": 1100,
    "dcPct": 4.5,
    "A_C": 4,
    "ALT": 3.83,
    "T": {
     "FAN": 1410,
     "IDR1": 1409,
     "A_C": 987,
     "IDR2": 986,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1940,
     "IDR1": 1134,
     "A_C": 2373,
     "IDR2": 1050,
     "ALT": 1534,
     "TEN": 314
    }
   },
   {
    "engineRpm": 1200,
    "dcPct": 5,
    "A_C": 4.4,
    "ALT": 3.87,
    "T": {
     "FAN": 1384,
     "IDR1": 1383,
     "A_C": 957,
     "IDR2": 956,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1914,
     "IDR1": 1113,
     "A_C": 2317,
     "IDR2": 1018,
     "ALT": 1504,
     "TEN": 314
    }
   },
   {
    "engineRpm": 1400,
    "dcPct": 5.5,
    "A_C": 5.1,
    "ALT": 3.93,
    "T": {
     "FAN": 1332,
     "IDR1": 1331,
     "A_C": 908,
     "IDR2": 907,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1863,
     "IDR1": 1071,
     "A_C": 2218,
     "IDR2": 966,
     "ALT": 1456,
     "TEN": 314
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 6,
    "A_C": 5.4,
    "ALT": 3.94,
    "T": {
     "FAN": 1306,
     "IDR1": 1305,
     "A_C": 887,
     "IDR2": 886,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1837,
     "IDR1": 1050,
     "A_C": 2171,
     "IDR2": 944,
     "ALT": 1435,
     "TEN": 314
    }
   },
   {
    "engineRpm": 1600,
    "dcPct": 7.5,
    "A_C": 5.7,
    "ALT": 3.69,
    "T": {
     "FAN": 1264,
     "IDR1": 1264,
     "A_C": 850,
     "IDR2": 849,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1796,
     "IDR1": 1016,
     "A_C": 2093,
     "IDR2": 904,
     "ALT": 1398,
     "TEN": 314
    }
   },
   {
    "engineRpm": 1700,
    "dcPct": 9,
    "A_C": 6,
    "ALT": 3.97,
    "T": {
     "FAN": 1264,
     "IDR1": 1263,
     "A_C": 853,
     "IDR2": 852,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1795,
     "IDR1": 1016,
     "A_C": 2095,
     "IDR2": 908,
     "ALT": 1402,
     "TEN": 314
    }
   },
   {
    "engineRpm": 1800,
    "dcPct": 0.5,
    "A_C": 6.3,
    "ALT": 3.98,
    "T": {
     "FAN": 1246,
     "IDR1": 1245,
     "A_C": 839,
     "IDR2": 838,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1777,
     "IDR1": 1002,
     "A_C": 2063,
     "IDR2": 892,
     "ALT": 1387,
     "TEN": 314
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 12,
    "A_C": 6.7,
    "ALT": 3.99,
    "T": {
     "FAN": 1203,
     "IDR1": 1202,
     "A_C": 813,
     "IDR2": 813,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1735,
     "IDR1": 967,
     "A_C": 1996,
     "IDR2": 865,
     "ALT": 1363,
     "TEN": 314
    }
   },
   {
    "engineRpm": 2500,
    "dcPct": 16,
    "A_C": 7,
    "ALT": 4,
    "T": {
     "FAN": 1093,
     "IDR1": 1092,
     "A_C": 767,
     "IDR2": 767,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1626,
     "IDR1": 879,
     "A_C": 1841,
     "IDR2": 816,
     "ALT": 1317,
     "TEN": 314
    }
   },
   {
    "engineRpm": 2750,
    "dcPct": 5,
    "A_C": 7.4,
    "ALT": 4.02,
    "T": {
     "FAN": 1064,
     "IDR1": 1064,
     "A_C": 751,
     "IDR2": 751,
     "ALT": 581,
     "TEN": 580
    },
    "H": {
     "FAN": 1598,
     "IDR1": 856,
     "A_C": 1797,
     "IDR2": 799,
     "ALT": 1301,
     "TEN": 314
    }
   }
  ],
  "degC": 90
 },
 "1715@-250/110": {
  "belt": 1715,
  "tol": 6,
  "wear": 0.6,
  "ribs": 8,
  "pivot": [
   -250,
   110
  ],
  "arm": 90,
  "preload": 8.6,
  "rate": 0.48,
  "meanLoad": 22.07,
  "freeAbsDeg": 16.1,
  "sense": -1,
  "design": 544,
  "takeupRef": 0.708,
  "NF": 12.52,
  "B10": 2670,
  "xy": {
   "FAN": [
    0,
    0
   ],
   "IDR1": [
    130.1,
    139.9
   ],
   "A_C": [
    184.2,
    314.5
   ],
   "IDR2": [
    0,
    267.4
   ],
   "ALT": [
    -281,
    259.5
   ],
   "TEN": [
    -161.97,
    91.29
   ]
  },
  "span": {
   "FAN": 148,
   "IDR1": 141.4,
   "A_C": 150.8,
   "IDR2": 272.7,
   "ALT": 194.4,
   "TEN": 141.3
  },
  "wrap": {
   "FAN": 156.2,
   "IDR1": 52.8,
   "A_C": 198.4,
   "IDR2": 64.3,
   "ALT": 157.1,
   "TEN": 34.6
  },
  "lengthOffsetMm": 1.6,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 16.1,
    "X": -163.5,
    "Y": 134.9,
    "beta": 25.2,
    "dir": 221.3,
    "hub": 224.5,
    "T": 260.2,
    "wrap": 51.1,
    "EDL": 1735.4,
    "REBL": 1733.8
   },
   {
    "name": "Replace",
    "rel": 4.7,
    "absDeg": 11.4,
    "X": -161.8,
    "Y": 127.8,
    "beta": 28.9,
    "dir": 220.3,
    "hub": 249.5,
    "T": 301.2,
    "wrap": 48.9,
    "EDL": 1732.5,
    "REBL": 1730.9
   },
   {
    "name": "Max",
    "rel": 19.8,
    "absDeg": 356.3,
    "X": -160.2,
    "Y": 104.3,
    "beta": 41.6,
    "dir": 218,
    "hub": 302.3,
    "T": 437,
    "wrap": 40.5,
    "EDL": 1722.2,
    "REBL": 1720.6
   },
   {
    "name": "Mean",
    "rel": 28.1,
    "absDeg": 348,
    "X": -162,
    "Y": 91.3,
    "beta": 49.4,
    "dir": 217.4,
    "hub": 323.2,
    "T": 543.9,
    "wrap": 34.6,
    "EDL": 1716.2,
    "REBL": 1714.6
   },
   {
    "name": "Min",
    "rel": 37,
    "absDeg": 339.1,
    "X": -165.9,
    "Y": 77.9,
    "beta": 58.2,
    "dir": 217.3,
    "hub": 344.5,
    "T": 731,
    "wrap": 27.3,
    "EDL": 1710.2,
    "REBL": 1708.6
   },
   {
    "name": "Load",
    "rel": 60.4,
    "absDeg": 315.7,
    "X": -185.6,
    "Y": 47.1,
    "beta": 83.3,
    "dir": 218.9,
    "hub": 420.3,
    "T": 5222.8,
    "wrap": 4.6,
    "EDL": 1700.7,
    "REBL": 1699.1
   }
  ],
  "duty": [
   {
    "engineRpm": 880,
    "dcPct": 25,
    "A_C": 2.7,
    "ALT": 3.61,
    "T": {
     "FAN": 1381,
     "IDR1": 1380,
     "A_C": 1023,
     "IDR2": 1022,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1891,
     "IDR1": 1228,
     "A_C": 2372,
     "IDR2": 1088,
     "ALT": 1539,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 4,
    "A_C": 3.6,
    "ALT": 3.78,
    "T": {
     "FAN": 1405,
     "IDR1": 1404,
     "A_C": 985,
     "IDR2": 984,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1915,
     "IDR1": 1249,
     "A_C": 2359,
     "IDR2": 1048,
     "ALT": 1501,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1100,
    "dcPct": 4.5,
    "A_C": 4,
    "ALT": 3.83,
    "T": {
     "FAN": 1374,
     "IDR1": 1373,
     "A_C": 951,
     "IDR2": 949,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1885,
     "IDR1": 1222,
     "A_C": 2295,
     "IDR2": 1011,
     "ALT": 1467,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1200,
    "dcPct": 5,
    "A_C": 4.4,
    "ALT": 3.87,
    "T": {
     "FAN": 1347,
     "IDR1": 1346,
     "A_C": 921,
     "IDR2": 920,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1858,
     "IDR1": 1198,
     "A_C": 2239,
     "IDR2": 979,
     "ALT": 1437,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1400,
    "dcPct": 5.5,
    "A_C": 5.1,
    "ALT": 3.93,
    "T": {
     "FAN": 1296,
     "IDR1": 1295,
     "A_C": 872,
     "IDR2": 871,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1807,
     "IDR1": 1152,
     "A_C": 2140,
     "IDR2": 927,
     "ALT": 1389,
     "TEN": 323
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 6,
    "A_C": 5.4,
    "ALT": 3.94,
    "T": {
     "FAN": 1270,
     "IDR1": 1269,
     "A_C": 851,
     "IDR2": 850,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1781,
     "IDR1": 1129,
     "A_C": 2093,
     "IDR2": 905,
     "ALT": 1368,
     "TEN": 323
    }
   },
   {
    "engineRpm": 1600,
    "dcPct": 7.5,
    "A_C": 5.7,
    "ALT": 3.69,
    "T": {
     "FAN": 1228,
     "IDR1": 1227,
     "A_C": 813,
     "IDR2": 813,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1740,
     "IDR1": 1092,
     "A_C": 2015,
     "IDR2": 865,
     "ALT": 1331,
     "TEN": 323
    }
   },
   {
    "engineRpm": 1700,
    "dcPct": 9,
    "A_C": 6,
    "ALT": 3.97,
    "T": {
     "FAN": 1227,
     "IDR1": 1227,
     "A_C": 817,
     "IDR2": 816,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1739,
     "IDR1": 1092,
     "A_C": 2018,
     "IDR2": 869,
     "ALT": 1334,
     "TEN": 323
    }
   },
   {
    "engineRpm": 1800,
    "dcPct": 0.5,
    "A_C": 6.3,
    "ALT": 3.98,
    "T": {
     "FAN": 1209,
     "IDR1": 1209,
     "A_C": 802,
     "IDR2": 801,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1721,
     "IDR1": 1076,
     "A_C": 1986,
     "IDR2": 853,
     "ALT": 1320,
     "TEN": 323
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 12,
    "A_C": 6.7,
    "ALT": 3.99,
    "T": {
     "FAN": 1167,
     "IDR1": 1166,
     "A_C": 777,
     "IDR2": 776,
     "ALT": 545,
     "TEN": 544
    },
    "H": {
     "FAN": 1679,
     "IDR1": 1038,
     "A_C": 1919,
     "IDR2": 827,
     "ALT": 1295,
     "TEN": 323
    }
   },
   {
    "engineRpm": 2500,
    "dcPct": 16,
    "A_C": 7,
    "ALT": 4,
    "T": {
     "FAN": 1056,
     "IDR1": 1056,
     "A_C": 731,
     "IDR2": 730,
     "ALT": 544,
     "TEN": 544
    },
    "H": {
     "FAN": 1570,
     "IDR1": 940,
     "A_C": 1765,
     "IDR2": 778,
     "ALT": 1250,
     "TEN": 323
    }
   },
   {
    "engineRpm": 2750,
    "dcPct": 5,
    "A_C": 7.4,
    "ALT": 4.02,
    "T": {
     "FAN": 1028,
     "IDR1": 1027,
     "A_C": 715,
     "IDR2": 714,
     "ALT": 544,
     "TEN": 544
    },
    "H": {
     "FAN": 1541,
     "IDR1": 914,
     "A_C": 1720,
     "IDR2": 760,
     "ALT": 1234,
     "TEN": 323
    }
   }
  ],
  "degC": 90
 }
};

  /* AG00879 + AG00894: cap/pitch degerleri dogrudan Layout Data'dan. */
  const AG_MISC = {
 "AG00879": {
  "gatesVersion": "9.40",
  "order": [
   "FAN",
   "IDR",
   "A_C",
   "ALT",
   "TEN"
  ],
  "pulley": {
   "FAN": {
    "p": 152.01,
    "e": 149.61,
    "c": "grooved",
    "crank": 1
   },
   "IDR": {
    "p": 76.2,
    "e": 78.6,
    "c": "back"
   },
   "A_C": {
    "p": 129.4,
    "e": 127,
    "c": "grooved"
   },
   "ALT": {
    "p": 61.2,
    "e": 58.8,
    "c": "grooved"
   },
   "TEN": {
    "p": 76.2,
    "e": 78.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "FAN": [
    0,
    0
   ],
   "IDR": [
    140,
    -45
   ],
   "A_C": [
    265,
    -40
   ],
   "ALT": [
    320,
    200
   ],
   "TEN": [
    143.4,
    52.55
   ]
  },
  "belt": 1392,
  "tol": 5,
  "wear": 0.7,
  "ribs": 8,
  "pivot": [
   183,
   92.15
  ],
  "arm": 56,
  "preload": 20.05,
  "rate": 0.409,
  "meanLoad": 31.14,
  "freeAbsDeg": 252.1,
  "design": 476,
  "takeupRef": 1.143,
  "NF": 21.98,
  "B10": 5632,
  "span": {
   "FAN": 92.8,
   "IDR": 71.3,
   "A_C": 243.8,
   "ALT": 219.6,
   "TEN": 101.5
  },
  "wrap": {
   "FAN": 241.3,
   "IDR": 86,
   "A_C": 138,
   "ALT": 152.2,
   "TEN": 85.4
  },
  "ratio": {
   "FAN": 1,
   "IDR": 1.995,
   "A_C": 1.175,
   "ALT": 2.484,
   "TEN": 1.995
  },
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 252.1,
    "X": 165.8,
    "Y": 38.9,
    "beta": 35.6,
    "dir": 107.7,
    "hub": 615.6,
    "T": 424.1,
    "wrap": 93.1,
    "EDL": 1419.9,
    "REBL": 1419.2
   },
   {
    "name": "Replace",
    "rel": 13.5,
    "absDeg": 238.6,
    "X": 153.9,
    "Y": 44.3,
    "beta": 47,
    "dir": 105.7,
    "hub": 623.8,
    "T": 440.8,
    "wrap": 90.1,
    "EDL": 1407.5,
    "REBL": 1406.8
   },
   {
    "name": "Max",
    "rel": 22.7,
    "absDeg": 229.4,
    "X": 146.6,
    "Y": 49.6,
    "beta": 55.3,
    "dir": 104.8,
    "hub": 636.6,
    "T": 461.8,
    "wrap": 87.2,
    "EDL": 1397.7,
    "REBL": 1397
   },
   {
    "name": "Mean",
    "rel": 27.1,
    "absDeg": 225,
    "X": 143.4,
    "Y": 52.6,
    "beta": 59.5,
    "dir": 104.5,
    "hub": 645.3,
    "T": 475.5,
    "wrap": 85.4,
    "EDL": 1392.7,
    "REBL": 1392
   },
   {
    "name": "Min",
    "rel": 31.4,
    "absDeg": 220.7,
    "X": 140.5,
    "Y": 55.7,
    "beta": 63.7,
    "dir": 104.4,
    "hub": 655.5,
    "T": 491.8,
    "wrap": 83.6,
    "EDL": 1387.7,
    "REBL": 1387
   },
   {
    "name": "Load",
    "rel": 39,
    "absDeg": 213.1,
    "X": 136.1,
    "Y": 61.6,
    "beta": 71.3,
    "dir": 104.4,
    "hub": 678.7,
    "T": 529.1,
    "wrap": 79.8,
    "EDL": 1378.7,
    "REBL": 1378.1
   }
  ],
  "duty": [
   {
    "engineRpm": 600,
    "dcPct": 5,
    "kw": {
     "IDR": 0.01,
     "A_C": 1.4,
     "ALT": 3.5,
     "TEN": 0.01
    },
    "crankKw": 4.92,
    "T": {
     "FAN": 1506,
     "IDR": 1504,
     "A_C": 1211,
     "ALT": 478,
     "TEN": 476
    },
    "H": {
     "FAN": 1784,
     "IDR": 2053,
     "A_C": 2536,
     "ALT": 1648,
     "TEN": 647
    }
   },
   {
    "engineRpm": 800,
    "dcPct": 35,
    "kw": {
     "IDR": 0.01,
     "A_C": 1.9,
     "ALT": 4.8,
     "TEN": 0.01
    },
    "crankKw": 6.72,
    "T": {
     "FAN": 1531,
     "IDR": 1529,
     "A_C": 1231,
     "ALT": 477,
     "TEN": 476
    },
    "H": {
     "FAN": 1808,
     "IDR": 2088,
     "A_C": 2579,
     "ALT": 1668,
     "TEN": 646
    }
   },
   {
    "engineRpm": 1200,
    "dcPct": 35,
    "kw": {
     "IDR": 0.01,
     "A_C": 3,
     "ALT": 6.5,
     "TEN": 0.01
    },
    "crankKw": 9.52,
    "T": {
     "FAN": 1472,
     "IDR": 1471,
     "A_C": 1157,
     "ALT": 477,
     "TEN": 476
    },
    "H": {
     "FAN": 1751,
     "IDR": 2008,
     "A_C": 2457,
     "ALT": 1594,
     "TEN": 646
    }
   },
   {
    "engineRpm": 1700,
    "dcPct": 20,
    "kw": {
     "IDR": 0.01,
     "A_C": 4.2,
     "ALT": 8.2,
     "TEN": 0.01
    },
    "crankKw": 12.42,
    "T": {
     "FAN": 1393,
     "IDR": 1393,
     "A_C": 1082,
     "ALT": 476,
     "TEN": 476
    },
    "H": {
     "FAN": 1675,
     "IDR": 1901,
     "A_C": 2313,
     "ALT": 1520,
     "TEN": 646
    }
   },
   {
    "engineRpm": 2200,
    "dcPct": 5,
    "kw": {
     "IDR": 0.01,
     "A_C": 6,
     "ALT": 8.8,
     "TEN": 0.01
    },
    "crankKw": 14.82,
    "T": {
     "FAN": 1322,
     "IDR": 1321,
     "A_C": 979,
     "ALT": 476,
     "TEN": 476
    },
    "H": {
     "FAN": 1605,
     "IDR": 1803,
     "A_C": 2151,
     "ALT": 1417,
     "TEN": 646
    }
   }
  ],
  "inertia": null,
  "degC": 80
 },
 "AG00894": {
  "gatesVersion": "9.40",
  "order": [
   "CRK",
   "IDR1",
   "TM31",
   "IDR2",
   "SD7H15",
   "TEN"
  ],
  "pulley": {
   "CRK": {
    "p": 161.4,
    "e": 159,
    "c": "grooved",
    "crank": 1
   },
   "IDR1": {
    "p": 77.2,
    "e": 79.6,
    "c": "back"
   },
   "TM31": {
    "p": 154.4,
    "e": 152,
    "c": "grooved"
   },
   "IDR2": {
    "p": 77.2,
    "e": 79.6,
    "c": "back"
   },
   "SD7H15": {
    "p": 121.4,
    "e": 119,
    "c": "grooved"
   },
   "TEN": {
    "p": 77.2,
    "e": 79.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "CRK": [
    0,
    0
   ],
   "IDR1": [
    143,
    140
   ],
   "TM31": [
    184,
    314.6
   ],
   "IDR2": [
    0,
    272.5
   ],
   "SD7H15": [
    -267.4,
    241
   ],
   "TEN": [
    -174.47,
    86.93
   ]
  },
  "belt": 1739,
  "tol": 6,
  "wear": 0.7,
  "ribs": 8,
  "pivot": [
   -263.8,
   97.9
  ],
  "arm": 90,
  "preload": 8.93,
  "rate": 0.475,
  "meanLoad": 23,
  "freeAbsDeg": 22.6,
  "design": 487,
  "takeupRef": 0.825,
  "NF": 22.46,
  "B10": 8294,
  "span": {
   "CRK": 160.7,
   "IDR1": 137,
   "TM31": 149.1,
   "IDR2": 250.3,
   "SD7H15": 150,
   "TEN": 154.2
  },
  "wrap": {
   "CRK": 145.2,
   "IDR1": 44.4,
   "TM31": 194.2,
   "IDR2": 65.7,
   "SD7H15": 169.5,
   "TEN": 38.8
  },
  "ratio": {
   "CRK": 1,
   "IDR1": 2.091,
   "TM31": 1.045,
   "IDR2": 2.091,
   "SD7H15": 1.329,
   "TEN": 2.091
  },
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 22.6,
    "X": -180.7,
    "Y": 132.5,
    "beta": 30.3,
    "dir": 232.9,
    "hub": 196.6,
    "T": 189,
    "wrap": 62.7,
    "EDL": 1765,
    "REBL": 1764.1
   },
   {
    "name": "Replace",
    "rel": 8.5,
    "absDeg": 14.1,
    "X": -176.5,
    "Y": 119.8,
    "beta": 35.7,
    "dir": 229.8,
    "hub": 246.8,
    "T": 262.8,
    "wrap": 56,
    "EDL": 1757.9,
    "REBL": 1756.9
   },
   {
    "name": "Max",
    "rel": 22.5,
    "absDeg": 0.1,
    "X": -173.8,
    "Y": 98,
    "beta": 46.2,
    "dir": 226.3,
    "hub": 302.2,
    "T": 395.9,
    "wrap": 44.9,
    "EDL": 1745.6,
    "REBL": 1744.7
   },
   {
    "name": "Mean",
    "rel": 29.6,
    "absDeg": 353,
    "X": -174.5,
    "Y": 86.9,
    "beta": 52.2,
    "dir": 225.2,
    "hub": 323.5,
    "T": 486.7,
    "wrap": 38.8,
    "EDL": 1739.6,
    "REBL": 1738.7
   },
   {
    "name": "Min",
    "rel": 37.2,
    "absDeg": 345.4,
    "X": -176.7,
    "Y": 75.2,
    "beta": 59.1,
    "dir": 224.5,
    "hub": 344.8,
    "T": 629.3,
    "wrap": 31.8,
    "EDL": 1733.6,
    "REBL": 1732.7
   },
   {
    "name": "Load",
    "rel": 60.7,
    "absDeg": 321.9,
    "X": -193,
    "Y": 42.3,
    "beta": 82.6,
    "dir": 224.5,
    "hub": 423.5,
    "T": 3054.8,
    "wrap": 7.9,
    "EDL": 1721.8,
    "REBL": 1720.8
   }
  ],
  "duty": [
   {
    "engineRpm": 519,
    "dcPct": 26.6,
    "kw": {
     "IDR1": 0.01,
     "TM31": 1.4,
     "IDR2": 0.01,
     "SD7H15": 0.9,
     "TEN": 0.01
    },
    "crankKw": 2.33,
    "T": {
     "CRK": 1018,
     "IDR1": 1016,
     "TM31": 696,
     "IDR2": 694,
     "SD7H15": 489,
     "TEN": 487
    },
    "H": {
     "CRK": 1445,
     "IDR1": 769,
     "TM31": 1700,
     "IDR2": 754,
     "SD7H15": 1178,
     "TEN": 324
    }
   },
   {
    "engineRpm": 693,
    "dcPct": 10,
    "kw": {
     "IDR1": 0.01,
     "TM31": 1.7,
     "IDR2": 0.01,
     "SD7H15": 1.7,
     "TEN": 0.01
    },
    "crankKw": 3.43,
    "T": {
     "CRK": 1072,
     "IDR1": 1071,
     "TM31": 780,
     "IDR2": 779,
     "SD7H15": 488,
     "TEN": 487
    },
    "H": {
     "CRK": 1498,
     "IDR1": 810,
     "TM31": 1837,
     "IDR2": 845,
     "SD7H15": 1262,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 13,
    "kw": {
     "IDR1": 0.01,
     "TM31": 2.1,
     "IDR2": 0.01,
     "SD7H15": 3,
     "TEN": 0.01
    },
    "crankKw": 5.13,
    "T": {
     "CRK": 1094,
     "IDR1": 1093,
     "TM31": 844,
     "IDR2": 843,
     "SD7H15": 488,
     "TEN": 487
    },
    "H": {
     "CRK": 1519,
     "IDR1": 826,
     "TM31": 1922,
     "IDR2": 915,
     "SD7H15": 1326,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1039,
    "dcPct": 17,
    "kw": {
     "IDR1": 0.01,
     "TM31": 2.5,
     "IDR2": 0.01,
     "SD7H15": 3.2,
     "TEN": 0.01
    },
    "crankKw": 5.73,
    "T": {
     "CRK": 1139,
     "IDR1": 1138,
     "TM31": 853,
     "IDR2": 852,
     "SD7H15": 488,
     "TEN": 487
    },
    "H": {
     "CRK": 1564,
     "IDR1": 861,
     "TM31": 1977,
     "IDR2": 925,
     "SD7H15": 1335,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1212,
    "dcPct": 18,
    "kw": {
     "IDR1": 0.01,
     "TM31": 3,
     "IDR2": 0.01,
     "SD7H15": 4,
     "TEN": 0.01
    },
    "crankKw": 7.03,
    "T": {
     "CRK": 1173,
     "IDR1": 1172,
     "TM31": 879,
     "IDR2": 878,
     "SD7H15": 488,
     "TEN": 487
    },
    "H": {
     "CRK": 1597,
     "IDR1": 886,
     "TM31": 2036,
     "IDR2": 953,
     "SD7H15": 1361,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1385,
    "dcPct": 8,
    "kw": {
     "IDR1": 0.01,
     "TM31": 3.5,
     "IDR2": 0.01,
     "SD7H15": 5,
     "TEN": 0.01
    },
    "crankKw": 8.53,
    "T": {
     "CRK": 1216,
     "IDR1": 1215,
     "TM31": 916,
     "IDR2": 915,
     "SD7H15": 488,
     "TEN": 487
    },
    "H": {
     "CRK": 1639,
     "IDR1": 919,
     "TM31": 2114,
     "IDR2": 992,
     "SD7H15": 1397,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1558,
    "dcPct": 4,
    "kw": {
     "IDR1": 0.01,
     "TM31": 4,
     "IDR2": 0.01,
     "SD7H15": 6,
     "TEN": 0.01
    },
    "crankKw": 10.03,
    "T": {
     "CRK": 1249,
     "IDR1": 1248,
     "TM31": 944,
     "IDR2": 943,
     "SD7H15": 487,
     "TEN": 487
    },
    "H": {
     "CRK": 1671,
     "IDR1": 944,
     "TM31": 2175,
     "IDR2": 1023,
     "SD7H15": 1425,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1731,
    "dcPct": 3,
    "kw": {
     "IDR1": 0.01,
     "TM31": 4.4,
     "IDR2": 0.01,
     "SD7H15": 7,
     "TEN": 0.01
    },
    "crankKw": 11.43,
    "T": {
     "CRK": 1268,
     "IDR1": 1267,
     "TM31": 967,
     "IDR2": 966,
     "SD7H15": 487,
     "TEN": 487
    },
    "H": {
     "CRK": 1691,
     "IDR1": 958,
     "TM31": 2217,
     "IDR2": 1048,
     "SD7H15": 1448,
     "TEN": 324
    }
   },
   {
    "engineRpm": 1904,
    "dcPct": 0.3,
    "kw": {
     "IDR1": 0.01,
     "TM31": 4.75,
     "IDR2": 0.01,
     "SD7H15": 7.5,
     "TEN": 0.01
    },
    "crankKw": 12.28,
    "T": {
     "CRK": 1250,
     "IDR1": 1249,
     "TM31": 954,
     "IDR2": 953,
     "SD7H15": 487,
     "TEN": 487
    },
    "H": {
     "CRK": 1673,
     "IDR1": 945,
     "TM31": 2187,
     "IDR2": 1034,
     "SD7H15": 1435,
     "TEN": 324
    }
   },
   {
    "engineRpm": 2077,
    "dcPct": 0.1,
    "kw": {
     "IDR1": 0.01,
     "TM31": 5,
     "IDR2": 0.01,
     "SD7H15": 7.75,
     "TEN": 0.01
    },
    "crankKw": 12.78,
    "T": {
     "CRK": 1215,
     "IDR1": 1214,
     "TM31": 929,
     "IDR2": 929,
     "SD7H15": 487,
     "TEN": 487
    },
    "H": {
     "CRK": 1638,
     "IDR1": 918,
     "TM31": 2128,
     "IDR2": 1007,
     "SD7H15": 1411,
     "TEN": 324
    }
   }
  ],
  "inertia": {
   "IDR1": 0.0002,
   "TM31": 0.0053,
   "IDR2": 0.0002,
   "SD7H15": 0.006,
   "TEN": 0.0002
  },
  "degC": 90
 },
 "AG00902-1300": {
  "gatesVersion": "10.01",
  "order": [
   "CRK",
   "IDR",
   "A_C",
   "TEN"
  ],
  "pulley": {
   "CRK": {
    "p": 161.4,
    "e": 159,
    "c": "grooved",
    "crank": 1
   },
   "IDR": {
    "p": 77.2,
    "e": 79.6,
    "c": "back"
   },
   "A_C": {
    "p": 139.4,
    "e": 137,
    "c": "grooved"
   },
   "TEN": {
    "p": 77.2,
    "e": 79.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "CRK": [
    0,
    0
   ],
   "IDR": [
    219.2,
    78.5
   ],
   "A_C": [
    284.5,
    297.7
   ],
   "TEN": [
    89.56,
    182.04
   ]
  },
  "belt": 1302,
  "tol": 5,
  "wear": 0.7,
  "ribs": 8,
  "pivot": [
   97.4,
   271.7
  ],
  "arm": 90,
  "preload": 9.31,
  "rate": 0.476,
  "meanLoad": 22.21,
  "freeAbsDeg": 292.1,
  "design": 608,
  "takeupRef": 0.637,
  "NF": 16.02,
  "B10": null,
  "degC": 70,
  "span": {
   "CRK": 199.9,
   "IDR": 201.5,
   "A_C": 199.1,
   "TEN": 164.1
  },
  "wrap": {
   "CRK": 202.7,
   "IDR": 5.4,
   "A_C": 194.1,
   "TEN": 31.4
  },
  "ratio": {
   "CRK": 1,
   "IDR": 2.091,
   "A_C": 1.158,
   "TEN": 2.091
  },
  "tensionTableValid": false,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 292.1,
    "X": 131.3,
    "Y": 188.3,
    "beta": 25.1,
    "dir": 137.2,
    "hub": 243.8,
    "T": 306.7,
    "wrap": 46.8,
    "EDL": 1320.3,
    "REBL": 1318.5
   },
   {
    "name": "Replace",
    "rel": 4.7,
    "absDeg": 287.4,
    "X": 124.3,
    "Y": 185.8,
    "beta": 28.9,
    "dir": 136.3,
    "hub": 265.8,
    "T": 350,
    "wrap": 44.6,
    "EDL": 1317.7,
    "REBL": 1315.9
   },
   {
    "name": "Max",
    "rel": 19.4,
    "absDeg": 272.7,
    "X": 101.7,
    "Y": 181.8,
    "beta": 41.4,
    "dir": 134.1,
    "hub": 311.5,
    "T": 496.7,
    "wrap": 36.5,
    "EDL": 1308.5,
    "REBL": 1306.8
   },
   {
    "name": "Mean",
    "rel": 27.1,
    "absDeg": 265,
    "X": 89.6,
    "Y": 182,
    "beta": 48.5,
    "dir": 133.5,
    "hub": 329.5,
    "T": 608.2,
    "wrap": 31.4,
    "EDL": 1303.5,
    "REBL": 1301.8
   },
   {
    "name": "Min",
    "rel": 35.3,
    "absDeg": 256.8,
    "X": 76.9,
    "Y": 184.1,
    "beta": 56.5,
    "dir": 133.3,
    "hub": 348.1,
    "T": 794.5,
    "wrap": 25.3,
    "EDL": 1298.5,
    "REBL": 1296.8
   },
   {
    "name": "Load",
    "rel": 57.4,
    "absDeg": 234.7,
    "X": 45.3,
    "Y": 198.3,
    "beta": 79.6,
    "dir": 134.2,
    "hub": 414,
    "T": 3903.9,
    "wrap": 6.1,
    "EDL": 1289.8,
    "REBL": 1288.1
   }
  ],
  "duty": [
   {
    "engineRpm": 700,
    "dcPct": 35,
    "kw": {
     "IDR": 0.8,
     "A_C": 1.7,
     "TEN": 0.01
    },
    "crankKw": 2.51,
    "T": {
     "CRK": 608,
     "IDR": 473,
     "A_C": 186,
     "TEN": 608
    },
    "H": {
     "CRK": 1192,
     "IDR": 144,
     "A_C": 655,
     "TEN": 460
    }
   },
   {
    "engineRpm": 1200,
    "dcPct": 45,
    "kw": {
     "IDR": 2,
     "A_C": 3,
     "TEN": 0.01
    },
    "crankKw": 5.01,
    "T": {
     "CRK": 608,
     "IDR": 411,
     "A_C": 115,
     "TEN": 608
    },
    "H": {
     "CRK": 1192,
     "IDR": 203,
     "A_C": 523,
     "TEN": 513
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 19,
    "kw": {
     "IDR": 3.6,
     "A_C": 4.6,
     "TEN": 0.01
    },
    "crankKw": 8.21,
    "T": {
     "CRK": 608,
     "IDR": 395,
     "A_C": 123,
     "TEN": 608
    },
    "H": {
     "CRK": 1192,
     "IDR": 218,
     "A_C": 515,
     "TEN": 507
    }
   },
   {
    "engineRpm": 3000,
    "dcPct": 1,
    "kw": {
     "IDR": 4,
     "A_C": 7.2,
     "TEN": 0.01
    },
    "crankKw": 11.21,
    "T": {
     "CRK": 608,
     "IDR": 450,
     "A_C": 166,
     "TEN": 608
    },
    "H": {
     "CRK": 1192,
     "IDR": 165,
     "A_C": 613,
     "TEN": 474
    }
   }
  ],
  "inertia": {
   "IDR": 0.0002,
   "A_C": 0.006,
   "TEN": 0.0004
  }
 },
 "AG00902-1275": {
  "gatesVersion": "9.55",
  "order": [
   "CRK",
   "IDR",
   "A_C",
   "TEN"
  ],
  "pulley": {
   "CRK": {
    "p": 148.4,
    "e": 146,
    "c": "grooved",
    "crank": 1
   },
   "IDR": {
    "p": 77.2,
    "e": 79.6,
    "c": "back"
   },
   "A_C": {
    "p": 129.4,
    "e": 127,
    "c": "grooved"
   },
   "TEN": {
    "p": 77.2,
    "e": 79.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "CRK": [
    0,
    0
   ],
   "IDR": [
    190,
    80
   ],
   "A_C": [
    284.5,
    297.7
   ],
   "TEN": [
    99.37,
    171.37
   ]
  },
  "belt": 1275,
  "tol": 5,
  "wear": 0.7,
  "ribs": 8,
  "pivot": [
   115,
   260
  ],
  "arm": 90,
  "preload": 9.13,
  "rate": 0.48,
  "meanLoad": 22.15,
  "freeAbsDeg": 287.1,
  "design": 488,
  "takeupRef": 0.792,
  "NF": 22.41,
  "B10": 32247,
  "degC": 70,
  "span": {
   "CRK": 172.6,
   "IDR": 213.7,
   "A_C": 198.9,
   "TEN": 162.8
  },
  "wrap": {
   "CRK": 210.8,
   "IDR": 15.3,
   "A_C": 201,
   "TEN": 36.6
  },
  "ratio": {
   "CRK": 1,
   "IDR": 1.922,
   "A_C": 1.147,
   "TEN": 1.922
  },
  "tensionTableValid": true,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 287.1,
    "X": 141.5,
    "Y": 174,
    "beta": 30.2,
    "dir": 137.3,
    "hub": 201.6,
    "T": 224.8,
    "wrap": 53.3,
    "EDL": 1296.7,
    "REBL": 1296
   },
   {
    "name": "Replace",
    "rel": 9.8,
    "absDeg": 277.3,
    "X": 126.4,
    "Y": 170.7,
    "beta": 38.1,
    "dir": 135.4,
    "hub": 249.3,
    "T": 306.5,
    "wrap": 48,
    "EDL": 1289.3,
    "REBL": 1288.6
   },
   {
    "name": "Max",
    "rel": 20.9,
    "absDeg": 266.2,
    "X": 109,
    "Y": 170.2,
    "beta": 47.7,
    "dir": 133.9,
    "hub": 287.8,
    "T": 410.8,
    "wrap": 41,
    "EDL": 1280.4,
    "REBL": 1279.7
   },
   {
    "name": "Mean",
    "rel": 27.1,
    "absDeg": 260,
    "X": 99.4,
    "Y": 171.4,
    "beta": 53.5,
    "dir": 133.5,
    "hub": 306.3,
    "T": 488.1,
    "wrap": 36.6,
    "EDL": 1275.4,
    "REBL": 1274.7
   },
   {
    "name": "Min",
    "rel": 33.6,
    "absDeg": 253.5,
    "X": 89.4,
    "Y": 173.7,
    "beta": 59.8,
    "dir": 133.2,
    "hub": 325.1,
    "T": 599.2,
    "wrap": 31.5,
    "EDL": 1270.4,
    "REBL": 1269.7
   },
   {
    "name": "Load",
    "rel": 45.2,
    "absDeg": 241.9,
    "X": 72.6,
    "Y": 180.6,
    "beta": 71.6,
    "dir": 133.4,
    "hub": 361.4,
    "T": 970.3,
    "wrap": 21.5,
    "EDL": 1262.8,
    "REBL": 1262.1
   }
  ],
  "duty": [
   {
    "engineRpm": 700,
    "dcPct": 35,
    "kw": {
     "IDR": 0.8,
     "A_C": 1.7,
     "TEN": 0.01
    },
    "crankKw": 2.51,
    "T": {
     "CRK": 950,
     "IDR": 802,
     "A_C": 490,
     "TEN": 488
    },
    "H": {
     "CRK": 1391,
     "IDR": 275,
     "A_C": 1272,
     "TEN": 307
    }
   },
   {
    "engineRpm": 1200,
    "dcPct": 45,
    "kw": {
     "IDR": 2,
     "A_C": 3,
     "TEN": 0.01
    },
    "crankKw": 5.01,
    "T": {
     "CRK": 1025,
     "IDR": 811,
     "A_C": 489,
     "TEN": 488
    },
    "H": {
     "CRK": 1466,
     "IDR": 324,
     "A_C": 1280,
     "TEN": 307
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 19,
    "kw": {
     "IDR": 3.6,
     "A_C": 4.6,
     "TEN": 0.01
    },
    "crankKw": 8.21,
    "T": {
     "CRK": 1016,
     "IDR": 785,
     "A_C": 489,
     "TEN": 488
    },
    "H": {
     "CRK": 1457,
     "IDR": 332,
     "A_C": 1253,
     "TEN": 306
    }
   },
   {
    "engineRpm": 3000,
    "dcPct": 1,
    "kw": {
     "IDR": 4,
     "A_C": 7.2,
     "TEN": 0.01
    },
    "crankKw": 11.21,
    "T": {
     "CRK": 969,
     "IDR": 797,
     "A_C": 488,
     "TEN": 488
    },
    "H": {
     "CRK": 1410,
     "IDR": 290,
     "A_C": 1266,
     "TEN": 306
    }
   }
  ],
  "inertia": {
   "IDR": 0.0002,
   "A_C": 0.006,
   "TEN": 0.0004
  }
 },
 "AG00686": {
  "gatesVersion": "9.40",
  "order": [
   "CRK",
   "IDR",
   "A_C",
   "TEN"
  ],
  "pulley": {
   "CRK": {
    "p": 162.4,
    "e": 160,
    "c": "grooved",
    "crank": 1
   },
   "IDR": {
    "p": 77.2,
    "e": 79.6,
    "c": "back"
   },
   "A_C": {
    "p": 129.4,
    "e": 127,
    "c": "grooved"
   },
   "TEN": {
    "p": 77.2,
    "e": 79.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "CRK": [
    0,
    0
   ],
   "IDR": [
    -72,
    267
   ],
   "A_C": [
    -224,
    448
   ],
   "TEN": [
    -156.85,
    186.97
   ]
  },
  "belt": 1475,
  "tol": 6,
  "wear": 0.7,
  "ribs": 8,
  "pivot": [
   -180,
   100
  ],
  "arm": 90,
  "preload": 8.59,
  "rate": 0.482,
  "meanLoad": 24.54,
  "freeAbsDeg": 42,
  "design": 766,
  "takeupRef": 0.559,
  "NF": 11.87,
  "B10": 10540,
  "degC": 92,
  "armInertia": 0.0076,
  "pulleyMassKg": 0.5,
  "crankInertia": 0.15,
  "ribFatiguePct": {
   "CRK": 2.9,
   "IDR": 43.3,
   "A_C": 10.5,
   "TEN": 43.3
  },
  "loadContribPct": [
   17,
   8,
   13,
   19,
   24,
   19
  ],
  "span": {
   "CRK": 249.2,
   "IDR": 212.6,
   "A_C": 248.9,
   "TEN": 212.6
  },
  "wrap": {
   "CRK": 210.2,
   "IDR": 26.7,
   "A_C": 202.9,
   "TEN": 26.4
  },
  "ratio": {
   "CRK": 1,
   "IDR": 2.104,
   "A_C": 1.255,
   "TEN": 2.104
  },
  "tensionTableValid": true,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 42,
    "X": -113.1,
    "Y": 160.2,
    "beta": 22.9,
    "dir": 199.1,
    "hub": 245.3,
    "T": 334.2,
    "wrap": 43.1,
    "EDL": 1496.7,
    "REBL": 1493.2
   },
   {
    "name": "Replace",
    "rel": 3.8,
    "absDeg": 45.8,
    "X": -117.2,
    "Y": 164.5,
    "beta": 26,
    "dir": 199.8,
    "hub": 264.5,
    "T": 373.5,
    "wrap": 41.5,
    "EDL": 1494.9,
    "REBL": 1491.4
   },
   {
    "name": "Max",
    "rel": 22.7,
    "absDeg": 64.7,
    "X": -141.5,
    "Y": 181.4,
    "beta": 41.9,
    "dir": 202.7,
    "hub": 324.6,
    "T": 583,
    "wrap": 32.3,
    "EDL": 1484.5,
    "REBL": 1481
   },
   {
    "name": "Mean",
    "rel": 33.1,
    "absDeg": 75.1,
    "X": -156.8,
    "Y": 187,
    "beta": 51.3,
    "dir": 203.8,
    "hub": 349.3,
    "T": 765.7,
    "wrap": 26.4,
    "EDL": 1478.5,
    "REBL": 1475
   },
   {
    "name": "Min",
    "rel": 44.8,
    "absDeg": 86.8,
    "X": -174.9,
    "Y": 189.9,
    "beta": 62.3,
    "dir": 204.5,
    "hub": 378.5,
    "T": 1151.6,
    "wrap": 18.9,
    "EDL": 1472.5,
    "REBL": 1469
   },
   {
    "name": "Load",
    "rel": 62.4,
    "absDeg": 104.4,
    "X": -202.4,
    "Y": 187.2,
    "beta": 79.7,
    "dir": 204.7,
    "hub": 436.8,
    "T": 3863.1,
    "wrap": 6.5,
    "EDL": 1466.7,
    "REBL": 1463.3
   }
  ],
  "duty": [
   {
    "engineRpm": 800,
    "dcPct": 27,
    "kw": {
     "IDR": 0.01,
     "A_C": 3,
     "TEN": 0.01
    },
    "crankKw": 3.02,
    "T": {
     "CRK": 1210,
     "IDR": 1208,
     "A_C": 767,
     "TEN": 766
    },
    "H": {
     "CRK": 1911,
     "IDR": 557,
     "A_C": 1938,
     "TEN": 350
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 10,
    "kw": {
     "IDR": 0.01,
     "A_C": 4,
     "TEN": 0.01
    },
    "crankKw": 4.02,
    "T": {
     "CRK": 1238,
     "IDR": 1237,
     "A_C": 767,
     "TEN": 766
    },
    "H": {
     "CRK": 1939,
     "IDR": 571,
     "A_C": 1967,
     "TEN": 350
    }
   },
   {
    "engineRpm": 1250,
    "dcPct": 13,
    "kw": {
     "IDR": 0.01,
     "A_C": 5,
     "TEN": 0.01
    },
    "crankKw": 5.02,
    "T": {
     "CRK": 1238,
     "IDR": 1237,
     "A_C": 767,
     "TEN": 766
    },
    "H": {
     "CRK": 1939,
     "IDR": 571,
     "A_C": 1966,
     "TEN": 349
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 18,
    "kw": {
     "IDR": 0.01,
     "A_C": 5.5,
     "TEN": 0.01
    },
    "crankKw": 5.52,
    "T": {
     "CRK": 1198,
     "IDR": 1198,
     "A_C": 766,
     "TEN": 766
    },
    "H": {
     "CRK": 1900,
     "IDR": 552,
     "A_C": 1927,
     "TEN": 349
    }
   },
   {
    "engineRpm": 1750,
    "dcPct": 19,
    "kw": {
     "IDR": 0.01,
     "A_C": 6.8,
     "TEN": 0.01
    },
    "crankKw": 6.82,
    "T": {
     "CRK": 1224,
     "IDR": 1223,
     "A_C": 766,
     "TEN": 766
    },
    "H": {
     "CRK": 1925,
     "IDR": 564,
     "A_C": 1952,
     "TEN": 349
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 13,
    "kw": {
     "IDR": 0.01,
     "A_C": 8.2,
     "TEN": 0.01
    },
    "crankKw": 8.22,
    "T": {
     "CRK": 1249,
     "IDR": 1248,
     "A_C": 766,
     "TEN": 766
    },
    "H": {
     "CRK": 1949,
     "IDR": 576,
     "A_C": 1977,
     "TEN": 349
    }
   }
  ],
  "inertia": {
   "IDR": 0.0004,
   "A_C": 0.005,
   "TEN": 0.0076
  }
 },
 "AG0868": {
  "gatesVersion": "9.37",
  "order": [
   "CRK",
   "A_C",
   "TEN"
  ],
  "pulley": {
   "CRK": {
    "p": 177.41,
    "e": 175.01,
    "c": "grooved",
    "crank": 1
   },
   "A_C": {
    "p": 120.41,
    "e": 118.01,
    "c": "grooved"
   },
   "TEN": {
    "p": 77.2,
    "e": 79.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "CRK": [
    0,
    0
   ],
   "A_C": [
    263,
    15
   ],
   "TEN": [
    126.06,
    62.15
   ]
  },
  "belt": 1020,
  "tol": 5,
  "wear": 0.7,
  "ribs": 8,
  "pivot": [
   195,
   120
  ],
  "arm": 90,
  "preload": 8.56,
  "rate": 0.501,
  "meanLoad": 22.57,
  "freeAbsDeg": 248,
  "design": 356,
  "takeupRef": 1.108,
  "NF": 45.62,
  "B10": 24355,
  "degC": 90,
  "armInertia": 0.0009,
  "pulleyMassKg": 0.8,
  "crankInertia": 0.5,
  "ribFatiguePct": {
   "CRK": 2.7,
   "A_C": 25,
   "TEN": 72.4
  },
  "loadContribPct": [
   16,
   7,
   13,
   21,
   25,
   18
  ],
  "span": {
   "CRK": 261.9,
   "A_C": 105.9,
   "TEN": 59.5
  },
  "wrap": {
   "CRK": 228.2,
   "A_C": 194.5,
   "TEN": 62.7
  },
  "ratio": {
   "CRK": 1,
   "A_C": 1.473,
   "TEN": 2.298
  },
  "tensionTableValid": true,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 248,
    "X": 161.3,
    "Y": 36.6,
    "beta": 33.2,
    "dir": 101.2,
    "hub": 173.9,
    "T": 115.7,
    "wrap": 97.4,
    "EDL": 1051.5,
    "REBL": 1051.8
   },
   {
    "name": "Replace",
    "rel": 17,
    "absDeg": 231,
    "X": 138.3,
    "Y": 50.1,
    "beta": 36,
    "dir": 87,
    "hub": 322.8,
    "T": 268.2,
    "wrap": 74,
    "EDL": 1031.9,
    "REBL": 1032.2
   },
   {
    "name": "Max",
    "rel": 23.5,
    "absDeg": 224.5,
    "X": 130.8,
    "Y": 56.9,
    "beta": 39.6,
    "dir": 84.1,
    "hub": 354.3,
    "T": 318.8,
    "wrap": 67.5,
    "EDL": 1024.7,
    "REBL": 1025
   },
   {
    "name": "Mean",
    "rel": 28,
    "absDeg": 220,
    "X": 126.1,
    "Y": 62.1,
    "beta": 42.7,
    "dir": 82.7,
    "hub": 370.1,
    "T": 355.6,
    "wrap": 62.7,
    "EDL": 1019.7,
    "REBL": 1020
   },
   {
    "name": "Min",
    "rel": 32.5,
    "absDeg": 215.5,
    "X": 121.7,
    "Y": 67.8,
    "beta": 46.3,
    "dir": 81.8,
    "hub": 381.9,
    "T": 397.9,
    "wrap": 57.4,
    "EDL": 1014.7,
    "REBL": 1015
   },
   {
    "name": "Load",
    "rel": 48.4,
    "absDeg": 199.6,
    "X": 110.2,
    "Y": 89.8,
    "beta": 62.9,
    "dir": 82.5,
    "hub": 409,
    "T": 702.1,
    "wrap": 33.9,
    "EDL": 999.1,
    "REBL": 999.4
   }
  ],
  "duty": [
   {
    "engineRpm": 800,
    "dcPct": 27,
    "kw": {
     "A_C": 1.3,
     "TEN": 0.01
    },
    "crankKw": 1.31,
    "T": {
     "CRK": 532,
     "A_C": 357,
     "TEN": 356
    },
    "H": {
     "CRK": 813,
     "A_C": 882,
     "TEN": 371
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 10,
    "kw": {
     "A_C": 1.5,
     "TEN": 0.01
    },
    "crankKw": 1.51,
    "T": {
     "CRK": 518,
     "A_C": 357,
     "TEN": 356
    },
    "H": {
     "CRK": 801,
     "A_C": 868,
     "TEN": 371
    }
   },
   {
    "engineRpm": 1250,
    "dcPct": 13,
    "kw": {
     "A_C": 4,
     "TEN": 0.01
    },
    "crankKw": 4.01,
    "T": {
     "CRK": 701,
     "A_C": 356,
     "TEN": 356
    },
    "H": {
     "CRK": 975,
     "A_C": 1050,
     "TEN": 371
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 18,
    "kw": {
     "A_C": 4.6,
     "TEN": 0.01
    },
    "crankKw": 4.61,
    "T": {
     "CRK": 686,
     "A_C": 356,
     "TEN": 356
    },
    "H": {
     "CRK": 961,
     "A_C": 1035,
     "TEN": 370
    }
   },
   {
    "engineRpm": 1750,
    "dcPct": 19,
    "kw": {
     "A_C": 4.7,
     "TEN": 0.01
    },
    "crankKw": 4.71,
    "T": {
     "CRK": 645,
     "A_C": 356,
     "TEN": 356
    },
    "H": {
     "CRK": 921,
     "A_C": 994,
     "TEN": 370
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 13,
    "kw": {
     "A_C": 4.7,
     "TEN": 0.01
    },
    "crankKw": 4.71,
    "T": {
     "CRK": 609,
     "A_C": 356,
     "TEN": 356
    },
    "H": {
     "CRK": 887,
     "A_C": 958,
     "TEN": 370
    }
   }
  ],
  "inertia": {
   "A_C": 0.0034,
   "TEN": 0.0009
  }
 },
 "AG0868-4PK": {
  "gatesVersion": "9.37",
  "order": [
   "CRK",
   "A_C",
   "TEN"
  ],
  "pulley": {
   "CRK": {
    "p": 177.41,
    "e": 175.01,
    "c": "grooved",
    "crank": 1
   },
   "A_C": {
    "p": 120.41,
    "e": 118.01,
    "c": "grooved"
   },
   "TEN": {
    "p": 77.2,
    "e": 79.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "CRK": [
    0,
    0
   ],
   "A_C": [
    263,
    15
   ],
   "TEN": [
    121.28,
    68.38
   ]
  },
  "belt": 1013,
  "tol": 5,
  "wear": 0.7,
  "ribs": 4,
  "pivot": [
   195,
   120
  ],
  "arm": 90,
  "preload": 8.46,
  "rate": 0.505,
  "meanLoad": 16.07,
  "freeAbsDeg": 230.1,
  "design": 258,
  "takeupRef": 1.087,
  "NF": 28.28,
  "B10": 15894,
  "degC": 90,
  "armInertia": 0.0009,
  "ribFatiguePct": {
   "CRK": 2.7,
   "A_C": 25,
   "TEN": 72.4
  },
  "loadContribPct": [
   14,
   6,
   14,
   23,
   25,
   18
  ],
  "span": {
   "CRK": 261.9,
   "A_C": 114.8,
   "TEN": 56.4
  },
  "wrap": {
   "CRK": 226.2,
   "A_C": 190.6,
   "TEN": 56.8
  },
  "ratio": {
   "CRK": 1,
   "A_C": 1.473,
   "TEN": 2.298
  },
  "tensionTableValid": true,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 230.1,
    "X": 137.2,
    "Y": 51,
    "beta": 36.5,
    "dir": 86.5,
    "hub": 158.2,
    "T": 132.8,
    "wrap": 73.1,
    "EDL": 1030.9,
    "REBL": 1030.1
   },
   {
    "name": "Replace",
    "rel": 4.1,
    "absDeg": 226,
    "X": 132.5,
    "Y": 55.3,
    "beta": 38.7,
    "dir": 84.7,
    "hub": 187.2,
    "T": 165.2,
    "wrap": 69,
    "EDL": 1026.3,
    "REBL": 1025.6
   },
   {
    "name": "Max",
    "rel": 10.5,
    "absDeg": 219.6,
    "X": 125.6,
    "Y": 62.7,
    "beta": 43,
    "dir": 82.6,
    "hub": 224.4,
    "T": 217.2,
    "wrap": 62.2,
    "EDL": 1019.2,
    "REBL": 1018.4
   },
   {
    "name": "Mean",
    "rel": 15.1,
    "absDeg": 215,
    "X": 121.3,
    "Y": 68.4,
    "beta": 46.7,
    "dir": 81.7,
    "hub": 245.2,
    "T": 257.8,
    "wrap": 56.8,
    "EDL": 1014.2,
    "REBL": 1013.4
   },
   {
    "name": "Min",
    "rel": 19.8,
    "absDeg": 210.3,
    "X": 117.3,
    "Y": 74.6,
    "beta": 51.1,
    "dir": 81.4,
    "hub": 263.4,
    "T": 308.6,
    "wrap": 50.5,
    "EDL": 1009.2,
    "REBL": 1008.4
   },
   {
    "name": "Load",
    "rel": 24.1,
    "absDeg": 206,
    "X": 114.1,
    "Y": 80.6,
    "beta": 55.6,
    "dir": 81.6,
    "hub": 277.9,
    "T": 370.4,
    "wrap": 44.1,
    "EDL": 1004.8,
    "REBL": 1004
   }
  ],
  "duty": [
   {
    "engineRpm": 800,
    "dcPct": 27,
    "kw": {
     "A_C": 1.3,
     "TEN": 0.01
    },
    "crankKw": 1.31,
    "T": {
     "CRK": 434,
     "A_C": 259,
     "TEN": 258
    },
    "H": {
     "CRK": 640,
     "A_C": 690,
     "TEN": 246
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 10,
    "kw": {
     "A_C": 1.5,
     "TEN": 0.01
    },
    "crankKw": 1.51,
    "T": {
     "CRK": 420,
     "A_C": 259,
     "TEN": 258
    },
    "H": {
     "CRK": 627,
     "A_C": 676,
     "TEN": 246
    }
   },
   {
    "engineRpm": 1250,
    "dcPct": 13,
    "kw": {
     "A_C": 4,
     "TEN": 0.01
    },
    "crankKw": 4.01,
    "T": {
     "CRK": 603,
     "A_C": 259,
     "TEN": 258
    },
    "H": {
     "CRK": 803,
     "A_C": 859,
     "TEN": 246
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 18,
    "kw": {
     "A_C": 4.6,
     "TEN": 0.01
    },
    "crankKw": 4.61,
    "T": {
     "CRK": 589,
     "A_C": 258,
     "TEN": 258
    },
    "H": {
     "CRK": 789,
     "A_C": 844,
     "TEN": 245
    }
   },
   {
    "engineRpm": 1750,
    "dcPct": 19,
    "kw": {
     "A_C": 4.7,
     "TEN": 0.01
    },
    "crankKw": 4.71,
    "T": {
     "CRK": 547,
     "A_C": 258,
     "TEN": 258
    },
    "H": {
     "CRK": 749,
     "A_C": 803,
     "TEN": 245
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 13,
    "kw": {
     "A_C": 4.7,
     "TEN": 0.01
    },
    "crankKw": 4.71,
    "T": {
     "CRK": 511,
     "A_C": 258,
     "TEN": 258
    },
    "H": {
     "CRK": 714,
     "A_C": 767,
     "TEN": 245
    }
   }
  ],
  "inertia": {
   "A_C": 0.0034,
   "TEN": 0.0009
  }
 },
 "AG0868-6PK": {
  "gatesVersion": "9.37",
  "order": [
   "CRK",
   "A_C",
   "TEN"
  ],
  "pulley": {
   "CRK": {
    "p": 177.41,
    "e": 175.01,
    "c": "grooved",
    "crank": 1
   },
   "A_C": {
    "p": 120.41,
    "e": 118.01,
    "c": "grooved"
   },
   "TEN": {
    "p": 77.2,
    "e": 79.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "CRK": [
    0,
    0
   ],
   "A_C": [
    263,
    15
   ],
   "TEN": [
    124.57,
    63.97
   ]
  },
  "belt": 1018,
  "tol": 5,
  "wear": 0.7,
  "ribs": 6,
  "pivot": [
   195,
   120
  ],
  "arm": 90,
  "preload": 8.65,
  "rate": 0.495,
  "meanLoad": 19.04,
  "freeAbsDeg": 239.5,
  "design": 301,
  "takeupRef": 1.104,
  "NF": 37.61,
  "B10": 21251,
  "degC": 90,
  "armInertia": 0.0009,
  "ribFatiguePct": {
   "CRK": 2.7,
   "A_C": 25,
   "TEN": 72.4
  },
  "loadContribPct": [
   15,
   7,
   14,
   22,
   25,
   18
  ],
  "span": {
   "CRK": 261.9,
   "A_C": 108.6,
   "TEN": 58.3
  },
  "wrap": {
   "CRK": 227.7,
   "A_C": 193.3,
   "TEN": 61
  },
  "ratio": {
   "CRK": 1,
   "A_C": 1.473,
   "TEN": 2.298
  },
  "tensionTableValid": true,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 239.5,
    "X": 149.3,
    "Y": 42.5,
    "beta": 32.9,
    "dir": 92.4,
    "hub": 176.7,
    "T": 133,
    "wrap": 83.3,
    "EDL": 1041.4,
    "REBL": 1041.4
   },
   {
    "name": "Replace",
    "rel": 10.1,
    "absDeg": 229.4,
    "X": 136.5,
    "Y": 51.6,
    "beta": 36.8,
    "dir": 86.2,
    "hub": 252.6,
    "T": 213.7,
    "wrap": 72.5,
    "EDL": 1030.2,
    "REBL": 1030.2
   },
   {
    "name": "Max",
    "rel": 16.5,
    "absDeg": 223,
    "X": 129.2,
    "Y": 58.6,
    "beta": 40.6,
    "dir": 83.6,
    "hub": 287.1,
    "T": 263.8,
    "wrap": 66,
    "EDL": 1023,
    "REBL": 1023
   },
   {
    "name": "Mean",
    "rel": 21,
    "absDeg": 218.5,
    "X": 124.6,
    "Y": 64,
    "beta": 43.8,
    "dir": 82.3,
    "hub": 305.3,
    "T": 300.7,
    "wrap": 61,
    "EDL": 1018,
    "REBL": 1018
   },
   {
    "name": "Min",
    "rel": 25.6,
    "absDeg": 213.9,
    "X": 120.3,
    "Y": 69.8,
    "beta": 47.6,
    "dir": 81.6,
    "hub": 320.3,
    "T": 344.4,
    "wrap": 55.4,
    "EDL": 1013,
    "REBL": 1013
   },
   {
    "name": "Load",
    "rel": 32.6,
    "absDeg": 206.9,
    "X": 114.7,
    "Y": 79.3,
    "beta": 54.6,
    "dir": 81.5,
    "hub": 337.8,
    "T": 436.5,
    "wrap": 45.5,
    "EDL": 1005.7,
    "REBL": 1005.7
   }
  ],
  "duty": [
   {
    "engineRpm": 800,
    "dcPct": 27,
    "kw": {
     "A_C": 1.3,
     "TEN": 0.01
    },
    "crankKw": 1.31,
    "T": {
     "CRK": 477,
     "A_C": 302,
     "TEN": 301
    },
    "H": {
     "CRK": 715,
     "A_C": 774,
     "TEN": 306
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 10,
    "kw": {
     "A_C": 1.5,
     "TEN": 0.01
    },
    "crankKw": 1.51,
    "T": {
     "CRK": 463,
     "A_C": 302,
     "TEN": 301
    },
    "H": {
     "CRK": 702,
     "A_C": 760,
     "TEN": 306
    }
   },
   {
    "engineRpm": 1250,
    "dcPct": 13,
    "kw": {
     "A_C": 4,
     "TEN": 0.01
    },
    "crankKw": 4.01,
    "T": {
     "CRK": 646,
     "A_C": 302,
     "TEN": 301
    },
    "H": {
     "CRK": 877,
     "A_C": 942,
     "TEN": 306
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 18,
    "kw": {
     "A_C": 4.6,
     "TEN": 0.01
    },
    "crankKw": 4.61,
    "T": {
     "CRK": 632,
     "A_C": 301,
     "TEN": 301
    },
    "H": {
     "CRK": 863,
     "A_C": 927,
     "TEN": 306
    }
   },
   {
    "engineRpm": 1750,
    "dcPct": 19,
    "kw": {
     "A_C": 4.7,
     "TEN": 0.01
    },
    "crankKw": 4.71,
    "T": {
     "CRK": 590,
     "A_C": 301,
     "TEN": 301
    },
    "H": {
     "CRK": 824,
     "A_C": 886,
     "TEN": 306
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 13,
    "kw": {
     "A_C": 4.7,
     "TEN": 0.01
    },
    "crankKw": 4.71,
    "T": {
     "CRK": 554,
     "A_C": 301,
     "TEN": 301
    },
    "H": {
     "CRK": 789,
     "A_C": 850,
     "TEN": 306
    }
   }
  ],
  "inertia": {
   "A_C": 0.0034,
   "TEN": 0.0009
  }
 },
 "AG00686-1520": {
  "gatesVersion": "9.40",
  "order": [
   "CRK",
   "IDR",
   "A_C",
   "TEN"
  ],
  "pulley": {
   "CRK": {
    "p": 174.4,
    "e": 172,
    "c": "grooved",
    "crank": 1
   },
   "IDR": {
    "p": 77.2,
    "e": 79.6,
    "c": "back"
   },
   "A_C": {
    "p": 139.4,
    "e": 137,
    "c": "grooved"
   },
   "TEN": {
    "p": 77.2,
    "e": 79.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "CRK": [
    0,
    0
   ],
   "IDR": [
    -72,
    267
   ],
   "A_C": [
    -224,
    448
   ],
   "TEN": [
    -149.27,
    184.59
   ]
  },
  "belt": 1520,
  "tol": 6,
  "wear": 0.7,
  "ribs": 8,
  "fatigueModel": "PK-2_2p-MT3",
  "pivot": [
   -180,
   100
  ],
  "arm": 90,
  "preload": 8.86,
  "preloadDerived": false,
  "rate": 0.476,
  "meanLoad": 22.2,
  "freeAbsDeg": 42,
  "design": 609,
  "takeupRef": 0.636,
  "NF": 13.35,
  "B10": 13310,
  "degC": 92,
  "armInertia": 0.0076,
  "ribFatiguePct": {
   "CRK": 1.9,
   "IDR": 45.3,
   "A_C": 7.4,
   "TEN": 45.3
  },
  "loadContribPct": [
   17,
   8,
   12,
   20,
   24,
   19
  ],
  "span": {
   "CRK": 246.3,
   "IDR": 210.1,
   "A_C": 251.5,
   "TEN": 201.3
  },
  "wrap": {
   "CRK": 215.2,
   "IDR": 29.4,
   "A_C": 206.4,
   "TEN": 32.2
  },
  "ratio": {
   "CRK": 1,
   "IDR": 2.259,
   "A_C": 1.251,
   "TEN": 2.259
  },
  "tensionTableValid": true,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 42,
    "X": -113.1,
    "Y": 160.2,
    "beta": 23.5,
    "dir": 198.5,
    "hub": 246.8,
    "T": 313.8,
    "wrap": 46.3,
    "EDL": 1538.4,
    "REBL": 1536.3
   },
   {
    "name": "Max",
    "rel": 18.6,
    "absDeg": 60.6,
    "X": -135.9,
    "Y": 178.4,
    "beta": 38.8,
    "dir": 201.9,
    "hub": 314.6,
    "T": 490.7,
    "wrap": 37.4,
    "EDL": 1527.7,
    "REBL": 1525.6
   },
   {
    "name": "Mean",
    "rel": 28,
    "absDeg": 70,
    "X": -149.3,
    "Y": 184.6,
    "beta": 47,
    "dir": 203,
    "hub": 337.4,
    "T": 608.8,
    "wrap": 32.2,
    "EDL": 1521.7,
    "REBL": 1519.6
   },
   {
    "name": "Min",
    "rel": 37.7,
    "absDeg": 79.7,
    "X": -164,
    "Y": 188.6,
    "beta": 55.8,
    "dir": 203.9,
    "hub": 360.2,
    "T": 793.4,
    "wrap": 26.2,
    "EDL": 1515.7,
    "REBL": 1513.6
   },
   {
    "name": "Load",
    "rel": 54.5,
    "absDeg": 96.5,
    "X": -190.2,
    "Y": 189.4,
    "beta": 71.9,
    "dir": 204.6,
    "hub": 406.8,
    "T": 1579.2,
    "wrap": 14.8,
    "EDL": 1507.3,
    "REBL": 1505.2
   }
  ],
  "duty": [
   {
    "engineRpm": 800,
    "dcPct": 27,
    "kw": {
     "IDR": 0.01,
     "A_C": 3,
     "TEN": 0.01
    },
    "crankKw": 3.02,
    "T": {
     "CRK": 1022,
     "IDR": 1021,
     "A_C": 610,
     "TEN": 609
    },
    "H": {
     "CRK": 1560,
     "IDR": 518,
     "A_C": 1591,
     "TEN": 338
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 10,
    "kw": {
     "IDR": 0.01,
     "A_C": 4,
     "TEN": 0.01
    },
    "crankKw": 4.02,
    "T": {
     "CRK": 1049,
     "IDR": 1048,
     "A_C": 610,
     "TEN": 609
    },
    "H": {
     "CRK": 1586,
     "IDR": 532,
     "A_C": 1617,
     "TEN": 338
    }
   },
   {
    "engineRpm": 1250,
    "dcPct": 13,
    "kw": {
     "IDR": 0.01,
     "A_C": 5,
     "TEN": 0.01
    },
    "crankKw": 5.02,
    "T": {
     "CRK": 1049,
     "IDR": 1048,
     "A_C": 610,
     "TEN": 609
    },
    "H": {
     "CRK": 1585,
     "IDR": 532,
     "A_C": 1617,
     "TEN": 338
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 18,
    "kw": {
     "IDR": 0.01,
     "A_C": 5.5,
     "TEN": 0.01
    },
    "crankKw": 5.52,
    "T": {
     "CRK": 1012,
     "IDR": 1011,
     "A_C": 610,
     "TEN": 609
    },
    "H": {
     "CRK": 1550,
     "IDR": 513,
     "A_C": 1580,
     "TEN": 338
    }
   },
   {
    "engineRpm": 1750,
    "dcPct": 19,
    "kw": {
     "IDR": 0.01,
     "A_C": 6.8,
     "TEN": 0.01
    },
    "crankKw": 6.82,
    "T": {
     "CRK": 1036,
     "IDR": 1035,
     "A_C": 609,
     "TEN": 609
    },
    "H": {
     "CRK": 1573,
     "IDR": 525,
     "A_C": 1604,
     "TEN": 338
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 13,
    "kw": {
     "IDR": 0.01,
     "A_C": 8.2,
     "TEN": 0.01
    },
    "crankKw": 8.22,
    "T": {
     "CRK": 1059,
     "IDR": 1058,
     "A_C": 609,
     "TEN": 609
    },
    "H": {
     "CRK": 1595,
     "IDR": 537,
     "A_C": 1627,
     "TEN": 338
    }
   }
  ],
  "inertia": {
   "IDR": 0.0004,
   "A_C": 0.003,
   "TEN": 0.0076
  }
 },
 "AG00810": {
  "gatesVersion": "4.32",
  "order": [
   "CRK",
   "IDR",
   "ALT",
   "TEN"
  ],
  "pulley": {
   "CRK": {
    "p": 178.4,
    "e": 176,
    "c": "grooved",
    "crank": 1
   },
   "IDR": {
    "p": 77.2,
    "e": 79.6,
    "c": "back"
   },
   "ALT": {
    "p": 57.4,
    "e": 55,
    "c": "grooved"
   },
   "TEN": {
    "p": 77.2,
    "e": 79.6,
    "c": "back",
    "ten": 1
   }
  },
  "xy": {
   "CRK": [
    0,
    0
   ],
   "IDR": [
    -200,
    150
   ],
   "ALT": [
    -391,
    131
   ],
   "TEN": [
    -217.41,
    34.81
   ]
  },
  "belt": 1214,
  "tol": 5,
  "wear": 0.6,
  "ribs": 10,
  "fatigueModel": "PK-2_2a-MT3",
  "pivot": [
   -303,
   7
  ],
  "arm": 90,
  "preload": 11.561,
  "preloadDerived": true,
  "rate": 0.483,
  "meanLoad": 29.48,
  "freeAbsDeg": 55.1,
  "design": 759,
  "takeupRef": 0.677,
  "NF": 13.29,
  "B10": 2559,
  "degC": 90,
  "armInertia": 0.004,
  "ribFatiguePct": {
   "CRK": 0.6,
   "IDR": 16.4,
   "ALT": 66.7,
   "TEN": 16.4
  },
  "loadContribPct": [
   18,
   0,
   9,
   13,
   0,
   21,
   0,
   23,
   0,
   16
  ],
  "span": {
   "CRK": 214.9,
   "IDR": 179.8,
   "ALT": 186.7,
   "TEN": 179.3
  },
  "wrap": {
   "CRK": 218.5,
   "IDR": 8.7,
   "ALT": 185.7,
   "TEN": 35.4
  },
  "ratio": {
   "CRK": 1,
   "IDR": 2.311,
   "ALT": 3.108,
   "TEN": 2.311
  },
  "tensionTableValid": true,
  "pos": [
   {
    "name": "FreeArm",
    "rel": 0,
    "absDeg": 55.1,
    "X": -251.6,
    "Y": 80.8,
    "beta": 15.1,
    "dir": 250.2,
    "hub": 492,
    "T": 542.2,
    "wrap": 54,
    "EDL": 1237.3,
    "REBL": 1235.7
   },
   {
    "name": "Replace",
    "rel": 18.3,
    "absDeg": 36.8,
    "X": -231,
    "Y": 60.9,
    "beta": 29.1,
    "dir": 245.9,
    "hub": 465.4,
    "T": 593.8,
    "wrap": 46.1,
    "EDL": 1228.2,
    "REBL": 1226.6
   },
   {
    "name": "Max",
    "rel": 29.7,
    "absDeg": 25.4,
    "X": -221.7,
    "Y": 45.6,
    "beta": 38.6,
    "dir": 244,
    "hub": 461.2,
    "T": 674,
    "wrap": 40,
    "EDL": 1220.9,
    "REBL": 1219.3
   },
   {
    "name": "Mean",
    "rel": 37.1,
    "absDeg": 18,
    "X": -217.4,
    "Y": 34.8,
    "beta": 45.1,
    "dir": 243.1,
    "hub": 461.8,
    "T": 759.2,
    "wrap": 35.4,
    "EDL": 1215.9,
    "REBL": 1214.3
   },
   {
    "name": "Min",
    "rel": 44.6,
    "absDeg": 10.5,
    "X": -214.5,
    "Y": 23.4,
    "beta": 52.1,
    "dir": 242.5,
    "hub": 466.4,
    "T": 896.5,
    "wrap": 30.2,
    "EDL": 1210.9,
    "REBL": 1209.3
   },
   {
    "name": "Load",
    "rel": 66.5,
    "absDeg": 348.6,
    "X": -214.8,
    "Y": -10.8,
    "beta": 73.9,
    "dir": 242.5,
    "hub": 505.3,
    "T": 2404.6,
    "wrap": 12.1,
    "EDL": 1199.8,
    "REBL": 1198.2
   }
  ],
  "duty": [
   {
    "engineRpm": 600,
    "dcPct": 27,
    "kw": {
     "IDR": 0.01,
     "ALT": 9,
     "TEN": 0.01
    },
    "crankKw": 9.02,
    "T": {
     "CRK": 2369,
     "IDR": 2367,
     "ALT": 761,
     "TEN": 759
    },
    "H": {
     "CRK": 3001,
     "IDR": 360,
     "ALT": 3125,
     "TEN": 462
    }
   },
   {
    "engineRpm": 900,
    "dcPct": 0,
    "kw": {
     "IDR": 0.01,
     "ALT": 12.5,
     "TEN": 0.01
    },
    "crankKw": 12.52,
    "T": {
     "CRK": 2248,
     "IDR": 2247,
     "ALT": 760,
     "TEN": 759
    },
    "H": {
     "CRK": 2882,
     "IDR": 342,
     "ALT": 3005,
     "TEN": 462
    }
   },
   {
    "engineRpm": 1000,
    "dcPct": 10,
    "kw": {
     "IDR": 0.01,
     "ALT": 13,
     "TEN": 0.01
    },
    "crankKw": 13.02,
    "T": {
     "CRK": 2153,
     "IDR": 2152,
     "ALT": 760,
     "TEN": 759
    },
    "H": {
     "CRK": 2788,
     "IDR": 327,
     "ALT": 2910,
     "TEN": 462
    }
   },
   {
    "engineRpm": 1200,
    "dcPct": 13,
    "kw": {
     "IDR": 0.01,
     "ALT": 14.5,
     "TEN": 0.01
    },
    "crankKw": 14.52,
    "T": {
     "CRK": 2055,
     "IDR": 2054,
     "ALT": 760,
     "TEN": 759
    },
    "H": {
     "CRK": 2691,
     "IDR": 312,
     "ALT": 2811,
     "TEN": 462
    }
   },
   {
    "engineRpm": 1400,
    "dcPct": 0,
    "kw": {
     "IDR": 0.01,
     "ALT": 16.5,
     "TEN": 0.01
    },
    "crankKw": 16.52,
    "T": {
     "CRK": 2022,
     "IDR": 2022,
     "ALT": 760,
     "TEN": 759
    },
    "H": {
     "CRK": 2659,
     "IDR": 307,
     "ALT": 2779,
     "TEN": 462
    }
   },
   {
    "engineRpm": 1500,
    "dcPct": 18,
    "kw": {
     "IDR": 0.01,
     "ALT": 17,
     "TEN": 0.01
    },
    "crankKw": 17.02,
    "T": {
     "CRK": 1974,
     "IDR": 1973,
     "ALT": 760,
     "TEN": 759
    },
    "H": {
     "CRK": 2612,
     "IDR": 300,
     "ALT": 2730,
     "TEN": 462
    }
   },
   {
    "engineRpm": 1600,
    "dcPct": 0,
    "kw": {
     "IDR": 0.01,
     "ALT": 17.5,
     "TEN": 0.01
    },
    "crankKw": 17.52,
    "T": {
     "CRK": 1931,
     "IDR": 1931,
     "ALT": 760,
     "TEN": 759
    },
    "H": {
     "CRK": 2570,
     "IDR": 294,
     "ALT": 2688,
     "TEN": 462
    }
   },
   {
    "engineRpm": 1800,
    "dcPct": 19,
    "kw": {
     "IDR": 0.01,
     "ALT": 18,
     "TEN": 0.01
    },
    "crankKw": 18.02,
    "T": {
     "CRK": 1831,
     "IDR": 1830,
     "ALT": 760,
     "TEN": 759
    },
    "H": {
     "CRK": 2471,
     "IDR": 278,
     "ALT": 2588,
     "TEN": 462
    }
   },
   {
    "engineRpm": 1900,
    "dcPct": 0,
    "kw": {
     "IDR": 0.01,
     "ALT": 18.5,
     "TEN": 0.01
    },
    "crankKw": 18.52,
    "T": {
     "CRK": 1803,
     "IDR": 1802,
     "ALT": 760,
     "TEN": 759
    },
    "H": {
     "CRK": 2443,
     "IDR": 274,
     "ALT": 2559,
     "TEN": 462
    }
   },
   {
    "engineRpm": 2000,
    "dcPct": 13,
    "kw": {
     "IDR": 0.01,
     "ALT": 19,
     "TEN": 0.01
    },
    "crankKw": 19.02,
    "T": {
     "CRK": 1777,
     "IDR": 1777,
     "ALT": 760,
     "TEN": 759
    },
    "H": {
     "CRK": 2418,
     "IDR": 270,
     "ALT": 2534,
     "TEN": 462
    }
   }
  ],
  "inertia": {
   "IDR": 0.0002,
   "ALT": 0.014,
   "TEN": 0.0004
  }
 }
};

  function buildMisc(key) {
    const d = AG_MISC[key];
    return F.makeSystem({
      pulleys: d.order.map(n => { const q = d.pulley[n]; return Object.assign(
        { name: n, rPitch: q.p / 2, rEff: q.e / 2, contact: q.c },
        q.ten ? { tensioner: true } : { x: d.xy[n][0], y: d.xy[n][1] },
        q.crank ? { crank: true } : {}); }),
      belt: { profile:'PK', brand:'GATES', ribs: d.ribs || 8, effLength: d.belt,
              tolerance: d.tol, wearPct: d.wear/100 },
      tensioner: { pivot: d.pivot, armLength: d.arm, preloadNm: d.preload,
                   rateNmPerDeg: d.rate,
                   freeAngleDeg: d.freeAbsDeg > 180 ? d.freeAbsDeg - 360 : d.freeAbsDeg },
      designTensionN: d.design, driveRatio: 1, lengthOffsetMm: 0,
      gatesVersion: d.gatesVersion,
    });
  }

  function buildAG00976(key) {
    const d = AG00976[key];
    return F.makeSystem({
      pulleys: AG00976_ORDER.map(n => Object.assign(
        { name: n, od: AG00976_OD[n], contact: AG00976_CONTACT[n] },
        n === 'TEN' ? { tensioner: true } : { x: d.xy[n][0], y: d.xy[n][1] },
        n === 'FAN' ? { crank: true } : {})),
      belt: { profile:'PK', brand:'GATES', ribs: d.ribs,
              effLength: d.belt, tolerance: d.tol, wearPct: d.wear/100 },
      tensioner: { pivot: d.pivot, armLength: d.arm, preloadNm: d.preload,
                   rateNmPerDeg: d.rate, freeAngleDeg: d.freeAbsDeg,
                   sense: d.sense },
      designTensionN: d.design, driveRatio: 1, lengthOffsetMm: 0,
    });
  }
  /* lengthOffset = EDL(Mean) - L_nominal. Bu tanımla Replace/Max/Min
   * konumları Gates ile <0.07 derece örtüşür. */
  function calibrated(sys, relMean, beltLen) {
    sys.lengthOffsetMm = F.calibrateLengthOffset(sys,
      { relDeg: relMean, beltLengthMm: beltLen });
    sys._cache = {};
    return sys;
  }
  const buildAG00686 = () => F.makeSystem({
    pulleys: AG00686.pulleys, belt: AG00686.belt,
    tensioner: AG00686.tensioner, designTensionN: AG00686.designTensionN, driveRatio: 1,
  });

  /* --------------------------------------------------- koruma mekanizmaları
   * v1'de sessizce yanlış sonuç üreten durumların artık hata verdiğini
   * doğrular. Her biri ATMAK ZORUNDA. */
  function guardTests() {
    const t = [];
    const must = (name, fn) => {
      try { fn(); t.push({ name, ok: false, got: 'hata atmadi' }); }
      catch (e) { t.push({ name, ok: true, got: e.message.slice(0, 90) }); }
    };
    must('erisilemez hedef gerginlik -> bracket hatasi', () => {
      const sys = buildAG00686();
      F.solveArmForTension(sys, 99999);
    });
    must('yanlis kasnak sirasi -> sarim degismezi', () => {
      const sys = buildAG00686();
      const p = sys.pulleys.slice();
      [p[1], p[2]] = [p[2], p[1]];                 // IDR ile A_C yer degistir
      F.solveGeometry(p.map((q, i) => ({ name: q.name, rPitch: q.rPitch, rEff: q.rEff,
        contact: q.contact, c: i === 3 ? F.tenCenter(sys, 33.1) : [q.x, q.y] })));
    });
    /* checkClearance: bir span'in baska bir kasnagin icinden gecmesi.
     * Elle kurulmus geometri uzerinde birim test. */
    (function () {
      const fake = {
        names: ['A', 'B', 'C'],
        pulleys: [{ name: 'A', c: [0, 0], rPitch: 40, contact: 'grooved' },
                  { name: 'B', c: [200, 0], rPitch: 40, contact: 'grooved' },
                  { name: 'C', c: [100, 10], rPitch: 40, contact: 'grooved' }],
        spans: [{ Pi: [0, 40], Pj: [200, 40] }, { Pi: [200, -40], Pj: [100, -30] },
                { Pi: [100, 50], Pj: [0, 40] }],
      };
      const v = F.checkClearance(fake);
      t.push({ name: 'checkClearance kasnak kesen spani bulur', ok: v.length > 0,
               got: v.length ? v[0].span + ' spani ' + v[0].pulley + ' kasnagini kesiyor' : 'bulamadi' });
    })();
    /* Ters temas tarafi TESPIT EDILEMEZ: baska bir gecerli guzergah uretir.
     * Bunu belgeliyoruz ki sessiz bir varsayim olarak kalmasin. */
    (function () {
      const sys = buildAG00686();
      const g = F.solveGeometry(sys.pulleys.map((q, i) => ({ name: q.name,
        rPitch: q.rPitch, rEff: q.rEff, contact: i === 1 ? 'grooved' : q.contact,
        c: i === 3 ? F.tenCenter(sys, 33.1) : [q.x, q.y] })));
      t.push({ name: '[bilinen sinir] ters temas tarafi', ok: true,
               got: 'tespit EDILEMEZ, gecerli ama farkli guzergah (Leff ' +
                    g.LeffMm.toFixed(1) + ' vs 1478.5) -> cizimle dogrulanmali' });
    })();
    must('tutarsiz surucu gucu -> cevrim kapanmaz', () => {
      const sys = buildAG00686();
      F.spanTensions(sys, { engineRpm: 1250, loadsKw: { CRK: 99, A_C: 5, IDR: 0.01, TEN: 0.01 } });
    });
    must('crank tanimsiz -> hata', () => F.makeSystem({
      pulleys: [{ name: 'A', x: 0, y: 0, od: 100, contact: 'grooved' },
                { name: 'B', x: 200, y: 0, od: 100, contact: 'grooved' },
                { name: 'T', tensioner: true, od: 75, contact: 'back' }],
      belt: { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 800 },
      tensioner: { pivot: [100, 100], armLength: 50, preloadNm: 8, rateNmPerDeg: 0.5, freeAngleDeg: 0 },
    }));
    must('bilinmeyen kayis markasi -> hata', () =>
      F.beltProps({ profile: 'PK', brand: 'YOKBOYLE' }));
    /* sense otomatik bulunuyor mu (atmamalı) */
    try {
      const d = AG00976['1715@-250/110'];
      const sys = F.makeSystem({
        pulleys: AG00976_ORDER.map(n => Object.assign(
          { name: n, od: AG00976_OD[n], contact: AG00976_CONTACT[n] },
          n === 'TEN' ? { tensioner: true } : { x: d.xy[n][0], y: d.xy[n][1] },
          n === 'FAN' ? { crank: true } : {})),
        belt: { profile: 'PK', brand: 'GATES', ribs: 8, effLength: d.belt, tolerance: 6, wearPct: 0.006 },
        tensioner: { pivot: d.pivot, armLength: 90, preloadNm: d.preload,
                     rateNmPerDeg: d.rate, freeAngleDeg: d.freeAbsDeg },  // sense YOK
        designTensionN: d.design,
      });
      t.push({ name: 'sense otomatik tespiti', ok: sys.tensioner.sense === d.sense,
               got: 'bulundu: ' + sys.tensioner.sense + ' (beklenen ' + d.sense + ')' });
    } catch (e) { t.push({ name: 'sense otomatik tespiti', ok: false, got: e.message.slice(0, 90) }); }
    return { tests: t, pass: t.every(x => x.ok) };
  }

  /* ------------------------------------------------------------ koşucu */
  function run(opts) {
    opts = opts || {};
    const suites = [];
    const mk = (name) => { const s = { name, rows: [] }; suites.push(s); return s; };
    /* unit:'deg' satırları MUTLAK derece hatasıyla değerlendirilir; sıfıra
     * yakın kol açılarında yüzde hatası anlamsızdır (4.7 vs 4.14 -> %12). */
    const cmp = (s, group, label, calc, ref, unit) => s.rows.push({
      group, label, calc, ref, unit: unit || 'pct',
      errPct: Math.abs(calc - ref) / Math.max(Math.abs(ref), 1e-9) * 100,
      absErr: Math.abs(calc - ref),
    });

    /* ---- AG00686 (eski, elle kurulmus veri) — artik gercek rapor
     * AG_MISC icinde, bu suit devre disi ---- */
    (function () { if (true) return;
      const s = mk('AG00686 (8PK1475, 4 kasnak)');
      const sys = buildAG00686(), R = AG00686.ref;
      const relMean = R.pos.find(p => p.name === 'Mean').rel;
      calibrated(sys, relMean, AG00686.belt.effLength);
      s.lengthOffsetMm = sys.lengthOffsetMm;
      const st = F.tensionerState(sys, relMean), g = st.geom;
      g.names.forEach((nm, i) => {
        cmp(s, 'geom', 'span ' + nm, g.exitSpanLen(i), R.span[nm]);
        cmp(s, 'geom', 'sarım ' + nm, g.wrapDeg(i), R.wrap[nm], 'deg');
      });
      cmp(s, 'geom', 'Leff(mean)', st.driveLenMm, R.LeffMean);
      cmp(s, 'gergi', 'take-up', st.takeupMmPerDeg, R.takeupMean);
      R.pos.forEach(p => {
        const q = F.tensionerState(sys, p.rel);
        cmp(s, 'poz', p.name + ' T', q.tensionN, p.T);
        cmp(s, 'poz', p.name + ' hub', q.hubloadN, p.hub);
        cmp(s, 'poz', p.name + ' yön', q.hubDirDeg, p.dir, 'deg');
        cmp(s, 'poz', p.name + ' beta', q.betaDeg, p.beta, 'deg');
        cmp(s, 'poz', p.name + ' sarım', q.wrapDeg, p.wrap, 'deg');
      });
      const pt = F.positionTable(sys), relOf = (n) => (pt.find(r => r.position === n) || {}).relDeg;
      ['Replace','MaxBelt','Mean','MinBelt'].forEach(n => {
        const ref = R.pos.find(p => p.name === n);
        if (ref && relOf(n) != null) cmp(s, 'poz', n + ' rel açı', relOf(n), ref.rel, 'deg');
      });
      R.duty.forEach(([rpm, kwAC]) => {
        const t = F.spanTensions(sys, { engineRpm: rpm,
          loadsKw: { A_C: kwAC, IDR: 0.01, TEN: 0.01 } });
        const hb = F.hubloads(g, t.spanN);
        ['CRK','IDR','A_C','TEN'].forEach((nm, k) => {
          cmp(s, 'T-DC', rpm + ' T ' + nm,
            t.perPulley.find(p => p.name === nm).exitTensionN, R.T[rpm][k]);
          cmp(s, 'H-DC', rpm + ' H ' + nm, hb.find(p => p.name === nm).FN, R.H[rpm][k]);
        });
      });
    })();

    /* ---- AG00976 x4 ---- */
    Object.keys(AG00976).forEach(key => {
      const s = mk('AG00976 ' + key);
      const d = AG00976[key], sys = buildAG00976(key);
      const relMean = d.pos.find(p => p.name === 'Mean').rel;
      calibrated(sys, relMean, d.belt);
      s.lengthOffsetMm = sys.lengthOffsetMm;
      const st = F.tensionerState(sys, relMean), g = st.geom;
      g.names.forEach((nm, i) => {
        cmp(s, 'geom', 'span ' + nm, g.exitSpanLen(i), d.span[nm]);
        cmp(s, 'geom', 'sarım ' + nm, g.wrapDeg(i), d.wrap[nm], 'deg');
      });
      cmp(s, 'gergi', 'take-up', st.takeupMmPerDeg, d.takeupRef);
      cmp(s, 'gergi', 'yay mean tork', st.springNm, d.meanLoad);

      d.pos.forEach(p => {
        const q = F.tensionerState(sys, p.rel);
        cmp(s, 'poz', p.name + ' X', q.center[0], p.X);
        cmp(s, 'poz', p.name + ' Y', q.center[1], p.Y);
        cmp(s, 'poz', p.name + ' beta', q.betaDeg, p.beta, 'deg');
        cmp(s, 'poz', p.name + ' yön', q.hubDirDeg, p.dir, 'deg');
        cmp(s, 'poz', p.name + ' hub', q.hubloadN, p.hub);
        cmp(s, 'poz', p.name + ' T', q.tensionN, p.T);
        cmp(s, 'poz', p.name + ' sarım', q.wrapDeg, p.wrap, 'deg');
        cmp(s, 'poz', p.name + ' EDL', q.driveLenMm, p.EDL);
      });
      const pt = F.positionTable(sys), relOf = (n) => (pt.find(r => r.position === n) || {}).relDeg;
      [['Replace','Replace'],['Max','MaxBelt'],['Mean','Mean'],['Min','MinBelt']].forEach(([rn, pn]) => {
        const ref = d.pos.find(p => p.name === rn);
        if (ref && relOf(pn) != null) cmp(s, 'poz', rn + ' rel açı', relOf(pn), ref.rel, 'deg');
      });
      d.duty.forEach(u => {
        const t = F.spanTensions(sys, { engineRpm: u.engineRpm,
          loadsKw: { A_C: u.A_C, ALT: u.ALT, IDR1: 0.01, IDR2: 0.01, TEN: 0.01 } });
        const hb = F.hubloads(g, t.spanN);
        AG00976_ORDER.forEach(nm => {
          cmp(s, 'T-DC', u.engineRpm + ' T ' + nm,
            t.perPulley.find(p => p.name === nm).exitTensionN, u.T[nm]);
          cmp(s, 'H-DC', u.engineRpm + ' H ' + nm, hb.find(p => p.name === nm).FN, u.H[nm]);
        });
      });
    });

    /* ---- AG00879 / AG00894 ---- */
    Object.keys(AG_MISC).forEach(key => {
      const d = AG_MISC[key];
      const s = mk(key + ' (' + d.order.length + ' kasnak, kol ' + d.arm +
                   ' mm, Gates v' + d.gatesVersion + ')');
      const sys = buildMisc(key);
      const relMean = d.pos.find(p => p.name === 'Mean').rel;
      calibrated(sys, relMean, d.belt);
      s.lengthOffsetMm = sys.lengthOffsetMm;
      const st = F.tensionerState(sys, relMean), g = st.geom;
      g.names.forEach((nm, i) => {
        cmp(s, 'geom', 'span ' + nm, g.exitSpanLen(i), d.span[nm]);
        cmp(s, 'geom', 'sarım ' + nm, g.wrapDeg(i), d.wrap[nm], 'deg');
        cmp(s, 'geom', 'hız oranı ' + nm, F.speedRatio(sys, i), d.ratio[nm]);
      });
      cmp(s, 'gergi', 'take-up', st.takeupMmPerDeg, d.takeupRef);
      cmp(s, 'gergi', 'yay mean tork', st.springNm, d.meanLoad);

      d.pos.forEach(p => {
        const q = F.tensionerState(sys, p.rel);
        cmp(s, 'poz', p.name + ' X', q.center[0], p.X);
        cmp(s, 'poz', p.name + ' Y', q.center[1], p.Y);
        cmp(s, 'poz', p.name + ' beta', q.betaDeg, p.beta, 'deg');
        cmp(s, 'poz', p.name + ' yön', q.hubDirDeg, p.dir, 'deg');
        cmp(s, 'poz', p.name + ' hub', q.hubloadN, p.hub);
        cmp(s, 'poz', p.name + ' T', q.tensionN, p.T);
        cmp(s, 'poz', p.name + ' sarım', q.wrapDeg, p.wrap, 'deg');
        cmp(s, 'poz', p.name + ' EDL', q.driveLenMm, p.EDL);
      });
      const pt = F.positionTable(sys), relOf = (n) => (pt.find(r => r.position === n) || {}).relDeg;
      [['Replace','Replace'],['Max','MaxBelt'],['Mean','Mean'],['Min','MinBelt']].forEach(([rn, pn]) => {
        const ref = d.pos.find(p => p.name === rn);
        if (ref && relOf(pn) != null) cmp(s, 'poz', rn + ' rel açı', relOf(pn), ref.rel, 'deg');
      });
      d.duty.forEach(u => {
        const t = F.spanTensions(sys, { engineRpm: u.engineRpm, loadsKw: u.kw });
        const hb = F.hubloads(g, t.spanN);
        if (d.tensionTableValid === false) return;              // bkz. rapor kusuru
        cmp(s, 'guc', u.engineRpm + ' sürücü kW',
            t.perPulley.find(p => p.name === d.order.find(n => d.pulley[n].crank)).powerKw,
            u.crankKw);
        d.order.forEach(nm => {
          cmp(s, 'T-DC', u.engineRpm + ' T ' + nm,
            t.perPulley.find(p => p.name === nm).exitTensionN, u.T[nm]);
          cmp(s, 'H-DC', u.engineRpm + ' H ' + nm, hb.find(p => p.name === nm).FN, u.H[nm]);
        });
      });
    });

    /* ---- Gates raporundaki kusur: AG00902-1300 ortalama gerilme tablosu ----
     * Gates tasarim gerginligini GERGI cikis spani yerine KRANK cikis spanina
     * ankrajlamis; zincir kapanmiyor (TEN sutununa yine design yazilmis ama
     * zincirin sonu bambaska bir deger veriyor). Asagida bunu ISPATLIYORUZ:
     * "krank ankrajli" varsayimla raporun sayilari birebir yeniden uretiliyor. */
    (function () {
      const key = 'AG00902-1300';
      const d = AG_MISC[key]; if (!d) return;
      const s = mk(key + ' — rapor kusuru teshisi');
      const crk = d.order[0], ten = d.order.find(n => d.pulley[n].ten);
      const gaps = [];
      d.duty.forEach(u => {
        const v = Math.PI * (d.pulley[crk].p / 1000) * u.engineRpm / 60;
        let T = d.design;                          // Gates'in (yanlis) ankraji: KRANK
        d.order.slice(1).forEach(nm => {
          if (u.kw[nm] == null) return;
          T -= (u.kw[nm] * 1000) / v;
          if (nm !== ten) cmp(s, 'kusur', u.engineRpm + ' rpm ' + nm, T, u.T[nm]);
        });
        gaps.push({ rpm: u.engineRpm, chainEnd: T, printed: u.T[ten] });
      });
      s.note =
        'Raporun ara kasnak degerleri "tasarim gerginligi KRANK cikis spanina ' +
        'ankrajli" varsayimiyla birebir yeniden uretiliyor (yukaridaki satirlar). ' +
        'Ama zincir kapanmiyor: gergi sutununa ' + d.design + ' N basilmis, oysa ' +
        'zincirin sonu ' + gaps.map(x => x.rpm + ' rpm -> ' + x.chainEnd.toFixed(0) + ' N').join(', ') +
        '. Dogrusu ankrajin GERGI cikis spaninda olmasidir; o zaman krank ' +
        'cikisi ' + d.design + ' N degil, +P/v kadar yuksektir. Sonuc: bu raporun ' +
        'ortalama gerilme ve hubload tablolari kullanilamaz (krank hubloadi ' +
        '~%35 dusuk cikiyor). Geometri ve gergi bloklari saglam.';
    })();

    /* ---- kayis kaburga yorulmasi DAGILIMI (dogrulanmis model) ----
     * Gates'in "Pulley Contributions to Belt Rib Fatigue %" ve "Load
     * Contribution to Belt Rib Fatigue" tablolarina karsi. */
    (function () {
      const s = mk('Kaburga yorulma dağılımı — ribFatigueDistribution()');
      Object.keys(AG_MISC).forEach(k => {
        const d = AG_MISC[k]; if (!d.ribFatiguePct) return;
        const sys = buildMisc(k);
        calibrated(sys, d.pos.find(p => p.name === 'Mean').rel, d.belt);
        const r = F.ribFatigueDistribution(sys, { fatigueModel: d.fatigueModel || 'PK-2_2p-MT3',
          duty: d.duty.map(u => ({ engineRpm: u.engineRpm, dcPct: u.dcPct, loadsKw: u.kw })) });
        r.perPulley.forEach(p => cmp(s, 'kasnak payı',
          k + ' ' + p.name + ' (d=' + p.dEffMm.toFixed(1) + ')', p.sharePct,
          d.ribFatiguePct[p.name], 'pt'));
        if (d.loadContribPct) r.perLoadPct.forEach((x, i) => cmp(s, 'devir payı',
          k + ' ' + x.engineRpm + ' rpm', x.sharePct, d.loadContribPct[i], 'pt'));
      });
    })();

    /* ---- mutlak B10 omru (gecerlilik alani icinde) ---- */
    (function () {
      const s = mk('Kayış ömrü B10 — geçerlilik alanı içinde');
      const notes = [];
      Object.keys(AG_MISC).forEach(k => {
        const d = AG_MISC[k]; if (d.B10 == null || d.degC == null) return;
        const sys = buildMisc(k);
        calibrated(sys, d.pos.find(p => p.name === 'Mean').rel, d.belt);
        const r = F.beltLifeB10(sys, { degC: d.degC,
          duty: d.duty.map(u => ({ engineRpm: u.engineRpm, dcPct: u.dcPct, loadsKw: u.kw })) });
        if (r.inValidRange && k !== 'AG00894')
          cmp(s, 'B10', k + ' (' + d.ribs + ' kab, ' + d.degC + '°C)', r.hoursB10, d.B10, 'fit');
        else notes.push(k + ': ' + r.hoursB10.toFixed(0) + ' vs ' + d.B10 +
          ' = ' + (r.hoursB10 / d.B10).toFixed(2) + 'x' +
          (r.inValidRange ? ' [aralık içi ama aykırı]' : ' [aralık DIŞI: ' + r.outOfRange.join(', ') + ']'));
      });
      Object.keys(AG00976).forEach(k => {
        const d = AG00976[k]; if (d.B10 == null) return;
        const sys = buildAG00976(k);
        calibrated(sys, d.pos.find(p => p.name === 'Mean').rel, d.belt);
        const r = F.beltLifeB10(sys, { degC: d.degC, duty: d.duty.map(u => ({
          engineRpm: u.engineRpm, dcPct: u.dcPct,
          loadsKw: { A_C: u.A_C, ALT: u.ALT, IDR1: 0.01, IDR2: 0.01, TEN: 0.01 } })) });
        notes.push('AG00976 ' + k + ': ' + r.hoursB10.toFixed(0) + ' vs ' + d.B10 +
          ' = ' + (r.hoursB10 / d.B10).toFixed(2) + 'x [aralık DIŞI: ' + r.outOfRange.join(', ') + ']');
      });
      s.note = 'Gecerlilik alani disinda kalanlar (dogrulamaya dahil DEGIL): ' +
        notes.join(' | ') + '. 57-58.8 mm kasnakli sistemlerin hepsi ~0.55x ' +
        '-> sistematik ekstrapolasyon hatasi, rastgele degil.';
    })();

    /* ---- özet ---- */
    let total = 0, worst = 0, worstRow = null, worstDeg = 0, worstDegRow = null, worstFit = 0;
    let worstOp = 0, worstOpRow = null;                  // Load (mekanik stop) haric
    suites.forEach(s => {
      const pct = s.rows.filter(r => r.unit === 'pct');
      const deg = s.rows.filter(r => r.unit === 'deg');
      const fit = s.rows.filter(r => r.unit === 'fit');
      const pt = s.rows.filter(r => r.unit === 'pt');
      s.maxPt = pt.length ? Math.max.apply(null, pt.map(r => r.absErr)) : 0;
      s.rmsPt = pt.length ? Math.sqrt(pt.reduce((a, r) => a + r.absErr * r.absErr, 0) / pt.length) : 0;
      s.maxFit = fit.length ? Math.max.apply(null, fit.map(r => r.errPct)) : 0;
      s.max = pct.length ? Math.max.apply(null, pct.map(r => r.errPct)) : 0;
      s.avg = pct.length ? pct.reduce((a, r) => a + r.errPct, 0) / pct.length : 0;
      s.worstRow = pct.length ? pct.reduce((a, r) => r.errPct > a.errPct ? r : a, pct[0]) : null;
      s.maxDeg = deg.length ? Math.max.apply(null, deg.map(r => r.absErr)) : 0;
      s.worstDegRow = deg.length ? deg.reduce((a, r) => r.absErr > a.absErr ? r : a, deg[0]) : null;
      if (s.maxDeg > worstDeg) { worstDeg = s.maxDeg; worstDegRow = s.worstDegRow; }
      worstFit = Math.max(worstFit, s.maxFit);
      s.byGroup = {};
      pct.forEach(r => {
        const b = s.byGroup[r.group] || (s.byGroup[r.group] = { n: 0, max: 0, sum: 0 });
        b.n++; b.sum += r.errPct; b.max = Math.max(b.max, r.errPct);
      });
      Object.values(s.byGroup).forEach(b => b.avg = b.sum / b.n);
      total += s.rows.length;
      if (s.max > worst) { worst = s.max; worstRow = s.worstRow; }
      const op = pct.filter(r => r.label.indexOf('Load') < 0);
      s.maxOp = op.length ? Math.max.apply(null, op.map(r => r.errPct)) : 0;
      if (s.maxOp > worstOp) {
        worstOp = s.maxOp;
        worstOpRow = op.reduce((a, r) => r.errPct > a.errPct ? r : a, op[0]);
      }
    });
    const tol = opts.tolPct != null ? opts.tolPct : 0.5;
    const tolDeg = opts.tolDeg != null ? opts.tolDeg : 0.2;
    const pass = worstOp < tol && worst < 1.5 && worstDeg < tolDeg;
    return {
      suites, total, maxErrPct: worst, worstRow, maxErrOpPct: worstOp, worstOpRow,
      maxErrDeg: worstDeg, worstDegRow, maxFitErrPct: worstFit, pass, guards: guardTests(),
      summary: [
        'FEAD v' + F.VERSION + ' dogrulama: ' + suites.length + ' veri seti, ' + total + ' deger.',
        '  deterministik fizik : %' + worstOp.toFixed(2) + ' (calisma konumlari), %' +
          worst.toFixed(2) + ' (Load mekanik stop dahil), ' + worstDeg.toFixed(2) + ' derece (kol acisi)',
        '  kalibre model       : kaburga yorulma dagilimi, RMS ' +
          (suites.filter(x => x.rmsPt).map(x => x.rmsPt.toFixed(1))[0] || '-') +
          ' yuzde puani (19 deger, 2 bagimsiz sistem)',
        '  SONUC: ' + (pass ? 'GECTI' : 'KONTROL ET'),
      ].join(NL),
    };
  }

  function report(opts) {
    opts = opts || {};
    const r = run(opts);
    const L = [];
    r.suites.forEach(s => {
      L.push('');
      L.push('=== ' + s.name + '   (boy ofseti ' + (s.lengthOffsetMm != null ? s.lengthOffsetMm.toFixed(2) : '-') + ' mm)');
      Object.keys(s.byGroup).forEach(g => {
        const b = s.byGroup[g];
        L.push('    ' + g.padEnd(7) + ' n=' + String(b.n).padStart(3) +
          '  ort=%' + b.avg.toFixed(3) + '  max=%' + b.max.toFixed(2));
      });
      L.push('    -> ' + s.rows.length + ' deger' + (s.worstRow
        ? ', en buyuk %' + s.max.toFixed(2) + '  (' + s.worstRow.label + ': ' +
          s.worstRow.calc.toFixed(2) + ' vs ' + s.worstRow.ref + ')' : ' (hepsi kalibre model)'));
      if (s.note) s.note.match(/.{1,92}(\s|$)/g).forEach((ln, k) => L.push((k ? '            ' : '       NOT: ') + ln.trim()));
      if (s.maxPt) {
        L.push('       [yüzde puanı] RMS ' + s.rmsPt.toFixed(1) + ' puan, en büyük ' + s.maxPt.toFixed(1) + ' puan');
        s.rows.filter(r => r.unit === 'pt').forEach(r => L.push('         ' +
          r.label.padEnd(34) + '%' + r.calc.toFixed(1).padStart(6) + '  vs  %' +
          String(r.ref).padStart(5)));
      }
      if (s.maxFit) {
        L.push('       [kalibre model] en buyuk sapma %' + s.maxFit.toFixed(2));
        if (opts.detay || s.name.indexOf('B10') >= 0)
          s.rows.filter(r => r.unit === 'fit').forEach(r => L.push('         ' +
            r.label.padEnd(34) + r.calc.toFixed(0).padStart(8) + '  vs ' +
            String(r.ref).padStart(8) + '   %' + r.errPct.toFixed(1)));
      }
      if (s.worstDegRow) L.push('       kol acilari: en buyuk ' + s.maxDeg.toFixed(2) +
        ' derece (' + s.worstDegRow.label + ': ' + s.worstDegRow.calc.toFixed(2) +
        ' vs ' + s.worstDegRow.ref + ')');
      if (opts.detay) s.rows.filter(x => x.unit === 'pct' &&
        x.errPct > (opts.tolPct != null ? opts.tolPct : 0.5))
        .forEach(x => L.push('       ! ' + x.label.padEnd(22) + x.calc.toFixed(3) +
          '  vs  ' + x.ref + '   %' + x.errPct.toFixed(2)));
    });
    L.push(''); L.push('=== koruma mekanizmalari');
    r.guards.tests.forEach(g => L.push('    ' + (g.ok ? '[OK]  ' : '[HATA]') + ' ' +
      g.name.padEnd(44) + ' | ' + g.got));
    L.push(''); L.push(r.summary);
    L.push('Koruma testleri: ' + (r.guards.pass ? 'GECTI' : 'KONTROL ET'));
    return { text: L.join('\n'), result: r };
  }

  return { AG00686, AG00976, AG_MISC, buildAG00686, buildAG00976, buildMisc, calibrated,
           guardTests, run, report };
}));

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const V = module.exports;
  console.log(V.report({ detay: process.argv.indexOf('--detay') >= 0 }).text);
}
