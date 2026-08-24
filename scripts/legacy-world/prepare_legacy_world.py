from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

SOURCE = Path('/root/.hermes/profiles/superagent/cache/images/img_94fa52fae938.jpg')
OUTPUT = Path('/root/jrc/public/assets/legacy-world')
OUTPUT.mkdir(parents=True, exist_ok=True)

source = Image.open(SOURCE).convert('RGB')


def grade(image: Image.Image, brightness: float, contrast: float, color: float) -> Image.Image:
    image = ImageEnhance.Color(image).enhance(color)
    image = ImageEnhance.Contrast(image).enhance(contrast)
    image = ImageEnhance.Brightness(image).enhance(brightness)
    return image.filter(ImageFilter.GaussianBlur(0.18))


def save_web(image: Image.Image, stem: str) -> None:
    image.save(OUTPUT / f'{stem}.webp', 'WEBP', quality=84, method=6)
    try:
        image.save(OUTPUT / f'{stem}.avif', 'AVIF', quality=58)
    except (KeyError, OSError):
        pass

# Desktop: retain the complete vertical journey and upscale only enough for texture use.
desktop = source.resize((1024, 2560), Image.Resampling.LANCZOS)
desktop = grade(desktop, brightness=0.58, contrast=0.92, color=0.72)
save_web(desktop, 'legacy-world-desktop')

# Mobile: central crop preserves the processional axis and removes noisy side architecture.
mobile_crop = ImageOps.fit(source, (360, 1280), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
mobile = mobile_crop.resize((720, 2560), Image.Resampling.LANCZOS)
mobile = grade(mobile, brightness=0.52, contrast=0.94, color=0.68)
save_web(mobile, 'legacy-world-mobile')

print(f'source={source.size} desktop={desktop.size} mobile={mobile.size}')
for path in sorted(OUTPUT.iterdir()):
    print(f'{path.name} {path.stat().st_size}')
