// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ — PARAMETRİK ANALİZ · SONUÇ kategorisi (taramanın diyagramları)
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı kararı (2026-10-18): "Önerilerini uygulayalım. Bir bakalım
// kullanışlı mı. Bileşen penceresinin içine entegre edersin." Takoz
// pencerelerinin SONUÇ GÖSTERMEZ kuralının (2026-10-16) TEK istisnası bu
// pencere: tarama bitince Sonuç kategorisi uzlaşı çözümünü ve diyagramları
// taşır; ayrıntılı rapor yine ayrı belgede.
//
// DEPO BELLEKTE, MODELDE DEĞİL: tarama düğüm başına `_MNT_PARAM_SONUC`ta durur
// — proje dosyasına ve geri-al yığınına girmez. Sınır, açıklık ve ağırlık
// değişince özet depodan yeniden kurulur (veMntKatalog.ozet — kapı:
// mount-katalog.test.js → CANLI); model, aday, sabit grup, tolerans ya da
// sürünme değişince tarama ESKİR (imza) ve diyagramlar çizilmez.
//
// ÇİZİM GERÇEK GENİŞLİKTE: gövdenin genişliği pencere açılınca ölçülür
// (veMntParamCizKur, cp-core.js), diyagram o genişlikte 1:1 kurulur.
// Çizici DOM'suz: js/mount-param-ciz.js.
// ════════════════════════════════════════════════════════════════════════════

var _MNT_PARAM_SONUC = {};      // düğüm → { D, imza, M, O, mevcut, kose:{}, Ok:{}, bellek, html }
var _MNT_PARAM_GEN = {};        // düğüm → çizimin genişliği (gövdenin son ölçüsü)

// İMZA — taramanın ölçüsünü değiştiren her girdi: model (kütle, takoz,
// tork), çözüm modu ve ζ, f_ateş, adaylar ve kütüphane girdileri, sabit
// gruplar, tolerans ve sürünme. Sınır, açıklık ve ağırlık imzada YOK: onlar
// yalnız hükmü değiştirir.
function _mntParamImza(H){
  var c=veMntKatalog.baglam(H.ctx), sv=H.M.solver || { data:{} };
  return JSON.stringify([H.M.gather, (sv.data && sv.data.solveMode) || 'auto', _mntZetaOf(sv), H.M.fAtes,
    H.aday.map(function(a){ return [a.key, a.e]; }), Object.keys(H.sabit || {}).sort(),
    c.acik.tolerans ? c.s.tolerans : 0, c.s.surunme]);
}
function _mntParamSonucKaydet(nodeId, H, O, D){
  var nl=H.M.G.map(function(){ return null; }), o1=null, o2=null;
  try { o1=O.olc1(nl); o2=o1 ? O.olc2(nl) : null; } catch(e){}
  _MNT_PARAM_SONUC[nodeId]={ D:D, imza:_mntParamImza(H), M:H.M, O:O, mevcut:{ o1:o1, o2:o2 },
                             kose:{}, Ok:{}, bellek:null, html:null };
}
// Proje değişince (topology.js → veResetSubtopoNav) bütün taramalar ve
// görünüm seçimleri unutulur — kimlikler yeni projede yeniden kullanılır.
function veMntParamUnut(){
  [_MNT_PARAM_SONUC, _MNT_PARAM_GEN, _MNT_PARAM_KESIT, _MNT_PARAM_SECIM, _MNT_PARAM_KAM].forEach(function(o){
    Object.keys(o).forEach(function(k){ delete o[k]; });
  });
}
// Düğümün taraması: { ent, taze } | null.
function _mntParamSonucDurum(nodeId, H){
  var ent=_MNT_PARAM_SONUC[nodeId];
  return ent ? { ent:ent, taze:_mntParamImza(H)===ent.imza } : null;
}

// Özet ve hüküm bugünkü sınırlarla — sınırlar değişmedikçe bellekten.
function _mntParamOzet(ent, c){
  var k=JSON.stringify([c.s, c.acik]);
  if(!ent.bellek || ent.bellek.anahtar!==k){
    var Hk=veMntKatalog.hukumler(ent.D, c);
    ent.bellek={ anahtar:k, Hk:Hk, S:veMntKatalog.ozet(ent.D, c, Hk) };
  }
  return ent.bellek;
}
// Bir kombinasyonun (idx; −1 mevcut tasarım) ±tolerans köşeleriyle ölçümü —
// modlar ve köşeler (bıyık, mod yerleşimi) bundan; kombinasyon başına bir kez.
function _mntParamKose(ent, idx, tol){
  var k=idx+'|'+tol;
  if(!(k in ent.kose)){
    var Ok=ent.Ok[tol] || (ent.Ok[tol]=_mntParamOlcucu(ent.M, veMntKatalog.baglam({ fAtes:ent.M.fAtes, s:{ tolerans:tol }, acik:{ tolerans:true } })));
    var t=idx<0 ? ent.M.G.map(function(){ return null; }) : ent.D.tipler(idx), o=null;
    try { o=Ok.olc1(t); } catch(e){ o=null; }
    ent.kose[k]=o;
  }
  return ent.kose[k];
}
function _mntPrmSehim(o){ var m=0; ((o && o.dz) || []).forEach(function(v){ if(Math.abs(v)>m) m=Math.abs(v); }); return m; }
function _mntPrmNo(Q){ return Q.zorunlu ? 'K'+Q.no : Q.no; }
function _mntPrmKisit(k){ for(var i=0;i<veMntKatalog.KISITLAR.length;i++) if(veMntKatalog.KISITLAR[i].k===k) return veMntKatalog.KISITLAR[i]; return null; }
function _mntPrmKesinBit(){
  var b=0;
  veMntKatalog.KISITLAR.forEach(function(Q, i){ if(Q.zorunlu) b|=(1<<i); });
  return b;
}
function _mntPrmModAdi(l){ return (typeof veMntBrief!=='undefined' && veMntBrief.modeShort) ? veMntBrief.modeShort(l) : String(l||''); }

