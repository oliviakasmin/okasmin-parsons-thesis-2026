import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import manualRejectObjectIds from "../../../../fetch_data/data/manual_reject_object_ids.json";
import objectsData from "../../../../fetch_data/data/objects.json";
import fieldsCsvRaw from "../../../../format_data/generated/fields.csv?raw";
import silhouetteFeaturesCsvRaw from "../../../../process_data/features/silhouette_features.csv?raw";
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

const IMAGE_SUFFIX: Record<ImageMode, string> = {
  mask: "mask",
  no_bg: "no_bg",
  outline: "outline"
};
const SELECTED_OBJECT_IDS_STORAGE_KEY = "test2_selected_object_ids";
const NEIGHBOR_COUNT = 10;
const FEATURE_WEIGHTS = {
  lr: 1.0,
  tb: 0.2,
  shape: 1.0,
  inner: 0.8,
  innerCount: 0.5
} as const;

const manualRejectObjectIdSet = new Set(manualRejectObjectIds.map((objectId) => String(objectId)));
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

function loadSelectedObjectIdsFromStorage() {
  try {
    const raw = window.localStorage.getItem(SELECTED_OBJECT_IDS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
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
  const [imageMode, setImageMode] = useState<ImageMode>("mask");
  const [objectIdSearch, setObjectIdSearch] = useState("");
  const [showOnlyBeforeYearZero, setShowOnlyBeforeYearZero] = useState(false);
  const [, setSelectedObjectIds] = useState<string[]>(() => loadSelectedObjectIdsFromStorage());
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [modalImageMode, setModalImageMode] = useState<ImageMode>("mask");
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

  const normalizedObjectIdSearch = objectIdSearch.trim();
  const displayedObjectIds = useMemo(() => {
    return objectIds.filter((objectId) => {
      if (normalizedObjectIdSearch && objectId !== normalizedObjectIdSearch) return false;
      if (!showOnlyBeforeYearZero) return true;
      const rawDate = objectFieldMetaById.get(objectId)?.date ?? "";
      const numericDate = Number(rawDate);
      return Number.isFinite(numericDate) && numericDate < 0;
    });
  }, [objectFieldMetaById, objectIds, normalizedObjectIdSearch, showOnlyBeforeYearZero]);

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
    setSelectedObjectIds((previousIds) => {
      if (previousIds.includes(objectId)) {
        console.log("Selected object IDs:", previousIds);
        return previousIds;
      }
      const nextIds = [...previousIds, objectId];
      window.localStorage.setItem(SELECTED_OBJECT_IDS_STORAGE_KEY, JSON.stringify(nextIds));
      console.log("Selected object IDs:", nextIds);
      return nextIds;
    });
    setModalImageMode("mask");
    setSelectedObjectId(objectId);
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
          gap: "0.4rem",
          marginBottom: "0.75rem",
          pointerEvents: "none"
        }}
      >
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
