import { createTheme } from "@mui/material/styles";
import type { CSSProperties } from "react";

declare module "@mui/material/styles" {
  interface TypographyVariants {
    backButton: CSSProperties;
    rocaLight: CSSProperties;
  }

  interface TypographyVariantsOptions {
    backButton?: CSSProperties;
    rocaLight?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    backButton: true;
    rocaLight: true;
  }
}

const ivyPrestoHeadline = '"ivypresto-headline", serif';
const neueHaasDisplay = '"neue-haas-grotesk-display", sans-serif';
const roca = '"roca", sans-serif';
const handwritingAccent = '"adobe-handwriting-frank", sans-serif';

const themeBase = createTheme({
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
    h4: {
      fontFamily: neueHaasDisplay,
      fontSize: "1.75rem"
      // fontWeight: 600
    },
    h5: {
      fontFamily: neueHaasDisplay
      // fontWeight: 600
    },
    rocaLight: {
      fontFamily: roca,
      fontWeight: 300
    },
    // Back button text: same tone as h3, smaller size.
    backButton: {
      fontFamily: roca,
      fontWeight: 600,
      fontSize: "1.25rem",
      lineHeight: 1.1
    },
    // Normal text (body1 is default for paragraphs and factual labels).
    body1: {
      fontFamily: neueHaasDisplay,
      fontWeight: 400,
      fontSize: "1.25rem",
      lineHeight: 1.5
    },
    body2: {
      fontFamily: neueHaasDisplay,
      fontWeight: 400,
      fontSize: "0.875rem",
      lineHeight: 1.43
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

/** Intro body: h4 sizing/styling with h3 line-height (and letter-spacing when set on h3). */
export default themeBase;
