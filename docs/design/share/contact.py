"""Contact sheet of docs/design/share/out/<prefix>*.png (python3 contact.py web)."""
import sys, glob, os
from PIL import Image, ImageDraw
prefix = sys.argv[1] if len(sys.argv) > 1 else 'web'
here = os.path.dirname(os.path.abspath(__file__))
files = sorted(glob.glob(os.path.join(here, 'out', f'{prefix}-*.png')))
tw, cols = 270, 7
th = 480
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 10) + 10, rows * (th + 30) + 10), (40, 40, 48))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    k = tw / im.width
    im = im.resize((tw, int(im.height * k)))
    x = 10 + (i % cols) * (tw + 10); y = 10 + (i // cols) * (th + 30)
    sheet.paste(im, (x, y))
    d.text((x, y + th + 8), f"{os.path.basename(f)[len(prefix)+1:-4]} {Image.open(f).size}", fill=(230, 230, 230))
sheet.save(os.path.join(here, 'out', f'_contact-{prefix}.jpg'), quality=85)
# Half-size previews (committed; the full-size PNGs stay local, see .gitignore).
for f in files:
    im = Image.open(f).convert('RGB')
    im.resize((540, round(im.height * 540 / im.width))).save(f[:-4] + '.jpg', quality=82)
print(len(files))
