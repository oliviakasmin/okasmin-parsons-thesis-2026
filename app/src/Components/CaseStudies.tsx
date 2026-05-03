import Typography from "@mui/material/Typography";
import { objects, options } from "./title_intro_constants";

const S3_IMAGE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

const objectIds = [...objects, ...options];

export default function CaseStudies() {
  return (
    <>
      <section
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1.5rem",
          overflowX: "auto",
          // overflowY: "hidden",
          boxSizing: "border-box"
        }}
      >
        <div
          style={{
            width: "max-content",
            minWidth: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          <Typography variant="h3">case studies</Typography>
          <Typography variant="h5">
            [placeholder for case studies - same images as from title and intro scenes]
          </Typography>

          <div
            style={{
              display: "flex",
              flexWrap: "nowrap",
              gap: 0
            }}
          >
            {objectIds.map((objectId) => (
              <div
                key={`case-study-${objectId}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "320px",
                  padding: "1rem 0",
                  boxSizing: "border-box",
                  gap: "0.75rem",
                  flexShrink: 0
                }}
              >
                <div style={{ borderBottom: "5px solid #fff" }}>
                  <img
                    src={`${S3_IMAGE_BASE_URL}/${objectId}_no_bg.png`}
                    alt={`Case study object ${objectId}`}
                    style={{
                      width: "auto",
                      height: "70vh",
                      objectFit: "contain",
                      display: "block",
                      position: "relative",
                      top: "3px"
                    }}
                  />
                </div>
                <Typography variant="caption" sx={{ fontSize: "1.2rem", lineHeight: 1 }}>
                  statistician note
                </Typography>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
