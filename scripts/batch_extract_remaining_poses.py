import os
import gc
import rembg
import numpy as np
from PIL import Image

BASE_DIR = r'C:\Users\admin\Music\chufang'
ART_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
CAT_ASSET_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat')

poses = [
    ('cat_chop', os.path.join(ART_DIR, 'narrow_work_chop_1790356719385.jpg'), (100, 260, 680, 1050)),
    ('cat_stir', os.path.join(ART_DIR, 'cat_work_stir_1790351635057.jpg'), (150, 180, 750, 980)),
    ('cat_pass', os.path.join(ART_DIR, 'cat_work_pass_1790351734241.jpg'), (150, 180, 750, 980)),
    ('cat_dance_left', os.path.join(ART_DIR, 'cat_win_dance_1790351847125.jpg'), (150, 200, 750, 980)),
    ('cat_dance_right', os.path.join(ART_DIR, 'cat_win_sway_1790351968371.jpg'), (150, 200, 750, 980)),
    ('cat_victory', os.path.join(SHOTS_DIR, 'win_v2_f5_victory.png'), (80, 200, 700, 1050)),
]

print('Initializing BiRefNet session...')
sess = rembg.new_session('birefnet-general')

for name, path, crop_box in poses:
    out_file = os.path.join(SHOTS_DIR, f'{name}.png')
    if os.path.exists(out_file):
        print(f'Skipping {name}, already exists.')
        continue
    print(f'Extracting {name} from {os.path.basename(path)}...')
    im = Image.open(path)
    crop = im.crop(crop_box)
    crop.thumbnail((450, 600), Image.Resampling.LANCZOS)
    out = rembg.remove(crop, session=sess)

    # Clean stray pixels
    arr = np.array(out)
    h, w = arr.shape[:2]
    # lower right corner clean for background shelf artifacts
    if name in ['cat_chop', 'cat_stir', 'cat_pass']:
        for y in range(int(h * 0.65), h):
            for x in range(int(w * 0.8), w):
                arr[y, x, 3] = 0

    clean_img = Image.fromarray(arr)
    bbox = clean_img.getbbox()
    if bbox:
        clean_img = clean_img.crop(bbox)

    clean_img.save(out_file)
    clean_img.save(os.path.join(CAT_ASSET_DIR, f'{name}.png'))
    print(f'  [OK] Saved {name}.png, size={clean_img.size}')
    gc.collect()

# Copy cat_tie and cat_ready to CAT_ASSET_DIR as well
tie_src = os.path.join(SHOTS_DIR, 'test_rembg_tie_birefnet.png')
if os.path.exists(tie_src):
    im_tie = Image.open(tie_src)
    arr = np.array(im_tie)
    h, w = arr.shape[:2]
    for y in range(int(h * 0.55), h):
        for x in range(int(w * 0.75), w):
            arr[y, x, 3] = 0
    clean_tie = Image.fromarray(arr)
    bbox = clean_tie.getbbox()
    if bbox:
        clean_tie = clean_tie.crop(bbox)
    clean_tie.save(os.path.join(SHOTS_DIR, 'cat_tie.png'))
    clean_tie.save(os.path.join(CAT_ASSET_DIR, 'cat_tie.png'))
    print('  [OK] Saved cat_tie.png')

ready_src = os.path.join(SHOTS_DIR, 'cat_ready.png')
if os.path.exists(ready_src):
    Image.open(ready_src).save(os.path.join(CAT_ASSET_DIR, 'cat_ready.png'))
    print('  [OK] Copied cat_ready.png')

cheer_src = os.path.join(SHOTS_DIR, 'cat_cheer.png')
if os.path.exists(cheer_src):
    Image.open(cheer_src).save(os.path.join(CAT_ASSET_DIR, 'cat_cheer.png'))
    print('  [OK] Copied cat_cheer.png')

print('[ALL POSES COMPLETE] Finished extracting all poses!')
