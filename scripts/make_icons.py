"""Renders public/icons/icon.svg to the PNG icons the web app manifest needs.

The wheel fits inside the central 80% "safe zone", so the same artwork works
as a maskable icon (cropped to a circle or squircle by Android) and as the
iOS Home Screen icon. Run after editing the SVG:

    uv run python scripts/make_icons.py
"""

import argparse
import logging
from pathlib import Path

from playwright.sync_api import sync_playwright

log = logging.getLogger(__name__)

ICONS = Path(__file__).resolve().parents[1] / "public" / "icons"
SIZES = {"icon-180.png": 180, "icon-192.png": 192, "icon-512.png": 512}


def render(svg: Path, out_dir: Path) -> None:
    markup = svg.read_text(encoding="utf-8")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for name, size in SIZES.items():
                page = browser.new_page(viewport={"width": size, "height": size})
                page.set_content(
                    "<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>"
                    + markup
                )
                path = out_dir / name
                page.screenshot(path=str(path), omit_background=False)
                page.close()
                log.info("wrote %s (%dx%d)", path, size, size)
        finally:
            browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--log-level", default="INFO", help="logging level (default INFO)")
    parser.add_argument("-v", "--verbose", action="store_true", help="shortcut for DEBUG")
    args = parser.parse_args()
    level = "DEBUG" if args.verbose else args.log_level.upper()
    logging.basicConfig(level=level, format="%(levelname)s %(message)s")
    logging.captureWarnings(True)
    render(ICONS / "icon.svg", ICONS)


if __name__ == "__main__":
    main()
