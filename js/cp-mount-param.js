// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ — PARAMETRİK ANALİZ penceresi ve katalog taraması koşucusu
// ════════════════════════════════════════════════════════════════════════════
// Bileşen 'mnt-parametric' (js/components.js), ilk analizi "Katalogdan seçim"
// (kullanıcı isteği 2026-10-16). Girdi kategorileri: gruplar, aday tipler (markaya
// göre katlanır gruplar), kriterler (dört kesin kriter, sıralama, rijitlik toleransı).
// SIRALAMA EXCEL'İNKİ (kullanıcı 2026-11-10: "yaptığımız değişiklikleri bu bileşene
// aktarmamışız … güncel ve modern bir hale getirelim"): dört kesin kriter, sonra en
// küçük statik sehim — ek kısıtlar, sürünme payı ve amaç ağırlığı (uzlaşı) emekli.
// Tek eylemi taramayı koşturur; tarama bitince Sonuç kategorisi K0 (mevcut) ve
// K1…K9'u Excel'in Özet'i gibi taşır (kullanıcı kararı 2026-10-18 — Takoz
// pencerelerinin "sonuç göstermez" kuralının bu pencereye özgü istisnası;
// js/cp-mount-param-sonuc.js). Ayrıntılı rapor AYRI belgede (js/cp-mount-param-rapor.js):
// ana rapora eklemek onu uzatırdı (kullanıcı: "Rapor kısmına eklersek çok uzun olabilir").
//
// ÇÖZÜM YOLU UYGULAMANINKİ: her kombinasyon Çözücü'nün yolundan geçer
// (_mntPrepareFrom → solveOne → solveModes; çözüm modu ve ζ Çözücü'den,
// f_ateş Motor'dan — raporun §8.8'iyle aynı kaynak). Ayrı bir "tarama için"
// çözüm yazılmadı: raporun seçtiği kombinasyon modele uygulandığında Çözücü
// AYNI sayıları bulmalı (tests/unit/mount-katalog.test.js → TEK YOL).
//
// Gruplama, kısıt, Pareto ve sıralama DOM'suz çekirdekte (js/mount-katalog.js).
// ════════════════════════════════════════════════════════════════════════════

var _MNT_PARAM_IS = null;       // çalışan tarama: { nodeId, dur }
var _MNT_PARAM_XLS = { is:null }; // süren Excel ya da HTML çıktısı (cp-mount-param-sonuc.js): is = { nodeId, ad, i, n, dosya }

// ── Canlı model — taramanın girdisi ─────────────────────────────────────────
// `liste` (ops.): düğüm listesi; verilmezse canlı `nodes`.
function _mntParamModel(liste){
  var nl=liste || ((typeof nodes!=='undefined' && Array.isArray(nodes)) ? nodes : []);
  var solver=nl.filter(function(n){ return n && (_mntDef(n)||{}).isMountSolver; })[0] || null;
  var gather=_mntGatherForSolver(solver, nl);
  var byId={};
  nl.forEach(function(n){ if(n) byId[n.id]=n; });
  // Mevcut tip: kütüphanenin girdisiyle 6/6 değeri aynı olan tip (seçili
  // girdi ya da değerleri tam tutan tek girdi — Takoz penceresinin eşleşmesi).
  var tak=gather.mounts.map(function(m){
    var E=byId[m.id] ? _mntKutuphaneEslesme(byId[m.id]) : null;
    return { id:m.id, name:m.name, x:_mntNum(m.x), y:_mntNum(m.y), z:_mntNum(m.z),
             libKey:(E && !E.farkli.length) ? E.e.key : null };
  });
  var eng=(typeof _mntRepEngine==='function')
    ? _mntRepEngine({ gather:{ torque:gather.torque } }, (typeof veMntRaporOpts==='function') ? veMntRaporOpts() : {})
    : { idleRpm:NaN, cylinders:NaN };
  var fAtes=(eng.idleRpm>0 && eng.cylinders>0) ? (eng.idleRpm/60)*(eng.cylinders/2) : NaN;
  return { solver:solver, gather:gather, tak:tak, G:veMntKatalog.gruplar(tak), lib:veMntGetLibraryMap(),
           eng:eng, fAtes:fAtes };
}

// Aday tipler: etkin kütüphanenin TAM ve TAHMİNSİZ tipleri (gömülü + değiştirilmiş +
// özel); kullanıcı dışarıda bıraktıklarını `haric`ta tutar — yeni eklenen tip
// kendiliğinden aday olur. Altı rijitliği olmayan tip (DSM) çözülmez; radyali
// TAHMİNİ tip (AMC'nin yayımlamadığı 132 kod, Canlı Not 113) çözülür ama aday
// DEĞİL — öneri ölçülmüş değerle verilir ve tarama 24 tipten 156'ya çıkardı
// (üç grupta 13.824 → 3,8 milyon kombinasyon); Takoz Özellikleri'nde radyali
// girilince aday olur (cp-mount.js → _mntLibTam · _mntLibTahmin).
function _mntParamAdaylar(M, node){
  if(_mntParamAnaliz(node)==='konum') return _mntParamKonumAdaylar(node).adaylar;
  var haric={};
  ((node && node.data && node.data.haric) || []).forEach(function(k){ haric[k]=true; });
  var tam=(typeof _mntLibTam==='function') ? _mntLibTam : function(){ return true; };
  var tahmin=(typeof _mntLibTahmin==='function') ? _mntLibTahmin : function(){ return []; };
  return Object.keys(M.lib).filter(function(k){ return M.lib[k].aday!==false && tam(M.lib[k]) && !tahmin(M.lib[k]).length; })
    .map(function(k){ return { key:k, name:M.lib[k].name, e:M.lib[k], dahil:!haric[k] }; });
}

