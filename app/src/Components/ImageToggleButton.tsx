import { Box, Button } from "@mui/material";
import type { ImageToggleMode } from "../hooks/useImageToggle";

type ImageToggleButtonProps = {
  mode: ImageToggleMode;
  onChange: (nextMode: ImageToggleMode) => void;
  options: ImageToggleMode[];
};

function ImageToggleButton({ mode, onChange, options }: ImageToggleButtonProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "row", alignItems: "stretch" }}>
      {options.map((option, index) => {
        const active = mode === option;
        return (
          <Button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            variant="outlined"
            sx={{
              borderColor: "#fff",
              background: active ? "#fff" : "#000",
              color: active ? "#000" : "#fff",
              px: "0.55rem",
              py: "0.3rem",
              minWidth: 0,
              borderRadius: 0,
              textTransform: "none",
              margin: 0,
              ...(index > 0 ? { marginLeft: "-1px" } : {}),
              position: "relative",
              "&:hover": {
                borderColor: "#fff",
                background: active ? "#fff" : "#000",
                zIndex: 1
              }
            }}
          >
            {option}
          </Button>
        );
      })}
    </Box>
  );
}

export default ImageToggleButton;
