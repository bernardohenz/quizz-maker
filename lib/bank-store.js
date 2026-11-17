const fs = require('node:fs/promises');
const path = require('node:path');

const TABLE = 'question_bank';

function bankError(message) {
  const error = new Error(message);
  error.code = 'bank_unavailable';
  return error;
}

function normalizeStoredItem(input, { id, created_at }) {
  const source = input && typeof input === 'object' ? input : {};
  const preserve = source.invariant && Array.isArray(source.invariant.preserve)
    ? source.invariant.preserve
    : [];
  const sourceLabel = typeof source.source_label === 'string'
    ? source.source_label.trim()
    : (source.source_label ?? null);
  return {
    id,
    subject: source.subject ?? null,
    grade_min: source.grade_min ?? null,
    grade_max: source.grade_max ?? null,
    difficulty: source.difficulty ?? null,
    skill: source.skill ?? null,
    skill_tags: Array.isArray(source.skill_tags) ? source.skill_tags : [],
    theme_policy: source.theme_policy ?? null,
    stem: source.stem ?? null,
    options: Array.isArray(source.options) ? source.options : [],
    correct_index: Number.isInteger(source.correct_index) ? source.correct_index : null,
    explanation: source.explanation ?? null,
    invariant: { preserve },
    distractors: Array.isArray(source.distractors) ? source.distractors : [],
    embedding: null,
    origin: source.origin ?? null,
    source_label: sourceLabel,
    status: source.status ?? null,
    created_at,
  };
}

async function readItems(filePath, { allowMissing }) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      if (allowMissing) return [];
      throw bankError('Banco indisponível');
    }
    throw bankError('Falha ao ler o banco');
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('invalid bank file');
    return parsed;
  } catch (error) {
    if (error && error.code === 'bank_unavailable') throw error;
    throw bankError('Falha ao ler o banco');
  }
}

async function writeItems(filePath, items) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

function createFileStore(filePath) {
  return {
    listAll() {
      return readItems(filePath, { allowMissing: false });
    },
    async upsert(item) {
      const items = await readItems(filePath, { allowMissing: true });
      const index = items.findIndex((entry) => entry && entry.id === item.id);
      const saved = {
        ...item,
        created_at: index >= 0 ? items[index].created_at : item.created_at,
      };
      if (index >= 0) items[index] = saved;
      else items.push(saved);
      await writeItems(filePath, items);
      return saved;
    },
    async remove(id) {
      const items = await readItems(filePath, { allowMissing: false });
      const next = items.filter((entry) => !entry || entry.id !== id);
      await writeItems(filePath, next);
      return { removed: next.length !== items.length };
    },
  };
}

function parseEmbedding(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw bankError('Falha ao ler o banco');
  }
}

async function query(run) {
  try {
    const result = await run();
    if (!result || result.error) throw bankError('Falha ao ler o banco');
    return result.data;
  } catch (error) {
    if (error && error.code === 'bank_unavailable') throw error;
    throw bankError('Falha ao ler o banco');
  }
}

const BANK_COLUMNS = 'id, subject, grade_min, grade_max, difficulty, skill, skill_tags, theme_policy, stem, options, correct_index, explanation, invariant, distractors, embedding, origin, source_label, status, created_at';

function embeddingForRow(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.some((entry) => typeof entry !== 'number' || Number.isNaN(entry))) return null;
  return `[${value.join(',')}]`;
}

function createSupabaseStore(client) {
  return {
    async listAll() {
      const rows = await query(() => client.from(TABLE).select(BANK_COLUMNS));
      return (rows || []).map((row) => ({
        ...row,
        embedding: parseEmbedding(row.embedding),
      }));
    },
    async upsert(item) {
      const existing = await query(() => (
        client.from(TABLE).select('created_at').eq('id', item.id).maybeSingle()
      ));
      const row = {
        ...item,
        embedding: embeddingForRow(item.embedding),
        created_at: existing ? existing.created_at : item.created_at,
      };
      const saved = await query(() => (
        client.from(TABLE).upsert(row, { onConflict: 'id' }).select(BANK_COLUMNS).maybeSingle()
      ));
      return saved || row;
    },
    async remove(id) {
      const rows = await query(() => client.from(TABLE).delete().eq('id', id).select());
      const deleted = Array.isArray(rows) ? rows : (rows ? [rows] : []);
      return { removed: deleted.length > 0 };
    },
  };
}

function supabaseSecretKey() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret && secret.trim() !== '' ? secret.trim() : '';
}

function getBankStore() {
  if (process.env.QUESTION_BANK_PATH) {
    return createFileStore(process.env.QUESTION_BANK_PATH);
  }
  const secret = supabaseSecretKey();
  if (process.env.SUPABASE_URL && secret) {
    const { createClient } = require('@supabase/supabase-js');
    return createSupabaseStore(createClient(process.env.SUPABASE_URL, secret));
  }
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    return createSupabaseStore(createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY));
  }
  return createFileStore(path.join(process.cwd(), 'question_bank', 'items.json'));
}

module.exports = {
  normalizeStoredItem,
  createFileStore,
  createSupabaseStore,
  getBankStore,
};