// ANALİZ TÜRÜ (F007): 'katalog' (varsayılan — tip taranır) · 'konum' (tip
// modeldeki gibi, grubun takozları boyuna ve düşey kayar). Alan yalnız konumda
// yazılır; eski projeler katalog olarak açılır.
var VE_MNT_PARAM_ANALIZ = [['katalog', 'Katalogdan seçim'], ['konum', 'Konum taraması']];
function _mntParamAnaliz(node){
  return (node && node.data && node.data.analiz==='konum') ? 'konum' : 'katalog';
}
// Konum adayları: Δx × Δz ızgarası, grubun bütün takozlarına aynı kayma.
function _mntParamKonumAdaylar(node){
  var K=veMntKatalog.konumAdaylari((node && node.data && node.data.konum) || {});
  K.adaylar=K.adaylar.map(function(a){ return { key:a.key, name:_mntParamKonumAd(a.dx, a.dz), dx:a.dx, dz:a.dz, konum:true, dahil:true }; });
  return K;
}
function _mntParamIsaretli(v){ return (v>0 ? '+' : '')+_mntS(v, Math.abs(v-Math.round(v))>1e-9 ? 1 : 0); }
function _mntParamKonumAd(dx, dz){ return 'Δx '+_mntParamIsaretli(dx)+' · Δz '+_mntParamIsaretli(dz)+' mm'; }
// Adayın ve grubun adı — iki analizde aynı yerden (Sonuç, Excel, ipucu, rapor).
function _mntParamAdayAdi(M, key){
  if(!key) return null;
  var k=veMntKatalog.konumOku(key);
  if(k) return _mntParamKonumAd(k.dx, k.dz);
  return (M.lib[key] || {}).name || key;
}
// Grubun bugünkü değeri: katalogda tipi, konumda kaymasız aday.
function _mntParamMevcutAdi(M, g){
  if(M.analiz==='konum') return _mntParamKonumAd(0, 0);
  return (g.tip && M.lib[g.tip]) ? M.lib[g.tip].name : '—';
}
// Aday grubun bugünkü değeri mi (katalog: aynı tip · konum: Δ 0).
function _mntParamAdayAyni(M, g, key){
  var k=veMntKatalog.konumOku(key);
  return k ? (k.dx===0 && k.dz===0) : key===g.tip;
}
// Grubun konumu (ortalama x · z, mm) adayla.
function _mntParamGrupKonum(M, g, key){
  var k=veMntKatalog.konumOku(key) || { dx:0, dz:0 };
  return { x:g.x+k.dx, z:g.z+k.dz };
}

// Bağlam: DÖRT KESİN KRİTER ve rijitlik toleransı — ek kısıtlar KAPALI (Excel'in
// kuralı; eski projede yazılı ek kısıt ve ağırlık okunmaz). Tolerans açıkken kesin
// kriterler ±tolerans köşelerinde de sınanır.
function _mntParamCtx(M, node){
  var d=(node && node.data) || {}, s=d.sinir || {}, o={}, acik={};
  veMntKatalog.KISITLAR.forEach(function(Q){ if(!Q.zorunlu) acik[Q.k]=false; });
  acik.tolerans=!!(d.acik && d.acik.tolerans);
  var t=_mntNum(s.tolerans, NaN);
  if(Number.isFinite(t)) o.tolerans=t/100;
  return { fAtes:M.fAtes, acik:acik, s:o };
}

// Taramanın bütün girdisi ve eksiği (pencere ile koşucu AYNI hazırlığı okur).
function _mntParamHazirlik(node, liste){
  var M=_mntParamModel(liste), analiz=_mntParamAnaliz(node);
  M.analiz=analiz;
  var A=_mntParamAdaylar(M, node);
  var sabit=(node && node.data && node.data.sabit) || {};
  var aday=A.filter(function(a){ return a.dahil; });
  var N=veMntKatalog.kombinasyonSayisi(M.G, aday.length, sabit);
  var eksik=!M.tak.length ? 'Takoz yok'
    : !(M.fAtes>0) ? 'Rölanti devri ve silindir sayısı yok'
    : !aday.length ? 'Aday tip yok'
    : !N ? 'Taranacak grup yok'
    : N>veMntKatalog.MAKS_KOMB ? 'Kombinasyon sayısı '+_mntS(veMntKatalog.MAKS_KOMB, 0)+' üstünde' : '';
  return { M:M, A:A, aday:aday, sabit:sabit, N:N, eksik:eksik, ctx:_mntParamCtx(M, node), analiz:analiz };
}

// ── Ölçüm — bir kombinasyon Çözücü'nün yolundan ────────────────────────────
// tipler: grup başına kütüphane anahtarı ya da null (grup modelde olduğu gibi).
// ctx: veMntKatalog.baglam(...) — sürünme payı ve tolerans ondan.

// Bütün rijitlik tabanını s katına çeker: statik ve dinamik rijitlik, analitik
// fit katsayıları (poly k0 · c3 · c5; asym comp.k0 · ext.k0 · ext.c3) ve eğrinin
// kuvvet sütunu — her yasa kuvvette doğrusal ölçeklenir, dinamik/statik oranı
// korunur. Tolerans köşesi (üretimde ±%15 rijitlik saçılması) bununla kurulur.
function _mntParamOlcekle(d, s){
  ['kxs','kys','kzs','kxd','kyd','kzd'].forEach(function(k){ d[k]=_mntNum(d[k], 0)*s; });
  ['X','Y','Z'].forEach(function(A){
    var f=d['fit'+A], c=d['curve'+A];
    if(f){
      f=JSON.parse(JSON.stringify(f));
      if(f.form==='poly'){ f.k0=(f.k0||0)*s; f.c3=(f.c3||0)*s; f.c5=(f.c5||0)*s; }
      else if(f.form==='asym'){ if(f.comp) f.comp.k0=(f.comp.k0||0)*s; if(f.ext){ f.ext.k0=(f.ext.k0||0)*s; f.ext.c3=(f.ext.c3||0)*s; } }
      d['fit'+A]=f;
    }
    if(Array.isArray(c)) d['curve'+A]=c.map(function(p){ return [_mntNum(p[0]), _mntNum(p[1])*s]; });
  });
}

