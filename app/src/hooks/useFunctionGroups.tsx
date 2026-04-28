import { useMemo } from "react";
import fieldsCsv from "../../../format_data/generated/fields.csv?raw";

export type FunctionGroup =
  | "amphora"
  | "pitcher"
  | "bottle"
  | "jug"
  | "flask"
  | "beaker"
  | "jar"
  | "pot"
  | "vase"
  | "vessel";

export type FunctionGroupRow = {
  group: FunctionGroup;
  objectIds: string[];
  representativeObjectId: string | null;
};

export const GROUPS_IN_PRIORITY_ORDER: FunctionGroup[] = [
  "amphora",
  "pitcher",
  "bottle",
  "jug",
  "flask",
  "beaker",
  "jar",
  "pot",
  "vase",
  "vessel"
];

// Curated representative object IDs for ShelfFunction images.
// Add additional entries here as needed (values should be objectId strings).
const GROUP_REPRESENTATIVE_OVERRIDES: Partial<Record<FunctionGroup, string>> = {
  amphora: "475759",
  pitcher: "204352",
  bottle: "47810",
  jug: "465881",
  flask: "770934",
  // beaker
  jar: "853841",
  pot: "466229", // choose a new one later
  vase: "46425",
  vessel: "39496"
};
const FUNCTION_GROUP_SET = new Set<string>(GROUPS_IN_PRIORITY_ORDER);

export function isFunctionGroup(value: string): value is FunctionGroup {
  return FUNCTION_GROUP_SET.has(value);
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

function buildFunctionGroupRows(csv: string): FunctionGroupRow[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const finalGroupIdx = header.indexOf("final_group");
  if (objectIdIdx < 0 || finalGroupIdx < 0) {
    return GROUPS_IN_PRIORITY_ORDER.map((group) => ({
      group,
      objectIds: [],
      representativeObjectId: GROUP_REPRESENTATIVE_OVERRIDES[group] ?? null
    }));
  }

  const objectIdsByGroup = new Map<FunctionGroup, string[]>();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    const group = cells[finalGroupIdx]?.trim().toLowerCase() as FunctionGroup;
    if (!objectId || !group || !isFunctionGroup(group)) continue;
    const existing = objectIdsByGroup.get(group) ?? [];
    existing.push(objectId);
    objectIdsByGroup.set(group, existing);
  }

  return GROUPS_IN_PRIORITY_ORDER.map((group) => {
    const objectIds = objectIdsByGroup.get(group) ?? [];
    return {
      group,
      objectIds,
      representativeObjectId: GROUP_REPRESENTATIVE_OVERRIDES[group] ?? objectIds[0] ?? null
    };
  });
}

function useFunctionGroups() {
  const groupRows = useMemo(() => buildFunctionGroupRows(fieldsCsv), []);
  const groupRowById = useMemo(
    () => new Map(groupRows.map((row) => [row.group, row])),
    [groupRows]
  );
  return { groupRows, groupRowById };
}

export default useFunctionGroups;
