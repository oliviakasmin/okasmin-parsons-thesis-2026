import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import manualRejectObjectIds from "../../../../fetch_data/data/manual_reject_object_ids.json";
import manualColorGroupsJson from "../../../../format_data/color/new/manual_color_groups.json";
import objectsData from "../../../../fetch_data/data/objects.json";
import fieldsCsvRaw from "../../../../format_data/generated/fields.csv?raw";
import excludeManualKmeansClustersCsvRaw from "../../../../format_data/generated/color/object_color_kmeans_clusters_exclude_manual.csv?raw";
import excludeManualClusterUiOrderPayload from "../../../../format_data/generated/color/object_color_kmeans_exclude_manual_cluster_ui_order.json";
import silhouetteFeaturesCsvRaw from "../../../../process_data/features/silhouette_features.csv?raw";
import useColorGroups, { type ColorGroupKey, type ColorGroupRow } from "../../hooks/useColorGroups";
import InlineOutlineSvg from "../Scenes/InlineOutlineSvg";

const S3_IMAGE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

type ImageMode = "mask" | "no_bg" | "outline";

type NeighborHit = { objectId: string; distance: number };
type NeighborIndex = {
  orderedObjectIds: string[];
  vectorByObjectId: Map<string, Float64Array>;
};
type ObjectFieldMeta = {
  date: string;
  location: string;
};
type ObjectColorMeta = {
  colorgramPaletteHex: string[];
  colorgramPaletteShare: number[];
  colorBucketLabels: string[];
  colorBucketPrimary: string;
  /** Palette KMeans cluster id; -1 = not clustered (e.g. BW / empty palette); null = unknown/missing */
  colorKmeansCluster: number | null;
  /** k used when fitting KMeans (same for whole run) */
  colorKmeansK: number | null;
};

const IMAGE_SUFFIX: Record<ImageMode, string> = {
  mask: "mask",
  no_bg: "no_bg",
  outline: "outline"
};
/** Legacy key; removed from persistence — cleared on mount so old sessions do not replay. */
const LEGACY_SELECTED_OBJECT_IDS_STORAGE_KEY = "test2_selected_object_ids";
const NEIGHBOR_COUNT = 10;

/** Thumbnail click opens neighbor modal. Set back to `true` when you want modal UX again. */
const TEST2_OPEN_MODAL_ON_IMAGE_CLICK = false;
const FEATURE_WEIGHTS = {
  lr: 1.0,
  tb: 0.2,
  shape: 1.0,
  inner: 0.8,
  innerCount: 0.5
} as const;

/** Matches `COLOR_BUCKETS` in format_data/color/new/bucket_colors.py */
const COLOR_BUCKET_OPTIONS = [
  "blue and white",
  "terracotta",
  "tan stoneware",
  "white / cream",
  "black / dark",
  "green / celadon",
  "yellow / ochre",
  "red / orange",
  "brown / earth tone",
  "gray / neutral",
  "multicolor",
  "mixed / other"
] as const;

function objectMatchesColorBucketFilter(
  colorMeta: ObjectColorMeta | undefined,
  filter: string | null
): boolean {
  if (filter == null || filter === "") return true;
  const primary = (colorMeta?.colorBucketPrimary ?? "").trim();
  const labels = colorMeta?.colorBucketLabels ?? [];
  return filter === primary || labels.includes(filter);
}

function objectMatchesKMeansClusterFilter(
  colorMeta: ObjectColorMeta | undefined,
  filter: number | null
): boolean {
  if (filter === null) return true;
  const cluster = colorMeta?.colorKmeansCluster;
  return cluster === filter;
}

type ManualColorGroupsFile = Record<string, unknown>;

function buildManualColorGroupIdSets(data: ManualColorGroupsFile): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [name, rawIds] of Object.entries(data)) {
    if (!Array.isArray(rawIds)) continue;
    const set = new Set<string>();
    for (const id of rawIds) {
      if (typeof id === "number" && Number.isFinite(id)) set.add(String(Math.trunc(id)));
      else if (typeof id === "string" && id.trim()) set.add(id.trim());
    }
    out.set(name, set);
  }
  return out;
}

function objectMatchesManualGroupFilter(
  objectId: string,
  filter: string | null,
  setsByName: Map<string, Set<string>>
): boolean {
  if (filter == null || filter === "") return true;
  const set = setsByName.get(filter);
  if (set == null || set.size === 0) return false;
  return set.has(objectId);
}

function objectMatchesShelfColorGroupFilter(
  objectId: string,
  filter: ColorGroupKey | null,
  groupRowByKey: Map<ColorGroupKey, ColorGroupRow>
): boolean {
  if (filter == null) return true;
  const row = groupRowByKey.get(filter);
  if (row == null || row.objectIds.length === 0) return false;
  return row.objectIds.includes(objectId);
}

function derivePaletteKmeansClusterUi(map: Map<string, ObjectColorMeta>): { k: number; clusterIds: number[] } {
  let k: number | null = null;
  let maxCluster = -1;
  for (const meta of map.values()) {
    if (meta.colorKmeansK != null && meta.colorKmeansK > 0) {
      k = meta.colorKmeansK;
    }
    const c = meta.colorKmeansCluster;
    if (c != null && c >= 0) {
      maxCluster = Math.max(maxCluster, c);
    }
  }
  const kEff = k ?? (maxCluster >= 0 ? maxCluster + 1 : 0);
  const clusterIds = kEff > 0 ? Array.from({ length: kEff }, (_, i) => i) : [];
  return { k: kEff, clusterIds };
}

const manualRejectObjectIdSet = new Set(manualRejectObjectIds.map((objectId) => String(objectId)));
const manualColorGroupIdSets = buildManualColorGroupIdSets(manualColorGroupsJson as ManualColorGroupsFile);
const manualColorGroupNamesSorted = [...manualColorGroupIdSets.keys()].sort((a, b) => a.localeCompare(b));
const objectTitleById = new Map(
  Object.entries(
    objectsData as Record<
      string,
      {
        objectID?: number;
        title?: string;
      }
    >
  ).map(([objectIdKey, value]) => [String(value.objectID ?? objectIdKey), value.title ?? "Unknown"])
);

function buildImageFilename(objectId: string, mode: ImageMode) {
  return `${objectId}_${IMAGE_SUFFIX[mode]}.${mode === "outline" ? "svg" : "png"}`;
}

function buildS3ImageUrl(objectId: string, mode: ImageMode) {
  return `${S3_IMAGE_BASE_URL}/${buildImageFilename(objectId, mode)}`;
}