// ── GÖRÜNÜM MODELLERİ — depo + özet → çizicinin girdisi ─────────────────────
// D11 · Pareto cephesi: çözülen bütün kombinasyonlar sınıflarıyla (kesin
// kriterde elenen · ek kısıtta elenen · uygun), seyreltilmiş — elenen en çok
// ~2500, ek kısıtta elenen ve uygun en çok ~1500 nokta; cephe her zaman.
function _mntPrmV11(ent, S, Hk, c){
  var D=ent.D, kb=_mntPrmKesinBit(), N=D.N, sn=new Int8Array(N), say=[0, 0, 0], dM=0, tM=0, x;
  for(x=0;x<N;x++){
    if(D.d1[x]!==1){ sn[x]=-1; continue; }
    var m=Hk.m[x];
    sn[x]=(m & kb) ? 0 : (m || D.d2[x]!==1) ? 1 : 2;
    say[sn[x]]++;
    if(D.d[x]>dM) dM=D.d[x];
    if(D.T[x]>tM) tM=D.T[x];
  }
  var xMax=Math.min(dM, 3*c.s.sehimUst), yMax=Math.min(tM*100, 100);
  var adm=[Math.max(1, Math.ceil(say[0]/2500)), Math.max(1, Math.ceil(say[1]/1500)), Math.max(1, Math.ceil(say[2]/1500))];
  var sy=[0, 0, 0], nok=[], dis=0, SN=['k', 'e', 'u'];
  for(x=0;x<N;x++){
    var s=sn[x];
    if(s<0) continue;
    if(D.d[x]>xMax || D.T[x]*100>yMax){ dis++; continue; }
    if((sy[s]++)%adm[s]===0) nok.push({ x:D.d[x], y:D.T[x]*100, s:SN[s], i:x });
  }
  var cephe=S.cephe.map(function(i){ return { x:D.d[i], y:D.T[i]*100, i:i }; }).sort(function(a, b){ return a.x-b.x || b.y-a.y; });
  var bir=S.sira[0], tol=c.s.tolerans, biyik=[];
  S.sira.slice(0, 10).forEach(function(r){
    var o=_mntParamKose(ent, r.idx, tol);
    if(o && o.sert && o.yumusak) biyik.push({ a:[_mntPrmSehim(o.yumusak), o.yumusak.T*100], b:[_mntPrmSehim(o.sert), o.sert.T*100], i:r.idx });
  });
  var m1=ent.mevcut.o1;
  return {
    nokta:nok, cephe:cephe, biyik:biyik, dis:dis, xMax:xMax, yMax:yMax, say:say,
    uzlasi:bir ? { x:D.d[bir.idx], y:D.T[bir.idx]*100, i:bir.idx, ad:S.uygunN ? 'Uzlaşı' : 'Sıra 1' } : null,
    mevcut:m1 ? { x:_mntPrmSehim(m1), y:m1.T*100, ip:'Mevcut tasarım\nT %'+_mntS(m1.T*100, 1)+' · δs '+_mntS(_mntPrmSehim(m1), 2)+' mm' } : null,
    e1:c.acik.sehimAlt ? c.s.sehimAlt : null, e2:c.acik.sehim ? c.s.sehimUst : null, k2:veMntKatalog.K2_T*100
  };
}
// Uygun olmayan, ihlal toplamı en küçük n kombinasyon (iki aşaması ölçülmüş).
function _mntPrmYakin(ent, Hk, n){
  var D=ent.D, L=[];
  for(var x=0;x<D.N;x++){
    if(D.d1[x]!==1 || D.d2[x]!==1 || !Hk.m[x]) continue;
    var v=Hk.v1[x]+Hk.v2[x];
    if(L.length<n || v<L[L.length-1][0]){
      L.push([v, x]); L.sort(function(a, b){ return a[0]-b[0] || a[1]-b[1]; });
      if(L.length>n) L.pop();
    }
  }
  return L.map(function(e){ return e[1]; });
}
// Kombinasyonun bozduğu kısıtların numaraları (en çok iki, fazlası "…").
function _mntPrmBozuk(Hk, x){
  var b=[];
  veMntKatalog.KISITLAR.forEach(function(Q, i){ if(Hk.m[x] & (1<<i)) b.push(_mntPrmNo(Q)); });
  return b.length>2 ? b.slice(0, 2).join(' · ')+' …' : b.join(' · ');
}
// D7 · Mod yerleşimi: mevcut tasarım, sıranın ilk beşi; uygun beşten azsa
// en az ihlalli YAKIN tasarımlar (adında bozduğu kısıtlar), ±tolerans köşeleriyle.
function _mntPrmV7(ent, S, c, Hk){
  var K=veMntKatalog, tol=c.s.tolerans, satir=[];
  var ekle=function(ad, idx, vurgu){
    var o=_mntParamKose(ent, idx, tol);
    if(!o || !o.f) return;
    var lab=(o.modes || []).map(function(m){ return m.label; });
    satir.push({ ad:ad, f:o.f, vurgu:!!vurgu,
      dik:lab.map(function(l){ return /^(bounce|pitch)/.test(String(l || '')); }),
      ip:o.f.map(function(f, i){ return ad+' · '+(i+1)+'. mod\n'+_mntS(f, 2)+' Hz · '+_mntPrmModAdi(lab[i]); }),
      kose:(o.sert && o.yumusak) ? { a:o.yumusak.f, b:o.sert.f } : null });
  };
  ekle('Mevcut', -1);
  S.sira.slice(0, 5).forEach(function(r, k){
    ekle(S.uygunN ? (k===0 ? 'Uzlaşı' : 'Sıra '+(k+1)) : 'Sıra '+(k+1)+' · '+_mntPrmBozuk(Hk, r.idx), r.idx, k===0);
  });
  if(S.uygunN && S.uygunN<5) _mntPrmYakin(ent, Hk, 5-S.uygunN).forEach(function(x, k){ ekle('Yakın '+(k+1)+' · '+_mntPrmBozuk(Hk, x), x); });
  var k1=K.K1_ORAN*c.fAtes, fm=k1;
  satir.forEach(function(r){ r.f.forEach(function(f){ if(f>fm) fm=f; }); if(r.kose) r.kose.b.forEach(function(f){ if(f>fm) fm=f; }); });
  return { satir:satir, e3:c.acik.altMod ? c.s.altMod : null, bant:K.K1B, k1:k1, k1a:K.K1A_HZ, xMax:Math.max(fm*1.04, k1*1.15) };
}
// D9 · Bağlayıcı kısıtlar.
function _mntPrmV9(ent, c, Hk){
  var B=veMntKatalog.baglayici(ent.D, c, Hk);
  return { n:B.n, uygun:B.uygun, kisit:B.kisit.map(function(q){
    var Q=_mntPrmKisit(q.k);
    return { no:_mntPrmNo(Q), ad:Q.ad, red:q.red, tek:q.tek, ip:_mntPrmNo(Q)+' · '+Q.ad };
  }) };
}
// D10 · Sınır duyarlılığı: açık ve sınırı olan her ek kısıt; pencere biriminde.
// Aralık sınırın çevresi (0,6–1,6 katı) ve ölçülerin yayıldığı yer (en çok 3 katı).
var _MNT_PRM_KISA = { sehimAlt:'δ_s alt', sehim:'δ_s üst', altMod:'f_min', kapasite:'Kapasite', ayrisma:'KED',
                      isletme:'δ işletme', durdurucu:'δ sürünme', darbe:'Darbe' };
function _mntPrmV10(ent, c, Hk){
  var K=veMntKatalog, P=[];
  K.KISITLAR.forEach(function(Q){
    if(Q.zorunlu || !c.acik[Q.k]) return;
    var d=K.duyarlilik(ent.D, c, Q.k, Hk);
    if(!d) return;
    var E=_MNT_PARAM_EK[Q.k], y=_MNT_PARAM_YUZDE[E[2]] ? 100 : 1;
    var v=d.deger.map(function(a){ return a*y; }), L=d.sinir*y;
    var lo=Math.min(0.6*L, v.length ? v[0] : L), hi=Math.max(1.6*L, v.length ? Math.min(v[v.length-1], 3*L) : L);
    var pay=(hi-lo)*0.04;
    P.push({ no:Q.no, ad:Q.ad+' ['+E[1]+']', kisa:_MNT_PRM_KISA[Q.k]+' ['+E[1]+']', yon:d.yon, deger:v, na:d.na, sinir:L,
             xMin:Math.max(0, lo-pay), xMax:hi+pay });
  });
  return { panel:P };
}
// D8 · Ana etkiler: sıranın birincisinden yalnız bir grubun tipi değişir.
function _mntPrmKz(a){ return _mntNum(a && a.e ? a.e.sz : NaN, NaN); }
// Aday sıraları statik düşey rijitliğe göre (eksenlerin sırası).
function _mntPrmSira(D){
  var A=D.adaylar;
  return A.map(function(a, i){ return i; }).sort(function(p, q){
    var a=_mntPrmKz(A[p]), b=_mntPrmKz(A[q]);
    return (Number.isFinite(a) ? a : Infinity)-(Number.isFinite(b) ? b : Infinity) || p-q;
  });
}
function _mntPrmV8(ent, S, c, Hk){
  var D=ent.D, K=veMntKatalog, bir=S.sira[0];
  if(!bir) return null;
  var A=D.adaylar, sira=_mntPrmSira(D);
  var kod0=D.kod(bir.idx);
  return {
    tip:sira.map(function(i){ return { kz:_mntPrmKz(A[i]) }; }),
    seri:D.taranan.map(function(g, j){
      var T=[], d=[], ok=[], ix=[], uz=null;
      sira.forEach(function(ai, p){
        var kod=kod0.slice(); kod[j]=ai;
        var x=D.indeks(kod), coz=D.d1[x]===1;
        T.push(coz ? D.T[x]*100 : NaN); d.push(coz ? D.d[x] : NaN);
        ok.push(K.uygunMu(D, Hk, x)); ix.push(x);
        if(ai===kod0[j]) uz=p;
      });
      return { no:ent.M.G[g].no, ad:ent.M.G[g].ad, T:T, d:d, ok:ok, i:ix, uz:uz };
    }),
    k2:K.K2_T*100, e1:c.acik.sehimAlt ? c.s.sehimAlt : null, e2:c.acik.sehim ? c.s.sehimUst : null
  };
}

