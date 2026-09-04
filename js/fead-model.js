// ============================================================================
//  FEAD VERİ MODELİ — TOPOLOJİ → HESAP ÇEKİRDEĞİ KÖPRÜSÜ
// ============================================================================
// Saf (DOM'suz) katman: kanvastaki düğüm + bağlantıları `FEADCore.makeSystem()`
// girdisine çevirir. Paneller (js/cp-fead.js) yalnız bu dosyayı çağırır;
// çekirdeğin sözleşmesini bilen tek yer burasıdır.
//
// NEDEN AYRI DOSYA: çekirdek (js/fead-core.js) dışarıdan geldi ve BİREBİR
// duruyor — Gates raporlarıyla doğrulanmış hâli o. Panellerin ondan istediği
// şekil ile kullanıcının kanvasta kurduğu şekil AYNI DEĞİL; dönüşümü panel
// kodunun içine serpiştirmek yerine burada tek yerde ve testlenebilir tutuyoruz.
//
// ─── ÜÇ YAPISAL DÜZELTME (iskeletten farkı) ─────────────────────────────────
//
// 1) SÜRÜCÜLÜK BİR ROL, TİP DEĞİL. İskelette tahrik eden kasnak 'fead-crank'
//    TİPİNE bağlıydı. Ama Gates AG00976'da sürücü kasnak FAN'dır (ikincil
//    tahrik: krank kasnağı o çevrimde yok). Tipe bağlamak o topolojiyi
//    kurulamaz yapar. Artık: node.data.driver === true olan kasnak sürücüdür;
//    hiçbiri işaretlenmemişse tipi isFeadDriver olan, o da yoksa kayış
//    sırasındaki ilk kasnak. Kullanıcı her kasnağı sürücü yapabilir.
//
// 2) TEMAS TARAFI (grooved/back) GERÇEK BİR ALAN. Spesifikasyon bunu
//    "çıkarsanamaz" diye işaretliyor ve nedeni ciddi: ters verilirse çekirdek
//    BAŞKA BİR GEÇERLİ güzergâh hesaplar — kapalı çevrim de sarım değişmezi de
//    TUTAR. Yani sessizce yanlış tasarım. Bu yüzden üç katman: tip varsayılanı
//    (componentDefs.feadContact) → panelde açık aç/kapa → kanvasta rozet.
//
// 3) ÇAP = DIŞ ÇAP (od). Çekirdek OD alıp yarıçapları kendisi türetir:
//      kaburgalı : rPitch = OD/2 + hb      rEff = OD/2
//      sırttan   : rPitch = OD/2 + hr      rEff = OD/2 + hr + hb
//    hb/hr kayış profil+markasından gelir. İskeletteki 'dia' alanı "etkin çap"
//    diyordu ve hangi yarıçap olduğu belirsizdi → 'od' olarak göç ettirildi
//    (veFeadMigrateNode; eski kayıtlar açılınca sessizce dönüşür).
// ----------------------------------------------------------------------------

// ─── Küçük yardımcılar (cp-fead.js de bunları kullanır; load order: bu dosya
//     ÖNCE yüklenir, bkz. index.html) ────────────────────────────────────────
function _feadNum(v, d){
  if(v===undefined||v===null||v==='') return (d===undefined)?0:d;
  var x=(typeof v==='string')?v.trim().replace(',', '.'):v;
  var n=Number(x);
  return Number.isFinite(n)?n:((d===undefined)?0:d);
}
function _feadDefOf(n){
  if(!n) return {};
  if(typeof componentDefs!=='undefined' && componentDefs[n.type]) return componentDefs[n.type];
  return n.def || {};
}
function _feadNodeName(n){ return (n && n.customName) || _feadDefOf(n).name || (n && n.type) || ''; }
function _feadIsPulley(n){ return !!_feadDefOf(n).isFeadPulley; }

// ─── Temas tarafı ───────────────────────────────────────────────────────────
// Öncelik: düğümün kendi değeri → tip varsayılanı → 'grooved'. Tip varsayılanı
// componentDefs'te (feadContact) durur; burada ikinci bir liste tutulmaz ki
// biri sessizce eskimesin.
function veFeadContactOf(node){
  var v = node && node.data && node.data.contact;
  if(v === 'grooved' || v === 'back') return v;
  var d = _feadDefOf(node).feadContact;
  return (d === 'back') ? 'back' : 'grooved';
}
function veFeadContactLabel(c){ return (c === 'back') ? 'Sırttan' : 'Kaburgalı'; }

// ─── Çap ────────────────────────────────────────────────────────────────────
// Girilmemiş çap için tipe göre makul bir varsayılan. Bu varsayılan YALNIZ
// ÖNİZLEME içindir (şema boş veriyle de bir şey göstersin); çözüme giden yolda
// eksik çap UYARI üretir, sessizce doldurulmaz — bkz. veFeadBuildSystem.
var VE_FEAD_DEFAULT_DIA = {
  'fead-crank': 180, 'fead-alternator': 60, 'fead-ac': 120, 'fead-waterpump': 110,
  'fead-ps': 110, 'fead-aircomp': 120, 'fead-fan': 150, 'fead-idler': 70, 'fead-tensioner': 75
};
function veFeadOD(node){
  var d = _feadNum(node && node.data && node.data.od, 0);
  if(d > 0) return d;
  return VE_FEAD_DEFAULT_DIA[node && node.type] || 80;
}
function veFeadHasOD(node){ return _feadNum(node && node.data && node.data.od, 0) > 0; }
// Şema önizlemesi için etkin yarıçap (çekirdek çözülemediğinde kullanılır).
function veFeadRadius(node){ return veFeadOD(node) / 2; }

// ════════════════════════════════════════════════════════════════════════════
//  GATES ARŞİVİNDEN ÖLÇÜLEN VARSAYILANLAR
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı isteği (2026-09-02): *"Atalet momentlerini ben girmedim fakat
// Gates raporlarındaki değerleri default olarak kullanabilirsin. Aynı şekilde
// tolerans/aşınma, load stop, boy ofseti gibi değerleri Gates raporlarından
// default olarak kullanırsın. Çünkü bunları el ile girmek zor."*
//
// ── ÜÇ KURAL, ÜÇÜ DE BU MODÜLÜN SESSİZ HATA SINIFINA KARŞI ─────────────────
// 1. VARSAYILAN DÜĞÜME YAZILMAZ. Yalnız çözüm anında doldurulur; kullanıcının
//    modeli boş kalır. Düğüme yazsaydık "girdim" ile "varsayıldı" bir daha
//    ayrılamazdı ve varsayılan sonraki oturumlarda GİRDİ gibi görünürdü.
// 2. BOŞ İLE SIFIR AYRI. `0` geçerli bir kullanıcı değeridir (tolerans 0 =
//    "zarfı kapat"); yalnız null/undefined/'' varsayılana düşer. `_feadNum(x,0)`
//    ikisini ayırt ETMİYOR — bu yüzden `_feadBlank` var.
// 3. HANGİSİNİN VARSAYILDIĞI SONUCUN İÇİNDE TAŞINIR (`build.defaults`), panelde
//    ve raporda basılır. Modülün 8. kuralı: sayı gizlenmez, sınırı yanında
//    yazılır.
//
// ── SAYILAR NEREDEN ────────────────────────────────────────────────────────
// `tests/fixtures/fead-validation.js` + `docs/gates-reports/pdf/` — yani
// doğrulama kapısının kullandığı AYNI 14 sistem. Uydurma yok; örneklem sayısı
// her satırda yazılı. `tests/unit/fead-defaults.test.js` bu tabloyu kaynağına
// karşı denetliyor, yani buradaki bir sayı arşivden ayrışırsa test kırılır.
var VE_FEAD_DEFAULTS = {
  // AŞINMA + UZAMA PAYI — 14 sistemin 10'unda tam 0,70; kalan dördü 0,59–0,65
  // (AG00976'nın üç revizyonu + AG00810). En büyük ve en sık değer seçildi:
  // sapanların hepsi ALTINDA kaldığı için 0,70 aynı zamanda emniyetli yön.
  wearPct: 0.007,

  // BOY TOLERANSI — arşivde İKİ BASAMAK ve ayrım tam olarak kayış boyunda:
  //   1013 · 1018 · 1020 · 1214 · 1275 · 1302 · 1392 mm → ±5   (7/7)
  //   1475 · 1520 · 1656 · 1667 · 1705 · 1715 · 1739 mm → ±6   (7/7)
  // Basamak 1392 ile 1475 ARASINDA bir yerde; arşiv nereye düştüğünü
  // söylemiyor, 1400 seçildi. 1392–1475 aralığındaki bir kayışta varsayılan
  // ±1 mm yanılabilir — bu yüzden panelde "varsayıldı" damgası var.
  beltTolBreakMm: 1400,
  beltTolShortMm: 5,
  beltTolLongMm: 6,

  // MEKANİK DURDURUCU (load stop) — parçaya özgü ve bu yüzden ÖNCE künye
  // kütüphanesinden okunur (js/fead-tensioners.js → loadStopRelDeg, 12 kayıt
  // ölçüldü). Künye uygulanmamışsa geriye kalan tek yol nominal dönüşle
  // ölçeklemek: arşivde stop/nominal oranı 12 kayıtta 1,44 … 2,15
  // (medyan 1,76 · ortalama 1,80 — ortalama alındı). Kaba bir sayı ama 89°'lik
  // yedeğinden ÇOK daha iyi — 89° gerçek bir gerginin iki katı kadar geniş bir
  // bant açıyor ve Load sütununu tekilliğe kadar sürüyor.
  loadStopFactor: 1.8,

  // BOY OFSETİ — `requiredBeltMm = driveLenMm − lengthOffsetMm`. Fiziksel bir
  // sabit DEĞİL: Gates'in çözdüğü geometrik boy ile SİPARİŞ EDİLEN katalog
  // boyu arasındaki yuvarlama artığı. Ölçülen beş değer 0,4 · 0,7 · 1,6 · 1,9
  // · 2,0 mm (AG00976 ×4 + AG00879) ve aynı sistemin dört revizyonunda bile
  // 0,4 ↔ 2,0 arasında zıplıyor — yani kural YOK, dağılım [0, 2] üstünde
  // hemen hemen düz. Ortalama alındı. Etkisi ±1 mm mertebesinde, yani boy
  // toleransının (±5) beşte biri.
  lengthOffsetMm: 1.3,

  // ATALET MOMENTLERİ [kg·m²] — Gates "System Vibration Analysis" sayfasının
  // Accessory Data satırı; arşivdeki YEDİ raporun tamamı okundu
  // (tests/helpers/gates-vibration.js kaynağından çekiyor). Her tip için
  // MEDYAN alındı; örneklem küçük ve dağılım geniş olduğu için bu bir
  // MERTEBE göstergesidir — burulma modeli zaten kalibre bir modeldir (§9.2).
  inertiaKgM2: {
    'fead-idler':      0.0003,  // 0.0001 · 0.0002 · 0.0004 · 0.0004   (n=4)
    'fead-ac':         0.0034,  // 0.0030 · 0.0034 ×3 · 0.0050 · 0.0060 (n=6)
    'fead-alternator': 0.01125, // 0.0085 · 0.0140                     (n=2)
    'fead-tensioner':  0.0009   // 0.0004 · 0.0006 · 0.0009 ×3 · 0.0076 ×2 (n=7)
  },
  // SÜRÜCÜ KASNAK ayrı: Gates'in Accessory Data satırında krank kasnağı YOK,
  // çünkü o zincirin ucu değil başı. Burulma modeli sürücü düğümünde
  // KRANK MİLİ ataletini bekliyor (doğrulama harness'i de öyle besliyor:
  // `p.crank ? crankInertiaKgM2`). Engine Data satırı: 0,15 ×3 · 0,50 ×3 ·
  // 0,70 ×1 → medyan 0,50.
  crankInertiaKgM2: 0.50,
  // Gergi kolunun kendi ataleti + kasnağın kol ucundaki NOKTA KÜTLESİ.
  // Çekirdek ikisini J = armInertia + pulleyMass·a² olarak birleştiriyor,
  // yani kütle terimi ihmal edilemez (AG0868'de kol ataletinin 7 katı).
  // Arşiv: kol 0,0009 ×3 · 0,0040 · 0,0060 · 0,0076 ×2 → medyan 0,0040
  //        kütle 0,50 ×3 · 0,80 ×4                     → medyan 0,80
  tenArmInertiaKgM2: 0.0040,
  tenPulleyMassKg: 0.80
};

// ATALET VARSAYILANI OLMAYAN TİPLER BİLEREK BOŞ: su pompası, direksiyon
// pompası, hava kompresörü ve aksesuar olarak kullanılan fan kasnağı arşivin
// yedi raporunun HİÇBİRİNDE geçmiyor. Bir aksesuarın ataletini kasnak çapından
// uydurmak bu modülün yasak ettiği türden bir sayı olurdu: rotorun ataleti
// kasnağınkinden bir-iki mertebe büyüktür ve oranı makineye özgüdür. Bu
// tiplerden biri modeldeyse burulma modeli KURULMAZ ve sebebini adıyla yazar.
function veFeadDefaultInertia(type, isDriver){
  if(isDriver) return VE_FEAD_DEFAULTS.crankInertiaKgM2;
  var v = VE_FEAD_DEFAULTS.inertiaKgM2[type];
  return (v > 0) ? v : NaN;
}

// Efektif boya göre tolerans basamağı (yukarıdaki ölçüm).
function veFeadDefaultBeltTol(effLengthMm){
  var L = _feadNum(effLengthMm, NaN);
  if(!Number.isFinite(L) || L <= 0) return VE_FEAD_DEFAULTS.beltTolShortMm;
  return (L < VE_FEAD_DEFAULTS.beltTolBreakMm)
    ? VE_FEAD_DEFAULTS.beltTolShortMm : VE_FEAD_DEFAULTS.beltTolLongMm;
}

// "Alan boş mu" — `0` BOŞ DEĞİLDİR. Bütün varsayılan kapıları bundan geçer.
function _feadBlank(v){ return v === undefined || v === null || v === ''; }

// ─── Eski kayıt göçü: data.dia → data.od ────────────────────────────────────
// Aşama 0'daki iskelet 'dia' yazıyordu. Kayıtlı projeler açılınca sessizce
// dönüşür; 'od' zaten varsa dokunulmaz (kullanıcının yeni değeri kazanır).
// Döner: göç uygulandı mı.
function veFeadMigrateNode(node){
  if(!node || !node.data) return false;
  var d = false;
  // Gergi: eski yazımlar → tek koordinat (AVARA MERKEZİ). Bkz.
  // veFeadMigrateTensioner. Tip denetimi `_feadDefOf` ile değil ALANLA
  // yapılıyor: göç, düğüm tanımları yüklenmeden de (saf Node yolu) koşuyor.
  // `cenX/cenY` TETİKLEYİCİ DEĞİL — o zaten bugünkü biçim; tetikleyici, artık
  // bulunmaması gereken alanlardır.
  if(node.data.pivotX !== undefined || node.data.pivotY !== undefined
     || node.data.angleMode !== undefined || node.data.freeAngleDeg !== undefined
     || node.data.verifyCenX !== undefined || node.data.verifyCenY !== undefined
     || node.data.armPinned !== undefined || node.data.armAuto !== undefined)
    d = veFeadMigrateTensioner(node.data) || d;
  if(node.data.dia === undefined) return d;
  if(node.data.od === undefined || node.data.od === null || node.data.od === '') {
    node.data.od = node.data.dia;
  }
  delete node.data.dia;
  return true;
}
function veFeadMigrateAll(nodeList){
  var n = 0;
  (nodeList || []).forEach(function(x){ if(veFeadMigrateNode(x)) n++; });
  return n;
}

// ── GERGİNİN İKİ NOKTASI — hangi yüzey hangisini okur ──────────────────────
//
// Gergi bileşeninin kayış düzleminde İKİ noktası var ve karıştırılmaları bu
// modülün en pahalı hata sınıfı. YÖN ÇEVRİLİNCE BEDELİ BÜYÜDÜ ve ÖLÇÜLDÜ
// (14 Gates sistemi, montaj konumu merkez alanına yazılırsa):
//     14/14 sistem yine ÇÖZÜLÜYOR · gerginlik sapması medyan +%1526,
//     en kötü +%4518 · ve 5/14 sistemde HİÇBİR geometri ihlali çıkmıyor.
// Eski yönde aynı karışıklık −%48,6 veriyordu ve 9/14 sistemde modeli
// durduruyordu. Yani sayı artık daha gürültülü ama uyarı daha SESSİZ —
// teşhis yüzeyi (türeyen montaj konumu okuması) bu yüzden zorunlu:
//
//   AVARA MERKEZİ   kolun ucundaki kasnağın merkezi — TEK GİRDİ. Kullanıcının
//                   girdiği koordinat budur ve tedarikçiye giden FEAD bilgi
//                   sayfası bütün kasnaklar için AYNI sütunda tam olarak bunu
//                   veriyor (BMC: −170,080 / 99,160).
//   MONTAJ KONUMU   gövdenin motora bağlandığı nokta = kolun dönme ekseni —
//                   bir ÇIKTI. Avara merkezinden ve kolun çalışma açısından
//                   türer: p = c − a·(cos θ, sin θ).
//
// YÖN TERSİNE ÇEVRİLDİ (2026-09-01, kullanıcı kararı): *"biz otomatik gergi
// için normalde 'otomatik gerginin montaj noktasını' veriyorduk. Bu daha
// mantıklı oluyordu fakat şimdi 'otomatik gergi avarasının orta noktasını'
// vereceğiz."* Karşılaştırma YOK, doğrulama YOK — tek girdi, tek anlam.
//
// ÇEVİRME CEBİRSEL OLARAK TAM — ÖLÇÜLDÜ (14 Gates sistemi): merkez + kol
// açısından pivotu geri üretip sistemi yeniden kurunca
//   |Δp| ≤ 4,263e−14 mm · ΔL_eff ≤ 1,137e−13 mm · ΔT ≤ 1,494e−13 % ·
//   Δsarım ≤ 5,684e−14°
// Yani yön değişikliği bir yaklaşıklık değil, aynı denklemin öteki yüzü.
//
// İKİ OKUYUCU AYRI ve birleştirilemez: kanvas KUTUSU avara merkezini gösteriyor
// (sürükleme de onu yazıyor), gerginin YAY DENGESİ ise pivotu istiyor. Tek
// fonksiyona indirgemek birini kol boyu kadar kaymış bir noktadan okumak olurdu.

// Gergi KUTUSUNUN gösterdiği mm noktası — AVARA MERKEZİ. Tek kural, tek yer.
// Okunamıyorsa null; UYDURULMAZ.
function veFeadTensionerBoxMm(td){
  if(!td) return null;
  var cx = _feadNum(td.cenX, NaN), cy = _feadNum(td.cenY, NaN);
  return (Number.isFinite(cx) && Number.isFinite(cy)) ? [cx, cy] : null;
}

// Gergi GÖVDESİNİN montaj konumu (= kolun dönme ekseni) — bir GİRDİ DEĞİL,
// avara merkezinden ve kolun çalışma açısından TÜREYEN bir sonuç:
//
//     p = c − a·(cos θ_çalışma , sin θ_çalışma)
//
// Atölyeye giden sayı budur (gövde cıvatasının/boss'un yeri). Girdi olarak
// SORULMAZ: sorulsaydı aynı büyüklüğü iki yoldan isteyip aralarında bir
// karşılaştırma doğardı — kullanıcının açıkça kaldırttığı şey.
//
// EŞMERKEZLİLİK ÖLÇÜLDÜ (E9843 parça çizimi, 2026-08-29): gövdenin merkezî
// bağlantı deliği kolun dönme ekseniyle eşmerkezli. Eksantrik gövdeli bir
// gergide ikisi ayrılırdı; bugün elde öyle bir parça YOK.
// ── KOL AÇISININ GÖSTERİM DİLİ — TEK ÜRETİCİ ──────────────────────────────
//
// Kullanıcı bildirimi (2026-09-01): *"'Otomatik gergi kol açısı' kısmının açı
// koordinat tanımı genel programda gösterilen ufak açı koordinat tanımlarından
// farklı… 0 ekseni parçanın solunda kalıyor. Mutlak değil, nispi bir açı
// değeri tanımı olsun."*
//
// İKİ AYRI ŞEY VARDI ve karışıyorlardı:
//
//   SAKLANAN  `armMeanDeg` = kolun yönü, **pivottan avara merkezine** bakarak,
//             0–360 mutlak (Gates çizimi böyle yazıyor: "344° MEAN ANGLE").
//             Çekirdek, rapor ve doğrulama kümesi buna dayanıyor — DEĞİŞMEDİ.
//   GÖSTERİLEN Kullanıcının ekranda gördüğü şey ise ters yön: elinde avara
//             MERKEZİ var (onu 2. adımda girdi) ve pivotun ona göre NEREDE
//             olduğunu seçiyor. Yani merkezden pivota, yani `θ + 180`.
//
// Mutlak 344° bu yüzden "parçanın solunda bir sıfır ekseni" gibi okunuyordu:
// çizilen ok pivottan çıkıyordu, oysa kullanıcı merkeze bakıyor.
//
// GÖSTERİM İŞARETLİ ve (−180, +180] aralığında — programın yön gülüyle aynı
// dil (0 = +X, CCW artı) ve 344 yerine −16 okunuyor. Aralık seçimi kozmetik
// değil: 0–360'ta küçük bir negatif dönme 359 gibi görünür ve kullanıcı
// "neredeyse tam tur" sanır.
//
// İKİ FONKSİYON DA TEK YERDE, çünkü sihirbaz da panel de aynı alanı yazıyor;
// ikinci bir çevirici iki yüzeyin sessizce ayrışması demekti.
function veFeadWrap180(deg){
  var d = _feadNum(deg, NaN);
  if(!Number.isFinite(d)) return NaN;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return (d === -180) ? 180 : d;
}
// SAKLANAN → GÖSTERİLEN (merkezden pivota, işaretli)
function veFeadArmShownDeg(armMeanDeg){
  var d = _feadNum(armMeanDeg, NaN);
  return Number.isFinite(d) ? veFeadWrap180(d + 180) : NaN;
}
// GÖSTERİLEN → SAKLANAN (pivottan merkeze, 0–360)
function veFeadArmFromShown(shownDeg){
  var d = _feadNum(shownDeg, NaN);
  if(!Number.isFinite(d)) return NaN;
  var a = (d + 180) % 360;
  return (a < 0) ? a + 360 : a;
}

function veFeadTensionerPivot(td){
  if(!td) return null;
  var cx = _feadNum(td.cenX, NaN), cy = _feadNum(td.cenY, NaN);
  var a = _feadNum(td.armLen, NaN);
  var th = _feadNum(td.armMeanDeg, NaN);
  if(!Number.isFinite(cx) || !Number.isFinite(cy) || !(a > 0) || !Number.isFinite(th))
    return null;
  var r = th * Math.PI / 180;
  return [cx - a * Math.cos(r), cy - a * Math.sin(r)];
}

// Gergi AVARASININ merkezi. Çalışma (nominal) açısında bu doğrudan GİRDİNİN
// kendisidir; başka bir kol açısı sorulursa pivot türetilip oradan dönülür.
//
//   c(θ) = p + a·(cos θ, sin θ),   p = c_girdi − a·(cos θ_çalışma, sin θ_çalışma)
//
// Çalışma açısı YUVARLAK DÖNÜLÜR (girdi birebir), türetip geri dönmez: aradaki
// ~1e−14'lük kayan nokta artığı hiçbir şeyi değiştirmez ama "girilen sayı
// çıkmıyor" diye okunacak bir fark bırakırdı.
//
// Kutu okuyucusuyla birleştirilemez (bkz. yukarıdaki not).
function veFeadTensionerCenter(td, absDeg){
  if(!td) return null;
  var cx = _feadNum(td.cenX, NaN), cy = _feadNum(td.cenY, NaN);
  if(!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  var th = _feadNum(absDeg, NaN);
  var thMean = _feadNum(td.armMeanDeg, NaN);
  if(!Number.isFinite(th) || (Number.isFinite(thMean) && Math.abs(th - thMean) < 1e-9))
    return [cx, cy];
  var p = veFeadTensionerPivot(td);
  var a = _feadNum(td.armLen, NaN);
  if(!p || !(a > 0)) return [cx, cy];
  var r = th * Math.PI / 180;
  return [p[0] + a * Math.cos(r), p[1] + a * Math.sin(r)];
}

// ═══════════════════════════════════════════════════════════════════════════
//  YAY KURULMASI — GEOMETRİYE HİÇ BAKMAZ
// ═══════════════════════════════════════════════════════════════════════════
//
// rel_mean: kol, yay ÇALIŞMA momentine kadar kaç derece kurulmuş.
//     rel_mean = (M_mean − M₀) / k
// Üç sayı da SALT YAY KÜNYESİNDEN gelir; avara merkezi, kol boyu ve kayış
// yolu bu hesaba HİÇ girmez. Bu ayrım özelliğin şartı: kayış boyu bir ÇIKTI
// ve kolun oturduğu yeri bu sayı belirliyor — geometriye bağlansaydı döngü
// kurulurdu.
//
// ESKİDEN BU FONKSİYON İKİ İŞ YAPIYORDU (`veFeadTensionerMount`): yay
// kurulmasını hesaplamak VE gergi kasnağının girilen montaj merkezi ile
// pivot arasındaki geometriyi çözmek. İkincisi kullanıcı kararıyla kalktı —
// gergide TEK koordinat var (montaj konumu) ve karşılaştırılacak ikinci bir
// nokta yok. Kalan iş yalnız yay künyesi.
// ═══════════════════════════════════════════════════════════════════════════
//  TEK KOORDİNAT — ESKİ KAYITLARIN GÖÇÜ (`veFeadMigrateTensioner`)
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı kararı (2026-08-29): *"Herhangi bir doğrulama gibi bir olay söz
// konusu değil."* — gergide TEK koordinat var ve karşılaştırılacak ikinci bir
// nokta yok. Kararı (2026-09-01) o tek koordinatın HANGİSİ olduğunu değiştirdi:
// artık AVARA MERKEZİ (`cenX/cenY`), montaj konumu değil.
//
// GEÇMİŞTE ÜÇ AYRI YAZIM DOLAŞTI ve göç üçünü de tek biçime indiriyor:
//
//   ① `cenX/cenY` (+ `angleMode:'mount'`)   → BUGÜNKÜ BİÇİMİN KENDİSİ.
//      2026-08-29 öncesindeki her kayıt böyleydi; alan olduğu gibi kalıyor.
//   ② `pivotX/pivotY` + `armMeanDeg`        → 2026-08-28…09-01 arası zarf
//      kipi. Merkez TÜRETİLİR: c = p + a·(cos θ, sin θ).
//   ③ yalnız `freeAngleDeg`                 → kalkmış "serbest açı" kipi.
//      Çevrilecek koordinat YOK; model çözülmez ve sebebini adıyla yazar.
//
// İKİSİ BİRDEN VARSA MERKEZ KAZANIR — çünkü girdi odur. Elle düzenlenmiş bir
// dosya ikisini birden taşıyabilir; pivotu kazandırmak kullanıcının girdiği
// sayıyı sessizce yok saymak olurdu.
//
// ESKİ ALANLAR SİLİNİR. Bırakılsalardı panelde hiç sorulmayan, hiçbir yüzeyin
// okumadığı ama koda sızabilen ölü alanlar kalırdı — ve tam oradan "montaj
// konumunu avara merkezi say" yedeği doğardı; ölçülmüş bedeli gerginlikte
// medyan +%1526 (5/14 sistemde hiçbir uyarı çıkmadan).
//
// `armPinned` / `armAuto` DA SİLİNİR: kol çalışma açısı artık her zaman bir
// GİRDİ, seçilen bir şey değil. "Sabitlendi mi" sorusunun karşılığı kalmadı.
//
// ÖLÇÜLDÜ (② → ①, iki örnek): türetilen merkez belgenin kendi koordinatına
// BMC'de 0,0036 mm, AG00976'da 0,0035 mm uzakta — yani iki belgenin (giden
// bilgi sayfası ↔ dönen Gates raporu) yazdığı iki nokta gerçekten aynı kolun
// iki ucu. Çözüm birebir korunuyor: ΔL ≤ 0,0025 mm, ΔT ≤ %0,0083.
function veFeadMigrateTensioner(td){
  if(!td) return false;
  var degisti = false;
  var cx = _feadNum(td.cenX, NaN),   cy = _feadNum(td.cenY, NaN);
  var px = _feadNum(td.pivotX, NaN), py = _feadNum(td.pivotY, NaN);

  // Avara merkezi yoksa eski montaj konumundan çıkar (bir kez).
  if((!Number.isFinite(cx) || !Number.isFinite(cy))
     && Number.isFinite(px) && Number.isFinite(py)){
    var a = _feadNum(td.armLen, NaN), th = _feadNum(td.armMeanDeg, NaN);
    if(a > 0 && Number.isFinite(th)){
      var r = th * Math.PI / 180;
      td.cenX = Math.round((px + a * Math.cos(r)) * 1000) / 1000;
      td.cenY = Math.round((py + a * Math.sin(r)) * 1000) / 1000;
      degisti = true;
    }
  }
  // MONTAJ KONUMU TÜRETİLEMESE BİLE SİLİNİR (bkz. yukarıdaki gerekçe).
  ['pivotX', 'pivotY', 'angleMode', 'freeAngleDeg', 'verifyCenX', 'verifyCenY',
   'armPinned', 'armAuto'].forEach(function(k){
    if(td[k] !== undefined){ delete td[k]; degisti = true; }
  });
  return degisti;
}

function veFeadSpringSetup(td){
  td = td || {};
  var out = { relMeanDeg: NaN, notes: [] };
  var pre = _feadNum(td.preload, NaN), rate = _feadNum(td.kArm, NaN),
      mean = _feadNum(td.meanLoad, NaN);
  if(Number.isFinite(pre) && Number.isFinite(mean) && Number.isFinite(rate) && rate > 0){
    out.relMeanDeg = (mean - pre) / rate;
    if(out.relMeanDeg < 0)
      out.notes.push('Yay çalışma momenti ön yükten KÜÇÜK (' + mean + ' < ' + pre
        + ' Nm); kol serbest konumun ters yanında kalır.');
  }
  return out;
}

// Tasarım gerginliği ↔ yay dengesi uyuşmazlık eşiği. %2: Gates raporlarında iki
// değer yuvarlama farkıyla (765.7 ↔ 766) tutuyor, o gürültüyü uyarıya çevirmez.
var VE_FEAD_TENSION_TOL = 0.02;


// ─── KAYIŞ BOYU: SEÇİLMİŞ mi, TASARIMDAN ÇIKAN mı? ──────────────────────────
//
// İki ayrı mühendislik sorusu, TEK serbestlik derecesi. Gergi kolunun oturduğu
// açı ile kayış boyu birbirini belirliyor; hangisinin GİRDİ olduğunu seçmek
// zorundayız:
//
//   'fixed'  Kayış zaten seçilmiş (katalogdan bir boy). Kol, kayış yolunu O
//            BOYA eşitleyen açıya oturur; gerginlik oradan ÇIKAR.
//              rel = solveArmForBeltLength(effLength)
//
//   'free'   Kayış henüz seçilmemiş — tasarım yapılıyor, kayış sonra tedarik
//            edilecek. Kol, gerginin NOMİNAL YAY YÜKÜNÜN açısına oturur;
//            GEREKEN KAYIŞ BOYU oradan ÇIKAR.
//              rel        = (M_mean − M₀) / k            ← salt yay künyesi
//              effLength := requiredBeltMm(rel)          ← ÇIKTI, girdi değil
//
//            ANKRAJ NEDEN GERGİNLİK DEĞİL: tasarım gerginliği artık bir girdi
//            değil, yay dengesinden TÜRÜYOR (bkz. "ANKRAJ TÜRETİLİYOR").
//            Serbest kip onu hedef alsaydı döngü kurulurdu — gerginlik açıdan
//            çıkıyor, açı gerginlikten. Nominal yay yükü ise geometriye HİÇ
//            bakmıyor: tedarikçi sayfasındaki "Spring Mean Load" (BMC: 22.07 Nm)
//            ve yay künyesi (M₀, k) yeter. Fizik de bunu söylüyor: gergi kolu
//            yayı nominal momentine kurulmuş halde çalışsın diye seçilir,
//            kayış boyu da onu oraya oturtan boydur.
//
//            ÖLÇÜLDÜ (BMC): rel_nominal = (22.07 − 8.60)/0.480 = 28.06°;
//            katalog kayışı 1715 mm ile çözülen açı 28.51°. Aradaki 0.45°,
//            1715'in YUVARLANMIŞ bir katalog boyu olmasından — serbest kip
//            "gereken boy" der, sabit kip "elimdeki boyla nerede oturur" der.
//
// SERBEST KİP "ÇÖZÜLEMEZ" BÖLGEYİ YAPISAL OLARAK KALDIRIYOR. Sabit kipte hedef
// (kayış boyu) kolun erişebildiği aralığın DIŞINA düşebiliyor ve bu geometrik
// bir sorun DEĞİL — ÖLÇÜLDÜ (BMC): alternatörü 10 mm kaydırmak yetiyor; kol
// 0..64.5° arasında 1711.3..1684.4 mm üretiyor, istenen 1715 mm ise 3.7 mm
// YUKARIDA kalıyor. Geometri o noktada kusursuz çözülüyor (Σsarım = 360.00°,
// altı span da geçerli); çöken tek şey "bu kayış bu düzene sığar mı" sorusu.
// Serbest kipte böyle bir hedef yok, dolayısıyla böyle bir duvar da yok.
//
// GERİYE DÖNÜK: kip yazılı değilse effLength'i olan proje 'fixed' sayılır —
// bugüne kadar kaydedilmiş her proje birebir eski davranışını korur.
var VE_FEAD_BELT_MODES = ['fixed', 'free'];

// ═══════════════════════════════════════════════════════════════════════════
//  KAYIŞ TİPİNE BAĞLI ÇIKTILAR — ayrı bir anahtar
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-08-28): *"'kayış boyu' kullanılarak yapılan
// hesaplamalar, diyagramlar vb şeyler, yani 'kayış tipi' özelinde gelen profil
// sabitleri ile hesaplanan şeyler olmayacak. ŞİMDİLİK. İlerleyen zamanlarda
// BELKİ kayış tipi sabit kabul ederek bir hesaplama yapabiliriz."*
//
// Zarf kipinde kayış boyu bir ÇIKTI, yani tasarım aşamasında kayış HENÜZ
// SEÇİLMEMİŞTİR. O aşamada kayış katalogundan gelen sabitlerle hesap yapmak,
// olmayan bir seçimi varsaymak olurdu — ve bu modülde en pahalı hata sınıfı
// "makul ama yanlış" sayıdır: tablolar dolu görünür, hüküm verilir, okuyucu
// neyin varsayıldığını bilmez.
//
// ── HANGİ ÇIKTI NEYE BAĞLI (tek tek ölçüldü) ────────────────────────────────
//
// | çıktı                        | kayış katalogundan gelen |
// |------------------------------|--------------------------|
// | B10 kayış ömrü               | effLength · massPerRibKgM×ribs · yorulma sabitleri |
// | Kaburga yorulma dağılımı     | yorulma sabitleri (PK-2_2p-MT3 / PK-2_2a-MT3) |
// | Açıklık doğal frekansları    | birim kütle (massPerRibKgM × ribs) |
// | Çırpınma (flutter) hükmü     | aynı birim kütle |
// | Konum tablosu zarfı          | tolerance · wearPct |
//
// ── KAPATILAMAYAN TEK ŞEY: hb / hr ──────────────────────────────────────────
// Pitch yarıçapı `OD/2 + hb` (kaburgalı) ya da `OD/2 + hr` (sırttan); ikisi de
// profil sabiti. PK'da hb = 1.2 mm, yani merkez mesafelerinde 2.4 mm'lik bir
// fark. Bunlar olmadan TEĞET GEOMETRİSİ YOKTUR — kapatmak "kayışsız kayış
// tahriki" demek olurdu. Panel bunu açıkça yazıyor: profil hâlâ soruluyor,
// kapatılan şey profilin KATALOG SABİTLERİNE dayanan sonuçlar.
//
// VARSAYILAN VERİDEN ÇÖZÜLÜR: zarf kipinde 'none' (kayış henüz seçilmedi),
// diğer kiplerde 'full' (bugüne kadarki davranış birebir). Kullanıcının açık
// seçimi her ikisini de ezer.
var VE_FEAD_BELT_DATA_MODES = ['full', 'none'];

function veFeadBeltDataMode(beltData){
  var m = beltData && beltData.beltDataMode;
  if(m === 'full' || m === 'none') return m;
  return 'none';                       // kayış boyu bir SONUÇ → katalog kapalı
}

// Kapatılan çıktıların listesi — panel ve rapor bunu SEBEBİYLE basıyor.
// "Sessizce yok" ile "bilerek kapalı" arasında dağlar kadar fark var.
var VE_FEAD_BELT_DATA_OFF = [
  'B10 kayış ömrü',
  'Kaburga yorulma dağılımı',
  'Açıklık doğal frekansları ve çırpınma hükmü',
  'Kol konum tablosunun tolerans/aşınma zarfı'
];

