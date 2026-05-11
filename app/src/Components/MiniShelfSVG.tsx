import { useEffect, useMemo, useState } from "react";

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