function _mntParamOlcucu(M, ctx){
  var C=veMountCore, g=M.gather, solver=M.solver || { data:{} };
  var c=ctx || veMntKatalog.baglam({ fAtes:M.fAtes });
  var tol=c.acik.tolerans ? c.s.tolerans : 0, sur=c.s.surunme;
  function hazirla(tipler, s){
    var mounts=g.mounts.slice();
    M.G.forEach(function(grp, gi){
      var key=tipler ? tipler[gi] : null, e=key ? M.lib[key] : null, kk=key ? veMntKatalog.konumOku(key) : null;
      if(!e && !kk) return;
      grp.uyeler.forEach(function(i){
        var d=Object.assign({}, mounts[i]);
        if(e) _mntLibGirdiYaz(d, e, key);
        else { d.x=_mntNum(d.x)+kk.dx; d.z=_mntNum(d.z)+kk.dz; }   // konum adayı: grubun bütün takozları aynı kayar
        mounts[i]=d;
      });
    });
    if(s && s!==1) mounts=mounts.map(function(m){ var d=Object.assign({}, m); _mntParamOlcekle(d, s); return d; });
    // Toplayıcının TAMAMI Çözücü'nünki (yön ayarı: ileri · kaldırım · tork yönü; bağlantı
    // yüzü), yalnız takozlar değişir — yön düşünce yük durumları varsayılana iniyordu:
    // Tulga'da (tork +X) iki tork durumu ters, Adams'tan RMS 17,28 mm.
    return _mntPrepareFrom(Object.assign({}, g, { mounts:mounts }), solver);
  }
  function statik(prep){
    for(var i=0;i<prep.loadCases.length;i++) if(prep.loadCases[i].name==='Static') return prep.loadCases[i];
    return prep.loadCases[0];
  }
  // HAZIRLIK + STATİK DENGE, kombinasyon ve ölçek başına BİR kez: iki aşama
  // (tam tarama tek geçişte ardışık ölçer; raporun satırları da) aynı
  // hazırlığı ve statik çözümü paylaşır — Çözücü de tek hazırlıkla çözer.
  // solveOne hazırlığa yazmaz; solveModes yalnız modal matrisleri saklar.
  // Bellek tek kombinasyon (son ölçülen).
  var son={ k:null, e:{} };
  function hazir(tipler, s){
    var k=(tipler || []).join('|');
    if(son.k!==k) son={ k:k, e:{} };
    var e=son.e[s];
    if(!e){
      var prep=hazirla(tipler, s);
      e=son.e[s]={ prep:prep, st:(prep && !prep.error) ? prep.solveOne(statik(prep)) : null };
    }
    return e;
  }
  // Birinci aşama: statik denge + modal (modlar statik dengenin tanjantında).
  function bir(tipler, s){
    var e=hazir(tipler, s), prep=e.prep, st=e.st;
    if(!prep || prep.error) return null;
    if(!st || !st.res) return null;
    var modes=prep.solveModes([st]);
    if(!modes || !modes.length) return null;
    var fB=C.bounceFrequency(prep.mounts, prep.mp.m, prep.kBasis);
    var K=modes.map(function(md){ return veMntKatalog.ked(md.phi, prep.M6); });
    var en=function(j){ var m=0; K.forEach(function(v){ if(v && v[j]>m) m=v[j]; }); return m; };
    return {
      f:modes.map(function(md){ return md.f_Hz; }), modes:modes, fB:fB,
      T:C.transmissibility(M.fAtes, fB, prep.zeta),
      dz:st.res.perMount.map(function(pm){ return pm.delta[2]*1000; }),
      pay:C.mountLoadShares(st.res, prep.si.g),
      kap:prep.mounts.map(function(m){ return m.fCap>0 ? m.fCap/prep.si.g : null; }),
      ked:{ bounce:en(2), roll:en(3) },
      m:prep.mp.m, zeta:prep.zeta, mod:prep.mode, solvedNL:prep.solvedNL
    };
  }
  function olc1(tipler){
    var o=bir(tipler, 1);
    if(o && tol){
      o.sert=bir(tipler, 1+tol); o.yumusak=bir(tipler, 1-tol);
      if(!o.sert || !o.yumusak) return null;
    }
    return o;
  }
  // İkinci aşama: işletme yük durumları — sehim, sürünmüş çalışma noktasında
  // sehim (E7) ve çekme — ve darbe durumları — en büyük sehim, durdurucuya
  // oturan takoz, yük/kapasite. SÜRÜNME düşey çalışma noktasını statik sehimin
  // `sur` katı kadar aşağı kaydırır (Paulstra: bir yılda +%20 · 45 ShA …
  // +%33 · 75 ShA).
  function iki(tipler, s){
    var e=hazir(tipler, s), prep=e.prep, st=e.st;
    if(!prep || prep.error) return null;
    if(!st || !st.res) return null;
    var dzS=st.res.perMount.map(function(pm){ return pm.delta[2]; });
    var dIsl=prep.mounts.map(function(){ return 0; }), dSur=dIsl.slice(), cekme=0, nIsl=0, hata=false;
    var darbe={ d:0, durdurucu:0, n:0 }, oran=null;
    var kap=prep.mounts.map(function(m){ return m.fCap>0 ? m.fCap : 0; });
    prep.loadCases.concat(prep.gearDefs, prep.designDefs).forEach(function(lc){
      if(hata) return;
      var isl=veMntKatalog.isletmeMi(lc);
      var rc=(lc.name==='Static' && lc===statik(prep)) ? st : prep.solveOne(lc);
      if(!rc || !rc.res){ hata=true; return; }
      rc.res.perMount.forEach(function(pm, i){
        if(isl){
          var yat=Math.max(Math.abs(pm.delta[0]), Math.abs(pm.delta[1]));
          var d=Math.max(yat, Math.abs(pm.delta[2]))*1000, ds=Math.max(yat, Math.abs(pm.delta[2]+sur*dzS[i]))*1000;
          if(d>dIsl[i]) dIsl[i]=d;
          if(ds>dSur[i]) dSur[i]=ds;
          if(pm.tension && pm.delta[2]*1000>cekme) cekme=pm.delta[2]*1000;
        } else {
          var dd=Math.max(Math.abs(pm.delta[0]), Math.abs(pm.delta[1]), Math.abs(pm.delta[2]))*1000;
          if(dd>darbe.d) darbe.d=dd;
          if(pm.clamped) darbe.durdurucu++;
          if(kap[i]>0){ var r=Math.abs(pm.f[2])/kap[i]; if(oran===null || r>oran) oran=r; }
        }
      });
      if(isl) nIsl++; else darbe.n++;
    });
    if(hata) return null;
    return { dIsl:dIsl, dSur:dSur, cekmeMm:cekme, isletmeN:nIsl, darbe:darbe, darbeOran:oran };
  }
  function olc2(tipler){
    var o=iki(tipler, 1);
    if(o && tol){
      o.yumusak=iki(tipler, 1-tol);
      if(!o.yumusak) return null;
    }
    return o;
  }
  // Excel çıktısı (cp-mount-param-sonuc.js → veMntParamExcelIndir): anma
  // rijitlikte birinci aşama (tarama satırı) ve konfigürasyonun TAM çözümü —
  // modelin her yük durumunda takoz başına yer değiştirme [mm] ve modlar.
  function anma(tipler){ return bir(tipler, 1); }
  function tam(tipler){
    var e=hazir(tipler, 1), prep=e.prep, st=e.st;
    if(!prep || prep.error || !st || !st.res) return null;
    var o=bir(tipler, 1);
    var vakalar=prep.loadCases.map(function(lc){
      var rc=(lc===statik(prep)) ? st : prep.solveOne(lc);
      return { ad:lc.name, d:(rc && rc.res) ? rc.res.perMount.map(function(pm){
        return [pm.delta[0]*1000, pm.delta[1]*1000, pm.delta[2]*1000]; }) : null };
    });
    return { o:o, vakalar:vakalar, modlar:o ? o.modes.map(function(md){ return { f:md.f_Hz, ad:md.label }; }) : [] };
  }
  return { olc1:olc1, olc2:olc2, anma:anma, tam:tam };
}

