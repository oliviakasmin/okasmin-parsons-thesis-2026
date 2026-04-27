# Function Group Mapping

This directory includes the logic that maps each object to a single `final_group` using both `objectName` and `title`.

## Relevant Files

- `function_groups/function_group_mapping.py`
  - Defines canonical group labels (`JAR`, `VASE`, `BOTTLE`, etc.).
  - Defines explicit `group_mappings` from known object types to groups.
  - Defines `ORDER_OF_PRIORITY` used to resolve conflicts.

- `function_groups/get_object_function_group.py`
  - Reads source objects from `fetch_data/data/objects.json`.
  - Resolves candidate groups from both `objectName` and `title`.
  - Applies special handling for `bottle vase` (maps to `vase`).
  - Produces one final decision: `final_group`.
  - Writes output CSV to `format_data/generated/object_function_groups.csv`.

## Final Group Resolution Rules

`final_group` is computed from objectName-derived and title-derived groups:

1. If both are equal and non-empty, use that value.
2. If one is empty and the other is non-empty, use the non-empty value.
3. If both are non-empty and different, choose the higher-priority group from `ORDER_OF_PRIORITY`.
4. If both are empty, output `None`.

## Output

`generated/object_function_groups.csv` columns:

- `objectID`
- `department`
- `objectName`
- `title`
- `final_group`

## Run

From repository root:

```bash
python -m format_data.function_groups.get_object_function_group
```
