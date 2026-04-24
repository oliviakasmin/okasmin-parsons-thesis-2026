import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import finalClusterKeysCsv from "../../../process_data/cluster/final_clusters_keys.csv?raw";
import finalClusterObjectIdsCsv from "../../../process_data/cluster/final_clusters_object_ids.csv?raw";
import BackButton from "./BackButton";
import ImageToggleButton from "./ImageToggleButton";
import ObjectScene from "./ObjectScene";
import SceneHeader from "./SceneHeader";
import TimelineAxis from "./TimelineAxis";
import useImageToggle from "../hooks/useImageToggle";
import useImageModules from "../hooks/useImageModules";
import useFormatClusters from "../hooks/useFormatClusters";
import useTimelineBuckets from "../hooks/useTimelineBuckets";
import { buildSceneLayout } from "../hooks/useViewLayouts";
import {
  SCENE_LEFT_PANEL_MAX_WIDTH_PX,
  SCENE_LEFT_PANEL_MIN_WIDTH_PX,
  SCENE_LEFT_PANEL_WIDTH_VW,
  SUBGROUP_RENDER_IMAGE_SIZE_PX
} from "./constants";

function All() {
  const { clusterId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = searchParams.get("view") === "timeline" ? "timeline" : "all";
  const { mode, options, setMode } = useImageToggle({ colorOption: true });
  const sceneViewportRef = useRef<HTMLDivElement | null>(null);
  const [sceneViewportSize, setSceneViewportSize] = useState({ width: 0, height: 0 });
  const { outlineImageByObjectId, maskImageByObjectId, noBgImageByObjectId } = useImageModules();
  const { clusterRows } = useFormatClusters(finalClusterKeysCsv, finalClusterObjectIdsCsv);
  const selectedCluster = useMemo(
    () => clusterRows.find((row) => row.cluster === clusterId),
    [clusterId, clusterRows]
  );
  const {
    buckets: timelineBuckets,
    excludedCount,
    spanYears
  } = useTimelineBuckets(selectedCluster?.allObjectIds ?? []);
  const allSceneLayout = useMemo(
    () =>
      buildSceneLayout({
        objectIds: selectedCluster?.allObjectIds ?? [],
        buckets: timelineBuckets,
        view: "all",
        sceneWidth: sceneViewportSize.width,
        sceneHeight: sceneViewportSize.height,
        imageSizePx: SUBGROUP_RENDER_IMAGE_SIZE_PX
      }),
    [
      sceneViewportSize.height,
      sceneViewportSize.width,
      selectedCluster?.allObjectIds,
      timelineBuckets
    ]
  );

  const timelineSceneLayout = useMemo(
    () =>
      buildSceneLayout({
        objectIds: selectedCluster?.allObjectIds ?? [],
        buckets: timelineBuckets,
        view: "timeline",
        sceneWidth: sceneViewportSize.width,
        sceneHeight: sceneViewportSize.height,
        imageSizePx: SUBGROUP_RENDER_IMAGE_SIZE_PX
      }),
    [
      sceneViewportSize.height,
      sceneViewportSize.width,
      selectedCluster?.allObjectIds,
      timelineBuckets
    ]
  );

  const sceneLayout = currentView === "timeline" ? timelineSceneLayout : allSceneLayout;
  const allSceneHeight = Math.max(sceneViewportSize.height, allSceneLayout.sceneHeight);
  const timelineSceneHeight = Math.max(sceneViewportSize.height, timelineSceneLayout.sceneHeight);
  const contentSceneHeight = currentView === "timeline" ? timelineSceneHeight : allSceneHeight;
  const sharedSceneWidth = Math.max(allSceneLayout.sceneWidth, timelineSceneLayout.sceneWidth);

  useLayoutEffect(() => {
    const viewportNode = sceneViewportRef.current;
    if (!viewportNode) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSceneViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });
    observer.observe(viewportNode);
    const initialRect = viewportNode.getBoundingClientRect();
    setSceneViewportSize({ width: initialRect.width, height: initialRect.height });
    return () => observer.disconnect();
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "timeline") return;
    console.log(`Excluded (non-numeric final_date): ${excludedCount}`);
  }, [currentView, excludedCount]);

  useEffect(() => {
    if (!selectedCluster) return;
    console.log(`${selectedCluster.cluster}\n${selectedCluster.clusterType}`);
  }, [selectedCluster]);

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
        height: "100vh",
        background: "#000",
        color: "#fff",
        p: "0.75rem",
        display: "flex",
        flexDirection: "column"
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
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "1rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0 }}>
          <ImageToggleButton mode={mode} options={options} onChange={setMode} />
        </Box>
      </Box>

      <SceneHeader
        view={currentView}
        objectCount={selectedCluster.allObjectIds.length}
        spanYears={spanYears}
      />

      <Box sx={{ flex: 1, minHeight: 0, width: "100%", display: "flex", gap: "0.7rem" }}>
        <Box
          sx={{
            width: `clamp(${SCENE_LEFT_PANEL_MIN_WIDTH_PX}px, ${SCENE_LEFT_PANEL_WIDTH_VW}vw, ${SCENE_LEFT_PANEL_MAX_WIDTH_PX}px)`,
            minWidth: 0,
            position: "relative"
          }}
        >
          {currentView === "timeline" ? (
            <TimelineAxis
              buckets={timelineBuckets}
              bucketSpanByKey={timelineSceneLayout.bucketSpanByKey}
              panelHeight={contentSceneHeight}
            />
          ) : (
            <>
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  pr: "0.65rem",
                  color: "#777",
                  fontSize: "0.78rem",
                  textAlign: "center",
                  pointerEvents: "none"
                }}
              >
                show stacked outline images here
              </Box>
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: 0,
                  borderRight: "1px solid #444"
                }}
              />
            </>
          )}
        </Box>
        <Box
          ref={sceneViewportRef}
          sx={{ position: "relative", flex: 1, minHeight: 0, minWidth: 0, width: "100%" }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              overflowX: currentView === "timeline" ? "auto" : "hidden",
              overflowY: "auto"
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: `${Math.max(sharedSceneWidth, 1)}px`,
                minWidth: "100%"
              }}
            >
              <ObjectScene
                objectIds={selectedCluster.allObjectIds}
                objectLayoutById={sceneLayout.objectLayoutById}
                sceneWidth={sharedSceneWidth}
                sceneHeight={contentSceneHeight}
                getPrimaryImageSrc={(objectId) => {
                  if (mode === "outline") return outlineImageByObjectId.get(objectId);
                  if (mode === "color")
                    return noBgImageByObjectId.get(objectId) ?? maskImageByObjectId.get(objectId);
                  return maskImageByObjectId.get(objectId);
                }}
                getHoverImageSrc={(objectId) => noBgImageByObjectId.get(objectId)}
                imageAltSuffix={
                  mode === "outline" ? "outline" : mode === "color" ? "no_bg" : "mask"
                }
                enableHoverSwap={mode !== "color"}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          zIndex: 5,
          mt: "0.6rem",
          pt: "0.45rem",
          pb: "0.35rem",
          background:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.88) 22%, rgba(0, 0, 0, 0.96) 100%)"
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
          <Button
            type="button"
            onClick={() => setSearchParams({ view: "all" })}
            variant="outlined"
            sx={{
              borderColor: "#fff",
              background: currentView === "all" ? "#fff" : "#000",
              color: currentView === "all" ? "#000" : "#fff",
              textTransform: "none",
              minWidth: 0,
              borderRadius: 0,
              "&:hover": {
                borderColor: "#fff",
                background: currentView === "all" ? "#fff" : "#000"
              }
            }}
          >
            All
          </Button>
          <Button
            type="button"
            onClick={() => setSearchParams({ view: "timeline" })}
            variant="outlined"
            sx={{
              borderColor: "#fff",
              background: currentView === "timeline" ? "#fff" : "#000",
              color: currentView === "timeline" ? "#000" : "#fff",
              textTransform: "none",
              minWidth: 0,
              borderRadius: 0,
              "&:hover": {
                borderColor: "#fff",
                background: currentView === "timeline" ? "#fff" : "#000"
              }
            }}
          >
            Timeline
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default All;
