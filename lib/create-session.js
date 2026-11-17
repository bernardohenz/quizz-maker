function createSession() {
  return {
    excludeIds: [],
    usedSkills: [],
  };
}

function noteShown(session, shown) {
  const excludeIds = session.excludeIds.slice();
  const sourceIds = shown && shown.sourceIds;
  if (Array.isArray(sourceIds)) excludeIds.push(...sourceIds);
  return {
    excludeIds,
    usedSkills: session.usedSkills.slice(),
  };
}

function noteAccepted(session, accepted) {
  const usedSkills = session.usedSkills.slice();
  const skill = accepted && accepted.skill;
  if (typeof skill === 'string' && skill !== '') usedSkills.push(skill);
  return {
    excludeIds: session.excludeIds.slice(),
    usedSkills,
  };
}

function bankRequestBody(config, session, note) {
  const trimmed = typeof note === 'string' ? note.trim() : '';
  const body = {
    serie: Number(config.serie),
    assunto: config.assunto,
    tematica: config.tematica,
    dificuldade: config.dificuldade,
    mode: 'bank',
    excludeIds: session.excludeIds.slice(),
    usedSkills: session.usedSkills.slice(),
  };
  if (trimmed !== '') body.nota = trimmed;
  return body;
}

const api = { createSession, noteShown, noteAccepted, bankRequestBody };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
globalThis.CreateSession = api;
