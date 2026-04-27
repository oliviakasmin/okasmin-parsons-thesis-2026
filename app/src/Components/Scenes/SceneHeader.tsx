import { Box, Typography } from "@mui/material";
import { SCENE_HEADER_HEIGHT_PX } from "../constants";

type SceneHeaderProps = {
  view: "all" | "timeline" | "map";
  objectCount: number;
  spanYears: number;
};

function SceneHeader({ view, objectCount, spanYears }: SceneHeaderProps) {
  return (
    <Box
      sx={{
        height: `${SCENE_HEADER_HEIGHT_PX}px`,
        minHeight: `${SCENE_HEADER_HEIGHT_PX}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: "0.5rem"
      }}
    >
      {view === "timeline" ? (
        <Typography
          sx={{
            fontSize: "1.6rem",
            lineHeight: 1.15,
            color: "#bdbdbd",
            textAlign: "center"
          }}
        >
          similar forms have been made for{" "}
          <Box
            component="span"
            sx={{ fontSize: "2.15rem", color: "#fff", fontWeight: 600, lineHeight: 1 }}
          >
            {spanYears.toLocaleString("en-US")}
          </Box>{" "}
          <Box
            component="span"
            sx={{ fontSize: "2.15rem", color: "#fff", fontWeight: 600, lineHeight: 1 }}
          >
            years
          </Box>{" "}
          (at least)
        </Typography>
      ) : (
        <Typography
          sx={{
            fontSize: "1.25rem",
            lineHeight: 1.15,
            color: "#fff",
            textAlign: "center"
          }}
        >
          {objectCount.toLocaleString("en-US")} vessels
        </Typography>
      )}
    </Box>
  );
}

export default SceneHeader;
