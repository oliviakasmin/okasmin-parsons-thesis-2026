import { Route, Routes } from "react-router-dom";
import { ClusterSceneProvider } from "./Components/ClusterSceneContext";
import Test from "./Components/Tests/Test";
import Test2 from "./Components/Tests/Test2";
import ClusterTest from "./Components/Tests/ClusterTest";
// import { CaseStudies, Shelf, Title, ShelfFunction, ShelfColor } from "./Components";
import { ShelfTabProvider } from "./Components/ShelfTabContext";
import MainHomeShell from "./MainHomeShell";

// TODO clean up routes
function App() {
  return (
    <ShelfTabProvider>
      <ClusterSceneProvider>
        <Routes>
          <Route path="/" element={<MainHomeShell />} />
          <Route path="/test" element={<Test />} />
          <Route path="/test2" element={<Test2 />} />
          <Route path="/cluster-test" element={<ClusterTest />} />
          {/* <Route path="/shelf" element={<Shelf />} /> */}
          {/* <Route path="/title" element={<Title />} /> */}
          {/* <Route path="/shelf-function" element={<ShelfFunction />} /> */}
          {/* <Route path="/shelf-color" element={<ShelfColor />} /> */}
          {/* <Route path="/case-studies" element={<CaseStudies />} /> */}
        </Routes>
      </ClusterSceneProvider>
    </ShelfTabProvider>
  );
}

export default App;
