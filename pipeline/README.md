# Python: builds the dataset + exports web-ready artifacts

pipeline/ # Python: builds the dataset + exports web-ready artifacts
requirements.txt  
 README.md # how to run stages, expected outputs

    src/
      config.py                 # paths, bucket names, model refs, feature settings

      fetch/
        get_object_ids.py
        download_images.py

      preprocess/
        remove_bg.py            # uses HF model locally (or your customized pipeline logic)
        crop_standardize.py

      features/
        extract_features.py     # outputs features.parquet (or similar)

      cluster/
        run_clustering.py       # outputs clusters + assignments + centroids
        build_index.py          # OPTIONAL: annoy/faiss/knn index for later use

      export/
        make_thumbnails.py      # outputs thumbs/ (local) + optional upload
        make_previews.py        # outputs previews/ (for S3)
        build_manifest.py
        build_clusters_json.py
        build_objects_json.py   # optionally chunk-by-cluster

      publish/
        upload_to_s3.py         # uploads derived assets + JSON to S3 paths
        invalidate_cdn.py       # optional if you use CloudFront invalidations

    scripts/
      run_all.sh                # stage runner
      run_stage.sh              # per-stage runner
      clean_outputs.sh

    outputs/                    # NOT in git (symlink to ../data/derived recommended)
      README.md

Create and activate a virtual environment

cd /Users/oliviakasmin/Desktop/okasmin-parsons-thesis-2026
python3 -m venv .venv
source .venv/bin/activate

From the repo root (while the venv is active):
pip install --upgrade pip
pip install -r pipeline/requirements.txt

to activate enviornment again later:
cd /Users/oliviakasmin/Desktop/okasmin-parsons-thesis-2026
source .venv/bin/activate

pip install -r pipeline/requirements.txt
