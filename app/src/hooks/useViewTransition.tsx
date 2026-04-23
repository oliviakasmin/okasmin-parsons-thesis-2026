import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import gsap from "gsap";
import { getRectCoverage, getRectMapByObjectId } from "./useViewLayouts";

type MotionPreset = "continuity-first" | "subtle";

function useViewTransition(
  containerRef: RefObject<HTMLElement | null>,
  dependencyKey: string,
  motionPreset: MotionPreset = "continuity-first"
) {
  const previousRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const previousDependencyRef = useRef<string | null>(null);
  const activeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const activeGhostsRef = useRef<HTMLElement[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const currentRects = getRectMapByObjectId(container);
    const didChangeView =
      previousDependencyRef.current !== null && previousDependencyRef.current !== dependencyKey;

    if (didChangeView && previousRectsRef.current) {
      activeTimelineRef.current?.kill();
      activeTimelineRef.current = null;
      activeGhostsRef.current.forEach((ghost) => ghost.remove());
      activeGhostsRef.current = [];

      const elements = container.querySelectorAll<HTMLElement>("[data-object-id]");
      const revealedElements: HTMLElement[] = [];
      const previousRects = previousRectsRef.current;
      const coverage = getRectCoverage(previousRects, currentRects);

      console.debug("[useViewTransition] continuity", {
        dependencyKey,
        previousDependencyKey: previousDependencyRef.current,
        fromCount: coverage.fromCount,
        toCount: coverage.toCount,
        matchedCount: coverage.matchedCount,
        missingInNext: coverage.missingInNext.slice(0, 10),
        missingInPrevious: coverage.missingInPrevious.slice(0, 10),
        capturedAtMs: Date.now()
      });

      if (reduceMotion || coverage.matchedCount === 0) {
        previousRectsRef.current = currentRects;
        previousDependencyRef.current = dependencyKey;
        return;
      }

      const timeline = gsap.timeline({ defaults: { duration: 0.82, ease: "power2.out" } });
      activeTimelineRef.current = timeline;

      elements.forEach((element) => {
        const objectId = element.dataset.objectId;
        if (!objectId) return;
        const previousRect = previousRects.get(objectId);
        const nextRect = currentRects.get(objectId);
        if (!previousRect || !nextRect) return;

        const travelX = nextRect.left - previousRect.left;
        const travelY = nextRect.top - previousRect.top;
        const finalScaleX = nextRect.width / Math.max(previousRect.width, 1);
        const finalScaleY = nextRect.height / Math.max(previousRect.height, 1);
        const isSubtle = motionPreset === "subtle";
        const midX = isSubtle ? travelX * 0.52 : travelX;
        const midY = isSubtle ? travelY * 0.48 - Math.sign(travelY || 1) * 12 : travelY;
        const segmentDurationA = isSubtle ? 0.34 : 0.8;
        const segmentDurationB = isSubtle ? 0.38 : 0.01;
        const overshootScale = isSubtle ? 1.012 : 1;

        // Hide the destination element until its object-level ghost reaches the new rect.
        gsap.set(element, { opacity: 0 });
        revealedElements.push(element);

        const ghost = element.cloneNode(true) as HTMLElement;
        ghost.style.position = "fixed";
        ghost.style.left = `${previousRect.left}px`;
        ghost.style.top = `${previousRect.top}px`;
        ghost.style.width = `${previousRect.width}px`;
        ghost.style.height = `${previousRect.height}px`;
        ghost.style.margin = "0";
        ghost.style.pointerEvents = "none";
        ghost.style.zIndex = "9999";
        ghost.style.transformOrigin = "bottom center";
        document.body.appendChild(ghost);
        activeGhostsRef.current.push(ghost);

        timeline.to(
          ghost,
          {
            x: midX,
            y: midY,
            scaleX: overshootScale,
            scaleY: overshootScale,
            duration: segmentDurationA
          },
          0
        );
        timeline.to(
          ghost,
          {
            x: travelX,
            y: travelY,
            scaleX: finalScaleX,
            scaleY: finalScaleY,
            duration: segmentDurationB,
            onComplete: () => {
              ghost.remove();
            }
          },
          segmentDurationA
        );
      });

      timeline.call(() => {
        revealedElements.forEach((element) => gsap.set(element, { opacity: 1 }));
        activeGhostsRef.current = [];
        activeTimelineRef.current = null;
      });
    }

    previousRectsRef.current = currentRects;
    previousDependencyRef.current = dependencyKey;
  }, [containerRef, dependencyKey, motionPreset]);
}

export default useViewTransition;
