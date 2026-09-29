"""Génère le logo Praxis (SVG) et ses rendus PNG.

Le dessin : un signal échantillonné qui monte en escalier (bleu Python → violet C++ → orange Ingé)
jusqu'au losange doré de l'app, sur un fond sarcelle quadrillé comme du papier millimétré.

Usage : python3 logo.py <dossier_du_depot>
Produit : launcher/logo.svg, launcher/macos/AppIcon-1024.png, app/icons/{praxis.svg, apple-touch-icon.png, icon-192.png, icon-512.png}
"""
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

DEFS = """
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#157A73"/>
      <stop offset="0.55" stop-color="#0E4F4C"/>
      <stop offset="1" stop-color="#082725"/>
    </linearGradient>
    <radialGradient id="reflet" cx="0.28" cy="0.16" r="0.75">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.20"/>
      <stop offset="0.65" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="trace" x1="240" y1="0" x2="700" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8CC0FF"/>
      <stop offset="0.5" stop-color="#C6A6F5"/>
      <stop offset="1" stop-color="#FF9D5C"/>
    </linearGradient>
    <linearGradient id="or" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFE27A"/>
      <stop offset="1" stop-color="#F2B61F"/>
    </linearGradient>
    <filter id="ombre" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000000" flood-opacity="0.32"/>
    </filter>
    <filter id="halo" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="22"/>
    </filter>
    <clipPath id="forme"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>
  </defs>"""

# Le fond quadrillé (papier millimétré) et le dessin, dans le repère du carré arrondi (100..924).
QUADRILLAGE = """
    <rect x="0" y="0" width="1024" height="1024" fill="url(#reflet)"/>
    <path d="M0 300H1024M0 440H1024M0 580H1024M0 720H1024M0 860H1024M260 0V1024M400 0V1024M540 0V1024M680 0V1024M820 0V1024"
          stroke="#FFFFFF" stroke-opacity="0.075" stroke-width="3" fill="none"/>"""

DESSIN = """
  <path d="M228 800H796" stroke="#FFFFFF" stroke-opacity="0.30" stroke-width="12" stroke-linecap="round"/>
  <g fill="#FFFFFF" fill-opacity="0.38">
    <circle cx="260" cy="800" r="9"/><circle cx="400" cy="800" r="9"/><circle cx="540" cy="800" r="9"/><circle cx="680" cy="800" r="9"/>
  </g>
  <path d="M260 720H400V580H540V440H680V372" fill="none" stroke="url(#trace)" stroke-width="64"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M680 176 L748 244 L680 312 L612 244 Z" fill="#F2C230" opacity="0.55" filter="url(#halo)"/>
  <path d="M680 176 L748 244 L680 312 L612 244 Z" fill="url(#or)"/>
  <path d="M680 176 L748 244 L680 244 Z" fill="#FFFFFF" fill-opacity="0.28"/>"""

MOTIF = f"""
  <g clip-path="url(#forme)">{QUADRILLAGE}
  </g>{DESSIN}"""


def svg_macos() -> str:
    """Icône macOS : carré arrondi avec marge et ombre, sur une toile de 1024."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{DEFS}
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#fond)" filter="url(#ombre)"/>{MOTIF}
</svg>
"""


def svg_favicon() -> str:
    """Onglet du navigateur : le carré arrondi seul, sans marge ni ombre."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 100 824 824">{DEFS}
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#fond)"/>{MOTIF}
</svg>
"""


def svg_plein() -> str:
    """Écran d'accueil (apple-touch-icon, manifeste) : fond plein cadre, le système arrondit lui-même."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 100 824 824">{DEFS}
  <rect x="0" y="0" width="1024" height="1024" fill="url(#fond)"/>{QUADRILLAGE}{DESSIN}
</svg>
"""


async def rendre(svg: str, taille: int, sortie: Path, transparent: bool = True) -> None:
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page(viewport={"width": taille, "height": taille})
        style = f'<svg style="width:{taille}px;height:{taille}px;display:block" '
        html = ("<html><body style='margin:0;background:transparent'>"
                + svg.replace("<svg ", style, 1) + "</body></html>")
        await page.set_content(html)
        await page.screenshot(path=str(sortie), omit_background=transparent, clip={"x": 0, "y": 0, "width": taille, "height": taille})
        await b.close()


async def main() -> None:
    depot = Path(sys.argv[1])
    (depot / "launcher" / "macos").mkdir(parents=True, exist_ok=True)
    (depot / "app" / "icons").mkdir(parents=True, exist_ok=True)
    (depot / "launcher" / "logo.svg").write_text(svg_macos(), encoding="utf-8")
    (depot / "app" / "icons" / "praxis.svg").write_text(svg_favicon(), encoding="utf-8")
    await rendre(svg_macos(), 1024, depot / "launcher" / "macos" / "AppIcon-1024.png")
    for taille, nom in ((180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        await rendre(svg_plein(), taille, depot / "app" / "icons" / nom, transparent=False)


if __name__ == "__main__":
    asyncio.run(main())
