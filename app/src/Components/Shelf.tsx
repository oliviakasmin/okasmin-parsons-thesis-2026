import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import finalClusterKeysCsv from "../../../process_data/cluster/final_clusters_keys.csv?raw";
import finalClusterObjectIdsCsv from "../../../process_data/cluster/final_clusters_object_ids.csv?raw";
import BackButton from "./BackButton";
import ImageToggleButton from "./ImageToggleButton";
import useImageToggle from "../hooks/useImageToggle";
import useImageModules from "../hooks/useImageModules";
import useFormatClusters, { type ClusterRow } from "../hooks/useFormatClusters";
import { SHELF_RENDER_IMAGE_SIZE_PX } from "./constants";

const cluster0 = "cluster_0";
const cluster1 = "cluster_1";
const cluster2 = "cluster_2";
const cluster3 = "cluster_3";
const cluster4 = "cluster_4";
const cluster5 = "cluster_5";
const cluster6 = "cluster_6";
const cluster7 = "cluster_7";
const cluster8 = "cluster_8";
const cluster9 = "cluster_9";
const cluster10 = "cluster_10";
const cluster11 = "cluster_11";

// 10, 8, 6
// 5, 7, 3
// 4, 9, 11
// 0, 1, 2

const shelves = [
  [cluster10, cluster8, cluster6],
  [cluster5, cluster7, cluster3],
  [cluster4, cluster9, cluster11],
  [cluster0, cluster1, cluster2]
];

const defaultMaskImageByCluster = [
  { cluster: cluster0, index: 2 },
  { cluster: cluster1, index: 1 },
  { cluster: cluster2, index: 0 },
  { cluster: cluster3, index: 0 },
  { cluster: cluster4, index: 4 },
  { cluster: cluster5, index: 1 },
  { cluster: cluster6, index: 2 },
  { cluster: cluster7, index: 3 },
  { cluster: cluster8, index: 3 },
  { cluster: cluster9, index: 0 },
  { cluster: cluster10, index: 2 },
  { cluster: cluster11, index: 2 }
];

const defaultMaskIndexByCluster = new Map(
  defaultMaskImageByCluster.map((entry) => [entry.cluster, entry.index])
);

function defaultStackOpacity(clusterSize: number) {
  return Math.min(1, Math.max(0.1, 1 / Math.max(18, clusterSize)));
}

