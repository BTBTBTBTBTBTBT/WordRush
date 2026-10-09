#!/usr/bin/env python3
"""Section titles for Stats / Profile / Settings (items 16/17/25/36), rendered from the bubble glyph atlas in the CAST COLOR of
the owning character (W purple, O1 amber, R slate, D blue, O2 pink, C teal, I green, O3 orange, U violet, S gold).
Decision: atlas, not per-title ChatGPT art: identical lettering to DAILIES/PUZZLES by construction, crisp at any width, tintable
per season (Halloween = black body + orange rim), and new titles cost nothing."""
import os, sys
H = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(H, '..', 'glyphs'))
import bubble_text as bt
from PIL import Image
CAST = {'W': '#7c3aed', 'O1': '#f59e0b', 'R': '#94a3b8', 'D': '#2563eb', 'O2': '#ec4899', 'C': '#0891b2', 'I': '#059669', 'O3': '#f97316', 'U': '#7e22ce', 'S': '#ca8a04'}
def lighten(h, k=0.28):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(round(v + (255 - v) * k) for v in c)
TITLES = [('MY GAMES', 'W'), ('HEAD TO HEAD', 'D'), ('BOTS', 'R'), ('GUESSES', 'C'), ('ACTIVITY', 'I'), ('POCKET GAMES', 'S'),
          ('TROPHY CASE', 'O1'), ('HIGHLIGHTS', 'O3'), ('LATELY', 'U'), ('THEME', 'W'), ('KEYBOARD', 'D'), ('SOUND & FEEDBACK', 'C'),
          ('NOTIFICATIONS', 'O2'), ('ACCOUNT', 'I'), ('HELP', 'S')]
for t, who in TITLES:
    slug = t.lower().replace(' & ', '-').replace(' ', '-')
    for tn, (top, bot, rim) in {'': (lighten(CAST[who]), CAST[who], None), '-halloween': ('#3a2a4a', '#0c0812', '#f97316')}.items():
        im = bt.render(t, top, bot, rim=rim)
        k = 720 / max(im.width, 720) if im.width > 720 else 1
        k = min(1.0, 900 / im.width) if im.width > 900 else 1.0
        if k != 1.0: im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        im.save(f'{H}/out/title-{slug}{tn}.png')
print('ok')
