import shapeNeighborsJson from "../../../format_data/generated/shape_neighbors_euclidean.json";
import objectStatsJson from "../../public/data/object_stats.json";

export type ShapeNeighborEntry = {
  neighborId: string;
  rank: number;
  distance?: number;
};

export type ShapeNeighborsRow = {
  /** Top 20 shape-similar neighbors by silhouette metric (see `compute_shape_neighbors.py`). */
  neighbors20: ShapeNeighborEntry[];
  neighborsModal7: ShapeNeighborEntry[];
};

export type ShapeNeighborsPayload = {
  metric: string;
  yearMinCorpus: number | null;
  yearMaxCorpus: number | null;
  maxPossibleYearGap: number | null;
  byObjectId: Record<string, ShapeNeighborsRow>;
};

/** Raw JSON may use `neighbors20`, legacy `neighbors15`, or `neighbors10`. */
type ShapeNeighborsRowJson = {
  neighbors20?: ShapeNeighborEntry[];
  neighbors15?: ShapeNeighborEntry[];
  neighbors10?: ShapeNeighborEntry[];
  neighborsModal7?: ShapeNeighborEntry[];
};

function normalizeShapeNeighborsRow(raw: ShapeNeighborsRowJson): ShapeNeighborsRow {
  return {
    neighbors20: raw.neighbors20 ?? raw.neighbors15 ?? raw.neighbors10 ?? [],
    neighborsModal7: raw.neighborsModal7 ?? []
  };
}

const payloadRaw = shapeNeighborsJson as Omit<ShapeNeighborsPayload, "byObjectId"> & {
  byObjectId: Record<string, ShapeNeighborsRowJson>;
};

const normalizedByObjectId: Record<string, ShapeNeighborsRow> = Object.fromEntries(
  Object.entries(payloadRaw.byObjectId).map(([id, row]) => [id, normalizeShapeNeighborsRow(row)])
);

type ObjectStatsFile = {
  maximumDateSpan: {
    minObjectBeginDate: number;
    maxObjectEndDate: number;
    spanYears: number;
  };
};

const objectStats = objectStatsJson as ObjectStatsFile;

/** Corpus date bounds and span for chronology captions (`app/public/data/object_stats.json`). */
export const corpusYearMin = objectStats.maximumDateSpan.minObjectBeginDate;
export const corpusYearMax = objectStats.maximumDateSpan.maxObjectEndDate;
export const corpusMaxPossibleYearGap = objectStats.maximumDateSpan.spanYears;

export function getShapeNeighborsForObject(objectId: string): ShapeNeighborsRow | undefined {
  return normalizedByObjectId[objectId];
}

/** Object IDs present in the precomputed neighbor file (silhouette ∩ fields). */
export function getAllShapeNeighborObjectIds(): string[] {
  return Object.keys(normalizedByObjectId);
}
