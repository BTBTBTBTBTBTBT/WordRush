import json, os, sys
from PIL import Image, ImageDraw, ImageFont
J='/Users/brianterchin/Developer/WordRush/.claude/worktrees/new-session-38fb01/docs/design/brand/social/jp45/incoming/full'
ids=sys.argv[2:]; out=sys.argv[1]
f=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
tiles=[]
for i in ids:
    im=Image.open(f'{J}/{i}.png').convert('RGB'); w,h=im.size
    s=380/h if h>w else 560/w
    im=im.resize((round(w*s),round(h*s))); d=ImageDraw.Draw(im)
    for pc in range(5,100,5):
        y=round(im.height*pc/100); d.line([(0,y),(im.width,y)], fill=(0,255,0) if pc%10==0 else (255,255,0), width=1)
        if pc%10==0: d.text((2,y-11),str(pc),fill=(0,255,0),font=f)
    d.text((4,im.height-26), i, fill=(255,255,255), font=f, stroke_width=2, stroke_fill=(0,0,0))
    tiles.append(im)
W=sum(t.width for t in tiles)+8*len(tiles); H=max(t.height for t in tiles)
sheet=Image.new('RGB',(W,H),(30,30,30)); x=0
for t in tiles: sheet.paste(t,(x,0)); x+=t.width+8
sheet.save(out, quality=85)
