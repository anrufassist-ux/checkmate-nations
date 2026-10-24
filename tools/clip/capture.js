const {chromium}=require(process.env.PW||'playwright-core');
const fs=require('fs'), http=require('http'), path=require('path');
const ROOT=path.join(__dirname,'../..');
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const MODE=process.argv[2]||'test';
const sub=(p,t)=>p.evaluate(t=>{document.querySelector('#vidTitle .l2').textContent=t;},t);
// a short text pops up and stays put until the next one: centred on a square (pick an empty one next to the action),
// or without a square in the free space below the board
const pop=(p,t,sq)=>p.evaluate(([t,sq])=>{ const old=document.getElementById('vidPop'); if(old) old.remove(); if(!t) return;
  const v=window.__v(), q=sq?v.sqPos(sq).project(v.camera):{x:0,y:-.7}, e=document.createElement('div'); e.id='vidPop'; e.innerHTML='<span>'+t+'</span>';
  e.style.top=((1-q.y)/2*innerHeight)+'px'; document.body.appendChild(e);
  const w=e.firstChild.offsetWidth, x=Math.max(w/2+10,Math.min(innerWidth-w/2-10,(q.x+1)/2*innerWidth)); e.style.left=x+'px'; },[t,sq]);
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
  const c1=new T3(f.x+(side??.18)*dist,f.y+h,f.z+dist), c0=v.camera.position.clone(), t0=v.controls.target.clone(), s=performance.now();
  v.controls.minDistance=.2;
  (function step(){ const u=Math.min(1,(performance.now()-s)/ms), e=(1-Math.cos(Math.PI*u))/2;
    v.controls.target.lerpVectors(t0,f,e); v.camera.position.lerpVectors(c0,c1,e); v.camera.lookAt(v.controls.target); if(u<1) requestAnimationFrame(step); })(); },[focus,dist,h,lift,ms,side]);
// Chess check for every script (also run before each render): every move legal, the clip ends in checkmate
// (unless end:'open'), and a warning when the king is stuck and only one or two other moves (<= 4) avoid stalemate, because
// viewers who do not see that move think it is stalemate (the drones clip had exactly that: the a-pawn was out of frame)
function checkScript(name,sc){
  const src=fs.readFileSync(path.join(ROOT,'vendor/chess-0.10.3.js'),'utf8'), m={exports:{}}; new Function('module','exports',src)(m,m.exports);
  const Chess=m.exports.Chess||m.exports, c=new Chess(sc.fen||undefined), errs=[], warns=[], shown=new Set(sc.shown||[]);
  const mv=async(from,to)=>{
    if(!c.move({from,to,promotion:'q'})){ errs.push('illegal move '+from+to+' in '+c.fen()); return; }
    if(c.game_over()) return;
    const king=c.moves({verbose:true}).filter(x=>x.piece==='k');
    if(!king.length&&!c.in_check()&&c.moves().length<=4&&!shown.has(from+to)) warns.push('after '+from+to+' only non-king moves avoid stalemate ('+c.moves().join(' ')+'): film that move, then add "'+from+to+'" to shown');
  };
  const p={evaluate:async()=>{}}, shoot=async()=>{};
  return sc.play(mv,p,shoot).then(()=>{
    if(c.in_stalemate()) errs.push('ends in STALEMATE, not checkmate');
    else if(sc.end!=='open'&&!c.in_checkmate()) errs.push('does not end in checkmate ('+c.fen()+')');
    return {name,errs,warns};
  });
}
// puzzle helpers: classic symbols (cburnett set from the game) floating above every piece, and a legend that maps our
// pieces (photographed by the game's own pieceShot) to the classic ones, so chess players read the position at once
const badges=(p,on)=>p.evaluate(on=>{ const box=document.getElementById('vidBadges'); box.style.display=on?'block':'none';
  if(!on){ window.__badgeTick=null; return; }
  const v=window.__v(), url=k=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(v.CBURNETT[k]);
  window.__badgeTick=()=>{ box.textContent=''; const b=v.game.board(), T3=v.camera.position.constructor;
    const heads=[]; Object.entries(v.pieces()).forEach(([sq,g])=>{ const hd=g&&g.userData&&g.userData.head; if(!hd) return;
      const bb=new v.T.Box3().setFromObject(hd), pts=[]; for(const x of [bb.min.x,bb.max.x]) for(const y of [bb.min.y,bb.max.y]) for(const z of [bb.min.z,bb.max.z]) pts.push(new T3(x,y,z).project(v.camera));
      const xs=pts.map(q=>(q.x+1)/2*innerWidth), ys=pts.map(q=>(1-q.y)/2*innerHeight); heads.push([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys),sq]); });
    for(let r=0;r<8;r++) for(let f=0;f<8;f++){ const pc=b[r][f]; if(!pc) continue; const sq='abcdefgh'[f]+(8-r);
      // small, inside the front right corner of the square: about a third of the square's width on screen
      const c=v.sqPos(sq), w=c.clone().add(new T3(.33,.02,.33)).project(v.camera), l=c.clone().add(new T3(-.5,0,.5)).project(v.camera), rr=c.clone().add(new T3(.5,0,.5)).project(v.camera);
      const px=Math.max(14,Math.min(21,(rr.x-l.x)/2*innerWidth*.38));
      // behind caricature heads: skip the symbol where a head in front of it covers it
      const sx=(w.x+1)/2*innerWidth, sy=(1-w.y)/2*innerHeight;
      if(heads.some(h=>sx>h[0]-px/2&&sx<h[2]+px/2&&sy>h[1]-px/2&&sy<h[3]+px/2&&h[4]!==sq)) continue;
      const im=document.createElement('img'); im.style.width=im.style.height=px+'px'; im.src=url(pc.color+pc.type.toUpperCase()); im.style.filter=pc.color==='b'?'drop-shadow(0 0 2px #fff) drop-shadow(0 0 1px #fff)':'drop-shadow(0 0 2px rgba(0,0,0,.8))';
      im.style.left=((w.x+1)/2*innerWidth)+'px'; im.style.top=((1-w.y)/2*innerHeight)+'px'; box.appendChild(im); } };
  window.__badgeTick(); },on);
