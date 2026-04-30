# Shelf Animation Reference (Flash-Free)

This file documents the correct animation setup for `app/src/Components/EntryPoints/Shelf.tsx`.
Use this as the source of truth if the Shelf load animation is overwritten or regresses.

## Current Correct Pattern

### 1) Use `useLayoutEffect` for SVG path animation setup

In `AnimatedSampledSvg`, the path stroke setup must happen in `useLayoutEffect` (not `useEffect`) so dash styles are applied before paint:

- Query `svg path`
- Set `strokeDasharray` and `strokeDashoffset` from `getTotalLength()`
- Apply `shelfPathDraw` animation and per-path delay

Why: `useLayoutEffect` runs before paint and avoids first-frame unstyled flashes.

### 2) Keep the container visible; do not gate whole SVG visibility

Do **not** hide/show the entire SVG wrapper with a separate `isSvgReady` state.

Why: full visibility gating can suppress or desync the path animation timing.

### 3) Keep shelf-level intersection reveal logic

At the `Shelf` component level, keep:

- `isShelfHalfVisible` state
- `IntersectionObserver` threshold check (`intersectionRatio >= 0.5`)
- initial `requestAnimationFrame` reveal on first intersection pass

Why: this prevents mount/remount pop-in while still allowing animations when the shelf is actually visible.

## Known Regressions To Avoid

- Replacing `useLayoutEffect` with `useEffect` in `AnimatedSampledSvg`.
- Adding a global SVG visibility gate (`visibility: hidden` until ready).
- Removing the initial intersection `requestAnimationFrame` reveal behavior.

## Quick Restore Checklist

If flash returns:

1. Confirm `AnimatedSampledSvg` uses `useLayoutEffect`.
2. Confirm no `isSvgReady`-style wrapper visibility gate exists.
3. Confirm `isShelfHalfVisible` + intersection observer + first-frame reveal logic still exists.
4. Retest by loading the shelf route from a hard refresh.
