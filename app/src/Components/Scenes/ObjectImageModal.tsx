import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography
} from "@mui/material";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import ChronologySpanGlyph, {
  chronologyComparisonTooltipTitle,
  chronologyTooltipSlotProps
} from "../ChronologySpanGlyph";
import ImageToggleButton from "../ImageToggleButton";
import SimilarShapesViewToggle, { type SimilarShapesView } from "../SimilarShapesViewToggle";
import {
  corpusYearMax,
  corpusYearMin,
  getShapeNeighborsForObject
} from "../../data/shapeNeighborsPayload";
import type { ObjectModalFields } from "../../hooks/useObjectModalMetadata";
import useImageToggle from "../../hooks/useImageToggle";
import type { ImageToggleMode } from "../../hooks/useImageToggle";
import { formatYearForTick } from "../../utils/formatYearTick";
import {
  canonicalCountryFromModalFields,
  countryChipLabelFromModalFields,
  parseFinalDateYear
} from "../../utils/neighborComparisonCaptions";
import InlineOutlineSvg from "./InlineOutlineSvg";

/** Selected-object hero tile max square side when shrinking inside flex body */
const SELECTED_IMAGE_MAX_SIDE = "min(58vh, 520px)";

/** Colorgram palette squares beside selected hero image — shrink with modal body height (`cqh`) */
const SWATCH_TILE_DIM = "min(1.55vw, 4.1cqh)";

/**
 * Neighbors grid: max square side per tile from modal body (`cqw`/`cqh` via `container-type: size`).
 */
const NEIGHBOR_TILE_MAX_SIDE = "min(calc((100cqw - 2.25rem) / 4), calc((100cqh - 8.5rem) / 2.55))";

/** Fixed shell height (vh); body flexes between header/footer with no vertical scroll */
const DIALOG_PAPER_HEIGHT = "min(92vh, 720px)";

/** Horizontal padding for title + body (theme spacing units) */
const MODAL_INNER_PADDING_X = 6;

/** Vertical padding for header/footer chrome (theme spacing); footer mirrors top↔bottom */
const MODAL_EDGE_PADDING_TOP = 2;
const MODAL_EDGE_PADDING_BOTTOM = 3;

/** Popper offset `[skidding, distance]` — negative distance pulls placement-`top` tooltip down onto the timeline */
const SIMILAR_TILE_CHRONOLOGY_TOOLTIP_OFFSET: [number, number] = [0, -21];

/** Object title in header (`aria-labelledby`); selected + similar views */
const modalObjectTitleInHeaderSx = {
  lineHeight: 1.3,
  fontSize: "1.35rem",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  flex: "1 1 0%",
  minWidth: 0
} as const;

const captionValueSx = { color: "#bdbdbd", fontSize: "1.05rem", lineHeight: 1.45 } as const;
const captionLabelSx = { color: "#9a9a9a", mr: 1.25, fontSize: "1rem" } as const;

const placeChipRadius = "6px";

const placeChipFilledSx = {
  borderRadius: placeChipRadius,
  height: 26,
  fontSize: "0.82rem",
  fontWeight: 500,
  bgcolor: "rgba(255,255,255,0.16)",
  color: "#f0f0f0",
  border: "none",
  "& .MuiChip-label": { px: 1.15 }
} as const;

const placeChipOutlinedSx = {
  borderRadius: placeChipRadius,
  height: 26,
  fontSize: "0.82rem",
  fontWeight: 500,
  bgcolor: "transparent",
  color: "#bdbdbd",
  border: "1px solid rgba(255,255,255,0.38)",
  "& .MuiChip-label": { px: 1.15 }
} as const;

/** Neighbor titles under the chronology glyph — same typography as outlined place chip label. */
const neighborTileTitleSx = {
  color: placeChipOutlinedSx.color,
  fontSize: placeChipOutlinedSx.fontSize,
  fontWeight: placeChipOutlinedSx.fontWeight,
  lineHeight: 1.45
} as const;

type ObjectImageModalProps = {
  open: boolean;
  objectId: string;
  onClose: () => void;
  title: string;
  finalDate: string;
  /** Selected-object swatches from `colorgram_palette_hex` in fields.csv. */
  colorgramPaletteHex: string[];
  metadataByObjectId: Map<string, ObjectModalFields>;
  getTileImageSrc: (objectId: string, mode: ImageToggleMode) => string | undefined;
};

function displayOrDash(value: string) {
  return value.trim() ? value : "—";
}

function formatFinalDateForDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) return "—";
  if (!/^-?\d+$/.test(t)) return t;
  return formatYearForTick(Number(t));
}

