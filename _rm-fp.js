const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),path=require('path');
const ROOT='/home/user/MFSim';
const geomModel=require(ROOT+'/js/structural-model.js');
eval(fs.readFileSync(path.join(ROOT,'js/structural-remesh.js'),'utf8'));
const glue=fs.readFileSync(ROOT+'/vendor/opencascade.js','utf8');
const sb={console,process,require,Buffer,URL,performance,TextDecoder:require('util').TextDecoder,TextEncoder:require('util').TextEncoder,__filename:ROOT+'/vendor/opencascade.js',__dirname:ROOT+'/vendor'};
sb.global=sb; vm.createContext(sb); vm.runInContext(glue+'\n;globalThis.__oc=opencascade;',sb);
const OCCT_WASM=zlib.gunzipSync(fs.readFileSync(ROOT+'/vendor/opencascade.wasm.gz'));
let c={ortak0:0,ortak1:0,ortak1_coplanar:0,ortak0_coplanar:0,cagri:0,red:0};
const PH=_rmPairHits, CO=_rmCoplanarHit;
let sonCoplanar=false;
_rmCoplanarHit=function(){ sonCoplanar=true; return CO.apply(null,arguments); };
_rmPairHits=function(V,tri,o,pa,pb,pc){
  let ortak=0; for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(tri[i]===o[j]){ortak++;break;}
  sonCoplanar=false;
  const r=PH(V,tri,o,pa,pb,pc);
  if(r){ c.red++;
    if(ortak===0){ c.ortak0++; if(sonCoplanar) c.ortak0_coplanar++; }
    else if(ortak===1){ c.ortak1++; if(sonCoplanar) c.ortak1_coplanar++; } }
  return r;
};
(async()=>{
  const bytes=new Uint8Array(fs.readFileSync(process.argv[2]));
  const g=await geomModel.veStrImportStep(bytes,{fileName:'x.stp',fileSize:bytes.length},
      {factory:sb.__oc,wasmBinary:OCCT_WASM,noWorker:true});
  const m=g.meshes[0];
  const r=veStrRemeshMesh({positions:m.positions,indices:m.indices,faces:m.faces},{targetLen:6});
  const T=[];for(let i=0;i<r.indices.length;i+=3)T.push([r.indices[i],r.indices[i+1],r.indices[i+2]]);
  const q=veStrMeshQuality(r.positions,T);
  console.log('h=6: '+T.length+' üçgen · minAçı '+q.minAngleDeg.toFixed(3)+'° · ort '+q.meanMinAngleDeg.toFixed(1)
    +'° · <10° %'+q.below10Pct.toFixed(2));
  console.log('KALKAN REDDİ: toplam '+c.red
    +' · ortak köşe 0: '+c.ortak0+' (eş düzlemli '+c.ortak0_coplanar+')'
    +' · ortak köşe 1: '+c.ortak1+' (eş düzlemli '+c.ortak1_coplanar+')');
  geomModel.veStrOcctForget();
})();
