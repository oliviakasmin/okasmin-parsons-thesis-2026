import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { objects } from "./title_intro_constants";
import InlineOutlineSvg from "./Scenes/InlineOutlineSvg";
import statsUrl from "/data/object_stats.json?url";
import uniqueCountryUrl from "/data/unique_country.json?url";
import { formatYearForTick } from "../utils/formatYearTick";

type ObjectStatRow = {
  objectId: string;
  objectBeginDate: number;
  objectEndDate: number;
};

type IntroStats = {
  uniqueObjectIdCount: { fieldsCsv: number };
  maximumDateSpan: { spanYears: number };
  earliest: ObjectStatRow[];
  latest: ObjectStatRow[];
};

type IntroUniqueCountry = {
  stats: { unique_countries_from_last_segment: number };
};

const intro2StatNumberSx = {
  fontSize: "clamp(2rem, 6vw, 4rem)"
};

/** Edge-to-edge viewport width; bypasses `body` `--page-margin` for this block only. */
const intro2SectionSx = {
  width: "100vw",
  marginInline: "calc(50% - 50vw)"
};

const intro2GridSx = {
  display: "grid",
  gridTemplateAreas: `"topRow topRow topRow"\n"leftDate . rightDate"`,
  gridTemplateColumns: "36% 28% 36%",
  alignItems: "stretch",
  columnGap: 0,
  rowGap: 0,
  minWidth: 0
};

const intro2TopRowInnerGridSx = {
  display: "grid",
  gridTemplateAreas: `"leftImg center rightImg"`,
  gridTemplateColumns: "36% 28% 36%",
  alignItems: "end",
  columnGap: 0,
  width: "100%",
  minWidth: 0,
  /** Breathing room above the full-width white rule (`Intro2BottomRuleSvg`). */
  paddingBottom: "0.25rem"
};

const intro2OutlineColumnSx = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "flex-end",
  minWidth: 0,
  width: "100%"
};

const intro2OutlineFrameSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  maxWidth: "100%",
  aspectRatio: "1 / 1"
};

gsap.registerPlugin(ScrollTrigger);

/** Full-width stroke along the bottom edge of the intro stats row (`position: absolute` inside `topRow`). */
function Intro2BottomRuleSvg({ lineRef }: { lineRef: RefObject<SVGLineElement | null> }) {
  return (
    <svg
      width="100%"
      height={3}
      viewBox="0 0 100 3"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
        display: "block",
        pointerEvents: "none"
      }}
    >
      {/* #fff: page bg is #000; default MUI light `text.primary` is dark, so theme-based lines vanish. */}
      <line
        ref={lineRef}
        x1="0"
        y1="1.5"
        x2="100"
        y2="1.5"
        stroke="#ffffff"
        strokeWidth={1.5}
        vectorEffect="nonScalingStroke"
      />
    </svg>
  );
}

