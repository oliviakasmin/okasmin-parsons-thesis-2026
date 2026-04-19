import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
OBJECTS_JSON = REPO_ROOT / "pipeline/data/objects.json"

save_output_dir = REPO_ROOT / "hf_space/pipeline/test_images_2"


def load_objects_json(objects_json_path=OBJECTS_JSON):
    with Path(objects_json_path).open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError("Expected objects.json to be a dict keyed by object ID.")

    return list(data.values())


def find_object_image_url(object_id, objects):
    for obj in objects:
        if str(obj.get("objectID")) != str(object_id):
            continue
        image_url = obj.get("primaryImageSmall")
        if image_url:
            return image_url
    return None


def save_images(no_bg_image, model_mask, outline_image, obj_id, output_dir=save_output_dir):
    output_dir = Path(output_dir)
    if not output_dir.exists():
        raise FileNotFoundError(f"Output directory does not exist: {output_dir}")

    no_bg_path = output_dir / f"{obj_id}_no_bg.png"
    mask_path = output_dir / f"{obj_id}_mask.png"
    outline_path = output_dir / f"{obj_id}_outline.png"

    no_bg_image.save(no_bg_path)
    model_mask.save(mask_path)
    outline_image.save(outline_path)
    return no_bg_path, mask_path, outline_path
