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

// ─── Eski kayıt göçü: data.dia → data.od ────────────────────────────────────
// Aşama 0'daki iskelet 'dia' yazıyordu. Kayıtlı projeler açılınca sessizce
// dönüşür; 'od' zaten varsa dokunulmaz (kullanıcının yeni değeri kazanır).
// Döner: göç uygulandı mı.
function veFeadMigrateNode(node){
  if(!node || !node.data) return false;
  if(node.data.dia === undefined) return false;
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

// ─── Gergi: MONTAJ konumu ↔ SERBEST kol açısı ───────────────────────────────
//
// Tedarikçiye giden sayfa gergiyi ŞU İKİ ŞEYLE tanımlıyor (bkz. FEAD_INFORMATION):
//   • gergi kasnağının öngörülen MERKEZİ MONTAJ konumu  (koordinat tablosunda,
//     diğer kasnaklarla aynı biçimde: X / Y)
//   • yay künyesi: Arm Length · Spring Pre-Load · Spring Rate · Spring MEAN Load
//
// Çekirdek ise `freeAngleDeg` istiyor: kolun kayış TAKILI DEĞİLKEN durduğu
// mutlak açı (rel = 0, yay yalnız ön yükünde). İKİSİ AYNI ŞEY DEĞİLDİR — montaj
// konumunda yay çalışma momentine kadar kurulmuştur, yani kol serbest yerinden
// rel_mean = (meanLoad − preload)/rate kadar dönmüştür.
//
// KARIŞTIRILIRSA HATA SESSİZDİR. Sayfadaki montaj açısı doğrudan serbest açı
// diye girilirse çekirdek çalışma noktasında yayı yalnız ön yükünde bulur:
// ÖLÇÜLDÜ (PDF sistemi) — moment 22.07 Nm yerine 8.81 Nm, gerginlik 650 N
// yerine 251 N. Yani gerginlik 2.6 KAT DÜŞÜK, geometri kusursuz çözülüyor,
// hiçbir hata mesajı çıkmıyor. Bu yüzden türetme burada, tek yerde duruyor.
//
// Döner: { ok, pivot, cen, armFromCoords, montajDeg, relMeanDeg, notes }
// (serbest açı `sense`e bağlı olduğu için ayrıca veFeadFreeAngleFrom ile
// hesaplanır — sense'i çekirdek buluyor, bkz. veFeadBuildSystem iki geçişi.)
// ─── PİVOT BİR GİRDİ DEĞİL, PARÇA KÜNYESİNDEN TÜRER ────────────────────────
//
// Kullanıcı bildirimi (2026-08-25): "Otomatik gergi bileşeninde kol ve pivot
// kısmına kullanıcı girdi girmeyecek. Kullanıcının girdiği koordinat gergi
// KASNAĞININ merkezi; pivot noktası sonra HESAPLANIYOR."
//
// Haklı ve zincir kapanıyor. Kapanışı veren şey gerginin PARÇA ÇİZİMİ:
//   "E9843 PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm SPRING TORQUE
//    @ 28° FREEARM-MEAN ROTATION"
// yani üretici, kolun ÇALIŞMA (Mean) konumundaki MUTLAK açısını parça künyesi
// olarak veriyor. Kol boyu da künyede. O zaman pivot kolun öbür ucudur:
//
//     pivot = c − a·(cos θ_kol , sin θ_kol)
//
// ÖLÇÜLDÜ (Gates AG00976, altı kol konumunun ALTISI da): raporun bastığı
// kasnak merkezi + raporun bastığı kol açısı, raporun bastığı pivotu
// 0,11 mm içinde geri veriyor. Bağıntı kolun tanımının ta kendisi.
//
// KÜNYEDEKİ ÜÇ SAYI BİRBİRİNİ DOĞRULUYOR: çizim "28° FREEARM-MEAN" diyor,
// yay künyesinden türeyen rel_mean = (22,07 − 8,60)/0,480 = 28,06°.
//
// GERİYE DÖNÜK: pivotX/pivotY girilmişse O KAZANIR (tedarikçi raporundan gelen
// ÖLÇÜLMÜŞ pivot böyle taşınır) ve eski her proje aynen çalışır. armMeanDeg
// yalnız pivot YOKKEN devreye girer.
function veFeadPivotFromArm(td){
  td = td || {};
  var cx = _feadNum(td.cenX, NaN), cy = _feadNum(td.cenY, NaN);
  var a = _feadNum(td.armLen, NaN), th = _feadNum(td.armMeanDeg, NaN);
  if(!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  if(!Number.isFinite(a) || !(a > 0) || !Number.isFinite(th)) return null;
  var r = th * Math.PI / 180;
  return [cx - a * Math.cos(r), cy - a * Math.sin(r)];
}

function veFeadTensionerMount(td){
  td = td || {};
  var out = { ok: false, pivot: null, cen: null, armFromCoords: NaN,
              montajDeg: NaN, relMeanDeg: NaN, pivotDerived: false, notes: [] };

  // ── NOMİNAL KOL AÇISI GEOMETRİYE BAKMAZ — EN BAŞTA HESAPLANIR ────────────
  //
  // rel_mean: kol, yay ÇALIŞMA momentine kadar kaç derece kurulmuş.
  //     rel_mean = (M_mean − M₀) / k
  // Sağdaki üç sayı da SALT YAY KÜNYESİNDEN gelir; montaj merkezi, pivot ve
  // kol boyu bu hesaba HİÇ girmez. Bu yüzden aşağıdaki geometri kapılarının
  // ÜSTÜNDE duruyor.
  //
  // ESKİDEN ALTTAYDI ve sessiz bir kusurdu: panelin birinci sınıf seçeneği
  // "Serbest kol açısını elle gir" (angleMode='direct') montaj merkezini
  // SORMUYOR, dolayısıyla `cx/cy` yok diye erken dönülüyor ve künye tastamam
  // yerindeyken bile relMeanDeg NaN kalıyordu. Serbest kayış kipi de nominal
  // açıyı bulamayıp kolun gezinme aralığının ORTASINA düşüyordu.
  //
  // ÖLÇÜLDÜ (BMC, preload 8.60 · kArm 0.480 · meanLoad 22.07 — üçü de girili):
  //     (mean − pre)/k = 28.0625°   ← hesaplanabiliyordu
  //     mount kipi     : kol 28.0625° · L 1715.27 mm
  //     direct kipi    : kol 38.1174° · L 1717.32 mm · hata 0 · uyarı 0
  // Yani kullanıcı hatasız ve uyarısız YANLIŞ BOY ısmarlıyordu.
  var pre = _feadNum(td.preload, NaN), rate = _feadNum(td.kArm, NaN),
      mean = _feadNum(td.meanLoad, NaN);
  if(Number.isFinite(pre) && Number.isFinite(mean) && Number.isFinite(rate) && rate > 0){
    out.relMeanDeg = (mean - pre) / rate;
    if(out.relMeanDeg < 0)
      out.notes.push('Yay çalışma momenti ön yükten KÜÇÜK (' + mean + ' < ' + pre
        + ' Nm); kol serbest konumun ters yanında kalır.');
  }

  var px = _feadNum(td.pivotX, NaN), py = _feadNum(td.pivotY, NaN);
  var cx = _feadNum(td.cenX, NaN),   cy = _feadNum(td.cenY, NaN);
  if(!Number.isFinite(cx) || !Number.isFinite(cy)) return out;
  if(!Number.isFinite(px) || !Number.isFinite(py)){
    var tur = veFeadPivotFromArm(td);
    if(!tur) return out;
    px = tur[0]; py = tur[1];
    out.pivotDerived = true;
  }
  out.pivot = [px, py]; out.cen = [cx, cy];
  var dx = cx - px, dy = cy - py;
  out.armFromCoords = Math.sqrt(dx*dx + dy*dy);
  if(!(out.armFromCoords > 0)){
    out.notes.push('Gergi montaj merkezi pivotla AYNI noktada; kol açısı tanımsız.');
    return out;
  }
  out.montajDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  out.ok = true;
  return out;
}

// Kol boyu çapraz kontrolü: |montaj merkezi − pivot| ile elle girilen kol boyu
// aynı olmak ZORUNDA — ikisi de sayfada yazıyor, uyuşmuyorsa biri yanlış
// okunmuştur. Bedava bir doğrulama: PDF'te 89.998 ↔ 90.0 ile tutuyor.
function veFeadArmCheck(td){
  var m = veFeadTensionerMount(td);
  var girilen = _feadNum(td && td.armLen, NaN);
  var out = { ok: false, fromCoords: m.armFromCoords, entered: girilen,
              deltaMm: NaN, tautological: false };
  if(!m.ok || !Number.isFinite(girilen) || !(girilen > 0)) return out;
  out.deltaMm = m.armFromCoords - girilen;
  out.ok = Math.abs(out.deltaMm) <= VE_FEAD_ARM_TOL_MM;
  // PİVOT TÜRETİLMİŞSE BU KONTROL BİR DENETİM DEĞİL, TOTOLOJİDİR: pivot zaten
  // merkezden tam `armLen` uzağa konuyor, dolayısıyla fark yapısal olarak
  // sıfır. Geçen bir kriter gibi sunmak, bu oturumda iki kez düzeltilen
  // hatanın (uygunluk #6, ilk pivot bloğu) üçüncü kez tekrarı olurdu.
  // Kontrol ancak pivot GİRİLDİĞİNDE bir şey ölçer — o zaman iki bağımsız
  // sayı (koordinatlar ↔ künyedeki kol boyu) karşılaştırılıyordur.
  out.tautological = !!m.pivotDerived;
  return out;
}
var VE_FEAD_ARM_TOL_MM = 0.5;
// Tasarım gerginliği ↔ yay dengesi uyuşmazlık eşiği. %2: Gates raporlarında iki
// değer yuvarlama farkıyla (765.7 ↔ 766) tutuyor, o gürültüyü uyarıya çevirmez.
var VE_FEAD_TENSION_TOL = 0.02;

// Serbest açı = montaj açısı − sense × rel_mean.
// (armAbs = free + sense·rel; rel = rel_mean iken armAbs montaj açısı olmalı.)
function veFeadFreeAngleFrom(mount, sense){
  if(!mount || !mount.ok || !Number.isFinite(mount.montajDeg)) return NaN;
  var rel = Number.isFinite(mount.relMeanDeg) ? mount.relMeanDeg : 0;
  var s = (sense < 0) ? -1 : 1;
  return mount.montajDeg - s * rel;
}

// Gergi açısı hangi yoldan geliyor: montaj konumundan mı, elle mi?
//
// KULLANICININ AÇIK SEÇİMİ HER ZAMAN KAZANIR. Seçim yoksa VERİDEN okunur ve
// bu sıra bilinçli:
//   • montaj merkezi girilmişse → 'mount' (sayfanın biçimi)
//   • yoksa serbest açı girilmişse → 'direct'
//   • hiçbiri yoksa → 'mount' (boş bir gergide panel sayfanın biçimini sorar)
//
// Ortadaki satır GERİYE DÖNÜK UYUMLULUK: Aşama 1–2'de kaydedilmiş projeler
// yalnız freeAngleDeg taşıyor. Varsayılan koşulsuz 'mount' olsaydı o projeler
// açılışta "montaj merkezi girilmedi" hatasıyla ÇÖZÜLEMEZ hale gelirdi —
// kullanıcı kendi kaydettiği modelin bozulduğunu görürdü.
//
// ÜÇÜNCÜ KİP 'envelope' (2026-08-28): pivot GİRDİ, kol açısı zarftan SEÇİLİR.
// Varsayılan çözümde en SONA konuldu ve sebebi geriye dönük uyumluluk: bugüne
// kadar kaydedilmiş her projede montaj merkezi (cenX/cenY) YAZILI, dolayısıyla
// hepsi 'mount' okumaya devam ediyor. 'envelope' ancak montaj merkezi YOKKEN
// ve pivot VARKEN kendiliğinden seçilir — yani yalnız yeni akışta.
function veFeadAngleMode(td){
  var m = td && td.angleMode;
  if(m === 'direct' || m === 'mount' || m === 'envelope') return m;
  var cx = _feadNum(td && td.cenX, NaN), cy = _feadNum(td && td.cenY, NaN);
  if(Number.isFinite(cx) && Number.isFinite(cy)) return 'mount';
  if(Number.isFinite(_feadNum(td && td.freeAngleDeg, NaN))) return 'direct';
  var px = _feadNum(td && td.pivotX, NaN), py = _feadNum(td && td.pivotY, NaN);
  if(Number.isFinite(px) && Number.isFinite(py)) return 'envelope';
  // HİÇBİR ŞEY GİRİLMEMİŞSE VARSAYILAN ARTIK 'envelope' — yeni akış budur.
  // Geriye dönük etkisi YOK: kaydedilmiş her projede bu üç alandan en az biri
  // yazılı (yoksa proje zaten çözülemiyordu), dolayısıyla değişen tek şey
  // paletten YENİ konan bir gerginin panelde hangi soruyla açıldığı.
  return 'envelope';
}

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

function veFeadBeltDataMode(beltData, angleMode){
  var m = beltData && beltData.beltDataMode;
  if(m === 'full' || m === 'none') return m;
  return (angleMode === 'envelope') ? 'none' : 'full';
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
    if(n && _feadDefOf(n).isFeadTensioner && veFeadAngleMode(n.data || {}) === 'envelope')
      return true;
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
//  PİVOT BİR GİRDİ — KOL AÇISI BİR ZARFTAN SEÇİLİR
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-08-28): *"Kullanıcı ilk olarak KIRMIZI NOKTA olarak
// OTOMATİK GERGİ MONTAJ KOORDİNATLARInı verecek. Daha sonra program OTOMATİK
// GERGİ ÖZELLİKLERİ baz alınarak bir PİVOT NOKTASI ZARFI oluşturacak … program
// bu sonsuz noktalar içinden (zarf) en uygun noktayı seçecek."*
//
// ── YÖN TERSİNE ÇEVRİLİYOR ────────────────────────────────────────────────
// Eski akış: kullanıcı gergi KASNAĞININ merkezini verir (YEŞİL nokta), pivot
// ondan TÜRER (`veFeadPivotFromArm`). Yeni akış bunun tersi: pivot GİRİLİR
// (KIRMIZI nokta — montaj cıvatası), kasnak merkezi bir ÇIKTIDIR.
//
// Bu bir kolaylık değil, ÖLÇÜLMÜŞ bir hatanın düzeltmesi. Otomatik gergi iki
// parçadır: gövde motora cıvatalanır (pivot), kol o pivot etrafında döner ve
// ucunda avara kasnağı taşır. Montajda SABİT olan pivottur; kasnak merkezi
// kolun o anki açısıyla değişen bir konumdur. Eskiden değişken olanı sorup
// sabit olanı türetiyorduk.
//
//     ÖLÇÜLDÜ (AG00976 · Gates 8PK1715HD raporu):
//       Gates'in ölçtüğü pivot            (−250.00, 110.00)
//       BMC örneğinin merkezden türettiği (−256.59, 123.97)   → 15.45 mm sapma
//       gerginlik                          544.3 N ↔ 505.8 N  → %7.1
//     ve bunu HİÇBİR ŞEY yakalamıyordu: `veFeadArmCheck` pivot türetilmişken
//     TOTOLOJİK (fark yapısal olarak sıfır) — kodun kendi notu bunu yazıyor.
//
// ── ZARF: BİR SERBESTLİK DERECESİ KALIYOR ─────────────────────────────────
// Pivot, kol boyu ve yay künyesi verildiğinde kolun MUTLAK açısı hâlâ serbest:
// gövdenin montajdaki saat konumu (indeksi) onu belirler. Kasnak merkezi
// pivot etrafında `armLength` yarıçaplı bir ÇEMBER üzerinde gezer — kullanıcının
// "sonsuz nokta" dediği zarf budur. Kolun kendi gezinme aralığı (yay künyesinden
// `rel_nom = (M_mean − M₀)/k`, ölçülen sistemlerde 15–37°) bu seçimin ÜSTÜNE
// biner; zarf o aralığın nereye oturacağını seçer.
//
// ── SEÇİM ÖLÇÜTÜ TAHMİN DEĞİL, 14 GATES SİSTEMİNDEN GERİYE ÇÖZÜLDÜ ────────
// Altı aday ölçüt, her sistemde zarf 0.25° adımla taranarak Gates'in gerçek
// çalışma noktasıyla karşılaştırıldı (aci farkinin medyani):
//
//     min take-up EN BÜYÜK          4.5°   ← 9/14 sistem ±5° içinde
//     ortalama konumdaki T en küçük 10.3°
//     Tmax en küçük                 20.3°
//     T_max/T_min oranı en küçük    23.5°
//     hubload tepe değeri en küçük  30.8°
//     en küçük sarım en büyük       53.1°  ← ölçüt DEĞİL
//
// Kazanan ölçüt KESKİN: eğrinin %1 platosu ortalama 4.9° (çoğu sistemde
// 1.0–2.8°), yani "±5° içinde" ucuz bir isabet değil. Gates'in noktasındaki
// ceza medyan %4.0; iki sistemde tam 0.0%.
//
//     ÖLÇÜT:  max over θ  of  min over rel∈[0, 1.5·rel_nom]  of  dL/dθ(θ, rel)
//
// FİZİKSEL ANLAMI: `T = M/(dL/dθ)` olduğu için take-up'ın EN KÜÇÜK olduğu yer
// gerginliğin EN BÜYÜK olduğu yerdir. Ölçüt, kayışın servis zarfı boyunca
// (yeni/uzun kayıştan yıpranmış/kısa kayışa) görülen TEPE GERGİNLİĞİ en küçük
// yapan montaj saatini seçiyor — klasik gergi yerleşim kuralı.
//
// 1.5 ÇARPANI UYDURULMADI: 1.0…2.0 arası tarandı, 1.2–1.6 bandı bir PLATO
// (medyan 3.5–4.5°, 8–9/14 sistem ±5°); 1.0'da 6.5°, 2.0'de 11.5°'e bozuluyor.
// 1.5 platonun ortasında ve fiziksel karşılığı var: çalışma açısı + %50 pay.
//
// ── ÖLÇÜT KAYIŞ VERİSİNDEN BAĞIMSIZ ───────────────────────────────────────
// Gezinme aralığı kayışın tolerans/aşınma zarfından DEĞİL, gerginin kendi yay
// künyesinden geliyor. Ölçüldü: kayıştan türeyen aralık (Replace…MinBelt) ile
// künyeden türeyen [0, 1.5·nom] aynı sonucu veriyor (medyan 4.5° ↔ 4.5°,
// 8/14 ↔ 9/14). Bu, kayış boyunun bir ÇIKTI olmasının ön koşulu: seçim kayışı
// bilmeden yapılabilmeli, yoksa döngü kurulurdu.
//
// ── SINIR: PAKETLEME MODELDE YOK ──────────────────────────────────────────
// Zarfın hangi yayının motor bloğunda fiziksel olarak KULLANILABİLİR olduğunu
// model bilmiyor. Ölçülen 14 sistemin 13'ünde en iyi nokta Gates'inkine komşu;
// AG00879'da 153° uzakta ve orası motorun öteki yanı. Sonuç bu yüzden bir
// ÖNERİDİR: kullanıcı açıyı sabitleyebilir (`armPinned`) ve zarf o zaman bir
// seçici değil bir TEŞHİS yüzeyi olur.
var VE_FEAD_ENV_TRAVEL_MULT = 1.5;   // ölçülmüş plato 1.2–1.6
var VE_FEAD_ENV_COARSE_DEG  = 2;     // kaba tarama adımı
var VE_FEAD_ENV_FINE_DEG    = 0.1;   // tepe çevresinde ince adım
var VE_FEAD_ENV_FINE_SPAN   = 3;     // ince taramanın yarı genişliği (derece)
var VE_FEAD_ENV_MIN_WRAP    = 1.0;   // bunun altında sarım = teğet kaybı

// Zarfın TEK bir örneği. `cfg` çekirdeğe giden yapılandırma; `absDeg` kolun
// çalışma (nominal yay yükü) konumundaki MUTLAK açısı.
//
// Her örnekte sistem YENİDEN KURULUYOR (`makeSystem`) — `sense` (kolun hangi
// yöne dönünce kayışı kısalttığı) zarf boyunca değişebilir ve onu köprüde
// yeniden yazmak çekirdeğin kuralını İKİNCİ KEZ yazmak olurdu. Ölçüldü:
// örnek başına 0.25 ms, kaba+ince tarama toplam ~50 ms — bu bir TASARIM
// hesabı, kare başına koşan bir şey değil.
function _feadEnvSample(cfg, absDeg, relNom, mult){
  var probes = [0, 0.5 * relNom, relNom, mult * relNom];
  var out = { absDeg: absDeg, ok: false, why: '', takeupMin: NaN, takeupWork: NaN,
              tensionMax: NaN, tensionWork: NaN, hubloadWork: NaN,
              wrapWork: NaN, betaWork: NaN, beltMm: NaN };
  var c2 = Object.assign({}, cfg);
  c2.tensioner = Object.assign({}, cfg.tensioner);
  delete c2.tensioner.sense;                       // çekirdek kendi bulsun
  c2.tensioner.freeAngleDeg = absDeg;              // geçici; sense bulunduktan sonra düzeltilir
  var sys;
  try { sys = FEADCore.makeSystem(c2); }
  catch(e){ out.why = veFeadTranslateError(e && e.message); return out; }
  // sense belli — serbest açıyı, rel_nom'da mutlak açı `absDeg` olacak şekilde kur
  sys.tensioner.freeAngleDeg = absDeg - sys.tensioner.sense * relNom;
  sys._cache = {};
  out.sense = sys.tensioner.sense;
  var tks = [], Ts = [];
  for(var i = 0; i < probes.length; i++){
    var st;
    try { st = FEADCore.tensionerState(sys, probes[i]); }
    catch(e){ out.why = veFeadTranslateError(e && e.message); return out; }
    if(!st || !Number.isFinite(st.tensionN) || !(st.tensionN > 0)){
      out.why = 'gerginlik çözülemedi'; return out;
    }
    if(!(st.wrapDeg > VE_FEAD_ENV_MIN_WRAP)){
      out.why = 'gergi sarımı ' + st.wrapDeg.toFixed(1) + '° (teğet kayboluyor)';
      return out;
    }
    var viol = (st.geom && st.geom.violations) || [];
    if(viol.length){ out.why = veFeadViolationText(viol[0]); return out; }
    tks.push(st.takeupMmPerDeg); Ts.push(st.tensionN);
    if(probes[i] === relNom){
      out.takeupWork = st.takeupMmPerDeg; out.tensionWork = st.tensionN;
      out.hubloadWork = st.hubloadN; out.wrapWork = st.wrapDeg;
      out.betaWork = st.betaDeg; out.beltMm = st.requiredBeltMm;
      out.center = st.center;
    }
  }
  out.takeupMin = Math.min.apply(null, tks);
  out.tensionMax = Math.max.apply(null, Ts);
  out.ok = true;
  return out;
}

// Zarfı tara ve en uygun kol açısını seç.
//
//   cfg     : `veFeadBuildSystem`in kurduğu çekirdek yapılandırması
//   relNom  : kolun nominal çalışma dönmesi (M_mean − M₀)/k — SALT YAY KÜNYESİ
//
// Döner: { ok, armAbsDeg, best, samples[], feasibleDeg, blocked[], note }
// `samples` panelin zarf eğrisini çizebilmesi için ham kaba tarama; ince
// tarama yalnız tepeyi keskinleştirir, eğriyi değiştirmez.
function veFeadArmEnvelope(cfg, relNom, opt){
  opt = opt || {};
  var mult = _feadNum(opt.travelMult, VE_FEAD_ENV_TRAVEL_MULT);
  var step = _feadNum(opt.coarseDeg, VE_FEAD_ENV_COARSE_DEG);
  var out = { ok: false, armAbsDeg: NaN, best: null, samples: [],
              feasibleDeg: 0, blocked: [], note: '' };
  if(!cfg || !cfg.tensioner){ out.note = 'Gergi yapılandırması yok.'; return out; }
  if(!Number.isFinite(relNom)){
    out.note = 'Kolun nominal çalışma açısı türetilemedi (yay ön yükü, katsayısı '
      + 've çalışma momenti gerekli); zarf üzerinde bir nokta seçilemez.';
    return out;
  }
  // TOHUMLU YEREL ARAMA: bir önceki çözümün açısı verilmişse zarfın tamamı
  // yeniden taranmaz, o açının çevresi taranır. Kullanıcı bir aksesuarı
  // sürüklerken tepe de biraz kayıyor; 360°'yi baştan taramak (ölçüldü: 25 ms)
  // kare bütçesini 10 kat aşardı, yerel arama 6 ms. Yerel arama pencerenin
  // KENARINDA bitiyorsa tepe dışarıda demektir; o zaman genel taramaya düşülür.
  var seed = _feadNum(opt.seedDeg, NaN);
  var loc = _feadNum(opt.localSpan, 0);
  var i, s;
  if(Number.isFinite(seed) && loc > 0){
    var lstep = Math.min(step, 0.5);
    for(i = 0; ; i++){
      var dd = -loc + i * lstep;
      if(dd > loc + 1e-9) break;
      s = _feadEnvSample(cfg, seed + dd, relNom, mult);
      out.samples.push(s);
      if(s.ok) out.feasibleDeg += lstep;
    }
    out.local = true;
    var lb = null;
    out.samples.forEach(function(x){ if(x.ok && (!lb || x.takeupMin > lb.takeupMin)) lb = x; });
    if(lb && Math.abs(lb.absDeg - seed) < loc - 1e-9){
      out.ok = true; out.best = lb; out.armAbsDeg = lb.absDeg;
      return out;
    }
    out.samples = []; out.feasibleDeg = 0; out.local = false;   // tepe dışarıda: genel tarama
  }
  for(i = 0; i * step < 360; i++){
    s = _feadEnvSample(cfg, -180 + i * step, relNom, mult);
    out.samples.push(s);
    if(s.ok) out.feasibleDeg += step;
    else if(s.why && out.blocked.indexOf(s.why) < 0 && out.blocked.length < 4)
      out.blocked.push(s.why);
  }
  var best = null;
  out.samples.forEach(function(x){ if(x.ok && (!best || x.takeupMin > best.takeupMin)) best = x; });
  if(!best){
    out.note = 'Zarfın hiçbir noktasında geçerli bir kayış yolu çözülemedi'
      + (out.blocked.length ? ' (' + out.blocked[0] + ')' : '') + '.';
    return out;
  }
  // İNCE TARAMA: kaba adım 2°, ölçülen %1 platosu ise çoğu sistemde 1.0–2.8°.
  // Yalnız kaba ızgarayla seçilen açı plato dışına düşebilirdi.
  var fine = _feadNum(opt.fineDeg, VE_FEAD_ENV_FINE_DEG);
  var span = _feadNum(opt.fineSpan, VE_FEAD_ENV_FINE_SPAN);
  for(var d = -span; d <= span + 1e-9; d += fine){
    if(Math.abs(d) < 1e-9) continue;
    s = _feadEnvSample(cfg, best.absDeg + d, relNom, mult);
    if(s.ok && s.takeupMin > best.takeupMin) best = s;
  }
  out.ok = true; out.best = best; out.armAbsDeg = best.absDeg;
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
    // Gergi merkezi girdi değil; kanvas konumu PİVOTUNDAN kurulur (aşağıda).
    if(_feadDefOf(x).isFeadTensioner){
      var td = x.data || {};
      mmX = _feadNum(td.cenX, NaN); mmY = _feadNum(td.cenY, NaN);
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

// ── GERGİ SÜRÜKLEMESİ PİVOTU TAŞIR ─────────────────────────────────────────
//
// Gergi kasnağının merkezi bir GİRDİ DEĞİL: çekirdek onu pivot + kol boyu +
// yay dengesinden çözüyor ve kol konumuna göre ALTI ayrı yerde durabiliyor
// (BMC'de 59.9 mm'lik bir zarf). Dolayısıyla "gergi düğümünü sürükledim"
// cümlesinin tek başına karşılığı yok — hangi merkezin taşındığı söylenmeli.
//
// PİVOT taşınıyor: fiziksel bağlantı noktası odur, ve montaj merkezi kol
// boyunu koruyarak rijit takip ettiği için `veFeadArmCheck`'in 0.5 mm kapısı
// kendiliğinden sağlanıyor. Montaj merkezini taşımak o kapıyı kırar ve
// kullanıcı sebebini anlamaz.
function veFeadDragTensioner(node, originNode, scale){
  if(!node || !_feadDefOf(node).isFeadTensioner || !originNode) return false;
  if(!node.data) node.data = {};
  var td = node.data;
  var eski = veFeadTensionerMount(td);
  if(!eski.ok) return false;
  var s = _feadNum(scale, 0) || VE_FEAD_PX_PER_MM;
  // Kanvasta sürüklenen kutu MONTAJ MERKEZİNİ gösteriyor (çözücünün çalışma
  // merkezine en yakın olan o); pivot onunla RİJİT taşınıyor, yani kol boyu
  // ve montaj açısı korunuyor — taşınan şey gerginin gövdesinin tamamı.
  var yeni = veFeadCanvasToMm(node, originNode, s);
  var dx = yeni.x - eski.cen[0], dy = yeni.y - eski.cen[1];
  if(!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  if(Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return false;
  td.cenX = Math.round((eski.cen[0] + dx) * 1000) / 1000;
  td.cenY = Math.round((eski.cen[1] + dy) * 1000) / 1000;
  // PİVOT YALNIZ GİRİLMİŞSE TAŞINIR. Türetilmiş pivot merkezden ve kol
  // açısından çıkıyor, yani merkez taşınınca KENDİLİĞİNDEN takip ediyor;
  // buraya yazmak onu sessizce GİRİLMİŞ pivota çevirirdi ve kullanıcı bir
  // daha parça künyesini değiştiremezdi (ilk sürükleme künyeyi dondururdu).
  if(!eski.pivotDerived){
    td.pivotX = Math.round((eski.pivot[0] + dx) * 1000) / 1000;
    td.pivotY = Math.round((eski.pivot[1] + dy) * 1000) / 1000;
  }
  return true;
}

// ── ORİJİN GÖÇÜ ────────────────────────────────────────────────────────────
// Krank (0,0) değilse bütün koordinatlardan onunkini çıkar. Bu TANIM GEREĞİ
// bir öteleme, dolayısıyla geometriye etkisi YOK (yukarıda ölçüldü) — eski
// projeler sessizce göç edebilir. Gergi pivotu ve montaj merkezi de ötelenir;
// yalnız kasnakları ötelemek KISMİ bir öteleme olurdu ve modeli bozardı.
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

// ─── Tahrik oranı: krank kasnağı → sürücü (fan) kasnağı ─────────────────────
// Sayfa oranı iki ÇAPLA veriyor (krank 197.32 / fan 179.62 = 1.0985 ≈ 1.1),
// çünkü FEAD kayışının sürücü kasnağı krank milinde DEĞİL: krank ayrı bir
// kayış/kademeyle fan kasnağını döndürüyor, FEAD kayışı da onun üzerinden
// tahrik ediliyor. driveRatio = sürücü kasnak devri / motor devri.
function veFeadDriveRatio(sd){
  sd = sd || {};
  var out = { ratio: 1, mode: 'direct', crankOD: NaN, fanOD: NaN, ok: false };
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
               //   koordinat = PİVOT                    → HİÇ ÇÖZÜLMÜYOR ✘
               // Sonuncusu koordinatın pivot OLMADIĞINI kesin olarak eliyor:
               // kasnak sürücünün İÇİNE düşüyor (merkez mesafesi 111,6 mm,
               // gereken >120,8 mm) — sayı değil, geometri reddediyor.
               //
               // İlk iki satırın sarımı AYNI (33,0°): kasnak merkezi ikisinde de
               // aynı, değişen yalnız β — yani take-up, yani gerginlik.
               cenX:-170.080, cenY:99.160, armLen:90.0, armMeanDeg:344.0,
               angleMode:'mount',
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
        // "Tensioner Data": pivot RAPORDA YAZILI (dosya adı da söylüyor:
        // Ten@-250/110). Merkez, Layout Data'nın TEN satırı — yani çözülmüş
        // ÇALIŞMA merkezi, ve pivottan uzaklığı tam 90.00 mm: kol boyu çapraz
        // kontrolü kendiliğinden geçiyor. Serbest açı buradan türetilince
        // 16.07° çıkıyor, raporun "Free Arm" satırı 16.1° — 0.03°.
        data:{ od:75, contact:'back', inertia:0.00087,
               angleMode:'mount', pivotX:-250.00, pivotY:110.00,
               cenX:-161.97, cenY:91.29, armLen:90.0,
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

// ─── ÖN GÖRÜNÜŞ — çizim aynalanır, VERİ ASLA ────────────────────────────────
//
// Kullanıcı kararı (2026-08-28): *"MFSim için de kayışın dönüş yönünü default
// olarak saat yönünde yapacağız."*
//
// ÖLÇÜLDÜ (bkz. docs/gates-reports/README.md → "Dönüş yönü konvansiyonu"):
// on Gates raporunun ONUNDA DA kayış, raporun kendi çizim düzleminde CCW
// dolanıyor (Σ işaretli sarım = +360, hiç −360 yok). Motorlar ön taraftan
// (aksesuar tahrik ucundan) bakıldığında CW döndüğü için o düzlem ÖN
// GÖRÜNÜŞÜN AYNASI gibi davranıyor.
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
var VE_FEAD_VIEW_FRONT = true;      // çizimler ÖN GÖRÜNÜŞ mü

function _feadMirrorPt(q){ return (q && q.length >= 2) ? [-q[0], q[1]] : q; }

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
              mount: null, angleMode: 'mount', drive: null, freeAngleDeg: NaN,
              springTensionN: NaN };
  var all = nodeList || [];
  if(typeof FEADCore === 'undefined'){
    out.errors.push('Hesap çekirdeği yüklenmedi (js/fead-core.js).');
    return out;
  }

  var teshis = veFeadRouteDiagnose(all, connList);
  var order = teshis.order;
  out.order = order;
  out.route = teshis;
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

  // ── GERGİ SERPANTİNDE SON SIRADA MI ─────────────────────────────────────
  // On Gates raporunun ONUNDA DA sıra gergiyle bitip sürücüyle başlıyor: gergi,
  // kayışın sürücüye DÖNÜŞ açıklığındadır, yani GEVŞEK tarafta (ölçüldü,
  // AG00686: T = 1209.95 · 1208.48 · 767.47 · TEN 766.00 — en düşük).
  //
  // UYARI, ZORLAMA DEĞİL. Matematik bu konumdan BAĞIMSIZ: gerilme zinciri
  // T[t] = ankraj ile başlayıp (t+j) % n ile dolaşıyor. Ölçüldü — AG00686
  // çevrimsel olarak dört konuma da döndürüldü, ΔT = 0.0e+0, ΔH = 0.0e+0,
  // L_eff birebir aynı. Yani yanlış yere kablolanmış bir gergi SONUCU
  // değiştirmiyor; değiştirdiği şey yerleşimin tedarikçi konvansiyonuna
  // uyup uymadığı. Çözümü durdurmak, doğru bir modeli reddetmek olurdu.
  (function(){
    var seq = out.order || [];
    if(seq.length < 3) return;
    var ti = -1;
    for(var i=0;i<seq.length;i++) if(_feadDefOf(seq[i]).isFeadTensioner) ti = i;
    if(ti < 0 || ti === seq.length - 1) return;
    out.warnings.push('Serpantin sırasında gergi son sırada değil ("'
      + _feadNodeName(seq[ti]) + '" ' + (ti+1) + '/' + seq.length + '). Gates '
      + 'konvansiyonunda gergi, kayışın sürücüye dönüş açıklığındadır — yani '
      + 'GEVŞEK tarafta. Hesap bundan etkilenmez (sonuç birebir aynı), ama '
      + 'yerleşim tedarikçi raporlarıyla satır satır karşılaştırılamaz.');
  }());

  var bd = (beltNode && beltNode.data) || {};
  var sd = (solvNode && solvNode.data) || {};
  var td = (tensNodes[0] && tensNodes[0].data) || {};

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
    if(!veFeadHasOD(n))
      out.warnings.push('"' + un.names[i] + '" dış çapı girilmedi; tipe göre '
        + VE_FEAD_DEFAULT_DIA[n.type] + ' mm varsayıldı.');
    return p;
  });

  // ── Kayış ──
  // Kayış boyu SABİT kipte zorunlu bir GİRDİ, SERBEST kipte hesaplanan bir
  // ÇIKTI. İkincisinde boş bırakılması hata değil, kipin kendisi.
  var beltMode = veFeadBeltMode(bd);
  // ZARF KİPİNDE KAYIŞ BOYU BİR ÇIKTIDIR — kip seçimi yok.
  // Kullanıcı isteği (2026-08-28): *"kayış boyu KESİNLİKLE BİR SONUÇ OLACAK."*
  // Pivot girdi olduğunda kol açısı zarftan seçiliyor, kayış boyu da o açının
  // sonucu. Sabit kip burada bir çelişki olurdu: iki farklı yol aynı tek
  // serbestlik derecesini iki farklı yerden çözerdi.
  if(veFeadAngleMode(td) === 'envelope') beltMode = 'free';
  out.beltMode = beltMode;
  out.beltDataMode = veFeadBeltDataMode(bd, veFeadAngleMode(td));
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
  var mpr = _feadNum(bd.massPerRibKgM, 0);
  if(mpr > 0) cfgBelt.massPerRibKgM = mpr;

  // ── Gergi ──
  // freeAngleDeg/preloadNm/rateNmPerDeg/armLength ZORUNLU; sense ve
  // loadStopRelDeg opsiyonel (sense verilmezse çekirdek kendisi bulur).
  // PİVOT ÖNCE KÜNYEDEN, YOKSA TÜRETİLİR (bkz. veFeadPivotFromArm). Kullanıcı
  // gergi KASNAĞININ merkezini giriyor; pivot, parça künyesindeki kol boyu ve
  // kolun mean mutlak açısından çıkıyor. Girilmiş bir pivot varsa o kazanır —
  // tedarikçi raporundan gelen ÖLÇÜLMÜŞ pivot böyle taşınır.
  var pivotX = _feadNum(td.pivotX, NaN), pivotY = _feadNum(td.pivotY, NaN);
  var _pivotTurev = false;
  // ZARF KİPİNDE PİVOT TÜRETİLMEZ: zarfın merkezi odur. Türetmeye izin verilse
  // kullanıcı montaj merkezini girip pivotu "girdi" sanabilirdi — modülün en
  // pahalı sessiz hata sınıfının (montaj merkezi ↔ pivot karışması) tam olarak
  // kendisi, üstelik ÖLÇÜLMÜŞ bedeliyle (%7.1 gerginlik).
  if((!Number.isFinite(pivotX) || !Number.isFinite(pivotY))
     && veFeadAngleMode(td) !== 'envelope'){
    var _tp = veFeadPivotFromArm(td);
    if(_tp){ pivotX = _tp[0]; pivotY = _tp[1]; _pivotTurev = true; }
  }
  var armLen = _feadNum(td.armLen, 0);
  var preload = _feadNum(td.preload, NaN);
  var rate = _feadNum(td.kArm, NaN);
  var freeAng = _feadNum(td.freeAngleDeg, NaN);

  // MONTAJ KONUMU YOLU (varsayılan). Sayfa serbest açıyı vermiyor; gergi
  // kasnağının montaj merkezini ve yayın çalışma momentini veriyor. Serbest açı
  // ikisinden TÜRETİLİR — ama türetme `sense`e bağlı, sense'i de çekirdek
  // buluyor. Bu yüzden iki geçiş: önce montaj açısını serbest açı sayıp sistemi
  // kur (sense yalnız geometriye bakar, hangi yönün kayışı kısalttığına), sonra
  // bulunan sense ile gerçek serbest açıyı hesaplayıp yeniden kur. Aşağıda
  // "İKİNCİ GEÇİŞ" diye işaretli.
  var mode = veFeadAngleMode(td);
  var mount = veFeadTensionerMount(td);
  out.mount = mount;
  out.angleMode = mode;
  // Pivot GİRİLDİ mi TÜRETİLDİ mi — rapor ve panel bunu ayırt etmek zorunda:
  // türetilmiş pivotta kol boyu çapraz kontrolü YAPISAL OLARAK geçer (pivot
  // zaten kol boyu kadar uzağa konuyor), yani bir denetim değil totolojidir.
  out.pivotDerived = _pivotTurev;
  out.pivot = (Number.isFinite(pivotX) && Number.isFinite(pivotY)) ? [pivotX, pivotY] : null;
  if(tensNodes.length === 1){
    if(!Number.isFinite(pivotX) || !Number.isFinite(pivotY))
      out.errors.push(mode === 'envelope'
        ? 'Otomatik gergi montaj koordinatları (X / Y) girilmedi. Zarf kipinde bu '
          + 'nokta bir GİRDİDİR: gergi gövdesinin motora cıvatalandığı yerdir ve '
          + 'kasnak merkezi ondan çıkar.'
        : 'Gergi pivotu ne girildi ne de türetilebildi. Pivot bir girdi '
          + 'değildir: gergi KASNAĞININ merkezi (X / Y), kol boyu ve kolun çalışma '
          + '(Mean) mutlak açısı verilirse pivot bunlardan çıkar.');
    if(!(armLen > 0)) out.errors.push('Gergi kol boyu girilmedi.');
    if(!Number.isFinite(preload)) out.errors.push('Gergi yay ön yük momenti girilmedi.');
    if(!Number.isFinite(rate)) out.errors.push('Gergi yay katsayısı (Nm/°) girilmedi.');
    if(mode === 'mount'){
      if(!mount.ok)
        out.errors.push('Gergi kasnağının montaj merkezi (X / Y) girilmedi. '
          + 'Tedarikçi sayfasındaki koordinat tablosunda yazan değer budur.');
      else if(!Number.isFinite(mount.relMeanDeg))
        out.errors.push('Yay çalışma momenti (Spring Mean Load) girilmedi; '
          + 'serbest kol açısı montaj konumundan onsuz türetilemez.');
      var ac = veFeadArmCheck(td);
      if(ac.ok === false && Number.isFinite(ac.deltaMm))
        out.errors.push('Gergi kol boyu tutmuyor: montaj merkezi pivottan '
          + ac.fromCoords.toFixed(2) + ' mm uzakta, kol boyu ' + ac.entered.toFixed(2)
          + ' mm girilmiş (fark ' + ac.deltaMm.toFixed(2) + ' mm). '
          + 'İkisi de sayfada yazar; biri yanlış okunmuş.');
    } else if(mode === 'envelope'){
      // Pivot eksikse yukarıdaki genel kapı zaten zarf kipinin kendi metniyle
      // konuştu; burada kalan tek zorunluluk yay çalışma momenti.
      if(!Number.isFinite(mount.relMeanDeg))
        out.errors.push('Yay çalışma momenti (Spring Mean Load) girilmedi; kolun '
          + 'nominal çalışma açısı (M_mean − M₀)/k onsuz türetilemez ve zarf '
          + 'üzerinde bir nokta seçilemez.');
    } else if(!Number.isFinite(freeAng)){
      out.errors.push('Gergi serbest kol açısı girilmedi.');
    }
  }
  if(mode === 'mount' && mount.ok) freeAng = veFeadFreeAngleFrom(mount, 1);
  // Zarf kipinde serbest açı bir GİRDİ DEĞİL: seçilen çalışma açısından
  // türeyecek. Çekirdek alanı zorunlu tuttuğu için geçici bir değer konuyor;
  // gerçek değer zarf çözüldükten sonra yazılıyor.
  if(mode === 'envelope'){
    var _pinned = _feadNum(td.armMeanDeg, NaN);
    freeAng = Number.isFinite(_pinned) ? _pinned : 0;
  }
  var cfgTen = {
    pivot: [pivotX, pivotY], armLength: armLen,
    preloadNm: preload, rateNmPerDeg: rate, freeAngleDeg: freeAng
  };
  if(td.sense === 1 || td.sense === -1 || td.sense === '1' || td.sense === '-1')
    cfgTen.sense = _feadNum(td.sense, 1) >= 0 ? 1 : -1;
  var stop = _feadNum(td.loadStopRelDeg, NaN);
  if(Number.isFinite(stop) && stop > 0) cfgTen.loadStopRelDeg = stop;
  var armJ = _feadNum(td.armInertia, 0);
  if(armJ > 0) cfgTen.armInertiaKgM2 = armJ;
  // Kol, kasnağı kol boyu yarıçapında nokta kütle olarak taşır. Burulma
  // modelinde bu terim ihmal edilirse 1. mod belirgin şekilde yüksek çıkar
  // (kalibrasyonda RMS %28 -> %17 fark etti). Gates raporunun "Tensioner
  // Pulley Mass" satırı tam olarak bu.
  var armM = _feadNum(td.pulleyMass, 0);
  if(armM > 0) cfgTen.pulleyMassKg = armM;

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
    lengthOffsetMm: _feadNum(sd.lengthOffsetMm, 0),
    // Kapanma ve temizlik ihlalleri artık istisna DEĞİL, taşınan birer ihlal.
    // Sürüklerken kullanıcı çözüm uzayına dışarıdan giriyor; ara karelerde
    // "model çözülemez" demek yerine sayıyı verip yolun neden geçersiz
    // olduğunu yazıyoruz. Kasnak çakışması bunun dışında: orada teğet YOK.
    geomOpt: { tolerant: true }
  };
  out.cfg = cfg;
  if(out.errors.length) return out;              // eksik girdiyle çekirdeği çağırma

  // ── ZARF ÇÖZÜLÜYOR — kol açısı SEÇİLİYOR ─────────────────────────────────
  //
  // Pivot girdi, kol boyu künye; geriye kolun MUTLAK açısı kalıyor ve onu
  // gergi gövdesinin montajdaki saat konumu belirliyor. Zarf o saati seçiyor:
  //     max over θ of  min over rel∈[0, 1.5·rel_nom] of dL/dθ
  // (gerekçesi ve 14 Gates sistemine karşı ölçümü `veFeadArmEnvelope`ta).
  //
  // NE ZAMAN KOŞAR: kullanıcı açıyı SABİTLEMİŞSE (armPinned) hiç koşmaz —
  // seçim artık kullanıcınındır ve zarf bir seçici değil TEŞHİS yüzeyidir.
  // Sabitlenmemişse `opt.selectArm === false` ile atlanabilir; sürükleme yolu
  // bunu kullanıp saklanan açıyla koşar (ölçüldü: genel tarama 25 ms, kare
  // bütçesi 2.2 ms). Saklanan açı TOHUM olarak geçiyor, yani yeniden çözüm
  // yerel aramaya düşüyor.
  if(mode === 'envelope'){
    var _pin = _feadNum(td.armMeanDeg, NaN);
    var _pinnedFlag = !!(td.armPinned && Number.isFinite(_pin));
    out.armPinned = _pinnedFlag;
    if(_pinnedFlag){
      out.armAbsDeg = _pin;
    } else if(opt && opt.selectArm === false && Number.isFinite(_pin)){
      out.armAbsDeg = _pin; out.armFromCache = true;
    } else {
      var _envOpt = {};
      if(Number.isFinite(_pin)){ _envOpt.seedDeg = _pin; _envOpt.localSpan = 6; }
      var _env = veFeadArmEnvelope(cfg, mount.relMeanDeg, _envOpt);
      out.envelope = _env;
      if(!_env.ok){ out.errors.push(_env.note); return out; }
      out.armAbsDeg = _env.armAbsDeg;
      out.armSelected = true;
      // ── SEÇİLEN AÇI DÜĞÜME NOT DÜŞÜLÜR (memo, karar değil) ──────────────
      // Sebebi ölçülmüş: genel tarama 84 ms, kanvas sürükleme karesinin
      // bütçesi 2.2 ms. Not düşülmezse HER kare zarfı baştan tarardı. Not
      // düşülünce sürükleme yolu `selectArm:false` ile saklanan açıyı
      // kullanıyor (0 ms) ve yeniden çözüm bu açıyı TOHUM alıp yerel aramaya
      // düşüyor (6 ms).
      //
      // `saveState` ÇAĞRILMIYOR: bu bir kullanıcı kararı değil, hesabın kendi
      // ara sonucu. Geri-al yığınına binmesi, kartın her tazelenmesinde bir
      // adım eklemek olurdu (yön gülü konumundaki kuralın aynısı).
      if(tensNodes[0] && tensNodes[0].data){
        tensNodes[0].data.armMeanDeg = Math.round(_env.armAbsDeg * 1000) / 1000;
        tensNodes[0].data.armAuto = true;
      }
    }
    // Seçilen çalışma açısından serbest açı: armAbs = free + sense·rel_nom.
    // sense'i çekirdek buluyor, o yüzden burada geçici olarak çalışma açısı
    // yazılıyor ve aşağıdaki İKİNCİ GEÇİŞ blokunda sense bulunduktan sonra
    // düzeltiliyor (montaj kipindeki iki-geçiş kalıbının aynısı).
    cfg.tensioner.freeAngleDeg = out.armAbsDeg;
    delete cfg.tensioner.sense;
  }

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
  if(mode === 'envelope'){
    // armAbs = free + sense·rel_nom  →  free = armAbs − sense·rel_nom
    var free2z = out.armAbsDeg - sys.tensioner.sense * mount.relMeanDeg;
    if(Number.isFinite(free2z) && Math.abs(free2z - cfg.tensioner.freeAngleDeg) > 1e-9){
      cfg.tensioner.freeAngleDeg = free2z;
      cfg.tensioner.sense = sys.tensioner.sense;
      try { sys = FEADCore.makeSystem(cfg); }
      catch(e){ out.errors.push(veFeadTranslateError(e && e.message)); return out; }
    }
    out.freeAngleDeg = cfg.tensioner.freeAngleDeg;
  }
  if(mode === 'mount' && mount.ok){
    var senseBulunan = (td.sense === 1 || td.sense === '1') ? 1
                     : (td.sense === -1 || td.sense === '-1') ? -1
                     : sys.tensioner.sense;
    var free2 = veFeadFreeAngleFrom(mount, senseBulunan);
    if(Number.isFinite(free2) && Math.abs(free2 - cfg.tensioner.freeAngleDeg) > 1e-9){
      cfg.tensioner.freeAngleDeg = free2;
      cfg.tensioner.sense = senseBulunan;       // yön sabitlenir, yeniden aranmaz
      try {
        sys = FEADCore.makeSystem(cfg);
      } catch(e){
        out.errors.push(veFeadTranslateError(e && e.message));
        return out;
      }
    }
    out.freeAngleDeg = cfg.tensioner.freeAngleDeg;
  }

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
  var nomRel = veFeadTensionerMount(td).relMeanDeg;
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
    // Paylaşılan saf yardımcılar. Tarayıcıda global oldukları için cp-fead.js,
    // connections.js ve cp-fead.js doğrudan çağırıyor;
    // testte de aynı adlarla kurulabilsinler diye dışa veriliyorlar.
    _feadNum: _feadNum, _feadDefOf: _feadDefOf,
    _feadNodeName: _feadNodeName, _feadIsPulley: _feadIsPulley,
    veFeadContactOf: veFeadContactOf, veFeadContactLabel: veFeadContactLabel,
    veFeadOD: veFeadOD, veFeadHasOD: veFeadHasOD, veFeadRadius: veFeadRadius,
    veFeadMigrateNode: veFeadMigrateNode, veFeadMigrateAll: veFeadMigrateAll,
    veFeadRouteOrder: veFeadRouteOrder, veFeadRouteDiagnose: veFeadRouteDiagnose,
    veFeadResolveDriver: veFeadResolveDriver,
    veFeadUniqueNames: veFeadUniqueNames, veFeadTranslateError: veFeadTranslateError,
    veFeadDutyRows: veFeadDutyRows, veFeadPresetLib: veFeadPresetLib,
    veFeadPresetOf: veFeadPresetOf, veFeadAutoKw: veFeadAutoKw,
    veFeadDutyToCore: veFeadDutyToCore, veFeadAnalyze: veFeadAnalyze,
    veFeadDutyDegC: veFeadDutyDegC, veFeadTorsionalOpt: veFeadTorsionalOpt,
    veFeadPeakInertias: veFeadPeakInertias,
    veFeadSlipThreshold: veFeadSlipThreshold,
    VE_FEAD_SLIP_LOADED_RATIO: VE_FEAD_SLIP_LOADED_RATIO,
    VE_FEAD_LIFE_FATIGUE_MODEL: VE_FEAD_LIFE_FATIGUE_MODEL,
    VE_FEAD_PRESET_LIB: VE_FEAD_PRESET_LIB,
    veFeadBuildSystem: veFeadBuildSystem, veFeadBuildFromCanvas: veFeadBuildFromCanvas,
    veFeadGatherPulleys: veFeadGatherPulleys,
    veFeadTensionerMount: veFeadTensionerMount, veFeadArmCheck: veFeadArmCheck,
    veFeadFreeAngleFrom: veFeadFreeAngleFrom, veFeadAngleMode: veFeadAngleMode,
    veFeadArmEnvelope: veFeadArmEnvelope, _feadEnvSample: _feadEnvSample,
    veFeadBeltModeLocked: veFeadBeltModeLocked,
    veFeadBeltDataMode: veFeadBeltDataMode,
    VE_FEAD_BELT_DATA_MODES: VE_FEAD_BELT_DATA_MODES,
    VE_FEAD_BELT_DATA_OFF: VE_FEAD_BELT_DATA_OFF,
    VE_FEAD_ENV_TRAVEL_MULT: VE_FEAD_ENV_TRAVEL_MULT,
    VE_FEAD_ENV_COARSE_DEG: VE_FEAD_ENV_COARSE_DEG,
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
    VE_FEAD_ARM_TOL_MM: VE_FEAD_ARM_TOL_MM, VE_FEAD_TENSION_TOL: VE_FEAD_TENSION_TOL,
    veFeadDriveRatio: veFeadDriveRatio,
    VE_FEAD_POSITIONS: VE_FEAD_POSITIONS, VE_FEAD_POS_TOL_DEG: VE_FEAD_POS_TOL_DEG,
    veFeadPositionRows: veFeadPositionRows, veFeadPosMode: veFeadPosMode,
    veFeadPosSelection: veFeadPosSelection,
    VE_FEAD_ANIM_TARGET_REV_S: VE_FEAD_ANIM_TARGET_REV_S,
    VE_FEAD_ANIM_FALLBACK_RPM: VE_FEAD_ANIM_FALLBACK_RPM,
    veFeadAnimRpmChoices: veFeadAnimRpmChoices, veFeadAnimRpmOf: veFeadAnimRpmOf,
    veFeadAnimKinematics: veFeadAnimKinematics,
    veFeadPowerCurve: veFeadPowerCurve, veFeadHasPowerCurve: veFeadHasPowerCurve,
    veFeadInterpKw: veFeadInterpKw,
    veFeadPivotFromArm: veFeadPivotFromArm,
    VE_FEAD_EXAMPLES: VE_FEAD_EXAMPLES, veFeadExampleKeys: veFeadExampleKeys,
    veFeadRemapDutyKw: veFeadRemapDutyKw,
    veFeadExampleOf: veFeadExampleOf, veFeadExampleNodes: veFeadExampleNodes
  };
}
