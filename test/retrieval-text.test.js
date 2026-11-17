const test = require('node:test');
const assert = require('node:assert/strict');
const { retrievalText } = require('../lib/retrieval-text');

test('o texto da busca junta habilidade, etiquetas e enunciado', () => {
  const text = retrievalText({
    skill: 'Interpretar used to',
    skill_tags: ['used to', 'hábito'],
    stem: 'Bob used to go scuba diving.',
  });
  assert.equal(text, 'Habilidade: Interpretar used to\nEtiquetas: used to, hábito\nBob used to go scuba diving.');
});
