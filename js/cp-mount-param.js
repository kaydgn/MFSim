// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ — PARAMETRİK ANALİZ penceresi ve katalog taraması koşucusu
// ════════════════════════════════════════════════════════════════════════════
// Bileşen 'mnt-parametric' (js/components.js), ilk analizi "Katalogdan seçim"
// (kullanıcı isteği 2026-10-16). Girdi kategorileri: gruplar, aday tipler,
// kısıt sınırları, amaç ağırlığı. Tek eylemi taramayı koşturur; tarama
// bitince Sonuç kategorisi uzlaşı çözümünü ve diyagramları taşır (kullanıcı
// kararı 2026-10-18 — Takoz pencerelerinin "sonuç göstermez" kuralının bu
// pencereye özgü istisnası; js/cp-mount-param-sonuc.js). Ayrıntılı rapor AYRI
// belgede (js/cp-mount-param-rapor.js): ana rapora eklemek onu uzatırdı
// (kullanıcı: "Rapor kısmına eklersek çok uzun olabilir").
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

// Aday tipler: etkin kütüphanenin TAMAMI (gömülü + değiştirilmiş + özel);
// kullanıcı dışarıda bıraktıklarını `haric`ta tutar — yeni eklenen tip
// kendiliğinden aday olur.
function _mntParamAdaylar(M, node){
  var haric={};
  ((node && node.data && node.data.haric) || []).forEach(function(k){ haric[k]=true; });
  return Object.keys(M.lib).map(function(k){ return { key:k, name:M.lib[k].name, e:M.lib[k], dahil:!haric[k] }; });
}

// Pencerede yüzde, çekirdekte oran.
// Pencere birimi → çekirdek birimi: yüzdeler orana döner.
var _MNT_PARAM_YUZDE = { kapasite:1, ayrisma:1, darbe:1, surunme:1, tolerans:1 };
function _mntParamCtx(M, node){
  var d=(node && node.data) || {}, s=d.sinir || {}, o={};
  Object.keys(veMntKatalog.SINIR_VARSAYILAN).forEach(function(k){
    var x=_mntNum(s[k], NaN);
    o[k]=(Number.isFinite(x) && _MNT_PARAM_YUZDE[k]) ? x/100 : x;
  });
  return { fAtes:M.fAtes, acik:d.acik || {}, s:o };
}

// Taramanın bütün girdisi ve eksiği (pencere ile koşucu AYNI hazırlığı okur).
function _mntParamHazirlik(node, liste){
  var M=_mntParamModel(liste), A=_mntParamAdaylar(M, node);
  var sabit=(node && node.data && node.data.sabit) || {};
  var aday=A.filter(function(a){ return a.dahil; });
  var N=veMntKatalog.kombinasyonSayisi(M.G, aday.length, sabit);
  var eksik=!M.tak.length ? 'Takoz yok'
    : !(M.fAtes>0) ? 'Rölanti devri ve silindir sayısı yok'
    : !aday.length ? 'Aday tip yok'
    : !N ? 'Taranacak grup yok'
    : N>veMntKatalog.MAKS_KOMB ? 'Kombinasyon sayısı '+_mntS(veMntKatalog.MAKS_KOMB, 0)+' üstünde' : '';
  return { M:M, A:A, aday:aday, sabit:sabit, N:N, eksik:eksik, ctx:_mntParamCtx(M, node) };
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
      var key=tipler ? tipler[gi] : null, e=key ? M.lib[key] : null;
      if(!e) return;
      grp.uyeler.forEach(function(i){
        var d=Object.assign({}, mounts[i]);
        _mntLibGirdiYaz(d, e, key);
        mounts[i]=d;
      });
    });
    if(s && s!==1) mounts=mounts.map(function(m){ var d=Object.assign({}, m); _mntParamOlcekle(d, s); return d; });
    return _mntPrepareFrom({ components:g.components, mounts:mounts, torque:g.torque }, solver);
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
  return { olc1:olc1, olc2:olc2 };
}

