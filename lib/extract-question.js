const { extractJsonObject } = require('./parse-question');

const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_PREFIX = /^data:image\/(jpeg|png|webp);base64,/i;

function buildExtractPrompt() {
  return `Você recebe uma foto de uma questão impressa. Leia a imagem e transcreva o enunciado e as alternativas exatamente como aparecem.

REGRAS DE TRANSCRIÇÃO:
- Transcreva o texto fielmente; não reescreva, não traduza, não simplifique.
- Não crie alternativa que não esteja na imagem.
- Copie somente as alternativas visíveis na foto.
- correct_index é um número (índice da alternativa correta) somente se a imagem mostrar o gabarito; caso contrário use null.
- explanation é copiada somente se a imagem mostrar uma solução ou explicação; caso contrário use string vazia "".

SUGESTÕES (objeto separado):
- subject, grades, difficulty, skill, skill_tags, theme_policy, preserve, distractors são sugestões para cadastro; não invente conteúdo da questão neles.

Responda somente com JSON, sem texto fora do objeto, nesta forma:

{
  "transcription": {
    "stem": "enunciado transcrito",
    "options": ["alternativa A", "alternativa B"],
    "correct_index": null,
    "explanation": ""
  },
  "suggestions": {
    "subject": "",
    "grades": [],
    "difficulty": "",
    "skill": "",
    "skill_tags": [],
    "theme_policy": "",
    "preserve": [],
    "distractors": []
  }
}`;
}

function invalidImageError(message) {
  const error = new Error(message);
  error.code = 'invalid_image';
  return error;
}

function parseImageDataUrl(value) {
  const str = String(value);
  const match = str.match(ALLOWED_IMAGE_PREFIX);
  if (!match) {
    throw invalidImageError('Envie uma imagem JPEG, PNG ou WebP.');
  }

  const base64 = str.slice(match[0].length);
  let decoded;
  try {
    decoded = Buffer.from(base64, 'base64');
  } catch {
    throw invalidImageError('Envie uma imagem JPEG, PNG ou WebP.');
  }

  if (decoded.length > MAX_IMAGE_BYTES) {
    throw invalidImageError('A imagem passa de 8 MB.');
  }

  return str;
}

function parseExtraction(content) {
  const data = extractJsonObject(content);
  const rawTranscription = data.transcription;
  if (rawTranscription == null || typeof rawTranscription !== 'object') {
    throw new Error('Não foi possível ler a questão na foto.');
  }
  const rawStem = rawTranscription.stem;
  let stem;
  if (rawStem == null) {
    stem = '';
  } else {
    stem = String(rawStem).trim();
  }
  if (!stem) {
    throw new Error('Não foi possível ler a questão na foto.');
  }

  const rawOptions = Array.isArray(rawTranscription.options) ? rawTranscription.options : [];
  const options = rawOptions.filter((entry) => typeof entry === 'string');

  let correctIndex = null;
  const rawCorrect = rawTranscription.correct_index;
  if (
    typeof rawCorrect === 'number'
    && Number.isInteger(rawCorrect)
    && rawCorrect >= 0
    && rawCorrect < options.length
  ) {
    correctIndex = rawCorrect;
  }

  let explanation = rawTranscription.explanation;
  if (explanation == null) {
    explanation = '';
  } else {
    explanation = String(explanation);
  }

  const suggestions = data.suggestions && typeof data.suggestions === 'object'
    ? data.suggestions
    : {};

  return {
    transcription: {
      stem,
      options,
      correct_index: correctIndex,
      explanation,
    },
    suggestions,
  };
}

async function extractQuestion(imageDataUrl, complete) {
  const validUrl = parseImageDataUrl(imageDataUrl);
  const prompt = buildExtractPrompt();
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await complete(prompt, validUrl);
      return parseExtraction(content);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

module.exports = {
  buildExtractPrompt,
  parseExtraction,
  parseImageDataUrl,
  extractQuestion,
  VISION_MODEL,
};