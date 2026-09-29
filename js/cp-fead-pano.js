// ============================================================================
// FEAD — A3 SONUÇ PANOSU (tek sayfa · yatay A3 · basılabilir)
// ============================================================================
// Kullanıcı kararı (2026-09-29, tasarım tuvali "FEAD A3 rapor tasarımları" →
// "B · Pano"; varyasyonları istenmedi): çözümden sonra bakılan değerler TEK
// bir yatay A3 sayfada — yedi gösterge, kayış yolu, dört tablo, üç grafik ve
// uygunluk kapıları. Kaynağı kullanıcının ContiTech CONTI-V MULTIRIB
// ekranları ile Gates raporlarının sonuç sayfaları.
//
// HESAP YOK. Her sayı ÇÖZÜMDEN (R) okunur ve üreticisi öteki iki belgeyle
// ORTAKTIR — iki belge aynı sayıyı farklı basamaz:
//   sayı biçimi  _frF · _frFs · _frPct · _frEsc · _frNum   (cp-fead-report.js)
//   kayma        _frSlipStats · _frSlipYuk · _frSfYaz · _frKaymaKosul — satırlar
//                Gates koşulunda ve TASARIM yükünde, yük taşıma ROLDEN, sürtünme
//                çözümün dondurduğu seçim (kural 48–49)
//   grafikler    _frTensionFigure · _frFreqFigure · _frSlipFigure (veFeadFigureRaw)
//   tepe yük     _fsrPeak (cp-fead-summary.js) — KALİBRE DEĞİL damgasıyla
//   kapılar      R.checks — çözüm anında yazıldı, burada yeniden hesaplanmaz
//   çizim        veFeadLayoutSVG — Kayış Yolu kartının çizicisi
// Sayfanın kendi işi İNDİRGEMEDİR: çevrim boyunca en büyük / en küçük, hangi
// devirde, hangi kasnakta. Veri modeli (`veFeadPanoVeri`) HAM sayı taşır ve
// HTML yalnız biçimler: kapı her sayıyı çözümden bağımsız yeniden kurar.
//
// 10 PT TABAN. Gövde 13,333 px (A3'e %100 basımda 10 pt). SVG yazısı viewBox
// ile ölçeklenir: çizim ve grafikler ölçeği HESAPLANAN kutularda durur ve
// taban yazı boyuna o ölçekle uygulanır (`_fpnTaban`). Tek istisna alt indis.
//
// Ad öneki `_fpn…` (`_fr…` ayrıntılı rapor, `_fsr…` özet rapor).
// ----------------------------------------------------------------------------

// SAYFA ÖLÇÜSÜ — A3 yatay, 96 dpi. 297 mm = 1.122,5 px: yükseklik 1.123
// yazılırsa taşan yarım piksel baskıda ikinci, boş bir sayfa açar.
// Sütun genişlikleri ve blok boyları CSS'le BİREBİR (`_fpnCss`); kutuların
// ölçüsü buradan hesaplanır, çünkü SVG yazısının basılı boyu kutunun
// ölçeğine bağlı. Ayrışma sessizdir — kapı gerçek tarayıcıda ölçer.
var VE_FEAD_PANO = {
  W: 1587, H: 1122, PAY: 40,
  TABAN: 13.34,                     // 10 pt = 13,333 px, yuvarlama payıyla
  SUTUN: [500, 506, 461], ARA: 20,  // sol · orta · sağ
  UST: 56, KPI: 104,
  BLOK: 16, BASLIK: 27,             // bloklar arası · başlığın tam boyu (23 + 4)
  TH: 34, TH_TEK: 22,               // tablo başlığı: birimli · tek satır
  TABLO_ALT: 0.5,                   // çöken kenarlığın tablonun altına taşan yarısı (ölçüldü)
  SATIR: 21, SATIR_EN_AZ: 17,       // tablo satırı; orta sütun sığmazsa daralır
  CIZIM_YAZI: 9,                    // çizicinin taban yazısı (kasnak adı), kendi biriminde
  GRAFIK_W: 369,                    // gerginlik ve frekans grafiğinin viewBox genişliği
  KAYMA_W: 461                      // kayma grafiği — ölçek 1
};

// Gövdenin (üç sütunun) yüksekliği: başlık, kural, gösterge şeridi ve
// aralarındaki boşluklar düşülür (CSS: .cz 6 + 2 · .kpis 12 · .govde 16).
function _fpnGovdeH(){
  var P = VE_FEAD_PANO;
  return P.H - 2 * P.PAY - P.UST - 8 - (12 + P.KPI) - 16;
}

// ─── SVG YAZI TABANI ────────────────────────────────────────────────────────
// `olcek`: viewBox biriminin basılı px karşılığı. Tabanın altındaki yazı
// boyu tabana yükseltilir, üstündeki dokunulmaz; ikinci geçiş hiçbir şey
// değiştirmez. Kutular sabit ölçüde olduğu için ölçek HESAPLANIR.
function _fpnTaban(svg, olcek){
  if(!svg || !(olcek > 0)) return svg || '';
  var T = VE_FEAD_PANO.TABAN;
  return String(svg).replace(/font-size="([\d.]+)"/g, function(m, x){
    var v = parseFloat(x);
    if(!(v > 0) || v * olcek >= T - 1e-6) return m;
    return 'font-size="' + (Math.ceil(T / olcek * 10) / 10).toFixed(1) + '"';   // makine: SVG yazı boyu
  });
}