function getObjectTitle(objectId: string) {
  return objectTitleById.get(objectId) ?? "Unknown";
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function buildFieldsMetaByObjectId() {
  const lines = fieldsCsvRaw.trim().split("\n");
  if (lines.length < 2) return new Map<string, ObjectFieldMeta>();
  const headers = parseCsvLine(lines[0]);
  const idx = new Map(headers.map((h, i) => [h, i]));
  const objectIdCol = idx.get("objectId");
  if (objectIdCol == null) return new Map<string, ObjectFieldMeta>();
  const dateCol = idx.get("final_date");
  const bestGuessLocationCol = idx.get("geo_normalized_best_guess_location");
  const placeNameCol = idx.get("mapbox_place_name");

  const map = new Map<string, ObjectFieldMeta>();
  for (let rowIdx = 1; rowIdx < lines.length; rowIdx += 1) {
    const row = parseCsvLine(lines[rowIdx]);
    const objectId = String(row[objectIdCol] ?? "").trim();
    if (!objectId) continue;
    const dateRaw = dateCol == null ? "" : String(row[dateCol] ?? "").trim();
    const bestGuessLocationRaw =
      bestGuessLocationCol == null ? "" : String(row[bestGuessLocationCol] ?? "").trim();
    const placeNameRaw = placeNameCol == null ? "" : String(row[placeNameCol] ?? "").trim();
    map.set(objectId, {
      date: dateRaw || "Unknown",
      location: bestGuessLocationRaw || placeNameRaw || "Unknown"
    });
  }
  return map;
}

function parseHexPalette(raw: string) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value ?? "").trim())
      .filter((value) => /^#[0-9a-fA-F]{6}$/.test(value));
  } catch {
    return [];
  }
}

function parseNumberArray(raw: string) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0);
  } catch {
    return [];
  }
}

function parseBucketLabels(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value ?? "").trim())
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

function parseOptionalIntCell(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "" || s === "NaN") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function formatPaletteKmeansLine(meta: ObjectColorMeta | undefined): { detail: string; dim: boolean } {
  const cluster = meta?.colorKmeansCluster;
  const k = meta?.colorKmeansK;
  if (cluster == null && k == null) return { detail: "—", dim: true };
  if (cluster === -1) {
    const kPart = k != null ? ` · k=${k}` : "";
    return { detail: `unassigned${kPart}`, dim: true };
  }
  const kPart = k != null ? ` (k=${k})` : "";
  return { detail: `cluster ${cluster}${kPart}`, dim: false };
}

function buildColorMetaByObjectId() {
  const lines = fieldsCsvRaw.trim().split("\n");
  if (lines.length < 2) return new Map<string, ObjectColorMeta>();
  const headers = parseCsvLine(lines[0]);
  const idx = new Map(headers.map((h, i) => [h, i]));
  const objectIdCol = idx.get("objectId");
  if (objectIdCol == null) return new Map<string, ObjectColorMeta>();
  const colorgramPaletteCol = idx.get("colorgram_palette_hex");
  const colorgramShareCol = idx.get("colorgram_palette_share");
  const colorBucketLabelsCol = idx.get("color_bucket_labels");
  const colorBucketPrimaryCol = idx.get("color_bucket_primary");
  const colorKmeansClusterCol = idx.get("color_kmeans_cluster");
  const colorKmeansKCol = idx.get("color_kmeans_k");

  const map = new Map<string, ObjectColorMeta>();
  for (let rowIdx = 1; rowIdx < lines.length; rowIdx += 1) {
    const row = parseCsvLine(lines[rowIdx]);
    const objectId = String(row[objectIdCol] ?? "").trim();
    if (!objectId) continue;
    const primaryRaw =
      colorBucketPrimaryCol == null ? "" : String(row[colorBucketPrimaryCol] ?? "").trim();
    const clusterRaw = colorKmeansClusterCol == null ? undefined : row[colorKmeansClusterCol];
    const kRaw = colorKmeansKCol == null ? undefined : row[colorKmeansKCol];
    map.set(objectId, {
      colorgramPaletteHex:
        colorgramPaletteCol == null ? [] : parseHexPalette(String(row[colorgramPaletteCol] ?? "").trim()),
      colorgramPaletteShare:
        colorgramShareCol == null ? [] : parseNumberArray(String(row[colorgramShareCol] ?? "").trim()),
      colorBucketLabels:
        colorBucketLabelsCol == null ? [] : parseBucketLabels(String(row[colorBucketLabelsCol] ?? "").trim()),
      colorBucketPrimary: primaryRaw,
      colorKmeansCluster: parseOptionalIntCell(clusterRaw),
      colorKmeansK: parseOptionalIntCell(kRaw)
    });
  }
  return map;
}

type ExcludeManualKmeansParsed = {
  clusterByObjectId: Map<string, number>;
  kFit: number;
  clusterIds: number[];
  featureVersionLabel: string;
};

function parseExcludeManualKmeansCsv(raw: string): ExcludeManualKmeansParsed {
  const empty: ExcludeManualKmeansParsed = {
    clusterByObjectId: new Map(),
    kFit: 0,
    clusterIds: [],
    featureVersionLabel: ""
  };
  const lines = raw.trim().split("\n");
  if (lines.length < 2) return empty;

  const headers = parseCsvLine(lines[0]);
  const idx = new Map(headers.map((h, i) => [h, i]));
  const oidCol = idx.get("objectID") ?? idx.get("objectId");
  const clusterCol = idx.get("color_kmeans_cluster");
  const kCol = idx.get("color_kmeans_k");
  const verCol = idx.get("color_kmeans_feature_version");
  if (oidCol == null || clusterCol == null) return empty;

  const clusterByObjectId = new Map<string, number>();
  let maxKFromCol = 0;
  let maxCluster = -1;
  let featureVersionLabel = "";

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx += 1) {
    const row = parseCsvLine(lines[rowIdx]);
    const oid = String(row[oidCol] ?? "").trim();
    if (!oid) continue;

    const c = parseOptionalIntCell(row[clusterCol]);
    if (c === null) continue;

    clusterByObjectId.set(oid, c);
    if (c >= 0) maxCluster = Math.max(maxCluster, c);

    if (kCol != null) {
      const kCell = parseOptionalIntCell(row[kCol]);
      if (kCell != null && kCell > maxKFromCol) maxKFromCol = kCell;
    }

    if (verCol != null && featureVersionLabel === "") {
      const v = String(row[verCol] ?? "").trim();
      if (v) featureVersionLabel = v;
    }
  }

  let kFit = maxKFromCol;
  if (kFit <= 0 && maxCluster >= 0) kFit = maxCluster + 1;

  const clusterIds = kFit > 0 ? Array.from({ length: kFit }, (_, i) => i) : [];

  return {
    clusterByObjectId,
    kFit,
    clusterIds,
    featureVersionLabel
  };
}

function objectMatchesExcludeManualKMeansFilter(
  objectId: string,
  filter: number | null,
  clusterByObjectId: Map<string, number>
): boolean {
  if (filter === null) return true;
  const c = clusterByObjectId.get(objectId);
  if (c === undefined) return false;
  return c === filter;
}

const excludeManualKmeansParsed = parseExcludeManualKmeansCsv(excludeManualKmeansClustersCsvRaw);

/** Cluster pill order from build script: PC1 of scaled KMeans centroids (similar groups adjacent). */
function resolveExcludeManualClusterUiOrder(kFit: number, clusterIds: number[]): number[] {
  const payload = excludeManualClusterUiOrderPayload as {
    clusterUiOrder?: unknown;
    kFit?: unknown;
  };
  if (payload.kFit !== kFit || clusterIds.length !== kFit || kFit <= 0) {
    return clusterIds;
  }
  const ord = payload.clusterUiOrder;
  if (!Array.isArray(ord) || ord.length !== kFit) return clusterIds;
  const nums: number[] = [];
  for (const x of ord) {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isInteger(n)) return clusterIds;
    nums.push(n);
  }
  const expected = new Set(clusterIds);
  if (nums.some((id) => !expected.has(id))) return clusterIds;
  if (new Set(nums).size !== nums.length) return clusterIds;
  return nums;
}

