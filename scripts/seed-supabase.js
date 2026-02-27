/**
 * Importa quizzes de quiz_jsons/ para o Supabase
 * Execute: SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/seed-supabase.js
 */

const fs = require('fs');
const path = require('path');

// Carregar .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const quizJsonsPath = path.join(__dirname, '..', 'quiz_jsons');

async function seed() {
  const listPath = path.join(quizJsonsPath, 'list.json');
  if (!fs.existsSync(listPath)) {
    console.log('list.json não encontrado');
    return;
  }
  const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
  for (const q of list.quizzes) {
    const quizPath = path.join(quizJsonsPath, q.file);
    if (!fs.existsSync(quizPath)) continue;
    const content = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
    const { error } = await supabase.from('quizzes').upsert({
      file: q.file,
      name: q.name,
      emoji: q.emoji || '📚',
      description: q.description || `${content.questions?.length || 0} perguntas`,
      content,
    }, { onConflict: 'file' });
    if (error) console.error('Erro ao importar', q.file, error);
    else console.log('Importado:', q.name);
  }
}

seed().catch(console.error);
