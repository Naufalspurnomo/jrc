#!/usr/bin/env python3
"""Create low-contrast world plates from the user-supplied Roman panorama.

Source attribution/licensing remains user-provided and must be resolved before public reuse.
"""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path.home() / ".hermes/profiles/superagent/cache/images/img_94fa52fae938.jpg"
OUTPUT = ROOT / "public/assets/legacy-world"


def grade(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    image = ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    image = ImageEnhance.Color(image).enhance(0.48)
    image = ImageEnhance.Contrast(image).enhance(1.12)
    image = ImageEnhance.Brightness(image).enhance(0.66)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.1, percent=72, threshold=4))
    return image


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE)
    variants = {"desktop": (1024, 2560), "mobile": (720, 2560)}
    for name, size in variants.items():
        image = grade(source, size)
        image.save(OUTPUT / f"legacy-world-{name}.webp", "WEBP", quality=78, method=6)
        image.save(OUTPUT / f"legacy-world-{name}.avif", "AVIF", quality=54)


if __name__ == "__main__":
    main()
