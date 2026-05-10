import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import InlineOutlineSvg from "./Scenes/InlineOutlineSvg";
import { useObjectPlaceLabels } from "../hooks/useObjectGeo";
import { useObjectDateRanges } from "../hooks/useTimelineBuckets";
import { formatYearForTick } from "../utils/formatYearTick";

const S3_IMAGE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

/** Filled copy of 57400 for the compare-slider handle only (`57400_outline.svg` stays stroke-only for the rest of the app). */
const SLIDER_HANDLE_ICON_SRC = "/SVG_outlines/57400_outline_handle.svg";
const SLIDER_HANDLE_ICON_PX = 52;
/** Thicker than the default `.inline-outline-svg` path stroke (see styles.css). */
const SLIDER_HANDLE_STROKE_WIDTH = 2.5;

const sliderHandleIconWobble = keyframes`
  0% {
    transform: rotate(-10deg);
  }
  50% {
    transform: rotate(10deg);
  }
  100% {
    transform: rotate(-10deg);
  }
`;

// const group = [240291, 317989, 53774];
const group = [240436, 49359, 47427];
// const group = [308625, 37479, 448395];
// const group = [254268, 478721, 46425];
// const group = [253173, 448981, 444898];

const metaTextSx = {
  textAlign: "center",
  overflowWrap: "break-word",
  wordBreak: "break-word"
} as const;

function formatObjectDateRangeLabel(beginDate: number, endDate: number) {
  const a = formatYearForTick(beginDate);
  const b = formatYearForTick(endDate);
  if (!a || !b) return "";
  if (beginDate === endDate) return a;
  return `${a}–${b}`;
}

function getYearsAgo(date: number) {
  const currentYear = new Date().getFullYear();
  return currentYear - date;
}

const compareGridSx = {
  display: "grid",
  width: "100%",
  minWidth: 0,
  columnGap: 0,
  gridTemplateColumns: {
    xs: "minmax(0, 1fr)",
    sm: "repeat(2, minmax(0, 1fr))",
    md: "repeat(3, minmax(0, 1fr))"
  }
} as const;

type CompareCellProps = {
  objectId: string;
  sliderX: number;
  layoutNonce: number;
};

function CaseStudyCompareCell({ objectId, sliderX, layoutNonce }: CompareCellProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [{ left, width }, setGeom] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      setGeom({ left: r.left, width: r.width });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layoutNonce]);

  const localX = Math.min(Math.max(sliderX - left, 0), width);
  const clipColor = width > 0 ? `inset(0 ${width - localX}px 0 0)` : undefined;
  const clipOutline = width > 0 ? `inset(0 0 0 ${localX}px)` : undefined;

  return (
    <Box
      ref={wrapRef}
      sx={{
        borderBottom: "2px solid #fff",
        width: "100%",
        position: "relative"
      }}
    >
      <Box
        component="img"
        src={`${S3_IMAGE_BASE_URL}/${objectId}_no_bg.png`}
        alt={`Case study object ${objectId}`}
        sx={{
          display: "block",
          width: "100%",
          height: "auto",
          objectFit: "contain",
          position: "relative",
          clipPath: clipColor
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          clipPath: clipOutline
        }}
      >
        <InlineOutlineSvg
          src={`/SVG_outlines/${objectId}_outline.svg`}
          alt=""
          className="inline-outline-svg"
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </Box>
    </Box>
  );
}

