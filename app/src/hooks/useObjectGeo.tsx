import { useMemo } from "react";
import fieldsCsv from "../../../format_data/generated/fields.csv?raw";

type ObjectGeo = {
  lon: number;
  lat: number;
};

type ObjectCountryNameById = Map<string, string>;
const COUNTRY_LABEL_ALIASES: Record<string, string[]> = {
  "people's republic of china": ["china"],
  "republic of korea": ["south korea", "korea"],
  "democratic people's republic of korea": ["north korea"],
  "united states of america": ["united states", "usa"],
  "united kingdom": ["uk", "great britain", "britain"],
  scotland: ["united kingdom", "uk", "great britain", "britain"],
  england: ["united kingdom", "uk", "great britain", "britain"],
  wales: ["united kingdom", "uk", "great britain", "britain"],
  "northern ireland": ["united kingdom", "uk", "great britain", "britain"]
};

const COUNTRY_PREFIXES_TO_STRIP = [
  "eastern ",
  "western ",
  "northeast ",
  "northwest ",
  "southeast ",
  "southwest ",
  "east ",
  "west ",
  "north ",
  "south ",
  "byzantine "
];

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

function parseStrictNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeCountryCandidate(value: string) {
  let trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  // "Mesoamerica, Mexico" -> "mexico"
  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  trimmed = parts[parts.length - 1];

  for (const prefix of COUNTRY_PREFIXES_TO_STRIP) {
    if (trimmed.startsWith(prefix)) {
      trimmed = trimmed.slice(prefix.length).trim();
      break;
    }
  }

  if (trimmed === "türkiye") return "turkey";
  if (trimmed === "britain") return "united kingdom";
  if (trimmed === "korea") return "south korea";
  return trimmed;
}

function buildObjectGeoById(csvRaw: string) {
  const lines = csvRaw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map<string, ObjectGeo>();

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const lonIdx = header.indexOf("geo_mapbox_lon");
  const latIdx = header.indexOf("geo_mapbox_lat");
  const geoMatchStatusIdx = header.indexOf("geo_mapbox_match_status");
  const result = new Map<string, ObjectGeo>();

  if (objectIdIdx < 0 || lonIdx < 0 || latIdx < 0) return result;

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    const lon = parseStrictNumber(cells[lonIdx] ?? "");
    const lat = parseStrictNumber(cells[latIdx] ?? "");
    const status = (cells[geoMatchStatusIdx] ?? "").trim();

    if (!objectId || lon === null || lat === null || status === "no_match") continue;

    result.set(objectId, { lon, lat });
  }

  return result;
}

function buildObjectCountryNameById(csvRaw: string): ObjectCountryNameById {
  const lines = csvRaw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map<string, string>();

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const placeNameIdx = header.indexOf("mapbox_place_name");
  const normalizedLocationIdx = header.indexOf("geo_normalized_best_guess_location");
  const geoMatchStatusIdx = header.indexOf("geo_mapbox_match_status");
  const result = new Map<string, string>();

  if (objectIdIdx < 0 || placeNameIdx < 0) return result;

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    const placeName = (cells[placeNameIdx] ?? "").trim();
    const normalizedLocation = (cells[normalizedLocationIdx] ?? "").trim();
    const status = (cells[geoMatchStatusIdx] ?? "").trim();
    if (!objectId || status === "no_match") continue;

    const candidates = [placeName, normalizedLocation]
      .map((name) => normalizeCountryCandidate(name))
      .filter(Boolean);
    if (!candidates.length) continue;

    // Prefer Mapbox place_name first; it generally maps best to map label names.
    result.set(objectId, candidates[0]);
  }

  return result;
}

function useObjectGeo(objectIds: string[]) {
  const allObjectGeoById = useMemo(() => buildObjectGeoById(fieldsCsv), []);

  return useMemo(() => {
    const filtered = new Map<string, ObjectGeo>();
    for (const objectId of objectIds) {
      const geo = allObjectGeoById.get(objectId);
      if (!geo) continue;
      filtered.set(objectId, geo);
    }
    return filtered;
  }, [allObjectGeoById, objectIds]);
}

function useObjectCountryNames(objectIds: string[]) {
  const allCountryNameByObjectId = useMemo(() => buildObjectCountryNameById(fieldsCsv), []);

  return useMemo(() => {
    const countryNames = new Set<string>();
    for (const objectId of objectIds) {
      const countryName = allCountryNameByObjectId.get(objectId);
      if (!countryName) continue;
      countryNames.add(countryName);
      const aliases = COUNTRY_LABEL_ALIASES[countryName];
      if (aliases) aliases.forEach((alias) => countryNames.add(alias));
    }
    return Array.from(countryNames).sort();
  }, [allCountryNameByObjectId, objectIds]);
}

export default useObjectGeo;
export { useObjectCountryNames };
export type { ObjectGeo };
