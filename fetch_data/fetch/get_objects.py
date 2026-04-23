# RUN THIS FILE FROM ROOT DIRECTORY
# python -m fetch_data.fetch.get_objects
# python -m fetch_data.fetch.get_objects --additional-department 10


# loop through object_ids and save relevant info for each object
# function to verify if want to include object based on certain properties. if keep, then save to objects.json, otherwise save object id to reject-object-ids.json and don't save additional info to objects.json for that object

import argparse
import json
import random
import time
from pathlib import Path
from typing import Any, Dict, List

import requests
from tqdm import tqdm

from .filter_objects import apply_filters  # centralised filtering logic


class ForbiddenError(Exception):
    """Raised when the Met API returns HTTP 403 for an object."""


# Paths
ROOT = Path(__file__).resolve().parents[2]  # .../okasmin-parsons-thesis-2026
DATA_DIR = ROOT / "fetch_data" / "data"
OBJECT_IDS_PATH = DATA_DIR / "object_ids.json"
OBJECTS_PATH = DATA_DIR / "objects.json"
REJECT_IDS_PATH = DATA_DIR / "reject_object_ids.json"
API_ERRORS_PATH = DATA_DIR / "api_errors_object_ids.json"
ADDITIONAL_DEPT_IDS_DIR = DATA_DIR / "additional_department_ids"

# Throttling / batching
REQUEST_TIMEOUT = 30
SLEEP_BETWEEN_REQUESTS = 0.05  # seconds; bump up if you hit rate limits
SAVE_EVERY_N_OBJECTS = 50  # how often to flush to disk
MAX_NEW_IDS_PER_RUN = 80  # hard cap per run to avoid over-fetching


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


def dedupe_ids_preserve_order(ids: List[int]) -> List[int]:
    seen: set[int] = set()
    unique_ids: List[int] = []
    for object_id in ids:
        if object_id in seen:
            continue
        seen.add(object_id)
        unique_ids.append(object_id)
    return unique_ids


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


def additional_department_ids_path(department_id: int) -> Path:
    """Resolve the JSON file produced by get_additional_department_ids for this department."""
    # Glob "{id}_*_object_ids.json" also matches *_fetched_object_ids.json (e.g. * = "egyptian_art_fetched").
    raw = ADDITIONAL_DEPT_IDS_DIR.glob(f"{department_id}_*_object_ids.json")
    matches = sorted(p for p in raw if not p.name.endswith("_fetched_object_ids.json"))
    if not matches:
        raise FileNotFoundError(
            f"No additional ID file for departmentId={department_id} under {ADDITIONAL_DEPT_IDS_DIR}. "
            "Run: python -m fetch_data.fetch.get_additional_department_ids"
        )
    if len(matches) > 1:
        raise ValueError(
            f"Ambiguous additional ID files for departmentId={department_id}: {[m.name for m in matches]}"
        )
    return matches[0]


def additional_department_fetched_path(ids_path: Path) -> Path:
    """
    Path for the per-department fetched-ID ledger (sibling of *_object_ids.json).

    Example: ``10_egyptian_art_object_ids.json`` -> ``10_egyptian_art_fetched_object_ids.json``.
    """
    stem = ids_path.stem
    if stem.endswith("_object_ids"):
        base = stem[: -len("_object_ids")]
    else:
        base = stem
    return ids_path.with_name(f"{base}_fetched_object_ids.json")


def _department_fetch_postfix(fetched_ids: set[int], object_id_set: set[int], total: int) -> str:
    """Ledger = objectIDs for which the Met object-detail API was invoked in --additional-department mode."""
    done = len(fetched_ids & object_id_set)
    return f"{done}/{total} in dept ledger"


