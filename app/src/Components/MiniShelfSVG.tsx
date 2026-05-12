import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger);

type ParsedOutline = {
  objectId: number;
  minX: number;
  minY: number;
  width: number;
  height: number;
  paths: string[];
};

type MiniShelfSVGProps = {
  objectIds: number[];
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
};

function parseViewBox(svgEl: SVGSVGElement): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const viewBox = svgEl.getAttribute("viewBox");
  if (viewBox) {
    const [minX, minY, width, height] = viewBox.split(/\s+/).map(Number);
    return { minX, minY, width, height };
  }

  const width = Number(svgEl.getAttribute("width") ?? 0);
  const height = Number(svgEl.getAttribute("height") ?? 0);
  return { minX: 0, minY: 0, width, height };
}

/**
 * Find the fraction (0–1) along the path that is geometrically closest to the
 * bottom-center of the path's bounding box. Used as the "origin" for a
 * draw-from-bottom-center animation, since the SVG outlines don't all start
 * their `M` command at the same point on the silhouette.
 */
function getBottomCenterFraction(path: SVGPathElement): number {
  const total = path.getTotalLength();
  if (!total) return 0.5;

  const bbox = path.getBBox();
  const targetX = bbox.x + bbox.width / 2;
  const targetY = bbox.y + bbox.height;

  const samples = 200;
  let bestFrac = 0.5;
  let bestDist = Infinity;

  for (let i = 0; i <= samples; i++) {
    const frac = i / samples;
    const pt = path.getPointAtLength(frac * total);
    const dx = pt.x - targetX;
    const dy = pt.y - targetY;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestFrac = frac;
    }
  }

  return bestFrac;
}

async function loadOutline(objectId: number): Promise<ParsedOutline | null> {
  try {
    const response = await fetch(`/SVG_outlines/${objectId}_outline.svg`);
    if (!response.ok) return null;
    const svgText = await response.text();
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return null;

    const { minX, minY, width, height } = parseViewBox(svgEl);
    if (!width || !height) return null;

    const paths = Array.from(doc.querySelectorAll("path"))
      .map((pathEl) => pathEl.getAttribute("d") ?? "")
      .filter(Boolean);

    if (!paths.length) return null;

    return {
      objectId,
      minX,
      minY,
      width,
      height,
      paths
    };
  } catch {
    return null;
  }
}

export default function MiniShelfSVG({
  objectIds,
  size = 96,
  stroke = "#fff",
  strokeWidth = 2,
  className
}: MiniShelfSVGProps) {
  const [outlines, setOutlines] = useState<ParsedOutline[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAllOutlines() {
      const loaded = await Promise.all(objectIds.map(loadOutline));
      if (cancelled) return;
      setOutlines(loaded.filter((outline): outline is ParsedOutline => Boolean(outline)));
    }

    loadAllOutlines();

    return () => {
      cancelled = true;
    };
  }, [objectIds]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || outlines.length === 0) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: svg,
          start: "top 90%",
          toggleActions: "play none none reverse"
        }
      });

      outlines.forEach((outline, index) => {
        const paths = svg.querySelectorAll<SVGPathElement>(`#outline-${outline.objectId} path`);
        if (paths.length === 0) return;

        paths.forEach((path) => {
          const pct = getBottomCenterFraction(path) * 100;
          gsap.set(path, { drawSVG: `${pct}% ${pct}%` });
        });

        tl.to(
          paths,
          {
            drawSVG: "0% 100%",
            duration: 3,
            ease: "none"
          },
          index * 1.2
        );
      });
    }, svg);

    return () => ctx.revert();
  }, [outlines]);

  const layout = useMemo(() => {
    const baselineY = size;
    let cursorX = 0;

    const placed = outlines.map((outline) => {
      const scale = size / outline.height;
      const scaledWidth = outline.width * scale;
      const transform = `translate(${cursorX} ${baselineY}) scale(${scale}) translate(${-outline.minX} ${-(outline.minY + outline.height)})`;

      const item = {
        ...outline,
        transform,
        x: cursorX,
        scaledWidth
      };
      cursorX += scaledWidth;
      return item;
    });

    const totalWidth = Math.max(cursorX, 1);
    /** 1px end radius → 2px-tall pill (`borderBottom*Radius: 1` on 2px CSS rules). */
    const shelfRuleHalfHeight = 1;
    const totalHeight = baselineY + shelfRuleHalfHeight;

    return {
      placed,
      baselineY,
      totalWidth,
      totalHeight,
      shelfRuleHalfHeight
    };
  }, [outlines, size]);

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{
        display: "block",
        width: "auto",
        maxWidth: "100%",
        height: `${layout.totalHeight}px`,
        marginInline: "auto"
      }}
      viewBox={`0 0 ${layout.totalWidth} ${layout.totalHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Mini shelf of ceramic outlines"
    >
      {layout.placed.map((outline) => (
        <g
          key={outline.objectId}
          id={`outline-${outline.objectId}`}
          data-object-id={outline.objectId}
          transform={outline.transform}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {outline.paths.map((d, pathIndex) => (
            <path
              key={`${outline.objectId}-${pathIndex}`}
              d={d}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ))}

      <rect
        x={0}
        y={layout.baselineY - layout.shelfRuleHalfHeight}
        width={layout.totalWidth}
        height={layout.shelfRuleHalfHeight * 2}
        rx={layout.shelfRuleHalfHeight}
        ry={layout.shelfRuleHalfHeight}
        fill={stroke}
      />
    </svg>
  );
}
