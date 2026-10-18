// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ — PARAMETRİK ANALİZ · SONUÇ kategorisi
// ════════════════════════════════════════════════════════════════════════════
// Kullanıcı kararı (2026-10-18): "Önerilerini uygulayalım. Bir bakalım
// kullanışlı mı. Bileşen penceresinin içine entegre edersin." Takoz
// pencerelerinin SONUÇ GÖSTERMEZ kuralının (2026-10-16) TEK istisnası bu
// pencere; ayrıntılı rapor yine ayrı belgede.
//
// SADE SONUÇ (kullanıcı kararı 2026-10-18: "Tablo + iki sade grafik, diğer
// diyagramlar kalsın fakat kullanıcı istediği zaman açabilsin"): Öneri ·
// Kriterler · Modlar · Statik sehim ve iletilebilirlik · Yakın seçenekler ·
// Eleme · Diyagramlar. Kısıtlar ADIYLA (Kısıtlar kategorisinin adları; kod
// yok). On diyagram pencerede çizilmez: Diyagramlar listesinden tam ekranın
// galerisinde açılır ve ancak açılınca çizilir.
//
// DEPO BELLEKTE, MODELDE DEĞİL: tarama düğüm başına `_MNT_PARAM_SONUC`ta durur
// — proje dosyasına ve geri-al yığınına girmez. Sınır, açıklık ve ağırlık
// değişince özet depodan yeniden kurulur (veMntKatalog.ozet — kapı:
// mount-katalog.test.js → CANLI); model, aday, sabit grup, tolerans ya da
// sürünme değişince tarama ESKİR (imza) ve Sonuç yalnız durumu yazar.
//
// ÇİZİM GERÇEK GENİŞLİKTE: gövdenin genişliği pencere açılınca ölçülür
// (veMntParamCizKur, cp-core.js), grafik o genişlikte 1:1 kurulur.
// Çizici DOM'suz: js/mount-param-ciz.js.
// ════════════════════════════════════════════════════════════════════════════

