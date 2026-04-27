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
  bucketSpanByKey: Map<string, number>;
};

type TimelineBucketLike = {
  key: string;
  objectIds: string[];
};

type BuildSceneLayoutParams = {
  objectIds: string[];
  buckets: TimelineBucketLike[];
  view: "all" | "timeline" | "map";
  sceneWidth: number;
  sceneHeight: number;
  imageSizePx: number;
  mapProjectionByObjectId?: Map<string, { x: number; y: number; visible: boolean }>;
};

const MAP_LABEL_CLEARANCE_PX = 10;

function ensurePositive(numberValue: number, fallback: number) {
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function buildAllLayout(
  objectIds: string[],
  sceneWidth: number,
  imageSizePx: number
): Pick<SceneLayout, "objectLayoutById" | "sceneHeight" | "bucketSpanByKey"> {
  const objectLayoutById = new Map<string, ObjectLayout>();
  const bucketSpanByKey = new Map<string, number>();
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
  return { objectLayoutById, sceneHeight, bucketSpanByKey };
}

function buildTimelineLayout(
  objectIds: string[],
  buckets: TimelineBucketLike[],
  sceneHeight: number,
  imageSizePx: number
): Pick<SceneLayout, "objectLayoutById" | "sceneHeight" | "bucketSpanByKey"> {
  const objectLayoutById = new Map<string, ObjectLayout>();
  const bucketSpanByKey = new Map<string, number>();
  const bucketCount = Math.max(1, buckets.length);
  const minRowHeight = imageSizePx + 18;
  const fitRowHeight = Math.floor(sceneHeight / bucketCount);
  const rowHeight = Math.max(minRowHeight, fitRowHeight);
  const laneStep = imageSizePx + 6;
  let maxLaneDepth = 1;

  objectIds.forEach((objectId) => {
    objectLayoutById.set(objectId, {
      x: 0,
      y: 0,
      width: imageSizePx,
      height: imageSizePx,
      visible: false
    });
  });

  buckets.forEach((bucket, bucketIndex) => {
    bucketSpanByKey.set(bucket.key, rowHeight);
    maxLaneDepth = Math.max(maxLaneDepth, bucket.objectIds.length);

    bucket.objectIds.forEach((objectId, stackIndex) => {
      objectLayoutById.set(objectId, {
        x: stackIndex * laneStep,
        y: bucketIndex * rowHeight + (rowHeight - imageSizePx) / 2,
        width: imageSizePx,
        height: imageSizePx,
        visible: true
      });
    });
  });

  const computedSceneHeight = bucketCount * rowHeight;
  const requiredWidth = maxLaneDepth * laneStep + imageSizePx;
  objectIds.forEach((objectId) => {
    const layout = objectLayoutById.get(objectId);
    if (!layout || !layout.visible) return;
    layout.x = Math.min(layout.x, Math.max(requiredWidth - imageSizePx, 0));
  });
  return { objectLayoutById, sceneHeight: computedSceneHeight, bucketSpanByKey };
}

function buildMapLayout(
  objectIds: string[],
  sceneWidth: number,
  sceneHeight: number,
  imageSizePx: number,
  mapProjectionByObjectId: Map<string, { x: number; y: number; visible: boolean }>
): Pick<SceneLayout, "objectLayoutById" | "sceneHeight" | "bucketSpanByKey"> {
  const objectLayoutById = new Map<string, ObjectLayout>();
  const bucketSpanByKey = new Map<string, number>();

  objectIds.forEach((objectId) => {
    const projected = mapProjectionByObjectId.get(objectId);
    const visible = projected?.visible === true;
    const centerX = projected?.x ?? sceneWidth / 2;
    const bottomY = (projected?.y ?? sceneHeight / 2) - MAP_LABEL_CLEARANCE_PX;

    objectLayoutById.set(objectId, {
      x: centerX - imageSizePx / 2,
      y: bottomY - imageSizePx,
      width: imageSizePx,
      height: imageSizePx,
      visible
    });
  });

  return { objectLayoutById, sceneHeight, bucketSpanByKey };
}

function buildSceneLayout({
  objectIds,
  buckets,
  view,
  sceneWidth,
  sceneHeight,
  imageSizePx,
  mapProjectionByObjectId
}: BuildSceneLayoutParams): SceneLayout {
  const width = ensurePositive(sceneWidth, imageSizePx * 4);
  const height = ensurePositive(sceneHeight, imageSizePx * 4);
  const size = ensurePositive(imageSizePx, 24);

  if (view === "timeline") {
    const timelineLayout = buildTimelineLayout(objectIds, buckets, height, size);
    return {
      objectLayoutById: timelineLayout.objectLayoutById,
      sceneHeight: timelineLayout.sceneHeight,
      sceneWidth: width,
      bucketSpanByKey: timelineLayout.bucketSpanByKey
    };
  }

  if (view === "map") {
    const mapLayout = buildMapLayout(
      objectIds,
      width,
      height,
      size,
      mapProjectionByObjectId ?? new Map()
    );
    return {
      objectLayoutById: mapLayout.objectLayoutById,
      sceneHeight: mapLayout.sceneHeight,
      sceneWidth: width,
      bucketSpanByKey: mapLayout.bucketSpanByKey
    };
  }

  const allLayout = buildAllLayout(objectIds, width, size);
  return {
    objectLayoutById: allLayout.objectLayoutById,
    sceneHeight: allLayout.sceneHeight,
    sceneWidth: width,
    bucketSpanByKey: allLayout.bucketSpanByKey
  };
}

export { buildSceneLayout };
export type { ObjectLayout, SceneLayout, TimelineBucketLike };
