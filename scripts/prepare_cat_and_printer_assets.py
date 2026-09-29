import os
import rembg
import numpy as np
from PIL import Image, ImageDraw

BASE_DIR = r'C:\Users\admin\Music\chufang'
ART_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
CAT_ASSET_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat')
os.makedirs(CAT_ASSET_DIR, exist_ok=True)
os.makedirs(SHOTS_DIR, exist_ok=True)

# 1. Prepare Printer Base and Paper
def prepare_printer():
    im_printer = Image.open(os.path.join(SHOTS_DIR, 'test_rembg_printer.png')).convert('RGBA')
    # Bounding box of printer body
    # Slot is roughly y: 130..150
    # Let's create printer_base without paper sticking out
    printer_base = im_printer.copy()
    pw, ph = printer_base.size

    # The paper is below y = 140 in test_rembg_printer.
    # We create printer_paper by cropping the paper portion:
    paper_crop = im_printer.crop((70, 140, 205, ph))
    paper_crop.save(os.path.join(CAT_ASSET_DIR, 'printer_paper.png'))
    paper_crop.save(os.path.join(SHOTS_DIR, 'printer_paper.png'))

    # Fill paper area on printer_base: below slot is transparent
    p_data = np.array(printer_base)
    # Erase paper below slot y > 145
    p_data[145:, :, 3] = 0
    # Inside the slot, make it dark grey slot interior
    # Slot is x: 74..202, y: 130..144
    for y in range(132, 144):
        for x in range(76, 200):
            p_data[y, x] = [32, 35, 42, 255]

    clean_base = Image.fromarray(p_data)
    # Crop to tight bounding box of printer casing
    bbox = clean_base.getbbox()
    clean_base = clean_base.crop(bbox)

    # Scale to standard stage size: width = 82 px (stage width = 170)
    target_w = 82
    scale = target_w / clean_base.width
    target_h = int(clean_base.height * scale)
    clean_base_scaled = clean_base.resize((target_w, target_h), Image.Resampling.LANCZOS)

    clean_base_scaled.save(os.path.join(CAT_ASSET_DIR, 'printer_base.png'))
    clean_base_scaled.save(os.path.join(SHOTS_DIR, 'printer_base.png'))
    print(f'[OK] printer_base.png ({clean_base_scaled.size}) and printer_paper.png created!')

# 2. Extract and Normalize Cat Poses
def extract_cat_poses():
    print('Initializing BiRefNet session...')
    sess = rembg.new_session('birefnet-general')
    print('BiRefNet session ready.')

    poses_to_extract = [
        ('cat_ready', os.path.join(ART_DIR, 'narrow_stage_master_1790356624694.jpg'), (100, 260, 680, 1050)),
        ('cat_tie', os.path.join(ART_DIR, 'narrow_open_tie_1790356661183.jpg'), (100, 240, 680, 1050)),
        ('cat_cheer', os.path.join(ART_DIR, 'narrow_open_cheer_1790356690652.jpg'), (80, 200, 700, 1050)),
        ('cat_chop', os.path.join(ART_DIR, 'narrow_work_chop_1790356719385.jpg'), (100, 260, 680, 1050)),
        ('cat_stir', os.path.join(ART_DIR, 'cat_work_stir_1790351635057.jpg'), (150, 180, 750, 980)),
        ('cat_pass', os.path.join(ART_DIR, 'cat_work_pass_1790351734241.jpg'), (150, 180, 750, 980)),
        ('cat_dance_left', os.path.join(ART_DIR, 'cat_win_dance_1790351847125.jpg'), (150, 200, 750, 980)),
        ('cat_dance_right', os.path.join(ART_DIR, 'cat_win_sway_1790351968371.jpg'), (150, 200, 750, 980)),
        ('cat_victory', os.path.join(SHOTS_DIR, 'win_v2_f5_victory.png'), (80, 200, 700, 1050)),
    ]

    for name, src_path, crop_box in poses_to_extract:
        if not os.path.exists(src_path):
            print(f'Warning: {src_path} not found!')
            continue
        print(f'Processing {name} from {os.path.basename(src_path)}...')
        src_img = Image.open(src_path)
        crop_img = src_img.crop(crop_box)
        rgba = rembg.remove(crop_img, session=sess)

        # Clean stray background pixels (e.g. isolated small clusters outside cat body)
        data = np.array(rgba)
        # Find cat center and mask out stray shelf objects on upper right or left if alpha > 0
        h, w = data.shape[:2]
        # In lower right corner (y > h*0.6, x > w*0.8), clear any stray cup
        if name in ['cat_tie', 'cat_ready']:
            for y in range(int(h * 0.55), h):
                for x in range(int(w * 0.78), w):
                    data[y, x, 3] = 0

        clean_cat = Image.fromarray(data)
        bbox = clean_cat.getbbox()
        if bbox:
            clean_cat = clean_cat.crop(bbox)

        # Save transparent raw sprite
        out_path1 = os.path.join(CAT_ASSET_DIR, f'{name}.png')
        out_path2 = os.path.join(SHOTS_DIR, f'{name}.png')
        clean_cat.save(out_path1)
        clean_cat.save(out_path2)
        print(f'  -> Saved {name}.png, size={clean_cat.size}')

if __name__ == '__main__':
    prepare_printer()
    extract_cat_poses()
    print('[ALL DONE] All transparent assets prepared successfully!')
