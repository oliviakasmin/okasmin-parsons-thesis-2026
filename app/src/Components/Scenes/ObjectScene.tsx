import { useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import useSceneAnimator from "../../hooks/useSceneAnimator";
import type { ObjectLayout } from "../../hooks/useViewLayouts";
import InlineOutlineSvg from "./InlineOutlineSvg";

type ObjectSceneProps = {
  objectIds: string[];
  objectLayoutById: Map<string, ObjectLayout>;
  sceneWidth: number;
  sceneHeight: number;
  getPrimaryImageSrc: (objectId: string) => string | undefined;
  getHoverImageSrc: (objectId: string) => string | undefined;
  imageAltSuffix: string;
  enableHoverSwap: boolean;
  pointerEvents?: "auto" | "none";
  onObjectClick?: (objectId: string) => void;
};

function ObjectScene({
  objectIds,
  objectLayoutById,
  sceneWidth,
  sceneHeight,
  getPrimaryImageSrc,
  getHoverImageSrc,
  imageAltSuffix,
  enableHoverSwap,
  pointerEvents = "auto",
  onObjectClick
}: ObjectSceneProps) {
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const nodeByObjectIdRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useSceneAnimator({ nodeByObjectId: nodeByObjectIdRef.current, objectLayoutById });

  const registerNode = useMemo(
    () => (objectId: string) => (node: HTMLDivElement | null) => {
      if (!node) {
        nodeByObjectIdRef.current.delete(objectId);
        return;
      }
      nodeByObjectIdRef.current.set(objectId, node);
    },
    []
  );

  return (
    <Box
      sx={{
        position: "relative",
        width: `${Math.max(sceneWidth, 1)}px`,
        minWidth: "100%",
        height: `${Math.max(sceneHeight, 1)}px`,
        overflow: "visible"
      }}
    >
      {objectIds.map((objectId) => {
        const primaryImageSrc = getPrimaryImageSrc(objectId);
        const hoverImageSrc = getHoverImageSrc(objectId);
        const isHovered = hoveredObjectId === objectId;
        const isOutlineMode = imageAltSuffix === "outline";

        if (!primaryImageSrc) {
          console.log(`[ObjectScene] missing primary image for ${objectId} (${imageAltSuffix})`);
        }

        return (
          <Box
            key={objectId}
            ref={registerNode(objectId)}
            data-object-id={objectId}
            onMouseEnter={() => setHoveredObjectId(objectId)}
            onMouseLeave={() =>
              setHoveredObjectId((current) => (current === objectId ? null : current))
            }
            onClick={(event) => {
              if (!onObjectClick) return;
              event.stopPropagation();
              onObjectClick(objectId);
            }}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              transformOrigin: "center bottom",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              cursor: pointerEvents === "none" ? "default" : "pointer",
              pointerEvents
            }}
          >
            {primaryImageSrc ? (
              <>
                {isOutlineMode ? (
                  <InlineOutlineSvg
                    src={primaryImageSrc}
                    alt={`${objectId}_${imageAltSuffix}.png`}
                    className="inline-outline-svg"
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "block",
                      opacity: enableHoverSwap && hoverImageSrc ? (isHovered ? 0 : 1) : 1,
                      transition: "opacity 120ms ease-out"
                    }}
                  />
                ) : (
                  <img
                    src={primaryImageSrc}
                    alt={`${objectId}_${imageAltSuffix}.png`}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      objectPosition: "center bottom",
                      display: "block"
                    }}
                  />
                )}
                {enableHoverSwap && hoverImageSrc ? (
                  <img
                    src={hoverImageSrc}
                    alt={`${objectId}_no_bg.png`}
                    loading="lazy"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
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
                  display: "block"
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export default ObjectScene;