// KESİT — iki taranan grup eksende (k_z sırasıyla), öteki taranan gruplar
// sabit: varsayılan sıranın birincisinin tipi. Seçim GÖRÜNÜM durumudur
// (VE_MNT_LIB_EKSEN gibi): modelde değil — kaydedilmez, geri alınmaz.
var _MNT_PARAM_KESIT = {};       // düğüm → { a, b, sabit:{ taranan sırası: aday sırası } }
function _mntPrmKesit(nodeId, ent, S){
  var D=ent.D, n=D.taranan.length;
  if(n<2 || !S.sira[0]) return null;
  var st=_MNT_PARAM_KESIT[nodeId] || {}, a=st.a, b=st.b;
  if(!(a>=0 && a<n && b>=0 && b<n && a!==b)){ a=0; b=n-1; }
  var kod0=D.kod(S.sira[0].idx), sabit={}, j;
  for(j=0;j<n;j++) if(j!==a && j!==b) sabit[j]=(st.sabit && st.sabit[j]>=0 && st.sabit[j]<D.nA) ? st.sabit[j] : kod0[j];
  var sira=_mntPrmSira(D), m=sira.length, ix=new Int32Array(m*m), uz=null, u=S.sira[0].idx;
  for(var y=0;y<m;y++) for(var x=0;x<m;x++){
    var kod=kod0.slice();
    Object.keys(sabit).forEach(function(f){ kod[f]=sabit[f]; });
    kod[a]=sira[x]; kod[b]=sira[y];
    var q=y*m+x;
    ix[q]=D.indeks(kod);
    if(ix[q]===u) uz=[x, y];
  }
  var no=function(k){ return ent.M.G[D.taranan[k]].no; };
  return { a:a, b:b, sabit:sabit, sira:sira, n:m, ix:ix, uz:uz, xNo:no(a), yNo:no(b),
           kz:sira.map(function(i){ return _mntPrmKz(D.adaylar[i]); }) };
}
// Kesitin seçicisi: eksen çifti ve sabit grupların tipi (k_z sırasıyla).
function _mntPrmKesitSecici(nodeId, ent, K){
  var D=ent.D, n=D.taranan.length, G=ent.M.G, no=function(k){ return G[D.taranan[k]].no; };
  var cift='';
  for(var a=0;a<n;a++) for(var b=a+1;b<n;b++)
    cift+='<option value="'+a+','+b+'"'+(a===K.a && b===K.b ? ' selected' : '')+'>'+no(a)+' × '+no(b)+'</option>';
  var h='<label class="ve-fp-f"><span class="ve-fp-l">Eksenler</span><select class="ve-fp-sel"'
    + ' onchange="veMntParamKesit(\''+nodeId+'\',\'cift\',this.value)">'+cift+'</select></label>';
  Object.keys(K.sabit).forEach(function(f){
    var o=K.sira.map(function(i){
      var e=D.adaylar[i];
      return '<option value="'+i+'"'+(Number(K.sabit[f])===i ? ' selected' : '')+'>'+_mntEsc(e.name)+' · '+_mntS(_mntPrmKz(e), 0)+'</option>';
    }).join('');
    h+='<label class="ve-fp-f"><span class="ve-fp-l">Grup '+no(Number(f))+'</span><select class="ve-fp-sel"'
      + ' onchange="veMntParamKesit(\''+nodeId+'\',\''+f+'\',this.value)">'+o+'</select></label>';
  });
  return '<div class="ve-pd-kesit">'+_mntIzgara(Math.min(3, 1+Object.keys(K.sabit).length), h)+'</div>';
}
function veMntParamKesit(nodeId, alan, deger){
  var st=_MNT_PARAM_KESIT[nodeId] || (_MNT_PARAM_KESIT[nodeId]={});
  if(alan==='cift'){ var p=String(deger).split(',').map(Number); st.a=p[0]; st.b=p[1]; }
  else { st.sabit=Object.assign({}, st.sabit || {}); st.sabit[alan]=Number(deger); }
  var ent=_MNT_PARAM_SONUC[nodeId];
  if(ent) ent.html=null;
  if(typeof veMntPencereTazele==='function') veMntPencereTazele();
  if(_MNT_PARAM_TAM && _MNT_PARAM_TAM.nodeId===nodeId) _MNT_PARAM_TAM.kur();
}
// D5 · Kısıt haritaları: açık kısıt başına bir harita ve kesişimi.
function _mntPrmV5(ent, Z, K){
  var D=ent.D, Hk=Z.Hk, c=Z.S.ctx, n=K.n, P=[], bos=[];
  var coz=function(x, asama){ return D.d1[x]===1 && (asama===1 || D.d2[x]===1); };
  veMntKatalog.KISITLAR.forEach(function(Q, i){
    if(!c.acik[Q.k]) return;
    var gec=new Uint8Array(n*n), say=0;
    for(var q=0;q<n*n;q++){
      var x=K.ix[q];
      if(!coz(x, Q.asama)) gec[q]=2;
      else if(!(Hk.m[x] & (1<<i))){ gec[q]=1; say++; }
    }
    var nc=0;
    for(var r=0;r<n*n;r++) if(gec[r]!==2) nc++;
    if(say<nc) P.push({ ad:_mntPrmNo(Q), say:say, gec:gec });
    else bos.push(_mntPrmNo(Q));                          // kesitin her hücresinde sağlıyor
  });
  var hep=new Uint8Array(n*n), sh=0;
  for(var q=0;q<n*n;q++){
    var x=K.ix[q];
    if(!coz(x, 2)) hep[q]=2;
    else if(!Hk.m[x]){ hep[q]=1; sh++; }
  }
  P.push({ ad:'Hepsi', say:sh, gec:hep, hepsi:true });
  return { n:n, kz:K.kz, panel:P, bos:bos, uz:K.uz, ix:K.ix };
}
// D4 · İletilebilirlik haritası: T, frekans ve sehim sınırları, kesin ve uygun hücreler.
var _MNT_PRM_SINIR4 = [['k1', 've-pd-b1'], ['sehimAlt', 've-pd-b2'], ['sehim', 've-pd-b3'], ['altMod', 've-pd-b4']];
function _mntPrmV4(ent, Z, K){
  var D=ent.D, Hk=Z.Hk, c=Z.S.ctx, n=K.n, N=n*n, kb=_mntPrmKesinBit();
  var T=new Float64Array(N), kesin=new Uint8Array(N), uygun=new Uint8Array(N);
  for(var q=0;q<N;q++){
    var x=K.ix[q], coz=D.d1[x]===1;
    T[q]=coz ? D.T[x]*100 : NaN;
    kesin[q]=(coz && !(Hk.m[x] & kb)) ? 1 : 0;
    uygun[q]=veMntKatalog.uygunMu(D, Hk, x) ? 1 : 0;
  }
  var sinir=_MNT_PRM_SINIR4.filter(function(b){ return c.acik[b[0]]; }).map(function(b){
    var i=veMntKatalog.KISITLAR.indexOf(_mntPrmKisit(b[0])), gec=new Uint8Array(N);
    for(var q=0;q<N;q++){ var x=K.ix[q]; gec[q]=(D.d1[x]===1 && !(Hk.m[x] & (1<<i))) ? 1 : 0; }
    return { ad:_mntPrmNo(_mntPrmKisit(b[0])), s:b[1], gec:gec };
  });
  return { n:n, kz:K.kz, T:T, sinir:sinir, kesin:kesin, uygun:uygun, uz:K.uz, ix:K.ix,
           xAd:K.xNo+' · k_z [N/mm]', yAd:K.yNo+' · k_z [N/mm]' };
}

