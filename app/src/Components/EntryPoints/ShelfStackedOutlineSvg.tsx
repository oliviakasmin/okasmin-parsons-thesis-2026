/**
 * Inline stacked-outline previews used in two places:
 * - **Shelf grid** (`Shelf.tsx`): default props → stroke “writes in” on mount; hover replays via `restartShelfPathDraw`.
 * - **Scene headline** (`Container.tsx`): pass `initialComplete` → outlines render finished; no motion.
 */
import { useLayoutEffect, useRef } from "react";
import { Box } from "@mui/material";
import useInlineSvg from "../../hooks/useInlineSvg";

/** Replay mount stroke for Shelf tiles only (hover). Requires global `@keyframes shelfPathDraw` in `styles.css`. */
export function restartShelfPathDraw(paths: Iterable<SVGPathElement>) {
  Array.from(paths).forEach((path, index) => {
    const length = path.getTotalLength();
    path.style.animation = "none";
    void path.getBoundingClientRect();
    path.style.strokeDashoffset = `${length}`;
    path.style.animation = `shelfPathDraw 1800ms ease forwards`;
    path.style.animationDelay = `${index * 120}ms`;
  });
}

type ShelfStackedOutlineSvgProps = {
  src: string;
  alt: string;
  /** `true` = scene headline glyph: show finished outlines only. Omit = Shelf tile behavior. */
  initialComplete?: boolean;
};

export function ShelfStackedOutlineSvg({
  src,
  alt,
  initialComplete = false
}: ShelfStackedOutlineSvgProps) {
  const { svgMarkup } = useInlineSvg(src);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!wrapperRef.current || !svgMarkup) return;

    const paths = wrapperRef.current.querySelectorAll<SVGPathElement>("svg path");
    paths.forEach((path, index) => {
      const computedStrokeWidth = Number.parseFloat(window.getComputedStyle(path).strokeWidth);
      path.style.strokeWidth = Number.isFinite(computedStrokeWidth)
        ? `${computedStrokeWidth * 1.75}px`
        : "1.2px";

      if (initialComplete) {
        path.style.strokeDasharray = "none";
        path.style.strokeDashoffset = "0";
        path.style.animation = "none";
        return;
      }

      // Shelf: staged stroke reveal (CSS keyframes `shelfPathDraw` in styles.css).
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.animation = "none";
      path.style.animation = `shelfPathDraw 1800ms ease forwards`;
      path.style.animationDelay = `${index * 120}ms`;
    });
  }, [svgMarkup, initialComplete]);

  if (!svgMarkup) {
    return <Box aria-label={alt} sx={{ width: "100%", height: "100%", display: "block" }} />;
  }

  return (
    <Box
      ref={wrapperRef}
      aria-label={alt}
      role="img"
      sx={{
        width: "100%",
        height: "100%",
        display: "block",
        "& > svg": {
          width: "100%",
          height: "100%",
          display: "block"
        }
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
