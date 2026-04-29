import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import useImageModules from "../../hooks/useImageModules";
import useFunctionGroups from "../../hooks/useFunctionGroups";
import { homeEntryDomId, SHELF_RENDER_IMAGE_SIZE_PX, type HomeEntryScrollId } from "../constants";

const shelfFunctionEntryScrollId: HomeEntryScrollId = "shelf-function";

export default function ShelfFunction() {
  const navigate = useNavigate();
  const { maskImageByObjectId } = useImageModules();
  const { groupRows } = useFunctionGroups();

  return (
    <Box
      component="section"
      id={homeEntryDomId(shelfFunctionEntryScrollId)}
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
            maskImageByObjectId.has(groupRow.representativeObjectId)
              ? groupRow.representativeObjectId
              : null) ??
            groupRow.objectIds.find((objectId) => maskImageByObjectId.has(objectId)) ??
            null;
          const imageSrc = representativeObjectId
            ? maskImageByObjectId.get(representativeObjectId)
            : undefined;

          return (
            <Box
              component="article"
              key={groupRow.group}
              onClick={() =>
                navigate(`/all/${groupRow.group}`, {
                  state: { homeScrollTo: shelfFunctionEntryScrollId }
                })
              }
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                cursor: "pointer",
                "&:hover .shelf-function-label": {
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
                    alt={`${groupRow.group}_${representativeObjectId ?? "missing"}.png`}
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
                  (() => {
                    console.log(
                      `[ShelfFunction] missing image for function group ${groupRow.group}`
                    );
                    return <Box sx={{ width: "100%", height: "100%", display: "block" }} />;
                  })()
                )}
              </Box>
              <Typography
                className="shelf-function-label"
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
                {groupRow.group}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
