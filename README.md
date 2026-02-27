# Quiz Divertido 🎮

Página de quiz interativa e intuitiva para crianças. Carrega quizzes a partir de arquivos JSON.

## Como rodar

### Para jogar os quizzes (só visualização)

Use um servidor local (não funciona abrindo o arquivo HTML diretamente):

```bash
cd quiz_page
python -m http.server 8000
```
Acesse: http://localhost:8000

### Para criar quizzes (com IA via Groq)

É necessário usar o servidor Node.js. Configure a chave da API:

1. Copie o arquivo de exemplo: `cp .env.example .env`
2. Edite `.env` e coloque sua chave: `GROQ_API_KEY=sua_chave`
3. Inicie o servidor: `node server.js`

```bash
cd quiz_page
cp .env.example .env
# Edite .env com sua chave
node server.js
```

Acesse: http://localhost:3000

- **Jogar:** http://localhost:3000
- **Criar quiz:** http://localhost:3000/criar.html

Obtenha uma chave API gratuita em [console.groq.com](https://console.groq.com).

### Salvar quiz na lista automaticamente

Ao finalizar um quiz na página de criação, use **"Salvar no servidor"** para gravar o quiz em `quiz_jsons/` e adicioná-lo automaticamente à lista. O quiz passa a aparecer na tela inicial.

### Hospedagem na internet

**Guia completo passo a passo:** [DEPLOY.md](DEPLOY.md)

Configuração com Render (hospedagem) + Supabase (banco) – ambos gratuitos.

## Estrutura

- `index.html` - Página principal (jogar)
- `criar.html` - Página para criar quizzes (professor)
- `server.js` - Servidor com API Groq para gerar perguntas
- `styles.css`, `criar.css` - Estilos
- `app.js`, `criar.js` - Lógica
- `quiz_jsons/` - Pasta com os quizzes em JSON
  - `list.json` - Lista de quizzes disponíveis
  - `matematica-pokemon-ano4.json` - Quiz de exemplo

## Como adicionar novos quizzes

1. Crie um arquivo JSON na pasta `quiz_jsons/` com a estrutura:
```json
{
  "name": "Nome do Quiz",
  "questions": [
    {
      "question": "Texto da pergunta",
      "options": ["A", "B", "C", "D", "E"],
      "correctIndex": 0,
      "explanation": "Explicação opcional para a criança aprender"
    }
  ]
}
```

2. Adicione o quiz em `quiz_jsons/list.json`:
```json
{
  "quizzes": [
    {
      "name": "Nome do Quiz",
      "file": "seu-arquivo.json",
      "emoji": "📚",
      "description": "Descrição do quiz"
    }
  ]
}
```
