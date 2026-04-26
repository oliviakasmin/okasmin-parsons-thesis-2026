import { Route, Routes } from "react-router-dom";
import Test from "./Components/Tests/Test";
import Test2 from "./Components/Tests/Test2";
import ClusterTest from "./Components/Tests/ClusterTest";
import { All, Shelf } from "./Components";
import Title from "./Components/Title";
import ShelfFunction from "./Components/ShelfFunction";
import ShelfColor from "./Components/ShelfColor";
import CaseStudies from "./Components/CaseStudies";

function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        background: "#000",
        color: "#fff",
        padding: "2rem"
      }}
    >
      <div style={{ display: "grid", gap: "1rem", width: "100%" }}>
        <Title />
        <Shelf />
        <ShelfFunction />
        <ShelfColor />
        <CaseStudies />
      </div>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/test" element={<Test />} />
      <Route path="/test2" element={<Test2 />} />
      <Route path="/cluster-test" element={<ClusterTest />} />
      <Route path="/shelf" element={<Shelf />} />
      <Route path="/title" element={<Title />} />
      <Route path="/shelf-function" element={<ShelfFunction />} />
      <Route path="/shelf-color" element={<ShelfColor />} />
      <Route path="/case-studies" element={<CaseStudies />} />
      <Route path="/all/:clusterId" element={<All />} />
    </Routes>
  );
}

export default App;
