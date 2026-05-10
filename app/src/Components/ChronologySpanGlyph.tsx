import { Box, Tooltip } from "@mui/material";
import { scaleLinear } from "d3-scale";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatYearForTick } from "../utils/formatYearTick";

const MIN_COORD_WIDTH = 112;

export type ChronologySpanGlyphProps = {
  corpusMin: number;
  corpusMax: number;
  anchorYear: number | null;
  neighborYear: number | null;
  /** `final_date` from fields (neighbor row); shown as text under the neighbor tick in the SVG. */
  neighborFinalDate?: string;
  /** Fixed coordinate width when `fullWidth` is false. */
  width?: number;
  height?: number;
  /** Grow to container width (via ResizeObserver); coordinate space matches measured px width. */
  fullWidth?: boolean;
  /** When false, no nested Tooltip (parent supplies hover surface). */
  showInteractiveTooltip?: boolean;
};

function formatNeighborDateLabel(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (!/^-?\d+$/.test(t)) return t;
  return formatYearForTick(Number(t));
}

/** Neighbor vs selected date (anchor): earlier / later / same year. */
function yearsEarlierLaterPhrase(anchorYear: number, neighborYear: number): string {
  const delta = Math.abs(neighborYear - anchorYear);
  const n = delta.toLocaleString();
  if (delta === 0) return "Same year";
  if (neighborYear < anchorYear) return `${n} years earlier`;
  return `${n} years later`;
}

/** Tooltip copy for chronology comparison on the timeline glyph. */
export function chronologyComparisonTooltipTitle(
  anchorYear: number | null,
  neighborYear: number | null
): string {
  if (anchorYear == null || neighborYear == null) {
    return "Cannot compare dates";
  }
  return yearsEarlierLaterPhrase(anchorYear, neighborYear);
}

export const chronologyTooltipSlotProps = {
  slotProps: {
    tooltip: {
      sx: {
        bgcolor: "#2a2a2a",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.2)",
        fontSize: "0.8rem"
      }
    }
  }
} as const;

function buildAriaLabel(p: ChronologySpanGlyphProps): string {
  const span = `${p.corpusMin.toLocaleString()}–${p.corpusMax.toLocaleString()}`;
  if (p.anchorYear != null && p.neighborYear != null) {
    const phrase = yearsEarlierLaterPhrase(p.anchorYear, p.neighborYear);
    return `Corpus span ${span}. White timeline axis with vertical ticks for selected and neighbor years. ${phrase}.`;
  }
  return `Corpus span ${span}. White timeline axis; vertical ticks for selected (white) and neighbor (grey). Cannot compare dates.`;
}

/** Keeps date labels inside the SVG when the neighbor tick is near an edge (width is heuristic). */
function neighborLabelPlacement(
  tickX: number,
  text: string,
  svgWidth: number,
  fontPx: number
): { x: number; textAnchor: "start" | "middle" | "end" } {
  const pad = 4;
  const estW = Math.max(text.length * fontPx * 0.62, fontPx * 3);

  if (tickX - estW / 2 < pad) {
    return { x: pad, textAnchor: "start" };
  }
  if (tickX + estW / 2 > svgWidth - pad) {
    return { x: svgWidth - pad, textAnchor: "end" };
  }
  return { x: tickX, textAnchor: "middle" };
}

