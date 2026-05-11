import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import manualRejectObjectIds from "../../../../fetch_data/data/manual_reject_object_ids.json";
import newColorGroupsJson from "../../../../format_data/color/new/new_color_groups.json";
import objectsData from "../../../../fetch_data/data/objects.json";
import fieldsCsvRaw from "../../../../format_data/generated/fields.csv?raw";
import {
  corpusYearMax,
  corpusYearMin,
  getAllShapeNeighborObjectIds,
  getShapeNeighborsForObject
} from "../../data/shapeNeighborsPayload";
import useObjectModalMetadata from "../../hooks/useObjectModalMetadata";
import useUseGroups, {
  USE_GROUP_LABEL,
  USE_GROUPS_IN_DISPLAY_ORDER,
  type UseGroup,
  type UseGroupRow
} from "../../hooks/useUseGroups";
import {
  formatPlaceVsAnchorSentence,
  parseFinalDateYear
} from "../../utils/neighborComparisonCaptions";
import ChronologySpanGlyph from "../ChronologySpanGlyph";
import InlineOutlineSvg from "../Scenes/InlineOutlineSvg";

const S3_IMAGE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

type ImageMode = "mask" | "no_bg" | "outline";

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
/** Thumbnail click opens closest-neighbors modal. */
const TEST2_OPEN_MODAL_ON_IMAGE_CLICK = false;

type ManualColorGroupsFile = Record<string, unknown>;
type ColorGroupFilterOption = {
  id: string;
  name: string;
  label: string;
};

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

function buildManualColorGroupIdLists(data: ManualColorGroupsFile): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [name, rawIds] of Object.entries(data)) {
    if (!Array.isArray(rawIds)) continue;
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const id of rawIds) {
      let value = "";
      if (typeof id === "number" && Number.isFinite(id)) value = String(Math.trunc(id));
      else if (typeof id === "string" && id.trim()) value = id.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      ids.push(value);
    }
    out.set(name, ids);
  }
  return out;
}

function objectMatchesManualGroupFilter(
  objectId: string,
  filter: string | null,
  setsById: Map<string, Set<string>>
): boolean {
  if (filter == null || filter === "") return true;
  const set = setsById.get(filter);
  if (set == null || set.size === 0) return false;
  return set.has(objectId);
}

function colorGroupLabel(name: string) {
  return name.replace(/_/g, " ");
}

const manualRejectObjectIdSet = new Set(manualRejectObjectIds.map((objectId) => String(objectId)));
const generatedNewColorGroupIdSets = buildManualColorGroupIdSets(
  newColorGroupsJson as ManualColorGroupsFile
);
const generatedNewColorGroupIdLists = buildManualColorGroupIdLists(
  newColorGroupsJson as ManualColorGroupsFile
);
const colorGroupFilterIdSets = new Map<string, Set<string>>();
const colorGroupFilterIdLists = new Map<string, string[]>();

const newColorGroupOptions: ColorGroupFilterOption[] = [...generatedNewColorGroupIdSets.keys()].map(
  (name) => {
    const id = `new:${name}`;
    colorGroupFilterIdSets.set(id, generatedNewColorGroupIdSets.get(name) ?? new Set());
    colorGroupFilterIdLists.set(id, generatedNewColorGroupIdLists.get(name) ?? []);
    return { id, name, label: colorGroupLabel(name) };
  }
);
const colorGroupFilterOptionById = new Map(
  newColorGroupOptions.map((option) => [option.id, option])
);
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
    return parsed.map((value) => String(value ?? "").trim()).filter((value) => value.length > 0);
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

