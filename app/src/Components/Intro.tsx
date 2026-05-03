import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { allObjectIds } from "./title_intro_constants";
import MiniShelfSVG from "./MiniShelfSVG";

const splitAt = Math.ceil(allObjectIds.length / 2);
const topRowIds = allObjectIds.slice(0, splitAt);
const bottomRowIds = allObjectIds.slice(splitAt);

const TopShelfSVG = <MiniShelfSVG objectIds={topRowIds} />;
const BottomShelfSVG = <MiniShelfSVG objectIds={bottomRowIds} />;

export default function Intro() {
  return (
    <section
      className="viewport-with-margins"
      style={{
        height: "calc(100vh - (var(--page-margin) * 2))",
        overflow: "hidden"
      }}
    >
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-around"
          // alignItems: "center"
        }}
      >
        <Box sx={{ alignSelf: "flex-start", pl: "8%" }}>{TopShelfSVG}</Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "3rem"
          }}
        >
          <Typography variant="introHeading" component="h4">
            We've been making
            <Box
              component="span"
              sx={(theme) => ({
                ...theme.typography.h3
              })}
            >
              {" "}
              ceramic vessels{" "}
            </Box>
            for over 10,000 years.
          </Typography>
          <Typography variant="introHeading" component="h4">
            When we{" "}
            <Box
              component="span"
              sx={(theme) => ({
                ...theme.typography.rocaLight,
                fontStyle: "italic",
                fontSize: theme.typography.h3.fontSize,
                lineHeight: theme.typography.h3.lineHeight
              })}
            >
              undress
            </Box>{" "}
            them a shared thread emerges.
          </Typography>
        </Box>

        <Box sx={{ alignSelf: "flex-end", pr: "8%" }}>{BottomShelfSVG}</Box>
      </Box>
    </section>
  );
}
