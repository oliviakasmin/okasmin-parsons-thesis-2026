import { Box, Typography } from "@mui/material";
import { SCENE_HEADER_HEIGHT_PX } from "../constants";

const headerEmphasisSx = {
  fontSize: "2rem",
  color: "#fff",
  fontWeight: 600,
  lineHeight: 1
} as const;

type SceneHeaderProps = {
  view: "all" | "timeline" | "map";
  objectCount: number;
  objectLabelPlural?: string;
  timelineSubject?: string;
  mapSubject?: string;
  spanYears: number;
  countryCount: number;
};

function SceneHeader({
  view,
  objectCount,
  objectLabelPlural = "vessels",
  timelineSubject = "these forms",
  mapSubject = "these forms",
  spanYears,
  countryCount
}: SceneHeaderProps) {
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
          {timelineSubject} have been made for{" "}
          <Box component="span" sx={headerEmphasisSx}>
            {spanYears.toLocaleString("en-US")}
          </Box>{" "}
          <Box component="span" sx={headerEmphasisSx}>
            years
          </Box>{" "}
          (at least)
        </Typography>
      ) : view === "map" ? (
        <Typography
          sx={{
            fontSize: "1.6rem",
            lineHeight: 1.15,
            color: "#bdbdbd",
            textAlign: "center"
          }}
        >
          {mapSubject} have been made across{" "}
          <Box component="span" sx={headerEmphasisSx}>
            {countryCount.toLocaleString("en-US")}
          </Box>{" "}
          <Box component="span" sx={headerEmphasisSx}>
            {countryCount === 1 ? "country" : "countries"}
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
          {objectCount.toLocaleString("en-US")} {objectLabelPlural}
        </Typography>
      )}
    </Box>
  );
}

export default SceneHeader;
