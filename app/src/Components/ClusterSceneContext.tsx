import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MAIN_SHELF_CONTAINER_ANCHOR_ID } from "./constants";
import { useShelfTab, type ShelfTab } from "./shelfTabState";

export type ClusterOverlayImageMode = "solid" | "outline" | "color";

type OpenClusterArgs = {
  clusterId: string;
  initialImageMode?: ClusterOverlayImageMode;
  /** Which `ShelfContainer` tab to restore when closing the overlay. */
  returnShelfTab?: ShelfTab;
  /** Shape-cluster scene entered from shape shelf tiles (headline + stacked glyph). */
  fromShelf?: boolean;
};

type ClusterSceneContextValue = {
  activeClusterId: string | null;
  overlayInitialImageMode: ClusterOverlayImageMode | undefined;
  overlayFromShelf: boolean;
  /** Increments each time the cluster overlay closes (for replaying shelf entrance animations). */
  clusterOverlayCloseGeneration: number;
  openCluster: (args: OpenClusterArgs) => void;
  closeCluster: () => void;
};

const ClusterSceneContext = createContext<ClusterSceneContextValue | null>(null);

export function ClusterSceneProvider({ children }: { children: ReactNode }) {
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [overlayInitialImageMode, setOverlayInitialImageMode] = useState<
    ClusterOverlayImageMode | undefined
  >();
  const [overlayFromShelf, setOverlayFromShelf] = useState(false);
  const [returnShelfTab, setReturnShelfTab] = useState<ShelfTab>("shape");
  const [clusterOverlayCloseGeneration, setClusterOverlayCloseGeneration] = useState(0);
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
    setOverlayFromShelf(Boolean(args.fromShelf));
    setActiveClusterId(args.clusterId);
  }, []);

  const closeCluster = useCallback(() => {
    setActiveClusterId(null);
    setOverlayInitialImageMode(undefined);
    setOverlayFromShelf(false);
    setClusterOverlayCloseGeneration((g) => g + 1);
    setSelectedShelfTab(returnShelfTab);
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToShelfSection);
    });
  }, [returnShelfTab, scrollToShelfSection, setSelectedShelfTab]);

  const value = useMemo(
    () => ({
      activeClusterId,
      overlayInitialImageMode,
      overlayFromShelf,
      clusterOverlayCloseGeneration,
      openCluster,
      closeCluster
    }),
    [
      activeClusterId,
      clusterOverlayCloseGeneration,
      closeCluster,
      openCluster,
      overlayFromShelf,
      overlayInitialImageMode
    ]
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
