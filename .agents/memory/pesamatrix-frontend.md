---
name: PesaMatrix Frontend Architecture
description: Key decisions for the PesaMatrix frontend SPA (artifacts/mockup-sandbox).
---

## Structure
- Frontend SPA lives in `artifacts/mockup-sandbox/src/`
- API server on port 3000 (internal); Frontend Vite dev server on port 5000 (webview)
- Vite proxies `/api` → `http://localhost:3000` (vite.config.ts)
- Workflows: "Start API" (console, :3000), "Start Frontend" (webview, :5000)

## Auth token flow
- Access token stored in module-level `_accessToken` in `src/lib/auth.ts`
- `setAuthTokenGetter(() => getToken())` called once at `AuthContext.tsx` module level
- `customFetch` auto-injects Bearer header before every request
- Refresh token is httpOnly cookie (browser handles transparently)
- On mount, `AuthContext` calls `api.auth.refresh()` to hydrate session from cookie

## customFetch export
- `customFetch` lives in `lib/api-client-react/src/custom-fetch.ts`
- Must be explicitly re-exported from `lib/api-client-react/src/index.ts`
- Without this export, Vite dep-scan fails with "No matching export" error

**Why:** The `index.ts` only re-exported `setBaseUrl` and `setAuthTokenGetter` by default; `customFetch` was private to the module. Any new package importing it must ensure the export exists.

## Port constraints
- Replit webview output type REQUIRES port 5000. Using port 8080 with outputType "webview" throws a configuration error.
- API stays on port 3000 (not externally exposed; accessed via Vite proxy in dev)

## Router
- Uses `wouter` (not react-router-dom) — lightweight, no BrowserRouter wrapper needed
- Route protection via `ProtectedRoute` component that checks `isLoading` → `isAuthenticated` → `user.role`
