import { Box } from "@mui/material";
import {
  Anatomy,
  CaseStudies,
  Container,
  Intro,
  Intro2,
  ShelfContainer,
  Title
} from "./Components";
import { useClusterScene } from "./Components/ClusterSceneContext";

export default function MainHomeShell() {
  const { activeClusterId, overlayInitialImageMode } = useClusterScene();

  return (
    <>
      <main>
        <div style={{ display: "grid", gap: "4rem" }}>
          <Title />
          <Intro />
          <Anatomy />
          <Intro2 />
          <ShelfContainer />
          <CaseStudies />
        </div>
      </main>

      {activeClusterId ? (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 1300,
            background: "#000",
            overflow: "auto"
          }}
        >
          <Container clusterId={activeClusterId} initialImageMode={overlayInitialImageMode} />
        </Box>
      ) : null}
    </>
  );
}
