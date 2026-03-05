Deployed link: https://okasmin-thesis-vessels.netlify.app/

# okasmin-parsons-thesis-2026

This repository contains the thesis project codebase, including:

- `app/` for the React + TypeScript frontend
- `pipeline/` for data fetch/clean scripts
- `hf_space/` for the Hugging Face Space app

## Development (repo root)

Run these from the repository root:

- install dependencies: `npm install`
- start frontend dev server: `npm run dev`
- build deployable frontend assets: `npm run build`
- lint frontend TypeScript/JS: `npm run lint`
- auto-fix frontend lint issues: `npm run lint:fix`
- lint Python (`pipeline/`, `hf_space/`): `npm run lint:py`
- auto-fix Python lint issues: `npm run lint:py:fix`
- check frontend formatting: `npm run format`
- auto-format frontend files: `npm run format:fix`
- check Python formatting: `npm run format:py`
- auto-format Python files: `npm run format:py:fix`
- run full commit gate manually: `npm run check:commit`

## Git Hooks

- hooks are managed with Husky in the repo root
- full hook instructions: `.husky/README.md`
