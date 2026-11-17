const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const { getBankStore } = require('../lib/bank-store');
const { embedText } = require('../lib/embeddings');
const { retrievalText } = require('../lib/retrieval-text');

function hasVector(value) {
  return Array.isArray(value) && value.some((entry) => entry !== 0);
}

async function main() {
  const store = getBankStore();
  const items = await store.listAll();
  let updated = 0;
  let skipped = 0;
  for (const item of items) {
    if (!item || item.status !== 'usable' || hasVector(item.embedding)) {
      skipped += 1;
      continue;
    }
    const embedding = await embedText(retrievalText(item));
    if (!embedding) throw new Error('Embedding indisponível');
    await store.upsert({ ...item, embedding });
    updated += 1;
    if (updated % 20 === 0) console.log(JSON.stringify({ updated }));
  }
  console.log(JSON.stringify({ updated, skipped, total: items.length }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
