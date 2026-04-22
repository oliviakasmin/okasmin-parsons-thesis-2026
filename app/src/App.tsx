import { Route, Routes, useNavigate } from "react-router-dom";
import Test from "./Test";
import Test2 from "./Test2";
import ClusterTest from "./ClusterTest";
import { Shelf } from "./Components";

function Home() {
  const navigate = useNavigate();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color: "#fff"
      }}
    >
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => navigate("/test")}
          style={{
            border: "1px solid #fff",
            background: "#fff",
            color: "#000",
            padding: "0.6rem 0.9rem",
            borderRadius: "8px",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Test
        </button>
        <button
          type="button"
          onClick={() => navigate("/test2")}
          style={{
            border: "1px solid #fff",
            background: "#fff",
            color: "#000",
            padding: "0.6rem 0.9rem",
            borderRadius: "8px",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Test2
        </button>
        <button
          type="button"
          onClick={() => navigate("/cluster-test")}
          style={{
            border: "1px solid #fff",
            background: "#fff",
            color: "#000",
            padding: "0.6rem 0.9rem",
            borderRadius: "8px",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          ClusterTest
        </button>
        <button
          type="button"
          onClick={() => navigate("/shelf")}
          style={{
            border: "1px solid #fff",
            background: "#fff",
            color: "#000",
            padding: "0.6rem 0.9rem",
            borderRadius: "8px",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Shelf
        </button>
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
    </Routes>
  );
}

export default App;