export default function CaseStudies() {
  const objectIds = useMemo(() => group.map((id) => String(id)), []);
  const { placeLabelByObjectId } = useObjectPlaceLabels(objectIds);
  const dateRangeByObjectId = useObjectDateRanges(objectIds);

  const compareStripRef = useRef<HTMLDivElement>(null);
  const sliderInitializedRef = useRef(false);
  const [sliderX, setSliderX] = useState(0);
  const draggingRef = useRef(false);
  const [handleDragging, setHandleDragging] = useState(false);
  const [layoutNonce, bumpLayout] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const onScrollResize = () => bumpLayout();
    window.addEventListener("scroll", onScrollResize, { passive: true });
    window.addEventListener("resize", onScrollResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScrollResize);
      window.removeEventListener("resize", onScrollResize);
    };
  }, []);

  useLayoutEffect(() => {
    const strip = compareStripRef.current;
    if (!strip) return;
    const r = strip.getBoundingClientRect();
    if (r.width <= 0) return;
    setSliderX((prev) => {
      if (!sliderInitializedRef.current) {
        sliderInitializedRef.current = true;
        return r.left + r.width / 3;
      }
      return Math.min(Math.max(prev, r.left), r.right);
    });
  }, [layoutNonce]);

  const clampSliderToStrip = useCallback((clientX: number) => {
    const strip = compareStripRef.current;
    if (!strip) return clientX;
    const r = strip.getBoundingClientRect();
    return Math.min(Math.max(clientX, r.left), r.right);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      setSliderX(clampSliderToStrip(e.clientX));
    },
    [clampSliderToStrip]
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    setHandleDragging(false);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
  }, [handlePointerMove]);

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      setHandleDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setSliderX(clampSliderToStrip(e.clientX));
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [clampSliderToStrip, handlePointerMove, handlePointerUp]
  );

  const stripRect = compareStripRef.current?.getBoundingClientRect();
  const lineLeftPx = stripRect && stripRect.width > 0 ? sliderX - stripRect.left : null;

  return (
    <Box
      className="viewport-with-margins"
      component="section"
      sx={{
        maxWidth: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: "3rem",
        px: 0
      }}
    >
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "3rem"
        }}
      >
        <Typography variant="h3">
          Same silhouette, thousands of years, different cultures.
        </Typography>

        <Box
          ref={compareStripRef}
          sx={{ position: "relative", width: "100%", minWidth: 0, overflow: "visible" }}
        >
          <Box
            sx={{
              ...compareGridSx,
              rowGap: { xs: "2rem", md: "1.5rem" }
            }}
          >
            {objectIds.map((objectId) => {
              const range = dateRangeByObjectId.get(objectId);
              const dateLabel =
                range !== undefined
                  ? formatObjectDateRangeLabel(range.beginDate, range.endDate)
                  : "";
              const locationLabel = placeLabelByObjectId.get(objectId) ?? "";
              const yearsAgo = getYearsAgo(range?.beginDate ?? 0);
              const yearsAgoLabel =
                yearsAgo > 0 ? `${yearsAgo} years ago` : `${Math.abs(yearsAgo)} years from now`;

              return (
                <Box
                  key={`case-study-${objectId}`}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    width: "100%",
                    px: 0,
                    py: "1rem",
                    gap: "0.75rem"
                  }}
                >
                  <CaseStudyCompareCell
                    objectId={objectId}
                    sliderX={sliderX}
                    layoutNonce={layoutNonce}
                  />
                  <Typography variant="body1" sx={metaTextSx}>
                    {dateLabel + ", " + locationLabel || "—"}
                  </Typography>
                  <Typography variant="body1" sx={metaTextSx}>
                    {"~ " + yearsAgoLabel || "—"}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {lineLeftPx !== null ? (
            <>
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${lineLeftPx}px`,
                  width: 0,
                  transform: "translateX(-0.5px)",
                  borderLeft: "1px solid rgba(255,255,255,0.55)",
                  pointerEvents: "none",
                  zIndex: 2
                }}
              />
              <Box
                className="slider-handle-cluster"
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: `${lineLeftPx}px`,
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  lineHeight: 0,
                  overflow: "visible",
                  zIndex: 3,
                  "& .inline-outline-svg": { overflow: "visible" },
                  "& .inline-outline-svg > svg": {
                    overflow: "visible !important"
                  },
                  "& .inline-outline-svg svg path": {
                    strokeWidth: SLIDER_HANDLE_STROKE_WIDTH,
                    fill: "#000000 !important",
                    transition: "fill 0.18s ease-out"
                  },
                  "&:hover .inline-outline-svg svg path": {
                    fill: "#ffffff !important"
                  },
                  "&:hover .slider-handle-wobble": {
                    animation: "none",
                    transform: "rotate(0deg)"
                  },
                  ...(handleDragging
                    ? {
                        "& .slider-handle-hint": {
                          opacity: "0 !important"
                        }
                      }
                    : {})
                }}
              >
                <Box
                  sx={{
                    position: "relative",
                    width: SLIDER_HANDLE_ICON_PX,
                    height: SLIDER_HANDLE_ICON_PX,
                    boxSizing: "border-box",
                    px: "6px",
                    pt: "6px",
                    pb: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Box
                    className="slider-handle-wobble"
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transformOrigin: "50% 50%",
                      willChange: "transform",
                      ...(handleDragging
                        ? {
                            animation: "none",
                            transform: "rotate(0deg)"
                          }
                        : {
                            animation: `${sliderHandleIconWobble} 2.8s ease-in-out infinite`
                          }),
                      "@media (prefers-reduced-motion: reduce)": {
                        animation: "none",
                        transform: "none"
                      }
                    }}
                  >
                    <InlineOutlineSvg
                      src={SLIDER_HANDLE_ICON_SRC}
                      alt=""
                      className="inline-outline-svg"
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        pointerEvents: "none"
                      }}
                    />
                  </Box>
                </Box>
                <Typography
                  className="slider-handle-hint"
                  variant="body2"
                  sx={{
                    color: "#fff",
                    bgcolor: "#000",
                    px: 1,
                    py: 0.5,
                    borderRadius: "4px",
                    pointerEvents: "none",
                    zIndex: 1
                  }}
                >
                  drag me
                </Typography>
                <Box
                  onPointerDown={handleHandlePointerDown}
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    stripRect && stripRect.width > 0
                      ? Math.round(((sliderX - stripRect.left) / stripRect.width) * 100)
                      : 50
                  }
                  aria-label="Compare photograph and outline"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    cursor: "ew-resize",
                    touchAction: "none",
                    zIndex: 2
                  }}
                />
              </Box>
            </>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
