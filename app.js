// Estado da aplicação
let quizzes = [];
let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];

// Elementos do DOM
const quizSelector = document.getElementById('quiz-selector');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const quizList = document.getElementById('quiz-list');
const loading = document.getElementById('loading');
const quizTitle = document.getElementById('quiz-title');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const questionNumber = document.getElementById('question-number');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const btnNext = document.getElementById('btn-next');
const btnBack = document.getElementById('btn-back');
const resultTitle = document.getElementById('result-title');
const scoreValue = document.getElementById('score-value');
const scoreMessage = document.getElementById('score-message');
const resultsSummary = document.getElementById('results-summary');
const btnRetry = document.getElementById('btn-retry');
const btnNewQuiz = document.getElementById('btn-new-quiz');

// Carregar lista de quizzes (tenta API primeiro, fallback para arquivos)
async function loadQuizzes() {
  try {
    const res = await fetch('/api/quizzes').catch(() => null);
    const data = res?.ok ? await res.json() : null;
    if (data?.quizzes) {
      quizzes = data.quizzes;
    } else {
      const fallback = await fetch('quiz_jsons/list.json');
      const fallbackData = await fallback.json();
      quizzes = fallbackData.quizzes || [];
    }
    renderQuizList();
  } catch (error) {
    console.error('Erro ao carregar quizzes:', error);
    loading.textContent = 'Não foi possível carregar os quizzes. Use o servidor (node server.js) ou verifique quiz_jsons/list.json.';
  }
}

function renderQuizList() {
  loading.style.display = 'none';
  
  if (quizzes.length === 0) {
    quizList.innerHTML = '<p class="loading">Nenhum quiz encontrado.</p>';
    return;
  }

  quizList.innerHTML = quizzes.map((quiz, index) => `
    <div class="quiz-card" data-index="${index}">
      <span class="quiz-emoji">${quiz.emoji || '📚'}</span>
      <div class="quiz-info">
        <h3>${quiz.name}</h3>
        <p>${quiz.description || `${quiz.questions?.length || '?'} perguntas`}</p>
      </div>
    </div>
  `).join('');

  quizList.querySelectorAll('.quiz-card').forEach(card => {
    card.addEventListener('click', () => startQuiz(parseInt(card.dataset.index)));
  });
}

async function startQuiz(index) {
  const quizInfo = quizzes[index];
  try {
    const res = await fetch(`/api/quiz/${encodeURIComponent(quizInfo.file)}`).catch(() => null);
    const quizData = res?.ok ? await res.json() : null;
    currentQuiz = quizData || await (await fetch(`quiz_jsons/${quizInfo.file}`)).json();
    currentQuestionIndex = 0;
    userAnswers = [];
    showScreen('quiz-screen');
    renderQuestion();
  } catch (error) {
    console.error('Erro ao carregar quiz:', error);
    alert('Não foi possível carregar o quiz. Tente novamente.');
  }
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function renderQuestion() {
  const question = currentQuiz.questions[currentQuestionIndex];
  const total = currentQuiz.questions.length;
  const progress = ((currentQuestionIndex + 1) / total) * 100;

  quizTitle.textContent = currentQuiz.name;
  progressFill.style.width = `${progress}%`;
  progressText.textContent = `Pergunta ${currentQuestionIndex + 1} de ${total}`;
  questionNumber.textContent = `Pergunta ${currentQuestionIndex + 1}`;
  questionText.textContent = question.question;

  const letters = ['A', 'B', 'C', 'D', 'E'];
  optionsContainer.innerHTML = question.options.map((option, i) => `
    <button class="option-btn" data-index="${i}">
      <span class="option-letter">${letters[i]}</span>
      <span>${option}</span>
    </button>
  `).join('');

  btnNext.disabled = true;

  optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => selectOption(parseInt(btn.dataset.index)));
  });

  btnNext.onclick = () => {
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
      currentQuestionIndex++;
      renderQuestion();
    } else {
      showResults();
    }
  };
}

function selectOption(index) {
  const buttons = optionsContainer.querySelectorAll('.option-btn');
  buttons.forEach(btn => btn.classList.remove('selected'));
  buttons[index].classList.add('selected');
  userAnswers[currentQuestionIndex] = index;
  btnNext.disabled = false;
}

function showResults() {
  const total = currentQuiz.questions.length;
  let correct = 0;
  const results = [];

  currentQuiz.questions.forEach((q, i) => {
    const userAnswer = userAnswers[i];
    const isCorrect = userAnswer === q.correctIndex;
    if (isCorrect) correct++;

    const letters = ['A', 'B', 'C', 'D', 'E'];
    results.push({
      question: q.question,
      userAnswer: userAnswer !== undefined ? q.options[userAnswer] : 'Não respondida',
      correctAnswer: q.options[q.correctIndex],
      isCorrect,
      explanation: q.explanation
    });
  });

  // Atualizar UI de resultados
  scoreValue.textContent = correct;
  const percentage = Math.round((correct / total) * 100);

  if (percentage === 100) {
    resultTitle.textContent = 'Perfeito! 🌟';
    scoreMessage.textContent = 'Você acertou todas! Você é incrível!';
  } else if (percentage >= 70) {
    resultTitle.textContent = 'Muito bem! 🎉';
    scoreMessage.textContent = `Você acertou ${correct} de ${total}! Continue assim!`;
  } else {
    resultTitle.textContent = 'Bom esforço! 💪';
    scoreMessage.textContent = `Você acertou ${correct} de ${total}. Revise as respostas e tente de novo!`;
  }

  resultsSummary.innerHTML = results.map((r, i) => `
    <div class="result-item ${r.isCorrect ? 'correct' : 'incorrect'}">
      <div class="result-question">${i + 1}. ${r.question}</div>
      <div class="result-answer">Sua resposta: ${r.userAnswer}</div>
      ${!r.isCorrect ? `<div class="result-answer">Resposta correta: ${r.correctAnswer}</div>` : ''}
      ${r.explanation ? `<div class="result-feedback">💡 ${r.explanation}</div>` : ''}
    </div>
  `).join('');

  showScreen('result-screen');
}

// Event listeners
btnBack.addEventListener('click', () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  } else {
    showScreen('quiz-selector');
  }
});

btnRetry.addEventListener('click', () => {
  currentQuestionIndex = 0;
  userAnswers = [];
  renderQuestion();
  showScreen('quiz-screen');
});

btnNewQuiz.addEventListener('click', () => {
  currentQuiz = null;
  showScreen('quiz-selector');
});

// Inicialização
loadQuizzes();
