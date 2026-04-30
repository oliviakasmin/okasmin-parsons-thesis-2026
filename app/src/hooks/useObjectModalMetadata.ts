import { useMemo } from "react";
import fieldsCsv from "../../../format_data/generated/fields.csv?raw";

export type ObjectModalFields = {
  title: string;
  finalDate: string;
  mapboxPlaceName: string;
  /** Parsed from `dominant_colors_hex` JSON in fields.csv; empty if missing or invalid. */
  dominantColorsHex: string[];
};

const HEX_COLOR = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

function parseDominantColorsHex(cell: string): string[] {
  const trimmed = cell.trim();
  if (!trimmed || trimmed === "[]") return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const hex = item.trim();
      if (HEX_COLOR.test(hex)) out.push(hex);
    }
    return out.slice(0, 12);
  } catch {
    return [];
  }
}

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

function buildObjectModalFieldsById(csvRaw: string): Map<string, ObjectModalFields> {
  const lines = csvRaw.split(/\r?\n/).filter(Boolean);
  const result = new Map<string, ObjectModalFields>();
  if (!lines.length) return result;

  const header = parseCsvLine(lines[0]);
  const objectIdIdx = header.indexOf("objectId");
  const titleIdx = header.indexOf("title");
  const finalDateIdx = header.indexOf("final_date");
  const mapboxPlaceNameIdx = header.indexOf("mapbox_place_name");
  const dominantColorsHexIdx = header.indexOf("dominant_colors_hex");
  if (objectIdIdx < 0) return result;

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx]?.trim();
    if (!objectId) continue;
    const dominantRaw = dominantColorsHexIdx >= 0 ? (cells[dominantColorsHexIdx] ?? "") : "";
    result.set(objectId, {
      title: (cells[titleIdx] ?? "").trim(),
      finalDate: (cells[finalDateIdx] ?? "").trim(),
      mapboxPlaceName: (cells[mapboxPlaceNameIdx] ?? "").trim(),
      dominantColorsHex: parseDominantColorsHex(dominantRaw)
    });
  }

  return result;
}

function useObjectModalMetadata() {
  return useMemo(() => buildObjectModalFieldsById(fieldsCsv), []);
}

export default useObjectModalMetadata;
