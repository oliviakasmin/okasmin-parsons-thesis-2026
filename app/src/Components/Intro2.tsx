import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import fieldsCsv from "../../../format_data/generated/fields.csv?raw";
import { objects } from "./title_intro_constants";
import InlineOutlineSvg from "./Scenes/InlineOutlineSvg";
import statsUrl from "/data/object_stats.json?url";
import uniqueCountryUrl from "/data/unique_country.json?url";
import { formatYearForTick } from "../utils/formatYearTick";

type IntroStats = {
  uniqueObjectIdCount: { fieldsCsv: number };
  maximumDateSpan: { spanYears: number };
};

type IntroUniqueCountry = {
  stats: { unique_countries_from_last_segment: number };
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function buildObjectDateByIdMap(csvRaw: string, objectIds: number[]) {
  const lines = csvRaw.split(/\r?\n/).filter(Boolean);
  const result = new Map<string, { objectBeginDate: string; objectEndDate: string }>();
  if (!lines.length) return result;

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const objectBeginDateIdx = header.indexOf("objectBeginDate");
  const objectEndDateIdx = header.indexOf("objectEndDate");
  if (objectIdIdx < 0 || objectBeginDateIdx < 0 || objectEndDateIdx < 0) return result;

  const targetIds = new Set(objectIds.map((id) => String(id)));
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    if (!objectId || !targetIds.has(objectId)) continue;
    result.set(objectId, {
      objectBeginDate: (cells[objectBeginDateIdx] ?? "").trim(),
      objectEndDate: (cells[objectEndDateIdx] ?? "").trim()
    });
    if (result.size === targetIds.size) break;
  }

  return result;
}

export default function Intro2() {
  const [stats, setStats] = useState<IntroStats | null>(null);
  const [uniqueCountry, setUniqueCountry] = useState<IntroUniqueCountry | null>(null);
  const [leftOutlineId, rightOutlineId] = objects;
  const objectDateById = useMemo(() => buildObjectDateByIdMap(fieldsCsv, objects), []);
  const leftDateRaw = objectDateById.get(String(leftOutlineId))?.objectBeginDate ?? "";
  const rightDateRaw = objectDateById.get(String(rightOutlineId))?.objectEndDate ?? "";
  const leftDateYear = Number(leftDateRaw);
  const rightDateYear = Number(rightDateRaw);
  const leftDateLabel = Number.isFinite(leftDateYear)
    ? formatYearForTick(leftDateYear)
    : leftDateRaw;
  const rightDateLabel = Number.isFinite(rightDateYear)
    ? formatYearForTick(rightDateYear)
    : rightDateRaw;

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
    <Box
      component="section"
      className="viewport-with-margins"
      sx={{
        position: "relative",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        px: { xs: 2, sm: 3 }
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          top: "60%",
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "clamp(0.5rem, 1.2vw, 1rem)",
          px: { xs: "0.5rem", sm: "1rem" },
          zIndex: 0,
          pointerEvents: "none"
        }}
      >
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          <InlineOutlineSvg
            src={`/SVG_outlines/${leftOutlineId}_outline.svg`}
            alt=""
            className="inline-outline-svg"
            style={{
              width: "clamp(126px, 15vw, 216px)",
              height: "clamp(126px, 15vw, 216px)",
              flexShrink: 0
            }}
          />
          <Typography
            component="p"
            sx={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              mt: "0.45rem",
              fontSize: "clamp(1rem, 1.8vw, 1.4rem)",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              color: "#fff"
            }}
          >
            {leftDateLabel}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, borderBottom: "1px solid #fff" }} />
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          <InlineOutlineSvg
            src={`/SVG_outlines/${rightOutlineId}_outline.svg`}
            alt=""
            className="inline-outline-svg"
            style={{
              width: "clamp(126px, 15vw, 216px)",
              height: "clamp(126px, 15vw, 216px)",
              flexShrink: 0
            }}
          />
          <Typography
            component="p"
            sx={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              mt: "0.45rem",
              fontSize: "clamp(1rem, 1.8vw, 1.4rem)",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              color: "#fff"
            }}
          >
            {rightDateLabel}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "min(42rem, 90vw)",
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}
      >
        <Typography
          variant="introHeading"
          component="p"
          sx={(theme) => ({
            display: "inline-block",
            alignSelf: "center",
            backgroundColor: "#000",
            px: "0.4em",
            "& .intro-number": theme.typography.h3
          })}
        >
          <span className="intro-number">{stats.uniqueObjectIdCount.fieldsCsv}</span> vessels from
          the Metropolitan Museum of Art
        </Typography>
        <Typography
          variant="introHeading"
          component="p"
          sx={(theme) => ({
            display: "inline-block",
            alignSelf: "center",
            backgroundColor: "#000",
            px: "0.4em",
            "& .intro-number": theme.typography.h3
          })}
        >
          across <span className="intro-number">{stats.maximumDateSpan.spanYears}</span> years
        </Typography>
        <Typography
          variant="introHeading"
          component="p"
          sx={(theme) => ({
            display: "inline-block",
            alignSelf: "center",
            backgroundColor: "#000",
            px: "0.4em",
            "& .intro-number": theme.typography.h3
          })}
        >
          from{" "}
          <span className="intro-number">
            {uniqueCountry.stats.unique_countries_from_last_segment}
          </span>{" "}
          countries
        </Typography>
      </Box>
    </Box>
  );
}
