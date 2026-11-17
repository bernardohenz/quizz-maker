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

  const shortlist = candidates
    .map((entry) => ({
      entry,
      distance: Math.abs(entry.difficulty - query.difficultyTarget),
      tie: rng(),
    }))
    .sort((a, b) => a.distance - b.distance || a.tie - b.tie)
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

module.exports = { retrieveFamily };
