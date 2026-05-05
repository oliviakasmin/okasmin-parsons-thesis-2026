import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { homeEntryDomId, type HomeEntryScrollId } from "../constants";
import useInlineSvg from "../../hooks/useInlineSvg";
import type { ShelfSlot } from "./shelfGridStyles";
import {
  shelfArticleSx,
  shelfEmptySlotSx,
  shelfGridRowSx,
  shelfGridStackSx,
  shelfOverlayLabelSx,
  shelfSlotInnerMediaSx,
  shelfSlotSurfaceSx,
  shelfTabMainSx
} from "./shelfGridStyles";

const shelfEntryScrollId: HomeEntryScrollId = "shelf";

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

const clusterLabels: Record<string, string> = {
  cluster_0: "outliers",
  cluster_1: "wide outliers",
  cluster_2: "narrow outliers"
  // cluster_3: "wider with tall shoulders",
  // cluster_4: "bulbous body with longer neck",
  // cluster_5: "Core",
  // cluster_6: "squat",
  // cluster_7: "Core",
  // cluster_8: "round",
  // cluster_9: "probably a pitcher",
  // cluster_10: "narrow with tall shoulders",
  // cluster_11: "medium belly with a neck"
};

type AnimatedSampledSvgProps = {
  src: string;
  alt: string;
};

function restartShelfPathDraw(paths: NodeListOf<SVGPathElement>) {
  paths.forEach((path, index) => {
    path.style.animation = "none";
    // Force style flush so restarting animation only affects selected paths.
    void path.getBoundingClientRect();
    path.style.animation = `shelfPathDraw 1800ms ease forwards`;
    path.style.animationDelay = `${index * 120}ms`;
  });
}

function AnimatedSampledSvg({ src, alt }: AnimatedSampledSvgProps) {
  const { svgMarkup } = useInlineSvg(src);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!wrapperRef.current || !svgMarkup) return;

    const paths = wrapperRef.current.querySelectorAll<SVGPathElement>("svg path");
    paths.forEach((path, index) => {
      const length = path.getTotalLength();
      const computedStrokeWidth = Number.parseFloat(window.getComputedStyle(path).strokeWidth);
      // Slightly thicken outlines while preserving each path's relative stroke width.
      path.style.strokeWidth = Number.isFinite(computedStrokeWidth)
        ? `${computedStrokeWidth * 1.75}px`
        : "1.2px";
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.animation = "none";
      path.style.animation = `shelfPathDraw 1800ms ease forwards`;
      path.style.animationDelay = `${index * 120}ms`;
    });
  }, [svgMarkup]);

  if (!svgMarkup) {
    return <Box aria-label={alt} sx={{ width: "100%", height: "100%", display: "block" }} />;
  }

  return (
    <Box
      ref={wrapperRef}
      aria-label={alt}
      role="img"
      sx={{
        // py: "0.25rem",
        width: "100%",
        height: "100%",
        display: "block",
        "& > svg": {
          width: "100%",
          height: "100%",
          display: "block"
        },
        "@keyframes shelfPathDraw": {
          to: {
            strokeDashoffset: 0
          }
        }
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}

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
                      state: { homeScrollTo: shelfEntryScrollId }
                    })
                  }
                  sx={shelfArticleSx("shelf-cluster-label")}
                >
                  <Box sx={shelfSlotSurfaceSx()}>
                    <Box sx={shelfSlotInnerMediaSx()}>
                      {isShelfHalfVisible && (
                        <AnimatedSampledSvg
                          key={`${clusterId}-${shelfAnimationCycle}`}
                          src={stackedSvgSrc}
                          alt={`${clusterId}_stack_sampled.svg`}
                        />
                      )}
                    </Box>
                  </Box>
                  <Typography
                    className="shelf-cluster-label"
                    component="span"
                    sx={shelfOverlayLabelSx}
                  >
                    {clusterLabels[clusterId] ?? clusterId}
                  </Typography>
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
