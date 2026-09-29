import os
from PIL import Image, ImageDraw

BASE_DIR = r'C:\Users\admin\Music\chufang'
ARTIFACT_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')

# Base screen (game UI with header, order, prep buffer)
base_screen = Image.open(os.path.join(ARTIFACT_DIR, 'shot_t0_initial_three_dishes.png')).convert('RGBA')

# 1. Assemble 2x Stage Strip (170 x 1104 px)
stage_bg = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat', 'stage_background.png')).convert('RGBA')
printer_img = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'printer', 'frames_print', 'frame_08.png')).convert('RGBA')
cat_img = Image.open(os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'cat', 'cat_chop', 'frame_00.png')).convert('RGBA')

stage_2x = stage_bg.copy()

# Top slot: Printer Actor (centered horizontally)
px = (170 - printer_img.width) // 2
py = 28
stage_2x.paste(printer_img, (px, py), printer_img)

# Bottom slot: Cat Actor (flush at bottom)
cx = 0
cy = 1104 - cat_img.height
stage_2x.paste(cat_img, (cx, cy), cat_img)

# Soft top blend for cat card into cedar background
top_blend = Image.new('RGBA', (170, 20), (0, 0, 0, 0))
tb_draw = ImageDraw.Draw(top_blend)
for row in range(20):
    alpha = int((1.0 - (row / 20.0)) * 60)
    tb_draw.line([0, row, 170, row], fill=(160, 110, 60, alpha))
stage_2x.paste(top_blend, (0, cy), top_blend)

# 2. Resize Stage to 1x CSS layout (85 x 552 px)
stage_1x = stage_2x.resize((85, 552), Image.Resampling.LANCZOS)

# Layout parameters
mockup = base_screen.copy()
TOTAL_PLAY_W = 431
PLAY_Y = 180
PLAY_H = 552
BOARD_X = 376

# Gold Sample 79% : 21% Split:
BOARD_W = int(TOTAL_PLAY_W * 0.79) # 340px
STAGE_GAP = 6
STAGE_W = TOTAL_PLAY_W - BOARD_W - STAGE_GAP # 85px
STAGE_X = BOARD_X + BOARD_W + STAGE_GAP

# Clear play area
draw = ImageDraw.Draw(mockup)
cream_bg = (247, 241, 231, 255)
draw.rectangle([BOARD_X - 2, PLAY_Y - 2, BOARD_X + TOTAL_PLAY_W + 2, PLAY_Y + PLAY_H + 2], fill=cream_bg)

# Left 79% Puzzle Board (340px x 552px)
linen_board = Image.new('RGBA', (BOARD_W, PLAY_H), (238, 230, 216, 255))
board_draw = ImageDraw.Draw(linen_board)

# Draw subtle grid dots
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

# Fit active puzzle pieces
orig_board_crop = base_screen.crop((BOARD_X + 12, PLAY_Y + 12, BOARD_X + TOTAL_PLAY_W - 12, PLAY_Y + PLAY_H - 12))
orig_board_fitted = orig_board_crop.resize((BOARD_W - 8, PLAY_H - 8), Image.Resampling.LANCZOS)
linen_board.paste(orig_board_fitted, (4, 4), orig_board_fitted)

# Rounded wooden frame for puzzle board
mask_board = Image.new('L', (BOARD_W, PLAY_H), 0)
mask_draw = ImageDraw.Draw(mask_board)
mask_draw.rounded_rectangle([0, 0, BOARD_W, PLAY_H], radius=18, fill=255)
board_draw.rounded_rectangle([0, 0, BOARD_W - 1, PLAY_H - 1], radius=18, outline=(216, 181, 140, 255), width=3)

mockup.paste(linen_board, (BOARD_X, PLAY_Y), mask_board)

# Right 21% Dual Actor Stage Widget (85px x 552px)
stage_widget = stage_1x.copy()
stage_draw = ImageDraw.Draw(stage_widget)

mask_stage = Image.new('L', (STAGE_W, PLAY_H), 0)
mask_stage_draw = ImageDraw.Draw(mask_stage)
mask_stage_draw.rounded_rectangle([0, 0, STAGE_W, PLAY_H], radius=18, fill=255)

# Outer wooden restaurant frame
stage_draw.rounded_rectangle([0, 0, STAGE_W - 1, PLAY_H - 1], radius=18, outline=(196, 158, 114, 255), width=3)

mockup.paste(stage_widget, (STAGE_X, PLAY_Y), mask_stage)

# Save deliverables
out_shot = os.path.join(SHOTS_DIR, 'shot_stage4_2_actor_pack_layout.png')
out_art = os.path.join(ARTIFACT_DIR, 'shot_stage4_2_actor_pack_layout.png')

mockup.save(out_shot)
mockup.save(out_art)
print(f'[OK] Generated Stage 4.2 Dual Actor Layout Mockup (Board={BOARD_W}px, Stage={STAGE_W}px) successfully!')
