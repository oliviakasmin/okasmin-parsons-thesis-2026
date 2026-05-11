import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { homeEntryDomId } from "../constants";
import { useShelfTab } from "../shelfTabState";
import Shelf from "./Shelf";
import ShelfUse from "./ShelfUse";
import ShelfColor from "./ShelfColor";

const tabTextColor = {
  active: "#fff",
  inactive: "#585858"
};

export default function ShelfContainer() {
  const { selectedShelfTab, setSelectedShelfTab } = useShelfTab();

  const content = useMemo(() => {
    if (selectedShelfTab === "shape") return <Shelf />;
    if (selectedShelfTab === "use") return <ShelfUse />;
    return <ShelfColor />;
  }, [selectedShelfTab]);

  return (
    <Box
      component="section"
      id={homeEntryDomId("shelf")}
      sx={{
        height: "100vh",
        width: "100%",
        position: "relative",
        background: "#000",
        overflow: "hidden"
      }}
    >
      <Box
        sx={{
          width: "min(32vw, 320px)",
          minWidth: "220px",
          pl: "2rem",
          // Match the vertically centered shelf stack so the tabs align with the top row image line.
          pt: "calc((100vh - (3 * (min(138.24px, calc((100vh - 240px) / 3)) + 4px) + 110.592px + 3rem)) / 2 + 1.5rem)",
          pb: "6rem",
          display: "flex",
          alignItems: "flex-start",
          position: "absolute",
          top: 0,
          left: 0,
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
            {(["shape", "use", "color"] as const).map((tab, index) => (
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

      <Box sx={{ display: "none" }} id={homeEntryDomId("shelf-use")} />
      <Box sx={{ display: "none" }} id={homeEntryDomId("shelf-color")} />

      <Box
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: "min(32vw, 320px)",
          minWidth: 0,
          overflow: "auto",
          background: "#000",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <Box
          sx={{
            marginBlock: "auto",
            width: "100%",
            minHeight: "min-content"
          }}
        >
          {content}
        </Box>
      </Box>
    </Box>
  );
}
