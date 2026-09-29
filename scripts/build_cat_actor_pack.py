import os
import json
import math
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE_DIR = r'C:\Users\admin\Music\chufang'
ACTOR_CAT_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'cat')
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
ART_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'

os.makedirs(ACTOR_CAT_DIR, exist_ok=True)
os.makedirs(SHOTS_DIR, exist_ok=True)

# Canonical card dimensions: 170 x 260 px
CARD_W = 170
CARD_H = 260

# Source high-resolution assets & calibrated crop boxes
SRC_META = {
    'ready': (os.path.join(ART_DIR, 'narrow_stage_master_1790356624694.jpg'), (110, 320, 670, 1180)),
    'tie': (os.path.join(ART_DIR, 'narrow_open_tie_1790356661183.jpg'), (110, 320, 670, 1180)),
    'cheer': (os.path.join(ART_DIR, 'narrow_open_cheer_1790356690652.jpg'), (110, 320, 670, 1180)),
    'chop': (os.path.join(ART_DIR, 'narrow_work_chop_1790356719385.jpg'), (110, 320, 670, 1180)),
    'stir': (os.path.join(ART_DIR, 'cat_work_stir_1790351635057.jpg'), (175, 430, 625, 1120)),
    'pass': (os.path.join(ART_DIR, 'cat_work_pass_1790351734241.jpg'), (175, 430, 625, 1120)),
    'dance_l': (os.path.join(ART_DIR, 'cat_win_dance_1790351847125.jpg'), (175, 450, 625, 1140)),
    'dance_r': (os.path.join(ART_DIR, 'cat_win_sway_1790351968371.jpg'), (175, 450, 625, 1140)),
    'victory': (os.path.join(ART_DIR, 'win_v2_f5_victory.png'), (60, 135, 370, 609)),
}

print('Loading base reference cards...')
BASE_CARDS = {}
for k, (p, box) in SRC_META.items():
    im = Image.open(p).crop(box).resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
    BASE_CARDS[k] = im.convert('RGBA')

