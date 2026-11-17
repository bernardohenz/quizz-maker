const test = require('node:test');
const assert = require('node:assert/strict');
const { cosine } = require('../lib/question-bank');
const { fitStoredDimension, STORED_DIMENSIONS } = require('../lib/embeddings');

test('vetor curto ocupa o início das 1536 dimensões e o cosseno se mantém', () => {
  const storedA = fitStoredDimension([1, 0]);
  const storedB = fitStoredDimension([0, 1]);
  assert.equal(storedA.length, STORED_DIMENSIONS);
  assert.equal(storedA[0], 1);
  assert.equal(storedA[2], 0);
  assert.equal(cosine(storedA, storedA), 1);
  assert.equal(cosine(storedA, storedB), 0);
});
