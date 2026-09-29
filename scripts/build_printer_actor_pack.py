import os
import json
import subprocess
from PIL import Image, ImageDraw

BASE_DIR = r'C:\Users\admin\Music\chufang'
ACTOR_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'printer')
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
ART_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'
os.makedirs(ACTOR_DIR, exist_ok=True)
os.makedirs(SHOTS_DIR, exist_ok=True)

# Canonical 2x canvas for printer actor: 96 x 84 px (renders at 48 x 42 px in UI)
CANVAS_W = 96
CANVAS_H = 84

# Load printer base and paper
printer_base = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat', 'printer_base.png')).convert('RGBA')
printer_paper = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat', 'printer_paper.png')).convert('RGBA')

# Position of printer body on the actor canvas (centered horizontally at top)
PB_X = (CANVAS_W - printer_base.width) // 2 # (96 - 82) // 2 = 7
PB_Y = 4 # Top margin

def render_printer_frame(paper_len=0, led_color='green'):
    """
    Renders one frame of the Printer Actor.
    The printer body is 100% locked at (PB_X, PB_Y).
    Paper feeds down through the slot at PB_Y + 54.
    """
    frame = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

    # 1. Paper strip emerging from behind slot
    if paper_len > 0:
        crop_h = min(printer_paper.height, int(paper_len))
        paper_strip = printer_paper.crop((0, 0, printer_paper.width, crop_h))
        px = CANVAS_W // 2 - paper_strip.width // 2
        py = PB_Y + 50
        frame.paste(paper_strip, (px, py), paper_strip)

    # 2. Printer body
    frame.paste(printer_base, (PB_X, PB_Y), printer_base)

    # 3. Status LED glow (x=PB_X + 62, y=PB_Y + 36)
    draw = ImageDraw.Draw(frame)
    lx = PB_X + 62
    ly = PB_Y + 36
    if led_color == 'amber':
        draw.ellipse([lx - 3, ly - 3, lx + 3, ly + 3], fill=(245, 158, 11, 255))
        draw.ellipse([lx - 1, ly - 1, lx + 1, ly + 1], fill=(254, 240, 138, 255))
    elif led_color == 'green':
        draw.ellipse([lx - 3, ly - 3, lx + 3, ly + 3], fill=(34, 197, 94, 255))
        draw.ellipse([lx - 1, ly - 1, lx + 1, ly + 1], fill=(187, 247, 208, 255))

    return frame

