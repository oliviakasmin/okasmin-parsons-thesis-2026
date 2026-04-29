import { useEffect, useState } from "react";

type InlineSvgState = {
  svgMarkup: string | null;
  loading: boolean;
  error: string | null;
};

const svgMarkupCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string>>();

function normalizeSvgMarkup(rawMarkup: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawMarkup, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) {
    throw new Error("SVG root element not found");
  }

  if (!svg.getAttribute("preserveAspectRatio")) {
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }

  // Keep source geometry while allowing wrapper CSS to control size.
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("aria-hidden", "true");

  return svg.outerHTML;
}

async function fetchInlineSvg(svgUrl: string): Promise<string> {
  if (svgMarkupCache.has(svgUrl)) {
    return svgMarkupCache.get(svgUrl)!;
  }

  if (inFlightRequests.has(svgUrl)) {
    return inFlightRequests.get(svgUrl)!;
  }

  const request = fetch(svgUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`SVG fetch failed (${response.status})`);
      }
      const raw = await response.text();
      const normalized = normalizeSvgMarkup(raw);
      svgMarkupCache.set(svgUrl, normalized);
      return normalized;
    })
    .finally(() => {
      inFlightRequests.delete(svgUrl);
    });

  inFlightRequests.set(svgUrl, request);
  return request;
}

function useInlineSvg(svgUrl: string | undefined): InlineSvgState {
  const [state, setState] = useState<InlineSvgState>({
    svgMarkup: null,
    loading: Boolean(svgUrl),
    error: null
  });

  useEffect(() => {
    let cancelled = false;

    if (!svgUrl) {
      setState({ svgMarkup: null, loading: false, error: null });
      return () => {
        cancelled = true;
      };
    }

    const cached = svgMarkupCache.get(svgUrl);
    if (cached) {
      setState({ svgMarkup: cached, loading: false, error: null });
      return () => {
        cancelled = true;
      };
    }

    setState({ svgMarkup: null, loading: true, error: null });

    fetchInlineSvg(svgUrl)
      .then((svgMarkup) => {
        if (cancelled) return;
        setState({ svgMarkup, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          svgMarkup: null,
          loading: false,
          error: error instanceof Error ? error.message : "Unknown SVG load error"
        });
      });

    return () => {
      cancelled = true;
    };
  }, [svgUrl]);

  return state;
}

export default useInlineSvg;
