import os
import math
import subprocess
from PIL import Image, ImageDraw, ImageFilter

BASE_DIR = r'C:\Users\admin\Music\chufang'
ASSETS_CAT = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat')
AUDIT_DIR = os.path.join(ASSETS_CAT, 'audit_frames')
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')

STAGE_W = 170
STAGE_H = 1104

# 1. Load static visual layers
bg = Image.open(os.path.join(ASSETS_CAT, 'stage_background.png')).convert('RGBA')
printer_base = Image.open(os.path.join(ASSETS_CAT, 'printer_base.png')).convert('RGBA')
printer_paper = Image.open(os.path.join(ASSETS_CAT, 'printer_paper.png')).convert('RGBA')
props_counter = Image.open(os.path.join(ASSETS_CAT, 'props_counter.png')).convert('RGBA')

# 2. Load and scale cat sprites
def load_sprite(name, scale, crop_box=None):
    im = Image.open(os.path.join(ASSETS_CAT, f'{name}.png')).convert('RGBA')
    if crop_box:
        im = im.crop(crop_box)
    sw = int(im.width * scale)
    sh = int(im.height * scale)
    return im.resize((sw, sh), Image.Resampling.LANCZOS)

sprites = {
    'ready': load_sprite('cat_ready', 0.23),
    'tie': load_sprite('cat_tie', 0.23),
    'cheer': load_sprite('cat_cheer', 0.25),
    'chop': load_sprite('cat_chop', 0.26),
    'stir': load_sprite('cat_stir', 0.44),
    'pass': load_sprite('cat_pass', 0.44),
    'dance_l': load_sprite('cat_dance_left', 0.44),
    'dance_r': load_sprite('cat_dance_right', 0.44),
    'victory': load_sprite('cat_victory', 0.44),
}

# 3. FX Generators
def generate_smoke(frame_idx, max_frames=5):
    """Smoke puff dissolving over the counter during opening."""
    if frame_idx >= max_frames:
        return None
    smoke = Image.new('RGBA', (STAGE_W, STAGE_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(smoke)
    progress = frame_idx / float(max_frames)
    alpha = int(180 * (1.0 - progress))
    radius = int(35 + progress * 50)
    center_x, center_y = 85, 780
    # Soft overlapping cloud puffs
    for dx, dy, r_off in [(-25, 0, 0), (25, 0, -5), (0, -20, 5), (-15, -30, -10), (15, -25, -5)]:
        cx = center_x + int(dx * (1 + progress * 0.5))
        cy = center_y + int(dy * (1 + progress * 0.5))
        r = radius + r_off
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, alpha))
    smoke = smoke.filter(ImageFilter.GaussianBlur(radius=8))
    return smoke

