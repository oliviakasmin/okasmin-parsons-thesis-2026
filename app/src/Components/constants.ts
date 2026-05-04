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
/** Left rail `width` transition (scene change collapse + manual expand/collapse). */
export const SCENE_LEFT_PANEL_WIDTH_TRANSITION_MS = 600;

export const SHELF_RENDER_IMAGE_SIZE_PX = SOURCE_IMAGE_SIZE_PX * SHELF_IMAGE_ASPECT_RATIO;
export const SUBGROUP_RENDER_IMAGE_SIZE_PX = SOURCE_IMAGE_SIZE_PX * SUBGROUP_IMAGE_ASPECT_RATIO;
export const ALL_SCENE_RENDER_IMAGE_SIZE_PX = SOURCE_IMAGE_SIZE_PX * ALL_SCENE_GRID_ASPECT_RATIO;

/** Passed in router `state.homeScrollTo` when returning to `/` so Home can scroll to the matching section. */
export type HomeEntryScrollId = "shelf" | "shelf-use" | "shelf-color" | "case-studies";

export function homeEntryDomId(entry: HomeEntryScrollId): string {
  return `home-entry-${entry}`;
}