def run_fetch_batch(
    object_ids: List[int],
    *,
    require_ceramics_classification: bool,
    progress_desc: str,
    ids_source_description: str,
    department_fetched_path: Path | None = None,
) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not object_ids:
        print(f"No object IDs to process ({ids_source_description}).")
        return

    # Existing data (for resume)
    objects_by_id: Dict[str, Any] = load_json_dict(OBJECTS_PATH)
    rejected_ids: List[int] = dedupe_ids_preserve_order(load_json_list(REJECT_IDS_PATH))
    api_error_ids: List[int] = dedupe_ids_preserve_order(load_json_list(API_ERRORS_PATH))
    rejected_id_set = set(rejected_ids)
    api_error_id_set = set(api_error_ids)

    # Build processed set from kept/rejected/API-error IDs so we don't re-hit the API.
    processed_ids = (
        set(int(k) for k in objects_by_id.keys()) | set(rejected_ids) | set(api_error_ids)
    )

    object_id_set = set(object_ids)
    total_in_department_list = len(object_id_set)
    department_progress_enabled = department_fetched_path is not None
    dept_fetched_ids: set[int] = set()
    if department_progress_enabled:
        assert department_fetched_path is not None
        dept_fetched_ids.update(int(x) for x in load_json_list(department_fetched_path))
        if len(dept_fetched_ids) > MAX_NEW_IDS_PER_RUN * 3:
            print(
                "If the department ledger looks larger than your --additional-department run count, it may have "
                "been inflated by an older version of this script. Delete this department's *_fetched_object_ids.json "
                "file to reset the ledger."
            )
        already_global = object_id_set & processed_ids
        if already_global:
            print(
                f"Note: {len(already_global)}/{total_in_department_list} department list IDs are already in the "
                f"global pipeline (objects / rejects / API errors) and are skipped without an API call. "
                f"The *_fetched_object_ids.json ledger counts only IDs handled in --additional-department runs."
            )

    # Preselect a random batch of unprocessed IDs so each run fetches at most
    # MAX_NEW_IDS_PER_RUN objects total.
    remaining_ids = [object_id for object_id in object_ids if object_id not in processed_ids]
    run_ids = random.sample(remaining_ids, k=min(MAX_NEW_IDS_PER_RUN, len(remaining_ids)))

    print(f"Loaded {len(object_ids)} IDs from {ids_source_description}")
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

    bar = tqdm(run_ids, desc=progress_desc)
    if department_progress_enabled:
        bar.set_postfix_str(_department_fetch_postfix(dept_fetched_ids, object_id_set, total_in_department_list))

    for object_id in bar:
        try:
            obj = fetch_object(object_id)
        except ForbiddenError as exc:
            # 403: stop this run without recording API error or counting as fetched.
            print(exc)
            break
        except requests.RequestException as exc:
            # Other API/network errors: record and continue, but do NOT mark as rejected.
            print(f"API error for object {object_id}: {exc}")
            if object_id not in api_error_id_set:
                api_error_ids.append(object_id)
                api_error_id_set.add(object_id)
            processed_ids.add(object_id)
            if department_progress_enabled:
                dept_fetched_ids.add(object_id)
                bar.set_postfix_str(
                    _department_fetch_postfix(dept_fetched_ids, object_id_set, total_in_department_list)
                )
                assert department_fetched_path is not None
                save_json(department_fetched_path, sorted(dept_fetched_ids))
            new_ids_this_run += 1
            continue

        # Met object-detail API returned (HTTP 200 + JSON). Record as soon as the call succeeds so the
        # ledger matches "API was invoked", even if filter/save logic below raises.
        if department_progress_enabled:
            dept_fetched_ids.add(object_id)
            bar.set_postfix_str(
                _department_fetch_postfix(dept_fetched_ids, object_id_set, total_in_department_list)
            )

        if apply_filters(
            obj,
            object_id,
            rejected_ids,
            require_ceramics_classification=require_ceramics_classification,
        ):
            cleaned_obj = remove_empty_string_fields(obj)
            key = str(cleaned_obj.get("objectID", object_id))
            objects_by_id[key] = cleaned_obj
            # apply_filters function will append any rejected object ids to the rejected list
        elif object_id not in rejected_id_set:
            rejected_id_set.add(object_id)

        processed_ids.add(object_id)
        processed_since_save += 1
        new_ids_this_run += 1

        time.sleep(SLEEP_BETWEEN_REQUESTS)

        if processed_since_save >= SAVE_EVERY_N_OBJECTS or new_ids_this_run >= MAX_NEW_IDS_PER_RUN:
            rejected_ids = dedupe_ids_preserve_order(rejected_ids)
            api_error_ids = dedupe_ids_preserve_order(api_error_ids)
            save_json(OBJECTS_PATH, objects_by_id)
            save_json(REJECT_IDS_PATH, rejected_ids)
            save_json(API_ERRORS_PATH, api_error_ids)
            if department_progress_enabled:
                assert department_fetched_path is not None
                save_json(department_fetched_path, sorted(dept_fetched_ids))
            processed_since_save = 0

            if new_ids_this_run >= MAX_NEW_IDS_PER_RUN:
                print(
                    f"Reached limit of {MAX_NEW_IDS_PER_RUN} new IDs for this run. "
                    "You can re-run this script after waiting a few minutes."
                )
                break

    # Final save at the end of the run
    rejected_ids = dedupe_ids_preserve_order(rejected_ids)
    api_error_ids = dedupe_ids_preserve_order(api_error_ids)
    save_json(OBJECTS_PATH, objects_by_id)
    save_json(REJECT_IDS_PATH, rejected_ids)
    save_json(API_ERRORS_PATH, api_error_ids)
    if department_progress_enabled:
        assert department_fetched_path is not None
        save_json(department_fetched_path, sorted(dept_fetched_ids))

    new_kept_count = len(objects_by_id) - start_kept_count
    new_rejected_count = len(rejected_ids) - start_rejected_count
    new_api_error_count = len(api_error_ids) - start_api_error_count

    done_msg = (
        f"Saved to {OBJECTS_PATH}, {REJECT_IDS_PATH}, and {API_ERRORS_PATH}."
    )
    if department_progress_enabled and department_fetched_path is not None:
        done = len(dept_fetched_ids & object_id_set)
        done_msg = (
            f"Department ledger (--additional-department only): {done}/{total_in_department_list} "
            f"({department_fetched_path.name}). "
            + done_msg
        )

    print(
        f"Done. New this run -"
        f"➕kept: {new_kept_count}, "
        f"rejected: {new_rejected_count}, "
        f"API errors: {new_api_error_count}"
        f"✅Totals: kept {len(objects_by_id)} "
        f"{done_msg}"
    )