def generate_coins(frame_idx, total_frames=40):
    """Falling golden coin rain and sparkle stars during win celebration."""
    if frame_idx < 6:
        return None
    coins_img = Image.new('RGBA', (STAGE_W, STAGE_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(coins_img)
    t = frame_idx - 6

    # 12 deterministic coins falling with varied speeds
    coin_seeds = [
        (25, 18, 12), (48, 22, 14), (72, 16, 11), (95, 20, 13),
        (118, 24, 15), (142, 17, 12), (35, 25, 13), (60, 19, 12),
        (85, 23, 14), (110, 18, 11), (135, 21, 13), (155, 26, 15)
    ]
    for i, (x_base, speed, radius) in enumerate(coin_seeds):
        y_pos = (t * speed * 2 + i * 95) % 1050
        # Horizontal sway
        x_pos = int(x_base + math.sin(t * 0.4 + i) * 6)
        if 40 < y_pos < 1000:
            # Gold coin circle
            draw.ellipse([x_pos - radius, y_pos - radius, x_pos + radius, y_pos + radius],
                         fill=(255, 215, 0, 240), outline=(218, 165, 32, 255), width=2)
            # Inner coin ridge
            draw.ellipse([x_pos - radius + 3, y_pos - radius + 3, x_pos + radius - 3, y_pos + radius - 3],
                         outline=(255, 235, 120, 200), width=1)
            # Center star/glint
            draw.line([x_pos - 3, y_pos, x_pos + 3, y_pos], fill=(255, 255, 255, 220), width=1)
            draw.line([x_pos, y_pos - 3, x_pos, y_pos + 3], fill=(255, 255, 255, 220), width=1)

    # Sparkle stars
    sparkle_pts = [(30, 250), (140, 320), (50, 500), (120, 580), (85, 420)]
    for sx, sy in sparkle_pts:
        size = int(4 + math.sin(t * 0.6 + sx) * 3)
        draw.line([sx - size, sy, sx + size, sy], fill=(255, 255, 220, 240), width=2)
        draw.line([sx, sy - size, sx, sy + size], fill=(255, 255, 220, 240), width=2)

    return coins_img

# 4. Master Render Engine
def render_stage_frame(cat_name, cat_x, cat_y, paper_extend=0, fx_layer=None):
    """
    Renders a single pristine layered frame:
    Layer 0: Fixed background
    Layer 1: Printer paper (if extending from slot)
    Layer 2: Fixed printer body
    Layer 3: Cat character sprite
    Layer 4: Fixed countertop & cooking props
    Layer 5: Transparent FX layer (smoke/coins)
    """
    frame = bg.copy()

    # Layer 1: Printer paper
    if paper_extend > 0:
        # Scale/crop printer paper to extension length
        crop_h = min(printer_paper.height, int(paper_extend * 1.2))
        paper_strip = printer_paper.crop((0, 0, printer_paper.width, crop_h))
        # Paper exit slot is at printer y + 60, centered at x = 85
        paper_x = 85 - paper_strip.width // 2
        paper_y = 35 + 56
        frame.paste(paper_strip, (paper_x, paper_y), paper_strip)

    # Layer 2: Printer body (x=44, y=35)
    frame.paste(printer_base, (44, 35), printer_base)

    # Layer 3: Cat character
    if cat_name in sprites:
        sp = sprites[cat_name]
        frame.paste(sp, (int(cat_x), int(cat_y)), sp)

    # Layer 4: Countertop props (x=0, y=860)
    frame.paste(props_counter, (0, 860), props_counter)

    # Layer 5: FX
    if fx_layer:
        frame.paste(fx_layer, (0, 0), fx_layer)

    return frame

# 5. Build Animations
def build_open_animation():
    print('Generating OPEN animation (26 frames)...')
    out_dir = os.path.join(AUDIT_DIR, 'open')
    os.makedirs(out_dir, exist_ok=True)
    frames = []

    # Total 26 frames (2.6s @ 10fps)
    for i in range(26):
        fx = generate_smoke(i, max_frames=6)
        if i < 5:
            # Hidden / cloud opening
            f = render_stage_frame('tie', 20, 700, fx_layer=fx)
        elif i < 13:
            # Tying headband
            f = render_stage_frame('tie', 20, 700)
        elif i < 21:
            # Ganbatte cheer
            f = render_stage_frame('cheer', 31, 725)
        else:
            # Ready at counter
            f = render_stage_frame('ready', 31, 700)

        f_path = os.path.join(out_dir, f'frame_{i:03d}.png')
        f.save(f_path)
        frames.append(f)
    print('[OK] OPEN frames saved to audit_frames/open/')
    return frames

def build_work_animation():
    print('Generating WORK_LOOP animation (72 frames, STRICT SEAMLESS)...')
    out_dir = os.path.join(AUDIT_DIR, 'work')
    os.makedirs(out_dir, exist_ok=True)
    frames = []

    # Total 72 frames (7.2s @ 10fps)
    for i in range(72):
        if i < 20:
            # Chopping cycles (knife bob every 4 frames)
            chop_cycle = i % 4
            bob_y = 2 if chop_cycle in [0, 1] else 0
            f = render_stage_frame('chop', 36, 710 + bob_y)
        elif i < 32:
            # Look up at printer while ticket feeds
            feed_progress = (i - 20) / 11.0 # 0.0 to 1.0
            paper_len = int(10 + feed_progress * 55)
            f = render_stage_frame('ready', 31, 700, paper_extend=paper_len)
        elif i < 50:
            # Stirring saucepan
            stir_cycle = (i - 32) % 4
            stir_bob = 2 if stir_cycle in [0, 1] else 0
            f = render_stage_frame('stir', 25, 715 + stir_bob, paper_extend=65)
        elif i < 62:
            # Slide meal to pass
            f = render_stage_frame('pass', 22, 715, paper_extend=65)
        else:
            # Return smoothly to chopping stance (frames 62..71)
            # Frame 71 MUST match Frame 0 exactly for seamless looping!
            if i < 68:
                f = render_stage_frame('ready', 31, 700, paper_extend=max(0, int(65 * (1.0 - (i - 61) / 7.0))))
            else:
                # Frame 68..71: settled in chop stance; Frame 71 == Frame 0 (y = 712)
                f = render_stage_frame('chop', 36, 712)

        f_path = os.path.join(out_dir, f'frame_{i:03d}.png')
        f.save(f_path)
        frames.append(f)

    # Assert Frame 0 == Frame 71 for strict seamless loop
    diff = sum(sum(abs(a - b) for a, b in zip(frames[0].getpixel((x, y)), frames[71].getpixel((x, y))))
               for x in range(0, STAGE_W, 10) for y in range(0, STAGE_H, 10))
    print(f'[OK] WORK_LOOP frames saved. Frame 0 vs Frame 71 sample diff = {diff} (0 = identical!)')
    return frames

def build_win_animation():
    print('Generating WIN animation (40 frames, Viral Meme Dance)...')
    out_dir = os.path.join(AUDIT_DIR, 'win')
    os.makedirs(out_dir, exist_ok=True)
    frames = []

    # Total 40 frames (4.0s @ 10fps)
    for i in range(40):
        coins = generate_coins(i, total_frames=40)
        if i < 6:
            # Order complete pause
            f = render_stage_frame('ready', 31, 700)
        elif i < 12:
            # Gasp / surprise at coin shower
            f = render_stage_frame('cheer', 31, 725, fx_layer=coins)
        elif i < 22:
            # Meme dance sway LEFT (捂嘴扇风)
            f = render_stage_frame('dance_l', 20, 715, fx_layer=coins)
        elif i < 32:
            # Meme dance sway RIGHT (捂嘴换手扇风)
            f = render_stage_frame('dance_r', 26, 715, fx_layer=coins)
        else:
            # Double paws victory
            f = render_stage_frame('victory', 30, 700, fx_layer=coins)

        f_path = os.path.join(out_dir, f'frame_{i:03d}.png')
        f.save(f_path)
        frames.append(f)
    print('[OK] WIN frames saved to audit_frames/win/')
    return frames

def encode_videos():
    print('Encoding MP4 and WebM videos via ffmpeg...')
    anims = [
        ('restaurant_open', 'open', 10),
        ('restaurant_work_loop', 'work', 10),
        ('restaurant_win', 'win', 10),
    ]
    for vid_name, folder, fps in anims:
        frames_pattern = os.path.join(AUDIT_DIR, folder, 'frame_%03d.png')
        mp4_out = os.path.join(ASSETS_CAT, f'{vid_name}.mp4')
        webm_out = os.path.join(ASSETS_CAT, f'{vid_name}.webm')

        cmd_mp4 = [
            'ffmpeg', '-y', '-framerate', str(fps),
            '-i', frames_pattern,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-crf', '18', mp4_out
        ]
        cmd_webm = [
            'ffmpeg', '-y', '-framerate', str(fps),
            '-i', frames_pattern,
            '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p',
            '-crf', '24', '-b:v', '0', webm_out
        ]
        subprocess.run(cmd_mp4, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(cmd_webm, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f'  [OK] Encoded {vid_name}.mp4 and {vid_name}.webm')

if __name__ == '__main__':
    build_open_animation()
    build_work_animation()
    build_win_animation()
    encode_videos()
    print('[ALL COMPLETE] Stage 4.2 Round 2 layered animations rendered & encoded!')
