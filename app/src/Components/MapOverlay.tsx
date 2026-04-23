import { Box, Typography } from "@mui/material";

function MapOverlay() {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "grid",
        placeItems: "center"
      }}
    >
      <Typography sx={{ color: "#666", fontSize: "0.8rem" }}>Map overlay placeholder</Typography>
    </Box>
  );
}

export default MapOverlay;
