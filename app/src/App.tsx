import { useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { homeEntryDomId, type HomeEntryScrollId } from "./Components/constants";
import Test from "./Components/Tests/Test";
import Test2 from "./Components/Tests/Test2";
import ClusterTest from "./Components/Tests/ClusterTest";
import {
  Container,
  Anatomy,
  Intro,
  Intro2,
  CaseStudies,
  Shelf,
  Title,
  ShelfFunction,
  ShelfColor,
  ShelfContainer
} from "./Components";
import { ShelfTabProvider } from "./Components/ShelfTabContext";

function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = (location.state as { homeScrollTo?: HomeEntryScrollId } | null) ?? null;

  useEffect(() => {
    if (location.pathname !== "/") return;
    const stateEntry = locationState?.homeScrollTo;
    const hashTargetId = location.hash.startsWith("#") ? location.hash.slice(1) : "";
    const targetId = hashTargetId || (stateEntry ? homeEntryDomId(stateEntry) : "");
    if (!targetId) return;

    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "auto", block: "start" });

    // Consume one-time home scroll state but preserve hash targeting in URL.
    if (stateEntry) {
      navigate(`${location.pathname}${location.hash}`, { replace: true, state: null });
    }
  }, [location.pathname, location.hash, locationState, navigate]);

  return (
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
  );
}

function App() {
  return (
    <ShelfTabProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/test" element={<Test />} />
        <Route path="/test2" element={<Test2 />} />
        <Route path="/cluster-test" element={<ClusterTest />} />
        <Route path="/shelf" element={<Shelf />} />
        <Route path="/title" element={<Title />} />
        <Route path="/shelf-use" element={<ShelfFunction />} />
        <Route path="/shelf-color" element={<ShelfColor />} />
        <Route path="/case-studies" element={<CaseStudies />} />
        <Route path="/all/:clusterId" element={<Container />} />
      </Routes>
    </ShelfTabProvider>
  );
}

export default App;
