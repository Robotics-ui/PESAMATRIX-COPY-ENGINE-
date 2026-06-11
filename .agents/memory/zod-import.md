---
name: Zod Import in API Server
description: Correct zod import style for api-server routes (catalog is zod v3, not v4).
---

# Zod Import in API Server

## The Rule
In `artifacts/api-server/src/**`, always import from `"zod"`, not `"zod/v4"`.
Use Zod v3 API: `z.string().email()`, not `z.email()`.
Use `result.error.flatten().fieldErrors`, not `ZodError.flatten(result.error)`.

## Why
The workspace catalog pins `zod: ^3.25.76`. Even though zod 3.25 ships a `/v4` subpath, esbuild (0.27.3) cannot resolve subpath exports from this package in the bundled output — the build fails with "Could not resolve zod/v4". The db schema files use `zod/v4` too but those come from `@workspace/db` which is bundled separately and resolved via node module resolution, not esbuild's bundler path.

## How to Apply
- Always `import { z } from "zod"` in api-server source files.
- `zod` must be listed as a direct dependency in `artifacts/api-server/package.json` (it was not there by default — had to be added with `pnpm add --filter @workspace/api-server zod`).