// ── PENCERE ─────────────────────────────────────────────────────────────────
// PENCERE BOŞ (kullanıcı 2026-11-11, Canlı Not 1001: *"TÜM BİLEŞEN PENCERESİNİ
// temizleyelim. İçerikleri, onu bunu. Her şeyi kaldıralım. Adım adım kurgulayacağız
// sistemimizi."*): pencere yalnız kimlik (başlık · ad · sil) — bölüm, sağ sütun ve eylem
// yok. Eski pencere (_mntParamEskiPencereHTML) ve arkasındaki tarama, Sonuç, Excel ve
// rapor kodda ve testli, pencereye BAĞLI DEĞİL: yeniden kurulumda parça parça bağlanır
// ya da emekli edilir (e2e onu bu işlevin yerine koyar — mount-param-sonuc.spec.js).
function getMntParamPropertiesHTML(node){
  if(!node.data) node.data={};
  return _mntPencereKabuk(node, [], '');
}

// ESKİ PENCERE (Canlı Not 1001'e dek) — kategoriler, gövdede alt alta: GRUPLAR (model
// taraması, sabit tutulan grup) · ADAYLAR (kütüphane, marka marka) · KRİTERLER (dört
// kesin kriter, sıralama, tolerans) · SONUÇ (yalnız taramadan sonra). Sağ sütun:
// analizin adı ve büyüklüğü → cevap → eylem.
function _mntParamEskiPencereHTML(node){
  if(!node.data) node.data={};
  var H=_mntParamHazirlik(node);
  var kategoriler=[
    { k:'grup', ad:'Gruplar', govde:_mntParamGrupHTML(node, H) },
    H.analiz==='konum' ? { k:'konum', ad:'Konum', govde:_mntParamKonumHTML(node, H) }
                       : { k:'aday', ad:'Adaylar', govde:_mntParamAdayHTML(node, H) },
    { k:'kriter', ad:'Kriterler', govde:_mntParamKriterHTML(node, H) }
  ];
  var son=(typeof _mntParamSonucKat==='function') ? _mntParamSonucKat(node, H) : null;
  if(son) kategoriler.push(son);
  return _mntPencereKabuk(node, kategoriler, _mntParamYanHTML(node, H));
}

// Taramanın eksiğine çare — yalnız yolu pencerenin DIŞINDA olan iki eksik;
// aday, sabit grup ve kombinasyon sınırı aynı pencerede.
function _mntParamEksikYonu(eksik){
  if(eksik === 'Rölanti devri ve silindir sayısı yok') return veYon('Motor penceresinde girin.');
  if(eksik === 'Takoz yok') return veYon('Bileşenler’den takoz ekleyin.');
  return '';
}
function _mntParamYanHTML(node, H){
  var ozet=_mntBolum('Analiz', '', _mntParamAnalizSecici(node, H)+
    _mntIzgara(3, _mntOku('Grup', String(H.M.G.length)) + _mntOku(H.analiz==='konum' ? 'Konum' : 'Tip', String(H.aday.length))
               + _mntOku('Kombinasyon', _mntS(H.N, 0))),
    { id:'ve-mnt-param-ozet-'+node.id, tazele:true });
  // Cevap: eksik → sebebi; taze tarama → bugünkü sınırlarla uygun sayısı.
  var T=(!H.eksik && typeof _mntParamSonucDurum==='function') ? _mntParamSonucDurum(node.id, H) : null, cevap;
  if(H.eksik) cevap=_mntDurumKutu('<b>'+H.eksik+'</b>'+(_mntParamEksikYonu(H.eksik) ? '. '+_mntParamEksikYonu(H.eksik) : ''), 'warn');
  else if(T && T.taze){
    var S=_mntParamOzet(T.ent, veMntKatalog.baglam(H.ctx)).S;
    cevap=_mntDurumKutu('<b>Uygun '+_mntS(S.uygunN, 0)+' / '+_mntS(S.N, 0)+'</b>', S.uygunN ? 'ok' : 'warn');
  } else cevap=_mntDurumKutu('<b>Taramaya hazır</b>', 'ok');
  var durum='<div id="ve-mnt-param-durum-'+node.id+'" data-tazele>'+cevap+'</div>';
  var is=!!(_MNT_PARAM_IS && _MNT_PARAM_IS.nodeId===node.id);
  // Düğme de yerinde tazelenir (`data-tazele`): aday kalmayınca ya da bütün
  // gruplar sabitlenince pencere yeniden kurulmadan kapanır. Süren tarama
  // pencere yeniden kurulsa da ilerlemesiyle çizilir.
  var dugme='<button type="button" class="ve-fp-solve" id="ve-mnt-param-btn-'+node.id+'" data-tazele'
    + ((H.eksik && !is) ? ' disabled aria-describedby="ve-mnt-param-durum-'+node.id+'"' : ' onclick="veMntParamTara(\''+node.id+'\')"')+(is ? ' data-durdur' : '')+'>'
    + (is ? veIkon('square')+' Durdur' : veIkon('play')+' Tara')+'</button>';
  var eylem=vePencereEylem(dugme, '<div class="ve-fp-durum-not" id="ve-mnt-param-st-'+node.id+'"></div>',
                           _mntParamIlerleme(node.id));
  return ozet+durum+eylem;
}

// Grubun ve tipin adı hücrede SARAR (`td.sar`): kırpılan ad kütüphanede iki
// tipe birden uyuyordu ("Cone 67 50Sh (AMC 1…" · "57RS313774…"). Sondaki
// parantezli künye tek blok (`.ve-mnt-ek`): sığmazsa bütünüyle alt satıra
// iner. Kod satır sonunda bölünmez (`.ve-mnt-nw`): tireli ya da eğik çizgili
// ("ASR-SR-116", "Sağ/Sol"), büyük harfli önek + numara ("NG 55") ve sertlik
// ("60 ShA").
function _mntParamAd(ad){
  var s=String(ad==null ? '' : ad), m=/^(.*\S)\s+(\([^()]*\))$/.exec(s);
  var kod=function(x){
    return _mntEsc(x).replace(/(^|[^\p{L}\p{N}])(\p{Lu}{2,} \d\S*(?: ShA)?|\d+ ShA)|\S*[-–/]\S*/gu, function(t, on, k){
      return k ? on+'<span class="ve-mnt-nw">'+k+'</span>' : '<span class="ve-mnt-nw">'+t+'</span>';
    });
  };
  return m ? kod(m[1])+' <span class="ve-mnt-ek">'+kod(m[2])+'</span>' : kod(s);
}

