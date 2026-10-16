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
// Girdi E (js/cp-mount-param.js → _mntParamZenginlestir):
//   { S (tarama), M (model), A (aday tipler), sabit, ctx (baglam),
//     satir:[{no, tipler, uz, pareto, v, o1, o2, k}], mevcut:{o1, o2, k}, tarih }
// ════════════════════════════════════════════════════════════════════════════

// Dayanaklar — §3'ün kaynak sütunu ve Kaynaklar listesi aynı tablodan. Yalnız
// okunmuş kaynaklar (literatür taraması 2026-10-16); sayı kaynağın verdiğidir.
var _MNT_PRM_KAYNAK = [
  { k:'sirket', ad:'Şirket motor takozu hedef kriterleri: Kriter 1 · 1a · 1b · 2 (ana raporun “Motor takozu uygunluğu” tablosu).' },
  { k:'shen', ad:'Shen, Zhang, Jin (2024), “Optimization of a commercial vehicle powertrain mounting system …”, Journal of Vibroengineering 26(2), doi:10.21595/jve.2023.23536 — ticari araç: statik sehim 3–5 mm, en düşük mod ≥ 5 Hz, KED ≥ %80, rijitlik toleransı ±%15.' },
  { k:'torgal', ad:'Torgal, Saxena (2015), “Methodology for … powertrain vibration reduction in passenger bus …”, IJIRSET 4(7) — 10 t otobüs: 1 g’de statik sehim ≤ 3 mm, rijitlik toleransı ±%15, taban rijitliği ≥ 5 × takoz.' },
  { k:'zheng', ad:'Zheng, Wang, Li (2017), “Vibration and noise analysis of heavy-duty trucks …”, Journal of Vibroengineering 19(6), doi:10.21595/jve.2017.18308 — ağır kamyon: güç grubu modu ≥ 4/3 × yol uyarısı (< 3 Hz).' },
  { k:'gillespie', ad:'T. D. Gillespie (1985), “Heavy truck ride”, SAE 850001, doi:10.4271/850001 — kamyon bantları: gövde 2–5 Hz, şasi eğilmesi 6–9 Hz, aks zıplaması 10–13 Hz.' },
  { k:'jeong', ad:'T. Jeong, R. Singh (2000), “Analytical methods of decoupling the automotive engine torque roll axis”, Journal of Sound and Vibration 234(1), 85–114, doi:10.1006/jsvi.1999.2860.' },
  { k:'angrosch', ad:'Angrosch ve diğ. (2015), “Mode decoupling concepts of an engine mount system …”, Proc. IMechE Part K 229(4), doi:10.1177/1464419314564020 — ayrışma yol uyarısında yalıtımı bozabilir.' },
  { k:'lei', ad:'Lei ve diğ. (2022), “Optimum design of powertrain mounting system for the electric vehicle”, J. Xihua Univ., doi:10.12198/j.issn.1673-159X.3884; Zhang ve diğ. (2021), OJAV 9(4), doi:10.12677/ojav.2021.94013 — güç grubu hareketi ≤ 10 mm.' },
  { k:'paulstra', ad:'Paulstra / Hutchinson (2021), Industry Catalog — anma yükü; darbe yükü ≤ 2 × anma; sürünme: bir yılda statik sehim +%20 (45 ShA) … +%33 (75 ShA).' },
  { k:'lord', ad:'LORD Corporation (2009), Engineering Guide (PC7000) — elastomerde şekil değiştirme sınırları, yapışma yüzeyinde çekme hasarı.' },
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
function _mntPrmEnBuyuk(a){ var m=-Infinity; (a||[]).forEach(function(v){ v=Math.abs(v); if(v>m) m=v; }); return m; }
function _mntPrmMinAralik(f){
  var s=(f||[]).slice().sort(function(a, b){ return a-b; }), g=Infinity;
  for(var i=1;i<s.length;i++) g=Math.min(g, s[i]-s[i-1]);
  return g;
}
function _mntPrmTipAdi(E, key){
  if(!key) return '—';
  var e=E.M.lib[key];
  return e ? e.name : key;
}
function _mntPrmYuzde(v, d){ return Number.isFinite(v) ? '%'+_rF(v*100, d==null ? 1 : d) : '—'; }
function _mntPrmTik(ok){ return ok ? '<span class="ok">✓</span>' : '<span style="color:var(--warn);font-weight:600;">✗</span>'; }   // sabit renk: belge gövdesi

// ── Antet ve içindekiler ────────────────────────────────────────────────────
function _mntPrmAntet(E){
  var tarih='—';
  try { tarih=E.tarih.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' }); } catch(e){}
  var m=E.mevcut && E.mevcut.o1 ? E.mevcut.o1.m : NaN;
  return '<div class="antet"><div class="band">'
    + '<div class="eyebrow">Parametrik analiz · Katalogdan seçim</div>'
    + '<h1>Güç grubu takoz sistemi: Katalogdan takoz seçimi</h1></div>'
    + '<div class="fields">'
    + '<div class="f"><div class="k">Model</div><div class="v">'+E.M.gather.components.length+' gövde · '+E.M.tak.length+' takoz · '+E.M.G.length+' grup</div></div>'
    + '<div class="f"><div class="k">Toplam kütle</div><div class="v">'+_rF(m, 1)+' kg</div></div>'
    + '<div class="f"><div class="k">Aday tip</div><div class="v">'+E.A.length+'</div></div>'
    + '<div class="f"><div class="k">Kombinasyon</div><div class="v">'+_rF(E.S.N, 0)+'</div></div>'
    + '<div class="f"><div class="k">Tarih</div><div class="v">'+_rEsc(tarih)+'</div></div>'
    + '</div></div>';
}
function _mntPrmToc(){
  var b=[['p1','1','Kapsam'], ['p2','2','Yöntem'], ['p3','3','Kısıtlar'], ['p4','4','Eleme'],
         ['p5','5','Sonuç'], ['p6','6','Sıralama'], ['p7','7','Varsayımlar ve sınırlar'], ['pk','K','Kaynaklar']];
  return '<div class="toc">'+b.map(function(x){ return '<a href="#'+x[0]+'"><span class="n">'+x[1]+'</span>'+x[2]+'</a>'; }).join('')+'</div>';
}

// ── 1 Kapsam ────────────────────────────────────────────────────────────────
function _mntPrmKapsam(E){
  var M=E.M, c=E.ctx, o=E.mevcut.o1 || {};
  var h='<h2 id="p1"><span class="no">1</span>Kapsam</h2>';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Takoz grupları</caption>'
   + '<tr><th>No</th><th>Grup</th><th>Takozlar</th><th>x [mm]</th><th>Mevcut tip</th><th>Tarama</th></tr>';
  M.G.forEach(function(g){
    h+='<tr><td class="c">'+g.no+'</td><td class="l">'+_rEsc(g.ad)+'</td><td class="c">'+g.uyeler.length+'</td>'
     + '<td>'+_rF(g.x, 0)+'</td><td class="l">'+_rEsc(_mntPrmTipAdi(E, g.tip))+'</td>'
     + '<td class="c">'+(E.sabit[g.anahtar] ? 'sabit' : 'taranır')+'</td></tr>';
  });
  h+='</table>';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Aday tipler (statik ve dinamik rijitlik, N/mm)</caption>'
   + '<tr><th>Tip</th><th>k<sub>x</sub> stat.</th><th>k<sub>y</sub> stat.</th><th>k<sub>z</sub> stat.</th>'
   + '<th>k<sub>x</sub> din.</th><th>k<sub>y</sub> din.</th><th>k<sub>z</sub> din.</th><th>Yasa</th><th>Kapasite [kg]</th></tr>';
  E.A.forEach(function(a){
    var e=a.e;
    h+='<tr><td class="l">'+_rEsc(a.name)+'</td><td>'+_rF(e.sx, 0)+'</td><td>'+_rF(e.sy, 0)+'</td><td>'+_rF(e.sz, 0)+'</td>'
     + '<td>'+_rF(e.dx, 0)+'</td><td>'+_rF(e.dy, 0)+'</td><td>'+_rF(e.dz, 0)+'</td>'
     + '<td class="c">'+((e.fitX||e.fitY||e.fitZ||e.curveX||e.curveY||e.curveZ) ? 'eğri' : 'doğrusal')+'</td>'
     + '<td>'+(e.maxLoad>0 ? _rF(e.maxLoad, 0) : '—')+'</td></tr>';
  });
  h+='</table>';
  var mod={ auto:'otomatik', linear:'doğrusal', nonlinear:'nonlineer' }[o.mod] || '—';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Tarama girdileri</caption><tr><th>Büyüklük</th><th>Değer</th></tr>'
   + '<tr><td class="l">Rölanti devri · silindir sayısı</td><td>'+_rF(M.eng.idleRpm, 0)+' d/dk · '+_rF(M.eng.cylinders, 0)+'</td></tr>'
   + '<tr><td class="l">Ateşleme frekansı f<sub>ateş</sub> = (N/60)·(z/2)</td><td>'+_rF(c.fAtes, 1)+' Hz</td></tr>'
   + '<tr><td class="l">Sönüm oranı ζ</td><td>'+_rF(o.zeta, 3)+'</td></tr>'
   + '<tr><td class="l">Çözüm modu</td><td>'+_rEsc(mod)+'</td></tr>'
   + '<tr><td class="l">Taranan grup · aday tip</td><td>'+E.S.taranan.length+' · '+E.A.length+'</td></tr>'
   + '<tr><td class="l">Kombinasyon</td><td>'+_rF(E.S.N, 0)+'</td></tr>'
   + '<tr><td class="l">Tarama süresi</td><td>'+_rF(E.S.sure/1000, 1)+' s</td></tr></table>';
  return h;
}

// ── 2 Yöntem ────────────────────────────────────────────────────────────────
function _mntPrmYontem(E){
  var c=E.ctx;
  var h='<h2 id="p2"><span class="no">2</span>Yöntem</h2>';
  h+='<p>Her kombinasyonda bir grubun bütün takozlarına aynı kütüphane tipi atanır: sağ ve sol takoz aynı tiptir, takoz konumları değişmez. '
   + 'Model ana raporun Bölüm 8’indeki çözüm yolundan geçer — statik denge (nonlineer yasalı takozda Newton–Raphson, ±15 mm metal–metal durdurucu) '
   + 've statik dengedeki dinamik tanjant rijitlikle modal analiz (Bölüm 7). Sabit gruplar modeldeki takoz verisini korur.</p>';
  var asama=function(n){
    return veMntKatalog.KISITLAR.filter(function(x){ return x.asama===n && c.acik[x.k]; })
      .map(function(x){ return x.no+' '+x.ad.toLocaleLowerCase('tr'); }).join(', ');
  };
  h+='<p><strong>Birinci aşama</strong> — statik denge (1 g) ve modal analiz, bütün kombinasyonlarda: '+asama(1)+'. '
   + '<strong>İkinci aşama</strong> — işletme ve darbe yük durumları, yalnız birinci aşamayı sağlayan kombinasyonlarda: '+asama(2)+'. '
   + 'Hiçbir kombinasyon birinci aşamayı sağlamazsa ikinci aşama en az ihlalli kombinasyonlarda yürür.</p>';
  h+='<p><strong>Amaç.</strong> İki büyüklük birlikte küçültülür: rölanti iletilebilirliği T (Kriter 2’nin tanımı; düşey zıplama frekansı tabanında tek serbestlikli kestirim) '
   + 've 1 g statik düşey sehimin takozlar üzerindeki en büyük mutlak değeri δ<sub>s</sub>. Yumuşak takoz T’yi düşürür, sehimi büyütür; '
   + 'iki amaç birbirine karşı çalışır.</p>';
  h+='<p><strong>Pareto cephesi.</strong> Bütün kısıtları sağlayan kombinasyonlardan, iki amaçta da kendisinden iyi başka bir kombinasyon bulunmayanlar cepheyi kurar. '
   + '<strong>Uzlaşı çözümü</strong>, normalleştirilmiş amaç uzayında ideal noktaya ağırlıklı uzaklığı en küçük olan kombinasyondur:</p>';
  h+='$$u = \\sqrt{w\\,\\hat{T}^{2} + (1-w)\\,\\hat{\\delta}^{2}},\\qquad \\hat{T}=\\frac{T-T_{\\min}}{T_{\\max}-T_{\\min}},\\quad \\hat{\\delta}=\\frac{\\delta_{s}-\\delta_{s,\\min}}{\\delta_{s,\\max}-\\delta_{s,\\min}}$$';
  h+='<p>En küçük ve en büyük değerler uygun kümeden alınır; w = '+_rF(c.s.agirlik, 2)+' iletilebilirliğin ağırlığıdır. '
   + 'En küçük u’lu kombinasyon cephededir: cephe dışındaki bir kombinasyonu baskılayan kombinasyonun u’su daha küçüktür. '
   + 'Uygun kombinasyon yoksa sıra, kısıtların normalleştirilmiş ihlallerinin toplamına göredir (ör. Kriter 1 için (f<sub>max</sub> − f<sub>sınır</sub>)/f<sub>sınır</sub>).</p>';
  h+='<p><strong>Sürünme.</strong> E7’de işletme yüklerinin düşey çalışma noktası statik sehimin %'+_rF(c.s.surunme*100, 0)
   + '’i kadar aşağı kaydırılır — δ<sub>z</sub> + '+_rF(c.s.surunme, 2)+'·δ<sub>z,s</sub> — ve sehim metal–metal durdurucuya kadar olan '
   + 'boşlukla karşılaştırılır '+_mntPrmRef('paulstra', 'bmc')+'.</p>';
  if(c.acik.tolerans){
    h+='<p><strong>Rijitlik toleransı.</strong> Bütün takozların bütün rijitlikleri (statik, dinamik, nonlineer yasa) ±%'
     + _rF(c.s.tolerans*100, 0)+' ölçeklenerek iki köşe daha çözülür. Frekansın üst sınırı (Kriter 1) ve T sert köşede; '
     + 'sehim sınırları, en düşük mod ve işletme sehimi yumuşak köşede; Kriter 1a ve 1b üç köşede sınanır. '
     + 'Amaç büyüklükleri anma değerdedir '+_mntPrmRef('shen', 'torgal')+'.</p>';
  }
  if(c.acik.ayrisma){
    h+='<p><strong>Mod ayrışması</strong> kinetik enerji dağılımıyla ölçülür '+_mntPrmRef('jeong')+':</p>'
     + '$$\\mathrm{KED}_{j,r} = \\frac{\\varphi_{j,r}\\,\\sum_{k} M_{jk}\\,\\varphi_{k,r}}{\\varphi_r^{T} M \\varphi_r}$$'
     + '<p>j = z (zıplama) ve j = r<sub>x</sub> (yalpa) için modlar üzerindeki en büyük KED sınırla karşılaştırılır.</p>';
  }
  return h;
}

// ── 3 Kısıtlar ──────────────────────────────────────────────────────────────
function _mntPrmKisitTanim(c){
  var K=veMntKatalog, s=c.s;
  return {
    k1:  ['max f<sub>i</sub> &lt; '+_rF(K.K1_ORAN, 1)+'·f<sub>ateş</sub>', _rF(K.K1_ORAN*c.fAtes, 1)+' Hz', ['sirket']],
    k1a: ['min (f<sub>i+1</sub> − f<sub>i</sub>)', '&gt; '+_rF(K.K1A_HZ, 1)+' Hz', ['sirket']],
    k1b: ['f<sub>i</sub> ∉ ['+_rF(K.K1B[0], 0)+'; '+_rF(K.K1B[1], 0)+'] Hz', '—', ['sirket']],
    k2:  ['T(f<sub>ateş</sub>; f<sub>bounce</sub>, ζ)', '&lt; %'+_rF(K.K2_T*100, 0), ['sirket']],
    sehimAlt: ['δ<sub>s</sub> = max |δ<sub>z</sub>| — 1 g statik', '≥ '+_rF(s.sehimAlt, 1)+' mm', ['shen', 'torgal']],
    sehim:    ['δ<sub>s</sub> — 1 g statik', '≤ '+_rF(s.sehimUst, 1)+' mm', ['shen', 'torgal', 'bmc']],
    altMod:   ['min f<sub>i</sub>', '≥ '+_rF(s.altMod, 1)+' Hz', ['shen', 'zheng', 'gillespie']],
    kapasite: ['F<sub>z</sub> / (g·m<sub>kap</sub>) — 1 g statik', '≤ %'+_rF(s.kapasite*100, 0), ['paulstra']],
    ayrisma:  ['max KED<sub>z</sub>, max KED<sub>rx</sub>', '≥ %'+_rF(s.ayrisma*100, 0), ['shen', 'jeong', 'angrosch']],
    isletme:  ['max |δ| — işletme yükleri', '≤ '+_rF(s.isletmeUst, 1)+' mm', ['lei', 'bmc']],
    durdurucu: ['max |δ| — işletme yükleri, sürünmüş çalışma noktası', '≤ '+_rF(s.durdurucuUst, 1)+' mm', ['paulstra', 'bmc']],
    cekme:    ['δ<sub>z</sub> ≤ 0 — işletme yükleri', '0 mm', ['lord']],
    darbe:    ['|F<sub>z</sub>| / (g·m<sub>kap</sub>) — darbe yükleri', '≤ %'+_rF(s.darbe*100, 0), ['paulstra']]
  };
}
function _mntPrmKisitlar(E){
  var c=E.ctx, K=veMntKatalog, D=_mntPrmKisitTanim(c);
  var h='<h2 id="p3"><span class="no">3</span>Kısıtlar</h2>';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Kısıtlar</caption>'
   + '<tr><th>No</th><th>Kısıt</th><th>Ölçüt</th><th>Sınır</th><th>Aşama</th><th>Durum</th><th>Dayanak</th></tr>';
  K.KISITLAR.forEach(function(x){
    var d=D[x.k];
    h+='<tr><td class="c">'+x.no+'</td><td class="l">'+x.ad+'</td><td class="l">'+d[0]+'</td><td>'+d[1]+'</td>'
     + '<td class="c">'+x.asama+'</td><td class="c">'+(c.acik[x.k] ? 'açık' : 'kapalı')+'</td><td class="c">'+_mntPrmRef.apply(null, d[2])+'</td></tr>';
  });
  h+='</table>';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Değerlendirme parametreleri</caption>'
   + '<tr><th>Parametre</th><th>Değer</th><th>Durum</th><th>Dayanak</th></tr>'
   + '<tr><td class="l">Sürünme payı (E7)</td><td>%'+_rF(c.s.surunme*100, 0)+'</td><td class="c">'+(c.acik.durdurucu ? 'açık' : 'kapalı')+'</td><td class="c">'+_mntPrmRef('paulstra')+'</td></tr>'
   + '<tr><td class="l">Rijitlik toleransı</td><td>±%'+_rF(c.s.tolerans*100, 0)+'</td><td class="c">'+(c.acik.tolerans ? 'açık' : 'kapalı')+'</td><td class="c">'+_mntPrmRef('shen', 'torgal')+'</td></tr>'
   + '<tr><td class="l">İletilebilirlik ağırlığı w</td><td>'+_rF(c.s.agirlik, 2)+'</td><td class="c">—</td><td class="c">—</td></tr></table>';
  h+='<p><strong>İşletme yükleri</strong>: 1 g düşey ile birlikte en çok 1 g yatay ivme ve tahrik torku — statik, frenleme, hızlanma, viraj, fren + viraj, '
   + 'ileri ve geri tork, vites başına tork, 1 g yanal ve 1 g boyuna. <strong>Darbe yükleri</strong>: 3,5 g düşey, çukur + fren, 1,55 g bordür, geri esneme; '
   + 'metal–metal durdurucuyla sınırlanır '+_mntPrmRef('bmc')+'. Kapasite (E4, E9) girdisi tanımlı tiplerde değerlendirilir; kapasitesiz tipte sağlanmış sayılır.</p>';
  var fd=function(d){ return _rF(Math.sqrt(9810/d)/(2*Math.PI), 1); };
  h+='<p>Statik sehim ile düşey doğal frekans arasındaki bağ (doğrusal yay, f = (1/2π)·√(g/δ)): δ = '+_rF(c.s.sehimAlt, 1)+' mm → '+fd(c.s.sehimAlt)
   + ' Hz, δ = '+_rF(c.s.sehimUst, 1)+' mm → '+fd(c.s.sehimUst)+' Hz; dinamik rijitlik frekansı √(k<sub>din</sub>/k<sub>stat</sub>) katına çıkarır.</p>';
  return h;
}

// ── 4 Eleme ─────────────────────────────────────────────────────────────────
function _mntPrmEleme(E){
  var S=E.S, K=veMntKatalog;
  var ad=function(k){ if(k==='cozulen') return 'Çözülen'; for(var i=0;i<K.KISITLAR.length;i++) if(K.KISITLAR[i].k===k) return K.KISITLAR[i].ad; return k; };
  var h='<h2 id="p4"><span class="no">4</span>Eleme</h2>';
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Ardışık eleme ve kısıt başına ihlal</caption>'
   + '<tr><th>Adım</th><th>Kısıt</th><th>Kalan</th><th>Elenen</th><th>Tek başına ihlal</th></tr>';
  var once=S.N;
  S.huni.forEach(function(x, i){
    var tek=(x.k==='cozulen') ? '—' : _rF(S.red[x.k], 0);
    h+='<tr><td class="c">'+i+'</td><td class="l">'+ad(x.k)+'</td><td>'+_rF(x.kalan, 0)+'</td><td>'+_rF(once-x.kalan, 0)+'</td><td>'+tek+'</td></tr>';
    once=x.kalan;
  });
  h+='</table>';
  h+='<p>Kombinasyon '+_rF(S.N, 0)+' · çözülemeyen '+_rF(S.hata, 0)+' · ikinci aşamaya geçen '+_rF(S.ikinciN, 0)
   + ' · uygun '+_rF(S.uygunN, 0)+' · Pareto cephesi '+_rF(S.paretoN, 0)+'. Tek başına ihlal sayısı ikinci aşama kısıtlarında yalnız ikinci aşamada çözülen kombinasyonları sayar.</p>';
  return h;
}

// ── 5 Sonuç ─────────────────────────────────────────────────────────────────
function _mntPrmSatirOlcu(r){
  var o1=r.o1 || {}, o2=r.o2 || {};
  return {
    T:o1.T, d:_mntPrmEnBuyuk(o1.dz), fMax:Math.max.apply(null, o1.f || [NaN]), gap:_mntPrmMinAralik(o1.f),
    dIsl:_mntPrmEnBuyuk(o2.dIsl), dSur:_mntPrmEnBuyuk(o2.dSur), darbe:o2.darbe || null, darbeOran:(o2.darbeOran == null ? NaN : o2.darbeOran),
    ked:o1.ked || null
  };
}
function _mntPrmKarsilastir(E, U, ad){
  var M=E.mevcut, a=_mntPrmSatirOlcu(U), b=_mntPrmSatirOlcu(M), c=E.ctx;
  var fa=(U.o1 && U.o1.f) || [], fb=(M.o1 && M.o1.f) || [];
  var h='<table><caption>Tablo '+(++_prmTbl)+' — '+ad+' ve mevcut tasarım</caption>'
    + '<tr><th>Büyüklük</th><th>'+ad+'</th><th>Mevcut tasarım</th><th>Sınır</th></tr>';
  for(var i=0;i<6;i++){
    var sin=(i===5) ? '&lt; '+_rF(veMntKatalog.K1_ORAN*c.fAtes, 1) : (i===0 && c.acik.altMod) ? '≥ '+_rF(c.s.altMod, 1) : '';
    h+='<tr><td class="l">f<sub>'+(i+1)+'</sub> [Hz]</td><td>'+_rF(fa[i], 2)+'</td><td>'+_rF(fb[i], 2)+'</td><td>'+sin+'</td></tr>';
  }
  h+='<tr><td class="l">En küçük mod aralığı [Hz]</td><td>'+_rF(a.gap, 2)+'</td><td>'+_rF(b.gap, 2)+'</td><td>&gt; '+_rF(veMntKatalog.K1A_HZ, 1)+'</td></tr>'
   + '<tr><td class="l">f<sub>bounce</sub> [Hz]</td><td>'+_rF((U.o1||{}).fB, 2)+'</td><td>'+_rF((M.o1||{}).fB, 2)+'</td><td></td></tr>'
   + '<tr><td class="l">İletilebilirlik T</td><td>'+_mntPrmYuzde(a.T)+'</td><td>'+_mntPrmYuzde(b.T)+'</td><td>&lt; %'+_rF(veMntKatalog.K2_T*100, 0)+'</td></tr>'
   + '<tr><td class="l">En büyük statik sehim δ<sub>s</sub> [mm]</td><td>'+_rF(a.d, 2)+'</td><td>'+_rF(b.d, 2)+'</td><td>'
   + (c.acik.sehimAlt ? _rF(c.s.sehimAlt, 1) : '')+(c.acik.sehimAlt && c.acik.sehim ? '–' : '')+(c.acik.sehim ? (c.acik.sehimAlt ? '' : '≤ ')+_rF(c.s.sehimUst, 1) : '')+'</td></tr>'
   + '<tr><td class="l">İşletme yüklerinde en büyük sehim [mm]</td><td>'+_rF(a.dIsl, 2)+'</td><td>'+_rF(b.dIsl, 2)+'</td><td>≤ '+_rF(c.s.isletmeUst, 1)+'</td></tr>'
   + '<tr><td class="l">Aynısı, sürünmüş çalışma noktasında [mm]</td><td>'+_rF(a.dSur, 2)+'</td><td>'+_rF(b.dSur, 2)+'</td><td>≤ '+_rF(c.s.durdurucuUst, 1)+'</td></tr>'
   + '<tr><td class="l">Darbe yüklerinde en büyük sehim [mm]</td><td>'+_rF(a.darbe ? a.darbe.d : NaN, 2)+'</td><td>'+_rF(b.darbe ? b.darbe.d : NaN, 2)+'</td><td>±15 durdurucu</td></tr>'
   + '<tr><td class="l">Durdurucuya oturan takoz · durum</td><td>'+(a.darbe ? a.darbe.durdurucu : '—')+'</td><td>'+(b.darbe ? b.darbe.durdurucu : '—')+'</td><td></td></tr>'
   + '<tr><td class="l">Darbe yükü / kapasite</td><td>'+_mntPrmYuzde(a.darbeOran, 0)+'</td><td>'+_mntPrmYuzde(b.darbeOran, 0)+'</td><td>≤ %'+_rF(c.s.darbe*100, 0)+'</td></tr>'
   + '<tr><td class="l">KED<sub>z</sub> · KED<sub>rx</sub></td><td>'+(a.ked ? _mntPrmYuzde(a.ked.bounce, 0)+' · '+_mntPrmYuzde(a.ked.roll, 0) : '—')+'</td>'
   + '<td>'+(b.ked ? _mntPrmYuzde(b.ked.bounce, 0)+' · '+_mntPrmYuzde(b.ked.roll, 0) : '—')+'</td>'
   + '<td>'+(c.acik.ayrisma ? '≥ %'+_rF(c.s.ayrisma*100, 0) : '')+'</td></tr>'
   + '<tr><td class="l">Bütün açık kısıtlar</td><td class="c">'+_mntPrmTik(U.k && U.k.ok)+'</td><td class="c">'+_mntPrmTik(M.k && M.k.ok)+'</td><td></td></tr>';
  return h+'</table>';
}
function _mntPrmSonuc(E){
  var S=E.S;
  var h='<h2 id="p5"><span class="no">5</span>Sonuç</h2>';
  if(!S.uygunN){
    h+='<div class="note warn"><span class="t">Uygun kombinasyon yok</span>'
     + _rF(S.N, 0)+' kombinasyonun hiçbiri bütün açık kısıtları sağlamıyor.</div>';
    if(E.satir[0]) h+=_mntPrmKarsilastir(E, E.satir[0], 'En az ihlalli kombinasyon')+_mntPrmSekil(E, 'En az ihlalli');
    return h;
  }
  var U=E.satir[0];
  h+='<table><caption>Tablo '+(++_prmTbl)+' — Uzlaşı çözümü: grup başına tip</caption>'
   + '<tr><th>Grup</th><th>Tip</th><th>k<sub>z</sub> stat. [N/mm]</th><th>k<sub>z</sub> din. [N/mm]</th><th>Mevcut tip</th></tr>';
  E.M.G.forEach(function(g, i){
    var key=U.tipler[i], e=key ? E.M.lib[key] : null;
    h+='<tr><td class="l">'+_rEsc(g.ad)+'</td><td class="l">'+(key ? _rEsc(_mntPrmTipAdi(E, key)) : 'sabit')+'</td>'
     + '<td>'+(e ? _rF(e.sz, 0) : '—')+'</td><td>'+(e ? _rF(e.dz, 0) : '—')+'</td><td class="l">'+_rEsc(_mntPrmTipAdi(E, g.tip))+'</td></tr>';
  });
  h+='</table>';
  h+=_mntPrmKarsilastir(E, U, 'Uzlaşı çözümü');
  h+=_mntPrmSekil(E, 'Uzlaşı çözümü');
  return h;
}

// ── Şekil — uygun kombinasyonlar, Pareto cephesi, uzlaşı ve mevcut ─────────
function _mntPrmAdim(a, b, hedef){
  var r=(b-a)/hedef, p=Math.pow(10, Math.floor(Math.log10(r))), m=r/p;
  return (m<=1 ? 1 : m<=2 ? 2 : m<=5 ? 5 : 10)*p;
}
function _mntPrmSekil(E, ad){
  var S=E.S, P=S.nokta, c=E.ctx;
  if(!P.length || !E.satir[0]) return '';
  var U=_mntPrmSatirOlcu(E.satir[0]), Mv=_mntPrmSatirOlcu(E.mevcut);
  var xMax=0, yMax=0;
  P.forEach(function(p){ if(p.d>xMax) xMax=p.d; if(p.T>yMax) yMax=p.T; });
  [U, Mv].forEach(function(q){ if(q.d>xMax) xMax=q.d; if(q.T>yMax) yMax=q.T; });
  // Ölçek: x en çok 3·δ_üst, y en çok %100 — dışarıda kalan noktalar sayılır.
  var x1=Math.min(xMax, 3*c.s.sehimUst)*1.05, y1=Math.min(yMax, 1)*100*1.05;
  var W=820, H=420, L=72, R=24, T=18, B=56;
  var X=function(v){ return L+v/x1*(W-L-R); }, Y=function(v){ return H-B-v/y1*(H-T-B); };
  var ic=function(d, t){ return d<=x1 && t*100<=y1; };
  var f=function(v){ return Math.round(v*10)/10; };   // makine: SVG koordinatı
  var dis=0;
  var g='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Pareto cephesi">';
  var ax=_mntPrmAdim(0, x1, 8), ay=_mntPrmAdim(0, y1, 6), v;
  for(v=0; v<=x1+1e-9; v+=ax){
    g+='<line x1="'+f(X(v))+'" y1="'+T+'" x2="'+f(X(v))+'" y2="'+(H-B)+'" stroke="#e6e1d8" stroke-width="1"/>'
     + '<text x="'+f(X(v))+'" y="'+(H-B+18)+'" text-anchor="middle" font-size="12" fill="#3c4350">'+_rF(v, 2)+'</text>';
  }
  for(v=0; v<=y1+1e-9; v+=ay){
    g+='<line x1="'+L+'" y1="'+f(Y(v))+'" x2="'+(W-R)+'" y2="'+f(Y(v))+'" stroke="#e6e1d8" stroke-width="1"/>'
     + '<text x="'+(L-8)+'" y="'+f(Y(v)+4)+'" text-anchor="end" font-size="12" fill="#3c4350">'+_rF(v, 2)+'</text>';
  }
  g+='<g fill="#9aa3ad" fill-opacity="0.35">';
  P.forEach(function(p){ if(p.uygun) return; if(!ic(p.d, p.T)){ dis++; return; } g+='<circle cx="'+f(X(p.d))+'" cy="'+f(Y(p.T*100))+'" r="1.7"/>'; });
  g+='</g><g fill="#3d6f8f" fill-opacity="0.75">';
  P.forEach(function(p){ if(!p.uygun || p.pareto) return; if(!ic(p.d, p.T)){ dis++; return; } g+='<circle cx="'+f(X(p.d))+'" cy="'+f(Y(p.T*100))+'" r="2.8"/>'; });
  g+='</g>';
  // Sınır çizgileri: Kriter 2 (T) ve statik sehim (açıksa).
  var yk=Y(veMntKatalog.K2_T*100);
  if(veMntKatalog.K2_T*100<=y1) g+='<line x1="'+L+'" y1="'+f(yk)+'" x2="'+(W-R)+'" y2="'+f(yk)+'" stroke="#6d5310" stroke-width="1.4" stroke-dasharray="6 4"/>'
    + '<text x="'+(W-R-4)+'" y="'+f(yk-6)+'" text-anchor="end" font-size="12" fill="#6d5310"'+_R_HALE+'>Kriter 2 · T = %'+_rF(veMntKatalog.K2_T*100, 0)+'</text>';
  if(c.acik.sehim && c.s.sehimUst<=x1){
    var xs=X(c.s.sehimUst);
    g+='<line x1="'+f(xs)+'" y1="'+T+'" x2="'+f(xs)+'" y2="'+(H-B)+'" stroke="#6d5310" stroke-width="1.4" stroke-dasharray="6 4"/>'
     + '<text x="'+f(xs-6)+'" y="'+(T+14)+'" text-anchor="end" font-size="12" fill="#6d5310"'+_R_HALE+'>E1 · δ<tspan baseline-shift="sub" font-size="9.5">s</tspan> = '+_rF(c.s.sehimUst, 1)+' mm</text>';
  }
  var cep=P.filter(function(p){ return p.pareto && ic(p.d, p.T); }).sort(function(a, b){ return a.d-b.d; });
  if(cep.length>1) g+='<polyline points="'+cep.map(function(p){ return f(X(p.d))+','+f(Y(p.T*100)); }).join(' ')+'" fill="none" stroke="#96441f" stroke-width="1.6"/>';
  cep.forEach(function(p){ g+='<circle cx="'+f(X(p.d))+'" cy="'+f(Y(p.T*100))+'" r="3.8" fill="#96441f"/>'; });
  g+='<line x1="'+L+'" y1="'+(H-B)+'" x2="'+(W-R)+'" y2="'+(H-B)+'" stroke="#26241f" stroke-width="1.2"/>'
   + '<line x1="'+L+'" y1="'+T+'" x2="'+L+'" y2="'+(H-B)+'" stroke="#26241f" stroke-width="1.2"/>';
  // İşaretler: yazı noktanın uzak yanına (çizimin sağ yarısında sola).
  var isaret=function(q, yazi, renk, sekil){
    if(!Number.isFinite(q.d) || !Number.isFinite(q.T) || !ic(q.d, q.T)) return;
    var x=X(q.d), y=Y(q.T*100), sag=x>(L+W-R)/2;
    g+=sekil(x, y)+'<text x="'+f(sag ? x-14 : x+14)+'" y="'+f(y-12)+'" text-anchor="'+(sag ? 'end' : 'start')+'" font-size="12.5" font-weight="600" fill="'+renk+'"'+_R_HALE+'>'+yazi+'</text>';
  };
  isaret(U, ad, '#2a6140', function(x, y){ return '<circle cx="'+f(x)+'" cy="'+f(y)+'" r="8" fill="none" stroke="#2a6140" stroke-width="2.5"/>'; });
  isaret(Mv, 'Mevcut', '#6d5310', function(x, y){
    return '<path d="M'+f(x)+' '+f(y-7)+' L'+f(x+7)+' '+f(y)+' L'+f(x)+' '+f(y+7)+' L'+f(x-7)+' '+f(y)+' Z" fill="none" stroke="#6d5310" stroke-width="2.2"/>'; });
  g+='<text x="'+((L+W-R)/2)+'" y="'+(H-14)+'" text-anchor="middle" font-size="12.5" fill="#26241f">En büyük statik sehim δ<tspan baseline-shift="sub" font-size="9.5">s</tspan> [mm]</text>'
   + '<text x="18" y="'+((T+H-B)/2)+'" text-anchor="middle" font-size="12.5" fill="#26241f" transform="rotate(-90 18 '+((T+H-B)/2)+')">İletilebilirlik T [%]</text>';
  g+='</svg>';
  var sey=(S.seyrek>1 || S.seyrekU>1) ? '; her '+S.seyrek+' kombinasyondan biri' : '';
  return '<figure>'+g+'<figcaption><b>Şekil '+(++_prmFig)+'</b> — Çözülen kombinasyonlar (açık gri'+sey+'), bütün kısıtları sağlayanlar (mavi, '
    + _rF(S.uygunN, 0)+'), Pareto cephesi (kızıl, '+_rF(S.paretoN, 0)+'), '+ad.toLocaleLowerCase('tr')+' (yeşil halka) ve mevcut tasarım (karo); '
    + 'kesikli çizgiler kısıt sınırları'+(dis ? '; ölçek dışında '+_rF(dis, 0)+' nokta' : '')+'.</figcaption></figure>';
}

// ── 6 Sıralama ──────────────────────────────────────────────────────────────
function _mntPrmSiralama(E){
  var S=E.S, G=E.M.G, tar=S.taranan;
  var h='<h2 id="p6"><span class="no">6</span>Sıralama</h2>';
  var uygunVar=S.uygunN>0;
  h+='<table><caption>Tablo '+(++_prmTbl)+' — '+(uygunVar ? 'Uygun kombinasyonlar, uzlaşı uzaklığına göre' : 'En az ihlalli kombinasyonlar')+'</caption><tr><th>#</th>';
  tar.forEach(function(gi){ h+='<th>'+_rEsc(G[gi].ad)+'</th>'; });
  h+='<th>T</th><th>δ<sub>s</sub> [mm]</th><th>f<sub>max</sub> [Hz]</th><th>Δf<sub>min</sub> [Hz]</th><th>İşletme δ [mm]</th>'
   + (uygunVar ? '<th>u</th><th>Pareto</th>' : '<th>İhlal</th><th>İhlal edilen</th>')+'</tr>';
  var ad=function(k){ var K=veMntKatalog.KISITLAR; for(var i=0;i<K.length;i++) if(K[i].k===k) return K[i].ad; return k; };
  E.satir.forEach(function(r){
    var a=_mntPrmSatirOlcu(r);
    h+='<tr><td class="c">'+r.no+'</td>';
    tar.forEach(function(gi){ h+='<td class="l">'+_rEsc(_mntPrmTipAdi(E, r.tipler[gi]))+'</td>'; });
    h+='<td>'+_mntPrmYuzde(a.T)+'</td><td>'+_rF(a.d, 2)+'</td><td>'+_rF(a.fMax, 2)+'</td><td>'+_rF(a.gap, 2)+'</td><td>'+_rF(a.dIsl, 2)+'</td>';
    if(uygunVar) h+='<td>'+_rF(r.uz, 3)+'</td><td class="c">'+(r.pareto ? '✓' : '')+'</td>';
    else {
      var bozuk=r.k ? Object.keys(r.k.sonuc).filter(function(k){ return !r.k.sonuc[k].ok; }).map(ad) : [];
      h+='<td>'+_rF(r.k ? r.k.v : NaN, 3)+'</td><td class="l">'+_rEsc(bozuk.join(', '))+'</td>';
    }
    h+='</tr>';
  });
  h+='</table>';
  if(uygunVar){
    h+='<table><caption>Tablo '+(++_prmTbl)+' — Uygun kombinasyonlarda grup başına tip sıklığı (ilk beş)</caption>'
     + '<tr><th>Grup</th><th>Tip</th><th>Kombinasyon</th><th>Pay</th></tr>';
    tar.forEach(function(gi){
      var s=S.siklik[gi], k=Object.keys(s).sort(function(a, b){ return s[b]-s[a] || (a<b ? -1 : 1); }).slice(0, 5);
      k.forEach(function(key, j){
        h+='<tr>'+(j===0 ? '<td class="l" rowspan="'+k.length+'">'+_rEsc(G[gi].ad)+'</td>' : '')
         + '<td class="l">'+_rEsc(_mntPrmTipAdi(E, key))+'</td><td>'+_rF(s[key], 0)+'</td><td>'+_mntPrmYuzde(s[key]/S.uygunN, 1)+'</td></tr>';
      });
    });
    h+='</table>';
  }
  return h;
}

// ── 7 Varsayımlar · Kaynaklar ───────────────────────────────────────────────
function _mntPrmVarsayim(){
  var h='<h2 id="p7"><span class="no">7</span>Varsayımlar ve sınırlar</h2><ul>'
    + '<li>Güç grubu 6 serbestlik dereceli rijit gövdedir; takoz, konumunda üç eksenli yaydır ve eksenleri genel eksenlere paraleldir (ana rapor, Bölüm 2).</li>'
    + '<li>Tip verisi kütüphanedeki değerlerdir: statik ve dinamik rijitlik, tanımlıysa nonlineer yasa ve kapasite. Üretim toleransı ve sıcaklık etkisi taramaya girmez.</li>'
    + '<li>Takoz konumları ve braketler değişmez; yalnız tip değişir. Bir grubun takozları aynı tiptir.</li>'
    + '<li>İletilebilirlik Kriter 2’nin tek serbestlikli düşey kestirimidir; 6 serbestlikli yön başına iletilebilirlik ana raporun Bölüm 8’indedir.</li>'
    + '<li>Nonlineer yasalı takozda modlar statik dengedeki dinamik tanjantla hesaplanır (küçük genlik).</li>'
    + '<li>Sönüm oranı ζ bütün takozlar için tek değerdir.</li>'
    + '<li>Şasi ve braketler rijittir; kaynaklarda taban rijitliği takozunkinin en az 5–10 katıdır '+_mntPrmRef('torgal')+'.</li>'
    + '<li>Kauçuğun birim şekil değiştirme sınırları (basmada sürekli %10–15, kaymada %15–40) kauçuk kalınlığını ister; kütüphanede bu veri yok, '
    + 'yerine üreticinin anma yükü (E4, E9) kullanılır '+_mntPrmRef('lord', 'paulstra')+'.</li>'
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
  var ust=tpl.slice(0, bas).replace(/<title>[^<]*<\/title>/, '<title>Katalogdan takoz seçimi</title>');
  var alt=tpl.slice(kapa);
  var css=((typeof veThemeFontFaceCss==='function') ? veThemeFontFaceCss() : '')+'\n'+A.katexCss;
  var js=A.katexJs.replace(/<\/script/gi, '<\\/script');
  var govde=_mntPrmAntet(E)+_mntPrmToc()
    + _rBolunmez(_mntPrmKapsam(E)+_mntPrmYontem(E)+_mntPrmKisitlar(E)+_mntPrmEleme(E)
                 +_mntPrmSonuc(E)+_mntPrmSiralama(E)+_mntPrmVarsayim());
  return ust.replace('@@ASSETS_CSS@@', function(){ return css; })
       + govde
       + alt.replace('@@KATEX_JS@@', function(){ return js; });
}

if(typeof module!=='undefined' && module.exports){
  module.exports = {
    veMntParamRaporHTML: veMntParamRaporHTML, _MNT_PRM_KAYNAK: _MNT_PRM_KAYNAK,
    _mntPrmKapsam: _mntPrmKapsam, _mntPrmYontem: _mntPrmYontem, _mntPrmKisitlar: _mntPrmKisitlar,
    _mntPrmEleme: _mntPrmEleme, _mntPrmSonuc: _mntPrmSonuc, _mntPrmSiralama: _mntPrmSiralama,
    _mntPrmSekil: _mntPrmSekil, _mntPrmSatirOlcu: _mntPrmSatirOlcu
  };
}
