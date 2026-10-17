const {chromium}=require(process.env.PW||'playwright-core');
const fs=require('fs'), http=require('http'), path=require('path');
const ROOT=path.join(__dirname,'../..');
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const MODE=process.argv[2]||'test';
const sub=(p,t)=>p.evaluate(t=>{document.querySelector('#vidTitle .l2').textContent=t;},t);
const hideTitle=p=>p.evaluate(()=>{document.getElementById('vidTitle').style.display='none';});
const VS='<span class="u">USA</span> vs. <span class="r">RUSSIA</span>';
// camera flight around the board at the start, close past the kings (their heads turn to the camera); it ends in a
// close view of `focus` (squares the action happens on) at `zoom` times the normal distance, seen from the normal side
const orbit=async(p,shoot,ms,focus,zoom)=>{
  await p.evaluate(([focus,zoom])=>{ const v=window.__v(), t=v.controls.target, c=v.camera.position, d=c.clone().sub(t);
    const f=focus?focus.reduce((a,s)=>a.add(v.sqPos(s)),new t.constructor()).multiplyScalar(1/focus.length):t.clone(); f.y=t.y;
    window.__ob={t:t.clone(),f,d,zoom:zoom||1}; v.controls.minDistance=.5; },[focus,zoom]);
  await shoot(ms,u=>p.evaluate(u=>{ const v=window.__v(), o=window.__ob, e=(1-Math.cos(Math.PI*u))/2;
    const r0=Math.hypot(o.d.x,o.d.z), th=Math.atan2(o.d.x,o.d.z)-2*Math.PI*.85*(1-e), r=r0*(.32+(o.zoom-.32)*e*e), y=o.d.y*(.25+(o.zoom-.25)*e);
    const tx=o.t.x+(o.f.x-o.t.x)*e, tz=o.t.z+(o.f.z-o.t.z)*e;
    v.controls.target.set(tx,o.t.y+.7*(1-e),tz); v.camera.position.set(tx+r*Math.sin(th),o.t.y+y,tz+r*Math.cos(th)); v.camera.lookAt(v.controls.target); },u)); };
const SCRIPTS={
 scholar:{title:[VS,'Checkmate in 4 moves?'],play:async(mv,p)=>{ // USA mates Russia, Putin cries
   await mv('e2','e4',1300); await mv('e7','e5',1300);
   await mv('f1','c4',2200); await sub(p,'Russia is not paying attention …');
   await mv('b8','c6',2000); await mv('d1','h5',1900); await mv('g8','f6',1700);
   await hideTitle(p); await mv('h5','f7',13500); }},
 // Russia (white) mates the lone German king with two drones and Putin: Kg6, Nf6, Nf7#
 drones:{nations:['rus','ger'],fen:'6k1/p7/8/3NNK2/8/8/8/8 w - - 0 1',
   title:['<span class="r">RUSSIA</span> vs. <span style="color:#ffce00">GERMANY</span>','Two drones and Putin …'],play:async(mv,p,shoot)=>{
   await orbit(p,shoot,8400,['f6','g6','h8','e5'],.55);
   await mv('f5','g6',1700); await mv('g8','h8',1500); await sub(p,'Germany has nowhere to run');
   await mv('d5','f6',1700); await mv('a7','a6',1400);
   await hideTitle(p); await mv('e5','f7',16000); }},
 fool:{title:[VS,'Can the USA survive 2 moves?'],play:async(mv,p,shoot)=>{ // Russia mates the USA, Trump cries
   await mv('f2','f3',1500); await mv('e7','e5',1500);
   await mv('g2','g4',1300); await sub(p,'Oh no …'); await shoot(1400);
   await hideTitle(p); await mv('d8','h4',13500); }},
};
(async()=>{
 // tiny static server for the repo (WebGL refuses textures from file://)
 const srv=http.createServer((q,r)=>{ const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0])); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(r); }).listen(0);
 const port=srv.address().port;
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:540,height:960},deviceScaleFactor:4/3,reducedMotion:'no-preference'});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.clock.install({time:new Date('2026-10-12T12:00:00')}); await p.clock.pauseAt(new Date('2026-10-12T12:00:01'));
 await p.goto(`http://127.0.0.1:${port}/tools/clip/video.html`);
 await p.clock.runFor(1500);
 const SC=SCRIPTS[process.env.CLIP||'scholar'];
 await p.evaluate(sc=>{ window.__sc=sc; },{nations:SC.nations,fen:SC.fen});
 await p.evaluate(()=>{const v=window.__v(); window.__rec=[]; v.ensureAudio(); v.setMode('video'); v.setCaric(true); const sc=window.__sc; v.setNations(...(sc.nations||['usa','rus'])); if(sc.fen) v.game.load(sc.fen); v.setupPieces(); v.camera.position.sub(v.controls.target).multiplyScalar(.86).add(v.controls.target); v.controls.update();});
 await p.evaluate(([l1,l2])=>{ document.querySelector('#vidTitle .l1').innerHTML=l1; document.querySelector('#vidTitle .l2').textContent=l2; },SC.title);
 await new Promise(r=>setTimeout(r,4000)); // board and background textures load for real, outside the fake clock
 await p.clock.runFor(500);
 if(MODE==='test'){ await p.screenshot({path:'test.png'}); await b.close(); srv.close(); return; }
 const FPS=24, dtms=1000/FPS; let n=0; const log=[];
 const CL=process.env.CLIP||'scholar', FR='frames-'+CL; fs.mkdirSync(FR,{recursive:true});
 const START=+(process.env.START||0);
 const t0=await p.evaluate(()=>{ window.__rec.length=0; return performance.now(); });
 const shoot=async(ms,each)=>{ const k=Math.round(ms/dtms); for(let i=0;i<k;i++){ if(each) await each(k>1?i/(k-1):1); await p.clock.runFor(dtms); if(n<START){ n++; continue; } await p.evaluate(()=>{ for(const a of document.getAnimations()){ if(a.__st===undefined){ a.__st=performance.now(); a.pause(); } a.currentTime=performance.now()-a.__st; } }); await p.screenshot({path:`${FR}/f${String(n++).padStart(5,'0')}.jpg`,type:'jpeg',quality:88}); } };
 // a piece is picked (select sound), then moves
 const mv=async(from,to,hold)=>{ log.push([n/FPS,from,to]); await p.evaluate(([a,c])=>{ window.__rec.push([performance.now()-120,'sel',.8]); window.__v().doMove({from:a,to:c}); },[from,to]); await shoot(hold); };
 await shoot(1500);
 await SC.play(mv,p,shoot);
 await p.evaluate(()=>{document.getElementById('vidEnd').style.display='flex';});
 await shoot(2500);
 const snd=await p.evaluate(t0=>window.__rec.map(([t,k,v])=>[(t-t0)/1000,k,v]),t0);
 fs.writeFileSync(`moves-${CL}.json`,JSON.stringify(log)); fs.writeFileSync(`sounds-${CL}.json`,JSON.stringify(snd));
 console.log('frames',n); await b.close(); srv.close();
})();
