# Guia de Deploy - Quiz Divertido na Web

Passo a passo para colocar o site no ar usando **Render** (hospedagem) + **Supabase** (banco de dados). Ambos têm plano gratuito.

---

## Parte 1: Criar conta no Supabase (banco de dados)

### 1.1 Acessar o Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Clique em **Start your project**
3. Faça login com **GitHub** (recomendado) ou e-mail

### 1.2 Criar um novo projeto

1. Clique em **New Project**
2. **Organization**: use a padrão ou crie uma
3. **Project name**: `quiz-divertido` (ou outro nome)
4. **Database Password**: crie uma senha forte e **guarde** (você vai precisar)
5. **Region**: escolha a mais próxima (ex: South America - São Paulo)
6. Clique em **Create new project** e aguarde 1-2 minutos

### 1.3 Criar a tabela de quizzes

1. No menu lateral, clique em **SQL Editor**
2. Clique em **New query**
3. Cole o SQL abaixo e clique em **Run**:

```sql
CREATE TABLE quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📚',
  description TEXT,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permite que a API leia e escreva (usando a chave anon)
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública" ON quizzes
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pública" ON quizzes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualização pública" ON quizzes
  FOR UPDATE USING (true);
```

4. Se aparecer "Success", a tabela foi criada.

### 1.4 Obter as chaves da API

1. No menu lateral, clique em **Project Settings** (ícone de engrenagem)
2. Clique em **API** no submenu
3. Copie e guarde:
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon public** key (em Project API keys)

---

## Parte 2: Criar conta no Render (hospedagem)

### 2.1 Acessar o Render

1. Acesse [render.com](https://render.com)
2. Clique em **Get Started**
3. Faça login com **GitHub** (recomendado para conectar o repositório)

### 2.2 Conectar o repositório GitHub

1. Se o projeto ainda não está no GitHub:
   - Crie um repositório em [github.com/new](https://github.com/new)
   - Faça push do código:
     ```bash
     cd quiz_page
     git init
     git add .
     git commit -m "Quiz divertido"
     git remote add origin https://github.com/SEU_USUARIO/quiz-divertido.git
     git push -u origin main
     ```

2. No Render, clique em **New** → **Web Service**
3. Conecte seu repositório GitHub (autorize se pedir)
4. Selecione o repositório do quiz

### 2.3 Configurar o Web Service

1. **Name**: `quiz-divertido` (ou outro)
2. **Region**: South America (São Paulo) se disponível
3. **Branch**: `main`
4. **Runtime**: `Node` (Render usa Node 20 por padrão)
5. **Build Command**: `npm install`
6. **Start Command**: `npm start` (ou `node server.js`)
7. **Instance Type**: **Free**

### 2.4 Variáveis de ambiente

Na seção **Environment**, clique em **Add Environment Variable** e adicione:

| Key | Value |
|-----|-------|
| `GROQ_API_KEY` | Sua chave do Groq ([console.groq.com](https://console.groq.com)) |
| `SUPABASE_URL` | A Project URL do Supabase (ex: `https://xxxxx.supabase.co`) |
| `SUPABASE_KEY` | A chave **anon public** do Supabase, usada para ler e gravar os quizzes |
| `SUPABASE_SECRET_KEY` | A chave secreta do servidor (`sb_secret_...`). Só ela grava o banco de questões. Não é a chave anon e não vai para o navegador |

Clique em **Create Web Service**. O deploy leva 2-5 minutos.

### 2.5 Obter a URL do site

Após o deploy, a URL será algo como:
`https://quiz-divertido-xxxx.onrender.com`

---

## Parte 3: Obter chave da Groq (para criar quizzes)

1. Acesse [console.groq.com](https://console.groq.com)
2. Faça login (pode usar Google)
3. Vá em **API Keys** → **Create API Key**
4. Copie a chave e adicione em `GROQ_API_KEY` no Render (Environment)

---

## Parte 4: Importar o quiz de exemplo (opcional)

Para ter o quiz "Matemática Pokemon" no Supabase, execute localmente:

```bash
cd quiz_page
cp .env.example .env
# Edite .env com SUPABASE_URL e SUPABASE_KEY
npm install
node scripts/seed-supabase.js
```

Isso importa todos os quizzes de `quiz_jsons/` para o Supabase.

---

## Resumo das contas

| Serviço | O que fazer | Grátis? |
|---------|-------------|---------|
| **Supabase** | Banco de dados para quizzes | Sim, 500MB |
| **Render** | Hospedar o Node.js | Sim, 750h/mês |
| **Groq** | IA para gerar perguntas | Sim |
| **GitHub** | Repositório do código | Sim |

---

## Troubleshooting

**"Quiz não encontrado"**  
Verifique se a tabela `quizzes` existe e se as políticas RLS estão ativas.

**"GROQ_API_KEY não configurada"**  
Adicione a variável no Render → Environment.

**Site não carrega**  
O Render free "dorme" após 15 min de inatividade. A primeira requisição pode demorar ~30s.

**Erro ao salvar quiz**  
Confira se `SUPABASE_URL` e `SUPABASE_KEY` estão corretos no Render.

**Banco de questões não adapta**  
Confira `SUPABASE_SECRET_KEY` no Render. A chave anon não grava nem lê a tabela `question_bank`.
