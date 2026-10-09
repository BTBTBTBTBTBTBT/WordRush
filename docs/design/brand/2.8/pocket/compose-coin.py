#!/usr/bin/env python3
"""Call It coin: heads = canonical W (cape, on-model) on the blank gold coin; tails = the W crest coin.
The W is the shipped cast/hero/w.png, placed unaltered (scaled only)."""
import os
from PIL import Image, ImageDraw, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); B = os.path.normpath(os.path.join(H, '..', '..'))
coin = Image.open(f'{H}/out/coin-blank.png').convert('RGBA')
w = Image.open(f'{B}/cast/hero/w.png').convert('RGBA'); w = w.crop(w.getchannel('A').getbbox())
S = coin.width; k = S * 0.60 / max(w.size); w = w.resize((round(w.width * k), round(w.height * k)), Image.LANCZOS)
sh = Image.new('RGBA', coin.size, (0, 0, 0, 0)); a = Image.new('RGBA', w.size, (120, 60, 0, 0)); a.putalpha(w.getchannel('A').point(lambda v: v * 110 // 255))
sh.alpha_composite(a, ((S - w.width) // 2 + 4, (coin.height - w.height) // 2 + 10)); coin.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)))
coin.alpha_composite(w, ((S - w.width) // 2, (coin.height - w.height) // 2 + 4))
coin.save(f'{H}/out/coin-heads-w.png')
Image.open(f'{H}/out/coin-crest.png').save(f'{H}/out/coin-tails-crest.png')
