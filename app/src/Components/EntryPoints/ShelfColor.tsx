import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { homeEntryDomId } from "../constants";

export default function ShelfColor() {
  return (
    <Box
      component="section"
      id={homeEntryDomId("shelf-color")}
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <Typography variant="h4" component="h2">
        placeholder for color shelf
      </Typography>
    </Box>
  );
}
