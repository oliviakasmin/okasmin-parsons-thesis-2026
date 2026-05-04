import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useObjectPlaceLabels } from "../hooks/useObjectGeo";
import { useObjectDateRanges } from "../hooks/useTimelineBuckets";
import { formatYearForTick } from "../utils/formatYearTick";

const S3_IMAGE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

const group = [240291, 317989, 53774];
// const group = [240436, 49359, 47427];
// const group = [308625, 37479, 448395];
// const group = [254268, 478721, 46425];

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

export default function CaseStudies() {
  const objectIds = useMemo(() => group.map((id) => String(id)), []);
  const { placeLabelByObjectId } = useObjectPlaceLabels(objectIds);
  const dateRangeByObjectId = useObjectDateRanges(objectIds);

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
          sx={{
            display: "grid",
            width: "100%",
            minWidth: 0,
            columnGap: 0,
            rowGap: { xs: "2rem", md: "1.5rem" },
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))"
            }
          }}
        >
          {objectIds.map((objectId) => {
            const range = dateRangeByObjectId.get(objectId);
            const dateLabel =
              range !== undefined ? formatObjectDateRangeLabel(range.beginDate, range.endDate) : "";
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
                <Box
                  sx={{
                    borderBottom: "5px solid #fff",
                    width: "100%"
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
                      top: "3px"
                    }}
                  />
                </Box>
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
      </Box>
    </Box>
  );
}
