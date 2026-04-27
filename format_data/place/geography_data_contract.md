# Geography Data Contract for LLM/Agent Best Guess

## Purpose

Standardize location outputs for a first-pass LLM/agent normalization step before geocoding.

The LLM/agent should create best-guess geography fields from existing source signals, while clearly encoding uncertainty.

The new `geo_normalized_best_guess_location` (see below) will then be passed to Mapbox Geocoding API

## Columns to Add in Initial LLM/Agent Pass

- `geo_normalized_best_guess_location` (string, nullable)
- `geo_normalized_source_cols` (string, required)
- `geo_normalized_confidence` (number 0.0-1.0, required)
- `geo_normalized_geo_eligible` (boolean, required)

## Record Identity

- `objectId` (string or int, required)
  - Source object identifier.
  - Should be unique per row in this dataset.

## Raw Input Trace

- Source signal is `geo_options`.
- Token order inside `geo_options`:
  - `city||state||region||country||culture||artistNationality`

## Field Definitions

### `geo_normalized_best_guess_location`

- Canonical location string to pass to geocoder.
- Nullable if no usable location can be inferred.
- Prefer modern, geocoder-friendly place labels over raw cultural strings.
- Examples:
  - `Paris, France`
  - `Andalusia, Spain`
  - `Cairo, Egypt`

### `geo_normalized_source_cols`

- Provenance of source(s) used for the final guess.
- Example values:
  - `city`
  - `city||state`
  - `city||country`
  - `city||state||country`
  - `state`
  - `state||country`
  - `region||culture`
  - `region||country`
  - `country`
  - `culture`
  - `culture||country`
  - `city||culture`
  - `state||culture`
  - `region||culture`
  - `department||artistNationality`
  - `none`

### `geo_normalized_confidence`

- Deterministic score from 0.0 to 1.0.
- Suggested bands:
  - high: `0.80-1.00`
  - medium: `0.60-0.79`
  - low: `0.01-0.59`
  - none: `0.00`

### `geo_normalized_geo_eligible`

- `true` when safe to send directly to geocoder.
- `false` when ambiguity is high or signal is too weak.
- Recommended default:
  - `true` if `geo_normalized_confidence >= 0.30`
  - `false` otherwise

## Rule Semantics

- Normalize null/blank/`undefined` to missing.
- Precedence order:
  - `city > state > region > country > culture > artistNationality`
- Prefer hierarchical combinations:
  - `city + state/country`, then `state/region + country`, then `country`.
- `culture` may provide higher-level context when `country` is missing, but confidence should be penalized versus country-backed context.
- `artistNationality` is last resort only.
- Demonym normalization is allowed when unambiguous:
  - `German -> Germany`, `Italian -> Italy`, `French -> France`, `Swiss -> Switzerland`
  - `British -> United Kingdom` (or project-standard synonym such as `Britain` if needed for consistency)
- Culture normalization is allowed when it yields a clearer canonical place:
  - `French (Paris) -> Paris, France`
  - `Thai culture terms with known production centers -> Si Satchanalai, Thailand`
  - `Cypriot -> Cyprus`, `Cycladic -> Cyclades, Greece`, `Attic -> Attica, Greece`
  - `Apulian -> Apulia, Italy`, `Campanian -> Campania, Italy`, `Canosan -> Canosa di Puglia, Italy`
  - `Etruscan / Etrusco-Corinthian / Italo-Corinthian -> Etruria, Italy`
- Remove uncertainty markers and parenthetical noise from final normalized output:
  - strip `?`, `(?)`, and vague qualifiers like `possibly`, `probably`, `or vicinity`
  - do not emit punctuation artifacts such as `( )` in normalized location values
- Department context may be used only as a weak tie-breaker when candidates are close, and confidence must be reduced.
- Department nuance for `artistNationality` signals:
  - Treat department as contextual evidence, not a hard constraint.
  - Only apply when `artistNationality` is the primary usable signal (or when resolving ties).
  - Use provenance `department||artistNationality` whenever department context changed the decision.
  - Confidence adjustments:
    - `+0.05 to +0.10` when department and nationality are strongly coherent (example: European department + `Italian`).
    - `0` when department adds no new disambiguation.
    - `-0.10 to -0.20` when department conflicts with the nationality-derived candidate.
  - Never let department override a stronger geographic field (`city`, `state`, `region`, `country`).
  - If nationality remains ambiguous after department context (example: `British, Scottish`), keep low confidence and consider `geo_normalized_geo_eligible=false`.
- If strings contain explicit uncertainty markers (`or`, `possibly`, `probably`, `?`, `vicinity`):
  - choose most plausible canonical guess only if one candidate is clearly better;
  - otherwise set `geo_normalized_geo_eligible = false` and lower confidence.
- If no clearly mappable canonical location can be produced from culture/nationality context, return null output rather than preserving an unresolved adjective label.
- Department-specific guardrail:
  - If `department = Greek and Roman Art` and `culture = Roman`, set:
    - `geo_normalized_best_guess_location = null`
    - `geo_normalized_source_cols = none`
    - `geo_normalized_confidence = 0.0`
    - `geo_normalized_geo_eligible = false`
- If no usable signal exists:
  - `geo_normalized_best_guess_location = null`
  - `geo_normalized_source_cols = none`
  - `geo_normalized_confidence = 0.0`
  - `geo_normalized_geo_eligible = false`

