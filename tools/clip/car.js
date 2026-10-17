/* Video-only gag: a white flying sports car (no logo) replaces one side's knights. It hops with compressed-air puffs
   and does a full roll in the air. Enabled by window.__car = 'w' or 'b'. */
function makeCar(color){
  const g=new T.Group(), body=new T.Group(); g.add(body);
  const white=new T.MeshStandardMaterial({color:0xeceae6,roughness:.28,metalness:.15});
  const glass=new T.MeshStandardMaterial({color:0x2b2018,roughness:.08,metalness:.4});
  const dark=new T.MeshStandardMaterial({color:0x14161a,roughness:.5,metalness:.2});
  const steel=new T.MeshStandardMaterial({color:0xc9ccd2,roughness:.22,metalness:.9});
  const prof=(pts,depth,m,x0)=>{ const s=new T.Shape(); s.moveTo(pts[0][0],pts[0][1]); pts.slice(1).forEach(p=>s.lineTo(p[0],p[1]));
    const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2});
    const me=new T.Mesh(geo,m); me.rotation.y=Math.PI/2; me.position.x=x0; me.castShadow=true; return me; };
  // side profile in (z, y): nose at -z (forward for white), low wedge, long glass canopy
  body.add(prof([[.46,.07],[.47,.2],[.22,.25],[-.2,.23],[-.44,.16],[-.5,.1],[-.47,.07]],.46,white,-.23));
  body.add(prof([[.24,.235],[.16,.305],[-.04,.318],[-.24,.228]],.36,glass,-.18));
  const skirt=new T.Mesh(new T.BoxGeometry(.42,.05,.9),dark); skirt.position.set(0,.065,0); body.add(skirt);
  const bar=new T.Mesh(new T.BoxGeometry(.4,.012,.012),new T.MeshBasicMaterial({color:0xffffff})); bar.position.set(0,.165,-.495); body.add(bar);
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const w=new T.Mesh(new T.CylinderGeometry(.1,.1,.07,18),dark); w.rotation.z=Math.PI/2; w.position.set(sx*.235,.1,sz*.29); body.add(w);
    const hub=new T.Mesh(new T.CylinderGeometry(.06,.06,.075,12),steel); hub.rotation.z=Math.PI/2; hub.position.copy(w.position); body.add(hub);
  }
  for(const sx of [-1,1]) for(let i=0;i<4;i++){ // side nozzles under the doors
    const n=new T.Mesh(new T.CylinderGeometry(.028,.034,.07,12,1,true),steel); n.rotation.z=Math.PI/2; n.position.set(sx*.26,.07,-.08+i*.075); body.add(n); }
  for(const sx of [-1,1]){ const n=new T.Mesh(new T.CylinderGeometry(.035,.04,.08,12,1,true),steel); n.rotation.x=Math.PI/2; n.position.set(sx*.13,.1,.5); body.add(n); }
  // it hovers on four downward air jets: nozzles, flickering plumes and a steady stream of little puffs
  const plume=new T.MeshBasicMaterial({color:0xe8f4ff,transparent:true,opacity:.45,depthWrite:false});
  const jets=[];
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const n=new T.Mesh(new T.CylinderGeometry(.04,.03,.05,12,1,true),steel); n.position.set(sx*.16,.035,sz*.25); body.add(n);
    const c=new T.Mesh(new T.ConeGeometry(.07,.2,14,1,true),plume); c.position.set(sx*.16,-.08,sz*.25); body.add(c); jets.push(c);
  }
  const ud={type:'n',color,car:true,phase:Math.random()*6.28,float:body,floatY:.16};
  g.userData=ud;
  let seen=false, last=0, wp=new T.Vector3();
  (function jetLoop(){
    if(g.parent) seen=true; else if(seen) return;
    const now=performance.now();
    jets.forEach((c,i)=>{ c.scale.set(1,.8+Math.random()*.5,1); c.material.opacity=.3+Math.random()*.25; });
    if(g.parent&&now-last>90){ last=now; jets.forEach(c=>{ c.getWorldPosition(wp); wp.y=Math.max(.02,wp.y-.12); carPuff(wp,.45); }); }
    requestAnimationFrame(jetLoop);
  })();
  if(color==='b') g.rotation.y=Math.PI;
  return g;
}
function carPuff(p,size){ // a white compressed-air puff that grows, drifts outward and fades
  const m=new T.Mesh(new T.SphereGeometry(.09*(size||1),10,8),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,depthWrite:false}));
  const dx=(Math.random()-.5)*.012, dz=(Math.random()-.5)*.012;
  m.position.copy(p); scene.add(m); const t0=performance.now();
  (function grow(){ const k=(performance.now()-t0)/700; if(k>=1){ scene.remove(m); return; }
    m.scale.setScalar(1+k*3); m.material.opacity=.75*(1-k); m.position.x+=dx; m.position.z+=dz; requestAnimationFrame(grow); })();
}
function carFlip(piece,to){
  const a=piece.position.clone(), b=sqPos(to), H=1.5, rot0=piece.rotation.y;
  const head=headingFor(piece,b.x-a.x,b.z-a.z), body=piece.children[0]; let lastPuff=0;
  piece.rotation.order='YXZ';
  const done=animate(1.5,t=>{
    let y, k=0;
    if(t<.2){ const e=ease(t/.2); y=H*.5*e; piece.position.set(a.x,y,a.z); piece.rotation.y=rot0+angDiff(rot0,head)*e; }
    else if(t<.82){ const p=(t-.2)/.62, e=ease(p); y=H*.5+Math.sin(p*Math.PI)*H*.6; piece.position.set(a.x+(b.x-a.x)*e,y,a.z+(b.z-a.z)*e); k=e; }
    else { const p=(t-.82)/.18; y=H*.5*(1-p*p); piece.position.set(b.x,y,b.z); piece.rotation.y=head+angDiff(head,rot0)*p; }
    body.rotation.z=Math.PI*2*k; // the kickflip: one full roll around its own length axis
    if((t<.25||t>.78)&&performance.now()-lastPuff>60){ lastPuff=performance.now(); const w=piece.position.clone(); w.y=Math.max(.05,w.y-.05); carPuff(w); }
  }).then(()=>{ body.rotation.z=0; piece.rotation.y=rot0; });
  return {done, hitAt:1250};
}
