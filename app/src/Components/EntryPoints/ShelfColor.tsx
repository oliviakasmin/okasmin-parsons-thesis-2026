import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import useImageModules from "../../hooks/useImageModules";
import useColorGroups, { type ColorGroupKey } from "../../hooks/useColorGroups";
import { homeEntryDomId, type HomeEntryScrollId } from "../constants";
import type { ShelfSlot } from "./shelfGridStyles";
import {
  shelfArticleSx,
  shelfEmptySlotSx,
  shelfGridRowSx,
  shelfGridStackSx,
  shelfOverlayLabelSx,
  shelfSlotInnerMediaSx,
  shelfSlotSurfaceSx,
  shelfTabMainSx
} from "./shelfGridStyles";

const shelfColorEntryScrollId: HomeEntryScrollId = "shelf-color";

/** Row-major positions; `undefined` = one-tile gap; rows with fewer than five slots spread across the row. */
const SHELF_COLOR_LAYOUT: ShelfSlot<ColorGroupKey>[][] = [
  ["red", "orange", "brown_tan"],
  ["yellow", "green", "blue", "purple"],
  ["gray", "white", "multicolor"]
];

export default function ShelfColor() {
  const navigate = useNavigate();
  const { maskImageByObjectId, noBgImageByObjectId } = useImageModules();
  const { groupRowByKey } = useColorGroups();

  return (
    <Box component="main" id={homeEntryDomId(shelfColorEntryScrollId)} sx={shelfTabMainSx}>
      <Box component="section" sx={shelfGridStackSx}>
        {SHELF_COLOR_LAYOUT.map((row, rowIndex) => (
          <Box key={`color-row-${rowIndex}`} sx={shelfGridRowSx(row.length)}>
            {row.map((groupKey, slotIndex) => {
              if (groupKey === undefined) {
                return (
                  <Box key={`color-gap-${rowIndex}-${slotIndex}`} aria-hidden sx={shelfEmptySlotSx}>
                    <Box sx={shelfSlotSurfaceSx()} />
                  </Box>
                );
              }

              const groupRow = groupRowByKey.get(groupKey);
              if (!groupRow) {
                return (
                  <Box
                    key={`color-missing-${rowIndex}-${slotIndex}`}
                    aria-hidden
                    sx={shelfEmptySlotSx}
                  >
                    <Box sx={shelfSlotSurfaceSx()} />
                  </Box>
                );
              }

              const representativeObjectId =
                (groupRow.representativeObjectId &&
                (noBgImageByObjectId.has(groupRow.representativeObjectId) ||
                  maskImageByObjectId.has(groupRow.representativeObjectId))
                  ? groupRow.representativeObjectId
                  : null) ??
                groupRow.objectIds.find(
                  (objectId) =>
                    noBgImageByObjectId.has(objectId) || maskImageByObjectId.has(objectId)
                ) ??
                null;
              const imageSrc = representativeObjectId
                ? (noBgImageByObjectId.get(representativeObjectId) ??
                  maskImageByObjectId.get(representativeObjectId))
                : undefined;

              return (
                <Box
                  component="article"
                  key={groupRow.groupKey}
                  onClick={() =>
                    navigate(`/all/${groupRow.groupKey}`, {
                      state: { homeScrollTo: shelfColorEntryScrollId, initialImageMode: "color" }
                    })
                  }
                  sx={shelfArticleSx("shelf-color-label")}
                >
                  <Box sx={shelfSlotSurfaceSx()}>
                    <Box sx={shelfSlotInnerMediaSx()}>
                      {imageSrc ? (
                        <Box
                          component="img"
                          src={imageSrc}
                          alt={`${groupRow.groupKey}_${representativeObjectId ?? "missing"}.png`}
                          loading="lazy"
                          sx={{
                            width: "100%",
                            height: "100%",
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            objectPosition: "center bottom",
                            display: "block",
                            opacity: 0,
                            animation: "shelfColorFadeIn 1800ms ease-in-out forwards",
                            "@keyframes shelfColorFadeIn": {
                              from: {
                                opacity: 0
                              },
                              to: {
                                opacity: 1
                              }
                            },
                            "@media (prefers-reduced-motion: reduce)": {
                              animation: "none",
                              opacity: 1
                            }
                          }}
                        />
                      ) : (
                        <Box sx={{ width: "100%", height: "100%", display: "block" }} />
                      )}
                    </Box>
                  </Box>
                  <Typography
                    className="shelf-color-label"
                    component="span"
                    sx={shelfOverlayLabelSx}
                  >
                    {groupRow.label}
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
