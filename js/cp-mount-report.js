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
function _rMountCore(){ return (typeof veMountCore!=='undefined')?veMountCore:(typeof window!=='undefined'?window.veMountCore:null); }

// ═══════════════════ BİLEŞEN PANELİ ═════════════════════════════════════════
function getMntReportPropertiesHTML(node){
  if(!node.data) node.data={};
  var solved = (typeof _veMntLast!=='undefined') && _veMntLast && !_veMntLast.error;
  var nC=0,nM=0;
  if(solved){ nC=(_veMntLast.gather.components||[]).length; nM=(_veMntLast.mounts||[]).length; }
  var html='<div class="sw-panel">';
  html+='<div style="padding:8px 10px; margin-bottom:10px; font-size:0.62rem; line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
      + '<b style="color:var(--text-heading);">Rapor — çökme &amp; titreşim.</b> '
      + 'Çözücü\'nün 6 SD sonuçlarını akademik bir <b>HTML rapora</b> döker (teori + bu modelin sayısal örneği). '
      + 'Dosya <b>tamamen çevrimdışı</b>; matematik ve fontlar gömülüdür — her yerde açılır, yazdırılabilir.</div>';
  if(solved){
    html+='<div style="padding:8px 10px; margin-bottom:10px; font-size:0.64rem; background:var(--bg-tertiary); border:1px solid var(--border-color); color:var(--text-primary);">'
        + '<span style="color:var(--accent-success); font-weight:700;">✓ Model çözüldü</span> — '
        + nC+' bileşen · '+nM+' takoz. Rapor güncel çözüme göre üretilir.</div>';
    // Frekans yerleşimi (opsiyonel) — doldurulursa rapora §8.7 eklenir.
    var inpSt='width:100%; padding:4px 6px; margin-top:3px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); text-align:right;';
    html+='<div style="margin:0 0 10px; padding:9px 10px; background:var(--bg-secondary); border:1px solid var(--border-color);">'
        + '<div style="font-size:0.64rem; font-weight:600; color:var(--text-heading);">Frekans yerleşimi & izolasyon <span style="font-weight:400; color:var(--text-muted);">(opsiyonel)</span></div>'
        + '<div style="font-size:0.56rem; color:var(--text-muted); line-height:1.4; margin:3px 0 6px;">Doldurulursa rapora §8.8 eklenir: ateşleme frekansı (f<sub>ateş</sub>), Kriter 1 (roll modu &lt; %50 f<sub>ateş</sub>) ve Kriter 2 (rölanti iletilebilirliği &lt; %50). ζ = sönüm oranı (boş → 0,001).</div>'
        + '<div style="display:flex; gap:8px;">'
        +   '<label style="flex:1; font-size:0.58rem; color:var(--text-secondary);">Rölanti [d/dk]<input type="number" min="0" step="10" value="'+_rEsc(node.data.idleRpm==null?'':node.data.idleRpm)+'" placeholder="ör: 650" onchange="veMntSet(\''+node.id+'\',\'idleRpm\',this.value)" style="'+inpSt+'"></label>'
        +   '<label style="flex:1; font-size:0.58rem; color:var(--text-secondary);">Silindir sayısı<input type="number" min="1" step="1" value="'+_rEsc(node.data.cylinders==null?'':node.data.cylinders)+'" placeholder="ör: 6" onchange="veMntSet(\''+node.id+'\',\'cylinders\',this.value)" style="'+inpSt+'"></label>'
        +   '<label style="flex:1; font-size:0.58rem; color:var(--text-secondary);">Sönüm ζ<input type="number" min="0" step="0.001" value="'+_rEsc(node.data.zeta==null?'':node.data.zeta)+'" placeholder="0,001" onchange="veMntSet(\''+node.id+'\',\'zeta\',this.value)" style="'+inpSt+'"></label>'
        + '</div></div>';
    html+='<button onclick="veMntGenerateReport(\''+node.id+'\')" style="width:100%; padding:13px 16px; font-size:0.8rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.02em; border-radius:5px;" onmouseover="this.style.filter=\'brightness(1.12)\'" onmouseout="this.style.filter=\'none\'">📄 Raporu Oluştur ve İndir</button>';
  } else {
    html+='<div style="padding:10px 12px; margin-bottom:10px; background:rgba(245,158,11,0.12); border:1px solid var(--accent-warning); color:var(--accent-warning); font-size:0.66rem; line-height:1.5;">'
        + '<b>Önce hesaplayın.</b> Rapor, <b>Çözücü</b> bileşenindeki <b>▶ Hesapla</b> ile üretilen sonuçları kullanır. '
        + 'Çözücü\'yü çalıştırdıktan sonra buraya dönün.</div>';
    html+='<button disabled style="width:100%; padding:13px 16px; font-size:0.8rem; font-weight:700; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:not-allowed; border-radius:5px;">📄 Raporu Oluştur ve İndir</button>';
  }
  html+='<div id="ve-mnt-report-status" style="margin-top:8px; font-size:0.6rem; color:var(--text-muted);"></div>';
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
    return { name:c.name||'bileşen', mass:_rNum(c.mass), x:_rNum(c.cgx), y:_rNum(c.cgy), z:_rNum(c.cgz), pointMass:!!c.pointMass };
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
  h+=_mntRepConsistency(R);
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
    'Kerb Strike L':'Yanal bordür darbesi — sol (3,6g)', 'Kerb Strike R':'Yanal bordür darbesi — sağ (3,6g)',
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
  h+='<p>Otomatik yük durumlarının tamamı (yerçekimi + g-tabanlı manevralar + tahrik torku) için <b>düşey</b> çökme özeti. Her hücre takozun δ_z\'si [mm]; <b>çekme / lift-off</b> mor çerçeveyle, <b>±10 mm aşımı</b> altı çizgiyle işaretlidir. Üç-eksen (δ_x/δ_y/δ_z) ayrıntı için §8.6.</p>';
  h+='<table><caption>Tablo '+_rTbl()+' — Yük durumu × takoz düşey sehim matrisi [mm]</caption>';
  h+='<tr><th>Yük durumu</th>';
  mounts.forEach(function(m){ h+='<th title="'+_rEsc(m.name)+'">'+_rEsc(_mntRepShort(m.name,8))+'</th>'; });
  h+='<th>Σf_z [kN]</th></tr>';
  (R.allCases||[]).forEach(function(rc){
    h+='<tr><td class="l">'+_rEsc(_mntRepCaseTr(rc.name))+'</td>';
    if(!rc.res){ h+='<td colspan="'+(mounts.length+1)+'" class="c">— (K tekil / çözülemedi)</td></tr>'; return; }
    rc.res.perMount.forEach(function(pm){
      var dz=pm.delta[2]*1000, st='';
      if(pm.tension) st+='outline:2px solid #a855f7; outline-offset:-2px;';
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
  h+='<table><caption>Tablo '+_rTbl()+' — Rijit gövde modları: doğal frekanslar ve baskın mod şekli</caption>';
  h+='<tr><th>Mod</th><th>f (k_din) [Hz]</th><th>f (k_stat) [Hz]</th><th>Baskın hareket (mod şekli)</th></tr>';
  var lbl=['u_x','u_y','u_z','θ_x','θ_y','θ_z'];
  modes.forEach(function(md,i){
    var shape='';
    if(md.phi){
      var idx=md.phi.map(function(v,k){return {k:k,a:Math.abs(v)};}).sort(function(a,b){return b.a-a.a;}).slice(0,2);
      shape=idx.map(function(o){ return lbl[o.k]+'='+_rFs(md.phi[o.k],2); }).join('; ');
    }
    var fs = (mstat && mstat[i]) ? _rF(mstat[i].f_Hz,3) : '—';
    var lb=_rEsc(md.label||'—')+(md.phi?' <span style="color:#5a6270">('+shape+')</span>':'');
    h+='<tr><td class="c">'+(i+1)+'</td>'
      +'<td>'+_rF(md.f_Hz,3)+'</td><td>'+fs+'</td>'
      +'<td class="l">'+lb+'</td></tr>';
  });
  h+='</table>';
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
function _mntRepFreqPlacement(R, opts){
  opts=opts||{};
  var rpm=Number(opts.idleRpm), z=Number(opts.cylinders);
  var zeta=Number(opts.zeta); if(!(zeta>0)) zeta=0.001;   // varsayılan — referans analizle uyumlu
  var modes=R.modes||[];
  if(!(rpm>0 && z>0) || !modes.length) return '';   // girdi yoksa bölümü atla
  var core=_rMountCore();
  // 4 zamanlı motorda temel ateşleme mertebesi z/2 → f_ateş = (N/60)·(z/2).
  var fFire=(rpm/60)*(z/2);
  var fRoll=modes[modes.length-1].f_Hz;             // en yüksek rijit gövde modu (mode 6 = roll)

  // ── Kriter 1: Roll modu < %50 ateşleme frekansı  (⟺ f_ateş > 2·f_roll) ──
  var lim1=0.5*fFire, ok1=(fRoll<lim1), r1=(fRoll>0?fFire/fRoll:0);

  // ── Kriter 2: Rölanti iletilebilirliği < %50 (ateşlemeye en yakın = en kötü mod) ──
  var Tmax=0, govIdx=modes.length-1;
  modes.forEach(function(m,i){ var T=core?core.transmissibility(fFire,m.f_Hz,zeta):NaN;
    if(T>Tmax){ Tmax=T; govIdx=i; } });
  var ok2=(Tmax<0.5), govF=modes[govIdx].f_Hz, govLbl=modes[govIdx].label||'—';
  var Tstr=isFinite(Tmax)?(_rF(Tmax*100,1)+'%'):'∞';

  var h='<h3>8.8 Adım 8 — Frekans yerleşimi ve iletilebilirlik</h3>';
  h+='<p>Dört zamanlı motorun rölanti ateşleme frekansı \\( f_{\\text{ateş}}=\\dfrac{N}{60}\\cdot\\dfrac{z}{2} \\); '
    +'girilen değerlerle \\( N='+_rF(rpm,0)+' \\) d/dk, \\( z='+_rF(z,0)+' \\) silindir → '
    +'\\( f_{\\text{ateş}}='+_rF(fFire,1)+' \\) Hz; sönüm oranı \\( \\zeta='+_rF(zeta,4)+' \\).</p>';

  // Kriter 1 rozeti
  var cls1=ok1?'check':'warn';
  h+='<div class="note '+cls1+'"><span class="t">'+(ok1?'Uygun':'Dikkat')+' · Kriter 1 — Roll modu &lt; %50 ateşleme</span>';
  h+='En yüksek rijit gövde (roll) modu <b>'+_rF(fRoll,2)+' Hz</b>, sınır \\( 0{,}5\\,f_{\\text{ateş}}='+_rF(lim1,1)+' \\) Hz\'in ';
  h+= ok1 ? '<b>altındadır</b> (f_ateş/f_roll = '+_rF(r1,2)+' ≥ 2) — ateşleme mertebesinden izole.'
         : '<b>ÜZERİNDEDİR</b> (f_ateş/f_roll = '+_rF(r1,2)+' &lt; 2) — %50 kriterini karşılamıyor; takoz dinamik rijitliklerini düşürmek (mod bandını aşağı taşımak) önerilir.';
  h+='</div>';

  // Kriter 2 rozeti
  var cls2=ok2?'check':'warn';
  h+='<div class="note '+cls2+'"><span class="t">'+(ok2?'Uygun':'Dikkat')+' · Kriter 2 — Rölanti iletilebilirliği &lt; %50</span>';
  h+='Rölanti ateşlemesinde en belirleyici mod <b>'+_rEsc(govLbl)+' ('+_rF(govF,2)+' Hz)</b> için '
    +'\\( T=\\sqrt{\\tfrac{1+(2\\zeta r)^2}{(1-r^2)^2+(2\\zeta r)^2}} \\) = <b>'+Tstr+'</b> ';
  h+= ok2 ? '&lt; %50 — güç grubu rölantide izole bölgede çalışır.'
         : '&ge; %50 — izolasyon yetersiz; mod frekansını ateşlemeden uzaklaştırmak (rijitliği düşürmek) veya sönümü artırmak gerekir.';
  h+='</div>';

  h+='<p style="font-size:0.9em; color:#5a6270;">Not: iletilebilirlik tek-serbestlik yaklaşımıyla, ateşlemeye en yakın (en yüksek T veren) mod üzerinden hesaplanır. Çok küçük ζ ile sonuç neredeyse tümüyle frekans oranına bağlıdır. Değerlendirme temel ateşleme mertebesine göredir; gerçek rölanti devri, baskın tahrik mertebeleri ve sönüm ölçümüyle teyit edilmelidir.</p>';
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
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.72rem; margin:8px 0;">';
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
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.72rem; margin:8px 0;">';
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
  h+='<p>Bu bölüm, §8 analiz sonuçlarını <strong>şirket motor takozu hedef kriterlerine</strong> göre değerlendirir. Roll modu ve rölanti izolasyon kriterleri, motor rölanti devri ve silindir sayısı girdisine bağlıdır (Rapor panelinden girilir).</p>';
  if(!modes.length){ return h+'<div class="note warn"><span class="t">Değerlendirilemedi</span>Modal sonuç yok — çözüm üretilemedi.</div>'; }
  var rpm=Number(opts.idleRpm), z=Number(opts.cylinders);
  var haveIdle=(rpm>0 && z>0), fFire=haveIdle?(rpm/60)*(z/2):NaN;

  // Kriter 1 — PowerPack Roll modu < %50·f_ateş. Roll modu = EN YÜKSEK rijit
  // gövde modu (mod 6); ateşlemeye en yakın ve izolasyon için belirleyici mod
  // budur (§8.8 hesabı ve tasarım tanımıyla tutarlı).
  var rollM=modes[modes.length-1];
  var fRoll=rollM?rollM.f_Hz:NaN, c1;
  if(!haveIdle) c1={st:'wait', bulgu:'Motor rölanti devri + silindir sayısı girin (Rapor paneli)'};
  else { var lim1=0.5*fFire; c1={st:(fRoll<lim1?'ok':'no'), bulgu:'Roll modu (mod '+modes.length+') <b>'+_rF(fRoll,2)+'</b> Hz · sınır %50·f_ateş = '+_rF(lim1,2)+' Hz'}; }

  // Kriter 2 — Rölanti transmissibility < %50. §8.8 ile AYNI hesap: en yüksek
  // mod (ateşlemeye en yakın), sönüm oranı ζ (varsayılan 0,001 ≈ sönümsüz).
  var fMax=modes[modes.length-1].f_Hz, c2;
  var zeta=Number(opts.zeta); if(!(zeta>0)) zeta=0.001;
  var _core=_rMountCore();
  if(!haveIdle) c2={st:'wait', bulgu:'Motor rölanti devri + silindir sayısı girin'};
  else { var rr=fFire/fMax, T=_core?_core.transmissibility(fFire,fMax,zeta):Infinity;
    c2={st:(T<0.5?'ok':'no'),
      bulgu:'f_ateş '+_rF(fFire,1)+' Hz / en yüksek mod '+_rF(fMax,2)+' Hz → r='+_rF(rr,2)+', T=<b>'+(isFinite(T)?_rF(T*100,1)+'%':'∞')+'</b> (§8.8)'}; }

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
  [['1','PowerPack Roll modu','&lt; %50 · f_ateş',c1],['2','Rölanti transmissibility','&lt; %50',c2],
   ['3','Vites başına takoz kuvvetleri','kontrol',c3],['4','Maks tork · 3,5g düşey · 1g yanal · 1g boyuna','kontrol',c4]
  ].forEach(function(r){ h+='<tr><td class="c">'+r[0]+'</td><td class="l">'+r[1]+'</td><td class="l">'+r[2]+'</td><td class="l">'+r[3].bulgu+'</td><td class="c">'+badge(r[3].st)+'</td></tr>'; });
  h+='</table>';

  var sts=[c1.st,c2.st,c3.st,c4.st], anyNo=sts.indexOf('no')>=0, anyWait=sts.indexOf('wait')>=0;
  h+='<div class="note '+(anyNo?'warn':(anyWait?'':'check'))+'"><span class="t">Genel hüküm</span>';
  if(anyNo) h+='Bir veya daha fazla kriter <b>sağlanmıyor / kontrol gerektiriyor</b>; ilgili satırları ve §8 ayrıntısını inceleyin.';
  else if(anyWait) h+='Kuvvet ve yükleme kriterleri sağlanıyor; roll modu ve transmissibility için motor rölanti devri + silindir sayısı girin (Rapor paneli) → tam değerlendirme.';
  else h+='<b>Tüm hedef kriterler sağlanıyor</b> — güç grubu takoz sistemi şirket motor takozu hedeflerini karşılıyor.';
  if(concern.length) h+=' <span style="color:var(--warn);">Not: '+_rEsc(concern.join(', '))+' durum(lar)ında çekme (lift-off) var — takoz seçimi gözden geçirilmeli.</span>';
  h+='</div>';
  h+='<div style="font-size:0.9em; color:#5a6270; margin-top:6px;">Roll modu = en yüksek rijit gövde modu (mod '+(modes.length)+', §8.8). Ateşleme frekansı f_ateş = (N/60)·(z/2). Transmissibility §8.8 formülüyle T=√[(1+(2ζr)²)/((1−r²)²+(2ζr)²)] hesaplanır (ζ varsayılan 0,001; küçük sönümde ≈ sönümsüz). Vites başına kuvvetler §8.9, tasarım yük koşulları (1g yanal dâhil) §8.10\'da ayrıntılıdır.</div>';
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
    _rF: _rF, _rFs: _rFs, _rEsc: _rEsc
  };
}
