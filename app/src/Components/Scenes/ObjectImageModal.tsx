import { useEffect, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import { formatYearForTick } from "../../utils/formatYearTick";
import InlineOutlineSvg from "./InlineOutlineSvg";

/** Shared limits so the image area and <img> / SVG stay aligned. */
const imageAreaMin = "min(46vh, 380px)";
const imageAreaMax = "min(58vh, 520px)";

const imageMaxStyle = {
  maxWidth: "100%",
  maxHeight: imageAreaMax,
  width: "auto",
  height: "auto"
} as const;

/** Dominant-color squares to the right of the image (width = height). */
const SWATCH_VW = "1.15vw";

type ObjectImageModalProps = {
  open: boolean;
  objectId: string;
  onClose: () => void;
  title: string;
  finalDate: string;
  mapboxPlaceName: string;
  /** From fields.csv `dominant_colors_hex`; vertical swatch to the right of the image. */
  dominantColorsHex: string[];
  /** Color view: no-background image, or mask fallback (same as main grid color mode). */
  getColorImageSrc: (objectId: string) => string | undefined;
  /** Outline SVG used on image hover when available. */
  getOutlineImageSrc: (objectId: string) => string | undefined;
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

function ObjectImageModal({
  open,
  objectId,
  onClose,
  title,
  finalDate,
  mapboxPlaceName,
  dominantColorsHex,
  getColorImageSrc,
  getOutlineImageSrc
}: ObjectImageModalProps) {
  const [isHovered, setIsHovered] = useState(false);
  const colorImageSrc = getColorImageSrc(objectId);
  const outlineImageSrc = getOutlineImageSrc(objectId);
  const hasOutlineHover = Boolean(colorImageSrc && outlineImageSrc);

  useEffect(() => {
    setIsHovered(false);
  }, [open, objectId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: {
          sx: { backgroundColor: "rgba(0, 0, 0, 0.92)" }
        },
        paper: {
          sx: {
            bgcolor: "#0a0a0a",
            color: "#fff",
            backgroundImage: "none",
            maxHeight: "min(92vh, 720px)"
          }
        }
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pt: 2,
          pb: 0,
          px: 4,
          pr: 2
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="h3"
            variant="h3"
            sx={{
              pr: 0.5,
              lineHeight: 1.3,
              fontSize: "1.35rem",
              wordBreak: "break-word"
            }}
          >
            {displayOrDash(title)}
          </Typography>
        </Box>
        <IconButton
          type="button"
          onClick={onClose}
          aria-label="Close"
          sx={{ color: "#fff", flexShrink: 0 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 2 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            gap: 1.25
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 1.5
            }}
          >
            <Box
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              sx={{
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: imageAreaMin,
                maxHeight: imageAreaMax
              }}
            >
              {colorImageSrc ? (
                <>
                  <img
                    src={colorImageSrc}
                    alt={`${objectId}_color.png`}
                    style={{
                      ...imageMaxStyle,
                      objectFit: "contain",
                      objectPosition: "center",
                      display: "block",
                      opacity: hasOutlineHover && isHovered ? 0 : 1,
                      transition: "opacity 120ms ease-out"
                    }}
                  />
                  {outlineImageSrc ? (
                    <InlineOutlineSvg
                      src={outlineImageSrc}
                      alt={`${objectId}_outline.svg`}
                      className="inline-outline-svg"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        margin: "auto",
                        ...imageMaxStyle,
                        display: "block",
                        opacity: isHovered ? 1 : 0,
                        transition: "opacity 120ms ease-out",
                        pointerEvents: "none"
                      }}
                    />
                  ) : null}
                </>
              ) : (
                <Typography color="text.secondary" sx={{ color: "#888", fontSize: "1.05rem" }}>
                  No image for this object.
                </Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography sx={{ color: "#bdbdbd", fontSize: "1.05rem", lineHeight: 1.45 }}>
                <Box component="span" sx={{ color: "#9a9a9a", mr: 1.25, fontSize: "1rem" }}>
                  Date
                </Box>
                {formatFinalDateForDisplay(finalDate)}
              </Typography>
              <Typography sx={{ color: "#bdbdbd", fontSize: "1.05rem", lineHeight: 1.45 }}>
                <Box component="span" sx={{ color: "#9a9a9a", mr: 1.25, fontSize: "1rem" }}>
                  Place
                </Box>
                {displayOrDash(mapboxPlaceName)}
              </Typography>
            </Box>
          </Box>
          {dominantColorsHex.length > 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                flexShrink: 0,
                alignSelf: "stretch"
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
                {dominantColorsHex.map((hex, index) => (
                  <Box
                    key={`${hex}-${index}`}
                    sx={{
                      width: SWATCH_VW,
                      height: SWATCH_VW,
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
      </DialogContent>
    </Dialog>
  );
}

export default ObjectImageModal;
