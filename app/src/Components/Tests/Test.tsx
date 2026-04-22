import { useState } from "react";
import manualRejectObjectIds from "../../../../fetch_data/data/manual_reject_object_ids.json";
import objectsData from "../../../../fetch_data/data/objects.json";
import clustersData from "../../../../test_assets/clusters.json";
import interestingMatchesData from "../../../../test_assets/most_interesting_matches.json";
import manualInterestingOnesData from "../../../../test_assets/manual_interesting_ones.json";

const S3_IMAGE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/images";
const S3_OUTLINE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/outline_images/outline_images";
const rejectObjectIdSet = new Set(manualRejectObjectIds.map(String));
const objectMetaById = new Map(
  Object.entries(
    objectsData as Record<
      string,
      {
        objectID?: number;
        title?: string;
        objectDate?: string;
        department?: string;
        culture?: string;
      }
    >
  ).map(([objectIdKey, value]) => [String(value.objectID ?? objectIdKey), value])
);
const objectIdToClusterId = new Map<string, number>();
for (const cluster of clustersData.clusters) {
  for (const objectId of cluster.object_ids) {
    objectIdToClusterId.set(String(objectId), cluster.cluster_id);
  }
}
const interestingMatchesByInputId = (
  interestingMatchesData as {
    results: Record<
      string,
      {
        closest_shape: string | null;
        furthest_date: string | null;
        closest_different_culture: string | null;
        closest_different_department: string | null;
      }
    >;
  }
).results;
const manualInterestingObjectIds = Array.from(
  new Set((manualInterestingOnesData as Array<string | number>).map((value) => String(value)))
);
type ImageViewMode = "mask_white" | "outline" | "no_bg";

function buildImageUrl(filename: string) {
  return `${S3_IMAGE_BASE_URL}/${filename}`;
}

function buildOutlineUrl(filename: string) {
  return `${S3_OUTLINE_BASE_URL}/${filename}`;
}

function getImageEntryByObjectId(objectId: string) {
  const maskFilename = `${objectId}_mask_standardized.png`;
  const noBgFilename = `${objectId}_no_bg_standardized.png`;
  const outlineFilename = `${objectId}_outline.png`;
  return {
    objectId,
    maskFilename,
    noBgFilename,
    outlineFilename,
    maskSrc: buildImageUrl(maskFilename),
    noBgSrc: buildImageUrl(noBgFilename),
    outlineSrc: buildOutlineUrl(outlineFilename)
  };
}

function isMaskViewMode(mode: ImageViewMode) {
  return mode === "mask_white";
}

function isOutlineViewMode(mode: ImageViewMode) {
  return mode === "outline";
}

function getObjectMeta(objectId: string) {
  const fallback = {
    title: "Unknown",
    objectDate: "Unknown",
    department: "Unknown",
    culture: "Unknown"
  };
  return objectMetaById.get(objectId) ?? fallback;
}

const processedObjectIds = Array.from(objectIdToClusterId.keys());
const maskEntries = processedObjectIds
  .map((objectId) => getImageEntryByObjectId(objectId))
  .filter((entry) => !rejectObjectIdSet.has(entry.objectId))
  .sort((a, b) => a.maskFilename.localeCompare(b.maskFilename));
const maskEntryByObjectId = new Map(maskEntries.map((entry) => [entry.objectId, entry]));

