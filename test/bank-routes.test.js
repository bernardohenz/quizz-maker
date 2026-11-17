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
process.env.EMBEDDING_LOCAL = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const { withServer } = require('./with-server');

const bankPath = process.env.QUESTION_BANK_PATH;
const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const modelContent = '{"transcription":{"stem":"Quanto é 2 + 2?","options":["3","4","5","6"],"correct_index":null,"explanation":""},"suggestions":{"skill":"somar"}}';
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

function lastGroqRequest() {
  return JSON.parse(groqBodies[groqBodies.length - 1]);
}

async function requestJson(base, method, route, payload) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', Connection: 'close' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

const draftItem = {
  status: 'draft',
  origin: 'manual',
  source_label: 'caderno',
  stem: 'Quanto é 2 + 2?',
};

test('foto não grava o banco e devolve a transcrição', async () => {
  fs.rmSync(bankPath, { force: true });
  const callsBefore = groqBodies.length;
  await withServer(async (base) => {
    const { status, body } = await requestJson(base, 'POST', '/api/extract-question', {
      imageDataUrl: pngDataUrl,
    });
    assert.equal(status, 200);
    assert.equal(body.transcription.stem, 'Quanto é 2 + 2?');
    assert.equal(fs.existsSync(bankPath), false);
    const request = lastGroqRequest();
    assert.equal(groqBodies.length, callsBefore + 1);
    const { VISION_MODEL } = require('../lib/extract-question');
    assert.equal(request.model, VISION_MODEL);
    assert.equal(request.temperature, 0.1);
    assert.deepEqual(request.response_format, { type: 'json_object' });
    assert.equal(Object.hasOwn(request, 'reasoning_effort'), false);
    assert.equal(Object.hasOwn(request, 'include_reasoning'), false);
    assert.deepEqual(request.messages[0].content, [
      { type: 'text', text: request.messages[0].content[0].text },
      { type: 'image_url', image_url: { url: pngDataUrl } },
    ]);
    assert.equal(typeof request.messages[0].content[0].text, 'string');
    assert.ok(request.messages[0].content[0].text.length > 0);
  });
});

test('data URL que não é imagem responde invalid_image', async () => {
  await withServer(async (base) => {
    const { status, body } = await requestJson(base, 'POST', '/api/extract-question', {
      imageDataUrl: 'data:text/plain;base64,YQ==',
    });
    assert.equal(status, 400);
    assert.equal(body.code, 'invalid_image');
  });
});

test('lista sem status responde 400', async () => {
  await withServer(async (base) => {
    const { status, body } = await requestJson(base, 'GET', '/api/question-bank');
    assert.equal(status, 400);
    assert.equal(body.code, 'invalid_request');
    assert.equal(body.error, 'Informe status=draft ou status=usable');
  });
});

test('item utilizável incompleto responde invalid_item', async () => {
  await withServer(async (base) => {
    const { status, body } = await requestJson(base, 'POST', '/api/question-bank', {
      status: 'usable',
      origin: 'manual',
      source_label: 'caderno',
      stem: 'Quanto é 2 + 2?',
    });
    assert.equal(status, 400);
    assert.equal(body.code, 'invalid_item');
  });
});

test('rascunho é gravado, listado sem embedding, atualizado e apagado', async () => {
  fs.rmSync(bankPath, { force: true });
  await withServer(async (base) => {
    const created = await requestJson(base, 'POST', '/api/question-bank', draftItem);
    assert.equal(created.status, 200);
    assert.equal(typeof created.body.id, 'string');
    assert.match(created.body.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.equal(created.body.embedding, null);
    assert.equal(created.body.status, 'draft');
    assert.equal(created.body.stem, 'Quanto é 2 + 2?');

    const listed = await requestJson(base, 'GET', '/api/question-bank?status=draft');
    assert.equal(listed.status, 200);
    assert.ok(Array.isArray(listed.body));
    assert.equal(listed.body.length, 1);
    assert.equal(listed.body[0].id, created.body.id);
    assert.equal(listed.body[0].stem, 'Quanto é 2 + 2?');
    assert.equal(Object.hasOwn(listed.body[0], 'embedding'), false);

    const updated = await requestJson(base, 'PUT', `/api/question-bank/${created.body.id}`, {
      status: 'draft',
      origin: 'manual',
      source_label: 'caderno',
      stem: 'Quanto é 3 + 3?',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.id, created.body.id);
    assert.equal(updated.body.stem, 'Quanto é 3 + 3?');
    assert.equal(updated.body.created_at, created.body.created_at);
    assert.equal(updated.body.embedding, null);

    const removed = await requestJson(base, 'DELETE', `/api/question-bank/${created.body.id}`);
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body, { removed: true });

    const afterDelete = await requestJson(base, 'GET', '/api/question-bank?status=draft');
    assert.equal(afterDelete.status, 200);
    assert.deepEqual(afterDelete.body, []);

    const missingId = '00000000-0000-4000-8000-000000000000';
    const missingPut = await requestJson(base, 'PUT', `/api/question-bank/${missingId}`, draftItem);
    assert.equal(missingPut.status, 404);
    assert.equal(missingPut.body.code, 'not_found');
    const missingDelete = await requestJson(base, 'DELETE', `/api/question-bank/${missingId}`);
    assert.equal(missingDelete.status, 404);
    assert.equal(missingDelete.body.code, 'not_found');
  });
});
