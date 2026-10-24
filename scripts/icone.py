"""Esporta il manubrio approvato nei formati per browser, iPhone e installazione.

Sorgente: scripts/icona-master.png, con sfondo nero e manubrio corallo.
Uso: python3 scripts/icone.py  (serve solo Pillow)
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SOURCE = Path(__file__).resolve().parent / "icona-master.png"


def esporta(sorgente: Image.Image, lato: int, mascherabile: bool = False) -> Image.Image:
    # Il margine aggiuntivo protegge il manubrio dai ritagli circolari su Android.
    misura = round(lato * 0.8) if mascherabile else lato
    icona = sorgente.resize((misura, misura), Image.Resampling.LANCZOS)
    tela = Image.new("RGB", (lato, lato), "#000000")
    margine = (lato - misura) // 2
    tela.paste(icona, (margine, margine))
    return tela


if __name__ == "__main__":
    PUBLIC.mkdir(exist_ok=True)
    with Image.open(SOURCE) as originale:
        sorgente = originale.convert("RGB")
    if sorgente.width != sorgente.height:
        raise ValueError("L'icona sorgente deve essere quadrata")
    # Elimina il rumore quasi nero della generazione, senza toccare il corallo.
    sorgente.putdata([(0, 0, 0) if max(p) <= 12 else p for p in sorgente.get_flattened_data()])
    for nome, lato in [
        ("favicon.png", 32),
        ("apple-touch-icon.png", 180),
        ("icon-192.png", 192),
        ("icon-512.png", 512),
    ]:
        esporta(sorgente, lato).save(PUBLIC / nome, optimize=True)
    esporta(sorgente, 512, mascherabile=True).save(PUBLIC / "icon-maskable-512.png", optimize=True)
    print("Icone generate in", PUBLIC)
