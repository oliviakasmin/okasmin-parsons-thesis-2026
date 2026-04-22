import { useMemo } from "react";

function toImageMap(
  modules: Record<string, string>,
  suffix: "_outline.png" | "_mask.png" | "_no_bg.png"
) {
  const imageMap = new Map<string, string>();
  for (const [path, src] of Object.entries(modules)) {
    const filename = path.split("/").pop() ?? "";
    if (!filename.endsWith(suffix)) continue;
    const objectId = filename.slice(0, -suffix.length);
    imageMap.set(objectId, src);
  }
  return imageMap;
}

function useImageModules() {
  const outlineImageByObjectId = useMemo(
    () =>
      toImageMap(
        import.meta.glob("../../../process_data/real_images/*_outline.png", {
          eager: true,
          import: "default"
        }) as Record<string, string>,
        "_outline.png"
      ),
    []
  );

  const maskImageByObjectId = useMemo(
    () =>
      toImageMap(
        import.meta.glob("../../../process_data/real_images/*_mask.png", {
          eager: true,
          import: "default"
        }) as Record<string, string>,
        "_mask.png"
      ),
    []
  );

  const noBgImageByObjectId = useMemo(
    () =>
      toImageMap(
        import.meta.glob("../../../process_data/real_images/*_no_bg.png", {
          eager: true,
          import: "default"
        }) as Record<string, string>,
        "_no_bg.png"
      ),
    []
  );

  return { outlineImageByObjectId, maskImageByObjectId, noBgImageByObjectId };
}

export default useImageModules;
