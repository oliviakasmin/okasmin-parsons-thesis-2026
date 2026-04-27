import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import finalClusterKeysCsv from "../../../../process_data/cluster/final_clusters_keys.csv?raw";
import finalClusterObjectIdsCsv from "../../../../process_data/cluster/final_clusters_object_ids.csv?raw";

type ClusterRow = {
  cluster: string;
  clusterType: string;
  allObjectIds: string[];
  closestTop5Ids: string[];
};

const S3_REAL_IMAGES_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

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

function toOutlineImageMap(objectIds: string[]) {
  const imageMap = new Map<string, string>();
  for (const objectId of objectIds) {
    imageMap.set(objectId, `${S3_REAL_IMAGES_BASE_URL}/${objectId}_outline.png`);
  }
  return imageMap;
}

function clusterNumber(clusterId: string) {
  const match = clusterId.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function buildClusters(keysCsv: string, objectIdsCsv: string) {
  const objectIdsByCluster = new Map<string, string[]>();
  const objectIdLines = objectIdsCsv.split(/\r?\n/).filter(Boolean);

  for (const line of objectIdLines.slice(1)) {
    const [objectId, cluster] = parseCsvLine(line);
    if (!cluster || !objectId) continue;
    const existing = objectIdsByCluster.get(cluster) ?? [];
    existing.push(objectId);
    objectIdsByCluster.set(cluster, existing);
  }

  const rows: ClusterRow[] = [];
  const keyLines = keysCsv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(keyLines[0]);
  const clusterIdx = header.indexOf("cluster");
  const clusterTypeIdx = header.indexOf("cluster_type");
  const closest1Idx = header.indexOf("closest_object_id_1");
  const closest2Idx = header.indexOf("closest_object_id_2");
  const closest3Idx = header.indexOf("closest_object_id_3");
  const closest4Idx = header.indexOf("closest_object_id_4");
  const closest5Idx = header.indexOf("closest_object_id_5");

  for (const line of keyLines.slice(1)) {
    const cells = parseCsvLine(line);
    const cluster = cells[clusterIdx];
    if (!cluster) continue;
    rows.push({
      cluster,
      clusterType: cells[clusterTypeIdx] ?? "unknown",
      allObjectIds: objectIdsByCluster.get(cluster) ?? [],
      closestTop5Ids: [
        cells[closest1Idx],
        cells[closest2Idx],
        cells[closest3Idx],
        cells[closest4Idx],
        cells[closest5Idx]
      ].filter(Boolean)
    });
  }

  return rows.sort((a, b) => clusterNumber(a.cluster) - clusterNumber(b.cluster));
}

function defaultStackOpacity(clusterSize: number) {
  return Math.min(1, Math.max(0.1, 1 / Math.max(18, clusterSize)));
}

function ClusterTest() {
  const navigate = useNavigate();
  const [stackControlsByCluster, setStackControlsByCluster] = useState<
    Record<string, { opacity: number; brightness: number }>
  >({});
  const clusterRows = useMemo(
    () => buildClusters(finalClusterKeysCsv, finalClusterObjectIdsCsv),
    []
  );
  const outlineImageByObjectId = useMemo(
    () =>
      toOutlineImageMap(
        Array.from(new Set(clusterRows.flatMap((clusterRow) => clusterRow.allObjectIds)))
      ),
    [clusterRows]
  );

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
            // borderRadius: "6px",
            background: "#fff",
            color: "#000",
            padding: "0.35rem 0.6rem",
            cursor: "pointer",
            fontWeight: 700
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => navigate("/shelf")}
          style={{
            border: "1px solid #fff",
            background: "#fff",
            color: "#000",
            padding: "0.35rem 0.6rem",
            cursor: "pointer",
            fontWeight: 700
          }}
        >
          Shelf
        </button>
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Cluster Outlines</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {clusterRows.map((clusterRow) => (
          <section
            key={clusterRow.cluster}
            style={{
              border: "1px solid #333",
              //   borderRadius: "10px",
              padding: "0.75rem"
              //   background: "#111"
            }}
          >
            <div
              style={{ marginBottom: "0.55rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}
            >
              <strong>{clusterRow.cluster}</strong>
              <span style={{ color: "#bbb", fontSize: "0.9rem" }}>
                {clusterRow.clusterType} - {clusterRow.allObjectIds.length} objects
              </span>
            </div>
            <div
              style={{
                marginBottom: "0.65rem",
                display: "flex",
                gap: "0.9rem",
                alignItems: "center",
                flexWrap: "wrap"
              }}
            >
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "12px" }}
              >
                <span style={{ color: "#ddd" }}>Stack opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={
                    stackControlsByCluster[clusterRow.cluster]?.opacity ??
                    defaultStackOpacity(clusterRow.allObjectIds.length)
                  }
                  onChange={(event) => {
                    const opacity = Number(event.target.value);
                    setStackControlsByCluster((previous) => ({
                      ...previous,
                      [clusterRow.cluster]: {
                        opacity,
                        brightness: previous[clusterRow.cluster]?.brightness ?? 1
                      }
                    }));
                  }}
                />
                <span style={{ color: "#aaa", minWidth: "36px" }}>
                  {(
                    stackControlsByCluster[clusterRow.cluster]?.opacity ??
                    defaultStackOpacity(clusterRow.allObjectIds.length)
                  ).toFixed(2)}
                </span>
              </label>
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "12px" }}
              >
                <span style={{ color: "#ddd" }}>Brightness</span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.01"
                  value={stackControlsByCluster[clusterRow.cluster]?.brightness ?? 1}
                  onChange={(event) => {
                    const brightness = Number(event.target.value);
                    setStackControlsByCluster((previous) => ({
                      ...previous,
                      [clusterRow.cluster]: {
                        opacity:
                          previous[clusterRow.cluster]?.opacity ??
                          defaultStackOpacity(clusterRow.allObjectIds.length),
                        brightness
                      }
                    }));
                  }}
                />
                <span style={{ color: "#aaa", minWidth: "36px" }}>
                  {(stackControlsByCluster[clusterRow.cluster]?.brightness ?? 1).toFixed(2)}
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setStackControlsByCluster((previous) => ({
                    ...previous,
                    [clusterRow.cluster]: {
                      opacity: defaultStackOpacity(clusterRow.allObjectIds.length),
                      brightness: 1
                    }
                  }));
                }}
                style={{
                  border: "1px solid #fff",
                  background: "#fff",
                  color: "#000",
                  padding: "0.2rem 0.55rem",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600
                }}
              >
                Reset
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(140px, 1fr))",
                gap: "10px"
              }}
            >
              <figure style={{ margin: 0 }}>
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    position: "relative",
                    background: "#000",
                    // border: "1px solid #333",
                    // borderRadius: "8px",
                    overflow: "hidden",
                    filter: `brightness(${
                      stackControlsByCluster[clusterRow.cluster]?.brightness ?? 1
                    })`
                  }}
                >
                  {clusterRow.allObjectIds.map((objectId) => {
                    const imageSrc = outlineImageByObjectId.get(objectId);
                    if (!imageSrc) return null;
                    return (
                      <img
                        key={`${clusterRow.cluster}-stack-${objectId}`}
                        src={imageSrc}
                        alt={`${objectId}_outline.png`}
                        loading="lazy"
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          opacity:
                            stackControlsByCluster[clusterRow.cluster]?.opacity ??
                            defaultStackOpacity(clusterRow.allObjectIds.length)
                        }}
                      />
                    );
                  })}
                </div>
                <figcaption style={{ marginTop: "6px", fontSize: "11px", color: "#ddd" }}>
                  Stacked all
                </figcaption>
              </figure>

              {clusterRow.closestTop5Ids.map((objectId, index) => {
                const imageSrc = outlineImageByObjectId.get(objectId);
                return (
                  <figure
                    key={`${clusterRow.cluster}-closest-${objectId}-${index}`}
                    style={{ margin: 0 }}
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        background: "#000",
                        // border: "1px solid #333",
                        // borderRadius: "8px",
                        overflow: "hidden",
                        display: "grid",
                        placeItems: "center",
                        filter: `brightness(${
                          stackControlsByCluster[clusterRow.cluster]?.brightness ?? 1
                        })`
                      }}
                    >
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={`${objectId}_outline.png`}
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block"
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#777",
                            textAlign: "center",
                            padding: "6px"
                          }}
                        >
                          Missing outline
                        </span>
                      )}
                    </div>
                    <figcaption style={{ marginTop: "6px", fontSize: "11px", color: "#ddd" }}>
                      Closest {index + 1}: {objectId}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export default ClusterTest;
