const SUBJECTS = [
  'Matemática', 'Português', 'Geografia', 'História', 'Ciências',
  'Inglês', 'Física', 'Química', 'Biologia',
];

const DIFFICULTY_TARGETS = {
  'muito fácil': 2,
  'fácil': 4,
  'médio': 6,
  'difícil': 8,
  'muito difícil': 10,
};

function gradeLabel(index) {
  if (!Number.isInteger(index) || index < 1 || index > 13) return null;
  if (index <= 9) return `${index}º ano`;
  if (index <= 12) return `${index - 9}º ano do médio`;
  return 'Pós-médio';
}

function gradeStage(index) {
  if (!Number.isInteger(index) || index < 1 || index > 13) return null;
  if (index <= 9) return 'ensino fundamental';
  if (index <= 12) return 'ensino médio';
  return 'pós-médio';
}

function difficultyTarget(label) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_TARGETS, label)
    ? DIFFICULTY_TARGETS[label]
    : null;
}

const api = { SUBJECTS, gradeLabel, gradeStage, difficultyTarget };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
globalThis.QuizGrades = api;