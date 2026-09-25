import os
from PIL import Image, ImageDraw

BASE_DIR = r'C:\Users\admin\Music\chufang'
ARTIFACT_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
CAT_ASSET_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat')

# Load base screen and new narrow stage master
base_screen = Image.open(os.path.join(ARTIFACT_DIR, 'shot_t0_initial_three_dishes.png')).convert('RGBA')
narrow_master = Image.open(os.path.join(CAT_ASSET_DIR, 'restaurant_stage_master.jpg')).convert('RGBA')

mockup = base_screen.copy()

# Game container dimensions:
# Total play area in container: x=376 to 807 (width=431), y=180 to 732 (height=552)
TOTAL_PLAY_W = 431
PLAY_Y = 180
PLAY_H = 552
BOARD_X = 376

# Gold Sample 79% : 21% Split:
BOARD_W = int(TOTAL_PLAY_W * 0.79) # 340px
STAGE_GAP = 6
STAGE_W = TOTAL_PLAY_W - BOARD_W - STAGE_GAP # 85px
STAGE_X = BOARD_X + BOARD_W + STAGE_GAP

# 1. Clear play area background with cream
draw = ImageDraw.Draw(mockup)
cream_bg = (247, 241, 231, 255)
draw.rectangle([BOARD_X - 2, PLAY_Y - 2, BOARD_X + TOTAL_PLAY_W + 2, PLAY_Y + PLAY_H + 2], fill=cream_bg)

# 2. Render Left 79% Puzzle Board (340px x 552px)
linen_board = Image.new('RGBA', (BOARD_W, PLAY_H), (238, 230, 216, 255))
board_draw = ImageDraw.Draw(linen_board)

# Draw subtle grid dots for 8x12
cols, rows = 8, 12
cell_size = int((BOARD_W - 16) / cols) # 40px cell
origin_x = int((BOARD_W - cols * cell_size) / 2)
origin_y = PLAY_H - 16 - cell_size

dot_color = (205, 195, 180, 180)
for r in range(rows):
    for c in range(cols):
        cx = origin_x + c * cell_size + cell_size // 2
        cy = origin_y - r * cell_size + cell_size // 2
        board_draw.ellipse([cx - 1.5, cy - 1.5, cx + 1.5, cy + 1.5], fill=dot_color)

# Fit active puzzle pieces into 340px width board
orig_board_crop = base_screen.crop((BOARD_X + 12, PLAY_Y + 12, BOARD_X + TOTAL_PLAY_W - 12, PLAY_Y + PLAY_H - 12))
orig_board_fitted = orig_board_crop.resize((BOARD_W - 8, PLAY_H - 8), Image.Resampling.LANCZOS)
linen_board.paste(orig_board_fitted, (4, 4), orig_board_fitted)

# Rounded wooden frame for board wrapper
mask_board = Image.new('L', (BOARD_W, PLAY_H), 0)
mask_draw = ImageDraw.Draw(mask_board)
mask_draw.rounded_rectangle([0, 0, BOARD_W, PLAY_H], radius=18, fill=255)
board_draw.rounded_rectangle([0, 0, BOARD_W - 1, PLAY_H - 1], radius=18, outline=(216, 181, 140, 255), width=3)

mockup.paste(linen_board, (BOARD_X, PLAY_Y), mask_board)

# 3. Render Right 21% Narrow Restaurant Stage (85px x 552px)
stage_fitted = narrow_master.resize((STAGE_W, PLAY_H), Image.Resampling.LANCZOS)
stage_draw = ImageDraw.Draw(stage_fitted)

mask_stage = Image.new('L', (STAGE_W, PLAY_H), 0)
mask_stage_draw = ImageDraw.Draw(mask_stage)
mask_stage_draw.rounded_rectangle([0, 0, STAGE_W, PLAY_H], radius=18, fill=255)

# Outer wooden restaurant window frame
stage_draw.rounded_rectangle([0, 0, STAGE_W - 1, PLAY_H - 1], radius=18, outline=(196, 158, 114, 255), width=3)

mockup.paste(stage_fitted, (STAGE_X, PLAY_Y), mask_stage)

# Save output
out_shot = os.path.join(SHOTS_DIR, 'shot_stage4_2_layout_composition.png')
out_art = os.path.join(ARTIFACT_DIR, 'shot_stage4_2_layout_composition.png')

mockup.save(out_shot)
mockup.save(out_art)
print(f'[OK] Generated 79%:21% mockup (Board={BOARD_W}px, Stage={STAGE_W}px) successfully!')
