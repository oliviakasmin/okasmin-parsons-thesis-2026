import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { gsap } from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { allObjectIds } from "./title_intro_constants";

gsap.registerPlugin(MorphSVGPlugin);

const MORPH_STEP_DURATION_S = 2.5;

export default function Title() {
  const pathRef = useRef<SVGPathElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [morphPaths, setMorphPaths] = useState<string[]>([]);

  const objectIdsKey = allObjectIds.join(",");

  useEffect(() => {
    let cancelled = false;
    const svgPaths = allObjectIds.map((objectId) => `/SVG_outlines/${objectId}_outline.svg`);

    async function loadPaths() {
      const loadedPaths = await Promise.all(
        svgPaths.map(async (svgPath) => {
          try {
            const response = await fetch(svgPath);
            if (!response.ok) return null;
            const svgText = await response.text();
            const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
            const pathEls = Array.from(doc.querySelectorAll("path"));
            if (!pathEls.length) return null;

            // For small curated sets, choosing the longest path string is a practical stable proxy.
            const bestPath = pathEls
              .map((pathEl) => pathEl.getAttribute("d") ?? "")
              .filter(Boolean)
              .sort((a, b) => b.length - a.length)[0];

            return bestPath ?? null;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setMorphPaths(loadedPaths.filter((d): d is string => Boolean(d)));
      }
    }

    loadPaths();
    return () => {
      cancelled = true;
    };
  }, [objectIdsKey]);

  useEffect(() => {
    const pathEl = pathRef.current;
    if (!pathEl || morphPaths.length < 1) return;

    pathEl.setAttribute("d", morphPaths[0]);
    timelineRef.current?.kill();

    if (morphPaths.length < 2) return;

    const timeline = gsap.timeline({ repeat: -1 });
    for (let index = 1; index < morphPaths.length; index += 1) {
      timeline.to(pathEl, {
        duration: MORPH_STEP_DURATION_S,
        ease: "power2.inOut",
        morphSVG: {
          shape: morphPaths[index],
          shapeIndex: "auto"
        }
      });
    }

    timeline.to(pathEl, {
      duration: MORPH_STEP_DURATION_S,
      ease: "power2.inOut",
      morphSVG: {
        shape: morphPaths[0],
        shapeIndex: "auto"
      }
    });

    timelineRef.current = timeline;

    return () => {
      timeline.kill();
    };
  }, [morphPaths]);

  return (
    <Box
      className="viewport-with-margins"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "clamp(1rem, 3vw, 3rem)"
      }}
    >
      <Box
        sx={{
          flex: "0 1 32rem",
          flexShrink: 1,
          minWidth: 0,
          minHeight: "100%",
          pr: "1rem",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}
      >
        <Box
          sx={{
            pb: "3rem",
            position: "sticky",
            top: "25vh",
            alignSelf: "flex-start",
            backgroundColor: "#000",
            zIndex: 1
          }}
        >
          <Typography
            variant="h1"
            component="h1"
            sx={{
              m: 0,
              px: "0.18em",
              py: "0.12em",
              fontSize: "clamp(2.2rem, 6vw, 9rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.015em",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.4em"
            }}
          >
            <Box
              component="span"
              sx={(theme) => ({
                ...theme.typography.h1,
                fontSize: "inherit",
                lineHeight: "inherit",
                letterSpacing: "-0.01em"
              })}
            >
              Ceramics
            </Box>
            <Box
              component="span"
              sx={(theme) => ({
                ...theme.typography.rocaLight,
                fontSize: "inherit",
                lineHeight: "inherit",
                letterSpacing: "0.005em"
              })}
            >
              Undressed
            </Box>
          </Typography>
        </Box>
        <Typography
          variant="labels"
          component="p"
          sx={{
            m: 0,
            pl: "1rem",
            fontSize: "1.25rem",
            position: "absolute",
            left: 0,
            bottom: "10%"
          }}
        >
          Olivia Kasmin
        </Typography>
      </Box>

      <Box
        sx={{
          flex: "1 0 0",
          minWidth: 0,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center"
        }}
      >
        <Box
          sx={{
            width: "min(100%, calc(100vh - (var(--page-margin) * 2)))",
            aspectRatio: "1 / 1"
          }}
        >
          <svg
            className="title-outline-morph"
            viewBox="0 0 768 768"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Morphing outline object"
          >
            <path
              ref={pathRef}
              d={morphPaths[0] ?? ""}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </Box>
      </Box>
    </Box>
  );
}
