// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — HESAP ÇEKİRDEĞİ (6 SD Rijit Gövde Modeli)
// ============================================================================
// SPEC: "Takoz Çökme–Titreşim Modülü (6 SD Rijit Gövde Modeli)" v1.0
// Doğrulama referansı: Adams BMC_TTAR_2031 (8×8 TTAR güç grubu).
// Numerik çözücüler powerpack_mount_analysis_A26.html'den (satır ~3245-3536)
// AYNEN port edilmiştir (SPEC Bölüm 10 "aynen taşı" listesi — doğrulanmış).
//
// KURALLAR (SPEC Bölüm 0/2/3 — pazarlıksız):
//  - Bu dosya SAF FONKSİYONLARDAN oluşur: DOM erişimi YOK, framework YOK.
//    UI katmanı (js/cp-mount.js) çekirdeği çağırır; tersi asla olmaz.
//  - Çekirdeğe giren her şey SI, çıkan her şey SI'dır (m, kg, N, N·m, rad, Hz).
//    mm / N/mm ↔ SI dönüşümü yalnızca UI okuma/yazma katmanında yapılır.
//  - Genelleştirilmiş koordinatlar q = [ux,uy,uz,θx,θy,θz], referans nokta
//    birleşik ağırlık merkezi G (kütle matrisi blok köşegen olur).
//  - Takoz sehimi: δ = u + θ×d = A·q,  A = [E3 | −skew(d)],  d = r_mount − c_G.
//    STANDART birinci-prensip kinematiği (işaret çevirmesi yok). Regresyon kilidi:
//    frende güç grubu BURUN AŞAĞI (ön takozlar daha çok basılı) — bkz. makeA.
//  - Takozun şasiye ilettiği kuvvet f = k·δ; statik yerçekiminde δz ve fz
//    NEGATİF (basma). Çekme (lift-off): δz > +0.01 mm.
//  - Atalet çarpım terimleri TENSÖR BİLEŞENİ olarak girilir (CATIA Measure
//    Inertia konvansiyonu): I = [[Ixx,Ixy,Ixz],[Ixy,Iyy,Iyz],[Ixz,Iyz,Izz]].
//
// Veri tipleri (SI):
//  Component: { name, mass [kg], cg:[x,y,z] (m), I:3x3 (kg·m², kendi CG'sinde),
//               pointMass:bool }
//  Mount:     { name, pos:[x,y,z] (m), kstat:[kx,ky,kz] (N/m), kdyn:[...] (N/m),
//               rotation?: (v1'de kullanılmaz — M5+ eğik takoz için rezerve) }
//  LoadCase:  { name, n:[nx,ny,nz] (g katsayısı; nz TOPLAM düşey ivme katsayısı,
//               yerçekimi DAHİL — Statik=(0,0,−1), Bump 3g=(0,0,−3)),
//               T:[Tx,Ty,Tz] (N·m, G'ye göre) }
// ----------------------------------------------------------------------------

