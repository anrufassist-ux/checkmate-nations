"""Builds video.html from ../../index.html: a copy of the game with hooks for scripted clip recording.
Usage: python3 make_video_page.py  ->  writes video.html next to this file (served by capture.js)."""
import os
here=os.path.dirname(os.path.abspath(__file__))
h=open(os.path.join(here,'../../index.html')).read()
def rep(a,b):
    global h
    assert a in h, 'patch anchor missing: '+a[:60]; h=h.replace(a,b,1)
rep("<head>","<head>\n<base href=\"../../\">")  # vendor/, fonts/, bg/, board/ from the repo root
rep("function setNations(w,b){","window.__v=()=>({doMove,setNations,setupPieces,setMode:m=>{mode=m;},setCaric:c=>{caricatures=c;},ensureAudio,game,camera,controls,placeCamera,sqPos});\nfunction setNations(w,b){")
# sounds are not played but logged (time, key, volume); capture.js writes them to sounds.json for the mix
rep("function playSample(k,vol){","function playSample(k,vol){\n  if(window.__rec){ if(!(window.SFX&&window.SFX[k])) return false; window.__rec.push([performance.now(),k,vol]); return true; }")
rep("function boom(big){","function boom(big){\n  if(window.__rec){ window.__rec.push([performance.now(),big?'boomBig':'boom',1]); return; }")
rep("  if(mode==='pvp'){\n    const n=","  if(mode==='video'){ busy=false; return; }\n  if(mode==='pvp'){\n    const n=")
rep("setStatus('Wähle einen Spielmodus.','w'); openModeScreen();","setStatus('Wähle einen Spielmodus.','w');")
rep("shift=new T.Vector3(side*2.6,0,0);","shift=new T.Vector3(dest.x-controls.target.x,0,dest.z-controls.target.z);")  # portrait: the camera follows the cell to where it is put down
rep("  startCrying(king);\n  wake(15000);","  startCrying(king);\n  { const hp=new T.Vector3(); king.userData.head.getWorldPosition(hp); const c1=camera.position.clone(), t1=controls.target.clone(), t2=hp.clone().add(new T.Vector3(0,.15,0)), c2=hp.clone().add(new T.Vector3(0,2.0,4.0)); $('banner').hidden=true; controls.minDistance=.5; controls.maxPolarAngle=1.6; await animate(1.8,t=>{ const e=ease(t); camera.position.copy(c1).lerp(c2,e); controls.target.copy(t1).lerp(t2,e); camera.lookAt(controls.target); }); }\n  wake(15000);")
rep("// size balance:",open(os.path.join(here,'car.js')).read()+"// size balance:")
rep("  const g=polish(makePieceRaw(type,color)), u=g.userData||{};","  const g=polish(window.__car&&type==='n'&&color===window.__car?makeCar(color):makePieceRaw(type,color)), u=g.userData||{};")
rep("  const anim = res.piece==='n' ? droneHop(mover,res.to)","  const anim = res.piece==='n' ? (mover.userData.car?carFlip(mover,res.to):droneHop(mover,res.to))")
rep("  vehicleSound(res.piece);","  if(mover.userData.car){ if(window.__rec) window.__rec.push([performance.now(),'boom',.45]); } else vehicleSound(res.piece);")
h+=open(os.path.join(here,'overlay.html')).read()
open(os.path.join(here,'video.html'),'w').write(h)
print('video.html written')
