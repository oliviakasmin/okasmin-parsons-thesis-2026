import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import finalClusterKeysCsv from "../../../process_data/cluster/final_clusters_keys.csv?raw";
import finalClusterObjectIdsCsv from "../../../process_data/cluster/final_clusters_object_ids.csv?raw";
import BackButton from "./BackButton";
import ImageToggleButton from "./ImageToggleButton";
import Timeline from "./Timeline";
import ObjectScene from "./ObjectScene";
import useImageToggle from "../hooks/useImageToggle";
import useImageModules from "../hooks/useImageModules";
import useFormatClusters from "../hooks/useFormatClusters";
import useTimelineBuckets from "../hooks/useTimelineBuckets";
import { buildSceneLayout } from "../hooks/useViewLayouts";
import { SUBGROUP_RENDER_IMAGE_SIZE_PX } from "./constants";

function All() {
  const { clusterId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = searchParams.get("view") === "timeline" ? "timeline" : "all";
  const { mode, options, setMode } = useImageToggle({ colorOption: true });
  const sceneHostRef = useRef<HTMLDivElement | null>(null);
  const [sceneWidth, setSceneWidth] = useState(0);
  const { outlineImageByObjectId, maskImageByObjectId, noBgImageByObjectId } = useImageModules();
  const { clusterRows } = useFormatClusters(finalClusterKeysCsv, finalClusterObjectIdsCsv);
  const selectedCluster = useMemo(
    () => clusterRows.find((row) => row.cluster === clusterId),
    [clusterId, clusterRows]
  );
  const { buckets: timelineBuckets, excludedCount } = useTimelineBuckets(
    selectedCluster?.allObjectIds ?? []
  );
  const sceneLayout = useMemo(
    () =>
      buildSceneLayout({
        objectIds: selectedCluster?.allObjectIds ?? [],
        buckets: timelineBuckets,
        view: currentView,
        sceneWidth,
        imageSizePx: SUBGROUP_RENDER_IMAGE_SIZE_PX
      }),
    [currentView, sceneWidth, selectedCluster?.allObjectIds, timelineBuckets]
  );

  useLayoutEffect(() => {
    const hostNode = sceneHostRef.current;
    if (!hostNode) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSceneWidth(entry.contentRect.width);
    });
    observer.observe(hostNode);
    setSceneWidth(hostNode.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

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

      <Box sx={{ display: "flex", alignItems: "center", gap: "0.4rem", mb: "0.8rem" }}>
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
            "&:hover": { borderColor: "#fff", background: currentView === "all" ? "#fff" : "#000" }
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
        {currentView === "timeline" ? (
          <Typography component="span" sx={{ ml: "0.4rem", fontSize: "0.8rem", color: "#aaa" }}>
            Excluded (non-numeric final_date): {excludedCount}
          </Typography>
        ) : null}
      </Box>

      <Box ref={sceneHostRef} sx={{ position: "relative", width: "100%" }}>
        {currentView === "timeline" ? (
          <Timeline buckets={timelineBuckets} bucketWidthByKey={sceneLayout.bucketWidthByKey} />
        ) : null}
        <ObjectScene
          objectIds={selectedCluster.allObjectIds}
          objectLayoutById={sceneLayout.objectLayoutById}
          sceneHeight={sceneLayout.sceneHeight}
          getPrimaryImageSrc={(objectId) => {
            if (mode === "outline") return outlineImageByObjectId.get(objectId);
            if (mode === "color")
              return noBgImageByObjectId.get(objectId) ?? maskImageByObjectId.get(objectId);
            return maskImageByObjectId.get(objectId);
          }}
          getHoverImageSrc={(objectId) => noBgImageByObjectId.get(objectId)}
          imageAltSuffix={mode === "outline" ? "outline" : mode === "color" ? "no_bg" : "mask"}
          enableHoverSwap={mode !== "color"}
        />
      </Box>
    </Box>
  );
}

export default All;
