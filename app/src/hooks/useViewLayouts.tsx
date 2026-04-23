type RectMap = Map<string, DOMRect>;

type RectCoverage = {
  fromCount: number;
  toCount: number;
  matchedCount: number;
  missingInNext: string[];
  missingInPrevious: string[];
};

function getRectMapByObjectId(container: HTMLElement) {
  const rects: RectMap = new Map();
  const elements = container.querySelectorAll<HTMLElement>("[data-object-id]");

  elements.forEach((element) => {
    const objectId = element.dataset.objectId;
    if (!objectId) return;
    rects.set(objectId, element.getBoundingClientRect());
  });

  return rects;
}

function getRectCoverage(fromRects: RectMap, toRects: RectMap): RectCoverage {
  const missingInNext: string[] = [];
  const missingInPrevious: string[] = [];
  let matchedCount = 0;

  fromRects.forEach((_, objectId) => {
    if (toRects.has(objectId)) {
      matchedCount += 1;
      return;
    }
    missingInNext.push(objectId);
  });

  toRects.forEach((_, objectId) => {
    if (!fromRects.has(objectId)) missingInPrevious.push(objectId);
  });

  return {
    fromCount: fromRects.size,
    toCount: toRects.size,
    matchedCount,
    missingInNext,
    missingInPrevious
  };
}

export { getRectCoverage, getRectMapByObjectId };
export type { RectMap, RectCoverage };

type ObjectLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};

type SceneLayout = {
  objectLayoutById: Map<string, ObjectLayout>;
  sceneWidth: number;
  sceneHeight: number;
  bucketWidthByKey: Map<string, number>;
};

type TimelineBucketLike = {
  key: string;
  objectIds: string[];
};

type BuildSceneLayoutParams = {
  objectIds: string[];
  buckets: TimelineBucketLike[];
  view: "all" | "timeline";
  sceneWidth: number;
  imageSizePx: number;
};

function ensurePositive(numberValue: number, fallback: number) {
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function buildAllLayout(
  objectIds: string[],
  sceneWidth: number,
  imageSizePx: number
): Pick<SceneLayout, "objectLayoutById" | "sceneHeight" | "bucketWidthByKey"> {
  const objectLayoutById = new Map<string, ObjectLayout>();
  const bucketWidthByKey = new Map<string, number>();
  const cellWidth = imageSizePx + 4;
  const columns = Math.max(1, Math.floor(sceneWidth / cellWidth));
  const rowGap = 2;

  objectIds.forEach((objectId, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = col * cellWidth;
    const y = row * (imageSizePx + rowGap);

    objectLayoutById.set(objectId, {
      x,
      y,
      width: imageSizePx,
      height: imageSizePx,
      visible: true
    });
  });

  const totalRows = Math.max(1, Math.ceil(objectIds.length / columns));
  const sceneHeight = totalRows * (imageSizePx + rowGap);
  return { objectLayoutById, sceneHeight, bucketWidthByKey };
}

function buildTimelineLayout(
  objectIds: string[],
  buckets: TimelineBucketLike[],
  sceneWidth: number,
  imageSizePx: number
): Pick<SceneLayout, "objectLayoutById" | "sceneHeight" | "bucketWidthByKey"> {
  const objectLayoutById = new Map<string, ObjectLayout>();
  const bucketWidthByKey = new Map<string, number>();
  const bucketCount = Math.max(1, buckets.length);
  const bucketWidth = Math.max(imageSizePx, sceneWidth / bucketCount);
  let maxStackDepth = 1;

  objectIds.forEach((objectId) => {
    objectLayoutById.set(objectId, {
      x: sceneWidth / 2 - imageSizePx / 2,
      y: 0,
      width: imageSizePx,
      height: imageSizePx,
      visible: false
    });
  });

  buckets.forEach((bucket, bucketIndex) => {
    bucketWidthByKey.set(bucket.key, bucketWidth);
    maxStackDepth = Math.max(maxStackDepth, bucket.objectIds.length);

    bucket.objectIds.forEach((objectId, stackIndex) => {
      objectLayoutById.set(objectId, {
        x: bucketIndex * bucketWidth + (bucketWidth - imageSizePx) / 2,
        y: stackIndex * imageSizePx,
        width: imageSizePx,
        height: imageSizePx,
        visible: true
      });
    });
  });

  const sceneHeight = maxStackDepth * imageSizePx;
  return { objectLayoutById, sceneHeight, bucketWidthByKey };
}

function buildSceneLayout({
  objectIds,
  buckets,
  view,
  sceneWidth,
  imageSizePx
}: BuildSceneLayoutParams): SceneLayout {
  const width = ensurePositive(sceneWidth, imageSizePx * 4);
  const size = ensurePositive(imageSizePx, 24);

  if (view === "timeline") {
    const timelineLayout = buildTimelineLayout(objectIds, buckets, width, size);
    return {
      objectLayoutById: timelineLayout.objectLayoutById,
      sceneHeight: timelineLayout.sceneHeight,
      sceneWidth: width,
      bucketWidthByKey: timelineLayout.bucketWidthByKey
    };
  }

  const allLayout = buildAllLayout(objectIds, width, size);
  return {
    objectLayoutById: allLayout.objectLayoutById,
    sceneHeight: allLayout.sceneHeight,
    sceneWidth: width,
    bucketWidthByKey: allLayout.bucketWidthByKey
  };
}

export { buildSceneLayout };
export type { ObjectLayout, SceneLayout, TimelineBucketLike };