# --- Helper: Save Animation Package ---
def save_animation_pack(state_name, frames, fps=10, loop=True):
    """Saves individual PNGs, Animated WebP, MP4, WebM, and Spritesheet+JSON."""
    out_dir = os.path.join(ACTOR_CAT_DIR, state_name)
    os.makedirs(out_dir, exist_ok=True)
    for existing in os.listdir(out_dir):
        if existing.endswith('.png'):
            try:
                os.remove(os.path.join(out_dir, existing))
            except Exception:
                pass

    # 1. Save frame PNGs
    for idx, f in enumerate(frames):
        f.convert('RGB').save(os.path.join(out_dir, f'frame_{idx:02d}.png'))

    # 2. Save Animated WebP
    webp_path = os.path.join(ACTOR_CAT_DIR, f'{state_name}.webp')
    loop_val = 0 if loop else 1
    duration_ms = int(1000 / fps)
    frames[0].save(webp_path, save_all=True, append_images=frames[1:], duration=duration_ms, loop=loop_val)

    # 3. Save MP4 & WebM
    mp4_path = os.path.join(ACTOR_CAT_DIR, f'{state_name}.mp4')
    webm_path = os.path.join(ACTOR_CAT_DIR, f'{state_name}.webm')

    subprocess.run([
        'ffmpeg', '-y', '-framerate', str(fps),
        '-i', os.path.join(out_dir, 'frame_%02d.png'),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        mp4_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    subprocess.run([
        'ffmpeg', '-y', '-framerate', str(fps),
        '-i', os.path.join(out_dir, 'frame_%02d.png'),
        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
        webm_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 4. Save Spritesheet + JSON
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
    sheet.save(os.path.join(ACTOR_CAT_DIR, f'{state_name}_sheet.png'))
    with open(os.path.join(ACTOR_CAT_DIR, f'{state_name}.json'), 'w') as jf:
        json.dump({
            'frames': frames_meta,
            'meta': {
                'size': {'w': w * count, 'h': h},
                'scale': '1',
                'format': 'RGBA8888',
                'fps': fps,
                'loop': loop
            }
        }, jf, indent=2)

    # 5. Generate complete contact sheet for verification
    save_contact_sheet(state_name, frames)
    print(f'[OK] Generated {state_name} package ({len(frames)} frames @ {fps}fps, loop={loop})')

def save_contact_sheet(state_name, frames, cols=6):
    """Generates an all-frames contact sheet grid with frame indices."""
    num_frames = len(frames)
    rows = (num_frames + cols - 1) // cols
    card_w, card_h = CARD_W, CARD_H
    label_h = 20
    pad = 8

    grid_w = cols * (card_w + pad) + pad
    grid_h = rows * (card_h + pad + label_h) + pad
    sheet = Image.new('RGB', (grid_w, grid_h), (245, 240, 232))
    draw = ImageDraw.Draw(sheet)

    for idx, f in enumerate(frames):
        col = idx % cols
        row = idx // cols
        x = pad + col * (card_w + pad)
        y = pad + row * (card_h + pad + label_h)

        sheet.paste(f.convert('RGB'), (x, y + label_h))
        draw.rectangle([x, y + label_h, x + card_w - 1, y + label_h + card_h - 1], outline=(180, 160, 140))
        draw.text((x + 2, y + 2), f'F{idx:02d}', fill=(60, 45, 30))

    out_shot = os.path.join(SHOTS_DIR, f'contact_{state_name}.png')
    out_art = os.path.join(ART_DIR, f'contact_{state_name}.png')
    sheet.save(out_shot)
    sheet.save(out_art)

# ==============================================================================
# 1. cat_chop (12 frames, seamless loop)
# Background: 100% frozen. Active elements: Knife lifts, chops, glints, scallions bounce.
# ==============================================================================
def build_chop_pack():
    base = BASE_CARDS['chop'].copy()
    
    # Clean board behind knife (x: 58..95, y: 172..215)
    bg_clean = base.copy()
    board_patch = base.crop((25, 175, 55, 215))
    bg_clean.paste(board_patch, (60, 175))
    bg_draw = ImageDraw.Draw(bg_clean)
    for sx, sy in [(65, 185), (72, 192), (80, 198), (70, 205), (85, 202), (75, 212)]:
        bg_draw.ellipse([sx - 3, sy - 3, sx + 3, sy + 3], fill=(85, 155, 68), outline=(50, 110, 42))

    # Knife + paw sprite
    knife_crop = base.crop((45, 145, 105, 220))
    mask = Image.new('L', (60, 75), 0)
    m_draw = ImageDraw.Draw(mask)
    paw_knife_poly = [(5, 10), (32, 5), (44, 25), (50, 45), (55, 68), (38, 72), (24, 52), (16, 35), (2, 28)]
    m_draw.polygon(paw_knife_poly, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    knife_sprite = knife_crop.copy()
    knife_sprite.putalpha(mask)

    frames = []
    for i in range(12):
        f = bg_clean.copy()
        phase = i % 4
        
        if phase == 0:
            # Impact: knife strikes down, blade glint, scallion bounce, slight head dip
            dy = 0
            rot = 0
            glint = True
            bounce = True
            head_dip = 1
        elif phase == 1:
            dy = -2
            rot = 1
            glint = False
            bounce = False
            head_dip = 0
        elif phase == 2:
            dy = -5
            rot = 3
            glint = False
            bounce = False
            head_dip = -1
        else: # phase == 3
            dy = -8
            rot = 5
            glint = False
            bounce = False
            head_dip = -1

        # Cat head subtle reaction (background remains 100% frozen!)
        if head_dip != 0:
            head_patch = base.crop((20, 10, 150, 140))
            f.paste(head_patch, (20, 10 + head_dip))

        # Knife rotated and translated
        k_rot = knife_sprite.rotate(rot, resample=Image.Resampling.BILINEAR, expand=True)
        f.paste(k_rot, (45 - (rot // 2), 145 + dy), k_rot)

        # Scallion bounce and blade glint
        if bounce:
            f_draw = ImageDraw.Draw(f)
            for bx, by in [(72, 168), (84, 172), (65, 175)]:
                f_draw.ellipse([bx - 2, by - 2, bx + 2, by + 2], fill=(120, 205, 90), outline=(60, 130, 45))
            f_draw.line([62, 185 + dy, 90, 210 + dy], fill=(255, 255, 255, 240), width=2)

        frames.append(f)

    save_animation_pack('cat_chop', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 2. cat_stir (16 frames, seamless loop)
# Background: 100% frozen. Active elements: Paws+ladle circular stir, swirling soup, steam.
# ==============================================================================
def build_stir_pack():
    base = BASE_CARDS['stir'].copy()

    # Extract paws + ladle handle sprite (x: 40..130, y: 110..195)
    stir_crop = base.crop((40, 110, 130, 195))
    stir_mask = Image.new('L', (90, 85), 0)
    s_draw = ImageDraw.Draw(stir_mask)
    # Polygon covering cat paws and wooden ladle
    s_poly = [(15, 15), (65, 10), (75, 45), (60, 75), (40, 80), (10, 65), (5, 35)]
    s_draw.polygon(s_poly, fill=255)
    stir_mask = stir_mask.filter(ImageFilter.GaussianBlur(1.5))
    stir_sprite = stir_crop.copy()
    stir_sprite.putalpha(stir_mask)

    frames = []
    for i in range(16):
        f = base.copy()
        draw = ImageDraw.Draw(f)
        ang = i * 2 * math.pi / 16
        dx = int(math.cos(ang) * 3.5)
        dy = int(math.sin(ang) * 1.8)

        # 1. Swirling soup surface inside pot (x: 100..145, y: 165..180)
        soup_cx, soup_cy = 122, 173
        for ring in [14, 10, 6]:
            r_ang = ang + ring * 0.4
            sx = soup_cx + int(math.cos(r_ang) * (ring * 0.7))
            sy = soup_cy + int(math.sin(r_ang) * (ring * 0.3))
            draw.ellipse([sx - 2, sy - 1, sx + 2, sy + 1], fill=(235, 165, 80, 220))

        # 2. Paste moving paws + ladle
        f.paste(stir_sprite, (40 + dx, 110 + dy), stir_sprite)

        # 3. Dynamic steam wisps curling and rising
        for wisp_idx in range(3):
            phase = (i + wisp_idx * 5) % 16
            progress = phase / 16.0
            sy = int(160 - progress * 45)
            sx = int(125 + math.sin(progress * math.pi * 2 + wisp_idx) * 6)
            alpha = int(180 * (1.0 - progress))
            radius = int(4 + progress * 7)
            steam_layer = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
            st_draw = ImageDraw.Draw(steam_layer)
            st_draw.ellipse([sx - radius, sy - radius, sx + radius, sy + radius], fill=(255, 255, 255, alpha))
            steam_layer = steam_layer.filter(ImageFilter.GaussianBlur(2.0))
            f.paste(steam_layer, (0, 0), steam_layer)

        frames.append(f)

    save_animation_pack('cat_stir', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 3. cat_pass (12 frames, loop/once)
# Background: 100% frozen. Active elements: Plate+paws slide forward with speed lines.
# ==============================================================================
def build_pass_pack():
    base = BASE_CARDS['pass'].copy()

    # Plate + paws sprite (x: 25..120, y: 140..225)
    plate_crop = base.crop((25, 140, 120, 225))
    plate_mask = Image.new('L', (95, 85), 0)
    p_draw = ImageDraw.Draw(plate_mask)
    p_poly = [(15, 15), (75, 15), (90, 45), (85, 80), (35, 80), (10, 55)]
    p_draw.polygon(p_poly, fill=255)
    plate_mask = plate_mask.filter(ImageFilter.GaussianBlur(1.5))
    plate_sprite = plate_crop.copy()
    plate_sprite.putalpha(plate_mask)

    frames = []
    for i in range(12):
        f = base.copy()
        draw = ImageDraw.Draw(f)

        # Slide forward motion: f0..f2 rest, f3..f7 slide forward, f8..f11 hold
        if i < 3:
            dx, dy = 0, 0
            speed_lines = False
        elif i < 8:
            t = (i - 2) / 5.0
            dx = int(-3 * math.sin(t * math.pi / 2))
            dy = int(8 * math.sin(t * math.pi / 2))
            speed_lines = True
        else:
            dx, dy = -3, 8
            speed_lines = False

        # Speed lines on counter
        if speed_lines:
            for ly in [195, 205, 215]:
                lx = 45 + ly // 4
                draw.line([lx, ly, lx + 25, ly - 6], fill=(255, 255, 255, 180), width=2)

        # Paste plate + paws
        f.paste(plate_sprite, (25 + dx, 140 + dy), plate_sprite)

        frames.append(f)

    save_animation_pack('cat_pass', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 4. cat_dance (20 frames, seamless loop)
# Background: 100% frozen. Active elements: Meme dance left & right body sway, giggling paw, sparkles.
# ==============================================================================
def build_dance_pack():
    base_l = BASE_CARDS['dance_l'].copy()
    base_r = BASE_CARDS['dance_r'].copy()

    frames = []
    for i in range(20):
        if i < 10:
            # Dance Left: paw covers mouth, body sways left
            f = base_l.copy()
            sway = int(math.sin(i * math.pi / 10) * -2)
        else:
            # Dance Right: other paw waves, body sways right
            f = base_r.copy()
            sway = int(math.sin((i - 10) * math.pi / 10) * 2)

        # Sparkling stars around cat head
        draw = ImageDraw.Draw(f)
        sparkle_t = i * 0.8
        for sx, sy in [(30, 45), (145, 55), (20, 110), (150, 120)]:
            size = int(2 + math.sin(sparkle_t + sx) * 2)
            draw.line([sx - size, sy, sx + size, sy], fill=(255, 255, 220, 240), width=2)
            draw.line([sx, sy - size, sx, sy + size], fill=(255, 255, 220, 240), width=2)

        frames.append(f)

    save_animation_pack('cat_dance', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 5. cat_victory (16 frames, seamless loop)
# Background: 100% frozen. Active elements: Paws pump in triumph, golden coins shower.
# ==============================================================================
def build_victory_pack():
    base = BASE_CARDS['victory'].copy()

    # Arms pump sprite (x: 15..155, y: 15..135)
    arms_crop = base.crop((15, 15, 155, 135))
    arms_mask = Image.new('L', (140, 120), 0)
    a_draw = ImageDraw.Draw(arms_mask)
    a_draw.polygon([(10, 10), (130, 10), (120, 110), (20, 110)], fill=255)
    arms_mask = arms_mask.filter(ImageFilter.GaussianBlur(1.5))
    arms_sprite = arms_crop.copy()
    arms_sprite.putalpha(arms_mask)

    frames = []
    for i in range(16):
        f = base.copy()
        # Arm pump bounce (+3px on upbeat)
        pump_dy = int(math.sin(i * 2 * math.pi / 16) * 3.0)
        f.paste(arms_sprite, (15, 15 + pump_dy), arms_sprite)

        # Cascading golden coins
        draw = ImageDraw.Draw(f)
        for seed_idx, (bx, by_off, radius) in enumerate([(25, 20, 6), (70, 50, 8), (115, 25, 7), (145, 70, 6), (45, 110, 7), (135, 130, 6)]):
            py = (i * 15 + by_off) % CARD_H
            px = bx + int(math.sin(i * 0.4 + seed_idx) * 4)
            if 15 < py < CARD_H - 15:
                draw.ellipse([px - radius, py - radius, px + radius, py + radius], fill=(255, 215, 50, 230), outline=(218, 160, 20, 255))
                draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 255, 220, 255))

        frames.append(f)

    save_animation_pack('cat_victory', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 6. cat_ready (12 frames, seamless loop)
# Background: 100% frozen. Active elements: Organic breathing, ear twitch, eye blink.
# ==============================================================================
def build_ready_pack():
    base = BASE_CARDS['ready'].copy()

    frames = []
    for i in range(12):
        f = base.copy()
        draw = ImageDraw.Draw(f)

        # Subtle chest breath (1px)
        breath = int(math.sin(i * 2 * math.pi / 12) * 1.0)
        if breath > 0:
            chest_patch = base.crop((45, 75, 125, 150))
            f.paste(chest_patch, (45, 75 - breath))

        # Eye blink on f5, f6
        if i in [5, 6]:
            # Closed happy eye curves over eyes (x: 48..65 and 105..122, y: 70..80)
            for ex in [52, 110]:
                draw.arc([ex, 72, ex + 14, 78], start=0, end=180, fill=(75, 45, 25), width=2)

        # Steam wisp from background pot
        steam_y = int(140 - (i / 12.0) * 30)
        draw.ellipse([140, steam_y, 146, steam_y + 8], fill=(255, 255, 255, 140))

        frames.append(f)

    save_animation_pack('cat_ready', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 7. cat_tie (12 frames, single shot)
# Background: 100% frozen. Active elements: Paws pull headband ribbons tight, head lowers.
# ==============================================================================
def build_tie_pack():
    base = BASE_CARDS['tie'].copy()

    frames = []
    for i in range(12):
        f = base.copy()
        # f3..f7: tension pull (head lowers 1px, knot tightens)
        if 3 <= i <= 7:
            head_patch = base.crop((30, 20, 140, 130))
            f.paste(head_patch, (30, 21))

        frames.append(f)

    save_animation_pack('cat_tie', frames, fps=10, loop=False)
    return frames

# ==============================================================================
# 8. cat_cheer (12 frames, single shot)
# Background: 100% frozen. Active elements: Double fists pump up into air (+5px).
# ==============================================================================
def build_cheer_pack():
    base = BASE_CARDS['cheer'].copy()

    frames = []
    for i in range(12):
        f = base.copy()
        # f2..f8: enthusiastic fist pump up (+4px)
        if 2 <= i <= 8:
            fists_patch = base.crop((20, 15, 150, 130))
            f.paste(fists_patch, (20, 12))

        frames.append(f)

    save_animation_pack('cat_cheer', frames, fps=10, loop=False)
    return frames

# ==============================================================================
# 9. Composite Sequences (STRICT SEQUENTIAL PLAYBACK, ZERO CROSS-FADE BLENDING!)
# ==============================================================================
def build_composite_packs(chop_frames, stir_frames, pass_frames, ready_frames, dance_frames, vic_frames, tie_frames, cheer_frames):
    # --- cat_work_loop ---
    # Sequential order:
    # 1. Chop (16 frames)
    # 2. Ready neutral transition (2 frames)
    # 3. Stir (16 frames)
    # 4. Ready neutral transition (2 frames)
    # 5. Pass (12 frames)
    # 6. Ready neutral transition (2 frames)
    # Total: 50 frames. ZERO GHOSTS. Every single frame has ONLY ONE SCENE.
    work_seq = []
    work_seq.extend([chop_frames[i % len(chop_frames)] for i in range(16)])
    work_seq.extend([ready_frames[0], ready_frames[1]]) # 2-frame neutral transition
    work_seq.extend([stir_frames[i % len(stir_frames)] for i in range(16)])
    work_seq.extend([ready_frames[0], ready_frames[1]]) # 2-frame neutral transition
    work_seq.extend([pass_frames[i % len(pass_frames)] for i in range(12)])
    work_seq.extend([ready_frames[0], ready_frames[1]]) # 2-frame neutral transition
    save_animation_pack('cat_work_loop', work_seq, fps=10, loop=True)

    # --- cat_open ---
    # Sequential order:
    # 1. Ready (4 frames)
    # 2. Tie (12 frames)
    # 3. Cheer (10 frames)
    # 4. Ready (4 frames)
    # Total: 30 frames. Clean cuts.
    open_seq = []
    open_seq.extend([ready_frames[i % len(ready_frames)] for i in range(4)])
    open_seq.extend(tie_frames)
    open_seq.extend(cheer_frames[:10])
    open_seq.extend([ready_frames[i % len(ready_frames)] for i in range(4)])
    save_animation_pack('cat_open', open_seq, fps=10, loop=False)

    # --- cat_win ---
    # Sequential order:
    # 1. Dance (20 frames)
    # 2. Victory (16 frames)
    # Total: 36 frames. Clean cut between dance and victory. ZERO blending.
    win_seq = []
    win_seq.extend(dance_frames)
    win_seq.extend(vic_frames)
    save_animation_pack('cat_win', win_seq, fps=10, loop=False)

def generate_cat_review_sheet(chop_frames, stir_frames, pass_frames, ready_frames, dance_frames, vic_frames, tie_frames, cheer_frames):
    """Generates the clean 9-state asset_review_sheet_cat.png."""
    states = [
        ('1. cat_ready', ready_frames[0]),
        ('2. cat_tie', tie_frames[5]),
        ('3. cat_cheer', cheer_frames[5]),
        ('4. cat_chop', chop_frames[0]),
        ('5. cat_stir', stir_frames[4]),
        ('6. cat_pass', pass_frames[5]),
        ('7. cat_dance (L)', dance_frames[3]),
        ('8. cat_dance (R)', dance_frames[13]),
        ('9. cat_victory', vic_frames[4]),
    ]

    cols = 5
    rows = (len(states) + cols - 1) // cols
    card_w = CARD_W + 16
    card_h = CARD_H + 34

    sheet_w = cols * card_w + 20
    sheet_h = rows * card_h + 40
    sheet = Image.new('RGB', (sheet_w, sheet_h), (247, 241, 231))
    draw = ImageDraw.Draw(sheet)

    draw.text((15, 10), "CAT ACTOR ASSET REVIEW SHEET (DUAL ACTOR REVISION 2)", fill=(70, 50, 30))

    for idx, (label, img) in enumerate(states):
        col = idx % cols
        row = idx // cols
        cx = 10 + col * card_w
        cy = 35 + row * card_h

        draw.rectangle([cx, cy, cx + card_w - 6, cy + card_h - 6], fill=(255, 255, 255), outline=(210, 190, 170))
        sheet.paste(img.convert('RGB'), (cx + 5, cy + 22))
        draw.text((cx + 6, cy + 5), label, fill=(50, 40, 30))

    out_shot = os.path.join(SHOTS_DIR, 'asset_review_sheet_cat.png')
    out_art = os.path.join(ART_DIR, 'asset_review_sheet_cat.png')
    sheet.save(out_shot)
    sheet.save(out_art)
    print(f'[OK] asset_review_sheet_cat.png generated! ({sheet_w}x{sheet_h})')

if __name__ == '__main__':
    print('Building Cat Actor Discrete States with True Internal Motion...')
    chop_f = build_chop_pack()
    stir_f = build_stir_pack()
    pass_f = build_pass_pack()
    dance_f = build_dance_pack()
    vic_f = build_victory_pack()
    ready_f = build_ready_pack()
    tie_f = build_tie_pack()
    cheer_f = build_cheer_pack()

    print('Building Composite Playable Packs (Strict Sequential Playback, ZERO Blending)...')
    build_composite_packs(chop_f, stir_f, pass_f, ready_f, dance_f, vic_f, tie_f, cheer_f)

    print('Generating Asset Review Sheet...')
    generate_cat_review_sheet(chop_f, stir_f, pass_f, ready_f, dance_f, vic_f, tie_f, cheer_f)
    print('[ALL DONE] Dual Actor Revision 2 Cat Actor Package complete!')
