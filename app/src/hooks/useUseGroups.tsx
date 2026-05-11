import { useMemo } from "react";
import fieldsCsv from "../../../format_data/generated/fields.csv?raw";

/** Values produced by ``format_data/use_groups/get_use.py`` → ``fields.csv`` column ``use``. */
export type UseGroup =
  | "animal_shaped"
  | "ritual"
  | "pouring"
  | "flask_and_bottle"
  | "storage"
  | "vase"
  | "other";

export type UseGroupRow = {
  group: UseGroup;
  objectIds: string[];
  representativeObjectId: string | null;
};

/** Stable ordering for stats / iteration (not necessarily shelf layout). */
export const USE_GROUPS_IN_DISPLAY_ORDER: UseGroup[] = [
  "animal_shaped",
  "ritual",
  "pouring",
  "flask_and_bottle",
  "storage",
  "vase",
  "other"
];

export const USE_GROUP_LABEL: Record<UseGroup, string> = {
  animal_shaped: "animal-shaped",
  ritual: "ritual",
  pouring: "pouring",
  flask_and_bottle: "flask & bottle",
  storage: "storage",
  vase: "vase",
  other: "other"
};

// Optional hero images per use bucket (objectId strings).
const USE_GROUP_REPRESENTATIVE_OVERRIDES: Partial<Record<UseGroup, string>> = {
  pouring: "204352",
  flask_and_bottle: "47810",
  storage: "853841",
  vase: "46425",
  ritual: "308556",
  animal_shaped: "39496",
  other: "44862"
};

const USE_GROUP_SET = new Set<string>(USE_GROUPS_IN_DISPLAY_ORDER);

export function isUseGroup(value: string): value is UseGroup {
  return USE_GROUP_SET.has(value);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function buildUseGroupRows(csv: string): UseGroupRow[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const useIdx = header.indexOf("use");
  if (objectIdIdx < 0 || useIdx < 0) {
    return USE_GROUPS_IN_DISPLAY_ORDER.map((group) => ({
      group,
      objectIds: [],
      representativeObjectId: USE_GROUP_REPRESENTATIVE_OVERRIDES[group] ?? null
    }));
  }

  const objectIdsByGroup = new Map<UseGroup, string[]>();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    const group = cells[useIdx]?.trim().toLowerCase() as UseGroup;
    if (!objectId || !group || !isUseGroup(group)) continue;
    const existing = objectIdsByGroup.get(group) ?? [];
    existing.push(objectId);
    objectIdsByGroup.set(group, existing);
  }

  return USE_GROUPS_IN_DISPLAY_ORDER.map((group) => {
    const objectIds = objectIdsByGroup.get(group) ?? [];
    return {
      group,
      objectIds,
      representativeObjectId: USE_GROUP_REPRESENTATIVE_OVERRIDES[group] ?? objectIds[0] ?? null
    };
  });
}

function useUseGroups() {
  const groupRows = useMemo(() => buildUseGroupRows(fieldsCsv), []);
  const groupRowById = useMemo(
    () => new Map(groupRows.map((row) => [row.group, row])),
    [groupRows]
  );
  return { groupRows, groupRowById };
}

export default useUseGroups;
