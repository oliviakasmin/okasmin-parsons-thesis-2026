import json
import uuid
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
    final_paths = [no_bg_path, mask_path, outline_path]

    # Write to temporary files first, then commit all outputs together.
    token = uuid.uuid4().hex
    temp_paths = [output_dir / f"{path.name}.{token}.tmp" for path in final_paths]
    try:
        no_bg_image.save(temp_paths[0], format="PNG")
        model_mask.save(temp_paths[1], format="PNG")
        outline_image.save(temp_paths[2], format="PNG")

        for temp_path, final_path in zip(temp_paths, final_paths):
            temp_path.replace(final_path)

        if not all(path.exists() for path in final_paths):
            raise RuntimeError(f"Incomplete output set for object_id={obj_id}")
    except Exception:
        # Ensure this object is either fully saved or removed.
        for path in temp_paths + final_paths:
            try:
                if path.exists():
                    path.unlink()
            except Exception:
                pass
        raise

    return no_bg_path, mask_path, outline_path