function _mntParamGrupHTML(node, H){
  var G=H.M.G, konum=H.analiz==='konum';
  if(!G.length) return _mntBolum('Gruplar', '', _mntNot('Takoz yok', 'warn'));
  // Konumda tip sütunu yok (taranmaz; sütun kenar çubuğunda kodu kesiyordu), z var.
  var h=_mntFoyAc(konum
    ? [{ b:'No', gen:'8%' }, { b:'Grup', gen:'45%', sinif:'sol' }, { b:'x <u>[mm]</u>', gen:'17%' }, { b:'z <u>[mm]</u>', gen:'17%' },
       { b:'Tara', gen:'13%', sinif:'ve-mnt-sec' }]
    : [{ b:'No', gen:'8%' }, { b:'Grup', gen:'31%', sinif:'sol' }, { b:'x <u>[mm]</u>', gen:'15%' },
       { b:'Mevcut tip', gen:'33%', sinif:'sol' }, { b:'Tara', gen:'13%', sinif:'ve-mnt-sec' }], 'Takoz grupları', 've-mnt-foy--sar ve-mnt-foy--ad');
  G.forEach(function(g){
    var tip=(g.tip && H.M.lib[g.tip]) ? H.M.lib[g.tip].name : '—';
    h+='<tr><td>'+g.no+'</td><td class="sol sar">'+_mntParamAd(g.ad)+'</td><td>'+_mntS(g.x, 0)+'</td>'
     + (konum ? '<td>'+_mntS(g.z, 0)+'</td>' : '<td class="sol sar">'+_mntParamAd(tip)+'</td>')
     + '<td class="ve-mnt-sec"><input type="checkbox"'+(H.sabit[g.anahtar] ? '' : ' checked')
     + ' aria-label="'+_mntEsc('Tara · '+g.ad)+'" onchange="veMntParamSabit(\''+node.id+'\','+g.no+',!this.checked)"></td></tr>';
  });
  return _mntBolum('Gruplar', G.length+' grup', h+_MNT_FOY_KAPA);
}

// ADAYLAR — marka marka katlanır grup (kütüphanenin markası, Canlı Not 106): özetin
// kutusu markanın bütün tiplerini alır ya da bırakır, sayısı alınan / bütün; açıklık
// görünüm durumu (_MNT_PARAM_MARKA, modelde değil), açılışta kapalı.
var _MNT_PARAM_MARKA = {};       // 'düğüm|marka' → açık
function _mntParamMarkalar(A){
  var sira=((typeof VE_MNT_LIB_MARKALAR!=='undefined') ? VE_MNT_LIB_MARKALAR : [])
    .concat([(typeof VE_MNT_LIB_MARKA_OZEL!=='undefined') ? VE_MNT_LIB_MARKA_OZEL : 'Özel takozlar']);
  var G={}, ad=[];
  A.forEach(function(a){
    var m=(a.e && a.e.marka) || 'Diğer';
    if(!G[m]){ G[m]=[]; ad.push(m); }
    G[m].push(a);
  });
  ad.sort(function(x, y){
    var i=sira.indexOf(x), j=sira.indexOf(y);
    return (i<0 ? 99 : i)-(j<0 ? 99 : j) || x.localeCompare(y, 'tr');
  });
  return ad.map(function(m){ return { ad:m, A:G[m], n:G[m].filter(function(a){ return a.dahil; }).length }; });
}
function _mntParamAnalizSecici(node, H){
  var o=VE_MNT_PARAM_ANALIZ.map(function(a){
    return '<option value="'+a[0]+'"'+(a[0]===H.analiz ? ' selected' : '')+'>'+a[1]+'</option>';
  }).join('');
  return _mntIzgara(1, '<label class="ve-fp-f"><span class="ve-fp-l">Tür</span>'
    + '<select class="ve-fp-sel" id="ve-mnt-param-analiz-'+node.id+'" onchange="veMntParamAnaliz(\''+node.id+'\',this.value)">'+o+'</select></label>');
}
// KONUM — boyuna (Δx) ve düşey (Δz) kaymanın aralığı ve adımı; seri sıfırdan
// dışa adımlanır (mevcut konum adaydır).
var _MNT_PARAM_KONUM_EKSEN = [['dx', 'Boyuna Δx'], ['dz', 'Düşey Δz']];
function _mntParamKonumHTML(node, H){
  var K=_mntParamKonumAdaylar(node), o=K.ayar;
  var h=_mntFoyAc([{ b:'Yön', gen:'28%', sinif:'sol' }, { b:'En az', gen:'17%' }, { b:'En çok', gen:'17%' },
                   { b:'Adım', gen:'17%' }, { b:'Değer', gen:'21%' }], 'Konum aralığı <u>[mm]</u>');
  _MNT_PARAM_KONUM_EKSEN.forEach(function(E){
    var alan=function(s){
      var k=E[0]+s;
      return '<td class="gir"><input type="text" inputmode="decimal" id="ve-mnt-param-'+k+'-'+node.id+'" value="'+_mntEsc(o[k])+'"'
        + ' aria-label="'+_mntEsc(E[1]+' · '+{ Min:'en az', Max:'en çok', Adim:'adım' }[s])+'"'
        + ' onchange="veMntParamKonum(\''+node.id+'\',\''+k+'\',this.value)"></td>';
    };
    h+='<tr><td class="sol">'+E[1]+'</td>'+alan('Min')+alan('Max')+alan('Adim')+'<td>'+_mntS((E[0]==='dx' ? K.ax : K.az).length, 0)+'</td></tr>';
  });
  return _mntBolum('Konum', _mntS(K.adaylar.length, 0)+' aday', h+_MNT_FOY_KAPA);
}

function _mntParamAdayHTML(node, H){
  var A=H.A, n=H.aday.length;
  if(!A.length) return _mntBolum('Adaylar', '', _mntNot('Kütüphanede tip yok', 'warn'), { emId:'ve-mnt-param-aday-em-'+node.id });
  var h='<div class="ve-prm-marka-l">'
    + '<label class="ve-prm-hepsi"><input type="checkbox"'+(n===A.length ? ' checked' : '')+' aria-label="Tüm tipler"'
    + ' onchange="veMntParamAdayHepsi(\''+node.id+'\',this.checked)"><span>Tümü</span></label>';
  _mntParamMarkalar(A).forEach(function(M){
    var acik=!!_MNT_PARAM_MARKA[node.id+'|'+M.ad];
    h+='<details class="ve-prm-marka"'+(acik ? ' open' : '')+' data-marka="'+_mntEsc(M.ad)+'"'
      + ' ontoggle="veMntParamMarkaAc(\''+node.id+'\',this.dataset.marka,this.open)">'
      + '<summary><input type="checkbox"'+(M.n===M.A.length ? ' checked' : '')+' aria-label="'+_mntEsc(M.ad)+'"'
      + ' onchange="veMntParamMarka(\''+node.id+'\',this.closest(\'details\').dataset.marka,this.checked)">'
      + '<span class="ve-prm-marka-ad">'+_mntEsc(M.ad)+'</span>'
      + '<span class="ve-prm-marka-n">'+M.n+' / '+M.A.length+'</span>'+veIkon('chevron-down')+'</summary>'
      + _mntFoyAc([{ b:'', gen:'8%', sinif:'ve-mnt-sec' }, { b:'Tip', gen:'42%', sinif:'sol' },
                   { b:_mntSym('k<sub>z</sub>')+' stat. <u>[N/mm]</u>', gen:'16%' },
                   { b:_mntSym('k<sub>z</sub>')+' din. <u>[N/mm]</u>', gen:'16%' },
                   { b:'Yasa', gen:'18%', sinif:'sol' }], M.ad+' · aday tipler', 've-mnt-foy--sar ve-mnt-foy--ad');
    M.A.forEach(function(a){
      h+='<tr><td class="ve-mnt-sec"><input type="checkbox"'+(a.dahil ? ' checked' : '')
       + ' aria-label="'+_mntEsc(a.name)+'" onchange="veMntParamAday(\''+node.id+'\',\''+_mntEsc(a.key)+'\',this.checked)"></td>'
       + '<td class="sol sar">'+_mntParamAd(a.name)+'</td>'
       + '<td>'+_mntS(_mntNum(a.e.sz, NaN), 0)+'</td><td>'+_mntS(_mntNum(a.e.dz, NaN), 0)+'</td>'
       + '<td class="sol">'+(_mntEntryHasLaw(a.e) ? 'eğri' : 'doğrusal')+'</td></tr>';   // sütun 18 %: "doğrusal" sığar
    });
    h+=_MNT_FOY_KAPA+'</details>';
  });
  return _mntBolum('Adaylar', n+' / '+A.length, h+'</div>', { emId:'ve-mnt-param-aday-em-'+node.id });
}

