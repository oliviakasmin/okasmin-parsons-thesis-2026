---
title: Vase silhouette match
emoji: 🏺
colorFrom: gray
colorTo: purple
sdk: gradio
sdk_version: 4.44.1
app_file: app.py
pinned: false
license: mit
---

# Vase silhouette match (Gradio Space)

Matches an RGBA mask image (white vase silhouette on transparent background) to the **nearest neighbors** in the thesis silhouette dataset using the same pipeline as the repo:

- Features: [`get_features.py`](../process_data/features/get_features.py) vendored as `get_features.py`
- Weighted Euclidean space: [`cluster_utils.build_weighted_matrix`](../format_data/cluster_shape/cluster_utils.py) vendored as `cluster_utils.py`
- Reference table: `silhouette_features.csv`

## Deploy on Hugging Face Spaces

1. Create a new Space (**Gradio**, CPU basic tier is enough).
2. Upload this folder’s contents (`app.py`, `requirements.txt`, `get_features.py`, `cluster_utils.py`, `silhouette_features.csv`) via Git or the web UI.
3. Wait for the build to finish. Cold starts on the free tier can take ~30s after idle.

### Repo mirror workflow

From your clone:

```bash
cd huggingface_space
# after bumping features CSV upstream:
cp ../process_data/features/get_features.py .
cp ../format_data/cluster_shape/cluster_utils.py .
cp ../process_data/features/silhouette_features.csv .
git add .
git commit -m "Sync vase-match Space assets"
git push  # your HF Space remote
```

### Frontend URL

Point `VITE_MATCH_API_URL` in the React app (see repo `.env.example`) at your Space root URL, e.g. `https://YOUR_USERNAME-vase-match.hf.space` — **no trailing slash**.

The UI calls the Gradio API **`match_vase`** via `@gradio/client`.
