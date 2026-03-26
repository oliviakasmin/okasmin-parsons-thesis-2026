Hugging Face Space

1. run model to remove background and get masking image
   https://huggingface.co/briaai/RMBG-2.0
   https://huggingface.co/spaces/KenjieDec/RemBG
   https://huggingface.co/spaces/not-lain/background-removal
2. crop to consistent size - set standard w size for width and height; scale image such that maximum height of object is maintained and then crop to square w x w
3. extract features (x1...xn, v1...vn for left side and right side) silhouette score (ie distance from left edge to first white pixel)
4. Gradio interface for testing
5. API that can be accessed via Netlify --> frontend app
