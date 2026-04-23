import { Box, Chip, Typography } from "@mui/material";
import type { TimelineBucket } from "../hooks/useTimelineBuckets";
import { SCENE_LEFT_BASELINE_COLOR } from "./constants";

type TimelineAxisProps = {
  buckets: TimelineBucket[];
  bucketSpanByKey: Map<string, number>;
  panelHeight: number;
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
      {buckets.map((bucket) => {
        const span = bucketSpanByKey.get(bucket.key) ?? 1;
        const top = runningTop;
        runningTop += span;

        return (
          <Box
            key={bucket.key}
            sx={{
              position: "absolute",
              top: `${top}px`,
              left: 0,
              right: 0,
              height: `${span}px`,
              pr: "0.5rem",
              alignItems: "flex-end",
              justifyContent: "center"
            }}
          >
            <Typography
              component="div"
              sx={{
                position: "absolute",
                right: "1rem",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "1.15rem",
                color: "#ccc",
                lineHeight: 1
              }}
            >
              {bucket.label}
            </Typography>
            <Chip
              label={bucket.objectIds.length.toLocaleString("en-US")}
              size="small"
              sx={{
                position: "absolute",
                right: "1rem",
                top: "calc(50% + 14px)",
                height: "16px",
                fontSize: "0.62rem",
                color: "#9a9a9a",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                borderRadius: "10px",
                ".MuiChip-label": { px: "5px" }
              }}
            />
            <Box
              sx={{
                position: "absolute",
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                width: "7px",
                borderTop: "1px solid #777"
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}

export default TimelineAxis;
