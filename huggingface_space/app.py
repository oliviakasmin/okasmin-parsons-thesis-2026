"""
Gradio Space: match a user-drawn vase silhouette to the closest objects in
``silhouette_features.csv`` using the same weighted feature space as
``cluster_utils.build_weighted_matrix`` (same weights as the thesis clustering pipeline).
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import gradio as gr
import numpy as np
from PIL import Image

from cluster_utils import (
    build_weighted_matrix,
    get_feature_groups,
    load_feature_table,
    transform_new_sample,
)
from get_features import extract_features_for_mask

BASE_DIR = Path(__file__).resolve().parent
FEATURE_CSV = BASE_DIR / "silhouette_features.csv"

TOP_K = 5

_df = load_feature_table(FEATURE_CSV)
_groups = get_feature_groups(_df)
_X, _COLS, _IMPUTER, _SCALER, _W = build_weighted_matrix(_df, _groups)
_OBJECT_IDS = _df["object_id"].astype(str).to_numpy()


def match_vase(image: Image.Image | None):
    if image is None:
        return {"error": "No image provided.", "matches": []}

    rgba = image.convert("RGBA")
    fd, raw_path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    temp_path = Path(raw_path)
    try:
        rgba.save(temp_path, format="PNG")
        record = extract_features_for_mask(temp_path)
    except ValueError as exc:
        return {"error": str(exc), "matches": []}
    except Exception as exc:  # pragma: no cover
        return {"error": f"{type(exc).__name__}: {exc}", "matches": []}
    finally:
        temp_path.unlink(missing_ok=True)

    weighted = transform_new_sample(record, _COLS, _IMPUTER, _SCALER, _W)
    vec = weighted.reshape(-1)
    distances = np.linalg.norm(_X - vec, axis=1)
    order = np.argsort(distances)[:TOP_K]

    matches = []
    for rank, idx in enumerate(order, start=1):
        oid = str(_OBJECT_IDS[int(idx)])
        dist = float(distances[int(idx)])
        matches.append(
            {
                "rank": rank,
                "object_id": oid,
                "distance": dist,
            }
        )

    return {"matches": matches}


with gr.Blocks() as demo:
    gr.Markdown(
        "## Vase silhouette match\n"
        "Upload an RGBA PNG (white silhouette on transparent background) "
        f"or use the API endpoint **`match_vase`** — returns up to **{TOP_K}** nearest neighbors."
    )
    img_in = gr.Image(type="pil", image_mode="RGBA", label="Drawing / mask")
    out = gr.JSON(label="Result")
    btn = gr.Button("Match")
    btn.click(fn=match_vase, inputs=[img_in], outputs=out, api_name="match_vase")


if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=int(os.environ.get("PORT", "7860")))
