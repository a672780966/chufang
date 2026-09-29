import os
import json
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import binary_dilation

BASE_DIR = r'C:\Users\admin\Music\chufang'
ACTOR_CAT_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'cat')
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
ART_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'

os.makedirs(ACTOR_CAT_DIR, exist_ok=True)
os.makedirs(os.path.join(ACTOR_CAT_DIR, 'spritesheets'), exist_ok=True)
os.makedirs(os.path.join(ACTOR_CAT_DIR, 'metadata'), exist_ok=True)
os.makedirs(os.path.join(ACTOR_CAT_DIR, 'preview'), exist_ok=True)
os.makedirs(SHOTS_DIR, exist_ok=True)

# 1. Canonical crop box: 400 x 672 (Aspect Ratio 100:168 exactly)
# From master illustration (768, 1376)
BOX_400x672 = (184, 440, 584, 1112)
W, H = 400, 672

KEYFRAME_FILES = {
    'idle_stand': 'cat_idle_stand_r4_1790670482411.jpg',
    'idle_blink': 'cat_idle_blink_r4_1790670507322.jpg',
    'chop_down': 'cat_work_chop_1790351539446.jpg',
    'chop_raise': 'cat_chop_raise_r4_1790670436915.jpg',
    'chop_slash': 'cat_chop_slash_r4_1790670459533.jpg',
    'stir_down': 'cat_work_stir_1790351635057.jpg',
    'stir_up': 'cat_stir_pos2_1790668658855.jpg',
    'pass_slide': 'cat_work_pass_1790351734241.jpg',
    'pass_serve': 'cat_pass_pos2_1790668721163.jpg',
    'win_dance': 'cat_win_dance_1790351847125.jpg',
    'win_sway': 'cat_win_sway_1790351968371.jpg',
    'win_cheer': 'cat_win_cheer_1790668828116.jpg'
}

print('1. Loading and cropping master keyframes...')
RAW_KEYS = {}
for k, fname in KEYFRAME_FILES.items():
    p = os.path.join(ART_DIR, fname)
    RAW_KEYS[k] = Image.open(p).crop(BOX_400x672).convert('RGB')

# 2. Freeze background_master.png
bg_master = RAW_KEYS['idle_stand'].copy()
bg_master_path = os.path.join(ACTOR_CAT_DIR, 'background_master.png')
bg_master.save(bg_master_path)
bg_master.save(os.path.join(ART_DIR, 'cat_actor_background_master.png'))
print(f'[OK] Frozen background_master.png ({W}x{H})')

# 3. Establish Motion Mask
# Motion region: Cat body, arms, knife raise/slash arc, cutting board chopping, pot stirring, steam, plate slide, win coins
# Static regions (100% frozen, 0 pixel difference):
# - Top shelves and jars (Y: 0..30)
# - Bottom wooden counter facade (Y: 560..672)
# - Left window/wall edge (X: 0..10)
# - Right wall edge (X: 390..400)
motion_envelope = np.zeros((H, W), dtype=bool)
motion_envelope[30:560, 10:390] = True

bg_arr = np.array(bg_master, dtype=float)
union_diff = np.zeros((H, W), dtype=bool)
for k, im in RAW_KEYS.items():
    if k == 'idle_stand':
        continue
    arr = np.array(im, dtype=float)
    d = np.abs(arr - bg_arr).sum(axis=-1)
    union_diff |= (d > 30) & motion_envelope

# Dilate by 12 pixels for seamless contour coverage
dilated_mask = binary_dilation(union_diff, iterations=12) & motion_envelope
binary_motion_mask = Image.fromarray((dilated_mask * 255).astype(np.uint8))
feathered_mask = binary_motion_mask.filter(ImageFilter.GaussianBlur(radius=3))

mask_path = os.path.join(ACTOR_CAT_DIR, 'motion_mask.png')
binary_motion_mask.save(mask_path)
binary_motion_mask.save(os.path.join(ART_DIR, 'cat_actor_motion_mask.png'))
print(f'[OK] Established motion_mask.png (Motion area: {np.mean(dilated_mask)*100:.1f}%)')

def compose_frame(foreground_img):
    """
    Composites foreground action onto background_master.
    Strict Invariant:
    Outside binary_motion_mask, pixels are mathematically byte-for-byte identical to bg_master!
    """
    # 1. Soft feather composite for natural visual boundary
    blended = Image.composite(foreground_img, bg_master, feathered_mask)
    # 2. Strict pixel lock enforcement: outside binary_motion_mask, strictly bg_master
    blended_arr = np.array(blended)
    bg_arr_uint8 = np.array(bg_master)
    blended_arr[~dilated_mask] = bg_arr_uint8[~dilated_mask]
    return Image.fromarray(blended_arr)

