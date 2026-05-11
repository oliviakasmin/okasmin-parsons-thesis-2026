import { useMemo } from "react";
import useValidObjectIds from "./useValidObjectIds";

export type ClusterRow = {
  cluster: string;
  clusterType: string;
  allObjectIds: string[];
  closestTop5Ids: string[];
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

/**
 * Build per-cluster object lists from `final_clusters_object_ids.csv`, which is exported with rows
 * sorted by ascending distance to that cluster's centroid (see `export_final_cluster_csvs` in
 * `format_data/cluster_shape/cluster_utils.py`). Row order is preserved after filtering.
 */
function buildClusters(keysCsv: string, clusterObjectIdsCsv: string, validObjectIds: Set<string>) {
  const objectIdsByCluster = new Map<string, string[]>();
  const objectLines = clusterObjectIdsCsv.split(/\r?\n/).filter(Boolean);
  if (objectLines.length < 2) return [];

  const objectHeader = parseCsvLine(objectLines[0]);
  const objectIdIdx = objectHeader.indexOf("object_id");
  const clusterIdx = objectHeader.indexOf("cluster");

  if (objectIdIdx === -1 || clusterIdx === -1) return [];

  for (const line of objectLines.slice(1)) {
    const cells = parseCsvLine(line);
    const objectId = cells[objectIdIdx];
    const cluster = cells[clusterIdx];
    if (!cluster || !objectId) continue;
    if (!validObjectIds.has(objectId)) continue;
    const existing = objectIdsByCluster.get(cluster) ?? [];
    existing.push(objectId);
    objectIdsByCluster.set(cluster, existing);
  }

  const rows: ClusterRow[] = [];
  const keyLines = keysCsv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(keyLines[0]);
  const clusterKeyIdx = header.indexOf("cluster");
  const clusterTypeIdx = header.indexOf("cluster_type");
  const closest1Idx = header.indexOf("closest_object_id_1");
  const closest2Idx = header.indexOf("closest_object_id_2");
  const closest3Idx = header.indexOf("closest_object_id_3");
  const closest4Idx = header.indexOf("closest_object_id_4");
  const closest5Idx = header.indexOf("closest_object_id_5");

  for (const line of keyLines.slice(1)) {
    const cells = parseCsvLine(line);
    const cluster = cells[clusterKeyIdx];
    if (!cluster) continue;
    const closestTop5Ids = [
      cells[closest1Idx],
      cells[closest2Idx],
      cells[closest3Idx],
      cells[closest4Idx],
      cells[closest5Idx]
    ].filter((value): value is string => Boolean(value) && validObjectIds.has(value));
    const allObjectIds = objectIdsByCluster.get(cluster) ?? [];
    if (allObjectIds.length === 0 && closestTop5Ids.length === 0) {
      continue;
    }
    rows.push({
      cluster,
      clusterType: cells[clusterTypeIdx] ?? "unknown",
      allObjectIds,
      closestTop5Ids
    });
  }

  return rows;
}

function useFormatClusters(keysCsv: string, clusterObjectIdsCsv: string) {
  const validObjectIds = useValidObjectIds();
  const clusterRows = useMemo(
    () => buildClusters(keysCsv, clusterObjectIdsCsv, validObjectIds),
    [keysCsv, clusterObjectIdsCsv, validObjectIds]
  );
  const clusterRowById = useMemo(
    () => new Map(clusterRows.map((row) => [row.cluster, row])),
    [clusterRows]
  );

  return { clusterRows, clusterRowById };
}

export default useFormatClusters;
