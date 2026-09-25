import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = r'C:\Users\admin\Music\chufang'
ARTIFACT_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
CAT_ASSET_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'cat')

def extract_frame(video_path, time_sec, out_path):
    cmd = [
        'ffmpeg', '-y', '-ss', str(time_sec),
        '-i', video_path,
        '-vframes', '1',
        out_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# 1. Extract frames
vid_open = os.path.join(CAT_ASSET_DIR, 'restaurant_open.mp4')
vid_work = os.path.join(CAT_ASSET_DIR, 'restaurant_work_loop.mp4')
vid_win = os.path.join(CAT_ASSET_DIR, 'restaurant_win.mp4')

# OPEN
extract_frame(vid_open, 0.15, os.path.join(SHOTS_DIR, 'open_v2_f1_cloud.png'))
extract_frame(vid_open, 1.0, os.path.join(SHOTS_DIR, 'open_v2_f2_tie.png'))
extract_frame(vid_open, 1.8, os.path.join(SHOTS_DIR, 'open_v2_f3_cheer.png'))
extract_frame(vid_open, 2.5, os.path.join(SHOTS_DIR, 'open_v2_f4_ready.png'))

# WORK
extract_frame(vid_work, 0.05, os.path.join(SHOTS_DIR, 'work_v2_f1_first.png'))
extract_frame(vid_work, 2.3, os.path.join(SHOTS_DIR, 'work_v2_f2_ticket.png'))
extract_frame(vid_work, 3.8, os.path.join(SHOTS_DIR, 'work_v2_f3_stir.png'))
extract_frame(vid_work, 5.5, os.path.join(SHOTS_DIR, 'work_v2_f4_pass.png'))
extract_frame(vid_work, 7.1, os.path.join(SHOTS_DIR, 'work_v2_f5_last.png'))

# WIN
extract_frame(vid_win, 0.2, os.path.join(SHOTS_DIR, 'win_v2_f1_start.png'))
extract_frame(vid_win, 0.6, os.path.join(SHOTS_DIR, 'win_v2_f2_surprise.png'))
extract_frame(vid_win, 2.0, os.path.join(SHOTS_DIR, 'win_v2_f3_dance_left.png'))
extract_frame(vid_win, 3.0, os.path.join(SHOTS_DIR, 'win_v2_f4_dance_right.png'))
extract_frame(vid_win, 3.8, os.path.join(SHOTS_DIR, 'win_v2_f5_victory.png'))

# Copy extracted frames to artifacts
for fname in os.listdir(SHOTS_DIR):
    if fname.startswith(('open_v2_', 'work_v2_', 'win_v2_')):
        shutil_src = os.path.join(SHOTS_DIR, fname)
        shutil_dst = os.path.join(ARTIFACT_DIR, fname)
        with open(shutil_src, 'rb') as fsrc, open(shutil_dst, 'wb') as fdst:
            fdst.write(fsrc.read())

# 2. Build WORK_LOOP first vs last comparison image
im_first = Image.open(os.path.join(SHOTS_DIR, 'work_v2_f1_first.png'))
im_last = Image.open(os.path.join(SHOTS_DIR, 'work_v2_f5_last.png'))

fw, fh = im_first.size
comp_w = fw * 2 + 30
comp_h = fh + 60
comp_img = Image.new('RGB', (comp_w, comp_h), (247, 241, 231))
draw = ImageDraw.Draw(comp_img)

comp_img.paste(im_first, (10, 50))
comp_img.paste(im_last, (fw + 20, 50))

# Labels
draw.text((10 + fw // 4, 15), "FIRST FRAME (0.0s)", fill=(70, 55, 40))
draw.text((fw + 20 + fw // 4, 15), "LAST FRAME (7.1s)", fill=(70, 55, 40))
draw.line([fw + 15, 0, fw + 15, comp_h], fill=(216, 181, 140), width=2)

comp_out1 = os.path.join(SHOTS_DIR, 'work_v2_first_vs_last.png')
comp_out2 = os.path.join(ARTIFACT_DIR, 'work_v2_first_vs_last.png')
comp_img.save(comp_out1)
comp_img.save(comp_out2)

print('[OK] Contact sheet frames and first-vs-last comparison image generated!')
