import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import representativeJson from "../../../../format_data/use_groups/representative.json";
import useImageModules from "../../hooks/useImageModules";
import useUseGroups, {
  type UseGroup,
  USE_GROUP_LABEL,
  representativeObjectIdsForGroup
} from "../../hooks/useUseGroups";
import { ROUTE_SHELF_USE_ROOT_ID } from "../constants";
import { useClusterScene } from "../ClusterSceneContext";
import type { ShelfSlot } from "./shelfGridStyles";
import {
  shelfArticleTileSx,
  shelfEmptySlotSx,
  shelfGridRowSx,
  shelfGridStackSx,
  shelfOverlayLabelSx,
  shelfSlotInnerMediaSx,
  shelfSlotSurfaceSx,
  shelfTabMainSx
} from "./shelfGridStyles";

/** Row-major positions; `undefined` = one-tile gap; rows with fewer than five slots spread across the row. */
const SHELF_USE_LAYOUT: ShelfSlot<UseGroup>[][] = [
  [undefined, "flask_and_bottle", "vase"],
  ["pouring", "storage"],
  ["ritual", "animal_shaped", "other"]
];

export default function ShelfUse() {
  const { openCluster } = useClusterScene();
  const { maskImageByObjectId } = useImageModules();
  const { groupRowById } = useUseGroups();

  return (
    <Box component="main" id={ROUTE_SHELF_USE_ROOT_ID} sx={shelfTabMainSx}>
      <Box component="section" sx={shelfGridStackSx}>
        {SHELF_USE_LAYOUT.map((row, rowIndex) => (
          <Box key={`use-row-${rowIndex}`} sx={shelfGridRowSx(row.length)}>
            {row.map((groupId, slotIndex) => {
              if (groupId === undefined) {
                return (
                  <Box key={`use-gap-${rowIndex}-${slotIndex}`} aria-hidden sx={shelfEmptySlotSx}>
                    <Box sx={shelfSlotSurfaceSx()} />
                  </Box>
                );
              }

              const groupRow = groupRowById.get(groupId);
              if (!groupRow) {
                return (
                  <Box
                    key={`use-missing-${rowIndex}-${slotIndex}`}
                    aria-hidden
                    sx={shelfEmptySlotSx}
                  >
                    <Box sx={shelfSlotSurfaceSx()} />
                  </Box>
                );
              }

              const repCandidates = representativeObjectIdsForGroup(
                representativeJson,
                groupRow.group
              );
              const representativeObjectId =
                repCandidates.find((objectId) => maskImageByObjectId.has(objectId)) ??
                groupRow.objectIds.find((objectId) => maskImageByObjectId.has(objectId)) ??
                null;
              const imageSrc = representativeObjectId
                ? maskImageByObjectId.get(representativeObjectId)
                : undefined;

              return (
                <Box
                  component="article"
                  key={groupRow.group}
                  onClick={() =>
                    openCluster({
                      clusterId: groupRow.group,
                      initialImageMode: "solid",
                      returnShelfTab: "use"
                    })
                  }
                  sx={shelfArticleTileSx}
                >
                  <Box sx={shelfSlotSurfaceSx()}>
                    <Box sx={shelfSlotInnerMediaSx()}>
                      {imageSrc ? (
                        <Box
                          component="img"
                          src={imageSrc}
                          alt={`${groupRow.group}_${representativeObjectId ?? "missing"}.png`}
                          loading="lazy"
                          sx={{
                            width: "100%",
                            height: "100%",
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            objectPosition: "center bottom",
                            display: "block",
                            clipPath: "inset(100% 0 0 0)",
                            animation: "shelfUseDrawUp 900ms ease-out forwards",
                            "@keyframes shelfUseDrawUp": {
                              from: {
                                clipPath: "inset(100% 0 0 0)"
                              },
                              to: {
                                clipPath: "inset(0 0 0 0)"
                              }
                            },
                            "@media (prefers-reduced-motion: reduce)": {
                              animation: "none",
                              clipPath: "inset(0 0 0 0)"
                            }
                          }}
                        />
                      ) : (
                        <Box sx={{ width: "100%", height: "100%", display: "block" }} />
                      )}
                    </Box>
                  </Box>
                  <Typography
                    variant="labels"
                    component="span"
                    sx={{
                      ...shelfOverlayLabelSx,
                      opacity: 1,
                      visibility: "visible"
                    }}
                  >
                    {USE_GROUP_LABEL[groupRow.group]}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
