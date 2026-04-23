# Geography Data Contract for LLM/Agent Best Guess

## Purpose

Standardize location outputs for a first-pass LLM/agent normalization step before geocoding.

The LLM/agent should create best-guess geography fields from existing source signals, while clearly encoding uncertainty.

## Columns to Add in Initial LLM/Agent Pass

- `geo_LLM_best_guess_location_normalized` (string, nullable)
- `geo_LLM_source_cols` (string, required)
- `geo_LLM_confidence` (number 0.0-1.0, required)
- `geo_LLM_geo_eligible` (boolean, required)

## Record Identity

- `objectId` (string or int, required)
  - Source object identifier.
  - Should be unique per row in this dataset.

## Raw Input Trace

- Source signal is `geo_options`.
- Token order inside `geo_options`:
  - `city||state||region||country||culture||artistNationality`

## Field Definitions

### `geo_LLM_best_guess_location_normalized`

- Canonical location string to pass to geocoder.
- Nullable if no usable location can be inferred.
- Examples:
  - `Paris, France`
  - `Andalusia, Spain`
  - `Cairo, Egypt`

### `geo_LLM_source_cols`

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
  - `city||culture`
  - `state||culture`
  - `region||culture`
  - `department||artistNationality`
  - `none`

### `geo_LLM_confidence`

- Deterministic score from 0.0 to 1.0.
- Suggested bands:
  - high: `0.80-1.00`
  - medium: `0.60-0.79`
  - low: `0.01-0.59`
  - none: `0.00`

### `geo_LLM_geo_eligible`

- `true` when safe to send directly to geocoder.
- `false` when ambiguity is high or signal is too weak.
- Recommended default:
  - `true` if `geo_LLM_confidence >= 0.30`
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
  - `German -> Germany`, `Italian -> Italy`, `British -> United Kingdom`
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
  - If nationality remains ambiguous after department context (example: `British, Scottish`), keep low confidence and consider `geo_LLM_geo_eligible=false`.
- If strings contain explicit uncertainty markers (`or`, `possibly`, `probably`, `?`, `vicinity`):
  - choose most plausible canonical guess only if one candidate is clearly better;
  - otherwise set `geo_LLM_geo_eligible = false` and lower confidence.
- If no usable signal exists:
  - `geo_LLM_best_guess_location_normalized = null`
  - `geo_LLM_source_cols = none`
  - `geo_LLM_confidence = 0.0`
  - `geo_LLM_geo_eligible = false`

## Minimal CSV Handoff Schema

Required:

- `objectId`
- `geo_options`
- `geo_LLM_best_guess_location_normalized`
- `geo_LLM_source_cols`
- `geo_LLM_confidence`
- `geo_LLM_geo_eligible`

## Examples

- `"44793,Asian Art,50,||||||||China||"` -> `China`, source=`country`, confidence=`1.0`, eligible=`true`
- `"46021,Asian Art,1849,||||||||China or Japan (?)||"` -> "China" confidence=0.25, eligble=true
- `"450494,Islamic Art,849,||||||Iraq or Syria||||"` -> `Iraq`, source=`country`, confidence=`0.25`, eligible usually=`true`
- `"201753,European Sculpture and Decorative Arts,1548,||||||||||German"` -> `Germany`, source=`artistNationality`, confidence=`0.5`
- `"670810,European Sculpture and Decorative Arts,1880,||||||||||British, Scottish"` -> `United Kingdom`, source=`artistNationality`, confidence=`0.5`
- `"460135,Robert Lehman Collection,1480,||||||||Italian, possibly Florence or Faenza||"` -> `Florence, Italy`, source=`city||culture`, confidence=`0.60-0.75`
- `"452853,Islamic Art,1149,||||||probably Egypt||||"` -> `Egypt`, source=`country`, confidence=`0.60-0.75`
- `"460139,Robert Lehman Collection,1500,||||||||Italian, probably Florence or vicinity||"` -> `Florence, Italy`, source=`city||culture`, confidence=`0.65-0.80`
