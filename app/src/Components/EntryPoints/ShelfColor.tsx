import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import useImageModules from "../../hooks/useImageModules";
import useColorGroups from "../../hooks/useColorGroups";
import { homeEntryDomId, SHELF_RENDER_IMAGE_SIZE_PX, type HomeEntryScrollId } from "../constants";

const shelfColorEntryScrollId: HomeEntryScrollId = "shelf-color";

export default function ShelfColor() {
  const navigate = useNavigate();
  const { maskImageByObjectId, noBgImageByObjectId } = useImageModules();
  const { groupRows } = useColorGroups();

  return (
    <Box
      component="section"
      id={homeEntryDomId(shelfColorEntryScrollId)}
      sx={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        p: "0.75rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflowY: "auto",
        overflowX: "hidden"
      }}
    >
      <Box
        sx={{
          flex: "0 0 auto",
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${SHELF_RENDER_IMAGE_SIZE_PX * 0.85}px, 1fr))`,
          alignItems: "end",
          alignContent: "start",
          columnGap: 0,
          rowGap: "30px",
          width: "100%"
        }}
      >
        {groupRows.map((groupRow) => {
          const representativeObjectId =
            (groupRow.representativeObjectId &&
            (noBgImageByObjectId.has(groupRow.representativeObjectId) ||
              maskImageByObjectId.has(groupRow.representativeObjectId))
              ? groupRow.representativeObjectId
              : null) ??
            groupRow.objectIds.find(
              (objectId) => noBgImageByObjectId.has(objectId) || maskImageByObjectId.has(objectId)
            ) ??
            null;
          const imageSrc = representativeObjectId
            ? (noBgImageByObjectId.get(representativeObjectId) ??
              maskImageByObjectId.get(representativeObjectId))
            : undefined;

          return (
            <Box
              component="article"
              key={groupRow.groupKey}
              onClick={() =>
                navigate(`/all/${groupRow.groupKey}`, {
                  state: { homeScrollTo: shelfColorEntryScrollId, initialImageMode: "color" }
                })
              }
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                cursor: "pointer",
                "&:hover .shelf-color-label": {
                  opacity: 1,
                  visibility: "visible"
                }
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  height: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.84}px`,
                  position: "relative",
                  overflow: "hidden",
                  display: "grid",
                  placeItems: "end center",
                  borderBottom: "4px solid #fff"
                }}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={`${groupRow.groupKey}_${representativeObjectId ?? "missing"}.png`}
                    loading="lazy"
                    style={{
                      width: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px)`,
                      height: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px)`,
                      maxWidth: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                      maxHeight: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                      objectFit: "contain",
                      objectPosition: "center bottom",
                      display: "block"
                    }}
                  />
                ) : (
                  <Typography component="span" sx={{ fontSize: "0.55rem", color: "#777" }}>
                    Missing image
                  </Typography>
                )}
              </Box>
              <Typography
                className="shelf-color-label"
                component="span"
                sx={{
                  position: "absolute",
                  top: "100%",
                  mt: "0.1rem",
                  fontSize: "0.62rem",
                  letterSpacing: "0.03em",
                  opacity: 0,
                  visibility: "hidden",
                  transition: "opacity 120ms ease",
                  pointerEvents: "none"
                }}
              >
                {groupRow.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
