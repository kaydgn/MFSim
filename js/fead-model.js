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
function veFeadTensionerMount(td){
  td = td || {};
  var out = { ok: false, pivot: null, cen: null, armFromCoords: NaN,
              montajDeg: NaN, relMeanDeg: NaN, notes: [] };
  var px = _feadNum(td.pivotX, NaN), py = _feadNum(td.pivotY, NaN);
  var cx = _feadNum(td.cenX, NaN),   cy = _feadNum(td.cenY, NaN);
  if(!Number.isFinite(px) || !Number.isFinite(py)) return out;
  if(!Number.isFinite(cx) || !Number.isFinite(cy)) return out;
  out.pivot = [px, py]; out.cen = [cx, cy];
  var dx = cx - px, dy = cy - py;
  out.armFromCoords = Math.sqrt(dx*dx + dy*dy);
  if(!(out.armFromCoords > 0)){
    out.notes.push('Gergi montaj merkezi pivotla AYNI noktada; kol açısı tanımsız.');
    return out;
  }
  out.montajDeg = Math.atan2(dy, dx) * 180 / Math.PI;

  // rel_mean: yay çalışma momentine kadar kaç derece kurulmuş.
  var pre = _feadNum(td.preload, NaN), rate = _feadNum(td.kArm, NaN),
      mean = _feadNum(td.meanLoad, NaN);
  if(Number.isFinite(pre) && Number.isFinite(mean) && Number.isFinite(rate) && rate > 0){
    out.relMeanDeg = (mean - pre) / rate;
    if(out.relMeanDeg < 0)
      out.notes.push('Yay çalışma momenti ön yükten KÜÇÜK (' + mean + ' < ' + pre
        + ' Nm); kol serbest konumun ters yanında kalır.');
  }
  out.ok = true;
  return out;
}

