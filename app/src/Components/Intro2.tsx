import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
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
  gridTemplateAreas: {
    xs: `"left"\n"center"\n"right"`,
    md: `"left center right"`
  },
  gridTemplateColumns: {
    xs: "1fr",
    md: "36% 28% 36%"
  },
  alignItems: { xs: "start", md: "center" } as const,
  columnGap: 0,
  rowGap: { xs: "3rem", md: 0 },
  minWidth: 0
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
  width: { xs: "92vw", md: "100%" },
  maxWidth: "100%",
  aspectRatio: "1 / 1",
  mx: { xs: "auto" }
};

export default function Intro2() {
  const [stats, setStats] = useState<IntroStats | null>(null);
  const [uniqueCountry, setUniqueCountry] = useState<IntroUniqueCountry | null>(null);
  const [leftOutlineId, rightOutlineId] = objects;

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

  if (!stats || !uniqueCountry) return null;

  return (
    <Box component="section" sx={intro2SectionSx}>
      <Box sx={intro2GridSx}>
        <Box sx={{ ...intro2OutlineColumnSx, gridArea: "left" }}>
          <Box sx={intro2OutlineFrameSx} aria-hidden>
            <InlineOutlineSvg
              className="inline-outline-svg"
              src={`/SVG_outlines/${leftOutlineId}_outline.svg`}
              alt=""
              style={{ height: "100%", width: "100%", maxWidth: "100%" }}
            />
          </Box>
          <Typography variant="introHeading" component="p" sx={{ textAlign: "center", mt: 0 }}>
            {leftDateLabel}
          </Typography>
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
              width: "100%"
            }}
          >
            <Box>
              <Typography variant="h3" sx={intro2StatNumberSx}>
                {stats.uniqueObjectIdCount.fieldsCsv}{" "}
              </Typography>
              <Typography variant="introHeading">
                vessels from the Metropolitan Museum of Art
              </Typography>
            </Box>

            <Box>
              <Typography variant="h3" sx={intro2StatNumberSx}>
                {uniqueCountry.stats.unique_countries_from_last_segment}
              </Typography>
              <Typography variant="introHeading">countries</Typography>
            </Box>

            <Box>
              <Typography variant="h3" sx={intro2StatNumberSx}>
                {stats.maximumDateSpan.spanYears}
              </Typography>
              <Typography variant="introHeading">years</Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ ...intro2OutlineColumnSx, gridArea: "right" }}>
          <Box sx={intro2OutlineFrameSx} aria-hidden>
            <InlineOutlineSvg
              className="inline-outline-svg"
              src={`/SVG_outlines/${rightOutlineId}_outline.svg`}
              alt=""
              style={{ height: "100%", width: "100%", maxWidth: "100%" }}
            />
          </Box>
          <Typography variant="introHeading" component="p" sx={{ textAlign: "center", mt: 0 }}>
            {rightDateLabel}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