// ── 3B — kamera ve seçimler GÖRÜNÜM durumu (modelde değil) ──────────────────
var _MNT_PARAM_KAM = {};        // 'düğüm|diyagram' → { az, el }
var _MNT_PARAM_SECIM = {};      // düğüm → { d3:'T'|'d'|'f', d1k1:bool }
var _MNT_PRM_KAM0 = { az:235, el:24 };
function _mntPrmKam(nodeId, pd){ return _MNT_PARAM_KAM[nodeId+'|'+pd] || _MNT_PRM_KAM0; }
function _mntPrmSecim(nodeId){ return _MNT_PARAM_SECIM[nodeId] || (_MNT_PARAM_SECIM[nodeId]={ d3:'T', d1k1:false }); }
function _mntPrmEks(ad, a, b, hedef){
  var I=veMntParamCiz.isaretler(a, b, hedef || 4);
  return { ad:ad, min:a, max:b, I:I };
}
// Kategorik eksen: aday sırası, yazısı k_z (seyreltilmiş).
function _mntPrmKatEks(ad, kz){
  var n=kz.length, her=Math.max(1, Math.ceil(n/5)), v=[], kat=[];
  for(var i=0;i<n;i+=her){ v.push(i); kat.push(_mntS(kz[i], 0)); }
  if(v[v.length-1]!==n-1){ v.push(n-1); kat.push(_mntS(kz[n-1], 0)); }
  return { ad:ad, min:0, max:Math.max(1, n-1), I:{ v:v, b:0 }, kat:kat };
}
// D2 · Kısıt penceresi: δs × f_maks × T; kutu, ek kısıtların ve kesin
// kriterlerin bıraktığı pencere (E1–E2 · K1 · K2).
function _mntPrmV2(ent, Z, c, kam){
  var D=ent.D, Hk=Z.Hk, S=Z.S, kb=_mntPrmKesinBit(), N=D.N, x;
  var say=[0, 0, 0], dM=0, tM=0, fA=Infinity, fB=0, k1=veMntKatalog.K1_ORAN*c.fAtes;
  var sn=new Int8Array(N);
  for(x=0;x<N;x++){
    if(D.d1[x]!==1){ sn[x]=-1; continue; }
    var m=Hk.m[x];
    sn[x]=(m & kb) ? 0 : (m || D.d2[x]!==1) ? 1 : 2;
    say[sn[x]]++;
    dM=Math.max(dM, D.d[x]); tM=Math.max(tM, D.T[x]); fA=Math.min(fA, D.fMax[x]); fB=Math.max(fB, D.fMax[x]);
  }
  var xM=Math.min(dM, 3*c.s.sehimUst), zM=Math.min(tM*100, 100), yA=Math.floor(fA), yB=Math.ceil(Math.min(fB, 2.5*k1));
  var adm=[Math.max(1, Math.ceil(say[0]/1200)), Math.max(1, Math.ceil(say[1]/1200)), Math.max(1, Math.ceil(say[2]/1200))];
  var sy=[0, 0, 0], nok=[], SN=[['ve-pd-n0', 1.6], ['ve-pd-n1', 2.2], ['ve-pd-n2', 3]];
  for(x=0;x<N;x++){
    var q=sn[x];
    if(q<0 || (sy[q]++)%adm[q]) continue;
    nok.push({ p:[D.d[x], D.fMax[x], D.T[x]*100], s:SN[q][0], r:SN[q][1], i:x });
  }
  var isaret=[], bir=S.sira[0], m1=ent.mevcut.o1;
  if(m1) isaret.push({ p:[_mntPrmSehim(m1), Math.max.apply(null, m1.f), m1.T*100], s:'ve-pd-mev', ad:'Mevcut', r:6.5,
                       ip:'Mevcut tasarım\nT %'+_mntS(m1.T*100, 1)+' · δs '+_mntS(_mntPrmSehim(m1), 2)+' mm' });
  if(bir) isaret.push({ p:[D.d[bir.idx], D.fMax[bir.idx], D.T[bir.idx]*100], s:'ve-pd-uz', ad:S.uygunN ? 'Uzlaşı' : 'Sıra 1', r:7, i:bir.idx });
  return {
    ad:'Kısıt penceresi', kam:kam, say:say, nokta:nok, isaret:isaret,
    eks:[_mntPrmEks('δ_s [mm]', 0, xM), _mntPrmEks('f_maks [Hz]', yA, yB), _mntPrmEks('T [%]', 0, zM)],
    kutu:{ a:[c.acik.sehimAlt ? c.s.sehimAlt : 0, yA, 0], b:[c.acik.sehim ? c.s.sehimUst : xM, k1, veMntKatalog.K2_T*100] }
  };
}
// D3 · Tepki yüzeyi: kesitte seçili büyüklüğün yüzeyi (T · δs · f_maks).
var _MNT_PRM_D3 = { T:['T [%]', 'T'], d:['δ_s [mm]', 'δs'], f:['f_maks [Hz]', 'f maks'] };
function _mntPrmV3(ent, Z, K, nic, kam){
  var D=ent.D, Hk=Z.Hk, S=Z.S, c=S.ctx, n=K.n, z=new Float64Array(n*n), a=Infinity, b=-Infinity;
  for(var q=0;q<n*n;q++){
    var x=K.ix[q], coz=D.d1[x]===1;
    z[q]=!coz ? NaN : nic==='T' ? D.T[x]*100 : nic==='d' ? D.d[x] : D.fMax[x];
    if(Number.isFinite(z[q])){ a=Math.min(a, z[q]); b=Math.max(b, z[q]); }
  }
  if(!(b>=a)) return null;
  var ref=nic==='T' ? veMntKatalog.K2_T*100 : nic==='d' ? (c.acik.sehim ? c.s.sehimUst : null) : veMntKatalog.K1_ORAN*c.fAtes;
  var lo=nic==='T' ? 0 : Math.floor(a), hi=Math.max(b, ref || b);
  var sinif=function(v){
    if(nic==='T') return 've-pd-t'+veMntParamCiz.T_SINIF.filter(function(t){ return v>=t; }).length;
    return 've-pd-t'+Math.min(5, Math.floor((v-a)/((b-a) || 1)*6));
  };
  var dort=[], nok=[], kb=_mntPrmKesinBit();
  for(var j=0;j<n-1;j++) for(var i=0;i<n-1;i++){
    var k4=[j*n+i, j*n+i+1, (j+1)*n+i+1, (j+1)*n+i];
    if(k4.some(function(q){ return !Number.isFinite(z[q]); })) continue;
    var ort=(z[k4[0]]+z[k4[1]]+z[k4[2]]+z[k4[3]])/4;
    dort.push({ p:[[i, j, z[k4[0]]], [i+1, j, z[k4[1]]], [i+1, j+1, z[k4[2]]], [i, j+1, z[k4[3]]]], s:'ve-pd-yz '+sinif(ort), i:K.ix[k4[0]] });
  }
  for(var q2=0;q2<n*n;q2++){
    var x2=K.ix[q2];
    if(!Number.isFinite(z[q2])) continue;
    if(veMntKatalog.uygunMu(D, Hk, x2)) nok.push({ p:[q2%n, Math.floor(q2/n), z[q2]], s:'ve-pd-n3', r:3, i:x2 });
    else if(!(Hk.m[x2] & kb)) nok.push({ p:[q2%n, Math.floor(q2/n), z[q2]], s:'ve-pd-kesin', r:2.4, i:x2 });
  }
  var isaret=K.uz ? [{ p:[K.uz[0], K.uz[1], z[K.uz[1]*n+K.uz[0]]], s:'ve-pd-uz', ad:S.uygunN ? 'Uzlaşı' : 'Sıra 1', r:7, i:S.sira[0].idx }] : [];
  return {
    ad:'Tepki yüzeyi', kam:kam, dortgen:dort, nokta:nok, isaret:isaret, duzlem:ref!=null ? { z:ref } : null,
    eks:[_mntPrmKatEks(K.xNo+' · k_z', K.kz), _mntPrmKatEks(K.yNo+' · k_z', K.kz), _mntPrmEks(_MNT_PRM_D3[nic][0], lo, hi)]
  };
}
// D1 · Tasarım uzayı: üç taranan grubun tipi eksende; öteki taranan gruplar
// kesitteki değerlerinde. Kesin kriterde elenenlerden K1'de elenen ayrı ve
// seçimle görünür (çoğunluk odur).
function _mntPrmV1(nodeId, ent, Z, K, kam){
  var D=ent.D, Hk=Z.Hk, S=Z.S, n=D.taranan.length;
  if(n<3 || !K) return null;
  var ek=[K.a, K.b];
  for(var j=0;j<n && ek.length<3;j++) if(ek.indexOf(j)<0) ek.push(j);
  var sira=K.sira, m=sira.length, kod0=D.kod(S.sira[0].idx), sec=_mntPrmSecim(nodeId);
  var b1=1<<veMntKatalog.KISITLAR.indexOf(_mntPrmKisit('k1')), kb=_mntPrmKesinBit();
  var say=[0, 0, 0, 0], nok=[], tumu=[];
  for(var a=0;a<m;a++) for(var b=0;b<m;b++) for(var c3=0;c3<m;c3++){
    var kod=kod0.slice();
    Object.keys(K.sabit).forEach(function(f){ if(ek.indexOf(Number(f))<0) kod[f]=K.sabit[f]; });
    kod[ek[0]]=sira[a]; kod[ek[1]]=sira[b]; kod[ek[2]]=sira[c3];
    var x=D.indeks(kod);
    if(D.d1[x]!==1) continue;
    var mm=Hk.m[x], q=(mm & b1) ? 0 : (mm & kb) ? 1 : (mm || D.d2[x]!==1) ? 2 : 3;
    say[q]++;
    tumu.push([a, b, c3, q, x]);
  }
  var adm=Math.max(1, Math.ceil(say[0]/1500)), sy=0, SN=[['ve-pd-n0', 1.6], ['ve-pd-n0 k', 2], ['ve-pd-n1', 2.4], ['ve-pd-n2', 3.4]];
  tumu.forEach(function(t){
    if(t[3]===0 && (!sec.d1k1 || (sy++)%adm)) return;
    nok.push({ p:[t[0], t[1], t[2]], s:SN[t[3]][0], r:SN[t[3]][1], i:t[4] });
  });
  var isaret=[], u=S.sira[0].idx;
  tumu.forEach(function(t){ if(t[4]===u) isaret.push({ p:[t[0], t[1], t[2]], s:'ve-pd-uz', ad:S.uygunN ? 'Uzlaşı' : 'Sıra 1', r:7, i:u }); });
  var no=function(k){ return ent.M.G[D.taranan[k]].no; };
  return { ad:'Tasarım uzayı', kam:kam, nokta:nok, isaret:isaret, say:say,
           eks:[_mntPrmKatEks(no(ek[0])+' · k_z', K.kz), _mntPrmKatEks(no(ek[1])+' · k_z', K.kz), _mntPrmKatEks(no(ek[2])+' · k_z', K.kz)] };
}
function veMntParamSec(nodeId, alan, deger){
  var sec=_mntPrmSecim(nodeId);
  sec[alan]=deger;
  var ent=_MNT_PARAM_SONUC[nodeId];
  if(ent) ent.html=null;
  if(typeof veMntPencereTazele==='function') veMntPencereTazele();
  if(_MNT_PARAM_TAM && _MNT_PARAM_TAM.nodeId===nodeId) _MNT_PARAM_TAM.kur();
}

