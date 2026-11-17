const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.QUESTION_BANK_PATH = path.join(os.tmpdir(), `quiz-bank-${process.pid}.json`);
process.env.GROQ_API_KEY = 'test-key';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;
delete process.env.EMBEDDING_API_URL;
delete process.env.EMBEDDING_API_KEY;
process.env.SUPABASE_URL = '';
process.env.SUPABASE_KEY = '';
process.env.EMBEDDING_API_URL = '';
process.env.EMBEDDING_API_KEY = '';

const test = require('node:test');
const assert = require('node:assert/strict');
const { withServer } = require('./with-server');
const { normalizeStoredItem, createFileStore } = require('../lib/bank-store');

const bankPath = process.env.QUESTION_BANK_PATH;
const modelContent = '{"question":"Nova?","options":["a","b","c","d","e"],"correctIndex":1,"explanation":"porque"}';
const originalFetch = global.fetch;
const groqBodies = [];

global.fetch = async (url, options) => {
  const href = typeof url === 'string' ? url : String(url && url.url ? url.url : url);
  if (href.includes('api.groq.com')) {
    groqBodies.push(options && options.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: modelContent } }] };
      },
      async text() {
        return '';
      },
    };
  }
  return originalFetch(url, options);
};

test.after(() => {
  global.fetch = originalFetch;
  fs.rmSync(bankPath, { force: true });
});

function lastPrompt() {
  const raw = groqBodies[groqBodies.length - 1];
  const parsed = JSON.parse(raw);
  const message = parsed.messages.find((entry) => entry.role === 'user');
  return message.content;
}

async function postJson(base, route, payload) {
  const response = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Connection: 'close' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { status: response.status, body };
}

const bankRequest = {
  mode: 'bank',
  serie: 4,
  assunto: 'Matemática',
  tematica: 'futebol',
  dificuldade: 'médio',
};

test('geração livre do médio não devolve sourceIds', async () => {
  await withServer(async (base) => {
    const { status, body } = await postJson(base, '/api/generate-question', {
      serie: 11,
      assunto: 'História',
      tematica: 'futebol',
      dificuldade: 'médio',
    });
    assert.equal(status, 200);
    assert.equal(Object.hasOwn(body, 'sourceIds'), false);
    assert.equal(body.question, 'Nova?');
    assert.deepEqual(body.options, ['a', 'b', 'c', 'd', 'e']);
    assert.equal(body.correctIndex, 1);
    assert.equal(body.explanation, 'porque');
    const prompt = lastPrompt();
    const request = JSON.parse(groqBodies[groqBodies.length - 1]);
    assert.equal(request.model, 'openai/gpt-oss-120b');
    assert.equal(request.temperature, 0.8);
    assert.equal(request.max_tokens, 1024);
    assert.equal(request.reasoning_effort, 'low');
    assert.equal(request.include_reasoning, false);
    assert.match(prompt, /2º ano do médio/);
    assert.doesNotMatch(prompt, /ensino fundamental/);
  });
});

test('banco vazio responde bank_empty', async () => {
  fs.writeFileSync(bankPath, '[]');
  await withServer(async (base) => {
    const { status, body } = await postJson(base, '/api/generate-question', bankRequest);
    assert.equal(status, 422);
    assert.equal(body.code, 'bank_empty');
  });
});

test('banco devolve habilidade e ids da família', async () => {
  const item = normalizeStoredItem({
    subject: 'Matemática',
    grade_min: 4,
    grade_max: 5,
    difficulty: 6,
    skill: 'multiplicar dois digitos',
    theme_policy: 'reskin',
    stem: 'Quanto é 12 vezes 11?',
    options: ['132', '121', '122', '112'],
    correct_index: 0,
    explanation: '12 vezes 11 é 132.',
    invariant: { preserve: ['Os dois fatores continuam de dois dígitos.'] },
    distractors: [
      { index: 1, error: 'trocou dezenas' },
      { index: 2, error: 'somou' },
      { index: 3, error: 'subtraiu' },
    ],
    origin: 'public',
    source_label: 'livro',
    status: 'usable',
  }, { id: 'item-mult', created_at: '2026-11-16T00:00:00.000Z' });
  await createFileStore(bankPath).upsert(item);

  await withServer(async (base) => {
    const { status, body } = await postJson(base, '/api/generate-question', bankRequest);
    assert.equal(status, 200);
    assert.equal(body.mode, 'bank');
    assert.equal(body.skill, item.skill);
    assert.ok(body.sourceIds.includes(item.id));
    assert.match(lastPrompt(), /multiplicar dois digitos/);
    const request = JSON.parse(groqBodies[groqBodies.length - 1]);
    assert.equal(request.model, 'openai/gpt-oss-120b');
    assert.equal(request.temperature, 0.4);
    assert.equal(request.max_tokens, 1024);
    assert.equal(request.reasoning_effort, 'low');
    assert.equal(request.include_reasoning, false);
  });
});

test('série inválida no banco responde invalid_request sem chamar o Groq', async () => {
  const callsBefore = groqBodies.length;
  await withServer(async (base) => {
    const { status, body } = await postJson(base, '/api/generate-question', {
      mode: 'bank',
      serie: 99,
      assunto: 'Matemática',
      tematica: 'futebol',
      dificuldade: 'médio',
    });
    assert.equal(status, 400);
    assert.equal(body.code, 'invalid_request');
    assert.equal(groqBodies.length, callsBefore);
  });
});

test('banco ausente responde bank_unavailable', async () => {
  fs.rmSync(bankPath, { force: true });
  await withServer(async (base) => {
    const { status, body } = await postJson(base, '/api/generate-question', bankRequest);
    assert.equal(status, 503);
    assert.equal(body.code, 'bank_unavailable');
  });
});

test('salvar quiz não cria o arquivo do banco', async () => {
  fs.rmSync(bankPath, { force: true });
  const filename = `route-test-quiz-${process.pid}`;
  const quizPath = path.join(__dirname, '..', 'quiz_jsons', `${filename}.json`);
  const listPath = path.join(__dirname, '..', 'quiz_jsons', 'list.json');
  const originalList = fs.existsSync(listPath) ? fs.readFileSync(listPath) : null;
  assert.equal(fs.existsSync(bankPath), false);
  try {
    await withServer(async (base) => {
      const { status } = await postJson(base, '/api/save-quiz', {
        quiz: {
          name: 'T',
          questions: [{ question: 'Q', options: ['a', 'b', 'c', 'd', 'e'], correctIndex: 0 }],
        },
        filename,
      });
      assert.equal(status, 200);
      assert.equal(fs.existsSync(bankPath), false);
    });
  } finally {
    fs.rmSync(quizPath, { force: true });
    if (originalList) fs.writeFileSync(listPath, originalList);
    else fs.rmSync(listPath, { force: true });
  }
});