function formatPaletteKmeansLine(meta: ObjectColorMeta | undefined): {
  detail: string;
  dim: boolean;
} {
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
        colorgramPaletteCol == null
          ? []
          : parseHexPalette(String(row[colorgramPaletteCol] ?? "").trim()),
      colorgramPaletteShare:
        colorgramShareCol == null
          ? []
          : parseNumberArray(String(row[colorgramShareCol] ?? "").trim()),
      colorBucketLabels:
        colorBucketLabelsCol == null
          ? []
          : parseBucketLabels(String(row[colorBucketLabelsCol] ?? "").trim()),
      colorBucketPrimary: primaryRaw,
      colorKmeansCluster: parseOptionalIntCell(clusterRaw),
      colorKmeansK: parseOptionalIntCell(kRaw)
    });
  }
  return map;
}

function sortDisplayedIdsByColorGroupOrder(ids: string[], groupFilter: string | null): string[] {
  if (groupFilter == null) return [...ids].sort((a, b) => Number(a) - Number(b));
  const orderedIds = colorGroupFilterIdLists.get(groupFilter);
  if (orderedIds == null || orderedIds.length === 0) {
    return [...ids].sort((a, b) => Number(a) - Number(b));
  }
  const rank = new Map<string, number>();
  orderedIds.forEach((objectId, index) => rank.set(objectId, index));
  return [...ids].sort((a, b) => {
    const ra = rank.get(a);
    const rb = rank.get(b);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return Number(a) - Number(b);
  });
}

