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

// Carregar .env primeiro
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

let supabase = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
} catch (e) {
  // @supabase/supabase-js não instalado
}

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const USE_SUPABASE = !!supabase;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
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

async function generateQuestion(config) {
  const { serie, assunto, tematica, dificuldade, nota } = config;

  const notaSection = nota
    ? `\nINSTRUÇÃO DO PROFESSOR (OBRIGATÓRIO seguir): ${nota}\n`
    : '';

  const prompt = `Você é um professor criando questões de quiz para crianças. Gere UMA pergunta de múltipla escolha.

CONTEXTO:
- Série: ${serie}º ano do ensino fundamental
- Assunto: ${assunto}
- Temática para contextualizar as perguntas: ${tematica}
- Nível de dificuldade: ${dificuldade}
${notaSection}
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
- A pergunta deve ser adequada para ${serie}º ano
- Use a temática ${tematica} de forma criativa
- A explicação deve ajudar a criança a entender o conceito`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Você gera questões de quiz em JSON. Responda apenas com o JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1024,
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

  // Extrair JSON da resposta (a IA às vezes adiciona texto antes/depois)
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // Fallback: extrair o primeiro objeto JSON (entre { e })
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

  let question;
  try {
    question = JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error('Resposta da IA (trecho):', content.slice(0, 500));
    throw new Error('A IA retornou um formato inválido. Tente gerar novamente.');
  }

  // Validação
  if (!question.question || !Array.isArray(question.options) || question.options.length !== 5) {
    throw new Error('Formato inválido da pergunta gerada');
  }
  if (typeof question.correctIndex !== 'number' || question.correctIndex < 0 || question.correctIndex > 4) {
    question.correctIndex = 0;
  }
  if (!question.explanation) {
    question.explanation = 'Boa resposta!';
  }

  return question;
}

const server = http.createServer(async (req, res) => {
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
    if (!GROQ_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'GROQ_API_KEY não configurada. Execute: GROQ_API_KEY=sua_chave node server.js' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const config = JSON.parse(body);
        const question = await generateQuestion(config);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(question));
      } catch (err) {
        console.error('Erro ao gerar pergunta:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Erro ao gerar pergunta' }));
      }
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Modo: ${USE_SUPABASE ? 'Supabase' : 'Arquivos locais'}`);
  if (!GROQ_API_KEY) console.warn('AVISO: GROQ_API_KEY não configurada. A criação de quiz não funcionará.');
});
