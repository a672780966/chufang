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

# Cat Actor Card Dimensions (Canonical 2x: 170 x 260 px, renders at 85 x 130 px in CSS)
CARD_W = 170
CARD_H = 260

# Source high-resolution assets & calibrated crop boxes
# Format: (path, (x1, y1, x2, y2), scale_ratio)
SRC_META = {
    'ready': (os.path.join(ART_DIR, 'narrow_stage_master_1790356624694.jpg'), (110, 320, 670, 1180), 3.29),
    'tie': (os.path.join(ART_DIR, 'narrow_open_tie_1790356661183.jpg'), (110, 320, 670, 1180), 3.29),
    'cheer': (os.path.join(ART_DIR, 'narrow_open_cheer_1790356690652.jpg'), (110, 320, 670, 1180), 3.29),
    'chop': (os.path.join(ART_DIR, 'narrow_work_chop_1790356719385.jpg'), (110, 320, 670, 1180), 3.29),
    'stir': (os.path.join(ART_DIR, 'cat_work_stir_1790351635057.jpg'), (175, 430, 625, 1120), 2.65),
    'pass': (os.path.join(ART_DIR, 'cat_work_pass_1790351734241.jpg'), (175, 430, 625, 1120), 2.65),
    'dance_l': (os.path.join(ART_DIR, 'cat_win_dance_1790351847125.jpg'), (175, 450, 625, 1140), 2.65),
    'dance_r': (os.path.join(ART_DIR, 'cat_win_sway_1790351968371.jpg'), (175, 450, 625, 1140), 2.65),
    'victory': (os.path.join(ART_DIR, 'win_v2_f5_victory.png'), (60, 135, 370, 609), 1.82),
}

# Cache RGBA sources
print('Loading source image cache...')
SRC_CACHE = {}
for k, meta in SRC_META.items():
    if os.path.exists(meta[0]):
        SRC_CACHE[k] = Image.open(meta[0]).convert('RGBA')
    else:
        raise FileNotFoundError(f"Missing source asset for {k}: {meta[0]}")

def get_base_card(pose_key, dx=0, dy=0):
    """
    Extracts a card from high-res source using subpixel offset compensation.
    Zero border artifacts, zero stretching, pristine LANCZOS interpolation.
    """
    im, (x1, y1, x2, y2), scale = SRC_META[pose_key]
    sx1 = int(x1 - dx * scale)
    sy1 = int(y1 - dy * scale)
    sx2 = int(x2 - dx * scale)
    sy2 = int(y2 - dy * scale)

    # Clamp to image boundaries
    src_img = SRC_CACHE[pose_key]
    sx1 = max(0, min(sx1, src_img.width - 100))
    sy1 = max(0, min(sy1, src_img.height - 100))
    sx2 = max(sx1 + 100, min(sx2, src_img.width))
    sy2 = max(sy1 + 100, min(sy2, src_img.height))

    crop = src_img.crop((sx1, sy1, sx2, sy2))
    return crop.resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)

def blend_cards(card_a, card_b, alpha):
    """Smooth cross-dissolve blend between two cards (alpha: 0.0 to 1.0)."""
    return Image.blend(card_a, card_b, alpha)

def add_coin_fx(img, frame_idx, density=6):
    """Adds light celebratory golden coin particles cascading down."""
    out = img.copy()
    draw = ImageDraw.Draw(out)
    t = frame_idx
    # Golden coin sparkle seeds
    seeds = [
        (25, 15, 6), (75, 45, 8), (120, 20, 7), (145, 75, 6),
        (45, 110, 8), (105, 95, 7), (155, 140, 5), (35, 170, 7),
        (85, 150, 8), (130, 185, 6)
    ]
    for idx, (bx, by_off, radius) in enumerate(seeds[:density]):
        py = (t * 14 + by_off) % CARD_H
        px = bx + int(math.sin((t + idx * 3) * 0.4) * 4)
        if 10 <= py <= CARD_H - 15:
            # Draw sparkling gold coin
            draw.ellipse([px - radius, py - radius, px + radius, py + radius], fill=(255, 218, 50, 230), outline=(218, 160, 20, 255))
            # Center glint
            draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 255, 220, 255))
    return out

def save_animation_pack(state_name, frames, fps=10, loop=True):
    """Saves individual PNGs, Animated WebP, MP4, WebM, and Spritesheet+JSON."""
    out_dir = os.path.join(ACTOR_CAT_DIR, state_name)
    os.makedirs(out_dir, exist_ok=True)

    # 1. Save frame PNGs
    for idx, f in enumerate(frames):
        f.save(os.path.join(out_dir, f'frame_{idx:02d}.png'))

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

    print(f'[OK] Generated {state_name} package ({len(frames)} frames @ {fps}fps, loop={loop})')