export default function Intro2() {
  const [stats, setStats] = useState<IntroStats | null>(null);
  const [uniqueCountry, setUniqueCountry] = useState<IntroUniqueCountry | null>(null);
  const [leftOutlineId, rightOutlineId] = objects;
  const sectionRef = useRef<HTMLElement | null>(null);
  const bottomRuleLineRef = useRef<SVGLineElement | null>(null);

  const leftDateYear = useMemo(() => {
    if (!stats) return NaN;
    const row = stats.earliest.find((e) => e.objectId === String(leftOutlineId));
    return row?.objectBeginDate ?? NaN;
  }, [stats, leftOutlineId]);

  const rightDateYear = useMemo(() => {
    if (!stats) return NaN;
    const row = stats.latest.find((e) => e.objectId === String(rightOutlineId));
    return row?.objectEndDate ?? NaN;
  }, [stats, rightOutlineId]);

  const leftDateLabel = Number.isFinite(leftDateYear) ? formatYearForTick(leftDateYear) : "";
  const rightDateLabel = Number.isFinite(rightDateYear) ? formatYearForTick(rightDateYear) : "";

  useEffect(() => {
    let isMounted = true;

    async function loadIntroData() {
      const [statsResponse, uniqueCountryResponse] = await Promise.all([
        fetch(statsUrl),
        fetch(uniqueCountryUrl)
      ]);

      if (!statsResponse.ok || !uniqueCountryResponse.ok) return;

      const [statsJson, uniqueCountryJson] = await Promise.all([
        statsResponse.json(),
        uniqueCountryResponse.json()
      ]);

      if (!isMounted) return;
      setStats(statsJson as IntroStats);
      setUniqueCountry(uniqueCountryJson as IntroUniqueCountry);
    }

    loadIntroData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!stats || !uniqueCountry) return;
    if (!sectionRef.current || !bottomRuleLineRef.current) return;

    gsap.set(bottomRuleLineRef.current, {
      scaleX: 0,
      transformOrigin: "left center"
    });

    const tween = gsap.to(bottomRuleLineRef.current, {
      scaleX: 1,
      duration: 1.8,
      ease: "power1.out",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 50%",
        toggleActions: "restart none restart reset"
      }
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [stats, uniqueCountry]);

  if (!stats || !uniqueCountry) return null;

  return (
    <Box ref={sectionRef} component="section" sx={intro2SectionSx}>
      <Box sx={intro2GridSx}>
        <Box
          sx={{
            gridArea: "topRow",
            position: "relative",
            minWidth: 0,
            width: "100%"
          }}
        >
          <Box sx={intro2TopRowInnerGridSx}>
            <Box sx={{ ...intro2OutlineColumnSx, gridArea: "leftImg" }}>
              <Box sx={intro2OutlineFrameSx} aria-hidden>
                <InlineOutlineSvg
                  className="inline-outline-svg"
                  src={`/SVG_outlines/${leftOutlineId}_outline.svg`}
                  alt=""
                  style={{ height: "100%", width: "100%", maxWidth: "100%" }}
                />
              </Box>
            </Box>

            <Box
              sx={{
                gridArea: "center",
                minWidth: 0,
                display: "flex",
                justifyContent: "center"
              }}
            >
              <Box
                id="intro2-body"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "3rem",
                  width: "100%",
                  pb: 2.5
                }}
              >
                <Box>
                  <Typography variant="h3" sx={intro2StatNumberSx}>
                    {stats.uniqueObjectIdCount.fieldsCsv}{" "}
                  </Typography>
                  <Typography variant="h4">vessels from the Metropolitan Museum of Art</Typography>
                </Box>

                <Box>
                  <Typography variant="h3" sx={intro2StatNumberSx}>
                    {uniqueCountry.stats.unique_countries_from_last_segment}
                  </Typography>
                  <Typography variant="h4">countries</Typography>
                </Box>

                <Box>
                  <Typography variant="h3" sx={intro2StatNumberSx}>
                    {stats.maximumDateSpan.spanYears}
                  </Typography>
                  <Typography variant="h4">years</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ ...intro2OutlineColumnSx, gridArea: "rightImg" }}>
              <Box sx={intro2OutlineFrameSx} aria-hidden>
                <InlineOutlineSvg
                  className="inline-outline-svg"
                  src={`/SVG_outlines/${rightOutlineId}_outline.svg`}
                  alt=""
                  style={{ height: "100%", width: "100%", maxWidth: "100%" }}
                />
              </Box>
            </Box>
          </Box>

          <Intro2BottomRuleSvg lineRef={bottomRuleLineRef} />
        </Box>

        <Typography
          variant="labels"
          component="p"
          sx={{ gridArea: "leftDate", textAlign: "center", mt: 2, mb: 0 }}
        >
          {leftDateLabel}
        </Typography>

        <Typography
          variant="labels"
          component="p"
          sx={{ gridArea: "rightDate", textAlign: "center", mt: 2, mb: 0 }}
        >
          {rightDateLabel}
        </Typography>
      </Box>
    </Box>
  );
}
