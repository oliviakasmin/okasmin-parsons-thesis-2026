# Fetch Data

Python pipeline for building the object dataset from the Met API.

## Current structure

- `fetch_data/fetch/get_object_ids.py`
  - Builds `fetch_data/data/object_ids.json` from Met search queries.
- `fetch_data/fetch/get_objects.py`
  - Fetches object details, applies filters, and writes:
    - `fetch_data/data/objects.json`
    - `fetch_data/data/reject_object_ids.json`
    - `fetch_data/data/api_errors_object_ids.json`
- `fetch_data/clean/clean_object_ids.py`
  - Removes rejected IDs from `fetch_data/data/object_ids.json`.
- `fetch_data/clean/clean_objects.py`
  - Runs post-fetch cleaning steps on `fetch_data/data/objects.json`.

See `fetch_data/data/README.md` for data file definitions and filter rules.

## Environment setup

From the repo root:

```bash
cd /Users/oliviakasmin/Desktop/okasmin-parsons-thesis-2026
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r fetch_data/requirements.txt
```

To activate again later:

```bash
cd /Users/oliviakasmin/Desktop/okasmin-parsons-thesis-2026
source .venv/bin/activate
```

## Run commands

Run all scripts from the repo root using module mode:

Fetch and save deduplicated Met object IDs:
```bash
python -m fetch_data.fetch.get_object_ids
```

Fetch details for up to 100 random unprocessed IDs and update output files:
```bash
python -m fetch_data.fetch.get_objects
```

Remove rejected IDs from `fetch_data/data/object_ids.json`:
```bash
python -m fetch_data.clean.clean_object_ids
```

Clean stored object records (for example, remove empty-string fields):
```bash
python -m fetch_data.clean.clean_objects
```

Print how many objects are currently saved in `fetch_data/data/objects.json`:
```bash
python -m fetch_data.utils
```

You can also run the object count utility from the repo root with:

```bash
npm run count:objects
```

## Recommended workflow

1. Run `get_object_ids` to generate/update raw IDs.
2. Run `get_objects` in batches (it limits each run and stops on 403).
3. Run `clean_object_ids` to remove rejected IDs from the raw ID list.
4. Run `clean_objects` after rule changes or manual review passes.
