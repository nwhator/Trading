# HMAC verification (optional)

For stronger security you can enable HMAC verification by computing an HMAC-SHA256
over the raw JSON body using your `WEBHOOK_SECRET` and sending it in the header
`x-tv-signature` as a hex string (optionally prefixed with `sha256=`).

Behavior in the webhook:
- The endpoint checks, in order: header HMAC (`x-tv-signature`), header token
  (`x-tv-secret`), or a `secret` field inside the JSON body.
- If `x-tv-signature` is present the endpoint will attempt to verify it using
  the raw request bytes; if verification fails the request is rejected.

Notes & caveats:
- HMAC requires the sender compute the signature over the exact bytes the
  server receives. On some serverless platforms the request body may be parsed
  and re-serialized before your code sees it. For strict HMAC checks ensure the
  sender signs the same JSON string (including spacing) or use a proxy that
  preserves raw bytes.
- Header examples (preferred when using HMAC):
```
x-tv-signature: sha256=<hex-signature>
x-tv-secret: <optional-plain-token>
```

Testing locally:

1. Save your payload to `payload.json` (the exact string that will be sent).
2. Compute signature:

```bash
node scripts/gen_hmac.js my-super-secret-token payload.json
```

3. Use the resulting hex string in `x-tv-signature` when sending the request.
