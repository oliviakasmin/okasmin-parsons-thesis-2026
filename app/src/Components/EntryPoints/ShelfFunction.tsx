import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import useImageModules from "../../hooks/useImageModules";
import useFunctionGroups, { type FunctionGroup } from "../../hooks/useFunctionGroups";
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

const shelfUseEntryScrollId: HomeEntryScrollId = "shelf-use";

/** Row-major positions; `undefined` = one-tile gap; rows with fewer than five slots spread across the row. */
const SHELF_USE_LAYOUT: ShelfSlot<FunctionGroup>[][] = [
  ["amphora", "pitcher", "jug", "flask"],
  ["beaker", "jar", "pot"],
  ["vase", "vessel", "bottle"]
];

export default function ShelfFunction() {
  const navigate = useNavigate();
  const { maskImageByObjectId } = useImageModules();
  const { groupRowById } = useFunctionGroups();

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
                  sx={shelfArticleSx("shelf-use-label")}
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
                            animation: "shelfFunctionDrawUp 900ms ease-out forwards",
                            "@keyframes shelfFunctionDrawUp": {
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
                  <Typography className="shelf-use-label" component="span" sx={shelfOverlayLabelSx}>
                    {groupRow.group}
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
