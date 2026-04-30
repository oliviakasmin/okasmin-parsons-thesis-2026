import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { SUBGROUP_RENDER_IMAGE_SIZE_PX } from "../constants";
import InlineOutlineSvg from "./InlineOutlineSvg";

type LeftOutlineStackPanelProps = {
  objectIds: string[];
  outlineImageByObjectId: Map<string, string>;
};

function defaultStackOpacity(clusterSize: number) {
  return Math.min(1, Math.max(0.08, 1 / Math.max(18, clusterSize)));
}

function LeftOutlineStackPanel({ objectIds, outlineImageByObjectId }: LeftOutlineStackPanelProps) {
  const [showOutlineStack, setShowOutlineStack] = useState(false);

  return (
    <Box
      sx={{
        width: "clamp(180px, 25vw, 360px)",
        minWidth: 0,
        pr: "0.55rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        gap: "0.45rem"
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: `${SUBGROUP_RENDER_IMAGE_SIZE_PX * 6.2}px`,
          height: `min(calc(100vh - 240px), ${SUBGROUP_RENDER_IMAGE_SIZE_PX * 5.2}px)`,
          display: "grid",
          placeItems: "center"
        }}
      >
        {showOutlineStack ? (
          objectIds.map((objectId) => {
            const outlineSrc = outlineImageByObjectId.get(objectId);
            if (!outlineSrc) return null;
            return (
              <InlineOutlineSvg
                key={`stack-outline-${objectId}`}
                src={outlineSrc}
                alt={`${objectId}_outline.png`}
                className="inline-outline-svg"
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: "-3px",
                  transform: "translateX(-50%)",
                  width: `min(100%, ${SUBGROUP_RENDER_IMAGE_SIZE_PX * 5.2}px)`,
                  height: `min(100%, ${SUBGROUP_RENDER_IMAGE_SIZE_PX * 5.2}px)`,
                  display: "block",
                  opacity: defaultStackOpacity(objectIds.length)
                }}
              />
            );
          })
        ) : (
          <Button
            type="button"
            onClick={() => setShowOutlineStack(true)}
            variant="outlined"
            sx={{
              borderColor: "#fff",
              background: "#000",
              color: "#fff",
              textTransform: "none",
              borderRadius: 0,
              "&:hover": { borderColor: "#fff", background: "#111" }
            }}
          >
            show outlines
          </Button>
        )}
      </Box>
      <Typography
        sx={{
          mt: "1rem",
          fontSize: "1.25rem",
          lineHeight: 1.15,
          color: "#fff",
          textAlign: "center"
        }}
      >
        {objectIds.length.toLocaleString("en-US")} vessels
      </Typography>
    </Box>
  );
}

export default LeftOutlineStackPanel;
