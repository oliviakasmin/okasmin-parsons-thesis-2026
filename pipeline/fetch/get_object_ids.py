# Fetch object IDs from the Met API for several ceramic vessel search terms,
# merge and deduplicate them, and write the unique IDs to pipeline/data/object_ids.json.


import json
from pathlib import Path

import requests
from tqdm import tqdm

# Search Met API for object IDs using tighter vessel/object terms.
QUERIES = ["vase", "bottle", "jar", "jug", "ewer", "amphora", "urn", "flask", "pitcher"]

BASE_URL = "https://collectionapi.metmuseum.org/public/collection/v1/search"

# where to save the combined list of IDs
ROOT = Path(__file__).resolve().parents[2]  # repo root: .../okasmin-parsons-thesis-2026
DATA_DIR = ROOT / "pipeline" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OBJECT_IDS_PATH = DATA_DIR / "object_ids.json"


def fetch_ids_for_query(query: str) -> list[int]:
    """Fetch object IDs from the Met API for a single query string."""
    resp = requests.get(
        BASE_URL,
        params={"medium": "Ceramics", "hasImages": "true", "q": query},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    # Met API returns something like:
    # { "total": 123, "objectIDs": [1,2,3,...] }
    return data.get("objectIDs") or []


def main() -> None:
    all_ids: set[int] = set()

    for q in tqdm(QUERIES, desc="Fetching object IDs"):
        ids = fetch_ids_for_query(q)
        all_ids.update(ids)

    # sort for reproducibility
    sorted_ids = sorted(all_ids)

    with OBJECT_IDS_PATH.open("w", encoding="utf-8") as f:
        json.dump(sorted_ids, f, indent=2)

    print(f"Saved {len(sorted_ids)} unique object IDs to {OBJECT_IDS_PATH}")


if __name__ == "__main__":
    main()


# to run this file:
# python pipeline/fetch/get_object_ids.py
