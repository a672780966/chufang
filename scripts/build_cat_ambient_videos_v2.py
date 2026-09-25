import os
import math
import shutil
import subprocess
from PIL import Image, ImageDraw, ImageFilter

BASE_DIR = r'C:\Users\admin\Music\chufang'
ARTIFACT_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'
CAT_ASSET_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat')
TEMP_FRAMES_DIR = os.path.join(BASE_DIR, 'scripts', 'temp_frames_v2')

os.makedirs(CAT_ASSET_DIR, exist_ok=True)
os.makedirs(TEMP_FRAMES_DIR, exist_ok=True)

# Master Narrow Stage Images
PATH_MASTER = os.path.join(ARTIFACT_DIR, 'narrow_stage_master_1790356624694.jpg')
PATH_TIE = os.path.join(ARTIFACT_DIR, 'narrow_open_tie_1790356661183.jpg')
PATH_CHEER = os.path.join(ARTIFACT_DIR, 'narrow_open_cheer_1790356690652.jpg')
PATH_CHOP = os.path.join(ARTIFACT_DIR, 'narrow_work_chop_1790356719385.jpg')

# Copy new narrow master to assets
shutil.copy(PATH_MASTER, os.path.join(CAT_ASSET_DIR, 'restaurant_stage_master.jpg'))
shutil.copy(PATH_MASTER, os.path.join(ARTIFACT_DIR, 'restaurant_stage_master.jpg'))

# Load base frames
IMG_MASTER = Image.open(PATH_MASTER).convert('RGBA')
IMG_TIE = Image.open(PATH_TIE).convert('RGBA')
IMG_CHEER = Image.open(PATH_CHEER).convert('RGBA')
IMG_CHOP = Image.open(PATH_CHOP).convert('RGBA')

# Target video resolution: 432 x 774 (aspect ratio 9:16 approx)
W, H = 432, 774

def resize_to_target(im):
    return im.resize((W, H), Image.Resampling.LANCZOS)

IMG_MASTER = resize_to_target(IMG_MASTER)
IMG_TIE = resize_to_target(IMG_TIE)
IMG_CHEER = resize_to_target(IMG_CHEER)
IMG_CHOP = resize_to_target(IMG_CHOP)

def draw_cloud_bubble(draw, x, y, r, opacity=255):
    fill = (255, 255, 255, opacity)
    outline = (235, 225, 215, opacity)
    draw.ellipse([x - r, y - r, x + r, y + r], fill=fill, outline=outline, width=2)

def draw_star_sparkle(draw, x, y, size, opacity=1.0):
    c = (255, 225, 80, int(opacity * 255))
    draw.line([x - size, y, x + size, y], fill=c, width=2)
    draw.line([x, y - size, x, y + size], fill=c, width=2)
    draw.line([x - size*0.5, y - size*0.5, x + size*0.5, y + size*0.5], fill=c, width=1)
    draw.line([x - size*0.5, y + size*0.5, x + size*0.5, y - size*0.5], fill=c, width=1)

def draw_golden_coin(draw, x, y, radius=11, tilt=0.0):
    ry = radius * abs(math.cos(tilt))
    ry = max(3.0, ry)
    rx = radius
    fill_gold = (248, 192, 48, 250)
    border_gold = (205, 135, 18, 255)
    inner_gold = (255, 230, 110, 240)
    bbox = [x - rx, y - ry, x + rx, y + ry]
    draw.ellipse(bbox, fill=fill_gold, outline=border_gold, width=2)
    if ry > 5:
        inner_bbox = [x - rx*0.6, y - ry*0.6, x + rx*0.6, y + ry*0.6]
        draw.ellipse(inner_bbox, outline=inner_gold, width=1)

