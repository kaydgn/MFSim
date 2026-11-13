// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ — PARAMETRİK ANALİZ RAPORU (Katalogdan seçim)
// ════════════════════════════════════════════════════════════════════════════
// Taramanın sonucu ana rapordan AYRI bir belgedir (kullanıcı, 2026-10-16:
// "Rapor kısmına eklersek çok uzun olabilir"). Başlık, yazı tipi, KaTeX ve
// tipografi ana raporun şablonundan (MNT_REPORT_TEMPLATE_B64): belgenin
// <head>'i ve sayfa kabuğu oradan, gövde burada kurulur — iki belge aynı
// görünür. Sayı yazımı ve kaçış cp-mount-report.js'in yardımcılarından (_rF,
// _rEsc, _rTeX, _rBolunmez).
//
// Sıralama pencerenin ve Excel'in kuralı (kullanıcı kararı 2026-11-10): dört kesin
// kriter, sonra en küçük statik sehim; K0 mevcut tasarım, K1…K9 sıranın ilk dokuzu.
// Rapor AYNI listeyi yazar — kendi sırası yok.
//
// Girdi E (js/cp-mount-param-sonuc.js → _mntParamZenginlestir):
//   { S (özet), M (model), A (aday tipler), sabit, ctx (bağlam), kSay,
//     konfig:[{ K, mevcut, tipler, uygunluk, kriter[4], d, T, fMin, o1, o2, h (hüküm),
//               ad (grup başına tip adı) }], tarih }
// ════════════════════════════════════════════════════════════════════════════

// Dayanaklar — §3'ün kaynak sütunu ve Kaynaklar listesi aynı tablodan. Yalnız
// okunmuş kaynaklar (literatür taraması 2026-10-16); sayı kaynağın verdiğidir.
var _MNT_PRM_KAYNAK = [
  { k:'sirket', ad:'Şirket motor takozu hedef kriterleri: Kriter 1 · 1a · 1b · 2 (ana raporun “Motor takozu uygunluğu” tablosu).' },
  { k:'shen', ad:'Shen, Zhang, Jin (2024), “Optimization of a commercial vehicle powertrain mounting system …”, Journal of Vibroengineering 26(2), doi:10.21595/jve.2023.23536 — ticari araç: statik sehim 3–5 mm, en düşük mod ≥ 5 Hz, KED ≥ %80, rijitlik toleransı ±%15.' },
  { k:'torgal', ad:'Torgal, Saxena (2015), “Methodology for … powertrain vibration reduction in passenger bus …”, IJIRSET 4(7) — 10 t otobüs: 1 g’de statik sehim ≤ 3 mm, rijitlik toleransı ±%15, taban rijitliği ≥ 5 × takoz.' },
  { k:'bmc', ad:'BMC R&D FEA raporu, güç grubu takoz sehimleri (“Max. Displacement Results”: 1 g düşey 4,0–5,8 mm, 3,5 g düşey 11,8–17,5 mm) ve ±15 mm metal–metal durdurucu.' }
];
function _mntPrmKaynakNo(k){
  for(var i=0;i<_MNT_PRM_KAYNAK.length;i++) if(_MNT_PRM_KAYNAK[i].k===k) return i+1;
  throw new Error('Kaynak yok: '+k);
}
function _mntPrmRef(){
  return Array.prototype.slice.call(arguments).map(function(k){ return '['+_mntPrmKaynakNo(k)+']'; }).join(' ');
}

