# One pane frame that shows all poses whole → a synthetic card split-poses can read.
# Masks ChatGPT's scroll-down arrow (a dark circle at x≈400, y≈291) with the card color.
#   python3 poses/frame-to-card.py <frame.jpg> <out.png> [top=62] [bottom=296]
import sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
top = int(sys.argv[3]) if len(sys.argv) > 3 else 62
bot = int(sys.argv[4]) if len(sys.argv) > 4 else 296
im = Image.open(src).convert('RGB')
crop = im.crop((30, top, 584, bot))
key = crop.getpixel((4, 4))
d = ImageDraw.Draw(crop)
d.ellipse([400 - 30 - 24, 291 - top - 24, 400 - 30 + 24, 291 - top + 24], fill=key)
card = Image.new('RGB', (560, (bot - top) + 130), key)
card.paste(crop, (3, 10))
canvas = Image.new('RGB', (800, card.height + 80), (0, 0, 0))
canvas.paste(card, (28, 40))
canvas.save(out)