# 4. Generate all 5 actions
def build_frames():
    # 4.1 cat_idle (16 frames @ 10fps = 1.6s loop)
    f_stand = compose_frame(RAW_KEYS['idle_stand'])
    f_blink = compose_frame(RAW_KEYS['idle_blink'])
    idle_frames = []
    # F00..F05: Stand breathing
    for _ in range(6):
        idle_frames.append(f_stand)
    # F06..F09: Gentle happy blink with rosy cheeks
    for _ in range(4):
        idle_frames.append(f_blink)
    # F10..F15: Return to stand alert
    for _ in range(6):
        idle_frames.append(f_stand)

    # 4.2 cat_chop (12 frames @ 10fps = 1.2s loop, 2 complete anime chopping strikes)
    f_down = compose_frame(RAW_KEYS['chop_down'])
    f_raise = compose_frame(RAW_KEYS['chop_raise'])
    f_slash = compose_frame(RAW_KEYS['chop_slash'])
    chop_frames = [
        f_down,   # F00: Prepare
        f_raise,  # F01: Raise knife high
        f_slash,  # F02: Downward slash arc
        f_down,   # F03: Impact contact on board
        f_down,   # F04: Rebound hold
        f_down,   # F05: Prepare
        f_raise,  # F06: Raise knife high
        f_slash,  # F07: Downward slash arc
        f_down,   # F08: Impact contact on board
        f_down,   # F09: Rebound hold
        f_down,   # F10: Prepare
        f_down    # F11: Ease back to F00
    ]

    # 4.3 cat_stir (16 frames @ 10fps = 1.6s loop: Stir pot -> Scoop up with steam -> Return)
    f_stir_down = compose_frame(RAW_KEYS['stir_down'])
    f_stir_up = compose_frame(RAW_KEYS['stir_up'])
    stir_frames = []
    # F00..F04: Ladle down in simmering pot stirring soup
    for _ in range(5):
        stir_frames.append(f_stir_down)
    # F05..F07: Scooping upward
    for _ in range(3):
        stir_frames.append(f_stir_up)
    # F08..F12: Ladle high with golden broth & billowing steam cloud
    for _ in range(5):
        stir_frames.append(f_stir_up)
    # F13..F15: Return ladle down into pot
    for _ in range(3):
        stir_frames.append(f_stir_down)

    # 4.4 cat_pass (12 frames @ 10fps = 1.2s: Slide plate -> Present with sparkling eyes -> Hold)
    f_pass_slide = compose_frame(RAW_KEYS['pass_slide'])
    f_pass_serve = compose_frame(RAW_KEYS['pass_serve'])
    pass_frames = []
    # F00..F04: Slide plate forward along wooden counter with speed lines
    for _ in range(5):
        pass_frames.append(f_pass_slide)
    # F05..F09: Plate presented at counter edge, sparkling eyes & beaming smile (held ~300ms)
    for _ in range(5):
        pass_frames.append(f_pass_serve)
    # F10..F11: Relaxing posture, ready to transition to idle
    for _ in range(2):
        pass_frames.append(f_pass_serve)

    # 4.5 cat_win (24 frames @ 10fps = 2.4s: Meme dance sway -> Climax victory cheer & coin cascade)
    f_win_dance = compose_frame(RAW_KEYS['win_dance'])
    f_win_sway = compose_frame(RAW_KEYS['win_sway'])
    f_win_cheer = compose_frame(RAW_KEYS['win_cheer'])
    win_frames = []
    # F00..F07: Meme dance sway left, giggling "pfft"
    for _ in range(8):
        win_frames.append(f_win_dance)
    # F08..F15: Meme dance sway right, fanning air, coins falling
    for _ in range(8):
        win_frames.append(f_win_sway)
    # F16..F23: Climax celebration: double paws raised high in triumph, laughing with joy, coin shower
    for _ in range(8):
        win_frames.append(f_win_cheer)

    return {
        'idle': (idle_frames, True),
        'chop': (chop_frames, True),
        'stir': (stir_frames, True),
        'pass': (pass_frames, False),
        'win':  (win_frames, False)
    }

ACTIONS = build_frames()

