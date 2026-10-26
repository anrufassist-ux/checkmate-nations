// clean dramatic plates for the Excalibur video: PLATE=1..5, writes test.png (1080x1920 with HD=1)
const FEN={
  1:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  2:'rn2kbnr/ppp1pppp/8/8/6b1/2P5/PP1PPP1P/R1BQKBNq w Qkq - 0 5',
  3:'rn2kbnr/ppp1pppp/8/8/6b1/2P2P2/PP1PP2P/R1BQKBq1 w Qkq - 0 6',
  4:'rn2kbnr/p1p1pppp/8/1p6/6PP/2P3q1/PP1PP3/R1BQKB2 w Qkq - 1 8',
};
// camera: target x,z then offset x,y,z (board: a1 = (-3.5,3.5), h8 = (3.5,-3.5))
const CAM={ 1:[0,-2.6, 0,1.6,-4.6], 2:[3.2,3.2, -1.6,2.0,3.2], 3:[2.4,3.4, -1.4,2.0,3.4], 4:[1.6,2.2, -2.2,3.4,4.6] };
module.exports=async(p)=>{
  const K=+process.env.PLATE;
  await p.addStyleTag({content:'#vidTitle,#banner,#vidHook,#vidBadges{display:none!important}'});
  if(K<=4){ await p.evaluate(([fen,c])=>{ const v=window.__v(), T=v.T; v.game.load(fen); v.setupPieces();
      v.controls.target.set(c[0],.35,c[1]); v.camera.position.set(c[0]+c[2],.35+c[3],c[1]+c[4]); v.camera.lookAt(v.controls.target); v.controls.update(); },[FEN[K],CAM[K]]);
    await p.clock.runFor(400); return; }
  // 5: the AI's mate, Trump goes to jail; close-up from a bit above
  await p.evaluate(()=>{ const v=window.__v(); v.game.load('rn2kbnr/p1p1pppp/8/1p6/6PP/2P5/PP1PP3/R1BQKBq1 b Qkq h3 0 7'); v.setupPieces(); v.doMove({from:'g1',to:'g3'}); });
  for(let i=0;i<300;i++) await p.clock.runFor(40);
  await p.evaluate(()=>{ const v=window.__v(), T=v.T; // the jailed king's head is the one furthest from the board centre (the cell stands next to the board)
    const hs=[]; v.scene.traverse(o=>{ if(o.userData&&o.userData.head){ const q=new T.Vector3(); o.userData.head.getWorldPosition(q); hs.push(q); } });
    const hp=hs.sort((a,b)=>Math.hypot(b.x,b.z)-Math.hypot(a.x,a.z))[0]; v.controls.target.copy(hp).add(new T.Vector3(0,.05,0));
    v.camera.position.copy(hp).add(new T.Vector3(0,2.2,3.6)); v.camera.lookAt(v.controls.target); });
  await p.clock.runFor(200);
};
