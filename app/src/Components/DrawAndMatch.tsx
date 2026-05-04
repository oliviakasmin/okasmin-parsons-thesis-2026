import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { Client } from "@gradio/client";
import { useCallback, useEffect, useRef, useState } from "react";

const MATCH_CANVAS_SIZE = 768;
const S3_IMAGE_BASE_URL = "https://vessels-thesis.s3.amazonaws.com/real_images";

type Point = readonly [number, number];

type MatchRow = {
  rank: number;
  object_id: string;
  distance: number;
};

type MatchPayload = {
  matches?: MatchRow[];
  error?: string;
};

function pointerPos(ev: React.PointerEvent<HTMLCanvasElement>): Point {
  const el = ev.currentTarget;
  const rect = el.getBoundingClientRect();
  const scaleX = MATCH_CANVAS_SIZE / rect.width;
  const scaleY = MATCH_CANVAS_SIZE / rect.height;
  const x = (ev.clientX - rect.left) * scaleX;
  const y = (ev.clientY - rect.top) * scaleY;
  return [x, y];
}

function normalizePredictResult(raw: unknown): MatchPayload {
  if (Array.isArray(raw) && raw.length > 0 && raw[0] != null && typeof raw[0] === "object") {
    return raw[0] as MatchPayload;
  }
  if (raw == null || typeof raw !== "object") {
    return { error: "Unexpected response from matcher.", matches: [] };
  }
  const obj = raw as Record<string, unknown>;
  if ("data" in obj && Array.isArray(obj.data)) {
    const first = obj.data[0];
    if (first && typeof first === "object") {
      return first as MatchPayload;
    }
  }
  return raw as MatchPayload;
}

export default function DrawAndMatch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const currentStrokeRef = useRef<Point[] | null>(null);
  const drawingRef = useRef(false);

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBase =
    typeof import.meta.env.VITE_MATCH_API_URL === "string"
      ? import.meta.env.VITE_MATCH_API_URL.replace(/\/$/, "")
      : "";

  const redraw = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, MATCH_CANVAS_SIZE, MATCH_CANVAS_SIZE);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const drawStroke = (pts: Point[]) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
    };

    for (const s of strokes) {
      drawStroke(s);
    }
    const cur = currentStrokeRef.current;
    if (cur) {
      drawStroke(cur);
    }
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const clearAll = () => {
    currentStrokeRef.current = null;
    drawingRef.current = false;
    setStrokes([]);
    setMatches([]);
    setError(null);
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    ev.preventDefault();
    (ev.currentTarget as HTMLCanvasElement).setPointerCapture(ev.pointerId);
    drawingRef.current = true;
    const p = pointerPos(ev);
    currentStrokeRef.current = [p];
    redraw();
  };

  const onPointerMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    ev.preventDefault();
    currentStrokeRef.current.push(pointerPos(ev));
    redraw();
  };

  const onPointerUp = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    ev.preventDefault();
    drawingRef.current = false;
    const cur = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (cur && cur.length >= 2) {
      setStrokes((prev) => [...prev, cur]);
    }
    try {
      (ev.currentTarget as HTMLCanvasElement).releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerLeave = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    onPointerUp(ev);
  };

  const runMatch = async () => {
    setError(null);
    setMatches([]);
    if (!apiBase) {
      setError("Set VITE_MATCH_API_URL to your Hugging Face Space URL (see .env.example).");
      return;
    }

    const flat = strokes.flat();
    if (flat.length < 3) {
      setError("Draw a vase outline with at least three points, then tap Match.");
      return;
    }

    const hidden = document.createElement("canvas");
    hidden.width = MATCH_CANVAS_SIZE;
    hidden.height = MATCH_CANVAS_SIZE;
    const hctx = hidden.getContext("2d");
    if (!hctx) {
      setError("Could not prepare image.");
      return;
    }

    hctx.clearRect(0, 0, MATCH_CANVAS_SIZE, MATCH_CANVAS_SIZE);
    hctx.fillStyle = "#ffffff";
    hctx.beginPath();
    hctx.moveTo(flat[0][0], flat[0][1]);
    for (let i = 1; i < flat.length; i++) {
      hctx.lineTo(flat[i][0], flat[i][1]);
    }
    hctx.closePath();
    hctx.fill();

    const blob = await new Promise<Blob | null>((resolve) => {
      hidden.toBlob((b) => resolve(b), "image/png");
    });
    if (!blob) {
      setError("Could not encode drawing.");
      return;
    }

    setLoading(true);
    try {
      const client = await Client.connect(apiBase);
      const raw = await client.predict("/match_vase", [blob]);
      const payload = normalizePredictResult(raw);
      if (payload.error) {
        setError(payload.error);
        setMatches([]);
      } else {
        setMatches(payload.matches ?? []);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        `Could not reach matcher (${msg}). If the Space was asleep, wait ~30s and try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component="section"
      sx={{
        width: "100%",
        maxWidth: "min(1100px, 100%)",
        mx: "auto",
        px: { xs: 2, md: 3 },
        py: 4,
        display: "flex",
        flexDirection: "column",
        gap: 2
      }}
    >
      <Typography variant="h3">draw a vase</Typography>
      <Typography variant="body1" sx={{ maxWidth: "56ch", opacity: 0.9 }}>
        Sketch a closed silhouette on the square (trackpad or mouse). We send it to your Hugging
        Face Space and show the five closest shapes from the Met vessel dataset.
      </Typography>

      {!apiBase ? (
        <Typography variant="body2" color="warning.main">
          Add <code>VITE_MATCH_API_URL</code> in <code>.env</code> (see <code>.env.example</code>)
          and restart the dev server.
        </Typography>
      ) : null}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Box
          sx={{
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 1,
            overflow: "hidden",
            flexShrink: 0
          }}
        >
          <canvas
            ref={canvasRef}
            width={MATCH_CANVAS_SIZE}
            height={MATCH_CANVAS_SIZE}
            style={{
              width: "min(92vw, 420px)",
              height: "auto",
              display: "block",
              touchAction: "none",
              cursor: "crosshair"
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
          />
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Button variant="contained" onClick={runMatch} disabled={loading}>
            {loading ? "Matching…" : "Match"}
          </Button>
          <Button variant="outlined" onClick={clearAll} disabled={loading}>
            Clear
          </Button>
          {loading ? (
            <Typography variant="caption" sx={{ maxWidth: 240 }}>
              Matching… Hugging Face free Spaces can take ~30s to wake from sleep on the first
              request.
            </Typography>
          ) : null}
        </Box>
      </Box>

      {error ? (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      ) : null}

      {matches.length > 0 ? (
        <Box>
          <Typography variant="h5" sx={{ mb: 1.5 }}>
            closest matches
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              justifyContent: "flex-start"
            }}
          >
            {matches.map((m) => (
              <Box
                key={`match-${m.rank}-${m.object_id}`}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.75,
                  width: "140px",
                  flexShrink: 0
                }}
              >
                <Box sx={{ borderBottom: "3px solid #fff", width: "100%" }}>
                  <img
                    src={`${S3_IMAGE_BASE_URL}/${m.object_id}_no_bg.png`}
                    alt={`Match ${m.rank}: object ${m.object_id}`}
                    style={{
                      width: "100%",
                      height: "180px",
                      objectFit: "contain",
                      display: "block"
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ textAlign: "center", lineHeight: 1.2 }}>
                  #{m.rank} · {m.object_id}
                  <br />
                  dist {m.distance.toFixed(3)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
