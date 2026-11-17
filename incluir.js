let editingId = null;
let listStatus = 'draft';
let saving = false;

function setValue(id, value) {
  document.getElementById(id).value = value == null ? '' : String(value);
}

function setRadio(name, value) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = input.value === value;
  });
}

function setSelectValue(id, value) {
  const select = document.getElementById(id);
  const next = value == null ? '' : String(value);
  const exists = [...select.options].some((option) => option.value === next);
  select.value = exists ? next : '';
}

function setSelectInt(id, value) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  setSelectValue(id, Number.isInteger(parsed) && parsed >= 1 ? String(parsed) : '');
}

function checkedValue(name) {
  const selected = document.querySelector(`input[name="${name}"]:checked`);
  return selected ? selected.value : '';
}

function readInteger(id) {
  const parsed = Number.parseInt(document.getElementById(id).value, 10);
  return Number.isInteger(parsed) ? parsed : 0;
}

function optionRows() {
  return [...document.querySelectorAll('#options .option-row')];
}

function readFilledOptions() {
  const filled = [];
  optionRows().forEach((row) => {
    const text = row.querySelector('.option-text').value.trim();
    if (text === '') return;
    filled.push({
      text,
      correct: row.querySelector('input[name="correct"]').checked,
      error: row.querySelector('.distractor-text').value.trim(),
    });
  });
  return filled;
}

function readForm() {
  const filled = readFilledOptions();
  const correctIndex = filled.findIndex((row) => row.correct);
  const tags = document.getElementById('skill_tags').value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
  const preserve = document.getElementById('preserve').value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const item = {
    origin: checkedValue('origin'),
    source_label: document.getElementById('source_label').value,
    stem: document.getElementById('stem').value,
    subject: document.getElementById('subject').value,
    grade_min: readInteger('grade_min'),
    grade_max: readInteger('grade_max'),
    difficulty: readInteger('difficulty'),
    skill: document.getElementById('skill').value,
    explanation: document.getElementById('explanation').value,
    options: filled.map((row) => row.text),
    correct_index: correctIndex,
    theme_policy: checkedValue('theme_policy'),
    invariant: { preserve },
    distractors: filled.flatMap((row, index) => (
      index === correctIndex ? [] : [{ index, error: row.error }]
    )),
  };
  if (tags.length > 0) item.skill_tags = tags;
  return item;
}

function addOptionRow({ text = '', error = '', correct = false } = {}) {
  const row = document.createElement('div');
  row.className = 'option-row';

  const choice = document.createElement('label');
  choice.className = 'choice';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'correct';
  choice.append(radio, document.createTextNode(' Correta'));

  const optionInput = document.createElement('input');
  optionInput.type = 'text';
  optionInput.className = 'option-text';
  optionInput.value = text;
  optionInput.setAttribute('aria-label', 'Alternativa');

  const errorInput = document.createElement('input');
  errorInput.type = 'text';
  errorInput.className = 'distractor-text';
  errorInput.value = error;
  errorInput.setAttribute('aria-label', 'Tipo de erro');

  const optionGroup = document.createElement('div');
  optionGroup.className = 'form-group';
  optionGroup.append(optionInput);

  const errorGroup = document.createElement('div');
  errorGroup.className = 'form-group';
  errorGroup.append(errorInput);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-secondary remove-option';
  remove.textContent = 'Remover';

  row.append(choice, optionGroup, errorGroup, remove);
  document.getElementById('options').append(row);
  radio.checked = correct;
}

function preserveLines(source) {
  if (source.invariant && Array.isArray(source.invariant.preserve)) return source.invariant.preserve;
  if (Array.isArray(source.preserve)) return source.preserve;
  return [];
}

function renderOptionRows(source) {
  const box = document.getElementById('options');
  box.replaceChildren();
  const options = Array.isArray(source.options)
    ? source.options.filter((option) => typeof option === 'string')
    : [];
  const rows = options.length > 0 ? options : ['', '', '', ''];
  const correctIndex = Number.isInteger(source.correct_index) ? source.correct_index : -1;
  const distractors = Array.isArray(source.distractors) ? source.distractors : [];
  rows.forEach((option, index) => {
    const match = distractors.find((entry) => entry && entry.index === index);
    addOptionRow({
      text: option,
      error: match && typeof match.error === 'string' ? match.error : '',
      correct: index === correctIndex,
    });
  });
}