const legend=(p,on)=>p.evaluate(on=>{ const el=document.getElementById('vidLegend'); el.style.display=on?'flex':'none'; if(!on) return;
  const v=window.__v(), cl=k=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(v.CBURNETT[k]);
  el.innerHTML=''; for(const [t,name] of [['r','Rook'],['n','Knight'],['b','Bishop']]){
    const row=document.createElement('div'); row.className='row';
    const our=document.createElement('img'); our.className='our'; our.src=v.pieceShot(t,'w').image.toDataURL();
    row.append(our,Object.assign(document.createElement('span'),{className:'eq',textContent:'='}));
    const c=document.createElement('img'); c.className='cl'; c.src=cl('w'+t.toUpperCase()); row.append(c,Object.assign(document.createElement('span'),{textContent:name}));
    el.appendChild(row); } },on);
// Camera language for clips (keep every clip calm and readable):
//  1. establishing shot: the whole area of the action fills the frame, no empty table around it
//  2. chase: when a piece makes the key move, the camera rides behind it (chase(p,…) as the 4th argument of mv)
//  3. push-in: once the action is in one corner, glide in slowly; a second, closer push-in for the mate
//  4. every camera move takes at least ~2 s (eased); no cuts back and forth without a reason
// chase: camera behind the moving piece (seen from its own side), low and slightly to the side, looking where it drives;
// `ease` blends in from the current camera over the first part of the move so it never jumps
const chase=(p,{back=2.2,h=1.1,side=.5,ahead=2.6,ease=.25}={})=>(u,to)=>p.evaluate(([u,to,back,h,side,ahead,ease])=>{
  const v=window.__v(), m=window.__mover; if(!m) return; // the game re-files the piece only after the move
  const T3=v.camera.position.constructor;
  const w=m.getWorldPosition(new T3()), dir=m.userData.color==='w'?-1:1; // white drives toward -z
  const cam=new T3(w.x+side,w.y+h,w.z-dir*back), tgt=new T3(w.x,w.y+.35,w.z+dir*ahead);
  if(!window.__ch||u===0){ window.__ch={c0:v.camera.position.clone(),t0:v.controls.target.clone()}; }
  const k=Math.min(1,u/ease), e=(1-Math.cos(Math.PI*k))/2, c=window.__ch;
  v.camera.position.lerpVectors(c.c0,cam,e); v.controls.target.lerpVectors(c.t0,tgt,e); v.camera.lookAt(v.controls.target);
  if(u>=1) window.__ch=null; },[u,to,back,h,side,ahead,ease]);
