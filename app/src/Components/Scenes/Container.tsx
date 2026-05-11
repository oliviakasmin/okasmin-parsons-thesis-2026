import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { Box, Button, IconButton, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import finalClusterKeysCsv from "../../../../format_data/cluster_shape/final_clusters_keys.csv?raw";
import fieldsCsv from "../../../../format_data/generated/fields.csv?raw";
import BackButton from "../BackButton";
import ImageToggleButton from "../ImageToggleButton";
import useImageToggle, { type ImageToggleMode } from "../../hooks/useImageToggle";
import useImageModules from "../../hooks/useImageModules";
import useFormatClusters from "../../hooks/useFormatClusters";
import useUseGroups, { isUseGroup, USE_GROUP_LABEL } from "../../hooks/useUseGroups";
import useColorGroups, { isColorGroupKey } from "../../hooks/useColorGroups";
import useTimelineBuckets from "../../hooks/useTimelineBuckets";
import useObjectGeo, {
  canonicalKeysMatchingGeocode,
  useObjectCountryNames
} from "../../hooks/useObjectGeo";
import useObjectModalMetadata from "../../hooks/useObjectModalMetadata";
import { buildSceneLayout } from "../../hooks/useViewLayouts";
import {
  ALL_SCENE_GRID_GAP_X_PX,
  ALL_SCENE_RENDER_IMAGE_SIZE_PX,
  SCENE_LEFT_PANEL_COLLAPSED_MIN_WIDTH_PX,
  SCENE_LEFT_PANEL_COLLAPSED_VW,
  SCENE_LEFT_PANEL_MAX_WIDTH_PX,
  SCENE_LEFT_PANEL_MIN_WIDTH_PX,
  SCENE_LEFT_PANEL_WIDTH_TRANSITION_MS,
  SCENE_LEFT_PANEL_WIDTH_VW,
  SUBGROUP_RENDER_IMAGE_SIZE_PX,
  TIMELINE_AXIS_TOP_GUTTER_PX,
  type HomeEntryScrollId
} from "../constants";
import MapView from "./Map";
import InlineOutlineSvg from "./InlineOutlineSvg";
import ObjectImageModal from "./ObjectImageModal";
import ObjectScene from "./ObjectScene";
import TimelineAxis from "./TimelineAxis";
import { useShelfTab } from "../shelfTabState";
import { ShelfStackedOutlineSvg } from "../EntryPoints/ShelfStackedOutlineSvg";

type SceneView = "all" | "timeline" | "map";
type ContainerLocationState = {
  homeScrollTo?: HomeEntryScrollId;
  initialImageMode?: "solid" | "outline" | "color";
  /** Shape-cluster scene entered from Shelf tiles (headline + stacked glyph). */
  fromShelf?: boolean;
};

/**
 * Pin the scene to the viewport inset (same as `body` margin in `styles.css`) and take it out of
 * document flow so `#root` / `body` `min-height: 100vh` cannot create a second vertical scroll.
 */
const sceneShellBaseSx = {
  position: "fixed",
  top: "var(--page-margin)",
  left: "var(--page-margin)",
  right: "var(--page-margin)",
  bottom: "var(--page-margin)",
  boxSizing: "border-box",
  overflow: "hidden",
  background: "#000",
  color: "#fff",
  px: "0.75rem",
  pb: "0.75rem",
  width: "auto",
  zIndex: 2
} as const;

const sceneHeadlineSx = {
  fontSize: "1.6rem",
  lineHeight: 1.15,
  color: "#bdbdbd",
  textAlign: "center"
} as const;

const sceneHeadlineEmphasisSx = {
  fontSize: "2rem",
  color: "#fff",
  fontWeight: 600,
  lineHeight: 1
} as const;

function sceneHeadlineEmphasis(children: ReactNode) {
  return (
    <Box component="span" sx={sceneHeadlineEmphasisSx}>
      {children}
    </Box>
  );
}

function formatCountryLabel(countryKey: string) {
  return countryKey
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function defaultStackOpacity(clusterSize: number) {
  return Math.min(1, Math.max(0.08, 1 / Math.max(18, clusterSize)));
}

/** Copy for the scene headline (timeline / map / all). Layout lives in Container. */
function sceneHeadlineContent(args: {
  view: SceneView;
  objectCount: number;
  objectLabelPlural: string;
  timelineSubject: string;
  mapSubject: string;
  spanYears: number;
  countryCount: number;
}): ReactNode {
  const {
    view,
    objectCount,
    objectLabelPlural,
    timelineSubject,
    mapSubject,
    spanYears,
    countryCount
  } = args;
  if (view === "timeline") {
    return (
      <>
        {timelineSubject} have been made for{" "}
        {sceneHeadlineEmphasis(spanYears.toLocaleString("en-US"))} {sceneHeadlineEmphasis("years")}{" "}
        (at least)
      </>
    );
  }
  if (view === "map") {
    return (
      <>
        {mapSubject} have been made across{" "}
        {sceneHeadlineEmphasis(countryCount.toLocaleString("en-US"))}{" "}
        {sceneHeadlineEmphasis(countryCount === 1 ? "country" : "countries")} (at least)
      </>
    );
  }
  return (
    <>
      {objectCount.toLocaleString("en-US")} {objectLabelPlural}
    </>
  );
}

function Container() {
  const { clusterId } = useParams();
  const location = useLocation();
  const locationState = (location.state as ContainerLocationState | null) ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const searchView = searchParams.get("view");
  const currentView: SceneView =
    searchView === "timeline" || searchView === "map" ? searchView : "all";
  const { mode, options, setMode } = useImageToggle({
    colorOption: true,
    initialMode: locationState?.initialImageMode ?? "outline"
  });
  const sceneViewportRef = useRef<HTMLDivElement | null>(null);
  const timelineAxisContentRef = useRef<HTMLDivElement | null>(null);
  const sceneContentScrollRef = useRef<HTMLDivElement | null>(null);
  const [sceneViewportSize, setSceneViewportSize] = useState({ width: 0, height: 0 });
  const [isLeftPanelExpanded, setIsLeftPanelExpanded] = useState(false);
  /** One beat: keep expanded width on timeline so width can animate closed after a scene change. */
  const [leftPanelSceneCollapseGrace, setLeftPanelSceneCollapseGrace] = useState(false);
  /** Column count for All grid at last collapsed rail width; used to shrink tiles when the rail expands. */
  const [allGridBaselineColumns, setAllGridBaselineColumns] = useState<number | null>(null);
  const [modalObjectId, setModalObjectId] = useState<string | null>(null);
  const [mapCountryPanel, setMapCountryPanel] = useState<{
    label: string;
    objectIds: string[];
  } | null>(null);
  const isLeftPanelExpandedRef = useRef(isLeftPanelExpanded);
  isLeftPanelExpandedRef.current = isLeftPanelExpanded;
  const { outlineImageByObjectId, maskImageByObjectId, noBgImageByObjectId } = useImageModules();
  const { clusterRows } = useFormatClusters(finalClusterKeysCsv, fieldsCsv);
  const { groupRowById: useGroupRowById } = useUseGroups();
  const { groupRowByKey } = useColorGroups();
  const { setSelectedShelfTab } = useShelfTab();
  const selectedCluster = useMemo(
    () => clusterRows.find((row) => row.cluster === clusterId),
    [clusterId, clusterRows]
  );
  const selectedUseGroup = useMemo(
    () => (clusterId && isUseGroup(clusterId) ? useGroupRowById.get(clusterId) : undefined),
    [clusterId, useGroupRowById]
  );
  const selectedColorGroup = useMemo(
    () => (clusterId && isColorGroupKey(clusterId) ? groupRowByKey.get(clusterId) : undefined),
    [clusterId, groupRowByKey]
  );
  const selectedEntry = useMemo(
    () =>
      selectedCluster
        ? {
            id: selectedCluster.cluster,
            typeLabel: selectedCluster.clusterType,
            objectIds: selectedCluster.allObjectIds
          }
        : selectedUseGroup
          ? {
              id: selectedUseGroup.group,
              typeLabel: "use group",
              objectIds: selectedUseGroup.objectIds
            }
          : selectedColorGroup
            ? {
                id: selectedColorGroup.groupKey,
                typeLabel: "color group",
                objectIds: selectedColorGroup.objectIds
              }
            : null,
    [selectedCluster, selectedColorGroup, selectedUseGroup]
  );
  const selectedObjectIds = useMemo(() => selectedEntry?.objectIds ?? [], [selectedEntry]);
  const objectLabelPlural = selectedUseGroup
    ? `${USE_GROUP_LABEL[selectedUseGroup.group]} vessels`
    : selectedColorGroup
      ? `${selectedColorGroup.label} vessels`
      : "vessels";
  const timelineSubject =
    selectedUseGroup || selectedColorGroup ? objectLabelPlural : "these forms";
  const mapSubject = selectedUseGroup || selectedColorGroup ? objectLabelPlural : "these forms";

  const showShelfShapeGlyph = Boolean(locationState?.fromShelf && selectedCluster && clusterId);

  const {
    buckets: timelineBuckets,
    excludedCount,
    spanYears
  } = useTimelineBuckets(selectedObjectIds);
  const geoByObjectId = useObjectGeo(selectedObjectIds);
  const { countryNames, distinctCountryCount, countryByObjectId } =
    useObjectCountryNames(selectedObjectIds);
  const canonicalCountryKeysInCluster = useMemo(
    () => new Set(countryByObjectId.values()),
    [countryByObjectId]
  );
  const objectModalFieldsById = useObjectModalMetadata();
  const [mapProjectionByObjectId, setMapProjectionByObjectId] = useState<
    Map<string, { x: number; y: number; visible: boolean }>
  >(new globalThis.Map());

  const allSceneLayout = useMemo(() => {
    let imageSizePx = ALL_SCENE_RENDER_IMAGE_SIZE_PX;
    if (
      currentView === "all" &&
      isLeftPanelExpanded &&
      allGridBaselineColumns != null &&
      sceneViewportSize.width > 0
    ) {
      const cellWidth = Math.floor(sceneViewportSize.width / allGridBaselineColumns);
      imageSizePx = Math.max(24, cellWidth - ALL_SCENE_GRID_GAP_X_PX);
    }
    return buildSceneLayout({
      objectIds: selectedObjectIds,
      buckets: timelineBuckets,
      view: "all",
      sceneWidth: sceneViewportSize.width,
      sceneHeight: sceneViewportSize.height,
      imageSizePx
    });
  }, [
    allGridBaselineColumns,
    currentView,
    isLeftPanelExpanded,
    sceneViewportSize.height,
    sceneViewportSize.width,
    selectedObjectIds,
    timelineBuckets
  ]);

  const timelineSceneViewportInnerHeight = Math.max(
    0,
    sceneViewportSize.height - TIMELINE_AXIS_TOP_GUTTER_PX
  );

  const timelineSceneLayout = useMemo(
    () =>
      buildSceneLayout({
        objectIds: selectedObjectIds,
        buckets: timelineBuckets,
        view: "timeline",
        sceneWidth: sceneViewportSize.width,
        sceneHeight: timelineSceneViewportInnerHeight,
        imageSizePx: SUBGROUP_RENDER_IMAGE_SIZE_PX
      }),
    [timelineSceneViewportInnerHeight, sceneViewportSize.width, selectedObjectIds, timelineBuckets]
  );
  const mapSceneLayout = useMemo(
    () =>
      buildSceneLayout({
        objectIds: selectedObjectIds,
        buckets: timelineBuckets,
        view: "map",
        sceneWidth: sceneViewportSize.width,
        sceneHeight: sceneViewportSize.height,
        imageSizePx: SUBGROUP_RENDER_IMAGE_SIZE_PX,
        mapProjectionByObjectId
      }),
    [
      mapProjectionByObjectId,
      sceneViewportSize.height,
      sceneViewportSize.width,
      selectedObjectIds,
      timelineBuckets
    ]
  );

  const sceneLayout =
    currentView === "timeline"
      ? timelineSceneLayout
      : currentView === "map"
        ? mapSceneLayout
        : allSceneLayout;
  const allSceneHeight = Math.max(sceneViewportSize.height, allSceneLayout.sceneHeight);
  const timelineSceneHeight = Math.max(
    timelineSceneViewportInnerHeight,
    timelineSceneLayout.sceneHeight
  );
  const mapSceneHeight = Math.max(sceneViewportSize.height, mapSceneLayout.sceneHeight);
  const contentSceneHeight =
    currentView === "timeline"
      ? timelineSceneHeight
      : currentView === "map"
        ? mapSceneHeight
        : allSceneHeight;
  const sharedSceneWidth = Math.max(
    allSceneLayout.sceneWidth,
    timelineSceneLayout.sceneWidth,
    mapSceneLayout.sceneWidth
  );

  const leftPanelWidthCss = useMemo(() => {
    const useExpandedWidth =
      isLeftPanelExpanded && (currentView !== "timeline" || leftPanelSceneCollapseGrace);
    if (useExpandedWidth) {
      return `clamp(${SCENE_LEFT_PANEL_MIN_WIDTH_PX}px, ${SCENE_LEFT_PANEL_WIDTH_VW}vw, ${SCENE_LEFT_PANEL_MAX_WIDTH_PX}px)`;
    }
    return `clamp(${SCENE_LEFT_PANEL_COLLAPSED_MIN_WIDTH_PX}px, ${SCENE_LEFT_PANEL_COLLAPSED_VW}vw, ${SCENE_LEFT_PANEL_MAX_WIDTH_PX}px)`;
  }, [currentView, isLeftPanelExpanded, leftPanelSceneCollapseGrace]);

  useLayoutEffect(() => {
    const viewportNode = sceneViewportRef.current;
    if (!viewportNode) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSceneViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });
    observer.observe(viewportNode);
    const initialRect = viewportNode.getBoundingClientRect();
    setSceneViewportSize({ width: initialRect.width, height: initialRect.height });
    return () => observer.disconnect();
  }, [currentView]);

  useLayoutEffect(() => {
    if (isLeftPanelExpanded || sceneViewportSize.width <= 0) return;
    setAllGridBaselineColumns(
      Math.max(
        1,
        Math.floor(
          sceneViewportSize.width / (ALL_SCENE_RENDER_IMAGE_SIZE_PX + ALL_SCENE_GRID_GAP_X_PX)
        )
      )
    );
  }, [isLeftPanelExpanded, sceneViewportSize.width]);

  useLayoutEffect(() => {
    if (!isLeftPanelExpandedRef.current) {
      setLeftPanelSceneCollapseGrace(false);
      return;
    }
    setLeftPanelSceneCollapseGrace(true);
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        setIsLeftPanelExpanded(false);
        setLeftPanelSceneCollapseGrace(false);
      });
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      setLeftPanelSceneCollapseGrace(false);
    };
  }, [currentView]);

  const getPrimaryImageSrc = useCallback(
    (objectId: string) => {
      if (mode === "outline") return outlineImageByObjectId.get(objectId);
      if (mode === "color")
        return noBgImageByObjectId.get(objectId) ?? maskImageByObjectId.get(objectId);
      return maskImageByObjectId.get(objectId);
    },
    [maskImageByObjectId, mode, noBgImageByObjectId, outlineImageByObjectId]
  );

  const getHoverImageSrc = useCallback(
    (objectId: string) => noBgImageByObjectId.get(objectId),
    [noBgImageByObjectId]
  );

  const getTileImageSrc = useCallback(
    (objectId: string, tileMode: ImageToggleMode) => {
      if (tileMode === "outline") return outlineImageByObjectId.get(objectId);
      if (tileMode === "color")
        return noBgImageByObjectId.get(objectId) ?? maskImageByObjectId.get(objectId);
      return maskImageByObjectId.get(objectId);
    },
    [maskImageByObjectId, noBgImageByObjectId, outlineImageByObjectId]
  );

  const imageAltSuffix = mode === "outline" ? "outline" : mode === "color" ? "no_bg" : "mask";
  const enableHoverSwap = mode !== "color";

  const handleAllObjectClick = useCallback((objectId: string) => {
    setModalObjectId(objectId);
  }, []);

  const openCountryPanelForObjectIds = useCallback((label: string, objectIds: string[]) => {
    if (!objectIds.length) return;
    setMapCountryPanel({ label, objectIds });
    setIsLeftPanelExpanded(true);
  }, []);

  const handleMapObjectClick = useCallback(
    (objectId: string) => {
      const canonicalCountry = countryByObjectId.get(objectId);
      if (!canonicalCountry) return;
      const ids = selectedObjectIds.filter((id) => countryByObjectId.get(id) === canonicalCountry);
      openCountryPanelForObjectIds(formatCountryLabel(canonicalCountry), ids);
    },
    [countryByObjectId, openCountryPanelForObjectIds, selectedObjectIds]
  );

  const handleMapCountryResolved = useCallback(
    (payload: { displayLabel: string; normalizedCountry: string } | null) => {
      if (!payload) return;
      const matchedCanonicals = new Set(
        canonicalKeysMatchingGeocode(payload.normalizedCountry, canonicalCountryKeysInCluster)
      );
      const ids =
        matchedCanonicals.size === 0
          ? []
          : selectedObjectIds.filter((id) => {
              const c = countryByObjectId.get(id);
              return c != null && matchedCanonicals.has(c);
            });
      openCountryPanelForObjectIds(payload.displayLabel, ids);
    },
    [
      canonicalCountryKeysInCluster,
      countryByObjectId,
      openCountryPanelForObjectIds,
      selectedObjectIds
    ]
  );

  useEffect(() => {
    setMapCountryPanel(null);
  }, [currentView, selectedEntry?.id]);

  useEffect(() => {
    if (currentView !== "all" && currentView !== "timeline" && currentView !== "map")
      setModalObjectId(null);
  }, [currentView]);

  const syncTimelineAxisToSceneScroll = useCallback(() => {
    if (currentView !== "timeline") return;
    const source = sceneContentScrollRef.current;
    const axisContent = timelineAxisContentRef.current;
    if (!source || !axisContent) return;
    axisContent.style.transform = `translateY(${-source.scrollTop}px)`;
  }, [currentView]);

  const handleSceneContentScroll = useCallback(() => {
    syncTimelineAxisToSceneScroll();
  }, [syncTimelineAxisToSceneScroll]);

  useEffect(() => {
    if (currentView !== "timeline") return;
    console.log(`Excluded (non-numeric final_date): ${excludedCount}`);
  }, [currentView, excludedCount]);

  useEffect(() => {
    if (!selectedEntry) return;
    console.log(`${selectedEntry.id}\n${selectedEntry.typeLabel}`);
  }, [selectedEntry]);
  useEffect(() => {
    if (selectedUseGroup) {
      setSelectedShelfTab("use");
      return;
    }
    if (selectedColorGroup) {
      setSelectedShelfTab("color");
      return;
    }
    if (selectedCluster) {
      setSelectedShelfTab("shape");
    }
  }, [selectedCluster, selectedColorGroup, selectedUseGroup, setSelectedShelfTab]);
  useEffect(() => {
    syncTimelineAxisToSceneScroll();
  }, [contentSceneHeight, currentView, syncTimelineAxisToSceneScroll, timelineBuckets]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    sceneContentScrollRef.current?.scrollTo({ top: 0, left: 0 });
    syncTimelineAxisToSceneScroll();
  }, [clusterId, currentView, selectedEntry?.id, syncTimelineAxisToSceneScroll]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  if (!selectedEntry) {
    return (
      <Box
        component="main"
        sx={{
          ...sceneShellBaseSx,
          display: "flex",
          flexDirection: "column"
        }}
      >
        <BackButton />
        <Typography>Cluster not found.</Typography>
      </Box>
    );
  }

  return (
    <Box
      component="main"
      sx={{
        ...sceneShellBaseSx,
        display: "flex",
        flexDirection: "column",
        minHeight: 0
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 12,
          bgcolor: "#000",
          pt: "0.75rem",
          width: "100%"
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            rowGap: "0.5rem",
            mb: "0.85rem",
            width: "100%"
          }}
        >
          <Box sx={{ flexShrink: 0 }}>
            <BackButton />
          </Box>
          <Box
            sx={{
              flexShrink: 0,
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 0
            }}
          >
            <Button
              type="button"
              onClick={() => setSearchParams({ view: "all" }, { state: location.state })}
              variant="outlined"
              sx={{
                borderColor: "#fff",
                background: currentView === "all" ? "#fff" : "#000",
                color: currentView === "all" ? "#000" : "#fff",
                textTransform: "none",
                minWidth: 0,
                borderRadius: 0,
                "&:hover": {
                  borderColor: "#fff",
                  background: currentView === "all" ? "#fff" : "#000"
                }
              }}
            >
              All
            </Button>
            <Button
              type="button"
              onClick={() => setSearchParams({ view: "timeline" }, { state: location.state })}
              variant="outlined"
              sx={{
                borderColor: "#fff",
                background: currentView === "timeline" ? "#fff" : "#000",
                color: currentView === "timeline" ? "#000" : "#fff",
                textTransform: "none",
                minWidth: 0,
                borderRadius: 0,
                marginLeft: "-1px",
                "&:hover": {
                  borderColor: "#fff",
                  background: currentView === "timeline" ? "#fff" : "#000"
                }
              }}
            >
              Timeline
            </Button>
            <Button
              type="button"
              onClick={() => setSearchParams({ view: "map" }, { state: location.state })}
              variant="outlined"
              sx={{
                borderColor: "#fff",
                background: currentView === "map" ? "#fff" : "#000",
                color: currentView === "map" ? "#000" : "#fff",
                textTransform: "none",
                minWidth: 0,
                borderRadius: 0,
                marginLeft: "-1px",
                "&:hover": {
                  borderColor: "#fff",
                  background: currentView === "map" ? "#fff" : "#000"
                }
              }}
            >
              Map
            </Button>
          </Box>
        </Box>

        <Typography
          component="div"
          sx={{
            ...sceneHeadlineSx,
            width: "100%",
            mt: "1.5rem",
            mb: "2rem"
          }}
        >
          {showShelfShapeGlyph && clusterId ? (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                width: "100%"
              }}
            >
              <Box
                sx={{
                  width: "4.5rem",
                  height: "4.5rem",
                  flexShrink: 0
                }}
              >
                <ShelfStackedOutlineSvg
                  src={`/cluster_SVG_stacked_outlines/${clusterId}_stack_sampled.svg`}
                  alt={`${clusterId} stacked outlines`}
                  initialComplete
                />
              </Box>
              <Box component="span">
                {currentView === "all" ? (
                  <>
                    {sceneHeadlineEmphasis(selectedObjectIds.length.toLocaleString("en-US"))}{" "}
                    vessels in this group
                  </>
                ) : (
                  sceneHeadlineContent({
                    view: currentView,
                    objectCount: selectedObjectIds.length,
                    objectLabelPlural,
                    timelineSubject,
                    mapSubject,
                    spanYears,
                    countryCount: distinctCountryCount
                  })
                )}
              </Box>
            </Box>
          ) : (
            sceneHeadlineContent({
              view: currentView,
              objectCount: selectedObjectIds.length,
              objectLabelPlural,
              timelineSubject,
              mapSubject,
              spanYears,
              countryCount: distinctCountryCount
            })
          )}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          display: "flex",
          gap: "0.7rem",
          pt: currentView === "timeline" ? `${TIMELINE_AXIS_TOP_GUTTER_PX}px` : 0,
          boxSizing: "border-box"
        }}
      >
        <Box
          sx={{
            width: leftPanelWidthCss,
            minWidth: 0,
            position: "relative",
            overflow: "visible",
            /** Keep left rail below sticky header layer. */
            zIndex: 1,
            transition: `width ${SCENE_LEFT_PANEL_WIDTH_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
          }}
        >
          {currentView === "timeline" ? (
            <Box
              ref={timelineAxisContentRef}
              sx={{
                position: "absolute",
                inset: 0,
                overflow: "visible",
                willChange: "transform"
              }}
            >
              <TimelineAxis
                buckets={timelineBuckets}
                bucketSpanByKey={timelineSceneLayout.bucketSpanByKey}
                panelHeight={contentSceneHeight}
              />
            </Box>
          ) : (
            <>
              {isLeftPanelExpanded && currentView === "map" ? (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    pt: "0.35rem",
                    pr: "0.65rem",
                    pl: "0.25rem",
                    pointerEvents: "auto"
                  }}
                >
                  <Typography
                    component="h3"
                    variant="h3"
                    sx={{
                      mb: "0.65rem",
                      color: mapCountryPanel ? "#fff" : "#777",
                      flexShrink: 0
                    }}
                  >
                    {mapCountryPanel?.label ?? "Select a country"}
                  </Typography>
                  {mapCountryPanel && mapCountryPanel.objectIds.length === 0 ? (
                    <Typography sx={{ fontSize: "0.78rem", color: "#888", lineHeight: 1.35 }}>
                      No objects in this cluster share that country in the same geo fields used for
                      map labels.
                    </Typography>
                  ) : (
                    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
                          gap: "6px",
                          pb: "0.75rem"
                        }}
                      >
                        {mapCountryPanel?.objectIds.map((objectId) => {
                          const src = getPrimaryImageSrc(objectId);
                          if (!src) return null;
                          return (
                            <Box
                              key={objectId}
                              role="button"
                              tabIndex={0}
                              onClick={() => setModalObjectId(objectId)}
                              onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setModalObjectId(objectId);
                                }
                              }}
                              sx={{
                                width: "100%",
                                aspectRatio: "1",
                                cursor: "pointer"
                              }}
                            >
                              {mode === "outline" ? (
                                <InlineOutlineSvg
                                  src={src}
                                  alt=""
                                  className="inline-outline-svg"
                                  style={{ width: "100%", height: "100%", display: "block" }}
                                />
                              ) : (
                                <Box
                                  component="img"
                                  src={src}
                                  alt=""
                                  sx={{
                                    display: "block",
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain"
                                  }}
                                />
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : isLeftPanelExpanded ? (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pr: "0.65rem",
                    pointerEvents: "none"
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      width: "100%",
                      height: "100%"
                    }}
                  >
                    {selectedObjectIds.map((objectId) => {
                      const outlineSrc = outlineImageByObjectId.get(objectId);
                      if (!outlineSrc) return null;
                      return (
                        <InlineOutlineSvg
                          key={`stack-outline-${objectId}`}
                          src={outlineSrc}
                          alt={`${objectId} outline`}
                          className="inline-outline-svg"
                          style={{
                            position: "absolute",
                            left: "50%",
                            bottom: "-3px",
                            transform: "translateX(-50%)",
                            width: "100%",
                            height: "100%",
                            display: "block",
                            opacity: defaultStackOpacity(selectedObjectIds.length)
                          }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              ) : null}
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: 0,
                  borderRight: "1px solid #444"
                }}
              />
            </>
          )}
          {currentView !== "timeline" &&
            (isLeftPanelExpanded ? (
              <IconButton
                aria-label="Collapse left panel"
                onClick={() => setIsLeftPanelExpanded(false)}
                sx={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translate(50%, -50%)",
                  zIndex: 2,
                  width: 24,
                  height: 24,
                  p: 0,
                  color: "#aaa",
                  borderRadius: "999px",
                  bgcolor: "#000",
                  border: "1px solid #444",
                  "&:hover": { color: "#fff", bgcolor: "#111" }
                }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            ) : (
              <Button
                type="button"
                variant="text"
                disableRipple
                aria-label="Expand left panel"
                onClick={() => setIsLeftPanelExpanded(true)}
                sx={{
                  textTransform: "none",
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%) rotate(90deg)",
                  transformOrigin: "center center",
                  zIndex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  p: 0,
                  m: 0,
                  color: "#aaa",
                  whiteSpace: "nowrap",
                  borderRadius: 0,
                  "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.06)" }
                }}
              >
                <Typography component="span" variant="backButton" sx={{ color: "inherit" }}>
                  expand
                </Typography>
              </Button>
            ))}
        </Box>
        <Box
          ref={sceneViewportRef}
          sx={{ position: "relative", flex: 1, minHeight: 0, minWidth: 0, width: "100%" }}
        >
          {currentView === "map" ? (
            <MapView
              objectIds={selectedObjectIds}
              geoByObjectId={geoByObjectId}
              countryNames={countryNames}
              onProjectionChange={setMapProjectionByObjectId}
              onCountryResolved={handleMapCountryResolved}
            />
          ) : null}
          <Box
            ref={sceneContentScrollRef}
            onScroll={handleSceneContentScroll}
            sx={{
              position: "absolute",
              inset: 0,
              overflowX: currentView === "timeline" ? "auto" : "hidden",
              overflowY: "auto",
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              pointerEvents: currentView === "map" ? "none" : "auto",
              boxSizing: "border-box",
              pb: currentView === "timeline" ? "4rem" : 0
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: `${Math.max(sharedSceneWidth, 1)}px`,
                minWidth: "100%"
              }}
            >
              <ObjectScene
                objectIds={selectedObjectIds}
                objectLayoutById={sceneLayout.objectLayoutById}
                sceneWidth={sharedSceneWidth}
                sceneHeight={contentSceneHeight}
                getPrimaryImageSrc={getPrimaryImageSrc}
                getHoverImageSrc={getHoverImageSrc}
                imageAltSuffix={imageAltSuffix}
                enableHoverSwap={enableHoverSwap}
                pointerEvents="auto"
                onObjectClick={currentView === "map" ? handleMapObjectClick : handleAllObjectClick}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          zIndex: 5,
          mt: "0.6rem",
          pt: "0.45rem",
          pb: "0.35rem",
          bgcolor: "#000"
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
          <ImageToggleButton mode={mode} options={options} onChange={setMode} />
        </Box>
      </Box>

      {modalObjectId ? (
        <ObjectImageModal
          open={currentView === "all" || currentView === "timeline" || currentView === "map"}
          objectId={modalObjectId}
          onClose={() => setModalObjectId(null)}
          title={objectModalFieldsById.get(modalObjectId)?.title ?? ""}
          finalDate={objectModalFieldsById.get(modalObjectId)?.finalDate ?? ""}
          colorgramPaletteHex={objectModalFieldsById.get(modalObjectId)?.colorgramPaletteHex ?? []}
          metadataByObjectId={objectModalFieldsById}
          getTileImageSrc={getTileImageSrc}
        />
      ) : null}
    </Box>
  );
}

export default Container;
