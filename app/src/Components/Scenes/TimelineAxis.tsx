import { Box, Chip, Typography } from "@mui/material";
import type { TimelineBucket } from "../../hooks/useTimelineBuckets";
import { formatYearForTick } from "../../utils/formatYearTick";
import { SCENE_LEFT_BASELINE_COLOR } from "../constants";

type TimelineAxisProps = {
  buckets: TimelineBucket[];
  bucketSpanByKey: Map<string, number>;
  panelHeight: number;
};

const tickMarkSx = {
  width: "10px",
  height: "1px",
  flexShrink: 0,
  bgcolor: "#777"
} as const;

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
            {/* Top seam: tick + start year, vertically centered as a unit on the band edge */}
            <Box
              sx={{
                position: "absolute",
                top: 0,
                right: "1rem",
                display: "flex",
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: "0.35rem",
                transform: "translateY(-50%)",
                pointerEvents: "none"
              }}
            >
              <Box sx={tickMarkSx} aria-hidden />
              <Typography
                component="div"
                title={bucket.label}
                sx={{
                  fontSize: "1.05rem",
                  color: "#ccc",
                  lineHeight: 1,
                  m: 0,
                  textAlign: "right"
                }}
              >
                {formatYearForTick(bucket.startYear)}
              </Typography>
            </Box>

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
              <Box
                sx={{
                  position: "absolute",
                  bottom: 0,
                  right: "1rem",
                  display: "flex",
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  gap: "0.35rem",
                  transform: "translateY(50%)",
                  pointerEvents: "none"
                }}
              >
                <Box sx={tickMarkSx} aria-hidden />
                <Typography
                  component="div"
                  title={bucket.label}
                  sx={{
                    fontSize: "1.05rem",
                    color: "#ccc",
                    lineHeight: 1,
                    m: 0,
                    textAlign: "right"
                  }}
                >
                  {formatYearForTick(bucket.endYear)}
                </Typography>
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

export default TimelineAxis;
