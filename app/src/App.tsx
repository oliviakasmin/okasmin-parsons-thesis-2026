import { useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname !== "/") return;
    const entry = (location.state as { homeScrollTo?: HomeEntryScrollId } | null)?.homeScrollTo;
    if (!entry) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    const el = document.getElementById(homeEntryDomId(entry));
    if (!el) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    const scroll = () => el.scrollIntoView({ behavior: "smooth", block: "start" });
    scroll();
    const timeoutId = window.setTimeout(scroll, 120);
    // Consume one-time home scroll state so future home loads default to top.
    navigate(location.pathname, { replace: true, state: null });
    return () => window.clearTimeout(timeoutId);
  }, [location.pathname, location.state, navigate]);

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
