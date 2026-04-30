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
  const isShapeTab = selectedShelfTab === "shape";

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
        position: isShapeTab ? "relative" : "static",
        background: "#000",
        overflow: isShapeTab ? "hidden" : "auto",
        display: isShapeTab ? "block" : "flex",
        flexDirection: isShapeTab ? "row" : "column"
      }}
    >
      <Box
        sx={{
          width: "min(32vw, 320px)",
          minWidth: "220px",
          pl: "2rem",
          pt: "25vh",
          pb: "6rem",
          display: "flex",
          alignItems: "flex-start",
          position: isShapeTab ? "absolute" : "relative",
          top: isShapeTab ? 0 : "auto",
          left: isShapeTab ? 0 : "auto",
          zIndex: 2,
          pointerEvents: "auto"
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

      <Box
        sx={
          isShapeTab
            ? {
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: "min(32vw, 320px)",
                minWidth: 0,
                height: "100vh"
              }
            : {
                position: "relative",
                top: "auto",
                left: "auto",
                right: "auto",
                bottom: "auto",
                width: "100%",
                minWidth: 0,
                display: "flex",
                justifyContent: "center",
                flex: 1
              }
        }
      >
        {content}
      </Box>
    </Box>
  );
}
