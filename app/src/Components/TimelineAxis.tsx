import { Box, Typography } from "@mui/material";
import type { TimelineBucket } from "../hooks/useTimelineBuckets";

type TimelineAxisProps = {
  buckets: TimelineBucket[];
  bucketWidthByKey: Map<string, number>;
};

function TimelineAxis({ buckets, bucketWidthByKey }: TimelineAxisProps) {
  return (
    <Box
      component="section"
      sx={{
        display: "grid",
        gridTemplateColumns: buckets.length
          ? buckets.map((bucket) => `${bucketWidthByKey.get(bucket.key) ?? 1}px`).join(" ")
          : "1fr",
        columnGap: 0,
        rowGap: "0.45rem",
        width: "max-content",
        minWidth: "100%"
      }}
    >
      {buckets.map((bucket) => (
        <Box key={bucket.key} sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Typography
            component="div"
            sx={{ mb: "0.2rem", fontSize: "0.72rem", color: "#ccc", textAlign: "center" }}
          >
            {bucket.label}
          </Typography>
          <Box sx={{ borderTop: "1px solid #444", height: "1px" }} />
          <Typography
            sx={{ mt: "0.35rem", fontSize: "0.7rem", color: "#aaa", textAlign: "center" }}
          >
            {bucket.objectIds.length} objects
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default TimelineAxis;
