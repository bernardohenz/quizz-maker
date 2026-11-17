const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExtractPrompt, parseExtraction, parseImageDataUrl } = require('../lib/extract-question');

test('prompt pede transcrição fiel', () => {
  const prompt = buildExtractPrompt();
  assert.match(prompt, /transcreva/);
  assert.match(prompt, /não crie alternativa/i);
});

test('enunciado ausente falha na leitura', () => {
  assert.throws(
    () => parseExtraction(JSON.stringify({ transcription: { options: ['3', '4'] } })),
    (error) => error.message === 'Não foi possível ler a questão na foto.',
  );
});

test('gabarito ausente continua nulo', () => {
  const parsed = parseExtraction(JSON.stringify({
    transcription: { stem: 'Quanto é 2 + 2?', options: ['3', '4', '5', '6'] },
    suggestions: { skill: 'somar' },
  }));
  assert.equal(parsed.transcription.correct_index, null);
  assert.equal(parsed.transcription.options.length, 4);
  assert.equal(parsed.suggestions.skill, 'somar');
});

test('recusa imagem que não é data URL de jpeg, png ou webp', () => {
  assert.throws(() => parseImageDataUrl('data:text/plain;base64,YQ=='), (error) => error.code === 'invalid_image');
});

test('recusa imagem acima de 8 MB', () => {
  const huge = Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64');
  assert.throws(() => parseImageDataUrl(`data:image/png;base64,${huge}`), (error) => error.code === 'invalid_image');
});