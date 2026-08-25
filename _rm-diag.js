const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),path=require('path'),cp=require('child_process');
const ROOT='/home/user/MFSim';
const geomModel=require(ROOT+'/js/structural-model.js');
eval(fs.readFileSync(path.join(ROOT,'js/structural-remesh.js'),'utf8'));
const glue=fs.readFileSync(ROOT+'/vendor/opencascade.js','utf8');
const sb={console,process,require,Buffer,URL,performance,TextDecoder:require('util').TextDecoder,TextEncoder:require('util').TextEncoder,__filename:ROOT+'/vendor/opencascade.js',__dirname:ROOT+'/vendor'};
sb.global=sb; vm.createContext(sb); vm.runInContext(glue+'\n;globalThis.__oc=opencascade;',sb);
const OCCT_WASM=zlib.gunzipSync(fs.readFileSync(ROOT+'/vendor/opencascade.wasm.gz'));
const STP=process.argv[2]||'/root/.claude/uploads/0a1300c7-7935-51b8-8cb5-a7810df69371/5f62054d-braket.stp';
const HEDEFLER=(process.argv[3]||'10,8,6,5,4,3,2,1.5').split(',').map(Number);

function smesh(file, pos, idx, faceIds){
  const n=pos.length/3, m=idx.length/3;
  let s='# node\n'+n+' 3 0 0\n';
  const L=[];
  for(let i=0;i<n;i++) L.push((i+1)+' '+pos[i*3]+' '+pos[i*3+1]+' '+pos[i*3+2]);
  s+=L.join('\n')+'\n'+m+' 1\n';
  const F=[];
  const mark=new Map(); let next=1;
  for(let t=0;t<m;t++){
    const fid=faceIds?faceIds[t]:'x';
    if(!mark.has(fid)) mark.set(fid,next++);
    F.push('3 '+(idx[t*3]+1)+' '+(idx[t*3+1]+1)+' '+(idx[t*3+2]+1)+' '+mark.get(fid));
  }
  s+=F.join('\n')+'\n0\n0\n';
  fs.writeFileSync(file,s);
}
function tetgenD(base){
  if(!fs.existsSync(base+'.smesh')) throw new Error('smesh yok: '+base);
  let out='';
  try { out=cp.execSync('/tmp/tg/tetgen -d '+base+'.smesh 2>&1',{encoding:'utf8',maxBuffer:1<<28}); }
  catch(e){ out=(e.stdout||'')+(e.stderr||''); }
  if(process.env.RM_RAW) console.log('--- RAW ---\n'+out.slice(-2500));
  const atilan = +((out.match(/(\d+) input triangles are skipped due to self-intersections/)||[])[1] || 0);
  const segAtilan = +((out.match(/Skipped (\d+) segments? due to intersections/)||[])[1] || 0);
  const coincident = (out.match(/is coincident with/g)||[]).length;
  const segKes = [...out.matchAll(/1st seg\s+\[(\d+),(\d+)\][\s\S]*?2nd seg:\s+\[(\d+),(\d+)\]/g)]
      .map(x=>[[+x[1],+x[2]],[+x[3],+x[4]]]);
  const ortusen = [...out.matchAll(/nearly overlapping\.\s*\n\s*1st: \[(\d+),(\d+)\]\.\s*\n\s*2nd: \[(\d+),(\d+)\]/g)]
      .map(x=>[[+x[1],+x[2]],[+x[3],+x[4]]]);
  const dogru = /The input surface mesh is correct/.test(out);
  return { atilan, segAtilan, coincident, segKes, ortusen, dogru };
}

