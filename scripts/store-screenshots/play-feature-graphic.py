from PIL import Image, ImageDraw, ImageFont
import os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..') + '/'
FONT = R + 'apps/ios/Wordocious/Resources/Nunito.ttf'
def font(sz, w):
    f = ImageFont.truetype(FONT, sz); f.set_variation_by_name(w); return f
def hgrad(w, h, a, b):
    g = Image.new('RGB', (w, 1))
    for x in range(w):
        t = x / max(1, w - 1); g.putpixel((x, 0), tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    return g.resize((w, h))
W, H = 1024, 500
bg = Image.new('RGB', (1, H))
for y in range(H):
    t = y / (H - 1); bg.putpixel((0, y), tuple(int(c0 + (c1 - c0) * t) for c0, c1 in zip((0xF5, 0xF3, 0xFF), (0xEC, 0xE8, 0xFC))))
cv = bg.resize((W, H)).convert('RGBA')
icon = Image.open(R + 'apps/ios/Wordocious/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png').convert('RGBA').resize((250, 250), Image.LANCZOS)
m = Image.new('L', (250, 250), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, 249, 249), 56, fill=255)
cv.paste(icon, (80, 125), m)
d = ImageDraw.Draw(cv)
x0 = 380
hf = font(66, 'Black'); word = 'WORDOCIOUS'
tw = int(d.textlength(word, font=hf)); mask = Image.new('L', (tw + 10, 90), 0)
ImageDraw.Draw(mask).text((0, 0), word, font=hf, fill=255)
cv.paste(hgrad(mask.width, mask.height, (0x7C, 0x3A, 0xED), (0xEC, 0x48, 0x99)).convert('RGBA'), (x0, 150), mask)
d.text((x0, 250), 'Eight daily word games.', font=font(35, 'Black'), fill=(0x3B, 0x1A, 0x78))
d.text((x0, 297), 'Ten More Games. New every day.', font=font(35, 'Black'), fill=(0x9D, 0x17, 0x4D))
cv.convert('RGB').save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'feature-graphic.png'))
print(cv.size)