// ── PENCERE ─────────────────────────────────────────────────────────────────
// Kategoriler, gövdede alt alta: GRUPLAR (model taraması, sabit tutulan
// grup) · ADAYLAR (kütüphane) · KISITLAR (dört kesin kriter, ek kısıtlar,
// amaç ağırlığı) · SONUÇ (yalnız taramadan sonra). Sağ sütun: analizin adı
// ve büyüklüğü → cevap → eylem.
function getMntParamPropertiesHTML(node){
  if(!node.data) node.data={};
  var H=_mntParamHazirlik(node);
  var kategoriler=[
    { k:'grup', ad:'Gruplar', govde:_mntParamGrupHTML(node, H) },
    { k:'aday', ad:'Adaylar', govde:_mntParamAdayHTML(node, H) },
    { k:'kisit', ad:'Kısıtlar', govde:_mntParamKisitHTML(node, H) }
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
  var ozet=_mntBolum('Katalogdan seçim', '',
    _mntIzgara(3, _mntOku('Grup', String(H.M.G.length)) + _mntOku('Tip', String(H.aday.length))
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
  var G=H.M.G;
  if(!G.length) return _mntBolum('Gruplar', '', _mntNot('Takoz yok', 'warn'));
  var h=_mntFoyAc([{ b:'No', gen:'8%' }, { b:'Grup', gen:'31%', sinif:'sol' }, { b:'x <u>[mm]</u>', gen:'15%' },
                   { b:'Mevcut tip', gen:'33%', sinif:'sol' }, { b:'Tara', gen:'13%', sinif:'ve-mnt-sec' }], 'Takoz grupları', 've-mnt-foy--sar ve-mnt-foy--ad');
  G.forEach(function(g){
    var tip=(g.tip && H.M.lib[g.tip]) ? H.M.lib[g.tip].name : '—';
    h+='<tr><td>'+g.no+'</td><td class="sol sar">'+_mntParamAd(g.ad)+'</td><td>'+_mntS(g.x, 0)+'</td>'
     + '<td class="sol sar">'+_mntParamAd(tip)+'</td>'
     + '<td class="ve-mnt-sec"><input type="checkbox"'+(H.sabit[g.anahtar] ? '' : ' checked')
     + ' aria-label="'+_mntEsc('Tara · '+g.ad)+'" onchange="veMntParamSabit(\''+node.id+'\','+g.no+',!this.checked)"></td></tr>';
  });
  return _mntBolum('Gruplar', G.length+' grup', h+_MNT_FOY_KAPA);
}

function _mntParamAdayHTML(node, H){
  var A=H.A, n=H.aday.length;
  var h=_mntFoyAc([{ b:'<input type="checkbox"'+(n===A.length ? ' checked' : '')+' aria-label="Tüm tipler"'
                       + ' onchange="veMntParamAdayHepsi(\''+node.id+'\',this.checked)">', gen:'8%', sinif:'ve-mnt-sec' },
                   { b:'Tip', gen:'42%', sinif:'sol' },
                   { b:_mntSym('k<sub>z</sub>')+' stat. <u>[N/mm]</u>', gen:'16%' },
                   { b:_mntSym('k<sub>z</sub>')+' din. <u>[N/mm]</u>', gen:'16%' },
                   { b:'Yasa', gen:'18%', sinif:'sol' }], 'Aday tipler', 've-mnt-foy--sar ve-mnt-foy--ad');
  A.forEach(function(a){
    h+='<tr><td class="ve-mnt-sec"><input type="checkbox"'+(a.dahil ? ' checked' : '')
     + ' aria-label="'+_mntEsc(a.name)+'" onchange="veMntParamAday(\''+node.id+'\',\''+_mntEsc(a.key)+'\',this.checked)"></td>'
     + '<td class="sol sar">'+_mntParamAd(a.name)+'</td>'
     + '<td>'+_mntS(_mntNum(a.e.sz, NaN), 0)+'</td><td>'+_mntS(_mntNum(a.e.dz, NaN), 0)+'</td>'
     + '<td class="sol">'+(_mntEntryHasLaw(a.e) ? 'eğri' : 'doğrusal')+'</td></tr>';   // sütun 18 %: "doğrusal" sığar
  });
  return _mntBolum('Adaylar', n+' / '+A.length, h+_MNT_FOY_KAPA, { emId:'ve-mnt-param-aday-em-'+node.id });
}

// Ek kısıtların penceredeki biçimi: anahtar → [karşılaştırma, birim, sınır anahtarı].
// Sınırın yüzdesi pencerede, oranı çekirdekte (_MNT_PARAM_YUZDE).
var _MNT_PARAM_EK = {
  sehimAlt: ['≥', 'mm', 'sehimAlt'], sehim: ['≤', 'mm', 'sehimUst'], altMod: ['≥', 'Hz', 'altMod'],
  kapasite: ['≤', '%', 'kapasite'], ayrisma: ['≥', '%', 'ayrisma'], isletme: ['≤', 'mm', 'isletmeUst'],
  durdurucu: ['≤', 'mm', 'durdurucuUst'], cekme: ['', '', null], darbe: ['≤', '%', 'darbe']
};
function _mntParamSinirDeger(node, key){
  var s=(node.data && node.data.sinir) || {}, V=veMntKatalog.SINIR_VARSAYILAN;
  return _mntBos(s[key]) ? (_MNT_PARAM_YUZDE[key] ? +(V[key]*100).toFixed(6) : V[key]) : s[key];   // makine: yüzde → alan değeri
}
function _mntParamSinirAlan(node, key, aria){
  return '<td class="gir"><input type="text" inputmode="decimal" id="ve-mnt-param-'+key+'-'+node.id+'"'
    + ' value="'+_mntEsc(_mntParamSinirDeger(node, key))+'" aria-label="'+_mntEsc(aria)+'"'
    + ' onchange="veMntParamSinir(\''+node.id+'\',\''+key+'\',this.value)"></td>';
}
function _mntParamAcikKutu(node, k, acik, aria){
  return '<td class="ve-mnt-sec"><input type="checkbox"'+(acik ? ' checked' : '')+' aria-label="'+_mntEsc(aria)+'"'
    + ' onchange="veMntParamAcik(\''+node.id+'\',\''+k+'\',this.checked)"></td>';
}
function _mntParamKisitHTML(node, H){
  var K=veMntKatalog, c=K.baglam(H.ctx);
  var ad={}; K.KISITLAR.forEach(function(x){ ad[x.k]=x.ad; });
  var lim1=(H.M.fAtes>0) ? '&lt; '+_mntS(K.K1_ORAN*H.M.fAtes, 1)+' Hz' : '&lt; ½·f<sub>ateş</sub>';
  var kesin=_mntFoyAc([{ b:'No', gen:'12%' }, { b:'Kriter', gen:'54%', sinif:'sol' }, { b:'Sınır', gen:'34%' }], 'Kesin kriterler')
    + '<tr><td>1</td><td class="sol">'+ad.k1+'</td><td>'+lim1+'</td></tr>'
    + '<tr><td>1a</td><td class="sol">'+ad.k1a+'</td><td>&gt; '+_mntS(K.K1A_HZ, 1)+' Hz</td></tr>'
    + '<tr><td>1b</td><td class="sol">'+ad.k1b+'</td><td>'+_mntS(K.K1B[0], 0)+'–'+_mntS(K.K1B[1], 0)+' Hz dışı</td></tr>'
    + '<tr><td>2</td><td class="sol">'+ad.k2+'</td><td>&lt; %'+_mntS(K.K2_T*100, 0)+'</td></tr>'+_MNT_FOY_KAPA;
  var ek=_mntFoyAc([{ b:'Açık', gen:'11%', sinif:'ve-mnt-sec' }, { b:'Kısıt', gen:'49%', sinif:'sol' }, { b:'', gen:'7%' },
                    { b:'Sınır', gen:'19%' }, { b:'Birim', gen:'14%', sinif:'sol' }], 'Ek kısıtlar');
  K.KISITLAR.forEach(function(x){
    if(x.zorunlu) return;
    var E=_MNT_PARAM_EK[x.k];
    ek+='<tr>'+_mntParamAcikKutu(node, x.k, c.acik[x.k], x.ad)+'<td class="sol" title="'+_mntEsc(x.ad)+'">'+x.ad+'</td><td>'+E[0]+'</td>'
      + (E[2] ? _mntParamSinirAlan(node, E[2], x.ad+' sınırı') : '<td>—</td>')+'<td class="sol">'+E[1]+'</td></tr>';
  });
  ek+=_MNT_FOY_KAPA;
  var deg=_mntFoyAc([{ b:'Açık', gen:'11%', sinif:'ve-mnt-sec' }, { b:'Parametre', gen:'56%', sinif:'sol' },
                     { b:'Değer', gen:'19%' }, { b:'Birim', gen:'14%', sinif:'sol' }], 'Değerlendirme parametreleri')
    + '<tr><td class="ve-mnt-sec">—</td><td class="sol">Sürünme payı (E7)</td>'+_mntParamSinirAlan(node, 'surunme', 'Sürünme payı')+'<td class="sol">%</td></tr>'
    + '<tr>'+_mntParamAcikKutu(node, 'tolerans', c.acik.tolerans, 'Rijitlik toleransı')
    + '<td class="sol">Rijitlik toleransı ±</td>'+_mntParamSinirAlan(node, 'tolerans', 'Rijitlik toleransı')+'<td class="sol">%</td></tr>'
    + _MNT_FOY_KAPA;
  var amac=_mntIzgara(2,
      '<label class="ve-fp-f"><span class="ve-fp-l">İletilebilirlik ağırlığı</span>'
    + '<input class="ve-fp-inp" type="text" inputmode="decimal" id="ve-mnt-param-agirlik-'+node.id+'"'
    + ' value="'+_mntEsc(_mntParamSinirDeger(node, 'agirlik'))+'"'
    + ' onchange="veMntParamSinir(\''+node.id+'\',\'agirlik\',this.value)"></label>'
    + _mntOku('Sehim ağırlığı', _mntS(1-c.s.agirlik, 2), { id:'ve-mnt-param-agd-'+node.id }));
  return _mntBolum('Kesin kriterler', '', kesin)
    + _mntBolum('Ek kısıtlar', '', ek)
    + _mntBolum('Değerlendirme', '', deg)
    + _mntBolum('Amaç', 'iletilebilirlik · statik sehim', amac);
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
function veMntParamAday(nodeId, key, dahil){
  var n=_mntParamDugum(nodeId); if(!n) return;
  var h=(n.data.haric || []).filter(function(k){ return k!==key; });
  if(!dahil) h.push(key);
  if(h.length) n.data.haric=h; else delete n.data.haric;
  if(typeof saveState==='function') saveState();
}
function veMntParamAdayHepsi(nodeId, dahil){
  var n=_mntParamDugum(nodeId); if(!n) return;
  if(dahil) delete n.data.haric; else n.data.haric=Object.keys(veMntGetLibraryMap());
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(n);
}
// Sınır (pencere birimi: mm, %, ağırlık 0–1). Boş ya da geçersiz → alan
// silinir, varsayılan geçerli olur (alan varsayılanı değer olarak gösterir).
function veMntParamSinir(nodeId, key, val){
  var n=_mntParamDugum(nodeId); if(!n) return;
  if(!(key in veMntKatalog.SINIR_VARSAYILAN)) return;
  var s=Object.assign({}, n.data.sinir || {}), v=_mntNum(val, NaN), r=veMntKatalog.SINIR_ARALIK[key];
  var x=_MNT_PARAM_YUZDE[key] ? v/100 : v;
  var gecerli=r ? ((r[2] ? x>r[0] : x>=r[0]) && x<=r[1]) : (x>0);
  if(String(val==null ? '' : val).trim()!=='' && gecerli) s[key]=v; else delete s[key];
  if(Object.keys(s).length) n.data.sinir=s; else delete n.data.sinir;
  if(typeof saveState==='function') saveState();
}
function veMntParamAcik(nodeId, k, acik){
  var n=_mntParamDugum(nodeId); if(!n) return;
  var a=Object.assign({}, n.data.acik || {});
  if(!!acik===!!veMntKatalog.ACIK_VARSAYILAN[k]) delete a[k]; else a[k]=!!acik;
  if(Object.keys(a).length) n.data.acik=a; else delete n.data.acik;
  if(typeof saveState==='function') saveState();
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
  if(!s || s.nodeId!==nodeId) return null;
  if(s.son) return { ad:'Tarama', metin:'Sonuç', oran:1 };
  return { ad:'Tarama', metin:'Kombinasyon '+_mntS(s.i, 0)+' / '+_mntS(s.n, 0), oran:s.n ? s.i/s.n : 0 };
}
function _mntParamIlerlemeYaz(nodeId){
  if(typeof document==='undefined' || typeof vePencereIlerleme!=='function') return;
  vePencereIlerleme('ve-mnt-param-btn-'+nodeId, _mntParamIlerleme(nodeId));
}
// Raporun satırları: sıranın ve mevcut tasarımın TAM ölçümü (iki aşama + darbe).
function _mntParamZenginlestir(S, H, O){
  var tam=function(tipler){
    var o1=O.olc1(tipler), o2=o1 ? O.olc2(tipler) : null;
    return { o1:o1, o2:o2, k:veMntKatalog.hepsi(o1, o2, H.ctx) };
  };
  return {
    S:S, M:H.M, A:H.aday, sabit:H.sabit, ctx:veMntKatalog.baglam(H.ctx),
    satir:S.sira.map(function(r){ return Object.assign({}, r, tam(r.tipler)); }),
    mevcut:tam(H.M.G.map(function(){ return null; })),
    tarih:new Date()
  };
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
  var it=veMntKatalog.tarayici({ G:H.M.G, adaylar:H.aday, sabit:H.sabit, ctx:H.ctx,
                                 olc1:O.olc1, olc2:O.olc2, enIyi:25, tam:true });
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
    is.i=r.i;
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
    getMntParamPropertiesHTML: getMntParamPropertiesHTML,
    _mntParamModel: _mntParamModel, _mntParamAdaylar: _mntParamAdaylar, _mntParamCtx: _mntParamCtx,
    _mntParamHazirlik: _mntParamHazirlik, _mntParamOlcucu: _mntParamOlcucu,
    _mntParamZenginlestir: _mntParamZenginlestir, _mntParamYaz: _mntParamYaz, _mntParamDugum: _mntParamDugum,
    _mntParamIlerleme: _mntParamIlerleme, _mntParamSonraki: _mntParamSonraki, veMntParamDurdur: veMntParamDurdur,
    _MNT_PARAM_EK: _MNT_PARAM_EK, _MNT_PARAM_YUZDE: _MNT_PARAM_YUZDE, _mntParamAd: _mntParamAd,
    veMntParamSabit: veMntParamSabit, veMntParamAday: veMntParamAday, veMntParamAdayHepsi: veMntParamAdayHepsi,
    veMntParamSinir: veMntParamSinir, veMntParamAcik: veMntParamAcik, veMntParamTara: veMntParamTara
  };
}
