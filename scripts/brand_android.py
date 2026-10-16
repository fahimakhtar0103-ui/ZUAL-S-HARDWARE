"""Generate Zual Hardware Android launcher assets after capacitor add android.

Presentation-only resources. No backend or user records modified.
Requires Pillow installed on the GitHub Actions build runner.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("android/app/src/main/res")
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
]

def font(size):
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()

def create_icon(size, round_icon=False, adaptive=False):
    scale = 4
    width = size * scale
    img = Image.new("RGBA", (width, width), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if adaptive:
        left, top, right, bottom = [int(v * width) for v in (.22, .22, .78, .78)]
        draw.rounded_rectangle((left, top, right, bottom), radius=int(.115 * width), fill=(28, 59, 112, 255))
        draw.rounded_rectangle((left+int(.018*width), top+int(.018*width), right-int(.018*width), bottom-int(.018*width)),
                               radius=int(.10 * width), outline=(93, 154, 255, 120), width=max(1, int(.009*width)))
        size_font = int(width * .38)
        center_x = width // 2
        center_y = width // 2 - int(.012 * width)
    else:
        draw.rounded_rectangle((0, 0, width-1, width-1), radius=int(.22 * width), fill=(17, 34, 63, 255))
        if round_icon:
            mask = Image.new("L", (width, width), 0)
            md = ImageDraw.Draw(mask)
            md.ellipse((0,0,width-1,width-1),fill=255)
            img.putalpha(mask)
            draw = ImageDraw.Draw(img)
        draw.rounded_rectangle((int(.1*width), int(.1*width), int(.9*width), int(.9*width)),
                               radius=int(.18*width), outline=(65, 119, 213, 100), width=max(1, int(.012*width)))
        size_font = int(width * .66)
        center_x = width // 2
        center_y = width // 2 - int(.023 * width)
    face = font(size_font)
    bbox = draw.textbbox((0,0),"Z",font=face,stroke_width=0)
    x = center_x - (bbox[0]+bbox[2])//2
    y = center_y - (bbox[1]+bbox[3])//2
    draw.text((x,y), "Z", font=face, fill=(255,255,255,255))
    if not adaptive:
        draw.rounded_rectangle((int(.69*width),int(.78*width),int(.80*width),int(.805*width)),
                               radius=int(.012*width),fill=(82,160,255,255))
    return img.resize((size,size), Image.Resampling.LANCZOS)

def main():
    densities = {"mdpi":48, "hdpi":72, "xhdpi":96, "xxhdpi":144, "xxxhdpi":192}
    for density, size in densities.items():
        folder = ROOT / ("mipmap-" + density)
        folder.mkdir(parents=True,exist_ok=True)
        create_icon(size).save(folder/"ic_launcher.png")
        create_icon(size,round_icon=True).save(folder/"ic_launcher_round.png")
        create_icon(size*3,adaptive=True).save(folder/"ic_launcher_foreground.png")

    manifest = ROOT / "AndroidManifest.xml"
    if manifest.exists():
        markup = manifest.read_text()
        if 'android:windowSoftInputMode=' not in markup:
            markup = markup.replace('<activity', '<activity android:windowSoftInputMode="adjustResize"',1)
            manifest.write_text(markup)

    styles = ROOT / "values/styles.xml"
    if styles.exists():
        markup = styles.read_text()
        additions = ('<item name="android:statusBarColor">#F5F7FB</item>'
                     '<item name="android:windowLightStatusBar">true</item>'
                     '<item name="android:navigationBarColor">#FFFFFF</item>'
                     '<item name="android:windowLightNavigationBar">true</item>')
        marker = '<style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">'
        if marker in markup and 'android:windowLightStatusBar' not in markup:
            markup = markup.replace(marker,marker+additions,1)
            styles.write_text(markup)
    print("Generated Zual Hardware launcher assets for Android.")

if __name__ == "__main__":
    main()
