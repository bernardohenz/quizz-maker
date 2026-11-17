const test = require('node:test');
const assert = require('node:assert/strict');
const { gradeLabel, gradeStage, difficultyTarget, SUBJECTS } = require('../lib/grades');

test('rótulos e estágios de série', () => {
  assert.equal(gradeLabel(4), '4º ano');
  assert.equal(gradeStage(4), 'ensino fundamental');
  assert.equal(gradeLabel(11), '2º ano do médio');
  assert.equal(gradeStage(11), 'ensino médio');
  assert.equal(gradeLabel(13), 'Pós-médio');
  assert.equal(gradeStage(13), 'pós-médio');
  assert.equal(gradeLabel(0), null);
  assert.equal(gradeStage(14), null);
});

test('alvo de dificuldade', () => {
  assert.deepEqual(
    ['muito fácil', 'fácil', 'médio', 'difícil', 'muito difícil'].map(difficultyTarget),
    [2, 4, 6, 8, 10]
  );
  assert.equal(difficultyTarget('outro'), null);
});

test('assuntos incluem Física, Química e Biologia', () => {
  for (const subject of ['Matemática', 'Português', 'Geografia', 'História', 'Ciências', 'Inglês', 'Física', 'Química', 'Biologia']) {
    assert.ok(SUBJECTS.includes(subject));
  }
});