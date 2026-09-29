import os
import json
import subprocess
from PIL import Image, ImageDraw

BASE_DIR = r'C:\Users\admin\Music\chufang'
ACTOR_CAT_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'cat')
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
ART_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'

os.makedirs(ACTOR_CAT_DIR, exist_ok=True)
os.makedirs(SHOTS_DIR, exist_ok=True)

# 170 x 260 px canonical card dimensions
CARD_W = 170
CARD_H = 260

# Source keyframes
KEYFRAMES = {
    # 1. Idle
    'idle_open': (os.path.join(ART_DIR, 'narrow_stage_master_1790356624694.jpg'), (110, 320, 670, 1180)),
    'idle_blink': (os.path.join(ART_DIR, 'cat_idle_blink_1790668791169.jpg'), (110, 320, 670, 1180)),
    # 2. Chop
    'chop_down': (os.path.join(ART_DIR, 'narrow_work_chop_1790356719385.jpg'), (110, 320, 670, 1180)),
    'chop_mid': (os.path.join(ART_DIR, 'cat_chop_mid_1790668629226.jpg'), (110, 320, 670, 1180)),
    'chop_up': (os.path.join(ART_DIR, 'cat_chop_lift_1790668569114.jpg'), (110, 320, 670, 1180)),
    # 3. Stir
    'stir_down': (os.path.join(ART_DIR, 'cat_work_stir_1790351635057.jpg'), (175, 450, 625, 1140)),
    'stir_up': (os.path.join(ART_DIR, 'cat_stir_pos2_1790668658855.jpg'), (175, 450, 625, 1140)),
    # 4. Pass
    'pass_slide': (os.path.join(ART_DIR, 'cat_work_pass_1790351734241.jpg'), (175, 450, 625, 1140)),
    'pass_serve': (os.path.join(ART_DIR, 'cat_pass_pos2_1790668721163.jpg'), (175, 450, 625, 1140)),
    # 5. Win
    'win_dance': (os.path.join(ART_DIR, 'cat_win_dance_1790351847125.jpg'), (175, 450, 625, 1140)),
    'win_sway': (os.path.join(ART_DIR, 'cat_win_sway_1790351968371.jpg'), (175, 450, 625, 1140)),
    'win_cheer': (os.path.join(ART_DIR, 'cat_win_cheer_1790668828116.jpg'), (175, 450, 625, 1140)),
}

print('Loading and cropping keyframes...')
CROPPED_KEYS = {}
for k, (p, box) in KEYFRAMES.items():
    im = Image.open(p).crop(box).resize((CARD_W, CARD_H), Image.Resampling.LANCZOS).convert('RGB')
    CROPPED_KEYS[k] = im

def save_contact_sheet(state_name, frames, cols=6):
    """Generates an all-frames contact sheet grid."""
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

        sheet.paste(f, (x, y + label_h))
        draw.rectangle([x, y + label_h, x + card_w - 1, y + label_h + card_h - 1], outline=(180, 160, 140))
        draw.text((x + 2, y + 2), f'F{idx:02d}', fill=(60, 45, 30))

    out_shot = os.path.join(SHOTS_DIR, f'contact_{state_name}.png')
    out_art = os.path.join(ART_DIR, f'contact_{state_name}.png')
    sheet.save(out_shot)
    sheet.save(out_art)

def save_pack(state_name, frames, fps=10, loop=True):
    """Encodes frames to PNGs, WebP, MP4, WebM, and Spritesheet+JSON."""
    out_dir = os.path.join(ACTOR_CAT_DIR, state_name)
    os.makedirs(out_dir, exist_ok=True)

    # Clean existing PNGs safely
    for f in os.listdir(out_dir):
        if f.endswith('.png'):
            try:
                os.remove(os.path.join(out_dir, f))
            except Exception:
                pass

    # 1. Save PNG frames
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

    save_contact_sheet(state_name, frames)
    print(f'[OK] Generated {state_name} ({count} frames @ {fps}fps, loop={loop})')