// Rijitlik toleransının alan değeri (pencerede yüzde, çekirdekte oran).
function _mntParamTolerans(node){
  var s=(node.data && node.data.sinir) || {};
  return _mntBos(s.tolerans) ? +(veMntKatalog.SINIR_VARSAYILAN.tolerans*100).toFixed(6) : s.tolerans;   // makine: oran → alan değeri
}
// KRİTERLER — Excel'in Özet'indeki dört kesin kriter (adı ve sınırı aynı), sıralama
// ölçütü ve rijitlik toleransı (açıkken kesin kriterler ±tolerans köşelerinde de).
var _MNT_PARAM_KRITER_AD = { k1:'Modal bant', k1a:'Mod ayrıklığı', k1b:'8–10 Hz bandında mod', k2:'TR' };
function _mntParamKriterSinir(k, fAtes){
  var K=veMntKatalog, b='&nbsp;';
  if(k==='k1') return (fAtes>0) ? '&lt;'+b+_mntS(K.K1_ORAN*fAtes, 2)+b+'Hz' : '&lt;'+b+'½·f<sub>ateş</sub>';
  if(k==='k1a') return '&gt;'+b+_mntS(K.K1A_HZ, 1)+b+'Hz';
  if(k==='k1b') return 'Yok';
  return '&lt;'+b+'%'+_mntS(K.K2_T*100, 0);
}
function _mntParamKriterHTML(node, H){
  var K=veMntKatalog, c=K.baglam(H.ctx);
  var h=_mntFoyAc([{ b:'No', gen:'12%' }, { b:'Kriter', gen:'54%', sinif:'sol' }, { b:'Sınır', gen:'34%' }], 'Kesin kriterler');
  K.KISITLAR.forEach(function(Q){
    if(!Q.zorunlu) return;
    h+='<tr><td>'+Q.no+'</td><td class="sol">'+_MNT_PARAM_KRITER_AD[Q.k]+'</td><td>'+_mntParamKriterSinir(Q.k, H.M.fAtes)+'</td></tr>';
  });
  h+=_MNT_FOY_KAPA;
  var tol='<div class="ve-fp-f"><label class="ve-fp-l" for="ve-mnt-param-tolerans-'+node.id+'">Rijitlik toleransı ± <u>[%]</u></label>'
    + '<span class="ve-prm-tol"><input type="checkbox"'+(c.acik.tolerans ? ' checked' : '')+' aria-label="Rijitlik toleransı"'
    + ' onchange="veMntParamToleransAc(\''+node.id+'\',this.checked)">'
    + '<input class="ve-fp-inp" type="text" inputmode="decimal" id="ve-mnt-param-tolerans-'+node.id+'"'
    + ' value="'+_mntEsc(_mntParamTolerans(node))+'"'+(c.acik.tolerans ? '' : ' disabled title="Rijitlik toleransı kapalı"')
    + ' onchange="veMntParamTolerans(\''+node.id+'\',this.value)"></span></div>';
  return _mntBolum('Kesin kriterler', '', h)
    + _mntBolum('Sıralama', '', _mntIzgara(2, _mntOku('Ölçüt', 'Statik sehim') + tol));
}

// ── Ayarlar ─────────────────────────────────────────────────────────────────
function _mntParamDugum(nodeId){
  var n=_mntDugum(nodeId);
  if(n && !n.data) n.data={};
  return n;
}
function veMntParamSabit(nodeId, no, sabit){
  var n=_mntParamDugum(nodeId); if(!n) return;
  var g=_mntParamModel().G[no-1]; if(!g) return;
  var s=Object.assign({}, n.data.sabit || {});
  if(sabit) s[g.anahtar]=true; else delete s[g.anahtar];
  if(Object.keys(s).length) n.data.sabit=s; else delete n.data.sabit;
  if(typeof saveState==='function') saveState();
}
function veMntParamAnaliz(nodeId, analiz){
  var n=_mntParamDugum(nodeId); if(!n) return;
  if(analiz==='konum') n.data.analiz='konum'; else delete n.data.analiz;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(n);
}
// Konum aralığı (mm). Geçersiz değer (en az > 0, en çok < 0, adım ≤ 0), boş ya
// da varsayılan → alan silinir.
function veMntParamKonum(nodeId, key, val){
  var n=_mntParamDugum(nodeId); if(!n) return;
  if(!(key in veMntKatalog.KONUM_VARSAYILAN)) return;
  var k=Object.assign({}, n.data.konum || {}), v=_mntNum(val, NaN);
  var gecerli=Number.isFinite(v) && (/Min$/.test(key) ? v<=0 : /Max$/.test(key) ? v>=0 : v>0);
  if(String(val==null ? '' : val).trim()!=='' && gecerli && v!==veMntKatalog.KONUM_VARSAYILAN[key]) k[key]=v; else delete k[key];
  if(Object.keys(k).length) n.data.konum=k; else delete n.data.konum;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(n);
}
function veMntParamAday(nodeId, key, dahil){
  var n=_mntParamDugum(nodeId); if(!n) return;
  var h=(n.data.haric || []).filter(function(k){ return k!==key; });
  if(!dahil) h.push(key);
  if(h.length) n.data.haric=h; else delete n.data.haric;
  if(typeof saveState==='function') saveState();
}
// Markanın bütün tipleri alınır ya da bırakılır.
function veMntParamMarka(nodeId, marka, dahil){
  var n=_mntParamDugum(nodeId); if(!n) return;
  var keys=_mntParamAdaylar(_mntParamModel(), n).filter(function(a){ return ((a.e && a.e.marka) || 'Diğer')===marka; })
    .map(function(a){ return a.key; });
  var h=(n.data.haric || []).filter(function(k){ return keys.indexOf(k)<0; });
  if(!dahil) h=h.concat(keys);
  if(h.length) n.data.haric=h; else delete n.data.haric;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(n);
}
// Marka grubunun açıklığı — görünüm durumu, modele yazılmaz.
function veMntParamMarkaAc(nodeId, marka, acik){
  if(acik) _MNT_PARAM_MARKA[nodeId+'|'+marka]=true; else delete _MNT_PARAM_MARKA[nodeId+'|'+marka];
}
function veMntParamAdayHepsi(nodeId, dahil){
  var n=_mntParamDugum(nodeId); if(!n) return;
  if(dahil) delete n.data.haric; else n.data.haric=Object.keys(veMntGetLibraryMap());
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(n);
}
// Sınır (pencere birimi: mm, %, ağırlık 0–1). Boş ya da geçersiz → alan
// silinir, varsayılan geçerli olur (alan varsayılanı değer olarak gösterir).
// Rijitlik toleransı: değer (%, aralığı çekirdeğin) ve açıklık — taramanın tek ayarı.
// Eski projenin öteki sınırları ve açıklıkları okunmaz, yazılmaz.
function veMntParamTolerans(nodeId, val){
  var n=_mntParamDugum(nodeId); if(!n) return;
  var s=Object.assign({}, n.data.sinir || {}), v=_mntNum(val, NaN), r=veMntKatalog.SINIR_ARALIK.tolerans, x=v/100;
  var gecerli=(r[2] ? x>r[0] : x>=r[0]) && x<=r[1];
  if(String(val==null ? '' : val).trim()!=='' && gecerli) s.tolerans=v; else delete s.tolerans;
  if(Object.keys(s).length) n.data.sinir=s; else delete n.data.sinir;
  if(typeof saveState==='function') saveState();
}
function veMntParamToleransAc(nodeId, acik){
  var n=_mntParamDugum(nodeId); if(!n) return;
  var a=Object.assign({}, n.data.acik || {});
  if(acik) a.tolerans=true; else delete a.tolerans;
  if(Object.keys(a).length) n.data.acik=a; else delete n.data.acik;
  if(typeof saveState==='function') saveState();
  if(typeof document!=='undefined'){                                   // değer alanı açıklığı izler
    var el=document.getElementById('ve-mnt-param-tolerans-'+nodeId);
    if(el){ el.disabled=!acik; if(acik) el.removeAttribute('title'); else el.title='Rijitlik toleransı kapalı'; }
  }
}

