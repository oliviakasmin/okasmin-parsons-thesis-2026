import { Box } from "@mui/material";
import { forwardRef } from "react";
import type { ReactNode } from "react";

type TransitionSceneProps = {
  children: ReactNode;
};

const TransitionScene = forwardRef<HTMLDivElement, TransitionSceneProps>(function TransitionScene(
  { children },
  ref
) {
  return (
    <Box ref={ref} sx={{ position: "relative", width: "100%" }}>
      {children}
    </Box>
  );
});

export default TransitionScene;
