import { useClusterScene } from "../ClusterSceneContext";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import useImageModules from "../../hooks/useImageModules";
import useFunctionGroups from "../../hooks/useFunctionGroups";
import { ROUTE_SHELF_FUNCTION_ROOT_ID, SHELF_RENDER_IMAGE_SIZE_PX } from "../constants";

export default function ShelfFunction() {
  const { openCluster } = useClusterScene();
  const { maskImageByObjectId } = useImageModules();
  const { groupRows } = useFunctionGroups();

  return (
    <Box
      component="section"
      id={ROUTE_SHELF_FUNCTION_ROOT_ID}
      sx={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        p: "0.75rem",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        overflowY: "auto",
        overflowX: "hidden"
      }}
    >
      <Box
        sx={{
          flex: "0 0 auto",
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(groupRows.length, 1)}, minmax(0, 1fr))`,
          alignItems: "end",
          alignContent: "start",
          columnGap: 0,
          rowGap: "30px",
          width: "min(100%, 85vw)",
          mx: "auto",
          "@media (max-width: 900px)": {
            gridTemplateColumns: `repeat(auto-fit, minmax(clamp(120px, 28vw, ${SHELF_RENDER_IMAGE_SIZE_PX * 0.85}px), 1fr))`
          }
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
              onClick={() => openCluster({ clusterId: groupRow.group, returnShelfTab: "type" })}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                cursor: "pointer"
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  height: `clamp(120px, 12vw, ${SHELF_RENDER_IMAGE_SIZE_PX * 0.84}px)`,
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
                  pointerEvents: "none"
                }}
              >
                {groupRow.group}
              </Typography>
            </Box>
          );
        })}
      </Box>
      <Typography
        component="h4"
        variant="h4"
        sx={{
          mt: "1.5rem",
          mb: "0.5rem",
          // fontSize: "0.95rem",
          // fontWeight: 400,
          textAlign: "center"
        }}
      >
        [change to something like]
      </Typography>
      <Typography
        component="h4"
        variant="h4"
        sx={{
          mt: "1.5rem",
          mb: "0.5rem",
          // fontSize: "0.95rem",
          // fontWeight: 400,
          textAlign: "center"
        }}
      >
        storage | pouring | wine | water | ritual | animal shapes | miscellaneous
      </Typography>
    </Box>
  );
}