function Test() {
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string>("all");
  const [selectedUniqueFilter, setSelectedUniqueFilter] = useState<string>("all");
  const [gridImageViewMode, setGridImageViewMode] = useState<ImageViewMode>("mask_white");
  const [modalImageViewMode, setModalImageViewMode] = useState<ImageViewMode>("mask_white");
  const [showGridCaptions, setShowGridCaptions] = useState(false);
  const [showModalCaptions, setShowModalCaptions] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const selectedEntry = selectedObjectId ? getImageEntryByObjectId(selectedObjectId) : null;
  const selectedInterestingMatches = selectedObjectId
    ? (interestingMatchesByInputId[selectedObjectId] ?? null)
    : null;
  const matchCards = [
    {
      key: "closest_shape",
      label: "Closest Shape",
      objectId: selectedInterestingMatches?.closest_shape ?? null
    },
    {
      key: "furthest_date",
      label: "Furthest Date",
      objectId: selectedInterestingMatches?.furthest_date ?? null
    },
    {
      key: "closest_different_culture",
      label: "Different Culture",
      objectId: selectedInterestingMatches?.closest_different_culture ?? null
    },
    {
      key: "closest_different_department",
      label: "Different Department",
      objectId: selectedInterestingMatches?.closest_different_department ?? null
    }
  ];
  const visibleMatchCards = matchCards.filter(
    (matchCard): matchCard is { key: string; label: string; objectId: string } =>
      Boolean(matchCard.objectId)
  );
  const modalCardWidthPx = 210;
  const modalCardGapPx = 12;
  const modalMatchCount = Math.max(1, visibleMatchCards.length);
  const modalTargetWidthPx = Math.min(
    1280,
    Math.max(520, modalMatchCount * modalCardWidthPx + (modalMatchCount - 1) * modalCardGapPx + 48)
  );
  const visibleMaskEntries =
    selectedUniqueFilter === "manual_interesting"
      ? manualInterestingObjectIds
          .map((objectId) => maskEntryByObjectId.get(objectId))
          .filter((entry): entry is (typeof maskEntries)[number] => Boolean(entry))
          .filter((entry) => {
            if (selectedClusterId === "all") {
              return true;
            }
            return String(objectIdToClusterId.get(entry.objectId)) === selectedClusterId;
          })
      : maskEntries.filter((entry) => {
          if (selectedClusterId === "all") {
            return true;
          }
          return String(objectIdToClusterId.get(entry.objectId)) === selectedClusterId;
        });

  const openModalForObject = (objectId: string) => {
    setModalImageViewMode("mask_white");
    setSelectedObjectId(objectId);
  };

  return (
    <main style={{ padding: "1rem", backgroundColor: "#000", color: "#fff", minHeight: "100vh" }}>
      <h1 style={{ margin: "0 0 0.25rem 0" }}>Test Images</h1>
      <div
        style={{
          margin: "0 0 0.75rem 0",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap"
        }}
      >
        <label htmlFor="cluster-filter" style={{ color: "#fff", fontSize: "0.9rem" }}>
          Cluster:
        </label>
        <select
          id="cluster-filter"
          value={selectedClusterId}
          onChange={(event) => setSelectedClusterId(event.target.value)}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: "#fff",
            padding: "0.35rem 0.5rem",
            color: "#000"
          }}
        >
          <option value="all">All items</option>
          {clustersData.clusters.map((cluster) => (
            <option key={cluster.cluster_id} value={String(cluster.cluster_id)}>
              Cluster {cluster.cluster_id} ({cluster.size})
            </option>
          ))}
        </select>

        <label
          htmlFor="unique-filter"
          style={{ color: "#fff", fontSize: "0.9rem", marginLeft: "0.5rem" }}
        >
          Interesting:
        </label>
        <select
          id="unique-filter"
          value={selectedUniqueFilter}
          onChange={(event) => setSelectedUniqueFilter(event.target.value)}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: "#fff",
            padding: "0.35rem 0.5rem",
            color: "#000"
          }}
        >
          <option value="all">All objects</option>
          <option value="manual_interesting">
            good matches ({manualInterestingObjectIds.length})
          </option>
        </select>

        <span style={{ color: "#fff", fontSize: "0.9rem", marginLeft: "0.5rem" }}>View:</span>
        <button
          type="button"
          onClick={() => setGridImageViewMode("mask_white")}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: gridImageViewMode === "mask_white" ? "#fff" : "#000",
            color: gridImageViewMode === "mask_white" ? "#000" : "#fff",
            padding: "0.35rem 0.6rem",
            cursor: "pointer"
          }}
        >
          White Mask
        </button>
        <button
          type="button"
          onClick={() => setGridImageViewMode("outline")}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: gridImageViewMode === "outline" ? "#fff" : "#000",
            color: gridImageViewMode === "outline" ? "#000" : "#fff",
            padding: "0.35rem 0.6rem",
            cursor: "pointer"
          }}
        >
          Outline
        </button>
        <button
          type="button"
          onClick={() => setGridImageViewMode("no_bg")}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: gridImageViewMode === "no_bg" ? "#fff" : "#000",
            color: gridImageViewMode === "no_bg" ? "#000" : "#fff",
            padding: "0.35rem 0.6rem",
            cursor: "pointer"
          }}
        >
          BG Removed
        </button>
        <button
          type="button"
          onClick={() => setShowGridCaptions((value) => !value)}
          style={{
            border: "1px solid #fff",
            borderRadius: "6px",
            background: showGridCaptions ? "#fff" : "#000",
            color: showGridCaptions ? "#000" : "#fff",
            padding: "0.35rem 0.6rem",
            cursor: "pointer"
          }}
        >
          {showGridCaptions ? "Hide Captions" : "Show Captions"}
        </button>
        <button
          type="button"
          onClick={() => setShowAboutModal(true)}
          style={{
            marginLeft: "auto",
            border: "1px dashed #22d3ee",
            borderRadius: "6px",
            background: "#082f49",
            color: "#67e8f9",
            padding: "0.35rem 0.6rem",
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: "pointer"
          }}
        >
          About
        </button>
      </div>
      <p style={{ margin: "0 0 1rem 0", color: "#fff" }}>
        Showing {visibleMaskEntries.length} of {maskEntries.length} objects
        {isOutlineViewMode(gridImageViewMode)
          ? ""
          : ` (hover to reveal${isMaskViewMode(gridImageViewMode) ? " bg-removed image" : " mask image"})`}
      </p>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        {visibleMaskEntries.map((entry) => {
          const isHovered = hoveredObjectId === entry.objectId;
          const primarySrc =
            gridImageViewMode === "no_bg"
              ? (entry.noBgSrc ?? entry.maskSrc)
              : gridImageViewMode === "outline"
                ? entry.outlineSrc
                : entry.maskSrc;
          const primaryAlt =
            gridImageViewMode === "no_bg"
              ? entry.noBgFilename
              : gridImageViewMode === "outline"
                ? entry.outlineFilename
                : entry.maskFilename;
          const secondarySrc = isOutlineViewMode(gridImageViewMode)
            ? undefined
            : isMaskViewMode(gridImageViewMode)
              ? entry.noBgSrc
              : entry.maskSrc;
          const secondaryAlt = isOutlineViewMode(gridImageViewMode)
            ? ""
            : isMaskViewMode(gridImageViewMode)
              ? entry.noBgFilename
              : entry.maskFilename;

          return (
            <figure
              key={entry.maskFilename}
              style={{
                width: "160px",
                margin: 0,
                border: "none",
                borderRadius: "8px",
                background: "transparent",
                padding: "8px"
              }}
            >
              <div
                onMouseEnter={() => setHoveredObjectId(entry.objectId)}
                onMouseLeave={() => setHoveredObjectId(null)}
                onClick={() => openModalForObject(entry.objectId)}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  position: "relative",
                  backgroundColor:
                    isMaskViewMode(gridImageViewMode) || isOutlineViewMode(gridImageViewMode)
                      ? "#000"
                      : isHovered
                        ? "#000"
                        : "transparent",
                  cursor: "pointer"
                }}
              >
                <img
                  src={primarySrc}
                  alt={primaryAlt}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    position: "absolute",
                    inset: 0
                  }}
                />
                {secondarySrc ? (
                  <img
                    src={secondarySrc}
                    alt={secondaryAlt}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                      position: "absolute",
                      inset: 0,
                      opacity: isHovered ? 1 : 0,
                      transition: "opacity 120ms ease-out"
                    }}
                  />
                ) : null}
              </div>
              {showGridCaptions ? (
                <figcaption
                  style={{
                    marginTop: "6px",
                    fontSize: "11px",
                    lineHeight: 1.3,
                    color: "#fff",
                    overflowWrap: "anywhere"
                  }}
                >
                  <div>ID: {entry.objectId}</div>
                  <div>Title: {getObjectMeta(entry.objectId).title ?? "Unknown"}</div>
                  <div>Date: {getObjectMeta(entry.objectId).objectDate ?? "Unknown"}</div>
                  <div>Department: {getObjectMeta(entry.objectId).department ?? "Unknown"}</div>
                  <div>Culture: {getObjectMeta(entry.objectId).culture ?? "Unknown"}</div>
                </figcaption>
              ) : null}
            </figure>
          );
        })}
      </section>

      {showAboutModal ? (
        <div
          onClick={() => setShowAboutModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(0.5rem, 2vw, 1rem)",
            zIndex: 60
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(520px, calc(100vw - 1rem))",
              maxHeight: "calc(100vh - 1rem)",
              overflowY: "auto",
              background: "#000",
              color: "#fff",
              border: "1px solid #fff",
              borderRadius: "10px",
              padding: "clamp(0.75rem, 2.2vw, 1rem)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>About Clusters & Matches</h2>
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                aria-label="Close about modal"
                style={{
                  border: "1px solid #fff",
                  background: "#fff",
                  borderRadius: "6px",
                  width: "2rem",
                  height: "2rem",
                  color: "#000",
                  lineHeight: 1,
                  cursor: "pointer"
                }}
              >
                X
              </button>
            </div>
            <div style={{ marginTop: "0.75rem", fontSize: "16px", lineHeight: 1.45 }}>
              <p style={{ margin: "0 0 0.5rem 0" }}>
                <strong>Step 1 - Background Removal:</strong> Source images are processed with
                `briaai/RMBG-2.0` (`remove_background.py`). The image is resized to `1024x1024`,
                normalized with ImageNet mean/std, then a sigmoid mask is predicted and resized back
                to original size to produce RGBA foreground + grayscale mask.
              </p>
              <p style={{ margin: "0 0 0.5rem 0" }}>
                <strong>Step 2 - Crop + Standardize:</strong> Foreground is thresholded (`alpha{" "}
                {"\u003e="} 16`) and cropped to bbox (`crop_standardize.py`), then scaled with
                Lanczos onto a `768x768` transparent canvas with ~`2%` margin and bottom alignment
                to keep vessel placement consistent across objects.
              </p>
              <p style={{ margin: "0 0 0.5rem 0" }}>
                <strong>Input Features:</strong> Each vessel is represented by silhouette edge
                samples (`l1..lN`, `r1..rN`) extracted from standardized masks. Current extraction
                uses 64 sampled y-rows, so each vessel has 64 left + 64 right distances (128
                silhouette features total).
              </p>
              <p style={{ margin: "0 0 0.5rem 0" }}>
                <strong>Clustering Method:</strong> K-means (`k=20`, seed `42`) on z-scored features
                after missing-value imputation with column means. Clustering is run separately for
                symmetric vs. asymmetric vessels (symmetry threshold `0.03`), then merged for
                display.
              </p>
              <p style={{ margin: "0 0 0.5rem 0" }}>
                <strong>Cluster Distance/Confidence:</strong> Distance is Euclidean to centroid.
                Confidence is `1 / (1 + mean_distance_to_centroid)`, so tighter clusters rank higher
                confidence.
              </p>
              <p style={{ margin: "0 0 0.5rem 0" }}>
                <strong>Shape Match Distance:</strong> Matches use full-profile distance across the
                entire sampled y-axis. For each row: finite-vs-finite uses squared difference,
                finite-vs-missing adds a fixed penalty (`MISSING_ROW_PENALTY = 1.0`), and
                missing-vs-missing adds no penalty. Final score is `sqrt(sum)`.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Interesting Matches:</strong> For each object, compute top-k nearest shape
                candidates (`k=20`), then select: nearest shape, furthest date among candidates,
                nearest different culture, and nearest different department (excluding
                unknown/undefined metadata and already-used IDs).
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {selectedEntry ? (
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
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}
            >
              <h2 style={{ margin: 0, fontSize: "clamp(0.95rem, 2.8vw, 1rem)" }}>
                Silhouette Similarity
              </h2>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}
              >
                <span style={{ color: "#fff", fontSize: "0.85rem" }}>Modal view:</span>
                <button
                  type="button"
                  onClick={() => setModalImageViewMode("mask_white")}
                  style={{
                    border: "1px solid #fff",
                    borderRadius: "6px",
                    background: modalImageViewMode === "mask_white" ? "#fff" : "#000",
                    color: modalImageViewMode === "mask_white" ? "#000" : "#fff",
                    padding: "0.3rem 0.5rem",
                    cursor: "pointer"
                  }}
                >
                  White Mask
                </button>
                <button
                  type="button"
                  onClick={() => setModalImageViewMode("outline")}
                  style={{
                    border: "1px solid #fff",
                    borderRadius: "6px",
                    background: modalImageViewMode === "outline" ? "#fff" : "#000",
                    color: modalImageViewMode === "outline" ? "#000" : "#fff",
                    padding: "0.3rem 0.5rem",
                    cursor: "pointer"
                  }}
                >
                  Outline
                </button>
                <button
                  type="button"
                  onClick={() => setModalImageViewMode("no_bg")}
                  style={{
                    border: "1px solid #fff",
                    borderRadius: "6px",
                    background: modalImageViewMode === "no_bg" ? "#fff" : "#000",
                    color: modalImageViewMode === "no_bg" ? "#000" : "#fff",
                    padding: "0.3rem 0.5rem",
                    cursor: "pointer"
                  }}
                >
                  BG Removed
                </button>
                <button
                  type="button"
                  onClick={() => setShowModalCaptions((value) => !value)}
                  style={{
                    border: "1px solid #fff",
                    background: showModalCaptions ? "#fff" : "#000",
                    borderRadius: "6px",
                    padding: "0.35rem 0.6rem",
                    color: showModalCaptions ? "#000" : "#fff",
                    cursor: "pointer"
                  }}
                >
                  {showModalCaptions ? "Hide Captions" : "Show Captions"}
                </button>
              </div>
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

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
              <figure style={{ margin: 0, width: "210px", maxWidth: "210px" }}>
                <div
                  onMouseEnter={() => setHoveredObjectId(selectedEntry.objectId)}
                  onMouseLeave={() => setHoveredObjectId(null)}
                  onClick={() => openModalForObject(selectedEntry.objectId)}
                  style={{
                    background:
                      isMaskViewMode(modalImageViewMode) || isOutlineViewMode(modalImageViewMode)
                        ? "#000"
                        : hoveredObjectId === selectedEntry.objectId
                          ? "#000"
                          : "transparent",
                    aspectRatio: "1 / 1",
                    position: "relative",
                    cursor: "pointer"
                  }}
                >
                  {(
                    isMaskViewMode(modalImageViewMode)
                      ? selectedEntry.maskSrc
                      : isOutlineViewMode(modalImageViewMode)
                        ? selectedEntry.outlineSrc
                        : (selectedEntry.noBgSrc ?? selectedEntry.maskSrc)
                  ) ? (
                    <img
                      src={
                        isMaskViewMode(modalImageViewMode)
                          ? selectedEntry.maskSrc
                          : isOutlineViewMode(modalImageViewMode)
                            ? selectedEntry.outlineSrc
                            : (selectedEntry.noBgSrc ?? selectedEntry.maskSrc)
                      }
                      alt={
                        isMaskViewMode(modalImageViewMode)
                          ? selectedEntry.maskFilename
                          : isOutlineViewMode(modalImageViewMode)
                            ? selectedEntry.outlineFilename
                            : selectedEntry.noBgFilename
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        position: "absolute",
                        inset: 0
                      }}
                    />
                  ) : null}
                  {!isOutlineViewMode(modalImageViewMode) &&
                  (isMaskViewMode(modalImageViewMode)
                    ? selectedEntry.noBgSrc
                    : selectedEntry.maskSrc) ? (
                    <img
                      src={
                        isMaskViewMode(modalImageViewMode)
                          ? selectedEntry.noBgSrc
                          : selectedEntry.maskSrc
                      }
                      alt={
                        isMaskViewMode(modalImageViewMode)
                          ? selectedEntry.noBgFilename
                          : selectedEntry.maskFilename
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        position: "absolute",
                        inset: 0,
                        opacity: hoveredObjectId === selectedEntry.objectId ? 1 : 0,
                        transition: "opacity 120ms ease-out"
                      }}
                    />
                  ) : null}
                </div>
                {showModalCaptions ? (
                  <figcaption style={{ marginTop: "0.5rem", color: "#fff", fontSize: "0.8rem" }}>
                    <div style={{ fontWeight: 700 }}>Selected</div>
                    <div>Object ID: {selectedEntry.objectId}</div>
                    <div>Title: {getObjectMeta(selectedEntry.objectId).title ?? "Unknown"}</div>
                    <div>Date: {getObjectMeta(selectedEntry.objectId).objectDate ?? "Unknown"}</div>
                    <div>
                      Department: {getObjectMeta(selectedEntry.objectId).department ?? "Unknown"}
                    </div>
                    <div>Culture: {getObjectMeta(selectedEntry.objectId).culture ?? "Unknown"}</div>
                  </figcaption>
                ) : null}
              </figure>
              {visibleMatchCards.length > 0 ? (
                <figure style={{ margin: 0, width: "210px", maxWidth: "210px" }}>
                  <div
                    style={{
                      background:
                        isMaskViewMode(modalImageViewMode) || isOutlineViewMode(modalImageViewMode)
                          ? "#000"
                          : "transparent",
                      aspectRatio: "1 / 1",
                      position: "relative",
                      overflow: "hidden"
                    }}
                  >
                    {visibleMatchCards.map((matchCard, idx) => {
                      const matchEntry = getImageEntryByObjectId(matchCard.objectId);
                      const stackSrc = isMaskViewMode(modalImageViewMode)
                        ? matchEntry.maskSrc
                        : isOutlineViewMode(modalImageViewMode)
                          ? matchEntry.outlineSrc
                          : (matchEntry.noBgSrc ?? matchEntry.maskSrc);
                      const stackAlt = isMaskViewMode(modalImageViewMode)
                        ? matchEntry.maskFilename
                        : isOutlineViewMode(modalImageViewMode)
                          ? matchEntry.outlineFilename
                          : matchEntry.noBgFilename;
                      return (
                        <img
                          key={`${matchCard.key}-stack`}
                          src={stackSrc}
                          alt={stackAlt}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            position: "absolute",
                            inset: 0,
                            opacity: 1 / Math.max(visibleMatchCards.length, 1),
                            transform: `translate(${idx * 1.2}px, ${idx * 1.2}px)`,
                            pointerEvents: "none"
                          }}
                        />
                      );
                    })}
                  </div>
                  {showModalCaptions ? (
                    <figcaption style={{ marginTop: "0.5rem", color: "#fff", fontSize: "0.8rem" }}>
                      <div style={{ fontWeight: 700 }}>Stacked Matches</div>
                      <div>Count: {visibleMatchCards.length}</div>
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 210px))",
                justifyContent: "start",
                gap: "0.75rem",
                marginTop: "0.75rem"
              }}
            >
              {visibleMatchCards.map((matchCard) => {
                const matchEntry = getImageEntryByObjectId(matchCard.objectId);
                const emphasizeDate = matchCard.key === "furthest_date";
                const emphasizeCulture = matchCard.key === "closest_different_culture";
                const emphasizeDepartment = matchCard.key === "closest_different_department";

                return (
                  <figure
                    key={matchCard.key}
                    style={{ margin: 0, width: "210px", maxWidth: "210px" }}
                  >
                    <div
                      onMouseEnter={() => setHoveredObjectId(matchCard.objectId)}
                      onMouseLeave={() => setHoveredObjectId(null)}
                      onClick={() => openModalForObject(matchCard.objectId)}
                      style={{
                        background:
                          isMaskViewMode(modalImageViewMode) ||
                          isOutlineViewMode(modalImageViewMode)
                            ? "#000"
                            : hoveredObjectId === matchCard.objectId
                              ? "#000"
                              : "transparent",
                        aspectRatio: "1 / 1",
                        position: "relative",
                        cursor: "pointer"
                      }}
                    >
                      {(
                        isMaskViewMode(modalImageViewMode)
                          ? matchEntry?.maskSrc
                          : isOutlineViewMode(modalImageViewMode)
                            ? matchEntry?.outlineSrc
                            : (matchEntry?.noBgSrc ?? matchEntry?.maskSrc)
                      ) ? (
                        <img
                          src={
                            isMaskViewMode(modalImageViewMode)
                              ? matchEntry?.maskSrc
                              : isOutlineViewMode(modalImageViewMode)
                                ? matchEntry?.outlineSrc
                                : (matchEntry?.noBgSrc ?? matchEntry?.maskSrc)
                          }
                          alt={
                            isMaskViewMode(modalImageViewMode)
                              ? matchEntry?.maskFilename
                              : isOutlineViewMode(modalImageViewMode)
                                ? matchEntry?.outlineFilename
                                : matchEntry?.noBgFilename
                          }
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            position: "absolute",
                            inset: 0
                          }}
                        />
                      ) : null}
                      {!isOutlineViewMode(modalImageViewMode) &&
                      (isMaskViewMode(modalImageViewMode)
                        ? matchEntry?.noBgSrc
                        : matchEntry?.maskSrc) ? (
                        <img
                          src={
                            isMaskViewMode(modalImageViewMode)
                              ? matchEntry?.noBgSrc
                              : matchEntry?.maskSrc
                          }
                          alt={
                            isMaskViewMode(modalImageViewMode)
                              ? matchEntry?.noBgFilename
                              : matchEntry?.maskFilename
                          }
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            position: "absolute",
                            inset: 0,
                            opacity: hoveredObjectId === matchCard.objectId ? 1 : 0,
                            transition: "opacity 120ms ease-out"
                          }}
                        />
                      ) : null}
                    </div>
                    {showModalCaptions ? (
                      <figcaption
                        style={{ marginTop: "0.5rem", color: "#fff", fontSize: "0.8rem" }}
                      >
                        <div style={{ fontWeight: 700 }}>{matchCard.label}</div>
                        <div>Object ID: {matchCard.objectId}</div>
                        <div>Title: {getObjectMeta(matchCard.objectId).title ?? "Unknown"}</div>
                        <div style={emphasizeDate ? { fontWeight: 700 } : undefined}>
                          Date: {getObjectMeta(matchCard.objectId).objectDate ?? "Unknown"}
                        </div>
                        <div style={emphasizeDepartment ? { fontWeight: 700 } : undefined}>
                          Department: {getObjectMeta(matchCard.objectId).department ?? "Unknown"}
                        </div>
                        <div style={emphasizeCulture ? { fontWeight: 700 } : undefined}>
                          Culture: {getObjectMeta(matchCard.objectId).culture ?? "Unknown"}
                        </div>
                      </figcaption>
                    ) : null}
                  </figure>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default Test;
