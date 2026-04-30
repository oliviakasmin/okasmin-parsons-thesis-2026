import { Box } from "@mui/material";
import type { CSSProperties } from "react";
import useInlineSvg from "../../hooks/useInlineSvg";

type InlineOutlineSvgProps = {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
};

function InlineOutlineSvg({ src, alt, className, style }: InlineOutlineSvgProps) {
  const { svgMarkup, loading, error } = useInlineSvg(src);

  if (!loading && error) {
    console.log(`[InlineOutlineSvg] failed to load ${src}: ${error}`);
  }

  if (!svgMarkup) {
    return (
      <Box
        aria-label={alt}
        sx={{
          width: "100%",
          height: "100%",
          display: "block"
        }}
        style={style}
      />
    );
  }

  return (
    <Box
      aria-label={alt}
      role="img"
      className={className}
      style={style}
      sx={{
        "& > svg": {
          width: "100%",
          height: "100%",
          display: "block"
        }
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}

export default InlineOutlineSvg;
