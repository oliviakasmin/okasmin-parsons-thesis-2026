# RUN THIS FILE FROM ROOT DIRECTORY
# python -m pipeline.fetch.get_objects


# loop through object_ids and save relevant info for each object
url = f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}"

# function to verify if want to include object based on certain properties. if keep, then save to objecst.json, otherwise save object id to reject-object-ids.json and don't save additional info to objects.json for that object

import json
import random
import time
from pathlib import Path
from typing import Any, Dict, List

import requests
from tqdm import tqdm

# NOTE: Run this file as a module:
#   python -m pipeline.fetch.get_objects

from .filter_objects import apply_filters  # centralised filtering logic


class ForbiddenError(Exception):
    """Raised when the Met API returns HTTP 403 for an object."""


# Paths
ROOT = Path(__file__).resolve().parents[2]  # .../okasmin-parsons-thesis-2026
DATA_DIR = ROOT / "pipeline" / "data"
OBJECT_IDS_PATH = DATA_DIR / "object_ids.json"
OBJECTS_PATH = DATA_DIR / "objects.json"
REJECT_IDS_PATH = DATA_DIR / "reject_object_ids.json"
API_ERRORS_PATH = DATA_DIR / "api_errors_object_ids.json"

# Throttling / batching
REQUEST_TIMEOUT = 30
SLEEP_BETWEEN_REQUESTS = 0.05  # seconds; bump up if you hit rate limits
SAVE_EVERY_N_OBJECTS = 200  # how often to flush to disk
MAX_NEW_IDS_PER_RUN = 500  # hard cap per run to avoid over-fetching


def load_json_list(path: Path) -> List[Any]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_json_dict(path: Path) -> Dict[str, Any]:
    if not path.exists() or path.stat().st_size == 0:
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def fetch_object(object_id: int) -> Dict[str, Any]:
    url = f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{object_id}"
    resp = requests.get(url, timeout=REQUEST_TIMEOUT)

    # If we ever get a 403, stop this run so we don't hammer the API.
    if resp.status_code == 403:
        raise ForbiddenError(f"403 Forbidden for object {object_id}")

    resp.raise_for_status()
    return resp.json()


def remove_empty_string_fields(value: Any) -> Any:
    """
    Recursively remove dict keys where the value is an empty string.
    """
    if isinstance(value, dict):
        cleaned: Dict[str, Any] = {}
        for key, child in value.items():
            if child == "":
                continue
            cleaned[key] = remove_empty_string_fields(child)
        return cleaned

    if isinstance(value, list):
        return [remove_empty_string_fields(item) for item in value]

    return value


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Load IDs to process
    object_ids: List[int] = load_json_list(OBJECT_IDS_PATH)

    # Existing data (for resume)
    objects_by_id: Dict[str, Any] = load_json_dict(OBJECTS_PATH)
    rejected_ids: List[int] = load_json_list(REJECT_IDS_PATH)
    api_error_ids: List[int] = load_json_list(API_ERRORS_PATH)

    # Build processed set from kept/rejected/API-error IDs so we don't re-hit the API.
    processed_ids = (
        set(int(k) for k in objects_by_id.keys()) | set(rejected_ids) | set(api_error_ids)
    )

    # Preselect a random batch of unprocessed IDs so each run fetches at most
    # MAX_NEW_IDS_PER_RUN objects total.
    remaining_ids = [object_id for object_id in object_ids if object_id not in processed_ids]
    run_ids = random.sample(remaining_ids, k=min(MAX_NEW_IDS_PER_RUN, len(remaining_ids)))

    print(f"Loaded {len(object_ids)} IDs from {OBJECT_IDS_PATH}")
    print(
        f"Resuming with {len(objects_by_id)} kept, "
        f"{len(rejected_ids)} rejected, "
        f"{len(api_error_ids)} with API errors."
    )
    print(
        f"Selected {len(run_ids)} random unprocessed IDs (max {MAX_NEW_IDS_PER_RUN}) for this run."
    )

    start_kept_count = len(objects_by_id)
    start_rejected_count = len(rejected_ids)
    start_api_error_count = len(api_error_ids)

    processed_since_save = 0
    new_ids_this_run = 0

    for object_id in tqdm(run_ids, desc="Fetching object details"):
        try:
            obj = fetch_object(object_id)
        except ForbiddenError as exc:
            # Record this ID as having an API error, then stop the run.
            print(exc)
            api_error_ids.append(object_id)
            new_ids_this_run += 1
            break
        except requests.RequestException as exc:
            # Other API/network errors: record and continue, but do NOT mark as rejected.
            print(f"API error for object {object_id}: {exc}")
            api_error_ids.append(object_id)
            processed_ids.add(object_id)
            new_ids_this_run += 1
            continue

        if apply_filters(obj, object_id, rejected_ids):
            cleaned_obj = remove_empty_string_fields(obj)
            key = str(cleaned_obj.get("objectID", object_id))
            objects_by_id[key] = cleaned_obj
            # apply_filters function will append any rejected object ids to the rejected list

        processed_ids.add(object_id)
        processed_since_save += 1
        new_ids_this_run += 1

        time.sleep(SLEEP_BETWEEN_REQUESTS)

        if processed_since_save >= SAVE_EVERY_N_OBJECTS or new_ids_this_run >= MAX_NEW_IDS_PER_RUN:
            save_json(OBJECTS_PATH, objects_by_id)
            save_json(REJECT_IDS_PATH, rejected_ids)
            save_json(API_ERRORS_PATH, api_error_ids)
            processed_since_save = 0

            if new_ids_this_run >= MAX_NEW_IDS_PER_RUN:
                print(
                    f"Reached limit of {MAX_NEW_IDS_PER_RUN} new IDs for this run. "
                    "You can re-run this script after waiting a few minutes."
                )
                break

    # Final save at the end of the run
    save_json(OBJECTS_PATH, objects_by_id)
    save_json(REJECT_IDS_PATH, rejected_ids)
    save_json(API_ERRORS_PATH, api_error_ids)

    new_kept_count = len(objects_by_id) - start_kept_count
    new_rejected_count = len(rejected_ids) - start_rejected_count
    new_api_error_count = len(api_error_ids) - start_api_error_count

    print(
        f"Done. New this run -"
        f"➕kept: {new_kept_count}, "
        f"rejected: {new_rejected_count}, "
        f"API errors: {new_api_error_count}"
        f"✅Totals: kept {len(objects_by_id)} "
        f"Saved to {OBJECTS_PATH}, {REJECT_IDS_PATH}, and {API_ERRORS_PATH}."
    )


if __name__ == "__main__":
    main()
