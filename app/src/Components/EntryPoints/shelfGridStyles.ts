import type { SxProps, Theme } from "@mui/material/styles";
import { SHELF_RENDER_IMAGE_SIZE_PX } from "../constants";

/** Maximum slots per row (including deliberate gaps). */
export const SHELF_GRID_MAX_COLUMNS = 5;

/** Slot value or `undefined` for an empty space the same size as one tile. */
export type ShelfSlot<T> = T | undefined;

/** Horizontal space between tiles in a row (underline stays continuous on the row wrapper). */
export const SHELF_GRID_COLUMN_GAP_PX = 10;

/** Vertical space between shelf rows — larger than column gap. */
export const SHELF_GRID_ROW_GAP_PX = SHELF_RENDER_IMAGE_SIZE_PX * 0.4;

/** Used for `calc((100vh - …) / n)` so tile height scales with row count. */
export const SHELF_GRID_ROW_COUNT = 3;

const shelfRowVhDivisor = SHELF_GRID_ROW_COUNT;

/** Outer scroll area for each shelf tab (matches across shape / use / color). */
export const shelfTabMainSx: SxProps<Theme> = {
  boxSizing: "border-box",
  height: "auto",
  minHeight: 0,
  width: "100%",
  background: "#000",
  color: "#fff",
  py: "1.5rem",
  display: "flex",
  flexDirection: "column"
};

/** Vertical stack of shelf rows; each row is its own full-width grid (see `shelfGridRowSx`). */
export const shelfGridStackSx: SxProps<Theme> = {
  width: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX * SHELF_GRID_MAX_COLUMNS}px)`,
  mx: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  rowGap: `${SHELF_GRID_ROW_GAP_PX}px`
};

/** One row: always full width; `columnCount` tracks divide space evenly (e.g. 2 tiles → 50% each). */
export function shelfGridRowSx(columnCount: number): SxProps<Theme> {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
    width: "100%",
    columnGap: `${SHELF_GRID_COLUMN_GAP_PX}px`,
    boxSizing: "border-box",
    /** Single continuous rule per row (not interrupted by column gaps). */
    borderBottom: "2px solid #fff"
  };
}

/** Reserves one grid cell: same footprint as a tile, no interaction (row underline still runs beneath). */
export const shelfEmptySlotSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  position: "relative",
  pointerEvents: "none"
};

const shelfArticleBase = {
  display: "flex",
  flexDirection: "column",
  position: "relative",
  cursor: "pointer"
} as const;

/** Article wrapper for tiles whose captions are always visible (no hover reveal). */
export const shelfArticleTileSx: SxProps<Theme> = {
  ...shelfArticleBase
};

/** Article wrapper for each shelf tile (shared dimensions + hover label reveal). */
export function shelfArticleSx(labelClassName: string): SxProps<Theme> {
  return {
    ...shelfArticleBase,
    [`&:hover .${labelClassName}`]: {
      opacity: 1,
      visibility: "visible"
    }
  };
}

/** Black “shelf” ledge with white bottom edge — shared by SVG and image slots. */
export function shelfSlotSurfaceSx(): SxProps<Theme> {
  return {
    marginTop: "auto",
    width: "100%",
    height: `min(${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 240px) / ${shelfRowVhDivisor}))`,
    position: "relative",
    background: "#000",
    overflow: "hidden",
    // paddingLeft: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.25}px`,
    // paddingRight: `${SHELF_RENDER_IMAGE_SIZE_PX * 0.25}px`,
    boxSizing: "border-box"
  };
}

/** Inner bounds for stacked SVG or mask image, anchored to the shelf line. */
export function shelfSlotInnerMediaSx(): SxProps<Theme> {
  return {
    position: "absolute",
    left: "50%",
    bottom: 0,
    transform: "translateX(-50%)",
    width: `min(100%, ${SHELF_RENDER_IMAGE_SIZE_PX}px, calc((100vh - 180px) / ${shelfRowVhDivisor}))`,
    height: "auto",
    maxWidth: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
    maxHeight: `${SHELF_RENDER_IMAGE_SIZE_PX}px`,
    display: "block"
  };
}

export const shelfOverlayLabelSx: SxProps<Theme> = {
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
};
