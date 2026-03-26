# RUN THIS FILE FROM ROOT DIRECTORY
# python hf_space/pipeline/crop_standardize.py

from pathlib import Path

from PIL import Image

TEST_OBJECT_ID = "LC-29_100_250_whs-002"
DEFAULT_TARGET_SIZE = 768
DEFAULT_ALPHA_THRESHOLD = 16
DEFAULT_MARGIN_RATIO = 0.02


def threshold_mask(mask_image, alpha_threshold):
    mask_l = mask_image.convert("L")
    return mask_l.point(lambda p: 255 if p >= alpha_threshold else 0)


def get_foreground_bbox(mask_image, alpha_threshold=DEFAULT_ALPHA_THRESHOLD):
    """
    Return foreground bounding box (left, top, right, bottom) from a mask.
    """
    binary = threshold_mask(mask_image, alpha_threshold=alpha_threshold)
    bbox = binary.getbbox()
    if bbox is None:
        raise ValueError("No foreground pixels found above threshold.")
    return bbox


def crop_and_standardize_vessel(
    no_bg_image,
    model_mask,
    target_size=DEFAULT_TARGET_SIZE,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    margin_ratio=DEFAULT_MARGIN_RATIO,
):
    """
    Crop to foreground and place vessel on a fixed-size square canvas.
    Vessel is scaled to maximize occupied area while preserving aspect ratio.
    """
    rgba = no_bg_image.convert("RGBA")
    mask_l = model_mask.convert("L")
    bbox = get_foreground_bbox(mask_l, alpha_threshold=alpha_threshold)

    vessel_crop = rgba.crop(bbox)
    mask_crop = mask_l.crop(bbox)
    crop_w, crop_h = vessel_crop.size

    margin_px = max(0, int(round(target_size * margin_ratio)))
    fit_size = max(1, target_size - (2 * margin_px))
    scale = min(fit_size / crop_w, fit_size / crop_h)

    resized_w = max(1, int(round(crop_w * scale)))
    resized_h = max(1, int(round(crop_h * scale)))
    resized = vessel_crop.resize((resized_w, resized_h), Image.Resampling.LANCZOS)
    resized_mask = mask_crop.resize((resized_w, resized_h), Image.Resampling.LANCZOS)

    standardized = Image.new("RGBA", (target_size, target_size), (255, 255, 255, 0))
    standardized_mask = Image.new("L", (target_size, target_size), 0)
    paste_x = (target_size - resized_w) // 2
    paste_y = max(margin_px, target_size - margin_px - resized_h)
    standardized.paste(resized, (paste_x, paste_y), resized)
    standardized_mask.paste(resized_mask, (paste_x, paste_y))
    standardized.putalpha(standardized_mask)

    # Recompute bbox on standardized image for downstream measurements.
    std_bbox = get_foreground_bbox(standardized_mask, alpha_threshold=alpha_threshold)
    left_clearance = std_bbox[0]
    right_clearance = target_size - std_bbox[2]

    metadata = {
        "original_bbox": bbox,
        "standardized_bbox": std_bbox,
        "paste_x": paste_x,
        "paste_y": paste_y,
        "scale": scale,
        "target_size": target_size,
        "alpha_threshold": alpha_threshold,
        "left_clearance_px": left_clearance,
        "right_clearance_px": right_clearance,
    }
    return standardized, standardized_mask, metadata


def standardize_single_image(
    no_bg_image,
    model_mask,
    target_size=DEFAULT_TARGET_SIZE,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    margin_ratio=DEFAULT_MARGIN_RATIO,
):
    standardized, std_mask, meta = crop_and_standardize_vessel(
        no_bg_image,
        model_mask,
        target_size=target_size,
        alpha_threshold=alpha_threshold,
        margin_ratio=margin_ratio,
    )
    transparent_mask = Image.new("RGBA", std_mask.size, (255, 255, 255, 0))
    transparent_mask.putalpha(std_mask.convert("L"))
    return standardized, transparent_mask, meta


def run_crop_standardize_step(
    no_bg_image,
    model_mask,
    object_id,
    target_size=DEFAULT_TARGET_SIZE,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
    margin_ratio=DEFAULT_MARGIN_RATIO,
):
    standardized, transparent_mask, meta = standardize_single_image(
        no_bg_image=no_bg_image,
        model_mask=model_mask,
        target_size=target_size,
        alpha_threshold=alpha_threshold,
        margin_ratio=margin_ratio,
    )
    print(
        f"Crop/standardize complete in memory for {object_id} | "
        f"left={meta['left_clearance_px']}px right={meta['right_clearance_px']}px"
    )
    return standardized, transparent_mask, meta


def main():
    repo_root = Path(__file__).resolve().parents[2]
    test_images_dir = repo_root / "hf_space" / "pipeline" / "test_images"
    input_no_bg_path = test_images_dir / f"{TEST_OBJECT_ID}_no_bg.png"
    input_mask_path = test_images_dir / f"{TEST_OBJECT_ID}_mask_img.png"
    if not input_no_bg_path.exists() or not input_mask_path.exists():
        raise FileNotFoundError(
            f"Expected {input_no_bg_path.name} and {input_mask_path.name} in {test_images_dir}. "
            "Run process_image.py first."
        )
    no_bg_image = Image.open(input_no_bg_path).convert("RGBA")
    model_mask = Image.open(input_mask_path).convert("L")
    run_crop_standardize_step(
        no_bg_image=no_bg_image,
        model_mask=model_mask,
        object_id=TEST_OBJECT_ID,
    )
    print("Done. Processed 1 image in memory (no files saved).")


if __name__ == "__main__":
    main()
