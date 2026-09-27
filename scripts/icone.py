"""Genera le icone dell'app (PNG per iPhone e manifest, SVG per il browser).

Tre barre che salgono, nei colori dei tre giorni: Push, Pull, Gambe.
Uso: python3 scripts/icone.py  (serve solo Pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw

PUBLIC = Path(__file__).resolve().parent.parent / "public"

SFONDO = "#0e0f12"
BARRE = [  # (colore, altezza) su una tela di 1024
    ("#ee7d55", 260),
    ("#64a6e9", 390),
    ("#54b97d", 520),
]
LARGHEZZA, SPAZIO, BASE = 130, 60, 760
X0 = (1024 - (3 * LARGHEZZA + 2 * SPAZIO)) // 2


def disegna(lato: int) -> Image.Image:
    # Disegno a 4x e riduco: bordi morbidi senza scalettature
    s = 4096
    k = s / 1024
    img = Image.new("RGB", (s, s), SFONDO)
    d = ImageDraw.Draw(img)
    for i, (colore, h) in enumerate(BARRE):
        x = X0 + i * (LARGHEZZA + SPAZIO)
        d.rounded_rectangle(
            [x * k, (BASE - h) * k, (x + LARGHEZZA) * k, BASE * k],
            radius=LARGHEZZA / 2 * k,
            fill=colore,
        )
    return img.resize((lato, lato), Image.LANCZOS)


def svg() -> str:
    barre = "".join(
        f'<rect x="{X0 + i * (LARGHEZZA + SPAZIO)}" y="{BASE - h}" width="{LARGHEZZA}" '
        f'height="{h}" rx="{LARGHEZZA // 2}" fill="{c}"/>'
        for i, (c, h) in enumerate(BARRE)
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">'
        f'<rect width="1024" height="1024" rx="230" fill="{SFONDO}"/>{barre}</svg>\n'
    )


if __name__ == "__main__":
    PUBLIC.mkdir(exist_ok=True)
    for nome, lato in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)]:
        disegna(lato).save(PUBLIC / nome, optimize=True)
    (PUBLIC / "icon.svg").write_text(svg())
    print("Icone generate in", PUBLIC)
