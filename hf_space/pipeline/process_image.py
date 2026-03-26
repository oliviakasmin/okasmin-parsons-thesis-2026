# RUN THIS FILE FROM ROOT DIRECTORY
# python hf_space/pipeline/process_image.py

from pathlib import Path

from crop_standardize import run_crop_standardize_step
from remove_background import run_remove_background_step

TEST_IMAGE_URL = "https://images.metmuseum.org/CRDImages/as/web-large/DP368008.jpg"
TEST_OBJECT_ID = "46043"

DEFAULT_TARGET_SIZE = 768
DEFAULT_ALPHA_THRESHOLD = 16
DEFAULT_MARGIN_RATIO = 0.02


def process_single_image(image_url, object_id, output_dir):
    """
    End-to-end image pipeline:
    1) remove background
    2) crop + standardize
    3) save all outputs in output_dir
    """
    no_bg_image, model_mask = run_remove_background_step(image_url=image_url)
    standardized_image, standardized_mask, meta = run_crop_standardize_step(
        no_bg_image=no_bg_image,
        model_mask=model_mask,
        object_id=object_id,
        target_size=DEFAULT_TARGET_SIZE,
        alpha_threshold=DEFAULT_ALPHA_THRESHOLD,
        margin_ratio=DEFAULT_MARGIN_RATIO,
    )

    standardized_path = output_dir / f"{object_id}_no_bg_standardized.png"
    standardized_mask_path = output_dir / f"{object_id}_mask_standardized.png"

    # Save only the final standardized outputs after both steps succeed.
    standardized_image.save(standardized_path)
    standardized_mask.save(standardized_mask_path)

    print("Pipeline complete.")
    # print(f"- standardized: {standardized_path.name}")
    # print(f"- standardized_mask: {standardized_mask_path.name}")
    # print(
    #     f"- silhouette spacing: left={meta['left_clearance_px']}px "
    #     f"right={meta['right_clearance_px']}px"
    # )


def main():
    repo_root = Path(__file__).resolve().parents[2]
    output_dir = repo_root / "hf_space" / "pipeline" / "test_images"
    output_dir.mkdir(parents=True, exist_ok=True)

    process_single_image(
        image_url=TEST_IMAGE_URL,
        object_id=TEST_OBJECT_ID,
        output_dir=output_dir,
    )


if __name__ == "__main__":
    main()
