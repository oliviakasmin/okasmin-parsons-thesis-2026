import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { homeEntryDomId, type HomeEntryScrollId } from "../constants";
import type { ShelfSlot } from "./shelfGridStyles";
import { restartShelfPathDraw, ShelfStackedOutlineSvg } from "./ShelfStackedOutlineSvg";
import {
  shelfArticleTileSx,
  shelfEmptySlotSx,
  shelfGridRowSx,
  shelfGridStackSx,
  shelfOverlayLabelSx,
  shelfSlotInnerMediaSx,
  shelfSlotSurfaceSx,
  shelfTabMainSx
} from "./shelfGridStyles";
import objectStatsJson from "../../../public/data/object_stats.json";

const shelfEntryScrollId: HomeEntryScrollId = "shelf";

const shapeClusterLabelsById = (
  objectStatsJson as { byShapeClusterGroup?: Record<string, { label?: string }> }
).byShapeClusterGroup;

const cluster0 = "cluster_0";
const cluster1 = "cluster_1";
const cluster2 = "cluster_2";
const cluster3 = "cluster_3";
const cluster4 = "cluster_4";
const cluster5 = "cluster_5";
const cluster6 = "cluster_6";
const cluster7 = "cluster_7";
const cluster8 = "cluster_8";
const cluster9 = "cluster_9";
const cluster10 = "cluster_10";
const cluster11 = "cluster_11";

/** Row-major shelf positions; use `undefined` for an intentional gap (one tile wide). Fewer than five entries in a row spread evenly across the row. */
const SHELF_LAYOUT: ShelfSlot<string>[][] = [
  [cluster10, cluster8, cluster6, cluster7],
  [cluster3, cluster4, cluster5, cluster11],
  [cluster9, cluster0, cluster1, cluster2]
];

function Shelf() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isShelfHalfVisible, setIsShelfHalfVisible] = useState(false);
  const [shelfAnimationCycle, setShelfAnimationCycle] = useState(0);
  const shelfRef = useRef<HTMLElement | null>(null);
  const hasHandledInitialIntersectionRef = useRef(false);
  const wasShelfHalfVisibleRef = useRef(false);

  useEffect(() => {
    if (!shelfRef.current) return;
    let revealFrameId: number | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isHalfVisible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        if (!hasHandledInitialIntersectionRef.current) {
          // Keep images hidden on mount/remount, then reveal on next frame if already in view.
          hasHandledInitialIntersectionRef.current = true;
          wasShelfHalfVisibleRef.current = false;
          setIsShelfHalfVisible(false);
          if (isHalfVisible) {
            revealFrameId = window.requestAnimationFrame(() => {
              setShelfAnimationCycle((cycle) => cycle + 1);
              wasShelfHalfVisibleRef.current = true;
              setIsShelfHalfVisible(true);
            });
          }
          return;
        }
        if (isHalfVisible && !wasShelfHalfVisibleRef.current) {
          setShelfAnimationCycle((cycle) => cycle + 1);
        }
        wasShelfHalfVisibleRef.current = isHalfVisible;
        setIsShelfHalfVisible(isHalfVisible);
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(shelfRef.current);
    return () => {
      observer.disconnect();
      if (revealFrameId !== null) {
        window.cancelAnimationFrame(revealFrameId);
      }
    };
  }, []);

  useEffect(() => {
    // Deterministic replay on Back without hide/show flash:
    // ensure SVGs are mounted, then bump cycle so they remount and redraw.
    wasShelfHalfVisibleRef.current = true;
    setIsShelfHalfVisible(true);
    setShelfAnimationCycle((cycle) => cycle + 1);
  }, [location.key]);

  return (
    <Box
      component="main"
      ref={shelfRef}
      id={homeEntryDomId(shelfEntryScrollId)}
      sx={shelfTabMainSx}
    >
      <Box component="section" sx={shelfGridStackSx}>
        {SHELF_LAYOUT.map((row, rowIndex) => (
          <Box key={`shape-row-${rowIndex}`} sx={shelfGridRowSx(row.length)}>
            {row.map((clusterId, slotIndex) => {
              if (clusterId === undefined) {
                return (
                  <Box key={`shape-gap-${rowIndex}-${slotIndex}`} aria-hidden sx={shelfEmptySlotSx}>
                    <Box sx={shelfSlotSurfaceSx()} />
                  </Box>
                );
              }

              const stackedSvgSrc = `/cluster_SVG_stacked_outlines/${clusterId}_stack_sampled.svg`;
              const clusterLabel = shapeClusterLabelsById?.[clusterId]?.label?.trim();
              return (
                <Box
                  component="article"
                  key={clusterId}
                  onMouseEnter={(event) => {
                    const paths = event.currentTarget.querySelectorAll<SVGPathElement>("svg path");
                    restartShelfPathDraw(paths);
                  }}
                  onClick={() =>
                    navigate(`/all/${clusterId}`, {
                      state: { homeScrollTo: shelfEntryScrollId, fromShelf: true }
                    })
                  }
                  sx={shelfArticleTileSx}
                >
                  <Box sx={shelfSlotSurfaceSx()}>
                    <Box sx={shelfSlotInnerMediaSx()}>
                      {isShelfHalfVisible && (
                        <ShelfStackedOutlineSvg
                          key={`${clusterId}-${shelfAnimationCycle}`}
                          src={stackedSvgSrc}
                          alt={`${clusterId}_stack_sampled.svg`}
                        />
                      )}
                    </Box>
                  </Box>
                  {clusterLabel ? (
                    <Typography
                      component="span"
                      sx={{
                        ...shelfOverlayLabelSx,
                        opacity: 1,
                        visibility: "visible"
                      }}
                    >
                      {clusterLabel}
                    </Typography>
                  ) : null}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default Shelf;
