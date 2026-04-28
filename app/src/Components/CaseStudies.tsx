import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { homeEntryDomId } from "./constants";

export default function CaseStudies() {
  return (
    <Box component="section" id={homeEntryDomId("case-studies")} sx={{ minHeight: "100vh" }}>
      <Typography variant="h4" component="h2">
        placeholder for case studies
      </Typography>
    </Box>
  );
}
