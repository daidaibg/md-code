"""Apply a smooth silhouette to the generated logo, keeping its interior artwork."""
from pathlib import Path
from PIL import Image, ImageDraw

SOURCE = Path(r'C:\Users\daida\.codex\generated_images\01a07ed8-4542-7642-aa0b-ea32ba321f21\exec-fbf89454-b3ea-4a1a-b71a-0efcba87fdc1.png')
OUT = Path(__file__).parent
im = Image.open(SOURCE).convert('RGBA')
points = [(422, 33)]

def line(x, y):
    points.append((x, y))

def curve(x1, y1, x2, y2, x3, y3):
    x0, y0 = points[-1]
    for i in range(1, 101):
        t = i / 100
        s = 1 - t
        points.append((s**3*x0 + 3*s*s*t*x1 + 3*s*t*t*x2 + t**3*x3,
                       s**3*y0 + 3*s*s*t*y1 + 3*s*t*t*y2 + t**3*y3))

line(797, 33)
curve(836, 33, 853, 43, 877, 68)
line(1119, 307)
curve(1141, 330, 1149, 350, 1149, 389)
line(1147, 941)
curve(1147, 1024, 1093, 1080, 1008, 1082)
line(968, 1082)
curve(958, 1162, 894, 1221, 810, 1218)
line(307, 1174)
curve(226, 1168, 179, 1115, 171, 1039)
line(109, 402)
curve(99, 312, 152, 253, 222, 226)
line(289, 202)
line(289, 170)
curve(289, 92, 341, 33, 422, 33)

scale = 4
mask = Image.new('L', (im.width*scale, im.height*scale), 0)
ImageDraw.Draw(mask).polygon([(round(x*scale), round(y*scale)) for x,y in points], fill=255)
mask = mask.resize(im.size, Image.Resampling.LANCZOS)
im.putalpha(mask)
# Leave generous transparent margins suitable for app-icon use.
crop = im.crop(mask.getbbox())
crop.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
final = Image.new('RGBA', (1200, 1200))
final.paste(crop, ((1200-crop.width)//2, (1200-crop.height)//2))
final.save(OUT / 'md-code-logo-transparent.png')
for name, color in [('dark', '#202b3d'), ('light', '#ffffff')]:
    preview = Image.new('RGBA', final.size, color)
    preview.alpha_composite(final)
    preview.convert('RGB').save(OUT / f'logo-preview-{name}.jpg', quality=95)
print('Saved transparent RGBA PNG:', final.size, 'corner alpha:', final.getpixel((0,0))[3])
