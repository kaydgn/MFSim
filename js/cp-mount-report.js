// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — RAPOR ÜRETECİ (mnt-report bileşeni)
// ============================================================================
// Çözücü'nün (_veMntLast) ürettiği 6 SD sonuçlarını, Fable ile hazırlanan teori
// raporunun estetiğinde, TAMAMEN ÇEVRİMDIŞI / self-contained bir HTML dosyasına
// döker. Teori (§1–7, 9, 10, Ek A) sabittir; §8 "Sayısal Örnek" bu modelin gerçek
// çözümünden üretilir. Harici referans (Adams) yoktur → doğrulama, model içi
// tutarlılık kontrollerine (Σf_z dengesi, çekme/lift-off, ±10 mm bandı) dönüşür.
//
// Bağımlılıklar TALEP ÜZERİNE yüklenir (uygulama açılışını şişirmez):
//   js/mount-report-template.js   → window.MNT_REPORT_TEMPLATE_B64 (teori şablonu)
//   js/mount-report-assets.js     → window.MNT_REPORT_ASSETS (KaTeX + fontlar)
// Bu iki dosya index.html'de type="text/x-mfsim-report" ile işaretlidir; loader
// bunları açılışta yüklemez, ilk rapor üretiminde _mntReportEnsureAssets çeker.
// ----------------------------------------------------------------------------

// ─── Küçük yardımcılar ───────────────────────────────────────────────────────
function _rEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _rNum(v){ var n=Number(v); return Number.isFinite(n)?n:NaN; }
// Sondaki sıfırları kırp: "20.000"→"20", "110.700"→"110.7", "-3.00"→"-3".
// (Türkçe'de virgül ondalıktır; "20,000" gibi görünen değerler yanıltmasın.)
function _rTrim(s){
  if(s.indexOf('.')<0) return s;
  return s.replace(/0+$/,'').replace(/\.$/,'');
}
// Türkçe ondalık (virgül) + gerçek eksi (−, U+2212). Boş/NaN → '—'.
function _rF(v, d){
  var n=Number(v); if(!Number.isFinite(n)) return '—';
  var s=_rTrim(n.toFixed(d==null?2:d)).replace('.', ',');
  if(s==='-0') s='0';                 // yuvarlamadan doğan "−0"ı engelle
  return s.replace(/^-/, '−');
}
// İşaretli (+/−, çökme için) Türkçe ondalık. Sıfır → işaretsiz "0".
function _rFs(v, d){
  var n=Number(v); if(!Number.isFinite(n)) return '—';
  var s=_rTrim(Math.abs(n).toFixed(d==null?2:d)).replace('.', ',');
  if(s==='0') return '0';
  return (n<0?'−':'+')+s;
}
// Büyük/küçük mertebeler için bilimsel gösterim: 1,68·10⁶. 0,001 ≤ |v| < 10000
// aralığında normal ondalık basılır — okunabilirlik için.
// Mantis YUVARLAMA SONRASI normalize edilir: 9,9996·10⁶ değeri 2 haneye
// yuvarlanınca "10·10⁶" olurdu; üs bir artırılıp "1·10⁷" basılır.
function _rE(v, d){
  var n=Number(v); if(!Number.isFinite(n)) return '—';
  if(n===0) return '0';
  var dd=(d==null)?2:d;
  var e=Math.floor(Math.log10(Math.abs(n)));
  if(e>=-3 && e<4) return _rF(n, dd);
  var m=n/Math.pow(10,e);
  if(!Number.isFinite(m)) return '—';                 // subnormal: 10^e taşar
  if(Math.abs(Number(m.toFixed(dd)))>=10){ m/=10; e+=1; }
  return _rF(m, dd)+'·10<sup>'+String(e).replace(/^-/, '−')+'</sup>';
}
function _rMountCore(){ return (typeof veMountCore!=='undefined')?veMountCore:(typeof window!=='undefined'?window.veMountCore:null); }

// Raporun kullanacağı MOTOR büyüklükleri (ateşleme frekansı için). Rölanti devri
// ve silindir sayısı motorun özelliğidir → TEK kaynak Motor bileşenidir; çözümle
// birlikte R.gather.torque içinde gelir. Eski projelerde bu ikisi Rapor düğümünde
// tutuluyordu → o değerler yalnız YEDEK olarak okunur.
// Dönüş: { idleRpm, cylinders, fromMotor:bool }  (bilinmeyen alan NaN)
function _mntRepEngine(R, opts){
  opts = opts || {};
  var tq = (R && R.gather && R.gather.torque) || {};
  var mRpm = Number(tq.idleRpm), mCyl = Number(tq.cylinders);
  var rpm = (Number.isFinite(mRpm) && mRpm > 0) ? mRpm : Number(opts.idleRpm);
  var cyl = (Number.isFinite(mCyl) && mCyl > 0) ? mCyl : Number(opts.cylinders);
  return {
    idleRpm: rpm, cylinders: cyl,
    fromMotor: (Number.isFinite(mRpm) && mRpm > 0) || (Number.isFinite(mCyl) && mCyl > 0)
  };
}

// İzolasyon değerlendirmesinin TEK hesap noktası — §8.8 ve uygunluk tablosu
// aynı sayıyı kullansın diye burada toplanır (iki yerde ayrı hesaplanıp
// birbirinden sapmasın).
//
// TABAN: düşey (bounce) doğal frekansı. Tahrik düşeydir; tek-serbestlik
// bağıntısının f_nat'ı da güç grubunun düşey kütle-yay frekansı olmalıdır.
// Modal frekanslardan biri (ör. roll) bu bağıntıya KONMAZ — bkz. çekirdek
// bounceFrequency yorumu.
// Dönüş: { fFire, fBounce, r, T (sönümlü), T0 (sönümsüz), zeta, ok }
function _mntRepIsolation(R, opts){
  var C=_rMountCore();
  var eng=_mntRepEngine(R, opts);
  var zeta=_mntRepZeta(R, opts);
  var fFire=(eng.idleRpm>0 && eng.cylinders>0) ? (eng.idleRpm/60)*(eng.cylinders/2) : NaN;
  var m=(R && R.mp && R.mp.m)>0 ? R.mp.m : NaN;
  var fB=(C && C.bounceFrequency) ? C.bounceFrequency(R && R.mounts, m) : NaN;
  var T =(C && Number.isFinite(fFire) && fB>0) ? C.transmissibility(fFire, fB, zeta) : NaN;
  var T0=(C && Number.isFinite(fFire) && fB>0) ? C.transmissibility(fFire, fB, 0)    : NaN;
  return { fFire:fFire, fBounce:fB, r:(fB>0?fFire/fB:NaN), T:T, T0:T0, zeta:zeta, ok:(T<0.5) };
}

// Raporun kullanacağı sönüm oranı. TEK kaynak Çözücü'dür (R.zeta). Eski
// projelerde ζ Rapor düğümünde tutuluyordu → o değer yalnız YEDEK olarak
// okunur; ikisi de yoksa çekirdek varsayılanına düşülür.
// ζ=0 GEÇERLİ BİR SEÇİMDİR (kasıtlı sönümsüz çözüm) — "girilmemiş" ile
// karıştırılmaz. Çözücü de aynı kapıyı kullanır (0 ≤ ζ < 1); ikisi ayrışırsa
// sönüm tablosu ζ=0, iletilebilirlik ζ=0,02 ile hesaplanırdı.
function _mntRepZeta(R, opts){
  var z = R ? Number(R.zeta) : NaN;
  if(Number.isFinite(z) && z>=0 && z<1) return z;
  z = opts ? Number(opts.zeta) : NaN;
  if(Number.isFinite(z) && z>=0 && z<1) return z;
  var C=_rMountCore();
  return (C && C.DEFAULT_ZETA>0) ? C.DEFAULT_ZETA : 0.02;
}

// ═══════════════════ BİLEŞEN PANELİ ═════════════════════════════════════════
function getMntReportPropertiesHTML(node){
  if(!node.data) node.data={};
  var solved = (typeof _veMntLast!=='undefined') && _veMntLast && !_veMntLast.error;
  var nC=0,nM=0;
  if(solved){ nC=(_veMntLast.gather.components||[]).length; nM=(_veMntLast.mounts||[]).length; }
  var html='<div class="sw-panel">';
  html+='<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
      + '<b style="color:var(--text-heading);">Rapor — çökme &amp; titreşim.</b> '
      + 'Çözücü\'nün 6 SD sonuçlarını akademik bir <b>HTML rapora</b> döker (teori + bu modelin sayısal örneği). '
      + 'Dosya <b>tamamen çevrimdışı</b>; matematik ve fontlar gömülüdür — her yerde açılır, yazdırılabilir.</div>';
  if(solved){
    html+='<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); background:var(--bg-tertiary); border:1px solid var(--border-color); color:var(--text-primary);">'
        + '<span style="color:var(--accent-success); font-weight:700;">✓ Model çözüldü</span> — '
        + nC+' bileşen · '+nM+' takoz. Rapor güncel çözüme göre üretilir.</div>';
    // Frekans yerleşimi & izolasyon girdileri BURADA GİRİLMEZ — her biri ait
    // olduğu bileşenin özelliğidir ve çözümle birlikte rapora akar:
    //   rölanti devri + silindir sayısı → Motor   (R.gather.torque)
    //   sönüm oranı ζ                   → Çözücü  (R.zeta)
    // Aynı sayının iki yerde girilip birbirinden sapması bir hata kaynağıydı;
    // panel artık yalnız YÜRÜRLÜKTEKİ değeri ve nereden geldiğini gösterir.
    var _eng=_mntRepEngine(_veMntLast, node.data);
    var _zt =_mntRepZeta(_veMntLast, node.data);
    var _val=function(v,dg,unit){ return (Number.isFinite(v)&&v>0)
        ? '<b style="color:var(--text-primary);">'+_rF(v,dg)+(unit||'')+'</b>'
        : '<b style="color:var(--accent-warning);">girilmedi</b>'; };
    var _fFire=(_eng.idleRpm>0 && _eng.cylinders>0) ? (_eng.idleRpm/60)*(_eng.cylinders/2) : NaN;
    html+='<div style="margin:0 0 10px; padding:9px 10px; background:var(--bg-secondary); border:1px solid var(--border-color);">'
        + '<div style="font-size:var(--fs-tiny); font-weight:600; color:var(--text-heading);">Frekans yerleşimi &amp; izolasyon</div>'
        + '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.4; margin:3px 0 7px;">Bu değerler girilmişse rapora §8.8 eklenir: ateşleme frekansı (f<sub>ateş</sub>), Kriter 1 ve Kriter 2.</div>'
        + '<div style="display:flex; flex-direction:column; gap:4px; font-size:var(--fs-micro); color:var(--text-secondary); line-height:1.5;">'
        +   '<div>Rölanti devri '+_val(_eng.idleRpm,0,' d/dk')+' · Silindir '+_val(_eng.cylinders,0,'')+' <span style="color:var(--text-muted);">← <b>Motor</b> bileşeni</span></div>'
        +   '<div>Sönüm oranı ζ = <b style="color:var(--text-primary);">'+_rF(_zt,3)+'</b> <span style="color:var(--text-muted);">← <b>Çözücü</b> bileşeni</span></div>'
        +   (Number.isFinite(_fFire)
              ? '<div style="color:var(--text-muted);">f<sub>ateş</sub> = (N/60)·(z/2) = <b style="color:var(--text-primary);">'+_rF(_fFire,1)+' Hz</b></div>'
              : '<div style="color:var(--accent-warning);">Ateşleme frekansı hesaplanamıyor — Motor bileşenine rölanti devri ve silindir sayısını girin (§8.8 atlanır).</div>')
        + '</div></div>';
    html+='<button onclick="veMntGenerateReport(\''+node.id+'\')" style="width:100%; padding:13px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.02em; border-radius:var(--radius-sm);" onmouseover="this.style.filter=\'brightness(1.12)\'" onmouseout="this.style.filter=\'none\'">📄 Raporu Oluştur ve İndir</button>';
  } else {
    html+='<div style="padding:10px 12px; margin-bottom:10px; background:rgba(245,158,11,0.12); border:1px solid var(--accent-warning); color:var(--accent-warning); font-size:var(--fs-body); line-height:1.5;">'
        + '<b>Önce hesaplayın.</b> Rapor, <b>Çözücü</b> bileşenindeki <b>▶ Hesapla</b> ile üretilen sonuçları kullanır. '
        + 'Çözücü\'yü çalıştırdıktan sonra buraya dönün.</div>';
    html+='<button disabled style="width:100%; padding:13px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:not-allowed; border-radius:var(--radius-sm);">📄 Raporu Oluştur ve İndir</button>';
  }
  html+='<div id="ve-mnt-report-status" style="margin-top:8px; font-size:var(--fs-tiny); color:var(--text-muted);"></div>';
  html+='</div>';
  return html;
}

// ═══════════════════ TALEP-ÜZERİNE VARLIK YÜKLEME ═══════════════════════════
var _mntReportAssetsTried=false;
function _mntReportEnsureAssets(cb){
  var haveT=(typeof window!=='undefined') && window.MNT_REPORT_TEMPLATE_B64;
  var haveA=(typeof window!=='undefined') && window.MNT_REPORT_ASSETS;
  if(haveT && haveA){ cb(true); return; }
  var phs = document.querySelectorAll('script[type="text/x-mfsim-report"]');
  if(!phs.length){ cb(!!(window.MNT_REPORT_TEMPLATE_B64 && window.MNT_REPORT_ASSETS)); return; }
  var pending=0, finished=false;
  function done(){
    if(finished) return; finished=true;
    cb(!!(window.MNT_REPORT_TEMPLATE_B64 && window.MNT_REPORT_ASSETS));
  }
  Array.prototype.forEach.call(phs, function(ph){
    pending++;
    var s=document.createElement('script');
    if(ph.src){
      s.src=ph.src;
      s.onload=function(){ if(--pending<=0) done(); };
      s.onerror=function(){ if(--pending<=0) done(); };
      document.head.appendChild(s);
    } else {
      // Monolitik build: içerik inline (henüz execute edilmedi) → kopyala, çalıştır.
      s.textContent=ph.textContent;
      document.head.appendChild(s);
      if(--pending<=0) done();
    }
  });
}

// ═══════════════════ GİRİŞ NOKTASI ══════════════════════════════════════════
// Rapor düğümünü nerede olursa olsun bul: canlı kanvasta (alt topoloji açıksa)
// ya da ana topolojideki 'mount-analysis' düğümlerinin gömülü alt topolojisinde.
//
// NEDEN: rölanti devri / silindir sayısı / ζ'nin TEK kaynağı çözüm sonucudur
// (R.gather). Ama ESKİ projelerde bu üçü Rapor düğümünde tutuluyordu ve
// _mntRepEngine onları yalnız opts YEDEĞİNDEN okuyabiliyor. Rapor, Çözücü
// panelinden değil de Sonuçlar ağacındaki kısayoldan üretildiğinde düğüm
// kimliği bilinmez; yedek bulunamazsa ateşleme frekansı NaN kalır ve §8.13 ile
// uygunluk satırı sessizce boşalır. Yani AYNI rapor iki yoldan farklı çıkardı.
function _mntFindReportNode(){
  if(typeof nodes==='undefined' || !Array.isArray(nodes)) return null;
  var live=nodes.find(function(n){ return n.type==='mnt-report'; });
  if(live) return live;
  for(var i=0;i<nodes.length;i++){
    var sub=nodes[i] && nodes[i].data && nodes[i].data.subTopology;
    var inner=(sub && Array.isArray(sub.nodes))
      ? sub.nodes.find(function(n){ return n.type==='mnt-report'; }) : null;
    if(inner) return inner;
  }
  return null;
}

function veMntGenerateReport(nodeId){
  var st = (typeof document!=='undefined') ? document.getElementById('ve-mnt-report-status') : null;
  function setStatus(m,c){ if(st){ st.textContent=m; st.style.color=c||'var(--text-muted)'; } }
  if(typeof _veMntLast==='undefined' || !_veMntLast || _veMntLast.error){
    if(typeof showToast==='function') showToast('Önce Çözücü\'de ▶ Hesapla ile modeli çözün.','warning');
    setStatus('Çözülmüş sonuç yok — Çözücü\'yü çalıştırın.','var(--accent-warning)');
    return;
  }
  var R=_veMntLast;
  var node=(typeof nodes!=='undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) node=_mntFindReportNode();
  var opts=(node && node.data) ? { idleRpm:node.data.idleRpm, cylinders:node.data.cylinders, zeta:node.data.zeta } : {};
  setStatus('Rapor hazırlanıyor…');
  if(typeof showToast==='function') showToast('Rapor hazırlanıyor…','info');
  _mntReportEnsureAssets(function(ok){
    if(!ok){
      if(typeof showToast==='function') showToast('Rapor varlıkları yüklenemedi.','error');
      setStatus('Varlıklar yüklenemedi.','var(--accent-danger)');
      return;
    }
    try {
      var html=_mntBuildReportHTML(R, opts);
      _mntReportDownload(html, 'takoz_cokme_titresim_raporu.html');
      setStatus('İndirildi ✓ ('+Math.round(html.length/1024)+' KB)','var(--accent-success)');
      if(typeof showToast==='function') showToast('Rapor indirildi.','success');
    } catch(e){
      if(typeof showToast==='function') showToast('Rapor üretilemedi: '+e.message,'error');
      setStatus('Hata: '+e.message,'var(--accent-danger)');
      if(typeof console!=='undefined') console.error('[Takoz Rapor]', e);
    }
  });
}

function _mntReportDownload(html, filename){
  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
}

// ═══════════════════ RAPOR MONTAJI ══════════════════════════════════════════
function _mntBuildReportHTML(R, opts){
  var A=window.MNT_REPORT_ASSETS;
  var tpl=decodeURIComponent(escape(atob(window.MNT_REPORT_TEMPLATE_B64)));
  var assetsCss=A.fontsCss + '\n' + A.katexCss;
  var katexJs=A.katexJs.replace(/<\/script>/gi,'<\\/script>');
  var antet=_mntRepAntet(R);
  var sec8=_mntRepSection8(R, opts);
  var compliance=_mntRepCompliance(R, opts);
  // Fonksiyon-replacer: dinamik HTML içindeki $$…$$ ($ desenleri) bozulmasın.
  return tpl
    .replace('@@ASSETS_CSS@@', function(){ return assetsCss; })
    .replace('@@KATEX_JS@@',   function(){ return katexJs; })
    .replace('@@ANTET@@',      function(){ return antet; })
    .replace('@@SECTION8@@',   function(){ return sec8; })
    .replace('@@COMPLIANCE@@', function(){ return compliance; });
}

// ─── Antet (dinamik başlık bloğu) ────────────────────────────────────────────
// Nonlineer (eğri) z-yasası taşıyan takozları döndür (SI R.mounts üzerinden).
function _mntRepNLMounts(R){
  return (R.mounts||[]).filter(function(m){ return m && m.curves && m.curves.z && m.curves.z.length>=2; });
}
function _mntRepAntet(R){
  var nC=(R.gather.components||[]).length, nM=(R.mounts||[]).length;
  var mass=_rF(R.mp.m,1);
  var date='—';
  try { date=new Date().toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'}); } catch(e){}
  var nNL=_mntRepNLMounts(R).length;
  var method = nNL ? ('Newton-Raphson · '+nNL+' nonlineer takoz') : 'Lineer (kapalı-form)';
  return ''
  + '<div class="antet">'
  + '  <div class="band">'
  + '    <div class="eyebrow">Analiz Raporu · Güç Aktarma Organları Mühendisliği</div>'
  + '    <h1>Güç Grubu Takoz Sistemi: Çökme ve Titreşim Analizi</h1>'
  + '    <div class="sub">Elastik mesnetler üzerindeki güç grubunun statik çökme ve rijit gövde titreşim analizi — projede tanımlı modelden otomatik üretilmiştir</div>'
  + '  </div>'
  + '  <div class="fields">'
  + '    <div class="f"><div class="k">Doküman Türü</div><div class="v">Analiz Raporu</div></div>'
  + '    <div class="f"><div class="k">Model</div><div class="v">'+nC+' bileşen · '+nM+' takoz</div></div>'
  + '    <div class="f"><div class="k">Toplam Kütle</div><div class="v">'+mass+' kg</div></div>'
  + '    <div class="f"><div class="k">Çözüm Yöntemi</div><div class="v">'+_rEsc(method)+'</div></div>'
  + '    <div class="f"><div class="k">Tarih</div><div class="v">'+_rEsc(date)+'</div></div>'
  + '  </div>'
  + '</div>';
}

// Nonlineer çözüm notu (§8) — hangi takozlar eğri kullanıyor + Newton yakınsaması.
// Tüm takozlar lineerse boş döner (rapora hiçbir şey eklenmez).
function _mntRepNLNote(R){
  var nl=_mntRepNLMounts(R);
  if(!nl.length) return '';
  var names=nl.map(function(m){ return _rEsc(m.name||'takoz'); }).join(', ');
  var notConv=0, iters=0;
  (R.allCases||[]).concat(R.gearCases||[], R.designCases||[]).forEach(function(rc){
    var ck=rc && rc.res && rc.res.checks; if(!ck) return;
    if(ck.converged===false || ck.stopConverged===false) notConv++;
    if(ck.newtonIters) iters=Math.max(iters, ck.newtonIters);
  });
  var conv = notConv
    ? '<b style="color:#b45309;">'+notConv+' yük durumunda yakınsama sağlanamadı</b>'
    : 'tüm yük durumları yakınsadı (en çok '+iters+' Newton iterasyonu)';
  return '<div style="margin:10px 0 14px; padding:10px 13px; border-left:3px solid #b45309; background:rgba(180,83,9,0.06); font-size:0.93em; line-height:1.55;">'
    + '<b>Nonlineer çözüm.</b> '+nl.length+' takoz ('+names+') ölçülmüş düşey kuvvet–sehim eğrisi taşır; '
    + 'denge doğrudan lineer ters-çözüm yerine <b>Newton-Raphson</b> ile bulunmuştur '
    + '(tanjant rijitlik K<sub>T</sub> = Σ&nbsp;Aᵀ&nbsp;φ′(δ)&nbsp;A). Lineer ve nonlineer takozlar tek bağlı '
    + 'sistemde birlikte çözülür; modal analiz statik dengedeki tanjant rijitlikle yapılır '
    + '(önyüklü çalışma noktası). Yakınsama: '+conv+'.</div>';
}

// ─── Geometri (mm) — R.gather'dan sayısal; birleşik CG R.mp'den (otorite) ────
function _mntRepGeom(R){
  var comps=(R.gather.components||[]).map(function(c){
    return { name:c.name||'bileşen', mass:_rNum(c.mass), x:_rNum(c.cgx), y:_rNum(c.cgy), z:_rNum(c.cgz),
             Ixx:_rNum(c.Ixx), Iyy:_rNum(c.Iyy), Izz:_rNum(c.Izz), pointMass:!!c.pointMass };
  }).filter(function(c){ return Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.z); });
  var mounts=(R.gather.mounts||[]).map(function(m){
    return { name:m.name||'takoz', x:_rNum(m.x), y:_rNum(m.y), z:_rNum(m.z) };
  }).filter(function(m){ return Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z); });
  var cg={ x:R.mp.cg[0]*1000, y:R.mp.cg[1]*1000, z:R.mp.cg[2]*1000 };
  return { comps:comps, mounts:mounts, cg:cg };
}

