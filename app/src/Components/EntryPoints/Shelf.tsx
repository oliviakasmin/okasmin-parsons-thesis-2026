import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { homeEntryDomId, SHELF_RENDER_IMAGE_SIZE_PX, type HomeEntryScrollId } from "../constants";
import useInlineSvg from "../../hooks/useInlineSvg";

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

// 10, 8, 6
// 5, 7, 3
// 4, 9, 11
// 0, 1, 2

const shelves = [
  [cluster10, cluster8, cluster6],
  [cluster5, cluster7, cluster3],
  [cluster4, cluster9, cluster11],
  [cluster0, cluster1, cluster2]
];

const clusterLabels: Record<string, string> = {
  cluster_0: "Outliers",
  cluster_1: "Weird Cluster",
  cluster_2: "Weird Cluster",
  cluster_3: "Core",
  cluster_4: "Core",
  cluster_5: "Core",
  cluster_6: "Core",
  cluster_7: "Core",
  cluster_8: "Core"
};

type AnimatedSampledSvgProps = {
  src: string;
  alt: string;
};

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
  const [isShelfHalfVisible, setIsShelfHalfVisible] = useState(false);
  const shelfRef = useRef<HTMLElement | null>(null);
  const hasHandledInitialIntersectionRef = useRef(false);
  const orderedClusterIds = useMemo(() => shelves.flat(), []);

  useEffect(() => {
    if (!shelfRef.current) return;
    let revealFrameId: number | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isHalfVisible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        if (!hasHandledInitialIntersectionRef.current) {
          // Keep images hidden on mount/remount, then reveal on next frame if already in view.
          hasHandledInitialIntersectionRef.current = true;
          setIsShelfHalfVisible(false);
          if (isHalfVisible) {
            revealFrameId = window.requestAnimationFrame(() => {
              setIsShelfHalfVisible(true);
            });
          }
          return;
        }
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

  return (
    <Box
      component="main"
      ref={shelfRef}
      id={homeEntryDomId(shelfEntryScrollId)}
      sx={{
        height: "100vh",
        background: "#000",
        color: "#fff",
        py: "1.5rem",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto"
      }}
    >
      <Box
        component="section"
        sx={{
          flex: 1,
          minHeight: 0,
          width: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX * 3}px)`,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridTemplateRows: "repeat(4, auto)",
          justifyContent: "center",
          columnGap: 0,
          rowGap: 0
        }}
      >
        {orderedClusterIds.map((clusterId) => {
          const stackedSvgSrc = `/cluster_SVG_stacked_outlines/${clusterId}_stack_sampled.svg`;
          return (
            <Box
              component="article"
              key={clusterId}
              onMouseEnter={(event) => {
                const paths = event.currentTarget.querySelectorAll<SVGPathElement>("svg path");
                paths.forEach((path, index) => {
                  path.style.animation = "none";
                  // Force style flush so restarting animation only affects this hovered card.
                  void path.getBoundingClientRect();
                  path.style.animation = `shelfPathDraw 1800ms ease forwards`;
                  path.style.animationDelay = `${index * 120}ms`;
                });
              }}
              onClick={() =>
                navigate(`/all/${clusterId}`, {
                  state: { homeScrollTo: shelfEntryScrollId }
                })
              }
              sx={{
                display: "flex",
                flexDirection: "column",
                position: "relative",
                minHeight: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.74}px`,
                maxHeight: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.92}px`,
                cursor: "pointer",
                "&:hover .shelf-cluster-label": {
                  opacity: 1,
                  visibility: "visible"
                }
              }}
            >
              <Box
                sx={{
                  marginTop: "auto",
                  width: "100%",
                  height: `min(${SHELF_RENDER_IMAGE_SIZE_PX * 0.86}px, calc((100vh - 240px) / 4))`,
                  position: "relative",
                  background: "#000",
                  overflow: "hidden",
                  paddingLeft: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.25}px`,
                  paddingRight: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.25}px`,
                  boxSizing: "border-box",
                  borderBottom: "4px solid #fff"
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    left: "50%",
                    bottom: "-3px",
                    transform: "translateX(-50%)",
                    width: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                    height: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / 4))`,
                    maxWidth: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                    maxHeight: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
                    display: "block"
                  }}
                >
                  {isShelfHalfVisible && (
                    <AnimatedSampledSvg
                      src={stackedSvgSrc}
                      alt={`${clusterId}_stack_sampled.svg`}
                    />
                  )}
                </Box>
              </Box>
              <Typography
                className="shelf-cluster-label"
                component="span"
                sx={{
                  position: "absolute",
                  left: "50%",
                  top: "100%",
                  transform: "translateX(-50%)",
                  mt: "0.08rem",
                  fontSize: "0.62rem",
                  letterSpacing: "0.03em",
                  opacity: 0,
                  visibility: "hidden",
                  transition: "opacity 120ms ease",
                  pointerEvents: "none",
                  whiteSpace: "nowrap"
                }}
              >
                {clusterLabels[clusterId] ?? clusterId}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default Shelf;
