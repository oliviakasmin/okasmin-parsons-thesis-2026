import { useMemo, useRef } from "react";
import fieldsCsv from "../../../format_data/generated/fields.csv?raw";
import timelineBucketsJson from "../../../format_data/date/timeline_buckets.json?raw";

type TimelineBucket = {
  key: string;
  startYear: number;
  endYear: number;
  label: string;
  objectIds: string[];
};

type TimelineBucketsResult = {
  buckets: TimelineBucket[];
  excludedCount: number;
  spanYears: number;
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

function parseStrictYear(value: string) {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function shuffleOnce<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

type TimelineBucketMetadata = {
  final_date_bucket_start: number;
  final_date_bucket_end: number;
  final_date_bucket_label: string;
};

function buildTimelineBucketMetadataMap(jsonRaw: string) {
  const parsed = JSON.parse(jsonRaw) as Record<string, TimelineBucketMetadata>;
  return new Map(Object.entries(parsed));
}

function buildFinalDateByObjectIdMap(csvRaw: string) {
  type BucketInfo = {
    beginDate: number;
    endDate: number;
    key: string;
  };
  const lines = csvRaw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map<string, BucketInfo>();

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const objectBeginDateIdx = header.indexOf("objectBeginDate");
  const objectEndDateIdx = header.indexOf("objectEndDate");
  const bucketKeyIdx = header.indexOf("final_date_bucket_key");
  const result = new Map<string, BucketInfo>();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    const beginDate = parseStrictYear(cells[objectBeginDateIdx] ?? "");
    const endDate = parseStrictYear(cells[objectEndDateIdx] ?? "");
    const key = (cells[bucketKeyIdx] ?? "").trim();

    if (!objectId || beginDate === null || endDate === null || !key) continue;

    result.set(objectId, { beginDate, endDate, key });
  }

  return result;
}

function useTimelineBuckets(objectIds: string[]): TimelineBucketsResult {
  const finalDateByObjectId = useMemo(() => buildFinalDateByObjectIdMap(fieldsCsv), []);
  const timelineBucketMetadataByKey = useMemo(
    () => buildTimelineBucketMetadataMap(timelineBucketsJson),
    []
  );
  const randomizedOrderCacheRef = useRef<Map<string, string[]>>(new Map());

  return useMemo(() => {
    const bucketsByKey = new Map<string, TimelineBucket>();
    let excludedCount = 0;
    let minBeginDate = Number.POSITIVE_INFINITY;
    let maxEndDate = Number.NEGATIVE_INFINITY;

    for (const objectId of objectIds) {
      const bucketInfo = finalDateByObjectId.get(objectId);
      if (bucketInfo === undefined) {
        excludedCount += 1;
        continue;
      }

      minBeginDate = Math.min(minBeginDate, bucketInfo.beginDate);
      maxEndDate = Math.max(maxEndDate, bucketInfo.endDate);

      const timelineBucketMetadata = timelineBucketMetadataByKey.get(bucketInfo.key);
      if (!timelineBucketMetadata) {
        excludedCount += 1;
        continue;
      }

      const existingBucket = bucketsByKey.get(bucketInfo.key);

      if (existingBucket) {
        existingBucket.objectIds.push(objectId);
        continue;
      }

      bucketsByKey.set(bucketInfo.key, {
        key: bucketInfo.key,
        startYear: timelineBucketMetadata.final_date_bucket_start,
        endYear: timelineBucketMetadata.final_date_bucket_end,
        label: timelineBucketMetadata.final_date_bucket_label,
        objectIds: [objectId]
      });
    }

    const buckets = Array.from(bucketsByKey.values())
      .sort((a, b) => a.startYear - b.startYear)
      .map((bucket) => {
        // Randomize once per bucket membership and reuse that order for later rerenders/toggles.
        const membershipSignature = `${bucket.key}|${[...bucket.objectIds].sort().join(",")}`;
        const cachedOrder = randomizedOrderCacheRef.current.get(membershipSignature);
        const objectIdsInBucket = cachedOrder ?? shuffleOnce(bucket.objectIds);

        if (!cachedOrder) {
          randomizedOrderCacheRef.current.set(membershipSignature, objectIdsInBucket);
        }

        return { ...bucket, objectIds: objectIdsInBucket };
      });

    const spanYears =
      Number.isFinite(minBeginDate) && Number.isFinite(maxEndDate)
        ? Math.max(0, maxEndDate - minBeginDate)
        : 0;

    return { buckets, excludedCount, spanYears };
  }, [finalDateByObjectId, objectIds, timelineBucketMetadataByKey]);
}

export default useTimelineBuckets;
export type { TimelineBucket, TimelineBucketsResult };
