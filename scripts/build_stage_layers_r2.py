import os
import math
from PIL import Image, ImageDraw, ImageFilter

BASE_DIR = r'C:\Users\admin\Music\chufang'
ASSETS_CAT = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat')
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
os.makedirs(ASSETS_CAT, exist_ok=True)
os.makedirs(SHOTS_DIR, exist_ok=True)

STAGE_W = 170
STAGE_H = 1104

def build_stage_background():
    """Generates the fixed 170x1104 background: wall, light, counter base."""
    bg = Image.new('RGBA', (STAGE_W, STAGE_H), (234, 218, 194, 255))
    draw = ImageDraw.Draw(bg)

    # 1. Vertical wood planks
    plank_w = 34
    for i in range(STAGE_W // plank_w + 1):
        x0 = i * plank_w
        tone_offset = (i * 19) % 17 - 8
        r = min(255, max(0, 235 + tone_offset))
        g = min(255, max(0, 216 + tone_offset))
        b = min(255, max(0, 190 + tone_offset))
        draw.rectangle([x0, 0, x0 + plank_w, STAGE_H], fill=(r, g, b, 255))
        # Plank seam shadow and warm highlight
        draw.line([x0, 0, x0, STAGE_H], fill=(155, 120, 85, 220), width=1)
        draw.line([x0 + 1, 0, x0 + 1, STAGE_H], fill=(248, 238, 220, 140), width=1)

    # 2. Diagonal morning sunlight ray (fading across upper half)
    sun_overlay = Image.new('RGBA', (STAGE_W, STAGE_H), (0, 0, 0, 0))
    sun_draw = ImageDraw.Draw(sun_overlay)
    for y in range(650):
        alpha = int(48 * (1.0 - (y / 650.0) ** 1.2))
        sun_draw.rectangle([0, y, STAGE_W, y + 1], fill=(255, 250, 225, alpha))
    bg = Image.alpha_composite(bg, sun_overlay)
    draw = ImageDraw.Draw(bg)

    # 3. Minimalist wall shelf on upper right (x: 125..170, y: 220..235)
    draw.rectangle([122, 222, 170, 232], fill=(168, 118, 76, 255))
    draw.line([122, 222, 170, 222], fill=(215, 170, 125, 255), width=1)
    draw.line([122, 232, 170, 232], fill=(110, 70, 40, 255), width=1)
    # Tiny spice jars on shelf
    draw.rectangle([130, 206, 142, 222], fill=(240, 235, 220, 240), outline=(130, 100, 70, 255))
    draw.rectangle([132, 202, 140, 206], fill=(180, 120, 70, 255)) # lid
    draw.rectangle([148, 208, 162, 222], fill=(225, 180, 140, 240), outline=(130, 100, 70, 255))
    draw.rectangle([151, 204, 159, 208], fill=(160, 60, 40, 255)) # lid

    # 4. Main Countertop at y = 860
    counter_y = 860
    # Top surface (y: 860..895)
    draw.rectangle([0, counter_y, STAGE_W, counter_y + 35], fill=(198, 148, 98, 255))
    draw.line([0, counter_y, STAGE_W, counter_y], fill=(240, 200, 155, 255), width=2)
    draw.line([0, counter_y + 35, STAGE_W, counter_y + 35], fill=(130, 85, 48, 255), width=2)

    # Counter front face (y: 896..1104)
    draw.rectangle([0, counter_y + 36, STAGE_W, STAGE_H], fill=(142, 96, 56, 255))
    for i in range(STAGE_W // 28 + 1):
        cx = i * 28 + 14
        draw.line([cx, counter_y + 36, cx, STAGE_H], fill=(100, 62, 34, 255), width=2)
        draw.line([cx + 1, counter_y + 36, cx + 1, STAGE_H], fill=(165, 118, 75, 160), width=1)

    return bg

def build_printer_base(led_state='green'):
    """Generates the locked 82x80 printer body with slot and LED."""
    pw, ph = 82, 80
    printer = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    draw = ImageDraw.Draw(printer)

    # Printer drop shadow onto wall
    draw.rounded_rectangle([2, 4, pw - 2, ph - 2], radius=10, fill=(120, 95, 70, 70))

    # Main printer casing
    draw.rounded_rectangle([0, 0, pw - 4, ph - 6], radius=9, fill=(248, 249, 251, 255), outline=(195, 200, 208, 255), width=2)

    # Top paper roll cover lid
    draw.rounded_rectangle([6, 6, pw - 10, 48], radius=6, fill=(238, 241, 246, 255), outline=(210, 215, 224, 255), width=1)
    draw.line([10, 10, pw - 14, 10], fill=(255, 255, 255, 200), width=2) # glossy reflection

    # LED Indicator Light (x=62, y=36)
    led_colors = {
        'green': ((34, 197, 94, 255), (187, 247, 208, 255)),
        'amber': ((245, 158, 11, 255), (254, 240, 138, 255)),
        'off': ((156, 163, 175, 255), (209, 213, 219, 255))
    }
    col_main, col_hi = led_colors.get(led_state, led_colors['green'])
    draw.ellipse([60, 34, 68, 42], fill=col_main, outline=(100, 105, 115, 255))
    draw.ellipse([62, 35, 65, 38], fill=col_hi)

    # Paper Feed Slot at bottom (x: 12..66, y: 56..64)
    draw.rounded_rectangle([12, 56, 66, 64], radius=3, fill=(30, 36, 45, 255), outline=(15, 20, 28, 255), width=1)

    return printer

def build_printer_paper(extension_px=0, order_title="ORDER #101"):
    """
    Builds the paper ticket extending from the slot downwards.
    extension_px: 0 means retracted; 10..150 px extension down.
    """
    if extension_px <= 2:
        return None
    paper_w = 48
    paper_h = int(extension_px)
    paper = Image.new('RGBA', (paper_w, paper_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(paper)

    # Shadow on right and bottom
    draw.rectangle([1, 0, paper_w - 1, paper_h - 4], fill=(253, 253, 254, 255), outline=(215, 218, 224, 255))

    # Text lines on receipt
    lines_y = [10, 18, 26, 38, 46, 56, 66, 78, 90, 102, 116, 130]
    for ly in lines_y:
        if ly + 4 < paper_h - 8:
            if ly == 10:
                # bold order title line
                draw.line([6, ly, paper_w - 12, ly], fill=(45, 52, 65, 255), width=2)
            elif ly == 38:
                draw.line([6, ly, paper_w - 8, ly], fill=(120, 128, 140, 255), width=1) # dashed line
            else:
                line_len = 16 + ((ly * 29) % 20)
                draw.line([6, ly, 6 + line_len, ly], fill=(90, 98, 112, 255), width=1)

    # Serrated zigzag bottom tear edge
    teeth = 6
    tooth_w = paper_w / teeth
    for t in range(teeth):
        x_start = t * tooth_w
        x_mid = x_start + tooth_w / 2
        x_end = (t + 1) * tooth_w
        y_top = paper_h - 6
        y_bottom = paper_h - 1
        draw.polygon([(x_start, y_top), (x_mid, y_bottom), (x_end, y_top), (x_end, paper_h), (x_start, paper_h)], fill=(0, 0, 0, 0))

    return paper

def build_props_counter():
    """Generates the foreground countertop props (cutting board, pot, pass shelf)."""
    props = Image.new('RGBA', (STAGE_W, 260), (0, 0, 0, 0))
    draw = ImageDraw.Draw(props)

    # 1. Wooden Cutting Board (x: 10..106, y: 10..68)
    draw.rounded_rectangle([10, 10, 106, 68], radius=6, fill=(218, 172, 122, 255), outline=(155, 110, 68, 255), width=2)
    draw.rounded_rectangle([14, 14, 102, 64], radius=4, outline=(190, 145, 98, 160), width=1) # juice groove
    # Chopped spring scallions on board
    scallion_pts = [(24, 32), (32, 28), (40, 34), (48, 30), (58, 35), (66, 29), (76, 33)]
    for sx, sy in scallion_pts:
        draw.ellipse([sx, sy, sx + 6, sy + 5], fill=(74, 165, 82, 255), outline=(40, 110, 50, 255))
        draw.ellipse([sx + 2, sy + 1, sx + 4, sy + 3], fill=(168, 230, 150, 255))

    # Whole spring onion stems
    draw.line([22, 48, 86, 42], fill=(56, 142, 60, 255), width=3)
    draw.line([24, 52, 90, 47], fill=(76, 175, 80, 255), width=2)
    draw.ellipse([18, 46, 24, 51], fill=(245, 250, 235, 255), outline=(160, 190, 140, 255))

    # 2. Cooking Pot on Induction Plate (x: 114..164, y: 15..72)
    # Induction burner base
    draw.rectangle([114, 20, 164, 70], fill=(42, 45, 50, 255), outline=(25, 28, 32, 255))
    # Pot body (stainless steel / enamel)
    draw.rounded_rectangle([118, 16, 160, 56], radius=4, fill=(115, 122, 132, 255), outline=(65, 70, 78, 255), width=2)
    # Simmering broth inside pot
    draw.ellipse([120, 17, 158, 32], fill=(215, 145, 75, 255), outline=(160, 95, 45, 255))
    # Stew ingredients (tofu cubes, carrots)
    draw.rectangle([126, 21, 133, 27], fill=(248, 242, 225, 255))
    draw.ellipse([140, 22, 147, 28], fill=(235, 95, 42, 255))
    # Pot handle sticking out to left
    draw.rounded_rectangle([106, 24, 118, 29], radius=2, fill=(40, 42, 46, 255))

    # 3. Lower Serving Pass Shelf & Onigiri (y: 115..245)
    shelf_y = 115
    draw.rectangle([0, shelf_y, STAGE_W, shelf_y + 24], fill=(180, 130, 80, 255))
    draw.line([0, shelf_y, STAGE_W, shelf_y], fill=(225, 180, 135, 255), width=2)
    draw.line([0, shelf_y + 24, STAGE_W, shelf_y + 24], fill=(115, 75, 40, 255), width=2)
    # Shelf brackets
    draw.polygon([(25, shelf_y + 24), (32, shelf_y + 24), (25, shelf_y + 44)], fill=(120, 78, 42, 255))
    draw.polygon([(145, shelf_y + 24), (138, shelf_y + 24), (145, shelf_y + 44)], fill=(120, 78, 42, 255))

    # Ceramic plate on serving shelf
    draw.ellipse([55, shelf_y + 6, 115, shelf_y + 20], fill=(238, 242, 246, 255), outline=(180, 190, 202, 255), width=1)
    draw.ellipse([62, shelf_y + 8, 108, shelf_y + 18], fill=(248, 250, 252, 255))

    # Onigiri (rice ball with nori)
    # Triangular rounded polygon
    tri_pts = [(85, shelf_y - 12), (68, shelf_y + 11), (102, shelf_y + 11)]
    draw.polygon(tri_pts, fill=(252, 252, 252, 255), outline=(215, 220, 228, 255))
    # Nori seaweed wrap
    draw.rectangle([78, shelf_y - 2, 92, shelf_y + 11], fill=(32, 42, 38, 255))

    return props

if __name__ == '__main__':
    bg = build_stage_background()
    bg.save(os.path.join(ASSETS_CAT, 'stage_background.png'))
    bg.save(os.path.join(SHOTS_DIR, 'stage_background.png'))

    p_base = build_printer_base('green')
    p_base.save(os.path.join(ASSETS_CAT, 'printer.png'))
    p_base.save(os.path.join(SHOTS_DIR, 'printer.png'))

    props = build_props_counter()
    props.save(os.path.join(ASSETS_CAT, 'props_counter.png'))
    props.save(os.path.join(SHOTS_DIR, 'props_counter.png'))

    # Also build a test composite without cat to verify environment
    test_comp = bg.copy()
    # printer at x=44, y=30
    test_comp.paste(p_base, (44, 30), p_base)
    # props at x=0, y=860
    test_comp.paste(props, (0, 860), props)
    test_comp.save(os.path.join(SHOTS_DIR, 'test_r2_empty_stage.png'))

    print('[OK] stage_background.png, printer.png, props_counter.png created successfully!')
