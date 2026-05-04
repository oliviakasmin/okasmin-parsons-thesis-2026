import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MAIN_SHELF_CONTAINER_ANCHOR_ID } from "./constants";
import { useShelfTab, type ShelfTab } from "./shelfTabState";

export type ClusterOverlayImageMode = "solid" | "outline" | "color";

type OpenClusterArgs = {
  clusterId: string;
  initialImageMode?: ClusterOverlayImageMode;
  /** Which ShelfContainer tab to restore when closing the overlay (default shape). */
  returnShelfTab?: ShelfTab;
};

type ClusterSceneContextValue = {
  activeClusterId: string | null;
  overlayInitialImageMode: ClusterOverlayImageMode | undefined;
  openCluster: (args: OpenClusterArgs) => void;
  closeCluster: () => void;
};

const ClusterSceneContext = createContext<ClusterSceneContextValue | null>(null);

export function ClusterSceneProvider({ children }: { children: ReactNode }) {
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [overlayInitialImageMode, setOverlayInitialImageMode] = useState<
    ClusterOverlayImageMode | undefined
  >();
  const [returnShelfTab, setReturnShelfTab] = useState<ShelfTab>("shape");
  const { setSelectedShelfTab } = useShelfTab();

  const scrollToShelfSection = useCallback(() => {
    const el = document.getElementById(MAIN_SHELF_CONTAINER_ANCHOR_ID);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y, behavior: "auto" });
  }, []);

  const openCluster = useCallback((args: OpenClusterArgs) => {
    setOverlayInitialImageMode(args.initialImageMode);
    setReturnShelfTab(args.returnShelfTab ?? "shape");
    setActiveClusterId(args.clusterId);
  }, []);

  const closeCluster = useCallback(() => {
    setActiveClusterId(null);
    setOverlayInitialImageMode(undefined);
    setSelectedShelfTab(returnShelfTab);
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToShelfSection);
    });
  }, [returnShelfTab, scrollToShelfSection, setSelectedShelfTab]);

  const value = useMemo(
    () => ({
      activeClusterId,
      overlayInitialImageMode,
      openCluster,
      closeCluster
    }),
    [activeClusterId, closeCluster, openCluster, overlayInitialImageMode]
  );

  return <ClusterSceneContext.Provider value={value}>{children}</ClusterSceneContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useClusterScene() {
  const ctx = useContext(ClusterSceneContext);
  if (!ctx) {
    throw new Error("useClusterScene must be used within ClusterSceneProvider");
  }
  return ctx;
}
