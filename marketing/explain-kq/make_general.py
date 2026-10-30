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
CUT, CX, SX = 576, 425, 85                # mouth line under the moustache, mouth centre, mouth half-width
CHIN, COLLAR = 700, 770                   # full jaw movement down to the chin, fading out to the collar
ys,xs=np.mgrid[0:H,0:W].astype(np.float32)
wx=np.exp(-((xs-CX)/SX)**2); wx[wx<.04]=0
fall=np.clip((COLLAR-ys)/(COLLAR-CHIN),0,1); fall=fall*fall*(3-2*fall)
mouth=np.array([62,18,20,255],np.float32)
for k in range(6):
    d=k*5.5; off=d*wx
    out=S.copy(); below=ys>=CUT
    sy=np.where(below, ys-off*fall, ys)
    gap=below&(off>1.2)&(ys<CUT+off)                 # the opened mouth
    sy=np.clip(sy,0,H-1); y0=np.floor(sy).astype(int); y1=np.minimum(y0+1,H-1); t=(sy-y0)[...,None]
    warped=S[y0,xs.astype(int)]*(1-t)+S[y1,xs.astype(int)]*t
    out[below]=warped[below]
    out[gap]=mouth
    im=Image.fromarray(out.clip(0,255).astype(np.uint8),'RGBA')
    # moustache on top, soft edge
    mt=src.crop((230,470,620,CUT+14)); mm=Image.new('L',mt.size,0); ImageDraw.Draw(mm).ellipse((0,-40,mt.width,mt.height),fill=255)
    im.paste(mt,(230,470),Image.composite(mt.getchannel('A'),Image.new('L',mt.size,0),mm.filter(ImageFilter.GaussianBlur(5))))
    im.crop(box).resize((350,440),Image.LANCZOS).save(os.path.join(here,f'general/m{k}.png'),optimize=True)
print('ok')