## Minimal CSV Handoff Schema

Required:

- `objectId`
- `geo_options`
- `geo_normalized_best_guess_location`
- `geo_normalized_source_cols`
- `geo_normalized_confidence`
- `geo_normalized_geo_eligible`

## Examples

- `"44793,Asian Art,50,||||||||China||"` -> `China`, source=`country`, confidence=`1.0`, eligible=`true`
- `"46021,Asian Art,1849,||||||||China or Japan (?)||"` -> `China`, source=`culture`, confidence=`0.25`, eligible=`true`
- `"450494,Islamic Art,849,||||||Iraq or Syria||||"` -> `Iraq`, source=`country`, confidence=`0.25`, eligible usually=`true`
- `"201753,European Sculpture and Decorative Arts,1548,||||||||||German"` -> `Germany`, source=`artistNationality`, confidence=`0.5`
- `"670810,European Sculpture and Decorative Arts,1880,||||||||||British, Scottish"` -> `Scotland` (or fallback `United Kingdom`), source=`artistNationality`, confidence=`~0.5`
- `"460135,Robert Lehman Collection,1480,||||||||Italian, possibly Florence or Faenza||"` -> `Florence, Italy`, source=`city||culture`, confidence=`0.60-0.75`
- `"452853,Islamic Art,1149,||||||probably Egypt||||"` -> `Egypt`, source=`country`, confidence=`0.60-0.75`
- `"460139,Robert Lehman Collection,1500,||||||||Italian, probably Florence or vicinity||"` -> `Florence, Italy`, source=`city||culture`, confidence=`0.65-0.80`
- `",European Sculpture and Decorative Arts,1548,||||||||||French"` -> `France`
- `",European Sculpture and Decorative Arts,1548,||||||||||Scottish"` -> `Scotland`
- `",European Sculpture and Decorative Arts,1548,||||||||||British"` -> `Britain` (or `United Kingdom` by project convention)
- `",European Sculpture and Decorative Arts,1548,||||||||||Italian"` -> `Italy`
- `"487350,Modern and Contemporary Art,1884,||||||||French (Paris)||French"` -> `Paris, France`
- `"310369,The Michael C. Rockefeller Wing,1650,Fomena (?)||||Adanse traditional area||Ghana||Akan||"` -> `Fomena, Ghana`

## Runtime Mapping Layers (Refactor-Aligned)

The implementation uses a single active mapping source per signal type:

- `DEMONYM_MAP`
  - Normalizes nationality/demonym values to canonical place labels.
  - Includes both single-token and known multi-token variants where needed (for example `British, Scottish -> Scotland`).

- `CULTURE_MAP`
  - Normalizes curated culture values to canonical geocoder-friendly outputs.
  - Includes Greek-world, Etruscan/Italic, Aegean, Near Eastern, and broader culture terms used in this dataset.

- `LOCATION_CLEANUP_MAP`
  - Normalizes free-form and uncertain raw location strings (for example `Italian, probably Florence or vicinity -> Florence, Italy`).
  - Applied during candidate extraction so cleanup happens before final source precedence resolution.

### Mapping Key Rules

- Mapping keys are treated case-insensitively at runtime.
- Canonical output values should remain geocoder-friendly and stable.
- Avoid duplicate source-of-truth dictionaries for the same concept.
- New mappings should be added to one of the active runtime layers above, not to deprecated appendix dictionaries.

### Representative Runtime Mapping Examples

- Nationality/demonym:
  - `Scottish -> Scotland`
  - `British, Scottish -> Scotland`
  - `South Netherlandish -> Belgium`

- Culture:
  - `Greek, Attic -> Attica, Greece`
  - `Greek, South Italian, Campanian -> Campania, Italy`
  - `Etrusco-Corinthian -> Etruria, Italy`
  - `Minoan -> Crete, Greece`

- Raw cleanup:
  - `Iraq or Syria -> Iraq`
  - `Italian, probably Florence or vicinity -> Florence, Italy`
  - `Thailand (Ban Chiang culture) -> Ban Chiang, Thailand`

## Backend Geocoding Runbook

Run order:

1. `python -m format_data.get_fields`
2. `python -m format_data.place.geocode_locations`

Required secret:

- `MAPBOX_TOKEN` in environment (for local runs and Netlify builds)

Generated artifacts:

- `format_data/generated/geocode/fields_geocoded.csv` (row-level enriched output)
- `format_data/generated/geocode/fields_geocoded.json` (same row-level output in JSON)
- `format_data/generated/geocode/geocode_cache.csv` (query-level cache for reuse)
- `format_data/generated/geocode/geocode_cache.json` (query-level cache in JSON)

Geocoding output columns appended per row:

- `geo_mapbox_place_name`
- `geo_mapbox_lon`
- `geo_mapbox_lat`
- `geo_mapbox_relevance`
- `geo_mapbox_accuracy`
- `geo_mapbox_feature_id`
- `geo_mapbox_match_status` (`matched`, `no_match`, `error`, `skipped`)
- `geo_mapbox_updated_at`

Caching behavior:

- Cache key is exact `geo_normalized_best_guess_location` string.
- Re-runs only call Mapbox for unseen normalized values.
- Existing cached values are reused to minimize API costs and keep output stable.
