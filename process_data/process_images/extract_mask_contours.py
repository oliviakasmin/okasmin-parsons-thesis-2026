import cv2
import numpy as np

# from pathlib import Path
from PIL import Image as PImage

# run this file on BRIA mask image after passing through crop_standardize.py


def _get_mask_channel(mask_image):
    if "A" in mask_image.getbands():
        return np.array(mask_image.getchannel("A"), dtype=np.uint8)
    return np.array(mask_image.convert("L"), dtype=np.uint8)


def _split_outer_inner_contours(contours, hierarchy):
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
    return outer_contours, inner_contours


def extract_outline_from_mask_image(mask_image, alpha_threshold=8):
    channel = _get_mask_channel(mask_image)
    _, binary = cv2.threshold(
        src=channel, thresh=alpha_threshold, maxval=255, type=cv2.THRESH_BINARY
    )
    contours, hierarchy = cv2.findContours(
        image=binary, mode=cv2.RETR_CCOMP, method=cv2.CHAIN_APPROX_SIMPLE
    )
    outer_contours, inner_contours = _split_outer_inner_contours(contours, hierarchy)
    return contours, outer_contours, inner_contours, binary


def draw_contours_from_mask_image(
    mask_image,
    contours,
    contour_thickness=1,
    contour_color=(255, 255, 255, 255),
):
    width, height = mask_image.size
    contour_rgba = np.zeros((height, width, 4), dtype=np.uint8)
    # Match standardized transparent mask style: white RGB with transparent alpha.
    contour_rgba[:, :, :3] = 255

    if contours is not None and len(contours) > 0:
        cv2.drawContours(
            image=contour_rgba,
            contours=contours,
            contourIdx=-1,
            color=contour_color,
            thickness=contour_thickness,
        )
    return PImage.fromarray(contour_rgba, mode="RGBA")


def draw_inner_outer_contours_from_mask_image(
    mask_image,
    outer_contours,
    inner_contours,
    outer_thickness=1,
    inner_thickness=1,
    outer_color=(0, 255, 0, 255),
    inner_color=(255, 0, 0, 255),
):
    width, height = mask_image.size
    contour_rgba = np.zeros((height, width, 4), dtype=np.uint8)
    # Match standardized transparent mask style: white RGB with transparent alpha.
    contour_rgba[:, :, :3] = 255

    def to_cv_contours(contours):
        cv_contours = []
        for contour in contours or []:
            arr = np.asarray(contour, dtype=np.int32)
            if arr.ndim == 2 and arr.shape[1] == 2:
                arr = arr.reshape(-1, 1, 2)
            if arr.ndim == 3 and arr.shape[1] == 1 and arr.shape[2] == 2:
                cv_contours.append(arr)
        return cv_contours

    cv_outer = to_cv_contours(outer_contours)
    cv_inner = to_cv_contours(inner_contours)

    if cv_outer:
        cv2.drawContours(
            image=contour_rgba,
            contours=cv_outer,
            contourIdx=-1,
            color=outer_color,
            thickness=outer_thickness,
        )
    if cv_inner:
        cv2.drawContours(
            image=contour_rgba,
            contours=cv_inner,
            contourIdx=-1,
            color=inner_color,
            thickness=inner_thickness,
        )
    return PImage.fromarray(contour_rgba, mode="RGBA")
