const STORED_DIMENSIONS = 1536;
const LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2';

let localExtractor;

function apiConfigured() {
  return Boolean(process.env.EMBEDDING_API_URL && process.env.EMBEDDING_API_KEY);
}

function embeddingsConfigured() {
  if (process.env.EMBEDDING_LOCAL === '0') return apiConfigured();
  return true;
}

function dimensionError() {
  const error = new Error('Embedding com dimensão diferente de 1536');
  error.code = 'embedding_dimension';
  return error;
}

function fitStoredDimension(vector) {
  if (!Array.isArray(vector) || vector.length === 0 || vector.length > STORED_DIMENSIONS) {
    throw dimensionError();
  }
  if (vector.length === STORED_DIMENSIONS) return vector;
  const stored = vector.slice();
  stored.length = STORED_DIMENSIONS;
  stored.fill(0, vector.length);
  return stored;
}

async function embedWithApi(text) {
  const response = await fetch(process.env.EMBEDDING_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text,
    }),
  });
  if (!response.ok) throw new Error('Falha ao calcular o embedding da nota');
  const data = await response.json();
  const vector = data.data && data.data[0] && data.data[0].embedding;
  if (!Array.isArray(vector) || vector.length !== STORED_DIMENSIONS) throw dimensionError();
  return vector;
}

async function embedLocally(text) {
  if (!localExtractor) {
    const { pipeline } = await import('@xenova/transformers');
    localExtractor = await pipeline('feature-extraction', LOCAL_MODEL);
  }
  const output = await localExtractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function embedText(text) {
  if (!embeddingsConfigured()) return null;
  const vector = apiConfigured() ? await embedWithApi(text) : await embedLocally(text);
  return fitStoredDimension(vector);
}

module.exports = {
  STORED_DIMENSIONS,
  embeddingsConfigured,
  fitStoredDimension,
  embedText,
};
