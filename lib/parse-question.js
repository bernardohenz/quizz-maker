function extractJsonObject(content) {
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    const firstBrace = content.indexOf('{');
    if (firstBrace !== -1) {
      let depth = 0;
      let end = firstBrace;
      for (let i = firstBrace; i < content.length; i++) {
        if (content[i] === '{') depth++;
        if (content[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      jsonStr = content.slice(firstBrace, end);
    }
  }

  if (!jsonStr || jsonStr.indexOf('{') === -1) {
    throw new Error('A IA retornou um formato inválido. Tente gerar novamente.');
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error('A IA retornou um formato inválido. Tente gerar novamente.');
  }
}

function parseQuizQuestion(content) {
  const data = extractJsonObject(content);

  if (!data.question || !Array.isArray(data.options) || data.options.length !== 5) {
    throw new Error('Formato inválido da pergunta gerada');
  }

  let correctIndex = data.correctIndex;
  if (typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex > 4) {
    correctIndex = 0;
  }

  let explanation = data.explanation;
  if (explanation == null || explanation === '') {
    explanation = 'Boa resposta!';
  }

  return {
    question: data.question,
    options: data.options,
    correctIndex,
    explanation,
  };
}

module.exports = { extractJsonObject, parseQuizQuestion };