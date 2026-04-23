import { useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import useSceneAnimator from "../hooks/useSceneAnimator";
import type { ObjectLayout } from "../hooks/useViewLayouts";

type ObjectSceneProps = {
  objectIds: string[];
  objectLayoutById: Map<string, ObjectLayout>;
  sceneWidth: number;
  sceneHeight: number;
  getPrimaryImageSrc: (objectId: string) => string | undefined;
  getHoverImageSrc: (objectId: string) => string | undefined;
  imageAltSuffix: string;
  enableHoverSwap: boolean;
};

function ObjectScene({
  objectIds,
  objectLayoutById,
  sceneWidth,
  sceneHeight,
  getPrimaryImageSrc,
  getHoverImageSrc,
  imageAltSuffix,
  enableHoverSwap
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

        return (
          <Box
            key={objectId}
            ref={registerNode(objectId)}
            data-object-id={objectId}
            onMouseEnter={() => setHoveredObjectId(objectId)}
            onMouseLeave={() =>
              setHoveredObjectId((current) => (current === objectId ? null : current))
            }
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              transformOrigin: "center bottom",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              cursor: "pointer"
            }}
          >
            {primaryImageSrc ? (
              <>
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
        );
      })}
    </Box>
  );
}

export default ObjectScene;
