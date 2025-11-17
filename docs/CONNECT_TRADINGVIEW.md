# Connect TradingView to this Webhook

This guide walks you through connecting TradingView alerts to the `/api/webhook` endpoint in this project, how to authenticate (HMAC or secret), and how to test locally with `vercel dev` and `ngrok`.

**Prerequisites**
- Node.js and `npm` installed.
- `vercel` CLI (optional, recommended for local serverless testing).
- `ngrok` (optional, for exposing local dev to TradingView).
- This repository checked out and dependencies installed: `npm install`.
- If you want to store signals, set up a Supabase project and provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or anon key) in environment variables.

## 1) Prepare the project

Install dependencies and start local dev:

```bash
npm install
npm start
# vercel dev runs a local server (default http://127.0.0.1:3000)
```

Notes:
- The local dev server exposes the serverless API at `/api/webhook`.
- If `index.html` is present at the repo root, `/` will serve a simple homepage.

## 2) Decide authentication method

This repo accepts three ways to authenticate incoming alerts when `WEBHOOK_SECRET` is set:

- HMAC header: `x-tv-signature` — hex signature of the raw JSON body (optionally prefixed with `sha256=`).
- Plain header token: `x-tv-secret` — a shared secret sent as a header.
- JSON field: include `"secret":"<your-secret>"` inside the webhook JSON body (most convenient for TradingView).

Because TradingView's alert webhook UI cannot add custom HTTP headers, the easiest option is to include a `secret` field in the JSON and set `WEBHOOK_SECRET` in your deployed environment.

## 3) Set environment variables (local & Vercel)

Local (example, for bash):

```bash
export WEBHOOK_SECRET="my-vercel-secret"
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_KEY="your-supabase-key"
```

On Vercel:
- Open your project settings -> Environment Variables and add `WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_KEY`, and optionally `STORE_RAW=true`.

## 4) Create a sample payload

Save this as `payload.json` locally. This is the exact JSON you will send (or paste into TradingView Alert message when creating alerts):

```json
{
  "ticker": "BINANCE:BTCUSDT",
  "signal": "buy",
  "price": 50000,
  "time": "2025-01-01T00:00:00Z",
  "secret": "my-vercel-secret"
}
```

Replace `my-vercel-secret` with the actual secret you configured.

## 5) (Optional) Generate HMAC for header-based verification

If you prefer header-based HMAC verification (not possible directly from TradingView), compute the HMAC over the exact bytes of `payload.json` using the included helper:

```bash
node scripts/gen_hmac.js my-vercel-secret payload.json
# prints the hex signature
```

You can then send a test with the header `x-tv-signature: sha256=<hex>`.

## 6) Test locally with curl

Use `curl` to test the webhook locally (this mirrors what TradingView will POST):

```bash
curl -v \
  -H "Content-Type: application/json" \
  --data @payload.json \
  http://127.0.0.1:3000/api/webhook
```

If `WEBHOOK_SECRET` is set, the endpoint expects either the JSON `secret` field to match, or an HMAC/header match as described above.

## 7) Expose local server to TradingView with ngrok

1. Start `vercel dev` (already running on port 3000 by default).
2. Run ngrok:

```bash
ngrok http 3000
```

3. Copy the forwarding URL (e.g. `https://abcd1234.ngrok.io`) and append `/api/webhook`.

4. In TradingView (Alert -> Webhook URL), paste the ngrok URL + `/api/webhook`.

## 8) Create the TradingView alert

1. On TradingView, open the chart and create an Alert.
2. In the Alert dialog, enable `Webhook URL` and paste the webhook URL you prepared (ngrok URL or your Vercel URL + `/api/webhook`).
3. In the `Message` field, paste the exact JSON you saved in `payload.json`. Example:

```
{"ticker":"BINANCE:BTCUSDT","signal":"buy","price":50000,"time":"{{t}}","secret":"my-vercel-secret"}
```

4. Save the alert. When it triggers, TradingView will POST the JSON message to your webhook.

Notes:
- Use TradingView template variables like `{{ticker}}` and `{{close}}` to insert dynamic values into your message.
- Because TradingView will reformat the body (and you may not control whitespace), if you rely on HMAC header verification you must ensure the HMAC is computed over the exact string TradingView sends — this is error-prone. Using the JSON `secret` field is more reliable for direct TradingView -> webhook connections.

## 9) Verify receipt and storage

- If the webhook succeeds, it returns `200` with `{ ok: true, saved: true }` (and records the signal in Supabase if configured).
- Check Supabase `signals` table (or your configured database) to confirm the record arrived.

## 10) Troubleshooting

- `401 invalid_secret`: Check `WEBHOOK_SECRET` value and ensure the incoming JSON `secret` or header/signature matches.
- `400 invalid_json`: Ensure the payload sent is valid JSON.
- HMAC failures: remember the HMAC must be computed over the exact bytes the server receives. For TradingView, prefer the JSON `secret` fallback unless you proxy and add headers.

## 11) Next steps (automation)

- To automate live trades, add an executor module (e.g. `lib/executor.js`) that converts `signal` -> order and calls exchange APIs. Include a `dry-run`/`sandbox` mode and strict safety limits (idempotency, max order size, kill-switch).
- I can add a `scripts/test_webhook.js` harness to simulate TradingView POSTs (with/without HMAC) and a sandbox executor. Tell me if you'd like me to add that now and which exchange to support first.

---

File references: `api/webhook.js`, `scripts/gen_hmac.js`, `index.html`, and this guide `docs/CONNECT_TRADINGVIEW.md`.
