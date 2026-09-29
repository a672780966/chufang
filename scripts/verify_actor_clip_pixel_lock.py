import os
import sys
import json
import numpy as np
from PIL import Image

BASE_DIR = r'C:\Users\admin\Music\chufang'
ACTOR_CAT_DIR = os.path.join(BASE_DIR, 'packages', 'web-greybox', 'public', 'assets', 'actor_pack', 'cat')
SHOTS_DIR = os.path.join(BASE_DIR, 'scripts', 'shots')
ART_DIR = r'C:\Users\admin\.gemini\antigravity\brain\a581706c-feba-4a01-94fc-8c62ff40a9bf'

def verify_pixel_lock():
    bg_master_path = os.path.join(ACTOR_CAT_DIR, 'background_master.png')
    mask_path = os.path.join(ACTOR_CAT_DIR, 'motion_mask.png')

    if not os.path.exists(bg_master_path):
        print(f'[FAIL] background_master.png not found at {bg_master_path}')
        return False
    if not os.path.exists(mask_path):
        print(f'[FAIL] motion_mask.png not found at {mask_path}')
        return False

    bg_master = np.array(Image.open(bg_master_path).convert('RGB'), dtype=np.int32)
    motion_mask = np.array(Image.open(mask_path).convert('L'), dtype=np.uint8)
    is_motion = motion_mask > 0
    is_static = ~is_motion

    static_pixel_count = int(np.count_nonzero(is_static))
    motion_pixel_count = int(np.count_nonzero(is_motion))
    total_pixels = bg_master.shape[0] * bg_master.shape[1]

    print("=" * 65)
    print("STAGE 4.2 REVISION 4: ACTOR CLIP PIXEL LOCK VERIFICATION")
    print(f"Canvas: {bg_master.shape[1]}x{bg_master.shape[0]}")
    print(f"Total Pixels: {total_pixels}")
    print(f"Static Region Pixels (Must have 0 diff): {static_pixel_count} ({static_pixel_count/total_pixels*100:.1f}%)")
    print(f"Motion Region Pixels: {motion_pixel_count} ({motion_pixel_count/total_pixels*100:.1f}%)")
    print("=" * 65)

    actions = ['idle', 'chop', 'stir', 'pass', 'win']
    action_reports = []
    overall_pass = True

    for act in actions:
        act_dir = os.path.join(ACTOR_CAT_DIR, act)
        if not os.path.isdir(act_dir):
            print(f'[FAIL] Missing action directory: {act_dir}')
            overall_pass = False
            continue

        frames = sorted([f for f in os.listdir(act_dir) if f.endswith('.png')])
        frame_count = len(frames)
        if frame_count == 0:
            print(f'[FAIL] No frames in {act_dir}')
            overall_pass = False
            continue

        total_changed_outside = 0
        total_changed_inside = 0
        max_bg_diff_overall = 0
        frame_failures = 0

        for f_name in frames:
            f_path = os.path.join(act_dir, f_name)
            frame_arr = np.array(Image.open(f_path).convert('RGB'), dtype=np.int32)

            if frame_arr.shape != bg_master.shape:
                print(f'[FAIL] Shape mismatch in {act}/{f_name}: {frame_arr.shape} vs {bg_master.shape}')
                frame_failures += 1
                overall_pass = False
                continue

            # Pixel difference
            diff = np.abs(frame_arr - bg_master) # shape (H, W, 3)
            diff_max_ch = np.max(diff, axis=-1)   # shape (H, W)

            # Outside motion mask (Static Background)
            outside_diffs = diff_max_ch[is_static]
            changed_outside = int(np.count_nonzero(outside_diffs > 0))
            max_outside = int(np.max(outside_diffs)) if outside_diffs.size > 0 else 0

            # Inside motion mask (Dynamic character/props/fx)
            inside_diffs = diff_max_ch[is_motion]
            changed_inside = int(np.count_nonzero(inside_diffs > 0))

            total_changed_outside += changed_outside
            total_changed_inside += changed_inside
            max_bg_diff_overall = max(max_bg_diff_overall, max_outside)

            if changed_outside > 0 or max_outside > 0:
                print(f'[FAIL] {act}/{f_name}: {changed_outside} pixels changed outside motion mask! Max diff: {max_outside}')
                frame_failures += 1
                overall_pass = False

        status = "PASS" if frame_failures == 0 else "FAIL"
        report_item = {
            "action": f"cat_{act}",
            "frame_count": frame_count,
            "changed_pixels_inside_motion_mask": total_changed_inside,
            "changed_pixels_outside_motion_mask": total_changed_outside,
            "max_background_diff": max_bg_diff_overall,
            "status": status
        }
        action_reports.append(report_item)

        print(f"[{status}] cat_{act:4s} | {frame_count:2d} frames | Outside Diff: {total_changed_outside} px (Max: {max_bg_diff_overall}) | Inside Dynamic: {total_changed_inside} px")

    # Spritesheet verification
    print("-" * 65)
    print("Verifying Spritesheets & JSON Metadata...")
    for act in actions:
        sheet_path = os.path.join(ACTOR_CAT_DIR, 'spritesheets', f'cat_{act}_sheet.png')
        json_path = os.path.join(ACTOR_CAT_DIR, 'metadata', f'cat_{act}.json')

        if not os.path.exists(sheet_path) or not os.path.exists(json_path):
            print(f"[FAIL] Missing spritesheet or json for cat_{act}")
            overall_pass = False
            continue

        with open(json_path, 'r', encoding='utf-8') as jf:
            meta = json.load(jf)

        sheet_img = Image.open(sheet_path).convert('RGB')
        for frame_info in meta['frames']:
            rect = frame_info['frame']
            crop_f = np.array(sheet_img.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h'])), dtype=np.int32)
            diff = np.max(np.abs(crop_f - bg_master), axis=-1)
            outside_diff = diff[is_static]
            ch_out = np.count_nonzero(outside_diff > 0)
            if ch_out > 0:
                print(f"[FAIL] Spritesheet cat_{act} frame {frame_info['filename']} has {ch_out} changed pixels outside mask!")
                overall_pass = False

    print("=" * 65)
    final_status = "PASS" if overall_pass else "FAIL"
    print(f"OVERALL PIXEL LOCK VERIFICATION: {final_status}")
    print("=" * 65)

    full_report = {
        "overall_status": final_status,
        "resolution": {"width": bg_master.shape[1], "height": bg_master.shape[0]},
        "static_pixels_per_frame": static_pixel_count,
        "motion_pixels_per_frame": motion_pixel_count,
        "actions": action_reports
    }

    report_path1 = os.path.join(ACTOR_CAT_DIR, 'pixel_lock_report.json')
    report_path2 = os.path.join(SHOTS_DIR, 'pixel_lock_report.json')
    report_path3 = os.path.join(ART_DIR, 'pixel_lock_report.json')

    for p in [report_path1, report_path2, report_path3]:
        with open(p, 'w', encoding='utf-8') as rf:
            json.dump(full_report, rf, indent=2)

    print(f"Report saved to {report_path1}")
    return overall_pass

if __name__ == '__main__':
    ok = verify_pixel_lock()
    sys.exit(0 if ok else 1)
