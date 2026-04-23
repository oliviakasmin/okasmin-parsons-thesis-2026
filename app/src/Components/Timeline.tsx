import type { TimelineBucket } from "../hooks/useTimelineBuckets";
import TimelineAxis from "./TimelineAxis";

type TimelineProps = {
  buckets: TimelineBucket[];
  bucketWidthByKey: Map<string, number>;
};

function Timeline({ buckets, bucketWidthByKey }: TimelineProps) {
  return <TimelineAxis buckets={buckets} bucketWidthByKey={bucketWidthByKey} />;
}

export default Timeline;
