/**
 * Servidor para o projeto Quiz
 * - Serve arquivos estáticos
 * - API para gerar perguntas via Groq
 * - API para listar/carregar quizzes (arquivos ou Supabase)
 *
 * Configure em .env (copie .env.example para .env)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildFreePrompt, TEXT_MODEL } = require('./lib/free-question');
const { parseQuizQuestion } = require('./lib/parse-question');
const { difficultyTarget } = require('./lib/grades');
const { getBankStore } = require('./lib/bank-store');
const { retrieveFamily } = require('./lib/question-bank');
const { adaptQuestion } = require('./lib/adapt-question');
const { embeddingsConfigured, embedText } = require('./lib/embeddings');

// Carregar .env primeiro
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  });
}

let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
} catch (e) {
  // @supabase/supabase-js não instalado
}

const PORT = process.env.PORT || 3000;
const USE_SUPABASE = !!supabase;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function httpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath.split('?')[0]);
  
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

async function completeWithGroq(prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: 'Você gera questões de quiz em JSON. Responda apenas com o JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1024,
      reasoning_effort: 'low',
      include_reasoning: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('Resposta vazia da API');
  }

  return content;
}

async function generateQuestion(config) {
  return parseQuizQuestion(await completeWithGroq(buildFreePrompt(config)));
}

async function generateBankQuestion(config) {
  const gradeIndex = Number(config.serie);
  const target = difficultyTarget(config.dificuldade);
  if (!Number.isInteger(gradeIndex) || gradeIndex < 1 || gradeIndex > 13 || target == null) {
    throw httpError(400, 'Série ou dificuldade inválida', 'invalid_request');
  }

  let items;
  try {
    items = await getBankStore().listAll();
  } catch (error) {
    if (error && error.code === 'bank_unavailable') {
      error.status = 503;
      throw error;
    }
    throw error;
  }

  const note = typeof config.nota === 'string' ? config.nota.trim() : '';
  let noteEmbedding;
  if (note !== '' && embeddingsConfigured()) {
    try {
      noteEmbedding = await embedText(note);
    } catch (error) {
      if (error && error.code === 'embedding_dimension') {
        error.status = 500;
        throw error;
      }
      throw error;
    }
  }

  const retrieved = retrieveFamily(items, {
    subject: config.assunto,
    gradeIndex,
    difficultyTarget: target,
    note: config.nota,
    excludeIds: config.excludeIds,
    usedSkills: config.usedSkills,
    embeddingsConfigured: embeddingsConfigured(),
    noteEmbedding,
  });

  if (retrieved.empty) {
    throw httpError(422, 'O banco não cobre esse pedido', 'bank_empty');
  }

  const question = await adaptQuestion(retrieved.family, {
    serie: gradeIndex,
    assunto: config.assunto,
    tematica: config.tematica,
    dificuldade: config.dificuldade,
    nota: config.nota,
  }, completeWithGroq);

  return {
    ...question,
    sourceIds: retrieved.sourceIds,
    skill: retrieved.skill,
    mode: 'bank',
  };
}

function createQuizServer() {
  return http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /api/quizzes - lista de quizzes
    if (req.method === 'GET' && req.url === '/api/quizzes') {
      try {
        if (USE_SUPABASE) {
          const { data, error } = await supabase.from('quizzes').select('name, file, emoji, description').order('created_at', { ascending: false });
          if (error) throw error;
          sendJson(res, 200, { quizzes: data || [] });
        } else {
          const listPath = path.join(__dirname, 'quiz_jsons', 'list.json');
          const list = fs.existsSync(listPath) ? JSON.parse(fs.readFileSync(listPath, 'utf8')) : { quizzes: [] };
          sendJson(res, 200, list);
        }
      } catch (err) {
        console.error('Erro ao listar quizzes:', err);
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    // GET /api/quiz/:file - conteúdo de um quiz
    const quizMatch = req.url.match(/^\/api\/quiz\/([^/?#]+)$/);
    if (req.method === 'GET' && quizMatch) {
      const file = quizMatch[1];
      try {
        if (USE_SUPABASE) {
          const { data, error } = await supabase.from('quizzes').select('content').eq('file', file).single();
          if (error || !data) throw new Error('Quiz não encontrado');
          sendJson(res, 200, data.content);
        } else {
          const quizPath = path.join(__dirname, 'quiz_jsons', file);
          if (!fs.existsSync(quizPath)) throw new Error('Quiz não encontrado');
          const content = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
          sendJson(res, 200, content);
        }
      } catch (err) {
        sendJson(res, 404, { error: err.message });
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/api/save-quiz') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { quiz, filename } = JSON.parse(body);
          if (!quiz?.name || !Array.isArray(quiz?.questions)) {
            throw new Error('Dados do quiz inválidos');
          }
          const slug = (filename || 'quiz').replace(/\.json$/, '').replace(/[^a-z0-9-_]/gi, '-').toLowerCase() || 'quiz';
          const file = `${slug}.json`;

          if (USE_SUPABASE) {
            const { error } = await supabase.from('quizzes').upsert({
              file,
              name: quiz.name,
              emoji: '📚',
              description: `${quiz.questions.length} perguntas`,
              content: quiz,
            }, { onConflict: 'file' });
            if (error) throw error;
          } else {
            const quizPath = path.join(__dirname, 'quiz_jsons', file);
            const listPath = path.join(__dirname, 'quiz_jsons', 'list.json');
            fs.writeFileSync(quizPath, JSON.stringify(quiz, null, 2), 'utf8');
            let list = { quizzes: [] };
            if (fs.existsSync(listPath)) list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
            if (!list.quizzes.find((q) => q.file === file)) {
              list.quizzes.push({ name: quiz.name, file, emoji: '📚', description: `${quiz.questions.length} perguntas` });
              fs.writeFileSync(listPath, JSON.stringify(list, null, 2), 'utf8');
            }
          }
          sendJson(res, 200, { success: true, file });
        } catch (err) {
          console.error('Erro ao salvar quiz:', err);
          sendJson(res, 500, { error: err.message || 'Erro ao salvar' });
        }
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/generate-question') {
      if (!process.env.GROQ_API_KEY) {
        sendJson(res, 500, { error: 'GROQ_API_KEY não configurada. Execute: GROQ_API_KEY=sua_chave node server.js' });
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const config = JSON.parse(body);
          const question = config.mode === 'bank'
            ? await generateBankQuestion(config)
            : await generateQuestion(config);
          sendJson(res, 200, question);
        } catch (err) {
          const status = err.status || 500;
          if (!err.code) console.error('Erro ao gerar pergunta:', err);
          const payload = { error: err.message || 'Erro ao gerar pergunta' };
          if (err.code) payload.code = err.code;
          sendJson(res, status, payload);
        }
      });
      return;
    }

    serveStatic(req, res);
  });
}

if (require.main === module) {
  const server = createQuizServer();
  server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Modo: ${USE_SUPABASE ? 'Supabase' : 'Arquivos locais'}`);
    if (!process.env.GROQ_API_KEY) console.warn('AVISO: GROQ_API_KEY não configurada. A criação de quiz não funcionará.');
  });
}

module.exports = { createQuizServer };