// Kol boyu çapraz kontrolü: |montaj merkezi − pivot| ile elle girilen kol boyu
// aynı olmak ZORUNDA — ikisi de sayfada yazıyor, uyuşmuyorsa biri yanlış
// okunmuştur. Bedava bir doğrulama: PDF'te 89.998 ↔ 90.0 ile tutuyor.
function veFeadArmCheck(td){
  var m = veFeadTensionerMount(td);
  var girilen = _feadNum(td && td.armLen, NaN);
  var out = { ok: false, fromCoords: m.armFromCoords, entered: girilen, deltaMm: NaN };
  if(!m.ok || !Number.isFinite(girilen) || !(girilen > 0)) return out;
  out.deltaMm = m.armFromCoords - girilen;
  out.ok = Math.abs(out.deltaMm) <= VE_FEAD_ARM_TOL_MM;
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
function veFeadAngleMode(td){
  var m = td && td.angleMode;
  if(m === 'direct' || m === 'mount') return m;
  var cx = _feadNum(td && td.cenX, NaN), cy = _feadNum(td && td.cenY, NaN);
  if(Number.isFinite(cx) && Number.isFinite(cy)) return 'mount';
  if(Number.isFinite(_feadNum(td && td.freeAngleDeg, NaN))) return 'direct';
  return 'mount';
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
// ── GERÇEK ZAMAN NEDEN OLMAZ (ÖLÇÜLDÜ — BMC örneği, 420×340 kart, 0.553 px/mm)
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
               // Sayfadaki Tensioner tablosu + "gerginin öngörülen merkezi
               // montaj pozisyonu" — serbest açı SAYFADA YOK, buradan türetilir.
               angleMode:'mount', pivotX:-259.94, pivotY:104.15,
               cenX:-170.080, cenY:99.160, armLen:90.0,
               preload:8.60, kArm:0.480, meanLoad:22.07,
               armInertia:0.0009, pulleyMass:0.80 } }
    ],
    // Kayış serpantin sırası: sürücüden başlar, sürücüye döner.
    route: ['SRC', 'IDR1', 'A_C', 'IDR2', 'ALT', 'TEN']
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
  nodesOut.push({ id:'ex-solver', type:'fead-solver', data: JSON.parse(JSON.stringify(ex.solver)) });
  // Kayış Yolu şeması da kurulur: örnek "çözülebilir bir model" değil, KULLANIMA
  // HAZIR bir model olmalı. Şema düğümü olmadan kullanıcı çözümü görüyor ama
  // kayış yolunu göremiyor ve onu paletten ayrıca aramak zorunda kalıyordu.
  nodesOut.push({ id:'ex-layout', type:'fead-layout', data:{} });
  var conns = [];
  ex.route.forEach(function(k, i){
    var next = ex.route[(i + 1) % ex.route.length];
    if(byKey[k] && byKey[next]) conns.push({ from: byKey[k].id, to: byKey[next].id });
  });
  return { nodes: nodesOut, connections: conns, solverId: 'ex-solver', example: ex };
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
  // Sıra yine BÜTÜN kasnakları taşır: yerleştirici (veFeadArrangeRing) ve
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
function veFeadBuildSystem(nodeList, connList){
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
  var effLength = _feadNum(bd.effLength != null ? bd.effLength : bd.length, 0);
  if(!(effLength > 0)) out.errors.push('Kayış efektif boyu girilmedi (Kayış Özellikleri panelinde).');
  var ribs = _feadNum(bd.ribs, 0);
  if(!(ribs > 0)) out.errors.push('Kayış kanal (kaburga) sayısı girilmedi.');
  var cfgBelt = {
    profile: bd.profile || 'PK',
    brand: bd.brand || 'GATES',
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
  var pivotX = _feadNum(td.pivotX, NaN), pivotY = _feadNum(td.pivotY, NaN);
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
  if(tensNodes.length === 1){
    if(!Number.isFinite(pivotX) || !Number.isFinite(pivotY)) out.errors.push('Gergi pivot konumu (X / Y) girilmedi.');
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
    } else if(!Number.isFinite(freeAng)){
      out.errors.push('Gergi serbest kol açısı girilmedi.');
    }
  }
  if(mode === 'mount' && mount.ok) freeAng = veFeadFreeAngleFrom(mount, 1);
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
    lengthOffsetMm: _feadNum(sd.lengthOffsetMm, 0)
  };
  out.cfg = cfg;
  if(out.errors.length) return out;              // eksik girdiyle çekirdeği çağırma

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
  try {
    FEADCore.geometryAt(sys, 0);
  } catch(e){
    out.errors.push(veFeadTranslateError(e && e.message));
    return out;
  }

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
function veFeadBuildFromCanvas(){
  if(typeof nodes === 'undefined') return veFeadBuildSystem([], []);
  return veFeadBuildSystem(nodes, (typeof connections !== 'undefined') ? connections : []);
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

  var fatModel = opts.fatigueModel || VE_FEAD_LIFE_FATIGUE_MODEL;
  out.fatigueModel = fatModel;

  if(duty.length){
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
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
    VE_FEAD_LIFE_FATIGUE_MODEL: VE_FEAD_LIFE_FATIGUE_MODEL,
    VE_FEAD_PRESET_LIB: VE_FEAD_PRESET_LIB,
    veFeadBuildSystem: veFeadBuildSystem, veFeadBuildFromCanvas: veFeadBuildFromCanvas,
    veFeadGatherPulleys: veFeadGatherPulleys,
    veFeadTensionerMount: veFeadTensionerMount, veFeadArmCheck: veFeadArmCheck,
    veFeadFreeAngleFrom: veFeadFreeAngleFrom, veFeadAngleMode: veFeadAngleMode,
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
    VE_FEAD_EXAMPLES: VE_FEAD_EXAMPLES, veFeadExampleKeys: veFeadExampleKeys,
    veFeadExampleOf: veFeadExampleOf, veFeadExampleNodes: veFeadExampleNodes
  };
}
