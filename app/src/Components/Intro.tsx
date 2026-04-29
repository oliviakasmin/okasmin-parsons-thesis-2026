import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { allObjectIds } from "./title_intro_constants";
import InlineOutlineSvg from "./Scenes/InlineOutlineSvg";

const introOutlineThumbSx = {
  width: "clamp(72px, 11vw, 132px)",
  height: "clamp(72px, 11vw, 132px)",
  display: "block" as const,
  flexShrink: 0
};

const introOutlineRowStripSx = {
  display: "inline-flex",
  flexDirection: "row" as const,
  flexWrap: "nowrap" as const,
  alignItems: "flex-end",
  gap: 0,
  borderBottom: "2px solid #fff",
  boxSizing: "border-box" as const
};

export default function Intro() {
  const splitAt = Math.ceil(allObjectIds.length / 2);
  const topRowIds = allObjectIds.slice(0, splitAt);
  const bottomRowIds = allObjectIds.slice(splitAt);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        marginLeft: "auto",
        marginRight: "auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "stretch",
        textAlign: "center",
        boxSizing: "border-box",
        paddingLeft: "0.5rem",
        paddingRight: "0.5rem",
        paddingTop: "6rem",
        paddingBottom: "6rem"
      }}
    >
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-start",
          overflowX: "auto",
          flexShrink: 0
        }}
      >
        <Box sx={introOutlineRowStripSx}>
          {topRowIds.map((objectId) => (
            <InlineOutlineSvg
              key={`intro-outline-top-${objectId}`}
              src={`/SVG_outlines/${objectId}_outline.svg`}
              alt=""
              className="inline-outline-svg"
              style={introOutlineThumbSx}
            />
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: "2rem",
          width: "100%",
          maxWidth: "70vw",
          alignSelf: "center",
          mx: "auto",
          boxSizing: "border-box",
          flexShrink: 0,
          textAlign: "left"
        }}
      >
        <Typography variant="introHeading" component="h4">
          Ceramic vessels have been made by humans for over 10,000 years.
        </Typography>
        <Typography variant="introHeading" component="h4">
          When we undress them a shared thread emerges.
        </Typography>
      </Box>

      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-end",
          overflowX: "auto",
          flexShrink: 0
        }}
      >
        <Box sx={introOutlineRowStripSx}>
          {bottomRowIds.map((objectId) => (
            <InlineOutlineSvg
              key={`intro-outline-bottom-${objectId}`}
              src={`/SVG_outlines/${objectId}_outline.svg`}
              alt=""
              className="inline-outline-svg"
              style={introOutlineThumbSx}
            />
          ))}
        </Box>
      </Box>
    </div>
  );
}
