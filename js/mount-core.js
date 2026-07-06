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

  // skew(d): δ = u + θ×d ifadesindeki çapraz çarpım matrisi (SPEC 3.3).
  const skew = d => [[0,-d[2],d[1]],[d[2],0,-d[0]],[-d[1],d[0],0]];

  // A = [E3 | −skew(d)] — takoz kinematik matrisi: δ = A·q.
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
  function buildM6(m, I_G){
    const M=zeros(6,6);
    M[0][0]=M[1][1]=M[2][2]=m;
    for(let i=0;i<3;i++) for(let j=0;j<3;j++) M[3+i][3+j]=I_G[i][j];
    return M;
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

  // Çoklu yük durumu: sistem lineer → durumlar bağımsız çözülür.
  // model = { m, cg, Kstat, mounts, g }. Dönüş satırları Adams çıktı düzeni
  // (satır = yük durumu, sütun = takoz × {δx,δy,δz}).
  function solveAllCases(model, cases){
    return cases.map(lc => {
      const res = solveCase(model.Kstat, model.mounts, model.cg, model.m, model.g, lc);
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
      {name:'Cornering L',    n:[ 0, 1,-1], T:[0,0,0]},
      {name:'Cornering R',    n:[ 0,-1,-1], T:[0,0,0]},
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
      {name:'Cornering L',    n:[ 0, 1,-1], T:[0,0,0]},
      {name:'Cornering R',    n:[ 0,-1,-1], T:[0,0,0]},
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
      {name:'Cornering L',    n:[ 0, 1,-1], T:[0,0,0]},
      {name:'Cornering R',    n:[ 0,-1,-1], T:[0,0,0]},
      {name:'Forward Torque', n:[ 0, 0,-1], T:[ -6667.07,0,0]},
      {name:'Reverse Torque', n:[ 0, 0,-1], T:[ 23705.14,0,0]}
    ]
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
      // Kullanıcı ekran görüntüsünü assets/examples/siper.png olarak ekleyecek.
      // Dosya yoksa panel otomatik şemaya düşer (kırık resim gösterilmez).
      image: 'assets/examples/siper.png',
      model: SIPER_EXAMPLE
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

    return {passed, failed, details};
  }

  // ═══════════════════ Dışa aktarılan API (SPEC Bölüm 5) ═══════════════════

  return {
    // Model
    combineMassProps, buildK, buildM6, buildModel,
    solveCase, solveAllCases, solveModal,
    torqueChain, classifyMode, validateModel,
    // Şablon / örnek / test
    defaultLoadCases, TTAR_EXAMPLE, ttarComponentsSI, ttarMountsSI, selfTest,
    // Çoklu örnek kayıt defteri (UI katmanı için)
    MOUNT_EXAMPLES, getMountExample, getMountExampleList,
    // Birim dönüşümleri (UI katmanı için)
    mmToM, nPerMmToNPerM,
    // Numerik yardımcılar (test/ileri kullanım)
    solveLinear, cholesky, jacobiEigenSym, generalizedEigenSym,
    // Sabitler
    TENSION_EPS_M, LINEAR_LIMIT_M
  };
})();

// Node/Jest ortamında modül olarak da erişilebilir olsun (tarayıcıda no-op).
if(typeof module !== 'undefined' && module.exports){ module.exports = veMountCore; }