# ==============================================================================
# 1. cat_idle (16 frames, 1.6s seamless loop: eyes open attentive -> gentle blink)
# ==============================================================================
def build_cat_idle():
    f_open = CROPPED_KEYS['idle_open']
    f_blink = CROPPED_KEYS['idle_blink']

    frames = []
    # f0..f5: eyes open looking forward
    for _ in range(6):
        frames.append(f_open)
    # f6: transition
    frames.append(f_open)
    # f7..f9: contented gentle blink
    for _ in range(3):
        frames.append(f_blink)
    # f10: transition
    frames.append(f_open)
    # f11..f15: eyes open attentive
    for _ in range(5):
        frames.append(f_open)

    save_pack('cat_idle', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 2. cat_chop (12 frames, 1.2s seamless loop: 2 authentic chop cycles)
# Cycle: Impact -> Lift High -> Mid-swing down with blade motion blur -> Impact
# ==============================================================================
def build_cat_chop():
    f_down = CROPPED_KEYS['chop_down']
    f_mid = CROPPED_KEYS['chop_mid']
    f_up = CROPPED_KEYS['chop_up']

    frames = []
    # Cycle 1 (6 frames)
    frames.append(f_down) # f00: Strike down impact on scallions
    frames.append(f_down) # f01: Settle impact
    frames.append(f_up)   # f02: Knife lifted high in right paw
    frames.append(f_up)   # f03: Apex hold
    frames.append(f_mid)  # f04: Mid-swing downwards with anime blade speed blur!
    frames.append(f_mid)  # f05: Descending into strike

    # Cycle 2 (6 frames)
    frames.append(f_down) # f06: Strike down impact on scallions
    frames.append(f_down) # f07: Settle impact
    frames.append(f_up)   # f08: Knife lifted high
    frames.append(f_up)   # f09: Apex hold
    frames.append(f_mid)  # f10: Mid-swing downwards with speed blur!
    frames.append(f_mid)  # f11: Descending into f00

    save_pack('cat_chop', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 3. cat_stir (16 frames, 1.6s seamless loop: Ladle down in pot -> Scooping up with steam)
# ==============================================================================
def build_cat_stir():
    f_down = CROPPED_KEYS['stir_down']
    f_up = CROPPED_KEYS['stir_up']

    frames = []
    # f00..f04: Ladle down in simmering pot stirring broth
    for _ in range(5):
        frames.append(f_down)
    # f05..f07: Scooping upward
    for _ in range(3):
        frames.append(f_up)
    # f08..f12: Ladle high, soup droplets & billowing steam cloud
    for _ in range(5):
        frames.append(f_up)
    # f13..f15: Returning ladle back down into pot
    for _ in range(3):
        frames.append(f_down)

    save_pack('cat_stir', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 4. cat_pass (12 frames, 1.2s: Slide plate forward -> Present with sparkling eyes)
# ==============================================================================
def build_cat_pass():
    f_slide = CROPPED_KEYS['pass_slide']
    f_serve = CROPPED_KEYS['pass_serve']

    frames = []
    # f00..f04: Sliding plate forward along counter with motion lines
    for _ in range(5):
        frames.append(f_slide)
    # f05..f10: Plate presented at front counter edge, eyes wide & sparkling with joy!
    for _ in range(6):
        frames.append(f_serve)
    # f11: Ease back to rest
    frames.append(f_slide)

    save_pack('cat_pass', frames, fps=10, loop=True)
    return frames

# ==============================================================================
# 5. cat_win (24 frames, 2.4s: Meme dance left -> Sway right -> Victory cheer)
# Entire sequence in 100% IDENTICAL KITCHEN SCENE!
# ==============================================================================
def build_cat_win():
    f_dance = CROPPED_KEYS['win_dance']
    f_sway = CROPPED_KEYS['win_sway']
    f_cheer = CROPPED_KEYS['win_cheer']

    frames = []
    # f00..f07: Meme dance left (paw covers mouth giggling "pfft")
    for _ in range(8):
        frames.append(f_dance)
    # f08..f15: Meme dance sway right (paw fanning air, golden coins falling)
    for _ in range(8):
        frames.append(f_sway)
    # f16..f23: Climax celebration: double paws raised high, laughing with joy, coin shower!
    for _ in range(8):
        frames.append(f_cheer)

    save_pack('cat_win', frames, fps=10, loop=False)
    return frames

def generate_master_review_sheet(idle_f, chop_f, stir_f, pass_f, win_f):
    """Generates clean asset_review_sheet_cat.png showing representative frames."""
    states = [
        ('1. cat_idle', idle_f[0]),
        ('2. cat_chop (Down)', chop_f[0]),
        ('3. cat_chop (Swing)', chop_f[4]),
        ('4. cat_chop (Up)', chop_f[2]),
        ('5. cat_stir (Stir)', stir_f[0]),
        ('6. cat_stir (Scoop)', stir_f[8]),
        ('7. cat_pass (Slide)', pass_f[0]),
        ('8. cat_pass (Serve)', pass_f[6]),
        ('9. cat_win (Dance)', win_f[0]),
        ('10. cat_win (Cheer)', win_f[18]),
    ]

    cols = 5
    rows = (len(states) + cols - 1) // cols
    card_w = CARD_W + 16
    card_h = CARD_H + 34

    sheet_w = cols * card_w + 20
    sheet_h = rows * card_h + 40
    sheet = Image.new('RGB', (sheet_w, sheet_h), (247, 241, 231))
    draw = ImageDraw.Draw(sheet)

    draw.text((15, 10), "CAT ACTOR NATIVE MOTION PACK (STAGE 4.2 REVISION 3)", fill=(70, 50, 30))

    for idx, (label, img) in enumerate(states):
        col = idx % cols
        row = idx // cols
        cx = 10 + col * card_w
        cy = 35 + row * card_h

        draw.rectangle([cx, cy, cx + card_w - 6, cy + card_h - 6], fill=(255, 255, 255), outline=(210, 190, 170))
        sheet.paste(img, (cx + 5, cy + 22))
        draw.text((cx + 6, cy + 5), label, fill=(50, 40, 30))

    out_shot = os.path.join(SHOTS_DIR, 'asset_review_sheet_cat.png')
    out_art = os.path.join(ART_DIR, 'asset_review_sheet_cat.png')
    sheet.save(out_shot)
    sheet.save(out_art)
    print(f'[OK] asset_review_sheet_cat.png generated! ({sheet_w}x{sheet_h})')

if __name__ == '__main__':
    print('Building 5 Native Motion Packs...')
    idle_f = build_cat_idle()
    chop_f = build_cat_chop()
    stir_f = build_cat_stir()
    pass_f = build_cat_pass()
    win_f = build_cat_win()

    print('Generating Master Review Sheet...')
    generate_master_review_sheet(idle_f, chop_f, stir_f, pass_f, win_f)
    print('[ALL DONE] Stage 4.2 Revision 3 Native Motion Pack complete!')
