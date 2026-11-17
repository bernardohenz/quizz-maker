function draftErrors(item) {
  const errors = [];
  if (!item || (item.origin !== 'public' && item.origin !== 'manual')) errors.push('origin');
  if (!item || typeof item.source_label !== 'string' || item.source_label.trim() === '') errors.push('source_label');
  if (!item || typeof item.stem !== 'string' || item.stem.trim() === '') errors.push('stem');
  return errors;
}

function usableErrors(item) {
  const subjects = globalThis.QuizGrades.SUBJECTS;
  const errors = draftErrors(item);
  if (!item) return errors;
  if (!subjects.includes(item.subject)) errors.push('subject');
  if (!Number.isInteger(item.grade_min) || item.grade_min < 1 || item.grade_min > 13) errors.push('grade_min');
  if (!Number.isInteger(item.grade_max) || item.grade_max < 1 || item.grade_max > 13) errors.push('grade_max');
  if (Number.isInteger(item.grade_min) && Number.isInteger(item.grade_max) && item.grade_min > item.grade_max) {
    errors.push('grade_range');
  }
  if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 10) errors.push('difficulty');
  if (typeof item.skill !== 'string' || item.skill.trim() === '') errors.push('skill');
  if (item.theme_policy !== 'reskin' && item.theme_policy !== 'wording') errors.push('theme_policy');
  const options = Array.isArray(item.options) ? item.options : [];
  const optionCountOk = options.length === 4 || options.length === 5;
  if (!optionCountOk || options.some((option) => typeof option !== 'string' || option.trim() === '')) {
    errors.push('options');
  }
  if (!Number.isInteger(item.correct_index) || item.correct_index < 0 || item.correct_index >= options.length) {
    errors.push('correct_index');
  }
  if (typeof item.explanation !== 'string' || item.explanation.trim() === '') errors.push('explanation');
  const preserve = item.invariant && Array.isArray(item.invariant.preserve) ? item.invariant.preserve : [];
  if (!preserve.some((line) => typeof line === 'string' && line.trim() !== '')) errors.push('preserve');
  if (optionCountOk && Number.isInteger(item.correct_index)) {
    const distractors = Array.isArray(item.distractors) ? item.distractors : [];
    for (let index = 0; index < options.length; index += 1) {
      if (index === item.correct_index) continue;
      const found = distractors.some((entry) => entry && entry.index === index && typeof entry.error === 'string' && entry.error.trim() !== '');
      if (!found) errors.push(`distractor_${index}`);
    }
  }
  if (item.skill_tags !== undefined && (!Array.isArray(item.skill_tags) || item.skill_tags.some((tag) => typeof tag !== 'string'))) {
    errors.push('skill_tags');
  }
  return errors;
}

const api = { draftErrors, usableErrors };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
globalThis.ItemRules = api;