var veMountCore = (function() {
  'use strict';

  // ═══════════════════ Numerik yardımcılar (A26 portu) ═══════════════════

  function eye(n){ const A=[]; for(let i=0;i<n;i++){ A[i]=Array(n).fill(0); A[i][i]=1; } return A; }
  function zeros(r,c){ const A=[]; for(let i=0;i<r;i++){ A[i]=Array(c).fill(0); } return A; }
  function matCopy(A){ return A.map(row=>row.slice()); }
  function matT(A){ const r=A.length, c=A[0].length; const AT=zeros(c,r); for(let i=0;i<r;i++) for(let j=0;j<c;j++) AT[j][i]=A[i][j]; return AT; }
  function matMul(A,B){
    const r=A.length, n=A[0].length, c=B[0].length;
    const C=zeros(r,c);
    for(let i=0;i<r;i++){
      for(let k=0;k<n;k++){
        const aik=A[i][k];
        if(aik===0) continue;
        for(let j=0;j<c;j++) C[i][j]+=aik*B[k][j];
      }
    }
    return C;
  }
  function matVec(A,x){ const r=A.length, c=A[0].length; const y=Array(r).fill(0); for(let i=0;i<r;i++){ let s=0; for(let j=0;j<c;j++) s += A[i][j]*x[j]; y[i]=s; } return y; }
  function addInPlace(A,B){ for(let i=0;i<A.length;i++) for(let j=0;j<A[0].length;j++) A[i][j]+=B[i][j]; }
  function dot(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }
  function norm(a){ return Math.sqrt(dot(a,a)); }

  // Kısmi pivotlu Gauss eliminasyonu. Singular K → null
  // (UI mesajı: "montaj kinematik olarak serbest olabilir").
  function solveLinear(Ain, bin){
    const n=Ain.length;
    const A=matCopy(Ain);
    const b=bin.slice();
    for(let k=0;k<n;k++){
      let piv=k, maxAbs=Math.abs(A[k][k]);
      for(let i=k+1;i<n;i++){
        const v=Math.abs(A[i][k]);
        if(v>maxAbs){ maxAbs=v; piv=i; }
      }
      if(maxAbs < 1e-18) return null;
      if(piv!==k){ [A[k],A[piv]]=[A[piv],A[k]]; [b[k],b[piv]]=[b[piv],b[k]]; }
      const akk=A[k][k];
      for(let i=k+1;i<n;i++){
        const f=A[i][k]/akk;
        if(f===0) continue;
        A[i][k]=0;
        for(let j=k+1;j<n;j++) A[i][j]-=f*A[k][j];
        b[i]-=f*b[k];
      }
    }
    const x=Array(n).fill(0);
    for(let i=n-1;i>=0;i--){
      let s=b[i];
      for(let j=i+1;j<n;j++) s-=A[i][j]*x[j];
      x[i]=s/A[i][i];
    }
    return x;
  }

  // Cholesky ayrıştırması (M = L·Lᵀ). SPD değilse null.
  function cholesky(A){
    const n=A.length;
    const L=zeros(n,n);
    for(let i=0;i<n;i++){
      for(let j=0;j<=i;j++){
        let s=A[i][j];
        for(let k=0;k<j;k++) s -= L[i][k]*L[j][k];
        if(i===j){
          if(s <= 0) return null;
          L[i][j]=Math.sqrt(s);
        }else{
          L[i][j]=s/L[j][j];
        }
      }
    }
    return L;
  }
  function solveLower(L, b){ const n=L.length; const x=Array(n).fill(0); for(let i=0;i<n;i++){ let s=b[i]; for(let k=0;k<i;k++) s -= L[i][k]*x[k]; x[i]=s/L[i][i]; } return x; }
  function solveUpper(U, b){ const n=U.length; const x=Array(n).fill(0); for(let i=n-1;i>=0;i--){ let s=b[i]; for(let k=i+1;k<n;k++) s -= U[i][k]*x[k]; x[i]=s/U[i][i]; } return x; }

  // Jacobi döndürme ile simetrik özdeğer/özvektör.
  function jacobiEigenSym(Ain, maxIter, eps){
    maxIter = maxIter || 120; eps = eps || 1e-12;
    const n=Ain.length;
    const A=matCopy(Ain);
    const V=eye(n);
    for(let iter=0; iter<maxIter; iter++){
      let p=0,q=1, maxv=0;
      for(let i=0;i<n;i++){
        for(let j=i+1;j<n;j++){
          const v=Math.abs(A[i][j]);
          if(v>maxv){ maxv=v; p=i; q=j; }
        }
      }
      if(maxv < eps) break;
      const app=A[p][p], aqq=A[q][q], apq=A[p][q];
      const phi=0.5*Math.atan2(2*apq, (aqq-app));
      const c=Math.cos(phi), s=Math.sin(phi);
      for(let k=0;k<n;k++){
        const aik=A[p][k], aqk=A[q][k];
        A[p][k]=c*aik - s*aqk;
        A[q][k]=s*aik + c*aqk;
      }
      for(let k=0;k<n;k++){
        const akp=A[k][p], akq=A[k][q];
        A[k][p]=c*akp - s*akq;
        A[k][q]=s*akp + c*akq;
      }
      A[p][q]=0; A[q][p]=0;
      for(let k=0;k<n;k++){
        const vip=V[k][p], viq=V[k][q];
        V[k][p]=c*vip - s*viq;
        V[k][q]=s*vip + c*viq;
      }
    }
    const vals=Array(n).fill(0);
    for(let i=0;i<n;i++) vals[i]=A[i][i];
    return {vals, vecs: V};
  }
  function sortEigen(vals, vecs){
    const n=vals.length;
    const idx=[...Array(n).keys()].sort((i,j)=>vals[i]-vals[j]);
    const vals2=idx.map(i=>vals[i]);
    const vecs2=zeros(n,n);
    for(let col=0; col<n; col++){
      const src=idx[col];
      for(let row=0; row<n; row++) vecs2[row][col]=vecs[row][src];
    }
    return {vals: vals2, vecs: vecs2};
  }

  // Genelleştirilmiş özdeğer problemi (K − λM)φ = 0:
  // 1. M = L·Lᵀ (Cholesky)  2. Kp = L⁻¹·K·L⁻ᵀ  3. Jacobi  4. φ = L⁻ᵀ·y
  function generalizedEigenSym(K, M){
    const L=cholesky(M);
    if(!L) return null;
    const n=K.length;
    const B=zeros(n,n);
    for(let j=0;j<n;j++){
      const Kcol=Array(n).fill(0);
      for(let i=0;i<n;i++) Kcol[i]=K[i][j];
      const Bj=solveLower(L, Kcol);
      for(let i=0;i<n;i++) B[i][j]=Bj[i];
    }
    const X=zeros(n,n);
    for(let j=0;j<n;j++){
      const rhs=Array(n).fill(0);
      for(let i=0;i<n;i++) rhs[i]=B[j][i];
      const xcol=solveLower(L, rhs);
      for(let i=0;i<n;i++) X[i][j]=xcol[i];
    }
    const Kp=zeros(n,n);
    for(let i=0;i<n;i++) for(let j=0;j<n;j++) Kp[i][j]=X[j][i];

    const ev=jacobiEigenSym(Kp);
    const sorted=sortEigen(ev.vals, ev.vecs);

    const U=zeros(n,n);
    for(let i=0;i<n;i++) for(let j=0;j<n;j++) U[i][j] = (j>=i) ? L[j][i] : 0;

    const V=zeros(n,n);
    for(let col=0; col<n; col++){
      const y=Array(n).fill(0);
      for(let i=0;i<n;i++) y[i]=sorted.vecs[i][col];
      const v=solveUpper(U, y);
      const nv=norm(v);
      for(let i=0;i<n;i++) V[i][col]= (nv>0)? v[i]/nv : v[i];
    }
    return {lambda: sorted.vals, vecs: V};
  }

  // ═══════════════════ Birim dönüşümleri (UI katmanı için) ═══════════════════

  function mmToM(xmm){ return xmm/1000.0; }
  function nPerMmToNPerM(k){ return k*1000.0; }

  // ═══════════════════ Model kurulumu (SPEC Bölüm 4) ═══════════════════

  // skew(d): δ = u + θ×d ifadesindeki çapraz çarpım matrisi (skew(d)·θ = d×θ).
  const skew = d => [[0,-d[2],d[1]],[d[2],0,-d[0]],[-d[1],d[0],0]];

  // A = [E3 | −skew(d)] — takoz kinematik matrisi: δ = A·q,  d = r_mount − c_G.
  //
  // STANDART rijit gövde kinematiği: δ_i = u + θ×d_i (birinci-prensip).
  // Kaldıraç kolunun düşey bileşeni dz, dönme→düzlem-içi çökme kuplajına DOĞRUDAN
  // girer; hiçbir işaret çevirmesi YOK. Fiziksel akıl-sağlığı testi (regresyon):
  // frende (öne atalet, CG takozların ÜSTÜNDE) güç grubu BURUN AŞAĞI döner →
  // ön takozlar arka takozlardan daha çok basılı olmalı (K[x,θy] = k_x·Σdz < 0,
  // takozlar CG altında olduğundan). Bu, önceki "z-ekseni konvansiyonu" (F1)
  // düzeltmesinin GERİ ALINMASIDIR: v2 bağımsız türevi, F1'in Adams'ın sistematik
  // kuplaj-işareti hatasını kopyaladığını gösterdi (bkz. tests T2/T3, selfTest).
  const makeA = d => {
    const S=skew(d);
    return [[1,0,0,-S[0][0],-S[0][1],-S[0][2]],
            [0,1,0,-S[1][0],-S[1][1],-S[1][2]],
            [0,0,1,-S[2][0],-S[2][1],-S[2][2]]];
  };

  // Paralel eksen teoremi: mj·((d·d)·E3 − d·dᵀ)
  function inertiaParallelAxis(mass, d){
    const dx=d[0], dy=d[1], dz=d[2];
    const dd = dx*dx + dy*dy + dz*dz;
    return [[mass*(dd - dx*dx), mass*(-dx*dy),     mass*(-dx*dz)],
            [mass*(-dy*dx),     mass*(dd - dy*dy), mass*(-dy*dz)],
            [mass*(-dz*dx),     mass*(-dz*dy),     mass*(dd - dz*dz)]];
  }

  // Kütle birleştirme (SPEC 4.1): m, birleşik CG, birleşik atalet tensörü.
  // Atalet 3.5 konvansiyonu: çarpım terimleri tensör bileşeni (CATIA).
  // pointMass=true → Ij = 0 (şaft payı / braketler).
  // Toplam kütle ≤ 0 → null.
  function combineMassProps(components){
    let m=0; const s=[0,0,0];
    for(const c of components){
      m += c.mass;
      for(let i=0;i<3;i++) s[i] += c.mass*c.cg[i];
    }
    if(m<=0) return null;
    const cg=s.map(v=>v/m);
    const I_G=[[0,0,0],[0,0,0],[0,0,0]];
    for(const c of components){
      const d=[c.cg[0]-cg[0], c.cg[1]-cg[1], c.cg[2]-cg[2]];
      const Ic = c.pointMass ? [[0,0,0],[0,0,0],[0,0,0]] : c.I;
      const Ipar = inertiaParallelAxis(c.mass, d);
      for(let i=0;i<3;i++) for(let j=0;j<3;j++)
        I_G[i][j] += Ic[i][j] + Ipar[i][j];
    }
    return {m, cg, I_G};
  }

  // Rijitlik matrisi (SPEC 4.2): K = Σ Aᵢᵀ·kᵢ·Aᵢ (6×6, simetrik, poz. tanımlı).
  // useDynamic=false → K_stat (statik çözümler), true → K_dyn (yalnız modal).
  function buildK(mounts, cg, useDynamic){
    const K=zeros(6,6);
    for(const mnt of mounts){
      const d=[mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]];
      const A=makeA(d);
      const k = useDynamic ? mnt.kdyn : mnt.kstat;
      const Ki=[[k[0],0,0],[0,k[1],0],[0,0,k[2]]];
      const AtKiAi=matMul(matMul(matT(A),Ki),A);
      addInPlace(K, AtKiAi);
    }
    return K;
  }

  // Kütle matrisi (SPEC 4.1): M6 = blockdiag(m·E3, I_G).
  // Atalet tensörü HAM CATIA çerçevesinde girer (hiçbir işaret çevirmesi YOK);
  // standart makeA ile tutarlı → modal frekanslar 5.039…21.239 Hz (Adams T6).
  function buildM6(m, I_G){
    const M=zeros(6,6);
    M[0][0]=M[1][1]=M[2][2]=m;
    for(let i=0;i<3;i++) for(let j=0;j<3;j++) M[3+i][3+j]=I_G[i][j];
    return M;
  }

  // ═══════════════════ Constitutive — takoz kuvvet yasası (Newton için) ═══════════════════
  //
  // Her takoz ekseni bir kuvvet-sehim yasası φ(δ) taşır: δ (m) → f (N) ve tanjant
  // rijitlik k_t = dφ/dδ (N/m). İki biçim:
  //   • LİNEER (varsayılan): φ = k·δ  (k = kstat[eksen]) — klasik elastik takoz.
  //   • EĞRİ   (opsiyonel):  ölçülmüş [[δ,f],…] noktaları → monoton kübik interpolant.
  // Karma sistem desteklenir: bazı takozlar lineer, bazıları eğrili olabilir; çözücü
  // hepsini TEK Newton döngüsünde birlikte çözer (bkz. solveCaseNL). Sistem tümüyle
  // lineerse Newton ilk adımda tam lineer çözüme iner → mevcut solveCase sonuçları
  // (ve selfTest T1–T8) BİREBİR korunur.

  // Monoton kübik Hermite (Fritsch–Carlson). numerics.js veBuildPchipSpline ile AYNI
  // çekirdek yöntem; TEK farkı: tablo DIŞINDA düz değil DOĞRUSAL ekstrapolasyon (uç
  // tanjantıyla). Kuvvet-sehim için ZORUNLU — aksi halde eğri aralığının dışına taşan
  // bir takozun tanjantı 0 olur, K_T tekilleşir ve Newton çöker. Ayrıca çekirdek
  // saf/kendine-yeterli kalsın diye numerics.js'e bağımlılık YOK (testte tek başına
  // require edilir). xs artan sıralı, n≥2. Dönüş: { eval(x)→y, slope(x)→dy/dx }.
  function buildMonotoneCubic(xs, ys){
    const n=xs.length;
    const h=new Array(n-1), del=new Array(n-1);
    for(let i=0;i<n-1;i++){ h[i]=xs[i+1]-xs[i]; del[i]=(h[i]>1e-15)?(ys[i+1]-ys[i])/h[i]:0; }
    const m=new Array(n).fill(0);
    for(let i=1;i<n-1;i++){
      if(del[i-1]*del[i]<=0){ m[i]=0; }                         // yerel ekstremum → tanjant 0 (monotonluk)
      else { const w1=2*h[i]+h[i-1], w2=h[i]+2*h[i-1]; m[i]=(w1+w2)/(w1/del[i-1]+w2/del[i]); }
    }
    if(n===2){ m[0]=del[0]; m[1]=del[0]; }                       // iki nokta → düz doğru
    else {
      m[0]=((2*h[0]+h[1])*del[0]-h[0]*del[1])/(h[0]+h[1]);
      if(m[0]*del[0]<=0) m[0]=0; else if(Math.abs(m[0])>3*Math.abs(del[0])) m[0]=3*del[0];
      m[n-1]=((2*h[n-2]+h[n-3])*del[n-2]-h[n-2]*del[n-3])/(h[n-2]+h[n-3]);
      if(m[n-1]*del[n-2]<=0) m[n-1]=0; else if(Math.abs(m[n-1])>3*Math.abs(del[n-2])) m[n-1]=3*del[n-2];
    }
    function seg(x){ let lo=0,hi=n-2; while(lo<hi){ const mid=(lo+hi)>>1; if(x>xs[mid+1]) lo=mid+1; else hi=mid; } return lo; }
    function coef(i){ const hi=h[i]; return [ (3*del[i]-2*m[i]-m[i+1])/hi, (m[i]+m[i+1]-2*del[i])/(hi*hi) ]; }
    return {
      eval:function(x){
        if(x<=xs[0])   return ys[0]   + m[0]  *(x-xs[0]);        // doğrusal ekstrapolasyon (alt)
        if(x>=xs[n-1]) return ys[n-1] + m[n-1]*(x-xs[n-1]);      // doğrusal ekstrapolasyon (üst)
        const i=seg(x), t=x-xs[i], c=coef(i);
        return ys[i] + m[i]*t + c[0]*t*t + c[1]*t*t*t;
      },
      slope:function(x){
        if(x<=xs[0])   return m[0];
        if(x>=xs[n-1]) return m[n-1];
        const i=seg(x), t=x-xs[i], c=coef(i);
        return m[i] + 2*c[0]*t + 3*c[1]*t*t;
      }
    };
  }

  // Tek eksen kuvvet yasası. spec:
  //   { type:'linear', k }                 → φ=k·δ (k sabit)
  //   { type:'curve', points:[[δ,f],…] }   → monoton kübik (δ SI m, f SI N; sıralanır)
  // Dönüş: { force(δ)→N, tangent(δ)→N/m, k0, curve:bool }.
  //   k0 = δ=0 civarı referans (küçük-sehim) rijitliği — doğrulama/ölçek kontrolü için.
  function makeAxisLaw(spec){
    // ANALİTİK FİT (kapalı-form): parametreler mm/N; law δ'yı (m) mm'ye çevirip
    // değerlendirir, tanjantı N/m'ye ölçekler (dF/dδ_m = dF/dx·1000). İki biçim:
    //   'poly' (radyal): F = k0·x + c3·x³ + c5·x⁵                     (tek/simetrik)
    //   'asym' (eksenel): MODEL konvansiyonu δ<0 = BASMA (compression).
    //     δ<0 (basma) → comp.k0·δ/(1+δ/comp.xmax)   — rasyonel, asimptot δ=−xmax (bump-stop)
    //     δ≥0 (geri-gelme) → ext.k0·δ + ext.c3·δ³   — kübik (daha yumuşak)
    //     Payda EPS'te kırpılır → asimptot ötesi SONLU ama çok sert (Newton'da tekillik yok).
    if(spec && (spec.form==='poly' || spec.form==='asym')){
      const MM=1000;                        // δ(m) → x(mm)
      let fx, dfx;                          // x(mm)→F(N),  x(mm)→dF/dx(N/mm)
      if(spec.form==='asym'){
        const cp=spec.comp||{}, ex=spec.ext||{}, xmax=(Number.isFinite(cp.xmax)&&cp.xmax>0)?cp.xmax:1, EPS=0.02;
        fx =function(x){ if(x>=0) return (ex.k0||0)*x+(ex.c3||0)*x*x*x; let u=1+x/xmax; if(u<EPS)u=EPS; return (cp.k0||0)*x/u; };
        dfx=function(x){ if(x>=0) return (ex.k0||0)+3*(ex.c3||0)*x*x;   let u=1+x/xmax; if(u<EPS)u=EPS; return (cp.k0||0)/(u*u); };
      } else {
        const k0=spec.k0||0, c3=spec.c3||0, c5=spec.c5||0;
        fx =function(x){ return k0*x + c3*x*x*x + c5*x*x*x*x*x; };
        dfx=function(x){ return k0 + 3*c3*x*x + 5*c5*x*x*x*x; };
      }
      return { force:function(d){ return fx(d*MM); },
               tangent:function(d){ return dfx(d*MM)*MM; },
               k0:dfx(0)*MM, curve:true };
    }
    if(spec && spec.type==='curve' && spec.points && spec.points.length>=2){
      const pts=spec.points.slice().sort(function(a,b){ return a[0]-b[0]; });
      const xs=pts.map(function(p){ return p[0]; });
      const ys=pts.map(function(p){ return p[1]; });
      const sp=buildMonotoneCubic(xs, ys);
      return { force:function(d){ return sp.eval(d); },
               tangent:function(d){ return sp.slope(d); },
               k0:sp.slope(0), curve:true };
    }
    const k=(spec && Number.isFinite(spec.k)) ? spec.k : 0;
    return { force:function(d){ return k*d; }, tangent:function(){ return k; }, k0:k, curve:false };
  }

  // Takozun 3 STATİK eksen yasası [x,y,z]. mount.curves[axis] (SI [[δ_m,f_N],…])
  // verilmişse o eksen nonlineer; yoksa lineer kstat[axis]. axis anahtarı 'x'/'y'/'z'.
  function mountStaticLaws(mount){
    const cur=mount.curves||{}, fit=mount.fits||{}, key=['x','y','z'];
    return [0,1,2].map(function(ax){
      const k=key[ax], fp=fit[k];
      if(fp && (fp.form==='poly'||fp.form==='asym')) return makeAxisLaw(fp);   // analitik fit önce
      const pts=cur[k];
      if(pts && pts.length>=2) return makeAxisLaw({type:'curve', points:pts}); // sonra nokta tablosu
      return makeAxisLaw({type:'linear', k:(mount.kstat?mount.kstat[ax]:0)});  // yoksa lineer
    });
  }

  // ═══════════════════ Statik çözüm (SPEC 4.3-4.4) ═══════════════════

  // Çekme (lift-off) eşiği: δz > +0.01 mm (SPEC 3.4 — A26'daki ters
  // F[2]<0 sayacı DÜZELTİLDİ: çekmede olan takozları sayar).
  const TENSION_EPS_M = 1e-5;      // +0.01 mm
  const LINEAR_LIMIT_M = 0.010;    // |δ| > 10 mm → lineer bölge dışı uyarısı

  // Tek yük durumu çözümü.
  // Yük vektörü: F = [m·g·nx, m·g·ny, m·g·nz, Tx, Ty, Tz]
  // (nz TOPLAM düşey ivme katsayısıdır, yerçekimi DAHİL; Statik=(0,0,−1)).
  // Dönüş: { q, F, perMount, sumF, checks } | null (K singular).
  function solveCase(Kstat, mounts, cg, m, g, lc){
    const F=[m*g*lc.n[0], m*g*lc.n[1], m*g*lc.n[2], lc.T[0], lc.T[1], lc.T[2]];
    const q=solveLinear(Kstat, F);
    if(!q) return null;
    // Çözüm kalitesi kapısı (T8b): rank-eksik/kötü koşullu K'da Gauss'un
    // 1e-18 mutlak pivot eşiği yuvarlama artıklarını pivot sanıp SAHTE çözüm
    // üretebilir (örn. tek takoz → rank 3). Artık ‖K·q−F‖ büyükse singular
    // kabul et — A26 numeriği değişmeden davranış SPEC T8b'ye uyar.
    const resid = matVec(Kstat, q).map((v,i)=>v-F[i]);
    if(norm(resid) > 1e-6 * (norm(F) + 1)) return null;
    const perMount=[]; const sumF=[0,0,0]; let tensionCount=0; let overLinearCount=0;
    for(const mnt of mounts){
      const d=[mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]];
      const A=makeA(d);
      const delta=[0,1,2].map(i=>A[i].reduce((s,a,j)=>s+a*q[j],0));
      const f=[mnt.kstat[0]*delta[0], mnt.kstat[1]*delta[1], mnt.kstat[2]*delta[2]];
      for(let i=0;i<3;i++) sumF[i]+=f[i];
      const tension = delta[2] > TENSION_EPS_M;                  // ÇEKME (lift-off)
      if(tension) tensionCount++;
      const overLinear = delta.some(dv => Math.abs(dv) > LINEAR_LIMIT_M);
      if(overLinear) overLinearCount++;
      perMount.push({name:mnt.name, delta, f, tension, overLinear});
    }
    // ΣFz kontrolü: iletilen düşey kuvvetler dış yükü dengeler
    // (yerçekimi durumunda Σfz = −m·g). |Σfz − Fz,dış| bazlı kontrol —
    // A26'daki "rozet Mg gösteriyor" işaret karışıklığı DÜZELTİLDİ.
    const checks={
      sumFzOk: Math.abs(sumF[2]-F[2]) < 1e-3*Math.max(1,Math.abs(F[2])),
      sumFzResidual: sumF[2]-F[2],
      tensionCount,
      overLinearCount
    };
    return {q, F, perMount, sumF, checks};
  }

  // ═══════════════════ Metal-metal durdurucu — ±15 mm (SPEC 9.1 / F4) ═══════════════════
  //
  // Takozun DÜŞEY (z) hareketi ±STOP_GAP_M'de metal-metal temasa oturur; ötesinde
  // ek rijitlik k_stop = STOP_STIFF_RATIO·kz devreye girer → sistem PARÇALI-LİNEER.
  //
  // NEDEN SONLU RİJİTLİK (rijit kelepçe DEĞİL): rijit gövdenin yalnız 3 düşey
  // serbestlik derecesi (bounce, roll, pitch) vardır. 3'ten çok takozu aynı anda
  // TAM ±15'e RİJİT sabitlemek kinematik olarak aşırı-kısıttır (KKT singular olur).
  // Adams referansı da klipsli takozları tam ±15'te değil (−14.9/−15.0) gösterir —
  // yani hafif eğimli, sonlu-rijitlikli temas. Bu yüzden gap elemanı + yüksek
  // (varsayılan 100·kz) teğet rijitlik kullanılır; penetrasyon ~0.1 mm kalır.
  //
  // Çözüm: aktif-küme iterasyonu. Penetrasyondaki (|δz|>gap) takozlar kümesi
  // kararlı olana dek K_eff = Kstat + Σ_aktif k_stop·(aᵤᵤ⊗aᵤᵤ) sistemi yeniden
  // çözülür (aᵤᵤ = takozun A matrisinin z-satırı). Yük OTOMATİK yeniden dağılır:
  // dibe oturan takoz temas kuvvetiyle (k·δ değil) çalışır, fazla yük komşulara.
  const STOP_GAP_M = 0.015;          // ±15 mm metal-metal boşluğu (SPEC 9.1)
  const STOP_STIFF_RATIO = 100;      // k_stop / kz (Adams BMC_TTAR_2031 kalibrasyonu)
  const STOP_MAXITER = 50;           // aktif-küme üst sınırı (tipik 1-3 iterasyon)

  // Durduruculu tek yük durumu çözümü. Küçük sehimde solveCase ile AYNI sonucu
  // verir (hiçbir takoz gap'i aşmaz → aktif küme boş → saf lineer). Dönüş
  // solveCase ile aynı biçim + perMount[i].clamped, checks.clampCount, stopConverged.
  function solveCaseStop(Kstat, mounts, cg, m, g, lc, opts){
    opts = opts || {};
    const gap   = (opts.gap != null)        ? opts.gap        : STOP_GAP_M;
    const ratio = (opts.stiffRatio != null) ? opts.stiffRatio : STOP_STIFF_RATIO;
    const F=[m*g*lc.n[0], m*g*lc.n[1], m*g*lc.n[2], lc.T[0], lc.T[1], lc.T[2]];
    // Takoz kinematik matrisleri + düşey (z) satırları (bir kez hesapla).
    const A=[], az=[];
    for(const mnt of mounts){
      const d=[mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]];
      const Ai=makeA(d); A.push(Ai); az.push(Ai[2]);
    }
    const active = new Array(mounts.length).fill(0);   // 0 / −1 (alt) / +1 (üst)
    let q=null, converged=false;
    for(let iter=0; iter<STOP_MAXITER; iter++){
      // K_eff = Kstat + Σ_aktif k_stop·(az⊗az) ; rhs = F + Σ k_stop·(sgn·gap)·az
      const K = matCopy(Kstat);
      const rhs = F.slice();
      for(let i=0;i<mounts.length;i++){
        if(!active[i]) continue;
        const kS = mounts[i].kstat[2]*ratio, r=az[i], dg=active[i]*gap;
        for(let a=0;a<6;a++){ for(let b=0;b<6;b++) K[a][b]+=kS*r[a]*r[b]; rhs[a]+=kS*dg*r[a]; }
      }
      q = solveLinear(K, rhs);
      if(!q) return null;
      // Aktif küme güncelle: gap'i aşan → temas; içine dönen → serbest.
      let changed=false;
      for(let i=0;i<mounts.length;i++){
        const dz = az[i].reduce((s,a,j)=>s+a*q[j],0);
        const want = (dz < -gap) ? -1 : (dz > gap) ? +1 : 0;
        if(want !== active[i]){ active[i]=want; changed=true; }
      }
      if(!changed){ converged=true; break; }
    }
    // Sonuç kur — dibe oturan takozda fz = kz·δz + k_stop·(δz∓gap) (temas dahil).
    const perMount=[]; const sumF=[0,0,0];
    let tensionCount=0, overLinearCount=0, clampCount=0;
    for(let i=0;i<mounts.length;i++){
      const mnt=mounts[i];
      const delta=[0,1,2].map(k=>A[i][k].reduce((s,a,j)=>s+a*q[j],0));
      let fz = mnt.kstat[2]*delta[2];
      if(active[i]) fz += mnt.kstat[2]*ratio*(delta[2]-active[i]*gap);
      const f=[mnt.kstat[0]*delta[0], mnt.kstat[1]*delta[1], fz];
      for(let k=0;k<3;k++) sumF[k]+=f[k];
      const tension = delta[2] > TENSION_EPS_M;
      if(tension) tensionCount++;
      const overLinear = delta.some(dv => Math.abs(dv) > LINEAR_LIMIT_M);
      if(overLinear) overLinearCount++;
      const clamped = active[i] !== 0;
      if(clamped) clampCount++;
      perMount.push({name:mnt.name, delta, f, tension, overLinear, clamped});
    }
    const checks={
      sumFzOk: Math.abs(sumF[2]-F[2]) < 1e-3*Math.max(1,Math.abs(F[2])),
      sumFzResidual: sumF[2]-F[2],
      tensionCount, overLinearCount, clampCount, stopConverged: converged
    };
    return {q, F, perMount, sumF, checks};
  }

  // ═══════════════════ Nonlineer statik çözüm — Newton-Raphson (eğri takoz) ═══════════════════
  //
  // Takozların bir kısmı NONLİNEER kuvvet-sehim yasası (curves) taşıyorsa sistem
  // artık lineer değildir; denge Newton-Raphson ile çözülür (SPEC ek — Faz 2):
  //   r(q)   = Σ Aᵢᵀ·fᵢ(δᵢ) − F_dış        (artık; δᵢ = Aᵢ·q)
  //   K_T(q) = Σ Aᵢᵀ·diag(φ'ᵢ(δᵢ))·Aᵢ       (tanjant rijitlik)
  //   K_T·Δq = −r ,  q ← q + λ·Δq           (λ: geri-izlemeli sönüm)
  // Metal-metal durdurucu (±15 mm) yine AKTİF-KÜME ile (dış döngü); her aktif-küme
  // adımında Newton iç döngüsü sabit kümede dengeyi çözer. KARMA sistem: bazı takoz
  // lineer, bazısı eğrili olabilir — hepsi TEK sistemde birlikte çözülür.
  //
  // GERİYE UYUM (kanıt): tümüyle lineer takozda φ'=k sabittir, r q'da doğrusaldır →
  // Newton İLK adımda K_eff·q=rhs'yi tam çözer; aktif-küme mantığı solveCaseStop ile
  // birebir aynıdır → sonuç solveCaseStop ile eşleşir (Faz 2 karşılaştırma testi).
  // Bu yüzden solveAllCases yalnız eğri VARSA bu yola girer; hepsi-lineerde dokunulmaz.
  // Dönüş biçimi solveCaseStop ile AYNI + checks.converged (Newton) & checks.newtonIters.
  const NL_NEWTON_MAXITER = 60;
  const NL_RTOL = 1e-9;
  function solveCaseNL(mounts, cg, m, g, lc, opts){
    opts = opts || {};
    const gap   = (opts.gap != null)        ? opts.gap        : STOP_GAP_M;
    const ratio = (opts.stiffRatio != null) ? opts.stiffRatio : STOP_STIFF_RATIO;
    const useStop = (opts.useStop !== false);        // varsayılan: durdurucu açık
    const onIter = (typeof opts.onIter === 'function') ? opts.onIter : null;  // (iter, ‖r‖) — ilerleme/yakınsama izi
    const F=[m*g*lc.n[0], m*g*lc.n[1], m*g*lc.n[2], lc.T[0], lc.T[1], lc.T[2]];
    const N=mounts.length;
    const A=[], az=[], laws=[];
    for(const mnt of mounts){
      const d=[mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]];
      const Ai=makeA(d); A.push(Ai); az.push(Ai[2]); laws.push(mountStaticLaws(mnt));
    }
    const active = new Array(N).fill(0);             // 0 / −1 (alt) / +1 (üst) durdurucu
    const Fscale = norm(F) + m*g + 1;
    const tol = NL_RTOL * Fscale;

    // (q, aktif küme) → { g6: iç genelleştirilmiş kuvvet Σ Aᵀf, KT: tanjant (wantK) }.
    function assemble(q, wantK){
      const g6=[0,0,0,0,0,0];
      const KT=wantK?zeros(6,6):null;
      for(let i=0;i<N;i++){
        const Ai=A[i], law=laws[i];
        const d0=Ai[0].reduce((s,a,j)=>s+a*q[j],0);
        const d1=Ai[1].reduce((s,a,j)=>s+a*q[j],0);
        const d2=Ai[2].reduce((s,a,j)=>s+a*q[j],0);
        let fx=law[0].force(d0), fy=law[1].force(d1), fz=law[2].force(d2);
        let kx=0,ky=0,kz=0;
        if(wantK){ kx=law[0].tangent(d0); ky=law[1].tangent(d1); kz=law[2].tangent(d2); }
        if(useStop && active[i]){                    // metal-metal temas (z ekseni)
          const kS=mounts[i].kstat[2]*ratio;
          fz += kS*(d2-active[i]*gap);
          if(wantK) kz += kS;
        }
        for(let a=0;a<6;a++) g6[a]+=Ai[0][a]*fx+Ai[1][a]*fy+Ai[2][a]*fz;
        if(wantK){
          const kv=[kx,ky,kz];
          for(let ax=0;ax<3;ax++){ const kk=kv[ax], row=Ai[ax];
            for(let a=0;a<6;a++){ const t=kk*row[a]; for(let b=0;b<6;b++) KT[a][b]+=t*row[b]; } }
        }
      }
      return {g6, KT};
    }
    function residNorm(q){
      const g6=assemble(q,false).g6;
      let s=0; for(let a=0;a<6;a++){ const r=g6[a]-F[a]; s+=r*r; } return Math.sqrt(s);
    }

    let q=new Array(6).fill(0);
    let converged=true, newtonIters=0, stopConverged=false;
    const OUTER = useStop ? STOP_MAXITER : 1;
    for(let outer=0; outer<OUTER; outer++){
      // ── Newton iç döngü (aktif küme sabit) ──
      let nconv=false;
      for(let nit=0; nit<NL_NEWTON_MAXITER; nit++){
        newtonIters++;
        const asm=assemble(q,true);
        const r=[0,0,0,0,0,0]; let rn2=0;
        for(let a=0;a<6;a++){ r[a]=asm.g6[a]-F[a]; rn2+=r[a]*r[a]; }
        const rn=Math.sqrt(rn2);
        if(onIter) onIter(newtonIters, rn);           // yakınsama izi (residual normu)
        if(rn<=tol){ nconv=true; break; }
        const neg=r.map(function(v){return -v;});
        const dq=solveLinear(asm.KT, neg);
        if(!dq) return null;                          // K_T tekil → çözülemez
        // Geri-izlemeli sönüm: adım artığı büyütürse yarıla (nonlineer kararlılık).
        let lam=1, qn=q.map((v,i)=>v+dq[i]), rnn=residNorm(qn), bt=0;
        while(rnn>rn && bt<12){ lam*=0.5; qn=q.map((v,i)=>v+lam*dq[i]); rnn=residNorm(qn); bt++; }
        q=qn;
        if(rnn<=tol){ nconv=true; break; }
      }
      converged = converged && nconv;
      if(!useStop){ stopConverged=true; break; }
      // ── aktif küme güncelle (gap'i aşan → temas; içine dönen → serbest) ──
      let changed=false;
      for(let i=0;i<N;i++){
        const dz=az[i].reduce((s,a,j)=>s+a*q[j],0);
        const want=(dz<-gap)?-1:(dz>gap)?+1:0;
        if(want!==active[i]){ active[i]=want; changed=true; }
      }
      if(!changed){ stopConverged=true; break; }
    }
    // ── Sonuç kur (solveCaseStop ile AYNI biçim; kuvvet yasadan, durdurucu dahil) ──
    const perMount=[]; const sumF=[0,0,0];
    let tensionCount=0, overLinearCount=0, clampCount=0;
    for(let i=0;i<N;i++){
      const mnt=mounts[i], law=laws[i];
      const delta=[0,1,2].map(k=>A[i][k].reduce((s,a,j)=>s+a*q[j],0));
      let fz=law[2].force(delta[2]);
      if(useStop && active[i]) fz += mnt.kstat[2]*ratio*(delta[2]-active[i]*gap);
      const f=[law[0].force(delta[0]), law[1].force(delta[1]), fz];
      for(let k=0;k<3;k++) sumF[k]+=f[k];
      const tension = delta[2] > TENSION_EPS_M;      if(tension) tensionCount++;
      const overLinear = delta.some(dv => Math.abs(dv) > LINEAR_LIMIT_M); if(overLinear) overLinearCount++;
      const clamped = active[i] !== 0;               if(clamped) clampCount++;
      perMount.push({name:mnt.name, delta, f, tension, overLinear, clamped});
    }
    const checks={
      sumFzOk: Math.abs(sumF[2]-F[2]) < 1e-3*Math.max(1,Math.abs(F[2])),
      sumFzResidual: sumF[2]-F[2],
      tensionCount, overLinearCount, clampCount,
      stopConverged, converged, newtonIters
    };
    return {q, F, perMount, sumF, checks};
  }

  // Takozda en az bir eksende nonlineer eğri (≥2 nokta) tanımlı mı?
  function mountHasCurve(mnt){
    if(!mnt) return false;
    const f=mnt.fits; if(f && (f.x||f.y||f.z)) return true;       // analitik fit de nonlineer
    const c=mnt.curves; if(!c) return false;
    return (c.x&&c.x.length>=2)||(c.y&&c.y.length>=2)||(c.z&&c.z.length>=2);
  }
  function anyCurve(mounts){ return (mounts||[]).some(mountHasCurve); }

  // Çoklu yük durumu: sistem lineer → durumlar bağımsız çözülür.
  // model = { m, cg, Kstat, mounts, g }. Dönüş satırları Adams çıktı düzeni
  // (satır = yük durumu, sütun = takoz × {δx,δy,δz}).
  // opts.useStop=true → ±15 mm metal-metal durdurucu (solveCaseStop, F4);
  //   büyük sehimli senaryolarda (Tümsek/Pothole/Kerb/Reverse) klips + yeniden
  //   dağıtım. Küçük sehimde iki yol da AYNI (lineer) sonucu verir.
  function solveAllCases(model, cases, opts){
    opts = opts || {};
    // Eğri (nonlineer) takoz VARSA → Newton (solveCaseNL); YOKSA mevcut lineer yol
    // (solveCaseStop / solveCase) birebir korunur. Karar model.mounts'a bakar.
    // useStop iki yolda AYNI biçimde yorumlanır: yalnız opts.useStop truthy ise
    // metal-metal durdurucu devrededir (nonlineer yolda da aynı kapı → tutarlı).
    const nonlinear = anyCurve(model.mounts);
    const useStop = !!opts.useStop;
    const solve = nonlinear
      ? (lc => solveCaseNL(model.mounts, model.cg, model.m, model.g, lc,
                           Object.assign({}, opts, {useStop: useStop})))
      : useStop
        ? (lc => solveCaseStop(model.Kstat, model.mounts, model.cg, model.m, model.g, lc, opts))
        : (lc => solveCase(model.Kstat, model.mounts, model.cg, model.m, model.g, lc));
    return cases.map(lc => {
      const res = solve(lc);
      return res ? {name: lc.name, loadCase: lc, res}
                 : {name: lc.name, loadCase: lc, res: null,
                    error: 'K matrisi singular/çözülemedi (montaj kinematik olarak serbest olabilir).'};
    });
  }

  // Bileşen+takoz listesinden çözüme hazır model kur (kolaylık sarmalayıcısı).
  function buildModel(components, mounts, g){
    const mp = combineMassProps(components);
    if(!mp) return null;
    return {
      m: mp.m, cg: mp.cg, I_G: mp.I_G, mounts, g: (g || 9.81),
      Kstat: buildK(mounts, mp.cg, false),
      Kdyn:  buildK(mounts, mp.cg, true)
    };
  }

  // ═══════════════════ Modal analiz (SPEC 4.6) ═══════════════════

  // Mod etiketleme — GEOMETRİ DUYARLI (A26 classifyMode'un düzeltilmiş
  // kullanımı: relMounts ZORUNLU parametredir; A26'da computeModal bunu
  // geçirmiyordu → kol uzunluğu 1 m varsayılıyordu).
  // relMounts = her takoz için pos − cg (m).
  function classifyMode(q, relMounts){
    if(!Array.isArray(q) || q.length<6) return '—';
    if(!Array.isArray(relMounts) || !relMounts.length){
      // SPEC gereği geometrisiz etiket üretme — çağıran hata yapıyor demektir.
      return '—';
    }
    const Tx = q[0], Ty = q[1], Tz = q[2];
    const Rx = q[3], Ry = q[4], Rz = q[5];

    // 1) Öteleme: baskın eksen → fore-aft / lateral / bounce
    const tAbs = [Math.abs(Tx), Math.abs(Ty), Math.abs(Tz)];
    const tIdx = tAbs.indexOf(Math.max(...tAbs));
    const tName = (tIdx===0) ? 'fore-aft' : (tIdx===1) ? 'lateral' : 'bounce';

    // 2) Dönme eşdeğer yer değiştirme: a_axis = RMS(|e_axis × d_i|)
    const n = relMounts.length;
    let sRx=0, sRy=0, sRz=0;
    for(const r of relMounts){
      const x=r[0]||0, y=r[1]||0, z=r[2]||0;
      sRx += (z*z + y*y);   // |e_x × r|² = y²+z²
      sRy += (z*z + x*x);   // |e_y × r|² = x²+z²
      sRz += (y*y + x*x);   // |e_z × r|² = x²+y²
    }
    const aRx=Math.sqrt(sRx/n), aRy=Math.sqrt(sRy/n), aRz=Math.sqrt(sRz/n);

    const rEff = [Math.abs(Rx)*aRx, Math.abs(Ry)*aRy, Math.abs(Rz)*aRz];
    const rIdx = rEff.indexOf(Math.max(...rEff));
    const rName = (rIdx===0) ? 'roll' : (rIdx===1) ? 'pitch' : 'yaw';

    // 3) Baskınlık karşılaştırması (eşik 2.2)
    const transEff = Math.sqrt(Tx*Tx + Ty*Ty + Tz*Tz);
    const rotEff = Math.sqrt(rEff[0]*rEff[0] + rEff[1]*rEff[1] + rEff[2]*rEff[2]);
    const eps = 1e-12, DOM = 2.2;
    if(rotEff > DOM*(transEff + eps)) return rName;
    if(transEff > DOM*(rotEff + eps)) return tName;
    // Bileşik mod: baskın + ikincil
    if(transEff >= rotEff) return tName + '+' + rName;
    return rName + '+' + tName;
  }

  // 6 rijit gövde modu: doğal frekans + normalize mod şekli + etiket.
  // K_dyn ile çağrılır (SPEC 4.2). f≈0 modlar SESSİZCE ELENMEZ (A26
  // düzeltmesi): warning bayrağıyla döner — UI kullanıcıyı uyarır.
  // Dönüş: [{ f_Hz, phi:[6] (max bileşene normalize), label, warning? }] | null.
  function solveModal(K_dyn, M6, mounts, cg){
    const eig = generalizedEigenSym(K_dyn, M6);
    if(!eig) return null;
    const relMounts = mounts.map(mnt =>
      [mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]]);
    const modes=[];
    for(let i=0;i<eig.lambda.length;i++){
      const lam = eig.lambda[i];
      const w = Math.sqrt(Math.max(lam,0));
      const f = w/(2*Math.PI);
      let phi=[eig.vecs[0][i],eig.vecs[1][i],eig.vecs[2][i],
               eig.vecs[3][i],eig.vecs[4][i],eig.vecs[5][i]];
      // Max mutlak bileşene göre normalize (SPEC 4.6 adım 4)
      const maxAbs = Math.max(...phi.map(Math.abs));
      if(maxAbs > 0) phi = phi.map(v=>v/maxAbs);
      const nearZero = !(Number.isFinite(f)) || f < 1e-6;
      modes.push({
        f_Hz: f,
        phi,
        label: nearZero ? 'serbest mod (f≈0) ⚠' : classifyMode(phi, relMounts),
        warning: nearZero
          ? 'Sıfıra yakın frekans: yapılandırma kinematik olarak serbest olabilir.'
          : undefined
      });
    }
    return modes; // sortEigen zaten artan sırada — 6 mod
  }

  // Dinamik TANJANT rijitliği — modal analiz için (Faz 3). Her takoz ekseninin
  // STATİK dengede (qStatic) tanjant rijitliği φ'(δ) × dinamik/statik oran
  // (kdyn/kstat). LİNEER eksende φ'=kstat sabittir → kstat·(kdyn/kstat)=kdyn →
  // buildK(dynamic) ile aynı K → mevcut modal sonuç (T6/T7) korunur. EĞRİ eksende
  // φ'(δ_static)·oran → önyüklü çalışma noktasına duyarlı frekanslar (fiziksel
  // olarak doğru: nonlineer takozun frekansı çalışma noktasına bağlıdır).
  // qStatic yoksa (null) → δ=0 tanjantı (küçük-sehim) kullanılır.
  // Takoz BAŞINA dinamik tanjant rijitlik [kx,ky,kz] (statik dengede). Hem
  // buildKtangentDyn hem sönüm katsayıları AYNI kaynaktan beslensin diye ayrı
  // fonksiyon: c = 2ζ√(k·m) bağıntısındaki k, modal frekansı üreten k ile aynı
  // olmalıdır; yoksa ζ_mod tutarsız bir tabana oturur (nonlineer takozlarda
  // nominal k_dyn ile tanjant arasında kat farkı olabilir).
  function mountTangentKdyn(mounts, cg, qStatic){
    return (mounts||[]).map(function(mnt){
      const d=[mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]];
      const A=makeA(d);
      const laws=mountStaticLaws(mnt);
      return [0,1,2].map(function(ax){
        const dax = qStatic ? A[ax].reduce((s,a,j)=>s+a*qStatic[j],0) : 0;
        const kStat = laws[ax].tangent(dax);                           // statik tanjant @ δ
        const ratio = (mnt.kstat && mnt.kstat[ax]>0) ? (mnt.kdyn[ax]/mnt.kstat[ax]) : 1;
        return kStat * ratio;                                          // dinamik tanjant
      });
    });
  }
  function buildKtangentDyn(mounts, cg, qStatic){
    const K=zeros(6,6);
    const kts=mountTangentKdyn(mounts, cg, qStatic);
    mounts.forEach(function(mnt, i){
      const d=[mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]];
      const A=makeA(d);
      const kt=kts[i];
      const Ki=[[kt[0],0,0],[0,kt[1],0],[0,0,kt[2]]];
      addInPlace(K, matMul(matMul(matT(A),Ki),A));
    });
    return K;
  }

  // Statik denge (qStatic) çevresinde dinamik tanjant rijitlikle modal analiz.
  // Lineer takozda solveModal(buildK(dynamic)) ile aynı sonuç. NOT: tanjant, takozun
  // elastik/eğri rijitliğidir; ±15 mm metal-metal durdurucunun 100·kz teğet katkısı
  // DAHİL DEĞİLDİR. Üretimde modal, Static (1g) çalışma noktasında çözülür — orada
  // hiçbir takoz klipslenmez → dışlanan terim zaten sıfırdır (bkz. cp-mount.js).
  function solveModalAtState(mounts, cg, M6, qStatic){
    return solveModal(buildKtangentDyn(mounts, cg, qStatic), M6, mounts, cg);
  }

  // ═══════════════════ İletilebilirlik / transmissibility (izolasyon) ═══════════════════
  //
  // Tek serbestlik dereceli kuvvet iletilebilirliği (harmonik tahrik): tahrik
  // frekansı f_exc (ör. rölanti ateşleme f_ateş), doğal frekans f_nat, sönüm
  // oranı ζ. Frekans oranı r = f_exc / f_nat.
  //
  //   T(r) = √[ (1 + (2ζr)²) / ((1 − r²)² + (2ζr)²) ]
  //
  // İzolasyon (T<1) ancak r>√2'de başlar; T<0.5 (%50 kriteri) için düşük
  // sönümde r>√3≈1.73 gerekir. ζ→0'da T→1/|1−r²| (sönümsüz limit) — bu yüzden
  // çok küçük ζ (ör. 0.001) sonucu neredeyse tümüyle frekans oranı belirler.
  // f_nat ≤ 0 → NaN. r=1 (rezonans) ve ζ=0 → sonsuz.
  function transmissibility(fExc, fNat, zeta){
    if(!(fNat > 0)) return NaN;
    const z = (zeta > 0) ? zeta : 0;
    const r = fExc / fNat;
    const a = 2*z*r;
    const den = (1 - r*r)*(1 - r*r) + a*a;
    if(den <= 0) return Infinity;                 // sönümsüz rezonans
    return Math.sqrt((1 + a*a) / den);
  }

  // ── İzolasyon değerlendirmesinin TABANI: düşey (bounce) doğal frekansı ──
  //
  // transmissibility() TEK serbestlik dereceli bir bağıntıdır: f_nat'ın, tahrik
  // yönündeki kütle-yay sisteminin doğal frekansı olması gerekir. Motor takozu
  // izolasyonunda tahrik DÜŞEYDİR (ateşleme kuvveti), dolayısıyla doğru taban
  // güç grubunun DÜŞEY (bounce) frekansıdır:
  //
  //   f_bounce = (1/2π)·√( Σk_z,dyn / m_toplam )
  //
  // NEDEN MODAL FREKANS DEĞİL: rijit gövde modlarından biri (ör. roll) SDOF
  // bağıntısına konursa, o modun frekansı sanki TÜM kütleyi taşıyan bir düşey
  // yayın frekansıymış gibi işlenir — fiziksel karşılığı yoktur ve izolasyonu
  // ciddi biçimde olduğundan kötü/iyi gösterebilir.
  //
  // GEÇERLİLİK: bounce modu simetrik yerleşimde tam ayrışır (ω²=Σk_z/m); asimetrik
  // yerleşimde pitch ile kuplajlanıp iki moda bölünür ve bu değer aralarına düşer
  // (ASFAT 8x8 Obüs: modlar 11,33 ve 13,27 Hz, f_bounce 12,69 Hz — tam ortasında).
  // Doğrulama: ASR-SR-116 s.12 el hesabı bu tabanla %21,9 / %21,8 (sönümlü/sönümsüz)
  // veriyor ve ADAMS'ın tam frekans yanıtıyla (%21,9 / %21,8) örtüşüyor.
  //
  // NOT: bu SDOF kestirimidir. Tam çok-serbestlikli frekans yanıtı (Şekil 9
  // eğrisi) ayrı bir adımdır; sönüm matrisi C = ΣAᵀcA ile kurulur.
  function bounceFrequency(mounts, mTotal){
    if(!(mTotal > 0)) return NaN;
    let kz = 0;
    for(const mnt of (mounts || [])){
      const k = (mnt.kdyn && mnt.kdyn[2] > 0) ? mnt.kdyn[2] : 0;
      kz += k;
    }
    if(!(kz > 0)) return NaN;
    return Math.sqrt(kz / mTotal) / (2 * Math.PI);
  }

  // ═══════ Asal atalet — Adams "aggregate mass" çıktısının karşılığı ═══════
  //
  // Birleşik atalet tensörünün ÖZDEĞERLERİ (asal atalet momentleri) ve
  // ÖZVEKTÖRLERİ (asal eksenler). Köşegen dışı terimler sıfır değilse global
  // eksende okunan I_xx/I_yy/I_zz, gövdenin "gerçek" atalet mertebelerini
  // vermez — Adams'ın aggregate mass komutu da bu yüzden bir Orientation
  // (yönelim) satırı basar. Referans dokümanla (ASR-SR-116 Şekil 5) sayıları
  // karşılaştırmak için bu ayrıştırma gerekir: oradaki 44,6 / 97,8 / 94,6
  // değerleri döndürülmüş eksende verilmiştir, global eksende değil.
  //
  // Jacobi döndürme yöntemi — 3×3 simetrik matris için kesin ve kararlı.
  // Dönüş: { values:[I1,I2,I3] (artan), axes:[[e1],[e2],[e3]] (satır = eksen) }
  function principalInertia(I){
    if(!I) return null;
    let a = [[I[0][0],I[0][1],I[0][2]],[I[1][0],I[1][1],I[1][2]],[I[2][0],I[2][1],I[2][2]]];
    let V = [[1,0,0],[0,1,0],[0,0,1]];
    for(let sweep=0; sweep<100; sweep++){
      let p=0, q=1, mx=0;
      for(let i=0;i<3;i++) for(let j=i+1;j<3;j++){
        if(Math.abs(a[i][j])>mx){ mx=Math.abs(a[i][j]); p=i; q=j; }
      }
      if(mx < 1e-14) break;
      const th = 0.5*Math.atan2(2*a[p][q], a[p][p]-a[q][q]);
      const c = Math.cos(th), s = Math.sin(th);
      const rot = [[1,0,0],[0,1,0],[0,0,1]];
      rot[p][p]=c; rot[q][q]=c; rot[p][q]=s; rot[q][p]=-s;
      // a ← Rᵀ a R   ve   V ← V R
      const RtA = matMul(matT(rot), a);
      a = matMul(RtA, rot);
      V = matMul(V, rot);
    }
    const idx = [0,1,2].sort((i,j)=>a[i][i]-a[j][j]);
    return {
      values: idx.map(i=>a[i][i]),
      axes:   idx.map(i=>[V[0][i], V[1][i], V[2][i]])   // sütun i = i'nci özvektör
    };
  }

  // ═══════ Eşdeğer atalet kutusu — gövdeye görsel gövde vermek için ═══════
  //
  // Model bir bileşeni yalnız kütle + atalet + ağırlık merkezi olarak tanır;
  // geometri (şekil) taşımaz. Ama düzgün yoğunluklu katı bir dikdörtgen prizma
  // için atalet kapalı formdadır:
  //     I_xx = m(b²+c²)/12 ,  I_yy = m(a²+c²)/12 ,  I_zz = m(a²+b²)/12
  // Bu üç denklem a, b, c için TEK ÇÖZÜMLÜDÜR:
  //     a² = 6(I_yy+I_zz−I_xx)/m , b² = 6(I_xx+I_zz−I_yy)/m , c² = 6(I_xx+I_yy−I_zz)/m
  //
  // Yani "temsili kutu" uydurma bir ikon DEĞİL: kullanıcının girdiği kütle ve
  // ataleti birebir veren tek prizmadır. ASFAT motoru için 1154×460×787 mm
  // çıkar — sıra-6 dizelin gerçek mertebesi.
  //
  // NE ZAMAN null DÖNER: (a) nokta kütle (atalet sıfır → boyut tanımsız),
  // (b) atalet üçgen eşitsizliğini sağlamıyorsa (I_xx+I_yy ≥ I_zz vb.) — böyle
  // bir tensör hiçbir katı cisme ait olamaz; uydurma kutu çizmektense çizmemek
  // doğrudur. Çağıran taraf o durumda nokta işareti kullanır.
  // Dönüş: [a,b,c] (x,y,z boyunca tam kenar uzunlukları, girdiyle aynı birimde)
  function equivalentBox(mass, I, pointMass){
    if(!(mass > 0) || pointMass || !I) return null;
    const Ix=I[0][0], Iy=I[1][1], Iz=I[2][2];
    if(!(Ix > 0) || !(Iy > 0) || !(Iz > 0)) return null;
    const a2 = 6*(Iy + Iz - Ix)/mass;
    const b2 = 6*(Ix + Iz - Iy)/mass;
    const c2 = 6*(Ix + Iy - Iz)/mass;
    if(!(a2 > 0) || !(b2 > 0) || !(c2 > 0)) return null;
    return [Math.sqrt(a2), Math.sqrt(b2), Math.sqrt(c2)];
  }

  // ═══════ Mod yerleşimi kriterleri (ASR-SR-116 s.10 listesi) ═══════
  //
  // Kaynak dokümanın dört isterinden ÜÇÜ doğrudan mod listesinden okunur:
  //   (a) hiçbir mod ½·f_ateş sınırını aşmamalı  — TÜM modlar, yalnız en yüksek değil
  //   (b) komşu modlar arası fark > gapMin (varsayılan 0,5 Hz)
  //   (c) hiçbir mod yaylandırılmamış kütle bandında (varsayılan 8–10 Hz) olmamalı
  // Saf veri fonksiyonu — hüküm vermez, ölçümü döndürür; eşik/yorum rapor katmanında.
  // opts: { fLimit, gapMin, bandLo, bandHi }
  function modePlacement(modes, opts){
    const o = opts || {};
    const gapMin = (o.gapMin > 0) ? o.gapMin : 0.5;
    const bandLo = (o.bandLo > 0) ? o.bandLo : 8;
    const bandHi = (o.bandHi > 0) ? o.bandHi : 10;
    const f = (modes || []).map(m => m.f_Hz).filter(v => Number.isFinite(v));
    if(!f.length) return null;
    const fLimit = (o.fLimit > 0) ? o.fLimit : NaN;
    const gaps = [];
    for(let i=1;i<f.length;i++) gaps.push({ i:i, gap: f[i]-f[i-1] });
    let minGap = null;
    gaps.forEach(g => { if(!minGap || g.gap < minGap.gap) minGap = g; });
    return {
      fMax: Math.max.apply(null, f),
      fLimit: fLimit,
      exceed: Number.isFinite(fLimit)
        ? modes.map((m,i)=>({no:i+1, f:m.f_Hz, label:m.label}))
               .filter(m => m.f > fLimit) : [],
      gaps: gaps,
      gapMin: gapMin,
      minGap: minGap ? minGap.gap : NaN,
      minGapPair: minGap ? [minGap.i, minGap.i+1] : null,     // 1 tabanlı mod numaraları
      bandLo: bandLo, bandHi: bandHi,
      inBand: modes.map((m,i)=>({no:i+1, f:m.f_Hz, label:m.label}))
                   .filter(m => m.f >= bandLo && m.f <= bandHi)
    };
  }

  // ═══════ Rijitlik yumuşatma taraması (ASR-SR-116 §5 / Tablo 19 karşılığı) ═══════
  //
  // Mevcut takozlar kriterleri sağlamıyorsa sorulacak soru "ne kadar yumuşatmalı?"
  // olur. Her ölçek katsayısı için takoz rijitlikleri (statik ve dinamik birlikte)
  // ölçeklenip modal çözüm ve düşey iletilebilirlik yeniden hesaplanır.
  //
  // NOT — frekanslar TÜM takozlar aynı katsayıyla ölçeklendiğinde tam olarak
  // √katsayı ile gider: αKφ = ω²Mφ ⇒ ω² ∝ α, kuplaj olsun olmasın. Yani modal
  // kısım kapalı formda da bulunabilirdi. Tarama yine de çözer, çünkü:
  //   · İLETİLEBİLİRLİK katsayıyla basit ölçeklenmez — T(r) rasyoneldir, r=f/f_b
  //     değiştikçe T bambaşka bir eğri üzerinde gezer (bu tablonun asıl değeri).
  //   · Katsayı takoz başına farklılaştırılırsa (yalnız arka dörtlüyü yumuşatmak
  //     gibi) √α kuralı DÜŞER; aynı fonksiyon o durumu da doğru çözer.
  //   · Kriter değerlendirmesi (mod ayrıklığı, 8–10 Hz bandı) gerçek frekans
  //     listesini ister; ölçekten çıkarım yapmak hataya açıktır.
  // Dönüş: [{ factor, modes:[{f_Hz,label}], fBounce, T, T0 }]
  function softeningScan(mounts, cg, M6, mTotal, factors, fExc, zeta){
    if(!mounts || !mounts.length || !M6) return null;
    const z = (zeta >= 0 && zeta < 1) ? zeta : 0;
    return (factors || [1]).map(function(fac){
      const scaled = mounts.map(function(m){
        const c = {};
        Object.keys(m).forEach(function(k){ c[k] = m[k]; });
        c.kstat = (m.kstat||[0,0,0]).map(function(v){ return v*fac; });
        c.kdyn  = (m.kdyn ||[0,0,0]).map(function(v){ return v*fac; });
        return c;
      });
      const md = solveModal(buildK(scaled, cg, true), M6, scaled, cg);
      const fB = bounceFrequency(scaled, mTotal);
      return {
        factor: fac,
        modes: (md||[]).map(function(m){ return { f_Hz:m.f_Hz, label:m.label }; }),
        fBounce: fB,
        T:  Number.isFinite(fExc) ? transmissibility(fExc, fB, z) : NaN,
        T0: Number.isFinite(fExc) ? transmissibility(fExc, fB, 0) : NaN
      };
    });
  }

  // ═══════════════════ Viskoz sönüm (SPEC ek — Faz 4) ═══════════════════
  //
  // Sönüm oranı ζ bir ŞİRKET KABULÜDÜR: takoz başına ölçülmez, tüm montaj için
  // TEK değer girilir (UI: Çözücü paneli). Takozun eksen başına viskoz sönüm
  // katsayısı bu tek orandan TÜRETİLİR — kritik sönümün ζ katı:
  //
  //   c_eksen = 2·ζ·√( k_dyn,eksen · m_pay )        [N·s/m]
  //
  // m_pay = o takoza düşen STATİK düşey yük payı (kg). Yani hem daha sert hem
  // daha çok yük taşıyan takoz daha çok söner — fiziksel beklenti budur.
  //
  // DOĞRULAMA: BMC ASR-SR-116 (ASFAT 8x8 Obüs) Tablo 11, ζ=0,02 ile bu
  // bağıntıdan 12/12 değerde ±0,005 N·s/mm içinde yeniden üretilir.
  // NOT: burada üretilen c'ler henüz MODAL çözüme girmez (sönümsüz özdeğer
  // problemi korunur); rapor tablosu ve iletilebilirlik için kullanılır.
  const DEFAULT_ZETA = 0.02;

  // Statik çözümden takoz başına düşey yük payı (kg). res = solveCase* dönüşü.
  // g yoksa 9.81. Çözüm yoksa null.
  function mountLoadShares(res, g){
    if(!res || !res.perMount) return null;
    const gg = (g > 0) ? g : 9.81;
    return res.perMount.map(pm => Math.abs(pm.f[2]) / gg);
  }

  // Takoz başına viskoz sönüm katsayıları. shares (kg) mountLoadShares'ten;
  // verilmezse/0 ise o takozun c'si 0 çıkar (yük payı bilinmeden sönüm türetilemez).
  // Dönüş: [{ name, mShare (kg), zeta, c:[cx,cy,cz] (N·s/m) }]
  // kBasis (ops.): takoz başına [kx,ky,kz] — verilirse mnt.kdyn yerine BU kullanılır.
  // Nonlineer takozlarda modal frekansı üreten rijitlik, nominal k_dyn değil statik
  // dengedeki dinamik TANJANT'tır (mountTangentKdyn); c aynı tabandan türemezse
  // ζ_mod = φᵀCφ/(2ωφᵀMφ) tutarsız bir orana oturur.
  function mountDamping(mounts, shares, zeta, kBasis){
    const z = (zeta > 0) ? zeta : 0;
    return (mounts || []).map(function(mnt, i){
      const m = (shares && shares[i] > 0) ? shares[i] : 0;
      const kd = (kBasis && kBasis[i]) ? kBasis[i] : (mnt.kdyn || [0,0,0]);
      const c = [0,1,2].map(function(ax){
        const k = kd[ax] > 0 ? kd[ax] : 0;
        return 2 * z * Math.sqrt(k * m);
      });
      return { name: mnt.name, mShare: m, zeta: z, c: c, kBasis: kd };
    });
  }

  // ═══════════════ Frekans yanıtı — çok serbestlikli (SPEC ek — Faz 5) ═══════════════
  //
  // bounceFrequency + transmissibility bir SDOF KESTİRİMİDİR. Burası gerçeğidir:
  // 6 SD sönümlü sistemin harmonik kuvvet iletilebilirliği.
  //
  //   [K − ω²M + iωC]·Q = F₀            (harmonik tahrik, F = F₀e^{iωt})
  //   δᵢ = Aᵢ·Q ,  fᵢ = (kᵢ + iω cᵢ)·δᵢ  (takozun şasiye ilettiği kuvvet)
  //   T(f) = |Σ fᵢ,eksen| / |F₀,eksen|
  //
  // Karmaşık 6×6 sistem, 12×12 GERÇEL sisteme açılarak çözülür (çekirdekte
  // karmaşık aritmetik yok):
  //   [ A  −B ][Q_R]   [F_R]
  //   [ B   A ][Q_I] = [F_I] ,   A = K − ω²M ,  B = ωC
  // Doğrulama: (A+iB)(Q_R+iQ_I) = (A·Q_R − B·Q_I) + i(B·Q_R + A·Q_I).
  //
  // Referans: ASR-SR-116 Şekil 9 (ADAMS VibrationAnalysis, 0,1–100 Hz, sönümlü
  // ve sönümsüz iki eğri). ζ=0 ile rezonanslarda tepe sonsuza gider — logaritmik
  // ızgara tam rezonansa oturmadığından sonlu ama çok büyük değerler çıkar.

  // Sönüm matrisi — rijitlikle AYNI kinematikten: C = Σ Aᵢᵀ·diag(cᵢ)·Aᵢ.
  // damping = mountDamping(...) çıktısı (c: N·s/m). Eksik girdi → o takoz sönümsüz.
  function buildCdamp(mounts, cg, damping){
    const C6 = zeros(6,6);
    (mounts || []).forEach(function(mnt, i){
      const c = (damping && damping[i] && damping[i].c) ? damping[i].c : [0,0,0];
      const d = [mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]];
      const A = makeA(d);
      const Ci = [[c[0],0,0],[0,c[1],0],[0,0,c[2]]];
      addInPlace(C6, matMul(matMul(matT(A),Ci),A));
    });
    return C6;
  }

  // Tek frekansta iletilebilirlik. w = 2πf [rad/s], dir = tahrik/çıktı ekseni
  // (0=x, 1=y, 2=z). cList = takoz başına [cx,cy,cz] (N·s/m) — sönümsüz için 0.
  // Birim tahrik kuvveti uygulanır → dönüş doğrudan T'dir. Tekil sistem → NaN.
  // Tek frekansta iletilen kuvvet — TOPLAM ve TAKOZ BAŞINA.
  //
  // DİKKAT — |Σ Fᵢ| ≠ Σ |Fᵢ|. Takoz kuvvetleri KARMAŞIK sayılardır (genlik +
  // faz); toplam vektörel alınır. Modun şekline göre iki takoz zıt fazda
  // çalışabilir ve birbirini götürebilir: o zaman tek tek genlikler büyük,
  // sistem toplamı küçüktür. Bu bir tutarsızlık değil, fiziğin kendisidir —
  // ama sayıları yan yana gören kullanıcıya SÖYLENMESİ gerekir (yorum katmanı
  // js/mount-brief.js bunu yazar).
  //
  // Takoz başına değer aynı çözüm vektöründen çıkar: ek denklem çözülmez,
  // maliyeti sıfırdır. Ayrı bir yol yazılsaydı toplam ile parçalar sessizce
  // ayrışabilirdi.
  function frfForces(mounts, cg, M6, K6, C6, cList, w, dir){
    const n = 6, N = 12;
    const S = zeros(N,N), rhs = Array(N).fill(0);
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      const a = K6[i][j] - w*w*M6[i][j];
      const b = w*C6[i][j];
      S[i][j]     = a;   S[i][j+n]   = -b;
      S[i+n][j]   = b;   S[i+n][j+n] = a;
    }
    rhs[dir] = 1;                                  // birim gerçel tahrik
    const x = solveLinear(S, rhs);
    if(!x) return null;
    const QR = x.slice(0,6), QI = x.slice(6,12);
    let trR = 0, trI = 0;
    const per = [];
    for(let i=0;i<mounts.length;i++){
      const mnt = mounts[i];
      const d = [mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]];
      const A = makeA(d);
      const k = (mnt.kdyn && mnt.kdyn[dir] > 0) ? mnt.kdyn[dir] : 0;
      const c = (cList && cList[i] && cList[i][dir] > 0) ? cList[i][dir] : 0;
      let dR = 0, dI = 0;
      for(let j=0;j<6;j++){ dR += A[dir][j]*QR[j]; dI += A[dir][j]*QI[j]; }
      const fR = k*dR - w*c*dI;                    // (k + iωc)(δ_R + iδ_I)
      const fI = k*dI + w*c*dR;
      per.push(Math.sqrt(fR*fR + fI*fI));
      trR += fR; trI += fI;
    }
    return { total: Math.sqrt(trR*trR + trI*trI), per: per };   // |F₀| = 1
  }

  function frfPoint(mounts, cg, M6, K6, C6, cList, w, dir){
    const r = frfForces(mounts, cg, M6, K6, C6, cList, w, dir);
    return r ? r.total : NaN;
  }

  // Frekans taraması. opts: { fMin=0.1, fMax=100, nPts=240, dir=2 (düşey),
  //                           perMount=false }.
  // Dönüş: { f:[Hz], T:[sönümlü], T0:[sönümsüz] } — logaritmik eşit aralıklı.
  // perMount istenirse Tm:[[takoz başına |Fᵢ|]] de döner (takoz sırasıyla).
  function frequencyResponse(mounts, cg, M6, damping, opts){
    opts = opts || {};
    const fMin = (opts.fMin > 0) ? opts.fMin : 0.1;
    const fMax = (opts.fMax > fMin) ? opts.fMax : 100;
    const nPts = (opts.nPts > 1) ? Math.floor(opts.nPts) : 240;
    const dir  = (opts.dir === 0 || opts.dir === 1) ? opts.dir : 2;
    if(!mounts || !mounts.length || !M6) return null;
    const K6 = buildK(mounts, cg, true);                       // dinamik rijitlik
    const C6 = buildCdamp(mounts, cg, damping);
    const Z6 = zeros(6,6);                                     // sönümsüz karşılaştırma
    const cList = (mounts).map(function(_, i){
      return (damping && damping[i] && damping[i].c) ? damping[i].c : [0,0,0]; });
    const zeroC = mounts.map(function(){ return [0,0,0]; });
    const f = [], T = [], T0 = [];
    const Tm = opts.perMount ? mounts.map(function(){ return []; }) : null;
    const lo = Math.log10(fMin), hi = Math.log10(fMax);
    for(let i=0;i<nPts;i++){
      const ff = Math.pow(10, lo + (hi-lo)*i/(nPts-1));
      const w = 2*Math.PI*ff;
      f.push(ff);
      const r = frfForces(mounts, cg, M6, K6, C6, cList, w, dir);
      T.push(r ? r.total : NaN);
      if(Tm) mounts.forEach(function(_, k){ Tm[k].push(r ? r.per[k] : NaN); });
      T0.push(frfPoint(mounts, cg, M6, K6, Z6, zeroC, w, dir));
    }
    const out = { f:f, T:T, T0:T0, dir:dir };
    if(Tm) out.Tm = Tm;
    return out;
  }

  // Taramadan tek frekansta değer (ör. f_ateş) — logaritmik ara değerleme.
  // Izgara dışında uçtaki değere kırpılır.
  function frfAt(mounts, cg, M6, damping, fHz, dir){
    if(!(fHz > 0)) return NaN;
    const K6 = buildK(mounts, cg, true);
    const C6 = buildCdamp(mounts, cg, damping);
    const cList = (mounts || []).map(function(_, i){
      return (damping && damping[i] && damping[i].c) ? damping[i].c : [0,0,0]; });
    return frfPoint(mounts, cg, M6, K6, C6, cList, 2*Math.PI*fHz,
                    (dir === 0 || dir === 1) ? dir : 2);
  }

  // ═══════════ Şok / geçici rejim yanıtı ═══════════
  //
  // Frekans yanıtı SÜREKLİ rejimi anlatır: sonsuza kadar süren bir titreşimde
  // kararlı hâl. Ama takozun ömrünü belirleyen olay çoğu zaman TEK BİR DARBEDİR
  // — bordür, çukur, fren, mayın etkisi. O darbede takoz ne kadar eziliyor,
  // şasiye ne kadar kuvvet geçiyor, salınım ne kadar sürüyor? Frekans yanıtı bu
  // soruların hiçbirini cevaplamaz; tedarikçi raporları (AMC) ayrı bir "Shock
  // response" bölümü açar.
  //
  // MODEL: taban (şasi) ivme darbesi görüyor, güç grubu takozlar üzerinde
  // BAĞIL hareket ediyor. Ağırlık merkezi eksenli koordinatlarda:
  //
  //     M q̈ + C q̇ + K q = −M ι a(t)
  //
  // ι = tahrik yönündeki birim vektör (yalnız öteleme; taban dönmüyor). Sağ
  // taraf statik çözücünün F = m·g·n vektörünün zaman bağlı hâlidir — aynı
  // fizik, aynı işaret sözleşmesi. UZUN darbe limitinde çözüm statik duruma
  // yakınsar; bu bir tutarlılık kilididir (tests/unit/mount-shock.test.js).
  //
  // DARBE BİÇİMİ yarım sinüs: a(t) = A·sin(πt/τ), 0 ≤ t ≤ τ. Şok deneylerinin
  // standart darbesi budur (MIL-STD-810, ISO 8568). Dikdörtgen darbe fiziksel
  // olarak üretilemez (sonsuz jerk) ve yapay yüksek frekans içeriği katar.
  //
  // İNTEGRASYON: Newmark-β, ortalama ivme (γ=1/2, β=1/4). Seçim gerekçesi:
  //   • KOŞULSUZ KARARLI — adım boyu doğrulukla sınırlıdır, kararlılıkla değil.
  //     Açık bir yöntem (RK4) 20 Hz'lik modda dt < ~1/(π·f) şartına takılır ve
  //     sessizce patlar.
  //   • Enerji korumalı (γ=1/2): yapay sönüm EKLEMEZ. Kullanıcının girdiği ζ
  //     dışında bir sönüm görünmesi, salınımın ne kadar sürdüğü sorusunun
  //     cevabını bozardı.
  //   • M, C, K sabit → etkin matris BİR KEZ kurulur, her adımda yalnız 6×6
  //     çözüm yapılır.
  //
  // LİNEER ÇÖZÜM: dinamik rijitlik (kdyn) kullanılır, nonlineer eğri ve
  // metal-metal durdurucu DEVREDE DEĞİLDİR — frekans yanıtıyla aynı varsayım.
  // Genlik durdurucu boşluğunu aşarsa çözüm oradan sonra geçersizdir ve yorum
  // katmanı bunu SÖYLER (uydurma bir sınır uygulamak yerine).
  //
  // Dönüş: { t:[s], a:[g], q:[[6]], qd:[[6]], per:[{f:[N], fz:[N], d:[mm]}],
  //          dMax:[mm], dir, aPeak, dur }
  function shockResponse(mounts, cg, M6, damping, opts){
    opts = opts || {};
    if(!mounts || !mounts.length || !M6) return null;
    const dir = (opts.dir === 0 || opts.dir === 1) ? opts.dir : 2;
    const g   = (opts.g > 0) ? opts.g : 9.81;
    const A   = (opts.aG > 0) ? opts.aG : 3;          // darbe tepe ivmesi [g]
    const tau = (opts.dur > 0) ? opts.dur : 0.020;    // darbe süresi [s]
    const K6 = buildK(mounts, cg, true);              // dinamik rijitlik
    const C6 = buildCdamp(mounts, cg, damping);

    // Kayıt süresi: darbe + en yavaş modun birkaç çevrimi. Sabit bir süre
    // (ör. 1 s) yumuşak montajda salınımın başını, sert montajda saatlerce
    // düz çizgi gösterirdi.
    let fLo = 0, fHi = 0;
    const md = solveModal(K6, M6, mounts, cg);
    (md || []).forEach(function(m){
      if(!(m.f_Hz > 1e-6)) return;
      if(!fLo || m.f_Hz < fLo) fLo = m.f_Hz;
      if(m.f_Hz > fHi) fHi = m.f_Hz;
    });
    if(!(fLo > 0)) return null;
    const tEnd = Math.min(tau + 8 / fLo, 3);

    // Adım boyu: en hızlı modun periyodunun 1/40'ı VE darbenin 1/40'ı.
    // Newmark kararlı olsa da doğruluk adım boyuna bağlıdır; darbeyi kaba
    // örneklemek tepeyi düşürür.
    let dt = Math.min(tau / 40, 1 / (40 * (fHi > 0 ? fHi : fLo)));
    let nStep = Math.ceil(tEnd / dt);
    if(nStep > 40000) { nStep = 40000; dt = tEnd / nStep; }

    // Çıktı seyreltme: integrasyon ince, kayıt kaba. 40 000 noktalı bir kanal
    // panoya da yorum katmanına da yük, bilgi katkısı yok.
    const OUT_MAX = 1500;
    const every = Math.max(1, Math.ceil(nStep / OUT_MAX));

    const beta = 0.25, gamma = 0.5;
    const a0 = 1/(beta*dt*dt), a1 = gamma/(beta*dt), a2 = 1/(beta*dt);
    const a3 = 1/(2*beta) - 1, a4 = gamma/beta - 1, a5 = dt*(gamma/(2*beta) - 1);

    const Keff = zeros(6,6);
    for(let i=0;i<6;i++) for(let j=0;j<6;j++) Keff[i][j] = K6[i][j] + a0*M6[i][j] + a1*C6[i][j];

    // Takoz geometrisi bir kez
    const AA = mounts.map(function(mnt){
      return makeA([mnt.pos[0]-cg[0], mnt.pos[1]-cg[1], mnt.pos[2]-cg[2]]);
    });
    const cList = mounts.map(function(_, i){
      return (damping && damping[i] && damping[i].c) ? damping[i].c : [0,0,0]; });

    // a(t): yarım sinüs [m/s²]
    const aOf = function(t){
      return (t >= 0 && t <= tau) ? A*g*Math.sin(Math.PI*t/tau) : 0;
    };
    // F(t) = −M ι a(t) — yalnız öteleme serbestliği uyarılır
    const Fof = function(t){
      const av = aOf(t), F = [0,0,0,0,0,0];
      for(let i=0;i<6;i++) F[i] = -M6[i][dir]*av;
      return F;
    };

    let q = [0,0,0,0,0,0], qd = [0,0,0,0,0,0];
    // q̈₀ = M⁻¹(F₀ − C q̇₀ − K q₀); yarım sinüste F(0)=0 → sıfır, yine de genel
    // kalsın diye çözülür (başka darbe biçimi eklenirse doğru başlar).
    let qdd = solveLinear(M6, Fof(0)) || [0,0,0,0,0,0];

    const out = { t: [], a: [], q: [], qd: [], dMax: [],
                  per: mounts.map(function(){ return { f: [], fz: [], d: [] }; }),
                  dir: dir, aPeak: A, dur: tau, dt: dt, tEnd: tEnd };

    const record = function(t, q_, qd_){
      out.t.push(t);
      out.a.push(aOf(t)/g);                       // kayıtta [g]
      out.q.push(q_.slice());
      out.qd.push(qd_.slice());
      let worst = 0;
      for(let i=0;i<mounts.length;i++){
        const Ai = AA[i];
        let dR=[0,0,0], vR=[0,0,0];
        for(let r=0;r<3;r++){
          let s=0, sv=0;
          for(let c=0;c<6;c++){ s += Ai[r][c]*q_[c]; sv += Ai[r][c]*qd_[c]; }
          dR[r]=s; vR[r]=sv;
        }
        const k = mounts[i].kdyn || [0,0,0], cc = cList[i];
        const fv = [k[0]*dR[0] + cc[0]*vR[0],
                    k[1]*dR[1] + cc[1]*vR[1],
                    k[2]*dR[2] + cc[2]*vR[2]];
        out.per[i].f.push(Math.sqrt(fv[0]*fv[0]+fv[1]*fv[1]+fv[2]*fv[2]));
        out.per[i].fz.push(fv[2]);
        const dm = Math.sqrt(dR[0]*dR[0]+dR[1]*dR[1]+dR[2]*dR[2])*1000;
        out.per[i].d.push(dm);
        if(dm > worst) worst = dm;
      }
      out.dMax.push(worst);
    };

    record(0, q, qd);
    for(let n=1;n<=nStep;n++){
      const t = n*dt;
      const F = Fof(t);
      const rhs = [0,0,0,0,0,0];
      for(let i=0;i<6;i++){
        let mTerm=0, cTerm=0;
        for(let j=0;j<6;j++){
          mTerm += M6[i][j]*(a0*q[j] + a2*qd[j] + a3*qdd[j]);
          cTerm += C6[i][j]*(a1*q[j] + a4*qd[j] + a5*qdd[j]);
        }
        rhs[i] = F[i] + mTerm + cTerm;
      }
      const qn = solveLinear(Keff, rhs);
      if(!qn) return null;
      const qddN = [], qdN = [];
      for(let i=0;i<6;i++){
        qddN.push(a0*(qn[i]-q[i]) - a2*qd[i] - a3*qdd[i]);
        qdN.push(qd[i] + dt*((1-gamma)*qdd[i] + gamma*qddN[i]));
      }
      q = qn; qd = qdN; qdd = qddN;
      if(n % every === 0 || n === nStep) record(t, q, qd);
    }
    return out;
  }

  // ═══════════ Modal sönüm ve modal enerji (SPEC ek — Faz 6) ═══════════

  // ── Mod başına sönüm oranı ──
  // Sönümsüz mod şekli φ_r üzerine sönüm matrisini izdüşürerek:
  //
  //   ζ_r = (φ_rᵀ C φ_r) / (2 ω_r φ_rᵀ M φ_r)
  //
  // NEDEN YAKLAŞIM: kesin değer kuadratik özdeğer probleminden (λ²M+λC+K)φ=0
  // gelir; bu, modlar arası sönüm kuplajını da hesaba katar. Hafif sönümde
  // (ζ ≲ 0,1 — elastomer takozun tipik bandı) kuplaj ihmal edilebilir ve bu
  // izdüşüm standart mühendislik pratiğidir. GEÇERLİLİK ÖLÇÜLEBİLİR: frekans
  // yanıtı eğrisinden yarı-güç genişliğiyle çıkarılan ζ ile karşılaştırılır
  // (bkz. tests/unit/mount-modal-energy.test.js).
  //
  // NİYE DEĞERLİ: girilen TEK ζ montaja uygulanır ama modların gördüğü sönüm
  // AYNI DEĞİLDİR — c = 2ζ√(k·m) bağıntısı √k ile ölçeklendiğinden C, K ile
  // orantılı çıkmaz. Hangi modun az söndüğü tasarım bilgisidir.
  //
  // Normalizasyondan bağımsızdır (pay ve payda φ'de ikinci derecedendir).
  //
  // AŞIRI SÖNÜM: ζ_r ≥ 1 fiziksel olarak mümkündür — kullanıcı ζ girişi 0..1
  // arasında olsa bile mod başına oran girilenin katı çıkabilir (ASFAT modelinde
  // roll modu 1,78×; ζ_giriş > 0,562 → roll kritik sönümü aşar). Bu durum SESSİZCE
  // YUTULMAZ: ζ_r gerçek değeriyle döner, over=true işaretlenir ve f_d = NaN olur
  // (aşırı sönümlü modda salınım yoktur, "sönümlü doğal frekans" tanımsızdır).
  // Dönüş: [{ zeta, f_d, over }] — f_d = f_n·√(1−ζ²) (yalnız ζ<1 için).
  function quadForm(A, v){
    let s = 0;
    for(let i=0;i<6;i++){ let r=0; for(let j=0;j<6;j++) r += A[i][j]*v[j]; s += v[i]*r; }
    return s;
  }
  function modalDampingRatios(modes, M6, C6){
    if(!modes || !M6 || !C6) return null;
    return modes.map(function(md){
      const phi = md.phi;
      const w = 2*Math.PI*md.f_Hz;
      if(!phi || !(w > 0)) return { zeta: NaN, f_d: NaN, over: false };
      const mG = quadForm(M6, phi);
      if(!(mG > 0)) return { zeta: NaN, f_d: NaN, over: false };
      const z = quadForm(C6, phi) / (2*w*mG);
      if(!(z >= 0)) return { zeta: NaN, f_d: NaN, over: false };
      return { zeta: z, over: (z >= 1),
               f_d: (z < 1) ? md.f_Hz*Math.sqrt(1-z*z) : NaN };
    });
  }

  // ── Modal enerji: genelleştirilmiş büyüklükler + gövde bazında dağılım ──
  //
  //   m_gen = φᵀMφ ,  k_gen = φᵀKφ ,  KE = ½ω²·m_gen
  //
  // m_gen/k_gen φ'nin ÖLÇEĞİNE bağlıdır (burada φ en büyük bileşene normalize);
  // ORAN k_gen/m_gen = ω² ise normalizasyondan bağımsızdır — tutarlılık kapısı.
  //
  // GÖVDE BAZINDA KİNETİK ENERJİ: güç grubu tek rijit gövde olarak hareket eder,
  // ama her alt gövde farklı hızdadır (v_j = u + θ×d_j). Payı:
  //
  //   KE_j = ½ω²·[ m_j|v_j|² + θᵀ I_j θ ]        (I_j gövdenin KENDİ CG'sinde)
  //
  // ve bileşenlerine ayrılır: X/Y/Z (öteleme), RXX/RYY/RZZ (dönme köşegen),
  // RXY/RXZ/RYZ (dönme çarpım — tensör konvansiyonu, ½·2 = 1 katsayılı).
  //
  // ÖZDEŞLİK (test kilidi): Σ_j KE_j = ½ω²·φᵀM6φ. Kanıt: Σm_j d_j = 0 olduğundan
  // çapraz terim düşer, paralel-eksen toplamı I_G'yi verir. Bu, dağılımın
  // uydurma değil türetilmiş olduğunun güvencesidir.
  //
  // components: SI ({mass, cg[3], I:3x3, pointMass}), cg: birleşik ağırlık merkezi.
  // Dönüş: [{ mGen, kGen, ke, bodies:[{name, ke, pct, X,Y,Z,RXX,RYY,RZZ,RXY,RXZ,RYZ}] }]
  function modalEnergy(modes, M6, K6, components, cg){
    if(!modes || !M6 || !K6) return null;
    const comps = components || [];
    return modes.map(function(md){
      const phi = md.phi || [0,0,0,0,0,0];
      const w = 2*Math.PI*md.f_Hz;
      const mGen = quadForm(M6, phi), kGen = quadForm(K6, phi);
      const half = 0.5*w*w;
      const u = [phi[0],phi[1],phi[2]], th = [phi[3],phi[4],phi[5]];
      const bodies = comps.map(function(c){
        const d = [c.cg[0]-cg[0], c.cg[1]-cg[1], c.cg[2]-cg[2]];
        // v = u + θ×d
        const v = [ u[0] + th[1]*d[2] - th[2]*d[1],
                    u[1] + th[2]*d[0] - th[0]*d[2],
                    u[2] + th[0]*d[1] - th[1]*d[0] ];
        const I = c.pointMass ? [[0,0,0],[0,0,0],[0,0,0]] : (c.I || [[0,0,0],[0,0,0],[0,0,0]]);
        const e = {
          name: c.name,
          X: half*c.mass*v[0]*v[0], Y: half*c.mass*v[1]*v[1], Z: half*c.mass*v[2]*v[2],
          RXX: half*I[0][0]*th[0]*th[0], RYY: half*I[1][1]*th[1]*th[1], RZZ: half*I[2][2]*th[2]*th[2],
          RXY: half*2*I[0][1]*th[0]*th[1], RXZ: half*2*I[0][2]*th[0]*th[2], RYZ: half*2*I[1][2]*th[1]*th[2]
        };
        e.ke = e.X+e.Y+e.Z+e.RXX+e.RYY+e.RZZ+e.RXY+e.RXZ+e.RYZ;
        return e;
      });
      const total = bodies.reduce(function(s,b){ return s + b.ke; }, 0);
      bodies.forEach(function(b){ b.pct = (total !== 0) ? 100*b.ke/total : 0; });
      return { mGen: mGen, kGen: kGen, ke: half*mGen, bodies: bodies, total: total };
    });
  }

  // ═══════════════════ Tork zinciri (SPEC 4.5) ═══════════════════

  // T_shaft = Te,max × R_stall × i_gear × i_transfer × φ_axle × derate
  // φ_axle = (aks payı)/(toplam pay) — A26'da eksikti, DÜZELTİLDİ.
  // i_gear işaretli girilebilir (geri vites → negatif → T_shaft negatif).
  function torqueChain(p){
    return p.Te * p.Rstall * p.iGear * p.iTransfer * p.phiAxle *
           ((p.derate === undefined || p.derate === null) ? 1 : p.derate);
  }

  // ═══════════════════ Doğrulama (SPEC 5 hata durumları, T8) ═══════════════════

  // Saf girdi doğrulaması; problem dizisi döner (boş = geçerli).
  function validateModel(components, mounts){
    const problems=[];
    if(!components || !components.length) problems.push('Bileşen tablosu boş.');
    if(!mounts || !mounts.length) problems.push('Takoz tablosu boş.');
    (components||[]).forEach(c=>{
      if(!(c.mass > 0)) problems.push('Kütle ≤ 0: ' + (c.name||'bileşen'));
    });
    (mounts||[]).forEach(mnt=>{
      if(mnt.kstat.some(k=>!(k>0))) problems.push('Statik rijitlik ≤ 0: ' + (mnt.name||'takoz'));
      if(mnt.kdyn.some(k=>!(k>0))) problems.push('Dinamik rijitlik ≤ 0: ' + (mnt.name||'takoz'));
    });
    return problems;
  }

  // ═══════════════════ Varsayılan yük durumu şablonu (SPEC 4.4) ═══════════════════

  // Katsayılar şirket yük kitabından düzenlenebilir; başlangıç temsili.
  // Tork durumlarının Tx'i tork paneli "Yük durumuna uygula →" ile dolar.
  function defaultLoadCases(){
    return [
      {name:'Static',         n:[ 0, 0,-1], T:[0,0,0]},
      {name:'Max Bump',       n:[ 0, 0,-3], T:[0,0,0]},
      {name:'Acceleration',   n:[ 1, 0,-1], T:[0,0,0]},
      {name:'Braking',        n:[-1, 0,-1], T:[0,0,0]},
      {name:'Cornering L',    n:[ 0, 0.6,-1], T:[0,0,0]},
      {name:'Cornering R',    n:[ 0,-0.6,-1], T:[0,0,0]},
      {name:'Forward Torque', n:[ 0, 0,-1], T:[0,0,0]},
      {name:'Reverse Torque', n:[ 0, 0,-1], T:[0,0,0]}
    ];
  }

  // ═══════════════════ TTAR referans örneği (SPEC 6.1) ═══════════════════

  // UI birimleriyle (mm, kg, kg·m², N/mm) — "Örnek Yükle (TTAR)" düğmesi ve
  // selfTest bu seti kullanır. A26'daki boş loadExample DÜZELTİLDİ.
  const TTAR_EXAMPLE = {
    g: 9.81,
    components: [
      {name:'Motor',      mass:1386.3,  cg:[-321.36,   4.89, 859.33], Ixx:110.7, Iyy:260.2, Izz:205.9, Ixy:0,      Ixz:0,     Iyz:0,      pointMass:false},
      {name:'Şanzıman',   mass:778.3,   cg:[ 905.82,  11.17, 683.81], Ixx:16.43, Iyy:68.15, Izz:64.91, Ixy:0,      Ixz:0,     Iyz:0,      pointMass:false},
      {name:'Şaft payı',  mass:50.65,   cg:[3041.58,   0.00,-168.42], Ixx:0,     Iyy:0,     Izz:0,     Ixy:0,      Ixz:0,     Iyz:0,      pointMass:true},
      {name:'Sol cradle', mass:39.635,  cg:[2158.36,-274.78, -39.54], Ixx:0.237, Iyy:3.851, Izz:3.727, Ixy:-0.170, Ixz:0.257, Iyz:-0.033, pointMass:false},
      {name:'Sağ cradle', mass:39.637,  cg:[2150.65, 318.79, -39.54], Ixx:0.230, Iyy:3.858, Izz:3.727, Ixy:0.076,  Ixz:0.256, Iyz:0.039,  pointMass:false}
    ],
    mounts: [
      {name:'sağ ön',   pos:[-948.70,  50.81, 371.02], kstat:[1252,1252,640], kdyn:[2055,2055,977]},
      {name:'sol ön',   pos:[-948.70, -50.81, 371.02], kstat:[1252,1252,640], kdyn:[2055,2055,977]},
      {name:'sağ orta', pos:[ 535.31, 357.19, 635.27], kstat:[1252,1252,640], kdyn:[2055,2055,977]},
      {name:'sol orta', pos:[ 535.31,-357.11, 635.27], kstat:[1252,1252,640], kdyn:[2055,2055,977]},
      {name:'sağ arka', pos:[ 636.81, 357.19, 635.27], kstat:[1252,1252,640], kdyn:[2055,2055,977]},
      {name:'sol arka', pos:[ 636.81,-357.11, 635.27], kstat:[1252,1252,640], kdyn:[2055,2055,977]}
    ],
    torque: { Te:3000, Rstall:1.62, iTransfer:1.407,
              fwd:{iGear:3.51, phiAxle:1/3.6}, rev:{iGear:-4.8, phiAxle:2.6/3.6},
              derate:1 },
    // Tork durumları T5 ile tutarlı doldurulur: ileri viteste Tx = −T_shaft.
    loadCases: [
      {name:'Static',         n:[ 0, 0,-1], T:[0,0,0]},
      {name:'Max Bump',       n:[ 0, 0,-3], T:[0,0,0]},
      {name:'Acceleration',   n:[ 1, 0,-1], T:[0,0,0]},
      {name:'Braking',        n:[-1, 0,-1], T:[0,0,0]},
      {name:'Cornering L',    n:[ 0, 0.6,-1], T:[0,0,0]},
      {name:'Cornering R',    n:[ 0,-0.6,-1], T:[0,0,0]},
      {name:'Forward Torque', n:[ 0, 0,-1], T:[-6667.07,0,0]},
      {name:'Reverse Torque', n:[ 0, 0,-1], T:[ 23705.06,0,0]}
    ]
  };

  // ═══════════════════ BMC Siper referans örneği ═══════════════════
  // Kaynak: CATIA Measure-Inertia (kütle/CG/atalet, parça-CG çerçevesinde),
  // takoz kataloğu LMT-1433-37 (55 ShA) ve ADAMS .BMC_TTAR_2031 modeli.
  // Birimler UI ile aynı: mm, kg, kg·m², N/mm, N·m. Toplam kütle 2294.5 kg.
  // Her gövde/takozun at:[lx,ly]'si kullanıcının verdiği topoloji düzenini
  // birebir yeniden üretir (panel önizlemesi + "Aktar" ile kurulan kanvas aynı).
  const SIPER_EXAMPLE = {
    g: 9.81,
    components: [
      {name:'Motor',      mass:1386.3,   cg:[-321.36,    4.89,  859.33 ], Ixx:110.7, Iyy:260.2, Izz:205.9, Ixy:0,      Ixz:0,     Iyz:0,      pointMass:false, at:[335,260]},
      {name:'Şanzıman',   mass:778.3,    cg:[ 905.815,  11.17,  683.81 ], Ixx:16.43, Iyy:68.15, Izz:64.91, Ixy:0,      Ixz:0,     Iyz:0,      pointMass:false, at:[440,265]},
      {name:'Şaft payı',  mass:50.65,    cg:[3041.582,   0.00, -168.419], Ixx:0,     Iyy:0,     Izz:0,     Ixy:0,      Ixz:0,     Iyz:0,      pointMass:true,  at:[545,265]},
      {name:'Sol cradle', mass:39.635,   cg:[2158.356,-274.782, -39.54 ], Ixx:0.237, Iyy:3.851, Izz:3.727, Ixy:-0.170, Ixz:0.257, Iyz:-0.033, pointMass:false, at:[375,360]},
      {name:'Sağ cradle', mass:39.637,   cg:[2150.654, 318.791, -39.54 ], Ixx:0.230, Iyy:3.858, Izz:3.727, Ixy:0.076,  Ixz:0.256, Iyz:0.039,  pointMass:false, at:[410,175]}
    ],
    mounts: [
      {name:'sağ ön',   pos:[-948.697,  50.810, 371.023], kstat:[1252,1252,640], kdyn:[2055,2055,977], at:[215,250]},
      {name:'sol ön',   pos:[-948.697, -50.810, 371.023], kstat:[1252,1252,640], kdyn:[2055,2055,977], at:[215,350]},
      {name:'sağ orta', pos:[ 535.313, 357.192, 635.270], kstat:[1252,1252,640], kdyn:[2055,2055,977], at:[370, 70]},
      {name:'sol orta', pos:[ 535.313,-357.109, 635.270], kstat:[1252,1252,640], kdyn:[2055,2055,977], at:[375,460]},
      {name:'sağ arka', pos:[ 636.813, 357.192, 635.270], kstat:[1252,1252,640], kdyn:[2055,2055,977], at:[450, 70]},
      {name:'sol arka', pos:[ 636.813,-357.109, 635.270], kstat:[1252,1252,640], kdyn:[2055,2055,977], at:[455,460]}
    ],
    torque: { Te:3000, Rstall:1.62, iTransfer:1.407,
              fwd:{iGear:3.51, phiAxle:1/3.6}, rev:{iGear:-4.8, phiAxle:2.6/3.6},
              derate:1 },
    // Shaft_Tork(1)=6667.07 N·m (ileri), Shaft_Tork(2)=-23705.14 N·m (geri) → Tx=-T_shaft.
    loadCases: [
      {name:'Static',         n:[ 0, 0,-1], T:[0,0,0]},
      {name:'Max Bump',       n:[ 0, 0,-3], T:[0,0,0]},
      {name:'Acceleration',   n:[ 1, 0,-1], T:[0,0,0]},
      {name:'Braking',        n:[-1, 0,-1], T:[0,0,0]},
      {name:'Cornering L',    n:[ 0, 0.6,-1], T:[0,0,0]},
      {name:'Cornering R',    n:[ 0,-0.6,-1], T:[0,0,0]},
      {name:'Forward Torque', n:[ 0, 0,-1], T:[ -6667.07,0,0]},
      {name:'Reverse Torque', n:[ 0, 0,-1], T:[ 23705.14,0,0]}
    ]
  };

  // ═══════════════════ TULGA referans örneği ═══════════════════
  // Kaynak: kullanıcının 2026-07-06 tarihli "TULGA" proje kaydı; kütle/CG/atalet,
  // takoz konumu ve rijitlikleri o dosyadan BİREBİR alındı (mm, kg, kg·m², N/mm,
  // N·m — UI ile aynı birimler). 8 kütle gövdesi (motor + şanzıman + transfer
  // kutusu + 5 braket) toplam 788.4 kg; 5 elastomer takozla şasiye bağlanır.
  // at:[lx,ly] değerleri JSON topolojisindeki düğüm MERKEZLERİNDEN türetildi →
  // panel önizlemesi ile "Örneği Aktar"ın kurduğu kanvas aynı yerleşimi gösterir.
  //
  // NOT (kaynak dosyadaki etiket): alttaki ön takoz kaynak kayıtta "Sağ Ön Takoz"
  // adını taşıyor ama y = −355.957 (sol taraf) — yani üsttekiyle aynı ada sahip.
  // Kullanıcı verisi DEĞİŞTİRİLMEDİ (ad yalnız etikettir, çözüme girmez); konum
  // ve rijitlikler doğrudur. Düzeltilmesi istenirse tek yer: bu ad + JSON'daki
  // customName.
  const TULGA_TORQUE = { Te:760, Rstall:1.58, iTransfer:3.428,
                         fwd:{iGear:3.10, phiAxle:1}, rev:{iGear:-4.49, phiAxle:1},
                         derate:1 };
  const TULGA_EXAMPLE = {
    g: 9.81,
    components: [
      {name:'Motor',            mass:418,  cg:[ 124.960,   0.050, 550.030], Ixx:14.7, Iyy:25.00, Izz:19.10, Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-motor',    at:[327,280]},
      {name:'Şanzıman',         mass:162,  cg:[ 814.550,  40.817, 365.138], Ixx:2.80, Iyy:6.96,  Izz:6.71,  Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-gearbox',  at:[450,280]},
      {name:'Transfer Kutusu',  mass:184,  cg:[1431.449,  54.419, 202.336], Ixx:4.75, Iyy:6.25,  Izz:3.93,  Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-transfer', at:[566,280]},
      {name:'Sağ Arka Braket',  mass:3.7,  cg:[1381.732, 297.711,  72.438], Ixx:0,    Iyy:0,     Izz:0,     Ixy:0, Ixz:0, Iyz:0, pointMass:true,  kind:'mnt-bracket',  at:[612,198]},
      {name:'Sol Arka Braket',  mass:3.7,  cg:[1381.734,-201.321,  76.001], Ixx:0,    Iyy:0,     Izz:0,     Ixy:0, Ixz:0, Iyz:0, pointMass:true,  kind:'mnt-bracket',  at:[619,374]},
      {name:'Sağ Ön Braket',    mass:3.5,  cg:[ 479.996, 293.464, 528.943], Ixx:0,    Iyy:0,     Izz:0,     Ixy:0, Ixz:0, Iyz:0, pointMass:true,  kind:'mnt-bracket',  at:[442,191]},
      {name:'Sol Ön Braket',    mass:3.5,  cg:[ 480.001,-295.736, 528.936], Ixx:0,    Iyy:0,     Izz:0,     Ixy:0, Ixz:0, Iyz:0, pointMass:true,  kind:'mnt-bracket',  at:[442,374]},
      {name:'Ön Takoz Braketi', mass:10,   cg:[-191.918,  -2.787, 278.202], Ixx:0,    Iyy:0,     Izz:0,     Ixy:0, Ixz:0, Iyz:0, pointMass:true,  kind:'mnt-bracket',  at:[207,282]}
    ],
    mounts: [
      {name:'Ön Takoz',       pos:[-196.034,   0.047, 179.682], kstat:[665,335,290], kdyn:[1165,590,490], at:[ 85,282]},
      {name:'Sağ Ön Takoz',   pos:[ 439.961, 356.042, 499.855], kstat:[515,260,242], kdyn:[ 335,355,740], at:[437, 88]},
      {name:'Sağ Arka Takoz', pos:[1381.672, 305.873,  43.452], kstat:[415,210,192], kdyn:[ 535,250,230], at:[605, 87]},
      {name:'Sağ Ön Takoz',   pos:[ 439.961,-355.957, 499.855], kstat:[515,260,242], kdyn:[ 335,355,740], at:[442,484]},
      {name:'Sol Arka Takoz', pos:[1381.672,-304.131,  51.439], kstat:[415,210,192], kdyn:[ 535,250,230], at:[600,485]}
    ],
    torque: TULGA_TORQUE,
    // Tork durumları tork zincirinden (torqueChain) TÜRETİLİR — elle yazılmaz ki
    // TULGA_TORQUE değişince sessizce eskimesin. İşaret kuralı T5 ile aynı:
    // Tx = −T_shaft (ileri viteste negatif, geri viteste pozitif).
    //   ileri: 760 × 1.58 × 3.10 × 3.428 × 1 =  12760.66 N·m → Tx = −12760.66
    //   geri : 760 × 1.58 × (−4.49) × 3.428 × 1 = −18482.38 N·m → Tx = +18482.38
    loadCases: (function(){
      const t = TULGA_TORQUE;
      const chain = d => torqueChain({ Te:t.Te, Rstall:t.Rstall, iGear:d.iGear,
                                       iTransfer:t.iTransfer, phiAxle:d.phiAxle, derate:t.derate });
      const T = { 'Forward Torque': -chain(t.fwd), 'Reverse Torque': -chain(t.rev) };
      return defaultLoadCases().map(c => (c.name in T) ? Object.assign({}, c, { T:[T[c.name],0,0] }) : c);
    })()
  };

  // ── ASFAT 8x8 Obüs (BMC ASR-SR-116) ────────────────────────────────────────
  // Kaynak: BMC SAS Mühendislik, "ASFAT 8x8 OBUS Aracına Uygun Takoz Seçimi,
  // Frekans ve Mod Hesaplamaları", Dok. No ASR-SR-116, 04.08.2021.
  //   kütle/CG  → Tablo 2 · atalet → Tablo 3 · hardpoint → Tablo 6 · rijitlik → Tablo 9
  //   ζ = 0,02  → Tablo 11 · rölanti 600 d/dk, 6 silindir → §4 (f_ateş = 30 Hz)
  //
  // TORK YOK: doküman tahrik torku / konvertör stall oranı / vites oranı vermez.
  // torque alanı bilinçli olarak tanımsızdır — uydurma değerle Kriter 3/4 "geçti"
  // görüntüsü üretmemek için. Yükleyici EX.torque||{} ile bunu zaten karşılıyor.
  //
  // ŞAFT AĞIRLIK MERKEZİ dokümanda HİÇBİR tabloda verilmemiştir (yalnız Şekil 7'de
  // küre olarak görünür). Buradaki (2246; 156; 0) değeri, Tablo 7'nin altı düşey
  // takoz yüküne en küçük kareler ile oturtularak geri çözülmüştür (RMS 0,009 kg);
  // z statik düşey dağılımı etkilemediğinden 0 bırakılmıştır.
  //
  // PTO'lar parça bazında değil GRUP olarak modellenmiştir (Tablo 2 CG + Tablo 3
  // atalet). Tablo 4 altı ayrı parça verir ama parça başına atalet vermez; nokta
  // kütleye indirgemek grubun KENDİ roll ataletini (Top 0,45 · Side 0,136 kg·m²)
  // tümüyle düşürür, çünkü parçalar aynı y–z koordinatındadır. Etki küçüktür
  // (roll modu 19,25 → 19,22 Hz) ama grup biçimi dokümanı birebir yeniden üretir.
  const ASFAT_EXAMPLE = {
    g: 9.81,
    components: [
      {name:'Motor — Cummins 57RS303308',      mass:1600, cg:[-314.940,  -0.127, 857.560], Ixx:110.7,  Iyy:260.2,  Izz:205.9,  Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-motor',     at:[336,238]},
      {name:'Şanzıman + Retarder — Allison 4700', mass:600, cg:[945.373, -9.970, 680.960], Ixx:16.43,  Iyy:68.15,  Izz:64.91,  Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-gearbox',   at:[536,247]},
      {name:'Şaft',                            mass:16,   cg:[2246.000, 156.000,   0.000], Ixx:0.042,  Iyy:1.16,   Izz:1.16,   Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-shaft',     at:[686,247]},
      {name:'Sol Motor Braketi',               mass:48,   cg:[ 760.963,-300.631, 736.392], Ixx:0.315,  Iyy:4.392,  Izz:4.211,  Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-bracket',   at:[336,356]},
      {name:'Sağ Motor Braketi',               mass:48,   cg:[ 760.963, 300.631, 736.392], Ixx:0.315,  Iyy:4.392,  Izz:4.211,  Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-bracket',   at:[336,152]},
      {name:'Top PTO Grubu',                   mass:97,   cg:[1058.064,  77.013, 894.726], Ixx:0.45,   Iyy:6.515,  Izz:6.15,   Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-pto-group', at:[442,154]},
      {name:'Side PTO Grubu',                  mass:46,   cg:[ 855.340,-269.520, 473.300], Ixx:0.136,  Iyy:0.915,  Izz:0.915,  Ixy:0, Ixz:0, Iyz:0, pointMass:false, kind:'mnt-pto-group', at:[220,354]}
    ],
    // ÖN ikili 57RS313774 statik = dinamik (Tablo 9 böyle verir — elastomer için
    // atipiktir ama dokümandan aynen alınmıştır). ARKA dörtlü 57RS313773 dinamik
    // olarak sertleşir: 462→630 (x,y) ve 2200→3000 (z).
    mounts: [
      {name:'Ön Sol · 57RS313774',   pos:[-953.45, -50.67, 367.00], kstat:[1045,1045,1800], kdyn:[1045,1045,1800], at:[ 89,187]},
      {name:'Ön Sağ · 57RS313774',   pos:[-953.45,  50.67, 367.00], kstat:[1045,1045,1800], kdyn:[1045,1045,1800], at:[ 85,303]},
      {name:'Sol Ön · 57RS313773',   pos:[ 535.31,-347.10, 615.77], kstat:[ 462, 462,2200], kdyn:[ 630, 630,3000], at:[336,468]},
      {name:'Sağ Ön · 57RS313773',   pos:[ 535.31, 347.10, 615.77], kstat:[ 462, 462,2200], kdyn:[ 630, 630,3000], at:[337, 41]},
      {name:'Sol Arka · 57RS313773', pos:[ 636.80,-347.10, 615.77], kstat:[ 462, 462,2200], kdyn:[ 630, 630,3000], at:[428,469]},
      {name:'Sağ Arka · 57RS313773', pos:[ 636.80, 347.10, 615.77], kstat:[ 462, 462,2200], kdyn:[ 630, 630,3000], at:[428, 40]}
    ],
    loadCases: defaultLoadCases()
  };

  // ═══════════════════ Çoklu örnek kayıt defteri ═══════════════════
  // Her giriş kendi kendine yeterli bir doğrulama örneğidir: sayısal model
  // (TTAR_EXAMPLE biçimi) + sunum meta verisi (araç adı, açıklama, teknik özet)
  // + isteğe bağlı topoloji görseli. UI katmanı (cp-mount.js) buradan okur;
  // çekirdek hiçbir UI koduna bağlı değildir (yalnız veri tutar).
  //
  // ── YENİ ÖRNEK EKLEMEK ── buraya tek bir nesne ekle; panel ve yükleyici
  // otomatik okur, başka hiçbir yeri değiştirmeye gerek YOK:
  //
  //   'anahtar': {
  //     id:'anahtar',
  //     name:'Kısa Ad',                 // açılır menü etiketi
  //     vehicle:'Araç Adı',             // detay başlığı
  //     subtitle:'5 kütle · 6 takoz',   // başlık altı kısa etiket
  //     description:'Bir iki cümle açıklama.',
  //     specs:[['Etiket','Değer'], …],  // detay tablosu satırları
  //     image:'<svg…>' | 'data:image/…' | '',  // boş → modelden otomatik şema
  //     // AŞAĞIDAKİLERDEN BİRİ:
  //     model:{ g, components:[…], mounts:[…], torque:{…}, loadCases:[…] }  // (a) programatik
  //     topology:'assets/examples/xxx.json'   // (b) JSON topoloji (varsa öncelikli)
  //   }
  //
  // topology (ops., model'den ÖNCELİKLİ): "Başlangıç ve Örnekler" panelinden
  //   "İç Topolojiyi JSON Dışa Aktar" ile üretilen dosya. "Örneği Aktar" bu JSON'u
  //   iç topolojiye birebir kurar (konum/isim/bağlantı/veri dahil). Dosyayı
  //   assets/examples/'e koy; build tek dosyaya gömer (fetch'e gerek kalmaz).
  //
  // model.components[i].kind  (ops.) → kanvas tipini açıkça belirt
  //   ('mnt-motor'/'mnt-gearbox'/'mnt-shaft'/'mnt-bracket'/'mnt-transfer');
  //   verilmezse bileşen adından çıkarılır.
  // model.components[i].at / model.mounts[i].at = [lx,ly]  (ops.) → görseldeki
  //   yerleşimi birebir eşlemek için elle yerel-piksel konum; verilmezse
  //   otomatik yerleşim (orta sıra kütleler, alt/üst sıra takozlar) uygulanır.
  const MOUNT_EXAMPLES = {
    siper: {
      id: 'siper',
      name: 'BMC SİPER Takoz Analizi',
      vehicle: 'BMC Siper',
      subtitle: '5 kütle · 6 takoz güç grubu',
      description: 'BMC Siper güç grubunun 6 serbestlik dereceli rijit gövde takoz modeli — motor, şanzıman, şaft payı ve sol/sağ cradle braketleri, altı elastomer takoz (LMT-1433-37, 55 ShA) ile şasiye bağlanır. Değerler CATIA atalet ölçümü ve ADAMS doğrulamasından alınmıştır.',
      specs: [
        ['Kütle gövdesi', String(SIPER_EXAMPLE.components.length)],
        ['Takoz', String(SIPER_EXAMPLE.mounts.length)],
        ['Toplam kütle', SIPER_EXAMPLE.components.reduce(function(s,c){ return s + (c.mass||0); }, 0).toFixed(1) + ' kg'],
        ['Motor torku', SIPER_EXAMPLE.torque.Te + ' N·m'],
        ['Takoz statik (Z)', SIPER_EXAMPLE.mounts[0].kstat[2] + ' N/mm']
      ],
      // Panel önizleme sahnesi — yalnız görsel süs (yükleyici bunları KURMAZ),
      // kullanıcının verdiği topoloji düzeniyle aynı yerleşimde yardımcı araçlar.
      tools: [
        {type:'mnt-library',    name:'Takoz Özellikleri', at:[ 85, 70]},
        {type:'mnt-coordframe', name:'Koordinat Düzlemi',  at:[200, 80]},
        {type:'mnt-solver',     name:'Çözücü',             at:[740,265]},
        {type:'mnt-2dview',     name:'2D Görünüm',         at:[ 85,450]},
        {type:'mnt-viewer',     name:'3D Görüntüleyici',   at:[200,450]},
        {type:'mnt-example',    name:'Örnek',              at:[730,450]}
      ],
      // Kullanıcı ekran görüntüsünü assets/examples/siper.png olarak ekledi.
      // Dosya yoksa panel otomatik şemaya düşer (kırık resim gösterilmez).
      image: 'assets/examples/siper.png',
      // JSON topolojisi (model'den ÖNCELİKLİ): "Örneği Aktar" bu dosyayı iç
      // topolojiye birebir kurar. model aşağıda kalır (panel spec tablosu +
      // selfTest onu kullanır; JSON yüklenemezse programatik yola düşülür).
      topology: 'assets/examples/siper_topoloji.json',
      model: SIPER_EXAMPLE
    },
    tulga: {
      id: 'tulga',
      name: 'TULGA Takoz Analizi',
      vehicle: 'TULGA',
      subtitle: '8 kütle · 5 takoz güç grubu',
      description: 'TULGA güç grubunun 6 serbestlik dereceli rijit gövde takoz modeli — motor, şanzıman ve transfer kutusu, dört takoz braketi ve bir ön takoz braketiyle birlikte beş elastomer takoz üzerinden şasiye oturur. Kütle, ağırlık merkezi, atalet ve takoz rijitlikleri kullanıcının TULGA proje kaydından birebir alınmıştır.',
      specs: [
        ['Kütle gövdesi', String(TULGA_EXAMPLE.components.length)],
        ['Takoz', String(TULGA_EXAMPLE.mounts.length)],
        ['Toplam kütle', TULGA_EXAMPLE.components.reduce(function(s,c){ return s + (c.mass||0); }, 0).toFixed(1) + ' kg'],
        ['Motor torku', TULGA_EXAMPLE.torque.Te + ' N·m @ 1500 d/dk'],
        ['Motor gücü', '156.6 kW @ 2300 d/dk'],
        // Takozlar aynı rijitlikte DEĞİL (ön/orta/arka farklı) → tek değer yerine
        // aralık göster; sabit kodlanmazsa model değişince kendiliğinden düzelir.
        ['Takoz statik (Z)', (function(){
          var z = TULGA_EXAMPLE.mounts.map(function(m){ return m.kstat[2]; });
          var lo = Math.min.apply(null, z), hi = Math.max.apply(null, z);
          return (lo === hi ? String(lo) : lo + ' – ' + hi) + ' N/mm';
        })()]
      ],
      // Panel önizleme sahnesi — yalnız görsel süs (yükleyici bunları KURMAZ).
      // Konumlar JSON topolojisindeki yardımcı araç düğümleriyle aynı.
      tools: [
        {type:'mnt-library',    name:'Takoz Özellikleri', at:[816, 40]},
        {type:'mnt-solver',     name:'Çözücü',            at:[913, 40]},
        {type:'mnt-report',     name:'Rapor',             at:[997, 41]},
        {type:'mnt-2dview',     name:'2D Görünüm',        at:[790,232]},
        {type:'mnt-coordframe', name:'Koordinat Düzlemi', at:[884,234]},
        {type:'mnt-viewer',     name:'3D Görüntüleyici',  at:[983,235]},
        {type:'mnt-example',    name:'Örnek',             at:[995,401]}
      ],
      // Topoloji ekran görüntüsü. Dosya yoksa/yüklenemezse panel otomatik
      // şemaya düşer (kırık resim gösterilmez) — model + tools o yedek için
      // de duruyor.
      image: 'assets/examples/tulga.png',
      topology: 'assets/examples/tulga_topoloji.json',
      model: TULGA_EXAMPLE
    },
    asfat: {
      id: 'asfat',
      name: 'ASFAT 8x8 Obüs Takoz Analizi',
      vehicle: 'ASFAT 8x8 Obüs',
      subtitle: '7 kütle · 6 takoz güç grubu',
      description: 'ASFAT 8x8 Obüs güç grubunun 6 serbestlik dereceli rijit gövde takoz modeli — Cummins motor, Allison 4700 şanzıman + retarder, şaft, sol/sağ motor braketi ve üst/yan PTO grupları, altı elastomer takoz (57RS313774 ön ikili, 57RS313773 yan dörtlü) ile şasiye bağlanır. Değerler BMC ASR-SR-116 raporundan birebir alınmıştır; takoz yükleri ve çökmeleri raporun Adams sonuçlarını 0,01 kg / 0,005 mm içinde yeniden üretir.',
      specs: [
        ['Kütle gövdesi', String(ASFAT_EXAMPLE.components.length)],
        ['Takoz', String(ASFAT_EXAMPLE.mounts.length)],
        ['Toplam kütle', ASFAT_EXAMPLE.components.reduce(function(s,c){ return s + (c.mass||0); }, 0).toFixed(1) + ' kg'],
        ['Rölanti · silindir', '600 d/dk · 6 → f_ateş 30 Hz'],
        ['Sönüm oranı ζ', '0.02 (şirket kabulü)'],
        // Ön ve arka takoz farklı → tek değer yanıltıcı olur; aralık göster.
        ['Takoz dinamik (Z)', (function(){
          var z = ASFAT_EXAMPLE.mounts.map(function(m){ return m.kdyn[2]; });
          var lo = Math.min.apply(null, z), hi = Math.max.apply(null, z);
          return (lo === hi ? String(lo) : lo + ' – ' + hi) + ' N/mm';
        })()],
        ['Kaynak', 'BMC ASR-SR-116 · 04.08.2021']
      ],
      // Panel önizleme sahnesi — yalnız görsel süs (yükleyici bunları KURMAZ).
      // Konumlar JSON topolojisindeki yardımcı araç düğümleriyle aynı.
      tools: [
        {type:'mnt-library',    name:'Takoz Özellikleri', at:[893,226]},
        {type:'mnt-solver',     name:'Çözücü',            at:[893,328]},
        {type:'mnt-report',     name:'Rapor',             at:[987,330]},
        {type:'mnt-2dview',     name:'2D Görünüm',        at:[812,490]},
        {type:'mnt-coordframe', name:'Koordinat Düzlemi', at:[925,490]},
        {type:'mnt-viewer',     name:'3D Görüntüleyici',  at:[1036,490]}
      ],
      image: 'assets/examples/asfat.png',
      topology: 'assets/examples/asfat_topoloji.json',
      model: ASFAT_EXAMPLE
    }
  };
  // id → örnek girişi (bilinmezse defterdeki ilk örneğe düşer).
  function getMountExample(id){ return MOUNT_EXAMPLES[id] || MOUNT_EXAMPLES[Object.keys(MOUNT_EXAMPLES)[0]]; }
  // Açılır menü sırası için giriş listesi.
  function getMountExampleList(){ return Object.keys(MOUNT_EXAMPLES).map(function(k){ return MOUNT_EXAMPLES[k]; }); }

  // TTAR örneğini SI'ya çevirerek çekirdek tiplerine dönüştür.
  function ttarComponentsSI(){
    return TTAR_EXAMPLE.components.map(c=>({
      name:c.name, mass:c.mass,
      cg:[mmToM(c.cg[0]), mmToM(c.cg[1]), mmToM(c.cg[2])],
      I:[[c.Ixx,c.Ixy,c.Ixz],[c.Ixy,c.Iyy,c.Iyz],[c.Ixz,c.Iyz,c.Izz]],
      pointMass:!!c.pointMass
    }));
  }
  function ttarMountsSI(){
    return TTAR_EXAMPLE.mounts.map(mnt=>({
      name:mnt.name,
      pos:[mmToM(mnt.pos[0]), mmToM(mnt.pos[1]), mmToM(mnt.pos[2])],
      kstat:mnt.kstat.map(nPerMmToNPerM),
      kdyn:mnt.kdyn.map(nPerMmToNPerM)
    }));
  }

  // ═══════════════════ selfTest — Kabul testleri T1–T8 (SPEC 6) ═══════════════════

  function selfTest(){
    const details=[];
    let passed=0, failed=0;
    function check(id, name, ok, detail){
      details.push({id, name, ok:!!ok, detail: detail||''});
      if(ok) passed++; else failed++;
    }
    const near = (a,b,tol) => Number.isFinite(a) && Math.abs(a-b) <= tol;

    const comps = ttarComponentsSI();
    const mounts = ttarMountsSI();
    const g = TTAR_EXAMPLE.g;

    // ── T1: Kütle birleştirme ──
    const mp = combineMassProps(comps);
    if(!mp){
      check('T1','Kütle birleştirme', false, 'combineMassProps null döndü');
    } else {
      const cgmm = mp.cg.map(v=>v*1000);
      const expI = [[246.703,-5.074,369.912],[-5.074,1917.639,1.150],[369.912,1.150,1754.782]];
      let iOk=true, iDetail='';
      for(let i=0;i<3;i++) for(let j=0;j<3;j++){
        if(!near(mp.I_G[i][j], expI[i][j], 0.01)){
          iOk=false; iDetail+=' I['+i+']['+j+']='+mp.I_G[i][j].toFixed(4)+'≠'+expI[i][j];
        }
      }
      check('T1','Kütle birleştirme',
        near(mp.m, 2294.522, 0.01) &&
        near(cgmm[0], 254.669, 0.01) && near(cgmm[1], 7.504, 0.01) && near(cgmm[2], 746.052, 0.01) &&
        iOk,
        'm='+mp.m.toFixed(3)+' kg, cg=('+cgmm.map(v=>v.toFixed(3)).join(', ')+') mm'+iDetail);
    }

    // ── T2: K_stat blokları (MN birimleri) ──
    const Kstat = buildK(mounts, mp.cg, false);
    {
      const s = 1e-6; // N/m → MN/m
      const expTT = [7.512, 7.512, 3.840];
      // STANDART skew (birinci-prensip, v2 §2): K[x,θy]=−1.494 (dz-kuplajı, işaret
      // KRİTİK — frende burun aşağı fiziği bunu gerektirir). Çevirme yok.
      const expTTh = [[0,-1.4939,0.0562],[1.4939,0,-1.3536],[-0.0287,0.6919,0]];
      const expThTh = [[0.7437,-0.0052,-0.9462],[-0.0052,2.5549,-0.0112],[-0.9462,-0.0112,4.8346]];
      let ok=true; let det='';
      for(let i=0;i<3;i++){
        if(!near(Kstat[i][i]*s, expTT[i], 0.001)){ ok=false; det+=' K_tt['+i+']='+(Kstat[i][i]*s).toFixed(4); }
        for(let j=0;j<3;j++){
          if(!near(Kstat[i][3+j]*s, expTTh[i][j], 0.001)){ ok=false; det+=' K_tθ['+i+']['+j+']='+(Kstat[i][3+j]*s).toFixed(4); }
          if(!near(Kstat[3+i][3+j]*s, expThTh[i][j], 0.001)){ ok=false; det+=' K_θθ['+i+']['+j+']='+(Kstat[3+i][3+j]*s).toFixed(4); }
        }
      }
      check('T2','K_stat blokları', ok, det || 'tüm bloklar ±0.001 MN içinde');
    }

    // ── T3: Statik durum ──
    const stat = solveCase(Kstat, mounts, mp.cg, mp.m, g, {name:'Static', n:[0,0,-1], T:[0,0,0]});
    if(!stat){
      check('T3','Statik durum', false, 'solveCase null döndü');
    } else {
      const u = stat.q.slice(0,3).map(v=>v*1000);     // mm
      const th = stat.q.slice(3,6).map(v=>v*1000);    // mrad
      const expDz = [-3.941,-3.892,-6.911,-6.565,-7.104,-6.758];
      const expFz = [-2.522,-2.491,-4.423,-4.201,-4.547,-4.325];
      // STANDART skew (v2): statik ux=+0.379, uy=+0.084, θz=−0.072 mrad; δz/fz aynı.
      let ok = near(u[0], 0.379, 0.005) && near(u[1], 0.084, 0.005) && near(u[2], -6.208, 0.005) &&
               near(th[0], -0.485, 0.005) && near(th[1], 1.901, 0.005) && near(th[2], -0.072, 0.005);
      let det='q=('+u.map(v=>v.toFixed(3)).join(', ')+') mm, θ=('+th.map(v=>v.toFixed(3)).join(', ')+') mrad;';
      stat.perMount.forEach((pm,i)=>{
        const dz=pm.delta[2]*1000, fz=pm.f[2]/1000;
        if(!near(dz, expDz[i], 0.005) || !near(fz, expFz[i], 0.005)) ok=false;
        det += ' '+pm.name+': δz='+dz.toFixed(3)+' fz='+fz.toFixed(3)+';';
      });
      const sumFzKN = stat.sumF[2]/1000;
      if(!near(sumFzKN, -22.513, 0.005)) ok=false;
      if(!stat.checks.sumFzOk) ok=false;
      if(stat.checks.tensionCount !== 0) ok=false;
      check('T3','Statik durum', ok, det+' Σfz='+sumFzKN.toFixed(3)+' kN, çekme='+stat.checks.tensionCount);
    }

    // ── T4: Tork zinciri ──
    {
      const tq = TTAR_EXAMPLE.torque;
      const Tfwd = torqueChain({Te:tq.Te, Rstall:tq.Rstall, iGear:tq.fwd.iGear, iTransfer:tq.iTransfer, phiAxle:tq.fwd.phiAxle, derate:tq.derate});
      const Trev = torqueChain({Te:tq.Te, Rstall:tq.Rstall, iGear:tq.rev.iGear, iTransfer:tq.iTransfer, phiAxle:tq.rev.phiAxle, derate:tq.derate});
      check('T4','Tork zinciri',
        near(Tfwd, 6667.1, 0.5) && near(Trev, -23705.1, 0.5),
        'T_fwd='+Tfwd.toFixed(1)+' N·m, T_rev='+Trev.toFixed(1)+' N·m');
    }

    // ── T5: Forward süperpozisyon (+ T8d çekme senaryosu) ──
    const fwd = solveCase(Kstat, mounts, mp.cg, mp.m, g, {name:'Forward Torque', n:[0,0,-1], T:[-6667.07,0,0]});
    if(!fwd){
      check('T5','Forward süperpozisyon', false, 'solveCase null döndü');
      check('T8d','Çekme senaryosu', false, 'T5 çözülemedi');
    } else {
      const expDz = [-4.918,-2.914,-13.782,0.306,-13.975,0.113];
      let ok=true; let det='δz(mm):';
      fwd.perMount.forEach((pm,i)=>{
        const dz=pm.delta[2]*1000;
        if(!near(dz, expDz[i], 0.01)) ok=false;
        det += ' '+dz.toFixed(3);
      });
      check('T5','Forward süperpozisyon', ok, det);
      // T8d: sol orta ve sol arka δz>0 → çekme bayrağı 2 (lift-off DOĞRU yön)
      check('T8d','Çekme senaryosu (lift-off yönü)',
        fwd.checks.tensionCount === 2 && fwd.perMount[3].tension && fwd.perMount[5].tension,
        'çekme sayısı='+fwd.checks.tensionCount);
    }

    // ── T6: Modal (dinamik rijitlik) ──
    const Kdyn = buildK(mounts, mp.cg, true);
    const M6 = buildM6(mp.m, mp.I_G);
    const modes = solveModal(Kdyn, M6, mounts, mp.cg);
    if(!modes){
      check('T6','Modal (K_dyn)', false, 'solveModal null döndü');
    } else {
      const expF = [5.039, 6.111, 8.364, 10.148, 12.071, 21.239];
      const expLabel = [/roll/, /pitch/, /bounce/, /lateral|yaw/, /fore-aft/, /roll/];
      let ok = modes.length===6;
      let det='f(Hz):';
      modes.forEach((md,i)=>{
        if(!near(md.f_Hz, expF[i], 0.005)) ok=false;
        if(!expLabel[i].test(md.label)) ok=false;
        det += ' '+md.f_Hz.toFixed(3)+'('+md.label+')';
      });
      check('T6','Modal (K_dyn) frekans+etiket', ok, det);
    }

    // ── T7: Modal (statik rijitlik — çapraz kontrol) ──
    const modesStat = solveModal(Kstat, M6, mounts, mp.cg);
    if(!modesStat){
      check('T7','Modal (K_stat)', false, 'solveModal null döndü');
    } else {
      const expF = [4.051, 4.933, 6.764, 7.924, 9.433, 16.653];
      let ok = modesStat.length===6;
      let det='f(Hz):';
      modesStat.forEach((md,i)=>{
        if(!near(md.f_Hz, expF[i], 0.005)) ok=false;
        det += ' '+md.f_Hz.toFixed(3);
      });
      check('T7','Modal (K_stat) çapraz kontrol', ok, det);
    }

    // ── T8: Regresyon / negatif testler ──
    // T8a: boş takoz tablosu → anlamlı hata, çökme yok
    {
      const probs = validateModel(comps, []);
      const K0 = buildK([], mp.cg, false);
      const res0 = solveCase(K0, [], mp.cg, mp.m, g, {name:'x', n:[0,0,-1], T:[0,0,0]});
      check('T8a','Boş takoz tablosu',
        probs.some(p=>p.indexOf('Takoz tablosu boş')>=0) && res0===null,
        'problems='+JSON.stringify(probs)+', solveCase='+String(res0));
    }
    // T8b: tek takoz → çözüm üretirse ΣFz kontrolü geçmeli (singular kabul)
    {
      const one=[mounts[0]];
      const K1 = buildK(one, mp.cg, false);
      const res1 = solveCase(K1, one, mp.cg, mp.m, g, {name:'x', n:[0,0,-1], T:[0,0,0]});
      check('T8b','Tek takoz',
        res1===null || res1.checks.sumFzOk,
        res1===null ? 'K singular (kabul)' : 'ΣFz kontrolü: '+res1.checks.sumFzOk);
    }
    // T8c: kz = 0 → validasyon hatası ("rijitlik ≤ 0")
    {
      const bad=[{name:'bozuk', pos:[0,0,0], kstat:[1000,1000,0], kdyn:[1000,1000,1000]}];
      const probs = validateModel(comps, bad);
      check('T8c','kz=0 validasyonu',
        probs.some(p=>p.indexOf('rijitlik')>=0 || p.indexOf('Rijitlik')>=0),
        JSON.stringify(probs));
    }
    // (T8d yukarıda T5 ile birlikte koşuldu)

    // ── T9: Newton (solveCaseNL) lineer denklik — Static ──
    // Tümüyle lineer takozda Newton çözücüsü, doğrudan lineer çözüm (solveCase) ile
    // aynı sonucu vermeli (Newton ilk adımda tam çözüme iner). Nonlineer altyapının
    // mevcut fiziği bozmadığının çekirdek-içi güvencesi.
    {
      const lc={name:'Static', n:[0,0,-1], T:[0,0,0]};
      const nl = solveCaseNL(mounts, mp.cg, mp.m, g, lc, {useStop:true});
      const ref = solveCase(Kstat, mounts, mp.cg, mp.m, g, lc);
      let ok = !!nl && !!ref && nl.checks.converged === true;
      let maxd = 0;
      if(ok) nl.perMount.forEach((pm,i)=>{ maxd = Math.max(maxd, Math.abs(pm.delta[2]-ref.perMount[i].delta[2])); });
      if(maxd > 1e-7) ok = false;   // 1e-7 m = 1e-4 mm
      check('T9','Newton (solveCaseNL) lineer denklik', ok, 'maks|Δδz|='+(maxd*1000).toExponential(2)+' mm, converged='+(nl?nl.checks.converged:'—'));
    }
    // ── T10: Tanjant-modal lineer denklik ──
    // buildKtangentDyn(δ=0) lineer takozda buildK(dynamic)'e eşit → T6 frekansları.
    {
      const modesT = solveModalAtState(mounts, mp.cg, M6, null);
      const expF = [5.039, 6.111, 8.364, 10.148, 12.071, 21.239];
      let ok = !!modesT && modesT.length===6;
      let det='f(Hz):';
      if(ok) modesT.forEach((md,i)=>{ if(!near(md.f_Hz, expF[i], 0.005)) ok=false; det += ' '+md.f_Hz.toFixed(3); });
      check('T10','Tanjant-modal lineer denklik', ok, det);
    }

    return {passed, failed, details};
  }

  // ═══════════════════ Dışa aktarılan API (SPEC Bölüm 5) ═══════════════════

  return {
    // Model
    combineMassProps, buildK, buildM6, buildModel,
    solveCase, solveCaseStop, solveCaseNL, solveAllCases, solveModal,
    buildKtangentDyn, mountTangentKdyn, solveModalAtState,
    transmissibility, bounceFrequency,
    mountLoadShares, mountDamping,
    buildCdamp, frfPoint, frfForces, frequencyResponse, frfAt, shockResponse,
    principalInertia, modePlacement, softeningScan, equivalentBox,
    modalDampingRatios, modalEnergy,
    torqueChain, classifyMode, validateModel,
    // Şablon / örnek / test
    defaultLoadCases, TTAR_EXAMPLE, ttarComponentsSI, ttarMountsSI, selfTest,
    // Çoklu örnek kayıt defteri (UI katmanı için)
    MOUNT_EXAMPLES, getMountExample, getMountExampleList,
    // Birim dönüşümleri (UI katmanı için)
    mmToM, nPerMmToNPerM,
    // Constitutive — takoz kuvvet yasası (Newton çözücüsü + testler için)
    buildMonotoneCubic, makeAxisLaw, mountStaticLaws, mountHasCurve, anyCurve,
    // Numerik yardımcılar (test/ileri kullanım)
    solveLinear, cholesky, jacobiEigenSym, generalizedEigenSym,
    // Sabitler
    TENSION_EPS_M, LINEAR_LIMIT_M, STOP_GAP_M, STOP_STIFF_RATIO, DEFAULT_ZETA
  };
})();

// Node/Jest ortamında modül olarak da erişilebilir olsun (tarayıcıda no-op).
if(typeof module !== 'undefined' && module.exports){ module.exports = veMountCore; }