// Dinamik tablo/şekil numaralandırma (koşullu tablolar boşluk bırakmasın).
// Şekil 1 = teori şablonundaki kavramsal model → dinamik şekiller 2'den başlar.
var _repTblNo=0, _repFigNo=1;
function _rTbl(){ return ++_repTblNo; }
function _rFig(){ return ++_repFigNo; }

// ─── §8 — SAYISAL ÖRNEK (dinamik) ────────────────────────────────────────────
// opts: { idleRpm, cylinders, zeta } — frekans yerleşimi + iletilebilirlik (opsiyonel, panelden).
function _mntRepSection8(R, opts){
  opts=opts||{};
  _repTblNo=0; _repFigNo=1;   // her rapor üretiminde sıfırla
  var C=_rMountCore();
  var geom=_mntRepGeom(R);
  var h='<h2 id="s8"><span class="no">8</span>Sayısal Örnek: Bu Modelin Çözümü</h2>';
  h+='<p>Bölüm 2–7\'deki yöntem, projede tanımlı güç grubuna uygulanır. Tüm kütle ve takozlar iç topolojiden otomatik toplanır; girdiler aşağıda listelenir, ardından kütle birleştirme, rijitlik, statik çökme, tork süperpozisyonu, tüm yük durumları ve modal analiz adımları bu modelin gerçek değerleriyle çözülür. Koordinatlar model girdisiyle aynıdır (uzunluk mm, kütle kg, rijitlik N/mm).</p>';
  h+=_mntRepNLNote(R);
  h+=_mntRepCritical(R);
  h+=_mntRepMassTable(geom);
  h+=_mntRepMountTable(R);
  h+=_mntRepFigure(geom,'xy',_rFig(),'Üstten görünüş (X–Y düzlemi, ölçekli): takozlar (kare, adlı), bileşen ağırlık merkezleri (daire) ve birleşik ağırlık merkezi (G).');
  h+=_mntRepFigure(geom,'xz',_rFig(),'Yandan görünüş (X–Z düzlemi, ölçekli). Ağırlık merkezinin takoz düzlemlerine göre düşey ofseti, öteleme–dönme kuplajının (K<sub>tθ</sub>) ana kaynağıdır.');
  h+=_mntRepStep1Mass(R);
  h+=_mntRepStep2Stiffness(R, C);
  h+=_mntRepStep3Static(R, geom);
  h+=_mntRepStep4Torque(R);
  h+=_mntRepLoadCaseMatrix(R);
  h+=_mntRepDeflectionDetail(R);
  h+=_mntRepStep5Modal(R, C);
  h+=_mntRepFreqPlacement(R, opts);
  h+=_mntRepGearForces(R);
  h+=_mntRepDesignLoads(R);
  h+=_mntRepConsistency(R);          // 8.11 — numara sırası okuma sırasıyla aynı olsun
  h+=_mntRepDamping(R);
  h+=_mntRepFRF(R, opts);
  h+=_mntRepModalEnergy(R);
  h+=_mntRepSoftening(R, opts);
  h+=_mntRepModeShapes(R);
  return h;
}

// §8.6 — Takoz bazında ÜÇ-EKSEN çökme detayı (her takoz için ayrı tablo).
// δz özeti (§8.5) çoğu durumda yeterli değildir: viraj/bordür darbesinde yanal
// (δy), fren/tork'ta boyuna (δx) sehim kritiktir. Her takoz için tüm yük
// durumlarındaki δx/δy/δz burada verilir. Tek sayfaya sığmayabilir; tablolar
// sayfalara yayılır (break-inside:avoid ile her tablo bütün kalır).
function _mntRepDeflectionDetail(R){
  var mounts=R.mounts||[], cases=R.allCases||[];
  var h='<h3>8.6 Adım 6 — Takoz bazında üç-eksen çökme detayı</h3>';
  h+='<p>Her takoz için tüm yük durumlarındaki üç-eksen sehimi: δ_x (boyuna), δ_y (enine), δ_z (düşey) [mm]. Düşey özetin (§8.5) ötesinde yanal ve boyuna sehimler de değerlendirilir — viraj / bordür darbesinde δ_y, fren / tahrik torkunda δ_x baskın olabilir. <b>Çekme</b> (δ_z &gt; 0, lift-off) ve herhangi bir eksende <b>±10 mm aşımı</b> (lineer-dışı) işaretlidir.</p>';
  mounts.forEach(function(mnt, mi){
    h+='<table><caption>Tablo '+_rTbl()+' — '+_rEsc(mnt.name||('Takoz '+(mi+1)))+': yük durumlarına göre çökme [mm]</caption>';
    h+='<tr><th>Yük durumu</th><th>δ_x</th><th>δ_y</th><th>δ_z</th><th>Durum</th></tr>';
    cases.forEach(function(rc){
      if(!rc.res){ h+='<tr><td class="l">'+_rEsc(_mntRepCaseTr(rc.name))+'</td><td colspan="4" class="c">— (çözülemedi)</td></tr>'; return; }
      var pm=rc.res.perMount[mi]; if(!pm) return;
      var dx=pm.delta[0]*1000, dy=pm.delta[1]*1000, dz=pm.delta[2]*1000;
      var flag = pm.tension ? '<span style="color:var(--warn,#8a5a1e)">çekme ⟂</span>' : (pm.clamped ? '<span style="color:var(--warn,#8a5a1e)">durdurucu ▢</span>' : (pm.overLinear ? 'lineer-dışı' : '<span class="ok">✓</span>'));
      h+='<tr><td class="l">'+_rEsc(_mntRepCaseTr(rc.name))+'</td>'
        +'<td>'+_rFs(dx,2)+'</td><td>'+_rFs(dy,2)+'</td><td>'+_rFs(dz,2)+'</td>'
        +'<td class="c">'+flag+'</td></tr>';
    });
    h+='</table>';
  });
  return h;
}

// Yük durumu adı → Türkçe etiket.
function _mntRepCaseTr(name){
  var map={ 'Static':'Statik (yerçekimi)', 'Max Bump':'Tümsek (3,5g)',
    'Braking':'Frenleme (1g)', 'Acceleration':'Hızlanma (1g)',
    'Cornering Left':'Viraj — sol (0,6g)', 'Cornering Right':'Viraj — sağ (0,6g)',
    'Brake in Turn L':'Frenlemeli viraj — sol', 'Brake in Turn R':'Frenlemeli viraj — sağ',
    'Pothole Braking':'Çukur + fren (3,5g)',
    'Kerb Strike L':'Yanal bordür darbesi — sol (1,55g)', 'Kerb Strike R':'Yanal bordür darbesi — sağ (1,55g)',
    'Max Rebound':'Azami geri esneme (droop)',
    'Forward Torque':'İleri tork', 'Reverse Torque':'Geri tork',
    // eski adlar (geriye dönük uyumluluk):
    'Cornering':'Viraj (0,6g)', 'Brake in Turn':'Frenlemeli viraj',
    'Rim Lateral Kerb Strike':'Yanal bordür darbesi',
    'Cornering L':'Viraj — sol', 'Cornering R':'Viraj — sağ' };
  return map[name] || name;
}

// Kısa takoz adı (matris sütun başlığı için).
function _mntRepShort(name, n){
  name=String(name||'takoz').replace(/\s*takoz\s*$/i,'').trim() || 'takoz';
  n=n||8; return name.length>n ? name.slice(0,n-1)+'…' : name;
}

// Kritik sonuç özeti — tüm yük durumlarını tarar (5 saniyelik okuma).
function _mntRepCritical(R){
  var maxDz=null, maxF=null, lift={}, over={}, clamp={}, nCases=0;
  (R.allCases||[]).forEach(function(rc){
    if(!rc.res) return; nCases++;
    rc.res.perMount.forEach(function(pm){
      var dz=Math.abs(pm.delta[2]*1000);
      if(!maxDz || dz>maxDz.v) maxDz={v:dz, mount:pm.name, cas:rc.name};
      var fm=Math.sqrt(pm.f[0]*pm.f[0]+pm.f[1]*pm.f[1]+pm.f[2]*pm.f[2])/1000;
      if(!maxF || fm>maxF.v) maxF={v:fm, mount:pm.name, cas:rc.name};
    });
    if(rc.res.checks.tensionCount>0) lift[rc.name]=1;
    if(rc.res.checks.overLinearCount>0) over[rc.name]=1;
    if(rc.res.checks.clampCount>0) clamp[rc.name]=1;   // ±15 mm metal-metal durdurucu (F4)
  });
  var liftC=Object.keys(lift), overC=Object.keys(over), clampC=Object.keys(clamp);
  var modes=R.modes||[];
  var cls=(overC.length===0 && liftC.length===0)?'check':'warn';
  var row=function(k,v){ return '<div style="margin:3px 0;"><strong style="color:var(--prusya);">'+k+':</strong> '+v+'</div>'; };
  var h='<div class="note '+cls+'"><span class="t">Kritik Sonuç Özeti</span>';
  if(maxDz) h+=row('Maks düşey sehim', '|δ_z| = '+_rF(maxDz.v,2)+' mm — <b>'+_rEsc(maxDz.mount)+'</b> ('+_rEsc(_mntRepCaseTr(maxDz.cas))+')');
  if(maxF)  h+=row('Maks takoz kuvveti (bileşke)', _rF(maxF.v,2)+' kN — <b>'+_rEsc(maxF.mount)+'</b> ('+_rEsc(_mntRepCaseTr(maxF.cas))+') — dayanım tasarımı için');
  h+=row('Çekme / lift-off', liftC.length ? '<b style="color:var(--warn);">var</b> — '+liftC.map(function(c){return _rEsc(_mntRepCaseTr(c));}).join(', ')+' (takoz gerilmeye geçer)' : 'yok — tüm takozlar basıda');
  h+=row('Lineerlik (±10 mm)', overC.length ? '<b style="color:var(--warn);">aşım</b> — '+overC.map(function(c){return _rEsc(_mntRepCaseTr(c));}).join(', ')+' (nonlineer bölge)' : 'tüm sehimler bantta');
  h+=row('Durdurucu (±15 mm metal-metal)', clampC.length ? '<b style="color:var(--warn);">devrede</b> — '+clampC.map(function(c){return _rEsc(_mntRepCaseTr(c));}).join(', ')+' (takoz dibe oturur; yük yeniden dağılır)' : 'hiçbir takoz durdurucuya oturmadı');
  if(modes.length) h+=row('Modal bant', 'en düşük '+_rF(modes[0].f_Hz,2)+' Hz · en yüksek '+_rF(modes[modes.length-1].f_Hz,2)+' Hz ('+modes.length+' rijit gövde modu)');
  h+='<div style="margin-top:5px; font-size:0.9em; color:#5a6270;">'+nCases+' yük durumu çözüldü; ayrıntı için aşağıdaki adımlar ve yük durumu matrisi.</div>';
  h+='</div>';
  return h;
}

// Tablo 1 — bileşen kütle özellikleri
function _mntRepMassTable(geom){
  var g=(_veMntLast.gather.components||[]);
  var h='<table><caption>Tablo '+_rTbl()+' — Bileşen kütle özellikleri (model girdisi; atalet, bileşenin kendi ağırlık merkezine göre)</caption>';
  h+='<tr><th>Bileşen</th><th>m [kg]</th><th>c_x [mm]</th><th>c_y [mm]</th><th>c_z [mm]</th><th>I_xx</th><th>I_yy</th><th>I_zz [kg·m²]</th></tr>';
  g.forEach(function(c){
    var pm=!!c.pointMass;
    h+='<tr><td class="l">'+_rEsc(c.name||'bileşen')+'</td>'
      +'<td>'+_rF(c.mass,2)+'</td>'
      +'<td>'+_rF(c.cgx,2)+'</td><td>'+_rF(c.cgy,2)+'</td><td>'+_rF(c.cgz,2)+'</td>';
    if(pm){ h+='<td colspan="3" class="c">yığılı (nokta) kütle</td>'; }
    else { h+='<td>'+_rF(c.Ixx,3)+'</td><td>'+_rF(c.Iyy,3)+'</td><td>'+_rF(c.Izz,3)+'</td>'; }
    h+='</tr>';
  });
  h+='</table>';
  return h;
}

// Tablo 2 — takoz konum + rijitlik
function _mntRepMountTable(R){
  var g=(R.gather.mounts||[]);
  var h='<table><caption>Tablo '+_rTbl()+' — Takoz konumları ve rijitlikleri (statik / dinamik, üç eksen)</caption>';
  h+='<tr><th>Takoz</th><th>x [mm]</th><th>y [mm]</th><th>z [mm]</th><th>k_x,s</th><th>k_y,s</th><th>k_z,s</th><th>k_x,d</th><th>k_y,d</th><th>k_z,d [N/mm]</th></tr>';
  g.forEach(function(m){
    h+='<tr><td class="l">'+_rEsc(m.name||'takoz')+'</td>'
      +'<td>'+_rF(m.x,2)+'</td><td>'+_rF(m.y,2)+'</td><td>'+_rF(m.z,2)+'</td>'
      +'<td>'+_rF(m.kxs,0)+'</td><td>'+_rF(m.kys,0)+'</td><td>'+_rF(m.kzs,0)+'</td>'
      +'<td>'+_rF(m.kxd,0)+'</td><td>'+_rF(m.kyd,0)+'</td><td>'+_rF(m.kzd,0)+'</td></tr>';
  });
  h+='</table>';
  return h;
}

// Yakın (çakışan) noktaları ekran-uzaklığına göre kümele → tek işaret + birleşik
// etiket. Yandan/üstten görünüşte aynı noktaya düşen takozlar üst üste binmesin.
function _repCluster(pts, thr){
  var cl=[];
  pts.forEach(function(p){
    var f=null;
    for(var i=0;i<cl.length;i++){ if(Math.hypot(cl[i].x-p.x, cl[i].y-p.y) < thr){ f=cl[i]; break; } }
    if(f){ var n=f.names.length; f.x=(f.x*n+p.x)/(n+1); f.y=(f.y*n+p.y)/(n+1); f.names.push(p.name); }
    else cl.push({ x:p.x, y:p.y, names:[p.name] });
  });
  return cl;
}
function _repClusterLabel(names, maxlen, nameLen, unit){
  var uniq=[]; names.forEach(function(nm){ var s=_mntRepShort(nm, nameLen||14); if(uniq.indexOf(s)<0) uniq.push(s); });
  var t=uniq.join(' · ');
  return (t.length>(maxlen||22)) ? names.length+' '+(unit||'öğe') : t;
}
// Etiket yerleştirme + dikey çakışma-önleme (greedy). Her etiket işaretinden
// dışa doğru (dir) itilir; çakışırsa satır satır uzaklaştırılır.
function _repPlaceLabels(labels, H){
  labels.forEach(function(L){
    L.h=11; L.w=Math.max(20, L.text.length*L.fs*0.56);
    var off=(L.marker==='sq')?14:12;
    L.y=L.ay + (L.dir>0 ? off+L.h*0.7 : -off);
  });
  labels.sort(function(a,b){ return a.cx-b.cx; });
  var placed=[];
  labels.forEach(function(L){
    var t=0;
    while(t<16){
      var ov=placed.some(function(P){ return Math.abs(P.cx-L.cx) < (P.w+L.w)/2+3 && Math.abs(P.y-L.y) < (P.h+L.h)/2+1; });
      if(!ov) break;
      L.y += L.dir*(L.h+2); t++;
    }
    L.y=Math.max(11, Math.min(H-4, L.y));
    placed.push({ cx:L.cx, y:L.y, w:L.w, h:L.h });
  });
}

