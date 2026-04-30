import { useMemo } from "react";
import useValidObjectIds from "./useValidObjectIds";

const S3_REAL_IMAGES_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

type ImageSuffix = "_outline.svg" | "_mask.png" | "_no_bg.png";

function toImageMap(objectIds: string[], suffix: ImageSuffix) {
  const imageMap = new Map<string, string>();
  for (const objectId of objectIds) {
    imageMap.set(objectId, `${S3_REAL_IMAGES_BASE_URL}/${objectId}${suffix}`);
  }
  return imageMap;
}

function useImageModules() {
  const validObjectIds = useValidObjectIds();
  const objectIds = useMemo(() => Array.from(validObjectIds), [validObjectIds]);

  const outlineImageByObjectId = useMemo(() => toImageMap(objectIds, "_outline.svg"), [objectIds]);

  const maskImageByObjectId = useMemo(() => toImageMap(objectIds, "_mask.png"), [objectIds]);

  const noBgImageByObjectId = useMemo(() => toImageMap(objectIds, "_no_bg.png"), [objectIds]);

  return { outlineImageByObjectId, maskImageByObjectId, noBgImageByObjectId };
}

export default useImageModules;