// ── KATEGORİ ────────────────────────────────────────────────────────────────
// Tarama yoksa kategori yok; eskimiş taramada diyagram yerine durumu.
function _mntParamSonucKat(node, H){
  var T=_mntParamSonucDurum(node.id, H);
  if(!T) return null;
  if(!T.taze) return { k:'sonuc', ad:'Sonuç', sonuc:true, durum:{ d:'eksik', neden:'Taramadan sonra girdi değişti' },
    govde:'<div id="ve-mnt-prm-sonuc-'+node.id+'" data-tazele>'+_mntBolum('Sonuç', '', _mntNot('Taramadan sonra girdi değişti', 'warn'))+'</div>' };
  return { k:'sonuc', ad:'Sonuç', sonuc:true, durum:{ d:'ok' }, govde:_mntParamSonucHTML(node, H, T.ent) };
}

// DİYAGRAMLAR — pencerede kabın genişliğinde, tam ekranda büyük; ikisi de
// AYNI çağrıdan (_mntPrmCiz). Sıra: genel bakış → tasarımın modları → neyin
// bağladığı → sınırın etkisi → tip değişiminin etkisi.
var _MNT_PRM_DIYAGRAM = [['d11', 'Pareto cephesi'], ['d7', 'Mod yerleşimi'], ['d9', 'Bağlayıcı kısıtlar'],
                         ['d10', 'Sınır duyarlılığı'], ['d8', 'Ana etkiler'], ['d5', 'Kısıt haritaları'],
                         ['d4', 'İletilebilirlik haritası'], ['d2', 'Kısıt penceresi'], ['d3', 'Tepki yüzeyi'],
                         ['d1', 'Tasarım uzayı']];
