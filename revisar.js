const STORAGE_KEY = 'revisao-banco-decisoes';
const letters = ['A', 'B', 'C', 'D', 'E'];

let lote = { aviso: '', itens: [] };
let filtro = 'Todos';
const decisoes = loadDecisoes();

function loadDecisoes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveDecisoes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decisoes));
}

function gradeSpan(item) {
  const min = QuizGrades.gradeLabel(item.grade_min);
  const max = QuizGrades.gradeLabel(item.grade_max);
  return min === max ? min : `${min} – ${max}`;
}

function payload(item, status) {
  return {
    origin: item.origin,
    source_label: item.source_label,
    subject: item.subject,
    grade_min: item.grade_min,
    grade_max: item.grade_max,
    difficulty: item.difficulty,
    skill: item.skill,
    skill_tags: item.skill_tags,
    theme_policy: item.theme_policy,
    stem: item.stem,
    options: item.options,
    correct_index: item.correct_index,
    explanation: item.explanation,
    invariant: item.invariant,
    distractors: item.distractors,
    status,
  };
}

function renderFilters() {
  const subjects = ['Todos', ...new Set(lote.itens.map((item) => item.subject))];
  const box = document.getElementById('filters');
  box.innerHTML = '';
  subjects.forEach((subject) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = subject;
    button.className = subject === filtro ? 'active' : '';
    button.addEventListener('click', () => {
      filtro = subject;
      render();
    });
    box.appendChild(button);
  });
}

function renderProgresso() {
  const incluidos = Object.values(decisoes).filter((value) => value === 'usable' || value === 'draft').length;
  document.getElementById('progresso').textContent = `${incluidos} de ${lote.itens.length} já enviadas nesta sessão do navegador. O arquivo do banco só muda quando você clica em incluir.`;
}

function render() {
  renderFilters();
  renderProgresso();
  const lista = document.getElementById('lista');
  lista.innerHTML = '';
  lote.itens
    .filter((item) => filtro === 'Todos' || item.subject === filtro)
    .forEach((item) => lista.appendChild(card(item)));
}

function card(item) {
  const article = document.createElement('article');
  article.className = 'review-card' + (decisoes[item.review_id] ? ' done' : '');

  const kicker = document.createElement('div');
  kicker.className = 'card-kicker';
  kicker.textContent = `${item.subject} · ${gradeSpan(item)} · dificuldade ${item.difficulty}/10 · ${item.theme_policy === 'reskin' ? 'pode trocar o cenário' : 'manter o fato'}`;
  article.appendChild(kicker);

  const meta = document.createElement('p');
  meta.className = 'card-meta';
  meta.textContent = `${item.source_label} Habilidade: ${item.skill}.`;
  article.appendChild(meta);

  const stem = document.createElement('div');
  stem.className = 'stem';
  stem.textContent = item.stem;
  article.appendChild(stem);

  item.options.forEach((option, index) => {
    const row = document.createElement('div');
    row.className = 'option' + (index === item.correct_index ? ' correct' : '');
    const mark = index === item.correct_index ? ' · gabarito' : '';
    row.textContent = `${letters[index]}) ${option}${mark}`;
    article.appendChild(row);
  });

  const explanation = document.createElement('p');
  explanation.textContent = item.explanation;
  article.appendChild(explanation);

  if (!item.options_official || item.review_note) {
    const note = document.createElement('p');
    note.className = 'card-note';
    const parts = [];
    if (!item.options_official) parts.push('As alternativas não vieram todas da prova.');
    if (item.review_note) parts.push(item.review_note);
    note.textContent = parts.join(' ');
    article.appendChild(note);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  actions.appendChild(actionButton('Incluir no banco', () => send(item, 'usable', actions)));
  actions.appendChild(actionButton('Guardar rascunho', () => send(item, 'draft', actions)));
  const link = document.createElement('a');
  link.href = item.source_url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = 'Abrir a fonte';
  actions.appendChild(link);
  article.appendChild(actions);

  if (decisoes[item.review_id]) {
    const status = document.createElement('p');
    status.className = 'status-line';
    status.textContent = decisoes[item.review_id] === 'draft' ? 'Guardada como rascunho neste navegador.' : 'Incluída no banco neste navegador.';
    article.appendChild(status);
  }

  return article;
}

function actionButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = label.startsWith('Incluir') ? 'btn-primary' : 'btn-secondary';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

async function send(item, status, actions) {
  const buttons = [...actions.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const response = await fetch('/api/question-bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(item, status)),
    });
    const data = await response.json();
    if (!response.ok) {
      const fields = Array.isArray(data.fields) ? ` (${data.fields.join(', ')})` : '';
      throw new Error((data.error || 'Falha ao gravar') + fields);
    }
    decisoes[item.review_id] = status;
    saveDecisoes();
    render();
  } catch (error) {
    buttons.forEach((button) => { button.disabled = false; });
    alert(error.message);
  }
}

async function boot() {
  const response = await fetch('question_bank/revisao/candidatos.json');
  if (!response.ok) throw new Error('Não foi possível carregar o lote.');
  lote = await response.json();
  document.getElementById('aviso').textContent = lote.aviso;
  render();
}

boot().catch((error) => {
  document.getElementById('aviso').textContent = error.message + ' Abra esta página pelo servidor: node server.js';
});