// ── KOŞUCU ──────────────────────────────────────────────────────────────────
// DİLİMLİ: iş ≤ _MNT_PARAM_DILIM ms'lik dilimlerle koşar ve her dilimden
// sonra olay döngüsüne döner — arada tarayıcı kareyi çizer, girdiyi işler.
// Kullanıcı (2026-10-18): *"Tara … dediğimde program kasıyor"*. Önceki parça
// 50 ms / 200 kombinasyondu: ASFAT'ın 19.683 kombinasyonunda ana iş parçacığı
// 104 kez 50 ms'den uzun kilitlendi, en uzun kare boşluğu 317 ms. Dönüş
// MessageChannel'la: iç içe setTimeout(0) 4 ms'ye kenetlenir — 10 ms'lik
// dilimin yanında boşta bekleme olurdu. İkinci tıklama durdurur. Tarama TAM
// ve tek geçiş (sınır değişince yeniden tarama gerekmesin); ilerleme eylem
// satırında (vePencereIlerleme: kombinasyon sayısı ve oran). Bitince depo
// saklanır, Sonuç bölümü dilim dilim belleğe alınır ve pencere kurulur —
// çubuk dolu bir kare çizildikten SONRA.
var _MNT_PARAM_DILIM = 10;     // ms — dilimin bütçesi
var _MNT_PARAM_DILIM_N = 200;  // dilimin kombinasyon tavanı (saat ilerlemeyen ortamda da dilimlensin)
var _mntParamKanal = null, _mntParamKuyruk = [];
function _mntParamSonraki(fn){
  if(typeof MessageChannel!=='function'){ setTimeout(fn, 0); return; }
  if(!_mntParamKanal){
    _mntParamKanal=new MessageChannel();
    _mntParamKanal.port1.onmessage=function(){ var f=_mntParamKuyruk.shift(); if(f) f(); };
  }
  _mntParamKuyruk.push(fn);
  _mntParamKanal.port2.postMessage(0);
}
function _mntParamSimdi(){
  return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
}
function _mntParamYaz(nodeId, metin, d){
  if(typeof document==='undefined') return;
  var st=document.getElementById('ve-mnt-param-st-'+nodeId);
  if(st){ st.textContent=metin; if(d) st.setAttribute('data-d', d); else st.removeAttribute('data-d'); }
}
function _mntParamDugme(nodeId){
  if(typeof document==='undefined') return;
  var b=document.getElementById('ve-mnt-param-btn-'+nodeId);
  if(!b) return;
  var is=!!(_MNT_PARAM_IS && _MNT_PARAM_IS.nodeId===nodeId);
  b.innerHTML=is ? veIkon('square')+' Durdur' : veIkon('play')+' Tara';
  if(is) b.setAttribute('data-durdur', ''); else b.removeAttribute('data-durdur');
}
// Süren taramanın ilerlemesi (eylem satırının çubuğu) — yoksa null.
function _mntParamIlerleme(nodeId){
  var s=_MNT_PARAM_IS;
  var x=_MNT_PARAM_XLS.is;
  if((!s || s.nodeId!==nodeId) && x && x.nodeId===nodeId){
    // satırların çözümü çubuğun %70'i, kitabın kurulumu ve dosyanın yazımı kalanı
    if(x.dosya!=null) return { ad:x.ad || 'Excel', metin:'Dosya', oran:0.7+0.3*x.dosya };
    return { ad:x.ad || 'Excel', metin:'Satır '+_mntS(x.i, 0)+' / '+_mntS(x.n, 0), oran:x.n ? 0.7*x.i/x.n : 0.7 };
  }
  if(!s || s.nodeId!==nodeId) return null;
  if(s.son) return { ad:'Tarama', metin:'Sonuç', oran:1 };
  return { ad:'Tarama', metin:'Kombinasyon '+_mntS(s.i, 0)+' / '+_mntS(s.n, 0), oran:s.n ? s.i/s.n : 0 };
}
function _mntParamIlerlemeYaz(nodeId){
  if(typeof document==='undefined' || typeof vePencereIlerleme!=='function') return;
  vePencereIlerleme('ve-mnt-param-btn-'+nodeId, _mntParamIlerleme(nodeId));
}
// Süren taramayı durdurur (proje değişince — veMntParamUnut). Dönüş: vardı mı.
function veMntParamDurdur(){
  if(!_MNT_PARAM_IS) return false;
  _MNT_PARAM_IS.dur=true;
  return true;
}
function veMntParamTara(nodeId){
  if(_MNT_PARAM_IS){ _MNT_PARAM_IS.dur=true; return; }
  var node=_mntParamDugum(nodeId); if(!node) return;
  var H=_mntParamHazirlik(node);
  if(H.eksik){ _mntParamYaz(nodeId, H.eksik, 'warn'); return; }
  var O=_mntParamOlcucu(H.M, veMntKatalog.baglam(H.ctx));
  // Ek kısıt yok: ikinci aşama yalnız kesin kriterleri sağlayanlarda (yoksa en az
  // ihlalli 25'te) — tam tarama (her kombinasyonda) sınır değişince yeniden taramasın
  // diyeydi, değişen sınır kalmadı.
  var it=veMntKatalog.tarayici({ G:H.M.G, adaylar:H.aday, sabit:H.sabit, ctx:H.ctx,
                                 olc1:O.olc1, olc2:O.olc2, enIyi:25, tam:false });
  var is=_MNT_PARAM_IS={ nodeId:nodeId, dur:false, i:0, n:it.N, son:false };
  _mntParamYaz(nodeId, '');
  _mntParamDugme(nodeId);
  _mntParamIlerlemeYaz(nodeId);
  var yazildi=-Infinity;
  var bitir=function(metin, d){
    if(_MNT_PARAM_IS===is) _MNT_PARAM_IS=null;
    _mntParamIlerlemeYaz(nodeId);
    _mntParamDugme(nodeId);
    _mntParamYaz(nodeId, metin, d);
  };
  // Sonuç: depo saklanır; açık pencerenin Sonuç bölümü önce dilim dilim
  // belleğe alınır (özet, önerinin ölçümü, bölüm — _mntParamSonucIsitici), sonra
  // pencere kurulur ve yalnız birleştirir. Isınırken durdurma beklenmez:
  // tarama bitti, depo saklandı.
  var acik=function(){
    return (typeof document!=='undefined') && !!document.querySelector('.ve-properties-content [data-mnt-pencere="'+nodeId+'"]');
  };
  var kur=function(){
    if(_MNT_PARAM_IS===is) _MNT_PARAM_IS=null;
    if(acik() && typeof showNodeProperties==='function'){
      showNodeProperties(node);
      setTimeout(function(){ if(typeof vePencereKategoriGit==='function') vePencereKategoriGit(nodeId, 'sonuc'); }, 160);
    }
    bitir('Tarandı ('+_mntS(it.depo().sure/1000, 1)+' s)', 'ok');
  };
  var sonuc=function(){
    if(is.dur){ bitir('Durduruldu', 'warn'); return; }
    try { _mntParamSonucKaydet(nodeId, H, O, it.depo()); }
    catch(e){ bitir('Hata: '+e.message, 'no'); return; }
    var L=(acik() && typeof _mntParamSonucIsitici==='function') ? _mntParamSonucIsitici(node, H, _MNT_PARAM_SONUC[nodeId]) : [];
    var isit=function(){
      var bas=_mntParamSimdi();
      while(L.length){
        try { L.shift()(); } catch(e){ L=[]; }        // hata pencerenin kendi kurulumunda söylenir
        if(_mntParamSimdi()-bas>=_MNT_PARAM_DILIM) break;
      }
      if(L.length){ _mntParamSonraki(isit); return; }
      kur();
    };
    isit();
  };
  var dilim=function(){
    if(is.dur){ bitir('Durduruldu', 'warn'); return; }
    var bas=_mntParamSimdi(), r, k=0;
    do { r=it.adim(1); } while(!r.bitti && ++k<_MNT_PARAM_DILIM_N && _mntParamSimdi()-bas<_MNT_PARAM_DILIM);
    is.i=r.asama===2 ? it.N : r.i;                 // ikinci aşama kısa: çubuk dolu kalır
    // Çubuk en çok ~10 kez/s yazılır; genişlik geçişi CSS'te.
    var t=_mntParamSimdi();
    if(r.bitti || t-yazildi>=100){ yazildi=t; _mntParamIlerlemeYaz(nodeId); }
    if(!r.bitti){ _mntParamSonraki(dilim); return; }
    is.son=true;
    _mntParamIlerlemeYaz(nodeId);
    setTimeout(sonuc, 20);          // dolu çubuk bir kare çizilsin, sonra kurulum
  };
  _mntParamSonraki(dilim);
}

