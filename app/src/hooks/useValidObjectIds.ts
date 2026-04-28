import { useMemo } from "react";
import objectsData from "../../../fetch_data/data/objects.json";
import fieldsCsv from "../../../format_data/generated/fields.csv?raw";

type ObjectRecord = {
  objectID?: number | string;
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

function objectIdsFromFieldsCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Set<string>();
  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  if (objectIdIdx < 0) return new Set<string>();

  const ids = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = (cells[objectIdIdx] ?? "").trim();
    if (objectId) ids.add(objectId);
  }
  return ids;
}

function objectIdsFromObjectsJson(data: Record<string, ObjectRecord>) {
  const ids = new Set<string>();
  for (const [key, value] of Object.entries(data)) {
    const objectId = String(value?.objectID ?? key).trim();
    if (objectId) ids.add(objectId);
  }
  return ids;
}

function useValidObjectIds() {
  return useMemo(() => {
    const records = objectsData as Record<string, ObjectRecord>;
    const idsFromFields = objectIdsFromFieldsCsv(fieldsCsv);
    const idsFromObjects = objectIdsFromObjectsJson(records);
    const ids = new Set<string>();

    // fields.csv is the FE starting set; objects.json is a safety gate.
    for (const objectId of idsFromFields) {
      if (idsFromObjects.has(objectId)) {
        ids.add(objectId);
      }
    }

    return ids;
  }, []);
}

export default useValidObjectIds;
