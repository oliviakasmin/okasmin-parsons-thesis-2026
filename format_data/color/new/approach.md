Overall approach: ColorThief color → adjusted to real image color → count nearby real pixels → largest share wins

Goal:

1. find vibrant colors palette using ColorThief library
2. match ColorThief colors to actual colors on the image / nearest KMeans centroid actually present
3. find dominant colors per image (ideally get a percent for each color in the palette)
4. group the images into approximate buckets (either using Kmeans, or deterministic buckets like "blue", "green", "yellow", "blue and white", "Terracotta / Earthenware", "black", "Neutral Stoneware", "multicolor", "White / Cream")

sample code:

colorthief_rgb
dominant_rgb
dominant_percent

This works very well in practice.

For your project specifically, I’d also recommend:

filtering out tiny clusters
weighting by pixel frequency
removing highlights/shadows before extraction

because museum photography often introduces:

white glare
dark shadow edges
reflective glazing artifacts

Another very strong option:
Instead of snapping to a single pixel, snap to:

the nearest high-frequency color cluster

That avoids weird one-off noisy pixels becoming palette colors.

So:

from colorthief import ColorThief
from PIL import Image
import numpy as np
from skimage.color import rgb2lab

img = Image.open("vessel.png").convert("RGB")
pixels = np.array(img).reshape(-1, 3)

# remove transparent/background if needed first

# palette proposal

ct = ColorThief("vessel.png")
palette = ct.get_palette(color_count=5)

# convert pixels to LAB

pixels_lab = rgb2lab(pixels.reshape(-1,1,3)/255.0).reshape(-1,3)

real_palette = []

for color in palette:
color_lab = rgb2lab(
np.array(color).reshape(1,1,3)/255.0
).reshape(3)

    distances = np.linalg.norm(pixels_lab - color_lab, axis=1)

    nearest_idx = np.argmin(distances)

    real_palette.append(tuple(pixels[nearest_idx]))

import numpy as np
from PIL import Image
from skimage.color import rgb2lab

def dominant_from_adjusted_palette(
image_path,
adjusted_palette_rgb,
alpha_threshold=10,
max_delta_e=18
):
img = Image.open(image_path).convert("RGBA")
arr = np.array(img)

    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    # foreground only
    pixels = rgb[alpha > alpha_threshold]

    # optional: remove near-white / near-black photography artifacts
    # pixels = pixels[(pixels.mean(axis=1) > 20) & (pixels.mean(axis=1) < 245)]

    pixels_lab = rgb2lab(pixels.reshape(-1, 1, 3) / 255).reshape(-1, 3)

    palette = np.array(adjusted_palette_rgb)
    palette_lab = rgb2lab(palette.reshape(-1, 1, 3) / 255).reshape(-1, 3)

    scores = []

    for i, color_lab in enumerate(palette_lab):
        distances = np.linalg.norm(pixels_lab - color_lab, axis=1)

        # pixels perceptually close to this adjusted color
        matching_pixels = distances < max_delta_e

        score = matching_pixels.mean()  # percent of foreground pixels
        scores.append(score)

    dominant_idx = int(np.argmax(scores))

    return {
        "dominant_rgb": tuple(adjusted_palette_rgb[dominant_idx]),
        "dominant_percent": float(scores[dominant_idx]),
        "palette_scores": [
            {
                "rgb": tuple(map(int, adjusted_palette_rgb[i])),
                "percent": float(scores[i])
            }
            for i in range(len(adjusted_palette_rgb))
        ]
    }

adjusted_palette = [
(178, 93, 54),
(232, 218, 190),
(78, 52, 39),
(31, 80, 129),
]

result = dominant_from_adjusted_palette("vessel.png", adjusted_palette)

print(result["dominant_rgb"])
print(result["dominant_percent"])