function Shelf() {
  const navigate = useNavigate();
  const { mode, options, setMode } = useImageToggle();
  const [solidIndexByCluster, setSolidIndexByCluster] = useState<Record<string, number>>({});
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);
  const { outlineImageByObjectId, maskImageByObjectId } = useImageModules();
  const { clusterRows } = useFormatClusters(finalClusterKeysCsv, finalClusterObjectIdsCsv);
  const orderedClusterRows = useMemo(() => {
    const byCluster = new Map(clusterRows.map((row) => [row.cluster, row]));
    return shelves.flatMap((row) =>
      row
        .map((clusterId) => byCluster.get(clusterId))
        .filter((value): value is ClusterRow => Boolean(value))
    );
  }, [clusterRows]);

  return (
    <Box
      component="main"
      sx={{
        height: "100vh",
        background: "#000",
        color: "#fff",
        p: "0.75rem",
        display: "flex",
        flexDirection: "column",
        overflow: "auto"
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.6rem", mb: "0.85rem" }}>
        <BackButton to="/cluster-test" />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "0.5rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0 }}>
          <ImageToggleButton mode={mode} options={options} onChange={setMode} />
        </Box>
      </Box>

      <Box
        component="section"
        sx={{
          flex: 1,
          minHeight: 0,
          width: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX * 3}px)`,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridTemplateRows: "repeat(4, auto)",
          justifyContent: "center",
          columnGap: 0,
          rowGap: "0.1rem"
        }}
      >
        {orderedClusterRows.map((clusterRow) => {
          const solidObjectIds = clusterRow.closestTop5Ids;
          const defaultSolidIndex = defaultMaskIndexByCluster.get(clusterRow.cluster) ?? 0;
          const solidIndex = solidIndexByCluster[clusterRow.cluster] ?? defaultSolidIndex;
          const clampedSolidIndex = solidObjectIds.length
            ? Math.min(solidIndex, solidObjectIds.length - 1)
            : 0;
          const selectedSolidObjectId = solidObjectIds[clampedSolidIndex];
          const selectedMaskSrc = selectedSolidObjectId
            ? maskImageByObjectId.get(selectedSolidObjectId)
            : undefined;

          return (
            <Box
              component="article"
              key={clusterRow.cluster}
              onClick={() => navigate(`/all/${clusterRow.cluster}`)}
              onMouseEnter={() => setHoveredCluster(clusterRow.cluster)}
              onMouseLeave={() => setHoveredCluster(null)}
              sx={{
                display: "flex",
                flexDirection: "column",
                borderBottom: "4px solid #fff",
                minHeight: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.82}px`,
                maxHeight: `${SHELF_RENDER_IMAGE_SIZE_PX * 1.02}px`,
                paddingLeft: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.2}px`,
                paddingRight: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.2}px`,
                cursor: "pointer"
              }}
            >
              <Box
                sx={{
                  marginBottom: 0,
                  fontSize: "0.42rem",
                  paddingTop: 0,
                  opacity: hoveredCluster === clusterRow.cluster ? 1 : 0,
                  transition: "opacity 120ms ease"
                }}
              >
                <Typography component="span" sx={{ fontSize: "inherit", fontWeight: 700 }}>
                  {clusterRow.cluster}
                </Typography>
                <Typography component="span" sx={{ marginLeft: "0.45rem", color: "#ccc" }}>
                  {clusterRow.clusterType}
                </Typography>
              </Box>

              {mode === "solid" ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    marginBottom: 0,
                    opacity: hoveredCluster === clusterRow.cluster ? 1 : 0,
                    transition: "opacity 120ms ease"
                  }}
                >
                  <Typography component="span" sx={{ fontSize: "0.42rem", color: "#ddd" }}>
                    {selectedSolidObjectId
                      ? `index ${clampedSolidIndex} - object ${selectedSolidObjectId}`
                      : "no object id"}
                  </Typography>
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!solidObjectIds.length) return;
                      setSolidIndexByCluster((previous) => ({
                        ...previous,
                        [clusterRow.cluster]:
                          ((previous[clusterRow.cluster] ?? defaultSolidIndex) + 1) %
                          solidObjectIds.length
                      }));
                    }}
                    variant="outlined"
                    sx={{
                      borderColor: "#fff",
                      background: "#000",
                      color: "#fff",
                      px: "0.25rem",
                      py: "0.05rem",
                      minWidth: 0,
                      borderRadius: 0,
                      fontSize: "0.42rem",
                      lineHeight: 1.1,
                      textTransform: "none",
                      position: "relative",
                      zIndex: 2,
                      "&:hover": { borderColor: "#fff", background: "#000" }
                    }}
                    aria-label={`Rotate solid image for ${clusterRow.cluster}`}
                  >
                    {">"}
                  </Button>
                </Box>
              ) : (
                <Typography
                  component="span"
                  sx={{
                    fontSize: "0.42rem",
                    color: "#bbb",
                    marginBottom: 0,
                    opacity: hoveredCluster === clusterRow.cluster ? 1 : 0,
                    transition: "opacity 120ms ease"
                  }}
                >
                  stacked outlines
                </Typography>
              )}

              <Box
                sx={{
                  marginTop: "auto",
                  width: "100%",
                  height: `min(${SHELF_RENDER_IMAGE_SIZE_PX * 0.86}px, calc((100vh - 240px) / 4))`,
                  position: "relative",
                  background: "#000",
                  overflow: "hidden",
                  paddingLeft: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.25}px`,
                  paddingRight: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.25}px`,
                  boxSizing: "border-box"
                }}
              >
                {mode === "outline" ? (
                  clusterRow.allObjectIds.map((objectId) => {
                    const imageSrc = outlineImageByObjectId.get(objectId);
                    if (!imageSrc) return null;
                    return (
                      <img
                        key={`${clusterRow.cluster}-outline-${objectId}`}
                        src={imageSrc}
                        alt={`${objectId}_outline.png`}
                        loading="lazy"
                        style={{
                          position: "absolute",
                          left: "50%",
                          bottom: "-3px",
                          transform: "translateX(-50%)",
                          width: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                          height: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                          maxWidth: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                          maxHeight: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                          objectFit: "contain",
                          objectPosition: "center bottom",
                          opacity: defaultStackOpacity(clusterRow.allObjectIds.length)
                        }}
                      />
                    );
                  })
                ) : selectedMaskSrc ? (
                  <img
                    src={selectedMaskSrc}
                    alt={`${selectedSolidObjectId}_mask.png`}
                    loading="lazy"
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: "-3px",
                      transform: "translateX(-50%)",
                      width: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                      height: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                      maxWidth: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                      maxHeight: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                      objectFit: "contain",
                      objectPosition: "center bottom",
                      display: "block"
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      color: "#777",
                      fontSize: "11px"
                    }}
                  >
                    Missing image
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default Shelf;
