"""Writes general/env.json: the mouth frame (0..5) for every video frame (24 fps), from the loudness of the voice as
it sits in the clip: parts S1-S6 of vo_raw.mp3 from 1.0 s, part S7 from END s (half a second before the end card,
same as mix.sh). Usage: python3 envelope.py [END=59.3] [DUR=63.0]"""
import json, os, subprocess, sys, numpy as np
here=os.path.dirname(os.path.abspath(__file__)); END=float(sys.argv[1]) if len(sys.argv)>1 else 59.3; DUR=float(sys.argv[2]) if len(sys.argv)>2 else 63.0
raw=subprocess.run(['ffmpeg','-loglevel','error','-i',os.path.join(here,'vo_raw.mp3'),'-ac','1','-ar','24000','-f','f32le','-'],capture_output=True,check=True).stdout
a=np.frombuffer(raw,np.float32); sr=24000
tl=np.zeros(int((DUR+1)*sr),np.float32)
def put(src0,src1,at):
    s=a[int(src0*sr):int(src1*sr)]; i=int(at*sr); tl[i:i+len(s)]+=s[:len(tl)-i]
put(0,49.6,1.0); put(50.0,len(a)/sr,END)
hop=sr//24; n=int(DUR*24); rms=np.array([np.sqrt(np.mean(tl[i*hop:(i+1)*hop]**2)+1e-12) for i in range(n)])
db=20*np.log10(rms); lv=np.clip((db+42)/22,0,1)          # -42 dB closed .. -20 dB wide open
lv=np.convolve(lv,[.25,.5,.25],'same'); f=np.round(lv*5).astype(int).tolist()
json.dump(f,open(os.path.join(here,'general/env.json'),'w')); print(n,'frames, open',sum(1 for x in f if x>0))
