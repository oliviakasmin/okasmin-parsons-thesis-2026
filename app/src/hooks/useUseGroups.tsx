import { useMemo } from "react";
import fieldsCsv from "../../../format_data/generated/fields.csv?raw";
import representativeJson from "../../../format_data/use_groups/representative.json";
import useGroupObjectOrderJson from "../../../format_data/use_groups/use_group_object_order.json";

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

const USE_GROUP_SET = new Set<string>(USE_GROUPS_IN_DISPLAY_ORDER);

function normalizeRepresentativeEntry(item: unknown): string | null {
  if (typeof item === "number" && Number.isFinite(item)) return String(Math.trunc(item));
  if (typeof item === "string" && item.trim()) {
    const n = Number(item.trim());
    if (Number.isFinite(n)) return String(Math.trunc(n));
  }
  return null;
}

/** Ordered object IDs from ``representative.json`` for a use group (shelf hero / anchor order). */
export function representativeObjectIdsForGroup(payload: unknown, group: UseGroup): string[] {
  if (payload == null || typeof payload !== "object") return [];
  const raw = (payload as Record<string, unknown>)[group];
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      const id = normalizeRepresentativeEntry(item);
      if (id) out.push(id);
    }
    return out;
  }
  const single = normalizeRepresentativeEntry(raw);
  return single ? [single] : [];
}

function parseFirstRepresentativeObjectId(payload: unknown, group: UseGroup): string | null {
  const ids = representativeObjectIdsForGroup(payload, group);
  return ids[0] ?? null;
}

/** Match ``sort_use_groups_by_silhouette.py`` output: silhouette distance to representative. */
function sortObjectIdsBySilhouetteOrder(
  objectIds: string[],
  group: UseGroup,
  orderByGroup: Record<string, string[]>
): string[] {
  const ordered = orderByGroup[group];
  if (ordered == null || ordered.length === 0) {
    return [...objectIds].sort((a, b) => Number(a) - Number(b));
  }
  const memberSet = new Set(objectIds);
  const rank = new Map<string, number>();
  ordered.forEach((id, index) => {
    if (memberSet.has(id)) rank.set(id, index);
  });
  return [...objectIds].sort((a, b) => {
    const ra = rank.get(a);
    const rb = rank.get(b);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return Number(a) - Number(b);
  });
}

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
  const orderByGroup = useGroupObjectOrderJson as Record<string, string[]>;

  if (objectIdIdx < 0 || useIdx < 0) {
    return USE_GROUPS_IN_DISPLAY_ORDER.map((group) => ({
      group,
      objectIds: [],
      representativeObjectId: parseFirstRepresentativeObjectId(representativeJson, group)
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
    const rawIds = objectIdsByGroup.get(group) ?? [];
    const objectIds = sortObjectIdsBySilhouetteOrder(rawIds, group, orderByGroup);
    return {
      group,
      objectIds,
      representativeObjectId:
        parseFirstRepresentativeObjectId(representativeJson, group) ?? objectIds[0] ?? null
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
