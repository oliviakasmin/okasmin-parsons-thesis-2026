export const SOURCE_IMAGE_SIZE_PX = 768;
export const SHELF_IMAGE_ASPECT_RATIO = 0.18;
export const SUBGROUP_IMAGE_ASPECT_RATIO = 0.06;
/** Cluster scene “All” grid only; larger than timeline/map (`SUBGROUP_IMAGE_ASPECT_RATIO`). */
export const ALL_SCENE_GRID_ASPECT_RATIO = 0.15;
export const ALL_IMAGE_ASPECT_RATIO = 0.2;
export const SCENE_HEADER_HEIGHT_PX = 112;
export const SCENE_LEFT_PANEL_WIDTH_VW = 22;
export const SCENE_LEFT_PANEL_MIN_WIDTH_PX = 170;
export const SCENE_LEFT_PANEL_MAX_WIDTH_PX = 340;
/** Narrow left rail when scene left panel is collapsed (below main min so 5vw is visible). */
export const SCENE_LEFT_PANEL_COLLAPSED_VW = 8;
export const SCENE_LEFT_PANEL_COLLAPSED_MIN_WIDTH_PX = 56;
export const SCENE_LEFT_BASELINE_COLOR = "#444";
/**
 * Space reserved above timeline bands (layout height uses viewport − this) and padding on the axis.
 * Must clear ~half the first tick row (`translateY(-50%)` + font size) so it is not covered by the
 * sticky scene header or clipped by the shell.
 */
export const TIMELINE_AXIS_TOP_GUTTER_PX = 36;
/** Left rail `width` transition (scene change collapse + manual expand/collapse). */
export const SCENE_LEFT_PANEL_WIDTH_TRANSITION_MS = 600;

export const SHELF_RENDER_IMAGE_SIZE_PX = SOURCE_IMAGE_SIZE_PX * SHELF_IMAGE_ASPECT_RATIO;
export const SUBGROUP_RENDER_IMAGE_SIZE_PX = SOURCE_IMAGE_SIZE_PX * SUBGROUP_IMAGE_ASPECT_RATIO;
export const ALL_SCENE_RENDER_IMAGE_SIZE_PX = SOURCE_IMAGE_SIZE_PX * ALL_SCENE_GRID_ASPECT_RATIO;
/** Space between adjacent images in the All scene grid (horizontal stride − image width). */
export const ALL_SCENE_GRID_GAP_X_PX = 12;
/** Vertical space between rows in the All scene grid. */
export const ALL_SCENE_GRID_GAP_Y_PX = 12;

/** Main home: `ShelfContainer` outer section — scroll target when closing the cluster overlay. */
export const MAIN_SHELF_CONTAINER_ANCHOR_ID = "main-shelf-container-anchor";

/** Standalone `/shelf` route root (shape grid). Must not duplicate `MAIN_SHELF_CONTAINER_ANCHOR_ID`. */
export const ROUTE_SHELF_SHAPE_ROOT_ID = "route-shelf-shape-root";

/** Standalone `/shelf-use` route root. */
export const ROUTE_SHELF_USE_ROOT_ID = "route-shelf-use-root";

/** Standalone `/shelf-color` route root. */
export const ROUTE_SHELF_COLOR_ROOT_ID = "route-shelf-color-root";
