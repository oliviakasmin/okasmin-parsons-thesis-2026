import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import manualRejectObjectIds from "../../pipeline/data/manual_reject_object_ids.json";
import objectsData from "../../pipeline/data/objects.json";

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

const maskImageModules = import.meta.glob("../../hf_space/pipeline/real_images/*_mask.png", {
  eager: true,
  import: "default"
}) as Record<string, string>;
const noBgImageModules = import.meta.glob("../../hf_space/pipeline/real_images/*_no_bg.png", {
  eager: true,
  import: "default"
}) as Record<string, string>;
const outlineImageModules = import.meta.glob("../../hf_space/pipeline/real_images/*_outline.png", {
  eager: true,
  import: "default"
}) as Record<string, string>;

function objectIdFromPath(path: string, mode: ImageMode) {
  const suffix = `_${IMAGE_SUFFIX[mode]}.png`;
  const filename = path.split("/").pop() ?? "";
  if (!filename.endsWith(suffix)) {
    return null;
  }
  return filename.slice(0, -suffix.length);
}

function toImageMap(modules: Record<string, string>, mode: ImageMode) {
  const imageMap = new Map<string, string>();
  for (const [path, src] of Object.entries(modules)) {
    const objectId = objectIdFromPath(path, mode);
    if (!objectId) {
      continue;
    }
    imageMap.set(objectId, src);
  }
  return imageMap;
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

function Test2() {
  const navigate = useNavigate();
  const [imageMode, setImageMode] = useState<ImageMode>("mask");
  const [, setSelectedObjectIds] = useState<string[]>(() => loadSelectedObjectIdsFromStorage());

  const imageMaps = useMemo(
    () => ({
      mask: toImageMap(maskImageModules, "mask"),
      no_bg: toImageMap(noBgImageModules, "no_bg"),
      outline: toImageMap(outlineImageModules, "outline")
    }),
    []
  );
  const objectIds = useMemo(() => {
    const allIds = new Set<string>();
    for (const id of imageMaps.mask.keys()) allIds.add(id);
    for (const id of imageMaps.no_bg.keys()) allIds.add(id);
    for (const id of imageMaps.outline.keys()) allIds.add(id);
    return Array.from(allIds)
      .filter((objectId) => !manualRejectObjectIdSet.has(objectId))
      .sort((a, b) => Number(a) - Number(b));
  }, [imageMaps]);

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

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px"
        }}
      >
        {objectIds.map((objectId) => (
          <figure
            key={objectId}
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
              {imageMaps[imageMode].get(objectId) ? (
                <img
                  src={imageMaps[imageMode].get(objectId)}
                  alt={`${objectId}_${IMAGE_SUFFIX[imageMode]}.png`}
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
        ))}
      </section>
    </main>
  );
}

export default Test2;