var _MNT_PRM_3B = { d2:true, d3:true, d1:true };
var _MNT_PARAM_TAM = null;      // açık tam ekran: { nodeId, pd, kur }
function _mntPrmCiz(pd, ent, Z, c, o, nodeId){
  var C=veMntParamCiz, S=Z.S, Hk=Z.Hk, tol='±%'+_mntS(c.s.tolerans*100, 0)+' rijitlik';
  if(pd==='d11'){
    var v=_mntPrmV11(ent, S, Hk, c);
    return { svg:C.pareto(v, o).svg, lj:C.gosterge([
      { s:'ve-pd-n0', ad:'Kesin kriterde elenen', n:v.say[0], r:2 }, { s:'ve-pd-n1', ad:'Ek kısıtta elenen', n:v.say[1], r:2.5 },
      { s:'ve-pd-n2', ad:'Uygun', n:v.say[2] }, { s:'ve-pd-cephe', sekil:'cizgi', ad:'Pareto cephesi', n:S.paretoN },
      { s:'ve-pd-uz', sekil:'halka', ad:S.uygunN ? 'Uzlaşı' : 'Sıra 1' }, { s:'ve-pd-mev', sekil:'karo', ad:'Mevcut' },
      { s:'ve-pd-biyik', sekil:'cizgi', ad:tol }]) };
  }
  if(pd==='d7'){
    return { svg:C.modlar(_mntPrmV7(ent, S, c, Hk), o).svg, lj:C.gosterge([
      { s:'ve-pd-mod d', sekil:'cizgi', ad:'Zıplama · baş-kıç' }, { s:'ve-pd-mod', sekil:'cizgi', ad:'Öteki modlar' },
      { s:'ve-pd-kose', sekil:'cizgi', ad:tol }, { s:'ve-pd-yakin', sekil:'cizgi', ad:'Aralık ≤ '+_mntS(veMntKatalog.K1A_HZ, 1)+' Hz' },
      { s:'ve-pd-bolge', sekil:'alan', ad:'Sınır dışı' }]) };
  }
  if(pd==='d9') return { svg:C.baglayici(_mntPrmV9(ent, c, Hk), o).svg };
  if(pd==='d10'){
    var P=_mntPrmV10(ent, c, Hk);
    P.panel=P.panel.filter(function(p){ return p.deger.length>0; });   // ölçüsü olmayan (kapasitesiz) kısıt her sınırda sağlar
    return P.panel.length ? { svg:C.duyarlilik(P, o).svg } : { not:'Öteki kısıtları sağlayan kombinasyon yok' };
  }
  if(pd==='d8'){
    var v8=_mntPrmV8(ent, S, c, Hk);
    if(!v8) return { not:'Çözülen kombinasyon yok' };
    return { svg:C.anaEtki(v8, o).svg, lj:C.gosterge(v8.seri.map(function(q, j){
      return { s:'ve-pd-etki ve-pd-s'+Math.min(j+1, 5), sekil:'cizgi', ad:q.no+' · '+q.ad };
    }).concat([{ s:'ve-pd-im dolu', ad:'Uygun' }, { s:'ve-pd-im', ad:'Elenen' }, { s:'ve-pd-uz', sekil:'halka', ad:S.uygunN ? 'Uzlaşı' : 'Sıra 1' }])) };
  }
  if(pd==='d5' || pd==='d4'){
    var K=_mntPrmKesit(nodeId, ent, S);
    if(!K) return null;                                   // tek taranan grup: kesit yok
    var ust=_mntPrmKesitSecici(nodeId, ent, K);
    if(pd==='d5'){
      var v5=_mntPrmV5(ent, Z, K);
      return { ust:ust, svg:C.haritalar(v5, o).svg, lj:(v5.bos.length ? _mntNot('Kesitin her hücresinde sağlanan · '+v5.bos.join(' · '), '') : '')+C.gosterge([
      { s:'ve-pd-gec', sekil:'alan', ad:'Sağlıyor' }, { s:'ve-pd-cerceve', sekil:'alan', ad:'Bozuyor' },
      { s:'ve-pd-cozme', sekil:'alan', ad:'Çözülemedi' }, { s:'ve-pd-uz', sekil:'halka', ad:S.uygunN ? 'Uzlaşı' : 'Sıra 1' }]) };
    }
    var v4=_mntPrmV4(ent, Z, K), T=C.T_SINIF, lj=[];
    for(var k=0;k<=T.length;k++) lj.push({ s:'ve-pd-t'+k, sekil:'alan', ad:k===0 ? 'T < %'+T[0] : k===T.length ? 'T ≥ %'+T[k-1] : '%'+T[k-1]+'–'+T[k] });
    v4.sinir.forEach(function(b){ lj.push({ s:'ve-pd-sh '+b.s, sekil:'kesik', ad:b.ad }); });
    lj.push({ s:'ve-pd-kesin', ad:'Kesin kriterler' }, { s:'ve-pd-n3', ad:'Uygun' }, { s:'ve-pd-uz', sekil:'halka', ad:S.uygunN ? 'Uzlaşı' : 'Sıra 1' });
    return { ust:ust, svg:C.tHaritasi(v4, o).svg, lj:C.gosterge(lj) };
  }
  var kam=_mntPrmKam(nodeId, pd), tolj=S.uygunN ? 'Uzlaşı' : 'Sıra 1';
  if(pd==='d2'){
    var v2=_mntPrmV2(ent, Z, c, kam);
    return { svg:C.uc(v2, o).svg, lj:C.gosterge([
      { s:'ve-pd-n0', ad:'Kesin kriterde elenen', n:v2.say[0], r:2 }, { s:'ve-pd-n1', ad:'Ek kısıtta elenen', n:v2.say[1], r:2.5 },
      { s:'ve-pd-n2', ad:'Uygun', n:v2.say[2] }, { s:'ve-pd-kutu', sekil:'kesik', ad:'E1–E2 · K1 · K2' },
      { s:'ve-pd-uz', sekil:'halka', ad:tolj }, { s:'ve-pd-mev', sekil:'karo', ad:'Mevcut' }]) };
  }
  if(pd==='d3' || pd==='d1'){
    var K3=_mntPrmKesit(nodeId, ent, S);
    if(!K3) return null;
    var sec=_mntPrmSecim(nodeId);
    if(pd==='d3'){
      var v3=_mntPrmV3(ent, Z, K3, sec.d3, kam);
      if(!v3) return null;
      var seg='<div class="ve-mnt-seg" role="group" aria-label="Büyüklük">'+Object.keys(_MNT_PRM_D3).map(function(k){
        return '<button type="button" aria-pressed="'+(k===sec.d3)+'"'
          + ' onclick="veMntParamSec(\''+nodeId+'\',\'d3\',\''+k+'\')">'+_MNT_PRM_D3[k][1]+'</button>';
      }).join('')+'</div>';
      var lj3=[];
      for(var t=0;t<=5;t++) lj3.push({ s:'ve-pd-t'+t, sekil:'alan', ad:sec.d3==='T' ? (t===0 ? 'T < %10' : t===5 ? 'T ≥ %50' : '%'+(t*10)+'–'+(t*10+10)) : String(t+1) });
      return { ust:_mntPrmKesitSecici(nodeId, ent, K3)+'<div class="ve-pd-arac">'+seg+'</div>', svg:C.uc(v3, o).svg,
               lj:C.gosterge(lj3.concat([{ s:'ve-pd-kutu', sekil:'kesik', ad:sec.d3==='T' ? 'K2' : sec.d3==='d' ? 'E2' : 'K1' },
                 { s:'ve-pd-kesin', ad:'Kesin kriterler' }, { s:'ve-pd-n3', ad:'Uygun' }, { s:'ve-pd-uz', sekil:'halka', ad:tolj }])) };
    }
    var v1=_mntPrmV1(nodeId, ent, Z, K3, kam);
    if(!v1) return null;
    var kut='<label class="ve-pd-sec"><input type="checkbox"'+(sec.d1k1 ? ' checked' : '')
      + ' onchange="veMntParamSec(\''+nodeId+'\',\'d1k1\',this.checked)"> K1\'de elenen · '+_mntS(v1.say[0], 0)+'</label>';
    return { ust:_mntPrmKesitSecici(nodeId, ent, K3)+'<div class="ve-pd-arac">'+kut+'</div>', svg:C.uc(v1, o).svg, lj:C.gosterge([
      { s:'ve-pd-n0', ad:'K1\'de elenen', n:v1.say[0], r:2 }, { s:'ve-pd-n0 k', ad:'Öteki kesin kriterde elenen', n:v1.say[1], r:2.2 },
      { s:'ve-pd-n1', ad:'Ek kısıtta elenen', n:v1.say[2], r:2.5 }, { s:'ve-pd-n2', ad:'Uygun', n:v1.say[3] },
      { s:'ve-pd-uz', sekil:'halka', ad:tolj }]) };
  }
  return null;
}
function _mntPrmKap(nodeId, pd, svg){
  var uc=_MNT_PRM_3B[pd];
  return '<div class="ve-pd-kap" data-pd="'+pd+'" data-dugum="'+nodeId+'"'+(uc ? ' data-3b' : '')+'>'
    + (uc ? svg.replace(/^<svg /, '<svg tabindex="0" ') : svg)+'</div>';
}
function _mntPrmKart(nodeId, pd, ad, r){
  var dg=!r.svg ? '' : (_MNT_PRM_3B[pd] ? '<button type="button" class="ve-pd-tam" title="Sıfırla" aria-label="Sıfırla · '+ad+'"'
      + ' onclick="veMntParam3bSifirla(\''+nodeId+'\',\''+pd+'\')">'+veIkon('rotate-ccw')+'</button>' : '')
    + '<button type="button" class="ve-pd-tam" title="Tam ekran" aria-label="Tam ekran · '+ad+'"'
    + ' onclick="veMntParamTamEkran(\''+nodeId+'\',\''+pd+'\')">'+veIkon('maximize')+'</button>';
  return '<section class="ve-fp-card"><div class="ve-fp-sect"><b>'+ad+'</b>'+dg+'</div>'+(r.ust || '')
    + (r.svg ? _mntPrmKap(nodeId, pd, r.svg)+(r.lj || '') : _mntNot(r.not, ''))+'</section>';
}
function _mntParamSonucHTML(node, H, ent){
  var c=veMntKatalog.baglam(H.ctx), Z=_mntParamOzet(ent, c);
  var W=_MNT_PARAM_GEN[node.id] || 600, o={ W:W, fs:{ k:_mnt2DFs('micro'), o:_mnt2DFs('tiny') } };
  var anahtar=Z.anahtar+'|'+W+'|'+o.fs.k+'|'+o.fs.o+'|'+JSON.stringify([_MNT_PARAM_KESIT[node.id] || null, _MNT_PARAM_SECIM[node.id] || null,
    ['d2', 'd3', 'd1'].map(function(pd){ return _mntPrmKam(node.id, pd); })]);
  if(ent.html && ent.html.anahtar===anahtar) return ent.html.v;
  var h=_mntParamUzlasiHTML(node, ent, Z.S, c);
  _MNT_PRM_DIYAGRAM.forEach(function(d){
    var r=_mntPrmCiz(d[0], ent, Z, c, o, node.id);
    if(r) h+=_mntPrmKart(node.id, d[0], d[1], r);
  });
  var v='<div id="ve-mnt-prm-sonuc-'+node.id+'" data-tazele>'+h+'</div>';
  ent.html={ anahtar:anahtar, v:v };
  return v;
}

