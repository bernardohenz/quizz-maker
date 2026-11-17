/**
 * Página de criação de quiz para professores
 * Usa a API do servidor (server.js) para gerar perguntas via Groq
 */

const API_BASE = window.location.origin;

// Estado
let quizConfig = null;
let selectedQuestions = [];
let currentQuestion = null;
let currentDifficulty = 'médio';
let nextDifficultyHint = 'same'; // 'easier', 'same', 'harder'
let generationMode = 'free';
let session = CreateSession.createSession();

// Elementos
const configForm = document.getElementById('config-form');
const configScreen = document.getElementById('config-screen');
const createScreen = document.getElementById('create-screen');
const saveScreen = document.getElementById('save-screen');
const quizNameDisplay = document.getElementById('quiz-name-display');
const statSelected = document.getElementById('stat-selected');
const difficultyBadge = document.getElementById('difficulty-badge');
const loadingQuestion = document.getElementById('loading-question');
const questionDisplay = document.getElementById('question-display');
const bankEmpty = document.getElementById('bank-empty');
const bankEmptyMessage = document.getElementById('bank-empty-message');
const btnBankFallback = document.getElementById('btn-bank-fallback');
const generatedQuestion = document.getElementById('generated-question');
const optionsPreview = document.getElementById('options-preview');
const correctAnswerPreview = document.getElementById('correct-answer-preview');
const explanationPreview = document.getElementById('explanation-preview');
const btnReject = document.getElementById('btn-reject');
const btnAccept = document.getElementById('btn-accept');
const btnEasier = document.getElementById('btn-easier');
const btnSame = document.getElementById('btn-same');
const btnHarder = document.getElementById('btn-harder');
const btnFinish = document.getElementById('btn-finish');
const finishCount = document.getElementById('finish-count');
const questionNoteInput = document.getElementById('question-note');
const saveSubtitle = document.getElementById('save-subtitle');
const quizFilename = document.getElementById('quiz-filename');
const btnDownload = document.getElementById('btn-download');
const btnCopy = document.getElementById('btn-copy');

const DIFFICULTY_ORDER = ['muito fácil', 'fácil', 'médio', 'difícil', 'muito difícil'];

function getDifficultyForNextQuestion() {
  if (nextDifficultyHint === 'easier') {
    const idx = DIFFICULTY_ORDER.indexOf(currentDifficulty);
    return DIFFICULTY_ORDER[Math.max(0, idx - 1)];
  }
  if (nextDifficultyHint === 'harder') {
    const idx = DIFFICULTY_ORDER.indexOf(currentDifficulty);
    return DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1, idx + 1)];
  }
  return currentDifficulty;
}