// KAYIŞ KİPİ ZARF KİPİNDE KİLİTLİ. Gergi 'envelope' kipindeyken kayış boyu
// yapısal olarak bir ÇIKTIDIR (bkz. veFeadBuildSystem), yani kayış düğümünün
// kendi `lengthMode` alanı hükümsüz kalıyor. Panel ve kanvas rozeti bunu bilmek
// ZORUNDA: bilmezlerse panel "SABİT" derken çözücü serbest koşar — bu modülün
// tekrar eden hata sınıfı (panel ile kart AYNI alanı okumalı).
function veFeadBeltModeLocked(nodeList){
  var list = Array.isArray(nodeList) ? nodeList
           : ((typeof nodes !== 'undefined' && Array.isArray(nodes)) ? nodes : []);
  for(var i = 0; i < list.length; i++){
    var n = list[i];
    if(n && _feadDefOf(n).isFeadTensioner) return true;
  }
  return false;
}

function veFeadBeltMode(bd){
  var m = bd && bd.lengthMode;
  if(m === 'free' || m === 'fixed') return m;
  var L = _feadNum(bd && (bd.effLength != null ? bd.effLength : bd.length), 0);
  return (L > 0) ? 'fixed' : 'free';
}

// Kenetlenen kol çözümü — HİÇBİR ZAMAN ATMAZ.
//
// FEADCore.bisect kök kuşatılmamışsa açık hata veriyor ve bu DOĞRU bir çekirdek
// davranışı: sessizce uç nokta döndürmek "makul ama yanlış" bir cevap üretirdi
// (çekirdeğin kendi notu: "v1'de bu kontrol yoktu"). Ama kasnak konumu
// kanvastan sürükleniyorsa kullanıcı çözüm uzayının içine DIŞARIDAN giriyor;
// her ara karede istisna "model çözülemez" demek olur.
//
// Sarmalayıcı ayrımı koruyor: hedef kuşatılmışsa ÇEKİRDEĞİN KENDİ çözümü döner
// (birebir aynı, toleransı dahil); kuşatılmamışsa en yakın uca kenetlenir ve
// NEDEN kenetlendiği yapısal olarak taşınır. Yani cevap "çözülemedi" değil,
// "şu sınırda, hedeften şu kadar uzakta" oluyor.
function veFeadSolveArmClamped(sys, kind, target){
  var out = { ok:false, relDeg:0, atLimit:null, error:null };
  if(typeof FEADCore === 'undefined' || !sys){
    out.error = 'Hesap çekirdeği yüklenmedi (js/fead-core.js).'; return out;
  }
  if(!Number.isFinite(target)){
    out.error = (kind === 'tension') ? 'Tasarım gerginliği çözülemedi.'
              : (kind === 'arm')     ? 'Gergi kolunun nominal açısı çözülemedi.'
                                     : 'Kayış efektif boyu girilmedi (Kayış Özellikleri panelinde).';
    return out;
  }
  var isT = (kind === 'tension'), isArm = (kind === 'arm');
  var lo = isT ? 1e-6 : 0, hi;
  try { hi = FEADCore.feasibleRelMax(sys); }
  catch(e){ out.error = veFeadTranslateError(e && e.message); return out; }

  // 'arm' türünde hedefin KENDİSİ bir kol açısı; f birim fonksiyon. Ayrı bir
  // yol yazmak yerine aynı kenetleme disiplininden geçiriyoruz ki "erişilebilir
  // aralık" ve atLimit künyesi tek yerden üretilsin.
  var f = function(r){
    if(isArm) return r;
    var st = FEADCore.tensionerState(sys, r);
    return isT ? st.tensionN : st.requiredBeltMm;
  };
  var flo, fhi;
  try { flo = f(lo); fhi = f(hi); }
  catch(e){ out.error = veFeadTranslateError(e && e.message); return out; }
  if(!Number.isFinite(flo) || !Number.isFinite(fhi)){
    out.error = 'Kolun uç konumlarında çözüm tanımsız.'; return out;
  }

  if((flo - target) * (fhi - target) <= 0){
    try {
      out.relDeg = isArm ? target
                 : isT ? FEADCore.solveArmForTension(sys, target, { hi: hi })
                       : FEADCore.solveArmForBeltLength(sys, target, { hi: hi });
      out.ok = true;
      return out;
    } catch(e){ /* sayısal uç durum — aşağıdaki kenetlemeye düş */ }
  }

  var dLo = Math.abs(flo - target), dHi = Math.abs(fhi - target);
  var low = (dLo <= dHi);
  out.relDeg = low ? lo : hi;
  out.ok = true;
  out.atLimit = {
    kind: kind, target: target, achieved: low ? flo : fhi,
    side: low ? 'free' : 'stop',
    shortfall: (low ? flo : fhi) - target,
    rangeMin: Math.min(flo, fhi), rangeMax: Math.max(flo, fhi),
    relMaxDeg: hi
  };

  // KOLUN UÇ KONUMU TAKE-UP TEKİLLİĞİNE KOMŞU. T = M / (dL/dθ) olduğu için
  // sarım sıfıra yaklaşırken gerginlik patlıyor — ÖLÇÜLDÜ: ters temas tarafı
  // verilmiş BMC'de kenetlenen konumda 3.2e10 N. Sayı modelin kendi cevabı
  // ama FİZİKSEL DEĞİL; öyle işaretlenmezse gerilme, hubload ve ömür
  // tablolarına anlamsız değerler olarak sızar ve kullanıcı onları okur.
  try {
    var stL = FEADCore.tensionerState(sys, out.relDeg);
    var stRef = FEADCore.tensionerState(sys, 0);
    out.atLimit.wrapDeg = stL.wrapDeg;
    out.atLimit.takeupMmPerDeg = stL.takeupMmPerDeg;
    out.atLimit.tensionN = stL.tensionN;
    var ref = Math.abs(stRef.takeupMmPerDeg);
    out.atLimit.takeupRatio = ref > 0 ? Math.abs(stL.takeupMmPerDeg) / ref : 0;
    out.atLimit.degenerate = !(out.atLimit.takeupRatio > VE_FEAD_MIN_TAKEUP_RATIO);
  } catch(e){ out.atLimit.degenerate = true; }
  return out;
}

// ÖLÇÜT TAKE-UP, SARIM DEĞİL — ölçülerek düzeltildi.
//
// İlk sürüm "sarım 2°'nin altındaysa dejenere" diyordu ve YANLIŞTI: ters temas
// tarafı verilmiş BMC'de kenetlenme noktasında sarım 360.00° (kocaman) ama
// take-up 1.7e-8 mm/° — kol yönü bileşke kuvvetle hizalanmış, yani kolu
// döndürmek kayış boyunu DEĞİŞTİRMİYOR. Tekilliğin kaynağı sin(β), sarım değil.
//
// T = M / (dL/dθ) olduğu için tekilleşen büyüklük doğrudan take-up'ın kendisi:
// orada gerginlik 3.2e10 N çıkıyor. Ölçüt SERBEST KOL konumundaki take-up'a
// GÖRE, mutlak bir sayıya göre değil — mutlak eşik tasarımdan tasarıma kayardı.
// %2: ölçülen dejenere oran 1.6e-8, sağlıklı konumlarda oran 1'e yakın.
var VE_FEAD_MIN_TAKEUP_RATIO = 0.02;

// Kenetlenme sebebini kullanıcının dilinde yaz. Sayı gizlenmiyor: kullanıcı
// "ne kadar uzakta" olduğunu görmeden düzeltemez.
function veFeadAtLimitText(al){
  if(!al) return '';
  var f1 = function(x){ return (Math.round(x * 10) / 10).toFixed(1); };
  if(al.kind === 'arm'){
    return 'Gerginin nominal çalışma açısı (' + f1(al.target) + '°) bu yerleşimde '
      + 'kolun erişebildiği aralığın dışında (0…' + f1(al.rangeMax) + '°). '
      + 'Kol ' + f1(al.achieved) + '° konumuna kenetlendi ve gereken kayış boyu '
      + 'oradan hesaplandı. Gergi künyesi (ön yük, yay katsayısı, çalışma '
      + 'momenti) ya da kasnak yerleşimi bu gergiyle uyumlu değil.';
  }
  if(al.kind === 'belt'){
    var fazla = al.target - al.achieved;
    return 'Seçilen kayış (' + f1(al.target) + ' mm) bu yerleşime '
      + f1(Math.abs(fazla)) + ' mm ' + (fazla > 0 ? 'UZUN' : 'KISA')
      + '. Gergi kolunun tüm gezinme aralığı (0…' + f1(al.relMaxDeg) + '°) '
      + f1(al.rangeMin) + '…' + f1(al.rangeMax) + ' mm karşılıyor. '
      + (al.resolvedAt === 'nominalArm'
          ? 'Çalışma noktası, gerginin nominal kol açısına alındı; '
            + 'bu yerleşim için gereken kayış ' + f1(al.suggestedBeltMm) + ' mm. '
            + 'Kayış boyunu SERBEST bırakırsanız bu değer doğrudan hesaplanır.'
          : 'Kol ' + (al.side === 'free' ? 'serbest' : 'yük stopu') + ' konumuna '
      + 'kenetlendi. ' + (al.degenerate
          ? 'O konumda kolun take-up etkisi sıfıra iniyor (serbest konumun '
            + 'yalnız %' + (100 * (al.takeupRatio || 0)).toPrecision(2) + '\u2019i), '
            + 'yani gerginlik ve hubload sayıları FİZİKSEL DEĞİL. Bu kayış bu '
            + 'yerleşime takılamaz. '
          : 'Gerilmeler o konumdan hesaplandı. ')
      + 'Kayış boyunu değiştirin ya da kayış boyunu SERBEST bırakın.');
  }
  return 'Tasarım gerginliği (' + f1(al.target) + ' N) bu yerleşimde kol boyunca '
    + 'erişilemiyor; aralık ' + f1(al.rangeMin) + '…' + f1(al.rangeMax) + ' N '
    + '(kol 0…' + f1(al.relMaxDeg) + '°). Kol ' + f1(al.achieved) + ' N veren '
    + (al.side === 'free' ? 'serbest' : 'uç') + ' konuma kenetlendi. '
    + 'Yay künyesi ya da kasnak yerleşimi bu gerginliği desteklemiyor.';
}

// Geometri ihlalini kullanıcının dilinde yaz (çekirdeğin hoşgörülü kipi).
function veFeadViolationText(v){
  if(!v) return '';
  if(v.type === 'wrapSum')
    return 'Kayış yolu KAPANMIYOR: işaretli sarım toplamı '
      + v.signedWrapDeg.toFixed(2) + '° (360° olmalı, fark '
      + v.deltaDeg.toFixed(2) + '°). Sayılar hesaplandı ama bu YOL geçersiz — '
      + 'kasnak sırası kayışın gidiş yönünde mi, temas tarafları doğru mu?';
  if(v.type === 'clearance')
    return 'Kayış bir kasnağın İÇİNDEN geçiyor: '
      + (v.items || []).map(function(c){
          return c.span + ' spanı ' + c.pulley + ' kasnağını '
            + (-c.clearanceMm).toFixed(1) + ' mm kesiyor'; }).join('; ')
      + '. Sayılar hesaplandı ama bu yerleşim fiziksel değil.';
  return v.message || '';
}

