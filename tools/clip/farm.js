/* Video-only gag (clip "farm"): French farmers in green overalls replace one side's pawns, their king sits on a tractor
   with a big golden crown. Enabled by window.__farm = 'w' or 'b'. */
// video special "French farmers": farmer pawns with straw hats and a farmer-king on a little tractor
function buildFarmer(){
  const g=new T.Group(), blue=mat(0x3f7d3a,.6), red=mat(0xd62828,.5), straw=mat(0xe6c36f,.75), skin=mat(SKIN,.55), dark=mat(0x2b2b2b,.6), bread=mat(0xd9a352,.7);
  g.add(mesh(new T.CylinderGeometry(.12,.16,.34,16),blue,0,.2,0));                                 // blue work jacket (bleu de travail)
  g.add(mesh(new T.CylinderGeometry(.16,.165,.04,16),dark,0,.03,0));                                // boots / base
  const scarf=mesh(new T.TorusGeometry(.085,.022,8,20),red,0,.37,0); scarf.rotation.x=Math.PI/2; g.add(scarf); // red neckerchief
  const head=new T.Group(); head.position.y=.48;
  head.add(mesh(new T.SphereGeometry(.11,18,14),skin));
  const brim=mesh(new T.CylinderGeometry(.2,.2,.015,24),straw,0,.07,0); head.add(brim);           // straw hat
  head.add(mesh(new T.CylinderGeometry(.09,.105,.09,20),straw,0,.115,0));
  const band=mesh(new T.CylinderGeometry(.106,.106,.025,20),red,0,.085,0); head.add(band);
  const tache=mesh(new T.CylinderGeometry(.016,.016,.09,8),mat(0x5a3a22,.6),0,-.02,.1); tache.rotation.z=Math.PI/2; tache.scale.set(1,1,.45); head.add(tache); // moustache
  for(const s of [-1,1]) head.add(mesh(new T.SphereGeometry(.014,8,6),dark,s*.04,.025,.1));
  g.add(head);
  const bag=mesh(new T.CylinderGeometry(.025,.025,.36,10),bread,.15,.26,.03); bag.rotation.z=.5; g.add(bag); // baguette under the arm
  return {g,head,headY:.48};
}
function buildTractorKing(){
  const g=new T.Group(), body=mat(0xd62828,.45,.2), tyre=mat(0x1c1c1c,.8), rim=mat(0xf2c230,.4,.3), blue=mat(0x2a5fb8,.6), straw=mat(0xe6c36f,.75), skin=mat(SKIN,.55), gold=mat(0xe0b440,.25,.85), steel=mat(0x9aa0a8,.35,.7);
  g.add(mesh(new T.BoxGeometry(.22,.16,.42),body,0,.2,.05));                                         // hood and chassis
  const ex=mesh(new T.CylinderGeometry(.018,.018,.18,8),steel,.07,.36,.18); g.add(ex);                // exhaust
  for(const s of [-1,1]){
    const rw=mesh(new T.CylinderGeometry(.17,.17,.1,24),tyre,s*.18,.17,-.12); rw.rotation.z=Math.PI/2; g.add(rw); // big rear wheels
    const rr=mesh(new T.CylinderGeometry(.09,.09,.105,16),rim,s*.18,.17,-.12); rr.rotation.z=Math.PI/2; g.add(rr);
    const fw=mesh(new T.CylinderGeometry(.09,.09,.08,18),tyre,s*.14,.09,.23); fw.rotation.z=Math.PI/2; g.add(fw); // small front wheels
    const fr=mesh(new T.CylinderGeometry(.045,.045,.085,12),rim,s*.14,.09,.23); fr.rotation.z=Math.PI/2; g.add(fr);
  }
  g.add(mesh(new T.BoxGeometry(.16,.05,.14),mat(0x222222,.7),0,.3,-.12));                            // seat
  // the farmer-king at the wheel: green overalls, red royal cape and a big golden crown (no straw hat) so he reads as the king
  const green=mat(0x3f7d3a,.6), cape=mat(0xb3121e,.55), ruby=mat(0xd0102a,.25,.2);
  g.add(mesh(new T.CylinderGeometry(.085,.11,.24,14),green,0,.44,-.12));
  const cp=mesh(new T.CylinderGeometry(.1,.15,.3,16,1,true,Math.PI*.55,Math.PI*.9),cape,0,.42,-.125); cp.material.side=T.DoubleSide; g.add(cp);
  const wheel=mesh(new T.TorusGeometry(.05,.01,6,16),tyre,0,.46,-.02); wheel.rotation.x=-.9; g.add(wheel);
  const head=new T.Group(); head.position.set(0,.66,-.12);
  head.add(mesh(new T.SphereGeometry(.105,18,14),skin));
  const cr=new T.Group(); cr.position.y=.09; cr.add(mesh(new T.CylinderGeometry(.1,.095,.07,20),gold));
  for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; cr.add(mesh(new T.ConeGeometry(.024,.08,6),gold,Math.sin(a)*.095,.07,Math.cos(a)*.095)); cr.add(mesh(new T.SphereGeometry(.014,8,6),ruby,Math.sin(a)*.1,.0,Math.cos(a)*.1)); }
  cr.add(mesh(new T.SphereGeometry(.018,8,6),ruby,0,.11,0));
  head.add(cr);
  const tache=mesh(new T.CylinderGeometry(.016,.016,.09,8),mat(0x5a3a22,.6),0,-.02,.095); tache.rotation.z=Math.PI/2; tache.scale.set(1,1,.45); head.add(tache);
  for(const s of [-1,1]) head.add(mesh(new T.SphereGeometry(.014,8,6),mat(0x2b2b2b,.6),s*.037,.025,.094));
  g.add(head);
  return {g,head,headY:.66};
}
function makeFarmPiece(type,color){
  const {g,head,headY}=type==='k'?buildTractorKing():buildFarmer();
  if(type==='k') g.scale.setScalar(1.2);
  g.rotation.y=color==='w'?Math.PI:0; // face the other side, like every piece
  g.userData={type,color,phase:Math.random()*6.28,head,headY,farm:true};
  g.traverse(o=>{ if(o.isMesh) o.userData.owner=g; });
  return g;
}