// Şekil 2/3 — ölçekli akademik SVG (üstten X–Y / yandan X–Z). Çakışan takozlar
// kümelenir; etiketler çakışma-önlemeyle yerleştirilir.
function _mntRepFigure(geom, plane, no, caption){
  var horiz='x', vert=(plane==='xy')?'y':'z';
  var pts=[];
  geom.mounts.forEach(function(m){ pts.push({h:m[horiz], v:m[vert]}); });
  geom.comps.forEach(function(c){ pts.push({h:c[horiz], v:c[vert]}); });
  if(geom.cg) pts.push({h:geom.cg[horiz], v:geom.cg[vert]});
  pts.push({h:0,v:0});
  if(pts.length<2){ return ''; }
  var hs=pts.map(function(p){return p.h;}), vs=pts.map(function(p){return p.v;});
  var minH=Math.min.apply(null,hs), maxH=Math.max.apply(null,hs);
  var minV=Math.min.apply(null,vs), maxV=Math.max.apply(null,vs);
  var W=820, H=330, padL=70, padR=44, padT=60, padB=54;
  var rngH=Math.max(maxH-minH,1), rngV=Math.max(maxV-minV,1);
  var plotW=W-padL-padR, plotH=H-padT-padB;
  var sc=Math.min(plotW/rngH, plotH/rngV); // eşit ölçek (izometrik oran korunur)
  var offH=padL+(plotW-rngH*sc)/2, offV=padT+(plotH-rngV*sc)/2;
  function sx(hh){ return offH+(hh-minH)*sc; }
  function sy(vv){ return offV+(maxV-vv)*sc; } // vert yukarı
  var svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
  svg+='<defs><marker id="ra'+no+'" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L8,3.5 L0,7 Z" fill="#24425f"/></marker></defs>';
  // referans eksen köşesi
  var ax=22, ay=28;
  svg+='<line x1="'+ax+'" y1="'+ay+'" x2="'+(ax+46)+'" y2="'+ay+'" stroke="#24425f" stroke-width="1.6" marker-end="url(#ra'+no+')"/>';
  svg+='<text x="'+(ax+52)+'" y="'+(ay+4)+'" font-size="12" fill="#24425f">+X</text>';
  svg+='<line x1="'+ax+'" y1="'+ay+'" x2="'+ax+'" y2="'+(ay+40)+'" stroke="#24425f" stroke-width="1.6" marker-end="url(#ra'+no+')"/>';
  svg+='<text x="'+(ax-6)+'" y="'+(ay+54)+'" font-size="12" fill="#24425f">'+(plane==='xy'?'−Y':'−Z')+'</text>';
  svg+='<text x="'+(ax)+'" y="'+(ay-10)+'" font-size="10.5" fill="#5a6270">'+(plane==='xy'?'+Y yukarı':'+Z yukarı')+'</text>';
  // orta çizgi (v=0)
  var y0=(minV<=0 && maxV>=0) ? sy(0) : (padT+plotH/2);
  if(minV<=0 && maxV>=0){ svg+='<line x1="'+padL+'" y1="'+y0.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+y0.toFixed(1)+'" stroke="#c9cdd3" stroke-width="1.4" stroke-dasharray="7 5"/>'; }
  // kümele
  var mClust=_repCluster(geom.mounts.map(function(m){ return {x:sx(m[horiz]), y:sy(m[vert]), name:m.name}; }), 26);
  var cClust=_repCluster(geom.comps.map(function(c){ return {x:sx(c[horiz]), y:sy(c[vert]), name:c.name}; }), 18);
  // takoz kareleri (küme başına bir kare)
  mClust.forEach(function(k){ svg+='<rect x="'+(k.x-7).toFixed(1)+'" y="'+(k.y-7).toFixed(1)+'" width="14" height="14" fill="#fff" stroke="#1b1e24" stroke-width="1.8"/>'; });
  // bileşen CG daireleri
  cClust.forEach(function(k){ svg+='<circle cx="'+k.x.toFixed(1)+'" cy="'+k.y.toFixed(1)+'" r="6" fill="none" stroke="#5a6270" stroke-width="1.6"/>'; });
  // birleşik CG (pinwheel G)
  if(geom.cg){
    var GX=sx(geom.cg[horiz]), GY=sy(geom.cg[vert]), r=11;
    svg+='<g transform="translate('+GX.toFixed(1)+','+GY.toFixed(1)+')">'
       +'<circle r="'+r+'" fill="#fff" stroke="#1b1e24" stroke-width="1.6"/>'
       +'<path d="M0,0 L'+r+',0 A'+r+','+r+' 0 0 1 0,'+r+' Z M0,0 L-'+r+',0 A'+r+','+r+' 0 0 1 0,-'+r+' Z" fill="#1b1e24"/>'
       +'<text x="0" y="'+(-r-5)+'" text-anchor="middle" font-size="11.5" fill="#1b1e24" font-weight="600">G</text></g>';
  }
  // etiketler → çakışma-önlemeyle yerleştir
  var labels=[];
  mClust.forEach(function(k){ labels.push({ cx:k.x, ay:k.y, text:_repClusterLabel(k.names,20,14,'takoz'), dir:(k.y<=y0?-1:1), fs:9.5, col:'#1b1e24', marker:'sq' }); });
  cClust.forEach(function(k){ labels.push({ cx:k.x, ay:k.y, text:_repClusterLabel(k.names,19,17,'bileşen'), dir:(k.y<y0?-1:1), fs:10, col:'#5a6270', marker:'ci' }); });
  _repPlaceLabels(labels, H-2);
  labels.forEach(function(L){ svg+='<text x="'+L.cx.toFixed(1)+'" y="'+L.y.toFixed(1)+'" text-anchor="middle" font-size="'+L.fs+'" fill="'+L.col+'">'+_rEsc(L.text)+'</text>'; });
  svg+='</svg>';
  return '<figure>'+svg+'<figcaption><b>Şekil '+no+' —</b> '+caption+'</figcaption></figure>';
}

// §8.1 — kütle birleştirme (m, c_G, I_G)
function _mntRepStep1Mass(R){
  var m=R.mp.m, cg=R.mp.cg.map(function(v){return v*1000;}), I=R.mp.I_G;
  function row(a){ return a.map(function(v){return _rF(v,1);}).join(' & '); }
  var h='<h3>8.1 Adım 1 — Kütle birleştirme</h3>';
  h+='<p>Denklem (4.1)–(4.2) uygulanır; toplam kütle, birleşik ağırlık merkezi ve ağırlık merkezine göre atalet tensörü:</p>';
  h+='$$ m='+_rF(m,3)+'\\ \\text{kg},\\qquad \\mathbf c_G=\\begin{bmatrix}'+_rF(cg[0],2)+'\\\\ '+_rF(cg[1],2)+'\\\\ '+_rF(cg[2],2)+'\\end{bmatrix}\\text{mm},\\qquad '
    +'\\mathbf I_G=\\begin{bmatrix}'
    +row(I[0])+'\\\\ '+row(I[1])+'\\\\ '+row(I[2])
    +'\\end{bmatrix}\\text{kg}\\!\\cdot\\!\\text{m}^2 $$';
  // ΣFz tutarlılık (statik durumdan)
  var stat=_mntRepFindCase(R,'Static');
  if(stat && stat.res){
    var sfz=stat.res.sumF[2];
    var Fz=stat.res.F?stat.res.F[2]:(-m*9.81);
    h+='<div class="note check"><span class="t">Tutarlılık · kütle birleştirme</span>'
      +'Statik durumda takozların ilettiği toplam düşey kuvvet Σf_z = '+_rF(sfz/1000,2)+' kN, dış düşey yükü '
      +'F_z = '+_rF(Fz/1000,2)+' kN dengeler (fark '+_rF(Math.abs(stat.res.checks.sumFzResidual),1)+' N). '
      +'Atalet tensöründeki çarpım terimleri (I_xz, I_yz) sıfırdan farklıysa, bounce–pitch ve roll–yaw kuplajlarının kütle tarafındaki kaynağıdır.</div>';
  }
  // ── Asal atalet — dış referanslarla karşılaştırma için ────────────────────
  // Çok gövdeli yazılımların "aggregate mass" çıktısı ataleti çoğu zaman ASAL
  // eksende, bir yönelim açısıyla birlikte basar. Global eksendeki I_G ile o
  // sayılar doğrudan karşılaştırılamaz; okuyucu farkı "hata" sanmasın diye
  // ayrıştırma burada verilir.
  var C0=_rMountCore();
  var pr = (C0 && C0.principalInertia) ? C0.principalInertia(I) : null;
  if(pr){
    var off = Math.max(Math.abs(I[0][1]), Math.abs(I[0][2]), Math.abs(I[1][2]));
    var diag = Math.max(Math.abs(I[0][0]), Math.abs(I[1][1]), Math.abs(I[2][2]));
    var oran = (diag>0) ? off/diag : 0;
    h+='<table><caption>Tablo '+_rTbl()+' — Birleşik gövdenin atalet tensörü: global eksen ve asal eksen</caption>';
    h+='<tr><th></th><th>1</th><th>2</th><th>3</th><th>Açıklama</th></tr>';
    h+='<tr><td class="l">Global köşegen I<sub>xx</sub>/I<sub>yy</sub>/I<sub>zz</sub></td>'
      +'<td>'+_rF(I[0][0],2)+'</td><td>'+_rF(I[1][1],2)+'</td><td>'+_rF(I[2][2],2)+'</td>'
      +'<td class="l">model eksen takımında [kg·m²]</td></tr>';
    h+='<tr><td class="l">Çarpım I<sub>xy</sub>/I<sub>xz</sub>/I<sub>yz</sub></td>'
      +'<td>'+_rF(I[0][1],3)+'</td><td>'+_rF(I[0][2],3)+'</td><td>'+_rF(I[1][2],3)+'</td>'
      +'<td class="l">kütle kaynaklı kuplaj terimleri</td></tr>';
    h+='<tr><td class="l"><b>Asal atalet</b> I<sub>1</sub>&lt;I<sub>2</sub>&lt;I<sub>3</sub></td>'
      +'<td><b>'+_rF(pr.values[0],2)+'</b></td><td><b>'+_rF(pr.values[1],2)+'</b></td><td><b>'+_rF(pr.values[2],2)+'</b></td>'
      +'<td class="l">tensörün özdeğerleri</td></tr>';
    ['1','2','3'].forEach(function(n,k){
      h+='<tr><td class="l">Asal eksen e<sub>'+n+'</sub></td>'
        +'<td>'+_rFs(pr.axes[k][0],3)+'</td><td>'+_rFs(pr.axes[k][1],3)+'</td><td>'+_rFs(pr.axes[k][2],3)+'</td>'
        +'<td class="l">global eksende birim vektör</td></tr>';
    });
    h+='</table>';
    h+='<p style="font-size:0.9em; color:#5a6270;">Çarpım terimlerinin köşegene oranı '
      +_rF(100*oran,1)+'%. '
      +(oran < 0.02
        ? 'Model eksenleri asal eksenlere pratik olarak çakışıktır; global köşegen değerler doğrudan yorumlanabilir.'
        : '<b>Model eksenleri asal eksenlerle çakışık değildir.</b> Dış bir yazılımın (Adams/CATIA) "aggregate mass" çıktısı ataleti asal eksende ve bir yönelim açısıyla basıyorsa, o sayılar buradaki global köşegenle DEĞİL, yukarıdaki asal atalet satırıyla karşılaştırılmalıdır.')
      +' Birleştirme paralel-eksen teoremiyle yapılır; nokta kütle işaretli bileşenlerin kendi ataleti sıfır alınır.</p>';
  }
  return h;
}

// §8.2 — rijitlik matrisi blokları (MN birimlerinde)
function _mntRepStep2Stiffness(R, C){
  var h='<h3>8.2 Adım 2 — Rijitlik matrisi</h3>';
  if(!C || !C.buildK){ return h+'<p>Rijitlik çekirdeği bulunamadı.</p>'; }
  var Ks=C.buildK(R.mounts, R.mp.cg, false);
  function blk(K,r0,c0,sc,dec){ var o=[]; for(var i=0;i<3;i++){ var row=[]; for(var j=0;j<3;j++){ row.push(_rF(K[r0+i][c0+j]/sc,dec)); } o.push(row.join(' & ')); } return o.join('\\\\ '); }
  h+='<p>Denklem (5.2) blokları statik rijitliklerle (öteleme bloğu MN/m, kuplaj MN/rad, dönme MN·m/rad):</p>';
  h+='$$ \\mathbf K_{tt}=\\begin{bmatrix}'+blk(Ks,0,0,1e6,3)+'\\end{bmatrix},\\;\\; '
    +'\\mathbf K_{t\\theta}=\\begin{bmatrix}'+blk(Ks,0,3,1e6,3)+'\\end{bmatrix},\\;\\; '
    +'\\mathbf K_{\\theta\\theta}=\\begin{bmatrix}'+blk(Ks,3,3,1e6,3)+'\\end{bmatrix} $$';
  h+='<p>\\( \\mathbf K_{tt} \\) yalın öteleme rijitliği (yayların toplamı), \\( \\mathbf K_{\\theta\\theta} \\) takoz kollarının dönme rijitliği, \\( \\mathbf K_{t\\theta} \\) ise <strong>öteleme–dönme kuplajıdır</strong>; ağırlık merkezinin takoz düzleminden ofseti ve yerleşim asimetrisi bu bloğu sıfırdan farklı kılar. Modal analizde aynı yapı dinamik rijitliklerle kurulur.</p>';
  return h;
}

// §8.3 — statik çökme
function _mntRepStep3Static(R, geom){
  var h='<h3>8.3 Adım 3 — Statik çökme (yerçekimi)</h3>';
  var stat=_mntRepFindCase(R,'Static');
  if(!stat || !stat.res){ return h+'<p>Statik durum çözülemedi.</p>'; }
  var res=stat.res, m=R.mp.m;
  h+='<p>\\( \\mathbf F=[0,0,-mg,0,0,0]^{\\mathsf T} \\), \\( mg='+_rF(m*9.81/1000,2)+' \\) kN ile (6.1) çözülür. Takoz düşey sehimleri (δ_z) ve şasiye ilettikleri düşey kuvvetler:</p>';
  h+='<table><caption>Tablo '+_rTbl()+' — Statik durum: takoz düşey sehimleri ve kuvvetleri (statik rijitlik)</caption>';
  h+='<tr><th>Takoz</th><th>δ_z [mm]</th><th>Düşey kuvvet f_z [kN]</th><th>Durum</th></tr>';
  var mounts=R.mounts;
  res.perMount.forEach(function(pm,i){
    var dz=pm.delta[2]*1000, fz=pm.f[2]/1000;
    var flag = pm.tension ? '<span style="color:var(--warn,#8a5a1e)">çekme ⟂</span>' : (pm.clamped ? '<span style="color:var(--warn,#8a5a1e)">durdurucu ▢</span>' : (pm.overLinear ? 'lineer-dışı' : '<span class="ok">✓</span>'));
    h+='<tr><td class="l">'+_rEsc(pm.name||('takoz '+(i+1)))+'</td>'
      +'<td>'+_rFs(dz,2)+'</td><td>'+_rF(fz,2)+'</td><td class="c">'+flag+'</td></tr>';
  });
  // ön/arka dağılım (X medyanına göre)
  var xs=mounts.map(function(mm){return mm.pos[0];}).slice().sort(function(a,b){return a-b;});
  var medX=xs.length?xs[Math.floor(xs.length/2)]:0;
  var front=0, rear=0;
  res.perMount.forEach(function(pm,i){ var fz=Math.abs(pm.f[2]); if(mounts[i].pos[0] < medX) front+=fz; else rear+=fz; });
  var tot=front+rear||1;
  h+='<tr class="sum"><td class="l">Toplam / dağılım</td>'
    +'<td colspan="2" class="c">ön (küçük X) %'+_rF(100*front/tot,1)+' · arka %'+_rF(100*rear/tot,1)+'</td>'
    +'<td class="c">Σf_z = '+_rF(res.sumF[2]/1000,2)+' kN '+(res.checks.sumFzOk?'✓':'✗')+'</td></tr>';
  h+='</table>';
  h+='<p>Σf_z değeri dış yükü (−mg) dengeler; ön/arka dağılım, ağırlık merkezinin takoz grubu içindeki boylamsal konumunu yansıtır. Çekme (lift-off) işaretli takozlar, o yük durumunda basıdan çıkıp gerilmeye geçtiğini gösterir.</p>';
  h+=_mntRepLoadBar(R);
  return h;
}

// Statik düşey takoz kuvvetleri — yatay bar grafiği (ölçekli SVG).
function _mntRepLoadBar(R){
  var stat=_mntRepFindCase(R,'Static'); if(!stat || !stat.res) return '';
  var rows=stat.res.perMount.map(function(pm){ return { name:pm.name, v:Math.abs(pm.f[2])/1000 }; });
  var max=Math.max.apply(null, rows.map(function(r){return r.v;})) || 1;
  var W=760, rowH=26, padL=140, padR=70, top=8, barMax=W-padL-padR;
  var H=top+rows.length*rowH+10;
  var svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
  rows.forEach(function(r,i){
    var y=top+i*rowH, bw=Math.max(2, r.v/max*barMax), cy=y+rowH/2;
    svg+='<text x="'+(padL-8)+'" y="'+(cy+4)+'" text-anchor="end" font-size="11" fill="#1b1e24">'+_rEsc(_mntRepShort(r.name,16))+'</text>';
    svg+='<rect x="'+padL+'" y="'+(y+4)+'" width="'+bw.toFixed(1)+'" height="'+(rowH-10)+'" fill="#24425f"/>';
    svg+='<text x="'+(padL+bw+6)+'" y="'+(cy+4)+'" font-size="11" fill="#3c4350" font-family="IBM Plex Mono,monospace">'+_rF(r.v,2)+' kN</text>';
  });
  svg+='</svg>';
  return '<figure>'+svg+'<figcaption><b>Şekil '+_rFig()+' —</b> Statik durumda takozların şasiye ilettiği düşey kuvvet (|f_z|) dağılımı.</figcaption></figure>';
}

