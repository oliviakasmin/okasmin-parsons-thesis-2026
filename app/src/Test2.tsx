import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import manualRejectObjectIds from "../../fetch_data/data/manual_reject_object_ids.json";
import objectsData from "../../fetch_data/data/objects.json";

const S3_IMAGE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

type ImageMode = "mask" | "no_bg" | "outline";

const IMAGE_SUFFIX: Record<ImageMode, string> = {
  mask: "mask",
  no_bg: "no_bg",
  outline: "outline"
};
const SELECTED_OBJECT_IDS_STORAGE_KEY = "test2_selected_object_ids";
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
  return `${objectId}_${IMAGE_SUFFIX[mode]}.png`;
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

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function Test2() {
  const navigate = useNavigate();
  const [imageMode, setImageMode] = useState<ImageMode>("mask");
  const [, setSelectedObjectIds] = useState<string[]>(() => loadSelectedObjectIdsFromStorage());
  const [missingImageNames, setMissingImageNames] = useState<Record<string, true>>({});
  const loggedMissingImageNamesRef = useRef<Set<string>>(new Set());
  const objectIds = useMemo(() => {
    return Array.from(objectTitleById.keys())
      .filter((objectId) => !manualRejectObjectIdSet.has(objectId))
      .sort((a, b) => Number(a) - Number(b));
  }, []);

  const handleImageError = (objectId: string, mode: ImageMode, imageName: string) => {
    if (!loggedMissingImageNamesRef.current.has(imageName)) {
      loggedMissingImageNamesRef.current.add(imageName);
      console.log(imageName);
      if (mode === "mask") {
        console.log(objectId);
      }
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
          Showing {objectIds.length} objects
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
      </div>

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

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px"
        }}
      >
        {objectIds.map((objectId) => {
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
    </main>
  );
}

export default Test2;
