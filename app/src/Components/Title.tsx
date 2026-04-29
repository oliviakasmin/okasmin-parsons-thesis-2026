import { useEffect, useMemo, useRef, useState } from "react";
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

  const svgPaths = useMemo(
    () => allObjectIds.map((objectId) => `/SVG_outlines/${objectId}_outline.svg`),
    []
  );

  useEffect(() => {
    let cancelled = false;

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
  }, [svgPaths]);

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
      sx={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "clamp(1rem, 3vw, 3rem)"
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          ml: "2rem",
          pr: "1rem",
          display: "flex",
          alignItems: "center",
          alignSelf: "flex-start",
          position: "sticky",
          top: "25vh"
        }}
      >
        <Typography
          variant="h1"
          component="h1"
          sx={{ m: 0, fontSize: "clamp(3rem, 7vw, 9rem)", lineHeight: 0.95 }}
        >
          Ceramics <span style={{ fontStyle: "italic", fontWeight: 100 }}>Undressed</span>
        </Typography>
      </Box>

      <Box
        sx={{
          flex: "0 0 auto",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center"
        }}
      >
        <Box sx={{ height: "85vh", width: "90vh", maxWidth: "62vw" }}>
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
