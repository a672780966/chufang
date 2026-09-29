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

# 2. Right Side: No monolithic cedar strip! Clean natural cream background with independent actors.

# Top Right Slot: Independent Hanging Printer Actor Card
printer_img = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'printer', 'frames_print', 'frame_08.png')).convert('RGBA')
pw, ph = int(printer_img.width * 0.52), int(printer_img.height * 0.52) # ~40x48px
printer_fitted = printer_img.resize((pw, ph), Image.Resampling.LANCZOS)

card_pw, card_ph = 48, 56
p_card = Image.new('RGBA', (card_pw, card_ph), (255, 255, 255, 240))
p_draw = ImageDraw.Draw(p_card)
p_draw.rounded_rectangle([0, 0, card_pw - 1, card_ph - 1], radius=8, outline=(210, 190, 170, 220), width=1)
p_card.paste(printer_fitted, ((card_pw - pw) // 2, (card_ph - ph) // 2), printer_fitted)

printer_x = STAGE_X + (STAGE_W - card_pw) // 2
printer_y = PLAY_Y + 16
mockup.paste(p_card, (printer_x, printer_y), p_card)

# 3. Bottom Right Slot: Sealed Cat Actor Clip Window (Width: 100px, Height: 168px = 30.4% of stage height)
# Floating 10px left over wooden board border, with zero playable cell obstruction
cat_img = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'cat', 'idle', 'frame_00.png')).convert('RGBA')
cat_w = 100
cat_h = 168
cat_scaled = cat_img.resize((cat_w, cat_h), Image.Resampling.LANCZOS)

cat_card = Image.new('RGBA', (cat_w, cat_h), (0, 0, 0, 0))
cat_mask = Image.new('L', (cat_w, cat_h), 0)
cm_draw = ImageDraw.Draw(cat_mask)
cm_draw.rounded_rectangle([0, 0, cat_w, cat_h], radius=14, fill=255)

cat_card.paste(cat_scaled, (0, 0), cat_mask)
cat_draw = ImageDraw.Draw(cat_card)
cat_draw.rounded_rectangle([0, 0, cat_w - 1, cat_h - 1], radius=14, outline=(196, 158, 114, 230), width=2)

cat_x = STAGE_X - 10
cat_y = PLAY_Y + PLAY_H - cat_h
mockup.paste(cat_card, (cat_x, cat_y), cat_card)

# Save official layout deliverable
mockup.save(os.path.join(SHOTS_DIR, 'shot_stage4_2_final_layout.png'))
mockup.save(os.path.join(ARTIFACT_DIR, 'shot_stage4_2_final_layout.png'))
mockup.save(os.path.join(SHOTS_DIR, 'shot_stage4_2_actor_pack_layout.png'))
mockup.save(os.path.join(ARTIFACT_DIR, 'shot_stage4_2_actor_pack_layout.png'))
print('shot_stage4_2_final_layout.png saved with clean independent layout!')
