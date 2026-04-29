import { Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { HomeEntryScrollId } from "./constants";
import { useShelfTab } from "./shelfTabState";

type BackButtonProps = {
  label?: string;
  homeScrollTo?: HomeEntryScrollId;
};

function BackButton(props: BackButtonProps) {
  const { label = "Back", homeScrollTo } = props;
  const { setSelectedShelfTab } = useShelfTab();
  const shelfTab =
    homeScrollTo === "shelf-function" ? "type" : homeScrollTo === "shelf-color" ? "color" : "shape";

  return (
    <Button
      component={RouterLink}
      to="/#home-entry-shelf"
      onClick={() => setSelectedShelfTab(shelfTab)}
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
      {label}
    </Button>
  );
}

export default BackButton;