function tagsToField(value) {
  if (Array.isArray(value)) return value.filter((tag) => typeof tag === 'string').join(', ');
  if (typeof value === 'string') return value;
  return '';
}

function writeForm(item) {
  const source = item && typeof item === 'object' ? item : {};
  setRadio('origin', source.origin);
  setValue('source_label', source.source_label);
  setValue('stem', source.stem);
  setSelectValue('subject', source.subject);
  setSelectInt('grade_min', source.grade_min);
  setSelectInt('grade_max', source.grade_max);
  setSelectInt('difficulty', source.difficulty);
  setValue('skill', source.skill);
  setValue('skill_tags', tagsToField(source.skill_tags));
  setRadio('theme_policy', source.theme_policy);
  setValue('explanation', source.explanation);
  setValue('preserve', preserveLines(source)
    .filter((line) => typeof line === 'string')
    .join('\n'));
  renderOptionRows(source);
  refreshButtons();
}

function applyExtraction(payload) {
  const current = readForm();
  const transcription = payload && payload.transcription ? payload.transcription : {};
  const suggestions = payload && payload.suggestions ? payload.suggestions : {};
  const next = {
    ...current,
    stem: transcription.stem == null ? '' : String(transcription.stem),
    options: Array.isArray(transcription.options)
      ? transcription.options.filter((option) => typeof option === 'string')
      : [],
    correct_index: transcription.correct_index,
    explanation: transcription.explanation == null ? '' : String(transcription.explanation),
    distractors: Array.isArray(suggestions.distractors) ? suggestions.distractors : [],
  };
  if (typeof suggestions.subject === 'string') next.subject = suggestions.subject;
  if (suggestions.grade_min != null) next.grade_min = suggestions.grade_min;
  if (suggestions.grade_max != null) next.grade_max = suggestions.grade_max;
  if (suggestions.difficulty != null) next.difficulty = suggestions.difficulty;
  if (typeof suggestions.skill === 'string') next.skill = suggestions.skill;
  if (Array.isArray(suggestions.skill_tags)) next.skill_tags = suggestions.skill_tags;
  if (typeof suggestions.theme_policy === 'string') next.theme_policy = suggestions.theme_policy;
  const preserve = suggestions.invariant && Array.isArray(suggestions.invariant.preserve)
    ? suggestions.invariant.preserve
    : suggestions.preserve;
  if (Array.isArray(preserve)) next.invariant = { preserve };
  writeForm(next);
}

function refreshButtons() {
  const errors = ItemRules.usableErrors(readForm());
  document.getElementById('save-usable').disabled = errors.length > 0;
}

function clearForm() {
  writeForm({
    options: [],
    correct_index: null,
    invariant: { preserve: [] },
    distractors: [],
  });
}

function fillSubjects() {
  const select = document.getElementById('subject');
  QuizGrades.SUBJECTS.forEach((subject) => {
    const option = document.createElement('option');
    option.value = subject;
    option.textContent = subject;
    select.append(option);
  });
}

function fillGrades(id) {
  const select = document.getElementById(id);
  for (let grade = 1; grade <= 13; grade += 1) {
    const option = document.createElement('option');
    option.value = String(grade);
    option.textContent = QuizGrades.gradeLabel(grade);
    select.append(option);
  }
}

function fillDifficulty() {
  const select = document.getElementById('difficulty');
  for (let level = 1; level <= 10; level += 1) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent = String(level);
    select.append(option);
  }
}