var _MNT_PARAM_SONUC = {};      // düğüm → { D, imza, M, O, mevcut, olc:{}, kose:{}, Ok:{}, bellek, html }
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
                             olc:{}, kose:{}, Ok:{}, bellek:null, html:null };
}
// Proje değişince (topology.js → veResetSubtopoNav) bütün taramalar ve
// görünüm seçimleri unutulur — kimlikler yeni projede yeniden kullanılır.
function veMntParamUnut(){
  if(typeof veMntParamDurdur==='function') veMntParamDurdur();      // süren tarama eski projenin
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
    uzlasi:bir ? { x:D.d[bir.idx], y:D.T[bir.idx]*100, i:bir.idx, ad:_mntPrmAd(S) } : null,
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
    ekle((k===0 ? _mntPrmAd(S) : 'Sıra '+(k+1))+(S.uygunN ? '' : ' · '+_mntPrmBozuk(Hk, r.idx)), r.idx, k===0);
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
  if(bir) isaret.push({ p:[D.d[bir.idx], D.fMax[bir.idx], D.T[bir.idx]*100], s:'ve-pd-uz', ad:_mntPrmAd(S), r:7, i:bir.idx });
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
  var isaret=K.uz ? [{ p:[K.uz[0], K.uz[1], z[K.uz[1]*n+K.uz[0]]], s:'ve-pd-uz', ad:_mntPrmAd(S), r:7, i:S.sira[0].idx }] : [];
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
  tumu.forEach(function(t){ if(t[4]===u) isaret.push({ p:[t[0], t[1], t[2]], s:'ve-pd-uz', ad:_mntPrmAd(S), r:7, i:u }); });
  var no=function(k){ return ent.M.G[D.taranan[k]].no; };
  return { ad:'Tasarım uzayı', kam:kam, nokta:nok, isaret:isaret, say:say,
           eks:[_mntPrmKatEks(no(ek[0])+' · k_z', K.kz), _mntPrmKatEks(no(ek[1])+' · k_z', K.kz), _mntPrmKatEks(no(ek[2])+' · k_z', K.kz)] };
}
function veMntParamSec(nodeId, alan, deger){
  var sec=_mntPrmSecim(nodeId);
  sec[alan]=deger;
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

// DİYAGRAMLAR — yalnız tam ekranın galerisinde (veMntParamTamEkran), açılınca
// çizilir. Sıra: genel bakış → tasarımın modları → neyin bağladığı → sınırın
// etkisi → tip değişiminin etkisi. `o.arac`: 3B'nin araç satırına (sıfırla).
var _MNT_PRM_DIYAGRAM = [['d11', 'Pareto cephesi'], ['d7', 'Mod yerleşimi'], ['d9', 'Bağlayıcı kısıtlar'],
                         ['d10', 'Sınır duyarlılığı'], ['d8', 'Ana etkiler'], ['d5', 'Kısıt haritaları'],
                         ['d4', 'İletilebilirlik haritası'], ['d2', 'Kısıt penceresi'], ['d3', 'Tepki yüzeyi'],
                         ['d1', 'Tasarım uzayı']];
var _MNT_PRM_3B = { d2:true, d3:true, d1:true };
var _MNT_PARAM_TAM = null;      // açık galeri: { nodeId, pd, kur, sec }
function _mntPrmCiz(pd, ent, Z, c, o, nodeId){
  var C=veMntParamCiz, S=Z.S, Hk=Z.Hk, tol='±%'+_mntS(c.s.tolerans*100, 0)+' rijitlik';
  if(pd==='d11'){
    var v=_mntPrmV11(ent, S, Hk, c);
    return { svg:C.pareto(v, o).svg, lj:C.gosterge([
      { s:'ve-pd-n0', ad:'Kesin kriterde elenen', n:v.say[0], r:2 }, { s:'ve-pd-n1', ad:'Ek kısıtta elenen', n:v.say[1], r:2.5 },
      { s:'ve-pd-n2', ad:'Uygun', n:v.say[2] }, { s:'ve-pd-cephe', sekil:'cizgi', ad:'Pareto cephesi', n:S.paretoN },
      { s:'ve-pd-uz', sekil:'halka', ad:_mntPrmAd(S) }, { s:'ve-pd-mev', sekil:'karo', ad:'Mevcut' },
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
    }).concat([{ s:'ve-pd-im dolu', ad:'Uygun' }, { s:'ve-pd-im', ad:'Elenen' }, { s:'ve-pd-uz', sekil:'halka', ad:_mntPrmAd(S) }])) };
  }
  if(pd==='d5' || pd==='d4'){
    var K=_mntPrmKesit(nodeId, ent, S);
    if(!K) return null;                                   // tek taranan grup: kesit yok
    var ust=_mntPrmKesitSecici(nodeId, ent, K);
    if(pd==='d5'){
      var v5=_mntPrmV5(ent, Z, K);
      return { ust:ust, svg:C.haritalar(v5, o).svg, lj:(v5.bos.length ? _mntNot('Kesitin her hücresinde sağlanan · '+v5.bos.join(' · '), '') : '')+C.gosterge([
      { s:'ve-pd-gec', sekil:'alan', ad:'Sağlıyor' }, { s:'ve-pd-cerceve', sekil:'alan', ad:'Bozuyor' },
      { s:'ve-pd-cozme', sekil:'alan', ad:'Çözülemedi' }, { s:'ve-pd-uz', sekil:'halka', ad:_mntPrmAd(S) }]) };
    }
    var v4=_mntPrmV4(ent, Z, K), T=C.T_SINIF, lj=[];
    for(var k=0;k<=T.length;k++) lj.push({ s:'ve-pd-t'+k, sekil:'alan', ad:k===0 ? 'T < %'+T[0] : k===T.length ? 'T ≥ %'+T[k-1] : '%'+T[k-1]+'–'+T[k] });
    v4.sinir.forEach(function(b){ lj.push({ s:'ve-pd-sh '+b.s, sekil:'kesik', ad:b.ad }); });
    lj.push({ s:'ve-pd-kesin', ad:'Kesin kriterler' }, { s:'ve-pd-n3', ad:'Uygun' }, { s:'ve-pd-uz', sekil:'halka', ad:_mntPrmAd(S) });
    return { ust:ust, svg:C.tHaritasi(v4, o).svg, lj:C.gosterge(lj) };
  }
  var kam=_mntPrmKam(nodeId, pd), tolj=_mntPrmAd(S);
  if(pd==='d2'){
    var v2=_mntPrmV2(ent, Z, c, kam);
    return { ust:o.arac ? '<div class="ve-pd-arac">'+o.arac+'</div>' : '', svg:C.uc(v2, o).svg, lj:C.gosterge([
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
      return { ust:_mntPrmKesitSecici(nodeId, ent, K3)+'<div class="ve-pd-arac">'+seg+(o.arac || '')+'</div>', svg:C.uc(v3, o).svg,
               lj:C.gosterge(lj3.concat([{ s:'ve-pd-kutu', sekil:'kesik', ad:sec.d3==='T' ? 'K2' : sec.d3==='d' ? 'E2' : 'K1' },
                 { s:'ve-pd-kesin', ad:'Kesin kriterler' }, { s:'ve-pd-n3', ad:'Uygun' }, { s:'ve-pd-uz', sekil:'halka', ad:tolj }])) };
    }
    var v1=_mntPrmV1(nodeId, ent, Z, K3, kam);
    if(!v1) return null;
    var kut='<label class="ve-pd-sec"><input type="checkbox"'+(sec.d1k1 ? ' checked' : '')
      + ' onchange="veMntParamSec(\''+nodeId+'\',\'d1k1\',this.checked)"> K1\'de elenen · '+_mntS(v1.say[0], 0)+'</label>';
    return { ust:_mntPrmKesitSecici(nodeId, ent, K3)+'<div class="ve-pd-arac">'+kut+(o.arac || '')+'</div>', svg:C.uc(v1, o).svg, lj:C.gosterge([
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

// ── SADE SONUÇ — öneri, kriterler, iki grafik, yakın seçenekler, eleme ──────
// Önerinin adı: uygun kombinasyon yoksa sıranın birincisi en az ihlalli olandır.
function _mntPrmAd(S){ return S.uygunN ? 'Öneri' : 'En az ihlalli'; }
// Kombinasyonun birinci aşama ölçümü (modlar; tolerans açıksa köşeleri) —
// taramanın ölçücüsüyle, kombinasyon başına bir kez; −1 mevcut tasarım.
function _mntPrmOlc(ent, idx){
  if(idx<0) return ent.mevcut.o1;
  if(!(idx in ent.olc)){
    var o=null;
    try { o=ent.O.olc1(ent.D.tipler(idx)); } catch(e){ o=null; }
    ent.olc[idx]=o;
  }
  return ent.olc[idx];
}
// Değer sınırla aynı görünmesin: yuvarlanınca sınıra eşit çıkan değerin
// ondalığı uzar (4,996 mm "5,0" değil "4,996" — hüküm "≤ 5 mm" ihlal).
function _mntPrmYaz(v, lim, d){
  if(!Number.isFinite(v)) return '—';
  var k=d, p=function(x){ return Math.round(x*Math.pow(10, k)); };
  while(k<d+3 && Number.isFinite(lim) && v!==lim && p(v)===p(lim)) k++;
  return _mntS(v, k);
}
// Sınır kendi ondalığıyla (3 → "3", 2,5 → "2,5").
function _mntPrmSin(v){
  var d=0;
  while(d<3 && Math.abs(v*Math.pow(10, d)-Math.round(v*Math.pow(10, d)))>1e-9) d++;
  return _mntS(v, d);
}
function _mntPrmSinirYazi(k, c){
  var K=veMntKatalog, s=c.s, b='&nbsp;';
  var Y={
    k1:'&lt;'+b+_mntS(K.K1_ORAN*c.fAtes, 1)+b+'Hz', k1a:'&gt;'+b+_mntS(K.K1A_HZ, 1)+b+'Hz',
    k1b:_mntS(K.K1B[0], 0)+'–'+_mntS(K.K1B[1], 0)+b+'Hz dışı', k2:'&lt;'+b+'%'+_mntS(K.K2_T*100, 0),
    altMod:'≥'+b+_mntPrmSin(s.altMod)+b+'Hz', kapasite:'≤'+b+'%'+_mntPrmSin(s.kapasite*100),
    ayrisma:'≥'+b+'%'+_mntPrmSin(s.ayrisma*100), isletme:'≤'+b+_mntPrmSin(s.isletmeUst)+b+'mm',
    durdurucu:'≤'+b+_mntPrmSin(s.durdurucuUst)+b+'mm', cekme:'Yok', darbe:'≤'+b+'%'+_mntPrmSin(s.darbe*100)
  };
  return Y[k] || '';
}
// Bandın içindeki mod (anma ya da tolerans köşesi): yaylandırılmamış kütle bandının değeri.
function _mntPrmBantta(o){
  var B=veMntKatalog.K1B, f=null;
  [o].concat(o && o.sert ? [o.sert, o.yumusak] : []).forEach(function(x){
    ((x && x.f) || []).forEach(function(v){ if(f===null && v>=B[0] && v<=B[1]) f=v; });
  });
  return f===null ? 'Bantta' : _mntS(f, 1)+' Hz';
}
// KRİTERLER — açık kısıtlar KISITLAR sırasıyla; statik sehimin iki sınırı TEK
// satır. Hüküm: mevcut tasarımda hepsi() (taramanın ölçücüsünün ölçümü),
// öneride deponun ölçüsü — huninin ve sıranın kullandığı hükmün aynısı.
// Satır: { k, ad, sinir, m, o }; m · o: { v (yazı), ok (true · false · null: değerlendirilmedi) }.
function _mntPrmKriterler(ent, Z, c){
  var K=veMntKatalog, D=ent.D, bir=Z.S.sira[0], idx=bir ? bir.idx : -1, s=c.s, sat=[];
  var hm=ent.mevcut.o1 ? K.hepsi(ent.mevcut.o1, ent.mevcut.o2, c).sonuc : {}, ho={};
  if(idx>=0) K.KISITLAR.forEach(function(Q){
    if(c.acik[Q.k] && (Q.asama===1 || D.d2[idx]===1)) ho[Q.k]=K.hukum(Q.k, D.X[Q.k][idx], c);
  });
  var om={ o:_mntPrmOlc(ent, -1), d:ent.mevcut.o1 ? _mntPrmSehim(ent.mevcut.o1) : NaN };
  var oo={ o:idx>=0 ? _mntPrmOlc(ent, idx) : null, d:idx>=0 ? D.d[idx] : NaN };
  var hucre=function(k, h, x){
    if(!h || h.na) return { v:'—', ok:null };
    var v=h.deger, t;
    if(k==='k1' || k==='altMod') t=_mntPrmYaz(v, h.sinir, 1)+' Hz';
    else if(k==='k1a') t=_mntPrmYaz(v, h.sinir, 2)+' Hz';
    else if(k==='k1b') t=h.ok ? 'Dışında' : _mntPrmBantta(x.o);
    else if(k==='cekme') t=v>0 ? _mntS(v, 2)+' mm' : 'Yok';
    else if(k==='k2' || k==='kapasite' || k==='ayrisma' || k==='darbe') t='%'+_mntPrmYaz(v*100, h.sinir*100, 1);
    else t=_mntPrmYaz(v, h.sinir, 1)+' mm';
    return { v:t, ok:!!h.ok };
  };
  var acA=!!c.acik.sehimAlt, acU=!!c.acik.sehim;
  var sehim=function(h, x){
    var a=acA ? h.sehimAlt : null, u=acU ? h.sehim : null;
    if((acA && !a) || (acU && !u)) return { v:'—', ok:null };
    var boz=(a && !a.ok) ? a : (u && !u.ok) ? u : null;
    return { v:_mntPrmYaz(boz ? boz.deger : x.d, boz ? boz.sinir : (u || a).sinir, 2)+' mm', ok:!boz };
  };
  K.KISITLAR.forEach(function(Q){
    if(!c.acik[Q.k] || (Q.k==='sehim' && acA)) return;
    if(Q.k==='sehimAlt' || Q.k==='sehim'){
      var ikisi=acA && acU, b='&nbsp;';
      sat.push({ k:'sehim', ad:ikisi ? 'Statik sehim' : Q.ad,
        sinir:ikisi ? _mntPrmSin(s.sehimAlt)+'–'+_mntPrmSin(s.sehimUst)+b+'mm'
             : (acA ? '≥'+b+_mntPrmSin(s.sehimAlt) : '≤'+b+_mntPrmSin(s.sehimUst))+b+'mm',
        m:sehim(hm, om), o:sehim(ho, oo) });
      return;
    }
    sat.push({ k:Q.k, ad:Q.ad, sinir:_mntPrmSinirYazi(Q.k, c), m:hucre(Q.k, hm[Q.k], om), o:hucre(Q.k, ho[Q.k], oo) });
  });
  return sat;
}
// MODLAR — mevcut ve önerinin modları; sınırı bozan mod (Kriter 1 · 1a · 1b,
// en düşük mod) kırmızı. Tolerans açıksa köşeler de sınanır ve bıyık çizilir.
function _mntPrmModV(ent, Z, c){
  var K=veMntKatalog, S=Z.S, bir=S.sira[0], k1=K.K1_ORAN*c.fAtes, fm=k1, kopru=false, satir=[];
  var ekle=function(ad, o, vurgu){
    if(!o || !o.f || !o.f.length) return;
    var kotu=o.f.map(function(){ return false; });
    [o].concat(o.sert && o.yumusak ? [o.sert, o.yumusak] : []).forEach(function(x){
      var f=(x.f || []).map(function(v, i){ return [v, i]; }).sort(function(p, q){ return p[0]-q[0]; });
      f.forEach(function(p, j){
        if(p[0]>=k1 || (c.acik.altMod && p[0]<c.s.altMod) || (p[0]>=K.K1B[0] && p[0]<=K.K1B[1])) kotu[p[1]]=true;
        if(j && p[0]-f[j-1][0]<=K.K1A_HZ){ kotu[p[1]]=kotu[f[j-1][1]]=true; if(x===o) kopru=true; }
        if(p[0]>fm) fm=p[0];
      });
    });
    var lab=(o.modes || []).map(function(m){ return m.label; });
    satir.push({ ad:ad, f:o.f, kotu:kotu, vurgu:!!vurgu,
      ip:o.f.map(function(f, i){ return ad+' · '+(i+1)+'. mod\n'+_mntS(f, 2)+' Hz'+(lab[i] ? ' · '+_mntPrmModAdi(lab[i]) : ''); }),
      kose:(o.sert && o.yumusak) ? { a:o.yumusak.f, b:o.sert.f } : null });
  };
  ekle('Mevcut', _mntPrmOlc(ent, -1));
  if(bir) ekle(_mntPrmAd(S), _mntPrmOlc(ent, bir.idx), true);
  var bolge=[[k1, Infinity]];
  if(c.acik.altMod) bolge.unshift([0, c.s.altMod]);
  return { satir:satir, bolge:bolge, bant:K.K1B, k1a:K.K1A_HZ, kopru:kopru,
           ozel:[k1].concat(c.acik.altMod ? [c.s.altMod] : []), xMax:Math.max(k1*1.25, fm*1.06) };
}
// STATİK SEHİM VE İLETİLEBİLİRLİK — mevcut → öneri ve yakın seçenekler; bant statik sehim sınırları.
function _mntPrmDagV(ent, Z, c, L){
  var D=ent.D, S=Z.S, bir=S.sira[0], m1=ent.mevcut.o1;
  return {
    mevcut:m1 ? { x:_mntPrmSehim(m1), y:m1.T*100, ip:'Mevcut\nT %'+_mntS(m1.T*100, 1)+' · δs '+_mntS(_mntPrmSehim(m1), 2)+' mm' } : null,
    oneri:bir ? { x:D.d[bir.idx], y:D.T[bir.idx]*100, i:bir.idx, ad:_mntPrmAd(S) } : null,
    yakin:L.map(function(x){ return { x:D.d[x], y:D.T[x]*100, i:x }; }),
    e1:c.acik.sehimAlt ? c.s.sehimAlt : null, e2:c.acik.sehim ? c.s.sehimUst : null, k2:veMntKatalog.K2_T*100
  };
}
// YAKIN SEÇENEKLER — sıranın 2.–6. kombinasyonu; uygun beşten azsa en az
// ihlalli uygun olmayanlarla tamamlanır.
function _mntPrmYakinL(ent, Z){
  var S=Z.S, L=S.sira.slice(1, 6).map(function(r){ return r.idx; });
  if(L.length<5 && S.uygunN) _mntPrmYakin(ent, Z.Hk, 5-L.length).forEach(function(x){ L.push(x); });
  return L;
}

function _mntParamOneriHTML(node, ent, Z){
  var S=Z.S, bir=S.sira[0], D=ent.D, M=ent.M, ad=_mntPrmAd(S);
  if(!bir) return _mntBolum(ad, '', _mntNot('Çözülen kombinasyon yok', 'warn'));
  var t=D.tipler(bir.idx), h='<div class="ve-prm-og">';
  M.G.forEach(function(g, i){
    var mev=(g.tip && M.lib[g.tip]) ? M.lib[g.tip].name : '—', yeni=t[i] ? ((M.lib[t[i]] || {}).name || t[i]) : null, tip;
    if(!yeni) tip='<span class="ayni">'+_mntEsc(mev)+'</span><em>Sabit</em>';
    else if(t[i]===g.tip) tip='<span class="ayni">'+_mntEsc(yeni)+'</span><em>Aynı</em>';
    else tip='<s>'+_mntEsc(mev)+'</s><b>'+veIkon('arrow-right')+_mntEsc(yeni)+'</b>';
    h+='<div class="ve-prm-og-s"><span class="ve-prm-og-g">'+_mntEsc(g.ad)+'</span><span class="ve-prm-og-t">'+tip+'</span></div>';
  });
  var m1=ent.mevcut.o1;
  h+='</div>'+_mntIzgara(2, _mntOku('İletilebilirlik', (m1 ? '%'+_mntS(m1.T*100, 1) : '—')+' → %'+_mntS(D.T[bir.idx]*100, 1))
      + _mntOku('Statik sehim <u>[mm]</u>', (m1 ? _mntS(_mntPrmSehim(m1), 2) : '—')+' → '+_mntS(D.d[bir.idx], 2)))
    + '<div class="ve-fp-eylem ve-prm-eylem"><button type="button" class="ve-fp-dugme" onclick="veMntParamRapor(\''+node.id+'\')">'
    + veIkon('download')+' Raporu indir</button></div>';
  return _mntBolum(ad, '', h);
}
function _mntParamKriterHTML(ent, Z, c){
  var R=_mntPrmKriterler(ent, Z, c), ad=_mntPrmAd(Z.S), nm=0, no=0;
  var td=function(x){
    return '<td'+(x.ok===false ? ' class="kr"' : '')+' title="'+_mntEsc(x.v)+'">'+x.v+(x.ok===null ? '' : veDurumIkon(x.ok ? 'ok' : 'err'))+'</td>';
  };
  var h=_mntFoyAc([{ b:'Kriter', gen:'34%', sinif:'sol' }, { b:'Sınır', gen:'22%' }, { b:'Mevcut', gen:'22%' }, { b:ad, gen:'22%' }],
                  'Kriterler', 've-mnt-foy--sar ve-prm-kriter');
  R.forEach(function(r){
    if(r.m.ok===false) nm++;
    if(r.o.ok===false) no++;
    h+='<tr data-k="'+r.k+'"><td class="sol">'+_mntEsc(r.ad)+'</td><td class="sf">'+r.sinir+'</td>'+td(r.m)+td(r.o)+'</tr>';
  });
  return _mntBolum('Kriterler', 'Mevcut '+_mntS(nm, 0)+' ihlal · '+ad+' '+_mntS(no, 0)+' ihlal', h+_MNT_FOY_KAPA);
}
function _mntParamModHTML(node, ent, Z, c, o){
  var V=_mntPrmModV(ent, Z, c);
  if(!V.satir.length) return '';
  var lj=[{ s:'ve-pd-bolge', sekil:'alan', ad:'Sınır dışı' }, { s:'ve-pd-tik k', sekil:'dik', ad:'Sınırı bozan mod' }];
  if(V.kopru) lj.push({ s:'ve-pd-yakin', sekil:'cizgi', ad:'Aralık ≤ '+_mntS(V.k1a, 1)+' Hz' });
  if(V.satir.some(function(r){ return r.kose; })) lj.push({ s:'ve-pd-kose', sekil:'cizgi', ad:'±%'+_mntS(c.s.tolerans*100, 0)+' rijitlik' });
  return _mntBolum('Modlar', '', '<div class="ve-pd-kap" data-pd="mod" data-dugum="'+node.id+'">'+veMntParamCiz.modSerit(V, o).svg+'</div>'
    + veMntParamCiz.gosterge(lj));
}
function _mntParamDagHTML(node, ent, Z, c, o, L){
  var V=_mntPrmDagV(ent, Z, c, L);
  if(!V.mevcut && !V.oneri) return '';
  var lj=[];
  if(V.mevcut) lj.push({ s:'ve-pd-mev', sekil:'karo', ad:'Mevcut' });
  if(V.oneri) lj.push({ s:'ve-pd-uz', sekil:'halka', ad:V.oneri.ad });
  if(V.yakin.length) lj.push({ s:'ve-pd-yk', ad:'Yakın seçenekler' });
  if((V.e1!=null || V.e2!=null) && !(V.e1!=null && V.e2!=null && V.e2<=V.e1)) lj.push({ s:'ve-pd-kabul', sekil:'alan', ad:'Statik sehim '+(V.e1!=null && V.e2!=null
    ? _mntPrmSin(V.e1)+'–'+_mntPrmSin(V.e2) : V.e1!=null ? '≥ '+_mntPrmSin(V.e1) : '≤ '+_mntPrmSin(V.e2))+' mm' });
  return _mntBolum('Statik sehim ve iletilebilirlik', '', '<div class="ve-pd-kap" data-pd="dag" data-dugum="'+node.id+'">'
    + veMntParamCiz.sehimT(V, o).svg+'</div>'+veMntParamCiz.gosterge(lj));
}
function _mntParamYakinHTML(ent, Z, L){
  var S=Z.S, D=ent.D, M=ent.M, Hk=Z.Hk, bir=S.sira[0];
  if(!bir || !L.length) return '';
  var t0=D.tipler(bir.idx), h='<ol class="ve-prm-yakin">';
  L.forEach(function(x, k){
    var t=D.tipler(x), boz=[];
    veMntKatalog.KISITLAR.forEach(function(Q, i){ if(Hk.m[x] & (1<<i)) boz.push(Q.ad); });
    var tip=M.G.map(function(g, i){
      var nm=t[i] ? ((M.lib[t[i]] || {}).name || t[i]) : ((g.tip && M.lib[g.tip]) ? M.lib[g.tip].name : '—');
      return '<li'+(t[i]===t0[i] ? ' class="ayni"' : '')+' title="'+_mntEsc(g.ad+' · '+nm)+'">'+_mntEsc(nm)+'</li>';
    }).join('');
    h+='<li><span class="ve-prm-no">'+_mntS(k+2, 0)+'</span><div class="ve-prm-y"><ul>'+tip+'</ul><div class="ve-prm-y-o">'
      + '<span>%'+_mntS(D.T[x]*100, 1)+' · '+_mntS(D.d[x], 2)+' mm</span>'
      + (boz.length ? '<span class="ve-prm-y-boz">'+veDurumIkon('err')+_mntEsc(boz.slice(0, 2).join(' · ')+(boz.length>2 ? ' …' : ''))+'</span>'
                    : '<span class="ve-prm-y-ok">'+veDurumIkon('ok')+'Uygun</span>')
      + '</div></div></li>';
  });
  return _mntBolum('Yakın seçenekler', '', h+'</ol>');
}
function _mntParamElemeHTML(Z){
  var S=Z.S, ad={}, onceki=S.N;
  veMntKatalog.KISITLAR.forEach(function(Q){ ad[Q.k]=Q.ad; });
  var h=_mntFoyAc([{ b:'Kısıt', gen:'74%', sinif:'sol' }, { b:'Kalan', gen:'26%' }], 'Eleme', 've-prm-eleme')
    + '<tr><td class="sol">Taranan</td><td>'+_mntS(S.N, 0)+'</td></tr>';
  S.huni.forEach(function(x){
    if(x.kalan===onceki) return;
    h+='<tr><td class="sol">'+(x.k==='cozulen' ? 'Çözülen' : _mntEsc(ad[x.k]))+'</td><td>'+_mntS(x.kalan, 0)+'</td></tr>';
    onceki=x.kalan;
  });
  return _mntBolum('Eleme', '', h+_MNT_FOY_KAPA);
}
// Galerinin listesi: çizilebilen diyagramlar (kesit iki, tasarım uzayı üç taranan grup ister).
function _mntPrmGaleri(ent){
  var n=ent.D.taranan.length;
  return _MNT_PRM_DIYAGRAM.filter(function(d){
    return d[0]==='d1' ? n>=3 : (d[0]==='d5' || d[0]==='d4' || d[0]==='d3') ? n>=2 : true;
  });
}
function _mntParamDiyagramHTML(node, ent){
  return _mntBolum('Diyagramlar', '', '<div class="ve-prm-dg-l">'+_mntPrmGaleri(ent).map(function(d){
    return '<button type="button" class="ve-prm-dg" data-pd="'+d[0]+'" onclick="veMntParamTamEkran(\''+node.id+'\',\''+d[0]+'\')">'
      + veIkon('maximize')+'<span>'+d[1]+'</span></button>';
  }).join('')+'</div>');
}

// Bölümün bağlamı: sınırlar, özet (bellekten), çizim ölçüsü, bellek anahtarı.
function _mntParamSonucBaglam(node, H, ent){
  var c=veMntKatalog.baglam(H.ctx), Z=_mntParamOzet(ent, c);
  var W=_MNT_PARAM_GEN[node.id] || 600, o={ W:W, fs:{ k:_mnt2DFs('micro'), o:_mnt2DFs('tiny') } };
  return { c:c, Z:Z, o:o, anahtar:Z.anahtar+'|'+W+'|'+o.fs.k+'|'+o.fs.o };
}
function _mntParamSonucHTML(node, H, ent){
  var B=_mntParamSonucBaglam(node, H, ent);
  if(ent.html && ent.html.anahtar===B.anahtar) return ent.html.v;
  var Z=B.Z, c=B.c, L=_mntPrmYakinL(ent, Z);
  var h=_mntParamOneriHTML(node, ent, Z)+_mntParamKriterHTML(ent, Z, c)+_mntParamModHTML(node, ent, Z, c, B.o)
    + _mntParamDagHTML(node, ent, Z, c, B.o, L)+_mntParamYakinHTML(ent, Z, L)+_mntParamElemeHTML(Z)+_mntParamDiyagramHTML(node, ent);
  var v='<div id="ve-mnt-prm-sonuc-'+node.id+'" data-tazele>'+h+'</div>';
  ent.html={ anahtar:B.anahtar, v:v };
  return v;
}
// Isıtıcının adımları (koşucu her birini ayrı dilimde çağırır): özet,
// önerinin ölçümü, bölüm. Pencere kurulumu aynı belleği okur.
function _mntParamSonucIsitici(node, H, ent){
  var B=null;
  return [
    function(){ B=_mntParamSonucBaglam(node, H, ent); },
    function(){ if(B && B.Z.S.sira[0]) _mntPrmOlc(ent, B.Z.S.sira[0].idx); },
    function(){ if(B) _mntParamSonucHTML(node, H, ent); }
  ];
}

// GALERİ — on diyagram tam ekranda, solda listesi; seçilen diyagram yalnız
// açılınca ve ekranın genişliğinde çizilir, pencere boyu değişince yeniden.
// Kesit, büyüklük ve kamera seçimi galeride. Diyagramlar kısıtı KODUYLA
// yazar (dar çizimde ad sığmaz): açık kısıtların kodu ve adı rayın altında.
function _mntPrmKodlar(c){
  return '<div class="ve-pd-ray-b">Kısıtlar</div><dl class="ve-pd-kod">'+veMntKatalog.KISITLAR.filter(function(Q){ return c.acik[Q.k]; }).map(function(Q){
    return '<dt>'+_mntPrmNo(Q)+'</dt><dd>'+_mntEsc(Q.ad)+'</dd>';
  }).join('')+'</dl>';
}
function veMntParamTamEkran(nodeId, pd){
  var ent=_MNT_PARAM_SONUC[nodeId], node=_mntDugum(nodeId);
  if(!ent || !node || typeof document==='undefined') return;
  var L=_mntPrmGaleri(ent);
  if(!L.length) return;
  if(!L.some(function(d){ return d[0]===pd; })) pd=L[0][0];
  if(_MNT_PARAM_TAM && _MNT_PARAM_TAM.nodeId===nodeId && document.getElementById('ve-mnt-prm-fs')){ _MNT_PARAM_TAM.sec(pd); return; }
  var ad=function(p){ return (L.filter(function(d){ return d[0]===p; })[0] || [p, p])[1]; }, gozcu=null;
  var ray='<nav class="ve-pd-ray" aria-label="Diyagramlar">'+L.map(function(d){
    return '<button type="button" data-pd="'+d[0]+'" aria-pressed="'+(d[0]===pd)+'" onclick="veMntParamTamEkran(\''+nodeId+'\',\''+d[0]+'\')">'+d[1]+'</button>';
  }).join('')+_mntPrmKodlar(veMntKatalog.baglam(_mntParamHazirlik(node).ctx))+'</nav>';
  _mntFsOverlay(ad(pd), '<div class="ve-pd-galeri">'+ray+'<div class="ve-pd-fs" id="ve-mnt-prm-fs"></div></div>', function(){
    var kap=document.getElementById('ve-mnt-prm-fs'), ov=document.getElementById('ve-mnt-fs');
    if(!kap || !ov) return;
    _mntParamHoverBagla(kap, nodeId);
    _mntPrm3bBagla(kap);
    var kur=function(){
      var p=_MNT_PARAM_TAM.pd, H=_mntParamHazirlik(node);
      if(_mntParamImza(H)!==ent.imza){ kap.innerHTML=_mntNot('Taramadan sonra girdi değişti', 'warn'); return; }
      var c=veMntKatalog.baglam(H.ctx), W=Math.floor(kap.clientWidth)-26;
      var arac=_MNT_PRM_3B[p] ? '<button type="button" class="ve-fp-dugme ve-pd-sifirla" onclick="veMntParam3bSifirla(\''+nodeId+'\',\''+p+'\')">'
        + veIkon('rotate-ccw')+' Sıfırla</button>' : '';
      var r=_mntPrmCiz(p, ent, _mntParamOzet(ent, c), c, { W:W, H:Math.max(320, Math.floor(kap.clientHeight)-(p==='d5' || p==='d4' || p==='d3' || p==='d1' ? 170 : 110)),
                                                         tam:true, arac:arac, fs:{ k:_mnt2DFs('tiny'), o:_mnt2DFs('body') } }, nodeId);
      kap.innerHTML=(r && r.svg) ? (r.ust || '')+_mntPrmKap(nodeId, p, r.svg)+(r.lj || '') : _mntNot(r ? r.not : 'Çözülen kombinasyon yok', '');
    };
    var sec=function(p){
      _MNT_PARAM_TAM.pd=p;
      ov.querySelectorAll('.ve-pd-ray button[data-pd]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-pd')===p)); });
      var bas=ov.querySelector('.ve-settings-header > span'), kutu=ov.querySelector('[role="dialog"]');
      if(bas) bas.innerHTML=veIkon('maximize')+' '+ad(p);
      if(kutu) kutu.setAttribute('aria-label', ad(p));
      kap.scrollTop=0;
      kur();
    };
    _MNT_PARAM_TAM={ nodeId:nodeId, pd:pd, kur:kur, sec:sec };
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

// ── ARAÇ İPUCU — noktanın kombinasyonu: grup başına tip, amaçlar, bozduğu kısıtların adı ─
function _mntParamIpucu(nodeId, idx){
  var ent=_MNT_PARAM_SONUC[nodeId], node=_mntDugum(nodeId);
  if(!ent || !node || !(idx>=0 && idx<ent.D.N)) return '';
  var H=_mntParamHazirlik(node), c=veMntKatalog.baglam(H.ctx), Z=_mntParamOzet(ent, c), D=ent.D;
  var t=D.tipler(idx), sat=[];
  ent.M.G.forEach(function(g, i){ if(t[i]) sat.push(g.no+' · '+((ent.M.lib[t[i]] || {}).name || t[i])); });
  if(D.d1[idx]!==1) return sat.concat(['Çözülemedi']).join('\n');
  sat.push('T %'+_mntS(D.T[idx]*100, 1)+' · δs '+_mntS(D.d[idx], 2)+' mm');
  var m=Z.Hk.m[idx], boz=[];
  veMntKatalog.KISITLAR.forEach(function(Q, i){ if(m & (1<<i)) boz.push(Q.ad); });
  sat.push(boz.length ? boz.join('\n') : (D.d2[idx]===1 ? 'Uygun' : 'İkinci aşama çözülemedi'));
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
    _mntPrm3bCizKap(kap, _mntPrm3bDurum(kap));
  });
}
function veMntParam3bSifirla(nodeId, pd){
  delete _MNT_PARAM_KAM[nodeId+'|'+pd];
  if(_MNT_PARAM_TAM && _MNT_PARAM_TAM.nodeId===nodeId && _MNT_PARAM_TAM.pd===pd) _MNT_PARAM_TAM.kur();
}

// Pencere açılınca (cp-core.js): gövdenin genişliğini ölç, değiştiyse Sonuç
// o genişlikte yerinde yeniden kurulur; araç ipucu gövdeye bir kez bağlanır
// (3B yalnız galeride).
function veMntParamCizKur(){
  if(typeof document==='undefined') return false;
  var kok=document.querySelector('.ve-properties-content [data-mnt-pencere]');
  var node=kok ? _mntDugum(kok.getAttribute('data-mnt-pencere')) : null;
  if(!node || node.type!=='mnt-parametric') return false;
  var gov=document.getElementById('ve-fp-panes-'+node.id);
  if(!gov) return false;
  _mntParamHoverBagla(gov, node.id);
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
    veMntParamCizKur: veMntParamCizKur, veMntParamRapor: veMntParamRapor, veMntParamUnut: veMntParamUnut,
    _mntParamSonucBaglam: _mntParamSonucBaglam, _mntParamSonucIsitici: _mntParamSonucIsitici,
    _mntPrmKriterler: _mntPrmKriterler, _mntPrmModV: _mntPrmModV, _mntPrmDagV: _mntPrmDagV, _mntPrmYakinL: _mntPrmYakinL,
    _mntPrmGaleri: _mntPrmGaleri, _mntPrmOlc: _mntPrmOlc, _mntPrmYaz: _mntPrmYaz
  };
}
