import { createTheme } from "@mui/material/styles";
import type { CSSProperties } from "react";

declare module "@mui/material/styles" {
  interface TypographyVariants {
    backButton: CSSProperties;
  }

  interface TypographyVariantsOptions {
    backButton?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    backButton: true;
  }
}

const ivyPrestoHeadline = '"ivypresto-headline", serif';
const neueHaasDisplay = '"neue-haas-grotesk-display", sans-serif';
const roca = '"roca", sans-serif';
const handwritingAccent = '"adobe-handwriting-frank", sans-serif';

const theme = createTheme({
  typography: {
    // Default for most UI and body copy.
    fontFamily: neueHaasDisplay,
    // Title text
    h1: {
      fontFamily: ivyPrestoHeadline,
      fontWeight: 600
    },
    // Subheader text
    h2: {
      fontFamily: ivyPrestoHeadline,
      fontWeight: 400
    },
    // Chart header text
    h3: {
      fontFamily: roca,
      fontWeight: 600
    },
    // Back button text: same tone as h3, smaller size.
    backButton: {
      fontFamily: roca,
      fontWeight: 600,
      fontSize: "1.25rem",
      lineHeight: 1.1
    },
    // Normal text
    body1: {
      fontFamily: neueHaasDisplay,
      fontWeight: 400
    },
    body2: {
      fontFamily: neueHaasDisplay,
      fontWeight: 400
    },
    subtitle2: {
      fontFamily: neueHaasDisplay,
      fontWeight: 500
    },
    button: {
      fontFamily: neueHaasDisplay,
      fontWeight: 500,
      textTransform: "none"
    },
    // Accent layer for annotations/callouts.
    caption: {
      fontFamily: handwritingAccent,
      fontWeight: 400
    },
    overline: {
      fontFamily: handwritingAccent,
      fontWeight: 400,
      textTransform: "none"
    }
  }
});

export default theme;
