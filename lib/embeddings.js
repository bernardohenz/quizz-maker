function embeddingsConfigured() {
  return Boolean(process.env.EMBEDDING_API_URL && process.env.EMBEDDING_API_KEY);
}

async function embedText(text) {
  if (!embeddingsConfigured()) return null;
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
  if (!Array.isArray(vector) || vector.length !== 1536) {
    const error = new Error('Embedding com dimensão diferente de 1536');
    error.code = 'embedding_dimension';
    throw error;
  }
  return vector;
}

module.exports = { embeddingsConfigured, embedText };