// §8.4 — tork süperpozisyonu
function _mntRepStep4Torque(R){
  var fwd=_mntRepFindCase(R,'Forward Torque');
  var stat=_mntRepFindCase(R,'Static');
  var h='<h3>8.4 Adım 4 — Tahrik torku ve süperpozisyon</h3>';
  if(!fwd || !fwd.res || !stat || !stat.res){
    h+='<p>Bu modelde tork yük durumu tanımlı değil (kinematik girdiler — motor torku, stall oranı, vites — boş). Statik ve g-tabanlı yük durumları geçerlidir; tahrik torku reaksiyonu için Motor/Şanzıman/Transfer girdilerini doldurun.</p>';
    return h;
  }
  var Ts = fwd.loadCase && fwd.loadCase.T ? -fwd.loadCase.T[0] : NaN;
  h+='<p>Tahrik hattı torku, güç grubuna X ekseni etrafında reaksiyon momenti olarak etkir (6.3). İleri vites için şaft torku \\( T_s='+_rF(Ts,1)+' \\) N·m; bu reaksiyon tek başına çözülüp statik çözümle toplanır (lineer süperpozisyon):</p>';
  h+='<table><caption>Tablo '+_rTbl()+' — Süperpozisyon: İleri (Forward) yük durumu, düşey sehimler [mm]</caption>';
  h+='<tr><th>Takoz</th><th>Statik</th><th>+ Tork</th><th>= Toplam</th><th>Durum</th></tr>';
  fwd.res.perMount.forEach(function(pm,i){
    var tot=pm.delta[2]*1000;
    var s=stat.res.perMount[i]?stat.res.perMount[i].delta[2]*1000:NaN;
    var tq=tot-s;
    var flag = pm.tension ? '<span style="color:var(--warn,#8a5a1e)">çekme ⟂</span>' : (pm.clamped ? '<span style="color:var(--warn,#8a5a1e)">durdurucu ▢</span>' : (pm.overLinear ? 'lineer-dışı' : '<span class="ok">✓</span>'));
    h+='<tr><td class="l">'+_rEsc(pm.name||('takoz '+(i+1)))+'</td>'
      +'<td>'+_rFs(s,2)+'</td><td>'+_rFs(tq,2)+'</td><td>'+_rFs(tot,2)+'</td><td class="c">'+flag+'</td></tr>';
  });
  h+='</table>';
  // Geri tork (tanımlıysa) — aynı süperpozisyon.
  var rev=_mntRepFindCase(R,'Reverse Torque');
  if(rev && rev.res){
    var Tr = rev.loadCase && rev.loadCase.T ? -rev.loadCase.T[0] : NaN;
    h+='<p>Geri vites reaksiyonu \\( T_s='+_rFs(Tr,1)+' \\) N·m (yön ters) için aynı süperpozisyon:</p>';
    h+='<table><caption>Tablo '+_rTbl()+' — Süperpozisyon: Geri (Reverse) yük durumu, düşey sehimler [mm]</caption>';
    h+='<tr><th>Takoz</th><th>Statik</th><th>+ Tork</th><th>= Toplam</th><th>Durum</th></tr>';
    rev.res.perMount.forEach(function(pm,i){
      var tot=pm.delta[2]*1000, s=stat.res.perMount[i]?stat.res.perMount[i].delta[2]*1000:NaN, tq=tot-s;
      var flag = pm.tension ? '<span style="color:var(--warn,#8a5a1e)">çekme ⟂</span>' : (pm.clamped ? '<span style="color:var(--warn,#8a5a1e)">durdurucu ▢</span>' : (pm.overLinear ? 'lineer-dışı' : '<span class="ok">✓</span>'));
      h+='<tr><td class="l">'+_rEsc(pm.name||('takoz '+(i+1)))+'</td>'
        +'<td>'+_rFs(s,2)+'</td><td>'+_rFs(tq,2)+'</td><td>'+_rFs(tot,2)+'</td><td class="c">'+flag+'</td></tr>';
    });
    h+='</table>';
  }
  h+='<p>Tork reaksiyonu bir yandaki takozları bastırırken (çökme artar) karşı yanı boşaltır; büyük torkta karşı taraf takozları çekmeye (lift-off) geçebilir. Süperpozisyonun geçerliliği, modelin lineer kabulüne (±10 mm bandı) bağlıdır.</p>';
  return h;
}

// §8.5 — TÜM yük durumları (çökme matrisi) ───────────────────────────────────
function _mntRepLoadCaseMatrix(R){
  var mounts=R.mounts||[];
  var h='<h3>8.5 Adım 5 — Yük durumu özeti (düşey çökme δ_z)</h3>';
  h+='<p>Otomatik yük durumlarının tamamı (yerçekimi + g-tabanlı manevralar + tahrik torku) için <b>düşey</b> çökme özeti. Her hücre takozun δ_z\'si [mm]; <b>çekme / lift-off</b> amber çerçeveyle, <b>±10 mm aşımı</b> altı çizgiyle işaretlidir. Üç-eksen (δ_x/δ_y/δ_z) ayrıntı için §8.6.</p>';
  h+='<table><caption>Tablo '+_rTbl()+' — Yük durumu × takoz düşey sehim matrisi [mm]</caption>';
  h+='<tr><th>Yük durumu</th>';
  mounts.forEach(function(m){ h+='<th title="'+_rEsc(m.name)+'">'+_rEsc(_mntRepShort(m.name,8))+'</th>'; });
  h+='<th>Σf_z [kN]</th></tr>';
  (R.allCases||[]).forEach(function(rc){
    h+='<tr><td class="l">'+_rEsc(_mntRepCaseTr(rc.name))+'</td>';
    if(!rc.res){ h+='<td colspan="'+(mounts.length+1)+'" class="c">— (K tekil / çözülemedi)</td></tr>'; return; }
    rc.res.perMount.forEach(function(pm){
      var dz=pm.delta[2]*1000, st='';
      if(pm.tension) st+='outline:2px solid var(--warn); outline-offset:-2px; background:var(--warn-soft);';
      if(pm.overLinear) st+='text-decoration:underline;';
      h+='<td'+(st?' style="'+st+'"':'')+'>'+_rFs(dz,2)+'</td>';
    });
    h+='<td>'+_rF(rc.res.sumF[2]/1000,2)+(rc.res.checks.sumFzOk?' <span class="ok">✓</span>':' ✗')+'</td></tr>';
  });
  h+='</table>';
  h+='<p>Manevra durumları (tümsek/fren/viraj) takoz kuvvetlerinin dayanım zarfını, tork durumları ise tahrik reaksiyonunun etkisini verir. Çekme veya lineerlik aşımı işaretli hücreler, o durum için takoz seçimi / yerleşiminin gözden geçirilmesi gereğine işaret eder.</p>';
  return h;
}

// §8.7 — modal analiz (k_din + k_stat karşılaştırmalı + mod şekli matrisi)
function _mntRepStep5Modal(R, C){
  var h='<h3>8.7 Adım 7 — Modal analiz</h3>';
  var modes=R.modes;
  if(!modes || !modes.length){ return h+'<p>Modal analiz üretilemedi (K tekil / kütle geçersiz olabilir).</p>'; }
  var mstat=null;
  try { if(C && C.buildK && C.buildM6 && C.solveModal){ mstat=C.solveModal(C.buildK(R.mounts,R.mp.cg,false), C.buildM6(R.mp.m,R.mp.I_G), R.mounts, R.mp.cg); } } catch(e){}
  h+='<p>Sönümsüz özdeğer problemi (7.1) dinamik rijitlikle çözülür. Karşılaştırma için statik rijitlikle hesaplanan frekanslar da verilmiştir; oran, dinamik sertleşmeyi \\( \\sqrt{k_{\\text{din}}/k_{\\text{stat}}} \\) mertebesinde gösterir.</p>';
  // Sönümlü modal — mod başına ζ_r ve sönümlü frekans (varsa; §8.12 sönüm tablosu
  // üretilemediyse sütunlar hiç basılmaz, boş sütun gösterilmez).
  var zmod=R.modalDamping;
  var haveZ=!!(zmod && zmod.length===modes.length);
  if(haveZ){
    h+='<p>Takoz sönümü (§8.12) modal koordinatlara <em>izdüşürülerek</em> her mod için bir sönüm oranı verir; '
      +'sönümlü doğal frekans buradan gelir:</p>';
    h+='$$ \\zeta_r=\\frac{\\boldsymbol\\varphi_r^{\\mathsf T}\\mathbf C\\,\\boldsymbol\\varphi_r}'
      +'{2\\,\\omega_r\\,\\boldsymbol\\varphi_r^{\\mathsf T}\\mathbf M\\,\\boldsymbol\\varphi_r},\\qquad '
      +'f_{d,r}=f_r\\sqrt{1-\\zeta_r^{\\,2}} $$';
  }
  h+='<table><caption>Tablo '+_rTbl()+' — Rijit gövde modları: doğal frekanslar'+(haveZ?', mod başına sönüm':'')+' ve baskın mod şekli</caption>';
  h+='<tr><th>Mod</th><th>f (k_din) [Hz]</th><th>f (k_stat) [Hz]</th>'
    +(haveZ?'<th>ζ<sub>mod</sub></th><th>f<sub>d</sub> [Hz]</th>':'')
    +'<th>Baskın hareket (mod şekli)</th></tr>';
  var lbl=['u_x','u_y','u_z','θ_x','θ_y','θ_z'];
  modes.forEach(function(md,i){
    var shape='';
    if(md.phi){
      var idx=md.phi.map(function(v,k){return {k:k,a:Math.abs(v)};}).sort(function(a,b){return b.a-a.a;}).slice(0,2);
      shape=idx.map(function(o){ return lbl[o.k]+'='+_rFs(md.phi[o.k],2); }).join('; ');
    }
    var fs = (mstat && mstat[i]) ? _rF(mstat[i].f_Hz,3) : '—';
    var lb=_rEsc(md.label||'—')+(md.phi?' <span style="color:#5a6270">('+shape+')</span>':'');
    var zc='';
    if(haveZ){
      var zr=zmod[i]||{};
      // ζ_mod ≥ 1: aşırı sönümlü — salınım yok, f_d tanımsız. Sayı GİZLENMEZ,
      // işaretlenir (NaN basmak "hesaplanamadı" gibi okunur, oysa hesaplandı).
      zc='<td>'+(Number.isFinite(zr.zeta)?_rF(zr.zeta,4)+(zr.over?' <b title="aşırı sönümlü">≥1</b>':''):'—')+'</td>'
        +'<td>'+(Number.isFinite(zr.f_d)?_rF(zr.f_d,3):(zr.over?'salınım yok':'—'))+'</td>';
    }
    h+='<tr><td class="c">'+(i+1)+'</td>'
      +'<td>'+_rF(md.f_Hz,3)+'</td><td>'+fs+'</td>'+zc
      +'<td class="l">'+lb+'</td></tr>';
  });
  h+='</table>';
  if(haveZ){
    // Argmax/argmin ORİJİNAL dizide aranır — sonlu olmayan ζ'ler filtrelenip
    // indeks kaydırılırsa rapor yanlış mod numarası basar (kendi tablosuyla çelişir).
    var iMax=-1, iMin=-1;
    zmod.forEach(function(e,i){
      if(!Number.isFinite(e.zeta)) return;
      if(iMax<0 || e.zeta>zmod[iMax].zeta) iMax=i;
      if(iMin<0 || e.zeta<zmod[iMin].zeta) iMin=i;
    });
    var zIn=_mntRepZeta(R, {});
    if(iMax>=0){
      var zmax=zmod[iMax].zeta, zmin=zmod[iMin].zeta;
      // Nedensel açıklama VERİDEN türetilir: en sönümlü mod gerçekten dönme
      // baskın mı? Değilse kaldıraç gerekçesi yazılmaz (her modelde doğru değil).
      var phiMax=(modes[iMax] && modes[iMax].phi) || [0,0,0,0,0,0];
      var rotDom=Math.max(Math.abs(phiMax[3]),Math.abs(phiMax[4]),Math.abs(phiMax[5]))
               > Math.max(Math.abs(phiMax[0]),Math.abs(phiMax[1]),Math.abs(phiMax[2]));
      h+='<p style="font-size:0.9em; color:#5a6270;">Girilen tek sönüm oranı \\( \\zeta='+_rF(zIn,4)+' \\) '
        +'modlara <b>eşit dağılmaz</b>: burada '+_rF(zmin,4)+' – '+_rF(zmax,4)+' aralığında çıkar '
        +'(en sönümlü mod '+(iMax+1)+' — '+_rEsc(modes[iMax].label||'—')+'). Sebep, sönüm katsayılarının takoz başına '
        +'\\( c=2\\zeta\\sqrt{k_{\\text{din}}m_{\\text{pay}}} \\) ile türetilmesi ve her modun takozları farklı '
        +'oranlarda zorlamasıdır'
        +(rotDom ? ' — bu modelde en sönümlü mod <b>dönme baskın</b>dır: takozlar kaldıraç koluyla zorlanır ve daha çok söner.'
                 : ' — bu modelde en sönümlü mod öteleme baskındır; belirleyici olan, o modun en sert / en yüklü takozları ne ölçüde zorladığıdır.')
        +' Bağıntı hafif sönüm varsayımıyla (modlar arası kuplaj ihmal) yazılmıştır; orantılı sönümde tamdır.</p>';
      if(zmod.some(function(e){return e.over;})){
        h+='<div class="note warn"><span class="t">Uyarı · aşırı sönüm</span>Bir veya daha fazla modun '
          +'sönüm oranı kritik sönümü aşıyor ( \\( \\zeta_{\\text{mod}}\\ge 1 \\) ): o modda salınım yoktur, '
          +'sönümlü doğal frekans tanımsızdır. Girilen \\( \\zeta \\) elastomer takoz için tipik banda '
          +'(0,02–0,10) göre yüksek olabilir.</div>';
      }
    }
    if(R.kBasisTangent){
      h+='<p style="font-size:0.9em; color:#5a6270;">Nonlineer takoz bulunduğundan sönüm katsayıları da '
        +'modal frekansları üreten <b>dinamik tanjant</b> rijitlikten türetilmiştir (nominal \\( k_{\\text{din}} \\) '
        +'değil) — böylece \\( \\zeta_{\\text{mod}} \\) ile modal frekans aynı çalışma noktasına oturur.</p>';
    }
  }
  var warn=modes.some(function(m){return m.warning;});
  if(warn){
    h+='<div class="note warn"><span class="t">Uyarı · serbest mod</span>Bir veya daha fazla mod sıfıra yakın frekansta çıktı — yapılandırma kinematik olarak serbest olabilir (yetersiz takoz kısıtı). Takoz sayısını/yerleşimini gözden geçirin.</div>';
  }
  h+='<p>Mod şekilleri en büyük bileşene normalize edilmiştir; birden fazla bileşenin belirgin olması modların <em>kuplajlı</em> (saf olmayan) olduğunu gösterir. Aşağıdaki matris her modun altı serbestlik derecesindeki katılımını renk yoğunluğuyla gösterir (koyu = baskın).</p>';
  h+=_mntRepModeMatrix(modes);
  h+='<p>Rijit gövde modlarının hedef bandı, alttan süspansiyon modlarının üzerinde, üstten motorun rölanti ateşleme mertebesinin altında seçilir (Bölüm 7.2).</p>';
  return h;
}

// Mod şekli matrisi — modlar × 6 SD. Ortalanmış veri-çubuğu (merkezden sağa +,
// sola −). Çubuk hem ekranda hem yazdırmada okunur (print-color-adjust:exact ile
// arka plan basılır); metin koyu ink, daima okunaklı.
function _mntRepModeMatrix(modes){
  var lbl=['u_x','u_y','u_z','θ_x','θ_y','θ_z'];
  var h='<table class="modeshape"><caption>Tablo '+_rTbl()+' — Mod şekilleri (en büyük bileşene normalize; çubuk = merkezden katılım, yön = işaret)</caption>';
  h+='<tr><th>Mod</th><th>f [Hz]</th>';
  lbl.forEach(function(l){ h+='<th>'+l+'</th>'; });
  h+='</tr>';
  modes.forEach(function(md,i){
    h+='<tr><td class="c">'+(i+1)+'</td><td>'+_rF(md.f_Hz,2)+'</td>';
    (md.phi||[0,0,0,0,0,0]).forEach(function(v){
      var val=Math.max(-1, Math.min(1, Number(v)||0));
      var L, Rr;
      if(val>=0){ L=50; Rr=50+val*47; } else { L=50+val*47; Rr=50; }
      var bar='background:linear-gradient(90deg, transparent '+L.toFixed(1)+'%, rgba(36,66,95,0.20) '+L.toFixed(1)+'%, rgba(36,66,95,0.20) '+Rr.toFixed(1)+'%, transparent '+Rr.toFixed(1)+'%);';
      h+='<td style="'+bar+'">'+_rFs(v,2)+'</td>';
    });
    h+='</tr>';
  });
  h+='</table>';
  return h;
}

// §8.8 — Frekans yerleşimi + iletilebilirlik (opsiyonel; motor devri + silindir + sönüm girdisi)
// Kriter 1: Roll modu (en yüksek rijit gövde modu) < %50 ateşleme frekansı.
// Kriter 2: Rölantide iletilebilirlik (transmissibility) < %50 (en kötü mod belirleyici).
//
// BU İKİ KRİTERİN KAYNAĞI (uydurma eşik değil, müşteri hedef kriteri):
//   "MSB Tank Taşıyıcı Araç — Motor Takoz İncelemesi" (Güven YAVUZ, 11.03.2019),
//   "Hedef Kriterleri" sayfası, birebir:
//     • "PowerPack Roll Mode; Motor Ateşleme frekansının %50'sinden az olmalıdır."
//     • "Motor Idle'da Transmissibility %50'den küçük olmalıdır."
//     • "Her bir vites için Mount kuvvetleri kontrol edilmelidir."
//     • "Maks. Tork, 3.5 Düşey, 1g yanal ve 1g boyuna yükleme koşulları
//        kontrol edilmelidir."   → cp-mount.js MNT_AUTO_CASES'in çekirdeği budur.
//   Aynı doküman ölçüm zincirini de veriyor: prototip araçta takozun aktif/pasif
//   tarafından 20 kHz örnekleme, 2 kHz alçak geçiren filtre, iletilebilirlik =
//   pasif/aktif ivme oranı; motor 3. mertebe (6 silindir, 4 zamanlı), rölanti
//   700 d/dk → f_ateş = 35 Hz. §8.8'in f_ateş=(N/60)·(z/2) bağıntısı bununla
//   birebir tutarlıdır (700/60·3 = 35 Hz).
function _mntRepFreqPlacement(R, opts){
  opts=opts||{};
  var _eng=_mntRepEngine(R, opts);        // TEK kaynak: Motor bileşeni
  var rpm=_eng.idleRpm, z=_eng.cylinders;
  var zeta=_mntRepZeta(R, opts);          // TEK kaynak: Çözücü (R.zeta)
  var modes=R.modes||[];
  if(!(rpm>0 && z>0) || !modes.length) return '';   // girdi yoksa bölümü atla
  var core=_rMountCore();
  // 4 zamanlı motorda temel ateşleme mertebesi z/2 → f_ateş = (N/60)·(z/2).
  var fFire=(rpm/60)*(z/2);
  var fRoll=modes[modes.length-1].f_Hz;             // en yüksek rijit gövde modu (mode 6 = roll)

  // ── Kriter 1: Roll modu < %50 ateşleme frekansı  (⟺ f_ateş > 2·f_roll) ──
  var lim1=0.5*fFire, ok1=(fRoll<lim1), r1=(fRoll>0?fFire/fRoll:0);

  // ── Kriter 2: Rölanti iletilebilirliği — TABAN: DÜŞEY (bounce) frekansı ──
  // Tahrik düşeydir; SDOF bağıntısına konacak f_nat da güç grubunun düşey
  // kütle-yay frekansı olmalıdır (bkz. çekirdek bounceFrequency yorumu).
  // Modal frekanslar bu bağıntının tabanı DEĞİLDİR — aşağıda yalnız bağlam
  // (tanı) olarak gösterilir.
  var iso=_mntRepIsolation(R, opts);
  var fB=iso.fBounce, Tiso=iso.T, ok2=(Tiso<0.5);
  var Tstr=isFinite(Tiso)?(_rF(Tiso*100,1)+'%'):'∞';
  // Tanı: modal bant ve bounce frekansının bant içindeki yeri.
  var fLo=modes[0].f_Hz, fHi=modes[modes.length-1].f_Hz;

  var h='<h3>8.8 Adım 8 — Frekans yerleşimi ve iletilebilirlik</h3>';
  h+='<p>Dört zamanlı motorun rölanti ateşleme frekansı \\( f_{\\text{ateş}}=\\dfrac{N}{60}\\cdot\\dfrac{z}{2} \\); '
    +'girilen değerlerle \\( N='+_rF(rpm,0)+' \\) d/dk, \\( z='+_rF(z,0)+' \\) silindir → '
    +'\\( f_{\\text{ateş}}='+_rF(fFire,1)+' \\) Hz; sönüm oranı \\( \\zeta='+_rF(zeta,4)+' \\) '
    +'(Çözücü\'de tüm montaj için tek değer olarak girilir — bkz. §8.12).</p>';

  // Kriter 1 rozeti
  var cls1=ok1?'check':'warn';
  h+='<div class="note '+cls1+'"><span class="t">'+(ok1?'Uygun':'Dikkat')+' · Kriter 1 — Roll modu &lt; %50 ateşleme</span>';
  h+='En yüksek rijit gövde (roll) modu <b>'+_rF(fRoll,2)+' Hz</b>, sınır \\( 0{,}5\\,f_{\\text{ateş}}='+_rF(lim1,1)+' \\) Hz\'in ';
  h+= ok1 ? '<b>altındadır</b> (f_ateş/f_roll = '+_rF(r1,2)+' ≥ 2) — ateşleme mertebesinden izole.'
         : '<b>ÜZERİNDEDİR</b> (f_ateş/f_roll = '+_rF(r1,2)+' &lt; 2) — %50 kriterini karşılamıyor; takoz dinamik rijitliklerini düşürmek (mod bandını aşağı taşımak) önerilir.';
  h+='</div>';

  // İzolasyon tabanı — düşey frekans, modal bant içindeki yeri
  h+='<p>İletilebilirlik <strong>düşey (bounce) doğal frekansı</strong> üzerinden değerlendirilir; '
    +'tahrik düşey olduğundan tek-serbestlik bağıntısının tabanı budur:</p>';
  h+='$$ f_{\\text{bounce}}=\\frac{1}{2\\pi}\\sqrt{\\frac{\\sum k_{z,\\text{din}}}{m}}='
    +_rF(fB,2)+'\\ \\text{Hz},\\qquad r=\\frac{f_{\\text{ateş}}}{f_{\\text{bounce}}}='+_rF(iso.r,2)+' $$';
  h+='<p style="font-size:0.9em; color:#5a6270;">Rijit gövde modları '+_rF(fLo,2)+'–'+_rF(fHi,2)+' Hz bandındadır. '
    +'Bounce modu simetrik yerleşimde tam ayrışır; asimetride pitch ile kuplajlanıp iki moda bölünür ve '
    +'\\( f_{\\text{bounce}} \\) aralarına düşer — bu modelde '+(fB>fLo&&fB<fHi?'öyledir':'bandın dışındadır, yerleşim gözden geçirilmelidir')+'.</p>';

  // Kriter 2 rozeti
  var cls2=ok2?'check':'warn';
  h+='<div class="note '+cls2+'"><span class="t">'+(ok2?'Uygun':'Dikkat')+' · Kriter 2 — Rölanti iletilebilirliği &lt; %50</span>';
  h+='\\( T=\\sqrt{\\tfrac{1+(2\\zeta r)^2}{(1-r^2)^2+(2\\zeta r)^2}} \\) = <b>'+Tstr+'</b> '
    +'(sönümsüz karşılığı '+(isFinite(iso.T0)?_rF(iso.T0*100,1)+'%':'∞')+') ';
  h+= ok2 ? '&lt; %50 — güç grubu rölantide izole bölgede çalışır.'
         : '&ge; %50 — izolasyon yetersiz; düşey rijitliği düşürmek (f_bounce\'u aşağı taşımak) veya sönümü artırmak gerekir.';
  h+='</div>';

  h+='<p style="font-size:0.9em; color:#5a6270;">Not: bu bir <b>tek-serbestlik kestirimidir</b> — güç grubunu düşey yönde tek kütle-yay olarak alır. '
    +'İzolasyon bölgesinde (r &gt; √2) tam çok-serbestlikli frekans yanıtına yakın sonuç verir; rezonans civarında kullanılmamalıdır. '
    +'Değerlendirme temel ateşleme mertebesine göredir; gerçek rölanti devri, baskın tahrik mertebeleri ve sönüm ölçümüyle teyit edilmelidir.</p>';
  return h;
}

