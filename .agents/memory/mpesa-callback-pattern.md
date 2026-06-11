---
name: M-Pesa Callback Pattern
description: The correct pattern for handling Safaricom STK push callbacks — respond first, process async.
---

Safaricom's Daraja API requires a 200 OK response within a short timeout or it retries the callback.

**Rule:** Always `res.status(200).json(...)` *before* any async DB or CopyFactory work. Use `void promise.then(...).catch(...)` to process in the background.

**Why:** DB queries or CopyFactory API calls can take 1–3+ seconds. If the response is delayed, Safaricom retries, causing duplicate processing. The `isValidCallback()` check before queueing async work guards against malformed payloads.

**How to apply:**
```ts
router.post("/mpesa/callback", (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" }); // respond first
  if (!mpesaService.isValidCallback(req.body)) return;
  void paymentService.handleCallback(req.body).catch(logger.error);
});
```

The `handleCallback` method is idempotent — it checks `payment.status === "completed" | "failed"` and exits early on duplicates.

**Required env vars:** `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`, `MPESA_ENV` (sandbox|production).