var _prmTbl=0, _prmFig=0;
function _mntPrmEnBuyuk(a){ var m=-Infinity; (a||[]).forEach(function(v){ v=Math.abs(v); if(v>m) m=v; }); return m===-Infinity ? NaN : m; }
function _mntPrmMinAralik(f){
  var s=(f||[]).slice().sort(function(a, b){ return a-b; }), g=Infinity;
  for(var i=1;i<s.length;i++) g=Math.min(g, s[i]-s[i-1]);
  return g;
}
function _mntPrmTipAdi(E, key){
  if(!key) return '—';
  var k=veMntKatalog.konumOku(key);
  if(k) return 'Δx '+_mntPrmKayma(k.dx)+' · Δz '+_mntPrmKayma(k.dz)+' mm';
  var e=E.M.lib[key];
  return e ? e.name : key;
}
function _mntPrmKayma(v){ return (v>0 ? '+' : '')+_rF(v, Math.abs(v-Math.round(v))>1e-9 ? 1 : 0); }
function _mntPrmKonumMu(E){ return E.analiz==='konum'; }
// Konum taramasının eksenleri — adayların kaymalarından (artan).
function _mntPrmKonumEksen(E){
  var x={}, z={};
  (E.A || []).forEach(function(a){ if(a.konum){ x[a.dx]=true; z[a.dz]=true; } });
  var s=function(o){ return Object.keys(o).map(Number).sort(function(a, b){ return a-b; }); };
  return { ax:s(x), az:s(z) };
}
// Tip adı tablo hücresinde: sertlik ("55 ShA") ve katalog kodu ("(AMC 137981)") bölünmez.
function _mntPrmTipYaz(ad){
  return _rEsc(ad).replace(/(\d+) ShA\b/g, '<span style="white-space:nowrap">$1 ShA</span>')
    .replace(/\(([^()]*)\)/g, '<span style="white-space:nowrap">($1)</span>');
}
function _mntPrmYuzde(v, d){ return Number.isFinite(v) ? '%'+_rF(v*100, d==null ? 1 : d) : '—'; }
function _mntPrmTik(ok){ return ok ? '<span class="ok">✓</span>' : '<span style="color:var(--warn);font-weight:600;">✗</span>'; }   // sabit renk: belge gövdesi
// Dört kesin kriter: anahtar, kayıt, ad (pencerenin adı) ve değer yazısı.
var _MNT_PRM_KR = ['k1', 'k1a', 'k1b', 'k2'];
function _mntPrmQ(k){ var L=veMntKatalog.KISITLAR; for(var i=0;i<L.length;i++) if(L[i].k===k) return L[i]; return { k:k, no:k, ad:k }; }
function _mntPrmKrAdi(k, no){
  var Q=_mntPrmQ(k), ad=(typeof _MNT_PARAM_KRITER_AD!=='undefined' && _MNT_PARAM_KRITER_AD[k]) || Q.ad;
  return no ? 'Kriter '+Q.no+' · '+ad : ad;
}
// Değer sınırla aynı görünmez: yuvarlanınca sınıra eşit çıkan değerin ondalığı uzar.
function _mntPrmSinirli(v, lim, d){
  if(!Number.isFinite(v)) return '—';
  var k=d, p=function(x){ return Math.round(x*Math.pow(10, k)); };
  while(k<d+3 && Number.isFinite(lim) && v!==lim && p(v)===p(lim)) k++;
  return _rF(v, k);
}
// 8–10 Hz bandındaki ilk mod (anma ya da tolerans köşesi); yoksa null.
function _mntPrmBantF(o){
  var B=veMntKatalog.K1B, f=null;
  [o].concat(o && o.sert ? [o.sert, o.yumusak] : []).forEach(function(x){
    ((x && x.f) || []).forEach(function(v){ if(f===null && v>=B[0] && v<=B[1]) f=v; });
  });
  return f;
}
// Kriterin değeri ve hükmü: { v, ok } — hüküm taramanınkinin aynısı (veMntKatalog.hepsi).
function _mntPrmKrDeger(K, k){
  var h=K.h && K.h[k];
  if(!h) return { v:'—', ok:null };
  var v;
  if(k==='k1') v=_mntPrmSinirli(h.deger, h.sinir, 2)+' Hz';
  else if(k==='k1a') v=_mntPrmSinirli(h.deger, h.sinir, 2)+' Hz';
  else if(k==='k1b'){ var f=_mntPrmBantF(K.o1); v=h.ok ? 'Yok' : (f===null ? 'Bantta' : _rF(f, 1)+' Hz'); }
  else v=Number.isFinite(h.deger) ? '%'+_mntPrmSinirli(h.deger*100, h.sinir*100, 1) : '—';
  return { v:v, ok:!!h.ok };
}
function _mntPrmIsaret(ok){ return ok===null ? '' : ' '+_mntPrmTik(ok); }