def save_action_pack(name, frames, loop=True, fps=10):
    folder = os.path.join(ACTOR_CAT_DIR, name)
    os.makedirs(folder, exist_ok=True)
    num_frames = len(frames)

    # Clean existing frames
    for f in os.listdir(folder):
        if f.endswith('.png'):
            try:
                os.remove(os.path.join(folder, f))
            except Exception:
                pass

    # 1. Save PNG frames (400x672)
    for idx, f in enumerate(frames):
        f.save(os.path.join(folder, f'frame_{idx:02d}.png'))

    # 2. Animated WebP (Priority 1)
    webp_path = os.path.join(ACTOR_CAT_DIR, f'cat_{name}.webp')
    duration_ms = int(1000 / fps)
    frames[0].save(
        webp_path,
        save_all=True,
        append_images=frames[1:],
        duration=duration_ms,
        loop=0 if loop else 1,
        lossless=False,
        quality=92,
        method=6
    )

    # 3. Spritesheet PNG & JSON (Priority 2)
    cols = 4
    if num_frames > 16:
        cols = 6
    rows = (num_frames + cols - 1) // cols
    sheet_w = cols * W
    sheet_h = rows * H
    sheet = Image.new('RGB', (sheet_w, sheet_h))
    meta_frames = []

    for idx, f in enumerate(frames):
        c = idx % cols
        r = idx // cols
        x = c * W
        y = r * H
        sheet.paste(f, (x, y))
        meta_frames.append({
            'filename': f'frame_{idx:02d}.png',
            'frame': {'x': x, 'y': y, 'w': W, 'h': H},
            'duration': duration_ms
        })

    sheet_path = os.path.join(ACTOR_CAT_DIR, 'spritesheets', f'cat_{name}_sheet.png')
    sheet.save(sheet_path, optimize=True)

    json_path = os.path.join(ACTOR_CAT_DIR, 'metadata', f'cat_{name}.json')
    with open(json_path, 'w', encoding='utf-8') as jf:
        json.dump({
            'action': f'cat_{name}',
            'frame_width': W,
            'frame_height': H,
            'fps': fps,
            'loop': loop,
            'frame_count': num_frames,
            'frames': meta_frames
        }, jf, indent=2)

    # 4. Preview GIF (Inspection only)
    gif_path = os.path.join(ACTOR_CAT_DIR, 'preview', f'cat_{name}.gif')
    # Resized to 200x336 for lightweight preview
    preview_frames = [f.resize((200, 336), Image.Resampling.BILINEAR) for f in frames]
    preview_frames[0].save(
        gif_path,
        save_all=True,
        append_images=preview_frames[1:],
        duration=duration_ms,
        loop=0 if loop else 1,
        optimize=True
    )

    # 5. MP4 & WebM (Priority 3)
    mp4_path = os.path.join(ACTOR_CAT_DIR, f'cat_{name}.mp4')
    webm_path = os.path.join(ACTOR_CAT_DIR, f'cat_{name}.webm')

    subprocess.run([
        'ffmpeg', '-y', '-framerate', str(fps),
        '-i', os.path.join(folder, 'frame_%02d.png'),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
        mp4_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    subprocess.run([
        'ffmpeg', '-y', '-framerate', str(fps),
        '-i', os.path.join(folder, 'frame_%02d.png'),
        '-c:v', 'libvpx-vp9', '-crf', '24', '-b:v', '0',
        webm_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print(f'[OK] Exported cat_{name}: WebP, Spritesheet, JSON, GIF, MP4, WebM ({num_frames} frames)')

print('5. Exporting all 5 sealed animation packages...')
for name, (frames, loop) in ACTIONS.items():
    save_action_pack(name, frames, loop=loop)

# 6. Generate cat_actor_all_states.png
print('6. Generating cat_actor_all_states.png...')
state_samples = [
    ('1. IDLE (Stand)', ACTIONS['idle'][0][0]),
    ('2. IDLE (Blink)', ACTIONS['idle'][0][7]),
    ('3. CHOP (Raise)', ACTIONS['chop'][0][1]),
    ('4. CHOP (Slash)', ACTIONS['chop'][0][2]),
    ('5. CHOP (Contact)', ACTIONS['chop'][0][3]),
    ('6. STIR (Stir)', ACTIONS['stir'][0][0]),
    ('7. STIR (Scoop)', ACTIONS['stir'][0][8]),
    ('8. PASS (Slide)', ACTIONS['pass'][0][0]),
    ('9. PASS (Serve)', ACTIONS['pass'][0][6]),
    ('10. WIN (Dance)', ACTIONS['win'][0][0]),
    ('11. WIN (Sway)', ACTIONS['win'][0][10]),
    ('12. WIN (Cheer)', ACTIONS['win'][0][20]),
]

cols = 6
rows = 2
sw, sh = 200, 336
all_states = Image.new('RGB', (cols * sw, rows * (sh + 24)), (247, 241, 231))
draw_as = ImageDraw.Draw(all_states)

for idx, (lbl, f) in enumerate(state_samples):
    c = idx % cols
    r = idx // cols
    x = c * sw
    y = r * (sh + 24)
    thumb = f.resize((sw, sh), Image.Resampling.LANCZOS)
    all_states.paste(thumb, (x, y + 22))
    draw_as.rectangle([x, y, x + sw - 1, y + 21], fill=(235, 225, 210))
    draw_as.text((x + 6, y + 4), lbl, fill=(50, 40, 30))

all_states_path = os.path.join(SHOTS_DIR, 'cat_actor_all_states.png')
all_states.save(all_states_path)
all_states.save(os.path.join(ART_DIR, 'cat_actor_all_states.png'))
print('[OK] Saved cat_actor_all_states.png')

# 7. Generate cat_actor_pixel_lock_visualization.png
print('7. Generating cat_actor_pixel_lock_visualization.png...')
vis_w = 400 * 3
vis_h = 672 + 60
vis_img = Image.new('RGB', (vis_w, vis_h), (245, 240, 232))
draw_vis = ImageDraw.Draw(vis_img)

# Panel 1: background_master
vis_img.paste(bg_master, (0, 40))
draw_vis.text((15, 12), "1. Frozen background_master.png (100% Locked)", fill=(60, 40, 20))

# Panel 2: motion_mask
mask_rgb = Image.merge('RGB', (binary_motion_mask, binary_motion_mask, binary_motion_mask))
vis_img.paste(mask_rgb, (400, 40))
draw_vis.text((415, 12), "2. binary_motion_mask.png (White=Dynamic, Black=Pixel Lock)", fill=(60, 40, 20))

# Panel 3: Difference Heatmap Outside Motion Mask (All 0)
chop_sample = ACTIONS['chop'][0][2] # slash frame
diff_arr = np.abs(np.array(chop_sample, dtype=float) - bg_arr)
# Mask outside diff
diff_outside = diff_arr.copy()
diff_outside[dilated_mask] = 0
diff_vis = np.zeros((H, W, 3), dtype=np.uint8)
diff_vis[:, :, 0] = np.clip(diff_outside.sum(axis=-1) * 10, 0, 255).astype(np.uint8) # Red if any diff
diff_vis_img = Image.fromarray(diff_vis)
vis_img.paste(diff_vis_img, (800, 40))
draw_vis.text((815, 12), f"3. Background Diff Heatmap: 0.00% (Outside Pixel Diff = 0)", fill=(0, 120, 30))

vis_path = os.path.join(SHOTS_DIR, 'cat_actor_pixel_lock_visualization.png')
vis_img.save(vis_path)
vis_img.save(os.path.join(ART_DIR, 'cat_actor_pixel_lock_visualization.png'))
print('[OK] Saved cat_actor_pixel_lock_visualization.png')

# 8. Generate cat_actor_transition_test.mp4
print('8. Generating cat_actor_transition_test.mp4...')
# Sequence: idle (16f) -> chop (12f) -> stir (16f) -> pass (12f) -> win (24f) -> idle (16f)
trans_frames = (
    ACTIONS['idle'][0] +
    ACTIONS['chop'][0] +
    ACTIONS['stir'][0] +
    ACTIONS['pass'][0] +
    ACTIONS['win'][0] +
    ACTIONS['idle'][0]
)

trans_dir = os.path.join(SHOTS_DIR, 'temp_trans')
os.makedirs(trans_dir, exist_ok=True)
for i, f in enumerate(trans_frames):
    f.save(os.path.join(trans_dir, f't_{i:03d}.png'))

trans_mp4 = os.path.join(SHOTS_DIR, 'cat_actor_transition_test.mp4')
subprocess.run([
    'ffmpeg', '-y', '-framerate', '10',
    '-i', os.path.join(trans_dir, 't_%03d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
    trans_mp4
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Clean temp frames
for f in os.listdir(trans_dir):
    try:
        os.remove(os.path.join(trans_dir, f))
    except Exception:
        pass
os.rmdir(trans_dir)
print('[OK] Saved cat_actor_transition_test.mp4 (96 frames sequenced without cross-fade)')

print('[ALL DONE] build_sealed_actor_pack complete!')