async function generateQuestion(forceFree) {
  const useBank = generationMode === 'bank' && !forceFree;
  loadingQuestion.classList.remove('hidden');
  questionDisplay.classList.add('hidden');
  bankEmpty.classList.add('hidden');
  loadingQuestion.querySelector('p').textContent = useBank
    ? 'Adaptando pergunta do banco...'
    : 'Gerando pergunta...';

  const difficulty = getDifficultyForNextQuestion();
  currentDifficulty = difficulty;
  nextDifficultyHint = 'same';

  const quizNote = questionNoteInput.value;

  const requestConfig = {
    serie: quizConfig.serie,
    assunto: quizConfig.assunto,
    tematica: quizConfig.tematica,
    dificuldade: difficulty,
  };
  const payload = useBank
    ? CreateSession.bankRequestBody(requestConfig, session, quizNote)
    : {
        ...requestConfig,
        nota: quizNote.trim() || undefined,
        ...(forceFree ? { mode: 'free' } : {}),
      };

  try {
    const response = await fetch(`${API_BASE}/api/generate-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      if (
        (response.status === 422 && data.code === 'bank_empty') ||
        (response.status === 503 && data.code === 'bank_unavailable')
      ) {
        loadingQuestion.classList.add('hidden');
        questionDisplay.classList.add('hidden');
        bankEmptyMessage.textContent = data.error || '';
        bankEmpty.classList.remove('hidden');
        return;
      }
      throw new Error(data.error || 'Erro ao gerar pergunta');
    }

    currentQuestion = data;
    session = CreateSession.noteShown(session, data);
    bankEmpty.classList.add('hidden');
    showQuestion(data);
    if (generationMode !== 'bank') questionNoteInput.value = '';
  } catch (err) {
    alert('Erro: ' + err.message + '\n\nVerifique se o servidor está rodando com: GROQ_API_KEY=sua_chave node server.js');
    loadingQuestion.classList.add('hidden');
    questionDisplay.classList.add('hidden');
  }
}

function showQuestion(q) {
  loadingQuestion.classList.add('hidden');
  questionDisplay.classList.remove('hidden');

  generatedQuestion.textContent = q.question;

  const letters = ['A', 'B', 'C', 'D', 'E'];
  optionsPreview.innerHTML = q.options.map((opt, i) => `
    <div class="option-preview-item ${i === q.correctIndex ? 'correct' : ''}">
      <span class="option-mark">${letters[i]})</span>
      <span>${opt}</span>
    </div>
  `).join('');

  correctAnswerPreview.textContent = `Resposta correta: ${letters[q.correctIndex]}) ${q.options[q.correctIndex]}`;
  explanationPreview.textContent = q.explanation || '';

  updateDifficultyBadge();
}

function updateUI() {
  statSelected.textContent = `${selectedQuestions.length} selecionada${selectedQuestions.length !== 1 ? 's' : ''}`;
  finishCount.textContent = selectedQuestions.length;
  btnFinish.disabled = selectedQuestions.length === 0;
}

function updateDifficultyBadge() {
  const labels = {
    'muito fácil': 'Muito fácil',
    'fácil': 'Fácil',
    'médio': 'Médio',
    'difícil': 'Difícil',
    'muito difícil': 'Muito difícil',
  };
  difficultyBadge.textContent = labels[currentDifficulty] || currentDifficulty;

  btnEasier.classList.toggle('active', nextDifficultyHint === 'easier');
  btnSame.classList.toggle('active', nextDifficultyHint === 'same');
  btnHarder.classList.toggle('active', nextDifficultyHint === 'harder');
}

function addQuestion() {
  if (!currentQuestion) return;
  session = CreateSession.noteAccepted(session, currentQuestion);
  selectedQuestions.push({ ...currentQuestion });
  updateUI();
  generateQuestion();
}

function rejectQuestion() {
  generateQuestion();
}

function finishQuiz() {
  if (selectedQuestions.length === 0) return;

  saveSubtitle.textContent = `${selectedQuestions.length} pergunta${selectedQuestions.length !== 1 ? 's' : ''} selecionada${selectedQuestions.length !== 1 ? 's' : ''}`;

  const slug = quizConfig.tematica.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  quizFilename.value = slug || 'meu-quiz';
  quizFilename.placeholder = slug || 'meu-quiz';

  showScreen('save-screen');
}

function getQuizData() {
  const name = `${quizConfig.assunto} ${quizConfig.tematica} ano ${quizConfig.serie}`;
  return { name, questions: selectedQuestions };
}

function getQuizJSON() {
  return JSON.stringify(getQuizData(), null, 2);
}

function downloadQuiz() {
  const filename = (quizFilename.value || 'meu-quiz').replace(/\.json$/, '') + '.json';
  const blob = new Blob([getQuizJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function copyToClipboard() {
  navigator.clipboard.writeText(getQuizJSON()).then(() => {
    btnCopy.textContent = 'Copiado! ✓';
    setTimeout(() => { btnCopy.textContent = 'Copiar JSON para área de transferência'; }, 2000);
  });
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Event listeners
configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const serie = document.getElementById('serie');
  const selectedMode = document.querySelector('input[name="modo"]:checked');
  generationMode = selectedMode ? selectedMode.value : 'free';
  quizConfig = {
    serie: serie.value,
    assunto: document.getElementById('assunto').value,
    tematica: document.getElementById('tematica').value.trim(),
    dificuldade: document.getElementById('dificuldade').value,
  };
  currentDifficulty = quizConfig.dificuldade;
  nextDifficultyHint = 'same';
  session = CreateSession.createSession();

  selectedQuestions = [];
  quizNameDisplay.textContent = `${quizConfig.assunto} - ${quizConfig.tematica} (${serie.selectedOptions[0].text})`;
  updateUI();

  showScreen('create-screen');
  generateQuestion();
});

btnAccept.addEventListener('click', addQuestion);
btnReject.addEventListener('click', rejectQuestion);
btnBankFallback.addEventListener('click', () => generateQuestion(true));

btnEasier.addEventListener('click', () => {
  nextDifficultyHint = 'easier';
  updateDifficultyBadge();
});

btnSame.addEventListener('click', () => {
  nextDifficultyHint = 'same';
  updateDifficultyBadge();
});

btnHarder.addEventListener('click', () => {
  nextDifficultyHint = 'harder';
  updateDifficultyBadge();
});

btnFinish.addEventListener('click', finishQuiz);

const btnSaveServer = document.getElementById('btn-save-server');
btnSaveServer.addEventListener('click', async () => {
  const filename = (quizFilename.value || 'meu-quiz').replace(/\.json$/, '');
  btnSaveServer.disabled = true;
  btnSaveServer.textContent = 'Salvando...';
  try {
    const res = await fetch(`${API_BASE}/api/save-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz: getQuizData(), filename }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
    btnSaveServer.textContent = 'Salvo! ✓ Quiz na lista';
    document.getElementById('save-hint').innerHTML =
      `Quiz salvo! <a href="index.html">Ver lista de quizzes</a>`;
  } catch (err) {
    btnSaveServer.textContent = 'Salvar no servidor';
    btnSaveServer.disabled = false;
    alert('Erro: ' + err.message + '\n\nCertifique-se de estar rodando: node server.js');
  }
});

btnDownload.addEventListener('click', downloadQuiz);
btnCopy.addEventListener('click', copyToClipboard);
