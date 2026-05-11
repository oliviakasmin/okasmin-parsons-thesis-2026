import { Box, Button } from "@mui/material";

export type SimilarShapesView = "selected" | "similar";

type SimilarShapesViewToggleProps = {
  view: SimilarShapesView;
  onChange: (next: SimilarShapesView) => void;
  /** When there are no neighbors, the similar segment is disabled */
  similarDisabled?: boolean;
};

const OPTIONS: SimilarShapesView[] = ["selected", "similar"];

const OPTION_LABEL: Record<SimilarShapesView, string> = {
  selected: "selected",
  similar: "similar shapes"
};

export default function SimilarShapesViewToggle({
  view,
  onChange,
  similarDisabled = false
}: SimilarShapesViewToggleProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "row", alignItems: "stretch" }}>
      {OPTIONS.map((option, index) => {
        const active = view === option;
        const disabled = option === "similar" && similarDisabled;
        return (
          <Button
            key={option}
            type="button"
            disabled={disabled}
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
              },
              "&.Mui-disabled": {
                borderColor: "#555",
                color: "#666",
                background: "#000"
              }
            }}
          >
            {OPTION_LABEL[option]}
          </Button>
        );
      })}
    </Box>
  );
}
