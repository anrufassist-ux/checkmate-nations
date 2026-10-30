"""Talking General for the explainer clips: crops the bust (brand/general/general-gambit-cutout.png) and writes
general/m0..m5.png with the mouth opened 0..5 steps. The jaw is warped smoothly (no seams): below the moustache
the face moves down by d*w(x), w a bell curve around the mouth, fading out towards the collar; the gap shows a
dark mouth, the moustache stays on top. The clip picks a frame per video frame from the loudness of the voice."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, os
here=os.path.dirname(os.path.abspath(__file__))
src=Image.open(os.path.join(here,'../../brand/general/general-gambit-cutout.png')).convert('RGBA')
S=np.asarray(src).astype(np.float32); H,W=S.shape[:2]
box=(90,20,790,900)                       # cap to chest
CUT, CX, SX = 576, 425, 58                # mouth line under the moustache, mouth centre, mouth half-width
CHIN, COLLAR = 700, 770                   # full jaw movement down to the chin, fading out to the collar
ys,xs=np.mgrid[0:H,0:W].astype(np.float32)
wx=np.exp(-((xs-CX)/SX)**2); wx[wx<.04]=0
fall=np.clip((COLLAR-ys)/(COLLAR-CHIN),0,1); fall=fall*fall*(3-2*fall)
mouth=np.array([62,18,20,255],np.float32)
# moustache mask: grey/white hair in the moustache area, grown by a few pixels so the soft hair edge is included
r,g,b=S[...,0],S[...,1],S[...,2]; mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b)
hair=(mx>110)&((mx-mn)<42)&(xs>235)&(xs<615)&(ys>470)&(ys<612)
m=Image.fromarray((hair*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
MUST=np.asarray(m)>127
# for sampling the jaw, everything from the mouth line down to a few pixels below the moustache's lower edge counts
# as mouth, so no hair or its soft fringe gets pulled down into the lower lip
bottom=np.where(MUST.any(0),H-1-np.argmax(MUST[::-1],0),0)          # lowest moustache pixel per column
band=(ys>=CUT-30)&(ys<=bottom[None,:]+7)&(S[...,3]>200)
aw=(np.clip((wx-.06)/.2,0,1)*band)[...,None]                     # fades out sideways, no hard edge
SK=S*(1-aw)+mouth*aw
for k in range(6):
    d=k*5.5; off=d*wx
    out=S.copy(); below=ys>=CUT
    sy=np.where(below, ys-off*fall, ys)
    gap=below&(off>3.5)&(ys<CUT+off)                 # the opened mouth
    sy=np.clip(sy,0,H-1); y0=np.floor(sy).astype(int); y1=np.minimum(y0+1,H-1); t=(sy-y0)[...,None]
    # samples that would pull moustache hair down into the lip become mouth (the dark gap behind the moustache)
    xi=xs.astype(int); warped=SK[y0,xi]*(1-t)+SK[y1,xi]*t
    mv=below&(off>.5); out[mv]=warped[mv]                # only where the jaw really moves
    out[gap]=mouth
    im=Image.fromarray(out.clip(0,255).astype(np.uint8),'RGBA')
    # the whole moustache stays exactly where it is: its grey/white hair pixels (low saturation, bright) are copied back
    # unwarped on top, so neither the tips nor single grey strands move with the jaw
    out2=np.asarray(im).astype(np.float32).copy(); out2[MUST]=S[MUST]; im=Image.fromarray(out2.clip(0,255).astype(np.uint8),'RGBA')
    im.crop(box).resize((350,440),Image.LANCZOS).save(os.path.join(here,f'general/m{k}.png'),optimize=True)
print('ok')