const excludeManualClusterIdsForUi = resolveExcludeManualClusterUiOrder(
  excludeManualKmeansParsed.kFit,
  excludeManualKmeansParsed.clusterIds
);

/** Grid order when a single exclude-manual cluster is selected: nearest to centroid first (see JSON build). */
function sortDisplayedIdsByExcludeManualCentroidOrder(
  ids: string[],
  clusterFilter: number | null,
  parsedKFit: number
): string[] {
  const payload = excludeManualClusterUiOrderPayload as {
    byClusterMemberOrder?: Record<string, number[]>;
    kFit?: unknown;
  };
  if (
    clusterFilter == null ||
    clusterFilter < 0 ||
    parsedKFit <= 0 ||
    payload.kFit !== parsedKFit ||
    !payload.byClusterMemberOrder
  ) {
    return [...ids].sort((a, b) => Number(a) - Number(b));
  }
  const ranked = payload.byClusterMemberOrder[String(clusterFilter)];
  if (!Array.isArray(ranked) || ranked.length === 0) {
    return [...ids].sort((a, b) => Number(a) - Number(b));
  }
  const rank = new Map<string, number>();
  ranked.forEach((oid, index) => rank.set(String(oid), index));
  return [...ids].sort((a, b) => {
    const ra = rank.get(a);
    const rb = rank.get(b);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return Number(a) - Number(b);
  });
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function numericSuffix(name: string, prefix: string) {
  if (!name.startsWith(prefix)) return Number.NaN;
  const suffix = name.slice(prefix.length);
  return /^\d+$/.test(suffix) ? Number(suffix) : Number.NaN;
}

function sortedProfileCols(headers: string[], prefix: string) {
  return headers
    .filter((col) => Number.isFinite(numericSuffix(col, prefix)))
    .sort((a, b) => numericSuffix(a, prefix) - numericSuffix(b, prefix));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildNeighborIndex(allowedObjectIds: Set<string>): NeighborIndex {
  const lines = silhouetteFeaturesCsvRaw.trim().split("\n");
  if (lines.length < 2) {
    return { orderedObjectIds: [], vectorByObjectId: new Map() };
  }

  const headers = lines[0].split(",");
  const colIndexByName = new Map(headers.map((h, i) => [h, i]));
  const objectIdColIdx = colIndexByName.get("object_id");
  if (objectIdColIdx == null) {
    return { orderedObjectIds: [], vectorByObjectId: new Map() };
  }

  const lrCols = [...sortedProfileCols(headers, "l"), ...sortedProfileCols(headers, "r")];
  const tbCols = [...sortedProfileCols(headers, "t"), ...sortedProfileCols(headers, "b")];
  const symmetryCols = headers.filter((col) =>
    [
      "lr_profile_abs_diff_mean",
      "eccentricity",
      "upper_vs_lower_width_ratio",
      "centroid_x_norm",
      "centroid_offset_x"
    ].includes(col)
  );
  const contourCols = headers.filter(
    (col) => col.startsWith("contour_") || col.startsWith("convexity_")
  );
  const huCols = headers.filter((col) => /^hu\d+$/.test(col));
  const innerCountCols = headers.filter((col) => col === "inner_count");
  const innerCols = headers.filter((col) => col.startsWith("inner") && col !== "inner_count");
  const shapeCols = Array.from(new Set([...contourCols, ...huCols, ...symmetryCols]));

  const featureCols = [...lrCols, ...tbCols, ...shapeCols, ...innerCols, ...innerCountCols];
  const featureColIndexes = featureCols
    .map((col) => colIndexByName.get(col))
    .filter((idx): idx is number => idx != null);

  const rows: { objectId: string; values: number[] }[] = [];
  const valuesByCol: number[][] = featureColIndexes.map(() => []);

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx += 1) {
    const rawCells = lines[rowIdx].split(",");
    const objectId = String(rawCells[objectIdColIdx] ?? "").trim();
    if (!objectId || !allowedObjectIds.has(objectId)) continue;
    const values = featureColIndexes.map((colIdx, j) => {
      const raw = String(rawCells[colIdx] ?? "")
        .trim()
        .toLowerCase();
      const parsed = raw === "" || raw === "nan" ? Number.NaN : Number(raw);
      if (Number.isFinite(parsed)) valuesByCol[j].push(parsed);
      return parsed;
    });
    rows.push({ objectId, values });
  }

  if (rows.length === 0) return { orderedObjectIds: [], vectorByObjectId: new Map() };

  const medians = valuesByCol.map((values) => median(values));
  const imputed = rows.map((row) =>
    row.values.map((value, idx) => (Number.isFinite(value) ? value : medians[idx]))
  );

  const means = featureColIndexes.map((_, colIdx) => {
    let sum = 0;
    for (let rowIdx = 0; rowIdx < imputed.length; rowIdx += 1) {
      sum += imputed[rowIdx][colIdx];
    }
    return sum / Math.max(1, imputed.length);
  });

  const stds = featureColIndexes.map((_, colIdx) => {
    let sumSq = 0;
    for (let rowIdx = 0; rowIdx < imputed.length; rowIdx += 1) {
      const centered = imputed[rowIdx][colIdx] - means[colIdx];
      sumSq += centered * centered;
    }
    const variance = sumSq / Math.max(1, imputed.length);
    return variance > 0 ? Math.sqrt(variance) : 1;
  });

  const weights = featureCols.map((col) => {
    if (lrCols.includes(col)) return FEATURE_WEIGHTS.lr;
    if (tbCols.includes(col)) return FEATURE_WEIGHTS.tb;
    if (col === "inner_count") return FEATURE_WEIGHTS.innerCount;
    if (innerCols.includes(col)) return FEATURE_WEIGHTS.inner;
    return FEATURE_WEIGHTS.shape;
  });

  const vectorByObjectId = new Map<string, Float64Array>();
  const orderedObjectIds: string[] = [];
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx += 1) {
    const vector = new Float64Array(featureColIndexes.length);
    for (let colIdx = 0; colIdx < featureColIndexes.length; colIdx += 1) {
      const standardized = (imputed[rowIdx][colIdx] - means[colIdx]) / stds[colIdx];
      vector[colIdx] = standardized * weights[colIdx];
    }
    const objectId = rows[rowIdx].objectId;
    vectorByObjectId.set(objectId, vector);
    orderedObjectIds.push(objectId);
  }

  return { orderedObjectIds, vectorByObjectId };
}

function computeClosestNeighbors(
  selectedObjectId: string,
  index: NeighborIndex,
  maxNeighbors: number
): NeighborHit[] {
  const selectedVector = index.vectorByObjectId.get(selectedObjectId);
  if (!selectedVector) return [];

  const hits: NeighborHit[] = [];
  for (let i = 0; i < index.orderedObjectIds.length; i += 1) {
    const objectId = index.orderedObjectIds[i];
    if (objectId === selectedObjectId) continue;
    const vector = index.vectorByObjectId.get(objectId);
    if (!vector) continue;
    let sumSq = 0;
    for (let j = 0; j < selectedVector.length; j += 1) {
      const diff = selectedVector[j] - vector[j];
      sumSq += diff * diff;
    }
    hits.push({ objectId, distance: Math.sqrt(sumSq) });
  }

  hits.sort((a, b) => a.distance - b.distance);
  return hits.slice(0, maxNeighbors);
}

