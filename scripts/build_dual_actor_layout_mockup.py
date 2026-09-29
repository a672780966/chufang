import os
from PIL import Image, ImageDraw

BASE_DIR = r'C:\Users\admin\Music\chufang'
ARTIFACT_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')

# Base screen
base_screen = Image.open(os.path.join(ARTIFACT_DIR, 'shot_t0_initial_three_dishes.png')).convert('RGBA')

TOTAL_PLAY_W = 431
PLAY_Y = 180
PLAY_H = 552
BOARD_X = 376

BOARD_W = 340 # 78.9%
STAGE_GAP = 6
STAGE_W = 85 # 19.7%
STAGE_X = BOARD_X + BOARD_W + STAGE_GAP

mockup = base_screen.copy()
draw = ImageDraw.Draw(mockup)
draw.rectangle([BOARD_X - 2, PLAY_Y - 2, BOARD_X + TOTAL_PLAY_W + 2, PLAY_Y + PLAY_H + 2], fill=(247, 241, 231, 255))

# 1. Left 79% Puzzle Board
linen_board = Image.new('RGBA', (BOARD_W, PLAY_H), (238, 230, 216, 255))
board_draw = ImageDraw.Draw(linen_board)
cols, rows = 8, 12
cell_size = int((BOARD_W - 16) / cols)
origin_x = int((BOARD_W - cols * cell_size) / 2)
origin_y = PLAY_H - 16 - cell_size

dot_color = (205, 195, 180, 180)
for r in range(rows):
    for c in range(cols):
        cx_dot = origin_x + c * cell_size + cell_size // 2
        cy_dot = origin_y - r * cell_size + cell_size // 2
        board_draw.ellipse([cx_dot - 1.5, cy_dot - 1.5, cx_dot + 1.5, cy_dot + 1.5], fill=dot_color)

orig_board_crop = base_screen.crop((BOARD_X + 12, PLAY_Y + 12, BOARD_X + TOTAL_PLAY_W - 12, PLAY_Y + PLAY_H - 12))
orig_board_fitted = orig_board_crop.resize((BOARD_W - 8, PLAY_H - 8), Image.Resampling.LANCZOS)
linen_board.paste(orig_board_fitted, (4, 4), orig_board_fitted)

mask_board = Image.new('L', (BOARD_W, PLAY_H), 0)
mask_draw = ImageDraw.Draw(mask_board)
mask_draw.rounded_rectangle([0, 0, BOARD_W, PLAY_H], radius=18, fill=255)
board_draw.rounded_rectangle([0, 0, BOARD_W - 1, PLAY_H - 1], radius=18, outline=(216, 181, 140, 255), width=3)
mockup.paste(linen_board, (BOARD_X, PLAY_Y), mask_board)

# 2. Right Stage Background
stage_bg = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat', 'stage_background.png')).convert('RGBA')
stage_bg_1x = stage_bg.resize((STAGE_W, PLAY_H), Image.Resampling.LANCZOS)
stage_draw = ImageDraw.Draw(stage_bg_1x)

# Top Slot: Printer Actor
printer_img = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'printer', 'frames_print', 'frame_08.png')).convert('RGBA')
pw, ph = int(printer_img.width * 0.55), int(printer_img.height * 0.55) # ~42x50px
printer_fitted = printer_img.resize((pw, ph), Image.Resampling.LANCZOS)
px = (STAGE_W - pw) // 2
stage_bg_1x.paste(printer_fitted, (px, 16), printer_fitted)

# Rounded stage frame mask
mask_stage = Image.new('L', (STAGE_W, PLAY_H), 0)
mask_stage_draw = ImageDraw.Draw(mask_stage)
mask_stage_draw.rounded_rectangle([0, 0, STAGE_W, PLAY_H], radius=18, fill=255)
stage_draw.rounded_rectangle([0, 0, STAGE_W - 1, PLAY_H - 1], radius=18, outline=(196, 158, 114, 255), width=3)
mockup.paste(stage_bg_1x, (STAGE_X, PLAY_Y), mask_stage)

# 3. Bottom Slot: Enlarged Cat Actor (Width: 95px, Height: 168px = 30.4% of stage)
cat_img = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'cat', 'cat_chop', 'frame_00.png')).convert('RGBA')
cat_w = 95
cat_h = 168
cat_scaled = cat_img.resize((cat_w, cat_h), Image.Resampling.LANCZOS)

cat_card = Image.new('RGBA', (cat_w, cat_h), (0, 0, 0, 0))
cat_mask = Image.new('L', (cat_w, cat_h), 0)
cm_draw = ImageDraw.Draw(cat_mask)
cm_draw.rounded_rectangle([0, 0, cat_w, cat_h], radius=14, fill=255)

cat_card.paste(cat_scaled, (0, 0), cat_mask)
cat_draw = ImageDraw.Draw(cat_card)
cat_draw.rounded_rectangle([0, 0, cat_w - 1, cat_h - 1], radius=14, outline=(196, 158, 114, 220), width=2)

cat_x = STAGE_X - 10
cat_y = PLAY_Y + PLAY_H - cat_h
mockup.paste(cat_card, (cat_x, cat_y), cat_card)

# Save official layout deliverable
mockup.save(os.path.join(SHOTS_DIR, 'shot_stage4_2_actor_pack_layout.png'))
mockup.save(os.path.join(ARTIFACT_DIR, 'shot_stage4_2_actor_pack_layout.png'))
print('shot_stage4_2_actor_pack_layout.png saved with perfect flush boundaries!')
