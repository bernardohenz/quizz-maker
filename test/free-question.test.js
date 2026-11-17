const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFreePrompt } = require('../lib/free-question');

test('médio usa o rótulo e o estágio', () => {
  const prompt = buildFreePrompt({ serie: 11, assunto: 'História', tematica: 'futebol', dificuldade: 'médio' });
  assert.match(prompt, /2º ano do médio/);
  assert.match(prompt, /ensino médio/);
  assert.doesNotMatch(prompt, /ensino fundamental/);
  assert.doesNotMatch(prompt, /13º ano/);
});

test('pós-médio não vira 13º ano', () => {
  const prompt = buildFreePrompt({ serie: 13, assunto: 'Biologia', tematica: 'oceano', dificuldade: 'fácil', nota: 'usar um gráfico' });
  assert.match(prompt, /Pós-médio/);
  assert.match(prompt, /pós-médio/);
  assert.match(prompt, /usar um gráfico/);
  assert.doesNotMatch(prompt, /13º ano/);
});