function Test2() {
  const navigate = useNavigate();
  const { groupRows, groupRowByKey } = useColorGroups();
  const [imageMode, setImageMode] = useState<ImageMode>("no_bg");
  const [objectIdSearch, setObjectIdSearch] = useState("");
  const [showOnlyBeforeYearZero, setShowOnlyBeforeYearZero] = useState(false);
  const [showOnlyWithPaletteData, setShowOnlyWithPaletteData] = useState(false);
  const [selectedColorBucketFilter, setSelectedColorBucketFilter] = useState<string | null>(null);
  const [selectedKMeansClusterFilter, setSelectedKMeansClusterFilter] = useState<number | null>(null);
  const [selectedManualGroupFilter, setSelectedManualGroupFilter] = useState<string | null>(null);
  const [selectedShelfColorGroupKey, setSelectedShelfColorGroupKey] = useState<ColorGroupKey | null>(null);
  const [selectedExcludeManualClusterFilter, setSelectedExcludeManualClusterFilter] = useState<number | null>(
    null
  );
  const [clickedObjectIds, setClickedObjectIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_SELECTED_OBJECT_IDS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [modalImageMode, setModalImageMode] = useState<ImageMode>("no_bg");
  const [missingImageNames, setMissingImageNames] = useState<Record<string, true>>({});
  const loggedMissingImageNamesRef = useRef<Set<string>>(new Set());

  const baseObjectIds = useMemo(() => {
    return Array.from(objectTitleById.keys())
      .filter((objectId) => !manualRejectObjectIdSet.has(objectId))
      .sort((a, b) => Number(a) - Number(b));
  }, []);

  const neighborIndex = useMemo(() => {
    return buildNeighborIndex(new Set(baseObjectIds));
  }, [baseObjectIds]);

  const objectIds = useMemo(() => {
    return [...neighborIndex.orderedObjectIds].sort((a, b) => Number(a) - Number(b));
  }, [neighborIndex]);
  const objectFieldMetaById = useMemo(() => buildFieldsMetaByObjectId(), []);
  const objectColorMetaById = useMemo(() => buildColorMetaByObjectId(), []);
  const paletteKmeansUi = useMemo(
    () => derivePaletteKmeansClusterUi(objectColorMetaById),
    [objectColorMetaById]
  );

  const normalizedObjectIdSearch = objectIdSearch.trim();
  const displayedObjectIds = useMemo(() => {
    const filtered = objectIds.filter((objectId) => {
      if (normalizedObjectIdSearch && objectId !== normalizedObjectIdSearch) return false;
      if (!showOnlyBeforeYearZero) return true;
      const rawDate = objectFieldMetaById.get(objectId)?.date ?? "";
      const numericDate = Number(rawDate);
      const passesDateFilter = Number.isFinite(numericDate) && numericDate < 0;
      if (!passesDateFilter) return false;
      return true;
    }).filter((objectId) => {
      if (!showOnlyWithPaletteData) return true;
      const colorMeta = objectColorMetaById.get(objectId);
      return (colorMeta?.colorgramPaletteHex.length ?? 0) > 0;
    }).filter((objectId) => {
      const colorMeta = objectColorMetaById.get(objectId);
      return objectMatchesColorBucketFilter(colorMeta, selectedColorBucketFilter);
    }).filter((objectId) => {
      const colorMeta = objectColorMetaById.get(objectId);
      return objectMatchesKMeansClusterFilter(colorMeta, selectedKMeansClusterFilter);
    }).filter((objectId) =>
      objectMatchesManualGroupFilter(objectId, selectedManualGroupFilter, manualColorGroupIdSets)
    ).filter((objectId) =>
      objectMatchesShelfColorGroupFilter(objectId, selectedShelfColorGroupKey, groupRowByKey)
    ).filter((objectId) =>
      objectMatchesExcludeManualKMeansFilter(
        objectId,
        selectedExcludeManualClusterFilter,
        excludeManualKmeansParsed.clusterByObjectId
      )
    );
    return sortDisplayedIdsByExcludeManualCentroidOrder(
      filtered,
      selectedExcludeManualClusterFilter,
      excludeManualKmeansParsed.kFit
    );
  }, [
    groupRowByKey,
    objectColorMetaById,
    objectFieldMetaById,
    objectIds,
    normalizedObjectIdSearch,
    selectedColorBucketFilter,
    selectedExcludeManualClusterFilter,
    selectedKMeansClusterFilter,
    selectedManualGroupFilter,
    selectedShelfColorGroupKey,
    showOnlyBeforeYearZero,
    showOnlyWithPaletteData
  ]);

  const hasNoSearchResult = normalizedObjectIdSearch.length > 0 && displayedObjectIds.length === 0;
  const closestNeighbors = useMemo(() => {
    if (!selectedObjectId) return [];
    return computeClosestNeighbors(selectedObjectId, neighborIndex, NEIGHBOR_COUNT);
  }, [neighborIndex, selectedObjectId]);

  const modalCardCount = Math.max(1, closestNeighbors.length + (selectedObjectId ? 1 : 0));
  const modalTargetWidthPx = Math.min(1280, Math.max(520, modalCardCount * 210 + 48));

  const handleImageError = (objectId: string, mode: ImageMode, imageName: string) => {
    if (!loggedMissingImageNamesRef.current.has(imageName)) {
      loggedMissingImageNamesRef.current.add(imageName);
      console.log(imageName);
      if (mode === "mask") console.log(objectId);
    }
    setMissingImageNames((previous) =>
      previous[imageName] ? previous : { ...previous, [imageName]: true }
    );
  };

  const handleImageClick = (objectId: string) => {
    setClickedObjectIds((previousIds) => {
      if (previousIds.includes(objectId)) {
        console.log("Clicked object IDs (session):", previousIds);
        return previousIds;
      }
      const nextIds = [...previousIds, objectId];
      console.log("Clicked object IDs (session):", nextIds);
      return nextIds;
    });
    if (TEST2_OPEN_MODAL_ON_IMAGE_CLICK) {
      setModalImageMode("no_bg");
      setSelectedObjectId(objectId);
    }
  };

  const renderModeImage = (objectId: string, mode: ImageMode) => {
    const imageName = buildImageFilename(objectId, mode);
    const imageUrl = buildS3ImageUrl(objectId, mode);
    if (missingImageNames[imageName]) return null;
    if (mode === "outline") {
      return (
        <InlineOutlineSvg
          src={imageUrl}
          alt={imageName}
          className="inline-outline-svg"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            position: "absolute",
            inset: 0
          }}
        />
      );
    }
    return (
      <img
        src={imageUrl}
        alt={imageName}
        loading="lazy"
        onError={() => handleImageError(objectId, mode, imageName)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          position: "absolute",
          inset: 0
        }}
      />
    );
  };

  const renderPaletteStrips = (objectId: string, swatchHeight = 8) => {
    const colorMeta = objectColorMetaById.get(objectId);
    const colors = colorMeta?.colorgramPaletteHex ?? [];
    const shares = colorMeta?.colorgramPaletteShare ?? [];
    const buckets = colorMeta?.colorBucketLabels ?? [];
    const primary = (colorMeta?.colorBucketPrimary ?? "").trim();
    const weightedShares = colors.map((_, index) => Math.max(0, shares[index] ?? 0));
    const weightedTotal = weightedShares.reduce((sum, value) => sum + value, 0);
    const km = formatPaletteKmeansLine(colorMeta);

    return (
      <div style={{ marginTop: "6px", display: "grid", gap: "4px" }}>
        <div style={{ display: "grid", gap: "2px" }}>
          <div style={{ fontSize: "10px", color: "#bbb", lineHeight: 1 }}>Colorgram</div>
          <div
            style={{
              width: "100%",
              height: `${swatchHeight}px`,
              borderRadius: "3px",
              overflow: "hidden",
              border: "1px solid #333",
              display: "flex",
              background: "#111"
            }}
          >
            {colors.length > 0 ? (
              colors.map((hex, index) => (
                <span
                  key={`${objectId}-colorgram-${hex}-${index}`}
                  title={`${hex} (${((shares[index] ?? 0) * 100).toFixed(1)}%)`}
                  style={{ backgroundColor: hex, flex: 1, minWidth: 0 }}
                />
              ))
            ) : (
              <span style={{ flex: 1, background: "#111" }} />
            )}
          </div>
        </div>
        <div style={{ display: "grid", gap: "2px" }}>
          <div style={{ fontSize: "10px", color: "#bbb", lineHeight: 1 }}>
            Colorgram (proportional width)
          </div>
          <div
            style={{
              width: "100%",
              height: `${swatchHeight}px`,
              borderRadius: "3px",
              overflow: "hidden",
              border: "1px solid #333",
              display: "flex",
              background: "#111"
            }}
          >
            {colors.length > 0 ? (
              colors.map((hex, index) => {
                const share = weightedShares[index];
                const widthPercent =
                  weightedTotal > 0 ? (share / weightedTotal) * 100 : 100 / Math.max(1, colors.length);
                return (
                  <span
                    key={`${objectId}-colorgram-weighted-${hex}-${index}`}
                    title={`${hex} (${(100 * (shares[index] ?? 0)).toFixed(1)}%)`}
                    style={{ backgroundColor: hex, width: `${widthPercent}%`, minWidth: "1px" }}
                  />
                );
              })
            ) : (
              <span style={{ flex: 1, background: "#111" }} />
            )}
          </div>
        </div>
        <div style={{ display: "grid", gap: "2px" }}>
          <div style={{ fontSize: "10px", color: "#bbb", lineHeight: 1 }}>Color buckets</div>
          {buckets.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {buckets.map((label, bucketIndex) => {
                const isPrimary = primary.length > 0 && label === primary;
                return (
                  <span
                    key={`${objectId}-bucket-${bucketIndex}-${label}`}
                    title={isPrimary ? "Primary bucket" : undefined}
                    style={{
                      fontSize: "10px",
                      lineHeight: 1.35,
                      padding: "3px 6px",
                      borderRadius: "4px",
                      border: isPrimary ? "1px solid #9cf" : "1px solid #444",
                      background: isPrimary ? "rgba(120, 180, 255, 0.12)" : "#1a1a1a",
                      color: "#e8e8e8",
                      maxWidth: "100%",
                      overflowWrap: "anywhere"
                    }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: "10px", color: "#666" }}>—</div>
          )}
        </div>
        <div style={{ display: "grid", gap: "2px" }}>
          <div style={{ fontSize: "10px", color: "#bbb", lineHeight: 1 }}>Palette KMeans</div>
          <div
            style={{
              fontSize: "10px",
              lineHeight: 1.35,
              color: km.dim ? "#666" : "#9cf",
              fontWeight: km.dim ? 400 : 600
            }}
          >
            {km.detail}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main style={{ padding: "1rem", backgroundColor: "#000", color: "#fff", minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "0.75rem"
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: "#fff",
            color: "#000",
            padding: "0.35rem 0.6rem",
            cursor: "pointer",
            fontWeight: 700
          }}
        >
          Back
        </button>
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Test2 Images</h1>
        <span style={{ marginLeft: "0.5rem", fontSize: "0.9rem", color: "#ddd" }}>
          Showing {displayedObjectIds.length} of {objectIds.length} objects (feature-ready)
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "1rem"
        }}
      >
        <span style={{ fontSize: "0.9rem" }}>View:</span>
        <button
          type="button"
          onClick={() => setImageMode("mask")}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: imageMode === "mask" ? "#fff" : "#000",
            color: imageMode === "mask" ? "#000" : "#fff",
            padding: "0.35rem 0.6rem",
            cursor: "pointer"
          }}
        >
          Mask
        </button>
        <button
          type="button"
          onClick={() => setImageMode("no_bg")}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: imageMode === "no_bg" ? "#fff" : "#000",
            color: imageMode === "no_bg" ? "#000" : "#fff",
            padding: "0.35rem 0.6rem",
            cursor: "pointer"
          }}
        >
          BG Removed
        </button>
        <button
          type="button"
          onClick={() => setImageMode("outline")}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: imageMode === "outline" ? "#fff" : "#000",
            color: imageMode === "outline" ? "#000" : "#fff",
            padding: "0.35rem 0.6rem",
            cursor: "pointer"
          }}
        >
          Outline
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={objectIdSearch}
          onChange={(event) => setObjectIdSearch(event.target.value.replace(/\D/g, ""))}
          placeholder="Search objectID"
          aria-label="Search by objectID"
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: "#000",
            color: "#fff",
            padding: "0.35rem 0.6rem",
            minWidth: "180px"
          }}
        />
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.9rem",
            cursor: "pointer"
          }}
        >
          <input
            type="checkbox"
            checked={showOnlyBeforeYearZero}
            onChange={(event) => setShowOnlyBeforeYearZero(event.target.checked)}
            aria-label="Filter final_date before 0"
          />
          final_date {"<"} 0
        </label>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.9rem",
            cursor: "pointer"
          }}
        >
          <input
            type="checkbox"
            checked={showOnlyWithPaletteData}
            onChange={(event) => setShowOnlyWithPaletteData(event.target.checked)}
            aria-label="Filter to objects with palette data"
          />
          palette data only
        </label>
      </div>

      <div
        style={{
          marginBottom: "1rem",
          padding: "0.6rem 0.65rem",
          border: "1px solid #333",
          borderRadius: "8px",
          background: "#0a0a0a"
        }}
      >
        <p style={{ margin: "0 0 0.55rem 0", fontSize: "0.72rem", color: "#777", lineHeight: 1.35 }}>
          Only one color filter at a time — choosing any option below clears the others (bucket, either KMeans run,
          manual JSON, or app shelf color group).
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "0.45rem"
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#ccc", fontWeight: 600 }}>Color bucket</span>
          <button
            type="button"
            onClick={() => setSelectedColorBucketFilter(null)}
            disabled={selectedColorBucketFilter == null}
            style={{
              border: "1px solid #666",
              borderRadius: "6px",
              background: selectedColorBucketFilter == null ? "#1a1a1a" : "#222",
              color: selectedColorBucketFilter == null ? "#666" : "#fff",
              padding: "0.2rem 0.45rem",
              fontSize: "0.75rem",
              cursor: selectedColorBucketFilter == null ? "default" : "pointer"
            }}
          >
            All buckets
          </button>
          <span style={{ fontSize: "0.75rem", color: "#888" }}>
            {selectedColorBucketFilter == null
              ? "showing every bucket"
              : `match: ${selectedColorBucketFilter}`}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.35rem",
            alignItems: "center"
          }}
        >
          {COLOR_BUCKET_OPTIONS.map((bucket) => {
            const active = selectedColorBucketFilter === bucket;
            return (
              <button
                key={bucket}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const next = selectedColorBucketFilter === bucket ? null : bucket;
                  setSelectedColorBucketFilter(next);
                  if (next != null) {
                    setSelectedKMeansClusterFilter(null);
                    setSelectedExcludeManualClusterFilter(null);
                    setSelectedManualGroupFilter(null);
                    setSelectedShelfColorGroupKey(null);
                  }
                }}
                style={{
                  border: active ? "1px solid #9cf" : "1px solid #444",
                  borderRadius: "6px",
                  background: active ? "rgba(120, 180, 255, 0.18)" : "#141414",
                  color: "#e8e8e8",
                  padding: "0.28rem 0.5rem",
                  fontSize: "0.72rem",
                  lineHeight: 1.25,
                  cursor: "pointer",
                  maxWidth: "100%",
                  textAlign: "left"
                }}
              >
                {bucket}
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "0.65rem",
            paddingTop: "0.65rem",
            borderTop: "1px solid #2a2a2a"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "0.45rem"
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "#ccc", fontWeight: 600 }}>
              Palette KMeans cluster
            </span>
            <button
              type="button"
              onClick={() => setSelectedKMeansClusterFilter(null)}
              disabled={selectedKMeansClusterFilter == null}
              style={{
                border: "1px solid #666",
                borderRadius: "6px",
                background: selectedKMeansClusterFilter == null ? "#1a1a1a" : "#222",
                color: selectedKMeansClusterFilter == null ? "#666" : "#fff",
                padding: "0.2rem 0.45rem",
                fontSize: "0.75rem",
                cursor: selectedKMeansClusterFilter == null ? "default" : "pointer"
              }}
            >
              All clusters
            </button>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              {paletteKmeansUi.k > 0 ? `k=${paletteKmeansUi.k} · ` : ""}
              {selectedKMeansClusterFilter == null
                ? "showing every cluster"
                : selectedKMeansClusterFilter === -1
                  ? "match: Unassigned"
                  : `match: cluster ${selectedKMeansClusterFilter}`}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.35rem",
              alignItems: "center"
            }}
          >
            <button
              key="kmeans-unassigned"
              type="button"
              aria-pressed={selectedKMeansClusterFilter === -1}
              onClick={() => {
                const next = selectedKMeansClusterFilter === -1 ? null : -1;
                setSelectedKMeansClusterFilter(next);
                if (next != null) {
                  setSelectedColorBucketFilter(null);
                  setSelectedExcludeManualClusterFilter(null);
                  setSelectedManualGroupFilter(null);
                  setSelectedShelfColorGroupKey(null);
                }
              }}
              style={{
                border: selectedKMeansClusterFilter === -1 ? "1px solid #fa8" : "1px solid #444",
                borderRadius: "6px",
                background:
                  selectedKMeansClusterFilter === -1 ? "rgba(255, 160, 120, 0.15)" : "#141414",
                color: "#e8e8e8",
                padding: "0.28rem 0.5rem",
                fontSize: "0.72rem",
                lineHeight: 1.25,
                cursor: "pointer"
              }}
            >
              Unassigned
            </button>
            {paletteKmeansUi.clusterIds.map((id) => {
              const active = selectedKMeansClusterFilter === id;
              return (
                <button
                  key={`kmeans-${id}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    const next = selectedKMeansClusterFilter === id ? null : id;
                    setSelectedKMeansClusterFilter(next);
                    if (next != null) {
                      setSelectedColorBucketFilter(null);
                      setSelectedExcludeManualClusterFilter(null);
                      setSelectedManualGroupFilter(null);
                      setSelectedShelfColorGroupKey(null);
                    }
                  }}
                  style={{
                    border: active ? "1px solid #9cf" : "1px solid #444",
                    borderRadius: "6px",
                    background: active ? "rgba(120, 180, 255, 0.18)" : "#141414",
                    color: "#e8e8e8",
                    padding: "0.28rem 0.5rem",
                    fontSize: "0.72rem",
                    lineHeight: 1.25,
                    cursor: "pointer",
                    minWidth: "2rem",
                    textAlign: "center"
                  }}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            marginTop: "0.65rem",
            paddingTop: "0.65rem",
            borderTop: "1px solid #2a2a2a"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "0.45rem"
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "#ccc", fontWeight: 600 }}>
              KMeans · manual IDs excluded
            </span>
            <button
              type="button"
              onClick={() => setSelectedExcludeManualClusterFilter(null)}
              disabled={selectedExcludeManualClusterFilter == null}
              style={{
                border: "1px solid #666",
                borderRadius: "6px",
                background: selectedExcludeManualClusterFilter == null ? "#1a1a1a" : "#222",
                color: selectedExcludeManualClusterFilter == null ? "#666" : "#fff",
                padding: "0.2rem 0.45rem",
                fontSize: "0.75rem",
                cursor: selectedExcludeManualClusterFilter == null ? "default" : "pointer"
              }}
            >
              All clusters
            </button>
            <span
              style={{ fontSize: "0.75rem", color: "#888" }}
              title={excludeManualKmeansParsed.featureVersionLabel || undefined}
            >
              {excludeManualKmeansParsed.kFit > 0 ? `k=${excludeManualKmeansParsed.kFit} · ` : ""}
              {excludeManualKmeansParsed.clusterIds.length === 0
                ? "no exclude-manual CSV rows"
                : selectedExcludeManualClusterFilter == null
                  ? "pills + grid order from cluster_ui_order.json (re-run exclude-manual build)"
                  : selectedExcludeManualClusterFilter === -1
                    ? "match: Unassigned"
                    : `match: cluster ${selectedExcludeManualClusterFilter} · grid nearest centroid first`}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.35rem",
              alignItems: "center"
            }}
          >
            <button
              key="exclude-manual-unassigned"
              type="button"
              aria-pressed={selectedExcludeManualClusterFilter === -1}
              disabled={excludeManualKmeansParsed.clusterIds.length === 0}
              onClick={() => {
                const next = selectedExcludeManualClusterFilter === -1 ? null : -1;
                setSelectedExcludeManualClusterFilter(next);
                if (next != null) {
                  setSelectedColorBucketFilter(null);
                  setSelectedKMeansClusterFilter(null);
                  setSelectedManualGroupFilter(null);
                  setSelectedShelfColorGroupKey(null);
                }
              }}
              style={{
                border: selectedExcludeManualClusterFilter === -1 ? "1px solid #fa8" : "1px solid #444",
                borderRadius: "6px",
                background:
                  selectedExcludeManualClusterFilter === -1 ? "rgba(255, 160, 120, 0.15)" : "#141414",
                color: "#e8e8e8",
                padding: "0.28rem 0.5rem",
                fontSize: "0.72rem",
                lineHeight: 1.25,
                cursor: excludeManualKmeansParsed.clusterIds.length === 0 ? "default" : "pointer",
                opacity: excludeManualKmeansParsed.clusterIds.length === 0 ? 0.45 : 1
              }}
            >
              Unassigned
            </button>
            {excludeManualClusterIdsForUi.map((id) => {
              const active = selectedExcludeManualClusterFilter === id;
              return (
                <button
                  key={`exclude-manual-kmeans-${id}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    const next = selectedExcludeManualClusterFilter === id ? null : id;
                    setSelectedExcludeManualClusterFilter(next);
                    if (next != null) {
                      setSelectedColorBucketFilter(null);
                      setSelectedKMeansClusterFilter(null);
                      setSelectedManualGroupFilter(null);
                      setSelectedShelfColorGroupKey(null);
                    }
                  }}
                  style={{
                    border: active ? "1px solid #fd9" : "1px solid #444",
                    borderRadius: "6px",
                    background: active ? "rgba(255, 210, 120, 0.18)" : "#141414",
                    color: "#e8e8e8",
                    padding: "0.28rem 0.5rem",
                    fontSize: "0.72rem",
                    lineHeight: 1.25,
                    cursor: "pointer",
                    minWidth: "2rem",
                    textAlign: "center"
                  }}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            marginTop: "0.65rem",
            paddingTop: "0.65rem",
            borderTop: "1px solid #2a2a2a"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "0.45rem"
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "#ccc", fontWeight: 600 }}>
              Manual color group
            </span>
            <button
              type="button"
              onClick={() => setSelectedManualGroupFilter(null)}
              disabled={selectedManualGroupFilter == null}
              style={{
                border: "1px solid #666",
                borderRadius: "6px",
                background: selectedManualGroupFilter == null ? "#1a1a1a" : "#222",
                color: selectedManualGroupFilter == null ? "#666" : "#fff",
                padding: "0.2rem 0.45rem",
                fontSize: "0.75rem",
                cursor: selectedManualGroupFilter == null ? "default" : "pointer"
              }}
            >
              All manual groups
            </button>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              {selectedManualGroupFilter == null
                ? "no manual filter"
                : `match: ${selectedManualGroupFilter} (${manualColorGroupIdSets.get(selectedManualGroupFilter)?.size ?? 0} ids)`}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.35rem",
              alignItems: "center"
            }}
          >
            {manualColorGroupNamesSorted.map((name) => {
              const count = manualColorGroupIdSets.get(name)?.size ?? 0;
              const active = selectedManualGroupFilter === name;
              const label = `${name.replace(/_/g, " ")} (${count})`;
              return (
                <button
                  key={`manual-group-${name}`}
                  type="button"
                  aria-pressed={active}
                  title={name}
                  onClick={() => {
                    const next = selectedManualGroupFilter === name ? null : name;
                    setSelectedManualGroupFilter(next);
                    if (next != null) {
                      setSelectedColorBucketFilter(null);
                      setSelectedKMeansClusterFilter(null);
                      setSelectedExcludeManualClusterFilter(null);
                      setSelectedShelfColorGroupKey(null);
                    }
                  }}
                  style={{
                    border: active ? "1px solid #c9f" : "1px solid #444",
                    borderRadius: "6px",
                    background: active ? "rgba(200, 150, 255, 0.16)" : "#141414",
                    color: "#e8e8e8",
                    padding: "0.28rem 0.5rem",
                    fontSize: "0.72rem",
                    lineHeight: 1.25,
                    cursor: "pointer",
                    maxWidth: "100%",
                    textAlign: "left"
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            marginTop: "0.65rem",
            paddingTop: "0.65rem",
            borderTop: "1px solid #2a2a2a"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "0.45rem"
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "#ccc", fontWeight: 600 }}>
              App shelf color group
            </span>
            <button
              type="button"
              onClick={() => setSelectedShelfColorGroupKey(null)}
              disabled={selectedShelfColorGroupKey == null}
              style={{
                border: "1px solid #666",
                borderRadius: "6px",
                background: selectedShelfColorGroupKey == null ? "#1a1a1a" : "#222",
                color: selectedShelfColorGroupKey == null ? "#666" : "#fff",
                padding: "0.2rem 0.45rem",
                fontSize: "0.75rem",
                cursor: selectedShelfColorGroupKey == null ? "default" : "pointer"
              }}
            >
              All shelf groups
            </button>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              {selectedShelfColorGroupKey == null
                ? "same keys as home → color shelf"
                : (() => {
                    const row = groupRowByKey.get(selectedShelfColorGroupKey);
                    const n = row?.objectIds.length ?? 0;
                    return `match: ${row?.label ?? selectedShelfColorGroupKey} (${n})`;
                  })()}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.35rem",
              alignItems: "center"
            }}
          >
            {groupRows.map((row: ColorGroupRow) => {
              const active = selectedShelfColorGroupKey === row.groupKey;
              const count = row.objectIds.length;
              return (
                <button
                  key={`shelf-color-${row.groupKey}`}
                  type="button"
                  aria-pressed={active}
                  title={row.groupKey}
                  onClick={() => {
                    const next = selectedShelfColorGroupKey === row.groupKey ? null : row.groupKey;
                    setSelectedShelfColorGroupKey(next);
                    if (next != null) {
                      setSelectedColorBucketFilter(null);
                      setSelectedKMeansClusterFilter(null);
                      setSelectedExcludeManualClusterFilter(null);
                      setSelectedManualGroupFilter(null);
                    }
                  }}
                  style={{
                    border: active ? "1px solid #9f9" : "1px solid #444",
                    borderRadius: "6px",
                    background: active ? "rgba(120, 220, 140, 0.14)" : "#141414",
                    color: "#e8e8e8",
                    padding: "0.28rem 0.5rem",
                    fontSize: "0.72rem",
                    lineHeight: 1.25,
                    cursor: "pointer",
                    maxWidth: "100%",
                    textAlign: "left"
                  }}
                >
                  {row.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {hasNoSearchResult ? (
        <p style={{ margin: "0 0 1rem 0", color: "#ffb3b3", fontSize: "0.9rem" }}>
          No object found for ID {normalizedObjectIdSearch}.
        </p>
      ) : null}

      <div
        style={{
          position: "sticky",
          top: "0.5rem",
          zIndex: 20,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.4rem",
          marginBottom: "0.75rem",
          pointerEvents: "none"
        }}
      >
        <span
          title={
            clickedObjectIds.length === 0
              ? "Unique thumbnails clicked this load (not persisted)."
              : clickedObjectIds.join(", ")
          }
          style={{
            fontSize: "0.72rem",
            color: "#888",
            pointerEvents: "auto",
            marginRight: "0.15rem",
            maxWidth: "min(280px, 42vw)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {clickedObjectIds.length} clicked · session only
        </span>
        <button
          type="button"
          onClick={scrollToTop}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: "#000",
            color: "#fff",
            padding: "0.35rem 0.6rem",
            cursor: "pointer",
            pointerEvents: "auto"
          }}
        >
          Top
        </button>
        <button
          type="button"
          onClick={scrollToBottom}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: "#000",
            color: "#fff",
            padding: "0.35rem 0.6rem",
            cursor: "pointer",
            pointerEvents: "auto"
          }}
        >
          Bottom
        </button>
      </div>

      <section style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {displayedObjectIds.map((objectId) => {
          const imageName = buildImageFilename(objectId, imageMode);
          const imageUrl = buildS3ImageUrl(objectId, imageMode);
          const isMissingImage = Boolean(missingImageNames[imageName]);
          return (
            <figure
              key={`${objectId}-${imageMode}`}
              style={{
                margin: 0,
                width: "140px",
                padding: "6px",
                borderRadius: "8px",
                background: "transparent"
              }}
            >
              <div
                onClick={() => handleImageClick(objectId)}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  position: "relative",
                  backgroundColor: imageMode === "no_bg" ? "transparent" : "#000",
                  cursor: "pointer"
                }}
              >
                {!isMissingImage ? (
                  imageMode === "outline" ? (
                    <InlineOutlineSvg
                      src={imageUrl}
                      alt={imageName}
                      className="inline-outline-svg"
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        position: "absolute",
                        inset: 0
                      }}
                    />
                  ) : (
                    <img
                      src={imageUrl}
                      alt={imageName}
                      loading="lazy"
                      onError={() => handleImageError(objectId, imageMode, imageName)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                        position: "absolute",
                        inset: 0
                      }}
                    />
                  )
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      color: "#888",
                      fontSize: "10px",
                      textAlign: "center",
                      padding: "6px"
                    }}
                  >
                    Missing {IMAGE_SUFFIX[imageMode]}
                  </div>
                )}
              </div>
              <figcaption
                style={{
                  marginTop: "6px",
                  fontSize: "11px",
                  lineHeight: 1.3,
                  color: "#fff",
                  overflowWrap: "anywhere"
                }}
              >
                ID: {objectId}
                <br />
                Title: {getObjectTitle(objectId)}
                {renderPaletteStrips(objectId, 7)}
              </figcaption>
            </figure>
          );
        })}
      </section>

      {selectedObjectId ? (
        <div
          onClick={() => setSelectedObjectId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(0.5rem, 2vw, 1rem)",
            zIndex: 50
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: `min(${modalTargetWidthPx}px, calc(100vw - 1rem))`,
              maxHeight: "calc(100vh - 1rem)",
              overflowY: "auto",
              background: "#000",
              color: "#fff",
              border: "1px solid #fff",
              borderRadius: "10px",
              padding: "clamp(0.75rem, 2.2vw, 1rem)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "clamp(0.95rem, 2.8vw, 1rem)" }}>
                Closest Neighbors (Top {NEIGHBOR_COUNT})
              </h2>
              <span style={{ color: "#fff", fontSize: "0.85rem" }}>Modal view:</span>
              <button
                type="button"
                onClick={() => setModalImageMode("mask")}
                style={{
                  border: "1px solid #fff",
                  borderRadius: "6px",
                  background: modalImageMode === "mask" ? "#fff" : "#000",
                  color: modalImageMode === "mask" ? "#000" : "#fff",
                  padding: "0.3rem 0.5rem",
                  cursor: "pointer"
                }}
              >
                Mask
              </button>
              <button
                type="button"
                onClick={() => setModalImageMode("no_bg")}
                style={{
                  border: "1px solid #fff",
                  borderRadius: "6px",
                  background: modalImageMode === "no_bg" ? "#fff" : "#000",
                  color: modalImageMode === "no_bg" ? "#000" : "#fff",
                  padding: "0.3rem 0.5rem",
                  cursor: "pointer"
                }}
              >
                BG Removed
              </button>
              <button
                type="button"
                onClick={() => setModalImageMode("outline")}
                style={{
                  border: "1px solid #fff",
                  borderRadius: "6px",
                  background: modalImageMode === "outline" ? "#fff" : "#000",
                  color: modalImageMode === "outline" ? "#000" : "#fff",
                  padding: "0.3rem 0.5rem",
                  cursor: "pointer"
                }}
              >
                Outline
              </button>
              <button
                type="button"
                onClick={() => setSelectedObjectId(null)}
                aria-label="Close modal"
                style={{
                  marginLeft: "auto",
                  border: "1px solid #fff",
                  background: "#fff",
                  borderRadius: "6px",
                  width: "2rem",
                  height: "2rem",
                  lineHeight: 1,
                  fontSize: "1.1rem",
                  color: "#000",
                  cursor: "pointer"
                }}
              >
                X
              </button>
            </div>

            <p style={{ margin: "0.65rem 0 0", fontSize: "0.8rem", color: "#bbb" }}>
              Computed live from weighted silhouette features (lr/tb/shape/inner), median-imputed
              and standardized.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 210px))",
                justifyContent: "start",
                gap: "0.75rem",
                marginTop: "0.9rem"
              }}
            >
              <figure style={{ margin: 0, width: "210px", maxWidth: "210px" }}>
                <div
                  style={{
                    background: modalImageMode === "no_bg" ? "transparent" : "#000",
                    aspectRatio: "1 / 1",
                    position: "relative"
                  }}
                >
                  {renderModeImage(selectedObjectId, modalImageMode)}
                </div>
                <figcaption style={{ marginTop: "0.5rem", color: "#fff", fontSize: "0.8rem" }}>
                  <div style={{ fontWeight: 700 }}>Selected</div>
                  <div>Object ID: {selectedObjectId}</div>
                  <div>Title: {getObjectTitle(selectedObjectId)}</div>
                  <div>Date: {objectFieldMetaById.get(selectedObjectId)?.date ?? "Unknown"}</div>
                  <div>
                    Location: {objectFieldMetaById.get(selectedObjectId)?.location ?? "Unknown"}
                  </div>
                  {renderPaletteStrips(selectedObjectId, 9)}
                </figcaption>
              </figure>

              {closestNeighbors.map((neighbor, index) => (
                <figure
                  key={`${selectedObjectId}-${neighbor.objectId}`}
                  style={{ margin: 0, width: "210px", maxWidth: "210px" }}
                >
                  <div
                    onClick={() => handleImageClick(neighbor.objectId)}
                    style={{
                      background: modalImageMode === "no_bg" ? "transparent" : "#000",
                      aspectRatio: "1 / 1",
                      position: "relative",
                      cursor: "pointer"
                    }}
                  >
                    {renderModeImage(neighbor.objectId, modalImageMode)}
                  </div>
                  <figcaption style={{ marginTop: "0.5rem", color: "#fff", fontSize: "0.8rem" }}>
                    <div style={{ fontWeight: 700 }}>Neighbor #{index + 1}</div>
                    <div>Object ID: {neighbor.objectId}</div>
                    <div>Title: {getObjectTitle(neighbor.objectId)}</div>
                    <div>Date: {objectFieldMetaById.get(neighbor.objectId)?.date ?? "Unknown"}</div>
                    <div>
                      Location: {objectFieldMetaById.get(neighbor.objectId)?.location ?? "Unknown"}
                    </div>
                    <div>Distance: {neighbor.distance.toFixed(4)}</div>
                    {renderPaletteStrips(neighbor.objectId, 9)}
                  </figcaption>
                </figure>
              ))}
              {closestNeighbors.length === 0 ? (
                <p style={{ margin: 0, color: "#ffb3b3", fontSize: "0.85rem" }}>
                  No neighbors found for this object in the feature index.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default Test2;
