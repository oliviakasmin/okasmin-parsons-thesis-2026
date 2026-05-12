import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { allObjectIds } from "./title_intro_constants";
import MiniShelfSVG from "./MiniShelfSVG";

const splitAt = Math.ceil(allObjectIds.length / 2);
const topRowIds = allObjectIds.slice(0, splitAt);
const bottomRowIds = allObjectIds.slice(splitAt);

const TopShelfSVG = <MiniShelfSVG objectIds={topRowIds} />;
const BottomShelfSVG = <MiniShelfSVG objectIds={bottomRowIds} />;

gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger);

export default function Intro() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const firstLineRef = useRef<HTMLHeadingElement | null>(null);
  const secondLineRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!sectionRef.current || !firstLineRef.current || !secondLineRef.current) return;

    gsap.set([firstLineRef.current, secondLineRef.current], {
      autoAlpha: 0,
      y: 16
    });

    const firstTween = gsap.to(firstLineRef.current, {
      autoAlpha: 1,
      y: 0,
      duration: 0.8,
      ease: "power2.out",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 55%",
        toggleActions: "play none none reverse"
      }
    });

    const secondTween = gsap.to(secondLineRef.current, {
      autoAlpha: 1,
      y: 0,
      duration: 0.8,
      ease: "power2.out",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 10%",
        toggleActions: "play none none reverse"
      }
    });

    return () => {
      firstTween.scrollTrigger?.kill();
      secondTween.scrollTrigger?.kill();
      firstTween.kill();
      secondTween.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="viewport-with-margins"
      style={{
        height: "calc(100vh - (var(--page-margin) * 2))",
        overflow: "hidden"
      }}
    >
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-around"
          // alignItems: "center"
        }}
      >
        <Box sx={{ alignSelf: "flex-start", pl: "8%" }}>{TopShelfSVG}</Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "3rem"
          }}
        >
          <Typography ref={firstLineRef} variant="h4" component="h4">
            We've been making
            <Box
              component="span"
              sx={(theme) => ({
                ...theme.typography.h3
              })}
            >
              {" "}
              ceramic vessels{" "}
            </Box>
            for over 20,000 years.
          </Typography>
          <Typography ref={secondLineRef} variant="h4" component="h4">
            When we{" "}
            <Box component="span" sx={(theme) => ({ ...theme.typography.h3 })}>
              undress
            </Box>{" "}
            them a shared thread emerges.
          </Typography>
        </Box>

        <Box sx={{ alignSelf: "flex-end", pr: "8%" }}>{BottomShelfSVG}</Box>
      </Box>
    </section>
  );
}
