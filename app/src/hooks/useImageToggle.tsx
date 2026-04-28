import { useCallback, useMemo, useState } from "react";

export type ImageToggleMode = "solid" | "outline" | "color";

type UseImageToggleOptions = {
  colorOption?: boolean;
  initialMode?: ImageToggleMode;
};

function getModeOptions(colorOption: boolean): ImageToggleMode[] {
  return colorOption ? ["solid", "outline", "color"] : ["solid", "outline"];
}

function normalizeMode(
  requestedMode: ImageToggleMode | undefined,
  options: ImageToggleMode[]
): ImageToggleMode {
  if (requestedMode && options.includes(requestedMode)) {
    return requestedMode;
  }
  return "solid";
}

function useImageToggle({
  colorOption = false,
  initialMode = "solid"
}: UseImageToggleOptions = {}) {
  const options = useMemo(() => getModeOptions(colorOption), [colorOption]);
  const [mode, setModeState] = useState<ImageToggleMode>(() => normalizeMode(initialMode, options));

  const setMode = useCallback(
    (nextMode: ImageToggleMode) => {
      setModeState((previousMode) => {
        if (options.includes(nextMode)) {
          return nextMode;
        }
        return normalizeMode(previousMode, options);
      });
    },
    [options]
  );

  return { mode, options, setMode };
}

export default useImageToggle;
