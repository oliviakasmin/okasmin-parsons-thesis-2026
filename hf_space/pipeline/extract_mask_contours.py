import cv2
import numpy as np
from pathlib import Path
from PIL import Image as PImage

# run this file on BRIA mask after passing through crop_standardize.py

# CHANGE THIS IF NEED DIFFERENT IMAGES
test_images_dir = Path("../pipeline/test_images").resolve()


def load_mask_image(object_id):
    image_dir = test_images_dir
    mask_path = image_dir / f"{object_id}_mask_standardized.png"
    img = PImage.open(mask_path).convert("RGBA")
    return img


def extract_outline_from_mask(object_id, alpha_threshold=8):
    img = load_mask_image(object_id)
    rgba = np.array(img, dtype=np.uint8)
    alpha = rgba[:, :, 3]  # best channel for masks
    _, binary = cv2.threshold(src=alpha, thresh=alpha_threshold, maxval=255, type=cv2.THRESH_BINARY)
    contours, hierarchy = cv2.findContours(
        image=binary, mode=cv2.RETR_CCOMP, method=cv2.CHAIN_APPROX_SIMPLE
    )

    outer_contours = []
    inner_contours = []
    if hierarchy is not None:
        h = hierarchy[0]  # shape: (N, 4), [next, prev, first_child, parent]
        for i, cnt in enumerate(contours):
            parent = h[i][3]
            if parent == -1:
                outer_contours.append(cnt.reshape(-1, 2))  # outer boundary
            else:
                inner_contours.append(cnt.reshape(-1, 2))  # hole boundary
    # print("all:", len(contours), "outer:", len(outer_contours), "inner:", len(inner_contours))
    return contours, outer_contours, inner_contours