// Kayışın ÇALIŞMA NOKTASI — kipten bağımsız tek giriş noktası.
// Döndürdüğü relDeg her zaman geçerlidir (kenetlenmiş olabilir), effLengthMm
// serbest kipte TÜRETİLMİŞTİR.
function veFeadWorkingPoint(sys, mode, nominalRelDeg){
  var out = { mode: mode, relDeg: NaN, effLengthMm: NaN, derived: false,
              atLimit: null, error: null, nominalRelDeg: nominalRelDeg,
              nominalFallback: false };
  if(mode === 'free'){
    var hedef = _feadNum(nominalRelDeg, NaN);
    // Gergi künyesinde çalışma momenti YOKSA nominal açı türetilemez. O zaman
    // kolun gezinme aralığının ORTASI seçiliyor — otomatik gerginin tasarım
    // kuralı da budur (iki yöne de pay kalsın: kayış uzadıkça kol kapanır,
    // aşındıkça açılır). Uydurma bir sayı değil ama TÜRETİLMİŞ de değil:
    // aşağıda ayrıca işaretleniyor ki kullanıcı künyeyi tamamlasın.
    if(!Number.isFinite(hedef)){
      try { hedef = FEADCore.feasibleRelMax(sys) / 2; out.nominalFallback = true; }
      catch(e){ out.error = veFeadTranslateError(e && e.message); return out; }
    }
    var r = veFeadSolveArmClamped(sys, 'arm', hedef);
    if(!r.ok){ out.error = r.error; return out; }
    out.relDeg = r.relDeg; out.atLimit = r.atLimit; out.derived = true;
    try { out.effLengthMm = FEADCore.tensionerState(sys, r.relDeg).requiredBeltMm; }
    catch(e){ out.error = veFeadTranslateError(e && e.message); return out; }
    return out;
  }
  var L = (sys && sys.belt) ? sys.belt.effLength : NaN;
  var b = veFeadSolveArmClamped(sys, 'belt', _feadNum(L, NaN));
  if(!b.ok){ out.error = b.error; return out; }
  out.relDeg = b.relDeg; out.atLimit = b.atLimit; out.effLengthMm = L;

  // ── SEÇİLEN KAYIŞ SIĞMIYORSA: NOMİNAL KOL AÇISINA DÜŞ ────────────────
  //
  // Kenetleme tek başına yetmiyordu ve sebebi fizikte: kolun uç konumu take-up
  // TEKİLLİĞİNE komşu (T = M/(dL/dθ), dL/dθ → 0). Oraya kenetlenince ÖLÇÜLDÜ:
  // alternatörü 10 mm kaydırmak 4.15e10 N gerginlik veriyordu — sayı modelin
  // kendi cevabı ama fiziksel değil, ve gerilme/hubload/ömür tablolarına
  // öylece sızıyordu.
  //
  // Doğal çıkış noktası KEYFÎ BİR EŞİK DEĞİL: gerginin künyesi kolun nominal
  // çalışma açısını zaten söylüyor (yay çalışma momenti). Kayış sığmıyorsa
  // fiziksel olarak anlamlı tek çalışma noktası odur — serbest kipin bulduğu
  // açının aynısı — ve oradaki `requiredBeltMm` doğrudan "hangi kayışı
  // ısmarlamalıyım" sorusunun cevabı. Yani sabit kip, sığmayan bir kayışta
  // serbest kipin cevabına düşüyor ve FARKI söylüyor.
  if(b.atLimit && Number.isFinite(nominalRelDeg)){
    var alt = veFeadSolveArmClamped(sys, 'arm', nominalRelDeg);
    if(alt.ok && !alt.atLimit){
      try {
        var stA = FEADCore.tensionerState(sys, alt.relDeg);
        out.relDeg = alt.relDeg;
        out.fallback = 'nominalArm';
        out.suggestedBeltMm = stA.requiredBeltMm;
        out.atLimit = Object.assign({}, b.atLimit, {
          resolvedAt: 'nominalArm',
          suggestedBeltMm: stA.requiredBeltMm,
          tensionN: stA.tensionN,
          degenerate: false
        });
      } catch(e){ /* düşemedik: kenetlenmiş hâl kalsın */ }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MONTAJ ZARFI KALKTI — KOL ÇALIŞMA AÇISI BİR GİRDİ
// ═══════════════════════════════════════════════════════════════════════════
//
// Bir dönem gergi MONTAJ KONUMU girdiydi ve kolun mutlak çalışma açısı bir
// ZARFTAN seçiliyordu (ölçüt: `max over θ of min over rel of dL/dθ`, 14 Gates
// sisteminden geriye çözülmüştü, medyan sapma 4,5° · 9/14 sistem ±5° içinde).
//
// GİRDİ AVARA MERKEZİNE DÖNÜNCE O ÖLÇÜT ÇÖKÜYOR ve sebebi fiziksel:
//
//   • Merkez SABİTKEN çalışma noktasındaki kayış yolu kol açısından TAMAMEN
//     BAĞIMSIZDIR ve bu bir yaklaşıklık değil: ÖLÇÜLDÜ (6 Gates sistemi ×
//     548 kol açısı) — sarım, altı açıklık, L_eff ve Σsarım en fazla
//     4,55e−13 mm / 1,71e−13° oynuyor, yani makine hassasiyeti (1716 mm'de
//     çift duyarlıklı ULP ≈ 2,3e−13 mm). PİVOT girdiyken aynı ızgarada
//     L_eff 122–294 mm oynuyordu: **15 büyüklük mertebesi**.
//   • Geriye ölçütün tutunacağı tek şey kalıyor: `T = M/(a·sinβ·2sin(φ/2))`
//     içindeki sinβ, ve servis bandının ucundaki sarım kaybı. Sonuç, ölçüt
//     eğrisinin DÜZLEŞMESİ — %1 platosu 2,1° → 24,1° (11,5 KAT).
//
// GEREKÇE "β 90°'ye ÇAKILIYOR" DEĞİL ve bu ayrım ölçüldü: seçilen β'nın
// medyanı 63,2° (tam dejenerasyon kontrol koşusu 90,0° veriyor). Ölçüt
// yanlış bir yeri seçmiyor — HİÇBİR yeri seçemiyor, çünkü eğri düz.
//
// ÖLÇÜLDÜ (aynı 14 sistem, merkez girdi):
//
//     medyan sapma          20,7°   (pivot girdiyken 4,0°, aynı harness)
//     ±5° içinde             2/14   (pivot girdiyken 8/14)
//     ±10° içinde            2/14   ← ara bant YOK: ya isabet ya kopuş
//     %1 platosu            24,1°   (pivot girdiyken 2,1°)
//     dört sistemde sapma  >90°     (AG00879 138,4° · AG00894 113,6° ·
//                                    AG00686 102,5° · AG00810 93,9°)
//
// Sekiz aday ölçüt tarandı (tepe gerginlik, T_max/T_min, hubload tepesi,
// ortalama T, en küçük sarım …); en iyisi yine 2/14. Ölçüt sorunu değil,
// SERBESTLİK DERECESİ sorunu: merkez verildikten sonra pivotun nereye
// düştüğü bir PAKETLEME kararıdır (gövde motor bloğunda nereye cıvatalanıyor)
// ve kayış fiziğinden çıkarılamaz.
//
// Bu yüzden kolun çalışma açısı (`armMeanDeg`) bir GİRDİDİR — kol boyu, yay
// ön yükü ve yay katsayısıyla aynı yerden, gerginin montaj/parça verisinden
// okunur. E9843'ün parça çizimi onu birebir yazıyor:
//   "PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm SPRING TORQUE
//    @ 28° FREEARM-MEAN ROTATION"
// ve aynı çizim, parçanın kendi değişmezinin MUTLAK açı değil BAĞIL dönme
// olduğunu da gösteriyor (28° ↔ yay künyesinden (22,07−8,60)/0,480 = 28,06°).
// Bu yüzden mutlak açı künye kütüphanesine YAZILMAZ: aynı E9843 BMC'de 344°,
// AG00976'da 348° ile monte edilmiş.
//
// UYDURULMUŞ BİR VARSAYILAN KONMUYOR. Açı girilmemişse model çözülmez ve
// sebebini adıyla yazar; β = 90° gibi "makul ama yanlış" bir varsayılan,
// gerginliği ölçülebilir biçimde kaydırıp sessiz kalırdı.

// ═══════════════════════════════════════════════════════════════════════════
//  KOL AÇISININ İMALAT KARŞILIĞI — KONUM PİMİ (`veFeadPinPlan`)
// ═══════════════════════════════════════════════════════════════════════════
//
// Zarf bir açı SEÇİYOR (θ*), ama montaj atölyesine "gövdeyi 236,1°'ye kur"
// demek bir talimat değil. Gerçek gergilerde gövdenin saat konumunu bir
// KONUM PİMİ belirliyor: merkezî cıvata gövdeyi tutuyor, pim onu döndürmüyor.
// Dolayısıyla seçimin imalat karşılığı pimin nereye açılacağıdır.
//
// KULLANICININ GÖNDERDİĞİ PARÇA ÇİZİMİ (E9843) bunu ölçülebilir yaptı:
// pim deliği merkezden `r` uzakta ve kolun ÇALIŞMA konumuna göre sabit bir
// `ofset` açısında duruyor. Ofsetin parça sabiti olmasının sebebi mekanik:
// pim deliği GÖVDEDE, kolun gövdeye göre çalışma konumu ise yay tarafından
// sabitlenmiş (28° free-arm→mean). Gövdeyi döndürmek ikisini BİRLİKTE
// döndürür → aradaki açı değişmez.
//
//     pim açısı = θ_kol + ofset          (E9843: ofset = −113,00°)
//
// SAYI YALNIZ ÇİZİMİ ELDE OLAN PARÇAYA AİT. Mekanizma genel (kullanıcı:
// "hemen hemen tüm otomatik gergilerin teknik resmi bu"), ama yarıçap ve
// ofset parçaya özgüdür ve UYDURULMAZ: kodu olmayan ya da çizimi olmayan
// künyede `ok:false` döner ve sebebi yazılır. Bu, kütüphanenin kendi kuralı
// (doğrulanamayan dört AG00976 kaydı `part` taşımıyor).
//
// GEÇERLİLİK SINIRI SONUCUN İÇİNDE: dönen kayıt kaynağını (`src`) taşıyor.
function veFeadPinPlan(td, armAbsDeg){
  var out = { ok:false, part:'', rMm:NaN, offsetDeg:NaN, angleDeg:NaN, src:'', reason:'' };
  var part = (td && td.tenPart) ? String(td.tenPart) : '';
  var a = _feadNum(armAbsDeg, NaN);
  if(!part){
    out.reason = 'Gergi parça kodu yok — pim künyesi yalnız kütüphaneden '
               + 'uygulanan ve kodu raporunda geçen künyelerde var.';
    return out;
  }
  out.part = part;
  if(typeof veFeadTenPinAngle !== 'function'){
    out.reason = 'Gergi künye kütüphanesi yüklenmedi (js/fead-tensioners.js).';
    return out;
  }
  var pk = veFeadTenPin(part);
  if(!pk){
    out.reason = part + ' için parça çizimi yok — pim yarıçapı ve ofseti '
               + 'UYDURULMAZ.';
    return out;
  }
  out.rMm = pk.rMm; out.offsetDeg = pk.offsetDeg; out.src = pk.src;
  if(!Number.isFinite(a)){
    out.reason = 'Kol çalışma açısı henüz çözülmedi.';
    return out;
  }
  var pa = veFeadTenPinAngle(part, a);
  if(!pa){ out.reason = 'Pim açısı hesaplanamadı.'; return out; }
  out.angleDeg = pa.angleDeg;
  out.ok = true;
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  KANVAS = KAYIŞ DÜZLEMİ — konum artık FİZİKSEL
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-08-25): *"Krank kasnağına koordinatları girdiğimiz
// zaman, bu koordinatların 0,0 noktası olması ve topoloji üzerinde bileşenleri
// hareket ettirdiğimde, örneğin alternatör kasnağını, kanvas üzerinde de
// hareket etmesi ve hesapların buna göre anında güncellenmesi."*
//
// Eskiden kanvastaki konum HİÇBİR ŞEY ifade etmiyordu: çözücü mm
// koordinatlarını yalnız panelden okuyordu. Artık ikisi TEK BİR ŞEY.
//
// ── ÖTELEME BEDAVA — ÖLÇÜLDÜ ───────────────────────────────────────────────
// Krankı orijine almak matematiksel olarak ücretsiz: bütün geometri merkez
// FARKLARINDAN kuruluyor (`tangent()` içindeki w = c_j − c_i). BMC'nin altı
// kasnağı + gergi pivotu + montaj merkezi birlikte (+500, −300) ötelendiğinde
// ΔL_eff = 0.00e+0, altı sarım açısında Δ = 0.00e+0, gerginlik 532.142 →
// 532.142 N. Kayan nokta hassasiyetinde BİREBİR aynı.
//
// ── Y EKSENİ TERS ──────────────────────────────────────────────────────────
// Kanvasta y AŞAĞI artar, kayış düzleminde YUKARI. Dönüşüm bu yüzden bir
// yansıma taşıyor ve TEK BİR YERDE duruyor — iki ayrı yerde yazılsaydı biri
// sessizce ters kalabilirdi.
//
// Ölçüldü ve iki durum ayrı: TAM ayna (her şey y→−y) bütün skalerleri BİREBİR
// aynı bırakıyor (fizik ayna simetrik), KISMİ ayna (kasnaklar çevrilir, gergi
// pivotu eski konvansiyonda kalır) modeli ÇÖZÜLEMEZ yapıyor ve sebebini
// yazıyor. Yani kapı burada gürültülü — ama başka bir topolojide sessiz
// olabileceği için dönüşüm yine de tek noktada.
//
// ── ÖLÇEK 1 px = 1 mm ──────────────────────────────────────────────────────
// Hassasiyet ZOOM'dan geliyor: %400 zoom'da bir ekran pikseli 0.25 mm.
// Sabit bir büyütme seçilseydi "ekrandaki mesafe kaç mm" sorusu zoom'a göre
// yine değişirdi; birebir ölçek o soruyu tek cevaplı yapıyor.
// ÖLÇÜLDÜ: BMC kümesi 465 × 314 mm, yani birebir ölçekte kanvasa rahat sığıyor.
var VE_FEAD_PX_PER_MM = 1;

// Kutu ölçüsü — düğümün kendi ölçüsü yoksa tip varsayılanı, o da yoksa 65×60
// (projenin `createNode` varsayılanı).
function veFeadNodeBox(node){
  var d = _feadDefOf(node);
  return { w: _feadNum(node && node.width,  0) || d.defaultWidth  || 65,
           h: _feadNum(node && node.height, 0) || d.defaultHeight || 60 };
}

// Kasnağın kanvastaki MERKEZİ. node.x/y kutunun SOL ÜSTÜ — merkezi kullanmak
// zorunlu: kasnak çapları farklı olduğu için sol üstten ölçmek her kasnağa
// kendi kutu yarısı kadar sistematik bir kayma verirdi.
function veFeadNodeCenter(node){
  var b = veFeadNodeBox(node);
  return { x: _feadNum(node && node.x, 0) + b.w / 2,
           y: _feadNum(node && node.y, 0) + b.h / 2 };
}

// ORİJİN = SÜRÜCÜ KASNAK. Tipe değil ROLE bağlı (`veFeadResolveDriver`):
// AG00976'da sürücü kasnak FAN'dır, tipe bağlamak o topolojiyi orijinsiz
// bırakırdı. Kasnak yoksa null → çağıran taraf senkronu ATLAR, konumlar
// serbest kalır (yarım modelde kutuları yerinden oynatmak istemiyoruz).
function veFeadOriginNode(nodeList){
  var pulleys = (nodeList || []).filter(_feadIsPulley);
  if(!pulleys.length) return null;
  return veFeadResolveDriver(pulleys);
}

// Kanvas px → kayış düzlemi mm. Y TERS.
function veFeadCanvasToMm(node, originNode, scale){
  var s = _feadNum(scale, 0) || VE_FEAD_PX_PER_MM;
  var c = veFeadNodeCenter(node), o = veFeadNodeCenter(originNode);
  return { x: (c.x - o.x) / s, y: -(c.y - o.y) / s };
}

// Kayış düzlemi mm → kanvas px (kutunun SOL ÜSTÜ, DOM'a yazılacak değer).
function veFeadMmToCanvas(mmX, mmY, originNode, scale, box){
  var s = _feadNum(scale, 0) || VE_FEAD_PX_PER_MM;
  var o = veFeadNodeCenter(originNode);
  var b = box || { w: 65, h: 60 };
  return { x: o.x + _feadNum(mmX, 0) * s - b.w / 2,
           y: o.y - _feadNum(mmY, 0) * s - b.h / 2 };
}

// ── KONUM BAĞI — TEK OKUMA NOKTASI ─────────────────────────────────────────
//
// "Kanvas = kayış düzlemi" bağı kapatılabilir (Konum Bağı düğümü). Bağ
// kapalıyken kanvas konumu ile mm koordinatı BAĞIMSIZ: kutu salt görsel,
// koordinat salt panel girdisi.
//
// OKUMA TEK NOKTADAN. Kanvas (sürükleme), panel ve rozet üçü de bu
// fonksiyonu çağırıyor — bu modülün tekrar eden kuralı (kayış kipinde
// `veFeadBeltMode`, kol konumunda `posMode`): iki ayrı yerde hesaplanan bir
// durum, iki yüzeyin sessizce ayrışması demektir.
//
// DÜĞÜM YOKSA BAĞ AÇIK. Geriye dönük uyum bu satırda: bugüne kadar
// kaydedilmiş hiçbir projede bu düğüm yok, dolayısıyla hepsi birebir eski
// davranışını sürdürür. Düğüm var ama `linked` yazılı değilse de AÇIK —
// paletten bırakmak tek başına modeli değiştirmemeli.
//
// ÇOK KOPYADA "KAPALI" KAZANIR. `maxInstances:1` ikinci kopyayı zaten
// engelliyor, ama eski bir kayıt ya da elle düzenlenmiş bir dosya iki kopya
// taşıyabilir. O zaman açıkça KAPALI diyen bir düğümü yok saymak, kullanıcının
// verdiği talimatı sessizce çöpe atmak olurdu.
function veFeadCoordLinkNode(nodeList){
  var a = (nodeList || []).filter(function(n){ return !!_feadDefOf(n).isFeadCoordLink; });
  if(!a.length) return null;
  for(var i = 0; i < a.length; i++)
    if(a[i] && a[i].data && a[i].data.linked === false) return a[i];
  return a[0];
}

function veFeadCoordLinkOn(nodeList){
  var n = veFeadCoordLinkNode(nodeList);
  return !n || !n.data || n.data.linked !== false;
}

// ── KANVASTAN mm'YE ────────────────────────────────────────────────────────
// Sürükleme sırasında çağrılır. BÜTÜN kasnaklar tek geçişte tazeleniyor,
// yalnız sürüklenen değil — çünkü orijin de bir kasnak: KRANK sürüklenirse
// diğerlerinin krank-göreli konumu değişir, ve bu fiziksel olarak DOĞRUdur
// (krank aksesuarlara göre kaymıştır). Özel durum yazmak yerine tek geçiş.
function veFeadSyncMmFromCanvas(nodeList, opt){
  opt = opt || {};
  var org = opt.origin || veFeadOriginNode(nodeList);
  if(!org) return 0;
  var s = _feadNum(opt.scale, 0) || VE_FEAD_PX_PER_MM;
  var n = 0;
  (nodeList || []).forEach(function(x){
    if(!_feadIsPulley(x)) return;
    // GERGİ AYNI GEÇİŞTE, AMA KENDİ KURALIYLA. Merkezi bir girdi değil,
    // çözücünün çıktısı; kanvastan yazılan şey MONTAJ merkezi ve pivot
    // (rijit, kol boyu korunarak). Ayrı bir geçişe bırakmak, orijin
    // sürüklendiğinde gerginin pivotunu BAYAT bırakırdı — krank-göreli her
    // koordinat aynı karede tazelenmeli.
    if(_feadDefOf(x).isFeadTensioner){
      if(veFeadDragTensioner(x, org, s)) n++;
      return;
    }
    if(!x.data) x.data = {};
    var mm = veFeadCanvasToMm(x, org, s);
    var nx = Math.round(mm.x * 1000) / 1000, ny = Math.round(mm.y * 1000) / 1000;
    if(x.data.x !== nx || x.data.y !== ny){ x.data.x = nx; x.data.y = ny; n++; }
  });
  return n;
}

// ── mm'DEN KANVASA ─────────────────────────────────────────────────────────
// Yükleme, örnek kurma ve "Otomatik Düzenle" yolunda çağrılır. Orijinin KENDİ
// kanvas konumu DEĞİŞMEZ: çerçeveyi o tanımlıyor, onu da taşımak bütün kümeyi
// kaydırırdı.
function veFeadSyncCanvasFromMm(nodeList, opt){
  opt = opt || {};
  var org = opt.origin || veFeadOriginNode(nodeList);
  if(!org) return 0;
  var s = _feadNum(opt.scale, 0) || VE_FEAD_PX_PER_MM;
  var n = 0;
  (nodeList || []).forEach(function(x){
    if(!_feadIsPulley(x) || x === org) return;
    var mmX = _feadNum(x.data && x.data.x, NaN), mmY = _feadNum(x.data && x.data.y, NaN);
    // ── GERGİNİN KUTUSU HANGİ NOKTAYI GÖSTERİR ────────────────────────────
    //
    // AVARA MERKEZİ — yani gerginin TEK koordinatı ve kayış yolunun gerçekten
    // geçtiği nokta. Diğer kasnaklarda kutu zaten merkezi gösteriyor; gergiyi
    // istisna yapmanın karşılığı yok.
    //
    // Gövdenin montaj konumu bir ÇIKTI (p = c − a·(cos θ, sin θ)) ve kutu onu
    // GÖSTERMEZ: kutuyu türetilmiş bir noktaya oturtmak, kullanıcının
    // sürükleyerek doğrudan yazamayacağı bir yüzey demekti.
    if(_feadDefOf(x).isFeadTensioner){
      // Kural TEK YERDE (veFeadTensionerBoxMm): "Otomatik Düzenle" ve örnek
      // kurucusu da aynı okuyucuyu kullanıyor. Satır içi kalsaydı üç yol üç
      // ayrı kopya taşırdı — nitekim taşıyordu ve ikisi ayrışmıştı.
      var kutu = veFeadTensionerBoxMm(x.data || {});
      mmX = kutu ? kutu[0] : NaN; mmY = kutu ? kutu[1] : NaN;
    }
    if(!Number.isFinite(mmX) || !Number.isFinite(mmY)) return;
    var p = veFeadMmToCanvas(mmX, mmY, org, s, veFeadNodeBox(x));
    // TAM SAYIYA YUVARLANMIYOR. 1 px = 1 mm olduğu için tam sayı yuvarlaması
    // koordinatı 1 mm'ye KUANTALARDI ve bu sessiz bir kayıp: ölçüldü,
    // alternatörün 1 mm'si gerginliği 38.6 N (%5.9) değiştiriyor, gergi kol
    // boyu kapısının toleransı ise 0.5 mm. 0.01 mm'lik yuvarlama her iki
    // eşiğin de çok altında ve gidiş-dönüşü kayıpsız yapıyor.
    var px = Math.round(p.x * 100) / 100, py = Math.round(p.y * 100) / 100;
    if(x.x !== px || x.y !== py){ x.x = px; x.y = py; n++; }
  });
  return n;
}

// ── GERGİ SÜRÜKLEMESİ AVARA MERKEZİNİ TAŞIR ────────────────────────────────
//
// Kutu avara merkezini gösteriyor (bkz. veFeadSyncCanvasFromMm), dolayısıyla
// sürükleme de doğrudan onu yazar. Gövdenin montaj konumu türetilmiş olduğu
// için kolu koruyarak RİJİT takip ediyor: kol boyu ve kol çalışma açısı
// dokunulmadan kaldığından p = c − a·(cos θ, sin θ) kendiliğinden aynı kadar
// ötelenir.
//
// ARACI BİR NOKTADAN GEÇİLMEZ. Montaj konumunu yazıp merkezi ondan geri
// türetmek aynı sayıyı iki kez yuvarlar ve montaj konumunu sessizce bir
// GİRDİYE çevirirdi — kullanıcının açıkça kaldırttığı şey.
function veFeadDragTensioner(node, originNode, scale){
  if(!node || !_feadDefOf(node).isFeadTensioner || !originNode) return false;
  if(!node.data) node.data = {};
  var td = node.data;
  var s0 = _feadNum(scale, 0) || VE_FEAD_PX_PER_MM;
  var cx0 = _feadNum(td.cenX, NaN), cy0 = _feadNum(td.cenY, NaN);
  if(!Number.isFinite(cx0) || !Number.isFinite(cy0)) return false;
  var yeni = veFeadCanvasToMm(node, originNode, s0);
  var nx = Math.round(yeni.x * 1000) / 1000, ny = Math.round(yeni.y * 1000) / 1000;
  if(nx === cx0 && ny === cy0) return false;
  td.cenX = nx; td.cenY = ny;
  return true;
}

// ── ORİJİN GÖÇÜ ────────────────────────────────────────────────────────────
// Krank (0,0) değilse bütün koordinatlardan onunkini çıkar. Bu TANIM GEREĞİ
// bir öteleme, dolayısıyla geometriye etkisi YOK (yukarıda ölçüldü) — eski
// projeler sessizce göç edebilir. Gerginin avara merkezi de ötelenir; yalnız
// kasnakları ötelemek KISMİ bir öteleme olurdu ve modeli bozardı.
//
// ESKİ `pivotX/pivotY` DE ÖTELENİYOR ve bu ölü kod DEĞİL: bu fonksiyon alt
// topoloji açılışında, `veFeadMigrateTensioner`den ÖNCE koşabiliyor. Ötelenmemiş
// bir montaj konumundan sonra türetilen merkez krankın ofseti kadar yanlış
// yere düşerdi — sessiz, çünkü model yine çözülür.
function veFeadNormalizeOrigin(nodeList){
  var org = veFeadOriginNode(nodeList);
  if(!org || !org.data) return 0;
  var ox = _feadNum(org.data.x, NaN), oy = _feadNum(org.data.y, NaN);
  if(!Number.isFinite(ox) || !Number.isFinite(oy)) return 0;
  if(Math.abs(ox) < 1e-9 && Math.abs(oy) < 1e-9) return 0;
  var n = 0;
  (nodeList || []).forEach(function(x){
    if(!_feadIsPulley(x) || !x.data) return;
    var d = x.data;
    if(Number.isFinite(_feadNum(d.x, NaN)) && Number.isFinite(_feadNum(d.y, NaN))){
      d.x = Math.round((_feadNum(d.x, 0) - ox) * 1000) / 1000;
      d.y = Math.round((_feadNum(d.y, 0) - oy) * 1000) / 1000;
      n++;
    }
    ['pivot', 'cen'].forEach(function(k){
      var kx = k + 'X', ky = k + 'Y';
      if(Number.isFinite(_feadNum(d[kx], NaN)) && Number.isFinite(_feadNum(d[ky], NaN))){
        d[kx] = Math.round((_feadNum(d[kx], 0) - ox) * 1000) / 1000;
        d[ky] = Math.round((_feadNum(d[ky], 0) - oy) * 1000) / 1000;
        n++;
      }
    });
  });
  return n;
}

// ─── KATALOG ADAYLARININ SONUCU ─────────────────────────────────────────────
//
// Katalogun asıl değeri bir boy LİSTESİ vermek değil — o listeden birini
// seçmenin NE YAPACAĞINI söylemek. Kayış boyu değişince gergi kolu başka bir
// açıya oturuyor, gerginlik ve hubload da onunla değişiyor; kullanıcı "1690 mı
// 1755 mi" sorusunu ancak bu sayıları görerek cevaplayabilir.
//
// Hesap sabit kipin kendisi: rel = solveArmForBeltLength(L). Kenetlenen
// sarmalayıcıdan geçtiği için erişilemeyen bir aday da CEVAP veriyor —
// "bu boy kolun aralığının dışında" bir sonuçtur, hata değil.
function veFeadBeltFit(sys, lengthMm){
  var out = { lengthMm: _feadNum(lengthMm, NaN), ok: false, fits: false, relDeg: NaN,
              tensionN: NaN, hubloadN: NaN, atLimit: null, error: null };
  if(typeof FEADCore === 'undefined' || !sys || !Number.isFinite(out.lengthMm)){
    out.error = 'Model çözülemedi.'; return out;
  }
  var r = veFeadSolveArmClamped(sys, 'belt', out.lengthMm);
  if(!r.ok){ out.error = r.error; return out; }
  out.relDeg = r.relDeg;
  out.atLimit = r.atLimit;
  out.ok = true;                       // bir CEVAP her zaman var
  out.fits = !r.atLimit;               // ama "sığıyor mu" ayrı bir soru

  // SIĞMAYAN ADAYDA GERGİNLİK YAZILMAZ. Kenetlenme kolun uç konumuna oturuyor
  // ve orası take-up tekilliğine komşu (T = M/(dL/dθ), dL/dθ → 0); ÖLÇÜLDÜ:
  // BMC'ye 1690 mm kayış denenince 4.05e10 N çıkıyor. Sayı modelin kendi
  // cevabı ama FİZİKSEL DEĞİL — katalog tablosuna böyle bir sayı basmak,
  // kullanıcıya "bu kayış çok gergi olur" diye okutulacak bir yalan olurdu.
  // Doğru cevap bir sayı değil, bir HÜKÜM: bu boy bu yerleşime sığmıyor.
  if(r.atLimit && r.atLimit.degenerate) return out;

  try {
    var st = FEADCore.tensionerState(sys, r.relDeg);
    out.tensionN = st.tensionN; out.hubloadN = st.hubloadN;
    out.wrapDeg = st.wrapDeg; out.takeupMmPerDeg = st.takeupMmPerDeg;
  } catch(e){ out.error = veFeadTranslateError(e && e.message); }
  return out;
}

// Çözülmüş bir modelin GEREKEN boyu için katalog adayları + her birinin sonucu.
// `build` sabit kipte de serbest kipte de olabilir: ikisinde de bir "gereken
// boy" var (sabit kipte kayış sığmıyorsa atLimit.suggestedBeltMm, sığıyorsa
// girilen boyun kendisi).
function veFeadBeltOptions(build, opt){
  opt = opt || {};
  var out = { ok: false, targetMm: NaN, profile: null, ribs: null,
              stock: [], grid: null, error: null };
  if(!build || !build.ok || !build.sys){
    out.error = (build && build.errors && build.errors[0]) || 'Model çözülemedi.';
    return out;
  }
  var wp = build.workPoint || {};
  out.targetMm = _feadNum(
    (wp.atLimit && Number.isFinite(wp.atLimit.suggestedBeltMm)) ? wp.atLimit.suggestedBeltMm
      : build.beltLengthMm, NaN);
  out.profile = (typeof veFeadBeltProfileOf === 'function')
    ? veFeadBeltProfileOf(build.sys.belt && build.sys.belt.profile) : null;
  out.ribs = _feadNum(build.sys.belt && build.sys.belt.ribs, NaN);
  if(!Number.isFinite(out.targetMm) || !out.profile){
    out.error = 'Gereken kayış boyu henüz belli değil.'; return out;
  }
  if(typeof veFeadBeltNearest !== 'function'){
    out.error = 'Kayış kataloğu yüklenmedi (js/fead-belts.js).'; return out;
  }

  // Çalışma noktası ADAYLARDAN BAĞIMSIZ olmalı: her aday kendi çözümünü
  // istiyor ama hepsi AYNI sistemden. `sys` üzerinde meanRel önbelleği duruyor
  // (çalışma noktası tohumlandı) — adaylar onu okumuyor, kendi bisect'lerini
  // koşuyorlar, yani önbelleği bozan bir yan etki YOK.
  var n = veFeadBeltNearest(out.profile, out.targetMm, { count: opt.count || 3 });
  var degerle = function(c){
    var f = veFeadBeltFit(build.sys, c.lengthMm);
    return { lengthMm: c.lengthMm, deltaMm: c.deltaMm, kind: c.kind,
             code: (typeof veFeadBeltCode === 'function')
                     ? veFeadBeltCode(out.profile, out.ribs, c.lengthMm) : '',
             fit: f };
  };
  out.stock = n.stock.map(degerle);
  out.grid = n.grid ? degerle(n.grid) : null;
  out.ok = true;
  return out;
}

// ─── GERGİ KOL KONUMLARI — kayış yolu her konumda BAŞKA ─────────────────────
//
// Gergi kolu bir yay dengesinde duruyor: kayış uzadıkça (tolerans, aşınma) kol
// içe girer, kısaldıkça geri açılır. Her konumda gergi kasnağının MERKEZİ
// değişir, dolayısıyla teğet noktaları, sarım açıları ve span boyları da
// değişir — yani KAYIŞ YOLU her konumda başka bir eğri.
//
// Çekirdeğin konum tablosu (FEADCore.positionTable) bunları veriyor:
//   FreeArm  kayış takılı değil (rel = 0, yay yalnız ön yükünde)
//   Replace  L + tolerans + aşınma·L   → en uzun kayış, kol en açık
//   MaxBelt  L + tolerans
//   Mean     L                          → ÇALIŞMA konumu (varsayılan)
//   MinBelt  L − tolerans               → en kısa kayış, kol en içte
//   Load     mekanik durdurucu (verilmişse)
//
// ÖNEMLİ: tolerans ve aşınma SIFIRSA dört orta konum AYNI açıya oturur. Üst üste
// çizilirse dört özdeş eğri üst üste biner ve çizim hatası gibi görünür; bu
// yüzden aşağıda 0.05° içindeki konumlar TEKİLLEŞTİRİLİR.
var VE_FEAD_POSITIONS = [
  { key: 'free',    core: 'FreeArm', label: 'Serbest kol',   kisa: 'Serbest' },
  { key: 'replace', core: 'Replace', label: 'Değiştirme',    kisa: 'Değişt.' },
  { key: 'max',     core: 'MaxBelt', label: 'Maks. kayış',   kisa: 'Maks' },
  { key: 'mean',    core: 'Mean',    label: 'Çalışma (Mean)', kisa: 'Mean' },
  { key: 'min',     core: 'MinBelt', label: 'Min. kayış',    kisa: 'Min' },
  { key: 'load',    core: 'Load',    label: 'Load stop',     kisa: 'Load' }
];
var VE_FEAD_POS_TOL_DEG = 0.05;      // bu kadar yakın iki konum AYNI sayılır

// Çekirdeğin tablosunu UI biçimine çevir. Çözülemeyen konum DÜŞÜRÜLMEZ, hatası
// taşınır — "Replace neden yok" sorusu cevapsız kalmasın (uzun kayış çözüm
// aralığının dışına çıkabiliyor ve bu gerçek bir bulgudur).
function veFeadPositionRows(build){
  if(!build || !build.ok || typeof FEADCore === 'undefined') return [];
  var raw;
  try { raw = FEADCore.positionTable(build.sys); }
  catch(e){ return []; }
  var byCore = {};
  raw.forEach(function(r){ byCore[r.position] = r; });
  return VE_FEAD_POSITIONS.map(function(P){
    var r = byCore[P.core];
    if(!r) return null;                                  // Load tanımlı değilse
    return {
      key: P.key, core: P.core, label: P.label, kisa: P.kisa,
      ok: !r.error && Number.isFinite(r.relDeg),
      relDeg: r.relDeg, error: r.error || null,
      cen: (r.idlerX != null) ? [r.idlerX, r.idlerY] : null,
      tensionN: r.tensionN, wrapDeg: r.wrapDeg
    };
  }).filter(Boolean);
}

// Panelde/kartta seçili konum kipi. Varsayılan 'mean' — çalışma konumu.
function veFeadPosMode(node){
  var v = node && node.data && node.data.posMode;
  if(v === 'all') return 'all';
  for(var i=0;i<VE_FEAD_POSITIONS.length;i++)
    if(VE_FEAD_POSITIONS[i].key === v) return v;
  return 'mean';
}

// Kip → çizilecek konumlar. { primary, ghosts[], rows[], mode, note }
//   'mean' (ve diğer tek konumlar) → primary o konum, ghosts boş
//   'all'                          → primary Mean, ghosts geri kalan TEKİL konumlar
//
// primary her zaman DOLU döner (çözülebilen bir konum varsa): kip 'load' seçili
// ama load çözülemiyorsa şema boş kalmaz, Mean'e düşer ve sebep note'a yazılır.
function veFeadPosSelection(build, mode){
  var out = { primary: null, ghosts: [], rows: [], mode: mode || 'mean', note: null };
  var rows = veFeadPositionRows(build);
  out.rows = rows;
  if(!rows.length) return out;
  var ok = rows.filter(function(r){ return r.ok; });
  if(!ok.length){ out.note = 'Hiçbir kol konumu çözülemedi.'; return out; }

  var mean = ok.filter(function(r){ return r.key === 'mean'; })[0] || ok[0];
  var m = out.mode;

  if(m !== 'all'){
    var sec = ok.filter(function(r){ return r.key === m; })[0];
    if(!sec){
      var ist = rows.filter(function(r){ return r.key === m; })[0];
      out.note = (ist && ist.error)
        ? (ist.label + ' konumu çözülemedi (' + veFeadTranslateError(ist.error) + '); çalışma konumu gösteriliyor.')
        : (m === 'load' ? 'Load stop girilmedi; çalışma konumu gösteriliyor.'
                        : 'Seçili konum çözülemedi; çalışma konumu gösteriliyor.');
      sec = mean;
    }
    out.primary = sec;
    return out;
  }

  // TÜMÜ: Mean önde, diğerleri hayalet. Tekilleştirme burada — tolerans 0 iken
  // dört konum aynı açıya oturuyor ve üst üste çizim hataya benziyor.
  out.primary = mean;
  var alinan = [mean.relDeg];
  ok.forEach(function(r){
    if(r.key === mean.key) return;
    for(var i=0;i<alinan.length;i++)
      if(Math.abs(r.relDeg - alinan[i]) <= VE_FEAD_POS_TOL_DEG) return;
    alinan.push(r.relDeg);
    out.ghosts.push(r);
  });
  if(!out.ghosts.length)
    out.note = 'Bütün kol konumları aynı açıda — kayış toleransı ve aşınma payı 0 '
             + 'girilmiş (Kayış Özellikleri panelinde). Tolerans girilince konum '
             + 'zarfı burada görünür.';
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  ANİMASYON KİNEMATİĞİ — kartın canlı çalışması
// ════════════════════════════════════════════════════════════════════════════
// Kayış Yolu kartı şimdiye kadar DONMUŞ bir kesitti: geometri doğru, hareket
// yok. Oysa şemanın anlattığı üç şey — hangi kasnak ne kadar hızlı döner,
// hangisi TERS döner, kayış ne kadar hızlı gider — ancak hareketle okunur;
// bugüne kadar yalnız tabloda sayı olarak duruyorlardı.
//
// YENİ FİZİK YOK, üçü de çekirdekte hazır:
//   FEADCore.beltSpeed(sys, N)   kayış hızı (m/s)
//   FEADCore.speedRatio(sys, i)  kasnak devri / motor devri
//   geom.pulleys[i].d            dönüş YÖNÜ (sırttan temas edende ters)
// Buradaki iş yalnız o sayıları EKRANDA OKUNUR bir hıza indirmek.
//
// ── GERÇEK ZAMAN NEDEN OLMAZ (ÖLÇÜLDÜ — BMC örneği, o zamanki 420×340 kart,
//    0.553 px/mm; kart 440×500 olunca ölçek 1.277× büyüdü, aşağıdaki px/s
//    sayıları da o kadar — ama TAVAN devir tabanlı (VE_FEAD_ANIM_TARGET_REV_S)
//    olduğu için gerekçe DEĞİŞMİYOR)
//   motor  800 dev/dk → kayış  7.56 m/s =  4182 px/s · alternatör  40.5 tur/s
//   motor 2750 dev/dk → kayış 26.00 m/s = 14377 px/s · alternatör 139.4 tur/s
// 60 Hz ekranda EN YAVAŞ satırda bile kayış kare başına 70 px (10 diş adımı)
// atlıyor → diş sırası strob; alternatör kare başına 0.68 tur → wagon-wheel,
// yani gerçek yönünün TERSİNE dönüyor görünür. Gerçek zaman fiziksel olarak
// dürüst, görsel olarak okunaksız. Bu yüzden AĞIR ÇEKİM — oranlar birebir.
//
// ── KATSAYI NEDEN SEÇİLİ DEVRE DEĞİL, REFERANS DEVRE BAĞLI ─────────────────
// Katsayı seçili devre göre normalize edilseydi HER devirde ekrandaki hız aynı
// çıkardı ve devir seçicisi hiçbir şey değiştirmezdi. Katsayı bir kez, listenin
// EN YÜKSEK devrine göre sabitlenir: orada en hızlı kasnak tavana
// (VE_FEAD_ANIM_TARGET_REV_S) oturur, daha düşük devirler ekranda GERÇEKTEN
// daha yavaş akar (BMC: 800 dev/dk'da alternatör 0.29 tur/s).
//
// Tavan 1 tur/s KEYFÎ DEĞİL, örnekleme sınırından: en küçük kasnakta (Ø59.4 →
// ekranda R=16.4 px) diş açı adımı 24.5°, 1 tur/s'de kare başına 6° — adımın
// yarısının altında, yani yön tek anlamlı. 2 tur/s'de 12°, tam sınırda.
var VE_FEAD_ANIM_TARGET_REV_S = 1.0;    // referans devirde EN HIZLI kasnak (tur/s)
var VE_FEAD_ANIM_FALLBACK_RPM = 1000;   // duty tablosu boşken varsayılan motor devri

// Devir seçenekleri — çözücü düğümünün duty tablosundan (tekilleştirilmiş,
// artan). Tablo boşsa TEK bir varsayılan satır döner ve fallback bayrağı
// taşınır: oranlar salt geometriden geldiği için animasyon yine doğrudur,
// uydurma olan yalnız mutlak devirdir ve kartta öyle yazar.
function veFeadAnimRpmChoices(build){
  var rows = veFeadDutyRows(build && build.solver);
  var gorulen = {}, out = [];
  rows.forEach(function(r){
    if(!(r.rpm > 0) || gorulen[r.rpm]) return;
    gorulen[r.rpm] = 1;
    out.push({ rpm: r.rpm, dcPct: r.dcPct, fallback: false });
  });
  out.sort(function(a, b){ return a.rpm - b.rpm; });
  if(!out.length) out.push({ rpm: VE_FEAD_ANIM_FALLBACK_RPM, dcPct: NaN, fallback: true });
  return out;
}

// Kartta seçili devir: 'off' (durgun) ya da bir motor devri.
// VARSAYILAN, tablonun BASKIN satırıdır (en büyük duty yüzdesi) — "kart açılır
// açılmaz ne görüyorum" sorusunun cevabı gerçek bir çalışma noktası olsun.
// Kayıtlı değer listeden düşmüşse (kullanıcı duty satırını sildi) en yakın
// devre değil, yine baskın satıra düşülür: sessizce başka bir devri göstermek,
// künyede yazan sayıya güveni bozar.
function veFeadAnimRpmOf(build, node){
  var v = node && node.data && node.data.animRpm;
  if(v === 'off') return 'off';
  if(v === 'scn') return 'scn';                      // motor çevrimi senaryosu
  var list = veFeadAnimRpmChoices(build);
  var n = _feadNum(v, NaN);
  for(var i=0;i<list.length;i++) if(list[i].rpm === n) return n;
  var best = list[0];
  list.forEach(function(r){ if(Number.isFinite(r.dcPct) && (!Number.isFinite(best.dcPct) || r.dcPct > best.dcPct)) best = r; });
  return best.rpm;
}

// Seçili devrin kinematiği + ağır çekim katsayısı.
//   beltMs        gerçek kayış hızı (m/s)
//   revPerSec[i]  gerçek kasnak devri (tur/s, İŞARETSİZ — yön geom.pulleys[i].d)
//   slow          ekran katsayısı (≤ 1); referans devirde tavan
//   dispMmS       ekranda kayışın mm/s hızı (= beltMs·1000·slow)
// refRpm verilmezse listenin en yükseği alınır (bkz. yukarıdaki gerekçe).
function veFeadAnimKinematics(build, engineRpm, refRpm){
  if(!build || !build.ok || !build.sys || typeof FEADCore === 'undefined') return null;
  var sys = build.sys, n = sys.pulleys.length;
  var rpm = _feadNum(engineRpm, NaN);
  if(!(rpm > 0)) return null;
  var ref = _feadNum(refRpm, NaN);
  if(!(ref > 0)){
    ref = 0;
    veFeadAnimRpmChoices(build).forEach(function(r){ if(r.rpm > ref) ref = r.rpm; });
    if(!(ref > 0)) ref = rpm;
  }
  var oran = [], i;
  try {
    for(i=0;i<n;i++) oran.push(Math.abs(FEADCore.speedRatio(sys, i)));
  } catch(e){ return null; }
  var enBuyukOran = Math.max.apply(null, oran);
  var refMaxRev = ref * enBuyukOran / 60;                 // referans devirde tavan kasnak
  var slow = (refMaxRev > 0) ? Math.min(1, VE_FEAD_ANIM_TARGET_REV_S / refMaxRev) : 1;
  var beltMs;
  try { beltMs = FEADCore.beltSpeed(sys, rpm); }
  catch(e){ return null; }
  if(!(beltMs > 0)) return null;
  return {
    engineRpm: rpm, refRpm: ref, beltMs: beltMs,
    revPerSec: oran.map(function(o){ return rpm * o / 60; }),
    ratio: oran, refMaxRevPerSec: refMaxRev,
    slow: slow, dispMmS: beltMs * 1000 * slow,
    fallbackRpm: false
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  TİTREŞİM ANİMASYONU — GENLİK BİR SONUÇ DEĞİLDİR
// ════════════════════════════════════════════════════════════════════════════
// Kayış-kasnak tahriki çalışırken çırpar: açıklıklar enine savrulur, gergi kolu
// dans eder. Çekirdek bunun İKİ ayrı olayını da ZATEN çözüyor —
// `spanFrequencies()` (enine açıklık titreşimi, eksenel hareketli tel) ve
// `torsionalModel()` (N kasnak + kol serbestliği, özdeğer). Buradaki iş fizik
// ÜRETMEK değil, o iki sonucu çizilebilir bir yüke çevirmek. Çekirdeğe
// dokunulmuyor (modülün 1. dokunulmazı).
//
// ÖLÇÜLDÜ (BMC AG00686, Gates fixture'ı, gerçek ataletlerle):
//   açıklık f₁ = 150–190 Hz   ·   burulma modları 12.0 · 62.5 · 123.4 · 279.5 Hz
//   ateşleme 40 Hz @800 dev/dk  ·  137.5 Hz @2750 dev/dk
//   1. mod şekli: ARM −1.000 · TEN −0.909 · IDR +0.364 · A_C +0.314 · CRK +0.082
//   yani gözle görülen "kol dansı" birebir 1. mod; krank neredeyse duruyor.
//
// ÜÇ SINIR — üçü de yükün İÇİNDE taşınır, gizlenmez (modülün 8. kuralı):
//
// 1. GENLİK BİR SONUÇ DEĞİL. İkisi de özdeğer problemi; özvektör yalnız GÖRELİ
//    genlik verir. Mutlak genlik için krank torkunun HARMONİK İÇERİĞİ ve kayış
//    SÖNÜMÜ gerekir — MFSim'de ikisi de yok (motor kataloğunda tam yük tork
//    EĞRİSİ var, harmonikleri değil). Ekrandaki genlik bu yüzden ilan edilmiş
//    bir GÖSTERİM KAZANCIDIR, kullanıcı kaydırıcısına bağlıdır ve künyede
//    yazılıdır. Zaten olmak zorunda: kartta ölçek ~0.71 px/mm, yani gerçek
//    3 mm'lik bir açıklık sapması ekranda 2 piksel — görünmez.
//
// 2. AÇIKLIK ŞEKLİ v=0 YAKLAŞIMIDIR. Çekirdeğin FREKANS formülü eksenel hızı
//    hesaba katıyor (f = (c²−v²)/(2Lc)) ama çizdiğimiz yarım sinüs DURAN telin
//    şeklidir. BMC'de 2750 dev/dk'da v/c = 0.287, yani gerçek şekil akış
//    yönünde çarpıktır. Frekans doğru, şekil yaklaşık.
//
// 3. MOD ŞEKLİNİN ZAMAN TABANI YOKTUR. Bir özvektör "şu hızda salınır" demez;
//    ölçek de tanımı gereği keyfîdir. Ekran frekansı bu yüzden SABİT
//    (VE_FEAD_VIB_SCREEN_HZ) ve gerçek Hz künyeye yazılır. Kinematiğin ağır
//    çekim katsayısı burada KULLANILAMAZ: ölçüldü, BMC'de slow = 1/139 ve
//    1. mod 12 Hz → ekranda 0.086 Hz, yani çevrim başına 11.6 saniye — bu bir
//    salınım değil, sürüklenme. İki animasyonun ayrı zaman tabanı olmasının
//    sebebi budur, tercih değil ölçüm.

var VE_FEAD_VIB_GAIN_MIN = 1;
var VE_FEAD_VIB_GAIN_MAX = 20;
// VARSAYILAN ÖLÇÜLDÜ, seçilmedi. Gerçek tarayıcıda (BMC örneği, 440×458 kart,
// 0.706 px/mm) bir çevrim taranarak yolun titreşimsiz hâlinden en büyük sapması:
//   kazanç  ×3   ×6   ×10   ×14   ×20
//   çırpma 2.9  5.7   9.5  13.3  19.0 px
//   mod 1  4.1  8.5  14.8  21.6  22.8 px   (14'ten sonra açı tavanı ısırıyor)
// ×6'da çırpma kartın %1.2'si — hareket hâlinde seçiliyor ama ilk bakışta
// "düz" okunuyordu (ölçüldü: tek karelik ekran görüntüsünde açıklıklar düz
// görünüyor). ×10 ilk açılışta okunur ve kaydırıcı hâlâ iki yöne de açık.
var VE_FEAD_VIB_GAIN_DEF = 10;
// İlan edilmiş sönüm oranı. KALİBRE DEĞİL — yalnız açıklıkların BİRBİRİNE göre
// genliğini (rezonansa yakın olan daha çok savrulsun) üretmek için var.
var VE_FEAD_VIB_ZETA = 0.06;
// 1× kazançta, rezonanstaki bir açıklığın tepe genliği [mm].
var VE_FEAD_VIB_SPAN_MM = 0.35;
// 1× kazançta, mod şeklinde en büyük serbestliğin tepe açısı [°].
var VE_FEAD_VIB_MODE_DEG = 1.5;
// Mod şekli animasyonunun EKRAN frekansı [Hz] — gerçek frekansla ilgisi yok.
var VE_FEAD_VIB_SCREEN_HZ = 0.75;
// Çırpma ekranda bunu aşarsa EK ağır çekim uygulanır (60 Hz'de çevrim başına
// 10 kareden az kalmasın) ve katsayı künyeye yazılır.
var VE_FEAD_VIB_MAX_SCREEN_HZ = 6;
// Ateşlemenin kaçıncı mertebesine kadar bakılacağı. Yüksek mertebeler 1/k ile
// zayıflatılır — bir mertebe ağırlık modeli değil, sıralama ölçütü.
var VE_FEAD_VIB_ORDERS = 6;
// Mod şeklinde toplam açı tavanı [°] — kaydırıcı sonuna dayandığında kol
// kayışın içinden geçmesin.
var VE_FEAD_VIB_MODE_MAX_DEG = 22;

// Kaydırıcının değeri. Düğümde saklanır; PANEL DE aynı alanı okur (modülün
// 7. kuralı: iki ayrı ayar tutmak iki yüzeyin sessizce ayrışması demek).
function veFeadVibGainOf(node){
  var v = _feadNum(node && node.data && node.data.vibGain, NaN);
  if(!Number.isFinite(v)) return VE_FEAD_VIB_GAIN_DEF;
  return Math.min(VE_FEAD_VIB_GAIN_MAX, Math.max(VE_FEAD_VIB_GAIN_MIN, v));
}

// Kartın titreşim seçimi: 'off' | 'span' | 'mode:<k>'
function veFeadVibModeOf(node){
  var v = node && node.data && node.data.vibMode;
  if(v === 'span') return 'span';
  if(typeof v === 'string' && /^mode:\d+$/.test(v)) return v;
  return 'off';
}

// SDOF büyütme çarpanı. r = uyarma/doğal.
function _feadVibMag(r, zeta){
  var a = 1 - r*r, b = 2*zeta*r;
  var d = Math.sqrt(a*a + b*b);
  return d > 1e-9 ? 1/d : 1/(2*zeta);
}

// Bir açıklığın ateşleme mertebelerine karşı en büyük büyütmesi.
// Mertebe k'nin uyarma frekansı k·f_ateşleme; katkısı 1/k ile zayıflatılır.
function _feadVibSpanMag(fSpan, fFire, zeta){
  if(!(fSpan > 0) || !(fFire > 0)) return 1;
  var cap = 1/(2*zeta), best = 0;
  for(var k=1;k<=VE_FEAD_VIB_ORDERS;k++){
    var m = Math.min(cap, _feadVibMag(k*fFire/fSpan, zeta)) / k;
    if(m > best) best = m;
  }
  return best;
}

// ── AÇIKLIK ÇIRPMASI YÜKÜ ───────────────────────────────────────────────────
// Frekans ÇEKİRDEKTEN (spanFrequencies), genlik ilan edilmiş kazançtan.
// `slow` kinematiğin ağır çekim katsayısı: aynı katsayı kullanılır ki
// "bir kayış turunda kaç çırpma" oranı ekranda BİREBİR kalsın.
function veFeadVibSpanPayload(build, engineRpm, slow, gain, relDeg){
  if(!build || !build.ok || !build.sys || typeof FEADCore === 'undefined') return null;
  var rpm = _feadNum(engineRpm, NaN);
  if(!(rpm > 0)) return null;
  var g = Math.min(VE_FEAD_VIB_GAIN_MAX, Math.max(VE_FEAD_VIB_GAIN_MIN, _feadNum(gain, VE_FEAD_VIB_GAIN_DEF)));
  var sys = build.sys, st, T, fr, fFire, cyl;
  try {
    var rel = Number.isFinite(_feadNum(relDeg, NaN)) ? _feadNum(relDeg, NaN) : FEADCore.meanRel(sys);
    st = FEADCore.tensionerState(sys, rel);
    T  = FEADCore.spanTensions(sys, { engineRpm: rpm, loadsKw: {} });
    fr = FEADCore.spanFrequencies(sys, st.geom, T.spanN, { engineRpm: rpm, modes: 1 });
    cyl = _feadNum(build.solver && build.solver.data && build.solver.data.cylinders, 6);
    if(!(cyl > 0)) cyl = 6;
    fFire = FEADCore.firingFrequencyHz(rpm, cyl, 4);
  } catch(e){ return null; }

  var sl = (_feadNum(slow, NaN) > 0) ? _feadNum(slow, NaN) : 1;
  var fMax = 0;
  fr.forEach(function(s){
    var f = (s.fHz && s.fHz.length) ? s.fHz[0] : 0;
    if(s.flutter || !(f > 0)) f = fFire;
    if(f > fMax) fMax = f;
  });
  // EK AĞIR ÇEKİM — yalnız gerekiyorsa. Uygulanınca kinematikle olan oran
  // bozulur, o yüzden katsayı künyeye yazılıyor (extra > 1 ise).
  var extra = 1;
  if(fMax * sl > VE_FEAD_VIB_MAX_SCREEN_HZ && fMax > 0)
    extra = (fMax * sl) / VE_FEAD_VIB_MAX_SCREEN_HZ;
  var vs = sl / extra;

  var cap = 1/(2*VE_FEAD_VIB_ZETA), varCirp = false;
  var spans = fr.map(function(s, i){
    var f = (s.fHz && s.fHz.length) ? s.fHz[0] : 0;
    var fl = !!s.flutter || !(f > 0);
    if(fl){ varCirp = true; f = fFire; }              // duran dalga yok — akıp giden dalga
    var mag = fl ? cap : _feadVibSpanMag(f, fFire, VE_FEAD_VIB_ZETA);
    return {
      f: f, fScreen: f * vs, ampMm: VE_FEAD_VIB_SPAN_MM * g * mag,
      // Faz açıklıktan açıklığa kaydırılır: hepsi aynı anda tepeye çıksaydı
      // kayış nefes alıyormuş gibi görünürdü, oysa açıklıklar bağımsız.
      ph: (i * 2*Math.PI / Math.max(1, fr.length)),
      mag: mag, flutter: fl, LMm: s.LMm, TN: s.TN
    };
  });
  return { kind: 'span', gain: g, zeta: VE_FEAD_VIB_ZETA, extraSlow: extra,
           firingHz: fFire, cylinders: cyl, engineRpm: rpm, anyFlutter: varCirp,
           spans: spans };
}

// ── MOD ŞEKLİ YÜKÜ ──────────────────────────────────────────────────────────
// Şekil BİR SONUÇTUR (özvektör); yalnız ÖLÇEĞİ gösterim kazancıdır — bir
// özvektörün ölçeği zaten tanımsızdır, dolayısıyla burada uydurulan bir şey
// yok. Kol dönüşü kasnak merkezini pivot etrafında KATI CİSİM olarak döndürür;
// teğet noktalarının kayması ihmal edilir (küçük açıda O(δ²)).
function veFeadVibModeList(build, opts){
  if(!build || !build.ok || !build.sys || typeof FEADCore === 'undefined') return null;
  try {
    var T = FEADCore.torsionalModel(build.sys, veFeadTorsionalOpt(build, opts || {}));
    return T.modes.filter(function(m){ return m.fHz > 1e-6; }).map(function(m){ return m.fHz; });
  } catch(e){ return null; }
}

function veFeadVibModePayload(build, modeIdx, gain, opts, relDeg){
  if(!build || !build.ok || !build.sys || typeof FEADCore === 'undefined') return null;
  var sys = build.sys, n = sys.pulleys.length, t = sys._tenIdx;
  if(!(t >= 0)) return null;
  var g = Math.min(VE_FEAD_VIB_GAIN_MAX, Math.max(VE_FEAD_VIB_GAIN_MIN, _feadNum(gain, VE_FEAD_VIB_GAIN_DEF)));
  var T, st;
  try {
    var rel = Number.isFinite(_feadNum(relDeg, NaN)) ? _feadNum(relDeg, NaN) : FEADCore.meanRel(sys);
    T  = FEADCore.torsionalModel(sys, veFeadTorsionalOpt(build, opts || {}));
    st = FEADCore.tensionerState(sys, rel);
  } catch(e){ return null; }
  var elastic = T.modes.filter(function(m){ return m.fHz > 1e-6; });
  var k = Math.max(0, Math.min(elastic.length - 1, Math.round(_feadNum(modeIdx, 0))));
  var m = elastic[k];
  if(!m) return null;

  var mx = 0;
  m.shape.forEach(function(s){ var a = Math.abs(s.amp); if(a > mx) mx = a; });
  if(!(mx > 0)) return null;
  var degTop = Math.min(VE_FEAD_VIB_MODE_MAX_DEG, VE_FEAD_VIB_MODE_DEG * g);
  var sc = (degTop * Math.PI/180) / mx;

  var spin = [];
  for(var i=0;i<n;i++) spin.push((m.shape[i] ? m.shape[i].amp : 0) * sc);
  var armRad = (m.shape[n] ? m.shape[n].amp : 0) * sc;

  var pv = null;
  try { pv = sys.tensioner.pivot ? [sys.tensioner.pivot[0], sys.tensioner.pivot[1]] : null; } catch(e){ pv = null; }
  var tc = st.geom.pulleys[t] ? [st.geom.pulleys[t].c[0], st.geom.pulleys[t].c[1]] : null;
  if(!pv || !tc) return null;

  return { kind: 'mode', gain: g, idx: k, fHz: m.fHz, modeCount: elastic.length,
           screenHz: VE_FEAD_VIB_SCREEN_HZ, spin: spin, armRad: armRad,
           tenIdx: t, pivot: pv, tenC: tc, topDeg: degTop,
           elasticHz: elastic.map(function(x){ return x.fHz; }) };
}

// ─── Tahrik oranı: krank kasnağı → sürücü (fan) kasnağı ─────────────────────
// Sayfa oranı iki ÇAPLA veriyor (krank 197.32 / fan 179.62 = 1.0985 ≈ 1.1),
// çünkü FEAD kayışının sürücü kasnağı krank milinde DEĞİL: krank ayrı bir
// kayış/kademeyle fan kasnağını döndürüyor, FEAD kayışı da onun üzerinden
// tahrik ediliyor. driveRatio = sürücü kasnak devri / motor devri.
// Oran-için-yeterli sistem: `FEADCore.accessoryRpm`'in okuduğu ÜÇ alanı taşır
// (driveRatio · pulleys[i].rPitch · _crkIdx) ve başka hiçbir şeyi. Yarıçaplar
// çekirdeğin kendi yardımcılarından geliyor — ikinci bir formül YOK.
//
// Çap ya da profil eksikse `null` döner: uydurulmuş bir yarıçap, uydurulmuş
// bir devir ve uydurulmuş bir kW demekti.
function veFeadRatioSys(cfgPulleys, cfgBelt, driveRatio){
  if(typeof FEADCore === 'undefined' || !cfgPulleys || !cfgPulleys.length) return null;
  var bp;
  try { bp = FEADCore.beltProps(cfgBelt || {}); } catch(e){ return null; }
  var crk = -1, out = [];
  for(var i = 0; i < cfgPulleys.length; i++){
    var p = cfgPulleys[i];
    if(!(p.od > 0)) return null;
    var r;
    try { r = FEADCore.radiiFromOD(p.od, p.contact, bp); } catch(e){ return null; }
    out.push({ name: p.name, rPitch: r.rPitch, rEff: r.rEff });
    if(p.crank) crk = i;
  }
  if(crk < 0) return null;
  return { driveRatio: (driveRatio > 0) ? driveRatio : 1, pulleys: out, _crkIdx: crk };
}

// ── ÜÇ KİP, ÇÜNKÜ İKİ FARKLI FİZİKSEL DÜZEN VAR ─────────────────────────────
//
// Kullanıcı bildirimi (2026-09-02): *"Bazen fan kavraması krank kasnağının
// hemen önünde oluyor ve krank kasnağı ile aynı devirde dönüyor. Böyle
// olduğunda tahrik oranı 1 oluyor doğal olarak. Bazen de farklı bir yerde
// oluyor. Bunu seçenek haline getirmemiz lazım."*
//
// `unity` kipi `direct` + 1 ile SAYISAL OLARAK aynı sonucu verir ama aynı şey
// değildir ve ayrılması gereken şey NİYET: `direct`, oranı bilen ve elle yazan
// kullanıcıdır; `unity`, "böyle bir kademe YOK" diyen düzendir. İkisini tek
// alanda tutmak iki sessiz kusur üretiyordu:
//   • boş bırakılmış `driveRatio` 1'e düşüyordu, yani "girmedim" ile
//     "kademe yok" ayırt edilemiyordu — panel ikisinde de 1,0000 basıyordu;
//   • ÖLÇÜLDÜ (AG00879, tedarikçi raporuyla karşılaştırma): tek kademeli bir
//     sisteme `derive` kipinden kalmış 1,430 oranı sızmış ve BÜTÜN aksesuar
//     devirlerini %43 kaydırmıştı (kayış hızı 17,5 → 25,0 m/s). Hata sessizdi
//     çünkü çaplar geçerli sayılardı; yanlış olan kipti.
//
// Bu yüzden `unity` kipinde ÇAP DA ORAN DA SORULMAZ: sorulacak bir şey yok.
function veFeadDriveRatio(sd){
  sd = sd || {};
  var out = { ratio: 1, mode: 'direct', crankOD: NaN, fanOD: NaN, ok: false };
  // TEK KADEMELİ DÜZEN: fan kavraması krankın hemen önünde, sürücü kasnak
  // motorla aynı devirde. Oran tanımı gereği 1 — türetilecek bir şey yok.
  // ── ÜÇ DÜZEN, İKİ ORAN ───────────────────────────────────────────────────
  // Kullanıcı tarifi (2026-09-04):
  //   (a) "direk krank kasnağı tahrik kasnağı oluyor" → FEAD'i krank kasnağı
  //       tahrik ediyor, oran 1. Kasnaklar tablosundaki sürücü çapı = krank
  //       kasnağının çapı.
  //   (b) "onun önüne … krank kasnağına bağlı olduğu için aynı devirde dönen
  //       (tahrik oranı 1 olan) başka bir SÜRÜCÜ KASNAK" → oran YİNE 1; değişen
  //       tek şey, FEAD'i tahrik eden ÇAP. O çap zaten Kasnaklar tablosunda,
  //       sürücü satırında duruyor. Krank kasnağının kendi çapı bir MOTOR
  //       VERİSİDİR ve orana girmez.
  //   (c) Gerçek ara kademe: krank ile sürücü kasnak FARKLI devirde
  //       (BMC_FEAD_2026: tedarikçi sayfasının kendi değeri 197,32/179,62 =
  //       1,0985). Oran ancak burada 1'den farklı.
  //
  // (a) ve (b) SAYISAL OLARAK aynı orana (1) çıkar ama aynı şey değildir ve
  // ayrılması gereken şey yine NİYET: (b)'de krank çapı KAYITLIDIR ve rapora
  // girer, (a)'da diye bir çap yoktur. `crankDirect` bu ayrımı taşıyor.
  if(sd.ratioMode === 'unity' || sd.ratioMode === 'crankDirect'){
    out.mode = sd.ratioMode; out.ratio = 1; out.ok = true;
    return out;
  }
  var crank = _feadNum(sd.crankOD, NaN), fan = _feadNum(sd.fanOD, NaN);
  out.crankOD = crank; out.fanOD = fan;
  if(sd.ratioMode !== 'direct' && crank > 0 && fan > 0){
    out.mode = 'derive'; out.ratio = crank / fan; out.ok = true;
    return out;
  }
  var r = _feadNum(sd.driveRatio, NaN);
  if(Number.isFinite(r) && r > 0){ out.ratio = r; out.ok = true; }
  return out;
}
function veFeadDriveModeLabel(mode){
  return mode === 'crankDirect' ? 'krank kasnağı doğrudan sürücü (1:1)'
       : mode === 'unity' ? 'kranka bağlı ayrı sürücü kasnak (1:1)'
       : mode === 'derive' ? 'ara kademe — çaplardan türetildi'
       : 'elle girildi';
}

// ─── ÖRNEK KAYIT DEFTERİ ────────────────────────────────────────────────────
//
// Örnekler VERİ olarak burada durur (DOM'suz katman); kanvasa kurma işi sunum
// katmanının (cp-fead.js). Böylece birim testi örneği kanvas olmadan çözebiliyor
// ve sayfadaki referans değerlere çıpalayabiliyor.
//
// BMC_FEAD_2026: tedarikçiye giden FEAD_INFORMATION sayfasının birebir
// karşılığı. Sayfada yazan ve BU VERİDEN ÇIKMASI GEREKEN dört değer:
//   • kayış efektif boyu   1715 mm   ("modelden bulunan")
//   • gergi kol boyu       90.0 mm   (|montaj merkezi − pivot| ile aynı olmalı)
//   • Spring Mean Load     22.07 Nm  (çalışma noktasındaki yay momenti)
//   • tahrik oranı         197.32 / 179.62 = 1.0985 ≈ 1.1
// Dördü de tests/unit/fead-example.test.js'te çıpa; biri kayarsa test kırılır.
var VE_FEAD_EXAMPLES = {
  'BMC_FEAD_2026': {
    name: 'BMC 6 silindir — FEAD (tedarikçi sayfası)',
    note: 'FEAD_INFORMATION sayfasındaki 6 kasnaklı düzen: fan tahrikli sürücü '
        + 'kasnak, iki avara, klima kompresörü, alternatör ve otomatik gergi. '
        + 'Kayış 8PK/EPDM, efektif boy 1715 mm, servis faktörü 1.3.',
    belt:  { profile:'PK', brand:'GATES', beltType:'8PK 1715', ribs:8,
             effLength:1715, tolerance:0, wearPct:0 },
    // Tasarım gerginliği burada YOK ve olmamalı: sayfa da vermiyor, model de
    // sormuyor. Yay dengesinden türetiliyor ve bu sistemde 650 N çıkıyor
    // (22.28 Nm / 0.5984 mm/°) — fead-example.test.js bunu çıpalıyor.
    solver:{ crankOD:197.32, fanOD:179.62, ratioMode:'derive',
             cylinders:6, serviceFact:1.3, crankInertia:0.70,
             accelRpmS:1000, decelRpmS:1000, lengthOffsetMm:0,
             // Sayfadaki Duty Cycle tablosu (% ↔ Engine RPM); %0'lık 3000 satırı
             // alınmaz — ağırlığı sıfır olan bir devir noktası hesaba girmez.
             duty:[ {rpm:800,dcPct:25,degC:90}, {rpm:1000,dcPct:4,degC:90},
                    {rpm:1250,dcPct:5,degC:90}, {rpm:1500,dcPct:6,degC:90},
                    {rpm:1750,dcPct:9,degC:90}, {rpm:2000,dcPct:12,degC:90},
                    {rpm:2250,dcPct:18,degC:90}, {rpm:2500,dcPct:16,degC:90},
                    {rpm:2750,dcPct:5,degC:90} ] },
    pulleys: [
      { key:'SRC',  type:'fead-crank',      name:'Sürücü Kasnak',
        data:{ od:162, x:0,        y:0,       contact:'grooved', driver:true, inertia:0.064 } },
      { key:'IDR1', type:'fead-idler',      name:'Avara 1',
        data:{ od:75,  x:130.080,  y:139.920, contact:'back',    inertia:0.00087 } },
      { key:'A_C',  type:'fead-ac',         name:'Klima Kompresörü',
        data:{ od:152, x:184.190,  y:314.490, contact:'grooved', inertia:0.031,
               // Sayfadaki "AIR COMPRESOR" tablosu — AKSESUAR devri ↔ kW.
               pwrCurve:[ {rpm:939,kw:1.63},  {rpm:1173,kw:2.52}, {rpm:1291,kw:2.87},
                          {rpm:1408,kw:3.22}, {rpm:1642,kw:4.07}, {rpm:1760,kw:4.54},
                          {rpm:1877,kw:5.01}, {rpm:1994,kw:5.48}, {rpm:2112,kw:5.81},
                          {rpm:2229,kw:6.14}, {rpm:2346,kw:6.47}, {rpm:2464,kw:6.80} ] } },
      { key:'IDR2', type:'fead-idler',      name:'Avara 2',
        data:{ od:75,  x:0,        y:267.400, contact:'back',    inertia:0.00087 } },
      { key:'ALT',  type:'fead-alternator', name:'Alternatör',
        data:{ od:57,  x:-281.000, y:259.460, contact:'grooved', inertia:0.0144,
               // Sayfadaki "ALTERNATOR" tablosu — AKSESUAR devri ↔ kW.
               pwrCurve:[ {rpm:2520,kw:3.83}, {rpm:3150,kw:4.01}, {rpm:3465,kw:4.06},
                          {rpm:3780,kw:4.10}, {rpm:4410,kw:4.15}, {rpm:4725,kw:4.17},
                          {rpm:5040,kw:4.19}, {rpm:5355,kw:4.22}, {rpm:5670,kw:4.25},
                          {rpm:5985,kw:4.27}, {rpm:6300,kw:4.28}, {rpm:6615,kw:4.28} ] } },
      { key:'TEN',  type:'fead-tensioner',  name:'Otomatik Gergi',
        data:{ od:75, contact:'back', inertia:0.00087,
               // ── PİVOT GİRDİ DEĞİL, TÜRETİLİYOR ────────────────────────────
               // Kullanıcı kararı (2026-08-25): "Otomatik gergi bileşeninde kol
               // ve pivot kısmına kullanıcı girdi girmeyecek. Kullanıcının
               // girdiği koordinat gergi KASNAĞININ merkezi; pivot noktası
               // sonra hesaplanıyor."
               //
               // Sayfanın koordinat tablosundaki "Gergi Kasnağı" satırı
               // (−170,080 / 99,160 · Ø75 flat) diğer bütün kasnaklarla AYNI
               // şeydir: kasnağın merkezi. Alternatör satırı bunun kanıtı —
               // orada da gövdenin (kocaman) değil Ø57'lik KASNAĞIN merkezi
               // yazıyor.
               //
               // Kapanışı gerginin PARÇA ÇİZİMİ veriyor:
               //   "E9843 PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm
               //    SPRING TORQUE @ 28° FREEARM-MEAN ROTATION"
               // yani kolun çalışma konumundaki MUTLAK açısı, parçanın konum
               // pimiyle birlikte OKUNAN bir değerdir — türetilmiyor.
               //   pivot = c − a·(cos θ, sin θ)
               //
               // MUTLAK AÇI SALT PARÇAYA AİT DEĞİL, MONTAJA DA BAĞLI: aynı
               // E9843 Gates raporunda 347,99°'de duruyor. Parçanın kendi
               // değişmezi BAĞIL dönme — "28° FREEARM-MEAN" ↔ yay künyesinden
               // türeyen (22,07−8,60)/0,480 = 28,06° — ve iki örnek de onu
               // doğruluyor (BMC 28,43° · AG00976 28,08°). Bu yüzden iki örnek
               // FARKLI mutlak açı taşır ve biri "düzeltilerek" öbürüne
               // eşitlenmemelidir.
               //
               // ÖLÇÜLDÜ — üç hipotez çözdürüldü (Gates AG00976'nın 543,9 N'una):
               //   koordinat = kasnak · θ=344° (çizim) → T 532,1 N  (−%2,2) ✔
               //   koordinat = kasnak · θ=348° (Gates)  → T 561,1 N  (+%3,2)
               //   koordinat = PİVOT (zarf kipi)        → T 279,4 N  (−%48,6) ✘
               //
               // ÜÇÜNCÜ SATIR bir dönem GİRDİ BİÇİMİYDİ (2026-08-28…09-01,
               // "zarf kipi") ve bugün elenmiş durumda; ölçümü duruyor çünkü
               // aynı yön yeniden denenirse bedeli budur:
               //   zarfın seçtiği θ=114,6° → T 279,4 N · L 1738,2 mm (+%1,36)
               //   sarım sapması RMS 15,4°, en kötü +27,9° (ALT), TEN +25,1°
               //   360°'in TAMAMI tarandı: boyu ve gerginliği BİRLİKTE tutan
               //   açı YOK (gevşek pencerede kalan 2 açıda sarım çöküyor)
               //
               // ÖRNEK ARTIK SAYFANIN KENDİ KOORDİNATINI TAŞIYOR. Bir dönem
               // buraya o koordinattan TÜRETİLMİŞ montaj konumu (−256,59 /
               // 123,97) yazılıydı; girdi yönü çevrilince ikinci el sayı
               // gereksiz kaldı. ÖLÇÜLDÜ — çevrimin bedeli yok:
               //   türeyen montaj konumu −256,5936 / 123,9674  (Δ 0,0044 mm)
               //   L 1715,2692 → 1715,2666 mm  ·  T 525,511 → 525,554 N (+%0,008)
               cenX:-170.080, cenY:99.160, armLen:90.0,
               armMeanDeg:344.0,
               preload:8.60, kArm:0.480, meanLoad:22.07,
               armInertia:0.0009, pulleyMass:0.80 } }
    ],
    // Kayış serpantin sırası: sürücüden başlar, sürücüye döner.
    route: ['SRC', 'IDR1', 'A_C', 'IDR2', 'ALT', 'TEN']
  },

  // ── AG00976 — TEDARİKÇİDEN DÖNEN GATES RAPORU ──────────────────────────────
  //
  // Yukarıdaki BMC_FEAD_2026 tedarikçiye GİDEN sayfadır (FEAD_INFORMATION,
  // 26 Mayıs 2025); bu ise ondan DÖNEN rapordur: "AG00976 BMC Otomotif FEAD 5 ·
  // Cummins Eng.Scndr ALT&AC Drive · Gates 8PK1715HD-Fleetrunner ·
  // Ten@-250/110 · Corrected-IDR1 · 05 Haziran 2025", Gates v13.02.
  //
  // İKİSİ DE DURUYOR ÇÜNKÜ AYNI DEĞİLLER. Sayfada olmayıp raporda olan üç şey
  // var ve üçü de sayıyı değiştiriyor (ölçüm aşağıda):
  //   • gergi PİVOTU        — sayfa yalnız kasnağın "öngörülen merkezi montaj
  //                            pozisyonunu" veriyor, pivotu vermiyor
  //   • kayış TOLERANSI     — ±6.00 mm  (sayfada yok → 0 kalıyordu)
  //   • AŞINMA PAYI         — %0.60     (sayfada yok → 0 kalıyordu)
  // Tolerans/aşınma 0 iken gergi konum tablosu tek noktaya çöküyor: Replace =
  // Max = Mean = Min. Yani kolun gezinme zarfı hiç görünmüyor.
  //
  // ── EFEKTİF BOY 1714.6, "1715" DEĞİL ────────────────────────────────────────
  // Raporun başlığı "Effective Belt Length (ISO 9981) 1715" yazıyor ama kendi
  // Tensioner Geometry tablosundaki REBL sütunu dört konumun DÖRDÜNDE de tam
  // 0.4 mm aşağıda: 1730.9 / 1720.6 / 1714.6 / 1708.6. Aradaki adımlar
  // (tol 6.0 ve wear 0.006·L) birebir tutuyor, yani kayan şey nominal boyun
  // KENDİSİ — "1715" yuvarlanmış katalog adı (8PK**1715**HD). ÖLÇÜLDÜ:
  //   effLength 1715.0 → en kötü kol 0.62° · gerginlik %2.28 · 2 sarım kayık
  //   effLength 1714.6 → en kötü kol 0.08° · gerginlik %0.29 · 12/12 birebir
  //
  // ── DEVİR SÜTUNU MOTOR DEVRİ DEĞİL, SÜRÜCÜ KASNAK DEVRİ ─────────────────────
  // Rapor FAN kasnağını krank kabul ediyor ("Speed Ratio (Ref. Engine) FAN =
  // 1.000") ve duty tablosunun "Engine RPM" sütunu o kasnağın devri. Sayfanın
  // kendi ilk satırı bunu doğruluyor: motor 800 × 1.1 = 880. Bu yüzden burada
  // driveRatio 1 — raporu GERİ ÜRETMEK için gereken tanım budur. Gerçek motor
  // devri isteniyorsa ratioMode 'derive' + krank/fan çapları kullanılır
  // (BMC_FEAD_2026 öyle kurulu).
  'AG00976_GATES_2025': {
    name: 'BMC Otomotif FEAD 5 — Gates AG00976 raporu',
    note: 'Tedarikçiden dönen Gates raporunun (8PK1715HD, Ten@-250/110, '
        + 'Corrected-IDR1, 05.06.2025) birebir modeli. Aynı 6 kasnaklı düzen, '
        + 'ama gergi PİVOTU, kayış toleransı (±6 mm) ve aşınma payı (%0.60) '
        + 'raporda var, tedarikçiye giden sayfada yok. Raporun sonuç '
        + 'sayfalarını geri üretir.',
    belt:  { profile:'PK', brand:'GATES', beltType:'8PK1715HD', ribs:8,
             // Bkz. yukarıdaki "EFEKTİF BOY" notu: rapor başlığı 1715 diyor,
             // kendi REBL sütunu 1714.6 istiyor.
             effLength:1714.6, tolerance:6, wearPct:0.006,
             // KAYIŞ KÜTLESİ AÇIKÇA GEÇİLİR — çekirdeğin KENDİ uyarısı bunu
             // istiyor (fead-core.js, BELT_DB): Gates PK'nın KATALOG kütlesi
             // 0.0144 kg/m/kaburga, ama hem kesit tahmini hem AG00686 frekans
             // haritasından geri-hesap ~0.0196 veriyor ve çekirdek "acikca
             // gecmek onerilir" diye yazıyor.
             //
             // Alan boş bırakılınca katalog değeri kullanılıyordu ve ÖLÇÜLDÜ:
             // açıklık frekansları %16,7 YÜKSEK çıkıyor (2750 d/d'de
             // 299,0 · 312,9 · 237,6 · 131,3 · 155,8 · 214,3 Hz yerine
             // 250,1 · 261,7 · 196,3 · 108,5 · 127,1 · 174,7). Hata EMNİYETLİ
             // TARAFTA DEĞİL: kütle arttıkça f₁ düşer, yani katalog değeri
             // rezonans riskini olduğundan KÜÇÜK gösteriyor — ateşleme
             // frekansıyla kesişen hücre 1/72 yerine 3/72, en düşük
             // f₁/ateşleme oranı 0,955 yerine 0,789.
             //
             // Yalnız FREKANS tablosunu etkiliyor: B10 (1403,032) ve tasarım
             // gerginliği (544,0497) her iki değerde de BİREBİR aynı.
             massPerRibKgM:0.0196 },
    solver:{ ratioMode:'direct', driveRatio:1,
             cylinders:6, serviceFact:1.3, crankInertia:0.70,
             // "Peak Tension & Hubload" sayfasındaki Accel. RPM/s sütunu.
             accelRpmS:1100, decelRpmS:1100,
             // EDL − REBL: raporun iki uzunluk sütunu arasındaki sabit fark.
             lengthOffsetMm:1.6,
             // "Load Conditions for DC 95%" sayfası. kW'lar KASNAK ANAHTARIYLA
             // yazılır (kwByKey); veFeadExampleNodes bunu düğüm kimliğine
             // çevirir — örnek verisi okunabilir kalsın, kimlik şeması tek
             // yerde dursun. Sürücü (FAN) sütunu YOK: çekirdek onu diğerlerinin
             // toplamı olarak hesaplar (raporda da 6.34 = 2.70+3.61+3×0.01).
             duty:[
               { rpm:880,  dcPct:25.0, degC:90, kwByKey:{ A_C:2.70, ALT:3.61, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:1000, dcPct:4.0,  degC:90, kwByKey:{ A_C:3.60, ALT:3.78, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:1100, dcPct:4.5,  degC:90, kwByKey:{ A_C:4.00, ALT:3.83, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:1200, dcPct:5.0,  degC:90, kwByKey:{ A_C:4.40, ALT:3.87, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:1400, dcPct:5.5,  degC:90, kwByKey:{ A_C:5.10, ALT:3.93, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:1500, dcPct:6.0,  degC:90, kwByKey:{ A_C:5.40, ALT:3.94, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:1600, dcPct:7.5,  degC:90, kwByKey:{ A_C:5.70, ALT:3.69, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:1700, dcPct:9.0,  degC:90, kwByKey:{ A_C:6.00, ALT:3.97, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:1800, dcPct:0.5,  degC:90, kwByKey:{ A_C:6.30, ALT:3.98, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:2000, dcPct:12.0, degC:90, kwByKey:{ A_C:6.70, ALT:3.99, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:2500, dcPct:16.0, degC:90, kwByKey:{ A_C:7.00, ALT:4.00, IDR1:0.01, IDR2:0.01, TEN:0.01 } },
               { rpm:2750, dcPct:5.0,  degC:90, kwByKey:{ A_C:7.40, ALT:4.02, IDR1:0.01, IDR2:0.01, TEN:0.01 } }
             ] },
    // "Layout Data" sayfası. MFSim DIŞ ÇAP (od) ister; raporun Pitch/Effective
    // sütunlarını çekirdek hb/hr ile kendisi türetir ve BİREBİR tutturur:
    //   grooved od 162 → pitch 164.4 / eff 162.0   (rapor: 164.40 / 162.00)
    //   back    od  75 → pitch  77.2 / eff  79.6   (rapor:  77.20 /  79.60)
    // Ataletler tedarikçiye giden sayfadan (rapor onları basmıyor).
    pulleys: [
      { key:'FAN',  type:'fead-fan',         name:'Sürücü Kasnak (FAN)',
        data:{ od:162, x:0,        y:0,      contact:'grooved', driver:true, inertia:0.064 } },
      { key:'IDR1', type:'fead-idler',       name:'Avara 1',
        data:{ od:75,  x:130.10,   y:139.90, contact:'back',    inertia:0.00087 } },
      { key:'A_C',  type:'fead-ac',          name:'Klima Kompresörü',
        data:{ od:152, x:184.20,   y:314.50, contact:'grooved', inertia:0.031 } },
      { key:'IDR2', type:'fead-idler',       name:'Avara 2',
        data:{ od:75,  x:0,        y:267.40, contact:'back',    inertia:0.00087 } },
      { key:'ALT',  type:'fead-alternator',  name:'Alternatör (155 A)',
        data:{ od:57,  x:-281.00,  y:259.50, contact:'grooved', inertia:0.0144 } },
      { key:'TEN',  type:'fead-tensioner',   name:'Otomatik Gergi (E9843)',
        // Merkez = "Layout Data"nın TEN satırı (−161,97 / 91,29), yani diğer
        // beş kasnakla AYNI sütun: çalışma konumundaki kasnak merkezi.
        //
        // BAĞIMSIZ DOĞRULAMA — rapor gerginin montaj konumunu da AYRI bir
        // alanda yazıyor ("Tensioner Data", dosya adında da: Ten@-250/110) ve
        // model onu bu iki satırdan TÜRETİYOR:
        //   p = c − a·(cos θ, sin θ) = −250,0035 / 110,0008   → Δ 0,0035 mm
        // İki nokta arasındaki uzaklık tam kol boyu (90,00 mm). Bu bir kapı
        // DEĞİL (karşılaştırma yapılmıyor), raporun kendi iki satırının aynı
        // kolun iki ucu olduğunun ölçüsü. Serbest açı buradan 16,07° çıkıyor,
        // raporun "Free Arm" satırı 16,1° — 0,03°.
        data:{ od:75, contact:'back', inertia:0.00087,
               cenX:-161.97, cenY:91.29, armLen:90.0,
               armMeanDeg:-11.9992,
               preload:8.60, kArm:0.480, meanLoad:22.07,
               // Gates E9843 — çekirdeğin kendi ölçülmüş gergi künyesi
               // (CALIBRATION.tensionerArmInertiaKgM2.measured.E9843).
               // Burulma modeline J = armInertia + pulleyMass·a² olarak girer.
               armInertia:0.0009, pulleyMass:0.80,
               // "Tensioner Geometry" tablosunun Load sütunu: mekanik stop.
               loadStopRelDeg:60.4 } }
    ],
    // Raporun kasnak sırası (Layout Data satır sırası = kayış gidiş yönü).
    route: ['FAN', 'IDR1', 'A_C', 'IDR2', 'ALT', 'TEN']
  },

  // ── AG00879 — ANADOLU ISUZU 6x6, İKİNCİ BİR GATES RAPORU ───────────────────
  //
  // "AG00879 ANADOLU-ISUZU 6x6 Truck Secondary ALT Drive · 8PK1392HD ·
  // Gates T38665 31Nm · 17 Mayıs 2023", Gates v9.40, 12 sayfa.
  //
  // NEDEN ÜÇÜNCÜ ÖRNEK: yukarıdaki ikisi AYNI aracın iki belgesi (giden sayfa ↔
  // dönen rapor) ve aynı gergiyi (E9843) paylaşıyor. Bu ise BAŞKA bir araç,
  // BAŞKA bir gergi (T38665, kol 56 mm — E9843'ün 90 mm'sinin üçte ikisi),
  // BEŞ kasnak ve tamamen farklı çaplar. Fixture'ın kendi notu da bunu
  // söylüyor: "modelin evrenselligini sinar".
  //
  // ── REFERANS DEĞERLER ZATEN DEPODA ─────────────────────────────────────────
  // Rapor tests/fixtures/fead-validation.js içinde AG_MISC.AG00879 olarak
  // duruyor (2095 değerlik doğrulama kapısının parçası). Eksik olan onu kanvasa
  // KURULABİLİR yapmaktı. Test referansları fixture'dan okur — İKİNCİ KOPYA YOK.
  //
  // ── EFEKTİF BOY BURADA TUZAK DEĞİL ─────────────────────────────────────────
  // AG00976'da rapor başlığı (1715) ile REBL sütunu (1714.6) AYRIŞIYORDU ve
  // katalog adını boy sanmak 0.56°'lik bir kol hatası veriyordu. Burada ikisi
  // AYNI: başlık "Effective Belt Length (ISO 9981) 1392", REBL(Mean) 1392.0.
  // Yani o tuzak her raporda ısırmıyor — ama hangisinin geçerli olduğunu
  // REBL sütunu söyler, başlık değil.
  //
  // ── ATALETLER RAPORDAN GELİYOR — İLK KAYIT YANILIYORDU ────────────────────
  // Bu blok bir dönem "silindir sayısı, krank ataleti, kasnak ataletleri bu
  // belgede YOK, yazılmadılar" diyordu. TUTMADI: dördü de raporun 11. sayfasında
  // ("System Vibration Analysis") duruyor ve `tests/helpers/gates-vibration.js`
  // onları KAYNAĞINDAN okuyor. Yanlış olan belge değil, o sayfanın hiç
  // açılmamış olmasıydı.
  //
  // Sürücü düğümüne KRANK MİLİ ataleti giriyor: burulma modelinin sürücü
  // serbestliği krank milidir (doğrulama harness'i de öyle besliyor).
  'AG00879_GATES_2023': {
    name: 'Anadolu Isuzu 6x6 — Gates AG00879 raporu',
    note: 'Cummins ikincil ALT&AC tahriki, 5 kasnak (FAN · Avara · Klima · '
        + 'Alternatör · Gergi). Gates 8PK1392HD, gergi T38665 (kol 56 mm). '
        + 'Farklı araç, farklı gergi ve farklı çaplarla modelin '
        + 'evrenselliğini sınar; raporun sonuç sayfalarını geri üretir.',
    // Başlık ve REBL(Mean) burada aynı fikirde: 1392.
    belt:  { profile:'PK', brand:'GATES', beltType:'8PK1392HD', ribs:8,
             effLength:1392, tolerance:5, wearPct:0.007 },
    solver:{ ratioMode:'direct', driveRatio:1,
             // "Speed Ratio (Ref. Engine) FAN = 1.000" → duty tablosunun
             // "Eng. RPM" sütunu SÜRÜCÜ KASNAK devri (AG00976 ile aynı kural).
             // Peak Tension sayfasının Accel. sütunu: 1000 RPM/s.
             accelRpmS:1000, decelRpmS:1000,
             // EDL(Mean) 1392.7 − L_nominal 1392.0.
             lengthOffsetMm:0.7,
             // "Engine Data": 6 silindir · krank mili ataleti 0.1500 kg·m².
             cylinders:6, crankInertia:0.1500,
             // "Load Conditions kW for DC 95%" sayfası; hepsi 80 °C.
             // Sürücü (FAN) sütunu YOK — çekirdek onu toplamdan hesaplar ve
             // raporun kendi değerlerini veriyor (4.92 / 6.72 / 9.52 / 12.42 /
             // 14.82 kW), testi bunu ölçüyor.
             duty:[
               { rpm:600,  dcPct:5,  degC:80, kwByKey:{ A_C:1.40, ALT:3.50, IDR:0.01, TEN:0.01 } },
               { rpm:800,  dcPct:35, degC:80, kwByKey:{ A_C:1.90, ALT:4.80, IDR:0.01, TEN:0.01 } },
               { rpm:1200, dcPct:35, degC:80, kwByKey:{ A_C:3.00, ALT:6.50, IDR:0.01, TEN:0.01 } },
               { rpm:1700, dcPct:20, degC:80, kwByKey:{ A_C:4.20, ALT:8.20, IDR:0.01, TEN:0.01 } },
               { rpm:2200, dcPct:5,  degC:80, kwByKey:{ A_C:6.00, ALT:8.80, IDR:0.01, TEN:0.01 } }
             ] },
    // "Layout Data mm" sayfası. MFSim DIŞ ÇAP ister; raporun Pitch/Effective
    // sütunlarını çekirdek hb/hr ile türetir ve birebir tutturur:
    //   grooved od = Effective  → pitch = od + 2·hb   (FAN 149.61 → 152.01)
    //   back    od = Flat       → pitch = od + 2·hr, eff = od + 2·hr + 2·hb
    //                                                (IDR  74.00 →  76.20 / 78.60)
    // AG00976'da FAN'ın Effective'i yuvarlak bir sayıydı (162.00) ve dış çapla
    // çakışıyordu; burada 149.61 — çakışmanın bir kural değil rastlantı olduğu
    // buradan görünüyor.
    //
    // ── ATALETLER RAPORUN 11. SAYFASINDAN ────────────────────────────────
    // "System Vibration Analysis" sayfası dört aksesuarın ataletini, gergi
    // kolununkini, gergi kasnağının kütlesini VE krank mili ataletini
    // basıyor. Bir dönem bu örnek onları taşımıyordu ve gerekçesi
    // *"rapor kasnak ataletlerini basmıyor"* diye yazılıydı — ÖLÇÜLDÜ ve
    // tutmadı: arşivdeki PDF'in kendisinde duruyorlar ve
    // `tests/helpers/gates-vibration.js` onları KAYNAĞINDAN okuyor.
    // Sürücü düğümüne KRANK MİLİ ataleti giriyor: burulma modelinin sürücü
    // serbestliği krank milidir, doğrulama harness'i de öyle besliyor
    // (`p.crank ? crankInertiaKgM2`).
    pulleys: [
      { key:'FAN', type:'fead-fan',         name:'Sürücü Kasnak (FAN)',
        data:{ od:149.61, x:0,      y:0,      contact:'grooved', driver:true,
               inertia:0.1500 } },
      { key:'IDR', type:'fead-idler',       name:'Avara',
        data:{ od:74.00,  x:140.00, y:-45.00, contact:'back', inertia:0.0001 } },
      { key:'A_C', type:'fead-ac',          name:'Klima Kompresörü',
        data:{ od:127.00, x:265.00, y:-40.00, contact:'grooved', inertia:0.0060 } },
      { key:'ALT', type:'fead-alternator',  name:'Alternatör',
        data:{ od:58.80,  x:320.00, y:200.00, contact:'grooved', inertia:0.0085 } },
      { key:'TEN', type:'fead-tensioner',   name:'Otomatik Gergi (T38665)',
        // Merkez = "Layout Data"nın TEN satırı (143,40 / 52,55), yani diğer
        // dört kasnakla AYNI sütun: çalışma konumundaki kasnak merkezi.
        // Kol açısı da raporun kendi "Tensioner Geometry" tablosundan: Mean
        // sütununun "Arm Position" satırı 225,0°.
        //
        // BAĞIMSIZ DOĞRULAMA — rapor gergi PİVOTUNU da ayrı bir alanda yazıyor
        // ("Tensioner Data": 183,00 / 92,15) ve model onu bu iki satırdan
        // TÜRETİYOR:
        //   p = c − a·(cos 225°, sin 225°) = 182,9980 / 92,1480  → Δ 0,0029 mm
        // Bu bir kapı DEĞİL (karşılaştırma yapılmıyor); raporun üç ayrı
        // satırının (merkez · kol açısı · pivot) aynı kolun tarifi olduğunun
        // ölçüsü. AG00976'da aynı ölçü 0,0035 mm.
        data:{ od:74.00, contact:'back',
               cenX:143.40, cenY:52.55, armLen:56.0,
               armMeanDeg:225.0,
               preload:20.05, kArm:0.409, meanLoad:31.14,
               // Raporun 11. sayfası: kasnak 0.0006 · kol 0.0060 · kütle 0.50.
               inertia:0.0006, armInertia:0.0060, pulleyMass:0.50,
               // "Tensioner Geometry" tablosunun Load sütunu: mekanik stop.
               loadStopRelDeg:39.0 } }
    ],
    // Raporun kasnak sırası (Layout Data satır sırası = kayış gidiş yönü).
    route: ['FAN', 'IDR', 'A_C', 'ALT', 'TEN']
  },

  // ══ ARŞİVİN GERİ KALANI — dokuz rapor, ÜRETİLMİŞ tanımlar ═══════════════════
  //
  // Kullanıcı isteği: "GitHub'da olan tüm Gates raporlarını programa örnek
  // olarak tanımlayalım." `docs/gates-reports/pdf/` altındaki on raporun
  // hepsi artık sihirbazda; yukarıdaki üçü elle, aşağıdaki dokuzu ÜRETİLDİ.
  //
  // NEDEN ÜRETİLDİ: her raporun referans değerleri
  // `tests/fixtures/fead-validation.js` içinde ZATEN duruyor (doğrulama
  // kapısının kendisi, 2095 değer). Aşağıdaki blokları elle yazmak o sayıların
  // İKİNCİ KOPYASI olurdu — dokuz rapor × ~40 sayı, ve ayrışması SESSİZ.
  // `tools/build-fead-gates-examples.js` onları fixture'dan + arşivin
  // PDF'lerinden üretiyor; çevrimler (pitch/effective → dış çap, REBL → kayış
  // boyu, Mean kol açısı, EDL−REBL → lengthOffset) o betikte TEK YERDE yazılı.
  //
  // ÜRETEÇ BİR BUILD ADIMI DEĞİL — bir iskele. Kaynak doğruluğun ölçüsü
  // `tests/unit/fead-examples-gates.test.js`: her örneği kurup fixture'a karşı
  // UÇTAN UCA koşturuyor (span · sarım · oran · konum tablosu · duty · ankraj).
  // Bir sayı kayarsa üreteci yeniden koşturmak değil, O TEST kırmızıya döner.
  //
  // ATALET ÜÇ ALINTI RAPORDA YOK: AG00894 ve AG00902 ×2'nin PDF'i tam rapor
  // değil ve "System Vibration Analysis" sayfası eksik. Oralarda atalet
  // YAZILMAZ; burulma modeli eksikliği kendisi söylüyor.

  'AG0868_4PK_GATES_2022': {
    name: "BMC 6 silindir — Gates AG0868 raporu (4PK)",
    note: "Üç kasnaklı en küçük düzen: krank · klima (SD7H15) · gergi. AYNI sistemin üç kaburga sayısındaki üç raporundan biri (4PK · E9843 @16 Nm) — kaburga ölçeklemesini yan yana görmek için üçü de duruyor.",
    belt:  { profile:'PK', brand:'GATES', beltType:"4PK1013HD", ribs:4,
             effLength:1013.4, tolerance:5, wearPct:0.007 },
    solver:{ ratioMode:'direct', driveRatio:1,
             cylinders:6,
             crankInertia:0.5,
             lengthOffsetMm:0.8,
             duty:[
               { rpm:800, dcPct:27, degC:90, kwByKey:{ A_C:1.3, TEN:0.01 } },
               { rpm:1000, dcPct:10, degC:90, kwByKey:{ A_C:1.5, TEN:0.01 } },
               { rpm:1250, dcPct:13, degC:90, kwByKey:{ A_C:4, TEN:0.01 } },
               { rpm:1500, dcPct:18, degC:90, kwByKey:{ A_C:4.6, TEN:0.01 } },
               { rpm:1750, dcPct:19, degC:90, kwByKey:{ A_C:4.7, TEN:0.01 } },
               { rpm:2000, dcPct:13, degC:90, kwByKey:{ A_C:4.7, TEN:0.01 } }
             ] },
    pulleys: [
      { key:'CRK', type:'fead-crank', name:"Krank Kasnağı",
        data:{ od:175.01, x:0, y:0, contact:'grooved', driver:true, inertia:0.5 } },
      { key:'A_C', type:'fead-ac', name:"Klima Kompresörü",
        data:{ od:118.01, x:263, y:15, contact:'grooved', inertia:0.0034 } },
      { key:'TEN', type:'fead-tensioner', name:"Otomatik Gergi (E9843)",
        data:{ od:75, contact:'back',
               cenX:121.28, cenY:68.38, armLen:90,
               armMeanDeg:215,
               preload:8.46, kArm:0.505, meanLoad:16.07,
               inertia:0.0009, armInertia:0.0009, pulleyMass:0.8,
               loadStopRelDeg:24.1 } }
    ],
    route: ['CRK', 'A_C', 'TEN']
  },

  'AG0868_6PK_GATES_2022': {
    name: "BMC 6 silindir — Gates AG0868 raporu (6PK)",
    note: "4PK kardeşiyle AYNI geometri, farklı kaburga sayısı ve yay momenti (6PK · E9843 @19 Nm). Kayış kütlesi ve gerginlik kaburgayla ölçekleniyor; üç rapor bunun ölçüsü.",
    belt:  { profile:'PK', brand:'GATES', beltType:"6PK1018HD", ribs:6,
             effLength:1018, tolerance:5, wearPct:0.007 },
    solver:{ ratioMode:'direct', driveRatio:1,
             cylinders:6,
             crankInertia:0.5,
             lengthOffsetMm:0,
             duty:[
               { rpm:800, dcPct:27, degC:90, kwByKey:{ A_C:1.3, TEN:0.01 } },
               { rpm:1000, dcPct:10, degC:90, kwByKey:{ A_C:1.5, TEN:0.01 } },
               { rpm:1250, dcPct:13, degC:90, kwByKey:{ A_C:4, TEN:0.01 } },
               { rpm:1500, dcPct:18, degC:90, kwByKey:{ A_C:4.6, TEN:0.01 } },
               { rpm:1750, dcPct:19, degC:90, kwByKey:{ A_C:4.7, TEN:0.01 } },
               { rpm:2000, dcPct:13, degC:90, kwByKey:{ A_C:4.7, TEN:0.01 } }
             ] },
    pulleys: [
      { key:'CRK', type:'fead-crank', name:"Krank Kasnağı",
        data:{ od:175.01, x:0, y:0, contact:'grooved', driver:true, inertia:0.5 } },
      { key:'A_C', type:'fead-ac', name:"Klima Kompresörü",
        data:{ od:118.01, x:263, y:15, contact:'grooved', inertia:0.0034 } },
      { key:'TEN', type:'fead-tensioner', name:"Otomatik Gergi (E9843)",
        data:{ od:75, contact:'back',
               cenX:124.57, cenY:63.97, armLen:90,
               armMeanDeg:218.5,
               preload:8.65, kArm:0.495, meanLoad:19.04,
               inertia:0.0009, armInertia:0.0009, pulleyMass:0.8,
               loadStopRelDeg:32.6 } }
    ],
    route: ['CRK', 'A_C', 'TEN']
  },

  'AG0868_8PK_GATES_2022': {
    name: "BMC 6 silindir — Gates AG0868 raporu (8PK)",
    note: "Üçlünün en güçlüsü (8PK · E9843 @22.5 Nm). Aynı üç kasnak, aynı koordinatlar; değişen yalnız kayış ve yay künyesi.",
    belt:  { profile:'PK', brand:'GATES', beltType:"8PK1020HD", ribs:8,
             effLength:1020, tolerance:5, wearPct:0.007 },
    solver:{ ratioMode:'direct', driveRatio:1,
             cylinders:6,
             crankInertia:0.5,
             lengthOffsetMm:-0.3,
             duty:[
               { rpm:800, dcPct:27, degC:90, kwByKey:{ A_C:1.3, TEN:0.01 } },
               { rpm:1000, dcPct:10, degC:90, kwByKey:{ A_C:1.5, TEN:0.01 } },
               { rpm:1250, dcPct:13, degC:90, kwByKey:{ A_C:4, TEN:0.01 } },
               { rpm:1500, dcPct:18, degC:90, kwByKey:{ A_C:4.6, TEN:0.01 } },
               { rpm:1750, dcPct:19, degC:90, kwByKey:{ A_C:4.7, TEN:0.01 } },
               { rpm:2000, dcPct:13, degC:90, kwByKey:{ A_C:4.7, TEN:0.01 } }
             ] },
    pulleys: [
      { key:'CRK', type:'fead-crank', name:"Krank Kasnağı",
        data:{ od:175.01, x:0, y:0, contact:'grooved', driver:true, inertia:0.5 } },
      { key:'A_C', type:'fead-ac', name:"Klima Kompresörü",
        data:{ od:118.01, x:263, y:15, contact:'grooved', inertia:0.0034 } },
      { key:'TEN', type:'fead-tensioner', name:"Otomatik Gergi (E9843)",
        data:{ od:75, contact:'back',
               cenX:126.06, cenY:62.15, armLen:90,
               armMeanDeg:220,
               preload:8.56, kArm:0.501, meanLoad:22.57,
               inertia:0.0009, armInertia:0.0009, pulleyMass:0.8,
               loadStopRelDeg:48.4 } }
    ],
    route: ['CRK', 'A_C', 'TEN']
  },

  'AG00810_GATES_2021': {
    name: "BMC Otomotiv TTA-6x6 — Gates AG00810 raporu",
    note: "250 A alternatör tahriki, 10PK — arşivin EN GENİŞ kayışı. Gergi T38519. Raporda yay ÖN YÜKÜ yok; ortalama momentten türetilmiş ve künyede öyle işaretli.",
    belt:  { profile:'PK', brand:'GATES', beltType:"10PK1215HD", ribs:10,
             effLength:1214.3, tolerance:5, wearPct:0.006 },
    solver:{ ratioMode:'direct', driveRatio:1,
             cylinders:6,
             crankInertia:0.7,
             lengthOffsetMm:1.6,
             duty:[
               { rpm:600, dcPct:27, degC:90, kwByKey:{ IDR:0.01, ALT:9, TEN:0.01 } },
               { rpm:900, dcPct:0, degC:90, kwByKey:{ IDR:0.01, ALT:12.5, TEN:0.01 } },
               { rpm:1000, dcPct:10, degC:90, kwByKey:{ IDR:0.01, ALT:13, TEN:0.01 } },
               { rpm:1200, dcPct:13, degC:90, kwByKey:{ IDR:0.01, ALT:14.5, TEN:0.01 } },
               { rpm:1400, dcPct:0, degC:90, kwByKey:{ IDR:0.01, ALT:16.5, TEN:0.01 } },
               { rpm:1500, dcPct:18, degC:90, kwByKey:{ IDR:0.01, ALT:17, TEN:0.01 } },
               { rpm:1600, dcPct:0, degC:90, kwByKey:{ IDR:0.01, ALT:17.5, TEN:0.01 } },
               { rpm:1800, dcPct:19, degC:90, kwByKey:{ IDR:0.01, ALT:18, TEN:0.01 } },
               { rpm:1900, dcPct:0, degC:90, kwByKey:{ IDR:0.01, ALT:18.5, TEN:0.01 } },
               { rpm:2000, dcPct:13, degC:90, kwByKey:{ IDR:0.01, ALT:19, TEN:0.01 } }
             ] },
    pulleys: [
      { key:'CRK', type:'fead-crank', name:"Krank Kasnağı",
        data:{ od:176, x:0, y:0, contact:'grooved', driver:true, inertia:0.7 } },
      { key:'IDR', type:'fead-idler', name:"Avara",
        data:{ od:75, x:-200, y:150, contact:'back', inertia:0.0002 } },
      { key:'ALT', type:'fead-alternator', name:"Alternatör",
        data:{ od:55, x:-391, y:131, contact:'grooved', inertia:0.014 } },
      { key:'TEN', type:'fead-tensioner', name:"Otomatik Gergi (T38519)",
        data:{ od:75, contact:'back',
               cenX:-217.41, cenY:34.81, armLen:90,
               armMeanDeg:18,
               preload:11.561, kArm:0.483, meanLoad:29.48,
               inertia:0.0004, armInertia:0.004, pulleyMass:0.8,
               loadStopRelDeg:66.5 } }
    ],
    route: ['CRK', 'IDR', 'ALT', 'TEN']
  },

  'AG00686_1475_GATES_2023': {
    name: "BMC 6 silindir — Gates AG00686 raporu (1475)",
    note: "Dört kasnak: krank ø160 · avara · klima ø127 · gergi T38624 @24.6 Nm. Doğrulama kapısının en çok değer taşıyan raporu; 1520'lik kardeşiyle birlikte KASNAK ÇAPI değişiminin etkisini gösteriyor.",
    belt:  { profile:'PK', brand:'GATES', beltType:"8PK1475HD", ribs:8,
             effLength:1475, tolerance:6, wearPct:0.007 },
    solver:{ ratioMode:'direct', driveRatio:1,
             cylinders:6,
             crankInertia:0.15,
             lengthOffsetMm:3.5,
             duty:[
               { rpm:800, dcPct:27, degC:92, kwByKey:{ IDR:0.01, A_C:3, TEN:0.01 } },
               { rpm:1000, dcPct:10, degC:92, kwByKey:{ IDR:0.01, A_C:4, TEN:0.01 } },
               { rpm:1250, dcPct:13, degC:92, kwByKey:{ IDR:0.01, A_C:5, TEN:0.01 } },
               { rpm:1500, dcPct:18, degC:92, kwByKey:{ IDR:0.01, A_C:5.5, TEN:0.01 } },
               { rpm:1750, dcPct:19, degC:92, kwByKey:{ IDR:0.01, A_C:6.8, TEN:0.01 } },
               { rpm:2000, dcPct:13, degC:92, kwByKey:{ IDR:0.01, A_C:8.2, TEN:0.01 } }
             ] },
    pulleys: [
      { key:'CRK', type:'fead-crank', name:"Krank Kasnağı",
        data:{ od:160, x:0, y:0, contact:'grooved', driver:true, inertia:0.15 } },
      { key:'IDR', type:'fead-idler', name:"Avara",
        data:{ od:75, x:-72, y:267, contact:'back', inertia:0.0004 } },
      { key:'A_C', type:'fead-ac', name:"Klima Kompresörü",
        data:{ od:127, x:-224, y:448, contact:'grooved', inertia:0.005 } },
      { key:'TEN', type:'fead-tensioner', name:"Otomatik Gergi (T38624)",
        data:{ od:75, contact:'back',
               cenX:-156.85, cenY:186.97, armLen:90,
               armMeanDeg:75.1,
               preload:8.59, kArm:0.482, meanLoad:24.54,
               inertia:0.0076, armInertia:0.0076, pulleyMass:0.5,
               loadStopRelDeg:62.4 } }
    ],
    route: ['CRK', 'IDR', 'A_C', 'TEN']
  },

  'AG00686_1520_GATES_2023': {
    name: "BMC 6 silindir — Gates AG00686 raporu (1520)",
    note: "AYNI gergi, BÜYÜTÜLMÜŞ kasnaklar (krank ø172 · klima ø137) ve buna bağlı uzayan kayış. 1475'lik kardeşiyle çift olarak okunur — eğilme terimi için kritik ikili.",
    belt:  { profile:'PK', brand:'GATES', beltType:"8PK1520HD", ribs:8,
             effLength:1519.6, tolerance:6, wearPct:0.007 },
    solver:{ ratioMode:'direct', driveRatio:1,
             cylinders:6,
             crankInertia:0.15,
             lengthOffsetMm:2.1,
             duty:[
               { rpm:800, dcPct:27, degC:92, kwByKey:{ IDR:0.01, A_C:3, TEN:0.01 } },
               { rpm:1000, dcPct:10, degC:92, kwByKey:{ IDR:0.01, A_C:4, TEN:0.01 } },
               { rpm:1250, dcPct:13, degC:92, kwByKey:{ IDR:0.01, A_C:5, TEN:0.01 } },
               { rpm:1500, dcPct:18, degC:92, kwByKey:{ IDR:0.01, A_C:5.5, TEN:0.01 } },
               { rpm:1750, dcPct:19, degC:92, kwByKey:{ IDR:0.01, A_C:6.8, TEN:0.01 } },
               { rpm:2000, dcPct:13, degC:92, kwByKey:{ IDR:0.01, A_C:8.2, TEN:0.01 } }
             ] },
    pulleys: [
      { key:'CRK', type:'fead-crank', name:"Krank Kasnağı",
        data:{ od:172, x:0, y:0, contact:'grooved', driver:true, inertia:0.15 } },
      { key:'IDR', type:'fead-idler', name:"Avara",
        data:{ od:75, x:-72, y:267, contact:'back', inertia:0.0004 } },
      { key:'A_C', type:'fead-ac', name:"Klima Kompresörü",
        data:{ od:137, x:-224, y:448, contact:'grooved', inertia:0.003 } },
      { key:'TEN', type:'fead-tensioner', name:"Otomatik Gergi (T38624)",
        data:{ od:75, contact:'back',
               cenX:-149.27, cenY:184.59, armLen:90,
               armMeanDeg:70,
               preload:8.86, kArm:0.476, meanLoad:22.2,
               inertia:0.0076, armInertia:0.0076, pulleyMass:0.5,
               loadStopRelDeg:54.5 } }
    ],
    route: ['CRK', 'IDR', 'A_C', 'TEN']
  },

  'AG00902_1275_GATES_2023': {
    name: "BMC Otomotiv Valeo TM21 — Gates AG00902 raporu (1275)",
    note: "Dört kasnaklı klima tahriki (TM21 ø127). PDF'i ALINTI (11 sayfanın 5'i); geometri ve gergi tam, eksik sayfalar sonuç tabloları.",
    belt:  { profile:'PK', brand:'GATES', beltType:"8PK1275HD", ribs:8,
             effLength:1274.7, tolerance:5, wearPct:0.007 },
    solver:{ ratioMode:'direct', driveRatio:1,
             lengthOffsetMm:0.7,
             duty:[
               { rpm:700, dcPct:35, degC:70, kwByKey:{ IDR:0.8, A_C:1.7, TEN:0.01 } },
               { rpm:1200, dcPct:45, degC:70, kwByKey:{ IDR:2, A_C:3, TEN:0.01 } },
               { rpm:2000, dcPct:19, degC:70, kwByKey:{ IDR:3.6, A_C:4.6, TEN:0.01 } },
               { rpm:3000, dcPct:1, degC:70, kwByKey:{ IDR:4, A_C:7.2, TEN:0.01 } }
             ] },
    pulleys: [
      { key:'CRK', type:'fead-crank', name:"Krank Kasnağı",
        data:{ od:146, x:0, y:0, contact:'grooved', driver:true } },
      { key:'IDR', type:'fead-idler', name:"Avara",
        data:{ od:75, x:190, y:80, contact:'back' } },
      { key:'A_C', type:'fead-ac', name:"Klima Kompresörü",
        data:{ od:127, x:284.5, y:297.7, contact:'grooved' } },
      { key:'TEN', type:'fead-tensioner', name:"Otomatik Gergi (E9843)",
        data:{ od:75, contact:'back',
               cenX:99.37, cenY:171.37, armLen:90,
               armMeanDeg:260,
               preload:9.13, kArm:0.48, meanLoad:22.15,
               loadStopRelDeg:45.2 } }
    ],
    route: ['CRK', 'IDR', 'A_C', 'TEN']
  },

  'AG00902_1300_GATES_2023': {
    name: "BMC Otomotiv Valeo TM21 — Gates AG00902 raporu (1300)",
    note: "1275'in kardeşi: aynı sistem, FARKLI kasnak çapları (krank 159→146, klima 137→127). PDF'i ALINTI (11 sayfanın 5'i).",
    belt:  { profile:'PK', brand:'GATES', beltType:"8PK1300HD", ribs:8,
             effLength:1301.8, tolerance:5, wearPct:0.007 },
    solver:{ ratioMode:'direct', driveRatio:1,
             lengthOffsetMm:1.7,
             duty:[
               { rpm:700, dcPct:35, degC:70, kwByKey:{ IDR:0.8, A_C:1.7, TEN:0.01 } },
               { rpm:1200, dcPct:45, degC:70, kwByKey:{ IDR:2, A_C:3, TEN:0.01 } },
               { rpm:2000, dcPct:19, degC:70, kwByKey:{ IDR:3.6, A_C:4.6, TEN:0.01 } },
               { rpm:3000, dcPct:1, degC:70, kwByKey:{ IDR:4, A_C:7.2, TEN:0.01 } }
             ] },
    pulleys: [
      { key:'CRK', type:'fead-crank', name:"Krank Kasnağı",
        data:{ od:159, x:0, y:0, contact:'grooved', driver:true } },
      { key:'IDR', type:'fead-idler', name:"Avara",
        data:{ od:75, x:219.2, y:78.5, contact:'back' } },
      { key:'A_C', type:'fead-ac', name:"Klima Kompresörü",
        data:{ od:137, x:284.5, y:297.7, contact:'grooved' } },
      { key:'TEN', type:'fead-tensioner', name:"Otomatik Gergi (E9843)",
        data:{ od:75, contact:'back',
               cenX:89.56, cenY:182.04, armLen:90,
               armMeanDeg:265,
               preload:9.31, kArm:0.476, meanLoad:22.21,
               loadStopRelDeg:57.4 } }
    ],
    route: ['CRK', 'IDR', 'A_C', 'TEN']
  },

  'AG00894_GATES_2023': {
    name: "BMC Otomotiv — Gates AG00894 raporu (iki klima)",
    note: "Altı kasnaklı FARKLI TOPOLOJİ: İKİ klima kompresörü (TM31 + SD7H15), alternatör YOK. Arşivdeki tek çift-kompresör düzeni. PDF'i ALINTI (12 sayfanın 6'sı).",
    belt:  { profile:'PK', brand:'GATES', beltType:"8PK1738HD", ribs:8,
             effLength:1738.7, tolerance:6, wearPct:0.007 },
    solver:{ ratioMode:'direct', driveRatio:1,
             lengthOffsetMm:0.9,
             duty:[
               { rpm:519, dcPct:26.6, degC:90, kwByKey:{ IDR1:0.01, TM31:1.4, IDR2:0.01, SD7H15:0.9, TEN:0.01 } },
               { rpm:693, dcPct:10, degC:90, kwByKey:{ IDR1:0.01, TM31:1.7, IDR2:0.01, SD7H15:1.7, TEN:0.01 } },
               { rpm:1000, dcPct:13, degC:90, kwByKey:{ IDR1:0.01, TM31:2.1, IDR2:0.01, SD7H15:3, TEN:0.01 } },
               { rpm:1039, dcPct:17, degC:90, kwByKey:{ IDR1:0.01, TM31:2.5, IDR2:0.01, SD7H15:3.2, TEN:0.01 } },
               { rpm:1212, dcPct:18, degC:90, kwByKey:{ IDR1:0.01, TM31:3, IDR2:0.01, SD7H15:4, TEN:0.01 } },
               { rpm:1385, dcPct:8, degC:90, kwByKey:{ IDR1:0.01, TM31:3.5, IDR2:0.01, SD7H15:5, TEN:0.01 } },
               { rpm:1558, dcPct:4, degC:90, kwByKey:{ IDR1:0.01, TM31:4, IDR2:0.01, SD7H15:6, TEN:0.01 } },
               { rpm:1731, dcPct:3, degC:90, kwByKey:{ IDR1:0.01, TM31:4.4, IDR2:0.01, SD7H15:7, TEN:0.01 } },
               { rpm:1904, dcPct:0.3, degC:90, kwByKey:{ IDR1:0.01, TM31:4.75, IDR2:0.01, SD7H15:7.5, TEN:0.01 } },
               { rpm:2077, dcPct:0.1, degC:90, kwByKey:{ IDR1:0.01, TM31:5, IDR2:0.01, SD7H15:7.75, TEN:0.01 } }
             ] },
    pulleys: [
      { key:'CRK', type:'fead-crank', name:"Krank Kasnağı",
        data:{ od:159, x:0, y:0, contact:'grooved', driver:true } },
      { key:'IDR1', type:'fead-idler', name:"Avara 1",
        data:{ od:75, x:143, y:140, contact:'back' } },
      { key:'TM31', type:'fead-ac', name:"Klima Kompresörü (TM31)",
        data:{ od:152, x:184, y:314.6, contact:'grooved' } },
      { key:'IDR2', type:'fead-idler', name:"Avara 2",
        data:{ od:75, x:0, y:272.5, contact:'back' } },
      { key:'SD7H15', type:'fead-ac', name:"Klima Kompresörü (SD7H15)",
        data:{ od:119, x:-267.4, y:241, contact:'grooved' } },
      { key:'TEN', type:'fead-tensioner', name:"Otomatik Gergi (E9843)",
        data:{ od:75, contact:'back',
               cenX:-174.47, cenY:86.93, armLen:90,
               armMeanDeg:353,
               preload:8.93, kArm:0.475, meanLoad:23,
               loadStopRelDeg:60.7 } }
    ],
    route: ['CRK', 'IDR1', 'TM31', 'IDR2', 'SD7H15', 'TEN']
  }
};
function veFeadExampleKeys(){ return Object.keys(VE_FEAD_EXAMPLES); }
function veFeadExampleOf(key){ return VE_FEAD_EXAMPLES[key] || null; }

// Örneği DOM'suz düğüm/bağlantı dizisine çevir. Kanvas kurulumu da AYNI
// tanımı okur (cp-fead.js) — iki yerde iki örnek tanımı tutulsa biri sessizce
// eskirdi, tam olarak bu modülde en pahalı hata türü.
function veFeadExampleNodes(key){
  var ex = veFeadExampleOf(key);
  if(!ex) return null;
  var nodesOut = [], byKey = {};
  ex.pulleys.forEach(function(p){
    var n = { id: 'ex-' + p.key, type: p.type, customName: p.name,
              data: JSON.parse(JSON.stringify(p.data)) };
    byKey[p.key] = n;
    nodesOut.push(n);
  });
  nodesOut.push({ id:'ex-belt',   type:'fead-belt',   data: JSON.parse(JSON.stringify(ex.belt)) });
  var solverData = JSON.parse(JSON.stringify(ex.solver));
  // Duty satırlarındaki kW sözlüğü örnek tanımında KASNAK ANAHTARIYLA yazılır
  // (kwByKey: { A_C: 2.70, ... }); çekirdeğe giden biçim ise DÜĞÜM KİMLİĞİYLE
  // anahtarlı (veFeadDutyToCore → r.kw[n.id]). Çeviri BURADA, tek yerde:
  // örnek verisi okunabilir kalıyor ve 'ex-' kimlik şeması bu fonksiyonun
  // dışına sızmıyor. Kimlik doğrudan yazılsaydı örnek tanımı, düğüm kurma
  // ayrıntısını bilmek zorunda kalırdı — ikisi ayrıştığında hata SESSİZ olur:
  // eşleşmeyen kimlik "kW girilmemiş" sayılır ve o aksesuar 0 kW ile koşar.
  if(Array.isArray(solverData.duty)) solverData.duty.forEach(function(r){
    if(!r || !r.kwByKey) return;
    var kw = r.kw ? r.kw : {};
    Object.keys(r.kwByKey).forEach(function(k){
      if(byKey[k]) kw[byKey[k].id] = r.kwByKey[k];
    });
    r.kw = kw;
    delete r.kwByKey;
  });
  nodesOut.push({ id:'ex-solver', type:'fead-solver', data: solverData });
  // Kayış Yolu şeması da kurulur: örnek "çözülebilir bir model" değil, KULLANIMA
  // HAZIR bir model olmalı. Şema düğümü olmadan kullanıcı çözümü görüyor ama
  // kayış yolunu göremiyor ve onu paletten ayrıca aramak zorunda kalıyordu.
  nodesOut.push({ id:'ex-layout', type:'fead-layout', data:{} });
  // RAPOR DA KURULUR — aynı gerekçe. Örnek "çözülebilir bir model" değil,
  // KULLANIMA HAZIR bir model: kullanıcı çözümü görüyor ama raporu almak için
  // bileşeni paletten ayrıca aramak zorunda kalıyordu. `data:{}` bilerek boş —
  // veFeadReportKind alanı olmayan düğümü 'detailed' sayar, yani örnek
  // varsayılan rapor türüyle gelir (bkz. cp-fead-report.js).
  //
  // SIRA ÖNEMLİ: veFeadArrangeByCoords'un sol şeridi araç düğümlerini `nodes`
  // dizisi sırasına göre diziyor ve bu dizi buradan besleniyor. Kayış
  // Özellikleri → Çözücü → Rapor sırası istenen sıradır; rapor solver'dan önce
  // push edilseydi şeritte de onun üstünde çıkardı.
  nodesOut.push({ id:'ex-report',  type:'fead-report',  data:{} });
  var conns = [];
  ex.route.forEach(function(k, i){
    var next = ex.route[(i + 1) % ex.route.length];
    if(byKey[k] && byKey[next]) conns.push({ from: byKey[k].id, to: byKey[next].id });
  });
  return { nodes: nodesOut, connections: conns, solverId: 'ex-solver', example: ex };
}

// ─── Duty kW sözlüğünün KİMLİK GÖÇÜ ─────────────────────────────────────────
//
// Duty satırlarındaki kW sözlüğü DÜĞÜM KİMLİĞİYLE anahtarlanır (bkz.
// veFeadDutyToCore → r.kw[n.id]). Bir düğüm kümesi kopyalanıp YENİ kimliklerle
// kurulduğunda (örneği kanvasa kurmak, bir grubu çoğaltmak) sözlük eski
// kimliklerle kalır ve HİÇBİR aksesuar eşleşmez.
//
// HATA SESSİZDİR VE ÖLÇÜLDÜ: eşleşmeyen kimlik "kW girilmemiş" sayılır, o
// aksesuar 0 kW ile koşar, çözüm yine üretilir. AG00976 örneği kanvasa
// kurulduğunda bütün açıklık gerginlikleri tasarım gerginliğine (544 N)
// düzleşiyordu — Gates raporu 880 d/d'de 1381/1380/1023/1022/545/544 diyor —
// ve hubload'lar 1891/1228/2372/1088/1539/324 yerine
// 1065/484/1074/579/1066/323 çıkıyordu. Hiçbir uyarı yoktu.
//
// Eşleşmeyen anahtar DÜŞÜRÜLMEZ, olduğu gibi taşınır: harita yalnız kurulan
// düğümleri kapsar, kullanıcının kanvasta zaten düzenlediği bir satır varsa
// onun anahtarı haritada olmaz ve silinmesi veri kaybı olurdu.
function veFeadRemapDutyKw(dutyRows, idMap){
  if(!Array.isArray(dutyRows) || !idMap) return dutyRows;
  dutyRows.forEach(function(r){
    if(!r || !r.kw) return;
    var out = {};
    Object.keys(r.kw).forEach(function(k){
      out[idMap[k] != null ? idMap[k] : k] = r.kw[k];
    });
    r.kw = out;
  });
  return dutyRows;
}

// ─── Kayış sırası ───────────────────────────────────────────────────────────
// Bağlantı = kayış yolu. Zincir sürücüden başlar, çıkış→giriş izlenir. Zincire
// hiç girmemiş kasnaklar (kullanıcı henüz bağlamadıysa) sona, topoloji
// sırasıyla eklenir — yarım bağlanmış modelde de şema bir şey gösterir.
// Kayış güzergâhı + TOPOLOJİNİN TEŞHİSİ.
//
// Eskiden burada tek bir sıra üretiliyordu ve son satır şuydu:
//     pulleys.forEach(function(p){ if(!seen[p.id]) order.push(p); });
// yani zincire BAĞLI OLMAYAN kasnak da kayış yoluna sessizce ekleniyordu.
// Sonucu ağırdı: kullanıcı bir teli koparıyor, çözücü yine aynı kapalı çevrimi
// kuruyor ve şema hiç değişmiyordu — çizim kurulan TOPOLOJİYİ değil, bileşen
// LİSTESİNİ gösteriyordu. ÖLÇÜLDÜ (gerçek tarayıcı, BMC): "Avara 2"nin iki
// telini de silince kart hâlâ "✓ 6 kasnak · L 1715.0 mm" diyordu. Kullanıcı
// bunu "bağlantı kurulmuyor, topolojiyi tekrar kuramıyorum" diye bildirdi.
//
// Artık sıra yine üretiliyor (yerleştirici ve çizim onu kullanıyor) ama
// GEÇERLİLİK ayrı bir alan olarak taşınıyor: kapalı mı, kopuk kasnak var mı,
// çatal var mı. veFeadBuildSystem bunlara bakıp ÇÖZMEYİ REDDEDİYOR ve sebebini
// yazıyor — kanvasta teller görünmeye devam ediyor, yanlış olan şema değil,
// şemanın YERİNE yazılan mesaj oluyor.
function veFeadRouteDiagnose(nodeList, connList){
  var pulleys = (nodeList||[]).filter(_feadIsPulley);
  var out = { order: [], ok: false, closed: false, isolated: [], errors: [] };
  if(!pulleys.length) return out;

  var byId = {}, cikis = {}, giris = {};
  pulleys.forEach(function(n){ byId[n.id] = n; cikis[n.id] = 0; giris[n.id] = 0; });
  var next = {};
  (connList||[]).forEach(function(c){
    if(!c || !byId[c.from] || !byId[c.to]) return;
    cikis[c.from]++; giris[c.to]++;
    if(next[c.from] === undefined) next[c.from] = c.to;      // ilk tel kazanır
  });

  // ÇATAL: kayış tek bir sıra izler; bir kasnaktan iki tel çıkması hangi
  // sıranın geçerli olduğunu belirsiz bırakır (ilk tel sessizce kazanırdı).
  pulleys.forEach(function(p){
    if(cikis[p.id] > 1)
      out.errors.push('"' + _feadNodeName(p) + '" kasnağından ' + cikis[p.id]
        + ' kayış çıkıyor. Kayış yolu tek sıradır: her kasnaktan bir tel çıkar, bir tel girer.');
    if(giris[p.id] > 1)
      out.errors.push('"' + _feadNodeName(p) + '" kasnağına ' + giris[p.id]
        + ' kayış giriyor. Kayış yolu tek sıradır: her kasnaktan bir tel çıkar, bir tel girer.');
  });

  var start = veFeadResolveDriver(pulleys) || pulleys[0];
  var order = [], seen = {}, cur = start.id, guard = 0;
  while(cur && byId[cur] && !seen[cur] && guard++ < 512){
    seen[cur] = 1;
    order.push(byId[cur]);
    cur = next[cur];
  }
  out.closed = (cur === start.id);
  out.isolated = pulleys.filter(function(p){ return !seen[p.id]; });
  // Sıra yine BÜTÜN kasnakları taşır: yerleştirici (veFeadArrangeByCoords) ve
  // rozetler kopuk kasnağı da görmeli. Geçerlilik ayrı alanda.
  out.order = order.concat(out.isolated);

  if(!out.closed){
    var son = order.length ? _feadNodeName(order[order.length-1]) : _feadNodeName(start);
    out.errors.push(cur
      ? ('Kayış yolu kapanmıyor: "' + son + '" kasnağından çıkan tel, başlangıç kasnağı "'
         + _feadNodeName(start) + '" yerine "' + _feadNodeName(byId[cur]) + '" kasnağına dönüyor.')
      : ('Kayış yolu kapanmıyor: "' + son + '" kasnağından çıkan tel yok. '
         + 'Serpantin sırası krank çıkışından başlayıp krank girişine dönmeli.'));
  }
  if(out.isolated.length){
    out.errors.push('Kayış yoluna bağlı olmayan kasnak var: '
      + out.isolated.map(_feadNodeName).join(', ')
      + '. Kanvasta teli çekilmemiş bir kasnak kayışa dahil EDİLMEZ.');
  }
  out.ok = out.closed && !out.isolated.length && !out.errors.length;
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  OLANAKLI KOL AÇISI BANDI + T(θ) — SEÇMEZ; KAPI VE OKUMA
// ═══════════════════════════════════════════════════════════════════════════
//
// Kol çalışma açısı bir GİRDİ (bkz. "MONTAJ ZARFI KALKTI"). Ama girilen her açı
// fiziksel olarak KULLANILABİLİR değil, ve hangi açının ne kadara mal olduğu da
// görülebilir. Bu blok o iki şeyi veriyor — bir seçici DEĞİL:
//
//   BANT   θ'nın fiziksel olarak olanaklı olduğu yay. Ölçüt kullanıcının KENDİ
//          girdilerinden: kayışın tolerans + aşınma bandı, gerginin load stop'u,
//          sarımın ayakta kalması. Gates verisi HİÇ girmiyor.
//   EĞRİ   T(θ) — o açının gerginlik karşılığı, kullanıcının noktası işaretli.
//
// NEDEN BİR SEÇİCİ DEĞİL — ÖLÇÜLDÜ (14 Gates sistemi, bu kodun kendisiyle):
//     Gates'in noktası bandın İÇİNDE                14/14  ← yanlış red YOK
//     bandın genişliği                        96…218°, medyan 189°
//     bandın ORTASINI seçseydik            medyan hata 96°
// Yani ölçüt gerçek hiçbir tedarikçi tasarımını reddetmiyor ama 180 örneğin
// 47…84'ünü eliyor — boş bir kapı değil, sadece dar bir kapı değil.
// Yani fizik doğruluyor ama daraltmıyor: bant yarım çemberden geniş. Kalan
// serbestlik motor bloğunun paketlemesi ve o bilgi bu modelde YOK. Eski montaj
// zarfının 4,0°'lik isabetinin ~%98'i Gates kalibrasyonundan geliyordu.
//
// EĞRİNİN BİLGİ TAŞIDIĞI DA ÖLÇÜLDÜ: merkez sabitken T(θ) kapalı formda
//     T(θ) = M_mean / (a · 2sin(φ/2) · |sin(θ − θ_f)|)
// ve ±20°'lik bir bantta %47…101 oynuyor. Yani okuma boş bir süs değil.
//
// FORMÜL BURAYA YAZILMIYOR, ÇEKİRDEK ÇAĞRILIYOR: yukarıdaki kapalı form
// gerekçedir, hesap değil. İkinci bir kopya yazmak, profil sabiti ya da teğet
// çözümü değişince iki yüzeyin sessizce ayrışması demekti.
// TARAMA ADIMI 4° VE SEBEBİ ÖLÇÜLDÜ: maliyetin tamamı `positionTable`'da
// (180 örnekte 1217 ms; makeSystem yalnız 52 ms, tensionerState 15 ms) çünkü
// her OLANAKLI örnek altı servis konumunu çözüyor. 2°'de tarama ~700 ms,
// 4°'de ~350 ms. Izgara çözünürlüğü KAPIYI etkilemiyor — kullanıcının kendi
// açısı ayrıca ve TAM olarak örnekleniyor; adım yalnız çizilen eğriyi ve
// bildirilen yay genişliğini kuantalıyor. Rapor daha ince adım geçebilir.
var VE_FEAD_BAND_STEP_DEG = 4;      // tarama adımı

// Tek örnek. `base` çekirdek yapılandırması, `c` avara merkezi (SABİT — girdi),
// `absDeg` denenen kol çalışma açısı.
//
// ÖLÇÜT TEK BİR SORU: kol, kayışın SERVİS ARALIĞININ iki ucuna da ulaşabiliyor
// mu? Servis uçlarını çekirdek tanımlıyor (`positionTable`): Replace =
// L+tol+w·L, MinBelt = L−tol. Burada yeniden yazılsaydı kayış kipi kuralının
// ikinci kopyası olurdu.
//
// LOAD STOP VE SARIM ÇÖKÜŞÜ İÇİN AYRI KAPI YOK — ve bu bir eksiklik değil:
// çekirdeğin kendi erişim sınırı (`feasibleRelMax`) ikisini de zaten içeriyor,
// dolayısıyla ayrı bir denetim ÖLÜ DAL olurdu. ÖLÇÜLDÜ:
//   • load stop 60,4° → 32°'ye indirilince olanaklı örnek 107 → 0; hepsi
//     "servis ucu çözülemiyor" diyor, yani reddi ÇEKİRDEK veriyor.
//   • olanaklı örneklerde servis aralığının en küçük sarımı 26,8…28,0° —
//     hiçbir makul zeminin altına inmiyor, çünkü inen örnek zaten çözülmüyor.
// Bir dönem burada iki `if` daha vardı; mutasyon ikisini de SESSİZCE geçirdi
// (kaldırıldıklarında hiçbir test kırılmadı) ve sebebi buydu.
function _feadBandSample(base, c, a, absDeg, relNom){
  var out = { deg: absDeg, ok: false, why: '', tensionN: NaN, betaDeg: NaN,
              wrapMinDeg: NaN, relMaxDeg: NaN, meanBeltMm: NaN };
  var r = absDeg * Math.PI / 180;
  var c2 = Object.assign({}, base);
  c2.tensioner = Object.assign({}, base.tensioner);
  c2.tensioner.pivot = [c[0] - a * Math.cos(r), c[1] - a * Math.sin(r)];
  c2.tensioner.freeAngleDeg = absDeg;
  delete c2.tensioner.sense;                       // çekirdek kendi bulsun
  var sys;
  try { sys = FEADCore.makeSystem(c2); }
  catch(e){ out.why = 'kayış yolu kurulamıyor'; return out; }
  // armAbs = free + sense·rel_nom  →  free = armAbs − sense·rel_nom
  sys.tensioner.freeAngleDeg = absDeg - sys.tensioner.sense * relNom;
  sys._cache = {};
  var tbl;
  try { tbl = FEADCore.positionTable(sys); }
  catch(e){ out.why = 'kayış yolu çözülemiyor'; return out; }
  var by = {}; tbl.forEach(function(x){ by[x.position] = x; });
  var mean = by.Mean;
  // GEREKÇE KISA VE KENDİMİZİN: çekirdeğin ham metni arama aralığını ve
  // fonksiyon adını taşıyor ("[-1713.51 .. -1704.51] (arama araligi 0..60.4)").
  // Bu bir HATA kanalı değil bir TEŞHİS yüzeyi; okunacak şey sebep, iz değil.
  if(!mean || mean.error || !Number.isFinite(mean.relDeg)){
    out.why = 'bu açıda kayış yolu kapanmıyor'; return out;
  }
  out.tensionN = mean.tensionN;
  out.betaDeg = mean.betaDeg;
  // ÇALIŞMA NOKTASINDAKİ GEREKEN BOY — bandın taşıdığı EN ÖNEMLİ değişmez:
  // merkez sabitken bu sayı θ'dan BAĞIMSIZ olmalı (yönün bütün gerekçesi bu).
  // Örneğe yazılıyor ki kapı onu ölçebilsin; başka hiçbir yerde okunmuyor.
  out.meanBeltMm = mean.requiredBeltMm;
  // ── (a) SERVİS BANDININ İKİ UCU DA ÇÖZÜLMELİ ─────────────────────────────
  var uclar = ['Replace', 'MinBelt'], wraps = [mean.wrapDeg], relMax = mean.relDeg;
  for(var i = 0; i < uclar.length; i++){
    var q = by[uclar[i]];
    if(!q || q.error || !Number.isFinite(q.relDeg)){
      out.why = 'servis aralığının ucu (' + uclar[i] + ') çözülemiyor';
      return out;
    }
    wraps.push(q.wrapDeg);
    if(q.relDeg > relMax) relMax = q.relDeg;
  }
  // Bu ikisi HÜKÜM DEĞİL, OKUMA: rapor basıyor, kapı kullanmıyor (sebebi
  // fonksiyonun başındaki nota bak).
  out.wrapMinDeg = Math.min.apply(null, wraps.filter(Number.isFinite));
  out.relMaxDeg = relMax;
  out.ok = true;
  return out;
}

// Kurulmuş bir çözümün kol açısı bandını ve T(θ) eğrisini üret.
//
// SICAK YOLDA ÇAĞIRILMAZ: tarama 180 örnek × (makeSystem + positionTable).
// Ölçüldü — kanvas sürükleme karesinin bütçesi 2,2 ms, bu tarama iki
// mertebe üstünde. Panel (kullanıcı eylemi) ve rapor (belge) çağırır;
// `veFeadLayoutCardHTML` ÇAĞIRMAZ.
//
// TEK GİRİŞLİK MEMO: panel her alan düzenlemesinde yeniden çiziliyor ve
// taramanın ~350 ms'ini ikinci kez ödemenin karşılığı yok. Anahtar, bandı
// GERÇEKTEN belirleyen her şey — kasnak merkezleri/çapları/temas tarafı, avara
// merkezi, kol boyu, yay künyesi, kayış bandı, load stop. Adı değişince
// yeniden hesaplanmıyor; merkez 0,001 mm oynayınca hesaplanıyor.
//
// `armAbsDeg` ANAHTARDA YOK ve bu bilerek: bant kol açısından BAĞIMSIZ (merkez
// sabitken kayış yolu da öyle — ölçüldü, 4,55e−13 mm). Anahtara koymak memoyu
// her açı düzenlemesinde çöpe atardı. Kullanıcının noktası zaten memodan
// SONRA, ayrıca örnekleniyor.
var _feadBandMemo = null;
function _feadBandKey(build, step){
  var t = build.cfg.tensioner || {}, b = build.cfg.belt || {};
  return JSON.stringify([step, build.center, t.armLength, t.preloadNm,
    t.rateNmPerDeg, t.loadStopRelDeg, build.spring && build.spring.relMeanDeg,
    b.effLength, b.tolerance, b.wearPct, b.profile, b.ribs,
    (build.cfg.pulleys || []).map(function(q){
      return [q.name, q.rPitch, q.rEff, q.contact, q.x, q.y, !!q.tensioner]; })]);
}

// Döner: { ok, step, samples[], userDeg, userOk, userWhy, arcDeg, note }
function veFeadArmBand(build, opt){
  opt = opt || {};
  var out = { ok: false, step: _feadNum(opt.stepDeg, VE_FEAD_BAND_STEP_DEG),
              samples: [], userDeg: NaN, userOk: false, userWhy: '',
              arcDeg: 0, note: '' };
  if(typeof FEADCore === 'undefined' || !build || !build.cfg || !build.center){
    out.note = 'Model çözülmeden bant hesaplanamaz.'; return out;
  }
  var a = _feadNum(build.cfg.tensioner && build.cfg.tensioner.armLength, NaN);
  var relNom = _feadNum(build.spring && build.spring.relMeanDeg, NaN);
  if(!(a > 0) || !Number.isFinite(relNom)){
    out.note = 'Kol boyu ve yay künyesi olmadan bant hesaplanamaz.'; return out;
  }
  out.userDeg = _feadNum(build.armAbsDeg, NaN);
  var c = build.center, s = out.step, i, x;
  var key = null;
  try { key = _feadBandKey(build, s); } catch(e){ key = null; }
  if(key && _feadBandMemo && _feadBandMemo.key === key){
    out.samples = _feadBandMemo.samples;
    out.arcDeg = _feadBandMemo.arcDeg;
    out.memo = true;
  } else {
    for(i = 0; i * s < 360; i++){
      x = _feadBandSample(build.cfg, c, a, -180 + i * s, relNom);
      out.samples.push(x);
      if(x.ok) out.arcDeg += s;
    }
    if(key) _feadBandMemo = { key: key, samples: out.samples, arcDeg: out.arcDeg };
  }
  // KULLANICININ NOKTASI AYRICA ÖRNEKLENİR — ızgaraya yuvarlamak, tam sınırda
  // duran bir açıyı yanlış tarafta gösterebilirdi.
  if(Number.isFinite(out.userDeg)){
    var u = _feadBandSample(build.cfg, c, a, out.userDeg, relNom);
    out.userOk = u.ok; out.userWhy = u.why;
    out.userTensionN = u.tensionN; out.userWrapMinDeg = u.wrapMinDeg;
    out.userRelMaxDeg = u.relMaxDeg;
  }
  out.ok = out.arcDeg > 0;
  if(!out.ok) out.note = 'Bu yerleşimde kolun hiçbir açısı servis aralığını taşıyamıyor.';
  return out;
}

// ── KAYIŞ DÖNÜŞ YÖNÜ (CW / CCW) ────────────────────────────────────────────
//
// YÖN BİR AYAR DEĞİL, ROTA SIRASININ SONUCUDUR. Çekirdek `loopSense`
// (fead-core.js) kasnak merkezlerinin AYAKKABI BAĞI işaretli alanına bakıyor:
// merkezleri kayış gidiş sırasında dolaşınca saat yönünün TERSİNE dönüyorsa
// +1 (CCW), saat yönündeyse −1 (CW). Yani kabloları hangi sırada çektiysen
// yön odur; "Dönüş Yönü" düğümü o sırayı TERS yürüterek yönü seçtiriyor.
//
// ÖLÇÜT ÇEKİRDEĞİN KENDİSİNDEN — ikinci bir kopya yazılsaydı iki yüzey
// sessizce ayrışabilirdi. Merkez sözleşmesi: kasnakta (x, y), gergide
// AVARA MERKEZİ (`veFeadTensionerCenter`) — gövdenin montaj konumu DEĞİL.
// İkisi kol boyu kadar (90 mm) ayrı; montaj konumunu çokgene koymak yönü
// kaymış bir çokgenden okumak olurdu ve ölçüldü: merkezin doğrunun ÜSTÜNDE,
// montaj konumunun ALTINDA kaldığı üç kasnaklı sentetik bir düzende işaret
// ÇEVRİLİYOR (+1 ↔ −1). İki gerçek örnekte ikisi aynı işareti verdiği için
// kapı SENTETİK olmak zorunda.
//
// KOORDİNATI EKSİK MODELDE YÖN YOKTUR (0 döner). Eksik koordinatla geometri
// zaten çözülemiyor; uydurma bir yön üretip rotayı ters çevirmek, çözülemeyen
// bir modeli sessizce BAŞKA bir çözülemeyen modele çevirirdi.
function veFeadNaturalSense(order){
  var list = (order || []).filter(_feadIsPulley);
  if(list.length < 3 || typeof FEADCore === 'undefined'
     || typeof FEADCore.loopSense !== 'function') return 0;
  var c = [], i, d, x, y, cen;
  for(i = 0; i < list.length; i++){
    d = list[i].data || {};
    if(_feadDefOf(list[i]).isFeadTensioner){
      // AVARA MERKEZİ — gövdenin montaj konumu DEĞİL (bkz. yukarıdaki not).
      cen = veFeadTensionerCenter(d);
      if(!cen) return 0;
      x = cen[0]; y = cen[1];
    } else {
      x = _feadNum(d.x, NaN); y = _feadNum(d.y, NaN);
    }
    if(!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    c.push([x, y]);
  }
  return FEADCore.loopSense(c);
}

// ── ROTAYI TERS YÜRÜT — KABLOLARI ÇEVİREREK ────────────────────────────────
//
// Yön BİR BAYRAKTA DEĞİL, KABLOLARIN KENDİSİNDE durur. Düğüme `data.dir` gibi
// bir alan koymak ikinci bir gerçek kaynağı yaratırdı ve üç yerden ısırırdı:
//
//   1. Kanvastaki gidiş yönü oku (`veConnDirMark`, connections.js) telin
//      from→to yönünü çiziyor. Bayrak kullanılsaydı ok, çözülen yönü DEĞİL
//      kabloyu gösterir — yani yalan söylerdi.
//   2. `veFeadTopoSignature` tel uçlarını okuyor ama araç düğümlerinin
//      `data`'sını OKUMUYOR (ölçüldü: araç düğümü alanı değişince imza
//      değişmiyor). Bayrak imzaya girmezdi → rozete tıklayınca kart doğrudan
//      çağrıyla tazelenir ama GERİ AL sonrası bayat kalırdı, hem de sessizce.
//   3. Bayrak silinince yön sessizce dönerdi (Konum Bağı'nda ölçülmüş
//      "düğümü silmek durumu çeviriyor" sınıfı) → ayrı bir silme kancası.
//
// Kabloyu çevirmek üçünü birden yok ediyor: tek gerçek kaynak, ok kendiliğinden
// doğru, imza kendiliğinden değişiyor, silinecek bir durum yok.
//
// ÖLÇÜLDÜ: kablo çevirmenin verdiği sıra, "krank sabit + kalanı ters" kuralının
// verdiği sırayla BİREBİR aynı — yani bayrak yolunun tek iddia edilen üstünlüğü
// (kabloya dokunmamak) karşılıksız.
//
// YERİNDE TAKAS, sil-ve-yeniden-kur DEĞİL: `createConnection` kimliği
// `'conn-' + Date.now()` ile üretiyor, altı teli tek karede kurmak altı ÖZDEŞ
// kimlik verirdi.
//
// YALNIZ İKİ UCU DA KASNAK olan teller çevrilir: araç düğümleri 0/0 portlu,
// ama elle düzenlenmiş bir dosya başka tel taşıyabilir.
function veFeadReverseRoute(nodeList, connList){
  var kasnak = {};
  (nodeList || []).forEach(function(n){ if(_feadIsPulley(n)) kasnak[n.id] = 1; });
  var k = 0;
  (connList || []).forEach(function(c){
    if(!c || !kasnak[c.from] || !kasnak[c.to]) return;
    var t = c.to; c.to = c.from; c.from = t;
    // Kasnak 1 giriş / 1 çıkış taşıyor → port kimlikleri tam olarak bunlar
    // (js/ui-core.js: inCount === 1 ? 'input' : 'input-' + i).
    c.fromPort = 'output'; c.toPort = 'input';
    k++;
  });
  return k;
}

// ── GERGİ GEVŞEK SPANDA MI? ────────────────────────────────────────────────
//
// Çekirdek ankrajı gergiye yazıyor (`spanTensions`: T[gergi] = designTensionN)
// ve zinciri oradan gidiş yönünde yürütüyor: sürücüde +P/v, aksesuarlarda
// −P/v. Ankraj EN DÜŞÜK span değilse başka spanlar onun ALTINA iner; yeterince
// inerse NEGATİF olur — ve kayış itemez.
//
// Bu bir modelleme kusuru değil, gerçek bir tasarım kuralı: otomatik gergi
// kayışın GEVŞEK tarafına konur. Gergin tarafa konsaydı tahrik gerginliğinin
// tamamını yayla karşılamak zorunda kalır ve durdurucusuna dayanırdı.
//
// ÖLÇÜLDÜ — 14 Gates sisteminin 14'ünde de ankraj GLOBAL MİNİMUM, üstelik
// gergi sıranın SON kasnağı (doğrudan krankın önünde). İstisna yok.
//
// ÖLÇÜT EŞİKSİZ: "ankrajın altına inen span var mı". Negatif sayı ARAMAZ —
// ankrajın altına inmek yeterli; negatiflik yalnız o durumun uç hâli.
// "Gergi kranka komşu olmalı" gibi bir konum kuralı YANLIŞ olurdu: aralarında
// güç ÇEKMEYEN bir avara bulunabilir ve bu geçerlidir (sentetik olarak
// ölçüldü). Sayılan şey komşuluk değil, GÜÇ.
function _feadFmt3(x){ return Number.isFinite(x) ? x.toFixed(1) : '—'; }

function veFeadTensionerSide(row, tensionerName){
  var out = { ok: true, anchorN: NaN, minN: NaN, minName: null,
              deficitN: 0, negative: false, drain: [] };
  var pp = (row && row.perPulley) || [];
  if(!pp.length || !tensionerName) return out;
  var i, T;
  for(i = 0; i < pp.length; i++)
    if(pp[i].name === tensionerName) out.anchorN = _feadNum(pp[i].exitTensionN, NaN);
  if(!Number.isFinite(out.anchorN)) return out;
  var en = Infinity, enAd = null;
  for(i = 0; i < pp.length; i++){
    T = _feadNum(pp[i].exitTensionN, NaN);
    if(!Number.isFinite(T)) return out;
    if(T < en){ en = T; enAd = pp[i].name; }
    // Ankrajın ALTINA inen spanlar — hükmü verenler bunlar.
    if(T < out.anchorN - 1e-6 * Math.max(1, Math.abs(out.anchorN))) out.drain.push(pp[i].name);
  }
  out.minN = en; out.minName = enAd;
  out.negative = en < 0;
  out.deficitN = out.anchorN - en;
  out.ok = !out.drain.length;
  return out;
}

// Yalnız sırayı isteyen çağrılar için ince sarmal (yerleştirici, testler).
function veFeadRouteOrder(nodeList, connList){
  return veFeadRouteDiagnose(nodeList, connList).order;
}

// Sürücü kasnağı çöz (ROL): açık işaret → tip → ilk kasnak.
function veFeadResolveDriver(pulleys){
  var list = pulleys || [];
  var i;
  for(i=0;i<list.length;i++) if(list[i] && list[i].data && list[i].data.driver) return list[i];
  for(i=0;i<list.length;i++) if(_feadDefOf(list[i]).isFeadDriver) return list[i];
  return list.length ? list[0] : null;
}

// ─── ÇİZİM DÜZLEMİ — VARSAYILAN: RAPOR DÜZLEMİ (ayna KAPALI) ────────────────
//
// KULLANICI KARARI (2026-09-04) — ÖNCEKİNİ DEĞİŞTİRİR: *"gergi ve kasnak
// konumları programda yanlış çıkıyor. Ters çıkıyor… Gates raporlarının PDF ilk
// sayfasında kasnak konumları var."*
//
// ÖLÇÜLDÜ (12 örneğin 12'si, gerçek tarayıcıda, çizilen SVG'den okunarak):
// ekrandaki soldan-sağa sıra raporun 1. sayfasındaki şemanın TAM TERSİYDİ.
// Sebebi bir hesap hatası değil, bu bayrağın kendisiydi: `true` iken çizim X'te
// aynalanıyor, yani resim raporun aynası oluyordu. Örnek: AG0868'de rapor
// CRK'yı SOLDA, A_C'yi SAĞDA gösterirken program tersini çiziyordu.
//
// ÖNCEKİ VARSAYILAN (`true`) BİR ÇIKARIMA DAYANIYORDU ve çıkarım silinmiyor,
// yalnız VARSAYILAN OLMAKTAN çıkıyor:
//   • ÖLÇÜLÜ: on raporun onunda da kayış, raporun kendi düzleminde CCW dolanıyor
//     (Σ işaretli sarım = +360). Tedarikçinin gergi künyesindeki CW/CCW harfi de
//     o düzlemin TERSİ (docs/gates-reports/README.md §5).
//   • ÇIKARIM: motorlar ön taraftan bakıldığında CW döndüğü için rapor düzlemi
//     ön görünüşün aynası gibi davranıyor. Raporların HİÇBİRİNDE hangi taraftan
//     bakıldığı YAZMIYOR (aynı README §6: "burada ölçüm biter, çıkarım başlar").
//
// Yani bayrak `true` iken program fiziksel olarak savunulabilir ama ARŞİVLE
// KARŞILAŞTIRILAMAZ bir resim çiziyordu. Bu modülün en değerli özelliği satır
// satır karşılaştırılabilirlik; varsayılan artık onu koruyor. Ayna makinesi
// (`veFeadMirrorGeomX`, `veFeadSpinToFront`, kapıları) OLDUĞU GİBİ DURUYOR —
// ölçülmüş bir ilişkiyi silmek, bir görünüm tercihi için kanıt atmak olurdu.
//
// KARAR: yalnız ÇİZİM aynalanır. Saklanan mm koordinatları, çözücü ve bütün
// sayısal çıktılar Gates düzleminde KALIR — arşivle satır satır
// karşılaştırılabilirlik bu modülün en değerli özelliği ve onu bir görünüm
// tercihi için feda etmek olmaz. Aynalama X ekseninde: karşı taraftan bakınca
// sol-sağ yer değiştirir, YUKARI yukarı kalır.
//
// AYNALAMA TAM SİMETRİDİR — bütün skalerler (sarım, açıklık, L_eff, gerginlik)
// BİREBİR aynı kalır; değişen yalnız el yönü. Bu yüzden burada `d` işareti de
// çevriliyor: çevrilmezse sarım yayları kasnağın İÇİNDEN geçer (kartta bir kez
// ölçülmüş "sweep bayrağı" hatasının aynısı).
var VE_FEAD_VIEW_FRONT = false;     // çizim düzlemi: false = RAPOR (Gates) · true = ön görünüş (ayna)

function _feadMirrorPt(q){ return (q && q.length >= 2) ? [-q[0], q[1]] : q; }

// ── VERİ DÜZLEMİ ↔ ÖN GÖRÜNÜŞ: DÖNÜŞ YÖNÜNÜN ÇEVİRİSİ ──────────────────────
//
// `out.spin` (`veFeadNaturalSense` → `FEADCore.loopSense`) VERİ DÜZLEMİNDE
// ölçülür. Çizim aynalandığı için ekranda görülen yön onun TERSİDİR — X
// aynalaması ayakkabı-bağı işaretini çevirir (`veFeadMirrorGeomX` içinde
// `sense` ve `d` de bu yüzden çevriliyor).
//
// BU ÇEVİRİ OLMADAN YÜZEYLER YALAN SÖYLER — ve sessizce: kart kayışı bir yöne
// akıtırken rozet "↺ CCW", sihirbazın düğmesi de "CCW — motora önden bakışta"
// derdi. İkisi de makul görünür, biri yanlıştır.
//
// İNVOLUSYON (kendi tersi): ön görünüşte seçilen bir yönü veri düzlemine
// çevirmek için de aynı fonksiyon kullanılır — sihirbazın yön düğmeleri bu
// yüzden tek boundary'den geçiyor.
function veFeadSpinToFront(spin){
  var v = Number(spin) || 0;
  return VE_FEAD_VIEW_FRONT ? -v : v;
}

// Etiket TEK ÜRETİCİDEN. Rozet · panel · toast · sihirbazın üç yüzeyi aynı
// metni basıyor; altı kopya tutulsaydı biri düzeltilince ötekiler sessizce
// eskirdi (bu modülün tekrar eden kuralı).
// DÜZLEMİ ADIYLA SÖYLER. Eskiden metin KOŞULSUZ *"motora önden bakışta"*
// diyordu; ayna kapanınca o cümle ölçülmemiş bir iddiaya dönüşür (hangi
// taraftan bakıldığı raporların HİÇBİRİNDE yazmıyor — README §6). Artık etiket
// çizimin düzlemini adıyla söylüyor, yani kullanıcının GÖRDÜĞÜ resimle aynı
// cümleyi kuruyor.
function _feadPlaneName(){
  return VE_FEAD_VIEW_FRONT
    ? 'motora önden bakışta (aynalı görünüş)'
    : 'şemadaki yön — Gates rapor düzlemi';
}

function veFeadSpinLabel(spin){
  var f = veFeadSpinToFront(spin);
  if(!f) return { sense: 0, glif: '—', kisa: '—', uzun: '—' };
  return f > 0
    ? { sense: 1, glif: '\u21ba', kisa: '\u21ba CCW',
        uzun: 'CCW (saat yönünün TERSİNE) — ' + _feadPlaneName() }
    : { sense: -1, glif: '\u21bb', kisa: '\u21bb CW',
        uzun: 'CW (saat yönünde) — ' + _feadPlaneName() };
}

// Geometriyi X'te aynalar. SAF: girdiyi değiştirmez, kopya döndürür.
function veFeadMirrorGeomX(geom){
  if(!geom) return geom;
  var out = {};
  Object.keys(geom).forEach(function(k){ out[k] = geom[k]; });
  out.pulleys = (geom.pulleys||[]).map(function(p){
    var q = {}; Object.keys(p).forEach(function(k){ q[k] = p[k]; });
    q.c = _feadMirrorPt(p.c);
    if(typeof p.d === 'number') q.d = -p.d;     // el yönü çevrilir
    return q;
  });
  out.spans = (geom.spans||[]).map(function(sp){
    var q = {}; Object.keys(sp).forEach(function(k){ q[k] = sp[k]; });
    q.Pi = _feadMirrorPt(sp.Pi); q.Pj = _feadMirrorPt(sp.Pj);
    if(sp.u) q.u = _feadMirrorPt(sp.u);
    return q;
  });
  if(typeof geom.signedWrapDeg === 'number') out.signedWrapDeg = -geom.signedWrapDeg;
  if(typeof geom.sense === 'number') out.sense = -geom.sense;
  return out;
}

// ─── Ad tekilleştirme ───────────────────────────────────────────────────────
// ÇEKİRDEK ADLARI ANAHTAR OLARAK KULLANIYOR (loadsKw sözlüğü, sonuç satırları).
// İki "Avara Kasnak" aynı adı taşırsa güçleri sessizce BİRLEŞİR ve sonuç yanlış
// çıkar. Bu yüzden çekirdeğe giden adlar burada tekilleştirilir; kullanıcının
// gördüğü ad değişmez (eşleme döndürülür).
function veFeadUniqueNames(order){
  var used = {}, names = [], byName = {};
  (order||[]).forEach(function(n, i){
    var base = _feadNodeName(n) || ('P' + i);
    var nm = base, k = 2;
    while(used[nm]) nm = base + ' (' + (k++) + ')';
    used[nm] = 1;
    names.push(nm);
    byName[nm] = n.id;
  });
  return { names: names, byName: byName };
}

// ─── Çekirdek hatalarını kullanıcı diline çevir ─────────────────────────────
// Çekirdeğin mesajları teşhis için yazılmış (İngilizce terimli, iç fonksiyon
// adlı). Kullanıcıya NE YAPACAĞINI söyleyen karşılığı burada. Eşleşmeyen mesaj
// OLDUĞU GİBİ geçer — sessizce yutulmaz, çünkü bilinmeyen bir hatayı gizlemek
// yanlış bir çeviriden kötüdür.
var VE_FEAD_ERROR_MAP = [
  [/isaretli sarim toplami/i,
   'Kayış yolu kapanmıyor. İki olası neden: bağlantı sırası kayışın gidiş yönünde değil, '
   + 'ya da bir kasnağın temas tarafı (kaburgalı / sırttan) yanlış.'],
  [/kayis yolu kasnaklarin icinden geciyor/i,
   'Kayış bir kasnağın içinden geçiyor. Temas taraflarını ve kasnak sırasını kontrol edin.'],
  [/teget cozulemedi/i,
   'İki kasnak arasında teğet çözülemedi: kasnaklar çakışıyor ya da temas tarafları yanlış.'],
  [/en az 3 kasnak gerekli/i, 'En az 3 kasnak gerekli (sürücü + aksesuar + gergi).'],
  [/crank:true kasnak tanimlanmali/i, 'Sürücü kasnak seçilmedi. Bir kasnağın panelinden "Sürücü" işaretleyin.'],
  [/birden fazla crank:true/i, 'Birden fazla sürücü kasnak işaretli; yalnız biri olabilir.'],
  [/tensioner:true kasnak tanimlanmali/i, 'İç topolojide Gergi yok. Sol paletten bir Gergi ekleyin.'],
  [/birden fazla tensioner:true/i, 'Birden fazla Gergi var; çekirdek tek gergi destekliyor.'],
  [/tensioner blogu gerekli/i, 'Gergi verisi eksik.'],
  [/tensioner\.(\w+) gerekli/i, 'Gergi panelinde eksik alan: $1'],
  [/kasnagi icin od \(dis cap\)/i, 'Bir kasnağın dış çapı girilmedi.'],
  [/kasnagi icin x,y gerekli/i, 'Bir kasnağın konumu (X / Y) girilmedi.'],
  [/belt\.effLength gerekli/i, 'Kayış efektif boyu girilmedi (Kayış Özellikleri panelinde).'],
  // Tasarım gerginliği artık sorulmuyor, türetiliyor — bu hata "girilmedi"
  // demek yerine türetmenin neden yapılamadığını göstermeli.
  [/designTensionN veya slackN gerekli/i,
   'Tasarım gerginliği yay dengesinden türetilemedi (gergi yay künyesi veya kol geometrisi eksik).'],
  [/bilinmeyen kayis profili/i, 'Kayış profili tanınmıyor (PK / PJ / PH / PL / PM).'],
  [/markasi yok/i, 'Bu kayış profilinde seçilen marka yok.'],
  [/hedef .* erisilebilir araligin disinda/i,
   'Gergi kolu bu kayış boyuna ulaşamıyor. Kayış boyu, gergi pivotu veya kol boyu uyumsuz.'],
  [/take-up ~0/i, 'Gergi bu konumda kayışı geremiyor (sarım açısı sıfıra iniyor).'],
  [/serbest kol konumunda bile geometri cozulemiyor/i,
   'Serbest kol konumunda bile geometri çözülemiyor: gergi pivotu / kol boyu kasnak yerleşimiyle uyumsuz.'],
  [/kayis hizi sifir/i, 'Kayış hızı sıfır: motor devri veya sürücü kasnak çapı eksik.'],
  [/surucu gucu .* esit degil/i,
   'Sürücü kasnağa elle güç girilmiş ve diğerlerinin toplamına eşit değil. Sürücü gücü girilmez, hesaplanır.']
];
function veFeadTranslateError(msg){
  var s = String(msg == null ? '' : msg);
  for(var i=0;i<VE_FEAD_ERROR_MAP.length;i++){
    var re = VE_FEAD_ERROR_MAP[i][0];
    if(re.test(s)) return s.replace(re, VE_FEAD_ERROR_MAP[i][1]).replace(/^FEADCore[^:]*:\s*/, '');
  }
  return s.replace(/^FEADCore[^:]*:\s*/, '');
}

// ════════════════════════════════════════════════════════════════════════════
//  TOPOLOJİ → ÇEKİRDEK SİSTEMİ
// ════════════════════════════════════════════════════════════════════════════
// Döner:
//   { ok, sys, order, names, byName, errors[], warnings[], cfg }
// ok=false ise errors[] doludur ve sys null'dur. HİÇBİR DURUMDA istisna
// fırlatmaz — panel yarım kurulmuş bir topolojide de çizilebilmeli.
function veFeadBuildSystem(nodeList, connList, opt){
  var out = { ok: false, sys: null, order: [], names: [], byName: {},
              errors: [], warnings: [], cfg: null,
              spring: null, drive: null, freeAngleDeg: NaN,
              springTensionN: NaN };
  var all = nodeList || [];
  // ESKİ KAYIT GÖÇÜ TEK NOKTADAN: her yüzey (panel · kart · rapor · sürükleme)
  // buradan geçiyor, dolayısıyla iki koordinatlı bir kayıt hangi kapıdan
  // girerse girsin tek koordinata dönüşmüş oluyor. Göçü yalnız panele
  // bağlamak, paneli hiç açmadan çözülen bir modelde eski alanların canlı
  // kalması demekti.
  veFeadMigrateAll(all);
  if(typeof FEADCore === 'undefined'){
    out.errors.push('Hesap çekirdeği yüklenmedi (js/fead-core.js).');
    return out;
  }

  var teshis = veFeadRouteDiagnose(all, connList);
  var order = teshis.order;
  out.order = order;
  out.route = teshis;
  // DÖNÜŞ YÖNÜ: rota sırasının SONUCU, ayrı bir bayrak DEĞİL (bkz.
  // veFeadNaturalSense). "Dönüş Yönü" düğümü kabloları çeviriyor; buradan
  // okunan sıra zaten çevrilmiş sıradır.
  out.spin = veFeadNaturalSense(order);
  if(!order.length){ out.errors.push('İç topolojide hiç kasnak yok.'); return out; }
  // TOPOLOJİ GEÇERLİ DEĞİLSE ÇÖZÜLMEZ. Eskiden kopuk kasnak sıraya sessizce
  // ekleniyor ve çekirdek pekâlâ "geçerli" bir çevrim çözüyordu — yani kart
  // kullanıcının KURMADIĞI bir kayışı gösteriyordu. Artık sebep yazılıyor;
  // kanvastaki teller olduğu gibi duruyor.
  teshis.errors.forEach(function(m){ out.errors.push(m); });
  if(order.length < 3){ out.errors.push('En az 3 kasnak gerekli (sürücü + aksesuar + gergi); şu an ' + order.length + '.'); }

  var un = veFeadUniqueNames(order);
  out.names = un.names; out.byName = un.byName;

  var tensNodes = order.filter(function(n){ return !!_feadDefOf(n).isFeadTensioner; });
  if(!tensNodes.length) out.errors.push('İç topolojide Gergi yok. Sol paletten bir Gergi ekleyin.');
  if(tensNodes.length > 1) out.errors.push('Birden fazla Gergi var; çekirdek tek gergi destekliyor.');

  var driver = veFeadResolveDriver(order);
  var explicit = order.filter(function(n){ return n.data && n.data.driver; });
  if(explicit.length > 1) out.errors.push('Birden fazla kasnak "Sürücü" işaretli; yalnız biri olabilir.');
  if(!explicit.length && driver) {
    out.warnings.push('Sürücü kasnak açıkça seçilmedi; "' + _feadNodeName(driver)
      + '" tipinden sürücü sayıldı. Panelinden onaylamanız önerilir.');
  }

  var beltNode = all.filter(function(n){ return !!_feadDefOf(n).isFeadBelt; })[0] || null;
  var solvNode = all.filter(function(n){ return !!_feadDefOf(n).isFeadSolver; })[0] || null;
  // Çözücü düğümünün KENDİSİ de taşınır: duty tablosu (devir listesi) buradan
  // okunuyor ve kartın devir seçicisi ona bakıyor. Yalnız cfg'yi çıkarıp
  // düğümü atmak, kartı "nodes" global'ini elle taramaya zorlardı — köprü
  // katmanının DOM'suz kalması tam olarak bunu engellemek için.
  out.solver = solvNode;
  if(!beltNode) out.errors.push('Kayış Özellikleri bileşeni yok. Sol paletten ekleyin.');
  if(!solvNode) out.warnings.push('Çözücü bileşeni yok; tasarım gerginliği ve tahrik oranı varsayılanla alınır.');

  // ── GERGİ SERPANTİNDE SON SIRADA MI — KARŞILAŞTIRILABİLİRLİK ÖLÇÜTÜ ─────
  //
  // On Gates raporunun ONUNDA DA sıra sürücüyle başlayıp gergiyle bitiyor:
  // gergi, kayışın sürücüye DÖNÜŞ açıklığındadır (ölçüldü, AG00686:
  // T = 1209.95 · 1208.48 · 767.47 · TEN 766.00 — en düşük, ankrajın kendisi).
  //
  // BU, `veFeadTensionerSide` HÜKMÜNÜN İKİNCİ KOPYASI DEĞİL — iki AYRI soru:
  //
  //   | | `tensionerSide` (analiz) | buradaki ölçüt (kurulum) |
  //   |---|---|---|
  //   | Sorduğu | span gerilmesi ankrajın ALTINA iniyor mu | sıra tedarikçi
  //     konvansiyonuna uyuyor mu |
  //   | Kanıtı | duty satırlarının gerilmeleri | `out.order` içindeki konum |
  //   | Yanlışsa | model FİZİKSEL olarak geçersiz | model geçerli, yalnız
  //     arşivle satır satır karşılaştırılamaz |
  //
  // ÖLÇÜLDÜ ve ikisi GERÇEKTEN ayrışıyor: sihirbazın "⇄ Yönü çevir"i AG00976'yı
  // `p1>ten>p5>p4>p3>p2` yapıyor — burada uyarı düşüyor ama `tensionerSide.ok`
  // hâlâ `true`, `beltLengthMm` ve `springTensionN` altı ondalığa kadar
  // BİREBİR aynı. Zincir gergide ankrajlı olduğu için ters yürütme fiziği
  // bozmuyor; bozduğu tek şey yerleşimin okunma sırası.
  //
  // UYARI, ZORLAMA DEĞİL — çözümü durdurmak doğru bir modeli reddetmek olurdu.
  // Sıranın ÇEVRİMSEL döndürülmesi zaten bedava (ölçüldü, AG00686 dört konuma
  // da döndürüldü: ΔT = 0.0e+0 · ΔH = 0.0e+0 · L_eff birebir); gerginin halkada
  // sürücünün ÖBÜR yanına alınması ise bedava DEĞİL, başka bir yerleşimdir
  // (ölçüldü: L 1714.61 → 2459.29 mm). Uyarı bu yüzden "şunu yap" demiyor,
  // farkın ne olduğunu söylüyor.
  (function(){
    var seq = out.order || [];
    if(seq.length < 3) return;
    var ti = -1;
    for(var i=0;i<seq.length;i++) if(_feadDefOf(seq[i]).isFeadTensioner) ti = i;
    if(ti < 0) return;
    // HÜKÜM HER İKİ YÖNDE DE YAZILIR: "denetlendi ve uygun" ile "hiç
    // denetlenmedi" ayırt edilebilsin (rozetin renk İDDİA ETMEME kuralının
    // aynısı — alan yoksa yüzey hüküm veremez).
    out.tensionerOrder = { index: ti, count: seq.length, last: ti === seq.length - 1 };
    if(out.tensionerOrder.last) return;
    out.warnings.push('Serpantin sırasında gergi son sırada değil ("'
      + _feadNodeName(seq[ti]) + '" ' + (ti+1) + '/' + seq.length + '). Gates '
      + 'konvansiyonunda sıra sürücüyle başlar, gergiyle biter — gergi kayışın '
      + 'sürücüye DÖNÜŞ açıklığındadır. Sayılar bundan etkilenmiyor; etkilenen '
      + 'yerleşimin tedarikçi raporlarıyla satır satır karşılaştırılabilirliği.');
  }());

  var bd = (beltNode && beltNode.data) || {};
  var sd = (solvNode && solvNode.data) || {};
  var td = (tensNodes[0] && tensNodes[0].data) || {};

  // VARSAYILAN DEFTERİ — hangi alanın arşivden doldurulduğu sonucun içinde
  // taşınır (panel · rapor · özet aynı listeyi okur). Bkz. VE_FEAD_DEFAULTS.
  out.defaults = [];
  function _varsay(alan, deger, birim, kaynak){
    out.defaults.push({ field: alan, value: deger, unit: birim || '', source: kaynak || '' });
    return deger;
  }

  // ── Kasnaklar ──
  var cfgPulleys = order.map(function(n, i){
    var isTen = !!_feadDefOf(n).isFeadTensioner;
    var p = { name: un.names[i], od: veFeadOD(n), contact: veFeadContactOf(n) };
    if(isTen) p.tensioner = true;
    else {
      p.x = _feadNum(n.data && n.data.x, NaN);
      p.y = _feadNum(n.data && n.data.y, NaN);
      if(!Number.isFinite(p.x) || !Number.isFinite(p.y))
        out.errors.push('"' + un.names[i] + '" kasnağının konumu (X / Y) girilmedi.');
    }
    if(driver && n.id === driver.id) p.crank = true;
    var J = _feadNum(n.data && n.data.inertia, 0);
    if(J > 0) p.inertiaKgM2 = J;
    else if(_feadBlank(n.data && n.data.inertia)){
      // SÜRÜCÜ DÜĞÜMÜNDE ÖNCE ÇÖZÜCÜNÜN KRANK MİLİ ALANI: kullanıcı orada bir
      // sayı verdiyse burulma modeli de onu görmeli, ikinci bir yerde ayrı bir
      // varsayılana düşmemeli.
      var isDrv = !!(driver && n.id === driver.id);
      var Jd = isDrv ? _feadNum(sd.crankInertia, NaN) : NaN;
      if(!(Jd > 0)) Jd = veFeadDefaultInertia(n.type, isDrv);
      if(Jd > 0){
        p.inertiaKgM2 = Jd;
        _varsay('atalet · ' + un.names[i], Jd, 'kg·m²',
          isDrv ? 'Gates Engine Data (krank mili) medyanı' : 'Gates Accessory Data medyanı');
      }
    }
    if(!veFeadHasOD(n))
      out.warnings.push('"' + un.names[i] + '" dış çapı girilmedi; tipe göre '
        + VE_FEAD_DEFAULT_DIA[n.type] + ' mm varsayıldı.');
    return p;
  });

  // ── Kayış ──
  // Kayış boyu SABİT kipte zorunlu bir GİRDİ, SERBEST kipte hesaplanan bir
  // ÇIKTI. İkincisinde boş bırakılması hata değil, kipin kendisi.
  var beltMode = veFeadBeltMode(bd);
  // GERGİ VARSA KAYIŞ BOYU BİR ÇIKTIDIR — kip seçimi yok.
  // Kullanıcı isteği (2026-08-28): *"kayış boyu KESİNLİKLE BİR SONUÇ OLACAK."*
  // Montaj konumu girdi olduğunda kol açısı zarftan seçiliyor, kayış boyu da
  // o açının sonucu. Sabit kip burada bir çelişki olurdu: iki farklı yol aynı
  // tek serbestlik derecesini iki farklı yerden çözerdi.
  //
  // KOŞUL `veFeadBeltModeLocked` İLE — panel rozeti de aynı fonksiyonu okuyor.
  // Koşulsuz yazsaydık gergisiz bir modelde panel seçici gösterip çözücü onu
  // yok sayardı (bu modülde belgeli "panel bir şey söyler, hesap başka şey
  // yapar" sınıfı).
  if(veFeadBeltModeLocked(all)) beltMode = 'free';
  out.beltMode = beltMode;
  out.beltDataMode = veFeadBeltDataMode(bd);
  var effLength = _feadNum(bd.effLength != null ? bd.effLength : bd.length, 0);
  if(beltMode === 'fixed' && !(effLength > 0))
    out.errors.push('Kayış efektif boyu girilmedi (Kayış Özellikleri panelinde).');
  var ribs = _feadNum(bd.ribs, 0);
  if(!(ribs > 0)) out.errors.push('Kayış kanal (kaburga) sayısı girilmedi.');
  var cfgBelt = {
    profile: bd.profile || 'PK',
    brand: bd.brand || 'GATES',
    // KATALOG ADI ÇÖZÜME TAŞINIR. Düğüm verisinde duruyordu ama köprü onu
    // sys.belt'e geçirmediği için özet rapor kayışın kimliğini BASAMIYORDU
    // (belgede '8PK1715HD' 0 kez geçiyordu). Hesaba girmez, yalnız künyedir —
    // ama tedarikçiyle konuşurken tek tanımlayıcı odur.
    beltType: (typeof bd.beltType === 'string' && bd.beltType) ? bd.beltType : undefined,
    ribs: ribs || undefined,
    effLength: effLength || undefined,
    tolerance: _feadNum(bd.tolerance, 0),
    wearPct: _feadNum(bd.wearPct, 0)
  };
  // TOLERANS + AŞINMA PAYI — boş bırakılmışsa arşivden. Bu ikisi konum
  // tablosunun ZARFINI kuruyor (Replace = L+tol+w·L … Min = L−tol); sıfır
  // kalınca dört sütun aynı açıya çöküyor ve tablo tek anlamlı sütuna iniyor.
  // ÖLÇÜLDÜ (AG00879 denetimi): kullanıcı alanları boş bıraktığı için rapor
  // "Zarf daralmış" notuyla çıkmıştı.
  //
  // TOLERANS BASAMAĞI BOYA BAĞLI, boy ise SERBEST KİPTE henüz belli değil —
  // bu yüzden burada bir ilk değer konuyor, çalışma noktası çözülünce
  // türetilen boya göre AŞAĞIDA düzeltiliyor (`_tolVarsayildi`).
  var _tolVarsayildi = _feadBlank(bd.tolerance);
  if(_tolVarsayildi) cfgBelt.tolerance = veFeadDefaultBeltTol(effLength);
  if(_feadBlank(bd.wearPct))
    cfgBelt.wearPct = _varsay('kayış uzama + aşınma payı',
      VE_FEAD_DEFAULTS.wearPct, 'oran', '14 Gates sisteminin 10\'u: %0,70');
  var mpr = _feadNum(bd.massPerRibKgM, 0);
  if(mpr > 0) cfgBelt.massPerRibKgM = mpr;

  // ── Gergi ──
  // TEK KOORDİNAT: AVARA MERKEZİ (`cenX/cenY`), diğer bütün kasnaklarla aynı
  // sütundan. Gövdenin montaj konumu bir girdi DEĞİL, bu noktadan ve kolun
  // çalışma açısından TÜREYEN bir sonuçtur (p = c − a·(cos θ, sin θ)) —
  // atölyeye giden sayı odur. Karşılaştırılacak ikinci bir nokta olmadığı
  // için doğrulama da YOKTUR.
  var cenX = _feadNum(td.cenX, NaN), cenY = _feadNum(td.cenY, NaN);
  var armLen = _feadNum(td.armLen, 0);
  var armAbs = _feadNum(td.armMeanDeg, NaN);
  var preload = _feadNum(td.preload, NaN);
  var rate = _feadNum(td.kArm, NaN);
  var spring = veFeadSpringSetup(td);
  out.spring = spring;
  out.center = (Number.isFinite(cenX) && Number.isFinite(cenY)) ? [cenX, cenY] : null;
  var _piv = veFeadTensionerPivot(td);
  out.pivot = _piv;
  out.armAbsDeg = armAbs;
  if(tensNodes.length === 1){
    if(!Number.isFinite(cenX) || !Number.isFinite(cenY))
      out.errors.push('Otomatik gergi avarasının merkez koordinatı (X / Y) '
        + 'girilmedi. Kayış yolu bu noktadan geçiyor; gövdenin montaj konumu '
        + 'ondan ve kol çalışma açısından türer.');
    if(!(armLen > 0)) out.errors.push('Gergi kol boyu girilmedi.');
    // KOL ÇALIŞMA AÇISI BİR GİRDİ ve varsayılanı YOK. Avara merkezi
    // verildikten sonra kayış yolu tamamen belirli; geriye kalan tek
    // serbestlik derecesi gövdenin montajdaki saat konumudur ve o bir
    // PAKETLEME kararıdır — kayış fiziğinden çıkarılamaz (ölçüldü: en iyi
    // aday ölçüt bile 14 Gates sisteminin yalnız 2'sini ±5° içinde buluyor,
    // medyan sapma 15,9°). Uydurulmuş bir varsayılan sessizce yanlış
    // gerginlik üretirdi.
    if(!Number.isFinite(armAbs))
      out.errors.push('Gergi kolunun çalışma açısı (mutlak, +X\'ten CCW) '
        + 'girilmedi. Gergi gövdesinin montajdaki saat konumu budur ve '
        + 'gerginin parça/montaj çiziminde yazar (E9843: 344°). Avara merkezi '
        + 'ile birlikte gövdenin montaj konumunu ve take-up yönünü belirler.');
    if(!Number.isFinite(preload)) out.errors.push('Gergi yay ön yük momenti girilmedi.');
    if(!Number.isFinite(rate)) out.errors.push('Gergi yay katsayısı (Nm/°) girilmedi.');
    if(!Number.isFinite(spring.relMeanDeg))
      out.errors.push('Yay çalışma momenti (Spring Mean Load) girilmedi; kolun '
        + 'nominal dönmesi (M_mean − M₀)/k onsuz türetilemez ve serbest kol '
        + 'açısı kurulamaz.');
    spring.notes.forEach(function(n){ out.warnings.push(n); });
  }
  // Serbest açı bir GİRDİ DEĞİL: kol çalışma açısından türüyor
  // (armAbs = free + sense·rel_nom). `sense`i çekirdek bulduğu için burada
  // geçici olarak çalışma açısı yazılıyor; gerçek değer aşağıdaki İKİNCİ
  // GEÇİŞ blokunda düzeltiliyor.
  var cfgTen = {
    pivot: _piv || [NaN, NaN], armLength: armLen,
    preloadNm: preload, rateNmPerDeg: rate,
    freeAngleDeg: Number.isFinite(armAbs) ? armAbs : 0
  };
  if(td.sense === 1 || td.sense === -1 || td.sense === '1' || td.sense === '-1')
    cfgTen.sense = _feadNum(td.sense, 1) >= 0 ? 1 : -1;
  var stop = _feadNum(td.loadStopRelDeg, NaN);
  if(Number.isFinite(stop) && stop > 0) cfgTen.loadStopRelDeg = stop;
  // Durdurucu VARSAYILANI burada DEĞİL, sistem kurulduktan sonra uygulanıyor
  // (aşağıdaki "DURDURUCU VARSAYILANI" bloğu) — çünkü yalnız DARALTMASINA izin
  // veriliyor ve neyi daralttığı ancak çekirdeğin kendi erişim sınırı
  // hesaplandıktan sonra bilinebiliyor.
  var armJ = _feadNum(td.armInertia, 0);
  if(armJ > 0) cfgTen.armInertiaKgM2 = armJ;
  else if(_feadBlank(td.armInertia))
    cfgTen.armInertiaKgM2 = _varsay('gergi kolu ataleti',
      VE_FEAD_DEFAULTS.tenArmInertiaKgM2, 'kg·m²',
      'Gates System Vibration medyanı (n=7)');
  // Kol, kasnağı kol boyu yarıçapında nokta kütle olarak taşır. Burulma
  // modelinde bu terim ihmal edilirse 1. mod belirgin şekilde yüksek çıkar
  // (kalibrasyonda RMS %28 -> %17 fark etti). Gates raporunun "Tensioner
  // Pulley Mass" satırı tam olarak bu.
  var armM = _feadNum(td.pulleyMass, 0);
  if(armM > 0) cfgTen.pulleyMassKg = armM;
  else if(_feadBlank(td.pulleyMass))
    cfgTen.pulleyMassKg = _varsay('gergi kasnağı kütlesi',
      VE_FEAD_DEFAULTS.tenPulleyMassKg, 'kg',
      'Gates System Vibration medyanı (n=7)');

  // ── Çözücü / tasarım ──
  // TASARIM GERGİNLİĞİ ARTIK SORULMUYOR. Bağımsız bir veri değil: geometri ve
  // yay künyesi verildiğinde gergi kasnağının taşıdığı gerginlik zaten
  // belirlidir (T = M/(dL/dθ)). Sistem kurulduktan SONRA türetilip
  // sys.designTensionN'e yazılıyor — bkz. "ANKRAJ TÜRETİLİYOR" bloğu.
  var dr = veFeadDriveRatio(sd);
  out.drive = dr;
  var driveRatio = dr.ratio;
  if(!(driveRatio > 0)) driveRatio = 1;

  var cfg = {
    pulleys: cfgPulleys, belt: cfgBelt, tensioner: cfgTen,
    designTensionN: undefined,          // aşağıda türetilir
    driveRatio: driveRatio,
    // BOY OFSETİ — girilmemişse arşiv ortalaması. Fiziksel bir sabit değil,
    // Gates'in katalog yuvarlama artığı (bkz. VE_FEAD_DEFAULTS).
    lengthOffsetMm: _feadBlank(sd.lengthOffsetMm)
      ? _varsay('kayış boyu ofseti', VE_FEAD_DEFAULTS.lengthOffsetMm, 'mm',
                '5 Gates raporunun ortalaması (0,4 … 2,0)')
      : _feadNum(sd.lengthOffsetMm, 0),
    // Kapanma ve temizlik ihlalleri artık istisna DEĞİL, taşınan birer ihlal.
    // Sürüklerken kullanıcı çözüm uzayına dışarıdan giriyor; ara karelerde
    // "model çözülemez" demek yerine sayıyı verip yolun neden geçersiz
    // olduğunu yazıyoruz. Kasnak çakışması bunun dışında: orada teğet YOK.
    geomOpt: { tolerant: true }
  };
  out.cfg = cfg;

  // ── ORAN SİSTEMİ — AKSESUAR DEVRİ GEOMETRİYE BAĞLI DEĞİL ─────────────────
  //
  // Kullanıcı bildirimi (2026-08-31): *"Motor ve çevrim kısmında aksesuarların
  // tiplerini seçtiğimde değerler hala gelmiyor."* Ölçüldü ve haklıydı — ama
  // sebep katalogda değil KAPIDA: `veFeadAutoKw` çözülmüş bir `sys` istiyor,
  // `sys` ise ancak bütün koordinatlar girildikten sonra kuruluyor. Yarım bir
  // modelde kullanıcı modeli seçiyor, tablo `—` basıyordu.
  //
  // Oysa aksesuar devri çözülmüş geometriye BAĞLI DEĞİL. Çekirdeğin kendi
  // tanımı (fead-core.js `speedRatio`):
  //
  //     oran(i) = driveRatio · rPitch(sürücü) / rPitch(i)
  //
  // Üç sayının üçü de ÇAPTAN ve kayış profilinden geliyor; teğet noktası,
  // sarım açısı, kol açısı hiçbiri girmiyor. Bu yüzden burada oran için
  // yeterli, ama geometri için yetersiz bir "sys" kuruluyor.
  //
  // FİZİK KOPYALANMIYOR: yarıçapı çekirdeğin kendi `beltProps` + `radiiFromOD`
  // fonksiyonları veriyor ve devri yine çekirdeğin `accessoryRpm`'i okuyor.
  // İkinci bir formül yazmak, profil sabiti değiştiğinde iki yüzeyin sessizce
  // ayrışması demekti.
  //
  // `out.sys` VARSA O KAZANIR (aşağıda kurulunca `ratioSys` de ona eşitlenir):
  // çözülmüş model tek bir gerçek kaynak taşımalı.
  out.ratioSys = veFeadRatioSys(cfgPulleys, cfgBelt, driveRatio);

  if(out.errors.length) return out;              // eksik girdiyle çekirdeği çağırma

  // Kol çalışma açısı bir GİRDİ (yukarıda zorunlu tutuldu); zarf seçimi ve
  // ona ait memo/sabitleme yüzeyleri kalktı (gerekçesi ve ölçümü
  // "MONTAJ ZARFI KALKTI" bloğunda). Serbest açı ondan türeyecek:
  // armAbs = free + sense·rel_nom — `sense`i çekirdek bulduğu için şimdilik
  // çalışma açısı yazılı, İKİNCİ GEÇİŞ blokunda düzeltiliyor.
  cfg.tensioner.freeAngleDeg = out.armAbsDeg;
  delete cfg.tensioner.sense;

  var sys;
  try {
    sys = FEADCore.makeSystem(cfg);
  } catch(e){
    out.errors.push(veFeadTranslateError(e && e.message));
    return out;
  }

  // İKİNCİ GEÇİŞ — sense artık belli. Montaj konumu yolunda serbest açı
  // sense'e bağlı olduğu için ilk geçişte sense=+1 varsayılmıştı; çekirdek
  // −1 bulduysa serbest açı montaj açısının ÖTEKİ yanındadır ve sistem
  // yeniden kurulmalıdır. sense yalnız geometriye (hangi yön kayışı kısaltır)
  // baktığı için tek geçişte oturur; ikinci kez değişmez.
  {
    // armAbs = free + sense·rel_nom  →  free = armAbs − sense·rel_nom
    var free2z = out.armAbsDeg - sys.tensioner.sense * spring.relMeanDeg;
    if(Number.isFinite(free2z) && Math.abs(free2z - cfg.tensioner.freeAngleDeg) > 1e-9){
      cfg.tensioner.freeAngleDeg = free2z;
      cfg.tensioner.sense = sys.tensioner.sense;
      try { sys = FEADCore.makeSystem(cfg); }
      catch(e){ out.errors.push(veFeadTranslateError(e && e.message)); return out; }
    }
    out.freeAngleDeg = cfg.tensioner.freeAngleDeg;
  }


  // ── DURDURUCU VARSAYILANI — YALNIZ DARALTIR ───────────────────────────
  //
  // Mekanik durdurucu girilmemişse nominal dönüşten ölçekleniyor (arşiv:
  // stop/nominal 1,44 … 2,15). Ama bu varsayılan çekirdeğin kendi erişim
  // sınırından BÜYÜK olamaz, ve bu bir incelik değil ÖLÇÜLMÜŞ bir tuzak:
  //
  //   İlk sürüm varsayılanı koşulsuz yazıyordu. Yay katsayısı yanlış girilmiş
  //   bir modelde (k = 0,048 yerine 0,480 — bir ondalık kayması) nominal dönüş
  //   280,6° çıkıyor, varsayılan da 505°'ye kuruluyordu. Çekirdeğin 89°'lik
  //   yedeği o modeli KENETLİYOR ve panel "kol nominal açısına oturamadı"
  //   diyordu; 505°'lik sınırla kenetlenme kalkıyor, kol tam bir turun
  //   ötesine gidiyor ve `feasibleRelMax`in bisect'i monoton olmayan bir
  //   fonksiyonda çözülebilir BAŞKA bir dala oturuyordu. Sonuç: uyarı
  //   kayboluyor, model saçma bir kol açısıyla "çözülmüş" görünüyordu.
  //
  // Bu yüzden karşılaştırma çekirdeğin KENDİ sınırına karşı yapılıyor
  // (mirror bir sabit tutmuyoruz) ve varsayılan ancak onu daraltıyorsa
  // uygulanıyor. Daraltmıyorsa hiçbir şey değişmez — eski davranış birebir.
  if(_feadBlank(td.loadStopRelDeg) && spring && spring.relMeanDeg > 0){
    var _stopAday = spring.relMeanDeg * VE_FEAD_DEFAULTS.loadStopFactor;
    var _stopCek = NaN;
    try { _stopCek = FEADCore.feasibleRelMax(sys); } catch(e){ _stopCek = NaN; }
    if(Number.isFinite(_stopCek) && _stopAday > 0 && _stopAday < _stopCek){
      // İKİSİNE DE yazılıyor: `sys` hesabın kendisi, `cfg` ise dışarıya
      // verilen kayıt (rapor, bant önbelleğinin anahtarı, testler). cfg
      // güncellenmezse kurulan sistem ile onun künyesi ayrışırdı.
      // (`sys._cache` burada BOŞ — makeSystem onu sıfırlıyor ve meanRel ancak
      // çalışma noktası çözüldükten SONRA tohumlanıyor; temizlemek ölü koddu.)
      sys.tensioner.loadStopRelDeg = _stopAday;
      cfgTen.loadStopRelDeg = _stopAday;
      _varsay('gergi mekanik durdurucu (load stop)', _stopAday, '° (bağıl)',
        'nominal dönüş × ' + VE_FEAD_DEFAULTS.loadStopFactor
        + ' — 12 ölçülmüş gergi künyesinin ortalaması');
    }
  }

  // ── KOL AÇISININ İMALAT KARŞILIĞI ──────────────────────────────────────
  // Pim planı İKİ KİPTE DE kuruluyor, çünkü ikisinde de kol çalışma açısı bir
  // ÇIKTIDIR: zarf kipinde ölçütten seçiliyor, montaj kipinde girilen kasnak
  // merkezinden türüyor (montajDeg = pivot → merkez). Kolun nasıl bulunduğu
  // değişse de "gövdeyi bu saate kuran pim nerede" sorusu aynı.
  var _armWork = _feadNum(out.armAbsDeg, NaN);
  out.pin = veFeadPinPlan(td, _armWork);

  // GEOMETRİ PROBU — makeSystem YALNIZ YAPIYI doğrular (alanlar var mı, tek
  // krank/gergi var mı); kayış yolunun gerçekten çözülüp çözülmediğine BAKMAZ.
  // O denetimler (sarım değişmezi, teğet çözümü, kasnak çakışması) ancak
  // solveGeometry çağrılınca çalışır. Prob olmasaydı köprü "çözüldü" der,
  // hemen ardından şema ve konum tablosu ayrı ayrı patlardı — kullanıcı
  // panelde "Geometri: çözüldü" görürken altında hata okurdu.
  // Serbest kol (rel = 0) yeterli: yerleşim orada da çözülmüyorsa hiç çözülmez.
  //
  // HOŞGÖRÜLÜ KİPTE BU PROB ARTIK YALNIZ TEK BİR ŞEYİ YAKALAR: kasnakların
  // birbirinin içine girmesi. Kapanmayan çevrim ve kasnağı kesen kayış artık
  // istisna atmıyor, `geom.violations` olarak taşınıyor — çünkü o iki durumda
  // sayılar HESAPLANABİLİYOR (teğet noktaları, spanlar, sarımlar); geçersiz
  // olan YOL, aritmetik değil. Çakışmada ise teğet YOKTUR: üretilecek bir sayı
  // da yoktur, o yüzden orası hâlâ durduruyor.
  try {
    FEADCore.geometryAt(sys, 0);
  } catch(e){
    out.errors.push(veFeadTranslateError(e && e.message));
    return out;
  }

  // ── ÇALIŞMA NOKTASI ────────────────────────────────────────────────────
  // Kolun oturduğu açı ile kayış boyu tek serbestlik derecesini paylaşıyor;
  // hangisinin girdi olduğunu kip söylüyor (bkz. veFeadBeltMode).
  //
  // Sonuç HER ZAMAN bir açı veriyor: hedef kolun erişemediği yerdeyse en yakın
  // uca kenetleniyor ve sebebi `atLimit` ile taşınıyor. Bu yüzden aşağıdaki
  // bütün zincir (konum tablosu, gerilme, ömür, rapor) girdiden bağımsız
  // olarak ÇALIŞIR — "çözülemez" diye bir küme kalmıyor.
  // Nominal kol açısı SALT YAY KÜNYESİNDEN çıkar (M_mean, M₀, k) — geometriye
  // bakmaz, dolayısıyla ankrajın türetilmesiyle döngü kurmaz.
  var nomRel = spring.relMeanDeg;
  var wp = veFeadWorkingPoint(sys, beltMode, nomRel);
  out.workPoint = wp;
  if(wp.error){ out.errors.push(wp.error); return out; }

  if(beltMode === 'free'){
    // TÜRETİLEN boy çekirdeğe geri yazılır: positionTable, meanRel,
    // ribFatigueDistribution ve beltLifeB10 hepsi belt.effLength okuyor.
    // Böylece serbest kip, "boyu hesaplanmış sabit kip"e indirgeniyor ve
    // aşağıdaki hiçbir hesap kipten haberdar olmak zorunda kalmıyor.
    sys.belt.effLength = wp.effLengthMm;
    cfgBelt.effLength = wp.effLengthMm;
  }
  // TOLERANS BASAMAĞI ARTIK BOYU BİLİYOR. Serbest kipte boy buraya kadar
  // belli değildi; varsayılan basamak ancak şimdi doğru seçilebilir. Sabit
  // kipte de aynı satırdan geçiyor — iki kip için iki ayrı kod yolu tutmak
  // bu modülde tam olarak sessiz ayrışmanın kaynağı olurdu.
  if(_tolVarsayildi){
    var tolD = veFeadDefaultBeltTol(sys.belt.effLength);
    sys.belt.tolerance = tolD; cfgBelt.tolerance = tolD;
    _varsay('kayış boy toleransı ±', tolD, 'mm',
      'Gates basamağı: boy < ' + VE_FEAD_DEFAULTS.beltTolBreakMm + ' mm → ±'
      + VE_FEAD_DEFAULTS.beltTolShortMm + ', üstü → ±' + VE_FEAD_DEFAULTS.beltTolLongMm);
  }
  // meanRel ÖNCEDEN TOHUMLANIR. Kenetlenmiş bir çalışma noktasında çekirdeğin
  // kendi meanRel'i yine bisect'e girip atardı; önbelleğe yazınca zincirin
  // tamamı kenetlenmiş açıyı kullanıyor. (Çekirdeğin önbellek sözleşmesi:
  // `_cache.meanRel` doluysa yeniden çözmez.)
  sys._cache = sys._cache || {};
  sys._cache.meanRel = wp.relDeg;

  out.relDeg = wp.relDeg;
  out.beltLengthMm = wp.effLengthMm;
  out.beltLengthDerived = !!wp.derived;
  if(wp.atLimit) out.warnings.push(veFeadAtLimitText(wp.atLimit));

  // Çalışma noktasındaki geometri ihlalleri (hoşgörülü kip) — sayı üretildi
  // ama yol geçersizse kullanıcı bunu OKUMALI.
  try {
    var gWp = FEADCore.geometryAt(sys, wp.relDeg);
    (gWp.violations || []).forEach(function(v){
      out.warnings.push(veFeadViolationText(v));
    });
    out.geomValid = (gWp.violations || []).length === 0;
  } catch(e){ out.geomValid = false; }

  out.sys = sys;
  out.ratioSys = sys;      // çözülmüş model TEK kaynak taşır
  out.ok = true;

  // ── ANKRAJ TÜRETİLİYOR — tasarım gerginliği bir GİRDİ DEĞİL ───────────────
  //
  // Gerilme zinciri gergi kasnağında ankrajlanır: T[gergi] = designTensionN ve
  // bütün span gerilmeleri, hubloadlar, kayma emniyetleri ondan kurulur. Bu
  // sayı eskiden Çözücü panelinden SORULUYORDU — ama bağımsız bir veri değil:
  // gergi kolunun taşıyabileceği gerginlik yay dengesinden zaten belirli.
  //
  //     T = M(θ) / (dL/dθ),   M = M₀ + k·θ,   dL/dθ = a·sinβ·2sin(φ/2)
  //
  // Sağdaki her şey ya girdidir (kol boyu a, yay künyesi M₀/k) ya da çözülmüş
  // geometriden gelir (θ, φ, β). Ayrıca sormak aynı bilgiyi İKİNCİ KEZ ve
  // ÇELİŞEBİLİR biçimde istemek demekti; çekirdek çeliştiğinde hangisinin
  // doğru olduğunu sormuyor, girileni kullanıp yay dengesini yok sayıyordu.
  //
  // ÖLÇÜLDÜ (10 Gates raporu, girilen ↔ türeyen): en büyük fark %0.12, RMS
  // %0.08 — farkların tamamı yuvarlama (Gates tam sayı basıyor: 766 ↔ 765.9).
  // Yani iki sayı zaten aynı sayıydı. Türetilmiş ankrajla 2095 değerlik
  // doğrulama kapısı GEÇİYOR: çalışma sapması %0.328 → %0.391 (eşik %0.5),
  // Load ve kol açısı hiç değişmiyor. O 0.06 puan Gates'in kendi zincirini
  // YUVARLANMIŞ tam sayıyla ankrajlamasından geliyor, model hatasından değil.
  //
  // Türetme BAŞARISIZ olursa ankraj yoktur ve gerilme hesabı yapılamaz. Bunu
  // sessizce geçmiyoruz: uyarı düşer, çekirdek de kendi açık hatasını verir.
  // (out.ok true kalır ki yarım modelde kayış yolu kartı çizilmeye devam
  // etsin — kart gerginlik değil geometri gösteriyor.)
  //
  // NOT (kayış kipi): `meanRel` yukarıda ÇALIŞMA NOKTASIYLA tohumlandığı için
  // burada okunan açı kipin bulduğu açıdır — sabit kipte kayış boyundan,
  // serbest kipte gerginin nominal yay yükünden. Kenetlenmiş bir modelde de
  // ankraj o kenetli açıdan türer, yani gerilme zinciri her durumda kurulur.
  try {
    var mrTut = FEADCore.meanRel(sys);
    var tsTut = FEADCore.tensionerState(sys, mrTut);
    if(tsTut && Number.isFinite(tsTut.tensionN) && tsTut.tensionN > 0){
      out.springTensionN = tsTut.tensionN;
      sys.designTensionN = tsTut.tensionN;
      cfg.designTensionN = tsTut.tensionN;      // cfg ile sys ayrışmasın
    } else {
      out.warnings.push('Tasarım gerginliği yay dengesinden türetilemedi; '
        + 'gerilme, hubload ve ömür hesaplanamaz. Gergi yay künyesini (ön yük, '
        + 'yay katsayısı) ve kol geometrisini kontrol edin.');
    }
  } catch(e){
    out.warnings.push('Tasarım gerginliği yay dengesinden türetilemedi: '
      + veFeadTranslateError(e && e.message));
  }

  if(sys._senseAuto)
    out.warnings.push('Gergi dönüş yönü (sense) verilmedi; çekirdek kayışın kısaldığı yönden '
      + (sys.tensioner.sense > 0 ? '+1' : '−1') + ' buldu.');
  return out;
}

// Canlı globallerden kur (tarayıcı yolu).
function veFeadBuildFromCanvas(opt){
  if(typeof nodes === 'undefined') return veFeadBuildSystem([], [], opt);
  return veFeadBuildSystem(nodes, (typeof connections !== 'undefined') ? connections : [], opt);
}

// Aktif topolojideki kasnakları kayış sırasında topla.
function veFeadGatherPulleys(){
  if(typeof nodes === 'undefined') return [];
  return veFeadRouteOrder(nodes, (typeof connections !== 'undefined') ? connections : []);
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇALIŞMA ÇEVRİMİ (DUTY CYCLE)
// ════════════════════════════════════════════════════════════════════════════
// Çekirdek her duty noktası için şunu ister:
//   { engineRpm, dcPct, loadsKw: { kasnakAdı: kW }, degC }
// Kullanıcı arayüzünde ise satırlar Çözücü düğümünde durur:
//   node.data.duty = [ { rpm, dcPct, degC, kw: { <düğüm id>: kW } } ]
//
// kW sözlüğü DÜĞÜM KİMLİĞİYLE anahtarlanır, ADLA DEĞİL: kullanıcı bir kasnağı
// yeniden adlandırdığında girdiği güç kaybolmasın. Çekirdeğe geçerken ada
// çevrilir (çekirdek adı anahtar olarak kullanıyor).
//
// SÜRÜCÜ GÜCÜ GİRİLMEZ. Çekirdek onu diğerlerinin toplamı olarak hesaplar;
// çevrim ancak böyle kapanır. Girilirse tutarlılık denetlenir ve uyuşmazsa
// hata verilir — bu yüzden tabloda sürücü sütunu hiç açılmaz.
function veFeadDutyRows(solverNode){
  var raw = (solverNode && solverNode.data && solverNode.data.duty);
  if(!Array.isArray(raw)) return [];
  return raw.map(function(r){
    return {
      rpm: _feadNum(r && r.rpm, 0),
      dcPct: _feadNum(r && r.dcPct, 0),
      degC: _feadNum(r && r.degC, 90),
      kw: (r && r.kw) ? r.kw : {}
    };
  });
}

// Aksesuar tipi → MFSim'in mevcut katalog kütüphanesi. Araç Performans modülü
// bu eğrileri zaten taşıyor (js/cp-accessories.js); FEAD onları YENİDEN
// TANIMLAMAZ, aynı kaynağı okur.
var VE_FEAD_PRESET_LIB = {
  'fead-alternator': 'VE_ALTERNATOR_PRESETS',
  'fead-ac':         'VE_AC_PRESETS',
  'fead-aircomp':    'VE_AIRCOMP_PRESETS'
};
function veFeadPresetLib(type){
  var nm = VE_FEAD_PRESET_LIB[type];
  if(!nm) return null;
  try { /* jshint evil:true */ var lib = eval(nm); return lib || null; } catch(e){ return null; }
}
function veFeadPresetOf(node){
  var lib = veFeadPresetLib(node && node.type);
  var key = node && node.data && node.data.accPreset;
  if(!lib || !key || key === '__manual__') return null;
  return lib[key] || null;
}

// Katalogdan güç [kW]. Aksesuar devri, kasnak PITCH ÇAPLARINDAN gelen gerçek
// oranla hesaplanır — preset'in kendi driveRatio'su KULLANILMAZ.
//
// Bu bilinçli: spesifikasyon (§2.3) Excel'in en ciddi hatasının elle yazılmış
// hız oranları olduğunu söylüyor — kasnak çaplarıyla çelişince bütün
// gerilmeler %17 düşük çıkmış. Oran her zaman çaptan hesaplanır.
function veFeadAutoKw(sys, idx, node, engineRpm){
  if(typeof FEADCore === 'undefined' || !sys) return null;
  var accRpm;
  try { accRpm = FEADCore.accessoryRpm(sys, idx, engineRpm); }
  catch(e){ return null; }
  if(!Number.isFinite(accRpm)) return null;

  // 1) DÜĞÜMÜN KENDİ EĞRİSİ önce gelir: tedarikçi sayfasındaki devir→kW
  //    tablosu (FEAD_INFORMATION'daki AIR COMPRESOR / ALTERNATOR grafikleri)
  //    o aksesuarın kendi ölçülmüş verisi; genel katalog eğrisinden üstündür.
  var own = veFeadPowerCurve(node);
  if(own.length){
    var k = veFeadInterpKw(own, accRpm);
    if(Number.isFinite(k)) return k;
  }
  // 2) Yoksa MFSim kataloğu (Araç Performans modülüyle aynı kaynak).
  var pre = veFeadPresetOf(node);
  if(!pre || !pre.curve || typeof veAccInterpCurve !== 'function') return null;
  var kw = veAccInterpCurve(pre.curve, accRpm);
  return Number.isFinite(kw) ? kw : null;
}

// ─── Aksesuar güç eğrisi: devir [rpm] → güç [kW] ────────────────────────────
// Sayfadaki tablo AKSESUAR devrine göre verilmiştir (grafiklerin ekseni
// "Speed (RPM)"), motor devrine göre değil. Kayıt biçimi:
//   node.data.pwrCurve = [ { rpm, kw }, ... ]
// Sıralama garanti edilmez (kullanıcı satır ekler); okurken sıralanır ve
// eksik/bozuk satırlar düşürülür — yarım girilmiş bir tablo sessizce sıfır
// güç üretmesin diye ayıklama TEK yerde.
function veFeadPowerCurve(node){
  var raw = node && node.data && node.data.pwrCurve;
  if(!Array.isArray(raw)) return [];
  var pts = [];
  raw.forEach(function(p){
    var r = _feadNum(p && p.rpm, NaN), k = _feadNum(p && p.kw, NaN);
    if(Number.isFinite(r) && r > 0 && Number.isFinite(k)) pts.push({ rpm: r, kw: k });
  });
  pts.sort(function(a, b){ return a.rpm - b.rpm; });
  return pts;
}
function veFeadHasPowerCurve(node){ return veFeadPowerCurve(node).length >= 2; }

// Doğrusal ara değerleme; UÇLARDA SABİT TUTAR (ekstrapolasyon yapmaz).
// Ekstrapolasyon burada tehlikeli: alternatör eğrisi düşük devirde dikçe
// çıkıyor, uzatmak eksi güç üretebilirdi.
function veFeadInterpKw(pts, rpm){
  var p = Array.isArray(pts) ? pts : [];
  if(!p.length || !Number.isFinite(rpm)) return NaN;
  if(p.length === 1) return p[0].kw;
  if(rpm <= p[0].rpm) return p[0].kw;
  if(rpm >= p[p.length-1].rpm) return p[p.length-1].kw;
  for(var i=1;i<p.length;i++){
    if(rpm <= p[i].rpm){
      var a = p[i-1], b = p[i];
      if(b.rpm === a.rpm) return b.kw;
      return a.kw + (b.kw - a.kw) * (rpm - a.rpm) / (b.rpm - a.rpm);
    }
  }
  return p[p.length-1].kw;
}

// UI satırları → çekirdek duty dizisi. kw sözlüğünde değeri OLMAYAN aksesuar
// için katalog denenir; o da yoksa 0 yazılır (avara/gergi için doğru değer).
function veFeadDutyToCore(build, rows){
  if(!build || !build.ok) return [];
  return (rows || []).filter(function(r){ return r.rpm > 0; }).map(function(r){
    var loads = {};
    build.order.forEach(function(n, i){
      if(build.sys.pulleys[i] && build.sys.pulleys[i].crank) return;   // sürücü: hesaplanır
      var v = r.kw ? r.kw[n.id] : undefined;
      var kw = (v === undefined || v === null || v === '') ? null : _feadNum(v, 0);
      if(kw === null) kw = veFeadAutoKw(build.sys, i, n, r.rpm);
      loads[build.names[i]] = (kw === null) ? 0 : kw;
    });
    return { engineRpm: r.rpm, dcPct: r.dcPct, loadsKw: loads, degC: r.degC };
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜM
// ════════════════════════════════════════════════════════════════════════════
// FEADCore.analyze() + yorulma dağılımı + (varsa) B10 ömrü. İstisna ATMAZ;
// her parça kendi hatasını taşır ki bir bölümün çökmesi tüm sonucu götürmesin.
//
// GEÇERLİLİK SINIRLARI SONUCUN İÇİNDE TAŞINIR (spesifikasyon §7): doğal
// frekans karşılaştırılamaz, mutlak ömür yalnız 79.6–176 mm çap aralığında
// geçerli. Bunları hesaplayıp sessizce göstermek, hesaplamamaktan kötü olurdu.
// ─── HASAR-EŞDEĞER SICAKLIK ─────────────────────────────────────────────────
//
// Çekirdeğin beltLifeB10'u TEK bir sıcaklık alıyor ve hasarı şöyle kuruyor:
//   D = (geometri) · Σ_i geçiş_i · 2^((degC − 80) / ΔT)
// yani sıcaklık çarpanı TOPLAM geçiş sayısını çarpıyor. Duty tablosunda ise
// sıcaklık SATIR BAŞINA giriliyor (rölantide soğuk, tam yükte sıcak). O tek
// sayının ne olması gerektiği belli: satır başına hasarı toplayıp geri çözünce
//   degC_eş = 80 + ΔT · log2( Σ w_i · 2^((T_i − 80) / ΔT) ),   Σ w_i = 1
// çıkıyor. Bu bir yaklaşıklık DEĞİL — çekirdeğin modeli veriyken cebirsel
// olarak aynı hasarı üretir. Bütün satırlar aynı sıcaklıktaysa sonuç tam o
// sıcaklıktır (log2(2^x) = x), yani tek sıcaklıklı tablolar hiç etkilenmez.
//
// ARİTMETİK ORTALAMA YANLIŞTI ve HEP AYNI YÖNE yanlıştı: 2^x dışbükey olduğu
// için sıcaklığın ortalaması hasarın ortalamasını OLDUĞUNDAN AZ gösterir
// (Jensen). ÖLÇÜLDÜ (BMC örneği, satırlar 70…110 °C): aritmetik ortalama
// 90.0 °C → 1010 saat; hasar-eşdeğer 96.7 °C → 810 saat. Yani ömür 1.25×
// UZUN, üstelik güvenli tarafa değil.
//
// AĞIRLIK dc DEĞİL, GEÇİŞ SAYISI (dc · v / L): çekirdek de `passes` toplamını
// böyle kuruyor. Yüksek devirde kayış birim zamanda daha çok geçtiği için o
// satırın sıcaklığı daha ağır basar; dc ile ağırlıklandırmak sıcak ve hızlı
// noktayı hafife alırdı.
//
// SIFIR YÜZDE "GİRİLMEMİŞ" DEĞİLDİR. Eski ifade `(d.dcPct || 100/n) / Σdc`
// yazıyordu: paydada 0 sayılan bir yüzde payda 100/n oluyordu, yani ağırlıklar
// 1'e toplanmıyordu. ÖLÇÜLDÜ — bütün yüzdeler boşken degC 90 yerine 1000 °C
// çıkıyor, sayfadaki gibi TEK BİR satır %0 girilince (BMC'nin 3000 rpm satırı)
// 90 yerine 99 °C çıkıp B10 992 → 756 saate (−%24) düşüyordu; uyarı yoktu.
// Çekirdek aynı yeri doğru yapıyor (`u.dcPct != null ? … `), fark köprüdeydi.
function veFeadDutyDegC(sys, duty){
  var rows = Array.isArray(duty) ? duty : [];
  if(!rows.length || typeof FEADCore === 'undefined') return NaN;
  var FA = (FEADCore.FATIGUE && FEADCore.FATIGUE.absolute) || {};
  var ref = Number.isFinite(FA.refDegC) ? FA.refDegC : 80;
  var dT  = (FA.halvingDegC > 0) ? FA.halvingDegC : 23;
  var L   = (sys && sys.belt && sys.belt.effLength > 0) ? sys.belt.effLength / 1000 : 0;

  var wTop = 0, dTop = 0, tSum = 0, n = 0;
  rows.forEach(function(r){
    var T = _feadNum(r && r.degC, NaN);
    if(!Number.isFinite(T)) return;
    tSum += T; n++;
    // Geçiş payı — çekirdeğin `passes` toplamıyla AYNI ağırlık.
    var dc = Number.isFinite(r.dcPct) ? (r.dcPct / 100) : (1 / rows.length);
    if(!(dc > 0) || !(L > 0)) return;
    var v = 0;
    try { v = FEADCore.spanTensions(sys, r).vMs; } catch(e){ v = 0; }
    if(!(v > 0)) return;
    var w = dc * (v / L);
    wTop += w;
    dTop += w * Math.pow(2, (T - ref) / dT);
  });
  // Ağırlık kurulamadıysa (yüzdelerin hepsi boş, ya da hız çözülemedi) hasar
  // toplamı zaten sıfırdır ve sıcaklığın hükmü yoktur; sıcaklıkların DÜZ
  // ortalaması dürüst karşılıktır — eski koddaki 1000 °C değil.
  if(!(wTop > 0) || !(dTop > 0)) return n ? (tSum / n) : NaN;
  return ref + dT * Math.log2(dTop / wTop);
}

// Mutlak B10 kalibrasyonunun (FATIGUE.absolute.C) AİT OLDUĞU yorulma modeli.
// C, geomSum = Σ w·d^(−m) ölçeğini soğuruyor: m 5.6 → 4.05 olunca geomSum ~900
// kat değişir, C aynı kaldığı için ömür de ~900 kat kayar (ölçüldü: BMC 992 →
// 1.1 saat). Doğrulama koşucusu B10'u yalnız bu sabit takımıyla ölçüyor; tek
// PK-2_2a sistemi olan AG00810 ayrıca çap aralığının da dışında. Dolayısıyla
// başka bir model seçilince DAĞILIM o modeli kullanır ama MUTLAK ÖMÜR kullanamaz
// — ve bunu söylemek zorundadır.
var VE_FEAD_LIFE_FATIGUE_MODEL = 'PK-2_2p-MT3';

// ─── BURULMA MODELİNİN KRANK SERBESTLİĞİ ────────────────────────────────────
//
// `torsionalModel` her kasnak için bir atalet istiyor ve krank düğümününki
// diğerlerinden FARKLI BİR ŞEY: kayış çevriminde krank kasnağının arkasında
// krank mili + volan duruyor, yani o serbestliğin ETKİN ataleti kasnağın kendi
// ataleti değil. Gates raporunun "System Vibration Analysis" sayfası da bunu
// ayrı bir girdi olarak listeliyor (bkz. CALIBRATION.tensionerArmInertiaKgM2).
//
// MFSim bu sayıyı ZATEN SORUYOR — Çözücü panelindeki "Krank ataleti" alanı —
// ama burulma modeli gelene kadar hiçbir yere gitmiyordu (ölü girdi). Şimdi
// çekirdeğe `inertias` üzerinden geçiyor: kasnağın kendi `inertiaKgM2` alanına
// yazmıyoruz ki başka bir hesap (peakEstimate) kasnak ataletini istediğinde
// karşısında krank milini bulmasın.
//
// ÖLÇÜLDÜ (Gates kalibrasyon takımı, 5 sistem — AG00686, AG00686-1520 ve
// AG0868'in 4/6/8PK üçlüsü): krank ataleti 0.7 kg·m² ve gergi kasnak kütlesi
// dahilken 1. elastik mod 11.7 · 13.0 · 29.1 · 35.7 · 41.2 Hz çıkıyor; Gates
// raporlarının "Natural Frequency" satırı 11.87 · 13.35 · 28.28 · 37.61 ·
// 45.62 Hz — RMS %5.2. Krank yerine krank KASNAĞININ ataleti (0.064) konunca
// AG0868 ailesi 41.0/49.7/57.1 Hz'e fırlıyor (RMS %33) ve 8PK varyantında
// birinci mod sayısal olarak çöküyor. Yani bu alan bağlanmadan model
// kullanılabilir değil.
function veFeadTorsionalOpt(build, opts){
  var o = {};
  var J = _feadNum(opts && opts.crankInertia, NaN);
  if(!Number.isFinite(J) || !(J > 0)) return o;
  var i = (build && build.sys) ? build.sys._crkIdx : -1;
  if(!(i >= 0) || !build.names[i]) return o;
  o.inertias = {};
  o.inertias[build.names[i]] = J;
  return o;
}

// ─── TEPE ZİNCİRİNDE ÇEVRİM KAPANIŞI ────────────────────────────────────────
//
// Kayış KAPALI bir halkadır: bir tam turda gerginlik değişimlerinin toplamı
// sıfır olmak ZORUNDA. Bu bir modelleme tercihi değil, topolojik özdeşlik.
//
// `peakEstimate` bunu GÜÇ terimi için zorluyor (kw[krank] = Σ diğerleri) ama
// ATALET terimi için zorlamıyor: kranka kasnağın KENDİ ataletini yazıyor.
// Oysa kayış krank kasnağını hızlandırmaz — o motora cıvatalı ve motor onu
// zaten döndürüyor. Kayışın hızlandırdığı kütleler AKSESUARLARDIR; krankta
// görülen gerginlik artışı onların taleplerinin TOPLAMIDIR.
//
// ÖLÇÜLDÜ (AG00976, 880 d/d, 1100 d/d/s):
//   krank adımı  J·α·oran/r = 89,69 N
//   Σ aksesuar                214,89 N
//   ÇEVRİM ARTIĞI            −125,20 N   ← sıfır olmalıydı
// Artık hiçbir yere yazılmıyor: zincir gergi açıklığında ankrajlanıp ondan
// BİR ÖNCEKİ kasnakta bittiği için tamamı son halkaya (ALT→gergi) biniyor.
// Sonucu: alternatör tepesi +%22,8, gergi hubload yönü 19° yanlış.
//
// ÜÇ REFERANSSIZ KANIT (Gates'e hiç bakmadan):
//   · yön bağımlılığı — zinciri ileri/geri yürütmek beş kasnakta da tam
//     130,73 N fark veriyor; çevrim kapansaydı 0 olurdu
//   · ankraj bağımlılığı — ankrajı ALT'a almak sistemi 6,85 N kaydırıyor
//   · fiziksel imkânsızlık — 0,010 kW'lık bir AVARA üzerinden %29,5 gerginlik
//     sıçraması yazılıyor (ortalama zincirde aynı avarada fark −1,3 N)
// Aynı sınama ORTALAMA zincirde 1,4e−13 N ile kapanıyor, yani yaklaşım değil
// tutarsızlık. Kusur AG00976'ya özgü de değil: BMC_FEAD_2026'da −157,8 N.
//
// DÜZELTME ÇEKİRDEĞE DOKUNMUYOR. `peakEstimate` `inertias` sözlüğünü kabul
// ediyor (`inertias[ad] != null ? … : p.inertiaKgM2`) — burulma modelinin
// zaten kullandığı yol. Kranka, adımı Σ aksesuara eşitleyen EŞDEĞER bir J
// geçiyoruz. α sadeleştiği için J_eş ivmeden BAĞIMSIZ.
//
// GERGİ KASNAĞI TOPLAMA GİRMEZ — ve bu bir eksiklik değil, çekirdeğin ilan
// ettiği sınırın karşılığı: zincir orada ankrajlı olduğu için o kasnağın kendi
// adımı HİÇ uygulanmıyor. Toplama katılsaydı çevrim yine kapanmaz, +5,53 N
// artık kalırdı. Çekirdeğin kendi notu zaten "gergi kolu dinamigi dahil DEGIL"
// diyor; gergi kasnağının atalet talebi (burada 5,53 N ≈ %0,35) o sınırın
// içinde kalıyor ve raporda yazılı.
//
// ÖLÇÜLEN ETKİ (Gates AG00976 tepe tablosuna karşı):
//   gerginlik RMS %11,83 → %0,41 (en kötü %22,81 → %0,69)
//   hubload   RMS  %9,75 → %0,39 (en kötü %17,51 → %0,55)
//   gergi hubload yönü 198,8° → 217,1°  (Gates 218°)
function veFeadPeakInertias(build){
  var out = {};
  var sys = build && build.sys;
  if(!sys || !sys.pulleys || typeof FEADCore === 'undefined') return out;
  var c = sys._crkIdx, t = sys._tenIdx;
  if(!(c >= 0) || !sys.pulleys[c]) return out;
  // dI = J·α·oran/r  →  α ortak çarpan, sadeleşiyor.
  var pay = 0, i, p, oran;
  for(i = 0; i < sys.pulleys.length; i++){
    if(i === c || i === t) continue;
    p = sys.pulleys[i];
    oran = FEADCore.speedRatio(sys, i);
    if(!(p.rPitch > 0) || !Number.isFinite(oran)) return out;
    pay += (p.inertiaKgM2 || 0) * oran / (p.rPitch / 1000);
  }
  var pc = sys.pulleys[c], oc = FEADCore.speedRatio(sys, c);
  if(!(pc.rPitch > 0) || !(oc > 0)) return out;
  out[pc.name] = pay * (pc.rPitch / 1000) / oc;
  return out;
}

// Bir kasnağın YÜK TAŞIYIP taşımadığının ölçütü. Gerginlik oranı ≈ 1 olan bir
// kasnakta (avara, gergi) SF bir MARJ değil, o sarım açısının KAPASİTESİDİR;
// ne hükme girer ne de bir kayma eşiği üretir. Ölçüt köprü katmanında çünkü
// fiziksel bir soru ve iki yüzey birden kullanıyor: kayma hükmü (sunum) ve
// kayma eşiği (aşağıdaki hesap). İki yerde iki sayı tutmak sessizce ayrışırdı;
// sunum katmanındaki VE_FR_SLIP_LOADED_RATIO buradan okur ve bir kapı ikisinin
// eşit kaldığını tutar.
var VE_FEAD_SLIP_LOADED_RATIO = 1.01;

// ─── KAYMA EŞİĞİ — "ne kadar aşağı inebilirim" ──────────────────────────────
//
// Kayma hükmü boyutsuz SF ile veriliyordu; N cinsinden "kaymamak için gereken
// en düşük ankraj gerginliği" diye bir büyüklük modelde HİÇ YOKTU. Tedarikçi
// çıktısı onu gerginlik grafiğinde yatay bir çizgi olarak basıyor.
//
// KURULUŞ — kapalı form, iterasyon YOK. Açıklık gerginlikleri ankrajdan sabit
// farklarla ayrılır (fark tork tarafından belirlenir, ankrajdan bağımsızdır):
//   T_i = T₀ + Δ_i
// Bir kasnakta kayma sınırı  T_maks / T_min = e^(μφ) = cap  olduğunda:
//   (T₀ + Δ_maks) / (T₀ + Δ_min) = cap   →   T₀* = (Δ_maks − cap·Δ_min)/(cap − 1)
// Eşik, YÜK TAŞIYAN kasnakların en büyüğü ve BÜTÜN devir satırlarının en
// büyüğüdür (en kötü durum).
//
// YÜK TAŞIMAYANLAR DIŞARIDA ve gerekçe TUTARLILIK, matematiksel imkânsızlık
// DEĞİL. Bir avara da pekâlâ bir kök verir (Δ farkı küçük ama sıfır değil);
// ÖLÇÜLDÜ, AG00976'da yük taşımayanların kökleri −856,6 … +5,6 N aralığında,
// yani belirleyici olan 80,95 N'ın çok altında — filtre bu sistemde SAYIYI
// DEĞİŞTİRMİYOR. Filtrenin işi hükmü hizada tutmak: kayma hükmünü raporun
// kendisi yük taşıyanların en düşüğünden veriyor (`_frMinSF`), çünkü oran ≈ 1
// olan bir avarada SF bir MARJ değil o sarım açısının KAPASİTESİDİR. Eşiği
// başka bir kümeden almak, aynı belgede iki farklı kayma ölçütü olurdu.
//
// ÖLÇÜLDÜ (AG00976): iki bağımsız yol — kapalı form ve iki-bölme — on iki devrin
// on ikisinde de aynı sayıyı veriyor (|Δ| ≤ 1,4e−14 N). Eşik 80,95 N @ 1000 d/d,
// belirleyici FAN; tasarım gerginliği 544,05 N, yani 6,72 kat pay.
//
// GATES'İN BASTIĞI SAYI BAŞKA ve kopyalanmamalı: s1 grafiğinde 157,65 N yazıyor
// ama Gates'in KENDİ kayma sayfasındaki (s6/12) FAN eğrisinden türeyen değer
// 66,6 N — aynı raporun iki sayfası arasında 2,37 kat fark var. MFSim'in 80,95
// N'ı Gates'in kayma verisine +%21,5 uzakta; basılı çizgiye 2 kat.
function veFeadSlipThreshold(build, duty){
  var sys = build && build.sys;
  if(!sys || !Array.isArray(duty) || !duty.length) return null;
  var n = sys.pulleys.length;
  var en = null;
  duty.forEach(function(d){
    var per = d && d.perPulley, slip = d && d.slip;
    if(!per || !slip || per.length !== n || slip.length !== n) return;
    var T0 = _feadNum(per[sys._tenIdx] && per[sys._tenIdx].exitTensionN, NaN);
    if(!Number.isFinite(T0)) return;
    var D = per.map(function(p){ return _feadNum(p.exitTensionN, NaN) - T0; });
    if(D.some(function(v){ return !Number.isFinite(v); })) return;
    for(var i = 0; i < n; i++){
      var oran = _feadNum(slip[i].tensionRatio, NaN);
      var cap  = _feadNum(slip[i].capstanCapacity, NaN);
      // YÜK TAŞIMAYAN kasnak eşik üretemez (bkz. yukarıdaki gerekçe).
      if(!(oran > VE_FEAD_SLIP_LOADED_RATIO) || !(cap > 1)) continue;
      var din = D[(i - 1 + n) % n], dout = D[i];
      var mx = Math.max(din, dout), mn = Math.min(din, dout);
      var t = (mx - cap * mn) / (cap - 1);
      if(!Number.isFinite(t)) continue;
      if(!en || t > en.tensionN)
        en = { tensionN: t, engineRpm: _feadNum(d.engineRpm, NaN),
               pulley: sys.pulleys[i].name, index: i };
    }
  });
  if(!en || !(en.tensionN > 0)) return null;
  en.designTensionN = _feadNum(sys.designTensionN, NaN);
  en.margin = (en.designTensionN > 0) ? en.designTensionN / en.tensionN : NaN;
  return en;
}

function veFeadAnalyze(build, opts){
  opts = opts || {};
  var out = { ok: false, error: null, analysis: null, fatigue: null, life: null,
              duty: [], warnings: [], limits: [] };
  if(!build || !build.ok || typeof FEADCore === 'undefined'){
    out.error = (build && build.errors && build.errors[0]) || 'Model çözülemedi.';
    return out;
  }
  var duty = veFeadDutyToCore(build, opts.rows || []);
  out.duty = duty;

  // PANEL İVMESİ SONUCA TAŞINIR. Tepe tablosu `R.peakAccelRpmS`'i okuyor ama o
  // alanı YAZAN hiçbir yer yoktu: panelin "İvmelenme [RPM/s]" alanı tabloya hiç
  // ulaşmıyordu ve tablo sessizce 1100 varsayılanıyla koşuyordu. AG00976'da
  // sayı tesadüfen doğruydu (raporun ivmesi de 1100), başka bir modelde
  // sessizce yanlış olurdu — "krank ataleti ölü girdiydi" vakasının aynı sınıfı.
  var acc = _feadNum(opts.accelRpmS, NaN);
  var dec = _feadNum(opts.decelRpmS, NaN);
  if(Number.isFinite(acc) && acc > 0) out.peakAccelRpmS = acc;
  if(Number.isFinite(dec) && dec > 0) out.peakDecelRpmS = dec;

  try {
    out.analysis = FEADCore.analyze(build.sys, {
      duty: duty,
      cylinders: opts.cylinders > 0 ? opts.cylinders : 6,
      modes: 1,
      // analyze() burulmayı da hesaplayabiliyor ama SEÇENEKSİZ — krank ataleti
      // geçilemediği için kasnak ataletiyle koşar ve aşağıdaki asıl hesaptan
      // BAŞKA bir frekans verirdi. Tek sonuç kalsın: burada kapalı, aşağıda açık.
      torsional: false
    });
    out.ok = true;
  } catch(e){
    out.error = veFeadTranslateError(e && e.message);
    return out;
  }

  // ── Burulma (dönel) titreşim modeli ──
  // Tüm kasnakların ataleti + gergi kolu ataleti girilmişse çalışır; biri bile
  // eksikse çekirdek açık hata verir ve buraya uyarı olarak düşer. Sessizce
  // atlamıyoruz: kullanıcı frekans kartını boş görüp hesabın çöktüğünü sanmasın.
  try {
    out.torsional = FEADCore.torsionalModel(build.sys, veFeadTorsionalOpt(build, opts));
  } catch(e){
    out.torsional = null;
    out.warnings.push('Burulma modeli: ' + veFeadTranslateError(e && e.message));
  }

  // ── KAYIŞ TİPİNE BAĞLI ÇIKTILAR KAPALI MI? ───────────────────────────────
  // Kapatılan şey hesap değil VERİNİN VARLIĞI: kayış henüz seçilmemişse
  // katalog sabitleriyle üretilen sayı bir varsayımdır. Sessizce atlamıyoruz —
  // `beltDataOff` listesi sonuca giriyor ve panel/rapor sebebini basıyor
  // (modülün kendi kuralı: geçerlilik sınırı sonucun İÇİNDE taşınır).
  var beltData = (opts.beltDataMode || build.beltDataMode || 'full');
  out.beltDataMode = beltData;
  if(beltData === 'none'){
    out.beltDataOff = VE_FEAD_BELT_DATA_OFF.slice();
    // Açıklık frekansları ve çırpınma birim kütleden geliyor; duty satırlarının
    // içinden çıkarılıyor ki rapor "0 Hz" gibi bir sayı basmasın.
    if(out.analysis && Array.isArray(out.analysis.duty))
      out.analysis.duty.forEach(function(d){ delete d.frequencies; });
  }
  // ── GERGİ TARAFI HÜKMÜ + ÇEKİRDEK UYARILARININ YÜKSELTİLMESİ ────────────
  //
  // İKİ SESSİZLİK BİRDEN kapanıyor:
  //
  // 1. Çekirdeğin "Negatif span gerilmesi" uyarısı YALNIZ duty satırında
  //    duruyordu (`analysis.duty[i].warnings`). İki rapor da yalnız üst
  //    seviyeye bakıyor (`_frWarnBox` / `_fsrWarnBox` → R.warnings +
  //    R.build.warnings), dolayısıyla ters yönde çözülen bir modelde
  //    "Çözümün taşıdığı uyarılar" kutusu BOŞ kalıyordu. ÖLÇÜLDÜ:
  //    12 duty satırının 10'u uyarı taşırken R.warnings = null.
  //
  // 2. Uyarının SEBEBİ yazılmıyordu. Panel "tasarım gerginliği yetersiz"
  //    diyordu; oysa tasarım gerginliği 2026-08-25'te GİRDİ OLMAKTAN ÇIKTI
  //    (yay dengesinden türüyor), yani gösterilen çare kullanıcının
  //    dokunamadığı bir alanı işaret ediyordu. Gerçek sebep gerginin GERGİN
  //    spana düşmesi.
  out.tensionerSide = null;
  try {
    var tenAd = null, ii;
    for(ii = 0; ii < build.sys.pulleys.length; ii++)
      if(build.sys.pulleys[ii].tensioner) tenAd = build.sys.pulleys[ii].name;
    var satirlar = (out.analysis && out.analysis.duty) || [];
    var enKotu = null;
    satirlar.forEach(function(row){
      var v = veFeadTensionerSide(row, tenAd);
      if(!v.ok && (!enKotu || v.deficitN > enKotu.deficitN)) enKotu = v;
    });
    out.tensionerSide = enKotu || { ok: true };
    if(enKotu){
      out.warnings.push('Gergi kayışın GERGİN tarafında: '
        + enKotu.drain.length + ' span ankrajın (' + _feadFmt3(enKotu.anchorN)
        + ' N) altına iniyor, en düşüğü ' + _feadFmt3(enKotu.minN) + ' N ("'
        + enKotu.minName + '"). Otomatik gergi kayışın GEVŞEK tarafına konur — '
        + 'kayış dönüş yönünü çevirin ya da gergiyi kayış sırasında sürücünün '
        + 'önüne alın. Tasarım gerginliği yay dengesinden TÜREDİĞİ için '
        + 'yükseltilemez.');
    }
  } catch(e){ /* hüküm üretilemezse çözüm yine de döner */ }

  var fatModel = opts.fatigueModel || VE_FEAD_LIFE_FATIGUE_MODEL;
  out.fatigueModel = fatModel;

  if(duty.length && beltData !== 'none'){
    try {
      out.fatigue = FEADCore.ribFatigueDistribution(build.sys, {
        duty: duty, fatigueModel: fatModel
      });
    } catch(e){ out.warnings.push('Yorulma dağılımı: ' + veFeadTranslateError(e && e.message)); }

    try {
      // Satır başına sıcaklık → çekirdeğin istediği TEK sıcaklık. Cebirsel
      // olarak aynı hasarı veren değer; türetme ve ölçüm veFeadDutyDegC'de.
      var degC = veFeadDutyDegC(build.sys, duty);
      out.degCEq = degC;
      if(!Number.isFinite(degC)) throw new Error('Duty sıcaklığı okunamadı.');
      out.life = FEADCore.beltLifeB10(build.sys, { duty: duty, degC: degC });
      if(out.life && out.life.warnings) out.life.warnings.forEach(function(w){ out.limits.push(w); });

      // Bütün yüzdeler boşsa hasar sıfır, ömür sonsuz çıkar ve kart "—" gösterir.
      // Sebebini yazmazsak kullanıcı hesabın çöktüğünü sanır.
      if(out.life && !(out.life.damageRate > 0))
        out.warnings.push('Çalışma çevrimi yüzdeleri (%zaman) girilmedi; mutlak ömür '
          + 'hesaplanamaz. Yorulma dağılımı yüzdeden bağımsızdır ve geçerlidir.');

      // MUTLAK ÖMÜR SEÇİLEN YORULMA MODELİNİ KULLANAMAZ. Dağılım kullanır —
      // ikisi yan yana basıldığı için farkı söylemek zorunlu (bkz.
      // VE_FEAD_LIFE_FATIGUE_MODEL). Model adı yalnız çekirdeğin kendi
      // anahtarlarından geçerse yazılır: limits satırları HTML olarak
      // basılıyor (veFeadLimitsBox), kaçırılmamış girdi oraya sızmamalı.
      var bilinen = (FEADCore.FATIGUE && FEADCore.FATIGUE.byModel) || {};
      if(out.life && fatModel !== VE_FEAD_LIFE_FATIGUE_MODEL && bilinen[fatModel]){
        out.life.modelMismatch = fatModel;
        out.life.calibratedModel = VE_FEAD_LIFE_FATIGUE_MODEL;
        out.limits.push('Mutlak B10 ömrü <b>' + VE_FEAD_LIFE_FATIGUE_MODEL + '</b> sabitleriyle '
          + '(m = ' + bilinen[VE_FEAD_LIFE_FATIGUE_MODEL].m + ') kalibre edildi; seçili yorulma '
          + 'modeli <b>' + fatModel + '</b> (m = ' + bilinen[fatModel].m + '). Kaburga yorulma '
          + 'DAĞILIMI seçtiğiniz modeli kullanır, mutlak ömür KULLANAMAZ: kalibrasyon sabiti '
          + 'geometri toplamının ölçeğini soğuruyor, üs değişince ömür yüzlerce kat kayar. '
          + 'Aşağıdaki saat değeri ' + VE_FEAD_LIFE_FATIGUE_MODEL + ' üssüne göredir.');
      }
    } catch(e){ out.warnings.push('B10 ömrü: ' + veFeadTranslateError(e && e.message)); }
  } else {
    out.warnings.push('Çalışma çevrimi boş: gerilme, hubload, kayma ve frekans hesaplanmadı. '
      + 'Çözücü panelinden devir satırı ekleyin.');
  }

  // Spesifikasyon §7 — her koşuda görünür olmalı, dipnotta değil.
  // Bu satır eskiden "doğal frekans KARŞILAŞTIRILAMAZ" diyordu; çekirdekte çok
  // serbestlik dereceli burulma modeli olmadığı sürece doğruydu. Artık var ve
  // Gates'in "System Resonance (Mode 1)" satırına kalibre. Ama güven düzeyi
  // statik zincirle AYNI DEĞİL ve bunu söylemek zorundayız: statik zincir 17
  // raporda %0.33, burulma 6 sistemde RMS ~%8.
  out.limits.push('Burulma (dönel titreşim) modeli KALİBRE bir modeldir, statik zincir gibi '
    + 'deterministik değildir: Gates "System Resonance (Mode 1)" değerlerine 6 sistemde '
    + 'RMS ~%8 ile oturur (statik gerilme/geometri zinciri %0.33). Sonucu bir mertebe '
    + 'göstergesi olarak okuyun; sertifikasyon için değil. Kayış kord rijitliği ve '
    + 'kavis payı bu kalibrasyonun serbest parametreleridir.');
  out.limits.push('Gergi KOL MODU tahmini (tensionerMode) ayrı ve daha kabadır — tek '
    + 'serbestlik dereceli olduğu için raporun "Natural Frequency" değeriyle '
    + 'karşılaştırılamaz. Karşılaştırılacak olan burulma modelinin 1. elastik modudur.');
  out.limits.push('Peak / geçici rejim: model yarı-statiktir, gergi kolu dinamiği dahil değildir.');
  out.limits.push('Hizalama payı: kalibre edilmedi.');
  return out;
}

// Jest/Node köprüsü (tarayıcıda no-op)

// ─── KASNAK KISA KODU ───────────────────────────────────────────────────────
// Matris sütun başlığı ya da grafik göstergesi kasnak ADIYSA yerleşim taşıyor:
// "Otomatik Gergi (E9843)" tek başına 22 karakter, altı kasnaklı bir tabloda
// satır A4'e sığmıyor ve sığdırmanın tek yolu puntoyu kırmak oluyor (ÖLÇÜLDÜ:
// özet raporda gövde 8,2 px'e inmişti). Doğal frekans haritasının göstergesi
// aynı sebeple çizim alanının %42'sini yiyordu. Tedarikçi çıktısının
// FAN/IDR/A_C/ALT/TEN kullanma sebebi de bu.
//
// KOD BİR KISALTMA DEĞİL, BİR KİMLİK: kullanıldığı her yüzeyde karşılığı
// (kod → ad künyesi) AYNI SAYFADA basılmak zorunda. Bu yüzden köprü
// katmanında — hem özet rapor hem ayrıntılı raporun grafikleri aynı kodu
// kullanıyor; ikinci bir kopya `source-hygiene` kapısına takılır ve iki
// yüzey sessizce ayrışırdı.
function veFeadPulleyCodes(sys){

  var ps = (sys && sys.pulleys) || [];
  function ham(p, i){
    var ad = String(p.name || '');
    // Parantez içi YALNIZ harfse ve 2-4 karakterse bir KODDUR (FAN, ALT, A_C).
    // "155 A" bir ölçü, "E9843" bir parça numarası — ikisi de kod değil.
    var m = ad.match(/\(([A-Za-z_\/]{2,4})\)/);
    if(m) return m[1].toUpperCase().replace(/[^A-Z_\/]/g, '');
    if(p.tensioner) return 'TEN';
    if(p.crank) return 'CRK';
    var sade = ad.replace(/\([^)]*\)/g, ' ').trim();
    var son  = (sade.match(/(\d+)\s*$/) || [])[1] || '';
    var kel  = sade.replace(/\d+\s*$/, '').split(/\s+/).filter(Boolean);
    var k = kel.length >= 2 ? kel.map(function(w){ return w[0]; }).join('') : (kel[0] || 'P').slice(0, 3);
    k = k.toLocaleUpperCase('tr').replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '').slice(0, 3);
    return (k || ('P' + (i + 1))) + son;
  }
  var out = ps.map(ham), gor = {};
  return out.map(function(k, i){
    if(!gor[k]){ gor[k] = 1; return k; }
    gor[k]++; return k + gor[k];
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFeadPulleyCodes: veFeadPulleyCodes,
    VE_FEAD_VIEW_FRONT: VE_FEAD_VIEW_FRONT, veFeadMirrorGeomX: veFeadMirrorGeomX,
    _feadNum: _feadNum, _feadDefOf: _feadDefOf, _feadNodeName: _feadNodeName,
    _feadIsPulley: _feadIsPulley,
    VE_FEAD_DEFAULT_DIA: VE_FEAD_DEFAULT_DIA, VE_FEAD_ERROR_MAP: VE_FEAD_ERROR_MAP,
    VE_FEAD_DEFAULTS: VE_FEAD_DEFAULTS, veFeadDefaultInertia: veFeadDefaultInertia,
    veFeadDefaultBeltTol: veFeadDefaultBeltTol,
    // Paylaşılan saf yardımcılar. Tarayıcıda global oldukları için cp-fead.js,
    // connections.js ve cp-fead.js doğrudan çağırıyor;
    // testte de aynı adlarla kurulabilsinler diye dışa veriliyorlar.
    _feadNum: _feadNum, _feadDefOf: _feadDefOf,
    _feadNodeName: _feadNodeName, _feadIsPulley: _feadIsPulley,
    veFeadContactOf: veFeadContactOf, veFeadContactLabel: veFeadContactLabel,
    veFeadOD: veFeadOD, veFeadHasOD: veFeadHasOD, veFeadRadius: veFeadRadius,
    veFeadMigrateNode: veFeadMigrateNode, veFeadMigrateAll: veFeadMigrateAll,
    veFeadRouteOrder: veFeadRouteOrder, veFeadRouteDiagnose: veFeadRouteDiagnose,
    veFeadNaturalSense: veFeadNaturalSense, veFeadReverseRoute: veFeadReverseRoute,
    veFeadSpinToFront: veFeadSpinToFront, veFeadSpinLabel: veFeadSpinLabel,
    _feadPlaneName: _feadPlaneName,
    veFeadTensionerSide: veFeadTensionerSide,
    veFeadResolveDriver: veFeadResolveDriver,
    veFeadUniqueNames: veFeadUniqueNames, veFeadTranslateError: veFeadTranslateError,
    veFeadDutyRows: veFeadDutyRows, veFeadPresetLib: veFeadPresetLib,
    veFeadPresetOf: veFeadPresetOf, veFeadAutoKw: veFeadAutoKw,
    veFeadRatioSys: veFeadRatioSys,
    veFeadDutyToCore: veFeadDutyToCore, veFeadAnalyze: veFeadAnalyze,
    veFeadDutyDegC: veFeadDutyDegC, veFeadTorsionalOpt: veFeadTorsionalOpt,
    veFeadPeakInertias: veFeadPeakInertias,
    veFeadSlipThreshold: veFeadSlipThreshold,
    VE_FEAD_SLIP_LOADED_RATIO: VE_FEAD_SLIP_LOADED_RATIO,
    VE_FEAD_LIFE_FATIGUE_MODEL: VE_FEAD_LIFE_FATIGUE_MODEL,
    VE_FEAD_PRESET_LIB: VE_FEAD_PRESET_LIB,
    veFeadBuildSystem: veFeadBuildSystem, veFeadBuildFromCanvas: veFeadBuildFromCanvas,
    veFeadGatherPulleys: veFeadGatherPulleys,
    veFeadSpringSetup: veFeadSpringSetup,
    veFeadMigrateTensioner: veFeadMigrateTensioner,
    veFeadWrap180: veFeadWrap180, veFeadArmShownDeg: veFeadArmShownDeg,
    veFeadArmFromShown: veFeadArmFromShown,
    veFeadTensionerPivot: veFeadTensionerPivot,
    veFeadArmBand: veFeadArmBand, _feadBandSample: _feadBandSample,
    VE_FEAD_BAND_STEP_DEG: VE_FEAD_BAND_STEP_DEG,
    _feadBandForget: function(){ _feadBandMemo = null; },
    veFeadBeltModeLocked: veFeadBeltModeLocked,
    veFeadBeltDataMode: veFeadBeltDataMode,
    VE_FEAD_BELT_DATA_MODES: VE_FEAD_BELT_DATA_MODES,
    VE_FEAD_BELT_DATA_OFF: VE_FEAD_BELT_DATA_OFF,
    VE_FEAD_BELT_MODES: VE_FEAD_BELT_MODES, veFeadBeltMode: veFeadBeltMode,
    VE_FEAD_MIN_TAKEUP_RATIO: VE_FEAD_MIN_TAKEUP_RATIO,
    veFeadBeltFit: veFeadBeltFit, veFeadBeltOptions: veFeadBeltOptions,
    VE_FEAD_PX_PER_MM: VE_FEAD_PX_PER_MM,
    veFeadNodeBox: veFeadNodeBox, veFeadNodeCenter: veFeadNodeCenter,
    veFeadOriginNode: veFeadOriginNode,
    veFeadCanvasToMm: veFeadCanvasToMm, veFeadMmToCanvas: veFeadMmToCanvas,
    veFeadCoordLinkNode: veFeadCoordLinkNode, veFeadCoordLinkOn: veFeadCoordLinkOn,
    veFeadSyncMmFromCanvas: veFeadSyncMmFromCanvas,
    veFeadSyncCanvasFromMm: veFeadSyncCanvasFromMm,
    veFeadDragTensioner: veFeadDragTensioner,
    veFeadNormalizeOrigin: veFeadNormalizeOrigin,
    veFeadSolveArmClamped: veFeadSolveArmClamped,
    veFeadWorkingPoint: veFeadWorkingPoint,
    veFeadAtLimitText: veFeadAtLimitText, veFeadViolationText: veFeadViolationText,
    VE_FEAD_TENSION_TOL: VE_FEAD_TENSION_TOL,
    veFeadDriveRatio: veFeadDriveRatio, veFeadDriveModeLabel: veFeadDriveModeLabel,
    VE_FEAD_POSITIONS: VE_FEAD_POSITIONS, VE_FEAD_POS_TOL_DEG: VE_FEAD_POS_TOL_DEG,
    veFeadPositionRows: veFeadPositionRows, veFeadPosMode: veFeadPosMode,
    veFeadPosSelection: veFeadPosSelection,
    VE_FEAD_ANIM_TARGET_REV_S: VE_FEAD_ANIM_TARGET_REV_S,
    VE_FEAD_ANIM_FALLBACK_RPM: VE_FEAD_ANIM_FALLBACK_RPM,
    veFeadAnimRpmChoices: veFeadAnimRpmChoices, veFeadAnimRpmOf: veFeadAnimRpmOf,
    veFeadAnimKinematics: veFeadAnimKinematics,
    VE_FEAD_VIB_GAIN_MIN: VE_FEAD_VIB_GAIN_MIN, VE_FEAD_VIB_GAIN_MAX: VE_FEAD_VIB_GAIN_MAX,
    VE_FEAD_VIB_GAIN_DEF: VE_FEAD_VIB_GAIN_DEF, VE_FEAD_VIB_ZETA: VE_FEAD_VIB_ZETA,
    VE_FEAD_VIB_SPAN_MM: VE_FEAD_VIB_SPAN_MM, VE_FEAD_VIB_MODE_DEG: VE_FEAD_VIB_MODE_DEG,
    VE_FEAD_VIB_SCREEN_HZ: VE_FEAD_VIB_SCREEN_HZ,
    VE_FEAD_VIB_MAX_SCREEN_HZ: VE_FEAD_VIB_MAX_SCREEN_HZ,
    VE_FEAD_VIB_MODE_MAX_DEG: VE_FEAD_VIB_MODE_MAX_DEG,
    veFeadVibGainOf: veFeadVibGainOf, veFeadVibModeOf: veFeadVibModeOf,
    _feadVibSpanMag: _feadVibSpanMag, _feadVibMag: _feadVibMag,
    veFeadVibSpanPayload: veFeadVibSpanPayload,
    veFeadVibModeList: veFeadVibModeList, veFeadVibModePayload: veFeadVibModePayload,
    veFeadPowerCurve: veFeadPowerCurve, veFeadHasPowerCurve: veFeadHasPowerCurve,
    veFeadInterpKw: veFeadInterpKw,
    veFeadPinPlan: veFeadPinPlan,
    veFeadTensionerBoxMm: veFeadTensionerBoxMm,
    veFeadTensionerCenter: veFeadTensionerCenter,
    VE_FEAD_EXAMPLES: VE_FEAD_EXAMPLES, veFeadExampleKeys: veFeadExampleKeys,
    veFeadRemapDutyKw: veFeadRemapDutyKw,
    veFeadExampleOf: veFeadExampleOf, veFeadExampleNodes: veFeadExampleNodes
  };
}