# --- Build Discrete States ---
def build_discrete_states():
    # 1. cat_ready (12 frames, subtle breathing loop)
    ready_frames = []
    for i in range(12):
        bob = int(math.sin(i * 2 * math.pi / 12) * 1.5)
        ready_frames.append(get_base_card('ready', dy=bob))
    save_animation_pack('cat_ready', ready_frames, fps=10, loop=True)

    # 2. cat_tie (12 frames, once)
    tie_frames = []
    for i in range(12):
        pull = 2 if 3 <= i <= 8 else (1 if i in [2, 9] else 0)
        tie_frames.append(get_base_card('tie', dy=pull))
    save_animation_pack('cat_tie', tie_frames, fps=10, loop=False)

    # 3. cat_cheer (12 frames, once)
    cheer_frames = []
    for i in range(12):
        pump = -3 if 3 <= i <= 8 else (-1 if i in [2, 9] else 0)
        cheer_frames.append(get_base_card('cheer', dy=pump))
    save_animation_pack('cat_cheer', cheer_frames, fps=10, loop=False)

    # 4. cat_chop (12 frames, 3 chops per cycle, seamless loop)
    chop_frames = []
    for i in range(12):
        # Chop strike at frame 0, 4, 8
        phase = i % 4
        if phase == 0:
            dy = 2
        elif phase == 1:
            dy = 1
        elif phase == 2:
            dy = -1
        else:
            dy = 0
        chop_frames.append(get_base_card('chop', dy=dy))
    save_animation_pack('cat_chop', chop_frames, fps=10, loop=True)

    # 5. cat_stir (16 frames, circular stirring motion, seamless loop)
    stir_frames = []
    for i in range(16):
        ang = i * 2 * math.pi / 16
        dx = int(math.cos(ang) * 2.0)
        dy = int(math.sin(ang) * 1.5)
        stir_frames.append(get_base_card('stir', dx=dx, dy=dy))
    save_animation_pack('cat_stir', stir_frames, fps=10, loop=True)

    # 6. cat_pass (12 frames, slide plate forward, loop/once)
    pass_frames = []
    for i in range(12):
        push = int(math.sin(i * math.pi / 12) * 3)
        pass_frames.append(get_base_card('pass', dx=push))
    save_animation_pack('cat_pass', pass_frames, fps=10, loop=True)

    # 7. cat_dance (20 frames, meme dance sway left & right, seamless loop)
    dance_frames = []
    for i in range(20):
        if i < 10:
            sway = int(math.sin(i * math.pi / 10) * -2)
            dance_frames.append(get_base_card('dance_l', dx=sway))
        else:
            sway = int(math.sin((i - 10) * math.pi / 10) * 2)
            dance_frames.append(get_base_card('dance_r', dx=sway))
    save_animation_pack('cat_dance', dance_frames, fps=10, loop=True)

    # 8. cat_victory (16 frames, triumph bounce with golden sparkle shower)
    vic_frames = []
    for i in range(16):
        bob = int(math.sin(i * 2 * math.pi / 16) * 2.0)
        base = get_base_card('victory', dy=bob)
        vic_frames.append(add_coin_fx(base, i, density=7))
    save_animation_pack('cat_victory', vic_frames, fps=10, loop=True)

