import { useNavigate } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import finalClusterKeysCsv from "../../../../format_data/cluster_shape/final_clusters_keys.csv?raw";
import fieldsCsv from "../../../../format_data/generated/fields.csv?raw";
import ImageToggleButton from "../ImageToggleButton";
import useFormatClusters from "../../hooks/useFormatClusters";
import useImageModules from "../../hooks/useImageModules";
import useImageToggle from "../../hooks/useImageToggle";
import InlineOutlineSvg from "../Scenes/InlineOutlineSvg";

function defaultStackOpacity(clusterSize: number) {
  return Math.min(1, Math.max(0.1, 1 / Math.max(18, clusterSize)));
}

const navButtonSx = {
  borderColor: "#fff",
  background: "#000",
  color: "#fff",
  textTransform: "none" as const,
  minWidth: 0,
  borderRadius: 0,
  fontWeight: 700,
  px: "0.55rem",
  py: "0.3rem",
  "&:hover": {
    borderColor: "#fff",
    background: "#111"
  }
};

function ClusterTest() {
  const navigate = useNavigate();
  const { mode, options, setMode } = useImageToggle();
  const { outlineImageByObjectId, maskImageByObjectId, noBgImageByObjectId } = useImageModules();
  const { clusterRows } = useFormatClusters(finalClusterKeysCsv, fieldsCsv);

  return (
    <Box
      component="main"
      sx={{
        p: "1rem",
        backgroundColor: "#000",
        color: "#fff",
        minHeight: "100vh"
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          mb: "0.75rem"
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button type="button" onClick={() => navigate("/")} variant="outlined" sx={navButtonSx}>
            Back
          </Button>
          <Button
            type="button"
            onClick={() => navigate("/shelf")}
            variant="outlined"
            sx={navButtonSx}
          >
            Shelf
          </Button>
          <Typography component="h1" sx={{ m: 0, fontSize: "1.25rem" }}>
            Cluster Outlines
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0 }}>
          <ImageToggleButton mode={mode} options={options} onChange={setMode} />
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {clusterRows.map((clusterRow) => {
          const opacity = defaultStackOpacity(clusterRow.allObjectIds.length);
          return (
            <Box
              component="section"
              key={clusterRow.cluster}
              sx={{
                border: "1px solid #333",
                p: "0.75rem"
              }}
            >
              <Box
                sx={{
                  mb: "0.55rem",
                  display: "flex",
                  gap: "0.6rem",
                  flexWrap: "wrap",
                  alignItems: "baseline"
                }}
              >
                <Typography component="strong" sx={{ fontWeight: 700 }}>
                  {clusterRow.cluster}
                </Typography>
                <Typography sx={{ color: "#bbb", fontSize: "0.9rem" }}>
                  {clusterRow.clusterType} - {clusterRow.allObjectIds.length} objects
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, minmax(140px, 1fr))",
                  gap: "10px"
                }}
              >
                <Box component="figure" sx={{ m: 0 }}>
                  <Box
                    sx={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      position: "relative",
                      background: "#000",
                      overflow: "hidden"
                    }}
                  >
                    {clusterRow.allObjectIds.map((objectId) => {
                      const outlineSrc = outlineImageByObjectId.get(objectId);
                      const maskSrc = maskImageByObjectId.get(objectId);
                      const colorSrc = noBgImageByObjectId.get(objectId);
                      if (mode === "outline") {
                        if (!outlineSrc) return null;
                        return (
                          <InlineOutlineSvg
                            key={`${clusterRow.cluster}-stack-${objectId}`}
                            src={outlineSrc}
                            alt={`${objectId}_outline.svg`}
                            className="inline-outline-svg"
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              display: "block",
                              opacity
                            }}
                          />
                        );
                      }
                      const src = mode === "color" ? colorSrc : maskSrc;
                      if (!src) return null;
                      return (
                        <img
                          key={`${clusterRow.cluster}-stack-${objectId}`}
                          src={src}
                          alt={`${objectId}_${mode === "color" ? "no_bg" : "mask"}.png`}
                          loading="lazy"
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            opacity
                          }}
                        />
                      );
                    })}
                  </Box>
                  <Typography
                    component="figcaption"
                    sx={{ mt: "6px", fontSize: "11px", color: "#ddd" }}
                  >
                    Stacked all
                  </Typography>
                </Box>

                {clusterRow.closestTop5Ids.map((objectId, index) => {
                  const outlineSrc = outlineImageByObjectId.get(objectId);
                  const maskSrc = maskImageByObjectId.get(objectId);
                  const colorSrc = noBgImageByObjectId.get(objectId);
                  return (
                    <Box
                      component="figure"
                      key={`${clusterRow.cluster}-closest-${objectId}-${index}`}
                      sx={{ m: 0 }}
                    >
                      <Box
                        sx={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          background: "#000",
                          overflow: "hidden",
                          display: "grid",
                          placeItems: "center"
                        }}
                      >
                        {mode === "outline" && outlineSrc ? (
                          <InlineOutlineSvg
                            src={outlineSrc}
                            alt={`${objectId}_outline.svg`}
                            className="inline-outline-svg"
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "block",
                              objectFit: "contain"
                            }}
                          />
                        ) : null}
                        {mode === "solid" && maskSrc ? (
                          <img
                            src={maskSrc}
                            alt={`${objectId}_mask.png`}
                            loading="lazy"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              display: "block"
                            }}
                          />
                        ) : null}
                        {mode === "color" && colorSrc ? (
                          <img
                            src={colorSrc}
                            alt={`${objectId}_no_bg.png`}
                            loading="lazy"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              display: "block"
                            }}
                          />
                        ) : null}
                        {mode === "outline" && !outlineSrc ? (
                          <Typography
                            sx={{ fontSize: "10px", color: "#777", textAlign: "center", p: "6px" }}
                          >
                            Missing outline
                          </Typography>
                        ) : null}
                        {mode === "solid" && !maskSrc ? (
                          <Typography
                            sx={{ fontSize: "10px", color: "#777", textAlign: "center", p: "6px" }}
                          >
                            Missing mask
                          </Typography>
                        ) : null}
                        {mode === "color" && !colorSrc ? (
                          <Typography
                            sx={{ fontSize: "10px", color: "#777", textAlign: "center", p: "6px" }}
                          >
                            Missing image
                          </Typography>
                        ) : null}
                      </Box>
                      <Typography
                        component="figcaption"
                        sx={{ mt: "6px", fontSize: "11px", color: "#ddd" }}
                      >
                        Closest {index + 1}: {objectId}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default ClusterTest;
