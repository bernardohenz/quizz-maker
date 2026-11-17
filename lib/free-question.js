const { gradeLabel, gradeStage } = require('./grades');

const TEXT_MODEL = 'openai/gpt-oss-120b';

function buildFreePrompt({ serie, assunto, tematica, dificuldade, nota }) {
  const label = gradeLabel(Number(serie));
  const stage = gradeStage(Number(serie));

  return `Você é um professor criando questões de quiz para crianças. Gere UMA pergunta de múltipla escolha.

CONTEXTO:
- Série: ${label} (${stage})
- Assunto: ${assunto}
- Temática para contextualizar as perguntas: ${tematica}
- Nível de dificuldade: ${dificuldade}
${nota ? `\nINSTRUÇÃO DO PROFESSOR (OBRIGATÓRIO seguir): ${nota}\n` : ''}
FORMATO OBRIGATÓRIO - responda APENAS com um JSON válido, sem texto adicional:
{
  "question": "Texto da pergunta (use a temática ${tematica} para tornar mais divertido)",
  "options": ["alternativa A", "alternativa B", "alternativa C", "alternativa D", "alternativa E"],
  "correctIndex": 0,
  "explanation": "Explicação didática para a criança aprender (1-2 frases)"
}

REGRAS:
- correctIndex é o índice da resposta correta (0 a 4)
- Exatamente 5 alternativas
- A pergunta deve ser adequada para ${label} (${stage})
- Use a temática ${tematica} de forma criativa
- A explicação deve ajudar a criança a entender o conceito`;
}

module.exports = { buildFreePrompt, TEXT_MODEL };