# --- Build Composite Playable Packs ---
def build_composite_packs():
    # 1. cat_open (26 frames: Ready -> Tie -> Cheer -> Settle)
    open_frames = []
    for i in range(26):
        if i < 6:
            # Ready phase
            bob = int(math.sin(i * 2 * math.pi / 6) * 1)
            open_frames.append(get_base_card('ready', dy=bob))
        elif i < 15:
            # Tie headband
            t = i - 6
            pull = 2 if 2 <= t <= 6 else 0
            card_tie = get_base_card('tie', dy=pull)
            if t < 2:
                # Blend ready -> tie
                alpha = (t + 1) / 3.0
                open_frames.append(blend_cards(get_base_card('ready'), card_tie, alpha))
            else:
                open_frames.append(card_tie)
        elif i < 22:
            # Cheer fists pump
            t = i - 15
            pump = -3 if 2 <= t <= 5 else 0
            card_cheer = get_base_card('cheer', dy=pump)
            if t < 2:
                alpha = (t + 1) / 3.0
                open_frames.append(blend_cards(get_base_card('tie'), card_cheer, alpha))
            else:
                open_frames.append(card_cheer)
        else:
            # Settle back to ready
            t = i - 22
            alpha = (t + 1) / 4.0
            open_frames.append(blend_cards(get_base_card('cheer'), get_base_card('ready'), alpha))
    save_animation_pack('cat_open', open_frames, fps=10, loop=False)

    # 2. cat_work_loop (72 frames, STRICT SEAMLESS LOOP)
    # Phase A: Chop (f0..f23)
    # Trans A->B: (f24..f27)
    # Phase B: Stir (f28..f47)
    # Trans B->C: (f48..f51)
    # Phase C: Pass (f52..f65)
    # Trans C->A: (f66..f71) [f71 seamlessly connects back to f0!]
    work_frames = []
    for i in range(72):
        if i < 24:
            # Active chop (3 chops)
            phase = i % 4
            dy = 2 if phase == 0 else (1 if phase == 1 else (-1 if phase == 2 else 0))
            work_frames.append(get_base_card('chop', dy=dy))
        elif i < 28:
            # Transition Chop -> Stir
            alpha = (i - 23) / 4.0
            card_c = get_base_card('chop', dy=0)
            card_s = get_base_card('stir', dx=0, dy=0)
            work_frames.append(blend_cards(card_c, card_s, alpha))
        elif i < 48:
            # Active stir (ladle circle)
            ang = (i - 28) * 2 * math.pi / 16
            dx = int(math.cos(ang) * 2.0)
            dy = int(math.sin(ang) * 1.5)
            work_frames.append(get_base_card('stir', dx=dx, dy=dy))
        elif i < 52:
            # Transition Stir -> Pass
            alpha = (i - 47) / 4.0
            card_s = get_base_card('stir', dx=0, dy=0)
            card_p = get_base_card('pass', dx=0)
            work_frames.append(blend_cards(card_s, card_p, alpha))
        elif i < 66:
            # Active pass
            push = int(math.sin((i - 52) * math.pi / 14) * 3)
            work_frames.append(get_base_card('pass', dx=push))
        else:
            # Transition Pass -> Chop (f66..f71)
            alpha = (i - 65) / 6.0
            card_p = get_base_card('pass', dx=0)
            # As i reaches 71, dy approaches 2 so f71 seamlessly matches f0 (dy=2)!
            target_dy = 2 if i == 71 else 0
            card_c = get_base_card('chop', dy=target_dy)
            work_frames.append(blend_cards(card_p, card_c, alpha))
    save_animation_pack('cat_work_loop', work_frames, fps=10, loop=True)

    # 3. cat_win (40 frames: Meme Dance -> Victory with Coin Shower)
    win_frames = []
    for i in range(40):
        if i < 4:
            # Quick ready anticipation
            win_frames.append(get_base_card('ready'))
        elif i < 22:
            # Viral meme dance sway
            t = i - 4
            if t < 9:
                sway = int(math.sin(t * math.pi / 9) * -2)
                card = get_base_card('dance_l', dx=sway)
            else:
                sway = int(math.sin((t - 9) * math.pi / 9) * 2)
                card = get_base_card('dance_r', dx=sway)
            win_frames.append(add_coin_fx(card, i, density=5))
        elif i < 26:
            # Transition Dance -> Victory
            alpha = (i - 21) / 4.0
            card_d = get_base_card('dance_r', dx=0)
            card_v = get_base_card('victory', dy=0)
            blended = blend_cards(card_d, card_v, alpha)
            win_frames.append(add_coin_fx(blended, i, density=7))
        else:
            # Triumphant victory cheer loop
            t = i - 26
            bob = int(math.sin(t * 2 * math.pi / 14) * 2.0)
            card_v = get_base_card('victory', dy=bob)
            win_frames.append(add_coin_fx(card_v, i, density=9))
    save_animation_pack('cat_win', win_frames, fps=10, loop=False)

def generate_cat_review_sheet():
    """Generates asset_review_sheet_cat.png displaying all 9 states cleanly."""
    states = [
        ('1. cat_ready', get_base_card('ready')),
        ('2. cat_tie', get_base_card('tie')),
        ('3. cat_cheer', get_base_card('cheer')),
        ('4. cat_chop', get_base_card('chop')),
        ('5. cat_stir', get_base_card('stir')),
        ('6. cat_pass', get_base_card('pass')),
        ('7. cat_dance (L)', get_base_card('dance_l')),
        ('8. cat_dance (R)', get_base_card('dance_r')),
        ('9. cat_victory', add_coin_fx(get_base_card('victory'), 8, density=8)),
    ]

    cols = 5
    rows = (len(states) + cols - 1) // cols
    card_w = CARD_W + 16
    card_h = CARD_H + 34

    sheet_w = cols * card_w + 20
    sheet_h = rows * card_h + 40
    sheet = Image.new('RGB', (sheet_w, sheet_h), (247, 241, 231))
    draw = ImageDraw.Draw(sheet)

    draw.text((15, 10), "CAT ACTOR ASSET REVIEW SHEET (DUAL ACTOR PACK)", fill=(70, 50, 30))

    for idx, (label, img) in enumerate(states):
        col = idx % cols
        row = idx // cols
        cx = 10 + col * card_w
        cy = 35 + row * card_h

        # Card container with clean border
        draw.rectangle([cx, cy, cx + card_w - 6, cy + card_h - 6], fill=(255, 255, 255), outline=(210, 190, 170))
        sheet.paste(img, (cx + 5, cy + 22))
        draw.text((cx + 6, cy + 5), label, fill=(50, 40, 30))

    out_shot = os.path.join(SHOTS_DIR, 'asset_review_sheet_cat.png')
    out_art = os.path.join(ART_DIR, 'asset_review_sheet_cat.png')
    sheet.save(out_shot)
    sheet.save(out_art)
    print(f'[OK] asset_review_sheet_cat.png generated! ({sheet_w}x{sheet_h})')

if __name__ == '__main__':
    print('Building Cat Actor Discrete States...')
    build_discrete_states()
    print('Building Cat Actor Composite Playable Packs...')
    build_composite_packs()
    print('Generating Cat Review Sheet...')
    generate_cat_review_sheet()
    print('[ALL DONE] Cat Actor Package complete!')
