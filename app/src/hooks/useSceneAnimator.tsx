import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import type { ObjectLayout } from "./useViewLayouts";

type SceneNodeMap = Map<string, HTMLDivElement>;

type UseSceneAnimatorParams = {
  nodeByObjectId: SceneNodeMap;
  objectLayoutById: Map<string, ObjectLayout>;
};

const DEFAULT_SCENE_MOTION_DURATION_S = 1.05;
/** Slightly longer + softer ease than motion so All↔Timeline/Map size changes read smoother. */
const DEFAULT_SCENE_SIZE_DURATION_S = 1.55;
const DEFAULT_SCENE_SIZE_EASE = "sine.inOut";

function noiseFromObjectId(objectId: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < objectId.length; index += 1) {
    hash ^= objectId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function useSceneAnimator({ nodeByObjectId, objectLayoutById }: UseSceneAnimatorParams) {
  const hasInitializedRef = useRef(false);
  const activeTimelineRef = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    activeTimelineRef.current?.kill();
    activeTimelineRef.current = null;

    if (!hasInitializedRef.current) {
      nodeByObjectId.forEach((node, objectId) => {
        const layout = objectLayoutById.get(objectId);
        if (!layout) return;
        gsap.set(node, {
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
          opacity: layout.visible ? 1 : 0
        });
      });
      hasInitializedRef.current = true;
      return;
    }

    const timeline = gsap.timeline({
      defaults: { duration: DEFAULT_SCENE_MOTION_DURATION_S, ease: "power2.out" }
    });
    activeTimelineRef.current = timeline;

    nodeByObjectId.forEach((node, objectId) => {
      const layout = objectLayoutById.get(objectId);
      if (!layout) return;

      if (!layout.visible) {
        timeline.set(
          node,
          {
            opacity: 0,
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height
          },
          0
        );
        return;
      }

      const currentX = Number(gsap.getProperty(node, "x")) || 0;
      const currentY = Number(gsap.getProperty(node, "y")) || 0;
      const travelX = layout.x - currentX;
      const travelY = layout.y - currentY;
      const travelDistance = Math.hypot(travelX, travelY);
      const safeDistance = travelDistance || 1;
      const directionX = travelX / safeDistance;
      const directionY = travelY / safeDistance;
      const perpendicularX = -directionY;
      const perpendicularY = directionX;
      const arcAmplitude = clamp(travelDistance * 0.16, 7, 36);
      const arcSign = noiseFromObjectId(objectId, 31) > 0.5 ? 1 : -1;
      const arcStrength = arcAmplitude * arcSign;
      const phaseOffset = noiseFromObjectId(objectId, 47) * Math.PI * 2;
      const microAmplitude = clamp(travelDistance * 0.028, 1.5, 6);
      const progressProxy = { t: 0 };

      timeline.to(
        progressProxy,
        {
          t: 1,
          ease: "power2.out",
          duration: DEFAULT_SCENE_MOTION_DURATION_S,
          onUpdate: () => {
            const t = progressProxy.t;
            const baseX = currentX + travelX * t;
            const baseY = currentY + travelY * t;
            const arcOffset = Math.sin(Math.PI * t) * arcStrength;
            const microOffset = Math.sin(Math.PI * 2 * t + phaseOffset) * microAmplitude * (1 - t);

            gsap.set(node, {
              x: baseX + perpendicularX * (arcOffset + microOffset),
              y: baseY + perpendicularY * (arcOffset + microOffset)
            });
          }
        },
        0
      );

      timeline.to(
        node,
        {
          width: layout.width,
          height: layout.height,
          opacity: layout.visible ? 1 : 0,
          duration: DEFAULT_SCENE_SIZE_DURATION_S,
          ease: DEFAULT_SCENE_SIZE_EASE
        },
        0
      );
    });

    return () => {
      timeline.kill();
      if (activeTimelineRef.current === timeline) activeTimelineRef.current = null;
    };
  }, [nodeByObjectId, objectLayoutById]);
}

export default useSceneAnimator;