// TAM EKRAN — aynı diyagram ekranın genişliğinde; pencere boyu değişince yeniden kurulur.
function veMntParamTamEkran(nodeId, pd){
  var ent=_MNT_PARAM_SONUC[nodeId], node=_mntDugum(nodeId);
  if(!ent || !node || typeof document==='undefined') return;
  var ad=(_MNT_PRM_DIYAGRAM.filter(function(d){ return d[0]===pd; })[0] || [pd, pd])[1], gozcu=null;
  _mntFsOverlay(ad, '<div class="ve-pd-fs" id="ve-mnt-prm-fs"></div>', function(){
    var kap=document.getElementById('ve-mnt-prm-fs');
    if(!kap) return;
    _mntParamHoverBagla(kap, nodeId);
    _mntPrm3bBagla(kap);
    var kur=function(){
      var H=_mntParamHazirlik(node);
      if(_mntParamImza(H)!==ent.imza){ kap.innerHTML=_mntNot('Taramadan sonra girdi değişti', 'warn'); return; }
      var c=veMntKatalog.baglam(H.ctx), W=Math.floor(kap.clientWidth)-26;
      var r=_mntPrmCiz(pd, ent, _mntParamOzet(ent, c), c, { W:W, H:Math.max(320, Math.floor(kap.clientHeight)-(pd==='d5' || pd==='d4' ? 170 : 110)), tam:true,
                                                            fs:{ k:_mnt2DFs('tiny'), o:_mnt2DFs('body') } }, nodeId);
      kap.innerHTML=(r && r.svg) ? (r.ust || '')+_mntPrmKap(nodeId, pd, r.svg)+(r.lj || '') : _mntNot(r ? r.not : '', '');
    };
    _MNT_PARAM_TAM={ nodeId:nodeId, pd:pd, kur:kur };
    kur();
    if(typeof ResizeObserver!=='undefined'){
      var raf=0, son=[kap.clientWidth, kap.clientHeight];
      gozcu=new ResizeObserver(function(){
        if(kap.clientWidth===son[0] && kap.clientHeight===son[1]) return;
        son=[kap.clientWidth, kap.clientHeight];
        if(raf) cancelAnimationFrame(raf);
        raf=requestAnimationFrame(function(){ raf=0; kur(); });
      });
      gozcu.observe(kap);
    }
  }, function(){ if(gozcu) gozcu.disconnect(); _MNT_PARAM_TAM=null; });
}

// Uzlaşı çözümü (uygun yoksa sıranın birincisi): grup başına tip, amaçlar, rapor.
function _mntParamUzlasiHTML(node, ent, S, c){
  var bir=S.sira[0], D=ent.D, M=ent.M;
  var ad=S.uygunN ? 'Uzlaşı çözümü' : 'En az ihlalli';
  if(!bir) return _mntBolum(ad, '', _mntNot('Çözülen kombinasyon yok', 'warn'));
  var t=D.tipler(bir.idx);
  var h=_mntFoyAc([{ b:'No', gen:'9%' }, { b:'Tip', gen:'45%', sinif:'sol' }, { b:_mntSym('k<sub>z</sub>')+' stat. <u>[N/mm]</u>', gen:'18%' },
                   { b:'Mevcut tip', gen:'28%', sinif:'sol' }], ad, 've-mnt-foy--sar');
  M.G.forEach(function(g, i){
    var e=t[i] ? M.lib[t[i]] : null, m=(g.tip && M.lib[g.tip]) ? M.lib[g.tip].name : '—';
    var tip=e ? e.name : 'Sabit';
    h+='<tr><td>'+g.no+'</td><td class="sol" title="'+_mntEsc(tip)+'">'+_mntEsc(tip)+'</td><td>'+(e ? _mntS(_mntNum(e.sz, NaN), 0) : '—')+'</td>'
     + '<td class="sol" title="'+_mntEsc(m)+'">'+_mntEsc(m)+'</td></tr>';
  });
  h+=_MNT_FOY_KAPA;
  h+=_mntIzgara(4, _mntOku('T', '%'+_mntS(D.T[bir.idx]*100, 1)) + _mntOku(_mntSym('δ<sub>s</sub>')+' <u>[mm]</u>', _mntS(D.d[bir.idx], 2))
    + _mntOku('Uygun', _mntS(S.uygunN, 0)+' / '+_mntS(S.N, 0)) + _mntOku('Süre <u>[s]</u>', _mntS(S.sure/1000, 1)));
  h+='<div class="ve-fp-eylem"><button type="button" class="ve-fp-dugme" onclick="veMntParamRapor(\''+node.id+'\')">'
   + veIkon('download')+' Raporu indir</button></div>';
  return _mntBolum(ad, '', h);
}

// ── ARAÇ İPUCU — noktanın kombinasyonu: grup başına tip, amaçlar, hüküm ─────
function _mntParamIpucu(nodeId, idx){
  var ent=_MNT_PARAM_SONUC[nodeId], node=_mntDugum(nodeId);
  if(!ent || !node || !(idx>=0 && idx<ent.D.N)) return '';
  var H=_mntParamHazirlik(node), c=veMntKatalog.baglam(H.ctx), Z=_mntParamOzet(ent, c), D=ent.D;
  var t=D.tipler(idx), sat=[];
  ent.M.G.forEach(function(g, i){ if(t[i]) sat.push(g.no+' · '+((ent.M.lib[t[i]] || {}).name || t[i])); });
  if(D.d1[idx]!==1) return sat.concat(['Çözülemedi']).join('\n');
  sat.push('T %'+_mntS(D.T[idx]*100, 1)+' · δs '+_mntS(D.d[idx], 2)+' mm');
  var m=Z.Hk.m[idx], boz=[];
  veMntKatalog.KISITLAR.forEach(function(Q, i){ if(m & (1<<i)) boz.push(_mntPrmNo(Q)); });
  sat.push(boz.length ? boz.join(' · ') : (D.d2[idx]===1 ? 'Uygun' : 'İkinci aşama çözülemedi'));
  return sat.join('\n');
}
function _mntParamHoverBagla(gov, nodeId){
  if(!gov || gov.__prmHover) return;
  gov.__prmHover=true;
  var tip=document.getElementById('ve-mnt-2d-tip');
  if(!tip){ tip=document.createElement('div'); tip.id='ve-mnt-2d-tip'; tip.className='ve-mnt-hover-ip ve-mnt-hover-ip--metin';
    tip.style.zIndex='100060'; document.body.appendChild(tip); }
  gov.addEventListener('mousemove', function(e){
    var el=(e.target && e.target.closest) ? e.target.closest('.ve-pd-kap [data-i], .ve-pd-kap [data-ip]') : null;
    var v=el ? (el.getAttribute('data-ip') || _mntParamIpucu(nodeId, Number(el.getAttribute('data-i')))) : '';
    if(!v || e.buttons){ tip.style.display='none'; return; }
    tip.textContent=v; tip.style.display='block';
    var x=e.clientX+14, y=e.clientY+16;
    if(x+tip.offsetWidth>window.innerWidth-8) x=e.clientX-tip.offsetWidth-14;
    if(y+tip.offsetHeight>window.innerHeight-8) y=e.clientY-tip.offsetHeight-16;
    tip.style.left=x+'px'; tip.style.top=y+'px';
  });
  gov.addEventListener('mouseleave', function(){ tip.style.display='none'; });
}