def draw_air_swoosh(draw, x, y, length=24, angle=0):
    # Cute anime air fanning swoosh arcs
    c = (255, 255, 255, 190)
    draw.arc([x - length, y - length//2, x + length, y + length//2], start=angle, end=angle+90, fill=c, width=2)

def encode_video(frames_pattern, output_prefix, fps):
    webm_out = os.path.join(CAT_ASSET_DIR, f'{output_prefix}.webm')
    mp4_out = os.path.join(CAT_ASSET_DIR, f'{output_prefix}.mp4')

    # 1. MP4 (H.264)
    cmd_mp4 = [
        'ffmpeg', '-y', '-framerate', str(fps),
        '-i', frames_pattern,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-crf', '18', '-preset', 'medium',
        mp4_out
    ]
    subprocess.run(cmd_mp4, check=True)

    # 2. WebM (VP9)
    cmd_webm = [
        'ffmpeg', '-y', '-framerate', str(fps),
        '-i', frames_pattern,
        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p',
        '-crf', '24', '-b:v', '0',
        webm_out
    ]
    subprocess.run(cmd_webm, check=True)

    # Copy to artifact directory
    shutil.copy(webm_out, os.path.join(ARTIFACT_DIR, f'{output_prefix}.webm'))
    shutil.copy(mp4_out, os.path.join(ARTIFACT_DIR, f'{output_prefix}.mp4'))
    print(f'[OK] Encoded {output_prefix}: MP4 & WebM saved successfully.')

# =========================================================================
# 1. BUILD CAT_OPEN (2.6s, 26 frames @ 10fps) — TRUE MOTION
# =========================================================================
def build_cat_open():
    print('Building CAT_OPEN v2 (True Motion, NO blend)...')
    out_dir = os.path.join(TEMP_FRAMES_DIR, 'cat_open')
    os.makedirs(out_dir, exist_ok=True)

    total_frames = 26
    for i in range(total_frames):
        t = i / 10.0 # 0.0s to 2.5s
        frame = Image.new('RGBA', (W, H))

        if i < 4:
            # 0.0s ~ 0.4s (frames 0~3): Counter is occluded by cartoon cloud puff
            frame.paste(IMG_MASTER, (0, 0))
            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            progress = i / 3.0
            puff_scale = 0.5 + progress * 0.8
            # Billowing cloud clusters occluding cat center
            centers = [(216, 360, 55), (170, 370, 45), (265, 365, 48), (200, 320, 50), (235, 315, 45)]
            for cx, cy, r in centers:
                draw_cloud_bubble(draw, cx, cy, int(r * puff_scale), opacity=int(255 * (1.0 - progress * 0.2)))
            frame = Image.alpha_composite(frame, overlay)

        elif i < 7:
            # 0.4s ~ 0.7s (frames 4~6): Cloud clears outwards, cat emerges shaking head
            shake_x = [-4, +4, 0][i - 4]
            frame.paste(IMG_MASTER, (shake_x, 0))
            # Cloud puffs dispersing outwards
            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            disp = (i - 3) * 25
            for ox, oy, r in [(-disp, -10, 25), (disp, -10, 25), (0, -disp, 30)]:
                draw_cloud_bubble(draw, 216 + ox, 340 + oy, r, opacity=max(0, 200 - (i - 3) * 60))
            frame = Image.alpha_composite(frame, overlay)

        elif i < 15:
            # 0.7s ~ 1.5s (frames 7~14): Cat is tying red headband (IMG_TIE)
            # Ribbon pull animation: frames 7~10 pull outwards, 11~14 hold tight
            frame.paste(IMG_TIE, (0, 0))
            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            pull_phase = min(1.0, (i - 7) / 4.0)
            pull_ox = math.sin(pull_phase * math.pi * 0.5) * 6
            # Speed/tension lines at ribbon ends
            if 8 <= i <= 12:
                draw.line([85 - pull_ox, 275, 75 - pull_ox*1.5, 275], fill=(220, 60, 50, 220), width=2)
                draw.line([345 + pull_ox, 275, 355 + pull_ox*1.5, 275], fill=(220, 60, 50, 220), width=2)
            frame = Image.alpha_composite(frame, overlay)

        elif i < 21:
            # 1.5s ~ 2.1s (frames 15~20): Ganbatte / Fighting cheer pose (IMG_CHEER)
            # Hop up by -5px at frame 15, then settle
            hop_y = -5 if (i in [15, 16]) else (-2 if i == 17 else 0)
            frame.paste(IMG_CHEER, (0, hop_y))
            # Golden stars sparkling
            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            sparkles = [(110, 250, 9), (325, 240, 11), (216, 175, 12), (135, 330, 8), (300, 320, 8)]
            for s_idx, (sx, sy, sz) in enumerate(sparkles):
                op = 0.5 + 0.5 * math.sin((i + s_idx) * 1.5)
                draw_star_sparkle(draw, sx, sy + hop_y, sz, op)
            frame = Image.alpha_composite(frame, overlay)

        else:
            # 2.1s ~ 2.6s (frames 21~25): Cat lowers paws onto cutting board (IMG_CHOP)
            frame.paste(IMG_CHOP, (0, 0))

        frame.convert('RGB').save(os.path.join(out_dir, f'frame_{i:03d}.png'))

    encode_video(os.path.join(out_dir, 'frame_%03d.png'), 'restaurant_open', 10)

# =========================================================================
# 2. BUILD CAT_WORK_LOOP (7.2s, 72 frames @ 10fps) — TRUE SEAMLESS LOOP
# =========================================================================
def build_cat_work_loop():
    print('Building CAT_WORK_LOOP v2 (True Motion, NO blend, STRICT SEAMLESS)...')
    out_dir = os.path.join(TEMP_FRAMES_DIR, 'cat_work_loop')
    os.makedirs(out_dir, exist_ok=True)

    total_frames = 72
    for i in range(total_frames):
        t = i / 10.0 # 0.0s to 7.1s
        frame = Image.new('RGBA', (W, H))

        if i < 18:
            # 0.0s ~ 1.8s (frames 0~17): Rhythmic vegetable chopping
            # Frame 0 is clean IMG_CHOP
            chop_cycle = (i % 6) # 0, 1, 2 = up, 3, 4, 5 = down chop
            knife_dy = -4 if chop_cycle < 3 else +3
            frame.paste(IMG_CHOP, (0, 0))

            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            # Knife motion and scallion slice pop
            if chop_cycle >= 3 and i > 0:
                # Knife down chop contact line
                draw.line([195, 475 + knife_dy, 225, 495 + knife_dy], fill=(255, 255, 255, 180), width=2)
                # Scallion ring pop
                draw.ellipse([230 + chop_cycle*2, 480 - chop_cycle*3, 238 + chop_cycle*2, 488 - chop_cycle*3], fill=(120, 180, 80, 220))
            frame = Image.alpha_composite(frame, overlay)

        elif i < 28:
            # 1.8s ~ 2.8s (frames 18~27): Cat glances up, printer feeds ticket
            # Cat in baseline stance looking up (IMG_MASTER)
            frame.paste(IMG_MASTER, (0, 0))
            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            # Ticket paper feeding down from printer slot (x=185 to 245, y=95 to 135)
            feed_pixels = (i - 18) * 3 # 0 to 27 px
            # Draw extending paper
            draw.rectangle([186, 120, 246, 128 + feed_pixels], fill=(255, 254, 250, 255), outline=(215, 205, 190, 255))
            # Text dashed lines on paper
            for ly in range(124, 125 + feed_pixels, 6):
                draw.line([192, ly, 238, ly], fill=(160, 150, 140, 200), width=1)
            frame = Image.alpha_composite(frame, overlay)

        elif i < 48:
            # 2.8s ~ 4.8s (frames 28~47): Stirring soup pot & ear twitch
            # Base cat stance
            frame.paste(IMG_MASTER, (0, 0))
            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)

            # Circular ladle stirring path in saucepan (pot center at x=370, y=575)
            stir_angle = (i - 28) * 0.6
            lx = 365 + math.cos(stir_angle) * 8
            ly = 570 + math.sin(stir_angle) * 5
            # Draw wooden ladle handle
            draw.line([lx - 15, ly - 35, lx, ly], fill=(185, 135, 85, 255), width=4)
            draw.ellipse([lx - 6, ly - 4, lx + 6, ly + 4], fill=(160, 115, 70, 255))

            # Steam puffs rising from pot
            for p_idx in range(3):
                age = ((i - 28) * 0.15 + p_idx * 0.33) % 1.0
                sx = 365 + math.sin(age * math.pi * 3) * 12
                sy = 550 - age * 75
                sr = int(6 + age * 16)
                sop = int((1.0 - age) * 180)
                draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(255, 255, 255, sop))

            # Playful ear twitch at frame 38~41 (3.8s~4.1s)
            if 38 <= i <= 41:
                # Twitch overlay on cat left ear (x=150, y=210)
                draw.polygon([(140, 205), (155, 195), (160, 220)], fill=(245, 215, 185, 240))
            frame = Image.alpha_composite(frame, overlay)

        elif i < 62:
            # 4.8s ~ 6.2s (frames 48~61): Pushing onigiri plate to serving hatch
            frame.paste(IMG_MASTER, (0, 0))
            overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            # Plate motion: slides down counter into the bottom serving shelf
            # From (x=216, y=665) smoothly into position
            progress = (i - 48) / 13.0
            slide_y = progress * 15
            # Motion trail lines
            draw.line([216 - 25, 665 + slide_y - 2, 216 + 25, 665 + slide_y - 2], fill=(255, 255, 255, int(150 * (1 - progress))), width=2)
            frame = Image.alpha_composite(frame, overlay)

        else:
            # 6.2s ~ 7.2s (frames 62~71): Cat smoothly returns paws to cutting board
            # Frame 71 is 100% IDENTICAL to Frame 0 (IMG_CHOP)!
            frame.paste(IMG_CHOP, (0, 0))

        frame.convert('RGB').save(os.path.join(out_dir, f'frame_{i:03d}.png'))

    encode_video(os.path.join(out_dir, 'frame_%03d.png'), 'restaurant_work_loop', 10)

