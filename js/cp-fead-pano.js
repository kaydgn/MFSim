// ============================================================================
// FEAD — A3 SONUÇ PANOSU (tek sayfa · yatay A3 · basılabilir · 8 pt)
// ============================================================================
// Kullanıcı kararları: 2026-09-29 tasarım tuvali "FEAD A3 rapor tasarımları"
// → "B · Pano"; baskıdan sonra (2026-09-30: *"yazı tipi biraz büyük olmuş ve
// raporda boş kalan yerler olmuş … Zengin ve dolu bir rapor olsun"*) aynı
// tuvalde "E · Dolu pano — 8 pt": gövde 8 pt, DÖRT sütun, dokuz gösterge.
// İçerik: kayış yolu · kasnak yerleşimi · açıklıklar · kayış · kasnaklar ·
// çalışma çevrimi (yorulma katkısıyla) · açıklık gerginlik ve kayma emniyeti
// ısı haritaları · gergi · kol zarfı · gerginlik eğrisi · motor çevrimi ·
// burulma modları · frekans haritası · hubload (oklu çizim + tablo) ·
// uygunluk (ayrıntılı raporun ölçütleri) · tasarım notları ve sınırlar.
//
// HESAP YOK. Her sayı ÇÖZÜMDEN (R) okunur ve üreticisi öteki iki belgeyle
// ORTAKTIR — iki belge aynı sayıyı farklı basamaz:
//   sayı biçimi  _frF · _frFs · _frPct · _frEsc · _frNum   (cp-fead-report.js)
//   kayma        _frSlipStats · _frSlipYuk · _frSfYaz · _frKaymaKosul — satırlar
//                Gates koşulunda ve TASARIM yükünde, yük taşıma ROLDEN, sürtünme
//                çözümün dondurduğu seçim (kural 48–49)
//   uygunluk     _frUygunlukSatirlari — ayrıntılı raporun ölçütleri, kısa yazımıyla
//   burulma      _frBurulmaKesisim — §8.18'in mertebe kesişmeleri
//   konumlar     R.analysis.positions + _frPosLabels (§8.8'in zarfı)
//   grafikler    _frTensionFigure · _frFreqFigure (veFeadFigureRaw)
//   tepe yük     _fsrPeak (cp-fead-summary.js) — KALİBRE DEĞİL damgasıyla
//   kapılar      R.checks — çözüm anında yazıldı, burada yeniden hesaplanmaz
//   mil torku    R.signals çevrim kümesi (Q = 9549·P/n, çözüm anında)
//   senaryo      R.signals senaryo kümesi — motor çevrimi grafiği onu çizer
//   çizim        veFeadLayoutSVG — Kayış Yolu kartının çizicisi (hubload
//                okları çizicinin `ek` katmanında, onun dönüşümüyle)
// Sayfanın kendi işi İNDİRGEMEDİR: çevrim boyunca en büyük / en küçük, hangi
// devirde, hangi kasnakta. Veri modeli (`veFeadPanoVeri`) HAM sayı taşır ve
// HTML yalnız biçimler: kapı her sayıyı çözümden bağımsız yeniden kurar.
//
// 8 PT TABAN. Gövde 10,667 px (A3'e %100 basımda 8 pt); birim satırı, alt
// başlık ve damga 7 pt. SVG yazısı viewBox ile ölçeklenir: çizim ve
// grafikler ölçeği HESAPLANAN kutularda durur ve taban yazı boyuna o ölçekle
// uygulanır (`_fpnTaban`). Tek istisna alt indis.
//
// YERLEŞİM ÖLÇÜMDEN. Bloklar okuma sırasıyla dört sütuna BİTİŞİK bölünür
// (`_fpnDizilim`): esnek bloklar (çizimler, grafikler) sütunun artanını
// alır, tablolar satır sayısıyla büyür. Ev sütunu tasarımın dizilişidir;
// küçük bir modelde sütun boş kalacağına blok komşu sütuna kayar. Hiçbir
// bölüm sığmazsa sayfa uzar (`tasma`) — kırpılan tablo sessiz bir kayıptır.
//
// Ad öneki `_fpn…` (`_fr…` ayrıntılı rapor, `_fsr…` özet rapor).
// ----------------------------------------------------------------------------

// SAYFA ÖLÇÜSÜ — A3 yatay, 96 dpi. 297 mm = 1.122,5 px: yükseklik 1.123
// yazılırsa taşan yarım piksel baskıda ikinci, boş bir sayfa açar.
// Blok boyları CSS'le BİREBİR (`_fpnCss`); sütun bütçesi buradan hesaplanır,
// çünkü SVG yazısının basılı boyu kutunun ölçeğine bağlı. Ayrışma sessizdir —
// kapı gerçek tarayıcıda ölçer.
var VE_FEAD_PANO = {
  W: 1587, H: 1122, PAY: 40,
  TABAN: 10.67,                     // 8 pt = 10,667 px, yuvarlama payıyla
  IKINCIL: 9.33,                    // 7 pt: birim satırı, alt başlık, damga
  SUTUN: [363, 363, 363, 364], ARA: 18,
  UST: 54, KPI: 73,                 // başlık bloğu · gösterge şeridi
  BLOK: 9, BASLIK: 21,              // bloklar arası · başlığın tam boyu (18 + 3)
  TH: 26,                           // tablo başlığı: ad + birim satırı
  TABLO_ALT: 0.5,                   // çöken kenarlığın tablonun altına taşan yarısı
  SATIR: 14,                        // 8 pt × 1,15 + çizgi = 13,27 px
  UZUN: [16, 17, 18, 19, 20, 15, 14], // çevrime bağlı üç tablonun satırı: tercih 16, kısa çevrimde büyür, uzunda daralır
  NOT: 14,                          // tek satırlık not
  MADDE: 13,                        // notlar listesinde bir satır
  NOT_EN_COK: 9,                    // notlar listesi en çok bu kadar satır
  CIZIM_YAZI: 9                     // çizicinin ad yazısı (kasnak adı), kendi biriminde
};

// Esnek blokların boyu (başlıksız kısım): en az · tercih · en çok. Tercih
// tasarım tuvalindeki "E" dizilişinin ölçüsü; en çok sütun boş kalmasın diye
// cömert (küçük modelde grafik büyür, sayfa boş kalmaz).
var VE_FEAD_PANO_ESNEK = {
  yol:   { min: 300, pref: 430, max: 640 },
  egri:  { min: 170, pref: 226, max: 400 },
  motor: { min: 160, pref: 206, max: 380 },
  frek:  { min: 160, pref: 204, max: 400 },
  hub:   { min: 140, pref: 186, max: 380 }
};

