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
// lift raises the look-at point (close-ups of tall pieces stay in the middle of the frame instead of at the bottom)
const look=(p,focus,zoom,ms,lift)=>p.evaluate(([focus,zoom,ms,lift])=>{ const v=window.__v(), o=window.__ob, T3=v.camera.position.constructor;
  const f=focus.reduce((a,s)=>a.add(v.sqPos(s)),new T3()).multiplyScalar(1/focus.length); f.y=o.t.y+(lift||0);
  const r0=Math.hypot(o.d.x,o.d.z), th=Math.atan2(o.d.x,o.d.z);
  const c1=new T3(f.x+r0*zoom*Math.sin(th),o.t.y+o.d.y*zoom+(lift||0),f.z+r0*zoom*Math.cos(th));
  const c0=v.camera.position.clone(), t0=v.controls.target.clone(), s=performance.now();
  (function step(){ const u=Math.min(1,(performance.now()-s)/ms), e=(1-Math.cos(Math.PI*u))/2;
    v.controls.target.lerpVectors(t0,f,e); v.camera.position.lerpVectors(c0,c1,e); v.camera.lookAt(v.controls.target); if(u<1) requestAnimationFrame(step); })(); },[focus,zoom,ms,lift]);
// calm close-up camera: glides in `ms` to `dist` in front of (white side) and `h` above the focus squares, looking at them
// `lift` above the board; a slight side offset keeps it from looking flat
const fly=(p,focus,dist,h,lift,ms,side)=>p.evaluate(([focus,dist,h,lift,ms,side])=>{ const v=window.__v(), T3=v.camera.position.constructor;
  const f=focus.reduce((a,s)=>a.add(v.sqPos(s)),new T3()).multiplyScalar(1/focus.length); f.y=lift;
  const c1=new T3(f.x+(side||.18)*dist,f.y+h,f.z+dist), c0=v.camera.position.clone(), t0=v.controls.target.clone(), s=performance.now();
  v.controls.minDistance=.2;
  (function step(){ const u=Math.min(1,(performance.now()-s)/ms), e=(1-Math.cos(Math.PI*u))/2;
    v.controls.target.lerpVectors(t0,f,e); v.camera.position.lerpVectors(c0,c1,e); v.camera.lookAt(v.controls.target); if(u<1) requestAnimationFrame(step); })(); },[focus,dist,h,lift,ms,side]);