export default function ChronologySpanGlyph({
  corpusMin,
  corpusMax,
  anchorYear,
  neighborYear,
  neighborFinalDate,
  width = MIN_COORD_WIDTH,
  height = 44,
  fullWidth = false,
  showInteractiveTooltip = true
}: ChronologySpanGlyphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredW, setMeasuredW] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!fullWidth) {
      setMeasuredW(null);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const apply = (w: number) => {
      if (w > 0) setMeasuredW(Math.floor(w));
    };
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect.width;
      if (cr != null) apply(cr);
    });
    ro.observe(el);
    apply(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [fullWidth]);

  const coordW = fullWidth ? Math.max(measuredW ?? width, MIN_COORD_WIDTH) : width;

  const innerLeft = 4;
  const innerRight = coordW - 4;
  /** Axis sits in upper band so there is room for the neighbor date label below. */
  const midY = 11;
  const labelY = 33;
  const labelFontPx = 12;
  /** Vertical date ticks extend symmetrically across the horizontal axis. */
  const dateTickHalf = 5;
  const neighborTickStroke = 2;
  /** Selected (anchor) tick — 2× neighbor stroke weight for emphasis. */
  const anchorTickStroke = 4;
  const endCapHalf = 2.5;
  const axisStroke = 0.75;

  const neighborDateText = formatNeighborDateLabel(neighborFinalDate);

  const xScale = useMemo(() => {
    const span = corpusMax - corpusMin;
    if (!Number.isFinite(span) || span <= 0) return null;
    return scaleLinear().domain([corpusMin, corpusMax]).range([innerLeft, innerRight]).clamp(true);
  }, [corpusMin, corpusMax, coordW]);

  const neighborX = xScale != null && neighborYear != null ? xScale(neighborYear) : null;
  const anchorX = xScale != null && anchorYear != null ? xScale(anchorYear) : null;

  const neighborLabelLayout = useMemo(() => {
    if (neighborX == null || !neighborDateText) return null;
    return neighborLabelPlacement(neighborX, neighborDateText, coordW, labelFontPx);
  }, [neighborDateText, neighborX, coordW, labelFontPx]);

  const tooltip = chronologyComparisonTooltipTitle(anchorYear, neighborYear);
  const aria = [
    buildAriaLabel({
      corpusMin,
      corpusMax,
      anchorYear,
      neighborYear,
      width: coordW,
      height
    }),
    neighborDateText ? `Neighbor date label: ${neighborDateText}.` : ""
  ]
    .filter(Boolean)
    .join(" ");

  const tooltipProps = {
    title: tooltip,
    placement: "top" as const,
    arrow: true,
    ...chronologyTooltipSlotProps
  };

  const svgChart = (
    <svg
      width={coordW}
      height={height}
      viewBox={`0 0 ${coordW} ${height}`}
      overflow="visible"
      role="img"
      aria-label={aria}
      style={{ display: "block" }}
    >
      {/* Corpus span: horizontal axis with short end caps */}
      <line
        x1={innerLeft}
        y1={midY}
        x2={innerRight}
        y2={midY}
        stroke="#fff"
        strokeWidth={axisStroke}
        strokeLinecap="square"
      />
      <line
        x1={innerLeft}
        x2={innerLeft}
        y1={midY - endCapHalf}
        y2={midY + endCapHalf}
        stroke="#fff"
        strokeWidth={axisStroke}
        strokeLinecap="square"
      />
      <line
        x1={innerRight}
        x2={innerRight}
        y1={midY - endCapHalf}
        y2={midY + endCapHalf}
        stroke="#fff"
        strokeWidth={axisStroke}
        strokeLinecap="square"
      />
      {neighborX != null ? (
        <line
          x1={neighborX}
          x2={neighborX}
          y1={midY - dateTickHalf}
          y2={midY + dateTickHalf}
          stroke="#9e9e9e"
          strokeWidth={neighborTickStroke}
          strokeLinecap="square"
        />
      ) : null}
      {anchorX != null ? (
        <line
          x1={anchorX}
          x2={anchorX}
          y1={midY - dateTickHalf}
          y2={midY + dateTickHalf}
          stroke="#ffffff"
          strokeWidth={anchorTickStroke}
          strokeLinecap="square"
        />
      ) : null}
      {neighborLabelLayout ? (
        <text
          x={neighborLabelLayout.x}
          y={labelY}
          textAnchor={neighborLabelLayout.textAnchor}
          fill="#bdbdbd"
          fontSize={labelFontPx}
          fontFamily='system-ui, -apple-system, "Segoe UI", sans-serif'
          style={{ userSelect: "none" }}
        >
          {neighborDateText}
        </text>
      ) : null}
    </svg>
  );

  const svgHoverTarget = (
    <Box
      component="span"
      sx={{
        display: fullWidth ? "block" : "inline-flex",
        width: fullWidth ? "100%" : undefined,
        verticalAlign: "middle",
        cursor: "default",
        lineHeight: 0,
        mt: fullWidth ? 0 : 0.25,
        overflow: "visible",
        boxSizing: "border-box"
      }}
    >
      {svgChart}
    </Box>
  );

  const interactive = showInteractiveTooltip ? (
    <Tooltip {...tooltipProps}>{svgHoverTarget}</Tooltip>
  ) : (
    svgHoverTarget
  );

  if (fullWidth) {
    return (
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          display: "block",
          mt: 0.25,
          boxSizing: "border-box"
        }}
      >
        {interactive}
      </Box>
    );
  }

  return interactive;
}
