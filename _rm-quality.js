const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),path=require('path');
const ROOT='/home/user/MFSim';
const geomModel=require(ROOT+'/js/structural-model.js');
eval(fs.readFileSync(path.join(ROOT,'js/structural-remesh.js'),'utf8'));
const glue=fs.readFileSync(ROOT+'/vendor/opencascade.js','utf8');
const sb={console,process,require,Buffer,URL,performance,TextDecoder:require('util').TextDecoder,TextEncoder:require('util').TextEncoder,__filename:ROOT+'/vendor/opencascade.js',__dirname:ROOT+'/vendor'};
sb.global=sb; vm.createContext(sb); vm.runInContext(glue+'\n;globalThis.__oc=opencascade;',sb);
const OCCT_WASM=zlib.gunzipSync(fs.readFileSync(ROOT+'/vendor/opencascade.wasm.gz'));
const triler=(idx)=>{const T=[];for(let t=0;t<idx.length;t+=3)T.push([idx[t],idx[t+1],idx[t+2]]);return T;};

(async()=>{
  const bytes=new Uint8Array(fs.readFileSync(process.argv[2]));
  const g=await geomModel.veStrImportStep(bytes,{fileName:'x.stp',fileSize:bytes.length},
      {factory:sb.__oc,wasmBinary:OCCT_WASM,noWorker:true});
  const m=g.meshes[0];
  const T0=triler(m.indices);
  const q0=veStrMeshQuality(m.positions,T0);
  console.log('HAM OCCT: '+T0.length+' üçgen · minAçı '+q0.minAngleDeg.toFixed(3)+'° · ort '
    +q0.meanMinAngleDeg.toFixed(1)+'° · <10° %'+q0.below10Pct.toFixed(2));

  // CAD yüz genişlikleri: yüz başına üçgen sayısı ve alan
  const alan=(t)=>{const P=m.positions,[a,b,c]=T0[t];
    const u=[P[b*3]-P[a*3],P[b*3+1]-P[a*3+1],P[b*3+2]-P[a*3+2]];
    const v=[P[c*3]-P[a*3],P[c*3+1]-P[a*3+1],P[c*3+2]-P[a*3+2]];
    const x=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    return 0.5*Math.hypot(x[0],x[1],x[2]);};
  const yuzler=m.faces.map(f=>{let A=0;for(let t=f.first;t<=f.last;t++)A+=alan(t);
    return {id:f.id,n:f.last-f.first+1,A};});
  yuzler.sort((a,b)=>a.A-b.A);
  const topA=yuzler.reduce((s,f)=>s+f.A,0);
  console.log('CAD yüzü: '+yuzler.length+' · toplam alan '+topA.toFixed(0)+' mm²');
  console.log('  en küçük 6 yüz alanı: '+yuzler.slice(0,6).map(f=>f.A.toFixed(2)).join(' · ')+' mm²');
  console.log('  medyan yüz alanı: '+yuzler[yuzler.length>>1].A.toFixed(2)+' mm²');
  const kucuk=yuzler.filter(f=>Math.sqrt(f.A)<3).length;
  console.log('  √alan < 3 mm olan yüz sayısı: '+kucuk+' / '+yuzler.length);

  for(const h of [6]){
    const r=veStrRemeshMesh({positions:m.positions,indices:m.indices,faces:m.faces},{targetLen:h});
    const T=triler(r.indices), P=r.positions;
    const q=veStrMeshQuality(P,T);
    console.log('\nREMESH h='+h+': '+T.length+' üçgen · minAçı '+q.minAngleDeg.toFixed(3)
      +'° · ort '+q.meanMinAngleDeg.toFixed(1)+'° · <10° %'+q.below10Pct.toFixed(2));
    // en kötü 200 üçgen: hepsi CAD sınırında mı?
    const ix=_rmIndex(T, r.faceIds);
    const sinir={};
    Object.keys(ix.edges).forEach(k=>{ const e=ix.edges[k];
      const yuz={}; e.tris.forEach(t=>{ yuz[r.faceIds[t]]=1; });
      if(e.tris.length===1 || Object.keys(yuz).length>1){ const [a,b]=k.split('_').map(Number); sinir[a]=1; sinir[b]=1; }
    });
    const kotu=T.map((tri,i)=>({i,a:_rmTriMinAngle(P,tri)})).sort((x,y)=>x.a-y.a).slice(0,200);
    let hepsiSinir=0, kismen=0;
    kotu.forEach(({i})=>{ const tri=T[i]; const c=tri.filter(v=>sinir[v]).length;
      if(c===3) hepsiSinir++; else if(c>0) kismen++; });
    console.log('  en kötü 200 üçgen: '+hepsiSinir+' tanesi ÜÇ köşesi de CAD sınırında · '+kismen+' kısmen · '
      +(200-hepsiSinir-kismen)+' sınırla ilgisiz');
    console.log('  en kötü 5 açı: '+kotu.slice(0,5).map(x=>x.a.toFixed(3)).join(' · ')+'°');
    // kenar boyu dağılımı
    const boy=[]; Object.keys(ix.edges).forEach(k=>{const [a,b]=k.split('_').map(Number);
      boy.push(Math.hypot(P[a*3]-P[b*3],P[a*3+1]-P[b*3+1],P[a*3+2]-P[b*3+2]));});
    boy.sort((x,y)=>x-y);
    console.log('  kenar boyu: min '+boy[0].toFixed(4)+' · %5 '+boy[(boy.length*0.05)|0].toFixed(3)
      +' · medyan '+boy[boy.length>>1].toFixed(3)+' · %95 '+boy[(boy.length*0.95)|0].toFixed(3)
      +' · max '+boy[boy.length-1].toFixed(3)+' mm (hedef '+h+')');
  }
  geomModel.veStrOcctForget();
})();
