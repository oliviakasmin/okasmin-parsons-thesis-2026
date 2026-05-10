import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography
} from "@mui/material";
import { formatYearForTick } from "../../utils/formatYearTick";

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
  getColorImageSrc
}: ObjectImageModalProps) {
  const colorImageSrc = getColorImageSrc(objectId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
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
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 2,
          pt: 2,
          pb: 3,
          px: 4,
          boxSizing: "border-box"
        }}
      >
        <Box
          sx={{
            flex: "1 1 0",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            pr: 1
          }}
        >
          <Typography
            component="h3"
            variant="h3"
            sx={{
              lineHeight: 1.3,
              fontSize: "1.35rem",
              wordBreak: "break-word",
              overflowWrap: "anywhere"
            }}
          >
            {displayOrDash(title)}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            flexShrink: 0,
            flexWrap: "nowrap",
            alignItems: "center",
            gap: 1
          }}
        >
          <Button
            type="button"
            variant="outlined"
            sx={{
              flexShrink: 0,
              borderColor: "#fff",
              background: "#000",
              color: "#fff",
              px: "0.55rem",
              py: "0.3rem",
              minWidth: 0,
              borderRadius: 0,
              textTransform: "none",
              margin: 0,
              whiteSpace: "nowrap",
              position: "relative",
              "&:hover": {
                borderColor: "#fff",
                background: "#fff",
                color: "#000",
                zIndex: 1
              }
            }}
          >
            similar shapes
          </Button>
          <IconButton
            type="button"
            onClick={onClose}
            aria-label="Close"
            sx={{ color: "#fff", flexShrink: 0 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
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
                <img
                  src={colorImageSrc}
                  alt={`${objectId}_color.png`}
                  style={{
                    ...imageMaxStyle,
                    objectFit: "contain",
                    objectPosition: "center",
                    display: "block"
                  }}
                />
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
