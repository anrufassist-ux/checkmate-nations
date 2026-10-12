"""Builds video.html from ../../index.html: a copy of the game with hooks for scripted clip recording.
Usage: python3 make_video_page.py  ->  writes video.html next to this file."""
import os
here=os.path.dirname(os.path.abspath(__file__))
h=open(os.path.join(here,'../../index.html')).read()
def rep(a,b):
    global h
    assert a in h, 'patch anchor missing: '+a[:60]; h=h.replace(a,b,1)
rep("function setNations(w,b){","window.__v=()=>({doMove,setNations,setupPieces,setMode:m=>{mode=m;},setCaric:c=>{caricatures=c;},game,camera,controls,placeCamera});\nfunction setNations(w,b){")
rep("  if(mode==='pvp'){\n    const n=","  if(mode==='video'){ busy=false; return; }\n  if(mode==='pvp'){\n    const n=")
rep("setStatus('Wähle einen Spielmodus.','w'); openModeScreen();","setStatus('Wähle einen Spielmodus.','w');")
rep("shift=new T.Vector3(side*2.6,0,0);","shift=new T.Vector3(side*5.6,0,-.1);")  # portrait: follow the cell
rep("  startCrying(king);\n  wake(15000);","  startCrying(king);\n  { const c1=camera.position.clone(), tg=controls.target.clone(); await animate(1.6,t=>{ camera.position.copy(c1).lerp(tg,.55*ease(t)); }); }\n  wake(15000);")
h+=open(os.path.join(here,'overlay.html')).read()
open(os.path.join(here,'video.html'),'w').write(h)
print('video.html written')