// ── Antet ve içindekiler ────────────────────────────────────────────────────
function _mntPrmAntet(E){
  var tarih='—';
  try { tarih=E.tarih.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' }); } catch(e){}
  var m=E.konfig[0] && E.konfig[0].o1 ? E.konfig[0].o1.m : NaN;
  return '<div class="antet"><div class="band">'
    + '<div class="eyebrow">Parametrik analiz · '+(_mntPrmKonumMu(E) ? 'Konum taraması' : 'Katalogdan seçim')+'</div>'
    + '<h1>'+(_mntPrmKonumMu(E) ? 'Güç grubu takoz sistemi: Takoz konumu taraması' : 'Güç grubu takoz sistemi: Katalogdan takoz seçimi')+'</h1></div>'
    + '<div class="fields">'
    + '<div class="f"><div class="k">Model</div><div class="v">'+E.M.gather.components.length+' gövde · '+E.M.tak.length+' takoz · '+E.M.G.length+' grup</div></div>'
    + '<div class="f"><div class="k">Toplam kütle</div><div class="v">'+_rF(m, 1)+' kg</div></div>'
    + '<div class="f"><div class="k">'+(_mntPrmKonumMu(E) ? 'Aday konum' : 'Aday tip')+'</div><div class="v">'+E.A.length+'</div></div>'
    + '<div class="f"><div class="k">Kombinasyon</div><div class="v">'+_rF(E.S.N, 0)+'</div></div>'
    + '<div class="f"><div class="k">Tarih</div><div class="v">'+_rEsc(tarih)+'</div></div>'
    + '</div></div>';
}
function _mntPrmToc(){
  var b=[['p1','1','Kapsam'], ['p2','2','Yöntem'], ['p3','3','Kriterler'], ['p4','4','Kriterleri sağlayan'],
         ['p5','5','Sonuç'], ['p6','6','Konfigürasyonlar'], ['p7','7','Varsayımlar ve sınırlar'], ['pk','K','Kaynaklar']];
  return '<div class="toc">'+b.map(function(x){ return '<a href="#'+x[0]+'"><span class="n">'+x[1]+'</span>'+x[2]+'</a>'; }).join('')+'</div>';
}

// ── 1 Kapsam ────────────────────────────────────────────────────────────────
function _mntPrmKapsam(E){
  var M=E.M, c=E.ctx, o=(E.konfig[0] && E.konfig[0].o1) || {};
  var h='<h2 id="p1"><span class="no">1</span>Kapsam</h2>';
  if(_mntPrmKonumMu(E)) return h+_mntPrmKapsamKonum(E)+_mntPrmGirdi(E, o);
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Takoz grupları</caption>'
   + '<tr><th>No</th><th>Grup</th><th>Takozlar</th><th>x [mm]</th><th>Mevcut tip</th><th>Tarama</th></tr>';
  M.G.forEach(function(g){
    h+='<tr><td class="c">'+g.no+'</td><td class="l">'+_rEsc(g.ad)+'</td><td class="c">'+g.uyeler.length+'</td>'
     + '<td>'+_rF(g.x, 0)+'</td><td class="l">'+_mntPrmTipYaz(_mntParamGrupTipAdi(E.M, g))+'</td>'
     + '<td class="c">'+(E.sabit[g.anahtar] ? 'sabit' : 'taranır')+'</td></tr>';
  });
  h+='</table>';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Aday tipler (statik ve dinamik rijitlik, N/mm)</caption>'
   + '<tr><th>Tip</th><th>k<sub>x</sub> stat.</th><th>k<sub>y</sub> stat.</th><th>k<sub>z</sub> stat.</th>'
   + '<th>k<sub>x</sub> din.</th><th>k<sub>y</sub> din.</th><th>k<sub>z</sub> din.</th><th>Yasa</th></tr>';
  E.A.forEach(function(a){
    var e=a.e;
    h+='<tr><td class="l">'+_mntPrmTipYaz(a.name)+'</td><td>'+_rF(e.sx, 0)+'</td><td>'+_rF(e.sy, 0)+'</td><td>'+_rF(e.sz, 0)+'</td>'
     + '<td>'+_rF(e.dx, 0)+'</td><td>'+_rF(e.dy, 0)+'</td><td>'+_rF(e.dz, 0)+'</td>'
     + '<td class="c">'+((e.fitX||e.fitY||e.fitZ||e.curveX||e.curveY||e.curveZ) ? 'eğri' : 'doğrusal')+'</td></tr>';
  });
  h+='</table>';
  return h+_mntPrmGirdi(E, o);
}
// Konum taramasının grupları ve konum aralığı.
function _mntPrmKapsamKonum(E){
  var M=E.M, K=_mntPrmKonumEksen(E);
  var h='<table><caption>Tablo '+(++_prmTbl)+' — Takoz grupları</caption>'
   + '<tr><th>No</th><th>Grup</th><th>Takozlar</th><th>x [mm]</th><th>z [mm]</th><th>Tip</th><th>Tarama</th></tr>';
  M.G.forEach(function(g){
    h+='<tr><td class="c">'+g.no+'</td><td class="l">'+_rEsc(g.ad)+'</td><td class="c">'+g.uyeler.length+'</td>'
     + '<td>'+_rF(g.x, 0)+'</td><td>'+_rF(g.z, 0)+'</td><td class="l">'+_mntPrmTipYaz(_mntParamGrupTipAdi(E.M, g))+'</td>'
     + '<td class="c">'+(E.sabit[g.anahtar] ? 'sabit' : 'taranır')+'</td></tr>';
  });
  h+='</table>';
  var sat=function(ad, v){
    return '<tr><td class="l">'+ad+'</td><td>'+_rF(v[0], 0)+'</td><td>'+_rF(v[v.length-1], 0)+'</td><td class="c">'+v.length+'</td>'
      + '<td class="l">'+v.map(_mntPrmKayma).join('; ')+'</td></tr>';
  };
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Konum aralığı (grubun bütün takozları aynı kayar, mm)</caption>'
   + '<tr><th>Yön</th><th>En az</th><th>En çok</th><th>Değer</th><th>Kaymalar</th></tr>'
   + sat('Boyuna Δx', K.ax)+sat('Düşey Δz', K.az)+'</table>';
  return h;
}
function _mntPrmGirdi(E, o){
  var M=E.M, c=E.ctx, h='';
  var mod={ auto:'otomatik', linear:'doğrusal', nonlinear:'nonlineer' }[o.mod] || '—';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Tarama girdileri</caption><tr><th>Büyüklük</th><th>Değer</th></tr>'
   + '<tr><td class="l">Rölanti devri · silindir sayısı</td><td>'+_rF(M.eng.idleRpm, 0)+' d/dk · '+_rF(M.eng.cylinders, 0)+'</td></tr>'
   + '<tr><td class="l">Ateşleme frekansı f<sub>ateş</sub> = (N/60)·(z/2)</td><td>'+_rF(c.fAtes, 1)+' Hz</td></tr>'
   + '<tr><td class="l">Sönüm oranı ζ</td><td>'+_rF(o.zeta, 3)+'</td></tr>'
   + '<tr><td class="l">Çözüm modu</td><td>'+_rEsc(mod)+'</td></tr>'
   + '<tr><td class="l">Rijitlik toleransı</td><td>'+(c.acik.tolerans ? '±%'+_rF(c.s.tolerans*100, 0) : 'kapalı')+'</td></tr>'
   + '<tr><td class="l">Taranan grup · '+(_mntPrmKonumMu(E) ? 'aday konum' : 'aday tip')+'</td><td>'+E.S.taranan.length+' · '+E.A.length+'</td></tr>'
   + '<tr><td class="l">Kombinasyon</td><td>'+_rF(E.S.N, 0)+'</td></tr>'
   + '<tr><td class="l">Tarama süresi</td><td>'+_rF(E.S.sure/1000, 1)+' s</td></tr></table>';
  return h;
}

// ── 2 Yöntem ────────────────────────────────────────────────────────────────
function _mntPrmYontem(E){
  var c=E.ctx, n=E.kSay;
  var h='<h2 id="p2"><span class="no">2</span>Yöntem</h2>';
  h+='<p>'+(_mntPrmKonumMu(E)
      ? 'Her kombinasyonda bir grubun bütün takozları aynı boyuna (Δx) ve düşey (Δz) kaymayı alır: sağ ve sol takoz y’de ayna kalır, takoz tipleri ve eksenleri değişmez. '
      : 'Her kombinasyonda bir grubun bütün takozlarına aynı kütüphane tipi atanır: sağ ve sol takoz aynı tiptir, takoz konumları değişmez. ')
   + 'Model ana raporun Bölüm 8’indeki çözüm yolundan geçer — statik denge (nonlineer yasalı takozda Newton–Raphson, ±15 mm metal–metal durdurucu) '
   + 've statik dengedeki dinamik tanjant rijitlikle modal analiz (Bölüm 7). Sabit gruplar modeldeki takoz verisini korur.</p>';
  h+='<p>Her kombinasyonda 1 g statik denge ve modal analiz çözülür; dört kesin kriter (Bölüm 3) bu çözümden değerlendirilir. '
   + 'Sıralamanın ölçütü 1 g statik düşey sehimin takozlar üzerindeki en büyük mutlak değeridir:</p>';
  h+='$$\\delta_{s} = \\max_{j}\\,\\left|\\delta_{z,j}\\right|$$';
  h+='<p><strong>Sıralama.</strong> Dört kesin kriteri sağlayan kombinasyonlar δ<sub>s</sub>’ye göre küçükten büyüğe sıralanır: ilki En uygun, kalanı Uygun; '
   + 'en çok '+_rF(n, 0)+' tanesi K1…K'+n+'’dur. Hiçbir kombinasyon dört kriteri sağlamıyorsa K1…K'+n+' en az ihlalli '+_rF(n, 0)+' kombinasyondur: '
   + 'kriterlerin normalleştirilmiş ihlallerinin toplamı en küçük olanlar (ör. Kriter 1 için (f<sub>max</sub> − f<sub>sınır</sub>)/f<sub>sınır</sub>), '
   + 'eşitlikte δ<sub>s</sub>; bunlar Uygun değil’dir. Mevcut tasarım K0’dır.</p>';
  if(c.acik.tolerans){
    h+='<p><strong>Rijitlik toleransı.</strong> Bütün takozların bütün rijitlikleri (statik, dinamik, nonlineer yasa) ±%'
     + _rF(c.s.tolerans*100, 0)+' ölçeklenerek iki köşe daha çözülür; dört kesin kriter üç köşenin kötüsüyle sınanır, '
     + 'δ<sub>s</sub> anma değerdedir '+_mntPrmRef('shen', 'torgal')+'.</p>';
  }
  h+='<p><strong>İşletme ve darbe yükleri</strong> K1 ve K0 için çözülür (Bölüm 5); sıralamaya girmez. İşletme: 1 g düşey ile birlikte en çok 1 g yatay ivme ve tahrik torku — '
   + 'statik, frenleme, hızlanma, viraj, fren + viraj, ileri ve geri tork, vites başına tork, 1 g yanal ve 1 g boyuna. '
   + 'Darbe: 3,5 g düşey, çukur + fren, bordür darbesi, geri esneme; metal–metal durdurucuyla sınırlanır '+_mntPrmRef('bmc')+'.</p>';
  return h;
}

// ── 3 Kriterler ─────────────────────────────────────────────────────────────
function _mntPrmKriterTanim(c){
  var K=veMntKatalog;
  return {
    k1:  ['max f<sub>i</sub> &lt; '+_rF(K.K1_ORAN, 1)+'·f<sub>ateş</sub>', '&lt; '+_rF(K.K1_ORAN*c.fAtes, 2)+' Hz', ['sirket']],
    k1a: ['min (f<sub>i+1</sub> − f<sub>i</sub>)', '&gt; '+_rF(K.K1A_HZ, 1)+' Hz', ['sirket']],
    k1b: ['f<sub>i</sub> ∉ ['+_rF(K.K1B[0], 0)+'; '+_rF(K.K1B[1], 0)+'] Hz', 'Yok', ['sirket']],
    k2:  ['TR(f<sub>ateş</sub>; f<sub>bounce</sub>, ζ)', '&lt; %'+_rF(K.K2_T*100, 0), ['sirket']]
  };
}
function _mntPrmKriterBolum(E){
  var D=_mntPrmKriterTanim(E.ctx);
  var h='<h2 id="p3"><span class="no">3</span>Kriterler</h2>';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Kesin kriterler</caption>'
   + '<tr><th>No</th><th>Kriter</th><th>Ölçüt</th><th>Sınır</th><th>Dayanak</th></tr>';
  _MNT_PRM_KR.forEach(function(k){
    var d=D[k];
    h+='<tr><td class="c">'+_mntPrmQ(k).no+'</td><td class="l">'+_mntPrmKrAdi(k)+'</td><td class="l">'+d[0]+'</td><td>'+d[1]+'</td>'
     + '<td class="c">'+_mntPrmRef.apply(null, d[2])+'</td></tr>';
  });
  h+='</table>';
  var fd=function(d){ return _rF(Math.sqrt(9810/d)/(2*Math.PI), 1); };
  h+='<p>Statik sehim ile düşey doğal frekans arasındaki bağ (doğrusal yay, f = (1/2π)·√(g/δ)): δ = 1 mm → '+fd(1)+' Hz, δ = 3 mm → '+fd(3)
   + ' Hz, δ = 5 mm → '+fd(5)+' Hz; dinamik rijitlik frekansı √(k<sub>din</sub>/k<sub>stat</sub>) katına çıkarır. '
   + 'Kaynaklarda 1 g statik sehim ticari araçta 3–5 mm '+_mntPrmRef('shen')+', 10 t otobüste ≤ 3 mm '+_mntPrmRef('torgal')+'.</p>';
  return h;
}

// ── 4 Kriterleri sağlayan ───────────────────────────────────────────────────
function _mntPrmSaglayan(E){
  var S=E.S, coz=S.N-S.hata;
  var h='<h2 id="p4"><span class="no">4</span>Kriterleri sağlayan</h2>';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Kriter başına sağlayan kombinasyon</caption>'
   + '<tr><th>Kriter</th><th>Sağlayan</th><th>Pay</th></tr>'
   + '<tr><td class="l">Çözülen</td><td>'+_rF(coz, 0)+'</td><td>'+_mntPrmYuzde(S.N ? coz/S.N : NaN, 1)+'</td></tr>';
  _MNT_PRM_KR.forEach(function(k){
    if(!(k in S.red)) return;
    var n=coz-S.red[k];
    h+='<tr><td class="l">'+_mntPrmKrAdi(k, true)+'</td><td>'+_rF(n, 0)+'</td><td>'+_mntPrmYuzde(coz ? n/coz : NaN, 1)+'</td></tr>';
  });
  h+='<tr><td class="l"><strong>Dört kriter</strong></td><td><strong>'+_rF(S.uygunN, 0)+'</strong></td><td>'+_mntPrmYuzde(coz ? S.uygunN/coz : NaN, 1)+'</td></tr></table>';
  h+='<p>Kombinasyon '+_rF(S.N, 0)+' · çözülemeyen '+_rF(S.hata, 0)+' · dört kesin kriteri sağlayan '+_rF(S.uygunN, 0)+'. '
   + 'Pay çözülen kombinasyonlara göredir.</p>';
  return h;
}

// ── 5 Sonuç ─────────────────────────────────────────────────────────────────
function _mntPrmSatirOlcu(r){
  var o1=r.o1 || {}, o2=r.o2 || {};
  return {
    T:o1.T, d:_mntPrmEnBuyuk(o1.dz), fMax:Math.max.apply(null, o1.f || [NaN]), gap:_mntPrmMinAralik(o1.f),
    dIsl:_mntPrmEnBuyuk(o2.dIsl), darbe:o2.darbe || null
  };
}
function _mntPrmKarsilastir(E, U){
  var M=E.konfig[0], D=_mntPrmKriterTanim(E.ctx), a=_mntPrmSatirOlcu(U), b=_mntPrmSatirOlcu(M);
  var fa=(U.o1 && U.o1.f) || [], fb=(M.o1 && M.o1.f) || [], ad='K'+U.K;
  var h='<table><caption>Tablo '+(++_prmTbl)+' — '+ad+' ve K0 · Mevcut</caption>'
    + '<tr><th>Büyüklük</th><th>'+ad+'</th><th>K0</th><th>Sınır</th></tr>';
  _MNT_PRM_KR.forEach(function(k){
    var x=_mntPrmKrDeger(U, k), y=_mntPrmKrDeger(M, k);
    h+='<tr><td class="l">'+_mntPrmKrAdi(k, true)+'</td><td>'+x.v+_mntPrmIsaret(x.ok)+'</td><td>'+y.v+_mntPrmIsaret(y.ok)+'</td><td>'+D[k][1]+'</td></tr>';
  });
  h+='<tr><td class="l">Statik sehim δ<sub>s</sub> [mm]</td><td>'+_rF(U.d, 2)+'</td><td>'+_rF(M.d, 2)+'</td><td></td></tr>'
   + '<tr><td class="l">f<sub>bounce</sub> [Hz]</td><td>'+_rF((U.o1||{}).fB, 2)+'</td><td>'+_rF((M.o1||{}).fB, 2)+'</td><td></td></tr>';
  for(var i=0;i<6;i++) h+='<tr><td class="l">f<sub>'+(i+1)+'</sub> [Hz]</td><td>'+_rF(fa[i], 2)+'</td><td>'+_rF(fb[i], 2)+'</td><td></td></tr>';
  h+='<tr><td class="l">İşletme yüklerinde en büyük sehim [mm]</td><td>'+_rF(a.dIsl, 2)+'</td><td>'+_rF(b.dIsl, 2)+'</td><td></td></tr>'
   + '<tr><td class="l">Darbe yüklerinde en büyük sehim [mm]</td><td>'+_rF(a.darbe ? a.darbe.d : NaN, 2)+'</td><td>'+_rF(b.darbe ? b.darbe.d : NaN, 2)+'</td><td></td></tr>'
   + '<tr><td class="l">Uygunluk</td><td class="c">'+U.uygunluk+'</td><td class="c">'+M.uygunluk+'</td><td></td></tr>';
  return h+'</table>';
}
function _mntPrmSonuc(E){
  var S=E.S, K0=E.konfig[0], K1=E.konfig[1];
  var h='<h2 id="p5"><span class="no">5</span>Sonuç</h2>';
  if(!K1){
    return h+'<div class="note warn"><span class="t">Çözülen kombinasyon yok</span>'+_rF(S.N, 0)+' kombinasyonun hiçbiri çözülemedi.</div>';
  }
  if(!S.uygunN){
    h+='<div class="note warn"><span class="t">Uygun kombinasyon yok</span>'
     + _rF(S.N, 0)+' kombinasyonun hiçbiri dört kesin kriteri sağlamıyor.</div>';
  }
  if(_mntPrmKonumMu(E)){
    h+='<table><caption>Tablo '+(++_prmTbl)+' — K1 · '+K1.uygunluk+': grup başına konum</caption>'
     + '<tr><th>Grup</th><th>Δx [mm]</th><th>Δz [mm]</th><th>x [mm]</th><th>z [mm]</th><th>K0 · Mevcut x · z [mm]</th></tr>';
    E.M.G.forEach(function(g, i){
      var k=K1.tipler[i] ? veMntKatalog.konumOku(K1.tipler[i]) : null;
      h+='<tr><td class="l">'+_rEsc(g.ad)+'</td><td>'+(k ? _mntPrmKayma(k.dx) : 'sabit')+'</td><td>'+(k ? _mntPrmKayma(k.dz) : 'sabit')+'</td>'
       + '<td>'+_rF(g.x+(k ? k.dx : 0), 0)+'</td><td>'+_rF(g.z+(k ? k.dz : 0), 0)+'</td><td>'+_rF(g.x, 0)+' · '+_rF(g.z, 0)+'</td></tr>';
    });
    return h+'</table>'+_mntPrmKarsilastir(E, K1)+_mntPrmSekil(E);
  }
  h+='<table><caption>Tablo '+(++_prmTbl)+' — K1 · '+K1.uygunluk+': grup başına tip</caption>'
   + '<tr><th>Grup</th><th>K1</th><th>k<sub>z</sub> stat. [N/mm]</th><th>k<sub>z</sub> din. [N/mm]</th><th>K0 · Mevcut</th></tr>';
  E.M.G.forEach(function(g, i){
    var key=K1.tipler[i], e=key ? E.M.lib[key] : null;
    h+='<tr><td class="l">'+_rEsc(g.ad)+'</td><td class="l">'+_mntPrmTipYaz(K1.ad[i])+(key ? '' : ' (sabit)')+'</td>'
     + '<td>'+(e ? _rF(e.sz, 0) : '—')+'</td><td>'+(e ? _rF(e.dz, 0) : '—')+'</td><td class="l">'+_mntPrmTipYaz(K0.ad[i])+'</td></tr>';
  });
  h+='</table>';
  h+=_mntPrmKarsilastir(E, K1);
  h+=_mntPrmSekil(E);
  return h;
}

// ── Şekil — çözülen kombinasyonlar, dört kriteri sağlayanlar, K1…K9 ve K0 ───
function _mntPrmAdim(a, b, hedef){
  var r=(b-a)/hedef, p=Math.pow(10, Math.floor(Math.log10(r))), m=r/p;
  return (m<=1 ? 1 : m<=2 ? 2 : m<=5 ? 5 : 10)*p;
}
function _mntPrmSekil(E){
  var S=E.S, P=S.nokta, K0=E.konfig[0], L=E.konfig.slice(1);
  if(!P.length || !L.length) return '';
  var xMax=0, yMax=0, xK=0;
  P.forEach(function(p){ if(p.d>xMax) xMax=p.d; if(p.T>yMax) yMax=p.T; });
  E.konfig.forEach(function(k){ if(k.d>xMax) xMax=k.d; if(k.T>yMax) yMax=k.T; if(k.d>xK) xK=k.d; });
  // Ölçek: x en çok 15 mm (işaretli konfigürasyonlar her zaman içeride), y en çok %100 —
  // dışarıda kalan noktalar sayılır.
  var x1=Math.min(xMax, Math.max(15, xK*1.1))*1.05, y1=Math.min(yMax, 1)*100*1.05;
  var W=820, H=420, Lp=72, R=24, T=18, B=56;
  var X=function(v){ return Lp+v/x1*(W-Lp-R); }, Y=function(v){ return H-B-v/y1*(H-T-B); };
  var ic=function(d, t){ return d<=x1 && t*100<=y1; };
  var f=function(v){ return Math.round(v*10)/10; };   // makine: SVG koordinatı
  var dis=0;
  var g='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Statik sehim ve iletilebilirlik">';
  var ax=_mntPrmAdim(0, x1, 8), ay=_mntPrmAdim(0, y1, 6), v;
  for(v=0; v<=x1+1e-9; v+=ax){
    g+='<line x1="'+f(X(v))+'" y1="'+T+'" x2="'+f(X(v))+'" y2="'+(H-B)+'" stroke="#e4e8ed" stroke-width="1"/>'
     + '<text x="'+f(X(v))+'" y="'+(H-B+18)+'" text-anchor="middle" font-size="12" fill="#3c4350">'+_rF(v, 2)+'</text>';
  }
  for(v=0; v<=y1+1e-9; v+=ay){
    g+='<line x1="'+Lp+'" y1="'+f(Y(v))+'" x2="'+(W-R)+'" y2="'+f(Y(v))+'" stroke="#e4e8ed" stroke-width="1"/>'
     + '<text x="'+(Lp-8)+'" y="'+f(Y(v)+4)+'" text-anchor="end" font-size="12" fill="#3c4350">'+_rF(v, 2)+'</text>';
  }
  g+='<g fill="#9aa3ad" fill-opacity="0.35">';
  P.forEach(function(p){ if(p.uygun) return; if(!ic(p.d, p.T)){ dis++; return; } g+='<circle cx="'+f(X(p.d))+'" cy="'+f(Y(p.T*100))+'" r="1.7"/>'; });
  g+='</g><g fill="#3d6f8f" fill-opacity="0.75">';
  P.forEach(function(p){ if(!p.uygun) return; if(!ic(p.d, p.T)){ dis++; return; } g+='<circle cx="'+f(X(p.d))+'" cy="'+f(Y(p.T*100))+'" r="2.8"/>'; });
  g+='</g>';
  // Kriter 2 sınırı (TR).
  var yk=Y(veMntKatalog.K2_T*100);
  if(veMntKatalog.K2_T*100<=y1) g+='<line x1="'+Lp+'" y1="'+f(yk)+'" x2="'+(W-R)+'" y2="'+f(yk)+'" stroke="#7c5400" stroke-width="1.4" stroke-dasharray="6 4"/>'
    + '<text x="'+(W-R-4)+'" y="'+f(yk-6)+'" text-anchor="end" font-size="12" fill="#7c5400"'+_R_HALE+'>Kriter 2 · TR = %'+_rF(veMntKatalog.K2_T*100, 0)+'</text>';
  g+='<line x1="'+Lp+'" y1="'+(H-B)+'" x2="'+(W-R)+'" y2="'+(H-B)+'" stroke="#1f2328" stroke-width="1.2"/>'
   + '<line x1="'+Lp+'" y1="'+T+'" x2="'+Lp+'" y2="'+(H-B)+'" stroke="#1f2328" stroke-width="1.2"/>';
  // K2…K9 ince halka (yazısız — kümelenirler), K1 kalın halka ve K0 karo yazılı.
  L.slice(1).forEach(function(k){
    if(!Number.isFinite(k.d) || !Number.isFinite(k.T) || !ic(k.d, k.T)) return;
    g+='<circle cx="'+f(X(k.d))+'" cy="'+f(Y(k.T*100))+'" r="5" fill="none" stroke="#166a2e" stroke-width="1.4"/>';
  });
  var isaret=function(k, yazi, renk, sekil){
    if(!Number.isFinite(k.d) || !Number.isFinite(k.T) || !ic(k.d, k.T)) return;
    var x=X(k.d), y=Y(k.T*100), sag=x>(Lp+W-R)/2;
    g+=sekil(x, y)+'<text x="'+f(sag ? x-14 : x+14)+'" y="'+f(y-12)+'" text-anchor="'+(sag ? 'end' : 'start')+'" font-size="12.5" font-weight="600" fill="'+renk+'"'+_R_HALE+'>'+yazi+'</text>';
  };
  isaret(L[0], 'K1', '#166a2e', function(x, y){ return '<circle cx="'+f(x)+'" cy="'+f(y)+'" r="8" fill="none" stroke="#166a2e" stroke-width="2.5"/>'; });
  isaret(K0, 'K0 · Mevcut', '#7c5400', function(x, y){
    return '<path d="M'+f(x)+' '+f(y-7)+' L'+f(x+7)+' '+f(y)+' L'+f(x)+' '+f(y+7)+' L'+f(x-7)+' '+f(y)+' Z" fill="none" stroke="#7c5400" stroke-width="2.2"/>'; });
  g+='<text x="'+((Lp+W-R)/2)+'" y="'+(H-14)+'" text-anchor="middle" font-size="12.5" fill="#1f2328">Statik sehim δ<tspan baseline-shift="sub" font-size="9.5">s</tspan> [mm]</text>'
   + '<text x="18" y="'+((T+H-B)/2)+'" text-anchor="middle" font-size="12.5" fill="#1f2328" transform="rotate(-90 18 '+((T+H-B)/2)+')">TR [%]</text>';
  g+='</svg>';
  var sey=(S.seyrek>1 || S.seyrekU>1) ? '; her '+S.seyrek+' kombinasyondan biri' : '';
  return '<figure>'+g+'<figcaption><b>Şekil '+(++_prmFig)+'</b> — Çözülen kombinasyonlar (açık gri'+sey+'), dört kesin kriteri sağlayanlar (mavi, '
    + _rF(S.uygunN, 0)+'), K1 (kalın halka), K2–K'+L.length+' (ince halka) ve K0 · mevcut tasarım (karo); kesikli çizgi Kriter 2 sınırı'
    + (dis ? '; ölçek dışında '+_rF(dis, 0)+' nokta' : '')+'.</figcaption></figure>';
}

// ── 6 Konfigürasyonlar ──────────────────────────────────────────────────────
function _mntPrmKonfigler(E){
  var S=E.S, G=E.M.G, tar=S.taranan, K=veMntKatalog, k1=K.K1_ORAN*E.ctx.fAtes;
  var h='<h2 id="p6"><span class="no">6</span>Konfigürasyonlar</h2>';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — K0 · Mevcut ve sıranın ilk '+_rF(E.konfig.length-1, 0)+' kombinasyonu</caption><tr><th>K</th>';
  tar.forEach(function(gi){ h+='<th>'+_rEsc(G[gi].ad)+'</th>'; });
  h+='<th>Uygunluk</th><th>Bozulan kriter</th><th>δ<sub>s</sub> [mm]</th><th>TR</th><th>f<sub>max</sub> [Hz]</th><th>Δf<sub>min</sub> [Hz]</th></tr>';
  E.konfig.forEach(function(k){
    var a=_mntPrmSatirOlcu(k);
    var boz=_MNT_PRM_KR.filter(function(q, j){ return !k.kriter[j]; }).map(function(q){ return _mntPrmQ(q).no; });
    h+='<tr><td class="c">K'+k.K+'</td>';
    tar.forEach(function(gi){ h+='<td class="l">'+_mntPrmTipYaz(k.ad[gi])+'</td>'; });
    h+='<td class="l">'+k.uygunluk+'</td><td class="c">'+(boz.length ? boz.join(' · ') : '—')+'</td>'
     + '<td>'+_rF(k.d, 2)+'</td><td>'+_mntPrmYuzde(k.T)+'</td><td>'+_mntPrmSinirli(a.fMax, k1, 2)+'</td>'
     + '<td>'+_mntPrmSinirli(a.gap, K.K1A_HZ, 2)+'</td></tr>';
  });
  h+='</table>';
  if(S.uygunN>0){
    var kn=_mntPrmKonumMu(E);
    h+='<table><caption>Tablo '+(++_prmTbl)+' — Dört kesin kriteri sağlayan kombinasyonlarda grup başına '+(kn ? 'konum' : 'tip')+' sıklığı (ilk beş)</caption>'
     + '<tr><th>Grup</th><th>'+(kn ? 'Konum' : 'Tip')+'</th><th>Kombinasyon</th><th>Pay</th></tr>';
    tar.forEach(function(gi){
      var s=S.siklik[gi], k=Object.keys(s).sort(function(a, b){ return s[b]-s[a] || (a<b ? -1 : 1); }).slice(0, 5);
      k.forEach(function(key, j){
        h+='<tr>'+(j===0 ? '<td class="l" rowspan="'+k.length+'">'+_rEsc(G[gi].ad)+'</td>' : '')
         + '<td class="l">'+_mntPrmTipYaz(_mntPrmTipAdi(E, key))+'</td><td>'+_rF(s[key], 0)+'</td><td>'+_mntPrmYuzde(s[key]/S.uygunN, 1)+'</td></tr>';
      });
    });
    h+='</table>';
  }
  return h;
}

// ── 7 Varsayımlar · Kaynaklar ───────────────────────────────────────────────
function _mntPrmVarsayim(E){
  var kn=E && _mntPrmKonumMu(E);
  var h='<h2 id="p7"><span class="no">7</span>Varsayımlar ve sınırlar</h2><ul>'
    + '<li>Güç grubu 6 serbestlik dereceli rijit gövdedir; takoz, konumunda üç eksenli yaydır ve eksenleri genel eksenlere paraleldir (ana rapor, Bölüm 2).</li>'
    + (kn
      ? '<li>Takoz verisi modeldekidir: tip, rijitlik ve tanımlıysa nonlineer yasa değişmez; yalnız konum değişir. Üretim toleransı ve sıcaklık etkisi taramaya girmez.</li>'
        + '<li>Bir grubun takozları aynı kaymayı alır; yanal (y) konum ve takozun eğim açısı değişmez. Braketin kaymaya uyduğu, kütlesinin ve rijitliğinin değişmediği kabul edilir.</li>'
      : '<li>Tip verisi kütüphanedeki değerlerdir: statik ve dinamik rijitlik, tanımlıysa nonlineer yasa. Üretim toleransı ve sıcaklık etkisi taramaya girmez.</li>'
        + '<li>Takoz konumları ve braketler değişmez; yalnız tip değişir. Bir grubun takozları aynı tiptir.</li>')
    + '<li>TR, Kriter 2’nin tek serbestlikli düşey kestirimidir; 6 serbestlikli yön başına iletilebilirlik ana raporun Bölüm 8’indedir.</li>'
    + '<li>Nonlineer yasalı takozda modlar statik dengedeki dinamik tanjantla hesaplanır (küçük genlik).</li>'
    + '<li>Sönüm oranı ζ bütün takozlar için tek değerdir.</li>'
    + '<li>Şasi ve braketler rijittir; kaynaklarda taban rijitliği takozunkinin en az 5–10 katıdır '+_mntPrmRef('torgal')+'.</li>'
    + '<li>Sıralama dört kesin kritere ve 1 g statik sehime bakar; takozun taşıma kapasitesi, sürünme ve işletme sehimi sıralamaya girmez.</li>'
    + '<li>Tolerans köşelerinde bütün takozlar aynı yönde sapar.</li></ul>';
  h+='<h2 id="pk"><span class="no">K</span>Kaynaklar</h2><ol>';
  _MNT_PRM_KAYNAK.forEach(function(k){ h+='<li>'+_rEsc(k.ad)+'</li>'; });
  return h+'</ol>';
}

// ── Belge ───────────────────────────────────────────────────────────────────
function veMntParamRaporHTML(E){
  _prmTbl=0; _prmFig=0;
  var A=window.MNT_REPORT_ASSETS;
  var tpl=decodeURIComponent(escape(atob(window.MNT_REPORT_TEMPLATE_B64)));
  var bas=tpl.indexOf('@@ANTET@@'), kat=tpl.lastIndexOf('<script>@@KATEX_JS@@');
  var kapa=tpl.lastIndexOf('</div>', kat);
  if(bas<0 || kat<0 || kapa<0) throw new Error('Rapor şablonu tanınmadı');
  var ust=tpl.slice(0, bas).replace(/<title>[^<]*<\/title>/, '<title>'+(_mntPrmKonumMu(E) ? 'Takoz konumu taraması' : 'Katalogdan takoz seçimi')+'</title>');
  var alt=tpl.slice(kapa);
  var css=((typeof veThemeFontFaceCss==='function') ? veThemeFontFaceCss() : '')+'\n'+A.katexCss;
  var js=A.katexJs.replace(/<\/script/gi, '<\\/script');
  var govde=_mntPrmAntet(E)+_mntPrmToc()
    + _rBolunmez(_mntPrmKapsam(E)+_mntPrmYontem(E)+_mntPrmKriterBolum(E)+_mntPrmSaglayan(E)
                 +_mntPrmSonuc(E)+_mntPrmKonfigler(E)+_mntPrmVarsayim(E));
  return ust.replace('@@ASSETS_CSS@@', function(){ return css; })
       + govde
       + alt.replace('@@KATEX_JS@@', function(){ return js; });
}

if(typeof module!=='undefined' && module.exports){
  module.exports = {
    veMntParamRaporHTML: veMntParamRaporHTML, _MNT_PRM_KAYNAK: _MNT_PRM_KAYNAK,
    _mntPrmKaynakNo: _mntPrmKaynakNo, _mntPrmRef: _mntPrmRef, _mntPrmKriterTanim: _mntPrmKriterTanim,
    _mntPrmKapsam: _mntPrmKapsam, _mntPrmYontem: _mntPrmYontem, _mntPrmKriterBolum: _mntPrmKriterBolum,
    _mntPrmSaglayan: _mntPrmSaglayan, _mntPrmSonuc: _mntPrmSonuc, _mntPrmKonfigler: _mntPrmKonfigler,
    _mntPrmSekil: _mntPrmSekil, _mntPrmSatirOlcu: _mntPrmSatirOlcu, _mntPrmKrDeger: _mntPrmKrDeger
  };
}
