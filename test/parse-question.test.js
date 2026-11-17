const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQuizQuestion, extractJsonObject } = require('../lib/parse-question');

test('extrai JSON de uma cerca markdown', () => {
  const parsed = parseQuizQuestion('```json\n{"question":"Q?","options":["a","b","c","d","e"],"correctIndex":2,"explanation":"porque"}\n```');
  assert.equal(parsed.question, 'Q?');
  assert.equal(parsed.correctIndex, 2);
  assert.equal(parsed.options.length, 5);
});

test('extrai o primeiro objeto mesmo com texto em volta', () => {
  const parsed = extractJsonObject('segue {"transcription":{"stem":"Q?"}} obrigado');
  assert.equal(parsed.transcription.stem, 'Q?');
});

test('preenche explicação vazia e índice inválido', () => {
  const parsed = parseQuizQuestion('{"question":"Q?","options":["a","b","c","d","e"],"correctIndex":9}');
  assert.equal(parsed.correctIndex, 0);
  assert.equal(parsed.explanation, 'Boa resposta!');
});

test('rejeita questão sem cinco alternativas', () => {
  assert.throws(
    () => parseQuizQuestion('{"question":"Q?","options":["a","b","c","d"]}'),
    /Formato inválido/
  );
});