import { useMemo } from "react";

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

function buildClusters(keysCsv: string, objectIdsCsv: string) {
  const objectIdsByCluster = new Map<string, string[]>();
  const objectIdLines = objectIdsCsv.split(/\r?\n/).filter(Boolean);

  for (const line of objectIdLines.slice(1)) {
    const [objectId, cluster] = parseCsvLine(line);
    if (!cluster || !objectId) continue;
    const existing = objectIdsByCluster.get(cluster) ?? [];
    existing.push(objectId);
    objectIdsByCluster.set(cluster, existing);
  }

  const rows: ClusterRow[] = [];
  const keyLines = keysCsv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(keyLines[0]);
  const clusterIdx = header.indexOf("cluster");
  const clusterTypeIdx = header.indexOf("cluster_type");
  const closest1Idx = header.indexOf("closest_object_id_1");
  const closest2Idx = header.indexOf("closest_object_id_2");
  const closest3Idx = header.indexOf("closest_object_id_3");
  const closest4Idx = header.indexOf("closest_object_id_4");
  const closest5Idx = header.indexOf("closest_object_id_5");

  for (const line of keyLines.slice(1)) {
    const cells = parseCsvLine(line);
    const cluster = cells[clusterIdx];
    if (!cluster) continue;
    rows.push({
      cluster,
      clusterType: cells[clusterTypeIdx] ?? "unknown",
      allObjectIds: objectIdsByCluster.get(cluster) ?? [],
      closestTop5Ids: [
        cells[closest1Idx],
        cells[closest2Idx],
        cells[closest3Idx],
        cells[closest4Idx],
        cells[closest5Idx]
      ].filter(Boolean)
    });
  }

  return rows;
}

function useFormatClusters(keysCsv: string, objectIdsCsv: string) {
  const clusterRows = useMemo(() => buildClusters(keysCsv, objectIdsCsv), [keysCsv, objectIdsCsv]);
  const clusterRowById = useMemo(
    () => new Map(clusterRows.map((row) => [row.cluster, row])),
    [clusterRows]
  );

  return { clusterRows, clusterRowById };
}

export default useFormatClusters;
