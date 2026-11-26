"""
make-web-images.py — optional helper for the Pixelverse collection.

Creates lightweight copies of every design in img/pixelverse/ so the carousel and
Design Gallery load quickly:
    img/pixelverse/web/<name>.webp        (full view, longest side 1800 px)
    img/pixelverse/web/thumb/<name>.webp  (cards, 800 px wide)

Your original images are never changed. Copies that already exist and are newer
than their original are skipped. The site finds new copies automatically.

Run from the Portfolio folder (needs Pillow: pip install pillow):
    python tools/make-web-images.py
"""
import os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # design files can be very large

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'pixelverse')
FULL = os.path.join(ROOT, 'web')
THUMB = os.path.join(FULL, 'thumb')
EXTS = ('.png', '.jpg', '.jpeg', '.webp')


def up_to_date(src, dst):
    return os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)


def main():
    os.makedirs(THUMB, exist_ok=True)
    made = 0
    for name in sorted(os.listdir(ROOT)):
        src = os.path.join(ROOT, name)
        if not os.path.isfile(src) or not name.lower().endswith(EXTS):
            continue
        stem = os.path.splitext(name)[0]
        full_dst = os.path.join(FULL, stem + '.webp')
        thumb_dst = os.path.join(THUMB, stem + '.webp')
        if up_to_date(src, full_dst) and up_to_date(src, thumb_dst):
            continue
        im = Image.open(src)
        im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
        full = im.copy()
        full.thumbnail((1800, 1800), Image.LANCZOS)
        full.save(full_dst, 'WEBP', quality=84, method=6)
        thumb = im.copy()
        thumb.thumbnail((800, 2400), Image.LANCZOS)
        thumb.save(thumb_dst, 'WEBP', quality=80, method=6)
        made += 1
        print('made web copies for', name)
    print(f'done ({made} new)')


if __name__ == '__main__':
    main()
