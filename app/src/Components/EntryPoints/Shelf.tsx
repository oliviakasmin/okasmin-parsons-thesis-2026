import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import finalClusterKeysCsv from "../../../../format_data/cluster_shape/final_clusters_keys.csv?raw";
import finalClusterObjectIdsCsv from "../../../../format_data/cluster_shape/final_clusters_object_ids.csv?raw";
import useImageModules from "../../hooks/useImageModules";
import useFormatClusters from "../../hooks/useFormatClusters";
import { homeEntryDomId, SHELF_RENDER_IMAGE_SIZE_PX, type HomeEntryScrollId } from "../constants";
import useInlineSvg from "../../hooks/useInlineSvg";

const shelfEntryScrollId: HomeEntryScrollId = "shelf";

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

const clusterLabels: Record<string, string> = {
  cluster_0: "Outliers",
  cluster_1: "Weird Cluster",
  cluster_2: "Weird Cluster",
  cluster_3: "Core",
  cluster_4: "Core",
  cluster_5: "Core",
  cluster_6: "Core",
  cluster_7: "Core",
  cluster_8: "Core"
};

type AnimatedSampledSvgProps = {
  src: string;
  alt: string;
};

function AnimatedSampledSvg({ src, alt }: AnimatedSampledSvgProps) {
  const { svgMarkup } = useInlineSvg(src);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!wrapperRef.current || !svgMarkup) return;

    const paths = wrapperRef.current.querySelectorAll<SVGPathElement>("svg path");
    paths.forEach((path, index) => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.animation = "none";
      path.style.animation = `shelfPathDraw 1000ms ease forwards`;
      path.style.animationDelay = `${index * 120}ms`;
    });
  }, [svgMarkup]);

  if (!svgMarkup) {
    return <Box aria-label={alt} sx={{ width: "100%", height: "100%", display: "block" }} />;
  }

  return (
    <Box
      ref={wrapperRef}
      aria-label={alt}
      role="img"
      sx={{
        // py: "0.25rem",
        width: "100%",
        height: "100%",
        display: "block",
        "& > svg": {
          width: "100%",
          height: "100%",
          display: "block"
        },
        "@keyframes shelfPathDraw": {
          to: {
            strokeDashoffset: 0
          }
        }
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}

function Shelf() {
  const navigate = useNavigate();
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const orderedClusterIds = useMemo(() => shelves.flat(), []);
  const { maskImageByObjectId } = useImageModules();
  const { clusterRows } = useFormatClusters(finalClusterKeysCsv, finalClusterObjectIdsCsv);
  const clusterRowByClusterId = useMemo(
    () => new Map(clusterRows.map((row) => [row.cluster, row])),
    [clusterRows]
  );

  return (
    <Box
      component="main"
      id={homeEntryDomId(shelfEntryScrollId)}
      sx={{
        height: "100vh",
        background: "#000",
        color: "#fff",
        py: "0.75rem",
        display: "flex",
        flexDirection: "column",
        overflow: "auto"
      }}
    >
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
          rowGap: 0
        }}
      >
        {orderedClusterIds.map((clusterId) => {
          const stackedSvgSrc = `/cluster_SVG_stacked_outlines/${clusterId}_stack_sampled.svg`;
          const clusterRow = clusterRowByClusterId.get(clusterId);
          const fallbackMaskIndex = defaultMaskIndexByCluster.get(clusterId) ?? 0;
          const maskObjectId =
            clusterRow?.closestTop5Ids[
              Math.min(fallbackMaskIndex, Math.max(0, (clusterRow?.closestTop5Ids.length ?? 1) - 1))
            ];
          const hoveredMaskSrc = maskObjectId ? maskImageByObjectId.get(maskObjectId) : undefined;
          const showMask = hoveredClusterId === clusterId && Boolean(hoveredMaskSrc);
          return (
            <Box
              component="article"
              key={clusterId}
              onMouseEnter={() => setHoveredClusterId(clusterId)}
              onMouseLeave={() =>
                setHoveredClusterId((current) => (current === clusterId ? null : current))
              }
              onClick={() =>
                navigate(`/all/${clusterId}`, {
                  state: { homeScrollTo: shelfEntryScrollId }
                })
              }
              sx={{
                display: "flex",
                flexDirection: "column",
                position: "relative",
                minHeight: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.74}px`,
                maxHeight: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.92}px`,
                cursor: "pointer",
                "&:hover .shelf-cluster-label": {
                  opacity: 1,
                  visibility: "visible"
                }
              }}
            >
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
                  boxSizing: "border-box",
                  borderBottom: "4px solid #fff"
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    left: "50%",
                    bottom: "-3px",
                    transform: "translateX(-50%)",
                    width: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                    height: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                    maxWidth: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                    maxHeight: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                    display: "block"
                  }}
                >
                  {showMask && hoveredMaskSrc ? (
                    <img
                      src={hoveredMaskSrc}
                      alt={`${maskObjectId}_mask.png`}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        objectPosition: "center bottom",
                        display: "block"
                      }}
                    />
                  ) : (
                    <AnimatedSampledSvg
                      src={stackedSvgSrc}
                      alt={`${clusterId}_stack_sampled.svg`}
                    />
                  )}
                </Box>
              </Box>
              <Typography
                className="shelf-cluster-label"
                component="span"
                sx={{
                  position: "absolute",
                  left: "50%",
                  top: "100%",
                  transform: "translateX(-50%)",
                  mt: "0.08rem",
                  fontSize: "0.62rem",
                  letterSpacing: "0.03em",
                  opacity: 0,
                  visibility: "hidden",
                  transition: "opacity 120ms ease",
                  pointerEvents: "none",
                  whiteSpace: "nowrap"
                }}
              >
                {clusterLabels[clusterId] ?? clusterId}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default Shelf;
