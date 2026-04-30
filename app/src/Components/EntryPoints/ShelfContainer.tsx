import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { homeEntryDomId } from "../constants";
import { useShelfTab } from "../shelfTabState";
import Shelf from "./Shelf";
import ShelfFunction from "./ShelfFunction";
import ShelfColor from "./ShelfColor";

const tabTextColor = {
  active: "#fff",
  inactive: "#585858"
};

export default function ShelfContainer() {
  const { selectedShelfTab, setSelectedShelfTab } = useShelfTab();

  const content = useMemo(() => {
    if (selectedShelfTab === "shape") return <Shelf />;
    if (selectedShelfTab === "type") return <ShelfFunction />;
    return <ShelfColor />;
  }, [selectedShelfTab]);

  return (
    <Box
      component="section"
      id={homeEntryDomId("shelf")}
      sx={{
        height: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        background: "#000"
      }}
    >
      <Box
        sx={{
          width: "min(32vw, 320px)",
          minWidth: "220px",
          px: "0.75rem",
          pt: "2rem",
          pb: "0.35rem",
          display: "flex",
          alignItems: "flex-start"
        }}
      >
        <Typography
          variant="h3"
          sx={{
            m: 0,
            fontSize: "2rem",
            color: tabTextColor.active,
            lineHeight: 1.05,
            letterSpacing: "0.02em"
          }}
        >
          <Box component="span" sx={{ display: "block" }}>
            choose a
          </Box>
          <Box component="span" sx={{ display: "block" }}>
            {(["shape", "type", "color"] as const).map((tab, index) => (
              <span key={tab}>
                <Typography
                  component="button"
                  onClick={() => setSelectedShelfTab(tab)}
                  sx={{
                    border: 0,
                    background: "transparent",
                    padding: 0,
                    margin: 0,
                    cursor: "pointer",
                    font: "inherit",
                    fontSize: "2rem",
                    lineHeight: 1.05,
                    letterSpacing: "0.02em",
                    verticalAlign: "baseline",
                    color: selectedShelfTab === tab ? tabTextColor.active : tabTextColor.inactive
                  }}
                >
                  {tab}
                </Typography>
                {index < 2 ? (
                  <Typography
                    component="span"
                    sx={{ fontSize: "2rem", color: tabTextColor.inactive, lineHeight: 1.05 }}
                  >
                    {" | "}
                  </Typography>
                ) : null}
              </span>
            ))}
          </Box>
        </Typography>
      </Box>

      <Box sx={{ display: "none" }} id={homeEntryDomId("shelf-function")} />
      <Box sx={{ display: "none" }} id={homeEntryDomId("shelf-color")} />

      <Box sx={{ flex: 1, minWidth: 0, height: "100vh" }}>{content}</Box>
    </Box>
  );
}
