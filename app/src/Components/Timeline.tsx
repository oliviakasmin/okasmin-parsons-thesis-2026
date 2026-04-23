import { Box } from "@mui/material";
import type { TimelineBucket } from "../hooks/useTimelineBuckets";
import TimelineAxis from "./TimelineAxis";

type TimelineProps = {
  buckets: TimelineBucket[];
  bucketSpanByKey: Map<string, number>;
  panelHeight: number;
};

function Timeline({ buckets, bucketSpanByKey, panelHeight }: TimelineProps) {
  return (
    <Box component="section" sx={{ width: "100%" }}>
      <TimelineAxis buckets={buckets} bucketSpanByKey={bucketSpanByKey} panelHeight={panelHeight} />
    </Box>
  );
}

export default Timeline;