// Bir yük durumu sonucunda en yüksek bileşke takoz kuvveti (kN) ve takoz adı.
function _mntRepMaxForce(res){
  var best={v:-1, name:'—'};
  (res && res.perMount || []).forEach(function(pm){
    var fm=Math.sqrt(pm.f[0]*pm.f[0]+pm.f[1]*pm.f[1]+pm.f[2]*pm.f[2])/1000;
    if(fm>best.v){ best.v=fm; best.name=pm.name; }
  });
  return best;
}
// Yük durumu notu (durdurucu / çekme / normal).
function _mntRepCaseNote(res){
  if(!res) return '—';
  if(res.checks.clampCount>0) return '<span style="color:var(--warn,#8a5a1e)">durdurucu ×'+res.checks.clampCount+'</span>';
  if(res.checks.tensionCount>0) return '<span style="color:var(--warn,#8a5a1e)">çekme ×'+res.checks.tensionCount+'</span>';
  return '<span class="ok">✓</span>';
}

// §8.9 — Kriter 3: her vites için takoz kuvvetleri (tork reaksiyonu altında).
function _mntRepGearForces(R){
  var rows=R.gearCases||[];
  if(!rows.length) return '';   // tork girilmemişse bölümü atla
  var h='<h3>8.9 Kriter 3 — Vites bazında takoz kuvvetleri</h3>';
  h+='<p>Tasarım kriteri her vites için takoz kuvvetlerinin kontrolünü ister. Kütle ve rijitlik sabit, yalnız şaft torku \\(T_{\\text{shaft}}\\) vites oranıyla ölçeklenir; en yüksek redüksiyonlu <b>1. vites en yüksek tork</b> ürettiğinden ileri vitesler için <b>bağlayıcı</b> durumdur. Değerler ±15 mm durdurucu modeliyle (bkz. §9) çözülür.</p>';
  h+='<table style="width:100%; border-collapse:collapse; font-size:var(--fs-body); margin:8px 0;">';
  h+='<thead><tr style="border-bottom:1.5px solid var(--line,#c9cdd3);">'
    +'<th style="text-align:left; padding:4px 6px;">Vites</th>'
    +'<th style="text-align:right; padding:4px 6px;">Oran</th>'
    +'<th style="text-align:right; padding:4px 6px;">T<sub>shaft</sub> [N·m]</th>'
    +'<th style="text-align:right; padding:4px 6px;">Maks |F| [kN]</th>'
    +'<th style="text-align:left; padding:4px 6px;">Takoz</th>'
    +'<th style="text-align:center; padding:4px 6px;">Durum</th></tr></thead><tbody>';
  rows.forEach(function(rc){
    var lc=rc.loadCase||{}, res=rc.res, mf=_mntRepMaxForce(res);
    h+='<tr style="border-bottom:1px solid var(--line-soft,#e4e6e9);">'
      +'<td style="padding:3px 6px;">'+_rEsc(lc.gearLabel||rc.name)+'</td>'
      +'<td style="text-align:right; padding:3px 6px; font-family:var(--mono,monospace);">'+_rF(lc.ratio,2)+'</td>'
      +'<td style="text-align:right; padding:3px 6px; font-family:var(--mono,monospace);">'+(res?_rF(lc.Tshaft,0):'—')+'</td>'
      +'<td style="text-align:right; padding:3px 6px; font-family:var(--mono,monospace);">'+(res?_rF(mf.v,2):'—')+'</td>'
      +'<td style="padding:3px 6px;">'+(res?_rEsc(mf.name):'çözülemedi')+'</td>'
      +'<td style="text-align:center; padding:3px 6px;">'+_mntRepCaseNote(res)+'</td></tr>';
  });
  h+='</tbody></table>';
  h+='<p style="font-size:0.9em; color:#5a6270;">Maks |F| = takoza gelen üç-eksen bileşke kuvvetinin en büyüğü (dayanım/cıvata tasarımı için). Vites yükseldikçe tork ve dolayısıyla kuvvet azalır.</p>';
  return h;
}

// §8.10 — Kriter 4: tasarım yük koşulları (maks tork, 3.5g düşey, 1g yanal, 1g boyuna).
function _mntRepDesignLoads(R){
  var design=R.designCases||[], gear=R.gearCases||[];
  var maxTq=gear.length?gear[0]:null;   // 1. vites = maks tork
  if(!design.length && !maxTq) return '';
  var h='<h3>8.10 Kriter 4 — Tasarım yük koşulları</h3>';
  h+='<p>Tasarım kriterinin dört zorunlu yük koşulunda maksimum takoz kuvveti (dayanım tasarımı için). 1g yanal koşul, kalibreli 0,6g viraj manevrasından ayrı bir dayanım zarfıdır.</p>';
  h+='<table style="width:100%; border-collapse:collapse; font-size:var(--fs-body); margin:8px 0;">';
  h+='<thead><tr style="border-bottom:1.5px solid var(--line,#c9cdd3);">'
    +'<th style="text-align:left; padding:4px 6px;">Koşul</th>'
    +'<th style="text-align:right; padding:4px 6px;">Maks |F| [kN]</th>'
    +'<th style="text-align:left; padding:4px 6px;">Takoz</th>'
    +'<th style="text-align:center; padding:4px 6px;">Durum</th></tr></thead><tbody>';
  function line(label, res){
    var mf=_mntRepMaxForce(res);
    h+='<tr style="border-bottom:1px solid var(--line-soft,#e4e6e9);">'
      +'<td style="padding:3px 6px;">'+label+'</td>'
      +'<td style="text-align:right; padding:3px 6px; font-family:var(--mono,monospace);">'+(res?_rF(mf.v,2):'—')+'</td>'
      +'<td style="padding:3px 6px;">'+(res?_rEsc(mf.name):'—')+'</td>'
      +'<td style="text-align:center; padding:3px 6px;">'+_mntRepCaseNote(res)+'</td></tr>';
  }
  if(maxTq && maxTq.res) line('Maks. tork <span style="color:#5a6270;">(1. vites, T<sub>shaft</sub> '+_rF(maxTq.loadCase.Tshaft,0)+' N·m)</span>', maxTq.res);
  design.forEach(function(rc){ line(_rEsc(rc.name), rc.res); });
  h+='</tbody></table>';
  h+='<p style="font-size:0.9em; color:#5a6270;">Not: 3,5g düşey ve büyük tork koşullarında ±15 mm durdurucu devreye girebilir (Durum sütunu). Maks |F| durdurucudaki temas kuvvetini de içerir.</p>';
  return h;
}

// §8.12 — Takoz sönüm katsayıları. TEK sönüm oranından (Çözücü, şirket kabulü)
// takoz başına türetilen viskoz sönüm. Referans: ASR-SR-116 Tablo 11 aynı
// bağıntıyla üretilmiştir.
function _mntRepDamping(R){
  var d=R.damping;
  if(!d || !d.length) return '';          // statik durum çözülemedi → tablo basma
  var zeta=_mntRepZeta(R, {});
  var h='<h3>8.12 Takoz sönüm katsayıları</h3>';
  h+='<p>Sönüm oranı \\( \\zeta \\) montaj genelinde <b>tek bir şirket kabulü</b> olarak girilir (Çözücü paneli); '
    +'burada \\( \\zeta='+_rF(zeta,4)+' \\). Her takozun eksen başına viskoz sönüm katsayısı bu orandan, '
    +'takozun <b>dinamik rijitliği</b> ve üzerine düşen <b>statik yük payı</b> ile türetilir:</p>';
  h+='$$ c_{\\text{eksen}} = 2\\,\\zeta\\,\\sqrt{k_{\\text{din,eksen}}\\; m_{\\text{pay}}} $$';
  h+='<table><caption>Tablo '+_rTbl()+' — Takoz başına yük payı ve viskoz sönüm katsayıları</caption>';
  h+='<tr><th>Takoz</th><th>m<sub>pay</sub> [kg]</th><th>c<sub>x</sub> [N·s/mm]</th><th>c<sub>y</sub> [N·s/mm]</th><th>c<sub>z</sub> [N·s/mm]</th><th>ζ</th></tr>';
  var sum=0;
  d.forEach(function(e,i){
    sum += e.mShare||0;
    h+='<tr><td class="l">'+_rEsc(e.name||('takoz '+(i+1)))+'</td>'
      +'<td>'+_rF(e.mShare,2)+'</td>'
      +'<td>'+_rF(e.c[0]/1000,3)+'</td><td>'+_rF(e.c[1]/1000,3)+'</td><td>'+_rF(e.c[2]/1000,3)+'</td>'
      +'<td>'+_rF(e.zeta,3)+'</td></tr>';
  });
  h+='<tr class="sum"><td class="l">Toplam yük payı</td><td>'+_rF(sum,2)+'</td>'
    +'<td colspan="3" class="c">güç grubu toplam kütlesi '+_rF(R.mp.m,2)+' kg</td><td class="c">—</td></tr>';
  h+='</table>';
  h+='<p style="font-size:0.9em; color:#5a6270;">Yük payı statik (1g) çözümden alınır: \\( m_{\\text{pay}}=|f_z|/g \\); toplamı güç grubunun kütlesini verir. '
    +'Daha sert ve/veya daha çok yük taşıyan takoz daha çok söner. '
    +'<b>Nereye girer:</b> doğal frekanslar sönümsüz özdeğer probleminden hesaplanır (§8.7). Bu katsayılar '
    +'\\( \\mathbf C=\\sum_i \\mathbf A_i^{\\mathsf T}\\mathrm{diag}(c_i)\\mathbf A_i \\) matrisine toplanır ve '
    +'yalnız iki yerde KULLANILIR: mod başına sönüm oranı \\( \\zeta_{\\text{mod}} \\) (§8.7 tablosu) ve tam '
    +'frekans yanıtı (§8.13). §8.8 ise C matrisini değil, girilen skaler \\( \\zeta \\)\'yı kullanır; §8.14 '
    +'modal enerji hesabı sönümü hiç içermez — oradaki \\( \\zeta_{\\text{mod}} \\) sütunu §8.7\'den yalnızca '
    +'gösterim amaçlı taşınır.</p>';
  return h;
}

// §8.13 — Frekans yanıtı (tam çok-serbestlikli iletilebilirlik eğrisi).
// §8.8'deki SDOF kestiriminin GERÇEĞİ: 6 SD sönümlü sistemin harmonik kuvvet
// iletilebilirliği, düşey tahrik/düşey çıktı. Referans: ASR-SR-116 Şekil 9.
var _FRF_TMIN = 0.01, _FRF_TMAX = 1000, _FRF_FMIN = 0.1, _FRF_FMAX = 100;

