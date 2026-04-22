// TODO better list of all objectIDs

import { useMemo } from "react";
import finalClusterObjectIdsCsv from "../../../process_data/cluster/final_clusters_object_ids.csv?raw";

const S3_REAL_IMAGES_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

type ImageSuffix = "_outline.png" | "_mask.png" | "_no_bg.png";

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

function buildObjectIds(objectIdsCsv: string) {
  const lines = objectIdsCsv.split(/\r?\n/).filter(Boolean);
  const objectIds = new Set<string>();

  for (const line of lines.slice(1)) {
    const [objectId] = parseCsvLine(line);
    if (!objectId) continue;
    objectIds.add(objectId);
  }

  return Array.from(objectIds);
}

function toImageMap(objectIds: string[], suffix: ImageSuffix) {
  const imageMap = new Map<string, string>();
  for (const objectId of objectIds) {
    imageMap.set(objectId, `${S3_REAL_IMAGES_BASE_URL}/${objectId}${suffix}`);
  }
  return imageMap;
}

function useImageModules() {
  const objectIds = useMemo(() => buildObjectIds(finalClusterObjectIdsCsv), []);

  const outlineImageByObjectId = useMemo(() => toImageMap(objectIds, "_outline.png"), [objectIds]);

  const maskImageByObjectId = useMemo(() => toImageMap(objectIds, "_mask.png"), [objectIds]);

  const noBgImageByObjectId = useMemo(() => toImageMap(objectIds, "_no_bg.png"), [objectIds]);

  return { outlineImageByObjectId, maskImageByObjectId, noBgImageByObjectId };
}

export default useImageModules;
