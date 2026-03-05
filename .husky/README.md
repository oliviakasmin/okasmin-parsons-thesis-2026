# Husky Hooks

Husky lets this repository run Git hooks from version-controlled files, so everyone gets the same checks before commit/push.

In this project:

- `pre-commit` runs quality checks (format, lint, typecheck, and build) and blocks commit on failure.
- `pre-push` can run `vite build` and asks for confirmation when the push target includes `main`.

You can bypass hooks when needed with Git's `--no-verify` flag.
