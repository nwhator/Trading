```markdown
(# TradingView Webhook (local testing & deployment)

This repository exposes a webhook at `/api/webhook` that accepts TradingView alerts, optionally verifies an HMAC or token, and stores signals in Supabase.

**Quick Summary**
- **Endpoint**: `/api/webhook`
- **HMAC header**: `x-tv-signature` (hex; optionally prefixed with `sha256=`)
- **Plain token header**: `x-tv-secret` (fallback)
- **Env var**: set `WEBHOOK_SECRET` in your environment or Vercel project to enable verification.

**Local testing**

1. Install dependencies and dev tools:

```bash
npm install
# Install Vercel CLI if you want serverless-local behavior
npm i -g vercel
```

2. Start the local dev server (runs your serverless API locally):

```bash
npm start
# Vercel dev serves at http://127.0.0.1:3000 by default
```

3. Prepare a payload file, e.g. `payload.json`:

```json
{
  "ticker": "BINANCE:BTCUSDT",
  "signal": "buy",
  "price": 50000,
  "time": "2025-01-01T00:00:00Z",
  "secret": "my-local-secret"  
}
```

4. Generate HMAC (optional) using the included helper:

```bash
node scripts/gen_hmac.js my-local-secret payload.json
# -> prints hex signature
```

5. Send a test request to the local webhook (example with HMAC header):

```bash
SIG=$(node scripts/gen_hmac.js my-local-secret payload.json)
curl -v \
  -H "Content-Type: application/json" \
  -H "x-tv-signature: sha256=$SIG" \
  --data @payload.json \
  http://127.0.0.1:3000/api/webhook
```

If you used `secret` in the JSON body instead of headers (TradingView doesn't support custom headers), the endpoint will accept that as a fallback when `WEBHOOK_SECRET` is set.

**Testing from TradingView**

- TradingView alerts send a JSON body but do not let you set custom HTTP headers. To authenticate from TradingView you have two main choices:
  - Put a `secret` field in the JSON body (supported by this endpoint as a fallback).
  - Use a proxy service (or a small server) that adds the `x-tv-signature` header before forwarding to this endpoint.

- Example TradingView webhook message (paste into the Alert -> Webhook message):

```json
{"ticker":"BINANCE:BTCUSDT","signal":"buy","price":50000,"time":"{{t}}","secret":"my-vercel-secret"}
```

Then set `WEBHOOK_SECRET` in your Vercel project to `my-vercel-secret`.

**Exposing local server to TradingView (ngrok)**

1. Start local dev: `npm start` (vercel dev)
2. Start ngrok: `ngrok http 3000`
3. Use the forwarded URL from ngrok and append `/api/webhook` in TradingView.

**Deploying to Vercel**

1. In the Vercel dashboard for this project, set the following Environment Variables:
   - `WEBHOOK_SECRET` = your secret
   - `STORE_RAW` = `true` (optional)
   - `VERCEL_URL` = (optional) URL to forward compact payloads to

2. Push changes to the repo and deploy via Vercel or `vercel --prod`.

**Notes about HMAC verification**

- HMAC verification requires the sender to compute the HMAC over the exact bytes the server receives. Serverless platforms sometimes parse and re-serialize bodies; if HMAC verification fails, use the `secret` field in JSON or ensure the sender signs the exact JSON string.

**Next steps / troubleshooting**
- If your Vercel homepage showed a 404, this project now includes `index.html` at the repository root so `/` will serve a static page.
- If the webhook returns `401 invalid_secret` verify `WEBHOOK_SECRET` is set and matches the value sent either in `x-tv-signature` calculation, `x-tv-secret` header, or `secret` JSON field.

If you want, I can:
- update the webhook to make raw-body HMAC verification more robust,
- add a small test harness (node script) to POST test messages with headers,
- or help set up Vercel env vars and verify a deploy.

```