const SCRIPTS={
 scholar:{title:[VS,'Checkmate in 4 moves?'],play:async(mv,p)=>{ // USA mates Russia, Putin cries
   await mv('e2','e4',1300); await mv('e7','e5',1300);
   await mv('f1','c4',2200); await sub(p,'Russia is not paying attention …');
   await mv('b8','c6',2000); await mv('d1','h5',1900); await mv('g8','f6',1700);
   await hideTitle(p); await mv('h5','f7',13500); }},
 // Russia (white) mates the lone German king with two drones and Putin: Kg6, Nf6, Nf7#
 drones:{nations:['rus','ger'],fen:'6k1/p7/8/3NNK2/8/8/8/8 w - - 0 1',
   hook:'CAN GERMANY<br>ESCAPE? 😬',
   title:['<span class="r">RUSSIA</span> vs. <span style="color:#ffce00">GERMANY</span>','Two drones and Putin …'],play:async(mv,p,shoot)=>{
   await orbit(p,shoot,8400,['f6','g6','h8','e5'],.55);
   await mv('f5','g6',1700); await mv('g8','h8',1500); await sub(p,'Germany has nowhere to run');
   await mv('d5','f6',1700); await mv('a7','a6',1400);
   await hideTitle(p); await mv('e5','f7',16000); }},
 // USA (white) with the flying car: Philidor's legacy, Lady Liberty sacrifices herself, the car mates (smothered mate)
 car:{nations:['usa','chn'],car:'w',fen:'rqr3k1/pp4pp/2p5/6N1/8/B7/5PPP/R2Q2K1 w - - 0 1',
   hook:'IS THIS THE<br>GAME CHANGER? 🚀',
   title:['<span class="u">USA</span> vs. <span style="color:#e0b23a">CHINA</span>','The flying car joins the army 🚀'],play:async(mv,p,shoot)=>{
   await orbit(p,shoot,7500,['b3','g8','a1','h8'],1.0);
   await p.evaluate(()=>{document.getElementById('vidNote').style.display='block';});
   await sub(p,'Lady Liberty: CHECK!'); await mv('d1','b3',1700);
   await look(p,['f7','g8','h6','g5'],.5,1100); await mv('g8','h8',1300);
   await sub(p,'Flying car: CHECK!'); await mv('g5','f7',1900); await mv('h8','g8',1200);
   await sub(p,'DOUBLE CHECK!'); await mv('f7','h6',1900); await mv('g8','h8',1200);
   await look(p,['b3','g8','h6'],.8,1000); await sub(p,'Lady Liberty sacrifices herself!'); await mv('b3','g8',1800);
   await sub(p,'The tank has to take her …'); await mv('c8','g8',2700);
   await look(p,['f7','g8','h6'],.45,900); await sub(p,'Smothered mate!'); await mv('h6','f7',1600);
   await hideTitle(p); await p.evaluate(()=>{document.getElementById('vidNote').style.display='none';}); await shoot(13000); }},
 // French farmers (white, video special) march on Macron, his army stands far away on the other wing: h5, h6, h7#
 farm:{nations:['fra','fra'],farm:'w',fen:'rr4k1/pp4P1/n1p3K1/4P3/3P1PPP/4P3/8/8 w - - 0 1',
   hook:'CAN MACRON STOP<br>THE FARMERS? 🚜',
   title:['<span style="color:#7cc46a">FARMERS</span> vs. <span class="u">MACRON</span>','The farmers are coming … 🚜'],play:async(mv,p,shoot)=>{
   await orbit(p,shoot,8400,['h4','g6','g8','e5'],.6);
   await mv('h4','h5',1800); await sub(p,'Macron: busy at a concert 🎤'); await mv('c6','c5',1800);
   await sub(p,'His army? Far away …'); await mv('h5','h6',1700); await mv('c5','c4',1500);
   await hideTitle(p); await mv('h6','h7',16000); }},
 // "Meet the nations": France joins (camera along the French pieces, queen and king close up, then a first jet flight vs UK)
 welcome_fra:{nations:['fra','gbr'],hook:'FRANCE HAS<br>ENTERED THE CHAT 🇫🇷',
   title:['<span style="color:#7ea6ff">FRANCE</span> vs. <span style="color:#a77be0">UK</span>','France joins Checkmate Nations'],play:async(mv,p,shoot)=>{
   // one piece type after the other: glide in slowly (1.3 s), hold (1.6 s), name tag as subtitle
   const stop=async(text,focus,dist,h,lift,side)=>{ await sub(p,text); await fly(p,focus,dist,h,lift,1300,side); await shoot(2900); };
   // infantry first, seen from the far side (the back rank would hide them from the front), then up and over to the front
   await stop('Infantry 🇫🇷',['c2','d2','e2'],-2.2,.95,.32,.25);
   await fly(p,['d3'],2.6,6.2,0,1200); await shoot(1000);
   await stop('Tanks',['a1'],1.75,.85,.3,.35);
   await stop('Drones',['b1'],1.65,.9,.38,.35);
   await stop('Fighter jets',['c1'],1.75,.9,.35,.45);
   await stop('Queen: Marianne, face of the Republic',['d1'],1.45,.7,.5,.3);
   await stop('King: Macron, defender of the Élysée',['e1'],1.35,.65,.62,.25);
   await sub(p,'France vs. UK · round 1,000? 👇'); await fly(p,['d4','e5'],5.2,4.6,0,1600,.05); await shoot(1700);
   await mv('e2','e4',1300); await mv('e7','e5',1300); await mv('f1','c4',3000); }},
 fool:{hook:'THE FASTEST<br>CHECKMATE EVER? 😬',title:[VS,'Can the USA survive 2 moves?'],play:async(mv,p,shoot)=>{ // Russia mates the USA, Trump cries
   await orbit(p,shoot,8400,['e1','h4','e5','g4'],.7);
   await mv('f2','f3',1500); await mv('e7','e5',1500);
   await mv('g2','g4',1300); await sub(p,'Oh no …'); await shoot(1400);
   await hideTitle(p); await mv('d8','h4',16000); }},
};
(async()=>{
 // tiny static server for the repo (WebGL refuses textures from file://)
 const srv=http.createServer((q,r)=>{ const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0])); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(r); }).listen(0);
 const port=srv.address().port;
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:540,height:960},deviceScaleFactor:4/3,reducedMotion:'no-preference'});
 p.on('pageerror',e=>console.log('ERR',e.message)); if(process.env.DEBUG) p.on('console',m=>console.log('PAGE',m.text()));
 await p.clock.install({time:new Date('2026-10-12T12:00:00')}); await p.clock.pauseAt(new Date('2026-10-12T12:00:01'));
 await p.goto(`http://127.0.0.1:${port}/tools/clip/video.html`);
 await p.clock.runFor(1500);
 const SC=SCRIPTS[process.env.CLIP||'scholar'];
 await p.evaluate(sc=>{ window.__sc=sc; window.__car=sc.car||null; window.__farm=sc.farm||null; },{nations:SC.nations,fen:SC.fen,car:SC.car,farm:SC.farm});
 await p.evaluate(()=>{const v=window.__v(); window.__rec=[]; v.ensureAudio(); v.setMode('video'); v.setCaric(true); const sc=window.__sc; v.setNations(...(sc.nations||['usa','rus'])); if(sc.fen) v.game.load(sc.fen); v.setupPieces(); v.camera.position.sub(v.controls.target).multiplyScalar(.86).add(v.controls.target); v.controls.update();});
 await p.evaluate(([l1,l2])=>{ document.querySelector('#vidTitle .l1').innerHTML=l1; document.querySelector('#vidTitle .l2').textContent=l2; },SC.title);
 await new Promise(r=>setTimeout(r,4000)); // board and background textures load for real, outside the fake clock
 await p.clock.runFor(500);
 if(MODE==='test'){ await p.screenshot({path:'test.png'}); await b.close(); srv.close(); return; }
 const FPS=24, dtms=1000/FPS; let n=0; const log=[];
 const CL=process.env.CLIP||'scholar', FR='frames-'+CL; fs.mkdirSync(FR,{recursive:true});
 const START=+(process.env.START||0);
 const ONLY=+(process.env.ONLY||0); // re-render just the first ONLY frames (e.g. after changing the hook), keep the rest
 const t0=await p.evaluate(()=>{ window.__rec.length=0; return performance.now(); });
 const shoot=async(ms,each)=>{ const k=Math.round(ms/dtms); for(let i=0;i<k;i++){ if(each) await each(k>1?i/(k-1):1); await p.clock.runFor(dtms); if(n<START||(ONLY&&n>=ONLY)){ n++; continue; } await p.evaluate(()=>{ for(const a of document.getAnimations()){ if(a.__st===undefined){ a.__st=performance.now(); a.pause(); } a.currentTime=performance.now()-a.__st; } }); await p.screenshot({path:`${FR}/f${String(n++).padStart(5,'0')}.jpg`,type:'jpeg',quality:88}); } };
 // a piece is picked (select sound), then moves
 const mv=async(from,to,hold)=>{ log.push([n/FPS,from,to]); await p.evaluate(([a,c])=>{ window.__rec.push([performance.now()-120,'sel',.8]); window.__v().doMove({from:a,to:c}); },[from,to]); await shoot(hold); };
 if(SC.hook){ // big question over the first seconds, the title appears once it is gone
   await p.evaluate(h=>{ const e=document.getElementById('vidHook'); e.querySelector('span').innerHTML=h; e.style.display='block'; document.getElementById('vidTitle').style.display='none'; },SC.hook);
   await shoot(2600);
   await p.evaluate(()=>{ document.getElementById('vidHook').style.display='none'; document.getElementById('vidTitle').style.display=''; });
 } else await shoot(1500);
 await SC.play(mv,p,shoot);
 await p.evaluate(()=>{document.getElementById('vidEnd').style.display='flex';});
 await shoot(3200);
 const snd=await p.evaluate(t0=>window.__rec.map(([t,k,v])=>[(t-t0)/1000,k,v]),t0);
 fs.writeFileSync(`moves-${CL}.json`,JSON.stringify(log)); fs.writeFileSync(`sounds-${CL}.json`,JSON.stringify(snd));
 console.log('frames',n); await b.close(); srv.close();
})();
