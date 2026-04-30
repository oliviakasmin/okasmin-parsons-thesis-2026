import { useState } from "react";
import Typography from "@mui/material/Typography";
import ObjectImageModal from "./Scenes/ObjectImageModal";
import { allObjectIds } from "./title_intro_constants";
import useObjectModalMetadata from "../hooks/useObjectModalMetadata";

const S3_IMAGE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

export default function CaseStudies() {
  const [modalObjectId, setModalObjectId] = useState<string | null>(null);
  const objectModalFieldsById = useObjectModalMetadata();

  const getColorImageSrc = (objectId: string) => `${S3_IMAGE_BASE_URL}/${objectId}_no_bg.png`;
  const getOutlineImageSrc = (objectId: string) => `/SVG_outlines/${objectId}_outline.svg`;

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
          boxSizing: "border-box"
        }}
      >
        <div
          style={{
            width: "min(1200px, 100%)",
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
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "2rem"
            }}
          >
            {allObjectIds.map((objectId) => (
              <button
                key={`case-study-${objectId}`}
                type="button"
                onClick={() => setModalObjectId(String(objectId))}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "320px",
                  padding: "1rem",
                  boxSizing: "border-box",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer"
                }}
              >
                <img
                  src={`${S3_IMAGE_BASE_URL}/${objectId}_no_bg.png`}
                  alt={`Case study object ${objectId}`}
                  style={{
                    width: "100%",
                    maxWidth: "520px",
                    height: "auto",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    display: "block"
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      {modalObjectId ? (
        <ObjectImageModal
          open
          objectId={modalObjectId}
          onClose={() => setModalObjectId(null)}
          title={objectModalFieldsById.get(modalObjectId)?.title ?? ""}
          finalDate={objectModalFieldsById.get(modalObjectId)?.finalDate ?? ""}
          mapboxPlaceName={objectModalFieldsById.get(modalObjectId)?.mapboxPlaceName ?? ""}
          dominantColorsHex={objectModalFieldsById.get(modalObjectId)?.dominantColorsHex ?? []}
          getColorImageSrc={getColorImageSrc}
          getOutlineImageSrc={getOutlineImageSrc}
        />
      ) : null}
    </>
  );
}