// ═══════════════════ VERİ MODELİ — ham sayılar, çözümden ═══════════════════
// Dönen nesne sayfanın BÜTÜN sayılarını taşır; biçim yok. Çözüm yoksa null.
function veFeadPanoVeri(R, node){
  if(!R || !R.ok || !R.build || !R.build.sys || !R.analysis) return null;
  var C = (typeof FEADCore !== 'undefined') ? FEADCore
        : ((typeof window !== 'undefined') ? window.FEADCore : null);
  if(!C) return null;
  var b = R.build, sys = b.sys, A = R.analysis;
  var duty = A.duty || [];
  var n = (sys.pulleys || []).length;
  var kod = (typeof veFeadPulleyCodes === 'function') ? veFeadPulleyCodes(sys)
          : sys.pulleys.map(function(p){ return p.name; });
  // Sürücü çekirdeğin `crank` kasnağı: gücün toplamı onda, F_u onun
  // çıkış − giriş gerilmesi (FEADCore.spanTensions). İkincil tahrikte fan.
  var crk = (sys._crkIdx != null && sys._crkIdx >= 0) ? sys._crkIdx : 0;
  var ten = (sys._tenIdx != null) ? sys._tenIdx : -1;
  var sv = _frServis(R);
  var kayisVeri = (R.beltDataMode || 'full') !== 'none';

  var Td = _frNum(A.tensioner && A.tensioner.tensionN);
  if(!Number.isFinite(Td)) Td = _frNum(sys.designTensionN);

  // Çevrimin en yüksek devri ve en çok süre payı taşıyan satırı (gerilme
  // haritası ve tepe yük o noktayı anlatır — özet raporun seçimi).
  var nMax = NaN, ref = null;
  duty.forEach(function(d){
    var r = _frNum(d.engineRpm);
    if(Number.isFinite(r) && !(r <= nMax)) nMax = r;
    if(!ref || (_frNum(d.dcPct) || 0) > (_frNum(ref.dcPct) || 0)) ref = d;
  });

  // STATİK: bütün açıklıklar tasarım gerginliğinde (motor durgun).
  var geom = null, statHub = [], statF = [];
  try { geom = C.tensionerState(sys, C.meanRel(sys)).geom; } catch(e){ geom = null; }
  if(geom && Number.isFinite(Td)){
    var dizi = [];
    for(var q = 0; q < n; q++) dizi.push(Td);
    try { statHub = C.hubloads(geom, dizi) || []; } catch(e){ statHub = []; }
    if(kayisVeri && typeof veFeadSpanFreqRows === 'function'){
      try { statF = veFeadSpanFreqRows(sys, geom, dizi, { engineRpm: 0, modes: 1 }) || []; }
      catch(e){ statF = []; }
    }
  }

  // Kayma satırları ADLA eşlenir (özet raporun kuralı, _frSlipStats); yük
  // taşıyıp taşımadığı satırın ROLÜNDEN (`_frSlipYuk`, kural 49) — oran eşiği
  // Gates koşulunda avaraları da "yük taşıyan" sayıyordu.
  var adSira = {};
  sys.pulleys.forEach(function(p, i){ adSira[p.name] = i; });

  var kas = sys.pulleys.map(function(p, i){
    var g = (A.geometry || [])[i] || {};
    var r = { i: i, kod: kod[i], ad: p.name, surucu: i === crk, gergi: i === ten,
      beta: _frNum(g.wrapDeg), oran: _frNum(g.speedRatio), nMax: NaN, pMax: NaN,
      flStat: NaN, flStatYon: NaN, flDin: NaN, flDinYon: NaN, flDinRpm: NaN,
      sfMin: NaN, sfRpm: NaN, yuklu: false, omurPay: NaN };
    if(Number.isFinite(nMax)){
      try { r.nMax = C.accessoryRpm(sys, i, nMax); } catch(e){ r.nMax = NaN; }
    }
    if(statHub[i]){ r.flStat = _frNum(statHub[i].FN); r.flStatYon = _frNum(statHub[i].dirDeg); }
    duty.forEach(function(d){
      var pp = d.perPulley && d.perPulley[i];
      if(pp && Number.isFinite(_frNum(pp.powerKw)) && !(_frNum(pp.powerKw) <= r.pMax)) r.pMax = _frNum(pp.powerKw);
      var h = d.hubloads && d.hubloads[i];
      if(h && Number.isFinite(_frNum(h.FN)) && !(_frNum(h.FN) <= r.flDin)){
        r.flDin = _frNum(h.FN); r.flDinYon = _frNum(h.dirDeg); r.flDinRpm = _frNum(d.engineRpm);
      }
    });
    var fp = R.fatigue && R.fatigue.perPulley && R.fatigue.perPulley[i];
    if(fp) r.omurPay = _frNum(fp.sharePct);
    return r;
  });
  duty.forEach(function(d){
    (d.slip || []).forEach(function(s){
      var i = adSira[s.name];
      if(i === undefined) return;
      var sf = _frNum(s.SF);
      if(Number.isFinite(sf) && !(sf >= kas[i].sfMin)){ kas[i].sfMin = sf; kas[i].sfRpm = _frNum(d.engineRpm); }
      if(_frSlipYuk(s)) kas[i].yuklu = true;
    });
  });

  // AÇIKLIKLAR — j. açıklık j. kasnağın ÇIKIŞI (çekirdeğin sırası).
  var acik = [], hucre = 0, alti = 0;
  for(var j = 0; j < n; j++){
    var g2 = (A.geometry || [])[j] || {};
    var a = { j: j, ad: kod[j] + ' – ' + kod[(j + 1) % n], Lf: _frNum(g2.exitSpanMm),
      fStat: (statF[j] && statF[j].fHz && statF[j].fHz.length) ? _frNum(statF[j].fHz[0]) : NaN,
      tMax: NaN, f1Min: NaN, f1MinRpm: NaN, oranMin: NaN, oranRpm: NaN };
    duty.forEach(function(d){
      var pp = d.perPulley && d.perPulley[j];
      if(pp && Number.isFinite(_frNum(pp.exitTensionN)) && !(_frNum(pp.exitTensionN) <= a.tMax)) a.tMax = _frNum(pp.exitTensionN);
      var fr = d.frequencies && d.frequencies[j];
      var f1 = (fr && fr.fHz && fr.fHz.length) ? _frNum(fr.fHz[0]) : NaN;
      if(!Number.isFinite(f1)) return;
      if(!(f1 >= a.f1Min)){ a.f1Min = f1; a.f1MinRpm = _frNum(d.engineRpm); }
      var fa = _frNum(d.firingHz);
      if(!(fa > 0)) return;
      var o = f1 / fa;
      hucre++;
      if(o < 1) alti++;
      if(!(o >= a.oranMin)){ a.oranMin = o; a.oranRpm = _frNum(d.engineRpm); }
    });
    acik.push(a);
  }
  var rez = null;
  acik.forEach(function(a){ if(Number.isFinite(a.oranMin) && (!rez || a.oranMin < rez.oran)) rez = { oran: a.oranMin, rpm: a.oranRpm, ad: a.ad }; });
  if(rez){ rez.alti = alti; rez.hucre = hucre; }

  // ÇEVRİM — yük taşıyan aksesuarların gücü sütun olur (avara ≈ 0 kW düşer).
  var aks = [];
  for(var i2 = 0; i2 < n; i2++){
    if(i2 === crk || i2 === ten) continue;
    var mx = 0;
    duty.forEach(function(d){ var pp = d.perPulley && d.perPulley[i2]; if(pp) mx = Math.max(mx, _frNum(pp.powerKw) || 0); });
    if(mx > 0.05) aks.push(i2);
  }
  var cev = duty.map(function(d){
    var pc = d.perPulley && d.perPulley[crk];
    var sfm = NaN, om = NaN;
    (d.slip || []).forEach(function(s){
      var v = _frNum(s.SF);
      if(_frSlipYuk(s) && Number.isFinite(v) && !(v >= sfm)) sfm = v;
    });
    var fa = _frNum(d.firingHz);
    (d.frequencies || []).forEach(function(fr){
      var f1 = (fr && fr.fHz && fr.fHz.length) ? _frNum(fr.fHz[0]) : NaN;
      if(Number.isFinite(f1) && fa > 0 && !(f1 / fa >= om)) om = f1 / fa;
    });
    return {
      rpm: _frNum(d.engineRpm), dc: _frNum(d.dcPct),
      kw: aks.map(function(k){ var pp = d.perPulley && d.perPulley[k]; return pp ? _frNum(pp.powerKw) : NaN; }),
      P: pc ? _frNum(pc.powerKw) : NaN, v: _frNum(d.vMs),
      Fu: pc ? _frNum(pc.exitTensionN) - _frNum(pc.entryTensionN) : NaN,
      sf: sfm, oran: om
    };
  });
  var enBuyuk = function(alan){
    var e = null;
    cev.forEach(function(c){ if(Number.isFinite(c[alan]) && (!e || c[alan] > e[alan])) e = c; });
    return e;
  };
  var cTepe = null;
  cev.forEach(function(c){ if(c.rpm === nMax) cTepe = c; });

  // ── GÖSTERGELER ──────────────────────────────────────────────────────────
  var st = _frSlipStats(R);
  var hubEn = null;
  kas.forEach(function(k){ if(Number.isFinite(k.flDin) && (!hubEn || k.flDin > hubEn.flDin)) hubEn = k; });
  var life = R.life || null, bask = null;
  kas.forEach(function(k){ if(Number.isFinite(k.omurPay) && (!bask || k.omurPay > bask.omurPay)) bask = k; });
  var esik = (typeof veFeadSlipThreshold === 'function')
    ? veFeadSlipThreshold(b, duty, R.servis && R.servis.deger) : null;
  var pk = (typeof _fsrPeak === 'function') ? _fsrPeak(R) : null;
  var boy = (typeof veFeadBoyCizgileri === 'function')
    ? veFeadBoyCizgileri(sys.belt && sys.belt.effLength, sys.belt) : null;

  var vTepe = cTepe ? cTepe.v : NaN;
  var fB = (typeof veFeadEgilmeFrekansi === 'function')
    ? veFeadEgilmeFrekansi(vTepe, n, sys.belt && sys.belt.effLength) : NaN;

  // Gerilme haritası: süre payı en büyük devrin açıklık gerilmeleri
  // (çekirdeğin `exitTensionN`i = açıklık gerilmesi).
  var gerilme = null;
  if(ref && Array.isArray(ref.perPulley) && ref.perPulley.length === n){
    var spanN = ref.perPulley.map(function(p){ return _frNum(p.exitTensionN); });
    if(spanN.every(Number.isFinite))
      gerilme = { spanN: spanN, min: Math.min.apply(null, spanN), max: Math.max.apply(null, spanN),
                  engineRpm: _frNum(ref.engineRpm) };
  }

  var t = sys.tensioner || null;
  var tenData = (ten >= 0 && b.order && b.order[ten] && b.order[ten].data) || {};
  var gergi = t ? {
    parca: tenData.tenPart ? String(tenData.tenPart) : '',
    kunye: tenData.tenLib ? String(tenData.tenLib) : '',
    kol: _frNum(t.armLength), M0: _frNum(t.preloadNm), k: _frNum(t.rateNmPerDeg),
    pivot: t.pivot || null, avara: b.center || null,
    abs: _frNum(A.meanAbsDeg), rel: _frNum(A.meanRelDeg),
    takeup: _frNum(A.tensioner && A.tensioner.takeupMmPerDeg),
    FL: _frNum(A.tensioner && A.tensioner.hubloadN), FLyon: _frNum(A.tensioner && A.tensioner.hubDirDeg)
  } : null;

  // KAPILAR — çözüm anında yazılan R.checks (yeniden hesaplanmaz).
  var kapilar = _fpnKapilar(R, kod);

  var d0 = (node && node.data) || {};
  var sd = (b.solver && b.solver.data) || {};
  var motor = '';
  if(sd.engineLib && typeof veFeadEngineOf === 'function'){
    var e = veFeadEngineOf(sd.engineLib);
    if(e && e.ad) motor = String(e.ad);
  }
  if(!motor && _frNum(sd.cylinders) > 0) motor = _frF(sd.cylinders, 0) + ' silindir';

  return {
    n: n, kod: kod, kas: kas, acik: acik, cev: cev, aks: aks.map(function(k){ return kod[k]; }),
    kayisVeri: kayisVeri, gerilme: gerilme, nMax: nMax,
    servis: sv,
    // Sürtünme: çözümün dondurduğu seçim (`R.surtunme`), ayrıntılı raporun
    // okuyucusundan — seçim sonradan değişse de belge çözümünkini basar.
    surtunme: _frKaymaKosul(R).s,
    kpi: {
      Lb: boy ? _frNum(boy.db) : _frNum(sys.belt && sys.belt.effLength),
      Lw: boy ? _frNum(boy.dw) : NaN,
      Td: Td, rel: _frNum(A.meanRelDeg),
      sf: st.anyLoaded ? st.loadedMin : NaN,
      sfKod: st.anyLoaded ? kod[adSira[st.loadedName]] : '', sfRpm: st.anyLoaded ? _frNum(st.loadedRpm) : NaN,
      b10: life ? (life.inValidRange ? _frNum(life.hoursB10)
                   : (Number.isFinite(_frNum(life.hoursB10Corrected)) ? _frNum(life.hoursB10Corrected) : _frNum(life.hoursB10))) : NaN,
      b10Ham: life ? _frNum(life.hoursB10) : NaN,
      b10Pencere: life ? !!life.inValidRange : null,
      baskin: bask ? { kod: bask.kod, pay: bask.omurPay } : null,
      hub: hubEn ? { F: hubEn.flDin, kod: hubEn.kod, yon: hubEn.flDinYon, rpm: hubEn.flDinRpm } : null,
      rez: rez
    },
    kayis: {
      marka: (sys.belt && sys.belt.brand) || '', tip: (sys.belt && sys.belt.beltType) || '',
      profil: (sys.belt && sys.belt.profile) || '', kaburga: _frNum(sys.belt && sys.belt.ribs),
      Lb: boy ? _frNum(boy.db) : _frNum(sys.belt && sys.belt.effLength),
      gereken: _frNum(A.requiredBeltMm), Lw: boy ? _frNum(boy.dw) : NaN, edl: _frNum(A.driveLenMm),
      m: _frNum(sys.belt && sys.belt.massPerRibKgM) * (_frNum(sys.belt && sys.belt.ribs) || 1),
      v: vTepe, fB: fB, nTepe: nMax,
      P: enBuyuk('P'), Fu: enBuyuk('Fu'),
      esik: esik && Number.isFinite(_frNum(esik.tensionN)) ? { T: _frNum(esik.tensionN), pay: _frNum(esik.margin) } : null,
      Fstat: Td
    },
    gergi: gergi,
    tepe: pk ? { rpm: pk.engineRpm, ivme: pk.accelRpmS,
                 T: pk.rows.map(function(r){ return r.tensionN; }),
                 F: pk.rows.map(function(r){ return r.hubloadN; }) } : null,
    kapilar: kapilar,
    kunye: {
      proje: (typeof veProjeAdi === 'function') ? veProjeAdi() : '',
      kayis: [(sys.belt && sys.belt.brand) || '', (sys.belt && sys.belt.beltType) || ''].join(' ').trim(),
      motor: motor, cozum: _frNum(R.solvedAt),
      hazirlayan: d0.author ? String(d0.author) : '',
      dokuman: d0.docNo ? String(d0.docNo) : '', rev: d0.revision ? String(d0.revision) : ''
    }
  };
}

