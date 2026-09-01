// ============================================================================
//  FEAD — DEFTERDEN GELEN ÜÇ KAPI
// ============================================================================
// BMC'nin kendi hesap defteri (`KIRPI_II_NEX_GEN.FEAD.xlsx`) hüküm veren üç
// denetim taşıyordu; ikisi MFSim'de yoktu, üçüncüsü defterde yarım kalmıştı.
// Bu dosya o üçünü saf fonksiyon olarak kuruyor. DOM'suz: panel
// (js/cp-fead.js) ve raporlar (js/cp-fead-report.js) aynı çağrıyı paylaşır —
// iki yüzeyin ayrı hesap yapması, sessizce ayrışmaları demekti.
//
// | Kapı                   | Defterdeki yeri              | MFSim'de |
// |------------------------|------------------------------|----------|
// | Kasnak merkez mesafesi | Kasnak Mesafe Uygunluğu J6:J11 | YOKTU   |
// | Çevrim oranı penceresi | Komponent Secimi G20/K20/O20/S20 | YOKTU |
// | Aksesuar devir sınırı  | Calisma Oranlari F/G — HÜKÜM YOK | YOKTU |
//
// ── ÜÇÜNCÜSÜ DEFTERDE YARIM ────────────────────────────────────────────────
// Defter overspeed ve no-load-governed oranlarını HESAPLIYOR ama hiçbir sınırla
// karşılaştırmıyor: aksesuarın "maksimum sürekli" ve "anlık maksimum" devri
// katalogda VERİ olarak duruyor, KAPI olarak yok. Buradaki üçüncü kapı o
// boşluğu dolduruyor — defterden alınan şey veri, hüküm MFSim'in.
//
// ── MERKEZ MESAFESİ BİR HÜKÜM DEĞİL UYARI ──────────────────────────────────
// `0,7·(d₁+d₂) ≤ a ≤ 2·(d₁+d₂)` İKİ KASNAKLI V-kayış tahrikleri için yazılmış
// bir başparmak kuralıdır; orada merkez mesafesi tasarımcının serbest
// değişkenidir. Serpantinde açıklığı tek bir çift değil bütün yerleşim belirler
// ve uzaktaki bir aksesuar üst sınırı doğal olarak zorlar. ÖLÇÜLDÜ: defterin
// kendi tasarımında alternatör–avara çifti üst sınıra %1,8 (5,08 mm) kala
// duruyor ve tasarım gerçekte sorunsuz. Bu yüzden ihlal `'warn'` seviyesinde
// döner, `'no'` değil — ve pay yüzdesi hükümle BİRLİKTE basılır ki sınıra ne
// kadar yaklaşıldığı gizlenmesin. Diğer iki kapı `'no'` verir.
//
// ── ÇAP = PITCH ÇAPI (2·rPitch), DIŞ ÇAP DEĞİL ─────────────────────────────
// Defterin "Efektif Çap" sütunu `OD + 2h_b` (kaburgalı) / `OD + 2h_r` (sırt)
// yazıyor; bu, çekirdeğin `rPitch`'inin tam iki katıdır ve teğet geometrisinin
// oturduğu yarıçaptır. Dış çapla hesaplamak PK'da çift başına 4,8 mm'lik bir
// kayma demekti — kuralın alt sınırında %3'lük sessiz bir hata.
//
// ── ORAN DA PITCH ÇAPINDAN: DEFTERİN KENDİ İÇİNDE ÜÇ ORAN VAR ──────────────
// Aynı alternatör için defterde üç ayrı sayı duruyor ve üçü de birbirini
// tutmuyor: pitch çaplarının verdiği 2,4492 · "Komponent Secimi"nin DIŞ çapla
// hesapladığı 2,5039 (+%2,2) · "Kuvvet Hesabi-" F sütununa ELLE yazılmış 3,13
// (+%27,8). Sonuncusu çevresel kuvvete doğrudan giriyor (Fu ∝ 1/n) ve
// alternatörün kuvvetini %27,8, klimanınkini %11,9 düşük gösteriyor.
// MFSim'de böyle bir sapma YAPISAL OLARAK mümkün değil: oran her zaman
// `FEADCore.speedRatio` ile pitch yarıçaplarından gelir, ikinci bir alan yok.
// Ölçümü `tests/unit/fead-checks.test.js` içinde çıpalı.
//
// ── HİÇBİR KAPI VERİ UYDURMAZ ──────────────────────────────────────────────
// Devir sınırı bilinmiyorsa satır `durum: 'wait'` ile döner ve UYGUN SAYILMAZ.
// Eksik girdiyi "geçti" diye basmak, kapının hiç olmamasından kötü olurdu.