// compact: title hidden, the caption box goes wherever it covers no piece (checked every frame against the pieces' screen
// boxes; first free slot of top, bottom, lower middle, upper middle), gliding there when it has to move
const compact=(p,on)=>p.evaluate(on=>{ document.body.classList.toggle('compact',on); if(!on){ window.__capTick=null; return; }
  const v=window.__v(), el=document.querySelector('#vidTitle .l2'), T3=v.camera.position.constructor;
  window.__capTick=()=>{ if(!el.textContent||document.getElementById('vidTitle').style.display==='none') return;
    const H=innerHeight, h=el.offsetHeight+16, boxes=[], b=v.game.board(), proj=q=>q.project(v.camera);
    for(let r=0;r<8;r++) for(let f=0;f<8;f++){ const pc=b[r][f]; if(!pc) continue; const c=v.sqPos('abcdefgh'[f]+(8-r));
      const top=proj(c.clone().add(new T3(0,pc.type==='k'||pc.type==='q'?2.0:1.4,0))), bot=proj(c.clone().add(new T3(0,0,.45)));
      boxes.push([(1-top.y)/2*H,(1-bot.y)/2*H]); }
    const free=y=>boxes.every(([a,z])=>z<y||a>y+h);
    const cur=parseFloat(el.style.top)||H*.03; if(free(cur)) return;
    for(const f of [.03,.8,.66,.5,.36,.2]){ const y=H*f; if(free(y)){ el.style.top=y+'px'; return; } } };
  window.__capTick(); },on);
