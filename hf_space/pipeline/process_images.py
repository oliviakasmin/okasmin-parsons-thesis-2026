import sys
from pathlib import Path

pipeline_dir = Path("../pipeline").resolve()
if str(pipeline_dir) not in sys.path:
    sys.path.insert(0, str(pipeline_dir))

from remove_background import run_remove_background_step
from crop_standardize import standardize_single_image
from extract_mask_contours import (
    extract_outline_from_mask_image,
    draw_contours_from_mask_image,
)
from utils import find_object_image_url, load_objects_json, save_images


objects = load_objects_json()


def process_image(object_id):
    img_url = find_object_image_url(object_id, objects)
    no_bg_image, model_mask = run_remove_background_step(image_url=img_url)
    standardized, std_mask = standardize_single_image(no_bg_image, model_mask)
    contours, outer_contours, inner_contours, binary = extract_outline_from_mask_image(std_mask)
    contours_image = draw_contours_from_mask_image(mask_image=std_mask, contours=contours)
    save_images(standardized, std_mask, contours_image, object_id)