var VE_FEAD_CHECK_VERSION = '1.0.0';

// Merkez mesafesi kuralının katsayıları. Defterden birebir; tek yerde durur ki
// iki yüzey (panel ve rapor) aynı sayıyı kullansın.
var VE_FEAD_CENTER_RULE = { lo: 0.7, hi: 2.0 };

function _fcNum(v){
  var n = (typeof v === 'string') ? Number(v.trim().replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function _fcCore(){
  if(typeof FEADCore !== 'undefined') return FEADCore;
  return (typeof window !== 'undefined') ? window.FEADCore : null;
}
function _fcName(build, i){
  var sys = build && build.sys;
  if(sys && sys.pulleys && sys.pulleys[i] && sys.pulleys[i].name) return sys.pulleys[i].name;
  var n = build && build.order && build.order[i];
  return (n && (n.name || n.id)) || ('Kasnak ' + (i + 1));
}
function _fcNodeAt(build, i){
  return (build && build.order && build.order[i]) || null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  1) KASNAK MERKEZ MESAFESİ  ·  0,7·(d₁+d₂) ≤ a ≤ 2·(d₁+d₂)
// ═══════════════════════════════════════════════════════════════════════════
// Komşuluk KAYIŞ YOLU sırasıdır (son kasnak ilkine kapanır) — defterin
// "Son ile 1 · 2 ile 1 · 3 ile 2 …" satırlarının aynısı.
//
// Gergi kasnağının merkezi bir GİRDİ değil, kol açısından türer; bu yüzden
// mesafeler çözülmüş geometriden okunur (varsayılan: çalışma/ortalama konum).
// Sabit bir koordinat kullanmak, gergiyi montaj konumunda dondurup gerçekte
// çalıştığı yerden başka bir mesafe ölçmek olurdu.
function veFeadCheckCenterDistance(build, opt){
  opt = opt || {};
  var out = { ok: null, durum: 'wait', rows: [], worst: null,
              lo: VE_FEAD_CENTER_RULE.lo, hi: VE_FEAD_CENTER_RULE.hi, note: '' };
  var C = _fcCore(), sys = build && build.sys;
  if(!C || !sys || !sys.pulleys || sys.pulleys.length < 3){
    out.note = 'Geometri çözülmedi.';
    return out;
  }
  var rel = _fcNum(opt.relDeg);
  if(!Number.isFinite(rel)){
    try { rel = C.meanRel(sys); } catch(e){ rel = 0; }
    if(!Number.isFinite(rel)) rel = 0;
  }
  var g;
  try { g = C.geometryAt(sys, rel); } catch(e){ out.note = 'Geometri çözülemedi.'; return out; }
  if(!g || !g.pulleys) { out.note = 'Geometri çözülemedi.'; return out; }

  var n = g.pulleys.length;
  for(var i = 0; i < n; i++){
    var j = (i + 1) % n;
    var pi = g.pulleys[i], pj = g.pulleys[j];
    var dI = 2 * _fcNum(pi.rPitch), dJ = 2 * _fcNum(pj.rPitch);
    var a  = Math.hypot(pj.c[0] - pi.c[0], pj.c[1] - pi.c[1]);
    if(!(Number.isFinite(dI) && Number.isFinite(dJ) && Number.isFinite(a))) continue;
    var sum = dI + dJ, lo = VE_FEAD_CENTER_RULE.lo * sum, hi = VE_FEAD_CENTER_RULE.hi * sum;
    var ok = (a >= lo && a <= hi);
    out.rows.push({
      i: i, j: j, adI: _fcName(build, i), adJ: _fcName(build, j),
      cift: _fcName(build, i) + ' ↔ ' + _fcName(build, j),
      dI: dI, dJ: dJ, dSum: sum, lo: lo, a: a, hi: hi, ok: ok,
      // Paylar YÜZDE olarak, sınıra göre. Negatif pay = ihlal.
      altPayPct: (a - lo) / lo * 100,
      ustPayPct: (hi - a) / hi * 100,
      // En yakın sınıra olan pay — sıralama ve "en kritik çift" bunu okur.
      payPct: Math.min((a - lo) / lo, (hi - a) / hi) * 100
    });
  }
  if(!out.rows.length){ out.note = 'Değerlendirilebilir kasnak çifti yok.'; return out; }
  out.rows.forEach(function(r){ if(!out.worst || r.payPct < out.worst.payPct) out.worst = r; });
  out.ok = out.rows.every(function(r){ return r.ok; });
  // İhlal 'no' DEĞİL 'warn' — gerekçesi dosya başlığında (iki kasnaklı kural).
  out.durum = out.ok ? 'ok' : 'warn';
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  2) ÇEVRİM ORANI PENCERESİ  ·  aksesuar governed devirde optimum bandında mı
// ═══════════════════════════════════════════════════════════════════════════
// Defter bunu ORAN olarak yazıyor (oran ∈ [optimum/governed, sürekli/governed]);
// buradaki biçim MATEMATİKSEL OLARAK AYNI ama fiziksel olarak okunur:
// motor governed devrindeyken aksesuarın devri kendi optimum bandına düşüyor mu?
//
// Hükmün YÖNÜ korunuyor — defter üç durumlu ve bu bir incelik değil, kullanıcıya
// ne yapacağını söyleyen bilgi:
//     devir düşük  → aksesuar kasnağı KÜÇÜLTÜLMELİ (küçük kasnak = hızlı döner)
//     devir yüksek → aksesuar kasnağı BÜYÜTÜLMELİ
function veFeadCheckRatioWindow(build, opt){
  opt = opt || {};
  var out = { ok: null, durum: 'wait', rows: [], governedRpm: NaN, note: '' };
  var C = _fcCore();
  var rs = (build && (build.sys || build.ratioSys)) || null;
  if(!C || !rs){ out.note = 'Oran sistemi kurulamadı.'; return out; }

  var gov = _fcNum(opt.governedRpm);
  if(!(gov > 0)){ out.note = 'Motorun governed devri bilinmiyor.'; return out; }
  out.governedRpm = gov;

  var crk = (rs._crkIdx != null) ? rs._crkIdx : -1;
  var tenIdx = (build.sys && build.sys._tenIdx != null) ? build.sys._tenIdx : -1;
  var n = (rs.pulleys || []).length;
  for(var i = 0; i < n; i++){
    if(i === crk || i === tenIdx) continue;
    var node = _fcNodeAt(build, i);
    var lim = (typeof veFeadAccLimits === 'function') ? veFeadAccLimits(node) : null;
    if(!lim) continue;
    var optRpm = _fcNum(lim.optimum && lim.optimum.rpm);
    var contRpm = _fcNum(lim.maxCont && lim.maxCont.rpm);
    if(!(optRpm > 0) || !(contRpm > 0)) continue;      // sınırı olmayan kasnak: idler vb.
    var accRpm;
    try { accRpm = C.accessoryRpm(rs, i, gov); } catch(e){ continue; }
    if(!Number.isFinite(accRpm)) continue;
    var hkm = (accRpm < optRpm) ? 'kucult' : (accRpm > contRpm ? 'buyut' : 'uygun');
    out.rows.push({
      i: i, ad: _fcName(build, i), key: lim.key, model: lim.ad,
      accRpm: accRpm, optimumRpm: optRpm, maxContRpm: contRpm,
      ok: hkm === 'uygun', verdict: hkm,
      metin: hkm === 'kucult' ? 'Kasnak çapı küçültülmeli'
           : hkm === 'buyut'  ? 'Kasnak çapı büyütülmeli' : 'Uygun',
      // En yakın sınıra pay (yüzde). İhlalde negatif.
      payPct: Math.min((accRpm - optRpm) / optRpm, (contRpm - accRpm) / contRpm) * 100
    });
  }
  if(!out.rows.length){
    out.note = 'Devir penceresi bilinen aksesuar yok (katalogdan seçin ya da sınırları elle girin).';
    return out;
  }
  out.ok = out.rows.every(function(r){ return r.ok; });
  out.durum = out.ok ? 'ok' : 'no';
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  3) AKSESUAR DEVİR SINIRI  ·  sürekli ve anlık maksimum
// ═══════════════════════════════════════════════════════════════════════════
// Üç devir noktasında bakılır ve hangisinin hangi sınıra ait olduğu FİZİKTEN
// gelir, seçimden değil:
//     çalışma çevriminin en yüksek devri → maksimum SÜREKLİ  (orada uzun kalır)
//     motor governed                     → maksimum SÜREKLİ
//     motor overspeed                    → maksimum ANLIK     (geçici aşım)
// Bilinmeyen devir noktası atlanır; hiçbiri bilinmiyorsa satır 'wait' olur.
function veFeadCheckSpeedLimit(build, opt){
  opt = opt || {};
  var out = { ok: null, durum: 'wait', rows: [], note: '' };
  var C = _fcCore();
  var rs = (build && (build.sys || build.ratioSys)) || null;
  if(!C || !rs){ out.note = 'Oran sistemi kurulamadı.'; return out; }

  var gov  = _fcNum(opt.governedRpm);
  var over = _fcNum(opt.overspeedRpm);
  var duty = _fcNum(opt.maxDutyRpm);
  var crk = (rs._crkIdx != null) ? rs._crkIdx : -1;
  var tenIdx = (build.sys && build.sys._tenIdx != null) ? build.sys._tenIdx : -1;
  var n = (rs.pulleys || []).length;

  for(var i = 0; i < n; i++){
    if(i === crk || i === tenIdx) continue;
    var node = _fcNodeAt(build, i);
    var lim = (typeof veFeadAccLimits === 'function') ? veFeadAccLimits(node) : null;
    if(!lim) continue;
    var cont = _fcNum(lim.maxCont && lim.maxCont.rpm);
    var peak = _fcNum(lim.maxPeak && lim.maxPeak.rpm);
    if(!(cont > 0) && !(peak > 0)) continue;

    function at(r){
      if(!(r > 0)) return NaN;
      try { var v = C.accessoryRpm(rs, i, r); return Number.isFinite(v) ? v : NaN; }
      catch(e){ return NaN; }
    }
    var noktalar = [];
    var vDuty = at(duty), vGov = at(gov), vOver = at(over);
    if(Number.isFinite(vDuty) && cont > 0)
      noktalar.push({ ad: 'çevrim tepesi', motorRpm: duty, accRpm: vDuty,
                      limit: cont, limitAd: 'sürekli', ok: vDuty <= cont });
    if(Number.isFinite(vGov) && cont > 0)
      noktalar.push({ ad: 'governed', motorRpm: gov, accRpm: vGov,
                      limit: cont, limitAd: 'sürekli', ok: vGov <= cont });
    if(Number.isFinite(vOver) && peak > 0)
      noktalar.push({ ad: 'overspeed', motorRpm: over, accRpm: vOver,
                      limit: peak, limitAd: 'anlık', ok: vOver <= peak });
    if(!noktalar.length) continue;

    var kritik = null;
    noktalar.forEach(function(p){
      p.payPct = (p.limit - p.accRpm) / p.limit * 100;
      if(!kritik || p.payPct < kritik.payPct) kritik = p;
    });
    out.rows.push({
      i: i, ad: _fcName(build, i), key: lim.key, model: lim.ad,
      maxContRpm: cont, maxPeakRpm: peak, noktalar: noktalar,
      kritik: kritik, ok: noktalar.every(function(p){ return p.ok; }),
      payPct: kritik.payPct
    });
  }
  if(!out.rows.length){
    out.note = 'Devir sınırı bilinen aksesuar ya da karşılaştırılacak motor devri yok.';
    return out;
  }
  out.ok = out.rows.every(function(r){ return r.ok; });
  out.durum = out.ok ? 'ok' : 'no';
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ÜÇÜ BİRDEN — panel ve rapor AYNI çağrıyı kullanır
// ═══════════════════════════════════════════════════════════════════════════
// `opt` motor devirlerini taşır; çözücü düğümünün verisinden okunur
// (`veFeadCheckOpt`). Ayrı ayrı çağırmak da mümkün, ama iki yüzeyin aynı
// sonucu görmesi için tek giriş noktası olması gerekiyor.
function veFeadChecks(build, opt){
  return {
    version: VE_FEAD_CHECK_VERSION,
    centerDistance: veFeadCheckCenterDistance(build, opt),
    ratioWindow:    veFeadCheckRatioWindow(build, opt),
    speedLimit:     veFeadCheckSpeedLimit(build, opt)
  };
}

// Çözücü düğümünün verisi → kapı seçenekleri. Motor devirleri katalogdan ya da
// elle gelmiş olabilir; ikisi de aynı alanlarda durur (`veFeadEngineApply`
// katalog değerini oraya yazıyor), bu yüzden burada tek okuma yeter.
//
// ÇEVRİM TEPESİ = SÜRE PAYI SIFIR OLMAYAN EN YÜKSEK DEVİR. Sıfır paylı satır
// bir gerilme noktasıdır, bir çalışma noktası değil (arşivde AG00810 tam olarak
// böyle kurulmuş: ara devirler sıfır ağırlıklı). Onu "sürekli" sınırla
// karşılaştırmak, motorun hiç kalmadığı bir devirde ihlal ilan etmek olurdu.
// Payı YAZILMAMIŞ satır sıfır sayılmaz — eksik veri, sıfır beyanı değildir.
function veFeadCheckOpt(solverData, dutyRows){
  var sd = solverData || {};
  var tepe = NaN;
  (dutyRows || []).forEach(function(r){
    var v = _fcNum(r && r.rpm);
    if(!Number.isFinite(v)) return;
    var dc = (r && r.dcPct !== undefined && r.dcPct !== null && r.dcPct !== '')
      ? _fcNum(r.dcPct) : NaN;
    if(Number.isFinite(dc) && dc <= 0) return;
    if(!(tepe > 0) || v > tepe) tepe = v;
  });
  return {
    governedRpm:  _fcNum(sd.governedRpm),
    overspeedRpm: _fcNum(sd.overspeedRpm),
    idleRpm:      _fcNum(sd.idleRpm),
    maxDutyRpm:   tepe
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_CHECK_VERSION: VE_FEAD_CHECK_VERSION,
    VE_FEAD_CENTER_RULE: VE_FEAD_CENTER_RULE,
    veFeadCheckCenterDistance: veFeadCheckCenterDistance,
    veFeadCheckRatioWindow: veFeadCheckRatioWindow,
    veFeadCheckSpeedLimit: veFeadCheckSpeedLimit,
    veFeadChecks: veFeadChecks,
    veFeadCheckOpt: veFeadCheckOpt
  };
}
