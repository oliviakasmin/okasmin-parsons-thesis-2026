import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

type BackButtonProps = {
  to: string;
  label?: string;
};

function BackButton({ to, label = "Back" }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      onClick={() => navigate(to)}
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
