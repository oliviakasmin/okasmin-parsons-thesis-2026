import { Box, Chip, Typography } from "@mui/material";
import type { TimelineBucket } from "../../hooks/useTimelineBuckets";
import { SCENE_LEFT_BASELINE_COLOR } from "../constants";

type TimelineAxisProps = {
  buckets: TimelineBucket[];
  bucketSpanByKey: Map<string, number>;
  panelHeight: number;
};

function formatYearForTick(year: number): string {
  if (!Number.isFinite(year)) return "";
  if (year < 0) return `${Math.abs(year).toLocaleString("en-US")} BCE`;
  return `${year.toLocaleString("en-US")} CE`;
}

const tickLineSx = {
  position: "absolute" as const,
  right: 0,
  width: "10px",
  borderTop: "1px solid #777"
};

function TimelineAxis({ buckets, bucketSpanByKey, panelHeight }: TimelineAxisProps) {
  let runningTop = 0;
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        width: "100%",
        height: `${Math.max(panelHeight, 1)}px`,
        minHeight: `${Math.max(panelHeight, 1)}px`
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          borderRight: `1px solid ${SCENE_LEFT_BASELINE_COLOR}`
        }}
      />
      {buckets.map((bucket, bucketIndex) => {
        const span = bucketSpanByKey.get(bucket.key) ?? 1;
        const top = runningTop;
        runningTop += span;
        const isLast = bucketIndex === buckets.length - 1;

        return (
          <Box
            key={bucket.key}
            sx={{
              position: "absolute",
              top: `${top}px`,
              left: 0,
              right: 0,
              height: `${span}px`,
              "&:hover .TimelineAxis-countChip": {
                opacity: 1,
                pointerEvents: "auto"
              }
            }}
          >
            {/* Top seam: tick + start year (aligns with layout band top) */}
            <Box sx={{ ...tickLineSx, top: 0 }} aria-hidden />
            <Typography
              component="div"
              title={bucket.label}
              sx={{
                position: "absolute",
                right: "1rem",
                top: 0,
                transform: "translateY(-50%)",
                fontSize: "1.05rem",
                color: "#ccc",
                lineHeight: 1,
                m: 0,
                textAlign: "right"
              }}
            >
              {formatYearForTick(bucket.startYear)}
            </Typography>

            <Chip
              className="TimelineAxis-countChip"
              label={bucket.objectIds.length.toLocaleString("en-US")}
              size="small"
              sx={{
                position: "absolute",
                right: "1rem",
                top: "50%",
                transform: "translateY(-50%)",
                height: "22px",
                fontSize: "1rem",
                color: "white",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                borderRadius: "0",
                opacity: 0,
                pointerEvents: "none",
                transition: "opacity 0.12s ease",
                ".MuiChip-label": { px: "7px", py: "2px" }
              }}
            />

            {isLast ? (
              <>
                <Box sx={{ ...tickLineSx, bottom: 0 }} aria-hidden />
                <Typography
                  component="div"
                  title={bucket.label}
                  sx={{
                    position: "absolute",
                    right: "1rem",
                    bottom: 0,
                    transform: "translateY(50%)",
                    fontSize: "1.05rem",
                    color: "#ccc",
                    lineHeight: 1,
                    m: 0,
                    textAlign: "right"
                  }}
                >
                  {formatYearForTick(bucket.endYear)}
                </Typography>
              </>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

export default TimelineAxis;