const SCRIPTS={
 scholar:{title:[VS,'Checkmate in 4 moves?'],play:async(mv,p)=>{ // USA mates Russia, Putin cries
   await mv('e2','e4',1300); await mv('e7','e5',1300);
   await mv('f1','c4',2200); await sub(p,'Russia is not paying attention …');
   await mv('b8','c6',2000); await mv('d1','h5',1900); await mv('g8','f6',1700);
   await hideTitle(p); await mv('h5','f7',13500); }},
 // Russia (white) mates the lone German king with two drones and Putin: Kg6, Nf6, Nf7#
 drones:{nations:['rus','ger'],shown:['d5f6'],fen:'6k1/p7/8/3NNK2/8/8/8/8 w - - 0 1',
   hook:'CAN GERMANY<br>ESCAPE? 😬',
   title:['<span class="r">RUSSIA</span> vs. <span style="color:#ffce00">GERMANY</span>','Two drones and Putin …'],play:async(mv,p,shoot)=>{
   await orbit(p,shoot,8400,['f6','g6','h8','e5'],.55);
   await mv('f5','g6',1700); await mv('g8','h8',1500); await sub(p,'Germany has nowhere to run');
   await mv('d5','f6',1700);
   // the German king is stuck now; only the a-pawn can still move, so it must be in the picture (else it looks like stalemate)
   await sub(p,'Only one German pawn can still move …'); await look(p,['a7','a6'],.6,1200); await shoot(1300);
   await mv('a7','a6',1500); await look(p,['f6','g6','h8','e5'],.55,1200); await shoot(1300);
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
   await mv('h4','h5',1800);
   // Macron's side moves far away on the queenside: pull back so his army and every move of it is in the picture
   await sub(p,'Macron: busy at a concert 🎤'); await look(p,['d6','e6'],1.05,1300); await shoot(1400); await mv('c6','c5',1900);
   await sub(p,'His army? Far away …'); await mv('h5','h6',1900); await mv('c5','c4',1900);
   await look(p,['h7','g6','g8','e5'],.6,1300); await shoot(1300);
   await hideTitle(p); await mv('h6','h7',16000); }},
 // "Meet the nations": France joins (camera along the French pieces, queen and king close up, then a first jet flight vs UK)
 welcome_fra:{nations:['fra','gbr'],end:'open',hook:'FRANCE HAS<br>ENTERED THE CHAT 🇫🇷',
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
   await sub(p,'France vs. UK · round 1,000? 👇'); await fly(p,['d4','e4','d5','e5'],8.2,8.6,0,1600,.02); await shoot(1700);
   await mv('e2','e4',1300); await mv('e7','e5',1300); await mv('f1','c4',3000); }},
 welcome_ger:{nations:['ger','fra'],end:'open',hook:'GERMANY HAS<br>ENTERED THE CHAT 🇩🇪',
   title:['<span style="font-size:.8em"><span style="color:#ffce00">GERMANY</span> vs. <span style="color:#7ea6ff">FRANCE</span></span>','Germany joins Checkmate Nations'],play:async(mv,p,shoot)=>{
   // one piece type after the other: glide in slowly (1.3 s), hold (1.6 s), name tag as subtitle
   const stop=async(text,focus,dist,h,lift,side)=>{ await sub(p,text); await fly(p,focus,dist,h,lift,1300,side); await shoot(2900); };
   // infantry first, seen from the far side (the back rank would hide them from the front), then up and over to the front
   await stop('Infantry 🇩🇪',['c2','d2','e2'],-2.2,.95,.32,.25);
   await fly(p,['d3'],2.6,6.2,0,1200); await shoot(1000);
   await stop('Tanks',['a1'],1.75,.85,.3,.35);
   await stop('Drones',['b1'],1.65,.9,.38,.35);
   await stop('Fighter jets',['c1'],1.75,.9,.35,.45);
   await stop('Queen: a German shepherd in a dirndl 🍺',['d1'],1.45,.7,.5,.3);
   await stop('King: Merz, the chancellor',['e1'],1.55,.6,.78,.25);
   await sub(p,'Germany vs. France · who wins? 👇'); await fly(p,['d4','e4','d5','e5'],8.2,8.6,0,1600,.02); await shoot(1700);
   await mv('e2','e4',1300); await mv('e7','e5',1300); await mv('f1','c4',3000); }},
 // "Can you beat the AI?": a real game against the Normal AI (the beginner's moves are scripted, every reply is what the
 // server AI played), the camera glides to every move, ends with the AI Challenge call to action
 beat_ai:{nations:['usa','rus'],board:'classic',bg:'classic',start:[['d4','e5'],11.5,16.5,0,0],hookTop:'9%',hook:'MOST PEOPLE LOSE<br>TO THIS AI 🤖',
   title:['<span class="u">YOU</span> vs. <span class="r">THE AI</span>','Normal level · can you beat it?'],play:async(mv,p,shoot)=>{
   // one calm wide shot for the whole game (every flight stays in view), texts pop up below the board
   await badges(p,true); await shoot(1200);
   const go=async(from,to,text,at,hold=1600)=>{ await mv(from,to,text?500:hold); if(text){ await pop(p,text,at); await shoot(hold); } };
   await go('g2','g4','Looks easy …',null); await go('d7','d5',null);
   await go('b1','c3','The AI waits for one mistake …',null,2000); await go('c8','g4','Pawn gone.',null);
   await go('c3','d5','Free pawn! 😏',null); await go('d8','d5','Nope. 🤖',null,1800);
   await go('c2','c3','Hmm …',null); await go('d5','h1','Tank gone 💥',null,1800);
   await go('f2','f3','Trap the queen?',null); await go('h1','g1','Another one 💥',null,1800);
   await go('f3','g4','Revenge! … right?',null); await go('b7','b5','The AI: 😐',null);
   await go('h2','h4','Almost safe …',null);
   await pop(p,''); await badges(p,false); await hideTitle(p); await fly(p,['f2','g3'],6,8.5,0,2600,0); await shoot(2700);
   await mv('g1','g3',15000);
   await p.evaluate(()=>{ const e=document.getElementById('vidHook'); e.querySelector('span').innerHTML='CAN YOU BEAT IT?<br>AI CHALLENGE 🏆'; e.style.display='block'; });
   await shoot(2600); await p.evaluate(()=>{ document.getElementById('vidHook').style.display='none'; }); }},
 // Puzzle format: Paul Morphy's famous mate in 2 (only solution 1.Ra6!! bxa6 2.b7#; any bishop move allows 2.Rxa7#)
 puzzle_morphy:{nations:['usa','rus'],board:'classic',bg:'classic',fen:'kbK5/pp6/1P6/8/8/8/8/R7 w - - 0 1',hook:'MATE IN 2 🧩<br>CAN YOU FIND IT?',
   title:[VS,"Paul Morphy's famous puzzle"],play:async(mv,p,shoot)=>{
   // establishing shot: the board fills the screen (title hidden, caption on top), the middle stays empty for the play button
   await orbit(p,shoot,7000,['a8','c8','b6'],.5);
   await compact(p,true); await fly(p,['c4','c5'],2.6,13.5,0,2200,-.05); await shoot(2400);
   await badges(p,true); await sub(p,'USA to move: mate in 2'); await shoot(2200);
   await sub(p,'Comment your move 👇'); await shoot(1800);
   for(const n of [5,4,3,2,1]){ await sub(p,'⏳ '+n); await shoot(1000); }
   // chase: the camera rides behind the tank up the a-file
   await sub(p,'Rook to a6!! 🤯'); await mv('a1','a6',3200,chase(p));
   // the action is in one corner now: slow push-in on it
   await sub(p,'A quiet sacrifice …'); await fly(p,['b5','b6'],3.6,6.5,0,2400,.1); await shoot(2600);
   await sub(p,'Bishop moves? Rxa7 mate'); await shoot(2200);
   await sub(p,'Russia takes the rook …'); await mv('b7','a6',2400);
   // second, closer push-in for the mate
   await sub(p,'Pawn to b7 …'); await fly(p,['b6','b7'],3.2,5.5,0,2200,.1); await shoot(2400);
   await badges(p,false); await hideTitle(p); await mv('b6','b7',16000); }},


 // Puzzle: back-rank mate in 1 (only solution 1.Rd8#: the king is walled in by its own pawns, the queen on a7 cannot help)
 puzzle_backrank:{nations:['usa','rus'],board:'classic',bg:'earth',fen:'6k1/q4ppp/8/8/6K1/8/8/3R4 w - - 0 1',coords:'inner',
   start:[['d4','e5'],12.6,18.2,0,0],hookTop:'9%',hook:'MATE IN 1 🧩<br>CAN YOU SEE IT?',
   title:[VS,'Puzzle: mate in 1'],play:async(mv,p,shoot)=>{
   // calm wide shot, texts below the board, one slow push-in before the solution
   await badges(p,true); await pop(p,'USA to move: mate in 1'); await shoot(2600);
   await pop(p,'Comment your move 👇'); await shoot(2000);
   for(const n of [5,4,3,2,1]){ await pop(p,'⏳ '+n); await shoot(1000); }
   await pop(p,'Look at the back rank … 🧱'); await fly(p,['e5','f6'],8.5,11,0,2800,0); await shoot(2600);
   await pop(p,'Rook to d8: checkmate! 🎯'); await badges(p,false); await hideTitle(p);
   await mv('d1','d8',1800); await pop(p,''); await shoot(14200); }},

 // TikTok puzzle carousels (stills only, see the clip README): nations per carousel, same look as the puzzles
 car_fra:{nations:['fra','gbr'],board:'classic',bg:'earth',coords:'inner',title:['',''],play:async()=>{}},
 car_usa:{nations:['usa','chn'],board:'classic',bg:'earth',coords:'inner',title:['',''],play:async()=>{}},
 car_ger:{nations:['ger','eu'],board:'classic',bg:'earth',coords:'inner',title:['',''],play:async()=>{}},

 // Fool's Mate as Trump's trade war: the USA ruins itself with two tariff moves, the panda queen only has to collect
 tariff:{nations:['usa','chn'],hook:"TRUMP'S TRADE WAR<br>IN 2 MOVES 😬",title:['<span class="u">USA</span> vs. <span style="color:#e0b23a">CHINA</span>','Trade war, round 1 …'],play:async(mv,p,shoot)=>{
   await orbit(p,shoot,8400,['e1','h4','e5','g4','d8'],.75);
   await sub(p,'Tariffs! 💰'); await mv('f2','f3',1700); await mv('e7','e5',1500);
   await sub(p,'MORE tariffs! 💰💰'); await mv('g2','g4',1600); await sub(p,'China: thanks 🐼'); await shoot(1500);
   await hideTitle(p); await mv('d8','h4',16000); }},
 fool:{hook:'THE FASTEST<br>CHECKMATE EVER? 😬',title:[VS,'Can the USA survive 2 moves?'],play:async(mv,p,shoot)=>{ // Russia mates the USA, Trump cries
   await orbit(p,shoot,8400,['e1','h4','e5','g4'],.7);
   await mv('f2','f3',1500); await mv('e7','e5',1500);
   await mv('g2','g4',1300); await sub(p,'Oh no …'); await shoot(1400);
   await hideTitle(p); await mv('d8','h4',16000); }},
};
(async()=>{
 if(MODE==='check'||MODE==='full'){ // never render a clip whose chess is wrong or looks wrong
   const names=MODE==='check'?Object.keys(SCRIPTS):[process.env.CLIP||'scholar']; let bad=false;
   for(const k of names){ const r=await checkScript(k,SCRIPTS[k]); console.log(k+': '+(r.errs.length||r.warns.length?'':'ok'));
     r.errs.forEach(e=>console.log('  ERROR '+e)); r.warns.forEach(w=>console.log('  WARN  '+w)); if(r.errs.length||r.warns.length) bad=true; }
   if(MODE==='check'||bad){ if(bad) process.exitCode=1; return; }
 }
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
 await p.evaluate(sc=>{ window.__sc=sc; window.__car=sc.car||null; window.__farm=sc.farm||null; },{nations:SC.nations,coords:SC.coords,hookTop:SC.hookTop,fen:SC.fen,car:SC.car,farm:SC.farm,board:process.env.TESTBOARD||SC.board,bg:process.env.TESTBG||SC.bg});
 await p.evaluate(()=>{const v=window.__v(); window.__rec=[]; v.ensureAudio(); v.setMode('video'); v.setCaric(true); const sc=window.__sc; v.setNations(...(sc.nations||['usa','rus'])); if(sc.board) v.setBoard(sc.board); if(sc.bg) v.setBackground(sc.bg); if(sc.coords==='inner') v.innerCoords(); if(sc.fen) v.game.load(sc.fen); v.setupPieces(); v.camera.position.sub(v.controls.target).multiplyScalar(.86).add(v.controls.target); v.controls.update();});
 await p.evaluate(([l1,l2])=>{ document.querySelector('#vidTitle .l1').innerHTML=l1; document.querySelector('#vidTitle .l2').textContent=l2; },SC.title);
 await new Promise(r=>setTimeout(r,4000)); // board and background textures load for real, outside the fake clock
 await p.clock.runFor(500);
 if(MODE==='test'){ if(process.env.TESTJS) await require(path.resolve(process.env.TESTJS))(p,{fly,sub,compact}); if(process.env.TESTFLY){ const a=JSON.parse(process.env.TESTFLY); await p.evaluate(()=>{ window.__ob=window.__ob||null; }); await fly(p,a[0],a[1],a[2],a[3],1,a[4]); await p.clock.runFor(200); } if(process.env.TESTCOMPACT) await p.evaluate(()=>document.body.classList.add('compact')); if(process.env.TESTBADGES) await badges(p,true); if(process.env.TESTLEGEND){ await p.clock.runFor(2000); await legend(p,true); } if(process.env.TESTSUB) await sub(p,process.env.TESTSUB); if(process.env.TESTCSS) await p.addStyleTag({content:process.env.TESTCSS}); await p.screenshot({path:'test.png'}); await b.close(); srv.close(); return; }
 const FPS=24, dtms=1000/FPS; let n=0; const log=[];
 const CL=process.env.CLIP||'scholar', FR='frames-'+CL; fs.mkdirSync(FR,{recursive:true});
 const START=+(process.env.START||0);
 const ONLY=+(process.env.ONLY||0); // re-render just the first ONLY frames (e.g. after changing the hook), keep the rest
 const t0=await p.evaluate(()=>{ window.__rec.length=0; return performance.now(); });
 const shoot=async(ms,each)=>{ const k=Math.round(ms/dtms); for(let i=0;i<k;i++){ if(each) await each(k>1?i/(k-1):1); await p.clock.runFor(dtms); if(n<START||(ONLY&&n>=ONLY)){ n++; continue; } await p.evaluate(()=>{ if(window.__badgeTick) window.__badgeTick(); if(window.__capTick) window.__capTick(); for(const a of document.getAnimations()){ if(a.__st===undefined){ a.__st=performance.now(); a.pause(); } a.currentTime=performance.now()-a.__st; } }); await p.screenshot({path:`${FR}/f${String(n++).padStart(5,'0')}.jpg`,type:'jpeg',quality:88}); } };
 // a piece is picked (select sound), then moves
 const mv=async(from,to,hold,each)=>{ log.push([n/FPS,from,to]); await p.evaluate(([a,c])=>{ window.__rec.push([performance.now()-120,'sel',.8]); window.__mover=window.__v().pieces()[a]; window.__v().doMove({from:a,to:c}); },[from,to]); await shoot(hold,each&&(u=>each(u,to))); };
 if(SC.start) await fly(p,...SC.start.slice(0,4),1,SC.start[4]);
 if(SC.hook){ // big question over the first seconds, the title appears once it is gone
   await p.evaluate(h=>{ const e=document.getElementById('vidHook'); e.querySelector('span').innerHTML=h; e.style.display='block'; if(window.__sc.hookTop) e.style.top=window.__sc.hookTop; document.getElementById('vidTitle').style.display='none'; },SC.hook);
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