// ─── UYGUNLUK KAPILARI — R.checks'ten, sonuç cümlesiyle ─────────────────────
// Üç kapı (devir sınırı · merkez mesafesi · çevrim oranı), her biri en
// kritik satırıyla. Durum kapının KENDİ hükmü: 'ok' · 'warn' · 'no' · 'wait'.
function _fpnKapilar(R, kod){
  var K = R && R.checks;
  var bos = function(ad){ return { ad: ad, durum: 'wait', metin: 'çözümde kapı yok' }; };
  if(!K) return [bos('Devir sınırı'), bos('Merkez mesafesi'), bos('Çevrim oranı')];
  // Bekleme cümleleri KISA: satır 461 px'lik sütunda tek satır (kapının kendi
  // notu 86–99 karakter, sütuna 75 sığıyor — ölçüldü, kesiliyordu).
  var out = [];
  // DEVİR SINIRI — en az paylı satırın kritik noktası
  var sl = K.speedLimit || {}, slr = null;
  (sl.rows || []).forEach(function(r){ if(!slr || r.payPct < slr.payPct) slr = r; });
  if(slr && slr.kritik){
    var p = slr.kritik;
    var tem = (kod[slr.i] || slr.ad) + ' ' + _frF(p.accRpm, 0) + (p.ok ? ' ≤ ' : ' > ') + _frF(p.limit, 0) + ' d/d';
    out.push({ ad: 'Devir sınırı', durum: sl.durum || 'wait',
      metin: (sl.durum === 'wait' && slr.eksik && slr.eksik.length)
        ? tem + '; ' + slr.eksik.join(', ') + ' girilmedi'
        : tem + ' · ' + p.ad + ' (' + _frPct(p.payPct, 1) + ')' });
  } else out.push({ ad: 'Devir sınırı', durum: sl.durum || 'wait', metin: 'sınırı bilinen aksesuar ya da motor devri yok' });
  // MERKEZ MESAFESİ — en dar çift
  var cd = K.centerDistance || {}, w = cd.worst;
  if(w){
    var ad = (kod[w.i] || w.adI) + ' – ' + (kod[w.j] || w.adJ);
    out.push({ ad: 'Merkez mesafesi', durum: cd.durum || 'wait',
      metin: w.ok ? ad + ' ' + _frF(w.a, 1) + ' mm, en dar pay ' + _frPct(w.payPct, 1)
        : ad + ' ' + _frF(w.a, 1) + (w.a > w.hi ? ' > ' + _frF(w.hi, 1) : ' < ' + _frF(w.lo, 1)) + ' mm' });
  } else out.push({ ad: 'Merkez mesafesi', durum: cd.durum || 'wait', metin: 'geometri çözülmedi' });
  // ÇEVRİM ORANI — önce ihlal, yoksa en dar pay
  var rw = K.ratioWindow || {}, rr = null;
  (rw.rows || []).forEach(function(r){
    if(!rr || (!r.ok && rr.ok) || (r.ok === rr.ok && r.payPct < rr.payPct)) rr = r;
  });
  if(rr){
    var kd = kod[rr.i] || rr.ad;
    out.push({ ad: 'Çevrim oranı', durum: rw.durum || 'wait',
      metin: rr.verdict === 'kucult' ? kd + ' ' + _frF(rr.accRpm, 0) + ' < ' + _frF(rr.optimumRpm, 0) + ' d/d: çap küçültülmeli'
        : rr.verdict === 'buyut' ? kd + ' ' + _frF(rr.accRpm, 0) + ' > ' + _frF(rr.maxContRpm, 0) + ' d/d: çap büyütülmeli'
        : kd + ' ' + _frF(rr.accRpm, 0) + ' d/d bantta (' + _frPct(rr.payPct, 1) + ')' });
  } else out.push({ ad: 'Çevrim oranı', durum: rw.durum || 'wait',
    metin: (_frNum(rw.governedRpm) > 0) ? 'devir penceresi bilinen aksesuar yok' : 'motorun governed devri girilmedi' });
  return out;
}

