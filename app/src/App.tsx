import { Route, Routes, useNavigate } from "react-router-dom";
import Test from "./Test";

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
        Open Test View
      </button>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/test" element={<Test />} />
    </Routes>
  );
}

export default App;