# Pre-align dance and sway images to exact 432x774 target
def prepare_aligned_dance(img_path):
    im = Image.open(img_path).convert('RGBA')
    scale = 1.38
    w, h = im.size
    new_w, new_h = int(w * scale), int(h * scale)
    scaled = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    cx = (new_w - 768) // 2
    cy = int((new_h - 1376) * 0.42)
    cropped = scaled.crop((cx, cy, cx + 768, cy + 1376))
    return resize_to_target(cropped)

IMG_DANCE_ALIGNED = prepare_aligned_dance(os.path.join(ARTIFACT_DIR, 'cat_win_dance_1790351847125.jpg'))
IMG_SWAY_ALIGNED = prepare_aligned_dance(os.path.join(ARTIFACT_DIR, 'cat_win_sway_1790351968371.jpg'))

# =========================================================================
# 3. BUILD CAT_WIN (4.0s, 40 frames @ 10fps) — AUTHENTIC MEME DANCE
# =========================================================================
def build_cat_win():
    print('Building CAT_WIN v2 (Authentic Meme Dance, NO blend, NO geometric circles)...')
    out_dir = os.path.join(TEMP_FRAMES_DIR, 'cat_win')
    os.makedirs(out_dir, exist_ok=True)

    total_frames = 40
    for i in range(total_frames):
        t = i / 10.0 # 0.0s to 3.9s
        frame = Image.new('RGBA', (W, H))

        if i < 4:
            # 0.0s ~ 0.4s: Chopping halts, cat pauses
            frame.paste(IMG_CHOP, (0, 0))

        elif i < 9:
            # 0.4s ~ 0.9s: Cat looks up surprised, ears perk up
            frame.paste(IMG_MASTER, (0, 0))

        elif i < 15:
            # 0.9s ~ 1.5s: Joyful hop!
            hop_y = -int(math.sin((i - 9) / 6.0 * math.pi) * 8)
            frame.paste(IMG_CHEER, (0, hop_y))

        elif i < 26:
            # 1.5s ~ 2.6s (frames 15~25): AUTHENTIC MEME DANCE Phase 1
            # (One paw over mouth giggling "pfft", other paw fanning air outward, golden coins falling)
            # Subtle rhythmic side-step bounce on 3-frame beats
            step_y = -2 if (i % 3 == 0) else 0
            frame.paste(IMG_DANCE_ALIGNED, (0, step_y))

        elif i < 35:
            # 2.6s ~ 3.5s (frames 26~34): AUTHENTIC MEME DANCE Phase 2
            # (Body sways to opposite side, alternating paws, coins bouncing on counter)
            step_y = -2 if (i % 3 == 0) else 0
            frame.paste(IMG_SWAY_ALIGNED, (0, step_y))

        else:
            # 3.5s ~ 4.0s (frames 35~39): Triumphant Victory Pose!
            frame.paste(IMG_CHEER, (0, 0))

        frame.convert('RGB').save(os.path.join(out_dir, f'frame_{i:03d}.png'))

    encode_video(os.path.join(out_dir, 'frame_%03d.png'), 'restaurant_win', 10)

if __name__ == '__main__':
    build_cat_open()
    build_cat_work_loop()
    build_cat_win()
    print('All 3 v2 videos built successfully!')
