#!/usr/bin/env node
import fs from 'fs';
import crypto from 'crypto';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return chunks.join('');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node scripts/gen_hmac.js <secret> [payload.json]');
    process.exit(1);
  }
  const secret = args[0];
  let payload = '';
  if (args[1]) {
    payload = fs.readFileSync(args[1], 'utf8');
  } else {
    payload = await readStdin();
  }

  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  console.log(sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
