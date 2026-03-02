# Pipeline Data Files

This folder stores intermediate and cleaned JSON outputs for the fetch/clean pipeline.

## Files

- `object_ids.json`
  - JSON array of raw object IDs returned by Met search queries.

- `objects.json`
  - JSON object keyed by `objectID`:
    - `{ "<objectID>": { ...full object data... }, ... }`
  - Includes objects that pass filtering rules.
  - Empty-string fields (`""`) are removed before saving.

- `reject_object_ids.json`
  - JSON array of object IDs rejected by content filters.

- `api_errors_object_ids.json`
  - JSON array of object IDs that failed due to API/network errors (kept separate from content-based rejects).

## Current Filter Rules (content-based rejects)

An object ID is added to `reject_object_ids.json` when any of the following are true:

- `isPublicDomain` is not `true`
- `primaryImageSmall` is missing or empty
- `classification` does not include `"Ceramics"`
- `objectName` or `title` includes plural search terms (derived from `QUERIES` in `get_object_ids.py`, e.g. `"vases"`, `"vessels"`, `"pots"`, `"jugs"`)
- `objectName` or `title` includes one of:
  - `"shard"`, `"plate"`, `"bowl"`, `"cup"`, `"set of"`
