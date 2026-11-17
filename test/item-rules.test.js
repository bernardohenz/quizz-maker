const test = require('node:test');
const assert = require('node:assert/strict');
require('../lib/grades');
const { draftErrors, usableErrors } = require('../lib/item-rules');

function usableItem() {
  return {
    origin: 'public',
    source_label: 'https://exemplo.test/q1',
    subject: 'Matemática',
    grade_min: 4,
    grade_max: 5,
    difficulty: 4,
    skill: 'Multiplicar dois números de um dígito',
    theme_policy: 'reskin',
    stem: 'Uma pessoa tem 3 pacotes com 5 itens. Qual é o total?',
    options: ['8', '12', '15', '18'],
    correct_index: 2,
    explanation: '3 × 5 = 15.',
    invariant: { preserve: ['Os dois fatores continuam de um dígito.'] },
    distractors: [
      { index: 0, error: 'soma' },
      { index: 1, error: 'tabuada próxima' },
      { index: 3, error: 'tabuada próxima' },
    ],
  };
}

test('rascunho pede procedência e enunciado', () => {
  assert.deepEqual(draftErrors({ origin: 'manual', source_label: 'caderno', stem: 'Quanto é 2 + 2?' }), []);
  assert.ok(draftErrors({ origin: 'gerada', source_label: 'caderno', stem: 'Quanto é 2 + 2?' }).includes('origin'));
  assert.ok(draftErrors({ origin: 'manual', source_label: '  ', stem: 'Quanto é 2 + 2?' }).includes('source_label'));
  assert.ok(draftErrors({ origin: 'manual', source_label: 'caderno', stem: '' }).includes('stem'));
});

test('utilizável exige o item completo e aceita quatro alternativas', () => {
  assert.deepEqual(usableErrors(usableItem()), []);
});

test('utilizável recusa três alternativas e gabarito fora da lista', () => {
  const item = usableItem();
  item.options = ['8', '15', '18'];
  item.correct_index = 1;
  const errors = usableErrors(item);
  assert.ok(errors.includes('options'));
});

test('utilizável recusa distrator faltando', () => {
  const item = usableItem();
  item.distractors = [{ index: 0, error: 'soma' }];
  const errors = usableErrors(item);
  assert.ok(errors.some((error) => error.startsWith('distractor_')));
});