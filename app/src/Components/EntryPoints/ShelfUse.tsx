import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import useImageModules from "../../hooks/useImageModules";
import useUseGroups, { type UseGroup, USE_GROUP_LABEL } from "../../hooks/useUseGroups";
import { homeEntryDomId, type HomeEntryScrollId } from "../constants";
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

const shelfUseEntryScrollId: HomeEntryScrollId = "shelf-use";

/** Row-major positions; `undefined` = one-tile gap; rows with fewer than five slots spread across the row. */
const SHELF_USE_LAYOUT: ShelfSlot<UseGroup>[][] = [
  ["pouring", "flask_and_bottle", undefined],
  ["storage", "vase", "ritual"],
  ["animal_shaped", "other", undefined]
];

export default function ShelfUse() {
  const navigate = useNavigate();
  const { maskImageByObjectId } = useImageModules();
  const { groupRowById } = useUseGroups();

  return (
    <Box component="main" id={homeEntryDomId(shelfUseEntryScrollId)} sx={shelfTabMainSx}>
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

              const representativeObjectId =
                (groupRow.representativeObjectId &&
                maskImageByObjectId.has(groupRow.representativeObjectId)
                  ? groupRow.representativeObjectId
                  : null) ??
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
                    navigate(`/all/${groupRow.group}`, {
                      state: {
                        homeScrollTo: shelfUseEntryScrollId,
                        initialImageMode: "solid"
                      }
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
