import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import useImageModules from "../hooks/useImageModules";
import InlineOutlineSvg from "./Scenes/InlineOutlineSvg";

const objects = [246560, 902207]; //earliest and latest from data

const options = [42212, 46987, 448986, 317749, 475750]; //other good shapes

const allObjectIds = [...objects, ...options];

export default function Title() {
  const { outlineImageByObjectId } = useImageModules();
  const featuredObjectId = allObjectIds[0];
  const featuredOutlineSrc = outlineImageByObjectId.get(String(featuredObjectId));

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "flex-start",
        gap: "2rem"
      }}
    >
      <Box
        sx={{
          width: "25vw",
          display: "flex",
          alignItems: "center",
          position: "sticky",
          top: "25vh"
        }}
      >
        <Typography variant="h1" component="h1" sx={{ m: 0 }}>
          Ceramics <span style={{ fontStyle: "italic", fontWeight: 100 }}>Undressed</span>
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: "100vh",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center"
        }}
      >
        <Box sx={{ height: "90vh" }}>
          {featuredOutlineSrc ? (
            <InlineOutlineSvg
              src={featuredOutlineSrc}
              alt={`${featuredObjectId}_outline.svg`}
              className="inline-outline-svg"
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          ) : (
            <Box sx={{ width: "100%", height: "100%" }} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
