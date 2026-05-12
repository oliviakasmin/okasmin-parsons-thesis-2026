import { Box } from "@mui/material";
import { Route, Routes } from "react-router-dom";
import { ClusterSceneProvider, useClusterScene } from "./Components/ClusterSceneContext";
import Test from "./Components/Tests/Test";
import Test2 from "./Components/Tests/Test2";
import ClusterTest from "./Components/Tests/ClusterTest";
import { CaseStudies, Container, Shelf, Title, ShelfUse, ShelfColor } from "./Components";
import { ShelfTabProvider } from "./Components/ShelfTabContext";
import MainHomeShell from "./MainHomeShell";

function ClusterOverlay() {
  const { activeClusterId, overlayInitialImageMode, overlayFromShelf } = useClusterScene();
  if (!activeClusterId) return null;
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "#000",
        overflow: "auto"
      }}
    >
      <Container
        clusterId={activeClusterId}
        initialImageMode={overlayInitialImageMode}
        fromShelf={overlayFromShelf}
      />
    </Box>
  );
}

function App() {
  return (
    <ShelfTabProvider>
      <ClusterSceneProvider>
        <>
          <Routes>
            <Route path="/" element={<MainHomeShell />} />
            <Route path="/test" element={<Test />} />
            <Route path="/test2" element={<Test2 />} />
            <Route path="/cluster-test" element={<ClusterTest />} />
            <Route path="/shelf" element={<Shelf />} />
            <Route path="/title" element={<Title />} />
            <Route path="/shelf-use" element={<ShelfUse />} />
            <Route path="/shelf-color" element={<ShelfColor />} />
            <Route path="/case-studies" element={<CaseStudies />} />
          </Routes>
          <ClusterOverlay />
        </>
      </ClusterSceneProvider>
    </ShelfTabProvider>
  );
}

export default App;
