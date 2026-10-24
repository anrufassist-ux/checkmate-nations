// TikTok puzzle carousels, laid out for the TikTok photo safe zone. PZ=<key> SLIDE=1|2|3 CAM="tx,tz,H,D"
const PZ={
  fra:{fen:'6rk/pp4pp/8/6N1/8/8/PP3PPP/6K1 w - - 0 1',pre:'6rk/pp4pp/8/6N1/8/8/PP3PPP/6K1 w - - 0 1',mate:['g5','f7'],post:'6rk/pp3Npp/8/8/8/8/PP3PPP/6K1 b - - 1 1',hl:[['g5','y'],['f7','g'],['h8','r']],badge:['f7','!!','g'],
    t:'MATE IN 1 🧩',s:'France to move 🇫🇷',sol:'Drone to f7: checkmate! 🎯',why:'Smothered: his own pieces block the king'},
  usa:{fen:'5rk1/pp3ppp/8/7Q/8/3B4/PP3PPP/6K1 w - - 0 1',pre:'5rk1/pp3ppp/8/7Q/8/3B4/PP3PPP/6K1 w - - 0 1',mate:['h5','h7'],post:'5rk1/pp3ppQ/8/8/8/3B4/PP3PPP/6K1 b - - 0 1',hl:[['h5','y'],['h7','g'],['g8','r']],badge:['h7','!','b'],
    t:'MATE IN 1 🧩',s:'USA to move 🇺🇸',sol:'Queen takes h7: checkmate! 🎯',why:'The jet on d3 protects the queen'},
  ger:{fen:'5r1k/pp4pp/7N/3Q4/8/8/PP4PP/6K1 w - - 0 1',pre:'6rk/pp4pp/7N/8/8/8/PP4PP/6K1 w - - 0 1',mate:['h6','f7'],post:'6rk/pp3Npp/8/8/8/8/PP4PP/6K1 b - - 1 2',hl:[['h6','y'],['f7','g'],['h8','r']],badge:['f7','!!','g'],
    t:'MATE IN 2 🧩',s:'Germany to move 🇩🇪',sol:'1. Queen g8+!! Rook takes',why:'2. Drone f7: checkmate! 🎯'},
};
module.exports=async(p)=>{
  const S=+process.env.SLIDE, K=process.env.PZ, z=PZ[K], cam=(process.env.CAM||'.55,-.35,24,16.5').split(',').map(Number);
  await p.addStyleTag({content:`#vidTitle,#banner{display:none!important}
    .st{position:fixed;left:0;right:0;text-align:center;z-index:60;pointer-events:none}
    .st.t{top:23%;font:400 54px/1 'Black Ops One',sans-serif;color:#fff;text-shadow:0 3px 0 #000,0 0 14px rgba(0,0,0,.8)}
    .st span{display:inline-block;font:400 28px/1.2 'Black Ops One',sans-serif;color:#ffd447;background:rgba(10,12,14,.85);border:3px solid #e8d9a8;border-radius:14px;padding:8px 18px}
    .st.s{top:29.5%}.st.b1{top:72%}.st.b2{top:77.5%}.st.b2 span{font-size:22px}`});
  await p.evaluate(([z,S,cam])=>{ const v=window.__v(), add=(c,h)=>{ const e=document.createElement('div'); e.className='st '+c; e.innerHTML=h; document.body.appendChild(e); };
    if(S<3){ v.game.load(S===1?z.fen:z.post); v.setupPieces();
      add('t',S===1?z.t:'SOLUTION ✅'); add('s','<span>'+z.s+'</span>');
      add('b1','<span>'+(S===1?'Comment your move 👇':z.sol)+'</span>'); add('b2','<span>'+(S===1?'Solution on the next slide 👉':z.why)+'</span>');
      const [tx,tz,H,D]=cam; v.controls.target.set(tx,0,tz); v.camera.position.set(tx,H,tz+D); v.camera.lookAt(v.controls.target); v.controls.update(); }
    else { v.game.load(z.pre); v.setupPieces(); }
  },[z,S,cam]);
  if(S<3){ if(S===2){ 
      await p.evaluate(z=>{ const v=window.__v(), T=v.T;
        // last move yellow, the good move green, the mated king red; badge in the move-rating style (!! brilliant, ! great)
        const COL={y:[0xf7e35a,.6],g:[0x5fd35a,.6]};
        z.hl.forEach(([sq,k])=>{ let mat;
          if(k==='r'){ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'), gr=g.createRadialGradient(64,64,8,64,64,70);
            gr.addColorStop(0,'rgba(255,40,40,1)'); gr.addColorStop(1,'rgba(255,40,40,.2)'); g.fillStyle=gr; g.fillRect(0,0,128,128);
            mat=new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,opacity:.9,depthWrite:false,toneMapped:false}); }
          else mat=new T.MeshBasicMaterial({color:COL[k][0],transparent:true,opacity:COL[k][1],depthWrite:false,toneMapped:false});
          const m=new T.Mesh(new T.PlaneGeometry(1,1),mat); m.rotation.x=-Math.PI/2; const q=v.sqPos(sq); m.position.set(q.x,.004,q.z); v.scene.add(m); });
        const [sq,txt,k]=z.badge, bb=new T.Box3().setFromObject(v.pieces()[sq]), q=new T.Vector3((bb.min.x+bb.max.x)/2,bb.max.y,(bb.min.z+bb.max.z)/2).project(v.camera);
        const e=document.createElement('div'); e.textContent=txt;
        e.style.cssText='position:fixed;z-index:61;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 28px/1 Barlow,Arial,sans-serif;letter-spacing:-2px;color:#fff;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.5);background:'+({g:'#3fbf6a',b:'#4f8fe0'}[k]);
        e.style.left=Math.min(innerWidth-30,(q.x+1)/2*innerWidth+26)+'px'; e.style.top=((1-q.y)/2*innerHeight-22)+'px'; document.body.appendChild(e); },z); }
    await p.clock.runFor(400); return; }
  await p.evaluate(m=>{ window.__v().doMove({from:m[0],to:m[1]}); },z.mate);
  for(let i=0;i<300;i++) await p.clock.runFor(40);
  await p.evaluate(()=>{ const add=(c,h)=>{ const e=document.createElement('div'); e.className='st '+c; e.innerHTML=h; document.body.appendChild(e); };
    add('t','OFF TO JAIL! 🚔'); add('b1','<span style="font-size:23px">Play free 👉 checkmatenations.com</span>'); add('b2','<span>No download · right in your browser</span>'); });
  await p.clock.runFor(200);
};
