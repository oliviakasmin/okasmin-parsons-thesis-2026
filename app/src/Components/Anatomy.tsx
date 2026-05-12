import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import anatomyDrawing from "../../public/anatomy.svg";
import handsPottery from "../../public/hands_pottery.jpg";

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

const SLIDER_HANDLE_ICON_PX = 36;

export default function Anatomy() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const firstTextBlockRef = useRef<HTMLDivElement | null>(null);
  const secondTextBlockRef = useRef<HTMLDivElement | null>(null);
  const compareWrapRef = useRef<HTMLDivElement | null>(null);
  const sliderInitializedRef = useRef(false);
  const draggingRef = useRef(false);

  const [sliderX, setSliderX] = useState(0);
  const [layoutNonce, setLayoutNonce] = useState(0);

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

  useEffect(() => {
    const onScrollResize = () => setLayoutNonce((n) => n + 1);
    window.addEventListener("scroll", onScrollResize, { passive: true });
    window.addEventListener("resize", onScrollResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScrollResize);
      window.removeEventListener("resize", onScrollResize);
    };
  }, []);

  useLayoutEffect(() => {
    const wrap = compareWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => setLayoutNonce((n) => n + 1));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const wrap = compareWrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    if (r.width <= 0) return;
    setSliderX((prev) => {
      if (!sliderInitializedRef.current) {
        sliderInitializedRef.current = true;
        return r.left + r.width / 2;
      }
      return Math.min(Math.max(prev, r.left), r.right);
    });
  }, [layoutNonce]);

  const clampSliderToWrap = useCallback((clientX: number) => {
    const wrap = compareWrapRef.current;
    if (!wrap) return clientX;
    const r = wrap.getBoundingClientRect();
    return Math.min(Math.max(clientX, r.left), r.right);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      setSliderX(clampSliderToWrap(e.clientX));
    },
    [clampSliderToWrap]
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
  }, [handlePointerMove]);

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setSliderX(clampSliderToWrap(e.clientX));
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [clampSliderToWrap, handlePointerMove, handlePointerUp]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const wrapRect = compareWrapRef.current?.getBoundingClientRect();
  const lineLeftPx = wrapRect && wrapRect.width > 0 ? sliderX - wrapRect.left : null;
  const clipHands =
    wrapRect && lineLeftPx !== null
      ? `inset(0 ${Math.max(0, wrapRect.width - lineLeftPx)}px 0 0)`
      : undefined;

  return (
    <section ref={sectionRef} className="viewport-with-margins">
      <div
        style={{
          display: "flex",
          flexDirection: "column"
          // minHeight: "100vh",
        }}
      >
        <Typography variant="h3" sx={{ mx: 0, my: 3, pl: "0.75rem" }}>
          Anatomy of a vessel
        </Typography>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            flex: 1,
            width: "90%",
            marginTop: "10vh",
            marginLeft: "auto",
            marginRight: "auto",
            alignItems: "center",
            columnGap: "1.25rem",
            rowGap: "2rem"
          }}
        >
          <div
            style={{
              flex: "1 1 280px",
              minWidth: 0,
              maxWidth: "100%",
              display: "flex",
              flexDirection: "column"
              // justifyContent: "center"
              // alignItems: "center"
            }}
          >
            <div
              ref={compareWrapRef}
              style={{
                position: "relative",
                display: "inline-block",
                maxWidth: "100%",
                lineHeight: 0
              }}
            >
              <img
                src={anatomyDrawing}
                alt="Anatomy drawing"
                style={{ maxWidth: "100%", height: "auto", display: "block" }}
              />
              <img
                src={handsPottery}
                alt="Hands shaping pottery on a wheel"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  clipPath: clipHands
                }}
              />

              {lineLeftPx !== null ? (
                <>
                  <Box
                    sx={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${lineLeftPx}px`,
                      width: 0,
                      transform: "translateX(-0.5px)",
                      borderLeft: "1px solid rgba(255,255,255,0.55)",
                      pointerEvents: "none",
                      zIndex: 2
                    }}
                  />
                  <Box
                    className="slider-handle-cluster"
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: `${lineLeftPx}px`,
                      transform: "translate(-50%, -50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      lineHeight: 0,
                      overflow: "visible",
                      zIndex: 3,
                      "&:hover .slider-handle-circle": {
                        borderColor: "#ffffff"
                      }
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        width: SLIDER_HANDLE_ICON_PX,
                        height: SLIDER_HANDLE_ICON_PX,
                        boxSizing: "border-box",
                        px: "6px",
                        pt: "6px",
                        pb: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Box
                        className="slider-handle-circle"
                        sx={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transformOrigin: "50% 50%",
                          willChange: "auto",
                          border: "2px solid #3a3a3a",
                          borderRadius: "50%",
                          backgroundColor: "transparent",
                          transition: "border-color 0.18s ease-out",
                          pointerEvents: "none"
                        }}
                      />
                      {/* <Box
                        sx={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <InlineOutlineSvg
                          src={SLIDER_HANDLE_ICON_SRC}
                          alt=""
                          className="inline-outline-svg"
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "block",
                            pointerEvents: "none"
                          }}
                        />
                      </Box> */}
                    </Box>
                    <Box
                      onPointerDown={handleHandlePointerDown}
                      role="slider"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        wrapRect && wrapRect.width > 0
                          ? Math.round((lineLeftPx / wrapRect.width) * 100)
                          : 50
                      }
                      aria-label="Compare pottery and anatomy images"
                      sx={{
                        position: "absolute",
                        inset: 0,
                        cursor: "ew-resize",
                        touchAction: "none",
                        zIndex: 2
                      }}
                    />
                  </Box>
                </>
              ) : null}
            </div>
          </div>
          <div
            style={{
              flex: "1 1 280px",
              minWidth: 0,
              maxWidth: "100%",
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
                ceramic{" "}
                <Typography component="span" variant="labels" sx={{ fontStyle: "italic" }}>
                  (adj)
                </Typography>
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
                vessel{" "}
                <Typography component="span" variant="labels" sx={{ fontStyle: "italic" }}>
                  (n)
                </Typography>
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
