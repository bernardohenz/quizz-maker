const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

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

const { createClient } = require('@supabase/supabase-js');
const { normalizeStoredItem } = require('../lib/bank-store');
require('../lib/grades');
const { usableErrors } = require('../lib/item-rules');

const RETURN_COLUMNS = 'id, subject, grade_min, grade_max, difficulty, skill, skill_tags, theme_policy, stem, options, correct_index, explanation, invariant, distractors, origin, source_label, status, created_at';

async function main() {
  const lote = JSON.parse(fs.readFileSync(path.join(root, 'question_bank/revisao/candidatos.json'), 'utf8'));
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!process.env.SUPABASE_URL || !secret) {
    throw new Error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY no .env. A chave anon não pode gravar o banco.');
  }
  const client = createClient(process.env.SUPABASE_URL, secret);
  const existing = await client.from('question_bank').select('stem');
  if (existing.error) {
    throw new Error(existing.error.message);
  }
  const stems = new Set((existing.data || []).map((row) => row.stem));
  let added = 0;
  let skipped = 0;
  for (const item of lote.itens) {
    const errors = usableErrors(item);
    if (errors.length) throw new Error(`${item.review_id}: ${errors.join(', ')}`);
    if (stems.has(item.stem)) {
      skipped += 1;
      continue;
    }
    const row = normalizeStoredItem({ ...item, status: 'usable' }, {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    });
    delete row.embedding;
    const saved = await client.from('question_bank').insert(row).select(RETURN_COLUMNS).single();
    if (saved.error) throw new Error(`${item.review_id}: ${saved.error.message}`);
    added += 1;
  }
  const check = await client.from('question_bank').select('difficulty, source_label');
  if (check.error) throw new Error(check.error.message);
  const obmep = (check.data || []).filter((row) => String(row.source_label).includes('OBMEP'));
  console.log(JSON.stringify({
    added,
    skipped,
    total: check.data.length,
    obmep: obmep.map((row) => row.difficulty),
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
