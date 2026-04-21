# RUN THIS FILE FROM ROOT DIRECTORY
# python process_data/process_images/remove_background.py

import io

import requests
from PIL import Image
import torch
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

# Test image config (shared with process_image.py flow)
TEST_IMAGE_URL = "https://images.metmuseum.org/CRDImages/as/original/LC-29_100_250_whs-002.jpg"
TEST_OBJECT_ID = "LC-29_100_250_whs-002"
MODEL_ID = "briaai/RMBG-2.0"
REQUEST_TIMEOUT_SECONDS = 30
IMAGE_SIZE = (1024, 1024)
IMAGE_NET_MEAN = [0.485, 0.456, 0.406]
IMAGE_NET_STD = [0.229, 0.224, 0.225]


def resolve_device():
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        return "mps"
    return "cpu"


# Exact model-card setup
device = resolve_device()
model = (
    AutoModelForImageSegmentation.from_pretrained(
        MODEL_ID, trust_remote_code=True, low_cpu_mem_usage=False
    )
    .eval()
    .to(device)
)

# Data settings
transform_image = transforms.Compose(
    [
        transforms.Resize(IMAGE_SIZE),
        transforms.ToTensor(),
        transforms.Normalize(IMAGE_NET_MEAN, IMAGE_NET_STD),
    ]
)


def download_image_from_url(image_url):
    resp = requests.get(image_url, timeout=REQUEST_TIMEOUT_SECONDS)
    resp.raise_for_status()
    return Image.open(io.BytesIO(resp.content)).convert("RGB")


def remove_background_from_image(image):
    image = image.convert("RGB")
    input_images = transform_image(image).unsqueeze(0).to(device)

    # Prediction
    with torch.inference_mode():
        preds = model(input_images)[-1].sigmoid().cpu()
    pred = preds[0].squeeze()
    pred_pil = transforms.ToPILImage()(pred)
    mask = pred_pil.resize(image.size).convert("L")

    no_bg_image = image.copy()
    no_bg_image.putalpha(mask)
    return no_bg_image, mask


def remove_background(image_url):
    image = download_image_from_url(image_url)
    return remove_background_from_image(image)


def run_remove_background_step(image_url=None, image=None):
    if image is not None:
        return remove_background_from_image(image=image)
    if image_url is not None:
        return remove_background(image_url=image_url)
    raise ValueError("Provide either image_url or image.")


def main():
    run_remove_background_step(TEST_IMAGE_URL)
    print("Done. Processed 1 image in memory (no files saved).")


if __name__ == "__main__":
    main()
