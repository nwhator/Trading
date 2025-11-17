// api/webhook.js
import crypto from 'crypto';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';

export const config = {
  runtime: 'nodejs18.x',
};

function buildCompact(payload) {
  return {
    source: 'tradingview',
    recv_at: new Date().toISOString(),
    action: payload.action || payload.signal || payload.type || null,
    signal: payload.signal || null,
    symbol: payload.ticker || payload.symbol || null,
    interval: payload.interval || null,
    price: payload.price || payload.close || null,
    time: payload.time || null,
  };
}

function verifyHmac(rawBody, secret, headerSig) {
  if (!secret || !headerSig || !rawBody) return false;
  try {
    // Accept header like "sha256=<hex>" or raw hex
    const sig = headerSig.startsWith('sha256=') ? headerSig.slice(7) : headerSig;
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(sig, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const n = Math.min(100, parseInt(req.query.n || '10', 10));
    try {
      const { data, error } = await supabase
        .from('signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(n);
      if (error) throw error;
      return res.status(200).json({ ok: true, count: data.length, data });
    } catch (e) {
      console.error('fetch latest err', e);
      return res.status(500).json({ ok: false, error: 'db_error' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  // Attempt to capture raw body for HMAC verification. If body was parsed already,
  // fallback to JSON.stringify(req.body). Note: exact raw bytes are required for HMAC,
  // so when using HMAC make sure the sender computes over the exact same bytes.
  let rawBody = '';
  try {
    rawBody = await new Promise((resolve) => {
      let s = '';
      let received = false;
      req.on && req.on('data', (c) => { received = true; s += c; });
      req.on && req.on('end', () => resolve(s));
      // if stream events never fire (platform already parsed body), timeout shortly
      setTimeout(() => resolve(received ? s : ''), 25);
    });
  } catch (e) {
    rawBody = '';
  }

  let payload = {};
  if (rawBody) {
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (e) {
      console.error('body parse error', e);
      return res.status(400).json({ ok: false, error: 'invalid_json' });
    }
  } else if (req.body) {
    payload = req.body;
    try {
      rawBody = JSON.stringify(req.body);
    } catch (e) {
      rawBody = '';
    }
  }

  const headerToken = req.headers['x-tv-secret'] || req.headers['x-secret'];
  const headerSig = req.headers['x-tv-signature'] || req.headers['x-signature'] || req.headers['x-hub-signature'];

  if (process.env.WEBHOOK_SECRET) {
    let valid = false;
    // 1) signature header (HMAC)
    if (headerSig && rawBody) {
      valid = verifyHmac(rawBody, process.env.WEBHOOK_SECRET, headerSig);
    }
    // 2) plain header token
    if (!valid && headerToken && headerToken === process.env.WEBHOOK_SECRET) valid = true;
    // 3) secret in JSON body
    if (!valid && payload && payload.secret && payload.secret === process.env.WEBHOOK_SECRET) valid = true;

    if (!valid) return res.status(401).json({ ok: false, error: 'invalid_secret' });
  }

  try {
    const compact = buildCompact(payload);

    const toInsert = {
      source: compact.source,
      symbol: compact.symbol,
      action: compact.action,
      signal: compact.signal,
      interval: compact.interval,
      price: compact.price,
      time: compact.time,
      raw: process.env.STORE_RAW === 'true' ? payload : null,
    };

    const { error: insertErr } = await supabase.from('signals').insert(toInsert);
    if (insertErr) {
      console.error('supabase insert error', insertErr);
    }

    if (process.env.VESSEL_URL) {
      try {
        await axios.post(process.env.VESSEL_URL, compact, {
          headers: {
            'content-type': 'application/json',
            'x-forwarded-by': 'tv-webhook-vercel',
          },
          timeout: 7000,
        });
      } catch (fwdErr) {
        console.error('forward to vessel failed', fwdErr?.message || fwdErr);
      }
    }

    return res.status(200).json({ ok: true, saved: true, symbol: compact.symbol, action: compact.action });
  } catch (err) {
    console.error('handler err', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
