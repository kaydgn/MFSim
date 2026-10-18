// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ GÖRÜNÜMLER — AKSONOMETRİK ÇİZİCİ
// ═══════════════════════════════════════════════════════════════════════════
//
// KULLANICI SEÇİMİ (2026-10-15, tasarım sayfası "Aksonometrik 2B Görünüm"):
// izdüşüm dimetrik (ISO 5456-3; eksen oranı X : Y : Z = 0,94 : 0,47 : 0,94),
// seçicide izometrik (0,82 üçünde), bakış önden-soldan-yukarıdan. Çizim dili
// gölgeli prizma; Z = 0'a düşen gölge hep açık. 2026-10-16'dan beri
// Görünümler penceresinin (eski 2D Görünüm) TEK çizimi ve bileşen
// pencerelerinin "Güç grubundaki yeri" krokisi SERBEST kamerada (o.kam:
// azimut · yükseliş, döndürülür; kroki bileşeni perdenin üstünde gösterir —
// o.secili + o.perde); sabit bakış (iz + b) başlangıç sayfasının karolarında
// ve raporun illüstrasyonunda.
//
// KATMANLAR (direk, duvar, kuvvet, statik sehim, mod, rijitlik, asal eksen)
// çizicide durur, PENCEREDE YOK: kullanıcı kararı (2026-10-16) — pencere
// sonuç göstermez, "kullanıcı sadece detaylı sonuç raporu ile yetinecek";
// raporun illüstrasyonu direği kullanır.
//
// ÇİZİM OKUR, HESAPLAMAZ. Modeli cp-mount.js kurar (`_mntAksoModelKur`):
// gövde kutusu çekirdeğin equivalentBox'ı (köşegen atalet — raporun mod
// şekli çizimiyle aynı çağrı), G çözücünün birleştirmesi (combineMassProps),
// asal eksenler principalInertia, kuvvet / mod / statik denge YALNIZ raporun
// çözümünden. Burası saf çizim: DOM'a dokunmaz, Jest'te doğrudan sınanır.
//
// KAMERA paralel izdüşüm: P model (mm) → ekran (sağ, aşağı); d izdüşüm
// yönü (izleyiciden sahneye). Görünen yüz n · d < 0; boyama sırası uzaktan
// yakına. Bakış işareti izleyicinin yeri: x −1 önden · +1 arkadan, y −1
// soldan · +1 sağdan, z +1 yukarıdan · −1 alttan. Modelin ekseni: +X arka,
// +Y sağ, +Z yukarı (Koordinat Düzlemi'yle aynı).
//
// RENKLER ürünün işaret dilinden (2D, 3B ve krokiyle aynı anlam): takoz
// yeşil (--accent-success), gövde CG'si kehribar (--accent-warning), G ve
// G'ye ait her şey (asal eksen, eşdeğer kutu) kırmızı (--accent-danger),
// rijitlik kolu eksenin rengi (--eksen-x/y/z). Görünüm CSS'te (`.ve-ak-*`).
//
// YAZI KURALI (tests/e2e/yerlesim.spec.js): yazı ölçek tabanında (çizim
// kabın genişliğinde 1:1 kurulur, boy `o.fs`ten), iki yazı üst üste değil,
// hiçbir çizgi yazının içinden geçmez — BÜTÜN çizgiler (kılavuzlar dâhil)
// yazılardan ÖNCE çizilir ve yazı zeminin renginde hâle taşır; çip yazısını
// çipin dolgusu örter.
// ═══════════════════════════════════════════════════════════════════════════
//
// MODEL (m):
//   govde : [{ k, no, ad, m [kg], x, y, z [mm], kutu:[a,b,c] mm | null, pay, ana, bilgi:[satır] }]
//   takoz : [{ k, no, ad, x, y, z, ks:[N/mm ×3], f:[N ×3] | null, yukKg | null, bilgi:[satır] }]
//   G     : { x, y, z, m, bilgi:[satır] }
//   cgR   : [x, y, z] mm — mod şekli ve statik dengenin dönme merkezi (çözümün G'si)
//   q     : { u:[mm ×3], t:[rad ×3] } | null — statik denge yer değiştirmesi
//   asal  : { degerler:[kg·m² ×3], eksenler:[[3] ×3], kutu:[mm ×3] } | null
// SEÇENEK (o):
//   W, H?, Hmin?, Hmax?, iz:'dim'|'iso', b:{x,y,z}, stil:'golge'|'xray',
//   kat:{ zemin, golge, direk, duvar, kuvvet, cokme, rijit, asal, cetvel },
//   etiket:'ad'|'genis'|'secili'|'yok', sade, mod:{ phi, s, faz }, F (sabit sığdırma),
//   ucluyok, fs:{ k, b } (yazı boyu px), olc(t, px, kalin) (yazı genişliği),
//   yalnizHareket (yalnız hareket eden katman — canlandırmanın karesi),
//   kam:{ az, el } + kure + yakin + kay (serbest kamera), isaret (işaret boyu katı),
//   secili (vurgulanan bileşenin k'si — "Güç grubundaki yeri" ve föy satırı;
//   her kipte adıyla, vurgu kenarlı çipte; etiket:'secili' yalnız onu ve G'yi
//   yazar), perde (secili perdenin üstünde, kalan model altında), yer (bir
//   önceki karenin yazı yerleri — yapışkan yer; ciz'in döndürdüğü `yer`),
//   aria (çizimin erişilebilir adı)
// ═══════════════════════════════════════════════════════════════════════════

