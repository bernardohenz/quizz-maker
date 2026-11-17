const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdaptPrompt, adaptQuestion } = require('../lib/adapt-question');

const family = [{
  id: 'math-1',
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
}];

test('prompt carrega habilidade, limite, política e tema', () => {
  const prompt = buildAdaptPrompt(family, {
    serie: 4,
    assunto: 'Matemática',
    tematica: 'Pokemon',
    dificuldade: 'médio',
    nota: 'conta de vezes',
  });
  assert.match(prompt, /Multiplicar dois números de um dígito/);
  assert.match(prompt, /Os dois fatores continuam de um dígito/);
  assert.match(prompt, /reskin/);
  assert.match(prompt, /Pokemon/);
  assert.match(prompt, /uma questão nova/);
  assert.match(prompt, /4º ano/);
});

test('família de quatro alternativas pede a quinta como distrator já listado', () => {
  const prompt = buildAdaptPrompt(family, { serie: 4, assunto: 'Matemática', tematica: 'Pokemon', dificuldade: 'médio' });
  assert.match(prompt, /quinta/);
  assert.match(prompt, /tipo de erro já listado/);
});

test('enunciado copiado provoca uma segunda chamada', async () => {
  const calls = [];
  const complete = async () => {
    calls.push(1);
    if (calls.length === 1) {
      return JSON.stringify({
        question: family[0].stem,
        options: ['a', 'b', 'c', 'd', 'e'],
        correctIndex: 0,
        explanation: 'x',
      });
    }
    return JSON.stringify({
      question: 'O Pikachu tem 3 pacotes com 5 frutos. Qual é o total?',
      options: ['8', '12', '15', '18', '20'],
      correctIndex: 2,
      explanation: '3 × 5 = 15.',
    });
  };
  const result = await adaptQuestion(family, { serie: 4, assunto: 'Matemática', tematica: 'Pokemon', dificuldade: 'médio' }, complete);
  assert.equal(calls.length, 2);
  assert.equal(result.correctIndex, 2);
  assert.equal(result.options.length, 5);
});

test('segunda resposta inválida rejeita', async () => {
  await assert.rejects(
    () => adaptQuestion(family, { serie: 4, assunto: 'Matemática', tematica: 'Pokemon', dificuldade: 'médio' }, async () => 'não é json'),
    /formato inválido|Formato inválido/
  );
});
