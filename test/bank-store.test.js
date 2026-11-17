const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFileStore, normalizeStoredItem } = require('../lib/bank-store');

test('grava, lista e remove no arquivo', async () => {
  const filePath = path.join(os.tmpdir(), `bank-${Date.now()}.json`);
  const store = createFileStore(filePath);
  await assert.rejects(() => store.listAll(), (error) => error.code === 'bank_unavailable');
  const created = await store.upsert(normalizeStoredItem({
    origin: 'manual',
    source_label: 'caderno',
    stem: 'Quanto é 2 + 2?',
    status: 'draft',
  }, { id: 'id-1', created_at: '2026-11-16T00:00:00.000Z' }));
  assert.equal(created.embedding, null);
  const again = await store.upsert({ ...created, stem: 'Quanto é 2 + 3?', created_at: '1999-01-01T00:00:00.000Z' });
  assert.equal(again.created_at, '2026-11-16T00:00:00.000Z');
  assert.equal(again.stem, 'Quanto é 2 + 3?');
  assert.equal((await store.listAll()).length, 1);
  await store.remove('id-1');
  assert.deepEqual(await store.listAll(), []);
  fs.unlinkSync(filePath);
});
