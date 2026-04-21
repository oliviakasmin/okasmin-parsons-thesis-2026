# RUN THIS FILE FROM ROOT DIRECTORY.
# python process_data/process_images/crop_standardize.py

"""
Standardize vessel image after background removed using the BRIA model output.
"""

from pathlib import Path

from PIL import Image

DEFAULT_TARGET_SIZE = 768  # Sets the output square canvas size in pixels.
DEFAULT_ALPHA_THRESHOLD = (
    16  # Sets minimum mask value treated as foreground (corrects for any fuzzy borders on masks).
)

TEST_OBJECT_ID = "37433"  # Demo object ID used by main() for local testing.


# Return foreground bounding box (left, top, right, bottom) from a mask.
def get_foreground_bbox(mask_image, alpha_threshold=DEFAULT_ALPHA_THRESHOLD):
    binary = mask_image.point(lambda p: 255 if p >= alpha_threshold else 0)
    bbox = binary.getbbox()  # Gets smallest rectangle containing non-zero pixels.
    if bbox is None:
        raise ValueError(
            "No foreground pixels found above threshold."
        )  # Fails clearly for empty masks.
    return bbox


"""
    Crop to foreground and place vessel on a fixed-size square canvas.
    Vessel is scaled to maximize occupied area while preserving aspect ratio.
"""


def crop_and_standardize_vessel(
    no_bg_image,  # RGBA vessel image with removed background.
    model_mask,  # Corresponding model mask image.
    target_size=DEFAULT_TARGET_SIZE,  # Output width/height in pixels.
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,  # Foreground cut-off value for masks.
):
    bbox = get_foreground_bbox(model_mask, alpha_threshold=alpha_threshold)  # Finds vessel bounds.

    vessel_crop = no_bg_image.crop(bbox)  # Crops vessel image tightly to foreground bbox.
    mask_crop = model_mask.crop(bbox)  # Crops mask to the same bbox for alignment.
    crop_w, crop_h = vessel_crop.size  # Reads cropped dimensions used for scaling.

    scale = min(target_size / crop_w, target_size / crop_h)  # Chooses max scale that fits canvas.

    resized_w = max(1, int(round(crop_w * scale)))  # Computes scaled width with floor at 1px.
    resized_h = max(1, int(round(crop_h * scale)))  # Computes scaled height with floor at 1px.
    resized = vessel_crop.resize(
        (resized_w, resized_h), Image.Resampling.LANCZOS
    )  # High-quality resize.
    resized_mask = mask_crop.resize(
        (resized_w, resized_h), Image.Resampling.LANCZOS
    )  # Resizes mask equally.

    standardized = Image.new(
        "RGBA", (target_size, target_size), (255, 255, 255, 0)
    )  # Creates transparent RGBA canvas.
    standardized_mask = Image.new(
        "L", (target_size, target_size), 0
    )  # Creates empty grayscale alpha mask canvas.
    paste_x = (target_size - resized_w) // 2  # Centers vessel horizontally.
    paste_y = target_size - resized_h  # Bottom-aligns vessel directly to canvas edge.
    standardized.paste(
        resized, (paste_x, paste_y), resized
    )  # Pastes vessel using its alpha channel.
    standardized_mask.paste(
        resized_mask, (paste_x, paste_y)
    )  # Pastes resized mask into mask canvas.
    standardized.putalpha(standardized_mask)  # Reapplies mask as final image alpha channel.

    return standardized, standardized_mask  # Returns standardized image and mask.


# Convenience wrapper returning RGBA vessel + transparent RGBA mask so both images have transparent background
def standardize_single_image(
    no_bg_image,
    model_mask,
    target_size=DEFAULT_TARGET_SIZE,
    alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
):
    standardized, std_mask = crop_and_standardize_vessel(  # Runs core standardization routine.
        no_bg_image,
        model_mask,
        target_size=target_size,
        alpha_threshold=alpha_threshold,
    )
    transparent_mask = Image.new(
        "RGBA", std_mask.size, (255, 255, 255, 0)
    )  # Builds transparent RGBA mask image.
    transparent_mask.putalpha(std_mask)  # Uses standardized L-mask as alpha channel.
    return standardized, transparent_mask  # Returns vessel image and RGBA mask.


def main():  # Runs a local one-image smoke test from repository context.
    repo_root = Path(__file__).resolve().parents[2]
    test_images_dir = repo_root / "process_data" / "test_images"
    input_no_bg_path = test_images_dir / f"{TEST_OBJECT_ID}_no_bg.png"
    input_mask_path = test_images_dir / f"{TEST_OBJECT_ID}_mask_img.png"
    if not input_no_bg_path.exists() or not input_mask_path.exists():
        raise FileNotFoundError(
            f"Expected {input_no_bg_path.name} and {input_mask_path.name} in {test_images_dir}. "
            "Run process_image.py first."
        )
    no_bg_image = Image.open(input_no_bg_path)
    model_mask = Image.open(input_mask_path)
    standardize_single_image(  # Executes crop/standardize pipeline step in memory.
        no_bg_image=no_bg_image,
        model_mask=model_mask,
    )
    print(f"Crop/standardize complete in memory for {TEST_OBJECT_ID}")
    print("Done. Processed 1 image in memory (no files saved).")


if __name__ == "__main__":  # Ensures main() only runs when this file is executed directly.
    main()  # Starts local test execution flow.
