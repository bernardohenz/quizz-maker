function weightedPick(items, weightOf, rng) {
  const weights = items.map(weightOf);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let ticket = rng() * total;
  for (let index = 0; index < items.length; index += 1) {
    ticket -= weights[index];
    if (ticket < 0) return items[index];
  }
  return items[items.length - 1];
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return Number.NEGATIVE_INFINITY;
  }
  let dot = 0;
  let sumA = 0;
  let sumB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    sumA += a[index] * a[index];
    sumB += b[index] * b[index];
  }
  const norm = Math.sqrt(sumA) * Math.sqrt(sumB);
  if (norm === 0) return Number.NEGATIVE_INFINITY;
  return dot / norm;
}

function acceptable(item, ctx) {
  if (!item || item.status !== 'usable') return false;
  if (item.origin !== 'public' && item.origin !== 'manual') return false;
  if (typeof item.source_label !== 'string' || item.source_label.trim() === '') return false;
  if (item.subject !== ctx.subject) return false;
  if (!(item.grade_min <= ctx.gradeIndex && ctx.gradeIndex <= item.grade_max)) return false;
  if (Math.abs(item.difficulty - ctx.difficultyTarget) > ctx.window) return false;
  if (ctx.excludeIds.has(item.id)) return false;
  return true;
}

function retrieveFamily(items, query, rng = Math.random) {
  const excludeIds = new Set(query.excludeIds || []);
  const usedSkills = query.usedSkills || [];
  let window = 1;

  const collect = () => items.filter((entry) => acceptable(entry, {
    subject: query.subject,
    gradeIndex: query.gradeIndex,
    difficultyTarget: query.difficultyTarget,
    window,
    excludeIds,
  }));

  let candidates = collect();
  while (candidates.length < 3 && window < 3) {
    window += 1;
    candidates = collect();
  }
  if (candidates.length === 0) return { empty: true, family: [] };

  const note = typeof query.note === 'string' ? query.note.trim() : '';
  const rankByNote = note !== ''
    && query.embeddingsConfigured === true
    && Array.isArray(query.noteEmbedding);

  const shortlist = (rankByNote
    ? candidates
      .map((entry) => ({
        entry,
        score: Array.isArray(entry.embedding)
          ? cosine(query.noteEmbedding, entry.embedding)
          : Number.NEGATIVE_INFINITY,
      }))
      .sort((a, b) => (a.score === b.score ? 0 : b.score - a.score))
    : candidates
      .map((entry) => ({
        entry,
        distance: Math.abs(entry.difficulty - query.difficultyTarget),
        tie: rng(),
      }))
      .sort((a, b) => a.distance - b.distance || a.tie - b.tie))
    .slice(0, 8)
    .map((ranked) => ranked.entry);

  const anchor = weightedPick(
    shortlist,
    (entry) => (usedSkills.includes(entry.skill) ? 0.25 : 1),
    rng,
  );

  const siblings = candidates
    .filter((entry) => entry.id !== anchor.id
      && entry.skill === anchor.skill
      && entry.theme_policy === anchor.theme_policy)
    .sort((a, b) => {
      const stemA = a.stem === anchor.stem ? 1 : 0;
      const stemB = b.stem === anchor.stem ? 1 : 0;
      if (stemA !== stemB) return stemA - stemB;
      return Math.abs(a.difficulty - query.difficultyTarget) - Math.abs(b.difficulty - query.difficultyTarget);
    })
    .slice(0, 2);

  const family = [anchor, ...siblings];
  return {
    empty: false,
    family,
    skill: anchor.skill,
    sourceIds: family.map((entry) => entry.id),
  };
}

module.exports = { retrieveFamily, cosine };
