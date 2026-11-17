const test = require('node:test');
const assert = require('node:assert/strict');
const { createSession, noteShown, noteAccepted, bankRequestBody } = require('../lib/create-session');

test('banco reenvia ids mostrados e habilidades aceitas', () => {
  let session = createSession();
  session = noteShown(session, { sourceIds: ['a', 'b'], skill: 'somar' });
  session = noteAccepted(session, { skill: 'somar' });
  session = noteAccepted(session, { question: 'livre' });
  const body = bankRequestBody(
    { serie: '4', assunto: 'Matemática', tematica: 'Pokemon', dificuldade: 'médio' },
    session,
    '  conta de vezes  '
  );
  assert.deepEqual(body.excludeIds, ['a', 'b']);
  assert.deepEqual(body.usedSkills, ['somar']);
  assert.equal(body.mode, 'bank');
  assert.equal(body.nota, 'conta de vezes');
  assert.equal(body.serie, 4);
});
