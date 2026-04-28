# Run from the repo root:
#   python -m fetch_data.fetch.get_additional_department_ids

import json
from pathlib import Path

import requests
from tqdm import tqdm

# One Met search per department below (same medium + search term for each).
DEPARTMENTS = [
    {"departmentId": 10, "displayName": "Egyptian Art"}, #fetched all, including pottery
    {"departmentId": 13, "displayName": "Greek and Roman Art"},
    {"departmentId": 21, "displayName": "Modern Art"}, #fetched all
    {"departmentId": 1, "displayName": "American Decorative Arts"},  #fetched all
    {"departmentId": 6, "displayName": "Asian Art"},
    {"departmentId": 3, "displayName": "Ancient Near Eastern Art"}, #fetched all, including pottery
    {
        "departmentId": 5,
        "displayName": "Arts of Africa, Oceania, and the Americas", #fetched all, including pottery
    },
      {
      "departmentId": 14,
      "displayName": "Islamic Art" #fetched all, including pottery
    },
]

# must be this medium
# MEDIUM = "Clay"
MEDIUM = "Pottery"

# must be this search term
SEARCH_TERM = "vessel"

BASE_URL = "https://collectionapi.metmuseum.org/public/collection/v1/search"

# where to save per-department ID files
ROOT = Path(__file__).resolve().parents[2]  # repo root: .../okasmin-parsons-thesis-2026
DATA_DIR = ROOT / "fetch_data" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OBJECTS_PATH = DATA_DIR / "objects.json"
OUTPUT_DIR = DATA_DIR / "additional_department_ids"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_existing_object_ids(path: Path) -> set[int]:
    """IDs already present as top-level keys in objects.json (string keys -> int)."""
    if not path.exists() or path.stat().st_size == 0:
        return set()
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return set()
    return {int(k) for k in data}


def build_output_path(department: dict[str, int | str]) -> Path:
    """Create a stable file name for a department's ID list."""
    slug = str(department["displayName"]).lower().replace(" and ", "_").replace(" ", "_")
    return OUTPUT_DIR / f'{department["departmentId"]}_pottery_{slug}_object_ids.json'


def fetch_ids_for_department(department: dict[str, int | str]) -> list[int]:
    """Fetch object IDs from the Met API for one department/term/medium combo."""
    resp = requests.get(
        BASE_URL,
        params={
            "departmentId": department["departmentId"],
            "medium": MEDIUM,
            "hasImages": "true",
            "q": SEARCH_TERM,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("objectIDs") or []


def main() -> None:
    already_kept = load_existing_object_ids(OBJECTS_PATH)
    print(f"Loaded {len(already_kept)} object IDs from {OBJECTS_PATH} to exclude from output.")

    for department in tqdm(DEPARTMENTS, desc="Fetching additional object IDs"):
        ids = fetch_ids_for_department(department)
        unique_ids = set(ids)
        sorted_ids = sorted(unique_ids - already_kept)
        excluded = len(unique_ids) - len(sorted_ids)
        output_path = build_output_path(department)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(sorted_ids, f, indent=2)
        print(
            f'{department["displayName"]}: saved {len(sorted_ids)} IDs to {output_path} '
            f'(departmentId={department["departmentId"]}; '
            f"excluded {excluded} already in objects.json)"
        )


if __name__ == "__main__":
    main()
