# Usage: python3 block2/portrait_twins.py [ids...]   (after accept; reads the accepted native scenes)
# Threads uses the portrait size: build a portrait twin of every block-2 landscape (x / holiday-x) scene.
import json, os, sys, importlib.util
J='/Users/brianterchin/Developer/WordRush/.claude/worktrees/new-session-38fb01/docs/design/brand/social/jp45'
sys.path.insert(0, J); os.chdir(J)
import scene as SC, compose as C
from PIL import Image
spec=importlib.util.spec_from_file_location('acc', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'accept_params.py'))
src=open(spec.origin).read().split("q={i['id']:i")[0]   # just the tables (T, CART)
ns={}; exec(src.replace("import json, subprocess, sys, os",""), ns); T, CART = ns['T'], ns['CART']
ACC='/private/tmp/claude-501/-Users-brianterchin-Developer-WordRush--claude-worktrees-new-session-38fb01/c71b5614-4332-4087-96d2-47d25779769a/scratchpad/accepted'
q={i['id']:i for i in json.load(open('incoming/full/queue.json'))['queue']}
only=sys.argv[1:]
for cid,(a,b,ex) in T.items():
    it=q[cid]
    if it['fmt']!='landscape' or (only and cid not in only): continue
    if it['slot']=='holiday-x': continue      # holiday greetings already have their own portrait scene
    raw=Image.open(f'{ACC}/{cid}.png').convert('RGB'); h=1024
    y0=max(0,round(h*a/100)-8); y1=round(h*b/100)+8
    sea=it['season']; ser=it['series']
    raw=SC.recolor_headline(raw, sea, ser, y0, y1, int(ex['nl']) if ex.get('nl') else None, None, None, 14, 0.4, None, int(ex.get('hmax',345)))
    s=1080/1536; top=(1350-round(1024*s))//2
    from PIL import ImageFilter, ImageEnhance
    import numpy as np
    sc=raw.resize((1080, round(1024*s)), Image.LANCZOS)
    bg=raw.resize((round(1536*1350/1024), 1350), Image.LANCZOS); bx=(bg.width-1080)//2; bg=bg.crop((bx,0,bx+1080,1350))
    bg=ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(38))).enhance(0.82)
    a=np.ones((sc.height,1080),np.float32); f=70
    ramp=np.linspace(0,1,f)[:,None]; a[:f]*=ramp; a[-f:]*=ramp[::-1]
    bg.paste(sc,(0,top),Image.fromarray((a*255).astype('uint8')))
    im=bg
    c=ex.get('content')
    if c:
        land_top=max(28, round(120-0.87*y0)); ay=float(ex['at'].split(',')[1])
        ny=(ay*900-land_top)/0.87; py=(top+s*ny)/1350
        if c.startswith('cart|'): c='cartoon|'+CART[cid[5:10]]+'|'+str(round(int(c.split('|')[1])*s/0.87*1.15))
        elif c=='wotd': c=it['content'].rsplit('|',1)[0]+'|0.7'
        im=SC.add_content(im,'portrait',c,f'0.5,{py:.3f}',sea,ser)
    out=SC.overlay(im,'portrait','x',sea)
    key=cid.rsplit('-',1)[0]; d=C.out_dir(key); out.save(os.path.join(d,'portrait.png'),optimize=True); print('portrait ->',key)
