import { useMemo, useRef } from "react";
import fieldsCsv from "../../../format_data/fields.csv?raw";

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
};

const BUCKET_SIZE_YEARS = 500;

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

function bucketStartYear(year: number) {
  return Math.floor(year / BUCKET_SIZE_YEARS) * BUCKET_SIZE_YEARS;
}

function shuffleOnce<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function buildFinalDateByObjectIdMap(csvRaw: string) {
  const lines = csvRaw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map<string, number>();

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const finalDateIdx = header.indexOf("final_date");
  const result = new Map<string, number>();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    const year = parseStrictYear(cells[finalDateIdx] ?? "");
    if (!objectId || year === null) continue;
    result.set(objectId, year);
  }

  return result;
}

function useTimelineBuckets(objectIds: string[]): TimelineBucketsResult {
  const finalDateByObjectId = useMemo(() => buildFinalDateByObjectIdMap(fieldsCsv), []);
  const randomizedOrderCacheRef = useRef<Map<string, string[]>>(new Map());

  return useMemo(() => {
    const bucketsByKey = new Map<string, TimelineBucket>();
    let excludedCount = 0;

    for (const objectId of objectIds) {
      const year = finalDateByObjectId.get(objectId);
      if (year === undefined) {
        excludedCount += 1;
        continue;
      }

      const startYear = bucketStartYear(year);
      const endYear = startYear + BUCKET_SIZE_YEARS - 1;
      const key = `${startYear}:${endYear}`;
      const existingBucket = bucketsByKey.get(key);

      if (existingBucket) {
        existingBucket.objectIds.push(objectId);
        continue;
      }

      bucketsByKey.set(key, {
        key,
        startYear,
        endYear,
        label: `${startYear} to ${endYear}`,
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

    return { buckets, excludedCount };
  }, [finalDateByObjectId, objectIds]);
}

export default useTimelineBuckets;
export type { TimelineBucket, TimelineBucketsResult };
