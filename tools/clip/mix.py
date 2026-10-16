"""Mixes the recorded frames with the game music and the sound effects logged in sounds.json.
Usage: python3 mix.py [out.mp4]  (after `node capture.js full`)"""
import base64, json, os, re, subprocess, sys
here=os.path.dirname(os.path.abspath(__file__)); os.chdir(here)
out=sys.argv[1] if len(sys.argv)>1 else 'clip.mp4'
h=open('../../index.html').read()
def blob(name):
    i=h.index('window.%s='%name)+len('window.%s='%name); return json.loads(h[i:h.index('</script>',i)].strip().rstrip(';'))
os.makedirs('snd',exist_ok=True)
def save(uri,fn):
    open(fn,'wb').write(base64.b64decode(uri.split(',',1)[1])); return fn
sfx=blob('SFX'); files={}
for k,uri in sfx.items():
    ext=re.match(r'data:audio/(\w+)',uri).group(1).replace('mpeg','mp3'); files[k]=save(uri,f'snd/{k}.{ext}')
files['boom']=files['boomBig']='audio-extra/boom.wav'
music=save(blob('MUSIC'),'snd/music.mp3')
frames=len([f for f in os.listdir('frames') if f.endswith('.jpg')]); dur=frames/24
events=[e for e in json.load(open('sounds.json')) if e[1] in files and e[0]<dur]
inputs=['-framerate','24','-i','frames/f%05d.jpg','-stream_loop','-1','-i',music]
flt=[f'[1:a]volume=0.35,afade=t=out:st={dur-1.5:.2f}:d=1.5[m]']; mix=['[m]']
for i,(t,k,v) in enumerate(events):
    inputs+=['-i',files[k]]; vol=v*(1.3 if k.startswith('boom') else 1)
    flt.append(f'[{i+2}:a]volume={vol:.2f},adelay={max(0,int(t*1000))}:all=1[s{i}]'); mix.append(f'[s{i}]')
flt.append(''.join(mix)+f'amix=inputs={len(mix)}:normalize=0,alimiter=limit=0.9[a]')
subprocess.run(['ffmpeg','-y',*inputs,'-filter_complex',';'.join(flt),'-map','0:v','-map','[a]','-t',f'{dur:.2f}',
    '-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-b:a','160k','-movflags','+faststart',out],check=True)
print(out, f'{dur:.1f}s', len(events),'sounds')
