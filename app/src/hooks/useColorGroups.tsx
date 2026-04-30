import { useMemo } from "react";
import fieldsCsv from "../../../format_data/generated/fields.csv?raw";
import colorGroupLabelsCsv from "../../../format_data/generated/color/object_color_group_labels.csv?raw";

export type ColorGroupKey =
  | "multicolor"
  | "yellow"
  | "brown_tan"
  | "orange"
  | "red"
  | "blue"
  | "green"
  | "purple"
  | "gray"
  | "white";

export type ColorGroupRow = {
  groupId: number;
  groupKey: ColorGroupKey;
  label: string;
  objectIds: string[];
  representativeObjectId: string | null;
};

export const COLOR_GROUPS_IN_RAINBOW_ORDER: ColorGroupKey[] = [
  "red",
  "orange",
  "brown_tan",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
  "white",
  "multicolor"
];

const COLOR_GROUP_SET = new Set<string>(COLOR_GROUPS_IN_RAINBOW_ORDER);

// Curated representative object IDs for ShelfColor images.
const COLOR_GROUP_REPRESENTATIVE_OVERRIDES: Partial<Record<ColorGroupKey, string>> = {
  multicolor: "748327",
  yellow: "47370",
  brown_tan: "446842",
  orange: "309388",
  red: "46529",
  blue: "46025",
  green: "46830",
  purple: "48480",
  gray: "47490",
  white: "206328"
};

export function isColorGroupKey(value: string): value is ColorGroupKey {
  return COLOR_GROUP_SET.has(value);
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

function buildColorGroupRows(fieldsRaw: string, labelsRaw: string): ColorGroupRow[] {
  const labelLines = labelsRaw.split(/\r?\n/).filter(Boolean);
  const fieldsLines = fieldsRaw.split(/\r?\n/).filter(Boolean);

  const labelsByKey = new Map<
    ColorGroupKey,
    {
      groupId: number;
      label: string;
    }
  >();
  if (labelLines.length) {
    const labelHeader = parseCsvLine(labelLines[0]);
    const groupIdIdx = labelHeader.indexOf("color_group_id");
    const groupKeyIdx = labelHeader.indexOf("color_group_key");
    const groupLabelIdx = labelHeader.indexOf("color_group_label");
    for (const line of labelLines.slice(1)) {
      const cells = parseCsvLine(line);
      const rawKey = cells[groupKeyIdx]?.trim();
      if (!rawKey || !isColorGroupKey(rawKey)) continue;
      labelsByKey.set(rawKey, {
        groupId: Number(cells[groupIdIdx] ?? 0),
        label: cells[groupLabelIdx]?.trim() || rawKey
      });
    }
  }

  const objectIdsByGroup = new Map<ColorGroupKey, string[]>();
  if (fieldsLines.length) {
    const header = parseCsvLine(fieldsLines[0]);
    const objectIdIdx = header.indexOf("objectId");
    const groupKeyIdx = header.indexOf("color_group_key");
    if (objectIdIdx >= 0 && groupKeyIdx >= 0) {
      for (const line of fieldsLines.slice(1)) {
        const cells = parseCsvLine(line);
        const objectId = cells[objectIdIdx]?.trim();
        const rawKey = cells[groupKeyIdx]?.trim();
        if (!objectId || !rawKey || !isColorGroupKey(rawKey)) continue;
        const existing = objectIdsByGroup.get(rawKey) ?? [];
        existing.push(objectId);
        objectIdsByGroup.set(rawKey, existing);
      }
    }
  }

  return COLOR_GROUPS_IN_RAINBOW_ORDER.map((groupKey) => {
    const labelEntry = labelsByKey.get(groupKey);
    const objectIds = objectIdsByGroup.get(groupKey) ?? [];
    return {
      groupId: labelEntry?.groupId ?? 0,
      groupKey,
      label: labelEntry?.label ?? groupKey,
      objectIds,
      representativeObjectId: COLOR_GROUP_REPRESENTATIVE_OVERRIDES[groupKey] ?? objectIds[0] ?? null
    };
  });
}

function useColorGroups() {
  const groupRows = useMemo(() => buildColorGroupRows(fieldsCsv, colorGroupLabelsCsv), []);
  const groupRowByKey = useMemo(
    () => new Map(groupRows.map((row) => [row.groupKey, row])),
    [groupRows]
  );
  return { groupRows, groupRowByKey };
}

export default useColorGroups;
