---
name: Express Router Scoping
description: Path-prefix mounting pattern required to avoid middleware bleeding across routers in this project.
---

# Express Router Middleware Scoping

## The Rule
Always mount sub-routers with a path prefix in `routes/index.ts`. Never rely on `router.use(middleware)` inside a sub-router that is mounted without a path prefix.

## Why
When `router.use(subrouter)` is called without a path, Express routes ALL requests through that subrouter. Any `router.use(authenticate, requireRole("admin"))` inside it intercepts every request — even those meant for completely different routers — and returns 403 before they can reach the correct handler.

## How to Apply
In `routes/index.ts`:
```ts
router.use("/admin", authenticate, requireRole("admin"), adminRouter);
router.use("/mt5", authenticate, mt5Router);
```
Inside the sub-routers, define routes without the prefix:
```ts
router.get("/dashboard", handler);   // matches /admin/dashboard
router.get("/accounts", handler);    // matches /mt5/accounts
```
Health and auth routers are mounted without prefix because they have no conflicting middleware.
