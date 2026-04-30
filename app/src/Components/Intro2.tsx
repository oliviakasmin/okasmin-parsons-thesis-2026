import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import statsUrl from "/data/object_stats.json?url";
import uniqueCountryUrl from "/data/unique_country.json?url";

type IntroStats = {
  uniqueObjectIdCount: { fieldsCsv: number };
  maximumDateSpan: { spanYears: number };
};

type IntroUniqueCountry = {
  stats: { unique_countries_from_last_segment: number };
};

export default function Intro2() {
  const [stats, setStats] = useState<IntroStats | null>(null);
  const [uniqueCountry, setUniqueCountry] = useState<IntroUniqueCountry | null>(null);

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

  const line1 = `I analyzed ${stats.uniqueObjectIdCount.fieldsCsv} vessels from the Metropolitan Museum of Art.`;
  const line2 = `They span ${stats.maximumDateSpan.spanYears} years`;
  const line3 = `and come from ${uniqueCountry.stats.unique_countries_from_last_segment} different countries.`;

  return (
    <Box
      component="section"
      sx={{
        height: "100vh",
        minHeight: "100vh",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "left",
        px: { xs: 2, sm: 3 }
        // py: 10
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: "min(42rem, 90vw)",
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}
      >
        <Typography variant="introHeading" component="p">
          {line1}
        </Typography>
        <Typography variant="introHeading" component="p">
          {line2}
        </Typography>
        <Typography variant="introHeading" component="p">
          {line3}
        </Typography>
      </Box>
    </Box>
  );
}