function ObjectImageModalHeader({
  title,
  onClose,
  similarShapesOpen,
  hasSimilarShapes,
  onSimilarViewChange
}: {
  title: string;
  onClose: () => void;
  similarShapesOpen: boolean;
  hasSimilarShapes: boolean;
  onSimilarViewChange: (next: SimilarShapesView) => void;
}) {
  return (
    <DialogTitle
      component="div"
      sx={{
        pt: MODAL_EDGE_PADDING_TOP,
        pb: MODAL_EDGE_PADDING_BOTTOM,
        px: MODAL_INNER_PADDING_X,
        boxSizing: "border-box",
        flexShrink: 0
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          width: "100%"
        }}
      >
        <Typography
          id="object-image-modal-title"
          component="h2"
          variant="h3"
          sx={modalObjectTitleInHeaderSx}
        >
          {displayOrDash(title)}
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            flexShrink: 0,
            flexWrap: "nowrap",
            alignItems: "center",
            gap: 1,
            marginLeft: "auto"
          }}
        >
          <SimilarShapesViewToggle
            view={similarShapesOpen ? "similar" : "selected"}
            onChange={onSimilarViewChange}
            similarDisabled={!hasSimilarShapes}
          />
          <IconButton
            type="button"
            onClick={onClose}
            aria-label="Close"
            sx={{ color: "#fff", flexShrink: 0 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
    </DialogTitle>
  );
}

