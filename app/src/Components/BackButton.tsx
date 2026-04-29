import { Button, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

function BackButton() {
  return (
    <Button
      component={RouterLink}
      to="/#home-entry-shelf"
      state={{ homeScrollTo: "shelf" }}
      variant="outlined"
      sx={{
        borderColor: "#fff",
        background: "#fff",
        color: "#000",
        px: "0.65rem",
        py: "0.35rem",
        minWidth: 0,
        borderRadius: 0,
        fontWeight: 700,
        textTransform: "none",
        "&:hover": { borderColor: "#fff", background: "#fff" }
      }}
    >
      <Typography component="span" variant="backButton">
        Back
      </Typography>
    </Button>
  );
}

export default BackButton;