// Log-log eğri grafiği (SVG). pts = { f, T, T0 }. fFire varsa dikey imleç.
function _mntRepFRFChart(pts, fFire){
  var W=760, H=400, L=64, Rr=18, Tp=16, Bt=44;
  var pw=W-L-Rr, ph=H-Tp-Bt;
  var lf0=Math.log10(_FRF_FMIN), lf1=Math.log10(_FRF_FMAX);
  var lt0=Math.log10(_FRF_TMIN), lt1=Math.log10(_FRF_TMAX);
  var px=function(f){ return L + (Math.log10(f)-lf0)/(lf1-lf0)*pw; };
  var py=function(t){ var v=Math.min(_FRF_TMAX, Math.max(_FRF_TMIN, t));
                      return Tp + (lt1-Math.log10(v))/(lt1-lt0)*ph; };
  var s='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" font-family="inherit">';
  // ── ızgara: ondalık ana çizgiler + 2..9 ara çizgiler ──
  var d, k;
  for(d=lf0; d<=lf1; d++){
    for(k=1;k<10;k++){
      var fv=k*Math.pow(10,d); if(fv<_FRF_FMIN||fv>_FRF_FMAX) continue;
      var X=px(fv);
      s+='<line x1="'+X.toFixed(1)+'" y1="'+Tp+'" x2="'+X.toFixed(1)+'" y2="'+(Tp+ph)+'" stroke="#c9cdd3" stroke-width="'+(k===1?1:0.4)+'" opacity="'+(k===1?0.9:0.45)+'"/>';
    }
  }
  for(d=lt0; d<=lt1; d++){
    for(k=1;k<10;k++){
      var tv=k*Math.pow(10,d); if(tv<_FRF_TMIN||tv>_FRF_TMAX) continue;
      var Y=py(tv);
      s+='<line x1="'+L+'" y1="'+Y.toFixed(1)+'" x2="'+(L+pw)+'" y2="'+Y.toFixed(1)+'" stroke="#c9cdd3" stroke-width="'+(k===1?1:0.4)+'" opacity="'+(k===1?0.9:0.45)+'"/>';
    }
  }
  // ── eksen etiketleri ──
  for(d=lf0; d<=lf1; d++){
    var fl=Math.pow(10,d);
    s+='<text x="'+px(fl).toFixed(1)+'" y="'+(Tp+ph+16)+'" text-anchor="middle" font-size="11" fill="#3c4350">'+_rEsc(_rF(fl,fl<1?1:0))+'</text>';
  }
  for(d=lt0; d<=lt1; d++){
    var tl=Math.pow(10,d);
    s+='<text x="'+(L-7)+'" y="'+(py(tl)+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="#3c4350">'+_rEsc(tl<1?_rF(tl,2):_rF(tl,0))+'</text>';
  }
  s+='<text x="'+(L+pw/2)+'" y="'+(H-8)+'" text-anchor="middle" font-size="12" fill="#1b1e24">Frekans [Hz]</text>';
  s+='<text x="14" y="'+(Tp+ph/2)+'" text-anchor="middle" font-size="12" fill="#1b1e24" transform="rotate(-90 14 '+(Tp+ph/2)+')">İletilebilirlik T</text>';
  // ── T = 1 referansı (izolasyon sınırı) ──
  s+='<line x1="'+L+'" y1="'+py(1).toFixed(1)+'" x2="'+(L+pw)+'" y2="'+py(1).toFixed(1)+'" stroke="#8a5a1e" stroke-width="1.4" stroke-dasharray="5 4"/>';
  s+='<text x="'+(L+6)+'" y="'+(py(1)-5).toFixed(1)+'" font-size="10.5" fill="#8a5a1e">T = 1 (izolasyon yok)</text>';
  // ── eğriler ──
  var path=function(arr){
    var p='', started=false;
    for(var i=0;i<pts.f.length;i++){
      var v=arr[i];
      if(!Number.isFinite(v)||v<=0){ started=false; continue; }
      p += (started?'L':'M') + px(pts.f[i]).toFixed(1) + ' ' + py(v).toFixed(1) + ' ';
      started=true;
    }
    return p;
  };
  s+='<path d="'+path(pts.T0)+'" fill="none" stroke="#24425f" stroke-width="1.4" stroke-dasharray="6 4" opacity="0.85"/>';
  s+='<path d="'+path(pts.T)+'" fill="none" stroke="#b02a2a" stroke-width="2.1"/>';
  // ── f_ateş imleci ──
  if(Number.isFinite(fFire) && fFire>=_FRF_FMIN && fFire<=_FRF_FMAX){
    var XF=px(fFire);
    s+='<line x1="'+XF.toFixed(1)+'" y1="'+Tp+'" x2="'+XF.toFixed(1)+'" y2="'+(Tp+ph)+'" stroke="#1b7f4b" stroke-width="1.6" stroke-dasharray="4 3"/>';
    s+='<text x="'+(XF+5).toFixed(1)+'" y="'+(Tp+13)+'" font-size="10.5" fill="#1b7f4b">f_ateş = '+_rEsc(_rF(fFire,1))+' Hz</text>';
  }
  // ── lejant ──
  s+='<g transform="translate('+(L+pw-190)+',' +(Tp+ph-46)+')">';
  s+='<rect x="-8" y="-13" width="196" height="42" fill="#ffffff" opacity="0.82" stroke="#c9cdd3" stroke-width="0.6"/>';
  s+='<line x1="0" y1="0" x2="26" y2="0" stroke="#b02a2a" stroke-width="2.1"/><text x="32" y="4" font-size="10.5" fill="#1b1e24">sönümlü</text>';
  s+='<line x1="0" y1="18" x2="26" y2="18" stroke="#24425f" stroke-width="1.4" stroke-dasharray="6 4"/><text x="32" y="22" font-size="10.5" fill="#1b1e24">sönümsüz</text>';
  s+='</g>';
  s+='</svg>';
  return s;
}

function _mntRepFRF(R, opts){
  var C=_rMountCore();
  if(!C || !C.frequencyResponse || !R.mounts || !R.mounts.length || !R.damping) return '';
  var M6=C.buildM6(R.mp.m, R.mp.I_G);
  var pts=C.frequencyResponse(R.mounts, R.mp.cg, M6, R.damping,
    { fMin:_FRF_FMIN, fMax:_FRF_FMAX, nPts:260, dir:2 });
  if(!pts) return '';
  var iso=_mntRepIsolation(R, opts);
  var fFire=iso.fFire;

  var h='<h3>8.13 Frekans yanıtı — tam çok serbestlikli iletilebilirlik</h3>';
  h+='<p>§8.8\'deki değerlendirme tek-serbestlik <em>kestirimidir</em>. Burada aynı büyüklük '
    +'<strong>6 serbestlik dereceli sönümlü sistemin</strong> harmonik yanıtından doğrudan hesaplanır — yaklaşım yok:</p>';
  h+='$$ \\left[\\mathbf K-\\omega^2\\mathbf M+i\\omega\\mathbf C\\right]\\mathbf Q=\\mathbf F_0,\\qquad '
    +'\\mathbf C=\\sum_i \\mathbf A_i^{\\mathsf T}\\,\\mathrm{diag}(c_i)\\,\\mathbf A_i,\\qquad '
    +'T(f)=\\frac{\\left|\\sum_i (k_i+i\\omega c_i)\\,\\delta_i\\right|}{|\\mathbf F_0|} $$';
  h+='<p>Tahrik ve çıktı <b>düşey</b>dir (birim harmonik kuvvet, birleşik ağırlık merkezinde). '
    +'Sönüm matrisi rijitlikle aynı kinematikten kurulur; takoz sönüm katsayıları §8.12\'den gelir.</p>';
  h+='<figure>'+_mntRepFRFChart(pts, fFire)
    +'<figcaption><b>Şekil '+_rFig()+' —</b> Düşey kuvvet iletilebilirliği (log–log). '
    +'Kesintisiz eğri sönümlü (ζ = '+_rF(iso.zeta,3)+'), kesikli eğri sönümsüz sistemdir. '
    +'Tepeler düşey harekete katılan rijit gövde modlarındadır; T = 1 çizgisinin altı izolasyon bölgesidir.'
    +'</figcaption></figure>';

  // ── SDOF kestirimi ile karşılaştırma: kestirim ne kadar iyi? ──
  if(Number.isFinite(fFire)){
    var Td=C.frfAt(R.mounts, R.mp.cg, M6, R.damping, fFire, 2);
    var Tu=C.frfAt(R.mounts, R.mp.cg, M6, null,       fFire, 2);
    h+='<table><caption>Tablo '+_rTbl()+' — Ateşleme frekansında iletilebilirlik: tam çözüm ve tek-serbestlik kestirimi</caption>';
    h+='<tr><th>Yöntem</th><th>Sönümlü</th><th>Sönümsüz</th></tr>';
    h+='<tr><td class="l">Tam frekans yanıtı (6 SD)</td><td>'+_rF(Td*100,1)+'%</td><td>'+_rF(Tu*100,1)+'%</td></tr>';
    h+='<tr><td class="l">Tek-serbestlik kestirimi (§8.8)</td><td>'+(isFinite(iso.T)?_rF(iso.T*100,1)+'%':'—')+'</td><td>'+(isFinite(iso.T0)?_rF(iso.T0*100,1)+'%':'—')+'</td></tr>';
    var dev=(Number.isFinite(Td)&&Td>0)?Math.abs(iso.T-Td)/Td*100:NaN;
    h+='</table>';
    h+='<p style="font-size:0.9em; color:#5a6270;">Fark '+(Number.isFinite(dev)?_rF(dev,1)+'%':'—')
      +'. İzolasyon bölgesinde (r &gt; √2) tek-serbestlik kestirimi tam çözüme çok yakındır; '
      +'bu, §8.8 değerlendirmesinin bu model için geçerli olduğunu doğrular. Rezonans civarında '
      +'ikisi ayrışır — orada yalnız bu bölümün eğrisi kullanılmalıdır.</p>';
  }
  return h;
}

// §8.14 — Modal enerji: genelleştirilmiş kütle/rijitlik, kinetik enerji ve
// enerjinin gövdeler + serbestlik dereceleri üzerindeki dağılımı.
// Referans: ASR-SR-116 Tablo 12–17 (Adams "Modal Energy" çıktısı) aynı yapıdadır.
//
// NORMALİZASYON UYARISI: mod şekli en büyük bileşene normalize edilir (max|φ|=1),
// dolayısıyla m_gen, k_gen ve KE'nin MUTLAK büyüklüğü keyfidir — ölçek seçimine
// bağlıdır. Fiziksel bilgi taşıyan iki büyüklük vardır ve ikisi de normalizasyondan
// bağımsızdır: (1) k_gen/m_gen = ω² oranı, (2) enerjinin yüzde dağılımı.
// Rapor bu ikisini öne çıkarır; mutlak değerler yalnızca izlenebilirlik için verilir.
function _mntRepModalEnergy(R){
  var me=R.modalEnergy, modes=R.modes;
  if(!me || !me.length || !modes || modes.length!==me.length) return '';
  var zmod=R.modalDamping, haveZ=!!(zmod && zmod.length===me.length);
  var h='<h3>8.14 Modal enerji dağılımı</h3>';
  h+='<p>Her mod için genelleştirilmiş kütle ve rijitlik, mod şeklinin kütle ve rijitlik '
    +'matrisleriyle iç çarpımından gelir; kinetik enerji bunlardan türer:</p>';
  h+='$$ m_r=\\boldsymbol\\varphi_r^{\\mathsf T}\\mathbf M\\,\\boldsymbol\\varphi_r,\\qquad '
    +'k_r=\\boldsymbol\\varphi_r^{\\mathsf T}\\mathbf K\\,\\boldsymbol\\varphi_r,\\qquad '
    +'T_r=\\tfrac12\\,\\omega_r^2\\,m_r,\\qquad \\frac{k_r}{m_r}=\\omega_r^2 $$';
  h+='<p>Son eşitlik <b>bağımsız bir doğrulamadır</b>: özdeğer çözümü doğruysa \\( \\sqrt{k_r/m_r}/2\\pi \\) '
    +'tablodaki frekansı birebir vermelidir. Mod şekilleri en büyük bileşene normalize edildiğinden '
    +'\\( m_r,\\,k_r,\\,T_r \\) değerlerinin <em>mutlak</em> büyüklüğü ölçek seçimine bağlıdır; '
    +'fiziksel yorum <b>oranlarda ve yüzde dağılımdadır</b>. Birimler: φ öteleme [m], dönme [rad] '
    +'→ \\( m_r \\) [kg·m²], \\( k_r \\) ve \\( T_r \\) [J].</p>';

  h+='<table><caption>Tablo '+_rTbl()+' — Mod başına genelleştirilmiş kütle, rijitlik ve kinetik enerji</caption>';
  h+='<tr><th>Mod</th><th>f [Hz]</th><th>m<sub>r</sub> [kg·m²]</th><th>k<sub>r</sub> [J]</th>'
    +'<th>√(k<sub>r</sub>/m<sub>r</sub>)/2π [Hz]</th><th>T<sub>r</sub> [J]</th>'
    +(haveZ?'<th>ζ<sub>mod</sub></th>':'')+'<th>Baskın hareket</th></tr>';
  // Kapı yalnız DEĞERLENDİRİLEBİLİR modlarda anlamlıdır. Serbest modda (f≈0)
  // hem f hem k_r sayısal olarak sıfırdır: bağıl fark 0/0 mertebesindedir ve
  // rastgele 1'e çıkar. Böyle bir modu kapıya sokmak, "farklı matrisler
  // kullanılıyor olabilir" diye YANLIŞ bir teşhis bastırır — oysa sebep
  // yetersiz takoz kısıtıdır ve §8.7 bunu zaten doğru söyler.
  var F_MIN=1e-6, maxErr=0, nEval=0, nSkip=0;
  me.forEach(function(e,i){
    var fChk=(e.mGen>0)?Math.sqrt(Math.max(e.kGen,0)/e.mGen)/(2*Math.PI):NaN;
    if(Number.isFinite(fChk) && modes[i].f_Hz>F_MIN){
      maxErr=Math.max(maxErr, Math.abs(fChk-modes[i].f_Hz)/modes[i].f_Hz); nEval++;
    } else nSkip++;
    h+='<tr><td class="c">'+(i+1)+'</td><td>'+_rF(modes[i].f_Hz,3)+'</td>'
      +'<td>'+_rE(e.mGen,3)+'</td><td>'+_rE(e.kGen,3)+'</td>'
      +'<td>'+_rF(fChk,3)+'</td><td>'+_rE(e.ke,3)+'</td>'
      +(haveZ?'<td>'+((zmod[i]&&Number.isFinite(zmod[i].zeta))?_rF(zmod[i].zeta,4):'—')+'</td>':'')
      +'<td class="l">'+_rEsc(modes[i].label||'—')+'</td></tr>';
  });
  h+='</table>';
  var skipTxt = nSkip ? ' '+nSkip+' mod sıfıra yakın frekansta olduğu için kapı dışında bırakıldı (bkz. §8.7 serbest mod uyarısı).' : '';
  if(!nEval){
    // Değerlendirilebilir tek mod yok → "fark 0" gibi DOĞRULANMAMIŞ bir olumlu
    // iddia basılmaz; kapı nötr kalır.
    h+='<div class="note warn"><span class="t">Özdeğer tutarlılığı</span>'
      +'Kontrol edilebilir mod bulunamadı — genelleştirilmiş kütle/rijitlik hesaplanamadı.'+skipTxt+'</div>';
  } else {
    h+='<div class="note '+(maxErr<1e-6?'check':'warn')+'"><span class="t">Özdeğer tutarlılığı</span>'
      +'\\( \\sqrt{k_r/m_r}/2\\pi \\) ile modal frekans arasındaki en büyük bağıl fark ('+nEval+' modda): '
      +(maxErr===0?'0':_rE(maxErr,2))+'. '
      +(maxErr<1e-6 ? 'Modlar, enerji hesabında kullanılan aynı K ve M matrislerinin özçözümüdür.'
                    : '<b>Beklenenden büyük</b> — modal çözüm ile enerji hesabı farklı matrisler kullanıyor olabilir.')
      +skipTxt+'</div>';
  }

  // ── Gövde bazında dağılım — modlar × bileşenler (özet) ──
  var bodies=me[0].bodies||[];
  if(bodies.length){
    h+='<p>Kinetik enerjinin gövdeler arasındaki dağılımı, hangi bileşenin modu <em>sürüklediğini</em> '
      +'gösterir: bir mod ağırlıklı olarak tek bir gövdedeyse, o gövdenin bağlantısı (takoz veya '
      +'iç bağlantı) o modun denetim noktasıdır. Gövde hızları rijit gövde kinematiğinden gelir: '
      +'\\( \\mathbf v_j=\\mathbf u+\\boldsymbol\\theta\\times\\mathbf d_j \\).</p>';
    h+='<table><caption>Tablo '+_rTbl()+' — Kinetik enerjinin gövdeler arasındaki dağılımı [%]</caption>';
    h+='<tr><th>Mod</th><th>f [Hz]</th>';
    bodies.forEach(function(b){ h+='<th>'+_rEsc(b.name)+'</th>'; });
    h+='<th>Baskın hareket</th></tr>';
    me.forEach(function(e,i){
      h+='<tr><td class="c">'+(i+1)+'</td><td>'+_rF(modes[i].f_Hz,2)+'</td>';
      (e.bodies||[]).forEach(function(b){
        var p=Math.max(0, Math.min(100, b.pct||0));
        var bar='background:linear-gradient(90deg, rgba(36,66,95,0.20) '+p.toFixed(1)+'%, transparent '+p.toFixed(1)+'%);';
        h+='<td style="'+bar+'">'+_rF(b.pct,1)+'%</td>';
      });
      h+='<td class="l">'+_rEsc(modes[i].label||'—')+'</td></tr>';
    });
    h+='</table>';

    // ── Mod başına ayrıntı: gövde × serbestlik derecesi (PDF Tablo 12–17 yapısı) ──
    h+='<p>Aşağıda her mod için enerji, gövde <em>ve</em> serbestlik derecesi bazında ayrıştırılmıştır. '
      +'X/Y/Z öteleme, RXX/RYY/RZZ dönme atalet terimleri, RXY/RXZ/RYZ ise atalet <b>çarpım</b> '
      +'terimleridir (asimetrik kütle dağılımının kuplaj katkısı; nokta kütlelerde ve simetrik '
      +'bileşenlerde sıfırdır). Tüm değerler o modun toplam kinetik enerjisinin yüzdesidir.</p>';
    var dofs=[['X','X'],['Y','Y'],['Z','Z'],['RXX','RXX'],['RYY','RYY'],['RZZ','RZZ'],
              ['RXY','RXY'],['RXZ','RXZ'],['RYZ','RYZ']];
    var atlanan=[];
    me.forEach(function(e,i){
      var tot=e.total||0;
      // ω=0 → tüm enerjiler 0 → yüzde tanımsız. Tablo basılmaz ama SESSİZCE
      // atlanmaz: okuyucu eksik mod numarasını aşağıdaki notta bulur.
      if(!(Math.abs(tot)>0)){ atlanan.push(i+1); return; }
      h+='<table><caption>Tablo '+_rTbl()+' — Mod '+(i+1)+' ('+_rF(modes[i].f_Hz,2)+' Hz, '
        +_rEsc(modes[i].label||'—')+'): kinetik enerji dağılımı [%]</caption>';
      h+='<tr><th>Gövde</th><th>Toplam</th>';
      dofs.forEach(function(dd){ h+='<th>'+dd[1]+'</th>'; });
      h+='</tr>';
      (e.bodies||[]).forEach(function(b){
        h+='<tr><td class="l">'+_rEsc(b.name)+'</td><td><b>'+_rF(b.pct,2)+'</b></td>';
        dofs.forEach(function(dd){ h+='<td>'+_rF(100*(b[dd[0]]||0)/tot,2)+'</td>'; });
        h+='</tr>';
      });
      h+='<tr class="sum"><td class="l">Toplam</td><td><b>100</b></td>';
      dofs.forEach(function(dd){
        var s=(e.bodies||[]).reduce(function(a,b){ return a+(b[dd[0]]||0); },0);
        h+='<td>'+_rF(100*s/tot,2)+'</td>';
      });
      h+='</tr></table>';
    });
    if(atlanan.length){
      h+='<div class="note warn"><span class="t">Atlanan modlar</span>'
        +'Mod '+atlanan.join(', ')+' için ayrıntı tablosu üretilmedi: frekans sıfıra yakın olduğundan '
        +'kinetik enerji de sıfırdır ve yüzde dağılım tanımsızdır (serbest mod — bkz. §8.7).</div>';
    }
    h+='<p style="font-size:0.9em; color:#5a6270;">Gövde enerjilerinin toplamı, birleşik kütle '
      +'matrisiyle hesaplanan \\( \\tfrac12\\omega^2\\boldsymbol\\varphi^{\\mathsf T}\\mathbf M\\boldsymbol\\varphi \\) '
      +'değerine <b>tam olarak</b> eşittir; bu, ağırlık merkezi tanımının (\\( \\sum_j m_j\\mathbf d_j=\\mathbf 0 \\)) '
      +'doğrudan sonucudur ve kütle birleştirmenin (§8.1) bağımsız bir kontrolüdür. '
      +'<b>Nokta kütle</b> işaretli bileşenlerde eşitlik korunur: kütle birleştirme de o bileşenin '
      +'kendi ataletini sıfır alır, yani her iki taraf aynı kabulü paylaşır.</p>';
  }
  return h;
}

// §8.16 — Mod şekli görselleştirmesi (ASR-SR-116 Şekil 10–15 karşılığı).
// Mod şekli φ = [u; θ] rijit gövde yer değiştirmesidir: her nokta
//   Δp = u + θ × (p − c_G)
// kadar öteler. Sayısal matris (§8.7) hangi serbestlik derecesinin baskın
// olduğunu söyler ama gövdenin NASIL hareket ettiğini göstermez; bu bölüm
// deforme şekli çizer. Ölçek görseldir (mod şekli normalize, mutlak genlik yok).
function _mntRepModeFigure(geom, cgM, phi, plane, no, scale){
  var horiz='x', vert=(plane==='xy')?'y':'z';
  var hi=(plane==='xy')?1:2;                      // dikey eksenin indeksi (y ya da z)
  var C0=_rMountCore();
  // Rijit gövde yer değiştirmesi: Δ = u + θ×d   (mm cinsinden; θ [rad] × d [mm])
  function disp(p){
    var d=[p.x-cgM.x, p.y-cgM.y, p.z-cgM.z];
    return [ phi[0]*1000 + phi[4]*d[2] - phi[5]*d[1],
             phi[1]*1000 + phi[5]*d[0] - phi[3]*d[2],
             phi[2]*1000 + phi[3]*d[1] - phi[4]*d[0] ];
  }
  // Gövde kutusu: kütle+atalet → eşdeğer prizma kenarları (mm). Yoksa null.
  function kutu(c){
    if(!C0 || !C0.equivalentBox) return null;
    var e=C0.equivalentBox(c.mass, [[c.Ixx,0,0],[0,c.Iyy,0],[0,0,c.Izz]], c.pointMass);
    return e;   // [a,b,c] mm (girdi mm² tabanlı değil — atalet kg·m², kütle kg → m)
  }
  // DÖNME (görsel): tüm gövdeler aynı θ ile döner (rijit gövde modu).
  //   X–Y düzlemi: θ_z ekranda SAAT YÖNÜNÜN TERSİ → SVG rotate negatif
  //   X–Z düzlemi: θ_y ekranda SAAT YÖNÜNDE      → SVG rotate pozitif
  var donme = (plane==='xy') ? (-phi[5]*scale*180/Math.PI) : (phi[4]*scale*180/Math.PI);

  var items=geom.comps.map(function(c){ return {p:c, tip:'k', ad:c.name, box:kutu(c)}; })
             .concat(geom.mounts.map(function(m){ return {p:m, tip:'t', ad:m.name, box:null}; }));
  // Sınır kutusu: gövde köşeleri de hesaba katılsın ki kutular taşmasın
  // Sınır kutusu HER İKİ görünüş için ayrı ayrı hesaplanır ama ÖLÇEK ortaktır:
  // iki figür farklı px/mm ile çizilirse okuyucu yandan görünüşü "yakınlaştırılmış"
  // sanır ve gövde oranlarını yanlış karşılaştırır.
  function kutuAralik(vIdx){
    var P=[];
    items.forEach(function(it){
      var dd=disp(it.p);
      var eh=it.box ? it.box[0]*500 : 0;
      var ev=it.box ? it.box[vIdx]*500 : 0;
      var vAd=(vIdx===1)?'y':'z';
      [[0,0],[1,1]].forEach(function(k){
        var bx=it.p.x+dd[0]*scale*k[0], bv=it.p[vAd]+dd[vIdx]*scale*k[1];
        P.push({h:bx-eh, v:bv-ev}); P.push({h:bx+eh, v:bv+ev});
      });
    });
    P.push({h:cgM.x, v:(vIdx===1)?cgM.y:cgM.z});
    var H2=P.map(function(q){return q.h;}), V2=P.map(function(q){return q.v;});
    return { minH:Math.min.apply(null,H2), maxH:Math.max.apply(null,H2),
             minV:Math.min.apply(null,V2), maxV:Math.max.apply(null,V2) };
  }
  var bbY=kutuAralik(1), bbZ=kutuAralik(2);
  var bb=(plane==='xy')?bbY:bbZ;
  var minH=Math.min(bbY.minH, bbZ.minH), maxH=Math.max(bbY.maxH, bbZ.maxH);
  // Dikey aralık: bu görünüşün kendi merkezine oturur ama YÜKSEKLİK ortak
  var minV=bb.minV, maxV=bb.maxV;
  // ÖLÇEK ortak (iki görünüş aynı px/mm), YÜKSEKLİK her görünüşün kendi içeriğine
  // göre. Ortak yükseklik verilirse dar görünüşte kocaman boşluk kalıyor; ortak
  // ölçek verilmezse gövde oranları iki figür arasında karşılaştırılamaz oluyor.
  var W=760, padL=46, padR=34, padT=30, padB=26;
  var rngH=Math.max(maxH-minH,1);
  var vSpanOrtak=Math.max(bbY.maxV-bbY.minV, bbZ.maxV-bbZ.minV, 1);
  var plotW=W-padL-padR;
  var sc=Math.min(plotW/rngH, 250/vSpanOrtak);          // 250 px = en yüksek görünüşe ayrılan alan
  var rngV=Math.max(maxV-minV,1);
  var H=Math.round(padT+padB+rngV*sc)+18;               // +18: alt etiket satırı için
  var plotH=H-padT-padB;
  var offH=padL+(plotW-rngH*sc)/2, offV=padT+(plotH-rngV*sc)/2;
  function sx(hh){ return offH+(hh-minH)*sc; }
  function sy(vv){ return offV+(maxV-vv)*sc; }
  var s='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
  s+='<text x="6" y="14" font-size="11" fill="#5a6270">'+(plane==='xy'?'Üstten (X–Y)':'Yandan (X–Z)')+'</text>';
  if(plane==='xy'){
    s+='<rect x="'+(W-152)+'" y="6" width="8" height="8" fill="#8a3ca0"/>'
      +'<text x="'+(W-140)+'" y="14" font-size="9.5" fill="#5a6270">takoz</text>'
      +'<rect x="'+(W-98)+'" y="6" width="12" height="8" rx="2" fill="rgba(36,66,95,0.13)" stroke="#24425f" stroke-width="1.1"/>'
      +'<text x="'+(W-82)+'" y="14" font-size="9.5" fill="#5a6270">gövde kutusu</text>';
  }

  // ── REFERANS (deforme olmamış) — soluk gövdeler ──
  items.forEach(function(it){
    var x=sx(it.p[horiz]), y=sy(it.p[vert]);
    if(it.tip==='t'){
      s+='<rect x="'+(x-4).toFixed(1)+'" y="'+(y-4).toFixed(1)+'" width="8" height="8" fill="none" stroke="#c9ced6" stroke-width="1.1"/>';
    } else if(it.box){
      var w=it.box[0]*1000*sc, hh=it.box[hi]*1000*sc;
      s+='<rect x="'+(x-w/2).toFixed(1)+'" y="'+(y-hh/2).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+hh.toFixed(1)
        +'" rx="3" fill="none" stroke="#d3d8de" stroke-width="1.1" stroke-dasharray="4 3"/>';
    } else {
      s+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3.4" fill="none" stroke="#c9ced6" stroke-width="1.1"/>';
    }
  });

  // ── DEFORME konum — dolu gövdeler, mod dönmesiyle döndürülmüş ──
  var takozNo=0;
  // Etiket çakışma önleyici: yerleştirilen her etiketin kapladığı dikdörtgen
  // tutulur; yeni etiket çakışıyorsa bir satır aşağı itilir. Kademeli sabit
  // ofset yetmiyordu — aynı x'te üç gövde varsa (braket/PTO/şanzıman) yine
  // üst üste biniyorlardı.
  var yerlesik=[];
  function etiketYerlestir(cx, yAlt, metin){
    var gen=metin.length*4.7, yy=yAlt;
    for(var tur=0; tur<8; tur++){
      var carpisma=yerlesik.some(function(r){
        return Math.abs(r.cx-cx) < (r.gen+gen)/2 + 4 && Math.abs(r.y-yy) < 11;
      });
      if(!carpisma) break;
      yy += 11.5;
    }
    yerlesik.push({cx:cx, y:yy, gen:gen});
    return yy;
  }
  items.forEach(function(it){
    var dd=disp(it.p);
    var x0=sx(it.p[horiz]), y0=sy(it.p[vert]);
    var x1=sx(it.p[horiz]+dd[0]*scale), y1=sy(it.p[vert]+dd[hi]*scale);
    var renk=(it.tip==='t')?'#8a3ca0':'#24425f';
    if(Math.abs(x1-x0)>0.8 || Math.abs(y1-y0)>0.8)
      s+='<line class="disp" x1="'+x0.toFixed(1)+'" y1="'+y0.toFixed(1)+'" x2="'+x1.toFixed(1)+'" y2="'+y1.toFixed(1)+'" stroke="'+renk+'" stroke-width="1" opacity="0.4"/>';
    if(it.tip==='t'){
      s+='<rect x="'+(x1-4).toFixed(1)+'" y="'+(y1-4).toFixed(1)+'" width="8" height="8" fill="'+renk+'"/>';
      takozNo++;   // takoz adları BASILMAZ — altı küçük kare, üstelik gövde
                   // adlarıyla aynı bölgede yığılıyordu. Konumları §8.5/§8.7'de
                   // adlarıyla verilir; burada mor kare olmaları yeterli.
    } else if(it.box){
      var w2=it.box[0]*1000*sc, h2=it.box[hi]*1000*sc;
      s+='<g transform="rotate('+donme.toFixed(3)+' '+x1.toFixed(1)+' '+y1.toFixed(1)+')">'
        +'<rect x="'+(x1-w2/2).toFixed(1)+'" y="'+(y1-h2/2).toFixed(1)+'" width="'+w2.toFixed(1)+'" height="'+h2.toFixed(1)
        +'" rx="3" fill="rgba(36,66,95,0.13)" stroke="'+renk+'" stroke-width="1.4"/></g>';
      s+='<circle cx="'+x1.toFixed(1)+'" cy="'+y1.toFixed(1)+'" r="2" fill="'+renk+'"/>';
      var adk=String(it.ad||'').split('—')[0].trim();
      if(adk && plane==='xy'){
        var yE=etiketYerlestir(x1, y1+h2/2+12, adk);
        s+='<text x="'+x1.toFixed(1)+'" y="'+yE.toFixed(1)+'" font-size="9.5" fill="#4a5462" text-anchor="middle" paint-order="stroke" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="round">'+_rEsc(adk)+'</text>';
      }
    } else {
      s+='<circle cx="'+x1.toFixed(1)+'" cy="'+y1.toFixed(1)+'" r="3.6" fill="'+renk+'"/>';
      var adn=String(it.ad||'').split('—')[0].trim();
      if(adn && plane==='xy'){
        var yN=etiketYerlestir(x1, y1+13, adn);
        s+='<text x="'+x1.toFixed(1)+'" y="'+yN.toFixed(1)+'" font-size="9.5" fill="#4a5462" text-anchor="middle" paint-order="stroke" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="round">'+_rEsc(adn)+'</text>';
      }
    }
  });
  // birleşik ağırlık merkezi (deforme konumda — u kadar öteler, θ×0 = 0)
  var gx=sx(cgM.x+phi[0]*1000*scale), gy=sy(((plane==='xy')?cgM.y:cgM.z)+phi[hi]*1000*scale);
  s+='<circle cx="'+gx.toFixed(1)+'" cy="'+gy.toFixed(1)+'" r="5.5" fill="none" stroke="#1b1e24" stroke-width="1.5"/>';
  s+='<line x1="'+(gx-7).toFixed(1)+'" y1="'+gy.toFixed(1)+'" x2="'+(gx+7).toFixed(1)+'" y2="'+gy.toFixed(1)+'" stroke="#1b1e24" stroke-width="1"/>';
  s+='<line x1="'+gx.toFixed(1)+'" y1="'+(gy-7).toFixed(1)+'" x2="'+gx.toFixed(1)+'" y2="'+(gy+7).toFixed(1)+'" stroke="#1b1e24" stroke-width="1"/>';
  s+='<text x="'+(gx+9).toFixed(1)+'" y="'+(gy-7).toFixed(1)+'" font-size="10.5" font-weight="600" fill="#1b1e24">G</text>';
  s+='</svg>';
  return s;
}
function _mntRepModeShapes(R){
  var modes=R.modes||[];
  if(!modes.length || !R.mp) return '';
  var geom=_mntRepGeom(R);
  if(!geom.comps.length && !geom.mounts.length) return '';
  var cgM={x:R.mp.cg[0]*1000, y:R.mp.cg[1]*1000, z:R.mp.cg[2]*1000};
  // Görsel ölçek: en büyük yer değiştirme, modelin karakteristik boyutunun
  // ~%12'si kadar görünsün. Mod şekli normalize olduğu için mutlak genlik yoktur.
  var hs=geom.mounts.map(function(m){return m.x;}).concat(geom.comps.map(function(c){return c.x;}));
  var span=(hs.length>1) ? (Math.max.apply(null,hs)-Math.min.apply(null,hs)) : 1000;
  var h='<h3>8.16 Mod şekilleri — deforme geometri</h3>';
  h+='<p>Mod şekli \\( \\boldsymbol\\varphi=[\\mathbf u;\\boldsymbol\\theta] \\) bir rijit gövde yer değiştirmesidir: '
    +'geometrideki her nokta \\( \\Delta\\mathbf p=\\mathbf u+\\boldsymbol\\theta\\times(\\mathbf p-\\mathbf c_G) \\) kadar öteler. '
    +'§8.7 matrisi hangi serbestlik derecesinin baskın olduğunu <em>sayıyla</em> verir; burada gövdenin '
    +'<b>nasıl</b> hareket ettiği çizilir. Kesikli soluk şekiller referans (deforme olmamış) konumu, dolu '
    +'şekiller deforme konumu gösterir; mor kare = takoz, ⊕ = birleşik ağırlık merkezi.</p>';
  h+='<p>Gövde kutuları <b>uydurma ikon değildir</b>: her bileşenin girilen kütlesini ve atalet momentlerini '
    +'birebir veren <em>tek</em> düzgün yoğunluklu dikdörtgen prizmadır. '
    +'\\( I_{xx}=\\tfrac{m}{12}(b^2+c^2) \\) üçlüsü a, b, c için tek çözümlüdür:</p>';
  h+='$$ a=\\sqrt{\\tfrac{6}{m}(I_{yy}{+}I_{zz}{-}I_{xx})},\\quad '
    +'b=\\sqrt{\\tfrac{6}{m}(I_{xx}{+}I_{zz}{-}I_{yy})},\\quad '
    +'c=\\sqrt{\\tfrac{6}{m}(I_{xx}{+}I_{yy}{-}I_{zz})} $$';
  h+='<p style="font-size:0.9em; color:#5a6270;">Kutu ölçekle çizilir; yani şekillerin göreli büyüklüğü '
    +'gerçek atalet dağılımını yansıtır. Nokta kütle işaretli bileşenlerde (atalet = 0) boyut tanımsızdır, '
    +'daire ile gösterilir. Genlik ise <b>görseldir</b>: mod şekli normalize edildiği için mutlak yer '
    +'değiştirme değeri yoktur — şekiller karşılaştırılabilir olsun diye her modda aynı görsel ölçek kullanılır. '
    +'Kutuların dönmesi de aynı görsel ölçekle büyütülmüştür.</p>';
  modes.forEach(function(md,i){
    var phi=md.phi||[0,0,0,0,0,0];
    // Her mod için ölçek: bu modun en büyük nokta yer değiştirmesi span'ın %12'si olsun
    var maxD=0;
    geom.comps.concat(geom.mounts).forEach(function(p){
      var d=[p.x-cgM.x, p.y-cgM.y, p.z-cgM.z];
      var dd=[ phi[0]*1000 + phi[4]*d[2] - phi[5]*d[1],
               phi[1]*1000 + phi[5]*d[0] - phi[3]*d[2],
               phi[2]*1000 + phi[3]*d[1] - phi[4]*d[0] ];
      maxD=Math.max(maxD, Math.abs(dd[0]), Math.abs(dd[1]), Math.abs(dd[2]));
    });
    // Görsel ölçek İKİ sınırla birden belirlenir:
    //   (a) en büyük öteleme, modelin boyunun %12'sini geçmesin
    //   (b) en büyük DÖNME 6°'yi geçmesin
    // (b) olmazsa dönme baskın modlarda kutular 15–20° yatar; okuyucu bunu
    // "model bozuk" diye okur. Mod şekli normalize olduğundan genlik zaten
    // keyfidir — kısıtlayan hangisiyse o belirler.
    var ROT_MAX=6*Math.PI/180;
    var maxRot=Math.max(Math.abs(phi[3]), Math.abs(phi[4]), Math.abs(phi[5]));
    var sTrans=(maxD>0) ? (span*0.12/maxD) : Infinity;
    var sRot  =(maxRot>0) ? (ROT_MAX/maxRot) : Infinity;
    var scale=Math.min(sTrans, sRot);
    if(!Number.isFinite(scale)) scale=0;
    h+='<figure style="break-inside:avoid;">'
      +_mntRepModeFigure(geom, cgM, phi, 'xy', 'm'+i+'a', scale)
      +_mntRepModeFigure(geom, cgM, phi, 'xz', 'm'+i+'b', scale)
      +'<figcaption><b>Şekil '+_rFig()+' —</b> Mod '+(i+1)+': '+_rF(md.f_Hz,2)+' Hz · '
      +_rEsc(md.label||'—')+'. Üstten (X–Y) ve yandan (X–Z) görünüş.</figcaption></figure>';
  });
  return h;
}

// §8.15 — Rijitlik yumuşatma duyarlılığı (tasarım iterasyonu).
// Mevcut takozlar frekans kriterlerini sağlamıyorsa sorulacak soru "ne kadar
// yumuşatmalı?" olur. Bu bölüm takoz rijitliklerini (statik + dinamik birlikte)
// ölçekleyip her adımda modal çözümü ve düşey iletilebilirliği YENİDEN çözer —
// f ∝ √k yaklaşımı VARSAYILMAZ, özdeğer problemi her katsayı için kurulur.
// Referans: ASR-SR-116 §5 / Tablo 19 (%50 yumuşatma sonrası beklenen modlar).
var _SOFT_FACTORS = [1.00, 0.80, 0.65, 0.50, 0.40, 0.30];
function _mntRepSoftening(R, opts){
  var C=_rMountCore();
  if(!C || !C.softeningScan || !R.mounts || !R.mounts.length || !R.mp) return '';
  var modes=R.modes||[];
  if(!modes.length) return '';
  var _eng=_mntRepEngine(R, opts||{});
  var rpm=_eng.idleRpm, z=_eng.cylinders;
  var haveIdle=(rpm>0 && z>0), fFire=haveIdle?(rpm/60)*(z/2):NaN;
  var zeta=_mntRepZeta(R, opts||{});
  var M6=C.buildM6(R.mp.m, R.mp.I_G);
  var scan=C.softeningScan(R.mounts, R.mp.cg, M6, R.mp.m, _SOFT_FACTORS, fFire, zeta);
  if(!scan || !scan.length) return '';

  var GAP_MIN=0.5, BAND=[8,10], lim=haveIdle?0.5*fFire:NaN;
  function degerlendir(row){
    var pl=C.modePlacement(row.modes.map(function(m){ return {f_Hz:m.f_Hz, label:m.label}; }),
                           { fLimit: haveIdle?lim:undefined, gapMin:GAP_MIN, bandLo:BAND[0], bandHi:BAND[1] });
    return {
      pl: pl,
      k1:  haveIdle ? (pl.exceed.length===0) : null,
      k1a: pl.minGapPair ? (pl.minGap > GAP_MIN) : null,
      k1b: (pl.inBand.length===0),
      k2:  Number.isFinite(row.T) ? (row.T < 0.5) : null,
      k2r: Number.isFinite(row.T) ? (row.T < 0.10) : null
    };
  }
  var sonuc=scan.map(degerlendir);

  var h='<h3>8.15 Rijitlik yumuşatma duyarlılığı</h3>';
  h+='<p>Frekans kriterleri sağlanmıyorsa tasarım adımı takozu <em>yumuşatmaktır</em>. '
    +'Aşağıda takoz rijitlikleri (statik ve dinamik birlikte) ölçeklenip her adımda '
    +'özdeğer problemi ve iletilebilirlik <b>yeniden çözülür</b>.</p>';
  h+='<p style="font-size:0.9em; color:#5a6270;">Tüm takozlar aynı katsayıyla ölçeklendiğinde '
    +'frekanslar <b>tam olarak</b> \\( \\sqrt{\\alpha} \\) ile gider ( \\( \\alpha\\mathbf K\\boldsymbol\\varphi'
    +'=\\omega^2\\mathbf M\\boldsymbol\\varphi\\Rightarrow\\omega^2\\propto\\alpha \\), kuplaj olsun olmasın). '
    +'Tablonun asıl bilgisi frekans sütunları değil, <b>iletilebilirlik ve kriter sonuçlarıdır</b>: '
    +'T katsayıyla orantılı ölçeklenmez, mod ayrıklığı ve bant çakışması ise ancak gerçek '
    +'frekans listesine bakılarak değerlendirilebilir.</p>';
  h+='<table><caption>Tablo '+_rTbl()+' — Takoz rijitliği ölçeklendikçe mod frekansları ve rölanti iletilebilirliği</caption>';
  h+='<tr><th>Ölçek</th>';
  for(var i=1;i<=modes.length;i++) h+='<th>f<sub>'+i+'</sub></th>';
  h+='<th>f<sub>bounce</sub></th><th>T</th><th>Kriter 1</th><th>1a</th><th>1b</th><th>2</th></tr>';
  function tik(v){ return (v===null)?'—':(v?'<span class="ok">✓</span>':'<span style="color:var(--warn);font-weight:600;">✗</span>'); }
  scan.forEach(function(row,k){
    var s=sonuc[k];
    var vurgu=(row.factor===1) ? ' style="background:rgba(36,66,95,0.10);"' : '';
    h+='<tr'+vurgu+'><td class="c"><b>'+_rF(row.factor*100,0)+'%</b></td>';
    row.modes.forEach(function(m){ h+='<td>'+_rF(m.f_Hz,2)+'</td>'; });
    h+='<td>'+_rF(row.fBounce,2)+'</td>'
      +'<td>'+(Number.isFinite(row.T)?_rF(row.T*100,1)+'%':'—')+'</td>'
      +'<td class="c">'+tik(s.k1)+'</td><td class="c">'+tik(s.k1a)+'</td>'
      +'<td class="c">'+tik(s.k1b)+'</td><td class="c">'+tik(s.k2)+'</td></tr>';
  });
  h+='</table>';
  h+='<p style="font-size:0.9em; color:#5a6270;">%100 satırı mevcut tasarımdır (§8.7 ile aynı frekanslar). '
    +'Frekanslar [Hz], T rölanti ateşleme frekansındaki düşey kuvvet iletilebilirliğidir.</p>';

  // ── Hüküm: kriterleri sağlayan en SERT (en az yumuşatılmış) tasarım ──
  var uygunIdx=-1;
  for(var j=0;j<scan.length;j++){
    var s2=sonuc[j];
    if(s2.k1!==false && s2.k1a!==false && s2.k1b!==false && s2.k2!==false){ uygunIdx=j; break; }
  }
  var mevcutOK = sonuc[0] && sonuc[0].k1!==false && sonuc[0].k1a!==false && sonuc[0].k1b!==false && sonuc[0].k2!==false;
  if(mevcutOK){
    h+='<div class="note check"><span class="t">Yumuşatma gerekmiyor</span>'
      +'Mevcut takoz rijitlikleri (%100) taranan frekans ve izolasyon kriterlerinin tümünü sağlıyor. '
      +'Tablo yine de tasarım payını gösterir: hangi yumuşatma seviyesine kadar kriterlerin korunduğu okunabilir.</div>';
  } else if(uygunIdx>=0){
    var f0=scan[uygunIdx];
    h+='<div class="note warn"><span class="t">Yumuşatma gerekiyor</span>'
      +'Mevcut rijitlikte en az bir kriter sağlanmıyor. Taranan seviyeler içinde kriterleri sağlayan '
      +'<b>en sert</b> tasarım <b>%'+_rF(f0.factor*100,0)+'</b> ölçek: modlar '
      +f0.modes.map(function(m){ return _rF(m.f_Hz,2); }).join(' / ')+' Hz, '
      +'T = '+(Number.isFinite(f0.T)?_rF(f0.T*100,1)+'%':'—')+'. '
      +'Bu bir <em>hedef</em>tir; nihai takoz kataloğundan seçildikten sonra analiz tekrarlanmalıdır.</div>';
  } else {
    // Hangi kriter(ler) engelliyor? Yalnız "olmadı" demek kullanıcıyı kör bırakır;
    // takozu daha da yumuşatmanın çözmeyeceği bir kriter varsa bunu söylemek gerekir.
    var AD={k1:'Kriter 1 (modal bant)', k1a:'Kriter 1a (mod ayrıklığı)',
            k1b:'Kriter 1b (8–10 Hz bandı)', k2:'Kriter 2 (iletilebilirlik)'};
    var engel={};
    sonuc.forEach(function(s3){ ['k1','k1a','k1b','k2'].forEach(function(k){ if(s3[k]===false) engel[k]=(engel[k]||0)+1; }); });
    // Yumuşatmayla İYİLEŞEN kriter en az bir seviyede sağlanmışsa "kısmen çözülür".
    var hicSaglanmayan=Object.keys(engel).filter(function(k){ return engel[k]===sonuc.length; });
    h+='<div class="note warn"><span class="t">Taranan aralıkta tüm kriterleri sağlayan seviye yok</span>'
      +'%'+_rF(_SOFT_FACTORS[0]*100,0)+' – %'+_rF(_SOFT_FACTORS[_SOFT_FACTORS.length-1]*100,0)
      +' aralığında hiçbir ölçek katsayısı kriterlerin tümünü aynı anda sağlamıyor. '
      +'Engelleyen kriterler: '
      +Object.keys(engel).map(function(k){ return '<b>'+AD[k]+'</b> ('+engel[k]+'/'+sonuc.length+' seviyede kırmızı)'; }).join(', ')+'. ';
    if(hicSaglanmayan.length){
      h+='<b>'+hicSaglanmayan.map(function(k){ return AD[k]; }).join(' ve ')+' hiçbir seviyede sağlanmıyor</b> — '
        +'bu kriter(ler) rijitlik ölçeğine duyarsızdır ya da ters yönde çalışır; '
        +'yalnız yumuşatarak çözülemez. ';
    }
    h+='Takoz <b>yerleşimi</b> (hardpoint), kütle dağılımı veya eksen başına farklı '
      +'oranda yumuşatma (yalnız düşey ekseni indirmek gibi) değerlendirilmelidir. '
      +'Bu tablo tüm takozları AYNI katsayıyla ölçekler; eksen ya da takoz başına '
      +'farklılaştırma bu taramanın kapsamı dışındadır.</div>';
  }
  h+='<p style="font-size:0.9em; color:#5a6270;">Tarama yalnız <b>frekans ve izolasyon</b> kriterlerini değerlendirir. '
    +'Yumuşatma statik çökmeyi \\( 1/\\text{ölçek} \\) oranında büyütür: %50 yumuşatma statik çökmeyi ikiye katlar '
    +'ve ±15 mm metal-metal durdurucuya yaklaştırır. Seçim kesinleşmeden §8.5, §8.6 ve §8.10 yeniden okunmalıdır.</p>';
  return h;
}

// Doğrulama → iç-tutarlılık özeti
function _mntRepConsistency(R){
  var h='<h3>8.11 Model içi tutarlılık kontrolleri</h3>';
  var nBal=0, nTot=0, tension=0, overLin=0;
  R.allCases.forEach(function(rc){
    if(!rc.res) return; nTot++;
    if(rc.res.checks.sumFzOk) nBal++;
    tension+=rc.res.checks.tensionCount;
    overLin+=rc.res.checks.overLinearCount;
  });
  var cls = (nBal===nTot && overLin===0) ? 'check' : 'warn';
  h+='<div class="note '+cls+'"><span class="t">Tutarlılık özeti</span>';
  h+='Çözülen '+nTot+' yük durumunun '+nBal+' tanesinde düşey kuvvet dengesi (Σf_z = dış yük) sağlanır. ';
  h+='Çekme / lift-off gözlenen takoz-durum sayısı: '+tension+'. ';
  h+='±10 mm lineerlik bandını aşan takoz-durum sayısı: '+overLin+'. ';
  if(overLin>0){ h+='<strong>Lineer model bu bandın ötesinde yaklaşıktır</strong> — ilgili yük durumlarında takozun nonlineer kuvvet–sehim eğrisi (Bölüm 9.1) devreye girer; sonuçlar bu sınır göz önünde değerlendirilmelidir.'; }
  else { h+='Tüm sehimler lineer bantta — model varsayımları bu yük durumlarında geçerlidir.'; }
  h+='</div>';
  return h;
}

// ═══ "Motor Takozu Uygunluğu" — analizi şirket hedef kriterlerine göre denetler ═══
//  1) PowerPack Roll modu < %50·f_ateş  2) Rölanti transmissibility < %50
//  3) Vites başına takoz kuvvetleri kontrol  4) Maks tork·3,5g düşey·1g yanal·1g boyuna
function _mntRepCompliance(R, opts){
  opts=opts||{};
  var modes=R.modes||[];
  var h='<h2 id="uygunluk"><span class="no">✓</span>Motor Takozu Uygunluğu</h2>';
  h+='<p>Bu bölüm, §8 analiz sonuçlarını <strong>şirket motor takozu hedef kriterlerine</strong> göre değerlendirir. Modal bant ve rölanti izolasyon kriterleri, motor rölanti devri ve silindir sayısı girdisine bağlıdır (<strong>Motor</strong> bileşeninden girilir); mod ayrıklığı ve yaylandırılmamış kütle bandı kriterleri yalnız modal sonuca bakar.</p>';
  if(!modes.length){ return h+'<div class="note warn"><span class="t">Değerlendirilemedi</span>Modal sonuç yok — çözüm üretilemedi.</div>'; }
  var _eng=_mntRepEngine(R, opts);        // TEK kaynak: Motor bileşeni
  var rpm=_eng.idleRpm, z=_eng.cylinders;
  var haveIdle=(rpm>0 && z>0), fFire=haveIdle?(rpm/60)*(z/2):NaN;

  // ── Mod yerleşimi ölçümleri (çekirdek: modePlacement) ───────────────────
  // KAPSAM DÜZELTMESİ: Kriter 1 eskiden yalnız EN YÜKSEK (roll) modu sınardı.
  // Kaynak kriter "modlar ... 15 Hz değerini geçmemeli" der — HEPSİ. Yalnız en
  // yükseği bakmak, ortadaki bir modun sınırı aşıp fark edilmemesine yol açar
  // (en yüksek mod sınırın altındaysa tablo "uygun" derdi).
  var _C=_rMountCore();
  var pl = (_C && _C.modePlacement)
    ? _C.modePlacement(modes, { fLimit: haveIdle ? 0.5*fFire : undefined }) : null;

  var c1;
  if(!haveIdle) c1={st:'wait', bulgu:'Rölanti devri + silindir sayısı girin (Motor bileşeni)'};
  else {
    var lim1=0.5*fFire;
    var asan=(pl&&pl.exceed)||[];
    c1={ st:(asan.length?'no':'ok'),
         bulgu: asan.length
           ? asan.length+' mod sınırı aşıyor ('+asan.map(function(m){ return 'mod '+m.no+' '+_rF(m.f,2)+' Hz'; }).join(', ')
             +') · sınır %50·f_ateş = '+_rF(lim1,2)+' Hz'
           : 'En yüksek mod (mod '+modes.length+') <b>'+_rF(pl?pl.fMax:NaN,2)+'</b> Hz &lt; sınır '+_rF(lim1,2)+' Hz — 6/6 mod bandın altında' };
  }

  // Kriter 1a — komşu modlar arası ayrıklık > 0,5 Hz. Birbirine çok yakın iki
  // mod pratikte tek bir geniş rezonans gibi davranır; yarı-güç genişliğinden
  // sönüm okumak da güvenilmez olur (bkz. §8.7 geçerlilik notu).
  var GAP_MIN=0.5, c1a;
  if(!pl || !pl.minGapPair) c1a={st:'wait', bulgu:'Modal sonuç yok'};
  else c1a={ st:(pl.minGap>GAP_MIN?'ok':'no'),
    bulgu:'En küçük ayrıklık <b>'+_rF(pl.minGap,3)+'</b> Hz (mod '+pl.minGapPair[0]+'–'+pl.minGapPair[1]+') · sınır &gt; '+_rF(GAP_MIN,1)+' Hz' };

  // Kriter 1b — yaylandırılmamış kütle (aks/lastik) modu bandı 8–10 Hz ile
  // çakışma. Güç grubu modu bu banda düşerse süspansiyon üzerinden enerji
  // alışverişi olur; takoz izolasyonu tek başına yetmez.
  var c1b;
  if(!pl) c1b={st:'wait', bulgu:'Modal sonuç yok'};
  else c1b={ st:(pl.inBand.length?'no':'ok'),
    bulgu: pl.inBand.length
      ? pl.inBand.length+' mod bantta ('+pl.inBand.map(function(m){ return 'mod '+m.no+' '+_rF(m.f,2)+' Hz'; }).join(', ')+') · bant '+_rF(pl.bandLo,0)+'–'+_rF(pl.bandHi,0)+' Hz'
      : 'Hiçbir mod '+_rF(pl.bandLo,0)+'–'+_rF(pl.bandHi,0)+' Hz bandında değil' };

  // Kriter 2 — Rölanti transmissibility. §8.8 ile AYNI hesap noktası
  // (_mntRepIsolation): taban DÜŞEY (bounce) frekansıdır, modal frekans değil.
  // İKİ EŞİK gösterilir: uygulamanın hükmü %50 kapısına göredir; kaynak
  // dokümanların (ör. ASR-SR-116) kullandığı %10 referansı da basılır ki aynı
  // sayı için iki farklı hükmün nereden geldiği görünsün.
  var T_GATE=0.5, T_REF=0.10;
  var iso=_mntRepIsolation(R, opts), c2;
  if(!haveIdle) c2={st:'wait', bulgu:'Rölanti devri + silindir sayısı girin (Motor bileşeni)'};
  else c2={st:(iso.T<T_GATE?'ok':'no'),
    bulgu:'f_ateş '+_rF(iso.fFire,1)+' Hz / f_bounce '+_rF(iso.fBounce,2)+' Hz → r='+_rF(iso.r,2)
         +', T=<b>'+(isFinite(iso.T)?_rF(iso.T*100,1)+'%':'∞')+'</b> (§8.8) · '
         +(isFinite(iso.T)
            ? (iso.T<T_REF ? '%10 referans eşiğini de sağlıyor'
                           : '<span style="color:var(--warn);">%10 referans eşiğinin üzerinde</span>')
            : '—')};

  // Kriter 3 — Vites başına takoz kuvvetleri (§8.9): tanımlı her vites ayrı çözülür.
  var gears=R.gearCases||[], gmax=null;
  gears.forEach(function(rc){ if(!rc.res) return; var mf=_mntRepMaxForce(rc.res);
    if(!gmax||mf.v>gmax.v) gmax={v:mf.v, g:(rc.loadCase&&rc.loadCase.gearLabel)||rc.name, mnt:mf.name}; });
  var c3 = (gears.length && gmax)
    ? {st:'ok', bulgu:'Her vites ayrı çözüldü ('+gears.length+' durum, §8.9); en yüksek bileşke takoz kuvveti <b>'+_rF(gmax.v,2)+'</b> kN ('+_rEsc(gmax.g)+' · '+_rEsc(gmax.mnt)+')'}
    : {st:'no', bulgu:'Tahrik torku girdisi yok — vites başına kontrol için Motor/Şanzıman kinematiğini doldurun'};

  // Kriter 4 — Tasarım yük koşulları (§8.10): maks tork, 3,5g düşey, 1g yanal,
  // 1g boyuna. 1g yanal, kalibreli 0,6g virajdan AYRI bir dayanım case'idir.
  var design=R.designCases||[], haveTq=(gears.length>0 && !!gears[0].res);
  var dPresent=design.filter(function(rc){ return rc.res; });
  var c4Total=dPresent.length+(haveTq?1:0);
  var concern=[];
  dPresent.forEach(function(rc){ if(rc.res.checks.tensionCount>0) concern.push(rc.name); });
  if(haveTq && gears[0].res.checks.tensionCount>0) concern.push('maks tork');
  var c4={st:(c4Total>=4?'ok':'no'),
    bulgu:c4Total+'/4 koşul çözüldü — §8.10'+(haveTq?'':' (maks tork için tahrik kinematiği girin)')};

  function badge(st){ return st==='ok'?'<span class="ok">✓ Uygun</span>':(st==='wait'?'<span style="color:#5a6270;">— bekliyor</span>':'<span style="color:var(--warn);font-weight:600;">✗ kontrol</span>'); }
  h+='<table><caption>Tablo '+_rTbl()+' — Motor takozu hedef kriterleri uygunluk kontrolü</caption>';
  h+='<tr><th>#</th><th>Kriter</th><th>Hedef</th><th>Bulgu</th><th>Sonuç</th></tr>';
  [['1', 'Modal bant — tüm modlar','&lt; %50 · f_ateş',c1],
   ['1a','Modlar arası ayrıklık','&gt; 0,5 Hz',c1a],
   ['1b','Yaylandırılmamış kütle bandı','8–10 Hz ile çakışmama',c1b],
   ['2', 'Rölanti transmissibility','&lt; %50 (referans %10)',c2],
   ['3', 'Vites başına takoz kuvvetleri','kontrol',c3],
   ['4', 'Maks tork · 3,5g düşey · 1g yanal · 1g boyuna','kontrol',c4]
  ].forEach(function(r){ h+='<tr><td class="c">'+r[0]+'</td><td class="l">'+r[1]+'</td><td class="l">'+r[2]+'</td><td class="l">'+r[3].bulgu+'</td><td class="c">'+badge(r[3].st)+'</td></tr>'; });
  h+='</table>';

  var sts=[c1.st,c1a.st,c1b.st,c2.st,c3.st,c4.st], anyNo=sts.indexOf('no')>=0, anyWait=sts.indexOf('wait')>=0;
  h+='<div class="note '+(anyNo?'warn':(anyWait?'':'check'))+'"><span class="t">Genel hüküm</span>';
  if(anyNo) h+='Bir veya daha fazla kriter <b>sağlanmıyor / kontrol gerektiriyor</b>; ilgili satırları ve §8 ayrıntısını inceleyin.';
  else if(anyWait) h+='Kuvvet ve yükleme kriterleri sağlanıyor; roll modu ve transmissibility için <b>Motor</b> bileşenine rölanti devri + silindir sayısı girin → tam değerlendirme.';
  else h+='<b>Tüm hedef kriterler sağlanıyor</b> — güç grubu takoz sistemi şirket motor takozu hedeflerini karşılıyor.';
  if(concern.length) h+=' <span style="color:var(--warn);">Not: '+_rEsc(concern.join(', '))+' durum(lar)ında çekme (lift-off) var — takoz seçimi gözden geçirilmeli.</span>';
  h+='</div>';
  h+='<div style="font-size:0.9em; color:#5a6270; margin-top:6px;">Ateşleme frekansı f_ateş = (N/60)·(z/2). <b>Kriter 1</b> modların TAMAMINI sınar — en yüksek mod (mod '+(modes.length)+') tek başına belirleyici değildir; ortadaki bir mod da sınırı aşabilir. <b>Kriter 1a</b> komşu modların birbirine karışmasını, <b>1b</b> güç grubu modlarının aks/lastik (yaylandırılmamış kütle) bandına düşmesini engeller. Transmissibility T=√[(1+(2ζr)²)/((1−r²)²+(2ζr)²)] ile, DÜŞEY (bounce) doğal frekansı f_bounce=(1/2π)·√(Σk_z,din/m) tabanında hesaplanır (§8.8); ζ Çözücü\'de girilir; modal frekans bu hesaba GİRMEZ. Vites başına kuvvetler §8.9, tasarım yük koşulları (1g yanal dâhil) §8.10, kriterleri sağlamak için gereken rijitlik yumuşatması §8.15\'te ayrıntılıdır.</div>';
  return h;
}

// allCases içinde ada göre bul
function _mntRepFindCase(R, name){
  if(!R || !R.allCases) return null;
  for(var i=0;i<R.allCases.length;i++){ if(R.allCases[i].name===name) return R.allCases[i]; }
  return null;
}

// ─── Node/Jest için dışa aç ──────────────────────────────────────────────────
if(typeof module!=='undefined' && module.exports){
  module.exports = {
    getMntReportPropertiesHTML: getMntReportPropertiesHTML,
    veMntGenerateReport: veMntGenerateReport,
    _mntBuildReportHTML: _mntBuildReportHTML,
    _mntRepAntet: _mntRepAntet,
    _mntRepNLMounts: _mntRepNLMounts,
    _mntRepNLNote: _mntRepNLNote,
    _mntRepGeom: _mntRepGeom,
    _mntRepSection8: _mntRepSection8,
    _mntRepMassTable: _mntRepMassTable,
    _mntRepMountTable: _mntRepMountTable,
    _mntRepFigure: _mntRepFigure,
    _mntRepStep1Mass: _mntRepStep1Mass,
    _mntRepStep2Stiffness: _mntRepStep2Stiffness,
    _mntRepStep3Static: _mntRepStep3Static,
    _mntRepStep4Torque: _mntRepStep4Torque,
    _mntRepStep5Modal: _mntRepStep5Modal,
    _mntRepConsistency: _mntRepConsistency,
    _mntRepDamping: _mntRepDamping,
    _mntRepZeta: _mntRepZeta,
    _mntRepIsolation: _mntRepIsolation,
    _mntRepFRF: _mntRepFRF,
    _mntRepFRFChart: _mntRepFRFChart,
    _mntRepEngine: _mntRepEngine,
    _mntRepFindCase: _mntRepFindCase,
    _mntRepCritical: _mntRepCritical,
    _mntRepCaseTr: _mntRepCaseTr,
    _mntRepShort: _mntRepShort,
    _mntRepLoadBar: _mntRepLoadBar,
    _mntRepLoadCaseMatrix: _mntRepLoadCaseMatrix,
    _mntRepDeflectionDetail: _mntRepDeflectionDetail,
    _mntRepModeMatrix: _mntRepModeMatrix,
    _mntRepFreqPlacement: _mntRepFreqPlacement,
    _mntRepGearForces: _mntRepGearForces,
    _mntRepDesignLoads: _mntRepDesignLoads,
    _mntRepMaxForce: _mntRepMaxForce,
    _mntRepCompliance: _mntRepCompliance,
    _mntRepModalEnergy: _mntRepModalEnergy,
    _mntRepSoftening: _mntRepSoftening,
    _mntRepModeShapes: _mntRepModeShapes,
    _rF: _rF, _rFs: _rFs, _rE: _rE, _rEsc: _rEsc
  };
}