// 3B'NİN ELİ — sol tık + sürükle döndürür (azimut · yükseliş), odaktaki
// çizimde oklar döndürür; yalnız çizim yeniden kurulur (seçici, gösterge ve
// pencere yerinde). Sürükleme boyunca özet ve sınırlar ilk karenin.
var _MNT_PRM_SURUKLE = null;
function _mntPrm3bDurum(kap){
  var nodeId=kap.getAttribute('data-dugum'), ent=_MNT_PARAM_SONUC[nodeId], node=_mntDugum(nodeId);
  if(!ent || !node) return null;
  var H=_mntParamHazirlik(node);
  if(_mntParamImza(H)!==ent.imza) return null;
  var c=veMntKatalog.baglam(H.ctx);
  return { nodeId:nodeId, pd:kap.getAttribute('data-pd'), ent:ent, c:c, Z:_mntParamOzet(ent, c), tam:!!kap.closest('#ve-mnt-prm-fs') };
}
function _mntPrm3bCizKap(kap, d){
  var eski=kap && kap.querySelector('svg.ve-pd');
  if(!d || !eski) return;
  var o={ W:Number(eski.getAttribute('width')), H:Number(eski.getAttribute('height')),
          fs:d.tam ? { k:_mnt2DFs('tiny'), o:_mnt2DFs('body') } : { k:_mnt2DFs('micro'), o:_mnt2DFs('tiny') } };
  var r=_mntPrmCiz(d.pd, d.ent, d.Z, d.c, o, d.nodeId);
  if(!r || !r.svg) return;
  var odak=(typeof document!=='undefined') && document.activeElement===eski;
  eski.outerHTML=r.svg.replace(/^<svg /, '<svg tabindex="0" ');
  if(odak){ var y=kap.querySelector('svg.ve-pd'); if(y) y.focus(); }
}
function _mntPrm3bAnahtar(kap){ return kap.getAttribute('data-dugum')+'|'+kap.getAttribute('data-pd'); }
function _mntPrm3bBagla(kok){
  if(!kok || kok.__prm3b) return;
  kok.__prm3b=true;
  if(!window.__prm3bPencere){
    window.__prm3bPencere=true;
    var raf=0;
    window.addEventListener('pointermove', function(e){
      var s=_MNT_PRM_SURUKLE;
      if(!s) return;
      _MNT_PARAM_KAM[s.key]=veMntParamCiz.ucKamera({ az:s.k.az-(e.clientX-s.x)*0.5, el:s.k.el+(e.clientY-s.y)*0.35 });
      if(!raf) raf=requestAnimationFrame(function(){ raf=0; if(_MNT_PRM_SURUKLE) _mntPrm3bCizKap(_MNT_PRM_SURUKLE.kap, _MNT_PRM_SURUKLE.d); });
    });
    window.addEventListener('pointerup', function(){
      var s=_MNT_PRM_SURUKLE;
      if(!s) return;
      _MNT_PRM_SURUKLE=null;
      document.documentElement.classList.remove('ve-pd-surukle');
      if(s.d && s.d.ent) s.d.ent.html=null;               // pencerenin belleği yeni açıyla kurulsun
    });
  }
  kok.addEventListener('pointerdown', function(e){
    var kap=(e.button===0 && e.target.closest) ? e.target.closest('.ve-pd-kap[data-3b]') : null;
    if(!kap) return;
    var key=_mntPrm3bAnahtar(kap), k=_MNT_PARAM_KAM[key] || _MNT_PRM_KAM0;
    _MNT_PRM_SURUKLE={ kap:kap, key:key, x:e.clientX, y:e.clientY, k:{ az:k.az, el:k.el }, d:_mntPrm3bDurum(kap) };
    document.documentElement.classList.add('ve-pd-surukle');
    var sv=kap.querySelector('svg.ve-pd');
    if(sv && sv.focus) sv.focus({ preventScroll:true });
    e.preventDefault();
  });
  kok.addEventListener('keydown', function(e){
    var kap=e.target.closest ? e.target.closest('.ve-pd-kap[data-3b]') : null;
    var ok={ ArrowLeft:[5, 0], ArrowRight:[-5, 0], ArrowUp:[0, 4], ArrowDown:[0, -4] }[e.key];
    if(!kap || !ok) return;
    var key=_mntPrm3bAnahtar(kap), k=_MNT_PARAM_KAM[key] || _MNT_PRM_KAM0;
    _MNT_PARAM_KAM[key]=veMntParamCiz.ucKamera({ az:k.az+ok[0], el:k.el+ok[1] });
    e.preventDefault();
    var d=_mntPrm3bDurum(kap);
    _mntPrm3bCizKap(kap, d);
    if(d) d.ent.html=null;
  });
}
function veMntParam3bSifirla(nodeId, pd){
  delete _MNT_PARAM_KAM[nodeId+'|'+pd];
  var ent=_MNT_PARAM_SONUC[nodeId];
  if(ent) ent.html=null;
  if(typeof veMntPencereTazele==='function') veMntPencereTazele();
  if(_MNT_PARAM_TAM && _MNT_PARAM_TAM.nodeId===nodeId && _MNT_PARAM_TAM.pd===pd) _MNT_PARAM_TAM.kur();
}

// Pencere açılınca (cp-core.js): gövdenin genişliğini ölç, değiştiyse Sonuç
// o genişlikte yerinde yeniden kurulur; araç ipucu gövdeye bir kez bağlanır.
function veMntParamCizKur(){
  if(typeof document==='undefined') return false;
  var kok=document.querySelector('.ve-properties-content [data-mnt-pencere]');
  var node=kok ? _mntDugum(kok.getAttribute('data-mnt-pencere')) : null;
  if(!node || node.type!=='mnt-parametric') return false;
  var gov=document.getElementById('ve-fp-panes-'+node.id);
  if(!gov) return false;
  _mntParamHoverBagla(gov, node.id);
  _mntPrm3bBagla(gov);
  var W=Math.floor(gov.clientWidth)-2;                   // çizimin kenarlığı 2 × 1
  if(!(W>200) || W===_MNT_PARAM_GEN[node.id]) return false;
  _MNT_PARAM_GEN[node.id]=W;
  if(_MNT_PARAM_SONUC[node.id] && typeof veMntPencereTazele==='function') veMntPencereTazele();
  return true;
}

// Raporu bugünkü sınırlarla indirir (tarama yinelenmez).
function veMntParamRapor(nodeId){
  var node=_mntParamDugum(nodeId), ent=_MNT_PARAM_SONUC[nodeId];
  if(!node || !ent) return;
  var H=_mntParamHazirlik(node);
  if(_mntParamImza(H)!==ent.imza){ _mntParamYaz(nodeId, 'Taramadan sonra girdi değişti', 'warn'); return; }
  var E;
  try { E=_mntParamZenginlestir(_mntParamOzet(ent, veMntKatalog.baglam(H.ctx)).S, H, ent.O); }
  catch(e){ _mntParamYaz(nodeId, 'Hata: '+e.message, 'no'); return; }
  _mntReportEnsureAssets(function(ok){
    if(!ok){ _mntParamYaz(nodeId, 'Rapor varlıkları yüklenemedi', 'no'); return; }
    try {
      var html=veMntParamRaporHTML(E);
      _mntReportDownload(html, 'takoz_katalogdan_secim.html');
      _mntParamYaz(nodeId, 'İndirildi ('+_mntS(html.length/1024, 0)+' KB)', 'ok');
    } catch(e){ _mntParamYaz(nodeId, 'Hata: '+e.message, 'no'); }
  });
}

if(typeof module!=='undefined' && module.exports){
  module.exports = {
    _MNT_PARAM_SONUC: _MNT_PARAM_SONUC, _MNT_PARAM_GEN: _MNT_PARAM_GEN,
    _mntParamImza: _mntParamImza, _mntParamSonucKaydet: _mntParamSonucKaydet, _mntParamSonucDurum: _mntParamSonucDurum,
    _mntParamOzet: _mntParamOzet, _mntParamKose: _mntParamKose, _mntParamSonucKat: _mntParamSonucKat,
    _mntParamSonucHTML: _mntParamSonucHTML, _mntParamIpucu: _mntParamIpucu, _mntPrmCiz: _mntPrmCiz,
    _MNT_PRM_DIYAGRAM: _MNT_PRM_DIYAGRAM, veMntParamTamEkran: veMntParamTamEkran,
    _MNT_PARAM_KESIT: _MNT_PARAM_KESIT, _mntPrmKesit: _mntPrmKesit, _mntPrmV5: _mntPrmV5, _mntPrmV4: _mntPrmV4,
    veMntParamKesit: veMntParamKesit, veMntParamSec: veMntParamSec, veMntParam3bSifirla: veMntParam3bSifirla,
    _mntPrmV2: _mntPrmV2, _mntPrmV3: _mntPrmV3, _mntPrmV1: _mntPrmV1, _MNT_PARAM_KAM: _MNT_PARAM_KAM,
    _mntPrmV11: _mntPrmV11, _mntPrmV7: _mntPrmV7, _mntPrmV9: _mntPrmV9, _mntPrmV10: _mntPrmV10, _mntPrmV8: _mntPrmV8,
    veMntParamCizKur: veMntParamCizKur, veMntParamRapor: veMntParamRapor, veMntParamUnut: veMntParamUnut
  };
}