function ObjectImageModalBody({ children }: { children: ReactNode }) {
  return (
    <DialogContent
      sx={{
        pt: 1,
        pb: 1,
        px: MODAL_INNER_PADDING_X,
        boxSizing: "border-box",
        flex: "1 1 auto",
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        containerType: "size"
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {children}
      </Box>
    </DialogContent>
  );
}

function ObjectImageModalFooter({ children }: { children: ReactNode }) {
  return (
    <DialogActions
      sx={{
        flexShrink: 0,
        justifyContent: "center",
        px: MODAL_INNER_PADDING_X,
        pt: MODAL_EDGE_PADDING_BOTTOM,
        pb: MODAL_EDGE_PADDING_TOP,
        boxSizing: "border-box"
      }}
    >
      {children}
    </DialogActions>
  );
}

type SimilarShapesNeighborTileProps = {
  tileObjectId: string;
  isAnchor: boolean;
  anchorYear: number | null;
  neighborYear: number | null;
  neighborFinalDate: string;
  corpusMin: number;
  corpusMax: number;
  renderTileImage: (
    tileObjectId: string,
    opts?: { fitViewportGrid?: boolean; constrainSelectedLayout?: boolean }
  ) => ReactNode;
  renderNeighborTitle: (tileObjectId: string, isAnchor: boolean) => ReactNode;
  renderNeighborCountryChip: (tileObjectId: string, isAnchor: boolean) => ReactNode;
};

/** Hover target is the whole tile; Popper anchor is the timeline strip only. */
function SimilarShapesNeighborTile({
  tileObjectId,
  isAnchor,
  anchorYear,
  neighborYear,
  neighborFinalDate,
  corpusMin,
  corpusMax,
  renderTileImage,
  renderNeighborTitle,
  renderNeighborCountryChip
}: SimilarShapesNeighborTileProps) {
  const [chronologyTipOpen, setChronologyTipOpen] = useState(false);

  const chronologyBlock = (
    <Box
      sx={{
        width: "100%",
        maxWidth: NEIGHBOR_TILE_MAX_SIDE,
        mx: "auto",
        mt: 0.75,
        boxSizing: "border-box",
        flexShrink: 0
      }}
    >
      <ChronologySpanGlyph
        fullWidth
        showInteractiveTooltip={false}
        corpusMin={corpusMin}
        corpusMax={corpusMax}
        anchorYear={anchorYear}
        neighborYear={neighborYear}
        neighborFinalDate={neighborFinalDate}
      />
    </Box>
  );

  const neighborCountryChip = renderNeighborCountryChip(tileObjectId, isAnchor);

  return (
    <Box
      onMouseEnter={() => {
        if (!isAnchor) setChronologyTipOpen(true);
      }}
      onMouseLeave={() => setChronologyTipOpen(false)}
      sx={{
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        cursor: "default",
        boxSizing: "border-box"
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: NEIGHBOR_TILE_MAX_SIDE,
          mx: "auto",
          mb: 0.75,
          boxSizing: "border-box",
          textAlign: "left",
          flexShrink: 0
        }}
      >
        {renderNeighborTitle(tileObjectId, isAnchor)}
      </Box>
      <Box
        sx={{
          flex: "1 1 0%",
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >
        {renderTileImage(tileObjectId, { fitViewportGrid: true })}
      </Box>
      {isAnchor ? (
        chronologyBlock
      ) : (
        <Tooltip
          open={chronologyTipOpen}
          disableHoverListener
          disableFocusListener
          disableTouchListener
          title={chronologyComparisonTooltipTitle(anchorYear, neighborYear)}
          placement="top"
          arrow
          enterDelay={0}
          slotProps={{
            ...chronologyTooltipSlotProps.slotProps,
            popper: {
              popperOptions: {
                modifiers: [
                  { name: "arrow", options: { padding: 2 } },
                  {
                    name: "offset",
                    options: { offset: SIMILAR_TILE_CHRONOLOGY_TOOLTIP_OFFSET }
                  }
                ]
              }
            }
          }}
        >
          {chronologyBlock}
        </Tooltip>
      )}
      {neighborCountryChip ? (
        <Box
          sx={{
            width: "100%",
            maxWidth: NEIGHBOR_TILE_MAX_SIDE,
            mx: "auto",
            mt: 0.25,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxSizing: "border-box",
            flexShrink: 0
          }}
        >
          {neighborCountryChip}
        </Box>
      ) : null}
    </Box>
  );
}

function ObjectImageModal({
  open,
  objectId,
  onClose,
  title,
  finalDate,
  colorgramPaletteHex,
  metadataByObjectId,
  getTileImageSrc
}: ObjectImageModalProps) {
  const neighborBundle = getShapeNeighborsForObject(objectId);
  const hasSimilarShapes = Boolean(neighborBundle?.neighborsModal7?.length);

  const [similarShapesOpen, setSimilarShapesOpen] = useState(false);
  const {
    mode: tileMode,
    options: tileOptions,
    setMode: setTileMode
  } = useImageToggle({
    colorOption: true,
    initialMode: "color"
  });

  useEffect(() => {
    setSimilarShapesOpen(false);
    setTileMode("color");
  }, [objectId, open, setTileMode]);

  const handleSimilarViewChange = useCallback(
    (next: SimilarShapesView) => {
      const similar = next === "similar";
      setSimilarShapesOpen(similar);
      setTileMode(similar ? "solid" : "color");
    },
    [setTileMode]
  );

  const anchorMeta = metadataByObjectId.get(objectId);

  const modalNeighborIds = neighborBundle
    ? [objectId, ...neighborBundle.neighborsModal7.map((n) => n.neighborId)]
    : [objectId];

  const renderCountryChip = (tileMeta: ObjectModalFields | undefined, isAnchorTile: boolean) => {
    const cb = tileMeta ? canonicalCountryFromModalFields(tileMeta) : null;
    if (!cb) return null;
    const label = countryChipLabelFromModalFields(tileMeta);
    const ca = anchorMeta ? canonicalCountryFromModalFields(anchorMeta) : null;
    const filled = isAnchorTile || (ca != null && ca === cb);
    return (
      <Chip
        label={label}
        size="small"
        variant={filled ? "filled" : "outlined"}
        sx={filled ? placeChipFilledSx : placeChipOutlinedSx}
      />
    );
  };

  const renderTileImage = (
    tileObjectId: string,
    opts?: { fitViewportGrid?: boolean; constrainSelectedLayout?: boolean }
  ) => {
    const src = getTileImageSrc(tileObjectId, tileMode);
    const bg = tileMode === "color" ? "transparent" : "#000";
    const fit = opts?.fitViewportGrid ?? false;
    const constrainSel = opts?.constrainSelectedLayout ?? false;
    const inner = (
      <Box
        sx={{
          aspectRatio: "1 / 1",
          position: "relative",
          ...(fit
            ? {
                width: "100%",
                maxWidth: NEIGHBOR_TILE_MAX_SIDE,
                maxHeight: `min(100%, ${NEIGHBOR_TILE_MAX_SIDE})`,
                mx: "auto",
                minHeight: 0,
                flexShrink: 1
              }
            : constrainSel
              ? {
                  width: `min(100%, ${SELECTED_IMAGE_MAX_SIDE})`,
                  maxWidth: "100%",
                  maxHeight: "100%",
                  mx: "auto",
                  flexShrink: 1,
                  minHeight: 0,
                  minWidth: 0,
                  alignSelf: "center"
                }
              : { width: "100%" }),
          backgroundColor: bg,
          overflow: "hidden"
        }}
      >
        {tileMode === "outline" && src ? (
          <InlineOutlineSvg
            src={src}
            alt={`${tileObjectId}_outline`}
            className="inline-outline-svg"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              position: "absolute",
              inset: 0
            }}
          />
        ) : src ? (
          <img
            src={src}
            alt={`${tileObjectId}_${tileMode}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block"
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "#666",
              fontSize: "0.75rem",
              p: 1,
              textAlign: "center"
            }}
          >
            No image
          </Box>
        )}
      </Box>
    );
    return inner;
  };

  const neighborTitleTypographySx = (isAnchor: boolean) =>
    isAnchor
      ? ({
          ...captionValueSx,
          fontWeight: 700,
          width: "100%",
          textAlign: "left",
          overflowWrap: "break-word",
          wordBreak: "normal",
          hyphens: "auto",
          WebkitHyphens: "auto",
          msHyphens: "auto"
        } as const)
      : ({
          ...neighborTileTitleSx,
          width: "100%",
          minWidth: 0,
          textAlign: "left",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        } as const);

  const renderNeighborTitle = (tileObjectId: string, isAnchor: boolean) => {
    const meta = metadataByObjectId.get(tileObjectId);
    const t = meta?.title ?? "";
    return (
      <Typography lang="en" sx={neighborTitleTypographySx(isAnchor)}>
        {isAnchor ? "Selected" : displayOrDash(t)}
      </Typography>
    );
  };

  const renderNeighborCountryChip = (tileObjectId: string, isAnchor: boolean) => {
    const meta = metadataByObjectId.get(tileObjectId);
    return renderCountryChip(meta, isAnchor);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="object-image-modal-title"
      sx={{
        "& .MuiDialog-container": {
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(12px, 3vmin, 24px)",
          boxSizing: "border-box"
        }
      }}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: "rgba(0, 0, 0, 0.92)" }
        },
        paper: {
          sx: {
            bgcolor: "#0a0a0a",
            color: "#fff",
            backgroundImage: "none",
            boxSizing: "border-box",
            margin: 0,
            height: DIALOG_PAPER_HEIGHT,
            maxHeight: DIALOG_PAPER_HEIGHT,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }
        }
      }}
    >
      <ObjectImageModalHeader
        title={title}
        onClose={onClose}
        similarShapesOpen={similarShapesOpen}
        hasSimilarShapes={hasSimilarShapes}
        onSimilarViewChange={handleSimilarViewChange}
      />
      <ObjectImageModalBody>
        {!similarShapesOpen ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              gap: 1.25,
              overflow: "hidden"
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                overflow: "hidden"
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  flex: "1 1 0%",
                  minHeight: 0,
                  overflow: "hidden"
                }}
              >
                {renderTileImage(objectId, { constrainSelectedLayout: true })}
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                <Typography sx={captionValueSx}>
                  <Box component="span" sx={captionLabelSx}>
                    Date
                  </Box>
                  {formatFinalDateForDisplay(finalDate)}
                </Typography>
                <Typography
                  sx={{
                    ...captionValueSx,
                    wordBreak: "break-word",
                    overflowWrap: "anywhere"
                  }}
                >
                  <Box component="span" sx={captionLabelSx}>
                    Place
                  </Box>
                  {displayOrDash(anchorMeta?.mapboxPlaceName ?? "")}
                </Typography>
              </Box>
            </Box>
            {colorgramPaletteHex.length > 0 ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  flexShrink: 1,
                  minHeight: 0,
                  alignSelf: "stretch",
                  overflow: "hidden"
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px"
                  }}
                >
                  {colorgramPaletteHex.map((hex, index) => (
                    <Box
                      key={`${hex}-${index}`}
                      sx={{
                        width: SWATCH_TILE_DIM,
                        height: SWATCH_TILE_DIM,
                        flexShrink: 0,
                        bgcolor: hex,
                        boxSizing: "border-box",
                        border: "1px solid rgba(255,255,255,0.12)"
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ) : null}
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gridAutoRows: "minmax(0, 1fr)",
              columnGap: 1.5,
              rowGap: 4,
              alignItems: "stretch",
              justifyItems: "stretch",
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              overflow: "hidden"
            }}
          >
            {modalNeighborIds.map((tileObjectId, index) => {
              const isAnchor = index === 0;
              const fd = metadataByObjectId.get(tileObjectId)?.finalDate ?? "";
              const anchorY = parseFinalDateYear(anchorMeta?.finalDate ?? finalDate);
              const neighborY = parseFinalDateYear(fd);
              return (
                <SimilarShapesNeighborTile
                  key={`${objectId}-${tileObjectId}-${index}`}
                  tileObjectId={tileObjectId}
                  isAnchor={isAnchor}
                  anchorYear={anchorY}
                  neighborYear={neighborY}
                  neighborFinalDate={fd}
                  corpusMin={corpusYearMin}
                  corpusMax={corpusYearMax}
                  renderTileImage={renderTileImage}
                  renderNeighborTitle={renderNeighborTitle}
                  renderNeighborCountryChip={renderNeighborCountryChip}
                />
              );
            })}
          </Box>
        )}
      </ObjectImageModalBody>
      <ObjectImageModalFooter>
        <ImageToggleButton mode={tileMode} onChange={setTileMode} options={tileOptions} />
      </ObjectImageModalFooter>
    </Dialog>
  );
}

export default ObjectImageModal;