if(typeof module!=='undefined' && module.exports){
  module.exports = {
    getMntParamPropertiesHTML: getMntParamPropertiesHTML, _mntParamEskiPencereHTML: _mntParamEskiPencereHTML,
    _mntParamModel: _mntParamModel, _mntParamAdaylar: _mntParamAdaylar, _mntParamCtx: _mntParamCtx,
    _mntParamHazirlik: _mntParamHazirlik, _mntParamOlcucu: _mntParamOlcucu,
    _mntParamYaz: _mntParamYaz, _mntParamDugum: _mntParamDugum,
    _mntParamIlerleme: _mntParamIlerleme, _mntParamSonraki: _mntParamSonraki, veMntParamDurdur: veMntParamDurdur,
    _mntParamSimdi: _mntParamSimdi, _mntParamIlerlemeYaz: _mntParamIlerlemeYaz, _MNT_PARAM_DILIM: _MNT_PARAM_DILIM,
    _MNT_PARAM_XLS: _MNT_PARAM_XLS,
    _mntParamTolerans: _mntParamTolerans, _mntParamAd: _mntParamAd, _MNT_PARAM_KRITER_AD: _MNT_PARAM_KRITER_AD,
    _mntParamKriterSinir: _mntParamKriterSinir, _mntParamKriterHTML: _mntParamKriterHTML,
    _mntParamMarkalar: _mntParamMarkalar, _MNT_PARAM_MARKA: _MNT_PARAM_MARKA,
    veMntParamMarka: veMntParamMarka, veMntParamMarkaAc: veMntParamMarkaAc,
    veMntParamSabit: veMntParamSabit, veMntParamAday: veMntParamAday,
    veMntParamAnaliz: veMntParamAnaliz, veMntParamKonum: veMntParamKonum, _mntParamAnaliz: _mntParamAnaliz,
    _mntParamKonumAdaylar: _mntParamKonumAdaylar, _mntParamKonumAd: _mntParamKonumAd, _mntParamAdayAdi: _mntParamAdayAdi,
    _mntParamMevcutAdi: _mntParamMevcutAdi, _mntParamAdayAyni: _mntParamAdayAyni, _mntParamGrupKonum: _mntParamGrupKonum,
    VE_MNT_PARAM_ANALIZ: VE_MNT_PARAM_ANALIZ, veMntParamAdayHepsi: veMntParamAdayHepsi,
    veMntParamTolerans: veMntParamTolerans, veMntParamToleransAc: veMntParamToleransAc, veMntParamTara: veMntParamTara
  };
}
