import { useMemo } from "react";
import newColorGroupsJson from "../../../format_data/color/new/new_color_groups.json";
import manualRepresentativeColorsJson from "../../../format_data/color/new/manual_representative_colors.json";

export type ColorGroupKey =
  | "hue_blue"
  | "hue_green"
  | "blue_and_white"
  | "yellow_and_ochre"
  | "red_and_pink"
  | "multicolor_glaze"
  | "white"
  | "red_orange_warm_stoneware"
  | "light_warm_browns"
  | "cooler_light_tans_browns"
  | "coolest_browns"
  | "dark_and_black";

export type ColorGroupRow = {
  groupId: number;
  groupKey: ColorGroupKey;
  label: string;
  objectIds: string[];
  representativeObjectId: string | null;
};

export const COLOR_GROUPS_IN_RAINBOW_ORDER: ColorGroupKey[] = [
  "hue_blue",
  "hue_green",
  "blue_and_white",
  "yellow_and_ochre",
  "red_and_pink",
  "multicolor_glaze",
  "white",
  "red_orange_warm_stoneware",
  "light_warm_browns",
  "cooler_light_tans_browns",
  "coolest_browns",
  "dark_and_black"
];

const COLOR_GROUP_SET = new Set<string>(COLOR_GROUPS_IN_RAINBOW_ORDER);

const COLOR_GROUP_LABELS: Record<ColorGroupKey, string> = {
  hue_blue: "blue",
  hue_green: "green",
  blue_and_white: "blue and white",
  yellow_and_ochre: "yellow",
  red_and_pink: "red",
  multicolor_glaze: "multicolor",
  white: "white",
  red_orange_warm_stoneware: "terracotta",
  light_warm_browns: "light warm brown",
  cooler_light_tans_browns: "cooler tan",
  coolest_browns: "muddier brown",
  dark_and_black: "dark"
};

export function isColorGroupKey(value: string): value is ColorGroupKey {
  return COLOR_GROUP_SET.has(value);
}

function normalizeObjectIds(rawIds: unknown): string[] {
  if (!Array.isArray(rawIds)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const rawId of rawIds) {
    let objectId = "";
    if (typeof rawId === "number" && Number.isFinite(rawId)) {
      objectId = String(Math.trunc(rawId));
    } else if (typeof rawId === "string" && rawId.trim()) {
      objectId = rawId.trim();
    }
    if (!objectId || seen.has(objectId)) continue;
    seen.add(objectId);
    ids.push(objectId);
  }
  return ids;
}

function buildColorGroupRows(): ColorGroupRow[] {
  const colorGroups = newColorGroupsJson as Record<string, unknown>;
  const representativeGroups = manualRepresentativeColorsJson as Record<string, unknown>;

  return COLOR_GROUPS_IN_RAINBOW_ORDER.map((groupKey, index) => {
    const objectIds = normalizeObjectIds(colorGroups[groupKey]);
    const representativeObjectIds = normalizeObjectIds(representativeGroups[groupKey]);
    const representativeObjectId =
      representativeObjectIds.find((objectId) => objectIds.includes(objectId)) ??
      objectIds[0] ??
      null;

    return {
      groupId: index,
      groupKey,
      label: COLOR_GROUP_LABELS[groupKey],
      objectIds,
      representativeObjectId
    };
  });
}

function useColorGroups() {
  const groupRows = useMemo(() => buildColorGroupRows(), []);
  const groupRowByKey = useMemo(
    () => new Map(groupRows.map((row) => [row.groupKey, row])),
    [groupRows]
  );
  return { groupRows, groupRowByKey };
}

export default useColorGroups;
