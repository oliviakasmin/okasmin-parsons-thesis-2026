import { Button, Typography } from "@mui/material";
import { useClusterScene } from "./ClusterSceneContext";

function BackButton() {
  const { closeCluster } = useClusterScene();

  return (
    <Button
      type="button"
      onClick={() => closeCluster()}
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