// ═══════════════════ SAYFA ÖLÇÜSÜ — sütunların bütçesi ══════════════════════
// Orta sütun satır sayısıyla büyür (kasnak · açıklık · çevrim); satır boyu
// sayfaya sığacak kadar daralır, tabanın altına inmez. Taban 17 px: 10 pt
// yazı × 1,15 satır aralığı + çizgi = 16,33 px (ölçüldü) — 16 px'lik satır
// içeriğine uzuyor ve 34 satırda 11 px birikiyordu. Sığmayan model için sayfa
// uzar (`tasma`, ikinci A3 sayfası): kırpılan tablo sessiz bir kayıp olurdu.
function _fpnOlcu(V){
  var P = VE_FEAD_PANO, G = _fpnGovdeH();
  var n = V.n, m = V.cev.length;
  var sabit = 4 * P.BASLIK + 3 * P.TH + P.TH_TEK + 3 * P.BLOK + P.SATIR   // + tepe notu
            + 4 * P.TABLO_ALT;
  var satirN = 2 * n + m + 2;
  var ham = Math.floor((G - sabit) / Math.max(1, satirN));
  var sat = Math.max(P.SATIR_EN_AZ, Math.min(P.SATIR, ham));
  var tasma = (sabit + satirN * sat) > G;
  // Sol sütun: çizim kutusu kalan yeri alır (iki künye tablosu 9 + 4 satır).
  var solSabit = 3 * P.BASLIK + 2 * P.BLOK + (9 + 4) * P.SATIR + 2 * P.TABLO_ALT;
  var cizimH = Math.floor(G - solSabit);
  return { govde: G, sat: sat, tasma: tasma, cizimW: P.SUTUN[0], cizimH: cizimH };
}

// ═══════════════════ ÇİZİM VE GRAFİKLER ══════════════════════════════════════
// Kayış yolu — kanvas kartının çizicisi. Çizim kutunun 1/k ölçüsünde kurulur,
// viewBox k kat büyütür (kartın yazı kuralı, kural 21): k tabanın çizicinin
// taban yazısına oranı, yani kasnak adı tam 10 pt basılır.
function _fpnCizim(R, V, kutuW, kutuH){
  if(typeof veFeadLayoutSVG !== 'function') return '';
  var k = VE_FEAD_PANO.TABAN / VE_FEAD_PANO.CIZIM_YAZI;
  var svg = null;
  try {
    svg = veFeadLayoutSVG(R.build, kutuW / k, kutuH / k, {
      posMode: 'mean', compass: true, pivot: true, arrows: true, ghostLabels: false,
      wrapLabels: true, inline: true, kunye: false, names: V.kod,
      tension: V.gerilme || undefined });
  } catch(e){ svg = null; }
  return svg ? _fpnTaban(svg, k) : '';
}

// Ayrıntılı raporun grafiği, verilen kutuya ve tabana. viewBox'ın boyu
// ölçeği belirler: kayma grafiği boyunu satır sayısından kendi kurar.
function _fpnGrafik(fn, R, W, H, extra, ayar){
  if(typeof veFeadFigureRaw !== 'function' || typeof fn !== 'function') return null;
  var s = veFeadFigureRaw(fn, R, W, H, extra, ayar);
  if(!s) return null;
  var vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(s);
  return { svg: s, W: vb ? parseFloat(vb[1]) : W, H: vb ? parseFloat(vb[2]) : H };
}

