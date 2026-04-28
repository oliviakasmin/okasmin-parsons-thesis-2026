import { useLayoutEffect, useState, type RefObject } from "react";

type SceneViewportSize = {
  width: number;
  height: number;
};

const EMPTY_SCENE_VIEWPORT_SIZE: SceneViewportSize = { width: 0, height: 0 };

function useSceneViewportSize(ref: RefObject<HTMLElement | null>): SceneViewportSize {
  const [size, setSize] = useState<SceneViewportSize>(EMPTY_SCENE_VIEWPORT_SIZE);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = entry.contentRect.width;
      const nextHeight = entry.contentRect.height;
      setSize((previous) =>
        previous.width === nextWidth && previous.height === nextHeight
          ? previous
          : {
              width: nextWidth,
              height: nextHeight
            }
      );
    });

    observer.observe(node);

    const initialRect = node.getBoundingClientRect();
    const nextWidth = initialRect.width;
    const nextHeight = initialRect.height;
    setSize((previous) =>
      previous.width === nextWidth && previous.height === nextHeight
        ? previous
        : {
            width: nextWidth,
            height: nextHeight
          }
    );

    return () => observer.disconnect();
  }, [ref]);

  return size;
}

export type { SceneViewportSize };

export default useSceneViewportSize;
