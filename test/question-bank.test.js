const test = require('node:test');
const assert = require('node:assert/strict');
const { retrieveFamily } = require('../lib/question-bank');

function item(overrides = {}) {
  return {
    id: 'q-default',
    subject: 'Matemática',
    grade_min: 4,
    grade_max: 5,
    difficulty: 6,
    theme_policy: 'reskin',
    origin: 'public',
    source_label: 'livro',
    status: 'usable',
    skill: 'multiplicar',
    stem: 'enunciado',
    ...overrides,
  };
}

function query(overrides = {}) {
  return {
    subject: 'Matemática',
    gradeIndex: 4,
    difficultyTarget: 6,
    ...overrides,
  };
}

test('pedido do 4º ano descarta série 10–12 e rascunho', () => {
  const kept = item({ id: 'kept' });
  const medio = item({ id: 'medio', grade_min: 10, grade_max: 12 });
  const draft = item({ id: 'draft', status: 'draft' });
  const result = retrieveFamily([medio, draft, kept], query(), () => 0);
  assert.equal(result.empty, false);
  assert.equal(result.family.length, 1);
  assert.equal(result.family[0].id, 'kept');
  assert.equal(result.skill, 'multiplicar');
  assert.deepEqual(result.sourceIds, ['kept']);
});

test('origem gerada e rótulo em branco são descartados', () => {
  const kept = item({ id: 'kept' });
  const generated = item({ id: 'gerada', origin: 'gerada' });
  const blank = item({ id: 'blank', source_label: '   ' });
  const result = retrieveFamily([generated, blank, kept], query(), () => 0);
  assert.equal(result.family.length, 1);
  assert.equal(result.family[0].id, 'kept');
  assert.ok(!result.sourceIds.includes('gerada'));
  assert.ok(!result.sourceIds.includes('blank'));
});

test('janela cresce de ±1 até ±2 e a âncora é a distância 1', () => {
  const low = item({ id: 'd2-low', difficulty: 4, skill: 'multiplicar', theme_policy: 'reskin' });
  const high = item({ id: 'd2-high', difficulty: 8, skill: 'multiplicar', theme_policy: 'reskin' });
  const near = item({ id: 'd1', difficulty: 5, skill: 'multiplicar', theme_policy: 'reskin' });
  const outside = item({
    id: 'd3',
    difficulty: 3,
    skill: 'multiplicar',
    theme_policy: 'reskin',
    stem: 'outro enunciado',
  });
  const result = retrieveFamily([low, high, near, outside], query(), () => 0);
  assert.equal(result.family[0].id, 'd1');
  assert.ok(result.sourceIds.includes('d2-low'));
  assert.ok(result.sourceIds.includes('d2-high'));
  assert.ok(!result.sourceIds.includes('d3'));
});

test('só a distância 3 entra e a distância 4 fica de fora', () => {
  const farther = item({ id: 'd4', difficulty: 2, skill: 'multiplicar', theme_policy: 'reskin' });
  const edge = item({ id: 'd3', difficulty: 3, skill: 'multiplicar', theme_policy: 'reskin' });
  const result = retrieveFamily([farther, edge], query(), () => 0);
  assert.equal(result.family.length, 1);
  assert.equal(result.family[0].id, 'd3');
  assert.ok(!result.sourceIds.includes('d4'));
});

test('único id na faixa e na lista de exclusão devolve família vazia', () => {
  const only = item({ id: 'only' });
  const result = retrieveFamily([only], query({ excludeIds: ['only'] }), () => 0);
  assert.deepEqual(result, { empty: true, family: [] });
});

test('habilidades diferentes formam família de um', () => {
  const multiply = item({ id: 'mul', skill: 'multiplicar' });
  const add = item({ id: 'add', skill: 'somar' });
  const result = retrieveFamily([multiply, add], query(), () => 0);
  assert.equal(result.family.length, 1);
});

test('quatro itens da mesma habilidade e política formam família de três', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => item({
    id,
    skill: 'multiplicar',
    theme_policy: 'reskin',
    difficulty: 6,
  }));
  const result = retrieveFamily(items, query(), () => 0);
  assert.equal(result.family.length, 3);
});

test('theme_policy diferente não entra como irmão', () => {
  const anchor = item({ id: 'anchor', difficulty: 6, skill: 'multiplicar', theme_policy: 'reskin' });
  const wording = item({ id: 'wording', difficulty: 6, skill: 'multiplicar', theme_policy: 'wording' });
  const sibling = item({ id: 'sibling', difficulty: 7, skill: 'multiplicar', theme_policy: 'reskin' });
  const result = retrieveFamily([anchor, wording, sibling], query(), () => 0);
  assert.equal(result.family[0].id, 'anchor');
  assert.ok(result.sourceIds.includes('sibling'));
  assert.ok(!result.sourceIds.includes('wording'));
});