var veMntAkso = (function(){
  'use strict';

  var IZ = {
    dim: { ad:'Dimetrik', kisa:'dimetrik (ISO 5456-3)', yon:[1/3, Math.sqrt(7)/3, 1/3] },
    iso: { ad:'İzometrik', kisa:'izometrik', yon:[1, 1, 1] }
  };
  // Ana gövde: toplam kütlenin %10'undan fazlası — raporun mod şekli
  // çizimindeki eşik (cp-mount-report.js ANA_PAY); en az iki gövde.
  var ANA_PAY = 0.10;

  // ── Yazım ───────────────────────────────────────────────────────────────
  function sayi(v, b){
    if(typeof v!=='number' || !isFinite(v)) return '—';
    return (typeof veSayi==='function') ? veSayi(v, b, { eksi:'−' }) : String(Math.round(v));
  }
  function koord(p, b){ return '('+sayi(p.x, b||0)+'; '+sayi(p.y, b||0)+'; '+sayi(p.z, b||0)+')'; }
  function esc(s){ return String(s==null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function R(v){ return Math.round(v*10)/10; }
  function bilgiAttr(satirlar){ return satirlar && satirlar.length ? ' data-mnt-info="'+esc(satirlar.join('\n')).replace(/\n/g,'&#10;')+'"' : ''; }
  // SEÇİLİ (o.secili): bir bileşen penceresinin "Güç grubundaki yeri"nde o
  // bileşen — onun bütün parçaları `data-sec` taşır (CSS vurgular). Çizimin
  // süresince ayarlanır; ciz her çağrıda yeniden yazar.
  var _secili=null;
  function ak(k, satirlar){ return ' data-ak="'+esc(k)+'"'+((_secili!=null && k===_secili) ? ' data-sec=""' : '')+bilgiAttr(satirlar); }
  // Yazı genişliği TAHMİNİ: rakam ve büyük harf ~0,6 em — 2D çizicinin
  // _mnt2DYaziKutu'suyla aynı ve bilerek cömert (kapının ölçtüğü gerçek
  // kutudan küçük kalırsa çakışma kaçar). Tarayıcı ölçeri `o.olc` ile gelir.
  function tahmin(t, px, kalin){ return String(t).length*px*(kalin ? 0.64 : 0.6); }

  // ── Vektör ──────────────────────────────────────────────────────────────
  function dot(a, b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function cross(a, b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function norm(a){ var l=Math.sqrt(dot(a, a))||1; return [a[0]/l, a[1]/l, a[2]/l]; }
  function add(a, b){ return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
  function mul(a, s){ return [a[0]*s, a[1]*s, a[2]*s]; }

  // ── Kamera ──────────────────────────────────────────────────────────────
  // b: izleyicinin yeri ({x,y,z} ∈ ±1). Dimetrikte izdüşüm yönü ISO 5456-3'ün
  // (1/3, √7/3, 1/3) vektörü: bakış yandan baskın, Y eksenin yarısı.
  // yon: SERBEST kamera (Görünümler) — izleyicinin yönü [x, y, z];
  // verilirse izdüşümün adı ve b yok sayılır.
  function kamera(iz, b, yon){
    var a=(IZ[iz]||IZ.dim).yon;
    var d=mul(norm(yon || [b.x*a[0], b.y*a[1], b.z*a[2]]), -1);
    var r=norm(cross(d, [0, 0, 1])), u=cross(r, d);
    var K={ d:d, P:function(p){ return [dot(r, p), -dot(u, p)]; } };
    K.derin=function(p){ return -dot(d, p); };            // büyük = izleyiciye yakın
    K.gorunur=function(n){ return dot(n, d) < -1e-9; };
    K.oran=[0, 1, 2].map(function(i){ var e=[0, 0, 0]; e[i]=1; var q=K.P(e); return Math.sqrt(q[0]*q[0]+q[1]*q[1]); });
    return K;
  }
  function bakisAdi(b){
    return (b.x<0 ? 'önden' : 'arkadan')+'-'+(b.y<0 ? 'soldan' : 'sağdan')+'-'+(b.z>0 ? 'yukarıdan' : 'alttan');
  }
  // ── Serbest kamera: azimut ve yükseliş (derece) ↔ izleyicinin yönü ──────
  // Azimut XY düzleminde +X'ten +Y'ye; yükseliş ±88°'de durur (tam tepeden
  // bakışta ekranın sağı tanımsız). Hazır bakışlar aynı yönün açısı:
  // dimetrik önden-soldan-yukarıdan = az 249,3° · yükseliş 19,5°.
  var EL_SINIR = 88;
  function kamYon(k){
    var az=(Number(k && k.az)||0)*Math.PI/180;
    var el=Math.max(-EL_SINIR, Math.min(EL_SINIR, Number(k && k.el)||0))*Math.PI/180;
    return [Math.cos(el)*Math.cos(az), Math.cos(el)*Math.sin(az), Math.sin(el)];
  }
  function kamAci(iz, b){
    var a=(IZ[iz]||IZ.dim).yon, v=norm([b.x*a[0], b.y*a[1], b.z*a[2]]);
    var az=Math.atan2(v[1], v[0])*180/Math.PI;
    return { az:(az+360)%360, el:Math.asin(v[2])*180/Math.PI };
  }
  function kamB(yon){ return { x:yon[0]>0 ? 1 : -1, y:yon[1]>0 ? 1 : -1, z:yon[2]<0 ? -1 : 1 }; }

  // ── Kutu: yüzler ve kenarlar ────────────────────────────────────────────
  function yuzler(c, h){                 // 6 yüz: {n, eks, s, pts:[4 köşe]}
    var out=[];
    for(var i=0;i<3;i++) [-1, 1].forEach(function(s){
      var j=(i+1)%3, k=(i+2)%3, pts=[];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function(q){ var p=[0, 0, 0]; p[i]=c[i]+s*h[i]; p[j]=c[j]+q[0]*h[j]; p[k]=c[k]+q[1]*h[k]; pts.push(p); });
      var n=[0, 0, 0]; n[i]=s;
      out.push({ n:n, eks:i, s:s, pts:pts });
    });
    return out;
  }
  function kenarlar(c, h){               // 12 kenar: {a, b, yuz:[[eks,s],[eks,s]]}
    var out=[];
    for(var i=0;i<3;i++){
      var j=(i+1)%3, k=(i+2)%3;
      [-1, 1].forEach(function(sj){ [-1, 1].forEach(function(sk){
        var a=[0, 0, 0], b=[0, 0, 0];
        a[i]=c[i]-h[i]; b[i]=c[i]+h[i]; a[j]=b[j]=c[j]+sj*h[j]; a[k]=b[k]=c[k]+sk*h[k];
        out.push({ a:a, b:b, yuz:[[j, sj], [k, sk]] });
      }); });
    }
    return out;
  }
  function yuzSinif(f){ return f.eks===2 ? (f.s>0 ? 'f-ust' : 'f-alt') : (f.eks===0 ? 'f-x' : 'f-y'); }

  // ── Çizim parçaları ─────────────────────────────────────────────────────
  function cz(x1, y1, x2, y2, c){ return '<line class="'+c+'" x1="'+R(x1)+'" y1="'+R(y1)+'" x2="'+R(x2)+'" y2="'+R(y2)+'"/>'; }
  function yazi(x, y, t, c, px, a, kalin){
    return '<text class="'+c+'" x="'+R(x)+'" y="'+R(y)+'" font-size="'+px+'"'+(a ? ' text-anchor="'+a+'"' : '')
      + (kalin ? ' font-weight="600"' : '')+'>'+esc(t)+'</text>';
  }
  function okUcu(x, y, aci, b, c){
    var a1=aci+2.7, a2=aci-2.7;
    return '<path class="'+c+'" d="M'+R(x)+' '+R(y)+' L'+R(x+b*Math.cos(a1))+' '+R(y+b*Math.sin(a1))+' L'+R(x+b*Math.cos(a2))+' '+R(y+b*Math.sin(a2))+' Z"/>';
  }
  function ok(x1, y1, x2, y2, c, b){
    var a=Math.atan2(y2-y1, x2-x1); b=b||5;
    return cz(x1, y1, x2-Math.cos(a)*b*0.8, y2-Math.sin(a)*b*0.8, c)+okUcu(x2, y2, a, b, c+'-uc');
  }
  // Birleşik CG — jeodezik işaret (düz görünüşlerin _mnt2DCGMark'ı).
  function amG(x, y, r){
    return '<circle cx="'+R(x)+'" cy="'+R(y)+'" r="'+r+'"/>'
      + '<path d="M'+R(x)+' '+R(y)+' L'+R(x+r)+' '+R(y)+' A'+r+' '+r+' 0 0 1 '+R(x)+' '+R(y+r)+' Z M'+R(x)+' '+R(y)+' L'+R(x-r)+' '+R(y)+' A'+r+' '+r+' 0 0 1 '+R(x)+' '+R(y-r)+' Z"/>';
  }

  // ── Etiket yerleştirici ─────────────────────────────────────────────────
  // Her etiket işaretin çevresindeki sekiz yönde, halka halka dışa doğru
  // denenir; puan = engellerle kesişim alanı × ağırlık + uzaklık. Gövdenin
  // izdüşümü HAFİF engeldir (a ≈ 0,01: etiket gövdenin üstüne binebilir,
  // hâlesi okutur), işaretler ve yerleşmiş yazılar TAM engel. Uzağa düşen
  // etiket işaretine kılavuzla bağlanır.
  function kesAlan(a, b){ var x=Math.min(a.r, b.r)-Math.max(a.l, b.l), y=Math.min(a.b, b.b)-Math.max(a.t, b.t); return (x>0 && y>0) ? x*y : 0; }
  var YON8=[[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  // YAPIŞKAN YER (kullanıcı 2026-10-16: döndürürken yazılar "beraber
  // dönsünler"): sürüklenen kamerada her kare yeniden yerleşir ve en iyi yön
  // kareden kareye değişir — yazı kareden kareye sıçrıyordu. `onceki` bir
  // önceki karenin göreli yeri (anahtar → [dx, dy], kutunun ortası eksi
  // işaret): o yer TAM engelsizse ve işaretine uzaklığı en iyi adayınkinden
  // YAPIS puanından (dört halka) fazla değilse korunur — yazı işaretiyle
  // birlikte yürür, yalnız yeri kapanınca taşınır. Gövdenin üstüne binmek
  // (hafif engel) korumayı bozmaz: dönerken gövde yazının altından geçer.
  // Verilmezse birebir eski. Ölçü: mount-akso.test.js → YAPIŞKAN YER.
  var YAPIS = 40;
  function yerAnahtar(e){ return e.k+'|'+(e.sinif||''); }
  function yerlestir(liste, engel, sinir, onceki){
    var dolu=engel.map(function(e){ return { l:e.l, t:e.t, r:e.r, b:e.b, a:(e.a==null ? 1 : e.a) }; });
    var out=[];
    function tamOrtusme(k, liste){ var t=0; for(var i=0;i<liste.length;i++){ if(liste[i].a>=0.5) t+=kesAlan(k, liste[i]); } return t; }
    liste.slice().sort(function(a, b){ return (b.pri||0)-(a.pri||0); }).forEach(function(e){
      var en=null;
      var yonler=e.yon ? e.yon.map(function(i){ return YON8[i]; }) : YON8;
      for(var kd=0; kd<9; kd++){
        var dd=(e.r||4)+3+kd*8;
        yonler.forEach(function(y, yi){
          var f=(y[0] && y[1]) ? 0.72 : 1;
          var cx=e.x+y[0]*dd*f, cy=e.y+y[1]*dd*f;
          var l=y[0]>0 ? cx : (y[0]<0 ? cx-e.w : cx-e.w/2);
          var t=y[1]>0 ? cy : (y[1]<0 ? cy-e.h : cy-e.h/2);
          var b={ l:l, t:t, r:l+e.w, b:t+e.h };
          if(b.l<sinir.l || b.r>sinir.r || b.t<sinir.t || b.b>sinir.b) return;
          var ov=0;
          for(var q=0;q<dolu.length;q++){ var o=dolu[q]; if(e.hafifYok && o.a<0.05) continue; ov+=kesAlan(b, o)*o.a; }
          var skor=ov*50+kd*10+yi*1.2;
          if(!en || skor<en.skor) en={ b:b, skor:skor, kd:kd };
        });
        if(en && en.skor<(kd+1)*10) break;
      }
      var ok=onceki && onceki[yerAnahtar(e)];
      if(ok){
        var ol=e.x+ok[0]-e.w/2, ot=e.y+ok[1]-e.h/2, yb={ l:ol, t:ot, r:ol+e.w, b:ot+e.h };
        if(yb.l>=sinir.l && yb.r<=sinir.r && yb.t>=sinir.t && yb.b<=sinir.b && tamOrtusme(yb, dolu)===0){
          var ycx=Math.max(yb.l, Math.min(yb.r, e.x)), ycy=Math.max(yb.t, Math.min(yb.b, e.y));
          var ykd=Math.max(0, (Math.sqrt((ycx-e.x)*(ycx-e.x)+(ycy-e.y)*(ycy-e.y))-(e.r||4)-3)/8);
          var ysk=ykd*10;
          if(!en || ysk<=en.skor+YAPIS) en={ b:yb, skor:ysk, kd:ykd>=0.5 ? Math.max(1, Math.round(ykd)) : 0, yapis:true };
        }
      }
      if(!en){
        var l0=Math.max(sinir.l, Math.min(sinir.r-e.w, e.x-e.w/2));
        var t0=Math.max(sinir.t, Math.min(sinir.b-e.h, e.y-(e.r||4)-3-e.h));
        en={ b:{ l:l0, t:t0, r:l0+e.w, b:t0+e.h }, kd:1 };
      }
      // Halkalarda TAM engelden (yazı, işaret) boş yer yoksa bütün çizimde en
      // yakın boş yer aranır (kılavuzla bağlanır): sıkışık dar çizimde iki çip
      // üst üste düşüyordu (Siper, 338 px, alttan, rijitlik — ölçüldü).
      if(!en.yapis && tamOrtusme(en.b, dolu)>0){
        // arama penceresi: işaretin çevresinde ±220 px (yalnız oraya düşen engeller)
        var P0={ l:Math.max(sinir.l, e.x-220-e.w), t:Math.max(sinir.t, e.y-220-e.h), r:Math.min(sinir.r, e.x+220+e.w), b:Math.min(sinir.b, e.y+220+e.h) };
        var yakin=dolu.filter(function(o){ return o.r>P0.l && o.l<P0.r && o.b>P0.t && o.t<P0.b; });
        var ar=null;
        for(var gy=P0.t; gy<=P0.b-e.h; gy+=5){
          for(var gx=P0.l; gx<=P0.r-e.w; gx+=5){
            var kb={ l:gx, t:gy, r:gx+e.w, b:gy+e.h };
            var cx2=Math.max(kb.l, Math.min(kb.r, e.x)), cy2=Math.max(kb.t, Math.min(kb.b, e.y));
            var uz=Math.sqrt((cx2-e.x)*(cx2-e.x)+(cy2-e.y)*(cy2-e.y));
            if(ar && uz>=ar.sk) continue;
            if(tamOrtusme(kb, yakin)>0) continue;
            var hf=0;
            for(var q2=0;q2<yakin.length;q2++){ if(yakin[q2].a<0.5) hf+=kesAlan(kb, yakin[q2])*yakin[q2].a; }
            var sk=uz+hf*0.6;
            if(!ar || sk<ar.sk) ar={ b:kb, sk:sk };
          }
        }
        if(ar) en={ b:ar.b, kd:Math.max(1, en.kd) };
      }
      dolu.push({ l:en.b.l, t:en.b.t, r:en.b.r, b:en.b.b, a:1 });
      var cizgi=null;
      if(en.kd>=1 && !e.cizgisiz){
        var bx=Math.max(en.b.l, Math.min(en.b.r, e.x)), by=Math.max(en.b.t, Math.min(en.b.b, e.y));
        var dx=bx-e.x, dy=by-e.y, L=Math.sqrt(dx*dx+dy*dy);
        if(L>(e.r||4)+2) cizgi=[e.x+dx/L*((e.r||4)+1), e.y+dy/L*((e.r||4)+1), bx, by];
      }
      out.push(Object.assign({}, e, { kutu:en.b, cizgi:cizgi }));
    });
    return out;
  }
  function etiketOlc(e, olc){
    var fs2=e.fs2||e.fs;
    var w1=olc(e.m1, e.fs, e.kalin), w2=e.m2 ? olc(e.m2, fs2, false) : 0;
    if(e.cip){ e.w=Math.max(w1, w2)+8; e.h=e.fs+6+(e.m2 ? fs2*1.2 : 0); }
    else { e.w=Math.max(w1, w2)+3; e.h=e.fs*1.18+(e.m2 ? fs2*1.2 : 0); }
    return e;
  }
  // Kılavuzlar ve yazılar AYRI döner: çağıran bütün çizgileri yazılardan önce
  // koyar (kılavuz, sonradan yerleşen bir yazının içinden geçmesin).
  function etiketCiz(liste){
    var k='', y='';
    liste.forEach(function(e){
      if(e.cizgi) k+='<line class="ve-ak-kilavuz"'+ak(e.k)+' x1="'+R(e.cizgi[0])+'" y1="'+R(e.cizgi[1])+'" x2="'+R(e.cizgi[2])+'" y2="'+R(e.cizgi[3])+'"/>';
      var b=e.kutu, ort=(b.l+b.r)/2, fs2=e.fs2||e.fs;
      if(e.cip){
        y+='<g class="ve-ak-cip '+(e.sinif||'')+'"'+ak(e.k, e.bilgi)+'><rect x="'+R(b.l)+'" y="'+R(b.t)+'" width="'+R(b.r-b.l)+'" height="'+R(b.b-b.t)+'" rx="3"/>'
          + yazi(ort, b.t+3+e.fs*0.86, e.m1, '', e.fs, 'middle', e.kalin)
          + (e.m2 ? yazi(ort, b.t+3+e.fs*0.86+fs2*1.2, e.m2, 'ikincil', fs2, 'middle', false) : '')+'</g>';
      } else {
        y+='<g'+ak(e.k, e.bilgi)+'>'+yazi(ort, b.t+e.fs*0.9, e.m1, 've-ak-yz '+(e.sinif||''), e.fs, 'middle', e.kalin)
          + (e.m2 ? yazi(ort, b.t+e.fs*0.9+fs2*1.2, e.m2, 've-ak-yz ikincil', fs2, 'middle', false) : '')+'</g>';
      }
    });
    return { kilavuz:k, yazi:y };
  }

  // ── Mod şekli ve statik denge: rijit gövde yer değiştirmesi ──────────────
  // Raporun §8.16 formülü: Δ(p) = 1000·u + θ × (p − c_G) [mm]. Ölçek: en
  // büyük öteleme açıklığın %10'u, en büyük dönme 6° (rapordaki iki sınır).
  function modDelta(phi, c, p, s){
    var r=[p[0]-c[0], p[1]-c[1], p[2]-c[2]];
    return [s*(phi[0]*1000+phi[4]*r[2]-phi[5]*r[1]), s*(phi[1]*1000+phi[5]*r[0]-phi[3]*r[2]), s*(phi[2]*1000+phi[3]*r[1]-phi[4]*r[0])];
  }
  function modOlcek(m, phi){
    var c=m.cgR, pts=[];
    m.govde.forEach(function(b){
      var h=b.kutu ? b.kutu.map(function(v){ return v/2; }) : [0, 0, 0];
      [-1, 1].forEach(function(i){ [-1, 1].forEach(function(j){ [-1, 1].forEach(function(k){ pts.push([b.x+i*h[0], b.y+j*h[1], b.z+k*h[2]]); }); }); });
    });
    m.takoz.forEach(function(t){ pts.push([t.x, t.y, t.z]); });
    if(!pts.length) return 0;
    var xs=pts.map(function(p){ return p[0]; }), span=Math.max.apply(null, xs)-Math.min.apply(null, xs), maxD=0;
    pts.forEach(function(p){ var d=modDelta(phi, c, p, 1); maxD=Math.max(maxD, Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])); });
    var maxR=Math.max(Math.abs(phi[3]), Math.abs(phi[4]), Math.abs(phi[5]));
    var sT=maxD>0 ? span*0.10/maxD : Infinity, sR=maxR>0 ? (6*Math.PI/180)/maxR : Infinity;
    var s=Math.min(sT, sR);
    return isFinite(s) ? s : 0;
  }
  // Statik denge: q = [u (mm), θ (rad)] — çözümün qStatic'i.
  function cokmeDelta(m, p, n){
    var u=m.q.u, t=m.q.t, c=m.cgR, r=[p[0]-c[0], p[1]-c[1], p[2]-c[2]];
    return [n*(u[0]+t[1]*r[2]-t[2]*r[1]), n*(u[1]+t[2]*r[0]-t[0]*r[2]), n*(u[2]+t[0]*r[1]-t[1]*r[0])];
  }
  // Çizimin kapsamı (mm): kutuların köşeleri, nokta kütleler, takozlar.
  function kapsam(m){
    var xs=[], ys=[], zs=[0];
    m.govde.forEach(function(g){
      if(g.kutu) [0, 1, 2].forEach(function(i){ var c=[g.x, g.y, g.z][i], h=g.kutu[i]/2; [xs, ys, zs][i].push(c-h, c+h); });
      else { xs.push(g.x); ys.push(g.y); zs.push(g.z); }
    });
    m.takoz.forEach(function(t){ xs.push(t.x); ys.push(t.y); zs.push(t.z); });
    if(m.G){ xs.push(m.G.x); ys.push(m.G.y); zs.push(m.G.z); }
    if(!xs.length){ xs.push(0); ys.push(0); }
    return { xmin:Math.min.apply(null, xs), xmax:Math.max.apply(null, xs), ymin:Math.min.apply(null, ys), ymax:Math.max.apply(null, ys),
             zmin:Math.min.apply(null, zs), zmax:Math.max.apply(null, zs) };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ÇİZİCİ
  // ════════════════════════════════════════════════════════════════════════
  function ciz(m, o){
    o=o||{};
    _secili=(o.secili!=null) ? o.secili : null;
    var W=o.W||354, sade=!!o.sade, stil=o.stil||'golge';
    // Serbest kamerada (o.kam = { az, el }) bakış işaretleri yönden türer:
    // duvar, cam zemin ve G'nin izi hangi tarafın izleyiciye baktığını sorar.
    var yon=o.kam ? kamYon(o.kam) : null;
    var b=yon ? kamB(yon) : { x:(o.b && o.b.x>0) ? 1 : -1, y:(o.b && o.b.y>0) ? 1 : -1, z:(o.b && o.b.z<0) ? -1 : 1 };
    var iz=IZ[o.iz] ? o.iz : 'dim';
    var K=kamera(iz, b, yon);
    var kat=Object.assign({ zemin:true, golge:true }, o.kat||{});
    var etk=sade ? 'yok' : (o.etiket||'ad');
    var FK=(o.fs && o.fs.k) || 10, FB=(o.fs && o.fs.b) || 11;
    var olc=o.olc || tahmin;
    // İŞARET BOYU (kullanıcı 2026-10-16: "takoz ve bileşenlerin ağırlık
    // merkezlerinin görünümü biraz ufak olmuş"): takoz küpü, G, gövde CG'si,
    // nokta kütle ve onların izleri o.isaret katıyla büyür; serbest kamerada
    // yakınlaştırmayla da (√yakın, 0,75–1,75) — model büyürken işaret noktaya
    // dönmez, uzaklaşınca modeli boğmaz. ÖLÇÜ olanlar büyümez: kuvvet okunun
    // boyu (ağırlıkla tepkiler aynı px/N), cetvel, eksen üçlüsü, yazı.
    // Varsayılan 1: rapor ve karolar birebir eski.
    var ik=(o.isaret>0 ? o.isaret : 1)*(o.kure ? Math.max(0.75, Math.min(1.75, Math.sqrt(o.yakin || 1))) : 1);
    var kut=m.govde.filter(function(g){ return g.kutu; }).map(function(g){ return { g:g, c:[g.x, g.y, g.z], h:g.kutu.map(function(v){ return v/2; }) }; });
    var nok=m.govde.filter(function(g){ return !g.kutu; });
    var Kp=kapsam(m);
    // Izgara adımı: güç grubu 2,6 m'den uzunsa 500, değilse 250 mm.
    var A=(Kp.xmax-Kp.xmin)>2600 ? 500 : 250;
    var gx0=Math.floor((Kp.xmin-120)/A)*A, gx1=Math.ceil((Kp.xmax+120)/A)*A;
    var gy0=Math.floor((Kp.ymin-120)/A)*A, gy1=Math.ceil((Kp.ymax+120)/A)*A;
    var zf=kat.duvar ? Math.min(0, Math.floor(Kp.zmin/(A/2))*(A/2)) : 0;
    var zt=Math.max(A/2, Math.ceil(Kp.zmax/(A/2))*(A/2));
    // Duvarlar izleyiciden UZAK düzlemler.
    var yD=b.y<0 ? gy1 : gy0, xD=b.x<0 ? gx1 : gx0, zD=b.z>0 ? zf : zt;
    var hareket=o.mod ? function(p){ return add(p, modDelta(o.mod.phi, m.cgR, p, o.mod.s*(o.mod.faz==null ? 0 : o.mod.faz))); } : null;

    // ── SIĞDIRMA: modelin noktaları; ok ve haç gibi px boylu süsler ikinci geçişte
    var nokta3=[];
    kut.forEach(function(q){ yuzler(q.c, q.h).forEach(function(f){ f.pts.forEach(function(p){ nokta3.push(p); }); }); });
    nok.forEach(function(g){ nokta3.push([g.x, g.y, g.z]); });
    m.takoz.forEach(function(t){ nokta3.push([t.x, t.y, t.z]); });
    if(m.G) nokta3.push([m.G.x, m.G.y, m.G.z]);
    // Serbest kameranın küresi MODELİN kendisinden (zemin, duvar ve cetvel
    // hariç): döndürülen modeldir; zemin kenarda kesilebilir.
    var modelNokta=nokta3.slice();
    if(kat.zemin || kat.direk || kat.golge) [gx0, gx1].forEach(function(x){ [gy0, gy1].forEach(function(y){ nokta3.push([x, y, 0]); }); });
    if(kat.duvar) [gx0, gx1].forEach(function(x){ [gy0, gy1].forEach(function(y){ [zf, zt].forEach(function(z){ nokta3.push([x, y, z]); }); }); });
    // Z cetveli ekranda EN SOLDAKİ taban köşesinde: model onu hiç örtmez.
    var zk=[[gx0, gy0], [gx1, gy0], [gx0, gy1], [gx1, gy1]].reduce(function(a, c){ return K.P([c[0], c[1], 0])[0] < K.P([a[0], a[1], 0])[0]-1e-6 ? c : a; });
    if(kat.cetvel && !sade) nokta3.push([zk[0], zk[1], zt]);
    var ikisi=function(p){ nokta3.push(p); modelNokta.push(p); };
    if(o.mod) [1, -1].forEach(function(sg){ kut.forEach(function(q){ yuzler(q.c, q.h).forEach(function(f){ f.pts.forEach(function(p){ ikisi(add(p, modDelta(o.mod.phi, m.cgR, p, sg*o.mod.s))); }); }); }); });
    if(kat.asal && m.asal && m.G){
      var E0=m.asal.eksenler, H0=m.asal.kutu.map(function(v){ return v/2; });
      [-1, 1].forEach(function(sg){ E0.forEach(function(e, i){ ikisi(add([m.G.x, m.G.y, m.G.z], mul(e, sg*H0[i]))); }); });
    }
    // Serbest kamerada pay yazıdan bağımsız: sürüklerken yazısız çizilen kare
    // bırakınca yazılı çizilenle AYNI yerde olmalı (yoksa çizim zıplar ve
    // tekerleğin merkezi kayar).
    var pad=sade ? { l:6, r:6, t:6, b:6 }
      : { l:kat.cetvel ? 46 : 18, r:kat.cetvel ? 34 : 18, t:(etk==='yok' && !o.kure) ? 14 : (kat.cetvel ? 48 : 34), b:o.ucluyok ? 16 : 44 };
    function sigdir(pts, H0){
      var sp=pts.map(function(p){ return K.P(p); });
      var a=Math.min.apply(null, sp.map(function(q){ return q[0]; })), c=Math.max.apply(null, sp.map(function(q){ return q[0]; }));
      var d=Math.min.apply(null, sp.map(function(q){ return q[1]; })), e=Math.max.apply(null, sp.map(function(q){ return q[1]; }));
      var sc0=(W-pad.l-pad.r)/Math.max(c-a, 1);
      var H=H0 || Math.round(Math.max(o.Hmin||150, Math.min(o.Hmax||440, (e-d)*sc0+pad.t+pad.b)));
      var sc=Math.min(sc0, (H-pad.t-pad.b)/Math.max(e-d, 1));
      return { sc:sc, ox:pad.l+(W-pad.l-pad.r-(c-a)*sc)/2-a*sc, oy:pad.t+(H-pad.t-pad.b-(e-d)*sc)/2-d*sc, H:H };
    }
    // SERBEST kamerada (o.kure) sığdırma DÖNMEDEN BAĞIMSIZ: noktaların 3B
    // kutusunun merkezi çizimin ortasına, en uzak nokta yarıçap — döndürürken
    // çizim büyüyüp küçülmez. o.yakin ölçek çarpanı, o.kay [px, px] kaydırma.
    function kure(pts){
      var mn=[Infinity, Infinity, Infinity], mx=[-Infinity, -Infinity, -Infinity], rr=1;
      pts.forEach(function(p){ for(var i=0;i<3;i++){ if(p[i]<mn[i]) mn[i]=p[i]; if(p[i]>mx[i]) mx[i]=p[i]; } });
      var c=[(mn[0]+mx[0])/2, (mn[1]+mx[1])/2, (mn[2]+mx[2])/2];
      pts.forEach(function(p){ var d=Math.sqrt(Math.pow(p[0]-c[0], 2)+Math.pow(p[1]-c[1], 2)+Math.pow(p[2]-c[2], 2)); if(d>rr) rr=d; });
      var H=o.H || Math.round(W*0.78), kay=o.kay || [0, 0];
      var sc=Math.min(W-pad.l-pad.r, H-pad.t-pad.b)/(2*rr)*(o.yakin || 1);
      var q=K.P(c), cx=pad.l+(W-pad.l-pad.r)/2, cy=pad.t+(H-pad.t-pad.b)/2;
      return { sc:sc, ox:cx-q[0]*sc+kay[0], oy:cy-q[1]*sc+kay[1], H:H, kure:[cx, cy] };
    }
    var F=o.F || (o.kure ? kure(modelNokta) : sigdir(nokta3, o.H));
    // Okların ikinci geçişi serbest kamerada YOK: px boylu ok model biriminde
    // yakınlıkla değişir ve küreyi her yakınlaştırmada oynatırdı.
    if(!o.F && !o.kure && (kat.kuvvet || kat.rijit)){
      var ek=nokta3.slice(), Lw=70/F.sc;
      if(kat.kuvvet && m.G) ek.push([m.G.x, m.G.y, m.G.z-Lw*1.15]);
      m.takoz.forEach(function(t){
        if(kat.kuvvet) ek.push([t.x, t.y, t.z+Lw*0.6]);
        ek.push([t.x+26*ik/F.sc, t.y+26*ik/F.sc, t.z+26*ik/F.sc], [t.x-26*ik/F.sc, t.y-26*ik/F.sc, t.z-26*ik/F.sc]);
      });
      F=sigdir(ek, o.H);
    }
    var H=F.H, sc=F.sc;
    function P(p){ var q=K.P(p); return [F.ox+q[0]*sc, F.oy+q[1]*sc]; }
    function Ph(p){ return P(hareket ? hareket(p) : p); }
    function yol(l, f){ return l.map(function(q){ var s=(f||P)(q); return R(s[0])+' '+R(s[1]); }).join(' L'); }

    // ── GÖVDELER (uzaktan yakına), TAKOZLAR, G — hareket eden katman ─────
    // Seçimin halkası (o.secili) EN ÜSTTE: nokta kütle ve takoz önündeki bir
    // küpün altında kalıyordu (Tulga'nın arka braketi T3'ün arkasında).
    // PERDE (o.perde + o.secili; kullanıcı 2026-10-16: "o parçaya geldiğimde
    // aydınlık olsun, diğer parçalar gölgeye düşsün"): model, yazıları ve
    // kılavuzları yarı saydam bir perdenin ALTINDA; seçili bileşenin gövdesi,
    // halkası ve adı perdenin ÜSTÜNDE (odakSvg) — arkasındaki bir gövdenin
    // içinden de görünür. Üstte çizilen kenar ve halka alttaki bir yazının
    // içinden geçmesin (yazı kuralı): seçilinin kutusu ve halkasının çevresi
    // yazılara TAM engel (sec). Zemindeki izi perdenin altında kalır.
    var odak=(_secili!=null && !!o.perde), odakSvg='';
    var engel=[], govdeSvg='', secSvg='';
    var koy=function(k, svg){ if(odak && k===_secili) odakSvg+=svg; else govdeSvg+=svg; };
    var sec=function(k){ return odak && k===_secili; };
    var sira=kut.map(function(q){ return { q:q, d:K.derin(q.c) }; })
      .concat(nok.map(function(g){ return { g:g, d:K.derin([g.x, g.y, g.z]) }; }))
      .sort(function(a, c){ return a.d-c.d; });
    sira.forEach(function(it){
      if(it.g){
        var gq=Ph([it.g.x, it.g.y, it.g.z]);
        // Seçili nokta kütle büyür: aydınlık dolgusu (CSS) 2,4·ik'lik noktada
        // vurgu kenarının içinde kayboluyordu.
        koy(it.g.k, '<circle class="ve-ak-nokta"'+ak(it.g.k, it.g.bilgi)+' cx="'+R(gq[0])+'" cy="'+R(gq[1])+'" r="'+R((it.g.k===_secili ? 3.6 : 2.4)*ik)+'"/>');
        if(it.g.k===_secili) secSvg+='<circle class="ve-ak-sec-hale" cx="'+R(gq[0])+'" cy="'+R(gq[1])+'" r="'+R(6.5*ik)+'"/>';
        var ne=sec(it.g.k) ? 8*ik : 3*ik;
        engel.push({ l:gq[0]-ne, t:gq[1]-ne, r:gq[0]+ne, b:gq[1]+ne });
        return;
      }
      var q=it.q, g=q.g, Y=yuzler(q.c, q.h);
      var h='<g class="ve-ak-g '+(stil==='xray' ? 'xray' : 'golge')+(g.ana ? ' ana' : '')+'"'+ak(g.k, g.bilgi)+'>';
      var gor=Y.filter(function(f){ return K.gorunur(f.n); });
      if(stil==='xray'){
        gor.forEach(function(f){ h+='<path class="f-cam" d="M'+yol(f.pts, Ph)+' Z"/>'; });
        kenarlar(q.c, q.h).forEach(function(e){
          var gorK=e.yuz.some(function(yz){ var n=[0, 0, 0]; n[yz[0]]=yz[1]; return K.gorunur(n); });
          if(!gorK) h+='<path class="k-gizli" d="M'+yol([e.a, e.b], Ph)+'"/>';
        });
      } else gor.forEach(function(f){ h+='<path class="'+yuzSinif(f)+'" d="M'+yol(f.pts, Ph)+' Z"/>'; });
      koy(g.k, h+'</g>');
      var sp=[]; Y.forEach(function(f){ f.pts.forEach(function(p){ sp.push(P(p)); }); });
      engel.push({ l:Math.min.apply(null, sp.map(function(v){ return v[0]; })), t:Math.min.apply(null, sp.map(function(v){ return v[1]; })),
                   r:Math.max.apply(null, sp.map(function(v){ return v[0]; })), b:Math.max.apply(null, sp.map(function(v){ return v[1]; })), a:sec(g.k) ? 1 : 0.012 });
      if(stil==='xray'){
        var am=Ph(q.c);
        var ar=2.6*ik, ac=4.5*ik;
        koy(g.k, '<g class="ve-ak-amk"'+ak(g.k)+'><circle cx="'+R(am[0])+'" cy="'+R(am[1])+'" r="'+R(ar)+'"/><path d="M'+R(am[0]-ac)+' '+R(am[1])+' H'+R(am[0]+ac)+' M'+R(am[0])+' '+R(am[1]-ac)+' V'+R(am[1]+ac)+'"/></g>');
        // Gövdenin CG işareti bir veri işaretidir: yazı onu örtmez (raporun
        // çiziminde "G · z 798" ASFAT motorunun işaretinin üstüne düşüyordu).
        engel.push({ l:am[0]-5*ik, t:am[1]-5*ik, r:am[0]+5*ik, b:am[1]+5*ik });
      }
    });
    // Takozlar: küçük küp (izdüşümün kendi ekseniyle), gövdelerin üstünde.
    var takozSvg='', hm=4.4*ik/sc;
    m.takoz.slice().sort(function(a, c){ return K.derin([a.x, a.y, a.z])-K.derin([c.x, c.y, c.z]); }).forEach(function(t){
      var c=hareket ? hareket([t.x, t.y, t.z]) : [t.x, t.y, t.z];
      var Y=yuzler(c, [hm, hm, hm]).filter(function(f){ return K.gorunur(f.n); });
      var ts='<g class="ve-ak-t"'+ak(t.k, t.bilgi)+'>'+Y.map(function(f){ return '<path class="t-'+'xyz'[f.eks]+'" d="M'+yol(f.pts)+' Z"/>'; }).join('')+'</g>';
      if(odak && t.k===_secili) odakSvg+=ts; else takozSvg+=ts;
      var q=P(c), te=sec(t.k) ? 12*ik : 7*ik;
      engel.push({ l:q[0]-te, t:q[1]-te, r:q[0]+te, b:q[1]+te });
      if(t.k===_secili) secSvg+='<circle class="ve-ak-sec-hale" cx="'+R(q[0])+'" cy="'+R(q[1])+'" r="'+R(10*ik)+'"/>';
    });
    // G — düşey izi (yukarıdan bakışta, gölge ya da direk açıkken) ve işareti.
    var gSvg='', gq=null, g3=null;
    if(m.G){
      g3=hareket ? hareket([m.G.x, m.G.y, m.G.z]) : [m.G.x, m.G.y, m.G.z];
      gq=P(g3);
      var gz=P([m.G.x, m.G.y, 0]);
      var gIz='';
      if((kat.golge || kat.direk) && !kat.duvar && b.z>0 && !hareket)
        gIz=cz(gq[0], gq[1]+7*ik, gz[0], gz[1], 've-ak-gdus')+'<path class="ve-ak-giz" d="M'+R(gz[0]-5*ik)+' '+R(gz[1])+' H'+R(gz[0]+5*ik)+' M'+R(gz[0])+' '+R(gz[1]-3*ik)+' V'+R(gz[1]+3*ik)+'"/>';
      var gAm='<g class="ve-ak-gam">'+amG(gq[0], gq[1], R(6.5*ik))+'</g>';
      // Perdede G'nin yalnız işareti üstte; zemine inen izi (çizgi) altta kalır.
      if(sec('G')){ gSvg='<g'+ak('G', m.G.bilgi)+'>'+gIz+'</g>'; odakSvg+='<g'+ak('G', m.G.bilgi)+'>'+gAm+'</g>'; }
      else gSvg='<g'+ak('G', m.G.bilgi)+'>'+gIz+gAm+'</g>';
      var ge=sec('G') ? 12.5*ik : 8*ik;
      engel.push({ l:gq[0]-ge, t:gq[1]-ge, r:gq[0]+ge, b:gq[1]+ge });
      if(_secili==='G') secSvg+='<circle class="ve-ak-sec-hale" cx="'+R(gq[0])+'" cy="'+R(gq[1])+'" r="'+R(10.5*ik)+'"/>';
    }
    if(o.yalnizHareket) return { hareket:govdeSvg+takozSvg+gSvg+secSvg, H:H, F:F };

    var s=['<rect class="ve-ak-zem" x="0" y="0" width="'+W+'" height="'+H+'"/>'], ets=[], camZemin='';
    // ── DUVARLAR: taban + iki uzak duvar, üzerlerinde üç düz görünüş ──────
    if(kat.duvar){
      var taban=[[gx0, gy0, zD], [gx1, gy0, zD], [gx1, gy1, zD], [gx0, gy1, zD]];
      var yan=[[gx0, yD, zf], [gx1, yD, zf], [gx1, yD, zt], [gx0, yD, zt]];
      var uc=[[xD, gy0, zf], [xD, gy1, zf], [xD, gy1, zt], [xD, gy0, zt]];
      s.push('<path class="ve-ak-d-taban" d="M'+yol(taban)+' Z"/><path class="ve-ak-d-yan" d="M'+yol(yan)+' Z"/><path class="ve-ak-d-uc" d="M'+yol(uc)+' Z"/>');
      var dz='', x, y, z;
      for(x=gx0; x<=gx1+1e-6; x+=A) dz+='M'+yol([[x, gy0, zD], [x, gy1, zD]])+' M'+yol([[x, yD, zf], [x, yD, zt]])+' ';
      for(y=gy0; y<=gy1+1e-6; y+=A) dz+='M'+yol([[gx0, y, zD], [gx1, y, zD]])+' M'+yol([[xD, y, zf], [xD, y, zt]])+' ';
      for(z=zf; z<=zt+1e-6; z+=A/2) dz+='M'+yol([[gx0, yD, z], [gx1, yD, z]])+' M'+yol([[xD, gy0, z], [xD, gy1, z]])+' ';
      s.push('<path class="ve-ak-d-izg" d="'+dz+'"/>');
      var gol='';
      kut.forEach(function(q){
        var c=q.c, h=q.h;
        gol+='<g class="ve-ak-d-gol'+(q.g.ana ? ' ana' : '')+'"'+ak(q.g.k, q.g.bilgi)+'>'
          + '<path d="M'+yol([[c[0]-h[0], c[1]-h[1], zD], [c[0]+h[0], c[1]-h[1], zD], [c[0]+h[0], c[1]+h[1], zD], [c[0]-h[0], c[1]+h[1], zD]])+' Z"/>'
          + '<path d="M'+yol([[c[0]-h[0], yD, c[2]-h[2]], [c[0]+h[0], yD, c[2]-h[2]], [c[0]+h[0], yD, c[2]+h[2]], [c[0]-h[0], yD, c[2]+h[2]]])+' Z"/>'
          + '<path d="M'+yol([[xD, c[1]-h[1], c[2]-h[2]], [xD, c[1]+h[1], c[2]-h[2]], [xD, c[1]+h[1], c[2]+h[2]], [xD, c[1]-h[1], c[2]+h[2]]])+' Z"/></g>';
      });
      m.takoz.forEach(function(t){
        gol+='<g class="ve-ak-d-tg"'+ak(t.k, t.bilgi)+'>'+[[t.x, t.y, zD], [t.x, yD, t.z], [xD, t.y, t.z]].map(function(p){ var q=P(p); return '<rect x="'+R(q[0]-2.6*ik)+'" y="'+R(q[1]-2.6*ik)+'" width="'+R(5.2*ik)+'" height="'+R(5.2*ik)+'" rx="1"/>'; }).join('')+'</g>';
      });
      if(m.G){
        var G3=[m.G.x, m.G.y, m.G.z], Ga=P(G3);
        gol+='<g class="ve-ak-d-gg"'+ak('G', m.G.bilgi)+'>'+[[m.G.x, m.G.y, zD], [m.G.x, yD, m.G.z], [xD, m.G.y, m.G.z]].map(function(p){
          var q=P(p); return cz(Ga[0], Ga[1], q[0], q[1], 've-ak-d-gk')+'<path d="M'+R(q[0]-4*ik)+' '+R(q[1])+' H'+R(q[0]+4*ik)+' M'+R(q[0])+' '+R(q[1]-4*ik)+' V'+R(q[1]+4*ik)+'"/>';
        }).join('')+'</g>';
      }
      s.push(gol);
      if(!sade){
        [['TABAN · üstten', [gx0+(gx1-gx0)*0.5, b.y<0 ? gy0 : gy1, zD]], ['YAN DUVAR · yandan', [b.x<0 ? gx0 : gx1, yD, zt]],
         ['UÇ DUVAR · '+(b.x<0 ? 'önden' : 'arkadan'), [xD, b.y<0 ? gy0 : gy1, zt]]].forEach(function(d){
          var q=P(d[1]);
          ets.push(etiketOlc({ k:'duvar', x:q[0], y:q[1], r:2, m1:d[0], fs:FK, kalin:true, sinif:'duvar', pri:1, cizgisiz:true }, olc));
        });
      }
    } else if(kat.zemin){
      // Alttan bakışta Z = 0 düzlemi izleyiciyle gövdeler ARASINDA: zemin
      // camdan, gövdelerin üstünde çizilir ve gölge düşmez.
      var iz2='', x2, y2;
      for(x2=gx0; x2<=gx1+1e-6; x2+=A) iz2+='M'+yol([[x2, gy0, 0], [x2, gy1, 0]])+' ';
      for(y2=gy0; y2<=gy1+1e-6; y2+=A) iz2+='M'+yol([[gx0, y2, 0], [gx1, y2, 0]])+' ';
      var a0=P([gx0, 0, 0]), a1=P([gx1, 0, 0]), cam=b.z<0 ? ' cam' : '';
      var zem='<path class="ve-ak-izg'+cam+'" d="'+iz2+'"/>'+cz(a0[0], a0[1], a1[0], a1[1], 've-ak-sim'+cam);
      if(b.z<0) camZemin=zem; else s.push(zem);
    }

    // ── CETVEL: eksen boyunca mm — izdüşümün oranını gösterir ──────────────
    var cvCizgi='', cvYazi='';
    if(kat.cetvel && !sade){
      var cvDolu=[];
      var cakisir=function(k){ return cvDolu.some(function(d){ return k.l<d.r+2 && d.l<k.r+2 && k.t<d.b+1 && d.t<k.b+1; }); };
      var cetvel=function(p0, eks, v0, v1, dis){
        var e=[0, 0, 0]; e[eks]=1;
        var c0=P(p0), c1=P(add(p0, mul(e, v1-v0)));
        var o0=P(p0), o1=P(add(p0, dis)), ux=o1[0]-o0[0], uy=o1[1]-o0[1], ul=Math.sqrt(ux*ux+uy*uy)||1; ux/=ul; uy/=ul;
        cvCizgi+=cz(c0[0], c0[1], c1[0], c1[1], 've-ak-cv');
        var adPx=Math.sqrt(Math.pow(c1[0]-c0[0], 2)+Math.pow(c1[1]-c0[1], 2))*A/Math.max(v1-v0, 1);
        var atla=adPx<32 ? 2 : 1, v, i;
        for(v=v0, i=0; v<=v1+1e-6; v+=A, i++){
          var q=P(add(p0, mul(e, v-v0)));
          cvCizgi+=cz(q[0], q[1], q[0]+ux*4, q[1]+uy*4, 've-ak-cv');
          if(i%atla) continue;
          var t=sayi(v, 0), tw=olc(t, FK, false);
          var tx=q[0]+ux*(9+tw/2*Math.abs(ux)), ty=q[1]+uy*11;
          var kb={ l:tx-tw/2-1, t:ty-6, r:tx+tw/2+1, b:ty+6 };
          if(kb.l<2 || kb.r>W-2 || kb.t<2 || kb.b>H-2 || cakisir(kb)) continue;
          cvYazi+=yazi(tx, ty+3.5, t, 've-ak-cvy', FK, 'middle', false);
          engel.push(kb); cvDolu.push(kb);
        }
        // Eksenin adı: önce cetvelin ucunun ötesinde, sığmazsa grafik ekseni
        // başlığı gibi cetvelin ortasında, çentik yazılarının ötesinde.
        var ad='XYZ'[eks], aw=olc(ad, FB, true);
        var L2=Math.sqrt(Math.pow(c1[0]-c0[0], 2)+Math.pow(c1[1]-c0[1], 2))||1, ex2=(c1[0]-c0[0])/L2, ey2=(c1[1]-c0[1])/L2;
        var aday=[10, 18, 26, 34].map(function(g){ return [c1[0]+ex2*(g+aw/2*Math.abs(ex2)), c1[1]+ey2*g+(eks===2 ? -4 : 3.5)]; });
        [36, 46].forEach(function(od){ [0.5, 0.62, 0.38, 0.75, 0.25, 0.88].forEach(function(f){
          var px=c0[0]+(c1[0]-c0[0])*f, py=c0[1]+(c1[1]-c0[1])*f;
          aday.push([px+ux*(od+aw/2*Math.abs(ux)), py+uy*od+3.5]);
        }); });
        for(var j=0; j<aday.length; j++){
          var nx=aday[j][0], ny=aday[j][1], kk={ l:nx-aw/2-1, t:ny-FB, r:nx+aw/2+1, b:ny+3 };
          if(kk.l<2 || kk.r>W-2 || kk.t<2 || kk.b>H-2 || cakisir(kk)) continue;
          cvYazi+=yazi(nx, ny, ad, 've-ak-cvad', FB, 'middle', true); engel.push(kk); cvDolu.push(kk); break;
        }
      };
      // X ve Y cetveli tabanın ekranda ALTTA kalan kenarlarında: yukarıdan
      // bakışta yakın, alttan bakışta uzak kenar — ikisinde de gövdelerin
      // izdüşümüne binmez.
      var xo=(gx0+gx1)/2, yo=(gy0+gy1)/2;
      var altKenar=function(pa, pb, a, c){ var qa=P(pa), qb=P(pb); return Math.abs(qa[1]-qb[1])>1 ? (qa[1]>qb[1] ? a : c) : (qa[0]<=qb[0] ? a : c); };
      var yKen=altKenar([xo, gy0, 0], [xo, gy1, 0], gy0, gy1), xKen=altKenar([gx0, yo, 0], [gx1, yo, 0], gx0, gx1);
      cetvel([gx0, yKen, 0], 0, gx0, gx1, [0, yKen===gy0 ? -1 : 1, 0]);
      cetvel([xKen, gy0, 0], 1, gy0, gy1, [xKen===gx0 ? -1 : 1, 0, 0]);
      cetvel([zk[0], zk[1], 0], 2, 0, zt, [zk[0]===gx0 ? -1 : 1, zk[1]===gy0 ? -1 : 1, 0]);
      s.push('<g class="ve-ak-cvg">'+cvCizgi+'</g>');
    }
    // ── GÖLGE: gövdelerin Z = 0'a düşen izi (yalnız yukarıdan bakışta) ─────
    if(kat.golge && !kat.duvar && b.z>0){
      var gl='';
      kut.forEach(function(q){ var c=q.c, h=q.h; gl+='<path class="ve-ak-gol"'+ak(q.g.k)+' d="M'+yol([[c[0]-h[0], c[1]-h[1], 0], [c[0]+h[0], c[1]-h[1], 0], [c[0]+h[0], c[1]+h[1], 0], [c[0]-h[0], c[1]+h[1], 0]])+' Z"/>'; });
      s.push(gl);
    }
    // ── DİREKLER: takozun Z = 0'a düşeyi, tabanda izi ──────────────────────
    var direkSvg='';
    if(kat.direk) m.takoz.forEach(function(t){
      var a=P([t.x, t.y, t.z]), z0=P([t.x, t.y, 0]);
      direkSvg+='<g class="ve-ak-direk"'+ak(t.k)+'>'+cz(a[0], a[1], z0[0], z0[1], 'dr-c')+'<path class="dr-i" d="M'+R(z0[0]-4*ik)+' '+R(z0[1])+' H'+R(z0[0]+4*ik)+' M'+R(z0[0])+' '+R(z0[1]-2.5*ik)+' V'+R(z0[1]+2.5*ik)+'"/></g>';
    });
    // ── MOD: dinlenme hâli kesikli, hareket edenin altında ─────────────────
    var hayalet='';
    if(o.mod && !sade){
      hayalet='<g class="ve-ak-hayalet">';
      kut.forEach(function(q){ yuzler(q.c, q.h).filter(function(f){ return K.gorunur(f.n); }).forEach(function(f){ hayalet+='<path d="M'+yol(f.pts)+' Z"/>'; }); });
      hayalet+='</g>';
    }
    // ── STATİK ÇÖKME (büyütülmüş) — kuvvet katmanının seçeneği ─────────────
    var cokmeSvg='', cokmeN=0;
    if(kat.cokme && m.q){
      var enCok=0, KAT=[5, 10, 20, 25, 50, 100, 200, 250, 500];
      kut.forEach(function(q){ yuzler(q.c, q.h).forEach(function(f){ f.pts.forEach(function(p){ var d=cokmeDelta(m, p, 1); enCok=Math.max(enCok, Math.sqrt(dot(d, d))); }); }); });
      cokmeN=KAT[0]; KAT.forEach(function(c){ if(enCok*sc*c<=18) cokmeN=c; });
      kut.forEach(function(q){
        cokmeSvg+='<g class="ve-ak-cokme"'+ak(q.g.k)+'>'+yuzler(q.c, q.h).filter(function(f){ return K.gorunur(f.n); })
          .map(function(f){ return '<path d="M'+yol(f.pts.map(function(p){ return add(p, cokmeDelta(m, p, cokmeN)); }))+' Z"/>'; }).join('')+'</g>';
      });
    }
    // ── RİJİTLİK HAÇI: takozda üç kol, statik rijitlikle orantılı ──────────
    var rijitSvg='';
    if(kat.rijit && m.takoz.length){
      var kmax=Math.max.apply(null, m.takoz.map(function(t){ return Math.max(t.ks[0]||0, t.ks[1]||0, t.ks[2]||0); }))||1;
      m.takoz.forEach(function(t){
        var h='<g class="ve-ak-rj"'+ak(t.k, t.bilgi)+'>';
        [0, 1, 2].forEach(function(i){
          var L=(24*ik/sc)*Math.max(0, t.ks[i]||0)/kmax, e=[0, 0, 0]; e[i]=L;
          if(!(L>0)) return;
          var a=P([t.x-e[0], t.y-e[1], t.z-e[2]]), c=P([t.x+e[0], t.y+e[1], t.z+e[2]]);
          h+=cz(a[0], a[1], c[0], c[1], 've-ak-rj-'+'xyz'[i]);
        });
        rijitSvg+=h+'</g>';
      });
    }
    // ── ASAL EKSENLER ve birleşik eşdeğer kutu (G'de) ───────────────────────
    var asalSvg='';
    if(kat.asal && m.asal && m.G){
      var E=m.asal.eksenler, Hh=m.asal.kutu.map(function(v){ return v/2; }), c0=[m.G.x, m.G.y, m.G.z], kose=[];
      [-1, 1].forEach(function(i){ [-1, 1].forEach(function(j){ [-1, 1].forEach(function(k){ kose.push(add(add(add(c0, mul(E[0], i*Hh[0])), mul(E[1], j*Hh[1])), mul(E[2], k*Hh[2]))); }); }); });
      var kn=[];
      for(var a=0; a<8; a++) for(var c2=a+1; c2<8; c2++){ var df=a^c2; if(df===1 || df===2 || df===4) kn.push([kose[a], kose[c2]]); }
      asalSvg+='<g class="ve-ak-as-kutu">'+kn.map(function(e){ return '<path d="M'+yol(e)+'"/>'; }).join('')+'</g>';
      E.forEach(function(e, i){
        var p1=P(add(c0, mul(e, -Hh[i]))), p2=P(add(c0, mul(e, Hh[i])));
        var bl=[(i+1)+'. asal eksen', 'I = '+sayi(m.asal.degerler[i], 1)+' kg·m²', 'Yön ('+e.map(function(v){ return sayi(v, 2); }).join('; ')+')'];
        asalSvg+='<g'+ak('as'+i, bl)+'>'+cz(p1[0], p1[1], p2[0], p2[1], 've-ak-as-'+(i+1))+'</g>';
        if(!sade) ets.push(etiketOlc({ k:'as'+i, bilgi:bl, x:p2[0], y:p2[1], r:3, m1:'I'+'₁₂₃'[i]+' '+sayi(m.asal.degerler[i], 1)+' kg·m²', fs:FK, kalin:true, cip:true, sinif:'as-cip', pri:4 }, olc));
      });
    }
    // ── KUVVETLER: serbest cisim — ağırlık G'de aşağı, tepkiler takozlarda ──
    var kuvvetSvg='';
    if(kat.kuvvet && m.G && m.takoz.every(function(t){ return t.f; })){
      var Wn=m.G.m*9.81, Lk=70, fA=Lk/Math.max(Wn, 1e-9);   // px / N: AĞIRLIK ve TEPKİLER AYNI ÖLÇEKTE
      var yonEkran=function(v){ var p0=P([0, 0, 0]), p1=P(v), dx=p1[0]-p0[0], dy=p1[1]-p0[1], L=Math.sqrt(dx*dx+dy*dy)||1; return [dx/L, dy/L]; };
      var asagi=yonEkran([0, 0, -1]);
      var wy={ x:gq[0]+asagi[0]*(Lk+8*ik), y:gq[1]+asagi[1]*(Lk+8*ik) };
      kuvvetSvg+='<g class="ve-ak-kv-w"'+ak('G', m.G.bilgi)+'>'+ok(gq[0], gq[1]+8*ik, wy.x, wy.y, 've-ak-kv-wo', 7)+'</g>';
      engel.push({ l:wy.x-4, t:Math.min(gq[1], wy.y), r:wy.x+4, b:Math.max(gq[1], wy.y) });
      if(!sade) ets.push(etiketOlc({ k:'G', bilgi:m.G.bilgi, x:wy.x, y:wy.y, r:4, m1:'ağırlık '+sayi(m.G.m, 0)+' kg', fs:FK, kalin:true, pri:8, yon:[3, 0, 1, 6, 7] }, olc));
      m.takoz.forEach(function(t){
        var fr=mul(t.f, -1), L=Math.sqrt(dot(fr, fr))*fA, u=yonEkran(fr), a=P([t.x, t.y, t.z]);
        var b0=[a[0]+u[0]*7*ik, a[1]+u[1]*7*ik], b1=[b0[0]+u[0]*L, b0[1]+u[1]*L];
        kuvvetSvg+='<g class="ve-ak-kv-r"'+ak(t.k, t.bilgi)+'>'+ok(b0[0], b0[1], b1[0], b1[1], 've-ak-kv-ro', 5)+'</g>';
        engel.push({ l:Math.min(b0[0], b1[0])-3, t:Math.min(b0[1], b1[1])-3, r:Math.max(b0[0], b1[0])+3, b:Math.max(b0[1], b1[1])+3 });
        if(!sade && t.yukKg!=null) ets.push(etiketOlc({ k:t.k, bilgi:t.bilgi, x:b1[0], y:b1[1], r:3, m1:sayi(t.yukKg, 0)+' kg', fs:FK, kalin:true, cip:true, sinif:'t-cip', pri:6, yon:[2, 4, 5, 0, 1] }, olc));
      });
    }
    // ── ETİKETLER ───────────────────────────────────────────────────────────
    if(etk!=='yok'){
      // Seçili bileşen (o.secili — "Güç grubundaki yeri" ve föy satırının
      // vurgusu) her kipte ADIYLA, vurgu kenarlı çipte; 'secili' kipinde
      // yalnız o ve G yazılır, öteki işaretlerin bilgisi fare üstünde.
      var dar=W<560 && etk!=='genis', yalniz=(etk==='secili');
      // dar çizimde uzun ad kısalır (tam adı ipucunda): "Motor — Cummins …" → "Motor"
      var kisalt=function(ad){ return (dar && ad.indexOf(' — ')>0) ? ad.split(' — ')[0] : ((dar && ad.length>24) ? ad.slice(0, 22)+'…' : ad); };
      var yukari=b.z>0 ? [2, 4, 5, 0, 1, 3, 6, 7] : [3, 6, 7, 0, 1, 2, 4, 5];
      kut.concat(nok.map(function(g){ return { g:g, c:[g.x, g.y, g.z], h:[0, 0, 0] }; })).forEach(function(q){
        var g=q.g, sec=(_secili!=null && g.k===_secili);
        if(yalniz ? !sec : !(sec || g.ana || etk==='genis')) return;
        var ust=P([q.c[0], q.c[1], q.c[2]+(b.z>0 ? q.h[2] : -q.h[2])]);
        if(sec) ets.push(etiketOlc({ k:g.k, bilgi:g.bilgi, x:ust[0], y:ust[1], r:g.kutu ? 3 : 6.5*ik, m1:kisalt(g.ad), fs:FB, kalin:true,
          cip:true, sinif:'sec-cip', pri:10, yon:yukari }, olc));
        else ets.push(etiketOlc({ k:g.k, bilgi:g.bilgi, x:ust[0], y:ust[1], r:g.kutu ? 3 : 3*ik, m1:kisalt(g.ad), m2:sayi(g.m, 0)+' kg', fs:FB, fs2:FK, kalin:true,
          pri:g.ana ? 7 : 5, yon:yukari }, olc));
      });
      if(!kat.kuvvet) m.takoz.forEach(function(t){
        var sec=(_secili!=null && t.k===_secili);
        if(yalniz && !sec) return;
        var q=P(hareket ? hareket([t.x, t.y, t.z]) : [t.x, t.y, t.z]);
        var m1=etk==='genis' ? t.no+' '+t.ad : (sec ? t.no+' '+kisalt(t.ad) : (kat.direk ? t.no+' · z '+sayi(t.z, 0) : t.no));
        ets.push(etiketOlc({ k:t.k, bilgi:t.bilgi, x:q[0], y:q[1], r:(sec ? 10 : 6)*ik, m1:m1, fs:FK, kalin:true, cip:true,
          sinif:sec ? 't-cip sec-cip' : 't-cip', pri:sec ? 10 : 5 }, olc));
      });
      if(m.G && !kat.kuvvet) ets.push(etiketOlc({ k:'G', bilgi:m.G.bilgi, x:gq[0], y:gq[1], r:7*ik, m1:kat.direk ? 'G · z '+sayi(m.G.z, 0) : 'G', fs:FB, kalin:true, pri:9, hafifYok:true }, olc));
    }
    var katYazi='';
    if(kat.cokme && cokmeN && !sade){ katYazi=yazi(W-8, 14, 'sehim ×'+sayi(cokmeN, 0), 've-ak-yz ve-ak-kat', FK, 'end', true); engel.push({ l:W-80, t:2, r:W-4, b:18 }); }
    // ── EKSEN ÜÇLÜSÜ (cetvel yokken): kutusu hesaplanıp çizimin içine oturur
    var triOk='', triYazi='';
    if(!sade && !o.ucluyok && !kat.cetvel){
      // Serbest kamerada bir eksen izleyiciye doğru bakabilir: izdüşümü
      // kısaldıkça yönü belirsizleşir ve yazısı ötekilerin üstüne biner.
      // Kısa eksen (birim izdüşüm < 0,2) okla değil çizim notasyonuyla
      // çizilir — ⊙ izleyiciye, ⊗ izleyiciden; çakışan yazı eksene dik
      // kaydırılır. Hazır bakışlarda (en kısa eksen 0,47) çizim birebir eski.
      var L0=20, par=[];
      var yaziKutu=function(p){ var l=p.an==='start' ? p.tx : (p.an==='end' ? p.tx-p.tw : p.tx-p.tw/2); return { l:l, r:l+p.tw, t:p.ty-FK, b:p.ty+3 }; };
      [[1, 0, 0, 'X arka'], [0, 1, 0, 'Y sağ'], [0, 0, 1, 'Z']].forEach(function(e){
        var q0=K.P([0, 0, 0]), q=K.P([e[0], e[1], e[2]]), ux=q[0]-q0[0], uy=q[1]-q0[1], n=Math.sqrt(ux*ux+uy*uy);
        var nokta=n<0.2, tw=olc(e[3], FK, false);
        if(nokta){ ux=0.71; uy=0.71; } else { ux/=n; uy/=n; }
        var ex=nokta ? 0 : ux*L0, ey=nokta ? 0 : uy*L0, an=ux>0.3 ? 'start' : (ux<-0.3 ? 'end' : 'middle');
        var tx=nokta ? 7 : ex+ux*5, ty=nokta ? 13 : ey+uy*5+(uy>0.3 ? 8 : (uy<-0.3 ? -2 : 3.5));
        par.push({ ex:ex, ey:ey, tx:tx, ty:ty, tx0:tx, ty0:ty, ux:ux, uy:uy, tw:tw, ad:e[3], an:nokta ? 'start' : an,
          nokta:nokta ? (dot([e[0], e[1], e[2]], K.d)<0 ? 'goz' : 'arka') : null });
      });
      var cak=function(a, c){ return a.l<c.r+1 && c.l<a.r+1 && a.t<c.b+1 && c.t<a.b+1; };
      for(var ti=1;ti<par.length;ti++){
        var pp=par[ti], dn=0;
        while(dn<10 && par.slice(0, ti).some(function(o2){ return cak(yaziKutu(pp), yaziKutu(o2)); })){
          dn++;
          var kay2=(dn%2 ? 1 : -1)*Math.ceil(dn/2)*7;
          pp.tx=pp.tx0-pp.uy*kay2; pp.ty=pp.ty0+pp.ux*kay2;
        }
      }
      // ±4 px pay yalnız ⊙/⊗ dairesine: oklu üçlünün kutusu eskisiyle aynı.
      par.forEach(function(p){ var k2=yaziKutu(p), r0=p.nokta ? 4 : 0; p.kutu={ l:Math.min(-r0, p.ex, k2.l), r:Math.max(r0, p.ex, k2.r), t:Math.min(-r0, p.ey, k2.t), b:Math.max(r0, p.ey, k2.b) }; });
      var bl=Math.min.apply(null, par.map(function(q){ return q.kutu.l; })), br=Math.max.apply(null, par.map(function(q){ return q.kutu.r; }));
      var bt=Math.min.apply(null, par.map(function(q){ return q.kutu.t; })), bb=Math.max.apply(null, par.map(function(q){ return q.kutu.b; }));
      var bx=8-bl, by=H-6-bb;
      par.forEach(function(q){
        if(q.nokta) triOk+='<circle class="ve-ak-eks ve-ak-eks-n" cx="'+R(bx)+'" cy="'+R(by)+'" r="3.4"/>'
          + (q.nokta==='goz' ? '<circle class="ve-ak-eks-uc" cx="'+R(bx)+'" cy="'+R(by)+'" r="1.1"/>'
                             : '<path class="ve-ak-eks" d="M'+R(bx-2.2)+' '+R(by-2.2)+' L'+R(bx+2.2)+' '+R(by+2.2)+' M'+R(bx-2.2)+' '+R(by+2.2)+' L'+R(bx+2.2)+' '+R(by-2.2)+'"/>');
        else triOk+=ok(bx, by, bx+q.ex, by+q.ey, 've-ak-eks', 4);
        triYazi+=yazi(bx+q.tx, by+q.ty, q.ad, 've-ak-yz ve-ak-eksy', FK, q.an, false);
      });
      engel.push({ l:bx+bl-2, t:by+bt-2, r:bx+br+2, b:by+bb+2 });
    }
    // Yakınlaşmış serbest kamerada işaretin kendisi çizimin dışında kalabilir:
    // onun yazısı kenara kelepçelenip boşluğu gösteren bir kılavuz olurdu.
    if(o.kure) ets=ets.filter(function(e){ return e.x>=0 && e.x<=W && e.y>=0 && e.y<=H; });
    var L=yerlestir(ets, engel, { l:3, t:3, r:W-3, b:H-3 }, o.yer || null);
    var yer={};
    L.forEach(function(e){ yer[yerAnahtar(e)]=[(e.kutu.l+e.kutu.r)/2-e.x, (e.kutu.t+e.kutu.b)/2-e.y]; });
    var et=etiketCiz(L);
    if(odak) et.yazi=etiketCiz(L.filter(function(e){ return e.k!==_secili; })).yazi;
    var etS=odak ? etiketCiz(L.filter(function(e){ return e.k===_secili; })) : null;
    var oran=K.oran.map(function(v){ return sayi(v, 2); }).join(' : ');
    var svg='<svg class="ve-mnt2d-akso" viewBox="0 0 '+W+' '+H+'"'
      + ' preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+esc(o.aria || ((yon ? 'Serbest bakış' : IZ[iz].ad)+' · '+bakisAdi(b)))+'">'
      + s.join('')+direkSvg+hayalet
      + '<g class="ve-ak-hareket"><!--hb-->'+govdeSvg+takozSvg+gSvg+(odak ? '' : secSvg)+'<!--hs--></g>'
      + camZemin+cokmeSvg+rijitSvg+asalSvg+kuvvetSvg
      // bütün çizgiler yazılardan önce: kılavuz, üçlünün okları; sonra yazılar
      + et.kilavuz+triOk+triYazi+cvYazi+katYazi+et.yazi
      + (odak ? '<rect class="ve-ak-perde" x="0" y="0" width="'+W+'" height="'+H+'"/>'
          + '<g class="ve-ak-odak">'+odakSvg+secSvg+etS.yazi+'</g>' : '')
      + '</svg>';
    return { svg:svg, H:H, sc:sc, F:F, oran:oran, cokmeN:cokmeN, etiket:L, yer:yer };
  }
  // Canlandırmanın karesi: hareket eden katmanın içi (çizimin geri kalanı yerinde).
  function hareketIci(svg){ var a=svg.indexOf('<!--hb-->'), c=svg.indexOf('<!--hs-->'); return (a>=0 && c>a) ? svg.slice(a+9, c) : ''; }

  return {
    IZ:IZ, ANA_PAY:ANA_PAY, EL_SINIR:EL_SINIR, kamera:kamera, kamYon:kamYon, kamAci:kamAci, kamB:kamB, bakisAdi:bakisAdi, yuzler:yuzler, ciz:ciz, hareketIci:hareketIci,
    modDelta:modDelta, modOlcek:modOlcek, cokmeDelta:cokmeDelta, yerlestir:yerlestir, tahmin:tahmin, koord:koord
  };
})();

if(typeof module!=='undefined' && module.exports){ module.exports = veMntAkso; }