(async()=>{
  const bytes=new Uint8Array(fs.readFileSync(STP));
  const g=await geomModel.veStrImportStep(bytes,{fileName:'x.stp',fileSize:bytes.length},
      {factory:sb.__oc,wasmBinary:OCCT_WASM,noWorker:true});
  const m=g.meshes[0];
  console.log('OCCT: '+(m.indices.length/3)+' üçgen · '+m.faces.length+' yüz');
  smesh('/tmp/tg/d_ham.smesh', m.positions, m.indices, m.faces ? (()=>{const a=new Array(m.indices.length/3); m.faces.forEach(f=>{for(let t=f.first;t<=f.last;t++)a[t]=f.id;}); return a;})() : null);
  const dh = tetgenD('/tmp/tg/d_ham');
  console.log('  ham -d: doğru='+dh.dogru+' atılanÜçgen='+dh.atilan+' atılanSegment='+dh.segAtilan+' çakışıkNokta='+dh.coincident);
  const q0=veStrMeshQuality(m.positions,m.indices);
  console.log('  ham kalite: minAçı '+q0.minAngleDeg.toFixed(2)+'° · <10° %'+(q0.below10Pct||0).toFixed(2));

  for(const h of HEDEFLER){
    const t0=Date.now();
    const r=veStrRemeshMesh({positions:m.positions,indices:m.indices,faces:m.faces},{targetLen:h});
    if(!r.ok){ console.log('h='+h+' HATA '+r.error); continue; }
    smesh('/tmp/tg/d_'+String(h).replace('.','_')+'.smesh', r.positions, r.indices, r.faceIds);
    const d=tetgenD('/tmp/tg/d_'+String(h).replace('.','_'));
    const q=r.qualityAfter;
    console.log('h='+h+' mm: '+(r.indices.length/3)+' üçgen · minAçı '+q.minAngleDeg.toFixed(2)+'° · hacim '
      +(100*(r.volumeAfter-r.volumeBefore)/r.volumeBefore).toFixed(2)+'% · nm '+r.nonManifoldEdges
      +' · doğru='+d.dogru+' atılanÜçgen='+d.atilan+' atılanSeg='+d.segAtilan+' çakışıkNokta='+d.coincident
      +' · '+(Date.now()-t0)+' ms');
    if(d.segKes.length || d.ortusen.length){
      const P=r.positions;
      const pt=(i)=>[P[(i-1)*3],P[(i-1)*3+1],P[(i-1)*3+2]];
      const uz=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
      d.segKes.slice(0,3).forEach(([s1,s2])=>{
        console.log('    KESİŞEN SEGMENT [%d,%d] ↔ [%d,%d]  uçlar arası %s / %s mm  @ [%s]',
          s1[0],s1[1],s2[0],s2[1], uz(pt(s1[0]),pt(s2[1])).toFixed(5), uz(pt(s1[1]),pt(s2[0])).toFixed(5),
          pt(s1[0]).map(v=>v.toFixed(2)).join(', '));
      });
      d.ortusen.slice(0,3).forEach(([s1,s2])=>{
        console.log('    ÖRTÜŞEN  [%d,%d] ↔ [%d,%d]  boy %s / %s mm  @ [%s]',
          s1[0],s1[1],s2[0],s2[1], uz(pt(s1[0]),pt(s1[1])).toFixed(5), uz(pt(s2[0]),pt(s2[1])).toFixed(5),
          pt(s1[0]).map(v=>v.toFixed(2)).join(', '));
      });
    }
    if(false){
      // kesişen üçgenlerin koordinatları
      const P=r.positions, I=r.indices;
      const ctr=(t)=>[0,1,2].map(a=>(P[I[t*3]*3+a]+P[I[t*3+1]*3+a]+P[I[t*3+2]*3+a])/3);
      d.kesisim.slice(0,4).forEach(([a,b])=>{
        const ca=ctr(a-1), cb=ctr(b-1);
        const dist=Math.hypot(ca[0]-cb[0],ca[1]-cb[1],ca[2]-cb[2]);
        console.log('    #'+a+' ↔ #'+b+'  merkez uzaklığı '+dist.toFixed(3)+' mm  @ ['+ca.map(v=>v.toFixed(1)).join(', ')+']');
      });
    }
  }
  geomModel.veStrOcctForget();
})();
