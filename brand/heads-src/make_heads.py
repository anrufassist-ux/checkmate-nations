"""Turns the Grok bobblehead busts (white background) into game head cutouts.
Usage: python3 make_heads.py OUTDIR  ->  OUTDIR/<key>.webp, OUTDIR/<key>_cry.webp, OUTDIR/meta.json (aspect, eye positions)"""
import json, os, sys
from collections import deque
from PIL import Image, ImageFilter, ImageDraw
here=os.path.dirname(os.path.abspath(__file__)); out=sys.argv[1]
# eyes in source fractions (x from left, y from top); bottom = where the bust is cut (just below the tie knot)
SRC={'kb':('rus',(.385,.377),(.65,.377)),'chn':('chn',(.385,.365),(.65,.365)),'ger':('ger',(.40,.38),(.645,.38)),'eu':('eu',(.385,.385),(.65,.385))}
BOTTOM=.87; SHOULDER=.70; HALF=.27; COLLAR=.715  # below SHOULDER keep only a collar-wide band, like the original Trump head
def cutout(path):
    im=Image.open(path).convert('RGB'); W,H=im.size; px=im.load()
    bg=lambda p: min(p)>238 and max(p)-min(p)<9
    a=Image.new('L',(W,H),255); ap=a.load(); seen=bytearray(W*H); q=deque()
    for x in range(W): q.append((x,0)); q.append((x,H-1))
    for y in range(H): q.append((0,y)); q.append((W-1,y))
    while q:
        x,y=q.popleft(); i=y*W+x
        if seen[i] or not bg(px[x,y]) or (y>H*COLLAR and abs(x/W-.5)<HALF): continue
        seen[i]=1; ap[x,y]=0
        if x>0: q.append((x-1,y))
        if x<W-1: q.append((x+1,y))
        if y>0: q.append((x,y-1))
        if y<H-1: q.append((x,y+1))
    # inside the collar band there is only shirt and suit, never background (the white collar must not be cut away)
    m=Image.new('L',(W,H),0); d=ImageDraw.Draw(m)
    d.rectangle((0,0,W,int(H*SHOULDER)),fill=255)
    d.rounded_rectangle((int(W*(.5-HALF)),int(H*SHOULDER)-40,int(W*(.5+HALF)),int(H*BOTTOM)),radius=int(W*.08),fill=255)
    m=m.filter(ImageFilter.GaussianBlur(3))
    a=a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    from PIL import ImageChops
    im.putalpha(ImageChops.multiply(a,m)); return im
meta={}
for key,(src,e1,e2) in SRC.items():
    for suf in ('','_cry'):
        p=os.path.join(here,src+suf+'.jpg')
        if not os.path.exists(p): continue
        im=cutout(p); W,H=im.size; box=im.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox()
        im=im.crop(box); s=620/im.height; im=im.resize((round(im.width*s),620),Image.LANCZOS)
        im.save(os.path.join(out,key+suf+'.webp'),quality=86,method=6)
        if not suf:
            bx0,by0,bx1,by1=box; ew,eh=bx1-bx0,by1-by0
            meta[key]={'aspect':round(im.width/im.height,4),'eyes':[[round((e[0]*W-bx0)/ew,3),round(1-(e[1]*H-by0)/eh,3)] for e in (e1,e2)]}
json.dump(meta,open(os.path.join(out,'meta.json'),'w'),indent=1); print(meta)
