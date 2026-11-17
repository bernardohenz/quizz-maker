async function withServer(fn) {
  const { createQuizServer } = require('../server');
  const server = createQuizServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

module.exports = { withServer };
