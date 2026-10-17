# Block 2 (10-17): the exact `scene.py accept` parameters per scene (headline rows as % of the native height, content, nl).
# Usage: python3 block2/accept_params.py [ids...]   re-runs accept for those ids (sources fall back to the scratch 'accepted' copies).
import json, subprocess, sys, os
J='/Users/brianterchin/Developer/WordRush/.claude/worktrees/new-session-38fb01/docs/design/brand/social/jp45'
CART={'12-02':'md-htmnde-a26cc00fbc.webp','12-09':'md-u9qycg-9bc7be3cde.webp','12-16':'md-mmher2-bb9f2ac4a2.webp','12-23':'md-ufqxsl-e9aba1fc73.webp'}
# id: (y0%, y1%, extra args)
T={
 '2026-11-30-feed-1':(10,36,{}), '2026-12-01-feed-1':(10,36,{}), '2026-12-02-feed-1':(10,28,{'content':'cart|300','at':'0.5,0.457'}),
 '2026-12-04-holiday-feed-1':(10,29,{}), '2026-12-25-holiday-feed-1':(12,34,{}), '2026-12-13-fb-1':(8,32,{}),
 '2026-12-16-feed-1':(7,27,{'content':'cart|370','at':'0.5,0.47'}), '2026-12-18-feed-1':(13,38,{}), '2026-12-20-fb-1':(8,42,{}),
 '2026-12-03-pin-1':(12,34,{}), '2026-12-03-pin-3':(10,31,{}), '2026-12-17-pin-1':(10,35,{}), '2026-12-17-pin-2':(10,25,{}), '2026-12-17-pin-3':(8,28,{}),
 '2026-11-30-x-1':(9,40,{}), '2026-12-01-x-1':(11,27,{}), '2026-12-02-x-1':(9,39,{'content':'cart|400','at':'0.5,0.66'}),
 '2026-12-03-x-1':(12,38,{'content':'wotd','at':'0.5,0.66'}), '2026-12-04-holiday-x-1':(9,29,{}), '2026-12-25-holiday-x-1':(12,35,{}),
 '2026-12-12-x-1':(20,63,{'nl':'7'}), '2026-12-13-x-1':(7,40,{}), '2026-12-14-x-1':(9,42,{}), '2026-12-15-x-1':(17,46,{'content':'wotd','at':'0.5,0.67'}),
 '2026-12-16-x-1':(9,41,{'content':'cart|400','at':'0.5,0.66'}), '2026-12-17-x-1':(13,43,{'content':'wotd','at':'0.5,0.69'}),
 '2026-12-18-x-1':(9,30,{}), '2026-12-19-x-1':(22,62,{'nl':'9'}), '2026-12-20-x-1':(7,40,{}), '2026-12-21-x-1':(9,41,{}), '2026-12-22-x-1':(5,36,{}),
}

T.update({
 '2026-12-22-feed-1':(8,36,{}), '2026-12-23-feed-1':(15,37,{'content':'cart|460','at':'0.5,0.53'}), '2026-12-25-feed-1':(10,37,{}),
 '2026-12-27-feed-1':(11,36,{}), '2026-12-03-pin-2':(9,31,{}), '2026-12-24-pin-1':(15,36,{}), '2026-12-24-pin-2':(11,32,{}), '2026-12-24-pin-3':(13,36,{}),
 '2026-12-23-x-1':(13,42,{'content':'cart|400','at':'0.5,0.66'}), '2026-12-24-x-1':(13,42,{'content':'wotd','at':'0.5,0.67'}),
 '2026-12-25-x-1':(13,37,{}), '2026-12-26-x-1':(22,58,{'nl':'8'}), '2026-12-27-x-1':(9,32,{}),
})

T.update({
 '2026-12-26-holiday-feed-1':(13,34,{}), '2026-12-04-feed-1':(10,38,{}), '2026-12-06-fb-1':(13,36,{}), '2026-12-09-feed-1':(14,36,{'content':'cart|300','at':'0.5,0.44'}),
 '2026-12-11-feed-1':(13,38,{}), '2026-12-10-pin-1':(13,36,{}), '2026-12-10-pin-2':(13,32,{}), '2026-12-10-pin-3':(13,30,{}),
 '2026-12-26-holiday-x-1':(17,40,{}), '2026-12-04-x-1':(13,37,{}), '2026-12-05-x-1':(15,62,{'nl':'7'}), '2026-12-06-x-1':(18,60,{}),
 '2026-12-07-x-1':(13,35,{}), '2026-12-08-x-1':(13,40,{'content':'wotd','at':'0.5,0.66'}), '2026-12-09-x-1':(13,42,{'content':'cart|400','at':'0.5,0.66'}),
 '2026-12-10-x-1':(13,42,{'content':'wotd','at':'0.5,0.66'}), '2026-12-11-x-1':(13,34,{}),
})
T.update({'2026-12-02-feed-1':(13,31,{'content':'cart|480','at':'0.5,0.49'}),'2026-12-09-feed-1':(13,31,{'content':'cart|480','at':'0.5,0.49'})})
q={i['id']:i for i in json.load(open(J+'/incoming/full/queue.json'))['queue']}
only=sys.argv[1:]
for cid,(a,b,ex) in T.items():
    if only and cid not in only: continue
    it=q[cid]; fmt=it['fmt']; h=1536 if fmt in ('portrait','pin') else 1024
    y0=round(h*a/100)-8; y1=round(h*b/100)+8
    args=['python3','scene.py','accept',cid,'--series',it['series'],'--y0',str(max(0,y0)),'--y1',str(y1)]
    if fmt=='landscape':
        s=0.87; top=max(28, round(120-s*y0)); args+=['--scale',str(s),'--top',str(top)]
    elif fmt=='portrait':
        s=0.88; top=max(0, round(160-s*y0)); args+=['--scale',str(s),'--top',str(top)]
    if ex.get('hmax'): args+=['--hmax',ex['hmax']]
    if ex.get('nl'): args+=['--nl',ex['nl']]
    c=ex.get('content')
    if c:
        if c.startswith('cart|'): c='cartoon|'+CART[cid[5:10] if False else cid[5:10]]+'|'+c.split('|')[1]
        elif c=='wotd': c=it['content']
        args+=['--content',c,'--at',ex['at']]
    r=subprocess.run(args,cwd=J,capture_output=True,text=True)
    print(cid, (r.stdout.strip().splitlines() or [''])[-1], r.stderr.strip()[-300:])