// ═══════════════════ HTML ═══════════════════════════════════════════════════
function _fpnSub(a, b){ return a + '<sub>' + b + '</sub>'; }
function _fpnTd(v, cls){ return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td>'; }
function _fpnTh(v, birim, cls){
  return '<th' + (cls ? ' class="' + cls + '"' : '') + '>' + v + (birim ? '<i>' + birim + '</i>' : '') + '</th>';
}
function _fpnCol(gen){ return '<colgroup>' + gen.map(function(w){ return '<col style="width:' + w + 'px">'; }).join('') + '</colgroup>'; }
function _fpnH2(baslik, alt){ return '<h2>' + baslik + (alt ? '<small>' + alt + '</small>' : '') + '</h2>'; }
function _fpnXY(p){
  return (p && p.length >= 2) ? '(' + _frFs(p[0], 1) + '; ' + _frFs(p[1], 1) + ')' : '—';
}
// Hüküm işareti — belgenin gövdesi tipografik işaret taşır (ikon-dili: BELGE).
var VE_FEAD_PANO_ISARET = { ok: '✓', warn: '⚠', no: '✗', wait: '–' };

function _fpnKpi(durum, etiket, deger, alt){
  return '<div class="kpi" data-d="' + durum + '"><span class="k">' + etiket + '</span><b>' + deger
    + '</b><span class="s">' + alt + '</span></div>';
}

function _fpnKpiler(V){
  var K = V.kpi, sv = V.servis, h = '<div class="kpis">';
  h += _fpnKpi('n', 'Kayış boyu ' + _fpnSub('L', 'b'), _frFs(K.Lb, 1) + '<small>mm</small>',
    _frEsc(V.kayis.tip || '—') + (Number.isFinite(K.Lw) ? ' · kord ' + _frFs(K.Lw, 1) : ''));
  h += _fpnKpi('n', 'Tasarım gerginliği', _frFs(K.Td, 1) + '<small>N</small>',
    'yay dengesi · kol ' + _frFs(K.rel, 2) + '°');
  var sfDurum = Number.isFinite(K.sf) ? (K.sf >= 1 ? 'ok' : 'no') : 'wait';
  h += _fpnKpi(sfDurum, 'Kayma emniyeti (min)', Number.isFinite(K.sf) ? _frSfYaz(K.sf) : '—',
    (Number.isFinite(K.sf) ? _frEsc(K.sfKod) + ' @' + _frF(K.sfRpm, 0) + ' d/d<br>' : '')
    + 'istenen ≥ 1 · ' + (sv.secili ? 'c₂ = ' + _frEsc(sv.yaz) : 'c₂ seçilmedi'));
  h += _fpnKpi(K.b10Pencere === false ? 'warn' : 'n', 'B10 ömrü',
    Number.isFinite(K.b10) ? _frF(K.b10, 0) + '<small>h</small>' : '—',
    !V.kayisVeri ? 'kayış verisi kapalı'
      : (K.b10Pencere === false ? 'düzeltmeli · ham ' + _frF(K.b10Ham, 0) + ' h' : 'çap penceresi içinde')
        + (K.baskin ? '<br>baskın ' + _frEsc(K.baskin.kod) + ' ' + _frPct(K.baskin.pay, 1) : ''));
  h += _fpnKpi('n', 'Maks. hubload', K.hub ? _frF(K.hub.F, 0) + '<small>N</small>' : '—',
    K.hub ? _frEsc(K.hub.kod) + ' · ' + _frF(K.hub.yon, 0) + '° · @' + _frF(K.hub.rpm, 0) + ' d/d' : '');
  var rz = K.rez;
  h += _fpnKpi(rz ? (rz.alti > 0 ? 'no' : 'ok') : 'wait', 'Rezonans ' + _fpnSub('f', '1') + '/' + _fpnSub('f', 'ateş'),
    rz ? _frFs(rz.oran, 2) : '—',
    rz ? _frEsc(rz.ad) + ' @' + _frF(rz.rpm, 0) + ' d/d<br>' + rz.alti + ' / ' + rz.hucre + ' hücre 1\'in altında'
       : (V.kayisVeri ? 'açıklık frekansı yok' : 'kayış verisi kapalı'));
  var say = { ok: 0, warn: 0, no: 0, wait: 0 };
  V.kapilar.forEach(function(k){ say[say[k.durum] !== undefined ? k.durum : 'wait']++; });
  var enKotu = say.no ? 'no' : (say.warn ? 'warn' : (say.wait ? 'wait' : 'ok'));
  var sayi = ['ok', 'warn', 'no', 'wait'].filter(function(d){ return say[d] > 0; }).map(function(d){
    return '<span class="' + d + '">' + say[d] + ' ' + VE_FEAD_PANO_ISARET[d] + '</span>'; }).join(' ');
  h += _fpnKpi(enKotu, 'Uygunluk kapıları', sayi || '—', 'devir sınırı · çevrim oranı<br>merkez mesafesi');
  return h + '</div>';
}

function _fpnKayisVerileri(V){
  var k = V.kayis, P = k.P, Fu = k.Fu;
  var sat = [
    ['Kayış · profil · kaburga', _frEsc([k.marka, k.tip].join(' ').trim() || '—') + ' · ' + _frEsc(k.profil || '—') + ' · ' + _frF(k.kaburga, 0)],
    ['Seçilen / gereken boy ' + _fpnSub('L', 'b'), _frFs(k.Lb, 1) + ' / ' + _frFs(k.gereken, 1) + ' mm'],
    ['Kord boyu ' + _fpnSub('L', 'w') + ' · tahrik boyu EDL', _frFs(k.Lw, 1) + ' · ' + _frFs(k.edl, 1) + ' mm'],
    ['Birim kütle m′', _frFs(k.m, 3) + ' kg/m'],
    ['Kayış hızı v · eğilme ' + _fpnSub('f', 'B') + ' @' + _frF(k.nTepe, 0), _frFs(k.v, 2) + ' m/s · ' + _frFs(k.fB, 1) + ' Hz'],
    ['İletilen güç P (maks)', P ? _frFs(P.P, 2) + ' kW @' + _frF(P.rpm, 0) : '—'],
    ['Etkin çekme ' + _fpnSub('F', 'u') + ' (maks)', Fu ? _frF(Fu.Fu, 0) + ' N @' + _frF(Fu.rpm, 0) : '—'],
    ['Kayma eşiği (ankraj) · pay', k.esik ? _frFs(k.esik.T, 1) + ' N · ' + _frFs(k.esik.pay, 2) + '×' : '—'],
    ['Sürtünme μ: ' + _frEsc(V.surtunme ? V.surtunme.ad : '—'), _fpnSurtunmeYaz(V.surtunme)]
  ];
  // Değer sütunu 240 (içi 232 px): Elle'nin en uzun hâli "oluklu 2,95 ·
  // sırt 2,95 · ℓ 19,5 mm" 224,4 px; etiketin en uzunu "Sürtünme μ: Gates
  // kalibrasyonu" 215,3 px, sütunu 252 (ölçüldü; 230'luk sütunda Elle kesiliyordu).
  return '<table class="kv">' + _fpnCol([260, 240]) + sat.map(function(r){
    return '<tr><td class="l e">' + r[0] + '</td><td class="v">' + r[1] + '</td></tr>'; }).join('') + '</table>';
}

// Sürtünme seçiminin sayıları, arayüzün adlarıyla (Oluklu μ · Sırt μ ·
// küçük kasnak kaybı — ayrıntılı raporun ℓ'si, 5.7a); kayıp yoksa yazılmaz.
function _fpnSurtunmeYaz(s){
  if(!s) return '—';
  return 'oluklu ' + _frFs(s.muOluk, 2) + ' · sırt ' + _frFs(s.muSirt, 2)
    + (s.kayipMm > 0 ? ' · ℓ ' + _frF(s.kayipMm, 1) + ' mm' : '');
}

function _fpnGergi(V){
  var g = V.gergi;
  if(!g) return '<p class="not">Modelde otomatik gergi yok.</p>';
  var sat = [
    ['Parça', _frEsc(g.parca || '—'), 'Kol boyu a', _frF(g.kol, 0) + ' mm'],
    ['Yay', _frFs(g.M0, 2) + ' + ' + _frFs(g.k, 3) + ' Nm/°', 'Pivot', _fpnXY(g.pivot)],
    ['Kol açısı ' + _fpnSub('A', 's'), _frFs(g.abs, 1) + '° (' + _frFs(g.rel, 2) + '°)', 'Avara', _fpnXY(g.avara)],
    ['Take-up', _frFs(g.takeup, 3) + ' mm/°', 'Göbek yükü', _frFs(g.FL, 1) + ' N · ' + _frFs(g.FLyon, 1) + '°']
  ];
  return '<table class="kv">' + _fpnCol([108, 142, 106, 144]) + sat.map(function(r){
    return '<tr><td class="l e">' + r[0] + '</td><td class="v">' + r[1] + '</td><td class="l e ic">' + r[2]
      + '</td><td class="v">' + r[3] + '</td></tr>'; }).join('') + '</table>';
}

function _fpnKasnaklar(V){
  var h = '<table>' + _fpnCol([50, 54, 48, 58, 56, 56, 56, 38, 48, 42]);
  h += '<tr>' + _fpnTh('Kod', '', 'l') + _fpnTh('β', '[°]') + _fpnTh('i', '[–]') + _fpnTh('n maks', '[d/d]')
    + _fpnTh('P maks', '[kW]') + _fpnTh(_fpnSub('F', 'L,stat'), '[N]') + _fpnTh(_fpnSub('F', 'L,din'), '[N]')
    + _fpnTh('Yön', '[°]') + _fpnTh('SF', 'min') + _fpnTh('Ömür', '[%]') + '</tr>';
  V.kas.forEach(function(k){
    h += '<tr' + (k.yuklu ? '' : ' class="idle"') + '>' + _fpnTd('<b>' + _frEsc(k.kod) + '</b>', 'l')
      + _fpnTd(_frFs(k.beta, 2)) + _fpnTd(_frFs(k.oran, 3)) + _fpnTd(_frF(k.nMax, 0)) + _fpnTd(_frFs(k.pMax, 2))
      + _fpnTd(_frF(k.flStat, 0)) + _fpnTd(_frF(k.flDin, 0)) + _fpnTd(_frF(k.flDinYon, 0))
      + _fpnTd((!k.yuklu || !(k.sfMin < 1)) ? _frSfYaz(k.sfMin) : '<span class="no">' + _frSfYaz(k.sfMin) + '</span>', 'sf')
      + _fpnTd(_frFs(k.omurPay, 1)) + '</tr>';
  });
  return h + '</table>';
}

function _fpnAciklar(V){
  var h = '<table>' + _fpnCol([130, 66, 66, 64, 80, 100]);
  h += '<tr>' + _fpnTh('Açıklık', '', 'l') + _fpnTh(_fpnSub('L', 'f'), '[mm]') + _fpnTh(_fpnSub('f', 'stat'), '[Hz]')
    + _fpnTh(_fpnSub('T', 'maks'), '[N]') + _fpnTh(_fpnSub('f', '1') + ' min', '[Hz]')
    + _fpnTh(_fpnSub('f', '1') + ' / ' + _fpnSub('f', 'ateş'), 'min') + '</tr>';
  V.acik.forEach(function(a){
    h += '<tr>' + _fpnTd(_frEsc(a.ad), 'l') + _fpnTd(_frFs(a.Lf, 2)) + _fpnTd(_frFs(a.fStat, 1))
      + _fpnTd(_frF(a.tMax, 0)) + _fpnTd(_frFs(a.f1Min, 1))
      + _fpnTd(a.oranMin < 1 ? '<span class="no">' + _frFs(a.oranMin, 2) + '</span>' : _frFs(a.oranMin, 2)) + '</tr>';
  });
  return h + '</table>';
}

// ÇEVRİM TABLOSU — sütun bütçesi 506 px. Aksesuar sütunu sayısı modelden
// gelir; sığmazsa önce kayış hızı (tabloda değil künyede de var), sonra
// aksesuar sütunları düşer — toplam güç P her durumda kalır.
function _fpnCevrim(V){
  var W = VE_FEAD_PANO.SUTUN[1], sabit = 52 + 50, oranW = 68;
  var aks = V.aks.slice(), vVar = true;
  var gen = function(){ return (W - sabit - oranW) / (aks.length + (vVar ? 4 : 3)); };
  if(gen() < 44) vVar = false;
  if(gen() < 44) aks = [];
  var w = Math.floor(gen());
  var cols = [52, 50].concat(aks.map(function(){ return w; }), [w], vVar ? [w] : [], [w, w], [W - sabit - (aks.length + (vVar ? 4 : 3)) * w]);
  var h = '<table class="cev">' + _fpnCol(cols);
  h += '<tr>' + _fpnTh('n', '[d/d]') + _fpnTh('DC', '[%]')
    + aks.map(function(k){ return _fpnTh(_frEsc(k), '[kW]'); }).join('')
    + _fpnTh('P', '[kW]') + (vVar ? _fpnTh('v', '[m/s]') : '') + _fpnTh(_fpnSub('F', 'u'), '[N]')
    + _fpnTh('SF', 'min') + _fpnTh(_fpnSub('f', '1') + '/' + _fpnSub('f', 'ateş'), 'min') + '</tr>';
  V.cev.forEach(function(c){
    h += '<tr>' + _fpnTd(_frF(c.rpm, 0)) + _fpnTd(_frFs(c.dc, 1))
      + (aks.length ? c.kw.map(function(x){ return _fpnTd(_frFs(x, 2)); }).join('') : '')
      + _fpnTd(_frFs(c.P, 2)) + (vVar ? _fpnTd(_frFs(c.v, 2)) : '') + _fpnTd(_frF(c.Fu, 0))
      + _fpnTd(c.sf < 1 ? '<span class="no">' + _frSfYaz(c.sf) + '</span>' : _frSfYaz(c.sf))
      + _fpnTd(c.oran < 1 ? '<span class="no">' + _frFs(c.oran, 2) + '</span>' : _frFs(c.oran, 2)) + '</tr>';
  });
  return h + '</table>';
}

function _fpnTepe(V){
  var t = V.tepe;
  if(!t) return '<p class="not">Tepe yük hesaplanamadı.</p>';
  var W = VE_FEAD_PANO.SUTUN[1], ilk = 110, w = Math.floor((W - ilk) / Math.max(1, V.n));
  var cols = [W - V.n * w].concat(V.kod.map(function(){ return w; }));
  var h = '<table>' + _fpnCol(cols);
  h += '<tr class="tk"><th class="l e">±' + _frF(t.ivme, 0) + ' d/d/s</th>'
    + V.kod.map(function(k){ return '<th>' + _frEsc(k) + '</th>'; }).join('') + '</tr>';
  h += '<tr>' + _fpnTd(_fpnSub('T', 'tepe') + ' [N]', 'l') + t.T.map(function(x){ return _fpnTd(_frF(x, 0)); }).join('') + '</tr>';
  h += '<tr>' + _fpnTd(_fpnSub('F', 'L,tepe') + ' [N]', 'l') + t.F.map(function(x){ return _fpnTd(_frF(x, 0)); }).join('') + '</tr>';
  return h + '</table><p class="not">Yatak ve braket seçiminde tek başına kullanılmamalı.</p>';
}

function _fpnKapiListe(V){
  return '<div class="kp">' + V.kapilar.map(function(k){
    return '<div><b class="' + k.durum + '">' + (VE_FEAD_PANO_ISARET[k.durum] || '–') + '</b><span>'
      + _frEsc(k.ad) + ' — ' + _frEsc(k.metin) + '</span></div>';
  }).join('') + '</div>';
}

function _fpnTarih(ms){
  if(!(ms > 0)) return '—';
  var d = new Date(ms);
  var p = function(x){ return (x < 10 ? '0' : '') + x; };
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// Sayfanın gövdesi — üç sütun. Ölçüler `_fpnOlcu`'dan; grafik kutuları sağ
// sütunun kalanından.
function _fpnSayfa(R, V){
  var P = VE_FEAD_PANO, O = _fpnOlcu(V), k = V.kunye, sv = V.servis;
  var baslik = k.proje || 'Aksesuar kayış tahrik sistemi';
  var alt = (k.proje ? 'Aksesuar kayış tahrik sistemi · ' : 'MFSim · FEAD · ') + 'A3 sonuç panosu';
  var dok = (k.dokuman || '—') + (k.rev ? ' · rev ' + k.rev : '');

  var h = '<section class="pn' + (O.tasma ? ' tasma' : '') + '" style="--sat:' + O.sat + 'px">';
  h += '<div class="ust"><div class="ad"><span>' + _frEsc(alt) + '</span><b>' + _frEsc(baslik) + '</b></div>'
    + '<div class="kn"><span><i>Kayış</i>' + _frEsc(k.kayis || '—') + '</span><span><i>Motor</i>' + _frEsc(k.motor || '—')
    + '</span><span><i>Çözüm</i>' + _frEsc(_fpnTarih(k.cozum)) + '</span><span><i>Hazırlayan</i>' + _frEsc(k.hazirlayan || '—')
    + '</span><span><i>Doküman</i>' + _frEsc(dok) + '</span><span><i>Sayfa</i>1 / 1</span></div></div>';
  h += '<div class="cz"></div>';
  h += _fpnKpiler(V);

  // ── SOL: kayış yolu · kayış verileri · gergi
  var gerAlt = V.gerilme ? 'açıklık gerilmesi · ' + _frF(V.gerilme.engineRpm, 0) + ' d/d' : 'kasnak kodları';
  var cizim = _fpnCizim(R, V, O.cizimW, O.cizimH);
  h += '<div class="govde"' + (O.tasma ? '' : ' style="height:' + O.govde + 'px"') + '>';
  h += '<div class="sut">'
    + '<div>' + _fpnH2('Kayış Yolu', gerAlt)
    + '<div class="cizim" style="height:' + O.cizimH + 'px">' + (cizim || '<p class="not">Kayış yolu çizilemedi.</p>') + '</div></div>'
    + '<div>' + _fpnH2('Kayış verileri') + _fpnKayisVerileri(V) + '</div>'
    + '<div>' + _fpnH2('Gergi', V.gergi && V.gergi.kunye ? _frEsc(V.gergi.kunye) : '') + _fpnGergi(V) + '</div>'
    + '</div>';

  // ── ORTA: kasnaklar · açıklıklar · çevrim · tepe yük
  var dcTop = 0;
  V.cev.forEach(function(c){ dcTop += Number.isFinite(c.dc) ? c.dc : 0; });
  h += '<div class="sut orta">'
    + '<div>' + _fpnH2('Kasnaklar', _fpnSub('F', 'L,din') + ': çevrimde en büyük') + _fpnKasnaklar(V) + '</div>'
    + '<div>' + _fpnH2('Açıklıklar', _fpnSub('F', 'stat') + ' = ' + _frFs(V.kayis.Fstat, 1) + ' N') + _fpnAciklar(V) + '</div>'
    + '<div>' + _fpnH2('Çalışma çevrimi', V.cev.length + ' nokta · ' + _frPct(dcTop, 0)) + _fpnCevrim(V) + '</div>'
    + '<div><h2>Tepe yük<span class="dmg">kalibre değil</span><small>'
    + (V.tepe ? _frF(V.tepe.rpm, 0) + ' d/d · sapma ' + (typeof VE_FSR_PEAK_BAND === 'string' ? VE_FSR_PEAK_BAND : '—') : '')
    + '</small></h2>' + _fpnTepe(V) + '</div>'
    + '</div>';

  // ── SAĞ: üç grafik + kapılar. Kayma grafiği boyunu satırından kurar;
  // gerginlik ve frekans grafikleri kalan yeri paylaşır.
  var sagW = P.SUTUN[2];
  var kay = _fpnGrafik(typeof _frSlipFigure === 'function' ? _frSlipFigure : null, R, P.KAYMA_W, 200, 1);
  var kayH = kay ? Math.round(kay.H * sagW / kay.W) : 21;
  var kapiH = V.kapilar.length * P.SATIR;
  var frekVar = V.kayisVeri && V.acik.some(function(a){ return Number.isFinite(a.f1Min); });
  var kalan = O.govde - 4 * P.BASLIK - 3 * P.BLOK - kayH - kapiH - (frekVar ? 0 : P.SATIR);
  var olcekG = sagW / P.GRAFIK_W;
  var gerH = frekVar ? Math.floor(kalan / 2) : kalan;
  var ger = _fpnGrafik(typeof _frTensionFigure === 'function' ? _frTensionFigure : null, R, P.GRAFIK_W, gerH / olcekG);
  var frk = frekVar ? _fpnGrafik(typeof _frFreqFigure === 'function' ? _frFreqFigure : null, R, P.GRAFIK_W,
    (kalan - gerH) / olcekG, undefined, { xEtiketAdim: 2 }) : null;
  var kutu = function(g, H){
    if(!g) return '<p class="not">Grafik çizilemedi.</p>';
    return '<div class="graf" style="height:' + H + 'px">' + _fpnTaban(g.svg, sagW / g.W) + '</div>';
  };
  h += '<div class="sut">'
    + '<div>' + _fpnH2('Gerginlik kontrol eğrisi', 'kol açısı → T') + kutu(ger, gerH) + '</div>'
    + '<div>' + _fpnH2('Doğal frekans haritası', 'açıklık ' + _fpnSub('f', '1') + ' · ateşleme katları')
    + (frekVar ? kutu(frk, kalan - gerH) : '<p class="not">Kayış verisi kapalı — açıklık frekansı üretilmedi.</p>') + '</div>'
    + '<div>' + _fpnH2('Kayma emniyeti', 'en kötü koşul · '
        + (sv.secili ? 'tasarım yükü · c₂ = ' + _frEsc(sv.yaz) : 'soluk: yük taşımaz'))
    + kutu(kay, kayH) + '</div>'
    + '<div>' + _fpnH2('Uygunluk kapıları') + _fpnKapiListe(V) + '</div>'
    + '</div>';
  h += '</div></section>';
  return h;
}

// ═══════════════════ BELGE MONTAJI ══════════════════════════════════════════
function veFeadPanoHTML(R, node){
  var V = veFeadPanoVeri(R, node);
  if(!V) throw new Error('Çözüm yok — A3 pano çözümden üretilir.');
  // Yüz ARAYÜZÜN kendi @font-face kurallarından (js/theme.js) — öteki iki
  // belgeyle aynı: ekran ve kâğıt aynı aileyle yazar.
  var fonts = (typeof veThemeFontFaceCss === 'function') ? veThemeFontFaceCss() : '';
  return '<!DOCTYPE html>\n<html lang="tr"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<title>FEAD — A3 sonuç panosu</title>'
    + '<style>' + fonts + '</style><style>' + _fpnCss() + '</style>'
    + '</head><body>' + _fpnSayfa(R, V) + '</body></html>';
}

// ─── GÖRÜNÜM ─────────────────────────────────────────────────────────────────
// Punto ölçeği dört basamak ve TEK yerde: gövde 10 pt, başlık 11 pt, sayfa
// adı 20 pt, gösterge 22 pt. Mürekkep ekranın --ink-* jetonlarıyla birebir
// (belge-paleti kapısı); kâğıt beyaz. Çizicinin jetonları `.pn` üstünde —
// tanımsız var() kalıtılan `stroke` için `none` demek, çizim görünmez olurdu.
function _fpnCss(){
  var P = VE_FEAD_PANO;
  return [
    ':root{',
    '  --ink:#26241f;--vurgu:#96441f;--check:#2a6140;--warn:#6d5310;--bad:#a8321f;',
    '  --dim:#4a525e;--ink2:#3c4350;--paper:#ffffff;--line:#c6c0b4;--rule:#9c9486;--soft:#e6e1d8;',
    '  --f-govde:13.333px;--f-h:14.667px;--f-ad:26.667px;--f-kpi:29.333px;--f-alt:.72em;',
    "  --yuz:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;",
    '}',
    '*{box-sizing:border-box}',
    'b,strong{font-weight:600}',
    'body{margin:0;background:#8d9199;color:var(--ink);font-family:var(--yuz);font-size:var(--f-govde);',
    '  line-height:1.25;-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.pn{position:relative;width:' + P.W + 'px;height:' + P.H + 'px;padding:' + P.PAY + 'px;margin:24px auto;',
    '  background:var(--paper);box-shadow:0 2px 14px rgba(0,0,0,.25);overflow:hidden;font-variant-numeric:tabular-nums;',
    '  --accent-primary:#96441f;--accent-success:#2a6140;--accent-warning:#c8781e;--accent-danger:#a8321f;',
    '  --ink-warning:#6d5310;--ink-success:#2a6140;--text-primary:#26241f;--text-secondary:#3c4350;',
    '  --text-muted:#4a525e;--bg-input:#ffffff;--on-accent:#ffffff;--border-color:#c6c0b4;',
    '  --radius-sm:2px;--fs-tiny:11px;--fs-micro:10px}',
    '.pn.tasma{height:auto;min-height:' + P.H + 'px;overflow:visible}',
    '.pn .ust{height:' + P.UST + 'px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px}',
    '.pn .ust .ad{display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.pn .ust .ad span{color:var(--dim)}',
    '.pn .ust .ad b{font-size:var(--f-ad);font-weight:600;letter-spacing:-.01em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn .ust .kn{display:grid;grid-template-columns:auto auto auto;column-gap:22px;row-gap:3px;flex:none}',
    '.pn .ust .kn span{white-space:nowrap}',
    '.pn .ust .kn i{font-style:normal;color:var(--dim);margin-right:6px}',
    '.pn .cz{height:2px;margin-top:6px;background:var(--ink)}',
    '.pn .kpis{height:' + P.KPI + 'px;margin-top:12px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px}',
    '.pn .kpi{border:1px solid var(--line);border-top:4px solid var(--rule);padding:7px 10px 6px;display:flex;flex-direction:column;gap:1px;min-width:0;overflow:hidden}',
    '.pn .kpi[data-d="ok"]{border-top-color:var(--check)}',
    '.pn .kpi[data-d="warn"]{border-top-color:var(--warn)}',
    '.pn .kpi[data-d="no"]{border-top-color:var(--bad)}',
    '.pn .kpi .k{color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn .kpi b{font-size:var(--f-kpi);font-weight:600;line-height:1.15;letter-spacing:-.01em;white-space:nowrap}',
    '.pn .kpi b small{font-size:var(--f-h);font-weight:500;margin-left:3px;color:var(--ink2)}',
    '.pn .kpi[data-d="no"] > b{color:var(--bad)}',
    '.pn .kpi .s{color:var(--dim);line-height:1.25}',
    '.pn .govde{margin-top:16px;display:grid;grid-template-columns:' + P.SUTUN.join('px ') + 'px;column-gap:' + P.ARA + 'px}',
    '.pn .sut{display:flex;flex-direction:column;gap:' + P.BLOK + 'px;min-width:0}',
    '.pn h2{height:' + (P.BASLIK - 4) + 'px;margin:0 0 4px;font-size:var(--f-h);font-weight:600;line-height:1.25;display:flex;',
    '  align-items:baseline;justify-content:space-between;gap:10px;padding-bottom:3px;border-bottom:1px solid var(--ink);white-space:nowrap}',
    '.pn h2 small{font-size:var(--f-govde);font-weight:400;color:var(--dim);margin-left:auto}',
    // Damga büyük harfle BASILIR ama küçük YAZILIR (özet raporun `.stamp`ı):
    // lang="tr" belgede i → İ doğru çevrilir, cümle düzeni kapısı metni okur.
    '.pn .dmg{display:inline-block;font-size:var(--f-govde);font-weight:600;letter-spacing:.04em;color:var(--warn);',
    '  border:1px solid var(--warn);padding:0 5px;line-height:17px;margin-left:8px;text-transform:uppercase}',
    '.pn table{border-collapse:collapse;width:100%;table-layout:fixed}',
    // Kesilen sayı sessizce YANLIŞ okunur ("30.900" → "30.9"); üç nokta
    // kesildiğini söyler. Örneklerde hiç kesilmiyor — kapı tarayıcıda ölçer.
    '.pn th,.pn td{padding:0 4px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn td{height:var(--sat);line-height:1.15;border-bottom:1px solid var(--soft)}',
    '.pn th{height:' + P.TH + 'px;font-weight:600;line-height:1.1;vertical-align:bottom;padding-bottom:3px;border-bottom:1px solid var(--rule)}',
    '.pn th i{display:block;font-style:normal;font-weight:400;color:var(--dim)}',
    '.pn tr.tk th{height:' + P.TH_TEK + 'px}',
    '.pn .l{text-align:left}',
    '.pn th.e{font-weight:400;color:var(--dim)}',
    '.pn tr.idle td.sf{color:var(--dim)}',
    '.pn .no{color:var(--bad);font-weight:600}',
    '.pn sub{font-size:var(--f-alt);line-height:0;vertical-align:-.25em}',
    '.pn .kv td{height:' + P.SATIR + 'px}',
    '.pn .kv td.e{color:var(--ink2)}',
    '.pn .kv td.ic{padding-left:14px}',
    '.pn .kv td.v{font-weight:500}',
    '.pn .cizim{position:relative;overflow:hidden}',
    '.pn .cizim svg{position:absolute;left:0;top:0;width:100%;height:100%}',
    '.pn .graf{overflow:hidden}',
    '.pn .graf svg{display:block;width:100%;height:100%}',
    '.pn svg text:not([fill="var(--on-accent)"]){paint-order:stroke;stroke:#ffffff;stroke-width:3px;stroke-linejoin:round}',
    '.pn .not{margin:0;height:' + P.SATIR + 'px;line-height:' + P.SATIR + 'px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn .kp div{display:flex;gap:8px;height:' + P.SATIR + 'px;align-items:center;white-space:nowrap;overflow:hidden}',
    '.pn .kp b{width:14px;flex:none;text-align:center}',
    '.pn .kp span{overflow:hidden;text-overflow:ellipsis}',
    '.pn .ok{color:var(--check)}.pn .warn{color:var(--warn)}.pn b.no,.pn span.no{color:var(--bad)}.pn .wait{color:var(--dim)}',
    '@page{size:A3 landscape;margin:0}',
    '@media print{body{background:var(--paper)}.pn{margin:0;box-shadow:none}}'
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_PANO: VE_FEAD_PANO,
    VE_FEAD_PANO_ISARET: VE_FEAD_PANO_ISARET,
    veFeadPanoVeri: veFeadPanoVeri,
    veFeadPanoHTML: veFeadPanoHTML,
    _fpnGovdeH: _fpnGovdeH,
    _fpnTaban: _fpnTaban,
    _fpnOlcu: _fpnOlcu,
    _fpnKapilar: _fpnKapilar,
    _fpnCss: _fpnCss
  };
}
