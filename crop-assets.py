"""Cut the WhatsApp flyers in assets/ into the WebPs the site uses (assets/img/).

Only needed again if a flyer changes. Boxes are (left, top, right, bottom) in the
source flyer's own pixels. `python crop-assets.py` then open assets/img/.
"""
from pathlib import Path
from PIL import Image

SRC = Path(__file__).parent / "assets"
OUT = SRC / "img"
OUT.mkdir(exist_ok=True)

F = {
    "millets": "WhatsApp Image 2026-10-05 at 19.20.25.jpeg",
    "nasika": "WhatsApp Image 2026-10-05 at 19.20.25 (1).jpeg",
    "dishwash": "WhatsApp Image 2026-10-05 at 19.20.25 (2).jpeg",
    "owner": "WhatsApp Image 2026-10-05 at 19.20.25 (4).jpeg",
    "organic": "WhatsApp Image 2026-10-05 at 19.20.25 (5).jpeg",
}

# name: (flyer, box, output width or None to keep size)
CROPS = {
    "logo":          ("nasika",   (14, 10, 182, 178), 168),
    "proprietor":    ("owner",    (0, 0, 205, 384), None),
    "nasika":        ("nasika",   (40, 180, 184, 460), None),
    "dishwash":      ("dishwash", (55, 112, 468, 232), None),
    "millet-korralu":      ("millets", (14, 300, 116, 500), None),
    "millet-andu-korralu": ("millets", (124, 300, 228, 500), None),
    "millet-udalu":        ("millets", (236, 300, 340, 500), None),
    "millet-samalu":       ("millets", (348, 300, 450, 500), None),
    "millet-arikelu":      ("millets", (458, 300, 562, 500), None),
    # the round swatches beside each name in the organic flyer's product list
    "p-pasupu":       ("organic", (55, 855, 109, 909), 160),
    "p-karam":        ("organic", (55, 909, 109, 963), 160),
    "p-ulavalu":      ("organic", (55, 962, 109, 1016), 160),
    "p-minappappu":   ("organic", (55, 1018, 109, 1072), 160),
    "p-kandipappu":   ("organic", (445, 857, 499, 911), 160),
    "p-pebbarlu":     ("organic", (445, 918, 499, 972), 160),
    "p-rajma":        ("organic", (445, 978, 499, 1032), 160),
}

# whole flyers for the gallery — they are the shop's own adverts
FLYERS = {
    "flyer-millets": ("millets", None),
    "flyer-organic": ("organic", None),
    "flyer-nasika": ("nasika", None),
    "flyer-dishwash": ("dishwash", (0, 0, 575, 335)),
    "flyer-banner": ("owner", None),
}


def save(img, name, width=None):
    if width and img.width != width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(OUT / f"{name}.webp", "WEBP", quality=84, method=6)


for name, (flyer, box, width) in CROPS.items():
    save(Image.open(SRC / F[flyer]).convert("RGB").crop(box), name, width)

for name, (flyer, box) in FLYERS.items():
    img = Image.open(SRC / F[flyer]).convert("RGB")
    save(img.crop(box) if box else img, name)

# the shopfront render has a soft transparent halo; keep the solid middle and
# flatten whatever alpha is left onto warm cream so no fringe shows in the hero
shop = Image.open(SRC / "shop.png").convert("RGBA").crop((200, 20, 1280, 1040))
flat = Image.new("RGBA", shop.size, (246, 239, 224, 255))
flat.alpha_composite(shop)
save(flat.convert("RGB"), "shop", 900)

print("wrote", len(CROPS) + len(FLYERS) + 1, "files to", OUT)