// Gövdenin (dört sütunun) yüksekliği: başlık, kural, gösterge şeridi ve
// aralarındaki boşluklar düşülür (CSS: .cz 4 + 2 · .kpis 10 · .govde 10).
function _fpnGovdeH(){
  var P = VE_FEAD_PANO;
  return P.H - 2 * P.PAY - P.UST - 6 - (10 + P.KPI) - 10;
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

// ─── YAZI GENİŞLİĞİ TAHMİNİ — gömülü Inter, em cinsinden ────────────────────
// Tablo sütunlarının eni ve notların satır sayısı için: indirilen belgede
// ölçüm yapacak JS yok, bütçe önceden bilinmeli. Değerler gerçek tarayıcıda
// gömülü Inter'le karakter karakter ölçüldü (rakam tabular 0,648 — tam) ve
// iki basamağa YUKARI yuvarlandı: tahmin yazıyı dar değil geniş sayar. Kalın
// (600) yazıya karakter başına ölçülen ek konur. Toplam %3 geniş sayılır:
// küçük boyda glif ilerlemesi tam piksele yuvarlanıyor (ölçüldü: 7 pt'de
// "KK2–TEN" harf toplamından %2,9 geniş). Tabloda olmayan karakter 0,8 em.
// Kapısı gerçek tarayıcıda: hücre yazısı kutusundan en az 1 px dar
// (fead-pano.spec.js).
var _FPN_EM = (function(){
  // Aynı genişlikteki karakterler bir arada (em, iki basamağa YUKARI yuvarlı).
  var G = {
  '·\'': .23,
  'ıijl': .24,
  'I': .27,
  '.,:;': .28,
  ' ': .29,
  '|': .33,
  'İ': .34,
  '/': .36,
  'ft()[]': .37,
  'rş': .39,
  '-²': .42,
  '°': .46,
  'ℓθ': .48,
  'ğ–': .50,
  'β': .51,
  'T': .52,
  'cçs': .53,
  'xμ': .54,
  'ekzJ≤≥': .55,
  'oövyŞ': .56,
  'aL': .57,
  'gnpuüqFΣ': .59,
  'bdhE': .60,
  '−+~': .62,
  'Z': .63,
  'PRS#': .64,
  'BX': .65,
  'K×': .66,
  'Y': .67,
  'AV': .68,
  'D': .72,
  'CÇĞ': .73,
  'H': .74,
  'GUÜ': .75,
  'N': .76,
  'OÖQØ': .77,
  'w%': .82,
  '✓✗': .84,
  'm': .87,
  '∈∉': .88,
  'M': .89,
  '⚠': .90,
  '@': .94,
  'W': .95,
  '—→': 1.00
  }, o = {};
  Object.keys(G).forEach(function(k){ for(var i = 0; i < k.length; i++) o[k.charAt(i)] = G[k]; });
  return o;
})();
// Kalın (600) yazının karakter başına EK genişliği (em, ölçüldü): çoğu
// karakterde 0,03'ün altında; aşanlar burada.
var _FPN_KALIN = { 'Σ': 0.08, 'T': 0.07, '@': 0.07, 'W': 0.06, 'Ğ': 0.06, 'İ': 0.06, 'A': 0.05,
  'V': 0.05, 'X': 0.05, 'θ': 0.05, 'Y': 0.04, '(': 0.04, ')': 0.04, '[': 0.04, ']': 0.04 };
function _fpnYaziGen(metin, fs, kalin){
  var ham = String(metin == null ? '' : metin);
  // Alt indis 0,72 em'le yazılır (`.pn sub`): ayrı ölçülür, gövde yazısından düşer.
  var alt = 0;
  ham = ham.replace(/<sub>([\s\S]*?)<\/sub>/g, function(m, x){ alt += _fpnYaziGen(x, fs * 0.72, kalin); return ''; });
  var s = ham.replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  var w = 0;
  for(var i = 0; i < s.length; i++){
    var c = s.charAt(i);
    if(c >= '0' && c <= '9') w += 0.648;
    else if(_FPN_EM[c] !== undefined) w += _FPN_EM[c];
    else if(/[\u2080-\u2089]/.test(c)) w += 0.35;
    else w += 0.8;                                  // tabloda olmayan: geniş say
    if(kalin) w += (_FPN_KALIN[c] !== undefined) ? _FPN_KALIN[c] : 0.03;
  }
  return w * fs * 1.03 + alt;
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
  var kod = _frKodlar(R);
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

  var tork = _fpnTork(R, n);
  var pk = (typeof _fsrPeak === 'function') ? _fsrPeak(R) : null;
  var kas = sys.pulleys.map(function(p, i){
    var g = (A.geometry || [])[i] || {};
    var gergi = i === ten;
    // Gerginin koordinatı AVARA MERKEZİ (girdi, `build.center`) — paftanın
    // ve §8.4'ün satırı; montaj konumu kol açısından türer.
    var xy = gergi ? (b.center || [NaN, NaN]) : [p.x, p.y];
    var r = { i: i, kod: kod[i], ad: p.name, surucu: i === crk, gergi: gergi,
      temas: p.contact === 'back' ? 'S' : 'K', od: _frNum(p.od), ef: 2 * _frNum(p.rPitch),
      x: _frNum(xy[0]), y: _frNum(xy[1]), J: _frNum(p.inertiaKgM2),
      beta: _frNum(g.wrapDeg), oran: _frNum(g.speedRatio), nMax: NaN, pMax: NaN, qMax: tork[i],
      flStat: NaN, flStatYon: NaN, flDin: NaN, flDinYon: NaN, flDinRpm: NaN,
      flTepe: (pk && pk.rows && pk.rows[i]) ? _frNum(pk.rows[i].hubloadN) : NaN,
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
    var a = { j: j, ad: kod[j] + ' – ' + kod[(j + 1) % n], kisa: kod[j] + '–' + kod[(j + 1) % n],
      Lf: _frNum(g2.exitSpanMm),
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
  // Satır başına açıklık gerginlikleri (ısı haritası), kasnak başına SF ve
  // rolü (kayma haritası), yorulma hasarına katkı (R.fatigue.perLoadPct).
  var aks = [];
  for(var i2 = 0; i2 < n; i2++){
    if(i2 === crk || i2 === ten) continue;
    var mx = 0;
    duty.forEach(function(d){ var pp = d.perPulley && d.perPulley[i2]; if(pp) mx = Math.max(mx, _frNum(pp.powerKw) || 0); });
    if(mx > 0.05) aks.push(i2);
  }
  var yor = (R.fatigue && Array.isArray(R.fatigue.perLoadPct)) ? R.fatigue.perLoadPct : null;
  var cev = duty.map(function(d, qd){
    var pc = d.perPulley && d.perPulley[crk];
    var sfm = NaN, om = NaN;
    var sfK = [], yukK = [];
    for(var k0 = 0; k0 < n; k0++){ sfK.push(NaN); yukK.push(false); }
    (d.slip || []).forEach(function(s){
      var v = _frNum(s.SF), ix = adSira[s.name];
      if(ix !== undefined){ sfK[ix] = v; yukK[ix] = !!_frSlipYuk(s); }
      if(_frSlipYuk(s) && Number.isFinite(v) && !(v >= sfm)) sfm = v;
    });
    var fa = _frNum(d.firingHz);
    (d.frequencies || []).forEach(function(fr){
      var f1 = (fr && fr.fHz && fr.fHz.length) ? _frNum(fr.fHz[0]) : NaN;
      if(Number.isFinite(f1) && fa > 0 && !(f1 / fa >= om)) om = f1 / fa;
    });
    var gerg = (d.perPulley || []).map(function(p){ return _frNum(p.exitTensionN); });
    var tMax = NaN;
    gerg.forEach(function(x){ if(Number.isFinite(x) && !(x <= tMax)) tMax = x; });
    // Yorulma satırı çevrimin satırıyla eşleşir: aynı sıra ve aynı devir.
    var ys = yor && yor[qd];
    var yPay = (ys && _frNum(ys.engineRpm) === _frNum(d.engineRpm)) ? _frNum(ys.sharePct) : NaN;
    return {
      rpm: _frNum(d.engineRpm), dc: _frNum(d.dcPct),
      kw: aks.map(function(k){ var pp = d.perPulley && d.perPulley[k]; return pp ? _frNum(pp.powerKw) : NaN; }),
      P: pc ? _frNum(pc.powerKw) : NaN, v: _frNum(d.vMs),
      Fu: pc ? _frNum(pc.exitTensionN) - _frNum(pc.entryTensionN) : NaN,
      tMax: tMax, gerg: gerg, sfK: sfK, yukK: yukK, yorulma: yPay,
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
  var tm = A.tensionerMode || null;
  var gergi = t ? {
    parca: tenData.tenPart ? String(tenData.tenPart) : '',
    kunye: tenData.tenLib ? String(tenData.tenLib) : '',
    kol: _frNum(t.armLength), M0: _frNum(t.preloadNm), k: _frNum(t.rateNmPerDeg),
    pivot: t.pivot || null, avara: b.center || null,
    abs: _frNum(A.meanAbsDeg), rel: _frNum(A.meanRelDeg),
    takeup: _frNum(A.tensioner && A.tensioner.takeupMmPerDeg),
    FL: _frNum(A.tensioner && A.tensioner.hubloadN), FLyon: _frNum(A.tensioner && A.tensioner.hubDirDeg),
    kolHz: (tm && !tm.error) ? _frNum(tm.fHz) : NaN
  } : null;

  // GERGİ KOLU ZARFI — §8.8'in konum tablosu (çekirdeğin positionTable'ı).
  var zarf = (A.positions || []).map(function(p){
    return { konum: p.position, hata: p.error || null, rel: _frNum(p.relDeg), abs: _frNum(p.absDeg),
             T: _frNum(p.tensionN), FL: _frNum(p.hubloadN), sarim: _frNum(p.wrapDeg),
             Lb: _frNum(p.requiredBeltMm), takeup: _frNum(p.takeupMmPerDeg) };
  });

  // BURULMA — elastik modlar ve bantta kesişmeler (§8.18'in üreticisi).
  var T0 = R.torsional || null, burulma = null;
  if(T0 && Number.isFinite(_frNum(T0.firstElasticHz))){
    var K = (typeof _frBurulmaKesisim === 'function') ? _frBurulmaKesisim(R) : null;
    burulma = {
      modlar: (T0.elasticHz || []).map(function(f, im){
        return { mod: im + 1, f: _frNum(f),
                 atesRpm: (K && K.atesMert > 0) ? 60 * _frNum(f) / K.atesMert : NaN,
                 kes: K ? K.satir.filter(function(x){ return x.mod === im + 1; }) : [] };
      }),
      atesMert: K ? K.atesMert : NaN, bantLo: K ? K.rLo : NaN, bantHi: K ? K.rHi : NaN,
      kesisim: K ? K.satir.length : 0, ilk: _frNum(T0.firstElasticHz)
    };
  }

  // UYGUNLUK — ayrıntılı raporun ölçütleri (tek üretici) · KAPILAR onların
  // son üçü, R.checks'ten (yeniden hesaplanmaz).
  var uyg = (typeof _frUygunlukSatirlari === 'function') ? _frUygunlukSatirlari(R) : [];

  var d0 = (node && node.data) || {};
  var sd = (b.solver && b.solver.data) || {};
  var motor = '';
  if(sd.engineLib && typeof veFeadEngineOf === 'function'){
    var e = veFeadEngineOf(sd.engineLib);
    if(e && e.ad) motor = String(e.ad);
  }
  var sil = _frNum(sd.cylinders);
  var dcTop = 0;
  cev.forEach(function(c){ dcTop += Number.isFinite(c.dc) ? c.dc : 0; });

  var notlar = _fpnNotlar(R, node, kod);

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
      esik: (esik && Number.isFinite(_frNum(esik.tensionN)))
        ? { T: _frNum(esik.tensionN), pay: _frNum(esik.margin), rpm: _frNum(esik.engineRpm),
            kod: (esik.index != null && kod[esik.index]) ? kod[esik.index] : '' } : null,
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
      tol: _frNum(sys.belt && sys.belt.tolerance), asinma: _frNum(sys.belt && sys.belt.wearPct),
      hb: boy ? _frNum(boy.hb) : NaN, hr: boy ? _frNum(boy.hr) : NaN,
      m: _frNum(sys.belt && sys.belt.massPerRibKgM) * (_frNum(sys.belt && sys.belt.ribs) || 1),
      v: vTepe, fB: fB, nTepe: nMax,
      P: enBuyuk('P'), Fu: enBuyuk('Fu'),
      Fstat: Td
    },
    gergi: gergi, zarf: zarf, burulma: burulma, uyg: uyg,
    senaryo: _fpnSenaryo(R),
    tepe: pk ? { rpm: pk.engineRpm, ivme: pk.accelRpmS,
                 T: pk.rows.map(function(r){ return r.tensionN; }),
                 F: pk.rows.map(function(r){ return r.hubloadN; }) } : null,
    notlar: notlar.satirlar, notSatir: notlar.boy, notKalan: notlar.kalan,
    kunye: {
      proje: (typeof veProjeAdi === 'function') ? veProjeAdi() : '',
      kayis: [(sys.belt && sys.belt.brand) || '', (sys.belt && sys.belt.beltType) || ''].join(' ').trim(),
      motor: motor, silindir: sil, cozum: _frNum(R.solvedAt),
      cevrim: cev.length, cevrimPay: dcTop, uzunluk: _frNum(A.driveLenMm),
      hazirlayan: d0.author ? String(d0.author) : '',
      kontrol: d0.checker ? String(d0.checker) : '', onay: d0.approver ? String(d0.approver) : '',
      dokuman: d0.docNo ? String(d0.docNo) : '', rev: d0.revision ? String(d0.revision) : ''
    }
  };
}

// ─── MİL TORKU — çözüm anında kurulan çevrim kümesinden ─────────────────────
// Q = 9549·P/n (raporun 5.1'i) kümenin `<kasnak>.nm` kanalında; pano en
// büyüğünü okur. Küme yoksa (eski sonuç) NaN — yeniden hesaplanmaz.
function _fpnTork(R, n){
  var out = [];
  for(var i = 0; i < n; i++) out.push(NaN);
  var S = (typeof veFeadSignals !== 'undefined' && veFeadSignals) ? veFeadSignals : null;
  if(!S || !R || !Array.isArray(R.signals) || typeof S._pulleys !== 'function') return out;
  var P = S._pulleys(R);
  P.forEach(function(p, i){
    var d = S.series(R.signals, S.SENSOR_PREFIX + 'cevrim', p.key + '.nm');
    if(!d || i >= n) return;
    d.forEach(function(v){ var x = _frNum(v); if(Number.isFinite(x) && !(x <= out[i])) out[i] = x; });
  });
  return out;
}

// ─── MOTOR ÇEVRİMİ — çözüm anında kurulan senaryo kümesinden ────────────────
// Devir geçmişi DAYATILMIŞ (fead-transient.js); pano kümenin serilerini ve
// künyesini çizer, senaryoyu yeniden kurmaz.
function _fpnSenaryo(R){
  var S = (typeof veFeadSignals !== 'undefined' && veFeadSignals) ? veFeadSignals : null;
  if(!S || !R || !Array.isArray(R.signals)) return null;
  var kim = S.SENSOR_PREFIX + 'senaryo';
  var ds = S.setOf(R.signals, kim);
  if(!ds || !ds.x || !Array.isArray(ds.x.data)) return null;
  var t = ds.x.data, rpm = S.series(R.signals, kim, 'rpm'),
      tmax = S.series(R.signals, kim, 'tmax'), tmin = S.series(R.signals, kim, 'tmin');
  if(!rpm || !tmax || !tmin || t.length < 4) return null;
  var m = ds.meta || {};
  var iT = 0;
  tmax.forEach(function(v, i){ if(_frNum(v) > _frNum(tmax[iT])) iT = i; });
  return { t: t, rpm: rpm, tmax: tmax, tmin: tmin, faz: m.phases || [], T: _frNum(m.T),
           ivme: _frNum(m.accel), egri: !!m.curve, iTepe: iT };
}

// ─── TASARIM NOTLARI VE SINIRLAR ────────────────────────────────────────────
// Kullanıcının notları (Rapor penceresinin künyesi — ayrıntılı raporun
// §8.19'u) ve çözümün kendi sınırları, YAPISAL alanlardan kısa yazımla:
// çekirdeğin sınır cümleleri noktalı ondalıkla ve kasnak adıyla yazılıyor.
// Liste sütuna sığacak kadar tutulur ve kalan SAYISIYLA söylenir.
function _fpnNotlar(R, node, kod){
  var P = VE_FEAD_PANO, sys = R.build.sys, L = [];
  var adKod = {};
  sys.pulleys.forEach(function(p, i){ adKod[p.name] = kod[i] || p.name; });
  var raw = node && node.data && node.data.notes;
  if(raw) String(raw).split(/\r?\n/).forEach(function(s){
    s = s.trim();
    if(!s) return;
    var i = s.indexOf('|');
    L.push(_frEsc(i > 0 ? s.slice(0, i).trim() + ' — ' + s.slice(i + 1).trim() : s));
  });
  var k = R.kaymaKosul || {};
  var cev = (k.yuk || []).filter(function(y){ return y && y.kaynak === 'cevrim'; })
    .map(function(y){ return adKod[y.name] || y.name; });
  if(cev.length) L.push('Kayma: ' + _frEsc(cev.join(', ')) + ' için tepe güç eğrisi yok — çevrim yükü %100 sayıldı.');
  if(R.kaymaKosul && !k.ivmelenme) L.push('Kayma: motor ivmesi girilmedi — atalet talebi sayılmadı.');
  var life = R.life;
  if(life && !life.inValidRange){
    var C = (typeof FEADCore !== 'undefined') ? FEADCore : null;
    var pen = (C && C.FATIGUE && C.FATIGUE.validDiameterMm) || null;
    var disi = [];
    sys.pulleys.forEach(function(p, i){
      (life.outOfRange || []).forEach(function(x){
        if(String(x).indexOf(p.name + ' (d=') === 0) disi.push(_frEsc(kod[i] || p.name) + ' Ø' + _frF(2 * _frNum(p.rEff), 1));
      });
    });
    L.push('B10: ' + (disi.length ? disi.join(', ') + ' ' : '') + 'çap penceresi'
      + (pen ? ' (' + _frF(pen[0], 1) + '–' + _frF(pen[1], 1) + ' mm)' : '')
      + ' dışında — göstergede düzeltmeli değer.');
  }
  if(R.torsional && Number.isFinite(_frNum(R.torsional.firstElasticHz)))
    L.push('Burulma kalibre model (Gates Mode 1, RMS ~%8); tepe yük ve motor çevrimi yarı statik.');
  var sv = _frServis(R), v = ['c₂ ' + (sv.secili ? '= ' + _frEsc(sv.yaz) : 'seçilmedi')];
  if(R.fatigueModel) v.push('yorulma ' + _frEsc(R.fatigueModel));
  if(Number.isFinite(_frNum(R.degCEq))) v.push(_frF(R.degCEq, 0) + ' °C');
  L.push('Varsayım: ' + v.join(' · ') + '.');
  (R.warnings || []).forEach(function(w){ L.push(_frEsc(w)); });

  // Satır bütçesi: sütunun iç eni (madde girintisi düşülür), gövde yazısı.
  var en = Math.min.apply(null, P.SUTUN) - 16, satirlar = [], boy = 0, kalan = 0;
  L.forEach(function(x, i){
    var s = Math.max(1, Math.ceil(_fpnYaziGen(x, P.TABAN) / en));
    var son = (i === L.length - 1);
    // Son satır "+N not" için ayrılır — yer yoksa madde listeye girmez.
    if(kalan || boy + s > P.NOT_EN_COK - (son ? 0 : 1)){ kalan++; return; }
    satirlar.push({ metin: x, satir: s });
    boy += s;
  });
  if(kalan) boy += 1;
  return { satirlar: satirlar, boy: boy, kalan: kalan };
}

// ═══════════════════ SAYFA ÖLÇÜSÜ — blokların bütçesi ══════════════════════
// Blok = başlık + sabit gövde (tablo, not) + varsa esnek kutu (çizim,
// grafik). Sabit boylar CSS'le birebir; esnek kutu sütunun artanını alır.
// `r`: çevrime bağlı üç tablonun satır boyu (VE_FEAD_PANO.UZUN).
function _fpnBloklar(V, r){
  var P = VE_FEAD_PANO, E = VE_FEAD_PANO_ESNEK;
  var B = P.BASLIK, S = P.SATIR, NOT = P.NOT;
  var n = V.n, m = V.cev.length;
  var tablo = function(sat, satH){ return P.TH + sat * satH + P.TABLO_ALT; };
  var kv = function(sat){ return sat * S + P.TABLO_ALT; };
  var frekVar = V.kayisVeri && V.acik.some(function(a){ return Number.isFinite(a.f1Min); });
  return [
    { id: 'yol',   ev: 0, h: B, esnek: E.yol },
    { id: 'yer',   ev: 0, h: B + tablo(n, S) + (V.gergi ? NOT : 0) },
    { id: 'acik',  ev: 0, h: B + tablo(n, S) },
    { id: 'kayis', ev: 0, h: B + kv(8) },
    { id: 'kas',   ev: 1, h: B + tablo(n, S) },
    { id: 'cev',   ev: 1, h: B + tablo(m, r) },
    { id: 'gerg',  ev: 1, h: B + tablo(m, r) },
    { id: 'kay',   ev: 1, h: B + tablo(m, r) },
    { id: 'gergi', ev: 2, h: B + (V.gergi ? kv(4) : NOT) },
    { id: 'zarf',  ev: 2, h: B + (V.zarf.length ? tablo(6, S) : NOT) },
    { id: 'egri',  ev: 2, h: B + (V.gergi ? 0 : NOT), esnek: V.gergi ? E.egri : null },
    { id: 'motor', ev: 2, h: B + NOT, esnek: V.senaryo ? E.motor : null },
    { id: 'bur',   ev: 2, h: B + (V.burulma ? tablo(V.burulma.modlar.length, S) : NOT) },
    { id: 'frek',  ev: 3, h: B + (frekVar ? 0 : NOT), esnek: frekVar ? E.frek : null },
    { id: 'hub',   ev: 3, h: B + tablo(n, S) + NOT, esnek: E.hub },
    { id: 'uyg',   ev: 3, h: B + kv(V.uyg.length) },
    { id: 'not',   ev: 3, h: B + V.notSatir * P.MADDE }
  ];
}

// Esnek kutulara `kalan` boy: tercihleri oranında, [en az, en çok] içinde
// (kelepçelenen kutu sabitlenir, kalanlar yeniden paylaşır).
function _fpnDagit(esnek, kalan){
  var h = esnek.map(function(){ return NaN; }), bitti = false;
  while(!bitti){
    bitti = true;
    var serbest = 0, sabit = 0;
    esnek.forEach(function(e, i){ if(Number.isFinite(h[i])) sabit += h[i]; else serbest += e.pref; });
    if(!(serbest > 0)) break;
    var l = (kalan - sabit) / serbest;
    esnek.forEach(function(e, i){
      if(Number.isFinite(h[i])) return;
      var v = e.pref * l;
      if(v < e.min){ h[i] = e.min; bitti = false; }
      else if(v > e.max){ h[i] = e.max; bitti = false; }
    });
    if(bitti) esnek.forEach(function(e, i){ if(!Number.isFinite(h[i])) h[i] = e.pref * l; });
  }
  return h.map(function(x){ return Math.floor(x); });
}

// Blokları okuma sırasıyla dört sütuna BİTİŞİK böler. Ceza: sütunda kalan boş
// yerin karesi, ev sütunundan uzaklık (blok ve sütun başına), esnek kutunun
// tercihten sapması. Sığmayan bölüm elenir; hiçbiri sığmazsa null.
function _fpnDizilim(bloklar, G){
  var P = VE_FEAD_PANO, n = bloklar.length, en = null;
  function sutun(a, b, k){
    var sabit = (b - a - 1) * P.BLOK, esn = [], sapma = 0;
    for(var i = a; i < b; i++){
      sabit += bloklar[i].h;
      if(bloklar[i].esnek) esn.push(i);
      sapma += Math.abs(k - bloklar[i].ev);
    }
    var kalan = G - sabit, mn = 0;
    esn.forEach(function(i){ mn += bloklar[i].esnek.min; });
    if(kalan < mn - 1e-6) return null;
    var boy = _fpnDagit(esn.map(function(i){ return bloklar[i].esnek; }), kalan);
    var dolu = 0, sap2 = 0;
    esn.forEach(function(i, q){
      var e = bloklar[i].esnek;
      dolu += boy[q];
      sap2 += Math.pow((boy[q] - e.pref) / e.pref, 2);
    });
    return { a: a, b: b, esn: esn, boy: boy, bos: kalan - dolu, sapma: sapma, sap2: sap2 };
  }
  for(var c1 = 1; c1 <= n - 3; c1++)
    for(var c2 = c1 + 1; c2 <= n - 2; c2++)
      for(var c3 = c2 + 1; c3 <= n - 1; c3++){
        var s = [sutun(0, c1, 0), sutun(c1, c2, 1), sutun(c2, c3, 2), sutun(c3, n, 3)];
        if(!s[0] || !s[1] || !s[2] || !s[3]) continue;
        var skor = 0;
        s.forEach(function(x){ skor += x.bos * x.bos + 400 * x.sapma + 60 * x.sap2; });
        if(!en || skor < en.skor) en = { skor: skor, sutunlar: s };
      }
  return en;
}

// Sayfanın düzeni: çevrim tablolarının satır boyu ve bölüm birlikte seçilir.
// Tercih 16 px; kısa çevrimde satır büyür (sütun boş kalmasın — ceza hafif),
// uzun çevrimde daralır (ceza ağır). Hiçbiri sığmazsa ev dizilişi, en küçük
// satır ve tercih boyları: sayfa uzar.
function _fpnOlcu(V){
  var P = VE_FEAD_PANO, G = _fpnGovdeH(), en = null, enKucuk = Math.min.apply(null, P.UZUN);
  P.UZUN.forEach(function(r){
    var bl = _fpnBloklar(V, r);
    var d = _fpnDizilim(bl, G);
    if(!d) return;
    var skor = d.skor + (r >= 16 ? 150 * (r - 16) * (r - 16) : 2000 * (16 - r));
    if(!en || skor < en.skor) en = { skor: skor, r: r, bloklar: bl, d: d };
  });
  var out = { govde: G, tasma: !en, uzun: en ? en.r : enKucuk, sutunlar: [] };
  var bl = en ? en.bloklar : _fpnBloklar(V, out.uzun);
  if(en){
    en.d.sutunlar.forEach(function(s){
      var sut = [];
      for(var i = s.a; i < s.b; i++){
        var q = s.esn.indexOf(i);
        sut.push({ id: bl[i].id, h: bl[i].h, esnek: q >= 0 ? s.boy[q] : 0 });
      }
      out.sutunlar.push({ blok: sut, bos: s.bos });
    });
  } else {
    [0, 1, 2, 3].forEach(function(k){
      var sut = [];
      bl.forEach(function(x){ if(x.ev === k) sut.push({ id: x.id, h: x.h, esnek: x.esnek ? x.esnek.pref : 0 }); });
      out.sutunlar.push({ blok: sut, bos: 0 });
    });
  }
  // Sayfa sayısı: taşan sütunun boyundan (baskıda A3 sayfası başına H).
  var enUzun = 0;
  out.sutunlar.forEach(function(s){
    var h = (s.blok.length - 1) * P.BLOK;
    s.blok.forEach(function(x){ h += x.h + x.esnek; });
    s.dolu = h;
    enUzun = Math.max(enUzun, h);
  });
  out.sayfa = out.tasma ? 1 + Math.ceil((enUzun - G) / P.H) : 1;
  return out;
}

// ═══════════════════ ÇİZİM VE GRAFİKLER ══════════════════════════════════════
// Kayış yolu — kanvas kartının çizicisi. Çizim kutunun 1/k ölçüsünde kurulur,
// viewBox k kat büyütür (kartın yazı kuralı, kural 21): k tabanın çizicinin
// ad yazısına oranı — kasnak adı ve açıklık gerilmesi (9 birim) tam 8 pt.
// SARIM AÇISI ÇİZİLMEZ: çizici onu 8 birimle yerleştiriyor ve 8 pt'ye
// büyütülen yazı yerleştiricinin kutusundan taşıp komşusuna biniyordu
// (ölçüldü: 11 örneğin 4'ünde 5 çakışma, çizici değişmeden 0). Açı kasnak
// tablosunun β sütununda.
function _fpnCizim(R, V, kutuW, kutuH, ayar){
  if(typeof veFeadLayoutSVG !== 'function') return '';
  var k = VE_FEAD_PANO.TABAN / VE_FEAD_PANO.CIZIM_YAZI;
  var svg = null;
  try {
    svg = veFeadLayoutSVG(R.build, kutuW / k, kutuH / k, Object.assign({
      posMode: 'mean', compass: true, pivot: true, arrows: true, ghostLabels: false,
      wrapLabels: false, inline: true, kunye: false, names: V.kod }, ayar || {}));
  } catch(e){ svg = null; }
  return svg ? _fpnTaban(svg, k) : '';
}

// Hubload okları — çizicinin `ek` katmanı, onun dönüşümüyle (T.tx · T.ty).
// Ok çevrimde EN BÜYÜK dinamik hubload'ın yönünde, boyu en büyüğe oranlı.
// Geometri hesaplanmaz: merkez çizicinin, kuvvet ve yön çözümün.
function _fpnHubOklari(V){
  return function(T){
    var Fmax = 0, h = '';
    V.kas.forEach(function(k){ if(Number.isFinite(k.flDin) && k.flDin > Fmax) Fmax = k.flDin; });
    if(!(Fmax > 0)) return '';
    var Lmax = 0.22 * Math.min(T.W, T.H), f = function(v){ return (Math.round(v * 100) / 100).toString(); };
    (T.ps || []).forEach(function(p, i){
      var k = V.kas[i];
      if(!k || !Number.isFinite(k.flDin) || !Number.isFinite(k.flDinYon)) return;
      var cx = T.tx(p.c[0]), cy = T.ty(p.c[1]);
      var L = k.flDin / Fmax * Lmax, th = k.flDinYon * Math.PI / 180;
      var ux = Math.cos(th), uy = -Math.sin(th);
      var hl = Math.min(6, L * 0.6), hw = 2.6;
      var ex = cx + L * ux, ey = cy + L * uy, bx = ex - ux * hl, by = ey - uy * hl;
      h += '<line data-ve="hub-ok" x1="' + f(cx) + '" y1="' + f(cy) + '" x2="' + f(bx) + '" y2="' + f(by)
        + '" stroke="var(--vurgu)" stroke-width="1.8"/>'
        + '<path d="M' + f(ex) + ' ' + f(ey) + ' L' + f(bx - uy * hw) + ' ' + f(by + ux * hw)
        + ' L' + f(bx + uy * hw) + ' ' + f(by - ux * hw) + ' Z" fill="var(--vurgu)"/>';
    });
    return h;
  };
}

// Ayrıntılı raporun grafiği, verilen kutuya ve tabana. viewBox'ın eni kutunun
// eni (ölçek 1): grafiğin 11 birimlik yazısı 8 pt'nin üstünde kalır.
function _fpnGrafik(fn, R, W, H, extra, ayar){
  if(typeof veFeadFigureRaw !== 'function' || typeof fn !== 'function') return null;
  var s = veFeadFigureRaw(fn, R, W, H, extra, ayar);
  if(!s) return null;
  var vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(s);
  return { svg: s, W: vb ? parseFloat(vb[1]) : W, H: vb ? parseFloat(vb[2]) : H };
}

// Motor çevrimi — senaryo kümesinin serileri: devir (sol eksen), en yüksek ve
// en düşük açıklık gerginliği (sağ eksen, aradaki bant), evre bantları.
// 1 birim = 1 px: yazı doğrudan 8 pt.
function _fpnMotorGrafik(S, W, H){
  var FS = VE_FEAD_PANO.TABAN, f = function(v){ return (Math.round(v * 10) / 10).toString(); };
  var pad = { l: 40, r: 40, t: FS + 8, b: 2 * FS + 12 };
  var X0 = pad.l, X1 = W - pad.r, Y0 = pad.t, Y1 = H - pad.b;
  var T = (S.T > 0) ? S.T : _frNum(S.t[S.t.length - 1]);
  var enb = function(a){ var m = 0; a.forEach(function(v){ var x = _frNum(v); if(x > m) m = x; }); return m; };
  var ar = _frNiceAxis(0, enb(S.rpm), 3), aT = _frNiceAxis(0, enb(S.tmax), 3), at = _frNiceAxis(0, T, 6);
  var sx = function(t){ return X0 + t / T * (X1 - X0); };
  var sr = function(v){ return Y1 - v / ar.max * (Y1 - Y0); };
  var sT = function(v){ return Y1 - v / aT.max * (Y1 - Y0); };
  var yz = function(x, y, t, an, renk, ek){
    return '<text x="' + f(x) + '" y="' + f(y) + '"' + (an ? ' text-anchor="' + an + '"' : '')
      + ' font-size="' + FS + '" fill="' + (renk || 'var(--dim)') + '"' + (ek || '') + '>' + t + '</text>';
  };
  var g = '';
  // Evre bantları ve adları — sığmayan ad ilk kelimesine iner ("Tepe devir"
  // → "Tepe"), o da sığmazsa yazılmaz (bant yine çizilir).
  (S.faz || []).forEach(function(p, i){
    var xa = sx(_frNum(p.t0)), xb = sx(_frNum(p.t1));
    if(!(xb > xa)) return;
    if(i % 2) g += '<rect x="' + f(xa) + '" y="' + f(Y0) + '" width="' + f(xb - xa) + '" height="' + f(Y1 - Y0) + '" fill="var(--soft)" opacity="0.55"/>';
    var ad = String(p.ad || ''), kisa = ad.split(' ')[0];
    if(ad && _fpnYaziGen(ad, FS) + 4 > xb - xa) ad = kisa;
    if(ad && _fpnYaziGen(ad, FS) + 4 <= xb - xa) g += yz((xa + xb) / 2, Y0 - 5, _frEsc(ad), 'middle');
  });
  ar.ticks.forEach(function(v){
    g += '<line x1="' + X0 + '" y1="' + f(sr(v)) + '" x2="' + f(X1) + '" y2="' + f(sr(v)) + '" stroke="var(--soft)" stroke-width="1"/>';
    g += yz(X0 - 4, sr(v) + FS * 0.36, _frF(v, 0), 'end');
  });
  aT.ticks.forEach(function(v){ g += yz(X1 + 4, sT(v) + FS * 0.36, _frF(v, 0), '', 'var(--vurgu)'); });
  at.ticks.forEach(function(v){ if(v <= T + 1e-9) g += yz(sx(v), Y1 + FS + 3, _frF(v, 0), 'middle'); });
  g += yz(X0, H - 3, 'Zaman [s] · sol: motor devri [d/d] · sağ: açıklık gerginliği [N]');
  var yol = function(a, fy){
    return S.t.map(function(t, i){ return (i ? 'L' : 'M') + f(sx(_frNum(t))) + ' ' + f(fy(_frNum(a[i]))); }).join(' ');
  };
  g += '<path d="' + yol(S.tmax, sT) + ' L' + S.t.slice().reverse().map(function(t, i){
      var j = S.t.length - 1 - i; return f(sx(_frNum(t))) + ' ' + f(sT(_frNum(S.tmin[j]))); }).join(' L')
    + ' Z" fill="var(--vurgu)" opacity="0.14"/>';
  g += '<path d="' + yol(S.rpm, sr) + '" fill="none" stroke="var(--dim)" stroke-width="1.6"/>';
  g += '<path d="' + yol(S.tmax, sT) + '" fill="none" stroke="var(--vurgu)" stroke-width="1.8"/>';
  g += '<path d="' + yol(S.tmin, sT) + '" fill="none" stroke="var(--vurgu)" stroke-width="1" stroke-dasharray="3 2"/>';
  g += '<line x1="' + X0 + '" y1="' + f(Y1) + '" x2="' + f(X1) + '" y2="' + f(Y1) + '" stroke="var(--rule)"/>';
  // Tepe — en yüksek açıklık gerginliği, anı ve o andaki devir. Yazı noktanın
  // ÜSTÜNDE (tepe eğrinin en yüksek yeri: üstü boş), çizim alanına kenetli;
  // üstte yer yoksa altında.
  var i = S.iTepe, tx = sx(_frNum(S.t[i])), ty = sT(_frNum(S.tmax[i]));
  var et = 'tepe ' + _frF(S.tmax[i], 0) + ' N · ' + _frFs(S.t[i], 1) + ' s · ' + _frF(S.rpm[i], 0) + ' d/d';
  var ew = _fpnYaziGen(et, FS, true), ex = Math.min(Math.max(tx, X0 + ew / 2), X1 - ew / 2);
  var ey = (ty - 6 - FS >= Y0) ? ty - 6 : ty + FS + 4;
  g += '<circle cx="' + f(tx) + '" cy="' + f(ty) + '" r="3.2" fill="var(--vurgu)"/>';
  g += yz(ex, ey, et, 'middle', 'var(--vurgu)', ' font-weight="600"');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg>';
}

// ═══════════════════ HTML ═══════════════════════════════════════════════════
function _fpnSub(a, b){ return a + '<sub>' + b + '</sub>'; }
function _fpnTd(v, cls){ return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td>'; }
function _fpnTh(v, birim, cls){
  return '<th' + (cls ? ' class="' + cls + '"' : '') + '>' + v + (birim ? '<i>' + birim + '</i>' : '') + '</th>';
}
function _fpnCol(gen){ return '<colgroup>' + gen.map(function(w){ return '<col style="width:' + w + 'px">'; }).join('') + '</colgroup>'; }
function _fpnH2(baslik, alt, dmg){
  return '<h2>' + baslik + (dmg ? '<span class="dmg">' + dmg + '</span>' : '') + (alt ? '<small>' + alt + '</small>' : '') + '</h2>';
}
function _fpnXY(p){
  return (p && p.length >= 2) ? '(' + _frFs(p[0], 1) + '; ' + _frFs(p[1], 1) + ')' : '—';
}
function _fpnKirmizi(kosul, metin){ return kosul ? '<span class="no">' + metin + '</span>' : metin; }
// Hüküm işareti — belgenin gövdesi tipografik işaret taşır (ikon-dili: BELGE).
var VE_FEAD_PANO_ISARET = { ok: '✓', warn: '⚠', no: '✗', wait: '–' };
// Isı sınıfı: 0…1 → i0…i8 (renk CSS'te, belge mürekkebinin tonları).
function _fpnIsi(t){
  if(!Number.isFinite(t)) return '';
  return 'i' + Math.round(Math.max(0, Math.min(1, t)) * 8);
}
// ─── TABLO ÜRETİCİSİ — sütun eni İÇERİKTEN ─────────────────────────────────
// Sütun: { b: başlık, u: birim satırı, uSec: birim satırı yalnız SIĞARSA,
// h: [hücre HTML…], s: hücre sınıfı (dizge ya da satır başına dizi), bs:
// başlık sınıfı, pad: CSS'in eklediği dolgu (px),
// dus: düşme önceliği (0 düşmez; toplam sığmazsa en büyüğü —
// aynı değeri taşıyan sütunlar BİRLİKTE — düşer) }. İhtiyaç: yazının tahmini
// eni + dolgu (2 × 3) + 1 px pay (kapı: yazı kutusundan en az 1 px dar);
// artan en sütunlara EŞİT yayılır.
function _fpnSutunlar(kol, W){
  var P = VE_FEAD_PANO;
  var ihtiyac = function(k){
    var w = _fpnYaziGen(k.b, P.TABAN, true);
    if(k.u && !k.uSec) w = Math.max(w, _fpnYaziGen(k.u, P.IKINCIL));
    (k.h || []).forEach(function(x){ w = Math.max(w, _fpnYaziGen(x, P.TABAN, /<b>/.test(String(x)))); });
    return Math.ceil(w + 7.3 + (k.pad || 0));
  };
  kol.forEach(function(k){ k._w = ihtiyac(k); });
  var kal = kol.slice();
  var top = function(){ return kal.reduce(function(a, k){ return a + k._w; }, 0); };
  while(top() > W){
    var d = 0;
    kal.forEach(function(k){ if((k.dus || 0) > d) d = k.dus; });
    if(!d) break;
    kal = kal.filter(function(k){ return (k.dus || 0) !== d; });
  }
  var T0 = top(), gen = [], kul = 0;
  var ek = (W - T0) / kal.length;
  kal.forEach(function(k, i){
    var v = (i === kal.length - 1) ? W - kul
          : (T0 <= W ? Math.floor(k._w + ek) : Math.floor(k._w * W / T0));
    gen.push(v); kul += v;
  });
  return { kol: kal, gen: gen };
}
function _fpnTablo(kol, W, sinif, basliksiz, satirSinif){
  var P = VE_FEAD_PANO, S = _fpnSutunlar(kol, W);
  var n = S.kol.length ? (S.kol[0].h || []).length : 0;
  var h = '<table' + (sinif ? ' class="' + sinif + '"' : '') + '>' + _fpnCol(S.gen);
  if(!basliksiz) h += '<tr>' + S.kol.map(function(k, i){
    var u = (k.u && k.uSec && _fpnYaziGen(k.u, P.IKINCIL) + 7.3 > S.gen[i]) ? '' : k.u;
    return _fpnTh(k.b, u, k.bs);
  }).join('') + '</tr>';
  for(var r = 0; r < n; r++){
    var ss = satirSinif && satirSinif[r];
    h += '<tr' + (ss ? ' class="' + ss + '"' : '') + '>' + S.kol.map(function(k){
      var c = Array.isArray(k.s) ? k.s[r] : k.s;
      return _fpnTd(k.h[r], c);
    }).join('') + '</tr>';
  }
  return h + '</table>';
}
// Satır dizisinden sütun: f(satır, i) hücre HTML'i.
function _fpnKol(satirlar, b, u, f, ek){
  var k = { b: b, u: u, h: satirlar.map(f) };
  if(ek) Object.keys(ek).forEach(function(x){ k[x] = ek[x]; });
  return k;
}

function _fpnKpi(durum, etiket, deger, alt){
  return '<div class="kpi" data-d="' + durum + '"><span class="k">' + etiket + '</span><b>' + deger
    + '</b><span class="s">' + alt + '</span></div>';
}

function _fpnUygSay(V){
  var say = { ok: 0, warn: 0, no: 0, wait: 0 };
  V.uyg.forEach(function(u){ say[say[u.durum] !== undefined ? u.durum : 'wait']++; });
  return say;
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
    + '≥ 1 · ' + (sv.secili ? 'c₂ = ' + _frEsc(sv.yaz) : 'c₂ seçilmedi'));
  var es = K.esik;
  h += _fpnKpi('n', 'Kayma eşiği (ankraj)', es ? _frFs(es.T, 1) + '<small>N</small>' : '—',
    es ? 'pay ' + _frFs(es.pay, 2) + '×' + (es.kod ? ' · ' + _frEsc(es.kod) : '')
         + (Number.isFinite(es.rpm) ? ' @' + _frF(es.rpm, 0) : '') : 'yük taşıyan kasnak yok');
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
    rz ? _frEsc(rz.ad) + ' @' + _frF(rz.rpm, 0) + '<br>' + rz.alti + ' / ' + rz.hucre + ' hücre &lt; 1'
       : (V.kayisVeri ? 'açıklık frekansı yok' : 'kayış verisi kapalı'));
  var B = V.burulma, kolHz = V.gergi ? V.gergi.kolHz : NaN;
  h += _fpnKpi('n', '1. burulma modu', B ? _frFs(B.ilk, 1) + '<small>Hz</small>' : '—',
    (Number.isFinite(kolHz) ? 'kol modu ' + _frFs(kolHz, 1) + ' Hz<br>' : '')
    + (B ? 'bantta ' + B.kesisim + ' kesişme' : 'burulma çözülmedi'));
  // Değer üç hüküm (✓ ⚠ ✗); değerlendirilemeyen ölçüt alt satırda sayılır —
  // dört grup gösterge kutusuna sığmıyordu (ölçüldü: kayış verisi kapalıyken).
  var say = _fpnUygSay(V);
  var enKotu = say.no ? 'no' : (say.warn ? 'warn' : (say.wait ? 'wait' : 'ok'));
  var sayi = ['ok', 'warn', 'no'].filter(function(d){ return say[d] > 0; }).map(function(d){
    return '<span class="' + d + '">' + say[d] + ' ' + VE_FEAD_PANO_ISARET[d] + '</span>'; }).join(' ');
  // Kontrol isteyen ölçütlerin kısa adları — iki satıra sığmıyorsa sayısı.
  var kotu = V.uyg.filter(function(u){ return u.durum === 'no'; }).map(function(u){ return u.kisa; });
  var kotuYaz = kotu.join(' · ');
  var bekle = say.wait ? say.wait + ' değerlendirilemedi' : '';
  h += _fpnKpi(enKotu, 'Uygunluk (' + V.uyg.length + ' ölçüt)', sayi || '—',
    !kotu.length ? [say.warn ? say.warn + ' sınırda' : 'kontrol isteyen ölçüt yok', bekle].filter(Boolean).join(' · ')
      : (!bekle && _fpnYaziGen(kotuYaz, VE_FEAD_PANO.TABAN) <= 250) ? _frEsc(kotuYaz)
      : kotu.length + ' ölçüt kontrol istiyor' + (bekle ? '<br>' + bekle : ''));
  return h + '</div>';
}

// ── SÜTUN BLOKLARI ───────────────────────────────────────────────────────────
function _fpnYerlesim(V, W){
  var K = V.kas;
  var h = _fpnTablo([
    _fpnKol(K, '#', '', function(k, i){ return String(i + 1); }, { bs: 'l', s: 'l dim' }),
    _fpnKol(K, 'Kod', '', function(k){ return '<b>' + _frEsc(k.kod) + '</b>'; }, { bs: 'l', s: 'l' }),
    _fpnKol(K, 'Temas', '', function(k){ return k.temas; }),
    _fpnKol(K, 'Ø dış', '[mm]', function(k){ return _frFs(k.od, 1); }),
    _fpnKol(K, 'Ø ef.', '[mm]', function(k){ return _frFs(k.ef, 1); }),
    _fpnKol(K, 'X', '[mm]', function(k){ return _frFs(k.x, 1); }),
    _fpnKol(K, 'Y', '[mm]', function(k){ return _frFs(k.y, 1); }),
    _fpnKol(K, 'J', '[g·m²]', function(k){ var J = k.J * 1000; return _frFs(J, J >= 10 ? 1 : 2); })
  ], W);
  var g = K.filter(function(k){ return k.gergi; })[0];
  if(g) h += '<p class="not">' + _frEsc(g.kod) + ': X, Y avara merkezi (girdi) — montaj konumu kol açısından türer.</p>';
  return h;
}

function _fpnAciklar(V, W){
  var A = V.acik;
  return _fpnTablo([
    _fpnKol(A, '#', '', function(a){ return String(a.j + 1); }, { bs: 'l', s: 'l dim' }),
    _fpnKol(A, 'Açıklık', '', function(a){ return _frEsc(a.ad); }, { bs: 'l', s: 'l' }),
    _fpnKol(A, _fpnSub('L', 'f'), '[mm]', function(a){ return _frFs(a.Lf, 2); }),
    _fpnKol(A, _fpnSub('f', 'stat'), '[Hz]', function(a){ return _frFs(a.fStat, 1); }),
    _fpnKol(A, _fpnSub('T', 'maks'), '[N]', function(a){ return _frF(a.tMax, 0); }),
    _fpnKol(A, _fpnSub('f', '1') + ' min', '[Hz]', function(a){ return _frFs(a.f1Min, 1); }),
    _fpnKol(A, _fpnSub('f', '1') + '/' + _fpnSub('f', 'ateş'), 'min', function(a){ return _fpnKirmizi(a.oranMin < 1, _frFs(a.oranMin, 2)); })
  ], W);
}

function _fpnKayisVerileri(V, W){
  var k = V.kayis, P = k.P, Fu = k.Fu;
  var sat = [
    ['Kayış · profil · kaburga', _frEsc([k.marka, k.tip].join(' ').trim() || '—') + ' · ' + _frEsc(k.profil || '—') + ' · ' + _frF(k.kaburga, 0)],
    ['Seçilen / gereken ' + _fpnSub('L', 'b'), _frFs(k.Lb, 1) + ' / ' + _frFs(k.gereken, 1) + ' mm'],
    ['Kord ' + _fpnSub('L', 'w') + ' · tahrik boyu EDL', _frFs(k.Lw, 1) + ' · ' + _frFs(k.edl, 1) + ' mm'],
    ['Boy toleransı · aşınma', '±' + _frF(k.tol, 1) + ' mm · ' + _frPct(k.asinma * 100, 2)],
    ['Birim kütle · ' + _fpnSub('h', 'b') + ' / ' + _fpnSub('h', 'r'), _frFs(k.m, 3) + ' kg/m · ' + _frFs(k.hb, 2) + ' / ' + _frFs(k.hr, 2) + ' mm'],
    ['Kayış hızı · eğilme ' + _fpnSub('f', 'B') + ' @' + _frF(k.nTepe, 0), _frFs(k.v, 2) + ' m/s · ' + _frFs(k.fB, 1) + ' Hz'],
    ['İletilen güç · etkin çekme (maks)', (P ? _frFs(P.P, 2) + ' kW' : '—') + ' · ' + (Fu ? _frF(Fu.Fu, 0) + ' N' : '—')],
    ['Sürtünme μ: ' + _frEsc(V.surtunme ? V.surtunme.ad : '—'), _fpnSurtunmeYaz(V.surtunme)]
  ];
  return _fpnTablo([
    _fpnKol(sat, '', '', function(r){ return r[0]; }, { s: 'l e' }),
    _fpnKol(sat, '', '', function(r){ return r[1]; }, { s: 'v' })
  ], W, 'kv', true);
}

// Sürtünme seçiminin sayıları, arayüzün adlarıyla (Oluklu μ · Sırt μ ·
// küçük kasnak kaybı — ayrıntılı raporun ℓ'si, 5.7a); kayıp yoksa yazılmaz.
function _fpnSurtunmeYaz(s){
  if(!s) return '—';
  return 'oluklu ' + _frFs(s.muOluk, 2) + ' · sırt ' + _frFs(s.muSirt, 2)
    + (s.kayipMm > 0 ? ' · ℓ ' + _frF(s.kayipMm, 1) + ' mm' : '');
}

function _fpnKasnaklar(V, W){
  var K = V.kas;
  return _fpnTablo([
    _fpnKol(K, 'Kod', '', function(k){ return '<b>' + _frEsc(k.kod) + '</b>'; }, { bs: 'l', s: 'l' }),
    _fpnKol(K, 'β', '[°]', function(k){ return _frFs(k.beta, 1); }),
    _fpnKol(K, 'i', '[–]', function(k){ return _frFs(k.oran, 3); }),
    _fpnKol(K, _fpnSub('n', 'maks'), '[d/d]', function(k){ return _frF(k.nMax, 0); }),
    _fpnKol(K, _fpnSub('P', 'maks'), '[kW]', function(k){ return _frFs(k.pMax, 2); }),
    _fpnKol(K, _fpnSub('Q', 'maks'), '[Nm]', function(k){ return _frFs(k.qMax, 1); }),
    _fpnKol(K, 'SF', 'min', function(k){ return _fpnKirmizi(k.yuklu && k.sfMin < 1, _frSfYaz(k.sfMin)); }, { s: 'sf' }),
    _fpnKol(K, 'Ömür', '[%]', function(k){ return _frFs(k.omurPay, 1); })
  ], W, '', false, K.map(function(k){ return k.yuklu ? '' : 'idle'; }));
}

// ÇEVRİM TABLOSU — sütun sayısı modelden. Sığmazsa önce T_maks (ısı
// haritasının satır tepesi, orada da var), sonra aksesuar sütunları BİRLİKTE
// düşer — toplam güç P her durumda kalır. Frekans ve yorulma sütunları
// verisi yoksa hiç açılmaz.
function _fpnCevrim(V, W){
  var C = V.cev;
  var frek = C.some(function(c){ return Number.isFinite(c.oran); });
  var yor = C.some(function(c){ return Number.isFinite(c.yorulma); });
  var yMax = 0;
  C.forEach(function(c){ if(c.yorulma > yMax) yMax = c.yorulma; });
  var kol = [
    _fpnKol(C, 'n', '[d/d]', function(c){ return _frF(c.rpm, 0); }),
    _fpnKol(C, 'DC', '[%]', function(c){ return _frFs(c.dc, 1); })
  ];
  V.aks.forEach(function(ad, i){
    kol.push(_fpnKol(C, _frEsc(ad), '[kW]', function(c){ return _frFs(c.kw[i], 2); }, { dus: 1 }));
  });
  kol.push(_fpnKol(C, 'P', '[kW]', function(c){ return _frFs(c.P, 2); }));
  kol.push(_fpnKol(C, _fpnSub('F', 'u'), '[N]', function(c){ return _frF(c.Fu, 0); }));
  kol.push(_fpnKol(C, _fpnSub('T', 'maks'), '[N]', function(c){ return _frF(c.tMax, 0); }, { dus: 2 }));
  kol.push(_fpnKol(C, 'SF', 'min', function(c){ return _fpnKirmizi(c.sf < 1, _frSfYaz(c.sf)); }));
  if(frek) kol.push(_fpnKol(C, _fpnSub('f', '1') + '/' + _fpnSub('f', 'ateş'), 'min',
    function(c){ return _fpnKirmizi(c.oran < 1, _frFs(c.oran, 2)); }));
  if(yor) kol.push(_fpnKol(C, 'Yorulma', '[%]', function(c){ return _frFs(c.yorulma, 1); },
    { s: C.map(function(c){ return _fpnIsi(yMax > 0 ? c.yorulma / yMax * 0.9 : NaN); }) }));
  return _fpnTablo(kol, W, 'cev uzun');
}

function _fpnGerginlikHaritasi(V, W){
  var C = V.cev, lo = Infinity, hi = -Infinity;
  C.forEach(function(c){ c.gerg.forEach(function(x){ if(Number.isFinite(x)){ lo = Math.min(lo, x); hi = Math.max(hi, x); } }); });
  var kol = [_fpnKol(C, 'n', '[d/d]', function(c){ return _frF(c.rpm, 0); })];
  // Başlık: açıklık numarası (açıklıklar tablosunun #'i); iki ucun kodu
  // yalnız sütuna SIĞARSA (uSec).
  V.acik.forEach(function(a, j){
    kol.push(_fpnKol(C, String(j + 1), _frEsc(a.kisa), function(c){ return _frF(c.gerg[j], 0); }, {
      uSec: true, s: C.map(function(c){ return _fpnIsi(hi > lo ? (c.gerg[j] - lo) / (hi - lo) : 0); }) }));
  });
  return _fpnTablo(kol, W, 'isi uzun');
}

// Kayma haritası: yük taşıyan kasnakta SF düştükçe koyulaşır (log ölçek,
// 40 ve üstü beyaz); 1'in altı kırmızı. Yük taşımayan kasnak soluk yazılır —
// hüküm ona dayanmaz (kural 49).
function _fpnKaymaHaritasi(V, W){
  var C = V.cev, L40 = Math.log(40) / Math.LN10;
  var kol = [_fpnKol(C, 'n', '[d/d]', function(c){ return _frF(c.rpm, 0); })];
  V.kod.forEach(function(kd, i){
    kol.push(_fpnKol(C, _frEsc(kd), '', function(c){
      var yaz = _frSfYaz(c.sfK[i]);
      if(!c.yukK[i]) return '<span class="dim">' + yaz + '</span>';
      return c.sfK[i] < 1 ? '<span class="no">' + yaz + '</span>' : yaz;
    }, { s: C.map(function(c){
      var v = c.sfK[i];
      if(!c.yukK[i] || !Number.isFinite(v)) return '';
      if(v < 1) return 'kotu';
      return _fpnIsi((L40 - Math.log(Math.max(v, 1)) / Math.LN10) / L40 * 0.85);
    }) }));
  });
  return _fpnTablo(kol, W, 'isi uzun');
}

function _fpnGergi(V, W){
  var g = V.gergi;
  if(!g) return '<p class="not">Modelde otomatik gergi yok.</p>';
  var sat = [
    ['Parça', _frEsc(g.parca || '—'), 'Kol boyu a', _frF(g.kol, 0) + ' mm'],
    ['Yay ' + _fpnSub('M', '0') + ' + k·θ', _frFs(g.M0, 2) + ' + ' + _frFs(g.k, 3) + ' Nm/°', 'Pivot', _fpnXY(g.pivot)],
    ['Kol açısı ' + _fpnSub('A', 's'), _frFs(g.abs, 1) + '° (' + _frFs(g.rel, 2) + '°)', 'Avara', _fpnXY(g.avara)],
    ['Take-up', _frFs(g.takeup, 3) + ' mm/°', 'Göbek yükü', _frFs(g.FL, 1) + ' N · ' + _frFs(g.FLyon, 1) + '°']
  ];
  return _fpnTablo([0, 1, 2, 3].map(function(c){
    return _fpnKol(sat, '', '', function(r){ return r[c]; },
      { s: c % 2 ? 'v' : (c ? 'l e ic' : 'l e'), pad: c === 2 ? 7 : 0 });     // .ic: +7 px sol dolgu
  }), W, 'kv', true);
}

// Kol zarfı — §8.8'in konumları; çalışma konumu (Mean) vurgulu. Load bir
// mekanik durdurucudur, çalışma noktası değildir (başlıkta yazılı).
function _fpnZarf(V, W){
  var Z = V.zarf;
  if(!Z.length) return '<p class="not">Konum tablosu çözülemedi.</p>';
  var ad = (typeof _frPosLabels === 'function') ? _frPosLabels(true) : {};
  var sat = [[_fpnSub('θ', 'rel') + ' [°]', 'rel', 2], [_fpnSub('A', 's') + ' [°]', 'abs', 1], ['T [N]', 'T', 0],
             [_fpnSub('F', 'L') + ' [N]', 'FL', 0], ['Sarım [°]', 'sarim', 1], [_fpnSub('L', 'b') + ' [mm]', 'Lb', 1]];
  var kol = [_fpnKol(sat, '', '', function(r){ return r[0]; }, { bs: 'l', s: 'l e' })];
  Z.forEach(function(z){
    var m = z.konum === 'Mean' ? 'mean' : '';
    kol.push(_fpnKol(sat, _frEsc(ad[z.konum] || z.konum), '', function(r){
      return z.hata ? 'hata' : (r[2] ? _frFs(z[r[1]], r[2]) : _frF(z[r[1]], 0));
    }, { bs: m, s: m }));
  });
  return _fpnTablo(kol, W, 'zarf');
}

function _fpnBurulma(V, W){
  var B = V.burulma;
  if(!B) return '<p class="not">Burulma modeli kurulamadı — ataletler eksik.</p>';
  var M = B.modlar;
  return _fpnTablo([
    _fpnKol(M, 'Mod', '', function(md){ return md.mod + '. elastik'; }, { bs: 'l', s: 'l' }),
    _fpnKol(M, 'f', '[Hz]', function(md){ return _frFs(md.f, 1); }),
    _fpnKol(M, Number.isFinite(B.atesMert) ? _frF(B.atesMert, 1) + '. mertebe' : 'Ateşleme', '[d/d]',
      function(md){ return _frF(md.atesRpm, 0); }),
    _fpnKol(M, 'Bantta kesişme', '(mertebe @ d/d)', function(md){
      return md.kes.length ? md.kes.map(function(k){ return '<b>' + _frF(k.o, 1) + '×</b> ' + _frF(k.rpm, 0); }).join(' · ')
        : '<span class="dim">yok</span>'; }, { bs: 'l', s: 'l' })
  ], W);
}

function _fpnHubTablo(V, W){
  var K = V.kas;
  var h = _fpnTablo([
    _fpnKol(K, 'Kod', '', function(k){ return '<b>' + _frEsc(k.kod) + '</b>'; }, { bs: 'l', s: 'l' }),
    _fpnKol(K, _fpnSub('F', 'L,stat'), '[N]', function(k){ return _frF(k.flStat, 0); }),
    _fpnKol(K, 'Yön', '[°]', function(k){ return _frF(k.flStatYon, 0); }),
    _fpnKol(K, _fpnSub('F', 'L,din'), '[N]', function(k){ return _frF(k.flDin, 0); }),
    _fpnKol(K, 'Yön', '[°]', function(k){ return _frF(k.flDinYon, 0); }),
    _fpnKol(K, '@', '[d/d]', function(k){ return _frF(k.flDinRpm, 0); }),
    _fpnKol(K, _fpnSub('F', 'L,tepe'), '[N]', function(k){ return _frF(k.flTepe, 0); })
  ], W);
  var t = V.tepe;
  return h + '<p class="not">' + (t ? 'Tepe @' + _frF(t.rpm, 0) + ' d/d ±' + _frF(t.ivme, 0) + ' d/d/s · sapma '
    + (typeof VE_FSR_PEAK_BAND === 'string' ? VE_FSR_PEAK_BAND : '—') : 'Tepe yük hesaplanamadı.') + '</p>';
}

function _fpnUygunluk(V, W){
  var U = V.uyg;
  return _fpnTablo([
    _fpnKol(U, '', '', function(u){ return VE_FEAD_PANO_ISARET[u.durum] || '–'; }, { s: U.map(function(u){ return 'd ' + u.durum; }) }),
    _fpnKol(U, '', '', function(u){ return _frEsc(u.kisa); }, { s: 'l' }),
    _fpnKol(U, '', '', function(u){ return u.kisaBulgu; }, { s: 'l b' })
  ], W, 'kv uyg', true);
}

function _fpnNotListe(V){
  return '<ul class="notlar">' + V.notlar.map(function(x){ return '<li>' + x.metin + '</li>'; }).join('')
    + (V.notKalan ? '<li class="kalan">+' + V.notKalan + ' not daha — ayrıntılı raporda.</li>' : '') + '</ul>';
}

function _fpnTarih(ms){
  if(!(ms > 0)) return '—';
  var d = new Date(ms);
  var p = function(x){ return (x < 10 ? '0' : '') + x; };
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// Bir blok — kimliği, esnek kutusunun boyu (0: esnek değil) ve DURDUĞU
// sütunun eni (blok ev sütunundan kayabilir; tablo ve çizim o sütuna kurulur).
function _fpnBlok(R, V, id, eh, W){
  var sv = V.servis;
  var kutu = function(svg){ return svg ? '<div class="cizim" style="height:' + eh + 'px">' + svg + '</div>'
    : '<p class="not">Çizim kurulamadı.</p>'; };
  var graf = function(g){
    if(!g) return '<p class="not">Grafik çizilemedi.</p>';
    return '<div class="graf" style="height:' + eh + 'px">' + _fpnTaban(g.svg, W / g.W) + '</div>';
  };
  switch(id){
    case 'yol':
      return _fpnH2('Kayış Yolu', V.gerilme ? 'açıklık gerilmesi · ' + _frF(V.gerilme.engineRpm, 0) + ' d/d' : 'kasnak kodları')
        + kutu(_fpnCizim(R, V, W, eh, { tension: V.gerilme || undefined }));
    case 'yer':
      return _fpnH2('Kasnak yerleşimi', 'K kaburgalı · S sırt · J atalet') + _fpnYerlesim(V, W);
    case 'acik':
      return _fpnH2('Açıklıklar', _fpnSub('F', 'stat') + ' = ' + _frFs(V.kayis.Fstat, 1) + ' N · '
        + _fpnSub('f', 'stat') + ': montaj ölçümü') + _fpnAciklar(V, W);
    case 'kayis':
      return _fpnH2('Kayış') + _fpnKayisVerileri(V, W);
    case 'kas':
      return _fpnH2('Kasnaklar', 'çevrimde en büyük · ' + _fpnSub('Q', 'maks') + ': mil torku · SF: en düşük')
        + _fpnKasnaklar(V, W);
    case 'cev':
      return _fpnH2('Çalışma çevrimi', V.cev.length + ' nokta · ' + _frPct(V.kunye.cevrimPay, 0)
        + (V.cev.some(function(c){ return Number.isFinite(c.yorulma); }) ? ' · yorulma: hasara katkı' : ''))
        + _fpnCevrim(V, W);
    case 'gerg':
      return _fpnH2('Açıklık gerginlik haritası', '[N] · her devirde · koyu: yüksek') + _fpnGerginlikHaritasi(V, W);
    case 'kay':
      return _fpnH2('Kayma emniyeti haritası', 'SF · ' + (sv.secili ? 'c₂ = ' + _frEsc(sv.yaz) : 'en kötü koşul')
        + ' · soluk: yük taşımaz') + _fpnKaymaHaritasi(V, W);
    case 'gergi':
      return _fpnH2('Gergi', V.gergi ? [V.gergi.kunye ? _frEsc(V.gergi.kunye) : '',
        Number.isFinite(V.gergi.kolHz) ? 'kol modu ' + _frFs(V.gergi.kolHz, 1) + ' Hz' : ''].filter(Boolean).join(' · ') : '')
        + _fpnGergi(V, W);
    case 'zarf':
      return _fpnH2('Gergi kolu zarfı', V.zarf.length + ' konum · Load bir mekanik durdurucudur') + _fpnZarf(V, W);
    case 'egri':
      return _fpnH2('Gerginlik kontrol eğrisi', 'kol açısı → T')
        + (eh > 0 ? graf(_fpnGrafik(typeof _frTensionFigure === 'function' ? _frTensionFigure : null, R, W, eh))
                  : '<p class="not">Modelde otomatik gergi yok.</p>');
    case 'motor':
      var S = V.senaryo;
      return _fpnH2('Motor çevrimi', S ? 'marş → stop · ' + _frFs(S.T, 1) + ' s'
          + (Number.isFinite(S.ivme) ? ' · rampa ' + _frF(S.ivme, 0) + ' d/d/s' : '') : '')
        + (S && eh > 0 ? '<div class="graf" style="height:' + eh + 'px">' + _fpnMotorGrafik(S, W, eh) + '</div>'
               + '<p class="not">Devir dayatılır · ' + (S.egri ? 'rampa tork eğrisinden' : 'rampa doğrusal')
               + ' · gergi kolu dinamiği yok</p>'
             : '<p class="not">Senaryo çözümde yok — kayış verisiyle yeniden çözün.</p>');
    case 'bur':
      var B = V.burulma;
      return _fpnH2('Burulma titreşimi', B ? B.modlar.length + ' elastik mod · bant ' + _frF(B.bantLo, 0) + '–'
        + _frF(B.bantHi, 0) + ' d/d' : '') + _fpnBurulma(V, W);
    case 'frek':
      return _fpnH2('Doğal frekans haritası', 'açıklık ' + _fpnSub('f', '1') + ' · ateşleme katları')
        + (eh > 0 ? graf(_fpnGrafik(typeof _frFreqFigure === 'function' ? _frFreqFigure : null, R, W, eh,
                                    undefined, { xEtiketAdim: 2 }))
                  : '<p class="not">Kayış verisi kapalı — açıklık frekansı üretilmedi.</p>');
    case 'hub':
      return _fpnH2('Hubload', 'ok: çevrimde en büyük', 'tepe: kalibre değil')
        + kutu(_fpnCizim(R, V, W, eh, { arrows: false, wrapLabels: false, ek: _fpnHubOklari(V) }))
        + _fpnHubTablo(V, W);
    case 'uyg':
      var say = _fpnUygSay(V);
      return _fpnH2('Uygunluk', V.uyg.length + ' ölçüt · ' + ['ok', 'warn', 'no', 'wait'].filter(function(d){ return say[d]; })
        .map(function(d){ return say[d] + ' ' + VE_FEAD_PANO_ISARET[d]; }).join(' · ')) + _fpnUygunluk(V, W);
    case 'not':
      return _fpnH2('Tasarım notları ve sınırlar', 'çözümün uyarıları') + _fpnNotListe(V);
  }
  return '';
}

// Sayfanın gövdesi — dört sütun, dizilim `_fpnOlcu`'dan.
function _fpnSayfa(R, V){
  var P = VE_FEAD_PANO, O = _fpnOlcu(V), k = V.kunye;
  var baslik = k.proje || 'Aksesuar kayış tahrik sistemi';
  var sistem = (k.proje ? 'Aksesuar kayış tahrik sistemi · ' : '') + V.n + ' kasnak · tahrik boyu '
    + _frF(k.uzunluk, 1) + ' mm';
  var hucre = function(ad, deger){ return '<span><i>' + ad + '</i>' + _frEsc(deger || '—') + '</span>'; };
  var motor = [k.motor, Number.isFinite(k.silindir) && k.silindir > 0 ? _frF(k.silindir, 0) + ' sil.' : ''].filter(Boolean).join(' · ');

  var h = '<section class="pn' + (O.tasma ? ' tasma' : '') + '" style="--uzun:' + O.uzun + 'px">';
  h += '<div class="ust"><div class="ad"><span>MFSim · FEAD · A3 sonuç panosu</span><b>' + _frEsc(baslik) + '</b>'
    + '<span>' + _frEsc(sistem) + '</span></div>'
    + '<div class="kn">' + hucre('Kayış', k.kayis) + hucre('Motor', motor)
    + hucre('Çevrim', k.cevrim + ' nokta · ' + _frPct(k.cevrimPay, 0)) + hucre('Çözüm', _fpnTarih(k.cozum))
    + hucre('Doküman', k.dokuman) + hucre('Rev', k.rev) + hucre('Hazırlayan', k.hazirlayan)
    + hucre('Kontrol', k.kontrol) + hucre('Onay', k.onay) + hucre('Sayfa', '1 / ' + O.sayfa) + '</div></div>';
  h += '<div class="cz"></div>';
  h += _fpnKpiler(V);
  h += '<div class="govde"' + (O.tasma ? '' : ' style="height:' + O.govde + 'px"') + '>';
  O.sutunlar.forEach(function(s, c){
    h += '<div class="sut">' + s.blok.map(function(x){
      return '<div class="blok" data-blok="' + x.id + '">' + _fpnBlok(R, V, x.id, x.esnek, P.SUTUN[c]) + '</div>';
    }).join('') + '</div>';
  });
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
// Punto ölçeği beş basamak ve TEK yerde: gövde 8 pt, birim/alt başlık 7 pt,
// blok başlığı 9 pt, gösterge 14 pt, sayfa adı 16 pt. Mürekkep ekranın
// --ink-* jetonlarıyla birebir (belge-paleti kapısı); kâğıt beyaz. Çizicinin
// jetonları `.pn` üstünde — tanımsız var() kalıtılan `stroke` için `none`
// demek, çizim görünmez olurdu. Isı tonları belge aksanının (--vurgu)
// saydamlıkları: kâğıt beyaz olduğu için yazı her tonda koyu kalır.
function _fpnCss(){
  var P = VE_FEAD_PANO;
  var isi = [];
  for(var q = 1; q <= 8; q++) isi.push('.pn td.i' + q + '{background:rgba(150,68,31,' + (q * 0.05).toFixed(2) + ')}');   // makine: CSS saydamlığı
  return [
    ':root{',
    '  --ink:#26241f;--vurgu:#96441f;--check:#2a6140;--warn:#6d5310;--bad:#a8321f;',
    '  --dim:#4a525e;--ink2:#3c4350;--paper:#ffffff;--line:#c6c0b4;--rule:#9c9486;--soft:#e6e1d8;',
    '  --f-govde:10.667px;--f-ikincil:9.333px;--f-h:12px;--f-kpi:18.667px;--f-ad:21.333px;--f-alt:.72em;',
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
    '.pn .ust .ad{display:flex;flex-direction:column;gap:1px;min-width:0}',
    '.pn .ust .ad span{color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn .ust .ad b{font-size:var(--f-ad);font-weight:600;letter-spacing:-.01em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn .ust .kn{display:grid;grid-template-columns:repeat(5,auto);column-gap:18px;row-gap:2px;flex:none}',
    '.pn .ust .kn span{white-space:nowrap}',
    '.pn .ust .kn i{font-style:normal;color:var(--dim);margin-right:5px}',
    '.pn .cz{height:2px;margin-top:4px;background:var(--ink)}',
    '.pn .kpis{height:' + P.KPI + 'px;margin-top:10px;display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:8px}',
    '.pn .kpi{border:1px solid var(--line);border-top:3px solid var(--rule);padding:4px 7px;display:flex;flex-direction:column;min-width:0;overflow:hidden}',
    '.pn .kpi[data-d="ok"]{border-top-color:var(--check)}',
    '.pn .kpi[data-d="warn"]{border-top-color:var(--warn)}',
    '.pn .kpi[data-d="no"]{border-top-color:var(--bad)}',
    '.pn .kpi > *{flex:none}',
    '.pn .kpi .k{color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn .kpi b{font-size:var(--f-kpi);font-weight:600;line-height:1.15;letter-spacing:-.01em;white-space:nowrap}',
    '.pn .kpi b small{font-size:var(--f-h);font-weight:500;margin-left:3px;color:var(--ink2)}',
    '.pn .kpi[data-d="no"] > b{color:var(--bad)}',
    '.pn .kpi .s{color:var(--dim);line-height:1.2}',
    '.pn .govde{margin-top:10px;display:grid;grid-template-columns:' + P.SUTUN.join('px ') + 'px;column-gap:' + P.ARA + 'px}',
    '.pn .sut{display:flex;flex-direction:column;gap:' + P.BLOK + 'px;min-width:0}',
    '.pn h2{height:' + (P.BASLIK - 3) + 'px;margin:0 0 3px;font-size:var(--f-h);font-weight:600;line-height:15px;display:flex;',
    '  align-items:baseline;gap:8px;padding-bottom:2px;border-bottom:1px solid var(--ink);white-space:nowrap}',
    '.pn h2 small{font-size:var(--f-ikincil);font-weight:400;color:var(--dim);margin-left:auto;overflow:hidden;text-overflow:ellipsis}',
    // Damga büyük harfle BASILIR ama küçük YAZILIR (özet raporun `.stamp`ı):
    // lang="tr" belgede i → İ doğru çevrilir, cümle düzeni kapısı metni okur.
    '.pn .dmg{display:inline-block;font-size:var(--f-ikincil);font-weight:600;letter-spacing:.04em;color:var(--warn);',
    '  border:1px solid var(--warn);padding:0 4px;line-height:12px;text-transform:uppercase}',
    '.pn table{border-collapse:collapse;width:100%;table-layout:fixed}',
    // Kesilen sayı sessizce YANLIŞ okunur ("30.900" → "30.9"); üç nokta
    // kesildiğini söyler. Örneklerde hiç kesilmiyor — kapı tarayıcıda ölçer.
    '.pn th,.pn td{padding:0 3px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn td{height:' + P.SATIR + 'px;line-height:1.15;border-bottom:1px solid var(--soft)}',
    '.pn table.uzun td{height:var(--uzun)}',
    '.pn th{height:' + P.TH + 'px;font-weight:600;line-height:1.1;vertical-align:bottom;padding-bottom:2px;border-bottom:1px solid var(--rule)}',
    '.pn th i{display:block;font-style:normal;font-weight:400;font-size:var(--f-ikincil);color:var(--dim)}',
    '.pn .l{text-align:left}',
    '.pn .dim,.pn tr.idle td.sf{color:var(--dim)}',
    '.pn .no{color:var(--bad);font-weight:600}',
    '.pn sub{font-size:var(--f-alt);line-height:0;vertical-align:-.25em}',
    '.pn .kv td.e{color:var(--ink2)}',
    '.pn .kv td.ic{padding-left:10px}',
    '.pn .kv td.v{font-weight:500}',
    '.pn .zarf th.mean,.pn .zarf td.mean{background:rgba(150,68,31,.08)}',
    '.pn .isi td{border-bottom:1px solid var(--paper)}',
    isi.join('\n'),
    '.pn td.kotu{background:rgba(168,50,31,.16)}',
    '.pn .uyg td.d{text-align:center;font-weight:700}',
    '.pn .uyg td.b{color:var(--ink2)}',
    '.pn .cizim{position:relative;overflow:hidden}',
    '.pn .cizim svg{position:absolute;left:0;top:0;width:100%;height:100%}',
    '.pn .graf{overflow:hidden}',
    '.pn .graf svg{display:block;width:100%;height:100%}',
    '.pn svg text:not([fill="var(--on-accent)"]){paint-order:stroke;stroke:#ffffff;stroke-width:3px;stroke-linejoin:round}',
    '.pn .not{margin:0;height:' + P.NOT + 'px;line-height:' + P.NOT + 'px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn .notlar{margin:0;padding-left:14px;color:var(--ink)}',
    '.pn .notlar li{line-height:' + P.MADDE + 'px}',
    '.pn .notlar li.kalan{color:var(--dim)}',
    '.pn .ok{color:var(--check)}.pn .warn{color:var(--warn)}.pn b.no,.pn span.no{color:var(--bad)}.pn .wait{color:var(--dim)}',
    '@page{size:A3 landscape;margin:0}',
    '@media print{body{background:var(--paper)}.pn{margin:0;box-shadow:none}}'
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_PANO: VE_FEAD_PANO,
    VE_FEAD_PANO_ESNEK: VE_FEAD_PANO_ESNEK,
    VE_FEAD_PANO_ISARET: VE_FEAD_PANO_ISARET,
    veFeadPanoVeri: veFeadPanoVeri,
    veFeadPanoHTML: veFeadPanoHTML,
    _fpnGovdeH: _fpnGovdeH,
    _fpnTaban: _fpnTaban,
    _fpnYaziGen: _fpnYaziGen,
    _fpnSutunlar: _fpnSutunlar,
    _fpnCevrim: _fpnCevrim,
    _fpnBloklar: _fpnBloklar,
    _fpnDagit: _fpnDagit,
    _fpnDizilim: _fpnDizilim,
    _fpnOlcu: _fpnOlcu,
    _fpnMotorGrafik: _fpnMotorGrafik,
    _fpnCss: _fpnCss
  };
}
