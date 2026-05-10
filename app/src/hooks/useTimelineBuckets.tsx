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
    finalDate: number;
    key: string;
  };
  const lines = csvRaw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map<string, BucketInfo>();

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const finalDateIdx = header.indexOf("final_date");
  const bucketKeyIdx = header.indexOf("final_date_bucket_key");
  const result = new Map<string, BucketInfo>();

  if (objectIdIdx < 0 || finalDateIdx < 0 || bucketKeyIdx < 0) return result;

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    const finalDate = parseStrictYear(cells[finalDateIdx] ?? "");
    const key = (cells[bucketKeyIdx] ?? "").trim();

    if (!objectId || finalDate === null || !key) continue;

    result.set(objectId, { finalDate, key });
  }

  return result;
}

type ObjectDateRange = { beginDate: number; endDate: number };

/** Begin/end years only (no bucket key); for labels outside the timeline bucket flow. */
function buildObjectDateRangeMap(csvRaw: string) {
  const lines = csvRaw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map<string, ObjectDateRange>();

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const objectBeginDateIdx = header.indexOf("objectBeginDate");
  const objectEndDateIdx = header.indexOf("objectEndDate");
  const result = new Map<string, ObjectDateRange>();

  if (objectIdIdx < 0 || objectBeginDateIdx < 0 || objectEndDateIdx < 0) return result;

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    const beginDate = parseStrictYear(cells[objectBeginDateIdx] ?? "");
    const endDate = parseStrictYear(cells[objectEndDateIdx] ?? "");
    if (!objectId || beginDate === null || endDate === null) continue;
    result.set(objectId, { beginDate, endDate });
  }

  return result;
}

function useObjectDateRanges(objectIds: string[]) {
  const allRanges = useMemo(() => buildObjectDateRangeMap(fieldsCsv), []);

  return useMemo(() => {
    const result = new Map<string, ObjectDateRange>();
    for (const objectId of objectIds) {
      const range = allRanges.get(objectId);
      if (range) result.set(objectId, range);
    }
    return result;
  }, [allRanges, objectIds]);
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
    let minFinalDate = Number.POSITIVE_INFINITY;
    let maxFinalDate = Number.NEGATIVE_INFINITY;

    for (const objectId of objectIds) {
      const bucketInfo = finalDateByObjectId.get(objectId);
      if (bucketInfo === undefined) {
        excludedCount += 1;
        continue;
      }

      minFinalDate = Math.min(minFinalDate, bucketInfo.finalDate);
      maxFinalDate = Math.max(maxFinalDate, bucketInfo.finalDate);

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
      Number.isFinite(minFinalDate) && Number.isFinite(maxFinalDate)
        ? Math.max(0, maxFinalDate - minFinalDate)
        : 0;

    return { buckets, excludedCount, spanYears };
  }, [finalDateByObjectId, objectIds, timelineBucketMetadataByKey]);
}

export default useTimelineBuckets;
export { useObjectDateRanges };
export type { TimelineBucket, TimelineBucketsResult, ObjectDateRange };
