const {chromium}=require('playwright-core');
const fs=require('fs');
const NM=process.env.NM||(__dirname+'/node_modules/');
const F=NM+'@fontsource/';
const fontCss=`@font-face{font-family:'Black Ops One';src:url(file://${F}black-ops-one/files/black-ops-one-latin-400-normal.woff2)}`+
 [500,600,700].map(w=>`@font-face{font-family:'Barlow Condensed';font-weight:${w};src:url(file://${F}barlow-condensed/files/barlow-condensed-latin-${w}-normal.woff2)}`).join('')+
 [400,500,600].map(w=>`@font-face{font-family:'Barlow';font-weight:${w};src:url(file://${F}barlow/files/barlow-latin-${w}-normal.woff2)}`).join('');
const M={'three.min.js':NM+'three/build/three.min.js','OrbitControls.js':NM+'three/examples/js/controls/OrbitControls.js','chess.min.js':NM+'chess.js/chess.js'};
const MODE=process.argv[2]||'test';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:540,height:960},deviceScaleFactor:4/3,reducedMotion:'no-preference'});
 await p.route('**/*',r=>{const u=r.request().url();
   for(const k in M) if(u.endsWith(k)) return r.fulfill({path:M[k],contentType:'application/javascript'});
   if(u.includes('fonts.googleapis.com/css')) return r.fulfill({body:fontCss,contentType:'text/css'});
   if(u.startsWith('file:')) return r.continue(); return r.abort();});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.clock.install({time:new Date('2026-10-12T12:00:00')}); await p.clock.pauseAt(new Date('2026-10-12T12:00:01'));
 await p.goto('file://'+__dirname+'/video.html');
 await p.clock.runFor(1500);
 await p.evaluate(()=>{const v=window.__v(); v.setMode('video'); v.setNations('usa','rus'); v.setupPieces(); v.camera.position.sub(v.controls.target).multiplyScalar(1.18).add(v.controls.target); v.controls.update();});
 await p.evaluate(()=>{ document.querySelector('#vidTitle .l1').innerHTML='<span class="u">USA</span> vs. <span class="r">RUSSIA</span>'; document.querySelector('#vidTitle .l2').textContent='Checkmate in 4 moves?'; });
 await p.clock.runFor(500);
 if(MODE==='test'){ await p.screenshot({path:'test.png'}); await b.close(); return; }
 const FPS=24, dtms=1000/FPS; let n=0; const log=[];
 fs.mkdirSync('frames',{recursive:true}); if(!process.env.START){}
 const START=+(process.env.START||0);
 const shoot=async(ms)=>{ const k=Math.round(ms/dtms); for(let i=0;i<k;i++){ await p.clock.runFor(dtms); if(n<START){ n++; continue; } await p.evaluate(()=>{ for(const a of document.getAnimations()){ if(a.__st===undefined){ a.__st=performance.now(); a.pause(); } a.currentTime=performance.now()-a.__st; } }); await p.screenshot({path:`frames/f${String(n++).padStart(5,'0')}.jpg`,type:'jpeg',quality:88}); } };
 const mv=async(from,to,hold)=>{ log.push([n/FPS,from,to]); await p.evaluate(([a,c])=>{ window.__v().doMove({from:a,to:c}); },[from,to]); await shoot(hold); };
 await shoot(1500);
 await mv('e2','e4',1300); await mv('e7','e5',1300);
 await mv('f1','c4',2200); await p.evaluate(()=>{document.querySelector('#vidTitle .l2').textContent='Russia is not paying attention …';});
 await mv('b8','c6',2000);
 await mv('d1','h5',1900); await mv('g8','f6',1700);
 await p.evaluate(()=>{document.getElementById('vidTitle').style.display='none';});
 await p.evaluate(()=>window.__v().setCaric(true)); await mv('h5','f7',13500);
 await p.evaluate(()=>{document.getElementById('vidEnd').style.display='flex';});
 await shoot(2500);
 fs.writeFileSync('moves.json',JSON.stringify(log));
 console.log('frames',n); await b.close();
})();
