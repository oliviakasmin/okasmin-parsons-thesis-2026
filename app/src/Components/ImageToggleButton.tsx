import { Button } from "@mui/material";
import type { ImageToggleMode } from "../hooks/useImageToggle";

type ImageToggleButtonProps = {
  mode: ImageToggleMode;
  onChange: (nextMode: ImageToggleMode) => void;
  options: ImageToggleMode[];
};

function ImageToggleButton({ mode, onChange, options }: ImageToggleButtonProps) {
  return (
    <>
      {options.map((option) => {
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
              "&:hover": {
                borderColor: "#fff",
                background: active ? "#fff" : "#000"
              }
            }}
          >
            {option}
          </Button>
        );
      })}
    </>
  );
}

export default ImageToggleButton;
