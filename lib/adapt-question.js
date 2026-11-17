const { parseQuizQuestion } = require('./parse-question');
const { gradeLabel, gradeStage } = require('./grades');

function lines(values) {
  return values.map((value) => `- ${value}`).join('\n');
}

function memberBlock(item) {
  const preserve = item.invariant && Array.isArray(item.invariant.preserve)
    ? item.invariant.preserve
    : [];
  const distractors = Array.isArray(item.distractors) ? item.distractors : [];
  const options = Array.isArray(item.options) ? item.options : [];
  const correctText = options[item.correct_index];

  return [
    `Habilidade: ${item.skill}`,
    `theme_policy: ${item.theme_policy}`,
    `Enunciado: ${item.stem}`,
    'Alternativas:',
    lines(options),
    `Texto da alternativa correta: ${correctText}`,
    `Explicação: ${item.explanation}`,
    'Frases de preserve:',
    lines(preserve),
    'Tipos de erro dos distratores:',
    lines(distractors.map((distractor) => distractor.error)),
  ].join('\n');
}

function buildAdaptPrompt(family, target) {
  const label = gradeLabel(Number(target.serie));
  const stage = gradeStage(Number(target.serie));
  const note = target.nota
    ? `\nNota do professor: ${target.nota}\n`
    : '';
  const fifth = family[0].options.length === 4
    ? '- Quando a família tem quatro alternativas, crie a quinta como mais um distrator de um tipo de erro já listado.\n'
    : '';

  const members = family.map((item, index) => `Membro ${index + 1}:\n${memberBlock(item)}`).join('\n\n');

  return `Você é um professor. Escreva uma questão nova a partir da família de questões da mesma habilidade.

CONTEXTO:
- Série: ${label} (${stage})
- Assunto: ${target.assunto}
- Temática: ${target.tematica}
- Dificuldade: ${target.dificuldade}
${note}
FAMÍLIA:
${members}

REGRAS:
- Mantenha a mesma habilidade.
- Não copie um enunciado da família.
- Obedeça cada frase de preserve.
- reskin troca o cenário pela temática.
- wording conserva o fato.
- Responda com exatamente cinco alternativas e um correctIndex.
- As alternativas erradas expressam os tipos de erro listados.
${fifth}- Use redação adequada para ${label} (${stage}).
- Responda somente com JSON, sem texto fora do objeto, nestes campos: question, options, correctIndex, explanation.

{
  "question": "enunciado",
  "options": ["A", "B", "C", "D", "E"],
  "correctIndex": 0,
  "explanation": "explicação"
}`;
}

function copiesFamilyStem(family, question) {
  const trimmed = String(question).trim();
  return family.some((item) => String(item.stem).trim() === trimmed);
}

async function adaptQuestion(family, target, complete) {
  const prompt = buildAdaptPrompt(family, target);
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const parsed = parseQuizQuestion(await complete(prompt));
      if (copiesFamilyStem(family, parsed.question)) {
        throw new Error('A IA copiou o enunciado da família.');
      }
      return parsed;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

module.exports = { buildAdaptPrompt, adaptQuestion };
