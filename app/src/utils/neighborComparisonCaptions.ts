import type { ObjectModalFields } from "../hooks/useObjectModalMetadata";
import { normalizeCountryCandidate } from "../hooks/useObjectGeo";

/** Integer final_date years only (matches formatFinalDateForDisplay numeric branch). */
export function parseFinalDateYear(raw: string): number | null {
  const t = raw.trim();
  if (!t || !/^-?\d+$/.test(t)) return null;
  return Number(t);
}

export function canonicalCountryFromModalFields(f: ObjectModalFields): string | null {
  const status = f.geoMatchStatus.trim();
  if (status === "no_match") return null;
  const candidates = [f.mapboxPlaceName, f.geoNormalizedBestGuessLocation]
    .map((s) => normalizeCountryCandidate(s))
    .filter(Boolean);
  return candidates[0] ?? null;
}

/** Title-case words for chip labels (canonical slug is lowercase). */
export function formatCountryDisplayName(canonicalLower: string): string {
  return canonicalLower.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function countryChipLabelFromModalFields(f: ObjectModalFields | undefined): string {
  const c = f ? canonicalCountryFromModalFields(f) : null;
  if (!c) return "Unknown";
  return formatCountryDisplayName(c);
}

export type PlaceVsAnchor = "same" | "different" | "unknown";

export function placeVsAnchorLabel(
  anchor: ObjectModalFields | undefined,
  other: ObjectModalFields | undefined
): PlaceVsAnchor {
  if (!anchor || !other) return "unknown";
  const ca = canonicalCountryFromModalFields(anchor);
  const cb = canonicalCountryFromModalFields(other);
  if (!ca || !cb) return "unknown";
  return ca === cb ? "same" : "different";
}

export function formatPlaceVsAnchorSentence(
  anchor: ObjectModalFields | undefined,
  other: ObjectModalFields | undefined
): string {
  const v = placeVsAnchorLabel(anchor, other);
  if (v === "same") return "Same country";
  if (v === "different") return "Different country";
  return "Place vs selection: Unknown";
}
