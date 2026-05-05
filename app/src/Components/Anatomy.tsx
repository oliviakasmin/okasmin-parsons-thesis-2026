import { useEffect, useRef } from "react";
import Typography from "@mui/material/Typography";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import anatomyDrawing from "../../public/anatomy_screenshot.png";

/**
 * RESPONSIVE component - no fixed positioning
 * width and heigt of the component is 100vh and 100vw
 * use flexbox so can wrap if needed - we'll set breakpoints later
 * 
 structure of component:
 * First Typography element h3 - NO styling needed

  id=content-container contains 2 columns - each should be 50% of vw
  contents of each column should be vertically centered within the available space of content-container
  all content in left-container should be horizontally centered
  all content in right-container should be left aligned

  right-column contains 2 blocks of text - the text should all wrap appropriately and SHOULD NOT go off the side of the screen
 */

gsap.registerPlugin(ScrollTrigger);

export default function Anatomy() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const firstTextBlockRef = useRef<HTMLDivElement | null>(null);
  const secondTextBlockRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sectionRef.current || !firstTextBlockRef.current || !secondTextBlockRef.current) return;

    gsap.set([firstTextBlockRef.current, secondTextBlockRef.current], {
      autoAlpha: 0,
      y: 18
    });

    const firstTween = gsap.to(firstTextBlockRef.current, {
      autoAlpha: 1,
      y: 0,
      duration: 0.9,
      ease: "power2.out",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 50%",
        toggleActions: "play none none reverse"
      }
    });

    const secondTween = gsap.to(secondTextBlockRef.current, {
      autoAlpha: 1,
      y: 0,
      duration: 0.9,
      ease: "power2.out",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 25%",
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
    <section ref={sectionRef} className="viewport-with-margins">
      <div
        style={{
          display: "flex",
          flexDirection: "column"
          // minHeight: "100vh",
        }}
      >
        <Typography variant="h3" sx={{ my: 3 }}>
          Anatomy of a vessel
        </Typography>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            flex: 1,
            width: "100%",
            marginTop: "10vh",
            alignItems: "center"
          }}
        >
          <div
            style={{
              flex: "1 1 50%",
              maxWidth: "50%",
              minWidth: 0,
              display: "flex",
              flexDirection: "column"
              // justifyContent: "center"
              // alignItems: "center"
            }}
          >
            <img
              src={anatomyDrawing}
              alt="Anatomy drawing"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </div>
          <div
            style={{
              flex: "1 1 50%",
              maxWidth: "50%",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              // justifyContent: "center",
              alignItems: "flex-start",
              overflow: "hidden"
            }}
          >
            <div
              ref={firstTextBlockRef}
              style={{ width: "100%", maxWidth: "100%", marginBottom: "2rem" }}
            >
              <Typography variant="h4" sx={{ mb: 1 }}>
                ceramic <span style={{ fontStyle: "italic", fontSize: "0.75em" }}>(adj)</span>
              </Typography>
              <Typography
                variant="h5"
                component="p"
                noWrap={false}
                sx={{
                  maxWidth: "80%"
                }}
              >
                “made from clay that has been shaped and then baked until hard”
              </Typography>
            </div>
            <div ref={secondTextBlockRef} style={{ width: "100%", maxWidth: "100%" }}>
              <Typography variant="h4" sx={{ mb: 1 }}>
                vessel <span style={{ fontStyle: "italic", fontSize: "0.75em" }}>(n)</span>
              </Typography>
              <Typography
                variant="h5"
                component="p"
                noWrap={false}
                sx={{
                  maxWidth: "80%"
                }}
              >
                “a container (such as a cask, bottle, kettle, cup, or bowl) for holding something”
              </Typography>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