/** Same order as ``useUseGroups`` / ``use_group_object_order.json`` (silhouette distance to rep). */
function sortDisplayedIdsByUseGroupOrder(
  ids: string[],
  group: UseGroup,
  groupRowById: Map<UseGroup, UseGroupRow>
): string[] {
  const orderedIds = groupRowById.get(group)?.objectIds ?? [];
  if (orderedIds.length === 0) return [...ids].sort((a, b) => Number(a) - Number(b));
  const rank = new Map<string, number>();
  orderedIds.forEach((objectId, index) => rank.set(objectId, index));
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

function Test2() {
  const navigate = useNavigate();
  const [imageMode, setImageMode] = useState<ImageMode>("no_bg");
  const [objectIdSearch, setObjectIdSearch] = useState("");
  const [showOnlyBeforeYearZero, setShowOnlyBeforeYearZero] = useState(false);
  const [showOnlyWithPaletteData, setShowOnlyWithPaletteData] = useState(false);
  const [selectedManualGroupFilter, setSelectedManualGroupFilter] = useState<string | null>(null);
  const [selectedUseGroup, setSelectedUseGroup] = useState<UseGroup | null>(null);
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

  const silhouetteNeighborIdSet = useMemo(() => new Set(getAllShapeNeighborObjectIds()), []);

  const objectIds = useMemo(() => {
    return baseObjectIds.filter((id) => silhouetteNeighborIdSet.has(id));
  }, [baseObjectIds, silhouetteNeighborIdSet]);

  const { groupRowById } = useUseGroups();
  const objectIdUniverseSet = useMemo(() => new Set(objectIds), [objectIds]);
  const useGroupObjectCountInView = useMemo(() => {
    const counts = new Map<UseGroup, number>();
    for (const group of USE_GROUPS_IN_DISPLAY_ORDER) {
      const row = groupRowById.get(group);
      let n = 0;
      for (const id of row?.objectIds ?? []) {
        if (objectIdUniverseSet.has(id)) n += 1;
      }
      counts.set(group, n);
    }
    return counts;
  }, [groupRowById, objectIdUniverseSet]);

  const selectedUseGroupIdSet = useMemo(() => {
    if (selectedUseGroup == null) return null;
    const row = groupRowById.get(selectedUseGroup);
    const set = new Set<string>();
    for (const id of row?.objectIds ?? []) {
      if (objectIdUniverseSet.has(id)) set.add(id);
    }
    return set;
  }, [selectedUseGroup, groupRowById, objectIdUniverseSet]);

  const objectFieldMetaById = useMemo(() => buildFieldsMetaByObjectId(), []);
  const objectModalFieldsById = useObjectModalMetadata();
  const objectColorMetaById = useMemo(() => buildColorMetaByObjectId(), []);

  const normalizedObjectIdSearch = objectIdSearch.trim();
  const displayedObjectIds = useMemo(() => {
    const filtered = objectIds
      .filter((objectId) => {
        if (normalizedObjectIdSearch && objectId !== normalizedObjectIdSearch) return false;
        if (!showOnlyBeforeYearZero) return true;
        const rawDate = objectFieldMetaById.get(objectId)?.date ?? "";
        const numericDate = Number(rawDate);
        const passesDateFilter = Number.isFinite(numericDate) && numericDate < 0;
        if (!passesDateFilter) return false;
        return true;
      })
      .filter((objectId) => {
        if (!showOnlyWithPaletteData) return true;
        const colorMeta = objectColorMetaById.get(objectId);
        return (colorMeta?.colorgramPaletteHex.length ?? 0) > 0;
      })
      .filter((objectId) =>
        objectMatchesManualGroupFilter(objectId, selectedManualGroupFilter, colorGroupFilterIdSets)
      )
      .filter((objectId) => {
        if (selectedUseGroupIdSet == null) return true;
        return selectedUseGroupIdSet.has(objectId);
      });
    if (selectedManualGroupFilter != null) {
      return sortDisplayedIdsByColorGroupOrder(filtered, selectedManualGroupFilter);
    }
    if (selectedUseGroup != null) {
      return sortDisplayedIdsByUseGroupOrder(filtered, selectedUseGroup, groupRowById);
    }
    return [...filtered].sort((a, b) => Number(a) - Number(b));
  }, [
    groupRowById,
    objectColorMetaById,
    objectFieldMetaById,
    objectIds,
    normalizedObjectIdSearch,
    selectedManualGroupFilter,
    selectedUseGroup,
    selectedUseGroupIdSet,
    showOnlyBeforeYearZero,
    showOnlyWithPaletteData
  ]);

  const hasNoSearchResult = normalizedObjectIdSearch.length > 0 && displayedObjectIds.length === 0;
  const closestNeighbors = useMemo(() => {
    if (!selectedObjectId) return [];
    return getShapeNeighborsForObject(selectedObjectId)?.neighbors20 ?? [];
  }, [selectedObjectId]);

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
                  weightedTotal > 0
                    ? (share / weightedTotal) * 100
                    : 100 / Math.max(1, colors.length);
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
        <p
          style={{ margin: "0 0 0.55rem 0", fontSize: "0.72rem", color: "#777", lineHeight: 1.35 }}
        >
          Use group and new regrouped color group filters can both apply. Counts are objects in this
          view (silhouette neighbors) that match each bucket.
        </p>
        <div
          style={{
            marginBottom: "0.65rem",
            paddingBottom: "0.65rem",
            borderBottom: "1px solid #2a2a2a"
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
              New regrouped color groups
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
              All color groups
            </button>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              {selectedManualGroupFilter == null
                ? "no color filter"
                : `match: ${colorGroupFilterOptionById.get(selectedManualGroupFilter)?.label ?? selectedManualGroupFilter} (${colorGroupFilterIdSets.get(selectedManualGroupFilter)?.size ?? 0} ids)`}
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
            {newColorGroupOptions.map((option) => {
              const count = colorGroupFilterIdSets.get(option.id)?.size ?? 0;
              const active = selectedManualGroupFilter === option.id;
              const label = `${option.label} (${count})`;
              return (
                <button
                  key={`new-color-group-${option.id}`}
                  type="button"
                  aria-pressed={active}
                  title={option.name}
                  onClick={() => {
                    const next = selectedManualGroupFilter === option.id ? null : option.id;
                    setSelectedManualGroupFilter(next);
                  }}
                  style={{
                    border: active ? "1px solid #9df" : "1px solid #444",
                    borderRadius: "6px",
                    background: active ? "rgba(120, 200, 255, 0.16)" : "#141414",
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
            <span style={{ fontSize: "0.85rem", color: "#ccc", fontWeight: 600 }}>Use group</span>
            <button
              type="button"
              onClick={() => setSelectedUseGroup(null)}
              disabled={selectedUseGroup == null}
              style={{
                border: "1px solid #666",
                borderRadius: "6px",
                background: selectedUseGroup == null ? "#1a1a1a" : "#222",
                color: selectedUseGroup == null ? "#666" : "#fff",
                padding: "0.2rem 0.45rem",
                fontSize: "0.75rem",
                cursor: selectedUseGroup == null ? "default" : "pointer"
              }}
            >
              All uses
            </button>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              {selectedUseGroup == null
                ? "no use filter"
                : `match: ${USE_GROUP_LABEL[selectedUseGroup]} (${selectedUseGroupIdSet?.size ?? 0} in view)`}
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
            {USE_GROUPS_IN_DISPLAY_ORDER.map((group) => {
              const count = useGroupObjectCountInView.get(group) ?? 0;
              const active = selectedUseGroup === group;
              const label = `${USE_GROUP_LABEL[group]} (${count})`;
              return (
                <button
                  key={`use-group-${group}`}
                  type="button"
                  aria-pressed={active}
                  title={group}
                  onClick={() => {
                    setSelectedUseGroup(active ? null : group);
                  }}
                  style={{
                    border: active ? "1px solid #8f8" : "1px solid #444",
                    borderRadius: "6px",
                    background: active ? "rgba(140, 220, 160, 0.14)" : "#141414",
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
                Closest Neighbors (Top 10)
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
              Precomputed neighbors (
              <code style={{ fontSize: "0.78rem" }}>shape_neighbors_euclidean.json</code>) — same
              weighted silhouette pipeline (median-imputed, standardized).
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
                  key={`${selectedObjectId}-${neighbor.neighborId}`}
                  style={{ margin: 0, width: "210px", maxWidth: "210px" }}
                >
                  <div
                    onClick={() => handleImageClick(neighbor.neighborId)}
                    style={{
                      background: modalImageMode === "no_bg" ? "transparent" : "#000",
                      aspectRatio: "1 / 1",
                      position: "relative",
                      cursor: "pointer"
                    }}
                  >
                    {renderModeImage(neighbor.neighborId, modalImageMode)}
                  </div>
                  <figcaption style={{ marginTop: "0.5rem", color: "#fff", fontSize: "0.8rem" }}>
                    <div style={{ fontWeight: 700 }}>Neighbor #{index + 1}</div>
                    <div>Object ID: {neighbor.neighborId}</div>
                    <div>Title: {getObjectTitle(neighbor.neighborId)}</div>
                    <div>
                      Date: {objectFieldMetaById.get(neighbor.neighborId)?.date ?? "Unknown"}
                    </div>
                    <div>
                      Location:{" "}
                      {objectFieldMetaById.get(neighbor.neighborId)?.location ?? "Unknown"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "0.35rem"
                      }}
                    >
                      <span style={{ color: "#9a9a9a" }}>Chronology:</span>
                      <ChronologySpanGlyph
                        corpusMin={corpusYearMin}
                        corpusMax={corpusYearMax}
                        anchorYear={parseFinalDateYear(
                          objectModalFieldsById.get(selectedObjectId ?? "")?.finalDate ?? ""
                        )}
                        neighborYear={parseFinalDateYear(
                          objectModalFieldsById.get(neighbor.neighborId)?.finalDate ?? ""
                        )}
                        neighborFinalDate={
                          objectModalFieldsById.get(neighbor.neighborId)?.finalDate ?? ""
                        }
                      />
                    </div>
                    <div>
                      {formatPlaceVsAnchorSentence(
                        objectModalFieldsById.get(selectedObjectId ?? ""),
                        objectModalFieldsById.get(neighbor.neighborId)
                      )}
                    </div>
                    {renderPaletteStrips(neighbor.neighborId, 9)}
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