def build_printer_idle():
    """printer_idle: 10 frames @ 10fps with gentle steady green LED."""
    frames_dir = os.path.join(ACTOR_DIR, 'frames_idle')
    os.makedirs(frames_dir, exist_ok=True)
    frames = []

    for i in range(10):
        # Static printer, paper retracted, steady green LED
        f = render_printer_frame(paper_len=0, led_color='green')
        f.save(os.path.join(frames_dir, f'frame_{i:02d}.png'))
        frames.append(f)

    # Save animated WebP
    webp_path = os.path.join(ACTOR_DIR, 'printer_idle.webp')
    frames[0].save(webp_path, save_all=True, append_images=frames[1:], duration=100, loop=0)

    # Save MP4 & WebM
    subprocess.run([
        'ffmpeg', '-y', '-framerate', '10',
        '-i', os.path.join(frames_dir, 'frame_%02d.png'),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        os.path.join(ACTOR_DIR, 'printer_idle.mp4')
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    subprocess.run([
        'ffmpeg', '-y', '-framerate', '10',
        '-i', os.path.join(frames_dir, 'frame_%02d.png'),
        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
        os.path.join(ACTOR_DIR, 'printer_idle.webm')
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Generate Spritesheet
    build_spritesheet(frames, os.path.join(ACTOR_DIR, 'printer_idle'))
    print('[OK] printer_idle package generated!')

def build_printer_print():
    """printer_print: 16 frames @ 10fps: paper smoothly emerges downwards."""
    frames_dir = os.path.join(ACTOR_DIR, 'frames_print')
    os.makedirs(frames_dir, exist_ok=True)
    frames = []

    # Paper length timeline: 0 -> 4 -> 10 -> 18 -> 26 -> 34 -> 42 -> 50 -> 56 -> 60 -> 60...
    paper_lengths = [0, 4, 10, 18, 26, 34, 42, 48, 54, 58, 60, 60, 60, 60, 60, 60]
    for i, plen in enumerate(paper_lengths):
        led = 'amber' if (i % 4 < 2 and plen < 58) else 'green'
        f = render_printer_frame(paper_len=plen, led_color=led)
        f.save(os.path.join(frames_dir, f'frame_{i:02d}.png'))
        frames.append(f)

    # Save animated WebP
    webp_path = os.path.join(ACTOR_DIR, 'printer_print.webp')
    frames[0].save(webp_path, save_all=True, append_images=frames[1:], duration=100, loop=0)

    # Save MP4 & WebM
    subprocess.run([
        'ffmpeg', '-y', '-framerate', '10',
        '-i', os.path.join(frames_dir, 'frame_%02d.png'),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        os.path.join(ACTOR_DIR, 'printer_print.mp4')
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    subprocess.run([
        'ffmpeg', '-y', '-framerate', '10',
        '-i', os.path.join(frames_dir, 'frame_%02d.png'),
        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
        os.path.join(ACTOR_DIR, 'printer_print.webm')
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Generate Spritesheet
    build_spritesheet(frames, os.path.join(ACTOR_DIR, 'printer_print'))
    print('[OK] printer_print package generated!')

def build_spritesheet(frames, base_path):
    """Packages frames into a horizontal spritesheet with accompanying JSON metadata."""
    count = len(frames)
    w, h = frames[0].size
    sheet = Image.new('RGBA', (w * count, h), (0, 0, 0, 0))
    frames_meta = {}

    for idx, f in enumerate(frames):
        sheet.paste(f, (idx * w, 0))
        frames_meta[f'frame_{idx:02d}'] = {
            'frame': {'x': idx * w, 'y': 0, 'w': w, 'h': h},
            'sourceSize': {'w': w, 'h': h}
        }

    sheet.save(f'{base_path}_sheet.png')
    with open(f'{base_path}.json', 'w') as jf:
        json.dump({
            'frames': frames_meta,
            'meta': {'size': {'w': w * count, 'h': h}, 'scale': '1'}
        }, jf, indent=2)

def generate_printer_review_sheet():
    """Creates asset_review_sheet_printer.png."""
    idle_frame = render_printer_frame(paper_len=0, led_color='green')
    print_f1 = render_printer_frame(paper_len=18, led_color='amber')
    print_f2 = render_printer_frame(paper_len=42, led_color='amber')
    print_f3 = render_printer_frame(paper_len=60, led_color='green')

    items = [
        ('1. printer_idle (Static)', idle_frame),
        ('2. printer_print (Start Feed)', print_f1),
        ('3. printer_print (Mid Feed)', print_f2),
        ('4. printer_print (Complete)', print_f3)
    ]

    card_w = CANVAS_W + 16
    card_h = CANVAS_H + 36
    sheet = Image.new('RGB', (card_w * 4 + 20, card_h + 30), (247, 241, 231))
    draw = ImageDraw.Draw(sheet)

    draw.text((15, 8), "PRINTER ACTOR ASSET REVIEW SHEET", fill=(70, 50, 30))

    for idx, (label, img) in enumerate(items):
        cx = 10 + idx * card_w
        cy = 28
        # Card background
        draw.rectangle([cx, cy, cx + card_w - 6, cy + card_h], fill=(255, 255, 255), outline=(210, 190, 170))
        # Draw checkered pattern to prove transparency
        for ty in range(cy + 20, cy + 20 + CANVAS_H, 8):
            for tx in range(cx + 6, cx + 6 + CANVAS_W, 8):
                if (tx // 8 + ty // 8) % 2 == 0:
                    draw.rectangle([tx, ty, tx + 7, ty + 7], fill=(240, 240, 240))
        sheet.paste(img, (cx + 6, cy + 20), img)
        draw.text((cx + 6, cy + 4), label, fill=(50, 40, 30))

    out_shot = os.path.join(SHOTS_DIR, 'asset_review_sheet_printer.png')
    out_art = os.path.join(ART_DIR, 'asset_review_sheet_printer.png')
    sheet.save(out_shot)
    sheet.save(out_art)
    print('[OK] asset_review_sheet_printer.png generated!')

if __name__ == '__main__':
    build_printer_idle()
    build_printer_print()
    generate_printer_review_sheet()
    print('[ALL DONE] Printer Actor Package complete!')
