import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { homeEntryDomId, type HomeEntryScrollId } from "./Components/constants";
import Test from "./Components/Tests/Test";
import Test2 from "./Components/Tests/Test2";
import ClusterTest from "./Components/Tests/ClusterTest";
import {
  Container,
  Intro,
  CaseStudies,
  Shelf,
  Title,
  ShelfFunction,
  ShelfColor
} from "./Components";

function Home() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== "/") return;
    const entry = (location.state as { homeScrollTo?: HomeEntryScrollId } | null)?.homeScrollTo;
    if (!entry) return;
    const el = document.getElementById(homeEntryDomId(entry));
    if (!el) return;
    const scroll = () => el.scrollIntoView({ behavior: "smooth", block: "start" });
    scroll();
    const timeoutId = window.setTimeout(scroll, 120);
    return () => window.clearTimeout(timeoutId);
  }, [location.pathname, location.state]);

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
        <Intro />

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
      <Route path="/all/:clusterId" element={<Container />} />
    </Routes>
  );
}

export default App;
