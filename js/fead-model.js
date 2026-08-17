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

// ─── Kayış sırası ───────────────────────────────────────────────────────────
// Bağlantı = kayış yolu. Zincir sürücüden başlar, çıkış→giriş izlenir. Zincire
// hiç girmemiş kasnaklar (kullanıcı henüz bağlamadıysa) sona, topoloji
// sırasıyla eklenir — yarım bağlanmış modelde de şema bir şey gösterir.
function veFeadRouteOrder(nodeList, connList){
  var pulleys = (nodeList||[]).filter(_feadIsPulley);
  if(!pulleys.length) return [];
  var byId = {};
  pulleys.forEach(function(n){ byId[n.id] = n; });
  var next = {};
  (connList||[]).forEach(function(c){
    if(!c) return;
    if(byId[c.from] && byId[c.to] && next[c.from] === undefined) next[c.from] = c.to;
  });
  var start = veFeadResolveDriver(pulleys);
  if(!start) start = pulleys[0];
  var order = [], seen = {}, cur = start.id, guard = 0;
  while(cur && byId[cur] && !seen[cur] && guard++ < 512){
    seen[cur] = 1;
    order.push(byId[cur]);
    cur = next[cur];
  }
  pulleys.forEach(function(p){ if(!seen[p.id]) order.push(p); });
  return order;
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
  [/designTensionN veya slackN gerekli/i, 'Tasarım gerginliği girilmedi (Çözücü panelinde).'],
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
              errors: [], warnings: [], cfg: null };
  var all = nodeList || [];
  if(typeof FEADCore === 'undefined'){
    out.errors.push('Hesap çekirdeği yüklenmedi (js/fead-core.js).');
    return out;
  }

  var order = veFeadRouteOrder(all, connList);
  out.order = order;
  if(!order.length){ out.errors.push('İç topolojide hiç kasnak yok.'); return out; }
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
  if(tensNodes.length === 1){
    if(!Number.isFinite(pivotX) || !Number.isFinite(pivotY)) out.errors.push('Gergi pivot konumu (X / Y) girilmedi.');
    if(!(armLen > 0)) out.errors.push('Gergi kol boyu girilmedi.');
    if(!Number.isFinite(preload)) out.errors.push('Gergi yay ön yük momenti girilmedi.');
    if(!Number.isFinite(rate)) out.errors.push('Gergi yay katsayısı (Nm/°) girilmedi.');
    if(!Number.isFinite(freeAng)) out.errors.push('Gergi serbest kol açısı girilmedi.');
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

  // ── Çözücü / tasarım ──
  var design = _feadNum(sd.designTensionN, NaN);
  if(!Number.isFinite(design) || !(design > 0))
    out.errors.push('Tasarım gerginliği girilmedi (Çözücü panelinde).');
  var driveRatio = _feadNum(sd.driveRatio, 1);
  if(!(driveRatio > 0)) driveRatio = 1;

  var cfg = {
    pulleys: cfgPulleys, belt: cfgBelt, tensioner: cfgTen,
    designTensionN: Number.isFinite(design) ? design : undefined,
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

// Jest/Node köprüsü (tarayıcıda no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    _feadNum: _feadNum, _feadDefOf: _feadDefOf, _feadNodeName: _feadNodeName,
    _feadIsPulley: _feadIsPulley,
    VE_FEAD_DEFAULT_DIA: VE_FEAD_DEFAULT_DIA, VE_FEAD_ERROR_MAP: VE_FEAD_ERROR_MAP,
    veFeadContactOf: veFeadContactOf, veFeadContactLabel: veFeadContactLabel,
    veFeadOD: veFeadOD, veFeadHasOD: veFeadHasOD, veFeadRadius: veFeadRadius,
    veFeadMigrateNode: veFeadMigrateNode, veFeadMigrateAll: veFeadMigrateAll,
    veFeadRouteOrder: veFeadRouteOrder, veFeadResolveDriver: veFeadResolveDriver,
    veFeadUniqueNames: veFeadUniqueNames, veFeadTranslateError: veFeadTranslateError,
    veFeadBuildSystem: veFeadBuildSystem, veFeadBuildFromCanvas: veFeadBuildFromCanvas,
    veFeadGatherPulleys: veFeadGatherPulleys
  };
}