def main() -> None:
    object_ids: List[int] = load_json_list(OBJECT_IDS_PATH)
    run_fetch_batch(
        object_ids,
        require_ceramics_classification=True,
        progress_desc="Fetching object details",
        ids_source_description=str(OBJECT_IDS_PATH),
    )


def get_additional_department_objects(department_id: int) -> None:
    """
    Fetch object details for IDs listed under additional_department_ids for one department.

    Same outputs and batching as main(), but reads IDs from
    ``additional_department_ids/{departmentId}_*_object_ids.json`` and skips the
    Ceramics classification requirement in apply_filters.

    Writes ``*_fetched_object_ids.json`` beside the ID list: one entry per objectID
    once the Met object-detail API is invoked for it in this mode (200, 403, or a
    ``requests`` error from that call). IDs skipped as already in the global pipeline
    are not listed.
    """
    ids_path = additional_department_ids_path(department_id)
    fetched_path = additional_department_fetched_path(ids_path)
    object_ids: List[int] = load_json_list(ids_path)
    run_fetch_batch(
        object_ids,
        require_ceramics_classification=False,
        progress_desc=f"Fetching dept {department_id} object details",
        ids_source_description=str(ids_path),
        department_fetched_path=fetched_path,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Fetch Met object records into fetch_data/data/objects.json (and related files)."
    )
    parser.add_argument(
        "--additional-department",
        type=int,
        metavar="DEPARTMENT_ID",
        help=(
            "Use IDs from fetch_data/data/additional_department_ids/{DEPARTMENT_ID}_*_object_ids.json "
            "and skip the Ceramics classification filter."
        ),
    )
    args = parser.parse_args()
    if args.additional_department is not None:
        get_additional_department_objects(args.additional_department)
    else:
        main()