function formError() {
  return document.getElementById('form-error');
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function loadList() {
  const list = document.getElementById('item-list');
  const response = await fetch(`/api/question-bank?status=${listStatus}`);
  const body = await readJson(response);
  if (response.status === 503 && body && body.code === 'bank_unavailable') {
    renderList([]);
    return;
  }
  if (!response.ok || !Array.isArray(body)) {
    list.textContent = (body && body.error) || 'Não foi possível carregar a lista.';
    return;
  }
  renderList(body);
}

function renderList(items) {
  const list = document.getElementById('item-list');
  list.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = listStatus === 'draft' ? 'Nenhum rascunho.' : 'Nenhuma questão no banco.';
    list.append(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'option-preview-item';
    const stem = document.createElement('span');
    stem.textContent = item.stem || '';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn-secondary';
    edit.textContent = 'Editar';
    edit.addEventListener('click', () => {
      editingId = item.id;
      writeForm(item);
      document.getElementById('stem').scrollIntoView({ block: 'center' });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-secondary';
    remove.textContent = 'Excluir';
    remove.addEventListener('click', () => removeItem(item.id));
    row.append(stem, edit, remove);
    list.append(row);
  });
}

async function removeItem(id) {
  const response = await fetch(`/api/question-bank/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const body = await readJson(response);
  if (!response.ok) {
    formError().textContent = body.error || 'Não foi possível excluir.';
    return;
  }
  if (editingId === id) {
    editingId = null;
    clearForm();
  }
  formError().textContent = '';
  await loadList();
}

async function save(status) {
  if (saving) return;
  saving = true;
  formError().textContent = '';
  const creating = editingId == null;
  const url = creating
    ? '/api/question-bank'
    : `/api/question-bank/${encodeURIComponent(editingId)}`;
  try {
    const response = await fetch(url, {
      method: creating ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...readForm(), status }),
    });
    const body = await readJson(response);
    if (response.status === 400) {
      const fields = Array.isArray(body.fields) ? body.fields : [];
      formError().textContent = fields.length > 0 ? fields.join(', ') : (body.error || 'Item inválido');
      return;
    }
    if (!response.ok) {
      formError().textContent = body.error || 'Não foi possível guardar a questão.';
      return;
    }
    if (status === 'draft') {
      if (body && typeof body.id === 'string') editingId = body.id;
    } else {
      editingId = null;
      clearForm();
    }
    await loadList();
  } catch (error) {
    formError().textContent = 'Não foi possível guardar a questão.';
  } finally {
    saving = false;
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a foto.'));
    reader.readAsDataURL(file);
  });
}

async function readPhoto() {
  const input = document.getElementById('photo');
  const file = input.files && input.files[0];
  if (!file) {
    formError().textContent = 'Escolha uma foto JPEG, PNG ou WebP.';
    return;
  }
  const button = document.getElementById('read-photo');
  button.disabled = true;
  try {
    const imageDataUrl = await readFile(file);
    const response = await fetch('/api/extract-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl }),
    });
    const body = await readJson(response);
    if (!response.ok) {
      formError().textContent = body.error || 'Não foi possível ler a foto.';
      return;
    }
    formError().textContent = '';
    applyExtraction(body);
  } catch (error) {
    formError().textContent = error && error.message ? error.message : 'Não foi possível ler a foto.';
  } finally {
    button.disabled = false;
  }
}

function showList(status) {
  listStatus = status;
  loadList();
}

function ensureItemRules() {
  if (typeof ItemRules !== 'undefined') return;
  const request = new XMLHttpRequest();
  request.open('GET', 'lib/item-rules.js', false);
  request.send();
  new Function(request.responseText)();
}

function init() {
  fillSubjects();
  fillGrades('grade_min');
  fillGrades('grade_max');
  fillDifficulty();
  for (let index = 0; index < 4; index += 1) addOptionRow();
  refreshButtons();

  const form = document.getElementById('item-form');
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', refreshButtons);
  form.addEventListener('change', refreshButtons);
  document.getElementById('add-option').addEventListener('click', () => {
    addOptionRow();
    refreshButtons();
  });
  document.getElementById('options').addEventListener('click', (event) => {
    const button = event.target.closest('.remove-option');
    if (!button) return;
    const row = button.closest('.option-row');
    if (row) row.remove();
    refreshButtons();
  });
  document.getElementById('read-photo').addEventListener('click', readPhoto);
  document.getElementById('save-draft').addEventListener('click', () => save('draft'));
  document.getElementById('save-usable').addEventListener('click', () => save('usable'));
  document.getElementById('show-drafts').addEventListener('click', () => showList('draft'));
  document.getElementById('show-usable').addEventListener('click', () => showList('usable'));
  loadList();
}

function boot() {
  ensureItemRules();
  init();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
