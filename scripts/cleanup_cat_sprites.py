import os
import numpy as np
from PIL import Image

BASE_DIR = r'C:\Users\admin\Music\chufang'
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
CAT_ASSET_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat')

def clean_sprite(name):
    path = os.path.join(SHOTS_DIR, f'{name}.png')
    if not os.path.exists(path):
        print(f'{path} not found!')
        return None
    im = Image.open(path).convert('RGBA')
    arr = np.array(im)
    h, w = arr.shape[:2]

    # Clean specific background elements:
    if name == 'cat_dance_left':
        # Remove pot on bottom right: y > 270, x > 115
        for y in range(260, h):
            for x in range(115, w):
                arr[y, x, 3] = 0
    elif name == 'cat_dance_right':
        # Remove pot on bottom right: y > 270, x > 110
        for y in range(260, h):
            for x in range(110, w):
                arr[y, x, 3] = 0
    elif name == 'cat_pass':
        # In pass, cat holds the dish on left. Remove pot on bottom right: y > 260, x > 150
        for y in range(250, h):
            for x in range(145, w):
                arr[y, x, 3] = 0
    elif name == 'cat_stir':
        # Cat holds ladle. Remove pot on bottom right so pot stays on props layer: y > 240, x > 140
        for y in range(235, h):
            for x in range(140, w):
                arr[y, x, 3] = 0
    elif name == 'cat_chop':
        # Clean any board edge outside knife/onion: lower right corner
        for y in range(int(h * 0.75), h):
            for x in range(int(w * 0.78), w):
                arr[y, x, 3] = 0

    clean_im = Image.fromarray(arr)
    bbox = clean_im.getbbox()
    if bbox:
        clean_im = clean_im.crop(bbox)

    out_shot = os.path.join(SHOTS_DIR, f'clean_{name}.png')
    out_asset = os.path.join(CAT_ASSET_DIR, f'{name}.png')
    clean_im.save(out_shot)
    clean_im.save(out_asset)
    print(f'[OK] Cleaned {name}: size={clean_im.size}')
    return clean_im

if __name__ == '__main__':
    poses = [
        'cat_ready', 'cat_tie', 'cat_cheer', 'cat_chop',
        'cat_stir', 'cat_pass', 'cat_dance_left', 'cat_dance_right', 'cat_victory'
    ]
    for p in poses:
        clean_sprite(p)
