import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { homeEntryDomId } from "../constants";
import { useShelfTab } from "../shelfTabState";
import shelfArrowLongestTimeSpan from "../../../public/arrows/longest_time_span.svg";
import shelfArrowMostCountries from "../../../public/arrows/most_countries.svg";
import shelfArrowBiggestGroup from "../../../public/arrows/biggest_group.svg";
import shelfArrowOutliers from "../../../public/arrows/outliers.svg";
import Shelf from "./Shelf";
import ShelfUse from "./ShelfUse";
import ShelfColor from "./ShelfColor";

const tabTextColor = {
  active: "#fff",
  inactive: "#585858"
};

/** Default gap between an arrow graphic and the shape shelf row it annotates (not tied to tile column gap). */
const SHELF_SHAPE_ARROW_GAP_PX = 12;

type ShelfShapeArrowSpec =
  | { key: string; src: string; side: "left"; rowIndex: number; gapPx?: number; alt?: string }
  | {
      key: string;
      src: string;
      side: "above" | "below";
      rowIndex: number;
      xFraction: number;
      gapPx?: number;
      alt?: string;
    };

const SHELF_SHAPE_ARROWS: ShelfShapeArrowSpec[] = [
  { key: "longest_time_span", src: shelfArrowLongestTimeSpan, side: "left", rowIndex: 1 },
  { key: "most_countries", src: shelfArrowMostCountries, side: "left", rowIndex: 2 },
  {
    key: "biggest_group",
    src: shelfArrowBiggestGroup,
    side: "above",
    rowIndex: 0,
    xFraction: 0.75,
    gapPx: 32
  },
  { key: "outliers", src: shelfArrowOutliers, side: "below", rowIndex: 2, xFraction: 0.75 }
];

type ShelfShapeArrowLayout = {
  topPx: number;
  leftPx: number;
  transform: string;
  visible: boolean;
};

const HIDDEN_ARROW_LAYOUT: ShelfShapeArrowLayout = {
  topPx: 0,
  leftPx: 0,
  transform: "translate(0, 0)",
  visible: false
};

function measureShelfShapeArrowLayouts(
  outerSection: HTMLElement,
  scrollPane: HTMLElement
): Record<string, ShelfShapeArrowLayout> {
  const result: Record<string, ShelfShapeArrowLayout> = {};
  for (const spec of SHELF_SHAPE_ARROWS) result[spec.key] = HIDDEN_ARROW_LAYOUT;

  const main = scrollPane.querySelector("main");
  const section = main?.querySelector(":scope > section");
  if (!section) return result;

  const outerRect = outerSection.getBoundingClientRect();
  for (const spec of SHELF_SHAPE_ARROWS) {
    const row = section.children[spec.rowIndex];
    if (!(row instanceof HTMLElement)) continue;
    const rowRect = row.getBoundingClientRect();

    const gapPx = spec.gapPx ?? SHELF_SHAPE_ARROW_GAP_PX;
    if (spec.side === "left") {
      result[spec.key] = {
        topPx: rowRect.top - outerRect.top + rowRect.height / 2,
        leftPx: rowRect.left - outerRect.left - gapPx,
        transform: "translate(-100%, -50%)",
        visible: true
      };
    } else if (spec.side === "above") {
      result[spec.key] = {
        topPx: rowRect.top - outerRect.top - gapPx,
        leftPx: rowRect.left - outerRect.left + rowRect.width * spec.xFraction,
        transform: "translate(-50%, -100%)",
        visible: true
      };
    } else {
      result[spec.key] = {
        topPx: rowRect.bottom - outerRect.top + gapPx,
        leftPx: rowRect.left - outerRect.left + rowRect.width * spec.xFraction,
        transform: "translate(-50%, 0)",
        visible: true
      };
    }
  }
  return result;
}

const INITIAL_HIDDEN_LAYOUTS: Record<string, ShelfShapeArrowLayout> = Object.fromEntries(
  SHELF_SHAPE_ARROWS.map((spec) => [spec.key, HIDDEN_ARROW_LAYOUT])
);

export default function ShelfContainer() {
  const { selectedShelfTab, setSelectedShelfTab } = useShelfTab();
  const outerSectionRef = useRef<HTMLElement | null>(null);
  const scrollPaneRef = useRef<HTMLDivElement | null>(null);
  const [shapeArrowLayouts, setShapeArrowLayouts] =
    useState<Record<string, ShelfShapeArrowLayout>>(INITIAL_HIDDEN_LAYOUTS);

  const content = useMemo(() => {
    if (selectedShelfTab === "shape") return <Shelf />;
    if (selectedShelfTab === "use") return <ShelfUse />;
    return <ShelfColor />;
  }, [selectedShelfTab]);

  const showShapeArrows = selectedShelfTab === "shape";

  useLayoutEffect(() => {
    if (!showShapeArrows) {
      setShapeArrowLayouts(INITIAL_HIDDEN_LAYOUTS);
      return;
    }

    const outerSection = outerSectionRef.current;
    const scrollPane = scrollPaneRef.current;
    if (!outerSection || !scrollPane) return;

    const apply = () => {
      setShapeArrowLayouts(measureShelfShapeArrowLayouts(outerSection, scrollPane));
    };

    apply();
    const raf = window.requestAnimationFrame(() => apply());

    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(apply);
    });
    ro.observe(outerSection);
    ro.observe(scrollPane);

    const main = scrollPane.querySelector("main");
    if (main instanceof HTMLElement) ro.observe(main);
    const section = main?.querySelector(":scope > section");
    if (section instanceof HTMLElement) ro.observe(section);

    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [showShapeArrows]);

  return (
    <Box
      component="section"
      ref={outerSectionRef}
      id={homeEntryDomId("shelf")}
      sx={{
        height: "100vh",
        width: "100%",
        position: "relative",
        background: "#000",
        overflow: "visible"
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
        ref={scrollPaneRef}
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

      {showShapeArrows
        ? SHELF_SHAPE_ARROWS.map((spec) => {
            const layout = shapeArrowLayouts[spec.key];
            if (!layout?.visible) return null;
            return (
              <Box
                key={spec.key}
                alt={spec.alt ?? ""}
                aria-hidden
                component="img"
                draggable={false}
                src={spec.src}
                sx={{
                  position: "absolute",
                  top: layout.topPx,
                  left: layout.leftPx,
                  transform: layout.transform,
                  width: "auto",
                  height: "auto",
                  display: "block",
                  pointerEvents: "none",
                  zIndex: 3
                }}
              />
            );
          })
        : null}
    </Box>
  );
}
