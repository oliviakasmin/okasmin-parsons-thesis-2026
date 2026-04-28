import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import ObjectScene from "./ObjectScene";
import type { ObjectLayout } from "@/hooks/useViewLayouts";
import useSceneViewportSize, { type SceneViewportSize } from "@/hooks/useSceneViewportSize";
import {
  SCENE_LEFT_PANEL_MAX_WIDTH_PX,
  SCENE_LEFT_PANEL_MIN_WIDTH_PX,
  SCENE_LEFT_PANEL_WIDTH_VW
} from "../constants";

type AllProps = {
  objectIds: string[];
  objectLayoutById: Map<string, ObjectLayout>;
  sceneWidth: number;
  sceneHeight: number;
  getPrimaryImageSrc: (objectId: string) => string | undefined;
  getHoverImageSrc: (objectId: string) => string | undefined;
  imageAltSuffix: string;
  enableHoverSwap: boolean;
  onViewportSizeChange: (size: SceneViewportSize) => void;
};

function All({
  objectIds,
  objectLayoutById,
  sceneWidth,
  sceneHeight,
  getPrimaryImageSrc,
  getHoverImageSrc,
  imageAltSuffix,
  enableHoverSwap,
  onViewportSizeChange
}: AllProps) {
  const sceneViewportRef = useRef<HTMLDivElement | null>(null);
  const sceneViewportSize = useSceneViewportSize(sceneViewportRef);

  useEffect(() => {
    onViewportSizeChange(sceneViewportSize);
  }, [onViewportSizeChange, sceneViewportSize]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, width: "100%", display: "flex", gap: "0.9rem" }}>
      <Box
        sx={{
          width: `clamp(${SCENE_LEFT_PANEL_MIN_WIDTH_PX}px, ${SCENE_LEFT_PANEL_WIDTH_VW}vw, ${SCENE_LEFT_PANEL_MAX_WIDTH_PX}px)`,
          minWidth: 0,
          position: "relative"
        }}
      >
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
      </Box>
      <Box ref={sceneViewportRef} sx={{ position: "relative", flex: 1, minHeight: 0, minWidth: 0 }}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            overflowX: "hidden",
            overflowY: "auto",
            pointerEvents: "auto"
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: `${Math.max(sceneWidth, 1)}px`,
              minWidth: "100%"
            }}
          >
            {/* Cell size comes from parent `buildSceneLayout` `imageSizePx` (e.g. Container vs timeline/map). */}
            <ObjectScene
              objectIds={objectIds}
              objectLayoutById={objectLayoutById}
              sceneWidth={sceneWidth}
              sceneHeight={sceneHeight}
              getPrimaryImageSrc={getPrimaryImageSrc}
              getHoverImageSrc={getHoverImageSrc}
              imageAltSuffix={imageAltSuffix}
              enableHoverSwap={enableHoverSwap}
              pointerEvents="auto"
              onObjectClick={(objectId) => console.log(objectId)}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export type { AllProps };

export default All;
