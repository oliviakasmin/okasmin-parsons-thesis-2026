import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import finalClusterKeysCsv from "../../../process_data/cluster/final_clusters_keys.csv?raw";
import finalClusterObjectIdsCsv from "../../../process_data/cluster/final_clusters_object_ids.csv?raw";
import BackButton from "./BackButton";
import ImageToggleButton from "./ImageToggleButton";
import useImageToggle from "../hooks/useImageToggle";
import useImageModules from "../hooks/useImageModules";
import useFormatClusters from "../hooks/useFormatClusters";

const SOURCE_IMAGE_SIZE_PX = 768;
const IMAGE_ASPECT_RATIO = 0.2;
const RENDER_IMAGE_SIZE_PX = SOURCE_IMAGE_SIZE_PX * IMAGE_ASPECT_RATIO;

function All() {
  const { clusterId } = useParams();
  const { mode, options, setMode } = useImageToggle({ colorOption: true });
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const { outlineImageByObjectId, maskImageByObjectId, noBgImageByObjectId } = useImageModules();
  const { clusterRows } = useFormatClusters(finalClusterKeysCsv, finalClusterObjectIdsCsv);
  const selectedCluster = useMemo(
    () => clusterRows.find((row) => row.cluster === clusterId),
    [clusterId, clusterRows]
  );

  if (!selectedCluster) {
    return (
      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          background: "#000",
          color: "#fff",
          p: "0.75rem"
        }}
      >
        <BackButton to="/shelf" label="Back to Shelf" />
        <Typography>Cluster not found.</Typography>
      </Box>
    );
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        p: "0.75rem"
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          mb: "0.85rem",
          flexWrap: "wrap"
        }}
      >
        <BackButton to="/shelf" />
        <Typography component="h1" sx={{ m: 0, fontSize: "1.25rem" }}>
          {selectedCluster.cluster}
        </Typography>
        <Typography component="span" sx={{ color: "#ccc", fontSize: "0.9rem" }}>
          {selectedCluster.clusterType}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "1rem" }}>
        <Typography component="span" sx={{ fontSize: "0.9rem", color: "#ddd" }}>
          View:
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0 }}>
          <ImageToggleButton mode={mode} options={options} onChange={setMode} />
        </Box>
      </Box>

      <Box
        component="section"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: "0.6rem"
        }}
      >
        {selectedCluster.allObjectIds.map((objectId) => {
          const imageSrc =
            mode === "outline"
              ? outlineImageByObjectId.get(objectId)
              : mode === "color"
                ? (noBgImageByObjectId.get(objectId) ?? maskImageByObjectId.get(objectId))
                : maskImageByObjectId.get(objectId);
          const hoverImageSrc = noBgImageByObjectId.get(objectId);
          const isHovered = hoveredObjectId === objectId;

          return (
            <Box
              key={`${selectedCluster.cluster}-${objectId}`}
              sx={{
                p: "0.4rem",
                minHeight: `${RENDER_IMAGE_SIZE_PX * 0.95}px`
              }}
            >
              <Box
                sx={{
                  width: `min(100%, ${RENDER_IMAGE_SIZE_PX}px)`,
                  height: `min(${RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                  mx: "auto",
                  position: "relative",
                  background: "#000",
                  overflow: "hidden",
                  cursor: "pointer"
                }}
                onMouseEnter={() => setHoveredObjectId(objectId)}
                onMouseLeave={() => setHoveredObjectId(null)}
              >
                {imageSrc ? (
                  <>
                    <img
                      src={imageSrc}
                      alt={`${objectId}_${mode === "outline" ? "outline" : mode === "color" ? "no_bg" : "mask"}.png`}
                      loading="lazy"
                      style={{
                        position: "absolute",
                        left: "50%",
                        bottom: "-3px",
                        transform: "translateX(-50%)",
                        width: `min(100%, ${RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                        height: `min(100%, ${RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                        maxWidth: `${RENDER_IMAGE_SIZE_PX}px`,
                        maxHeight: `${RENDER_IMAGE_SIZE_PX}px`,
                        objectFit: "contain",
                        objectPosition: "center bottom",
                        display: "block"
                      }}
                    />
                    {hoverImageSrc && mode !== "color" ? (
                      <img
                        src={hoverImageSrc}
                        alt={`${objectId}_no_bg.png`}
                        loading="lazy"
                        style={{
                          position: "absolute",
                          left: "50%",
                          bottom: "-3px",
                          transform: "translateX(-50%)",
                          width: `min(100%, ${RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                          height: `min(100%, ${RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                          maxWidth: `${RENDER_IMAGE_SIZE_PX}px`,
                          maxHeight: `${RENDER_IMAGE_SIZE_PX}px`,
                          objectFit: "contain",
                          objectPosition: "center bottom",
                          display: "block",
                          opacity: isHovered ? 1 : 0,
                          transition: "opacity 120ms ease-out"
                        }}
                      />
                    ) : null}
                  </>
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

export default All;
